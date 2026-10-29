/* 同一条件での再挑戦と、前回・今回の采配比較用の純粋関数。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BenchReplay = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const outcomes = {
    single:'ヒット', double:'二塁打', triple:'三塁打', hr:'ホームラン',
    bb:'四球', k:'三振', ground:'内野ゴロ', fly:'フライアウト',
    sac:'犠牲フライ', error:'エラー', dp:'併殺',
    bunt:'送りバント成功', buntOut:'送りバント失敗',
    squeeze:'スクイズ成功', squeezeHomeOut:'スクイズ失敗（本塁アウト）',
    squeezeMiss:'スクイズ空振り', squeezeFoul:'スクイズ失敗（三振）',
    squeezeBuntOut:'スクイズ失敗（打者アウト）',
    steal:'盗塁成功', caught:'盗塁失敗', intentional:'申告敬遠'
  };
  function seed(game) {
    if (!game || game.daily) return null;
    if (Number.isSafeInteger(game.replaySeed) && game.replaySeed > 0) return game.replaySeed;
    const match = typeof game.id === 'string' && /^(\d+)-/.exec(game.id);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  function location(before) {
    if (!before || !Number.isInteger(before.inning)) return '場面の記録なし';
    const bases = Array.isArray(before.bases) ? before.bases.reduce((a, runner, i) => {
      if (runner) a.push(['一','二','三'][i]);
      return a;
    }, []).join('・') : '';
    const score = before.score || {};
    return before.inning + '回' + (before.half === 'away' ? '表' : '裏') +
      ' · ' + before.outs + '死 · ' + (bases ? bases + '塁' : '走者なし') +
      ' · ' + (score.home ?? '?') + '−' + (score.away ?? '?');
  }
  function snapshot(game) {
    const plays = (Array.isArray(game?.review?.items) ? game.review.items : []).map(card => {
      const r = card.result || {}, score = r.score || {};
      const actions = Array.isArray(card.choices) ? card.choices.filter(x => typeof x === 'string') : [];
      return {
        situation: location(card.before),
        action: actions.length ? actions.join('／') : '選択の記録なし',
        outcome: (outcomes[r.outcome] || r.outcome || '結果の記録なし') +
          ' · ' + (score.home ?? '?') + '−' + (score.away ?? '?')
      };
    });
    return {
      home: game.score.home,
      away: game.score.away,
      result: game.result,
      scenario: game.scenario,
      opponent: game.opponent || 'balanced',
      dailyCode: game.daily?.code || null,
      balanceRevision: game.balanceRevision || null,
      plays
    };
  }
  function comparable(previous, now) {
    return !!previous && !!now &&
      previous.scenario === now.scenario && previous.opponent === now.opponent &&
      previous.dailyCode === now.dailyCode &&
      previous.balanceRevision === now.balanceRevision;
  }
  function rows(previous, current) {
    if (!comparable(previous, current)) return [];
    const result = [];
    for (let i = 0; i < Math.max(previous.plays.length, current.plays.length); i++) {
      result.push({ index: i + 1, previous: previous.plays[i] || null, current: current.plays[i] || null });
    }
    return result;
  }
  return { seed, snapshot, comparable, rows };
});