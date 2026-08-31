import { useEffect, useMemo, useState } from 'react'
import AppShell from './components/AppShell'
import { useCallback } from 'react'
import { lazy, Suspense } from 'react'
import { useRef } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import {
  composeMissedDoseSms,
  composeRefillSms,
  deleteCurrentAccount,
  adoptServerUser,
  loginWithEmail,
  logoutFromLocalAccount,
  removeCurrentLocalAccount,
  observeAuthState,
  sendResetLink,
  signupWithEmail,
} from './lib/localAccount'
import { configureMedicineReminders, listenForMedicineNotificationActions, listenForMedicineNotifications, notifyAccountSaved, notifyMedicineStockUpdate, requestReminderPermission, scheduleReminderTest } from './lib/notifications'
import { deleteProfilePhoto, getProfilePhoto, saveProfilePhoto } from './lib/profilePhoto'
import { choosePrescriptionPhoto, isCameraCancellation, prescriptionMediaToBlob, takePrescriptionPhoto, validatePrescriptionImage } from './lib/prescriptionCamera'
import { deletePrescriptionImage, deletePrescriptionImagesForOwner, getPrescriptionImage, savePrescriptionImage } from './lib/prescriptionImage'
import { DOSE_PERIODS, getDoseStatus, getDoseStatusesForDate, getDoseTime, getEnabledDosePeriods, getLocalDateKey, isDosePeriodEnabled, normalizeMedicineSchedule } from './lib/medicineSchedule'
import { defaultSettings, isValidSmsPhone, isValidWhatsAppPhone, sanitizeSettings, settingsForUser } from './lib/settings'
import { formatStockAmount, getBufferStock, isStockLow, isStockTracked, normalizeBufferDays, normalizeDoseUnits, normalizeStockRemaining, normalizeStockUnit } from './lib/medicineStock'
import { composeMissedDoseWhatsApp, composeRefillWhatsApp } from './lib/whatsapp'
import { getSecureValue, removeSecureValue, setSecureValue } from './lib/secureStorage'
import { backupImageToBlob, blobToBackupImage, createEncryptedBackup, decryptBackupFile, MAX_BACKUP_FILE_BYTES, saveEncryptedBackupFile } from './lib/localBackup'
import { recognizePrescriptionText } from './lib/prescriptionOcr'
import { pageById, pageByPath } from './navigation'
import { isCloudEnabled } from './lib/cloud/config'
import { useCloudSync, cloudStatusLabel } from './lib/cloud/useCloudSync'
import { cloudBackupNote, deletePrescriptionFile, uploadPrescriptionFile } from './lib/cloud/prescriptionFiles'
import { usePushRegistration } from './lib/cloud/usePushRegistration'
import { authenticateCloudAccount, clearCloudSession, deleteCloudAccount, ensureCloudSession, exportCloudAccount, requestPasswordReset, resendVerification, resetPassword, revokeCloudSession, verifyEmail } from './lib/cloud/session'
import { cloudApi } from './lib/cloud/apiClient.js'
import { acceptCurrentConsent, hasCurrentConsent } from './lib/consent'
import LoadingPage from './pages/LoadingPage'
import './App.css'

