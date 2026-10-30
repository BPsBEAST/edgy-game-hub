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
const gameFiles=["app.js","edgy-platform.js","edgy-game-ui.js","players.js","social.js","history.js","chess-online.js","checkers-replay.js","checkers-online.js","tic-online.js","auth.js","sw.js"];
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
 assert.ok(names.includes("./edgy-platform.js?v=32"),"shared platform cached");
 assert.ok(names.includes("./app.js?v=36"),"bootstrap cached");
 assert.ok(names.includes("./base.css?v=29"),"base stylesheet cached");
 assert.ok(names.includes("./edgy-theme.css?v=34"),"design cached");
 assert.ok(names.includes("./tic-online.js?v=35"),"online tic cached");
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
 assert.deepEqual(Object.keys(platform.games).sort(),["checkers","chess","reaction","tic"]);
 assert.equal(platform.code(" aB41cD23 "),"AB41CD23");
 assert.throws(()=>platform.code("oops"),/8 caracteres/);
 assert.throws(()=>platform.rooms.create("reaction"),/não suporta/);
 await platform.rooms.create("chess",{base:600,increment:0});
 await platform.rooms.create("checkers");
 await platform.rooms.create("tic");
 await platform.rooms.join("chess","aB41cD23");
 await platform.rooms.join("checkers","aB41cD23");
 await platform.rooms.join("tic","aB41cD23");
 await platform.rooms.cancel("chess","aB41cD23");
 await platform.rooms.invite("checkers","aB41cD23","some-user-id");
 await platform.rooms.invite("tic","aB41cD23","some-user-id");
 await platform.rooms.respond("some-invite",true);
 await platform.rooms.list(200);
 assert.deepEqual(calls.map(c=>c.name),["edgy_create_chess_room_timed","edgy_checkers_create","edgy_tic_create","edgy_join_chess_room","edgy_checkers_join","edgy_tic_join","edgy_cancel_waiting_chess_room","edgy_invite_send","edgy_invite_send","edgy_invite_respond","edgy_my_rooms"]);
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args)),{p_base:600,p_increment:0});
 assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1).args)),{p_limit:100});
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
test("Stable footer, profile replay links and chess mobile actions",()=>{
 const html=read("index.html"),css=read("edgy-theme.css");
 const chess=read("chess-online.js"),damas=read("checkers-online.js"),players=read("players.js");
 assert.ok(html.includes('<footer class="foot">EDGY · Feito para jogar, onde quiseres.</footer>'));
 assert.ok(css.includes(".main>.foot{")&&css.includes("margin: auto 0 0!important"));
 assert.ok(css.includes(".playerOverlay:not([hidden]) .playerDialog"));
 assert.ok(css.includes("playerReplayLink")&&players.includes("data-replay="));
 assert.ok(chess.includes('data-chess-panel="actions"'));
 assert.ok(chess.includes('data-chess-panel="history"'));
 assert.ok(css.includes("main.chess-viewport #screen .chessSide"));
 assert.ok(!damas.includes("data-refresh"));
 assert.ok(!damas.includes(">Atualizar</button>"));
});

test("Game library uses a single registry loaded before bootstrap",()=>{
 const scripts=[...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m=>m[1]);
 const platform=scripts.indexOf("./edgy-platform.js?v=32");
 const bootstrap=scripts.indexOf("./app.js?v=36");
 assert.ok(platform>=0&&bootstrap>=0&&platform<bootstrap);
 const app=read("app.js"),defs=read("edgy-platform.js");
 assert.ok(app.includes("Object.values(window.EDGY_platform.games).map("));
 assert.ok(app.includes("defs.length"));
 for(const game of ["chess","checkers","tic","reaction"])assert.ok(defs.includes(game+":Object.freeze("));
 assert.ok(app.includes('filter==="Multiplayer"?window.EDGY_platform.games[g.id].online'));
});

