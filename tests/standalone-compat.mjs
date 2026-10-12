import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const bytes=await readFile(root+'/play.html'),html=bytes.toString(),sha256=createHash('sha256').update(bytes).digest('hex');
const file='play-r7-'+sha256.slice(0,8)+'.html';
await copyFile(root+'/play.html',root+'/'+file);
assert.ok(!/<script[^>]+(?:src=|type="module")/.test(html),'Single file must contain only classic inline scripts');
assert.ok(!html.includes('const phaserBytes='),'Startup must not decompress or load a Blob script');
const report={file,sha256,bytes:bytes.length,classicInline:true,cases:[],actualAndroidDeviceTested:false};
for(const mode of ['restricted-canvas','webgl']){
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/root/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell',args:mode==='restricted-canvas'?['--disable-webgl']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1536,height:864},deviceScaleFactor:2,userAgent:'Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  if(mode==='restricted-canvas')await page.addInitScript(()=>{
   window.DecompressionStream=undefined;
   URL.createObjectURL=()=>{throw new Error('Blob URLs unavailable in compatibility test');};
   const create=document.createElement.bind(document);
   document.createElement=(name,...args)=>{if(name.toLowerCase()==='script')throw new Error('Dynamic script loading unavailable');return create(name,...args);};
  });
  await page.goto('file://'+root+'/'+file+'?still',{timeout:90000});await page.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready,null,{timeout:90000});
  await page.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready);
  await page.evaluate(()=>document.fonts.ready);
  // R11 opens on a title screen; start a new guild and skip the prologue.
  const enter=async()=>{if(await page.locator('#title-continue').isVisible())await page.locator('#title-continue').click();else{await page.locator('#title-new').click();await page.locator('#setup-master').fill('ทดสอบ');await page.locator('[data-setup="next"]').click();await page.locator('#setup-guild').fill('กิลด์ใบอ่อน');await page.locator('[data-setup="done"]').click();await page.locator('[data-story-skip]').click();}};
  await enter();
  assert.equal(await page.title(),'Guild Master · R50');
  assert.equal(await page.locator('#scene-status').isVisible(),false);
  const info=await page.evaluate(()=>window.guildDebug.getRendererInfo());
  assert.equal(info.renderer,mode==='restricted-canvas'?'Canvas':'WebGL');
  // Inspect actual scene pixels: a green background with furniture is a failure.
  const scenePixels=await page.evaluate(()=>{
   const canvas=document.getElementById('guild-world'),copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;const c=copy.getContext('2d');c.drawImage(canvas,0,0);
   const a=c.getImageData(0,0,copy.width,copy.height).data;let grassDetail=0,warm=0,blueRoof=0;
   for(let i=0;i<a.length;i+=4){const r=a[i],g=a[i+1],b=a[i+2];if(g>r&&g>b&&(r!==156||g!==172||b!==125))grassDetail++;if(r>g+8&&g>b+12)warm++;if(b>r+8&&b>=g&&r>65&&r<185)blueRoof++;}
   const sample=(x,y)=>{const p=window.guildDebug.getScenePoint(x,y),radius=12;let warm=0,total=0;for(let y=Math.round(p.y-radius);y<p.y+radius;y++)for(let x=Math.round(p.x-radius);x<p.x+radius;x++){if(x<0||y<0||x>=copy.width||y>=copy.height)continue;const i=(y*copy.width+x)*4;total++;if(a[i]>a[i+1]+5&&a[i+1]>a[i+2]+10)warm++;}return{warm,total};};
   return{grassDetail,warm,blueRoof,floor:sample(11.5,8.5),road:sample(9,13)};
  });
  assert.ok(scenePixels.grassDetail>100000,'Grass texture must cover the scene');
  assert.ok(scenePixels.warm>30000,'Floor, walls and roads must render, beyond isolated furniture');
  assert.ok(scenePixels.blueRoof>500,'Village cottage roofs must render');
  assert.ok(scenePixels.floor.warm/scenePixels.floor.total>.7,'An empty floor sample must contain planks');
  assert.ok(scenePixels.road.warm/scenePixels.road.total>.7,'Road sample must contain stone paving');
  await page.screenshot({path:root+'/docs/images/r7-'+mode+'.png'});
  await page.locator('[data-dock="build"]').click();await page.locator('[data-build-tab="rooms"]').click();
  await page.locator('#room-width').fill('3');await page.locator('#room-height').fill('3');await page.locator('[data-room-type="dorm"]').click();
  const p=await page.evaluate(()=>window.guildDebug.getScenePoint(11.5,5.5));await page.mouse.click(p.x,p.y);await page.locator('[data-confirm-placement]').click();
  assert.equal((await page.evaluate(()=>window.guildDebug.getState())).rooms.length,1);
  await page.reload({timeout:90000});await page.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready,null,{timeout:90000});await enter();assert.equal((await page.evaluate(()=>window.guildDebug.getState())).rooms.length,1);
  if(mode==='restricted-canvas'){
   await page.setViewportSize({width:390,height:844});await page.locator('#home-view').click();await page.screenshot({path:root+'/docs/images/r7-mobile.png'});
   const box=await page.locator('#guild-world').boundingBox();assert.equal(box.width,390);assert.equal(box.height,844);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  report.cases.push({mode,renderer:info.renderer,scenePixels,roomPlacement:true,saveReload:true,externalRequests:0,errors});
  if(mode==='restricted-canvas'){
   const failure=await browser.newPage({viewport:{width:390,height:844}});
   await failure.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='2d')throw new Error('SIMULATED: Canvas unavailable');return get.call(this,type,...args);};});
   await failure.goto('file://'+root+'/'+file);await failure.locator('#scene-status small').waitFor();
   assert.ok((await failure.locator('#scene-status').innerText()).includes('Canvas unavailable'));
   assert.equal(await failure.locator('#scene-status button').isVisible(),true);
   await failure.screenshot({path:root+'/docs/images/r7-boot-error.png'});await failure.close();report.visibleFailure=true;
  }
 }finally{await browser.close();}
}
await writeFile(root+'/docs/r7-compat-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
