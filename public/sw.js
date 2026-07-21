const BUILD_ID = '__LATIDO_BUILD_ID__'
const SHELL_CACHE = `latido-shell-${BUILD_ID}`
const ASSET_CACHE = `latido-assets-${BUILD_ID}`
const IMAGE_CACHE = 'latido-images-v2'
const PUBLIC_DATA_CACHE = 'latido-public-data-v1'
const CURRENT_CACHES = new Set([SHELL_CACHE, ASSET_CACHE, IMAGE_CACHE, PUBLIC_DATA_CACHE])
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/favicon.svg', '/icon-192.png']
const PRECACHE_ASSETS = []
const MAX_IMAGE_CACHE_ENTRIES = 260
const SUPABASE_STORAGE_OBJECT_SEGMENT = '/storage/v1/object/public/'
const SUPABASE_STORAGE_RENDER_SEGMENT = '/storage/v1/render/image/public/'
const RASTER_IMAGE_EXTENSIONS = new Set(['avif', 'jpeg', 'jpg', 'png', 'webp'])
const DEFAULT_OPTIMIZED_IMAGE_WIDTH = 960
const DEFAULT_OPTIMIZED_IMAGE_QUALITY = 72
const PUBLIC_TABLES = new Set([
  'business_promotion_plans',
  'communities',
  'events',
  'jobs',
  'listing_reviews',
  'listings',
  'provider_photos',
  'providers',
  'reviews',
])

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  const excess = keys.length - maxEntries
  if (excess <= 0) return
  await Promise.all(keys.slice(0, excess).map(key => cache.delete(key)))
}

async function putInCache(cacheName, request, response, maxEntries) {
  if (!response || (!response.ok && response.type !== 'opaque')) return

  try {
    const cache = await caches.open(cacheName)
    await cache.put(request, response)
    if (maxEntries) await trimCache(cacheName, maxEntries)
  } catch {}
}

function isSupabaseHost(url) {
  return url.hostname === 'supabase.co' || url.hostname.endsWith('.supabase.co')
}

function isPublicSupabaseRequest(url) {
  if (!isSupabaseHost(url)) return false

  const match = url.pathname.match(/\/rest\/v1\/([^/]+)$/)
  const table = match?.[1]
  if (!table || !PUBLIC_TABLES.has(table)) return false
  if (url.searchParams.has('user_id')) return false

  if (table === 'listings') {
    return url.searchParams.toString().includes('privacy')
  }

  return true
}

function isPublicStorageAsset(url) {
  return isSupabaseHost(url) && (
    url.pathname.includes(SUPABASE_STORAGE_OBJECT_SEGMENT) ||
    url.pathname.includes(SUPABASE_STORAGE_RENDER_SEGMENT)
  )
}

function isHttpRequest(url) {
  return url.protocol === 'http:' || url.protocol === 'https:'
}

function hasRasterImageExtension(url) {
  const filename = url.pathname.split('/').pop() || ''
  const extension = filename.split('.').pop()?.toLowerCase() || ''
  return RASTER_IMAGE_EXTENSIONS.has(extension)
}

function isImageRequest(request, url) {
  if (request.destination === 'image') return true
  if (request.headers.get('accept')?.toLowerCase().includes('image/')) return true
  return isPublicStorageAsset(url) || hasRasterImageExtension(url)
}

function optimizedUnsplashUrl(url) {
  if (url.hostname !== 'images.unsplash.com') return null

  const optimized = new URL(url.href)
  const currentWidth = Number(optimized.searchParams.get('w'))
  if (!Number.isFinite(currentWidth) || currentWidth > DEFAULT_OPTIMIZED_IMAGE_WIDTH) {
    optimized.searchParams.set('w', String(DEFAULT_OPTIMIZED_IMAGE_WIDTH))
  }
  optimized.searchParams.set('auto', 'format')
  optimized.searchParams.set('q', String(DEFAULT_OPTIMIZED_IMAGE_QUALITY))
  if (!optimized.searchParams.has('fit')) optimized.searchParams.set('fit', 'crop')
  return optimized
}

function getOptimizedImageRequest(request, url) {
  const optimizedUrl = optimizedUnsplashUrl(url)
  if (!optimizedUrl || optimizedUrl.href === request.url) return request

  return new Request(optimizedUrl.href, {
    cache: 'default',
    credentials: request.credentials,
    headers: request.headers,
    integrity: request.integrity,
    mode: request.mode,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
  })
}

function networkFirst(request, cacheName, event, maxEntries) {
  const network = fetch(request).then(response => {
    if (response.status >= 500) throw new Error(`HTTP ${response.status}`)
    return response
  })

  event.waitUntil(network
    .then(response => response.ok
      ? putInCache(cacheName, request, response.clone(), maxEntries)
      : undefined)
    .catch(() => {}))

  return network.catch(async error => {
    const cached = await caches.match(request, { cacheName })
    if (cached) return cached
    throw error
  })
}

async function cacheFirst(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  await putInCache(cacheName, request, response.clone(), maxEntries)
  return response
}

