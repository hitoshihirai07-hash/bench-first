'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const G=require('../public/engine.js');
function seek(setup,action,predicate){for(let seed=1;seed<20000;seed++){const s=G.createGame('chase',seed);setup(s);const r=G.step(s,action);if(predicate(s,r))return s;}throw Error('No matching outcome');}
test('3 scenarios have consistent starting scoreboard and base runner',()=>{
  for(const key of Object.keys(G.scenarios)){const s=G.createGame(key,123);assert.equal(s.inning,7);assert.equal(s.outs,1);assert.equal(s.bases[0].id,'h6');for(const t of ['home','away'])assert.equal(s.lines[t].reduce((a,b)=>a+(Number(b)||0),0),s.score[t]);}
});
test('seeded game can be reproduced',()=>{const a=G.createGame('tie',123),b=G.createGame('tie',123);for(let i=0;i<50&&!a.done;i++){const cmd=a.half==='home'?'power':'normal';G.step(a,cmd);G.step(b,cmd);}assert.deepEqual(a,b);});
test('pinch hitter leaves permanently, catcher aptitude changes defensive strength',()=>{
  const s=G.createGame('chase',55),before=G.fieldDefense(s.teams.home);assert.equal(G.replacePlayer(s,7,'h10','pinch'),true);assert.equal(s.teams.home.lineup[7].id,'h10');assert(G.fieldDefense(s.teams.home)<before);assert.equal(G.replacePlayer(s,7,'h7','pinch'),false);assert.equal(G.replacePlayer(s,0,'h9','pinch'),false);
});
test('pinch runner replaces runner and same batting-order slot',()=>{const s=G.createGame();assert(G.replacePlayer(s,6,'h11','runner'));assert.equal(s.bases[0].id,'h11');assert.equal(s.teams.home.lineup[6].id,'h11');});
test('pitcher re-entry prohibited',()=>{const s=G.createGame();assert(G.changePitcher(s,'home',2));assert.equal(G.changePitcher(s,'home',0),false);assert.equal(G.changePitcher(s,'home',2),false);});
test('walk advances only forced runners',()=>{
  const s=seek(s=>{s.bases=[null,s.teams.home.lineup[1],s.teams.home.lineup[2]];},'contact',s=>s.stats.home.bb===1);assert.equal(s.bases[0].id,'h7');assert.equal(s.bases[1].id,'h1');assert.equal(s.bases[2].id,'h2');assert.equal(s.score.home,2);
  const loaded=seek(s=>{s.bases=s.teams.home.lineup.slice(0,3);},'contact',s=>s.stats.home.bb===1);assert.equal(loaded.score.home,3);assert.deepEqual(loaded.bases.map(p=>p.id),['h7','h0','h1']);
});
test('bunt restrictions and successful advancement',()=>{const s=G.createGame();s.outs=2;assert(!G.canBunt(s));assert(!G.step(s,'bunt').ok);s.outs=1;s.bases[2]=s.teams.home.lineup[2];assert(!G.canBunt(s));const b=seek(()=>{},'bunt',s=>s.log.some(x=>x.kind==='bunt'));assert.equal(b.outs,2);assert.equal(b.bases[0],null);assert.equal(b.bases[1].id,'h6');assert.equal(b.teams.home.order,8);});
test('steal preserves current batter and handles third out',()=>{
  const a=seek(()=>{},'steal',s=>s.log.some(x=>x.kind==='steal'));assert.equal(a.teams.home.order,7);assert.equal(a.bases[0],null);assert.equal(a.bases[1].id,'h6');
  const b=seek(s=>{s.outs=2;},'steal',s=>s.half==='away');assert.equal(b.inning,8);assert.equal(b.teams.home.order,7);assert(b.bases.every(x=>x===null));
});
test('third out on a fly does not score a run',()=>{
  const s=seek(s=>{s.outs=2;s.bases=[null,null,s.teams.home.lineup[0]];},'contact',s=>s.log.some(x=>x.text.includes('フライアウト')));assert.equal(s.score.home,2);assert.equal(s.inning,8);
});
test('ground double play ends half and clears bases',()=>{
  const s=seek(()=>{},'contact',s=>s.log.some(x=>x.text.includes('ゴロ併殺')));assert.equal(s.half,'away');assert.equal(s.outs,0);assert(s.bases.every(x=>x===null));
});
test('9th top ends with home lead: bottom skipped',()=>{
  const s=seek(s=>{s.inning=9;s.half='away';s.outs=2;s.score.home=8;s.score.away=2;s.lines.away[8]=0;s.bases=[null,null,null];},'strikeout',s=>s.done);assert.equal(s.result,'win');assert.equal(s.lines.home[8],'×');assert.equal(s.half,'away');
});
test('walkoff home run counts every runner and game ends',()=>{
  const s=seek(s=>{s.inning=9;s.score.home=s.score.away=3;s.lines.home[8]=0;s.bases=s.teams.home.lineup.slice(0,3);},'power',s=>s.stats.home.hr===1);assert(s.done);assert.equal(s.score.home,7);assert.equal(s.result,'win');
});
test('walkoff non-home run stops at winning run',()=>{
  const s=seek(s=>{s.inning=9;s.score.home=s.score.away=3;s.lines.home[8]=0;s.bases=s.teams.home.lineup.slice(0,3);},'contact',s=>s.done&&s.log.some(x=>x.kind==='hit'));assert.equal(s.score.home,4);assert.equal(s.result,'win');
});
test('9th bottom draw and loss end with three outs',()=>{
  for(const gap of [0,1]){const s=seek(s=>{s.inning=9;s.outs=2;s.score.home=2;s.score.away=2+gap;s.lines.home[8]=0;s.bases=[null,null,null];},'contact',s=>s.done&&!s.stats.home.h&&!s.stats.home.bb);assert.equal(s.result,gap?'loss':'draw');}
});
test('finished games reject further plays',()=>{const s=G.createGame();s.done=true;const snapshot=JSON.stringify(s);assert.equal(G.step(s).ok,false);assert.equal(JSON.stringify(s),snapshot);});
test('tactics, handedness, fatigue and defense influence probabilities',()=>{
  const s=G.createGame(),a=G.probabilities(s,'contact'),b=G.probabilities(s,'power');assert(b.hr>a.hr&&b.k>a.k);
  const c=G.probabilities(s,'contact','strikeout');assert(c.k>a.k&&c.bb>a.bb);
  G.currentPitcher(s).pitches=180;assert(G.probabilities(s).bb>a.bb);
  const old=G.probabilities(s).error;s.teams.away.lineup[7].defense=10;assert(G.probabilities(s).error>old);
});
test('1500 full games: score conservation, no duplicate runners, legal order and termination',()=>{
  const counts={win:0,loss:0,draw:0};let maxPlays=0;
  for(let seed=1;seed<=1500;seed++){
    const s=G.createGame(['chase','tie','lead'][seed%3],seed*9367);let n=0;
    while(!s.done&&n++<300){
      let action=s.half==='home'?(seed%2?'contact':'power'):['normal','strikeout','contact','low'][seed%4];
      if(s.half==='home'&&n%7===0&&G.canBunt(s))action='bunt';
      if(s.half==='home'&&n%11===0&&G.stealInfo(s))action='steal';
      assert(G.step(s,action).ok);assert(s.outs>=0&&s.outs<3);const ids=s.bases.filter(Boolean).map(x=>x.id);assert.equal(new Set(ids).size,ids.length);
      for(const t of ['home','away']){assert.equal(s.lines[t].reduce((a,b)=>a+(Number(b)||0),0),s.score[t]);assert(s.teams[t].order>=0&&s.teams[t].order<9);}
      for(const v of Object.values(G.probabilities(s)))assert(v>=0&&v<=1);
    }
    assert(s.done,'game failed to finish');counts[s.result]++;maxPlays=Math.max(maxPlays,n);
  }
  console.log('Simulation smoke:',counts,'max plays:',maxPlays);assert(Object.values(counts).every(n=>n>0));
});
