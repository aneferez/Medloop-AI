import { describe, expect, it } from 'vitest'
import { alertMessage, CHANNEL_PRIORITY, planNotifications, toPublicAlert, toPublicNotification } from '../worker/src/domain/notifications.js'
import { buildGenericPushMessage } from '../worker/src/services/alertService.js'

const familyMember = (over = {}) => ({
  id: 'f1',
  fcm_token: 'ftoken',
  whatsapp_number: '+14155550123',
  email: 'kin@example.com',
  notify_push: 1,
  notify_whatsapp: 0,
  notify_email: 0,
  ...over,
})

describe('notification planning — channel priority', () => {
  it('lists push first, then whatsapp, then email', () => {
    expect(CHANNEL_PRIORITY).toEqual(['push', 'whatsapp', 'email'])
  })

  it('pushes to patient devices with a token when push is enabled (default)', () => {
    const plans = planNotifications({
      patientDevices: [{ id: 'd1', fcm_token: 'tok' }, { id: 'd2', fcm_token: null }],
      familyMembers: [],
      settings: {},
    })
    expect(plans).toEqual([{ recipientType: 'patient', recipientId: 'd1', channel: 'push', target: 'tok' }])
  })

  it('suppresses all push when push is globally disabled', () => {
    const plans = planNotifications({
      patientDevices: [{ id: 'd1', fcm_token: 'tok' }],
      familyMembers: [familyMember()],
      settings: { push_enabled: 0 },
    })
    expect(plans).toEqual([])
  })
})

describe('notification planning — family channels (rows #16, #17)', () => {
  it('routes push to opted-in family members with a token', () => {
    const plans = planNotifications({ familyMembers: [familyMember()], settings: {} })
    expect(plans).toEqual([{ recipientType: 'family', recipientId: 'f1', channel: 'push', target: 'ftoken' }])
  })

  it('only sends WhatsApp when the member opts in AND the patient enables it', () => {
    const memberOptedIn = familyMember({ notify_push: 0, notify_whatsapp: 1 })
    const withoutGlobal = planNotifications({ familyMembers: [memberOptedIn], settings: {} })
    expect(withoutGlobal).toEqual([])

    const withGlobal = planNotifications({ familyMembers: [memberOptedIn], settings: { whatsapp_enabled: 1 } })
    expect(withGlobal).toEqual([{ recipientType: 'family', recipientId: 'f1', channel: 'whatsapp', target: '+14155550123' }])
  })

  it('sends multiple channels when a member opts into several', () => {
    const member = familyMember({ notify_push: 1, notify_whatsapp: 1, notify_email: 1 })
    const plans = planNotifications({
      familyMembers: [member],
      settings: { push_enabled: 1, whatsapp_enabled: 1, email_enabled: 1 },
    })
    expect(plans.map((p) => p.channel)).toEqual(['push', 'whatsapp', 'email'])
  })

  it('skips channels the member has no target for', () => {
    const member = familyMember({ notify_push: 1, fcm_token: null, notify_whatsapp: 1, whatsapp_number: null })
    const plans = planNotifications({ familyMembers: [member], settings: { whatsapp_enabled: 1 } })
    expect(plans).toEqual([])
  })
})

describe('notification message + shapes', () => {
  it('builds a message, falling back to the title for the body', () => {
    expect(alertMessage({ title: 'Low stock', detail: 'Metformin: 3 left' })).toEqual({ title: 'Low stock', body: 'Metformin: 3 left' })
    expect(alertMessage({ title: 'SOS' })).toEqual({ title: 'SOS', body: 'SOS' })
    expect(alertMessage({})).toEqual({ title: 'MedLoop alert', body: 'MedLoop alert' })
  })

  it('keeps medicine and patient details out of every FCM message', () => {
    expect(buildGenericPushMessage({
      type: 'medicine',
      level: 'Level 2',
    })).toEqual({
      title: 'MedLoop care escalation',
      body: 'A medication check needs attention. Open MedLoop to review.',
    })
    expect(buildGenericPushMessage({ type: 'emergency', level: 'Level 3' })).toEqual({
      title: 'MedLoop emergency update',
      body: 'An emergency contact update needs attention. Open MedLoop now.',
    })
  })

  it('maps alert and notification rows to API shapes', () => {
    const alert = toPublicAlert({ id: 'a', type: 'stock', title: 'Low', detail: '', level: 'Level 2', status: 'open', source: 'cron', ref_id: 'm1', created_at: 't', resolved_at: null })
    expect(alert).toMatchObject({ id: 'a', type: 'stock', refId: 'm1', level: 'Level 2', status: 'open' })

    const notif = toPublicNotification({ id: 'n', alert_id: 'a', recipient_type: 'family', recipient_id: 'f1', channel: 'push', type: 'stock', status: 'sent', provider_ref: 'x', error: null, created_at: 't', sent_at: 't' })
    expect(notif).toMatchObject({ id: 'n', alertId: 'a', channel: 'push', status: 'sent', providerRef: 'x' })
  })
})
