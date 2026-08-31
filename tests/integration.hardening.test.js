import { describe, expect, it } from 'vitest'
import { makeClient } from './helpers/testWorker.js'

// Hardening (M6): auth rate limiting and account data export.

const rnd = () => Math.random().toString(16).slice(2)

describe('integration — hardening', () => {
  it('rate-limits repeated sign-in attempts on one account', async () => {
    const client = makeClient({ AUTH_LOGIN_MAX: '3' })
    const email = `rl_${rnd()}@example.com`
    await client.call('POST', '/v1/auth/signup', { body: { email, password: 'strong pass 8' } })

    for (let i = 0; i < 3; i += 1) {
      expect((await client.call('POST', '/v1/auth/login', { body: { email, password: 'wrong wrong 9' } })).status).toBe(401)
    }
    const limited = await client.call('POST', '/v1/auth/login', { body: { email, password: 'wrong wrong 9' } })
    expect(limited.status).toBe(429)
  })

  it('gates /auth/register behind attestation when Turnstile is enabled', async () => {
    const client = makeClient({ TURNSTILE_SECRET: 't' })
    // No attestation token -> blocked, the same gate /auth/signup enforces.
    const res = await client.call('POST', '/v1/auth/register', { body: { email: `g_${rnd()}@example.com` } })
    expect(res.status).toBe(403)
  })

  it('exports the account data for the owner', async () => {
    const client = makeClient()
    const acct = (await client.call('POST', '/v1/auth/signup', {
      body: { email: `ex_${rnd()}@example.com`, password: 'strong pass 8' },
    })).data
    await client.call('POST', '/v1/medicines', {
      token: acct.token, body: { name: 'Metformin', enabledPeriods: ['morning'], morningTime: '08:00' },
    })

    const exported = (await client.call('GET', '/v1/account/export', { token: acct.token })).data
    expect(exported.account.id).toBe(acct.patientId)
    expect(exported.medicines.length).toBe(1)
    expect(exported).toHaveProperty('exportedAt')
    expect(exported).toHaveProperty('familyMembers')
  })
})
