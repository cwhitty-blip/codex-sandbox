// Recovery worker for Calculator v41 installs.  It removes the cache-first
// worker that trapped clients on stale HTML, then relinquishes control.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const names=await caches.keys();
 await Promise.all(names.filter(name=>name.startsWith('calculator-v41')).map(name=>caches.delete(name)));
 await self.clients.claim();
 await self.registration.unregister();
})()));
self.addEventListener('fetch',event=>{
 if(event.request.method==='GET'&&new URL(event.request.url).origin===self.location.origin)event.respondWith(fetch(event.request));
});
