import { getSecureValue, removeSecureValue, setSecureValue } from '../secureStorage'
import { cloudApi } from './apiClient.js'

// Manages the cloud device session for a local account. The device token is the
// credential; it is stored in secure storage keyed per account and never leaves
// the device except as a bearer header. Registration is lazy: it happens the
// first time a signed-in account needs the cloud.

const cache = new Map()

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()
const storageIdFor = (user) => normalizeEmail(user?.email) || user?.uid || 'guest'
const sessionKey = (storageId) => `medloop-cloud-session-${storageId}`

function detectPlatform() {
  const capacitor = typeof window !== 'undefined' ? window.Capacitor : undefined
  const platform = capacitor?.getPlatform?.()
  return platform === 'ios' || platform === 'android' ? platform : 'web'
}

// Returns { token, patientId, deviceId }, registering a device on first use.
export async function ensureCloudSession(user) {
  const storageId = storageIdFor(user)
  if (cache.has(storageId)) return cache.get(storageId)

  const key = sessionKey(storageId)
  const stored = await getSecureValue(key)
  if (stored?.token) {
    cache.set(storageId, stored)
    return stored
  }

  const result = await cloudApi.registerDevice({
    email: normalizeEmail(user?.email) || undefined,
    displayName: user?.displayName || '',
    platform: detectPlatform(),
    deviceLabel: 'MedLoop app',
  })
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
