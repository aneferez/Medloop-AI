import { ok, readJsonBody } from '../lib/http.js'
import { Validator } from '../lib/validate.js'
import { nowIso } from '../lib/ids.js'

// Patient-level notification preferences (row #17) and scheduled-job settings
// (Module E: daily_check_time = row #13, restock_day = row #12).

const SETTINGS_COLUMNS = {
  reminderLeadMinutes: 'reminder_lead_minutes',
  pushEnabled: 'push_enabled',
  whatsappEnabled: 'whatsapp_enabled',
  emailEnabled: 'email_enabled',
  dailyCheckTime: 'daily_check_time',
  restockDay: 'restock_day',
  timezone: 'timezone',
  doseGraceMinutes: 'dose_grace_minutes',
  l2EscalationMinutes: 'l2_escalation_minutes',
  escalationEnabled: 'escalation_enabled',
}

function toPublicSettings(row) {
  return {
    reminderLeadMinutes: row.reminder_lead_minutes,
    channels: {
      push: Boolean(row.push_enabled),
      whatsapp: Boolean(row.whatsapp_enabled),
      email: Boolean(row.email_enabled),
    },
    dailyCheckTime: row.daily_check_time,
    restockDay: row.restock_day,
    timezone: row.timezone,
    escalation: {
      enabled: Boolean(row.escalation_enabled),
      graceMinutes: row.dose_grace_minutes,       // scheduled -> Level 1
      l2Minutes: row.l2_escalation_minutes,       // scheduled -> Level 2
    },
    updatedAt: row.updated_at,
  }
}

// Reads settings, inserting the default row for older accounts that predate it.
async function ensureSettings(ctx) {
  const patientId = ctx.auth.patient.id
  let row = await ctx.db.first('SELECT * FROM patient_settings WHERE patient_id = ?', [patientId])
  if (!row) {
    await ctx.db.run('INSERT INTO patient_settings (patient_id, updated_at) VALUES (?, ?)', [patientId, nowIso()])
    row = await ctx.db.first('SELECT * FROM patient_settings WHERE patient_id = ?', [patientId])
  }
  return row
}

export function registerSettingsRoutes(router) {
  router.get('/settings', async (ctx) => {
    const row = await ensureSettings(ctx)
    return ok({ settings: toPublicSettings(row) })
  })

  router.patch('/settings', async (ctx) => {
    await ensureSettings(ctx)
    const body = await readJsonBody(ctx.request)
    const v = new Validator(body)
    v.integer('reminderLeadMinutes', { min: 0, max: 240 })
    v.boolean('pushEnabled')
    v.boolean('whatsappEnabled')
    v.boolean('emailEnabled')
    v.time('dailyCheckTime')
    v.integer('restockDay', { min: 1, max: 28 })
    v.string('timezone', { max: 64 })
    v.integer('doseGraceMinutes', { min: 1, max: 240 })
    v.integer('l2EscalationMinutes', { min: 2, max: 480 })
    v.boolean('escalationEnabled')
    const input = v.ensureValid()

    const sets = []
    const params = []
    for (const [key, column] of Object.entries(SETTINGS_COLUMNS)) {
      if (key in input) {
        const value = input[key]
        sets.push(`${column} = ?`)
        params.push(typeof value === 'boolean' ? (value ? 1 : 0) : value)
      }
    }
    sets.push('updated_at = ?')
    params.push(nowIso(), ctx.auth.patient.id)
    await ctx.db.run(`UPDATE patient_settings SET ${sets.join(', ')} WHERE patient_id = ?`, params)

    const row = await ctx.db.first('SELECT * FROM patient_settings WHERE patient_id = ?', [ctx.auth.patient.id])
    return ok({ settings: toPublicSettings(row) })
  })
}
