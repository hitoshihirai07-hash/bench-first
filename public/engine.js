/* ベンチからの一手 v0.2 — deterministic, DOM-independent game engine. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BenchGame = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 2;
  const positions = ['中', '二', '右', '一', '指', '三', '左', '捕', '遊'];
  const scenarios = {
    chase: { name: '1点を追いかける', home: 2, away: 3, text: '7回裏、1死一塁。あと1点。誰に託す？' },
    tie: { name: '均衡を破る', home: 2, away: 2, text: '7回裏、1死一塁。同点から勝ち越しを狙う。' },
    lead: { name: '1点を守り抜く', home: 3, away: 2, text: '7回裏、1死一塁。追加点と、その後の継投を考えよう。' },
    advance: { name: 'あと1点を取りにいく', home: 2, away: 2, inning: 8, half: 'home', outs: 0, order: 1, bases: [null,0,null], text: '8回裏、同点、無死二塁。送るか、打たせるか。' },
    ace: { name: 'エースに託すか', home: 3, away: 2, inning: 8, half: 'away', outs: 1, order: 3, bases: [2,1,null], pitches: 105, text: '8回表、1点リード、1死一・二塁。疲れた先発を続投させるか。' },
    last: { name: '最後の切り札', home: 2, away: 3, inning: 9, half: 'home', outs: 2, order: 7, bases: [6,5,null], text: '9回裏、1点差、2死一・二塁。巧打か、一発か。' },
    miracle: { name: '奇跡の逆転へ', home: 2, away: 6, inning: 9, half: 'home', outs: 0, order: 3, bases: [2,1,0], text: '9回裏、4点差、無死満塁。つないで追うか、一発で追いつくか。' }
  };
  function batter(id, name, hand, pos, contact, power, speed, defense, eye, bunt, trait) {
    return { id, name, hand, pos, contact, power, speed, defense, eye, bunt, trait };
  }
  function pitcher(id, name, hand, stuff, control, stamina, pitches, trait) {
    return { id, name, hand, stuff, control, stamina, pitches, trait };
  }
  function makeTeam(home) {
    const p = home ? 'h' : 'a';
    const names = home ? ['朝倉 蓮','水野 悠','桐谷 隼人','大河 陸','橘 翔','片桐 誠','相沢 直樹','守屋 司','早瀬 湊','高峰 豪','白石 和真','風間 颯'] : ['青野 航','瀬戸 陽','浜田 亮','黒瀬 剛','成瀬 遼','川島 岳','沖田 純','深町 慎','小波 翼','岩城 仁','三浦 律','波多野 怜'];
    const stats = [
      ['左',['中','右'],70,43,89,75,64,61,'俊足の切り込み役'],
      ['左',['二','遊'],75,36,69,82,75,86,'つなぎと小技'],
      ['右',['右','左'],74,75,65,69,63,40,'走攻の主軸'],
      ['右',['一'],62,93,30,45,54,20,'三振もある大砲'],
      ['左',['指','一'],69,78,40,40,70,35,'長打と選球眼'],
      ['右',['三','一'],64,66,45,77,60,52,'堅実な三塁手'],
      ['左',['左','右'],73,47,67,66,78,64,'粘ってつなぐ'],
      ['右',['捕'],54,33,32,94,56,78,'守りで支える捕手'],
      ['左',['遊','二'],66,32,85,87,62,82,'機動力と守備'],
      ['右',['一','左'],52,98,24,32,45,18,'切り札の一発'],
      ['左',['捕','一'],82,51,35,58,80,56,'巧打の控え捕手'],
      ['右',['中','右','左'],57,30,98,85,55,73,'代走・守備の切り札']
    ];
    const all = stats.map((s,i) => batter(p+i,names[i],...s));
    return {
      name: home ? 'サンライズ' : 'ブルーウェーブ',
      lineup: all.slice(0,9), bench: all.slice(9), removed: [], order: home ? 7 : 2,
      pitchers: [
        pitcher(p+'p0',home?'朝比奈 樹':'河田 悠真','右',73,77,103,home?91:88,'先発・疲労に注意'),
        pitcher(p+'p1',home?'左京 涼':'汐見 怜','左',76,72,27,0,'左打者に強い'),
        pitcher(p+'p2',home?'速水 晃':'結城 圭','右',91,52,30,0,'奪三振型・四球に注意'),
        pitcher(p+'p3',home?'城戸 悠斗':'城山 徹','右',84,85,23,0,'守護神・短い回向き')
      ], pitcherIndex: 0, usedPitchers: [0]
    };
  }
  function random(s) { let x=s.rng>>>0; x^=x<<13; x^=x>>>17; x^=x<<5; s.rng=x>>>0; return s.rng/4294967296; }
  function clamp(x,min,max) { return Math.max(min,Math.min(max,x)); }
  function halfName(s) { return s.inning+'回'+(s.half==='home'?'裏':'表'); }
  function batting(s) { return s.teams[s.half]; }
  function fielding(s) { return s.teams[s.half==='home'?'away':'home']; }
  function currentBatter(s) { const t=batting(s);return t.lineup[t.order]; }
  function currentPitcher(s) { const t=fielding(s);return t.pitchers[t.pitcherIndex]; }
  function addLog(s,text,kind='play') { const l={half:halfName(s),text,kind};s.log.push(l);return l; }
  function createGame(scenario='chase',seed=Date.now()) {
    if (!scenarios[scenario]) scenario='chase';
    const sc=scenarios[scenario];
    const s={ version:VERSION,id:String(seed)+'-'+scenario,rng:(seed>>>0)||12345,scenario,inning:sc.inning||7,half:sc.half||'home',outs:sc.outs===undefined?1:sc.outs,
      score:{home:sc.home,away:sc.away}, lines:{home:[0,1,0,0,sc.home-1,0,0,null,null],away:[1,0,0,1,0,sc.away-2,0,null,null]},
      teams:{home:makeTeam(true),away:makeTeam(false)},bases:[null,null,null],log:[],decisions:[],done:false,result:null,plays:0,
      stats:{home:{h:0,bb:0,k:0,hr:0},away:{h:0,bb:0,k:0,hr:0}}, defense:'normal' };
    for(const side of ['home','away'])for(let i=6;i<9;i++)s.lines[side][i]=(i<s.inning-1||(i===s.inning-1&&(side==='away'||s.half==='home')))?0:null;
    const t=batting(s);if(sc.order!==undefined)t.order=sc.order;
    s.bases=(sc.bases||[6,null,null]).map(i=>i===null?null:t.lineup[i]);
    if(sc.pitches!==undefined)currentPitcher(s).pitches=sc.pitches;
    addLog(s,sc.text,'start');
    addLog(s,currentBatter(s).name+'の打席から、あなたが指揮を執ります。','start');
    return s;
  }
  // The daily condition and RNG seed depend only on a versioned Japan-date key.
  function japanDate(now=new Date()) {return new Date(now.getTime()+9*3600000).toISOString().slice(0,10);}
  function dailySpec(date=japanDate()) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Invalid date');
    let seed=2166136261;for(const c of 'bench-first-daily-02:'+date){seed^=c.charCodeAt(0);seed=Math.imul(seed,16777619)>>>0;}
    const keys=['advance','ace','last','miracle','chase','tie','lead'];
    const day=Math.floor(Date.parse(date+'T00:00:00Z')/86400000);
    return {date,scenario:keys[day%keys.length],seed:seed||12345,code:'02-'+date.replace(/-/g,'')};
  }
  function createDailyGame(date=japanDate(),attemptId=String(Date.now())) {
    const d=dailySpec(date),s=createGame(d.scenario,d.seed);s.daily=d;s.id='daily-'+d.code+'-'+attemptId;return s;
  }
  function buntChance(s) {return canBunt(s)?clamp(.40+currentBatter(s).bunt*.005-(currentPitcher(s).stuff-70)*.001,.4,.88):null;}
  function effectiveDefense(p,pos) {return pos==='指'?null:Math.round(p.defense*(p.pos.includes(pos)?1:.48));}
  function fieldDefense(t) {
    return t.lineup.reduce((sum,p,i)=>sum+(positions[i]==='指'?0:p.defense*(p.pos.includes(positions[i])?1:.48)),0)/8;
  }
  function fatigue(p) { return clamp(p.pitches/p.stamina,0,2); }
  function catcherArm(t) {const c=t.lineup[7];return c.defense*(c.pos.includes('捕')?1:.4);}
  function probabilities(s, attack='contact', defend='normal') {
    const b=currentBatter(s),p=currentPitcher(s),f=Math.max(0,fatigue(p)-.65),same=b.hand===p.hand;
    let hit=.248+(b.contact-65)*.0018-(p.stuff-75)*.0012+f*.075+(same?-.019:.013);
    let hr=.031+(b.power-60)*.00085-(p.stuff-75)*.00035+f*.012;
    let k=.205+(p.stuff-75)*.0018-(b.contact-65)*.0021+(same?.013:0)-f*.035;
    let bb=.075+(b.eye-60)*.001-(p.control-70)*.0013+f*.04;
    if(attack==='contact'){hit+=.016;hr*=.69;k-=.035;}
    if(attack==='power'){hit-=.028;hr*=1.65;k+=.070;}
    if(defend==='strikeout'){k+=.060;bb+=.034;hr+=.006;}
    if(defend==='contact'){k-=.04;bb-=.035;hit+=.023;}
    if(defend==='low'){hr*=.72;bb+=.022;}
    if(s.defense==='in'){hit+=.032;}
    const error=clamp(.026+(65-fieldDefense(fielding(s)))*.00065,.006,.065);
    hr=clamp(hr,.008,.13);hit=clamp(hit,.13,.40);k=clamp(k,.07,.40);bb=clamp(bb,.025,.20);
    // All probabilities are disjoint. hit excludes homers here.
    const triple=hit*.035,double=hit*clamp(.16+(b.power-50)*.003,.1,.31),single=hit-double-triple;
    const ground=.53+(defend==='low'?.10:0);
    const rem=1-(single+double+triple+hr+k+bb+error);
    return {single,double,triple,hr,k,bb,error,ground:rem*ground,fly:rem*(1-ground)};
  }
  function finish(s) {s.done=true;s.result=s.score.home>s.score.away?'win':s.score.home<s.score.away?'loss':'draw';addLog(s,s.result==='win'?'試合終了。サンライズの勝利！':s.result==='loss'?'試合終了。惜しくも敗戦。':'試合終了。9回を終えて引き分け。','end');}
  function scoreRun(s,runner) {
    // Stop at the winning run except on a home run, handled separately.
    if(s.inning===9&&s.half==='home'&&s.score.home>s.score.away)return false;
    s.score[s.half]++;s.lines[s.half][s.inning-1]=(s.lines[s.half][s.inning-1]||0)+1;
    if(s.lastPlay&&runner)s.lastPlay.scored.push(runner.id);
    return true;
  }
  function advanceHit(s,n,b) {
    const next=[null,null,null];
    for(let i=2;i>=0;i--)if(s.bases[i]){
      let dest=i+n;
      if(n===1&&i===1)dest=random(s)<(.33+s.bases[i].speed*.004)?3:2;
      if(n===1&&i===0&&next[2]===null&&random(s)<(.10+s.bases[i].speed*.002))dest=2;
      if(dest>=3)scoreRun(s,s.bases[i]);else next[dest]=s.bases[i];
    }
    next[n-1]=b;s.bases=next;
  }
  function walk(s,b) { if(s.bases[0]){if(s.bases[1]){if(s.bases[2])scoreRun(s,s.bases[2]);s.bases[2]=s.bases[1];}s.bases[1]=s.bases[0];}s.bases[0]=b; }
  function endPlay(s,completedPA) {
    if(s.lastPlay){s.lastPlay.afterBases=s.bases.map(p=>p?{id:p.id,name:p.name}:null);s.lastPlay.outsAfter=s.outs;s.lastPlay.runs=s.score[s.half]-s.lastPlay.scoreBefore;}
    if(completedPA)batting(s).order=(batting(s).order+1)%9;
    s.plays++;
    if(s.inning===9&&s.half==='home'&&s.score.home>s.score.away){finish(s);return;}
    if(s.outs>=3){
      s.outs=0;s.bases=[null,null,null];
      if(s.half==='away'){
        if(s.inning===9&&s.score.home>s.score.away){s.lines.home[8]='×';finish(s);return;}
        s.half='home';
      }else{if(s.inning===9){finish(s);return;}s.inning++;s.half='away';}
      s.lines[s.half][s.inning-1]=0;s.defense='normal';
      addLog(s,halfName(s)+'へ。'+(s.half==='home'?'サンライズの攻撃です。':'サンライズの守備です。'),'change');
    }
  }
  function stealInfo(s) {
    let base=-1;
    if(s.bases[1]&&!s.bases[2])base=1;else if(s.bases[0]&&!s.bases[1])base=0;
    if(base<0)return null;
    const runner=s.bases[base],p=currentPitcher(s);
    const chance=clamp(.46+runner.speed*.0042-catcherArm(fielding(s))*.0017-(p.hand==='左'?.035:0)-(base===1?.055:0),.22,.9);
    return {base,runner,chance};
  }
  function canBunt(s) {return s.outs<2&&!s.bases[2]&&!!(s.bases[0]||s.bases[1]);}
  function recordDecision(s,text) {s.decisions.push({half:halfName(s),text});addLog(s,text,'decision');}
  function replacePlayer(s,index,id,mode='pinch') {
    if(s.done)return false;
    const t=s.teams.home;
    if(!Number.isInteger(index)||index<0||index>8)return false;
    if(mode==='pinch'&&(s.half!=='home'||index!==t.order))return false;
    if(mode==='defense'&&s.half!=='away')return false;
    const bi=t.bench.findIndex(p=>p.id===id);if(bi<0)return false;
    const old=t.lineup[index],incoming=t.bench[bi];
    if(mode==='runner'&&(s.half!=='home'||!s.bases.some(p=>p&&p.id===old.id)))return false;
    t.lineup[index]=incoming;t.bench.splice(bi,1);t.removed.push(old);
    s.bases=s.bases.map(p=>p&&p.id===old.id?incoming:p);
    const label=mode==='runner'?'代走':mode==='defense'?'守備交代':'代打';
    recordDecision(s,label+'：'+old.name+' → '+incoming.name+'。'+(positions[index]!=='指'&&!incoming.pos.includes(positions[index])?'守備適性外のため守備力が低下。':'交代した選手は再出場できません。'));
    return true;
  }
  function changePitcher(s,team,index) {
    if(s.done||!['home','away'].includes(team))return false;
    const t=s.teams[team];
    if(t.usedPitchers.includes(index)||!t.pitchers[index])return false;
    t.pitcherIndex=index;t.usedPitchers.push(index);
    recordDecision(s,(team==='home'?'継投':'相手の継投')+'：'+t.pitchers[index].name+'。'+t.pitchers[index].trait+'。');return true;
  }
  function cpuBefore(s) {
    if(s.half==='home'){
      const t=s.teams.away,p=currentPitcher(s);
      if(fatigue(p)>.96){
        const options=t.pitchers.map((p,i)=>({p,i})).filter(x=>!t.usedPitchers.includes(x.i));
        options.sort((a,b)=>{
          const rate=x=>x.p.stuff+x.p.control*.35+(x.p.hand===currentBatter(s).hand?12:0)+(s.inning===9&&x.i===3?22:0);
          return rate(b)-rate(a);
        });
        if(options.length)changePitcher(s,'away',options[0].i);
      }
    }else{
      const t=s.teams.away,b=currentBatter(s);
      if(s.inning>=8&&s.score.away<=s.score.home&&b.contact+b.power<105&&t.bench.length){
        const i=t.bench.reduce((best,p,j)=>p.contact+p.power>t.bench[best].contact+t.bench[best].power?j:best,0);
        const incoming=t.bench.splice(i,1)[0];t.removed.push(b);t.lineup[t.order]=incoming;
        addLog(s,'相手の代打：'+b.name+' → '+incoming.name+'。','decision');
      }
    }
  }
  function step(s,action='contact') {
    if(s.done)return {ok:false};
    const offense=s.half==='home';
    const valid=offense?['contact','power','bunt','steal']:['normal','strikeout','contact','low'];
    if(!valid.includes(action)||(action==='bunt'&&!canBunt(s))||(action==='steal'&&!stealInfo(s)))return {ok:false};
    const start=s.log.length,oldScore=s.score[s.half];
    cpuBefore(s);
    let attack=offense?action:(currentBatter(s).power>=75&&s.score.away<=s.score.home?'power':'contact');
    const defend=offense?(s.bases[0]&&s.outs<2?'low':'normal'):action;
    const p=currentPitcher(s),b=currentBatter(s),st=s.stats[s.half];
    s.lastPlay={half:s.half,inning:s.inning,batter:{id:b.id,name:b.name},pitcher:{id:p.id,name:p.name},beforeBases:s.bases.map(p=>p?{id:p.id,name:p.name}:null),outsBefore:s.outs,scoreBefore:s.score[s.half],scored:[],outIds:[],outcome:'',direction:(s.plays%3)-1};
    const labels={contact:offense?'ミート重視':'打たせて取る',power:'長打狙い',bunt:'送りバント',steal:'盗塁',normal:'バランス',strikeout:'三振を狙う',low:'低めで勝負'};
    s.decisions.push({half:halfName(s),text:labels[action]+'：'+(offense?b.name:p.name)});
    if(action==='steal'){
      const info=stealInfo(s);p.pitches++;
      if(random(s)<info.chance){s.lastPlay.outcome='steal';s.bases[info.base+1]=info.runner;s.bases[info.base]=null;addLog(s,info.runner.name+'、'+(info.base===0?'二':'三')+'盗成功！','steal');}
      else{s.lastPlay.outcome='caught';s.lastPlay.outIds.push(info.runner.id);s.bases[info.base]=null;s.outs++;addLog(s,info.runner.name+'、盗塁失敗。アウト。','out');}
      endPlay(s,false);return {ok:true,events:s.log.slice(start),play:s.lastPlay};
    }
    p.pitches+=3+Math.floor(random(s)*4)+(defend==='strikeout'?1:0);
    if(attack==='bunt'){
      const chance=buntChance(s);s.lastPlay.outIds.push(b.id);
      if(random(s)<chance){s.lastPlay.outcome='bunt';if(s.bases[1])s.bases[2]=s.bases[1];s.bases[1]=s.bases[0];s.bases[0]=null;s.outs++;addLog(s,b.name+'、送りバント成功。走者が進塁。','bunt');}
      else{s.lastPlay.outcome='buntOut';s.outs++;addLog(s,b.name+'、バント失敗。走者は進めず。','out');}
    }else{
      const probs=probabilities(s,attack,defend);let roll=random(s),outcome='fly';
      for(const [key,v] of Object.entries(probs)){roll-=v;if(roll<0){outcome=key;break;}}
      s.lastPlay.outcome=outcome;
      const before=s.score[s.half];
      if(outcome==='bb'){walk(s,b);st.bb++;addLog(s,b.name+'、フォアボール。','walk');}
      else if(outcome==='hr'){
        const runs=1+s.bases.filter(Boolean).length;s.lastPlay.scored=s.bases.filter(Boolean).map(p=>p.id).concat(b.id);s.score[s.half]+=runs;s.lines[s.half][s.inning-1]+=runs;s.bases=[null,null,null];st.h++;st.hr++;
        addLog(s,b.name+'、'+(runs===1?'ソロ':runs===4?'満塁':runs+'ラン')+'ホームラン！','hr');
      }else if(['single','double','triple','error'].includes(outcome)){
        advanceHit(s,outcome==='double'?2:outcome==='triple'?3:1,b);
        if(outcome!=='error')st.h++;
        addLog(s,b.name+'、'+({single:'ヒット！',double:'二塁打！',triple:'三塁打！',error:'相手のエラーで出塁。'}[outcome]),outcome==='error'?'error':'hit');
      }else if(outcome==='k'){s.lastPlay.outIds.push(b.id);s.outs++;st.k++;addLog(s,b.name+'、空振り三振。','out');}
      else if(outcome==='ground'){
        const dpChance=clamp(.47-b.speed*.0025,.14,.43);
        if(s.bases[0]&&s.outs<2&&random(s)<dpChance){s.lastPlay.outcome='dp';s.lastPlay.outIds.push(s.bases[0].id,b.id);s.bases[0]=null;s.outs+=2;addLog(s,b.name+'、ゴロ併殺。ダブルプレー。','out');}
        else{
          const hadFirst=!!s.bases[0];s.outs++;s.lastPlay.outIds.push(b.id);
          if(s.outs<3&&s.bases[2]&&s.defense!=='in'&&!hadFirst&&random(s)<.55){scoreRun(s,s.bases[2]);s.bases[2]=null;addLog(s,b.name+'、内野ゴロの間に三塁走者が生還。','ground');}
          else addLog(s,b.name+'、内野ゴロ。走者は進めず。','out');
        }
      }else{
        s.outs++;s.lastPlay.outIds.push(b.id);
        if(s.outs<3&&s.bases[2]&&random(s)<(.36+s.bases[2].speed*.004)){s.lastPlay.outcome='sac';scoreRun(s,s.bases[2]);s.bases[2]=null;addLog(s,b.name+'、犠牲フライ！','sac');}
        else addLog(s,b.name+'、フライアウト。','out');
      }
      if(s.score[s.half]>before)addLog(s,(s.score[s.half]-before)+'点が入りました。サンライズ '+s.score.home+' − '+s.score.away+' ブルーウェーブ。','score');
    }
    endPlay(s,true);return {ok:true,events:s.log.slice(start),runs:s.lastPlay.runs,play:s.lastPlay};
  }
  function setDefense(s,value) {if(s.done||s.half!=='away'||!['normal','in'].includes(value))return false;s.defense=value;recordDecision(s,'守備位置：'+(value==='in'?'前進守備。内野ゴロでの本塁生還を防ぐ代わりに、安打が増えます。':'定位置に戻します。'));return true;}
  return { VERSION,positions,scenarios,createGame,createDailyGame,dailySpec,japanDate,buntChance,effectiveDefense,step,replacePlayer,changePitcher,setDefense,batting,fielding,currentBatter,currentPitcher,fieldDefense,fatigue,stealInfo,canBunt,halfName,probabilities };
});
