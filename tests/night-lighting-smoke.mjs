import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {createGame,serializeGame,getGoals} from '../src/game.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
await mkdir('artifacts',{recursive:true});
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:'5198'},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',c=>reject(Error('server exited '+c)))});
const state=createGame(73);state.completedQuests.patrol=1;state.heroCall={step:'done',skipped:true};state.gold=50000;state.clock=120;
Object.assign(state.village,{houses:8,prosperity:4000,occupancy:1,inn:1,clinic:1,shop:1,market:2,smithy:1,dojo:1,arena:1,stage:1,fairground:1,monument:1,tannery:1,apothecary:1,jeweler:1,caravan:1,auction:1});
const lessons=Object.fromEntries(getGoals(state).list.map(g=>[g.id,true]));
const report=[];
try{
 for(const mode of ['canvas','webgl','standalone'].filter(m=>!process.argv.includes('--skip-canvas')||m!=='canvas')){
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox',...(mode==='webgl'?['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:['--disable-webgl'])]});
  try{
   const page=await browser.newPage({viewport:{width:1000,height:640},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(({save,lessons})=>{localStorage.setItem('little-leaf-guild:v1',save);localStorage.setItem('guild-master:lessons',JSON.stringify(lessons));},{save:serializeGame(state),lessons});
   if(mode==='standalone')await page.route(/^https?:/,r=>r.request().isNavigationRequest()?r.continue():r.abort());
   await page.goto('http://localhost:5198/'+(mode==='standalone'?'play.html':'index.html')+'?still',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready,null,{timeout:120000});await page.locator('#title-continue').click();await page.locator('#pause-button').click();
   assert.equal(await page.evaluate(()=>window.guildDebug.getRendererInfo().renderer),mode==='webgl'?'WebGL':'Canvas');
   await page.locator('#scene-only-button').click();
   await page.evaluate(()=>{const r=window.guildDebug.renderer();r.state.clock=120;r.focusGrid(8,15,.6);});
   await page.waitForTimeout(900);
   const measure=()=>page.evaluate(()=>{const r=window.guildDebug.renderer(),cv=document.createElement('canvas');cv.width=r.canvas.width;cv.height=r.canvas.height;const ctx=cv.getContext('2d');ctx.drawImage(r.canvas,0,0);const data=ctx.getImageData(0,0,cv.width,cv.height).data;let lum=0,count=0;for(let i=0;i<data.length;i+=64){lum+=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];count++;}return{lum:lum/count,lights:r.buildingLights.size,visible:[...r.buildingLights.values()].filter(v=>v.panes.visible).length,objects:r.scene.children.list.length,scheme:getComputedStyle(document.documentElement).colorScheme};});
   const day=await measure();assert.equal(day.visible,0);
   await page.screenshot({path:`artifacts/night-lighting-${mode}-day.png`});
   await page.evaluate(()=>{window.guildDebug.renderer().state.clock=210;});await page.waitForTimeout(350);
   const night=await measure();assert.ok(night.visible>=20);assert.ok(night.lum/day.lum<.8&&night.lum/day.lum>.35,mode+' gentle night contrast '+night.lum/day.lum);
   assert.equal(night.scheme,day.scheme,'UI palette stays light');
   const inventory=await page.evaluate(()=>{const r=window.guildDebug.renderer();return [...r.buildingLights].map(([src,l])=>({key:src.texture.key,flip:src.flipX,x:src.x,lightX:l.panes.x,pad:l.pad,visible:l.panes.visible}));});
   assert.ok(inventory.some(v=>v.key.startsWith('building-back-')),'guild windows have lights');
   for(const key of ['home-store','home-smithy','home-dojo','arena-1','stage-1-0','fairground-1-0','barn','windmill','lm-post-0'])assert.ok(inventory.some(v=>v.key===key),key+' lit');
   await page.screenshot({path:`artifacts/night-lighting-${mode}-night.png`});
   // Relocated and mirrored homes must carry the light layers with them, with no orphaned images.
   await page.evaluate(()=>{const r=window.guildDebug.renderer();r.state.village.lots={...r.state.village.lots,h0:{x:-1,y:22,rot:1}};r.syncVillage();});await page.waitForTimeout(300);
   const moved=await page.evaluate(()=>{const r=window.guildDebug.renderer(),entry=[...r.villageProps.values()].find(v=>v.key==='h0'),source=entry.images[0],light=r.buildingLights.get(source);return{flipped:source.flipX,lightFlipped:light.panes.flipX,x:source.x,lightX:light.panes.x,pad:light.pad,orphans:[...r.buildingLights.keys()].filter(s=>!s.active).length};});
   assert.equal(moved.flipped,true);assert.equal(moved.lightFlipped,true);assert.equal(moved.lightX,moved.x-moved.pad);assert.equal(moved.orphans,0);
   const count=await page.evaluate(()=>window.guildDebug.renderer().scene.children.list.filter(o=>String(o.texture?.key).startsWith('night-')).length);
   for(const clock of [239.99,0,55,120,210]){await page.evaluate(t=>window.guildDebug.renderer().state.clock=t,clock);await page.waitForTimeout(80);}
   assert.equal(await page.evaluate(()=>window.guildDebug.renderer().scene.children.list.filter(o=>String(o.texture?.key).startsWith('night-')).length),count,'day/night changes reuse their layers');
   await page.evaluate(()=>window.guildDebug.renderer().state.clock=120);await page.waitForTimeout(100);assert.equal((await measure()).visible,0,'all lights turn off again');
   assert.deepEqual(errors,[]);report.push({mode,day,night,ratio:night.lum/day.lum});console.log(mode+' night lighting passed');
  }finally{await browser.close();}
 }
 await writeFile('artifacts/night-lighting-report.json',JSON.stringify(report,null,2));
}finally{server.kill();}
