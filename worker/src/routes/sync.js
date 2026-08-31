import { ok, readJsonBody } from '../lib/http.js'
import { nowIso } from '../lib/ids.js'
import { isDate, isE164, isTime } from '../lib/validate.js'
import { FAMILY_ALERT_LEVELS } from '../domain/family.js'
import { DOSE_PERIODS, DOSE_STATUSES } from '../domain/doses.js'

// Snapshot sync for the local-first app (Module G). The app owns the record IDs
// and pushes its current snapshot; the gateway upserts into D1 and deletes rows
// the snapshot no longer contains. Idempotent, so it can run on every change.
//
// Cross-tenant safety: every upsert is INSERT ... ON CONFLICT(id) DO UPDATE ...
// WHERE patient_id = excluded.patient_id, so an id owned by another patient is a
// silent no-op instead of an overwrite.

const boolInt = (value) => (value ? 1 : 0)
const e164OrNull = (value) => {
  const text = value == null ? '' : String(value).trim()
  return isE164(text) ? text : null
}
const clip = (value, max) => (value == null ? null : String(value).slice(0, max))

function sanitizeFamily(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id != null ? String(raw.id) : ''
  const name = raw.name != null ? String(raw.name).trim() : ''
  if (!id || !name) return null
  return {
    id,
    name: name.slice(0, 80),
    relationship: raw.relationship ? String(raw.relationship).slice(0, 60) : 'Family member',
    phone: e164OrNull(raw.phone),
    whatsappNumber: e164OrNull(raw.whatsappNumber),
    email: clip(raw.email, 254),
    alertLevel: FAMILY_ALERT_LEVELS.includes(raw.alertLevel) ? raw.alertLevel : 'Level 3',
    isPrimaryEmergency: boolInt(raw.isPrimaryEmergency),
    notifyPush: raw.notifyPush == null ? 1 : boolInt(raw.notifyPush),
    notifyWhatsapp: boolInt(raw.notifyWhatsapp),
    notifyEmail: boolInt(raw.notifyEmail),
    notifySms: boolInt(raw.notifySms),
    age: clip(raw.age, 12),
    bloodGroup: clip(raw.bloodGroup, 12),
    allergies: clip(raw.allergies, 500),
  }
}

function sanitizeMedicine(raw, familyIds) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id != null ? String(raw.id) : ''
  const name = raw.name != null ? String(raw.name).trim() : ''
  if (!id || !name) return null
  const memberId = raw.memberId != null ? String(raw.memberId) : null
  const periods = Array.isArray(raw.enabledPeriods)
    ? raw.enabledPeriods.map(String).filter((period) => DOSE_PERIODS.includes(period))
    : []
  const stock = Number(raw.stockRemaining)
  return {
    id,
    name: name.slice(0, 120),
    dosage: raw.dosage ? String(raw.dosage).slice(0, 120) : '',
    memberId: memberId && familyIds.has(memberId) ? memberId : null,
    morningTime: isTime(raw.morningTime) ? raw.morningTime : null,
    afternoonTime: isTime(raw.afternoonTime) ? raw.afternoonTime : null,
    nightTime: isTime(raw.nightTime) ? raw.nightTime : null,
    enabledPeriods: JSON.stringify(periods),
    important: boolInt(raw.important),
    refill: boolInt(raw.refill),
    stockRemaining: Number.isFinite(stock) && raw.stockRemaining != null ? Math.max(0, Math.trunc(stock)) : null,
    doseUnitsPerDose: Number.isFinite(Number(raw.doseUnitsPerDose)) ? Number(raw.doseUnitsPerDose) : 1,
    stockBufferDays: Number.isInteger(raw.stockBufferDays) ? raw.stockBufferDays : 7,
    stockUnitLabel: raw.stockUnitLabel ? String(raw.stockUnitLabel).slice(0, 24) : 'tablets',
  }
}

