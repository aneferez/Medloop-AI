import { Camera, CameraDirection, MediaTypeSelection } from '@capacitor/camera'

export const MAX_PRESCRIPTION_IMAGE_BYTES = 10 * 1024 * 1024
export const ALLOWED_PRESCRIPTION_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function normalizedImageType(mediaResult, blob) {
  if (blob.type) return blob.type.toLowerCase()
  const format = String(mediaResult?.metadata?.format || 'jpeg').toLowerCase()
  return format === 'jpg' ? 'image/jpeg' : `image/${format}`
}

export function validatePrescriptionImage(image) {
  if (!image || !ALLOWED_PRESCRIPTION_IMAGE_TYPES.includes(String(image.type || '').toLowerCase())) {
    throw new Error('Choose a JPG, PNG, or WebP prescription image.')
  }
  if (image.size > MAX_PRESCRIPTION_IMAGE_BYTES) {
    throw new Error('Prescription images must be 10 MB or smaller.')
  }
  return image
}

export async function prescriptionMediaToBlob(mediaResult) {
  if (!mediaResult?.webPath) throw new Error('The camera did not return an image.')
  const response = await fetch(mediaResult.webPath)
  if (!response.ok) throw new Error('Unable to read the selected prescription image.')
  const source = await response.blob()
  const type = normalizedImageType(mediaResult, source)
  const image = source.type ? source : new Blob([source], { type })
  return validatePrescriptionImage(image)
}

export async function takePrescriptionPhoto() {
  const result = await Camera.takePhoto({
    quality: 85,
    targetWidth: 2048,
    targetHeight: 2048,
    cameraDirection: CameraDirection.Rear,
    saveToGallery: false,
    includeMetadata: true,
  })
  return prescriptionMediaToBlob(result)
}

export async function choosePrescriptionPhoto() {
  const { results = [] } = await Camera.chooseFromGallery({
    quality: 85,
    targetWidth: 2048,
    targetHeight: 2048,
    mediaType: MediaTypeSelection.Photo,
    allowMultipleSelection: false,
    limit: 1,
    includeMetadata: true,
  })
  return results[0] ? prescriptionMediaToBlob(results[0]) : null
}

export function isCameraCancellation(error) {
  return /cancel|user cancelled/i.test(String(error?.message || error || ''))
}
