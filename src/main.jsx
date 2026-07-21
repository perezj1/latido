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

const SUPABASE_STORAGE_OBJECT_SEGMENT = '/storage/v1/object/public/'
const SUPABASE_STORAGE_RENDER_SEGMENT = '/storage/v1/render/image/public/'
const RASTER_IMAGE_EXTENSIONS = new Set(['avif', 'jpeg', 'jpg', 'png', 'webp'])
const FAST_IMAGE_WIDTH = 800
const FAST_THUMB_IMAGE_WIDTH = 420
const FAST_IMAGE_QUALITY = 68

function isSupabaseHost(url) {
  return url.hostname === 'supabase.co' || url.hostname.endsWith('.supabase.co')
}

function hasRasterImageExtension(url) {
  const filename = url.pathname.split('/').pop() || ''
  const extension = filename.split('.').pop()?.toLowerCase() || ''
  return RASTER_IMAGE_EXTENSIONS.has(extension)
}

function getFastImageWidth(url) {
  const filename = url.pathname.split('/').pop()?.toLowerCase() || ''
  return /-thumb\.[a-z0-9]+$/.test(filename) ? FAST_THUMB_IMAGE_WIDTH : FAST_IMAGE_WIDTH
}

function getFastSupabaseImageSrc(url) {
  if (
    !isSupabaseHost(url)
    || !url.pathname.includes(SUPABASE_STORAGE_OBJECT_SEGMENT)
    || !hasRasterImageExtension(url)
  ) {
    return ''
  }

  const optimized = new URL(url.href)
  optimized.pathname = optimized.pathname.replace(
    SUPABASE_STORAGE_OBJECT_SEGMENT,
    SUPABASE_STORAGE_RENDER_SEGMENT,
  )
  optimized.search = ''
  const version = url.searchParams.get('v')
  if (version) optimized.searchParams.set('v', version)
  optimized.searchParams.set('width', String(getFastImageWidth(url)))
  optimized.searchParams.set('quality', String(FAST_IMAGE_QUALITY))
  optimized.searchParams.set('resize', 'contain')
  return optimized.href
}

function getFastUnsplashImageSrc(url) {
  if (url.hostname !== 'images.unsplash.com') return ''

  const optimized = new URL(url.href)
  const currentWidth = Number(optimized.searchParams.get('w'))
  if (!Number.isFinite(currentWidth) || currentWidth > FAST_IMAGE_WIDTH) {
    optimized.searchParams.set('w', String(FAST_IMAGE_WIDTH))
  }
  optimized.searchParams.set('auto', 'format')
  optimized.searchParams.set('q', String(FAST_IMAGE_QUALITY))
  if (!optimized.searchParams.has('fit')) optimized.searchParams.set('fit', 'crop')

  return optimized.href === url.href ? '' : optimized.href
}

function getFastImageSrc(rawSrc) {
  if (!rawSrc) return ''

  try {
    const url = new URL(rawSrc, window.location.href)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return getFastSupabaseImageSrc(url) || getFastUnsplashImageSrc(url)
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

  const prepareFastImage = img => {
    if (!(img instanceof HTMLImageElement)) return
    if (!img.hasAttribute('decoding')) img.decoding = 'async'
    if (img.dataset.latidoImgFallback === '1') return

    const rawSrc = img.getAttribute('src') || img.currentSrc || img.src || ''
    const optimizedSrc = getFastImageSrc(rawSrc)
    if (!optimizedSrc) return

    if (!img.dataset.latidoImgOriginalSrc) img.dataset.latidoImgOriginalSrc = rawSrc
    img.dataset.latidoImgOptimizedSrc = optimizedSrc
    if (img.getAttribute('src') !== optimizedSrc) img.setAttribute('src', optimizedSrc)
  }

  const setImageLoaded = img => {
    if (!isPlaceholderCandidate(img)) {
      clearImageState(img)
      return
    }
    img.dataset.latidoImgState = 'loaded'
  }

  const fallbackToOriginalImage = img => {
    const originalSrc = img.dataset.latidoImgOriginalSrc
    if (!originalSrc || img.dataset.latidoImgFallback === '1') {
      setImageLoaded(img)
      return
    }

    img.dataset.latidoImgFallback = '1'
    img.dataset.latidoImgState = 'loading'
    img.setAttribute('src', originalSrc)
  }

  const syncImageState = img => {
    if (!(img instanceof HTMLImageElement)) return
    prepareFastImage(img)
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
      img.addEventListener('error', () => fallbackToOriginalImage(img))
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
function registerProductionServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

  const hadControllerAtBoot = Boolean(navigator.serviceWorker.controller)
  const reloadKey = 'latido-sw-update-reload-at'
  const updateCheckInterval = 5 * 60 * 1000
  let registration = null
  let lastUpdateCheckAt = 0
  let reloading = false

  function reloadForUpdate() {
    if (!hadControllerAtBoot || reloading) return

    const lastReloadAt = Number(sessionStorage.getItem(reloadKey) || 0)
    if (lastReloadAt && Date.now() - lastReloadAt < 15_000) return

    reloading = true
    sessionStorage.setItem(reloadKey, String(Date.now()))
    window.location.reload()
  }

  async function checkForUpdate(force = false) {
    if (!registration || document.visibilityState === 'hidden') return

    const now = Date.now()
    if (!force && now - lastUpdateCheckAt < updateCheckInterval) return
    lastUpdateCheckAt = now
    await registration.update().catch(() => {})
  }

  navigator.serviceWorker.addEventListener('controllerchange', reloadForUpdate)

  window.addEventListener('load', async () => {
    try {
      registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache:'none' })
      await checkForUpdate(true)
    } catch (error) {
      console.error(error)
    }
  }, { once:true })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate()
  })
  window.addEventListener('pageshow', () => { void checkForUpdate() })
}

registerProductionServiceWorker()
