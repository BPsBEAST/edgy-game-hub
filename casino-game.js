/* EDGY Casino — virtual, non-transferable XP only.
 * All bets, outcomes, balances and transaction ids are server-authoritative.
 * XP career/level is never changed by casino plays. */
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
async function play(){
 if(playing||loading||!active)return;
 if(!me()||me().is_anonymous)return showMessage("Entra numa conta EDGY registada para utilizar a carteira.");
 if(!accepted())return showMessage("Confirma primeiro que tens 18 anos ou mais.");
 if(wallet===null)return showMessage("A carteira ainda não foi carregada.");
 if(wallet<stake)return showMessage("Saldo insuficiente. Ganha XP a jogar ou a treinar.");
 playing=true;message="";result=null;render();
 const ticket=session,identity=me().id,selectedMode=mode;
 try{
  const request=crypto.randomUUID();
  const {data,error}=await db().rpc("edgy_arcade_play",{
   p_game:mode,p_choice:choice(),p_stake:stake,p_request:request
  });
  if(error)throw error;
  if(ticket!==session||me()?.id!==identity)return;
  result=data;shownResult++;
  wallet=Number(data.balance)||0;
  window.EDGY_setWallet?.(wallet,identity);
  // Fetch the auditable server ledger; do not award any career XP.
  await refresh(true);
 }catch(err){if(ticket===session)message=err?.message||"A jogada não pôde ser concluída";}
 finally{if(ticket===session){playing=false;render()}}
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
 const r=result,out=r.result||{},won=Number(r.payout)>0;
 const title=won?(Number(r.delta)>0?"Ganhaste XP!":"Recuperaste XP!"):"Sem prémio nesta ronda";
 let reveal="";
 if(r.game==="coinflip")reveal='<div class="cxnOutcomeCoin">'+(out.face==="cara"?"CARA":"COROA")+'</div>';
 if(r.game==="roulette")reveal='<div class="cxnOutcomeNumber '+esc(out.color||"")+'">'+esc(out.number)+'</div>';
 if(r.game==="slots")reveal='<div class="cxnReels cxnReelsDone">'+(out.symbols||[]).map(s=>'<span>'+esc(s)+'</span>').join("")+'</div>';
 return '<section class="cxnOutcome" role="status" aria-live="polite">'+reveal+'<h3>'+title+'</h3>'
  +'<p>'+(won?'Prémio: '+fmt(r.payout)+' XP · ':'')+'Saldo da ronda: <strong class="'+(Number(r.delta)>=0?'cxnGain':'cxnLoss')+'">'+(Number(r.delta)>0?'+':'')+fmt(r.delta)+' XP</strong></p>'
  +'<small>O XP Total e o nível não foram alterados.</small></section>';
}
function coinPanel(){
 return '<div class="cxnCoinWrap"><div class="cxnCoin'+(result?.game==="coinflip"?' cxnCoinPlayed':'')+'"><span>✦</span></div></div>'
  +'<p class="cxnInputLabel">Escolhe um lado</p><div class="cxnSelections">'
  +[['cara',"Cara"],['coroa',"Coroa"]].map(([v,label])=>'<button type="button" data-cxn-face="'+v+'" class="'+(face===v?'selected':'')+'">'+label+'</button>').join("")
  +'</div><p class="cxnOdds">Probabilidade aproximada: 50% · Prémio: 2×</p>';
}
function roulettePanel(){
 const opts=[['red','Vermelho'],['black','Preto'],['green','Zero (0)'],['number','Número']];
 return '<div class="cxnWheelWrap"><div class="cxnWheel'+(result?.game==="roulette"?' cxnWheelPlayed':'')+'"><span>'+esc(result?.game==="roulette"?result.result?.number??"✦":"✦")+'</span></div></div>'
  +'<p class="cxnInputLabel">Escolhe uma aposta</p><div class="cxnSelections cxnRouletteSelections">'
  +opts.map(([v,label])=>'<button type="button" data-cxn-roulette="'+v+'" class="'+(roulette===v?'selected '+v:'')+'">'+label+'</button>').join("")
  +'</div>'+(roulette==='number'?'<label class="cxnNumberChoice">Número (0–36) <select id="cxn-number" aria-label="Escolher número de roleta">'
    +Array.from({length:37},(_,i)=>'<option value="'+i+'"'+(i===number?' selected':'')+'>'+i+'</option>').join("")
    +'</select></label>':'')
  +'<p class="cxnOdds">Vermelho/preto: 2× · Zero/número exato: 36× · Roleta europeia (37 números)</p>';
}
function slotsPanel(){
 const symbols=result?.game==="slots"?result.result?.symbols||[]:["🍒","⭐","💎"];
 return '<div class="cxnReels'+(result?.game==="slots"?' cxnReelsPlayed':'')+'">'+symbols.map(s=>'<span>'+esc(s)+'</span>').join("")+'</div>'
  +'<p class="cxnInputLabel">Combina três símbolos</p><p class="cxnOdds">3 iguais: 8× · 2 iguais: 1,5× · Sem correspondência: 0×</p>';
}
function controls(){
 return '<div class="cxnStakes"><p class="cxnInputLabel">Valor a jogar</p><div class="cxnSelections cxnStakeOptions">'
  +limits.map(x=>'<button type="button" data-cxn-stake="'+x+'" class="'+(stake===x?'selected':'')+'" '+(playing||loading?'disabled':'')+'>'+x+' XP</button>').join("")
  +'</div></div><button class="primary cxnPlay" data-cxn-play type="button" '+(playing||loading||wallet===null||wallet<stake?'disabled':'')+'>'
  +(playing?'A calcular resultado…':'Jogar '+stake+' XP')+'</button>';
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
   +'<p>Existem limites de 30 rondas em 24 horas e um intervalo mínimo entre rondas.</p>'
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
     +ui().card("Regras da economia",'<p class="sub">Ganhar XP nos jogos e nos treinos aumenta o XP Total e o saldo disponível. Os minijogos alteram apenas o saldo.</p>'
       +'<p class="sub">Não existe dinheiro real, compra de fichas ou levantamento de prémios. 30 rondas por 24 horas, com intervalo mínimo de 5 segundos.</p>'
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