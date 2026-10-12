import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {createGame,serializeGame,getGoals} from '../src/game.js';
import {addChest} from '../src/progress.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const root=fileURLToPath(new URL('../',import.meta.url));await mkdir('artifacts',{recursive:true});
const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:'5197'},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',c=>reject(Error('server exited '+c)))});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-gpu','--enable-features=WebContentsForceDark']});
const errors=[];
try{
 const state=createGame(73);Object.assign(state,{gold:25906,stone:613,herb:963,rep:3004,day:66,clock:120,elapsed:15720});state.completedQuests.patrol=1;state.heroCall={step:'done',skipped:true};
 for(let i=0;i<12;i++)addChest(state.progress,'gold','ภาพทดสอบ');
 const lessons=Object.fromEntries(getGoals(state).list.map(g=>[g.id,true]));
 const cases=[['portrait',390,844],['landscape',844,390],['wide-phone',1280,460],['desktop',1365,900],['standalone',390,844]];
 for(const [label,width,height] of cases.filter(c=>!process.argv.includes('--standalone-only')||c[0]==='standalone')){
  const page=await browser.newPage({viewport:{width,height},colorScheme:'dark',hasTouch:label!=='desktop'});page.on('pageerror',e=>errors.push(label+': '+e.message));
  await page.addInitScript(({save,lessons})=>{localStorage.setItem('little-leaf-guild:v1',save);localStorage.setItem('guild-master:lessons',JSON.stringify(lessons))},{save:serializeGame(state),lessons});
  if(label==='standalone')await page.route(/^https?:/,r=>{if(r.request().isNavigationRequest())return r.continue();errors.push('Standalone network: '+r.request().url());return r.abort()});
  await page.goto('http://localhost:5197/'+(label==='standalone'?'play.html':'index.html')+'?still',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready,null,{timeout:60000});await page.locator('#title-continue').click();await page.waitForTimeout(250);
  assert.match(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),/light/);
  const compact=label!=='desktop';assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('compact-ui')),compact);
  if(compact){
   assert.equal(await page.locator('#goal-card').isVisible(),false);assert.equal(await page.locator('#near-goals').isVisible(),false);assert.equal(await page.locator('#city-stats').isVisible(),false);
   assert.equal(await page.locator('#zoom-in').isVisible(),false);
   const bar=await page.locator('#dock').boundingBox();assert.ok(bar.height<=66&&bar.x>=0&&bar.x+bar.width<=width);
   await page.screenshot({path:`artifacts/mobile-ui-${label}.png`});
   await page.locator('#notifications-button').click();await page.locator('#notifications-dialog').waitFor({state:'visible'});
   assert.equal(await page.locator('#near-goals').isVisible(),true);assert.equal(await page.locator('#goal-card').isVisible(),true);
   await page.locator('#notifications-close').click();
   await page.locator('#notifications-button').click();await page.locator('[data-open-chest]').click();assert.equal(await page.locator('#notifications-dialog').evaluate(e=>e.open),false);assert.equal(await page.locator('#chest-dialog').evaluate(e=>e.open),true);await page.locator('[data-chest-later]').click();
   await page.locator('#view-controls-toggle').click();assert.equal(await page.locator('#zoom-in').isVisible(),true);await page.locator('#view-controls-toggle').click();
   await page.locator('#fullscreen-button').click();await page.waitForTimeout(150);
   const full=await page.evaluate(()=>Boolean(document.fullscreenElement)||document.body.classList.contains('play-focus'));assert.equal(full,true);assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('compact-ui')),true,'touch layout remains compact in fullscreen');
   await page.locator('#fullscreen-button').click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>Boolean(document.fullscreenElement)||document.body.classList.contains('play-focus')),false);
  }
  console.log(label+' passed');await page.close();
 }
 const fallback=await browser.newPage({viewport:{width:390,height:844}});
 await fallback.goto('http://localhost:5197/index.html?still',{waitUntil:'domcontentloaded'});
 await fallback.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready,null,{timeout:60000});
 await fallback.evaluate(()=>{Object.defineProperty(document.documentElement,'requestFullscreen',{value:undefined});Object.defineProperty(document.documentElement,'webkitRequestFullscreen',{value:undefined});document.getElementById('title-screen').hidden=true;document.body.classList.remove('on-title')});
 await fallback.locator('#fullscreen-button').click();assert.equal(await fallback.locator('body').evaluate(e=>e.classList.contains('play-focus')),true);await fallback.locator('#fullscreen-button').click();assert.equal(await fallback.locator('body').evaluate(e=>e.classList.contains('play-focus')),false);
 assert.deepEqual(errors,[]);console.log('unsupported fullscreen fallback passed');await fallback.close();
}finally{await browser.close();server.kill();}
