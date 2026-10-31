/* EDGY shared answer history (Wordle + Contexto).
 * Never reissue a consumed solution. Local guest storage, per-user storage and
 * RLS-protected Supabase claims for signed-in players across devices. */
(function(){
"use strict";
const KEY="edgy_seen_words_v1_",caches=new Map(),pending=new Map();
const user=()=>window.EDGY_auth?.getUser?.();
const client=()=>window.EDGY_auth?.getClient?.();
const scope=()=>user()?.id||"local";
const normalize=w=>String(w||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/ç/g,"c").replace(/[^a-z]/g,"");
function get(id=scope()){
 if(caches.has(id))return caches.get(id);
 let words=[];
 try{const data=JSON.parse(localStorage.getItem(KEY+id)||"[]");if(Array.isArray(data))words=data.filter(w=>/^[a-z]{3,32}$/.test(w))}catch{}
 const value={seen:new Set(words),loaded:false};
 // v55 incorrectly imported *all* 917 Wordle answers from an empty legacy
 // shuffle bag. Recover only when the local round count proves that this
 // collection could not have been legitimately completed. Existing individual
 // reservations remain protected by the server and are merged during ready().
 const answers=window.EDGY_wordBank?.answers||[];
 // The corrupted v55 import contains the original 917-word snapshot even
 // after new Wordle solutions have been appended to the dictionary.
 const original=answers.slice(0,917);
 if(original.length===917&&value.seen.size>=original.length-4){
  try{
   const record=JSON.parse(localStorage.getItem("edgy_wordle_v1"+(id==="local"?"":"_"+id))||"null");
   const number=Math.max(0,Number(record?.number)||0);
   const corpus=new Set(value.seen.size>=answers.length-4?answers:original);
   const overlap=original.reduce((count,w)=>count+(value.seen.has(w)?1:0),0);
   if(record&&number<Math.floor(original.length/4)&&overlap>=original.length-4){
    const keep=normalize(record.round?.answer);
    for(const word of corpus)if(word!==keep)value.seen.delete(word);
    try{localStorage.setItem(KEY+id,JSON.stringify([...value.seen]))}catch{}
   }
  }catch{}
 }
 caches.set(id,value);return value;
}
function persist(id){try{localStorage.setItem(KEY+id,JSON.stringify([...get(id).seen]))}catch{}}
function has(word){return get().seen.has(normalize(word))}
async function ready(){
 const id=scope(),state=get(id);
 if(state.loaded)return;
 if(pending.has(id))return pending.get(id);
 const task=(async()=>{
  const db=client(),uid=user()?.id;
  if(!uid||!db){state.loaded=true;return}
  try{
   const remote=new Set();
   for(let offset=0;offset<10000;offset+=800){
    const {data,error}=await db.from("edgy_seen_words").select("word").eq("user_id",uid).range(offset,offset+799);
    if(error)throw error;
    for(const item of data||[])remote.add(item.word);
    if(!data||data.length<800)break;
   }
   const localOnly=[...state.seen].filter(w=>!remote.has(w));
   for(const word of remote)state.seen.add(word);
   persist(id);
   // Upload historical local answers under the same account without overwriting.
   for(let i=0;i<localOnly.length;i+=150){
    const rows=localOnly.slice(i,i+150).map(word=>({user_id:uid,word,game:"wordle"}));
    const {error}=await db.from("edgy_seen_words").upsert(rows,{onConflict:"user_id,word",ignoreDuplicates:true});
    if(error)console.warn("EDGY word history sync",error.message);
   }
  }catch(error){console.warn("EDGY word history offline fallback:",error?.message||error)}
  state.loaded=true;
 })();
 pending.set(id,task);
 try{await task}finally{pending.delete(id)}
}
async function claim(raw,game){
 const id=scope(),word=normalize(raw),state=get(id);
 if(!/^[a-z]{3,32}$/.test(word)||!["wordle","contexto"].includes(game))return false;
 await ready();
 if(state.seen.has(word))return false;
 const uid=user()?.id,db=client();
 if(uid&&db){
  try{
   const {error}=await db.from("edgy_seen_words").insert({user_id:uid,word,game});
   if(error){
    if(error.code==="23505"){state.seen.add(word);persist(id);return false}
    console.warn("EDGY word reservation offline:",error.message);
   }
  }catch(error){console.warn("EDGY word reservation fallback:",error?.message||error)}
 }
 state.seen.add(word);persist(id);return true;
}
async function choose(candidates,game){
 await ready();
 const source=[...new Set((candidates||[]).map(normalize))].filter(w=>/^[a-z]{3,32}$/.test(w));
 const available=source.filter(w=>!has(w));
 for(let remaining=available.length;remaining>0;remaining--){
  const index=Math.floor(Math.random()*remaining),word=available[index];
  available[index]=available[remaining-1];
  if(await claim(word,game))return word;
 }
 return null;
}
async function importPrevious(words,game){
 const id=scope(),state=get(id),uid=user()?.id,db=client();
 const additions=[...new Set((words||[]).map(normalize))].filter(w=>/^[a-z]{3,32}$/.test(w)&&!state.seen.has(w));
 for(const w of additions)state.seen.add(w);
 if(!additions.length)return;
 persist(id);
 if(uid&&db){
  for(let i=0;i<additions.length;i+=150){
   const rows=additions.slice(i,i+150).map(word=>({user_id:uid,word,game}));
   try{
    const {error}=await db.from("edgy_seen_words").upsert(rows,{onConflict:"user_id,word",ignoreDuplicates:true});
    if(error)console.warn("EDGY old word history:",error.message);
   }catch(error){console.warn("EDGY old word history offline:",error?.message||error)}
  }
 }
}
window.EDGY_seenWords=Object.freeze({normalize,has,ready,claim,choose,importPrevious,scope,count:()=>get().seen.size});
})();