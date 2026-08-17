import { ok, readJsonBody } from '../lib/http.js'
import { Validator } from '../lib/validate.js'
import { newId, nowIso, randomToken, sha256Hex } from '../lib/ids.js'

const PLATFORMS = ['android', 'ios', 'web']

export function registerAuthRoutes(router) {
  // Public: create a brand-new patient identity + its first device.
  // The device token is the credential, so this does not accept a password;
  // email is stored only as a display/recovery label.
  router.post('/auth/register', async (ctx) => {
    const body = await readJsonBody(ctx.request)
    const v = new Validator(body)
    v.email('email')
    v.string('displayName', { max: 60, fallback: '' })
    v.enum('platform', PLATFORMS, { fallback: 'android' })
    v.string('fcmToken', { max: 4096, fallback: null })
    v.string('deviceLabel', { max: 60, fallback: '' })
    const input = v.ensureValid()

    const patientId = newId()
    const deviceId = newId()
    const token = randomToken()
    const now = nowIso()

    await ctx.db.batch([
      {
        sql: 'INSERT INTO patients (id, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        params: [patientId, input.email || null, input.displayName || '', now, now],
      },
      {
        sql: 'INSERT INTO patient_settings (patient_id, updated_at) VALUES (?, ?)',
        params: [patientId, now],
      },
      {
        sql: `INSERT INTO devices (id, patient_id, platform, fcm_token, token_hash, label, last_seen_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [deviceId, patientId, input.platform, input.fcmToken || null, await sha256Hex(token), input.deviceLabel || '', now, now],
      },
    ])

    // token is returned once; the client persists it in secure storage.
    return ok({ patientId, deviceId, token, tokenType: 'Bearer' }, { status: 201 })
  })

  // Authenticated: current session context.
  router.get('/auth/session', async (ctx) => {
    return ok({ patient: publicPatient(ctx.auth.patient), device: publicDevice(ctx.auth.device) })
  })

  // Authenticated: attach an additional device to the same patient.
  router.post('/auth/link-device', async (ctx) => {
    const body = await readJsonBody(ctx.request)
    const v = new Validator(body)
    v.enum('platform', PLATFORMS, { fallback: 'android' })
    v.string('fcmToken', { max: 4096, fallback: null })
    v.string('deviceLabel', { max: 60, fallback: '' })
    const input = v.ensureValid()

    const deviceId = newId()
    const token = randomToken()
    const now = nowIso()
    await ctx.db.run(
      `INSERT INTO devices (id, patient_id, platform, fcm_token, token_hash, label, last_seen_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [deviceId, ctx.auth.patient.id, input.platform, input.fcmToken || null, await sha256Hex(token), input.deviceLabel || '', now, now],
    )
    return ok({ deviceId, token, tokenType: 'Bearer' }, { status: 201 })
  })

  // Authenticated: update this device's FCM push token (used by Module C).
  router.patch('/auth/device', async (ctx) => {
    const body = await readJsonBody(ctx.request)
    const v = new Validator(body)
    v.string('fcmToken', { max: 4096, fallback: null })
    const input = v.ensureValid()
    await ctx.db.run('UPDATE devices SET fcm_token = ? WHERE id = ?', [input.fcmToken || null, ctx.auth.device.id])
    return ok({ updated: true })
  })

  // Authenticated: revoke this device session.
  router.post('/auth/revoke', async (ctx) => {
    await ctx.db.run('UPDATE devices SET revoked_at = ? WHERE id = ?', [nowIso(), ctx.auth.device.id])
    return ok({ revoked: true })
  })
}

const publicPatient = (p) => ({ id: p.id, email: p.email, displayName: p.display_name, createdAt: p.created_at })
const publicDevice = (d) => ({ id: d.id, platform: d.platform, label: d.label, hasFcmToken: Boolean(d.fcm_token), createdAt: d.created_at })
