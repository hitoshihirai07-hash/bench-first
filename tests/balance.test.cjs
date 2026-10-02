'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),G=require('../public/engine.js');
const reach=p=>p.single+p.double+p.triple+p.hr+p.bb;
test('CPU preserves a capable cleanup hitter in the eighth instead of replacing him with a reserve catcher',()=>{
  const s=G.createGame('ace',18);assert.equal(G.currentBatter(s).id,'a3');
});
test('CPU protects a late lead instead of sacrificing its catcher defense for a pinch hit',()=>{
  const s=G.createGame('ace',18);s.score.away=4;s.score.home=3;s.teams.away.order=7;s.preparedTurn=null;G.prepareTurn(s);
  assert.equal(G.currentBatter(s).id,'a7');
});
test('a contact pinch hitter gives a meaningful improvement over the light-hitting catcher',()=>{
  const s=G.createGame('chase',18),before=reach(G.probabilities(s));G.replacePlayer(s,7,'h10');
  assert(reach(G.probabilities(s))>before+.09);
});
test('a fresh controlled reliever materially reduces reaching base versus an exhausted starter',()=>{
  const s=G.createGame('ace',18),before=reach(G.probabilities(s));G.changePitcher(s,'home',3);
  assert(reach(G.probabilities(s))<before-.07);
});
test('contact emphasis and high-stuff strikeout pitching have perceptible effects with tradeoffs',()=>{
  const s=G.createGame('tie',18),contact=G.probabilities(s,'contact'),power=G.probabilities(s,'power');
  assert(reach(contact)>reach(power)+.035);assert(power.hr>contact.hr&&power.k>contact.k);
  const p=G.currentPitcher(s);p.stuff=91;p.control=85;p.pitches=0;
  const normal=G.probabilities(s,'contact','normal'),k=G.probabilities(s,'contact','strikeout');
  assert(k.k>normal.k+.085);assert(reach(k)<reach(normal)-.015);assert(k.bb>normal.bb);
});
test('tactic previews use the current opponent and distinguish attacking and pitching contact commands',()=>{
  const offense=G.createGame('chase',17);assert.deepEqual(G.matchupProbabilities(offense,'contact'),G.probabilities(offense,'contact','low'));
  const defense=G.createGame('ace',17);assert.deepEqual(G.matchupProbabilities(defense,'contact'),G.probabilities(defense,'power','contact'));
  assert(reach(G.matchupProbabilities(offense,'contact'))>reach(G.matchupProbabilities(offense,'power')));
});
test('today fatigue mission is not decided in advance in favor of doing nothing',()=>{
  const s=G.createDailyGame('2026-10-02','basic');let n=0;
  while(!s.done&&n++<100)G.step(s,s.half==='home'?'contact':'normal');
  assert(s.done);assert.notEqual(s.result,'win');
});
function fixedPlan(G,initialPitcher,defense,attack,pinch){
  const s=G.createDailyGame('2026-10-02','test');
  if(initialPitcher)G.changePitcher(s,'home',initialPitcher);
  let turns=0;
  while(!s.done&&turns++<150){
    if(pinch&&s.half==='home'&&s.teams.home.order===7&&s.teams.home.bench.some(p=>p.id==='h10'))G.replacePlayer(s,7,'h10');
    const action=s.half==='away'?defense:attack==='ability'?(G.currentBatter(s).power>=75?'power':'contact'):attack;
    assert(G.step(s,action).ok);
  }
  assert(s.done);return s.result;
}
test('today common mission has several winning decisions and still responds to choices',()=>{
  let wins=0,losses=0,draws=0;
  const winningPitchers=new Set(),winningDefenses=new Set();
  for(let pitcher=0;pitcher<4;pitcher++)for(const defense of ['normal','strikeout','contact','low'])
    for(const attack of ['contact','power','ability'])for(const pinch of [false,true]){
      const result=fixedPlan(G,pitcher,defense,attack,pinch);
      if(result==='win'){wins++;winningPitchers.add(pitcher);winningDefenses.add(defense);}
      else if(result==='loss')losses++;else draws++;
    }
  console.log('Today common mission: 96 fixed plans:',{wins,losses,draws});
  assert(wins>=24,'too few ordinary choices lead to a win');
  assert(losses>0,'choices must still affect the result');
  assert(winningPitchers.size>=2&&winningDefenses.size>=2,'winning requires one hidden exact answer');
});
test('upcoming daily missions validate multiple playable plans and preserve date/scenario determinism',()=>{
  const scenes=new Set();
  for(let i=0;i<60;i++){
    const date=new Date(Date.UTC(2026,9,2+i)).toISOString().slice(0,10),d=G.dailySpec(date);
    assert(d.verifiedPlans>=2,date+' has fewer than two validated plans');
    assert.equal(d.balanceRevision,G.BALANCE_REVISION);
    assert.deepEqual(G.dailySpec(date),d);scenes.add(d.scenario);
    const a=G.createDailyGame(date,'a'),b=G.createDailyGame(date,'b');
    for(let n=0;n<150&&!a.done;n++){
      const action=a.half==='home'?'contact':'normal';G.step(a,action);G.step(b,action);
      assert.deepEqual(a.score,b.score);assert.equal(a.rng,b.rng);
    }
    assert(a.done&&b.done);assert.equal(a.result,b.result);
  }
  assert.equal(scenes.size,7);
});
test('tomorrow last-chance mission has distinct winning decisions, not duplicate strategy profiles',()=>{
  const wins=new Set();
  for(const sub of [null,'h9','h10','h11'])for(const attack of ['contact','power'])
    for(const nextSub of [null,'h9','h11'])for(const nextAttack of ['contact','power']){
      const s=G.createDailyGame('2026-10-03');if(sub)assert(G.replacePlayer(s,7,sub));
      let n=0;while(!s.done&&n<150){
        if(n===1&&nextSub&&s.half==='home'&&s.teams.home.bench.some(p=>p.id===nextSub))G.replacePlayer(s,s.teams.home.order,nextSub);
        G.step(s,s.half==='home'?(n===0?attack:nextAttack):'normal');n++;
      }
      assert(s.done);if(s.result==='win')wins.add(JSON.stringify(s.decisions));
    }
  assert(wins.size>=2,'winning strategy profiles repeat the same actual decision');
});
