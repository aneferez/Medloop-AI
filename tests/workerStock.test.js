import { describe, expect, it } from 'vitest'
import {
  applyStockDelta,
  computeDailyConsumption,
  computeLowStockThreshold,
  computeRemainingDays,
  isLowStock,
  projectRunOutDate,
  summarizeStock,
} from '../worker/src/domain/stock.js'
import { DOSE_PERIODS, DOSE_STATUSES, stockDeltaForTransition, takenTimestamp } from '../worker/src/domain/doses.js'
import { normalizeMedicineRow, toPublicMedicine } from '../worker/src/domain/medicine.js'

const med = (over = {}) => ({
  enabledPeriods: ['morning', 'night'],
  doseUnitsPerDose: 1,
  stockRemaining: 20,
  stockBufferDays: 7,
  lowStockThreshold: null,
  stockUnitLabel: 'tablets',
  ...over,
})

describe('stock engine — daily consumption (row #8)', () => {
  it('multiplies enabled periods by units per dose', () => {
    expect(computeDailyConsumption(med())).toBe(2)
    expect(computeDailyConsumption(med({ enabledPeriods: ['morning', 'afternoon', 'night'], doseUnitsPerDose: 2 }))).toBe(6)
    expect(computeDailyConsumption(med({ enabledPeriods: [] }))).toBe(0)
  })
})

describe('stock engine — low-stock threshold (row #10)', () => {
  it('derives the threshold from the buffer of days when none is set', () => {
    expect(computeLowStockThreshold(med())).toBe(14) // 2/day * 7 days
    expect(computeLowStockThreshold(med({ doseUnitsPerDose: 1.5, stockBufferDays: 5 }))).toBe(15) // ceil(3 * 5)
  })

  it('prefers an explicit threshold', () => {
    expect(computeLowStockThreshold(med({ lowStockThreshold: 30 }))).toBe(30)
  })

  it('flags low stock at or below the threshold', () => {
    expect(isLowStock(med({ stockRemaining: 14 }))).toBe(true)
    expect(isLowStock(med({ stockRemaining: 15 }))).toBe(false)
    expect(isLowStock(med({ stockRemaining: null }))).toBe(false)
  })
})

describe('stock engine — remaining days (row #11)', () => {
  it('returns whole days of supply', () => {
    expect(computeRemainingDays(med({ stockRemaining: 20, enabledPeriods: ['morning', 'night'] }))).toBe(10)
    expect(computeRemainingDays(med({ stockRemaining: 21 }))).toBe(10) // floor
  })

  it('is null without a schedule or without tracked stock', () => {
    expect(computeRemainingDays(med({ enabledPeriods: [] }))).toBeNull()
    expect(computeRemainingDays(med({ stockRemaining: null }))).toBeNull()
  })

  it('projects a run-out date from a reference date', () => {
    const from = new Date('2026-08-16T00:00:00.000Z')
    expect(projectRunOutDate(med({ stockRemaining: 20 }), from)).toBe('2026-08-26') // +10 days
    expect(projectRunOutDate(med({ enabledPeriods: [] }), from)).toBeNull()
  })
})

describe('stock engine — summary + delta', () => {
  it('bundles the full picture', () => {
    const summary = summarizeStock(med({ stockRemaining: 10 }), new Date('2026-08-16T00:00:00.000Z'))
    expect(summary).toMatchObject({
      stockRemaining: 10,
      unitLabel: 'tablets',
      dailyConsumption: 2,
      lowStockThreshold: 14,
      remainingDays: 5,
      low: true,
      tracked: true,
    })
  })

  it('never drops stock below zero', () => {
    expect(applyStockDelta(1, -5)).toBe(0)
    expect(applyStockDelta(10, -3)).toBe(7)
    expect(applyStockDelta(10, 5)).toBe(15)
  })
})

describe('dose tracking — status transitions (rows #6, #7, #9)', () => {
  it('exposes the four statuses and three periods', () => {
    expect(DOSE_STATUSES).toEqual(['pending', 'taken', 'missed', 'skipped'])
    expect(DOSE_PERIODS).toEqual(['morning', 'afternoon', 'night'])
  })

  it('consumes stock only when moving into taken', () => {
    expect(stockDeltaForTransition('pending', 'taken', 2)).toBe(-2)
    expect(stockDeltaForTransition('missed', 'taken', 1)).toBe(-1)
  })

  it('restores stock when undoing a taken dose', () => {
    expect(stockDeltaForTransition('taken', 'missed', 2)).toBe(2)
    expect(stockDeltaForTransition('taken', 'pending', 1)).toBe(1)
  })

  it('does nothing for taken->taken or non-taken transitions', () => {
    expect(stockDeltaForTransition('taken', 'taken', 2)).toBe(0)
    expect(stockDeltaForTransition('pending', 'missed', 2)).toBe(0)
    expect(stockDeltaForTransition('missed', 'skipped', 2)).toBe(0)
  })

  it('timestamps only taken doses (row #7)', () => {
    expect(takenTimestamp('taken', '2026-08-16T10:00:00.000Z')).toBe('2026-08-16T10:00:00.000Z')
    expect(takenTimestamp('missed', '2026-08-16T10:00:00.000Z')).toBeNull()
  })
})

describe('medicine normalization', () => {
  it('parses the enabled_periods JSON column', () => {
    const row = { id: 'm', name: 'Metformin', enabled_periods: '["morning","night"]', dose_units_per_dose: 1, stock_remaining: 12 }
    expect(normalizeMedicineRow(row).enabledPeriods).toEqual(['morning', 'night'])
  })

  it('tolerates a malformed enabled_periods value', () => {
    const row = { id: 'm', name: 'X', enabled_periods: 'not-json' }
    expect(normalizeMedicineRow(row).enabledPeriods).toEqual([])
  })

  it('attaches a computed stock summary to the public shape', () => {
    const row = {
      id: 'm', name: 'X', enabled_periods: '["morning","night"]', dose_units_per_dose: 1,
      stock_remaining: 10, stock_buffer_days: 7, stock_unit_label: 'tablets',
    }
    const pub = toPublicMedicine(row, new Date('2026-08-16T00:00:00.000Z'))
    expect(pub.stock.low).toBe(true)
    expect(pub.stock.remainingDays).toBe(5)
  })
})
