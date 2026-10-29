(function(){
"use strict";
const css=document.createElement("style");
css.textContent='.cropOverlay{position:fixed;inset:0;z-index:90;background:#100b1de8;backdrop-filter:blur(15px);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto}.cropCard{width:min(100%,425px);max-height:calc(100dvh - 32px);overflow:auto;padding:22px;border-radius:24px;background:#211a38;border:1px solid #594467;color:#faf7ff;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.cropHead{display:flex;align-items:center;justify-content:space-between;gap:10px}.cropHead h2{margin:0;font-size:21px}.cropHint{color:#bfb2d2;font-size:13px;line-height:1.5;margin:10px 0 20px}.cropCanvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab}.cropCircle{width:min(100%,292px);aspect-ratio:1;overflow:hidden;border:3px solid #f2218a;box-shadow:0 0 0 7px #ed207b26;background:#150e26;border-radius:50%;margin:0 auto 18px}.cropZoom{width:100%;accent-color:#ff2f91;min-height:34px}.cropActions{display:flex;gap:9px;margin-top:16px}.cropActions button{flex:1;padding:12px 8px;border-radius:12px;border:1px solid #665476;background:#362b50;color:white;font-weight:700}.cropActions .cropSave{flex:1.7;background:linear-gradient(115deg,#ff075c,#c300a7);border:0}.cropActions button:disabled{opacity:.5}.cropClose{font-size:22px;background:transparent;color:#c9bce0;border:0}.cropStatus{min-height:18px;color:#ffa5bf;font-size:12px;margin-top:10px}';
document.head.appendChild(css);
window.EDGY_editAvatar=function(file){
 return new Promise(resolve=>{
  if(!file||!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>12*1024*1024){resolve(null);return}
  const box=document.createElement("div");box.className="cropOverlay";box.setAttribute("role","dialog");box.setAttribute("aria-modal","true");box.setAttribute("aria-label","Ajustar foto de perfil");
  box.innerHTML='<div class="cropCard"><div class="cropHead"><h2>Ajustar fotografia</h2><button class="cropClose" type="button" data-close aria-label="Fechar">×</button></div><p class="cropHint">Arrasta para enquadrar a imagem. Ajusta o zoom no controlo ou com dois dedos. Só será publicada quando confirmares.</p><div class="cropCircle"><canvas class="cropCanvas" width="512" height="512"></canvas></div><label for="crop-zoom" style="display:flex;justify-content:space-between;font-size:13px"><span>Zoom</span><span data-value>100%</span></label><input class="cropZoom" type="range" min="1" max="4" step=".01" value="1" id="crop-zoom"><div class="cropActions"><button type="button" data-reset>Recentrar</button><button type="button" data-cancel>Cancelar</button><button type="button" class="cropSave" data-save>Guardar foto</button></div><p class="cropStatus" aria-live="polite"></p></div>';
  const prior=document.body.style.overflow;document.body.style.overflow="hidden";document.body.appendChild(box);
  const canvas=box.querySelector("canvas"),ctx=canvas.getContext("2d"),range=box.querySelector("input"),save=box.querySelector("[data-save]"),status=box.querySelector(".cropStatus"),value=box.querySelector("[data-value]");
  const img=new Image(),url=URL.createObjectURL(file),points=new Map();
  let zoom=1,x=0,y=0,loaded=false,closed=false,pinch=null;
  function finish(result){if(closed)return;closed=true;URL.revokeObjectURL(url);document.body.style.overflow=prior;box.remove();resolve(result)}
  function redraw(){
   if(!loaded||!ctx)return;
   const scale=Math.max(512/img.naturalWidth,512/img.naturalHeight)*zoom,w=img.naturalWidth*scale,h=img.naturalHeight*scale;
   x=Math.max(-(w-512)/2,Math.min((w-512)/2,x));y=Math.max(-(h-512)/2,Math.min((h-512)/2,y));
   ctx.clearRect(0,0,512,512);ctx.drawImage(img,(512-w)/2+x,(512-h)/2+y,w,h);
   range.value=String(zoom);value.textContent=Math.round(zoom*100)+"%";
  }
  box.querySelector("[data-close]").onclick=()=>finish(null);
  box.querySelector("[data-cancel]").onclick=()=>finish(null);
  box.querySelector("[data-reset]").onclick=()=>{x=0;y=0;zoom=1;redraw()};
  box.onclick=e=>{if(e.target===box)finish(null)};
  box.onkeydown=e=>{if(e.key==="Escape")finish(null)};
  range.oninput=()=>{const old=zoom;zoom=Number(range.value);x*=zoom/old;y*=zoom/old;redraw()};
  const dist=()=>{const p=[...points.values()];return Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y)};
  canvas.onpointerdown=e=>{if(!loaded)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size===2)pinch={distance:dist(),zoom}};
  canvas.onpointermove=e=>{
   if(!points.has(e.pointerId)||!loaded)return;
   e.preventDefault();const p=points.get(e.pointerId);
   if(points.size===1){const ratio=512/canvas.getBoundingClientRect().width;x+=(e.clientX-p.x)*ratio;y+=(e.clientY-p.y)*ratio}
   points.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(points.size===2&&pinch){const old=zoom;zoom=Math.max(1,Math.min(4,pinch.zoom*dist()/Math.max(1,pinch.distance)));x*=zoom/old;y*=zoom/old}
   redraw();
  };
  const release=e=>{points.delete(e.pointerId);pinch=null};
  canvas.onpointerup=release;canvas.onpointercancel=release;canvas.onlostpointercapture=release;
  save.onclick=()=>{
   if(!loaded||closed)return;save.disabled=true;save.textContent="A preparar...";
   canvas.toBlob(blob=>{if(!blob){save.disabled=false;save.textContent="Guardar foto";status.textContent="Não foi possível recortar a imagem.";return}finish(new File([blob],"edgy-profile.jpg",{type:"image/jpeg",lastModified:Date.now()}))},"image/jpeg",.88);
  };
  img.onload=()=>{if(closed)return;loaded=Boolean(img.naturalWidth&&img.naturalHeight);if(loaded)redraw();else status.textContent="Imagem inválida."};
  img.onerror=()=>{status.textContent="Não foi possível ler a imagem.";save.disabled=true};
  img.src=url;
  box.querySelector("[data-close]").focus();
 });
};
})();