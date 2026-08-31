import { ok, readJsonBody } from '../lib/http.js'
import { notFound } from '../lib/errors.js'
import { Validator } from '../lib/validate.js'
import { newId, nowIso } from '../lib/ids.js'
import { normalizeMedicineRow, toPublicMedicine } from '../domain/medicine.js'
import { summarizeStock } from '../domain/stock.js'
import { patientAdherence, patientStockItems, summarizeStockItems } from '../services/stockInsight.js'
import { DOSE_PERIODS, DOSE_STATUSES, PERIOD_TIME_COLUMN, stockDeltaForTransition, takenTimestamp } from '../domain/doses.js'

// camelCase input -> D1 column for sparse PATCH updates.
const MEDICINE_COLUMNS = {
  name: 'name',
  dosage: 'dosage',
  memberId: 'member_id',
  morningTime: 'morning_time',
  afternoonTime: 'afternoon_time',
  nightTime: 'night_time',
  enabledPeriods: 'enabled_periods',
  important: 'important',
  refill: 'refill',
  stockRemaining: 'stock_remaining',
  doseUnitsPerDose: 'dose_units_per_dose',
  stockBufferDays: 'stock_buffer_days',
  lowStockThreshold: 'low_stock_threshold',
  stockUnitLabel: 'stock_unit_label',
}

function validateMedicineInput(body, { partial }) {
  const v = new Validator(body)
  v.string('name', { required: !partial, max: 120 })
  v.string('dosage', { max: 120, fallback: partial ? undefined : '' })
  v.string('memberId', { max: 64 })
  v.time('morningTime')
  v.time('afternoonTime')
  v.time('nightTime')
  v.stringArray('enabledPeriods', { allowed: DOSE_PERIODS, fallback: partial ? undefined : [] })
  v.boolean('important', { fallback: partial ? undefined : false })
  v.boolean('refill', { fallback: partial ? undefined : false })
  v.integer('stockRemaining', { min: 0, max: 1_000_000 })
  v.number('doseUnitsPerDose', { min: 0, max: 1000, fallback: partial ? undefined : 1 })
  v.integer('stockBufferDays', { min: 0, max: 365, fallback: partial ? undefined : 7 })
  v.integer('lowStockThreshold', { min: 0, max: 1_000_000 })
  v.string('stockUnitLabel', { max: 24, fallback: partial ? undefined : 'tablets' })
  return v.ensureValid()
}

function toDbMedicineValue(key, value) {
  if (key === 'enabledPeriods') return JSON.stringify(Array.isArray(value) ? value : [])
  if (typeof value === 'boolean') return value ? 1 : 0
  return value ?? null
}

const publicDoseLog = (row) => ({
  id: row.id,
  medicineId: row.medicine_id,
  medicineName: row.medicine_name,
  period: row.dose_period,
  status: row.status,
  takenAt: row.taken_at ?? null,
  doseDate: row.dose_date,
  scheduledTime: row.scheduled_time ?? null,
  stockAfter: row.stock_after ?? null,
  recordedAt: row.recorded_at,
})

