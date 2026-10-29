(function(){
"use strict";
let Chess=null,room=null,players=null,channel=null,poller=null,selected="",promo=null,busy=false,pending="",engineError="";
const glyph={wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟︎"};
const x=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const auth=()=>window.EDGY_auth;
const db=()=>auth()?.getClient();
const user=()=>auth()?.getUser();
const notice=s=>{const el=document.getElementById("chess-info");if(el)el.textContent=s};
const css=document.createElement("style");
css.textContent='.chessWrap{max-width:720px;margin:auto}.chessBoard{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));width:100%;max-width:520px;margin:15px auto;border:3px solid #674674;border-radius:9px;overflow:hidden}.chessSq{aspect-ratio:1;min-width:0;padding:0;border:0;display:grid;place-items:center;position:relative;border-radius:0}.chessSq.light{background:#e0d2e8}.chessSq.dark{background:#69537d}.chessSq.active{box-shadow:inset 0 0 0 4px #ff0878}.chessSq.legal:after{content:"";position:absolute;background:#ff168b88;width:23%;height:23%;border-radius:50%;pointer-events:none}.chessGlyph{font-family:"Segoe UI Symbol","DejaVu Sans",serif;font-size:clamp(22px,7vw,47px);line-height:1;pointer-events:none}.chessGlyph.w{color:#fffdf6;text-shadow:1px 2px #241728,-1px -1px #241728}.chessGlyph.b{color:#23142f;text-shadow:1px 1px #e6d9f2}.chessRank{position:absolute;left:3px;top:2px;font-size:9px;pointer-events:none;color:#322044}.chessSq.dark .chessRank{color:#f0deee}.chessPlayers{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin:15px 0}.chessPlayer{background:#27203f;padding:13px;border-radius:12px;border:1px solid #57416b}.chessPlayer strong{display:block}.chessPlayer small{font-size:12px;color:#b6a7c5}.chessBtn{background:linear-gradient(115deg,#ff075c,#c300a7);color:#fff;border:0;border-radius:12px;padding:12px 16px;font-weight:800;min-height:44px}.chessInput{background:#151027;color:#fff;border:1px solid #655078;border-radius:11px;padding:13px;width:100%;font-weight:800;letter-spacing:2px;text-transform:uppercase}.chessRow{display:flex;gap:9px;flex-wrap:wrap;margin:15px 0}.chessRow>*{flex:1}.chessStatus{padding:13px;border-radius:12px;background:#292041;border:1px solid #563e66;color:#dfd2ed;line-height:1.5}.chessMoves{font-size:13px;line-height:1.8;color:#c8b6d9;max-height:120px;overflow:auto}.chessPromotion{display:flex;gap:8px;justify-content:center;padding:12px}.chessPromotion button{font-size:30px;border:1px solid #ab4d8f;border-radius:10px;background:#322246;color:#fff;padding:8px 12px}';
document.head.appendChild(css);
function clear(){if(channel){db()?.removeChannel(channel);channel=null}if(poller){clearInterval(poller);poller=null}room=null;players=null;selected="";promo=null}
function close(){clear();const u=new URL(location.href);u.searchParams.delete("room");history.replaceState(null,"",u.pathname+u.search+u.hash)}
function open(code){clear();pending=String(code||"").toUpperCase();draw();if(pending&&user())join(pending)}
function engine(){if(!Chess)return null;const c=new Chess();if(room?.pgn)c.loadPgn(room.pgn);return c}
function uri(){const u=new URL(location.href);u.searchParams.set("room",room.code);return u.href}
function setUri(){history.replaceState(null,"",uri())}
async function create(){
 if(!user()){auth()?.showEntry();return}
 if(busy)return;busy=true;notice("A criar sala...");
 const {data,error}=await db().rpc("edgy_create_chess_room");
 busy=false;if(error){notice(error.message);return}await load(data);
}
async function join(code){
 pending=code=String(code||"").trim().toUpperCase();
 if(!user()){draw();return}
 if(!/^[0-9A-F]{8}$/.test(code)){notice("O código deve ter 8 caracteres.");return}
 if(busy)return;busy=true;notice("A entrar...");
 const {data,error}=await db().rpc("edgy_join_chess_room",{p_code:code});
 busy=false;if(error){notice(error.message);return}await load(data);
}
async function load(code){
 const {data,error}=await db().from("chess_rooms").select("*").eq("code",code).maybeSingle();
 if(error||!data){notice(error?.message||"Sala indisponível");return}
 room=data;selected="";promo=null;setUri();await fetchPlayers();listen();draw();
}
async function fetchPlayers(){if(!room)return;const {data}=await db().rpc("edgy_chess_players",{p_code:room.code});if(data)players=data}
function listen(){
 if(channel)db().removeChannel(channel);
 if(poller)clearInterval(poller);
 const id=room.id;
 channel=db().channel("edgy-chess-"+id).on("postgres_changes",{event:"UPDATE",schema:"public",table:"chess_rooms",filter:"id=eq."+id},()=>refresh()).subscribe();
 poller=setInterval(()=>{if(room&&game==="chess")refresh()},4000);
}
async function refresh(){
 if(!room||busy)return;
 const prev=room,{data}=await db().from("chess_rooms").select("*").eq("id",prev.id).maybeSingle();
 if(!data)return;
 if(data.ply!==prev.ply||data.status!==prev.status||data.black_id!==prev.black_id){
  room=data;selected="";promo=null;await fetchPlayers();draw();
 }
}
function status(){
 if(room.status==="waiting")return "À espera do adversário. Partilha o convite.";
 if(room.status==="draw")return "Partida terminada: empate.";
 if(room.status==="white_win")return "Xeque-mate. Vitória das brancas.";
 if(room.status==="black_win")return "Xeque-mate. Vitória das pretas.";
 const mine=user()?.id===room.white_id?"w":"b";
 return (room.turn==="w"?"Jogam as brancas":"Jogam as pretas")+(mine===room.turn?" · É a tua vez":" · Aguarda o adversário")+(engine()?.isCheck()?" · Xeque":"");
}
function board(){
 const c=engine();if(!c)return "";
 const b=c.board(),mine=user()?.id===room.black_id?"b":"w";
 const rows=mine==="b"?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7],cols=mine==="b"?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];
 const moves=selected?c.moves({square:selected,verbose:true}).map(m=>m.to):[];
 let out='<div class="chessBoard" aria-label="Tabuleiro">';
 for(const row of rows)for(const col of cols){
  const sq="abcdefgh"[col]+(8-row),p=b[row][col];
  out+='<button class="chessSq '+((row+col)%2?"dark":"light")+(sq===selected?" active":"")+(moves.includes(sq)?" legal":"")+'" data-sq="'+sq+'" aria-label="'+sq+'">'+(col===cols[0]?'<span class="chessRank">'+(8-row)+'</span>':"")+(p?'<span class="chessGlyph '+p.color+'">'+glyph[p.color+p.type]+'</span>':"")+'</button>';
 }
 return out+'</div>';
}
function draw(){
 const root=document.getElementById("screen");if(!root||game!=="chess")return;
 if(!Chess){root.innerHTML='<div class="chessWrap"><button class="back" data-back>← Jogos</button><h1>Xadrez online</h1><div class="panel">'+x(engineError||"A carregar as regras...")+'</div></div>';root.querySelector("[data-back]").onclick=()=>nav("games");return}
 if(!user()){root.innerHTML='<div class="chessWrap"><button class="back" data-back>← Jogos</button><h1>Xadrez online</h1><div class="panel"><p>Entra como convidado ou cria uma conta para jogar online.</p><button class="chessBtn" data-auth>Entrar</button></div></div>';root.querySelector("[data-back]").onclick=()=>nav("games");root.querySelector("[data-auth]").onclick=()=>auth()?.showEntry();return}
 if(!room){
  root.innerHTML='<div class="chessWrap"><button class="back" data-back>← Jogos</button><h1>♞ Xadrez online</h1><p class="sub">Cria uma sala para dois jogadores ou entra com um código. Cada jogador usa a sua sessão.</p><div class="chessRow"><div class="panel"><h3>Nova partida</h3><p class="sub">Jogas com as brancas.</p><button class="chessBtn" data-create>Criar sala</button></div><div class="panel"><h3>Entrar em sala</h3><input class="chessInput" id="chessCode" maxlength="8" placeholder="Código" value="'+x(pending)+'"><button class="secondary" style="margin-top:10px" data-join>Entrar na partida</button></div></div><div class="result" id="chess-info"></div></div>';
  root.querySelector("[data-back]").onclick=()=>nav("games");
  root.querySelector("[data-create]").onclick=create;root.querySelector("[data-join]").onclick=()=>join(root.querySelector("#chessCode").value);
  return;
 }
 const w=players?.white,b=players?.black,historyMoves=engine()?.history()||[];
 root.innerHTML='<div class="chessWrap"><button class="back" data-back>← Jogos</button><div class="row space"><h1>♞ Xadrez</h1><span class="pill">'+x(room.code)+'</span></div><div class="chessPlayers"><div class="chessPlayer"><strong>♙ '+x(w?.name||"Brancas")+'</strong><small>@'+x(w?.username||"—")+'</small></div><div class="chessPlayer"><strong>♟ '+x(b?.name||"À espera de jogador")+'</strong><small>'+x(b?.username?"@"+b.username:"Envia o convite")+'</small></div></div><div class="chessStatus">'+x(status())+'</div>'+board()+(promo?'<div class="chessStatus" style="text-align:center">Escolhe a promoção:<div class="chessPromotion">'+["q","r","b","n"].map(p=>'<button data-promotion="'+p+'">'+glyph[room.turn+p]+'</button>').join("")+'</div><button class="secondary" data-cancel>Cancelar</button></div>':"")+'<div class="chessRow"><button class="chessBtn" data-copy>Copiar convite</button><button class="secondary" data-refresh>Atualizar</button></div><div class="result" id="chess-info"></div><section class="section panel"><h3>Jogadas</h3><div class="chessMoves">'+(historyMoves.length?historyMoves.map((m,i)=>(i%2===0?(i/2+1)+". ":"")+x(m)).join(" "):"Nenhuma jogada ainda.")+'</div></section></div>';
 root.querySelector("[data-back]").onclick=()=>nav("games");
 root.querySelector("[data-copy]").onclick=async()=>{try{await navigator.clipboard.writeText(uri());notice("Convite copiado!")}catch{notice("Partilha: "+uri())}};
 root.querySelector("[data-refresh]").onclick=refresh;
 root.querySelectorAll("[data-sq]").forEach(b=>b.onclick=()=>select(b.dataset.sq));
 root.querySelectorAll("[data-promotion]").forEach(b=>b.onclick=()=>{const m=promo;promo=null;send(m.from,m.to,b.dataset.promotion)});
 root.querySelector("[data-cancel]")?.addEventListener("click",()=>{promo=null;draw()});
}
function select(sq){
 if(!room||room.status!=="active"||busy||promo)return;
 const myColor=user()?.id===room.white_id?"w":user()?.id===room.black_id?"b":null;
 if(!myColor||myColor!==room.turn)return;
 const c=engine(),p=c.get(sq);
 if(selected){
  const hits=c.moves({square:selected,verbose:true}).filter(m=>m.to===sq);
  if(hits.length){if(hits.some(m=>m.promotion)){promo={from:selected,to:sq};draw();return}send(selected,sq);return}
 }
 selected=p?.color===myColor?sq:"";draw();
}
async function send(from,to,promotion){
 if(busy||!room)return;busy=true;selected="";draw();notice("A guardar jogada...");
 const {data,error}=await db().functions.invoke("chess-move",{body:{code:room.code,from,to,...(promotion?{promotion}:{})}});
 busy=false;
 if(error||data?.error){notice(data?.error||error?.message||"Erro na jogada");await refresh();return}
 await refresh();
}
window.EDGY_chess={open,close,render:draw};
const incoming=new URLSearchParams(location.search).get("room");
if(incoming&&/^[0-9a-f]{8}$/i.test(incoming)){game="chess";open(incoming)}
import("https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js").then(m=>{Chess=m.Chess;draw()}).catch(e=>{console.error("chess engine",e);engineError="Não foi possível carregar o motor de xadrez. Atualiza a página.";draw()});
})();