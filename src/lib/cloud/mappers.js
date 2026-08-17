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
