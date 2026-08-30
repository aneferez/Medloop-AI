import { ok, readJsonBody, readJsonBodyOptional } from '../lib/http.js'
import { badRequest, conflict, forbidden, tooManyRequests, unauthorized } from '../lib/errors.js'
import { Validator } from '../lib/validate.js'
import { newId, nowIso, randomToken, sha256Hex } from '../lib/ids.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/accountEmail.js'
import { formatLinkCode, normalizeLinkCode, randomLinkCode } from '../lib/codes.js'

const PLATFORMS = ['android', 'ios', 'web']

// A device pairing code lives 10 minutes (code format lives in lib/codes.js).
const LINK_CODE_TTL_MINUTES = 10

// --- Account identity (Module A: server-side accounts) ----------------------
const VERIFY_TTL_MINUTES = 24 * 60
const RESET_TTL_MINUTES = 60
const RESEND_THROTTLE_SECONDS = 60

// Fire-and-forget an email send: account actions must never fail because the
// email provider is slow or unconfigured (it returns "skipped" in dev/tests).
function fireAndForget(ctx, promise) {
  const settled = Promise.resolve(promise).catch(() => {})
  if (ctx.ctx && typeof ctx.ctx.waitUntil === 'function') ctx.ctx.waitUntil(settled)
}

// Mints a single-use email token, dropping any prior unconsumed token of the
// same purpose so only the newest link is live. Only the SHA-256 hash is stored;
// the plaintext is returned to be emailed once.
async function issueEmailToken(db, userId, purpose, ttlMinutes) {
  const token = randomToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString()
  await db.run('DELETE FROM email_tokens WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL', [userId, purpose])
  await db.run(
    'INSERT INTO email_tokens (token_hash, user_id, purpose, expires_at, consumed_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)',
    [await sha256Hex(token), userId, purpose, expiresAt, now.toISOString()],
  )
  return { token, expiresAt }
}

// Validates + burns a single-use email token. Returns the row or null, with one
// null for every failure mode so callers cannot tell unknown/expired/used apart.
async function consumeEmailToken(db, token, purpose) {
  const now = nowIso()
  const row = await db.first('SELECT * FROM email_tokens WHERE token_hash = ?', [await sha256Hex(token)])
  if (!row || row.purpose !== purpose || row.consumed_at || row.expires_at <= now) return null
  await db.run('UPDATE email_tokens SET consumed_at = ? WHERE token_hash = ? AND consumed_at IS NULL', [now, row.token_hash])
  return row
}

