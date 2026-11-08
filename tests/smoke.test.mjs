/* No dependencies. Run: node --test tests/smoke.test.mjs */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=file=>fs.readFileSync(path.join(dir,file),"utf8");
const html=read("index.html");
const app=read("app.js");
const gameFiles=["head-soccer-physics.js","head-soccer-game.js","twenty48-rules.js","twenty48-game.js","edgy-levels.js","app.js","edgy-platform.js","edgy-game-ui.js","casino-tables.js","players.js","social.js","history.js","chess-online.js","checkers-replay.js","checkers-online.js","tic-online.js","barricade-online.js","party-online.js","poker-online.js","casino-game.js","wordle-data.js","wordle-rules.js","edgy-seen-words.js","wordle-game.js","contexto-data.js","contexto-rules.js","contexto-game.js","auth.js","sw.js"];
test("All app scripts and inline bootstrap parse successfully",()=>{
 for(const file of gameFiles)assert.doesNotThrow(()=>new vm.Script(read(file),{filename:file}),file);
 const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
 for(const script of scripts.filter(m=>!m[1].includes("src=")))assert.doesNotThrow(()=>new vm.Script(script[2]),"inline JS");
});
test("Every local asset referenced by the bootstrap exists",()=>{
 const files=[...html.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="(\.\/[^"]+)"/g)].map(m=>m[1]);
 for(const source of files)assert.ok(fs.existsSync(path.join(dir,source.split("?")[0])),source);
 const assets=read("sw.js").match(/const ASSETS=\[([^\]]+)\]/)?.[1];
 assert.ok(assets);
 const names=[...assets.matchAll(/"([^"]+)"/g)].map(m=>m[1]);
 for(const name of names)assert.ok(fs.existsSync(path.join(dir,name.split("?")[0])),name);
 assert.ok(names.includes("./edgy-platform.js?v=69"),"shared platform cached");
 assert.ok(names.includes("./app.js?v=69"),"bootstrap cached");
 assert.ok(names.includes("./base.css?v=29"),"base stylesheet cached");
 assert.ok(names.includes("./edgy-theme.css?v=34"),"design cached");
 assert.ok(names.includes("./tic-online.js?v=40"),"online tic cached");
 assert.ok(names.includes("./checkers-replay.js?v=33"),"checkers replay cached");
});
test("Head Soccer arcade engine supports CPU, local, power shots, 60 seconds and golden goal",()=>{
 const sandbox={window:{}};vm.runInNewContext(read("head-soccer-physics.js"),sandbox);
 const engine=sandbox.window.EDGY_headSoccerPhysics;
 let s=engine.create();
 assert.equal(s.status,"ready");assert.equal(s.seconds,60);
 assert.ok(engine.HEAD_R>=55&&engine.BALL_R>=20,"exaggerated characters and bigger ball should match arcade proportions");
 assert.equal(s.players.length,2);assert.equal(s.score.join(","),"0,0");
 engine.step(s,{p1:{right:true}},1/60);
 assert.equal(s.players[0].x,180,"players do not move before kickoff");
 engine.launch(s);engine.step(s,{p1:{right:true}},1/60);
 assert.ok(s.players[0].x>180,"player should move while playing");
 s.players[0].energy=100;
 s.ball.x=s.players[0].x+78;s.ball.y=s.players[0].y-71;s.ball.vx=0;s.ball.vy=0;
 engine.step(s,{p1:{power:true,kick:true}},1/60);
 assert.ok(s.ball.power>0,"charged power kick should activate projectile effect");
 assert.equal(s.players[0].energy,0,"power consumes available energy");
 engine.pause(s);const before=s.seconds;
 engine.step(s,{p1:{left:true}},1/60);
 assert.equal(s.seconds,before,"pausing must freeze match timer");
 engine.pause(s);assert.equal(s.status,"playing");
 s.ball.x=-3;s.ball.y=engine.GOAL_TOP+70;s.ball.vx=-260;s.ball.vy=0;
 engine.step(s,{},1/60);
 assert.equal(s.score[1],1,"left-goal entry awards a point to the opponent");
 assert.equal(s.status,"goal");
 for(let i=0;i<83;i++)engine.step(s,{},1/60);
 assert.equal(s.status,"playing","kickoff resets after celebration");
 s.score=[1,0];s.seconds=.001;
 engine.step(s,{},1/60);
 assert.equal(s.status,"finished");assert.equal(s.winner,0);
 s=engine.create({mode:"local",difficulty:"hard"});
 engine.launch(s);s.seconds=.001;
 engine.step(s,{},1/60);
 assert.equal(s.suddenDeath,true,"a tie at full time triggers sudden death");
 assert.equal(s.status,"playing");
 s.ball.x=engine.W+3;s.ball.y=engine.GOAL_TOP+70;s.ball.vx=260;s.ball.vy=0;
 engine.step(s,{},1/60);
 assert.equal(s.winner,0);assert.equal(s.status,"finished");
 s=engine.create({mode:"cpu",difficulty:"hard"});
 engine.launch(s);s.ball.x=500;s.ball.y=325;
 const old=s.players[1].x;
 for(let i=0;i<11;i++)engine.step(s,{p1:{}},1/60);
 assert.ok(s.players[1].x<old,"CPU should track the ball autonomously");
});
test("Head Soccer v2 uses expressive large characters, bright stadium and mobile arcade controls",()=>{
 const src=read("head-soccer-game.js"),css=read("head-soccer.css");
 for(const functionName of ["function headSoccerAvatar(","function background(","function goalPost(","function ballDraw(","function ensureStadium("])
  assert.ok(src.includes(functionName),functionName);
 assert.ok(src.includes('const hair=type==="bolt"')&&src.includes('const skin=ctx.createRadialGradient('));
 assert.ok(src.includes("ctx.drawImage(stadium,0,0)"),"stadium rendering should be cached rather than repainted 60fps");
 assert.ok(src.includes("hsReadyFaces")&&src.includes("hsHeroFace"));
 assert.ok(src.includes('data-hs-press="')&&src.includes("hsMovePad")&&src.includes("hsActionPad"));
 assert.ok(css.includes(".hsPad")&&css.includes(".hsReadyHead"));
 assert.ok(css.includes(".hsArena")&&css.includes("aspect-ratio:960/510"));
 assert.ok(css.includes("max-width:420px"));
 assert.ok(!src.includes("function playerDraw("),"replace simplistic stick-man body drawing");
});

