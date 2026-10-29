'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const G = require('../public/engine.js');
const R = require('../public/replay-compare.js');
test('同じ開始条件と相手タイプを再現する', () => {
  const a=G.createGame('ace',192837465,{opponent:'power'});
  const b=G.createGame('ace',192837465,{opponent:'power'});
  assert.deepEqual(a,b);
  assert.equal(R.seed(a),192837465);
  assert.equal(R.seed({...a,replaySeed:192837465}),192837465);
});
test('同じ作戦なら結果が一致する', () => {
  const a=G.createGame('squeeze',191919,{opponent:'defense'});
  const b=G.createGame('squeeze',191919,{opponent:'defense'});
  G.step(a,'squeeze');G.step(b,'squeeze');assert.deepEqual(a,b);
});
test('采配を変えると比較表に両方を記録できる', () => {
  const a=G.createGame('squeeze',44);
  const b=G.createGame('squeeze',44);
  G.step(a,'squeeze');G.step(b,'contact');
  const x=R.snapshot(a),y=R.snapshot(b);
  assert.equal(R.comparable(x,y),true);
  const rows=R.rows(x,y);
  assert.match(rows[0].previous.action,/スクイズ/);
  assert.match(rows[0].current.action,/ミート/);
  assert.match(rows[0].previous.situation,/9回裏/);
  assert.equal(R.comparable(x,{...y,opponent:'power'}),false);
});
test('前回の比較情報をセーブ・復元できる', () => {
  const a=G.createGame('ace',1001),before=R.snapshot(a);
  a.replayPrevious=JSON.parse(JSON.stringify(before));
  assert.equal(R.comparable(a.replayPrevious,R.snapshot(a)),true);
});
test('UIが再挑戦と比較を読み込む', () => {
  const app=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
  assert.match(app,/function retrySameConditions\(/);
  assert.match(app,/function replayComparisonHTML\(/);
  assert.match(app,/scoreTable\(\)\+replayComparisonHTML\(\)/);
  assert.match(html,/replay-compare\.js\?v=01/);
});
