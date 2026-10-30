/* No dependencies. Run: node --test tests/smoke.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=file=>fs.readFileSync(path.join(dir,file),"utf8");
const html=read("index.html");
const app=read("app.js");
const gameFiles=["app.js","edgy-platform.js","edgy-game-ui.js","players.js","social.js","history.js","chess-online.js","checkers-replay.js","checkers-online.js","tic-online.js","barricade-online.js","auth.js","sw.js"];
test("All app scripts and inline bootstrap parse successfully",()=>{
 for(const file of gameFiles)assert.doesNotThrow(()=>new vm.Script(read(file),{filename:file}),file);
 const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
 for(const script of scripts.filter(m=>!m[1].includes("src=")))assert.doesNotThrow(()=>new vm.Script(script[2]),"inline JS");
});
test("Every local asset referenced by the bootstrap exists",()=>{
 const files=[...html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="(\.\/[^"]+)"/g)].map(m=>m[1]);
 for(const source of files)assert.ok(fs.existsSync(path.join(dir,source.split("?")[0])),source);
 const assets=read("sw.js").match(/const ASSETS=\[([^\]]+)\]/)?.[1];
 assert.ok(assets);
 const names=[...assets.matchAll(/"([^"]+)"/g)].map(m=>m[1]);
 for(const name of names)assert.ok(fs.existsSync(path.join(dir,name.split("?")[0])),name);
 assert.ok(names.includes("./edgy-platform.js?v=43"),"shared platform cached");
 assert.ok(names.includes("./app.js?v=44"),"bootstrap cached");
 assert.ok(names.includes("./base.css?v=29"),"base stylesheet cached");
 assert.ok(names.includes("./edgy-theme.css?v=34"),"design cached");
 assert.ok(names.includes("./tic-online.js?v=40"),"online tic cached");
 assert.ok(names.includes("./checkers-replay.js?v=33"),"checkers replay cached");
});
test("Navigation keeps Histórico only inside Perfil",()=>{
 const sidebar=html.split('<aside class="sidebar">')[1].split("</aside>")[0];
 const mobile=html.split('<nav class="nav"')[1].split("</nav>")[0];
 assert.ok(!sidebar.includes('data-page="history"'));
 assert.ok(!mobile.includes('data-page="history"'));
 assert.ok(app.includes('id="profileHistory"'));
 assert.deepEqual([...mobile.matchAll(/data-page="([^"]+)"/g)].map(m=>m[1]),["games","players","home","rooms","profile"]);
 assert.ok(mobile.includes('class="navHomeGlyph"'));
});
test("Retired Memory and Quiz are no longer part of loaded bootstrap",()=>{
 assert.ok(!app.includes('id:"memory"')&&!app.includes('id:"quiz"'));
 assert.ok(!app.includes('function drawMemory()')&&!app.includes('function drawQuiz()'));
});
function platformFixture(){
 const calls=[],api={rpc(name,args){calls.push({name,args});return Promise.resolve({data:"OK",error:null})},from(table){calls.push({table});return {select(){return this},eq(){return this},maybeSingle(){return Promise.resolve({data:{id:1},error:null})}}}};
 const document={body:{append(){}},activeElement:null,addEventListener(){},createElement(){throw Error("DOM not set up")}};
 const window={EDGY_auth:{getClient(){return api}}};
 vm.runInNewContext(read("edgy-platform.js"),{window,document,console});
 return {platform:window.EDGY_platform,api,calls,window,document};
}
test("Single registry serves all online games and rejects invalid codes",async()=>{
 const {platform,calls}=platformFixture();
 assert.deepEqual(Object.keys(platform.games).sort(),["barricade","checkers","chess","reaction","tic"]);
 assert.equal(platform.code(" aB41cD23 "),"AB41CD23");
 assert.throws(()=>platform.code("oops"),/8 caracteres/);
 assert.throws(()=>platform.rooms.create("reaction"),/não suporta/);
 await platform.rooms.create("chess",{base:600,increment:0});
 await platform.rooms.create("checkers");
 await platform.rooms.create("tic");
 await platform.rooms.create("barricade");
 await platform.rooms.join("chess","aB41cD23");
 await platform.rooms.join("checkers","aB41cD23");
 await platform.rooms.join("tic","aB41cD23");
 await platform.rooms.join("barricade","aB41cD23");
 await platform.rooms.cancel("chess","aB41cD23");
 await platform.rooms.cancel("barricade","aB41cD23");
 await platform.rooms.invite("checkers","aB41cD23","some-user-id");
 await platform.rooms.invite("tic","aB41cD23","some-user-id");
 await platform.rooms.invite("barricade","aB41cD23","some-user-id");
 await platform.rooms.respond("some-invite",true);
 await platform.rooms.list(200);
 assert.deepEqual(calls.map(c=>c.name),["edgy_create_chess_room_timed","edgy_checkers_create","edgy_tic_create","edgy_barricade_create","edgy_join_chess_room","edgy_checkers_join","edgy_tic_join","edgy_barricade_join","edgy_cancel_waiting_chess_room","edgy_barricade_cancel","edgy_invite_send","edgy_invite_send","edgy_invite_send","edgy_invite_respond","edgy_my_rooms"]);
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args)),{p_base:600,p_increment:0});
 assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1).args)),{p_limit:100});
});
test("Barricade 9x9 move, walls, blocked paths and jumping are server-shared",()=>{
 const client=read("barricade-rules.js"),server=read("supabase/functions/barricade-action/rules.js");
 assert.equal(client,server,"client and server must enforce the same rules");
 const ctx={};vm.runInNewContext(client.replace(/\bexport\s+/g,"")+";globalThis.br={initialState,legalMoves,canPlaceWall,applyAction,blocked,hasPath};",ctx);
 const br=ctx.br,initial=br.initialState();
 assert.equal(initial.red_pos,76);assert.equal(initial.blue_pos,4);
 assert.equal(initial.red_walls,10);assert.equal(initial.blue_walls,10);
 assert.ok(br.legalMoves(initial).includes(67),"red advances toward its goal");
 assert.throws(()=>br.applyAction(initial,{type:"move",to:0}),/ilegal/);
 const after=br.applyAction(initial,{type:"wall",r:6,c:3,o:"h"});
 assert.equal(after.red_walls,9);
 assert.equal(after.walls.length,1);
 assert.ok(!br.canPlaceWall(after,{r:6,c:3,o:"v"}),"wall crossing is illegal");
 assert.ok(!br.canPlaceWall(after,{r:6,c:4,o:"h"}),"wall overlap is illegal");
 assert.ok(br.canPlaceWall(after,{r:3,c:3,o:"h"}),"separated walls remain legal");
 const jump={...initial,red_pos:40,blue_pos:31,turn:"r"};
 assert.ok(br.legalMoves(jump).includes(22),"a pawn may jump over an adjacent rival");
 const blockedJump={...jump,walls:[{r:2,c:4,o:"h"}]};
 assert.ok(br.legalMoves(blockedJump).includes(30)||br.legalMoves(blockedJump).includes(32),"blocked straight jump opens side steps");
 const trapped={...initial,walls:[{r:7,c:3,o:"h"},{r:7,c:5,o:"h"},{r:6,c:4,o:"v"}]};
 assert.equal(typeof br.hasPath(trapped.walls,trapped.red_pos,0),"boolean");
});
test("Barricade uses private 2-player rooms, invitations, shared UI and history",()=>{
 const platform=read("edgy-platform.js"),app=read("app.js"),social=read("social.js");
 const client=read("barricade-online.js"),layout=read("barricade.css"),history=read("history.js"),html=read("index.html"),sw=read("sw.js");
 assert.ok(platform.includes('barricade:Object.freeze('));
 assert.ok(app.includes('window.EDGY_barricade?.open('));
 assert.ok(app.includes('window.EDGY_barricade?.close()'));
 assert.ok(client.includes('window.EDGY_gameUI.bindMobilePanel(')||client.includes('ui().bindMobilePanel('));
 assert.ok(client.includes('functions.invoke("barricade-action"'));
 assert.ok(client.includes('data-br-wall='));
 assert.ok(client.includes('data-br-step='));
 assert.ok(layout.includes('.brBoard{')&&layout.includes('.brWall-h'));
 assert.ok(history.includes('barricadeCloud='));
 assert.ok(history.includes('isBarricade'));
 assert.ok(social.includes('["edgy-barricade-rooms","barricade"]'));
 for(const file of ["barricade-online.js?v=43","barricade.css?v=43"])assert.ok(html.includes(file)&&sw.includes(file));
});
test("Common result dialog handles win, loss, draw and closing",()=>{
 const {platform,document}=platformFixture();
 let focused=null,appended=null;
 const nodes=new Map();
 document.createElement=()=>({
  hidden:true,attributes:{},dataset:{},
  innerHTML:"",className:"",
  setAttribute(k,v){this.attributes[k]=v},
  querySelector(sel){
   if(!nodes.has(sel))nodes.set(sel,{textContent:"",innerHTML:"",handlers:{},addEventListener(event,fn){this.handlers[event]=fn},focus(){focused=sel}});
   return nodes.get(sel);
  },
  addEventListener(){},
 });
 document.body.append=elem=>{appended=elem};
 const modal=platform.createResult({game:"chess"});
 assert.ok(appended);
 for(const [outcome,label] of [["win","Venceste!"],["loss","Perdeste!"],["draw","Empate!"]]){
  modal.show({outcome,reason:"Partida encerrada"});
  assert.equal(nodes.get("[data-title]").textContent,label);
  assert.equal(nodes.get("[data-reason]").textContent,"Partida encerrada");
  assert.equal(modal.element.dataset.result,outcome);
  assert.equal(modal.element.hidden,false);
  assert.equal(focused,"[data-primary]");
  modal.hide();assert.equal(modal.element.hidden,true);
 }
});
test("Damas retain forward-only capture, flying kings, initial board",()=>{
 const source=read("checkers-rules.js").replace(/\bexport\s+/g,"");
 const context={};vm.runInNewContext(source+";globalThis.testRules={initialState,legalMoves,applyMove};",context);
 const rules=context.testRules;
 const state=(pieces,turn="w")=>{
  const board=Array(64).fill(null);
  for(const [index,piece] of pieces)board[index]=piece;
  return {board,turn,ply:0,status:"active",history:[],last:[],quiet:0};
 };
 assert.equal(rules.legalMoves(rules.initialState()).length,7);
 const caps=s=>rules.legalMoves(s).some(m=>m.captures?.length>0);
 assert.ok(caps(state([[42,"w"],[33,"b"]])));
 assert.ok(!caps(state([[26,"w"],[35,"b"]])));
 assert.ok(caps(state([[17,"b"],[26,"w"]],"b")));
 assert.ok(!caps(state([[33,"b"],[24,"w"]],"b")));
 assert.ok(caps(state([[26,"W"],[35,"b"]])));
 assert.ok(caps(state([[44,"W"],[26,"b"]])));
 assert.ok(rules.legalMoves(state([[42,"w"],[33,"b"],[17,"b"]])).some(m=>m.captures?.length===2));
});
test("Damas allow a choice of capture while requiring the entire sequence on client and server",()=>{
 const client=read("checkers-rules.js"),server=read("supabase/functions/checkers-action/rules.js");
 assert.equal(client,server,"the online validator must enforce the same capture rules");
 const context={};vm.runInNewContext(client.replace(/\bexport\s+/g,"")+";globalThis.rules={legalMoves,applyMove};",context);
 const board=Array(64).fill(null);
 for(const [i,p] of [[42,"w"],[46,"w"],[33,"b"],[17,"b"],[37,"b"]])board[i]=p;
 const state={board,turn:"w",ply:0,status:"active",history:[],last:[],quiet:0};
 const captures=context.rules.legalMoves(state);
 assert.ok(captures.some(m=>m.path[0]===42&&m.captures.length===2));
 assert.ok(captures.some(m=>m.path[0]===46&&m.captures.length===1));
 assert.ok(captures.every(m=>m.captures.length>0),"quiet moves remain forbidden");
 const shorter=captures.find(m=>m.path[0]===46&&m.captures.length===1);
 const next=context.rules.applyMove(state,shorter.path);
 assert.equal(next.board[37],null);
 assert.equal(next.board[shorter.path.at(-1)],"w");
 assert.throws(()=>context.rules.applyMove(state,[42,24]),/captura incompleta/);
});

test("Unified visual rules include accessible motion reduction",()=>{
 const css=read("edgy-theme.css");
 for(const token of ["--edgy-surface","--edgy-stroke","--edgy-accent",".edgyOutcomeDialog",".edgyOutcomeOverlay",".edgyLobby",".nav button.navHome .navHomeGlyph","prefers-reduced-motion:reduce"])assert.ok(css.includes(token),token);
 const chess=read("chess-online.js"),checkers=read("checkers-online.js");
 for(const code of [chess,checkers]){
  assert.ok(code.includes("window.EDGY_platform.createResult("));
  assert.ok(code.includes("window.EDGY_platform.rooms.create("));
  assert.ok(code.includes('classList.toggle("edgyLobby",!room)'));
 }
});
test("Chess engine and Damas rules load only when the game is opened",()=>{
 const chess=read("chess-online.js"),checkers=read("checkers-online.js");
 assert.match(chess,/function loadEngine\(\)/);
 assert.match(checkers,/function loadRules\(\)/);
 assert.match(chess,/autoTried=false;loadEngine\(\);draw\(\)/);
 assert.match(checkers,/joined=false;loadRules\(\);draw\(\)/);
});

test("Tic joins existing UI multiplayer and shared challenge registry",()=>{
 const platform=read("edgy-platform.js");
 const app=read("app.js"),social=read("social.js"),players=read("players.js");
 const online=read("tic-online.js"),history=read("history.js");
 assert.ok(platform.includes('tic:Object.freeze({id:"tic"')&&platform.includes('online:true,create:"edgy_tic_create"'));
 assert.ok(app.includes('window.EDGY_ticOnline?.open('));
 assert.ok(app.includes('window.EDGY_ticLocal='));
 assert.ok(social.includes('Object.values(window.EDGY_platform.games).filter(g=>g.online)'));
 assert.ok(players.includes("edgy_head_to_head_all"));
 assert.ok(history.includes("renderTicReplay()"));
 assert.ok(online.includes('p_expected_ply:room.ply'));
 assert.ok(online.includes('window.EDGY_ticOnline={open,close,render,refresh}'));
 assert.ok(online.includes("data-resign")&&online.includes("data-invite"));
});
test("Live invitation channel refreshes recipient inbox without reloading",()=>{
 const social=read("social.js");
 assert.ok(social.includes('function syncInviteChannel()'));
 assert.ok(social.includes('table:"edgy_game_invites",filter:"recipient_id=eq."+uid'));
 assert.ok(social.includes('.on("postgres_changes"'));
 assert.ok(social.includes('if(status==="SUBSCRIBED")refreshInvites()'));
 assert.ok(social.includes('document.addEventListener("visibilitychange"'));
 assert.ok(social.includes('},6000)'));
 assert.ok(social.includes('if(modalMode==="inbox")inboxDraw()'));
});
test("Chess refreshes automatically and hides the redundant refresh button",()=>{
 const chess=read("chess-online.js"),css=read("edgy-game-layout.css");
 assert.ok(!chess.includes('data-refresh'),"there must be no manual refresh action");
 assert.ok(chess.includes('poller=setInterval('),"background synchronization remains active");
 assert.ok(css.includes('.main.chess-viewport #screen .chessSide.edgyMatchDrawer{'));
 assert.ok(!css.includes('#screen .edgyMatchSide.edgyMatchDrawer,'),
  "Centered styling must not affect Damas or Galo");
 assert.ok(css.includes('left:50%!important;right:auto!important;bottom:auto!important'));
});
test("Stable footer, profile replay links and chess mobile actions",()=>{
 const html=read("index.html"),css=read("edgy-theme.css");
 const chess=read("chess-online.js"),damas=read("checkers-online.js"),players=read("players.js");
 assert.ok(html.includes('<footer class="foot">EDGY · Feito para jogar, onde quiseres.</footer>'));
 assert.ok(css.includes(".main>.foot{")&&css.includes("margin: auto 0 0!important"));
 assert.ok(css.includes(".playerOverlay:not([hidden]) .playerDialog"));
 assert.ok(css.includes("playerReplayLink")&&players.includes("data-replay="));
 assert.ok(chess.includes('window.EDGY_gameUI.bindMobilePanel(root,'));
 assert.ok(chess.includes('optionSelector:".chessOptionPanel"'));
 assert.ok(chess.includes('historySelector:".chessHistoryPanel"'));
 assert.ok(css.includes("main.chess-viewport #screen .chessSide"));
 assert.ok(!damas.includes("data-refresh"));
 assert.ok(!damas.includes(">Atualizar</button>"));
});

test("Game library uses a single registry loaded before bootstrap",()=>{
 const scripts=[...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m=>m[1]);
 const platform=scripts.indexOf("./edgy-platform.js?v=43");
 const bootstrap=scripts.indexOf("./app.js?v=44");
 assert.ok(platform>=0&&bootstrap>=0&&platform<bootstrap);
 const app=read("app.js"),defs=read("edgy-platform.js");
 assert.ok(app.includes("Object.values(window.EDGY_platform.games).map("));
 assert.ok(app.includes("defs.length"));
 for(const game of ["chess","checkers","tic","reaction","barricade"])assert.ok(defs.includes(game+":Object.freeze("));
 assert.ok(app.includes('filter==="Multiplayer"?window.EDGY_platform.games[g.id].online'));
});

test("Damas keeps its full-width bottom drawer and Chess stays centered",()=>{
 const css=read("edgy-game-layout.css"),checkers=read("checkers-online.js");
 const base=css.indexOf('#screen[data-game-panel-open="options"] .edgyMatchSide.edgyMatchDrawer');
 const chess=css.indexOf('/* EDGY v42 — only Chess uses the centered dialog.');
 assert.ok(base>=0&&chess>base);
 const wide=css.slice(Math.max(0,base-125),chess);
 assert.ok(wide.includes('left:8px;right:8px;top:auto;bottom:calc(76px + env(safe-area-inset-bottom))'));
 assert.ok(wide.includes('width:auto!important;max-width:none!important'));
 assert.ok(!css.includes('#screen .edgyMatchSide.edgyMatchDrawer,'),
  "Do not apply the Chess-specific center transform to Damas.");
 assert.ok(css.includes('.main.chess-viewport #screen .chessSide.edgyMatchDrawer{'));
 assert.ok(checkers.includes('sideSelector:".ckSide"'));
});
test("Chess uses the same mobile options/history drawer as Damas, including promotion",()=>{
 const chess=read("chess-online.js"),ui=read("edgy-game-ui.js"),css=read("edgy-game-layout.css");
 assert.ok(chess.includes('window.EDGY_gameUI.bindMobilePanel(root,{'));
 assert.ok(chess.includes('optionSelector:".chessOptionPanel"'));
 assert.ok(chess.includes('historySelector:".chessHistoryPanel"'));
 assert.ok(chess.includes('window.EDGY_gameUI.openMobilePanel(document.getElementById("screen"),"options")'));
 assert.ok(chess.includes('window.EDGY_gameUI.openMobilePanel(document.getElementById("screen"),"history")'));
 assert.ok(!chess.includes('drawerSection')&&!chess.includes('drawerOpen'));
 assert.ok(ui.includes('function openMobilePanel('));
 assert.ok(ui.includes('function clearMobilePanel('));
 assert.ok(css.includes('.main.chess-viewport #screen .chessSide.edgyMatchDrawer{'));
 assert.ok(css.includes('top:calc((100dvh - 76px - env(safe-area-inset-bottom))/2)!important'));
 assert.ok(css.includes('transform:translate(-50%,-50%)!important'));
 assert.ok(css.includes('max-height:min(72dvh,calc(100dvh - 112px - env(safe-area-inset-bottom)))!important'));
});
test("Profile match replays stay accessible across chess and other online games",()=>{
 const players=read("players.js"),css=read("edgy-theme.css");
 assert.ok(players.includes('edgy_head_to_head_all'));
 assert.ok(players.includes('data-replay='));
 assert.ok(players.includes("Rever partida ↗"));
 assert.ok(players.includes('window.EDGY_history?.openByCode(code)'));
 assert.ok(players.includes('window.EDGY_checkersReplay?.open(code)'));
 assert.ok(!players.includes('window.EDGY_openRoom?.(kind,code)'));
 assert.ok(css.includes('.playerOverlay{z-index:175!important}'));
 assert.ok(css.includes('.edReplayMask{z-index:180!important}'));
 assert.ok(players.includes('isClosing')&&css.includes('@keyframes edgyProfileArrivalOut'));
});
test("Tic players use member-only lookup and online history avoids duplicate results",()=>{
 const app=read("tic-online.js"),platform=read("edgy-platform.js"),history=read("history.js");
 assert.ok(platform.includes('players(id,roomCode)'));
 assert.ok(app.includes('rooms.players("tic",room.code)'));
 assert.ok(history.includes('ticCloud.some(c=>c.id===h.client_id)'));
 assert.ok(history.includes('outcome==="win"?50:outcome==="draw"?20:10'));
 assert.ok(app.includes('refreshProfile?.()'));
});

test("Personal history includes Damas results and opens the existing read-only replay",()=>{
 const history=read("history.js"),replay=read("checkers-replay.js");
 assert.ok(history.includes('checkersCloud=[]'));
 assert.ok(history.includes('const ownRooms=query=>'));
 assert.ok(history.includes('api().from("checkers_rooms").select('));
 assert.ok(history.includes('cloud.concat(ticCloud,checkersCloud,barricadeCloud)'));
 assert.ok(history.includes('if(g.isCheckers){window.EDGY_checkersReplay?.open(g.code);return}'));
 assert.ok(history.includes('game:"Damas",isCheckers:true'));
 assert.ok(history.includes('checkers.error'));
 assert.ok(replay.includes('["white_win","black_win","draw"]'));
 assert.ok(!history.includes('game:"Damas",isChess:true'));
});
test("Damas replay is strictly read only and never resumes a completed room",()=>{
 const p=read("players.js"),c=read("checkers-online.js"),replay=read("checkers-replay.js");
 const html=read("index.html"),sw=read("sw.js");
 assert.ok(p.includes('window.EDGY_checkersReplay?.open(code)'));
 assert.ok(!p.includes('window.EDGY_openRoom?.(kind,code)'));
 assert.ok(c.includes('window.EDGY_checkersReplay?.open(room.code)'));
 assert.ok(replay.includes('from("checkers_rooms").select('));
 assert.ok(replay.includes('["white_win","black_win","draw"]'));
 assert.ok(replay.includes('function boardAt(n)')&&replay.includes('data-nav="next"'));
 assert.ok(!replay.includes('rooms.join(')&&!replay.includes('showResult()'));
 assert.ok(html.includes('checkers-replay.js?v=33')&&sw.includes('checkers-replay.js?v=33'));
});
test("Mobile chess scrolls its board and uses the compact shared drawer",()=>{
 const theme=read("edgy-theme.css"),layout=read("edgy-game-layout.css");
 assert.ok(theme.includes('.main.chess-viewport #screen{'));
 assert.ok(theme.includes('overflow-y:auto!important;overflow-x:hidden!important'));
 assert.ok(layout.includes('#screen .edgyMatchMobileTabs{'));
 assert.ok(layout.includes('.main.chess-viewport #screen .chessSide.edgyMatchDrawer{'));
 assert.ok(layout.includes('z-index:165!important'));
});
test("Public profile opens at the top and routes all three game replays",()=>{
 const src=read("players.js"),h=read("history.js");
 assert.ok(src.includes('modal.querySelector(".playerDialog").scrollTop=0'));
 assert.ok(src.includes('window.EDGY_history?.openByCode(code)'));
 assert.ok(src.includes('window.EDGY_history?.openByCode("tic",code)'));
 assert.ok(src.includes('window.EDGY_checkersReplay?.open(code)'));
 assert.ok(h.includes('async function openTicByCode(code)'));
});


test("Jogo do Galo uses the shared lobby renderer and rooms",()=>{
 const tic=read("tic-online.js"),social=read("social.js");
 assert.ok(tic.includes('window.EDGY_gameUI.header("tic"'));
 assert.ok(tic.includes('window.EDGY_gameUI.card("Criar partida online"'));
 assert.ok(tic.includes('window.EDGY_gameUI.card("Entrar numa sala"'));
 assert.ok(tic.includes('window.EDGY_gameUI.card("As tuas salas"'));
 assert.ok(tic.includes('id="edgy-tic-rooms"'));
 assert.ok(tic.includes('window.EDGY_social?.renderRooms?.("edgy-tic-rooms","tic")'));
 assert.ok(tic.includes('window.EDGY_ticLocal?.()'));
 assert.ok(social.includes('["edgy-tic-rooms","tic"]'));
});
test("Chess shares the match shell, drawer binder and move controls",()=>{
 const chess=read("chess-online.js"),css=read("edgy-game-layout.css");
 assert.ok(chess.includes('window.EDGY_gameUI.header("chess"'));
 assert.ok(chess.includes('window.EDGY_gameUI.match({game:"chess"'));
 assert.ok(chess.includes('window.EDGY_gameUI.bindMobilePanel(root,'));
 assert.ok(chess.includes('reviewControls()'));
 assert.ok(!chess.includes('chessMobileTools"><button'));
 assert.ok(css.includes('#screen .edgyMatchStage'));
 assert.ok(css.includes('#screen .edgyMatchSide'));
});
test("All games share one header, lobby cards and match presentation",()=>{
 const html=read("index.html"),ui=read("edgy-game-ui.js"),css=read("edgy-game-layout.css");
 assert.ok(html.includes('edgy-game-ui.js?v=43'));
 assert.ok(html.includes('edgy-game-layout.css?v=44'));
 for(const game of ["chess","checkers","tic","reaction","barricade"])assert.ok(ui.includes(game+':{title:'));
 for(const file of ["chess-online.js","checkers-online.js","tic-online.js","barricade-online.js","app.js"]){
  const src=read(file);
  assert.ok(src.includes('window.EDGY_gameUI.header(')||src.includes('ui().header('),file);
  assert.ok(src.includes('window.EDGY_gameUI.match(')||src.includes('ui().match('),file);
 }
 for(const file of ["chess-online.js","checkers-online.js","tic-online.js","barricade-online.js"]){
  const src=read(file);
  assert.ok(src.includes('window.EDGY_gameUI.card(')||src.includes('ui().card('),file);
 }
 assert.ok(css.includes('#screen .edgyGameHeaderRow'));
 assert.ok(css.includes('#screen .edgyGamePanel'));
 assert.ok(css.includes('#screen .edgyMatchLayout'));
});
test("Universal renderer escapes user text and keeps consistent structure",()=>{
 const code=read("edgy-game-ui.js"),ctx={window:{},document:{addEventListener(){}}};
 vm.runInNewContext(code,ctx);
 const ui=ctx.window.EDGY_gameUI;
 const header=ui.header("chess",{room:'<script>alert(1)</script>',intro:"Teste"});
 assert.ok(header.includes('class="edgyGameHeader"'));
 assert.ok(!header.includes("<script>"));
 assert.ok(header.includes('&lt;script&gt;'));
 const panel=ui.card('Criar partida','<button>OK</button>',{description:'Sala privada'});
 assert.ok(panel.includes('edgyGamePanel'));
 assert.ok(panel.includes('<button>OK</button>'));
 assert.ok(ui.match({game:"checkers",stage:"TABULEIRO",side:"OPÇÕES"}).includes('class="edgyMatchSide'));
});
test("Xadrez, Damas and Galo use one mobile options/history panel implementation",()=>{
 const ui=read("edgy-game-ui.js"),css=read("edgy-game-layout.css");
 for(const file of ["chess-online.js","checkers-online.js","tic-online.js","barricade-online.js"]){
  const src=read(file);
  assert.ok(src.includes('window.EDGY_gameUI.bindMobilePanel(')||src.includes('ui().bindMobilePanel('),file);
 }
 assert.ok(read("checkers-online.js").includes('clearMobilePanel("checkers")'));
 assert.ok(read("tic-online.js").includes('clearMobilePanel("tic")'));
 assert.ok(read("checkers-online.js").includes('document.visibilityState!=="hidden"'));
 assert.ok(ui.includes('function bindMobilePanel('));
 assert.ok(css.includes('#screen .edgyMatchSide.edgyMatchDrawer'));
 assert.ok(css.includes('[data-game-panel-open="history"]'));
});

test("Five-game mobile library centers the orphan card and keeps filter buttons visible",()=>{
 const css=read("edgy-game-layout.css"),app=read("app.js");
 assert.ok(css.includes('#screen .edgyGameCards>.game:last-child:nth-child(odd){'));
 assert.ok(css.includes('grid-column:1 / -1;'));
 assert.ok(css.includes('justify-self:center;'));
 assert.ok(css.includes('width:calc((100% - 11px)/2)!important'));
 assert.ok(css.includes('#screen .edgyGameCards>.game:only-child{'));
 assert.ok(css.includes('#screen.edgyLibraryPage .filters button{'));
 assert.ok(css.includes('padding-bottom:calc(105px + env(safe-area-inset-bottom))!important'));
 assert.ok(app.includes('function cards(items){return'));
});
test("Community shows highest-level players first, XP breaks ties, and shows relative ranks",()=>{
 const players=read("players.js"),index=read("index.html"),sw=read("sw.js");
 const start=players.indexOf("const ranked="),end=players.indexOf(" holder.innerHTML=ranked.length",start);
 assert.ok(start>=0&&end>start,"ranking is computed before rendering");
 const expression=players.slice(start+"const ranked=".length,end).trim();
 const names=vm.runInNewContext(
  '(()=>{const data=[{name:"Baixo",xp:40,username:"b"},{name:"EmpateB",xp:220,username:"b"},{name:"Alto",xp:315,username:"a"},{name:"EmpateA",xp:220,username:"a"}];const ranked='+expression+';return ranked.map(x=>x.name)})()'
 );
 assert.deepEqual(Array.from(names),["Alto","EmpateA","EmpateB","Baixo"]);
 assert.ok(players.includes('class="playerRank"'));
 assert.ok(players.includes('class="playerLevel"'));
 assert.ok(players.includes('Ordenados por nível (mais alto primeiro)'));
 assert.ok(index.includes("players.js?v=44")&&sw.includes("players.js?v=44"));
});
test("Home and Biblioteca render exactly the same reusable game cards",()=>{
 const css=read("edgy-game-layout.css"),app=read("app.js"),html=read("index.html");
 assert.ok(app.includes('function cards(items){return \'<div class="games edgyGameCards">\''));
 assert.ok(app.includes("'+cards(defs)"),"Home uses the common card renderer");
 assert.ok(app.includes("'+cards(shown)"),"Biblioteca uses the common card renderer");
 assert.ok(css.includes('#screen .edgyGameCards .game{'),"cards share one flex layout");
 assert.ok(css.includes('#screen .edgyGameCards .game .art{'),"artwork has a fixed area");
 assert.ok(css.includes('flex:0 0 160px!important'),"desktop artwork never shrinks for long descriptions");
 assert.ok(css.includes('flex-basis:84px!important'),"mobile artwork uses exactly the same geometry");
 assert.ok(css.includes('grid-auto-rows:1fr'),"all cards in the grid stretch equally");
 assert.ok(css.includes('.main:has(> #screen.edgyLibraryPage)>.foot'),"library footer clears the navigation");
 assert.ok(html.includes('edgy-game-layout.css?v=44'));
 assert.ok(html.includes('app.js?v=44'));
});
test("EDGY v36: chess title is short and empty join notice does not reserve space",()=>{
 const chess=read("chess-online.js"),ui=read("edgy-game-ui.js"),css=read("edgy-game-layout.css");
 assert.ok(ui.includes('chess:{title:"Xadrez",icon:'));
 assert.ok(!ui.includes('chess:{title:"Xadrez online"'));
 assert.ok(chess.includes('class="result chessLobbyNotice" id="chess-info"'));
 assert.ok(css.includes('#screen .chessLobbyNotice:empty{display:none!important}'));
 const p=chess.indexOf('window.EDGY_gameUI.card("Entrar numa sala"');
 const q=chess.indexOf('window.EDGY_gameUI.card("As tuas salas"',p);
 assert.ok(p>=0&&q>p);
 assert.ok(!chess.slice(p,q).includes("+'<p class=\"result\" id=\"chess-info\"></p>'"));
});
