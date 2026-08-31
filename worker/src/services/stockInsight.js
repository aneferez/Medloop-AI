// Predictive & family-aware stock (feature #4) + adherence (#12). Reads real
// consumption from dose_logs so the same insight backs the patient's own stock
// view, the caregiver's per-patient view, and the family rollup.

import { normalizeMedicineRow } from '../domain/medicine.js'
import { CONSUMPTION_WINDOW_DAYS, predictStock, shiftIsoDate, summarizeStock } from '../domain/stock.js'
import { localDateParts } from '../domain/schedule.js'
import { computeAdherence } from '../domain/adherence.js'

async function patientTimezone(db, patientId) {
  const settings = await db.first('SELECT timezone FROM patient_settings WHERE patient_id = ?', [patientId])
  return settings?.timezone || 'Asia/Kolkata'
}

// Per-medicine stock, each with a prediction block driven by trailing consumption.
export async function patientStockItems(db, patientId, { now = new Date() } = {}) {
  const rows = await db.all('SELECT * FROM medicines WHERE patient_id = ?', [patientId])
  if (!rows.length) return []
  const today = localDateParts(now, await patientTimezone(db, patientId)).date
  const windowStart = shiftIsoDate(today, -(CONSUMPTION_WINDOW_DAYS - 1))

  const takenRows = await db.all(
    "SELECT medicine_id, COUNT(*) AS taken FROM dose_logs WHERE patient_id = ? AND status = 'taken' AND dose_date >= ? GROUP BY medicine_id",
    [patientId, windowStart],
  )
  const takenByMedicine = new Map(takenRows.map((row) => [row.medicine_id, Number(row.taken)]))

  return rows.map((row) => {
    const medicine = normalizeMedicineRow(row)
    const base = summarizeStock(medicine, now)
    const prediction = predictStock(medicine, {
      takenDoses: takenByMedicine.get(row.id) || 0,
      windowDays: CONSUMPTION_WINDOW_DAYS,
      fromDate: now,
    })
    return { id: row.id, name: row.name, ...base, prediction }
  })
}

// Roll a per-medicine item list up into the summary counts the API returns.
export function summarizeStockItems(items) {
  const low = items.filter((item) => item.low)
  const predictedLow = items.filter((item) => item.prediction.predictedLow)
  return {
    items,
    lowStockCount: low.length,
    lowStockIds: low.map((item) => item.id),
    predictedLowCount: predictedLow.length,
    predictedLowIds: predictedLow.map((item) => item.id),
  }
}

// Adherence report over the trailing `rangeDays`.
export async function patientAdherence(db, patientId, { rangeDays = 30, now = new Date() } = {}) {
  const today = localDateParts(now, await patientTimezone(db, patientId)).date
  const from = shiftIsoDate(today, -(rangeDays - 1))
  const rows = await db.all(
    `SELECT medicine_id, medicine_name, status, COUNT(*) AS n
     FROM dose_logs WHERE patient_id = ? AND dose_date >= ?
     GROUP BY medicine_id, medicine_name, status`,
    [patientId, from],
  )
  return computeAdherence(rows, { rangeDays, from, to: today })
}

const minutesOfTime = (value) => {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? ''))
  return match ? Number(match[1]) * 60 + Number(match[2]) : null
}

// Today's medication board for one patient: each enabled dose with its status,
// a status summary, and the next upcoming (still-pending) dose. Powers the
// caregiver dashboard cards (daily checks + "future" next dose).
export async function patientDoseSummary(db, patientId, { now = new Date() } = {}) {
  const { date, hour, minute } = localDateParts(now, await patientTimezone(db, patientId))
  const minutesNow = hour * 60 + minute

  const rows = await db.all('SELECT * FROM medicines WHERE patient_id = ?', [patientId])
  const medicines = rows.map(normalizeMedicineRow).filter((medicine) => medicine.enabledPeriods.length > 0)
  const logs = await db.all(
    'SELECT medicine_id, dose_period, status, taken_at FROM dose_logs WHERE patient_id = ? AND dose_date = ?',
    [patientId, date],
  )
  const statusByKey = new Map()
  for (const log of logs) statusByKey.set(`${log.medicine_id}:${log.dose_period}`, log)

  const doses = []
  const summary = { taken: 0, missed: 0, skipped: 0, pending: 0, total: 0 }
  for (const medicine of medicines) {
    for (const period of medicine.enabledPeriods) {
      const log = statusByKey.get(`${medicine.id}:${period}`)
      const status = log ? log.status : 'pending'
      if (status in summary) summary[status] += 1
      summary.total += 1
      doses.push({
        medicineId: medicine.id,
        name: medicine.name,
        period,
        scheduledTime: medicine.times?.[period] ?? null,
        status,
        takenAt: log?.taken_at ?? null,
      })
    }
  }

  const pending = doses
    .filter((dose) => dose.status === 'pending' && minutesOfTime(dose.scheduledTime) != null)
    .sort((a, b) => minutesOfTime(a.scheduledTime) - minutesOfTime(b.scheduledTime))
  const next = pending.find((dose) => minutesOfTime(dose.scheduledTime) >= minutesNow) || pending[0] || null

  return {
    date,
    summary,
    next: next ? { name: next.name, period: next.period, scheduledTime: next.scheduledTime } : null,
    doses,
  }
}
