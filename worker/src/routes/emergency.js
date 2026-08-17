import { ok, readJsonBodyOptional } from '../lib/http.js'
import { notFound } from '../lib/errors.js'
import { Validator } from '../lib/validate.js'
import { toPublicEmergencyEvent } from '../domain/emergency.js'
import { cancelEmergency, confirmEmergency, createEmergency } from '../services/emergencyService.js'

export function registerEmergencyRoutes(router) {
  // Row #20 + #23: trigger an SOS (pending confirmation). Body is optional.
  router.post('/emergency', async (ctx) => {
    const body = await readJsonBodyOptional(ctx.request)
    const v = new Validator(body)
    v.string('note', { max: 500, fallback: '' })
    const input = v.ensureValid()
    const result = await createEmergency(ctx, { note: input.note })
    return ok(result, { status: 201 })
  })

  router.get('/emergency', async (ctx) => {
    const rows = await ctx.db.all(
      'SELECT * FROM emergency_events WHERE patient_id = ? ORDER BY triggered_at DESC LIMIT 100',
      [ctx.auth.patient.id],
    )
    return ok({ events: rows.map(toPublicEmergencyEvent) })
  })

  router.get('/emergency/:id', async (ctx) => {
    const row = await ctx.db.first(
      'SELECT * FROM emergency_events WHERE id = ? AND patient_id = ?',
      [ctx.params.id, ctx.auth.patient.id],
    )
    if (!row) throw notFound('Emergency event not found.')
    return ok({ event: toPublicEmergencyEvent(row) })
  })

  // Row #22: confirm and fan out the alert across every channel.
  router.post('/emergency/:id/confirm', async (ctx) => {
    return ok(await confirmEmergency(ctx, ctx.params.id))
  })

  // Row #23: cancel to prevent an accidental alert.
  router.post('/emergency/:id/cancel', async (ctx) => {
    return ok(await cancelEmergency(ctx, ctx.params.id))
  })
}
