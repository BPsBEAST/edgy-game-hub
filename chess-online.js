(function(){
"use strict";
let Chess=null,room=null,players=null,channel=null,poller=null,selected="",promo=null,busy=false,pending="",engineError="",autoTried=false,clockTimer=null,previewIndex=null,confirmResign=false,myRooms=[],roomsLoading=false,roomLoadError='',timeBase=Date.now(),timeAt=performance.now(),lastCheck=0,rivalry=null,rivalryKey="",rivalryLoading=false,resultSeen=new Set(),drawerOpen=false;
const glyph={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟︎"};
const x=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const auth=()=>window.EDGY_auth;
const db=()=>auth()?.getClient();
const user=()=>auth()?.getUser();
const notice=s=>{const el=document.getElementById("chess-info");if(el)el.textContent=s};
const css=document.createElement("style");
css.textContent='.chessWrap{max-width:720px;margin:auto}.chessBoard{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));width:100%;max-width:520px;margin:15px auto;border:3px solid #674674;border-radius:9px;overflow:hidden}.chessSq{aspect-ratio:1;min-width:0;padding:0;border:0;display:grid;place-items:center;position:relative;border-radius:0}.chessSq.light{background:#e0d2e8}.chessSq.dark{background:#69537d}.chessSq.active{box-shadow:inset 0 0 0 4px #ff0878}.chessSq.legal:after{content:"";position:absolute;background:#ff168b88;width:23%;height:23%;border-radius:50%;pointer-events:none}.chessGlyph{font-family:"Segoe UI Symbol","DejaVu Sans",serif;font-size:clamp(22px,7vw,47px);line-height:1;pointer-events:none}.chessGlyph.w{color:#fffdf6;text-shadow:1px 2px #241728,-1px -1px #241728}.chessGlyph.b{color:#23142f;text-shadow:1px 1px #e6d9f2}.chessRank{position:absolute;left:3px;top:2px;font-size:9px;pointer-events:none;color:#322044}.chessSq.dark .chessRank{color:#f0deee}.chessPlayers{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin:15px 0}.chessPlayer{background:#27203f;padding:13px;border-radius:12px;border:1px solid #57416b}.chessPlayer strong{display:block}.chessPlayer small{font-size:12px;color:#b6a7c5}.chessBtn{background:linear-gradient(115deg,#ff075c,#c300a7);color:#fff;border:0;border-radius:12px;padding:12px 16px;font-weight:800;min-height:44px}.chessInput{background:#151027;color:#fff;border:1px solid #655078;border-radius:11px;padding:13px;width:100%;font-weight:800;letter-spacing:2px;text-transform:uppercase}.chessRow{display:flex;gap:9px;flex-wrap:wrap;margin:15px 0}.chessRow>*{flex:1}.chessStatus{padding:13px;border-radius:12px;background:#292041;border:1px solid #563e66;color:#dfd2ed;line-height:1.5}.chessMoves{font-size:13px;line-height:1.8;color:#c8b6d9;max-height:120px;overflow:auto}.chessPromotion{display:flex;gap:8px;justify-content:center;padding:12px}.chessPromotion button{font-size:30px;border:1px solid #ab4d8f;border-radius:10px;background:#322246;color:#fff;padding:8px 12px}';
css.textContent+="\n.chessClockBox{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 13px;background:#2b2141;border:1px solid #504165;border-radius:13px;margin:9px 0;transition:background .2s,border-color .2s}\n.chessClockBox.turn{background:#4b2449;border-color:#ed2b8c}\n.chessClockName{font-size:13px;font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.chessClockHandle{font-size:11px;color:#bfb2d0;margin-top:3px}\n.chessClockTime{font-variant-numeric:tabular-nums;font-feature-settings:\"tnum\";font-size:23px;font-weight:850;background:#171129;border:1px solid #655477;padding:7px 10px;border-radius:10px;min-width:91px;text-align:center;color:#ded2ec}\n.chessClockBox.turn .chessClockTime{background:linear-gradient(115deg,#ff075c,#c300a7);border-color:transparent;color:#fff}\n.chessClockTime.urgent{background:#7b193f!important;animation:edgyTick .8s infinite alternate}\n@keyframes edgyTick{to{box-shadow:0 0 15px #ff15799b}}\n.chessControlSelect{display:flex;gap:8px;flex-wrap:wrap;margin:13px 0}\n.chessControlSelect button{flex:1;border:1px solid #5c4570;border-radius:10px;background:#322447;color:white;padding:12px;font-weight:700}\n.chessControlSelect button.active{background:#65315a;border-color:#ff3c96}\n.chessMovesGrid{max-height:250px;overflow:auto;display:grid;gap:4px;padding:8px}\n.chessMoveRow{display:grid;grid-template-columns:32px 1fr 1fr;align-items:center;gap:5px;padding:2px 5px;border-radius:7px}\n.chessMoveRow:nth-child(even){background:#ffffff08}\n.chessMoveIndex{font-size:12px;color:#9e8dac;text-align:center}\n.chessMoveButton{border:0;background:none;color:#eee5fa;text-align:left;border-radius:7px;padding:8px;font-size:13px;font-weight:700}\n.chessMoveButton.latest{background:#8e2567}\n.chessMoveButton.preview{outline:1px solid #ff5d9d}\n.chessMoveButton:hover{background:#5b335d}\n.chessLast{box-shadow:inset 0 0 0 4px #c83b8b73}\n.chessPieceFly{position:fixed;z-index:99;pointer-events:none;transition:transform .24s cubic-bezier(.18,.75,.25,1);display:grid;place-items:center}\n.chessDecision{margin:12px 0;border:1px solid #a75d8a;background:#472443;border-radius:12px;padding:13px}\n.chessDecision p{margin:0 0 10px;font-size:13px;color:#fbe1ee}\n.chessDecision button{margin:4px;font-size:12px}\n.chessReview{font-size:13px;color:#fba8d1;margin:9px 0;text-align:center}\n.chessMainGrid{display:grid;gap:16px}\n.chessSide{min-width:0}\n@media(min-width:860px){.chessWrap{max-width:1020px}.chessMainGrid{grid-template-columns:minmax(0,1fr) 300px;align-items:start}.chessSide{position:sticky;top:25px}.chessGlyph{font-size:clamp(28px,4vw,52px)}}\n@media(prefers-reduced-motion:reduce){.chessPieceFly,.chessClockTime{transition:none;animation:none!important}}\n";css.textContent+=".chessReviewControls{display:flex;gap:7px;margin:10px 0}.chessReviewControls button{flex:1;padding:11px 5px;border:1px solid #665078;border-radius:9px;background:#362a4c;color:#fff;font-weight:800;font-size:17px}.chessReviewControls button:disabled{opacity:.4}.chessHistoryNote{font-size:12px;text-align:center;color:#dcb7d9;margin:7px 0}";css.textContent+=".chessRoomPanel{background:#231a38;border:1px solid #564368;border-radius:14px;padding:16px;margin:16px 0}.chessRoomRow{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding:10px 0;border-top:1px solid #554162}.chessRoomMeta{font-size:12px;color:#baaccb}.chessRoomActions{display:flex;gap:6px}.chessRoomActions button{border:1px solid #695175;background:#38294c;color:white;border-radius:9px;padding:10px;min-height:40px;font-weight:700;font-size:12px}.chessRoomActions .cancelRoom{color:#ffafcc}";css.textContent+="\n/* Responsive chess viewport; no sideways page movement, no nested move-list scrollbar. */\n.chessWrap,.chessMainGrid,.chessSide,.chessRoomPanel{min-width:0;max-width:100%}\n.chessWrap{overflow-x:clip;overscroll-behavior-x:none;touch-action:pan-y pinch-zoom}\n.chessBoard{width:min(100%,calc(100dvh - 330px),520px);max-width:100%;margin:10px auto;touch-action:pan-y pinch-zoom;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}\n.chessSq,.chessSq *{touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}\n.chessMovesGrid{max-height:none;min-height:0;overflow:visible;padding:5px}\n.chessReviewControls{margin:6px 0;gap:5px}\n.chessReviewControls button{min-height:40px}\n.chessHistoryNote{margin:4px 0}\n.chessClockBox{margin:6px 0;padding:8px 10px}\n.chessClockTime{font-size:21px;padding:6px 9px}\n.chessWrap .chessRow{min-width:0}\n.chessWrap .chessRow>*{min-width:0}\n.chessBoard button{min-width:0}\n@media(max-width:799px){\n .main:has(.chessBoard) .top{margin-bottom:12px}\n .main:has(.chessBoard) .foot{display:none}\n .chessWrap .back{padding:4px 0 9px}\n .chessWrap h1{font-size:clamp(22px,5.3vw,30px);margin-bottom:4px}\n .chessMainGrid{gap:10px}\n .chessBoard{width:min(100%,calc(100dvh - 322px),440px)}\n .chessStatus{padding:10px}\n .chessSide .section{margin-top:10px}\n}\n@media(max-height:630px) and (max-width:799px){\n .chessBoard{width:min(100%,calc(100dvh - 270px))}\n .chessClockName{font-size:12px}\n .chessClockTime{font-size:18px}\n .chessClockBox{padding:5px 9px}\n}\n@media(min-width:800px){\n .chessWrap{max-width:1020px}\n .chessMainGrid{grid-template-columns:minmax(0,1fr) minmax(250px,300px)}\n .chessBoard{width:min(100%,calc(100dvh - 305px),520px)}\n}\n";css.textContent+=".chessPlayerLink{display:flex;align-items:center;gap:9px;border:0;background:transparent;color:inherit;text-align:left;padding:1px;min-width:0;max-width:70%;border-radius:10px}.chessPlayerLink:hover{color:#ff91c5}.chessPlayerLink>span:last-child{display:block;overflow:hidden;min-width:0}.chessPlayerPic{width:33px;height:33px;flex:0 0 33px;border-radius:50%;object-fit:cover;border:1px solid #9f608f}.chessPlayerFallback{display:grid;place-items:center;background:#54365e;color:#fff;font-size:15px;font-weight:750}.chessPlayerLink .chessClockName,.chessPlayerLink .chessClockHandle{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}";css.textContent+="\n/* EDGY v15 – fitted chess layout, result modal and rivalry board. */\n.main.chess-viewport{overflow:hidden!important;display:flex;flex-direction:column;padding-top:13px;padding-bottom:10px;min-height:0}\n.main.chess-viewport .top{flex:0 0 auto;margin-bottom:6px;min-height:35px}\n.main.chess-viewport #screen{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column}\n.main.chess-viewport .foot{display:none}\n.chess-viewport .chessWrap:has(.chessBoard){width:100%;height:100%;min-height:0;max-width:100%;display:flex;flex-direction:column;overflow:hidden}\n.chess-viewport .chessWrap>.back{padding:2px 0 5px;flex:none}\n.chess-viewport .chessWrap>.row{flex:none;min-height:32px;margin-bottom:2px}\n.chess-viewport .chessWrap>.row h1{font-size:clamp(21px,2.7vw,30px);line-height:1;margin:0}\n.chess-viewport .chessMainGrid{flex:1;min-height:0;grid-template-columns:minmax(0,1fr) minmax(220px,285px);gap:12px}\n.chess-viewport .chessMainGrid>.chessBoardArea{display:flex;flex-direction:column;min-height:0;align-items:stretch;justify-content:flex-start;min-width:0}\n.chess-viewport .chessBoard{width:min(100%,max(235px,calc(100dvh - 420px)),500px)!important;max-height:none;flex:0 0 auto;margin:4px auto}\n.chess-viewport .chessClockBox{padding:5px 9px;margin:3px 0;min-height:43px}\n.chess-viewport .chessClockTime{padding:4px 8px;font-size:19px}\n.chess-viewport .chessReviewControls{margin:3px 0;gap:5px}\n.chess-viewport .chessReviewControls button{padding:6px 3px;min-height:34px}\n.chess-viewport .chessHistoryNote{margin:2px 0;font-size:11px}\n.chess-viewport .chessSide{position:static;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:5px}\n.chess-viewport .chessSide>.chessStatus{font-size:12px;padding:9px 10px}\n.chess-viewport .chessSide .chessRow{margin:4px 0;gap:6px}\n.chess-viewport .chessSide .chessRow button{font-size:12px;min-height:39px;padding:8px}\n.chess-viewport .chessSide .section{margin-top:4px}\n.chess-viewport .chessSide .chessMovesGrid{gap:1px;padding:2px}\n.chess-viewport .chessSide .chessMoveButton{padding:5px 7px}\n.chess-viewport .chessSide .result{margin:0;min-height:0;font-size:12px}\n.chessRivalry{border:1px solid #4a385d;background:#241b3b;border-radius:12px;padding:10px;font-size:12px;min-height:0;flex:none}\n.chessRivalryTitle{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:8px;font-weight:800}\n.chessRivalryScore{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}\n.chessRivalryScore span{background:#342544;border-radius:8px;text-align:center;padding:7px 3px;color:#dbc7ea}\n.chessRivalryScore b{display:block;font-size:16px;color:#fff}\n.chessRivalryList{margin:7px 0 0;list-style:none;padding:0;display:grid;gap:3px}\n.chessRivalryList li{display:flex;justify-content:space-between;gap:7px;color:#bcb1ca;padding:5px;border-bottom:1px solid #3a2a4b}\n.chessResultOverlay{position:fixed;z-index:130;inset:0;display:grid;place-items:center;padding:18px;background:#0d0823d9;backdrop-filter:blur(16px)}\n.chessResultOverlay[hidden]{display:none!important}\n.chessResultBox{background:radial-gradient(circle at top,#4e2753,#241a39 65%);border:1px solid #9c478a;box-shadow:0 25px 80px #0a0417c9;width:min(100%,380px);text-align:center;padding:32px 24px;border-radius:25px;animation:chessResultEnter .38s cubic-bezier(.17,.9,.28,1) both}\n.chessResultSymbol{font-size:62px;color:#ff4f9e;line-height:1.3}\n.chessResultBox h2{font-size:35px;letter-spacing:-1.5px;margin:10px 0}\n.chessResultBox p{color:#dac7e6;font-size:14px}\n.chessResultBox button{width:100%;margin-top:8px;min-height:43px}\n@keyframes chessResultEnter{from{opacity:0;transform:translateY(20px) scale(.91)}to{opacity:1;transform:translateY(0) scale(1)}}\n.chessMobileStatus,.chessMobileTools,.chessMobileScrim,.chessDrawerClose{display:none}\n@media(min-width:800px){\n .main.chess-viewport{padding-left:28px;padding-right:28px}\n .chess-viewport .chessSide .chessRivalryList li:nth-child(n+4){display:none}\n}\n@media(max-width:799px){\n .main.chess-viewport{padding:5px 9px calc(72px + env(safe-area-inset-bottom))}\n .main.chess-viewport .top{margin:0;min-height:31px;height:31px}\n .chess-viewport .chessWrap>.back{font-size:12px;padding:1px 0 3px}\n .chess-viewport .chessWrap>.row{min-height:25px}\n .chess-viewport .chessWrap>.row h1{font-size:20px}\n .chess-viewport .chessMainGrid{display:block;flex:1;min-height:0}\n .chess-viewport .chessBoard{width:min(100%,max(165px,calc(100dvh - 330px)),440px)!important;margin:3px auto}\n .chess-viewport .chessClockBox{min-height:39px;padding:3px 8px;margin:2px 0}\n .chess-viewport .chessClockTime{font-size:18px}\n .chess-viewport .chessReviewControls{margin:2px 0}\n .chess-viewport .chessReviewControls button{min-height:32px;padding:5px 3px}\n .chessMobileStatus{display:block;color:#cfc0df;font-size:11px;line-height:1.2;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;margin:3px 0}\n .chessMobileTools{display:flex;gap:6px;margin-top:3px}\n .chessMobileTools button{flex:1;background:#322445;border:1px solid #6a3e65;color:#fff;border-radius:10px;padding:8px;font-size:12px;font-weight:750;min-height:34px}\n .chessMobileScrim{position:fixed;z-index:89;inset:0;background:#0d081fc4;display:none}\n .chessDrawerClose{display:block;border:1px solid #65486f;background:#37264c;color:white;padding:9px 12px;border-radius:9px;margin-left:auto}\n .chess-viewport .chessSide{position:fixed;z-index:90;left:0;right:0;bottom:0;max-height:min(85dvh,700px);overflow-y:auto;display:flex;gap:7px;transform:translateY(105%);transition:transform .25s ease;padding:13px 15px calc(14px + env(safe-area-inset-bottom));background:#1d1732;border-radius:20px 20px 0 0;box-shadow:0 -20px 50px #08051596}\n .chess-viewport #screen.chess-drawer-open .chessSide{transform:translateY(0)}\n .chess-viewport #screen.chess-drawer-open .chessMobileScrim{display:block}\n .chess-viewport .chessSide .chessMovesGrid{max-height:none;overflow:visible}\n .chess-viewport .chessSide .chessRivalryList li:nth-child(n+5){display:none}\n}\n@media(max-width:430px) and (max-height:740px){\n .chess-viewport .chessBoard{width:min(100%,max(155px,calc(100dvh - 360px)),400px)!important}\n .chess-viewport .chessClockBox{min-height:35px}\n .chess-viewport .chessClockTime{font-size:16px}\n}\n@media(prefers-reduced-motion:reduce){.chessResultBox{animation:none}.chess-viewport .chessSide{transition:none}}\n";css.textContent+=".chessMatchHeader{display:flex;align-items:center;gap:12px;min-width:0;margin:0 0 9px;flex:0 0 auto}.chessMatchHeader .chessHeaderTitle{display:flex;align-items:center;gap:9px;flex:1;min-width:0}.chessMatchHeader .chessHeaderTitle h1{margin:0;line-height:1.08;font-size:clamp(21px,2.7vw,30px)}.chessBackMini{border:1px solid #554366;background:#2b2040;color:#dbcfeb;border-radius:10px;padding:8px 10px;font-size:12px;font-weight:750;white-space:nowrap;min-height:36px;touch-action:manipulation}.chessBackMini:hover{border-color:#e13f92;color:#fff}.chessMatchHeader .pill{flex:0 0 auto;font-size:11px;white-space:nowrap}.chessHeaderKnight{font-size:26px;color:#f63a96;line-height:1}@media(max-width:420px){.chessMatchHeader{gap:7px}.chessBackMini{padding:7px;font-size:11px}.chessMatchHeader .chessHeaderTitle h1{font-size:19px}.chessMatchHeader .pill{font-size:9px;padding:5px}}";css.textContent+=".chessPlayerMaterial{min-width:0;flex:1;display:flex;align-items:center;gap:5px;flex-wrap:wrap}.chessPlayerMaterial .chessPlayerLink{max-width:100%;flex:0 1 auto}.chessMaterial{display:inline-flex;align-items:center;gap:0;min-height:16px;white-space:nowrap;max-width:100%;overflow:hidden}.chessMaterial .edgyPiece{width:16px;height:16px;max-width:16px;max-height:16px;margin-left:-3px;filter:none}.chessMaterial .edgyPiece:first-child{margin-left:0}.chessMaterialScore{font-size:12px;color:#ffe3f2;margin-left:5px}.chessMaterialEmpty{font-size:10px;color:#a78ea6}.chessPlayerMaterial .chessClockName{font-size:13px}@media(max-width:500px){.chessMaterial .edgyPiece{width:13px;height:13px}.chessPlayerMaterial{gap:2px}.chessMaterialEmpty{font-size:9px}}";document.head.appendChild(css);

const resultOverlay=document.createElement("div");
resultOverlay.className="chessResultOverlay";
resultOverlay.hidden=true;
resultOverlay.setAttribute("role","dialog");
resultOverlay.setAttribute("aria-modal","true");
resultOverlay.setAttribute("aria-label","Resultado do xadrez");
resultOverlay.innerHTML='<div class="chessResultBox"><div class="chessResultSymbol" id="chess-result-symbol">♛</div><h2 id="chess-result-heading"></h2><p id="chess-result-reason"></p><button class="chessBtn" id="chess-result-close">Continuar</button><button class="chessSubBtn" id="chess-result-history">Ver confrontos</button></div>';
document.body.append(resultOverlay);
const closeResult=()=>{resultOverlay.hidden=true};
resultOverlay.querySelector("#chess-result-close").onclick=closeResult;
resultOverlay.querySelector("#chess-result-history").onclick=()=>{closeResult();drawerOpen=true;draw()};
resultOverlay.addEventListener("click",e=>{if(e.target===resultOverlay)closeResult()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeResult()});
function showResult(){
 if(!room||!["white_win","black_win","draw"].includes(room.status)||resultSeen.has(room.id)||!user())return;
 resultSeen.add(room.id);
 const mySide=user().id===room.white_id?"white":user().id===room.black_id?"black":null;
 if(!mySide)return;
 const win=room.status!=="draw"&&room.status===mySide+"_win";
 const loss=room.status!=="draw"&&!win;
 resultOverlay.querySelector("#chess-result-heading").textContent=win?"Venceste!":loss?"Perdeste!":"Empate!";
 resultOverlay.querySelector("#chess-result-symbol").textContent=win?"🏆":loss?"♟":"🤝";
 resultOverlay.querySelector("#chess-result-reason").textContent=resultsText();
 resultOverlay.hidden=false;
 resultOverlay.querySelector("#chess-result-close").focus();
}
async function fetchRivalry(force=false){
 if(!room?.black_id||!user()||!db())return;
 const opponent=user().id===room.white_id?room.black_id:room.white_id;
 if(!opponent||opponent===user().id)return;
 const key=room.id+":"+opponent;
 if(!force&&rivalryKey===key)return;
 rivalryKey=key;rivalryLoading=true;
 try{
  const {data,error}=await db().rpc("edgy_chess_head_to_head",{p_opponent:opponent});
  if(error)throw error;
  if(rivalryKey!==key)return;
  rivalry=data;
 }catch(error){console.warn("EDGY rivalry:",error);rivalry=null}
 finally{if(rivalryKey===key){rivalryLoading=false;if(game==="chess"&&room)draw()}}
}
function rivalryHtml(){
 if(!room?.black_id)return '<div class="chessRivalry"><b>Confrontos diretos</b><p class="sub">Disponível quando o adversário entrar.</p></div>';
 if(rivalryLoading)return '<div class="chessRivalry"><b>Confrontos diretos</b><p class="sub">A consultar partidas...</p></div>';
 if(!rivalry)return '<div class="chessRivalry"><b>Confrontos diretos</b><p class="sub">Sem histórico disponível.</p></div>';
 const resultWord={win:"Vitória",loss:"Derrota",draw:"Empate"};
 const games=Array.isArray(rivalry.games)?rivalry.games:[];
 return '<section class="chessRivalry"><div class="chessRivalryTitle"><span>Confrontos diretos</span><span class="pill">'+Number(rivalry.total||0)+' partidas</span></div><div class="chessRivalryScore"><span><b>'+Number(rivalry.wins||0)+'</b>Vitórias</span><span><b>'+Number(rivalry.draws||0)+'</b>Empates</span><span><b>'+Number(rivalry.losses||0)+'</b>Derrotas</span></div>'+(games.length?'<ul class="chessRivalryList">'+games.map(g=>'<li><span>'+x(resultWord[g.outcome]||"Partida")+' · '+x(g.color==="white"?"Brancas":"Pretas")+'</span><span>'+new Date(g.date).toLocaleDateString("pt-PT")+'</span></li>').join("")+'</ul>':'<p class="sub" style="margin:8px 0 0">Ainda não jogaram uma partida completa.</p>')+'</section>';
}

function clear(){closeResult();drawerOpen=false;rivalry=null;rivalryKey="";rivalryLoading=false;document.querySelector(".main")?.classList.remove("chess-viewport");if(clockTimer){clearInterval(clockTimer);clockTimer=null}previewIndex=null;confirmResign=false;if(channel){db()?.removeChannel(channel);channel=null}if(poller){clearInterval(poller);poller=null}room=null;players=null;selected="";promo=null}
function close(){clear();const u=new URL(location.href);u.searchParams.delete("room");history.replaceState(null,"",u.pathname+u.search+u.hash)}

const serverNow=()=>timeBase+performance.now()-timeAt;
async function timeSync(){
 if(!db())return;
 const before=performance.now(),{data,error}=await db().rpc("edgy_chess_server_time"),after=performance.now();
 if(!error&&data){timeBase=Date.parse(data)+(after-before)/2;timeAt=after}
}
function msLeft(c){
 let remaining=Number(c==="w"?room?.white_ms:room?.black_ms)||0;
 if(room?.status==="active"&&room.clock_started_at&&room.turn===c)
  remaining-=Math.max(0,serverNow()-Date.parse(room.clock_started_at));
 return Math.max(0,remaining);
}
function clockText(millis){
 if(millis<20000){const units=Math.ceil(millis/100);return "00:"+String(Math.floor(units/10)%60).padStart(2,"0")+"."+(units%10)}
 const seconds=Math.ceil(millis/1000);return String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0");
}
function clocks(){
 if(!room)return;
 for(const color of ["w","b"]){
  const n=document.querySelector('[data-clock="'+color+'"]');
  if(n){const ms=msLeft(color);n.textContent=clockText(ms);n.classList.toggle("urgent",room.status==="active"&&room.turn===color&&ms<20000)}
 }
 if(room.status==="active"&&msLeft(room.turn)<600&&performance.now()-lastCheck>2500){
  lastCheck=performance.now();doAction("tick",true);
 }
}
function capturedPieces(){
 const captured={w:[],b:[]};
 const values={p:1,n:3,b:3,r:5,q:9};
 let moves=[];try{moves=engine()?.history({verbose:true})||[]}catch{}
 for(const m of moves)if(m.captured&&values[m.captured])captured[m.color].push(m.captured);
 const scores={w:captured.w.reduce((v,p)=>v+values[p],0),b:captured.b.reduce((v,p)=>v+values[p],0)};
 const order={q:0,r:1,b:2,n:3,p:4};
 for(const col of ["w","b"])captured[col].sort((a,b)=>order[a]-order[b]);
 return {captured,scores};
}
function materialMarkup(color){
 const {captured,scores}=capturedPieces();
 const victim=color==="w"?"b":"w",advantage=scores[color]-scores[victim];
 const pieces=captured[color].map(p=>window.EDGY_pieces?.svg(p,victim)||"").join("");
 if(!pieces&&!advantage)return '<span class="chessMaterialEmpty">Sem capturas</span>';
 return '<span class="chessMaterial" aria-label="Peças capturadas: '+captured[color].length+'; material '+scores[color]+' pontos">'+pieces+(advantage>0?'<b class="chessMaterialScore">+'+advantage+'</b>':"")+'</span>';
}
function clockRow(color){
 const p=color==="w"?players?.white:players?.black;
 const id=color==="w"?room.white_id:room.black_id;
 const url=p?.avatar&&db()?.storage.from("edgy-avatars").getPublicUrl(p.avatar)?.data?.publicUrl;
 const img=url?'<img class="chessPlayerPic" src="'+x(url)+'" alt="">':'<span class="chessPlayerPic chessPlayerFallback">'+x((p?.name||"?").slice(0,1).toUpperCase())+'</span>';
 const who='<button type="button" class="chessPlayerLink" data-player-profile="'+x(id||"")+'" title="Abrir perfil de jogador">'+img+'<span><span class="chessClockName">'+(color==="w"?"♙ ":"♟ ")+x(p?.name||(color==="w"?"Brancas":"À espera do adversário"))+'</span><span class="chessClockHandle">'+(p?"@"+x(p.username):"Código da sala")+'</span></span></button>';
 return '<div class="chessClockBox '+(room.status==="active"&&room.turn===color?"turn":"")+'"><div class="chessPlayerMaterial">'+who+materialMarkup(color)+'</div><div class="chessClockTime" data-clock="'+color+'">'+clockText(msLeft(color))+'</div></div>';
}
function resultsText(){
 const reason={timeout:"Tempo esgotado",timeout_insufficient:"Tempo esgotado · material insuficiente para dar mate",resignation:"Desistência",agreement:"Acordo entre jogadores",checkmate:"Xeque-mate",rules:"Empate pelas regras"};
 return (room.status==="white_win"?"Vitória das brancas":room.status==="black_win"?"Vitória das pretas":"Empate")+" · "+(reason[room.finish_reason]||"Partida terminada");
}
function reviewTo(n){const count=engine()?.history()?.length||0;const pos=Math.max(0,Math.min(count,n));previewIndex=pos===count?null:pos;selected="";draw()}
function reviewStep(delta){const count=engine()?.history()?.length||0;reviewTo((previewIndex===null?count:previewIndex)+delta)}
function reviewControls(){const count=engine()?.history()?.length||0,pos=previewIndex===null?count:previewIndex;
return '<div class="chessReviewControls" role="group" aria-label="Navegar pelas jogadas"><button data-first aria-label="Primeira posição" '+(pos===0?'disabled':'')+'>⏮</button><button data-prev aria-label="Lance anterior" '+(pos===0?'disabled':'')+'>◀</button><button data-next aria-label="Lance seguinte" '+(pos>=count?'disabled':'')+'>▶</button><button data-last aria-label="Último lance" '+(pos>=count?'disabled':'')+'>⏭</button></div><p class="chessHistoryNote">'+(pos===count?'Em direto':'Lance '+pos+' / '+count)+'</p>'}
function moveList(){
 const moves=engine()?.history()||[];
 const rows=Math.ceil(moves.length/2),windowRows=7;
 const focus=previewIndex===null?moves.length:previewIndex;
 const pivot=Math.ceil(focus/2);
 const first=Math.max(0,Math.min(Math.max(0,rows-windowRows),pivot-4));
 const last=Math.min(rows,first+windowRows);
 let html='<div class="chessMovesGrid">';
 if(!moves.length)html+='<p class="sub" style="padding:10px">Ainda não há jogadas.</p>';
 for(let r=first;r<last;r++){
  const i=r*2;
  html+='<div class="chessMoveRow"><span class="chessMoveIndex">'+(r+1)+'.</span>';
  for(let j=i;j<Math.min(moves.length,i+2);j++)
   html+='<button data-move="'+(j+1)+'" class="chessMoveButton '+(j===moves.length-1?"latest ":"")+(previewIndex===j+1?"preview":"")+'">'+x(moves[j])+'</button>';
  if(i+1===moves.length)html+='<span></span>';
  html+='</div>';
 }
 html+='</div>';
 if(rows>windowRows)html+='<p class="chessHistoryNote">A mostrar lances '+(first+1)+'–'+last+' de '+rows+' · usa as setas para navegar</p>';
 return html;
}
function proposal(){
 if(room.status!=="active"||!room.black_id)return "";
 if(room.draw_offered_by){
  if(room.draw_offered_by===user()?.id)return '<div class="chessDecision"><p>🤝 Propuseste empate. À espera de resposta.</p></div>';
  return '<div class="chessDecision"><p>🤝 O adversário propôs empate.</p><button class="chessBtn" data-action="accept_draw">Aceitar</button><button class="secondary" data-action="decline_draw">Recusar</button></div>';
 }
 if(confirmResign)return '<div class="chessDecision"><p>⚠️ Desistir atribui a vitória ao teu adversário. Confirmas?</p><button class="chessBtn" data-action="resign">Desistir</button><button class="secondary" data-cancel-resign>Cancelar</button></div>';
 return '<div class="chessRow"><button class="secondary" data-action="offer_draw">🤝 Propor empate</button><button class="secondary" data-resign>🏳 Desistir</button></div>';
}
async function doAction(action,quiet=false){
 if(!room||busy)return;
 if(!quiet){busy=true;notice("A atualizar a partida...")}
 try{
  const {data,error}=await db().functions.invoke("chess-action",{body:{code:room.code,action}});
  if(!quiet){if(error||data?.ok===false)notice(data?.error||data?.reason||error?.message||"Não foi possível atualizar");else notice("")}
 }catch(e){if(!quiet)notice("Erro de ligação ao servidor")}
 finally{if(!quiet)busy=false;await refresh()}
}
function animatedMove(prev,next){
 if(next.ply<=prev.ply||!next.last_move||window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)return null;
 const from=next.last_move.slice(0,2),to=next.last_move.slice(2,4),old=document.querySelector('[data-sq="'+from+'"]'),piece=old?.querySelector(".chessGlyph");
 if(!old||!piece)return null;
 const origin=old.getBoundingClientRect(),glyphCopy=piece.cloneNode(true);
 return ()=>{
  const target=document.querySelector('[data-sq="'+to+'"]');if(!target)return;
  const rect=target.getBoundingClientRect(),destPiece=target.querySelector(".chessGlyph");
  const ghost=document.createElement("span");ghost.className="chessPieceFly";ghost.style.cssText="top:"+origin.top+"px;left:"+origin.left+"px;width:"+origin.width+"px;height:"+origin.height+"px";
  ghost.appendChild(glyphCopy);document.body.appendChild(ghost);
  if(destPiece)destPiece.style.visibility="hidden";
  requestAnimationFrame(()=>requestAnimationFrame(()=>ghost.style.transform="translate("+(rect.left-origin.left)+"px,"+(rect.top-origin.top)+"px)"));
  setTimeout(()=>{ghost.remove();if(destPiece)destPiece.style.visibility=""},280);
 };
}

function open(code){clear();pending=String(code||"").toUpperCase();autoTried=false;myRooms=[];draw();listRooms()}
function engine(){if(!Chess)return null;const c=new Chess();if(room?.pgn)c.loadPgn(room.pgn);return c}
function uri(){const u=new URL(location.href);u.searchParams.set("room",room.code);return u.href}
function setUri(){history.replaceState(null,"",uri())}

async function listRooms(){
 const me=user();if(!me||!db()||roomsLoading)return;
 roomsLoading=true;roomLoadError="";
 try{
  const {data,error}=await db().from("chess_rooms").select("code,status,white_id,black_id,base_ms,increment_ms")
   .or("white_id.eq."+me.id+",black_id.eq."+me.id).in("status",["waiting","active"]).order("created_at",{ascending:false}).limit(25);
  if(error)throw error;myRooms=data||[];
 }catch(e){roomLoadError=e.message||"Erro ao carregar salas"}
 finally{roomsLoading=false;if(!room)draw()}
}
async function cancelRoom(code){
 if(busy)return;
 if(!myRooms.some(r=>r.code===code&&r.white_id===user()?.id&&r.status==="waiting"))return;
 busy=true;notice("A fechar a sala...");
 try{
  const {data,error}=await db().rpc("edgy_cancel_waiting_chess_room",{p_code:code});
  if(error)throw error;if(!data)throw Error("A sala já não está disponível para fechar");
  myRooms=myRooms.filter(r=>r.code!==code);
  notice("Sala fechada.");
 }catch(e){notice(e.message||"Erro a fechar a sala")}
 finally{busy=false;draw()}
}
function roomsHtml(){
 const rows=myRooms.map(r=>{
  const waiting=r.status==="waiting";
  return '<div class="chessRoomRow"><div><strong>'+x(r.code)+'</strong><div class="chessRoomMeta">'+(waiting?"À espera de adversário":"Partida em curso")+' · '+(r.base_ms/60000)+'+'+(r.increment_ms/1000)+'</div></div><div class="chessRoomActions"><button data-resume="'+x(r.code)+'">'+(waiting?"Abrir":"Retomar")+'</button>'+(waiting&&r.white_id===user()?.id?'<button class="cancelRoom" data-cancel-room="'+x(r.code)+'">Fechar</button>':"")+'</div></div>';
 }).join("");
 return '<section class="chessRoomPanel"><h3>As tuas salas'+(myRooms.length?" ("+myRooms.length+")":"")+'</h3><p class="sub">Retoma uma partida ou fecha uma sala de espera.</p>'+(roomsLoading?'<p class="sub">A carregar...</p>':rows||'<p class="sub">Nenhuma sala aberta.</p>')+(roomLoadError?'<p class="sub">'+x(roomLoadError)+'</p>':"")+'</section>';
}

async function create(base=600,inc=0){
 if(!user()){auth()?.showEntry();return}
 if(busy)return;busy=true;notice("A criar sala...");
 const {data,error}=await db().rpc("edgy_create_chess_room_timed",{p_base:base,p_increment:inc});
 busy=false;if(error){notice(error.message);return}await load(data);
}
async function join(code){
 pending=code=String(code||"").trim().toUpperCase();
 if(!user()){draw();return}
 if(!/^[0-9A-F]{8}$/.test(code)){notice("O código deve ter 8 caracteres.");return}
 if(busy)return;busy=true;notice("A entrar...");
 const {data,error}=await db().rpc("edgy_join_chess_room",{p_code:code});
 busy=false;if(error){notice(error.message);return}await load(data);
}
async function load(code){
 const {data,error}=await db().from("chess_rooms").select("*").eq("code",code).maybeSingle();
 if(error||!data){notice(error?.message||"Sala indisponível");return}
 room=data;selected="";promo=null;previewIndex=null;drawerOpen=false;rivalry=null;rivalryKey="";setUri();await Promise.all([fetchPlayers(),timeSync()]);listen();draw();showResult();
}
async function fetchPlayers(){if(!room)return;const {data}=await db().rpc("edgy_chess_players",{p_code:room.code});if(data)players=data;fetchRivalry()}
function listen(){
 if(channel)db().removeChannel(channel);if(poller)clearInterval(poller);if(clockTimer)clearInterval(clockTimer);
 const id=room.id;
 channel=db().channel("edgy-chess-"+id).on("postgres_changes",{event:"UPDATE",schema:"public",table:"chess_rooms",filter:"id=eq."+id},()=>refresh()).subscribe();
 let count=0;
 poller=setInterval(()=>{if(room&&game==="chess"){refresh();if(++count%5===0)timeSync()}},4000);
 clockTimer=setInterval(clocks,100);
 doAction("tick",true);
}
async function refresh(){
 if(!room||busy)return;
 const prev=room,{data}=await db().from("chess_rooms").select("*").eq("id",prev.id).maybeSingle();
 if(!data)return;
 if(data.ply!==prev.ply||data.status!==prev.status||data.black_id!==prev.black_id||data.updated_at!==prev.updated_at||data.draw_offered_by!==prev.draw_offered_by){
  const animate=animatedMove(prev,data),finished=prev.status==="active"&&data.status!=="active";
  room=data;selected="";promo=null;confirmResign=false;
  if(prev.black_id!==data.black_id)await fetchPlayers();
  draw();animate?.();if(room.status!=="active"&&room.status!=="waiting")showResult();if(finished){fetchRivalry(true);await auth()?.refreshProfile?.()}
 }
 clocks();
}
function status(){
 if(room.status==="waiting")return "À espera do adversário. Partilha o convite.";
 if(room.status!=="active")return resultsText();
 const mine=user()?.id===room.white_id?"w":"b";
 return (room.turn==="w"?"Vez das brancas":"Vez das pretas")+(mine===room.turn?" · A tua vez":" · Aguarda o adversário")+(engine()?.isCheck()?" · Xeque":"");
}
function board(){
 let c=engine();if(!c)return "";
 if(previewIndex!==null){const moves=c.history();c.reset();for(let i=0;i<Math.min(previewIndex,moves.length);i++)c.move(moves[i])}
 const matrix=c.board(),mine=user()?.id===room.black_id?"b":"w";
 const rows=mine==="b"?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];
 const cols=mine==="b"?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];
 const targets=selected&&previewIndex===null?c.moves({square:selected,verbose:true}).map(m=>m.to):[];
 const recent=previewIndex===null&&room.last_move?[room.last_move.slice(0,2),room.last_move.slice(2,4)]:[];
 let checked="";
 if(c.isCheck()){const checkedColor=c.turn();for(let r=0;r<8;r++)for(let i=0;i<8;i++)if(matrix[r][i]?.type==="k"&&matrix[r][i]?.color===checkedColor)checked="abcdefgh"[i]+(8-r)}
 let out='<div class="chessBoard" aria-label="Tabuleiro de xadrez">';
 for(const row of rows)for(const col of cols){
  const sq="abcdefgh"[col]+(8-row),p=matrix[row][col],canGo=targets.includes(sq);
  const classes="chessSq "+((row+col)%2?"dark":"light")+(sq===selected?" active":"")+(canGo?" legal":"")+(canGo&&p?" occupied":"")+(recent.includes(sq)?" chessLast":"")+(sq===checked?" chessCheck":"");
  const label=sq+(p?" "+({p:"peão",r:"torre",n:"cavalo",b:"bispo",q:"rainha",k:"rei"}[p.type]||"peça"):"");
  const icon=p?(window.EDGY_pieces?.svg(p.type,p.color)||'<span class="chessGlyph '+p.color+'">'+glyph[p.color+p.type]+'</span>'):"";
  out+='<button type="button" class="'+classes+'" data-sq="'+sq+'" aria-label="'+label+'">'+(col===cols[0]?'<span class="chessRank">'+(8-row)+'</span>':"")+(row===rows[7]?'<span class="edgyFile">'+"abcdefgh"[col]+'</span>':"")+icon+'</button>';
 }
 return out+'</div>';
}
function draw(){
 const root=document.getElementById("screen");if(!root||game!=="chess")return;
 root.classList.toggle("chess-drawer-open",drawerOpen&&Boolean(room));document.querySelector(".main")?.classList.toggle("chess-viewport",Boolean(room));
 if(!room&&pending&&user()&&!busy&&!autoTried&&/^[A-F0-9]{8}$/.test(pending)){autoTried=true;queueMicrotask(()=>join(pending))}
 if(!Chess){root.innerHTML='<div class="chessWrap"><button class="back" data-back>← Jogos</button><h1>Xadrez online</h1><p class="sub">'+x(engineError||"A carregar as regras...")+'</p></div>';root.querySelector("[data-back]").onclick=()=>nav("games");return}
 if(!user()){root.innerHTML='<div class="chessWrap"><button class="back" data-back>← Jogos</button><h1>Xadrez online</h1><div class="panel">Entra como convidado ou com conta para jogar. <button class="chessBtn" data-auth>Entrar</button></div></div>';root.querySelector("[data-back]").onclick=()=>nav("games");root.querySelector("[data-auth]").onclick=()=>auth()?.showEntry();return}
 if(!room){
  root.innerHTML='<div class="chessWrap"><button class="back" data-back>← Jogos</button><h1>♞ Xadrez online</h1><p class="sub">Relógio por jogador, movimentos animados e partidas entre dois dispositivos.</p><div class="panel"><h3>Escolhe o ritmo</h3><div class="chessControlSelect"><button data-time="180,2">3+2</button><button data-time="300,0">5+0</button><button data-time="600,0" class="active">10+0</button><button data-time="900,10">15+10</button></div><button class="chessBtn" data-create>Criar sala privada</button></div><div class="section panel"><h3>Entrar numa sala</h3><input id="chessCode" class="chessInput" maxlength="8" placeholder="CÓDIGO" value="'+x(pending)+'"><button class="secondary" data-join style="margin-top:10px">Entrar na partida</button></div><p class="result" id="chess-info"></p>'+roomsHtml()+'</div>';
  let base=600,inc=0;
  root.querySelectorAll("[data-time]").forEach(b=>b.onclick=()=>{root.querySelectorAll("[data-time]").forEach(n=>n.classList.toggle("active",n===b));[base,inc]=b.dataset.time.split(",").map(Number)});
  root.querySelector("[data-create]").onclick=()=>create(base,inc);
  root.querySelector("[data-join]").onclick=()=>join(root.querySelector("#chessCode").value);
  root.querySelectorAll("[data-resume]").forEach(el=>el.onclick=()=>load(el.dataset.resume));
  root.querySelectorAll("[data-cancel-room]").forEach(el=>el.onclick=()=>cancelRoom(el.dataset.cancelRoom));
  root.querySelector("[data-back]").onclick=()=>nav("games");return;
 }
 const black=user()?.id===room.black_id,upper=black?"w":"b",lower=black?"b":"w",control=(room.base_ms/60000)+"+"+(room.increment_ms/1000);
 root.innerHTML='<div class="chessWrap"><div class="chessMatchHeader"><button type="button" class="chessBackMini" data-back aria-label="Voltar aos jogos">← Jogos</button><div class="chessHeaderTitle"><span class="chessHeaderKnight">♞</span><h1>Xadrez</h1></div><span class="pill">'+x(control)+' · '+x(room.code)+'</span></div><div class="chessMainGrid"><div class="chessBoardArea">'+'<p class="chessMobileStatus">'+x(status())+'</p>'+clockRow(upper)+board()+clockRow(lower)+reviewControls()+'<div class="chessMobileTools"><button type="button" data-chess-panel="actions">Partida &amp; opções</button><button type="button" data-chess-panel="history">Jogadas &amp; confrontos</button></div>'+(previewIndex!==null?'<div class="chessReview">A rever lance '+previewIndex+' <button class="chessBtn" data-live>Voltar ao jogo</button></div>':"")+'</div><div class="chessMobileScrim" data-close-panel></div><aside class="chessSide"><button type="button" class="chessDrawerClose" data-close-panel>✕ Fechar</button><div class="chessStatus">'+x(status())+'</div>'+proposal()+'<div class="chessRow"><button class="chessBtn" data-copy>Copiar convite</button><button class="secondary" data-refresh>Atualizar</button></div><p class="result" id="chess-info"></p><section class="section panel" style="padding:10px"><div class="row space"><h3 style="margin:6px">Jogadas</h3><span class="pill">'+(engine()?.history()?.length||0)+'</span></div>'+moveList()+(previewIndex!==null?'<button class="chessBtn" data-live>Voltar à partida</button>':"")+'</section>'+rivalryHtml()+(promo?'<div class="chessDecision"><p>Escolhe a promoção:</p><div class="chessPromotion">'+["q","r","b","n"].map(p=>'<button data-promotion="'+p+'">'+glyph[room.turn+p]+'</button>').join("")+'</div><button class="secondary" data-cancel-promo>Cancelar</button></div>':"")+'</aside></div></div>';
 root.querySelectorAll("[data-chess-panel]").forEach(btn=>btn.onclick=()=>{drawerOpen=true;draw();if(btn.dataset.chessPanel==="history"){const panel=document.querySelector(".chess-viewport .chessSide");if(panel)panel.scrollTop=panel.scrollHeight}});
 root.querySelectorAll("[data-close-panel]").forEach(btn=>btn.onclick=()=>{drawerOpen=false;draw()});
 root.querySelector("[data-back]").onclick=()=>nav("games");
 root.querySelector("[data-copy]").onclick=async()=>{try{await navigator.clipboard.writeText(uri());notice("Convite copiado!")}catch{notice("Partilha "+uri())}};
 root.querySelector("[data-refresh]").onclick=async()=>{await timeSync();await refresh();notice("Sincronizado")};
 root.querySelectorAll("[data-sq]").forEach(el=>el.onclick=()=>select(el.dataset.sq));
 root.querySelectorAll("[data-player-profile]").forEach(el=>el.onclick=()=>{if(el.dataset.playerProfile)window.EDGY_players?.openById(el.dataset.playerProfile)});
 root.querySelectorAll("[data-action]").forEach(el=>el.onclick=()=>doAction(el.dataset.action));
 root.querySelector("[data-resign]")?.addEventListener("click",()=>{confirmResign=true;draw()});
 root.querySelector("[data-cancel-resign]")?.addEventListener("click",()=>{confirmResign=false;draw()});
 root.querySelectorAll("[data-move]").forEach(el=>el.onclick=()=>reviewTo(Number(el.dataset.move)));
 root.querySelector("[data-first]")?.addEventListener("click",()=>reviewTo(0));
 root.querySelector("[data-prev]")?.addEventListener("click",()=>reviewStep(-1));
 root.querySelector("[data-next]")?.addEventListener("click",()=>reviewStep(1));
 root.querySelector("[data-last]")?.addEventListener("click",()=>reviewTo(engine()?.history()?.length||0));
 root.querySelectorAll("[data-live]").forEach(el=>el.onclick=()=>{previewIndex=null;draw()});
 root.querySelectorAll("[data-promotion]").forEach(el=>el.onclick=()=>{const p=promo;promo=null;send(p.from,p.to,el.dataset.promotion)});
 root.querySelector("[data-cancel-promo]")?.addEventListener("click",()=>{promo=null;draw()});
 // Move history is paginated: no inner scrollbar to move.
 clocks();
}
function select(sq){
 if(!room||room.status!=="active"||busy||promo||previewIndex!==null)return;
 const myColor=user()?.id===room.white_id?"w":user()?.id===room.black_id?"b":null;
 if(!myColor||myColor!==room.turn)return;
 const c=engine(),p=c.get(sq);
 if(selected){
  const hits=c.moves({square:selected,verbose:true}).filter(m=>m.to===sq);
  if(hits.length){if(hits.some(m=>m.promotion)){promo={from:selected,to:sq};draw();return}send(selected,sq);return}
 }
 selected=p?.color===myColor?sq:"";draw();
}
async function send(from,to,promotion){
 if(busy||!room)return;
 const original=room,c=engine(),color=room.turn;
 let move;try{move=c.move({from,to,...(promotion?{promotion}:{})})}catch{return}
 if(!move)return;
 busy=true;selected="";
 const elapsed=msLeft(color);
 room={...original,fen:c.fen(),pgn:c.pgn(),ply:original.ply+1,turn:c.turn(),last_move:from+to+(promotion||""),draw_offered_by:null,
  white_ms:color==="w"?elapsed+original.increment_ms:original.white_ms,
  black_ms:color==="b"?elapsed+original.increment_ms:original.black_ms,
  clock_started_at:new Date(serverNow()).toISOString(),
  status:c.isCheckmate()?(color==="w"?"white_win":"black_win"):c.isDraw()?"draw":"active"};
 const animation=animatedMove(original,room);
 draw();animation?.();notice("A confirmar jogada...");
 try{
  const {data,error}=await db().functions.invoke("chess-action",{body:{action:"move",code:original.code,from,to,...(promotion?{promotion}:{})}});
  if(error||data?.ok===false){
   let reason=data?.error||data?.reason||error?.message||"Jogada não guardada";
   if(error?.context?.json){try{const details=await error.context.json();reason=details?.error||details?.reason||reason}catch{}}
   room=original;draw();notice(reason);
  }else notice("");
 }catch(e){room=original;draw();notice("Falha de ligação. A sincronizar...")}
 finally{busy=false;refresh()}
}

document.addEventListener("keydown",e=>{if(game!=="chess"||!room||e.altKey||e.ctrlKey||e.metaKey||e.target?.closest?.("input,textarea,select"))return;
 if(e.key==="ArrowLeft"){e.preventDefault();reviewStep(-1)}if(e.key==="ArrowRight"){e.preventDefault();reviewStep(1)}});
window.EDGY_chess={open,close,render:draw};
const incoming=new URLSearchParams(location.search).get("room");
if(incoming&&/^[0-9a-f]{8}$/i.test(incoming)){game="chess";open(incoming)}
import("https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js").then(m=>{Chess=m.Chess;draw()}).catch(e=>{console.error("chess engine",e);engineError="Não foi possível carregar o motor de xadrez. Atualiza a página.";draw()});
})();