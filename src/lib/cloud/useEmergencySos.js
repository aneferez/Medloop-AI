import { useCallback, useMemo, useRef, useState } from 'react'
import { isCloudEnabled } from './config.js'
import { ensureCloudSession } from './session.js'
import { cloudApi } from './apiClient.js'
import { emergencyCallLink, selectPrimaryContactLocal } from './emergencySos.js'

// Drives the SOS flow (rows #20–#23). The one-tap call is always available from
// local data; the multi-channel family broadcast rides the cloud and is gated
// by a confirmation step so an accidental tap never alerts everyone.
//
// phase: 'idle' | 'confirming' | 'sending' | 'sent' | 'error'
export function useEmergencySos({ user, members }) {
  const [phase, setPhase] = useState('idle')
  const [broadcastReady, setBroadcastReady] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const eventRef = useRef(null)
  const tokenRef = useRef(null)
  const armPromiseRef = useRef(null)

  const contact = useMemo(() => selectPrimaryContactLocal(members), [members])
  const callLink = useMemo(() => emergencyCallLink(contact), [contact])
  const cloudReady = isCloudEnabled()

  // Row #20 + #23: arm the SOS. Creates a pending (unconfirmed) cloud event so
  // nothing is broadcast until the user confirms.
  const arm = useCallback(() => {
    setError('')
    setResult(null)
    setBroadcastReady(false)
    eventRef.current = null
    tokenRef.current = null
    setPhase('confirming')

    if (!cloudReady) {
      armPromiseRef.current = null
      return
    }
    armPromiseRef.current = (async () => {
      try {
        const session = await ensureCloudSession(user)
        tokenRef.current = session.token
        const response = await cloudApi.emergency.trigger(session.token, '')
        eventRef.current = response?.event?.id || null
        setBroadcastReady(Boolean(eventRef.current))
      } catch {
        // Offline or not registered: keep the call option, drop the broadcast.
        eventRef.current = null
        tokenRef.current = null
        setBroadcastReady(false)
      }
    })()
  }, [cloudReady, user])

  // Row #22: confirm and fan the alert out to family across every channel.
  const confirm = useCallback(async () => {
    if (armPromiseRef.current) {
      try { await armPromiseRef.current } catch { /* handled in arm */ }
    }
    if (!eventRef.current || !tokenRef.current) {
      // No cloud broadcast available — acknowledge as call-only.
      setResult({ callOnly: true, recipients: 0, channels: [] })
      setPhase('sent')
      return
    }
    setPhase('sending')
    try {
      const response = await cloudApi.emergency.confirm(tokenRef.current, eventRef.current)
      const notifications = response?.notifications || []
      const sent = notifications.filter((notification) => notification.status === 'sent')
      setResult({
        callOnly: false,
        recipients: sent.length,
        attempted: notifications.length,
        channels: [...new Set(sent.map((notification) => notification.channel))],
      })
      setPhase('sent')
    } catch {
      setError('Could not alert family automatically. You can still call directly.')
      setPhase('error')
    }
  }, [])

  // Row #23: cancel an armed SOS before it broadcasts.
  const cancel = useCallback(async () => {
    const id = eventRef.current
    const token = tokenRef.current
    eventRef.current = null
    tokenRef.current = null
    setBroadcastReady(false)
    setPhase('idle')
    setResult(null)
    setError('')
    if (id && token) {
      try { await cloudApi.emergency.cancel(token, id) } catch { /* best-effort */ }
    }
  }, [])

  const reset = useCallback(() => {
    eventRef.current = null
    tokenRef.current = null
    setBroadcastReady(false)
    setPhase('idle')
    setResult(null)
    setError('')
  }, [])

  // Row #21: open the native dialer for the primary contact.
  const placeCall = useCallback(() => {
    if (callLink && typeof window !== 'undefined') window.location.href = callLink
  }, [callLink])

  return { phase, contact, callLink, result, error, cloudReady, broadcastReady, arm, confirm, cancel, reset, placeCall }
}
