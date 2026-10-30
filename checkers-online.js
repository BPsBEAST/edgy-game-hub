(function(){
"use strict";
let rules=null,room=null,players=null,selected=[],busy=false,pending="",joined=false,channel=null,poll=null,rooms=[],info="",reviewStep=null,resultSeen=new Set();
const db=()=>window.EDGY_auth?.getClient(),user=()=>window.EDGY_auth?.getUser();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const style=document.createElement("style");
style.textContent=".ckWrap{max-width:950px;margin:auto}.ckHead{display:flex;align-items:center;gap:13px;margin:0 0 12px}.ckHead h1{margin:0;flex:1}.ckGrid{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:17px}.ckBoard{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));width:min(100%,calc(100dvh - 290px),505px);aspect-ratio:1;margin:8px auto;border:3px solid #6f4877;border-radius:11px;overflow:hidden;box-shadow:0 15px 40px #1008228c;touch-action:manipulation}.ckSquare{border:0;border-radius:0;aspect-ratio:1;position:relative;display:grid;place-items:center;min-width:0;padding:0;touch-action:manipulation;background:#dcd0e5}.ckSquare.dark{background:#766089}.ckSquare.last{box-shadow:inset 0 0 0 3px #ff80be8c}.ckSquare.sel{outline:3px solid #ff197f;outline-offset:-3px}.ckSquare.dest:after{content:'';width:23%;height:23%;border-radius:50%;background:#ff268ca8;position:absolute;pointer-events:none}.ckDisc{display:grid;place-items:center;position:relative;width:77%;height:77%;border-radius:50%;border:3px solid #490d4a;box-shadow:inset 0 4px 4px #ffffff55,inset 0 -5px 4px #11031d77,0 3px 2px #10091e9a;pointer-events:none}.ckDisc:before{content:'';position:absolute;inset:15%;border:2px solid #ffffff60;border-radius:50%}.ckDisc.w{background:linear-gradient(145deg,#ff87b7,#fa1980 56%,#b7006c);border-color:#83024d}.ckDisc.b{background:linear-gradient(145deg,#826394,#372449 60%,#20172b);border-color:#1d1129}.ckDisc.king:after{content:'♛';position:relative;font-size:clamp(15px,3.7vw,30px);color:#ffe5f3;text-shadow:0 1px 1px #3e1534}.ckP{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid #614974;background:#302441;border-radius:12px;padding:11px;margin:8px 0;font-size:13px}.ckP.turn{border-color:#ff368f}.ckP strong{font-size:14px}.ckSide{min-width:0}.ckPanel{border:1px solid #574064;border-radius:14px;padding:15px;background:#251d3c;margin:10px 0}.ckPanel h3{margin:0 0 9px}.ckPanel p{font-size:12px;color:#bdb0cf;line-height:1.5}.ckActions{display:flex;gap:8px;flex-wrap:wrap}.ckBtn{background:linear-gradient(115deg,#ff075c,#c300a7);border:0;border-radius:10px;color:white;padding:11px 14px;font-weight:800;min-height:42px}.ckAlt{background:#372946;border:1px solid #69547a;border-radius:10px;color:white;padding:11px 14px;font-weight:750;min-height:42px}.ckInput{padding:13px;background:#16112b;border:1px solid #70537c;border-radius:10px;color:white;text-transform:uppercase;letter-spacing:2px;max-width:100%;width:100%}.ckMove{display:flex;justify-content:space-between;font-size:12px;padding:7px 0;border-bottom:1px solid #49365b}.ckMessage{font-size:12px;color:#ffaccc;min-height:18px}.ckRooms{display:grid;gap:8px}.ckRoom{display:flex;gap:8px;align-items:center;justify-content:space-between;background:#332646;border-radius:9px;padding:9px;font-size:12px}@media(max-width:780px){.ckGrid{grid-template-columns:1fr}.ckBoard{width:min(100%,calc(100dvh - 325px),430px)}.ckSide{max-width:530px;width:100%;margin:auto}.ckHead h1{font-size:25px}}";
style.textContent+="\n/* EDGY minimal Damas: flat counters, quiet board, magenta only for game state */\n.ckBoard{border:2px solid #574263;border-radius:10px;box-shadow:0 7px 22px #0e0b1e55;gap:0;grid-template-rows:repeat(8,minmax(0,1fr));overflow:hidden}\n.ckSquare{min-height:0;height:100%;width:100%;aspect-ratio:auto;background:#ded5e5;overflow:hidden;line-height:0}\n.ckSquare.dark{background:#766187}\n.ckDisc{width:73%;height:73%;border-radius:50%;border:2px solid #8b6b99;background:#f8ecf6;box-shadow:0 2px 2px #24173155;transition:transform .15s ease}\n.ckDisc:before{content:\"\";position:absolute;inset:17%;border-radius:50%;border:1.7px solid currentColor;opacity:.30;box-shadow:none}\n.ckDisc.w{background:#f4e7f2;color:#bd8bae;border-color:#8d6798}\n.ckDisc.b{background:#32253f;color:#c4a4c9;border-color:#1d152b}\n.ckDisc.king:after{content:\"♛\";font-family:\"Segoe UI Symbol\",serif;font-size:clamp(14px,3.8vw,28px);font-weight:400;line-height:1;color:currentColor;text-shadow:none}\n.ckSquare.sel{outline:none;box-shadow:inset 0 0 0 3px #f22f91;z-index:1}\n.ckSquare.last{box-shadow:inset 0 0 0 2px #de8db799}\n.ckSquare.dest:after{width:20%;height:20%;background:#e1358ea0;box-shadow:none}\n.ckP.turn{border-color:#e14f9b}\n.ckP strong{font-weight:750}\n@media(prefers-reduced-motion:reduce){.ckDisc{transition:none}}\n";style.textContent+="\n/* v19 — quieter game feedback and a native EDGY confirmation instead of browser confirm */\n.ckSquare{transition:background-color .16s ease,box-shadow .16s ease}\n.ckSquare.dest::after{animation:ckDestination .24s ease-out both}\n.ckSquare.sel .ckDisc{transform:scale(1.09);filter:drop-shadow(0 0 5px #ff51a27c);animation:ckSelected .2s ease-out both}\n.ckSquare.dark:hover:not(.sel){background:#806c90}\n.ckSquare.light:hover:not(.sel){background:#e8ddec}\n.ckDisc{transition:transform .2s cubic-bezier(.18,.8,.24,1),filter .2s}\n.ckSquare:active .ckDisc{transform:scale(.96)}\n.ckP.turn{background:#3a2a4b;transition:background .2s,border-color .2s}\n.ckMove{animation:ckMoveIn .24s ease-out both}\n.ckBoard .ckCapturedPulse::after{content:\"\";position:absolute;inset:14%;border-radius:50%;border:2px solid #ec3e93;animation:ckCapture .43s ease-out both;pointer-events:none}\n.ckBoard .ckPromotionPulse .ckDisc{animation:ckCrown .48s cubic-bezier(.15,.8,.3,1.25)}\n.ckResignMask{position:fixed;inset:0;z-index:160;display:grid;place-items:center;background:#0e0a1bd8;backdrop-filter:blur(11px);padding:18px;animation:ckMaskEnter .18s ease both}\n.ckResignMask[hidden]{display:none!important}\n.ckResignDialog{width:min(100%,390px);padding:27px;background:#241c3c;border:1px solid #705173;border-radius:22px;box-shadow:0 25px 80px #07040ca8;animation:ckDialogEnter .28s cubic-bezier(.16,1,.3,1) both}\n.ckResignSymbol{width:52px;height:52px;display:grid;place-items:center;color:#ff96c3;background:#49304b;border-radius:15px;margin-bottom:17px}\n.ckResignDialog h2{font-size:24px;margin:0 0 10px;letter-spacing:-.5px}\n.ckResignDialog p{font-size:14px;color:#bdb0d0;line-height:1.6;margin:0 0 22px}\n.ckResignActions{display:flex;gap:9px;flex-wrap:wrap}\n.ckResignActions button{flex:1;min-width:130px;min-height:44px;font-size:13px;font-weight:800;padding:10px;border-radius:11px}\n.ckResignStay{background:#443250;border:1px solid #745c82;color:#fff}\n.ckResignStay:hover{background:#533c63}\n.ckResignConfirm{background:transparent;border:1px solid #bc4587;color:#ffa3c8}\n.ckResignConfirm:hover{background:#603451}\n.ckResignActions button:focus-visible{outline:2px solid #ff73bc;outline-offset:3px}\n@keyframes ckSelected{from{opacity:.8;transform:scale(.94)}to{opacity:1;transform:scale(1.09)}}\n@keyframes ckDestination{from{opacity:0;transform:scale(.25)}to{opacity:1;transform:scale(1)}}\n@keyframes ckCapture{0%{opacity:1;transform:scale(.5)}100%{opacity:0;transform:scale(1.25)}}\n@keyframes ckCrown{0%{transform:scale(.8)}55%{transform:scale(1.18)}100%{transform:scale(1)}}\n@keyframes ckMoveIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}\n@keyframes ckMaskEnter{from{opacity:0}to{opacity:1}}\n@keyframes ckDialogEnter{from{opacity:0;transform:translateY(18px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}\n@media(prefers-reduced-motion:reduce){\n .ckSquare,.ckDisc,.ckP.turn{transition:none!important}\n .ckSquare.dest::after,.ckSquare.sel .ckDisc,.ckMove,.ckBoard .ckCapturedPulse::after,.ckBoard .ckPromotionPulse .ckDisc,.ckResignMask,.ckResignDialog{animation:none!important}\n}\n";style.textContent+="\n.ckBoard{position:relative;isolation:isolate}\n.ckMoveGhost{position:absolute!important;z-index:5;pointer-events:none!important;will-change:transform}\n.ckResultMask{position:fixed;inset:0;z-index:170;display:grid;place-items:center;padding:18px;background:#0b071ce0;backdrop-filter:blur(14px);animation:ckMaskEnter .18s ease both}\n.ckResultMask[hidden]{display:none!important}\n.ckResultCard{width:min(100%,390px);border:1px solid #96508c;background:radial-gradient(circle at top,#4d2b53,#241b3e 70%);border-radius:23px;box-shadow:0 25px 80px #080316b3;text-align:center;padding:29px 24px;animation:ckDialogEnter .32s cubic-bezier(.16,1,.3,1) both}\n.ckResultIcon{font-size:55px;line-height:1.2}\n.ckResultCard h2{font-size:32px;line-height:1.2;margin:13px 0;letter-spacing:-1px}\n.ckResultCard p{font-size:13px;color:#d1c2de;line-height:1.6;margin:0 0 18px}\n.ckResultCard button{width:100%;min-height:43px;margin-top:8px;border-radius:11px;font-size:13px;font-weight:800}\n.ckResultContinue{background:linear-gradient(100deg,#ff075c,#c300a7);border:0;color:white}\n.ckResultReplay{background:#40304e;border:1px solid #856083;color:#fff}\n@media(prefers-reduced-motion:reduce){.ckResultMask,.ckResultCard{animation:none!important}}\n";style.textContent+="\n.ckHistoryControls{display:flex;gap:5px;align-items:center;margin:11px 0 8px;flex-wrap:wrap}\n.ckHistoryControls button{background:#352947;color:#eae0f1;border:1px solid #645072;border-radius:9px;min-width:37px;height:37px;flex:1;padding:3px 5px;font-size:15px;font-weight:750;touch-action:manipulation}\n.ckHistoryControls button:disabled{opacity:.35}\n.ckHistoryControls .ckLive{min-width:72px;font-size:12px;flex:1.5}\n.ckHistoryControls .ckLive.active{border-color:#fb4699;background:#57304d;color:#fff}\n.ckHistoryStep{font-size:11px;color:#b9a9cc;text-align:center;margin:4px 0 9px}\n.ckMoveHistory{max-height:260px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#665176 transparent;padding-right:3px}\n.ckMoveHistory button.ckMove{display:flex;align-items:center;justify-content:space-between;gap:7px;min-height:32px;width:100%;text-align:left;border:0;border-bottom:1px solid #483756;background:transparent;color:#dbcedf;border-radius:5px;padding:8px 5px;cursor:pointer}\n.ckMoveHistory button.ckMove:hover{background:#382849}\n.ckMoveHistory button.ckMove.active{background:#633052;color:#fff;box-shadow:inset 3px 0 #f64a9a}\n.ckReviewInfo{color:#ffb0d1;font-size:12px;line-height:1.5;margin:8px 0}\n@media(max-width:780px){.ckMoveHistory{max-height:220px}}\n";document.head.append(style);
const seat=()=>!room||!user()?null:room.white_id===user().id?"w":room.black_id===user().id?"b":null;
const state=()=>({board:room.board,turn:room.turn,ply:room.ply,status:room.status,history:room.moves||[],last:room.last_move||[],quiet:room.quiet||0});
const invitation=()=>{const u=new URL(location.href);u.searchParams.set("checkers",room.code);return u.href};

/* Accessible in-app confirmation, independent of redraws of the game. */
const resignModal=document.createElement("div");
resignModal.hidden=true;
resignModal.className="ckResignMask";
resignModal.setAttribute("aria-hidden","true");
resignModal.innerHTML='<section class="ckResignDialog" role="dialog" aria-modal="true" aria-labelledby="ck-resign-title" aria-describedby="ck-resign-text"><div class="ckResignSymbol" aria-hidden="true"><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4m0 1c4-3 6 3 14 0v10c-7 3-10-3-14 0"/></svg></div><h2 id="ck-resign-title">Desistir da partida?</h2><p id="ck-resign-text">Se desistires agora, a vitória será atribuída ao adversário e o resultado ficará registado no histórico.</p><div class="ckResignActions"><button type="button" class="ckResignStay" data-stay>Continuar a jogar</button><button type="button" class="ckResignConfirm" data-resign-yes>Sim, desistir</button></div></section>';
document.body.append(resignModal);
let returnFocus=null;
function closeResign(){
 if(resignModal.hidden)return;
 resignModal.hidden=true;resignModal.setAttribute("aria-hidden","true");
 if(returnFocus&&returnFocus.isConnected)returnFocus.focus();
 returnFocus=null;
}
function askResign(){
 if(!room||room.status!=="active"||busy)return;
 returnFocus=document.activeElement;
 resignModal.hidden=false;resignModal.setAttribute("aria-hidden","false");
 resignModal.querySelector("[data-stay]").focus();
}
resignModal.querySelector("[data-stay]").onclick=closeResign;
resignModal.querySelector("[data-resign-yes]").onclick=()=>{
 if(busy)return;
 closeResign();action("resign");
};
resignModal.addEventListener("click",event=>{if(event.target===resignModal)closeResign()});
document.addEventListener("keydown",event=>{
 if(resignModal.hidden)return;
 if(event.key==="Escape"){event.preventDefault();closeResign()}
 if(event.key==="Tab"){
  const list=Array.from(resignModal.querySelectorAll("button"));
  const ix=list.indexOf(document.activeElement);
  if((event.shiftKey&&ix===0)||(!event.shiftKey&&ix===list.length-1)){
   event.preventDefault();list[event.shiftKey?list.length-1:0].focus();
  }
 }
});



const resultModal=document.createElement("div");
resultModal.className="ckResultMask";resultModal.hidden=true;
resultModal.innerHTML='<section class="ckResultCard" role="dialog" aria-modal="true" aria-labelledby="ck-result-title"><div class="ckResultIcon" id="ck-result-icon" aria-hidden="true">🏆</div><h2 id="ck-result-title">Venceste!</h2><p id="ck-result-reason"></p><button type="button" class="ckResultContinue" data-result-close>Continuar</button><button type="button" class="ckResultReplay" data-result-replay>Rever partida</button></section>';
document.body.append(resultModal);
function closeResult(){resultModal.hidden=true}
resultModal.querySelector("[data-result-close]").onclick=closeResult;
resultModal.querySelector("[data-result-replay]").onclick=()=>{closeResult();historyJump(0)};
resultModal.addEventListener("click",event=>{if(event.target===resultModal)closeResult()});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!resultModal.hidden)closeResult()});
function showResult(){
 if(!room?.black_id||!seat()||!["white_win","black_win","draw"].includes(room.status)||resultSeen.has(room.id))return;
 resultSeen.add(room.id);
 const drawn=room.status==="draw",winner=!drawn&&room.status===(seat()==="w"?"white_win":"black_win");
 resultModal.querySelector("#ck-result-title").textContent=drawn?"Empate!":winner?"Venceste!":"Perdeste!";
 resultModal.querySelector("#ck-result-icon").textContent=drawn?"🤝":winner?"🏆":"♟";
 resultModal.querySelector("#ck-result-reason").textContent=room.finish_reason==="resignation"?"Partida terminada por desistência.":room.finish_reason==="no_progress"?"Empate por ausência de progresso.":room.finish_reason==="no_moves"?"O adversário ficou sem peças ou sem movimentos.":"A partida terminou.";
 resultModal.hidden=false;resultModal.querySelector("[data-result-close]").focus();
}

