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

function addConnectionHint(rel, url, crossOrigin = false) {
  if (!url || !document.head) return
  if (document.querySelector(`link[rel="${rel}"][href="${url}"]`)) return

  const link = document.createElement('link')
  link.rel = rel
  link.href = url
  if (crossOrigin) link.crossOrigin = ''
  document.head.appendChild(link)
}

function addDnsPrefetch(url) {
  addConnectionHint('dns-prefetch', url)
}

function addPreconnect(url, crossOrigin = false) {
  addConnectionHint('preconnect', url, crossOrigin)
}

function getSupabaseOrigin() {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    return supabaseUrl ? new URL(supabaseUrl).origin : ''
  } catch {
    return ''
  }
}

function prepareImageDnsPrefetch() {
  addDnsPrefetch('https://images.unsplash.com')
  const supabaseOrigin = getSupabaseOrigin()
  if (supabaseOrigin) addDnsPrefetch(supabaseOrigin)
}

function prepareImageConnections() {
  addPreconnect('https://images.unsplash.com', true)

  const supabaseOrigin = getSupabaseOrigin()
  if (supabaseOrigin) addPreconnect(supabaseOrigin, true)
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

function installImageLoadingPlaceholders() {
  if (!('MutationObserver' in window) || !document.documentElement) return

  const clearImageState = img => {
    delete img.dataset.latidoImgState
  }

  const isPlaceholderCandidate = img => {
    const rawSrc = img.currentSrc || img.getAttribute('src') || img.src || ''
    if (!rawSrc) return false

    try {
      const url = new URL(rawSrc, window.location.href)
      const path = url.pathname.toLowerCase()
      if (url.protocol === 'data:') return false
      if (path.endsWith('.svg')) return false
      if (path.includes('/favicon') || path.includes('/icon-')) return false
      return true
    } catch {
      return false
    }
  }

  const setImageLoaded = img => {
    if (!isPlaceholderCandidate(img)) {
      clearImageState(img)
      return
    }
    img.dataset.latidoImgState = 'loaded'
  }

  const syncImageState = img => {
    if (!(img instanceof HTMLImageElement)) return
    if (!isPlaceholderCandidate(img)) {
      clearImageState(img)
      return
    }

    img.dataset.latidoImgState = img.complete ? 'loaded' : 'loading'
  }

  const trackImage = img => {
    if (!(img instanceof HTMLImageElement)) return
    if (img.dataset.latidoImgTracked !== '1') {
      img.dataset.latidoImgTracked = '1'
      img.addEventListener('load', () => setImageLoaded(img))
      img.addEventListener('error', () => setImageLoaded(img))
    }
    syncImageState(img)
  }

  const scanImages = root => {
    if (root instanceof HTMLImageElement) trackImage(root)
    root.querySelectorAll?.('img').forEach(trackImage)
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') {
        trackImage(record.target)
        continue
      }

      record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) scanImages(node)
      })
    }
  })

  const start = () => {
    scanImages(document)
    observer.observe(document.documentElement, {
      attributes:true,
      attributeFilter:['src', 'srcset'],
      childList:true,
      subtree:true,
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true })
  } else {
    start()
  }
}

prepareImageDnsPrefetch()
scheduleImageConnections()
installImageLoadingPlaceholders()

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
