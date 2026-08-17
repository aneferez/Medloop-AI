import { describe, expect, it } from 'vitest'
import { __test } from '../worker/src/routes/sync.js'

const { sanitizeFamily, sanitizeMedicine, sanitizeDose, sanitizePrescription, sanitizeAppointment, deleteMissing } = __test

describe('sync — family sanitizer', () => {
  it('drops records missing an id or name', () => {
    expect(sanitizeFamily({ name: 'No id' })).toBeNull()
    expect(sanitizeFamily({ id: 'x', name: '  ' })).toBeNull()
  })

  it('keeps valid E.164 numbers and nulls invalid ones', () => {
    const clean = sanitizeFamily({ id: 'f1', name: 'Asha', phone: '+14155550123', whatsappNumber: 'not-a-number' })
    expect(clean.phone).toBe('+14155550123')
    expect(clean.whatsappNumber).toBeNull()
  })

  it('falls back to Level 3 and coerces flags to 0/1', () => {
    const clean = sanitizeFamily({ id: 'f1', name: 'Asha', alertLevel: 'Level 9', isPrimaryEmergency: true })
    expect(clean.alertLevel).toBe('Level 3')
    expect(clean.isPrimaryEmergency).toBe(1)
    expect(clean.notifyPush).toBe(1)
  })
})

describe('sync — medicine sanitizer', () => {
  const familyIds = new Set(['f1'])

  it('gates member_id against the known family set', () => {
    expect(sanitizeMedicine({ id: 'm', name: 'A', memberId: 'f1' }, familyIds).memberId).toBe('f1')
    expect(sanitizeMedicine({ id: 'm', name: 'A', memberId: 'ghost' }, familyIds).memberId).toBeNull()
  })

  it('filters enabled periods and serializes them to JSON', () => {
    const clean = sanitizeMedicine({ id: 'm', name: 'A', enabledPeriods: ['morning', 'noon', 'night'] }, familyIds)
    expect(clean.enabledPeriods).toBe('["morning","night"]')
  })

  it('coerces stock to a non-negative integer or null', () => {
    expect(sanitizeMedicine({ id: 'm', name: 'A', stockRemaining: 12.9 }, familyIds).stockRemaining).toBe(12)
    expect(sanitizeMedicine({ id: 'm', name: 'A', stockRemaining: -4 }, familyIds).stockRemaining).toBe(0)
    expect(sanitizeMedicine({ id: 'm', name: 'A', stockRemaining: null }, familyIds).stockRemaining).toBeNull()
  })
})

describe('sync — dose sanitizer', () => {
  it('requires id, valid status, and a valid date', () => {
    expect(sanitizeDose({ status: 'taken', doseDate: '2026-08-16' })).toBeNull()
    expect(sanitizeDose({ id: 'd', status: 'nope', doseDate: '2026-08-16' })).toBeNull()
    expect(sanitizeDose({ id: 'd', status: 'taken', doseDate: 'bad' })).toBeNull()
  })

  it('derives takenAt from recordedAt for taken doses', () => {
    const clean = sanitizeDose({ id: 'd', status: 'taken', doseDate: '2026-08-16', recordedAt: 't', dosePeriod: 'morning' })
    expect(clean.takenAt).toBe('t')
    expect(clean.dosePeriod).toBe('morning')
  })
})

describe('sync — prescription + appointment sanitizers', () => {
  it('requires an id for a prescription', () => {
    expect(sanitizePrescription({ doctor: 'Dr K' })).toBeNull()
    expect(sanitizePrescription({ id: 'p1', doctor: 'Dr K' })).toMatchObject({ id: 'p1', doctor: 'Dr K', notes: '' })
  })

  it('requires id + valid date for an appointment and defaults clinic/time', () => {
    expect(sanitizeAppointment({ id: 'a1' })).toBeNull()
    expect(sanitizeAppointment({ id: 'a1', date: 'bad' })).toBeNull()
    expect(sanitizeAppointment({ id: 'a1', date: '2026-09-01' })).toEqual({ id: 'a1', doctor: '', clinic: 'Clinic', date: '2026-09-01', time: '09:00' })
  })
})

describe('sync — deleteMissing', () => {
  it('deletes everything for the patient when no ids remain', () => {
    const stmt = deleteMissing('family_members', 'p1', [])
    expect(stmt.sql).toBe('DELETE FROM family_members WHERE patient_id = ?')
    expect(stmt.params).toEqual(['p1'])
  })

  it('excludes the surviving ids with a NOT IN clause', () => {
    const stmt = deleteMissing('medicines', 'p1', ['a', 'b'])
    expect(stmt.sql).toBe('DELETE FROM medicines WHERE patient_id = ? AND id NOT IN (?, ?)')
    expect(stmt.params).toEqual(['p1', 'a', 'b'])
  })
})
