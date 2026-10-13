'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('../public/engine.js'),S=require('../public/sharing.js');

test('protect starts the ninth top tied with one out and only the previous batter on third',()=>{
  const s=G.createGame('protect',42);
  assert.equal(s.scenario,'protect');assert.equal(s.inning,9);assert.equal(s.half,'away');assert.equal(s.outs,1);
  assert.deepEqual(s.score,{home:2,away:2});assert.deepEqual(s.bases.map(p=>p?.id||null),[null,null,'a3']);
  assert.equal(G.currentBatter(s).id,'a4');assert.equal(s.lines.away[8],0);assert.equal(s.lines.home[8],null);
});

test('protect permits a real choice between normal and infield-in before pitching',()=>{
  const s=G.createGame('protect',42),rng=s.rng,outs=s.outs;
  const normal=G.matchupProbabilities(s,'normal');
  assert.equal(G.setDefense(s,'in'),true);
  const infield=G.matchupProbabilities(s,'normal');
  assert(infield.single>normal.single,'playing in must carry the existing hit risk');
  assert.equal(s.rng,rng);assert.equal(s.outs,outs);assert.equal(s.plays,0);
  assert.equal(G.setDefense(s,'normal'),true);assert.equal(s.defense,'normal');
});

test('protect resumes and finishes identically after JSON saving for all opponent types',()=>{
  for(const opponent of ['balanced','power','defense']){
    const a=G.createGame('protect',317,{opponent});assert.equal(a.scenario,'protect');G.setDefense(a,'in');G.step(a,'low');
    const b=JSON.parse(JSON.stringify(a));
    let steps=0;while(!a.done&&steps++<100){const action=a.half==='away'?'low':'contact';G.step(a,action);G.step(b,action);}
    assert(a.done);assert.deepEqual(a,b);assert.equal(a.inning,9);
    for(const side of ['home','away'])assert.equal(a.lines[side].reduce((sum,x)=>sum+(Number(x)||0),0),a.score[side]);
  }
});

test('protect scenario links retain the selected opponent and result links round trip',()=>{
  const s=G.createGame('protect',99,{opponent:'defense'});
  assert.deepEqual(S.parse(new URL(S.link('scenario','protect','defense')).search,G),{kind:'scenario',scenario:'protect',opponent:'defense'});
  assert.match(S.resultLink(s),/scenario=protect&opponent=defense/);
});

test('adding a free scenario leaves existing pinned daily seeds and rotation unchanged',()=>{
  assert.deepEqual(G.dailySpec('2026-09-16'),{date:'2026-09-16',scenario:'lead',seed:3695667629,code:'02-20260916'});
  assert.deepEqual(G.dailySpec('2026-10-13'),{date:'2026-10-13',scenario:'tie',seed:3269698935,verifiedPlans:2,balanceRevision:'05',code:'02-20261013'});
  assert.deepEqual(G.dailySpec('2026-10-14'),{date:'2026-10-14',scenario:'lead',seed:3879548601,verifiedPlans:3,balanceRevision:'05',code:'02-20261014'});
});