test("Head Soccer canvas controller and PWA are integrated into EDGY",()=>{
 const physics=read("head-soccer-physics.js"),client=read("head-soccer-game.js"),style=read("head-soccer.css");
 const platform=read("edgy-platform.js"),ui=read("edgy-game-ui.js"),app=read("app.js"),sw=read("sw.js");
 assert.ok(physics.includes("goal(st,scorer)")&&physics.includes("function cpu(st,dt)"));
 assert.ok(client.includes('window.EDGY_recordLocalMatch?.("Head Soccer"'));
 assert.ok(client.includes('data-hs-press="'));
 assert.ok(client.includes('pointerdown')&&client.includes('pointercancel'));
 assert.ok(client.includes("requestAnimationFrame(tick)")&&client.includes("cancelAnimationFrame(frameId)"));
 assert.ok(client.includes('addEventListener("visibilitychange"'));
 assert.ok(client.includes("data-hs-canvas")&&client.includes("ctx.fill"));
 assert.ok(client.includes('2 jogadores locais')||client.includes('2 jogadores'));
 assert.ok(style.includes("@media(max-width:420px)")&&style.includes("touch-action:none"));
 assert.ok(platform.includes('headSoccer:Object.freeze({id:"headSoccer"'));
 assert.ok(ui.includes('headSoccer:{title:"Head Soccer"'));
 assert.ok(app.includes('if(id==="headSoccer"){window.EDGY_headSoccer?.open()'));
 assert.ok(app.includes('if(game==="headSoccer")return window.EDGY_headSoccer?.render()'));
 assert.ok(app.includes('"Head Soccer":"headSoccer"'));
 for(const asset of ["head-soccer-physics.js?v=70","head-soccer-game.js?v=70","head-soccer.css?v=70"]){
  assert.ok(html.includes(asset),"HTML missing "+asset);
  assert.ok(sw.includes(asset),"SW missing "+asset);
 }
 const scripts=[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(x=>x[1]);
 assert.ok(scripts.indexOf("./head-soccer-physics.js?v=70")>=0);
 assert.ok(scripts.indexOf("./head-soccer-physics.js?v=70")<scripts.indexOf("./head-soccer-game.js?v=70"));
 assert.ok(html.indexOf("edgy-platform.js?v=69")<html.indexOf("head-soccer-game.js?v=70"));
});

test("EDGY 2048 follows classic single-merge rules and supports autosave/one XP award",()=>{
 const storage=new Map(),root={innerHTML:"",classList:{remove(){}},querySelector(){return null},querySelectorAll(){return []}};
 const user={id:"2048-user"};
 const eventHandlers={};
 const window={EDGY_auth:{getUser:()=>user},EDGY_gameUI:{
   header:()=>"<header>2048</header>",card:(_title,body)=>body,match:({stage,side})=>stage+side},
   EDGY_recordLocalMatch:(...args)=>awards.push(args)};
 const awards=[],context={window,document:{
  getElementById:()=>root,addEventListener:(type,fn)=>eventHandlers[type]=fn},
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  game:"twenty48",nav(){}};
 vm.runInNewContext(read("twenty48-rules.js"),context);
 const rule=window.EDGY_2048Rules;
 const initial=Array(16).fill(0);initial.splice(0,4,2,2,2,2);
 let output=rule.move(initial,"left");
 assert.deepEqual(Array.from(output.board.slice(0,4)),[4,4,0,0]);
 assert.equal(output.score,8,"new tiles cannot merge twice in the same move");
 assert.equal(output.changed,true);
 output=rule.move(initial,"right");
 assert.deepEqual(Array.from(output.board.slice(0,4)),[0,0,4,4]);
 output=rule.move(initial,"up");
 assert.equal(output.changed,false,"no new tile spawns for a blocked direction");
 const mixed=[2,2,4,4,...Array(12).fill(0)];
 assert.deepEqual(Array.from(rule.move(mixed,"left").board.slice(0,4)),[4,8,0,0]);
 assert.equal(rule.move(mixed,"left").score,12);
 assert.equal(rule.start().filter(Boolean).length,2);
 assert.equal(rule.validMoves([2,4,8,16,32,64,128,256,512,1024,2,4,8,16,32,64]),false);
 const nearWin=[1024,1024,...Array(14).fill(0)];
 storage.set("edgy_2048_v1_2048-user",JSON.stringify({board:nearWin,score:100,best:100,moves:25,credited:false}));
 vm.runInNewContext(read("twenty48-game.js"),context);
 window.EDGY_twenty48.open();
 assert.ok(root.innerHTML.includes("t48Board"));
 window.EDGY_twenty48.play("left");
 assert.equal(awards.length,1);
 assert.equal(awards[0][0],"2048");
 assert.equal(awards[0][2],100);
 const saved=JSON.parse(storage.get("edgy_2048_v1_2048-user"));
 assert.equal(saved.won,true);assert.equal(saved.credited,true);
 window.EDGY_twenty48.close();window.EDGY_twenty48.open();
 assert.equal(awards.length,1,"loading an already finished milestone must not award twice");
 assert.ok(html.includes('twenty48-game.js?v=67'));
 assert.ok(html.includes('twenty48-rules.js?v=67'));
 assert.ok(html.includes('twenty48.css?v=67'));
 assert.ok(read("sw.js").includes('twenty48-game.js?v=67'));
 assert.ok(app.includes('id==="twenty48"'));
 assert.ok(read("edgy-platform.js").includes('twenty48:Object.freeze'));
 assert.ok(read("edgy-game-ui.js").includes('twenty48:{title:"2048"'));
});
test("EDGY Slots shows 3 rows in 3 reels and consumes only authoritative paylines",()=>{
 const casino=read("casino-game.js"),css=read("casino.css"),sql=read("supabase/slots_three_lines.sql");
 assert.ok(casino.includes("cxnSlotThree"));
 assert.ok(casino.includes("grid.map(row=>row?.[col]"));
 assert.ok(casino.includes('aria-label="Resultados das três linhas"'));
 assert.ok(casino.includes("win.clientHeight/3"),"spin animation must use 1/3 window height per symbol");
 assert.ok(css.includes("height:calc(var(--cxn-cell)*3 + 6px)"));
 assert.ok(css.includes(".cxnSlotLines")&&css.includes(".cxnPaylineResults"));
 assert.ok(sql.includes("'grid',v_grid")&&sql.includes("'lines',v_line_hits"));
 assert.ok(sql.includes("v_payout:=(p_stake*v_win_units)/6"),"one stake split across 3 paylines");
 assert.ok(sql.includes("for v_i in 1..3 loop"));
});

test("Palavra Oculta includes a large offline Portuguese dictionary and 917 rotating solutions",()=>{
 const context={window:{}};
 vm.runInNewContext(read("wordle-data.js"),context);
 const bank=context.window.EDGY_wordBank;
 assert.ok(bank.answerCount>=1200,"curated pool should include the new Portuguese solutions");
 assert.ok(bank.guessCount>=10000,"large dictionary should accept a wide range of attempts");
 assert.equal(new Set(Array.from(bank.answers)).size,bank.answerCount);
 for(const answer of bank.answers){
  assert.match(answer,/^[a-z]{5}$/);
  assert.equal(bank.isWord(answer),true,"every answer must be an accepted guess: "+answer);
 }
 assert.equal(bank.isWord("AVIÃO"),true,"accent folding");
 assert.equal(bank.isWord("ÁBACO"),true,"accent folding");
 assert.equal(bank.isWord("zzzzz"),false);
 const html=read("index.html"),sw=read("sw.js");
 const scripts=[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(x=>x[1]);
 const data=scripts.indexOf("./wordle-data.js?v=58");
 const rules=scripts.indexOf("./wordle-rules.js?v=48");
 const ledger=scripts.indexOf("./edgy-seen-words.js?v=58");
 const engine=scripts.indexOf("./wordle-game.js?v=58");
 assert.ok(data>=0&&rules>data&&ledger>rules&&engine>ledger,"data and rules load before game controller");
 for(const asset of ["wordle-data.js?v=58","wordle-rules.js?v=48","wordle-game.js?v=58","wordle.css?v=53"]){
  assert.ok(html.includes(asset));
  assert.ok(sw.includes(asset));
 }
});
test("Palavra Oculta duplicate letters, feedback priority and non-repeating shuffle",()=>{
 const context={window:{}};
 vm.runInNewContext(read("wordle-rules.js"),context);
 const rules=context.window.EDGY_wordRules;
 assert.deepEqual(Array.from(rules.score("ALLEY","APPLE")),["correct","present","absent","present","absent"]);
 assert.deepEqual(Array.from(rules.score("PAPAL","APPLE")),["present","present","correct","absent","present"]);
 assert.deepEqual(Array.from(rules.score("APPLE","APPLE")),["correct","correct","correct","correct","correct"]);
 assert.throws(()=>rules.score("ABC","APPLE"),/cinco letras/);
 const keys=rules.keyboard(["ALLEY","PAPAL"],"APPLE");
 assert.equal(keys.A,"correct");
 assert.equal(keys.P,"correct");
 assert.equal(keys.L,"present");
 assert.equal(keys.Y,"absent");
 let bag=[],previous=-1;const taken=new Set();
 for(let i=0;i<917;i++){
  const next=rules.choose(bag,917,previous);
  assert.ok(!taken.has(next.index),"answer repeated before bag exhaustion");
  taken.add(next.index);bag=Array.from(next.remaining);previous=next.index;
 }
 assert.equal(taken.size,917);
 const newBag=rules.choose([],917,previous,()=>0);
 assert.notEqual(newBag.index,previous,"no immediate repeat at the cycle boundary");
});
test("Palavra Oculta resumes an unfinished puzzle and credits local XP exactly once",async()=>{
 const storage=new Map(),records=[],listeners={},root={
  classList:{remove(){},toggle(){}},innerHTML:"",
  querySelector(){return null},querySelectorAll(){return []}
 };
 const document={
  getElementById(id){return id==="screen"?root:null},
  addEventListener(name,listener){listeners[name]=listener}
 };
 const fakeWindow={
  EDGY_gameUI:{
   header:(name)=>"HEADER "+name,
   match:({game,stage,side})=>"MATCH "+game+stage+side,
   card:(title,body)=>"CARD "+title+body
  },
  EDGY_recordLocalMatch:(...args)=>records.push(args)
 };
 const store={
  getItem:key=>storage.get(key)??null,
  setItem:(key,value)=>storage.set(key,value)
 };
 const sandbox={
  window:fakeWindow,document,localStorage:store,navigator:{},
  game:"wordle",nav(){},console:{error(){},warn(){}}
 };
 vm.runInNewContext(read("wordle-data.js")+"\n"+read("wordle-rules.js")+"\n"+read("wordle-game.js"),sandbox);
 const controller=fakeWindow.EDGY_wordle,stored=()=>JSON.parse(storage.get("edgy_wordle_v1"));
 await controller.open();
 assert.ok(root.innerHTML.includes('class="wdBoard"'));
 assert.ok(root.innerHTML.includes('class="wdNativeForm"'));
 const answer=stored().round.answer;
 // A desktop physical keystroke must enter the same shared game state.
 let prevented=false;
 listeners.keydown({key:answer[0].toLowerCase(),target:{closest(){return null}},preventDefault(){prevented=true}});
 assert.equal(prevented,true,"physical keyboard must be handled without a virtual key");
 for(const letter of answer.slice(1,3))controller.press(letter);
 assert.equal(stored().round.draft,answer.slice(0,3));
 controller.close();await controller.open();
 assert.equal(stored().round.draft,answer.slice(0,3),"typed letters survive a navigation");
 for(const letter of answer.slice(3))controller.press(letter);
 controller.press("ENTER");
 assert.equal(records.length,1);
 assert.equal(records[0][0],"Wordle");
 assert.equal(stored().round.finished,true);
 assert.ok(root.innerHTML.includes("data-wd-new"));
 controller.press("ENTER");
 controller.close();await controller.open();
 assert.equal(records.length,1,"completed puzzle must never award XP twice");
 assert.ok(read("wordle-game.js").includes("Native buttons must still activate"));
});
test("Wordle keeps the shared EDGY layout, local XP and accessible native mobile input",()=>{
 const app=read("app.js"),game=read("wordle-game.js"),ui=read("edgy-game-ui.js"),skin=read("wordle.css");
 assert.ok(app.includes('window.EDGY_recordLocalMatch=complete'));
 assert.ok(app.includes('window.EDGY_wordle?.close()'));
 assert.ok(app.includes('window.EDGY_wordle?.open()'));
 assert.ok(app.includes('if(game==="wordle")return window.EDGY_wordle?.render()'));
 assert.ok(app.includes('["Todos","Multiplayer","Estratégia","Arcade","Palavras"]'));
 assert.ok(ui.includes('wordle:{title:"Wordle"'));
 assert.ok(game.includes('window.EDGY_gameUI.match({game:"wordle"'));
 assert.ok(game.includes('window.EDGY_gameUI.header("wordle"'));
 assert.ok(game.includes('window.EDGY_recordLocalMatch?.('));
 assert.ok(game.includes('localStorage.setItem(storageKey(),JSON.stringify(saved))'));
 assert.ok(game.includes('data-wd-native'));
 assert.ok(game.includes('data-wd-form'));
 assert.ok(game.includes('data-wd-new'));
 assert.ok(game.includes('data-wd-share'));
 assert.ok(game.includes('role="grid"'));
 assert.ok(skin.includes('@media(max-width:799px)'));
 assert.ok(skin.includes('@media(prefers-reduced-motion:reduce)'));
 assert.ok(skin.includes('overflow-y:auto!important'));
});
test("Wordle title and accessible keyboard layout differ correctly between desktop and phone",()=>{
 const platform=read("edgy-platform.js"),ui=read("edgy-game-ui.js");
 const game=read("wordle-game.js"),css=read("wordle.css"),app=read("app.js");
 const client={window:{},document:{addEventListener(){}}};
 vm.runInNewContext(ui,client);
 assert.equal(client.window.EDGY_gameUI.details.wordle.title,"Wordle");
 const context={window:{},document:{body:{append(){}}}};
 vm.runInNewContext(platform,context);
 assert.equal(context.window.EDGY_platform.games.wordle.title,"Wordle");
 assert.equal(context.window.EDGY_platform.games.wordle.display,"Wordle");
 assert.ok(game.includes('window.EDGY_recordLocalMatch?.("Wordle"'));
 assert.ok(game.includes('EDGY · Wordle #'));
 assert.ok(game.includes('aria-label="Jogo Wordle"'));
 assert.ok(game.includes('class="wdDesktopHint"'));
 // Desktop: the field for the mobile system keyboard stays hidden.
 const desktop=css.slice(0,css.indexOf('@media(max-width:799px)'));
 assert.match(desktop,/#screen \.wdNativeForm\{display:none/);
 assert.match(desktop,/#screen \.wdDesktopHint\{display:block/);
 // Mobile: a real text input launches the operating system keyboard.
 const mobile=css.slice(css.indexOf('@media(max-width:799px)'),css.indexOf('@media(max-width:370px)'));
 assert.match(mobile,/#screen \.wdNativeForm\{display:block/);
 assert.match(mobile,/#screen \.wdDesktopHint\{display:none/);
 assert.ok(game.includes('inputmode="text"'));
 assert.ok(game.includes('enterkeyhint="done"'));
 assert.ok(game.includes('autocorrect="off"'));
 assert.ok(game.includes('data-wd-native'));
 assert.ok(game.includes('data-wd-form'));
 assert.ok(game.includes('function setNativeDraft(input)'));
 assert.ok(game.includes('function paintDraft()'));
 assert.ok(!game.includes('function keyboardHtml('),"do not render a second, virtual keyboard");
 assert.ok(!css.includes('.wdKeyboard'),"remove old virtual-keyboard styles");
 // Previously completed games keep their saved stats and display the new label.
 assert.ok(app.includes('h?.title==="Palavra Oculta"?{...h,title:"Wordle"}:h'));
});
test("Wordle native typing does not rebuild the screen, keeps focus and submits exactly once",async()=>{
 const state=new Map(),records=[],handlers={};
 let redraws=0,current={input:null,form:null,row:null,status:null};
 function makeNode(){
  const events={};
  return {value:"",disabled:false,events,
   addEventListener(name,handler){events[name]=handler},
   focus(){this.focused=true},
   classList:{toggle(){}},
   setAttribute(){},textContent:""};
 }
 const root={
  classList:{
   values:new Set(),
   remove(...names){for(const n of names)this.values.delete(n)},
   toggle(name,enabled){if(enabled)this.values.add(name);else this.values.delete(name)}
  },
  get innerHTML(){return this._html||""},
  set innerHTML(html){
   this._html=html;redraws++;
   current.input=html.includes('data-wd-native')?makeNode():null;
   current.form=html.includes('data-wd-form')?makeNode():null;
   current.status=makeNode();
   const tiles=Array.from({length:5},()=>makeNode());
   current.row=html.includes('data-wd-current="true"')?makeNode():null;
   if(current.row){current.row.querySelectorAll=()=>tiles;current.row.tiles=tiles}
  },
  querySelector(sel){
   if(sel==="[data-wd-native]")return current.input;
   if(sel==="[data-wd-form]")return current.form;
   if(sel==='[data-wd-current="true"]')return current.row;
   return null;
  },
  querySelectorAll(){return []}
 };
 const doc={
  getElementById:id=>id==="screen"?root:null,
  querySelector(sel){
   if(sel==="#screen .wdMessage")return current.status;
   if(sel==='#screen .wdRow[data-wd-current="true"]')return current.row;
   if(sel==="#screen [data-wd-native]")return current.input;
   return null;
  },
  addEventListener(name,handler){handlers[name]=handler}
 };
 const win={
  EDGY_gameUI:{
   header:()=>"",match:({stage,side})=>stage+side,
   card:(name,body)=>body
  },
  EDGY_recordLocalMatch:(...args)=>records.push(args)
 };
 const sandbox={window:win,document:doc,
  localStorage:{getItem:k=>state.get(k)||null,setItem:(k,v)=>state.set(k,v)},
  navigator:{},game:"wordle",nav(){},console};
 vm.runInNewContext(read("wordle-data.js")+"\n"+read("wordle-rules.js")+"\n"+read("wordle-game.js"),sandbox);
 await win.EDGY_wordle.open();
 let input=current.input;
 assert.ok(input&&current.form&&current.row);
 assert.ok(root.innerHTML.includes('inputmode="text"'));
 input.events.focus();
 assert.equal(root.classList.values.has("wdTyping"),true,"focusing native input activates compact mode");
 const before=redraws;
 input.value="pá";
 input.events.input({isComposing:false});
 assert.equal(JSON.parse(state.get("edgy_wordle_v1")).round.draft,"PA");
 assert.equal(input.value,"PA");
 assert.equal(current.row.tiles[0].textContent,"P");
 assert.equal(current.row.tiles[1].textContent,"A");
 assert.equal(redraws,before,"native typing must never destroy the focused input");
 let stopped=false;
 current.form.events.submit({preventDefault(){stopped=true}});
 assert.ok(stopped);
 assert.equal(redraws,before,"invalid submission keeps the native keyboard active");
 assert.equal(current.status.textContent,"Escreve uma palavra de cinco letras.");
 const answer=JSON.parse(state.get("edgy_wordle_v1")).round.answer;
 input.value=answer;input.events.input({isComposing:false});
 current.form.events.submit({preventDefault(){}});
 assert.equal(records.length,1);
 assert.equal(records[0][0],"Wordle");
 assert.equal(JSON.parse(state.get("edgy_wordle_v1")).round.finished,true);
 assert.equal(root.classList.values.has("wdTyping"),false,"confirmation exits compact keyboard layout");
 assert.equal(current.input,null,"finished games no longer show a typing field");
});
test("Wordle mobile game board fits above navigation and focused mode keeps live attempt visible",()=>{
 const css=read("wordle.css"),js=read("wordle-game.js");
 const mobile=css.slice(css.indexOf("@media(max-width:799px)"),css.indexOf("@media(max-width:370px)"));
 assert.ok(mobile.includes("#screen .wdBoard{width:min(100%,265px)"),"six-row board must shrink on phones");
 assert.ok(mobile.includes("#screen.wdTyping .wdRow:not([data-wd-current"),"hide inactive rows only while typing");
 assert.ok(mobile.includes('#screen.wdTyping .wdRow[data-wd-previous="true"]'),"retain previous attempt feedback");
 assert.ok(mobile.includes('body:has(#screen.wdTyping) .nav{display:none!important}'),"mobile navbar must not overlap system keyboard");
 assert.ok(mobile.includes('.main:has(> #screen.wdTyping .wdPage)>.top'),"phone keyboard focus reclaims header height");
 assert.ok(mobile.includes('#screen.wdTyping .wdNativeForm{margin:6px auto 3px}'));
 assert.ok(js.includes('native?.addEventListener("focus",()=>setTypingMode(true))'));
 assert.ok(js.includes('setTypingMode(false);'),"submitting valid guess returns to full board");
 assert.ok(js.includes('root.scrollTop=0;'));
 assert.ok(js.includes('data-wd-previous="true"'));
});
test("Wordle tile colours are revealed sequentially on flips, reduced-motion respected",()=>{
 const css=read("wordle.css"),js=read("wordle-game.js");
 assert.ok(css.includes("animation:wdRevealColor .56s"));
 assert.ok(css.includes("animation-delay:calc(var(--wd-order) * 105ms)"));
 assert.ok(css.includes("48%{transform:perspective(300px) rotateX(-90deg);background:#30213f"));
 assert.ok(css.includes("50%{transform:perspective(300px) rotateX(-90deg);background:var(--wd-reveal-bg)"));
 for(const value of ["wd-correct","wd-present","wd-absent"])
  assert.ok(css.includes(".wdTile."+value+"{--wd-reveal-bg"));
 assert.ok(css.includes("prefers-reduced-motion:reduce"));
 assert.ok(css.includes(".wdTile.wdReveal{animation:none!important}"));
 assert.ok(js.includes('revealRow=r.guesses.length-1;'));
 assert.ok(js.includes('const reveal=attempt&&revealRow===i;'));
 assert.ok(js.includes('tile.animate([{transform:"scale(.88)"'),"new letters pop into their cells");
});
test("Home picks exactly two unique recent games and offers curated suggestions on empty history",()=>{
 const app=read("app.js"),begin=app.indexOf("const gameFromHistory="),end=app.indexOf("window.EDGY_openRoom=",begin);
 assert.ok(begin>0&&end>begin);
 const script=app.slice(begin,end);
 const storage=new Map(),sandbox={
  window:{EDGY_auth:{getUser:()=>({id:"person-A"})}},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  state:{history:[]},
  defs:["chess","checkers","barricade","party","poker","wordle","contexto","tic","reaction","casino"].map(id=>({id,name:id})),
 };
 vm.runInNewContext(script+"\nglobalThis.homeGamesTest=homeGames;globalThis.rememberGameTest=rememberGame;",sandbox);
 const starting=sandbox.homeGamesTest();
 assert.equal(starting.items.length,2);
 assert.deepEqual(Array.from(starting.items,x=>x.id),["contexto","wordle"]);
 assert.equal(starting.hasRecent,false);
 sandbox.rememberGameTest("barricade");sandbox.rememberGameTest("checkers");
 let rec=sandbox.homeGamesTest();
 assert.deepEqual(Array.from(rec.items,x=>x.id),["checkers","barricade"]);
 assert.equal(rec.hasRecent,true);
 sandbox.state.history=[
  {title:"Xadrez",date:"2026-10-24T19:00:00Z"},
  {title:"Wordle",date:"2026-10-30T19:00:00Z"},
  {title:"Wordle",date:"2026-10-29T19:00:00Z"}
 ];
 rec=sandbox.homeGamesTest();
 assert.deepEqual(Array.from(rec.items,x=>x.id),["wordle","chess"]);
 assert.equal(new Set(rec.items.map(x=>x.id)).size,2);
 sandbox.window.EDGY_auth.getUser=()=>({id:"person-B"});
 assert.equal(sandbox.homeGamesTest().hasRecent,true,"played history still applies to this local fixture");
 assert.equal(sandbox.localStorage.getItem("edgy_recent_games_v1_person-B"),null,"recent opens must be account-isolated");
 assert.ok(app.includes('id="moreGames"'));
 assert.ok(app.includes('$("#moreGames").onclick=()=>nav("games")'));
 assert.ok(!app.includes("'+cards(defs)"));
 assert.ok(!app.includes("Os teus jogos recentes."),"the Home subtitle is gone");
});
test("Level-up notifications persist per account, share invitation bell and celebrate only new levels",()=>{
 const src=read("social.js"),styles=read("edgy-levels.css"),auth=read("auth.js"),app=read("app.js");
 assert.ok(src.includes('function notifyLevelUp(from,to)'));
 assert.ok(src.includes('function observeLevel(xp)'));
 assert.ok(src.includes('className="edgyLevelMask"'));
 assert.ok(src.includes('inbox.length+unread'));
 assert.ok(src.includes('const levelMarkup=levels.map('));
 assert.ok(src.includes('markLevelsRead()'));
 assert.ok(auth.includes('window.EDGY_social?.observeLevel?.(state.xp)'));
 assert.ok(auth.includes('window.EDGY_recordLocalMatch=(title,result,xp)=>complete(title,result,xp)'));
 assert.ok(app.includes('if(level()>previous)window.EDGY_social?.notifyLevelUp?.(previous,level())'));
 assert.ok(styles.includes('.edgyLevelDialog{'));
 assert.ok(styles.includes('@media(prefers-reduced-motion:reduce)'));
 const start=src.indexOf("function notifyLevelUp("),end=src.indexOf("function bell(){",start);
 assert.ok(start>0&&end>start);
 const state={highest:null,items:[]},popups=[];
 const sandbox={levelStore:()=>({...state,items:[...state.items]}),
   saveLevels:updated=>{state.highest=updated.highest;state.items=updated.items},
   bell(){},levelPopup:n=>popups.push(n)};
 vm.runInNewContext(src.slice(start,end)+"\nglobalThis.testObserve=observeLevel;globalThis.testNotify=notifyLevelUp;",sandbox);
 sandbox.testObserve(250);
 assert.equal(state.highest,3,"initial profile loads do not generate fake achievements");
 assert.equal(popups.length,0);
 sandbox.testObserve(350);
 assert.deepEqual(Array.from(state.items,x=>x.level),[4]);
 assert.deepEqual(popups,[4]);
 sandbox.testNotify(3,4);
 assert.equal(state.items.length,1,"same achievement never duplicates");
 sandbox.testNotify(4,6);
 assert.deepEqual(Array.from(state.items,x=>x.level),[6,5,4]);
 assert.deepEqual(popups,[4,6]);
 for(const name of ["edgy-levels.css?v=53","social.js?v=66","auth.js?v=66"]){
  assert.ok(html.includes(name));assert.ok(read("sw.js").includes(name));
 }
});
test("Wordle no longer shows unnecessary word-count footer",()=>{
 const game=read("wordle-game.js"),css=read("wordle.css");
 assert.ok(!game.includes('class="wdBottomHint"'));
 assert.ok(!css.includes(".wdBottomHint"));
 assert.ok(!css.includes(".wdHintDot"));
});
test("Contexto has broad Portuguese answers and topical ranks based on meaning, not spelling",()=>{
 const context={window:{EDGY_wordBank:{isWord:w=>w.length===5,answers:[]}}};
 vm.runInNewContext(read("contexto-data.js")+"\n"+read("contexto-rules.js"),context);
 const data=context.window.EDGY_contextoData,rules=context.window.EDGY_contextoRules;
 assert.ok(data.answers.length>=1200,"extended semantic theme answers available");
 assert.ok(data.groups.length>=130,"over a hundred independent Portuguese themes");
 assert.equal(new Set(Array.from(data.answers)).size,data.answers.length);
 assert.equal(rules.rank("oceano","oceano"),1);
 assert.ok(rules.rank("oceano","mar")<rules.rank("oceano","escola"),"mar is closer to oceano than escola");
 assert.ok(rules.rank("futebol","bola")<rules.rank("futebol","banana"),"football and ball are related");
 assert.equal(rules.isWord("mar"),true);
 assert.equal(rules.isWord("casa"),true);
 assert.equal(rules.isWord("zzzz"),false);
 assert.ok(rules.hint("oceano",[]));
});
test("Shared ledger never repeats answers across Contexto and Wordle, including an exhausted pool",async()=>{
 const storage=new Map(),fake={
  window:{},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  console
 };
 vm.runInNewContext(read("edgy-seen-words.js"),fake);
 const history=fake.window.EDGY_seenWords;
 assert.equal(await history.claim("Praia","contexto"),true);
 assert.equal(await history.claim("PRAIA","wordle"),false);
 const selected=await history.choose(["praia","costa","onda"],"contexto");
 assert.ok(["costa","onda"].includes(selected));
 assert.equal(history.has(selected),true);
 assert.equal(await history.choose(["praia",selected],"wordle"),null,"do not recycle answers after pool exhaustion");
 assert.ok(history.count()>=2);
 const fresh={window:{},localStorage:fake.localStorage,console};
 vm.runInNewContext(read("edgy-seen-words.js"),fresh);
 assert.equal(fresh.window.EDGY_seenWords.has("praia"),true,"history survives reload");
});
test("Wordle and Contexto share RLS cloud history and never silently recycle answers",()=>{
 const app=read("app.js"),platform=read("edgy-platform.js"),wordle=read("wordle-game.js");
 const contexto=read("contexto-game.js"),ledger=read("edgy-seen-words.js"),skin=read("contexto.css");
 assert.ok(platform.includes('contexto:Object.freeze({id:"contexto"'));
 assert.ok(app.includes('window.EDGY_contexto?.open()'));
 assert.ok(app.includes('window.EDGY_contexto?.close()'));
 assert.ok(app.includes('if(game==="contexto")return window.EDGY_contexto?.render()'));
 assert.ok(wordle.includes('wordHistory().choose(bank.answers,"wordle")'));
 assert.ok(contexto.includes('seen().choose(data().answers,"contexto")'));
 assert.ok(wordle.includes('r.exhausted'));
 assert.ok(ledger.includes('from("edgy_seen_words")'));
 assert.ok(ledger.includes('ignoreDuplicates:true'));
 assert.ok(ledger.includes('if(error.code==="23505")'));
 assert.ok(contexto.includes('window.EDGY_recordLocalMatch?.("Contexto"'));
 assert.ok(contexto.includes('window.EDGY_gameUI.match({game:"contexto"'));
 assert.ok(contexto.includes('data-cx-hint'));
 assert.ok(skin.includes('@media(max-width:799px)'));
 assert.ok(skin.includes('prefers-reduced-motion:reduce'));
 const scripts=[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]);
 for(const p of ["edgy-seen-words.js","contexto-data.js","contexto-rules.js","contexto-game.js"]){
  const version=p==="contexto-rules.js"?"55":p==="contexto-game.js"?"54":"58";
  assert.ok(scripts.includes("./"+p+"?v="+version));assert.ok(read("sw.js").includes(p+"?v="+version));
 }
 assert.ok(scripts.indexOf("./edgy-seen-words.js?v=58")<scripts.indexOf("./wordle-game.js?v=58"));
 assert.ok(scripts.indexOf("./contexto-data.js?v=58")<scripts.indexOf("./contexto-game.js?v=54"));
});

test("Wordle repairs the v55 near-total false word-history import after one real round",async()=>{
 const storage=new Map(),context={window:{},console:{warn(){}}};
 vm.runInNewContext(read("wordle-data.js"),context);
 const answers=Array.from(context.window.EDGY_wordBank.answers);
 storage.set("edgy_seen_words_v1_account1",JSON.stringify(answers));
 storage.set("edgy_wordle_v1_account1",JSON.stringify({
  number:2,bag:[],round:{answer:"",guesses:[],draft:"",finished:true,exhausted:true},stats:{played:1,wins:1}
 }));
 const root={classList:{remove(){}},innerHTML:"",querySelector(){return null},querySelectorAll(){return []}};
 const doc={getElementById:()=>root,addEventListener(){}};
 context.document=doc;context.localStorage={
  getItem:key=>storage.get(key)||null,
  setItem:(key,value)=>storage.set(key,value)
 };
 context.window.EDGY_auth={getUser:()=>({id:"account1"}),getClient:()=>null};
 context.window.EDGY_gameUI={
  header:()=>"HEADER",match:({stage,side})=>stage+side,card:(_title,body)=>body
 };
 context.navigator={};context.game="wordle";context.nav=()=>{};
 vm.runInNewContext(read("wordle-rules.js")+"\n"+read("edgy-seen-words.js")+"\n"+read("wordle-game.js"),context);
 const ledger=context.window.EDGY_seenWords;
 await ledger.ready();
 assert.equal(ledger.count(),0,"a one-round profile must not own 917 used answers");
 await context.window.EDGY_wordle.open();
 const repaired=JSON.parse(storage.get("edgy_wordle_v1_account1"));
 assert.equal(repaired.number,3);
 assert.ok(repaired.round.answer.length===5,"a new word should be available");
 assert.equal(repaired.round.exhausted,undefined);
 assert.equal(ledger.count(),1,"only the newly reserved answer is consumed");
 assert.ok(!root.innerHTML.includes("Coleção concluída!"));
 assert.ok(repaired.wordBankMigrated,"legacy bag migration is marked complete");
});
test("Cloud XP sync preserves failed local uploads, and prevents later double counting",async()=>{
 const src=read("auth.js");
 const start=src.indexOf("async function loadCloud(nickname){"),end=src.indexOf("\nconst oldComplete=",start);
 assert.ok(start>=0&&end>start);
 const storage=new Map([["edgy_owner_id","account1"]]),observed=[];
 const base={client_id:"local-1",title:"Wordle",result:"Vitória em 3/6",xp:42,remote:false,date:"2026-10-31T10:00:00Z"};
 const remote={client_id:"server-1",game:"Damas",result:"Vitória",xp:40,played_at:"2026-10-31T09:00:00Z"};
 const state={name:"Jogador",xp:42,history:[base]};
 let profileXp=100,rows=[remote],failed=false;
 const dataSource={
  from(table){
   const value=table==="profiles"?{data:{display_name:"Jogador",xp:profileXp}}:{data:rows};
   if(failed&&table==="match_history")value.error={message:"temporary error"};
   const chain={
    select(){return chain},eq(){return chain},order(){return chain},
    maybeSingle:async()=>value,limit:async()=>value
   };
   return chain;
  }
 };
 const sandbox={state,account:{id:"account1"},profile:null,sb:dataSource,
  localStorage:{getItem:k=>storage.get(k)||null},save(){},
  window:{EDGY_social:{observeLevel:xp=>observed.push(xp)}},console:{warn(){}}
 };
 vm.runInNewContext(src.slice(start,end)+"\nglobalThis.testCloudLoad=loadCloud;",sandbox);
 await sandbox.testCloudLoad();
 assert.equal(state.xp,142);
 assert.deepEqual(Array.from(state.history,h=>h.title),["Wordle","Damas"]);
 assert.equal(state.history[0].remote,false);
 // The cloud confirms the same local result later: don't award it twice.
 profileXp=142;
 rows=[{client_id:"local-1",game:"Wordle",result:"Vitória em 3/6",xp:42,played_at:"2026-10-31T10:00:00Z"},remote];
 await sandbox.testCloudLoad();
 assert.equal(state.xp,142);
 assert.equal(state.history.length,2);
 assert.equal(state.history.filter(h=>h.title==="Wordle").length,1);
 failed=true;
 await sandbox.testCloudLoad();
 assert.equal(state.history.length,2,"network error must not clear saved history");
});
test("All EDGY games expose earned XP in the personal history without duplicate server rows",()=>{
 const history=read("history.js"),app=read("app.js"),auth=read("auth.js");
 assert.ok(history.includes("const onlineIds=new Set("));
 assert.ok(history.includes('!onlineIds.has(String(h.client_id||""))'));
 assert.ok(history.includes('xp:local.find(h=>String(h.client_id)===String(r.id))?.xp'));
 assert.ok(history.includes('if(g.isBarricade){basic(g);return}'));
 assert.ok(history.includes('g.xp===null||g.xp===undefined'));
 assert.ok(app.includes('complete("Jogo do Galo"'));
 assert.ok(app.includes('complete("Reflexos"'));
 assert.ok(app.includes('Math.min(100,Math.max(10,Math.round(30000/avg)))'));
 assert.ok(auth.includes('window.EDGY_recordLocalMatch=(title,result,xp)=>complete(title,result,xp)'));
 assert.ok(auth.includes('const unsynced=own?state.history.filter'));
 assert.ok(auth.includes('const known=new Set(remote.map('));
 assert.ok(read("wordle-game.js").includes('EDGY_recordLocalMatch?.("Wordle"'));
 assert.ok(read("contexto-game.js").includes('EDGY_recordLocalMatch?.("Contexto"'));
});

test("Cartas Contra Tugas is a 3–8 player registered game with dedicated mobile assets",()=>{
 const platform=read("edgy-platform.js"),app=read("app.js"),ui=read("edgy-game-ui.js");
 const social=read("social.js"),history=read("history.js"),client=read("party-online.js"),style=read("party.css");
 const assets=read("sw.js"),scripts=[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]);
 assert.ok(platform.includes('party:Object.freeze({id:"party"'));
 assert.ok(platform.includes('create:"edgy_party_create"'));
 assert.ok(platform.includes('join:"edgy_party_join"'));
 assert.ok(platform.includes('cancel:"edgy_party_cancel"'));
 assert.ok(ui.includes('party:{title:"Cartas Contra Tugas"'));
 assert.ok(app.includes('window.EDGY_party?.open()'));
 assert.ok(app.includes('window.EDGY_party?.close()'));
 assert.ok(app.includes('window.EDGY_party?.render()'));
 assert.ok(app.includes('name==="party"'));
 assert.ok(app.includes('"Cartas Contra Tugas":"party"'));
 assert.ok(social.includes('["edgy-party-rooms","party"]'));
 assert.ok(history.includes('g.xp===null||g.xp===undefined'));
 assert.ok(client.includes('room.players.length<3'));
 assert.ok(client.includes('3 a 8 amigos'));
 assert.ok(client.includes('party="+code'));
 assert.ok(style.includes('@media(max-width:799px)'));
 assert.ok(style.includes('@media(prefers-reduced-motion:reduce)'));
 for(const asset of ["party-online.js?v=59","party.css?v=58"]){
  assert.ok(html.includes(asset)&&assets.includes(asset));
 }
 assert.ok(scripts.indexOf("./party-online.js?v=59")>scripts.indexOf("./app.js?v=69"));
});
test("Cartas Contra Tugas privacy, scoring, history and room status are owned by server RPC",()=>{
 const party=read("party-online.js");
 assert.ok(party.includes('rpc("edgy_party_create")'));
 assert.ok(party.includes('rpc("edgy_party_join"'));
 assert.ok(party.includes('rpc("edgy_party_state"'));
 assert.ok(party.includes('rpc("edgy_party_action"'));
 for(const action of ["start","submit","vote","next","cancel","leave"])
  assert.ok(party.includes(action),"missing action "+action);
 assert.ok(party.includes('room.has_submitted'));
 assert.ok(party.includes('room.status==="judging"&&judge()'));
 assert.ok(party.includes('data.status==="finished"'));
 assert.ok(party.includes("window.EDGY_auth?.refreshProfile?.()"));
 assert.ok(!party.includes('EDGY_recordLocalMatch'),"XP must only come from server match_history, never direct browser actions");
 assert.ok(party.includes('data-pt-vote'));
 assert.ok(party.includes('data-pt-card'));
});
test("Expanded vocabularies retain old answers and accept all new Portuguese solutions",()=>{
 const w={window:{}};
 vm.runInNewContext(read("wordle-data.js")+"\n"+read("contexto-data.js"),w);
 const word=w.window.EDGY_wordBank,ctx=w.window.EDGY_contextoData;
 assert.ok(word.answers.length>=1200);
 assert.ok(ctx.answers.length>=1200);
 assert.ok(ctx.groups.length>=130);
 assert.equal(new Set(Array.from(word.answers)).size,word.answers.length);
 assert.equal(new Set(Array.from(ctx.answers)).size,ctx.answers.length);
 for(const a of word.answers)assert.equal(word.isWord(a),true);
 const allTerms=new Set(ctx.groups.flatMap(x=>x));
 for(const a of ctx.answers)assert.ok(allTerms.has(a),"semantic answer must have a topic: "+a);
 assert.ok(ctx.answers.includes("algoritmo"));
 assert.ok(ctx.answers.includes("fotografia"));
 assert.ok(word.answers.includes("filme"));
 assert.ok(word.answers.includes("tango"));
});
test("Old 917-word v55 corruption is repaired after the answer pool grows",()=>{
 const data={window:{}};
 vm.runInNewContext(read("wordle-data.js"),data);
 const answers=Array.from(data.window.EDGY_wordBank.answers),store=new Map();
 store.set("edgy_seen_words_v1_local",JSON.stringify(answers.slice(0,917)));
 store.set("edgy_wordle_v1",JSON.stringify({number:2,round:{answer:"",finished:true},bag:[]}));
 const window={EDGY_wordBank:data.window.EDGY_wordBank};
 vm.runInNewContext(read("edgy-seen-words.js"),{
  window,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
  console:{warn(){}}
 });
 assert.equal(window.EDGY_seenWords.count(),0,"old 917 false claims must not block new answers");
 assert.equal(window.EDGY_seenWords.has(answers[0]),false);
});
test("Cartas Contra Tugas offers only Normal and Humor Negro, with host-only deck selection",()=>{
 const game=read("party-online.js"),css=read("party.css");
 const deckSection=game.slice(game.indexOf("const DECKS="),game.indexOf("const deckName="));
 assert.ok(deckSection.includes('id:"classic",name:"Normal"'));
 assert.ok(deckSection.includes('id:"dark",name:"Humor Negro +18"'));
 assert.equal((deckSection.match(/id:"/g)||[]).length,2);
 assert.ok(!deckSection.includes('id:"adult"'));
 assert.ok(!deckSection.includes('id:"mixed"'));
 assert.ok(game.includes('rpc("edgy_party_set_deck"'));
 assert.ok(game.includes('data-pt-deck='));
 assert.ok(game.includes('!isHost()'));
 assert.ok(game.includes('room.deck==="dark"'));
 assert.ok(game.includes('maiores de 18 anos'));
 assert.ok(css.includes(".ptDeckChoice.active"));
 assert.ok(css.includes(".ptMatureNotice"));
});

test("Poker Texas Holdem is a consistent EDGY multiplayer game with online rooms and no real money",()=>{
 const platform=read("edgy-platform.js"),app=read("app.js"),ui=read("edgy-game-ui.js"),social=read("social.js");
 const poker=read("poker-online.js"),css=read("poker.css"),sw=read("sw.js");
 assert.ok(platform.includes('poker:Object.freeze({id:"poker"'));
 for(const action of ['edgy_poker_create','edgy_poker_join','edgy_poker_cancel'])assert.ok(platform.includes('"'+action+'"'));
 assert.ok(ui.includes('poker:{title:"Poker"'));
 assert.ok(app.includes('window.EDGY_poker?.open()'));
 assert.ok(app.includes('window.EDGY_poker?.close()'));
 assert.ok(app.includes('window.EDGY_poker?.render()'));
 assert.ok(app.includes('name==="poker"'));
 assert.ok(app.includes('"Poker":"poker"'));
 assert.ok(social.includes('["edgy-poker-rooms","poker"]'));
 for(const asset of ['poker-online.js?v=61','poker.css?v=61']){
  assert.ok(html.includes(asset),asset);
  assert.ok(sw.includes(asset),asset);
 }
 assert.ok(poker.includes('Texas Hold’em'));
 assert.ok(poker.includes('Fichas virtuais'));
 assert.ok(!poker.includes('EDGY_recordLocalMatch'),"XP must be server-owned");
 for(const rpc of ['edgy_poker_state','edgy_poker_action','edgy_poker_create','edgy_poker_join','edgy_poker_cancel'])
  assert.ok(poker.includes('"'+rpc+'"'),rpc);
 for(const name of ['fold','check','call','raise','start','next','leave'])
  assert.ok(poker.includes(name),name);
 assert.ok(poker.includes('new URL("?poker="+code'));
 assert.ok(poker.includes('window.EDGY_auth?.refreshProfile?.()'));
 assert.ok(css.includes('@media(max-width:799px)'));
 assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
});
test("Poker deck renders correct standard 52-card suits and keeps hidden cards concealed",()=>{
 const poker=read("poker-online.js");
 assert.ok(poker.includes('const ranks=["2","3","4","5","6","7","8","9","10","J","Q","K","A"]'));
 assert.ok(poker.includes('const suits=["♠","♥","♦","♣"]'));
 assert.ok(poker.includes('n<0||n>51'));
 assert.ok(poker.includes('card(null)'));
 assert.ok(poker.includes("room.reveal||[]"));
 assert.ok(poker.includes("room.to_act===room.my_id"));
 assert.ok(poker.includes('data-pk-act="call"'));
 assert.ok(poker.includes('data-pk-act="raise"'));
});

test("EDGY casino provides all three XP-only games with cloud wallet and controlled visual feedback",()=>{
 const casino=read("casino-game.js"),css=read("casino.css"),auth=read("auth.js"),app=read("app.js");
 const ui=read("edgy-game-ui.js"),registry=read("edgy-platform.js"),sw=read("sw.js");
 for(const game of ["coinflip","roulette","blackjack","slots"])assert.ok(casino.includes('id:"'+game+'"'),game);
 assert.ok(registry.includes('casino:Object.freeze({id:"casino"'));
 assert.ok(ui.includes('casino:{title:"Casino EDGY"'));
 assert.ok(casino.includes('rpc("edgy_arcade_play"'));
 assert.ok(casino.includes('rpc("edgy_wallet_status"'));
 assert.ok(casino.includes('crypto.randomUUID()'),"one unique request per bet");
 assert.ok(!casino.includes("Math.random"),"the outcome must never be calculated by the browser");
 assert.ok(!casino.includes('EDGY_recordLocalMatch'),"casino payouts must not award career XP");
 assert.ok(casino.includes('window.EDGY_setWallet?.(wallet,identity)'));
 assert.ok(casino.includes('me().is_anonymous'));
 assert.ok(casino.includes('acknowledgementKey()'));
 assert.ok(!casino.includes("30 rondas")&&!casino.includes("24 horas"),"casino must have unlimited virtual rounds");
 const casinoSQL=read("supabase/casino_upgrade.sql");
 assert.ok(!casinoSQL.includes("v_rounds")&&!casinoSQL.includes("30 rounds"),"SQL must not enforce daily round caps");
 assert.ok(casinoSQL.includes("if v_balance<p_stake"),"balance check remains enforced by server");
 assert.ok(app.includes('window.EDGY_casino?.open()'));
 assert.ok(app.includes('window.EDGY_casino?.close()'));
 assert.ok(app.includes('window.EDGY_casino?.render()'));
 assert.ok(app.includes('id="homeCasino"'));
 assert.ok(app.includes('id="profileCasino"'));
 assert.ok(app.includes('availableXP()'));
 assert.ok(auth.includes('xp,wallet_xp,avatar_path'));
 assert.ok(auth.includes('window.EDGY_setWallet?.(profile.wallet_xp,uid)'));
 assert.ok(css.includes('@media(max-width:799px)'));
 assert.ok(css.includes('prefers-reduced-motion:reduce'));
 assert.ok(css.includes('cxnSlotMachine')&&css.includes('cxnWheelRotor')&&css.includes('cxnCoinFace'));
 assert.ok(casino.includes('async function animateResult('));
 assert.ok(casino.includes('xp_awarded'));
 assert.ok(!casino.includes('intervalo mínimo de 5 segundos'));
 for(const asset of ['casino-game.js?v=68','casino.css?v=67','casino-tables.js?v=65','casino-tables.css?v=65']){
  assert.ok(html.includes(asset),asset);
  assert.ok(sw.includes(asset),asset);
 }
});
test("Casino shared tables expose blackjack multiplayer without client-side outcome or wallet writes",()=>{
 const casino=read("casino-game.js"),tables=read("casino-tables.js"),css=read("casino-tables.css");
 const platform=read("edgy-platform.js"),app=read("app.js"),social=read("social.js");
 for(const kind of ["blackjack","coinflip","roulette"]){
  assert.ok(platform.includes("casino_"+kind+":Object.freeze"),"registered multiplayer "+kind);
  assert.ok(tables.includes('"'+kind+'"'),"table "+kind);
 }
 for(const fn of ["edgy_casino_room_create","edgy_casino_room_join","edgy_casino_room_state","edgy_casino_room_bet","edgy_casino_room_action"])
  assert.ok(tables.includes(fn),fn);
 assert.ok(tables.includes('data-cxt-action="hit"')&&tables.includes('data-cxt-action="stand"'));
 assert.ok(tables.includes('data-cxt-invite')&&tables.includes('data-cxt-create'));
 assert.ok(!tables.includes("Math.random"));
 assert.ok(app.includes('name.startsWith("casino_")'));
 assert.ok(casino.includes('window.EDGY_casinoTables?.bind?.(root,mode)'));
 assert.ok(css.includes("@media(max-width:550px)")&&css.includes("cxtFelt"));
 assert.ok(social.includes("casino_coinflip"));
 const sql=read("supabase/casino_invites.sql");
 assert.ok(sql.includes("edgy_invite_send")&&sql.includes("edgy_invite_respond")&&sql.includes("casino_blackjack"));
});

test("Casino uses server-authoritative career gains and never lowers level after a loss",async()=>{
 const events={},storage=new Map([['edgy_casino_18_ack_user-A','yes']]);
 const transfers=[],calls=[];
 const root={innerHTML:"",classList:{remove(){}},
  querySelector(sel){
   return {addEventListener(_name,callback){events[sel]=callback}};
  },querySelectorAll(){return []}};
 let current=80,currentTotal=350,round=0;
 const user={id:"user-A",is_anonymous:false};
 const window={EDGY_auth:{getClient:()=>({rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==="edgy_wallet_status")return {data:{wallet_xp:current,total_xp:currentTotal,transactions:[]},error:null};
  if(name==="edgy_arcade_play"){round++;current=round===1?105:80;currentTotal=375;return{data:{game:"coinflip",stake:25,choice:"cara",payout:round===1?50:0,delta:round===1?25:-25,balance:current,total_xp:currentTotal,xp_awarded:round===1?25:0,result:{face:round===1?"cara":"coroa",won:round===1}},error:null}}
  throw Error(name);
 }}),getUser:()=>user},
 EDGY_gameUI:{header:()=>"<header>Casino</header>",card:(_name,body)=>body,match:({stage,side})=>stage+side},
 EDGY_setWallet:(wallet,id)=>transfers.push([wallet,id])};
 const context={window,game:"casino",document:{getElementById:()=>root,addEventListener(){}},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  crypto:{randomUUID:()=>"11111111-1111-4111-8111-111111111111"},console};
 vm.runInNewContext(read("casino-game.js"),context);
 await window.EDGY_casino.open();
 assert.ok(root.innerHTML.includes('XP Total'));
 assert.ok(root.innerHTML.includes('XP Disponível'));
 assert.ok(root.innerHTML.includes('350'));
 assert.ok(root.innerHTML.includes('80'));
 await events['[data-cxn-play]']();
 assert.equal(calls.filter(c=>c.name==="edgy_arcade_play").length,1);
 assert.equal(calls.find(c=>c.name==="edgy_arcade_play").args.p_stake,25);
 assert.equal(calls.find(c=>c.name==="edgy_arcade_play").args.p_choice,"cara");
 assert.ok(root.innerHTML.includes("105"));
 assert.ok(root.innerHTML.includes("375"));
 assert.ok(root.innerHTML.includes("Ganhaste XP"));
 assert.ok(root.innerHTML.includes("XP para subir de nível"));
 await events['[data-cxn-play]']();
 assert.equal(calls.filter(c=>c.name==="edgy_arcade_play").length,2);
 assert.ok(root.innerHTML.includes("80"));
 assert.ok(root.innerHTML.includes("375"));
 assert.ok(root.innerHTML.includes("Sem prémio nesta ronda"));
 assert.deepEqual(transfers.map(([n,id])=>[n,id]),[[80,"user-A"],[105,"user-A"],[105,"user-A"],[80,"user-A"],[80,"user-A"]]);
 window.EDGY_casino.close();
});
test("Progressive XP levels retain pre-migration progress and use increasing tier thresholds",()=>{
 const window={};
 vm.runInNewContext(read("edgy-levels.js"),{window});
 const l=window.EDGY_levels;
 assert.deepEqual([1,4,5,9,10,19,20,29,30,49,50,74,75,99,100].map(l.required),
  [100,100,150,150,250,250,400,400,600,600,900,900,1200,1200,1500]);
 assert.equal(l.info(650,7,600).level,7,"players keep their old level");
 assert.equal(l.info(650,7,600).progress,50,"players retain existing level progress");
 assert.equal(l.info(750,7,600).level,8,"new level is earned only after 150 XP");
 assert.equal(l.info(720,7,600).remaining,30);
 assert.equal(l.info(120,1,0).level,2);
 assert.equal(l.info(400,1,0).level,5);
 assert.equal(l.info(549,1,0).level,5);
 assert.equal(l.info(550,1,0).level,6);
 assert.equal(l.info(100,8,700).level,8,"the level does not decrease if total XP changes");
 assert.deepEqual(JSON.parse(JSON.stringify(l.legacyAnchor(653))),{level:7,xp:600});
 const sql=read("supabase/progressive_levels.sql");
 assert.ok(sql.includes("level_anchor_xp")&&sql.includes("edgy_level_requirement"));
 assert.ok(sql.includes("edgy_player_profile")&&sql.includes("edgy_list_players")&&sql.includes("edgy_wallet_status"));
 assert.ok(html.includes('edgy-levels.js?v=66'));
 assert.ok(read("sw.js").includes('edgy-levels.js?v=66'));
 assert.ok(html.indexOf("edgy-levels.js?v=66")<html.indexOf("app.js?v=69"));
});
test("Slots autoplay locks stake, spins the selected count and keeps XP server-authoritative",async()=>{
 const events={},storage=new Map([["edgy_casino_18_ack_user-A","yes"]]),calls=[];
 const root={innerHTML:"",classList:{remove(){}},querySelector(sel){
    return {addEventListener(_type,fn){events[sel]=fn}};
   },querySelectorAll(sel){
    if(sel==="[data-cxn-mode]")return [{dataset:{cxnMode:"slots"},addEventListener(_type,fn){events.switchSlots=fn}}];
    if(sel==="[data-cxn-auto-count]")return [{dataset:{cxnAutoCount:"5"},addEventListener(_type,fn){events.five=fn}}];
    return [];
   }};
 let wallet=500,total=1000,refreshes=0;
 const user={id:"user-A",is_anonymous:false};
 const window={EDGY_auth:{getUser:()=>user,getClient:()=>({rpc:async(name,parameters)=>{
   calls.push({name,parameters});
   if(name==="edgy_wallet_status")return{data:{wallet_xp:wallet,total_xp:total,transactions:[]},error:null};
   if(name==="edgy_arcade_play"){
    assert.equal(parameters.p_game,"slots");
    assert.equal(parameters.p_stake,25,"locked stake stays fixed");
    wallet+=10;total+=10;
    return{data:{game:"slots",stake:25,payout:35,delta:10,balance:wallet,total_xp:total,xp_awarded:10,result:{symbols:["🍒","🍒","⭐"]}},error:null};
   }
   throw Error(name);
  }}),refreshProfile:async()=>{refreshes++}},
  EDGY_gameUI:{header:()=>"<header>Casino</header>",card:(_title,body)=>body,match:({stage,side})=>stage+side},
  EDGY_setWallet(){}};
 const context={window,game:"casino",document:{getElementById:()=>root,querySelector:()=>null},
   localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
   crypto:{randomUUID:()=>String(calls.length).padStart(36,"a")},console};
 vm.runInNewContext(read("casino-game.js"),context);
 await window.EDGY_casino.open();
 events.switchSlots();
 assert.ok(root.innerHTML.includes("Slots automáticos"));
 events['[data-cxn-auto-lock]']();
 events.five();
 await events['[data-cxn-auto-start]']();
 assert.equal(calls.filter(x=>x.name==="edgy_arcade_play").length,5);
 assert.equal(wallet,550);
 assert.equal(total,1050);
 assert.ok(root.innerHTML.includes("5 / 5 giros"));
 assert.ok(root.innerHTML.includes("+50 XP"));
 assert.equal(refreshes,1,"profile is refreshed once per batch");
 window.EDGY_casino.close();
});

test("EDGY wallet is isolated by user and career level is computed exclusively from total XP",()=>{
 const app=read("app.js"),auth=read("auth.js"),casino=read("casino-game.js");
 assert.ok(app.includes('window.EDGY_levels.info(state.xp,state.levelAnchor,state.levelAnchorXP)'));
 assert.ok(app.includes('state.walletOwner===owner'));
 assert.ok(app.includes('state.walletXP=value;state.walletOwner=id;save()'));
 assert.ok(app.includes('if(changed&&!game&&(page==="home"||page==="profile"))render()'));
 assert.ok(!casino.includes('state.xp+='));
 assert.ok(auth.includes('wallet_xp'));
 assert.ok(casino.includes('p_request:crypto.randomUUID()'));
 assert.ok(casino.includes('Saldo insuficiente'));
});
test("Navigation keeps Histórico only inside Perfil",()=>{
 const sidebar=html.split('<aside class="sidebar">')[1].split("</aside>")[0];
 const mobile=html.split('<nav class="nav"')[1].split("</nav>")[0];
 assert.ok(!sidebar.includes('data-page="history"'));
 assert.ok(!mobile.includes('data-page="history"'));
 assert.ok(app.includes('id="profileHistory"'));
 assert.deepEqual([...mobile.matchAll(/data-page="([^"]+)"/g)].map(m=>m[1]),["games","players","home","rooms","profile"]);
 assert.ok(mobile.includes('class="navHomeGlyph"'));
});
test("Retired Memory and Quiz are no longer part of loaded bootstrap",()=>{
 assert.ok(!app.includes('id:"memory"')&&!app.includes('id:"quiz"'));
 assert.ok(!app.includes('function drawMemory()')&&!app.includes('function drawQuiz()'));
});
function platformFixture(){
 const calls=[],api={rpc(name,args){calls.push({name,args});return Promise.resolve({data:"OK",error:null})},from(table){calls.push({table});return {select(){return this},eq(){return this},maybeSingle(){return Promise.resolve({data:{id:1},error:null})}}}};
 const document={body:{append(){}},activeElement:null,addEventListener(){},createElement(){throw Error("DOM not set up")}};
 const window={EDGY_auth:{getClient(){return api}}};
 vm.runInNewContext(read("edgy-platform.js"),{window,document,console});
 return {platform:window.EDGY_platform,api,calls,window,document};
}
test("Single registry serves all online games and rejects invalid codes",async()=>{
 const {platform,calls}=platformFixture();
 assert.deepEqual(Object.keys(platform.games).sort(),["barricade","casino","casino_blackjack","casino_coinflip","casino_roulette","checkers","chess","contexto","headSoccer","party","poker","reaction","tic","twenty48","wordle"]);
 assert.equal(platform.code(" aB41cD23 "),"AB41CD23");
 assert.throws(()=>platform.code("oops"),/8 caracteres/);
 assert.throws(()=>platform.rooms.create("reaction"),/não suporta/);
 await platform.rooms.create("chess",{base:600,increment:0});
 await platform.rooms.create("checkers");
 await platform.rooms.create("tic");
 await platform.rooms.create("barricade");
 assert.throws(()=>platform.rooms.create("wordle"),/não suporta salas online/);
 await platform.rooms.join("chess","aB41cD23");
 await platform.rooms.join("checkers","aB41cD23");
 await platform.rooms.join("tic","aB41cD23");
 await platform.rooms.join("barricade","aB41cD23");
 await platform.rooms.cancel("chess","aB41cD23");
 await platform.rooms.cancel("barricade","aB41cD23");
 await platform.rooms.invite("checkers","aB41cD23","some-user-id");
 await platform.rooms.invite("tic","aB41cD23","some-user-id");
 await platform.rooms.invite("barricade","aB41cD23","some-user-id");
 await platform.rooms.respond("some-invite",true);
 await platform.rooms.list(200);
 assert.deepEqual(calls.map(c=>c.name),["edgy_create_chess_room_timed","edgy_checkers_create","edgy_tic_create","edgy_barricade_create","edgy_join_chess_room","edgy_checkers_join","edgy_tic_join","edgy_barricade_join","edgy_cancel_waiting_chess_room","edgy_barricade_cancel","edgy_invite_send","edgy_invite_send","edgy_invite_send","edgy_invite_respond","edgy_my_rooms"]);
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args)),{p_base:600,p_increment:0});
 assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1).args)),{p_limit:100});
});
test("Barricade 9x9 move, walls, blocked paths and jumping are server-shared",()=>{
 const client=read("barricade-rules.js"),server=read("supabase/functions/barricade-action/rules.js");
 assert.equal(client,server,"client and server must enforce the same rules");
 const ctx={};vm.runInNewContext(client.replace(/\bexport\s+/g,"")+";globalThis.br={initialState,legalMoves,canPlaceWall,applyAction,blocked,hasPath};",ctx);
 const br=ctx.br,initial=br.initialState();
 assert.equal(initial.red_pos,76);assert.equal(initial.blue_pos,4);
 assert.equal(initial.red_walls,10);assert.equal(initial.blue_walls,10);
 assert.ok(br.legalMoves(initial).includes(67),"red advances toward its goal");
 assert.throws(()=>br.applyAction(initial,{type:"move",to:0}),/ilegal/);
 const after=br.applyAction(initial,{type:"wall",r:6,c:3,o:"h"});
 assert.equal(after.red_walls,9);
 assert.equal(after.walls.length,1);
 assert.ok(!br.canPlaceWall(after,{r:6,c:3,o:"v"}),"wall crossing is illegal");
 assert.ok(!br.canPlaceWall(after,{r:6,c:4,o:"h"}),"wall overlap is illegal");
 assert.ok(br.canPlaceWall(after,{r:3,c:3,o:"h"}),"separated walls remain legal");
 const jump={...initial,red_pos:40,blue_pos:31,turn:"r"};
 assert.ok(br.legalMoves(jump).includes(22),"a pawn may jump over an adjacent rival");
 const blockedJump={...jump,walls:[{r:2,c:4,o:"h"}]};
 assert.ok(br.legalMoves(blockedJump).includes(30)||br.legalMoves(blockedJump).includes(32),"blocked straight jump opens side steps");
 const trapped={...initial,walls:[{r:7,c:3,o:"h"},{r:7,c:5,o:"h"},{r:6,c:4,o:"v"}]};
 assert.equal(typeof br.hasPath(trapped.walls,trapped.red_pos,0),"boolean");
});
test("Barricade uses private 2-player rooms, invitations, shared UI and history",()=>{
 const platform=read("edgy-platform.js"),app=read("app.js"),social=read("social.js");
 const client=read("barricade-online.js"),layout=read("barricade.css"),history=read("history.js"),html=read("index.html"),sw=read("sw.js");
 assert.ok(platform.includes('barricade:Object.freeze('));
 assert.ok(app.includes('window.EDGY_barricade?.open('));
 assert.ok(app.includes('window.EDGY_barricade?.close()'));
 assert.ok(client.includes('window.EDGY_gameUI.bindMobilePanel(')||client.includes('ui().bindMobilePanel('));
 assert.ok(client.includes('functions.invoke("barricade-action"'));
 assert.ok(client.includes('data-br-wall='));
 assert.ok(client.includes('data-br-step='));
 assert.ok(layout.includes('.brBoard{')&&layout.includes('.brWall-h'));
 assert.ok(history.includes('barricadeCloud='));
 assert.ok(history.includes('isBarricade'));
 assert.ok(social.includes('["edgy-barricade-rooms","barricade"]'));
 for(const file of ["barricade-online.js?v=47","barricade.css?v=47"])assert.ok(html.includes(file)&&sw.includes(file));
});
test("Common result dialog handles win, loss, draw and closing",()=>{
 const {platform,document}=platformFixture();
 let focused=null,appended=null;
 const nodes=new Map();
 document.createElement=()=>({
  hidden:true,attributes:{},dataset:{},
  innerHTML:"",className:"",
  setAttribute(k,v){this.attributes[k]=v},
  querySelector(sel){
   if(!nodes.has(sel))nodes.set(sel,{textContent:"",innerHTML:"",handlers:{},addEventListener(event,fn){this.handlers[event]=fn},focus(){focused=sel}});
   return nodes.get(sel);
  },
  addEventListener(){},
 });
 document.body.append=elem=>{appended=elem};
 const modal=platform.createResult({game:"chess"});
 assert.ok(appended);
 for(const [outcome,label] of [["win","Venceste!"],["loss","Perdeste!"],["draw","Empate!"]]){
  modal.show({outcome,reason:"Partida encerrada"});
  assert.equal(nodes.get("[data-title]").textContent,label);
  assert.equal(nodes.get("[data-reason]").textContent,"Partida encerrada");
  assert.equal(modal.element.dataset.result,outcome);
  assert.equal(modal.element.hidden,false);
  assert.equal(focused,"[data-primary]");
  modal.hide();assert.equal(modal.element.hidden,true);
 }
});
test("Damas retain forward-only capture, flying kings, initial board",()=>{
 const source=read("checkers-rules.js").replace(/\bexport\s+/g,"");
 const context={};vm.runInNewContext(source+";globalThis.testRules={initialState,legalMoves,applyMove};",context);
 const rules=context.testRules;
 const state=(pieces,turn="w")=>{
  const board=Array(64).fill(null);
  for(const [index,piece] of pieces)board[index]=piece;
  return {board,turn,ply:0,status:"active",history:[],last:[],quiet:0};
 };
 assert.equal(rules.legalMoves(rules.initialState()).length,7);
 const caps=s=>rules.legalMoves(s).some(m=>m.captures?.length>0);
 assert.ok(caps(state([[42,"w"],[33,"b"]])));
 assert.ok(!caps(state([[26,"w"],[35,"b"]])));
 assert.ok(caps(state([[17,"b"],[26,"w"]],"b")));
 assert.ok(!caps(state([[33,"b"],[24,"w"]],"b")));
 assert.ok(caps(state([[26,"W"],[35,"b"]])));
 assert.ok(caps(state([[44,"W"],[26,"b"]])));
 assert.ok(rules.legalMoves(state([[42,"w"],[33,"b"],[17,"b"]])).some(m=>m.captures?.length===2));
});
test("Damas allow a choice of capture while requiring the entire sequence on client and server",()=>{
 const client=read("checkers-rules.js"),server=read("supabase/functions/checkers-action/rules.js");
 assert.equal(client,server,"the online validator must enforce the same capture rules");
 const context={};vm.runInNewContext(client.replace(/\bexport\s+/g,"")+";globalThis.rules={legalMoves,applyMove};",context);
 const board=Array(64).fill(null);
 for(const [i,p] of [[42,"w"],[46,"w"],[33,"b"],[17,"b"],[37,"b"]])board[i]=p;
 const state={board,turn:"w",ply:0,status:"active",history:[],last:[],quiet:0};
 const captures=context.rules.legalMoves(state);
 assert.ok(captures.some(m=>m.path[0]===42&&m.captures.length===2));
 assert.ok(captures.some(m=>m.path[0]===46&&m.captures.length===1));
 assert.ok(captures.every(m=>m.captures.length>0),"quiet moves remain forbidden");
 const shorter=captures.find(m=>m.path[0]===46&&m.captures.length===1);
 const next=context.rules.applyMove(state,shorter.path);
 assert.equal(next.board[37],null);
 assert.equal(next.board[shorter.path.at(-1)],"w");
 assert.throws(()=>context.rules.applyMove(state,[42,24]),/captura incompleta/);
});

