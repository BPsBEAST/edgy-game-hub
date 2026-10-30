/* Original EDGY chess piece SVG set and shared PGN replay renderer. */
(function(){
"use strict";
const paths={"p":"<circle cx=\"24\" cy=\"15\" r=\"6.5\"/><path d=\"M18 23c-1 4-5 7-5 12h22c0-5-4-8-5-12z\"/><path d=\"M12 38h24v3H12z\"/>","r":"<path d=\"M12 10h5v5h5v-5h4v5h5v-5h5v11H12z\"/><path d=\"M16 21h16l2 14H14z\"/><path d=\"M12 38h24v3H12z\"/>","n":"<path d=\"M12 38h24v3H12z\"/><path d=\"M14 35c1-8 1-14 5-18l-1-7 10-4 1 7 7 4-1 5-7-1-4 6 8 8z\"/><circle cx=\"27\" cy=\"16\" r=\"1.9\" class=\"edgyPieceEye\"/>","b":"<path d=\"M12 38h24v3H12z\"/><path d=\"M17 35h14l2-4H15z\"/><path d=\"M24 8c-5 6-10 13-10 19 0 4 5 5 10 5s10-1 10-5c0-6-5-13-10-19z\"/><path d=\"M28 14 19 26\" class=\"edgyPieceDetail\"/>","q":"<path d=\"M12 38h24v3H12z\"/><path d=\"M15 34h18l4-18-9 9-4-13-4 13-9-9z\"/><circle cx=\"11\" cy=\"13\" r=\"3\"/><circle cx=\"24\" cy=\"10\" r=\"3\"/><circle cx=\"37\" cy=\"13\" r=\"3\"/>","k":"<path d=\"M24 7v13m-6-7h12\" class=\"edgyPieceDetail\"/><path d=\"M18 21c-3 2-6 6-6 10l4 4h16l4-4c0-4-3-8-6-10z\"/><path d=\"M12 38h24v3H12z\"/>"};
function svg(type,color){
 if(!paths[type]||!["w","b"].includes(color))return "";
 return '<svg class="chessGlyph edgyPiece '+(color==="w"?"edgyPieceWhite":"edgyPieceBlack")+'" viewBox="0 0 48 48" width="78%" height="78%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><g class="edgyPieceShapes" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1">'+paths[type]+'</g></svg>';
}
function fenBoard(fen,flip=false){
 const ranks=String(fen||"").split(" ")[0].split("/");
 if(ranks.length!==8)return '<p>Posição indisponível</p>';
 const matrix=[];
 for(const rank of ranks){
  const row=[];for(const char of rank){
   if(/^[1-8]$/.test(char)){for(let k=0;k<Number(char);k++)row.push(null)}
   else if(/^[pnbrqkPNBRQK]$/.test(char))row.push({type:char.toLowerCase(),color:char===char.toUpperCase()?"w":"b"});
   else return '<p>Posição indisponível</p>';
  }
  if(row.length!==8)return '<p>Posição indisponível</p>';matrix.push(row);
 }
 const rows=flip?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7],cols=flip?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];
 let html='<div class="edgyReplayBoard" role="img" aria-label="Tabuleiro de xadrez da partida">';
 for(let ri=0;ri<8;ri++)for(let ci=0;ci<8;ci++){
  const r=rows[ri],c=cols[ci],piece=matrix[r][c];
  html+='<div class="edgyReplaySquare '+((r+c)%2?"dark":"light")+'">'+(ci===0?'<span class="edgyRank">'+(8-r)+'</span>':"")+(ri===7?'<span class="edgyFile">'+"abcdefgh"[c]+'</span>':"")+(piece?svg(piece.type,piece.color):"")+'</div>';
 }
 return html+"</div>";
}
const style=document.createElement("style");
style.textContent=".edgyPiece{display:block;width:79%;height:79%;max-height:100%;overflow:visible;pointer-events:none;filter:drop-shadow(0 1px 1px #150f2966);flex-shrink:0}.edgyPieceWhite{--edgy-piece-fill:#fff7e9;--edgy-piece-stroke:#52395f;--edgy-piece-detail:#80628a}.edgyPieceBlack{--edgy-piece-fill:#30203d;--edgy-piece-stroke:#ebd9ed;--edgy-piece-detail:#a98db7}.edgyPieceShapes{fill:var(--edgy-piece-fill);stroke:var(--edgy-piece-stroke)}.edgyPieceShapes .edgyPieceDetail{fill:none;stroke:var(--edgy-piece-detail);stroke-width:2.5}.edgyPieceShapes .edgyPieceEye{fill:var(--edgy-piece-detail);stroke:none}.chessSq .chessGlyph.edgyPiece{width:78%;height:78%;font-size:initial;filter:drop-shadow(0 2px 1px #170c254d)}.chessSq.chessLast{box-shadow:inset 0 0 0 3px #f0a2dc80}.chessSq.chessCheck{background:#d7748d!important;box-shadow:inset 0 0 0 3px #f52278,inset 0 0 16px #a81b62}.chessSq.active{box-shadow:inset 0 0 0 3px #ff2f98,inset 0 0 12px #d80c847a!important}.chessSq.legal:after{width:23%;height:23%;background:#ce378a9e;box-shadow:0 0 0 4px #d22f7b10}.chessSq.legal.occupied:after{width:84%;height:84%;background:transparent;border:3px solid #f63f9a;box-shadow:none}.chessSq.light,.edgyReplaySquare.light{background:#e5daeb}.chessSq.dark,.edgyReplaySquare.dark{background:#766083}.chessSq:hover{filter:brightness(1.045)}.chessRank,.edgyRank{font-size:10px;top:3px;left:4px;font-weight:700;color:#44304f;letter-spacing:0}.chessSq.dark .chessRank,.edgyReplaySquare.dark .edgyRank{color:#f3e3f2}.edgyFile{position:absolute;bottom:2px;right:4px;font-size:10px;font-weight:750;color:#44304f;pointer-events:none}.chessSq.dark .edgyFile,.edgyReplaySquare.dark .edgyFile{color:#f3e3f2}.edgyReplayBoard{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));width:min(100%,380px);aspect-ratio:1;overflow:hidden;border-radius:12px;border:2px solid #73557d;margin:0 auto}.edgyReplaySquare{display:grid;place-items:center;position:relative;min-width:0;aspect-ratio:1}.edgyReplaySquare .edgyPiece{width:82%;height:82%}@media(prefers-reduced-motion:reduce){.chessSq:hover{filter:none}}";
document.head.append(style);
window.EDGY_pieces={svg,fenBoard};
})();