const AlertsPage = lazy(() => import('./pages/AlertsPage'))
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const EmergencyCardPage = lazy(() => import('./pages/EmergencyCardPage'))
const FamilyPage = lazy(() => import('./pages/FamilyPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const LegalPage = lazy(() => import('./pages/LegalPage'))
const ConsentPage = lazy(() => import('./pages/ConsentPage'))
const MedicinesPage = lazy(() => import('./pages/MedicinesPage'))
const PrescriptionsPage = lazy(() => import('./pages/PrescriptionsPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

const stateFields = ['familyMembers', 'medicines', 'prescriptions', 'appointments', 'alerts', 'doseLogs']
const emptyFamilyForm = { id: null, name: '', relationship: '', phone: '', whatsappNumber: '', alertLevel: 'Level 2', age: '', bloodGroup: '', allergies: '' }
const emptyMedicineForm = { id: null, name: '', dosage: '', morningTime: '08:00', afternoonTime: '13:00', nightTime: '20:00', enabledDosePeriods: ['morning'], memberId: '', refill: 'On track', stockRemaining: '', doseUnitsPerDose: '1', stockBufferDays: '7', stockUnitLabel: 'tablets' }
const emptyPrescriptionForm = { id: null, doctor: '', clinic: '', notes: '' }
const emptyAppointmentForm = { id: null, doctor: '', clinic: '', date: '', time: '' }

function createEmptyState() {
  return {
    familyMembers: [],
    medicines: [],
    prescriptions: [],
    appointments: [],
    alerts: [],
    doseLogs: [],
    settings: { ...defaultSettings },
  }
}

const guestStorageKey = 'medloop-ai-state-guest'
const prescriptionCameraTargetStorageKey = 'medloop-prescription-camera-target'

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function getInitialPage() {
  if (typeof window === 'undefined') return 'home'
  return pageByPath[window.location.pathname] || 'dashboard'
}

function getUserStorageId(currentUser) {
  const email = normalizeEmail(currentUser?.email)
  return email || currentUser?.uid || ''
}

function getLocalStorageKey(storageId) {
  return storageId ? `medloop-ai-state-${storageId}` : guestStorageKey
}

function normalizeState(rawState) {
  const cleanState = createEmptyState()
  if (!rawState || typeof rawState !== 'object') return cleanState

  stateFields.forEach((field) => {
    cleanState[field] = Array.isArray(rawState[field]) ? rawState[field] : []
  })
  cleanState.settings = sanitizeSettings({
    ...defaultSettings,
    ...(rawState.settings && typeof rawState.settings === 'object' ? rawState.settings : {}),
  })

  cleanState.familyMembers = cleanState.familyMembers.map((member) => ({
    ...member,
    alertLevel: ['Level 1', 'Level 2', 'Level 3'].includes(member.alertLevel) ? member.alertLevel : 'Level 2',
  }))
  cleanState.medicines = cleanState.medicines.map((medicine) => normalizeMedicineSchedule({
    ...medicine,
    refill: medicine.refill || 'On track',
  }))
  cleanState.prescriptions = cleanState.prescriptions.map((prescription) => ({
    id: prescription.id,
    doctor: String(prescription.doctor || ''),
    clinic: String(prescription.clinic || 'Clinic'),
    notes: String(prescription.notes || ''),
  }))

  return cleanState
}

function createRecordId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createLocalImageUrl(image) {
  return image && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(image) : ''
}

function revokeLocalImageUrl(url) {
  if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url)
}

function createAutomaticAlerts(medicines, members, savedAlerts, dateKey = getLocalDateKey()) {
  const memberNames = new Map(members.map((member) => [String(member.id), member.name]))
  const automaticAlerts = medicines.flatMap((medicine) => {
    const alerts = []
    const owner = medicine.memberId ? memberNames.get(String(medicine.memberId)) : 'Personal routine'

    DOSE_PERIODS.forEach((period) => {
      if (!isDosePeriodEnabled(medicine, period.id)) return
      if (getDoseStatus(medicine, period.id, dateKey) !== 'missed') return
      alerts.push({
        id: `missed-${medicine.id}-${period.id}`,
        title: `Missed ${medicine.name} ${period.label.toLowerCase()} dose`,
        detail: `${owner || 'Family member'} missed the ${getDoseTime(medicine, period.id)} dose.`,
        level: medicine.important ? 'High' : 'Medium',
      })
    })

    if (medicine.refill === 'Running low' || medicine.refill === 'Refill needed') {
      alerts.push({
        id: `refill-${medicine.id}`,
        title: `${medicine.name} refill ${medicine.refill === 'Refill needed' ? 'needed' : 'reminder'}`,
        detail: `${owner || 'Family member'}: ${medicine.refill.toLowerCase()}.`,
        level: medicine.refill === 'Refill needed' ? 'High' : 'Medium',
      })
    }

    const enabledDoseCount = getEnabledDosePeriods(medicine).length
    if (isStockTracked(medicine) && isStockLow(medicine, enabledDoseCount)) {
      alerts.push({
        id: `stock-${medicine.id}`,
        title: `${medicine.name} stock is low`,
        detail: `${formatStockAmount(medicine.stockRemaining, medicine.stockUnitLabel)} left. Buffer target is ${formatStockAmount(getBufferStock(medicine, enabledDoseCount), medicine.stockUnitLabel)}.`,
        level: medicine.stockRemaining <= 0 ? 'High' : 'Medium',
      })
    }

    return alerts
  })

  const seen = new Set()
  return [...automaticAlerts, ...savedAlerts].filter((alert) => {
    const identity = String(alert.id ?? `${alert.title}-${alert.detail}`)
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

function isDefaultMedicine(medicine) {
  if (!medicine || typeof medicine !== 'object') return false

  const name = String(medicine.name || '').trim()
  const dosage = String(medicine.dosage || '').trim()
  const time = String(medicine.time || medicine.morningTime || '').trim()

  return (
    (name === 'Metformin' && dosage === '500 mg' && time === '08:00') ||
    (name === 'Vitamin D' && dosage === '1000 IU' && time === '20:00') ||
    (name === 'Insulin' && dosage === '10 units' && time === '07:30')
  )
}

function isDefaultAppointment(appointment) {
  return appointment?.doctor === 'Dr. Kumar'
}

function isDefaultAlert(alert) {
  const title = String(alert?.title || '').trim()
  const detail = String(alert?.detail || '').trim()
  return (
    title === 'Missed insulin dose' ||
    title === 'Refill reminder' ||
    detail === 'Ravi missed a critical dose at 07:30' ||
    detail === 'Vitamin D is running low'
  )
}

function hasDefaultRecords(state) {
  return (
    state.medicines.some(isDefaultMedicine) ||
    state.appointments.some(isDefaultAppointment) ||
    state.alerts.some(isDefaultAlert)
  )
}

function sanitizeState(rawState) {
  const state = normalizeState(rawState)
  if (!hasDefaultRecords(state)) return state

  return {
    ...state,
    medicines: state.medicines.filter((medicine) => !isDefaultMedicine(medicine)),
    appointments: state.appointments.filter((appointment) => !isDefaultAppointment(appointment)),
    alerts: state.alerts.filter((alert) => !isDefaultAlert(alert)),
  }
}

function isSampleData(state) {
  const normalizedState = normalizeState(state)
  return hasDefaultRecords(normalizedState)
}

function hasAccountData(state) {
  return stateFields.some((field) => state[field].length > 0) ||
    Object.keys(defaultSettings).some((key) => state.settings?.[key] !== defaultSettings[key])
}

function getItemIdentity(item) {
  if (item?.id !== undefined && item?.id !== null) return `id:${item.id}`
  return JSON.stringify(item)
}

function mergeUniqueItems(states, field) {
  const seen = new Set()
  const merged = []

  states.forEach((state) => {
    state[field].forEach((item) => {
      const identity = getItemIdentity(item)
      if (seen.has(identity)) return
      seen.add(identity)
      merged.push(item)
    })
  })

  return merged
}

function mergeAccountStates(states) {
  const availableStates = states.filter(Boolean)
  const sanitizedStates = availableStates.map(sanitizeState)
  if (sanitizedStates.length === 0) return createEmptyState()

  const mergedState = stateFields.reduce((currentState, field) => ({
    ...currentState,
    [field]: mergeUniqueItems(sanitizedStates, field),
  }), createEmptyState())

  const settingsIndex = availableStates.findIndex(
    (currentState) => currentState.settings && typeof currentState.settings === 'object',
  )
  return {
    ...mergedState,
    settings: settingsIndex >= 0
      ? sanitizedStates[settingsIndex].settings
      : { ...defaultSettings },
  }
}

async function readStateFromStorage(storageId) {
  if (typeof window === 'undefined') return null
  try {
    const key = getLocalStorageKey(storageId)
    const secured = await getSecureValue(key)
    if (secured && typeof secured === 'object') return sanitizeState(secured)

    const legacy = window.localStorage.getItem(key)
    if (!legacy) return null
    const migrated = sanitizeState(JSON.parse(legacy))
    await setSecureValue(key, migrated)
    window.localStorage.removeItem(key)
    return migrated
  } catch {
    return null
  }
}

async function loadAccountState(currentUser) {
  const storageId = getUserStorageId(currentUser)
  const uidState = currentUser?.uid && currentUser.uid !== storageId ? await readStateFromStorage(currentUser.uid) : null
  const localState = await readStateFromStorage(storageId)
  const mergedState = mergeAccountStates([
    localState,
    uidState,
  ])

  return hasAccountData(mergedState) ? mergedState : createEmptyState()
}

function App() {
  const [state, setState] = useState(createEmptyState)
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [accountReady, setAccountReady] = useState(false)
  const [currentPage, setCurrentPage] = useState(getInitialPage)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' })
  const [authError, setAuthError] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [attestationToken, setAttestationToken] = useState('')
  const [resetFeedback, setResetFeedback] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [verificationToken, setVerificationToken] = useState('')
  const [appNotice, setAppNotice] = useState('')
  const [familyForm, setFamilyForm] = useState(emptyFamilyForm)
  const [medicineForm, setMedicineForm] = useState(emptyMedicineForm)
  const [formFeedback, setFormFeedback] = useState({ family: '', medicine: '', prescription: '', appointment: '' })
  const [prescriptionForm, setPrescriptionForm] = useState(emptyPrescriptionForm)
  const [appointmentForm, setAppointmentForm] = useState(emptyAppointmentForm)
  const [settingsForm, setSettingsForm] = useState(() => settingsForUser(defaultSettings, null))
  const [settingsFeedback, setSettingsFeedback] = useState('')
  const [settingsError, setSettingsError] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [accountDeleting, setAccountDeleting] = useState(false)
  const [profilePhotoBlob, setProfilePhotoBlob] = useState(null)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('')
  const [profilePhotoFeedback, setProfilePhotoFeedback] = useState('')
  const [prescriptionImageUrls, setPrescriptionImageUrls] = useState({})
  const [prescriptionImageRevision, setPrescriptionImageRevision] = useState(0)
  const [prescriptionPhotoFeedback, setPrescriptionPhotoFeedback] = useState({})
  const [prescriptionPhotoBusyId, setPrescriptionPhotoBusyId] = useState('')
  const [prescriptionDraftImage, setPrescriptionDraftImage] = useState(null)
  const [prescriptionDraftImageUrl, setPrescriptionDraftImageUrl] = useState('')
  const [prescriptionDraftBusy, setPrescriptionDraftBusy] = useState(false)
  const [prescriptionOcrScript, setPrescriptionOcrScript] = useState('LATIN')
  const [prescriptionOcr, setPrescriptionOcr] = useState({ status: 'idle', text: '', message: '' })
  const [simplifyBusy, setSimplifyBusy] = useState(false)
  const [currentDoseDate, setCurrentDoseDate] = useState(getLocalDateKey)
  const notificationActionHandlerRef = useRef(null)
  const pendingNotificationActionRef = useRef(null)
  const prescriptionImageUrlsRef = useRef({})
  // Lets the appRestoredResult listener (a mount-only effect) reach the current
  // mirror function instead of closing over the signed-out initial one.
  const mirrorPrescriptionImageRef = useRef(() => {})
  const profilePhotoId = user?.uid ? `user:${user.uid}` : 'guest'
  const accountUsesPassword = true
  const consentGiven = hasCurrentConsent(state.settings)

  // Best-effort cloud mirror (no-op unless VITE_MEDLOOP_API_URL is configured).
  const { status: cloudStatus, syncNow: cloudSyncNow } = useCloudSync({
    user,
    state,
    accountReady: accountReady && consentGiven,
    // Records this device has never seen — e.g. signing in on a second phone.
    onAdopt: (merged) => setState(merged),
  })

  // Register this device for native push and send its FCM token to the backend
  // (native-only; no-op on web or when the cloud is disabled).
  const handleRemoteAlert = useCallback((alert) => {
    if (!alert?.id) return
    setState((current) => ({
      ...current,
      alerts: [alert, ...current.alerts.filter((item) => String(item.id) !== String(alert.id))].slice(0, 200),
    }))
    setAppNotice(alert.title || 'New care update')
  }, [])

  usePushRegistration({ user, accountReady: accountReady && consentGiven, onAlert: handleRemoteAlert })

  useEffect(() => {
    if (!appNotice) return undefined
    const timeout = window.setTimeout(() => setAppNotice(''), 4500)
    return () => window.clearTimeout(timeout)
  }, [appNotice])

  useEffect(() => {
    let midnightTimer

    const refreshDoseDate = () => {
      setCurrentDoseDate(getLocalDateKey())
      window.clearTimeout(midnightTimer)
      const now = new Date()
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      midnightTimer = window.setTimeout(refreshDoseDate, Math.max(1000, nextMidnight.getTime() - now.getTime() + 1000))
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshDoseDate()
    }

    refreshDoseDate()
    window.addEventListener('focus', refreshDoseDate)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearTimeout(midnightTimer)
      window.removeEventListener('focus', refreshDoseDate)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [])

  const replacePrescriptionImageUrls = (images) => {
    Object.values(prescriptionImageUrlsRef.current).forEach(revokeLocalImageUrl)
    const nextUrls = Object.fromEntries(images.map(([id, image]) => [id, createLocalImageUrl(image)]))
    prescriptionImageUrlsRef.current = nextUrls
    setPrescriptionImageUrls(nextUrls)
  }

  const updatePrescriptionImageUrl = (prescriptionId, image) => {
    const current = prescriptionImageUrlsRef.current
    revokeLocalImageUrl(current[prescriptionId])
    const next = { ...current }
    if (image) next[prescriptionId] = createLocalImageUrl(image)
    else delete next[prescriptionId]
    prescriptionImageUrlsRef.current = next
    setPrescriptionImageUrls(next)
  }

  const navigateTo = (pageId, options = {}) => {
    const path = pageById[pageId]?.path || (pageId === 'auth' ? '/auth' : '/dashboard')
    setCurrentPage(pageId)
    if (typeof window === 'undefined') return
    const historyMethod = options.replace ? 'replaceState' : 'pushState'
    if (window.location.pathname !== path || options.replace) {
      window.history[historyMethod]({}, '', path)
    }
  }

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(getInitialPage())
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!authReady || !accountReady || !user) return
    if (currentPage === 'auth') {
      navigateTo('dashboard', { replace: true })
    }
  }, [accountReady, authReady, currentPage, user])

  useEffect(() => {
    if (!accountReady || !user || !consentGiven) return
    const key = getLocalStorageKey(getUserStorageId(user))
    setSecureValue(key, state).catch((error) => {
      console.error('Unable to save encrypted local account state', error)
    })
  }, [accountReady, consentGiven, state, user])

  useEffect(() => {
    if (!accountReady) return
    const medicines = user ? state.medicines : []
    const settings = user ? state.settings : { notificationsEnabled: false }
    configureMedicineReminders(medicines, settings, user ? state.familyMembers : []).catch((error) => {
      console.error('Unable to configure medicine reminders', error)
    })
  }, [accountReady, consentGiven, state.familyMembers, state.medicines, state.settings, user])

  useEffect(() => {
    let active = true
    setProfilePhotoBlob(null)
    setProfilePhotoFeedback('')
    if (!consentGiven) return () => { active = false }
    getProfilePhoto(profilePhotoId)
      .then((photo) => {
        if (active) setProfilePhotoBlob(photo)
      })
      .catch((error) => console.error('Unable to load the local profile photo', error))
    return () => { active = false }
  }, [consentGiven, profilePhotoId])

  useEffect(() => {
    if (!profilePhotoBlob || typeof URL.createObjectURL !== 'function') {
      setProfilePhotoUrl('')
      return undefined
    }
    const objectUrl = URL.createObjectURL(profilePhotoBlob)
    setProfilePhotoUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [profilePhotoBlob])

  useEffect(() => {
    if (!prescriptionDraftImage || typeof URL.createObjectURL !== 'function') {
      setPrescriptionDraftImageUrl('')
      return undefined
    }
    const objectUrl = URL.createObjectURL(prescriptionDraftImage)
    setPrescriptionDraftImageUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [prescriptionDraftImage])

  useEffect(() => {
    let active = true
    setPrescriptionPhotoFeedback({})
    if (!accountReady || !user?.uid || !consentGiven) {
      replacePrescriptionImageUrls([])
      return () => { active = false }
    }

    Promise.all(state.prescriptions.map(async (prescription) => [
      prescription.id,
      await getPrescriptionImage(user.uid, prescription.id),
    ]))
      .then((images) => {
        if (active) replacePrescriptionImageUrls(images.filter(([, image]) => image))
      })
      .catch((error) => console.error('Unable to load local prescription images', error))
    return () => { active = false }
  }, [accountReady, consentGiven, prescriptionImageRevision, state.prescriptions, user?.uid])

  useEffect(() => () => {
    Object.values(prescriptionImageUrlsRef.current).forEach(revokeLocalImageUrl)
    prescriptionImageUrlsRef.current = {}
  }, [])

  useEffect(() => {
    let listener = { remove: () => {} }
    CapacitorApp.addListener('appRestoredResult', async (result) => {
      if (result?.pluginId !== 'Camera' || !['takePhoto', 'chooseFromGallery'].includes(result.methodName) || !result.success) return
      try {
        const target = JSON.parse(window.localStorage.getItem(prescriptionCameraTargetStorageKey) || 'null')
        const mediaResult = result.methodName === 'chooseFromGallery' ? result.data?.results?.[0] : result.data
        if (!target?.ownerId || !target?.prescriptionId || !mediaResult) return
        const image = await prescriptionMediaToBlob(mediaResult)
        await savePrescriptionImage(target.ownerId, target.prescriptionId, image)
        updatePrescriptionImageUrl(target.prescriptionId, image)
        setPrescriptionImageRevision((current) => current + 1)
        setPrescriptionPhotoFeedback((current) => ({ ...current, [target.prescriptionId]: 'Prescription image restored and saved on this device.' }))
        mirrorPrescriptionImageRef.current(target.prescriptionId, image, 'Prescription image restored and saved on this device.')
      } catch (error) {
        console.error('Unable to restore the prescription camera result', error)
      } finally {
        window.localStorage.removeItem(prescriptionCameraTargetStorageKey)
      }
    }).then((handle) => { listener = handle })
    return () => listener.remove()
  }, [])

  useEffect(() => {
    let removeActionListener = () => {}
    let removeReceivedListener = () => {}
    listenForMedicineNotificationActions((action) => {
      notificationActionHandlerRef.current?.(action)
    }).then((remove) => { removeActionListener = remove })
      .catch((error) => console.error('Unable to listen for medicine reminder actions', error))
    listenForMedicineNotifications((notification) => {
      const text = [notification.title, notification.body].filter(Boolean).join(': ')
      if (text) setAppNotice(text)
    }).then((remove) => { removeReceivedListener = remove })
      .catch((error) => console.error('Unable to listen for medicine reminders', error))
    return () => {
      removeActionListener()
      removeReceivedListener()
    }
  }, [])

  useEffect(() => {
    const unsubscribe = observeAuthState(async (currentUser) => {
      setAccountReady(false)
      setAuthReady(true)
      if (currentUser) {
        setUser(currentUser)
        try {
          const accountState = await loadAccountState(currentUser)
          setState(accountState)
          setSettingsForm(settingsForUser(accountState.settings, currentUser))
        } catch (error) {
          console.error('Unable to load local account state', error)
        }
      } else {
        setUser(null)
        const signedOutState = createEmptyState()
        setState(signedOutState)
        setSettingsForm(settingsForUser(signedOutState.settings, null))
        navigateTo('auth', { replace: true })
      }
      setAccountReady(true)
    })
    return () => unsubscribe()
  }, [])

  const progress = useMemo(() => {
    const total = state.medicines.reduce((count, medicine) => count + getEnabledDosePeriods(medicine).length, 0)
    const completed = state.medicines.reduce((count, medicine) => (
      count + getEnabledDosePeriods(medicine).filter((period) => getDoseStatus(medicine, period.id, currentDoseDate) === 'taken').length
    ), 0)
    return total ? Math.round((completed / total) * 100) : 0
  }, [currentDoseDate, state.medicines])

  const nextMedicine = useMemo(() => state.medicines.find((medicine) => (
    getEnabledDosePeriods(medicine).some((period) => getDoseStatus(medicine, period.id, currentDoseDate) !== 'taken')
  )), [currentDoseDate, state.medicines])

  const alerts = useMemo(
    () => createAutomaticAlerts(state.medicines, state.familyMembers, state.alerts, currentDoseDate),
    [currentDoseDate, state.alerts, state.familyMembers, state.medicines],
  )

  const onboardingChecklist = useMemo(() => [
    { id: 'family', page: 'family', title: 'Add a family profile', description: 'Create the first care profile for yourself or a loved one.', done: state.familyMembers.length > 0 },
    { id: 'medicine', page: 'medicines', title: 'Add a medicine', description: 'Save the routine medicine you want to track.', done: state.medicines.length > 0 },
    { id: 'appointment', page: 'appointments', title: 'Add an appointment', description: 'Keep your next clinic or check-up visible.', done: state.appointments.length > 0 },
  ], [state.familyMembers.length, state.medicines.length, state.appointments.length])

  const isFirstRun = onboardingChecklist.some((item) => !item.done)

  useEffect(() => {
    if (user && state && isSampleData(state)) {
      setState(sanitizeState(state))
    }
  }, [user, state])

  const updateMedicine = (id, status, periodId = 'morning') => {
    const medicine = state.medicines.find((item) => item.id === id)
    const doseDate = getLocalDateKey()
    const previousStatus = getDoseStatus(medicine, periodId, doseDate)
    if (!medicine || !DOSE_PERIODS.some((period) => period.id === periodId) || !isDosePeriodEnabled(medicine, periodId) || previousStatus === status) return

    const stockTracked = isStockTracked(medicine)
    const doseUnits = normalizeDoseUnits(medicine.doseUnitsPerDose)
    const stockDelta = !stockTracked
      ? 0
      : status === 'taken'
        ? -doseUnits
        : previousStatus === 'taken'
          ? doseUnits
          : 0
    const nextStockRemaining = stockTracked
      ? Math.max(0, normalizeStockRemaining(medicine.stockRemaining) + stockDelta)
      : medicine.stockRemaining

    const createsLog = status === 'taken' || status === 'missed'
    const doseLog = createsLog ? {
      id: createRecordId(),
      medicineId: medicine.id,
      medicineName: medicine.name,
      dosage: medicine.dosage,
      scheduledTime: getDoseTime(medicine, periodId),
      dosePeriod: periodId,
      memberId: medicine.memberId ?? null,
      status,
      doseDate,
      stockRemainingAfter: stockTracked ? nextStockRemaining : null,
      recordedAt: new Date().toISOString(),
    } : null

    setState((current) => ({
      ...current,
      medicines: current.medicines.map((item) => item.id === id ? {
        ...item,
        doseStatuses: { ...getDoseStatusesForDate(item, doseDate), [periodId]: status },
        doseStatusesDate: doseDate,
        stockRemaining: item.id === id && stockTracked ? nextStockRemaining : item.stockRemaining,
      } : item),
      doseLogs: doseLog ? [doseLog, ...current.doseLogs].slice(0, 200) : current.doseLogs,
    }))

    if (stockTracked && status === 'taken') {
      void notifyMedicineStockUpdate({
        ...medicine,
        stockRemaining: nextStockRemaining,
      }).catch((error) => console.error('Unable to send stock update notification', error))
      setAppNotice(`${medicine.name} stock updated: ${formatStockAmount(nextStockRemaining, medicine.stockUnitLabel)} remaining.`)
    }

    if (doseLog && status === 'missed') {
      const whatsappContact = state.settings.whatsappAlerts
        ? state.familyMembers.find((item) => item.alertLevel === 'Level 1' && item.id !== medicine.memberId && isValidWhatsAppPhone(item.whatsappNumber))
          || state.familyMembers.find((item) => item.id !== medicine.memberId && isValidWhatsAppPhone(item.whatsappNumber))
        : null
      const smsContact = state.settings.smsAlerts
        ? state.familyMembers.find((item) => item.alertLevel === 'Level 1' && item.id !== medicine.memberId && isValidSmsPhone(item.phone))
          || state.familyMembers.find((item) => item.id !== medicine.memberId && isValidSmsPhone(item.phone))
        : null
      const alertContact = whatsappContact || smsContact
      const channel = whatsappContact ? 'WhatsApp' : 'SMS app'
      if (alertContact && window.confirm(`Open ${channel} to notify ${alertContact.name}? You will review and send the message yourself.`)) {
        try {
          if (whatsappContact) composeMissedDoseWhatsApp({ contact: alertContact, medicine, doseLog })
          else composeMissedDoseSms({ contact: alertContact, medicine, doseLog })
        } catch (error) {
          console.error('Unable to open the family alert draft', error)
        }
      }
    }
  }

  const prepareRefillAlert = () => {
    const levelOneContact = state.familyMembers.find((member) => member.alertLevel === 'Level 1')
    if (!levelOneContact) {
      setFormFeedback((current) => ({ ...current, family: 'Add a Level 1 family contact first.' }))
      navigateTo('family')
      return
    }

    const hasWhatsApp = isValidWhatsAppPhone(levelOneContact.whatsappNumber)
    const hasSms = isValidSmsPhone(levelOneContact.phone)
    const useWhatsApp = hasWhatsApp && (state.settings.whatsappAlerts || !hasSms || !state.settings.smsAlerts)
    if (!useWhatsApp && !hasSms) {
      setFormFeedback((current) => ({ ...current, family: 'Add a valid WhatsApp or SMS number to the Level 1 family contact first.' }))
      navigateTo('family')
      return
    }

    const channel = useWhatsApp ? 'WhatsApp' : 'SMS app'
    if (!window.confirm(`Open ${channel} to notify ${levelOneContact.name} about medicine refills? You will review and send the message yourself.`)) return
    try {
      if (useWhatsApp) composeRefillWhatsApp({ familyMember: levelOneContact, medicines: state.medicines })
      else composeRefillSms({ familyMember: levelOneContact, medicines: state.medicines })
    } catch (error) {
      console.error('Unable to open the refill alert draft', error)
    }
  }

  notificationActionHandlerRef.current = (action) => {
    if (!accountReady) {
      pendingNotificationActionRef.current = action
      return
    }
    if (action.type === 'refill') prepareRefillAlert()
    else updateMedicine(action.medicineId, action.status, action.periodId)
  }

  useEffect(() => {
    if (!accountReady || !pendingNotificationActionRef.current) return
    const action = pendingNotificationActionRef.current
    pendingNotificationActionRef.current = null
    notificationActionHandlerRef.current?.(action)
  }, [accountReady])

  const upsertItem = (field, item) => {
    setState((current) => ({
      ...current,
      [field]: current[field].some((currentItem) => currentItem.id === item.id)
        ? current[field].map((currentItem) => currentItem.id === item.id ? item : currentItem)
        : [...current[field], item],
    }))
  }

  const confirmDelete = (label, action) => {
    if (window.confirm(`Delete ${label}? This cannot be undone.`)) action()
  }

  const resetFamilyForm = () => setFamilyForm(emptyFamilyForm)
  const resetMedicineForm = () => setMedicineForm(emptyMedicineForm)
  const resetAppointmentForm = () => setAppointmentForm(emptyAppointmentForm)
  const resetPrescriptionForm = () => {
    setPrescriptionForm(emptyPrescriptionForm)
    setPrescriptionDraftImage(null)
    setPrescriptionOcr({ status: 'idle', text: '', message: '' })
  }

  const saveFamilyMember = (event) => {
    event.preventDefault()
    if (!familyForm.name.trim()) {
      setFormFeedback((current) => ({ ...current, family: 'Please enter a family member name.' }))
      return
    }
    if (familyForm.phone.trim() && !isValidSmsPhone(familyForm.phone)) {
      setFormFeedback((current) => ({ ...current, family: 'Use international E.164 format, for example +919876543210.' }))
      return
    }
    if (familyForm.whatsappNumber.trim() && !isValidWhatsAppPhone(familyForm.whatsappNumber)) {
      setFormFeedback((current) => ({ ...current, family: 'Use international E.164 format for WhatsApp, for example +919876543210.' }))
      return
    }
    if (familyForm.alertLevel === 'Level 1' && !isValidSmsPhone(familyForm.phone) && !isValidWhatsAppPhone(familyForm.whatsappNumber)) {
      setFormFeedback((current) => ({ ...current, family: 'The Level 1 refill contact must have a valid SMS or WhatsApp number.' }))
      return
    }
    setFormFeedback((current) => ({ ...current, family: '' }))
    const member = {
      id: familyForm.id || createRecordId(),
      name: familyForm.name.trim(),
      relationship: familyForm.relationship.trim() || 'Family member',
      phone: familyForm.phone.trim(),
      whatsappNumber: familyForm.whatsappNumber.trim(),
      alertLevel: familyForm.alertLevel || 'Level 2',
      age: familyForm.age || 'N/A',
      bloodGroup: familyForm.bloodGroup.trim() || 'Unknown',
      allergies: familyForm.allergies.trim() || 'None',
    }
    setState((current) => {
      const familyMembers = current.familyMembers.map((item) => (
        member.alertLevel === 'Level 1' && item.id !== member.id && item.alertLevel === 'Level 1'
          ? { ...item, alertLevel: 'Level 2' }
          : item
      ))
      return {
        ...current,
        familyMembers: familyMembers.some((item) => item.id === member.id)
          ? familyMembers.map((item) => item.id === member.id ? member : item)
          : [...familyMembers, member],
      }
    })
    resetFamilyForm()
  }

  const editFamilyMember = (member) => {
    setFamilyForm({ ...emptyFamilyForm, ...member })
    setFormFeedback((current) => ({ ...current, family: '' }))
  }

  const removeFamilyMember = (member) => confirmDelete(member.name, () => {
    setState((current) => ({
      ...current,
      familyMembers: current.familyMembers.filter((item) => item.id !== member.id),
      medicines: current.medicines.map((medicine) => medicine.memberId === member.id ? { ...medicine, memberId: null } : medicine),
    }))
    if (familyForm.id === member.id) resetFamilyForm()
  })

  const saveMedicine = async (event) => {
    event.preventDefault()
    if (!medicineForm.name.trim()) {
      setFormFeedback((current) => ({ ...current, medicine: 'Please enter a medicine name.' }))
      return
    }
    const enabledDosePeriods = [...(medicineForm.enabledDosePeriods || [])]
    if (enabledDosePeriods.length === 0) {
      setFormFeedback((current) => ({ ...current, medicine: 'Select at least one reminder time for this medicine.' }))
      return
    }
    const stockRemaining = normalizeStockRemaining(medicineForm.stockRemaining)
    if (String(medicineForm.stockRemaining ?? '').trim() && stockRemaining === null) {
      setFormFeedback((current) => ({ ...current, medicine: 'Medicine stock must be a whole number or left blank.' }))
      return
    }
    setFormFeedback((current) => ({ ...current, medicine: '' }))
    const existingMedicine = state.medicines.find((medicine) => medicine.id === medicineForm.id)
    const selectedMember = state.familyMembers.find((member) => String(member.id) === String(medicineForm.memberId))
    const savedMedicine = {
      id: medicineForm.id || createRecordId(),
      name: medicineForm.name.trim(),
      dosage: medicineForm.dosage.trim() || 'As directed',
      morningTime: medicineForm.morningTime || '08:00',
      afternoonTime: medicineForm.afternoonTime || '13:00',
      nightTime: medicineForm.nightTime || '20:00',
      enabledDosePeriods,
      memberId: selectedMember?.id ?? null,
      doseStatuses: existingMedicine?.doseStatuses || { morning: 'pending', afternoon: 'pending', night: 'pending' },
      doseStatusesDate: existingMedicine?.doseStatusesDate || getLocalDateKey(),
      important: existingMedicine?.important || false,
      refill: medicineForm.refill || 'On track',
      stockRemaining,
      doseUnitsPerDose: normalizeDoseUnits(medicineForm.doseUnitsPerDose),
      stockBufferDays: normalizeBufferDays(medicineForm.stockBufferDays),
      stockUnitLabel: normalizeStockUnit(medicineForm.stockUnitLabel),
    }
    const nextMedicines = state.medicines.some((medicine) => medicine.id === savedMedicine.id)
      ? state.medicines.map((medicine) => medicine.id === savedMedicine.id ? savedMedicine : medicine)
      : [...state.medicines, savedMedicine]
    setState((current) => ({ ...current, medicines: nextMedicines }))
    resetMedicineForm()

    let reminderSettings = state.settings
    if (!reminderSettings.notificationsEnabled) {
      const permission = await requestReminderPermission()
      if (!permission.granted) {
        setFormFeedback((current) => ({ ...current, medicine: `Medicine saved. ${permission.reason}` }))
        return
      }
      reminderSettings = sanitizeSettings({ ...reminderSettings, notificationsEnabled: true, reminderLeadMinutes: 0 })
      setSettingsForm(reminderSettings)
      setState((current) => ({ ...current, settings: reminderSettings }))
    }

    const scheduleResult = await configureMedicineReminders(nextMedicines, reminderSettings, state.familyMembers)
    if (scheduleResult.doseReminders > 0) {
      const count = enabledDosePeriods.length
      const exactMessage = scheduleResult.exactAlarmGranted === false
        ? ' Allow Alarms & reminders in Android settings for exact locked-time delivery.'
        : ''
      setFormFeedback((current) => ({
        ...current,
        medicine: `Medicine saved. ${count} selected-time reminder${count === 1 ? '' : 's'} active for this medicine.${exactMessage}`,
      }))
    } else {
      setFormFeedback((current) => ({ ...current, medicine: `Medicine saved. ${scheduleResult.reason || 'No medicine reminder was scheduled.'}` }))
    }
  }

  const editMedicine = (medicine) => {
    setMedicineForm({
      ...emptyMedicineForm,
      ...medicine,
      memberId: medicine.memberId ?? '',
      stockRemaining: medicine.stockRemaining ?? '',
      doseUnitsPerDose: String(medicine.doseUnitsPerDose ?? '1'),
      stockBufferDays: String(medicine.stockBufferDays ?? '7'),
      stockUnitLabel: medicine.stockUnitLabel || 'tablets',
    })
    setFormFeedback((current) => ({ ...current, medicine: '' }))
  }

  const removeMedicine = (medicine) => confirmDelete(medicine.name, () => {
    setState((current) => ({
      ...current,
      medicines: current.medicines.filter((item) => item.id !== medicine.id),
    }))
    if (medicineForm.id === medicine.id) resetMedicineForm()
  })

  const savePrescription = async (event) => {
    event.preventDefault()
    if (!prescriptionForm.doctor.trim()) {
      setFormFeedback((current) => ({ ...current, prescription: 'Please add the prescribing doctor.' }))
      return
    }
    if (!prescriptionDraftImage) {
      setFormFeedback((current) => ({ ...current, prescription: 'Add a prescription image before saving. This image is required for prescription records.' }))
      return
    }

    setFormFeedback((current) => ({ ...current, prescription: '' }))
    const prescriptionId = prescriptionForm.id || createRecordId()
    try {
      await savePrescriptionImage(user.uid, prescriptionId, prescriptionDraftImage)
    } catch (error) {
      setFormFeedback((current) => ({ ...current, prescription: error?.message || 'Unable to save the prescription image.' }))
      return
    }
    upsertItem('prescriptions', {
      id: prescriptionId,
      doctor: prescriptionForm.doctor.trim(),
      clinic: prescriptionForm.clinic.trim() || 'Clinic',
      notes: prescriptionForm.notes.trim(),
    })
    updatePrescriptionImageUrl(prescriptionId, prescriptionDraftImage)
    setPrescriptionImageRevision((current) => current + 1)
    mirrorPrescriptionImage(prescriptionId, prescriptionDraftImage, 'Prescription saved with image.')
    resetPrescriptionForm()
  }

  const editPrescription = async (prescription) => {
    setPrescriptionForm({
      id: prescription.id,
      doctor: prescription.doctor || '',
      clinic: prescription.clinic || '',
      notes: prescription.notes || '',
    })
    setPrescriptionDraftImage(null)
    setPrescriptionOcr({ status: 'idle', text: '', message: '' })
    if (user?.uid) {
      const image = await getPrescriptionImage(user.uid, prescription.id).catch(() => null)
      if (image) setPrescriptionDraftImage(image)
    }
    setFormFeedback((current) => ({ ...current, prescription: '' }))
  }

  const removePrescription = (prescription) => confirmDelete(`prescription from ${prescription.doctor}`, () => {
    if (user?.uid) {
      void deletePrescriptionImage(user.uid, prescription.id).catch((error) => {
        console.error('Unable to delete the local prescription image', error)
      })
      // Drop the R2 copy first: once the next sync removes the D1 row the file
      // route can no longer resolve it, and the object would be orphaned.
      void deletePrescriptionFile(user, prescription.id)
    }
    updatePrescriptionImageUrl(prescription.id, null)
    setState((current) => ({
      ...current,
      prescriptions: current.prescriptions.filter((item) => item.id !== prescription.id),
    }))
    if (prescriptionForm.id === prescription.id) resetPrescriptionForm()
  })

  // Best-effort R2 mirror. The device copy is already saved by the time this
  // runs, so it never blocks the UI and only softens the status message when
  // there is something worth reporting.
  const mirrorPrescriptionImage = (prescriptionId, image, baseMessage) => {
    uploadPrescriptionFile(user, prescriptionId, image, { syncNow: cloudSyncNow }).then((result) => {
      const note = cloudBackupNote(result)
      if (!note) return
      setPrescriptionPhotoFeedback((current) => ({ ...current, [prescriptionId]: `${baseMessage}${note}` }))
    })
  }
  mirrorPrescriptionImageRef.current = mirrorPrescriptionImage

  const attachPrescriptionImage = async (prescriptionId, source) => {
    if (!user?.uid || prescriptionPhotoBusyId) return
    setPrescriptionPhotoBusyId(prescriptionId)
    setPrescriptionPhotoFeedback((current) => ({
      ...current,
      [prescriptionId]: source === 'camera' ? 'Opening camera...' : 'Opening photo library...',
    }))
    window.localStorage.setItem(prescriptionCameraTargetStorageKey, JSON.stringify({
      ownerId: user.uid,
      prescriptionId,
    }))
    try {
      const image = source === 'camera' ? await takePrescriptionPhoto() : await choosePrescriptionPhoto()
      if (!image) {
        setPrescriptionPhotoFeedback((current) => ({ ...current, [prescriptionId]: '' }))
        return
      }
      await savePrescriptionImage(user.uid, prescriptionId, image)
      updatePrescriptionImageUrl(prescriptionId, image)
      setPrescriptionImageRevision((current) => current + 1)
      setPrescriptionPhotoFeedback((current) => ({ ...current, [prescriptionId]: 'Prescription image saved on this device.' }))
      mirrorPrescriptionImage(prescriptionId, image, 'Prescription image saved on this device.')
    } catch (error) {
      setPrescriptionPhotoFeedback((current) => ({
        ...current,
        [prescriptionId]: isCameraCancellation(error) ? '' : error?.message || 'Unable to save the prescription image.',
      }))
    } finally {
      window.localStorage.removeItem(prescriptionCameraTargetStorageKey)
      setPrescriptionPhotoBusyId('')
    }
  }

  const capturePrescriptionImage = (prescriptionId) => attachPrescriptionImage(prescriptionId, 'camera')
  const uploadPrescriptionImage = (prescriptionId) => attachPrescriptionImage(prescriptionId, 'gallery')

  const setPrescriptionDraft = async (image) => {
    if (!image) return
    setPrescriptionDraftImage(image)
    setPrescriptionOcr({ status: 'processing', text: '', message: 'Reading the image on this device with Google ML Kit...' })
    try {
      const result = await recognizePrescriptionText(image, prescriptionOcrScript)
      setPrescriptionOcr(result)
    } catch (error) {
      setPrescriptionOcr({ status: 'failed', text: '', message: error?.message || 'OCR could not read this image. Review it and enter the written details manually.' })
    }
  }

  const attachPrescriptionDraft = async (source) => {
    if (prescriptionDraftBusy) return
    setPrescriptionDraftBusy(true)
    setPrescriptionOcr({ status: 'processing', text: '', message: source === 'camera' ? 'Opening camera...' : 'Opening photo library...' })
    try {
      const image = source === 'camera' ? await takePrescriptionPhoto() : await choosePrescriptionPhoto()
      if (!image) {
        setPrescriptionOcr({ status: 'idle', text: '', message: '' })
        return
      }
      await setPrescriptionDraft(image)
    } catch (error) {
      setPrescriptionOcr({ status: isCameraCancellation(error) ? 'idle' : 'failed', text: '', message: isCameraCancellation(error) ? '' : error?.message || 'Unable to load this prescription image.' })
    } finally {
      setPrescriptionDraftBusy(false)
    }
  }

  const capturePrescriptionDraft = () => attachPrescriptionDraft('camera')
  const uploadPrescriptionDraft = () => attachPrescriptionDraft('gallery')

  const uploadPrescriptionDraftFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || prescriptionDraftBusy) return
    setPrescriptionDraftBusy(true)
    try {
      await setPrescriptionDraft(validatePrescriptionImage(file))
    } catch (error) {
      setPrescriptionOcr({ status: 'failed', text: '', message: error?.message || 'Unable to load this prescription image.' })
    } finally {
      setPrescriptionDraftBusy(false)
    }
  }

  const applyPrescriptionOcr = () => {
    if (!prescriptionOcr.text) return
    setPrescriptionForm((current) => ({ ...current, notes: prescriptionOcr.text }))
    setPrescriptionOcr((current) => ({ ...current, message: 'OCR draft copied to Instructions. Review every field before saving.' }))
  }

  const uploadPrescriptionImageFile = async (prescriptionId, event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !user?.uid || prescriptionPhotoBusyId) return

    setPrescriptionPhotoBusyId(prescriptionId)
    setPrescriptionPhotoFeedback((current) => ({
      ...current,
      [prescriptionId]: 'Saving uploaded image...',
    }))

    try {
      const image = validatePrescriptionImage(file)
      await savePrescriptionImage(user.uid, prescriptionId, image)
      updatePrescriptionImageUrl(prescriptionId, image)
      setPrescriptionImageRevision((current) => current + 1)
      setPrescriptionPhotoFeedback((current) => ({ ...current, [prescriptionId]: 'Prescription image saved on this device.' }))
      mirrorPrescriptionImage(prescriptionId, image, 'Prescription image saved on this device.')
    } catch (error) {
      setPrescriptionPhotoFeedback((current) => ({
        ...current,
        [prescriptionId]: error?.message || 'Unable to save the prescription image.',
      }))
    } finally {
      setPrescriptionPhotoBusyId('')
    }
  }

  const saveAppointment = (event) => {
    event.preventDefault()
    if (!appointmentForm.doctor.trim() || !appointmentForm.date) {
      setFormFeedback((current) => ({ ...current, appointment: 'Please add the doctor and appointment date.' }))
      return
    }
    setFormFeedback((current) => ({ ...current, appointment: '' }))
    const existingAppointment = state.appointments.find((item) => item.id === appointmentForm.id)
    upsertItem('appointments', {
      id: appointmentForm.id || createRecordId(),
      doctor: appointmentForm.doctor.trim(),
      clinic: appointmentForm.clinic.trim() || 'Clinic',
      date: appointmentForm.date,
      time: appointmentForm.time || '09:00',
      status: existingAppointment?.status || 'Upcoming',
    })
    resetAppointmentForm()
  }

  const editAppointment = (appointment) => {
    setAppointmentForm({ ...emptyAppointmentForm, ...appointment })
    setFormFeedback((current) => ({ ...current, appointment: '' }))
  }

  const removeAppointment = (appointment) => confirmDelete(`appointment with ${appointment.doctor}`, () => {
    setState((current) => ({
      ...current,
      appointments: current.appointments.filter((item) => item.id !== appointment.id),
    }))
    if (appointmentForm.id === appointment.id) resetAppointmentForm()
  })

  const formatAuthError = (error) => {
    if (error?.code === 'auth/invalid-credential') {
      return 'The email or password is incorrect.'
    }
    if (error?.code === 'auth/email-already-in-use') {
      return 'This email is already registered.'
    }
    if (error?.code === 'auth/weak-password') {
      return 'Use a stronger password with at least 8 characters.'
    }
    if (error?.code === 'auth/local-reset-unavailable') {
      return 'Password reset emails are unavailable in local-only mode. Create a new local account or delete the local app data if you cannot recover the password.'
    }
    return error?.message || 'Authentication failed.'
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthError('')
    setResetFeedback('')
    setAuthSubmitting(true)
    try {
      let result
      if (isCloudEnabled()) {
        const cloudResult = await authenticateCloudAccount({
          mode: authMode === 'signup' ? 'signup' : 'login',
          email: authForm.email,
          password: authForm.password,
          displayName: authForm.name,
          attestationToken,
        })
        result = await adoptServerUser(cloudResult.user)
        if (cloudResult.devVerificationToken) setVerificationToken(cloudResult.devVerificationToken)
        setAppNotice(cloudResult.user.emailVerified
          ? `Signed in securely as ${cloudResult.user.email}.`
          : `Account created. Verify ${cloudResult.user.email} before sharing care data.`)
      } else {
        if (authMode === 'signup') {
          result = await signupWithEmail(authForm.email, authForm.password, authForm.name)
        } else {
          result = await loginWithEmail(authForm.email, authForm.password)
        }
        const email = result?.user?.email || normalizeEmail(authForm.email)
        setAppNotice(`User ID and protected password are saved on this device for ${email}.`)
        void notifyAccountSaved(email).catch((error) => console.error('Unable to send account saved notification', error))
      }
      setAttestationToken('')
    } catch (error) {
      setAuthError(formatAuthError(error))
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleLogout = async () => {
    const cloudWasEnabled = isCloudEnabled()
    let cloudRevoked = false
    if (cloudWasEnabled && user) {
      cloudRevoked = await revokeCloudSession(user).catch(() => false)
    }
    await logoutFromLocalAccount()
    setAppNotice(cloudWasEnabled && !cloudRevoked
      ? 'Signed out locally. The cloud device session could not be revoked while offline.'
      : 'Signed out safely from this device.')
  }

  const handlePasswordReset = async () => {
    const email = normalizeEmail(authForm.email)
    if (!email) {
      setAuthError('Enter your email address first.')
      return
    }
    setAuthError('')
    setResetFeedback('')
    try {
      if (isCloudEnabled()) {
        const result = await requestPasswordReset(email)
        setResetToken(result.devResetToken || '')
        setResetFeedback(result.devResetToken
          ? 'Development reset token ready. In production, use the token from your email.'
          : 'If an account exists for this email, reset instructions have been sent.')
      } else {
        await sendResetLink(email)
        setResetFeedback('Password reset instructions were prepared.')
      }
    } catch (error) {
      setAuthError(formatAuthError(error))
    } finally {
      setAuthSubmitting(false)
    }
  }

  const saveSettings = (nextSettings) => {
    const settings = sanitizeSettings(nextSettings)
    setSettingsError('')
    setSettingsFeedback('Settings saved on this device.')
    setSettingsForm(settings)
    setState((current) => ({ ...current, settings }))
  }

  const handlePasswordResetComplete = async (token, password) => {
    if (!isCloudEnabled()) return
    setAuthError('')
    setResetFeedback('')
    try {
      await resetPassword(token, password)
      const currentUser = user
      if (currentUser) await clearCloudSession(currentUser).catch(() => {})
      await logoutFromLocalAccount()
      setResetToken('')
      setResetFeedback('Password changed. Sign in again with your new password.')
      setAuthMode('login')
    } catch (error) {
      setAuthError(error?.message || 'Unable to reset the password.')
    }
  }

  const handleVerifyEmail = async (token) => {
    if (!isCloudEnabled()) return
    try {
      await verifyEmail(token)
      setVerificationToken('')
      if (user) await adoptServerUser({ uid: user.uid, email: user.email, displayName: user.displayName, emailVerified: true })
      setAppNotice('Email verified. Your account can now use the caregiver network.')
    } catch (error) {
      setSettingsError(error?.message || 'Unable to verify this email.')
    }
  }

  const handleResendVerification = async () => {
    if (!user || !isCloudEnabled()) return
    try {
      const result = await resendVerification(user)
      if (result.devVerificationToken) setVerificationToken(result.devVerificationToken)
      setSettingsFeedback(result.devVerificationToken
        ? 'Development verification token ready. In production, check the email inbox.'
        : 'A new verification email has been sent.')
    } catch (error) {
      setSettingsError(error?.message || 'Unable to resend the verification email.')
    }
  }

  const handleConsentAccept = () => {
    const settings = sanitizeSettings(acceptCurrentConsent(state.settings))
    setSettingsForm(settingsForUser(settings, user))
    setState((current) => ({ ...current, settings }))
    setAppNotice('Privacy and medical-safety consent saved on this device.')
  }

  const setDashboardVariant = (dashboardVariant) => {
    setState((current) => ({
      ...current,
      settings: sanitizeSettings({ ...current.settings, dashboardVariant }),
    }))
    setSettingsForm((current) => sanitizeSettings({ ...current, dashboardVariant }))
  }

  const enableMedicineReminders = async () => {
    setSettingsError('')
    const result = await requestReminderPermission({ requestExact: true })
    if (!result.granted) {
      setSettingsError(result.reason)
      return
    }
    const settings = sanitizeSettings({ ...settingsForm, notificationsEnabled: true })
    setSettingsForm(settings)
    setState((current) => ({ ...current, settings }))
    const scheduleResult = await configureMedicineReminders(state.medicines, settings, state.familyMembers)
    const doseMessage = scheduleResult.doseReminders > 0
      ? `${scheduleResult.doseReminders} medicine dose reminder${scheduleResult.doseReminders === 1 ? '' : 's'} scheduled on this device.`
      : scheduleResult.reason || 'Reminders are enabled, but no medicine dose times are selected.'
    const exactMessage = result.exactAlarmGranted === false || scheduleResult.exactAlarmGranted === false
      ? ` ${result.reason || 'Android exact alarm access is off, so timing may be slightly delayed.'}`
      : ''
    setSettingsFeedback(`${doseMessage}${exactMessage}`)
  }

  const testMedicineReminder = async () => {
    setSettingsError('')
    setSettingsFeedback('Checking reminder access...')
    const access = await requestReminderPermission({ requestExact: true })
    if (!access.granted) {
      setSettingsFeedback('')
      setSettingsError(access.reason)
      return
    }
    const result = await scheduleReminderTest()
    if (!result.scheduled) {
      setSettingsFeedback('')
      setSettingsError(result.reason)
      return
    }
    const exactMessage = result.exactAlarmGranted === false
      ? ' Exact alarm access is off, but the test notification was still queued.'
      : ''
    setSettingsFeedback(`Test reminder scheduled. Keep the phone unlocked or locked and wait 10 seconds for the sound.${exactMessage}`)
  }

  const handleProfilePhotoChange = async (event) => {
    const photo = event.target.files?.[0]
    event.target.value = ''
    if (!photo) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) {
      setProfilePhotoFeedback('Choose a JPG, PNG, or WebP image.')
      return
    }
    if (photo.size > 10 * 1024 * 1024) {
      setProfilePhotoFeedback('Profile photos must be 10 MB or smaller.')
      return
    }
    try {
      await saveProfilePhoto(profilePhotoId, photo)
      setProfilePhotoBlob(photo)
      setProfilePhotoFeedback('Profile photo saved on this device.')
    } catch {
      setProfilePhotoFeedback('Unable to save the profile photo on this device.')
    }
  }

  const handleRemoveProfilePhoto = async () => {
    try {
      await deleteProfilePhoto(profilePhotoId)
      setProfilePhotoBlob(null)
      setProfilePhotoFeedback('Profile photo removed from this device.')
    } catch {
      setProfilePhotoFeedback('Unable to remove the profile photo from this device.')
    }
  }

  const handleExportBackup = async (backupPassword) => {
    if (!user?.uid) throw new Error('Sign in before creating a backup.')
    const prescriptionImages = {}
    for (const prescription of state.prescriptions) {
      const image = await getPrescriptionImage(user.uid, prescription.id)
      if (image) prescriptionImages[prescription.id] = await blobToBackupImage(image)
    }
    const payload = {
      format: 'medloop-local-data',
      version: 1,
      exportedAt: new Date().toISOString(),
      account: { email: user.email, displayName: user.displayName },
      state,
      media: {
        profilePhoto: await blobToBackupImage(profilePhotoBlob),
        prescriptionImages,
      },
    }
    const encrypted = await createEncryptedBackup(payload, backupPassword)
    await saveEncryptedBackupFile(encrypted)
    return 'Encrypted backup created. Keep the file and password in a safe place.'
  }

  const handleImportBackup = async (file, backupPassword) => {
    if (!user?.uid) throw new Error('Sign in before restoring a backup.')
    if (!file) throw new Error('Choose a MedLoop backup file first.')
    if (file.size > MAX_BACKUP_FILE_BYTES) throw new Error('Backup files must be 100 MB or smaller.')
    const payload = await decryptBackupFile(await file.text(), backupPassword)
    if (payload?.format !== 'medloop-local-data' || payload.version !== 1 || !payload.state) {
      throw new Error('This is not a supported MedLoop data backup.')
    }
    if (!window.confirm('Replace this account’s current local records and images with the selected backup?')) {
      return 'Restore cancelled.'
    }

    const restoredState = sanitizeState(payload.state)
    await deletePrescriptionImagesForOwner(user.uid)
    const restoredImageEntries = []
    for (const prescription of restoredState.prescriptions) {
      const image = backupImageToBlob(payload.media?.prescriptionImages?.[prescription.id])
      if (image) {
        await savePrescriptionImage(user.uid, prescription.id, image)
        restoredImageEntries.push([prescription.id, image])
      }
    }
    const restoredProfilePhoto = backupImageToBlob(payload.media?.profilePhoto)
    if (restoredProfilePhoto) await saveProfilePhoto(profilePhotoId, restoredProfilePhoto)
    else await deleteProfilePhoto(profilePhotoId)

    setState(restoredState)
    setSettingsForm(settingsForUser(restoredState.settings, user))
    setProfilePhotoBlob(restoredProfilePhoto)
    replacePrescriptionImageUrls(restoredImageEntries)
    setPrescriptionImageRevision((current) => current + 1)
    return 'Encrypted backup restored on this device.'
  }

  const handleDeleteAccount = async () => {
    if (!user) {
      setSettingsError('Sign in before deleting an account.')
      return
    }
    if (accountUsesPassword && !deletePassword) {
      setSettingsError('Enter your current password before deleting the account.')
      return
    }
    if (!window.confirm('Permanently delete this local account and its MedLoop records on this device? This cannot be undone.')) return
    setSettingsError('')
    setSettingsFeedback('Deleting account data...')
    setAccountDeleting(true)
    try {
      if (isCloudEnabled()) {
        await deleteCloudAccount(user, deletePassword)
      } else {
        await deleteCurrentAccount(accountUsesPassword ? deletePassword : '')
      }
      await deleteProfilePhoto(profilePhotoId)
      await deletePrescriptionImagesForOwner(user.uid)
      replacePrescriptionImageUrls([])
      await removeSecureValue(getLocalStorageKey(getUserStorageId(user)))
      await clearCloudSession(user).catch(() => {})
      if (isCloudEnabled()) await removeCurrentLocalAccount()
      setState(createEmptyState())
      setDeletePassword('')
      setSettingsFeedback('Account deleted.')
    } catch (error) {
      setSettingsFeedback('')
      setSettingsError(
        error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password'
          ? 'The password is incorrect.'
          : error?.message || 'Unable to delete the account.',
      )
    } finally {
      setAccountDeleting(false)
    }
  }

  const handleExportCloudData = async () => {
    if (!user || !isCloudEnabled()) throw new Error('Cloud export is available after connecting the MedLoop backend.')
    return exportCloudAccount(user)
  }

  const simplifyPrescriptionNotes = async () => {
    if (!isCloudEnabled()) {
      setFormFeedback((current) => ({ ...current, prescription: 'Connect the cloud backend to use the authenticated medicine simplifier.' }))
      return
    }
    if (!prescriptionForm.notes.trim()) {
      setFormFeedback((current) => ({ ...current, prescription: 'Enter the written medicine information first.' }))
      return
    }
    setSimplifyBusy(true)
    setFormFeedback((current) => ({ ...current, prescription: '' }))
    try {
      const session = await ensureCloudSession(user)
      const result = await cloudApi.ai.simplify(session.token, prescriptionForm.notes.trim())
      setPrescriptionForm((current) => ({ ...current, notes: result.text || current.notes }))
      setFormFeedback((current) => ({ ...current, prescription: result.refused ? 'The simplifier declined this request for safety.' : 'Simplified text inserted. Review it against the original prescription before saving.' }))
    } catch (error) {
      setFormFeedback((current) => ({ ...current, prescription: error?.status === 429 ? 'The MedLoop AI limit has been reached. Try again later.' : error?.message || 'Unable to simplify this text securely.' }))
    } finally {
      setSimplifyBusy(false)
    }
  }

  const renderAuthPage = () => (
    <AuthPage
      authMode={authMode}
      setAuthMode={setAuthMode}
      authForm={authForm}
      setAuthForm={setAuthForm}
      authError={authError}
      resetFeedback={resetFeedback}
      authSubmitting={authSubmitting}
      handleAuthSubmit={handleAuthSubmit}
      handlePasswordReset={handlePasswordReset}
      cloudEnabled={isCloudEnabled()}
      resetToken={resetToken}
      setResetToken={setResetToken}
      handlePasswordResetComplete={handlePasswordResetComplete}
      setAttestationToken={setAttestationToken}
    />
  )

  const renderCurrentPage = () => {
    if (currentPage === 'auth') {
      if (!authReady) return <LoadingPage />
      if (user) {
        return <DashboardPage progress={progress} nextMedicine={nextMedicine} medicines={state.medicines} familyMembers={state.familyMembers} alerts={alerts} appointments={state.appointments} updateMedicine={updateMedicine} navigateTo={navigateTo} displayName={state.settings.displayName || user?.displayName} dashboardVariant={state.settings.dashboardVariant} setDashboardVariant={setDashboardVariant} />
      }
      return renderAuthPage()
    }

    switch (currentPage) {
      case 'home':
        return <HomePage isFirstRun={isFirstRun} onboardingChecklist={onboardingChecklist} navigateTo={navigateTo} />
      case 'dashboard':
        return (
          <DashboardPage
            progress={progress}
            nextMedicine={nextMedicine}
            medicines={state.medicines}
            familyMembers={state.familyMembers}
            alerts={alerts}
            appointments={state.appointments}
            updateMedicine={updateMedicine}
            navigateTo={navigateTo}
            displayName={state.settings.displayName || user?.displayName}
            dashboardVariant={state.settings.dashboardVariant}
            setDashboardVariant={setDashboardVariant}
          />
        )
      case 'family':
        return (
          <FamilyPage
            members={state.familyMembers}
            medicines={state.medicines}
            familyForm={familyForm}
            setFamilyForm={setFamilyForm}
            saveFamilyMember={saveFamilyMember}
            editFamilyMember={editFamilyMember}
            removeFamilyMember={removeFamilyMember}
            resetFamilyForm={resetFamilyForm}
            prepareRefillAlert={prepareRefillAlert}
            formFeedback={formFeedback.family}
            user={user}
            cloudSyncNow={cloudSyncNow}
          />
        )
      case 'medicines':
        return (
          <MedicinesPage
            medicines={state.medicines}
            members={state.familyMembers}
            medicineForm={medicineForm}
            setMedicineForm={setMedicineForm}
            saveMedicine={saveMedicine}
            updateMedicine={updateMedicine}
            editMedicine={editMedicine}
            removeMedicine={removeMedicine}
            resetMedicineForm={resetMedicineForm}
            formFeedback={formFeedback.medicine}
          />
        )
      case 'prescriptions':
        return (
          <PrescriptionsPage
            prescriptions={state.prescriptions}
            prescriptionForm={prescriptionForm}
            setPrescriptionForm={setPrescriptionForm}
            savePrescription={savePrescription}
            editPrescription={editPrescription}
            removePrescription={removePrescription}
            resetPrescriptionForm={resetPrescriptionForm}
            formFeedback={formFeedback.prescription}
            prescriptionImageUrls={prescriptionImageUrls}
            prescriptionDraftImageUrl={prescriptionDraftImageUrl}
            prescriptionDraftBusy={prescriptionDraftBusy}
            prescriptionOcrScript={prescriptionOcrScript}
            setPrescriptionOcrScript={setPrescriptionOcrScript}
            prescriptionOcr={prescriptionOcr}
            prescriptionPhotoFeedback={prescriptionPhotoFeedback}
            prescriptionPhotoBusyId={prescriptionPhotoBusyId}
            capturePrescriptionImage={capturePrescriptionImage}
            uploadPrescriptionImage={uploadPrescriptionImage}
            capturePrescriptionDraft={capturePrescriptionDraft}
            uploadPrescriptionDraft={uploadPrescriptionDraft}
            uploadPrescriptionDraftFile={uploadPrescriptionDraftFile}
            applyPrescriptionOcr={applyPrescriptionOcr}
            uploadPrescriptionImageFile={uploadPrescriptionImageFile}
            simplifyPrescriptionNotes={simplifyPrescriptionNotes}
            simplifyBusy={simplifyBusy}
            cloudEnabled={isCloudEnabled()}
          />
        )
      case 'alerts':
        return <AlertsPage alerts={alerts} />
      case 'appointments':
        return (
          <AppointmentsPage
            appointments={state.appointments}
            appointmentForm={appointmentForm}
            setAppointmentForm={setAppointmentForm}
            saveAppointment={saveAppointment}
            editAppointment={editAppointment}
            removeAppointment={removeAppointment}
            resetAppointmentForm={resetAppointmentForm}
            formFeedback={formFeedback.appointment}
          />
        )
      case 'reports':
        return <ReportsPage medicines={state.medicines} doseLogs={state.doseLogs} user={user} />
      case 'emergency-card':
        return <EmergencyCardPage members={state.familyMembers} medicines={state.medicines} user={user} />
      case 'settings':
        return (
          <SettingsPage
            user={user}
            settingsForm={settingsForm}
            setSettingsForm={(nextForm) => {
              setSettingsFeedback('')
              setSettingsError('')
              setSettingsForm(nextForm)
            }}
            saveSettings={saveSettings}
            settingsFeedback={settingsFeedback}
            settingsError={settingsError}
            enableMedicineReminders={enableMedicineReminders}
            testMedicineReminder={testMedicineReminder}
            handleDeleteAccount={handleDeleteAccount}
            handleExportCloudData={handleExportCloudData}
            verificationToken={verificationToken}
            setVerificationToken={setVerificationToken}
            handleVerifyEmail={handleVerifyEmail}
            handleResendVerification={handleResendVerification}
            deletePassword={deletePassword}
            setDeletePassword={setDeletePassword}
            accountDeleting={accountDeleting}
            accountUsesPassword={accountUsesPassword}
            profilePhotoUrl={profilePhotoUrl}
            profilePhotoFeedback={profilePhotoFeedback}
            handleProfilePhotoChange={handleProfilePhotoChange}
            handleRemoveProfilePhoto={handleRemoveProfilePhoto}
            handleExportBackup={handleExportBackup}
            handleImportBackup={handleImportBackup}
            navigateTo={navigateTo}
          />
        )
      case 'legal':
        return <LegalPage navigateTo={navigateTo} />
      default:
        return <DashboardPage progress={progress} nextMedicine={nextMedicine} medicines={state.medicines} familyMembers={state.familyMembers} alerts={alerts} appointments={state.appointments} updateMedicine={updateMedicine} navigateTo={navigateTo} displayName={state.settings.displayName || user?.displayName} dashboardVariant={state.settings.dashboardVariant} setDashboardVariant={setDashboardVariant} />
    }
  }

  const pageTitle = currentPage === 'auth' ? 'Sign in' : pageById[currentPage]?.label || 'Dashboard'
  const syncLabel = !authReady
    ? 'Checking account'
    : user
      ? `${user.email || 'Account'} | ${cloudStatusLabel(cloudStatus)}`
      : 'Local mode'
  const appNoticeElement = appNotice ? <div className="app-toast" role="status">{appNotice}</div> : null

  if (!authReady || !accountReady) return <><LoadingPage />{appNoticeElement}</>
  if (!user) return (
    <div className="auth-frame">
      <Suspense fallback={<LoadingPage />}>{renderAuthPage()}</Suspense>
      <footer className="app-footer">Developed by Aneruth <span aria-hidden="true">|</span> Rosaline</footer>
      {appNoticeElement}
    </div>
  )

  if (!consentGiven) return (
    <div className="auth-frame">
      <Suspense fallback={<LoadingPage />}><ConsentPage user={user} onAccept={handleConsentAccept} onSignOut={handleLogout} /></Suspense>
      <footer className="app-footer">Developed by Aneruth <span aria-hidden="true">|</span> Rosaline</footer>
      {appNoticeElement}
    </div>
  )

  return (
    <>
      <AppShell
        currentPage={currentPage}
        pageTitle={pageTitle}
        syncLabel={syncLabel}
        user={user}
        profilePhotoUrl={profilePhotoUrl || user?.photoURL || ''}
        navigateTo={navigateTo}
        handleLogout={handleLogout}
        familyMembers={state.familyMembers}
        alertCount={alerts.length}
        assistantContext={{
          displayName: state.settings.displayName,
          familyCount: state.familyMembers.length,
          medicineCount: state.medicines.length,
          appointmentCount: state.appointments.length,
          prescriptionCount: state.prescriptions.length,
          alertCount: alerts.length,
          progress,
          notificationsEnabled: state.settings.notificationsEnabled,
        }}
      >
        <Suspense fallback={<LoadingPage />}>{renderCurrentPage()}</Suspense>
      </AppShell>
      {appNoticeElement}
    </>
  )
}

export default App
