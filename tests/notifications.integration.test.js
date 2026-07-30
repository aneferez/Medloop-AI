import { beforeEach, describe, expect, it, vi } from 'vitest'

const notificationApi = vi.hoisted(() => ({
  addListener: vi.fn(),
  cancel: vi.fn(async () => undefined),
  checkExactNotificationSetting: vi.fn(async () => ({ exact_alarm: 'granted' })),
  checkPermissions: vi.fn(async () => ({ display: 'granted' })),
  createChannel: vi.fn(async () => undefined),
  getPending: vi.fn(async () => ({ notifications: [] })),
  registerActionTypes: vi.fn(async () => undefined),
  schedule: vi.fn(async ({ notifications }) => ({ notifications })),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android', isNativePlatform: () => true },
}))
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: notificationApi }))

import { configureMedicineReminders, listenForMedicineNotificationActions, scheduleReminderTest } from '../src/lib/notifications'

describe('Android reminder integration', () => {
  beforeEach(() => vi.clearAllMocks())

  it('schedules exact dose reminders, reviews, refill checks, and action buttons', async () => {
    const medicine = {
      id: 'medicine-1',
      name: 'Metformin',
      dosage: '500 mg',
      enabledDosePeriods: ['morning'],
      morningTime: '08:00',
      stockRemaining: 20,
      doseUnitsPerDose: 1,
      stockBufferDays: 7,
      stockUnitLabel: 'tablets',
    }
    const result = await configureMedicineReminders(
      [medicine],
      { notificationsEnabled: true, reminderLeadMinutes: 10 },
      [{ name: 'Caregiver', alertLevel: 'Level 1', phone: '+919876543210' }],
    )

    expect(result).toMatchObject({ doseReminders: 1, exactAlarmGranted: true })
    const scheduled = notificationApi.schedule.mock.calls[0][0].notifications
    const dose = scheduled.find((item) => item.extra?.type === 'dose')
    expect(dose).toMatchObject({
      actionTypeId: 'medicine-dose-actions',
      schedule: { on: { hour: 7, minute: 50, second: 0 }, allowWhileIdle: true },
    })
    expect(scheduled.some((item) => item.extra?.type === 'daily-summary')).toBe(true)
    expect(scheduled.filter((item) => item.extra?.type === 'refill')).toHaveLength(2)
  })

  it('schedules the ten-second notification smoke test', async () => {
    await expect(scheduleReminderTest()).resolves.toMatchObject({ scheduled: true, exactAlarmGranted: true })
    expect(notificationApi.schedule.mock.calls[0][0].notifications[0]).toMatchObject({
      id: 9001,
      title: 'MedLoop test reminder',
      schedule: { allowWhileIdle: true },
    })
  })

  it('maps notification Taken and Missed actions back to dose updates', async () => {
    let actionListener
    notificationApi.addListener.mockImplementation(async (_event, callback) => {
      actionListener = callback
      return { remove: vi.fn() }
    })
    const callback = vi.fn()
    await listenForMedicineNotificationActions(callback)
    actionListener({
      actionId: 'taken',
      notification: { extra: { type: 'dose', medicineId: 'medicine-1', periodId: 'night' } },
    })
    expect(callback).toHaveBeenCalledWith({
      type: 'dose', medicineId: 'medicine-1', periodId: 'night', status: 'taken',
    })
  })
})
