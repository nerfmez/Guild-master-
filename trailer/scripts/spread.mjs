const R=new URL('../../',import.meta.url).pathname.replace(/\/$/,'');
const G=await import(R+'/src/game.js');const C=await import(R+'/src/content.js');
const fs=await import('node:fs');
const s=G.deserializeGame(fs.readFileSync('work/save2.json','utf8'));const w=s.world;
const mission=w.hunters.filter(h=>h.mission),free=w.hunters.filter(h=>!h.mission&&h.kind==='member');
const others=w.hunters.filter(h=>!h.mission&&h.kind!=='member');
console.log('mission',mission.length,'members',free.length,'others',others.length,others.map(o=>o.zone+':'+o.mode).join(','));
const plan=[['meadow',2],['woods',3],['hills',3],['mist',2],['canyon',3],['peak',2]];
const out=[];let i=0;
for(const [zone,n] of plan){const z=C.HUNT_ZONES[zone];const party='pt-tr-'+zone;
 for(let k=0;k<n&&i<free.length;k++,i++){const h=free[i];const a=k*2.1+zone.length,r=1.2+k*.6;
  Object.assign(h,{zone,party,mode:'hunt',path:[],target:null,x:z.x+Math.cos(a)*r,y:z.y+Math.sin(a)*r*.7,wander:{x:z.x,y:z.y},hp:h.maxHp,bag:{...h.bag,kills:0},quota:12});out.push(h);}}
w.hunters=[...mission,...out,...others.filter(o=>o.mode!=='hunt'||Math.random()<.3)];
w.departClock=600;
console.log('hunters now',w.hunters.length,JSON.stringify(Object.fromEntries(plan.map(([z])=>[z,w.hunters.filter(h=>h.zone===z).length]))));
fs.writeFileSync('assets/save-day.json',G.serializeGame(s));G.deserializeGame(fs.readFileSync('assets/save-day.json','utf8'));
