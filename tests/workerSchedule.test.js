import { describe, expect, it } from 'vitest'
import {
  DAILY_CRON,
  RESTOCK_CRON,
  buildDailyCheckAlert,
  buildRestockAlert,
  collectOutstandingDoses,
  collectRestockNeeds,
  localDateParts,
} from '../worker/src/domain/schedule.js'

const med = (over = {}) => ({
  id: 'm',
  name: 'Med',
  enabledPeriods: ['morning'],
  doseUnitsPerDose: 1,
  stockRemaining: 5,
  stockBufferDays: 7,
  lowStockThreshold: null,
  ...over,
})

describe('schedule — local time zone (row #13/#12 timing)', () => {
  it('converts a UTC instant to the local calendar date (Asia/Kolkata)', () => {
    const evening = localDateParts(new Date('2026-08-16T18:00:00.000Z'), 'Asia/Kolkata')
    expect(evening).toMatchObject({ date: '2026-08-16', day: 16, hour: 23, minute: 30 })
  })

  it('rolls over to the next local day past UTC midnight offset', () => {
    const late = localDateParts(new Date('2026-08-16T19:00:00.000Z'), 'Asia/Kolkata')
    expect(late).toMatchObject({ date: '2026-08-17', day: 17, hour: 0 })
  })

  it('exposes stable cron expressions', () => {
    expect(DAILY_CRON).toBe('30 16 * * *')
    expect(RESTOCK_CRON).toBe('30 3 20 * *')
  })
})

describe('schedule — outstanding doses (row #13)', () => {
  it('lists enabled periods that are not taken', () => {
    const medicines = [
      med({ id: 'a', name: 'A', enabledPeriods: ['morning', 'night'] }),
      med({ id: 'b', name: 'B', enabledPeriods: ['afternoon'] }),
    ]
    const taken = new Set(['a:morning'])
    expect(collectOutstandingDoses(medicines, taken)).toEqual([
      { medicineId: 'a', name: 'A', period: 'night' },
      { medicineId: 'b', name: 'B', period: 'afternoon' },
    ])
  })

  it('returns nothing when every dose is taken', () => {
    const medicines = [med({ id: 'a', name: 'A', enabledPeriods: ['morning'] })]
    expect(collectOutstandingDoses(medicines, new Set(['a:morning']))).toEqual([])
  })
})

describe('schedule — restock needs (row #12)', () => {
  it('includes low stock and soon-to-run-out, excludes healthy and untracked', () => {
    const medicines = [
      med({ id: 'low', name: 'Low', stockRemaining: 5, stockBufferDays: 7 }), // threshold 7 -> low
      med({ id: 'plenty', name: 'Plenty', stockRemaining: 100, stockBufferDays: 7 }), // ~100 days
      med({ id: 'untracked', name: 'Untracked', stockRemaining: null }),
      med({ id: 'soon', name: 'Soon', stockRemaining: 20, stockBufferDays: 3 }), // not low, but 20 days left
    ]
    const needs = collectRestockNeeds(medicines, { horizonDays: 30 })
    expect(needs.map((need) => need.id).sort()).toEqual(['low', 'soon'])
    expect(needs.find((need) => need.id === 'low').low).toBe(true)
  })
})

describe('schedule — alert copy', () => {
  it('summarizes the daily check', () => {
    const alert = buildDailyCheckAlert(
      [{ medicineId: 'a', name: 'Metformin', period: 'morning' }],
      { date: '2026-08-16' },
    )
    expect(alert.title).toContain('1 dose not taken')
    expect(alert.detail).toContain('Metformin')
    expect(alert.level).toBe('Level 2')
  })

  it('summarizes the restock reminder', () => {
    const alert = buildRestockAlert([{ id: 'a', name: 'Metformin' }, { id: 'b', name: 'Aspirin' }])
    expect(alert.title).toContain('2 medicines running low')
    expect(alert.detail).toContain('Metformin, Aspirin')
  })
})
