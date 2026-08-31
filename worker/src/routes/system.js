import { ok } from '../lib/http.js'
import { isFcmConfigured, isWhatsappConfigured } from '../channels/index.js'
import { isEmailConfigured } from '../channels/email.js'
import { isAiConfigured } from '../services/aiService.js'
import { isAttestationEnabled } from '../middleware/attestation.js'

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

  // Authenticated diagnostics: which channels/secrets are wired, as booleans
  // ONLY — never a secret value. Lets an operator confirm push/email/AI are live
  // after setting secrets, without guessing. Authenticated (absent from
  // PUBLIC_ROUTES) so the deployment's config posture isn't world-readable.
  router.get('/system/config-check', async (ctx) => {
    return ok({
      environment: ctx.config.environment,
      channels: {
        push: isFcmConfigured(ctx.env),      // FCM_PROJECT_ID + FCM_CLIENT_EMAIL + FCM_PRIVATE_KEY
        email: isEmailConfigured(ctx.env),   // RESEND_API_KEY + EMAIL_FROM
        whatsapp: isWhatsappConfigured(ctx.env),
      },
      ai: { configured: isAiConfigured(ctx.env) },       // [ai] binding or MEDLOOP_AI_API_KEY
      attestation: { enabled: isAttestationEnabled(ctx.env) }, // TURNSTILE_SECRET
      storage: { r2: ctx.config.hasFiles },
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
