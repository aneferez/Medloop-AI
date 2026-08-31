// Optional request attestation — the App Check equivalent for the Worker gateway
// (task #4). When TURNSTILE_SECRET is set, verifies a Cloudflare Turnstile token
// on sensitive public endpoints (e.g. signup). When it is not set, this is a
// no-op so the gateway still runs in dev/tests; it only ever fails closed once
// configured.

export function isAttestationEnabled(env) {
  return Boolean(env.TURNSTILE_SECRET)
}

export async function verifyAttestation(env, request, token) {
  if (!isAttestationEnabled(env)) return true
  if (!token) return false
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: String(token) })
    const ip = request.headers.get('CF-Connecting-IP')
    if (ip) body.set('remoteip', ip)
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body })
    const data = await response.json().catch(() => null)
    return Boolean(data && data.success)
  } catch {
    return false
  }
}
