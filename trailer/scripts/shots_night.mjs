import {open,shoot,ease,lerp} from './lib.mjs';
const {b,p}=await open('assets/save-night.json');
const warm=async ms=>p.evaluate(ms=>{window.__vt.manual();window.__vt.step(ms,Math.ceil(ms/50));},ms);
await p.evaluate(()=>{const r=window.guildDebug.renderer();r.focusGrid(-15,24,1.4);r.setZoom?.(1.4);});
await warm(72500);
console.log(await p.evaluate(()=>{const s=window.guildDebug.getState();return {clock:s.clock,live:!!s.festivals.live,open:s.festivals.live&&s.elapsed>=s.festivals.live.open,sky:(window.guildDebug.renderer().skyLanterns||[]).length};}));
await shoot(p,'night',{frames:190,cam:t=>{const u=ease(t);return{x:lerp(-17,-12,u),y:lerp(24.5,19,u),z:lerp(1.5,1.0,u)};}});
await b.close();
