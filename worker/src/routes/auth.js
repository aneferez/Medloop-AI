import { ok, readJsonBody } from '../lib/http.js'
import { badRequest, unauthorized } from '../lib/errors.js'
import { Validator } from '../lib/validate.js'
import { newId, nowIso, randomToken, sha256Hex } from '../lib/ids.js'

const PLATFORMS = ['android', 'ios', 'web']

// Device pairing codes. Read aloud or typed across, so the alphabet drops the
// characters people confuse (0/O, 1/I/L). 10 chars over 32 symbols is ~50 bits,
// and 256 is a multiple of 32 so the byte -> symbol mapping stays unbiased.
const LINK_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const LINK_CODE_LENGTH = 10
const LINK_CODE_TTL_MINUTES = 10

function randomLinkCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(LINK_CODE_LENGTH))
  let code = ''
  for (const byte of bytes) code += LINK_CODE_ALPHABET[byte % LINK_CODE_ALPHABET.length]
  return code
}

// Accepts what a person actually types: spaces, dashes and lower case.
export function normalizeLinkCode(raw) {
  const text = String(raw == null ? '' : raw).toUpperCase().replace(/[^0-9A-Z]/g, '')
  return text.length === LINK_CODE_LENGTH && [...text].every((ch) => LINK_CODE_ALPHABET.includes(ch))
    ? text
    : ''
}

// Display form: two groups of five.
export const formatLinkCode = (code) => `${code.slice(0, 5)}-${code.slice(5)}`

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

  // Authenticated: mint a short-lived, single-use code that lets another device
  // join this account. Any previously unused code is dropped, so only the most
  // recent one is live and an abandoned code cannot linger.
  router.post('/auth/link-code', async (ctx) => {
    const code = randomLinkCode()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MINUTES * 60 * 1000).toISOString()

    await ctx.db.run(
      'DELETE FROM device_link_codes WHERE patient_id = ? AND redeemed_at IS NULL',
      [ctx.auth.patient.id],
    )
    await ctx.db.run(
      `INSERT INTO device_link_codes (code_hash, patient_id, created_by, expires_at, redeemed_at, created_at)
       VALUES (?, ?, ?, ?, NULL, ?)`,
      [await sha256Hex(code), ctx.auth.patient.id, ctx.auth.device.id, expiresAt, now.toISOString()],
    )

    // Shown once — only the hash is stored.
    return ok({ code: formatLinkCode(code), expiresAt, expiresInMinutes: LINK_CODE_TTL_MINUTES }, { status: 201 })
  })

  // Public: redeem a pairing code for this device's own session token. This is
  // the only way to join an existing account, since email is a label and not a
  // login.
  router.post('/auth/link-code/redeem', async (ctx) => {
    const body = await readJsonBody(ctx.request)
    const code = normalizeLinkCode(body.code)
    if (!code) throw badRequest('Enter the 10-character pairing code shown on your other device.')

    const v = new Validator(body)
    v.enum('platform', PLATFORMS, { fallback: 'android' })
    v.string('fcmToken', { max: 4096, fallback: null })
    v.string('deviceLabel', { max: 60, fallback: '' })
    const input = v.ensureValid()

    const now = nowIso()
    const row = await ctx.db.first(
      'SELECT * FROM device_link_codes WHERE code_hash = ?',
      [await sha256Hex(code)],
    )
    // One error for every failure mode, so a caller cannot tell an unknown code
    // from a used or expired one.
    if (!row || row.redeemed_at || row.expires_at <= now) {
      throw unauthorized('That pairing code is not valid. Generate a fresh one on your other device.')
    }

    const patient = await ctx.db.first('SELECT * FROM patients WHERE id = ?', [row.patient_id])
    if (!patient) throw unauthorized('That account no longer exists.')

    const deviceId = newId()
    const token = randomToken()
    await ctx.db.batch([
      {
        sql: `INSERT INTO devices (id, patient_id, platform, fcm_token, token_hash, label, last_seen_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [deviceId, row.patient_id, input.platform, input.fcmToken || null, await sha256Hex(token), input.deviceLabel || '', now, now],
      },
      // Single use: burn it in the same batch that creates the device.
      {
        sql: 'UPDATE device_link_codes SET redeemed_at = ? WHERE code_hash = ? AND redeemed_at IS NULL',
        params: [now, row.code_hash],
      },
    ])

    return ok({ patientId: row.patient_id, deviceId, token, tokenType: 'Bearer' }, { status: 201 })
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
