import { getMedicineDoses } from './medicineSchedule'

export const DASHBOARD_VARIANTS = Object.freeze([
  { id: 'halo', label: 'Halo' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'companion', label: 'Companion' },
])

export function normalizeDashboardVariant(value) {
  return DASHBOARD_VARIANTS.some((variant) => variant.id === value) ? value : 'halo'
}

export function getDashboardDoses(medicines, dateKey) {
  return (medicines || [])
    .flatMap((medicine) => getMedicineDoses(medicine, dateKey).map((dose) => ({
      ...dose,
      medicineId: medicine.id,
      medicineName: medicine.name,
      dosage: medicine.dosage,
    })))
    .sort((left, right) => left.time.localeCompare(right.time))
}

export function getNextDashboardDose(doses) {
  return doses.find((dose) => dose.status === 'pending')
    || doses.find((dose) => dose.status !== 'taken')
    || null
}

export function getDoseSummary(doses) {
  const taken = doses.filter((dose) => dose.status === 'taken').length
  const missed = doses.filter((dose) => dose.status === 'missed').length
  return {
    taken,
    missed,
    remaining: Math.max(0, doses.length - taken - missed),
    total: doses.length,
  }
}
