const CACHE = 'latido-v5'
const STATIC = ['/', '/index.html', '/manifest.json']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)))
  self.skipWaiting()
})
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))))
  self.clients.claim()
})
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  if (e.request.url.includes('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)))
    return
  }
  e.respondWith(fetch(e.request).then(res => {
    const clone = res.clone()
    caches.open(CACHE).then(c => c.put(e.request, clone))
    return res
  }).catch(() => caches.match(e.request)))
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
