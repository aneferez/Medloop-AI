import { badRequest, notFound } from '../lib/errors.js'
import { newId, nowIso } from '../lib/ids.js'
import { selectPrimaryEmergencyContact, toPublicFamilyMember } from '../domain/family.js'
import { buildEmergencyMessage, emergencyCallLink, toPublicEmergencyEvent } from '../domain/emergency.js'
import { planEmergencyNotifications } from '../domain/notifications.js'
import { createAndDispatchAlert } from './alertService.js'

async function resolvePrimaryContact(ctx) {
  const rows = await ctx.db.all('SELECT * FROM family_members WHERE patient_id = ?', [ctx.auth.patient.id])
  const row = selectPrimaryEmergencyContact(rows)
  return row ? toPublicFamilyMember(row) : null
}

// Row #20 + #23: raise an SOS in the "pending_confirm" state. No alerts are sent
// yet — the app must confirm first to prevent accidental alerts. The primary
// contact + call link are returned so the app can offer the one-tap call (#21)
// immediately, independent of confirmation.
export async function createEmergency(ctx, { note = '' } = {}) {
  const id = newId()
  const now = nowIso()
  const contact = await resolvePrimaryContact(ctx)
  await ctx.db.run(
    `INSERT INTO emergency_events (id, patient_id, status, primary_contact_id, channels, note, triggered_at)
     VALUES (?, ?, 'pending_confirm', ?, '[]', ?, ?)`,
    [id, ctx.auth.patient.id, contact ? contact.id : null, note || null, now],
  )
  const row = await ctx.db.first('SELECT * FROM emergency_events WHERE id = ?', [id])
  return {
    event: toPublicEmergencyEvent(row),
    primaryContact: contact,
    callLink: emergencyCallLink(contact),
    requiresConfirmation: true,
  }
}

// Row #22: confirm the SOS and alert all family through every available channel.
export async function confirmEmergency(ctx, eventId) {
  const event = await ctx.db.first(
    'SELECT * FROM emergency_events WHERE id = ? AND patient_id = ?',
    [eventId, ctx.auth.patient.id],
  )
  if (!event) throw notFound('Emergency event not found.')
  if (event.status === 'cancelled') throw badRequest('This emergency was already cancelled.')

  const contact = await resolvePrimaryContact(ctx)
  const message = buildEmergencyMessage(ctx.auth.patient.display_name, event.note)
  const { alert, notifications } = await createAndDispatchAlert(ctx, {
    type: 'emergency',
    title: message.title,
    detail: message.detail,
    level: 'Level 1',
    source: 'app',
    refId: event.id,
    audience: 'all',
    planner: planEmergencyNotifications,
  })

  const channels = [...new Set(notifications.map((notification) => notification.channel))]
  await ctx.db.run(
    'UPDATE emergency_events SET status = ?, confirmed_at = ?, primary_contact_id = ?, channels = ? WHERE id = ?',
    ['confirmed', nowIso(), contact ? contact.id : null, JSON.stringify(channels), event.id],
  )
  const row = await ctx.db.first('SELECT * FROM emergency_events WHERE id = ?', [event.id])
  return {
    event: toPublicEmergencyEvent(row),
    primaryContact: contact,
    callLink: emergencyCallLink(contact),
    alert,
    notifications,
  }
}

// Row #23: cancel an unconfirmed (or confirmed) SOS.
export async function cancelEmergency(ctx, eventId) {
  const event = await ctx.db.first(
    'SELECT id FROM emergency_events WHERE id = ? AND patient_id = ?',
    [eventId, ctx.auth.patient.id],
  )
  if (!event) throw notFound('Emergency event not found.')
  await ctx.db.run(
    'UPDATE emergency_events SET status = ?, resolved_at = ? WHERE id = ?',
    ['cancelled', nowIso(), event.id],
  )
  const row = await ctx.db.first('SELECT * FROM emergency_events WHERE id = ?', [event.id])
  return { event: toPublicEmergencyEvent(row) }
}
