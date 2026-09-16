/* Game-state markers only: animation never consumes simulation randomness. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BenchMotion=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const bases=[[50,84],[84.5,52.4],[50,38.2],[15.4,52.4],[50,84]],mound=[50,52.5];
  const labels={single:'ヒット！',double:'二塁打！',triple:'三塁打！',hr:'ホームラン！',bb:'フォアボール',k:'三振',ground:'内野ゴロ',fly:'フライアウト',sac:'犠牲フライ！',error:'エラー',dp:'ダブルプレー',bunt:'送りバント成功',buntOut:'バント失敗',steal:'盗塁成功！',caught:'盗塁失敗'};
  function plan(play){
    const runners=[];const steal=['steal','caught'].includes(play.outcome);
    const starters=play.beforeBases.map((p,i)=>p?{p,from:i+1}:null).filter(Boolean);
    if(!steal)starters.push({p:play.batter,from:0});
    for(const {p,from} of starters){
      let to=play.afterBases.findIndex(x=>x&&x.id===p.id)+1;
      const scored=play.scored.includes(p.id),out=play.outIds.includes(p.id);
      if(scored)to=4;
      else if(out)to=play.outcome==='k'||play.outcome==='fly'||play.outcome==='sac'?from:Math.min(from+1,3);
      else if(!to)to=from; // stranded or play ended on another runner's winning run
      const points=[];for(let i=from;i<=to;i++)points.push(bases[i]);
      if(!points.length)points.push(bases[from]);
      runners.push({id:p.id,name:p.name,points,scored,out});
    }
    const d=play.direction||0,deep=[50+d*27,play.outcome==='hr'?10:24];
    let ball=[mound,bases[0]];
    if(steal){const moved=runners.find(r=>r.points.length>1);ball=[bases[0],moved?moved.points.at(-1):bases[2]];}
    else if(['single','double','triple','hr','error','fly','sac'].includes(play.outcome))ball.push([50+d*14,48],deep);
    else if(play.outcome==='dp')ball.push([36,47],bases[2],bases[1]);
    else if(['ground','bunt','buntOut'].includes(play.outcome))ball.push([43,65],bases[1]);
    return {runners,ball,label:labels[play.outcome]||'プレー終了'};
  }
  function frames(points){return points.map((p,i)=>({left:p[0]+'%',top:p[1]+'%',offset:points.length===1?0:i/(points.length-1)}));}
  async function run(play,speed='normal',reduced=false){
    const layer=document.getElementById('motion-layer'),flash=document.getElementById('play-flash'),field=document.getElementById('field');
    if(speed==='none'||reduced)return;
    const duration=speed==='fast'?500:play.outcome==='hr'?1950:1550,p=plan(play),animations=[];
    layer.replaceChildren();field.classList.add('playing');layer.dataset.outcome=play.outcome;
    const ball=document.createElement('span');ball.className='motion-ball';layer.append(ball);
    const bf=frames(p.ball);animations.push(ball.animate(bf,{duration:duration*.8,easing:'linear',fill:'both'}));
    for(const r of p.runners){
      const el=document.createElement('span');el.className='motion-runner '+(play.half==='away'?'opponent':'');el.textContent=r.name.split(' ')[0];layer.append(el);
      const pts=frames(r.points);if(pts.length===1)pts.push({...pts[0],offset:1});
      if(r.out){pts[pts.length-1].opacity=0;pts[pts.length-1].background='#68766e';}
      animations.push(el.animate(pts,{delay:duration*.15,duration:duration*.85,fill:'both',easing:'linear'}));
    }
    flash.replaceChildren();const banner=document.createElement('span');banner.textContent=p.label+(play.runs?'  ＋'+play.runs+'点':'');flash.append(banner);flash.className='motion-result';
    animations.push(banner.animate([{opacity:0,transform:'translateY(5px)'},{opacity:0,offset:.55},{opacity:1,offset:.7,transform:'translateY(0)'},{opacity:1}],{duration,fill:'both'}));
    try{await Promise.all(animations.map(a=>a.finished.catch(()=>{})));}
    finally{animations.forEach(a=>a.cancel());layer.replaceChildren();delete layer.dataset.outcome;flash.replaceChildren();flash.className='';field.classList.remove('playing');}
  }
  return {plan,run,labels};
});
