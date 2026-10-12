/* Original pixel artwork drawn at runtime. All world coordinates use 32px tiles. */
import { drawIllustratedIcon, drawIllustratedRegion } from './illustrated-art.js';
import { JOBS, MEMBERS, FACILITIES } from './content.js';
import { canPlaceFacility } from './game.js';
import { makeMonster, questFoe } from './monsters.js';
const TILE = 32;
const P = {
  ink: '#696259', deep: '#716861', shadow: '#a3a798', cream: '#fff1d5', paper: '#f8e8cb',
  wood: '#d8ad79', woodLight: '#edc996', woodDark: '#b58b64', coral: '#d98978', coralLight: '#efb299',
  sage: '#90b89c', mint: '#bddbc1', leaf: '#82b092', leafLight: '#aed0a3', leafDark: '#67917c',
  grass: '#c6d8b3', grassLight: '#cadab7', grassDark: '#b4cba4', stone: '#d9d3be', blue: '#94b7c5',
  lavender: '#b7aec9', skin: '#f7d4ae', sky: '#dfebd2', gold: '#e7bd74', white: '#fff8e7',
};

const ROOMS = {
  reception: { w: 4, h: 3, name: 'GUILD HALL', color: P.coral },
  dorm: { w: 4, h: 3, name: 'REST ROOM', color: P.blue },
  infirmary: { w: 3, h: 3, name: 'INFIRMARY', color: P.sage },
  kitchen: { w: 4, h: 3, name: 'KITCHEN', color: P.gold },
  training: { w: 4, h: 3, name: 'TRAINING', color: P.coral },
  workshop: { w: 3, h: 3, name: 'WORKSHOP', color: P.lavender },
  garden: { w: 3, h: 3, name: 'HERB GARDEN', color: P.sage },
  library: { w: 3, h: 3, name: 'LIBRARY', color: P.blue },
  shrine: { w: 3, h: 3, name: 'SHRINE', color: P.lavender },
  tavern: { w: 4, h: 3, name: 'COMMON ROOM', color: P.gold },
  lounge: { w: 4, h: 3, name: 'COMMON ROOM', color: P.coral },
  dispatch: { w: 3, h: 3, name: 'PLANNING', color: P.sage },
  storage: { w: 3, h: 3, name: 'STORAGE', color: P.woodDark },
};
for (const [type, room] of Object.entries(FACILITIES)) {
  if (ROOMS[type]) { ROOMS[type].w = room.w; ROOMS[type].h = room.h; }
}
const MEMBER_ART = Object.fromEntries(MEMBERS.map(member => [member.id, member]));

