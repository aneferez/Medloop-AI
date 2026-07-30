import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { getDoseStatus, getDoseTime, getEnabledDosePeriods } from './medicineSchedule'
import { formatStockAmount, getBufferStock, getDailyStockUse, isStockLow, isStockTracked, normalizeStockRemaining } from './medicineStock'

const CHANNEL_ID = 'medicine-reminders-v3'
const ACTION_TYPE_ID = 'medicine-dose-actions'
const REFILL_ACTION_TYPE_ID = 'medicine-refill-actions'
const REMINDER_SOUND = 'medicine_reminder.wav'
const EXACT_ALARM_DISABLED_REASON = 'Android exact alarm access is off, so reminders may arrive a little later than the selected time until Alarms & reminders is allowed in app settings.'
const NOTIFICATION_ID_BASE = 10000
const NOTIFICATION_ID_MAX = NOTIFICATION_ID_BASE + 1000000000
const TEST_NOTIFICATION_ID = 9001
const DAILY_REFILL_NOTIFICATION_ID = 9002
const MONTHLY_REFILL_NOTIFICATION_ID = 9003
const DAILY_SUMMARY_NOTIFICATION_ID = 9004
const MONTHLY_STOCK_NOTIFICATION_ID = 9005
const ACCOUNT_SAVED_NOTIFICATION_ID = 9006
const STOCK_BUFFER_NOTIFICATION_ID_BASE = 1010000000
const STOCK_UPDATE_NOTIFICATION_ID_BASE = 1020000000
const STOCK_NOTIFICATION_ID_LIMIT = 100000

function stableNotificationId(value, index) {
  let hash = 0
  for (const character of String(value || index)) {
    hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0
  }
  return NOTIFICATION_ID_BASE + (Math.abs(hash) % 1000000000)
}

function normalizeReminderLeadMinutes(value) {
  const minutes = Number(String(value ?? '').trim() || 0)
  return Number.isFinite(minutes) ? Math.min(240, Math.max(0, Math.round(minutes))) : 0
}

function parseReminderTime(time) {
  const match = /^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(String(time || ''))
  return {
    hour: match ? Number(match[1]) : 9,
    minute: match ? Number(match[2]) : 0,
  }
}

function reminderSchedule(time, leadMinutes = 0) {
  const parsed = parseReminderTime(time)
  const minutesInDay = 24 * 60
  const totalMinutes = ((parsed.hour * 60) + parsed.minute - normalizeReminderLeadMinutes(leadMinutes) + minutesInDay) % minutesInDay
  return {
    on: {
      hour: Math.floor(totalMinutes / 60),
      minute: totalMinutes % 60,
      second: 0,
    },
    allowWhileIdle: true,
  }
}

async function exactAlarmGranted() {
  if (Capacitor.getPlatform() !== 'android') return true
  try {
    const exact = await LocalNotifications.checkExactNotificationSetting()
    return exact.exact_alarm === 'granted'
  } catch {
    return false
  }
}

function atTodayOrTomorrow(hour, minute) {
  const scheduled = new Date()
  scheduled.setHours(hour, minute, 0, 0)
  if (scheduled.getTime() <= Date.now() + 60_000) scheduled.setDate(scheduled.getDate() + 1)
  return scheduled
}

function stockBufferTriggerDate(medicine) {
  const periods = getEnabledDosePeriods(medicine)
  const dailyUse = getDailyStockUse(medicine, periods.length)
  const stock = normalizeStockRemaining(medicine?.stockRemaining)
  if (stock === null || dailyUse <= 0) return atTodayOrTomorrow(20, 30)

  const bufferStock = getBufferStock(medicine, periods.length)
  const daysUntilBuffer = Math.max(0, Math.floor((stock - bufferStock) / dailyUse))
  const date = new Date()
  date.setDate(date.getDate() + daysUntilBuffer)
  date.setHours(20, 30, 0, 0)
  if (date.getTime() <= Date.now() + 60_000) return new Date(Date.now() + 60_000)
  return date
}

