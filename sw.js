const CACHE="edgy-v70";
const ASSETS=["./","./index.html","./manifest.webmanifest","./icon.svg","./config.js?v=5","./auth.js?v=66","./avatar-editor.js?v=7","./players.js?v=66","./chess-pieces.js?v=18","./history.js?v=57","./base.css?v=29","./app.js?v=69","./edgy-levels.js?v=66","./edgy-platform.js?v=69","./edgy-game-ui.js?v=69","./edgy-game-layout.css?v=47","./barricade.css?v=47","./wordle.css?v=53","./edgy-levels.css?v=53","./wordle-data.js?v=58","./wordle-rules.js?v=48","./wordle-game.js?v=58","./edgy-seen-words.js?v=58","./contexto-data.js?v=58","./contexto-rules.js?v=55","./contexto-game.js?v=54","./contexto.css?v=54","./chess-online.js?v=41","./checkers-rules.js?v=37","./checkers-replay.js?v=33","./checkers-online.js?v=40","./tic-online.js?v=40","./barricade-online.js?v=47","./party-online.js?v=59","./poker-online.js?v=61","./poker.css?v=61","./head-soccer.css?v=70","./twenty48.css?v=67","./casino.css?v=67","./casino-tables.css?v=65","./head-soccer-physics.js?v=70","./head-soccer-game.js?v=70","./twenty48-rules.js?v=67","./twenty48-game.js?v=67","./casino-game.js?v=68","./casino-tables.js?v=65","./party.css?v=58","./barricade-rules.js?v=1","./social.js?v=66","./edgy-theme.css?v=34"];
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