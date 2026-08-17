import { beforeEach, describe, expect, it } from 'vitest'
import { makeClient } from './helpers/testWorker.js'

let client
beforeEach(() => { client = makeClient() })

describe('integration — snapshot sync (PUT /sync)', () => {
  const snapshot = {
    familyMembers: [{ id: 'f1', name: 'Asha', alertLevel: 'Level 1', phone: '+14155550123' }],
    medicines: [{ id: 'm1', name: 'Metformin', memberId: 'f1', enabledPeriods: ['morning'], stockRemaining: 10 }],
    doseLogs: [{ id: 'd1', status: 'taken', doseDate: '2026-08-16', medicineId: 'm1', dosePeriod: 'morning', recordedAt: '2026-08-16T08:00:00.000Z' }],
    settings: { pushEnabled: true, whatsappEnabled: true },
  }

  it('upserts the snapshot with aligned member references', async () => {
    const { token } = await client.register()
    const res = await client.call('PUT', '/v1/sync', { token, body: snapshot })
    expect(res.status).toBe(200)
    expect(res.data.synced).toMatchObject({ family: 1, medicines: 1, doses: 1, settings: true })

    const family = await client.call('GET', '/v1/family', { token })
    expect(family.data.members[0].id).toBe('f1')
    const medicines = await client.call('GET', '/v1/medicines', { token })
    expect(medicines.data.medicines[0].memberId).toBe('f1')
  })

  it('is idempotent and updates existing rows without duplicating', async () => {
    const { token } = await client.register()
    await client.call('PUT', '/v1/sync', { token, body: snapshot })
    await client.call('PUT', '/v1/sync', {
      token,
      body: { ...snapshot, familyMembers: [{ id: 'f1', name: 'Asha Updated', alertLevel: 'Level 1' }] },
    })
    const family = await client.call('GET', '/v1/family', { token })
    expect(family.data.members).toHaveLength(1)
    expect(family.data.members[0].name).toBe('Asha Updated')
  })

  it('deletes rows the snapshot no longer contains when pruning', async () => {
    const { token } = await client.register()
    await client.call('PUT', '/v1/sync', { token, body: snapshot })
    await client.call('PUT', '/v1/sync', { token, body: { familyMembers: [], medicines: [], prune: true } })
    expect((await client.call('GET', '/v1/family', { token })).data.members).toHaveLength(0)
    expect((await client.call('GET', '/v1/medicines', { token })).data.medicines).toHaveLength(0)
  })

  it('keeps rows the snapshot omits when not pruning', async () => {
    const { token } = await client.register()
    await client.call('PUT', '/v1/sync', { token, body: snapshot })
    const res = await client.call('PUT', '/v1/sync', { token, body: { familyMembers: [], medicines: [] } })

    expect(res.data.synced.pruned).toBe(false)
    expect((await client.call('GET', '/v1/family', { token })).data.members).toHaveLength(1)
    expect((await client.call('GET', '/v1/medicines', { token })).data.medicines).toHaveLength(1)
  })

  it('keeps a medicine linked to a member the partial push omitted', async () => {
    const { token } = await client.register()
    await client.call('PUT', '/v1/sync', { token, body: snapshot })
    // A push that carries the medicine but not the family member must not sever
    // the link just because the member was absent from this payload.
    await client.call('PUT', '/v1/sync', { token, body: { familyMembers: [], medicines: snapshot.medicines } })

    const medicines = await client.call('GET', '/v1/medicines', { token })
    expect(medicines.data.medicines[0].memberId).toBe('f1')
  })

  it('never lets one patient overwrite another patient by id (cross-tenant guard)', async () => {
    const { token: tokenA } = await client.register()
    const { token: tokenB } = await client.register()
    await client.call('PUT', '/v1/sync', { token: tokenA, body: { familyMembers: [{ id: 'shared', name: 'Belongs to A', alertLevel: 'Level 2' }] } })
    await client.call('PUT', '/v1/sync', { token: tokenB, body: { familyMembers: [{ id: 'shared', name: 'Hijack by B', alertLevel: 'Level 2' }] } })

    // B could not claim A's id, and A's record is untouched.
    expect((await client.call('GET', '/v1/family', { token: tokenB })).data.members).toHaveLength(0)
    const aFamily = await client.call('GET', '/v1/family', { token: tokenA })
    expect(aFamily.data.members).toHaveLength(1)
    expect(aFamily.data.members[0].name).toBe('Belongs to A')
  })
})