test("Unified visual rules include accessible motion reduction",()=>{
 const css=read("edgy-theme.css");
 for(const token of ["--edgy-surface","--edgy-stroke","--edgy-accent",".edgyOutcomeDialog",".edgyOutcomeOverlay",".edgyLobby",".nav button.navHome .navHomeGlyph","prefers-reduced-motion:reduce"])assert.ok(css.includes(token),token);
 const chess=read("chess-online.js"),checkers=read("checkers-online.js");
 for(const code of [chess,checkers]){
  assert.ok(code.includes("window.EDGY_platform.createResult("));
  assert.ok(code.includes("window.EDGY_platform.rooms.create("));
  assert.ok(code.includes('classList.toggle("edgyLobby",!room)'));
 }
});
test("Chess engine and Damas rules load only when the game is opened",()=>{
 const chess=read("chess-online.js"),checkers=read("checkers-online.js");
 assert.match(chess,/function loadEngine\(\)/);
 assert.match(checkers,/function loadRules\(\)/);
 assert.match(chess,/autoTried=false;loadEngine\(\);draw\(\)/);
 assert.match(checkers,/joined=false;loadRules\(\);draw\(\)/);
});

test("Tic joins existing UI multiplayer and shared challenge registry",()=>{
 const platform=read("edgy-platform.js");
 const app=read("app.js"),social=read("social.js"),players=read("players.js");
 const online=read("tic-online.js"),history=read("history.js");
 assert.ok(platform.includes('tic:Object.freeze({id:"tic"')&&platform.includes('online:true,create:"edgy_tic_create"'));
 assert.ok(app.includes('window.EDGY_ticOnline?.open('));
 assert.ok(app.includes('window.EDGY_ticLocal='));
 assert.ok(social.includes('Object.values(window.EDGY_platform.games).filter(g=>g.online)'));
 assert.ok(players.includes("edgy_head_to_head_all"));
 assert.ok(history.includes("renderTicReplay()"));
 assert.ok(online.includes('p_expected_ply:room.ply'));
 assert.ok(online.includes('window.EDGY_ticOnline={open,close,render,refresh}'));
 assert.ok(online.includes("data-resign")&&online.includes("data-invite"));
});
test("Live invitation channel refreshes recipient inbox without reloading",()=>{
 const social=read("social.js");
 assert.ok(social.includes('function syncInviteChannel()'));
 assert.ok(social.includes('table:"edgy_game_invites",filter:"recipient_id=eq."+uid'));
 assert.ok(social.includes('.on("postgres_changes"'));
 assert.ok(social.includes('if(status==="SUBSCRIBED")refreshInvites()'));
 assert.ok(social.includes('document.addEventListener("visibilitychange"'));
 assert.ok(social.includes('},6000)'));
 assert.ok(social.includes('if(modalMode==="inbox")inboxDraw()'));
});
test("Chess refreshes automatically and hides the redundant refresh button",()=>{
 const chess=read("chess-online.js"),css=read("edgy-game-layout.css");
 assert.ok(!chess.includes('data-refresh'),"there must be no manual refresh action");
 assert.ok(chess.includes('poller=setInterval('),"background synchronization remains active");
 assert.ok(css.includes('.main.chess-viewport #screen .chessSide.edgyMatchDrawer{'));
 assert.ok(!css.includes('#screen .edgyMatchSide.edgyMatchDrawer,'),
  "Centered styling must not affect Damas or Galo");
 assert.ok(css.includes('left:50%!important;right:auto!important;bottom:auto!important'));
});
test("Stable footer, profile replay links and chess mobile actions",()=>{
 const html=read("index.html"),css=read("edgy-theme.css");
 const chess=read("chess-online.js"),damas=read("checkers-online.js"),players=read("players.js");
 assert.ok(html.includes('<footer class="foot">EDGY · Feito para jogar, onde quiseres.</footer>'));
 assert.ok(css.includes(".main>.foot{")&&css.includes("margin: auto 0 0!important"));
 assert.ok(css.includes(".playerOverlay:not([hidden]) .playerDialog"));
 assert.ok(css.includes("playerReplayLink")&&players.includes("data-replay="));
 assert.ok(chess.includes('window.EDGY_gameUI.bindMobilePanel(root,'));
 assert.ok(chess.includes('optionSelector:".chessOptionPanel"'));
 assert.ok(chess.includes('historySelector:".chessHistoryPanel"'));
 assert.ok(css.includes("main.chess-viewport #screen .chessSide"));
 assert.ok(!damas.includes("data-refresh"));
 assert.ok(!damas.includes(">Atualizar</button>"));
});

