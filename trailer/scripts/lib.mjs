const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/opt/node22/lib/node_modules/playwright/index.mjs');
const ROOT=new URL('../../',import.meta.url).pathname;
import {readFileSync,mkdirSync} from 'node:fs';
export async function open(saveFile,{w=1280,h=720}={}){
 const save=readFileSync(saveFile,'utf8');
 const b=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const p=await b.newPage({viewport:{width:w,height:h}});p.setDefaultTimeout(240000);
 p.on('pageerror',e=>console.log('ERR',e.message));
 await p.addInitScript(()=>{
  const rAF=window.requestAnimationFrame.bind(window),pnow=performance.now.bind(performance),dnow=Date.now;
  let manual=false,vt=pnow(),last=pnow(),q=[],id=0;
  const flush=()=>{const list=q;q=[];for(const [i,cb] of list){try{cb(vt)}catch(e){console.error(e)}}};
  performance.now=()=>vt;const d0=dnow()-vt;Date.now=()=>Math.floor(d0+vt);
  window.requestAnimationFrame=cb=>{q.push([++id,cb]);return id;};
  window.cancelAnimationFrame=i=>{q=q.filter(x=>x[0]!==i)};
  const pump=()=>{if(!manual){const n=pnow();vt+=n-last;last=n;flush();}rAF(pump)};rAF(pump);
  window.__vt={manual:()=>{manual=true},auto:()=>{manual=false;last=pnow()},step:(ms,sub=1)=>{for(let k=0;k<sub;k++){vt+=ms/sub;flush();}}};
 });
 await p.addInitScript(s=>{try{if(!sessionStorage.getItem('x')){localStorage.clear();localStorage.setItem('little-leaf-guild:v1',s);localStorage.setItem('little-leaf-guild:v1:seen',String(Date.now()));localStorage.setItem('guild-master:coach','{"home":1,"build":1,"village":1,"quests":1,"members":1,"goals":1}');sessionStorage.setItem('x',1);}}catch(e){}},save);
 await p.goto('file://'+ROOT+'play.html',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>window.guildDebug?.getRendererInfo()?.ready);
 await p.click('#title-continue');await p.waitForTimeout(800);
 for(let i=0;i<3;i++){await p.keyboard.press('Escape');await p.waitForTimeout(200);}
 await p.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.body.classList.add('scene-only');const st=document.createElement('style');st.textContent='#restore-ui,.toasts,#scene-status{display:none!important}';document.head.appendChild(st);window.dispatchEvent(new Event('resize'));});
 return {b,p};
}
// cam(t) -> {x,y,z} in grid coords for t in [0,1]
export async function shoot(p,name,{frames,fps=30,cam,each}){
 await p.evaluate(()=>window.__vt.manual());
 mkdirSync('work/f/'+name,{recursive:true});
 for(let i=0;i<frames;i++){const t=i/(frames-1||1);const c=cam(t);
  await p.evaluate(c=>{const r=window.guildDebug.renderer();r.focusGrid(c.x,c.y,c.z);r.setZoom?.(c.z);},c);
  if(each)await each(i,t);
  await p.evaluate(ms=>window.__vt.step(ms),1000/fps);
  await p.screenshot({path:`work/f/${name}/${String(i).padStart(4,'0')}.jpg`,type:'jpeg',quality:90});
 }
}
export const ease=t=>t<.5?2*t*t:1-(-2*t+2)**2/2;
export const lerp=(a,b,t)=>a+(b-a)*t;
