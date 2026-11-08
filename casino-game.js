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
 {id:"blackjack",name:"Blackjack",icon:"♠",desc:"Aproxima-te dos 21 contra o dealer ou numa mesa com amigos."},
 {id:"slots",name:"Slots",icon:"✦",desc:"Três símbolos iguais ou dois símbolos iguais."}
]);
const limits=[10,25,50,100];
let active=false,uid="",mode="coinflip",stake=25,face="cara",roulette="red",number=17;
let wallet=null,total=null,items=[],loading=false,playing=false,result=null,message="",session=0,shownResult=0;
let autoStake=null,autoCount=10,autoSession=null,autoSummary=null;
const acknowledgementKey=()=> "edgy_casino_18_ack_"+(me()?.id||"local");
function accepted(){try{return localStorage.getItem(acknowledgementKey())==="yes"}catch{return false}}
function acknowledge(){try{localStorage.setItem(acknowledgementKey(),"yes")}catch{}render()}
function forgetAccount(){wallet=null;total=null;items=[];result=null;message="";autoStake=null;autoSession=null;autoSummary=null;uid=me()?.id||""}
function close(){if(autoSession)autoSession.stop=true;autoSession=null;active=false;session++;playing=false;loading=false;result=null;window.EDGY_casinoTables?.close?.()}
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
 if(playing||autoSession?.active||!games.some(g=>g.id===next))return;
 mode=next;window.EDGY_casinoTables?.chooseKind?.(next);message="";result=null;render();
}
async function openRoom(next,code){
 if(!["blackjack","roulette","coinflip"].includes(next))return;
 active=true;session++;mode=next;result=null;message="";
 const identity=me()?.id||"";if(identity!==uid)forgetAccount();
 render();if(identity)refresh(true);
 await window.EDGY_casinoTables?.open?.(next,code);
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
   track.style.setProperty("--cxn-cell",(win.clientHeight/3)+"px");
   track.innerHTML=slotCells([...slotSymbols,...slotSymbols,...slotSymbols,...slotSymbols]);
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
   const grid=Array.isArray(out.grid)&&out.grid.length===3?out.grid:[["🍒","🍋","🍇"],out.symbols||["🍒","⭐","💎"],["🍀","⭐","💎"]];
   const landing=grid.map(row=>String(row?.[i]||"🍒"));
   const size=Math.max(1,win.clientHeight/3),steps=21+i*6;
   const cells=Array.from({length:steps},(_,j)=>slotSymbols[(j*3+i*2+Math.floor(j/4))%slotSymbols.length]).concat(landing);
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

function lockAutoStake(){
 if(mode!=="slots"||playing||autoSession?.active)return;
 autoStake=autoStake===null?stake:null;autoSummary=null;message="";render();
}
function selectAutoCount(n){
 if(mode!=="slots"||autoSession?.active||!Number.isInteger(n)||n<1||n>500)return;
 autoCount=n;autoSummary=null;render();
}
function stopAuto(){
 if(!autoSession?.active)return;
 autoSession.stop=true;
 const button=document.querySelector?.("[data-cxn-auto-stop]");
 if(button){button.disabled=true;button.textContent="A terminar o giro atual…"}
}
async function runAuto(){
 if(mode!=="slots"||autoSession?.active||playing||loading||!active)return;
 if(autoStake===null)return showMessage("Bloqueia primeiro um valor de aposta para os giros automáticos.");
 if(!me()||me().is_anonymous||!accepted())return showMessage("Entra na tua conta EDGY para utilizar os Slots.");
 if(wallet===null||wallet<autoStake)return showMessage("XP disponível insuficiente para começar.");
 const identity=me().id,ticket=session;
 const batch={active:true,stop:false,done:0,planned:autoCount,stake:autoStake,profit:0,wins:0,reason:"",identity,ticket};
 autoSession=batch;autoSummary=null;stake=autoStake;message="";render();
 try{
  while(batch.done<batch.planned&&!batch.stop&&active&&ticket===session&&me()?.id===identity){
   if(wallet<batch.stake){batch.reason="Saldo de XP insuficiente para continuar.";break}
   const data=await play(true);
   if(!data){batch.reason=message||"Sequência interrompida por um erro.";break}
   batch.done++;
   batch.profit+=Number(data.delta)||0;
   if(Number(data.delta)>0)batch.wins++;
   if(!active||ticket!==session||me()?.id!==identity)break;
   if(batch.done<batch.planned&&!batch.stop)render();
  }
 }finally{
  if(autoSession===batch){
   batch.active=false;
   if(batch.stop&&!batch.reason)batch.reason="Sequência interrompida por ti.";
   autoSummary={done:batch.done,planned:batch.planned,stake:batch.stake,profit:batch.profit,wins:batch.wins,reason:batch.reason};
   autoSession=null;
   if(active&&ticket===session&&me()?.id===identity){
    render();
    await refresh(true);
    try{await window.EDGY_auth?.refreshProfile?.()}catch(e){console.warn("EDGY auto slots profile:",e)}
   }
  }
 }
}
async function play(autoMode=false){
 const isAuto=autoMode===true;
 if(playing||loading||!active||(!isAuto&&autoSession?.active))return null;
 if(!me()||me().is_anonymous){showMessage("Entra numa conta EDGY registada para utilizar a carteira.");return null}
 if(!accepted()){showMessage("Confirma primeiro que tens 18 anos ou mais.");return null}
 if(wallet===null){showMessage("A carteira ainda não foi carregada.");return null}
 if(wallet<stake){showMessage("Saldo insuficiente. Ganha XP a jogar ou a treinar.");return null}
 const ticket=session,identity=me().id,selectedMode=mode,selectedStake=stake,selectedChoice=choice();
 if(!isAuto)autoSummary=null;
 playing=true;message="";result=null;render();
 const host=document.querySelector?.("#screen .cxnCasinoPanel");
 visualStart(selectedMode,host);
 let completed=false,completedData=null;
 try{
  const {data,error}=await db().rpc("edgy_arcade_play",{
   p_game:selectedMode,p_choice:selectedChoice,p_stake:selectedStake,p_request:crypto.randomUUID()
  });
  if(error)throw error;
  if(ticket!==session||me()?.id!==identity)return null;
  if(data?.game!==selectedMode)throw new Error("Resultado da jogada inválido.");
  try{await animateResult(selectedMode,data.result||{},host)}catch(e){console.warn("EDGY casino animation:",e)}
  if(ticket!==session||me()?.id!==identity)return null;
  result=data;shownResult++;
  wallet=Math.max(0,Number(data.balance)||0);
  total=Math.max(0,Number(data.total_xp)||0);
  window.EDGY_setWallet?.(wallet,identity);
  completedData=data;completed=true;
 }catch(err){if(ticket===session)message=err?.message||"A jogada não pôde ser concluída.";}
 finally{
  if(ticket===session){
   playing=false;render();
   if(completed&&!isAuto){
    await refresh(true);
    try{await window.EDGY_auth?.refreshProfile?.()}catch(err){console.warn("EDGY casino profile:",err)}
   }
  }
 }
 return completedData;
}
function historyItem(t){
 const kind={opening:"Saldo inicial",earned:"XP ganho",roulette:"Roleta",coinflip:"Coinflip",slots:"Slots",blackjack:"Blackjack",blackjack_payout:"Prémio Blackjack"}[t.kind]||"Movimento";
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
 const out=result?.game==="slots"?result.result||{}:{};
 const grid=Array.isArray(out.grid)&&out.grid.length===3?out.grid:[["🍒","🍇","🍋"],["🍒","⭐","💎"],["🍀","🍋","⭐"]];
 const hits=Array.isArray(out.lines)?out.lines:[0,0,0];
 const winner=result?.game==="slots"&&Number(result.delta)>0;
 return '<div class="cxnSlotMachine cxnSlotThree '+(winner?'is-winner':'')+'">'
  +'<div class="cxnSlotMarquee"><span>✦</span><strong>EDGY · 3 LINHAS</strong><span>✦</span></div>'
  +'<div class="cxnSlotGlass"><div class="cxnReelMachine">'
  +Array.from({length:3},(_,col)=>'<div class="cxnReelWindow" aria-label="Rolo '+(col+1)+'">'
   +'<div class="cxnReelTrack">'+slotCells(grid.map(row=>row?.[col]||"🍒"))+'</div></div>').join("")
  +'</div><div class="cxnSlotLines" aria-hidden="true">'
  +[0,1,2].map(row=>'<span class="cxnPayline'+(hits[row]>=2?' is-hit':'')+(hits[row]===3?' is-jackpot':'')+'" style="top:'+((row+.5)*100/3).toFixed(3)+'%">'
     +'<b>'+String(row+1)+'</b></span>').join("")
  +'</div></div>'
  +'<div class="cxnSlotFooter"><span>✦ ✦ ✦</span><strong>3 ROLOS · 3 LINHAS</strong><span>✦ ✦ ✦</span></div>'
  +'</div>'
  +(result?.game==="slots"?'<div class="cxnPaylineResults" aria-label="Resultados das três linhas">'
    +hits.map((v,i)=>'<span class="'+(v>=2?'is-hit':'')+'">Linha '+(i+1)+' · '+(v===3?'3 iguais':v===2?'2 iguais':'Sem prémio')+'</span>').join("")+'</div>':'')
  +'<p class="cxnInputLabel">Três linhas horizontais premiadas individualmente</p>'
  +'<p class="cxnOdds">O valor total é dividido pelas 3 linhas · 3 iguais: 8× da linha · 2 iguais: 1,5× da linha. Os prémios somam-se.</p>';
}
function autoPanel(){
 if(mode!=="slots")return "";
 const running=autoSession?.active===true,summary=running?autoSession:autoSummary;
 const locked=autoStake!==null,canStart=locked&&!running&&!playing&&!loading&&wallet!==null&&wallet>=autoStake;
 return '<section class="cxnAutoPanel" aria-label="Giros automáticos">'
  +'<div class="cxnAutoHead"><div><span class="cxnAutoEyebrow">AUTO SPIN</span><h3>Slots automáticos</h3></div>'
  +'<span class="cxnAutoStatus">'+(running?'Em execução':locked?'Aposta bloqueada':'Configurar')+'</span></div>'
  +'<p class="cxnAutoHint">Fixa a aposta por giro e escolhe quantas vezes queres rodar. Podes parar após o giro atual.</p>'
  +'<div class="cxnAutoLock"><div><span>Aposta fixa por giro</span><strong>'+fmt(locked?autoStake:stake)+' XP</strong></div>'
  +'<button type="button" class="secondary" data-cxn-auto-lock '+(running||playing?'disabled':'')+'>'
  +(locked?'Desbloquear aposta':'Bloquear '+fmt(stake)+' XP')+'</button></div>'
  +'<p class="cxnInputLabel">Quantidade de giros</p><div class="cxnAutoCounts" role="group" aria-label="Escolher giros automáticos">'
  +[5,10,25,50,100].map(n=>'<button type="button" data-cxn-auto-count="'+n+'" class="'+(autoCount===n?'selected':'')+'" '+(running||playing?'disabled':'')+'>'+n+'</button>').join("")
  +'</div><label class="cxnAutoCustom">Número personalizado (1–500 giros) <input type="number" id="cxn-auto-custom" min="1" max="500" step="1" value="'+autoCount+'" '+(running||playing?'disabled':'')+'></label>'
  +(running
   ?'<button type="button" class="cxnAutoStop" data-cxn-auto-stop '+(autoSession.stop?'disabled':'')+'>'
     +(autoSession.stop?'A terminar o giro atual…':'Parar giros automáticos')+'</button>'
   :'<button type="button" class="primary cxnAutoStart" data-cxn-auto-start '+(canStart?'':'disabled')+'>Iniciar '+autoCount+' giros · '+fmt(autoStake??stake)+' XP cada</button>')
  +(summary?'<div class="cxnAutoSummary" role="status" aria-live="polite"><div><strong>'+summary.done+' / '+summary.planned+' giros</strong>'
    +'<span>Lucro líquido: <b class="'+(summary.profit>=0?'cxnGain':'cxnLoss')+'">'+(summary.profit>0?'+':'')+fmt(summary.profit)+' XP</b></span></div>'
    +'<div class="cxnAutoTrack"><span style="width:'+Math.min(100,Math.max(0,summary.done/summary.planned*100))+'%"></span></div>'
    +(running?'<small>'+(summary.stop?'A parar…':'A rodar automaticamente…')+'</small>'
      :'<small>'+(summary.reason?esc(summary.reason):'Sequência concluída.')+' · '+summary.wins+' giros com lucro</small>')
    +'</div>':'')
  +'<small class="cxnAutoFootnote">Só é usado XP virtual disponível. Cada giro é validado pelo servidor. A sequência termina se faltar saldo, houver erro ou saíres do casino.</small>'
  +'</section>';
}
function controls(){
 return '<div class="cxnStakes"><p class="cxnInputLabel">Valor a jogar</p><div class="cxnSelections cxnStakeOptions">'
  +limits.map(x=>'<button type="button" data-cxn-stake="'+x+'" class="'+(stake===x?'selected':'')+'" '+(playing||loading||autoSession?.active||(mode==='slots'&&autoStake!==null)?'disabled':'')+'>'+x+' XP</button>').join("")
  +'</div></div><button class="primary cxnPlay" data-cxn-play type="button" '+(playing||loading||autoSession?.active||wallet===null||wallet<stake?'disabled':'')+'>'
  +(playing?'A rodar…':'Jogar '+stake+' XP')+'</button>';
}
function casinoContent(){
 const socialGame=mode!=="slots",tables=window.EDGY_casinoTables;
 const tablePanel=socialGame?tables?.panel?.(mode)||"":"";const tableMode=socialGame&&tables?.isTableMode?.(mode);
 return '<section class="cxnCasinoPanel"><div class="cxnPanelTitle"><h2>'+esc(games.find(g=>g.id===mode).name)+'</h2>'
  +'<span>100% XP virtual</span></div>'
  +tablePanel
  +(tableMode?"":(mode==="coinflip"?coinPanel():mode==="roulette"?roulettePanel():slotsPanel())+controls()+autoPanel()+outcome())
  +'</section>';
}
function render(){
 if(!active||game!=="casino")return;
 const root=document.getElementById("screen");if(!root)return;
 root.classList.remove("edgyLobby");
 const head=ui().header("casino",{intro:"Blackjack · Roleta · Coinflip · Slots · Contra robô ou amigos · XP virtual"});
 let content="";
 if(!me()||me().is_anonymous){
  content=ui().card("Carteira EDGY",'<p>Para guardares o XP virtual e os resultados dos minijogos, inicia sessão numa conta EDGY.</p><button class="primary" data-cxn-login>Entrar / criar conta</button>');
 }else if(!accepted()){
  content=ui().card("Acesso aos minijogos +18",'<p>Esta área contém simulações de jogos de casino, apenas com XP virtual.</p>'
   +'<p>O XP não pode ser comprado com dinheiro, vendido, transferido ou convertido em dinheiro ou prémios reais.</p>'
   +'<p>Podes jogar as vezes que quiseres, sem limites diários nem tempo de espera entre jogadas.</p>'
   +'<button type="button" class="primary" data-cxn-ack>Confirmo que tenho 18 anos ou mais e quero entrar</button>');
 }else{
  const balanceText=wallet===null?"—":fmt(wallet);
  const levelXP=total===null?"—":fmt(total);
  const career=total===null?null:window.EDGY_levelInfo?.(total);
  const levelHint=career?'Nível '+career.level+' · '+fmt(career.progress)+'/'+fmt(career.required)+' XP':'Define o nível e nunca é gasto';
  content='<section class="cxnBalances"><div><span><span class="cxnMark">✦</span> XP Total</span><strong>'+levelXP+'</strong><small>'+levelHint+'</small></div>'
   +'<div><span><span class="cxnMark">◈</span> XP Disponível</span><strong>'+balanceText+'</strong><small>Saldo virtual para gastar</small></div></section>'
   +'<div class="cxnGameTabs" role="group" aria-label="Escolher minijogo">'
   +games.map(g=>'<button type="button" data-cxn-mode="'+g.id+'" class="'+(mode===g.id?'active':'')+'"><span>'+g.icon+'</span><strong>'+g.name+'</strong><small>'+g.desc+'</small></button>').join("")+'</div>'
   +ui().match({game:"casino",stage:casinoContent(),
    side:ui().card("Movimentos de XP",'<div class="cxnHistory">'+(items.length?items.slice(0,12).map(historyItem).join(""):'<p class="sub">Ainda não existem movimentos.</p>')+'</div>')
     +ui().card("Regras da economia",'<p class="sub">Ganhar XP nos jogos e nos treinos aumenta o XP Total e o saldo disponível. No casino, só o lucro das apostas também aumenta o XP Total. Perder nunca reduz o nível.</p>'
       +'<p class="sub">Não existe dinheiro real, compra de fichas ou levantamento de prémios. Podes jogar sem limite de rondas, desde que tenhas XP disponível.</p>'
       +'<p class="sub">As jogadas são decididas e registadas no servidor.</p>'),
    layoutClass:"cxnLayout",stageClass:"cxnStage",sideClass:"cxnSide"});
 }
 root.innerHTML='<div class="edgyGamePage cxnPage">'+head+content
  +(message?'<p class="cxnMessage" role="alert">'+esc(message)+'</p>':'')+'</div>';
 root.querySelector("[data-back]")?.addEventListener("click",()=>nav("games"));
 root.querySelector("[data-cxn-login]")?.addEventListener("click",()=>window.EDGY_auth?.showEntry?.());
 root.querySelector("[data-cxn-ack]")?.addEventListener("click",acknowledge);
 root.querySelectorAll("[data-cxn-mode]").forEach(b=>b.addEventListener("click",()=>chooseMode(b.dataset.cxnMode)));
 root.querySelectorAll("[data-cxn-stake]").forEach(b=>b.addEventListener("click",()=>{if(playing||autoSession?.active||(mode==='slots'&&autoStake!==null))return;stake=Number(b.dataset.cxnStake);result=null;message="";render()}));
 root.querySelectorAll("[data-cxn-face]").forEach(b=>b.addEventListener("click",()=>{if(playing)return;face=b.dataset.cxnFace;result=null;render()}));
 root.querySelectorAll("[data-cxn-roulette]").forEach(b=>b.addEventListener("click",()=>{if(playing)return;roulette=b.dataset.cxnRoulette;result=null;render()}));
 root.querySelector("#cxn-number")?.addEventListener("change",e=>{number=Number(e.target.value)||0;result=null});
 root.querySelector("[data-cxn-play]")?.addEventListener("click",play);
 root.querySelector("[data-cxn-auto-lock]")?.addEventListener("click",lockAutoStake);
 root.querySelectorAll("[data-cxn-auto-count]").forEach(b=>b.addEventListener("click",()=>selectAutoCount(Number(b.dataset.cxnAutoCount))));
 root.querySelector("#cxn-auto-custom")?.addEventListener("change",e=>selectAutoCount(Number(e.target.value)));
 root.querySelector("[data-cxn-auto-start]")?.addEventListener("click",runAuto);
 root.querySelector("[data-cxn-auto-stop]")?.addEventListener("click",stopAuto);
 window.EDGY_casinoTables?.bind?.(root,mode);
}
window.EDGY_casino=Object.freeze({open,openRoom,close,render,refresh, syncWallet:(value,owner)=>{
 if(owner&&owner===me()?.id){wallet=Math.max(0,Number(value)||0);if(active&&game==="casino"&&!playing)render()}
}});
})();