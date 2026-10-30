/* EDGY Damas - 8x8 flying kings and mandatory capture; the player chooses any complete capture sequence */
const dirs=[[1,1],[1,-1],[-1,1],[-1,-1]],ok=(r,c)=>r>=0&&r<8&&c>=0&&c<8,idx=(r,c)=>r*8+c;
const side=p=>p?.toLowerCase()==="w"?"w":p?.toLowerCase()==="b"?"b":null;
const own=(p,t)=>side(p)===t,foe=(p,t)=>side(p)&&side(p)!==t;
export function initialState(){
 const board=Array(64).fill(null);
 for(let r=0;r<3;r++)for(let c=0;c<8;c++)if((r+c)%2)board[idx(r,c)]="b";
 for(let r=5;r<8;r++)for(let c=0;c<8;c++)if((r+c)%2)board[idx(r,c)]="w";
 return {board,turn:"w",ply:0,status:"active",last:[],history:[],quiet:0};
}
function captures(board,position,turn){
 const p=board[position],r=Math.floor(position/8),c=position%8,king=p===p?.toUpperCase(),opts=[];
 if(!p)return opts;
 for(const [dr,dc] of dirs){
  if(!king){
   // EDGY: ordinary pieces capture forward only. Kings remain bidirectional.
   if(turn==="w"?dr!==-1:dr!==1)continue;
   const a=r+dr,b=c+dc,n=r+2*dr,m=c+2*dc;
   if(ok(n,m)&&foe(board[idx(a,b)],turn)&&board[idx(n,m)]===null)opts.push({to:idx(n,m),capture:idx(a,b)});
  }else{
   let a=r+dr,b=c+dc,hit=-1;
   while(ok(a,b)){
    const k=idx(a,b),v=board[k];
    if(v===null){if(hit>=0)opts.push({to:k,capture:hit})}
    else if(v==="x"||own(v,turn))break;
    else if(foe(v,turn)){if(hit>=0)break;hit=k}
    a+=dr;b+=dc;
   }
  }
 }
 return opts;
}
function sequences(board,pos,turn,path,taken,depth=0){
 if(depth>=12)return [{path,captures:taken}];
 const options=captures(board,pos,turn);
 if(!options.length)return taken.length?[{path,captures:taken}]:[];
 const all=[];
 for(const o of options){const next=board.slice();next[o.to]=next[pos];next[pos]=null;next[o.capture]="x";
  all.push(...sequences(next,o.to,turn,[...path,o.to],[...taken,o.capture],depth+1))}
 return all;
}
export function legalMoves(state){
 if(!state||state.status!=="active"||!Array.isArray(state.board)||state.board.length!==64)return [];
 const board=state.board,turn=state.turn,all=[];
 for(let p=0;p<64;p++)if(own(board[p],turn))all.push(...sequences(board,p,turn,[p],[]));
 if(all.length)return all; // Capture is mandatory, but no particular piece or path is forced.
 for(let p=0;p<64;p++){
  const piece=board[p];if(!own(piece,turn))continue;
  const r=Math.floor(p/8),c=p%8,king=piece===piece.toUpperCase();
  for(const [dr,dc] of dirs){
   if(!king&&(turn==="w"?dr!==-1:dr!==1))continue;
   let a=r+dr,b=c+dc;
   while(ok(a,b)&&board[idx(a,b)]===null){
    all.push({path:[p,idx(a,b)],captures:[]});if(!king)break;a+=dr;b+=dc;
   }
  }
 }
 return all;
}
export function preview(state,path){
 const board=state.board.slice();if(!board[path[0]])return board;
 let pos=path[0];
 for(let n=1;n<path.length;n++){
  const target=path[n],dr=Math.sign(Math.floor(target/8)-Math.floor(pos/8)),dc=Math.sign(target%8-pos%8);
  let r=Math.floor(pos/8)+dr,c=pos%8+dc;
  while(idx(r,c)!==target){let k=idx(r,c);if(board[k]&&board[k]!=="x")board[k]="x";r+=dr;c+=dc}
  board[target]=board[pos];board[pos]=null;pos=target;
 }
 return board.map(v=>v==="x"?null:v);
}
export function applyMove(state,path){
 const opt=legalMoves(state).find(m=>m.path.length===path.length&&m.path.every((p,i)=>p===path[i]));
 if(!opt)throw Error("Jogada ilegal ou captura incompleta");
 const board=state.board.slice(),from=opt.path[0],to=opt.path.at(-1),piece=board[from];
 board[from]=null;for(const p of opt.captures)board[p]=null;
 const promoted=(piece==="w"&&Math.floor(to/8)===0)||(piece==="b"&&Math.floor(to/8)===7);
 board[to]=promoted?piece.toUpperCase():piece;
 const next={board,turn:state.turn==="w"?"b":"w",ply:state.ply+1,status:"active",last:opt.path.slice(),history:[...(state.history||[]),{path:opt.path.slice(),captures:opt.captures.length,promoted}],quiet:(opt.captures.length||piece===piece.toLowerCase())?0:(state.quiet||0)+1};
 if(!board.some(p=>side(p)===next.turn)||!legalMoves(next).length)next.status=state.turn==="w"?"white_win":"black_win";
 else if(next.quiet>=80)next.status="draw";
 return next;
}
export function countPieces(state){const o={w:0,b:0,wk:0,bk:0};for(const p of state.board)if(p&&p!=="x"){o[p.toLowerCase()]++;if(p===p.toUpperCase())o[p.toLowerCase()+"k"]++}return o}
