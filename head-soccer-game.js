/* EDGY Head Soccer — original, canvas-rendered arcade football (CPU or 2P local). */
(function(){
"use strict";
const PHYS=()=>window.EDGY_headSoccerPhysics;
const UI=()=>window.EDGY_gameUI;
const SAVE="edgy_head_soccer_v1_";
const W=960,H=510;
const PALETTES=Object.freeze({
 neon:{name:"NEON",shirt:"#f77abb",accent:"#ffd5ed",skin:"#f2bca6",hair:"#38203c",eye:"#2e1c38"},
 bolt:{name:"VOLT",shirt:"#f1b35b",accent:"#fff1b8",skin:"#dfab89",hair:"#332e4f",eye:"#241f39"},
 frost:{name:"FROST",shirt:"#73d5ee",accent:"#baf5f5",skin:"#dfb69c",hair:"#334d78",eye:"#203349"}
});
const defaultCfg={mode:"cpu",difficulty:"normal",hero:"neon"};
let cfg={...defaultCfg},stats={played:0,wins:0,losses:0,best:0};
let active=false,session=null,canvas=null,ctx=null,root=null;
let frameId=0,lastFrame=0,accum=0,recorded=false,previousStatus="",flash=0;
const keyboard=new Set(),touch=new Set();
const currentUser=()=>window.EDGY_auth?.getUser?.()?.id||"local";
const key=()=>SAVE+currentUser();
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Math.floor(Number(n)||0).toLocaleString("pt-PT");
function readStorage(){
 try{
  const data=JSON.parse(localStorage.getItem(key())||"null")||{};
  cfg={...defaultCfg,...Object.fromEntries(Object.entries(data.cfg||{}).filter(([k])=>Object.hasOwn(defaultCfg,k)))};
  if(!["cpu","local"].includes(cfg.mode))cfg.mode="cpu";
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
 const cpu=cfg.mode==="cpu";
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
function onBlur(){clearInputs();if(session?.status==="playing")PHYS().pause(session)}
function onVisibility(){if(document.hidden)onBlur()}
function start(){
 if(!active||!session)return;
 if(session.status==="finished"){newMatch();return}
 if(session.status==="paused"){PHYS().pause(session);syncOverlay();return}
 PHYS().launch(session);
 lastFrame=0;accum=0;previousStatus="";syncOverlay();
}
function newMatch(){
 if(!active)return;
 clearInputs();session=PHYS().create(cfg);recorded=false;previousStatus="";flash=0;lastFrame=0;accum=0;
 syncOverlay();syncHud();paint();
}
async function reset(){
 if(!active||!session)return;
 if(["playing","paused","goal"].includes(session.status)){
  const confirm=window.EDGY_platform?.confirmAction;
  const ok=confirm?await confirm({title:"Recomeçar a partida?",message:"A partida atual será abandonada sem XP nem histórico.",confirmLabel:"Recomeçar"}):
   window.confirm("Recomeçar esta partida?");
  if(!ok||!active)return;
 }
 newMatch();
}
function mode(next){
 if(!["cpu","local"].includes(next)||session?.status!=="ready")return;
 cfg.mode=next;persist();newMatch();render();
}
function difficulty(next){
 if(!["easy","normal","hard"].includes(next)||session?.status!=="ready")return;
 cfg.difficulty=next;persist();newMatch();render();
}
function hero(next){
 if(!Object.hasOwn(PALETTES,next)||session?.status!=="ready")return;
 cfg.hero=next;persist();render();
}
function togglePause(){
 if(!active||!session)return;
 if(PHYS().pause(session)){clearInputs();syncOverlay()}
}
function finish(){
 if(recorded||session?.status!=="finished")return;
 recorded=true;
 const won=session.winner===0,local=cfg.mode==="local",earned=local?0:won?40:10;
 stats.played++;if(!local){if(won)stats.wins++;else stats.losses++}
 stats.best=Math.max(stats.best,session.score[0]);
 persist();
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
 if(s.status==="ready")
  return '<span class="hsOverlayEyebrow">EDGY FOOTBALL</span><h2>HEAD SOCCER</h2>'
   +'<p>Partidas de 60 segundos. Marca mais golos que o adversário e usa o super-remate quando a energia chegar a 100%.</p>'
   +'<button type="button" class="primary hsBegin" data-hs-start>COMEÇAR PARTIDA</button>';
 if(s.status==="paused")return '<span class="hsOverlayEyebrow">PARTIDA EM PAUSA</span><h2>PAUSA</h2>'
  +'<button type="button" class="primary hsBegin" data-hs-start>RETOMAR</button>';
 if(s.status==="finished"){
  const victory=cfg.mode==="local"?(s.winner===0?"JOGADOR 1 VENCEU!":"JOGADOR 2 VENCEU!"):
   (s.winner===0?"VENCESTE!":"PERDESTE!");
  const xp=cfg.mode==="local"?0:s.winner===0?40:10;
  return '<span class="hsOverlayEyebrow">APITO FINAL · '+s.score.join(" – ")+'</span><h2>'+victory+'</h2>'
   +'<p>'+(cfg.mode==="local"?"Partida local · sem XP":"Recompensa EDGY: +"+xp+" XP · resultado guardado no Histórico")+'</p>'
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
 const buttons=[["left","←","Esquerda"],["right","→","Direita"],["jump","↑","Saltar"],["kick","⚽","Rematar"],["power","✦","Poder"]];
 return '<div class="hsControlSet"><span class="hsControlTitle">'+title+'</span><div class="hsButtons">'
  +buttons.map(([type,icon,name])=>'<button type="button" class="hsControl hsControl-'+type+'" data-hs-press="'+player+'-'+type+'"'
   +' aria-label="'+title+' · '+name+'"><span aria-hidden="true">'+icon+'</span><small>'+name+'</small></button>').join("")
  +'</div></div>';
}
function render(){
 if(!active||typeof game!=="string"||game!=="headSoccer"||!session)return;
 const screen=document.getElementById("screen");if(!screen)return;
 screen.classList.remove("edgyLobby");
 const title=cfg.mode==="cpu"?"EDGY VS CPU":"JOGADOR 1 VS JOGADOR 2";
 const stage='<section class="hsStage"><div class="hsScoreboard">'
  +'<div class="hsSideScore"><span>EDGY</span><strong data-hs-score-a>'+session.score[0]+'</strong></div>'
  +'<div class="hsTime"><small>'+title+'</small><strong data-hs-clock>'+clock()+'</strong></div>'
  +'<div class="hsSideScore rival"><strong data-hs-score-b>'+session.score[1]+'</strong><span>'+(cfg.mode==="cpu"?"CPU":"P2")+'</span></div>'
  +'</div><div class="hsPowerRow"><div class="hsMeter"><span>✦ P1 · SUPER</span><div><i data-hs-bar-a></i></div><small data-hs-energy-a>0%</small></div>'
  +'<div class="hsMeter rival"><span>✦ '+(cfg.mode==="cpu"?"CPU":"P2")+'</span><div><i data-hs-bar-b></i></div><small data-hs-energy-b>0%</small></div></div>'
  +'<div class="hsArena" data-hs-arena><canvas data-hs-canvas width="'+W+'" height="'+H+'" aria-label="Campo de Head Soccer com duas personagens e uma bola"></canvas>'
  +'<div class="hsOverlay" data-hs-overlay></div></div>'
  +'<div class="hsBelow"><span>⏱ 60s ·'+(cfg.mode==="cpu"?" Vs. robô":" 2 jogadores")+' · Golo de ouro</span>'
  +'<div><button type="button" class="secondary" data-hs-pause>Pausa</button>'
  +'<button type="button" class="secondary" data-hs-restart>Recomeçar</button></div></div>'
  +'<div class="hsTouchControls">'+controls("p1","JOGADOR 1")
  +(cfg.mode==="local"?controls("p2","JOGADOR 2"):"")+'</div></section>';
 const pick=(name,choices,actual)=>
  '<div class="hsChoiceRow" role="group" aria-label="'+name+'">'+choices.map(([value,label])=>
   '<button type="button" data-hs-'+name+'="'+value+'" class="'+(actual===value?"selected":"")+'"'
   +(session.status!=="ready"?' disabled':'')+'>'+label+'</button>').join("")+'</div>';
 const side=UI().card("Modo de jogo",'<p>Escolhe o modo antes de começar a partida.</p>'
  +pick("mode",[["cpu","Contra robô"],["local","2 jogadores"]],cfg.mode)
  +(cfg.mode==="cpu"?'<p class="hsControlText">Dificuldade do robô</p>'+pick("difficulty",[["easy","Fácil"],["normal","Normal"],["hard","Difícil"]],cfg.difficulty):"")
  +'<p class="hsControlText">Personagem EDGY</p>'+pick("hero",[["neon","Neon"],["bolt","Volt"],["frost","Frost"]],cfg.hero))
  +UI().card("Controlos e regras",'<p><strong>Jogador 1:</strong> A/D para mover, W para saltar, J para rematar e K para o poder especial.</p>'
   +'<p><strong>Jogador 2:</strong> setas para mover/saltar, Enter para rematar, Shift direito para o especial.</p>'
   +'<p>Contra o robô, também podes usar as setas, Espaço para rematar e L para o poder especial.</p>'
   +'<p>Ganhas energia durante a partida. Quando a barra chegar a 100%, ativa o poder e remata.</p>'
   +'<p>Quando os 60 segundos terminam empatados, o próximo golo vence.</p>')
  +UI().card("XP e histórico",'<div class="hsRecords"><span><strong>'+fmt(stats.played)+'</strong><small>Partidas</small></span>'
   +'<span><strong>'+fmt(stats.wins)+'</strong><small>Vitórias CPU</small></span>'
   +'<span><strong>'+fmt(stats.best)+'</strong><small>Máx. golos</small></span></div>'
   +'<p>Vitória contra CPU: <strong>40 XP</strong>. Derrota: <strong>10 XP</strong>. Dois jogadores locais: sem XP.</p>'
   +'<p class="sub">O Histórico da EDGY regista os resultados das partidas terminadas.</p>');
 screen.innerHTML='<div class="edgyGamePage hsPage">'+UI().header("headSoccer",{intro:"Futebol arcade · 1 contra 1 · CPU ou local"})
  +UI().match({game:"headSoccer",stage,side,layoutClass:"hsLayout",stageClass:"hsGamePanel",sideClass:"hsOptions"})+'</div>';
 root=screen;
 canvas=root.querySelector("[data-hs-canvas]");ctx=canvas?.getContext("2d");
 root.querySelector("[data-back]")?.addEventListener("click",()=>nav("games"));
 root.querySelector("[data-hs-pause]")?.addEventListener("click",togglePause);
 root.querySelector("[data-hs-restart]")?.addEventListener("click",reset);
 for(const option of ["mode","difficulty","hero"])
  root.querySelectorAll("[data-hs-"+option+"]").forEach(b=>b.addEventListener("click",()=>({mode,difficulty,hero})[option](b.dataset["hs"+option[0].toUpperCase()+option.slice(1)])));
 handleTouchButtons();syncHud();syncOverlay();paint();
}
function open(){
 close();
 active=true;readStorage();session=PHYS().create(cfg);recorded=false;
 window.addEventListener("keydown",onKeyDown,{passive:false});
 window.addEventListener("keyup",onKeyUp,{passive:false});
 window.addEventListener("blur",onBlur);
 document.addEventListener("visibilitychange",onVisibility);
 render();frameId=requestAnimationFrame(tick);
}
function close(){
 active=false;session=null;root=null;canvas=null;ctx=null;
 if(frameId)cancelAnimationFrame(frameId);
 frameId=0;lastFrame=0;accum=0;recorded=false;previousStatus="";clearInputs();
 window.removeEventListener("keydown",onKeyDown);window.removeEventListener("keyup",onKeyUp);
 window.removeEventListener("blur",onBlur);document.removeEventListener("visibilitychange",onVisibility);
}
function tick(now){
 if(!active||typeof game!=="string"||game!=="headSoccer")return;
 if(!lastFrame)lastFrame=now;
 accum=Math.min(.1,accum+Math.max(0,Math.min(.09,(now-lastFrame)/1000)));
 lastFrame=now;
 const dt=1/60;
 let cycles=0;
 while(accum>=dt&&cycles<6){
  PHYS().step(session,sample(),dt);
  accum-=dt;cycles++;
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
 const sky=ctx.createLinearGradient(0,0,0,PHYS().FLOOR);
 sky.addColorStop(0,"#131328");sky.addColorStop(.57,"#4c2958");sky.addColorStop(1,"#8b5071");
 fillRect(0,0,W,H,sky);
 // stadium light beams and distant crowd, drawn procedurally
 for(let i=0;i<9;i++){
  const x=65+i*107;
  const light=ctx.createRadialGradient(x,64,0,x,64,125);
  light.addColorStop(0,"#cfb8fb24");light.addColorStop(1,"#cfb8fb00");
  fillRect(x-125,0,250,220,light);
  ellipse(x,69,5,4,"#f8e6ed");
 }
 fillRect(0,162,W,148,"#1d1d36");
 for(let r=0;r<5;r++){
  for(let i=0;i<100;i++){
   const seed=(i*113+r*53)%101;
   const colors=["#f7abcb","#7fd3c8","#d6a3eb","#bca0ce","#52496a"];
   fillRect(i*10+(r%2)*5,175+r*24+(seed%8),4,4,colors[(seed+i+r)%5]);
  }
 }
 fillRect(0,298,W,10,"#ce8db0");
 for(let i=0;i<14;i++)fillRect(i*70,300,36,6,i%2?"#ffd0e3":"#a8f2e7");
 // turf
 const grass=ctx.createLinearGradient(0,PHYS().FLOOR-28,0,H);
 grass.addColorStop(0,"#245855");grass.addColorStop(1,"#153f45");
 fillRect(0,PHYS().FLOOR-9,W,H-PHYS().FLOOR+9,grass);
 for(let i=0;i<12;i++)fillRect(i*80,PHYS().FLOOR-6,40,67,"#ffffff08");
 line(0,PHYS().FLOOR,W,PHYS().FLOOR,"#d5f7ea",4);
 line(W/2,PHYS().FLOOR-6,W/2,H,"#ccebdc58",2);
 for(const x of [0,W]){
  ctx.beginPath();ctx.arc(x===0?0:W,PHYS().FLOOR,81,Math.PI,0);ctx.strokeStyle="#ccebdc65";ctx.lineWidth=2;ctx.stroke();
 }
}
function goalPost(x,isLeft){
 const frame=isLeft?0:W-67,top=PHYS().GOAL_TOP;
 ctx.fillStyle="#10142799";ctx.fillRect(frame,top,67,PHYS().FLOOR-top);
 ctx.strokeStyle="#d9f8ed55";ctx.lineWidth=1;
 for(let yy=top+12;yy<PHYS().FLOOR;yy+=17)line(frame+4,yy,frame+63,yy,"#d9f8ed44",1);
 for(let xx=frame+9;xx<frame+67;xx+=12)line(xx,top,xx,PHYS().FLOOR,"#d9f8ed44",1);
 ctx.strokeStyle="#f5e0d7";ctx.lineWidth=7;ctx.lineCap="round";
 ctx.beginPath();ctx.moveTo(x,PHYS().FLOOR);ctx.lineTo(x,top);ctx.lineTo(isLeft?67:W-67,top);ctx.stroke();
 ellipse(x,top,7,7,"#ffe1ae");
 ctx.lineCap="butt";
}
function playerDraw(p,side){
 const palette=side===0?PALETTES[cfg.hero]:PALETTES[side===1?(cfg.hero==="frost"?"bolt":"frost"):"neon"];
 const cx=p.x,head=p.y-91;
 ellipse(cx,PHYS().FLOOR+3,38,7,"#100f2859");
 if(p.powerTime>0){
  const aura=ctx.createRadialGradient(cx,head,20,cx,head,78);
  aura.addColorStop(0,"#f6bd7352");aura.addColorStop(1,"#f6bd7300");
  fillRect(cx-80,head-80,160,160,aura);
  ctx.beginPath();ctx.arc(cx,head,48,0,Math.PI*2);ctx.strokeStyle="#ffe1a6a8";ctx.lineWidth=3;ctx.stroke();
 }
 // legs and large cartoon jersey
 line(cx-10,p.y-9,cx-11,p.y+1,"#e9b9a3",9);
 line(cx+10,p.y-9,cx+12,p.y+1,"#e9b9a3",9);
 ellipse(cx-12,p.y-1,14,6,side===0?"#f8cae4":"#b2f5ff");
 ellipse(cx+14,p.y-1,14,6,side===0?"#f8cae4":"#b2f5ff");
 rounded(cx-29,p.y-65,58,54,17);ctx.fillStyle=palette.shirt;ctx.fill();
 rounded(cx-26,p.y-61,52,10,3);ctx.fillStyle=palette.accent;ctx.fill();
 line(cx-26,p.y-53,cx-37,p.y-33,palette.skin,9);
 line(cx+26,p.y-53,cx+37,p.y-33,palette.skin,9);
 ctx.beginPath();ctx.arc(cx,head,PHYS().HEAD_R,0,Math.PI*2);ctx.fillStyle=palette.skin;ctx.fill();
 ctx.lineWidth=3;ctx.strokeStyle="#2a2237";ctx.stroke();
 // sweeping asymmetric bangs, each unique palette
 ctx.fillStyle=palette.hair;ctx.beginPath();ctx.arc(cx,head-9,PHYS().HEAD_R,Math.PI*1.05,Math.PI*1.95);
 ctx.quadraticCurveTo(cx+19,head-43,cx-29,head-4);ctx.closePath();ctx.fill();
 ctx.beginPath();ctx.moveTo(cx-25,head-21);ctx.quadraticCurveTo(cx-14,head-40,cx+12,head-22);
 ctx.lineTo(cx+5,head-17);ctx.lineTo(cx-7,head-22);ctx.closePath();ctx.fill();
 ellipse(cx+p.face*10,head+1,6,7,"#ffffff");
 ellipse(cx+p.face*11,head+1,2.6,3.7,palette.eye);
 ellipse(cx-p.face*11,head+1,5.2,6,"#fffafa");
 ellipse(cx-p.face*10,head+1,2.4,3.5,palette.eye);
 line(cx+p.face*4,head-9,cx+p.face*18,head-11,palette.eye,3);
 line(cx-p.face*17,head-10,cx-p.face*5,head-8,palette.eye,3);
 if(p.kickTime>0){
  ellipse(cx+p.face*30,p.y-18,17,10,palette.shirt);
  line(cx+p.face*20,p.y-21,cx+p.face*53,p.y-42,palette.skin,9);
 }else ellipse(cx+p.face*5,head+19,7,3,"#6b3d53");
 if(p.hitTime>0){
  ctx.font="bold 19px system-ui";ctx.textAlign="center";ctx.fillStyle="#ffe2a5";
  ctx.fillText("✦",cx+40,head-15);
 }
}
function ballDraw(){
 const b=session.ball;
 if(b.trail>0){
  for(let k=4;k>=1;k--){
   const alpha=Math.max(0,.35-k*.055)*b.trail;
   ctx.beginPath();ctx.arc(b.x-b.vx*k*.014,b.y-b.vy*k*.014,PHYS().BALL_R*(1-k*.13),0,Math.PI*2);
   ctx.fillStyle="rgba(255,179,116,"+alpha+")";ctx.fill();
  }
 }
 if(b.power>0){
  const glow=ctx.createRadialGradient(b.x,b.y,7,b.x,b.y,54);
  glow.addColorStop(0,"#ffd19f77");glow.addColorStop(1,"#ffd19f00");
  fillRect(b.x-54,b.y-54,108,108,glow);
 }
 ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.spin*.35);
 ellipse(0,0,PHYS().BALL_R,PHYS().BALL_R,"#fff3e9");
 ctx.strokeStyle="#211e30";ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,PHYS().BALL_R-1,0,Math.PI*2);ctx.stroke();
 ctx.beginPath();
 for(let i=0;i<5;i++){
  const angle=-Math.PI/2+i*Math.PI*2/5,x=Math.cos(angle)*8.6,y=Math.sin(angle)*8.6;
  i?ctx.lineTo(x,y):ctx.moveTo(x,y);
 }ctx.closePath();ctx.fillStyle="#432e51";ctx.fill();
 for(let i=0;i<5;i++){
  const a=-Math.PI/2+i*Math.PI*2/5;
  line(Math.cos(a)*11,Math.sin(a)*11,Math.cos(a)*16,Math.sin(a)*16,"#54435c",1.5);
 }
 ctx.restore();
}
function celebrationDraw(){
 if(session.status!=="goal"&&!session.suddenDeath)return;
 if(session.status==="goal"&&session.celebration){
  rounded(W/2-172,94,344,60,13);ctx.fillStyle="#21152fe8";ctx.fill();
  ctx.font="900 31px system-ui";ctx.textAlign="center";ctx.fillStyle="#ffe4b0";
  ctx.fillText(session.celebration,W/2,134);
 }else if(session.suddenDeath&&session.secondsPlayed<90){
  ctx.font="900 15px system-ui";ctx.textAlign="center";ctx.fillStyle="#ffe6bb";
  ctx.fillText("⚡ GOLO DE OURO ⚡",W/2,107);
 }
}
function paint(){
 if(!ctx||!canvas||!session)return;
 ctx.clearRect(0,0,W,H);
 background();
 goalPost(10,true);goalPost(W-10,false);
 playerDraw(session.players[0],0);playerDraw(session.players[1],1);
 ballDraw();
 celebrationDraw();
}
const api=Object.freeze({open,close,render,start,reset,pause:togglePause});
window.EDGY_headSoccer=api;
})();