function dailySummaryBody(medicines) {
  const doses = medicines.flatMap((medicine) => getEnabledDosePeriods(medicine).map((period) => (
    getDoseStatus(medicine, period.id)
  )))
  if (doses.length === 0) return 'No medicine doses are scheduled for today.'

  const taken = doses.filter((status) => status === 'taken').length
  const missed = doses.filter((status) => status === 'missed').length
  const pending = doses.length - taken - missed
  return `Today: ${taken} taken, ${pending} pending, ${missed} missed. Open MedLoop to review.`
}

function lowStockMedicines(medicines) {
  return medicines.filter((medicine) => isStockLow(medicine, getEnabledDosePeriods(medicine).length))
}

function isRoutineNotificationId(id) {
  return (
    (id >= NOTIFICATION_ID_BASE && id <= NOTIFICATION_ID_MAX) ||
    (id >= STOCK_BUFFER_NOTIFICATION_ID_BASE && id < STOCK_BUFFER_NOTIFICATION_ID_BASE + STOCK_NOTIFICATION_ID_LIMIT) ||
    [DAILY_REFILL_NOTIFICATION_ID, MONTHLY_REFILL_NOTIFICATION_ID, DAILY_SUMMARY_NOTIFICATION_ID, MONTHLY_STOCK_NOTIFICATION_ID].includes(id)
  )
}

async function configureReminderChannel() {
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: ACTION_TYPE_ID,
        actions: [
          { id: 'taken', title: 'Taken' },
          { id: 'missed', title: 'Missed' },
        ],
      },
      {
        id: REFILL_ACTION_TYPE_ID,
        actions: [{ id: 'notify-family', title: 'Notify family' }],
      },
    ],
  })

  if (Capacitor.getPlatform() === 'android') {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Medicine reminders',
      description: 'Exact-time medicine reminders with sound and vibration',
      sound: REMINDER_SOUND,
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#5EEAD4',
    })
  }
}

export async function requestReminderPermission({ requestExact = false } = {}) {
  if (!Capacitor.isNativePlatform()) {
    return { granted: false, reason: 'Medicine reminders are available in the Android app.' }
  }

  let permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions()
  if (permission.display !== 'granted') {
    return { granted: false, reason: 'Notification permission was not granted.' }
  }

  await configureReminderChannel()
  let exactAlarmEnabled = await exactAlarmGranted()
  if (requestExact && Capacitor.getPlatform() === 'android' && !exactAlarmEnabled) {
    try {
      const exact = await LocalNotifications.changeExactNotificationSetting()
      exactAlarmEnabled = exact.exact_alarm === 'granted'
    } catch {
      exactAlarmEnabled = false
    }
  }

  return {
    granted: true,
    exactAlarmGranted: exactAlarmEnabled,
    reason: exactAlarmEnabled ? '' : EXACT_ALARM_DISABLED_REASON,
  }
}

export async function scheduleReminderTest() {
  if (!Capacitor.isNativePlatform()) {
    return { scheduled: false, reason: 'Test reminders are available in the Android app.' }
  }

  const permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') {
    return { scheduled: false, reason: 'Notification permission is not enabled.' }
  }

  await configureReminderChannel()
  await LocalNotifications.cancel({ notifications: [{ id: TEST_NOTIFICATION_ID }] })
  await LocalNotifications.schedule({
    notifications: [{
      id: TEST_NOTIFICATION_ID,
      title: 'MedLoop test reminder',
      body: 'Sound and exact-time notifications are working.',
      channelId: CHANNEL_ID,
      sound: REMINDER_SOUND,
      schedule: { at: new Date(Date.now() + 10_000), allowWhileIdle: true },
    }],
  })
  return { scheduled: true, exactAlarmGranted: await exactAlarmGranted() }
}

