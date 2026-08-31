import { beforeEach, describe, expect, it } from 'vitest'
import { makeClient } from './helpers/testWorker.js'

// Server-side identity (Module A / M1): signup, login, email verification,
// password reset, account deletion, and per-account isolation. The non-prod
// token echo (devVerificationToken / devResetToken) lets these exercise the full
// email flow without a configured provider — production never returns it.

let client
beforeEach(() => { client = makeClient() })

const signup = (overrides = {}) => client.call('POST', '/v1/auth/signup', {
  body: {
    email: `u_${Math.random().toString(16).slice(2)}@example.com`,
    password: 'correct horse 8',
    displayName: 'Asha',
    ...overrides,
  },
})

describe('integration — account signup & login', () => {
  it('creates an account + device session and reports email unverified', async () => {
    const res = await signup()
    expect(res.status).toBe(201)
    expect(res.data.token).toBeTruthy()
    expect(res.data.userId).toBeTruthy()
    expect(res.data.patientId).toBeTruthy()
    expect(res.data.emailVerified).toBe(false)
    expect(res.data.devVerificationToken).toBeTruthy()

    // the new session authenticates existing routes
    const session = await client.call('GET', '/v1/auth/session', { token: res.data.token })
    expect(session.status).toBe(200)
  })

  it('rejects a duplicate email with 409', async () => {
    const email = `dupe_${Math.random().toString(16).slice(2)}@example.com`
    expect((await signup({ email })).status).toBe(201)
    expect((await signup({ email })).status).toBe(409)
  })

  it('rejects a weak password with 422', async () => {
    expect((await signup({ password: 'short' })).status).toBe(422)
  })

  it('logs in with the right password; wrong password and unknown email fail identically', async () => {
    const email = `login_${Math.random().toString(16).slice(2)}@example.com`
    await signup({ email, password: 'right password 9' })

    const good = await client.call('POST', '/v1/auth/login', { body: { email, password: 'right password 9' } })
    expect(good.status).toBe(201)
    expect(good.data.token).toBeTruthy()

    const wrong = await client.call('POST', '/v1/auth/login', { body: { email, password: 'nope nope 9' } })
    const unknown = await client.call('POST', '/v1/auth/login', { body: { email: 'ghost@example.com', password: 'whatever 9' } })
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.error.message).toBe(unknown.error.message)
  })
})

describe('integration — email verification', () => {
  it('verifies an email with the issued token and reflects it on next login', async () => {
    const email = `verify_${Math.random().toString(16).slice(2)}@example.com`
    const { data } = await signup({ email, password: 'verify me 12' })

    const res = await client.call('POST', '/v1/auth/verify-email', { body: { token: data.devVerificationToken } })
    expect(res.status).toBe(200)
    expect(res.data.verified).toBe(true)

    const login = await client.call('POST', '/v1/auth/login', { body: { email, password: 'verify me 12' } })
    expect(login.data.emailVerified).toBe(true)
  })

  it('rejects a reused or unknown verification token', async () => {
    const { data } = await signup()
    await client.call('POST', '/v1/auth/verify-email', { body: { token: data.devVerificationToken } })
    const reused = await client.call('POST', '/v1/auth/verify-email', { body: { token: data.devVerificationToken } })
    expect(reused.status).toBe(401)
    const unknown = await client.call('POST', '/v1/auth/verify-email', { body: { token: 'nonexistent-token-value' } })
    expect(unknown.status).toBe(401)
  })
})

describe('integration — password reset', () => {
  it('resets the password, invalidates the old one, and revokes existing sessions', async () => {
    const email = `reset_${Math.random().toString(16).slice(2)}@example.com`
    const { data: created } = await signup({ email, password: 'old password 1' })

    const reqRes = await client.call('POST', '/v1/auth/password/reset-request', { body: { email } })
    expect(reqRes.status).toBe(200)
    expect(reqRes.data.devResetToken).toBeTruthy()

    const done = await client.call('POST', '/v1/auth/password/reset', {
      body: { token: reqRes.data.devResetToken, password: 'new password 2' },
    })
    expect(done.status).toBe(200)

    // old session revoked
    expect((await client.call('GET', '/v1/auth/session', { token: created.token })).status).toBe(401)
    // old password fails, new one works
    expect((await client.call('POST', '/v1/auth/login', { body: { email, password: 'old password 1' } })).status).toBe(401)
    expect((await client.call('POST', '/v1/auth/login', { body: { email, password: 'new password 2' } })).status).toBe(201)
  })

  it('never reveals whether an email exists', async () => {
    const known = `known_${Math.random().toString(16).slice(2)}@example.com`
    await signup({ email: known })
    const a = await client.call('POST', '/v1/auth/password/reset-request', { body: { email: known } })
    const b = await client.call('POST', '/v1/auth/password/reset-request', { body: { email: 'missing@example.com' } })
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(b.data.devResetToken).toBeUndefined()
  })
})

describe('integration — account deletion & isolation', () => {
  it('requires the password, then removes the account and locks out the session', async () => {
    const email = `del_${Math.random().toString(16).slice(2)}@example.com`
    const { data } = await signup({ email, password: 'delete me 34' })

    expect((await client.call('DELETE', '/v1/account', { token: data.token, body: { password: 'wrong' } })).status).toBe(401)
    expect((await client.call('DELETE', '/v1/account', { token: data.token })).status).toBe(401)

    const del = await client.call('DELETE', '/v1/account', { token: data.token, body: { password: 'delete me 34' } })
    expect(del.status).toBe(200)
    expect(del.data.deleted).toBe(true)

    expect((await client.call('GET', '/v1/auth/session', { token: data.token })).status).toBe(401)
    expect((await client.call('POST', '/v1/auth/login', { body: { email, password: 'delete me 34' } })).status).toBe(401)
  })

  it('keeps each account\'s data private', async () => {
    const a = (await signup()).data
    const b = (await signup()).data
    await client.call('PUT', '/v1/sync', {
      token: a.token,
      body: { medicines: [{ id: 'm1', name: 'Aspirin', enabledPeriods: ['night'] }] },
    })

    const aPull = await client.call('GET', '/v1/sync', { token: a.token })
    const bPull = await client.call('GET', '/v1/sync', { token: b.token })
    expect(aPull.data.medicines.map((m) => m.id)).toContain('m1')
    expect((bPull.data.medicines || []).length).toBe(0)
  })
})
