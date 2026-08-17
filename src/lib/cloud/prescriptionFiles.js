import { isCloudEnabled } from './config.js'
import { ensureCloudSession } from './session.js'
import { cloudApi } from './apiClient.js'

// Mirrors prescription images into R2. The device copy in IndexedDB stays the
// source of truth — this is a best-effort backup, so every failure is reported
// back as a status string rather than thrown. Callers surface it as a hint next
// to the "saved on this device" message and never block on it.
//
// Results: 'uploaded' | 'removed' | 'skipped' (cloud off / nothing to do)
//          | 'unavailable' (R2 not enabled on the deployment) | 'failed'

async function sessionToken(user) {
  if (!isCloudEnabled() || !user) return null
  try {
    const session = await ensureCloudSession(user)
    return session?.token || null
  } catch {
    return null
  }
}

export async function uploadPrescriptionFile(user, prescriptionId, blob, { syncNow } = {}) {
  if (!prescriptionId || !blob) return 'skipped'
  const token = await sessionToken(user)
  if (!token) return 'skipped'

  const attempt = () => cloudApi.files.upload(token, prescriptionId, blob)
  try {
    await attempt()
    return 'uploaded'
  } catch (error) {
    if (error?.code === 'files_disabled') return 'unavailable'
    // A prescription saved moments ago may not have reached D1 yet — the
    // snapshot push is debounced — and the upload route 404s until it has.
    // Force a sync and try once more.
    if (error?.status === 404 && typeof syncNow === 'function') {
      try {
        const synced = await syncNow()
        if (!synced) return 'failed'
        await attempt()
        return 'uploaded'
      } catch (retryError) {
        return retryError?.code === 'files_disabled' ? 'unavailable' : 'failed'
      }
    }
    return 'failed'
  }
}

export async function deletePrescriptionFile(user, prescriptionId) {
  if (!prescriptionId) return 'skipped'
  const token = await sessionToken(user)
  if (!token) return 'skipped'
  try {
    await cloudApi.files.remove(token, prescriptionId)
    return 'removed'
  } catch (error) {
    if (error?.code === 'files_disabled') return 'unavailable'
    // Nothing stored server-side is the outcome the caller wanted anyway.
    if (error?.status === 404) return 'removed'
    return 'remove_failed'
  }
}

// Human-readable suffix for the on-device confirmation message. Returns '' when
// there is nothing worth telling the user about (cloud off, or R2 not enabled).
// Nothing re-queues a failed mirror, so the wording does not promise a retry.
export function cloudBackupNote(result) {
  switch (result) {
    case 'uploaded': return ' Backed up to your cloud account.'
    case 'removed': return ' Removed from your cloud account too.'
    case 'failed': return ' Could not back it up to the cloud.'
    case 'remove_failed': return ' The cloud copy could not be removed.'
    default: return ''
  }
}
