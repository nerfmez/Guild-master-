const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:'5193'},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error('Preview server exited: '+code)));});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/root/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}});const capture=options=>process.argv.includes('--verify-only')?Promise.resolve():page.screenshot(options);const errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.log('ERROR',e.message)});page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});
 await page.goto('http://127.0.0.1:5193/play.html?still');
 await page.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready,{timeout:25000});await page.evaluate(()=>document.fonts.ready);
 console.log(await page.evaluate(()=>window.guildDebug.getRendererInfo()));
 await capture({path:root+'/docs/images/desktop-game.png'});
 await page.locator('#menu-button').click();await capture({path:root+'/docs/images/menu-game.png'});
 await page.locator('.bottom-nav [data-tab="members"]').click();await capture({path:root+'/docs/images/members-game.png'});
 await page.locator('#menu-close').click();await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
 console.log('mobile metrics',await page.evaluate(()=>window.guildDebug.getRendererInfo()));await capture({path:root+'/docs/images/mobile-game.png'});await page.locator('#menu-button').click();await capture({path:root+'/docs/images/mobile-menu.png'});
 
 await page.locator('#menu-close').click();await page.setViewportSize({width:844,height:390});await page.waitForTimeout(250);await capture({path:root+'/docs/images/landscape-game.png'});
 const landscape=await page.evaluate(()=>window.guildDebug.getRendererInfo());
 // Hit testing must follow the projected floor after resize, pan and zoom.
 await page.setViewportSize({width:1440,height:960});await page.locator('#home-view').click();
 const pick=async f=>{const p=await page.evaluate(f=>{const sizes={reception:[2,1,17],dorm:[1,2,13],infirmary:[1,2,13],kitchen:[1,1,15],training:[1,1,25],workshop:[2,1,18]},[w,h,z]=sizes[f.type];const p=window.guildDebug.getScenePoint(f.x+(f.rotation%2?h:w)*.5,f.y+(f.rotation%2?w:h)*.5);p.y-=z*window.guildDebug.getRendererInfo().zoom;return p;},f);await page.mouse.click(p.x,p.y);await page.locator(`[data-upgrade="${f.id}"]`).waitFor({state:'visible',timeout:5000});};
 const facilities=await page.evaluate(()=>window.guildDebug.getState().facilities);
 for(const f of facilities){await pick(f);await page.locator('#menu-close').click();}
 await page.mouse.move(180,190);await page.mouse.down();await page.mouse.move(260,150,{steps:4});await page.mouse.up();await page.locator('#zoom-in').click();
 await pick(facilities[0]);await page.locator('#menu-close').click();
 await page.setViewportSize({width:390,height:844});await page.locator('#home-view').click();await pick(facilities[1]);await page.locator('[data-move="room-2"]').click();
 await page.locator('[data-rotate-placement]').click();const move=await page.evaluate(()=>window.guildDebug.getScenePoint(8.25,4.75));await page.mouse.move(move.x,move.y);await capture({path:root+'/docs/images/mobile-build.png'});await page.mouse.click(move.x,move.y);
 await page.waitForFunction(()=>window.guildDebug.getState().facilities.find(f=>f.id==='room-2').x===8.25&&window.guildDebug.getState().facilities.find(f=>f.id==='room-2').rotation===1);
 await page.setViewportSize({width:1440,height:960});await page.locator('#home-view').click();await page.locator('#menu-button').click();await page.locator('.bottom-nav [data-tab="build"]').click();await page.locator('[data-expand-building]').click();await page.locator('#confirm-ok').click();await page.waitForFunction(()=>window.guildDebug.getState().building.level===1);await page.locator('#menu-close').click();await capture({path:root+'/docs/images/expanded-game.png'});
 const sceneErrors=[...errors];if(sceneErrors.length)throw new Error(sceneErrors.join('\n'));await page.close();
 const offline=await browser.newPage({viewport:{width:1440,height:960}});const offlineRequests=[],offlineErrors=[];offline.on('request',r=>offlineRequests.push(r.url()));offline.on('pageerror',e=>offlineErrors.push(e.message));
 await offline.goto('file://'+root+'/play.html?still');await offline.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready);await offline.evaluate(()=>document.fonts.ready);
 const offlineInfo=await offline.evaluate(()=>window.guildDebug.getRendererInfo());
 const bounds=await offline.locator('#guild-world').boundingBox();if(bounds.x!==0||bounds.y!==0||bounds.width!==1440||bounds.height!==960)throw new Error('Scene does not fill the viewport');
 if(await offline.locator('#management-dialog').evaluate(e=>e.open))throw new Error('Menu was open on entry');
 const zoom=offlineInfo.zoom;await offline.locator('#zoom-in').click();if((await offline.evaluate(()=>window.guildDebug.getRendererInfo())).zoom<=zoom)throw new Error('Zoom control failed');
 if(offlineErrors.length||offlineRequests.some(u=>/^https?:/.test(u)))throw new Error('Offline file uses the network or has script errors');
 console.log('errors',errors,'offlineErrors',offlineErrors);await writeFile(root+'/docs/standalone-check.json',JSON.stringify({...JSON.parse(await readFile(root+'/docs/standalone-check.json','utf8')),standalone:true,engine:'Phaser',version:'3.90.0',renderer:'WebGL',externalRequests:0,desktopViewport:[1440,960],phoneViewport:[390,844],landscapeViewport:[844,390],offlineFileOpened:true,initialMenuClosed:true,fullViewport:true,zoom:true,projection:'isometric 2:1',roomSelections:6,selectionAfterPanZoom:true,mobileMove:true,mobileRotate:true,buildingExpansion:true,errors:[...errors,...offlineErrors],landscape},null,2));
 
}finally{await browser.close();server.kill();}
