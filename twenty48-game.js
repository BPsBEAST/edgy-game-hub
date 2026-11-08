/* EDGY 2048 — original interface using the classic 4×4 number-puzzle rules.
 * Offline / guest friendly; each account owns its local unfinished board.
 * XP and history use the existing EDGY solo-game completion hook. */
(function(){
"use strict";
const RULES=()=>window.EDGY_2048Rules;
const UI=()=>window.EDGY_gameUI;
const STORE="edgy_2048_v1_";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=x=>Number(x||0).toLocaleString("pt-PT");
const owner=()=>window.EDGY_auth?.getUser?.()?.id||"local";
const key=()=>STORE+owner();
const fresh=()=>({board:RULES().start(),score:0,best:0,moves:0,won:false,continued:false,finished:false,credited:false});
let active=false,profile="",round=null,justMerged=[],justSpawned=-1,message="";
function isBoard(b){return Array.isArray(b)&&b.length===16&&b.every(n=>Number.isInteger(n)&&n>=0&&(n===0||(n>=2&&n<=131072&&(n&(n-1))===0)))}
function read(){
 try{
  const data=JSON.parse(localStorage.getItem(key())||"null");
  if(!data||!isBoard(data.board))return fresh();
  return {...fresh(),board:data.board,score:Math.max(0,Number(data.score)||0),
   best:Math.max(0,Number(data.best)||0),moves:Math.max(0,Number(data.moves)||0),
   won:!!data.won,continued:!!data.continued,finished:!!data.finished,credited:!!data.credited};
 }catch{return fresh()}
}
function save(){if(!round)return;try{localStorage.setItem(key(),JSON.stringify(round))}catch{}}
function open(){
 active=true;profile=owner();round=read();message="";justMerged=[];justSpawned=-1;render();
}
function close(){active=false;message="";justMerged=[];justSpawned=-1}
function highest(){return Math.max(0,...round.board)}
function award(win){
 if(round.credited)return;
 round.credited=true;
 const xp=win?100:highest()>=128?Math.min(35,Math.floor(Math.log2(highest()))*4):0;
 save();
 window.EDGY_recordLocalMatch?.("2048",win?"2048 alcançado · "+fmt(round.score)+" pontos":"Fim de jogo · "+fmt(round.score)+" pontos",xp);
 message=win?"2048 alcançado! +100 XP EDGY. Podes continuar a jogar.":"Fim de jogo · "+(xp?"+"+xp+" XP pelo resultado.":"sem XP desta vez.");
}
function play(direction){
 if(!active||game!=="twenty48"||!round||round.finished||(round.won&&!round.continued))return false;
 const before=RULES().move(round.board,direction);
 if(!before.changed)return false;
 const next=RULES().spawn(before.board);
 justMerged=before.merged;
 justSpawned=next.findIndex((v,i)=>before.board[i]===0&&v!==0);
 round.board=next;round.score+=before.score;round.best=Math.max(round.best,round.score);round.moves++;
 if(!round.won&&highest()>=2048){round.won=true;award(true)}
 if(!RULES().validMoves(round.board)){
  round.finished=true;
  if(!round.won)award(false);
  else message="A grelha ficou sem jogadas. Conseguiste chegar a "+highest()+"!";
 }
 save();render();return true;
}
async function restart(){
 if(!active)return;
 if(round.moves>0&&!round.finished){
  const confirm=window.EDGY_platform?.confirmAction;
  const yes=confirm?await confirm({title:"Começar outra partida?",message:"A grelha atual será substituída. O recorde fica guardado.",confirmLabel:"Novo jogo"}):
   window.confirm("Substituir a partida atual?");
  if(!yes||!active||owner()!==profile)return;
 }
 const best=round.best;
 round=fresh();round.best=best;justMerged=[];justSpawned=-1;message="";save();render();
}
function keepGoing(){if(!round?.won||round.finished)return;round.continued=true;save();render()}
const dirs={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"up",ArrowDown:"down",a:"left",d:"right",w:"up",s:"down",A:"left",D:"right",W:"up",S:"down"};
document.addEventListener("keydown",event=>{
 if(!active||game!=="twenty48"||event.altKey||event.ctrlKey||event.metaKey||event.repeat)return;
 const target=event.target;
 if(target?.closest?.("input,textarea,select,[contenteditable]"))return;
 const direction=dirs[event.key];if(!direction)return;
 event.preventDefault();play(direction);
});
function boardMarkup(){
 return '<div class="t48Board" data-t48-board tabindex="0" aria-label="Tabuleiro 2048 de quatro linhas e quatro colunas">'
  +round.board.map((n,i)=>'<div class="t48Cell'+(n?' has-tile':'')+(justMerged.includes(i)?' merged':'')+(justSpawned===i?' newly':'')+'" data-value="'+(n>2048?'super':n)+'" aria-label="'+(n?n:"vazio")+', linha '+(1+Math.floor(i/4))+', coluna '+(1+i%4)+'">'
    +(n?'<span>'+n+'</span>':'')+'</div>').join("")+'</div>';
}
function render(){
 if(!active||game!=="twenty48"||!round)return;
 const root=document.getElementById("screen");if(!root)return;
 root.classList.remove("edgyLobby");
 const victory=round.won&&!round.continued&&!round.finished;
 const stage='<section class="t48Stage">'
  +'<div class="t48Top"><div class="t48Caption">COMBINA · EVOLUI · ATINGE 2048</div>'
  +'<div class="t48Scores"><div><small>PONTOS</small><strong>'+fmt(round.score)+'</strong></div>'
  +'<div><small>RECORDE</small><strong>'+fmt(round.best)+'</strong></div></div></div>'
  +'<div class="t48BoardHolder">'+boardMarkup()
  +(victory?'<div class="t48Overlay" role="status"><span class="t48WinIcon">✦</span><h3>Chegaste a 2048!</h3><p>Conquistaste 100 XP. Podes continuar.</p><button type="button" class="primary" data-t48-keep>Continuar →</button></div>':'')
  +(round.finished?'<div class="t48Overlay" role="status"><span class="t48WinIcon">✦</span><h3>Fim de jogo</h3><p>Pontuação: '+fmt(round.score)+'</p><button type="button" class="primary" data-t48-restart>Novo jogo</button></div>':'')
  +'</div>'
  +'<div class="t48Bottom"><span>'+round.moves+' movimentos</span><button type="button" class="secondary" data-t48-restart>Novo jogo</button></div>'
  +(message?'<div class="t48Message" role="status">'+esc(message)+'</div>':'')
  +'<div class="t48Arrows" aria-label="Controlos direcionais"><button type="button" data-t48-dir="up" aria-label="Mover para cima">↑</button>'
  +'<div><button type="button" data-t48-dir="left" aria-label="Mover para a esquerda">←</button><button type="button" data-t48-dir="down" aria-label="Mover para baixo">↓</button>'
  +'<button type="button" data-t48-dir="right" aria-label="Mover para a direita">→</button></div></div>'
  +'</section>';
 const side=UI().card("Objetivo",'<p>Desliza as peças para juntar números iguais: <strong>2 + 2 = 4</strong>, <strong>4 + 4 = 8</strong>, até chegares à peça <strong>2048</strong>.</p>'
   +'<p>Usa as setas ou <strong>W, A, S, D</strong> no computador. No telemóvel, desliza o dedo sobre a grelha.</p>'
   +'<p>Uma peça nova surge depois de cada movimento válido. Podes continuar depois de alcançar 2048.</p>')
  +UI().card("Progresso EDGY",'<div class="t48Stats"><span><strong>'+highest()+'</strong><small>Maior peça</small></span><span><strong>'+round.moves+'</strong><small>Movimentos</small></span></div>'
    +'<p>Alcançar 2048: <strong>100 XP</strong>. Se a grelha bloquear antes disso, podes receber até 35 XP conforme a maior peça.</p>'
    +'<p class="sub">Uma recompensa por partida concluída. O tabuleiro fica guardado neste dispositivo.</p>');
 root.innerHTML='<div class="edgyGamePage t48Page">'+UI().header("twenty48",{intro:"Puzzle 4×4 · Junta os números · Sem limite de tempo"})+
 UI().match({game:"twenty48",stage,side,layoutClass:"t48Layout",stageClass:"t48GameStage",sideClass:"t48Sidebar"})+'</div>';
 root.querySelector('[data-back]')?.addEventListener("click",()=>nav("games"));
 root.querySelectorAll('[data-t48-restart]').forEach(b=>b.addEventListener("click",restart));
 root.querySelector('[data-t48-keep]')?.addEventListener("click",keepGoing);
 root.querySelectorAll('[data-t48-dir]').forEach(b=>b.addEventListener("click",()=>play(b.dataset.t48Dir)));
 const board=root.querySelector('[data-t48-board]');
 if(board){
  let x=0,y=0,touch=false;
  board.addEventListener("pointerdown",e=>{if(e.pointerType!=="touch"&&e.pointerType!=="pen")return;
   x=e.clientX;y=e.clientY;touch=true;board.setPointerCapture?.(e.pointerId)});
  board.addEventListener("pointerup",e=>{if(!touch)return;touch=false;
   const dx=e.clientX-x,dy=e.clientY-y;
   if(Math.max(Math.abs(dx),Math.abs(dy))<26)return;
   play(Math.abs(dx)>Math.abs(dy)?(dx>0?"right":"left"):(dy>0?"down":"up"))});
  board.addEventListener("pointercancel",()=>touch=false);
 }
}
window.EDGY_twenty48=Object.freeze({open,close,render,play});
})();