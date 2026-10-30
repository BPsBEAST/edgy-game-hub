const CACHE="edgy-v40";
const ASSETS=["./","./index.html","./manifest.webmanifest","./icon.svg","./config.js?v=5","./auth.js?v=18","./avatar-editor.js?v=7","./players.js?v=33","./chess-pieces.js?v=18","./history.js?v=39","./base.css?v=29","./app.js?v=39","./edgy-platform.js?v=32","./edgy-game-ui.js?v=39","./edgy-game-layout.css?v=39","./chess-online.js?v=39","./checkers-rules.js?v=37","./checkers-replay.js?v=33","./checkers-online.js?v=40","./tic-online.js?v=40","./social.js?v=30","./edgy-theme.css?v=34"];
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