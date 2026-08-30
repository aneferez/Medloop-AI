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
