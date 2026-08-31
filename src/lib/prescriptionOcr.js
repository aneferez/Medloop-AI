import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'

function bytesToBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function imageExtension(type) {
  const normalized = String(type || '').toLowerCase()
  if (normalized.includes('png')) return 'png'
  if (normalized.includes('webp')) return 'webp'
  return 'jpg'
}

export const OCR_SCRIPTS = [
  { value: 'LATIN', label: 'English / Latin' },
  { value: 'DEVANAGARI', label: 'Hindi / Devanagari' },
]

const ML_KIT_SCRIPT_KEYS = {
  LATIN: 'Latin',
  DEVANAGARI: 'Devanagari',
}

export function resolveOcrScript(Script, value) {
  const requested = String(value || 'LATIN').toUpperCase()
  const scriptKey = ML_KIT_SCRIPT_KEYS[requested] || ML_KIT_SCRIPT_KEYS.LATIN
  return Script?.[scriptKey] || Script?.Latin || 'LATIN'
}

/**
 * Recognize prescription text on-device with Google ML Kit. The native plugin
 * is deliberately loaded only when running inside Capacitor so the browser
 * never needs a Google credential or sends the image to a hosted service.
 */
export async function recognizePrescriptionText(image, script = 'LATIN') {
  if (!image) throw new Error('Add a prescription image before starting OCR.')
  if (!Capacitor.isNativePlatform()) {
    return { status: 'unavailable', text: '', message: 'On-device OCR is available in the Android app. Review the image and enter the written details manually on web.' }
  }

  const fileName = `medloop-ocr-${globalThis.crypto?.randomUUID?.() || Date.now()}.${imageExtension(image.type)}`
  let uri = ''
  try {
    const bytes = new Uint8Array(await image.arrayBuffer())
    const saved = await Filesystem.writeFile({
      path: fileName,
      data: bytesToBase64(bytes),
      directory: Directory.Cache,
    })
    uri = saved.uri || fileName
    const { Script, TextRecognition } = await import('@capacitor-mlkit/text-recognition')
    const result = await TextRecognition.processImage({ path: uri, script: resolveOcrScript(Script, script) })
    const text = String(result?.text || '').trim()
    return text
      ? { status: 'ready', text, message: 'OCR draft ready. Review it carefully before saving.' }
      : { status: 'empty', text: '', message: 'No readable text was found. Enter the written details manually.' }
  } catch (error) {
    throw new Error(error?.message || 'Unable to read text from this prescription image.')
  } finally {
    await Filesystem.deleteFile({ path: fileName, directory: Directory.Cache }).catch(() => {})
  }
}
