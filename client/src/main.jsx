import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Register service worker with auto-update
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })
      console.log('Service Worker registered:', registration.scope)

      // Check for updates periodically (every 30 minutes)
      setInterval(() => registration.update(), 30 * 60 * 1000)

      // When a new SW is waiting, activate it and reload
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            // New version activated, reload to use fresh assets
            window.location.reload()
          }
        })
      })
    } catch (error) {
      console.error('Service Worker registration failed:', error)
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
