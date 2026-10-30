/* EDGY simplified chess silhouettes (same style as title knight) */
(function(){
"use strict";
const pieces={p:"♟",r:"♜",n:"♞",b:"♝",q:"♛",k:"♚"};
function svg(type,color){
 if(!Object.prototype.hasOwnProperty.call(pieces,type)||!["w","b"].includes(color))return "";
 return '<span class="chessGlyph edgyPiece '+(color==="w"?"edgyPieceWhite":"edgyPieceBlack")+'" aria-hidden="true">'+pieces[type]+'</span>';
}
function fenBoard(fen,flip=false){
 const ranks=String(fen||"").split(" ")[0].split("/");
 if(ranks.length!==8)return '<p>Posição indisponível</p>';
 const board=[];
 for(const rank of ranks){
  const row=[];
  for(const c of rank){
   if(/^[1-8]$/.test(c)){for(let j=0;j<Number(c);j++)row.push(null)}
   else if(/^[pnbrqkPNBRQK]$/.test(c))row.push({type:c.toLowerCase(),color:c===c.toUpperCase()?"w":"b"});
   else return '<p>Posição indisponível</p>';
  }
  if(row.length!==8)return '<p>Posição indisponível</p>';
  board.push(row);
 }
 const order=flip?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];
 let html='<div class="edgyReplayBoard" role="img" aria-label="Tabuleiro da partida">';
 for(let i=0;i<8;i++)for(let j=0;j<8;j++){
  const r=order[i],c=order[j],p=board[r][c];
  html+='<div class="edgyReplaySquare '+((r+c)%2?"dark":"light")+'">'+(j===0?'<span class="edgyRank">'+(8-r)+'</span>':"")+(i===7?'<span class="edgyFile">'+"abcdefgh"[c]+'</span>':"")+(p?svg(p.type,p.color):"")+'</div>';
 }
 return html+'</div>';
}
const style=document.createElement("style");
style.textContent="\n:root{--board-light:#ded5e5;--board-dark:#766187;--board-accent:#f42c91}\n.chessSq.light,.edgyReplaySquare.light{background:var(--board-light)}\n.chessSq.dark,.edgyReplaySquare.dark{background:var(--board-dark)}\n.edgyPiece,.chessSq .chessGlyph.edgyPiece{display:flex;align-items:center;justify-content:center;flex:0 0 auto;width:83%;height:83%;max-width:100%;max-height:100%;font:400 clamp(22px,5.4vw,48px)/1 \"Segoe UI Symbol\",\"DejaVu Sans\",serif;white-space:nowrap;pointer-events:none;user-select:none;filter:none;transform:none;overflow:hidden}\n.edgyPieceWhite{color:#faf4ff;-webkit-text-stroke:1px #43334e;text-shadow:0 1px #34263d}\n.edgyPieceBlack{color:#302639;-webkit-text-stroke:.7px #2c2133;text-shadow:0 1px #f2e6f355}\n.chessSq{overflow:hidden;line-height:0}\n.chessSq.chessLast{box-shadow:inset 0 0 0 2px #f8b7d580}\n.chessSq.active{box-shadow:inset 0 0 0 3px var(--board-accent)!important}\n.chessSq.chessCheck{background:#cc8aab!important;box-shadow:inset 0 0 0 3px var(--board-accent)}\n.chessSq.legal:after{width:20%;height:20%;background:#da388a9e;box-shadow:none}\n.chessSq.legal.occupied:after{width:86%;height:86%;background:transparent;border:3px solid #ef4b9b}\n.chessRank,.edgyRank,.edgyFile{position:absolute;z-index:1;pointer-events:none;font-size:10px;font-weight:700;line-height:1;letter-spacing:0}\n.chessRank,.edgyRank{top:4px;left:4px}\n.edgyFile{bottom:3px;right:4px}\n.chessSq.light .chessRank,.edgyReplaySquare.light .edgyRank,.chessSq.light .edgyFile,.edgyReplaySquare.light .edgyFile{color:#574665}\n.chessSq.dark .chessRank,.edgyReplaySquare.dark .edgyRank,.chessSq.dark .edgyFile,.edgyReplaySquare.dark .edgyFile{color:#f8eafa}\n.edgyReplayBoard{display:grid!important;grid-template-columns:repeat(8,minmax(0,1fr))!important;grid-template-rows:repeat(8,minmax(0,1fr))!important;gap:0!important;line-height:0;width:min(100%,380px);aspect-ratio:1/1;overflow:hidden;border:2px solid #574263;border-radius:10px;margin:0 auto;isolation:isolate}\n.edgyReplaySquare{display:flex;align-items:center;justify-content:center;position:relative;min-width:0;min-height:0;width:100%;height:100%;aspect-ratio:auto;overflow:hidden;border:0;padding:0;line-height:0}\n.edgyReplaySquare .edgyPiece{font-size:clamp(18px,3.6vw,41px);width:84%;height:84%}\n.chessMaterial .edgyPiece{font-size:15px!important;width:17px!important;height:17px!important;overflow:visible}\n@media(max-width:520px){.edgyReplaySquare .edgyPiece{font-size:clamp(20px,7vw,39px)}}\n";
document.head.append(style);
window.EDGY_pieces={svg,fenBoard};
})();