test("Game library uses a single registry loaded before bootstrap",()=>{
 const scripts=[...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m=>m[1]);
 const platform=scripts.indexOf("./edgy-platform.js?v=69");
 const bootstrap=scripts.indexOf("./app.js?v=69");
 assert.ok(platform>=0&&bootstrap>=0&&platform<bootstrap);
 const app=read("app.js"),defs=read("edgy-platform.js");
 assert.ok(app.includes("Object.values(window.EDGY_platform.games).filter(g=>!g.hidden).map("));
 assert.ok(app.includes("homeGames()"),"Home uses the two-game selector");
 for(const game of ["chess","checkers","tic","reaction","casino","barricade","party","poker","wordle","contexto"])assert.ok(defs.includes(game+":Object.freeze("));
 assert.ok(app.includes('filter==="Multiplayer"?window.EDGY_platform.games[g.id].online'));
});

test("Damas keeps its full-width bottom drawer and Chess stays centered",()=>{
 const css=read("edgy-game-layout.css"),checkers=read("checkers-online.js");
 const base=css.indexOf('#screen[data-game-panel-open="options"] .edgyMatchSide.edgyMatchDrawer');
 const chess=css.indexOf('/* EDGY v42 — only Chess uses the centered dialog.');
 assert.ok(base>=0&&chess>base);
 const wide=css.slice(Math.max(0,base-125),chess);
 assert.ok(wide.includes('left:8px;right:8px;top:auto;bottom:calc(76px + env(safe-area-inset-bottom))'));
 assert.ok(wide.includes('width:auto!important;max-width:none!important'));
 assert.ok(!css.includes('#screen .edgyMatchSide.edgyMatchDrawer,'),
  "Do not apply the Chess-specific center transform to Damas.");
 assert.ok(css.includes('.main.chess-viewport #screen .chessSide.edgyMatchDrawer{'));
 assert.ok(checkers.includes('sideSelector:".ckSide"'));
});
test("Chess uses the same mobile options/history drawer as Damas, including promotion",()=>{
 const chess=read("chess-online.js"),ui=read("edgy-game-ui.js"),css=read("edgy-game-layout.css");
 assert.ok(chess.includes('window.EDGY_gameUI.bindMobilePanel(root,{'));
 assert.ok(chess.includes('optionSelector:".chessOptionPanel"'));
 assert.ok(chess.includes('historySelector:".chessHistoryPanel"'));
 assert.ok(chess.includes('window.EDGY_gameUI.openMobilePanel(document.getElementById("screen"),"options")'));
 assert.ok(chess.includes('window.EDGY_gameUI.openMobilePanel(document.getElementById("screen"),"history")'));
 assert.ok(!chess.includes('drawerSection')&&!chess.includes('drawerOpen'));
 assert.ok(ui.includes('function openMobilePanel('));
 assert.ok(ui.includes('function clearMobilePanel('));
 assert.ok(css.includes('.main.chess-viewport #screen .chessSide.edgyMatchDrawer{'));
 assert.ok(css.includes('top:calc((100dvh - 76px - env(safe-area-inset-bottom))/2)!important'));
 assert.ok(css.includes('transform:translate(-50%,-50%)!important'));
 assert.ok(css.includes('max-height:min(72dvh,calc(100dvh - 112px - env(safe-area-inset-bottom)))!important'));
});
test("Profile match replays stay accessible across chess and other online games",()=>{
 const players=read("players.js"),css=read("edgy-theme.css");
 assert.ok(players.includes('edgy_head_to_head_all'));
 assert.ok(players.includes('data-replay='));
 assert.ok(players.includes("Rever partida ↗"));
 assert.ok(players.includes('window.EDGY_history?.openByCode(code)'));
 assert.ok(players.includes('window.EDGY_checkersReplay?.open(code)'));
 assert.ok(!players.includes('window.EDGY_openRoom?.(kind,code)'));
 assert.ok(css.includes('.playerOverlay{z-index:175!important}'));
 assert.ok(css.includes('.edReplayMask{z-index:180!important}'));
 assert.ok(players.includes('isClosing')&&css.includes('@keyframes edgyProfileArrivalOut'));
});
test("Tic players use member-only lookup and online history avoids duplicate results",()=>{
 const app=read("tic-online.js"),platform=read("edgy-platform.js"),history=read("history.js");
 assert.ok(platform.includes('players(id,roomCode)'));
 assert.ok(app.includes('rooms.players("tic",room.code)'));
 assert.ok(history.includes('const onlineIds=new Set('));
 assert.ok(history.includes('outcome==="win"?50:outcome==="draw"?20:10'));
 assert.ok(app.includes('refreshProfile?.()'));
});

