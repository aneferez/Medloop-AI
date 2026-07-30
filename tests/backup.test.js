import { describe, expect, it } from 'vitest'
import { backupImageToBlob, blobToBackupImage, createEncryptedBackup, decryptBackupFile } from '../src/lib/localBackup'

describe('encrypted backup and restore', () => {
  it('round-trips account data with authenticated encryption', async () => {
    const payload = {
      state: { medicines: [{ id: 'm1', name: 'Metformin' }], doseLogs: [] },
      exportedAt: '2026-07-30T10:00:00.000Z',
    }
    const encrypted = await createEncryptedBackup(payload, 'correct horse battery staple')

    expect(encrypted).not.toContain('Metformin')
    await expect(decryptBackupFile(encrypted, 'correct horse battery staple')).resolves.toEqual(payload)
    await expect(decryptBackupFile(encrypted, 'wrong password')).rejects.toThrow(/check the backup password/i)
  })

  it('round-trips image data included in a backup', async () => {
    const original = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' })
    const encoded = await blobToBackupImage(original)
    const restored = backupImageToBlob(encoded)

    expect(restored.type).toBe('image/png')
    expect([...new Uint8Array(await restored.arrayBuffer())]).toEqual([1, 2, 3, 4])
  })
})
