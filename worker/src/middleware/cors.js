// True when the origin is permitted. Allow-list entries may be exact origins or
// `*.suffix` wildcards (e.g. `*.pages.dev` for Cloudflare Pages deployments,
// including preview URLs). Safe to be permissive here: the API authenticates
// with bearer tokens, not cookies, so CORS is not the auth boundary.
export function isOriginAllowed(origin, allowedOrigins) {
  if (allowedOrigins === '*') return true
  return allowedOrigins.some((entry) => {
    if (entry === origin) return true
    if (entry.startsWith('*.')) {
      try {
        return new URL(origin).hostname.endsWith(entry.slice(1))
      } catch {
        return false
      }
    }
    return false
  })
}

// CORS for the Capacitor web view, local dev, and Pages origins.
export function resolveCors(request, allowedOrigins) {
  const origin = request.headers.get('Origin')
  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  if (!origin) return headers
  if (allowedOrigins === '*') {
    headers['Access-Control-Allow-Origin'] = '*'
  } else if (isOriginAllowed(origin, allowedOrigins)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  }
  return headers
}

export const preflight = (corsHeaders) => new Response(null, { status: 204, headers: corsHeaders })
