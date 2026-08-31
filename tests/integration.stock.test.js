import { beforeEach, describe, expect, it } from 'vitest'
import { makeClient } from './helpers/testWorker.js'

// Predictive & family-aware stock (M4): /stock/summary predictions, /adherence,
// and the caregiver family rollup across linked patients.

let client
beforeEach(() => { client = makeClient() })

const rnd = () => Math.random().toString(16).slice(2)
const signup = (over = {}) =>
  client.call('POST', '/v1/auth/signup', { body: { email: `u_${rnd()}@example.com`, password: 'strong pass 8', ...over } })
    .then((r) => r.data)
const addMedicine = (token, body) =>
  client.call('POST', '/v1/medicines', { token, body }).then((r) => r.data.medicine.id)
const addMember = (token, body) =>
  client.call('POST', '/v1/family', { token, body }).then((r) => r.data.member)
const invite = (token, memberId, body = {}) =>
  client.call('POST', `/v1/family/${memberId}/invite`, { token, body }).then((r) => r.data)

const dayISO = (offset) => {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

describe('integration — predictive stock & adherence', () => {
  it('returns a prediction block and an adherence report for the patient', async () => {
    const acct = await signup()
    await client.call('PATCH', '/v1/settings', { token: acct.token, body: { timezone: 'UTC' } })
    const medId = await addMedicine(acct.token, {
      name: 'Metformin', enabledPeriods: ['morning', 'night'], morningTime: '08:00', nightTime: '20:00',
      stockRemaining: 20, stockBufferDays: 7,
    })

    const dose = (period, status, doseDate) =>
      client.call('POST', `/v1/medicines/${medId}/dose`, { token: acct.token, body: { period, status, doseDate } })
    await dose('morning', 'taken', dayISO(0))
    await dose('night', 'taken', dayISO(0))
    await dose('morning', 'taken', dayISO(-1))
    await dose('night', 'taken', dayISO(-1))
    await dose('morning', 'missed', dayISO(-2))
    await dose('night', 'missed', dayISO(-2))

    const summary = (await client.call('GET', '/v1/stock/summary', { token: acct.token })).data
    expect(summary.items.length).toBe(1)
    const prediction = summary.items[0].prediction
    expect(prediction.basis).toBe('observed')
    expect(typeof prediction.predictedDaysRemaining).toBe('number')
    expect(prediction).toHaveProperty('predictedLow')
    expect(summary).toHaveProperty('predictedLowIds')

    const adherence = (await client.call('GET', '/v1/adherence?range=30', { token: acct.token })).data
    expect(adherence.overall.taken).toBe(4)
    expect(adherence.overall.missed).toBe(2)
    expect(adherence.overall.adherenceRate).toBe(66.7) // 4 / (4+2)
  })

  it('rolls up low stock across a caregiver\'s patients (family-aware)', async () => {
    const patient = await signup()
    const caregiver = await signup()
    const member = await addMember(patient.token, { name: 'Asha', alertLevel: 'Level 1' })
    const inv = await invite(patient.token, member.id)
    await client.call('POST', '/v1/caregiver/accept', { token: caregiver.token, body: { code: inv.inviteCode } })

    // a clearly low-stock medicine (2 units, buffer 7)
    await addMedicine(patient.token, { name: 'Aspirin', enabledPeriods: ['morning'], morningTime: '08:00', stockRemaining: 2, stockBufferDays: 7 })

    const rollup = (await client.call('GET', '/v1/caregiver/inventory', { token: caregiver.token })).data
    expect(rollup.patients.map((p) => p.patient.id)).toContain(patient.patientId)
    expect(rollup.alerts.some((a) => a.name === 'Aspirin')).toBe(true)
  })
})