function sanitizeDose(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id != null ? String(raw.id) : ''
  const status = DOSE_STATUSES.includes(raw.status) ? raw.status : null
  const doseDate = isDate(raw.doseDate) ? raw.doseDate : null
  if (!id || !status || !doseDate) return null
  return {
    id,
    medicineId: raw.medicineId != null ? String(raw.medicineId) : null,
    memberId: raw.memberId != null ? String(raw.memberId) : null,
    medicineName: raw.medicineName ? String(raw.medicineName).slice(0, 120) : '',
    dosage: raw.dosage ? String(raw.dosage).slice(0, 120) : '',
    scheduledTime: isTime(raw.scheduledTime) ? raw.scheduledTime : null,
    dosePeriod: DOSE_PERIODS.includes(raw.dosePeriod) ? raw.dosePeriod : null,
    status,
    takenAt: raw.takenAt ? String(raw.takenAt) : (status === 'taken' && raw.recordedAt ? String(raw.recordedAt) : null),
    doseDate,
    stockAfter: Number.isInteger(raw.stockAfter) ? raw.stockAfter : null,
    recordedAt: raw.recordedAt ? String(raw.recordedAt) : nowIso(),
  }
}

function sanitizePrescription(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id != null ? String(raw.id) : ''
  if (!id) return null
  return {
    id,
    doctor: clip(raw.doctor, 120) ?? '',
    clinic: clip(raw.clinic, 120) ?? '',
    notes: clip(raw.notes, 2000) ?? '',
  }
}

function sanitizeAppointment(raw) {
  if (!raw || typeof raw !== 'object') return null
  const id = raw.id != null ? String(raw.id) : ''
  const date = isDate(raw.date) ? raw.date : null
  if (!id || !date) return null
  return {
    id,
    doctor: clip(raw.doctor, 120) ?? '',
    clinic: raw.clinic ? String(raw.clinic).slice(0, 120) : 'Clinic',
    date,
    time: isTime(raw.time) ? raw.time : '09:00',
  }
}

function deleteMissing(table, patientId, ids) {
  if (!ids.length) return { sql: `DELETE FROM ${table} WHERE patient_id = ?`, params: [patientId] }
  const placeholders = ids.map(() => '?').join(', ')
  return { sql: `DELETE FROM ${table} WHERE patient_id = ? AND id NOT IN (${placeholders})`, params: [patientId, ...ids] }
}

function upsertFamily(patientId, m, now) {
  return {
    sql: `INSERT INTO family_members
            (id, patient_id, name, relationship, phone, whatsapp_number, email, fcm_token, alert_level,
             is_primary_emergency, notify_push, notify_whatsapp, notify_email, notify_sms,
             age, blood_group, allergies, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name, relationship = excluded.relationship, phone = excluded.phone,
            whatsapp_number = excluded.whatsapp_number, email = excluded.email, alert_level = excluded.alert_level,
            is_primary_emergency = excluded.is_primary_emergency, notify_push = excluded.notify_push,
            notify_whatsapp = excluded.notify_whatsapp, notify_email = excluded.notify_email,
            notify_sms = excluded.notify_sms, age = excluded.age, blood_group = excluded.blood_group,
            allergies = excluded.allergies, updated_at = excluded.updated_at
          WHERE family_members.patient_id = excluded.patient_id`,
    params: [
      m.id, patientId, m.name, m.relationship, m.phone, m.whatsappNumber, m.email, m.alertLevel,
      m.isPrimaryEmergency, m.notifyPush, m.notifyWhatsapp, m.notifyEmail, m.notifySms,
      m.age, m.bloodGroup, m.allergies, now, now,
    ],
  }
}

