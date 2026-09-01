// Recovery worker for legacy /calculator installs. It removes v39's
// cache-first shell so the next navigation reaches the canonical v42 page.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const names=await caches.keys();
 await Promise.all(names.filter(name=>name.startsWith('calculator-')).map(name=>caches.delete(name)));
 await self.clients.claim();
 await self.registration.unregister();
})()));
self.addEventListener('fetch',event=>{
 if(event.request.method==='GET'&&new URL(event.request.url).origin===self.location.origin)event.respondWith(fetch(event.request));
});
