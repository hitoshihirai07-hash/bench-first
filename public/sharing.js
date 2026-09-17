/* Share links and result cards. Daily rules deliberately remain edition 02. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BenchSharing=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SITE='https://bench-first.pages.dev/',EDITION='02';
  function link(kind,value){const u=new URL(SITE);if(kind==='today')u.searchParams.set('daily','today');else if(kind==='daily'){u.searchParams.set('daily',value);u.searchParams.set('rules',EDITION);}else if(kind==='scenario')u.searchParams.set('scenario',value);return u.href;}
  function parse(search,G){
    const q=new URLSearchParams(search),daily=q.get('daily'),scene=q.get('scenario');
    if(!q.has('daily')&&!q.has('scenario')&&!q.has('rules'))return null;
    if(['daily','scenario','rules'].some(k=>q.getAll(k).length>1)||(q.has('daily')&&q.has('scenario')))return {error:'お題の指定が重複しています。リンクを確認してください。'};
    if(q.has('rules')&&q.get('rules')!==EDITION)return {error:'このリンクのお題の版には対応していません。今日のお題から遊べます。'};
    if(daily==='today')return {kind:'today'};
    if(q.has('daily')){try{if(!/^20\d{2}-\d{2}-\d{2}$/.test(daily))throw Error();return {kind:'daily',...G.dailySpec(daily)};}catch{return {error:'お題の日付が正しくありません。今日のお題から遊べます。'};}}
    if(q.has('scenario')&&Object.prototype.hasOwnProperty.call(G.scenarios,scene))return {kind:'scenario',scenario:scene};
    return {error:'指定された場面が見つかりません。「はじめから」で場面を選べます。'};
  }
  function resultLink(game){return game.daily?link('daily',game.daily.date):link('scenario',game.scenario);}
  function resultData(game,G){return {title:'ベンチからの一手',text:(game.daily?'共通のお題 '+game.daily.date+'｜'+game.daily.code:'自由に挑戦')+'\n'+G.scenarios[game.scenario].name+'\nサンライズ '+game.score.home+' − '+game.score.away+' ブルーウェーブ\n'+({win:'勝利！',loss:'敗戦。',draw:'引き分け。'}[game.result])+' あなたならどう采配する？\n#ベンチからの一手 #プロ野球観戦メモ',url:resultLink(game)};}
  function text(data){return data.text+'\n'+data.url;}
  function canNative(nav,data){try{return typeof nav.share==='function'&&(!nav.canShare||nav.canShare(data));}catch{return false;}}
  async function share(nav,data){if(!canNative(nav,data))return 'fallback';try{await nav.share(data);return 'opened';}catch(e){return e.name==='AbortError'?'cancelled':'fallback';}}
  // Pure canvas drawing keeps saved PNGs independent of screen size and DOM layout.
  async function card(game,G){
    if(!game.done)throw new Error('試合終了後に保存できます。');
    if(document.fonts)await Promise.all([document.fonts.load('700 32px "Noto Sans JP"'),document.fonts.load('400 24px "Noto Sans JP"')]);
    const c=document.createElement('canvas');c.width=1200;c.height=900;const x=c.getContext('2d');if(!x)throw new Error('画像を作成できません。');
    const ink='#203c36',orange='#ed621c',muted='#647b74';
    function rect(a,b,w,h,color){x.fillStyle=color;x.fillRect(a,b,w,h);}
    function label(t,a,b,size=28,color=ink,weight=700,max=1080){x.fillStyle=color;x.font=weight+' '+size+'px "Noto Sans JP",sans-serif';x.fillText(t,a,b,max);}
    function wrap(t,a,b,max,size=24,color=muted,limit=2){x.font='400 '+size+'px "Noto Sans JP",sans-serif';let line='',n=0;for(const ch of t){if(x.measureText(line+ch).width>max&&line){label(line,a,b+n*(size+12),size,color,400);n++;line='';if(n>=limit)return;}line+=ch;}if(line)label(line,a,b+n*(size+12),size,color,400);}
    rect(0,0,1200,900,'#f3f7f4');rect(0,0,1200,14,orange);rect(40,40,1120,820,'#ffffff');
    label('ベンチからの一手',76,106,40);label('プロ野球観戦メモ',820,104,23,muted);
    rect(76,140,1048,2,'#e0e8e3');
    label(game.daily?'共通のお題 '+game.daily.date+'  /  '+game.daily.code:'自由に挑戦  /  終盤の采配',76,192,24,muted,400);
    label(G.scenarios[game.scenario].name,76,259,42);
    wrap(G.scenarios[game.scenario].text,76,305,1048,23,muted,1);
    rect(76,348,1048,220,'#fff5ed');
    label('サンライズ',112,414,30);label('ブルーウェーブ',770,414,30);
    label('あなたのチーム',112,459,20,muted,400);label('CPU',770,459,20,muted,400);
    const score=game.score.home+' − '+game.score.away;x.textAlign='center';label(score,600,480,96,orange,700,460);label({win:'勝利',loss:'敗戦',draw:'引き分け'}[game.result],600,540,32,ink);x.textAlign='left';
    const last=game.log.filter(l=>['score','hr'].includes(l.kind)).slice(-1)[0]||game.log.filter(l=>l.kind==='decision').slice(-1)[0];
    label('試合のひとこま',76,625,23,orange);wrap(last?last.half+' '+last.text:'最後まで戦い抜いた、あなたの采配。',76,668,1048,25,ink,2);
    rect(76,744,1048,2,'#e0e8e3');label('あなたなら、どう采配する？',76,795,30);label('bench-first.pages.dev',76,832,22,muted,400);
    label(game.daily?'同じお題へのリンクを本文に添えて共有':'同じ場面へのリンクを本文に添えて共有',605,825,20,muted,400,510);
    const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('画像を作成できません。')),'image/png'));
    return {blob,name:'bench-first-'+(game.daily?game.daily.code:game.scenario)+'-'+game.score.home+'-'+game.score.away+'.png'};
  }
  return {SITE,EDITION,link,parse,resultLink,resultData,text,canNative,share,card};
});
