/* 自由シナリオの入力・検証・端末保存。試合の計算は engine.js に任せる。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BenchCustom = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KEY = 'bench-first-custom-scenarios-v1';
  const MAX_SAVED = 12;
  const opponents = ['balanced', 'power', 'defense'];
  const defaultSpec = Object.freeze({ inning: 9, half: 'home', outs: 2, home: 2, away: 4, bases: [true, true, true], order: 3, pitches: 100, opponent: 'balanced' });
  function integer(value, label, min, max) {
    const v = typeof value === 'string' ? value.trim() : value;
    if ((typeof v === 'string' && !/^\d+$/.test(v)) || !Number.isInteger(Number(v)) || Number(v) < min || Number(v) > max) {
      throw new Error(label + 'は' + min + '〜' + max + 'の整数で指定してください。');
    }
    return Number(v);
  }
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('試合の設定を確認してください。');
    const inning = integer(raw.inning, 'イニング', 7, 9);
    const half = raw.half;
    if (half !== 'home' && half !== 'away') throw new Error('表・裏を選択してください。');
    const outs = integer(raw.outs, 'アウト数', 0, 2);
    const home = integer(raw.home, 'サンライズの得点', 0, 20);
    const away = integer(raw.away, 'ブルーウェーブの得点', 0, 20);
    if (inning === 9 && half === 'home' && home > away) throw new Error('9回裏開始時に後攻がリードしている試合は成立しません。点数を変更してください。');
    if (!Array.isArray(raw.bases) || raw.bases.length !== 3 || raw.bases.some(v => typeof v !== 'boolean')) throw new Error('走者配置を確認してください。');
    const order = integer(raw.order, '打順', 0, 8);
    const pitches = integer(raw.pitches, '投手の球数', 0, 150);
    if (!opponents.includes(raw.opponent)) throw new Error('相手CPUのタイプを選択してください。');
    return { inning, half, outs, home, away, bases: [...raw.bases], order, pitches, opponent: raw.opponent };
  }
  function describe(s) {
    const bases = s.bases.every(Boolean) ? '満塁' : s.bases.every(v => !v) ? '走者なし' : s.bases.map((v, i) => v ? ['一', '二', '三'][i] : '').filter(Boolean).join('・') + '塁';
    const gap = s.home === s.away ? '同点' : s.home > s.away ? (s.home - s.away) + '点リード' : (s.away - s.home) + '点ビハインド';
    return s.inning + '回' + (s.half === 'home' ? '裏' : '表') + '・' + s.outs + '死・' + bases + '・' + gap + '（' + s.home + '−' + s.away + '）';
  }
  function htmlEscape(v) { return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  function options(values, selected) { return values.map(([val, label]) => '<option value="' + val + '"' + (String(val) === String(selected) ? ' selected' : '') + '>' + label + '</option>').join(''); }
  function formHTML(s, name = '') {
    const n = normalize(s);
    const innings = [[7,'7回'],[8,'8回'],[9,'9回']];
    const outs = [[0,'0アウト'],[1,'1アウト'],[2,'2アウト']];
    const order = Array.from({ length: 9 }, (_, i) => [i, i + 1 + '番']);
    return '<form id="custom-form" class="custom-form" novalidate>' +
      '<div class="custom-grid"><label>イニング<select name="inning">' + options(innings,n.inning) + '</select></label>' +
      '<label>表・裏<select name="half">' + options([['away','表（守備）'],['home','裏（攻撃）']],n.half) + '</select></label>' +
      '<label>サンライズの得点<input name="home" type="number" inputmode="numeric" min="0" max="20" step="1" required value="' + n.home + '"></label>' +
      '<label>ブルーウェーブの得点<input name="away" type="number" inputmode="numeric" min="0" max="20" step="1" required value="' + n.away + '"></label>' +
      '<label>アウト数<select name="outs">' + options(outs,n.outs) + '</select></label>' +
      '<label>現在の打順<select name="order">' + options(order,n.order) + '</select></label></div>' +
      '<fieldset class="custom-bases"><legend>走者配置</legend>' + ['一塁','二塁','三塁'].map((label,i) => '<label><input name="base' + i + '" type="checkbox"' + (n.bases[i] ? ' checked' : '') + '> ' + label + '</label>').join('') + '</fieldset>' +
      '<div class="custom-grid"><label>マウンドの投手の球数<select name="pitches">' + options([[70,'70球（余力あり）'],[100,'100球（疲労あり）'],[125,'125球（疲労大）']],n.pitches) + '</select></label>' +
      '<label>相手CPU<select name="opponent">' + options([['balanced','バランス型'],['power','長打型'],['defense','守備・継投型']],n.opponent) + '</select></label></div>' +
      '<p class="record-caption">打順は現在攻撃しているチームの打者です。投手の球数は守備側（マウンド上）の投手に適用します。</p>' +
      '<label class="custom-name">保存名（任意）<input name="name" type="text" maxlength="32" placeholder="例：9回裏の逆転チャンス" value="' + htmlEscape(name) + '"></label>' +
      '<p id="custom-preview" class="custom-preview" aria-live="polite"></p><p id="custom-error" class="warning" role="alert" aria-live="polite"></p>' +
      '<div class="dialog-actions"><button type="button" class="small-button" id="custom-save">この場面を保存</button><button type="button" class="primary" id="custom-start">この場面から試合開始</button></div></form>';
  }
  function formValue(form) {
    const f = form.elements;
    return normalize({ inning:f.namedItem('inning').value, half:f.namedItem('half').value, outs:f.namedItem('outs').value, home:f.namedItem('home').value, away:f.namedItem('away').value, order:f.namedItem('order').value, pitches:f.namedItem('pitches').value, opponent:f.namedItem('opponent').value, bases:[0,1,2].map(i=>f.namedItem('base' + i).checked) });
  }
  function saved() {
    let data;
    try { data = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
    if (!Array.isArray(data)) return [];
    return data.slice(0,MAX_SAVED).flatMap(entry => {
      try { return entry && typeof entry.id === 'string' && typeof entry.name === 'string' ? [{ id:entry.id, name:entry.name.slice(0,32), spec:normalize(entry.spec) }] : []; }
      catch { return []; }
    });
  }
  function store(name, rawSpec) {
    const spec = normalize(rawSpec);
    const row = { id:String(Date.now()) + '-' + Math.floor(Math.random() * 1000000), name:String(name || '').trim().slice(0,32) || describe(spec), spec };
    const list = [row, ...saved()].slice(0,MAX_SAVED);
    localStorage.setItem(KEY, JSON.stringify(list));
    return row;
  }
  function remove(id) { localStorage.setItem(KEY, JSON.stringify(saved().filter(row => row.id !== id))); }
  return { KEY, MAX_SAVED, defaultSpec, normalize, describe, formHTML, formValue, saved, store, remove, htmlEscape };
});
