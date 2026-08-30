import { createDb } from '../db/d1.js'
import { newId, nowIso } from '../lib/ids.js'
import { normalizeMedicineRow } from '../domain/medicine.js'
import {
  buildDailyCheckAlert,
  buildRestockAlert,
  collectOutstandingDoses,
  collectRestockNeeds,
  localDateParts,
} from '../domain/schedule.js'
import {
  collectDoseOccurrences,
  escalationWindows,
  missedDosePush,
  nextEscalation,
} from '../domain/escalation.js'
import { createAndDispatchAlert } from './alertService.js'

// Builds a ctx-like object the alert service accepts (no HTTP request involved).
const jobContext = (env, db, patient) => ({ env, db, auth: { patient } })

async function patientSettings(db, patientId) {
  return (await db.first('SELECT * FROM patient_settings WHERE patient_id = ?', [patientId])) || {}
}

// Row #13: check whether today's medicines were taken; alert on any that weren't.
// Idempotent per local day via alerts.ref_id = the local date.
export async function runDailyMedicineCheck(ctx, { now = new Date() } = {}) {
  const patientId = ctx.auth.patient.id
  const settings = await patientSettings(ctx.db, patientId)
  const { date } = localDateParts(now, settings.timezone || 'Asia/Kolkata')

  const already = await ctx.db.first(
    "SELECT id FROM alerts WHERE patient_id = ? AND type = 'medicine' AND source = 'cron' AND ref_id = ?",
    [patientId, date],
  )
  if (already) return { skipped: 'already_ran', date }

  const rows = await ctx.db.all('SELECT * FROM medicines WHERE patient_id = ?', [patientId])
  const medicines = rows.map(normalizeMedicineRow).filter((medicine) => medicine.enabledPeriods.length > 0)
  if (!medicines.length) return { checked: 0, outstanding: 0 }

  const logs = await ctx.db.all(
    'SELECT medicine_id, dose_period, status FROM dose_logs WHERE patient_id = ? AND dose_date = ? ORDER BY recorded_at ASC',
    [patientId, date],
  )
  const statusByKey = new Map()
  for (const log of logs) statusByKey.set(`${log.medicine_id}:${log.dose_period}`, log.status)
  const takenSet = new Set([...statusByKey.entries()].filter(([, status]) => status === 'taken').map(([key]) => key))

  const outstanding = collectOutstandingDoses(medicines, takenSet)
  if (!outstanding.length) return { checked: medicines.length, outstanding: 0 }

  const spec = buildDailyCheckAlert(outstanding, { date })
  const { alert } = await createAndDispatchAlert(ctx, {
    type: 'medicine',
    title: spec.title,
    detail: spec.detail,
    level: spec.level,
    source: 'cron',
    refId: date,
  })
  return { checked: medicines.length, outstanding: outstanding.length, alertId: alert.id }
}

// Row #12: check stock on the 20th; alert about medicines needing a refill.
// Idempotent per local month via alerts.ref_id = 'YYYY-MM'.
export async function runRestockCheck(ctx, { now = new Date() } = {}) {
  const patientId = ctx.auth.patient.id
  const settings = await patientSettings(ctx.db, patientId)
  const { date } = localDateParts(now, settings.timezone || 'Asia/Kolkata')
  const month = date.slice(0, 7)

  const already = await ctx.db.first(
    "SELECT id FROM alerts WHERE patient_id = ? AND type = 'restock' AND source = 'cron' AND ref_id = ?",
    [patientId, month],
  )
  if (already) return { skipped: 'already_ran', month }

  const rows = await ctx.db.all('SELECT * FROM medicines WHERE patient_id = ?', [patientId])
  const medicines = rows.map(normalizeMedicineRow)
  const needs = collectRestockNeeds(medicines)
  if (!needs.length) return { needs: 0 }

  // Flag the low medicines so the app reflects refill state.
  await ctx.db.run(
    `UPDATE medicines SET refill = 1, updated_at = ? WHERE id IN (${needs.map(() => '?').join(', ')})`,
    [nowIso(), ...needs.map((need) => need.id)],
  )

  const spec = buildRestockAlert(needs)
  const { alert } = await createAndDispatchAlert(ctx, {
    type: 'restock',
    title: spec.title,
    detail: spec.detail,
    level: spec.level,
    source: 'cron',
    refId: month,
  })
  return { needs: needs.length, alertId: alert.id }
}

