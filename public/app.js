(function () {
  'use strict';
  const G=window.BenchGame,$=id=>document.getElementById(id);
  const GAME_KEY='bench-first-game-v1',HISTORY_KEY='bench-first-history-v1';
  let game,tab='tactics',selected='contact',busy=false,benchMode='pinch',benchTarget=7,storageOK=true,toastTimer,flashTimer;
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
    if(s&&s.version===G.VERSION&&G.scenarios[s.scenario]&&s.inning>=7&&s.inning<=9&&['home','away'].includes(s.half)&&s.outs>=0&&s.outs<3&&s.bases.length===3&&Array.isArray(s.log)&&Array.isArray(s.decisions)&&Number.isFinite(s.rng)&&['home','away'].every(k=>Number.isFinite(s.score[k])&&s.lines[k].length===9&&s.teams[k].lineup.length===9&&s.teams[k].pitchers[s.teams[k].pitcherIndex]&&Array.isArray(s.teams[k].bench))){G.currentBatter(s);G.currentPitcher(s);return s;}
    }catch{}return G.createGame();}
  function history(){const h=read(HISTORY_KEY,[]);return Array.isArray(h)?h.filter(x=>x&&['win','loss','draw'].includes(x.result)).slice(-100):[];}
  function remember(){const h=history();if(h.some(x=>x.id===game.id))return;h.push({id:game.id,result:game.result,home:game.score.home,away:game.score.away,scenario:game.scenario,date:new Date().toISOString()});try{localStorage.setItem(HISTORY_KEY,JSON.stringify(h.slice(-100)));}catch{storageOK=false;}}
  function baseText(){return game.bases.some(Boolean)?game.bases.map((p,i)=>p?['一','二','三'][i]:'').join('')+'塁':'走者なし';}
  function fatigueText(p){const f=G.fatigue(p);return f>=1?'疲労 大':f>=.8?'疲労 やや大':f>=.55?'疲労 中':'疲労 小';}
  function resultTitle(){return game.result==='win'?'采配が、勝利につながった。':game.result==='loss'?'次の一手で、取り返そう。':'最後まで、譲らない戦い。';}
  function renderScore(){
    $('scoreboard').innerHTML='<div class="team"><div class="team-symbol" aria-hidden="true">S</div><div><h2>サンライズ</h2><small>あなたのチーム · 後攻</small></div></div><div class="score-center"><div class="score-number" aria-label="サンライズ '+game.score.home+'点、ブルーウェーブ '+game.score.away+'点"><b>'+game.score.home+'</b><i>−</i><b>'+game.score.away+'</b></div><div class="score-detail"><div class="inning">'+(game.done?'試合終了':G.halfName(game))+'</div><div class="outs">'+(game.done?'9回終了':game.outs+'アウト '+[0,1].map(i=>'<span class="out-dot '+(i<game.outs?'on':'')+'"></span>').join(''))+'</div></div><div class="bases-mini" aria-hidden="true">'+game.bases.map(p=>'<span class="'+(p?'on':'')+'"></span>').join('')+'</div></div><div class="team away"><div><h2>ブルーウェーブ</h2><small>CPU · 先攻</small></div><div class="team-symbol" aria-hidden="true">W</div></div>';
  }
  function renderField(){
    const coords=[[84.5,52.4],[50,38.2],[15.4,52.4]];
    $('field-state').innerHTML='<div class="field-tag">'+(game.done?'試合終了':G.halfName(game)+' · '+game.outs+'アウト · '+baseText())+'</div>'+game.bases.map((p,i)=>'<div class="base-marker '+(p?'':'empty')+'" style="left:'+coords[i][0]+'%;top:'+coords[i][1]+'%" aria-label="'+['一','二','三'][i]+'塁 '+(p?esc(p.name):'走者なし')+'">'+(p?'●<span class="runner-name">'+esc(p.name.split(' ')[0])+'</span>':'')+'</div>').join('')+'<div class="mound-label '+(game.half==='away'?'home-pitcher':'')+'">'+esc(G.currentPitcher(game).name.split(' ')[0])+'</div>';
    const b=G.currentBatter(game),p=G.currentPitcher(game);
    $('matchup').innerHTML='<div class="player-card"><div class="player-role">打者 · '+(G.batting(game).order+1)+'番</div><div class="player-name">'+esc(b.name)+' <small>'+b.hand+'打ち</small></div><p class="player-trait">'+b.trait+'</p><div class="mini-stats">ミート <b>'+b.contact+'</b> 長打 <b>'+b.power+'</b> 走力 <b>'+b.speed+'</b></div></div><div class="vs">対</div><div class="player-card"><div class="player-role pitcher">投手 · '+p.hand+'投げ</div><div class="player-name">'+esc(p.name)+' <small>'+p.pitches+'球</small></div><p class="player-trait">'+p.trait+'</p><div class="mini-stats">球威 <b>'+p.stuff+'</b> 制球 <b>'+p.control+'</b> <span class="'+(G.fatigue(p)>=.8?'warning':'')+'">'+fatigueText(p)+'</span></div><div class="fatigue-bar '+(G.fatigue(p)>=.8?'high':'')+'"><span style="width:'+Math.min(100,p.pitches/p.stamina*100)+'%"></span></div></div>';
  }
  function renderTactics(){
    if(game.done){$('panel').innerHTML='<div class="results-inline"><h3>'+({win:'勝利',loss:'敗戦',draw:'引き分け'}[game.result])+'</h3><p>'+resultTitle()+'<br>試合の記録から、一手を振り返ろう。</p><button class="primary" id="view-result">結果と振り返りを見る</button><button class="small-button" id="new-game">別の試合へ</button></div>';$('view-result').onclick=showResult;$('new-game').onclick=showSetup;return;}
    const offense=game.half==='home',steal=G.stealInfo(game);
    const choices=offense?[
      ['contact','ミート重視','つなぐ打撃で、出塁を狙う。','三振は減るが、本塁打も減る。',true],
      ['power','長打狙い','ひと振りで、試合を動かす。','本塁打増。三振も増える。',true],
      ['bunt','送りバント','アウトと引き換えに進める。','成功率は打者の小技次第。',G.canBunt(game)],
      ['steal','盗塁','走力を生かして、次の塁へ。',steal?steal.runner.name.split(' ')[0]+'の'+(steal.base===0?'二':'三')+'盗成功目安 '+Math.round(steal.chance*100)+'%':'走者・空いている塁が必要。',!!steal]
    ]:[
      ['normal','バランス','投手の持ち味で勝負する。','四球と長打のリスクを均衡。',true],
      ['strikeout','三振を狙う','走者を動かさずに抑える。','三振増。四球・球数も増。',true],
      ['contact','打たせて取る','四球を減らし、守備に託す。','安打のリスクは上がる。',true],
      ['low','低めで勝負','長打を抑えてゴロを狙う。','本塁打減。四球は増える。',true]
    ];
    if(!choices.some(c=>c[0]===selected&&c[4]))selected=offense?'contact':'normal';
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
    $('panel').innerHTML='<div class="bench-controls"><label>交代の種類<select id="bench-mode">'+(offense?'<option value="pinch">代打</option><option value="runner">代走</option>':'<option value="pitcher">投手交代</option><option value="defense">守備交代</option>')+'</select></label>'+(benchMode==='pitcher'?'<div class="action-hint">現在：'+home.pitchers[home.pitcherIndex].name+'<br>'+fatigueText(home.pitchers[home.pitcherIndex])+'</div>':'<label>交代する選手<select id="bench-target" '+(benchMode==='pinch'?'disabled':'')+'>'+targets.filter(x=>benchMode!=='pinch'||x.i===home.order).map(x=>'<option value="'+x.i+'">'+(x.i+1)+'番 '+x.p.name+'（'+G.positions[x.i]+'）</option>').join('')+(targets.length?'':'<option>走者がいません</option>')+'</select></label>')+'</div><div class="bench-list">'+(benchMode==='pitcher'?home.pitchers.map((p,i)=>'<div class="bench-player"><div><h3>'+p.name+' <small>'+p.hand+'投</small></h3><p>球威 '+p.stuff+' / 制球 '+p.control+' / 目安 '+p.stamina+'球<br>'+p.trait+'</p></div><button class="small-button orange-outline" data-pitcher="'+i+'" '+(home.usedPitchers.includes(i)?'disabled':'')+'>'+(i===home.pitcherIndex?'登板中':home.usedPitchers.includes(i)?'登板済':'交代')+'</button></div>').join(''):home.bench.length?home.bench.map(p=>{
      const mismatch=benchTarget>=0&&G.positions[benchTarget]!=='指'&&!p.pos.includes(G.positions[benchTarget]);
      return '<div class="bench-player"><div><h3>'+p.name+' <small>'+p.hand+'打</small></h3><p>ミート '+p.contact+' / 長打 '+p.power+' / 走力 '+p.speed+'<br>守備 '+p.defense+'（'+p.pos.join('・')+'） · '+p.trait+'</p>'+(mismatch?'<p class="warning">'+G.positions[benchTarget]+'は適性外：守備力が低下</p>':'')+'</div><button class="small-button orange-outline" data-sub="'+p.id+'" '+(benchTarget<0?'disabled':'')+'>交代</button></div>';
    }).join(''):'<p class="empty-note">控え野手を使い切りました。</p>')+'</div><p class="action-hint">交代は取り消せません。守備適性のない位置では守備力が下がります。能力は100段階です。</p><div class="primary-row"><button class="primary" id="back-tactics">采配に戻る</button></div>';
    $('bench-mode').value=benchMode;$('bench-mode').onchange=e=>{benchMode=e.target.value;renderBench();};
    if($('bench-target')){$('bench-target').value=String(benchTarget);$('bench-target').onchange=e=>{benchTarget=Number(e.target.value);renderBench();};}
    document.querySelectorAll('[data-sub]').forEach(el=>el.onclick=()=>{
      const candidate=home.bench.find(p=>p.id===el.dataset.sub);const old=home.lineup[benchTarget];
      showConfirm('選手を交代しますか？',old.name+' → '+candidate.name+'。交代した選手は再出場できません。'+(G.positions[benchTarget]!=='指'&&!candidate.pos.includes(G.positions[benchTarget])?' '+G.positions[benchTarget]+'は守備適性外のため、守備力が下がります。':''),()=>{G.replacePlayer(game,benchTarget,candidate.id,benchMode);save();render();toast('交代しました。采配を選んで進めましょう。');});
    });
    document.querySelectorAll('[data-pitcher]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.pitcher);showConfirm('投手を交代しますか？',home.pitchers[i].name+'にマウンドを託します。交代した投手は再登板できません。',()=>{G.changePitcher(game,'home',i);save();render();toast('投手を交代しました。');});});
    $('back-tactics').onclick=()=>switchTab('tactics');
  }
  function scoreTable(){return '<table class="line-score"><caption class="record-caption">イニング別スコア</caption><thead><tr><th>球団</th>'+Array.from({length:9},(_,i)=>'<th>'+ (i+1)+'</th>').join('')+'<th>計</th></tr></thead><tbody>'+['away','home'].map(k=>'<tr><th>'+(k==='home'?'サンライズ':'ウェーブ')+'</th>'+game.lines[k].map(v=>'<td>'+(v===null?'−':v)+'</td>').join('')+'<td class="total">'+game.score[k]+'</td></tr>').join('')+'</tbody></table>';}
  function logHTML(items){return items.map(l=>'<div class="log-row '+l.kind+'"><small>'+l.half+'</small><span>'+esc(l.text)+'</span></div>').join('');}
  function renderRecord(){
    $('panel').innerHTML='<div class="record-scroll">'+scoreTable()+'<p class="record-caption">操作開始後：サンライズ '+game.stats.home.h+'安打 / '+game.stats.home.bb+'四球 / '+game.stats.home.hr+'本塁打</p><details><summary class="record-caption">現在のサンライズ打順・守備</summary>'+game.teams.home.lineup.map((p,i)=>'<div class="log-row"><small>'+(i+1)+'番</small><span>'+p.name+'（'+G.positions[i]+'）'+(G.positions[i]!=='指'&&!p.pos.includes(G.positions[i])?' · 守備適性外':'')+'</span></div>').join('')+'</details>'+logHTML(game.log.slice().reverse())+'</div>';
  }
  function render(){renderScore();renderField();$('command-title').innerHTML=game.done?'最後の一球まで、<br>あなたの采配。':game.half==='home'?'あなたの采配で、<br>流れを変える。':'この一球を、<br>誰に託す？';$('phase').textContent=game.done?'試合終了':(game.half==='home'?'攻撃中':'守備中')+' / '+game.outs+'死'+(baseText()==='走者なし'?'走者なし':baseText());$('phase').className='phase '+(game.half==='away'?'defend':'');
    document.querySelectorAll('[data-tab]').forEach(el=>{el.setAttribute('aria-selected',el.dataset.tab===tab);el.tabIndex=el.dataset.tab===tab?0:-1;});$('panel').setAttribute('aria-labelledby','tab-'+tab);
    if(tab==='tactics')renderTactics();else if(tab==='bench')renderBench();else renderRecord();
    $('recent').innerHTML=logHTML(game.log.slice(-3).reverse());save();
  }
  function switchTab(value){if(busy)return;tab=value;render();}
  function advance(){
    if(busy||game.done)return;busy=true;const oldHalf=game.half;const result=G.step(game,selected);if(!result.ok){busy=false;render();return;}
    if(game.done)remember();if(oldHalf!==game.half)selected=game.half==='home'?'contact':'normal';
    render();const mainEvent=result.events.find(x=>['hit','hr','out','walk','bunt','steal','sac','error','ground'].includes(x.kind));
    if(mainEvent){const labels={hit:'ヒット！',hr:'ホームラン！',out:'アウト',walk:'フォアボール',bunt:'バント成功',steal:'盗塁成功',sac:'犠牲フライ',error:'エラー',ground:'内野ゴロ'};$('play-flash').innerHTML='<span>'+labels[mainEvent.kind]+'</span>';$('play-flash').className='show';}
    clearTimeout(flashTimer);flashTimer=setTimeout(()=>{$('play-flash').className='';$('play-flash').innerHTML='';busy=false;render();if(game.done)showResult();},650);
  }
  function openDialog(html){$('dialog-content').innerHTML=html;if(!$('dialog').open)$('dialog').showModal();const close=$('close-dialog');if(close)close.onclick=()=>$('dialog').close();}
  function dialogHead(title){return '<div class="dialog-header"><h2 id="dialog-title">'+title+'</h2><button class="close-button" id="close-dialog" aria-label="閉じる">×</button></div>';}
  function showConfirm(title,text,fn){openDialog(dialogHead(title)+'<p class="dialog-text">'+esc(text)+'</p><div class="dialog-actions"><button id="cancel" class="small-button">戻る</button><button id="confirm" class="primary">交代する</button></div>');$('cancel').onclick=()=>$('dialog').close();$('confirm').onclick=()=>{$('dialog').close();fn();};}
  function showSetup(){if(busy)return;openDialog(dialogHead('どの試合を指揮する？')+'<p class="dialog-text">あなたはサンライズの監督。<strong>7回裏、1死一塁</strong>から9回まで指揮します。'+(!game.done?'新しい試合を始めると、進行中の試合は終了します。':'')+'</p><div class="scenario-list">'+Object.entries(G.scenarios).map(([k,s])=>'<button class="scenario" data-scenario="'+k+'"><span><strong>'+s.name+'</strong><small>'+s.text+'</small></span><span class="num">'+s.home+' − '+s.away+'</span></button>').join('')+'</div><p class="record-caption">スコアは左があなたのチーム。9回同点は引き分けです。</p>');document.querySelectorAll('[data-scenario]').forEach(el=>el.onclick=()=>newGame(el.dataset.scenario));}
  function newGame(scenario){game=G.createGame(scenario,Date.now()+Math.floor(Math.random()*100000));selected='contact';tab='tactics';benchMode='pinch';benchTarget=7;$('dialog').close();render();window.scrollTo({top:0,behavior:'instant'});}
  function showHelp(){openDialog(dialogHead('監督の仕事は、選ぶこと。')+'<div class="dialog-text"><p><strong>あなたは後攻のサンライズ。7回裏から9回終了までを戦います。</strong>打撃・投球のタイミング操作はありません。</p><ol><li>「采配」で作戦を選び、<strong>この作戦で進める</strong>を押すと1打席が進みます。</li><li>3アウトで攻守交代。守備では投球方針を選びます。</li><li>「ベンチ」で代打・代走・継投・守備交代。交代は確認後に確定します。</li><li>「記録」でスコアと采配を振り返れます。</li></ol><p><strong>能力は100段階。</strong>ミート・長打・走力・守備・選球眼・バント、投手の球威・制球・疲労・左右相性が結果に影響します。良い選択でも必ず成功するわけではありません。</p><p><strong>守備適性に注意。</strong>例えば控え捕手を代打に使うと、打力が上がっても捕手の守備力が下がります。投手の疲労は球数とスタミナで増加します。</p><p>試作版は全試合DH制。送りバントは2死・三塁走者ありでは不可、盗塁は二盗・三盗のみです。走塁・併殺は簡略化しています。実際の試合を予測するものではありません。</p><p>進行と直近100試合の戦績をこの端末に保存します。ブラウザのデータ削除で消えます。公開URLとローカルファイルの保存は別です。</p></div><button class="primary" id="help-done">采配を始めよう</button>');$('help-done').onclick=()=>$('dialog').close();}
  function shareText(){return 'ベンチからの一手｜'+G.scenarios[game.scenario].name+'\nサンライズ '+game.score.home+' − '+game.score.away+' ブルーウェーブ\n'+({win:'勝利！',loss:'惜しくも敗戦。',draw:'引き分け。'}[game.result])+' 代打・継投、あなたならどうする？\n#ベンチからの一手 #プロ野球観戦メモ';}
  function showResult(){
    if(!game.done)return;const h=history(),count=r=>h.filter(x=>x.result===r).length;
    const moments=game.log.filter(l=>l.kind==='decision'||l.kind==='score'||l.kind==='hr').slice(-3);
    openDialog(dialogHead({win:'サンライズ、勝利！',loss:'あと一歩、届かず。',draw:'9回終了、引き分け。'}[game.result])+'<div class="result-score">'+game.score.home+' − '+game.score.away+'<small>サンライズ 対 ブルーウェーブ</small></div><p class="dialog-text">'+resultTitle()+'</p><div class="result-notes"><h3>試合の分岐点</h3>'+(moments.length?moments.map(m=>'<p>'+m.half+' '+esc(m.text)+'</p>').join(''):'<p>両チームとも終盤の守備で粘りました。</p>')+'</div><p class="record-caption">結果だけで采配の良し悪しは決まりません。選手の特徴や残り戦力も振り返ってみましょう。</p><div class="record-totals">この端末の戦績：'+count('win')+'勝 '+count('loss')+'敗 '+count('draw')+'分（直近'+h.length+'試合）</div><div class="result-buttons"><button id="replay" class="primary">同じ場面でもう一度</button><button id="share" class="small-button">結果をコピー</button><button id="result-record" class="small-button">試合記録を見る</button></div><p class="record-caption">同じ場面でも、プレーの結果は毎回変わります。</p>');
    $('replay').onclick=()=>newGame(game.scenario);$('result-record').onclick=()=>{$('dialog').close();switchTab('record');};$('share').onclick=async()=>{try{await navigator.clipboard.writeText(shareText());toast('結果をコピーしました。');}catch{if(!$('share-fallback')){$('dialog-content').insertAdjacentHTML('beforeend','<label class="record-caption" for="share-fallback">下の文章を選択してコピーしてください。</label><textarea id="share-fallback" class="share-text" readonly>'+esc(shareText())+'</textarea>');}$('share-fallback').select();}};
  }
  function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').className='visible';toastTimer=setTimeout(()=>$('toast').className='',2600);}
  $('help').onclick=showHelp;$('restart').onclick=showSetup;
  document.querySelectorAll('[data-tab]').forEach(el=>{el.onclick=()=>switchTab(el.dataset.tab);el.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=['tactics','bench','record'];let i=tabs.indexOf(tab);i=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;switchTab(tabs[i]);$('tab-'+tabs[i]).focus();};});
  game=loadGame();if(game.done)remember();render();
})();
