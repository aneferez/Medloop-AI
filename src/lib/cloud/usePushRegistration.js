import { useEffect, useState } from 'react'
import { initPushNotifications } from './pushToken.js'

// Registers this device for push once signed in, sending the FCM token to the
// backend. Best-effort and native-only; a no-op on web or when the cloud is off.
export function usePushRegistration({ user, accountReady, onAlert }) {
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    if (!accountReady || !user) {
      setStatus('idle')
      return undefined
    }
    let active = true
    let cleanup = () => {}
    initPushNotifications(user, { onStatus: (next) => { if (active) setStatus(next) }, onAlert })
      .then((remove) => { if (active) cleanup = remove; else remove() })
      .catch(() => { if (active) setStatus('error') })
    return () => {
      active = false
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user?.email, accountReady, onAlert])

  return status
}