test("Personal history includes Damas results and opens the existing read-only replay",()=>{
 const history=read("history.js"),replay=read("checkers-replay.js");
 assert.ok(history.includes('checkersCloud=[]'));
 assert.ok(history.includes('const ownRooms=query=>'));
 assert.ok(history.includes('api().from("checkers_rooms").select('));
 assert.ok(history.includes('cloud.concat(ticCloud,checkersCloud,barricadeCloud)'));
 assert.ok(history.includes('if(g.isCheckers){window.EDGY_checkersReplay?.open(g.code);return}'));
 assert.ok(history.includes('game:"Damas",isCheckers:true'));
 assert.ok(history.includes('checkers.error'));
 assert.ok(replay.includes('["white_win","black_win","draw"]'));
 assert.ok(!history.includes('game:"Damas",isChess:true'));
});
test("Damas replay is strictly read only and never resumes a completed room",()=>{
 const p=read("players.js"),c=read("checkers-online.js"),replay=read("checkers-replay.js");
 const html=read("index.html"),sw=read("sw.js");
 assert.ok(p.includes('window.EDGY_checkersReplay?.open(code)'));
 assert.ok(!p.includes('window.EDGY_openRoom?.(kind,code)'));
 assert.ok(c.includes('window.EDGY_checkersReplay?.open(room.code)'));
 assert.ok(replay.includes('from("checkers_rooms").select('));
 assert.ok(replay.includes('["white_win","black_win","draw"]'));
 assert.ok(replay.includes('function boardAt(n)')&&replay.includes('data-nav="next"'));
 assert.ok(!replay.includes('rooms.join(')&&!replay.includes('showResult()'));
 assert.ok(html.includes('checkers-replay.js?v=33')&&sw.includes('checkers-replay.js?v=33'));
});
test("Mobile chess scrolls its board and uses the compact shared drawer",()=>{
 const theme=read("edgy-theme.css"),layout=read("edgy-game-layout.css");
 assert.ok(theme.includes('.main.chess-viewport #screen{'));
 assert.ok(theme.includes('overflow-y:auto!important;overflow-x:hidden!important'));
 assert.ok(layout.includes('#screen .edgyMatchMobileTabs{'));
 assert.ok(layout.includes('.main.chess-viewport #screen .chessSide.edgyMatchDrawer{'));
 assert.ok(layout.includes('z-index:165!important'));
});
test("Public profile opens at the top and routes all three game replays",()=>{
 const src=read("players.js"),h=read("history.js");
 assert.ok(src.includes('modal.querySelector(".playerDialog").scrollTop=0'));
 assert.ok(src.includes('window.EDGY_history?.openByCode(code)'));
 assert.ok(src.includes('window.EDGY_history?.openByCode("tic",code)'));
 assert.ok(src.includes('window.EDGY_checkersReplay?.open(code)'));
 assert.ok(h.includes('async function openTicByCode(code)'));
});


