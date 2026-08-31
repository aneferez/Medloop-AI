import { ok, readJsonBody } from '../lib/http.js'
import { tooManyRequests } from '../lib/errors.js'
import { Validator } from '../lib/validate.js'
import { aiAssistant, aiSimplify } from '../services/aiService.js'

// MedLoop AI endpoints (feature #8) — authenticated + rate-limited, with the
// safety guardrails enforced inside the service (tasks #32-35).
export function registerAiRoutes(router) {
  router.post('/ai/simplify', async (ctx) => {
    const body = await readJsonBody(ctx.request)
    const v = new Validator(body)
    v.string('text', { required: true, min: 1, max: 2000 })
    const input = v.ensureValid()

    const result = await aiSimplify(ctx, { text: input.text })
    if (result.rateLimited) throw tooManyRequests('You have reached the AI usage limit for now. Please try again later.')
    return ok(result)
  })

  router.post('/ai/assistant', async (ctx) => {
    const body = await readJsonBody(ctx.request)
    const v = new Validator(body)
    v.string('question', { required: true, min: 1, max: 2000 })
    v.string('context', { max: 4000 })
    const input = v.ensureValid()

    const result = await aiAssistant(ctx, { question: input.question, context: input.context })
    if (result.rateLimited) throw tooManyRequests('You have reached the AI usage limit for now. Please try again later.')
    return ok(result)
  })
}
