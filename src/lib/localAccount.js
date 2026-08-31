import { getSecureValue, removeSecureValue, setSecureValue } from './secureStorage'

const ACCOUNTS_KEY = 'medloop-local-accounts-v1'
const SESSION_KEY = 'medloop-local-session-v1'
const PASSWORD_ITERATIONS = 210_000

const toText = (value, fallback = '') => String(value ?? fallback).trim()
const normalizeEmail = (email) => toText(email).toLowerCase()
const listeners = new Set()

function createAuthError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function readLegacyJson(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    const saved = window.localStorage.getItem(key)
    return saved ? JSON.parse(saved) : fallback
  } catch {
    return fallback
  }
}

async function readAccounts() {
  let accounts = await getSecureValue(ACCOUNTS_KEY)
  if (!accounts) {
    accounts = readLegacyJson(ACCOUNTS_KEY, {})
    if (accounts && Object.keys(accounts).length > 0) {
      await setSecureValue(ACCOUNTS_KEY, accounts)
      window.localStorage.removeItem(ACCOUNTS_KEY)
    }
  }
  return accounts && typeof accounts === 'object' ? accounts : {}
}

async function writeAccounts(accounts) {
  await setSecureValue(ACCOUNTS_KEY, accounts)
}

function createUser(account) {
  if (!account) return null
  return {
    uid: account.uid,
    email: account.email,
    displayName: account.displayName || account.email,
    emailVerified: account.emailVerified !== false,
    authProvider: account.authProvider || 'local',
    providerData: [{ providerId: 'password' }],
  }
}

// Creates or updates the encrypted local shadow used by the local-first UI
// after a server account signs in. The server password is never stored here;
// the random shadow password only protects the local cache from other local
// account entries and is not used for cloud authentication.
export const adoptServerUser = async ({ uid, email, displayName = '', emailVerified = false }) => {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) throw createAuthError('auth/invalid-email', 'A server account email is required.')
  const accounts = await readAccounts()
  const existing = accounts[normalizedEmail]
  let account = existing
  if (!account) {
    const salt = createSalt()
    account = {
      uid,
      email: normalizedEmail,
      displayName: toText(displayName || normalizedEmail).slice(0, 60),
      passwordSalt: salt,
      passwordHash: await hashPassword(createSalt(), salt),
      passwordAlgorithm: 'pbkdf2-sha256',
      passwordIterations: PASSWORD_ITERATIONS,
      createdAt: new Date().toISOString(),
    }
  }
  accounts[normalizedEmail] = {
    ...account,
    uid: uid || account.uid,
    displayName: toText(displayName || account.displayName || normalizedEmail).slice(0, 60),
    emailVerified: Boolean(emailVerified),
    authProvider: 'server',
  }
  await writeAccounts(accounts)
  await setSecureValue(SESSION_KEY, { email: normalizedEmail })
  await notifyAuthState()
  return { user: createUser(accounts[normalizedEmail]) }
}

export const removeCurrentLocalAccount = async () => {
  const account = await readCurrentAccount()
  if (!account) return { deleted: false }
  const accounts = await readAccounts()
  delete accounts[account.email]
  await writeAccounts(accounts)
  await removeSecureValue(SESSION_KEY)
  await notifyAuthState()
  return { deleted: true }
}

async function notifyAuthState() {
  const user = createUser(await readCurrentAccount())
  listeners.forEach((callback) => callback(user))
}

async function readSession() {
  let session = await getSecureValue(SESSION_KEY)
  if (!session) {
    session = readLegacyJson(SESSION_KEY, null)
    if (session?.email) {
      await setSecureValue(SESSION_KEY, session)
      window.localStorage.removeItem(SESSION_KEY)
    }
  }
  return session
}

async function readCurrentAccount() {
  const session = await readSession()
  if (!session?.email) return null
  return (await readAccounts())[session.email] || null
}

