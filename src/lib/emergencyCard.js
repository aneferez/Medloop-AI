function isExplicitPatient(member) {
  if (!member || typeof member !== 'object') return false
  if (member.isPatient === true || member.isPrimaryPatient === true) return true
  const role = String(member.role || member.memberType || '').trim().toLowerCase()
  return role === 'patient' || role === 'self'
}

export function getDefaultEmergencyCardMemberId(members = []) {
  if (!Array.isArray(members) || members.length === 0) return null

  const explicitPatient = members.find(isExplicitPatient)
  if (explicitPatient?.id != null) return String(explicitPatient.id)
  if (members.length === 1 && members[0]?.id != null) return String(members[0].id)
  return null
}

export function selectEmergencyCardMember(members = [], selectedMemberId = '') {
  if (!Array.isArray(members) || members.length === 0) return null
  const selected = members.find((member) => String(member?.id) === String(selectedMemberId))
  if (selected) return selected

  const defaultId = getDefaultEmergencyCardMemberId(members)
  return defaultId ? members.find((member) => String(member.id) === defaultId) || null : null
}

export function getEmergencyCardMedicines(medicines = [], memberId) {
  if (!Array.isArray(medicines) || memberId == null) return []
  return medicines.filter((medicine) => String(medicine?.memberId) === String(memberId))
}
