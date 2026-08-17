// Pure SOS helpers used by the emergency flow. These work with the local family
// model so the one-tap call (row #21) is available even when the cloud is off.

const E164 = /^\+[1-9]\d{7,14}$/

export function hasValidPhone(contact) {
  return typeof contact?.phone === 'string' && E164.test(contact.phone.trim())
}

// Local mirror of the backend's selectPrimaryEmergencyContact: the Level 1
// contact (the app's primary) is preferred, favoring one that is callable.
export function selectPrimaryContactLocal(members = []) {
  if (!Array.isArray(members) || members.length === 0) return null
  const levelOne = members.filter((member) => member.alertLevel === 'Level 1')
  const callableLevelOne = levelOne.find(hasValidPhone)
  if (callableLevelOne) return callableLevelOne
  if (levelOne.length) return levelOne[0]
  const anyCallable = members.find(hasValidPhone)
  if (anyCallable) return anyCallable
  return members[0]
}

// Row #21: the tel: URI for the one-tap native call, or null when uncallable.
export function emergencyCallLink(contact) {
  return hasValidPhone(contact) ? `tel:${contact.phone.trim()}` : null
}
