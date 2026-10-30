/* EDGY shared game presentation, independent from game engines / multiplayer state. */
(function(){
"use strict";
const details=Object.freeze({
 chess:{title:"Xadrez online",icon:"♞",intro:"Relógio por jogador · Estratégia · Online"},
 checkers:{title:"Damas",icon:"◎",intro:"8×8 · Captura obrigatória · Dama voadora"},
 tic:{title:"Jogo do Galo",icon:"⊗",intro:"3×3 · 2 jogadores · Online ou local"},
 reaction:{title:"Reflexos",icon:"◴",intro:"Arcade · 1 jogador · 3 rondas"}
});
function escape(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
function header(id,{room="",intro,backId=false}={}){
 const info=details[id];if(!info)throw Error("Jogo desconhecido: "+id);
 return '<header class="edgyGameHeader" data-game-header="'+id+'">'
  +'<div class="edgyGameHeaderRow"><button type="button" class="edgyGameBack back" data-back'+(backId?' id="goBack"':"")+'>← Jogos</button>'
  +'<span class="edgyGameHeading"><span class="edgyGameHeadingIcon" aria-hidden="true">'+info.icon+'</span><h1>'+escape(info.title)+'</h1></span>'
  +(room?'<span class="pill edgyGameRoomCode">'+escape(room)+'</span>':"")
  +'</div><p class="sub edgyGameIntro">'+escape(intro===undefined?info.intro:intro)+'</p></header>';
}
function card(title,body,{description="",className=""}={}){
 return '<section class="panel edgyGamePanel '+escape(className)+'">'
  +'<h3>'+escape(title)+'</h3>'
  +(description?'<p class="sub edgyGamePanelDescription">'+escape(description)+'</p>':"")
  +body+'</section>';
}
function match({game,stage,side,layoutClass="",stageClass="",sideClass="",between=""}){
 if(!details[game])throw Error("Jogo desconhecido: "+game);
 return '<div class="edgyMatchLayout '+escape(layoutClass)+'" data-match-game="'+game+'">'
  +'<div class="edgyMatchStage '+escape(stageClass)+'">'+stage+'</div>'
  +between
  +'<aside class="edgyMatchSide '+escape(sideClass)+'">'+side+'</aside></div>';
}
/* On games with an inline side panel, the same two-tab drawer is used on mobile.
   Event listeners are scoped to the current render; callers only supply selectors. */
const sections=new Map();
function bindMobilePanel(root,{game,sideSelector,optionSelector,historySelector,placementSelector}){
 const side=root.querySelector(sideSelector),placement=root.querySelector(placementSelector);
 if(!side||!placement)return;
 const option=side.querySelector(optionSelector),history=side.querySelector(historySelector);
 if(!option||!history)return;
 option.dataset.gamePanel="options";history.dataset.gamePanel="history";
 const nav=document.createElement("div");nav.className="edgyMatchMobileTabs";nav.setAttribute("aria-label","Painel da partida");
 const labels=[["options","Partida & opções"],["history","Jogadas & histórico"]];
 for(const [id,label] of labels){const b=document.createElement("button");b.type="button";b.dataset.gamePanelButton=id;b.textContent=label;nav.append(b)}
 placement.append(nav);
 let backdrop=side.parentElement.querySelector(".edgyMatchBackdrop");
 if(!backdrop){backdrop=document.createElement("button");backdrop.type="button";backdrop.className="edgyMatchBackdrop";backdrop.setAttribute("aria-label","Fechar painel");side.before(backdrop)}
 const close=document.createElement("button");close.type="button";close.className="edgyMatchDrawerClose";close.textContent="✕ Fechar";side.prepend(close);
 let lastFocus=null;
 const set=(id)=>{
  root.dataset.gamePanelOpen=id||"";
  side.dataset.activeGamePanel=id||"";
  for(const b of nav.querySelectorAll("button")){b.setAttribute("aria-expanded",String(b.dataset.gamePanelButton===id))}
  if(id){sections.set(game,id);lastFocus=document.activeElement;close.focus({preventScroll:true})}
  else{sections.delete(game);if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});lastFocus=null}
 };
 nav.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>set(b.dataset.gamePanelButton)));
 close.addEventListener("click",()=>set(null));backdrop.addEventListener("click",()=>set(null));
 if(sections.has(game))set(sections.get(game));
}
window.EDGY_gameUI=Object.freeze({details,header,card,match,bindMobilePanel});
})();