describe('integration — prescriptions & appointments sync', () => {
  it('upserts and reads back prescriptions and appointments', async () => {
    const { token } = await client.register()
    await client.call('PUT', '/v1/sync', {
      token,
      body: {
        prescriptions: [{ id: 'p1', doctor: 'Dr K', clinic: 'City Clinic', notes: 'with food' }],
        appointments: [{ id: 'a1', doctor: 'Dr K', date: '2026-09-01', time: '10:00' }],
      },
    })
    const prescriptions = await client.call('GET', '/v1/prescriptions', { token })
    expect(prescriptions.data.prescriptions).toHaveLength(1)
    expect(prescriptions.data.prescriptions[0]).toMatchObject({ id: 'p1', doctor: 'Dr K', hasFile: false })

    const appointments = await client.call('GET', '/v1/appointments', { token })
    expect(appointments.data.appointments[0]).toMatchObject({ id: 'a1', date: '2026-09-01', time: '10:00' })
  })

  it('deletes records dropped from the snapshot', async () => {
    const { token } = await client.register()
    await client.call('PUT', '/v1/sync', { token, body: { prescriptions: [{ id: 'p1', doctor: 'Dr K' }], appointments: [{ id: 'a1', doctor: 'Dr K', date: '2026-09-01' }] } })
    await client.call('PUT', '/v1/sync', { token, body: { prescriptions: [], appointments: [], prune: true } })
    expect((await client.call('GET', '/v1/prescriptions', { token })).data.prescriptions).toHaveLength(0)
    expect((await client.call('GET', '/v1/appointments', { token })).data.appointments).toHaveLength(0)
  })
})

describe('integration — R2 files', () => {
  it('returns 503 when file storage is not enabled', async () => {
    const { token } = await client.register()
    await client.call('PUT', '/v1/sync', { token, body: { prescriptions: [{ id: 'p1', doctor: 'Dr K' }] } })
    const res = await client.call('PUT', '/v1/prescriptions/p1/file', { token, body: { placeholder: true } })
    expect(res.status).toBe(503)
    expect(res.error.code).toBe('files_disabled')
  })
})

describe('integration — settings', () => {
  it('reads defaults and applies channel preference updates', async () => {
    const { token } = await client.register()
    const initial = await client.call('GET', '/v1/settings', { token })
    expect(initial.data.settings.channels).toMatchObject({ push: true, whatsapp: false })

    const updated = await client.call('PATCH', '/v1/settings', { token, body: { whatsappEnabled: true, dailyCheckTime: '21:30' } })
    expect(updated.data.settings.channels.whatsapp).toBe(true)
    expect(updated.data.settings.dailyCheckTime).toBe('21:30')
  })
})

describe('integration — emergency / SOS', () => {
  async function setup() {
    const { token } = await client.register()
    await client.call('POST', '/v1/family', { token, body: { name: 'Asha', alertLevel: 'Level 1', phone: '+14155550123' } })
    await client.call('PATCH', '/v1/auth/device', { token, body: { fcmToken: 'device-token' } })
    return token
  }

  it('triggers a pending SOS with a call link, then confirms and dispatches', async () => {
    const token = await setup()
    const trigger = await client.call('POST', '/v1/emergency', { token, body: { note: 'chest pain' } })
    expect(trigger.status).toBe(201)
    expect(trigger.data.event.status).toBe('pending_confirm')
    expect(trigger.data.primaryContact.name).toBe('Asha')
    expect(trigger.data.callLink).toBe('tel:+14155550123')

    const confirm = await client.call('POST', `/v1/emergency/${trigger.data.event.id}/confirm`, { token })
    expect(confirm.data.event.status).toBe('confirmed')
    // Patient device push is planned (recorded skipped without FCM secrets).
    expect(confirm.data.notifications.length).toBeGreaterThan(0)
  })

  it('cancels an armed SOS', async () => {
    const token = await setup()
    const trigger = await client.call('POST', '/v1/emergency', { token })
    const cancel = await client.call('POST', `/v1/emergency/${trigger.data.event.id}/cancel`, { token })
    expect(cancel.data.event.status).toBe('cancelled')
  })
})

describe('integration — scheduled jobs', () => {
  it('raises a daily-check alert for untaken doses and is idempotent per day', async () => {
    const { token } = await client.register()
    await client.call('POST', '/v1/medicines', { token, body: { name: 'Metformin', enabledPeriods: ['morning'], stockRemaining: 30 } })

    const run = await client.call('POST', '/v1/jobs/daily-check', { token })
    expect(run.data.outstanding).toBeGreaterThan(0)
    expect(run.data.alertId).toBeTruthy()

    const rerun = await client.call('POST', '/v1/jobs/daily-check', { token })
    expect(rerun.data.skipped).toBe('already_ran')
  })

  it('raises a restock alert for low-stock medicines', async () => {
    const { token } = await client.register()
    await client.call('POST', '/v1/medicines', { token, body: { name: 'Metformin', enabledPeriods: ['morning'], stockRemaining: 5, stockBufferDays: 7 } })
    const run = await client.call('POST', '/v1/jobs/restock-check', { token })
    expect(run.data.needs).toBeGreaterThan(0)
    expect(run.data.alertId).toBeTruthy()
  })
})

