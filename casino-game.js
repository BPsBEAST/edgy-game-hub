/* EDGY Casino — virtual, non-transferable XP only.
 * All bets, outcomes, balances and transaction ids are server-authoritative.
 * Net casino winnings increase career XP; losses never reduce career XP. */
(function(){
"use strict";
const me=()=>window.EDGY_auth?.getUser?.();
const db=()=>window.EDGY_auth?.getClient?.();
const ui=()=>window.EDGY_gameUI;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=x=>Number(x||0).toLocaleString("pt-PT");
const games=Object.freeze([
 {id:"coinflip",name:"Coinflip",icon:"◒",desc:"Cara ou coroa. Acerta e recebes 2× o valor jogado."},
 {id:"roulette",name:"Roleta",icon:"◉",desc:"Aposta numa cor ou num número, entre 0 e 36."},
 {id:"slots",name:"Slots",icon:"✦",desc:"Três símbolos iguais ou dois símbolos iguais."}
]);
const limits=[10,25,50,100];
let active=false,uid="",mode="coinflip",stake=25,face="cara",roulette="red",number=17;
let wallet=null,total=null,items=[],loading=false,playing=false,result=null,message="",session=0,shownResult=0;
const acknowledgementKey=()=> "edgy_casino_18_ack_"+(me()?.id||"local");
function accepted(){try{return localStorage.getItem(acknowledgementKey())==="yes"}catch{return false}}
function acknowledge(){try{localStorage.setItem(acknowledgementKey(),"yes")}catch{}render()}
function forgetAccount(){wallet=null;total=null;items=[];result=null;message="";uid=me()?.id||""}
function close(){active=false;session++;playing=false;loading=false;result=null}
function choice(){return mode==="coinflip"?face:mode==="roulette"?(roulette==="number"?"n:"+number:roulette):"spin"}
async function refresh(silent=false){
 const identity=me()?.id||"",ticket=session;
 if(!identity||!db())return;
 if(uid!==identity)forgetAccount();
 if(!silent){loading=true;render()}
 try{
  const {data,error}=await db().rpc("edgy_wallet_status");
  if(error)throw error;
  if(ticket!==session||identity!==me()?.id)return;
  wallet=Number(data.wallet_xp)||0;total=Number(data.total_xp)||0;
  items=Array.isArray(data.transactions)?data.transactions:[];
  window.EDGY_setWallet?.(wallet,identity);
 }catch(err){if(ticket===session){message=err?.message||"Não foi possível sincronizar a carteira"}}
 finally{if(ticket===session){loading=false;if(active)render()}}
}
async function open(){
 active=true;session++;const identity=me()?.id||"";
 if(identity!==uid)forgetAccount();
 result=null;message="";
 render();
 if(identity)await refresh();
}
function chooseMode(next){
 if(playing||!games.some(g=>g.id===next))return;
 mode=next;message="";result=null;render();
}
function showMessage(text){message=text;render()}

const slotSymbols=["🍒","🍋","🍇","🍀","⭐","💎"];
const wheelNumbers=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const wheelReds=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const reduceMotion=()=>window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches===true;
const animationsPossible=()=>!reduceMotion()&&typeof Element!=="undefined"&&Boolean(Element.prototype.animate);
function wheelColor(n){return n===0?"green":wheelReds.has(n)?"red":"black"}
function slotCells(symbols){return symbols.map(s=>'<span class="cxnReelSymbol">'+esc(s)+'</span>').join("")}
function visualStart(selectedMode,host){
 if(!host||reduceMotion())return;
 if(selectedMode==="slots"){
  host.querySelector(".cxnSlotMachine")?.classList.add("is-spinning");
  host.querySelectorAll(".cxnReelWindow").forEach((win,i)=>{
   const track=win.querySelector(".cxnReelTrack");
   if(!track)return;
   track.style.setProperty("--cxn-cell",win.clientHeight+"px");
   track.innerHTML=slotCells([...slotSymbols,...slotSymbols]);
   track.classList.add("is-spinning");
  });
 }else if(selectedMode==="coinflip"){
  host.querySelector(".cxnCoin")?.classList.add("is-spinning");
 }else{
  host.querySelector(".cxnWheelRotor")?.classList.add("is-spinning");
 }
}
async function animateResult(selectedMode,out,host){
 if(!host||!host.isConnected||!animationsPossible())return;
 if(selectedMode==="slots"){
  const windows=[...host.querySelectorAll(".cxnReelWindow")];
  await Promise.all(windows.map(async(win,i)=>{
   const track=win.querySelector(".cxnReelTrack");if(!track)return;
   const size=Math.max(1,win.clientHeight),steps=19+i*5,landing=String(out.symbols?.[i]||"🍒");
   const cells=Array.from({length:steps+1},(_,j)=>j===steps?landing:slotSymbols[(j*3+i*2+Math.floor(j/4))%slotSymbols.length]);
   track.classList.remove("is-spinning");track.style.setProperty("--cxn-cell",size+"px");
   track.innerHTML=slotCells(cells);track.style.transform="translateY(0)";
   const end=-steps*size;
   const animation=track.animate([{transform:"translateY(0px)"},{transform:"translateY("+end+"px)"}],{
    duration:1250+i*270,easing:"cubic-bezier(.14,.72,.16,1)",fill:"forwards"
   });
   try{await animation.finished}catch{}
   track.style.transform="translateY("+end+"px)";animation.cancel();
  }));
  host.querySelector(".cxnSlotMachine")?.classList.remove("is-spinning");
  return;
 }
 if(selectedMode==="coinflip"){
  const coin=host.querySelector(".cxnCoin");if(!coin)return;
  coin.classList.remove("is-spinning");
  const end=2160+(out.face==="coroa"?180:0);
  const animation=coin.animate([{transform:"rotateY(0deg)"},{transform:"rotateY("+end+"deg)"}],{
   duration:1450,easing:"cubic-bezier(.16,.75,.2,1)",fill:"forwards"
  });
  try{await animation.finished}catch{}
  coin.style.transform="rotateY("+end+"deg)";animation.cancel();return;
 }
 const rotor=host.querySelector(".cxnWheelRotor");if(!rotor)return;
 rotor.classList.remove("is-spinning");
 const idx=wheelNumbers.indexOf(Number(out.number)),step=360/37;
 const end=2160-((Math.max(0,idx)+.5)*step);
 const animation=rotor.animate([{transform:"rotate(0deg)"},{transform:"rotate("+end+"deg)"}],{
  duration:1750,easing:"cubic-bezier(.12,.76,.16,1)",fill:"forwards"
 });
 try{await animation.finished}catch{}
 rotor.style.transform="rotate("+end+"deg)";animation.cancel();
}

async function play(){
 if(playing||loading||!active)return;
 if(!me()||me().is_anonymous)return showMessage("Entra numa conta EDGY registada para utilizar a carteira.");
 if(!accepted())return showMessage("Confirma primeiro que tens 18 anos ou mais.");
 if(wallet===null)return showMessage("A carteira ainda não foi carregada.");
 if(wallet<stake)return showMessage("Saldo insuficiente. Ganha XP a jogar ou a treinar.");
 const ticket=session,identity=me().id,selectedMode=mode,selectedStake=stake,selectedChoice=choice();
 playing=true;message="";result=null;render();
 const host=document.querySelector?.("#screen .cxnCasinoPanel");
 visualStart(selectedMode,host);
 let completed=false;
 try{
  const {data,error}=await db().rpc("edgy_arcade_play",{
   p_game:selectedMode,p_choice:selectedChoice,p_stake:selectedStake,p_request:crypto.randomUUID()
  });
  if(error)throw error;
  if(ticket!==session||me()?.id!==identity)return;
  if(data?.game!==selectedMode)throw new Error("Resultado da jogada inválido.");
  try{await animateResult(selectedMode,data.result||{},host)}catch(e){console.warn("EDGY casino animation:",e)}
  if(ticket!==session||me()?.id!==identity)return;
  result=data;shownResult++;
  wallet=Math.max(0,Number(data.balance)||0);
  total=Math.max(0,Number(data.total_xp)||0);
  window.EDGY_setWallet?.(wallet,identity);
  completed=true;
 }catch(err){if(ticket===session)message=err?.message||"A jogada não pôde ser concluída.";}
 finally{
  if(ticket===session){
   playing=false;render();
   if(completed){
    await refresh(true);
    try{await window.EDGY_auth?.refreshProfile?.()}catch(err){console.warn("EDGY casino profile:",err)}
   }
  }
 }
}
function historyItem(t){
 const kind={opening:"Saldo inicial",earned:"XP ganho",roulette:"Roleta",coinflip:"Coinflip",slots:"Slots"}[t.kind]||"Movimento";
 const date=Number.isFinite(Date.parse(t.at))?new Date(t.at).toLocaleDateString("pt-PT",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"";
 const delta=Number(t.delta)||0;
 return '<div class="cxnTx"><div><strong>'+esc(kind)+'</strong><small>'+esc(date)+(t.stake?' · Jogados '+fmt(t.stake)+' XP':'')+'</small></div>'
  +'<b class="'+(delta>0?'cxnGain':delta<0?'cxnLoss':'cxnNeutral')+'">'+(delta>0?'+':'')+fmt(delta)+' XP</b></div>';
}

function outcome(){
 if(!result)return "";
 const r=result,won=Number(r.payout)>0,net=Number(r.delta)||0,career=Math.max(0,Number(r.xp_awarded)||0);
 const title=won?(net>0?"Ganhaste XP!":"Recuperaste XP!"):"Sem prémio nesta ronda";
 const label=r.game==="coinflip"?(r.result?.face==="cara"?"CARA":"COROA")
  :r.game==="roulette"?"Número "+String(r.result?.number??"—"):"Slots";
 return '<section class="cxnOutcome '+(net>0?'cxnOutcomeWin':'')+'" role="status" aria-live="polite">'
  +'<span class="cxnOutcomeEyebrow">'+esc(label)+'</span><h3>'+title+'</h3>'
  +'<p>'+(won?'Prémio total: '+fmt(r.payout)+' XP · ':'')+'Lucro da ronda: <strong class="'+(net>=0?'cxnGain':'cxnLoss')+'">'+(net>0?'+':'')+fmt(net)+' XP</strong></p>'
  +'<p class="cxnCareerReward">✦ XP para subir de nível: <strong>+'+fmt(career)+'</strong></p>'
  +'<small>As perdas reduzem apenas o saldo disponível. O nível nunca desce.</small></section>';
}
function coinPanel(){
 const faceShown=result?.game==="coinflip"?result.result?.face:null;
 return '<div class="cxnCoinWrap"><div class="cxnCoinPerspective"><div class="cxnCoin"'+(faceShown==="coroa"?' style="transform:rotateY(180deg)"':'')+'>'
  +'<div class="cxnCoinFace cxnCoinFront"><span>✦</span><small>CARA</small></div>'
  +'<div class="cxnCoinFace cxnCoinBack"><span>◈</span><small>COROA</small></div>'
  +'</div></div></div>'
  +(faceShown?'<p class="cxnVisualResult">'+(faceShown==="cara"?"CARA":"COROA")+'</p>':'')
  +'<p class="cxnInputLabel">Escolhe um lado</p><div class="cxnSelections">'
  +[['cara',"Cara"],['coroa',"Coroa"]].map(([v,label])=>'<button type="button" data-cxn-face="'+v+'" class="'+(face===v?'selected':'')+'" '+(playing?'disabled':'')+'>'+label+'</button>').join("")
  +'</div><p class="cxnOdds">Probabilidade aproximada: 50% · Prémio: 2×</p>';
}
function roulettePanel(){
 const opts=[['red','Vermelho'],['black','Preto'],['green','Zero (0)'],['number','Número']];
 const gradient='conic-gradient('+wheelNumbers.map((n,i)=>{
  const c=wheelColor(n),hex=c==="red"?"#c64366":c==="black"?"#1b1927":"#269573";
  return hex+' '+(i*360/37)+'deg '+((i+1)*360/37)+'deg';
 }).join(",") +')';
 const pockets=wheelNumbers.map((n,i)=>'<span class="cxnWheelPocket" style="--angle:'+((i+.5)*360/37)+'deg">'+n+'</span>').join("");
 const settled=result?.game==="roulette"?wheelNumbers.indexOf(Number(result.result?.number)):-1;
 const settledStyle=settled>=0?';transform:rotate('+(-((settled+.5)*360/37))+'deg)':'';
 return '<div class="cxnWheelWrap"><div class="cxnRouletteTable">'
  +'<div class="cxnRoulettePointer" aria-hidden="true"></div>'
  +'<div class="cxnWheelRotor" style="background:'+gradient+settledStyle+'">'+pockets+'</div>'
  +'<span class="cxnWheelHub">'+(result?.game==="roulette"?esc(result.result?.number??"✦"):"✦")+'</span>'
  +'</div></div>'
  +'<p class="cxnInputLabel">Escolhe uma aposta</p><div class="cxnSelections cxnRouletteSelections">'
  +opts.map(([v,label])=>'<button type="button" data-cxn-roulette="'+v+'" class="'+(roulette===v?'selected '+v:'')+'" '+(playing?'disabled':'')+'>'+label+'</button>').join("")
  +'</div>'+(roulette==='number'?'<label class="cxnNumberChoice">Número (0–36) <select id="cxn-number" aria-label="Escolher número de roleta" '+(playing?'disabled':'')+'>'
    +Array.from({length:37},(_,i)=>'<option value="'+i+'"'+(i===number?' selected':'')+'>'+i+'</option>').join("")
    +'</select></label>':'')
  +'<p class="cxnOdds">Vermelho/preto: 2× · Zero/número exato: 36× · Roleta europeia (37 números)</p>';
}
function slotsPanel(){
 const symbols=result?.game==="slots"?result.result?.symbols||[]:["🍒","⭐","💎"];
 return '<div class="cxnSlotMachine '+(result?.game==="slots"&&Number(result.delta)>0?'is-winner':'')+'">'
  +'<div class="cxnSlotMarquee"><span>✦</span><strong>EDGY JACKPOT</strong><span>✦</span></div>'
  +'<div class="cxnSlotGlass"><div class="cxnReelMachine">'
  +symbols.map(s=>'<div class="cxnReelWindow"><div class="cxnReelTrack">'+slotCells([s])+'</div></div>').join("")
  +'</div><div class="cxnSlotPayline" aria-hidden="true"></div></div>'
  +'<div class="cxnSlotFooter"><span>✦ ✦ ✦</span><strong>XP SLOTS</strong><span>✦ ✦ ✦</span></div>'
  +'</div><p class="cxnInputLabel">Alinha os símbolos para ganhar</p>'
  +'<p class="cxnOdds">3 iguais: 8× · 2 iguais: 1,5× · Sem correspondência: 0×</p>';
}
function controls(){
 return '<div class="cxnStakes"><p class="cxnInputLabel">Valor a jogar</p><div class="cxnSelections cxnStakeOptions">'
  +limits.map(x=>'<button type="button" data-cxn-stake="'+x+'" class="'+(stake===x?'selected':'')+'" '+(playing||loading?'disabled':'')+'>'+x+' XP</button>').join("")
  +'</div></div><button class="primary cxnPlay" data-cxn-play type="button" '+(playing||loading||wallet===null||wallet<stake?'disabled':'')+'>'
  +(playing?'A rodar…':'Jogar '+stake+' XP')+'</button>';
}
function casinoContent(){
 return '<section class="cxnCasinoPanel"><div class="cxnPanelTitle"><h2>'+esc(games.find(g=>g.id===mode).name)+'</h2>'
  +'<span>100% XP virtual</span></div>'
  +(mode==="coinflip"?coinPanel():mode==="roulette"?roulettePanel():slotsPanel())
  +controls()+outcome()
  +'</section>';
}
function render(){
 if(!active||game!=="casino")return;
 const root=document.getElementById("screen");if(!root)return;
 root.classList.remove("edgyLobby");
 const head=ui().header("casino",{intro:"Roleta · Coinflip · Slots · XP virtual sem valor monetário"});
 let content="";
 if(!me()||me().is_anonymous){
  content=ui().card("Carteira EDGY",'<p>Para guardares o XP virtual e os resultados dos minijogos, inicia sessão numa conta EDGY.</p><button class="primary" data-cxn-login>Entrar / criar conta</button>');
 }else if(!accepted()){
  content=ui().card("Acesso aos minijogos +18",'<p>Esta área contém simulações de jogos de casino, apenas com XP virtual.</p>'
   +'<p>O XP não pode ser comprado com dinheiro, vendido, transferido ou convertido em dinheiro ou prémios reais.</p>'
   +'<p>Existem limites de 30 rondas em 24 horas. Não existe intervalo obrigatório entre jogadas.</p>'
   +'<button type="button" class="primary" data-cxn-ack>Confirmo que tenho 18 anos ou mais e quero entrar</button>');
 }else{
  const balanceText=wallet===null?"—":fmt(wallet);
  const levelXP=total===null?"—":fmt(total);
  content='<section class="cxnBalances"><div><span><span class="cxnMark">✦</span> XP Total</span><strong>'+levelXP+'</strong><small>Define o nível e nunca é gasto</small></div>'
   +'<div><span><span class="cxnMark">◈</span> XP Disponível</span><strong>'+balanceText+'</strong><small>Saldo virtual para gastar</small></div></section>'
   +'<div class="cxnGameTabs" role="group" aria-label="Escolher minijogo">'
   +games.map(g=>'<button type="button" data-cxn-mode="'+g.id+'" class="'+(mode===g.id?'active':'')+'"><span>'+g.icon+'</span><strong>'+g.name+'</strong><small>'+g.desc+'</small></button>').join("")+'</div>'
   +ui().match({game:"casino",stage:casinoContent(),
    side:ui().card("Movimentos de XP",'<div class="cxnHistory">'+(items.length?items.slice(0,12).map(historyItem).join(""):'<p class="sub">Ainda não existem movimentos.</p>')+'</div>')
     +ui().card("Regras da economia",'<p class="sub">Ganhar XP nos jogos e nos treinos aumenta o XP Total e o saldo disponível. No casino, só o lucro das apostas também aumenta o XP Total. Perder nunca reduz o nível.</p>'
       +'<p class="sub">Não existe dinheiro real, compra de fichas ou levantamento de prémios. 30 rondas por 24 horas, sem intervalo obrigatório entre jogadas.</p>'
       +'<p class="sub">As jogadas são decididas e registadas no servidor.</p>'),
    layoutClass:"cxnLayout",stageClass:"cxnStage",sideClass:"cxnSide"});
 }
 root.innerHTML='<div class="edgyGamePage cxnPage">'+head+content
  +(message?'<p class="cxnMessage" role="alert">'+esc(message)+'</p>':'')+'</div>';
 root.querySelector("[data-back]")?.addEventListener("click",()=>nav("games"));
 root.querySelector("[data-cxn-login]")?.addEventListener("click",()=>window.EDGY_auth?.showEntry?.());
 root.querySelector("[data-cxn-ack]")?.addEventListener("click",acknowledge);
 root.querySelectorAll("[data-cxn-mode]").forEach(b=>b.addEventListener("click",()=>chooseMode(b.dataset.cxnMode)));
 root.querySelectorAll("[data-cxn-stake]").forEach(b=>b.addEventListener("click",()=>{if(playing)return;stake=Number(b.dataset.cxnStake);result=null;message="";render()}));
 root.querySelectorAll("[data-cxn-face]").forEach(b=>b.addEventListener("click",()=>{if(playing)return;face=b.dataset.cxnFace;result=null;render()}));
 root.querySelectorAll("[data-cxn-roulette]").forEach(b=>b.addEventListener("click",()=>{if(playing)return;roulette=b.dataset.cxnRoulette;result=null;render()}));
 root.querySelector("#cxn-number")?.addEventListener("change",e=>{number=Number(e.target.value)||0;result=null});
 root.querySelector("[data-cxn-play]")?.addEventListener("click",play);
}
window.EDGY_casino=Object.freeze({open,close,render,refresh, syncWallet:(value,owner)=>{
 if(owner&&owner===me()?.id){wallet=Math.max(0,Number(value)||0);if(active&&game==="casino"&&!playing)render()}
}});
})();