// Version the acknowledgement so policy or safety copy changes can require a
// fresh response without storing the full consent text alongside health data.
export const CURRENT_CONSENT_VERSION = '2026-08-30-v1'

export function hasCurrentConsent(settings = {}) {
  return settings?.consentVersion === CURRENT_CONSENT_VERSION
    && typeof settings?.consentAcceptedAt === 'string'
    && Boolean(settings.consentAcceptedAt)
}

export function acceptCurrentConsent(settings = {}, acceptedAt = new Date().toISOString()) {
  return {
    ...settings,
    consentVersion: CURRENT_CONSENT_VERSION,
    consentAcceptedAt: acceptedAt,
  }
}