// Row #17 / feature #7: escalate doses that passed their scheduled time without a
// "taken" log. Staggered — patient-selected Level 1 first (grace window), then
// Level 2 if still not taken. Idempotent per medicine+period+day via
// dose_escalations.stage, so re-running the sweep never double-notifies (#13).
export async function runEscalationCheck(ctx, { now = new Date() } = {}) {
  const patientId = ctx.auth.patient.id
  const settings = await patientSettings(ctx.db, patientId)
  if (settings.escalation_enabled === 0) return { skipped: 'escalation_disabled', notified: 0 }

  const { date, hour, minute } = localDateParts(now, settings.timezone || 'Asia/Kolkata')
  const minutesNow = hour * 60 + minute

  const rows = await ctx.db.all('SELECT * FROM medicines WHERE patient_id = ?', [patientId])
  const medicines = rows.map(normalizeMedicineRow).filter((medicine) => medicine.enabledPeriods.length > 0)
  const occurrences = collectDoseOccurrences(medicines)
  if (!occurrences.length) return { checked: 0, notified: 0 }

  const logs = await ctx.db.all(
    'SELECT medicine_id, dose_period, status FROM dose_logs WHERE patient_id = ? AND dose_date = ?',
    [patientId, date],
  )
  const statusByKey = new Map()
  for (const log of logs) statusByKey.set(`${log.medicine_id}:${log.dose_period}`, log.status)

  const escRows = await ctx.db.all(
    'SELECT * FROM dose_escalations WHERE patient_id = ? AND dose_date = ?',
    [patientId, date],
  )
  const escByKey = new Map()
  for (const esc of escRows) escByKey.set(`${esc.medicine_id}:${esc.dose_period}`, esc)

  const medicineById = new Map(medicines.map((medicine) => [medicine.id, medicine]))
  const nowStr = nowIso()
  let notified = 0

  for (const occ of occurrences) {
    const minutesSince = minutesNow - occ.scheduledMinute
    if (minutesSince < 0) continue // not due yet today

    const key = `${occ.medicineId}:${occ.period}`
    const status = statusByKey.get(key)
    const existing = escByKey.get(key)
    const currentStage = existing ? existing.stage : 'pending'
    const windows = escalationWindows(settings, medicineById.get(occ.medicineId) || {})
    const { newStage, fire } = nextEscalation({
      currentStage,
      minutesSince,
      windows,
      taken: status === 'taken',
      skipped: status === 'skipped',
    })

    if (newStage === currentStage && fire.length === 0) continue

    const resolvedAt = newStage === 'resolved' || newStage === 'skipped' ? nowStr : null
    if (existing) {
      await ctx.db.run(
        'UPDATE dose_escalations SET stage = ?, last_stage_at = ?, resolved_at = ? WHERE id = ?',
        [newStage, nowStr, resolvedAt, existing.id],
      )
    } else {
      await ctx.db.run(
        `INSERT INTO dose_escalations (id, patient_id, medicine_id, dose_period, dose_date, scheduled_at, stage, last_stage_at, resolved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId(), patientId, occ.medicineId, occ.period, date, `${date}T${occ.time}`, newStage, nowStr, resolvedAt],
      )
    }

    for (const level of fire) {
      const suffix = occ.important ? ' (important)' : ''
      await createAndDispatchAlert(ctx, {
        type: 'medicine',
        title: level === 'Level 2' ? 'Missed dose — escalated to Level 2' : 'Missed dose reminder',
        // Specifics stay in the in-app alert; the push (below) carries no PII.
        detail: `The ${occ.period} dose of ${occ.name}${suffix} scheduled at ${occ.time} has not been marked as taken.`,
        level,
        source: 'cron',
        refId: `${date}:${occ.medicineId}:${occ.period}:${level === 'Level 2' ? 'l2' : 'l1'}`,
        audience: 'at-level',
        pushMessage: missedDosePush(level),
      })
      notified += 1
    }
  }

  return { checked: occurrences.length, notified }
}

// Fan a job out across all patients, logging the run for observability.
export async function runScheduledJob(env, job, { now = new Date() } = {}) {
  const db = createDb(env.DB)
  const runId = newId()
  await db.run('INSERT INTO cron_runs (id, job, started_at, status) VALUES (?, ?, ?, ?)', [runId, job, nowIso(), 'running'])

  let processed = 0
  let alerted = 0
  try {
    const patients = await db.all('SELECT * FROM patients')
    for (const patient of patients) {
      const ctx = jobContext(env, db, patient)
      let result
      if (job === 'monthly_restock') result = await runRestockCheck(ctx, { now })
      else if (job === 'escalation_sweep') result = await runEscalationCheck(ctx, { now })
      else result = await runDailyMedicineCheck(ctx, { now })
      processed += 1
      if (result.alertId || result.notified) alerted += 1
    }
    await db.run(
      'UPDATE cron_runs SET finished_at = ?, status = ?, detail = ? WHERE id = ?',
      [nowIso(), 'ok', JSON.stringify({ processed, alerted }), runId],
    )
    return { job, processed, alerted }
  } catch (error) {
    await db.run(
      'UPDATE cron_runs SET finished_at = ?, status = ?, detail = ? WHERE id = ?',
      [nowIso(), 'error', String(error.message || error), runId],
    )
    throw error
  }
}
