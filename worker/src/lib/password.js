// Server-side password hashing — PBKDF2-SHA256 via WebCrypto (available in both
// the Workers runtime and Node's test runtime). Mirrors the on-device hashing in
// src/lib/localAccount.js so the credential story is consistent end to end.

// Cloudflare Workers FREE plan caps CPU at 10 ms/request and PBKDF2 is pure CPU,
// so browser-grade 210k iterations exceed the budget and the request is killed.
// 10k fits comfortably while staying a salted, iterated KDF. Override with
// PBKDF2_ITERATIONS; on the Workers PAID plan (30s CPU) set it back to 210000+.
const DEFAULT_ITERATIONS = 10_000
const KEY_BITS = 256

function randomSaltB64() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}

function saltToBytes(saltB64) {
  return Uint8Array.from(atob(saltB64), (ch) => ch.charCodeAt(0))
}

function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Returns { hash, salt, algo, iterations } for storage. Pass an existing salt +
// iterations to reproduce a stored hash for verification.
export async function hashPassword(password, saltB64 = randomSaltB64(), iterations = DEFAULT_ITERATIONS) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(String(password)), 'PBKDF2', false, ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltToBytes(saltB64), iterations },
    keyMaterial, KEY_BITS,
  )
  return { hash: bytesToHex(bits), salt: saltB64, algo: 'pbkdf2-sha256', iterations }
}

// Iteration count to hash NEW passwords with. Reads PBKDF2_ITERATIONS when set
// (e.g. 210000 on the Workers Paid plan), else the free-tier-safe default.
// Verification always uses each user's stored iteration count, so mixing is fine.
export function hashIterations(env) {
  const configured = Number(env && env.PBKDF2_ITERATIONS)
  return Number.isFinite(configured) && configured >= 1000 ? Math.floor(configured) : DEFAULT_ITERATIONS
}

// Constant-time comparison so a timing side-channel cannot leak the stored hash.
export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// user: a row carrying password_hash / password_salt / password_iterations.
export async function verifyPassword(password, user) {
  if (!user || !user.password_hash || !user.password_salt) return false
  const { hash } = await hashPassword(password, user.password_salt, user.password_iterations || DEFAULT_ITERATIONS)
  return constantTimeEqual(hash, user.password_hash)
}
