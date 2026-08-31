// Pure mappers from the local-first app model to the cloud /sync payload.
// The app owns record IDs, so IDs pass straight through — keeping cloud
// medicine.memberId references aligned with local family IDs.

// Local family member -> cloud shape. The local model's single "Level 1"
// contact doubles as the primary emergency contact.
export function familyMemberToCloud(member) {
  const phone = member.phone ? String(member.phone).trim() : ''
  const whatsapp = member.whatsappNumber ? String(member.whatsappNumber).trim() : ''
  return {
    id: member.id,
    name: member.name,
    relationship: member.relationship || 'Family member',
    phone: phone || null,
    whatsappNumber: whatsapp || null,
    alertLevel: member.alertLevel || 'Level 3',
    isPrimaryEmergency: member.alertLevel === 'Level 1',
    notifyPush: true,
    notifyWhatsapp: Boolean(whatsapp),
    notifyEmail: false,
    notifySms: Boolean(phone),
    age: member.age ?? null,
    bloodGroup: member.bloodGroup ?? null,
    allergies: member.allergies ?? null,
  }
}

// Local medicine -> cloud shape. `familyIds` gates memberId so a stale
// reference never violates the cloud foreign key.
export function medicineToCloud(medicine, familyIds) {
  const memberId = medicine.memberId != null ? String(medicine.memberId) : null
  const stockTracked = typeof medicine.stockRemaining === 'number'
  return {
    id: medicine.id,
    name: medicine.name,
    dosage: medicine.dosage || '',
    memberId: memberId && familyIds.has(memberId) ? memberId : null,
    morningTime: medicine.morningTime || null,
    afternoonTime: medicine.afternoonTime || null,
    nightTime: medicine.nightTime || null,
    enabledPeriods: Array.isArray(medicine.enabledDosePeriods) ? medicine.enabledDosePeriods : [],
    important: Boolean(medicine.important),
    refill: Boolean(medicine.refill) && medicine.refill !== 'On track',
    stockRemaining: stockTracked ? medicine.stockRemaining : null,
    doseUnitsPerDose: medicine.doseUnitsPerDose ?? 1,
    stockBufferDays: medicine.stockBufferDays ?? 7,
    stockUnitLabel: medicine.stockUnitLabel || 'tablets',
  }
}

// Local dose log -> cloud shape (append-only history + engine input).
export function doseLogToCloud(log) {
  return {
    id: log.id,
    medicineId: log.medicineId ?? null,
    memberId: log.memberId ?? null,
    medicineName: log.medicineName || '',
    dosage: log.dosage || '',
    scheduledTime: log.scheduledTime || null,
    dosePeriod: log.dosePeriod || null,
    status: log.status,
    doseDate: log.doseDate,
    stockAfter: typeof log.stockRemainingAfter === 'number' ? log.stockRemainingAfter : null,
    recordedAt: log.recordedAt,
    takenAt: log.status === 'taken' ? log.recordedAt : null,
  }
}

// Local prescription -> cloud shape. file_key is managed server-side (R2), so
// it is intentionally not sent.
export function prescriptionToCloud(prescription) {
  return {
    id: prescription.id,
    doctor: prescription.doctor || '',
    clinic: prescription.clinic || '',
    notes: prescription.notes || '',
  }
}

// Local appointment -> cloud shape (the local `status` field stays on-device).
export function appointmentToCloud(appointment) {
  return {
    id: appointment.id,
    doctor: appointment.doctor || '',
    clinic: appointment.clinic || 'Clinic',
    date: appointment.date,
    time: appointment.time || '09:00',
  }
}

// Local settings -> cloud channel/preference shape.
export function settingsToCloud(settings = {}) {
  return {
    reminderLeadMinutes: Number.isInteger(settings.reminderLeadMinutes) ? settings.reminderLeadMinutes : 0,
    pushEnabled: Boolean(settings.notificationsEnabled),
    whatsappEnabled: Boolean(settings.whatsappAlerts),
    emailEnabled: false,
    timezone: settings.timezone || 'Asia/Kolkata',
    doseGraceMinutes: Number.isInteger(settings.doseGraceMinutes) ? settings.doseGraceMinutes : 15,
    l2EscalationMinutes: Number.isInteger(settings.l2EscalationMinutes) ? settings.l2EscalationMinutes : 30,
    escalationEnabled: settings.escalationEnabled !== false,
    consentVersion: settings.consentVersion || null,
    consentAcceptedAt: settings.consentAcceptedAt || null,
  }
}

// ---- Cloud -> local ---------------------------------------------------------
// Only ever applied to records this device has not seen before (see
// mergeCloudSnapshot), so the lossy edges stay harmless: `refill` is a
// three-state label locally but a boolean in the cloud, and an appointment's
// local `status` never leaves the device, so both take a sensible default.

