import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createGame,serializeGame,normalizeProfile,getGoals} from '../src/game.js';
import {saveSlotKeys} from '../src/save-slots.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const legacy=createGame(73);legacy.profile=normalizeProfile({masterName:'อาริน',guildName:'กิลด์เดิม',hairStyle:'long'});legacy.gold=1337;legacy.completedQuests.patrol=1;legacy.heroCall={step:'done',skipped:true};legacy.hero.classChosen=true;legacy.hero.cls='mage';
const lessons=Object.fromEntries(getGoals(legacy).list.map(g=>[g.id,true]));
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:'5208'},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox','--disable-webgl']});
try{
 for(const [mode,width,height] of [['portrait',390,844],['landscape',844,390],['standalone',390,844]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({save,lessons})=>{if(!localStorage.getItem('save-smoke-seeded')){localStorage.setItem('little-leaf-guild:v1',save);localStorage.setItem('little-leaf-guild:v1:seen',String(Date.now()));localStorage.setItem('guild-master:lessons',JSON.stringify(lessons));localStorage.setItem('save-smoke-seeded','1');}},{save:serializeGame(legacy),lessons});
  if(mode==='standalone')await page.route(/^https?:/,r=>r.request().isNavigationRequest()?r.continue():r.abort());
  await page.goto('http://localhost:5208/'+(mode==='standalone'?'play.html':'index.html'),{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready,null,{timeout:60000});
  const stored=async slot=>page.evaluate(k=>localStorage.getItem(k),saveSlotKeys(slot).save);
  const state=()=>page.evaluate(()=>window.guildDebug.getState());
  const old=await stored(1);assert.match(await page.locator('[data-save-slot="1"]').textContent(),/กิลด์เดิม/);assert.equal(await stored(2),null);
  await page.locator('[data-save-slot="2"]').click();await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await stored(1),old);assert.equal(await stored(2),null);
  const create=async(slot,outfit,hair)=>{
   await page.locator(`[data-save-slot="${slot}"]`).click();await page.locator('#title-new').click();await page.locator('#setup-master').fill('หัวหน้า '+slot);
   if(slot===2){
    const outfitImages=[];for(const v of ['tunic','coat','robe','armor','cape']){await page.locator(`[data-look="outfitStyle"][data-value="${v}"]`).click();outfitImages.push(await page.locator('#setup-preview').evaluate(c=>c.toDataURL()));}assert.equal(new Set(outfitImages).size,5);
    const hairImages=[];for(const v of ['short','long','bob','ponytail','bun','spiky']){await page.locator(`[data-look="hairStyle"][data-value="${v}"]`).click();hairImages.push(await page.locator('#setup-preview').evaluate(c=>c.toDataURL()));}assert.equal(new Set(hairImages).size,6);
   }
   await page.locator(`[data-look="outfitStyle"][data-value="${outfit}"]`).click();await page.locator(`[data-look="hairStyle"][data-value="${hair}"]`).click();
   if(mode==='portrait'&&slot===2)await page.screenshot({path:'docs/images/master-looks-setup.png',animations:'disabled'});
   await page.locator('[data-setup="next"]').click();await page.locator('#setup-guild').fill('กิลด์ช่อง '+slot);await page.locator('[data-setup="prev"]').click();assert.equal(await page.locator(`[data-look="outfitStyle"][data-value="${outfit}"]`).getAttribute('aria-pressed'),'true');await page.locator('[data-setup="next"]').click();await page.locator('[data-setup="done"]').click();
   assert.equal((await state()).profile.outfitStyle,outfit);assert.equal((await state()).profile.hairStyle,hair);assert.match(await stored(slot),new RegExp('กิลด์ช่อง '+slot));await page.locator('[data-story-skip]').click();await page.locator('#pause-button').click();
  };
  const settings=async()=>{if(!await page.locator('[data-guild-settings]').isVisible()){if(!await page.locator('[data-dock="home"]').isVisible())await page.locator('#dock-toggle').click();await page.locator('[data-dock="home"]').click();}await page.locator('[data-guild-settings]').click();};
  const slots=async()=>{await settings();await page.locator('[data-save-slots]').click();};
  await create(2,'coat','ponytail');assert.equal(await stored(1),old);await slots();await create(3,'armor','spiky');assert.equal(await stored(1),old);await slots();
  if(mode==='portrait')await page.screenshot({path:'docs/images/three-save-slots.png',animations:'disabled'});
  await page.locator('[data-save-slot="1"]').click();await page.locator('#title-new').click();assert.match(await page.locator('#confirm-title').textContent(),/ช่อง 1/);await page.locator('#confirm-cancel').click();assert.equal(await stored(1),old);
  await page.locator('#title-continue').click();assert.equal((await state()).profile.guildName,'กิลด์เดิม');assert.equal((await state()).gold,1337);await page.locator('#pause-button').click();
  await page.locator('#hero-toggle').click();await page.waitForFunction(()=>window.guildDebug.getState().hero.active);
  const texture=()=>page.evaluate(()=>window.guildDebug.renderer().scene.textures.get('actor-master-mage-south-idle').getSourceImage().toDataURL());
  await page.waitForFunction(()=>window.guildDebug.renderer().scene.textures.exists('actor-master-mage-south-idle'));const before=await texture();
  await page.locator('#hero-exit').click();if(!await page.locator('[data-dock="home"]').isVisible())await page.locator('#dock-toggle').click();await page.locator('[data-dock="home"]').click();await page.locator('[data-edit-profile]').click();await page.locator('[data-look="outfitStyle"][data-value="cape"]').click();await page.locator('[data-look="hairStyle"][data-value="bun"]').click();await page.locator('[data-setup="next"]').click();await page.locator('[data-setup="done"]').click();await page.locator('#hero-toggle').click();await page.waitForFunction(()=>window.guildDebug.renderer().heroLook.includes('cape'));assert.notEqual(await texture(),before);await page.locator('#hero-exit').click();
  await slots();await page.locator('[data-save-slot="2"]').click();await page.locator('#title-continue').click();assert.equal((await state()).profile.outfitStyle,'coat');assert.equal((await state()).profile.hairStyle,'ponytail');
  await page.locator('#notifications-button').click();assert.doesNotMatch(await page.locator('#notification-news').textContent(),/กิลด์เดิม/);await page.locator('#notifications-close').click();
  const protectedOne=await stored(1),protectedThree=await stored(3);await settings();const download=page.waitForEvent('download');await page.locator('[data-export-save]').click();assert.match((await download).suggestedFilename(),/slot-2/);
  const imported=createGame(9,{opening:true,profile:{masterName:'นำเข้า',guildName:'กิลด์นำเข้า',outfitStyle:'robe',hairStyle:'bob'}});
  await page.locator('#import-file').setInputFiles({name:'import.json',mimeType:'application/json',buffer:Buffer.from(serializeGame(imported))});await page.locator('#confirm-ok').click();assert.equal((await state()).profile.guildName,'กิลด์นำเข้า');assert.equal(await stored(1),protectedOne);assert.equal(await stored(3),protectedThree);
  await slots();await page.locator('[data-save-slot="3"]').click();await page.locator('#title-new').click();await page.locator('#confirm-ok').click();await page.locator('[data-setup="back"]').click();assert.equal(await stored(3),protectedThree);
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready,null,{timeout:60000});assert.equal(await page.locator('[data-save-slot="2"]').getAttribute('aria-pressed'),'true');assert.equal(await stored(3),protectedThree);
  await page.evaluate(k=>localStorage.setItem(k,'broken-slot-three'),saveSlotKeys(3).save);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready,null,{timeout:60000});await page.locator('[data-save-slot="3"]').click();await page.locator('#title-continue').click();assert.equal((await state()).profile.outfitStyle,'armor');assert.equal((await state()).profile.hairStyle,'spiky');assert.equal(await page.evaluate(k=>localStorage.getItem(k),saveSlotKeys(3).corrupt),'broken-slot-three');
  assert.deepEqual(errors,[]);console.log(mode+': 3 independent slots, legacy/cancel/import/backup safety, 5 outfits, 6 hair styles and Hero refresh passed');await page.close();
 }
}finally{await browser.close();server.kill('SIGTERM');}
