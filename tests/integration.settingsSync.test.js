import { beforeEach, describe, expect, it } from 'vitest'
import { makeClient } from './helpers/testWorker.js'

// Settings round-trip (M6 follow-up): escalation windows (feature #7 / #22) and
// consent (#29) now travel through PUT/GET /sync and GET/PATCH /settings, and the
// escalation engine honors a window that arrived via sync.

const rnd = () => Math.random().toString(16).slice(2)
let client
beforeEach(() => { client = makeClient() })

const signup = () =>
  client.call('POST', '/v1/auth/signup', { body: { email: `u_${rnd()}@example.com`, password: 'strong pass 8' } })
    .then((r) => r.data)

describe('integration — settings & consent round-trip', () => {
  it('syncs escalation windows and consent through PUT/GET sync', async () => {
    const acct = await signup()
    await client.call('PUT', '/v1/sync', {
      token: acct.token,
      body: { settings: {
        doseGraceMinutes: 12, l2EscalationMinutes: 25, escalationEnabled: false,
        timezone: 'UTC', consentVersion: '2026-08-30-v1', consentAcceptedAt: '2026-08-31T00:00:00.000Z',
      } },
    })
    const pulled = (await client.call('GET', '/v1/sync', { token: acct.token })).data.settings
    expect(pulled.doseGraceMinutes).toBe(12)
    expect(pulled.l2EscalationMinutes).toBe(25)
    expect(pulled.escalationEnabled).toBe(false)
    expect(pulled.timezone).toBe('UTC')
    expect(pulled.consentVersion).toBe('2026-08-30-v1')
    expect(pulled.consentAcceptedAt).toBe('2026-08-31T00:00:00.000Z')
  })

  it('exposes escalation + consent via GET/PATCH /settings', async () => {
    const acct = await signup()
    const patched = (await client.call('PATCH', '/v1/settings', {
      token: acct.token,
      body: { doseGraceMinutes: 10, consentVersion: '2026-08-30-v1', consentAcceptedAt: '2026-08-31T00:00:00.000Z' },
    })).data.settings
    expect(patched.escalation.graceMinutes).toBe(10)
    expect(patched.consent.version).toBe('2026-08-30-v1')
    expect(patched.consent.acceptedAt).toBe('2026-08-31T00:00:00.000Z')
  })

  it('escalation engine honors a grace window that arrived via sync', async () => {
    const acct = await signup()
    await client.call('PUT', '/v1/sync', {
      token: acct.token, body: { settings: { timezone: 'UTC', doseGraceMinutes: 5, l2EscalationMinutes: 10 } },
    })
    await client.call('POST', '/v1/medicines', {
      token: acct.token, body: { name: 'Metformin', enabledPeriods: ['morning'], morningTime: '08:00' },
    })
    // 08:06 is past the 5-min grace synced above (default 15 would NOT fire yet)
    const res = await client.call('POST', '/v1/jobs/escalation-check', { token: acct.token, body: { now: '2026-09-01T08:06:00Z' } })
    expect(res.data.notified).toBe(1)
  })
})
