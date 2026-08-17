import { beforeEach, describe, expect, it, vi } from 'vitest'

// The module under test is a thin best-effort wrapper, so the cloud modules it
// leans on are mocked and the assertions are about which result string comes
// back for each failure mode — the callers branch on those, not on exceptions.

const upload = vi.fn()
const remove = vi.fn()

vi.mock('../src/lib/cloud/config.js', () => ({
  isCloudEnabled: () => true,
  CLOUD_API_BASE_URL: 'https://api.test',
  CLOUD_API_VERSION: 'v1',
}))

vi.mock('../src/lib/cloud/session.js', () => ({
  ensureCloudSession: async () => ({ token: 't1', patientId: 'p1', deviceId: 'd1' }),
}))

vi.mock('../src/lib/cloud/apiClient.js', () => ({
  cloudApi: { files: { upload: (...args) => upload(...args), remove: (...args) => remove(...args) } },
}))

const { cloudBackupNote, deletePrescriptionFile, uploadPrescriptionFile } =
  await import('../src/lib/cloud/prescriptionFiles.js')

const user = { uid: 'u1', email: 'a@example.com' }
const blob = { type: 'image/png', size: 12 }
const apiError = (status, code) => Object.assign(new Error(code), { status, code })

beforeEach(() => {
  upload.mockReset()
  remove.mockReset()
})

describe('uploadPrescriptionFile', () => {
  it('skips without a prescription id or blob', async () => {
    expect(await uploadPrescriptionFile(user, '', blob)).toBe('skipped')
    expect(await uploadPrescriptionFile(user, 'rx1', null)).toBe('skipped')
    expect(upload).not.toHaveBeenCalled()
  })

  it('skips when there is no signed-in account to get a token for', async () => {
    expect(await uploadPrescriptionFile(null, 'rx1', blob)).toBe('skipped')
    expect(upload).not.toHaveBeenCalled()
  })

  it('uploads with the session token', async () => {
    upload.mockResolvedValue({ fileKey: 'k' })
    expect(await uploadPrescriptionFile(user, 'rx1', blob)).toBe('uploaded')
    expect(upload).toHaveBeenCalledWith('t1', 'rx1', blob)
  })

  it('reports R2 being switched off distinctly from a failure', async () => {
    upload.mockRejectedValue(apiError(503, 'files_disabled'))
    expect(await uploadPrescriptionFile(user, 'rx1', blob)).toBe('unavailable')
  })

  it('syncs and retries once when the row has not reached D1 yet', async () => {
    upload.mockRejectedValueOnce(apiError(404, 'not_found')).mockResolvedValueOnce({ fileKey: 'k' })
    const syncNow = vi.fn().mockResolvedValue(true)

    expect(await uploadPrescriptionFile(user, 'rx1', blob, { syncNow })).toBe('uploaded')
    expect(syncNow).toHaveBeenCalledTimes(1)
    expect(upload).toHaveBeenCalledTimes(2)
  })

  it('does not retry when the forced sync itself failed', async () => {
    upload.mockRejectedValue(apiError(404, 'not_found'))
    const syncNow = vi.fn().mockResolvedValue(false)

    expect(await uploadPrescriptionFile(user, 'rx1', blob, { syncNow })).toBe('failed')
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('fails on a 404 when no sync callback was supplied', async () => {
    upload.mockRejectedValue(apiError(404, 'not_found'))
    expect(await uploadPrescriptionFile(user, 'rx1', blob)).toBe('failed')
  })

  it('fails without retrying on other errors', async () => {
    upload.mockRejectedValue(apiError(500, 'server_error'))
    const syncNow = vi.fn()

    expect(await uploadPrescriptionFile(user, 'rx1', blob, { syncNow })).toBe('failed')
    expect(syncNow).not.toHaveBeenCalled()
  })
})

describe('deletePrescriptionFile', () => {
  it('removes the stored object', async () => {
    remove.mockResolvedValue({ deleted: true })
    expect(await deletePrescriptionFile(user, 'rx1')).toBe('removed')
    expect(remove).toHaveBeenCalledWith('t1', 'rx1')
  })

  it('treats an already-absent file as removed', async () => {
    remove.mockRejectedValue(apiError(404, 'not_found'))
    expect(await deletePrescriptionFile(user, 'rx1')).toBe('removed')
  })

  it('distinguishes a real removal failure', async () => {
    remove.mockRejectedValue(apiError(500, 'server_error'))
    expect(await deletePrescriptionFile(user, 'rx1')).toBe('remove_failed')
  })
})

describe('cloudBackupNote', () => {
  it('stays silent when there is nothing to tell the user', () => {
    expect(cloudBackupNote('skipped')).toBe('')
    expect(cloudBackupNote('unavailable')).toBe('')
  })

  it('never promises a retry, because nothing re-queues a failed mirror', () => {
    expect(cloudBackupNote('failed')).not.toMatch(/retry|later/i)
    expect(cloudBackupNote('remove_failed')).not.toMatch(/retry|later/i)
  })

  it('describes the successful outcomes', () => {
    expect(cloudBackupNote('uploaded')).toMatch(/backed up/i)
    expect(cloudBackupNote('removed')).toMatch(/removed/i)
  })
})
