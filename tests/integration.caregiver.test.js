import { beforeEach, describe, expect, it } from 'vitest'
import { makeClient } from './helpers/testWorker.js'

// Family network (M3): caregiver invite/accept, permission-gated patient views,
// revocation, and — tying M1+M2+M3 together — a missed-dose escalation reaching
// the linked caregiver on their OWN device.

let client
beforeEach(() => { client = makeClient() })

const rnd = () => Math.random().toString(16).slice(2)
const signup = (over = {}) =>
  client.call('POST', '/v1/auth/signup', { body: { email: `u_${rnd()}@example.com`, password: 'strong pass 8', ...over } })
    .then((r) => r.data)

const addMember = (token, body) =>
  client.call('POST', '/v1/family', { token, body }).then((r) => r.data.member)
const invite = (token, memberId, body = {}) =>
  client.call('POST', `/v1/family/${memberId}/invite`, { token, body }).then((r) => r.data)
const addMedicine = (token, body) =>
  client.call('POST', '/v1/medicines', { token, body }).then((r) => r.data.medicine.id)

describe('integration — family network', () => {
  it('invite -> accept lets a caregiver view inventory and doses', async () => {
    const patient = await signup()
    const caregiver = await signup()
    const member = await addMember(patient.token, { name: 'Asha', alertLevel: 'Level 1' })
    await addMedicine(patient.token, { name: 'Metformin', enabledPeriods: ['morning'], morningTime: '08:00', stockRemaining: 10 })

    const inv = await invite(patient.token, member.id)
    expect(inv.inviteCode).toMatch(/^[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$/)

    const accepted = await client.call('POST', '/v1/caregiver/accept', { token: caregiver.token, body: { code: inv.inviteCode } })
    expect(accepted.status).toBe(201)
    expect(accepted.data.link.status).toBe('active')
    expect(accepted.data.link.patientId).toBe(patient.patientId)

    const patients = (await client.call('GET', '/v1/caregiver/patients', { token: caregiver.token })).data.patients
    expect(patients.map((p) => p.patientId)).toContain(patient.patientId)

    const inventory = await client.call('GET', `/v1/patients/${patient.patientId}/inventory`, { token: caregiver.token })
    expect(inventory.status).toBe(200)
    expect(inventory.data.items.length).toBe(1)

    const doses = await client.call('GET', `/v1/patients/${patient.patientId}/doses`, { token: caregiver.token })
    expect(doses.status).toBe(200)
    expect(doses.data.doses[0].status).toBe('pending')
  })

  it('denies access to a user with no link', async () => {
    const patient = await signup()
    const stranger = await signup()
    const res = await client.call('GET', `/v1/patients/${patient.patientId}/inventory`, { token: stranger.token })
    expect(res.status).toBe(403)
  })

  it('honors per-permission gating', async () => {
    const patient = await signup()
    const caregiver = await signup()
    const member = await addMember(patient.token, { name: 'Asha', alertLevel: 'Level 1' })
    const inv = await invite(patient.token, member.id, { permissions: ['view_doses'] })
    await client.call('POST', '/v1/caregiver/accept', { token: caregiver.token, body: { code: inv.inviteCode } })

    expect((await client.call('GET', `/v1/patients/${patient.patientId}/doses`, { token: caregiver.token })).status).toBe(200)
    expect((await client.call('GET', `/v1/patients/${patient.patientId}/inventory`, { token: caregiver.token })).status).toBe(403)
  })

  it('revoking access denies the caregiver immediately', async () => {
    const patient = await signup()
    const caregiver = await signup()
    const member = await addMember(patient.token, { name: 'Asha', alertLevel: 'Level 1' })
    const inv = await invite(patient.token, member.id)
    await client.call('POST', '/v1/caregiver/accept', { token: caregiver.token, body: { code: inv.inviteCode } })

    const caregivers = (await client.call('GET', '/v1/caregivers', { token: patient.token })).data.caregivers
    expect(caregivers.length).toBe(1)
    await client.call('POST', `/v1/caregivers/${caregivers[0].id}/revoke`, { token: patient.token })

    expect((await client.call('GET', `/v1/patients/${patient.patientId}/inventory`, { token: caregiver.token })).status).toBe(403)
    expect((await client.call('GET', '/v1/caregiver/patients', { token: caregiver.token })).data.patients.length).toBe(0)
  })

  it('lets the patient read their own data through the caregiver view (owner)', async () => {
    const patient = await signup()
    await addMedicine(patient.token, { name: 'Metformin', enabledPeriods: ['morning'], morningTime: '08:00' })
    const res = await client.call('GET', `/v1/patients/${patient.patientId}/inventory`, { token: patient.token })
    expect(res.status).toBe(200)
    expect(res.data.items.length).toBe(1)
  })

  it('rejects an unknown or reused invite code', async () => {
    const patient = await signup()
    const caregiver = await signup()
    const member = await addMember(patient.token, { name: 'Asha', alertLevel: 'Level 1' })
    const inv = await invite(patient.token, member.id)

    expect((await client.call('POST', '/v1/caregiver/accept', { token: caregiver.token, body: { code: inv.inviteCode } })).status).toBe(201)
    expect((await client.call('POST', '/v1/caregiver/accept', { token: caregiver.token, body: { code: inv.inviteCode } })).status).toBe(401)
    expect((await client.call('POST', '/v1/caregiver/accept', { token: caregiver.token, body: { code: 'ABCDE-FGHJK' } })).status).toBe(401)
  })

  it('delivers a missed-dose escalation to the linked caregiver\'s own device', async () => {
    const patient = await signup()
    const caregiver = await signup()
    await client.call('PATCH', '/v1/auth/device', { token: caregiver.token, body: { fcmToken: 'caregiver-device-token' } })
    await client.call('PATCH', '/v1/settings', { token: patient.token, body: { timezone: 'UTC' } })

    const member = await addMember(patient.token, { name: 'Asha', alertLevel: 'Level 1' })
    const inv = await invite(patient.token, member.id)
    await client.call('POST', '/v1/caregiver/accept', { token: caregiver.token, body: { code: inv.inviteCode } })

    await addMedicine(patient.token, { name: 'Metformin', enabledPeriods: ['morning'], morningTime: '08:10' })
    const res = await client.call('POST', '/v1/jobs/escalation-check', {
      token: patient.token, body: { now: '2026-09-01T08:30:00Z' },
    })
    expect(res.data.notified).toBe(1)

    // A push notification targeted the caregiver's contact row via their device,
    // even though the contact row itself has no fcm_token.
    const { results } = await client.env.DB
      .prepare("SELECT recipient_id FROM notifications WHERE patient_id = ? AND channel = 'push'")
      .bind(patient.patientId).all()
    expect(results.map((r) => r.recipient_id)).toContain(member.id)
  })

  it('caregiver dashboard returns a card per patient (name + inventory + today)', async () => {
    const patient = await signup({ displayName: 'Grandma' })
    const caregiver = await signup()
    const member = await addMember(patient.token, { name: 'Asha', alertLevel: 'Level 1' })
    const inv = await invite(patient.token, member.id)
    await client.call('POST', '/v1/caregiver/accept', { token: caregiver.token, body: { code: inv.inviteCode } })
    await addMedicine(patient.token, { name: 'Metformin', enabledPeriods: ['morning', 'night'], morningTime: '08:00', nightTime: '20:00', stockRemaining: 2, stockBufferDays: 7 })

    const res = await client.call('GET', '/v1/caregiver/dashboard', { token: caregiver.token })
    expect(res.status).toBe(200)
    const card = res.data.patients.find((p) => p.patientId === patient.patientId)
    expect(card).toBeTruthy()
    expect(card.name).toBe('Grandma')
    expect(card.inventory.medicineCount).toBe(1)
    expect(card.today.summary.total).toBe(2) // morning + night
    expect(card.today.next).toBeTruthy()
    expect(card.today.next.scheduledTime).toBeTruthy()
  })

  it('dashboard omits sections the patient did not grant', async () => {
    const patient = await signup({ displayName: 'Grandpa' })
    const caregiver = await signup()
    const member = await addMember(patient.token, { name: 'Ben', alertLevel: 'Level 2' })
    const inv = await invite(patient.token, member.id, { permissions: ['view_doses'] }) // no view_inventory
    await client.call('POST', '/v1/caregiver/accept', { token: caregiver.token, body: { code: inv.inviteCode } })
    await addMedicine(patient.token, { name: 'Aspirin', enabledPeriods: ['morning'], morningTime: '08:00', stockRemaining: 5 })

    const card = (await client.call('GET', '/v1/caregiver/dashboard', { token: caregiver.token })).data.patients[0]
    expect(card.today).toBeTruthy() // has view_doses
    expect(card.inventory).toBeUndefined() // no view_inventory -> section absent
  })
})
