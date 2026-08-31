import { beforeEach, describe, expect, it } from 'vitest'
import { makeClient } from './helpers/testWorker.js'

// Authorization matrix (#3 / guardrail G4): every patient resource is scoped to
// its owner, and no route leaks another account's data.

const rnd = () => Math.random().toString(16).slice(2)
let client
beforeEach(() => { client = makeClient() })

const signup = () =>
  client.call('POST', '/v1/auth/signup', { body: { email: `u_${rnd()}@example.com`, password: 'strong pass 8' } })
    .then((r) => r.data)

describe('authorization — no cross-account access', () => {
  it('scopes every patient resource to its owner', async () => {
    const a = await signup()
    const b = await signup()
    const medId = (await client.call('POST', '/v1/medicines', {
      token: a.token, body: { name: 'Metformin', enabledPeriods: ['morning'], morningTime: '08:00' },
    })).data.medicine.id
    const memberId = (await client.call('POST', '/v1/family', {
      token: a.token, body: { name: 'Asha', alertLevel: 'Level 1' },
    })).data.member.id

    // B cannot read or modify A's medicine
    expect((await client.call('GET', `/v1/medicines/${medId}`, { token: b.token })).status).toBe(404)
    expect((await client.call('PATCH', `/v1/medicines/${medId}`, { token: b.token, body: { name: 'Hacked' } })).status).toBe(404)
    expect((await client.call('DELETE', `/v1/medicines/${medId}`, { token: b.token })).status).toBe(404)
    expect((await client.call('POST', `/v1/medicines/${medId}/dose`, {
      token: b.token, body: { period: 'morning', status: 'taken', doseDate: '2026-09-01' },
    })).status).toBe(404)

    // B cannot read A's family member
    expect((await client.call('GET', `/v1/family/${memberId}`, { token: b.token })).status).toBe(404)

    // B's list views never leak A's rows
    expect((await client.call('GET', '/v1/medicines', { token: b.token })).data.medicines.length).toBe(0)
    expect((await client.call('GET', '/v1/family', { token: b.token })).data.members.length).toBe(0)

    // B cannot use the caregiver view without a link
    expect((await client.call('GET', `/v1/patients/${a.patientId}/inventory`, { token: b.token })).status).toBe(403)
    expect((await client.call('GET', `/v1/patients/${a.patientId}/doses`, { token: b.token })).status).toBe(403)

    // Exports contain only the caller's own data
    const exportA = (await client.call('GET', '/v1/account/export', { token: a.token })).data
    expect(exportA.medicines.length).toBe(1)
    expect(exportA.medicines.every((m) => m.patient_id === a.patientId)).toBe(true)
    expect((await client.call('GET', '/v1/account/export', { token: b.token })).data.medicines.length).toBe(0)
  })

  it('requires a session for protected routes', async () => {
    const routes = [['GET', '/v1/medicines'], ['GET', '/v1/account/export'], ['GET', '/v1/settings'], ['POST', '/v1/ai/simplify']]
    for (const [method, path] of routes) {
      const res = await client.call(method, path, { body: method === 'POST' ? { text: 'x' } : undefined })
      expect(res.status).toBe(401)
    }
  })
})
