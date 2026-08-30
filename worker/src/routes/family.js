import { ok, readJsonBody, readJsonBodyOptional } from '../lib/http.js'
import { notFound } from '../lib/errors.js'
import { Validator } from '../lib/validate.js'
import { newId, nowIso, sha256Hex } from '../lib/ids.js'
import { FAMILY_ALERT_LEVELS, selectLatestUpdatedMember, selectPrimaryEmergencyContact, toPublicFamilyMember } from '../domain/family.js'
import { CAREGIVER_PERMISSIONS, DEFAULT_CAREGIVER_PERMISSIONS } from '../domain/caregiver.js'
import { formatLinkCode, randomLinkCode } from '../lib/codes.js'

const INVITE_TTL_MINUTES = 60 * 24 * 3 // caregiver invites live 3 days

// Maps validated camelCase input keys to their D1 columns.
const FIELD_COLUMNS = {
  name: 'name',
  relationship: 'relationship',
  phone: 'phone',
  whatsappNumber: 'whatsapp_number',
  email: 'email',
  fcmToken: 'fcm_token',
  alertLevel: 'alert_level',
  isPrimaryEmergency: 'is_primary_emergency',
  notifyPush: 'notify_push',
  notifyWhatsapp: 'notify_whatsapp',
  notifyEmail: 'notify_email',
  notifySms: 'notify_sms',
  age: 'age',
  bloodGroup: 'blood_group',
  allergies: 'allergies',
}

// Full field set (rows #4, #5, #19). `partial` (PATCH) leaves untouched fields
// out of the result so callers can build a sparse UPDATE.
function validateFamilyInput(body, { partial }) {
  const v = new Validator(body)
  v.string('name', { required: !partial, max: 80 })
  v.string('relationship', { max: 60, fallback: partial ? undefined : 'Family member' })
  v.phone('phone')
  v.phone('whatsappNumber')
  v.email('email')
  v.string('fcmToken', { max: 4096 })
  v.enum('alertLevel', FAMILY_ALERT_LEVELS, { fallback: partial ? undefined : 'Level 3' })
  v.boolean('isPrimaryEmergency', { fallback: partial ? undefined : false })
  v.boolean('notifyPush', { fallback: partial ? undefined : true })
  v.boolean('notifyWhatsapp', { fallback: partial ? undefined : false })
  v.boolean('notifyEmail', { fallback: partial ? undefined : false })
  v.boolean('notifySms', { fallback: partial ? undefined : false })
  v.string('age', { max: 12 })
  v.string('bloodGroup', { max: 12 })
  v.string('allergies', { max: 500 })
  return v.ensureValid()
}

const toDbValue = (value) => (typeof value === 'boolean' ? (value ? 1 : 0) : value ?? null)

