import { describe, expect, it } from 'vitest'
import {
  FAMILY_ALERT_LEVELS,
  selectLatestUpdatedMember,
  selectMembersForAlertLevel,
  selectPrimaryEmergencyContact,
  toPublicFamilyMember,
} from '../worker/src/domain/family.js'

const member = (over = {}) => ({
  id: 'm1',
  name: 'Asha',
  relationship: 'Daughter',
  phone: '+14155550123',
  whatsapp_number: null,
  email: null,
  fcm_token: null,
  alert_level: 'Level 3',
  is_primary_emergency: 0,
  notify_push: 1,
  notify_whatsapp: 0,
  notify_email: 0,
  notify_sms: 0,
  age: null,
  blood_group: null,
  allergies: null,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
  ...over,
})

describe('family domain — latest updated (row #4)', () => {
  it('returns null for an empty family', () => {
    expect(selectLatestUpdatedMember([])).toBeNull()
  })

  it('picks the most recently updated member', () => {
    const a = member({ id: 'a', updated_at: '2026-08-10T00:00:00.000Z' })
    const b = member({ id: 'b', updated_at: '2026-08-15T00:00:00.000Z' })
    const c = member({ id: 'c', updated_at: '2026-08-05T00:00:00.000Z' })
    expect(selectLatestUpdatedMember([a, b, c]).id).toBe('b')
  })

  it('breaks update ties by most recently created', () => {
    const a = member({ id: 'a', updated_at: '2026-08-10T00:00:00.000Z', created_at: '2026-08-01T00:00:00.000Z' })
    const b = member({ id: 'b', updated_at: '2026-08-10T00:00:00.000Z', created_at: '2026-08-03T00:00:00.000Z' })
    expect(selectLatestUpdatedMember([a, b]).id).toBe('b')
  })
})

describe('family domain — primary emergency contact (row #19)', () => {
  it('prefers the explicit primary flag', () => {
    const a = member({ id: 'a', alert_level: 'Level 1', updated_at: '2026-08-20T00:00:00.000Z' })
    const b = member({ id: 'b', is_primary_emergency: 1, updated_at: '2026-08-05T00:00:00.000Z' })
    expect(selectPrimaryEmergencyContact([a, b]).id).toBe('b')
  })

  it('falls back to the Level 1 member when no explicit primary', () => {
    const a = member({ id: 'a', alert_level: 'Level 3' })
    const b = member({ id: 'b', alert_level: 'Level 1' })
    expect(selectPrimaryEmergencyContact([a, b]).id).toBe('b')
  })

  it('falls back to the latest updated when neither primary nor Level 1 exist', () => {
    const a = member({ id: 'a', alert_level: 'Level 2', updated_at: '2026-08-01T00:00:00.000Z' })
    const b = member({ id: 'b', alert_level: 'Level 3', updated_at: '2026-08-09T00:00:00.000Z' })
    expect(selectPrimaryEmergencyContact([a, b]).id).toBe('b')
  })

  it('returns null when there is no family', () => {
    expect(selectPrimaryEmergencyContact([])).toBeNull()
  })
})

describe('family domain — alert-level fan-out', () => {
  it('includes members at least as urgent as the alert', () => {
    const l1 = member({ id: 'l1', alert_level: 'Level 1' })
    const l2 = member({ id: 'l2', alert_level: 'Level 2' })
    const l3 = member({ id: 'l3', alert_level: 'Level 3' })
    expect(selectMembersForAlertLevel([l1, l2, l3], 'Level 2').map((m) => m.id)).toEqual(['l1', 'l2'])
    expect(selectMembersForAlertLevel([l1, l2, l3], 'Level 1').map((m) => m.id)).toEqual(['l1'])
    expect(selectMembersForAlertLevel([l1, l2, l3], 'Level 3').map((m) => m.id)).toEqual(['l1', 'l2', 'l3'])
  })

  it('exposes the canonical level ordering', () => {
    expect(FAMILY_ALERT_LEVELS).toEqual(['Level 1', 'Level 2', 'Level 3'])
  })
})

describe('family domain — public shape', () => {
  it('maps a row to camelCase with nested prefs and no raw token', () => {
    const shaped = toPublicFamilyMember(member({ fcm_token: 'secret', notify_whatsapp: 1, is_primary_emergency: 1 }))
    expect(shaped).toMatchObject({
      id: 'm1',
      name: 'Asha',
      whatsappNumber: null,
      hasFcmToken: true,
      isPrimaryEmergency: true,
      notify: { push: true, whatsapp: true, email: false, sms: false },
    })
    expect(shaped.fcm_token).toBeUndefined()
    expect('fcmToken' in shaped).toBe(false)
  })
})
