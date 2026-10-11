import assert from 'node:assert/strict';
import {createGame,serializeGame} from '../src/game.js';
import {VILLAGE_LOTS} from '../src/content.js';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 for(const mobile of [false,true]){
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:960},isMobile:mobile,hasTouch:mobile});
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  const state=createGame(99);state.policy.memberHunting=false;state.policy.autoPetitions=false;
  state.village.lots={h1:{x:8,y:21.5,rot:1}};
  await page.addInitScript(save=>localStorage.setItem('little-leaf-guild:v1',save),serializeGame(state));
  await page.goto(process.env.GUILD_SMOKE_URL||'http://localhost:5173/play.html?still');
  console.log('loaded',mobile);await page.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready,{},{timeout:60000});console.log('ready');
  await page.locator('#title-continue').click();await page.locator('#pause-button').click();console.log('entered');
  async function tap(x,y){const p=await page.evaluate(({x,y})=>{window.guildDebug.focusGrid(x,y,2);return window.guildDebug.getScenePoint(x,y);},{x,y});if(mobile)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);}
  for(let i=0;i<3;i++){
   const b=VILLAGE_LOTS.houses[i];console.log('tapping',i);await tap(b.x+1,b.y+1);
   await page.locator(`[data-village-detail="h${i}"]`).waitFor();assert.match(await page.locator('#panel-content').innerText(),new RegExp('บ้านหลังที่ '+(i+1)));
   await page.locator('[data-back]').click();assert.equal(await page.locator('[data-village-detail]').count(),0);await page.locator('#menu-close').click();
  }
  await tap(-2+1,21.5+1);await page.locator('[data-village-detail="h0"]').waitFor();
  await mkdir('/tmp/guild-evidence',{recursive:true});await page.screenshot({path:`/tmp/guild-evidence/${mobile?'mobile':'desktop'}.png`});
  await page.locator('[data-move-building="h0"]').click();assert.equal(await page.locator('#build-hint').isVisible(),true);
  await page.locator('[data-cancel-build]').click();assert.equal(await page.locator('#build-hint').isVisible(),false);
  for(const [key,x,y] of [['inn',-2.5,9],['bakery',24,14]]){await tap(x,y);await page.locator(`[data-village-detail="${key}"]`).waitFor();await page.locator('#menu-close').click();}
  assert.deepEqual(errors,[]);await page.close();console.log(`${mobile?'mobile touch':'desktop mouse'}: houses, mirrored roof, back, move/cancel and cottages passed`);
 }
}finally{await browser.close();}
