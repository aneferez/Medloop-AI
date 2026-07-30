import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { deletePrescriptionImage, deletePrescriptionImagesForOwner, getPrescriptionImage, savePrescriptionImage } from '../src/lib/prescriptionImage'
import { deleteProfilePhoto, getProfilePhoto, saveProfilePhoto } from '../src/lib/profilePhoto'

function deleteMediaDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('medloop-local-media')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Media database deletion was blocked.'))
  })
}

describe('local image persistence', () => {
  afterEach(() => deleteMediaDatabase())

  it('saves, reloads, and deletes prescription and profile images', async () => {
    const prescription = new Blob(['prescription'], { type: 'image/jpeg' })
    const profile = new Blob(['profile'], { type: 'image/png' })

    await savePrescriptionImage('owner-1', 'rx-1', prescription)
    await savePrescriptionImage('owner-1', 'rx-2', prescription)
    await saveProfilePhoto('user:owner-1', profile)
    expect((await getPrescriptionImage('owner-1', 'rx-1')).type).toBe('image/jpeg')
    expect((await getProfilePhoto('user:owner-1')).type).toBe('image/png')

    await deletePrescriptionImage('owner-1', 'rx-1')
    expect(await getPrescriptionImage('owner-1', 'rx-1')).toBeNull()
    await deletePrescriptionImagesForOwner('owner-1')
    expect(await getPrescriptionImage('owner-1', 'rx-2')).toBeNull()
    await deleteProfilePhoto('user:owner-1')
    expect(await getProfilePhoto('user:owner-1')).toBeNull()
  })
})
