import {open,shoot,ease,lerp} from './lib.mjs';
const {b,p}=await open('assets/save-day.json');
const warm=async ms=>p.evaluate(ms=>{window.__vt.manual();window.__vt.step(ms,Math.ceil(ms/50));},ms);
const fight=async used=>p.evaluate(used=>{const s=window.guildDebug.getState(),M=Object.fromEntries((s.world.monsters||[]).filter(m=>!m.dead).map(m=>[m.id,m]));
 const H=(s.world.hunters||[]).filter(h=>h.mode==='hunt'&&!h.mission&&!used.includes(h.zone)&&h.target&&M[h.target]&&Math.hypot(M[h.target].x-h.x,M[h.target].y-h.y)<2.2);
 const by={};for(const h of H){(by[h.zone]??=[]).push(h);}const z=Object.keys(by).sort((a,b)=>by[b].length-by[a].length)[0];if(!z)return null;
 const g=by[z],m=M[g[0].target];return {zone:z,n:g.length,cx:(g.reduce((a,h)=>a+h.x,0)/g.length+m.x)/2,cy:(g.reduce((a,h)=>a+h.y,0)/g.length+m.y)/2};},used);
await warm(4000);
const used=[];const names=['hunt1','hunt2','hunt3'];
for(const name of names){
 let c=null;for(let k=0;k<60&&!c;k++){c=await fight(used);if(!c)await warm(500);}
 console.log(name,JSON.stringify(c));if(!c)continue;used.push(c.zone);
 await p.evaluate(([x,y])=>{const r=window.guildDebug.renderer();r.focusGrid(x,y,2.4);r.setZoom?.(2.4);},[c.cx,c.cy]);await warm(400);
 const pull=name==='hunt3',frames=pull?135:84;
 await shoot(p,name,{frames,cam:t=>{if(!pull)return{x:c.cx+t*.4,y:c.cy-t*.2,z:2.4};const u=ease(Math.max(0,t-.4)/.6);return{x:lerp(c.cx,40,u),y:lerp(c.cy,0,u),z:lerp(2.4,.3,u)};}});
}
await b.close();
