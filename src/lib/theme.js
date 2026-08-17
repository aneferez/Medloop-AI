// Light/dark theme manager. An inline script in index.html stamps the initial
// data-theme on <html> before React mounts (no flash); this module reads and
// updates it at runtime.

const STORAGE_KEY = 'medloop-theme'

export function getStoredTheme() {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function systemTheme() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme() {
  return getStoredTheme() || systemTheme()
}

export function applyTheme(theme) {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme
}

export function setTheme(theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // storage unavailable — the theme still applies for this session
  }
  applyTheme(theme)
  return theme
}

export function currentTheme() {
  return (typeof document !== 'undefined' && document.documentElement.dataset.theme) || resolveTheme()
}

export function toggleTheme() {
  return setTheme(currentTheme() === 'dark' ? 'light' : 'dark')
}