describe('integration — snapshot pull (GET /sync)', () => {
  const snapshot = {
    familyMembers: [{ id: 'f1', name: 'Asha', alertLevel: 'Level 1', isPrimaryEmergency: true, phone: '+14155550123' }],
    medicines: [{ id: 'm1', name: 'Metformin', memberId: 'f1', enabledPeriods: ['morning', 'night'], stockRemaining: 10 }],
    prescriptions: [{ id: 'p1', doctor: 'Dr K', clinic: 'City', notes: 'after food' }],
    appointments: [{ id: 'a1', doctor: 'Dr K', date: '2026-09-01', time: '10:30' }],
    doseLogs: [{ id: 'd1', status: 'taken', doseDate: '2026-08-16', medicineId: 'm1', dosePeriod: 'morning', recordedAt: '2026-08-16T08:00:00.000Z' }],
    settings: { pushEnabled: true, whatsappEnabled: true, reminderLeadMinutes: 15 },
  }

  it('requires authentication', async () => {
    expect((await client.call('GET', '/v1/sync')).status).toBe(401)
  })

  it('returns an empty snapshot for a fresh account', async () => {
    const { token } = await client.register()
    const res = await client.call('GET', '/v1/sync', { token })

    expect(res.status).toBe(200)
    expect(res.data.familyMembers).toEqual([])
    expect(res.data.medicines).toEqual([])
    expect(res.data.doseLogs).toEqual([])
  })

  it('round-trips a pushed snapshot back in the shape PUT accepts', async () => {
    const { token } = await client.register()
    await client.call('PUT', '/v1/sync', { token, body: snapshot })
    const res = await client.call('GET', '/v1/sync', { token })

    expect(res.data.familyMembers[0]).toMatchObject({ id: 'f1', name: 'Asha', alertLevel: 'Level 1', isPrimaryEmergency: true })
    expect(res.data.medicines[0]).toMatchObject({ id: 'm1', memberId: 'f1', stockRemaining: 10 })
    expect(res.data.medicines[0].enabledPeriods).toEqual(['morning', 'night'])
    expect(res.data.prescriptions[0]).toMatchObject({ id: 'p1', doctor: 'Dr K', hasFile: false })
    expect(res.data.appointments[0]).toMatchObject({ id: 'a1', date: '2026-09-01', time: '10:30' })
    expect(res.data.doseLogs[0]).toMatchObject({ id: 'd1', status: 'taken', doseDate: '2026-08-16' })
    expect(res.data.settings).toMatchObject({ pushEnabled: true, whatsappEnabled: true, reminderLeadMinutes: 15 })

    // the pulled snapshot is directly re-pushable
    expect((await client.call('PUT', '/v1/sync', { token, body: res.data })).status).toBe(200)
  })

  it('never leaks another account\'s snapshot', async () => {
    const owner = await client.register({ email: 'owner@example.com' })
    await client.call('PUT', '/v1/sync', { token: owner.token, body: snapshot })
    const stranger = await client.register({ email: 'stranger@example.com' })

    const res = await client.call('GET', '/v1/sync', { token: stranger.token })
    expect(res.data.medicines).toEqual([])
    expect(res.data.familyMembers).toEqual([])
  })

  it('an un-merged client pushing empty state cannot wipe the account', async () => {
    const { token } = await client.register()
    await client.call('PUT', '/v1/sync', { token, body: snapshot })

    // A client holding a valid session but no local records — reinstalled,
    // storage cleared, or simply pushing before its local state hydrated.
    // Without the prune guard this push destroyed the account.
    await client.call('PUT', '/v1/sync', {
      token,
      body: { familyMembers: [], medicines: [], prescriptions: [], appointments: [], doseLogs: [] },
    })

    const stillThere = await client.call('GET', '/v1/sync', { token })
    expect(stillThere.data.medicines).toHaveLength(1)
    expect(stillThere.data.familyMembers).toHaveLength(1)
    expect(stillThere.data.prescriptions).toHaveLength(1)

    // and once it has pulled, it may prune again
    const pulled = await client.call('GET', '/v1/sync', { token })
    await client.call('PUT', '/v1/sync', { token, body: { ...pulled.data, medicines: [], prune: true } })
    expect((await client.call('GET', '/v1/sync', { token })).data.medicines).toHaveLength(0)
  })
})