/* Motion based exclusively on the server-confirmed turn/path. */
let pieceFlight=null;
function stopPieceFlight(){
 const flight=pieceFlight;
 if(!flight)return;
 pieceFlight=null;
 try{flight.animation?.cancel()}catch{}
 flight.ghost?.remove();
 if(flight.landed?.isConnected)flight.landed.style.visibility="";
}
function animateMove(previous,current){
 stopPieceFlight();
 if(!previous||!current||current.ply<=previous.ply)return;
 if(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)return;
 const path=current.last_move;
 if(!Array.isArray(path)||path.length<2||path.some(i=>!Number.isInteger(i)||i<0||i>63))return;
 const chessboard=document.querySelector("#screen .ckBoard");
 if(!chessboard||!chessboard.isConnected)return;
 const cells=path.map(pos=>chessboard.querySelector('[data-cell="'+pos+'"]'));
 if(cells.some(cell=>!cell))return;
 const start=path[0],end=path[path.length-1],landing=cells[cells.length-1].querySelector(".ckDisc");
 if(!landing||!previous.board?.[start])return;
 const rect=landing.getBoundingClientRect();
 if(rect.width<1)return;
 const bounds=chessboard.getBoundingClientRect();
 const points=cells.map(cell=>{
  const r=cell.getBoundingClientRect();
  return {x:r.left-bounds.left-chessboard.clientLeft+r.width/2,
          y:r.top-bounds.top-chessboard.clientTop+r.height/2};
 });
 const clone=landing.cloneNode(true);
 if(previous.board[start]===previous.board[start].toLowerCase())clone.classList.remove("king");
 clone.classList.add("ckMoveGhost");
 clone.style.cssText="position:absolute;z-index:5;left:"+(points[0].x-rect.width/2)+"px;top:"+(points[0].y-rect.height/2)+"px;width:"+rect.width+"px;height:"+rect.height+"px;pointer-events:none;margin:0;will-change:transform;filter:drop-shadow(0 4px 4px #16092266)";
 landing.style.visibility="hidden";
 chessboard.append(clone);
 for(let i=0;i<64;i++){
  if(i!==start&&previous.board[i]&&!current.board[i]){
   const cell=chessboard.querySelector('[data-cell="'+i+'"]');
   if(cell){cell.classList.add("ckCapturedPulse");cell.addEventListener("animationend",()=>cell.classList.remove("ckCapturedPulse"),{once:true})}
  }
 }
 if(typeof clone.animate!=="function"){clone.remove();landing.style.visibility="";return}
 const keyframes=points.map((p,i)=>({
  offset:i/(points.length-1),
  transform:"translate("+(p.x-points[0].x)+"px,"+(p.y-points[0].y)+"px) scale("+(i===points.length-1?1:1.05)+")"
 }));
 const animation=clone.animate(keyframes,{duration:Math.min(850,290+(path.length-2)*180),easing:"ease-in-out",fill:"forwards"});
 const currentFlight={animation,ghost:clone,landed:landing};
 pieceFlight=currentFlight;
 const finish=()=>{
  if(pieceFlight!==currentFlight)return;
  clone.remove();landing.style.visibility="";
  if(previous.board[start]!==current.board[end]&&current.board[end]===current.board[end]?.toUpperCase()){
   cells[cells.length-1].classList.add("ckPromotionPulse");
   cells[cells.length-1].addEventListener("animationend",()=>cells[cells.length-1].classList.remove("ckPromotionPulse"),{once:true});
  }
  pieceFlight=null;
 };
 animation.onfinish=finish;
 animation.oncancel=finish;
}