export async function notifyAccountSaved(email) {
  if (!Capacitor.isNativePlatform()) return
  const permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') return

  await configureReminderChannel()
  await LocalNotifications.schedule({
    notifications: [{
      id: ACCOUNT_SAVED_NOTIFICATION_ID,
      title: 'Account saved on this device',
      body: `${email || 'Your MedLoop user ID'} is stored locally with protected credentials.`,
      channelId: CHANNEL_ID,
      schedule: { at: new Date(Date.now() + 1_000), allowWhileIdle: true },
    }],
  })
}

export async function notifyMedicineStockUpdate(medicine) {
  if (!Capacitor.isNativePlatform() || !isStockTracked(medicine)) return
  const permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') return

  await configureReminderChannel()
  await LocalNotifications.schedule({
    notifications: [{
      id: STOCK_UPDATE_NOTIFICATION_ID_BASE + (stableNotificationId(`stock-update:${medicine.id}`, 0) % STOCK_NOTIFICATION_ID_LIMIT),
      title: `${medicine.name} stock updated`,
      body: `${formatStockAmount(medicine.stockRemaining, medicine.stockUnitLabel)} remaining after the taken dose.`,
      channelId: CHANNEL_ID,
      schedule: { at: new Date(Date.now() + 1_000), allowWhileIdle: true },
      extra: { type: 'stock-update', medicineId: medicine.id },
    }],
  })
}

