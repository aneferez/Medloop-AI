import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

const BACKUP_FORMAT = 'medloop-encrypted-backup'
const BACKUP_VERSION = 1
const BACKUP_ITERATIONS = 310_000
export const MAX_BACKUP_FILE_BYTES = 100 * 1024 * 1024

function bytesToBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(value) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function deriveBackupKey(password, salt, iterations) {
  if (!globalThis.crypto?.subtle) throw new Error('Encrypted backups are unavailable on this device.')
  const sourceKey = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    sourceKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function createEncryptedBackup(payload, password) {
  if (String(password || '').length < 8) throw new Error('Use a backup password with at least 8 characters.')
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16))
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveBackupKey(password, salt, BACKUP_ITERATIONS)
  const plaintext = new TextEncoder().encode(JSON.stringify(payload))
  const encrypted = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: BACKUP_ITERATIONS, salt: bytesToBase64(salt) },
    cipher: { name: 'AES-GCM', iv: bytesToBase64(iv) },
    data: bytesToBase64(new Uint8Array(encrypted)),
  })
}

export async function decryptBackupFile(contents, password) {
  try {
    const backup = JSON.parse(contents)
    if (backup?.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION) throw new Error('Unsupported backup format.')
    const iterations = Number(backup.kdf?.iterations)
    if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) throw new Error('Invalid backup security settings.')
    const key = await deriveBackupKey(password, base64ToBytes(backup.kdf.salt), iterations)
    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(backup.cipher.iv) },
      key,
      base64ToBytes(backup.data),
    )
    return JSON.parse(new TextDecoder().decode(decrypted))
  } catch (error) {
    if (/unsupported|invalid backup/i.test(String(error?.message || ''))) throw error
    throw new Error('Unable to open this backup. Check the backup password and file.')
  }
}

export async function blobToBackupImage(blob) {
  if (!blob) return null
  return {
    type: blob.type || 'image/jpeg',
    data: bytesToBase64(new Uint8Array(await blob.arrayBuffer())),
  }
}

export function backupImageToBlob(image) {
  if (!image?.data || !String(image.type || '').startsWith('image/')) return null
  return new Blob([base64ToBytes(image.data)], { type: image.type })
}

export async function saveEncryptedBackupFile(contents) {
  const date = new Date().toISOString().slice(0, 10)
  const fileName = `MedLoop-backup-${date}.medloop`
  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: contents,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    })
    await Share.share({
      title: 'MedLoop encrypted backup',
      text: 'Save this encrypted MedLoop backup in a safe location.',
      files: [result.uri],
      dialogTitle: 'Save MedLoop backup',
    })
    return fileName
  }

  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
  return fileName
}
