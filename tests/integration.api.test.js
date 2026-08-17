import { beforeEach, describe, expect, it } from 'vitest'
import { makeClient } from './helpers/testWorker.js'

let client
beforeEach(() => { client = makeClient() })

describe('integration — system + auth', () => {
  it('serves health with a live D1 binding', async () => {
    const res = await client.call('GET', '/v1/health')
    expect(res.status).toBe(200)
    expect(res.data.database).toBe('ok')
    expect(res.data.files).toBe('disabled')
  })

  it('registers a device and resolves the session with its token', async () => {
    const { token, patientId } = await client.register()
    expect(token).toBeTruthy()
    const session = await client.call('GET', '/v1/auth/session', { token })
    expect(session.status).toBe(200)
    expect(session.data.patient.id).toBe(patientId)
    expect(session.data.device.hasFcmToken).toBe(false)
  })

  it('rejects protected routes without a valid token', async () => {
    expect((await client.call('GET', '/v1/family')).status).toBe(401)
    expect((await client.call('GET', '/v1/family', { token: 'garbage' })).status).toBe(401)
  })

  it('returns 404/405 for unknown routes and wrong methods', async () => {
    const { token } = await client.register()
    expect((await client.call('GET', '/v1/nope', { token })).status).toBe(404)
    expect((await client.call('DELETE', '/v1/health')).status).toBe(405)
  })
})

describe('integration — family (single Level 1, primary contact)', () => {
  it('creates, lists, and validates family members', async () => {
    const { token } = await client.register()
    const created = await client.call('POST', '/v1/family', { token, body: { name: 'Asha', alertLevel: 'Level 2', phone: '+14155550123' } })
    expect(created.status).toBe(201)
    expect(created.data.member.name).toBe('Asha')

    const list = await client.call('GET', '/v1/family', { token })
    expect(list.data.members).toHaveLength(1)
    expect(list.data.latestUpdatedId).toBe(created.data.member.id)

    const invalid = await client.call('POST', '/v1/family', { token, body: {} })
    expect(invalid.status).toBe(422)
    expect(invalid.error.details.name).toBeTruthy()
  })

  it('enforces a single Level 1 member by demoting the previous one', async () => {
    const { token } = await client.register()
    const first = await client.call('POST', '/v1/family', { token, body: { name: 'Asha', alertLevel: 'Level 1' } })
    await client.call('POST', '/v1/family', { token, body: { name: 'Ravi', alertLevel: 'Level 1' } })

    const refreshed = await client.call('GET', `/v1/family/${first.data.member.id}`, { token })
    expect(refreshed.data.member.alertLevel).toBe('Level 2')
  })

  it('designates and resolves the primary emergency contact', async () => {
    const { token } = await client.register()
    const asha = await client.call('POST', '/v1/family', { token, body: { name: 'Asha', alertLevel: 'Level 2', phone: '+14155550123' } })
    await client.call('POST', `/v1/family/${asha.data.member.id}/primary`, { token })

    const primary = await client.call('GET', '/v1/family/primary', { token })
    expect(primary.data.member.id).toBe(asha.data.member.id)
    expect(primary.data.member.isPrimaryEmergency).toBe(true)
  })
})

describe('integration — medicine & stock engine', () => {
  async function seedMedicine(token, over = {}) {
    const res = await client.call('POST', '/v1/medicines', {
      token,
      body: { name: 'Metformin', enabledPeriods: ['morning', 'night'], stockRemaining: 20, doseUnitsPerDose: 1, stockBufferDays: 7, ...over },
    })
    return res.data.medicine
  }

  it('computes the stock summary on create', async () => {
    const { token } = await client.register()
    const medicine = await seedMedicine(token)
    expect(medicine.stock).toMatchObject({ dailyConsumption: 2, lowStockThreshold: 14, remainingDays: 10, low: false })
  })

  it('auto-decrements stock on a taken dose and restores it on undo', async () => {
    const { token } = await client.register()
    const medicine = await seedMedicine(token)

    const taken = await client.call('POST', `/v1/medicines/${medicine.id}/dose`, { token, body: { period: 'morning', status: 'taken', doseDate: '2026-08-16' } })
    expect(taken.status).toBe(201)
    expect(taken.data.previousStatus).toBe('pending')
    expect(taken.data.stock.stockRemaining).toBe(19)

    // Recording taken again must not double-count.
    const again = await client.call('POST', `/v1/medicines/${medicine.id}/dose`, { token, body: { period: 'morning', status: 'taken', doseDate: '2026-08-16' } })
    expect(again.data.stock.stockRemaining).toBe(19)

    // Undo restores the unit.
    const undo = await client.call('POST', `/v1/medicines/${medicine.id}/dose`, { token, body: { period: 'morning', status: 'missed', doseDate: '2026-08-16' } })
    expect(undo.data.stock.stockRemaining).toBe(20)
  })

  it('flags low stock in the summary', async () => {
    const { token } = await client.register()
    const medicine = await seedMedicine(token, { stockRemaining: 10 })
    const summary = await client.call('GET', '/v1/stock/summary', { token })
    const item = summary.data.items.find((entry) => entry.id === medicine.id)
    expect(item.low).toBe(true)
    expect(summary.data.lowStockIds).toContain(medicine.id)
  })
})

describe('integration — alerts + notification history', () => {
  it('creates an alert and records a notification per recipient/channel', async () => {
    const { token } = await client.register()
    // Give the patient's own device a push token so a plan exists.
    await client.call('PATCH', '/v1/auth/device', { token, body: { fcmToken: 'device-token' } })

    const alert = await client.call('POST', '/v1/alerts', { token, body: { type: 'stock', title: 'Low stock', detail: 'Metformin low', level: 'Level 2' } })
    expect(alert.status).toBe(201)
    expect(alert.data.alert.type).toBe('stock')
    // FCM not configured in tests, so the push attempt is recorded as skipped.
    expect(alert.data.notifications[0]).toMatchObject({ channel: 'push', status: 'skipped' })

    const history = await client.call('GET', '/v1/notifications', { token })
    expect(history.data.notifications.length).toBeGreaterThan(0)
    expect(history.data.notifications[0].channel).toBe('push')
  })
})