function upsertMedicine(patientId, m, now) {
  return {
    sql: `INSERT INTO medicines
            (id, patient_id, member_id, name, dosage, morning_time, afternoon_time, night_time,
             enabled_periods, important, refill, stock_remaining, dose_units_per_dose,
             stock_buffer_days, low_stock_threshold, stock_unit_label, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            member_id = excluded.member_id, name = excluded.name, dosage = excluded.dosage,
            morning_time = excluded.morning_time, afternoon_time = excluded.afternoon_time,
            night_time = excluded.night_time, enabled_periods = excluded.enabled_periods,
            important = excluded.important, refill = excluded.refill, stock_remaining = excluded.stock_remaining,
            dose_units_per_dose = excluded.dose_units_per_dose, stock_buffer_days = excluded.stock_buffer_days,
            stock_unit_label = excluded.stock_unit_label, updated_at = excluded.updated_at
          WHERE medicines.patient_id = excluded.patient_id`,
    params: [
      m.id, patientId, m.memberId, m.name, m.dosage, m.morningTime, m.afternoonTime, m.nightTime,
      m.enabledPeriods, m.important, m.refill, m.stockRemaining, m.doseUnitsPerDose,
      m.stockBufferDays, m.stockUnitLabel, now, now,
    ],
  }
}

// file_key is managed by the R2 upload routes, so sync never touches it.
function upsertPrescription(patientId, p, now) {
  return {
    sql: `INSERT INTO prescriptions (id, patient_id, doctor, clinic, notes, file_key, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            doctor = excluded.doctor, clinic = excluded.clinic, notes = excluded.notes, updated_at = excluded.updated_at
          WHERE prescriptions.patient_id = excluded.patient_id`,
    params: [p.id, patientId, p.doctor, p.clinic, p.notes, now, now],
  }
}

function upsertAppointment(patientId, a, now) {
  return {
    sql: `INSERT INTO appointments (id, patient_id, doctor, clinic, date, time, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            doctor = excluded.doctor, clinic = excluded.clinic, date = excluded.date, time = excluded.time, updated_at = excluded.updated_at
          WHERE appointments.patient_id = excluded.patient_id`,
    params: [a.id, patientId, a.doctor, a.clinic, a.date, a.time, now, now],
  }
}

