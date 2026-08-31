import { describe, expect, it } from 'vitest'
import {
  collectDoseOccurrences,
  escalationWindows,
  minutesOfDay,
  missedDosePush,
  nextEscalation,
} from '../worker/src/domain/escalation.js'

// Pure state-machine tests for the missed-dose escalation engine (feature #7).
// Deterministic via an injected `minutesSince`, no clock or I/O.

describe('escalation — windows', () => {
  it('uses patient settings for normal meds and fast-tracks important ones', () => {
    const settings = { dose_grace_minutes: 15, l2_escalation_minutes: 30 }
    expect(escalationWindows(settings, { important: false })).toEqual({ l1Minutes: 15, l2Minutes: 30 })
    expect(escalationWindows(settings, { important: true })).toEqual({ l1Minutes: 10, l2Minutes: 20 })
  })

  it('keeps Level 2 strictly after Level 1', () => {
    const windows = escalationWindows({ dose_grace_minutes: 20, l2_escalation_minutes: 20 }, {})
    expect(windows.l2Minutes).toBeGreaterThan(windows.l1Minutes)
  })
})

describe('escalation — minutesOfDay', () => {
  it('parses HH:mm and rejects junk', () => {
    expect(minutesOfDay('08:10')).toBe(490)
    expect(minutesOfDay('00:00')).toBe(0)
    expect(minutesOfDay('23:59')).toBe(1439)
    expect(minutesOfDay('')).toBeNull()
    expect(minutesOfDay('9:5')).toBeNull()
    expect(minutesOfDay('24:00')).toBeNull()
  })
})

describe('escalation — occurrences', () => {
  it('collects only enabled, timed dose slots', () => {
    const medicines = [
      { id: 'm1', name: 'A', enabledPeriods: ['morning', 'night'], times: { morning: '08:00', night: null } },
      { id: 'm2', name: 'B', enabledPeriods: ['afternoon'], times: { afternoon: '13:30' } },
    ]
    const occ = collectDoseOccurrences(medicines)
    expect(occ.map((o) => `${o.medicineId}:${o.period}`)).toEqual(['m1:morning', 'm2:afternoon'])
  })
})

describe('escalation — state machine', () => {
  const windows = { l1Minutes: 15, l2Minutes: 30 }

  it('does nothing before the grace window', () => {
    expect(nextEscalation({ currentStage: 'pending', minutesSince: 10, windows }))
      .toEqual({ newStage: 'pending', fire: [] })
  })

  it('fires Level 1 at the grace window', () => {
    expect(nextEscalation({ currentStage: 'pending', minutesSince: 15, windows }))
      .toEqual({ newStage: 'l1_notified', fire: ['Level 1'] })
  })

  it('fires only Level 2 once Level 1 already went out', () => {
    expect(nextEscalation({ currentStage: 'l1_notified', minutesSince: 30, windows }))
      .toEqual({ newStage: 'l2_notified', fire: ['Level 2'] })
  })

  it('catches up with both levels in one tick after downtime', () => {
    expect(nextEscalation({ currentStage: 'pending', minutesSince: 40, windows }))
      .toEqual({ newStage: 'l2_notified', fire: ['Level 1', 'Level 2'] })
  })

  it('does not re-fire once at Level 2', () => {
    expect(nextEscalation({ currentStage: 'l2_notified', minutesSince: 90, windows }))
      .toEqual({ newStage: 'l2_notified', fire: [] })
  })

  it('resolves when taken and skips when skipped, firing nothing', () => {
    expect(nextEscalation({ currentStage: 'l1_notified', minutesSince: 40, windows, taken: true }))
      .toEqual({ newStage: 'resolved', fire: [] })
    expect(nextEscalation({ currentStage: 'pending', minutesSince: 40, windows, skipped: true }))
      .toEqual({ newStage: 'skipped', fire: [] })
  })
})

describe('escalation — push copy is PII-free (guardrail G3)', () => {
  it('never contains a medicine name', () => {
    const l1 = missedDosePush('Level 1')
    const l2 = missedDosePush('Level 2')
    const text = `${l1.title} ${l1.body} ${l2.title} ${l2.body}`.toLowerCase()
    for (const name of ['metformin', 'aspirin', 'insulin']) expect(text).not.toContain(name)
  })
})