export function registerFamilyRoutes(router) {
  // List all members, newest-updated first, surfacing the row #4 alert target.
  router.get('/family', async (ctx) => {
    const rows = await ctx.db.all(
      'SELECT * FROM family_members WHERE patient_id = ? ORDER BY updated_at DESC, created_at DESC',
      [ctx.auth.patient.id],
    )
    return ok({
      members: rows.map(toPublicFamilyMember),
      latestUpdatedId: rows.length ? rows[0].id : null,
    })
  })

  // Current primary emergency contact (row #19). Registered before /family/:id
  // so the literal path wins over the parameter.
  router.get('/family/primary', async (ctx) => {
    const rows = await ctx.db.all('SELECT * FROM family_members WHERE patient_id = ?', [ctx.auth.patient.id])
    const primary = selectPrimaryEmergencyContact(rows)
    return ok({ member: primary ? toPublicFamilyMember(primary) : null })
  })

  // Latest-updated member — who a non-emergency alert should reach (row #4).
  router.get('/family/alert-target', async (ctx) => {
    const rows = await ctx.db.all('SELECT * FROM family_members WHERE patient_id = ?', [ctx.auth.patient.id])
    const target = selectLatestUpdatedMember(rows)
    return ok({ member: target ? toPublicFamilyMember(target) : null })
  })

  router.post('/family', async (ctx) => {
    const body = await readJsonBody(ctx.request)
    const input = validateFamilyInput(body, { partial: false })
    const patientId = ctx.auth.patient.id
    const id = newId()
    const now = nowIso()

    const statements = []
    // Only one Level 1 member per patient — demote any current Level 1.
    if (input.alertLevel === 'Level 1') {
      statements.push({
        sql: "UPDATE family_members SET alert_level = 'Level 2', updated_at = ? WHERE patient_id = ? AND alert_level = 'Level 1'",
        params: [now, patientId],
      })
    }
    // Only one primary emergency contact.
    if (input.isPrimaryEmergency) {
      statements.push({
        sql: 'UPDATE family_members SET is_primary_emergency = 0 WHERE patient_id = ?',
        params: [patientId],
      })
    }
    statements.push({
      sql: `INSERT INTO family_members
              (id, patient_id, name, relationship, phone, whatsapp_number, email, fcm_token, alert_level,
               is_primary_emergency, notify_push, notify_whatsapp, notify_email, notify_sms,
               age, blood_group, allergies, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        id, patientId, input.name, input.relationship, toDbValue(input.phone), toDbValue(input.whatsappNumber),
        toDbValue(input.email), toDbValue(input.fcmToken), input.alertLevel, toDbValue(input.isPrimaryEmergency),
        toDbValue(input.notifyPush), toDbValue(input.notifyWhatsapp), toDbValue(input.notifyEmail), toDbValue(input.notifySms),
        toDbValue(input.age), toDbValue(input.bloodGroup), toDbValue(input.allergies), now, now,
      ],
    })
    await ctx.db.batch(statements)
    const row = await ctx.db.first('SELECT * FROM family_members WHERE id = ?', [id])
    return ok({ member: toPublicFamilyMember(row) }, { status: 201 })
  })

  router.get('/family/:id', async (ctx) => {
    const row = await ctx.db.first(
      'SELECT * FROM family_members WHERE id = ? AND patient_id = ?',
      [ctx.params.id, ctx.auth.patient.id],
    )
    if (!row) throw notFound('Family member not found.')
    return ok({ member: toPublicFamilyMember(row) })
  })

  // Updating bumps updated_at, which makes this member the latest alert target
  // (row #4) — an intentional side effect of "the most recently updated member".
  router.patch('/family/:id', async (ctx) => {
    const patientId = ctx.auth.patient.id
    const existing = await ctx.db.first(
      'SELECT id FROM family_members WHERE id = ? AND patient_id = ?',
      [ctx.params.id, patientId],
    )
    if (!existing) throw notFound('Family member not found.')

    const body = await readJsonBody(ctx.request)
    const input = validateFamilyInput(body, { partial: true })
    const now = nowIso()

    const statements = []
    if (input.alertLevel === 'Level 1') {
      statements.push({
        sql: "UPDATE family_members SET alert_level = 'Level 2', updated_at = ? WHERE patient_id = ? AND alert_level = 'Level 1' AND id <> ?",
        params: [now, patientId, existing.id],
      })
    }
    if (input.isPrimaryEmergency === true) {
      statements.push({
        sql: 'UPDATE family_members SET is_primary_emergency = 0 WHERE patient_id = ? AND id <> ?',
        params: [patientId, existing.id],
      })
    }

    const sets = []
    const params = []
    for (const [key, column] of Object.entries(FIELD_COLUMNS)) {
      if (key in input) {
        sets.push(`${column} = ?`)
        params.push(toDbValue(input[key]))
      }
    }
    sets.push('updated_at = ?')
    params.push(now, existing.id, patientId)
    statements.push({
      sql: `UPDATE family_members SET ${sets.join(', ')} WHERE id = ? AND patient_id = ?`,
      params,
    })

    await ctx.db.batch(statements)
    const row = await ctx.db.first('SELECT * FROM family_members WHERE id = ?', [existing.id])
    return ok({ member: toPublicFamilyMember(row) })
  })

  router.delete('/family/:id', async (ctx) => {
    const result = await ctx.db.run(
      'DELETE FROM family_members WHERE id = ? AND patient_id = ?',
      [ctx.params.id, ctx.auth.patient.id],
    )
    if (!result.meta || result.meta.changes === 0) throw notFound('Family member not found.')
    return ok({ deleted: true })
  })

  // Designate the primary emergency contact (row #19); unsets any previous one.
  router.post('/family/:id/primary', async (ctx) => {
    const patientId = ctx.auth.patient.id
    const existing = await ctx.db.first(
      'SELECT id FROM family_members WHERE id = ? AND patient_id = ?',
      [ctx.params.id, patientId],
    )
    if (!existing) throw notFound('Family member not found.')
    const now = nowIso()
    await ctx.db.batch([
      { sql: 'UPDATE family_members SET is_primary_emergency = 0 WHERE patient_id = ?', params: [patientId] },
      { sql: 'UPDATE family_members SET is_primary_emergency = 1, updated_at = ? WHERE id = ?', params: [now, existing.id] },
    ])
    return ok({ primaryEmergencyId: existing.id })
  })

  // Mint a single-use invite code so this family member can join the account with
  // their OWN login (features #3/#6). The invite plus the caregiver's acceptance
  // record the patient's consent to share data with them.
  router.post('/family/:id/invite', async (ctx) => {
    const patientId = ctx.auth.patient.id
    const member = await ctx.db.first('SELECT * FROM family_members WHERE id = ? AND patient_id = ?', [ctx.params.id, patientId])
    if (!member) throw notFound('Family member not found.')

    const body = await readJsonBodyOptional(ctx.request)
    const v = new Validator(body)
    v.stringArray('permissions', { allowed: CAREGIVER_PERMISSIONS })
    v.enum('alertLevel', FAMILY_ALERT_LEVELS)
    const input = v.ensureValid()

    const permissions = input.permissions ?? DEFAULT_CAREGIVER_PERMISSIONS
    const alertLevel = input.alertLevel ?? member.alert_level
    const code = randomLinkCode()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + INVITE_TTL_MINUTES * 60 * 1000).toISOString()
    const id = newId()

    await ctx.db.batch([
      // Only the newest pending invite for this member stays live.
      { sql: "DELETE FROM caregiver_links WHERE patient_id = ? AND family_member_id = ? AND status = 'pending'", params: [patientId, member.id] },
      {
        sql: `INSERT INTO caregiver_links
                (id, patient_id, caregiver_user_id, family_member_id, alert_level, permissions, status,
                 invite_code_hash, invited_by_user_id, label, expires_at, created_at)
              VALUES (?, ?, NULL, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
        params: [
          id, patientId, member.id, alertLevel, JSON.stringify(permissions),
          await sha256Hex(code), ctx.auth.user?.id ?? null, member.name, expiresAt, now.toISOString(),
        ],
      },
    ])

    // Shown once — only the hash is stored.
    return ok({ linkId: id, inviteCode: formatLinkCode(code), expiresAt, expiresInMinutes: INVITE_TTL_MINUTES }, { status: 201 })
  })
}
