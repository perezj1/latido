const CACHE='suizamente-game-__BUILD_ID__'
const FILES=/*PRECACHE*/[]
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())))
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name!==CACHE)await caches.delete(name);await self.clients.claim()})()))
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url)
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth')||url.pathname==='/cuenta')return
 if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/index.html')));return}
 const staticAsset=/^\/assets\/[^/]+\.(?:js|css|woff2?)$/.test(url.pathname)||/^\/suizamente-assets\/(?:mapa3d\.json|mapa-cantones\.svg)$/.test(url.pathname)
 if(FILES.includes(url.pathname)||staticAsset)event.respondWith((async()=>{const cache=await caches.open(CACHE),saved=await cache.match(event.request);if(saved)return saved;const response=await fetch(event.request);if(response.ok)event.waitUntil(cache.put(event.request,response.clone()));return response})())
})
self.addEventListener('push',event=>{let data;try{data=event.data.json()}catch{return}const target=new URL(data.url||'/suizamente',self.location.origin);if(target.pathname.startsWith('/suizamente'))target.host=self.location.host;event.waitUntil(self.registration.showNotification(data.title||'Suizamente',{body:data.body||'',icon:'/suizamente-assets/icon-192.png',badge:'/suizamente-assets/icon-192.png',tag:data.tag,data:{url:target.href}}))})
self.addEventListener('notificationclick',event=>{event.notification.close();const target=event.notification.data?.url||'/suizamente';event.waitUntil(self.clients.matchAll({type:'window'}).then(async clients=>{for(const client of clients)if(new URL(client.url).origin===self.location.origin){await client.navigate(target);return client.focus()}return self.clients.openWindow(target)}))})
