const toText = (value, fallback = '') => String(value ?? fallback).trim()

function toWhatsAppNumber(value) {
  const phone = toText(value)
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new Error('The WhatsApp number must use international E.164 format.')
  }
  return phone.slice(1)
}

export function buildMissedDoseWhatsAppUri({ contact, medicine, doseLog }) {
  const number = toWhatsAppNumber(contact?.whatsappNumber)
  const medicineName = toText(medicine?.name || doseLog?.medicineName, 'medicine')
  const dosage = toText(medicine?.dosage || doseLog?.dosage, 'as directed')
  const scheduledTime = toText(medicine?.time || doseLog?.scheduledTime, 'the scheduled time')
  const message = `MedLoop reminder: A ${medicineName} dose (${dosage}) scheduled for ${scheduledTime} was marked missed. Please check in. This is not an emergency alert.`
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export function composeMissedDoseWhatsApp(details) {
  const uri = buildMissedDoseWhatsAppUri(details)
  if (typeof window !== 'undefined') window.location.href = uri
  return uri
}

export function buildRefillWhatsAppUri({ familyMember, medicines = [] }) {
  const number = toWhatsAppNumber(familyMember?.whatsappNumber)
  const names = medicines.map((medicine) => toText(medicine?.name)).filter(Boolean)
  const listedNames = names.slice(0, 8).join(', ') || 'the registered medicines'
  const remainder = names.length > 8 ? ` and ${names.length - 8} more` : ''
  const message = `MedLoop refill check: Please review the available supply for ${listedNames}${remainder}. This is a scheduled reminder, not an emergency alert.`
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export function composeRefillWhatsApp(details) {
  const uri = buildRefillWhatsAppUri(details)
  if (typeof window !== 'undefined') window.location.href = uri
  return uri
}
