import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {writeFile,readFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const bytes=await readFile(root+'/play.html'),sha256=createHash('sha256').update(bytes).digest('hex'),file='play-rooms-'+sha256.slice(0,8)+'.html';
await copyFile(root+'/play.html',root+'/'+file);
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/root/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto('file://'+root+'/'+file+'?still');await page.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready);await page.evaluate(()=>document.fonts.ready);
 const state=()=>page.evaluate(()=>window.guildDebug.getState());
 const nav=async()=>{if(!await page.locator('#management-dialog').evaluate(e=>e.open))await page.locator('#menu-button').click();await page.locator('.bottom-nav [data-tab="build"]').click();};
 const scene=async(x,y)=>{const p=await page.evaluate(({x,y})=>window.guildDebug.getScenePoint(x,y),{x,y});await page.mouse.click(p.x,p.y);};
 assert.equal((await state()).rooms.length,0);await page.screenshot({path:root+'/docs/images/empty-floor.png'});
 await nav();await page.screenshot({path:root+'/docs/images/room-menu.png'});await page.locator('#room-width').fill('3');await page.locator('#room-height').fill('3');await page.locator('[data-room-type="dorm"]').click();
 await scene(10,4);assert.equal((await state()).rooms.length,1);const id=(await state()).rooms[0].id;
 await page.screenshot({path:root+'/docs/images/room-layout.png'});
 await scene(11.5,6.75);await page.locator(`[data-rotate-room="${id}"]`).waitFor({state:'visible'});await page.locator(`[data-rotate-room="${id}"]`).click();assert.equal((await state()).facilities.find(f=>f.id==='room-2').rotation,1);
 await nav();await page.locator('[data-expand-building]').click();await page.locator('#confirm-ok').click();assert.equal((await state()).building.level,1);assert.equal(await page.locator('[data-expand-building]').isDisabled(),true,'Step two requires E');
 await page.locator(`[data-partition="${id}"]`).click();await page.locator(`[data-move-room="${id}"]`).click();await scene(11.75,5.5);assert.equal((await state()).rooms[0].x,11.75);assert.equal((await state()).facilities.find(f=>f.id==='room-2').x,12.25);
 await page.screenshot({path:root+'/docs/images/rooms-expanded.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('#home-view').click();await nav();await page.locator('#room-width').fill('3');await page.locator('#room-height').fill('2');await page.locator('[data-room-type="hall"]').click();await page.locator('[data-rotate-placement]').click();const p=await page.evaluate(()=>window.guildDebug.getScenePoint(5.5,8.75));await page.mouse.move(p.x,p.y);await page.screenshot({path:root+'/docs/images/mobile-room-build.png'});await page.mouse.click(p.x,p.y);assert.equal((await state()).rooms.length,2);assert.equal((await state()).rooms[1].rotation,1);
 await page.screenshot({path:root+'/docs/images/mobile-rooms.png'});await page.locator('#pause-button').click();await page.reload();await page.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready);assert.equal((await state()).rooms.length,2,'Rooms survive save/reload');
 assert.equal(requests.filter(u=>/^https?:/.test(u)).length,0);assert.deepEqual(errors,[]);
 const report={file,sha256,bytes:bytes.length,emptyStart:true,customRoomSize:true,roomRotationCarriesFurniture:true,roomMovementCarriesFurniture:true,stagedExtension:true,rankGate:true,mobileRoomPlacement:true,mobileRoomRotation:true,saveReload:true,offline:true,externalRequests:0,errors};await writeFile(root+'/docs/rooms-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