function clear(){closeResult();closeResign();stopPieceFlight();reviewStep=null;if(poll)clearInterval(poll);poll=null;if(channel)db()?.removeChannel(channel);channel=null;room=null;players=null;selected=[]}
function close(){clear();const u=new URL(location.href);u.searchParams.delete("checkers");history.replaceState(null,"",u.pathname+u.search+u.hash)}
function open(code=""){clear();pending=String(code).toUpperCase();joined=false;rooms=[];draw();loadRooms()}
async function loadRooms(){if(!user()||!db())return;const uid=user().id;const {data}=await db().from("checkers_rooms").select("code,status,white_id").or("white_id.eq."+uid+",black_id.eq."+uid).in("status",["waiting","active","white_win","black_win","draw"]).order("created_at",{ascending:false}).limit(20);rooms=data||[];if(!room)draw()}
async function create(){if(busy)return;busy=true;const {data,error}=await db().rpc("edgy_checkers_create");busy=false;if(error){info=error.message;draw();return}await load(data)}
async function join(code){pending=String(code||"").trim().toUpperCase();if(!/^[A-F0-9]{8}$/.test(pending)){info="Código inválido";draw();return}if(busy)return;busy=true;const {data,error}=await db().rpc("edgy_checkers_join",{p_code:pending});busy=false;if(error){info=error.message;draw();return}await load(data)}
async function load(code){const {data,error}=await db().from("checkers_rooms").select("*").eq("code",code).maybeSingle();if(error||!data){info=error?.message||"Sala não encontrada";draw();return}room=data;selected=[];reviewStep=null;history.replaceState(null,"",invitation());await loadPlayers();subscribe();draw();showResult()}
async function loadPlayers(){const {data}=await db().rpc("edgy_checkers_players",{p_code:room.code});players=data}
function subscribe(){if(channel)db().removeChannel(channel);if(poll)clearInterval(poll);channel=db().channel("checkers-"+room.id).on("postgres_changes",{event:"UPDATE",schema:"public",table:"checkers_rooms",filter:"id=eq."+room.id},()=>refresh()).subscribe();poll=setInterval(()=>{if(room&&game==="checkers")refresh()},3000)}
async function refresh(){if(!room||busy)return;const old=room,{data}=await db().from("checkers_rooms").select("*").eq("id",room.id).maybeSingle();if(!data)return;if(data.ply!==old.ply||data.status!==old.status||data.black_id!==old.black_id){room=data;selected=[];if(data.black_id!==old.black_id)await loadPlayers();draw();
 if(reviewStep===null)animateMove(old,data);
 if(old.status==="active"&&data.status!=="active"){
  if(pieceFlight?.animation)pieceFlight.animation.finished.then(()=>showResult()).catch(()=>showResult());
  else showResult();
  await window.EDGY_auth?.refreshProfile?.();
 }}}

