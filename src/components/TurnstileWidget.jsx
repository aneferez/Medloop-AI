import { useEffect, useRef } from 'react'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadTurnstile() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.turnstile) return Promise.resolve(window.turnstile)
  return new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`)
    const script = existing || document.createElement('script')
    const finish = () => resolve(window.turnstile || null)
    script.addEventListener('load', finish, { once: true })
    script.addEventListener('error', finish, { once: true })
    if (!existing) {
      script.async = true
      script.src = SCRIPT_SRC
      document.head.appendChild(script)
    }
    window.setTimeout(finish, 7000)
  })
}

function TurnstileWidget({ onToken }) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined
    let active = true
    loadTurnstile().then((turnstile) => {
      if (!active || !turnstile || !containerRef.current) return
      widgetIdRef.current = turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => onToken?.(token),
        'expired-callback': () => onToken?.(''),
        'error-callback': () => onToken?.(''),
      })
    })
    return () => {
      active = false
      if (widgetIdRef.current !== null && window.turnstile?.remove) window.turnstile.remove(widgetIdRef.current)
      widgetIdRef.current = null
    }
  }, [onToken, siteKey])

  if (!siteKey) return null
  return <div className="turnstile-widget" aria-label="Security verification" ref={containerRef} />
}

export default TurnstileWidget
