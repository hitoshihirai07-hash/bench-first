'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('../public/engine.js');
const hits=p=>p.single+p.double+p.triple+p.hr;
test('ordinary fresh matchups have bounded batting average including home runs',()=>{
  const s=G.createGame('tie',21);Object.assign(G.currentBatter(s),{contact:65,power:60,eye:60,hand:'右'});
  Object.assign(G.currentPitcher(s),{stuff:75,control:70,pitches:0,hand:'左'});
  for(const attack of ['contact','power']){const p=G.probabilities(s,attack);assert(hits(p)/(1-p.bb)<.29);assert(Math.abs(Object.values(p).reduce((a,b)=>a+b,0)-1)<1e-10);}
});
test('pitcher stuff and control restrain hits; fatigue and tactics carry distinct costs',()=>{
  const s=G.createGame('tie',21),p=G.currentPitcher(s);p.pitches=0;
  Object.assign(p,{stuff:45,control:45});const weak=G.probabilities(s);
  Object.assign(p,{stuff:95,control:95});const strong=G.probabilities(s);
  assert(hits(strong)<hits(weak)-.07);assert(strong.bb<weak.bb);assert(strong.k>weak.k);
  const low=G.probabilities(s,'contact','low'),k=G.probabilities(s,'contact','strikeout');assert(low.hr<strong.hr&&k.k>strong.k&&k.bb>strong.bb);
  p.pitches=p.stamina*1.3;assert(hits(G.probabilities(s))>hits(strong));
});
test('equal player abilities yield the same probabilities regardless of the operated side',()=>{
  const a=G.createGame('tie',17),b=G.createGame('ace',18);b.half='away';b.defense=a.defense;
  Object.assign(G.currentBatter(b),G.currentBatter(a));Object.assign(G.currentPitcher(b),G.currentPitcher(a));b.teams.home.lineup=JSON.parse(JSON.stringify(a.teams.away.lineup));
  for(const defense of ['normal','strikeout','contact','low'])assert.deepEqual(G.probabilities(a,'contact',defense),G.probabilities(b,'contact',defense));
});
test('CPU pitcher is visible before a decision and does not change during the selected play',()=>{
  const s=G.createGame('last',27),t=s.teams.away;t.pitchers[t.pitcherIndex].pitches=150;s.preparedTurn=null;
  G.prepareTurn(s);const id=G.currentPitcher(s).id;assert.notEqual(id,'ap0');const before=JSON.stringify(s);G.prepareTurn(s);assert.equal(JSON.stringify(s),before);
  G.replacePlayer(s,7,'h9');const r=G.step(s,'power');assert.equal(r.play.pitcher.id,id);
});
test('CPU pinch hitter is shown first and the subsequent plate appearance uses that batter',()=>{
  const s=G.createGame('ace',29);s.teams.away.order=7;s.preparedTurn=null;G.prepareTurn(s);
  const b=G.currentBatter(s);assert.notEqual(b.id,'a7');const r=G.step(s,'normal');assert.equal(r.play.batter.id,b.id);
});
test('CPU pitching choices depend on leverage, handedness and fatigue',()=>{
  const s=G.createGame('tie',7);s.inning=9;s.score.away=3;s.bases=[null,null,null];s.preparedTurn=null;G.prepareTurn(s);assert.equal(G.currentPitcher(s).id,'ap3');
  const a=G.createGame('tie',8);a.inning=8;a.teams.home.order=1;a.teams.away.pitchers[0].pitches=130;a.preparedTurn=null;G.prepareTurn(a);assert.equal(G.currentPitcher(a).hand,'左');
});
test('CPU does not burn fresh relief pitchers when the closer has already been used',()=>{
  const s=G.createGame('tie',7),t=s.teams.away;s.inning=9;s.score.away=3;s.bases=[null,null,null];s.preparedTurn=null;
  t.pitcherIndex=1;t.usedPitchers=[0,3,1];t.pitchers[1].pitches=0;G.prepareTurn(s);
  assert.equal(G.currentPitcher(s).id,'ap1');assert.deepEqual(t.usedPitchers,[0,3,1]);
});
test('CPU repairs defensive aptitude without altering surviving players batting-order slots or reentry',()=>{
  const s=G.createGame('ace',29),t=s.teams.away;const old=t.lineup[7],ph=t.bench.shift();t.lineup[7]=ph;t.removed.push(old);s.half='home';s.preparedTurn=null;
  const slots=t.lineup.map(p=>p.id);G.prepareTurn(s);
  for(let i=0;i<9;i++){const pos=G.positionAt(t,i);assert(pos==='指'||t.lineup[i].pos.includes(pos));if(slots.includes(t.lineup[i].id))assert.equal(t.lineup[i].id,slots[i]);}
  assert.equal(new Set(t.fieldPositions).size,9);assert(t.removed.some(p=>p.id===old.id));assert(!t.lineup.some(p=>p.id===old.id));
});
test('scenario difficulty explains challenge before starting',()=>{
  for(const sc of Object.values(G.scenarios)){assert(Number.isInteger(sc.difficulty)&&sc.difficulty>=1&&sc.difficulty<=5);assert(sc.difficultyReason.length>0);}
  assert(G.scenarios.last.difficulty>G.scenarios.advance.difficulty);assert(G.scenarios.miracle.difficulty>G.scenarios.lead.difficulty);
});
function sample(speed,outs,outcome,base){let advances=0,total=0;
  for(let seed=1;seed<=2500;seed++){const s=G.createGame('tie',seed*3121);s.outs=outs;s.bases=[null,null,null];const runner={...s.teams.home.lineup[0],speed};s.bases[base]=runner;const r=G.step(s,'contact');if(r.play.outcome===outcome||(outcome==='fly'&&r.play.outcome==='sac')){total++;if(r.play.scored.includes(runner.id)||r.play.afterBases[base+1]?.id===runner.id)advances++;}}
  return {advances,total,rate:advances/total};
}
test('double from first can hold at third; faster runners and two outs score more often',()=>{
  const slow=sample(10,0,'double',0),fast=sample(95,0,'double',0),two=sample(95,2,'double',0);
  assert(slow.total>50&&slow.advances<slow.total);assert(fast.rate>slow.rate+.2);assert(two.rate>fast.rate);
});
test('fly balls allow second-base tag ups, influenced by speed; third out cannot score',()=>{
  const slow=sample(10,0,'fly',1),fast=sample(95,0,'fly',1);assert(fast.advances>0);assert(fast.rate>slow.rate);
  assert.equal(sample(95,2,'fly',2).advances,0);
});
test('CPU remains fieldable and games terminate across all scenarios after serialization',()=>{
  for(let seed=1;seed<=350;seed++){let s=G.createGame(Object.keys(G.scenarios)[seed%7],seed*781);let n=0;
    while(!s.done&&n++<200){G.prepareTurn(s);if(s.half==='home')for(let i=0;i<9;i++){const t=s.teams.away,pos=G.positionAt(t,i);assert(pos==='指'||t.lineup[i].pos.includes(pos));}
      assert(G.step(s,s.half==='home'?'power':'normal').ok);s=JSON.parse(JSON.stringify(s));
      assert.equal(new Set(s.bases.filter(Boolean).map(p=>p.id)).size,s.bases.filter(Boolean).length);
    }assert(s.done);
  }
});
