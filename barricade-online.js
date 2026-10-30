/* EDGY Barricade — classic 9x9 two-player match.
   Server validates every move; shared EDGY UI supplies lobby, invitations and mobile panels. */
(function(){
"use strict";
let rules=null,room=null,players=null,channel=null,poller=null,epoch=0,pending="",busy=false;
let message="",tool="move",orientation="h",review=null,seen=new Set();
const api=()=>window.EDGY_auth?.getClient(),me=()=>window.EDGY_auth?.getUser();
const ui=()=>window.EDGY_gameUI;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const outcome=window.EDGY_platform.createResult({game:"barricade",primaryLabel:"Continuar",secondaryLabel:"Rever jogadas",onSecondary:()=>{review=0;draw()}});
function url(){const loc=new URL(location.href);loc.searchParams.set("barricade",room.code);return loc.href}
function clean(){
 ++epoch;ui().clearMobilePanel("barricade");outcome.hide();
 if(channel){api()?.removeChannel(channel);channel=null}
 if(poller){clearInterval(poller);poller=null}
 room=null;players=null;busy=false;message="";review=null;
}
function close(){clean();const loc=new URL(location.href);loc.searchParams.delete("barricade");history.replaceState(null,"",loc.pathname+loc.search+loc.hash)}
function open(code=""){clean();pending=String(code||"").trim().toUpperCase();loadRules();draw();if(pending)join(pending)}
function loadRules(){
 if(rules)return;
 import("./barricade-rules.js?v=1").then(m=>{rules=m;if(game==="barricade")draw()}).catch(e=>{console.error("Barricade rules",e);message="Falha ao carregar as regras";draw()});
}
async function load(code){
 const ticket=epoch;
 const {data,error}=await window.EDGY_platform.rooms.load("barricade",code);
 if(ticket!==epoch)return;
 if(error||!data){message=error?.message||"Sala não encontrada";draw();return}
 room=data;pending="";review=null;
 const u=new URL(location.href);u.searchParams.set("barricade",room.code);history.replaceState(null,"",u.pathname+u.search+u.hash);
 await loadPlayers();if(ticket!==epoch)return;
 subscribe();draw();finished();
}
async function loadPlayers(){
 if(!room)return;
 const {data,error}=await window.EDGY_platform.rooms.players("barricade",room.code);
 if(!error)players=data;
}
function subscribe(){
 if(!room||!api())return;
 if(channel)api().removeChannel(channel);
 if(poller)clearInterval(poller);
 const id=room.id;
 channel=api().channel("barricade-room-"+id).on("postgres_changes",{event:"UPDATE",schema:"public",table:"barricade_rooms",filter:"id=eq."+id},()=>refresh()).subscribe();
 poller=setInterval(()=>{if(room&&game==="barricade"&&document.visibilityState!=="hidden")refresh()},3000);
}
async function refresh(){
 if(!room||busy||!api())return;
 const previous=room,token=epoch;
 const {data}=await api().from("barricade_rooms").select("*").eq("id",previous.id).maybeSingle();
 if(token!==epoch||!room||!data)return;
 if(data.updated_at===room.updated_at&&data.ply===room.ply&&data.status===room.status)return;
 room=data;
 if(data.black_id!==previous.black_id)await loadPlayers();
 draw();
 if(previous.status==="active"&&room.status!=="active"){
  finished();window.EDGY_auth?.refreshProfile?.();
 }
}
function seat(){if(!room)return null;return room.white_id===me()?.id?"r":room.black_id===me()?.id?"b":null}
function status(){
 if(room.status==="waiting")return "À espera do adversário. Partilha o convite.";
 if(room.status==="active")return room.turn===seat()?"A tua vez · Move ou coloca uma barreira":"Vez do adversário";
 if(room.status==="draw")return "Empate · Limite de jogadas";
 return room.status===(seat()==="r"?"white_win":"black_win")?"Venceste!":"Perdeste!";
}
function finished(){
 if(!room||!["white_win","black_win","draw"].includes(room.status)||seen.has(room.id))return;
 seen.add(room.id);
 outcome.show({outcome:room.status==="draw"?"draw":room.status===(seat()==="r"?"white_win":"black_win")?"win":"loss",reason:room.finish_reason==="resignation"?"O adversário desistiu.":room.status==="draw"?"Limite de jogadas atingido.":"A meta foi alcançada."});
}
async function create(){
 if(busy)return;busy=true;message="A criar sala…";draw();
 try{const {data,error}=await window.EDGY_platform.rooms.create("barricade");if(error)throw error;await load(data)}
 catch(e){message=e.message||"Falha ao criar sala";draw()}
 finally{busy=false;draw()}
}
async function join(code){
 if(!/^[0-9a-f]{8}$/i.test(code||"")){message="Código inválido";draw();return}
 if(busy)return;busy=true;message="A entrar…";draw();
 try{
  const {error}=await window.EDGY_platform.rooms.join("barricade",code);
  if(error)throw error;
  await load(code.toUpperCase());
 }catch(e){message=e.message||"Não foi possível entrar";draw()}
 finally{busy=false;draw()}
}
async function act(payload){
 if(!room||busy||room.status!=="active")return;
 busy=true;message="A validar jogada…";
 try{
  const {data,error}=await api().functions.invoke("barricade-action",{body:{code:room.code,expected_ply:room.ply,...payload}});
  if(error||!data?.ok){
   let msg=data?.error||error?.message||"Jogada rejeitada";
   if(error?.context?.json)try{msg=(await error.context.json()).error||msg}catch{}
   throw Error(msg);
  }
  message="";
 }catch(e){message=e.message||"Falha de ligação"}
 finally{busy=false;await refresh();draw()}
}
async function resign(){
 if(!await window.EDGY_platform.confirmAction({title:"Desistir da partida?",message:"A partida será terminada e o adversário vence.",confirmLabel:"Desistir"}))return;
 await act({action:"resign"});
}
function initialSnapshot(){return rules?.initialState()}
function replayState(){
 if(review===null||!rules)return room;
 let current=initialSnapshot();
 for(const entry of (room.moves||[]).slice(0,review)){
  if(entry.type==="resign"){current.status=entry.color==="r"?"black_win":"white_win";current.ply++;continue}
  try{current=rules.applyAction(current,entry)}catch{break}
 }
 return current;
}
function squaresHTML(snapshot){
 const mine=seat(),flip=mine==="b";
 const next=(room.status==="active"&&!busy&&room.turn===mine&&review===null&&tool==="move")?rules.legalMoves(room):[];
 let html="";
 for(let showRow=0;showRow<9;showRow++)for(let showCol=0;showCol<9;showCol++){
  const r=flip?8-showRow:showRow,c=flip?8-showCol:showCol,pos=r*9+c;
  const red=pos===snapshot.red_pos,blue=pos===snapshot.blue_pos,legal=next.includes(pos);
  html+='<button type="button" class="brCell'+(r===0?" brGoalRed":"")+(r===8?" brGoalBlue":"")+(legal?" brLegal":"")+'" style="grid-row:'+(2*showRow+1)+';grid-column:'+(2*showCol+1)+'" data-br-move="'+pos+'" aria-label="Casa '+(c+1)+', '+(r+1)+(legal?", movimento possível":"")+'">'
    +(red?'<span class="brPawn red" aria-label="Vermelho"></span>':blue?'<span class="brPawn blue" aria-label="Azul"></span>':"")
    +'</button>';
 }
 return html;
}
function wallsHTML(snapshot){
 const flip=seat()==="b",walls=snapshot.walls||[];
 let html="";
 for(const w of walls){
  const r=flip?7-w.r:w.r,c=flip?7-w.c:w.c;
  html+='<span class="brWall brWall-'+w.o+'" style="grid-row:'+(2*r+(w.o==="h"?2:1))+(w.o==="h"?"":"/span 3")+';grid-column:'+(2*c+(w.o==="h"?1:2))+(w.o==="h"?"/span 3":"")+'"></span>';
  // Position wall across 2 cells, anchored at their shared gap.
 }
 return html;
}
function wallSlots(){
 if(tool!=="wall"||room.status!=="active"||room.turn!==seat()||review!==null||busy)return "";
 const flip=seat()==="b";let html="";
 for(let sr=0;sr<8;sr++)for(let sc=0;sc<8;sc++){
  const r=flip?7-sr:sr,c=flip?7-sc:sc,w={r,c,o:orientation};
  if(!rules.canPlaceWall(room,w))continue;
  html+='<button type="button" class="brSlot brSlot-'+orientation+'" style="grid-row:'+(2*sr+2)+';grid-column:'+(2*sc+2)+'" data-br-wall="'+r+','+c+','+orientation+'" aria-label="Colocar barreira '+(orientation==="h"?"horizontal":"vertical")+' na linha '+(r+1)+' e coluna '+(c+1)+'"></button>';
 }
 return html;
}
function boardHTML(snapshot){return '<div class="brBoard" aria-label="Tabuleiro de Barricade, nove por nove">'+squaresHTML(snapshot)+wallsHTML(snapshot)+wallSlots()+'</div>'}
function historyHTML(){
 const arr=Array.isArray(room.moves)?room.moves:[],step=review===null?arr.length:review;
 return '<div class="brReview"><button data-br-step="start" aria-label="Início" '+(!step?"disabled":"")+'>⏮</button><button data-br-step="prev" aria-label="Anterior" '+(!step?"disabled":"")+'>◀</button><button data-br-step="next" aria-label="Seguinte" '+(step>=arr.length?"disabled":"")+'>▶</button><button data-br-step="end" aria-label="Fim" '+(step>=arr.length?"disabled":"")+'>⏭</button><button data-br-step="live">Ao vivo</button></div>'
  +'<p class="brHistoryCaption">Jogada '+step+' de '+arr.length+(review===null?" · ao vivo":" · revisão")+'</p>'
  +'<div class="brHistoryList">'+(arr.length?arr.map((m,i)=>'<button type="button" data-br-jump="'+(i+1)+'" class="'+(step===i+1?"active":"")+'">'+(i+1)+'. '+(m.color==="r"?"🔴 ":"🔵 ")+(m.type==="wall"?"Barreira "+(m.o==="h"?"horizontal":"vertical"):m.type==="resign"?"Desistência":"Mover para "+String.fromCharCode(97+m.to%9)+(9-Math.floor(m.to/9)))+'</button>').join(""):'<p class="sub">Ainda não há jogadas.</p>')+'</div>';
}
function bind(root){
 root.querySelector("[data-back]")?.addEventListener("click",()=>nav("games"));
 root.querySelector("[data-br-create]")?.addEventListener("click",create);
 root.querySelector("[data-br-join]")?.addEventListener("click",()=>join(root.querySelector("#br-code").value.trim()));
 root.querySelector("[data-br-copy]")?.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(url());message="Convite copiado!"}catch{message=url()}draw()});
 root.querySelector("[data-br-invite]")?.addEventListener("click",()=>window.EDGY_social?.openInvite("barricade",room.code));
 root.querySelector("[data-br-resign]")?.addEventListener("click",resign);
 root.querySelectorAll("[data-br-tool]").forEach(b=>b.onclick=()=>{tool=b.dataset.brTool;draw()});
 root.querySelectorAll("[data-br-orientation]").forEach(b=>b.onclick=()=>{orientation=b.dataset.brOrientation;tool="wall";draw()});
 root.querySelectorAll("[data-br-move]").forEach(b=>b.onclick=()=>{
  const pos=Number(b.dataset.brMove);
  if(review===null&&room?.status==="active"&&seat()===room.turn&&tool==="move"&&rules.legalMoves(room).includes(pos))act({action:"move",to:pos});
 });
 root.querySelectorAll("[data-br-wall]").forEach(b=>b.onclick=()=>{
  const [r,c,o]=b.dataset.brWall.split(",");
  if(review===null&&seat()===room.turn)act({action:"wall",r:Number(r),c:Number(c),o});
 });
 root.querySelectorAll("[data-br-step]").forEach(b=>b.onclick=()=>{
  const arr=room.moves||[],value=b.dataset.brStep;
  review=value==="live"?null:value==="start"?0:value==="end"?arr.length:value==="prev"?Math.max(0,(review===null?arr.length:review)-1):Math.min(arr.length,(review===null?arr.length:review)+1);
  draw();
 });
 root.querySelectorAll("[data-br-jump]").forEach(b=>b.onclick=()=>{review=Number(b.dataset.brJump);draw()});
}
function draw(){
 const root=document.getElementById("screen");
 if(!root||game!=="barricade")return;
 root.classList.toggle("edgyLobby",!room);
 const header=ui().header("barricade",{room:room?.code||"",intro:room?"":"Estratégia · 9×9 · 10 barreiras por jogador"});
 if(!rules){root.innerHTML='<div class="brWrap edgyGamePage">'+header+'<p class="sub">A carregar o Barricade…</p></div>';bind(root);return}
 if(!me()){root.innerHTML='<div class="brWrap edgyGamePage">'+header+ui().card("Inicia sessão",'<button class="brPrimary" data-br-login>Entrar para jogar</button>')+'</div>';bind(root);root.querySelector("[data-br-login]")?.addEventListener("click",()=>window.EDGY_auth?.showEntry());return}
 if(!room){
  root.innerHTML='<div class="brWrap edgyGamePage">'+header
   +ui().card("Criar partida online",'<button class="brPrimary" data-br-create>Criar sala</button>',{description:"Joga com um amigo. Cria uma sala privada e envia o convite."})
   +ui().card("Entrar numa sala",'<input class="brCode" id="br-code" maxlength="8" placeholder="CÓDIGO" value="'+esc(pending)+'"><button class="secondary" data-br-join>Entrar</button>')
   +ui().card("As tuas salas",'<div id="edgy-barricade-rooms"></div>')
   +(message?'<p class="brMessage" role="status">'+esc(message)+'</p>':"")
   +'</div>';
  bind(root);window.EDGY_social?.renderRooms("edgy-barricade-rooms","barricade");return;
 }
 const snapshot=replayState(),turn=room.turn===seat(),active=room.status==="active"&&review===null;
 const current=seat(),opp=current==="r"?"b":"r";
 const nick=color=>esc(color==="r"?players?.white?.name||"Vermelho":players?.black?.name||"À espera de adversário");
 const player=color=>'<div class="brPlayer '+(room.turn===color&&room.status==="active"?"isTurn":"")+'"><span class="brDot '+(color==="r"?"red":"blue")+'"></span><strong>'+nick(color)+'</strong><span>'+(color==="r"?snapshot.red_walls:snapshot.blue_walls)+' barreiras</span></div>';
 const toolbar='<div class="brToolbar" aria-label="Modo de jogada">'
  +'<button type="button" data-br-tool="move" class="'+(tool==="move"?"active":"")+'">Mover peça</button>'
  +'<button type="button" data-br-orientation="h" class="'+(tool==="wall"&&orientation==="h"?"active":"")+'">Barreira —</button>'
  +'<button type="button" data-br-orientation="v" class="'+(tool==="wall"&&orientation==="v"?"active":"")+'">Barreira │</button></div>';
 const stage=player(opp)+boardHTML(snapshot)+player(current)
  +(active&&turn?toolbar:'<p class="brStageHint">'+(review!==null?"A rever uma jogada. Seleciona «Ao vivo» para voltar.":esc(status()))+'</p>')
  +(message?'<p class="brMessage" role="alert">'+esc(message)+'</p>':"")
  +'<p class="brRulesHint">Alcança o lado oposto. As barreiras não podem eliminar todos os caminhos.</p>';
 const side=ui().card("Partida & opções",'<p class="brStatus">'+esc(status())+'</p><div class="brActions"><button type="button" class="brPrimary" data-br-copy>Copiar convite</button>'
  +(room.status==="waiting"&&room.white_id===me()?.id?'<button type="button" class="secondary" data-br-invite>Convidar jogador</button>':"")
  +(room.status==="active"?'<button type="button" class="secondary" data-br-resign>Desistir</button>':"")+'</div>',{className:"brOptionPanel"})
  +ui().card("Jogadas & histórico",historyHTML(),{className:"brHistoryPanel"})
  ;
 root.innerHTML='<div class="brWrap edgyGamePage">'+header+ui().match({game:"barricade",stage,side,layoutClass:"brLayout",stageClass:"brStage",sideClass:"brSide"})+'</div>';
 ui().bindMobilePanel(root,{game:"barricade",sideSelector:".brSide",optionSelector:".brOptionPanel",historySelector:".brHistoryPanel",placementSelector:".edgyGameHeader"});
 bind(root);
}
window.EDGY_barricade={open,close,render:draw,refresh};
const incoming=new URLSearchParams(location.search).get("barricade");
if(incoming&&/^[A-F0-9]{8}$/i.test(incoming)){game="barricade";open(incoming)}
})();
