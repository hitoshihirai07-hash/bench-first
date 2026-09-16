'use strict';
const assert=require('node:assert/strict');const {test}=require('node:test');
const G=require('../public/engine.js'),M=require('../public/motion.js');
function finish(s){let n=0;while(!s.done&&n++<200){G.step(s,s.half==='home'?'contact':'normal');}assert(s.done);return s;}
test('all 7 scenarios start with correct bases, outs, batter, side and scoreboard',()=>{
 for(const [key,c] of Object.entries(G.scenarios)){
  const s=G.createGame(key,42);assert.equal(s.inning,c.inning||7);assert.equal(s.half,c.half||'home');assert.equal(s.outs,c.outs??1);
  assert.deepEqual(s.bases.map(p=>p?.id||null),(c.bases||[6,null,null]).map(i=>i===null?null:(s.half==='home'?'h':'a')+i));
  for(const k of ['home','away'])assert.equal(s.lines[k].reduce((n,v)=>n+(Number(v)||0),0),s.score[k]);
  if(c.order!==undefined)assert.equal(G.batting(s).order,c.order);
  if(c.pitches!==undefined)assert.equal(G.currentPitcher(s).pitches,c.pitches);
 }
});
test('Japan date switches at 15:00 UTC and leap dates validate',()=>{
 assert.equal(G.japanDate(new Date('2026-09-16T14:59:59Z')),'2026-09-16');assert.equal(G.japanDate(new Date('2026-09-16T15:00:00Z')),'2026-09-17');
 assert.throws(()=>G.dailySpec('2026-02-30'));assert.doesNotThrow(()=>G.dailySpec('2028-02-29'));
});
test('all users share daily conditions; every 7 days covers all seven scenarios',()=>{
 const dates=Array.from({length:7},(_,i)=>'2026-09-'+(16+i));assert.equal(new Set(dates.map(d=>G.dailySpec(d).scenario)).size,7);
 for(const d of dates){const a=G.createDailyGame(d,'a'),b=G.createDailyGame(d,'b');assert.notEqual(a.id,b.id);assert.equal(a.rng,b.rng);assert.deepEqual(a.daily,b.daily);finish(a);finish(b);assert.deepEqual(a.score,b.score);assert.deepEqual(a.log,b.log);assert.deepEqual(a.decisions,b.decisions);}
});
test('daily RNG state and result survive serialization',()=>{
 const a=G.createDailyGame('2026-09-16','1');G.step(a,a.half==='home'?'power':'low');const b=JSON.parse(JSON.stringify(a));finish(a);finish(b);assert.deepEqual(a,b);
});
test('bunt percentage uses same ability formula as simulation and invalid states return null',()=>{
 const s=G.createGame('advance',88);assert.equal(G.buntChance(s),.40+86*.005-(73-70)*.001);s.outs=2;assert.equal(G.buntChance(s),null);
 assert.equal(G.effectiveDefense(s.teams.home.lineup[7],'捕'),94);assert.equal(G.effectiveDefense(s.teams.home.bench[1],'捕'),58);assert.equal(G.effectiveDefense(s.teams.home.bench[0],'捕'),15);assert.equal(G.effectiveDefense(s.teams.home.bench[0],'指'),null);
});
test('motion plans preserve exact base paths and never change game state or random numbers',()=>{
 const seen=new Set();
 for(let i=1;i<=450;i++){
  const s=G.createGame(Object.keys(G.scenarios)[i%7],i*7111);let n=0;
  while(!s.done&&n++<150){let a=s.half==='home'?'power':'normal';if(n%5===0&&s.half==='home'&&G.canBunt(s))a='bunt';if(n%7===0&&s.half==='home'&&G.stealInfo(s))a='steal';const r=G.step(s,a);assert(r.ok);const before=JSON.stringify(s),plan=M.plan(r.play);assert.equal(before,JSON.stringify(s));assert(plan.ball.length>=2);assert.equal(r.play.scored.length,r.play.runs);seen.add(r.play.outcome);
   for(const x of plan.runners){assert(x.points.length>=1);assert(x.points.every(p=>p.length===2&&p.every(v=>Number.isFinite(v)&&v>=0&&v<=100)));if(x.scored)assert.deepEqual(x.points.at(-1),[50,84]);}
   for(const side of ['home','away'])assert.equal(s.lines[side].reduce((sum,x)=>sum+(Number(x)||0),0),s.score[side]);
  }assert(s.done);
 }
 for(const outcome of ['single','double','triple','hr','dp','bunt','buntOut','steal','caught','bb','k','fly','ground','sac','error'])assert(seen.has(outcome),'not covered: '+outcome);
});
test('double-play animation includes second then first and both outs',()=>{
 const p={outcome:'dp',beforeBases:[{id:'r',name:'走者'},null,null],afterBases:[null,null,null],batter:{id:'b',name:'打者'},outIds:['r','b'],scored:[],direction:0};const m=M.plan(p);assert.deepEqual(m.ball.slice(-2),[[50,38.2],[84.5,52.4]]);assert.equal(m.runners.filter(x=>x.out).length,2);
});
