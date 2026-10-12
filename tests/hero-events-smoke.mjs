import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import { createGame, act, serializeGame, getGoals } from '../src/game.js';
import { mkdir } from 'node:fs/promises';
await mkdir('artifacts',{recursive:true});
const root=fileURLToPath(new URL('../',import.meta.url));
const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:'5198'},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error('Preview server exited: '+code)))});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-gpu']});
const errors=[];
const stateOf=page=>page.evaluate(()=>window.guildDebug.getState());
try{
 for(const [label,width,height,id,url] of [
  ['desktop',1365,900,'gooseToll','http://localhost:5198/index.html?still'],
  ['mobile',390,844,'fallingStar','http://localhost:5198/index.html?still'],
  ['standalone',1365,900,'teaSprint','http://localhost:5198/play.html?still']]){
  const s=createGame(91);s.policy={memberHunting:false,autoPetitions:false,registration:false};act(s,'heroMode',{on:true});
  s.hero.encounters.pending={id,serial:1};s.hero.encounters.serial=1;
  const lessons=Object.fromEntries(getGoals(s).list.map(g=>[g.id,true]));
  const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>errors.push(`${label}: ${e.message}`));
  await page.addInitScript(({save,lessons})=>{localStorage.setItem('little-leaf-guild:v1',save);localStorage.setItem('guild-master:lessons',JSON.stringify(lessons));},{save:serializeGame(s),lessons});
  if(label==='standalone')await page.route(/^https?:/,r=>{if(r.request().isNavigationRequest())return r.continue();errors.push('Standalone requested '+r.request().url());return r.abort();});
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready,null,{timeout:60000});await page.locator('#title-continue').click();
  await page.locator('#hero-event-dialog').waitFor({state:'visible'});const before=await stateOf(page);await page.waitForTimeout(300);const after=await stateOf(page);
  assert.equal(after.elapsed,before.elapsed,'world pauses while reading');assert.equal(after.hero.hp,before.hero.hp);
  assert.equal(await page.locator('#hero-event-dialog [data-hero-choice]').count(),3);
  await page.screenshot({path:`artifacts/hero-${label}-encounter.png`});
  const choice={desktop:'honk',mobile:'chase',standalone:'drink'}[label];await page.locator(`[data-hero-choice="${choice}"]`).click();
  if(label==='desktop'){assert.equal((await stateOf(page)).rep,s.rep+2);}
  if(label==='mobile'){
   const c=(await stateOf(page)).hero.encounters.challenge;assert.equal(c.kind,'reach');assert.equal(c.left,30);
   await page.waitForTimeout(200);assert.equal((await stateOf(page)).hero.encounters.challenge.left,30,'timer waits for Start');
  }
  await page.locator('[data-hero-event-continue]').click();await page.waitForTimeout(200);
  assert.equal(await page.locator('#hero-event-dialog').evaluate(e=>e.open),false);
  const coords=(await stateOf(page)).hero;await page.waitForTimeout(200);const idle=(await stateOf(page)).hero;
  assert.ok(Math.hypot(idle.x-coords.x,idle.y-coords.y)<.05,'no stuck movement after dialog');
  if(label==='desktop'){
   await page.keyboard.down('d');await page.waitForTimeout(350);await page.keyboard.up('d');const moved=(await stateOf(page)).hero;
   assert.ok(Math.hypot(moved.x-idle.x,moved.y-idle.y)>.5,'controls resume');
  }
  if(label==='mobile'){
   assert.ok((await stateOf(page)).hero.encounters.challenge.left<30);assert.equal(await page.evaluate(()=>window.guildDebug.renderer().heroGoalMarker.visible),true);
   await page.screenshot({path:'artifacts/hero-mobile-challenge.png'});
   await page.locator('[data-hero-abandon]').click();assert.equal((await stateOf(page)).hero.encounters.challenge,null);
  }
  if(label==='standalone')assert.equal((await stateOf(page)).hero.encounters.buffs[0].kind,'tea');
  console.log(`${label}: dialog, pause, choices and resume passed`);await page.close();
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();server.kill();}
