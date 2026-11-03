/* EDGY Casino multiplayer tables.
 * Every wager, card, shuffle and settlement is validated by the Supabase RPC.
 * "Robô" = a dealer at the table; no purchasable currency or player-to-player transfer. */
(function(){
"use strict";
const api=()=>window.EDGY_auth?.getClient?.();
const me=()=>window.EDGY_auth?.getUser?.();
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=x=>Number(x||0).toLocaleString("pt-PT");
const kinds=["blackjack","roulette","coinflip"];
const names={blackjack:"Blackjack",roulette:"Roleta",coinflip:"Cara ou Coroa"};
const selected={blackjack:"robot",roulette:"robot",coinflip:"robot"};
const choices={blackjack:"deal",roulette:"red",coinflip:"cara"};
let stake=25,room=null,code="",kind="",busy=false,message="",poll=null,token=0,signature="",processedRound="";
const own=()=>room?.my_id===me()?.id;
const host=()=>room?.host===me()?.id;
function stop(){if(poll)clearInterval(poll);poll=null}
function clear(){token++;stop();room=null;code="";kind="";message="";busy=false;signature="";processedRound=""}
function close(){clear()}
function draw(){window.EDGY_casino?.render?.()}
function isTableMode(game){return game==="blackjack"||selected[game]==="friends"}
function chooseKind(next){
 if(!kinds.includes(next))return;
 if(code&&kind!==next)clear();
 kind=next;
}
function chooseMode(next){return selected[next]||"robot"}
function setView(game,view){
 if(!kinds.includes(game)||!["robot","friends"].includes(view)||busy)return;
 chooseKind(game);if(view!==selected[game])clear();
 selected[game]=view;kind=game;message="";draw();
}
function watch(){
 stop();poll=setInterval(()=>{if(document.visibilityState!=="hidden")refresh()},2100);
}
async function refresh(force=false){
 if(!code||!api())return;
 const current=code,ticket=token;
 try{
  const {data,error}=await api().rpc("edgy_casino_room_state",{p_code:current});
  if(error)throw error;
  if(ticket!==token||code!==current)return;
  const stamp=JSON.stringify(data);
  const finished=data.status==="finished"&&data.round>0;
  if(finished){
   const key=current+":"+data.round;
   if(processedRound!==key){
    processedRound=key;
    window.EDGY_casino?.refresh?.(true);
    window.EDGY_auth?.refreshProfile?.();
   }
  }
  if(force||signature!==stamp){signature=stamp;room=data;message="";draw()}
 }catch(e){if(ticket===token){message=e.message||"Não foi possível atualizar a mesa";draw()}}
}
async function open(game,roomCode){
 if(!kinds.includes(game))return;
 clear();kind=game;selected[game]="friends";
 code=String(roomCode||"").toUpperCase().trim();
 draw();
 if(!/^[0-9A-F]{8}$/.test(code)){code="";message="Código de mesa inválido";draw();return}
 const ticket=token;
 try{
  const {error}=await api().rpc("edgy_casino_room_join",{p_code:code});
  if(error)throw error;
  if(ticket!==token)return;
  watch();await refresh(true);
 }catch(e){if(ticket!==token)return;message=e.message||"Não foi possível entrar na mesa";code="";room=null;draw()}
}
async function create(game,bot){
 if(busy||!api()||!me()||me().is_anonymous)return;
 clear();kind=game;selected[game]=bot?"robot":"friends";
 busy=true;draw();const ticket=token;
 try{
  const {data,error}=await api().rpc("edgy_casino_room_create",{p_game:game,p_bot:bot});
  if(error)throw error;
  if(ticket!==token)return;
  code=String(data||"").toUpperCase();watch();await refresh(true);
 }catch(e){if(ticket===token)message=e.message||"Não foi possível criar a mesa"}
 finally{if(ticket===token){busy=false;draw()}}
}
async function joinFromInput(){
 const input=document.getElementById("cxtJoinCode");
 const value=String(input?.value||"").trim().toUpperCase();
 if(!/^[0-9A-F]{8}$/.test(value)){message="O código precisa de 8 caracteres.";draw();return}
 await open(kind,value);
}
async function action(method,extra={}){
 if(busy||!code||!api())return;
 busy=true;message="";draw();
 const ticket=token,oldCode=code;
 try{
  const calls={
   bet:["edgy_casino_room_bet",{p_code:code,p_stake:stake,p_choice:choices[kind]||"deal"}],
   cancel:["edgy_casino_room_cancel",{p_code:code}],
   leave:["edgy_casino_room_action",{p_code:code,p_action:"leave"}],
   start:["edgy_casino_room_action",{p_code:code,p_action:"start"}],
   hit:["edgy_casino_room_action",{p_code:code,p_action:"hit"}],
   stand:["edgy_casino_room_action",{p_code:code,p_action:"stand"}],
   next:["edgy_casino_room_action",{p_code:code,p_action:"next"}]
  };
  const call=calls[method];if(!call)return;
  const {error}=await api().rpc(call[0],call[1]);
  if(error)throw error;
  if(ticket!==token||code!==oldCode)return;
  if(method==="cancel"||method==="leave"){const previousKind=kind;clear();selected[previousKind]="friends";draw();return}
  await refresh(true);
 }catch(e){if(ticket===token)message=e.message||"A ação não foi concluída"}
 finally{if(ticket===token){busy=false;draw()}}
}
function card(n,hidden=false){
 if(hidden||!Number.isInteger(n)||n<0||n>51)return '<span class="cxtCard cxtBack" aria-label="Carta virada para baixo">✦</span>';
 const i=n%13,s=Math.floor(n/13),red=s===1||s===2;
 const face=["A","2","3","4","5","6","7","8","9","10","J","Q","K"][i],sign=["♠","♥","♦","♣"][s];
 return '<span class="cxtCard'+(red?' cxtRed':'')+'" aria-label="'+face+sign+'"><strong>'+face+'</strong><span>'+sign+'</span></span>';
}
function cards(values){return (Array.isArray(values)?values:[]).map(v=>card(v,v===-1)).join("")}
function players(){
 return '<div class="cxtSeats">'+(room?.players||[]).map(p=>{
  const isMe=p.id===room.my_id,playing=room.status==="playing";
  return '<div class="cxtSeat'+(isMe?' mine':'')+'"><span class="cxtAvatar">'+esc((p.name||"J").slice(0,1).toUpperCase())+'</span>'
   +'<div class="cxtSeatInfo"><strong>'+esc(p.name)+(isMe?' (tu)':'')+'</strong>'
   +'<small>'+(p.stake?fmt(p.stake)+' XP'+(playing?' · '+(p.done?'Terminou':'A jogar'):' · Aposta pronta'):'A escolher aposta')+'</small></div>'
   +(room.game==="blackjack"&&p.hand?.length?'<div class="cxtSeatHand">'+cards(p.hand)
     +'<span class="cxtHandTotal">'+fmt(p.total)+'</span></div>':'')
   +(p.result?'<small class="cxtSeatResult">'+esc(p.result)+(room.game==="blackjack"?'':' · '+fmt(p.payout)+' XP')+'</small>':'')
   +'</div>';
 }).join("")+'</div>';
}
function botChoice(game){
 return '<div class="cxtModes" role="group" aria-label="Escolher adversário">'
  +'<button type="button" data-cxt-view="robot" class="'+(selected[game]==="robot"?'active':'')+'">✦ Contra robô</button>'
  +'<button type="button" data-cxt-view="friends" class="'+(selected[game]==="friends"?'active':'')+'">♟ Jogar com amigos</button></div>';
}
function betOptions(){
 const wait=busy||room?.status!=="waiting";
 return '<div class="cxtBet"><p class="cxnInputLabel">A tua aposta</p>'
  +'<div class="cxnSelections cxnStakeOptions">'
  +[10,25,50,100].map(x=>'<button type="button" data-cxt-stake="'+x+'" class="'+(stake===x?'selected':'')+'" '+(wait?'disabled':'')+'>'+x+' XP</button>').join("")
  +'</div>'
  +(kind==="coinflip"?'<div class="cxnSelections">'+[["cara","Cara"],["coroa","Coroa"]].map(([id,name])=>
    '<button type="button" data-cxt-choice="'+id+'" '+(choices[kind]===id?'class="selected"':'')+' '+(wait?'disabled':'')+'>'+name+'</button>').join("")+'</div>':'')
  +(kind==="roulette"?'<div class="cxnSelections cxnRouletteSelections">'+[["red","Vermelho"],["black","Preto"],["green","Zero"],["n:17","Número"]].map(([id,name])=>
    '<button type="button" data-cxt-choice="'+id+'" '+((choices[kind]===id||id==="n:17"&&choices[kind].startsWith("n:"))?'class="selected"':'')+' '+(wait?'disabled':'')+'>'+name+'</button>').join("")+'</div>'
   +(choices[kind].startsWith("n:")?'<label class="cxtNumberLabel">Número <select data-cxt-number '+(wait?'disabled':'')+'>'
     +Array.from({length:37},(_,i)=>'<option value="'+i+'" '+(choices[kind]==="n:"+i?'selected':'')+'>'+i+'</option>').join("")+'</select></label>':''):'')
  +'<button type="button" class="primary cxtPrimary" data-cxt-action="bet" '+(wait?'disabled':'')+'>Confirmar '+stake+' XP</button>'
  +'</div>';
}
function gameStage(){
 if(kind!=="blackjack"){
  const outcome=room?.outcome||{},round=room?.round||0,ended=room?.status==="finished";
  return '<div class="cxtCommonStage">'
   +(kind==="roulette"?'<div class="cxtSharedWheel'+(busy?' spinning':ended?' settled':'')+'"><div class="cxtSharedWheelInner"><span>'+esc(ended?outcome.number:"✦")+'</span></div></div>'
      :'<div class="cxtSharedCoin'+(busy?' spinning':ended?' settled':'')+'"><span>'+esc(ended?(outcome.face==="cara"?"CARA":"COROA"):"✦")+'</span></div>')
   +'<h3>'+(ended?'Resultado da ronda '+round:kind==="roulette"?"Uma roleta, várias apostas":"Cara ou Coroa · lados opostos")+'</h3>'
   +'<p>'+(!ended?'Todos participam no mesmo sorteio.':kind==="roulette"?'Saiu o número '+esc(outcome.number)+' ('+esc(outcome.color)+')':'Saiu '+esc(outcome.face))+'</p>'
   +'</div>';
 }
 const dealer=room?.dealer||[];
 return '<div class="cxtFelt"><div class="cxtDealerLabel"><span>♠ DEALER · ROBÔ</span>'
   +'<strong>'+(room.status==="finished"?fmt(room.dealer_total):'')+'</strong></div>'
   +'<div class="cxtDealerCards">'+(dealer.length?cards(dealer):card(-1)+card(-1))+'</div>'
   +'<p>Objetivo: ficar o mais perto de 21 sem ultrapassar. O dealer fica com 17 ou mais.</p></div>';
}
function roomView(){
 if(!code||!room){
  return '<div class="cxtEntry">'+(busy?'<p>Preparar mesa…</p>':'')
   +'<h3>'+(selected[kind]==="friends"?'Mesa privada com amigos':'Blackjack contra o dealer')+'</h3>'
   +'<p>'+(selected[kind]==="friends"?'Até '+(kind==="coinflip"?'2':'6')+' jogadores · convites internos · XP virtual':'Joga sozinho contra o dealer. Pede cartas ou fica até 21.')+'</p>'
   +'<button type="button" class="primary cxtPrimary" data-cxt-create '+(busy?'disabled':'')+'>'
   +(selected[kind]==="friends"?'Criar mesa com amigos':'Sentar-me à mesa')+'</button>'
   +(selected[kind]==="friends"?'<div class="cxtJoin"><input id="cxtJoinCode" maxlength="8" autocomplete="off" autocapitalize="characters" placeholder="Código da mesa" aria-label="Código da mesa">'
      +'<button type="button" class="secondary" data-cxt-join>Entrar</button></div>':'')
   +'</div>';
 }
 const waiting=room.status==="waiting",finished=room.status==="finished",playing=room.status==="playing";
 const mine=(room.players||[]).find(p=>p.id===room.my_id),everyoneReady=room.players?.length&&room.players.every(p=>p.stake);
 const canStart=host()&&waiting&&everyoneReady&&(room.bot||room.players.length>=2);
 return '<div class="cxtTableHeader"><div><small>MESA '+esc(room.code)+' · RONDA '+room.round+'</small>'
  +'<h3>'+esc(names[kind])+' · '+(room.bot?'Robô':'Amigos')+'</h3></div>'
  +'<div class="cxtActions"><button type="button" class="secondary" data-cxt-copy>Copiar código</button>'
  +(!room.bot&&host()&&waiting?'<button type="button" class="secondary" data-cxt-invite>Convidar</button>':'')+'</div></div>'
  +gameStage()+players()
  +(waiting?betOptions():'')
  +(canStart?'<button type="button" class="primary cxtPrimary" data-cxt-action="start" '+(busy?'disabled':'')+'>'
    +(kind==="blackjack"?'Distribuir cartas':'Lançar resultado')+'</button>':'')
  +(waiting&&!canStart?'<p class="cxtInfo">'+(mine?.stake?'Aposta registada. ':'')+(host()?'Aguardar os restantes jogadores e as apostas.':'O anfitrião começa quando todos estiverem prontos.')+'</p>':'')
  +(playing?'<p class="cxtInfo">'+(mine?.done?'Aguarda que as outras mãos terminem.':'É a tua vez de jogar a mão.')+'</p>'
    +(!mine?.done?'<div class="cxtActions cxtTurn"><button type="button" class="primary" data-cxt-action="hit" '+(busy?'disabled':'')+'>Pedir carta</button>'
      +'<button type="button" class="secondary" data-cxt-action="stand" '+(busy?'disabled':'')+'>Ficar</button></div>':''):'')
  +(finished?'<div class="cxtRoundEnd"><h3>Ronda concluída</h3><p>As recompensas foram registadas no XP disponível e no XP Total (apenas lucros).</p>'
     +(host()?'<button type="button" class="primary cxtPrimary" data-cxt-action="next" '+(busy?'disabled':'')+'>Preparar próxima ronda</button>'
       :'<p>À espera que o anfitrião prepare a próxima ronda.</p>')+'</div>':'')
  +'<div class="cxtActions cxtFooterActions"><button type="button" class="secondary" data-cxt-back>Voltar ao casino</button>'
  +(host()&&!room.bot?'<button type="button" class="secondary" data-cxt-action="cancel" '+(playing||busy?'disabled':'')+'>Fechar mesa</button>'
      :!host()?'<button type="button" class="secondary" data-cxt-action="leave" '+(playing||busy?'disabled':'')+'>Sair da mesa</button>':'')
  +'</div>';
}
function panel(game){
 if(!kinds.includes(game))return "";
 if(kind&&kind!==game)clear();
 kind=game;
 return '<section class="cxtPanel">'+botChoice(game)
  +(isTableMode(game)?roomView():'')
  +(message?'<p class="cxtMessage" role="alert">'+esc(message)+'</p>':'')+'</section>';
}
function bind(root,game){
 if(!root||!kinds.includes(game))return;
 root.querySelectorAll("[data-cxt-view]").forEach(b=>b.addEventListener("click",()=>setView(game,b.dataset.cxtView)));
 root.querySelector("[data-cxt-create]")?.addEventListener("click",()=>create(game,selected[game]==="robot"));
 root.querySelector("[data-cxt-join]")?.addEventListener("click",joinFromInput);
 root.querySelectorAll("[data-cxt-stake]").forEach(b=>b.addEventListener("click",()=>{if(busy)return;stake=Number(b.dataset.cxtStake);draw()}));
 root.querySelectorAll("[data-cxt-choice]").forEach(b=>b.addEventListener("click",()=>{if(busy)return;choices[game]=b.dataset.cxtChoice;draw()}));
 root.querySelector("[data-cxt-number]")?.addEventListener("change",e=>{choices.roulette="n:"+Number(e.target.value);draw()});
 root.querySelectorAll("[data-cxt-action]").forEach(b=>b.addEventListener("click",()=>action(b.dataset.cxtAction)));
 root.querySelector("[data-cxt-copy]")?.addEventListener("click",()=>{if(code&&navigator.clipboard)navigator.clipboard.writeText(code).catch(()=>{})});
 root.querySelector("[data-cxt-invite]")?.addEventListener("click",()=>window.EDGY_social?.openInvite?.("casino_"+kind,code));
 root.querySelector("[data-cxt-back]")?.addEventListener("click",()=>{clear();selected[game]="robot";draw()});
}
window.EDGY_casinoTables=Object.freeze({open,close,panel,bind,chooseKind,isTableMode,refresh});
})();
