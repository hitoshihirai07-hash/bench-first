'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const G=require('../public/engine.js');
const make=(seed=40,type='balanced')=>G.createGame('protect',seed,{opponent:type});
function consistent(s){
  for(const side of ['home','away']){
    assert.equal(s.lines[side].reduce((sum,n)=>sum+(Number(n)||0),0),s.score[side]);
  }
}
test('intentional walk is only available when defending',()=>{
  const offense=G.createGame('chase',14),snapshot=JSON.stringify(offense);
  assert.equal(G.step(offense,'intentional').ok,false);
  assert.equal(JSON.stringify(offense),snapshot);
  const finished=make(); finished.done=true;
  const before=JSON.stringify(finished);
  assert.equal(G.step(finished,'intentional').ok,false);
  assert.equal(JSON.stringify(finished),before);
});
test('intentional walk adds a runner on first without pitches or RNG',()=>{
  const s=make(),b=G.currentBatter(s),p=G.currentPitcher(s),third=s.bases[2];
  const beforeRng=s.rng,beforePitches=p.pitches,order=s.teams.away.order;
  const result=G.step(s,'intentional');
  assert.equal(result.ok,true);
  assert.equal(result.play.outcome,'intentional');
  assert.deepEqual(s.bases.map(x=>x?.id??null),[b.id,null,third.id]);
  assert.equal(p.pitches,beforePitches);
  assert.equal(s.rng,beforeRng);
  assert.equal(s.outs,1);
  assert.equal(s.stats.away.bb,1);
  assert.equal(s.teams.away.order,(order+1)%9);
  assert.equal(result.runs,0);
  assert(s.review.items.at(-1).choices.some(v=>v.includes('申告敬遠')));
  assert.equal(s.review.items.at(-1).result.outcome,'intentional');
  consistent(s);
});
test('forced and non-forced baserunners are handled correctly',()=>{
  const cases=[
    {bases:[0,1,null],expected:['a4','a0','a1'],runs:0},
    {bases:[null,1,2],expected:['a4','a1','a2'],runs:0},
    {bases:[0,null,2],expected:['a4','a0','a2'],runs:0},
    {bases:[null,null,null],expected:['a4',null,null],runs:0},
    {bases:[0,1,2],expected:['a4','a0','a1'],runs:1}
  ];
  for(const c of cases){
    const s=make(54),t=s.teams.away,pre=s.score.away;
    s.bases=c.bases.map(i=>i===null?null:t.lineup[i]);
    const r=G.step(s,'intentional');
    assert(r.ok);
    assert.deepEqual(s.bases.map(x=>x?.id??null),c.expected);
    assert.equal(r.runs,c.runs);
    assert.equal(s.score.away,pre+c.runs);
    consistent(s);
  }
});
test('bases-loaded intentional walk scores a run and logs the review',()=>{
  const s=make(555),t=s.teams.away;
  s.bases=t.lineup.slice(0,3);
  const r=G.step(s,'intentional');
  assert.equal(r.play.scored.length,1);
  assert.equal(r.play.scored[0],'a2');
  assert(s.log.some(entry=>entry.text.includes('押し出し')));
  assert.equal(s.review.items.at(-1).result.runs,1);
  assert.equal(s.review.items.at(-1).result.outcome,'intentional');
});
test('all CPU types support save/resume and repeatable state',()=>{
  for(const type of ['balanced','power','defense']){
    const original=make(31,type);
    assert.equal(G.step(original,'intentional').ok,true);
    const loaded=JSON.parse(JSON.stringify(original));
    let steps=0;
    while(!original.done && steps++<150){
      const action=original.half==='home'?'contact':steps%4===0?'intentional':'normal';
      assert(G.step(original,action).ok);
      assert(G.step(loaded,action).ok);
      assert.deepEqual(original,loaded);
      const ids=original.bases.filter(Boolean).map(x=>x.id);
      assert.equal(new Set(ids).size,ids.length);
      consistent(original);
    }
    assert(original.done);
  }
});
test('UI, record text, animation and cache revisions are wired',()=>{
  const read=name=>fs.readFileSync(path.join(__dirname,'..','public',name),'utf8');
  assert.match(read('app.js'),/\['intentional','申告敬遠'/);
  assert.match(read('app.js'),/intentional:'申告敬遠'/);
  assert.match(read('motion.js'),/play\.outcome==='intentional'/);
  assert.match(read('index.html'),/engine\.js\?v=10/);
});
