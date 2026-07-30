const DATABASE_NAME = 'medloop-local-media'
const STORE_NAME = 'profile-photos'
const DATABASE_VERSION = 2
const STORE_NAMES = [STORE_NAME, 'prescription-images']

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      STORE_NAMES.forEach((storeName) => {
        if (!request.result.objectStoreNames.contains(storeName)) {
          request.result.createObjectStore(storeName)
        }
      })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function runTransaction(mode, operation) {
  const database = await openDatabase()
  if (!database) return null

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    const request = operation(transaction.objectStore(STORE_NAME))
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => {
      database.close()
      reject(transaction.error)
    }
  })
}

export const getProfilePhoto = (profileId) => runTransaction('readonly', (store) => store.get(profileId))

export const saveProfilePhoto = (profileId, photo) => runTransaction('readwrite', (store) => store.put(photo, profileId))

export const deleteProfilePhoto = (profileId) => runTransaction('readwrite', (store) => store.delete(profileId))
