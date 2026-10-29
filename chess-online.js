(function(){
"use strict";
let Chess=null,room=null,players=null,channel=null,poller=null,selected="",promo=null,busy=false,pending="",engineError="",autoTried=false,clockTimer=null,previewIndex=null,confirmResign=false,timeBase=Date.now(),timeAt=performance.now(),lastCheck=0;
const glyph={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟︎"};
const x=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const auth=()=>window.EDGY_auth;
const db=()=>auth()?.getClient();
const user=()=>auth()?.getUser();
const notice=s=>{const el=document.getElementById("chess-info");if(el)el.textContent=s};
const css=document.createElement("style");
css.textContent='.chessWrap{max-width:720px;margin:auto}.chessBoard{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));width:100%;max-width:520px;margin:15px auto;border:3px solid #674674;border-radius:9px;overflow:hidden}.chessSq{aspect-ratio:1;min-width:0;padding:0;border:0;display:grid;place-items:center;position:relative;border-radius:0}.chessSq.light{background:#e0d2e8}.chessSq.dark{background:#69537d}.chessSq.active{box-shadow:inset 0 0 0 4px #ff0878}.chessSq.legal:after{content:"";position:absolute;background:#ff168b88;width:23%;height:23%;border-radius:50%;pointer-events:none}.chessGlyph{font-family:"Segoe UI Symbol","DejaVu Sans",serif;font-size:clamp(22px,7vw,47px);line-height:1;pointer-events:none}.chessGlyph.w{color:#fffdf6;text-shadow:1px 2px #241728,-1px -1px #241728}.chessGlyph.b{color:#23142f;text-shadow:1px 1px #e6d9f2}.chessRank{position:absolute;left:3px;top:2px;font-size:9px;pointer-events:none;color:#322044}.chessSq.dark .chessRank{color:#f0deee}.chessPlayers{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin:15px 0}.chessPlayer{background:#27203f;padding:13px;border-radius:12px;border:1px solid #57416b}.chessPlayer strong{display:block}.chessPlayer small{font-size:12px;color:#b6a7c5}.chessBtn{background:linear-gradient(115deg,#ff075c,#c300a7);color:#fff;border:0;border-radius:12px;padding:12px 16px;font-weight:800;min-height:44px}.chessInput{background:#151027;color:#fff;border:1px solid #655078;border-radius:11px;padding:13px;width:100%;font-weight:800;letter-spacing:2px;text-transform:uppercase}.chessRow{display:flex;gap:9px;flex-wrap:wrap;margin:15px 0}.chessRow>*{flex:1}.chessStatus{padding:13px;border-radius:12px;background:#292041;border:1px solid #563e66;color:#dfd2ed;line-height:1.5}.chessMoves{font-size:13px;line-height:1.8;color:#c8b6d9;max-height:120px;overflow:auto}.chessPromotion{display:flex;gap:8px;justify-content:center;padding:12px}.chessPromotion button{font-size:30px;border:1px solid #ab4d8f;border-radius:10px;background:#322246;color:#fff;padding:8px 12px}';
css.textContent+="\n.chessClockBox{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 13px;background:#2b2141;border:1px solid #504165;border-radius:13px;margin:9px 0;transition:background .2s,border-color .2s}\n.chessClockBox.turn{background:#4b2449;border-color:#ed2b8c}\n.chessClockName{font-size:13px;font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.chessClockHandle{font-size:11px;color:#bfb2d0;margin-top:3px}\n.chessClockTime{font-variant-numeric:tabular-nums;font-feature-settings:\"tnum\";font-size:23px;font-weight:850;background:#171129;border:1px solid #655477;padding:7px 10px;border-radius:10px;min-width:91px;text-align:center;color:#ded2ec}\n.chessClockBox.turn .chessClockTime{background:linear-gradient(115deg,#ff075c,#c300a7);border-color:transparent;color:#fff}\n.chessClockTime.urgent{background:#7b193f!important;animation:edgyTick .8s infinite alternate}\n@keyframes edgyTick{to{box-shadow:0 0 15px #ff15799b}}\n.chessControlSelect{display:flex;gap:8px;flex-wrap:wrap;margin:13px 0}\n.chessControlSelect button{flex:1;border:1px solid #5c4570;border-radius:10px;background:#322447;color:white;padding:12px;font-weight:700}\n.chessControlSelect button.active{background:#65315a;border-color:#ff3c96}\n.chessMovesGrid{max-height:250px;overflow:auto;display:grid;gap:4px;padding:8px}\n.chessMoveRow{display:grid;grid-template-columns:32px 1fr 1fr;align-items:center;gap:5px;padding:2px 5px;border-radius:7px}\n.chessMoveRow:nth-child(even){background:#ffffff08}\n.chessMoveIndex{font-size:12px;color:#9e8dac;text-align:center}\n.chessMoveButton{border:0;background:none;color:#eee5fa;text-align:left;border-radius:7px;padding:8px;font-size:13px;font-weight:700}\n.chessMoveButton.latest{background:#8e2567}\n.chessMoveButton.preview{outline:1px solid #ff5d9d}\n.chessMoveButton:hover{background:#5b335d}\n.chessLast{box-shadow:inset 0 0 0 4px #c83b8b73}\n.chessPieceFly{position:fixed;z-index:99;pointer-events:none;transition:transform .24s cubic-bezier(.18,.75,.25,1);display:grid;place-items:center}\n.chessDecision{margin:12px 0;border:1px solid #a75d8a;background:#472443;border-radius:12px;padding:13px}\n.chessDecision p{margin:0 0 10px;font-size:13px;color:#fbe1ee}\n.chessDecision button{margin:4px;font-size:12px}\n.chessReview{font-size:13px;color:#fba8d1;margin:9px 0;text-align:center}\n.chessMainGrid{display:grid;gap:16px}\n.chessSide{min-width:0}\n@media(min-width:860px){.chessWrap{max-width:1020px}.chessMainGrid{grid-template-columns:minmax(0,1fr) 300px;align-items:start}.chessSide{position:sticky;top:25px}.chessGlyph{font-size:clamp(28px,4vw,52px)}}\n@media(prefers-reduced-motion:reduce){.chessPieceFly,.chessClockTime{transition:none;animation:none!important}}\n";document.head.appendChild(css);
function clear(){if(clockTimer){clearInterval(clockTimer);clockTimer=null}previewIndex=null;confirmResign=false;if(channel){db()?.removeChannel(channel);channel=null}if(poller){clearInterval(poller);poller=null}room=null;players=null;selected="";promo=null}
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
function clockRow(color){
 const p=color==="w"?players?.white:players?.black;
 return '<div class="chessClockBox '+(room.status==="active"&&room.turn===color?"turn":"")+'"><div><div class="chessClockName">'+(color==="w"?"♙ ":"♟ ")+x(p?.name||(color==="w"?"Brancas":"À espera do adversário"))+'</div><div class="chessClockHandle">'+(p?"@"+x(p.username):"Código da sala")+'</div></div><div class="chessClockTime" data-clock="'+color+'">'+clockText(msLeft(color))+'</div></div>';
}
function resultsText(){
 const reason={timeout:"Tempo esgotado",resignation:"Desistência",agreement:"Acordo entre jogadores",checkmate:"Xeque-mate",rules:"Empate pelas regras"};
 return (room.status==="white_win"?"Vitória das brancas":room.status==="black_win"?"Vitória das pretas":"Empate")+" · "+(reason[room.finish_reason]||"Partida terminada");
}
function moveList(){
 const moves=engine()?.history()||[];
 let html='<div class="chessMovesGrid">';
 if(!moves.length)html+='<p class="sub" style="padding:10px">Ainda não há jogadas.</p>';
 for(let i=0;i<moves.length;i+=2){
  html+='<div class="chessMoveRow"><span class="chessMoveIndex">'+(i/2+1)+'.</span>';
  for(let j=i;j<Math.min(moves.length,i+2);j++)
   html+='<button data-move="'+(j+1)+'" class="chessMoveButton '+(j===moves.length-1?"latest ":"")+(previewIndex===j+1?"preview":"")+'">'+x(moves[j])+'</button>';
  if(i+1===moves.length)html+='<span></span>';
  html+='</div>';
 }
 return html+'</div>';
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

function open(code){clear();pending=String(code||"").toUpperCase();autoTried=false;draw()}
function engine(){if(!Chess)return null;const c=new Chess();if(room?.pgn)c.loadPgn(room.pgn);return c}
function uri(){const u=new URL(location.href);u.searchParams.set("room",room.code);return u.href}
function setUri(){history.replaceState(null,"",uri())}
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
 room=data;selected="";promo=null;previewIndex=null;setUri();await Promise.all([fetchPlayers(),timeSync()]);listen();draw();
}
async function fetchPlayers(){if(!room)return;const {data}=await db().rpc("edgy_chess_players",{p_code:room.code});if(data)players=data}
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
  room=data;selected="";promo=null;previewIndex=null;confirmResign=false;
  if(prev.black_id!==data.black_id)await fetchPlayers();
  draw();animate?.();if(finished)await auth()?.refreshProfile?.();
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
 const b=c.board(),mine=user()?.id===room.black_id?"b":"w";
 const rows=mine==="b"?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7],cols=mine==="b"?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];
 const targets=selected&&previewIndex===null?c.moves({square:selected,verbose:true}).map(m=>m.to):[];
 const latest=previewIndex===null&&room.last_move?[room.last_move.slice(0,2),room.last_move.slice(2,4)]:[];
 let out='<div class="chessBoard" aria-label="Tabuleiro">';
 for(const row of rows)for(const col of cols){
  const sq="abcdefgh"[col]+(8-row),p=b[row][col];
  out+='<button class="chessSq '+((row+col)%2?"dark":"light")+(sq===selected?" active":"")+(targets.includes(sq)?" legal":"")+(latest.includes(sq)?" chessLast":"")+'" data-sq="'+sq+'" aria-label="'+sq+'">'+(col===cols[0]?'<span class="chessRank">'+(8-row)+'</span>':"")+(p?'<span class="chessGlyph '+p.color+'">'+glyph[p.color+p.type]+'</span>':"")+'</button>';
 }
 return out+'</div>';
}
function draw(){
 const root=document.getElementById("screen");if(!root||game!=="chess")return;
 if(!room&&pending&&user()&&!busy&&!autoTried&&/^[A-F0-9]{8}$/.test(pending)){autoTried=true;queueMicrotask(()=>join(pending))}
 if(!Chess){root.innerHTML='<div class="chessWrap"><button class="back" data-back>← Jogos</button><h1>Xadrez online</h1><p class="sub">'+x(engineError||"A carregar as regras...")+'</p></div>';root.querySelector("[data-back]").onclick=()=>nav("games");return}
 if(!user()){root.innerHTML='<div class="chessWrap"><button class="back" data-back>← Jogos</button><h1>Xadrez online</h1><div class="panel">Entra como convidado ou com conta para jogar. <button class="chessBtn" data-auth>Entrar</button></div></div>';root.querySelector("[data-back]").onclick=()=>nav("games");root.querySelector("[data-auth]").onclick=()=>auth()?.showEntry();return}
 if(!room){
  root.innerHTML='<div class="chessWrap"><button class="back" data-back>← Jogos</button><h1>♞ Xadrez online</h1><p class="sub">Relógio por jogador, movimentos animados e partidas entre dois dispositivos.</p><div class="panel"><h3>Escolhe o ritmo</h3><div class="chessControlSelect"><button data-time="180,2">3+2</button><button data-time="300,0">5+0</button><button data-time="600,0" class="active">10+0</button><button data-time="900,10">15+10</button></div><button class="chessBtn" data-create>Criar sala privada</button></div><div class="section panel"><h3>Entrar numa sala</h3><input id="chessCode" class="chessInput" maxlength="8" placeholder="CÓDIGO" value="'+x(pending)+'"><button class="secondary" data-join style="margin-top:10px">Entrar na partida</button></div><p class="result" id="chess-info"></p></div>';
  let base=600,inc=0;
  root.querySelectorAll("[data-time]").forEach(b=>b.onclick=()=>{root.querySelectorAll("[data-time]").forEach(n=>n.classList.toggle("active",n===b));[base,inc]=b.dataset.time.split(",").map(Number)});
  root.querySelector("[data-create]").onclick=()=>create(base,inc);
  root.querySelector("[data-join]").onclick=()=>join(root.querySelector("#chessCode").value);
  root.querySelector("[data-back]").onclick=()=>nav("games");return;
 }
 const black=user()?.id===room.black_id,upper=black?"w":"b",lower=black?"b":"w",control=(room.base_ms/60000)+"+"+(room.increment_ms/1000);
 root.innerHTML='<div class="chessWrap"><button class="back" data-back>← Jogos</button><div class="row space"><h1>♞ Xadrez</h1><span class="pill">'+x(control)+' · '+x(room.code)+'</span></div><div class="chessMainGrid"><div>'+clockRow(upper)+board()+clockRow(lower)+(previewIndex!==null?'<div class="chessReview">A rever lance '+previewIndex+' <button class="chessBtn" data-live>Voltar ao jogo</button></div>':"")+'</div><aside class="chessSide"><div class="chessStatus">'+x(status())+'</div>'+proposal()+'<div class="chessRow"><button class="chessBtn" data-copy>Copiar convite</button><button class="secondary" data-refresh>Atualizar</button></div><p class="result" id="chess-info"></p><section class="section panel" style="padding:10px"><div class="row space"><h3 style="margin:6px">Jogadas</h3><span class="pill">'+(engine()?.history()?.length||0)+'</span></div>'+moveList()+(previewIndex!==null?'<button class="chessBtn" data-live>Voltar à partida</button>':"")+'</section>'+(promo?'<div class="chessDecision"><p>Escolhe a promoção:</p><div class="chessPromotion">'+["q","r","b","n"].map(p=>'<button data-promotion="'+p+'">'+glyph[room.turn+p]+'</button>').join("")+'</div><button class="secondary" data-cancel-promo>Cancelar</button></div>':"")+'</aside></div></div>';
 root.querySelector("[data-back]").onclick=()=>nav("games");
 root.querySelector("[data-copy]").onclick=async()=>{try{await navigator.clipboard.writeText(uri());notice("Convite copiado!")}catch{notice("Partilha "+uri())}};
 root.querySelector("[data-refresh]").onclick=async()=>{await timeSync();await refresh();notice("Sincronizado")};
 root.querySelectorAll("[data-sq]").forEach(el=>el.onclick=()=>select(el.dataset.sq));
 root.querySelectorAll("[data-action]").forEach(el=>el.onclick=()=>doAction(el.dataset.action));
 root.querySelector("[data-resign]")?.addEventListener("click",()=>{confirmResign=true;draw()});
 root.querySelector("[data-cancel-resign]")?.addEventListener("click",()=>{confirmResign=false;draw()});
 root.querySelectorAll("[data-move]").forEach(el=>el.onclick=()=>{previewIndex=Number(el.dataset.move);selected="";draw()});
 root.querySelectorAll("[data-live]").forEach(el=>el.onclick=()=>{previewIndex=null;draw()});
 root.querySelectorAll("[data-promotion]").forEach(el=>el.onclick=()=>{const p=promo;promo=null;send(p.from,p.to,el.dataset.promotion)});
 root.querySelector("[data-cancel-promo]")?.addEventListener("click",()=>{promo=null;draw()});
 const list=root.querySelector(".chessMovesGrid");if(list&&previewIndex===null)list.scrollTop=list.scrollHeight;
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
 if(busy||!room)return;busy=true;selected="";draw();notice("A guardar jogada...");
 try{
  const {data,error}=await db().functions.invoke("chess-action",{body:{action:"move",code:room.code,from,to,...(promotion?{promotion}:{})}});
  if(error||data?.ok===false)notice(data?.error||data?.reason||error?.message||"Jogada não guardada");
  else notice("");
 }catch(e){notice("Erro de ligação ao guardar jogada")}
 finally{busy=false;await refresh()}
}
window.EDGY_chess={open,close,render:draw};
const incoming=new URLSearchParams(location.search).get("room");
if(incoming&&/^[0-9a-f]{8}$/i.test(incoming)){game="chess";open(incoming)}
import("https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js").then(m=>{Chess=m.Chess;draw()}).catch(e=>{console.error("chess engine",e);engineError="Não foi possível carregar o motor de xadrez. Atualiza a página.";draw()});
})();