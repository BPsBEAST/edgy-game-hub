/* EDGY Contexto: local, deterministic thematic similarity (not an embedding AI).
   Ranks are positions in the game's own Portuguese vocabulary. */
(function(){
"use strict";
const bank=()=>window.EDGY_contextoData;
const norm=w=>window.EDGY_seenWords?.normalize(w)||String(w||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z]/g,"");
const groups=new Map();
function setup(){
 if(groups.size)return;
 bank().groups.forEach((terms,i)=>{for(const word of terms){
  if(!groups.has(word))groups.set(word,[]);
  groups.get(word).push(i);
 }});
}
const hash=(a,b)=>{
 let h=2166136261;
 for(const ch of a+"|"+b){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
 return (h>>>0)/4294967295;
};
function groupCloseness(i,j){
 if(i===j)return 1;
 const a=bank().groups[i],b=bank().groups[j],other=new Set(b);
 let common=0;for(const w of a)if(other.has(w))common++;
 return common/Math.max(2,Math.min(a.length,b.length));
}
function score(secret,guess){
 const answer=norm(secret),word=norm(guess);
 if(answer===word)return 1000000;
 setup();
 const a=groups.get(answer)||[],b=groups.get(word)||[];
 let direct=0,near=0;
 for(const i of a)for(const j of b){
  if(i===j)direct+=1;
  else near=Math.max(near,groupCloseness(i,j));
 }
 if(direct)return 5000+direct*200+near*200+hash(answer,word);
 if(near>0)return 500+near*1800+hash(answer,word);
 // Unknown dictionary entries are valid guesses, but have no authored thematic tag.
 return hash(answer,word)*.9;
}
let cachedAnswer="",ranks=new Map(),ordered=[];
function prepare(secret){
 const answer=norm(secret);
 if(answer===cachedAnswer&&ranks.size)return;
 const words=new Set([...(bank()?.terms||[]),...(window.EDGY_wordBank?.answers||[]),
  ...(window.EDGY_wordBank?.guessCount?window.EDGY_wordBank?.guesses||[]:[]),answer]);
 // The original 5-letter guesses list is exposed through wordBank.isWord,
 // but not necessarily through wordBank.guesses. The curated vocabulary alone
 // supplies all semantic ranks; other valid guesses receive a distant rank.
 ordered=[...words].sort((a,b)=>score(answer,b)-score(answer,a)||a.localeCompare(b,"pt"));
 ranks=new Map(ordered.map((w,i)=>[w,i+1]));
 cachedAnswer=answer;
}
function rank(secret,guess){
 const a=norm(secret),w=norm(guess);
 if(w===a)return 1;
 prepare(a);
 if(ranks.has(w))return ranks.get(w);
 return ordered.length+1+Math.floor(hash(a,w)*9000);
}
function isWord(word){
 const w=norm(word);
 return /^[a-z]{3,20}$/.test(w)&&(groups.has(w)||window.EDGY_wordBank?.isWord?.(w));
}
function hint(secret,guesses){
 prepare(secret);
 const used=new Set((guesses||[]).map(g=>norm(g.word||g)));
 return ordered.find(w=>w!==norm(secret)&&!used.has(w))||"";
}
function label(rank){
 if(rank===1)return "Encontraste!";
 if(rank<=15)return "Muito próximo";
 if(rank<=100)return "Próximo";
 if(rank<=500)return "Relacionado";
 if(rank<=1800)return "Aproximação";
 return "Distante";
}
window.EDGY_contextoRules=Object.freeze({normalize:norm,rank,isWord,hint,label,prepare,score,answerCount:()=>bank().answers.length});
})();