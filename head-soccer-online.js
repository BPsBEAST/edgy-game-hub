/* EDGY Head Soccer Online 1v1.
 * Private Supabase Realtime channel. Only authenticated room members may subscribe.
 * The room host runs one authoritative physics simulation at 60fps and sends 20fps frames;
 * the guest transmits button input at 15fps and renders interpolated snapshots.
 * The database controls membership, lifecycle and one-time XP settlement.
 */
(function(){
"use strict";
const api=()=>window.EDGY_auth?.getClient?.();
const me=()=>window.EDGY_auth?.getUser?.();
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const valid=c=>/^[0-9A-F]{8}$/.test(String(c||"").toUpperCase().trim());
const noop=()=>{};
let room=null,code="",channel=null,connected=false,working=false,error="",poll=null,version=0;
let onUpdate=noop,onFrame=noop,onInput=noop,onConnection=noop;
let remoteButtons={},remoteInputTime=0,lastSeq=-1;
let presenceUsers=new Set(),lastFrameTime=0,frameCount=0,sendCount=0;
const emptyInputs=()=>({left:false,right:false,jump:false,kick:false,power:false});
const isHost=()=>!!room&&room.host===me()?.id;
const isGuest=()=>!!room&&room.guest===me()?.id;
const myRole=()=>isHost()?"host":isGuest()?"guest":null;
function get(){
 return {room,code,connected,working,error,role:myRole(),
  hostConnected:!!(room?.host&&presenceUsers.has(room.host)),
  guestConnected:!!(room?.guest&&presenceUsers.has(room.guest)),
  input:Date.now()-remoteInputTime<320?remoteButtons:emptyInputs(),
  remoteSeen:Date.now()-lastFrameTime<3500};
}
function handlers(next={}){
 onUpdate=next.change||noop;
 onFrame=next.frame||noop;
 onInput=next.input||noop;
 onConnection=next.connection||noop;
}
function emit(){try{onUpdate(get())}catch(e){console.error("EDGY Head Soccer UI:",e)}}
function stop(){
 version++;clearInterval(poll);poll=null;
 const old=channel;channel=null;connected=false;presenceUsers.clear();
 remoteButtons=emptyInputs();remoteInputTime=0;lastSeq=-1;lastFrameTime=0;frameCount=0;sendCount=0;
 if(old){try{api()?.removeChannel(old)}catch(e){console.warn("Head Soccer Realtime leave:",e)}}
}
function close(){stop();room=null;code="";working=false;error="";emit()}
async function rpc(fn,params={}){
 const client=api();if(!client)throw Error("Ligação Supabase indisponível");
 const {data,error:failure}=await client.rpc(fn,params);
 if(failure)throw Error(failure.message||"Operação indisponível");
 return data;
}
function identity(){
 const u=me();
 if(!u||u.is_anonymous)throw Error("Entra numa conta EDGY para jogar online.");
 return u.id;
}
async function refresh(){
 if(!code||!api())return;
 const current=code,ticket=version;
 try{
  const data=await rpc("edgy_head_soccer_state",{p_code:current});
  if(ticket!==version||current!==code)return;
  const changed=JSON.stringify(room)!==JSON.stringify(data);
  room=data;
  error="";
  if(changed)emit();
 }catch(e){if(ticket===version){error=e.message||"Não foi possível atualizar a sala";emit()}}
}
function watch(){
 clearInterval(poll);
 poll=setInterval(()=>{
  if(!document.hidden)refresh();
 },1600);
}
function announcePresence(){
 if(!channel)return;
 const listing=channel.presenceState?.()||{};
 const next=new Set();
 for(const members of Object.values(listing)){
  for(const record of members)if(record?.uid)next.add(record.uid);
 }
 const before=[...presenceUsers].sort().join(","),after=[...next].sort().join(",");
 presenceUsers=next;
 if(before!==after){emit();onConnection(get())}
}
async function connect(){
 if(!code||!room)return;
 const id=identity(),oldVersion=version;
 const client=api();
 try{
  const {data:{session}}=await client.auth.getSession();
  if(!session?.access_token)throw Error("Sessão expirada. Volta a entrar na EDGY.");
  await client.realtime.setAuth(session.access_token);
  if(oldVersion!==version||!room)return;
  const ch=client.channel("hs:"+code,{
   config:{private:true,broadcast:{self:false,ack:false},presence:{key:id}}
  });
  channel=ch;
  ch.on("broadcast",{event:"frame"},({payload})=>{
   if(!payload||!isGuest()||payload.author!==room?.host||payload.token!==room?.match_token)return;
   if(!Number.isSafeInteger(payload.seq)||payload.seq<=lastSeq)return;
   lastSeq=payload.seq;lastFrameTime=Date.now();
   onFrame(payload.frame||{});
  });
  ch.on("broadcast",{event:"input"},({payload})=>{
   if(!payload||!isHost()||payload.author!==room?.guest||payload.token!==room?.match_token)return;
   if(!Number.isSafeInteger(payload.seq)||payload.seq<0)return;
   if(payload.seq<=sendCount&&remoteInputTime)return;
   sendCount=payload.seq;
   const v=payload.buttons||{};
   remoteButtons={left:v.left===true,right:v.right===true,jump:v.jump===true,
    kick:v.kick===true,power:v.power===true};
   remoteInputTime=Date.now();
   onInput(remoteButtons);
  });
  ch.on("broadcast",{event:"control"},({payload})=>{
   if(!payload||!isGuest()||payload.author!==room?.host||payload.token!==room?.match_token)return;
   onFrame({control:payload.type});
  });
  ch.on("presence",{event:"sync"},announcePresence);
  ch.subscribe(async(status,subscriptionError)=>{
   if(oldVersion!==version)return;
   if(status==="SUBSCRIBED"){
    connected=true;error="";
    try{await ch.track({uid:id,joined_at:Date.now()})}catch(e){console.warn("Head Soccer presence:",e)}
    announcePresence();emit();refresh();
   }else if(["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status)){
    connected=false;remoteButtons=emptyInputs();
    error=subscriptionError?.message||"Ligação em tempo real interrompida. A tentar reconectar…";
    emit();onConnection(get());
   }
  });
 }catch(e){if(oldVersion===version){error=e.message||"Não foi possível ligar ao jogo online";emit()}}
}
async function open(incoming){
 identity();
 const desired=String(incoming||"").trim().toUpperCase();
 if(!valid(desired))throw Error("Introduz um código de 8 caracteres.");
 stop();room=null;code=desired;working=true;error="";emit();
 const ticket=version;
 try{
  await rpc("edgy_head_soccer_join",{p_code:desired});
  if(ticket!==version)return;
  await refresh();
  if(ticket!==version)return;
  watch();await connect();
 }catch(e){if(ticket===version){error=e.message||"Não foi possível entrar na sala";code="";room=null;emit()}}
 finally{if(ticket===version){working=false;emit()}}
}
async function create(){
 try{
  identity();if(working)return;
  working=true;error="";emit();
  const newCode=await rpc("edgy_head_soccer_create");
  await open(newCode);
 }catch(e){error=e.message||"Não foi possível criar sala";emit()}
 finally{working=false;emit()}
}
async function joinInput(){
 const input=document.querySelector("#hs-online-code")?.value?.trim().toUpperCase();
 if(!valid(input)){error="Código inválido. Usa os 8 caracteres da sala.";emit();return}
 await open(input);
}
async function start(){
 if(!isHost()||!room?.guest||!connected)throw Error("Aguarda que o outro jogador entre na sala.");
 const token=await rpc("edgy_head_soccer_start",{p_code:code});
 await refresh();
 return String(token);
}
async function finish(left,right){
 if(!isHost()||room?.status!=="active")return null;
 const result=await rpc("edgy_head_soccer_finish",{p_code:code,p_left:left,p_right:right});
 await refresh();return result;
}
async function forfeit(){
 if(!room||room.status!=="active")return;
 const confirmed=await window.EDGY_platform?.confirmAction?.({
  title:"Abandonar partida online?",
  message:"O adversário será declarado vencedor. Se terminares cedo, ninguém recebe XP.",
  confirmLabel:"Abandonar partida"
 });
 if(!confirmed)return;
 working=true;error="";emit();
 try{await rpc("edgy_head_soccer_forfeit",{p_code:code});await refresh()}
 catch(e){error=e.message||"Não foi possível abandonar"}finally{working=false;emit()}
}
async function rematch(){
 if(!isHost()||room?.status!=="finished")return;
 working=true;error="";emit();
 try{await rpc("edgy_head_soccer_rematch",{p_code:code});await refresh()}
 catch(e){error=e.message||"Não foi possível preparar uma revanche"}finally{working=false;emit()}
}
async function leave(){
 if(!room||working)return;
 if(room.status==="active"){await forfeit();return}
 working=true;emit();
 try{
  await rpc(room.host===me()?.id?"edgy_head_soccer_cancel":"edgy_head_soccer_leave",{p_code:code});
  close();
 }catch(e){error=e.message||"Não foi possível sair da sala";emit()}
 finally{working=false;emit()}
}
function broadcast(event,payload){
 if(!channel||!connected)return;
 const promise=channel.send({type:"broadcast",event,payload:{
  ...payload,author:me()?.id,token:room?.match_token
 }});
 if(promise&&typeof promise.catch==="function")promise.catch(()=>{});
}
function input(buttons,seq){
 if(!isGuest()||room?.status!=="active")return;
 broadcast("input",{buttons,seq});
}
function frame(st,seq){
 if(!isHost()||room?.status!=="active")return;
 broadcast("frame",{frame:st,seq});
}
function control(type){
 if(isHost()&&room?.status==="active"&&["pause","resume"].includes(type))
  broadcast("control",{type});
}
function panel(){
 const u=me();
 if(!u||u.is_anonymous)
  return '<div class="hsOnlineCard"><h3>Multiplayer online</h3><p>Inicia sessão numa conta EDGY para criar ou aceitar desafios.</p>'
   +'<button class="primary" data-hs-login>Entrar na EDGY</button></div>';
 if(!code||!room){
  return '<div class="hsOnlineCard"><h3>Head Soccer online · 1×1</h3>'
   +'<p>Cria uma sala privada e convida alguém da EDGY, ou entra com um código.</p>'
   +'<button type="button" class="primary hsRoomMain" data-hs-create '+(working?"disabled":"")+'>Criar sala privada</button>'
   +'<div class="hsRoomJoin"><input id="hs-online-code" aria-label="Código da sala" maxlength="8" placeholder="CÓDIGO DA SALA" autocomplete="off" autocapitalize="characters">'
   +'<button class="secondary" data-hs-join '+(working?"disabled":"")+'>Entrar</button></div>'
   +(working?'<p>A preparar ligação segura…</p>':"")
   +(error?'<p class="hsOnlineError" role="alert">'+esc(error)+'</p>':"")
   +'</div>';
 }
 const host=isHost(),guestReady=!!room.guest;
 const state=room.status;
 return '<div class="hsOnlineCard"><div class="hsRoomHeading"><div><small>MESA PRIVADA</small><h3>Head Soccer 1×1</h3></div>'
   +'<span class="hsRoomBadge">'+(connected?"● Online":"◌ A ligar")+'</span></div>'
   +'<button class="hsRoomCode" type="button" data-hs-copy title="Copiar código">'+esc(code)+' <span>Copiar</span></button>'
   +'<div class="hsRoomPlayers"><span><b>J1</b><strong>'+esc(room.host_name||"Anfitrião")+'</strong></span>'
   +'<em>VS</em><span><b>J2</b><strong>'+esc(room.guest_name||(guestReady?"Convidado":"À espera…"))+'</strong></span></div>'
   +(state==="waiting"?'<p> '+(guestReady?"Os dois jogadores estão na sala.":"Envia o convite e aguarda a entrada do adversário.")+'</p>'
    +(host?'<div class="hsRoomButtons"><button class="secondary" data-hs-invite '+(!guestReady&&connected?"":"disabled")+'>Convidar</button>'
      +'<button class="primary" data-hs-online-start '+(guestReady&&connected?"":"disabled")+'>Começar</button></div>':
      '<p>O anfitrião inicia a partida quando estiveres pronto.</p>'):"")
   +(state==="active"?'<p>Partida em curso · '+(host?"És o Jogador 1":"És o Jogador 2")+'.</p>'
      +'<button class="secondary hsForfeit" data-hs-forfeit '+(working?"disabled":"")+'>Abandonar partida</button>':"")
   +(state==="finished"?'<p>Resultado final: '+room.left_score+'–'+room.right_score+'.</p>'
      +(host?'<button class="primary hsRoomMain" data-hs-rematch '+(working?"disabled":"")+'>Preparar revanche</button>':
       '<p>Aguarda que o anfitrião prepare a revanche.</p>'):"")
   +(state!=="active"?'<button class="secondary hsRoomExit" data-hs-leave '+(working?"disabled":"")+'>Sair da sala</button>':"")
   +(error?'<p class="hsOnlineError" role="alert">'+esc(error)+'</p>':"")
   +'</div>';
}
function bind(root){
 if(!root)return;
 const action=(selector,fn)=>root.querySelector(selector)?.addEventListener("click",fn);
 action("[data-hs-login]",()=>window.EDGY_auth?.showEntry?.());
 action("[data-hs-create]",create);
 action("[data-hs-join]",joinInput);
 action("[data-hs-copy]",()=>navigator.clipboard?.writeText(code).catch(()=>{}));
 action("[data-hs-invite]",()=>window.EDGY_social?.openInvite?.("headSoccer",code));
 action("[data-hs-online-start]",()=>onUpdate({command:"start"}));
 action("[data-hs-forfeit]",forfeit);
 action("[data-hs-rematch]",rematch);
 action("[data-hs-leave]",leave);
}
const online=Object.freeze({handlers,get,create,open,close,refresh,start,finish,forfeit,rematch,leave,panel,bind,input,frame,control});
window.EDGY_headSoccerOnline=online;
})();