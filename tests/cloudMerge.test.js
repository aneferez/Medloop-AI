import { describe, expect, it } from 'vitest'
import {
  appointmentFromCloud,
  buildSyncSnapshot,
  medicineFromCloud,
  mergeCloudSnapshot,
} from '../src/lib/cloud/mappers'

// The merge is what stops a second device from starting empty and pushing that
// emptiness over the account, so the cases below are about what survives.

const cloudSnapshot = {
  familyMembers: [{ id: 'f1', name: 'Asha', relationship: 'Mother', alertLevel: 'Level 1' }],
  medicines: [{ id: 'm1', name: 'Metformin', memberId: 'f1', enabledPeriods: ['morning'], refill: true, stockRemaining: 20 }],
  prescriptions: [{ id: 'p1', doctor: 'Dr Rao', clinic: 'City', notes: 'twice daily' }],
  appointments: [{ id: 'a1', doctor: 'Dr Rao', clinic: 'City', date: '2026-09-01', time: '10:00' }],
  doseLogs: [{ id: 'd1', status: 'taken', doseDate: '2026-08-16', stockAfter: 19, recordedAt: '2026-08-16T04:00:00Z' }],
}

describe('mergeCloudSnapshot', () => {
  it('adopts the whole account onto an empty device', () => {
    const empty = { familyMembers: [], medicines: [], prescriptions: [], appointments: [], doseLogs: [] }
    const { state, adopted } = mergeCloudSnapshot(empty, cloudSnapshot)

    expect(adopted).toBe(5)
    expect(state.familyMembers).toHaveLength(1)
    expect(state.medicines[0].name).toBe('Metformin')
    expect(state.prescriptions[0].doctor).toBe('Dr Rao')
    expect(state.appointments[0].date).toBe('2026-09-01')
    expect(state.doseLogs[0].status).toBe('taken')
  })

  it('keeps the local copy when an id exists on both sides', () => {
    const local = { medicines: [{ id: 'm1', name: 'Local name', dosage: '500mg' }] }
    const { state, adopted } = mergeCloudSnapshot(local, { medicines: cloudSnapshot.medicines })

    expect(adopted).toBe(0)
    expect(state.medicines).toHaveLength(1)
    expect(state.medicines[0].name).toBe('Local name')
  })

  it('unions rather than replaces, keeping local-only records', () => {
    const local = { medicines: [{ id: 'local-only', name: 'Aspirin' }] }
    const { state, adopted } = mergeCloudSnapshot(local, { medicines: cloudSnapshot.medicines })

    expect(adopted).toBe(1)
    expect(state.medicines.map((m) => m.id).sort()).toEqual(['local-only', 'm1'])
  })

  it('returns the original state object untouched when nothing is adopted', () => {
    const local = { medicines: [{ id: 'm1', name: 'Local' }] }
    const result = mergeCloudSnapshot(local, { medicines: cloudSnapshot.medicines })
    expect(result.state).toBe(local)
  })

  it('survives a missing or malformed snapshot', () => {
    const local = { medicines: [{ id: 'm1' }] }
    expect(mergeCloudSnapshot(local, null).adopted).toBe(0)
    expect(mergeCloudSnapshot(local, undefined).state).toBe(local)
    expect(mergeCloudSnapshot(local, { medicines: 'nope' }).adopted).toBe(0)
  })

  it('ignores cloud records with no id', () => {
    const { adopted } = mergeCloudSnapshot({ medicines: [] }, { medicines: [{ name: 'no id' }, { id: null }] })
    expect(adopted).toBe(0)
  })

  it('adopted records round-trip back into a valid push snapshot', () => {
    const { state } = mergeCloudSnapshot({}, cloudSnapshot)
    const snapshot = buildSyncSnapshot(state)

    expect(snapshot.medicines[0].id).toBe('m1')
    // the family member came along, so the medicine keeps its owner
    expect(snapshot.medicines[0].memberId).toBe('f1')
    expect(snapshot.familyMembers[0].isPrimaryEmergency).toBe(true)
  })
})

describe('cloud -> local field mapping', () => {
  it('turns the cloud refill boolean back into a local label', () => {
    expect(medicineFromCloud({ id: 'm', refill: true }).refill).toBe('Refill needed')
    expect(medicineFromCloud({ id: 'm', refill: false }).refill).toBe('On track')
  })

  it('defaults an adopted appointment status, which never leaves a device', () => {
    expect(appointmentFromCloud({ id: 'a', date: '2026-09-01' }).status).toBe('Upcoming')
  })

  it('keeps enabled periods as an array even when the cloud omits them', () => {
    expect(medicineFromCloud({ id: 'm' }).enabledDosePeriods).toEqual([])
  })
})
