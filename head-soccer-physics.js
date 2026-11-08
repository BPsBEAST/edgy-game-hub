/* EDGY Head Soccer physics — original 1v1 arcade football engine.
 * Deterministic fixed-timestep simulation, no copied artwork or third-party dependencies. */
(function(){
"use strict";
const W=960,H=510,FLOOR=440,GOAL_TOP=276,BALL_R=22,HEAD_R=61;
const GRAVITY=1030,BALL_GRAVITY=950;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const left=()=>({id:0,x:180,y:FLOOR,vx:0,vy:0,face:1,energy:0,kickTime:0,kickCooldown:0,powerTime:0,
 kickLatch:false,jumpLatch:false,powerLatch:false,grounded:true,hitTime:0});
const right=()=>({...left(),id:1,x:W-180,face:-1});
function create(options={}){
 return {players:[left(),right()],ball:{x:W/2,y:185,vx:0,vy:0,spin:0,power:0,trail:0,effect:null},
  score:[0,0],seconds:60,mode:options.mode==="local"?"local":"cpu",
  difficulty:["easy","normal","hard"].includes(options.difficulty)?options.difficulty:"normal",
  status:"ready",suddenDeath:false,goalPause:0,lastGoal:-1,winner:-1,
  secondsPlayed:0,celebration:"",aiWait:0,aiInput:{},frame:0,hero:options.hero||"neon"};
}
function kick(st,p,special){
 const ball=st.ball;
 const dx=ball.x-p.x,dy=ball.y-(p.y-105);
 if(Math.abs(dx)>132||Math.abs(dy)>140)return false;
 const direction=dx===0?p.face:Math.sign(dx);
 const boost=special?1120:700;
 ball.vx=direction*boost+p.vx*.23;
 ball.vy=clamp(-205+dy*.54+(special?120:0),special?-285:-360,80);
 ball.spin=direction*(special?15:8);ball.power=special?1.8:0;ball.trail=special?1.7:0;ball.effect=special?(p.id===0?st.hero:"frost"):null;
 p.hitTime=.16;
 if(special)p.powerTime=0;
 p.energy=clamp(p.energy+(special?0:15),0,100);
 return true;
}
function playerStep(st,p,input,dt){
 const direction=Number(!!input.right)-Number(!!input.left);
 const speed=p.id===1&&st.mode==="cpu"?({easy:205,normal:252,hard:281}[st.difficulty]):277;
 p.vx=direction*speed;
 p.x=clamp(p.x+p.vx*dt,40,W-40);
 if(direction!==0)p.face=direction;
 if(input.jump&&!p.jumpLatch&&p.grounded){p.vy=-570;p.grounded=false}
 p.jumpLatch=!!input.jump;
 p.vy+=GRAVITY*dt;
 p.y+=p.vy*dt;
 if(p.y>=FLOOR){p.y=FLOOR;p.vy=0;p.grounded=true}
 p.kickCooldown=Math.max(0,p.kickCooldown-dt);
 p.kickTime=Math.max(0,p.kickTime-dt);
 p.powerTime=Math.max(0,p.powerTime-dt);
 p.hitTime=Math.max(0,p.hitTime-dt);
 p.energy=clamp(p.energy+dt*4.2,0,100);
 if(input.power&&!p.powerLatch&&p.energy>=100){p.energy=0;p.powerTime=2.7}
 p.powerLatch=!!input.power;
 if(input.kick&&!p.kickLatch&&p.kickCooldown===0){
  p.kickTime=.21;p.kickCooldown=.31;
  kick(st,p,p.powerTime>0);
 }
 p.kickLatch=!!input.kick;
}
function headCollision(st,p){
 const b=st.ball,cx=p.x,cy=p.y-130;
 const dx=b.x-cx,dy=b.y-cy,d=Math.hypot(dx,dy);
 const minimum=HEAD_R+BALL_R;
 if(d>=minimum)return;
 const nx=d>.001?dx/d:p.face,ny=d>.001?dy/d:-1;
 b.x=cx+nx*(minimum+.3);b.y=cy+ny*(minimum+.3);
 const toward=b.vx*nx+b.vy*ny;
 if(toward<0){b.vx-=(1.58*toward)*nx;b.vy-=(1.58*toward)*ny}
 b.vx+=p.vx*.23;b.vy+=p.vy*.14;
 b.vx=clamp(b.vx,-940,940);b.vy=clamp(b.vy,-800,780);
 p.energy=clamp(p.energy+.18,0,100);
 if(p.powerTime>0)kick(st,p,true);
}
function bodyCollision(st,p){
 const b=st.ball;
 const half=28,bodyTop=p.y-83,bodyBottom=p.y-7;
 const nearestX=clamp(b.x,p.x-half,p.x+half),nearestY=clamp(b.y,bodyTop,bodyBottom);
 const dx=b.x-nearestX,dy=b.y-nearestY;
 const dist=Math.hypot(dx,dy);
 if(dist>=BALL_R)return;
 if(Math.abs(dx)>Math.abs(dy)){
  const sign=dx>=0?1:-1;b.x=nearestX+sign*(BALL_R+.3);b.vx=sign*Math.max(150,Math.abs(b.vx)*.7)+p.vx*.3;
 }else{
  const sign=dy>=0?1:-1;b.y=nearestY+sign*(BALL_R+.3);
  b.vy=sign*Math.max(130,Math.abs(b.vy)*.62)+p.vy*.18;
 }
}
function postCollision(b,x){
 const dx=b.x-x,dy=b.y-GOAL_TOP,d=Math.hypot(dx,dy),limit=BALL_R+7;
 if(d>=limit)return;
 const nx=d>.001?dx/d:(x<W/2?1:-1),ny=d>.001?dy/d:-1;
 b.x=x+nx*(limit+.4);b.y=GOAL_TOP+ny*(limit+.4);
 const dot=b.vx*nx+b.vy*ny;
 if(dot<0){b.vx-=1.65*dot*nx;b.vy-=1.65*dot*ny}
}
function ballStep(st,dt){
 const b=st.ball;
 b.vy=clamp(b.vy+BALL_GRAVITY*dt,-950,930);
 b.x+=b.vx*dt;b.y+=b.vy*dt;b.spin+=b.vx*dt*.02;
 b.vx*=Math.pow(.993,dt*60);
 b.power=Math.max(0,b.power-dt);
 b.trail=Math.max(0,b.trail-dt*.8);
 if(b.y<BALL_R){b.y=BALL_R;b.vy=Math.abs(b.vy)*.81}
 if(b.y>FLOOR-BALL_R){
  b.y=FLOOR-BALL_R;
  if(b.vy>64)b.vy=-b.vy*.73;
  else b.vy=0;
  b.vx*=Math.pow(.985,dt*60);
 }
 postCollision(b,10);postCollision(b,W-10);
 for(const p of st.players){headCollision(st,p);bodyCollision(st,p)}
 // The goal opening is below the crossbar; outside it the ball rebounds on the side walls.
 const inMouth=b.y>=GOAL_TOP+BALL_R*.36&&b.y<FLOOR-BALL_R*.2;
 if(b.x<=BALL_R&&!inMouth){b.x=BALL_R;b.vx=Math.abs(b.vx)*.82}
 if(b.x>=W-BALL_R&&!inMouth){b.x=W-BALL_R;b.vx=-Math.abs(b.vx)*.82}
 if(inMouth&&b.x<0)return 1;
 if(inMouth&&b.x>W)return 0;
 return -1;
}
function reset(st){
 st.players=[left(),right()];
 st.ball={x:W/2,y:185,vx:0,vy:0,spin:0,power:0,trail:0,effect:null};
}
function goal(st,scorer){
 st.score[scorer]++;
 st.lastGoal=scorer;st.celebration=scorer===0?"GOLO EDGY!":"GOLO ADVERSÁRIO!";
 if(st.suddenDeath){st.winner=scorer;st.status="finished";return}
 st.status="goal";st.goalPause=1.35;
 st.ball.vx=0;st.ball.vy=0;st.ball.power=0;
}
function cpu(st,dt){
 const cpuP=st.players[1],b=st.ball;
 st.aiWait-=dt;
 if(st.aiWait>0)return st.aiInput;
 st.aiWait={easy:.24,normal:.13,hard:.055}[st.difficulty];
 const target=clamp(b.x+25,80,W-65);
 const ahead=target-cpuP.x;
 const near=Math.abs(b.x-cpuP.x)<137;
 const above=b.y<cpuP.y-166&&b.y>cpuP.y-295;
 const danger=b.x>640;
 const input={left:ahead<-18,right:ahead>18,
  jump:near&&above&&cpuP.grounded&&(danger||st.difficulty==="hard"),
  kick:near&&Math.abs(b.y-(cpuP.y-105))<145&&cpuP.kickCooldown<.09,
  power:cpuP.energy>=100&&near};
 // Press/release actions on successive AI decisions so the key-latches behave correctly.
 if(cpuP.kickLatch)input.kick=false;
 if(cpuP.jumpLatch)input.jump=false;
 if(cpuP.powerLatch)input.power=false;
 st.aiInput=input;
 return input;
}
function step(st,input={},dt=1/60){
 if(!st||typeof st!=="object")return st;
 const delta=clamp(Number(dt)||0,0,1/30);
 if(st.status==="goal"){
  st.goalPause-=delta;
  if(st.goalPause<=0){reset(st);st.status="playing";st.celebration=""}
  return st;
 }
 if(st.status!=="playing"||delta<=0)return st;
 const p1=input.p1||{},p2=st.mode==="cpu"?cpu(st,delta):input.p2||{};
 playerStep(st,st.players[0],p1,delta);
 playerStep(st,st.players[1],p2,delta);
 // Do not allow both avatars to occupy the same spot.
 const a=st.players[0],b=st.players[1],diff=b.x-a.x;
 if(Math.abs(diff)<45){const midpoint=(a.x+b.x)/2;a.x=clamp(midpoint-22.5,40,W-40);b.x=clamp(midpoint+22.5,40,W-40)}
 const scorer=ballStep(st,delta);
 if(scorer>=0){goal(st,scorer);return st}
 if(!st.suddenDeath){
  st.seconds=Math.max(0,st.seconds-delta);
  if(st.seconds===0){
   if(st.score[0]===st.score[1]){st.suddenDeath=true;st.celebration="GOLO DE OURO!";st.seconds=0}
   else{st.status="finished";st.winner=st.score[0]>st.score[1]?0:1;st.celebration=""}
  }
 }
 st.secondsPlayed+=delta;st.frame++;
 return st;
}
function launch(st){if(st.status==="ready")st.status="playing";return st}
function pause(st){if(st.status==="playing"){st.status="paused";return true}
 if(st.status==="paused"){st.status="playing";return true}return false}
window.EDGY_headSoccerPhysics=Object.freeze({W,H,FLOOR,GOAL_TOP,BALL_R,HEAD_R,create,step,launch,pause,kick});
})();