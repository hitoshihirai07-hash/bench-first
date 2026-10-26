/* シナリオ別戦績: 既存の直近100試合の履歴から表示用データを集計する。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BenchStats = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const results = ['win', 'loss', 'draw'];
  const opponentKeys = ['balanced', 'power', 'defense'];
  function empty() { return { win: 0, loss: 0, draw: 0, total: 0 }; }
  function add(stats, result) { stats[result]++; stats.total++; }
  function summarize(history, scenarios, currentRevision) {
    const rows = Array.isArray(history) ? history.slice(-100) : [];
    const byScenario = {};
    for (const scenario of Object.keys(scenarios)) {
      const opponents = {};
      for (const key of opponentKeys) opponents[key] = empty();
      byScenario[scenario] = { all: empty(), opponents };
    }
    const output = { byScenario, overall: empty(), daily: empty(), previousRevision: 0, stored: rows.length, squeeze: {attempts:0,success:0,fail:0} };
    for (const row of rows) {
      if (!row || !Object.prototype.hasOwnProperty.call(byScenario, row.scenario) || !results.includes(row.result)) continue;
      if (row.balanceRevision !== currentRevision || (row.daily && row.daily.balanceRevision !== currentRevision)) {
        output.previousRevision++;
        continue;
      }
      if (row.squeeze) {
        for (const key of ['attempts','success','fail']) {
          const v=row.squeeze[key];if(Number.isInteger(v)&&v>=0)output.squeeze[key]+=v;
        }
      }
      if (row.daily) { add(output.daily, row.result); continue; }
      const opponent = row.opponent || 'balanced';
      if (!opponentKeys.includes(opponent)) continue;
      add(output.overall, row.result);
      add(byScenario[row.scenario].all, row.result);
      add(byScenario[row.scenario].opponents[opponent], row.result);
    }
    return output;
  }
  function display(stats) { return stats.total ? `${stats.win}勝${stats.loss}敗${stats.draw}分` : '未挑戦'; }
  return { summarize, display };
});