test("Chess mobile sections are independently usable and promotion opens actions",()=>{
 const chess=read("chess-online.js"),css=read("edgy-theme.css");
 assert.ok(chess.includes('sheet.dataset.activeSheet=drawerSection'));
 assert.ok(chess.includes('data.sheetView="actions"')||chess.includes('dataset.sheetView="actions"'));
 assert.ok(chess.includes('dataset.sheetView="history"'));
 assert.ok(chess.includes('button.dataset.sheetTab=tab'));
 assert.ok(chess.includes('promo={from:selected,to:sq};drawerSection="actions";drawerOpen=true;draw()'));
 assert.ok(css.includes('.chessSide[data-active-sheet="history"]'));
 assert.ok(css.includes('.chessSide[data-active-sheet="actions"]'));
 assert.ok(css.includes("bottom:calc(74px + env(safe-area-inset-bottom))"));
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
test("Mobile chess has scroll access and persistent options above the bottom navigation",()=>{
 const css=read("edgy-theme.css");
 assert.ok(css.includes('.main.chess-viewport #screen{'));
 assert.ok(css.includes('overflow-y:auto!important;overflow-x:hidden!important'));
 assert.ok(css.includes('.main.chess-viewport #screen .chessMobileTools{'));
 assert.ok(css.includes('position:static!important;display:grid!important;'));
 assert.ok(css.includes('position:relative!important;inset:auto!important;'));
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
test("Chess mobile panel is before the match shell and retains history actions",()=>{
 const chess=read("chess-online.js"),css=read("edgy-game-layout.css");
 assert.ok(chess.includes('window.EDGY_gameUI.header("chess"'));
 assert.ok(chess.includes('window.EDGY_gameUI.match({game:"chess"'));
 assert.ok(chess.includes('<div class="chessMobileTools">'));
 assert.ok(chess.includes('reviewControls()'));
 assert.ok(chess.includes('button.dataset.sheetTab=tab'));
 assert.ok(css.includes('#screen .edgyMatchStage'));
 assert.ok(css.includes('#screen .edgyMatchSide'));
});
test("All games share one header, lobby cards and match presentation",()=>{
 const html=read("index.html"),ui=read("edgy-game-ui.js"),css=read("edgy-game-layout.css");
 assert.ok(html.includes('edgy-game-ui.js?v=35'));
 assert.ok(html.includes('edgy-game-layout.css?v=35'));
 for(const game of ["chess","checkers","tic","reaction"])assert.ok(ui.includes(game+':{title:'));
 for(const file of ["chess-online.js","checkers-online.js","tic-online.js","app.js"]){
  const src=read(file);
  assert.ok(src.includes('window.EDGY_gameUI.header('),file);
  assert.ok(src.includes('window.EDGY_gameUI.match('),file);
 }
 for(const file of ["chess-online.js","checkers-online.js","tic-online.js"]){
  assert.ok(read(file).includes('window.EDGY_gameUI.card('),file);
 }
 assert.ok(css.includes('#screen .edgyGameHeaderRow'));
 assert.ok(css.includes('#screen .edgyGamePanel'));
 assert.ok(css.includes('#screen .edgyMatchLayout'));
});
test("Universal renderer escapes user text and keeps consistent structure",()=>{
 const code=read("edgy-game-ui.js"),ctx={window:{},document:{}};
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
test("Damas and Galo use one mobile options/history panel implementation",()=>{
 const ui=read("edgy-game-ui.js"),css=read("edgy-game-layout.css");
 for(const file of ["checkers-online.js","tic-online.js"])assert.ok(read(file).includes('window.EDGY_gameUI.bindMobilePanel('));
 assert.ok(ui.includes('function bindMobilePanel('));
 assert.ok(css.includes('#screen .edgyMatchSide.edgyMatchDrawer'));
 assert.ok(css.includes('[data-game-panel-open="history"]'));
});

test("EDGY v36: all library tiles have equal geometry and a readable footer",()=>{
 const css=read("edgy-game-layout.css"),app=read("app.js"),html=read("index.html");
 assert.ok(app.includes('screen.classList.toggle("edgyLibraryPage",page==="games"&&!game)'));
 assert.ok(app.includes('function openGame(id){screen.classList.remove("edgyLibraryPage")'));
 assert.ok(app.includes('nav("games");screen.classList.remove("edgyLibraryPage");game=name'));
 assert.ok(css.includes('#screen.edgyLibraryPage .games{'));
 assert.ok(css.includes('grid-auto-rows:1fr'));
 assert.ok(css.includes('#screen.edgyLibraryPage .game .art,'));
 assert.ok(css.includes('flex-basis:100px'));
 assert.ok(css.includes('.main:has(> #screen.edgyLibraryPage)>.foot'));
 assert.ok(html.includes('edgy-game-layout.css?v=36'));
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
