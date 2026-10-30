const CACHE="edgy-v14";
const ASSETS=["./","./index.html","./manifest.webmanifest","./icon.svg","./config.js?v=5","./auth.js?v=14","./avatar-editor.js?v=7","./players.js?v=14","./chess-online.js?v=14"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
 self.skipWaiting();
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));
 self.clients.claim();
});
self.addEventListener("fetch",event=>{
 const req=event.request;
 if(req.method!=="GET"||new URL(req.url).origin!==self.location.origin)return;
 event.respondWith(
  fetch(req).then(response=>{
   if(response.ok){
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});
   }
   return response;
  }).catch(async()=>{
   const cached=await caches.match(req);
   if(cached)return cached;
   if(req.mode==="navigate")return (await caches.match("./index.html"))||Response.error();
   return Response.error();
  })
 );
});