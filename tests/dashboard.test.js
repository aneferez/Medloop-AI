import { describe, expect, it } from 'vitest'
import { getDashboardDoses, getDoseSummary, getNextDashboardDose, normalizeDashboardVariant } from '../src/lib/dashboard'
import { sanitizeSettings } from '../src/lib/settings'

const medicines = [
  {
    id: 'metformin',
    name: 'Metformin',
    dosage: '500 mg',
    morningTime: '08:00',
    nightTime: '20:00',
    enabledDosePeriods: ['morning', 'night'],
    doseStatusesDate: '2026-07-30',
    doseStatuses: { morning: 'taken', night: 'pending' },
  },
  {
    id: 'vitamin-d',
    name: 'Vitamin D',
    dosage: '1000 IU',
    afternoonTime: '13:00',
    enabledDosePeriods: ['afternoon'],
    doseStatusesDate: '2026-07-30',
    doseStatuses: { afternoon: 'missed' },
  },
]

describe('dashboard design collection', () => {
  it('builds a chronological dose rail and identifies the next pending dose', () => {
    const doses = getDashboardDoses(medicines, '2026-07-30')

    expect(doses.map((dose) => dose.time)).toEqual(['08:00', '13:00', '20:00'])
    expect(getNextDashboardDose(doses)).toMatchObject({ medicineId: 'metformin', id: 'night' })
    expect(getDoseSummary(doses)).toEqual({ taken: 1, missed: 1, remaining: 1, total: 3 })
  })

  it('persists only supported dashboard styles and safely falls back to Halo', () => {
    expect(normalizeDashboardVariant('timeline')).toBe('timeline')
    expect(normalizeDashboardVariant('unknown')).toBe('halo')
    expect(sanitizeSettings({ dashboardVariant: 'companion' }).dashboardVariant).toBe('companion')
    expect(sanitizeSettings({ dashboardVariant: 'unknown' }).dashboardVariant).toBe('halo')
  })
})
