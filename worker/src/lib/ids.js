export const newId = () => crypto.randomUUID()
export const nowIso = () => new Date().toISOString()

// SHA-256 hex digest — used to hash device session tokens before storage so a
// database leak never exposes usable credentials.
export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Cryptographically-random opaque token (base64url, ~256 bits of entropy).
export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
