'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const G=require('../public/engine.js');

test('opponent types explain distinct CPU strategy',()=>{
  assert.match(G.opponentTypes.balanced.tip,/癖|状況/);
  assert.match(G.opponentTypes.power.tip,/強攻|長打/);
  assert.match(G.opponentTypes.defense.tip,/継投|守備/);
});

test('CPU batting approach changes by opponent type',()=>{
  const make=type=>{const s=G.createGame('tie',41,{opponent:type});s.half='away';s.inning=8;s.score.home=2;s.score.away=2;s.teams.away.order=5;Object.assign(G.currentBatter(s),{power:68,contact:66});return s;};
  const expectAttack=(s,attack)=>assert.deepEqual(G.matchupProbabilities(s,'normal'),G.probabilities(s,attack,'normal'));
  expectAttack(make('balanced'),'contact');
  expectAttack(make('power'),'power');
  expectAttack(make('defense'),'contact');
  const defense=make('defense');defense.score.away=0;Object.assign(G.currentBatter(defense),{power:86});
  expectAttack(defense,'power');
});

test('defense type hooks earlier while power type trusts starter longer',()=>{
  const make=type=>{const s=G.createGame('tie',42,{opponent:type});s.inning=8;s.half='home';s.score.home=s.score.away=2;s.bases=[s.teams.home.lineup[0],null,null];const p=G.currentPitcher(s);p.pitches=Math.round(p.stamina*.92);s.preparedTurn=null;return s;};
  const balanced=make('balanced'),power=make('power'),defense=make('defense');
  G.prepareTurn(balanced);G.prepareTurn(power);G.prepareTurn(defense);
  assert.equal(G.currentPitcher(balanced).id,'ap0');
  assert.equal(G.currentPitcher(power).id,'ap0');
  assert.notEqual(G.currentPitcher(defense).id,'ap0');
});

test('power type spends a bench slugger sooner than balanced type',()=>{
  const make=type=>{const s=G.createGame('tie',43,{opponent:type});s.inning=8;s.half='away';s.outs=0;s.score.home=s.score.away=2;s.bases=[null,null,null];s.teams.away.order=7;Object.assign(G.currentBatter(s),{contact:68,power:70});for(const p of s.teams.away.bench.filter(p=>p.id!=='a9'))Object.assign(p,{contact:30,power:20,eye:20});s.preparedTurn=null;return s;};
  const balanced=make('balanced'),power=make('power');
  const balancedBefore=G.currentBatter(balanced).id,powerBefore=G.currentBatter(power).id;
  G.prepareTurn(balanced);G.prepareTurn(power);
  assert.equal(G.currentBatter(balanced).id,balancedBefore);
  assert.notEqual(G.currentBatter(power).id,powerBefore);
  assert.equal(G.currentBatter(power).id,'a9');
});

test('defense type starts protecting a lead one inning earlier',()=>{
  const make=type=>{const s=G.createGame('tie',44,{opponent:type});s.inning=7;s.half='home';s.score.away=3;s.score.home=2;s.bases=[null,null,null];s.teams.away.lineup[6].defense=20;const sub=s.teams.away.bench.find(p=>p.id==='a11');sub.defense=99;s.preparedTurn=null;return s;};
  const balanced=make('balanced'),defense=make('defense');
  const balancedBench=balanced.teams.away.bench.length,defenseBench=defense.teams.away.bench.length;
  G.prepareTurn(balanced);G.prepareTurn(defense);
  assert.equal(balanced.teams.away.bench.length,balancedBench);
  assert(defense.teams.away.bench.length<defenseBench);
  assert(defense.log.some(x=>x.text.includes('相手の守備交代')));
});
