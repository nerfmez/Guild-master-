const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:'5193'},stdio:'ignore'});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/root/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}});const errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.log('ERROR',e.message)});page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});
 await page.goto('http://127.0.0.1:5193/play.html?still');
 await page.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready,{timeout:25000});await page.evaluate(()=>document.fonts.ready);
 console.log(await page.evaluate(()=>window.guildDebug.getRendererInfo()));
 await page.screenshot({path:root+'/docs/images/desktop-game.png'});
 await page.locator('#menu-button').click();await page.screenshot({path:root+'/docs/images/menu-game.png'});
 await page.locator('.bottom-nav [data-tab="members"]').click();await page.screenshot({path:root+'/docs/images/members-game.png'});
 await page.locator('#menu-close').click();await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
 console.log('mobile metrics',await page.evaluate(()=>window.guildDebug.getRendererInfo()));await page.screenshot({path:root+'/docs/images/mobile-game.png'});await page.locator('#menu-button').click();await page.screenshot({path:root+'/docs/images/mobile-menu.png'});
 
 await page.locator('#menu-close').click();await page.setViewportSize({width:844,height:390});await page.waitForTimeout(250);await page.screenshot({path:root+'/docs/images/landscape-game.png'});
 const landscape=await page.evaluate(()=>window.guildDebug.getRendererInfo());const sceneErrors=[...errors];await page.close();
 const offline=await browser.newPage({viewport:{width:1440,height:960}});const offlineRequests=[],offlineErrors=[];offline.on('request',r=>offlineRequests.push(r.url()));offline.on('pageerror',e=>offlineErrors.push(e.message));
 await offline.goto('file://'+root+'/play.html?still');await offline.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready);await offline.evaluate(()=>document.fonts.ready);
 const offlineInfo=await offline.evaluate(()=>window.guildDebug.getRendererInfo());
 const bounds=await offline.locator('#guild-world').boundingBox();if(bounds.x!==0||bounds.y!==0||bounds.width!==1440||bounds.height!==960)throw new Error('Scene does not fill the viewport');
 if(await offline.locator('#management-dialog').evaluate(e=>e.open))throw new Error('Menu was open on entry');
 const zoom=offlineInfo.zoom;await offline.locator('#zoom-in').click();if((await offline.evaluate(()=>window.guildDebug.getRendererInfo())).zoom<=zoom)throw new Error('Zoom control failed');
 if(offlineErrors.length||offlineRequests.some(u=>/^https?:/.test(u)))throw new Error('Offline file uses the network or has script errors');
 console.log('errors',errors,'offlineErrors',offlineErrors);await writeFile(root+'/docs/standalone-check.json',JSON.stringify({standalone:true,engine:'Phaser',version:'3.90.0',renderer:'WebGL',externalRequests:0,desktopViewport:[1440,960],phoneViewport:[390,844],landscapeViewport:[844,390],offlineFileOpened:true,initialMenuClosed:true,fullViewport:true,zoom:true,errors:[...errors,...offlineErrors],landscape},null,2));
 
}finally{await browser.close();server.kill();}
