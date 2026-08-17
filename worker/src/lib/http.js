import { ApiError, badRequest, unsupportedMedia } from './errors.js'

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
}

export function json(data, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...SECURITY_HEADERS,
      ...headers,
    },
  })
}

// Success envelope: { ok: true, data }.
export const ok = (data, init) => json({ ok: true, data }, init)

// Error envelope: { ok: false, error: { code, message, details? } }.
export function errorResponse(error, headers = {}) {
  if (error instanceof ApiError) {
    return json(
      { ok: false, error: { code: error.code, message: error.message, details: error.details ?? undefined } },
      { status: error.status, headers },
    )
  }
  return json(
    { ok: false, error: { code: 'internal_error', message: 'An unexpected error occurred.' } },
    { status: 500, headers },
  )
}

// Parses a JSON body, enforcing content-type and returning an object.
export async function readJsonBody(request) {
  const contentType = request.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) throw unsupportedMedia()
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? body : {}
  } catch {
    throw badRequest('Request body is not valid JSON.')
  }
}

// Like readJsonBody but tolerates a missing/empty body — returns {} instead of
// throwing. Used by endpoints where the body is optional (e.g. SOS trigger).
export async function readJsonBodyOptional(request) {
  const contentType = request.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return {}
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? body : {}
  } catch {
    return {}
  }
}
