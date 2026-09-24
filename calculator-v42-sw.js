const CACHE='calculator-v42-offline-20260924-9';
const HOME='./calculator-v42.html';
const CORE=[
  HOME,'./calculator-v42.webmanifest','./calculator/icon-v36.svg',
  './calculator/app.css','./calculator/upgrades.css','./calculator/phone-polish.css','./calculator/reorder.css','./calculator/front-v27.css','./calculator/builtins-v30.css','./calculator/camera-v33.css','./calculator/photos-v38.css','./calculator/settings-v34.css','./calculator/pro-apps-v36.css','./calculator/bible-v44.css','./calculator/bible-polish-v45.css','./calculator/account-v37.css','./calculator/polish-v38.css','./calculator/second-space-v39.css','./calculator/phone-call-v45.css','./calculator/phone-call-v46.css','./calculator/visual-refresh-v49.css','./calculator/app-polish-v51.css','./calculator/icon-polish-v52.css',
  './calculator/app-mode.js','./calculator/code-5963.js','./calculator/project-hardlinks-v34.js','./calculator/core-v28.js','./calculator/second-space-v39.js','./calculator/photos-v38.js','./calculator/pro-notes-v36.js','./calculator/bible-v44.js','./calculator/pro-apps-v36b.js','./calculator/builtins-v30.js','./calculator/personalize.js','./calculator/project-links.js','./calculator/settings-v34.js','./calculator/account-v37.js','./calculator/account-optional-v37.js','./calculator/clock-pro.js','./calculator/share-reorder.js','./calculator/home-gesture.js','./calculator/communications-loader.js','./calculator/privacy-v36.js','./calculator/android-native-bridge.js',
  './calculator/wallpapers/mountains-photo-v50.jpg','./calculator/wallpapers/ocean-photo-v50.jpg','./calculator/wallpapers/forest-photo-v50.jpg','./calculator/wallpapers/night-photo-v50.jpg','./calculator/wallpapers/sunset-photo-v50.jpg','./calculator/wallpapers/wildflowers-photo-v51.jpg','./calculator/wallpapers/city-night-photo-v51.jpg'
];

self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.allSettled(CORE.map(async path=>{
    const response=await fetch(path,{cache:'reload'});
    if(response.ok)await cache.put(path,response);
  }));
  await self.skipWaiting();
})()));

self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('calculator-')&&name!==CACHE).map(name=>caches.delete(name)));
  await self.clients.claim();
})()));

async function newestOrSaved(request){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request);
    if(response.ok)await cache.put(request,response.clone());
    return response;
  }catch{
    return (await cache.match(request,{ignoreSearch:true})) || (request.mode==='navigate' ? cache.match(HOME) : Response.error());
  }
}

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  event.respondWith(newestOrSaved(event.request));
});
