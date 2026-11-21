// Only a public offline notice, installation metadata and icons are cached.
// Auth, account pages, Supabase, votes and player data always use the network.
const CACHE = 'suizamente-public-__BUILD_ID__'
const PUBLIC_FILES = [
  '/sin-conexion.html', '/manifest.webmanifest', '/favicon.svg',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png',
  '/icons/maskable-192.png', '/icons/maskable-512.png',
  '/icons/maskable-72.png', '/icons/maskable-96.png', '/icons/maskable-128.png',
  '/icons/favicon-circle-72.png', '/icons/favicon-circle-96.png',
]
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PUBLIC_FILES)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const previous=await caches.keys()
    const updated=previous.some(key=>key.startsWith('suizamente-public-')&&key!==CACHE)
    for (const key of previous) if (key.startsWith('suizamente-public-') && key !== CACHE) await caches.delete(key)
    await self.clients.claim()
    if(updated){
      const safePages=new Set(['/','/ranking','/retos','/perfil','/libreta','/amigos','/avisos','/medallas','/bienvenida','/como-se-juega','/instalar'])
      for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){
        const url=new URL(client.url)
        if(url.origin===self.location.origin&&safePages.has(url.pathname))await client.navigate(client.url).catch(()=>{})
      }
    }
  })())
})
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match('/sin-conexion.html')) || Response.error()))
    return
  }
  if (!url.search && PUBLIC_FILES.includes(url.pathname)) {
    event.respondWith((async () => (await caches.match(request)) || fetch(request))())
  }
})
