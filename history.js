/* EDGY personal game history with secure chess replays. */
(function(){
"use strict";
const api=()=>window.EDGY_auth?.getClient(),viewer=()=>window.EDGY_auth?.getUser();
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const date=v=>{try{return new Date(v).toLocaleString("pt-PT",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}catch{return "—"}};
const reasons={checkmate:"Xeque-mate",timeout:"Tempo esgotado",timeout_insufficient:"Tempo esgotado · material insuficiente",agreement:"Empate por acordo",resignation:"Desistência",rules:"Empate pelas regras"};
const labels={win:"Vitória",loss:"Derrota",draw:"Empate"};
const resultType=s=>/empate/i.test(s||"")?"draw":/derrota|perde/i.test(s||"")?"loss":"win";
let cloud=[],ticCloud=[],local=[],type="all",result="all",search="",requestCount=0,selected=null,detail=null,moves=[],step=0,Chess=null;
const style=document.createElement("style");style.textContent=".edHistoryStats{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:20px 0}.edHistoryStat{padding:15px 8px;text-align:center;background:#261e3e;border:1px solid #4c3961;border-radius:13px}.edHistoryStat b{display:block;font-size:22px}.edHistoryStat small{display:block;color:#b1a3bf;margin-top:5px;font-size:11px}.edHistoryFilters{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.edHistoryFilters button{border:1px solid #59436c;border-radius:10px;background:#302544;color:#ddd0ea;font-size:12px;font-weight:700;padding:9px 13px;min-height:39px}.edHistoryFilters button.active{background:#713159;border-color:#f44b99;color:#fff}.edHistorySearch{background:#201936;color:#fff;border:1px solid #554368;border-radius:12px;padding:12px;width:min(100%,380px);margin:8px 0 18px}.edHistoryList{display:grid;gap:9px}.edHistoryCard{display:flex;align-items:center;gap:13px;background:#231a3b;border:1px solid #503d60;border-radius:15px;color:#fff;text-align:left;padding:14px;width:100%;min-width:0}.edHistoryCard:hover{border-color:#f24193}.edHistoryIcon{height:44px;width:44px;border-radius:12px;background:#4c2e56;flex:none;display:grid;place-items:center;color:#ff8bc4;font-size:24px}.edHistoryBody{min-width:0;flex:1}.edHistoryBody strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:14px}.edHistoryBody small{display:block;color:#b9acc7;margin-top:4px;font-size:11px;line-height:1.5}.edHistoryOutcome{text-align:right;flex:none;font-size:12px;font-weight:800}.edHistoryOutcome.win{color:#8be6bf}.edHistoryOutcome.loss{color:#ffa3bc}.edHistoryOutcome.draw{color:#e9c39f}.edHistoryOutcome small{display:block;font-size:11px;color:#f68ec3;margin-top:5px}.edHistoryEmpty{padding:26px;border:1px dashed #58466c;border-radius:14px;color:#aba1be;text-align:center;font-size:13px}.edReplayMask{position:fixed;inset:0;z-index:121;background:#0d081ee6;backdrop-filter:blur(12px);padding:15px;display:grid;place-items:center}.edReplayMask[hidden]{display:none!important}.edReplayCard{width:min(100%,840px);max-height:calc(100dvh - 30px);overflow-y:auto;background:#241a3d;border:1px solid #664d79;border-radius:20px;padding:20px;box-shadow:0 25px 70px #0009}.edReplayHead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.edReplayHead h2{margin:4px 0 9px;font-size:24px}.edReplayClose{border:1px solid #655274;border-radius:10px;background:#352846;color:white;padding:9px 13px}.edReplayGrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.86fr);gap:16px;margin-top:15px}.edReplayControls{display:flex;gap:5px;justify-content:center;margin:11px 0 5px}.edReplayControls button{flex:1;max-width:90px;min-height:41px;background:#3b2c51;color:#fff;border:1px solid #6c507b;border-radius:9px;font-size:18px}.edReplayControls button:disabled{opacity:.35}.edReplayInfo{font-size:12px;color:#c6b6d7;line-height:1.5}.edReplayFacts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.edReplayFact{padding:12px;background:#322747;border-radius:10px}.edReplayFact small{display:block;font-size:11px;color:#aa9fb9}.edReplayFact b{display:block;margin-top:4px;font-size:12px}.edReplayMoves{display:flex;flex-wrap:wrap;gap:5px;margin-top:12px;max-height:195px;overflow-y:auto}.edReplayMoves button{background:#392950;border:1px solid transparent;border-radius:7px;padding:7px 9px;color:#fff;font-size:12px}.edReplayMoves button.active{background:#7a3366;border-color:#f04d99}@media(max-width:640px){.edHistoryStats{gap:5px}.edHistoryStat{padding:12px 4px}.edHistoryStat b{font-size:18px}.edHistoryStat small{font-size:10px}.edHistoryCard{padding:12px 10px;gap:9px}.edHistoryIcon{height:37px;width:37px;font-size:20px}.edHistoryBody small{font-size:10px}.edReplayCard{padding:14px}.edReplayGrid{grid-template-columns:1fr}.edReplayGrid .edgyReplayBoard{width:min(100%,42dvh,340px)}}";document.head.append(style);
const mask=document.createElement("div");mask.className="edReplayMask";mask.hidden=true;
mask.innerHTML='<div class="edReplayCard" role="dialog" aria-modal="true" aria-label="Detalhes da partida"><div id="edgy-replay-content"></div></div>';document.body.append(mask);
const close=()=>{mask.hidden=true;selected=null};
mask.addEventListener("click",e=>{if(e.target===mask)close()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!mask.hidden)close()});
function allGames(){
 const server=cloud.map(p=>({...p,key:p.id,game:"Xadrez",isChess:true,when:p.date})).concat(ticCloud);
 const others=local.filter(h=>!(h.title==="Xadrez"&&cloud.some(c=>c.id===h.client_id))&&!(h.title==="Jogo do Galo"&&ticCloud.some(c=>c.id===h.client_id))).map(h=>({...h,key:h.client_id||h.date,game:h.title,isChess:false,when:h.date,outcome:resultType(h.result)}));
 return [...server,...others].sort((a,b)=>Date.parse(b.when||0)-Date.parse(a.when||0));
}
function draw(){
 const el=document.getElementById("edgy-history-list");if(!el)return;
 const filtered=allGames().filter(g=>{
 if(type==="chess"&&g.game!=="Xadrez")return false;
 if(type==="other"&&g.game==="Xadrez")return false;
 if(result!=="all"&&g.outcome!==result)return false;
 return [g.opponent_name,g.opponent_username,g.title,g.result].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase());
 });
 el.innerHTML=filtered.length?'<div class="edHistoryList">'+filtered.map(g=>{
 const name=g.isChess?'Xadrez · vs '+esc(g.opponent_name||"Jogador"):g.isTic?"Jogo do Galo · Online":esc(g.game||"Jogo");
 const meta=g.isChess?(g.color==="white"?"Brancas":"Pretas")+' · '+Math.round(g.base_ms/60000)+'+'+Math.round(g.increment_ms/1000)+' · '+esc(reasons[g.reason]||"Partida terminada"):g.isTic?"3×3 · "+g.color+" · "+(labels[g.outcome]||"Partida"):esc(g.result||"");
 return '<button type="button" class="edHistoryCard" data-key="'+esc(g.key)+'"><span class="edHistoryIcon">'+(g.game==="Xadrez"?"♞":g.isTic?"✕":"◆")+'</span><span class="edHistoryBody"><strong>'+name+'</strong><small>'+meta+'</small><small>'+date(g.when)+'</small></span><span class="edHistoryOutcome '+g.outcome+'">'+(labels[g.outcome]||esc(g.result||"Resultado"))+'<small>+'+Number(g.xp||0)+' XP</small></span></button>';
 }).join("")+'</div>':'<div class="edHistoryEmpty">Ainda não existem partidas para estes filtros.</div>';
 el.querySelectorAll("[data-key]").forEach(b=>b.onclick=()=>{const found=allGames().find(g=>String(g.key)===b.dataset.key);if(found)open(found)});
}
function drawStats(){
 const target=document.getElementById("edgy-history-stats");if(!target)return;
 const online=cloud.concat(ticCloud),win=online.filter(g=>g.outcome==="win").length,draws=online.filter(g=>g.outcome==="draw").length,loss=online.filter(g=>g.outcome==="loss").length;
 target.innerHTML=[["Online",online.length],["Vitórias",win],["Empates",draws],["Derrotas",loss]].map(([k,v])=>'<div class="edHistoryStat"><b>'+v+'</b><small>'+k+'</small></div>').join("");
}
async function sync(){
 const n=++requestCount;if(!api()||!viewer())return;
 const info=document.getElementById("edgy-history-status");if(info)info.textContent="A sincronizar partidas…";
 try{
  const [chess,tic]=await Promise.all([
   api().rpc("edgy_my_chess_history",{p_limit:60}),
   api().from("tic_rooms").select("id,code,white_id,black_id,board,moves,status,updated_at,ply,finish_reason")
    .in("status",["white_win","black_win","draw"]).order("updated_at",{ascending:false}).limit(60)
  ]);
  if(chess.error)throw chess.error;
  if(n!==requestCount)return;
  cloud=Array.isArray(chess.data)?chess.data:[];
  const uid=viewer().id;
  ticCloud=(tic.error?[]:tic.data||[]).map(r=>{
   const color=r.white_id===uid?"X":"O",outcome=r.status==="draw"?"draw":
    r.status===(color==="X"?"white_win":"black_win")?"win":"loss";
   return {id:r.id,key:"tic-"+r.id,game:"Jogo do Galo",isTic:true,when:r.updated_at,
    date:r.updated_at,color,outcome,status:r.status,board:r.board,moves:r.moves,
    code:r.code,xp:outcome==="win"?50:outcome==="draw"?20:10,reason:r.finish_reason,result:labels[outcome]};
  });
  if(info)info.textContent=tic.error?"Histórico de Xadrez sincronizado; Jogo do Galo temporariamente indisponível.":"Histórico online sincronizado entre dispositivos.";
 }catch(e){if(info)info.textContent="Histórico online indisponível. A mostrar os resultados guardados localmente."}
 drawStats();draw();
}
function mount(list){
 local=Array.isArray(list)?list:[];cloud=[];ticCloud=[];type="all";result="all";search="";
 const root=document.getElementById("screen");if(!root)return;
 root.innerHTML='<button type="button" class="edgyReturnProfile" id="edgy-return-profile" aria-label="Voltar ao perfil">← Voltar ao perfil</button><span class="eyebrow">As tuas partidas</span><h1>Histórico <span style="color:#ff4199">✦</span></h1><p class="sub" id="edgy-history-status">Resultados, adversários e replays guardados na tua conta.</p><div class="edHistoryStats" id="edgy-history-stats"></div><div class="edHistoryFilters"><button data-type="all" class="active">Todos</button><button data-type="chess">Xadrez</button><button data-type="other">Outros jogos</button></div><div class="edHistoryFilters"><button data-result="all" class="active">Todos</button><button data-result="win">Vitórias</button><button data-result="loss">Derrotas</button><button data-result="draw">Empates</button></div><input class="edHistorySearch" id="edgy-history-search" type="search" placeholder="Pesquisar adversário ou jogo…" aria-label="Pesquisar histórico"><div id="edgy-history-list"></div>';
 root.querySelector("#edgy-return-profile")?.addEventListener("click",()=>nav("profile"));
 root.querySelectorAll("[data-type]").forEach(b=>b.onclick=()=>{type=b.dataset.type;root.querySelectorAll("[data-type]").forEach(x=>x.classList.toggle("active",x===b));draw()});
 root.querySelectorAll("[data-result]").forEach(b=>b.onclick=()=>{result=b.dataset.result;root.querySelectorAll("[data-result]").forEach(x=>x.classList.toggle("active",x===b));draw()});
 root.querySelector("#edgy-history-search").oninput=e=>{search=e.target.value.trim();draw()};
 drawStats();draw();sync();
}
function basic(g){
 mask.hidden=false;const host=mask.querySelector("#edgy-replay-content");
 host.innerHTML='<div class="edReplayHead"><h2>'+esc(g.game||"Jogo")+'</h2><button type="button" class="edReplayClose" data-close>Fechar</button></div><p class="edReplayInfo">'+date(g.when)+' · '+esc(g.result||"Partida terminada")+' · +'+Number(g.xp||0)+' XP</p><p class="edReplayInfo">Este jogo não tem um replay guardado.</p>';
 host.querySelector("[data-close]").onclick=close;
}
let ticStep=0;
function openTic(g){selected=g;ticStep=Array.isArray(g.moves)?g.moves.length:0;mask.hidden=false;renderTicReplay()}
function renderTicReplay(){
 if(!selected?.isTic||mask.hidden)return;
 const g=selected,arr=Array(9).fill("-"),moves=Array.isArray(g.moves)?g.moves:[];
 for(const m of moves.slice(0,ticStep))if(Number.isInteger(m.cell)&&m.cell>=0&&m.cell<9)arr[m.cell]=m.mark;
 const host=mask.querySelector("#edgy-replay-content");
 host.innerHTML='<div class="edReplayHead"><div><span class="eyebrow">Replay online</span><h2>Jogo do Galo · '+esc(labels[g.outcome])+'</h2>'
 +'<p class="edReplayInfo">'+date(g.when)+' · Jogaste com '+esc(g.color)+'</p></div><button type="button" class="edReplayClose" data-close>✕ Fechar</button></div>'
 +'<div class="edgyTicHistoryBoard">'+arr.map(v=>'<span class="'+(v!=="-"?"marked":"")+'">'+(v==="-"?"":esc(v))+'</span>').join("")+'</div>'
 +'<div class="edReplayControls"><button type="button" data-tic-step="0" aria-label="Início">⏮</button><button type="button" data-tic-step="back" aria-label="Anterior">◀</button><button type="button" data-tic-step="next" aria-label="Próximo">▶</button><button type="button" data-tic-step="end" aria-label="Fim">⏭</button></div>'
 +'<p class="edReplayInfo" style="text-align:center">Jogada '+ticStep+' de '+moves.length+'</p>'
 +'<div class="edgyTicReplayMoves">'+moves.map((m,i)=>'<button type="button" data-tic-jump="'+(i+1)+'" class="'+(i+1===ticStep?"active":"")+'">'+(i+1)+'. '+esc(m.mark)+' → '+(m.cell+1)+'</button>').join("")+'</div>';
 host.querySelector("[data-close]").onclick=close;
 host.querySelectorAll("[data-tic-step]").forEach(b=>b.onclick=()=>{
  const x=b.dataset.ticStep;
  ticStep=x==="0"?0:x==="end"?moves.length:x==="back"?Math.max(0,ticStep-1):Math.min(moves.length,ticStep+1);
  renderTicReplay();
 });
 host.querySelectorAll("[data-tic-jump]").forEach(b=>b.onclick=()=>{ticStep=Number(b.dataset.ticJump);renderTicReplay()});
}
async function open(g){
 if(g.isTic){openTic(g);return}if(!g.isChess){basic(g);return}
 selected=g;detail=null;moves=[];step=0;mask.hidden=false;
 const host=mask.querySelector("#edgy-replay-content");host.innerHTML='<p class="edReplayInfo">A carregar replay da partida…</p>';
 try{
  const [res,mod]=await Promise.all([api().rpc("edgy_my_chess_game",{p_game_id:g.id}),import("https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js")]);
  if(res.error)throw res.error;if(!res.data)throw Error("Partida indisponível ou sem acesso.");
  if(selected?.id!==g.id)return;
  Chess=mod.Chess;detail=res.data;
  const game=new Chess();
  if(detail.pgn){try{game.loadPgn(detail.pgn);moves=game.history()}catch{moves=[]}}
  step=moves.length;renderDetail();
 }catch(e){host.innerHTML='<div class="edReplayHead"><h2>Não foi possível abrir a partida</h2><button class="edReplayClose" data-close>Fechar</button></div><p class="edReplayInfo">'+esc(e.message||"Erro inesperado")+'</p>';host.querySelector("[data-close]").onclick=close}
}
function navigate(n){step=Math.min(moves.length,Math.max(0,n));renderDetail()}
function renderDetail(){
 if(!selected||!detail||mask.hidden)return;
 const g=selected,d=detail,host=mask.querySelector("#edgy-replay-content");
 const chess=new Chess();for(let i=0;i<step;i++)chess.move(moves[i]);
 const fen=moves.length?chess.fen():d.fen;
 const board=window.EDGY_pieces?.fenBoard(fen,g.color==="black")||'<p class="edReplayInfo">Tabuleiro indisponível</p>';
 const facts=[["Brancas",d.white_name],["Pretas",d.black_name],["Ritmo",Math.round(d.base_ms/60000)+"+"+Math.round(d.increment_ms/1000)],["Resultado",labels[g.outcome]],["Motivo",reasons[d.reason]||"Fim da partida"],["XP","+"+Number(g.xp||0)]];
 host.innerHTML='<div class="edReplayHead"><div><span class="eyebrow">Detalhes da partida</span><h2>'+esc(labels[g.outcome]||"Partida")+' · Xadrez</h2><p class="edReplayInfo">'+date(d.finished_at)+'</p></div><button class="edReplayClose" data-close>✕ Fechar</button></div><div class="edReplayGrid"><div>'+board+'<div class="edReplayControls"><button data-start aria-label="Início" '+(!step?"disabled":"")+'>⏮</button><button data-prev aria-label="Anterior" '+(!step?"disabled":"")+'>◀</button><button data-next aria-label="Seguinte" '+(step>=moves.length?"disabled":"")+'>▶</button><button data-end aria-label="Fim" '+(step>=moves.length?"disabled":"")+'>⏭</button></div><p class="edReplayInfo" style="text-align:center">Jogada '+step+' de '+moves.length+'</p></div><div><div class="edReplayFacts">'+facts.map(([k,v])=>'<div class="edReplayFact"><small>'+esc(k)+'</small><b>'+esc(v||"—")+'</b></div>').join("")+'</div><p class="edReplayInfo">'+(g.color==="white"?"Jogaste de brancas":"Jogaste de pretas")+' · '+Number(d.ply||0)+' meios-lances</p><h3 style="font-size:14px;margin:13px 0 7px">Lista de jogadas</h3>'+(moves.length?'<div class="edReplayMoves">'+moves.map((san,i)=>'<button data-move="'+(i+1)+'" class="'+(step===i+1?"active":"")+'">'+(i%2===0?Math.floor(i/2)+1+". ":"")+esc(san)+'</button>').join("")+'</div>':'<p class="edReplayInfo">Não existe sequência de jogadas disponível nesta partida.</p>')+'</div></div>';
 host.querySelector("[data-close]").onclick=close;
 host.querySelector("[data-start]").onclick=()=>navigate(0);
 host.querySelector("[data-prev]").onclick=()=>navigate(step-1);
 host.querySelector("[data-next]").onclick=()=>navigate(step+1);
 host.querySelector("[data-end]").onclick=()=>navigate(moves.length);
 host.querySelectorAll("[data-move]").forEach(b=>b.onclick=()=>navigate(Number(b.dataset.move)));
}
async function openByCode(rawCode){
 const code=String(rawCode||"").toUpperCase();
 if(!/^[0-9A-F]{8}$/.test(code)||!api()||!viewer())return;
 const {data:r,error}=await api().from("chess_rooms")
  .select("id,code,white_id,black_id,status,updated_at,base_ms,increment_ms,finish_reason,ply")
  .eq("code",code).maybeSingle();
 if(error||!r)return;
 if(!["white_win","black_win","draw"].includes(r.status))return;
 const color=r.white_id===viewer().id?"white":r.black_id===viewer().id?"black":null;
 if(!color)return;
 const outcome=r.status==="draw"?"draw":r.status===(color==="white"?"white_win":"black_win")?"win":"loss";
 const g={id:r.id,key:r.id,code:r.code,color,outcome,game:"Xadrez",isChess:true,
  when:r.updated_at,date:r.updated_at,base_ms:r.base_ms,increment_ms:r.increment_ms,
  reason:r.finish_reason,xp:0,opponent_name:"Adversário"};
 await open(g);
}
window.EDGY_history={mount,openByCode};
})();