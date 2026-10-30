(function(){
"use strict";
const db=()=>window.EDGY_auth?.getClient(),me=()=>window.EDGY_auth?.getUser();
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const gameName=g=>g==="chess"?"Xadrez":"Damas";
const statusName=s=>({waiting:"À espera",active:"Em curso",white_win:"Terminada",black_win:"Terminada",draw:"Empate"}[s]||s);
let inbox=[],loading=false,currentUser="",modalMode="",roomGame="",roomCode="",request=0,debounce=null,working=false;
const modal=document.createElement("div");modal.className="edgySocialOverlay";modal.hidden=true;
modal.innerHTML='<section class="edgySocialDialog" role="dialog" aria-modal="true" aria-labelledby="edgy-social-title"><header class="edgySocialHead"><div><h2 id="edgy-social-title"></h2><p id="edgy-social-subtitle"></p></div><button class="edgySocialAlt" data-close>✕</button></header><div id="edgy-social-body"></div><p class="edgySocialFeedback" id="edgy-social-feedback" role="status"></p></section>';
document.body.append(modal);
const $=q=>modal.querySelector(q),msg=s=>{$("#edgy-social-feedback").textContent=s||""};
function close(){modal.hidden=true;modalMode=""}
modal.querySelector("[data-close]").onclick=close;
modal.onclick=e=>{if(e.target===modal)close()};
document.addEventListener("keydown",e=>{if(!modal.hidden&&e.key==="Escape")close()});
function openModal(title,subtitle,mode){modalMode=mode;modal.hidden=false;$("#edgy-social-title").textContent=title;$("#edgy-social-subtitle").textContent=subtitle;$("#edgy-social-body").innerHTML="";msg("");modal.querySelector("[data-close]").focus()}
function bell(){
 const host=document.querySelector(".top");if(!host)return;
 let b=host.querySelector(".edgyBell");
 if(!b){
  b=document.createElement("button");b.type="button";b.className="edgyBell";
  b.innerHTML='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg><span class="edgyBellCount" hidden></span>';
  host.insertBefore(b,host.querySelector("#avatar"));b.onclick=openInbox;
 }
 b.setAttribute("aria-label",inbox.length?inbox.length+" convites pendentes":"Convites");
 const badge=b.querySelector(".edgyBellCount");badge.hidden=!inbox.length;badge.textContent=inbox.length;
}
async function refreshInvites(){
 if(!me()||!db()){inbox=[];bell();return}
 if(loading)return;loading=true;
 try{const {data,error}=await db().rpc("edgy_my_invites");if(error)throw error;inbox=Array.isArray(data)?data:[];currentUser=me().id}
 catch(e){console.warn("EDGY invites:",e)}finally{loading=false;bell()}
}
function openInbox(){openModal("Convites","Desafios recebidos na EDGY","inbox");inboxDraw();refreshInvites().then(()=>{if(modalMode==="inbox")inboxDraw()})}
function inboxDraw(){
 if(modalMode!=="inbox")return;
 const e=$("#edgy-social-body");
 e.innerHTML=inbox.length?inbox.map(i=>'<div class="edgyInvite"><strong>'+esc(i.sender_name)+' convidou-te para '+gameName(i.game)+'</strong><small>@'+esc(i.sender_username)+' · Sala '+esc(i.code)+'</small><div class="edgyInviteControls"><button class="edgySocialPrimary" data-accept="'+esc(i.id)+'">Aceitar e jogar</button><button class="edgySocialAlt" data-decline="'+esc(i.id)+'">Recusar</button></div></div>').join(""):'<p class="sub">Não tens convites pendentes.</p>';
 e.querySelectorAll("[data-accept]").forEach(b=>b.onclick=()=>respond(b.dataset.accept,true));
 e.querySelectorAll("[data-decline]").forEach(b=>b.onclick=()=>respond(b.dataset.decline,false));
}
async function respond(id,accept){
 if(working)return;working=true;msg(accept?"A entrar na partida…":"A recusar convite…");
 try{
  const {data,error}=await db().rpc("edgy_invite_respond",{p_invite_id:id,p_accept:accept});
  if(error)throw error;
  inbox=inbox.filter(i=>i.id!==id);bell();
  if(accept&&data?.accepted){close();window.EDGY_openRoom?.(data.game,data.code)}
  else{inboxDraw();msg("Convite recusado.")}
 }catch(e){msg(e.message||"Não foi possível responder")}
 finally{working=false;refreshInvites()}
}
async function picker(term=""){
 if(modalMode!=="picker")return;
 const token=++request;
 const root=$("#edgy-social-body");
 root.innerHTML='<input id="edgy-search" class="edgySocialInput" type="search" maxlength="40" placeholder="Nome ou @username" value="'+esc(term)+'"><div id="edgy-social-results"><p class="sub">A procurar jogadores…</p></div>';
 $("#edgy-search").oninput=e=>{const value=e.target.value.trim();clearTimeout(debounce);debounce=setTimeout(()=>picker(value),240)};
 try{
  const {data,error}=await db().rpc("edgy_list_players",{p_search:term,p_limit:35});
  if(error)throw error;
  if(token!==request||modalMode!=="picker")return;
  const people=(Array.isArray(data)?data:[]).filter(p=>p.id!==me()?.id);
  const list=$("#edgy-social-results");if(!list)return;
  list.innerHTML=people.length?people.map(p=>'<div class="edgySocialUser"><span><strong>'+esc(p.name)+'</strong><small>@'+esc(p.username)+'</small></span><button class="edgySocialPrimary" data-person="'+esc(p.id)+'">Convidar</button></div>').join(""):'<p class="sub">Nenhum jogador encontrado.</p>';
  list.querySelectorAll("[data-person]").forEach(b=>b.onclick=()=>send(b.dataset.person));
 }catch(e){msg(e.message||"Erro ao carregar jogadores")}
}
async function send(playerId){
 if(working)return;working=true;msg("A enviar convite…");
 try{const {error}=await db().rpc("edgy_invite_send",{p_game:roomGame,p_code:roomCode,p_recipient:playerId});if(error)throw error;
  msg("Convite enviado! O jogador recebe-o no sino da EDGY.");setTimeout(()=>{if(modalMode==="picker")close()},950)
 }catch(e){msg(e.message||"Não foi possível enviar convite")}
 finally{working=false}
}
function openInvite(game,code){
 if(!me()||me().is_anonymous){openModal("Convites internos","Precisas de uma conta para convidar jogadores.","info");return}
 if(!["chess","checkers"].includes(game)||!/^[0-9A-F]{8}$/i.test(code||""))return;
 roomGame=game;roomCode=String(code).toUpperCase();
 openModal("Convidar jogador",gameName(game)+" · Sala "+roomCode,"picker");picker("");
}
async function createAndInvite(game,playerId){
 if(!me()||me().is_anonymous){openModal("Desafiar jogador","Precisas de uma conta para desafiar jogadores.","info");return}
 if(!["chess","checkers"].includes(game)||!playerId)return;
 openModal("A criar desafio",gameName(game),"preparing");msg("A criar a sala…");
 try{
  const fn=game==="chess"?"edgy_create_chess_room_timed":"edgy_checkers_create";
  const {data:code,error:roomError}=await db().rpc(fn,game==="chess"?{p_base:600,p_increment:0}:undefined);
  if(roomError)throw roomError;
  const {error}=await db().rpc("edgy_invite_send",{p_game:game,p_code:code,p_recipient:playerId});
  if(error){msg("Sala "+code+" criada, mas o convite falhou: "+error.message);return}
  close();window.EDGY_openRoom?.(game,code);
 }catch(e){msg(e.message||"Não foi possível criar o desafio")}
}
function roomCard(r){
 const waiting=r.status==="waiting",owner=r.white_id===me()?.id;
 const pace=r.game==="chess"?Math.round((r.base_ms||600000)/60000)+"+"+Math.round((r.increment_ms||0)/1000):"8×8";
 return '<article class="edgyRoom"><div class="edgyRoomInfo"><strong>'+gameName(r.game)+' <span class="edgyRoomStatus '+esc(r.status)+'">· '+statusName(r.status)+'</span></strong><p>'+esc(r.white_name)+' <span>vs</span> '+esc(r.black_name||"À espera de jogador")+'</p><small>'+esc(r.code)+' · '+pace+'</small></div><div class="edgyRoomActions"><button class="edgySocialPrimary" data-open="'+r.game+'|'+esc(r.code)+'">'+(waiting?"Abrir":r.status==="active"?"Retomar":"Rever")+'</button>'+(waiting&&owner?'<button class="edgySocialAlt" data-invite="'+r.game+'|'+esc(r.code)+'">Convidar</button><button class="edgySocialAlt" data-cancel="'+r.game+'|'+esc(r.code)+'">Fechar</button>':"")+'</div></article>';
}
async function renderRooms(id,game=null){
 const host=document.getElementById(id);if(!host)return;
 if(!me()){host.innerHTML='<p class="edgyRoomsEmpty">Inicia sessão para veres as tuas salas.</p>';return}
 host.innerHTML='<p class="sub">A carregar salas…</p>';
 try{
  const {data,error}=await db().rpc("edgy_my_rooms",{p_limit:80});if(error)throw error;
  if(!host.isConnected)return;
  const rooms=(Array.isArray(data)?data:[]).filter(r=>!game||r.game===game);
  host.innerHTML=rooms.length?'<div class="edgyRooms">'+rooms.map(roomCard).join("")+'</div>':'<p class="edgyRoomsEmpty">Ainda não tens salas. Cria uma partida ou aceita um convite.</p>';
  host.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{const [g,c]=b.dataset.open.split("|");window.EDGY_openRoom?.(g,c)});
  host.querySelectorAll("[data-invite]").forEach(b=>b.onclick=()=>{const [g,c]=b.dataset.invite.split("|");openInvite(g,c)});
  host.querySelectorAll("[data-cancel]").forEach(b=>b.onclick=async()=>{
   const [g,c]=b.dataset.cancel.split("|");b.disabled=true;
   const method=g==="chess"?"edgy_cancel_waiting_chess_room":"edgy_checkers_cancel";
   const {data:ok,error}=await db().rpc(method,{p_code:c});
   if(error||!ok){b.disabled=false;host.insertAdjacentHTML("beforeend",'<p class="sub">Não foi possível fechar a sala.</p>');return}
   renderRooms(id,game);
  });
 }catch(e){if(host.isConnected)host.innerHTML='<p class="edgyRoomsEmpty">Erro ao carregar salas: '+esc(e.message)+'</p>'}
}
function refreshRoomsOnPage(){
 for(const [id,game] of [["edgy-home-rooms",null],["edgy-all-rooms",null],["edgy-chess-rooms","chess"],["edgy-checkers-rooms","checkers"]]){
  if(document.getElementById(id))renderRooms(id,game);
 }
}
window.EDGY_social={openInvite,createAndInvite,refreshInvites,openInbox,renderRooms,refreshRoomsOnPage};
bell();setTimeout(refreshInvites,1700);setTimeout(refreshRoomsOnPage,300);
setInterval(()=>{if(me()?.id!==currentUser){inbox=[];currentUser="";bell()}refreshInvites()},15000);
})();