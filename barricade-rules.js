/* EDGY Barricade: deterministic classic 9x9 rules shared by browser and server.
   Original UI and engine; no assets or source taken from barricade.gg. */
export const SIZE=9,START_RED=76,START_BLUE=4;
export function initialState(){
 return {red_pos:START_RED,blue_pos:START_BLUE,red_walls:10,blue_walls:10,
  walls:[],turn:"r",ply:0,status:"active",moves:[]};
}
const inside=(r,c)=>r>=0&&r<9&&c>=0&&c<9;
const index=(r,c)=>r*9+c;
const rc=p=>[Math.floor(p/9),p%9];
const isWall=w=>w&&Number.isInteger(w.r)&&Number.isInteger(w.c)&&w.r>=0&&w.r<8&&w.c>=0&&w.c<8&&(w.o==="h"||w.o==="v");
/* A wall blocks two adjacent graph edges. */
export function blocked(walls,a,b){
 const [r,c]=rc(a),[rr,cc]=rc(b);
 if(Math.abs(r-rr)+Math.abs(c-cc)!==1)return true;
 return walls.some(w=>w.o==="h"?
  ((r===w.r&&rr===w.r+1)||(rr===w.r&&r===w.r+1))&&c>=w.c&&c<=w.c+1&&cc===c:
  ((c===w.c&&cc===w.c+1)||(cc===w.c&&c===w.c+1))&&r>=w.r&&r<=w.r+1&&rr===r);
}
function neighbors(walls,p){
 const [r,c]=rc(p),res=[];
 for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
  const rr=r+dr,cc=c+dc;if(inside(rr,cc)&&!blocked(walls,p,index(rr,cc)))res.push(index(rr,cc));
 }
 return res;
}
/* Ignore pawns for path existence: wall placement may never seal off a goal row. */
export function hasPath(walls,start,targetRow){
 const queue=[start],seen=new Set(queue);
 for(let i=0;i<queue.length;i++){
  const p=queue[i];if(Math.floor(p/9)===targetRow)return true;
  for(const next of neighbors(walls,p))if(!seen.has(next)){seen.add(next);queue.push(next)}
 }
 return false;
}
export function legalMoves(state){
 const me=state.turn==="r"?state.red_pos:state.blue_pos;
 const them=state.turn==="r"?state.blue_pos:state.red_pos;
 const walls=state.walls||[],out=[];
 for(const nearby of neighbors(walls,me)){
  if(nearby!==them){out.push(nearby);continue}
  const [r,c]=rc(me),[or,oc]=rc(them),dr=or-r,dc=oc-c;
  const rr=or+dr,cc=oc+dc;
  if(inside(rr,cc)&&!blocked(walls,them,index(rr,cc))){out.push(index(rr,cc));continue}
  const alternatives=dr!==0?[[0,-1],[0,1]]:[[-1,0],[1,0]];
  for(const [sr,sc] of alternatives){
   const sideR=or+sr,sideC=oc+sc;
   if(inside(sideR,sideC)&&!blocked(walls,them,index(sideR,sideC)))out.push(index(sideR,sideC));
  }
 }
 return out;
}
export function canPlaceWall(state,wall){
 if(!isWall(wall))return false;
 if((state.turn==="r"?state.red_walls:state.blue_walls)<=0)return false;
 const walls=state.walls||[];
 // Reject crossings and overlaps of either wall segment.
 for(const other of walls){
  if(other.r===wall.r&&other.c===wall.c&&other.o!==wall.o)return false;
  if(other.o===wall.o){
   if(wall.o==="h"&&other.r===wall.r&&Math.abs(other.c-wall.c)<2)return false;
   if(wall.o==="v"&&other.c===wall.c&&Math.abs(other.r-wall.r)<2)return false;
  }
 }
 const next=[...walls,wall];
 return hasPath(next,state.red_pos,0)&&hasPath(next,state.blue_pos,8);
}
export function applyAction(state,action){
 if(!state||state.status!=="active"||!["r","b"].includes(state.turn))throw Error("A partida não está ativa");
 if(!action||typeof action!=="object")throw Error("Ação inválida");
 const color=state.turn,next={...state,walls:[...(state.walls||[])],moves:[...(state.moves||[])]};
 let entry;
 if(action.type==="move"){
  if(!Number.isInteger(action.to)||!legalMoves(state).includes(action.to))throw Error("Movimento ilegal");
  const from=color==="r"?state.red_pos:state.blue_pos;
  if(color==="r")next.red_pos=action.to;else next.blue_pos=action.to;
  entry={type:"move",from,to:action.to,color};
  if((color==="r"&&Math.floor(action.to/9)===0)||(color==="b"&&Math.floor(action.to/9)===8))
   next.status=color==="r"?"white_win":"black_win";
 }else if(action.type==="wall"){
  const wall={r:action.r,c:action.c,o:action.o};
  if(!canPlaceWall(state,wall))throw Error("Barreira inválida: os dois jogadores precisam de um caminho livre");
  next.walls.push(wall);
  if(color==="r")next.red_walls--;else next.blue_walls--;
  entry={type:"wall",...wall,color};
 }else throw Error("Ação desconhecida");
 next.turn=color==="r"?"b":"r";next.ply=(state.ply||0)+1;next.moves.push({...entry,ply:next.ply});
 if(next.ply>=400&&next.status==="active")next.status="draw";
 return next;
}