// Non-production convenience: expose the token in the API response so local dev
// and the test suite can complete the flow without a configured email provider.
// Production NEVER returns it — email is the only delivery path there.
const devEcho = (ctx, field, token) =>
  (ctx.config.environment !== 'production' ? { [field]: token } : {})

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

  // Public: create a real account (email + password) plus its first device.
  // Unlike /auth/register this establishes a server-side credential and a users
  // row, which the family network and account deletion build on.
  router.post('/auth/signup', async (ctx) => {
    const body = await readJsonBody(ctx.request)
    const v = new Validator(body)
    v.email('email', { required: true })
    v.string('password', { required: true, min: 8, max: 200 })
    v.string('displayName', { max: 60, fallback: '' })
    v.enum('platform', PLATFORMS, { fallback: 'android' })
    v.string('fcmToken', { max: 4096, fallback: null })
    v.string('deviceLabel', { max: 60, fallback: '' })
    const input = v.ensureValid()

    const existing = await ctx.db.first('SELECT id FROM users WHERE email = ?', [input.email])
    if (existing) throw conflict('An account with this email already exists. Try signing in instead.')

    const pw = await hashPassword(input.password)
    const userId = newId()
    const patientId = newId()
    const deviceId = newId()
    const token = randomToken()
    const now = nowIso()

    await ctx.db.batch([
      {
        sql: `INSERT INTO users (id, email, password_hash, password_salt, password_algo, password_iterations, email_verified, display_name, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'active', ?, ?)`,
        params: [userId, input.email, pw.hash, pw.salt, pw.algo, pw.iterations, input.displayName || '', now, now],
      },
      {
        sql: 'INSERT INTO patients (id, email, display_name, owner_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        params: [patientId, input.email, input.displayName || '', userId, now, now],
      },
      { sql: 'INSERT INTO patient_settings (patient_id, updated_at) VALUES (?, ?)', params: [patientId, now] },
      {
        sql: `INSERT INTO devices (id, patient_id, user_id, platform, fcm_token, token_hash, label, last_seen_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [deviceId, patientId, userId, input.platform, input.fcmToken || null, await sha256Hex(token), input.deviceLabel || '', now, now],
      },
    ])

    const { token: verifyToken } = await issueEmailToken(ctx.db, userId, 'verify_email', VERIFY_TTL_MINUTES)
    fireAndForget(ctx, sendVerificationEmail(ctx.env, input.email, verifyToken))

    return ok({
      userId, patientId, deviceId, token, tokenType: 'Bearer', emailVerified: false,
      ...devEcho(ctx, 'devVerificationToken', verifyToken),
    }, { status: 201 })
  })

  // Public: sign in with email + password; issues a fresh device session on the
  // account's patient. Failure responses are deliberately identical (unknown
  // email vs wrong password) and spend equal work, to resist user enumeration.
  router.post('/auth/login', async (ctx) => {
    const body = await readJsonBody(ctx.request)
    const v = new Validator(body)
    v.email('email', { required: true })
    v.string('password', { required: true, min: 1, max: 200 })
    v.enum('platform', PLATFORMS, { fallback: 'android' })
    v.string('fcmToken', { max: 4096, fallback: null })
    v.string('deviceLabel', { max: 60, fallback: '' })
    const input = v.ensureValid()

    const user = await ctx.db.first('SELECT * FROM users WHERE email = ?', [input.email])
    if (!user) {
      await hashPassword(input.password) // equalize timing with a real verify
      throw unauthorized('The email or password is incorrect.')
    }
    if (user.status !== 'active' || !(await verifyPassword(input.password, user))) {
      throw unauthorized('The email or password is incorrect.')
    }

    const patient = await ctx.db.first('SELECT * FROM patients WHERE owner_user_id = ?', [user.id])
    if (!patient) throw unauthorized('This account has no patient profile.')

    const deviceId = newId()
    const token = randomToken()
    const now = nowIso()
    await ctx.db.run(
      `INSERT INTO devices (id, patient_id, user_id, platform, fcm_token, token_hash, label, last_seen_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [deviceId, patient.id, user.id, input.platform, input.fcmToken || null, await sha256Hex(token), input.deviceLabel || '', now, now],
    )
    return ok({
      userId: user.id, patientId: patient.id, deviceId, token, tokenType: 'Bearer',
      emailVerified: Boolean(user.email_verified),
    }, { status: 201 })
  })

  // Public: confirm an email address from the token sent at signup.
  router.post('/auth/verify-email', async (ctx) => {
    const body = await readJsonBody(ctx.request)
    const v = new Validator(body)
    v.string('token', { required: true, min: 10, max: 400 })
    const input = v.ensureValid()

    const row = await consumeEmailToken(ctx.db, input.token, 'verify_email')
    if (!row) throw unauthorized('This verification link is invalid or has expired. Request a new one.')
    await ctx.db.run('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?', [nowIso(), row.user_id])
    return ok({ verified: true })
  })

  // Authenticated: re-send the verification email for the current account.
  router.post('/auth/resend-verification', async (ctx) => {
    const user = ctx.auth.user
    if (!user) throw forbidden('This session is not linked to an account.')
    if (user.email_verified) return ok({ verified: true })

    const recent = await ctx.db.first(
      "SELECT created_at FROM email_tokens WHERE user_id = ? AND purpose = 'verify_email' AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1",
      [user.id],
    )
    if (recent && Date.now() - Date.parse(recent.created_at) < RESEND_THROTTLE_SECONDS * 1000) {
      throw tooManyRequests('Please wait a moment before requesting another verification email.')
    }
    const { token } = await issueEmailToken(ctx.db, user.id, 'verify_email', VERIFY_TTL_MINUTES)
    fireAndForget(ctx, sendVerificationEmail(ctx.env, user.email, token))
    return ok({ sent: true, ...devEcho(ctx, 'devVerificationToken', token) })
  })

  // Public: request a password-reset link. Always the same response, so it never
  // reveals whether an email is registered.
  router.post('/auth/password/reset-request', async (ctx) => {
    const body = await readJsonBody(ctx.request)
    const v = new Validator(body)
    v.email('email', { required: true })
    const input = v.ensureValid()

    const user = await ctx.db.first('SELECT * FROM users WHERE email = ?', [input.email])
    let devFields = {}
    if (user && user.status === 'active') {
      const { token } = await issueEmailToken(ctx.db, user.id, 'reset_password', RESET_TTL_MINUTES)
      fireAndForget(ctx, sendPasswordResetEmail(ctx.env, user.email, token))
      devFields = devEcho(ctx, 'devResetToken', token)
    }
    return ok({ sent: true, ...devFields })
  })

  // Public: complete a password reset. Also revokes every existing session on
  // the account, so a leaked device token cannot outlive the reset.
  router.post('/auth/password/reset', async (ctx) => {
    const body = await readJsonBody(ctx.request)
    const v = new Validator(body)
    v.string('token', { required: true, min: 10, max: 400 })
    v.string('password', { required: true, min: 8, max: 200 })
    const input = v.ensureValid()

    const row = await consumeEmailToken(ctx.db, input.token, 'reset_password')
    if (!row) throw unauthorized('This reset link is invalid or has expired. Request a new one.')

    const pw = await hashPassword(input.password)
    const now = nowIso()
    const patient = await ctx.db.first('SELECT id FROM patients WHERE owner_user_id = ?', [row.user_id])
    await ctx.db.batch([
      {
        sql: 'UPDATE users SET password_hash = ?, password_salt = ?, password_algo = ?, password_iterations = ?, updated_at = ? WHERE id = ?',
        params: [pw.hash, pw.salt, pw.algo, pw.iterations, now, row.user_id],
      },
      ...(patient
        ? [{ sql: 'UPDATE devices SET revoked_at = ? WHERE patient_id = ? AND revoked_at IS NULL', params: [now, patient.id] }]
        : []),
    ])
    return ok({ reset: true })
  })

  // Authenticated: permanently delete the account and all associated data
  // (health records, family, dose logs, prescriptions + their R2 files, devices,
  // and the user). Requires the account password when one is set, so a lost
  // linked device cannot nuke the account on its own.
  router.delete('/account', async (ctx) => {
    const body = await readJsonBodyOptional(ctx.request)
    const user = ctx.auth.user
    const patientId = ctx.auth.patient.id

    if (user && user.password_hash) {
      const password = String(body.password || '')
      if (!password || !(await verifyPassword(password, user))) {
        throw unauthorized('Enter your account password to delete the account.')
      }
    }

    // Remove prescription files from R2 before the DB rows that reference them.
    if (ctx.env.FILES) {
      const files = await ctx.db.all(
        'SELECT file_key FROM prescriptions WHERE patient_id = ? AND file_key IS NOT NULL', [patientId],
      )
      for (const file of files) {
        try { await ctx.env.FILES.delete(file.file_key) } catch { /* best-effort */ }
      }
    }

    // Deleting the patient cascades all health rows + devices; deleting the user
    // cascades its email tokens. Patient first so nothing still references the user.
    const statements = [{ sql: 'DELETE FROM patients WHERE id = ?', params: [patientId] }]
    if (user) statements.push({ sql: 'DELETE FROM users WHERE id = ?', params: [user.id] })
    await ctx.db.batch(statements)

    return ok({ deleted: true, patientId, deletedAt: nowIso() })
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
