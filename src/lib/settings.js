const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^[+0-9 ()-]{7,20}$/
const DASHBOARD_VARIANTS = new Set(['ritual', 'halo', 'timeline', 'companion'])

export const defaultSettings = Object.freeze({
  displayName: '',
  email: '',
  reminderLeadMinutes: 10,
  notificationsEnabled: false,
  smsAlerts: false,
  whatsappAlerts: false,
  dashboardVariant: 'ritual',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
  doseGraceMinutes: 15,
  l2EscalationMinutes: 30,
  escalationEnabled: true,
  consentVersion: '',
  consentAcceptedAt: '',
})

export function validateSettingsForm(form) {
  const errors = {}
  const displayName = String(form?.displayName ?? '').trim()
  const email = String(form?.email ?? '').trim()
  const reminderLeadMinutesRaw = String(form?.reminderLeadMinutes ?? '').trim()

  if (displayName.length > 60) {
    errors.displayName = 'Display name must be 60 characters or fewer.'
  }

  if (email && !EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (reminderLeadMinutesRaw === '') {
    errors.reminderLeadMinutes = 'Reminder lead time is required.'
  } else if (!/^\d+$/.test(reminderLeadMinutesRaw)) {
    errors.reminderLeadMinutes = 'Reminder lead time must be a whole number.'
  } else {
    const minutes = Number(reminderLeadMinutesRaw)
    if (minutes < 0 || minutes > 240) {
      errors.reminderLeadMinutes = 'Reminder lead time must be between 0 and 240 minutes.'
    }
  }

  const doseGraceMinutes = Number(form?.doseGraceMinutes ?? defaultSettings.doseGraceMinutes)
  const l2EscalationMinutes = Number(form?.l2EscalationMinutes ?? defaultSettings.l2EscalationMinutes)
  if (!Number.isInteger(doseGraceMinutes) || doseGraceMinutes < 1 || doseGraceMinutes > 240) {
    errors.doseGraceMinutes = 'Level 1 escalation must be between 1 and 240 minutes.'
  }
  if (!Number.isInteger(l2EscalationMinutes) || l2EscalationMinutes < 2 || l2EscalationMinutes > 480) {
    errors.l2EscalationMinutes = 'Level 2 escalation must be between 2 and 480 minutes.'
  }

  return errors
}

export function sanitizeSettings(form) {
  const reminderLeadMinutes = Number(
    String(form?.reminderLeadMinutes ?? '').trim() || 0,
  )

  return {
    displayName: String(form?.displayName ?? '').trim().slice(0, 60),
    email: String(form?.email ?? '').trim().toLowerCase(),
    reminderLeadMinutes: Number.isFinite(reminderLeadMinutes)
      ? Math.min(240, Math.max(0, reminderLeadMinutes))
      : defaultSettings.reminderLeadMinutes,
    notificationsEnabled: Boolean(form?.notificationsEnabled),
    smsAlerts: Boolean(form?.smsAlerts),
    whatsappAlerts: Boolean(form?.whatsappAlerts),
    dashboardVariant: DASHBOARD_VARIANTS.has(form?.dashboardVariant) ? form.dashboardVariant : defaultSettings.dashboardVariant,
    timezone: String(form?.timezone || defaultSettings.timezone).trim().slice(0, 64),
    doseGraceMinutes: Math.min(240, Math.max(1, Math.round(Number(form?.doseGraceMinutes ?? defaultSettings.doseGraceMinutes) || defaultSettings.doseGraceMinutes))),
    l2EscalationMinutes: Math.min(480, Math.max(2, Math.round(Number(form?.l2EscalationMinutes ?? defaultSettings.l2EscalationMinutes) || defaultSettings.l2EscalationMinutes))),
    escalationEnabled: form?.escalationEnabled !== false,
    consentVersion: String(form?.consentVersion ?? '').trim().slice(0, 40),
    consentAcceptedAt: String(form?.consentAcceptedAt ?? '').trim().slice(0, 80),
  }
}

export function isValidSmsPhone(phone) {
  return PHONE_PATTERN.test(String(phone || '').trim()) && /^\+[1-9]\d{7,14}$/.test(String(phone || '').trim())
}

export function isValidWhatsAppPhone(phone) {
  return isValidSmsPhone(phone)
}

export function settingsForUser(settings, user) {
  const normalized = sanitizeSettings({ ...defaultSettings, ...settings })
  return {
    ...normalized,
    displayName: normalized.displayName || String(user?.displayName || '').trim(),
    email: normalized.email || String(user?.email || '').trim().toLowerCase(),
  }
}
