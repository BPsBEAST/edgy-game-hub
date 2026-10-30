
(function(){
"use strict";
const sb=()=>window.EDGY_auth?.getClient(),user=()=>window.EDGY_auth?.getUser();
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let request=0,timer=null,profileRequest=0;
const style=document.createElement("style");
style.textContent='.playersGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,245px),1fr));gap:12px}.playerCard{display:flex;gap:13px;align-items:center;min-width:0;width:100%;text-align:left;background:#241b3d;border:1px solid #503b62;border-radius:16px;padding:15px;color:white;transition:transform .15s,border-color .15s}.playerCard:hover{transform:translateY(-2px);border-color:#fa4198}.playerIcon{width:58px;height:58px;border-radius:50%;object-fit:cover;flex-shrink:0;display:grid;place-items:center;background:#67375c;border:2px solid #a24e91;color:#fff;font-size:22px;font-weight:800}.playerBody{min-width:0;flex:1}.playerBody strong,.playerBody small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.playerBody strong{font-size:15px}.playerBody small{font-size:12px;color:#dea7d0;margin-top:3px}.playerBody span{display:block;font-size:11px;color:#b8adca;margin-top:7px}.playerSearch{display:block;width:100%;border:1px solid #665078;border-radius:13px;padding:14px;background:#201938;color:white;margin:15px 0 20px}.playerEmpty{border:1px dashed #58456b;border-radius:13px;padding:22px;color:#bcaecb;text-align:center;font-size:13px}.playerOverlay{position:fixed;inset:0;z-index:80;background:#0a061ade;backdrop-filter:blur(13px);display:grid;place-items:center;padding:16px}.playerOverlay[hidden]{display:none!important}.playerDialog{width:min(100%,480px);max-height:calc(100dvh - 32px);overflow-y:auto;border-radius:21px;border:1px solid #664675;background:#211a39;padding:21px;box-shadow:0 22px 68px #0009}.playerClose{float:right;border:0;border-radius:50%;background:#382a4d;color:#fff;padding:5px 11px;font-size:23px}.playerHead{display:flex;align-items:center;gap:14px;margin-bottom:18px}.playerHead h2{margin:0 0 3px}.playerStats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.playerStat{padding:12px 5px;border-radius:12px;text-align:center;background:#302545}.playerStat b{display:block;font-size:19px}.playerStat span{display:block;font-size:11px;color:#b1a1bc;margin-top:4px}.playerHistory{list-style:none;padding:0}.playerHistory li{padding:10px 0;border-bottom:1px solid #473858;font-size:12px;color:#d8c9e2;display:flex;justify-content:space-between;gap:8px}';
style.textContent+=".playerBio{white-space:pre-wrap;overflow-wrap:anywhere;color:#e3d2e7;line-height:1.55;font-size:14px;margin:4px 0 20px;padding:12px 14px;background:#2d2247;border-radius:12px}.playerBioPreview{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#d5bdde;margin-top:6px}";style.textContent+=".playerH2H{border-top:1px solid #59446c;margin-top:18px;padding-top:17px}.playerH2H h3{margin-bottom:14px}";document.head.append(style);
const modal=document.createElement("div");modal.className="playerOverlay";modal.hidden=true;modal.innerHTML='<div class="playerDialog" role="dialog" aria-modal="true" aria-label="Perfil público"><button class="playerClose" type="button" aria-label="Fechar">×</button><div id="edgy-player-info"></div></div>';document.body.append(modal);
let closingTimer=null,returnFocus=null;
function closeProfile(){
 if(modal.hidden)return;
 profileRequest++;modal.classList.add("isClosing");
 clearTimeout(closingTimer);
 closingTimer=setTimeout(()=>{modal.hidden=true;modal.classList.remove("isClosing");document.body.classList.remove("edgyProfileModalOpen");if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null},180);
}
modal.querySelector(".playerClose").onclick=closeProfile;
modal.onclick=e=>{if(e.target===modal)closeProfile()};
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!modal.hidden)closeProfile()});
function avatar(p){
 const url=p.avatar_path&&sb()?.storage.from("edgy-avatars").getPublicUrl(p.avatar_path)?.data?.publicUrl;
 if(url)return '<img class="playerIcon" loading="lazy" src="'+esc(url)+'" alt="Fotografia">';
 return '<span class="playerIcon">'+esc((p.name||"?")[0].toUpperCase())+'</span>';
}
async function openById(id){
 if(!sb()||!user()){window.EDGY_auth?.showEntry();return}
 const ticket=++profileRequest;clearTimeout(closingTimer);modal.classList.remove("isClosing");if(modal.hidden)returnFocus=document.activeElement;modal.hidden=false;document.body.classList.add("edgyProfileModalOpen");modal.querySelector(".playerClose").focus({preventScroll:true});const el=modal.querySelector("#edgy-player-info");el.innerHTML='<p class="sub">A carregar perfil…</p>';
 try{
 const {data:p,error}=await sb().rpc("edgy_player_profile",{p_player_id:id});
 if(ticket!==profileRequest||modal.hidden)return;
 if(error)throw error;
 if(!p){el.innerHTML='<h3>Perfil indisponível</h3><p class="sub">O jogador pode ser convidado ou ter o perfil privado.</p>';return}
 const isOther=p.id!==user()?.id;
 const history=Array.isArray(p.recent)?p.recent:[];
 el.innerHTML='<div class="playerHead">'+avatar(p)+'<div class="playerIdentity"><span class="playerEyebrow">PERFIL EDGY</span><h2>'+esc(p.name)+'</h2><span class="playerHandle">@'+esc(p.username)+'</span></div><div class="playerMiniStats" aria-label="Estatísticas de jogador"><span class="playerMiniStat"><strong>'+Number(p.level||1)+'</strong><small>Nível</small></span><span class="playerMiniStat"><strong>'+Number(p.xp||0)+'</strong><small>XP</small></span><span class="playerMiniStat"><strong>'+Number(p.matches||0)+'</strong><small>Partidas</small></span></div></div>'+(p.bio?'<p class="playerBio">'+esc(p.bio)+'</p>':'')+'<h3 class="playerSectionTitle">Xadrez</h3><p class="sub playerChessRecord">'+Number(p.chess_wins||0)+' vitórias · '+Number(p.chess_draws||0)+' empates · '+Number(p.chess_losses||0)+' derrotas</p><h3 class="playerSectionTitle">Atividade recente</h3>'+(history.length?'<ul class="playerHistory">'+history.map(h=>'<li><span>'+esc(h.game)+' · '+esc(h.result)+'</span><span>'+new Date(h.date).toLocaleDateString("pt-PT")+'</span></li>').join("")+'</ul>':'<p class="sub">Sem partidas registadas.</p>');
 if(isOther){
  const challenge=document.createElement("div");
  challenge.className="edgyPlayerInviteActions";
  challenge.innerHTML='<button type="button" class="edgyProfileChallenge" data-challenge-open>'
   +'<span class="edgyProfileChallengeIcon" aria-hidden="true">'
   +'<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
   +'<path d="M6 4h12v13H6zM9 17v3m6-3v3M6 9h12M11 7h2"/></svg></span>'
   +'<span><strong>Desafiar jogador</strong><small>Escolhe um jogo e envia um convite</small></span>'
   +'<span class="edgyProfileChallengeArrow" aria-hidden="true">→</span></button>';
  el.append(challenge);
  challenge.querySelector("[data-challenge-open]").onclick=()=>window.EDGY_social?.openChallenge(p.id,p.name);
  const h2h=document.createElement("section");h2h.className="playerH2H";
  h2h.innerHTML='<div class="playerH2HLoading">A consultar confrontos…</div>';
  el.append(h2h);
  try{
   const {data:head,error:h2hError}=await sb().rpc("edgy_head_to_head_all",{p_opponent:p.id});
   if(h2hError)throw h2hError;
   if(ticket!==profileRequest||!h2h.isConnected)return;
   const results=Array.isArray(head?.games)?head.games:[];
   const wins=Number(head?.wins||0),draws=Number(head?.draws||0),losses=Number(head?.losses||0),total=wins+draws+losses;
   h2h.innerHTML='<details class="playerH2HDetails"><summary><span class="playerH2HSummaryInfo"><strong>Confrontos contigo</strong><small>'+(total?total+' partida'+(total!==1?'s':'')+' entre vocês':'Ainda sem partidas entre vocês')+'</small></span><span class="playerH2HScore" aria-label="'+wins+' vitórias, '+draws+' empates, '+losses+' derrotas"><b>'+wins+'</b><span>V</span><i>·</i><b>'+draws+'</b><span>E</span><i>·</i><b>'+losses+'</b><span>D</span></span><span class="playerH2HChevron" aria-hidden="true">⌄</span></summary><div class="playerH2HContent"><p class="playerH2HHint">Resultados das partidas entre vocês.</p>'+(results.length?'<ul class="playerHistory">'+results.slice(0,16).map(g=>'<li><button type="button" class="playerReplayLink" data-replay="'+esc(g.game)+'|'+esc(g.code)+'"><span>'+esc(window.EDGY_platform?.games?.[g.game]?.title||g.game)+' · '+esc(({win:"Vitória",loss:"Derrota",draw:"Empate"})[g.outcome]||"Partida")+' · '+Number(g.moves||0)+' lances</span><span>'+new Date(g.date).toLocaleDateString("pt-PT")+' · <strong>Rever partida ↗</strong></span></button></li>').join("")+'</ul>':'<p class="sub">Ainda não jogaram uma partida completa entre vocês.</p>')+'</div></details>';
   h2h.querySelectorAll("[data-replay]").forEach(b=>b.onclick=()=>{
    const [kind,code]=b.dataset.replay.split("|");
    closeProfile();
    if(kind==="chess"){
     nav("history");
     window.EDGY_history?.openByCode(code);
    }else if(window.EDGY_platform?.games?.[kind]?.online){
     window.EDGY_openRoom?.(kind,code);
    }
   });
  }catch(err){h2h.innerHTML='<div class="playerH2HUnavailable">Confrontos indisponíveis neste momento.</div>'}
 }

 }catch(error){el.innerHTML='<p class="playerEmpty">Não foi possível abrir o perfil. '+esc(error.message)+'</p>'}
}
async function load(query){
 const holder=document.getElementById("edgy-players-list");if(!holder)return;
 if(!sb()||!user()){holder.innerHTML='<p class="playerEmpty">Entra na EDGY para ver os jogadores.</p>';return}
 const turn=++request;holder.innerHTML='<p class="sub">A procurar jogadores…</p>';
 try{
 const {data,error}=await sb().rpc("edgy_list_players",{p_search:query.trim().slice(0,40),p_limit:40});
 if(error)throw error;if(turn!==request||!holder.isConnected)return;
 holder.innerHTML=data?.length?'<div class="playersGrid">'+data.map(p=>'<button class="playerCard" data-player="'+esc(p.id)+'">'+avatar(p)+'<span class="playerBody"><strong>'+esc(p.name)+'</strong><small>@'+esc(p.username)+'</small>'+(p.bio?'<span class="playerBioPreview">'+esc(p.bio)+'</span>':"")+'<span>Nível '+Number(p.level||1)+' · '+Number(p.xp||0)+' XP · '+Number(p.matches||0)+' partidas</span></span></button>').join("")+'</div>':'<div class="playerEmpty">Não encontramos jogadores com esse nome.</div>';
 holder.querySelectorAll("[data-player]").forEach(el=>el.onclick=()=>openById(el.dataset.player));
 }catch(err){if(turn===request)holder.innerHTML='<p class="playerEmpty">Erro a carregar jogadores: '+esc(err.message)+'</p>'}
}
function mount(){
 const root=document.getElementById("screen");if(!root)return;
 root.innerHTML='<span class="eyebrow">Comunidade</span><h1>Jogadores <span style="color:#ff3c91">✦</span></h1><p class="sub">Descobre jogadores, consulta os seus perfis e desafia a tua malta.</p><input type="search" class="playerSearch" id="edgy-player-search" maxlength="40" placeholder="Pesquisar nome ou @username" aria-label="Pesquisar jogadores"><div id="edgy-players-list"></div>';
 root.querySelector("#edgy-player-search").oninput=e=>{clearTimeout(timer);timer=setTimeout(()=>load(e.target.value),220)};
 load("");
}
window.EDGY_players={mount,openById,closeProfile};
})();