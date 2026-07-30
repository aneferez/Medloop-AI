import { describe, expect, it } from 'vitest'
import { getDoseStatus, getDoseStatusesForDate, getLocalDateKey, normalizeMedicineSchedule } from '../src/lib/medicineSchedule'

describe('daily dose status lifecycle', () => {
  it('retains statuses for their saved day and resets them after midnight', () => {
    const medicine = normalizeMedicineSchedule({
      id: 'medicine-1',
      enabledDosePeriods: ['morning', 'night'],
      doseStatusesDate: '2026-07-30',
      doseStatuses: { morning: 'taken', night: 'missed' },
    })

    expect(getDoseStatus(medicine, 'morning', '2026-07-30')).toBe('taken')
    expect(getDoseStatus(medicine, 'night', '2026-07-30')).toBe('missed')
    expect(getDoseStatusesForDate(medicine, '2026-07-31')).toEqual({
      morning: 'pending', afternoon: 'pending', night: 'pending',
    })
  })

  it('creates local calendar keys without UTC date drift', () => {
    expect(getLocalDateKey(new Date(2026, 6, 30, 23, 59, 59))).toBe('2026-07-30')
    expect(getLocalDateKey(new Date(2026, 6, 31, 0, 0, 1))).toBe('2026-07-31')
  })
})