export async function configureMedicineReminders(medicines, settings, familyMembers = []) {
  if (!Capacitor.isNativePlatform()) {
    return { scheduled: 0, doseReminders: 0, reason: 'Medicine reminders are available in the Android app.' }
  }

  const pending = await LocalNotifications.getPending()
  const routineNotifications = pending.notifications.filter(({ id }) => isRoutineNotificationId(id))
  if (routineNotifications.length > 0) {
    await LocalNotifications.cancel({
      notifications: routineNotifications.map(({ id }) => ({ id })),
    })
  }

  if (!settings?.notificationsEnabled) return { scheduled: 0, doseReminders: 0, reason: 'Device reminders are not enabled.' }
  if (medicines.length === 0) return { scheduled: 0, doseReminders: 0, reason: 'Add a medicine before scheduling reminders.' }
  const permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') return { scheduled: 0, doseReminders: 0, reason: 'Notification permission is not enabled.' }

  await configureReminderChannel()

  const doseNotifications = medicines.flatMap((medicine, medicineIndex) => getEnabledDosePeriods(medicine).map((period, periodIndex) => ({
      id: stableNotificationId(`${medicine.id}:${period.id}`, (medicineIndex * 3) + periodIndex),
      title: `${period.label}: ${medicine.name} reminder`,
      body: `${medicine.dosage || 'Take as directed'}. Dose time: ${getDoseTime(medicine, period.id)}.`,
      channelId: CHANNEL_ID,
      sound: REMINDER_SOUND,
      actionTypeId: ACTION_TYPE_ID,
      schedule: reminderSchedule(getDoseTime(medicine, period.id), settings?.reminderLeadMinutes),
      extra: { type: 'dose', medicineId: medicine.id, periodId: period.id },
    })))

  const summaryNotification = {
    id: DAILY_SUMMARY_NOTIFICATION_ID,
    title: 'End-of-day medicine review',
    body: dailySummaryBody(medicines),
    channelId: CHANNEL_ID,
    sound: REMINDER_SOUND,
    schedule: { on: { hour: 21, minute: 30 }, allowWhileIdle: true },
    extra: { type: 'daily-summary' },
  }

  const stockNotifications = medicines
    .filter((medicine) => isStockTracked(medicine))
    .map((medicine, index) => {
      const periods = getEnabledDosePeriods(medicine)
      const stock = formatStockAmount(medicine.stockRemaining, medicine.stockUnitLabel)
      const bufferStock = formatStockAmount(getBufferStock(medicine, periods.length), medicine.stockUnitLabel)
      return {
        id: STOCK_BUFFER_NOTIFICATION_ID_BASE + index,
        title: isStockLow(medicine, periods.length) ? `${medicine.name} stock is low` : `${medicine.name} refill buffer reminder`,
        body: `${stock} left. Refill buffer is ${bufferStock}.`,
        channelId: CHANNEL_ID,
        sound: REMINDER_SOUND,
        schedule: { at: stockBufferTriggerDate(medicine), allowWhileIdle: true },
        extra: { type: 'stock-buffer', medicineId: medicine.id },
      }
    })

  const lowStock = lowStockMedicines(medicines)
  const monthlyStockNotification = {
    id: MONTHLY_STOCK_NOTIFICATION_ID,
    title: 'Monthly medicine stock review',
    body: lowStock.length
      ? `Review low stock: ${lowStock.slice(0, 4).map((medicine) => medicine.name).join(', ')}.`
      : 'Review all medicine stock and refill buffers before the month ends.',
    channelId: CHANNEL_ID,
    sound: REMINDER_SOUND,
    schedule: { on: { day: 25, hour: 20, minute: 30 }, allowWhileIdle: true },
    extra: { type: 'monthly-stock' },
  }

  const levelOneContact = familyMembers.find((member) => (
    member.alertLevel === 'Level 1' && (
      /^\+[1-9]\d{7,14}$/.test(String(member.whatsappNumber || '').trim()) ||
      /^\+[1-9]\d{7,14}$/.test(String(member.phone || '').trim())
    )
  ))
  const refillNotifications = levelOneContact ? [
    {
      id: DAILY_REFILL_NOTIFICATION_ID,
      title: 'Daily medicine refill check',
      body: `Review medicine supplies and notify ${levelOneContact.name}.`,
      channelId: CHANNEL_ID,
      sound: REMINDER_SOUND,
      actionTypeId: REFILL_ACTION_TYPE_ID,
      schedule: { on: { hour: 22, minute: 0 }, allowWhileIdle: true },
      extra: { type: 'refill', cadence: 'daily' },
    },
    {
      id: MONTHLY_REFILL_NOTIFICATION_ID,
      title: 'Monthly medicine refill check',
      body: `It is the 20th. Review all refills and notify ${levelOneContact.name}.`,
      channelId: CHANNEL_ID,
      sound: REMINDER_SOUND,
      actionTypeId: REFILL_ACTION_TYPE_ID,
      schedule: { on: { day: 20, hour: 22, minute: 0 }, allowWhileIdle: true },
      extra: { type: 'refill', cadence: 'monthly' },
    },
  ] : []

  const notifications = [...doseNotifications, summaryNotification, monthlyStockNotification, ...stockNotifications, ...refillNotifications]
  if (notifications.length === 0) {
    return { scheduled: 0, doseReminders: 0, reason: 'No reminders were available to schedule.' }
  }

  const result = await LocalNotifications.schedule({ notifications })
  return {
    scheduled: result.notifications.length,
    doseReminders: doseNotifications.length,
    exactAlarmGranted: await exactAlarmGranted(),
  }
}

export async function listenForMedicineNotifications(callback) {
  if (!Capacitor.isNativePlatform()) return () => {}

  const handle = await LocalNotifications.addListener('localNotificationReceived', (notification) => {
    callback({
      type: notification?.extra?.type || 'notification',
      title: notification?.title || 'MedLoop reminder',
      body: notification?.body || '',
      medicineId: notification?.extra?.medicineId,
      periodId: notification?.extra?.periodId,
    })
  })
  return () => handle.remove()
}

export async function listenForMedicineNotificationActions(callback) {
  if (!Capacitor.isNativePlatform()) return () => {}

  const handle = await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    if (event.actionId === 'notify-family' && event.notification?.extra?.type === 'refill') {
      callback({ type: 'refill', cadence: event.notification.extra.cadence })
      return
    }
    const medicineId = event.notification?.extra?.medicineId
    if (!medicineId || !['taken', 'missed'].includes(event.actionId)) return
    callback({ type: 'dose', medicineId, periodId: event.notification?.extra?.periodId || 'morning', status: event.actionId })
  })
  return () => handle.remove()
}