async function digestText(text) {
  if (!globalThis.crypto?.subtle) throw new Error('Secure password hashing is unavailable on this device.')
  const bytes = new TextEncoder().encode(text)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function legacyHashPassword(password, salt) {
  return digestText(`${salt}:${password}`)
}

function createSalt() {
  if (!globalThis.crypto?.getRandomValues) throw new Error('Secure random generation is unavailable on this device.')
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}

function decodeSalt(salt) {
  return Uint8Array.from(atob(salt), (character) => character.charCodeAt(0))
}

async function hashPassword(password, salt, iterations = PASSWORD_ITERATIONS) {
  if (!globalThis.crypto?.subtle) throw new Error('Secure password hashing is unavailable on this device.')
  const passwordKey = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const derived = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: decodeSalt(salt), iterations },
    passwordKey,
    256,
  )
  return Array.from(new Uint8Array(derived)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hashesMatch(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

async function verifyPassword(account, password) {
  if (account.passwordAlgorithm === 'pbkdf2-sha256') {
    const hash = await hashPassword(password, account.passwordSalt, account.passwordIterations || PASSWORD_ITERATIONS)
    return hashesMatch(hash, account.passwordHash)
  }
  return hashesMatch(await legacyHashPassword(password, account.passwordSalt), account.passwordHash)
}

function createUid(email) {
  return `local-${encodeURIComponent(email)}`
}

export const signupWithEmail = async (email, password, displayName = '') => {
  const normalizedEmail = normalizeEmail(email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw createAuthError('auth/invalid-email', 'Enter a valid email address.')
  }
  if (toText(password).length < 8) {
    throw createAuthError('auth/weak-password', 'Use a stronger password with at least 8 characters.')
  }

  const accounts = await readAccounts()
  if (accounts[normalizedEmail]) {
    throw createAuthError('auth/email-already-in-use', 'This email is already registered on this device.')
  }

  const salt = createSalt()
  const account = {
    uid: createUid(normalizedEmail),
    email: normalizedEmail,
    displayName: toText(displayName || normalizedEmail).slice(0, 60),
    passwordSalt: salt,
    passwordHash: await hashPassword(password, salt),
    passwordAlgorithm: 'pbkdf2-sha256',
    passwordIterations: PASSWORD_ITERATIONS,
    createdAt: new Date().toISOString(),
  }
  accounts[normalizedEmail] = account
  await writeAccounts(accounts)
  await setSecureValue(SESSION_KEY, { email: normalizedEmail })
  const user = createUser(account)
  await notifyAuthState()
  return { user }
}

export const loginWithEmail = async (email, password) => {
  const normalizedEmail = normalizeEmail(email)
  const accounts = await readAccounts()
  const account = accounts[normalizedEmail]
  if (!account) {
    throw createAuthError('auth/invalid-credential', 'The email or password is incorrect.')
  }
  if (!await verifyPassword(account, password)) {
    throw createAuthError('auth/invalid-credential', 'The email or password is incorrect.')
  }
  if (account.passwordAlgorithm !== 'pbkdf2-sha256') {
    const salt = createSalt()
    accounts[normalizedEmail] = {
      ...account,
      passwordSalt: salt,
      passwordHash: await hashPassword(password, salt),
      passwordAlgorithm: 'pbkdf2-sha256',
      passwordIterations: PASSWORD_ITERATIONS,
    }
    await writeAccounts(accounts)
  }
  await setSecureValue(SESSION_KEY, { email: normalizedEmail })
  await notifyAuthState()
  return { user: createUser(account) }
}

export const logoutFromLocalAccount = async () => {
  await removeSecureValue(SESSION_KEY)
  await notifyAuthState()
}

export const observeAuthState = (callback) => {
  let active = true
  listeners.add(callback)
  readCurrentAccount()
    .then((account) => {
      if (active) callback(createUser(account))
    })
    .catch(() => {
      if (active) callback(null)
    })
  return () => {
    active = false
    listeners.delete(callback)
  }
}

export const sendResetLink = async () => {
  throw createAuthError('auth/local-reset-unavailable', 'Password reset emails are unavailable in local-only mode.')
}

export const deleteCurrentAccount = async (password = '') => {
  const account = await readCurrentAccount()
  if (!account) throw createAuthError('auth/no-current-user', 'Sign in before deleting an account.')
  if (!await verifyPassword(account, password)) {
    throw createAuthError('auth/invalid-credential', 'The password is incorrect.')
  }
  const accounts = await readAccounts()
  delete accounts[account.email]
  await writeAccounts(accounts)
  await removeSecureValue(SESSION_KEY)
  await notifyAuthState()
  return { deleted: true }
}

export const buildMissedDoseSmsUri = ({ contact, medicine, doseLog }) => {
  const phone = toText(contact?.phone)
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('The family phone number is not valid.')
  const medicineName = toText(medicine?.name || doseLog?.medicineName, 'medicine')
  const dosage = toText(medicine?.dosage || doseLog?.dosage, 'as directed')
  const scheduledTime = toText(medicine?.time || doseLog?.scheduledTime, 'the scheduled time')
  const message = `MedLoop reminder: A ${medicineName} dose (${dosage}) scheduled for ${scheduledTime} was marked missed. Please check in. This is not an emergency alert.`
  return `sms:${phone}?body=${encodeURIComponent(message)}`
}

export const composeMissedDoseSms = (details) => {
  const uri = buildMissedDoseSmsUri(details)
  if (typeof window !== 'undefined') window.location.href = uri
  return uri
}

export const buildRefillSmsUri = ({ familyMember, medicines = [] }) => {
  const phone = toText(familyMember?.phone)
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('The Level 1 family phone number is not valid.')
  const names = medicines.map((medicine) => toText(medicine?.name)).filter(Boolean)
  const listedNames = names.slice(0, 8).join(', ') || 'the registered medicines'
  const remainder = names.length > 8 ? ` and ${names.length - 8} more` : ''
  const message = `MedLoop refill check: Please review the available supply for ${listedNames}${remainder}. This is a scheduled reminder, not an emergency alert.`
  return `sms:${phone}?body=${encodeURIComponent(message)}`
}

export const composeRefillSms = (details) => {
  const uri = buildRefillSmsUri(details)
  if (typeof window !== 'undefined') window.location.href = uri
  return uri
}
