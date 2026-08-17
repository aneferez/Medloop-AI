import { useCallback, useEffect, useRef, useState } from 'react'
import { isCloudEnabled } from './config.js'
import { ensureCloudSession } from './session.js'
import { buildSyncSnapshot } from './mappers.js'
import { cloudApi } from './apiClient.js'

// Best-effort, local-first cloud sync. Registers a device session on sign-in
// and debounces a snapshot push whenever state changes. Every failure is
// swallowed — the app never blocks on or breaks because of the cloud. When
// VITE_MEDLOOP_API_URL is unset, this is a no-op returning 'disabled'.
//
// Returns { status, syncNow }, where status is one of
// 'disabled' | 'connecting' | 'syncing' | 'synced' | 'offline'. syncNow pushes
// immediately rather than waiting out the debounce — file uploads need the
// prescription row to exist server-side before they can attach to it.
export function useCloudSync({ user, state, accountReady }) {
  const [status, setStatus] = useState(() => (isCloudEnabled() ? 'connecting' : 'disabled'))
  const sessionRef = useRef(null)
  const stateRef = useRef(state)
  const timerRef = useRef(null)
  stateRef.current = state

  const push = useCallback(async () => {
    const session = sessionRef.current
    if (!session?.token) return false
    setStatus('syncing')
    try {
      await cloudApi.sync(session.token, buildSyncSnapshot(stateRef.current))
      setStatus('synced')
      return true
    } catch {
      setStatus('offline')
      return false
    }
  }, [])

  // Establish (or drop) the cloud session as the signed-in account changes.
  useEffect(() => {
    if (!isCloudEnabled()) {
      setStatus('disabled')
      return undefined
    }
    if (!accountReady || !user) {
      sessionRef.current = null
      setStatus(user ? 'connecting' : 'disabled')
      return undefined
    }

    let active = true
    setStatus('connecting')
    ensureCloudSession(user)
      .then((session) => {
        if (!active) return
        sessionRef.current = session
        push()
      })
      .catch(() => {
        if (active) setStatus('offline')
      })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user?.email, accountReady])

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
    default: return 'local only'
  }
}
