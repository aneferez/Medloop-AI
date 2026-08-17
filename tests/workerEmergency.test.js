import { describe, expect, it } from 'vitest'
import { buildEmergencyMessage, emergencyCallLink, EMERGENCY_STATUSES, toPublicEmergencyEvent } from '../worker/src/domain/emergency.js'
import { planEmergencyNotifications } from '../worker/src/domain/notifications.js'

const member = (over = {}) => ({
  id: 'f1',
  fcm_token: 'ftoken',
  whatsapp_number: '+14155550123',
  notify_push: 0, // opted OUT — emergency should override this
  notify_whatsapp: 0,
  ...over,
})

describe('emergency planning (rows #20, #22)', () => {
  it('pushes to every family device regardless of per-member opt-in', () => {
    const plans = planEmergencyNotifications({ familyMembers: [member()], settings: {} })
    expect(plans).toEqual([{ recipientType: 'family', recipientId: 'f1', channel: 'push', target: 'ftoken' }])
  })

  it('includes patient devices with a token', () => {
    const plans = planEmergencyNotifications({ patientDevices: [{ id: 'd1', fcm_token: 'tok' }], settings: {} })
    expect(plans[0]).toEqual({ recipientType: 'patient', recipientId: 'd1', channel: 'push', target: 'tok' })
  })

  it('adds WhatsApp only when the patient enables it globally (cost control)', () => {
    expect(planEmergencyNotifications({ familyMembers: [member()], settings: {} }).some((p) => p.channel === 'whatsapp')).toBe(false)
    const withWa = planEmergencyNotifications({ familyMembers: [member()], settings: { whatsapp_enabled: 1 } })
    expect(withWa.some((p) => p.channel === 'whatsapp' && p.target === '+14155550123')).toBe(true)
  })
})

describe('emergency message + call link (rows #21, #22)', () => {
  it('builds an SOS message with and without a note', () => {
    expect(buildEmergencyMessage('Asha', 'chest pain')).toEqual({
      title: 'Emergency SOS from Asha',
      detail: 'Asha triggered an emergency SOS: chest pain',
    })
    expect(buildEmergencyMessage('', '')).toEqual({
      title: 'Emergency SOS from A MedLoop user',
      detail: 'A MedLoop user triggered an emergency SOS. Please respond immediately.',
    })
  })

  it('produces a tel: call link only when a phone exists', () => {
    expect(emergencyCallLink({ phone: '+14155550123' })).toBe('tel:+14155550123')
    expect(emergencyCallLink({ phone: null })).toBeNull()
    expect(emergencyCallLink(null)).toBeNull()
  })
})

describe('emergency event shape', () => {
  it('exposes the lifecycle statuses', () => {
    expect(EMERGENCY_STATUSES).toEqual(['pending_confirm', 'confirmed', 'cancelled', 'resolved'])
  })

  it('parses the channels JSON column', () => {
    const shaped = toPublicEmergencyEvent({
      id: 'e1', status: 'confirmed', primary_contact_id: 'f1', channels: '["push","whatsapp"]',
      note: 'help', triggered_at: 't1', confirmed_at: 't2', resolved_at: null,
    })
    expect(shaped).toMatchObject({ id: 'e1', status: 'confirmed', primaryContactId: 'f1', channels: ['push', 'whatsapp'], note: 'help' })
  })
})