export function registerMedicineRoutes(router) {
  // Stock overview across all medicines (rows #8, #10, #11) with a predictive
  // block per item driven by real consumption (feature #4). `predictedLow*`
  // surfaces medicines projected to run out inside their buffer, ahead of the
  // static low-stock threshold.
  router.get('/stock/summary', async (ctx) => {
    const items = await patientStockItems(ctx.db, ctx.auth.patient.id)
    return ok(summarizeStockItems(items))
  })

  // Adherence report (#12) over the trailing ?range= days (default 30).
  router.get('/adherence', async (ctx) => {
    const range = Math.min(365, Math.max(1, Number(ctx.query.range) || 30))
    const report = await patientAdherence(ctx.db, ctx.auth.patient.id, { rangeDays: range })
    return ok(report)
  })

  router.get('/medicines', async (ctx) => {
    const rows = await ctx.db.all(
      'SELECT * FROM medicines WHERE patient_id = ? ORDER BY created_at ASC',
      [ctx.auth.patient.id],
    )
    return ok({ medicines: rows.map((row) => toPublicMedicine(row)) })
  })

  router.post('/medicines', async (ctx) => {
    const body = await readJsonBody(ctx.request)
    const input = validateMedicineInput(body, { partial: false })
    const id = newId()
    const now = nowIso()
    await ctx.db.run(
      `INSERT INTO medicines
         (id, patient_id, member_id, name, dosage, morning_time, afternoon_time, night_time,
          enabled_periods, important, refill, stock_remaining, dose_units_per_dose,
          stock_buffer_days, low_stock_threshold, stock_unit_label, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, ctx.auth.patient.id, input.memberId ?? null, input.name, input.dosage ?? '',
        input.morningTime ?? null, input.afternoonTime ?? null, input.nightTime ?? null,
        JSON.stringify(input.enabledPeriods ?? []), input.important ? 1 : 0, input.refill ? 1 : 0,
        input.stockRemaining ?? null, input.doseUnitsPerDose ?? 1, input.stockBufferDays ?? 7,
        input.lowStockThreshold ?? null, input.stockUnitLabel ?? 'tablets', now, now,
      ],
    )
    const row = await ctx.db.first('SELECT * FROM medicines WHERE id = ?', [id])
    return ok({ medicine: toPublicMedicine(row) }, { status: 201 })
  })

  router.get('/medicines/:id', async (ctx) => {
    const row = await ctx.db.first(
      'SELECT * FROM medicines WHERE id = ? AND patient_id = ?',
      [ctx.params.id, ctx.auth.patient.id],
    )
    if (!row) throw notFound('Medicine not found.')
    return ok({ medicine: toPublicMedicine(row) })
  })

  router.patch('/medicines/:id', async (ctx) => {
    const existing = await ctx.db.first(
      'SELECT id FROM medicines WHERE id = ? AND patient_id = ?',
      [ctx.params.id, ctx.auth.patient.id],
    )
    if (!existing) throw notFound('Medicine not found.')

    const body = await readJsonBody(ctx.request)
    const input = validateMedicineInput(body, { partial: true })
    const sets = []
    const params = []
    for (const [key, column] of Object.entries(MEDICINE_COLUMNS)) {
      if (key in input) {
        sets.push(`${column} = ?`)
        params.push(toDbMedicineValue(key, input[key]))
      }
    }
    sets.push('updated_at = ?')
    params.push(nowIso(), existing.id, ctx.auth.patient.id)
    await ctx.db.run(`UPDATE medicines SET ${sets.join(', ')} WHERE id = ? AND patient_id = ?`, params)
    const row = await ctx.db.first('SELECT * FROM medicines WHERE id = ?', [existing.id])
    return ok({ medicine: toPublicMedicine(row) })
  })

  router.delete('/medicines/:id', async (ctx) => {
    const result = await ctx.db.run(
      'DELETE FROM medicines WHERE id = ? AND patient_id = ?',
      [ctx.params.id, ctx.auth.patient.id],
    )
    if (!result.meta || result.meta.changes === 0) throw notFound('Medicine not found.')
    return ok({ deleted: true })
  })

  // Record a dose status (rows #6, #7) and auto-adjust stock (row #9). The
  // stock delta is derived from the slot's previous status so recording the
  // same status twice never double-counts.
  router.post('/medicines/:id/dose', async (ctx) => {
    const patientId = ctx.auth.patient.id
    const row = await ctx.db.first('SELECT * FROM medicines WHERE id = ? AND patient_id = ?', [ctx.params.id, patientId])
    if (!row) throw notFound('Medicine not found.')

    const body = await readJsonBody(ctx.request)
    const v = new Validator(body)
    v.enum('period', DOSE_PERIODS, { required: true })
    v.enum('status', DOSE_STATUSES, { required: true })
    v.date('doseDate', { required: true })
    v.time('scheduledTime')
    const input = v.ensureValid()

    const medicine = normalizeMedicineRow(row)
    const previous = await ctx.db.first(
      'SELECT status FROM dose_logs WHERE medicine_id = ? AND dose_date = ? AND dose_period = ? ORDER BY recorded_at DESC LIMIT 1',
      [row.id, input.doseDate, input.period],
    )
    const prevStatus = previous ? previous.status : 'pending'
    const delta = stockDeltaForTransition(prevStatus, input.status, medicine.doseUnitsPerDose)

    const now = nowIso()
    const doseLogId = newId()
    const tracksStock = medicine.stockRemaining != null
    let stockAfter = tracksStock ? medicine.stockRemaining : null

    const statements = []
    if (tracksStock && delta !== 0) {
      stockAfter = Math.max(0, medicine.stockRemaining + delta)
      statements.push({
        sql: 'UPDATE medicines SET stock_remaining = ?, updated_at = ? WHERE id = ?',
        params: [stockAfter, now, row.id],
      })
      statements.push({
        sql: `INSERT INTO stock_events (id, patient_id, medicine_id, delta, balance_after, reason, dose_log_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [newId(), patientId, row.id, delta, stockAfter, 'dose_taken', doseLogId, now],
      })
    }

    const scheduledTime = input.scheduledTime ?? row[PERIOD_TIME_COLUMN[input.period]] ?? null
    statements.push({
      sql: `INSERT INTO dose_logs
              (id, patient_id, medicine_id, member_id, medicine_name, dosage, scheduled_time, dose_period,
               status, taken_at, dose_date, stock_after, recorded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        doseLogId, patientId, row.id, row.member_id, row.name, row.dosage, scheduledTime, input.period,
        input.status, takenTimestamp(input.status, now), input.doseDate, tracksStock ? stockAfter : null, now,
      ],
    })

    await ctx.db.batch(statements)
    const updated = await ctx.db.first('SELECT * FROM medicines WHERE id = ?', [row.id])
    const doseRow = await ctx.db.first('SELECT * FROM dose_logs WHERE id = ?', [doseLogId])
    return ok({
      doseLog: publicDoseLog(doseRow),
      previousStatus: prevStatus,
      stock: summarizeStock(normalizeMedicineRow(updated)),
    }, { status: 201 })
  })

  // Dose history for a medicine, optionally filtered by ?date=YYYY-MM-DD.
  router.get('/medicines/:id/doses', async (ctx) => {
    const medicine = await ctx.db.first('SELECT id FROM medicines WHERE id = ? AND patient_id = ?', [ctx.params.id, ctx.auth.patient.id])
    if (!medicine) throw notFound('Medicine not found.')
    const date = ctx.query.date
    const rows = date
      ? await ctx.db.all('SELECT * FROM dose_logs WHERE medicine_id = ? AND dose_date = ? ORDER BY recorded_at DESC', [ctx.params.id, date])
      : await ctx.db.all('SELECT * FROM dose_logs WHERE medicine_id = ? ORDER BY recorded_at DESC LIMIT 100', [ctx.params.id])
    return ok({ doses: rows.map(publicDoseLog) })
  })

  // Manual restock (row #9 inverse). Cron uses the same reason for row #12.
  router.post('/medicines/:id/restock', async (ctx) => {
    const patientId = ctx.auth.patient.id
    const row = await ctx.db.first('SELECT * FROM medicines WHERE id = ? AND patient_id = ?', [ctx.params.id, patientId])
    if (!row) throw notFound('Medicine not found.')

    const body = await readJsonBody(ctx.request)
    const v = new Validator(body)
    v.integer('amount', { required: true, min: 1, max: 1_000_000 })
    const input = v.ensureValid()

    const current = row.stock_remaining ?? 0
    const balanceAfter = current + input.amount
    const now = nowIso()
    await ctx.db.batch([
      { sql: 'UPDATE medicines SET stock_remaining = ?, refill = 0, updated_at = ? WHERE id = ?', params: [balanceAfter, now, row.id] },
      {
        sql: `INSERT INTO stock_events (id, patient_id, medicine_id, delta, balance_after, reason, dose_log_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [newId(), patientId, row.id, input.amount, balanceAfter, 'restock', null, now],
      },
    ])
    const updated = await ctx.db.first('SELECT * FROM medicines WHERE id = ?', [row.id])
    return ok({ stock: summarizeStock(normalizeMedicineRow(updated)) })
  })
}
