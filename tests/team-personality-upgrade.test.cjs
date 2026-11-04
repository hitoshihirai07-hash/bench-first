'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const G=require('../public/engine.js');

test('team style has meaningful strengths, weaknesses, and unchanged user roster',()=>{
  const base=G.createGame('tie',31,{opponent:'balanced'});
  const power=G.createGame('tie',31,{opponent:'power'});
  const defense=G.createGame('tie',31,{opponent:'defense'});
  assert.deepEqual(power.teams.home,base.teams.home);
  assert.deepEqual(defense.teams.home,base.teams.home);
  assert(power.teams.away.lineup[3].power>base.teams.away.lineup[3].power);
  assert(power.teams.away.lineup[1].defense<base.teams.away.lineup[1].defense);
  assert(power.teams.away.pitchers[0].stamina>base.teams.away.pitchers[0].stamina);
  assert(defense.teams.away.lineup[7].defense>base.teams.away.lineup[7].defense);
  assert(defense.teams.away.pitchers[1].control>base.teams.away.pitchers[1].control);
  assert(defense.teams.away.lineup[3].power<base.teams.away.lineup[3].power);
});

test('power club bats aggressively with runners; defense club is selective',()=>{
  function attack(type, powerValue, runners=false) {
    const s=G.createGame('tie',41,{opponent:type});s.half='away';s.inning=8;
    s.score={home:3,away:2};s.teams.away.order=5;
    Object.assign(G.currentBatter(s),{power:powerValue,contact:66});
    s.bases=runners?[s.teams.away.lineup[0],null,null]:[null,null,null];
    return G.matchupProbabilities(s,'normal');
  }
  const p=attack('power',58,true), expectedPower=(()=>{const s=G.createGame('tie',41,{opponent:'power'});s.half='away';s.inning=8;s.score={home:3,away:2};s.teams.away.order=5;Object.assign(G.currentBatter(s),{power:58,contact:66});s.bases=[s.teams.away.lineup[0],null,null];return G.probabilities(s,'power','normal');})();
  assert.deepEqual(p,expectedPower);
  const def=G.createGame('tie',41,{opponent:'defense'});def.half='away';def.inning=8;def.teams.away.order=5;def.score={home:2,away:2};Object.assign(G.currentBatter(def),{power:75,contact:66});
  assert.deepEqual(G.matchupProbabilities(def,'normal'),G.probabilities(def,'contact','normal'));
});

test('daily opponent stays balanced and daily results remain replayable',()=>{
  const date='2026-11-04',a=G.createDailyGame(date,'one'),b=G.createDailyGame(date,'two');
  assert.equal(a.opponent,'balanced');assert.equal(a.daily.code,b.daily.code);
  let n=0;
  while(!a.done&&n++<150){const action=a.half==='home'?'contact':'normal';assert(G.step(a,action).ok);assert(G.step(b,action).ok);assert.deepEqual(a.score,b.score);assert.equal(a.rng,b.rng);}
  assert(a.done&&b.done);
});
