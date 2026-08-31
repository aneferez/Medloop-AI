import { beforeEach, describe, expect, it } from 'vitest'
import { makeClient } from './helpers/testWorker.js'

// Authenticated config-check: reports which channels/secrets are wired as
// booleans only, so an operator can confirm push/email/AI without guessing —
// and without exposing any secret value or making the posture world-readable.

const rnd = () => Math.random().toString(16).slice(2)
const signup = (client) =>
  client.call('POST', '/v1/auth/signup', { body: { email: `u_${rnd()}@example.com`, password: 'strong pass 8' } })
    .then((r) => r.data)

let client
beforeEach(() => { client = makeClient() })

describe('integration — system config-check', () => {
  it('requires auth and reports channel config as booleans (none set in tests)', async () => {
    expect((await client.call('GET', '/v1/system/config-check')).status).toBe(401)

    const acct = await signup(client)
    const res = await client.call('GET', '/v1/system/config-check', { token: acct.token })
    expect(res.status).toBe(200)
    expect(typeof res.data.channels.push).toBe('boolean')
    expect(res.data.channels).toMatchObject({ push: false, email: false, whatsapp: false })
    expect(res.data.ai.configured).toBe(false)
    expect(res.data.attestation.enabled).toBe(false)
  })

  it('reflects configured channels when secrets are present', async () => {
    const configured = makeClient({ MEDLOOP_AI_API_KEY: 'x', RESEND_API_KEY: 'x', EMAIL_FROM: 'care@example.com', TURNSTILE_SECRET: 't' })
    // Use device registration (not attestation-gated) to get a session, since
    // TURNSTILE_SECRET now makes signup require a Turnstile token.
    const acct = await configured.register()
    const res = await configured.call('GET', '/v1/system/config-check', { token: acct.token })
    expect(res.data.channels.email).toBe(true)
    expect(res.data.ai.configured).toBe(true)
    expect(res.data.attestation.enabled).toBe(true)
    expect(res.data.channels.push).toBe(false) // FCM secrets still absent
  })
})
