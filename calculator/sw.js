const CACHE='calculator-v8';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./app.css','./app.js','./personalize.js','./project-links.js'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request,{cache:'no-store'});
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      return response;
    }catch{
      return await caches.match(event.request)||await caches.match('./index.html');
    }
  })());
});