export function familyMemberFromCloud(member) {
  return {
    id: String(member.id),
    name: member.name || '',
    relationship: member.relationship || 'Family member',
    phone: member.phone || '',
    whatsappNumber: member.whatsappNumber || '',
    alertLevel: member.alertLevel || 'Level 3',
    age: member.age ?? '',
    bloodGroup: member.bloodGroup ?? '',
    allergies: member.allergies ?? '',
  }
}

export function medicineFromCloud(medicine) {
  return {
    id: String(medicine.id),
    name: medicine.name || '',
    dosage: medicine.dosage || '',
    memberId: medicine.memberId ? String(medicine.memberId) : '',
    morningTime: medicine.morningTime || '',
    afternoonTime: medicine.afternoonTime || '',
    nightTime: medicine.nightTime || '',
    enabledDosePeriods: Array.isArray(medicine.enabledPeriods) ? medicine.enabledPeriods : [],
    important: Boolean(medicine.important),
    refill: medicine.refill ? 'Refill needed' : 'On track',
    stockRemaining: typeof medicine.stockRemaining === 'number' ? medicine.stockRemaining : '',
    doseUnitsPerDose: medicine.doseUnitsPerDose ?? 1,
    stockBufferDays: medicine.stockBufferDays ?? 7,
    stockUnitLabel: medicine.stockUnitLabel || 'tablets',
  }
}

export function prescriptionFromCloud(prescription) {
  return {
    id: String(prescription.id),
    doctor: prescription.doctor || '',
    clinic: prescription.clinic || '',
    notes: prescription.notes || '',
  }
}

export function appointmentFromCloud(appointment) {
  return {
    id: String(appointment.id),
    doctor: appointment.doctor || '',
    clinic: appointment.clinic || 'Clinic',
    date: appointment.date,
    time: appointment.time || '09:00',
    status: 'Upcoming',
  }
}

export function doseLogFromCloud(log) {
  return {
    id: String(log.id),
    medicineId: log.medicineId ?? null,
    memberId: log.memberId ?? null,
    medicineName: log.medicineName || '',
    dosage: log.dosage || '',
    scheduledTime: log.scheduledTime || null,
    dosePeriod: log.dosePeriod || null,
    status: log.status,
    doseDate: log.doseDate,
    stockRemainingAfter: typeof log.stockAfter === 'number' ? log.stockAfter : null,
    recordedAt: log.recordedAt,
  }
}

function mergeById(localList, cloudList, fromCloud) {
  const local = Array.isArray(localList) ? localList : []
  const known = new Set(local.map((item) => String(item.id)))
  const adopted = (Array.isArray(cloudList) ? cloudList : [])
    .filter((item) => item && item.id != null && !known.has(String(item.id)))
    .map(fromCloud)
  return { list: adopted.length ? [...local, ...adopted] : local, adopted: adopted.length }
}

// Union by record id, with the local copy winning any id present on both sides:
// this device's records are the ones the user is looking at and editing.
//
// Deletes do not propagate through this merge — a record deleted on another
// device is simply absent from the snapshot and so is left alone here, and this
// device will push it back. Propagating deletions needs tombstones.
//
// Settings are deliberately untouched: they are device-level preferences.
export function mergeCloudSnapshot(state = {}, snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return { state, adopted: 0 }
  const family = mergeById(state.familyMembers, snapshot.familyMembers, familyMemberFromCloud)
  const medicines = mergeById(state.medicines, snapshot.medicines, medicineFromCloud)
  const prescriptions = mergeById(state.prescriptions, snapshot.prescriptions, prescriptionFromCloud)
  const appointments = mergeById(state.appointments, snapshot.appointments, appointmentFromCloud)
  const doseLogs = mergeById(state.doseLogs, snapshot.doseLogs, doseLogFromCloud)
  const adopted = family.adopted + medicines.adopted + prescriptions.adopted + appointments.adopted + doseLogs.adopted
  if (!adopted) return { state, adopted: 0 }
  return {
    state: {
      ...state,
      familyMembers: family.list,
      medicines: medicines.list,
      prescriptions: prescriptions.list,
      appointments: appointments.list,
      doseLogs: doseLogs.list,
    },
    adopted,
  }
}

// Assembles the full snapshot the app PUTs to /sync.
export function buildSyncSnapshot(state = {}) {
  const familyMembers = Array.isArray(state.familyMembers) ? state.familyMembers : []
  const medicines = Array.isArray(state.medicines) ? state.medicines : []
  const prescriptions = Array.isArray(state.prescriptions) ? state.prescriptions : []
  const appointments = Array.isArray(state.appointments) ? state.appointments : []
  const doseLogs = Array.isArray(state.doseLogs) ? state.doseLogs : []
  const familyIds = new Set(familyMembers.map((member) => String(member.id)))
  return {
    familyMembers: familyMembers.map(familyMemberToCloud),
    medicines: medicines.map((medicine) => medicineToCloud(medicine, familyIds)),
    prescriptions: prescriptions.map(prescriptionToCloud),
    appointments: appointments.map(appointmentToCloud),
    doseLogs: doseLogs.map(doseLogToCloud),
    settings: settingsToCloud(state.settings),
  }
}