/* Recorded paths reconstruct historical positions without revalidating under
   current rules. Older games played before rule changes remain reviewable. */
function recordedBoard(step){
 const moves=Array.isArray(room?.moves)?room.moves:[];
 if(step>=moves.length)return room.board;
 const board=rules.initialState().board.slice();
 for(let n=0;n<Math.max(0,step);n++){
  const move=moves[n],path=Array.isArray(move?.path)?move.path:[];
  if(path.length<2||path.some(i=>!Number.isInteger(i)||i<0||i>63))return room.board;
  let from=path[0],piece=board[from];if(!piece)return room.board;
  const team=piece.toLowerCase();
  for(let j=1;j<path.length;j++){
   const dest=path[j],dr=Math.sign(Math.floor(dest/8)-Math.floor(from/8)),dc=Math.sign(dest%8-from%8);
   if(!dr||!dc||Math.abs(Math.floor(dest/8)-Math.floor(from/8))!==Math.abs(dest%8-from%8))return room.board;
   let r=Math.floor(from/8)+dr,c=from%8+dc;
   while(r!==Math.floor(dest/8)||c!==dest%8){
    const i=r*8+c;
    if(board[i]&&board[i].toLowerCase()!==team)board[i]=null;
    r+=dr;c+=dc;
   }
   board[from]=null;board[dest]=piece;from=dest;
  }
  if(move.promoted||(piece==="w"&&Math.floor(from/8)===0)||(piece==="b"&&Math.floor(from/8)===7))board[from]=piece.toUpperCase();
 }
 return board;
}
function shownBoard(){
 return reviewStep===null?room.board:recordedBoard(reviewStep);
}
function historyJump(step){
 if(!room)return;
 const moves=Array.isArray(room.moves)?room.moves:[];
 reviewStep=Math.min(moves.length,Math.max(0,step));
 selected=[];draw();
}
function liveGame(){reviewStep=null;selected=[];draw()}
function historyMarkup(){
 const moves=Array.isArray(room.moves)?room.moves:[];
 const at=reviewStep===null?moves.length:reviewStep;
 const btn=(key,title,content,disabled=false)=>'<button type="button" data-history-'+key+' aria-label="'+title+'" '+(disabled?'disabled':'')+'>'+content+'</button>';
 const controls='<div class="ckHistoryControls">'+btn("first","Primeira posição","⏮",at===0)+btn("back","Anterior","◀",at===0)+btn("next","Seguinte","▶",at===moves.length)+btn("last","Última posição","⏭",at===moves.length)+'<button type="button" class="ckLive '+(reviewStep===null?'active':'')+'" data-history-live>Ao vivo</button></div>';
 const lines=moves.length?'<div class="ckMoveHistory">'+moves.map((m,i)=>{
  const squares=Array.isArray(m.path)?m.path:[];
  const path=squares.map(pos=>"abcdefgh"[pos%8]+(8-Math.floor(pos/8))).join(m.captures?" × ":" → ");
  return '<button type="button" class="ckMove '+(at===i+1?'active':'')+'" data-history-step="'+(i+1)+'"><span>'+(i+1)+'. '+esc(path)+'</span><span>'+(m.promoted?'♛ ':'')+(m.captures?'×'+m.captures:'')+'</span></button>';
 }).join("")+'</div>':'<p>Nenhuma jogada.</p>';
 return controls+'<div class="ckHistoryStep">Posição '+at+' de '+moves.length+(reviewStep===null?' · ao vivo':' · revisão')+'</div>'+lines;
}
function bindHistory(el){
 const at=()=>reviewStep===null?(room.moves||[]).length:reviewStep;
 el.querySelector("[data-history-first]")?.addEventListener("click",()=>historyJump(0));
 el.querySelector("[data-history-back]")?.addEventListener("click",()=>historyJump(at()-1));
 el.querySelector("[data-history-next]")?.addEventListener("click",()=>historyJump(at()+1));
 el.querySelector("[data-history-last]")?.addEventListener("click",()=>historyJump((room.moves||[]).length));
 el.querySelector("[data-history-live]")?.addEventListener("click",liveGame);
 el.querySelectorAll("[data-history-step]").forEach(b=>b.onclick=()=>historyJump(Number(b.dataset.historyStep)));
 const active=el.querySelector(".ckMoveHistory .ckMove.active");
 if(active){
  const list=active.closest(".ckMoveHistory");
  if(list){
   const item=active.getBoundingClientRect(),container=list.getBoundingClientRect();
   if(item.top<container.top)list.scrollTop-=container.top-item.top;
   else if(item.bottom>container.bottom)list.scrollTop+=item.bottom-container.bottom;
  }
 }
}

