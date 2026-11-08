/* EDGY 2048 rules — independent, testable implementation of the classic 4×4 puzzle. */
(function(){
"use strict";
const SIZE=4;
const clone=b=>b.map(x=>x);
function mergeLine(line){
 const values=line.filter(Boolean),out=[],merged=[];
 let gained=0;
 for(let i=0;i<values.length;i++){
  if(values[i]===values[i+1]){
   const value=values[i]*2;out.push(value);merged.push(out.length-1);gained+=value;i++;
  }else out.push(values[i]);
 }
 while(out.length<SIZE)out.push(0);
 return {line:out,score:gained,merged};
}
function move(board,direction){
 if(!Array.isArray(board)||board.length!==16||!["up","down","left","right"].includes(direction))throw Error("Jogada inválida");
 const next=clone(board);let score=0;const merged=[];
 const reverse=direction==="down"||direction==="right";
 for(let axis=0;axis<SIZE;axis++){
  const positions=Array.from({length:SIZE},(_,i)=>
   direction==="left"||direction==="right"?axis*SIZE+i:i*SIZE+axis);
  if(reverse)positions.reverse();
  const part=mergeLine(positions.map(pos=>board[pos]));
  part.line.forEach((v,i)=>next[positions[i]]=v);
  part.merged.forEach(i=>merged.push(positions[i]));
  score+=part.score;
 }
 return {board:next,score,merged,changed:next.some((v,i)=>v!==board[i])};
}
function validMoves(board){
 if(board.includes(0))return true;
 for(let i=0;i<16;i++){
  if(i%4<3&&board[i]===board[i+1])return true;
  if(i<12&&board[i]===board[i+4])return true;
 }
 return false;
}
function uniform(max){
 if(globalThis.crypto?.getRandomValues){
  const values=new Uint32Array(1),limit=2**32-(2**32%max);
  do{globalThis.crypto.getRandomValues(values)}while(values[0]>=limit);
  return values[0]%max;
 }
 return Math.floor(Math.random()*max);
}
function spawn(board){
 const empty=board.reduce((acc,value,i)=>{if(!value)acc.push(i);return acc},[]);
 if(!empty.length)return clone(board);
 const next=clone(board);
 next[empty[uniform(empty.length)]]=uniform(10)===0?4:2;
 return next;
}
function start(){return spawn(spawn(Array(16).fill(0)))}
window.EDGY_2048Rules=Object.freeze({SIZE,mergeLine,move,validMoves,spawn,start});
})();