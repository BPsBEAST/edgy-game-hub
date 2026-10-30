/* EDGY platform: one reusable multiplayer client & one result component.
   Games keep their independent rules/anti-cheat on the server. No database migration. */
(function(){
"use strict";
const GAMES=Object.freeze({
 chess:Object.freeze({id:"chess",title:"Xadrez",display:"Xadrez online",category:"Multiplayer",mode:"2 jogadores · Online",icon:"♞",online:true,create:"edgy_create_chess_room_timed",join:"edgy_join_chess_room",cancel:"edgy_cancel_waiting_chess_room",table:"chess_rooms",param:"room",defaultTime:600,increment:0}),
 checkers:Object.freeze({id:"checkers",title:"Damas",display:"Damas online",category:"Multiplayer",mode:"2 jogadores · Online",icon:"◎",online:true,create:"edgy_checkers_create",join:"edgy_checkers_join",cancel:"edgy_checkers_cancel",table:"checkers_rooms",param:"checkers"}),
 tic:Object.freeze({id:"tic",title:"Jogo do Galo",display:"Jogo do Galo online",category:"Estratégia",mode:"1–2 jogadores · Online/local",icon:"✕",online:true,create:"edgy_tic_create",join:"edgy_tic_join",cancel:"edgy_tic_cancel",table:"tic_rooms",param:"tic"}),
 reaction:Object.freeze({id:"reaction",title:"Reflexos",display:"Reflexos",category:"Arcade",mode:"1 jogador",icon:"◴",online:false})
});
const client=()=>window.EDGY_auth?.getClient?.();
function config(id){const item=GAMES[id];if(!item)throw new Error("Jogo indisponível");return item}
function online(id){const entry=config(id);if(!entry.online)throw new Error("Este jogo ainda não suporta salas online");return entry}
function code(value){const c=String(value||"").trim().toUpperCase();if(!/^[0-9A-F]{8}$/.test(c))throw new Error("O código da sala deve ter 8 caracteres");return c}
function db(){const api=client();if(!api)throw new Error("Não foi possível estabelecer ligação. Tenta novamente.");return api}
function call(name,parameters){return db().rpc(name,parameters)}
const rooms={
 create(id,options={}){
  const game=online(id);
  if(game.id==="chess"){
   const base=Number(options.base??game.defaultTime),increment=Number(options.increment??0);
   if(![180,300,600,900].includes(base)||![0,2,10].includes(increment))throw new Error("Ritmo de jogo não suportado");
   return call(game.create,{p_base:base,p_increment:increment});
  }
  return call(game.create);
 },
 join(id,roomCode){const game=online(id);return call(game.join,{p_code:code(roomCode)})},
 cancel(id,roomCode){const game=online(id);return call(game.cancel,{p_code:code(roomCode)})},
 load(id,roomCode){const game=online(id);return db().from(game.table).select("*").eq("code",code(roomCode)).maybeSingle()},
 list(limit=80){return call("edgy_my_rooms",{p_limit:Math.max(1,Math.min(100,Number(limit)||80))})},
 invite(id,roomCode,recipient){online(id);return call("edgy_invite_send",{p_game:id,p_code:code(roomCode),p_recipient:recipient})},
 respond(inviteId,accept){return call("edgy_invite_respond",{p_invite_id:inviteId,p_accept:Boolean(accept)})}
};
/* One accessible dialog for every turn-based multiplayer result. */
const iconMarkup={
 win:'<path d="M8 3h8v3h4v4a5 5 0 0 1-5 5h-1.3L12 18l-1.7-3H9a5 5 0 0 1-5-5V6h4V3Z"/><path d="M12 18v3M8 21h8M8 6H5v3a3 3 0 0 0 3 3m8-6h3v3a3 3 0 0 1-3 3"/>',
 loss:'<path d="M5 21V4m0 1c4-3 7 3 14 0v10c-7 3-10-3-14 0"/><path d="m10 9 5 5m0-5-5 5"/>',
 draw:'<path d="m3 11 5-5 5 5-5 5-5-5Z"/><path d="m11 11 5-5 5 5-5 5-5-5Z"/><path d="M8 16v4m8-4v4M6 20h12"/>'
};
function createResult({game,primaryLabel="Continuar",secondaryLabel="Rever partida",onSecondary=()=>{},onPrimary=()=>{}}={}){
 const meta=config(game),overlay=document.createElement("div");
 overlay.className="edgyOutcomeOverlay";overlay.hidden=true;
 overlay.setAttribute("aria-hidden","true");
 overlay.innerHTML='<section class="edgyOutcomeDialog" role="dialog" aria-modal="true" aria-labelledby="edgy-outcome-'+meta.id+'">'
  +'<div class="edgyOutcomeTop"><span class="edgyOutcomeEyebrow">PARTIDA TERMINADA</span><button type="button" class="edgyOutcomeDismiss" data-dismiss aria-label="Fechar">✕</button></div>'
  +'<div class="edgyOutcomeSymbol" data-symbol aria-hidden="true"></div>'
  +'<h2 id="edgy-outcome-'+meta.id+'" data-title>Resultado</h2>'
  +'<p class="edgyOutcomeGame">'+meta.title+'</p><p class="edgyOutcomeReason" data-reason></p>'
  +'<div class="edgyOutcomeActions"><button type="button" class="edgyOutcomePrimary" data-primary></button>'
  +'<button type="button" class="edgyOutcomeSecondary" data-secondary></button></div></section>';
 overlay.querySelector("[data-primary]").textContent=primaryLabel;
 overlay.querySelector("[data-secondary]").textContent=secondaryLabel;
 document.body.append(overlay);
 let previousFocus=null;
 const controls=()=>[...overlay.querySelectorAll("button:not([disabled])")];
 function hide(){
  if(overlay.hidden)return;
  overlay.hidden=true;overlay.setAttribute("aria-hidden","true");
  if(previousFocus?.isConnected)previousFocus.focus();
  previousFocus=null;
 }
 function show({outcome="draw",reason=""}={}){
  const state=["win","loss","draw"].includes(outcome)?outcome:"draw";
  const labels={win:"Venceste!",loss:"Perdeste!",draw:"Empate!"};
  overlay.dataset.result=state;
  overlay.querySelector("[data-title]").textContent=labels[state];
  overlay.querySelector("[data-reason]").textContent=String(reason||"A partida terminou.");
  overlay.querySelector("[data-symbol]").innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">'+iconMarkup[state]+'</svg>';
  previousFocus=document.activeElement;
  overlay.hidden=false;overlay.setAttribute("aria-hidden","false");
  overlay.querySelector("[data-primary]").focus();
 }
 overlay.querySelector("[data-dismiss]").addEventListener("click",hide);
 overlay.querySelector("[data-primary]").addEventListener("click",()=>{hide();onPrimary()});
 overlay.querySelector("[data-secondary]").addEventListener("click",()=>{hide();onSecondary()});
 overlay.addEventListener("click",event=>{if(event.target===overlay)hide()});
 document.addEventListener("keydown",event=>{
  if(overlay.hidden)return;
  if(event.key==="Escape"){event.preventDefault();hide();return}
  if(event.key!=="Tab")return;
  const buttons=controls(),first=buttons[0],last=buttons[buttons.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
 });
 return Object.freeze({element:overlay,show,hide});
}

function confirmAction({title="Confirmar ação",message="",confirmLabel="Confirmar",cancelLabel="Voltar"}={}){
 return new Promise(resolve=>{
  const overlay=document.createElement("div");
  overlay.className="edgyConfirmOverlay";
  overlay.innerHTML='<section class="edgyConfirmDialog" role="alertdialog" aria-modal="true" aria-labelledby="edgy-confirm-title" aria-describedby="edgy-confirm-message">'
   +'<span class="edgyConfirmMark" aria-hidden="true">!</span>'
   +'<h2 id="edgy-confirm-title"></h2><p id="edgy-confirm-message"></p>'
   +'<div class="edgyConfirmActions"><button type="button" data-cancel></button><button type="button" data-approve></button></div></section>';
  overlay.querySelector("h2").textContent=title;
  overlay.querySelector("p").textContent=message;
  overlay.querySelector("[data-cancel]").textContent=cancelLabel;
  overlay.querySelector("[data-approve]").textContent=confirmLabel;
  const original=document.activeElement;
  function done(value){
   document.removeEventListener("keydown",handleKey);
   overlay.remove();
   if(original?.isConnected)original.focus();
   resolve(value);
  }
  function handleKey(event){
   if(event.key==="Escape"){event.preventDefault();done(false)}
   if(event.key==="Tab"){
    const a=overlay.querySelector("[data-cancel]"),b=overlay.querySelector("[data-approve]");
    if(event.shiftKey&&document.activeElement===a){event.preventDefault();b.focus()}
    else if(!event.shiftKey&&document.activeElement===b){event.preventDefault();a.focus()}
   }
  }
  overlay.querySelector("[data-cancel]").onclick=()=>done(false);
  overlay.querySelector("[data-approve]").onclick=()=>done(true);
  overlay.addEventListener("click",event=>{if(event.target===overlay)done(false)});
  document.addEventListener("keydown",handleKey);
  document.body.append(overlay);
  overlay.querySelector("[data-cancel]").focus();
 });
}

window.EDGY_platform=Object.freeze({games:GAMES,config,code,rooms,createResult,confirmAction});
})();