function board(){const mine=seat(),flip=mine==="b",rr=flip?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7],cc=flip?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];const moves=room.status==="active"?rules.legalMoves(state()):[];const next=selected.length?[...new Set(moves.filter(m=>selected.every((v,i)=>m.path[i]===v)).map(m=>m.path[selected.length]).filter(v=>v!==undefined))]:[];const pieces=reviewStep!==null?recordedBoard(reviewStep):selected.length>1?rules.preview(state(),selected):room.board;let h='<div class="ckBoard">';for(const r of rr)for(const c of cc){let i=r*8+c,p=pieces[i];h+='<button class="ckSquare '+((r+c)%2?"dark":"light")+(next.includes(i)?" dest":"")+(selected.at(-1)===i?" sel":"")+((reviewStep===null?room.last_move:room.moves?.[reviewStep-1]?.path)?.includes(i)?" last":"")+'" data-cell="'+i+'" aria-label="Casa '+(r+1)+','+(c+1)+'">'+(p?'<span class="ckDisc '+p.toLowerCase()+(p===p.toUpperCase()?" king":"")+'"></span>':"")+'</button>'}return h+"</div>"}
function choose(i){if(reviewStep!==null||busy||room.status!=="active"||seat()!==room.turn)return;const moves=rules.legalMoves(state());if(!selected.length){if(moves.some(m=>m.path[0]===i)){selected=[i];draw()}return}if(selected.length===1&&selected[0]===i){selected=[];draw();return}const candidates=moves.filter(m=>selected.every((p,j)=>m.path[j]===p)&&m.path[selected.length]===i);if(candidates.length){selected.push(i);if(candidates.some(m=>m.path.length===selected.length)){const path=selected.slice();selected=[];send(path)}else draw();return}if(selected.length===1&&room.board[i]?.toLowerCase()===seat()&&moves.some(m=>m.path[0]===i)){selected=[i];draw()}}
async function action(action,path){if(busy)return;busy=true;info="A confirmar…";draw();try{const {data,error}=await db().functions.invoke("checkers-action",{body:{action,code:room.code,...(path?{path}:{})}});if(error||!data?.ok){info=data?.error||error?.message||"Não foi possível guardar a jogada";if(error?.context?.json)try{info=(await error.context.json()).error||info}catch{}}else info=""}catch{info="Falha de ligação"}finally{busy=false;const beforePly=room?.ply;await refresh();if(room?.ply===beforePly)draw()}}
const send=path=>action("move",path);
async function cancel(code){const {data,error}=await db().rpc("edgy_checkers_cancel",{p_code:code});info=error?.message||(!data?"A sala já foi iniciada":"Sala fechada");await loadRooms()}
function player(color){const p=color==="w"?players?.white:players?.black;return '<div class="ckP '+(room.turn===color&&room.status==="active"?"turn":"")+'"><strong>'+(color==="w"?"🔴 ":"⚫ ")+esc(p?.name||(color==="w"?"Rosas":"À espera de adversário"))+'</strong><small>'+(shownBoard().filter(v=>v?.toLowerCase()===color).length)+' peças</small></div>'}
function draw(){const el=document.getElementById("screen");if(!el||game!=="checkers")return;stopPieceFlight();if(!rules){el.innerHTML='<h2>Damas</h2><p class="sub">A carregar regras…</p>';return}if(!user()){el.innerHTML='<button class="back" data-back>← Jogos</button><h1>Damas</h1><p>Entra para jogar online.</p><button class="ckBtn" data-login>Entrar</button>';el.querySelector("[data-back]").onclick=()=>nav("games");el.querySelector("[data-login]").onclick=()=>window.EDGY_auth?.showEntry();return}if(!room&&pending&&!joined){joined=true;queueMicrotask(()=>join(pending))}const head='<div class="ckHead"><button class="ckAlt" data-back>← Jogos</button><h1>◉ Damas</h1>'+(room?'<span class="pill">'+esc(room.code)+'</span>':"")+'</div>';if(!room){el.innerHTML='<div class="ckWrap">'+head+'<p class="sub">8×8 · Captura só para a frente · Dama voadora · Captura obrigatória</p><div class="ckPanel"><h3>Criar partida online</h3><p>Cria uma sala privada para jogares com um amigo.</p><button class="ckBtn" data-create>Criar sala</button></div><div class="ckPanel"><h3>Entrar numa sala</h3><input class="ckInput" id="ck-code" maxlength="8" placeholder="CÓDIGO" value="'+esc(pending)+'"><button class="ckAlt" data-join style="margin-top:9px">Entrar</button></div><div class="ckPanel"><h3>As tuas salas</h3><div class="ckRooms">'+(rooms.length?rooms.map(r=>'<div class="ckRoom"><span>'+esc(r.code)+' · '+(r.status==="waiting"?"Em espera":r.status==="active"?"A jogar":"Terminada")+'</span><span><button class="ckAlt" data-resume="'+esc(r.code)+'">'+(["white_win","black_win","draw"].includes(r.status)?"Rever":"Abrir")+'</button>'+(r.status==="waiting"&&r.white_id===user().id?'<button class="ckAlt" data-cancel="'+esc(r.code)+'">Fechar</button>':"")+'</span></div>').join(""):'<p>Não tens salas abertas.</p>')+'</div></div><p class="ckMessage">'+esc(info)+'</p></div>';el.querySelector("[data-back]").onclick=()=>nav("games");el.querySelector("[data-create]").onclick=create;el.querySelector("[data-join]").onclick=()=>join(el.querySelector("#ck-code").value);el.querySelectorAll("[data-resume]").forEach(b=>b.onclick=()=>load(b.dataset.resume));el.querySelectorAll("[data-cancel]").forEach(b=>b.onclick=()=>cancel(b.dataset.cancel));return}
const mine=seat(),top=mine==="b"?"w":"b",bottom=mine==="b"?"b":"w";let status=room.status==="waiting"?"À espera do adversário. Partilha o convite.":room.status==="active"?(mine===room.turn?"A tua vez":"Vez do adversário"):room.status==="draw"?"Empate!":room.status===(mine==="w"?"white_win":"black_win")?"Venceste!":"Perdeste!";
if(reviewStep!==null)status="A rever jogadas · volta ao vivo para continuar a jogar";
const hist=Array.isArray(room.moves)?room.moves:[];
el.innerHTML='<div class="ckWrap">'+head+'<div class="ckGrid"><div>'+player(top)+board()+player(bottom)+'</div><aside class="ckSide"><div class="ckPanel"><strong>'+status+'</strong><div class="ckActions" style="margin-top:12px"><button class="ckBtn" data-copy>Copiar convite</button><button class="ckAlt" data-refresh>Atualizar</button></div>'+(room.status==="active"?'<button class="ckAlt" style="margin-top:9px;width:100%" data-resign>Desistir</button>':"")+'</div><div class="ckPanel"><h3>Jogadas</h3>'+historyMarkup()+'</div><p class="sub">'+(room.status==="active"&&rules.legalMoves(state()).some(m=>m.captures.length)?"Captura obrigatória! Escolhe a sequência que come mais peças.":"Peças normais capturam só para a frente. Damas capturam nos dois sentidos. Captura obrigatória.")+'</p><p class="ckMessage">'+esc(info)+'</p></aside></div></div>';bindHistory(el);el.querySelector("[data-back]").onclick=()=>nav("games");el.querySelectorAll("[data-cell]").forEach(b=>b.onclick=()=>choose(Number(b.dataset.cell)));el.querySelector("[data-copy]").onclick=async()=>{try{await navigator.clipboard.writeText(invitation());info="Convite copiado!"}catch{info=invitation()}draw()};el.querySelector("[data-refresh]").onclick=refresh;el.querySelector("[data-resign]")?.addEventListener("click",askResign)}
window.EDGY_checkers={open,close,render:draw};
const incoming=new URLSearchParams(location.search).get("checkers");if(incoming&&/^[A-Fa-f0-9]{8}$/.test(incoming)){game="checkers";open(incoming)}
import("./checkers-rules.js?v=19").then(m=>{rules=m;draw()}).catch(e=>{console.error("Damas:",e);const target=document.getElementById("screen");if(game==="checkers"&&target)target.textContent="Erro ao carregar as regras. Atualiza a página."});
})();