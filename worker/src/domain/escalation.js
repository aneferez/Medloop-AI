// Missed-dose escalation (feature #7 / rows #17, #21, #22) — pure helpers, no I/O,
// fully unit-testable with an injected clock. The service in scheduledJobs.js
// wires these to D1 and the alert dispatcher.

import { PERIOD_TIME_COLUMN } from './doses.js'

export const ESCALATION_STAGES = ['pending', 'l1_notified', 'l2_notified', 'resolved', 'skipped']
const STAGE_RANK = { pending: 0, l1_notified: 1, l2_notified: 2, resolved: 3, skipped: 3 }
export const stageRank = (stage) => STAGE_RANK[stage] ?? 0

// "HH:mm" -> minutes since local midnight, or null when unset/invalid.
export function minutesOfDay(hhmm) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(hhmm ?? ''))
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

// Escalation windows (minutes after the scheduled time) for a medicine. Important
// medicines fast-track to 10/20; everyone else uses the patient's configured
// grace/L2 windows (defaults 15/30). L2 always strictly follows L1.
export function escalationWindows(settings = {}, medicine = {}) {
  const important = Boolean(medicine.important)
  const grace = Number(settings.dose_grace_minutes ?? 15)
  const l2 = Number(settings.l2_escalation_minutes ?? 30)
  const l1Minutes = important ? Math.min(10, grace) : grace
  const l2Minutes = important ? Math.min(20, l2) : l2
  return { l1Minutes, l2Minutes: Math.max(l2Minutes, l1Minutes + 1) }
}

// Enabled dose occurrences for the day that have a scheduled time set. Untimed
// slots can't be "late", so they never escalate.
export function collectDoseOccurrences(medicines, { periodTimeColumn = PERIOD_TIME_COLUMN } = {}) {
  void periodTimeColumn // times come pre-parsed on the normalized medicine
  const occurrences = []
  for (const medicine of medicines) {
    for (const period of medicine.enabledPeriods) {
      const time = medicine.times?.[period] ?? null
      const scheduledMinute = minutesOfDay(time)
      if (scheduledMinute == null) continue
      occurrences.push({
        medicineId: medicine.id,
        name: medicine.name,
        important: Boolean(medicine.important),
        period,
        time,
        scheduledMinute,
      })
    }
  }
  return occurrences
}

// The core state machine. Given the stored stage, how many minutes ago the dose
// was due, the windows, and whether it was taken/skipped, decide the new stage
// and which caregiver levels to notify on this tick. A resolved/skipped/taken
// dose fires nothing; a dose can cross both windows in one tick after downtime.
export function nextEscalation({ currentStage = 'pending', minutesSince, windows, taken = false, skipped = false }) {
  if (skipped) return { newStage: 'skipped', fire: [] }
  if (taken) return { newStage: 'resolved', fire: [] }
  if (stageRank(currentStage) >= stageRank('l2_notified')) return { newStage: currentStage, fire: [] }

  const fire = []
  let stage = currentStage
  if (minutesSince >= windows.l1Minutes && stageRank(stage) < stageRank('l1_notified')) {
    fire.push('Level 1')
    stage = 'l1_notified'
  }
  if (minutesSince >= windows.l2Minutes && stageRank(stage) < stageRank('l2_notified')) {
    fire.push('Level 2')
    stage = 'l2_notified'
  }
  return { newStage: stage, fire }
}

// Generic, PII-FREE push copy (guardrail G3): it must NEVER contain the medicine
// name, dosage, or any health detail. The specifics live only in the in-app
// alert fetched over the authenticated API (data.alertId points to it). Works for
// both the patient's own nudge and the caregiver notification.
export function missedDosePush(level) {
  if (level === 'Level 2') {
    return {
      title: 'MedLoop: a dose is still not taken',
      body: 'A scheduled dose still has not been marked as taken. Please open MedLoop to check in.',
    }
  }
  return {
    title: 'MedLoop medication reminder',
    body: 'A scheduled dose has not been marked as taken yet. Open MedLoop for details.',
  }
}
