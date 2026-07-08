import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-400-italic.css'
import '@fontsource/poppins/latin-500.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource/poppins/latin-800.css'
import '@fontsource/poppins/latin-900.css'
import App from './App.jsx'
import './index.css'

// Prevent browser from restoring scroll position on back/forward navigation
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
}

function addPreconnect(url, crossOrigin = false) {
  if (!url || !document.head) return
  if (document.querySelector(`link[rel="preconnect"][href="${url}"]`)) return

  const link = document.createElement('link')
  link.rel = 'preconnect'
  link.href = url
  if (crossOrigin) link.crossOrigin = ''
  document.head.appendChild(link)
}

function prepareImageConnections() {
  addPreconnect('https://images.unsplash.com', true)

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    if (supabaseUrl) addPreconnect(new URL(supabaseUrl).origin, true)
  } catch {}
}

function scheduleImageConnections() {
  const schedule = callback => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(callback, { timeout:2000 })
    else window.setTimeout(callback, 1200)
  }
  const run = () => schedule(prepareImageConnections)

  if (document.readyState === 'complete') run()
  else window.addEventListener('load', run, { once:true })
}

scheduleImageConnections()

function cleanupDevServiceWorkers() {
  if (import.meta.env.PROD || !('serviceWorker' in navigator)) return

  window.addEventListener('load', async () => {
    const hadController = Boolean(navigator.serviceWorker.controller)
    const registrations = await navigator.serviceWorker.getRegistrations()
      .catch(() => [])

    await Promise.all(
      registrations.map(registration => registration.unregister().catch(() => false)),
    )

    if ('caches' in window) {
      const cacheKeys = await caches.keys().catch(() => [])
      const deletions = []
      for (const key of cacheKeys) {
        if (key.startsWith('latido-')) deletions.push(caches.delete(key).catch(() => false))
      }
      await Promise.all(deletions)
    }

    const refreshFlag = 'latido-dev-sw-reset'
    const alreadyReloaded = sessionStorage.getItem(refreshFlag) === '1'

    if (hadController && !alreadyReloaded) {
      sessionStorage.setItem(refreshFlag, '1')
      window.location.reload()
      return
    }

    sessionStorage.removeItem(refreshFlag)
  }, { once:true })
}

cleanupDevServiceWorkers()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// PWA service worker
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error)
  })
}
