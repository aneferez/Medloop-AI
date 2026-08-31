import { describe, expect, it } from 'vitest'
import {
  effectiveDailyConsumption,
  observedDailyConsumption,
  predictRemainingDays,
  predictStock,
  shiftIsoDate,
} from '../worker/src/domain/stock.js'
import { computeAdherence } from '../worker/src/domain/adherence.js'

// Pure tests for predictive stock (feature #4) and adherence (#12).

const med = (over = {}) => ({
  enabledPeriods: ['morning', 'night'],
  doseUnitsPerDose: 1,
  stockRemaining: 20,
  stockBufferDays: 7,
  lowStockThreshold: null,
  stockUnitLabel: 'tablets',
  ...over,
})

describe('stock prediction — observed rate', () => {
  it('computes units/day from taken doses over a window', () => {
    expect(observedDailyConsumption({ takenDoses: 14, windowDays: 14, unitsPerDose: 1 })).toBe(1)
    expect(observedDailyConsumption({ takenDoses: 7, windowDays: 14, unitsPerDose: 2 })).toBe(1)
    expect(observedDailyConsumption({ takenDoses: 0, windowDays: 14 })).toBe(0)
  })

  it('falls back to nominal without enough history', () => {
    expect(effectiveDailyConsumption(med(), { takenDoses: 1, windowDays: 14 })).toEqual({ daily: 2, basis: 'nominal' })
  })

  it('uses the observed rate once there is enough history', () => {
    const result = effectiveDailyConsumption(med({ doseUnitsPerDose: 1 }), { takenDoses: 42, windowDays: 14 })
    expect(result.basis).toBe('observed')
    expect(result.daily).toBe(3) // 42 / 14
  })
})

describe('stock prediction — predictStock', () => {
  it('predicts fewer days when consumption runs hot', () => {
    const prediction = predictStock(med({ stockRemaining: 20 }), {
      takenDoses: 56, windowDays: 14, fromDate: new Date('2026-09-01T00:00:00Z'),
    })
    expect(prediction.basis).toBe('observed')
    expect(prediction.predictedDailyConsumption).toBe(4) // 56 / 14
    expect(prediction.predictedDaysRemaining).toBe(5) // floor(20 / 4)
    expect(prediction.predictedRunOutDate).toBe('2026-09-06')
    expect(prediction.predictedLow).toBe(true) // 5 <= buffer 7
  })

  it('is null-safe when stock is untracked', () => {
    const prediction = predictStock(med({ stockRemaining: null }), { takenDoses: 20, windowDays: 14 })
    expect(prediction.predictedDaysRemaining).toBeNull()
    expect(prediction.predictedLow).toBe(false)
  })

  it('floors remaining days and guards a zero rate', () => {
    expect(predictRemainingDays(21, 2)).toBe(10)
    expect(predictRemainingDays(10, 0)).toBeNull()
    expect(predictRemainingDays(null, 2)).toBeNull()
  })
})

describe('stock — shiftIsoDate', () => {
  it('shifts a date string by whole days', () => {
    expect(shiftIsoDate('2026-09-01', -13)).toBe('2026-08-19')
    expect(shiftIsoDate('2026-08-31', 1)).toBe('2026-09-01')
  })
})

describe('adherence — computeAdherence', () => {
  it('aggregates per-medicine and overall rates', () => {
    const rows = [
      { medicine_id: 'm1', medicine_name: 'A', status: 'taken', n: 8 },
      { medicine_id: 'm1', medicine_name: 'A', status: 'missed', n: 2 },
      { medicine_id: 'm2', medicine_name: 'B', status: 'taken', n: 5 },
      { medicine_id: 'm2', medicine_name: 'B', status: 'skipped', n: 5 },
    ]
    const report = computeAdherence(rows, { rangeDays: 30 })
    expect(report.medicines.find((m) => m.medicineId === 'm1').adherenceRate).toBe(80) // 8/10
    expect(report.medicines.find((m) => m.medicineId === 'm2').adherenceRate).toBe(50) // 5/10
    expect(report.overall.taken).toBe(13)
    expect(report.overall.adherenceRate).toBe(65) // 13/20
  })

  it('returns a null rate with no logged doses', () => {
    const report = computeAdherence([], { rangeDays: 7 })
    expect(report.overall.adherenceRate).toBeNull()
    expect(report.medicines).toEqual([])
  })
})
