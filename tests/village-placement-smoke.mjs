import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {createGame,act,serializeGame,getGoals,getProjectCost} from '../src/game.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
await mkdir('artifacts',{recursive:true});
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:'5199'},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',c=>reject(Error('server exited '+c)))});
const s=createGame(73);Object.assign(s,{rank:'E',gold:99999,wood:999,stone:999});assert.equal(act(s,'expand').ok,true);s.completedQuests.patrol=1;s.heroCall={step:'done',skipped:true};
const lessons=Object.fromEntries(getGoals(s).list.map(g=>[g.id,true]));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-webgl']});
try{
 for(const [label,width,height] of [['portrait',390,844],['landscape',844,390],['standalone',844,390]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({save,lessons})=>{localStorage.setItem('little-leaf-guild:v1',save);localStorage.setItem('guild-master:lessons',JSON.stringify(lessons));},{save:serializeGame(s),lessons});
  if(label==='standalone')await page.route(/^https?:/,r=>r.request().isNavigationRequest()?r.continue():r.abort());
  await page.goto('http://localhost:5199/'+(label==='standalone'?'play.html':'index.html')+'?still',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready,null,{timeout:60000});await page.locator('#title-continue').click();await page.locator('#pause-button').click();
  if(width>height)await page.locator('#dock-toggle').click();await page.locator('[data-dock="village"]').click();await page.locator('[data-build-project="shop"]').click();
  const choose=async(x,y)=>{const target=await page.evaluate(({x,y})=>{const r=window.guildDebug.renderer(),p=r.villagePick;r.focusGrid(x+p.w/2,y+p.h/2,1);return window.guildDebug.getScenePoint(x+p.w/2,y+p.h/2);},{x,y});await page.mouse.click(target.x,target.y);return page.evaluate(()=>window.guildDebug.renderer().getVillagePick());};
  const invalid=await choose(15,7);assert.equal(invalid.ok,false);assert.match(invalid.message,/ต่อเติม/);assert.equal(await page.locator('[data-confirm-placement]').isDisabled(),true);
  const pick=await choose(3.25,0);assert.equal(pick.ok,true,'unused area is buildable despite land expansion');assert.equal(pick.x,3.25);assert.ok(pick.y===0);assert.equal(await page.locator('[data-confirm-placement]').isDisabled(),false);
  await page.screenshot({path:`artifacts/village-placement-${label}.png`});
  const goldBefore=await page.evaluate(()=>window.guildDebug.getState().gold);
  await page.locator('[data-confirm-placement]').click();assert.deepEqual(await page.evaluate(()=>window.guildDebug.getState().village.lots.shop),{x:3.25,y:0});assert.equal(await page.evaluate(()=>window.guildDebug.renderer().villagePick),null);
  const gold=await page.evaluate(()=>window.guildDebug.getState().gold);assert.equal(gold,goldBefore-getProjectCost(s,'shop').gold,'construction charges only its advertised cost');
  assert.deepEqual(errors,[]);console.log(label+' village placement passed');await page.close();
 }
}finally{await browser.close();server.kill();}
