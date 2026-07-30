import { SecureStorage } from '@aparajita/capacitor-secure-storage'

let storageReady

function prepareStorage() {
  if (!storageReady) storageReady = SecureStorage.setKeyPrefix('medloop_')
  return storageReady
}

export async function getSecureValue(key) {
  await prepareStorage()
  return SecureStorage.get(key, false)
}

export async function setSecureValue(key, value) {
  await prepareStorage()
  await SecureStorage.set(key, value, false)
}

export async function removeSecureValue(key) {
  await prepareStorage()
  return SecureStorage.remove(key)
}