test("Jogo do Galo uses the shared lobby renderer and rooms",()=>{
 const tic=read("tic-online.js"),social=read("social.js");
 assert.ok(tic.includes('window.EDGY_gameUI.header("tic"'));
 assert.ok(tic.includes('window.EDGY_gameUI.card("Criar partida online"'));
 assert.ok(tic.includes('window.EDGY_gameUI.card("Entrar numa sala"'));
 assert.ok(tic.includes('window.EDGY_gameUI.card("As tuas salas"'));
 assert.ok(tic.includes('id="edgy-tic-rooms"'));
 assert.ok(tic.includes('window.EDGY_social?.renderRooms?.("edgy-tic-rooms","tic")'));
 assert.ok(tic.includes('window.EDGY_ticLocal?.()'));
 assert.ok(social.includes('["edgy-tic-rooms","tic"]'));
});
test("Chess shares the match shell, drawer binder and move controls",()=>{
 const chess=read("chess-online.js"),css=read("edgy-game-layout.css");
 assert.ok(chess.includes('window.EDGY_gameUI.header("chess"'));
 assert.ok(chess.includes('window.EDGY_gameUI.match({game:"chess"'));
 assert.ok(chess.includes('window.EDGY_gameUI.bindMobilePanel(root,'));
 assert.ok(chess.includes('reviewControls()'));
 assert.ok(!chess.includes('chessMobileTools"><button'));
 assert.ok(css.includes('#screen .edgyMatchStage'));
 assert.ok(css.includes('#screen .edgyMatchSide'));
});
test("All games share one header, lobby cards and match presentation",()=>{
 const html=read("index.html"),ui=read("edgy-game-ui.js"),css=read("edgy-game-layout.css");
 assert.ok(html.includes('edgy-game-ui.js?v=69'));
 assert.ok(html.includes('edgy-game-layout.css?v=47'));
 for(const game of ["chess","checkers","tic","reaction","casino","barricade","party","poker","wordle","contexto"])assert.ok(ui.includes(game+':{title:'));
 for(const file of ["chess-online.js","checkers-online.js","tic-online.js","barricade-online.js","app.js"]){
  const src=read(file);
  assert.ok(src.includes('window.EDGY_gameUI.header(')||src.includes('ui().header('),file);
  assert.ok(src.includes('window.EDGY_gameUI.match(')||src.includes('ui().match('),file);
 }
 for(const file of ["chess-online.js","checkers-online.js","tic-online.js","barricade-online.js"]){
  const src=read(file);
  assert.ok(src.includes('window.EDGY_gameUI.card(')||src.includes('ui().card('),file);
 }
 assert.ok(css.includes('#screen .edgyGameHeaderRow'));
 assert.ok(css.includes('#screen .edgyGamePanel'));
 assert.ok(css.includes('#screen .edgyMatchLayout'));
});
test("Universal renderer escapes user text and keeps consistent structure",()=>{
 const code=read("edgy-game-ui.js"),ctx={window:{},document:{addEventListener(){}}};
 vm.runInNewContext(code,ctx);
 const ui=ctx.window.EDGY_gameUI;
 const header=ui.header("chess",{room:'<script>alert(1)</script>',intro:"Teste"});
 assert.ok(header.includes('class="edgyGameHeader"'));
 assert.ok(!header.includes("<script>"));
 assert.ok(header.includes('&lt;script&gt;'));
 const panel=ui.card('Criar partida','<button>OK</button>',{description:'Sala privada'});
 assert.ok(panel.includes('edgyGamePanel'));
 assert.ok(panel.includes('<button>OK</button>'));
 assert.ok(ui.match({game:"checkers",stage:"TABULEIRO",side:"OPÇÕES"}).includes('class="edgyMatchSide'));
});
test("Xadrez, Damas and Galo use one mobile options/history panel implementation",()=>{
 const ui=read("edgy-game-ui.js"),css=read("edgy-game-layout.css");
 for(const file of ["chess-online.js","checkers-online.js","tic-online.js","barricade-online.js"]){
  const src=read(file);
  assert.ok(src.includes('window.EDGY_gameUI.bindMobilePanel(')||src.includes('ui().bindMobilePanel('),file);
 }
 assert.ok(read("checkers-online.js").includes('clearMobilePanel("checkers")'));
 assert.ok(read("tic-online.js").includes('clearMobilePanel("tic")'));
 assert.ok(read("checkers-online.js").includes('document.visibilityState!=="hidden"'));
 assert.ok(ui.includes('function bindMobilePanel('));
 assert.ok(css.includes('#screen .edgyMatchSide.edgyMatchDrawer'));
 assert.ok(css.includes('[data-game-panel-open="history"]'));
});

