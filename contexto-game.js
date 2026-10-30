/* EDGY Contexto — unlimited thematic word puzzle, original offline game. */
(function(){
"use strict";
const BASE="edgy_contexto_v1";
const data=()=>window.EDGY_contextoData,rules=()=>window.EDGY_contextoRules,seen=()=>window.EDGY_seenWords;
const escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let saved=null,active=false,busy=false,message="",scope="",request=0;
const id=()=>window.EDGY_auth?.getUser?.()?.id||"local";
const key=()=>BASE+"_"+id();
function read(){try{return JSON.parse(localStorage.getItem(key())||"null")||{}}catch{return {}}}
function persist(){try{localStorage.setItem(key(),JSON.stringify(saved))}catch{}}
function stats(){return {played:0,solved:0,best:0,hints:0}}
function validRound(r){return r&&data().answers.includes(r.answer)&&Array.isArray(r.guesses)&&r.guesses.length<=2500&&
 r.guesses.every(g=>g&&/^[a-z]{3,20}$/.test(g.word)&&Number.isInteger(g.rank)&&g.rank>=1)}
async function prepare(){
 const old=read(),statistics={...stats(),...(old.stats||{})};
 for(const k of Object.keys(stats()))statistics[k]=Math.max(0,Math.floor(Number(statistics[k])||0));
 saved={number:Math.max(0,Math.floor(Number(old.number)||0)),stats:statistics,round:null};
 if(validRound(old.round)){
  saved.round={answer:old.round.answer,guesses:old.round.guesses,
   finished:Boolean(old.round.finished),won:Boolean(old.round.won),hints:Math.max(0,Math.floor(Number(old.round.hints)||0)),credited:true};
  await seen()?.importPrevious([saved.round.answer],"contexto");
 }else{
  await createRound();
 }
 persist();
}
async function createRound(){
 const answer=seen()?await seen().choose(data().answers,"contexto"):
  data().answers[Math.floor(Math.random()*data().answers.length)];
 saved.number++;
 saved.round=answer?{answer,guesses:[],finished:false,won:false,hints:0,credited:false}:null;
}
async function open(){
 active=true;const token=++request;message="";busy=true;scope=id();
 const root=document.getElementById("screen");
 if(root)root.innerHTML='<div class="edgyGamePage cxPage"><p class="sub">A preparar o Contexto…</p></div>';
 try{
  await seen()?.ready();
  if(token!==request||!active||scope!==id())return;
  if(!saved||scope!==id())await prepare();
  else if(saved.round)await seen()?.importPrevious([saved.round.answer],"contexto");
  if(token!==request||!active)return;
 }catch(e){message="O histórico não pôde ser sincronizado. Podes continuar neste dispositivo.";console.warn(e)}
 finally{if(token===request){busy=false;render()}}
}
function close(){active=false;request++;message=""}
function round(){return saved?.round}
function finish(won){
 const r=round();if(!r||r.finished)return;
 r.finished=true;r.won=won;r.credited=true;
 saved.stats.played++;
 if(won){saved.stats.solved++;const count=r.guesses.filter(g=>!g.hint).length;
  if(!saved.stats.best||count<saved.stats.best)saved.stats.best=count;
  const xp=Math.max(10,65-Math.min(50,count*2)-r.hints*5);
  window.EDGY_recordLocalMatch?.("Contexto","Descobriu em "+count+" tentativas",xp);
  message="Palavra descoberta! +"+xp+" XP";
 }else message="A resposta era "+r.answer.toUpperCase()+".";
 persist();
}
function submit(word,hint=false){
 const r=round(),text=rules().normalize(word);
 if(!r||r.finished||busy)return;
 if(text.length<3||text.length>20){message="Escreve uma palavra entre 3 e 20 letras.";render(false);return}
 if(!rules().isWord(text)){message="Palavra não reconhecida no vocabulário do jogo.";render(false);return}
 if(r.guesses.some(g=>g.word===text)){message="Já tentaste essa palavra.";render(false);return}
 const rank=rules().rank(r.answer,text);
 r.guesses.push({word:text,rank,hint});
 if(hint){r.hints++;saved.stats.hints++}
 message=rank===1?"":"";
 if(rank===1)finish(true);
 persist();render();
}
function hint(){
 const r=round();if(!r||r.finished||busy)return;
 if(r.hints>=3){message="Já usaste as três dicas desta ronda.";render(false);return}
 const clue=rules().hint(r.answer,r.guesses);
 if(clue)submit(clue,true);
}
async function giveUp(){
 if(!round()||round().finished)return;
 const confirm=window.EDGY_platform?.confirmAction;
 const ok=confirm?await confirm({title:"Desistir desta palavra?",message:"A solução será revelada. Não ganhas XP nesta ronda.",confirmLabel:"Desistir"}):
  window.confirm("Desistir e revelar a palavra?");
 if(!ok||!active)return;
 finish(false);render();
}
async function nextRound(){
 if(busy||!round()?.finished)return;
 busy=true;message="A preparar uma nova palavra…";render();
 try{await createRound();message=round()?"":"Já jogaste todas as palavras disponíveis. Não vamos repetir respostas.";}
 catch(e){message="Não foi possível preparar a próxima palavra.";console.warn(e)}
 finally{busy=false;persist();render()}
}
function share(){
 const r=round();if(!r?.finished)return;
 const text="EDGY · Contexto #"+saved.number+"\n"+(r.won?"Consegui!":"Desisti")+" · "+r.guesses.length+" tentativas\n";
 navigator.clipboard?.writeText(text).then(()=>{message="Resultado copiado.";render(false)})
  .catch(()=>{message="Não foi possível copiar.";render(false)});
}
function guessesHtml(){
 const r=round(),arr=[...r.guesses].sort((a,b)=>a.rank-b.rank),best=arr.length?arr[0].rank:null;
 return '<div class="cxGuesses" aria-label="Tentativas por proximidade">'+(arr.length?
  arr.map(g=>{
   const near=Math.max(0,Math.min(100,100*(1-Math.log(Math.max(1,g.rank))/Math.log(12000))));
   const tone=g.rank<=15?"very":g.rank<=100?"near":g.rank<=500?"warm":"far";
   return '<article class="cxGuess '+tone+(g.rank===best?" best":"")+'"><div class="cxGuessText">'
    +'<strong>'+escape(g.word.toUpperCase())+(g.hint?' <small>· dica</small>':'')+'</strong>'
    +'<span>'+escape(rules().label(g.rank))+'</span></div>'
    +'<strong class="cxRank">#'+g.rank.toLocaleString("pt-PT")+'</strong>'
    +'<div class="cxProgress"><span style="width:'+near.toFixed(2)+'%"></span></div></article>';
  }).join(""):'<p class="cxEmpty">Começa por uma palavra comum, como «mar», «casa» ou «animal».</p>')
  +'</div>';
}
function render(reset=true){
 if(!active||game!=="contexto"||!saved)return;
 const el=document.getElementById("screen");if(!el)return;
 el.classList.remove("edgyLobby");
 const r=round(),finished=r?.finished;
 const statsMarkup=window.EDGY_gameUI.card("Estatísticas",'<div class="cxStats">'
  +[["Rondas",saved.stats.played],["Descobertas",saved.stats.solved],["Recorde",saved.stats.best||"—"],["Dicas",saved.stats.hints]].map(([label,value])=>
   '<span><strong>'+value+'</strong><small>'+label+'</small></span>').join("")+'</div>')
  +window.EDGY_gameUI.card("Como jogar",'<p>Encontra a palavra secreta usando palavras relacionadas pelo <strong>significado</strong>, não pelas letras.</p>'
    +'<p><strong>#1</strong> é a resposta. Quanto menor for o número, mais perto estás.</p>'
    +'<p>Rondas ilimitadas, três dicas por ronda e palavras novas sem repetições.</p>'
    +'<p class="cxDisclaimer">A EDGY utiliza associações temáticas próprias em português. Os rankings são aproximados, não os do modelo de IA do Contexto original.</p>');
 const stage='<section class="cxPlay">'
  +'<div class="cxHeading"><span>RONDA '+saved.number+'</span><span>'+(r?r.guesses.length+" tentativas":"Coleção concluída")+'</span></div>'
  +(r&&!finished?'<form class="cxForm" data-cx-form><label for="cx-guess">Que palavra procuramos?</label>'
   +'<div class="cxInputRow"><input id="cx-guess" type="text" inputmode="text" enterkeyhint="go" autocomplete="off" autocorrect="off"'
   +' autocapitalize="none" spellcheck="false" minlength="3" maxlength="25" placeholder="Escreve uma palavra…" aria-label="Escreve uma palavra">'
   +'<button type="submit" class="cxSubmit">Tentar</button></div></form>':'')
  +(message?'<p class="cxMessage" role="status">'+escape(message)+'</p>':'')
  +(r?'<div class="cxCurrentBest">Melhor posição: <strong>'+(r.guesses.length?"#"+Math.min(...r.guesses.map(g=>g.rank)):"—")+'</strong></div>'
    +guessesHtml():'<div class="cxEnd"><h3>Parabéns!</h3><p>Já descobriste todas as palavras disponíveis nos dois jogos. Não serão repetidas.</p></div>')
  +(r&&!finished?'<div class="cxControls"><button class="secondary" type="button" data-cx-hint '+(r.hints>=3?'disabled':'')+'>Dica ('+(3-r.hints)+')</button>'
   +'<button class="secondary" type="button" data-cx-giveup>Desistir</button></div>':'')
  +(r&&finished?'<div class="cxEnd"><h3>'+(r.won?"✦ Palavra descoberta!":"Ronda terminada")+'</h3><p>A solução era <strong>'+escape(r.answer.toUpperCase())+'</strong>.</p>'
   +'<div class="cxEndButtons"><button class="primary" data-cx-next type="button">Nova palavra →</button><button class="secondary" data-cx-share type="button">Partilhar</button></div></div>':'')
  +'</section>';
 el.innerHTML='<div class="edgyGamePage cxPage">'+window.EDGY_gameUI.header("contexto",{intro:"Palavras · 1 jogador · Tentativas ilimitadas"})
  +window.EDGY_gameUI.match({game:"contexto",stage,side:statsMarkup,layoutClass:"cxLayout",stageClass:"cxStage",sideClass:"cxSide"})
  +'</div>';
 el.querySelector("[data-back]")?.addEventListener("click",()=>nav("games"));
 el.querySelector("[data-cx-form]")?.addEventListener("submit",event=>{
  event.preventDefault();const input=el.querySelector("#cx-guess");submit(input?.value||"");
 });
 el.querySelector("[data-cx-hint]")?.addEventListener("click",hint);
 el.querySelector("[data-cx-giveup]")?.addEventListener("click",giveUp);
 el.querySelector("[data-cx-next]")?.addEventListener("click",nextRound);
 el.querySelector("[data-cx-share]")?.addEventListener("click",share);
}
window.EDGY_contexto=Object.freeze({open,close,render,submit,nextRound});
})();