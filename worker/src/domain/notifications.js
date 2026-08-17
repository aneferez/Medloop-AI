// Notification planning (rows #15, #16, #17) — pure. Decides which recipient +
// channel pairs to attempt for an alert, honoring channel preferences. No I/O.

// FCM push is the primary channel (row #15); WhatsApp is opt-in secondary to
// avoid recurring cost (row #16); email is opt-in tertiary.
export const CHANNEL_PRIORITY = ['push', 'whatsapp', 'email']

const on = (value, dflt = false) => (value == null ? dflt : Boolean(value))

// Inputs are raw D1 rows so this composes with the family/device queries.
//   patientDevices: [{ id, fcm_token }]
//   familyMembers:  [{ id, fcm_token, whatsapp_number, email, notify_* }]
//   settings:       patient_settings row (push/whatsapp/email _enabled)
export function planNotifications({ patientDevices = [], familyMembers = [], settings = {} }) {
  const pushOn = on(settings.push_enabled, true)
  const whatsappOn = on(settings.whatsapp_enabled, false)
  const emailOn = on(settings.email_enabled, false)
  const plans = []

  // The patient's own devices only ever receive push.
  if (pushOn) {
    for (const device of patientDevices) {
      if (device.fcm_token) {
        plans.push({ recipientType: 'patient', recipientId: device.id, channel: 'push', target: device.fcm_token })
      }
    }
  }

  // Family members receive each channel they have opted into and have a target
  // for, gated by the patient's global channel switches.
  for (const member of familyMembers) {
    if (pushOn && member.notify_push && member.fcm_token) {
      plans.push({ recipientType: 'family', recipientId: member.id, channel: 'push', target: member.fcm_token })
    }
    if (whatsappOn && member.notify_whatsapp && member.whatsapp_number) {
      plans.push({ recipientType: 'family', recipientId: member.id, channel: 'whatsapp', target: member.whatsapp_number })
    }
    if (emailOn && member.notify_email && member.email) {
      plans.push({ recipientType: 'family', recipientId: member.id, channel: 'email', target: member.email })
    }
  }

  return plans
}

// Emergency planning (rows #20, #22). Overrides per-member opt-in: an SOS
// pushes to every device with a token. WhatsApp still respects the patient's
// global switch (cost control) but ignores the per-member WhatsApp preference.
export function planEmergencyNotifications({ patientDevices = [], familyMembers = [], settings = {} }) {
  const whatsappOn = Boolean(settings.whatsapp_enabled)
  const plans = []
  for (const device of patientDevices) {
    if (device.fcm_token) {
      plans.push({ recipientType: 'patient', recipientId: device.id, channel: 'push', target: device.fcm_token })
    }
  }
  for (const member of familyMembers) {
    if (member.fcm_token) {
      plans.push({ recipientType: 'family', recipientId: member.id, channel: 'push', target: member.fcm_token })
    }
    if (whatsappOn && member.whatsapp_number) {
      plans.push({ recipientType: 'family', recipientId: member.id, channel: 'whatsapp', target: member.whatsapp_number })
    }
  }
  return plans
}

// Builds the push/WhatsApp message body from an alert.
export function alertMessage({ title, detail }) {
  const cleanTitle = String(title || 'MedLoop alert').trim()
  const cleanDetail = String(detail || '').trim()
  return {
    title: cleanTitle,
    body: cleanDetail || cleanTitle,
  }
}

// Alert row -> API shape.
export function toPublicAlert(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    detail: row.detail ?? '',
    level: row.level,
    status: row.status,
    source: row.source,
    refId: row.ref_id ?? null,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? null,
  }
}

// Notification row -> API shape (row #18 history entry).
export function toPublicNotification(row) {
  return {
    id: row.id,
    alertId: row.alert_id ?? null,
    recipientType: row.recipient_type,
    recipientId: row.recipient_id ?? null,
    channel: row.channel,
    type: row.type,
    status: row.status,
    providerRef: row.provider_ref ?? null,
    error: row.error ?? null,
    createdAt: row.created_at,
    sentAt: row.sent_at ?? null,
  }
}
