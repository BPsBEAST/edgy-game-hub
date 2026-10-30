/* EDGY Damas replay — completed matches only, independent from the live game. */
(function(){
"use strict";
const api=()=>window.EDGY_auth?.getClient?.(),who=()=>window.EDGY_auth?.getUser?.();
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const initial=()=>{const board=Array(64).fill(null);for(let r=0;r<3;r++)for(let c=0;c<8;c++)if((r+c)%2)board[r*8+c]="b";for(let r=5;r<8;r++)for(let c=0;c<8;c++)if((r+c)%2)board[r*8+c]="w";return board};
let current=null,step=0,ticket=0;
const mask=document.createElement("div");mask.className="edReplayMask edgyDamasReplayMask";mask.hidden=true;
mask.innerHTML='<section class="edReplayCard edgyDamasReplayCard" role="dialog" aria-modal="true" aria-label="Replay de Damas"><div class="edgyDamasReplayContent"></div></section>';document.body.append(mask);
function close(){ticket++;mask.hidden=true;current=null}
mask.addEventListener("click",e=>{if(e.target===mask)close()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!mask.hidden)close()});
function boardAt(n){
 const r=current,moves=Array.isArray(r?.moves)?r.moves:[],b=initial();
 if(n>=moves.length)return Array.isArray(r.board)&&r.board.length===64?r.board:b;
 for(let j=0;j<n;j++){
  const m=moves[j],path=m?.path;
  if(!Array.isArray(path)||path.length<2||path.some(v=>!Number.isInteger(v)||v<0||v>=64))return b;
  let from=path[0],piece=b[from];if(!piece)return b;
  for(let k=1;k<path.length;k++){
   const dest=path[k],fr=Math.floor(from/8),fc=from%8,tr=Math.floor(dest/8),tc=dest%8;
   const dr=Math.sign(tr-fr),dc=Math.sign(tc-fc);
   if(!dr||!dc||Math.abs(tr-fr)!==Math.abs(tc-fc))return b;
   let y=fr+dr,x=fc+dc;
   while(y!==tr&&x!==tc){const q=y*8+x;if(b[q]&&b[q].toLowerCase()!==piece.toLowerCase())b[q]=null;y+=dr;x+=dc}
   b[from]=null;b[dest]=piece;from=dest;
  }
  if(m.promoted||(piece==="w"&&from<8)||(piece==="b"&&from>=56))b[from]=piece.toUpperCase();
 }
 return b;
}
function mark(r){return r.white_id===who()?.id?"white":r.black_id===who()?.id?"black":null}
function render(){
 const r=current;if(!r||mask.hidden)return;
 const moves=Array.isArray(r.moves)?r.moves:[],end=moves.length,board=boardAt(step);
 const flip=mark(r)==="black",order=Array.from({length:64},(_,i)=>flip?63-i:i);
 const last=moves[step-1]?.path||[];
 const pieceHTML=i=>{const p=board[i];return p?'<span class="edgyDamasReplayDisc '+(p.toLowerCase()==="w"?"white":"black")+'">'+(p===p.toUpperCase()?"<b>♛</b>":"")+'</span>':""};
 const cells=order.map(i=>'<span class="edgyDamasReplaySquare '+((Math.floor(i/8)+i%8)%2?"dark":"light")+(last.includes(i)?" last":"")+'">'+pieceHTML(i)+'</span>').join("");
 const outcome=r.status==="draw"?"Empate":r.status===(mark(r)==="white"?"white_win":"black_win")?"Vitória":"Derrota";
 const reason={resignation:"Desistência",no_moves:"Sem movimentos",no_progress:"Sem progresso"}[r.finish_reason]||"Fim da partida";
 const host=mask.querySelector(".edgyDamasReplayContent");
 host.innerHTML='<header class="edReplayHead"><div><span class="eyebrow">Detalhes da partida</span><h2>'+outcome+' · Damas</h2><p class="edReplayInfo">'+new Date(r.updated_at).toLocaleString("pt-PT")+'</p></div><button type="button" class="edReplayClose" data-close>✕ Fechar</button></header>'
 +'<div class="edgyDamasReplayGrid"><div><div class="edgyDamasReplayBoard" role="img" aria-label="Tabuleiro da jogada '+step+'">'+cells+'</div>'
 +'<div class="edReplayControls"><button data-nav="start" aria-label="Início" '+(!step?"disabled":"")+'>⏮</button><button data-nav="back" aria-label="Anterior" '+(!step?"disabled":"")+'>◀</button><button data-nav="next" aria-label="Seguinte" '+(step===end?"disabled":"")+'>▶</button><button data-nav="end" aria-label="Fim" '+(step===end?"disabled":"")+'>⏭</button></div><p class="edReplayInfo" style="text-align:center">Jogada '+step+' de '+end+'</p></div>'
 +'<div><div class="edReplayFacts"><div class="edReplayFact"><small>Brancas</small><b>'+esc(r.white_name||"Jogador")+'</b></div><div class="edReplayFact"><small>Pretas</small><b>'+esc(r.black_name||"Jogador")+'</b></div><div class="edReplayFact"><small>Resultado</small><b>'+outcome+'</b></div><div class="edReplayFact"><small>Motivo</small><b>'+reason+'</b></div></div>'
 +'<h3 class="edgyDamasMovesHeading">Movimentos</h3><div class="edgyDamasReplayMoves">'+(moves.length?moves.map((m,i)=>{
  const path=(m.path||[]).map(k=>"abcdefgh"[k%8]+(8-Math.floor(k/8))).join(m.captures?" × ":" → ");
  return '<button type="button" data-jump="'+(i+1)+'" class="'+(i+1===step?"active":"")+'">'+(i+1)+'. '+esc(path)+(m.promoted?" ♛":"")+'</button>';
 }).join(""):'<p class="edReplayInfo">Sem movimentos.</p>')+'</div></div></div>';
 host.querySelector("[data-close]").onclick=close;
 host.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>{const v=b.dataset.nav;step=v==="start"?0:v==="end"?end:v==="back"?Math.max(0,step-1):Math.min(end,step+1);render()});
 host.querySelectorAll("[data-jump]").forEach(b=>b.onclick=()=>{step=Number(b.dataset.jump);render()});
}
async function open(code){
 if(!api()||!who())return;
 code=String(code||"").trim().toUpperCase();
 if(!/^[A-F0-9]{8}$/.test(code))return;
 const t=++ticket;current=null;mask.hidden=false;
 mask.querySelector(".edgyDamasReplayContent").innerHTML='<div class="edReplayHead"><h2>Damas · Replay</h2><button class="edReplayClose" data-close>✕ Fechar</button></div><p class="edReplayInfo">A carregar o histórico…</p>';
 mask.querySelector("[data-close]").onclick=close;
 try{
  const [res,whoPlayed]=await Promise.all([
   api().from("checkers_rooms").select("id,code,white_id,black_id,board,moves,status,updated_at,finish_reason").eq("code",code).maybeSingle(),
   api().rpc("edgy_checkers_players",{p_code:code})
  ]);
  if(t!==ticket||mask.hidden)return;
  if(res.error)throw res.error;
  if(!res.data||!["white_win","black_win","draw"].includes(res.data.status))throw Error("Esta partida não está terminada ou já não está acessível.");
  if(![res.data.white_id,res.data.black_id].includes(who()?.id))throw Error("Não tens autorização para rever esta partida.");
  current={...res.data,white_name:whoPlayed.data?.white?.name,black_name:whoPlayed.data?.black?.name};
  step=Array.isArray(current.moves)?current.moves.length:0;render();
 }catch(e){
  if(t!==ticket||mask.hidden)return;
  mask.querySelector(".edgyDamasReplayContent").innerHTML='<div class="edReplayHead"><h2>Replay indisponível</h2><button class="edReplayClose" data-close>✕ Fechar</button></div><p class="edReplayInfo">'+esc(e.message||"Não foi possível carregar os dados")+'</p>';
  mask.querySelector("[data-close]").onclick=close;
 }
}
window.EDGY_checkersReplay={open,close};
})();
