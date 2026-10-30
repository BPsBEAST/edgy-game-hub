/* EDGY Palavra Oculta — offline-first, unlimited Portuguese word puzzles.
   Local progress persists across refreshes; XP uses the same local EDGY record flow.
   All score/keyboard logic is delegated to wordle-rules.js. */
(function(){
"use strict";
const STORAGE="edgy_wordle_v1",MAX_GUESSES=6;
const words=()=>window.EDGY_wordBank;
const rules=()=>window.EDGY_wordRules;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let saved=null,active=false,message="",revealRow=-1;
function blankStats(){return {played:0,wins:0,streak:0,best:0,distribution:[0,0,0,0,0,0]}}
function read(){
 try{
  const parsed=JSON.parse(localStorage.getItem(STORAGE)||"null");
  if(!parsed||typeof parsed!=="object")return {};
  return parsed;
 }catch{return {}}
}
function persist(){
 try{localStorage.setItem(STORAGE,JSON.stringify(saved))}catch{}
}
function newRound(previous=-1){
 const bank=words();
 const next=rules().choose(saved?.bag,bank.answers.length,previous);
 saved.bag=next.remaining;
 return {answer:bank.answers[next.index].toUpperCase(),guesses:[],draft:"",finished:false,won:false,credited:false};
}
function setup(){
 if(saved)return;
 const bank=words(),data=read();
 saved={
  bag:Array.isArray(data.bag)?data.bag:[],
  round:null,
  stats:{...blankStats(),...(data.stats||{})},
  number:Math.max(0,Math.floor(Number(data.number)||0))
 };
 const stats=saved.stats;
 for(const key of ["played","wins","streak","best"])stats[key]=Math.max(0,Math.floor(Number(stats[key])||0));
 stats.distribution=Array.from({length:6},(_,i)=>Math.max(0,Math.floor(Number(stats.distribution?.[i])||0)));
 const old=data.round;
 if(old&&bank.answers.includes(String(old.answer||"").toLowerCase())&&Array.isArray(old.guesses)&&old.guesses.length<=6&&old.guesses.every(x=>typeof x==="string"&&/^[A-Z]{5}$/.test(x))&&
  typeof old.draft==="string"&&/^[A-Z]{0,5}$/.test(old.draft)){
  saved.round={answer:old.answer,guesses:old.guesses,draft:old.draft,
   finished:Boolean(old.finished),won:Boolean(old.won),credited:Boolean(old.credited)};
 }else{saved.round=newRound();saved.number++}
 // Old versions cannot accidentally award XP twice on load.
 if(saved.round.finished)saved.round.credited=true;
 persist();
}
function open(){active=true;setup();message="";revealRow=-1;render()}
function close(){active=false;message="";revealRow=-1}
function round(){return saved?.round}
function finish(won){
 const r=round();if(!r||r.finished)return;
 r.finished=true;r.won=won;r.draft="";
 saved.stats.played++;
 if(won){
  saved.stats.wins++;saved.stats.streak++;
  saved.stats.best=Math.max(saved.stats.best,saved.stats.streak);
  saved.stats.distribution[r.guesses.length-1]++;
 }else saved.stats.streak=0;
 const xp=won?Math.max(12,66-r.guesses.length*8):4;
 r.credited=true;persist();
 window.EDGY_recordLocalMatch?.("Palavra Oculta",won?"Vitória em "+r.guesses.length+"/6":"Derrota · "+r.answer,xp);
 message=won?"Excelente! Acertaste e ganhaste "+xp+" XP.":"A palavra era "+r.answer+". Ganhaste "+xp+" XP.";
}
function press(key){
 if(!active||game!=="wordle"||!round()||round().finished)return;
 const r=round(),value=String(key||"").toUpperCase();
 if(value==="BACKSPACE"){
  r.draft=r.draft.slice(0,-1);message="";revealRow=-1;persist();render();return;
 }
 if(value==="ENTER"){
  if(r.draft.length!==5){message="Escreve uma palavra de cinco letras.";render();return}
  if(!words().isWord(r.draft)){message="Palavra não reconhecida. Experimenta outra.";render();return}
  r.guesses.push(r.draft);r.draft="";message="";
  revealRow=r.guesses.length-1;
  if(r.guesses.at(-1)===r.answer)finish(true);
  else if(r.guesses.length===MAX_GUESSES)finish(false);
  persist();render();return;
 }
 const letter=words().normalize(value);
 if(letter.length===1&&r.draft.length<5){
  r.draft+=letter;message="";revealRow=-1;persist();render();
 }
}
function keydown(event){
 if(!active||game!=="wordle"||event.metaKey||event.ctrlKey||event.altKey)return;
 const element=event.target,key=event.key;
 // Native buttons must still activate with Enter and Space for keyboard users.
 if((key==="Enter"||key===" "||key==="Backspace")&&element?.closest?.('button,a,[role="button"]'))return;
 if(element?.closest?.('input,textarea,select,[contenteditable="true"],[role="dialog"]'))return;
 if(key==="Enter"||key==="Backspace"||/^[a-zA-ZÀ-ÿçÇ]$/.test(key)){
  event.preventDefault();
  press(key==="Enter"?"ENTER":key==="Backspace"?"BACKSPACE":key);
 }
}
document.addEventListener("keydown",keydown);
function nextRound(){
 const r=round();if(!r?.finished)return;
 const previous=words().answers.indexOf(r.answer.toLowerCase());
 saved.round=newRound(previous);saved.number++;message="";revealRow=-1;
 persist();render();
}
function share(){
 const r=round();if(!r?.finished)return;
 const emoji={correct:"🟩",present:"🟨",absent:"⬛"};
 const lines=r.guesses.map(g=>rules().score(g,r.answer).map(s=>emoji[s]).join(""));
 const label="EDGY · Palavra Oculta #"+saved.number+" "+(r.won?r.guesses.length: "X")+"/6";
 const result=label+"\n"+lines.join("\n")+"\n";
 if(navigator.clipboard?.writeText){
  navigator.clipboard.writeText(result).then(()=>{message="Resultado copiado, sem revelar a palavra.";render()})
   .catch(()=>{message="Não foi possível copiar neste dispositivo.";render()});
 }else{message="A cópia não está disponível neste navegador.";render()}
}
function rowHtml(i){
 const r=round(),attempt=r.guesses[i]||"",draft=!attempt&&i===r.guesses.length&&!r.finished?r.draft:"";
 const value=attempt||draft,results=attempt?rules().score(attempt,r.answer):[];
 const reveal=attempt&&revealRow===i;
 return '<div class="wdRow" role="row" aria-label="Tentativa '+(i+1)+'">'
 +Array.from({length:5},(_,j)=>{
  const letter=value[j]||"",state=results[j]||"",animate=reveal?" wdReveal":"";
  return '<span class="wdTile'+(state?" wd-"+state:"")+(letter?" wdFilled":"")+(animate)+"\" role=\"gridcell\" aria-label=\""+
    (letter?esc(letter):"vazio")+(state?", "+({correct:"letra certa",present:"posição errada",absent:"não aparece"}[state]):"")+
    "\" style=\"--wd-order:"+j+"\">"+esc(letter)+"</span>";
 }).join("")+"</div>";
}
function keyboardHtml(){
 const known=rules().keyboard(round().guesses,round().answer);
 const layout=["QWERTYUIOP","ASDFGHJKL","ZXCVBNM"];
 return '<div class="wdKeyboard" aria-label="Teclado do jogo">'+layout.map((letters,row)=>{
  const keys=row===2?["ENTER",...letters,"BACKSPACE"]:[...letters];
  return '<div class="wdKeys" role="group">'+keys.map(key=>{
   const special=key.length>1;
   const text=key==="ENTER"?"ENTRAR":key==="BACKSPACE"?"⌫":key;
   const status=known[key]||"";
   return '<button type="button" data-wd-key="'+key+'" class="wdKey'+(special?" wdKeyWide":"")+(status?" wdKey-"+status:"")+'" aria-label="'+(key==="BACKSPACE"?"Apagar":key==="ENTER"?"Confirmar":key)+'" '+(round().finished?"disabled":"")+">"+text+"</button>";
  }).join("")+"</div>";
 }).join("")+"</div>";
}
function resultsHtml(){
 const r=round();
 if(!r.finished)return "";
 return '<section class="wdOutcome '+(r.won?"wdWon":"wdLost")+'" aria-label="Resultado">'
  +'<div class="wdOutcomeLead">'+(r.won?"✦ Palavra descoberta!":"A ronda terminou")+'</div>'
  +'<p>'+(r.won?"Acertaste em "+r.guesses.length+" tentativas.":"A palavra era <strong>"+esc(r.answer)+"</strong>.")+'</p>'
  +'<div class="wdEndActions"><button type="button" class="primary wdNew" data-wd-new>Nova palavra <span aria-hidden="true">→</span></button>'
  +'<button type="button" class="secondary" data-wd-share>Partilhar</button></div></section>';
}
function sideHtml(){
 const data=saved.stats;
 const pct=data.played?Math.round(data.wins/data.played*100):0;
 const p=window.EDGY_gameUI;
 return p.card("Estatísticas",'<div class="wdStats">'
  +[["Partidas",data.played],["Vitórias",pct+"%"],["Sequência",data.streak],["Recorde",data.best]].map(([label,value])=>
   '<div class="wdStat"><strong>'+value+'</strong><span>'+label+'</span></div>').join("")+'</div>'
  +'<p class="wdSavedNotice">Progresso guardado neste dispositivo.</p>')
  +p.card("Como jogar",'<p>Descobre a palavra de <strong>cinco letras</strong> em até <strong>seis tentativas</strong>.</p>'
  +'<div class="wdLegend"><span class="wdExample wd-correct">A</span><span>Letra certa, no lugar certo</span></div>'
  +'<div class="wdLegend"><span class="wdExample wd-present">E</span><span>Letra certa, noutra posição</span></div>'
  +'<div class="wdLegend"><span class="wdExample wd-absent">R</span><span>Letra que não aparece</span></div>'
  +'<p class="wdHelpLast">Acentos e cedilhas são ignorados. Podes jogar quantas rondas quiseres — sem repetir respostas até percorreres a coleção.</p>');
}
function render(){
 if(!active||game!=="wordle"||!saved)return;
 const root=document.getElementById("screen");if(!root)return;
 root.classList.remove("edgyLobby");
 const r=round(),completed=r.guesses.length;
 const playing=!r.finished;
 const stage='<section class="wdPlay" aria-label="Jogo da Palavra Oculta">'
  +'<div class="wdTopline"><span class="wdRoundLabel">RONDA '+saved.number+'</span><span class="wdAttemptLabel">'+(playing?"Tentativa "+(completed+1)+" de 6":"Partida concluída")+'</span></div>'
  +'<div class="wdBoard" role="grid" aria-label="Grelha de seis tentativas para palavras de cinco letras">'+Array.from({length:6},(_,i)=>rowHtml(i)).join("")+'</div>'
  +'<p class="wdMessage'+(message?" wdMessageVisible":"")+'" role="status" aria-live="polite">'+(message?esc(message):playing?"Escreve a tua primeira palavra.":"")+'</p>'
  +resultsHtml()+keyboardHtml()
  +'<div class="wdBottomHint"><span class="wdHintDot"></span>'+words().answerCount+' palavras para descobrir · '+words().guessCount.toLocaleString("pt-PT")+' palavras aceites</div>'
  +'</section>';
 root.innerHTML='<div class="edgyGamePage wdPage">'
  +window.EDGY_gameUI.header("wordle",{intro:"Palavras · 1 jogador · Rondas ilimitadas"})
  +window.EDGY_gameUI.match({game:"wordle",stage,side:sideHtml(),layoutClass:"wdLayout",stageClass:"wdStage",sideClass:"wdSide"})
  +'</div>';
 root.querySelector("[data-back]")?.addEventListener("click",()=>nav("games"));
 root.querySelectorAll("[data-wd-key]").forEach(button=>button.addEventListener("click",()=>press(button.dataset.wdKey)));
 root.querySelector("[data-wd-new]")?.addEventListener("click",nextRound);
 root.querySelector("[data-wd-share]")?.addEventListener("click",share);
}
window.EDGY_wordle=Object.freeze({open,close,render,press});
})();