function staleWhileRevalidate(request, cacheName, event, maxEntries) {
  const update = fetch(request)
    .then(async response => {
      if (response.ok || response.type === 'opaque') {
        await putInCache(cacheName, request, response.clone(), maxEntries)
      }
      return response
    })

  event.waitUntil(update.catch(() => {}))

  return caches.open(cacheName)
    .then(cache => cache.match(request))
    .then(cached => cached || update)
}

async function refreshImageCache(cacheKey, fetchRequest = cacheKey) {
  let response
  try {
    response = await fetch(fetchRequest)
  } catch (error) {
    if (fetchRequest === cacheKey) throw error
    response = await fetch(cacheKey)
  }

  if (response.ok || response.type === 'opaque') {
    await putInCache(IMAGE_CACHE, cacheKey, response.clone(), MAX_IMAGE_CACHE_ENTRIES)
  }
  return response
}

async function imageCacheFirst(request) {
  const url = new URL(request.url)
  const fetchRequest = getOptimizedImageRequest(request, url)
  const cache = await caches.open(IMAGE_CACHE)
  const cached = await cache.match(request, { ignoreVary:true })

  if (cached && request.cache !== 'reload') return cached

  try {
    return await refreshImageCache(request, fetchRequest)
  } catch (error) {
    if (cached) return cached
    throw error
  }
}

function handleNavigation(event) {
  const url = new URL(event.request.url)
  const cacheKey = new Request(`${url.origin}${url.pathname}`)
  const network = (async () => {
    // Navigation preload keeps startup fast. The explicit no-store fallback
    // prevents stale HTML when preload is unavailable (notably on older iOS).
    const preload = await event.preloadResponse
    const response = preload || await fetch(new Request(event.request, { cache:'no-store' }))
    if (response.status >= 500) throw new Error(`HTTP ${response.status}`)
    return response
  })()

  event.waitUntil(network
    .then(response => response.ok
      ? putInCache(SHELL_CACHE, cacheKey, response.clone(), 40)
      : undefined)
    .catch(() => {}))

  return network.catch(async () => {
    const cache = await caches.open(SHELL_CACHE)
    return (
      await cache.match(cacheKey) ||
      await cache.match('/index.html') ||
      await cache.match('/')
    )
  })
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    await Promise.all([
      caches.open(SHELL_CACHE).then(cache => cache.addAll(APP_SHELL)),
      caches.open(ASSET_CACHE).then(cache => cache.addAll(PRECACHE_ASSETS)),
      caches.open(IMAGE_CACHE),
    ])
    await trimCache(ASSET_CACHE, 180)
    await trimCache(IMAGE_CACHE, MAX_IMAGE_CACHE_ENTRIES)
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    const deletions = []
    for (const key of keys) {
      if (key.startsWith('latido-') && !CURRENT_CACHES.has(key)) deletions.push(caches.delete(key))
    }
    await Promise.all(deletions)

    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable()
    }

    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return

  if (request.headers.has('range') || request.destination === 'video' || request.destination === 'audio') {
    return
  }

  const url = new URL(request.url)
  if (!isHttpRequest(url)) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event))
    return
  }

  if (isPublicSupabaseRequest(url)) {
    event.respondWith(networkFirst(request, PUBLIC_DATA_CACHE, event, 80))
    return
  }

  if (isImageRequest(request, url) && (isPublicStorageAsset(url) || url.origin !== self.location.origin)) {
    event.respondWith(imageCacheFirst(request))
    return
  }

  if (url.origin === self.location.origin && isImageRequest(request, url)) {
    event.respondWith(imageCacheFirst(request))
    return
  }

  if (url.origin !== self.location.origin) return

  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'font') {
    event.respondWith(cacheFirst(request, ASSET_CACHE, 180))
    return
  }

  if (url.pathname === '/manifest.json') {
    event.respondWith(networkFirst(request, SHELL_CACHE, event, 40))
  }
})

self.addEventListener('push', e => {
  let payload = {}
  try {
    payload = e.data ? e.data.json() : {}
  } catch {
    payload = { body: e.data?.text() || '' }
  }

  const title = payload.title || 'Latido'
  const options = {
    body: payload.body || 'Tienes una nueva notificacion.',
    icon: payload.icon || '/icon-192.png',
    tag: payload.tag || 'latido-notification',
    renotify: true,
    silent: false,
    timestamp: Date.now(),
    data: {
      url: payload.url || '/',
      ...(payload.data || {}),
    },
  }

  e.waitUntil((async () => {
    if ('setAppBadge' in self.registration) {
      await self.registration.setAppBadge(1).catch(() => {})
    }
    await self.registration.showNotification(title, options)
  })())
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const targetUrl = new URL(e.notification.data?.url || '/', self.location.origin).href

  e.waitUntil((async () => {
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true })

    for (const client of windowClients) {
      if (!client.url.startsWith(self.location.origin)) continue
      await client.focus()
      if ('navigate' in client) return client.navigate(targetUrl)
      return
    }

    if (clients.openWindow) return clients.openWindow(targetUrl)
  })())
})
