const R=new URL('../../',import.meta.url).pathname.replace(/\/$/,'');
const G=await import(R+'/src/game.js');
const fs=await import('node:fs');
const s=G.deserializeGame(fs.readFileSync('work/save.json','utf8'));
s.gold+=50000;s.wood+=500;s.stone+=500;
console.log('rooms',JSON.stringify(s.rooms),'grid',JSON.stringify(s.grid));
while(s.building.level<3){const r=G.act(s,'expandBuilding');console.log('expand',r.ok,r.message||r.reason);if(!r.ok)break;}
const b=s.building;console.log('building',JSON.stringify(b));
// park everything outside the plan, then place in zone order
const keep=s.facilities.filter(f=>f.type!=='garden');s.facilities=s.facilities.filter(f=>f.type==='garden');
const X=b.x,Y=b.y,W=b.width,H=b.height;
const want=[ // type, anchor (fraction of building), rotations
 ['reception',.5,.78,[0]],['board',.30,.80,[0,1]],['dispatch',.70,.80,[0,3]],
 ['bar',.08,.06,[0,1]],['kitchen',.03,.03,[1,0]],['dining',.22,.30,[0]],['dining',.08,.34,[0]],['dining',.30,.10,[0]],['dining',.22,.45,[0]],
 ['library',.80,.04,[0]],['library',.95,.04,[3,0]],['lounge',.82,.26,[0]],['appraisal',.62,.06,[0]],['workshop',.60,.36,[0,2]],
 ['training',.92,.55,[3]],['training',.92,.68,[3]],['training',.80,.62,[3,0]],
 ['infirmary',.03,.60,[1]],['infirmary',.03,.72,[1]],['infirmary',.03,.84,[1]],
];
const pool=[...keep];let next=1000;
const placed=[];
for(const [type,fx,fy,rots] of want){
 let f=pool.findIndex(p=>p.type===type);let fac=f>=0?pool.splice(f,1)[0]:{id:'room-'+(next++),type,level:1,x:0,y:0,rotation:0};
 const ax=X+fx*W,ay=Y+fy*H;let best=null;
 const cands=[];for(let x=X;x<X+W;x+=.25)for(let y=Y;y<Y+H;y+=.25)cands.push([x,y,Math.hypot(x-ax,y-ay)]);cands.sort((a,b)=>a[2]-b[2]);
 for(const [x,y] of cands){for(const r of rots){if(G.canPlaceFacility(s,type,x,y,fac.id,r).ok){best={x,y,r};break;}}if(best)break;}
 if(!best){console.log('NO SPOT',type);continue;}
 Object.assign(fac,{x:best.x,y:best.y,rotation:best.r});s.facilities.push(fac);placed.push(`${type}@${best.x},${best.y}r${best.r}`);
}
console.log(placed.join(' '));console.log('leftover',pool.map(p=>p.type).join(','));
for(const m of s.members){if(m.facilityId&&!s.facilities.some(f=>f.id===m.facilityId))m.facilityId=null;}
fs.writeFileSync('work/save2.json',G.serializeGame(s));G.deserializeGame(fs.readFileSync('work/save2.json','utf8'));console.log('ok');
