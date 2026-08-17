import { ok } from '../lib/http.js'

export function registerSystemRoutes(router) {
  // Public liveness/readiness check with a cheap DB round-trip.
  router.get('/health', async (ctx) => {
    let database = 'unknown'
    try {
      await ctx.db.first('SELECT 1 AS ok')
      database = 'ok'
    } catch {
      database = 'error'
    }
    return ok({
      service: 'medloop-api',
      status: 'ok',
      version: ctx.config.apiVersion,
      environment: ctx.config.environment,
      database,
      files: ctx.config.hasFiles ? 'r2' : 'disabled',
      time: new Date().toISOString(),
    })
  })

  // Public capability descriptor for progressive client enablement.
  router.get('/meta', async (ctx) => {
    return ok({
      service: 'medloop-api',
      apiVersion: ctx.config.apiVersion,
      capabilities: {
        fileStorage: ctx.config.hasFiles,
        modules: ['A-foundation', 'D-family', 'B-medicine-stock', 'C-alerts', 'E-scheduled', 'F-emergency', 'G-sync', 'H-records-files-email'],
      },
    })
  })
}
