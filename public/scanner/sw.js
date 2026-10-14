// Separate namespace: the main Latido service worker may delete latido-* caches.
const CACHE='lc-scanner-shell-v1'
const SHELL='/scanner/index.html'
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.add(SHELL)).then(()=>self.skipWaiting()))})
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())})
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return
  const url=new URL(event.request.url)
  // Never cache authorization, membership data or RPC responses.
  if(url.origin!==self.location.origin)return
  if(event.request.mode==='navigate'&&url.pathname.startsWith('/scanner/')){
    event.respondWith(fetch(event.request,{cache:'no-store'}).catch(async()=>{
      const shell=await caches.match(SHELL)
      return shell||new Response('Sin conexión. Vuelve a intentarlo cuando tengas internet.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}})
    }))
  }
})
