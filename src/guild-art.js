import { FACILITIES } from './content.js';

// Original, baked pixel textures. Phaser owns the visible canvas and all camera/render work.
const {rect:R,poly:P,line:L,ellipse:E,rng,createCanvas}=window.ArtCore;
const C={ink:'#554334',oak:'#987040',edge:'#6c4b30',light:'#cbaa70',top:'#dec18b',cream:'#dfd0a4',plaster:'#d1c298',stone:'#8e8a6d',shadow:'#74694b'};
export const CELL_W=32,CELL_H=24,ORIGIN_X=126,ORIGIN_Y=94;
export const gridPoint=(x,y)=>({x:ORIGIN_X+x*CELL_W,y:ORIGIN_Y+y*CELL_H});
function block(c,x,y,w,h,color,edge=C.edge){R(c,x,y,w,h,edge);R(c,x+1,y+1,w-2,h-2,color);R(c,x+2,y+1,w-4,1,C.light);}
function rug(c,x,y,w,h,color){R(c,x,y,w,h,C.edge);R(c,x+1,y+1,w-2,h-2,color);R(c,x+3,y+3,w-6,1,C.cream);R(c,x+3,y+h-4,w-6,1,C.cream);for(let xx=x+3;xx<x+w-3;xx+=5){R(c,xx,y-1,2,1,C.cream);R(c,xx,y+h,2,1,C.cream);}}
function bed(c,x,y,color,medical=false){
 R(c,x+3,y+10,31,39,'#8d7850');block(c,x,y,30,47,C.oak);R(c,x+2,y+4,26,37,'#ded3ae');
 block(c,x-1,y-6,32,10,C.light);R(c,x+3,y-4,23,1,C.top);R(c,x+2,y+2,26,10,'#f1e2bd');R(c,x+5,y+4,18,6,'#e3d4b2');R(c,x+6,y+4,16,1,'#fff1cf');
 R(c,x+2,y+14,26,25,color);R(c,x+2,y+14,26,3,'#e0cfb7');R(c,x+5,y+20,1,16,'#ffffff24');R(c,x+25,y+18,2,20,'#51464b35');
 for(let yy=y+21;yy<y+38;yy+=5)for(let xx=x+8;xx<x+24;xx+=7)R(c,xx,yy,2,1,'#fff2cb50');
 if(medical){R(c,x+11,y+24,8,3,'#eae5c8');R(c,x+14,y+21,3,9,'#eae5c8');}
 R(c,x,y+44,30,4,C.edge);R(c,x+1,y+44,28,1,C.light);R(c,x+2,y+48,3,3,C.edge);R(c,x+25,y+48,3,3,C.edge);
}
function bookshelf(c,x,y,w=38,medical=false){
 R(c,x+3,y+8,w,23,'#8b7146');block(c,x,y,w,27,C.oak);
 for(let row=0;row<2;row++){R(c,x+3,y+4+row*11,w-6,8,C.edge);for(let j=0;j<Math.floor((w-8)/5);j++){const colors=medical?['#ded8bf','#a9ba9c','#c4b68e']:['#a7644f','#bdab78','#889f8a','#a597b1'];R(c,x+4+j*5,y+4+row*11,3,7-j%2,colors[(j+row)%4]);R(c,x+4+j*5,y+5+row*11,3,1,'#d7c39a');}R(c,x+2,y+12+row*11,w-4,2,C.light);}
 R(c,x+2,y+25,w-4,2,C.light);
}
function table(c,x,y,w=48,h=22){
 R(c,x+4,y+h+3,w-1,5,'#89754b');R(c,x+3,y+12,4,h+1,C.edge);R(c,x+w-7,y+12,4,h+1,C.edge);
 block(c,x,y,w,h,C.oak);for(let yy=y+3;yy<y+h-2;yy+=5){R(c,x+2,yy,w-4,3,yy%2?C.light:'#b68d56');R(c,x+4,yy,w-8,1,'#c49c61');}R(c,x+2,y+h-2,w-4,3,C.edge);
}
function plant(c,x,y){E(c,x+5,y+10,7,3,'#796b3d');block(c,x,y+3,10,9,'#ac794d');P(c,[[x-3,y+3],[x-2,y-4],[x+2,y-1],[x+4,y-9],[x+8,y-2],[x+11,y-4],[x+12,y+3]],'#6a8138');R(c,x+3,y-5,3,4,'#afad4d');}
function brazier(c,x,y){E(c,x+8,y+17,11,4,'#816d43');block(c,x,y,17,17,'#74776b');R(c,x+2,y+2,13,7,'#424844');R(c,x+4,y+3,7,3,'#d29752');R(c,x+8,y+1,3,4,'#e3c877');R(c,x+2,y+11,12,2,'#99947b');}
function dummy(c,x,y){R(c,x+9,y+6,3,25,C.edge);R(c,x,y+16,23,3,C.oak);E(c,x+11,y+4,7,8,'#8b6a3c');E(c,x+10,y+3,5,6,'#bf9b62');R(c,x+4,y+27,16,3,C.edge);R(c,x+6,y+27,12,1,C.light);}
function paintWindow(c,x,y){block(c,x,y,21,14,C.edge);R(c,x+2,y+2,17,10,'#859184');L(c,x+3,y+10,x+11,y+2,'#c3c5a0');L(c,x+8,y+11,x+16,y+3,'#c3c5a0');R(c,x+9,y+1,3,12,C.light);R(c,x+1,y+7,19,2,C.light);R(c,x-2,y+13,25,3,C.top);}
export function makeRoom(f){
 const d=FACILITIES[f.type],w=d.w*CELL_W,h=d.h*CELL_H,head=28;
 const canvas=createCanvas(w+4,h+head+13),c=canvas.getContext('2d'),r=rng(811+f.x*59+f.y*87);
 const base=f.type==='infirmary'?'#c1bb94':f.type==='workshop'?'#b0a27d':'#c5a56f';
 R(c,1,head+4,w,h+6,'#72613e');R(c,1,head,w-2,h,base);
 for(let yy=head;yy<head+h;yy+=7){R(c,2,yy,w-4,1,'#9b7b4e');R(c,2,yy+1,w-4,1,'#d7b884');for(let xx=2+(Math.floor((yy-head)/7)%2)*23;xx<w-4;xx+=45){R(c,xx,yy,1,7,'#a08451');if(r()<.7)R(c,xx+5,yy+3,7+r()*10,1,'#b8945e');}}
 // Tall rear faces, visible wall tops, and low front cuts retain the 3/4 angle.
 R(c,0,3,w,head-3,C.edge);R(c,3,7,w-6,17,C.plaster);R(c,3,7,w-6,2,C.cream);R(c,0,2,w,3,'#57594e');R(c,1,2,w-2,1,'#a5a18b');
 for(let xx=0;xx<w;xx+=32){R(c,xx,5,3,head-5,C.edge);R(c,xx+1,6,1,head-7,C.light);L(c,xx+5,22,xx+26,9,'#9a8156',2);}
 R(c,2,22,w-4,3,C.oak);R(c,2,22,w-4,1,C.light);paintWindow(c,Math.round(w*.65),8);
 R(c,0,head,3,h,C.edge);R(c,1,head,1,h,C.light);R(c,w-3,head,3,h,C.edge);R(c,w-2,head,1,h,C.light);
 const y=head;
 if(f.type==='reception'){
  rug(c,37,y+22,51,37,'#985d4c');bookshelf(c,7,y-1,28);table(c,43,y+12,64,21);
  R(c,65,y+16,17,9,'#ecddbd');R(c,67,y+19,11,1,'#ad9974');R(c,67,y+22,8,1,'#ad9974');R(c,87,y+17,7,6,'#876040');R(c,89,y+15,3,3,'#d2bb7d');
  block(c,8,y+31,20,11,C.light);R(c,11,y+43,3,10,C.edge);R(c,24,y+43,3,10,C.edge);plant(c,110,y+45);
 }else if(f.type==='dorm'){
  bed(c,10,y+12,'#91859b');bed(c,79,y+12,'#9aa0a0');table(c,49,y+22,20,15);R(c,55,y+17,6,10,'#d7bb83');R(c,53,y+17,10,3,'#efe2bb');rug(c,45,y+48,29,14,'#9a775b');
 }else if(f.type==='infirmary'){
  bed(c,10,y+12,'#849f8c',true);bookshelf(c,58,y+3,27,true);plant(c,64,y+42);
 }else if(f.type==='kitchen'||f.type==='lounge'){
  bookshelf(c,7,y+1,28);table(c,51,y+25,58,22);R(c,56,y+26,40,16,'#dacfaa');R(c,62,y+32,12,6,'#c09a54');R(c,64,y+31,7,2,'#e2bc73');E(c,86,y+32,4,3,'#e6d8b4');E(c,99,y+35,4,3,'#e6d8b4');
  R(c,51,y+47,57,5,C.edge);block(c,53,y+57,54,7,C.light);brazier(c,8,y+35);plant(c,113,y+7);
 }else if(f.type==='training'){
  rug(c,30,y+17,w-50,43,'#9a8160');dummy(c,17,y+7);dummy(c,w-40,y+10);bookshelf(c,58,y+2,25);R(c,68,y+29,2,23,'#b0b5a4');R(c,64,y+47,10,2,C.oak);R(c,68,y+50,2,7,C.edge);
 }else if(f.type==='workshop'){
  bookshelf(c,7,y+1,w-18);table(c,12,y+26,56,20);R(c,25,y+27,31,4,'#a5a799');P(c,[[28,y+29],[54,y+30],[50,y+38],[32,y+38]],'#616963');R(c,36,y+35,8,8,'#72796a');R(c,57,y+24,3,16,C.edge);R(c,55,y+24,9,4,'#a6aa9a');brazier(c,71,y+42);
 }else if(f.type==='garden'){
  for(let yy=y+14;yy<y+h-4;yy+=20)for(let xx=12;xx<w-10;xx+=23){block(c,xx-3,yy+4,20,9,'#856d43');plant(c,xx,yy);}
 }else if(f.type==='library'){
  bookshelf(c,7,y+1,w-14);table(c,22,y+37,48,21);R(c,30,y+41,24,11,'#e7d8b0');R(c,41,y+41,1,11,C.edge);
 }else{
  rug(c,12,y+19,w-24,h-32,'#907869');table(c,16,y+16,w-32,23);bookshelf(c,7,y+1,w-14);
 }
 // Front wall has a door-sized cut so members have a visible route out.
 const door=Math.floor(w*.5)-11;R(c,0,head+h-3,door,9,C.edge);R(c,door+22,head+h-3,w-door-22,9,C.edge);
 for(const [xx,ww] of [[1,door-1],[door+22,w-door-23]]){
  R(c,xx,head+h-3,ww,2,C.top);R(c,xx,head+h-1,ww,5,'#a9a084');for(let k=xx;k<xx+ww-3;k+=13)R(c,k,head+h,1,4,'#7b755f');R(c,xx,head+h+5,ww,2,'#776b4a');
 }
 R(c,door,head+h-2,22,3,'#d9be8b');R(c,door+1,head+h+2,20,4,C.oak);R(c,door+2,head+h+2,18,1,C.light);
 return {canvas,width:canvas.width,height:canvas.height,footX:0,footY:head};
}
export function makeGround(state){
 const base=window.VillageTerrain.makeTerrain(),{canvas}=base,c=canvas.getContext('2d');
 // A weathered stone/plank circulation strip links the two wings of the guild.
 const fs=state.facilities;if(fs.length){
  const minX=Math.min(...fs.map(f=>f.x)),maxX=Math.max(...fs.map(f=>f.x+FACILITIES[f.type].w));
  const minY=Math.min(...fs.map(f=>f.y)),maxY=Math.max(...fs.map(f=>f.y+FACILITIES[f.type].h));
  const a=gridPoint(minX,minY),b=gridPoint(maxX,maxY);
  R(c,a.x-6,a.y-6,b.x-a.x+12,b.y-a.y+18,'#796f48');R(c,a.x-4,a.y-4,b.x-a.x+8,b.y-a.y+14,'#ad9b68');
  for(let y=a.y;y<b.y+6;y+=7){R(c,a.x-3,y,b.x-a.x+6,6,'#c2a16b');R(c,a.x-3,y,b.x-a.x+6,1,'#d5b880');L(c,a.x-3,y+6,b.x+3,y+6,'#987a4f');}
  // Entrance paths blend out into the same earth colors as the reference study.
  c.lineCap='round';c.strokeStyle='#d5be84';c.lineWidth=24;c.beginPath();c.moveTo(a.x+130,b.y+8);c.bezierCurveTo(a.x+132,b.y+62,480,401,477,422);c.stroke();
  for(let j=0;j<3;j++){R(c,a.x+111-j*3,b.y+8+j*4,42+j*6,4,j%2?C.light:C.oak);R(c,a.x+112-j*3,b.y+8+j*4,40+j*6,1,C.top);}
 }
 return base;
}
export function roomBounds(f){const p=gridPoint(f.x,f.y),d=FACILITIES[f.type];return{x:p.x,y:p.y,w:d.w*CELL_W,h:d.h*CELL_H};}
