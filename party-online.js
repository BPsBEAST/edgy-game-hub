/* EDGY — Cartas Contra Tugas, original multiplayer party-card mode.
   Server functions own hands, submissions, judging and end-of-match XP. */
(function(){
"use strict";
const api=()=>window.EDGY_auth?.getClient?.();
const me=()=>window.EDGY_auth?.getUser?.();
const ui=()=>window.EDGY_gameUI;
const escape=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let room=null,code="",busy=false,info="",timer=null,epoch=0,finishedSeen=new Set(),seenStamp="";
const validCode=s=>/^[0-9A-F]{8}$/.test(String(s||"").toUpperCase());
const myself=()=>room?.players?.find(p=>p.id===me()?.id);
const judge=()=>room?.judge===me()?.id;
const isHost=()=>room?.host===me()?.id;
const DECKS=Object.freeze([
 {id:"classic",name:"Clássico",description:"Humor descontraído e situações absurdas"},
 {id:"adult",name:"Adulto +18",description:"Sexo, encontros e piadas mais atrevidas"},
 {id:"dark",name:"Humor negro",description:"Humor macabro, azar e situações desconfortáveis"},
 {id:"mixed",name:"Misto +18",description:"Mistura dos três baralhos"}
]);
const deckName=id=>DECKS.find(x=>x.id===id)?.name||"Clássico";
function stop(){if(timer){clearInterval(timer);timer=null}}
function close(){epoch++;stop();room=null;code="";busy=false;info="";seenStamp=""}
function permalink(){return new URL("?party="+code,location.href).href}
async function load(force=false){
 if(!code||!api())return;
 const token=epoch,current=code;
 try{
  const {data,error}=await api().rpc("edgy_party_state",{p_code:current});
  if(error)throw error;
  if(epoch!==token||code!==current)return;
  const signature=JSON.stringify({status:data.status,round:data.round,players:data.players,
   submitted:data.submitted,has_submitted:data.has_submitted,hand:data.hand,round_winner:data.round_winner,submissions:data.submissions});
  const different=signature!==seenStamp;
  room=data;seenStamp=signature;
  if(data.status==="finished"&&!finishedSeen.has(current)){
   finishedSeen.add(current);
   window.EDGY_auth?.refreshProfile?.();
  }
  if(different||force)draw();
 }catch(e){if(epoch===token){info=e.message||"Não foi possível atualizar a sala";draw()}}
}
function startPolling(){stop();timer=setInterval(()=>{if(document.visibilityState!=="hidden")load()},2400)}
async function open(invite=""){
 close();const token=epoch;
 const requested=String(invite||"").toUpperCase().trim();
 if(validCode(requested))code=requested;
 draw();
 if(!me())return;
 if(code){
  try{
   const {error}=await api().rpc("edgy_party_join",{p_code:code});
   if(error)throw error;
   if(epoch!==token)return;
   startPolling();await load(true);
  }catch(e){if(epoch===token){info=e.message||"Não foi possível entrar";room=null;draw()}}
 }
}
async function create(){
 if(!me()){window.EDGY_auth?.showEntry?.();return}
 if(busy)return;busy=true;info="";draw();
 try{
  const {data,error}=await api().rpc("edgy_party_create");
  if(error)throw error;
  code=String(data).toUpperCase();room=null;seenStamp="";
  history.replaceState(null,"",permalink());
  startPolling();await load(true);
 }catch(e){info=e.message||"Erro ao criar sala"}finally{busy=false;draw()}
}
async function join(){
 if(busy)return;
 const input=document.querySelector("#party-code");
 const value=String(input?.value||code||"").toUpperCase().trim();
 if(!validCode(value)){info="O código deve ter 8 caracteres";draw();return}
 if(!me()){window.EDGY_auth?.showEntry?.();return}
 busy=true;info="";draw();
 try{
  const {error}=await api().rpc("edgy_party_join",{p_code:value});
  if(error)throw error;
  code=value;room=null;seenStamp="";
  history.replaceState(null,"",permalink());
  startPolling();await load(true);
 }catch(e){info=e.message||"Não foi possível entrar"}finally{busy=false;draw()}
}
async function action(name,extra={}){
 if(!room||busy)return;
 busy=true;info="";draw();
 try{
  const {data,error}=await api().rpc("edgy_party_action",{
   p_code:code,p_action:name,p_card:extra.card??null,p_submission:extra.submission??null
  });
  if(error)throw error;
  if(data!==true)throw Error("Ação não confirmada");
  if(name==="cancel"||name==="leave"){
   close();history.replaceState(null,"",location.pathname);draw();return;
  }
  await load(true);
 }catch(e){info=e.message||"Não foi possível completar a jogada"}finally{busy=false;draw()}
}
async function chooseDeck(next){
 if(!room||!isHost()||room.status!=="waiting"||busy||!DECKS.some(x=>x.id===next))return;
 busy=true;info="";draw();
 try{
  const {error}=await api().rpc("edgy_party_set_deck",{p_code:code,p_deck:next});
  if(error)throw error;
  await load(true);
 }catch(e){info=e.message||"Não foi possível escolher o baralho"}
 finally{busy=false;draw()}
}
async function copyInvite(){
 try{await navigator.clipboard.writeText(permalink());info="Convite copiado!"}
 catch{info=permalink()}
 draw();
}
function players(){
 const list=room?.players||[];
 return '<div class="ptPlayers">'+list.map(p=>'<div class="ptPlayer'+(p.id===room.judge?" isJudge":"")+(p.id===me()?.id?" isMe":"")+'">'
  +'<span class="ptPlayerAvatar">'+escape(p.name?.slice(0,1).toUpperCase()||"E")+'</span>'
  +'<div><strong>'+escape(p.name)+(p.id===me()?.id?" (tu)":"")+'</strong><small>'
  +(p.id===room.judge?"⚖ Júri":p.id===room.host?"Anfitrião":"Jogador")+'</small></div>'
  +'<b>'+p.points+' pts</b></div>').join("")+'</div>';
}
function lobby(){
 return ui().card("Sala privada",'<div class="ptLobbyText"><strong>'+escape(code)+'</strong><p>Entre 3 e 8 jogadores. O júri muda a cada ronda; ganha quem chegar primeiro aos 3 pontos.</p></div>'
  +'<section class="ptDeckPanel"><h3>Escolher baralho</h3><div class="ptDeckOptions">'
  +DECKS.map(d=>'<button type="button" class="ptDeckChoice'+(room.deck===d.id?" active":"")+'" data-pt-deck="'+d.id+'"'
   +(!isHost()||busy?' disabled':"")+'><strong>'+escape(d.name)+'</strong><small>'+escape(d.description)+'</small></button>').join("")
  +'</div>'+(room.deck!=="classic"?'<p class="ptMatureNotice">Conteúdo adulto: linguagem sexual e humor negro. Recomendado apenas para maiores de 18 anos.</p>':"")+'</section>'
  +players()
  +'<div class="ptActions"><button class="primary" data-pt-copy>Copiar convite</button>'
  +(isHost()?'<button class="secondary" data-pt-invite>Convidar jogador</button>'
   +'<button class="primary" data-pt-action="start" '+(busy||room.players.length<3?"disabled":"")+'>Começar partida ('+room.players.length+'/3)</button>'
   +'<button class="secondary" data-pt-action="cancel">Fechar sala</button>'
   :'<button class="secondary" data-pt-action="leave">Sair da sala</button>')+'</div>'
  +'<p class="ptNote">As cartas deste jogo são originais da EDGY. Não utilizamos cartas do baralho oficial de terceiros.</p>');
}
function hand(){
 const playable=room.status==="submitting"&&!judge()&&!room.has_submitted;
 const cards=room.hand||[];
 return '<section class="ptHand"><div class="ptSectionHead"><h3>A tua mão</h3><span>7 cartas</span></div>'
  +(judge()?'<p class="ptEmpty">És o júri nesta ronda. Vais escolher a resposta mais divertida quando todos jogarem.</p>'
   :room.has_submitted&&room.status==="submitting"?'<p class="ptEmpty">Carta entregue! A aguardar as restantes respostas.</p>'
   :'<div class="ptCardGrid">'+cards.map(card=>'<button type="button" class="ptAnswer" data-pt-card="'+card.id+'" '+(!playable||busy?"disabled":"")+'><span class="ptCardGlyph">✦</span><span>'+escape(card.text)+'</span></button>').join("")+'</div>')
  +'</section>';
}
function judging(){
 const entries=room.submissions||[];
 if(room.status==="submitting")return '<div class="ptWaiting"><span class="ptPulse"></span>'+room.submitted+'/'+(room.players.length-1)+' respostas entregues</div>';
 if(!entries.length)return "";
 const voting=room.status==="judging"&&judge();
 return '<section class="ptVotes"><div class="ptSectionHead"><h3>'+(voting?"És o júri! Escolhe uma resposta":"Respostas da ronda")+'</h3><span>'+entries.length+' cartas</span></div>'
  +'<div class="ptCardGrid">'+entries.map(c=>'<button type="button" class="ptAnswer ptVote'+(c.winner?" ptWinner":"")+'" '+(voting?'data-pt-vote="'+c.id+'"':"disabled")+'><span class="ptCardGlyph">'+(c.winner?"★":"✦")+'</span><span>'+escape(c.text)+'</span></button>').join("")+'</div>'
  +(room.status==="judging"&&!judge()?'<p class="ptNote">O júri está a escolher. As respostas são anónimas até terminar a ronda.</p>':"")
  +'</section>';
}
function stage(){
 const phase=room.status,judgeName=room.players.find(p=>p.id===room.judge)?.name||"Jogador";
 const ended=phase==="finished",result=phase==="result";
 return '<div class="ptStage"><div class="ptRoundBar"><span>RONDA '+room.round+' · '+escape(deckName(room.deck))+'</span><span>'+escape(judgeName)+' · Júri</span></div>'
  +'<div class="ptPrompt"><span class="ptPromptTop">CARTA DA PERGUNTA</span><p>'+escape(room.prompt||"A preparar a próxima pergunta…")+'</p><span class="ptPromptCorner">?</span></div>'
  +(ended?'<div class="ptConclusion"><span>✦ FINAL DA PARTIDA</span><h2>'+(room.winner===me()?.id?"Venceste!":"Temos vencedor!")+'</h2><p>'+escape(room.players.find(p=>p.id===room.winner)?.name||"Jogador")+' ganhou a partida. XP guardado no teu histórico.</p></div>'
   :result?'<div class="ptConclusion"><span>★ PONTO ATRIBUÍDO</span><h2>'+escape(room.players.find(p=>p.id===room.round_winner)?.name||"Jogador")+' venceu esta ronda!</h2><p>O júri escolheu a carta mais divertida.</p>'
   +(isHost()?'<button class="primary" data-pt-action="next">Próxima ronda →</button>':'<p>À espera que o anfitrião avance.</p>')+'</div>'
   :'<div class="ptPhase">'+(phase==="submitting"?(judge()?"És o júri — aguarda as cartas.":room.has_submitted?"Resposta enviada, aguarda os outros jogadores.":"Escolhe uma carta para completar a frase.") :judge()?"Todos responderam. Escolhe a tua favorita.":"À espera da escolha do júri.")+'</div>')
  +(ended||result?judging():hand()+judging())+'</div>';
}
function empty(){
 return ui().card("Criar sala",'<p class="sub">Joga com 3 a 8 amigos, envia respostas engraçadas e deixa o júri escolher a melhor.</p><button class="primary" data-pt-create '+(busy?"disabled":"")+'>Criar sala privada</button>')
  +ui().card("Entrar numa sala",'<div class="ptJoin"><input class="field" id="party-code" maxlength="8" placeholder="CÓDIGO DE 8 CARACTERES" value="'+escape(code)+'" autocomplete="off"><button class="secondary" data-pt-join>Entrar</button></div>')
  +ui().card("As tuas salas",'<div id="edgy-party-rooms"></div>');
}
function draw(){
 const root=document.getElementById("screen");if(!root||game!=="party")return;
 root.classList.toggle("edgyLobby",!room);
 const header=ui().header("party",{room:room?.code||"",intro:room?"":"Cartas originais · 3–8 jogadores · Júri por ronda"});
 if(!me()){
  root.innerHTML='<div class="edgyGamePage ptPage">'+header+ui().card("Iniciar sessão",'<p class="sub">Entra numa conta ou joga como convidado para criares salas.</p><button class="primary" data-pt-login>Entrar para jogar</button>')+'</div>';
  root.querySelector("[data-pt-login]")?.addEventListener("click",()=>window.EDGY_auth?.showEntry());bind(root);return;
 }
 root.innerHTML='<div class="edgyGamePage ptPage">'+header
  +(room?(room.status==="waiting"?lobby():ui().match({game:"party",stage:stage(),side:ui().card("Pontuação",players())+ui().card("Partida",'<p class="sub">Primeiro a 3 pontos vence. O júri muda a cada ronda.</p><div class="ptActions"><button class="secondary" data-pt-copy>Copiar convite</button></div>'),layoutClass:"ptLayout",stageClass:"ptBoard",sideClass:"ptSide"}))
  :empty())+(info?'<p class="ptFeedback" role="status">'+escape(info)+'</p>':"")+'</div>';
 bind(root);
 if(!room)window.EDGY_social?.renderRooms?.("edgy-party-rooms","party");
}
function bind(root){
 root.querySelector("[data-back]")?.addEventListener("click",()=>nav("games"));
 root.querySelector("[data-pt-create]")?.addEventListener("click",create);
 root.querySelector("[data-pt-join]")?.addEventListener("click",join);
 root.querySelector("[data-pt-copy]")?.addEventListener("click",copyInvite);
 root.querySelectorAll("[data-pt-deck]").forEach(button=>button.addEventListener("click",()=>chooseDeck(button.dataset.ptDeck)));
 root.querySelector("[data-pt-invite]")?.addEventListener("click",()=>window.EDGY_social?.openInvite?.("party",code));
 root.querySelectorAll("[data-pt-action]").forEach(button=>button.addEventListener("click",()=>{
  const name=button.dataset.ptAction;
  if(name==="cancel"||name==="leave"){
   window.EDGY_platform.confirmAction({title:name==="cancel"?"Fechar a sala?":"Sair da sala?",
    message:"Os jogadores serão informados desta alteração.",confirmLabel:"Confirmar"})
    .then(ok=>{if(ok)action(name)});
  }else action(name);
 }));
 root.querySelectorAll("[data-pt-card]").forEach(button=>button.addEventListener("click",()=>action("submit",{card:Number(button.dataset.ptCard)})));
 root.querySelectorAll("[data-pt-vote]").forEach(button=>button.addEventListener("click",()=>action("vote",{submission:button.dataset.ptVote})));
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&code)load()});
window.EDGY_party=Object.freeze({open,close,render:draw,refresh:()=>load(true)});
const incoming=new URLSearchParams(location.search).get("party");
if(validCode(incoming)){game="party";open(incoming)}
})();
