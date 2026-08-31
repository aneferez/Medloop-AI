import { beforeEach, describe, expect, it } from 'vitest'
import { makeClient } from './helpers/testWorker.js'

// End-to-end missed-dose escalation (feature #7 / M2). The patient's timezone is
// pinned to UTC and the sweep is driven with an injected `now`, so the staggered
// Level 1 -> Level 2 timing is deterministic. Assertions read D1 directly for the
// escalation state, alerts, and which caregiver each notification targeted.

let client
beforeEach(() => { client = makeClient() })

const DATE = '2026-09-01'
const at = (hhmm) => `${DATE}T${hhmm}:00Z`

async function setup(settings = {}) {
  const acct = (await client.call('POST', '/v1/auth/signup', {
    body: { email: `p_${Math.random().toString(16).slice(2)}@example.com`, password: 'escalate me 8' },
  })).data
  await client.call('PATCH', '/v1/settings', { token: acct.token, body: { timezone: 'UTC', ...settings } })
  return acct
}

// Insert a caregiver contact directly with a push token so an alert to their
// level produces a notification row we can assert on.
async function addFamily(patientId, { name, alertLevel }) {
  const now = new Date().toISOString()
  await client.env.DB.prepare(
    `INSERT INTO family_members (id, patient_id, name, relationship, alert_level, fcm_token, notify_push, created_at, updated_at)
     VALUES (?, ?, ?, 'Family', ?, ?, 1, ?, ?)`,
  ).bind(name, patientId, name, alertLevel, `tok_${name}`, now, now).run()
  return name
}

async function addMedicine(token, body) {
  const res = await client.call('POST', '/v1/medicines', { token, body })
  return res.data.medicine.id
}

const sweep = (token, now) => client.call('POST', '/v1/jobs/escalation-check', { token, body: { now } })

async function stageOf(patientId, medicineId, period = 'morning') {
  const row = await client.env.DB
    .prepare('SELECT stage FROM dose_escalations WHERE patient_id = ? AND medicine_id = ? AND dose_period = ?')
    .bind(patientId, medicineId, period).first()
  return row ? row.stage : null
}

async function alerts(patientId) {
  const { results } = await client.env.DB
    .prepare('SELECT level, ref_id FROM alerts WHERE patient_id = ? ORDER BY created_at').bind(patientId).all()
  return results
}

async function recipientsForLevel(patientId, level) {
  const { results } = await client.env.DB
    .prepare(
      `SELECT n.recipient_id AS rid FROM notifications n
       JOIN alerts a ON a.id = n.alert_id
       WHERE a.patient_id = ? AND a.level = ?`,
    ).bind(patientId, level).all()
  return results.map((r) => r.rid).sort()
}

describe('integration — missed-dose escalation', () => {
  it('escalates Level 1 then Level 2, targeting each level exactly, and is idempotent', async () => {
    const acct = await setup()
    await addFamily(acct.patientId, { name: 'asha', alertLevel: 'Level 1' })
    await addFamily(acct.patientId, { name: 'ben', alertLevel: 'Level 2' })
    const medId = await addMedicine(acct.token, { name: 'Metformin', enabledPeriods: ['morning'], morningTime: '08:10' })

    // +20 min -> Level 1
    const l1 = await sweep(acct.token, at('08:30'))
    expect(l1.data.notified).toBe(1)
    expect(await stageOf(acct.patientId, medId)).toBe('l1_notified')
    expect(await recipientsForLevel(acct.patientId, 'Level 1')).toEqual(['asha'])

    // same window again -> nothing new (dedup)
    const again = await sweep(acct.token, at('08:30'))
    expect(again.data.notified).toBe(0)
    expect((await alerts(acct.patientId)).length).toBe(1)

    // +35 min -> Level 2 (Level 1 not re-notified)
    const l2 = await sweep(acct.token, at('08:45'))
    expect(l2.data.notified).toBe(1)
    expect(await stageOf(acct.patientId, medId)).toBe('l2_notified')
    expect(await recipientsForLevel(acct.patientId, 'Level 2')).toEqual(['ben'])

    const all = await alerts(acct.patientId)
    expect(all.map((a) => a.level).sort()).toEqual(['Level 1', 'Level 2'])
  })

  it('stops escalating once the dose is taken', async () => {
    const acct = await setup()
    await addFamily(acct.patientId, { name: 'asha', alertLevel: 'Level 1' })
    const medId = await addMedicine(acct.token, { name: 'Metformin', enabledPeriods: ['morning'], morningTime: '08:10' })

    await sweep(acct.token, at('08:30')) // Level 1 fired
    await client.call('POST', `/v1/medicines/${medId}/dose`, {
      token: acct.token, body: { period: 'morning', status: 'taken', doseDate: DATE },
    })

    const after = await sweep(acct.token, at('08:45'))
    expect(after.data.notified).toBe(0)
    expect(await stageOf(acct.patientId, medId)).toBe('resolved')
    expect((await alerts(acct.patientId)).length).toBe(1) // no Level 2
  })

  it('never escalates a dose taken on time', async () => {
    const acct = await setup()
    await addFamily(acct.patientId, { name: 'asha', alertLevel: 'Level 1' })
    const medId = await addMedicine(acct.token, { name: 'Metformin', enabledPeriods: ['morning'], morningTime: '08:10' })
    await client.call('POST', `/v1/medicines/${medId}/dose`, {
      token: acct.token, body: { period: 'morning', status: 'taken', doseDate: DATE },
    })

    const res = await sweep(acct.token, at('08:40'))
    expect(res.data.notified).toBe(0)
    expect((await alerts(acct.patientId)).length).toBe(0)
  })

  it('fast-tracks important medicines ahead of normal ones', async () => {
    const acct = await setup()
    await addFamily(acct.patientId, { name: 'asha', alertLevel: 'Level 1' })
    const important = await addMedicine(acct.token, { name: 'Insulin', enabledPeriods: ['morning'], morningTime: '08:18', important: true })
    const normal = await addMedicine(acct.token, { name: 'Vitamin', enabledPeriods: ['morning'], morningTime: '08:18', important: false })

    // +12 min: important (L1 at 10) fires; normal (L1 at 15) does not
    const res = await sweep(acct.token, at('08:30'))
    expect(res.data.notified).toBe(1)
    expect(await stageOf(acct.patientId, important)).toBe('l1_notified')
    expect(await stageOf(acct.patientId, normal)).toBeNull()
  })

  it('does nothing when escalation is disabled', async () => {
    const acct = await setup({ escalationEnabled: false })
    await addMedicine(acct.token, { name: 'Metformin', enabledPeriods: ['morning'], morningTime: '08:10' })
    const res = await sweep(acct.token, at('08:40'))
    expect(res.data.skipped).toBe('escalation_disabled')
    expect((await alerts(acct.patientId)).length).toBe(0)
  })

  it('honors a patient-configured grace window', async () => {
    const acct = await setup({ doseGraceMinutes: 5, l2EscalationMinutes: 10 })
    await addFamily(acct.patientId, { name: 'asha', alertLevel: 'Level 1' })
    const medId = await addMedicine(acct.token, { name: 'Metformin', enabledPeriods: ['morning'], morningTime: '08:10' })

    // +6 min already past the 5-min grace -> Level 1
    const res = await sweep(acct.token, at('08:16'))
    expect(res.data.notified).toBe(1)
    expect(await stageOf(acct.patientId, medId)).toBe('l1_notified')
  })
})
