/* EDGY Wordle — offline-first, unlimited Portuguese word puzzles.
   Local progress persists across refreshes; XP uses the same local EDGY record flow.
   All score/keyboard logic is delegated to wordle-rules.js. */
(function(){
"use strict";
const STORAGE="edgy_wordle_v1",MAX_GUESSES=6;
const wordHistory=()=>window.EDGY_seenWords;
const owner=()=>window.EDGY_auth?.getUser?.()?.id||"local";
const storageKey=()=>owner()==="local"?STORAGE:STORAGE+"_"+owner();
let sessionOwner="",openToken=0;
const words=()=>window.EDGY_wordBank;
const rules=()=>window.EDGY_wordRules;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let saved=null,active=false,message="",revealRow=-1,loading=false;
function blankStats(){return {played:0,wins:0,streak:0,best:0,distribution:[0,0,0,0,0,0]}}
function read(){
 try{
  let raw=localStorage.getItem(storageKey());
  if(!raw&&owner()!=="local"&&localStorage.getItem("edgy_owner_id")===owner()){
   raw=localStorage.getItem(STORAGE);
  }
  const parsed=JSON.parse(raw||"null");
  if(!parsed||typeof parsed!=="object")return {};
  return parsed;
 }catch{return {}}
}
function persist(){
 try{localStorage.setItem(storageKey(),JSON.stringify(saved))}catch{}
}
async function newRound(previous=-1){
 const bank=words();
 if(wordHistory()){
  const chosen=await wordHistory().choose(bank.answers,"wordle");
  if(!chosen)return {answer:"",guesses:[],draft:"",finished:true,won:false,credited:true,exhausted:true};
  return {answer:chosen.toUpperCase(),guesses:[],draft:"",finished:false,won:false,credited:false};
 }
 const next=rules().choose(saved?.bag,bank.answers.length,previous);
 saved.bag=next.remaining;
 return {answer:bank.answers[next.index].toUpperCase(),guesses:[],draft:"",finished:false,won:false,credited:false};
}
async function setup(){
 if(saved&&sessionOwner===owner())return;
 const bank=words(),data=read(),ledger=wordHistory();
 saved={
  bag:Array.isArray(data.bag)?data.bag:[],
  round:null,
  stats:{...blankStats(),...(data.stats||{})},
  number:Math.max(0,Math.floor(Number(data.number)||0))
 };
 const stats=saved.stats;
 for(const key of ["played","wins","streak","best"])stats[key]=Math.max(0,Math.floor(Number(stats[key])||0));
 stats.distribution=Array.from({length:6},(_,i)=>Math.max(0,Math.floor(Number(stats.distribution?.[i])||0)));
 if(ledger){
  await ledger.ready();
  // Migrate existing Wordle history from the old shuffled-answer bag.
  if(data.number>0&&Array.isArray(data.bag)&&data.bag.length>0){
   const remaining=new Set(data.bag.filter(Number.isInteger));
   const previous=bank.answers.filter((_,index)=>!remaining.has(index));
   await ledger.importPrevious(previous,"wordle");
  }
 }
 const old=data.round;
 if(old&&bank.answers.includes(String(old.answer||"").toLowerCase())&&Array.isArray(old.guesses)&&old.guesses.length<=6&&old.guesses.every(x=>typeof x==="string"&&/^[A-Z]{5}$/.test(x))&&
  typeof old.draft==="string"&&/^[A-Z]{0,5}$/.test(old.draft)){
  saved.round={answer:old.answer,guesses:old.guesses,draft:old.draft,
   finished:Boolean(old.finished),won:Boolean(old.won),credited:Boolean(old.credited)};
  await ledger?.importPrevious([old.answer],"wordle");
 }else{saved.round=await newRound();saved.number++}
 if(saved.round.finished)saved.round.credited=true;
 persist();
}
async function open(){
 active=true;const ticket=++openToken,identity=owner();
 message="";revealRow=-1;loading=true;
 if(sessionOwner!==identity)saved=null;
 sessionOwner=identity;
 const el=document.getElementById("screen");
 if(el)el.innerHTML='<div class="edgyGamePage wdPage"><p class="sub">A preparar o Wordle…</p></div>';
 try{await setup()}
 catch(error){console.warn("EDGY Wordle:",error);message="Não foi possível sincronizar todas as palavras."}
 if(!active||ticket!==openToken||identity!==owner())return;
 loading=false;render();
}
function close(){
 active=false;openToken++;message="";revealRow=-1;
 document.getElementById("screen")?.classList.remove("wdTyping");
}
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
 window.EDGY_recordLocalMatch?.("Wordle",won?"Vitória em "+r.guesses.length+"/6":"Derrota · "+r.answer,xp);
 message=won?"Excelente! Acertaste e ganhaste "+xp+" XP.":"A palavra era "+r.answer+". Ganhaste "+xp+" XP.";
}
/* The native mobile input updates the active row in place.
   Replacing the entire screen on each keystroke would blur the input and
   repeatedly close the phone's system keyboard. */
function showMessage(text){
 message=text;
 const node=document.querySelector("#screen .wdMessage");
 if(node){
  node.textContent=text||"Escreve a tua palavra.";
  node.classList.toggle("wdMessageVisible",Boolean(text));
 }
}
function paintDraft(){
 const r=round();
 const row=document.querySelector('#screen .wdRow[data-wd-current="true"]');
 if(!row||!r)return;
 row.querySelectorAll(".wdTile").forEach((tile,i)=>{
  const letter=r.draft[i]||"";
  const changed=tile.textContent!==letter;
  tile.textContent=letter;
  tile.classList.toggle("wdFilled",Boolean(letter));
  tile.setAttribute("aria-label",letter||"vazio");
  if(changed&&letter&&typeof tile.animate==="function"&&!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches){
   tile.animate([{transform:"scale(.88)",borderColor:"#f378b6"},{transform:"scale(1)",borderColor:"#ad6f9a"}],
    {duration:155,easing:"cubic-bezier(.19,.85,.22,1)"});
  }
 });
}
function setNativeDraft(input){
 if(!active||game!=="wordle"||!round()||round().finished)return;
 const text=words().normalize(input.value).slice(0,5);
 input.value=text;
 round().draft=text;
 revealRow=-1;
 persist();
 paintDraft();
 if(message)showMessage("");
}
function focusNative(){
 const input=document.querySelector("#screen [data-wd-native]");
 if(input&&!input.disabled)input.focus({preventScroll:true});
}
function setTypingMode(enabled){
 const root=document.getElementById("screen");
 if(!root||!active||game!=="wordle")return;
 root.classList.toggle("wdTyping",Boolean(enabled));
 if(enabled)root.scrollTop=0;
}
function submitGuess(keepNativeFocus=false){
 if(!active||game!=="wordle"||!round()||round().finished)return;
 const r=round();
 if(r.draft.length!==5){showMessage("Escreve uma palavra de cinco letras.");return}
 if(!words().isWord(r.draft)){showMessage("Palavra não reconhecida. Experimenta outra.");return}
 r.guesses.push(r.draft);
 r.draft="";
 message="";
 revealRow=r.guesses.length-1;
 if(r.guesses.at(-1)===r.answer)finish(true);
 else if(r.guesses.length===MAX_GUESSES)finish(false);
 persist();
 // Closing the native keyboard reveals the entire board and its colour animation.
 setTypingMode(false);
 if(keepNativeFocus){
  const input=document.querySelector("#screen [data-wd-native]");
  input?.blur?.();
 }
 render();
 const root=document.getElementById("screen");
 if(root)root.scrollTop=0;
}
function press(key){
 if(!active||game!=="wordle"||!round()||round().finished)return;
 const r=round(),value=String(key||"").toUpperCase();
 if(value==="ENTER"){submitGuess();return}
 if(value==="BACKSPACE")r.draft=r.draft.slice(0,-1);
 else{
  const letter=words().normalize(value);
  if(letter.length!==1||r.draft.length>=5)return;
  r.draft+=letter;
 }
 revealRow=-1;
 message="";
 persist();
 render();
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
async function nextRound(){
 const r=round();if(!r?.finished||r.exhausted||loading)return;
 const previous=words().answers.indexOf(r.answer.toLowerCase());
 loading=true;message="A preparar outra palavra…";render();
 try{saved.round=await newRound(previous);saved.number++;message=saved.round.exhausted?"Esgotaste todas as respostas disponíveis, sem repetirmos palavras.":"";}
 catch(error){message="Não foi possível preparar outra palavra.";console.warn(error)}
 finally{loading=false;revealRow=-1;persist();render()}
}
function share(){
 const r=round();if(!r?.finished)return;
 const emoji={correct:"🟩",present:"🟨",absent:"⬛"};
 const lines=r.guesses.map(g=>rules().score(g,r.answer).map(s=>emoji[s]).join(""));
 const label="EDGY · Wordle #"+saved.number+" "+(r.won?r.guesses.length: "X")+"/6";
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
 return '<div class="wdRow" role="row" '
 +(!attempt&&i===r.guesses.length&&!r.finished?'data-wd-current="true" title="Toca para escrever a palavra"':'')
 +(attempt&&i===r.guesses.length-1&&!r.finished?' data-wd-previous="true"':'')
 +' aria-label="Tentativa '+(i+1)+'">'
 +Array.from({length:5},(_,j)=>{
  const letter=value[j]||"",state=results[j]||"",animate=reveal?" wdReveal":"";
  return '<span class="wdTile'+(state?" wd-"+state:"")+(letter?" wdFilled":"")+(animate)+"\" role=\"gridcell\" aria-label=\""+
    (letter?esc(letter):"vazio")+(state?", "+({correct:"letra certa",present:"posição errada",absent:"não aparece"}[state]):"")+
    "\" style=\"--wd-order:"+j+"\">"+esc(letter)+"</span>";
 }).join("")+"</div>";
}
function nativeTypingHtml(){
 if(round().finished)return "";
 return '<form class="wdNativeForm" data-wd-form>'
  +'<label for="wd-native-word" class="wdNativeLabel">A tua palavra</label>'
  +'<div class="wdNativeControls"><input id="wd-native-word" data-wd-native type="text"'
  +' inputmode="text" enterkeyhint="done" autocomplete="off" autocorrect="off"'
  +' autocapitalize="characters" spellcheck="false" maxlength="12"'
  +' aria-label="Palavra de cinco letras" placeholder="Escreve aqui…" value="'+esc(round().draft)+'">'
  +'<button type="submit" class="wdNativeSubmit">Confirmar</button></div>'
  +'</form>';
}
function resultsHtml(){
 const r=round();
 if(!r.finished)return "";
 if(r.exhausted)return '<section class="wdOutcome"><div class="wdOutcomeLead">Coleção concluída!</div>'
  +'<p>Já jogaste todas as palavras disponíveis. Não serão sorteadas novamente.</p></section>';
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
  +'<p class="wdSavedNotice">As respostas já utilizadas ficam registadas por jogador, também na conta online quando disponível.</p>')
  +p.card("Como jogar",'<p>Descobre a palavra de <strong>cinco letras</strong> em até <strong>seis tentativas</strong>.</p>'
  +'<div class="wdLegend"><span class="wdExample wd-correct">A</span><span>Letra certa, no lugar certo</span></div>'
  +'<div class="wdLegend"><span class="wdExample wd-present">E</span><span>Letra certa, noutra posição</span></div>'
  +'<div class="wdLegend"><span class="wdExample wd-absent">R</span><span>Letra que não aparece</span></div>'
  +'<p class="wdHelpLast">Acentos e cedilhas são ignorados. Podes jogar livremente. As respostas já usadas não voltam a sair.</p>');
}
function render(){
 if(!active||game!=="wordle"||!saved)return;
 const root=document.getElementById("screen");if(!root)return;
 root.classList.remove("edgyLobby","wdTyping");
 const r=round(),completed=r.guesses.length;
 const playing=!r.finished&&!r.exhausted;
 const stage='<section class="wdPlay" aria-label="Jogo Wordle">'
  +'<div class="wdTopline"><span class="wdRoundLabel">RONDA '+saved.number+'</span><span class="wdAttemptLabel">'+(r.exhausted?"Sem novas palavras":playing?"Tentativa "+(completed+1)+" de 6":"Partida concluída")+'</span></div>'
  +(r.exhausted?"":'<div class="wdBoard" role="grid" aria-label="Grelha de seis tentativas para palavras de cinco letras">'+Array.from({length:6},(_,i)=>rowHtml(i)).join("")+'</div>')
  +'<p class="wdMessage'+(message?" wdMessageVisible":"")+'" role="status" aria-live="polite">'+(message?esc(message):"")+'</p>'
  +resultsHtml()+'<p class="wdDesktopHint">Escreve com o teclado do computador. Usa Enter para confirmar e Backspace para apagar.</p>'+nativeTypingHtml()
  +'</section>';
 root.innerHTML='<div class="edgyGamePage wdPage">'
  +window.EDGY_gameUI.header("wordle",{intro:"Palavras · 1 jogador · Rondas ilimitadas"})
  +window.EDGY_gameUI.match({game:"wordle",stage,side:sideHtml(),layoutClass:"wdLayout",stageClass:"wdStage",sideClass:"wdSide"})
  +'</div>';
 root.querySelector("[data-back]")?.addEventListener("click",()=>nav("games"));
 const native=root.querySelector("[data-wd-native]");
 native?.addEventListener("input",event=>{if(!event.isComposing)setNativeDraft(native)});
 native?.addEventListener("compositionend",()=>setNativeDraft(native));
 native?.addEventListener("focus",()=>setTypingMode(true));
 native?.addEventListener("blur",()=>{
  // Tapping Confirmar must not expand the board before the submit/click fires.
  if(!document.activeElement?.closest?.("[data-wd-form]"))setTypingMode(false);
 });
 root.querySelector("[data-wd-form]")?.addEventListener("submit",event=>{
  event.preventDefault();
  if(native)setNativeDraft(native);
  submitGuess(true);
 });
 root.querySelector('[data-wd-current="true"]')?.addEventListener("click",focusNative);
 root.querySelector("[data-wd-new]")?.addEventListener("click",nextRound);
 root.querySelector("[data-wd-share]")?.addEventListener("click",share);
}
window.EDGY_wordle=Object.freeze({open,close,render,press});
})();
