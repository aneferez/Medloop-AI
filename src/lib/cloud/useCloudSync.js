import { useCallback, useEffect, useRef, useState } from 'react'
import { CLOUD_API_CONFIG_ERROR, isCloudEnabled } from './config.js'
import { ensureCloudSession } from './session.js'
import { buildSyncSnapshot, mergeCloudSnapshot } from './mappers.js'
import { cloudApi } from './apiClient.js'

// Best-effort, local-first cloud sync. Registers a device session on sign-in
// and debounces a snapshot push whenever state changes. Every failure is
// swallowed — the app never blocks on or breaks because of the cloud. When
// VITE_MEDLOOP_API_URL is unset, this is a no-op returning 'disabled'.
//
// Returns { status, syncNow }, where status is one of
// 'disabled' | 'config_error' | 'connecting' | 'syncing' | 'synced' | 'offline'. syncNow pushes
// immediately rather than waiting out the debounce — file uploads need the
// prescription row to exist server-side before they can attach to it.
export function useCloudSync({ user, state, accountReady, onAdopt, attestationToken = '' }) {
  const [status, setStatus] = useState(() => (isCloudEnabled() ? 'connecting' : CLOUD_API_CONFIG_ERROR ? 'config_error' : 'disabled'))
  const sessionRef = useRef(null)
  const stateRef = useRef(state)
  const timerRef = useRef(null)
  const onAdoptRef = useRef(onAdopt)
  // Gates the destructive side of the push. Until this device has pulled and
  // merged, a push must not be allowed to delete the rows it does not carry —
  // otherwise signing in on a second device wipes the account.
  const mergedRef = useRef(false)
  stateRef.current = state
  onAdoptRef.current = onAdopt

  const push = useCallback(async () => {
    const session = sessionRef.current
    if (!session?.token) return false
    setStatus('syncing')
    try {
      const snapshot = buildSyncSnapshot(stateRef.current)
      await cloudApi.sync(session.token, { ...snapshot, prune: mergedRef.current })
      setStatus('synced')
      return true
    } catch {
      setStatus('offline')
      return false
    }
  }, [])

  // Pull the account's snapshot and adopt anything this device has never seen.
  // Only a clean pull unlocks pruning.
  const pullAndMerge = useCallback(async () => {
    const session = sessionRef.current
    if (!session?.token) return false
    try {
      const snapshot = await cloudApi.pullSnapshot(session.token)
      const { state: merged, adopted } = mergeCloudSnapshot(stateRef.current, snapshot)
      if (adopted > 0) {
        stateRef.current = merged
        onAdoptRef.current?.(merged)
      }
      mergedRef.current = true
      return true
    } catch {
      return false
    }
  }, [])

  // Establish (or drop) the cloud session as the signed-in account changes.
  useEffect(() => {
    if (!isCloudEnabled()) {
      setStatus(CLOUD_API_CONFIG_ERROR ? 'config_error' : 'disabled')
      return undefined
    }
    if (!accountReady || !user) {
      sessionRef.current = null
      mergedRef.current = false
      setStatus(user ? 'connecting' : 'disabled')
      return undefined
    }

    let active = true
    setStatus('connecting')
    // A different account means a different snapshot, so pruning is locked
    // again until this session has pulled.
    mergedRef.current = false
    ensureCloudSession(user, { attestationToken })
      .then(async (session) => {
        if (!active) return
        sessionRef.current = session
        await pullAndMerge()
        if (active) await push()
      })
      .catch(() => {
        if (active) setStatus('offline')
      })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user?.email, accountReady, attestationToken])

  // Debounced push on state changes once a session exists.
  useEffect(() => {
    if (!isCloudEnabled() || !accountReady || !user || !sessionRef.current?.token) return undefined
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => { push() }, 1500)
    return () => window.clearTimeout(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, accountReady, user])

  return { status, syncNow: push }
}

// Short label for the app shell's sync indicator.
export function cloudStatusLabel(status) {
  switch (status) {
    case 'syncing': return 'syncing…'
    case 'synced': return 'cloud synced'
    case 'connecting': return 'connecting…'
    case 'offline': return 'local only (offline)'
    case 'config_error': return 'cloud config blocked'
    default: return 'local only'
  }
}
