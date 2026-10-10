import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const bytes=await readFile(root+'/play.html'),sha256=createHash('sha256').update(bytes).digest('hex'),file='play-android-fixed-'+sha256.slice(0,8)+'.html';
await copyFile(root+'/play.html',root+'/'+file);
const executablePath=process.env.BROWSER_EXECUTABLE||'/root/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell';
const report={file,sha256,bytes:bytes.length,cases:[]};
for(const mode of ['no-webgl','webgl-loss']){
 const browser=await chromium.launch({headless:true,executablePath,args:mode==='no-webgl'?['--disable-webgl']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1536,height:864}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.goto('file://'+root+'/'+file+'?still');
  await page.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready);
  await page.evaluate(()=>document.fonts.ready);
  const initial=await page.evaluate(()=>window.guildDebug.getRendererInfo());
  assert.equal(initial.renderer,mode==='no-webgl'?'Canvas':'WebGL');
  assert.equal(await page.locator('#scene-status').isVisible(),false);
  assert.ok(initial.drawnParts>20);
  if(mode==='webgl-loss'){
   await page.screenshot({path:root+'/docs/images/boot-webgl.png'});
   await page.locator('#pause-button').click();
   await page.waitForFunction(()=>window.guildDebug.getState().settings.paused);
   const before=await page.evaluate(()=>window.guildDebug.getState());
   await page.evaluate(()=>document.getElementById('guild-world').getContext('webgl').getExtension('WEBGL_lose_context').loseContext());
   await page.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready&&window.guildDebug.getRendererInfo().renderer==='Canvas');
   assert.deepEqual(await page.evaluate(()=>window.guildDebug.getState()),before,'GPU loss must preserve progress');
   assert.equal(await page.locator('#guild-world').count(),1);
  }
  await page.screenshot({path:root+'/docs/images/boot-'+mode+'.png'});
  const colors=await page.evaluate(()=>{const c=document.getElementById('guild-world'),a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let varied=0;for(let i=0;i<a.length;i+=400)if(a[i+3]&&a[i+1]>a[i]&&a[i+1]>a[i+2])varied++;return varied;});
  assert.ok(colors>100,'Fallback must render the meadow, not a blank canvas');
  await page.locator('#menu-button').click();await page.locator('.bottom-nav [data-tab="build"]').click();
  await page.locator('#room-width').fill('3');await page.locator('#room-height').fill('3');await page.locator('[data-room-type="dorm"]').click();
  const p=await page.evaluate(()=>window.guildDebug.getScenePoint(10,4));await page.mouse.click(p.x,p.y);
  assert.equal((await page.evaluate(()=>window.guildDebug.getState())).rooms.length,1);
  const z=(await page.evaluate(()=>window.guildDebug.getRendererInfo())).zoom;await page.locator('#zoom-in').click();assert.ok((await page.evaluate(()=>window.guildDebug.getRendererInfo())).zoom>z);
  await page.setViewportSize({width:390,height:844});await page.locator('#home-view').click();
  await page.screenshot({path:root+'/docs/images/boot-mobile-'+mode+'.png'});
  const bounds=await page.locator('#guild-world').boundingBox();assert.equal(bounds.width,390);assert.equal(bounds.height,844);
  await page.reload();await page.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready);assert.equal((await page.evaluate(()=>window.guildDebug.getState())).rooms.length,1);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  report.cases.push({mode,initialRenderer:initial.renderer,renderedScene:true,roomPlacement:true,zoom:true,mobile:true,saveReload:true,externalRequests:0,errors});
 }finally{await browser.close();}
}
await writeFile(root+'/docs/boot-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
