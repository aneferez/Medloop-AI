import { beforeEach, describe, expect, it } from 'vitest'
import { makeClient } from './helpers/testWorker.js'

// Pairing is the only route by which a second device can reach an existing
// account, so these cover both that it works and that it cannot be abused.

let client
beforeEach(() => { client = makeClient() })

const snapshot = {
  familyMembers: [{ id: 'f1', name: 'Asha', alertLevel: 'Level 1', isPrimaryEmergency: true }],
  medicines: [{ id: 'm1', name: 'Metformin', memberId: 'f1', enabledPeriods: ['morning'], stockRemaining: 10 }],
}

describe('integration — device pairing', () => {
  it('mints a code only for an authenticated device', async () => {
    expect((await client.call('POST', '/v1/auth/link-code')).status).toBe(401)
  })

  it('returns a typable code with an expiry', async () => {
    const { token } = await client.register()
    const res = await client.call('POST', '/v1/auth/link-code', { token })

    expect(res.status).toBe(201)
    expect(res.data.code).toMatch(/^[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$/)
    expect(res.data.expiresInMinutes).toBe(10)
    expect(Date.parse(res.data.expiresAt)).toBeGreaterThan(Date.now())
  })

  it('lets a second device join and see the account\'s records', async () => {
    const first = await client.register()
    await client.call('PUT', '/v1/sync', { token: first.token, body: snapshot })
    const { data: { code } } = await client.call('POST', '/v1/auth/link-code', { token: first.token })

    const redeemed = await client.call('POST', '/v1/auth/link-code/redeem', {
      body: { code, platform: 'ios', deviceLabel: 'Second phone' },
    })
    expect(redeemed.status).toBe(201)
    expect(redeemed.data.patientId).toBe(first.patientId)
    expect(redeemed.data.token).toBeTruthy()
    expect(redeemed.data.token).not.toBe(first.token)

    // the new device pulls the same account
    const pulled = await client.call('GET', '/v1/sync', { token: redeemed.data.token })
    expect(pulled.data.medicines[0].id).toBe('m1')
    expect(pulled.data.familyMembers[0].name).toBe('Asha')
  })

  it('accepts the code however the user types it', async () => {
    const first = await client.register()
    const { data: { code } } = await client.call('POST', '/v1/auth/link-code', { token: first.token })
    const messy = ` ${code.replace('-', '').toLowerCase()} `

    const res = await client.call('POST', '/v1/auth/link-code/redeem', { body: { code: messy } })
    expect(res.status).toBe(201)
  })

  it('burns the code after one use', async () => {
    const first = await client.register()
    const { data: { code } } = await client.call('POST', '/v1/auth/link-code', { token: first.token })

    expect((await client.call('POST', '/v1/auth/link-code/redeem', { body: { code } })).status).toBe(201)
    const second = await client.call('POST', '/v1/auth/link-code/redeem', { body: { code } })
    expect(second.status).toBe(401)
  })

  it('replaces an unused code when a fresh one is minted', async () => {
    const first = await client.register()
    const { data: older } = await client.call('POST', '/v1/auth/link-code', { token: first.token })
    await client.call('POST', '/v1/auth/link-code', { token: first.token })

    const res = await client.call('POST', '/v1/auth/link-code/redeem', { body: { code: older.code } })
    expect(res.status).toBe(401)
  })

  it('rejects a code past its expiry', async () => {
    const first = await client.register()
    const { data: { code } } = await client.call('POST', '/v1/auth/link-code', { token: first.token })

    // Backdate the expiry rather than waiting ten minutes.
    await client.env.DB
      .prepare('UPDATE device_link_codes SET expires_at = ? WHERE patient_id = ?')
      .bind('2000-01-01T00:00:00.000Z', first.patientId)
      .run()

    const res = await client.call('POST', '/v1/auth/link-code/redeem', { body: { code } })
    expect(res.status).toBe(401)
    expect(res.error.message).toMatch(/not valid/i)
  })

  it('rejects an unknown code with the same error as a used one', async () => {
    const res = await client.call('POST', '/v1/auth/link-code/redeem', { body: { code: 'ABCDE-FGHJK' } })
    expect(res.status).toBe(401)
    expect(res.error.message).toMatch(/not valid/i)
  })

  it('rejects a malformed code before touching the database', async () => {
    const res = await client.call('POST', '/v1/auth/link-code/redeem', { body: { code: 'nope' } })
    expect(res.status).toBe(400)
  })

  it('rejects codes containing the excluded lookalike characters', async () => {
    // O/0 and I/1/L are not in the alphabet, so a 10-char string using them
    // must never be treated as a valid shape.
    const res = await client.call('POST', '/v1/auth/link-code/redeem', { body: { code: 'OOOO0-11ILL' } })
    expect(res.status).toBe(400)
  })

  it('a paired device pushes into the same account rather than a new one', async () => {
    const first = await client.register()
    await client.call('PUT', '/v1/sync', { token: first.token, body: snapshot })
    const { data: { code } } = await client.call('POST', '/v1/auth/link-code', { token: first.token })
    const second = await client.call('POST', '/v1/auth/link-code/redeem', { body: { code } })

    await client.call('PUT', '/v1/sync', {
      token: second.data.token,
      body: { medicines: [...snapshot.medicines, { id: 'm2', name: 'Aspirin', enabledPeriods: ['night'] }] },
    })

    const asFirstDevice = await client.call('GET', '/v1/sync', { token: first.token })
    expect(asFirstDevice.data.medicines.map((m) => m.id).sort()).toEqual(['m1', 'm2'])
  })

  it('revoking one device leaves the other signed in', async () => {
    const first = await client.register()
    const { data: { code } } = await client.call('POST', '/v1/auth/link-code', { token: first.token })
    const second = await client.call('POST', '/v1/auth/link-code/redeem', { body: { code } })

    await client.call('POST', '/v1/auth/revoke', { token: second.data.token })
    expect((await client.call('GET', '/v1/auth/session', { token: second.data.token })).status).toBe(401)
    expect((await client.call('GET', '/v1/auth/session', { token: first.token })).status).toBe(200)
  })
})
