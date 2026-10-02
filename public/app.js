(function () {
  'use strict';
  const G=window.BenchGame,S=window.BenchSharing,$=id=>document.getElementById(id);
  const GAME_KEY='bench-first-game-v1',HISTORY_KEY='bench-first-history-v1',PREF_KEY='bench-first-prefs-v2';
  let game,tab='tactics',selected='contact',busy=false,benchMode='pinch',benchTarget=7,storageOK=true,toastTimer,lineupTeam='home';
  let animationSpeed='normal',imageURL=null,imageJob=0;
  let activeGame=false,hasSavedGame=false;
  const icons={
    contact:'<path d="m6 20 11-13 3 3L8 22zM17 7l2-3 3 3-2 3M5 22l-2-2"/>',
    power:'<path d="m3 21 11-11 4 4L7 23zM14 10l4-7 5 5-5 6M4 6l2-3m1 5 3-1m9 12 2 2"/>',
    bunt:'<path d="m4 16 16-6 2 4-17 4z"/><circle cx="7" cy="6" r="2"/>',
    steal:'<circle cx="15" cy="4" r="2"/><path d="m8 11 5-4 4 5 5 1m-9-6-2 9-6 5m6-5 6 2 1 5M3 9h4M1 13h5"/>',
    normal:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18"/>',
    strikeout:'<path d="M6 3v18M20 3 6 14m6-6 9 13"/>',
    low:'<path d="M4 4h16v16H4zM7 15h10m-5-8v8m-3-3 3 3 3-3"/>'
  };
  function icon(key){return '<svg viewBox="0 0 26 26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[key]||icons.normal)+'</svg>';}
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function read(key,fallback){try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback;}catch{storageOK=false;return fallback;}}
  function save(){try{localStorage.setItem(GAME_KEY,JSON.stringify(game));}catch{storageOK=false;}$('save-status').textContent=storageOK?'この端末に自動保存':'この環境では保存できません（プレーは可能）';}
  function loadGame(){const s=read(GAME_KEY,null);try{
    if(s&&[1,G.VERSION].includes(s.version)&&G.scenarios[s.scenario]&&s.inning>=7&&s.inning<=9&&['home','away'].includes(s.half)&&s.outs>=0&&s.outs<3&&s.bases.length===3&&Array.isArray(s.log)&&Array.isArray(s.decisions)&&Number.isFinite(s.rng)&&['home','away'].every(k=>Number.isFinite(s.score[k])&&s.lines[k].length===9&&s.teams[k].lineup.length===9&&s.teams[k].pitchers[s.teams[k].pitcherIndex]&&Array.isArray(s.teams[k].bench))){G.currentBatter(s);G.currentPitcher(s);s.version=G.VERSION;hasSavedGame=true;return s;}
    }catch{}return G.createGame();}
  function history(){const h=read(HISTORY_KEY,[]);return Array.isArray(h)?h.filter(x=>x&&['win','loss','draw'].includes(x.result)).slice(-100):[];}
  function remember(){const h=history();if(h.some(x=>x.id===game.id))return;h.push({id:game.id,result:game.result,home:game.score.home,away:game.score.away,scenario:game.scenario,date:new Date().toISOString(),daily:game.daily||null,balanceRevision:game.balanceRevision||null});try{localStorage.setItem(HISTORY_KEY,JSON.stringify(h.slice(-100)));}catch{storageOK=false;}}
  function baseText(){return game.bases.some(Boolean)?game.bases.map((p,i)=>p?['一','二','三'][i]:'').join('')+'塁':'走者なし';}
  function fatigueText(p){const f=G.fatigue(p);return f>=1?'疲労 大':f>=.8?'疲労 やや大':f>=.55?'疲労 中':'疲労 小';}
  function resultTitle(){return game.result==='win'?'采配が、勝利につながった。':game.result==='loss'?'次の一手で、取り返そう。':'最後まで、譲らない戦い。';}
  function renderScore(){
    $('scoreboard').innerHTML='<div class="team"><div class="team-symbol" aria-hidden="true">S</div><div><h2>サンライズ</h2><small>あなたのチーム · 後攻</small></div></div><div class="score-center"><div class="score-number" aria-label="サンライズ '+game.score.home+'点、ブルーウェーブ '+game.score.away+'点"><b>'+game.score.home+'</b><i>−</i><b>'+game.score.away+'</b></div><div class="score-detail"><div class="inning">'+(game.done?'試合終了':G.halfName(game))+'</div><div class="outs">'+(game.done?'9回終了':game.outs+'アウト '+[0,1].map(i=>'<span class="out-dot '+(i<game.outs?'on':'')+'"></span>').join(''))+'</div></div><div class="bases-mini" aria-hidden="true">'+game.bases.map(p=>'<span class="'+(p?'on':'')+'"></span>').join('')+'</div></div><div class="team away"><div><h2>ブルーウェーブ</h2><small>CPU · 先攻</small></div><div class="team-symbol" aria-hidden="true">W</div></div>';
  }
  function playerButton(p,extra=''){return '<button class="player-link '+extra+'" data-player="'+p.id+'" aria-label="'+esc(p.name)+'の能力">'+esc(p.name)+'</button>';}
  function bindPlayerDetails(){document.querySelectorAll('[data-player]').forEach(el=>el.onclick=()=>{if(!busy)showPlayer(el.dataset.player);});}
  function findPlayer(id){for(const t of Object.values(game.teams)){const p=[...t.lineup,...t.bench,...t.removed,...t.pitchers].find(p=>p.id===id);if(p)return p;}return null;}
  function showPlayer(id){
    const p=findPlayer(id);if(!p)return;
    const pitching=p.stuff!==undefined;
    const rows=pitching?[['球威',p.stuff],['制球',p.control],['スタミナ目安',p.stamina+'球'],['現在の球数',p.pitches+'球'],['疲労',fatigueText(p)]]:[['ミート',p.contact],['長打',p.power],['走力',p.speed],['守備',p.defense],['選球眼',p.eye],['バント',p.bunt]];
    openDialog(dialogHead(p.name)+'<p class="dialog-text">'+p.hand+(pitching?'投げ':'打ち · 守備適性 '+p.pos.join('・'))+' / '+p.trait+'</p><table class="ability-table"><tbody>'+rows.map(([label,value])=>'<tr><th>'+label+'</th><td>'+value+'</td></tr>').join('')+'</tbody></table><p class="dialog-text">'+(pitching?'球威は三振や被安打、制球は四球に影響します。球数がスタミナ目安に近づくほど疲労が増え、打たれやすくなります。':'能力は100段階。選球眼が高いと四球を選びやすく、バント能力が高いと送りバントの成功率が上がります。守備適性外の位置では守備力が下がります。')+'</p>');
  }
  function comparison(old,p,pos,pitching=false){
    const rows=pitching?[['球威',old.stuff,p.stuff],['制球',old.control,p.control],['スタミナ目安（球）',old.stamina,p.stamina],['現在の球数',old.pitches,p.pitches],['疲労',fatigueText(old),fatigueText(p)]]:[['ミート',old.contact,p.contact],['長打',old.power,p.power],['走力',old.speed,p.speed],['選球眼',old.eye,p.eye],['バント',old.bunt,p.bunt],['守備の基礎値',old.defense,p.defense],['配置先（'+pos+'）の守備',G.effectiveDefense(old,pos)??'守備なし',G.effectiveDefense(p,pos)??'守備なし']];
    return '<table class="comparison"><caption>交代前後の比較</caption><thead><tr><th>能力</th><th>'+esc(old.name)+'</th><th>'+esc(p.name)+'</th><th>変化</th></tr></thead><tbody>'+rows.map(([label,a,b])=>{const delta=typeof a==='number'&&typeof b==='number'?b-a:null;return '<tr><th>'+label+'</th><td>'+a+'</td><td>'+b+'</td><td class="'+(delta>0?'delta-up':delta<0?'delta-down':'')+'">'+(delta===null?'—':delta>0?'＋'+delta:delta===0?'±0':String(delta).replace('-','−'))+'</td></tr>';}).join('')+'</tbody></table><p class="record-caption">数値の増減を表示しています。球数は少ないほど疲労に余裕があります。</p>';
  }
  function renderField(){
    const coords=[[84.5,52.4],[50,38.2],[15.4,52.4]];
    $('field-state').innerHTML='<div class="field-tag">'+(game.done?'試合終了':G.halfName(game)+' · '+game.outs+'アウト · '+baseText())+'</div>'+game.bases.map((p,i)=>'<div class="base-marker '+(p?'':'empty')+'" style="left:'+coords[i][0]+'%;top:'+coords[i][1]+'%" aria-label="'+['一','二','三'][i]+'塁 '+(p?esc(p.name):'走者なし')+'">'+(p?'●<span class="runner-name">'+esc(p.name.split(' ')[0])+'</span>':'')+'</div>').join('')+'<div class="mound-label '+(game.half==='away'?'home-pitcher':'')+'">'+esc(G.currentPitcher(game).name.split(' ')[0])+'</div>';
    const b=G.currentBatter(game),p=G.currentPitcher(game);
    $('matchup').innerHTML='<div class="player-card"><div class="player-role">打者 · '+(G.batting(game).order+1)+'番</div><div class="player-name">'+playerButton(b)+' <small>'+b.hand+'打ち</small></div><p class="player-trait">'+b.trait+'</p><div class="mini-stats">ミート <b>'+b.contact+'</b> 長打 <b>'+b.power+'</b> 走力 <b>'+b.speed+'</b></div></div><div class="vs">対</div><div class="player-card"><div class="player-role pitcher">投手 · '+p.hand+'投げ</div><div class="player-name">'+playerButton(p)+' <small>'+p.pitches+'球</small></div><p class="player-trait">'+p.trait+'</p><div class="mini-stats">球威 <b>'+p.stuff+'</b> 制球 <b>'+p.control+'</b> <span class="'+(G.fatigue(p)>=.8?'warning':'')+'">'+fatigueText(p)+'</span></div><div class="fatigue-bar '+(G.fatigue(p)>=.8?'high':'')+'"><span style="width:'+Math.min(100,p.pitches/p.stamina*100)+'%"></span></div></div>';
    const t=G.batting(game);
    $('upcoming').innerHTML=game.done?'<p class="record-caption">試合終了。「記録」から試合を振り返れます。</p>':'<div class="upcoming-title">次の3打者 <small>'+t.name+'</small></div><div class="upcoming-list">'+[1,2,3].map(n=>{const i=(t.order+n)%9,p=t.lineup[i];return '<div class="next-batter"><small>'+(i+1)+'番 · '+p.hand+'打</small>'+playerButton(p)+'<span>'+p.trait+'</span></div>';}).join('')+'</div>';
  }
  function renderLineup(){
    const t=game.teams[lineupTeam];
    $('panel').innerHTML='<div class="team-switch" aria-label="打順を表示する球団"><button data-team="home" aria-pressed="'+(lineupTeam==='home')+'">サンライズ</button><button data-team="away" aria-pressed="'+(lineupTeam==='away')+'">ブルーウェーブ</button></div><p class="record-caption">選手名を押すと詳細。'+(game.done?'最終打順を表示しています。':lineupTeam===game.half?'色付きの行が現在の打者です。':'色付きの行が次の攻撃の先頭打者です。')+'</p><div class="lineup-scroll"><table class="lineup-table"><thead><tr><th>番</th><th>選手・特徴</th><th>守</th><th>打</th><th>ミート</th><th>長打</th></tr></thead><tbody>'+t.lineup.map((p,i)=>'<tr class="'+(!game.done&&i===t.order?'current-batter':'')+'"><td>'+(i+1)+'</td><td>'+playerButton(p)+'<small>'+p.trait+'</small></td><td>'+G.positionAt(t,i)+(G.positionAt(t,i)!=='指'&&!p.pos.includes(G.positionAt(t,i))?'※':'')+'</td><td>'+p.hand+'</td><td>'+p.contact+'</td><td>'+p.power+'</td></tr>').join('')+'</tbody></table></div><p class="record-caption">※は守備適性外。交代するとこの打順にも反映されます。</p>';
    document.querySelectorAll('[data-team]').forEach(el=>el.onclick=()=>{lineupTeam=el.dataset.team;renderLineup();bindPlayerDetails();});
  }
  function renderTactics(){
    if(game.done){$('panel').innerHTML='<div class="results-inline"><h3>'+({win:'勝利',loss:'敗戦',draw:'引き分け'}[game.result])+'</h3><p>'+resultTitle()+'<br>試合の記録から、一手を振り返ろう。</p><button class="primary" id="view-result">結果と振り返りを見る</button><button class="small-button" id="new-game">別の試合へ</button></div>';$('view-result').onclick=showResult;$('new-game').onclick=showSetup;return;}
    const offense=game.half==='home',steal=G.stealInfo(game);
    const choices=offense?[
      ['contact','ミート重視','つなぐ打撃で、出塁を狙う。','三振は減るが、本塁打も減る。',true],
      ['power','長打狙い','ひと振りで、試合を動かす。','本塁打増。三振も増える。',true],
      ['bunt','送りバント','アウトと引き換えに進める。',G.canBunt(game)?'成功目安 '+Math.round(G.buntChance(game)*100)+'% · バント能力 '+G.currentBatter(game).bunt:'2死・三塁走者ありでは不可。',G.canBunt(game)],
      ['steal','盗塁','走力を生かして、次の塁へ。',steal?steal.runner.name.split(' ')[0]+'の'+(steal.base===0?'二':'三')+'盗成功目安 '+Math.round(steal.chance*100)+'%':'走者・空いている塁が必要。',!!steal]
    ]:[
      ['normal','バランス','投手の持ち味で勝負する。','四球と長打のリスクを均衡。',true],
      ['strikeout','三振を狙う','走者を動かさずに抑える。','三振増。四球・球数も増。',true],
      ['contact','打たせて取る','四球を減らし、守備に託す。','安打のリスクは上がる。',true],
      ['low','低めで勝負','長打を抑えてゴロを狙う。','本塁打減。四球は増える。',true]
    ];
    if(!choices.some(c=>c[0]===selected&&c[4]))selected=offense?'contact':'normal';
    for(const c of choices){
      if(['bunt','steal'].includes(c[0]))continue;
      const p=G.matchupProbabilities(game,c[0]),hit=p.single+p.double+p.triple+p.hr,pct=v=>Math.round(v*100)+'%';
      c[3]+='<br><span class="chance-preview">'+(offense?'出塁目安 '+pct(hit+p.bb+p.error)+' · 本塁打 '+pct(p.hr):'被安打 '+pct(hit)+' · 三振 '+pct(p.k)+' · 四球 '+pct(p.bb))+'</span>';
    }
    $('panel').innerHTML='<div class="tactics">'+choices.map(c=>'<button class="tactic '+(selected===c[0]?'selected':'')+'" data-action="'+c[0]+'" aria-pressed="'+(selected===c[0])+'" '+(!c[4]?'disabled':'')+'><div class="tactic-top">'+icon(c[0])+'<h3>'+c[1]+'</h3></div><p>'+c[2]+'</p><p class="pro">'+c[3]+'</p></button>').join('')+'</div>'+(offense?'':'<div class="defense-select"><span>守備位置</span><button data-defense="normal" class="'+(game.defense==='normal'?'selected':'')+'" aria-pressed="'+(game.defense==='normal')+'">定位置</button><button data-defense="in" class="'+(game.defense==='in'?'selected':'')+'" aria-pressed="'+(game.defense==='in')+'">前進守備</button></div>')+'<p class="action-hint">'+(offense?(selected==='bunt'?'送りバントは2死・三塁走者ありでは選べません。失敗時は打者アウト。':selected==='steal'?'盗塁は打席を消費しません。失敗するとアウトが増えます。':'「ベンチ」から代打・代走を選べます。交代後は再出場できません。'):(game.defense==='in'?'前進守備は内野ゴロでの生還を防ぎますが、安打が増えます。':'疲労が大きいほど打たれやすくなります。「ベンチ」で継投できます。'))+'</p><div class="primary-row"><button class="primary" id="advance" '+(busy?'disabled':'')+'>'+(busy?'プレー中…':'この作戦で進める')+'<span class="arrow" aria-hidden="true">→</span></button></div>';
    document.querySelectorAll('[data-action]').forEach(el=>el.onclick=()=>{selected=el.dataset.action;renderTactics();document.querySelector('[data-action="'+selected+'"]').focus({preventScroll:true});});
    document.querySelectorAll('[data-defense]').forEach(el=>el.onclick=()=>{G.setDefense(game,el.dataset.defense);save();render();});
    $('advance').onclick=advance;
  }
  function renderBench(){
    const home=game.teams.home,offense=game.half==='home';
    if(game.done){$('panel').innerHTML='<p class="empty-note">試合終了後は交代できません。「記録」で出場選手を確認できます。</p>';return;}
    if(offense&&!['pinch','runner'].includes(benchMode))benchMode='pinch';
    if(!offense&&!['pitcher','defense'].includes(benchMode))benchMode='pitcher';
    if(benchMode==='pinch')benchTarget=home.order;
    const targets=home.lineup.map((p,i)=>({p,i})).filter(x=>benchMode!=='runner'||game.bases.some(p=>p&&p.id===x.p.id));
    if(benchMode==='runner'&&!targets.some(x=>x.i===benchTarget))benchTarget=targets.length?targets[0].i:-1;
    $('panel').innerHTML='<div class="bench-controls"><label>交代の種類<select id="bench-mode">'+(offense?'<option value="pinch">代打</option><option value="runner">代走</option>':'<option value="pitcher">投手交代</option><option value="defense">守備交代</option>')+'</select></label>'+(benchMode==='pitcher'?'<div class="action-hint">現在：'+home.pitchers[home.pitcherIndex].name+'<br>'+fatigueText(home.pitchers[home.pitcherIndex])+'</div>':'<label>交代する選手<select id="bench-target" '+(benchMode==='pinch'?'disabled':'')+'>'+targets.filter(x=>benchMode!=='pinch'||x.i===home.order).map(x=>'<option value="'+x.i+'">'+(x.i+1)+'番 '+x.p.name+'（'+G.positions[x.i]+'）</option>').join('')+(targets.length?'':'<option>走者がいません</option>')+'</select></label>')+'</div><div class="bench-list">'+(benchMode==='pitcher'?home.pitchers.map((p,i)=>'<div class="bench-player"><div><h3>'+playerButton(p)+' <small>'+p.hand+'投</small></h3><p>球威 '+p.stuff+' / 制球 '+p.control+' / 目安 '+p.stamina+'球<br>'+p.trait+'</p></div><button class="small-button orange-outline" data-pitcher="'+i+'" '+(home.usedPitchers.includes(i)?'disabled':'')+'>'+(i===home.pitcherIndex?'登板中':home.usedPitchers.includes(i)?'登板済':'比較して交代')+'</button></div>').join(''):home.bench.length?home.bench.map(p=>{
      const mismatch=benchTarget>=0&&G.positions[benchTarget]!=='指'&&!p.pos.includes(G.positions[benchTarget]);
      return '<div class="bench-player"><div><h3>'+playerButton(p)+' <small>'+p.hand+'打</small></h3><p>ミート '+p.contact+' / 長打 '+p.power+' / 走力 '+p.speed+'<br>守備 '+p.defense+'（'+p.pos.join('・')+'） · '+p.trait+'</p>'+(mismatch?'<p class="warning">'+G.positions[benchTarget]+'は適性外：守備力が低下</p>':'')+'</div><button class="small-button orange-outline" data-sub="'+p.id+'" '+(benchTarget<0?'disabled':'')+'>比較して交代</button></div>';
    }).join(''):'<p class="empty-note">控え野手を使い切りました。</p>')+'</div><p class="action-hint">交代は取り消せません。守備適性のない位置では守備力が下がります。能力は100段階です。</p><div class="primary-row"><button class="primary" id="back-tactics">采配に戻る</button></div>';
    $('bench-mode').value=benchMode;$('bench-mode').onchange=e=>{benchMode=e.target.value;renderBench();bindPlayerDetails();};
    if($('bench-target')){$('bench-target').value=String(benchTarget);$('bench-target').onchange=e=>{benchTarget=Number(e.target.value);renderBench();bindPlayerDetails();};}
    document.querySelectorAll('[data-sub]').forEach(el=>el.onclick=()=>{
      const candidate=home.bench.find(p=>p.id===el.dataset.sub);const old=home.lineup[benchTarget];
      showConfirm('選手を交代しますか？',old.name+' → '+candidate.name+'。交代した選手は再出場できません。'+(G.positions[benchTarget]!=='指'&&!candidate.pos.includes(G.positions[benchTarget])?' '+G.positions[benchTarget]+'は守備適性外のため、守備力が下がります。':''),()=>{G.replacePlayer(game,benchTarget,candidate.id,benchMode);save();render();toast('交代しました。采配を選んで進めましょう。');},comparison(old,candidate,G.positions[benchTarget]));
    });
    document.querySelectorAll('[data-pitcher]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.pitcher);showConfirm('投手を交代しますか？',home.pitchers[i].name+'にマウンドを託します。交代した投手は再登板できません。',()=>{G.changePitcher(game,'home',i);save();render();toast('投手を交代しました。');},comparison(home.pitchers[home.pitcherIndex],home.pitchers[i],null,true));});
    $('back-tactics').onclick=()=>switchTab('tactics');
  }
  function scoreTable(){return '<table class="line-score"><caption class="record-caption">イニング別スコア</caption><thead><tr><th>球団</th>'+Array.from({length:9},(_,i)=>'<th>'+ (i+1)+'</th>').join('')+'<th>計</th></tr></thead><tbody>'+['away','home'].map(k=>'<tr><th>'+(k==='home'?'サンライズ':'ウェーブ')+'</th>'+game.lines[k].map(v=>'<td>'+(v===null?'−':v)+'</td>').join('')+'<td class="total">'+game.score[k]+'</td></tr>').join('')+'</tbody></table>';}
  function logHTML(items){return items.map(l=>'<div class="log-row '+l.kind+'"><small>'+l.half+'</small><span>'+esc(l.text)+'</span></div>').join('');}
  function renderRecord(){
    $('panel').innerHTML='<div class="record-scroll">'+scoreTable()+'<p class="record-caption">操作開始後：サンライズ '+game.stats.home.h+'安打 / '+game.stats.home.bb+'四球 / '+game.stats.home.hr+'本塁打</p><details><summary class="record-caption">現在のサンライズ打順・守備</summary>'+game.teams.home.lineup.map((p,i)=>'<div class="log-row"><small>'+(i+1)+'番</small><span>'+p.name+'（'+G.positionAt(game.teams.home,i)+'）'+(G.positionAt(game.teams.home,i)!=='指'&&!p.pos.includes(G.positionAt(game.teams.home,i))?' · 守備適性外':'')+'</span></div>').join('')+'</details>'+logHTML(game.log.slice().reverse())+'</div>';
  }
  function render(){if(!activeGame)return;G.prepareTurn(game);renderScore();renderField();$('command-title').innerHTML=game.done?'最後の一球まで、<br>あなたの采配。':game.half==='home'?'あなたの采配で、<br>流れを変える。':'この一球を、<br>誰に託す？';$('phase').textContent=game.done?'試合終了':(game.half==='home'?'攻撃中':'守備中')+' / '+game.outs+'死'+(baseText()==='走者なし'?'走者なし':baseText());$('phase').className='phase '+(game.half==='away'?'defend':'');
    const changes=game.done?[]:game.turnChanges||[];$('cpu-changes').hidden=!changes.length;$('cpu-changes').innerHTML=changes.length?'<strong>相手の交代を確認してから、采配を選びましょう。</strong>'+changes.map(l=>'<p>'+esc(l.text)+'</p>').join(''):'';
    document.querySelectorAll('[data-tab]').forEach(el=>{el.setAttribute('aria-selected',el.dataset.tab===tab);el.tabIndex=el.dataset.tab===tab?0:-1;});$('panel').setAttribute('aria-labelledby','tab-'+tab);
    if(tab==='tactics')renderTactics();else if(tab==='bench')renderBench();else if(tab==='lineup')renderLineup();else renderRecord();bindPlayerDetails();renderChallengeLabel();
    $('recent').innerHTML=logHTML(game.log.slice(-3).reverse());save();
  }
  function switchTab(value){if(busy)return;tab=value;render();}
  async function advance(){
    if(busy||game.done)return;
    busy=true;const oldHalf=game.half;
    // Lock every game mutation while the old field state is animated.
    const controls=[...document.querySelectorAll('main button, .header button, #animation-speed')];
    controls.forEach(el=>el.disabled=true);$('advance').textContent='プレー中…';
    let result;
    try{
      result=G.step(game,selected);if(!result.ok)return;
      save();if(game.done)remember();
      await window.BenchMotion.run(result.play,animationSpeed,window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }catch(error){console.error(error);toast('演出を省略して、試合を続けます。');}
    finally{
      controls.forEach(el=>el.disabled=false);busy=false;
      if(oldHalf!==game.half)selected=game.half==='home'?'contact':'normal';
      render();if(game.done)showResult();else $('advance')?.focus({preventScroll:true});
    }
  }
  function openDialog(html){clearImage();$('dialog-content').innerHTML=html;if(!$('dialog').open)$('dialog').showModal();const close=$('close-dialog');if(close)close.onclick=()=>$('dialog').close();}
  function dialogHead(title){return '<div class="dialog-header"><h2 id="dialog-title">'+title+'</h2><button class="close-button" id="close-dialog" aria-label="閉じる">×</button></div>';}
  function showConfirm(title,text,fn,extra=''){openDialog(dialogHead(title)+'<p class="dialog-text">'+esc(text)+'</p>'+extra+'<div class="dialog-actions"><button id="cancel" class="small-button">戻る</button><button id="confirm" class="primary">交代する</button></div>');$('cancel').onclick=()=>$('dialog').close();$('confirm').onclick=()=>{$('dialog').close();fn();};}
  function renderChallengeLabel(){
    $('challenge-label').textContent=game.daily?'共通のお題 '+game.daily.date+' · '+G.scenarios[game.scenario].name+(game.balanceRevision!==G.BALANCE_REVISION?' · 以前の保存位置':''):'自由に挑戦 · '+G.scenarios[game.scenario].name;
    $('animation-speed').value=animationSpeed;
  }
  function difficultyHTML(sc){return '<span class="difficulty" aria-label="難易度5段階中'+sc.difficulty+'">難易度 '+'★'.repeat(sc.difficulty)+'☆'.repeat(5-sc.difficulty)+'</span>';}
  function activateGame(){activeGame=true;hasSavedGame=true;$('start-screen').hidden=true;$('game-view').hidden=false;render();}
  function showScenario(scenario){
    const sc=G.scenarios[scenario];
    openDialog(dialogHead('この場面から始める')+'<div class="daily-card"><h3>'+sc.name+'</h3>'+difficultyHTML(sc)+'<p>'+sc.text+'</p><p class="record-caption">'+sc.difficultyReason+'</p></div><p class="dialog-text">ここに表示しているのは開始条件です。試合の展開は、あなたの采配で決まります。'+(hasSavedGame&&!game.done?'開始すると進行中の試合を置き換えます。':'')+'</p><div class="dialog-actions"><button id="scene-back" class="small-button">場面を選び直す</button><button id="scene-start" class="primary">試合を開始する</button></div>');
    $('scene-back').onclick=showSetup;$('scene-start').onclick=()=>newGame(scenario);
  }
  function showDaily(){
    if(busy)return;const d=G.dailySpec(),sc=G.scenarios[d.scenario],past=history().filter(x=>x.daily?.code===d.code&&x.daily?.balanceRevision===d.balanceRevision&&x.balanceRevision===G.BALANCE_REVISION),first=past[0];
    openDialog(dialogHead('今日の共通のお題')+'<p class="challenge-date">'+d.date+' · お題 '+d.code+'</p><div class="daily-card"><h3>'+sc.name+'</h3>'+difficultyHTML(sc)+'<p>'+sc.text+'</p><strong>サンライズ '+sc.home+' − '+sc.away+' ブルーウェーブ</strong></div><div class="dialog-text"><p>日本時間の毎日0時にお題が切り替わります。同じ版・同じお題では、開始条件と抽選の並びが共通です。<strong>同じ采配なら同じ結果</strong>になり、選び方を変えて再挑戦できます。</p><p>この版のお題は、複数の采配で勝てることを確認して用意しています。作戦ごとの確率目安と、選手の能力・疲労を見て選びましょう。</p><p>保存中の完了記録：'+past.length+'回'+(first?' / 記録内の初回：'+({win:'勝利',loss:'敗戦',draw:'引き分け'}[first.result])+'（'+first.home+' − '+first.away+'）':' / 完了記録なし')+'（直近100試合内）</p><p>結果をコピーして比べられます。全員の戦績を集計するオンラインランキングはありません。</p>'+(hasSavedGame&&!game.done?'<p class="warning">開始すると進行中の試合は終了します。</p>':'')+'</div><button class="primary" id="start-daily">同じ条件で挑戦する</button>');
    $('start-daily').onclick=()=>newGame(d.scenario,d.date);
  }
  function showSetup(){if(busy)return;openDialog(dialogHead('どの試合を指揮する？')+'<p class="dialog-text">あなたは後攻のサンライズ。選んだ場面から9回終了まで指揮します。'+(hasSavedGame&&!game.done?'開始すると進行中の試合は終了します。':'')+'</p><button id="setup-daily" class="daily-button setup-daily">今日の共通のお題で遊ぶ</button><div class="scenario-list">'+Object.entries(G.scenarios).map(([k,s])=>'<button class="scenario" data-scenario="'+k+'"><span><strong>'+s.name+'</strong><small>'+s.text+'</small>'+difficultyHTML(s)+'</span><span class="num">'+s.home+' − '+s.away+'</span></button>').join('')+'</div><p class="record-caption">左があなたのチーム。自由に挑戦するモードでは結果は毎回変わります。</p>');document.querySelectorAll('[data-scenario]').forEach(el=>el.onclick=()=>showScenario(el.dataset.scenario));$('setup-daily').onclick=showDaily;}
  function newGame(scenario,dailyDate=null){
    clearEntry();
    const attempt=String(Date.now())+'-'+Math.floor(Math.random()*100000);
    game=dailyDate?G.createDailyGame(dailyDate,attempt):G.createGame(scenario,Date.now()+Math.floor(Math.random()*100000));
    selected=game.half==='home'?'contact':'normal';tab='tactics';lineupTeam=game.half;benchMode=game.half==='home'?'pinch':'pitcher';benchTarget=game.teams.home.order;$('dialog').close();activateGame();window.scrollTo({top:0,behavior:'instant'});
  }
  function showHelp(){openDialog(dialogHead('監督の仕事は、選ぶこと。')+'<div class="dialog-text"><p><strong>あなたは後攻のサンライズ。選んだ場面から9回終了までを戦います。</strong>打撃・投球のタイミング操作はありません。</p><ol><li>「采配」で作戦を選び、<strong>この作戦で進める</strong>を押すと1打席が進みます。</li><li>3アウトで攻守交代。守備では投球方針を選びます。</li><li>「ベンチ」で代打・代走・継投・守備交代。交代は確認後に確定します。</li><li>「打順」で両チームの打順を確認。選手名を押すと全能力が開きます。</li><li>「記録」でスコアと采配を振り返れます。</li></ol><p><strong>能力は100段階。</strong>ミート・長打・走力・守備・選球眼・バント、投手の球威・制球・疲労・左右相性が結果に影響します。良い選択でも必ず成功するわけではありません。</p><p><strong>守備適性に注意。</strong>例えば控え捕手を代打に使うと、打力が上がっても捕手の守備力が下がります。投手の疲労は球数とスタミナで増加します。</p><p>試作版は全試合DH制。送りバントは2死・三塁走者ありでは不可、盗塁は二盗・三盗のみです。走塁・併殺は簡略化しています。実際の試合を予測するものではありません。</p><p>「今日の共通のお題」は日本時間の日付で切り替わります。同じ版・同じお題・同じ采配なら結果を再現できます。演出は標準／速い／なしから選べます。端末で動きを減らす設定をしている場合も演出を省略します。</p><p>「リンク」から今日・指定日・シナリオのリンクをコピーできます。試合終了後は結果のコピー・対応端末の共有・PNG画像の保存ができます。</p><p>進行と直近100試合の戦績をこの端末に保存します。ブラウザのデータ削除で消えます。公開URLとローカルファイルの保存は別です。</p></div><button class="primary" id="help-done">采配を始めよう</button>');$('help-done').onclick=()=>$('dialog').close();}
  function shareText(){return S.text(S.resultData(game,G));}
  async function copyText(value){
    try{await navigator.clipboard.writeText(value);toast('コピーしました。');}
    catch{let el=$('share-fallback');if(!el){$('dialog-content').insertAdjacentHTML('beforeend','<label class="record-caption" for="share-fallback">下の文章を選択してコピーしてください。</label><textarea id="share-fallback" class="share-text" readonly></textarea>');el=$('share-fallback');}el.value=value;el.focus();el.select();}
  }
  async function nativeShare(data,button){
    if(button)button.disabled=true;
    const status=await S.share(navigator,data);
    if(button)button.disabled=false;
    if(status==='fallback'){toast('共有メニューを開けませんでした。コピーをご利用ください。');let el=$('share-fallback');if(!el){$('dialog-content').insertAdjacentHTML('beforeend','<label class="record-caption" for="share-fallback">共有する文章</label><textarea id="share-fallback" class="share-text" readonly></textarea>');el=$('share-fallback');}el.value=S.text(data);}
  }
  function clearImage(){imageJob++;if(imageURL){URL.revokeObjectURL(imageURL);imageURL=null;}}
  async function showImage(){
    const snapshot=JSON.parse(JSON.stringify(game));
    openDialog(dialogHead('結果画像を保存')+'<div id="image-content" aria-live="polite"><p class="dialog-text">画像を作成しています…</p></div>');
    const job=imageJob;
    try{
      const output=await S.card(snapshot,G);if(job!==imageJob||!$('dialog').open)return;
      imageURL=URL.createObjectURL(output.blob);
      $('image-content').innerHTML='<img id="result-image" class="result-image" alt="'+esc(G.scenarios[snapshot.scenario].name)+'の結果。サンライズ '+snapshot.score.home+'対ブルーウェーブ '+snapshot.score.away+'"><a id="download-image" class="primary image-download">PNG画像を保存</a><p class="record-caption">保存が始まらない端末では、画像を長押しして保存できます。SNSには下の結果文・リンクも添えてください。</p><div class="image-actions"><button id="image-copy" class="small-button">結果文とリンクをコピー</button><button id="image-back" class="small-button">結果に戻る</button></div>';
      $('result-image').src=imageURL;$('download-image').href=imageURL;$('download-image').download=output.name;
      $('image-copy').onclick=()=>copyText(S.text(S.resultData(snapshot,G)));$('image-back').onclick=showResult;
    }catch{if(job!==imageJob||!$('dialog').open)return;$('image-content').innerHTML='<p class="dialog-text">画像を作成できませんでした。結果のコピーをご利用ください。</p><button id="image-back" class="primary">結果に戻る</button>';$('image-back').onclick=showResult;}
  }
  function showLinks(){
    if(busy)return;
    openDialog(dialogHead('お題へのリンク')+'<p class="dialog-text">記事やSNSから、遊んでほしい場面へ案内できます。</p><label class="link-label" for="link-kind">リンクの種類</label><select id="link-kind" class="link-select"><option value="today">今日のお題（開いた日のお題）</option><option value="daily">日付指定のお題</option><option value="scenario">シナリオ指定</option></select><div id="link-options"></div><p id="link-description" class="dialog-text"></p><label class="link-label" for="link-value">共有するリンク</label><textarea id="link-value" class="link-value" readonly></textarea><button id="copy-link" class="primary">リンクをコピー</button><p class="record-caption">リンク先では場面を確認してから開始できます。シナリオ指定は開始状況が共通で、抽選は毎回変わります。</p>');
    function update(){const kind=$('link-kind').value;try{let value=kind==='today'?null:kind==='daily'?$('link-date').value:$('link-scene').value;if(kind==='daily'&&!/^20\d{2}-\d{2}-\d{2}$/.test(value))throw Error();if(kind==='daily')G.dailySpec(value);$('link-value').value=S.link(kind,value);$('copy-link').disabled=false;$('link-description').textContent=kind==='today'?'いつ開いても、その日の共通のお題です。':kind==='daily'?'後日開いても、指定した日と同じ条件で遊べます。':G.scenarios[value].text;}catch{$('link-value').value='';$('copy-link').disabled=true;$('link-description').textContent='有効な日付を選んでください。';}}
    function options(){const kind=$('link-kind').value;$('link-options').innerHTML=kind==='daily'?'<label class="link-label" for="link-date">お題の日付（日本時間）</label><input id="link-date" class="link-select" type="date" min="2000-01-01" max="2099-12-31" value="'+(game.daily?.date||G.japanDate())+'">':kind==='scenario'?'<label class="link-label" for="link-scene">開始場面</label><select id="link-scene" class="link-select">'+Object.entries(G.scenarios).map(([key,sc])=>'<option value="'+key+'" '+(key===game.scenario?'selected':'')+'>'+sc.name+'</option>').join('')+'</select>':'';if($('link-date'))$('link-date').oninput=update;if($('link-scene'))$('link-scene').onchange=update;update();}
    $('link-kind').onchange=options;$('copy-link').onclick=()=>copyText($('link-value').value);options();
  }
  function clearEntry(){try{const u=new URL(location.href);['daily','scenario','rules'].forEach(k=>u.searchParams.delete(k));window.history.replaceState(null,'',u.href);}catch{}}
  function showEntry(){
    const entry=S.parse(location.search,G);if(!entry)return;
    clearEntry();
    if(entry.error){openDialog(dialogHead('リンクを確認してください')+'<p class="dialog-text">'+esc(entry.error)+'</p><button id="entry-close" class="primary">場面を選ぶ</button>');$('entry-close').onclick=showSetup;return;}
    const d=entry.kind==='today'?G.dailySpec():entry.kind==='daily'?entry:null;
    const scenario=d?d.scenario:entry.scenario,sc=G.scenarios[scenario];
    openDialog(dialogHead(d?'共通のお題に挑戦':'この場面に挑戦')+(d?'<p class="challenge-date">'+d.date+' · お題 '+d.code+'</p>':'')+'<div class="daily-card"><h3>'+sc.name+'</h3>'+difficultyHTML(sc)+'<p>'+sc.text+'</p><strong>サンライズ '+sc.home+' − '+sc.away+' ブルーウェーブ</strong></div><p class="dialog-text">'+(d?'同じお題・同じ采配なら結果を再現できます。':'この場面から始めます。抽選は毎回変わります。')+'</p>'+(hasSavedGame&&!game.done?'<p class="dialog-text warning">開始すると進行中の試合を置き換えます。保存した試合は開始画面から再開できます。</p>':'')+'<div class="dialog-actions"><button id="entry-close" class="small-button">戻る</button><button id="entry-start" class="primary">挑戦する</button></div>');
    $('entry-close').onclick=()=>$('dialog').close();$('entry-start').onclick=()=>{const now=entry.kind==='today'?G.dailySpec():d;newGame(now?now.scenario:scenario,now?now.date:null);};
  }
  function showResult(){
    if(!game.done)return;const h=history(),count=r=>h.filter(x=>x.result===r).length;
    const moments=game.log.filter(l=>l.kind==='decision'||l.kind==='score'||l.kind==='hr').slice(-3);
    openDialog(dialogHead({win:'サンライズ、勝利！',loss:'あと一歩、届かず。',draw:'9回終了、引き分け。'}[game.result])+(game.daily?'<p class="challenge-date">共通のお題 '+game.daily.code+'</p>':'')+'<div class="result-score">'+game.score.home+' − '+game.score.away+'<small>サンライズ 対 ブルーウェーブ</small></div><p class="dialog-text">'+resultTitle()+'</p><div class="result-notes"><h3>試合の分岐点</h3>'+(moments.length?moments.map(m=>'<p>'+m.half+' '+esc(m.text)+'</p>').join(''):'<p>両チームとも終盤の守備で粘りました。</p>')+'</div><p class="record-caption">結果だけで采配の良し悪しは決まりません。選手の特徴や残り戦力も振り返ってみましょう。</p><div class="record-totals">この端末の戦績：'+count('win')+'勝 '+count('loss')+'敗 '+count('draw')+'分（直近'+h.length+'試合）</div><div class="result-buttons"><button id="replay" class="primary">同じ場面でもう一度</button><button id="share" class="small-button">結果をコピー</button>'+(S.canNative(navigator,S.resultData(game,G))?'<button id="native-share" class="small-button">結果をシェア</button>':'')+'<button id="result-png" class="small-button">結果画像を保存</button><button id="result-record" class="small-button">試合記録を見る</button></div><p class="record-caption">'+(game.daily?'このお題は同じ采配なら同じ結果。選び方を変えて再挑戦できます。':'自由に挑戦するモードでは、結果は毎回変わります。')+'</p>');
    $('replay').onclick=()=>newGame(game.scenario,game.daily?.date||null);$('result-record').onclick=()=>{$('dialog').close();switchTab('record');};$('share').onclick=()=>copyText(shareText());if($('native-share'))$('native-share').onclick=()=>nativeShare(S.resultData(game,G),$('native-share'));$('result-png').onclick=showImage;
  }
  function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').className='visible';toastTimer=setTimeout(()=>$('toast').className='',2600);}
  $('help').onclick=()=>{if(!busy)showHelp();};$('restart').onclick=showSetup;$('daily').onclick=showDaily;$('share-links').onclick=showLinks;$('dialog').addEventListener('close',()=>{if(!$('dialog').open)clearImage();});
  const prefs=read(PREF_KEY,{});animationSpeed=['normal','fast','none'].includes(prefs?.speed)?prefs.speed:'normal';
  $('animation-speed').onchange=e=>{animationSpeed=e.target.value;try{localStorage.setItem(PREF_KEY,JSON.stringify({speed:animationSpeed}));}catch{storageOK=false;}save();};
  document.querySelectorAll('[data-tab]').forEach(el=>{el.onclick=()=>switchTab(el.dataset.tab);el.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=['tactics','bench','lineup','record'];let i=tabs.indexOf(tab);i=e.key==='Home'?0:e.key==='End'?3:(i+(e.key==='ArrowRight'?1:3))%4;switchTab(tabs[i]);$('tab-'+tabs[i]).focus();};});
  game=loadGame();lineupTeam=game.half;
  $('choose-scenario').onclick=showSetup;$('start-today').onclick=showDaily;
  $('saved-version-note').hidden=!hasSavedGame||game.balanceRevision===G.BALANCE_REVISION;
  $('resume-game').hidden=!hasSavedGame;$('resume-game').textContent=game.done?'保存した試合の記録を見る':'続きから遊ぶ';
  $('resume-game').onclick=()=>{selected=game.half==='home'?'contact':'normal';activateGame();if(game.done){remember();switchTab('record');}};
  showEntry();
})();
