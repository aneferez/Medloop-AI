import { loadConfig } from './config.js'
import { createDb } from './db/d1.js'
import { Router } from './router.js'
import { resolveCors, preflight } from './middleware/cors.js'
import { authenticate } from './middleware/auth.js'
import { errorResponse } from './lib/http.js'
import { ApiError, notFound } from './lib/errors.js'
import { registerRoutes, PUBLIC_ROUTES } from './routes/index.js'
import { runScheduled } from './scheduled.js'

// The router is built once per isolate and reused across requests.
const router = registerRoutes(new Router())

// Strips the "/<apiVersion>" prefix. Returns null when the path is not under it.
function stripPrefix(pathname, apiVersion) {
  const prefix = `/${apiVersion}`
  if (pathname === prefix) return '/'
  if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length)
  return null
}

// Copies CORS headers onto a handler response without consuming its body twice.
function withCors(response, cors) {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(cors)) headers.set(key, value)
  return new Response(response.body, { status: response.status, headers })
}

export default {
  async fetch(request, env, ctx) {
    const config = loadConfig(env)
    const cors = resolveCors(request, config.allowedOrigins)

    if (request.method === 'OPTIONS') return preflight(cors)

    try {
      const url = new URL(request.url)
      const pathname = stripPrefix(url.pathname, config.apiVersion)
      if (pathname === null) {
        return withCors(errorResponse(notFound(`Use the /${config.apiVersion} API prefix.`)), cors)
      }

      const matched = router.match(request.method, pathname)
      if (!matched) {
        const err = router.hasPath(pathname)
          ? new ApiError(405, 'method_not_allowed', 'Method not allowed for this endpoint.')
          : notFound()
        return withCors(errorResponse(err), cors)
      }

      const db = createDb(env.DB)
      const context = {
        request,
        env,
        ctx,
        config,
        db,
        params: matched.params,
        query: Object.fromEntries(url.searchParams),
        auth: null,
      }

      // Every route requires a device session token except the public set.
      if (!PUBLIC_ROUTES.has(`${request.method} ${matched.pattern}`)) {
        context.auth = await authenticate(request, db)
      }

      const response = await matched.handler(context)
      return withCors(response, cors)
    } catch (error) {
      if (!(error instanceof ApiError)) console.error('Unhandled gateway error:', error)
      return withCors(errorResponse(error), cors)
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduled(event, env))
  },
}
