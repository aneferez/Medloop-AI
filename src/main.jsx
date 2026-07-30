import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline, ThemeProvider } from '@mui/material'
import './index.css'
import App from './App.jsx'
import StartupSplash from './components/StartupSplash.jsx'
import medLoopTheme from './theme.js'

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch((error) => console.error('Unable to clear development service workers', error))

  if ('caches' in window) {
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch((error) => console.error('Unable to clear development caches', error))
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={medLoopTheme}>
      <CssBaseline />
      <StartupSplash>
        <App />
      </StartupSplash>
      <div className="developer-watermark" aria-label="Developed by Aneruth and Rosaline">
        Developed by Aneruth | Rosaline
      </div>
    </ThemeProvider>
  </StrictMode>,
)