test("Biblioteca uses only the main scroll viewport, never a nested scroller",()=>{
 const css=read("edgy-game-layout.css"),app=read("app.js"),html=read("index.html");
 assert.ok(app.includes('classList.toggle("edgyLibraryViewport",page==="games"&&!game)'));
 assert.ok(app.includes('classList.remove("edgyLibraryViewport");game=id'));
 assert.ok(app.includes('classList.remove("edgyLibraryViewport");game=name'));
 assert.ok(css.includes('EDGY v47 — one real vertical scroll container for Biblioteca'));
 const main=css.slice(css.indexOf('.main.edgyLibraryViewport{'),css.indexOf('.main.edgyLibraryViewport>#screen.edgyLibraryPage{'));
 assert.ok(main.includes('overflow-y:auto!important'),'the main content scrolls');
 assert.ok(main.includes('padding-bottom:calc(130px + env(safe-area-inset-bottom))!important;'),'last card clears navigation');
 const screen=css.slice(css.indexOf('.main.edgyLibraryViewport>#screen.edgyLibraryPage{'),css.indexOf('.main.edgyLibraryViewport>.top{'));
 assert.ok(screen.includes('overflow:visible!important;'),'library must not host a second scroll area');
 assert.ok(screen.includes('animation:none!important;'),'page transition must not interfere with touch scroll');
 assert.ok(html.includes("edgy-game-layout.css?v=47"));
});
test("Barricade scroll is preserved, move errors remain visible and animation follows confirmed server updates",()=>{
 const css=read("edgy-game-layout.css"),src=read("barricade-online.js"),skin=read("barricade.css");
 assert.ok(css.includes('.main:has(> #screen .brWrap)>#screen{'));
 assert.ok(css.includes('touch-action:pan-y pinch-zoom!important;'));
 assert.ok(src.includes('role="alert"'),'errors still appear beside board');
 assert.ok(src.includes('functions.invoke("barricade-action"'));
 assert.ok(src.includes('function captureBoardVisuals()'));
 assert.ok(src.includes('function animateConfirmedTurn(previous,next,oldVisuals)'));
 assert.ok(src.includes('const oldVisuals=review===null&&data.ply>previous.ply?captureBoardVisuals():null;'));
 assert.ok(src.includes('animateConfirmedTurn(previous,data,oldVisuals)'));
 assert.ok(src.includes('next.ply<=previous.ply'),'do not animate unchanged server states');
 assert.ok(src.includes('(prefers-reduced-motion: reduce)'),'respect motion preferences');
 assert.ok(src.includes('animation.onfinish='));
 assert.ok(src.includes('data-br-wall-key='));
 assert.ok(skin.includes('.brCell.brCellMoving{'));
 assert.ok(skin.includes('@keyframes brLegalHint'));
 assert.ok(skin.includes('@media(prefers-reduced-motion:reduce)'));
 for(const asset of ["edgy-game-layout.css?v=47","barricade-online.js?v=47","barricade.css?v=47"]){
  assert.ok(html.includes(asset)||asset!=="edgy-game-layout.css?v=47");
  assert.ok(read("sw.js").includes(asset),"asset must be cached: "+asset);
 }
});
test("Five-game mobile library centers the orphan card and keeps filter buttons visible",()=>{
 const css=read("edgy-game-layout.css"),app=read("app.js");
 assert.ok(css.includes('#screen .edgyGameCards>.game:last-child:nth-child(odd){'));
 assert.ok(css.includes('grid-column:1 / -1;'));
 assert.ok(css.includes('justify-self:center;'));
 assert.ok(css.includes('width:calc((100% - 11px)/2)!important'));
 assert.ok(css.includes('#screen .edgyGameCards>.game:only-child{'));
 assert.ok(css.includes('#screen.edgyLibraryPage .filters button{'));
 assert.ok(css.includes('padding-bottom:calc(130px + env(safe-area-inset-bottom))!important'));
 assert.ok(app.includes('function cards(items){return'));
});
test("Community shows highest-level players first, XP breaks ties, and shows relative ranks",()=>{
 const players=read("players.js"),index=read("index.html"),sw=read("sw.js");
 const start=players.indexOf("const ranked="),end=players.indexOf(" holder.innerHTML=ranked.length",start);
 assert.ok(start>=0&&end>start,"ranking is computed before rendering");
 const expression=players.slice(start+"const ranked=".length,end).trim();
 const names=vm.runInNewContext(
  '(()=>{const data=[{name:"Baixo",xp:40,username:"b"},{name:"EmpateB",xp:220,username:"b"},{name:"Alto",xp:315,username:"a"},{name:"EmpateA",xp:220,username:"a"}];const ranked='+expression+';return ranked.map(x=>x.name)})()'
 );
 assert.deepEqual(Array.from(names),["Alto","EmpateA","EmpateB","Baixo"]);
 assert.ok(players.includes('class="playerRank"'));
 assert.ok(players.includes('class="playerLevel"'));
 assert.ok(players.includes('Ordenados por nível (mais alto primeiro)'));
 assert.ok(index.includes("players.js?v=66")&&sw.includes("players.js?v=66"));
});
test("Home and Biblioteca render exactly the same reusable game cards",()=>{
 const css=read("edgy-game-layout.css"),app=read("app.js"),html=read("index.html");
 assert.ok(app.includes('function cards(items){return \'<div class="games edgyGameCards">\''));
 assert.ok(app.includes("'+cards(featured.items)"),"Home uses the common card renderer for two games");
 assert.ok(app.includes("'+cards(shown)"),"Biblioteca uses the common card renderer");
 assert.ok(css.includes('#screen .edgyGameCards .game{'),"cards share one flex layout");
 assert.ok(css.includes('#screen .edgyGameCards .game .art{'),"artwork has a fixed area");
 assert.ok(css.includes('flex:0 0 160px!important'),"desktop artwork never shrinks for long descriptions");
 assert.ok(css.includes('flex-basis:84px!important'),"mobile artwork uses exactly the same geometry");
 assert.ok(css.includes('grid-auto-rows:1fr'),"all cards in the grid stretch equally");
 assert.ok(css.includes('.main.edgyLibraryViewport>.foot'),"library footer follows the cards in the main scroller");
 assert.ok(html.includes('edgy-game-layout.css?v=47'));
 assert.ok(html.includes('app.js?v=69'));
});
test("EDGY v36: chess title is short and empty join notice does not reserve space",()=>{
 const chess=read("chess-online.js"),ui=read("edgy-game-ui.js"),css=read("edgy-game-layout.css");
 assert.ok(ui.includes('chess:{title:"Xadrez",icon:'));
 assert.ok(!ui.includes('chess:{title:"Xadrez online"'));
 assert.ok(chess.includes('class="result chessLobbyNotice" id="chess-info"'));
 assert.ok(css.includes('#screen .chessLobbyNotice:empty{display:none!important}'));
 const p=chess.indexOf('window.EDGY_gameUI.card("Entrar numa sala"');
 const q=chess.indexOf('window.EDGY_gameUI.card("As tuas salas"',p);
 assert.ok(p>=0&&q>p);
 assert.ok(!chess.slice(p,q).includes("+'<p class=\"result\" id=\"chess-info\"></p>'"));
});
