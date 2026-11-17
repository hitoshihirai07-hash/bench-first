const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = require('../public/engine.js');
const C = require('../public/custom-scenarios.js');
const T = require('../public/scenario-stats.js');
const R = require('../public/replay-compare.js');

function situation(runnerIndex = 0, type = 'mobility') {
  const game = G.createGame('tie', 123, {opponent:type});
  game.half = 'away';
  game.outs = 0;
  game.score.home = game.score.away = 2;
  game.teams.away.order = 1;
  game.bases = [game.teams.away.lineup[runnerIndex], null, null];
  return game;
}

test('機動力型だけに走力・小技の特色を追加し、ユーザーチームと投手を維持', () => {
  const standard = G.createGame('tie', 20);
  const mobile = G.createGame('tie', 20, {opponent:'mobility'});
  assert.deepEqual(mobile.teams.home, standard.teams.home);
  assert.deepEqual(mobile.teams.away.pitchers, standard.teams.away.pitchers);
  assert(mobile.teams.away.lineup[0].speed > standard.teams.away.lineup[0].speed);
  assert(mobile.teams.away.lineup[1].bunt > standard.teams.away.lineup[1].bunt);
  assert(mobile.teams.away.lineup[3].power < standard.teams.away.lineup[3].power);
});

test('機動力型の盗塁で打順を消費せず、CPUの作戦と結果が残る', () => {
  const game = situation(), oldOrder = game.teams.away.order;
  assert.equal(G.cpuTacticChoice(game), 'steal');
  const result = G.step(game, 'normal');
  assert(result.ok);
  assert(['steal', 'caught'].includes(result.play.outcome));
  assert.equal(game.teams.away.order, oldOrder);
  assert.equal(game.review.items.at(-1).result.cpuAction, 'steal');
  assert(game.log.some(item => item.text.includes('相手CPUが盗塁を選択')));
});

test('送りバントを選ぶ条件では打順が進み、振り返りに記録される', () => {
  const game = situation(3), oldOrder = game.teams.away.order;
  assert.equal(G.cpuTacticChoice(game), 'bunt');
  const result = G.step(game, 'normal');
  assert(result.ok);
  assert(['bunt', 'buntOut'].includes(result.play.outcome));
  assert.equal(game.teams.away.order, (oldOrder + 1) % 9);
  assert.equal(game.review.items.at(-1).result.cpuAction, 'bunt');
});

test('大差・2アウトでは小技を乱用せず、既存CPUは従来の打撃を選択', () => {
  for (const type of ['balanced', 'power', 'defense'])
    assert(!['steal', 'bunt'].includes(G.cpuTacticChoice(situation(0, type))));
  const twoOut = situation();
  twoOut.outs = 2;
  assert(!['steal', 'bunt'].includes(G.cpuTacticChoice(twoOut)));
  const deficit = situation();
  deficit.score.home = 6;
  assert(!['steal', 'bunt'].includes(G.cpuTacticChoice(deficit)));
});

test('自由シナリオ、CPU別戦績、同条件再挑戦に機動力型が対応', () => {
  const spec = C.normalize({...C.defaultSpec, opponent:'mobility'});
  assert.match(C.formHTML(spec), /機動力型/);
  assert.equal(G.createGame('custom', 31, {opponent:'mobility',custom:spec}).opponent, 'mobility');
  const stats = T.summarize([{scenario:'tie',result:'win',opponent:'mobility',balanceRevision:G.BALANCE_REVISION}],G.scenarios,G.BALANCE_REVISION);
  assert.equal(stats.byScenario.tie.opponents.mobility.win, 1);
  const a = situation(), b = situation();
  for (let i = 0; i < 15 && !a.done; i++) {
    const action = a.half === 'away' ? 'normal' : 'contact';
    G.step(a,action);G.step(b,action);
  }
  assert.deepEqual(a,b);
  assert.equal(R.comparable(R.snapshot(a),R.snapshot(b)), true);
});

test('300試合の攻守交代、得点、走者、試合終了に矛盾がない', () => {
  let special = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const game = G.createGame(['tie','chase','lead'][seed % 3],seed,{opponent:'mobility'});
    let count = 0;
    while (!game.done && count++ < 200) {
      const play = G.step(game,game.half === 'away' ? 'normal' : 'contact');
      assert(play.ok);
      if (play.play.cpuAction) special++;
      const runners = game.bases.filter(Boolean).map(player => player.id);
      assert.equal(new Set(runners).size, runners.length);
      for (const side of ['home','away'])
        assert.equal(game.score[side],game.lines[side].reduce((sum,x) => sum + (Number(x) || 0),0));
    }
    assert(game.done);
  }
  assert(special > 0, 'CPUの小技が一度も選択されなかった');
});