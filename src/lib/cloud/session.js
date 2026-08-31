import { getSecureValue, removeSecureValue, setSecureValue } from '../secureStorage'
import { cloudApi } from './apiClient.js'
import { isCloudEnabled } from './config.js'

// Manages the cloud device session for a local account. The device token is the
// credential; it is stored in secure storage keyed per account and never leaves
// the device except as a bearer header. Registration is lazy: it happens the
// first time a signed-in account needs the cloud.

const cache = new Map()

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()
const storageIdFor = (user) => normalizeEmail(user?.email) || user?.uid || 'guest'
const sessionKey = (storageId) => `medloop-cloud-session-${storageId}`

function externalUser({ email, displayName = '', userId, emailVerified = false }) {
  return {
    uid: userId,
    email: normalizeEmail(email),
    displayName: String(displayName || email || '').trim(),
    emailVerified: Boolean(emailVerified),
    providerData: [{ providerId: 'password', server: true }],
  }
}

function detectPlatform() {
  const capacitor = typeof window !== 'undefined' ? window.Capacitor : undefined
  const platform = capacitor?.getPlatform?.()
  return platform === 'ios' || platform === 'android' ? platform : 'web'
}

// Returns { token, patientId, deviceId }, registering a device on first use.
export async function ensureCloudSession(user, { attestationToken = '' } = {}) {
  const storageId = storageIdFor(user)
  if (cache.has(storageId)) return cache.get(storageId)

  const key = sessionKey(storageId)
  const stored = await getSecureValue(key)
  if (stored?.token) {
    cache.set(storageId, stored)
    return stored
  }

  const payload = {
    email: normalizeEmail(user?.email) || undefined,
    displayName: user?.displayName || '',
    platform: detectPlatform(),
    deviceLabel: 'MedLoop app',
  }
  if (attestationToken) payload.attestationToken = attestationToken
  const result = await cloudApi.registerDevice(payload)
  const session = { token: result.token, patientId: result.patientId, deviceId: result.deviceId }
  await setSecureValue(key, session)
  cache.set(storageId, session)
  return session
}

// Mints a pairing code on this (already registered) device, for another device
// to redeem. Returns { code, expiresAt, expiresInMinutes }.
export async function createLinkCode(user) {
  const session = await ensureCloudSession(user)
  return cloudApi.createLinkCode(session.token)
}

// Redeems a code minted elsewhere, replacing this account's stored session so
// the app now talks to the existing cloud account rather than a fresh one. The
// caller is responsible for pulling the snapshot afterwards.
export async function redeemLinkCode(user, code) {
  const result = await cloudApi.redeemLinkCode({
    code,
    platform: detectPlatform(),
    deviceLabel: 'MedLoop app',
  })
  const session = { token: result.token, patientId: result.patientId, deviceId: result.deviceId }
  const storageId = storageIdFor(user)
  await setSecureValue(sessionKey(storageId), session)
  cache.set(storageId, session)
  return session
}

// Forgets the cloud session locally (used on account deletion).
export async function clearCloudSession(user) {
  const storageId = storageIdFor(user)
  cache.delete(storageId)
  await removeSecureValue(sessionKey(storageId))
}

// Server account authentication is deliberately separate from the legacy
// device registration path. Local account state remains the offline cache, but
// cloud mode receives a real user-scoped bearer token from the Worker.
export async function authenticateCloudAccount({ mode, email, password, displayName = '', attestationToken = '' }) {
  if (!isCloudEnabled()) throw new Error('Cloud authentication is not configured.')
  const payload = {
    email: normalizeEmail(email),
    password,
    displayName: String(displayName || '').trim(),
    platform: detectPlatform(),
    deviceLabel: 'MedLoop app',
  }
  if (attestationToken) payload.attestationToken = attestationToken
  const result = mode === 'signup'
    ? await cloudApi.auth.signup(payload)
    : await cloudApi.auth.login(payload)
  const session = {
    token: result.token,
    patientId: result.patientId,
    deviceId: result.deviceId,
    userId: result.userId || null,
    emailVerified: Boolean(result.emailVerified),
  }
  await setSecureValue(sessionKey(normalizeEmail(email)), session)
  cache.set(normalizeEmail(email), session)
  return {
    session,
    user: externalUser({ email, displayName, userId: result.userId || `local-${encodeURIComponent(normalizeEmail(email))}`, emailVerified: result.emailVerified }),
    devVerificationToken: result.devVerificationToken || '',
  }
}

export async function resendVerification(user) {
  const session = await ensureCloudSession(user)
  return cloudApi.auth.resendVerification(session.token)
}

export async function verifyEmail(token) {
  return cloudApi.auth.verifyEmail(String(token || '').trim())
}

export async function requestPasswordReset(email) {
  return cloudApi.auth.requestPasswordReset(normalizeEmail(email))
}

export async function resetPassword(token, password) {
  return cloudApi.auth.resetPassword(String(token || '').trim(), password)
}

export async function exportCloudAccount(user) {
  const session = await ensureCloudSession(user)
  return cloudApi.account.export(session.token)
}

export async function deleteCloudAccount(user, password) {
  const session = await ensureCloudSession(user)
  return cloudApi.account.remove(session.token, password)
}

// Revokes the current device credential before removing it locally. This is
// deliberately best-effort at the call site: local logout must still finish
// when the gateway is unreachable, but a reachable gateway should not retain
// a usable session for a device the user just signed out from.
export async function revokeCloudSession(user) {
  const storageId = storageIdFor(user)
  let revoked = false
  try {
    const session = cache.get(storageId) || await getSecureValue(sessionKey(storageId))
    if (session?.token) {
      await cloudApi.revokeDevice(session.token)
      revoked = true
    }
  } finally {
    await clearCloudSession(user)
  }
  return revoked
}
