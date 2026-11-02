/* EDGY Poker: Texas Hold'em with virtual tournament chips only.
 * Supabase RPC owns the shuffled deck, private hands, turns, pots and XP.
 * The browser never computes or submits a winning hand. */
(function(){
"use strict";
const api=()=>window.EDGY_auth?.getClient?.();
const me=()=>window.EDGY_auth?.getUser?.();
const ui=()=>window.EDGY_gameUI;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const valid=s=>/^[0-9A-F]{8}$/.test(String(s||"").toUpperCase());
const ranks=["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const suits=["♠","♥","♦","♣"];
const card=n=>{
 if(!Number.isInteger(n)||n<0||n>51)return '<span class="pkCard pkBack" aria-label="Carta oculta">✦</span>';
 const suit=Math.floor(n/13),rank=n%13;
 return '<span class="pkCard'+(suit===1||suit===2?' pkRed':'')+'" aria-label="'+ranks[rank]+' de '+["espadas","copas","ouros","paus"][suit]+'"><strong>'+ranks[rank]+'</strong><span>'+suits[suit]+'</span></span>';
};
let room=null,code="",notice="",busy=false,poll=null,version=0,signature="",shownFinished=new Set();
const own=()=>room?.my_id===me()?.id;
const isHost=()=>room?.host===me()?.id;
function stop(){if(poll)clearInterval(poll);poll=null}
function close(){version++;stop();room=null;code="";notice="";busy=false;signature=""}
function link(){return new URL("?poker="+code,location.href).href}
async function refresh(force=false){
 if(!code||!api())return;
 const ticket=version,which=code;
 try{
  const {data,error}=await api().rpc("edgy_poker_state",{p_code:which});
  if(error)throw error;
  if(ticket!==version||which!==code)return;
  const next=JSON.stringify(data);
  if(next!==signature||force){signature=next;room=data;notice="";render()}
  if(data.status==="finished"&&!shownFinished.has(which)){
   shownFinished.add(which);
   window.EDGY_auth?.refreshProfile?.();
  }
 }catch(e){if(ticket===version){notice=e.message||"Não foi possível atualizar a partida";render()}}
}
function watch(){stop();poll=setInterval(()=>{if(document.visibilityState!=="hidden")refresh()},2400)}
async function open(value=""){
 close();
 const incoming=String(value||"").trim().toUpperCase(),ticket=version;
 if(valid(incoming))code=incoming;
 render();
 if(!me()||!code)return;
 try{
  const {error}=await api().rpc("edgy_poker_join",{p_code:code});if(error)throw error;
  if(ticket!==version)return;watch();await refresh(true);
 }catch(e){if(ticket===version){notice=e.message||"Não foi possível entrar na sala";code="";render()}}
}
async function create(){
 if(!me())return window.EDGY_auth?.showEntry?.();
 if(busy)return;busy=true;notice="";render();
 try{
  const {data,error}=await api().rpc("edgy_poker_create");if(error)throw error;
  code=String(data||"").toUpperCase();room=null;signature="";
  history.replaceState(null,"",link());watch();await refresh(true);
 }catch(e){notice=e.message||"Não foi possível criar sala"}finally{busy=false;render()}
}
async function join(){
 if(busy)return;
 const value=String(document.getElementById("pk-code")?.value||"").toUpperCase().trim();
 if(!valid(value)){notice="Introduz um código de oito caracteres.";render();return}
 if(!me())return window.EDGY_auth?.showEntry?.();
 busy=true;notice="";render();
 try{
  const {error}=await api().rpc("edgy_poker_join",{p_code:value});if(error)throw error;
  code=value;room=null;signature="";
  history.replaceState(null,"",link());watch();await refresh(true);
 }catch(e){notice=e.message||"Não foi possível entrar"}finally{busy=false;render()}
}
async function action(name){
 if(!room||busy)return;
 busy=true;notice="";render();
 try{
  const {error}=await api().rpc("edgy_poker_action",{p_code:code,p_action:name});
  if(error)throw error;
  if(name==="leave"){close();history.replaceState(null,"",location.pathname);render();return}
  await refresh(true);
 }catch(e){notice=e.message||"Não foi possível registar a ação"}finally{busy=false;render()}
}
async function cancel(){
 if(!room||busy)return;
 if(!await window.EDGY_platform.confirmAction({title:"Fechar sala de Poker?",message:"A sala será encerrada para todos.",confirmLabel:"Fechar sala"}))return;
 busy=true;render();
 try{
  const {error}=await api().rpc("edgy_poker_cancel",{p_code:code});if(error)throw error;
  close();history.replaceState(null,"",location.pathname);
 }catch(e){notice=e.message||"Não foi possível fechar"}finally{busy=false;render()}
}
function players(){
 return '<div class="pkPlayers">'+(room?.players||[]).map(p=>'<div class="pkPlayer'+(p.id===room.my_id?' pkSelf':'')+(room.to_act===p.id?' pkTurn':'')+'">'
  +'<div class="pkAvatar">'+esc((p.name||"J").slice(0,1).toUpperCase())+'</div><div class="pkWho"><strong>'+esc(p.name)+(p.id===room.my_id?' (tu)':'')+'</strong>'
  +'<small>'+(p.seat===room.dealer_seat?'Dealer · ':'')+(room.status==="playing"&&!p.active?'Fora da mão':p.folded?'Desistiu':room.to_act===p.id?'A jogar':'Jogador')+'</small></div>'
  +'<span class="pkStack">'+p.stack+' <small>fichas</small></span></div>').join("")+'</div>';
}
function lobby(){
 return ui().card("Sala privada",'<div class="pkCode">'+esc(code)+'</div><p class="sub">2 a 6 jogadores · 500 fichas virtuais por pessoa · 8 mãos por partida.</p>'
  +players()+'<div class="pkActions"><button class="primary" data-pk-copy>Copiar convite</button>'
  +(isHost()?'<button class="secondary" data-pk-invite>Convidar jogador</button>'
   +'<button class="primary" data-pk-act="start" '+(room.players.length<2||busy?'disabled':'')+'>Começar ('+room.players.length+'/2)</button>'
   +'<button class="secondary" data-pk-cancel>Fechar sala</button>'
   :'<button class="secondary" data-pk-act="leave">Sair da sala</button>')+'</div>');
}
function stage(){
 const playing=room.status==="playing",between=room.status==="between",finished=room.status==="finished";
 const turn=playing&&room.to_act===room.my_id,player=room.players.find(p=>p.id===room.my_id);
 const folded=player?.folded||!player?.active;
 const owe=Number(room.to_call)||0;
 const bet=room.street==="turn"||room.street==="river"?40:20;
 const canRaise=turn&&room.raises<3&&room.my_stack>=owe+bet;
 const streetNames={preflop:"Pré-flop",flop:"Flop",turn:"Turn",river:"River"};
 const board=(room.board||[]).map(card).join("");
 const boardSlots=Array.from({length:Math.max(0,5-(room.board||[]).length)},()=>card(null)).join("");
 const hand=(room.hole||[]).map(card).join("");
 const reveal=(room.reveal||[]).map(p=>{
  const user=room.players.find(x=>x.id===p.id);
  return '<div class="pkReveal"><strong>'+esc(user?.name||"Jogador")+'</strong><div class="pkCards">'+(p.cards||[]).map(card).join("")+'</div></div>';
 }).join("");
 return '<div class="pkTable"><div class="pkTopline"><span>MÃO '+room.hand+' / '+room.max_hands+'</span><span>'+esc(streetNames[room.street]||"Jogo")+'</span></div>'
  +'<div class="pkFelt"><div class="pkPot">POTE <strong>'+room.pot+'</strong> fichas</div>'
  +'<div class="pkCommunity" aria-label="Cartas comunitárias">'+board+boardSlots+'</div>'
  +'<p>Blinds 10 / 20 · Fichas virtuais</p></div>'
  +'<div class="pkHand"><div><strong>As tuas cartas</strong><small>'+room.my_stack+' fichas disponíveis</small></div>'
  +'<div class="pkCards">'+(hand||card(null)+card(null))+'</div></div>'
  +(playing?'<p class="pkPhase">'+(folded?'Estás fora desta mão.':turn?'É a tua vez!':'A aguardar '+esc(room.players.find(p=>p.id===room.to_act)?.name||"outra jogada")+'…')+'</p>':'')
  +(turn&&!folded?'<div class="pkButtons">'
   +'<button class="secondary" data-pk-act="fold">Desistir</button>'
   +(owe?'<button class="primary" data-pk-act="call" '+(room.my_stack<owe?'disabled':'')+'>Igualar '+owe+'</button>'
    :'<button class="primary" data-pk-act="check">Passar</button>')
   +'<button class="secondary" data-pk-act="raise" '+(canRaise?'':'disabled')+'>Aumentar +'+bet+'</button>'
   +'</div>':'')
  +(room.raises>=3&&turn?'<p class="pkNote">Atingido o limite de aumentos nesta ronda.</p>':'')
  +(between||finished?'<div class="pkResult"><h3>'+(finished?'Partida terminada!':'Mão concluída')+'</h3>'
   +'<p>'+esc(room.last_result)+'</p>'+reveal
   +(finished?'<p><strong>'+esc(room.players.find(p=>p.id===room.winner)?.name||"Jogador")+'</strong> venceu o torneio. O resultado e o XP foram guardados no histórico.</p>'
    :isHost()?'<button class="primary" data-pk-act="next">Próxima mão →</button>':'<p>Aguardar que o anfitrião avance a mão.</p>')+'</div>':'')
  +'</div>';
}
function render(){
 const root=document.getElementById("screen");if(!root||game!=="poker")return;
 root.classList.toggle("edgyLobby",!room);
 const header=ui().header("poker",{room:room?.code||"",intro:room?"":"Texas Hold’em · 2–6 jogadores · Só fichas virtuais"});
 let body;
 if(!me())body=ui().card("Iniciar sessão",'<p class="sub">Entra como convidado ou com a tua conta para jogar.</p><button class="primary" data-pk-login>Entrar para jogar</button>');
 else if(!room)body=ui().card("Criar sala",'<p class="sub">Texas Hold’em de apostas fixas. Oito mãos, 500 fichas iniciais e sem dinheiro real.</p><button class="primary" data-pk-create '+(busy?'disabled':'')+'>Criar sala privada</button>')
  +ui().card("Entrar numa sala",'<div class="pkJoin"><input id="pk-code" class="field" maxlength="8" placeholder="CÓDIGO DE 8 CARACTERES" value="'+esc(code)+'" autocomplete="off"><button class="secondary" data-pk-join>Entrar</button></div>')
  +ui().card("Salas abertas",'<div id="edgy-poker-rooms"></div>');
 else body=room.status==="waiting"?lobby():ui().match({game:"poker",stage:stage(),side:ui().card("Jogadores",players())
  +ui().card("Regras",'<p class="sub">O melhor conjunto de cinco cartas vence. Passa, iguala, aumenta ou desiste. Máximo de três aumentos por ronda. Sem all-in nem dinheiro real.</p>'),
 layoutClass:"pkLayout",stageClass:"pkStage",sideClass:"pkSide"});
 root.innerHTML='<div class="edgyGamePage pkPage">'+header+body+(notice?'<p class="pkNotice" role="status">'+esc(notice)+'</p>':'')+'</div>';
 root.querySelector("[data-back]")?.addEventListener("click",()=>nav("games"));
 root.querySelector("[data-pk-login]")?.addEventListener("click",()=>window.EDGY_auth?.showEntry?.());
 root.querySelector("[data-pk-create]")?.addEventListener("click",create);
 root.querySelector("[data-pk-join]")?.addEventListener("click",join);
 root.querySelector("[data-pk-copy]")?.addEventListener("click",async()=>{
  try{await navigator.clipboard.writeText(link());notice="Convite copiado!"}
  catch{notice=link()}render()
 });
 root.querySelector("[data-pk-invite]")?.addEventListener("click",()=>window.EDGY_social?.openInvite?.("poker",code));
 root.querySelector("[data-pk-cancel]")?.addEventListener("click",cancel);
 root.querySelectorAll("[data-pk-act]").forEach(button=>button.addEventListener("click",()=>action(button.dataset.pkAct)));
 if(!room)window.EDGY_social?.renderRooms?.("edgy-poker-rooms","poker");
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&code)refresh()});
window.EDGY_poker=Object.freeze({open,close,render,refresh:()=>refresh(true)});
const incoming=new URLSearchParams(location.search).get("poker");
if(valid(incoming)){game="poker";open(incoming)}
})();