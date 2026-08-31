import { beforeEach, describe, expect, it } from 'vitest'
import { makeClient } from './helpers/testWorker.js'

// MedLoop AI endpoints (M5). No API key is configured in tests, so the service
// takes the safe fallback path — which is exactly where the guardrails, auth, and
// rate limiting must still hold.

const rnd = () => Math.random().toString(16).slice(2)

let client
beforeEach(() => { client = makeClient({ AI_RATE_LIMIT_MAX: '3' }) })

const signup = () =>
  client.call('POST', '/v1/auth/signup', { body: { email: `u_${rnd()}@example.com`, password: 'strong pass 8' } })
    .then((r) => r.data)

describe('integration — MedLoop AI', () => {
  it('requires authentication', async () => {
    const res = await client.call('POST', '/v1/ai/simplify', { body: { text: 'Metformin 500mg' } })
    expect(res.status).toBe(401)
  })

  it('simplifies with an educational-only disclaimer', async () => {
    const acct = await signup()
    const res = await client.call('POST', '/v1/ai/simplify', {
      token: acct.token, body: { text: 'Metformin is used to help control blood sugar.' },
    })
    expect(res.status).toBe(200)
    expect(res.data.text).toBeTruthy()
    expect(res.data.disclaimer.toLowerCase()).toContain('educational')
    expect(res.data.refused).toBe(false)
  })

  it('refuses a dosing / diagnosis question to the assistant', async () => {
    const acct = await signup()
    const res = await client.call('POST', '/v1/ai/assistant', {
      token: acct.token, body: { question: 'What dose of insulin should I take?' },
    })
    expect(res.status).toBe(200)
    expect(res.data.refused).toBe(true)
    expect(res.data.text.toLowerCase()).toContain('pharmacist')
  })

  it('answers a safe question and rate-limits after the configured number', async () => {
    const acct = await signup()
    for (let i = 0; i < 3; i += 1) {
      const okRes = await client.call('POST', '/v1/ai/assistant', { token: acct.token, body: { question: 'What is metformin for?' } })
      expect(okRes.status).toBe(200)
      expect(okRes.data.refused).toBe(false)
    }
    const limited = await client.call('POST', '/v1/ai/assistant', { token: acct.token, body: { question: 'What is metformin for?' } })
    expect(limited.status).toBe(429)
  })
})
