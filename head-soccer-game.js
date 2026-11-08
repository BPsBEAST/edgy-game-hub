/* EDGY Head Soccer — original, canvas-rendered arcade football (CPU or 2P local). */
(function(){
"use strict";
const PHYS=()=>window.EDGY_headSoccerPhysics;
const NET=()=>window.EDGY_headSoccerOnline;
const UI=()=>window.EDGY_gameUI;
const SAVE="edgy_head_soccer_v1_";
const W=960,H=510,FLOOR=440;
const PALETTES=Object.freeze({
 neon:{name:"NEON",shirt:"#f77abb",accent:"#ffd5ed",skin:"#f2bca6",hair:"#38203c",eye:"#2e1c38"},
 bolt:{name:"VOLT",shirt:"#f1b35b",accent:"#fff1b8",skin:"#dfab89",hair:"#332e4f",eye:"#241f39"},
 frost:{name:"FROST",shirt:"#73d5ee",accent:"#baf5f5",skin:"#dfb69c",hair:"#334d78",eye:"#203349"}
});
const defaultCfg={mode:"cpu",difficulty:"normal",hero:"neon"};
let cfg={...defaultCfg},stats={played:0,wins:0,losses:0,best:0};
let active=false,session=null,canvas=null,ctx=null,root=null,stadium=null;
let frameId=0,lastFrame=0,accum=0,recorded=false,previousStatus="",flash=0;
let onlineTarget=null,onlineFrames=0,onlineInputFrames=0,onlineFinishing=false;
let onlineLastMeta="",onlineError="",onlineLastSnapshot=0,onlineAcceptedToken="";
const keyboard=new Set(),touch=new Set();
const currentUser=()=>window.EDGY_auth?.getUser?.()?.id||"local";
const key=()=>SAVE+currentUser();
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Math.floor(Number(n)||0).toLocaleString("pt-PT");
function readStorage(){
 try{
  const data=JSON.parse(localStorage.getItem(key())||"null")||{};
  cfg={...defaultCfg,...Object.fromEntries(Object.entries(data.cfg||{}).filter(([k])=>Object.hasOwn(defaultCfg,k)))};
  if(!["cpu","local","online"].includes(cfg.mode))cfg.mode="cpu";
  if(!["easy","normal","hard"].includes(cfg.difficulty))cfg.difficulty="normal";
  if(!Object.hasOwn(PALETTES,cfg.hero))cfg.hero="neon";
  stats={played:0,wins:0,losses:0,best:0};
  for(const k of Object.keys(stats))stats[k]=Math.max(0,Math.floor(Number(data.stats?.[k])||0));
 }catch{cfg={...defaultCfg};stats={played:0,wins:0,losses:0,best:0}}
}
function persist(){
 try{localStorage.setItem(key(),JSON.stringify({cfg,stats}))}catch{}
}
function clearInputs(){keyboard.clear();touch.clear()}
function sample(){
 const has=(codes)=>codes.some(c=>keyboard.has(c));
 const pressed=(player,action,codes)=>
  touch.has(player+"-"+action)||has(codes);
 const cpu=cfg.mode!=="local";
 return {p1:{
  left:pressed("p1","left",cpu?["KeyA","ArrowLeft"]:["KeyA"]),
  right:pressed("p1","right",cpu?["KeyD","ArrowRight"]:["KeyD"]),
  jump:pressed("p1","jump",cpu?["KeyW","ArrowUp"]:["KeyW"]),
  kick:pressed("p1","kick",cpu?["KeyJ","Space"]:["KeyJ"]),
  power:pressed("p1","power",cpu?["KeyK","KeyL"]:["KeyK"])
 },p2:{
  left:pressed("p2","left",["ArrowLeft"]),
  right:pressed("p2","right",["ArrowRight"]),
  jump:pressed("p2","jump",["ArrowUp"]),
  kick:pressed("p2","kick",["Enter"]),
  power:pressed("p2","power",["ShiftRight"])
 }};
}
function onKeyDown(e){
 if(!active||window.EDGY_headSoccer!==api||typeof game!=="string"||game!=="headSoccer")return;
 if(e.altKey||e.ctrlKey||e.metaKey||e.target?.closest?.("input,textarea,select,[contenteditable]"))return;
 const allowed=new Set(["KeyA","KeyD","KeyW","KeyJ","KeyK","KeyL","ArrowLeft","ArrowRight","ArrowUp","Space","Enter","ShiftRight"]);
 if(!allowed.has(e.code))return;
 e.preventDefault();
 keyboard.add(e.code);
}
function onKeyUp(e){if(!active)return;if(keyboard.has(e.code)){keyboard.delete(e.code);e.preventDefault()}}
function onBlur(){
 clearInputs();
 if(session?.status==="playing"&&(!networkMatch()||NET()?.get?.().role==="host")){
  PHYS().pause(session);
  if(networkMatch())NET()?.control?.("pause");
  syncOverlay();
 }
}
function onVisibility(){if(document.hidden)onBlur()}
function networkMatch(){
 return cfg.mode==="online";
}
async function onlineStart(){
 const net=NET().get();
 if(!active||!networkMatch()||net.role!=="host"||net.room?.status!=="waiting")return;
 onlineError="";
 try{
  await NET().start();
  if(!active||!networkMatch())return;
  session=PHYS().create({...cfg,mode:"local"});PHYS().launch(session);
  onlineTarget=null;onlineFrames=0;onlineInputFrames=0;onlineFinishing=false;recorded=false;
  previousStatus="";lastFrame=0;accum=0;
  render();NET().frame(snapshot(),++onlineFrames);
 }catch(e){onlineError=e.message||"Não foi possível iniciar a partida";render()}
}
function start(){
 if(!active||!session)return;
 if(networkMatch()){
  if(session.status==="paused"&&NET().get().role==="host")togglePause();
  else onlineStart();
  return;
 }
 if(session.status==="finished"){newMatch();return}
 if(session.status==="paused"){PHYS().pause(session);syncOverlay();return}
 PHYS().launch(session);lastFrame=0;accum=0;previousStatus="";syncOverlay();
}
function newMatch(){
 if(!active)return;
 clearInputs();session=PHYS().create({...cfg,mode:networkMatch()?"local":cfg.mode});
 recorded=false;previousStatus="";flash=0;lastFrame=0;accum=0;onlineTarget=null;
 syncOverlay();syncHud();paint();
}
async function reset(){
 if(!active||!session||networkMatch())return;
 if(["playing","paused","goal"].includes(session.status)){
  const confirm=window.EDGY_platform?.confirmAction;
  const ok=confirm?await confirm({title:"Recomeçar a partida?",message:"A partida atual será abandonada sem XP nem histórico.",confirmLabel:"Recomeçar"}):
   window.confirm("Recomeçar esta partida?");
  if(!ok||!active)return;
 }
 newMatch();
}
function mode(next){
 if(!["cpu","local","online"].includes(next)||session?.status!=="ready")return;
 const state=NET()?.get?.();
 if(cfg.mode==="online"&&state?.room?.status==="active")return;
 if(cfg.mode==="online"&&next!=="online")NET()?.close?.();
 cfg.mode=next;persist();newMatch();render();
}
function difficulty(next){
 if(!["easy","normal","hard"].includes(next)||session?.status!=="ready")return;
 cfg.difficulty=next;persist();newMatch();render();
}
function hero(next){
 if(!Object.hasOwn(PALETTES,next)||session?.status!=="ready")return;
 cfg.hero=next;session.hero=next;persist();render();
}
function togglePause(){
 if(!active||!session)return;
 if(networkMatch()&&NET().get().role!=="host")return;
 if(PHYS().pause(session)){
  clearInputs();syncOverlay();
  if(networkMatch())NET().control(session.status==="paused"?"pause":"resume");
 }
}
function snapshot(){
 const st=session;
 return {players:st.players.map(p=>({...p})),ball:{...st.ball},score:[...st.score],
  seconds:st.seconds,status:st.status,suddenDeath:st.suddenDeath,goalPause:st.goalPause,
  winner:st.winner,celebration:st.celebration,frame:st.frame,hero:st.hero,heroGuest:st.heroGuest};
}
function onlineFrame(frame){
 if(!active||!networkMatch()||!frame||NET().get().role!=="guest")return;
 if(frame.control){
  if(session&&["pause","resume"].includes(frame.control)){
   session.status=frame.control==="pause"?"paused":"playing";
   syncOverlay();
  }
  return;
 }
 if(!Array.isArray(frame.players)||frame.players.length!==2||!frame.ball||!Array.isArray(frame.score))return;
 if(!frame.players.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))||
   !Number.isFinite(frame.ball.x)||!Number.isFinite(frame.ball.y))return;
 if(!session||session.status==="ready"||(!onlineTarget&&session.status==="paused")){
  session=PHYS().create({...cfg,mode:"local"});
  session.status=frame.status||"playing";
  render();
  // Start at the host positions rather than interpolating from the default kickoff.
  for(let i=0;i<2;i++)Object.assign(session.players[i],frame.players[i]);
  Object.assign(session.ball,frame.ball);
 }
 onlineTarget=frame;
}
function lerp(a,b,t){return a+(b-a)*t}
function animateRemote(){
 const t=onlineTarget;if(!t||!session)return;
 const blend=.48;
 const pos=["x","y"];
 for(let i=0;i<2;i++){
  const dest=t.players[i],p=session.players[i];
  for(const key of pos)p[key]=lerp(Number(p[key])||0,Number(dest[key])||0,blend);
  for(const k of ["face","energy","kickTime","kickCooldown","powerTime","grounded","hitTime","vx","vy"])
   if(k in dest)p[k]=dest[k];
 }
 for(const k of pos)session.ball[k]=lerp(Number(session.ball[k])||0,Number(t.ball[k])||0,blend);
 for(const k of ["spin","power","trail","vx","vy","effect"])
  if(k in t.ball)session.ball[k]=t.ball[k];
 session.score=[...t.score];session.seconds=t.seconds;session.suddenDeath=!!t.suddenDeath;
 session.goalPause=t.goalPause;session.winner=t.winner;session.frame=t.frame;
 session.celebration=t.celebration;session.hero=t.hero||cfg.hero;
 session.heroGuest=t.heroGuest||"frost";
 if(session.status!==t.status){session.status=t.status;syncOverlay()}
}
function recordOnline(meta){
 if(!meta||meta.status!=="finished"||!meta.match_token)return;
 const id=window.EDGY_auth?.getUser?.()?.id;
 if(!id)return;
 const saveKey="edgy_hs_record_"+id+"_"+meta.code+"_"+meta.match_token;
 try{if(localStorage.getItem(saveKey)==="1")return;localStorage.setItem(saveKey,"1")}catch{}
 const side=meta.host===id?0:1,won=meta.winner_side===side;
 const score=meta.left_score+"–"+meta.right_score;
 try{window.EDGY_recordLocalMatch?.("Head Soccer",(won?"Vitória online ":"Derrota online ")+score,0)}
 catch(e){console.warn("Head Soccer online history:",e)}
 window.EDGY_auth?.refreshProfile?.()?.catch?.(()=>{});
 window.EDGY_casino?.refresh?.(true);
}
function onlineChanged(data){
 if(!active||!networkMatch())return;
 if(data?.command==="start"){onlineStart();return}
 const meta=data?.room;
 if(meta?.status==="finished"){
  onlineFinishing=false;
  recordOnline(meta);
  if(session){session.score=[meta.left_score,meta.right_score];session.winner=meta.winner_side;session.status="finished";}
 }
 if(meta?.status==="waiting"&&session?.status!=="ready"){
  session=PHYS().create({...cfg,mode:"local"});recorded=false;onlineTarget=null;
  previousStatus="";onlineFinishing=false;onlineFrames=0;onlineInputFrames=0;
 }
 if(meta?.status==="active"&&session?.status==="ready"){
  if(data?.role==="host"){
   // A host who reconnects after reloading can resume its last locally cached snapshot.
   let recovered=null;
   try{recovered=JSON.parse(localStorage.getItem("edgy_hs_resume_"+meta.code)||"null")}catch{}
   if(recovered?.token===meta.match_token&&recovered.state?.players?.length===2){
    session=recovered.state;session.mode="local";onlineFrames=Number(recovered.seq)||0;
   }else{
    session=PHYS().create({...cfg,mode:"local"});PHYS().launch(session);
    session.seconds=Math.max(0,60-(Date.now()-Date.parse(meta.started_at))/1000);
   }
  }else{
   session=PHYS().create({...cfg,mode:"local"});session.status="paused";
  }
 }
 const label=[meta?.code,meta?.status,meta?.guest,meta?.match_token,data?.connected,data?.guestConnected,data?.hostConnected,data?.error].join("|");
 if(label!==onlineLastMeta){
  onlineLastMeta=label;render();
 }else if(meta?.status==="finished"){syncOverlay();syncHud()}
}
function finish(){
 if(recorded||session?.status!=="finished")return;
 if(networkMatch()){
  if(NET().get().role==="host"&&!onlineFinishing&&NET().get().room?.status==="active"){
   onlineFinishing=true;NET().frame(snapshot(),++onlineFrames);
   NET().finish(session.score[0],session.score[1]).catch(e=>{
    onlineFinishing=false;onlineError=e.message||"Não foi possível guardar o resultado";render();
   });
  }
  return;
 }
 recorded=true;
 const won=session.winner===0,local=cfg.mode==="local",earned=local?0:won?40:10;
 stats.played++;if(!local){if(won)stats.wins++;else stats.losses++}
 stats.best=Math.max(stats.best,session.score[0]);persist();
 const label=local?"2 jogadores · "+session.score.join("–"):
  won?"Vitória "+session.score.join("–"):"Derrota "+session.score.join("–");
 try{window.EDGY_recordLocalMatch?.("Head Soccer",label,earned)}
 catch(e){console.warn("Head Soccer XP:",e)}
 syncOverlay();
}
function clock(){
 if(!session)return "1:00";
 if(session.suddenDeath)return "OURO";
 const s=Math.max(0,Math.ceil(session.seconds));
 return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
}
function updateText(sel,value){
 const node=root?.querySelector(sel);if(node&&node.textContent!==value)node.textContent=value;
}
function syncHud(){
 if(!session)return;
 updateText("[data-hs-score-a]",String(session.score[0]));
 updateText("[data-hs-score-b]",String(session.score[1]));
 updateText("[data-hs-clock]",clock());
 updateText("[data-hs-energy-a]",Math.floor(session.players[0].energy)+"%");
 updateText("[data-hs-energy-b]",Math.floor(session.players[1].energy)+"%");
 const a=root?.querySelector("[data-hs-bar-a]"),b=root?.querySelector("[data-hs-bar-b]");
 if(a)a.style.width=session.players[0].energy+"%";
 if(b)b.style.width=session.players[1].energy+"%";
 const power=root?.querySelector('[data-hs-press="p1-power"]');
 if(power)power.classList.toggle("is-ready",session.players[0].energy>=100);
}
function overlayText(){
 if(!session)return "";
 const s=session;
 if(s.status==="playing")return "";
 if(s.status==="goal")return "";
 if(networkMatch()&&s.status==="ready"){
  const net=NET().get(),meta=net.room;
  if(!meta)return '<span class="hsOverlayEyebrow">EDGY HEAD SOCCER · ONLINE</span><h2>DESAFIA UM AMIGO</h2>'
   +'<p>Cria uma sala privada ou entra num convite para jogar contra outro utilizador em tempo real.</p>';
  if(meta.status==="active")return '<span class="hsOverlayEyebrow">A LIGAR…</span><h2>SINCRONIZAÇÃO</h2>'
   +'<p>A estabelecer a ligação de jogo com o anfitrião.</p>';
  return '<span class="hsOverlayEyebrow">SALA '+esc(meta.code)+'</span><h2>'+ (meta.guest?"PRONTOS PARA JOGAR":"À ESPERA DO ADVERSÁRIO")+'</h2>'
   +'<p>'+(meta.guest?"O anfitrião pode começar a partida.":"Convida outro jogador da EDGY ou partilha o código da sala.")+'</p>';
 }
 if(s.status==="ready")
  return '<span class="hsOverlayEyebrow">EDGY · ARCADE FOOTBALL</span><h2>HEAD SOCCER</h2>'
   +'<div class="hsReadyFaces"><span class="hsReadyPortrait hsFace-'+cfg.hero+'"><i class="hsReadyHead"></i><b>'+esc(PALETTES[cfg.hero].name)+'</b></span><span class="hsVersus">VS</span><span class="hsReadyPortrait hsFace-'+(cfg.hero==="frost"?"bolt":"frost")+'"><i class="hsReadyHead"></i><b>'+(cfg.mode==="cpu"?"CPU":"P2")+'</b></span></div>'
   +'<p>Futebol de cabeças gigantes! Salta, remata, marca golos e liberta o super-remate quando a energia chega a 100%.</p>'
   +'<button type="button" class="primary hsBegin" data-hs-start>COMEÇAR PARTIDA</button>';
 if(s.status==="paused")return '<span class="hsOverlayEyebrow">PARTIDA EM PAUSA</span><h2>PAUSA</h2>'
  +(networkMatch()&&NET().get().role==="guest"
   ?'<p>Aguarda que o anfitrião retome a partida.</p>'
   :'<button type="button" class="primary hsBegin" data-hs-start>RETOMAR</button>');
 if(s.status==="finished"){
  const victory=cfg.mode==="local"?(s.winner===0?"JOGADOR 1 VENCEU!":"JOGADOR 2 VENCEU!"):
   (s.winner===0?"VENCESTE!":"PERDESTE!");
  const playerSide=networkMatch()&&NET().get().role==="guest"?1:0;
  const xp=cfg.mode==="local"?0:s.winner===playerSide?40:10;
  const label=networkMatch()?(NET().get().room?.status==="finished"?
    "Resultado confirmado · XP creditado pelo servidor":"A guardar o resultado no servidor…"):
    (cfg.mode==="local"?"Partida local · sem XP":"Recompensa EDGY: +"+xp+" XP · resultado guardado no Histórico");
  return '<span class="hsOverlayEyebrow">APITO FINAL · '+s.score.join(" – ")+'</span><h2>'+ (networkMatch()?
      (s.winner===playerSide?"VENCESTE!":"PERDESTE!"):victory)+'</h2>'
   +'<p>'+label+'</p>'
   +'<button type="button" class="primary hsBegin" data-hs-start>NOVA PARTIDA</button>';
 }
 return "";
}
function syncOverlay(){
 if(!root||!session)return;
 const overlay=root.querySelector("[data-hs-overlay]");
 if(!overlay)return;
 const hidden=["playing","goal"].includes(session.status);
 if(hidden){overlay.hidden=true;overlay.innerHTML="";return}
 overlay.innerHTML=overlayText();
 overlay.hidden=false;
 overlay.querySelector("[data-hs-start]")?.addEventListener("click",start);
 const pause=root.querySelector("[data-hs-pause]");
 if(pause)pause.textContent=session.status==="paused"?"Retomar":"Pausa";
}
function handleTouchButtons(){
 root?.querySelectorAll("[data-hs-press]").forEach(button=>{
  const value=button.dataset.hsPress;
  const release=e=>{
   touch.delete(value);button.classList.remove("is-pressed");
   if(e&&button.hasPointerCapture?.(e.pointerId))button.releasePointerCapture(e.pointerId);
  };
  button.addEventListener("pointerdown",e=>{
   if(!["playing","goal"].includes(session?.status))return;
   if(e.cancelable)e.preventDefault();
   button.setPointerCapture?.(e.pointerId);touch.add(value);button.classList.add("is-pressed");
  });
  button.addEventListener("pointerup",release);
  button.addEventListener("pointercancel",release);
  button.addEventListener("lostpointercapture",()=>{touch.delete(value);button.classList.remove("is-pressed")});
 });
}
function controls(player,title){
 const btn=(type,icon,name)=>'<button type="button" class="hsControl hsControl-'+type+'" data-hs-press="'+player+'-'+type+'"'
  +' aria-label="'+title+' · '+name+'"><span aria-hidden="true">'+icon+'</span><small>'+name+'</small></button>';
 return '<div class="hsControlSet"><span class="hsControlTitle">'+title+'</span><div class="hsPad">'
  +'<div class="hsMovePad">'+btn("left","◀","Esquerda")+btn("right","▶","Direita")+'</div>'
  +'<div class="hsActionPad">'+btn("jump","↑","Saltar")+btn("kick","⚽","Rematar")+btn("power","⚡","Super")+'</div>'
  +'</div></div>';
}
function render(){
 if(!active||typeof game!=="string"||game!=="headSoccer"||!session)return;
 const screen=document.getElementById("screen");if(!screen)return;
 screen.classList.remove("edgyLobby");
 const online=networkMatch(),net=NET()?.get?.()||{};
 const title=online?"ONLINE · 1×1":cfg.mode==="cpu"?"EDGY VS CPU":"JOGADOR 1 VS JOGADOR 2";
 const stage='<section class="hsStage"><div class="hsScoreboard">'
  +'<div class="hsSideScore"><span>EDGY</span><strong data-hs-score-a>'+session.score[0]+'</strong></div>'
  +'<div class="hsTime"><small>'+title+'</small><strong data-hs-clock>'+clock()+'</strong></div>'
  +'<div class="hsSideScore rival"><strong data-hs-score-b>'+session.score[1]+'</strong><span>'+(online?"ONLINE":cfg.mode==="cpu"?"CPU":"P2")+'</span></div>'
  +'</div>'+(online?'<div class="hsNetworkInfo" data-hs-net>'+ (net.connected?"● Ligado à partida":"◌ A ligar ao servidor")+ '</div>':"")
  +'<div class="hsPowerRow"><div class="hsMeter"><span>✦ P1 · SUPER</span><div><i data-hs-bar-a></i></div><small data-hs-energy-a>0%</small></div>'
  +'<div class="hsMeter rival"><span>✦ '+(online?"P2":cfg.mode==="cpu"?"CPU":"P2")+'</span><div><i data-hs-bar-b></i></div><small data-hs-energy-b>0%</small></div></div>'
  +'<div class="hsArena" data-hs-arena><canvas data-hs-canvas width="'+W+'" height="'+H+'" aria-label="Campo de futebol arcade com duas personagens de cabeças grandes e uma bola"></canvas>'
  +'<div class="hsOverlay" data-hs-overlay></div></div>'
  +'<div class="hsBelow"><span>⏱ 60s ·'+(online?" Online 1×1":cfg.mode==="cpu"?" Vs. robô":" 2 jogadores")+' · Golo de ouro</span>'
  +'<div><button type="button" class="secondary" data-hs-pause '+(online&&net.role!=="host"?"disabled":"")+'>Pausa</button>'
  +'<button type="button" class="secondary" data-hs-restart '+(online?"disabled":"")+'>Recomeçar</button></div></div>'
  +'<div class="hsTouchControls">'+controls("p1",online&&net.role==="guest"?"JOGADOR 2 (TU)":"JOGADOR 1")
  +(cfg.mode==="local"?controls("p2","JOGADOR 2"):"")+'</div></section>';
 const pick=(name,choices,actual)=>
  '<div class="hsChoiceRow'+(name==="hero"?" hsHeroSelect":"")+'" role="group" aria-label="'+name+'">'+choices.map(([value,label])=>
   '<button type="button" data-hs-'+name+'="'+value+'" class="'+(actual===value?"selected":"")+'"'
   +(session.status!=="ready"?' disabled':'')+'>'
   +(name==="hero"?'<span class="hsHeroFace hsFace-'+value+'" aria-hidden="true"><i></i></span>':'')
   +label+'</button>').join("")+'</div>';
 const side=UI().card("Modo de jogo",'<p>Escolhe o modo antes de começar a partida.</p>'
  +pick("mode",[["cpu","Contra robô"],["local","2 jogadores"],["online","Online 1×1"]],cfg.mode)
  +(cfg.mode==="cpu"?'<p class="hsControlText">Dificuldade do robô</p>'+pick("difficulty",[["easy","Fácil"],["normal","Normal"],["hard","Difícil"]],cfg.difficulty):"")
  +'<p class="hsControlText">Personagem EDGY</p>'+pick("hero",[["neon","Neon"],["bolt","Volt"],["frost","Frost"]],cfg.hero))
  +(online?UI().card("Sala e convites · Online",NET().panel()):"")
  +UI().card("Controlos e regras",'<p><strong>Jogador 1:</strong> A/D para mover, W para saltar, J para rematar e K para o poder especial.</p>'
   +'<p><strong>Jogador 2:</strong> setas para mover/saltar, Enter para rematar, Shift direito para o especial.</p>'
   +'<p>Contra o robô, também podes usar as setas, Espaço para rematar e L para o poder especial.</p>'
   +'<p>Ganhas energia durante a partida. Quando a barra chegar a 100%, ativa o poder e remata.</p>'
   +'<p>Quando os 60 segundos terminam empatados, o próximo golo vence.</p>'
   +(online?'<p><strong>Online:</strong> as teclas A/D ou setas movem a tua personagem, W salta, J/Espaço remata e K/L ativa o poder. Os dois jogadores usam dispositivos separados.</p>':""))
  +UI().card("XP e histórico",'<div class="hsRecords"><span><strong>'+fmt(stats.played)+'</strong><small>Partidas</small></span>'
   +'<span><strong>'+fmt(stats.wins)+'</strong><small>Vitórias CPU</small></span>'
   +'<span><strong>'+fmt(stats.best)+'</strong><small>Máx. golos</small></span></div>'
   +'<p>Contra CPU ou online: <strong>40 XP</strong> por vitória e <strong>10 XP</strong> por derrota. Dois jogadores locais: sem XP. No modo online, a base de dados atribui os prémios uma vez, após confirmar a partida.</p>'
   +'<p class="sub">O Histórico da EDGY regista os resultados das partidas terminadas.</p>');
 screen.innerHTML='<div class="edgyGamePage hsPage">'+UI().header("headSoccer",{intro:"Futebol arcade 1×1 · Robô, local ou multiplayer online"})
  +UI().match({game:"headSoccer",stage,side,layoutClass:"hsLayout",stageClass:"hsGamePanel",sideClass:"hsOptions"})+'</div>';
 root=screen;
 canvas=root.querySelector("[data-hs-canvas]");ctx=canvas?.getContext("2d");
 root.querySelector("[data-back]")?.addEventListener("click",()=>nav("games"));
 root.querySelector("[data-hs-pause]")?.addEventListener("click",togglePause);
 root.querySelector("[data-hs-restart]")?.addEventListener("click",reset);
 for(const option of ["mode","difficulty","hero"])
  root.querySelectorAll("[data-hs-"+option+"]").forEach(b=>b.addEventListener("click",()=>({mode,difficulty,hero})[option](b.dataset["hs"+option[0].toUpperCase()+option.slice(1)])));
 handleTouchButtons();NET()?.bind?.(root);syncHud();syncOverlay();paint();
}
function open(){
 close();
 active=true;readStorage();session=PHYS().create({...cfg,mode:cfg.mode==="online"?"local":cfg.mode});recorded=false;
 NET()?.handlers?.({change:onlineChanged,frame:onlineFrame,connection:()=>{
  if(active&&networkMatch())updateText("[data-hs-net]",NET().get().connected?"● Ligado à partida":"◌ A reconectar…");
 }});
 window.addEventListener("keydown",onKeyDown,{passive:false});
 window.addEventListener("keyup",onKeyUp,{passive:false});
 window.addEventListener("blur",onBlur);
 document.addEventListener("visibilitychange",onVisibility);
 render();frameId=requestAnimationFrame(tick);
}
async function openRoom(code){
 open();
 cfg.mode="online";persist();newMatch();render();
 await NET().open(code);
}
function close(){
 active=false;session=null;root=null;canvas=null;ctx=null;
 if(frameId)cancelAnimationFrame(frameId);
 frameId=0;lastFrame=0;accum=0;recorded=false;previousStatus="";
 onlineTarget=null;onlineFrames=0;onlineInputFrames=0;onlineLastMeta="";onlineError="";
 onlineFinishing=false;clearInputs();
 NET()?.close?.();
 window.removeEventListener("keydown",onKeyDown);window.removeEventListener("keyup",onKeyUp);
 window.removeEventListener("blur",onBlur);document.removeEventListener("visibilitychange",onVisibility);
}
function tick(now){
 if(!active||typeof game!=="string"||game!=="headSoccer")return;
 if(!lastFrame)lastFrame=now;
 accum=Math.min(.1,accum+Math.max(0,Math.min(.09,(now-lastFrame)/1000)));
 lastFrame=now;
 const dt=1/60;let cycles=0;
 const net=networkMatch()?NET().get():null;
 if(networkMatch()&&net?.role==="guest"){
  animateRemote();
  if(net.room?.status==="active"&&net.connected&&now-onlineLastSnapshot>=65){
   NET().input(sample().p1,++onlineInputFrames,cfg.hero);
   onlineLastSnapshot=now;
  }
 }else{
  while(accum>=dt&&cycles<6){
   const commands=sample();
   if(networkMatch()&&net?.role==="host"){
    commands.p2=net.input;
    if(net.remoteHero)session.heroGuest=net.remoteHero;
    if(!net.guestConnected&&session.status==="playing"&&session.secondsPlayed>2){
     // No one should score while the remote player has dropped offline.
     session.status="paused";NET().control("pause");syncOverlay();
    }
   }
   PHYS().step(session,commands,dt);accum-=dt;cycles++;
  }
  if(networkMatch()&&net?.role==="host"&&net.connected&&
    net.room?.status==="active"&&now-onlineLastSnapshot>=50){
   // ~20 realtime snapshots per second, including during goal celebrations.
   onlineLastSnapshot=now;
   NET().frame(snapshot(),++onlineFrames);
   if(onlineFrames%40===0){
    try{localStorage.setItem("edgy_hs_resume_"+net.room.code,
     JSON.stringify({token:net.room.match_token,state:snapshot(),seq:onlineFrames}))}catch{}
   }
  }
 }
 if(session.status!==previousStatus){
  if(session.status==="finished")finish();
  else syncOverlay();
  previousStatus=session.status;
 }
 if(session.status==="goal")flash=Math.min(1,flash+.06);
 else flash=Math.max(0,flash-.04);
 syncHud();paint();
 frameId=requestAnimationFrame(tick);
}
function rounded(x,y,w,h,r){
 if(ctx.roundRect){ctx.beginPath();ctx.roundRect(x,y,w,h,r);return}
 ctx.beginPath();ctx.rect(x,y,w,h);
}
function fillRect(x,y,w,h,color){
 ctx.fillStyle=color;ctx.fillRect(x,y,w,h);
}
function line(x1,y1,x2,y2,color,width=2){
 ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function ellipse(x,y,rx,ry,color){
 ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
}
function background(){
 const grad=ctx.createLinearGradient(0,0,0,H);
 grad.addColorStop(0,"#65c3ee");grad.addColorStop(.49,"#b8ecfb");grad.addColorStop(.76,"#e1f9dd");grad.addColorStop(1,"#5cbb82");
 fillRect(0,0,W,H,grad);
 // Outdoor arcade sky: broad clouds, bright horizon and distant hills.
 const glow=ctx.createRadialGradient(720,42,4,720,42,222);
 glow.addColorStop(0,"#fff6d9d9");glow.addColorStop(1,"#fff4ce00");
 fillRect(470,0,490,295,glow);
 for(const cloud of [[106,87,1.15],[332,62,.88],[630,96,1.26],[840,56,.85]]){
  const [x,y,scale]=cloud;
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
  ellipse(-23,8,45,16,"#ffffffa8");ellipse(14,3,47,18,"#fffef8be");
  ellipse(-5,-6,29,24,"#ffffffd3");ellipse(31,-2,32,20,"#ffffffca");
  ctx.restore();
 }
 ctx.fillStyle="#8cc2ad";
 ctx.beginPath();ctx.moveTo(0,255);
 for(let x=0;x<=W;x+=40)ctx.lineTo(x,232+17*Math.sin(x*.017));
 ctx.lineTo(W,324);ctx.lineTo(0,324);ctx.closePath();ctx.fill();
 // Crowd stands with curved roofline and bands of spectators.
 rounded(-20,213,W+40,160,9);ctx.fillStyle="#314f78";ctx.fill();
 fillRect(0,219,W,13,"#e2edfa");
 fillRect(0,235,W,83,"#354869");
 for(let tier=0;tier<4;tier++){
  for(let n=0;n<114;n++){
   const x=n*9+(tier%2)*4;
   const seed=(n*43+tier*67)%41;
   const palette=["#ffe7b0","#f77e99","#98eaf1","#eed1fa","#b5d5e6","#678fa5","#f7ac80"];
   ellipse(x,247+tier*19+(seed%4),3.5,4.3,palette[(seed+tier)%palette.length]);
   if(seed%9===0)fillRect(x-3,257+tier*19,6,6,"#f2c89d");
  }
  fillRect(0,265+tier*19,W,3,"#afccdf7a");
 }
 fillRect(0,321,W,11,"#c1e0ea");
 fillRect(0,332,W,22,"#263450");
 for(let i=0;i<12;i++){
  const x=i*80;
  fillRect(x+2,336,76,13,i%3===0?"#df7ba5":i%3===1?"#6ac9c6":"#ffcd7a");
  ctx.fillStyle="#25384a";ctx.font="900 9px system-ui";ctx.textAlign="center";
  ctx.fillText(i%2?"EDGY":"GO! GO!",x+40,346);
 }
 // Playing field: striped bright turf, touchline and centre spot.
 const grass=ctx.createLinearGradient(0,354,0,H);
 grass.addColorStop(0,"#6dcf83");grass.addColorStop(1,"#2b9959");
 fillRect(0,354,W,H-354,grass);
 for(let i=0;i<12;i++)fillRect(i*80,354,40,H-354,i%2?"#ffffff09":"#11482f12");
 line(0,FLOOR+1,W,FLOOR+1,"#f7ffdf",5);
 line(W/2,355,W/2,H,"#ffffff73",2.5);
 ctx.beginPath();ctx.arc(W/2,FLOOR+38,95,Math.PI,0);ctx.lineWidth=2.5;ctx.strokeStyle="#fafff388";ctx.stroke();
 ellipse(W/2,FLOOR+1,5,4,"#eaffee");
 for(const x of [0,W]){
  ctx.beginPath();ctx.arc(x,FLOOR+6,87,Math.PI,0);
  ctx.strokeStyle="#f6fff094";ctx.lineWidth=2;ctx.stroke();
 }
 // Animated LED-like lights sit above the goals.
 for(let i=0;i<7;i++)ellipse(55+i*142,220,6,4,"#fff4df");
}
function goalPost(x,isLeft){
 const top=PHYS().GOAL_TOP,frame=isLeft?0:W-92,depth=92;
 const shade=ctx.createLinearGradient(frame,top,frame+depth,top);
 shade.addColorStop(0,isLeft?"#ccecf6aa":"#fff0daad");
 shade.addColorStop(1,"#d5f8ee22");
 fillRect(frame,top,depth,PHYS().FLOOR-top,shade);
 // Net grid drawn behind the moving players; the opening remains physically usable.
 for(let y=top+10;y<PHYS().FLOOR;y+=14)line(frame+2,y,frame+depth-2,y,"#ecfaffab",1.2);
 for(let xx=frame+6;xx<frame+depth;xx+=13)line(xx,top+2,xx,PHYS().FLOOR,"#ecfaff93",1.2);
 fillRect(frame,PHYS().FLOOR-4,depth,7,isLeft?"#cbe7f4":"#fee3df");
 ctx.strokeStyle="#fbfbf5";ctx.lineWidth=9;ctx.lineCap="round";ctx.lineJoin="round";
 ctx.beginPath();ctx.moveTo(x,PHYS().FLOOR);ctx.lineTo(x,top);
 ctx.lineTo(isLeft?92:W-92,top);ctx.stroke();
 ctx.strokeStyle=isLeft?"#81bae2":"#ecb5c2";ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(x+2*(isLeft?1:-1),top+9);ctx.lineTo(isLeft?89:W-89,top+9);ctx.stroke();
 ellipse(x,top,8,8,"#fffff7");
 ctx.lineCap="butt";
}
function headSoccerAvatar(p,side){
 const primary=session.hero||cfg.hero;
 const type=side===0?primary:(session.heroGuest|| (primary==="frost"?"bolt":"frost"));
 const palette=PALETTES[type],x=p.x,y=p.y,face=p.face;
 const t=session.frame/60;
 ctx.save();ctx.translate(x,y);ctx.scale(face,1);
 const bounce=(!p.grounded?2:Math.sin(t*10+side)*.6);
 ellipse(0,PHYS().FLOOR-y+5,44,8,"#214d3880");
 if(p.powerTime>0){
  const r=ctx.createRadialGradient(0,-133,27,0,-133,103);
  r.addColorStop(0,type==="frost"?"#76e5f96c":type==="bolt"?"#ffe27879":"#ffa76c8a");
  r.addColorStop(1,"#ffffff00");
  fillRect(-112,-243,224,224,r);
  ctx.beginPath();ctx.arc(0,-131,79+Math.sin(t*25)*4,0,Math.PI*2);
  ctx.strokeStyle=type==="frost"?"#a3f8ff99":type==="bolt"?"#ffeab691":"#ffbc9191";
  ctx.lineWidth=3;ctx.stroke();
 }
 // Stubby feet, animated kick and small kits.
 line(-16,-30,-19,-8,"#b98276",12);
 line(14,-30,p.kickTime>0?47:16,p.kickTime>0?-56:-8,"#b98276",12);
 ellipse(-23,-8,19,9,"#243552");
 ellipse(p.kickTime>0?52:20,p.kickTime>0?-56:-8,19,9,type==="frost"?"#ddfbff":"#fff0da");
 rounded(-38,-78,76,62,19);ctx.fillStyle=palette.shirt;ctx.fill();
 ctx.strokeStyle="#27354e";ctx.lineWidth=4;ctx.stroke();
 rounded(-31,-69,62,12,6);ctx.fillStyle=palette.accent;ctx.fill();
 line(-36,-66,-49,-45,palette.skin,15);
 line(36,-66,49,-43,palette.skin,15);
 ellipse(-51,-41,8,9,palette.skin);
 ellipse(50,-41,8,9,palette.skin);
 ctx.fillStyle="#ffffffd8";ctx.textAlign="center";ctx.font="900 21px system-ui";
 ctx.fillText(side===0?"10":"9",0,-32);
 // Oversized anime head and ears: head is larger than the entire body.
 ellipse(-60,-128,13,23,palette.skin);
 ellipse(62,-128,13,23,palette.skin);
 const skin=ctx.createRadialGradient(-27,-173,10,5,-126,99);
 skin.addColorStop(0,"#ffe6cf");skin.addColorStop(.62,palette.skin);skin.addColorStop(1,"#bb7a74");
 ctx.beginPath();ctx.ellipse(0,-131+bounce,68,66,0,0,Math.PI*2);
 ctx.fillStyle=skin;ctx.fill();ctx.strokeStyle="#343044";ctx.lineWidth=4;ctx.stroke();
 // Sharp, layered original cartoon hair. Each character has a separate silhouette.
 const hair=type==="bolt"?"#ffd264":type==="frost"?"#c7fbff":"#393157";
 ctx.fillStyle=hair;ctx.strokeStyle="#342c48";ctx.lineWidth=3;
 ctx.beginPath();
 ctx.moveTo(-65,-145);ctx.lineTo(-72,-199);
 ctx.lineTo(-45,-189);ctx.lineTo(-40,-221);ctx.lineTo(-14,-203);
 ctx.lineTo(7,-230);ctx.lineTo(27,-205);ctx.lineTo(58,-217);
 ctx.lineTo(53,-183);ctx.lineTo(78,-185);ctx.lineTo(61,-147);
 ctx.quadraticCurveTo(39,-182,16,-171);
 ctx.lineTo(3,-162);ctx.lineTo(-13,-178);
 ctx.lineTo(-38,-161);ctx.closePath();ctx.fill();ctx.stroke();
 // Headband / team stripe, independently identifiable by character.
 ctx.beginPath();ctx.moveTo(-59,-161);ctx.quadraticCurveTo(1,-182,60,-161);
 ctx.strokeStyle=type==="neon"?"#ff709f":type==="bolt"?"#f7efba":"#7bc1ed";
 ctx.lineWidth=9;ctx.stroke();
 // Big, readable eyes (look in direction of play).
 ellipse(-25,-125,18,22,"#fffef8");
 ellipse(26,-124,19,22,"#fffef8");
 ellipse(-18,-122,8,12,palette.eye);
 ellipse(32,-121,8,12,palette.eye);
 ellipse(-15,-126,3.3,5.5,"#f4fbff");
 ellipse(35,-125,3.3,5.5,"#f4fbff");
 line(-43,-154,-13,-151,palette.hair,5);
 line(11,-151,43,-156,palette.hair,5);
 ellipse(-46,-104,9,5,"#e9819190");
 ellipse(50,-103,9,5,"#e9819190");
 ctx.lineWidth=3;ctx.strokeStyle="#784d56";ctx.beginPath();
 if(p.hitTime>0)ctx.arc(13,-98,11,Math.PI*1.03,Math.PI*1.97,true);
 else ctx.arc(13,-105,13,.1,Math.PI-.1);
 ctx.stroke();
 if(p.hitTime>0){
  ctx.beginPath();ctx.arc(0,-130,76,0,Math.PI*2);
  ctx.strokeStyle="#ffebac";ctx.lineWidth=4;ctx.stroke();
  ellipse(84,-125,7,7,"#fff4af");
 }
 ctx.restore();
}
function ballDraw(){
 const b=session.ball,r=PHYS().BALL_R;
 if(b.trail>0){
  for(let i=9;i>=1;i--){
   const v=(1-i/11)*b.trail;
   ctx.beginPath();ctx.arc(b.x-b.vx*.012*i,b.y-b.vy*.012*i,Math.max(3,r*(1-i*.07)),0,Math.PI*2);
   ctx.fillStyle=b.effect==="frost"?"rgba(120,249,255,"+Math.min(.65,.4*v)+")":
    b.effect==="bolt"?"rgba(255,247,114,"+Math.min(.7,.55*v)+")":
    "rgba(255,135,74,"+Math.min(.75,.5*v)+")";
   ctx.fill();
  }
 }
 if(b.power>0){
  const tint=b.effect==="frost"?"#4de8ff":b.effect==="bolt"?"#ffef80":"#ff8a36";
  const glow=ctx.createRadialGradient(b.x,b.y,5,b.x,b.y,88);
  glow.addColorStop(0,tint+"bf");glow.addColorStop(.4,tint+"55");glow.addColorStop(1,tint+"00");
  fillRect(b.x-88,b.y-88,176,176,glow);
  const t=session.frame*.22;
  for(let i=0;i<9;i++){
   const a=i*Math.PI*2/9+t;
   line(b.x+Math.cos(a)*(r+7),b.y+Math.sin(a)*(r+7),
    b.x+Math.cos(a)*(r+23),b.y+Math.sin(a)*(r+23),tint,3);
  }
 }
 ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.spin*.4);
 const grad=ctx.createRadialGradient(-7,-10,2,0,0,r+4);
 grad.addColorStop(0,"#ffffff");grad.addColorStop(1,"#c8dce7");
 ellipse(0,0,r,r,grad);
 ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.lineWidth=2;ctx.strokeStyle="#243b4c";ctx.stroke();
 ctx.beginPath();
 for(let i=0;i<5;i++){
  const a=-Math.PI/2+i*Math.PI*2/5;const x=Math.cos(a)*11,y=Math.sin(a)*11;
  if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);
 }
 ctx.closePath();ctx.fillStyle="#3a4660";ctx.fill();
 for(let i=0;i<5;i++){
  const a=-Math.PI/2+i*Math.PI*2/5;
  line(Math.cos(a)*11,Math.sin(a)*11,Math.cos(a)*19,Math.sin(a)*19,"#42526a",2);
 }
 ctx.restore();
}
function celebrationDraw(){
 const st=session,t=st.frame/60;
 if(st.ball.power>0){
  ctx.save();ctx.font="900 28px system-ui";ctx.textAlign="center";
  ctx.lineWidth=5;ctx.strokeStyle="#20243c";
  ctx.fillStyle=st.ball.effect==="frost"?"#b5fbff":st.ball.effect==="bolt"?"#ffed9b":"#ffab75";
  ctx.strokeText(st.ball.effect==="frost"?"❄ GELADO!":st.ball.effect==="bolt"?"⚡ ELECTRO!":"🔥 SUPER REMATE!",W/2,111);
  ctx.fillText(st.ball.effect==="frost"?"❄ GELADO!":st.ball.effect==="bolt"?"⚡ ELECTRO!":"🔥 SUPER REMATE!",W/2,111);
  ctx.restore();
 }
 if(st.status==="goal"&&st.celebration){
  ctx.save();
  rounded(W/2-190,63,380,85,15);ctx.fillStyle="#243655e8";ctx.fill();
  ctx.lineWidth=3;ctx.strokeStyle="#f2d18c";ctx.stroke();
  ctx.font="1000 39px system-ui";ctx.textAlign="center";ctx.fillStyle="#fff1a5";
  ctx.fillText(st.celebration,W/2,117);
  for(let i=0;i<35;i++){
   const x=(i*193+st.frame*19)%W,yy=((i*83+st.frame*8)%235)+10;
   fillRect(x,yy,8,5,["#ffcf71","#ff8db8","#89dafa","#d6b9ed"][i%4]);
  }
  ctx.restore();
 }else if(st.suddenDeath&&st.status==="playing"){
  ctx.font="900 18px system-ui";ctx.textAlign="center";ctx.lineWidth=4;ctx.strokeStyle="#283a59";
  ctx.strokeText("⚡ GOLO DE OURO ⚡",W/2,83);
  ctx.fillStyle="#ffe8a4";ctx.fillText("⚡ GOLO DE OURO ⚡",W/2,83);
 }
}
function ensureStadium(){
 if(stadium||!ctx||typeof document?.createElement!=="function")return;
 try{
  const image=document.createElement("canvas");image.width=W;image.height=H;
  const target=image.getContext("2d");if(!target)return;
  const live=ctx;ctx=target;
  try{background();goalPost(10,true);goalPost(W-10,false)}
  finally{ctx=live}
  stadium=image;
 }catch(e){console.warn("EDGY Head Soccer background:",e)}
}
function paint(){
 if(!ctx||!canvas||!session)return;
 ensureStadium();
 ctx.clearRect(0,0,W,H);
 if(stadium)ctx.drawImage(stadium,0,0);
 else{background();goalPost(10,true);goalPost(W-10,false)}
 headSoccerAvatar(session.players[0],0);headSoccerAvatar(session.players[1],1);
 ballDraw();
 celebrationDraw();
}
const api=Object.freeze({open,openRoom,close,render,start,reset,pause:togglePause});
window.EDGY_headSoccer=api;
})();