function insertDose(patientId, l) {
  return {
    sql: `INSERT OR IGNORE INTO dose_logs
            (id, patient_id, medicine_id, member_id, medicine_name, dosage, scheduled_time, dose_period,
             status, taken_at, dose_date, stock_after, recorded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [
      l.id, patientId, l.medicineId, l.memberId, l.medicineName, l.dosage, l.scheduledTime, l.dosePeriod,
      l.status, l.takenAt, l.doseDate, l.stockAfter, l.recordedAt,
    ],
  }
}

async function upsertSettings(db, patientId, raw, now) {
  const clauses = []
  const params = []
  const put = (column, value) => { clauses.push(`${column} = ?`); params.push(value) }
  if (raw.reminderLeadMinutes != null && Number.isInteger(raw.reminderLeadMinutes)) {
    put('reminder_lead_minutes', Math.max(0, Math.min(240, raw.reminderLeadMinutes)))
  }
  if (raw.pushEnabled != null) put('push_enabled', boolInt(raw.pushEnabled))
  if (raw.whatsappEnabled != null) put('whatsapp_enabled', boolInt(raw.whatsappEnabled))
  if (raw.emailEnabled != null) put('email_enabled', boolInt(raw.emailEnabled))
  // Scheduled-job + escalation config (feature #7 / task #22).
  if (raw.timezone != null) put('timezone', String(raw.timezone).slice(0, 64))
  if (isTime(raw.dailyCheckTime)) put('daily_check_time', raw.dailyCheckTime)
  if (Number.isInteger(raw.restockDay)) put('restock_day', Math.max(1, Math.min(28, raw.restockDay)))
  if (Number.isInteger(raw.doseGraceMinutes)) put('dose_grace_minutes', Math.max(1, Math.min(240, raw.doseGraceMinutes)))
  if (Number.isInteger(raw.l2EscalationMinutes)) put('l2_escalation_minutes', Math.max(2, Math.min(480, raw.l2EscalationMinutes)))
  if (raw.escalationEnabled != null) put('escalation_enabled', boolInt(raw.escalationEnabled))
  // Consent acknowledgement (task #29).
  if (raw.consentVersion != null) put('consent_version', String(raw.consentVersion).slice(0, 40))
  if (raw.consentAcceptedAt != null) put('consent_accepted_at', String(raw.consentAcceptedAt).slice(0, 40))
  if (!clauses.length) return
  clauses.push('updated_at = ?')
  params.push(now)
  // Ensure a row exists, then apply the changes.
  await db.run('INSERT OR IGNORE INTO patient_settings (patient_id, updated_at) VALUES (?, ?)', [patientId, now])
  await db.run(`UPDATE patient_settings SET ${clauses.join(', ')} WHERE patient_id = ?`, [...params, patientId])
}

function parsePeriods(raw) {
  try {
    const value = JSON.parse(raw || '[]')
    return Array.isArray(value) ? value.filter((period) => DOSE_PERIODS.includes(period)) : []
  } catch {
    return []
  }
}

export function registerSyncRoutes(router) {
  // The snapshot the app pulls before its first push, in the same shape PUT
  // accepts, so a second device can adopt an existing account's records.
  router.get('/sync', async (ctx) => {
    const patientId = ctx.auth.patient.id
    const family = await ctx.db.all('SELECT * FROM family_members WHERE patient_id = ?', [patientId])
    const medicines = await ctx.db.all('SELECT * FROM medicines WHERE patient_id = ?', [patientId])
    const prescriptions = await ctx.db.all('SELECT * FROM prescriptions WHERE patient_id = ?', [patientId])
    const appointments = await ctx.db.all('SELECT * FROM appointments WHERE patient_id = ?', [patientId])
    const doseLogs = await ctx.db.all('SELECT * FROM dose_logs WHERE patient_id = ?', [patientId])
    const settings = await ctx.db.first('SELECT * FROM patient_settings WHERE patient_id = ?', [patientId])

    return ok({
      familyMembers: family.map((row) => ({
        id: row.id,
        name: row.name,
        relationship: row.relationship,
        phone: row.phone,
        whatsappNumber: row.whatsapp_number,
        email: row.email,
        alertLevel: row.alert_level,
        isPrimaryEmergency: Boolean(row.is_primary_emergency),
        notifyPush: Boolean(row.notify_push),
        notifyWhatsapp: Boolean(row.notify_whatsapp),
        notifyEmail: Boolean(row.notify_email),
        notifySms: Boolean(row.notify_sms),
        age: row.age,
        bloodGroup: row.blood_group,
        allergies: row.allergies,
      })),
      medicines: medicines.map((row) => ({
        id: row.id,
        name: row.name,
        dosage: row.dosage,
        memberId: row.member_id,
        morningTime: row.morning_time,
        afternoonTime: row.afternoon_time,
        nightTime: row.night_time,
        enabledPeriods: parsePeriods(row.enabled_periods),
        important: Boolean(row.important),
        refill: Boolean(row.refill),
        stockRemaining: row.stock_remaining,
        doseUnitsPerDose: row.dose_units_per_dose,
        stockBufferDays: row.stock_buffer_days,
        stockUnitLabel: row.stock_unit_label,
      })),
      prescriptions: prescriptions.map((row) => ({
        id: row.id,
        doctor: row.doctor,
        clinic: row.clinic,
        notes: row.notes,
        hasFile: Boolean(row.file_key),
      })),
      appointments: appointments.map((row) => ({
        id: row.id,
        doctor: row.doctor,
        clinic: row.clinic,
        date: row.date,
        time: row.time,
      })),
      doseLogs: doseLogs.map((row) => ({
        id: row.id,
        medicineId: row.medicine_id,
        memberId: row.member_id,
        medicineName: row.medicine_name,
        dosage: row.dosage,
        scheduledTime: row.scheduled_time,
        dosePeriod: row.dose_period,
        status: row.status,
        takenAt: row.taken_at,
        doseDate: row.dose_date,
        stockAfter: row.stock_after,
        recordedAt: row.recorded_at,
      })),
      settings: settings
        ? {
            reminderLeadMinutes: settings.reminder_lead_minutes,
            pushEnabled: Boolean(settings.push_enabled),
            whatsappEnabled: Boolean(settings.whatsapp_enabled),
            emailEnabled: Boolean(settings.email_enabled),
            timezone: settings.timezone,
            dailyCheckTime: settings.daily_check_time,
            restockDay: settings.restock_day,
            doseGraceMinutes: settings.dose_grace_minutes,
            l2EscalationMinutes: settings.l2_escalation_minutes,
            escalationEnabled: Boolean(settings.escalation_enabled),
            consentVersion: settings.consent_version ?? null,
            consentAcceptedAt: settings.consent_accepted_at ?? null,
          }
        : null,
    })
  })

  router.put('/sync', async (ctx) => {
    const body = await readJsonBody(ctx.request)
    const patientId = ctx.auth.patient.id
    const now = nowIso()
    // Pruning deletes every row the snapshot omits — with an empty snapshot that
    // is the whole account. A client may only ask for it once it has pulled and
    // merged, so a fresh device signing in can never wipe the existing records.
    const prune = body.prune === true
    const summary = { family: 0, medicines: 0, prescriptions: 0, appointments: 0, doses: 0, settings: false, pruned: prune }

    // Family first so medicine member_id references resolve.
    let familyIds
    if (Array.isArray(body.familyMembers)) {
      const members = body.familyMembers.map(sanitizeFamily).filter(Boolean)
      const pushedIds = new Set(members.map((member) => member.id))
      const statements = members.map((member) => upsertFamily(patientId, member, now))
      if (prune) statements.push(deleteMissing('family_members', patientId, [...pushedIds]))
      if (statements.length) await ctx.db.batch(statements)
      // Without pruning the rows this snapshot omits survive, so medicine
      // member_id references must be checked against those too — otherwise a
      // partial push would null out links to members it simply did not carry.
      familyIds = pushedIds
      if (!prune) {
        const rows = await ctx.db.all('SELECT id FROM family_members WHERE patient_id = ?', [patientId])
        familyIds = new Set([...pushedIds, ...rows.map((row) => row.id)])
      }
      summary.family = members.length
    } else {
      const rows = await ctx.db.all('SELECT id FROM family_members WHERE patient_id = ?', [patientId])
      familyIds = new Set(rows.map((row) => row.id))
    }

    if (Array.isArray(body.medicines)) {
      const medicines = body.medicines.map((medicine) => sanitizeMedicine(medicine, familyIds)).filter(Boolean)
      const statements = medicines.map((medicine) => upsertMedicine(patientId, medicine, now))
      if (prune) statements.push(deleteMissing('medicines', patientId, medicines.map((medicine) => medicine.id)))
      if (statements.length) await ctx.db.batch(statements)
      summary.medicines = medicines.length
    }

    if (Array.isArray(body.prescriptions)) {
      const items = body.prescriptions.map(sanitizePrescription).filter(Boolean)
      const statements = items.map((item) => upsertPrescription(patientId, item, now))
      if (prune) statements.push(deleteMissing('prescriptions', patientId, items.map((item) => item.id)))
      if (statements.length) await ctx.db.batch(statements)
      summary.prescriptions = items.length
    }

    if (Array.isArray(body.appointments)) {
      const items = body.appointments.map(sanitizeAppointment).filter(Boolean)
      const statements = items.map((item) => upsertAppointment(patientId, item, now))
      if (prune) statements.push(deleteMissing('appointments', patientId, items.map((item) => item.id)))
      if (statements.length) await ctx.db.batch(statements)
      summary.appointments = items.length
    }

    if (Array.isArray(body.doseLogs)) {
      const logs = body.doseLogs.map(sanitizeDose).filter(Boolean)
      if (logs.length) await ctx.db.batch(logs.map((log) => insertDose(patientId, log)))
      summary.doses = logs.length
    }

    if (body.settings && typeof body.settings === 'object') {
      await upsertSettings(ctx.db, patientId, body.settings, now)
      summary.settings = true
    }

    return ok({ synced: summary })
  })
}

// Exported for unit tests.
export const __test = { sanitizeFamily, sanitizeMedicine, sanitizeDose, sanitizePrescription, sanitizeAppointment, deleteMissing }
