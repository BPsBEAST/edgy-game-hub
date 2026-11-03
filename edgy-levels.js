/* EDGY progressive career levels.
 * When a profile migrates from the original 100-XP system, its current level
 * and level-start XP are frozen as the starting point. Earned XP is never lost. */
(function(){
"use strict";
function required(level){
 const n=Math.max(1,Math.floor(Number(level)||1));
 if(n<5)return 100;
 if(n<10)return 150;
 if(n<20)return 250;
 if(n<30)return 400;
 if(n<50)return 600;
 if(n<75)return 900;
 if(n<100)return 1200;
 return 1500+250*Math.floor((n-100)/25);
}
function info(xp,anchorLevel=1,anchorXP=0){
 const total=Math.max(0,Math.floor(Number(xp)||0));
 let level=Math.max(1,Math.floor(Number(anchorLevel)||1));
 let within=Math.max(0,total-Math.max(0,Math.floor(Number(anchorXP)||0)));
 let need=required(level);
 while(within>=need){
  within-=need;
  level++;
  need=required(level);
 }
 return Object.freeze({level,progress:within,required:need,remaining:need-within,percentage:Math.min(100,Math.max(0,100*within/need))});
}
function legacyAnchor(xp){
 const n=Math.max(0,Math.floor(Number(xp)||0));
 return {level:Math.floor(n/100)+1,xp:Math.floor(n/100)*100};
}
window.EDGY_levels=Object.freeze({required,info,legacyAnchor});
})();