import { describe, expect, it } from 'vitest'
import {
  appointmentToCloud,
  buildSyncSnapshot,
  doseLogToCloud,
  familyMemberToCloud,
  medicineToCloud,
  prescriptionToCloud,
  settingsToCloud,
} from '../src/lib/cloud/mappers'

describe('cloud mappers — family', () => {
  it('maps a Level 1 member to the primary emergency contact with derived channels', () => {
    const cloud = familyMemberToCloud({
      id: 'f1', name: 'Asha', relationship: 'Daughter',
      phone: '+14155550123', whatsappNumber: '+14155550123',
      alertLevel: 'Level 1', age: '34', bloodGroup: 'O+', allergies: 'None',
    })
    expect(cloud).toMatchObject({
      id: 'f1', isPrimaryEmergency: true, notifyPush: true, notifyWhatsapp: true, notifySms: true,
    })
  })

  it('nulls empty phone/whatsapp and clears the sms/whatsapp opt-ins', () => {
    const cloud = familyMemberToCloud({ id: 'f2', name: 'Ravi', alertLevel: 'Level 3', phone: '', whatsappNumber: '' })
    expect(cloud).toMatchObject({ phone: null, whatsappNumber: null, notifySms: false, notifyWhatsapp: false, isPrimaryEmergency: false })
  })
})

describe('cloud mappers — medicine', () => {
  const familyIds = new Set(['f1'])

  it('converts the refill string to a boolean and keeps enabled periods', () => {
    expect(medicineToCloud({ id: 'm', name: 'A', refill: 'Running low', enabledDosePeriods: ['morning', 'night'] }, familyIds).refill).toBe(true)
    expect(medicineToCloud({ id: 'm', name: 'A', refill: 'On track' }, familyIds).refill).toBe(false)
  })

  it('keeps memberId only when the member is present, else null', () => {
    expect(medicineToCloud({ id: 'm', name: 'A', memberId: 'f1' }, familyIds).memberId).toBe('f1')
    expect(medicineToCloud({ id: 'm', name: 'A', memberId: 'gone' }, familyIds).memberId).toBeNull()
  })

  it('passes tracked stock through and nulls untracked stock', () => {
    expect(medicineToCloud({ id: 'm', name: 'A', stockRemaining: 12 }, familyIds).stockRemaining).toBe(12)
    expect(medicineToCloud({ id: 'm', name: 'A', stockRemaining: null }, familyIds).stockRemaining).toBeNull()
  })
})

describe('cloud mappers — dose logs + settings', () => {
  it('timestamps only taken doses', () => {
    expect(doseLogToCloud({ id: 'd', status: 'taken', doseDate: '2026-08-16', recordedAt: 't' }).takenAt).toBe('t')
    expect(doseLogToCloud({ id: 'd', status: 'missed', doseDate: '2026-08-16', recordedAt: 't' }).takenAt).toBeNull()
  })

  it('maps local notification settings to cloud channel flags', () => {
    expect(settingsToCloud({ notificationsEnabled: true, whatsappAlerts: true, reminderLeadMinutes: 15 })).toEqual({
      reminderLeadMinutes: 15, pushEnabled: true, whatsappEnabled: true, emailEnabled: false,
    })
  })
})

describe('cloud mappers — snapshot', () => {
  it('assembles a full snapshot with aligned member references', () => {
    const snapshot = buildSyncSnapshot({
      familyMembers: [{ id: 'f1', name: 'Asha', alertLevel: 'Level 1' }],
      medicines: [{ id: 'm1', name: 'Metformin', memberId: 'f1', enabledDosePeriods: ['morning'] }],
      doseLogs: [{ id: 'd1', status: 'taken', doseDate: '2026-08-16', recordedAt: 't', medicineId: 'm1' }],
      settings: { notificationsEnabled: true },
    })
    expect(snapshot.familyMembers).toHaveLength(1)
    expect(snapshot.medicines[0].memberId).toBe('f1')
    expect(snapshot.doseLogs[0].takenAt).toBe('t')
    expect(snapshot.settings.pushEnabled).toBe(true)
  })

  it('tolerates an empty/partial state', () => {
    const snapshot = buildSyncSnapshot({})
    expect(snapshot).toEqual({ familyMembers: [], medicines: [], prescriptions: [], appointments: [], doseLogs: [], settings: { reminderLeadMinutes: 0, pushEnabled: false, whatsappEnabled: false, emailEnabled: false } })
  })
})

describe('cloud mappers — prescriptions + appointments', () => {
  it('maps a prescription without a file key', () => {
    expect(prescriptionToCloud({ id: 'p1', doctor: 'Dr K', clinic: 'City Clinic', notes: 'Take with food' }))
      .toEqual({ id: 'p1', doctor: 'Dr K', clinic: 'City Clinic', notes: 'Take with food' })
  })

  it('maps an appointment, filling clinic/time defaults', () => {
    expect(appointmentToCloud({ id: 'a1', doctor: 'Dr K', date: '2026-09-01' }))
      .toEqual({ id: 'a1', doctor: 'Dr K', clinic: 'Clinic', date: '2026-09-01', time: '09:00' })
  })

  it('includes prescriptions and appointments in the snapshot', () => {
    const snapshot = buildSyncSnapshot({
      prescriptions: [{ id: 'p1', doctor: 'Dr K' }],
      appointments: [{ id: 'a1', doctor: 'Dr K', date: '2026-09-01' }],
    })
    expect(snapshot.prescriptions[0].id).toBe('p1')
    expect(snapshot.appointments[0].date).toBe('2026-09-01')
  })
})
