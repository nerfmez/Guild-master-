const R=new URL('../../',import.meta.url).pathname.replace(/\/$/,'');
const G=await import(R+'/src/game.js');const fs=await import('node:fs');
const s=G.deserializeGame(fs.readFileSync('assets/save-day.json','utf8'));
s.gold+=5000;
s.village.stage=3;s.village.fairground=3;
// roll forward to evening
const need=(200-s.clock+240)%240;G.tick(s,need);
console.log('clock',s.clock,'lots',JSON.stringify(s.village.lots||s.village).slice(0,300));
const info=G.getFestivalInfo(s,'lantern');console.log('info',JSON.stringify(info).slice(0,300));
const r=G.act(s,'startFestival',{kind:'lantern',gold:Math.max(120,info.minGold||0)});console.log('start',r.ok,r.message);
console.log(JSON.stringify(s.festivals.live).slice(0,300),'elapsed',s.elapsed);
fs.writeFileSync('assets/save-night.json',G.serializeGame(s));
