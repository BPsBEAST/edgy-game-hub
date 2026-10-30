"use strict";
const KEY="edgy_v1", defs=Object.values(window.EDGY_platform.games).map(g=>({id:g.id,name:g.display||g.title,emoji:g.icon,type:g.category,mode:g.mode}));
let state;try{state=JSON.parse(localStorage.getItem(KEY))||{}}catch{state={}};state={name:"Jogador",xp:0,history:[],...state};if(!Array.isArray(state.history))state.history=[];if(!Number.isFinite(state.xp))state.xp=0;
let page="home",filter="Todos",game=null,ticMode="online",tic=[],turn="X",versus="cpu",locked=false,reactPhase="idle",reactStart=0,reactTimeout=null,reactTimes=[];
const $=s=>document.querySelector(s),screen=$("#screen");
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}};
// Keep previous local Wordle results consistent with the new public game name.
if(state.history.some(h=>h?.title==="Palavra Oculta")){
 state.history=state.history.map(h=>h?.title==="Palavra Oculta"?{...h,title:"Wordle"}:h);
 save();
}
const esc=t=>String(t).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const level=()=>Math.floor(state.xp/100)+1,progress=()=>state.xp%100;
window.EDGY_currentXP=()=>state.xp;
function animatePage(){const target=document.getElementById("screen");if(!target)return;target.classList.remove("edgyPageIn");void target.offsetWidth;target.classList.add("edgyPageIn")}
function nav(p){const changed=page!==p||Boolean(game);clearTimeout(reactTimeout);window.EDGY_chess?.close();window.EDGY_checkers?.close();window.EDGY_ticOnline?.close();window.EDGY_barricade?.close();window.EDGY_wordle?.close();window.EDGY_contexto?.close();game=null;page=p;render();document.querySelector(".main")?.scrollTo({top:0,behavior:"instant"});if(changed)animatePage()}
document.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>nav(b.dataset.page)));
$("#avatar").onclick=()=>nav("profile");
function complete(title,result,xp){
 const previous=level(),gain=Math.max(0,Number(xp)||0);
 state.xp+=gain;
 state.history.unshift({title,result,xp:gain,date:new Date().toISOString()});
 state.history=state.history.slice(0,50);
 save();
 if(level()>previous)window.EDGY_social?.notifyLevelUp?.(previous,level());
}
window.EDGY_recordLocalMatch=complete;
const gameIcon={
 chess:'<span class="edgyGameIcon edgyGameIconChess">♞</span>',
 checkers:'<span class="edgyGameIcon edgyGameIconDamas"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="23"/><circle cx="32" cy="32" r="14"/><path d="M19 42c7 5 19 5 26 0"/></svg></span>',
 contexto:'<span class="edgyGameIcon edgyGameIconContexto"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="13"/><path d="m25 33 5 5 10-12"/></svg></span>',
 wordle:'<span class="edgyGameIcon edgyGameIconWordle"><svg viewBox="0 0 64 64" aria-hidden="true"><rect x="7" y="9" width="14" height="14" rx="2"/><rect x="25" y="9" width="14" height="14" rx="2"/><rect x="43" y="9" width="14" height="14" rx="2"/><rect x="7" y="27" width="14" height="14" rx="2"/><rect x="25" y="27" width="14" height="14" rx="2"/><rect x="43" y="27" width="14" height="14" rx="2"/><rect x="7" y="45" width="14" height="14" rx="2"/><rect x="25" y="45" width="14" height="14" rx="2"/><rect x="43" y="45" width="14" height="14" rx="2"/></svg></span>',
 reaction:'<span class="edgyGameIcon edgyGameIconReflexos"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="35" r="20"/><path d="M32 24v12l9-6M26 9h12M32 9v6M48 18l5-5"/></svg></span>',
 barricade:'<span class="edgyGameIcon edgyGameIconBarricade"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 10h44v44H10zM24 10v44M40 10v44M10 24h44M10 40h44"/><circle cx="32" cy="47" r="6"/><circle cx="32" cy="17" r="6"/></svg></span>',
 tic:'<span class="edgyGameIcon"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M9 10 26 27M26 10 9 27M40 10 57 27M57 10 40 27"/><circle cx="18" cy="46" r="11"/><circle cx="48" cy="46" r="11"/></svg></span>'
};
function cards(items){return '<div class="games edgyGameCards">'+items.map(g=>'<button class="game" data-game="'+g.id+'"><div class="art">'+(gameIcon[g.id]||g.emoji)+'</div><div class="gameBody"><strong>'+g.name+'</strong><span>'+g.type+' · '+g.mode+'</span></div></button>').join("")+'</div>'}
const gameFromHistory=Object.freeze({"Xadrez":"chess","Damas":"checkers","Barricade":"barricade","Jogo do Galo":"tic","Wordle":"wordle","Contexto":"contexto","Palavra Oculta":"wordle","Reflexos":"reaction"});
function recentStorageKey(){return "edgy_recent_games_v1_"+(window.EDGY_auth?.getUser?.()?.id||"local")}
function recentGameIds(){
 try{
  const value=JSON.parse(localStorage.getItem(recentStorageKey())||"[]");
  return Array.isArray(value)?value.filter(id=>defs.some(g=>g.id===id)).slice(0,12):[];
 }catch{return []}
}
function rememberGame(id){
 if(!defs.some(g=>g.id===id))return;
 try{localStorage.setItem(recentStorageKey(),JSON.stringify([id,...recentGameIds().filter(x=>x!==id)].slice(0,12)))}catch{}
}
function homeGames(){
 const ranked=[],used=new Set(),history=[...state.history].sort((a,b)=>Date.parse(b.date||0)-Date.parse(a.date||0));
 const push=id=>{if(id&&defs.some(g=>g.id===id)&&!used.has(id)){used.add(id);ranked.push(id)}};
 history.forEach(h=>push(gameFromHistory[h.title]));
 recentGameIds().forEach(push);
 // Editorial defaults are explicitly described as suggestions, not global usage statistics.
 ["contexto","wordle","chess","checkers","barricade","tic","reaction"].forEach(push);
 return {items:ranked.slice(0,2).map(id=>defs.find(g=>g.id===id)),hasRecent:history.some(h=>Boolean(gameFromHistory[h.title]))||recentGameIds().length>0};
}
window.EDGY_openRoom=(name,code)=>{
 if(!window.EDGY_platform?.games[name]?.online||!/^[A-F0-9]{8}$/i.test(code||""))return;
 nav("games");screen.classList.remove("edgyLibraryPage");document.querySelector(".main")?.classList.remove("edgyLibraryViewport");game=name;rememberGame(name);if(name==="tic")ticMode="online";
 if(name==="chess")window.EDGY_chess?.open(String(code).toUpperCase());
 else if(name==="checkers")window.EDGY_checkers?.open(String(code).toUpperCase());
 else if(name==="barricade")window.EDGY_barricade?.open(String(code).toUpperCase());
 else window.EDGY_ticOnline?.open(String(code).toUpperCase());
 document.querySelector(".main")?.scrollTo({top:0,behavior:"instant"});
 animatePage();
};
function wireGames(){document.querySelectorAll("[data-game]").forEach(b=>b.onclick=()=>openGame(b.dataset.game))}
function render(){document.querySelector(".main")?.classList.toggle("edgyLibraryViewport",page==="games"&&!game);screen.classList.toggle("edgyProfilePage",page==="profile"&&!game);screen.classList.toggle("edgyLibraryPage",page==="games"&&!game);screen.classList.remove("edgyLobby");document.querySelectorAll("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));$("#avatar").textContent=state.name[0]?.toUpperCase()||"E";if(game){renderGame();return}
if(page==="home"){const featured=homeGames();screen.innerHTML='<div class="hero panel"><span class="eyebrow">O teu espaço de jogo</span><h1>Boas, '+esc(state.name)+' <span style="color:#ff3c91">✦</span></h1><p class="sub">Uma partida rápida? Escolhe um jogo e diverte-te.</p><button class="primary" id="explore">Explorar jogos →</button></div><div class="stats"><div class="panel stat"><b>'+level()+'</b><span>Nível</span></div><div class="panel stat"><b>'+state.xp+'</b><span>XP total</span></div><div class="panel stat"><b>'+state.history.length+'</b><span>Partidas</span></div></div><section class="section"><div class="row space"><div><h2>Vamos jogar</h2> </div><button class="secondary edgyHomeMore" id="moreGames" type="button">Ver mais →</button></div>'+cards(featured.items)+'</section><section class="section panel"><h3>Joga online com a tua malta</h3><p class="sub">Joga Xadrez, Damas, Barricade ou Jogo do Galo online: cria uma sala privada e envia o convite a um amigo. Os minijogos locais continuam disponíveis.</p></section><section class="section"><div class="edgyRoomsTitle"><h3>Salas abertas</h3><button class="secondary" id="allRooms">Ver todas</button></div><div id="edgy-home-rooms"></div></section>';$("#explore").onclick=()=>nav("games");$("#moreGames").onclick=()=>nav("games");$("#allRooms").onclick=()=>nav("rooms");wireGames();window.EDGY_social?.renderRooms("edgy-home-rooms")}
if(page==="games"){const shown=defs.filter(g=>filter==="Todos"||(filter==="Multiplayer"?window.EDGY_platform.games[g.id].online:g.type===filter));screen.innerHTML='<h1>Biblioteca</h1><p class="sub">Encontra o teu próximo jogo.</p><div class="filters">'+["Todos","Multiplayer","Estratégia","Arcade","Palavras"].map(f=>'<button data-filter="'+f+'" class="'+(filter===f?"active":"")+'">'+f+'</button>').join("")+'</div>'+cards(shown);document.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render()});wireGames()}
if(page==="rooms"){screen.innerHTML='<span class="eyebrow">Partidas online</span><h1>Salas abertas</h1><p class="sub">Partidas à espera de adversário ou em curso. As partidas terminadas estão no Histórico, dentro do Perfil.</p><div id="edgy-all-rooms"></div>';window.EDGY_social?.renderRooms("edgy-all-rooms")}
if(page==="players"){if(window.EDGY_players)window.EDGY_players.mount();else screen.innerHTML='<h1>Jogadores</h1><p class="sub">A carregar comunidade…</p>'}
if(page==="history"){if(window.EDGY_history)window.EDGY_history.mount(state.history);else screen.innerHTML='<h1>Histórico</h1><p class="sub">A carregar…</p>'}
if(page==="profile"){screen.innerHTML='<h1>O teu perfil</h1><p class="sub">Personaliza o teu perfil e o teu avatar.</p><div class="panel"><div class="row ownProfileIdentity"><div class="avatar" style="display:grid;place-items:center;font-size:23px">'+esc((state.name[0]||"E").toUpperCase())+'</div><div class="ownProfileName"><h3>'+esc(state.name)+'</h3><span class="sub">O teu espaço na EDGY</span></div><div class="playerMiniStats ownProfileStats" aria-label="As tuas estatísticas"><span class="playerMiniStat"><strong>'+level()+'</strong><small>Nível</small></span><span class="playerMiniStat"><strong>'+state.xp+'</strong><small>XP</small></span><span class="playerMiniStat"><strong>'+state.history.length+'</strong><small>Partidas</small></span></div></div><div class="xpTrack"><div class="xpFill" style="width:'+progress()+'%"></div></div><p class="sub">'+progress()+'/100 XP para o próximo nível</p><label class="formLabel" for="username">Nome visível (pode repetir-se)</label><input class="field" id="username" maxlength="22" value="'+esc(state.name)+'"><div class="actionrow"><button class="primary" id="saveName">Guardar nome</button></div></div><section class="section panel edgyHistoryShortcut"><div class="edgyHistoryShortcutInfo"><span class="edgyHistoryShortcutIcon" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></svg></span><div><h3>Histórico de partidas</h3><p class="sub">Consulta resultados, adversários e revê as tuas partidas.</p></div></div><button class="secondary" id="profileHistory" type="button">Ver histórico <span aria-hidden="true">→</span></button></section><section class="section notice">Com conta, o progresso pode ser sincronizado entre dispositivos. Convidados poderão perder os dados se apagarem os dados do navegador.</section>';$("#profileHistory").onclick=()=>nav("history");$("#saveName").onclick=()=>{state.name=$("#username").value.trim().slice(0,22)||"Jogador";save();render()}}
}
function openGame(id){rememberGame(id);screen.classList.remove("edgyLibraryPage");document.querySelector(".main")?.classList.remove("edgyLibraryViewport");game=id;locked=false;if(id==="checkers"){window.EDGY_checkers?.open();document.querySelector(".main")?.scrollTo({top:0,behavior:"instant"});animatePage();return;}if(id==="barricade"){window.EDGY_barricade?.open();document.querySelector(".main")?.scrollTo({top:0,behavior:"instant"});animatePage();return;}if(id==="chess"){window.EDGY_chess?.open();document.querySelector(".main")?.scrollTo({top:0,behavior:"instant"});animatePage();return;}if(id==="tic"){ticMode="online";window.EDGY_ticOnline?.open();document.querySelector(".main")?.scrollTo({top:0,behavior:"instant"});animatePage();return}if(id==="contexto"){window.EDGY_contexto?.open();document.querySelector(".main")?.scrollTo({top:0,behavior:"instant"});animatePage();return}if(id==="wordle"){window.EDGY_wordle?.open();document.querySelector(".main")?.scrollTo({top:0,behavior:"instant"});animatePage();return}if(id==="reaction"){reactPhase="idle";reactTimes=[]}renderGame();document.querySelector(".main")?.scrollTo({top:0,behavior:"instant"});animatePage()}
function gameHeader(id,sub){return window.EDGY_gameUI.header(id,{intro:sub,backId:true})}
function attachBack(){$("#goBack").onclick=()=>nav("games")}
function renderGame(){if(game==="contexto")return window.EDGY_contexto?.render();if(game==="wordle")return window.EDGY_wordle?.render();if(game==="barricade")return window.EDGY_barricade?.render();if(game==="checkers")return window.EDGY_checkers?.render();if(game==="chess")return window.EDGY_chess?.render();if(game==="tic")return ticMode==="online"?window.EDGY_ticOnline?.render():drawTic();if(game==="reaction")return drawReaction()}
function winner(){const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];for(const [a,b,c] of lines)if(tic[a]&&tic[a]===tic[b]&&tic[b]===tic[c])return tic[a];return tic.every(Boolean)?"draw":null}
function playTic(i){if(locked||tic[i]||(versus==="cpu"&&turn==="O"))return;tic[i]=turn;let w=winner();if(w){finishTic(w);return}turn=turn==="X"?"O":"X";drawTic();if(versus==="cpu"&&turn==="O"){locked=true;setTimeout(()=>{if(game!=="tic")return;const empty=tic.map((v,i)=>v=== ""?i:-1).filter(i=>i>=0);let idx=empty[Math.floor(Math.random()*empty.length)];for(const p of ["O","X"]){for(const k of empty){const a=[...tic];a[k]=p;const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];if(lines.some(l=>l.every(j=>a[j]===p))){idx=k;break}}if(idx!==undefined&&(()=>{const a=[...tic];a[idx]=p;return [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].some(l=>l.every(j=>a[j]===p))})())break}if(idx!==undefined)tic[idx]="O";locked=false;w=winner();if(w)finishTic(w);else{turn="X";drawTic()}},320)}}
function finishTic(w){locked=true;const res=w==="draw"?"Empate":w==="X"?"Vitória X":"Vitória O";complete("Jogo do Galo",res,w==="draw"?10:20);drawTic();$("#ticResult").textContent=res+" · "+(w==="draw"?10:20)+" XP"}
function drawTic(){
 const stage='<div class="boardHead"><span class="pill">'+(locked?"Partida terminada":"Vez de "+turn)+'</span></div>'
  +'<div class="board">'+tic.map((v,i)=>'<button class="cell '+(v==="O"?"o":"")+'" data-cell="'+i+'" aria-label="Casa '+(i+1)+'">'+(v||"")+'</button>').join("")+'</div><div id="ticResult" class="result" role="status"></div>';
 const side=window.EDGY_gameUI.card("Partida & opções",'<div class="edgySoloChoices"><button class="'+(versus==="cpu"?"primary":"secondary")+'" id="cpu">Vs. CPU</button><button class="'+(versus==="local"?"primary":"secondary")+'" id="local">2 jogadores</button></div><div class="edgySoloActions"><button class="secondary" id="newTic">Nova partida</button><button class="secondary" id="backToTicOnline">Jogar online</button></div>')
  +window.EDGY_gameUI.card("Jogadas & histórico",'<p class="sub">O Jogo do Galo local termina ao formar três símbolos em linha. As partidas online têm histórico de movimentos.</p>');
 screen.innerHTML='<div class="edgyGamePage">'+gameHeader("tic","3×3 · Modo local · 1–2 jogadores")
  +window.EDGY_gameUI.match({game:"tic",stage,side,layoutClass:"edgySoloLayout",stageClass:"edgySoloStage",sideClass:"edgySoloSide"})+'</div>';
 attachBack();
 $("#newTic").onclick=()=>{tic=Array(9).fill("");turn="X";locked=false;drawTic()};
 $("#backToTicOnline").onclick=()=>{ticMode="online";window.EDGY_ticOnline?.open()};
 for(const id of ["cpu","local"])$("#"+id).onclick=()=>{versus=id;tic=Array(9).fill("");turn="X";locked=false;drawTic()};
 document.querySelectorAll("[data-cell]").forEach(b=>b.onclick=()=>playTic(Number(b.dataset.cell)));
}
window.EDGY_ticLocal=()=>{ticMode="local";tic=Array(9).fill("");turn="X";versus="cpu";locked=false;drawTic()};
function drawReaction(){
 const label=({idle:"Toca para começar",waiting:"Espera pelo verde...",ready:"TOCA!",done:"Concluído!"}[reactPhase]||"Toca para começar");
 const stage=window.EDGY_gameUI.card("Teste de reflexos",'<button class="reaction '+(reactPhase==="ready"?"ready":"")+'" id="tap">'+label+'</button>'
 +'<p id="reactMsg" class="result" role="status">'+(reactPhase==="done"?"Média: "+Math.round(reactTimes.reduce((a,b)=>a+b,0)/3)+" ms":"")+'</p>');
 const side=window.EDGY_gameUI.card("Partida & opções",'<div class="row space"><span class="pill">Ronda '+Math.min(reactTimes.length+1,3)+'/3</span><span class="sub">'+(reactTimes.length?"Último: "+reactTimes[reactTimes.length-1]+" ms":"3 rondas")+'</span></div><div class="edgySoloActions"><button class="secondary" id="resetReact">Recomeçar</button></div>')
 +window.EDGY_gameUI.card("Como jogar",'<p class="sub">Espera que o alvo fique verde e toca o mais rápido possível. São três rondas por partida.</p>');
 screen.innerHTML='<div class="edgyGamePage">'+gameHeader("reaction","Arcade · 1 jogador · 3 rondas")
  +window.EDGY_gameUI.match({game:"reaction",stage,side,layoutClass:"edgySoloLayout",stageClass:"edgySoloStage",sideClass:"edgySoloSide"})+'</div>';
 attachBack();
 $("#resetReact").onclick=()=>{clearTimeout(reactTimeout);reactPhase="idle";reactTimes=[];drawReaction()};
 $("#tap").onclick=()=>{
  if(reactPhase==="idle"){reactPhase="waiting";drawReaction();reactTimeout=setTimeout(()=>{if(game==="reaction"&&reactPhase==="waiting"){reactPhase="ready";reactStart=performance.now();drawReaction()}},900+Math.random()*2300)}
  else if(reactPhase==="waiting"){clearTimeout(reactTimeout);reactPhase="idle";drawReaction();$("#reactMsg").textContent="Cedo demais! Tenta outra vez."}
  else if(reactPhase==="ready"){reactTimes.push(Math.round(performance.now()-reactStart));if(reactTimes.length===3){reactPhase="done";const avg=Math.round(reactTimes.reduce((a,b)=>a+b,0)/3);complete("Reflexos","Média "+avg+" ms",Math.max(10,Math.round(30000/avg)));drawReaction()}else{reactPhase="idle";drawReaction()}}
  else{reactTimes=[];reactPhase="idle";drawReaction()}
 };
}
render();if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js?v=53").catch(()=>{}));
