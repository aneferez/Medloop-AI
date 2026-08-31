import { describe, expect, it } from 'vitest'
import { acceptCurrentConsent, CURRENT_CONSENT_VERSION, hasCurrentConsent } from '../src/lib/consent'

describe('consent gate', () => {
  it('requires the current version and a timestamp', () => {
    expect(hasCurrentConsent({})).toBe(false)
    expect(hasCurrentConsent({ consentVersion: CURRENT_CONSENT_VERSION })).toBe(false)
    expect(hasCurrentConsent({ consentVersion: 'old', consentAcceptedAt: '2026-08-30T00:00:00.000Z' })).toBe(false)
    expect(hasCurrentConsent({ consentVersion: CURRENT_CONSENT_VERSION, consentAcceptedAt: '2026-08-30T00:00:00.000Z' })).toBe(true)
  })

  it('records a versioned acknowledgement without changing unrelated settings', () => {
    const settings = { displayName: 'Maya', notificationsEnabled: true }
    expect(acceptCurrentConsent(settings, '2026-08-30T10:00:00.000Z')).toEqual({
      ...settings,
      consentVersion: CURRENT_CONSENT_VERSION,
      consentAcceptedAt: '2026-08-30T10:00:00.000Z',
    })
  })
})
