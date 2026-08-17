// FCM push channel (rows #15, #25) — Firebase HTTP v1 API. Firebase is retained
// ONLY for push messaging; it is no longer a backend or database.
//
// Auth uses the service-account credentials (FCM_PROJECT_ID / FCM_CLIENT_EMAIL /
// FCM_PRIVATE_KEY) to mint a short-lived OAuth token via a signed JWT. The token
// is cached per isolate. When credentials are absent, sends return "skipped" so
// the alert pipeline still records history and works in development.

let cachedToken = null // { token, expiresAtSeconds }

export function isFcmConfigured(env) {
  return Boolean(env.FCM_PROJECT_ID && env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY)
}

function pemToArrayBuffer(pem) {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function base64url(bytes) {
  let binary = ''
  const arr = new Uint8Array(bytes)
  for (const byte of arr) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const base64urlJson = (obj) => base64url(new TextEncoder().encode(JSON.stringify(obj)))

async function getAccessToken(env) {
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.expiresAtSeconds > nowSeconds + 60) return cachedToken.token

  const privateKeyPem = String(env.FCM_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: env.FCM_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  }
  const unsigned = `${base64urlJson(header)}.${base64urlJson(claim)}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${base64url(signature)}`

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!response.ok) throw new Error(`fcm_token_exchange_${response.status}`)
  const data = await response.json()
  cachedToken = { token: data.access_token, expiresAtSeconds: nowSeconds + (data.expires_in || 3600) }
  return cachedToken.token
}

function stringifyData(data) {
  if (!data) return undefined
  const out = {}
  for (const [key, value] of Object.entries(data)) out[key] = String(value)
  return out
}

export async function sendPush(env, target, { title, body, data } = {}) {
  if (!isFcmConfigured(env)) return { status: 'skipped', error: 'fcm_not_configured' }
  try {
    const accessToken = await getAccessToken(env)
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${env.FCM_PROJECT_ID}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { token: target, notification: { title, body }, data: stringifyData(data) },
      }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) return { status: 'failed', error: (payload && payload.error && payload.error.message) || `fcm_${response.status}` }
    return { status: 'sent', providerRef: (payload && payload.name) || null }
  } catch (error) {
    return { status: 'failed', error: String(error.message || error) }
  }
}
