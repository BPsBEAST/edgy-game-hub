/* EDGY online Tic Tac Toe — moves are validated atomically by Postgres. */
(function(){
"use strict";
let room=null,players=null,pending="",busy=false,notice="",channel=null,poller=null,epoch=0,review=null;
const shown=new Set();
const api=()=>window.EDGY_auth?.getClient?.(),me=()=>window.EDGY_auth?.getUser?.();
const ui=window.EDGY_platform.createResult({game:"tic",primaryLabel:"Continuar",secondaryLabel:"Rever jogadas",onSecondary:()=>{review=0;render()}});
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function clean(){
 epoch++;if(channel){api()?.removeChannel(channel);channel=null}
 if(poller){clearInterval(poller);poller=null}
 ui.hide();room=null;players=null;busy=false;notice="";review=null;
}
function close(){
 clean();
 const url=new URL(location.href);url.searchParams.delete("tic");
 history.replaceState(null,"",url.pathname+url.search+url.hash);
}
function open(code=""){clean();pending=String(code||"").trim().toUpperCase();render();if(pending)join(pending)}
function urlSet(){
 const u=new URL(location.href);u.searchParams.set("tic",room.code);
 history.replaceState(null,"",u.pathname+u.search+u.hash);
}
function seat(){const id=me()?.id;return id===room?.white_id?"X":id===room?.black_id?"O":null}
function stateText(){
 if(!room)return"";
 if(room.status==="waiting")return"À espera de adversário. Partilha o convite.";
 if(room.status==="active")return room.turn===seat()?"É a tua vez":"Vez do adversário";
 if(room.status==="draw")return"Empate";
 if(room.status==="cancelled")return"Sala encerrada";
 return room.status===(seat()==="X"?"white_win":"black_win")?"Venceste!":"Perdeste!";
}
function resultMessage(){
 if(!room)return"";
 return room.finish_reason==="resignation"?"Partida terminada por desistência."
 :room.finish_reason==="line"?"Três símbolos em linha.":"O tabuleiro ficou completo.";
}
function maybeResult(){
 if(!room||!seat()||!["white_win","black_win","draw"].includes(room.status)||shown.has(room.id))return;
 shown.add(room.id);
 const win=room.status===(seat()==="X"?"white_win":"black_win");
 ui.show({outcome:room.status==="draw"?"draw":win?"win":"loss",reason:resultMessage()});
}
async function names(){
 if(!room||!api())return;
 const id=room.id;
 try{
  const {data,error}=await window.EDGY_platform.rooms.players("tic",room.code);
  if(error)throw error;
  if(room?.id===id)players={X:data?.X?{name:data.X.name,username:data.X.username,avatar:data.X.avatar}:null,
    O:data?.O?{name:data.O.name,username:data.O.username,avatar:data.O.avatar}:null};
 }catch(e){console.warn("EDGY Tic player labels",e)}
}
function listen(){
 if(channel)api()?.removeChannel(channel);
 if(poller)clearInterval(poller);
 const id=room.id;
 channel=api().channel("edgy-tic-"+id).on("postgres_changes",{event:"UPDATE",schema:"public",table:"tic_rooms",filter:"id=eq."+id},()=>refresh()).subscribe();
 poller=setInterval(()=>{if(game==="tic"&&room&&document.visibilityState!=="hidden")refresh()},2400);
}
async function load(code){
 const ticket=epoch;const {data,error}=await window.EDGY_platform.rooms.load("tic",code);
 if(ticket!==epoch)return;
 if(error||!data){notice=error?.message||"Sala indisponível";render();return}
 room=data;pending=room.code;review=null;urlSet();await names();if(ticket!==epoch)return;
 listen();render();maybeResult();
}
async function refresh(){
 if(!room||busy||!api())return;
 const ticket=epoch,code=room.code,old=room;
 try{
  const {data,error}=await window.EDGY_platform.rooms.load("tic",code);
  if(error||!data||ticket!==epoch)return;
  const changed=old.updated_at!==data.updated_at||old.status!==data.status||old.ply!==data.ply;
  room=data;
  if(changed){
   if(old.black_id!==data.black_id)await names();
   if(ticket!==epoch)return;
   render();maybeResult();
   if(old.status==="active"&&room.status!=="active")window.EDGY_auth?.refreshProfile?.();
  }
 }catch(e){console.warn("EDGY Tic refresh",e)}
}
async function create(){
 if(busy||!api())return;busy=true;notice="A criar sala…";render();
 try{
  const {data,error}=await window.EDGY_platform.rooms.create("tic");
  if(error)throw error;
  busy=false;notice="";await load(data);
 }catch(e){busy=false;notice=e.message||"Erro ao criar sala";render()}
}
async function join(code){
 if(busy||!api())return;
 try{code=window.EDGY_platform.code(code)}catch(e){notice=e.message;render();return}
 busy=true;notice="A entrar na sala…";render();
 try{
  const {data,error}=await window.EDGY_platform.rooms.join("tic",code);
  if(error)throw error;busy=false;notice="";await load(data);
 }catch(e){busy=false;notice=e.message||"Não foi possível entrar";render()}
}
async function move(cell){
 if(!room||busy||room.status!=="active"||seat()!==room.turn||room.board[cell]!=="-"||review!==null)return;
 busy=true;notice="A confirmar jogada…";
 try{
  const {error}=await api().rpc("edgy_tic_move",{p_code:room.code,p_cell:cell,p_expected_ply:room.ply});
  if(error)throw error;notice="";
 }catch(e){notice=e.message||"Falha ao guardar a jogada"}
 finally{busy=false;await refresh();render()}
}
async function resign(){
 if(!room||busy||room.status!=="active")return;
 const ok=await window.EDGY_platform.confirmAction({
  title:"Desistir da partida?",message:"Se desistires, a vitória será atribuída ao adversário.",
  confirmLabel:"Sim, desistir",cancelLabel:"Continuar a jogar"
 });
 if(!ok)return;
 busy=true;try{
  const {error}=await api().rpc("edgy_tic_resign",{p_code:room.code});
  if(error)throw error;notice="";
 }catch(e){notice=e.message||"Não foi possível desistir"}
 finally{busy=false;await refresh();render()}
}
async function cancel(){
 if(!room||busy||room.status!=="waiting"||room.white_id!==me()?.id)return;
 busy=true;try{
  const {data,error}=await window.EDGY_platform.rooms.cancel("tic",room.code);
  if(error||!data)throw error||new Error("Não foi possível fechar a sala");
  close();render();
 }catch(e){busy=false;notice=e.message||"Não foi possível fechar a sala";render()}
}
function boardAt(n){
 if(n===null||!room)return room?.board||"---------";
 const cells=Array(9).fill("-"),moves=Array.isArray(room.moves)?room.moves:[];
 for(const m of moves.slice(0,n))if(Number.isInteger(m.cell)&&m.cell>=0&&m.cell<9)cells[m.cell]=m.mark;
 return cells.join("");
}
function player(mark){
 const p=players?.[mark],name=p?.display_name||p?.name||(mark==="X"?"Jogador X":"À espera do adversário");
 const active=room?.turn===mark&&room?.status==="active";
 return '<div class="edgyTicPlayer '+(active?"active":"")+'"><span class="edgyTicPlayerMark">'+mark+'</span><div><strong>'+esc(name)+'</strong><small>'+(mark===seat()?"Tu":mark==="X"?"Primeiro jogador":"Segundo jogador")+'</small></div></div>';
}
function render(){
 const root=document.getElementById("screen");if(!root||game!=="tic")return;
 root.classList.toggle("edgyLobby",!room);
 const top='<div class="edgyTicTitle"><button type="button" class="back" data-back>← Jogos</button><h1>Jogo do Galo</h1></div>';
 if(!api()||!me()){
  root.innerHTML=top+'<section class="panel"><p>Inicia sessão, mesmo como convidado, para jogar online.</p><button class="primary" data-auth>Entrar</button></section>';
  root.querySelector("[data-auth]").onclick=()=>window.EDGY_auth?.showEntry();root.querySelector("[data-back]").onclick=()=>nav("games");return;
 }
 if(!room){
  root.innerHTML='<div class="edgyTicWrap">'+top+'<p class="sub">Joga online com outra pessoa, em dois dispositivos, ou escolhe o modo local.</p>'
   +'<div class="panel edgyTicLobby"><h3>Nova partida online</h3><p class="sub">Cria uma sala privada e convida um amigo.</p><button class="primary" data-create '+(busy?"disabled":"")+'>Criar sala privada</button></div>'
   +'<div class="panel edgyTicLobby"><h3>Entrar numa sala</h3><input class="field edgyTicCode" id="tic-code" maxlength="8" placeholder="CÓDIGO" autocomplete="off" aria-label="Código da sala" value="'+esc(pending)+'"><button class="secondary" data-join '+(busy?"disabled":"")+'>Entrar na partida</button></div>'
   +'<div class="panel edgyTicLobby"><h3>Jogar neste dispositivo</h3><p class="sub">Contra o computador ou com duas pessoas no mesmo ecrã.</p><button class="secondary" data-local>Modo local</button></div>'
   +(notice?'<p class="edgyTicNotice" role="status">'+esc(notice)+'</p>':'')+'</div>';
  root.querySelector("[data-create]").onclick=create;
  root.querySelector("[data-join]").onclick=()=>join(root.querySelector("#tic-code").value);
  root.querySelector("#tic-code").onkeydown=e=>{if(e.key==="Enter")join(e.target.value)};
  root.querySelector("[data-local]").onclick=()=>window.EDGY_ticLocal?.();
  root.querySelector("[data-back]").onclick=()=>nav("games");return;
 }
 const currentBoard=boardAt(review),canMove=room.status==="active"&&room.turn===seat()&&!busy&&review===null;
 const cells=[...currentBoard].map((v,i)=>{
  const label="Casa "+(i+1)+(v!=="-"?", "+v:"");
  return '<button type="button" class="edgyTicCell '+(v!=="-"?"marked "+v.toLowerCase():"")+'" data-cell="'+i+'" aria-label="'+label+'" '+(!canMove||v!=="-"?"disabled":"")+'>'+ (v==="-"?"":'<span>'+v+'</span>')+'</button>';
 }).join("");
 const moves=Array.isArray(room.moves)?room.moves:[];
 root.innerHTML='<div class="edgyTicWrap">'+top
 +'<div class="edgyTicGame"><div class="edgyTicLeft">'+player("O")
 +'<div class="edgyTicBoard" role="group" aria-label="Tabuleiro de jogo do galo">'+cells+'</div>'
 +player("X")+'</div><aside class="edgyTicSide"><div class="panel"><span class="pill">'+esc(room.code)+'</span><h3>'+esc(stateText())+'</h3>'
 +'<p class="sub">'+(review!==null?"A rever os movimentos.":room.status==="active"?"Símbolo: "+esc(seat()||"—"):"")+'</p>'
 +'<div class="edgyTicActions"><button type="button" class="primary" data-copy>Copiar convite</button>'
 +(room.status==="waiting"&&room.white_id===me()?.id?'<button type="button" class="secondary" data-invite>Convidar jogador</button><button type="button" class="secondary" data-cancel>Fechar sala</button>':"")
 +(room.status==="active"?'<button type="button" class="secondary" data-resign>Desistir</button>':"")
 +'<button type="button" class="secondary" data-refresh>Atualizar</button></div></div>'
 +'<div class="panel"><h3>Movimentos</h3><div class="edgyTicReview"><button data-step="0" aria-label="Início">⏮</button><button data-step="back" aria-label="Anterior">◀</button><button data-step="next" aria-label="Próximo">▶</button><button data-step="live" aria-label="Ao vivo">⏭</button></div>'
 +'<p class="sub">'+(review===null?"Ao vivo":"Jogada "+review+" de "+moves.length)+'</p>'
 +'<ol class="edgyTicMoves">'+(moves.length?moves.map((m,i)=>'<li>'+(i+1)+'. '+esc(m.mark)+' → '+(m.cell+1)+'</li>').join(""):'<li>Sem jogadas.</li>')+'</ol></div></aside></div>'
 +(notice?'<p class="edgyTicNotice" role="status">'+esc(notice)+'</p>':'')+'</div>';
 root.querySelector("[data-back]").onclick=()=>nav("games");
 root.querySelectorAll("[data-cell]").forEach(b=>b.onclick=()=>move(Number(b.dataset.cell)));
 root.querySelector("[data-copy]").onclick=async()=>{
  const u=new URL(location.href);u.searchParams.delete("room");u.searchParams.delete("checkers");u.searchParams.set("tic",room.code);
  try{await navigator.clipboard.writeText(u.href);notice="Convite copiado!";render()}catch{notice="Link: "+u.href;render()}
 };
 root.querySelector("[data-refresh]").onclick=refresh;
 root.querySelector("[data-invite]")?.addEventListener("click",()=>window.EDGY_social?.openInvite("tic",room.code));
 root.querySelector("[data-resign]")?.addEventListener("click",resign);
 root.querySelector("[data-cancel]")?.addEventListener("click",cancel);
 root.querySelectorAll("[data-step]").forEach(b=>b.onclick=()=>{
  const action=b.dataset.step,count=moves.length,pos=review===null?count:review;
  review=action==="live"?null:action==="0"?0:action==="back"?Math.max(0,pos-1):pos+1>=count?null:pos+1;
  render();
 });
}
window.EDGY_ticOnline={open,close,render,refresh};
const incoming=new URLSearchParams(location.search).get("tic");
if(incoming&&/^[A-Fa-f0-9]{8}$/.test(incoming)){game="tic";open(incoming)}
})();
