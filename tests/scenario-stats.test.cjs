const test = require('node:test');
const assert = require('node:assert/strict');
const { summarize, display } = require('../public/scenario-stats.js');
const scenes = { chase: {}, protect: {}, miracle: {} };
const result = (scenario, outcome, opponent = 'balanced', daily = null, revision = '05') =>
  ({ scenario, result: outcome, opponent, daily, balanceRevision: revision });
test('シナリオ・相手タイプごとに勝敗を分類する', () => {
  const history = [result('chase','win'), result('chase','loss','power'),result('chase','draw','balanced'),result('protect','win','defense')];
  const data = summarize(history, scenes, '05');
  assert.deepEqual(data.byScenario.chase.all, {win:1,loss:1,draw:1,total:3});
  assert.deepEqual(data.byScenario.chase.opponents.balanced, {win:1,loss:0,draw:1,total:2});
  assert.deepEqual(data.byScenario.chase.opponents.power, {win:0,loss:1,draw:0,total:1});
  assert.equal(data.byScenario.miracle.all.total,0);
  assert.equal(display(data.byScenario.miracle.all),'未挑戦');
});
test('共通のお題は自由挑戦から分け、旧確率版を集計しない', () => {
  const rows = [result('chase','win'),result('chase','loss','balanced',{code:'02-20261020', balanceRevision:'05'}),result('chase','win','balanced',null,'04'),result('chase','win','balanced',{code:'old',balanceRevision:'04'})];
  const data = summarize(rows,scenes,'05');
  assert.equal(data.overall.total,1);
  assert.equal(data.daily.total,1);
  assert.equal(data.previousRevision,2);
});
test('既存の相手情報なしはバランス型扱い、データ破損は無視する', () => {
  const data = summarize([{scenario:'chase',result:'win',balanceRevision:'05'}, {scenario:'unknown',result:'win',balanceRevision:'05'}, null],scenes,'05');
  assert.equal(data.byScenario.chase.opponents.balanced.win,1);
  assert.equal(data.overall.total,1);
});
test('記録は末尾100件を対象とする', () => {
  const data=summarize(Array(101).fill(null).map((_,i)=>result('chase',i===0?'win':'loss')),scenes,'05');
  assert.equal(data.overall.total,100);
  assert.equal(data.overall.win,0);
});
