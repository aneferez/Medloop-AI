import { ok, readJsonBody } from '../lib/http.js'
import { badRequest, forbidden, notFound, unauthorized } from '../lib/errors.js'
import { Validator } from '../lib/validate.js'
import { nowIso, sha256Hex } from '../lib/ids.js'
import { normalizeLinkCode } from '../lib/codes.js'
import {
  CAREGIVER_PERMISSIONS,
  hasPermission,
  normalizePermissions,
  parsePermissions,
  toPublicCaregiverLink,
} from '../domain/caregiver.js'
import { FAMILY_ALERT_LEVELS } from '../domain/family.js'
import { normalizeMedicineRow } from '../domain/medicine.js'
import { localDateParts } from '../domain/schedule.js'
import { authorizePatientAccess } from '../services/caregiverAccess.js'
import { patientAdherence, patientDoseSummary, patientStockItems, summarizeStockItems } from '../services/stockInsight.js'

const patientSummary = (row) => (row ? { id: row.id, displayName: row.display_name } : null)

async function ownsPatient(ctx, patientId, userId) {
  const patient = await ctx.db.first('SELECT owner_user_id FROM patients WHERE id = ?', [patientId])
  return Boolean(patient && patient.owner_user_id === userId)
}

export function registerCaregiverRoutes(router) {
  // Caregiver accepts an invite with their OWN account, activating the link and
  // bridging the contact row to their user so escalations reach their devices.
  router.post('/caregiver/accept', async (ctx) => {
    const user = ctx.auth.user
    if (!user) throw forbidden('Create an account before accepting a caregiver invite.')

    const body = await readJsonBody(ctx.request)
    const code = normalizeLinkCode(body.code)
    if (!code) throw badRequest('Enter the invite code shared with you.')

    const now = nowIso()
    const link = await ctx.db.first('SELECT * FROM caregiver_links WHERE invite_code_hash = ?', [await sha256Hex(code)])
    // One error for every failure mode: unknown, used, expired, or revoked.
    if (!link || link.status !== 'pending' || (link.expires_at && link.expires_at <= now)) {
      throw unauthorized('That invite is not valid. Ask for a fresh one.')
    }
    if (await ownsPatient(ctx, link.patient_id, user.id)) {
      throw badRequest('You cannot be a caregiver for your own account.')
    }

    await ctx.db.batch([
      {
        sql: "UPDATE caregiver_links SET caregiver_user_id = ?, status = 'active', invite_code_hash = NULL, accepted_at = ? WHERE id = ?",
        params: [user.id, now, link.id],
      },
      ...(link.family_member_id
        ? [{ sql: 'UPDATE family_members SET user_id = ?, updated_at = ? WHERE id = ?', params: [user.id, now, link.family_member_id] }]
        : []),
    ])

    const updated = await ctx.db.first('SELECT * FROM caregiver_links WHERE id = ?', [link.id])
    const patient = await ctx.db.first('SELECT id, display_name FROM patients WHERE id = ?', [link.patient_id])
    return ok({ link: toPublicCaregiverLink(updated, { patient: patientSummary(patient) }) }, { status: 201 })
  })

  // Patients this caregiver has been granted access to.
  router.get('/caregiver/patients', async (ctx) => {
    const user = ctx.auth.user
    if (!user) return ok({ patients: [] })
    const links = await ctx.db.all(
      "SELECT * FROM caregiver_links WHERE caregiver_user_id = ? AND status = 'active' ORDER BY accepted_at DESC",
      [user.id],
    )
    const patients = []
    for (const link of links) {
      const patient = await ctx.db.first('SELECT id, display_name FROM patients WHERE id = ?', [link.patient_id])
      if (patient) patients.push(toPublicCaregiverLink(link, { patient: patientSummary(patient) }))
    }
    return ok({ patients })
  })

  // Family-aware stock rollup (feature #4): low / predicted-low medicines across
  // every patient this caregiver can see, soonest run-out first.
  router.get('/caregiver/inventory', async (ctx) => {
    const user = ctx.auth.user
    if (!user) return ok({ patients: [], alerts: [] })
    const links = await ctx.db.all(
      "SELECT * FROM caregiver_links WHERE caregiver_user_id = ? AND status = 'active'",
      [user.id],
    )
    const patients = []
    const alerts = []
    for (const link of links) {
      if (!hasPermission(link, 'view_inventory')) continue
      const patient = await ctx.db.first('SELECT id, display_name FROM patients WHERE id = ?', [link.patient_id])
      if (!patient) continue
      const items = await patientStockItems(ctx.db, patient.id)
      patients.push({ patient: { id: patient.id, displayName: patient.display_name }, ...summarizeStockItems(items) })
      for (const item of items) {
        if (item.low || item.prediction.predictedLow) {
          alerts.push({
            patientId: patient.id,
            patientName: patient.display_name,
            medicineId: item.id,
            name: item.name,
            stockRemaining: item.stockRemaining,
            predictedDaysRemaining: item.prediction.predictedDaysRemaining,
            predictedRunOutDate: item.prediction.predictedRunOutDate,
          })
        }
      }
    }
    alerts.sort((a, b) => (a.predictedDaysRemaining ?? Number.MAX_SAFE_INTEGER) - (b.predictedDaysRemaining ?? Number.MAX_SAFE_INTEGER))
    return ok({ patients, alerts })
  })

  // Caregiver dashboard — one card per patient the caregiver can see, each with
  // the patient's name, a compact inventory summary, today's medication checks,
  // and the next upcoming dose. Everything is permission-gated per patient, so a
  // card only carries the sections the patient granted access to.
  router.get('/caregiver/dashboard', async (ctx) => {
    const user = ctx.auth.user
    if (!user) return ok({ patients: [] })
    const links = await ctx.db.all(
      "SELECT * FROM caregiver_links WHERE caregiver_user_id = ? AND status = 'active' ORDER BY accepted_at DESC",
      [user.id],
    )

    const patients = []
    for (const link of links) {
      const patient = await ctx.db.first('SELECT id, display_name FROM patients WHERE id = ?', [link.patient_id])
      if (!patient) continue

      const card = {
        patientId: patient.id,
        name: patient.display_name || '',
        alertLevel: link.alert_level,
        permissions: parsePermissions(link.permissions),
      }
      if (hasPermission(link, 'view_inventory')) {
        const items = await patientStockItems(ctx.db, patient.id)
        const summary = summarizeStockItems(items)
        card.inventory = {
          medicineCount: items.length,
          lowStockCount: summary.lowStockCount,
          predictedLowCount: summary.predictedLowCount,
          predictedLowIds: summary.predictedLowIds,
        }
      }
      if (hasPermission(link, 'view_doses')) {
        card.today = await patientDoseSummary(ctx.db, patient.id)
      }
      patients.push(card)
    }
    return ok({ patients })
  })

  // Patient-side: list caregivers with access (pending or active).
  router.get('/caregivers', async (ctx) => {
    const rows = await ctx.db.all(
      "SELECT * FROM caregiver_links WHERE patient_id = ? AND status != 'revoked' ORDER BY created_at DESC",
      [ctx.auth.patient.id],
    )
    return ok({ caregivers: rows.map((row) => toPublicCaregiverLink(row)) })
  })

  // Patient-side: adjust a caregiver's permissions / alert level.
  router.patch('/caregivers/:linkId', async (ctx) => {
    const link = await ctx.db.first('SELECT * FROM caregiver_links WHERE id = ? AND patient_id = ?', [ctx.params.linkId, ctx.auth.patient.id])
    if (!link) throw notFound('Caregiver link not found.')

    const body = await readJsonBody(ctx.request)
    const v = new Validator(body)
    v.stringArray('permissions', { allowed: CAREGIVER_PERMISSIONS })
    v.enum('alertLevel', FAMILY_ALERT_LEVELS)
    const input = v.ensureValid()

    const sets = []
    const params = []
    if (input.permissions) {
      sets.push('permissions = ?')
      params.push(JSON.stringify(normalizePermissions(input.permissions) || []))
    }
    if (input.alertLevel) {
      sets.push('alert_level = ?')
      params.push(input.alertLevel)
    }
    if (!sets.length) throw badRequest('Provide permissions or alertLevel to update.')
    params.push(ctx.params.linkId, ctx.auth.patient.id)
    await ctx.db.run(`UPDATE caregiver_links SET ${sets.join(', ')} WHERE id = ? AND patient_id = ?`, params)

    const updated = await ctx.db.first('SELECT * FROM caregiver_links WHERE id = ?', [ctx.params.linkId])
    return ok({ link: toPublicCaregiverLink(updated) })
  })

  // Patient-side: revoke access immediately and unbridge the contact row.
  router.post('/caregivers/:linkId/revoke', async (ctx) => {
    const link = await ctx.db.first('SELECT * FROM caregiver_links WHERE id = ? AND patient_id = ?', [ctx.params.linkId, ctx.auth.patient.id])
    if (!link) throw notFound('Caregiver link not found.')

    const now = nowIso()
    await ctx.db.batch([
      { sql: "UPDATE caregiver_links SET status = 'revoked', revoked_at = ? WHERE id = ?", params: [now, link.id] },
      ...(link.family_member_id && link.caregiver_user_id
        ? [{ sql: 'UPDATE family_members SET user_id = NULL, updated_at = ? WHERE id = ? AND user_id = ?', params: [now, link.family_member_id, link.caregiver_user_id] }]
        : []),
    ])
    return ok({ revoked: true })
  })

  // Caregiver view: the patient's stock overview with predictions (feature #4/#6).
  router.get('/patients/:patientId/inventory', async (ctx) => {
    await authorizePatientAccess(ctx, ctx.params.patientId, 'view_inventory')
    const items = await patientStockItems(ctx.db, ctx.params.patientId)
    return ok(summarizeStockItems(items))
  })

  // Caregiver view: the patient's adherence report (#12), permission-gated.
  router.get('/patients/:patientId/adherence', async (ctx) => {
    await authorizePatientAccess(ctx, ctx.params.patientId, 'view_adherence')
    const range = Math.min(365, Math.max(1, Number(ctx.query.range) || 30))
    return ok(await patientAdherence(ctx.db, ctx.params.patientId, { rangeDays: range }))
  })

  // Caregiver view: today's dose status — taken / not taken (feature #6).
  router.get('/patients/:patientId/doses', async (ctx) => {
    await authorizePatientAccess(ctx, ctx.params.patientId, 'view_doses')
    const patientId = ctx.params.patientId

    const settings = await ctx.db.first('SELECT timezone FROM patient_settings WHERE patient_id = ?', [patientId])
    const { date } = localDateParts(new Date(), settings?.timezone || 'Asia/Kolkata')
    const doseDate = ctx.query.date || date

    const rows = await ctx.db.all('SELECT * FROM medicines WHERE patient_id = ?', [patientId])
    const medicines = rows.map(normalizeMedicineRow).filter((medicine) => medicine.enabledPeriods.length > 0)
    const logs = await ctx.db.all(
      'SELECT medicine_id, dose_period, status, taken_at FROM dose_logs WHERE patient_id = ? AND dose_date = ?',
      [patientId, doseDate],
    )
    const statusByKey = new Map()
    for (const log of logs) statusByKey.set(`${log.medicine_id}:${log.dose_period}`, log)

    const doses = []
    for (const medicine of medicines) {
      for (const period of medicine.enabledPeriods) {
        const log = statusByKey.get(`${medicine.id}:${period}`)
        doses.push({
          medicineId: medicine.id,
          name: medicine.name,
          period,
          scheduledTime: medicine.times?.[period] ?? null,
          status: log ? log.status : 'pending',
          takenAt: log?.taken_at ?? null,
        })
      }
    }
    return ok({ date: doseDate, doses })
  })
}
