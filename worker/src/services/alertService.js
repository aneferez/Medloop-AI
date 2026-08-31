import { newId, nowIso } from '../lib/ids.js'
import { alertMessage, planNotifications, toPublicAlert } from '../domain/notifications.js'
import { selectMembersAtLevel, selectMembersForAlertLevel } from '../domain/family.js'
import { sendChannel } from '../channels/index.js'

// The Notification & Alert Service (row #3). Creates an alert, resolves
// recipients, dispatches across every enabled channel, and records a history
// row per attempt (row #18). Reused by app-triggered alerts (Module C),
// scheduled jobs (Module E), and the emergency flow (Module F).
//
// audience: 'by-level' notifies family at or above the alert level; 'at-level'
// notifies only members whose level is exactly this one (staggered escalation,
// feature #7); 'all' notifies every family member (used for emergencies).
//
// pushMessage: an optional generic { title, body } used for the OUTBOUND channel
// message instead of the alert's own title/detail. Missed-dose escalation passes
// this so the push carries NO medicine name (guardrail G3) while the in-app alert
// still holds the specifics.
export async function createAndDispatchAlert(ctx, {
  type,
  title,
  detail = '',
  level = 'Level 3',
  source = 'app',
  refId = null,
  audience = 'by-level',
  planner = planNotifications,
  pushMessage = null,
}) {
  const patientId = ctx.auth.patient.id
  const alertId = newId()
  const createdAt = nowIso()

  await ctx.db.run(
    `INSERT INTO alerts (id, patient_id, type, title, detail, level, status, source, ref_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
    [alertId, patientId, type, title, detail, level, source, refId, createdAt],
  )

  const notifications = await dispatchAlert(ctx, { alertId, type, title, detail, level, audience, planner, pushMessage })
  const alertRow = await ctx.db.first('SELECT * FROM alerts WHERE id = ?', [alertId])
  return { alert: toPublicAlert(alertRow), notifications }
}

// Dispatches an already-created alert. Returns the recorded notification rows.
// `planner` selects recipient+channel pairs; emergencies pass a wider planner.
export async function dispatchAlert(ctx, { alertId, type, title, detail = '', level = 'Level 3', audience = 'by-level', planner = planNotifications, pushMessage = null }) {
  const patientId = ctx.auth.patient.id

  const devices = await ctx.db.all(
    'SELECT id, fcm_token FROM devices WHERE patient_id = ? AND revoked_at IS NULL',
    [patientId],
  )
  const allFamily = await ctx.db.all('SELECT * FROM family_members WHERE patient_id = ?', [patientId])
  const familyMembers = audience === 'all'
    ? allFamily
    : audience === 'at-level'
      ? selectMembersAtLevel(allFamily, level)
      : selectMembersForAlertLevel(allFamily, level)
  const settings = (await ctx.db.first('SELECT * FROM patient_settings WHERE patient_id = ?', [patientId])) || {}

  const plans = planner({ patientDevices: devices, familyMembers, settings })

  // Family network (features #6/#7): a linked caregiver may have no contact-level
  // fcm_token of their own, so also push to their account's devices. Gated by the
  // patient's global push switch, except for emergencies (audience 'all').
  const pushOn = audience === 'all' || settings.push_enabled == null || Boolean(settings.push_enabled)
  if (pushOn) {
    for (const member of familyMembers) {
      if (!member.user_id) continue
      const linkedDevices = await ctx.db.all(
        'SELECT fcm_token FROM devices WHERE user_id = ? AND revoked_at IS NULL AND fcm_token IS NOT NULL',
        [member.user_id],
      )
      for (const device of linkedDevices) {
        plans.push({ recipientType: 'family', recipientId: member.id, channel: 'push', target: device.fcm_token })
      }
    }
  }

  // Never send the same channel+target twice in one dispatch (#13).
  const seen = new Set()
  const uniquePlans = plans.filter((plan) => {
    const key = `${plan.channel}:${plan.target}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const message = pushMessage
    ? { title: String(pushMessage.title || 'MedLoop alert'), body: String(pushMessage.body || pushMessage.title || 'MedLoop alert') }
    : alertMessage({ title, detail })
  const results = []

  for (const plan of uniquePlans) {
    const outcome = await sendChannel(ctx.env, plan.channel, plan.target, {
      ...message,
      data: { alertId, type, level },
    })
    const notificationId = newId()
    const now = nowIso()
    await ctx.db.run(
      `INSERT INTO notifications
         (id, patient_id, alert_id, recipient_type, recipient_id, channel, type, status, detail, provider_ref, error, created_at, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        notificationId, patientId, alertId, plan.recipientType, plan.recipientId, plan.channel, type,
        outcome.status, detail, outcome.providerRef || null, outcome.error || null, now,
        outcome.status === 'sent' ? now : null,
      ],
    )
    results.push({
      id: notificationId,
      recipientType: plan.recipientType,
      recipientId: plan.recipientId,
      channel: plan.channel,
      status: outcome.status,
      error: outcome.error || null,
    })
  }

  return results
}
