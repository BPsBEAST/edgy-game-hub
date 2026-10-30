/* EDGY Palavra Oculta — pure rules and rotation, independent of the UI. */
(function(){
"use strict";
const SIZE=5,TRIES=6;
function score(guess,answer){
 const g=String(guess).toUpperCase(),a=String(answer).toUpperCase();
 if(!/^[A-Z]{5}$/.test(g)||!/^[A-Z]{5}$/.test(a))throw Error("São necessárias cinco letras");
 const result=Array(5).fill("absent"),remaining=Object.create(null);
 for(let i=0;i<5;i++){
  if(g[i]===a[i])result[i]="correct";
  else remaining[a[i]]=(remaining[a[i]]||0)+1;
 }
 for(let i=0;i<5;i++){
  if(result[i]==="correct")continue;
  if(remaining[g[i]]>0){result[i]="present";remaining[g[i]]--}
 }
 return result;
}
function keyboard(guesses,answer){
 const result=Object.create(null),rank={absent:1,present:2,correct:3};
 for(const guess of guesses){
  score(guess,answer).forEach((state,i)=>{
   const letter=guess[i];
   if(!result[letter]||rank[state]>rank[result[letter]])result[letter]=state;
  });
 }
 return result;
}
function freshBag(length,random=Math.random,previous=-1){
 const count=Number(length);
 if(!Number.isInteger(count)||count<1||count>100000)throw Error("Lista de respostas inválida");
 const bag=Array.from({length:count},(_,i)=>i);
 for(let i=bag.length-1;i>0;i--){
  const rand=Number(random());
  const j=Math.min(i,Math.floor(Math.max(0,Number.isFinite(rand)?rand:0)* (i+1)));
  [bag[i],bag[j]]=[bag[j],bag[i]];
 }
 // We pop answers from the end; never repeat across shuffle boundaries.
 if(count>1&&bag.at(-1)===previous){
  [bag[0],bag[bag.length-1]]=[bag[bag.length-1],bag[0]];
 }
 return bag;
}
function choose(bag,length,previous=-1,random=Math.random){
 const valid=Array.isArray(bag)&&bag.length>0&&bag.length<=length&&bag.every(n=>Number.isInteger(n)&&n>=0&&n<length)&&new Set(bag).size===bag.length;
 const next=valid?[...bag]:freshBag(length,random,previous);
 const index=next.pop();
 return {index,remaining:next};
}
window.EDGY_wordRules=Object.freeze({SIZE,TRIES,score,keyboard,freshBag,choose});
})();
