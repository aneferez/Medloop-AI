import { ok, readJsonBody } from '../lib/http.js'
import { notFound } from '../lib/errors.js'
import { Validator } from '../lib/validate.js'
import { nowIso } from '../lib/ids.js'
import { toPublicAlert, toPublicNotification } from '../domain/notifications.js'
import { FAMILY_ALERT_LEVELS } from '../domain/family.js'
import { createAndDispatchAlert } from '../services/alertService.js'

const ALERT_TYPES = ['medicine', 'stock', 'restock', 'family', 'emergency', 'system']

export function registerAlertRoutes(router) {
  // Create + dispatch an alert across every enabled channel (rows #3, #15, #16).
  router.post('/alerts', async (ctx) => {
    const body = await readJsonBody(ctx.request)
    const v = new Validator(body)
    v.enum('type', ALERT_TYPES, { required: true })
    v.string('title', { required: true, max: 160 })
    v.string('detail', { max: 1000, fallback: '' })
    v.enum('level', FAMILY_ALERT_LEVELS, { fallback: 'Level 3' })
    v.string('refId', { max: 64 })
    v.enum('audience', ['by-level', 'all'], { fallback: 'by-level' })
    const input = v.ensureValid()

    const result = await createAndDispatchAlert(ctx, {
      type: input.type,
      title: input.title,
      detail: input.detail,
      level: input.level,
      refId: input.refId ?? null,
      audience: input.audience,
      source: 'app',
    })
    return ok(result, { status: 201 })
  })

  // Alert feed, newest first, optional ?status= and ?type= filters.
  router.get('/alerts', async (ctx) => {
    const clauses = ['patient_id = ?']
    const params = [ctx.auth.patient.id]
    if (ctx.query.status) { clauses.push('status = ?'); params.push(ctx.query.status) }
    if (ctx.query.type) { clauses.push('type = ?'); params.push(ctx.query.type) }
    const rows = await ctx.db.all(
      `SELECT * FROM alerts WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 200`,
      params,
    )
    return ok({ alerts: rows.map(toPublicAlert) })
  })

  // Resolve or cancel an alert.
  router.patch('/alerts/:id', async (ctx) => {
    const existing = await ctx.db.first(
      'SELECT id FROM alerts WHERE id = ? AND patient_id = ?',
      [ctx.params.id, ctx.auth.patient.id],
    )
    if (!existing) throw notFound('Alert not found.')
    const body = await readJsonBody(ctx.request)
    const v = new Validator(body)
    v.enum('status', ['open', 'resolved', 'cancelled'], { required: true })
    const input = v.ensureValid()
    const resolvedAt = input.status === 'open' ? null : nowIso()
    await ctx.db.run(
      'UPDATE alerts SET status = ?, resolved_at = ? WHERE id = ?',
      [input.status, resolvedAt, existing.id],
    )
    const row = await ctx.db.first('SELECT * FROM alerts WHERE id = ?', [existing.id])
    return ok({ alert: toPublicAlert(row) })
  })

  // Notification history for a specific alert (row #18).
  router.get('/alerts/:id/notifications', async (ctx) => {
    const rows = await ctx.db.all(
      'SELECT * FROM notifications WHERE alert_id = ? AND patient_id = ? ORDER BY created_at DESC',
      [ctx.params.id, ctx.auth.patient.id],
    )
    return ok({ notifications: rows.map(toPublicNotification) })
  })

  // Full notification history (row #18), optional ?channel= and ?status= filters.
  router.get('/notifications', async (ctx) => {
    const clauses = ['patient_id = ?']
    const params = [ctx.auth.patient.id]
    if (ctx.query.channel) { clauses.push('channel = ?'); params.push(ctx.query.channel) }
    if (ctx.query.status) { clauses.push('status = ?'); params.push(ctx.query.status) }
    const rows = await ctx.db.all(
      `SELECT * FROM notifications WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT 200`,
      params,
    )
    return ok({ notifications: rows.map(toPublicNotification) })
  })
}
