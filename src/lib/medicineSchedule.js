import { normalizeMedicineStock } from './medicineStock'

export const DOSE_PERIODS = Object.freeze([
  { id: 'morning', label: 'Morning', timeField: 'morningTime', defaultTime: '08:00' },
  { id: 'afternoon', label: 'Afternoon', timeField: 'afternoonTime', defaultTime: '13:00' },
  { id: 'night', label: 'Night', timeField: 'nightTime', defaultTime: '20:00' },
])

const VALID_STATUSES = new Set(['pending', 'taken', 'missed'])
const DOSE_PERIOD_IDS = new Set(DOSE_PERIODS.map((period) => period.id))
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function getLocalDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function normalizeEnabledDosePeriods(periods) {
  if (Array.isArray(periods)) {
    return [...new Set(periods.filter((periodId) => DOSE_PERIOD_IDS.has(periodId)))]
  }

  if (periods && typeof periods === 'object') {
    return DOSE_PERIODS.filter((period) => periods[period.id]).map((period) => period.id)
  }

  // Medicines saved before interval selection was added used all three periods.
  return DOSE_PERIODS.map((period) => period.id)
}

export function normalizeDoseStatuses(statuses, legacyStatus = 'pending') {
  return DOSE_PERIODS.reduce((result, period, index) => {
    const fallback = index === 0 && VALID_STATUSES.has(legacyStatus) ? legacyStatus : 'pending'
    const status = statuses?.[period.id]
    result[period.id] = VALID_STATUSES.has(status) ? status : fallback
    return result
  }, {})
}

export function normalizeMedicineSchedule(medicine) {
  const { time, status, ...record } = medicine || {}
  const stock = normalizeMedicineStock(record)
  return {
    ...record,
    morningTime: record.morningTime || time || '08:00',
    afternoonTime: record.afternoonTime || '13:00',
    nightTime: record.nightTime || '20:00',
    enabledDosePeriods: normalizeEnabledDosePeriods(record.enabledDosePeriods),
    doseStatuses: normalizeDoseStatuses(record.doseStatuses, status),
    doseStatusesDate: DATE_KEY_PATTERN.test(String(record.doseStatusesDate || '')) ? record.doseStatusesDate : null,
    ...stock,
  }
}

export function isDosePeriodEnabled(medicine, periodId) {
  return normalizeEnabledDosePeriods(medicine?.enabledDosePeriods).includes(periodId)
}

export function getEnabledDosePeriods(medicine) {
  return DOSE_PERIODS.filter((period) => isDosePeriodEnabled(medicine, period.id))
}

export function getDoseTime(medicine, periodId) {
  const period = DOSE_PERIODS.find((item) => item.id === periodId) || DOSE_PERIODS[0]
  return medicine?.[period.timeField] || period.defaultTime
}

export function getDoseStatusesForDate(medicine, dateKey = getLocalDateKey()) {
  if (!dateKey || medicine?.doseStatusesDate !== dateKey) return normalizeDoseStatuses()
  return normalizeDoseStatuses(medicine?.doseStatuses)
}

export function getDoseStatus(medicine, periodId, dateKey = getLocalDateKey()) {
  return getDoseStatusesForDate(medicine, dateKey)[periodId] || 'pending'
}

export function getMedicineDoses(medicine, dateKey = getLocalDateKey()) {
  return getEnabledDosePeriods(medicine).map((period) => ({
    ...period,
    status: getDoseStatus(medicine, period.id, dateKey),
    time: getDoseTime(medicine, period.id),
  }))
}
