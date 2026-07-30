const DATABASE_NAME = 'medloop-local-media'
const STORE_NAME = 'prescription-images'
const DATABASE_VERSION = 2
const STORE_NAMES = ['profile-photos', STORE_NAME]

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

function imageKey(ownerId, prescriptionId) {
  return `${String(ownerId || '').trim()}:${String(prescriptionId || '').trim()}`
}

async function runTransaction(mode, operation) {
  const database = await openDatabase()
  if (!database) throw new Error('Local media storage is unavailable.')

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

export const getPrescriptionImage = (ownerId, prescriptionId) => (
  runTransaction('readonly', (store) => store.get(imageKey(ownerId, prescriptionId)))
)

export const savePrescriptionImage = (ownerId, prescriptionId, image) => (
  runTransaction('readwrite', (store) => store.put(image, imageKey(ownerId, prescriptionId)))
)

export const deletePrescriptionImage = (ownerId, prescriptionId) => (
  runTransaction('readwrite', (store) => store.delete(imageKey(ownerId, prescriptionId)))
)

export async function deletePrescriptionImagesForOwner(ownerId) {
  const prefix = `${String(ownerId || '').trim()}:`
  const database = await openDatabase()
  if (!database) return

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) return
      if (String(cursor.key).startsWith(prefix)) cursor.delete()
      cursor.continue()
    }
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error)
    }
  })
}
