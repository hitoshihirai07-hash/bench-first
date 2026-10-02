// Optional browser check: npm install --no-save playwright; npx playwright install chromium
// Run: node tests/ui-smoke.mjs. No build or server dependency is needed.
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const root=fileURLToPath(new URL('../public/',import.meta.url));
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),path=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));if(path.includes('..'))throw Error();const content=await readFile(join(root,path));const ext=path.split('.').at(-1);res.setHeader('Content-Type',({html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css',svg:'image/svg+xml',png:'image/png',woff2:'font/woff2'})[ext]||'application/octet-stream');res.end(content);}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.BENCH_CHROMIUM_EXECUTABLE?{executablePath:process.env.BENCH_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']}: {})});
let flows=0;const errors=[];
async function page(){const context=await browser.newContext({viewport:{width:1365,height:900}});const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await p.goto(url);return p;}
const snapshot=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('bench-first-game-v1')));
async function start(p,key){await p.locator('#choose-scenario').click();await p.locator('[data-scenario="'+key+'"]').click();assert.equal(await p.locator('#game-view').isVisible(),false);assert.match(await p.locator('.daily-card').innerText(),/難易度/);await p.locator('#scene-start').click();await p.locator('#animation-speed').selectOption('none');}
try{
  const p=await page();assert.match(await p.title(),/ベンチからの一手/);assert(await p.locator('#start-screen').isVisible());assert.equal(await p.locator('#game-view').isVisible(),false);assert.equal(await p.locator('#scoreboard').textContent(),'');assert.equal(await snapshot(p),null);
  await p.locator('#choose-scenario').click();assert.equal(await p.locator('.scenario .difficulty').count(),7);await p.locator('[data-scenario="last"]').click();await p.locator('#close-dialog').click();assert.equal(await p.locator('#game-view').isVisible(),false);flows++;
  for(const key of ['chase','tie','lead','advance','ace','last','miracle']){
    const p=await page();await start(p,key);const initial=await snapshot(p);assert.equal(initial.scenario,key);assert(await p.locator('#matchup').isVisible());
    if(key==='chase'){
      await p.locator('#tab-bench').click();await p.locator('[data-sub="h10"]').click();await p.locator('#confirm').click();assert.match(await p.locator('#matchup').innerText(),/白石/);await p.locator('#tab-tactics').click();
    }
    if(key==='ace'){
      await p.locator('#tab-bench').click();await p.locator('[data-pitcher="2"]').click();await p.locator('#confirm').click();assert.match(await p.locator('#matchup').innerText(),/速水/);await p.locator('#tab-tactics').click();
    }
    if(key==='last')assert(await p.locator('#cpu-changes').isVisible());
    for(let n=0;n<100;n++){
      const before=await snapshot(p);if(before.done)break;
      const ids=await p.locator('#matchup [data-player]').evaluateAll(els=>els.map(e=>e.dataset.player));
      await p.locator('#advance').click();await p.waitForFunction(()=>!document.querySelector('#advance')||!document.querySelector('#advance').disabled);
      const after=await snapshot(p);assert.equal(after.lastPlay.batter.id,ids[0]);assert.equal(after.lastPlay.pitcher.id,ids[1]);
    }
    const done=await snapshot(p);assert(done.done,key+' did not finish');assert.match(await p.locator('#dialog-content').innerText(),/試合の分岐点/);
    if(key==='chase'){
      await p.locator('#result-png').click();await p.locator('#result-image').waitFor();assert.equal(await p.locator('#result-image').evaluate(el=>el.naturalWidth),1200);await p.locator('#image-back').click();
    }
    await p.locator('#result-record').click();assert.match(await p.locator('#panel').innerText(),/イニング別スコア/);
    await p.reload();assert.equal(await p.locator('#game-view').isVisible(),false);await p.locator('#resume-game').click();assert.deepEqual((await snapshot(p)).score,done.score);flows++;
  }
  const saved=await page();await start(saved,'tie');await saved.locator('#advance').click();await saved.waitForFunction(()=>!document.querySelector('#advance').disabled);const before=await snapshot(saved);await saved.reload();assert.equal(await saved.locator('#game-view').isVisible(),false);await saved.locator('#resume-game').click();assert.deepEqual(await snapshot(saved),before);flows++;
  const link=await page();await link.goto(url+'/?scenario=ace');assert.equal(await link.locator('#game-view').isVisible(),false);assert.match(await link.locator('#dialog-content').innerText(),/難易度/);await link.locator('#entry-start').click();assert.equal((await snapshot(link)).scenario,'ace');flows++;
  const daily=await page();await daily.goto(url+'/?daily=2026-09-16&rules=02');await daily.locator('#entry-start').click();assert.equal((await snapshot(daily)).daily.date,'2026-09-16');flows++;
  const invalid=await page();await invalid.goto(url+'/?scenario=unknown');assert.match(await invalid.locator('#dialog-content').innerText(),/見つかりません/);await invalid.locator('#entry-close').click();assert.equal(await invalid.locator('.scenario').count(),7);assert.equal(await invalid.locator('#game-view').isVisible(),false);flows++;
  const mobile=await page();await mobile.setViewportSize({width:390,height:844});assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(process.env.BENCH_QA_DIR)await mobile.screenshot({path:join(process.env.BENCH_QA_DIR,'start-mobile.png'),fullPage:true});
  await start(mobile,'ace');assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(process.env.BENCH_QA_DIR)await mobile.screenshot({path:join(process.env.BENCH_QA_DIR,'game-mobile.png'),fullPage:true});flows++;
  if(process.env.BENCH_QA_DIR){const desktop=await page();await desktop.screenshot({path:join(process.env.BENCH_QA_DIR,'start-desktop.png'),fullPage:true});}
  assert.deepEqual(errors,[]);console.log('Browser smoke: '+flows+' flows passed; no page or console errors. Desktop 1365×900 / mobile 390×844.');
}finally{await browser.close();server.close();}
