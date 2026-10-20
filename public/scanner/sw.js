// Retirement worker for previously installed Latido Scanner shortcuts.
// Keep this URL available so old installations can update and unregister.
self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()))
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names.filter((name) => name.startsWith('lc-scanner-')).map((name) => caches.delete(name))
      )
      const clients = await self.clients.matchAll({ type: 'window' })
      await self.registration.unregister()
      await Promise.all(
        clients
          .filter((client) => new URL(client.url).pathname.startsWith('/scanner/'))
          .map((client) => client.navigate('/card'))
      )
    })()
  )
)
