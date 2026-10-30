(function(){
"use strict";
const apiConfig=window.EDGY_SUPABASE||{};
const configured=Boolean(apiConfig.url&&apiConfig.anonKey&&window.supabase);
const sb=configured?window.supabase.createClient(apiConfig.url,apiConfig.anonKey):null;
let account=null, profile=null, authBusy=false, entryMode=localStorage.getItem("edgy_entry_mode")||"";
const css=document.createElement("style");
css.textContent=`
.authMask[hidden]{display:none!important}.authMask{position:fixed;inset:0;z-index:30;overflow-y:auto;background:#141126ed;backdrop-filter:blur(20px);display:grid;place-items:center;padding:20px}.authBox{width:min(100%,420px);border:1px solid #443253;border-radius:24px;padding:27px;background:#211935;box-shadow:0 25px 85px #0d0619b0}.authLogo{font-size:48px;font-weight:950;letter-spacing:-4px;text-align:center;background:linear-gradient(110deg,#ff075c,#c300a7);background-clip:text;-webkit-background-clip:text;color:transparent}.authBox h2{text-align:center;margin-top:22px}.authBox .sub{text-align:center}.authActions{display:grid;gap:9px;margin:20px 0}.authActions button{width:100%}.authNote{font-size:12px;color:#b2a6c8;line-height:1.6}.authError{font-size:12px;color:#ff9cb7;min-height:20px}.authForm label{display:block;margin:12px 0 6px;font-size:12px;color:#c2b6d6}.authForm input{background:#141126;border:1px solid #574263;border-radius:10px;padding:12px;width:100%;color:white}.authClose{border:0;background:transparent;color:#bfb1cf}.authAvatar{width:70px;height:70px;border-radius:50%;object-fit:cover;border:2px solid #ec277d}.authPhoto{margin:15px 0}.authStatus{font-size:12px;color:#c7b7d2;margin-top:10px}
.edgyPhotoPicker{display:inline-flex;align-items:center;justify-content:center;border:1px solid #805279;background:#36284b;border-radius:12px;padding:12px 14px;color:#fff;cursor:pointer;font-size:13px;font-weight:700;position:relative}.edgyPhotoPicker:focus-within{outline:2px solid #ff4698;outline-offset:3px}.edgyPhotoPicker input{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden}\n`;css.textContent+=".playersVisibility{display:flex;align-items:center;gap:9px;padding:13px;margin-top:16px;background:#2b2242;border:1px solid #514062;border-radius:12px;color:#e9dceb;font-size:13px}.playersVisibility input{accent-color:#f32891;width:18px;height:18px;flex-shrink:0}";document.head.appendChild(css);
const modal=document.createElement("div");modal.className="authMask";modal.id="edgy-auth";modal.hidden=true;modal.style.display="none";document.body.appendChild(modal);
function show(html){modal.hidden=false;modal.style.display="grid";modal.innerHTML='<div class="authBox">'+html+'</div>';const close=modal.querySelector("[data-close]");if(close)close.onclick=hide;}
function hide(){modal.hidden=true;modal.style.display="none"}
const note=configured?"":"<p class='authNote'>Contas online ainda não estão ligadas. Podes jogar como convidado. Quando o Supabase estiver configurado, o registo ficará disponível.</p>";
function start(){show('<div class="authLogo">EDGY</div><p class="sub">PLAY YOUR WAY</p><h2>Bem-vindo à EDGY</h2><p class="sub">Sem complicações. Escolhe como queres jogar.</p><div class="authActions"><button class="primary" id="edgy-create">Criar conta</button><button class="secondary" id="edgy-login">Iniciar sessão</button><button class="secondary" id="edgy-guest">Jogar como convidado</button></div>'+note);
modal.querySelector("#edgy-guest").onclick=guestForm;
modal.querySelector("#edgy-create").onclick=()=>form("register");modal.querySelector("#edgy-login").onclick=()=>form("login");
}
function guestForm(){
 show('<button class="authClose" data-close>✕ Fechar</button><div class="authLogo">EDGY</div><h2>Jogar como convidado</h2><p class="sub">Só precisas de escolher um nickname.</p><form class="authForm" id="edgy-guest-form"><label>Nickname</label><input name="nickname" maxlength="22" required value="'+esc(state.name)+'" placeholder="Como te vamos chamar?"><div class="authActions"><button class="primary" type="submit">Começar a jogar</button></div><p class="authError" id="edgy-guest-error" role="status"></p></form>');
 modal.querySelector("#edgy-guest-form").onsubmit=async(event)=>{
  event.preventDefault();if(authBusy)return;authBusy=true;
  const name=String(new FormData(event.target).get("nickname")||"").trim().slice(0,22);
  if(!name){authBusy=false;return}
  state.name=name;save();
  try{
   if(configured){
    const {data,error}=await sb.auth.signInAnonymously({options:{data:{display_name:name}}});
    if(error)throw error;
    account=data.user;
    localStorage.setItem("edgy_owner_id",account.id);
    await uploadHistory();await loadCloud();
   }
   entryMode="guest";localStorage.setItem("edgy_entry_mode",entryMode);
   hide();render();
  }catch(error){
   modal.querySelector("#edgy-guest-error").textContent="Não foi possível entrar online: "+error.message+" Tenta novamente.";
  }finally{authBusy=false}
 };
}
const upgradeKey="edgy_upgrade_pending";
const website="https://bpsbeast.github.io/edgy-game-hub/";
function form(mode){
 if(!configured){start();return}
 const register=mode==="register";
 const isUpgrade=register&&Boolean(account?.is_anonymous);
 const nick=register?'<label>Nickname</label><input name="nickname" maxlength="22" required placeholder="Nome de jogador" value="'+esc(state.name)+'">':'';
 const passwordField=isUpgrade?'':'<label>Palavra-passe (8+ caracteres, letras e números)</label><input name="password" type="password" minlength="8" pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,}" autocomplete="'+(register?'new-password':'current-password')+'" required>'+(register?'<label>Confirmar palavra-passe</label><input name="confirm" type="password" autocomplete="new-password" minlength="8" required>':'');
 show('<button class="authClose" data-close>✕ Fechar</button><div class="authLogo">EDGY</div><h2>'+(register?(isUpgrade?'Guardar progresso':'Criar conta'):'Iniciar sessão')+'</h2><form class="authForm" id="edgy-form">'+nick+'<label>Email</label><input name="email" type="email" autocomplete="email" required>'+passwordField+'<div class="authActions"><button type="submit" class="primary">'+(register?(isUpgrade?'Confirmar email':'Criar conta'):'Entrar')+'</button>'+(register?'':'<button type="button" id="edgy-otp-login" class="secondary">Entrar com link por email</button><button type="button" id="edgy-forgot" class="secondary">Recuperar palavra-passe</button>')+'</div><p class="authError" id="edgy-auth-error" role="status"></p></form><p class="authNote">'+(isUpgrade?'Primeiro confirma o email. Depois poderás definir uma palavra-passe e manter o teu perfil.':'Podes continuar a jogar como convidado.')+'</p>');
 modal.querySelector("#edgy-form").onsubmit=async(event)=>{
  event.preventDefault();if(authBusy)return;authBusy=true;
  const data=new FormData(event.target),email=String(data.get("email")).trim(),password=String(data.get("password")||""),nickname=String(data.get("nickname")||state.name).trim().slice(0,22)||"Jogador";
  const message=modal.querySelector("#edgy-auth-error");
  try{
   if(register&&!isUpgrade&&password!==String(data.get("confirm")||""))throw Error("As palavras-passe não coincidem.");
   let response;
   if(isUpgrade){response=await sb.auth.updateUser({email,data:{display_name:nickname}},{emailRedirectTo:website})}
   else if(register){response=await sb.auth.signUp({email,password,options:{emailRedirectTo:website,data:{display_name:nickname}}})}
   else {response=await sb.auth.signInWithPassword({email,password})}
   if(response.error)throw response.error;
   if(isUpgrade){
    localStorage.setItem(upgradeKey,account.id);
    message.textContent="Abre o email de confirmação. Depois regressa à EDGY para criar a palavra-passe.";
    return;
   }
   if(register&&!response.data.session){
    message.textContent="Confirma o email e regressa para iniciar sessão.";
    return;
   }
   account=response.data.user;
   if(!account)throw Error("Não foi possível recuperar a sessão.");
   localStorage.setItem("edgy_owner_id",account.id);
   entryMode="account";localStorage.setItem("edgy_entry_mode",entryMode);
   await loadCloud(register?nickname:undefined);
   hide();render();
  }catch(error){message.textContent=error.message||"Ocorreu um erro."}
  finally{authBusy=false}
 };
 if(!register){
  const error=modal.querySelector("#edgy-auth-error"),getEmail=()=>String(modal.querySelector('[name="email"]')?.value||"").trim();
  modal.querySelector("#edgy-otp-login").onclick=async()=>{
   const email=getEmail();if(!email){error.textContent="Escreve primeiro o teu email.";return}
   error.textContent="A enviar link...";
   const response=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:website}});
   error.textContent=response.error?response.error.message:"Se a conta existir, receberás um link para entrar. A EDGY vai pedir a password se ainda não tiveres uma.";
  };
  modal.querySelector("#edgy-forgot").onclick=async()=>{
   const email=getEmail();if(!email){error.textContent="Escreve primeiro o teu email.";return}
   error.textContent="A enviar recuperação...";
   const response=await sb.auth.resetPasswordForEmail(email,{redirectTo:website});
   error.textContent=response.error?response.error.message:"Se a conta existir, receberás um email para definir uma nova palavra-passe.";
  };
 }
}
function finishUpgrade(recovery=false){
 if(!account||account.is_anonymous)return;
 show('<button class="authClose" data-close>Agora não</button><div class="authLogo">EDGY</div><h2>'+(recovery?'Recuperar palavra-passe':'Concluir a tua conta')+'</h2><p class="sub">Email confirmado! Define uma palavra-passe para poderes iniciar sessão em qualquer dispositivo.</p><form class="authForm" id="edgy-finish"><label>Palavra-passe (8+ caracteres, letras e números)</label><input name="password" type="password" minlength="8" pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,}" autocomplete="new-password" required><label>Confirmar palavra-passe</label><input name="confirm" type="password" minlength="8" autocomplete="new-password" required><div class="authActions"><button class="primary" type="submit">Guardar palavra-passe</button></div><p class="authError" id="edgy-auth-error" role="status"></p></form>');
 modal.querySelector("#edgy-finish").onsubmit=async(event)=>{
  event.preventDefault();if(authBusy)return;authBusy=true;
  try{
   const data=new FormData(event.target),password=String(data.get("password")||""),confirm=String(data.get("confirm")||"");
   if(password!==confirm)throw Error("As palavras-passe não coincidem.");
   if(password.length<8||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))throw Error("A password precisa de letras, números e 8 caracteres.");
   const {error}=await sb.auth.updateUser({password});if(error)throw error;
   localStorage.removeItem(upgradeKey);
   entryMode="account";localStorage.setItem("edgy_entry_mode",entryMode);
   hide();await loadCloud();render();
  }catch(error){modal.querySelector("#edgy-auth-error").textContent=error.message||"Erro ao guardar a password."}
  finally{authBusy=false}
 };
}
let passwordChecking=false;
async function promptPasswordIfNeeded(recovery=false){
 if(!account||account.is_anonymous||passwordChecking||authBusy)return;
 passwordChecking=true;
 try{
  const {data,error}=await sb.rpc("edgy_account_needs_password");
  if(error)console.warn("EDGY password check",error.message);
  if(recovery||(!error&&data===true))finishUpgrade(recovery);
  else if(!error) localStorage.removeItem(upgradeKey);
 }catch(e){console.warn("EDGY password status",e)}
 finally{passwordChecking=false}
}
function uuid(){return crypto.randomUUID()}
async function uploadHistory(){if(!account)return;const fresh=state.history.filter(x=>!x.remote);for(const h of fresh)h.client_id=h.client_id||uuid();save();const items=fresh.map(x=>({user_id:account.id,client_id:x.client_id,game:x.title,result:x.result,xp:Math.min(100,Math.max(0,Number(x.xp)||0))}));if(!items.length)return;const {error}=await sb.from("match_history").upsert(items,{onConflict:"user_id,client_id",ignoreDuplicates:true});if(error)console.warn("EDGY sync:",error.message);else{for(const h of fresh)h.remote=true;save()}}
async function loadCloud(nickname){if(!account)return;try{const {data:p}=await sb.from("profiles").select("display_name,username,xp,avatar_path,public_visible").eq("id",account.id).maybeSingle();profile=p;if(nickname){await sb.from("profiles").update({display_name:nickname}).eq("id",account.id)}const [pr,hi]=await Promise.all([sb.from("profiles").select("display_name,username,xp,avatar_path,public_visible").eq("id",account.id).maybeSingle(),sb.from("match_history").select("client_id,game,result,xp,played_at").eq("user_id",account.id).order("played_at",{ascending:false}).limit(50)]);if(pr.data){profile=pr.data;state.name=profile.display_name;state.xp=profile.xp}if(hi.data)state.history=hi.data.map(x=>({title:x.game,result:x.result,xp:x.xp,date:x.played_at,client_id:x.client_id,remote:true}));save()}catch(err){console.warn("EDGY cloud profile:",err)}}
const oldComplete=complete;complete=function(title,result,xp){oldComplete(title,result,xp);const h=state.history[0];if(h)h.client_id=uuid();save();if(account){uploadHistory().then(()=>loadCloud()).then(()=>{if(!game)render()}).catch(console.warn)}};
const oldRender=render;render=function(){oldRender();const button=document.getElementById("avatar");if(button&&sb&&profile?.avatar_path){const url=sb.storage.from("edgy-avatars").getPublicUrl(profile.avatar_path).data.publicUrl;const img=document.createElement("img");img.src=url;img.alt="Foto de perfil";img.style.cssText="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block";button.style.padding="0";button.style.overflow="hidden";button.replaceChildren(img)}if(page==="profile"&&!game){const host=document.querySelector("#screen");if(!host)return;const box=document.createElement("section");box.className="section panel";box.innerHTML='<h3>Identidade EDGY</h3><p class="sub">'+(!configured?"Modo local — liga o Supabase para ativar contas online.":account&&!account.is_anonymous?"Conta online com progresso sincronizado.":account?"Convidado online. Podes transformar este perfil numa conta.":"Convidado local.")+'</p>'+(profile?.avatar_path?'<img class="authAvatar" alt="Foto de perfil" src="'+sb.storage.from("edgy-avatars").getPublicUrl(profile.avatar_path).data.publicUrl+'">':'')+'<div class="actionrow"><button class="secondary" id="edgy-account">'+(account&&!account.is_anonymous?"Gerir conta":"Criar conta / Entrar")+'</button>'+(account?'<button class="secondary" id="edgy-logout">Sair</button>':'')+'</div>'+(account&&!account.is_anonymous?'<div class="authPhoto"><label class="formLabel" for="edgy-photo">A tua fotografia</label><label class="edgyPhotoPicker" for="edgy-photo"><span>📷 &nbsp; Escolher e ajustar fotografia</span><input id="edgy-photo" type="file" accept="image/jpeg,image/png,image/webp"></label><p class="authNote">JPG, PNG ou WebP até 12 MB. Arrasta, faz zoom e confirma antes de publicar.</p><p class="authStatus" id="edgy-photo-msg" role="status"></p></div>':'');host.appendChild(box);
if(account&&!account.is_anonymous){
 const idPanel=document.createElement("section");
 idPanel.className="section panel";
 idPanel.innerHTML='<h3>Identidade de jogador</h3><p class="sub">O nome visível pode repetir-se. O username é único na EDGY.</p><label class="formLabel" for="edgy-handle">Username único</label><div class="row"><span class="sub">@</span><input id="edgy-handle" class="field" maxlength="20" autocomplete="off" spellcheck="false" placeholder="ex: buedaedgy" style="flex:1;min-width:140px"><button class="secondary" type="button" id="edgy-handle-save">Guardar ID</button></div><p class="sub" id="edgy-handle-message" role="status">3 a 20 caracteres: letras, números ou _</p>';
 idPanel.innerHTML+='<label class="playersVisibility"><input id="edgy-public-visible" type="checkbox"> Mostrar o meu perfil aos outros jogadores</label><div class="actionrow"><button class="secondary" type="button" id="edgy-see-me">Ver o meu perfil público</button></div><p class="sub" id="edgy-visibility-msg" role="status"></p>';
 host.appendChild(idPanel);
 const toggle=idPanel.querySelector("#edgy-public-visible");
 toggle.checked=profile?.public_visible!==false;
 toggle.onchange=async()=>{
  const {data,error}=await sb.from("profiles").update({public_visible:toggle.checked}).eq("id",account.id).select("public_visible").single();
  if(error){toggle.checked=!toggle.checked;idPanel.querySelector("#edgy-visibility-msg").textContent=error.message;return}
  profile={...profile,public_visible:data.public_visible};
  idPanel.querySelector("#edgy-visibility-msg").textContent=data.public_visible?"O perfil aparece na área Jogadores.":"O teu perfil está oculto da comunidade.";
 };
 idPanel.querySelector("#edgy-see-me").onclick=()=>window.EDGY_players?.openById(account.id);
 const input=idPanel.querySelector("#edgy-handle"),message=idPanel.querySelector("#edgy-handle-message");
 input.value=profile?.username||"";
 idPanel.querySelector("#edgy-handle-save").onclick=async()=>{
  const username=input.value.trim().toLowerCase();
  if(!/^[a-z0-9_]{3,20}$/.test(username)){message.textContent="Usa 3–20 caracteres: letras, números ou _.";return}
  message.textContent="A guardar...";
  const {data,error}=await sb.from("profiles").update({username}).eq("id",account.id).select("username").single();
  if(error){message.textContent=error.code==="23505"?"Esse username já está ocupado. Escolhe outro.":"Não foi possível guardar: "+error.message;return}
  profile={...profile,username:data.username};
  input.value=data.username;message.textContent="Username guardado: @"+data.username;
 };
}
box.querySelector("#edgy-account").onclick=()=>{if(account&&!account.is_anonymous)manage();else start()};
box.querySelector("#edgy-logout")?.addEventListener("click",async()=>{await sb.auth.signOut();account=null;profile=null;localStorage.removeItem("edgy_entry_mode");localStorage.removeItem("edgy_owner_id");localStorage.removeItem(upgradeKey);entryMode="";state={name:"Jogador",xp:0,history:[]};save();render();start()});
box.querySelector("#edgy-photo")?.addEventListener("change",async event=>{
 const input=event.target,original=input.files?.[0],msg=box.querySelector("#edgy-photo-msg");
 if(!original)return;
 if(!["image/jpeg","image/png","image/webp"].includes(original.type)||original.size>12*1024*1024){
  msg.textContent="Escolhe uma imagem JPG, PNG ou WebP até 12 MB para ajustar.";
  input.value="";return;
 }
 if(typeof window.EDGY_editAvatar!=="function"){
  msg.textContent="O editor ainda não carregou. Atualiza a página e tenta novamente.";
  input.value="";return;
 }
 let cropped;
 try{cropped=await window.EDGY_editAvatar(original)}
 catch(error){msg.textContent="Não foi possível abrir o editor.";input.value="";return}
 input.value="";
 if(!cropped){msg.textContent="Edição cancelada. A foto anterior foi mantida.";return}
 if(!account||account.is_anonymous){msg.textContent="Inicia sessão numa conta para publicar a foto.";return}
 msg.textContent="A guardar o novo avatar...";
 const path=account.id+"/"+uuid()+".jpg";
 try{
  const upload=await sb.storage.from("edgy-avatars").upload(path,cropped,{contentType:"image/jpeg",upsert:false});
  if(upload.error)throw upload.error;
  const saved=await sb.from("profiles").update({avatar_path:path}).eq("id",account.id).select("avatar_path").single();
  if(saved.error){
   await sb.storage.from("edgy-avatars").remove([path]);
   throw saved.error;
  }
  const previous=profile?.avatar_path;
  profile={...profile,avatar_path:path};
  msg.textContent="Fotografia guardada!";
  render();
  if(previous&&previous!==path&&previous.startsWith(account.id+"/")){
   sb.storage.from("edgy-avatars").remove([previous]).catch(()=>{});
  }
 }catch(error){msg.textContent=error.message||"Erro ao guardar a fotografia."}
});
const saveBtn=document.querySelector("#saveName");if(saveBtn&&account){const original=saveBtn.onclick;saveBtn.onclick=async()=>{original();const res=await sb.from("profiles").update({display_name:state.name}).eq("id",account.id);if(res.error)console.warn(res.error.message)}}}};
function manage(){show('<button class="authClose" data-close>✕ Fechar</button><div class="authLogo">EDGY</div><h2>A tua conta</h2><p class="sub">'+(account?.email||"Conta online")+'</p><div class="authActions"><button class="secondary" id="closeAcct">Continuar a jogar</button><button class="secondary" id="manage-password">Definir / alterar password</button></div>');modal.querySelector("#closeAcct").onclick=hide;modal.querySelector("#manage-password").onclick=()=>finishUpgrade(true)}
async function boot(){
 if(!configured){render();if(!entryMode)start();return}
 try{
  const {data,error}=await sb.auth.getUser();if(error)console.warn("EDGY auth:",error.message);
  account=data.user||null;
  if(account){
   if(localStorage.getItem("edgy_owner_id")===account.id)await uploadHistory();
   await loadCloud();
   entryMode=account.is_anonymous?"guest":"account";
   localStorage.setItem("edgy_entry_mode",entryMode);
   localStorage.setItem("edgy_owner_id",account.id);
  }else if(entryMode==="account"){entryMode="";localStorage.removeItem("edgy_entry_mode");localStorage.removeItem("edgy_owner_id")}
  render();
  if(account&&!account.is_anonymous)await promptPasswordIfNeeded()
  if(!entryMode)start();
 }catch(error){console.warn("EDGY boot:",error);render();if(!entryMode)start()}
}
window.EDGY_auth={getClient:()=>sb,getUser:()=>account,getProfile:()=>profile,showEntry:()=>start(),refreshProfile:async()=>{if(account){await loadCloud();render()}}};
if(sb)sb.auth.onAuthStateChange((event,session)=>{
 if(!["SIGNED_IN","USER_UPDATED","PASSWORD_RECOVERY"].includes(event)||!session?.user)return;
 setTimeout(async()=>{
  if(authBusy)return;
  try{
   const u=session.user;
   if(!account||account.id!==u.id||account.is_anonymous!==u.is_anonymous){
    account=u;entryMode=u.is_anonymous?"guest":"account";
    localStorage.setItem("edgy_entry_mode",entryMode);
    localStorage.setItem("edgy_owner_id",u.id);
    await loadCloud();render();
   }else account=u;
   await promptPasswordIfNeeded(event==="PASSWORD_RECOVERY");
  }catch(err){console.warn("EDGY account callback:",err)}
 },250);
});
boot();
})();