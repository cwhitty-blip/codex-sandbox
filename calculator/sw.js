const CACHE='calculator-v4';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./app.css','./upgrade.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
async function injectUpgrade(resp){
  const type=resp.headers.get('content-type')||'';
  if(!type.includes('text/html')) return resp;
  const text=await resp.text();
  if(text.includes('upgrade.js')) return new Response(text,{status:resp.status,statusText:resp.statusText,headers:resp.headers});
  const changed=text.replace('</body>','<script src="./upgrade.js"></script></body>');
  return new Response(changed,{status:resp.status,statusText:resp.statusText,headers:resp.headers});
}
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith((async()=>{
    try{
      let resp=await fetch(e.request);
      const url=new URL(e.request.url);
      if(e.request.mode==='navigate'||url.pathname.endsWith('/calculator/')||url.pathname.endsWith('/calculator/index.html')) resp=await injectUpgrade(resp);
      const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return resp;
    }catch(err){
      let r=await caches.match(e.request)||await caches.match('./index.html');
      if(r&&(e.request.mode==='navigate')) r=await injectUpgrade(r.clone());
      return r;
    }
  })());
});