function hash(s) {
  s = String(s ?? 'guild'); let n = 2166136261;
  for (let i = 0; i < s.length; i++) n = Math.imul(n ^ s.charCodeAt(i), 16777619);
  return n >>> 0;
}
function rand(seed) { let a = seed >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }
function rect(c, x, y, w, h, color) { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function line(c, x, y, w, color) { rect(c, x, y, w, 1, color); }
function poly(c, points, color) { c.fillStyle = color; c.beginPath(); points.forEach(([x,y],i) => i ? c.lineTo(Math.round(x),Math.round(y)) : c.moveTo(Math.round(x),Math.round(y))); c.closePath(); c.fill(); }
function box(c, x, y, w, h, color, border = P.ink) { rect(c,x,y,w,h,border); rect(c,x+1,y+1,w-2,h-2,color); }
function shadow(c,x,y,w,h) { rect(c,x+2,y+3,w,h,'#ada78e'); }
function label(c, text, x, y, color = P.ink, size = 8) {
  c.fillStyle = color; c.font = `${size}px monospace`; c.textBaseline = 'top'; c.fillText(text, Math.round(x), Math.round(y));
}

function leafCluster(c,x,y,w,h,base,light) {
  const cut = Math.max(3, Math.floor(w/8));
  poly(c,[[x+cut,y],[x+w-cut,y],[x+w-cut,y+cut],[x+w,y+cut],[x+w,y+h-cut],[x+w-cut,y+h-cut],[x+w-cut,y+h],[x+cut,y+h],[x+cut,y+h-cut],[x,y+h-cut],[x,y+cut],[x+cut,y+cut]],base);
  rect(c,x+cut*2,y+2,w-cut*4,4,light); rect(c,x+3,y+cut+3,6,Math.max(3,h/3),light);
}
function flower(c,x,y,color=P.coralLight) {
  rect(c,x+2,y+4,1,4,P.leafDark); rect(c,x,y+1,5,3,color); rect(c,x+1,y,3,5,color); rect(c,x+2,y+2,1,1,P.gold);
}
function pot(c,x,y,kind='plant') {
  if (kind==='plant') { leafCluster(c,x-2,y-10,12,9,P.sage,P.mint); rect(c,x+3,y-4,2,8,P.leafDark); }
  else { flower(c,x,y-7,P.coralLight); flower(c,x+5,y-9,P.white); }
  poly(c,[[x,y],[x+10,y],[x+9,y+8],[x+2,y+8]],P.coral); line(c,x,y,10,P.coralLight); line(c,x+2,y+6,7,'#bf8271');
}
function tree(c,x,y) {
  // A small landmark beside the guild, leaving every interior room readable.
  rect(c,x+29,y+60,13,29,P.woodDark); rect(c,x+33,y+60,5,31,P.wood); rect(c,x+25,y+86,26,6,P.woodDark);
  poly(c,[[x+32,y+73],[x+17,y+53],[x+22,y+50],[x+36,y+64],[x+55,y+48],[x+58,y+53],[x+38,y+78]],P.woodDark);
  leafCluster(c,x+5,y+28,70,34,P.leafDark,P.leaf);
  leafCluster(c,x+15,y+5,55,45,P.leaf,P.leafLight);
  leafCluster(c,x-2,y+24,43,34,P.leaf,P.leafLight);
  leafCluster(c,x+40,y+21,40,35,P.leaf,P.leafLight);
  rect(c,x+26,y+10,17,4,P.mint); rect(c,x+57,y+28,12,3,P.leafLight);
  rect(c,x+13,y+36,3,3,P.gold); rect(c,x+62,y+42,3,3,P.gold);
  box(c,x+26,y+69,19,10,P.paper,P.woodDark); rect(c,x+29,y+72,13,1,P.woodDark); rect(c,x+33,y+75,6,1,P.woodDark);
}
function swordLeaf(c,x,y,scale=1) {
  c.save(); c.translate(x,y); c.scale(scale,scale);
  rect(c,7,3,3,14,P.cream); rect(c,8,3,1,13,P.white); rect(c,3,16,12,2,P.gold); rect(c,7,18,3,6,P.woodDark);
  poly(c,[[9,10],[12,6],[17,5],[17,8],[13,11]],P.mint); rect(c,10,10,6,1,P.sage);
  c.restore();
}
function banner(c,x,y) {
  rect(c,x-3,y-3,37,3,P.woodDark); rect(c,x,y,30,36,P.coral);
  poly(c,[[x,y+35],[x+15,y+29],[x+30,y+35],[x+30,y+40],[x+15,y+34],[x,y+40]],P.coral);
  rect(c,x+2,y+1,2,29,P.coralLight); swordLeaf(c,x+6,y+5);
}
function bed(c,x,y,medical=false) {
  shadow(c,x,y,23,39); box(c,x,y,23,39,P.woodDark); rect(c,x+2,y+3,19,32,P.white);
  box(c,x+4,y+5,15,8,P.cream,'#e2d4b9'); rect(c,x+2,y+15,19,18,medical?P.mint:P.blue);
  rect(c,x+3,y+16,17,3,medical?'#d2e8cf':'#b4d2d8'); line(c,x+4,y+28,15,medical?P.sage:'#80a5b2');
  rect(c,x,y+36,3,7,P.woodDark); rect(c,x+20,y+36,3,7,P.woodDark);
}
function chair(c,x,y,color=P.wood) {
  rect(c,x+1,y+7,2,11,P.woodDark); rect(c,x+12,y+7,2,11,P.woodDark); box(c,x,y,15,8,color,P.woodDark);
  box(c,x,y+7,15,7,P.woodLight,P.woodDark); rect(c,x+3,y+2,9,1,P.woodLight);
}
function table(c,x,y,w=37,h=22) {
  shadow(c,x,y,w,h); rect(c,x+3,y+8,3,h+1,P.woodDark); rect(c,x+w-6,y+8,3,h+1,P.woodDark);
  box(c,x,y,w,h,P.woodLight,P.woodDark); rect(c,x+2,y+2,w-4,3,P.cream); line(c,x+2,y+h-4,w-4,P.wood);
}
function shelf(c,x,y,w=27,kind='books') {
  shadow(c,x,y,w,29); box(c,x,y,w,30,P.wood,P.woodDark); rect(c,x+2,y+2,w-4,10,'#a98b70'); rect(c,x+2,y+16,w-4,10,'#a98b70');
  for(let r=0;r<2;r++) for(let i=0;i<Math.floor((w-5)/5);i++) {
    const colors = kind==='medicine'?[P.mint,P.blue,P.coralLight,P.white]:[P.coral,P.blue,P.sage,P.gold,P.lavender];
    const xx=x+3+i*5, yy=y+4+r*14;
    if(kind==='medicine') { rect(c,xx+1,yy+2,3,6,colors[i%colors.length]); rect(c,xx+2,yy,1,2,P.woodDark); }
    else { rect(c,xx,yy,4,8,colors[i%colors.length]); rect(c,xx+1,yy+2,2,1,P.cream); }
  }
  rect(c,x+2,y+12,w-4,3,P.woodLight); rect(c,x+2,y+27,w-4,2,P.woodLight);
}
function dummy(c,x,y) {
  rect(c,x+9,y+4,3,31,P.woodDark); rect(c,x+2,y+31,17,3,P.woodDark);
  box(c,x+4,y+8,14,16,P.gold,P.woodDark); rect(c,x-3,y+13,28,4,P.woodDark);
  box(c,x+5,y-3,12,12,P.cream,P.woodDark); rect(c,x+9,y+1,4,4,P.coral); rect(c,x+9,y+13,5,5,P.coral);
  rect(c,x+6,y+24,3,8,P.woodDark); rect(c,x+14,y+24,3,8,P.woodDark);
}
function anvil(c,x,y) {
  box(c,x+6,y+17,29,16,P.wood,P.woodDark); line(c,x+8,y+23,25,P.woodDark);
  poly(c,[[x,y+3],[x+35,y+3],[x+43,y+8],[x+31,y+12],[x+25,y+12],[x+27,y+19],[x+12,y+19],[x+13,y+11],[x+3,y+11]],'#838e93');
  rect(c,x+4,y+3,29,3,'#bec6c2'); rect(c,x+12,y+17,15,3,'#6d7b82');
}
function rug(c,x,y,w,h,color) {
  rect(c,x,y,w,h,color); rect(c,x+2,y+2,w-4,1,P.cream); rect(c,x+2,y+h-3,w-4,1,P.cream);
  for(let i=3;i<w-2;i+=5) { rect(c,x+i,y-2,1,2,color); rect(c,x+i,y+h,1,2,color); }
}
function roomFloor(c,f) {
  const meta=ROOMS[f.type]||ROOMS.reception, x=f.x*TILE, y=f.y*TILE, w=meta.w*TILE, h=meta.h*TILE;
  rect(c,x+3,y+5,w,h,'#abac91'); rect(c,x,y,w,h,P.woodDark); rect(c,x+3,y+3,w-6,h-6,P.woodLight);
  for(let yy=y+6;yy<y+h-3;yy+=9) {
    rect(c,x+4,yy,w-8,8, ((yy-y)/9|0)%2 ? '#e9c694':'#e7c18e'); line(c,x+4,yy+7,w-8,'#d9b17d');
    for(let xx=x+14+(Math.floor((yy-y)/9)%2)*17;xx<x+w-4;xx+=34) rect(c,xx,yy,1,7,'#d9b17d');
  }
  // Cutaway back wall, with a low side edge rather than walls that cover the characters.
  rect(c,x,y-14,w,18,P.woodDark); rect(c,x+3,y-11,w-6,13,P.cream); rect(c,x+3,y-11,w-6,3,P.white);
  rect(c,x+5,y-10,3,14,P.woodDark); rect(c,x+w-8,y-10,3,14,P.woodDark); rect(c,x,y+2,3,h-3,P.woodDark);
  const winx=x+w-27; box(c,winx,y-9,18,11,P.blue,P.woodDark); rect(c,winx+2,y-7,14,7,'#c9e3da'); rect(c,winx+8,y-7,2,7,P.cream);
  const name = meta.name;
  box(c,x+10,y-11,Math.min(w-47,name.length*5+6),13,P.paper,P.woodDark); label(c,name,x+13,y-8,P.ink,8);
  return {x,y,w,h,meta};
}
function drawRoom(c,f) {
  const {x,y,w,h,meta}=roomFloor(c,f);
  if(f.type==='reception') {
    rug(c,x+40,y+43,42,34,'#dfaa8a');
    box(c,x+9,y+8,40,25,P.woodDark); rect(c,x+12,y+11,34,19,P.wood); 
    for(let i=0;i<5;i++) { box(c,x+15+i%3*10,y+13+Math.floor(i/3)*8,7,7,P.paper,P.woodLight); rect(c,x+18+i%3*10,y+13+Math.floor(i/3)*8,1,2,P.coral); }
    table(c,x+64,y+11,50,19); rect(c,x+77,y+14,15,10,P.white); rect(c,x+78,y+16,10,1,P.woodDark); rect(c,x+78,y+19,7,1,P.woodDark);
    rect(c,x+102,y+13,5,7,P.blue); rect(c,x+105,y+9,1,6,P.ink); pot(c,x+9,y+65);
    banner(c,x+94,y+47); chair(c,x+67,y+36); box(c,x+15,y+42,21,14,P.wood,P.woodDark); rect(c,x+22,y+47,7,2,P.gold);
  } else if(f.type==='dorm') {
    for(let i=0;i<4;i++) bed(c,x+9+i*28,y+11);
    rug(c,x+31,y+62,55,18,P.blue); table(c,x+87,y+65,23,13); pot(c,x+94,y+59,'flowers');
    box(c,x+9,y+63,16,18,P.wood,P.woodDark); rect(c,x+11,y+66,12,1,P.woodLight); rect(c,x+15,y+72,3,2,P.gold);
  } else if(f.type==='infirmary') {
    bed(c,x+11,y+15,true); shelf(c,x+52,y+9,30,'medicine');
    table(c,x+53,y+50,26,18); rect(c,x+61,y+53,10,9,P.white); rect(c,x+65,y+53,2,8,P.coral); rect(c,x+62,y+56,8,2,P.coral);
    rug(c,x+10,y+70,50,11,P.sage); pot(c,x+72,y+79);
  } else if(f.type==='kitchen' || f.type==='tavern' || f.type==='lounge') {
    box(c,x+7,y+7,29,23,'#c6bca4',P.woodDark); box(c,x+10,y+10,23,7,'#8c877b',P.woodDark);
    rect(c,x+13,y+12,7,3,P.coral); rect(c,x+25,y+11,3,4,P.gold); rect(c,x+11,y+20,19,7,P.woodDark);
    table(c,x+38,y+8,34,16); box(c,x+44,y+10,13,8,P.sage,P.ink); rect(c,x+47,y+9,7,2,P.cream);
    shelf(c,x+88,y+6,27,'medicine');
    chair(c,x+36,y+47); chair(c,x+81,y+47); table(c,x+43,y+55,45,25);
    rect(c,x+45,y+61,40,11,P.cream); box(c,x+50,y+63,11,7,P.white,'#d7c7ac'); rect(c,x+52,y+65,7,3,P.gold);
    box(c,x+72,y+63,9,7,P.white,'#d7c7ac'); rect(c,x+73,y+65,7,2,P.coralLight); rect(c,x+64,y+58,4,6,P.blue);
    pot(c,x+9,y+73); rect(c,x+99,y+58,14,18,P.woodDark); rect(c,x+100,y+60,12,3,P.wood);
  } else if(f.type==='training') {
    rug(c,x+10,y+12,66,66,'#d8b98f'); dummy(c,x+22,y+33); dummy(c,x+53,y+26);
    box(c,x+93,y+13,18,38,P.wood,P.woodDark); rect(c,x+97,y+19,2,22,'#a5b9b6'); rect(c,x+94,y+29,8,2,P.cream);
    rect(c,x+105,y+20,2,22,P.coral); rect(c,x+102,y+34,8,2,P.gold);
    box(c,x+91,y+65,22,14,P.wood,P.woodDark); rect(c,x+95,y+67,14,3,P.woodLight);
    rect(c,x+13,y+83,36,3,P.woodDark);rect(c,x+14,y+79,5,11,'#919c98');rect(c,x+43,y+79,5,11,'#919c98');
  } else if(f.type==='workshop') {
    shelf(c,x+9,y+8,29); table(c,x+51,y+8,33,19); rect(c,x+58,y+9,3,14,P.woodDark); rect(c,x+54,y+9,12,4,'#939e9d');
    anvil(c,x+13,y+47); box(c,x+66,y+44,19,28,'#b5a58d',P.woodDark); rect(c,x+68,y+47,15,10,'#7b7065');
    rect(c,x+71,y+54,9,3,P.coral); rect(c,x+73,y+50,5,5,P.gold); rect(c,x+72,y+50,2,3,P.cream);
    box(c,x+65,y+75,22,12,P.wood,P.woodDark); line(c,x+67,y+79,18,P.woodLight);
  } else if(f.type==='dispatch') {
    table(c,x+17,y+32,61,31); rect(c,x+23,y+37,48,20,P.paper);
    poly(c,[[x+30,y+41],[x+39,y+45],[x+50,y+40],[x+63,y+47],[x+66,y+54],[x+52,y+52],[x+40,y+57],[x+29,y+53]],P.sage);
    rect(c,x+46,y+47,3,3,P.coral); rect(c,x+58,y+48,3,3,P.gold); rect(c,x+34,y+48,3,3,P.blue);
    shelf(c,x+8,y+6,27); chair(c,x+39,y+70); pot(c,x+75,y+18);
  } else if(f.type==='library') {
    shelf(c,x+8,y+7,32); shelf(c,x+52,y+7,32); rug(c,x+17,y+48,56,35,P.blue);
    table(c,x+28,y+54,37,20); rect(c,x+37,y+57,21,12,P.white); rect(c,x+47,y+57,1,12,P.wood); chair(c,x+39,y+77);
  } else if(f.type==='garden') {
    rect(c,x+5,y+6,w-10,h-12,P.grassLight);
    for(let i=0;i<3;i++) { box(c,x+12+i*26,y+13,19,62,P.wood,P.woodDark); rect(c,x+14+i*26,y+15,15,58,'#ae8e71'); for(let j=0;j<4;j++) pot(c,x+17+i*26,y+23+j*13,'flowers'); }
  } else if(f.type==='shrine') {
    rug(c,x+20,y+26,55,49,P.lavender); table(c,x+26,y+10,44,21); rect(c,x+46,y,5,25,P.gold); rect(c,x+38,y+6,21,5,P.gold);
    pot(c,x+9,y+25,'flowers'); pot(c,x+76,y+25,'flowers');
  } else {
    for(let i=0;i<4;i++) { const xx=x+12+i%2*40,yy=y+12+Math.floor(i/2)*38; box(c,xx,yy,29,27,P.wood,P.woodDark); rect(c,xx+3,yy+3,23,3,P.woodLight); rect(c,xx+12,yy+7,5,15,P.gold); }
  }
  if((f.level||1)>1) { label(c,'★'.repeat(Math.min(3,f.level)),x+w-25,y+h-12,P.woodDark,8); }
}

const CHAR_COLORS = [P.coral,P.blue,P.sage,P.lavender,'#d8b572','#9cbbc1','#bf9da1','#8ea28f'];
function roleOf(member) { return String(member.class||member.job||'warrior').toLowerCase(); }
const OUTLINE = '#5a463f';
function tone(hex, amount) {
  // Lighten (amount > 0) or darken (amount < 0) a #rrggbb colour for pixel shading.
  const value = parseInt(String(hex).slice(1, 7), 16); if (!Number.isFinite(value)) return hex;
  const target = amount < 0 ? 0 : 255, k = Math.abs(amount);
  const mix = channel => Math.round(channel + (target - channel) * k);
  const r = mix(value >> 16), g = mix((value >> 8) & 255), b = mix(value & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
/**
 * Small chibi adventurer (about 24px tall) drawn around the feet at (x, y).
 * pose: idle | breath | blink | sleep | train0 | train1 | work0 | work1; walking uses phase for the stride.
 */
function sprite(c,x,y,member,phase=0,walking=false,facing=1,direction='south',pose='idle') {
  const n=hash(member.id||member.name),role=roleOf(member),color=member.outfit||JOBS[member.class]?.color||CHAR_COLORS[n%CHAR_COLORS.length],skin=member.skin||P.skin;
  const hair=member.hair||MEMBER_ART[member.id]?.hair||['#795b50','#ad785e','#d9be87','#706175','#8b7760','#cfaaa4'][n%6];
  const base=JOBS[member.class]?.parent||member.class||role;
  const master=role==='master',villager=role==='villager',mage=base==='mage'||/mage|sage/.test(role),healer=base==='healer'||/heal|cleric|bard/.test(role),archer=base==='archer'||/arch|ranger|scout/.test(role);
  const back=direction==='north',side=direction==='east'||direction==='west',robe=mage||healer,long=member.hairStyle==='long';
  const stride=walking?Math.sin(phase):0,step=walking?(stride>.3?1:stride<-.3?-1:0):0,hop=walking&&Math.abs(stride)>.6?-1:0;
  const breathe=pose==='breath'?1:0,sleep=pose==='sleep',blink=pose==='blink'||sleep;
  const train=pose==='train0'?0:pose==='train1'?1:-1,work=pose==='work0'?0:pose==='work1'?1:-1;
  // Seated at a table or a bar stool: sit0 rests a hand on the table, sit1 lifts a mug or spoon to the mouth.
  const sit=pose==='sit0'||pose==='sit1',sip=pose==='sit1';
  const dark=tone(color,-.3),light=tone(color,.35),hairLight=tone(hair,.3),pants=tone(color,-.5);
  c.save();c.translate(Math.round(x),Math.round(y));if(facing<0||direction==='west')c.scale(-1,1);
  if(pose==='bed'){
    // Asleep in bed: only the head shows on the pillow, the body is under the blanket.
    c.translate(0,12);
    poly(c,[[-4,-19],[4,-19],[6,-17],[6,-11],[4,-9],[-4,-9],[-6,-11],[-6,-17]],OUTLINE);
    poly(c,[[-4,-18],[4,-18],[5,-17],[5,-11],[4,-10],[-4,-10],[-5,-11],[-5,-17]],skin);
    rect(c,-4,-18,8,1,hair);rect(c,-5,-17,10,2,hair);rect(c,-5,-15,1,4,hair);rect(c,4,-15,1,4,hair);rect(c,-2,-15,2,1,hair);rect(c,-3,-17,2,1,hairLight);
    if(long){rect(c,-7,-15,2,6,hair);rect(c,5,-15,2,6,hair);}
    rect(c,-3,-12,2,1,'#3a2f2b');rect(c,1,-12,2,1,'#3a2f2b');rect(c,-4,-11,1,1,'#f19a8a');rect(c,3,-11,1,1,'#f19a8a');
    rect(c,-6,-9,12,2,OUTLINE);rect(c,-5,-9,10,1,P.cream);
    c.restore();return;
  }
  if(sit){
    // Lowered onto the seat, knees forward, feet dangling.
    c.translate(0,3);rect(c,-4,-4,8,3,OUTLINE);rect(c,-3,-4,6,2,pants);rect(c,-3,-2,2,2,OUTLINE);rect(c,1,-2,2,2,OUTLINE);
  }else{
  rect(c,-4,-1,8,2,'#3b382c30');
  // Feet: a pixel of lift alternates between the legs.
  rect(c,-3+(side?step:0),-3+(step>0?-1:0),2,3,OUTLINE);rect(c,1-(side?step:0),-3+(step<0?-1:0),2,3,OUTLINE);
  rect(c,-3+(side?step:0),-3+(step>0?-1:0),2,1,pants);rect(c,1-(side?step:0),-3+(step<0?-1:0),2,1,pants);}
  c.translate(0,hop);
  if(archer&&back){rect(c,-3,-10,2,5,P.woodDark);rect(c,-3,-11,1,1,P.coralLight);}
  // Body: tunic or robe with a lit side and a shaded side.
  if(robe){rect(c,-5,-6,10,4,OUTLINE);rect(c,-4,-6,8,3,color);rect(c,-4,-4,8,1,dark);}
  rect(c,-4,-9+breathe,8,6-breathe,OUTLINE);rect(c,-3,-8+breathe,6,4-breathe,color);rect(c,-3,-8+breathe,1,3,light);rect(c,2,-8+breathe,1,4-breathe,dark);
  if(!back){if(master){rect(c,-2,-8+breathe,1,1,P.cream);rect(c,-1,-7+breathe,1,1,P.cream);rect(c,0,-6,1,1,P.cream);}
   else if(villager){if(n%2)rect(c,-2,-7+breathe,4,3,P.cream);}
   else if(healer)rect(c,-1,-8+breathe,2,1,P.cream),rect(c,0,-8+breathe,1,3,P.cream);
   else if(!robe&&!archer)rect(c,-3,-8+breathe,6,1,'#dfe6e2');
   else if(archer){rect(c,-2,-8+breathe,1,1,P.woodDark);rect(c,-1,-7+breathe,1,1,P.woodDark);rect(c,0,-6,1,1,P.woodDark);}}
  rect(c,-3,-5,6,1,'#8a6a4a');
  // Arms: a coloured pixel column outlined on the outside, hands in skin.
  const swing=walking?step:0,raised=(train===0||work===0)&&!sit,forward=train===1||work===1||(sit&&!sip);
  rect(c,-6,-8-swing+breathe,2,4,OUTLINE);rect(c,-5,-8-swing+breathe,1,3,color);rect(c,-5,-5-swing+breathe,1,1,skin);
  if(raised){rect(c,4,-12,2,5,OUTLINE);rect(c,4,-12,1,4,color);rect(c,4,-13,1,1,skin);}
  else if(sip){rect(c,4,-12,2,5,OUTLINE);rect(c,4,-11,1,4,color);rect(c,4,-12,1,1,skin);rect(c,5,-14,3,4,OUTLINE);rect(c,5,-13,2,2,'#e8d29a');rect(c,5,-14,2,1,'#fff7ea');}
  else if(forward){rect(c,4,-8,4,2,OUTLINE);rect(c,4,-8,3,1,color);rect(c,7,-8,1,1,skin);}
  else{rect(c,4,-8+swing+breathe,2,4,OUTLINE);rect(c,4,-8+swing+breathe,1,3,color);rect(c,4,-5+swing+breathe,1,1,skin);}
  const hand=raised?{x:4,y:-13}:sip?{x:5,y:-13}:forward?{x:7,y:-8}:{x:4,y:-5+swing+breathe};
  // Big round head with hair cap, fringe and dot eyes.
  c.translate(0,breathe+(sleep?1:0));
  poly(c,[[-4,-19],[4,-19],[6,-17],[6,-11],[4,-9],[-4,-9],[-6,-11],[-6,-17]],OUTLINE);
  poly(c,[[-4,-18],[4,-18],[5,-17],[5,-11],[4,-10],[-4,-10],[-5,-11],[-5,-17]],skin);
  if(back){rect(c,-5,-18,10,long?9:7,hair);rect(c,-4,-18,8,1,hair);rect(c,-3,-17,2,1,hairLight);if(long)rect(c,-5,-9,10,1,OUTLINE);}
  else{
    rect(c,-4,-18,8,1,hair);rect(c,-5,-17,10,2,hair);rect(c,-5,-15,1,side?2:4,hair);if(!side)rect(c,4,-15,1,4,hair);
    rect(c,-2,-15,2,1,hair);rect(c,2,-15,1,1,hair);rect(c,-3,-17,2,1,hairLight);
    if(long){rect(c,-6,-14,1,6,hair);if(!side)rect(c,5,-14,1,6,hair);}
    const eye='#3a2f2b';
    if(side){if(blink)rect(c,2,-12,2,1,eye);else rect(c,2,-13,1,2,eye);rect(c,3,-11,1,1,'#f19a8a');}
    else{if(blink){rect(c,-3,-12,2,1,eye);rect(c,1,-12,2,1,eye);}else{rect(c,-3,-13,1,2,eye);rect(c,2,-13,1,2,eye);}
      rect(c,-4,-11,1,1,'#f19a8a');rect(c,3,-11,1,1,'#f19a8a');if(!sleep)rect(c,0,-11,1,1,'#c98b78');}
  }
  // Headwear by class.
  if(mage){rect(c,-7,-18,14,1,OUTLINE);rect(c,-6,-18,12,1,dark);poly(c,[[-4,-18],[4,-18],[1,-24],[-1,-25]],OUTLINE);poly(c,[[-3,-18],[3,-18],[0,-23]],color);rect(c,-3,-19,6,1,P.gold);}
  else if(healer){rect(c,-5,-20,10,3,OUTLINE);rect(c,-4,-20,8,2,P.cream);rect(c,0,-20,1,2,P.coral);rect(c,-1,-19,3,1,P.coral);}
  else if(archer){rect(c,-6,-19,12,3,OUTLINE);rect(c,-5,-19,10,2,P.sage);rect(c,-4,-19,4,1,P.mint);rect(c,3,-22,1,3,P.coralLight);rect(c,4,-23,1,2,P.coralLight);}
  else if(villager){const hat=member.hat??n%3;if(hat===0){rect(c,-8,-17,16,2,OUTLINE);rect(c,-7,-17,14,1,'#e2c37e');rect(c,-4,-21,8,4,OUTLINE);rect(c,-3,-20,6,3,'#e8cd8c');rect(c,-3,-18,6,1,P.coral);}else if(hat===1){rect(c,-5,-19,10,3,OUTLINE);rect(c,-4,-19,8,2,tone(color,.2));if(!back)rect(c,4,-16,2,2,tone(color,.2));}}
  else if(!master){rect(c,-5,-17,10,1,P.cream);if(!back)rect(c,4,-17,2,1,P.gold);}
  else{rect(c,-1,-19,2,1,hairLight);}
  if(sleep){rect(c,-3,-12,2,1,'#3a2f2b');}
  c.translate(0,-breathe-(sleep?1:0));
  // Held gear in the working hand.
  if(work>=0){rect(c,hand.x+1,hand.y-(work===0?4:0),1,5,P.woodDark);rect(c,hand.x-1,hand.y-(work===0?6:-4),4,2,'#8f9a98');}
  else if(villager){if(member.letter&&!back){rect(c,hand.x-1,hand.y-3,5,4,OUTLINE);rect(c,hand.x,hand.y-2,3,2,P.cream);rect(c,hand.x+1,hand.y-2,1,1,P.coral);}}
  else if(master){rect(c,hand.x,hand.y-2,3,4,OUTLINE);rect(c,hand.x+1,hand.y-1,1,2,P.white);if(!back)rect(c,-7,-6,2,2,P.woodLight);}
  else if(robe){const top=healer?P.gold:P.blue,glow=train>=0;rect(c,-7,-16,1,13,P.woodDark);rect(c,-8,-18,3,3,OUTLINE);rect(c,-7,-17,1,1,glow?P.white:top);if(glow){rect(c,-9-train,-20,1,1,tone(top,.5));rect(c,-5+train,-21,1,1,P.white);}}
  else if(archer){if(train>=0){rect(c,hand.x+2,hand.y-4,1,9,P.woodDark);rect(c,hand.x+1,hand.y-5,1,1,P.woodDark);rect(c,hand.x+1,hand.y+5,1,1,P.woodDark);if(train===1)rect(c,hand.x+4,hand.y,4,1,P.woodDark);}
   else if(!back){rect(c,-7,-12,1,7,P.woodDark);rect(c,-6,-13,1,1,P.woodDark);rect(c,-6,-5,1,1,P.woodDark);}}
  else{
    if(train===0){rect(c,hand.x,hand.y-6,1,6,'#e3e9e6');rect(c,hand.x-1,hand.y,3,1,P.gold);}
    else if(train===1){rect(c,hand.x+1,hand.y,6,1,'#e3e9e6');rect(c,hand.x,hand.y-1,1,3,P.gold);}
    else{rect(c,hand.x+1,hand.y-6,1,6,'#e3e9e6');rect(c,hand.x,hand.y,3,1,P.gold);}
    if(!back&&!side){rect(c,-8,-8+swing,3,4,OUTLINE);rect(c,-7,-7+swing,1,2,P.blue);}
  }
  c.restore();
}

export function drawPortrait(canvas,member={},size=64) {
  canvas.width=size; canvas.height=size; const c=canvas.getContext('2d'); c.imageSmoothingEnabled=false;
  rect(c,0,0,size,size,P.paper); rect(c,3,3,size-6,size-6,'#e9d7b9');
  const scale=Math.max(1,Math.floor(size/26)); c.save(); c.translate(Math.round(size/2),size-Math.round(size/10)); c.scale(scale,scale); sprite(c,0,0,member); c.restore();
}

export function drawItemIcon(canvas,type='sword',size=40) {
  if(drawIllustratedIcon(canvas,type,size))return;
  canvas.width=size; canvas.height=size; const c=canvas.getContext('2d'); c.imageSmoothingEnabled=false;
  c.clearRect(0,0,size,size); c.save(); c.translate(size/2,size/2); c.scale(size/32,size/32);
  const name=String(typeof type==='object'?(type.type||type.id||type.name):type).toLowerCase();
  if(/ribbon/.test(name)) {
    poly(c,[[-2,-6],[-12,-13],[-15,-3],[-10,4],[-2,0]],P.coral);
    poly(c,[[2,-6],[12,-13],[15,-3],[10,4],[2,0]],P.coral);
    poly(c,[[-3,-2],[-9,12],[-3,10],[0,14],[3,-2]],P.coralLight);
    poly(c,[[3,-2],[10,11],[4,10],[1,14],[-2,-2]],P.coral);
    box(c,-3,-6,7,8,P.gold,P.woodDark); rect(c,-1,-4,3,3,P.cream);
  } else if(/charm|amulet|accessory/.test(name)) {
    rect(c,-7,-12,14,2,P.woodDark);rect(c,-9,-10,2,12,P.woodDark);rect(c,7,-10,2,12,P.woodDark);
    poly(c,[[0,-3],[8,3],[6,12],[0,16],[-6,12],[-8,3]],P.deep);
    poly(c,[[0,-1],[6,4],[4,10],[0,13],[-4,10],[-6,4]],P.lavender);rect(c,-2,3,4,6,P.white);rect(c,0,1,3,3,P.gold);
  } else if(name==='map') {
    box(c,-13,-11,26,22,P.paper,P.woodDark); rect(c,-11,-9,8,18,'#c9dcaa'); rect(c,-3,-9,7,18,'#d6cfbd'); rect(c,4,-9,7,18,'#a7bdb4');
    rect(c,-9,4,6,2,P.wood); rect(c,-4,1,6,2,P.wood); rect(c,1,-2,5,2,P.wood); rect(c,6,-6,3,3,P.coral); rect(c,-11,-4,3,3,P.coral);
  } else if(name==='house') {
    poly(c,[[-14,-1],[0,-14],[14,-1]],P.woodDark); poly(c,[[-11,-2],[0,-12],[11,-2]],P.coral); box(c,-10,-2,20,15,P.cream,P.woodDark);
    rect(c,-3,4,6,9,P.wood); rect(c,-8,1,4,4,'#a5c0b8'); rect(c,4,1,4,4,'#a5c0b8'); rect(c,6,-12,3,6,P.woodDark);
  } else if(name==='hammer') {
    c.rotate(-.6); rect(c,-2,-4,4,19,P.woodDark); rect(c,-1,-4,2,18,P.wood); box(c,-10,-13,20,10,'#9aa6a4',P.deep); rect(c,-8,-11,16,2,'#c9d1cc'); c.rotate(.6);
  } else if(name==='scroll') {
    box(c,-11,-12,22,24,P.paper,P.woodDark); rect(c,-13,-14,26,4,P.wood); rect(c,-13,10,26,4,P.wood); rect(c,-7,-6,14,2,P.woodDark); rect(c,-7,-1,11,2,P.woodDark); rect(c,-7,4,13,2,P.woodDark); rect(c,5,3,5,5,P.coral);
  } else if(name==='people') {
    box(c,-14,-1,13,14,P.blue,P.deep); box(c,-12,-12,9,10,P.skin,P.deep); rect(c,-12,-12,9,3,'#795b50');
    box(c,1,-3,14,16,P.coral,P.deep); box(c,3,-15,10,11,P.skin,P.deep); rect(c,3,-15,10,4,'#d9be87');
  } else if(name==='lantern') {
    rect(c,-1,-15,2,4,P.woodDark); poly(c,[[-8,-11],[8,-11],[11,-2],[8,10],[-8,10],[-11,-2]],P.woodDark); poly(c,[[-6,-9],[6,-9],[9,-2],[6,8],[-6,8],[-9,-2]],P.coral);
    rect(c,-4,-8,3,15,P.coralLight); rect(c,-7,-3,14,2,P.gold); rect(c,-5,9,10,3,P.gold); rect(c,-1,12,2,4,P.gold); rect(c,2,-6,2,3,P.cream);
  } else if(name==='banner') {
    rect(c,-11,-15,3,30,P.woodDark); rect(c,-9,-14,20,17,P.coral); poly(c,[[-9,3],[1,-1],[11,3],[11,6],[1,2],[-9,6]],P.coral); rect(c,-7,-13,2,14,P.coralLight); rect(c,-1,-10,5,9,P.cream); rect(c,-3,-7,9,3,P.cream);
  } else if(/staff|wand|magic/.test(name)) {
    rect(c,-2,-8,3,23,P.woodDark); box(c,-6,-14,11,11,P.blue,P.deep); rect(c,-3,-12,5,5,P.mint); rect(c,-1,-11,2,2,P.white); rect(c,-4,-4,7,2,P.gold);
  } else if(/bow/.test(name)) {
    poly(c,[[-7,-14],[-1,-11],[5,-5],[7,1],[5,8],[-1,13],[-7,15],[-6,11],[-1,8],[2,1],[-1,-7],[-6,-10]],P.woodDark);
    rect(c,-7,-13,1,27,P.cream); rect(c,-10,0,22,2,P.wood); poly(c,[[10,-3],[15,1],[10,5]],'#aabbb6');
  } else if(/potion|heal|herb/.test(name)) {
    rect(c,-3,-14,6,6,P.wood); rect(c,-4,-8,8,4,'#c0dad1'); box(c,-10,-3,20,17,P.sage,P.deep); rect(c,-8,-1,16,12,P.mint); rect(c,-7,1,3,6,P.white); rect(c,-3,3,6,2,P.cream); rect(c,-1,1,2,6,P.cream);
  } else if(/armor|coat|robe|leather/.test(name)) {
    poly(c,[[-6,-11],[-2,-8],[3,-8],[7,-11],[14,-6],[10,0],[6,-2],[7,13],[-7,13],[-6,-2],[-10,0],[-14,-6]],P.coral);
    rect(c,-2,-8,4,15,P.cream); rect(c,-7,7,14,3,P.woodDark); rect(c,-1,7,3,3,P.gold);
  } else if(/food|ration|bread/.test(name)) {
    box(c,-13,-5,26,18,P.wood,P.woodDark); rect(c,-11,-7,22,15,P.gold); rect(c,-9,-9,18,4,P.woodLight); for(let i=-6;i<8;i+=5)rect(c,i,-5,2,5,P.cream);
  } else if(/coin|gold|money/.test(name)) {
    poly(c,[[-7,-12],[7,-12],[12,-7],[12,7],[7,12],[-7,12],[-12,7],[-12,-7]],P.woodDark); box(c,-9,-9,18,18,P.gold,P.woodLight); rect(c,-3,-5,6,2,P.cream); rect(c,-3,-1,6,2,P.cream); rect(c,-1,-6,2,12,P.cream);
  } else if(/ore|iron|stone/.test(name)) {
    poly(c,[[-13,8],[-9,-5],[-2,-12],[8,-8],[13,2],[8,12],[-4,13]],'#889b9e'); poly(c,[[-9,-5],[-2,-12],[2,-3],[-2,5]],'#c2cec7'); poly(c,[[2,-3],[8,-8],[13,2],[5,6]],P.blue);
  } else if(/wood|timber/.test(name)) {
    rect(c,-12,-7,24,15,P.woodDark); rect(c,-10,-5,20,11,P.wood); box(c,6,-7,9,15,P.woodLight,P.woodDark); rect(c,8,-4,4,9,P.wood); rect(c,-7,-2,12,1,P.woodLight);
  } else if(/shield/.test(name)) {
    poly(c,[[-11,-12],[11,-12],[10,5],[0,14],[-10,5]],P.deep); poly(c,[[-8,-9],[8,-9],[7,4],[0,10],[-7,4]],P.blue); rect(c,-2,-8,4,15,P.cream); rect(c,-7,-3,14,4,P.cream);
  } else if(/bed|dorm/.test(name)) { bed(c,-11,-20); }
  else if(/book|library/.test(name)) { box(c,-12,-13,24,26,P.blue,P.woodDark); rect(c,-10,-11,3,22,P.cream); rect(c,-3,-8,11,2,P.gold); rect(c,-3,-3,8,2,P.cream); }
  else if(/leaf|gem|crystal/.test(name)) {
    poly(c,[[0,-15],[10,-6],[8,7],[0,14],[-8,7],[-10,-6]],P.sage); poly(c,[[0,-15],[0,14],[-8,7],[-10,-6]],P.mint); rect(c,-4,-4,2,5,P.white);
  } else {
    c.rotate(.65); rect(c,-3,-15,6,22,P.deep); rect(c,-2,-14,4,20,'#b9c9c6'); rect(c,-1,-12,1,17,P.white); rect(c,-8,5,16,3,P.gold); rect(c,-2,8,4,8,P.woodDark); rect(c,-3,14,6,3,P.gold);
  }
  c.restore();
}

/** A quest's creature from the bestiary, scaled up by a whole number so its pixels stay crisp; feet at (x, y). */
function battleEnemy(c,x,y,quest,phase=0,flash=false,size=44) {
  const m=makeMonster(questFoe(quest),Math.floor(phase*2.5)%2,flash),cw=m.canvas.width,ch=m.canvas.height,k=Math.max(1,Math.min(3,Math.round(size/ch)));
  const smooth=c.imageSmoothingEnabled;c.imageSmoothingEnabled=false;
  c.fillStyle='rgba(70,58,46,.2)';c.beginPath();c.ellipse(x,y+1,cw*k*.3,2.5*k,0,0,Math.PI*2);c.fill();
  c.drawImage(m.canvas,Math.round(x-m.footX*k),Math.round(y-m.footY*k),cw*k,ch*k);c.imageSmoothingEnabled=smooth;
}

/** Mission illustration mirrors engine health and strike records; it never resolves combat. */
export function drawBattleScene(canvas,mission,quest,state,options={}) {
  if(!canvas||!mission||!quest)return;
  const c=canvas.getContext('2d'),w=canvas.width||280,h=canvas.height||145;c.imageSmoothingEnabled=false;
  const now=Number(options.time??performance.now()/1000),paused=Boolean(options.paused);
  let memory=canvas.__guildBattle;
  if(!memory||memory.id!==mission.id)memory=canvas.__guildBattle={id:mission.id,lastTime:now,clock:0,strike:mission.combat?.lastStrike||0,strikeAt:-10};
  if(!paused)memory.clock+=Math.max(0,Math.min(.1,now-memory.lastTime));memory.lastTime=now;
  if(memory.strike!==(mission.combat?.lastStrike||0)){memory.strike=mission.combat?.lastStrike||0;memory.strikeAt=memory.clock;}
  const t=memory.clock,ratio=mission.duration?mission.progress/mission.duration:0;
  const combat=mission.combat||{},battle=mission.status==='active'&&(mission.phase==='battle'||(ratio>=.18&&ratio<.88));
  const colors=quest.region==='mist'?['#dce7e1','#acc6bb','#829e97']:quest.region==='ruins'?['#e8e2dd','#b6c2b7','#869c94']:['#e7eedb','#c4d7ac','#91b296'];
  c.save();c.scale(w/280,h/145);rect(c,0,0,280,145,colors[0]);
  // Pixel scenery stays behind the silhouettes and the health indicators.
  for(let i=0;i<6;i++){const x=i*52-11;rect(c,x+18,36+(i%2)*7,8,65,P.woodDark);leafCluster(c,x,29+(i%2)*9,43,34,colors[1],colors[0]);leafCluster(c,x+9,16+(i%2)*8,27,26,colors[1],colors[0]);}
  if(quest.region==='ruins'){for(let i=0;i<3;i++){const x=20+i*89;box(c,x,66,13,30,P.stone,'#a0aca5');rect(c,x-3,64,19,5,'#c7ccc0');rect(c,x+2,81,9,1,'#a0aca5');}}
  rect(c,0,106,280,39,'#c8c9a6');rect(c,0,111,280,26,'#e2d0ad');rect(c,0,118,280,2,'#eedec0');
  for(let i=0;i<17;i++)rect(c,(i*37)%280,101+(i%3)*2,2,6,colors[2]);
  flower(c,15,116,P.coralLight);flower(c,264,112,P.white);rect(c,219,131,11,4,P.stone);
  const members=(mission.memberIds||[]).map(id=>(state.members||[]).find(m=>m.id===id)).filter(Boolean);
  const strike=combat.log?.[0],attackAge=t-memory.strikeAt,attack=battle&&!paused&&attackAge>=0&&attackAge<.7;
  for(let i=0;i<members.length;i++){
    const member=members[i],attacking=attack&&strike?.memberId===member.id;
    const memberRole=JOBS[member.class]?.role||'damage',melee=memberRole==='tank'||memberRole==='damage';
    const baseX=battle?(melee?143:memberRole==='scout'?80:37)+(i%2)*6:32+i*43;
    const x=baseX+(attacking?Math.round(Math.sin(attackAge/.7*Math.PI)*(melee?46:7)):0),y=108+(i%2)*6;
    c.save();c.translate(x,y);c.scale(2,2);sprite(c,0,0,member,t*5+i,!battle&&mission.status==='active',1,battle?'east':'south',attacking?(attackAge<.25?'train0':'train1'):(Math.floor(t*1.6+i)%2?'breath':'idle'));c.restore();
    if(attacking){const role=JOBS[member.class]?.role||'damage',px=x+17+(185-x)*Math.min(1,attackAge/.4);
      if(role==='magic'||role==='heal'){box(c,px,y-21,7,7,role==='magic'?P.lavender:P.mint,P.white);rect(c,px-8,y-18,4,2,P.white);rect(c,px-15,y-18,3,1,P.lavender);}
      else if(role==='scout'){rect(c,px,y-16,11,1,P.woodDark);poly(c,[[px+10,y-19],[px+15,y-16],[px+10,y-13]],P.white);}
      else{poly(c,[[x+15,y-24],[x+31,y-16],[x+24,y-1],[x+21,y-14]],P.white);rect(c,x+23,y-17,7,2,P.gold);}
    }
  }
  if(battle)battleEnemy(c,218,111,quest,t,attack&&attackAge>.3&&attackAge<.4);
  else if(mission.status==='active'&&mission.phase==='travel'){label(c,'→',186,85,P.woodDark,20);box(c,211,81,27,24,P.paper,P.woodDark);rect(c,219,87,12,1,P.woodDark);rect(c,219,91,8,1,P.woodDark);}
  else{rect(c,202,83,39,28,P.woodLight);poly(c,[[195,83],[221,62],[248,83]],P.coral);box(c,216,93,10,18,P.woodDark,P.woodDark);}
  if(attack&&attackAge>.28&&Number.isFinite(strike?.damage))label(c,String(strike.damage),212,50-Math.round(attackAge*8),P.deep,12);
  const hp=(value,max)=>Math.max(0,Math.min(1,Number(value||0)/Math.max(1,Number(max||1))));
  box(c,7,7,111,22,P.paper,'#bbc5ab');label(c,'TEAM',12,11,P.deep,8);rect(c,41,11,71,5,'#d6d8be');rect(c,41,11,71*hp(combat.partyHp,combat.partyMaxHp),5,P.sage);label(c,`${Math.ceil(combat.partyHp||0)}/${Math.ceil(combat.partyMaxHp||0)}`,43,19,P.deep,7);
  if(battle){box(c,162,7,111,22,P.paper,'#bbc5ab');label(c,'FOE',167,11,P.deep,8);rect(c,191,11,75,5,'#ded2bb');rect(c,191,11,75*hp(combat.enemyHp,combat.enemyMaxHp),5,P.coral);label(c,`${Math.ceil(combat.enemyHp||0)}/${Math.ceil(combat.enemyMaxHp||0)}`,193,19,P.deep,7);}
  const caption=battle?`WAVE ${combat.wave||1}`:mission.status==='active'?(mission.phase==='return'?'ON THE WAY HOME':'ON THE TRAIL'):'BACK AT THE GUILD';
  label(c,caption,10,132,P.deep,8);if(paused)label(c,'PAUSED',235,132,P.deep,7);
  c.restore();
}

// Texture baking only; the in-game world is rendered by Phaser/WebGL.
/** A villager's look from their petition: a dozen looks rotate so sprite textures stay few. The elder is always the same. */
const VILLAGER_OUTFITS=['#c9a77c','#9cb59a','#d6a08f','#a9b7c9','#e0c58f','#b7aec9'],VILLAGER_HAIR=['#5b4637','#8b5a3c','#d9b26f','#a66c59','#6f6a8f','#e9e2d0'],VILLAGER_SKIN=['#f7d4ae','#e8b88c','#b9805a'];
export function villagerLook(p={}){if(p.home==='elder')return{id:'elder',name:p.client,class:'villager',hair:'#e9e2d0',outfit:'#8a7a68',skin:VILLAGER_SKIN[0],hairStyle:'short',hat:2,letter:true};
  const s=(p.seed||1)%12;return{id:'v'+s,name:p.client,class:'villager',hair:VILLAGER_HAIR[(s*5)%6],outfit:VILLAGER_OUTFITS[(s*7+1)%6],skin:VILLAGER_SKIN[s%3],hairStyle:s%2?'long':'short',hat:s%3,letter:true};}
/** How an applicant at the door looks: a named adventurer's own look, or a rookie's stored one. */
export function applicantLook(a={}){if(a.memberId){const m=MEMBER_ART[a.memberId];return{id:m.id,name:m.name,class:m.class,hair:m.hair};}return{id:a.rookieId,name:a.bio?.name,class:a.bio?.class||'warrior',hair:a.bio?.hair};}
export function makeActorTexture(member={},phase=0,walking=false,facing=1,direction='south',pose='idle') {
 const canvas=document.createElement('canvas');canvas.width=44;canvas.height=52;
 const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
 sprite(ctx,22,48,member,phase,walking,facing,direction,pose);return canvas;
}

/** Quest board thumbnail: the region's scenery with the quest's foe. */
export function drawQuestArt(canvas,quest={},options={}) {
  drawIllustratedRegion(canvas,quest.region||options.region||'meadow',Boolean(options.locked));
}

/** Shared drawing for other views (the dungeon map). */
export function drawSprite(c,x,y,member,phase=0,walking=false,facing=1,direction='south',pose='idle'){sprite(c,x,y,member,phase,walking,facing,direction,pose);}
/** size: the height to aim for; the creature is scaled by a whole number nearest to it. */
export function drawFoe(c,x,y,quest,phase=0,flash=false,size=44){battleEnemy(c,x,y,quest,phase,flash,size);}
