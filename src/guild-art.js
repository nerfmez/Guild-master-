import { buildingRect,siteRoads,siteDecorations,partitionRect,partitionDoor } from './site.js';
import { FACILITIES,ROOM_TYPES,VILLAGE_LEVELS } from './content.js';
import { pathTier } from './town.js';
import { drawGuildEmblem } from './guild-emblems.js';

// Original pixel artwork. Every floor and object uses the same 2:1 projection.
const {rect:R,poly:P,line:L,ellipse:E,rng,createCanvas,shade:ArtShade}=window.ArtCore;
export const CELL_W=24;
export const CELL_H=12;
export const ORIGIN_X=500;
export const ORIGIN_Y=80;
export const gridPoint=(x,y)=>({x:ORIGIN_X+(x-y)*CELL_W,y:ORIGIN_Y+(x+y)*CELL_H});
export function gridPosition(x,y){const a=(x-ORIGIN_X)/CELL_W,b=(y-ORIGIN_Y)/CELL_H;return{x:(a+b)/2,y:(b-a)/2};}
export function gridPolygon(x,y,w,h){return [[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([a,b])=>gridPoint(a,b));}
const C={ink:'#695345',edge:'#85634c',wood:'#b98a60',light:'#e5bc87',cream:'#f4e5c9',plaster:'#e0d8bc',stone:'#b8b7a2',green:'#879f73'};
let projection=null;
const q=(x,y,z=0)=>{if(projection){const p=projection;[x,y]=p.r===1?[p.h-y,x]:p.r===2?[p.w-x,p.h-y]:p.r===3?[y,p.w-x]:[x,y];}return[(x-y)*CELL_W,(x+y)*CELL_H-z];};
function face(c,points,color,edge){const p=points.map(v=>q(...v));P(c,p,color);if(edge)for(let i=0;i<p.length;i++)L(c,...p[i],...p[(i+1)%p.length],edge);}
function top(c,x,y,w,h,z,color,edge){face(c,[[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z]],color,edge);}
function cube(c,x,y,w,h,z,height,color=C.wood,light=C.light,dark=C.edge,ink=C.ink){
 const r=projection?.r||0,yy=r===1||r===2?y:y+h,xx=r===2||r===3?x:x+w;
 face(c,[[x,yy,z],[x+w,yy,z],[x+w,yy,z+height],[x,yy,z+height]],color,ink);
 face(c,[[xx,y,z],[xx,y+h,z],[xx,y+h,z+height],[xx,y,z+height]],dark,ink);
 top(c,x,y,w,h,z+height,light,ink);
}

function stroke(c,a,b,color,width=1){L(c,...q(...a),...q(...b),color,width);}
function stamp(width,height,footX,footY,paint){const canvas=createCanvas(width,height),c=canvas.getContext('2d');c.translate(footX,footY);paint(c);return{canvas,width,height,footX,footY};}
function object(paint,width=112,height=104,footX=54,footY=52){return stamp(width,height,footX,footY,paint);}
function plank(c,x,y,w,h,z=0){
 top(c,x,y,w,h,z,'#d4af7e',C.edge);
 for(let yy=y+.23;yy<y+h;yy+=.25){stroke(c,[x,yy,z+.1],[x+w,yy,z+.1],'#b68e64');stroke(c,[x,yy+.04,z+.1],[x+w,yy+.04,z+.1],'#e7c494');}
 for(let xx=x+.8;xx<x+w;xx+=1.0)for(let yy=y;yy<y+h;yy+=.5)stroke(c,[xx+(Math.round(yy*2)%2)*.4,yy,z+.1],[xx+(Math.round(yy*2)%2)*.4,Math.min(y+h,yy+.25),z+.1],'#b28b62');
}
function wall(c,axis,length,height=27){
 const a=axis==='x'?[0,0]:[0,0],b=axis==='x'?[length,0]:[0,length];
 face(c,[[...a,0],[...b,0],[...b,height],[...a,height]],axis==='x'?'#e9ddbd':'#cec8b0',C.edge);
 stroke(c,[...a,height],[...b,height],C.cream,3);stroke(c,[...a,3],[...b,3],'#b89568',3);
 for(let i=0;i<=length;i++){const v=axis==='x'?[i,0]:[0,i];stroke(c,[...v,0],[...v,height],C.edge,2);stroke(c,[...v,2],[...v,height-1],'#d1ae7d');}
 const m=axis==='x'?[length*.15,0]:[0,length*.15],n=axis==='x'?[length*.85,0]:[0,length*.85];
 stroke(c,[...m,5],[...n,height-4],'#baa27f');
}
function windowOn(c,axis){
 const p=(t,z)=>axis==='x'?[t,0,z]:[0,t,z];
 face(c,[p(.18,8),p(.78,8),p(.78,22),p(.18,22)],'#adbbb0',C.edge);
 stroke(c,p(.2,21),p(.75,21),C.cream);stroke(c,p(.3,9),p(.63,20),'#e6ebd4');stroke(c,p(.48,8),p(.48,22),C.edge,2);stroke(c,p(.18,15),p(.78,15),C.light);stroke(c,p(.12,7),p(.85,7),C.light,2);
}
function shelf(c,w=1.4){
 cube(c,0,0,w,.28,0,26,'#a5805d','#d8b68a','#806d58');
 const colors=['#bb7f75','#90a799','#c8b689','#a99eba','#e0cfa6'];
 if(!projection||[0,3].includes(projection.r))for(let z=4;z<25;z+=10){face(c,[[.08,.29,z],[w-.08,.29,z],[w-.08,.29,z+8],[.08,.29,z+8]],'#736252');
  for(let j=0;j<Math.floor(w*7);j++){const x=.12+j*.13;face(c,[[x,.3,z],[x+.085,.3,z],[x+.085,.3,z+6+j%2],[x,.3,z+6+j%2]],colors[j%5]);stroke(c,[x,.3,z+5],[x+.08,.3,z+5],'#e8d8b7');}
  stroke(c,[0,.32,z-1],[w,.32,z-1],C.light,2);
 }
}
function table(c,w=1.6,h=.85){
 top(c,.08,.08,w,h,0,'#8b80635a');for(const [x,y] of [[.1,.1],[w-.13,.1],[.1,h-.13],[w-.13,h-.13]])cube(c,x,y,.1,.1,0,13,'#a5825c','#d5b086','#8e6a4f');
 cube(c,0,0,w,h,13,4,'#ba8c60','#e4bd89','#9a7254');
 for(let yy=.22;yy<h;yy+=.24)stroke(c,[.06,yy,17],[w-.06,yy,17],'#c39b70');
}
function bed(c,color,medical=false){
 cube(c,0,0,.92,1.55,0,6,'#b7966c','#e2c89c','#917358');
 cube(c,.05,.10,.82,1.33,6,5,'#d8d5bd','#f5e7cf','#c6bca1');
 cube(c,.05,.57,.82,.83,11,2,color,color,'#8b968d');top(c,.05,.57,.82,.13,13,'#e6ddcc');
 cube(c,.13,.18,.66,.3,11,3,'#e9deca','#fff1d9','#d9c8aa');
 cube(c,0,0,.92,.12,6,15,'#b38d68','#e6be8f','#927254');
 cube(c,0,1.43,.92,.12,6,6,'#ba946d','#e6bf8c','#967556');
 if(medical){top(c,.38,.87,.20,.07,13.2,'#f2ebd8');top(c,.445,.80,.07,.21,13.3,'#f2ebd8');}
 else for(let y=.76;y<1.32;y+=.22)for(let x=.22;x<.8;x+=.22)top(c,x,y,.045,.045,13.1,'#eee7dd');
}
function rug(c,w,h,color){top(c,0,0,w,h,.2,color,C.edge);top(c,.12,.12,w-.24,h-.24,.3,color,'#e4d2b0');for(let x=.08;x<w;x+=.17){stroke(c,[x,0,.3],[x,-.06,.3],C.cream);stroke(c,[x,h,.3],[x,h+.06,.3],C.cream);}}
function plant(c,flowers=false){
 cube(c,0,0,.32,.32,0,8,'#ba9270','#dfbd8a','#9a7b5c');const [x,y]=q(.16,.16,9);
 P(c,[[x-10,y-3],[x-6,y-8],[x-3,y-6],[x-2,y-14],[x+2,y-11],[x+5,y-6],[x+9,y-8],[x+10,y-2],[x+4,y+1],[x-3,y+1]],'#6d8d6b');P(c,[[x-7,y-5],[x-2,y-8],[x,y-12],[x+2,y-7],[x+7,y-4],[x+1,y-3]],'#a4b98b');
 if(flowers){R(c,x-5,y-9,3,3,'#eab7ae');R(c,x+4,y-7,3,3,'#f4d49a');}
}
function stool(c){cube(c,0,0,.36,.36,0,9,'#b6926f','#ddbc8c','#957758');}
function furnace(c){cube(c,0,0,.65,.65,0,15,'#b2b5a8','#ded6bc','#8c968a');if(!projection||[0,3].includes(projection.r)){face(c,[[.13,.66,4],[.5,.66,4],[.5,.66,12],[.13,.66,12]],'#666b62',C.ink);stroke(c,[.19,.67,5],[.44,.67,8],'#dd9e6b',3);stroke(c,[.25,.67,5],[.37,.67,10],'#f2d595',2);}}
function dummy(c){
 cube(c,0,0,.65,.35,0,2,'#b79a70','#dec194','#8b7156');const[x,y]=q(.32,.18);R(c,x-1,y-26,3,25,C.edge);L(c,x-10,y-18,x+10,y-18,C.edge,3);E(c,x,y-30,6,7,'#a07d57');E(c,x-1,y-32,5,5,'#d4b687');R(c,x-5,y-23,10,8,'#bc9363');R(c,x-4,y-22,8,2,'#e2c89c');
}
export function makeRoom(f){
 const d=FACILITIES[f.type],w=d.w,h=d.h;
 const sprite=object(c=>{const previous=projection;projection={r:f.rotation||0,w,h};try{
  if(f.type==='reception'){table(c,1.95,.9);top(c,.35,.12,.7,.46,17.2,'#f6ead0',C.edge);stroke(c,[.43,.2,17.4],[.89,.2,17.4],'#bba787');cube(c,1.38,.22,.2,.2,17,5);}
  else if(f.type==='bar'){
   // Back wall: two shelves of bottles and a pair of kegs; the bartender works in the gap behind the counter.
   cube(c,.05,0,2.4,.22,0,36,'#7a5a40','#a8805a','#5f4532');
   for(const [z,row] of [[14,0],[25,1]]){top(c,.05,.02,2.4,.2,z,'#b98a60');for(let i=0;i<9;i++){const[x,y]=q(.18+i*.26,.1,z+1);const col=['#7fb0c8','#c98a72','#9fd06a','#e8c070','#b98ad1'][(i+row*2)%5];R(c,x-1,y-8,3,8,col);R(c,x,y-10,1,2,'#5a4a3a');R(c,x-1,y-5,3,1,'#fff7ea');}}
   for(const x of [.25,2.05]){cube(c,x,.28,.32,.3,0,10,'#9a6a46','#c48a5a','#7a5034');const[kx,ky]=q(x+.16,.43,6);R(c,kx-6,ky-1,12,1,'#5a4a3a');}
   // The counter: dark wood front, a light top with taps, mugs and a towel.
   cube(c,.05,.78,2.4,.34,0,15,'#8a5f40','#c9965f','#6b4632');top(c,0,.74,2.5,.42,15,'#d8ab73',C.edge);top(c,0,.74,2.5,.06,15.2,'#e9c48c');
   for(const x of [.7,1.1]){const[tx,ty]=q(x,.86,16);R(c,tx-1,ty-8,2,8,'#b8946a');R(c,tx-3,ty-9,6,2,'#d9b26f');R(c,tx-1,ty-10,2,1,'#fff7ea');}
   for(const x of [1.55,1.85,2.15]){const[mx,my]=q(x,.95,16);R(c,mx-2,my-5,4,5,'#e8d29a');R(c,mx-2,my-6,4,1,'#fff7ea');R(c,mx+2,my-4,1,2,'#c9b077');}
   {const[wx,wy]=q(.35,.98,16);R(c,wx-3,wy-1,6,2,'#f4f1ea');R(c,wx-3,wy,6,1,'#d9584a');}
   // Four stools along the front for the customers.
   for(let i=0;i<4;i++){const x=.35+i*.6,y=1.35;for(const [dx,dy] of [[-.09,-.09],[.05,-.09],[-.09,.05],[.05,.05]])cube(c,x+dx,y+dy,.05,.05,0,10,'#b88d60','#e2c08f','#9a7350',null);cube(c,x-.08,y-.08,.16,.16,4,1,'#c9a074','#f0d6a8','#a8805a','#9a7350');const[sx,sy]=q(x,y,10);E(c,sx,sy+1,8,4,'#6b4a32');E(c,sx,sy,8,4,'#b84a3a');E(c,sx-2,sy-1,3,1,'#d9786a');}
   // A hanging lantern over the counter.
   {const[lx,ly]=q(1.25,.5,44);R(c,lx,ly-12,1,12,'#5a4a3a');R(c,lx-3,ly,7,6,'#5a4a3a');R(c,lx-2,ly+1,5,4,'#ffe08a');}}
  else if(f.type==='dining'){
   // A real table on four turned legs with a cloth runner, plates, bread and a jug; four wooden chairs with backs.
   // Painted back to front: the chairs behind the table first, then the table, then the chairs in front.
   // A round table on a single turned pedestal: a ring of wood, a round cloth, four plates, bread and a jug.
   const tableArt=()=>{const cx=.875,cy=.875,r=.48,z=12,ring=(rad,zz)=>Array.from({length:24},(_,k)=>{const a=k/24*Math.PI*2;return q(cx+Math.cos(a)*rad,cy+Math.sin(a)*rad,zz);});
    P(c,ring(r*.75,0),'#8b80634a');
    cube(c,cx-.05,cy-.05,.1,.1,1,z-1,'#b08458','#e2bb86','#8a6442');P(c,ring(.2,0),'#a87a52');P(c,ring(.16,1),'#c99a68');
    const top0=ring(r,z),top1=ring(r,z+2);P(c,[...top0.slice(0,13),...top1.slice(0,13).reverse()],'#b88a5e');P(c,top1,'#e8c896');for(let k=0;k<24;k++)L(c,...top1[k],...top1[(k+1)%24],'#a87a52');
    P(c,ring(r*.5,z+2.1),'#f6efdf');
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const[px,py]=q(cx+Math.cos(a)*r*.52,cy+Math.sin(a)*r*.52,z+2.3);E(c,px,py,4,2,'#fff7ea');E(c,px,py,2,1,'#e8d2b0');}
    {const[bx,by]=q(cx,cy,z+3);E(c,bx,by-1,5,3,'#b8864a');R(c,bx-3,by-4,2,2,'#e8b46a');R(c,bx+1,by-4,2,2,'#e8b46a');}
    {const[jx,jy]=q(cx+.16,cy-.16,z+3);R(c,jx-2,jy-6,4,6,'#8fb3c9');R(c,jx-2,jy-7,4,1,'#c8e4ef');R(c,jx+2,jy-5,1,3,'#8fb3c9');}};
   const chair=(cx,cy,back)=>{const s2=.15,legs=[[cx-s2,cy-s2],[cx+s2-.06,cy-s2],[cx-s2,cy+s2-.06],[cx+s2-.06,cy+s2-.06]];
    const backArt=()=>{const posts=back==='n'?[[cx-s2,cy-s2],[cx+s2-.06,cy-s2]]:back==='s'?[[cx-s2,cy+s2-.06],[cx+s2-.06,cy+s2-.06]]:back==='w'?[[cx-s2,cy-s2],[cx-s2,cy+s2-.06]]:[[cx+s2-.06,cy-s2],[cx+s2-.06,cy+s2-.06]];
     for(const [x,y] of posts)cube(c,x,y,.06,.06,7,5,'#b88d60','#e2c08f','#9a7350',null);
     const rail=back==='n'||back==='s'?[cx-s2,posts[0][1],s2*2,.06]:[posts[0][0],cy-s2,.06,s2*2];cube(c,rail[0],rail[1],rail[2],rail[3],10.5,2,'#c9a074','#f0d6a8','#a8805a','#9a7350');};
    const seatArt=()=>{for(const [x,y] of legs)cube(c,x,y,.06,.06,0,5.5,'#b88d60','#e2c08f','#9a7350',null);cube(c,cx-s2,cy-s2,s2*2,s2*2,5.5,1.5,'#c9a074','#f0d6a8','#a8805a','#9a7350');top(c,cx-s2+.04,cy-s2+.04,s2*2-.08,s2*2-.08,7.1,'#e07a68');};
    if(back==='n'||back==='w'){backArt();seatArt();}else{seatArt();backArt();}};
   chair(.875,.13,'n');chair(.13,.875,'w');tableArt();chair(1.62,.875,'e');chair(.875,1.62,'s');}
  else if(f.type==='appraisal'){
   // A cloth-covered table with a balance scale, a loupe and a gem being weighed.
   table(c,1.42,.9);top(c,.12,.12,1.18,.62,17.2,'#c9b6d9',C.edge);
   const[x,y]=q(.45,.42,18);R(c,x,y-14,1,14,'#8a6446');L(c,x-8,y-13,x+8,y-13,'#8a6446',2);E(c,x-8,y-9,4,2,'#d9b26f');E(c,x+8,y-10,4,2,'#d9b26f');R(c,x+7,y-13,3,3,'#7fb6d6');
   const[gx,gy]=q(1.05,.4,18);E(c,gx,gy-3,4,4,'#5f5a5a');E(c,gx,gy-3,3,3,'#bfe3f0');L(c,gx+3,gy,gx+7,gy+4,'#8a6446',2);}
  else if(f.type==='dorm')bed(c,'#b5adc9');
  else if(f.type==='infirmary')bed(c,'#a6bfae',true);
  else if(f.type==='kitchen'){furnace(c);cube(c,.67,.1,.3,.64,0,12,'#b99370','#e6c697','#94745a');const[x,y]=q(.35,.3,17);E(c,x,y,6,3,'#8d998f');E(c,x,y-2,4,2,'#d6c7a5');}
  else if(f.type==='training')dummy(c);
  else if(f.type==='workshop'){table(c,1.9,.85);cube(c,.6,.2,.65,.3,17,5,'#929c95','#c5ccc0','#727f78');const[x,y]=q(1.45,.45,18);L(c,x,y,x+6,y-5,C.edge,2);L(c,x+4,y-6,x+9,y-3,'#9da99f',3);}
  else if(f.type==='library')shelf(c,1.92);
  else if(f.type==='lounge'){table(c,1.8,.8);top(c,.2,.1,1.3,.5,17.2,'#f1e5ce');for(const[x,y]of[[.4,.3],[1.3,.3]]){const[a,b]=q(x,y,18);E(c,a,b,4,2,'#e9d5b0');}cube(c,.2,1.05,1.5,.25,0,8);}
  else if(f.type==='dispatch'){table(c,1.9,.9);top(c,.22,.14,1.36,.57,17.3,'#c8d7bd',C.edge);stroke(c,[.35,.2,17.4],[1.4,.6,17.4],'#8aa5a2');cube(c,1.5,.22,.14,.14,17.4,5);}
  else if(f.type==='board'){
   for(const x of [.08,.84])cube(c,x,.2,.08,.08,0,34,'#8f6a4c','#b98a60','#6f5240');
   const at=(u,z)=>[u,.3,z];face(c,[at(.02,12),at(.98,12),at(.98,33),at(.02,33)],'#7c5d45',C.ink);face(c,[at(.07,14),at(.93,14),at(.93,31),at(.07,31)],'#c99c68');
   for(let k=0;k<4;k++){const u=.11+k*.205,z=k%2?15:21;face(c,[at(u,z),at(u+.16,z),at(u+.16,z+8),at(u,z+8)],k===2?'#f2dfb4':'#f8eedb',C.edge);stroke(c,at(u+.03,z+5),at(u+.13,z+5),'#b8a487');stroke(c,at(u+.03,z+3),at(u+.11,z+3),'#b8a487');const[px,py]=q(...at(u+.08,z+7));R(c,px,py,2,2,['#d98978','#6f9ad1','#7fae6f','#e2a93c'][k]);}
   cube(c,-.03,.14,1.06,.3,33,3,'#a8775a','#c98a72','#87543f');
  }
  else if(f.type==='garden'){for(let y=.08;y<1.7;y+=.85){cube(c,.05,y,1.85,.65,0,4,'#a88d6c','#c4b08e','#8f7b61');for(let x=.2;x<1.8;x+=.34){const[a,b]=q(x,y+.3,7);P(c,[[a-4,b],[a-3,b-5],[a,b-3],[a+2,b-8],[a+5,b-3],[a+3,b+1]],'#82a078');R(c,a-1,b-6,3,2,'#d9c2a0');}}}
 }finally{projection=previous;}});
 return{layers:[{name:'furniture',x:0,y:0,sort:(w+h)*6,sprite}]};
}
export function makeBuilding(state){
 const b=buildingRect(state),w=b.w,h=b.h,layers=[];
 const add=(name,x,y,sprite,sort)=>layers.push({name,x:b.x+x,y:b.y+y,sort,sprite});
 add('floor',0,0,stamp((w+h)*24+12,(w+h)*12+20,h*24+6,5,c=>{cube(c,0,0,w,h,-7,7,'#b7aa8e','#d9bd93','#968b76');plank(c,0,0,w,h);}),-9600);
 add('carpet',2.6,2.3,object(c=>rug(c,2.2,1.5,'#c0b3a3'),128,110,65,46),-9500);
 for(let x=0;x<w;x++)add('back-x-'+x,x,0,object(c=>{wall(c,'x',1,34);if(x%3===1)windowOn(c,'x');}),6);
 for(let y=0;y<h;y++)add('back-y-'+y,0,y,object(c=>{wall(c,'y',1,34);if(y%3===1)windowOn(c,'y');}),6);
 for(let x=0;x<w;x++)if(Math.abs(x+.5-w/2)>.75)add('cut-x-'+x,x,h,object(c=>wall(c,'x',1,6)),6);
 for(let y=0;y<h;y++)add('cut-y-'+y,w,y,object(c=>wall(c,'y',1,6)),6);
 add('entrance',w/2-.75,h,object(c=>{cube(c,0,0,1.5,.38,-3,3,'#ae9e82','#dac49e','#8f8b76');cube(c,0,.38,1.5,.34,-6,3,'#a99b7f','#d6c09c','#908c76');}),8);
 for(const part of layers){
  const axis=part.name.startsWith('back-x-')?'x':part.name.startsWith('back-y-')?'y':null,index=Number(part.name.split('-').at(-1));
  if(axis&&index%3===1){const at=(t,z)=>axis==='x'?[t,0,z]:[0,t,z];part.sprite.nightLights=[{points:[at(.18,8),at(.78,8),at(.78,22),at(.18,22)].map(v=>q(...v)),colors:['#adbbb0','#e6ebd4']}];}
  if(part.name==='entrance')part.sprite.nightLights=[{kind:'lamp',x:q(.05,0,12)[0],y:q(.05,0,12)[1]},{kind:'spill',x:q(.75,-.4,0)[0],y:q(.75,-.4,0)[1],radius:44}];
  if(part.name==='floor')part.sprite.nightLights=[{kind:'spill',x:q(w/2,h/2,0)[0],y:q(w/2,h/2,0)[1],radius:48}];
 }
 return{layers};
}
export function makePartition(room,state){
 const a=partitionRect(room),b=buildingRect(state),w=a.w,h=a.h,door=partitionDoor(room),layers=[];
 const add=(name,x,y,sprite,sort)=>layers.push({name,x:a.x+x,y:a.y+y,sort,sprite});
 add('floor',0,0,stamp((w+h)*24+12,(w+h)*12+12,h*24+6,5,c=>{
  top(c,0,0,w,h,.15,ROOM_TYPES[room.type].color,C.edge);
  for(let yy=.25;yy<h;yy+=.25){stroke(c,[.04,yy,.2],[w-.04,yy,.2],'#c0a585');stroke(c,[.04,yy+.04,.2],[w-.04,Math.min(h-.04,yy+.04),.2],'#e8d5b5');}
 }),-9400);
 const sides=[{name:'north',axis:'x',x:0,y:0,span:w,height:23,skip:a.y===b.y},
 {name:'west',axis:'y',x:0,y:0,span:h,height:23,skip:a.x===b.x},
 {name:'south',axis:'x',x:0,y:h,span:w,height:7,skip:a.y+h===b.y+b.h},
 {name:'east',axis:'y',x:w,y:0,span:h,height:7,skip:a.x+w===b.x+b.w}];
 for(const side of sides){if(side.skip)continue;const doorSide=['south','west','north','east'][room.rotation||0]===side.name,center=side.span/2;
  const cuts=[0,side.span];for(let t=1;t<side.span;t++)cuts.push(t);if(doorSide)cuts.push(center-door.width/2,center+door.width/2);cuts.sort((a,b)=>a-b);
  for(let i=0;i<cuts.length-1;i++){const start=cuts[i],end=cuts[i+1];if(end-start<.01||doorSide&&Math.abs((start+end)/2-center)<door.width/2)continue;
   const x=side.x+(side.axis==='x'?start:0),y=side.y+(side.axis==='y'?start:0);add(side.name+'-'+i,x,y,object(c=>wall(c,side.axis,end-start,side.height)),(end-start)*6);
  }
 }
 return{layers};
}
/** Dense points along a Catmull-Rom curve through control points, about every 0.15 tiles. */
export function curvePoints(pts){const out=[],p=i=>pts[Math.max(0,Math.min(pts.length-1,i))];
 for(let i=0;i<pts.length-1;i++){const steps=Math.max(2,Math.ceil(Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1])/.15));
  for(let s=0;s<steps;s++){const t=s/steps,[p0,p1,p2,p3]=[p(i-1),p(i),p(i+1),p(i+2)],f=k=>.5*(2*p1[k]+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t);out.push([f(0),f(1)]);}}
 out.push(pts[pts.length-1]);return out;}
/** Footpaths the village grew by itself: a trodden trail, then a dirt road, then cobbles in a town. */
function paintPaths(c,state,r){const pr=state.village?.prosperity||0,level=VILLAGE_LEVELS.reduce((l,v)=>pr>=v.prosperity?v.level:l,1);
 const paths=Object.values(state.village?.paths||{}).filter(p=>p.pts?.length>1).map(p=>({tier:pathTier(p.wear,level),pts:curvePoints(p.pts)}));
 const W={trail:.26,dirt:.38,cobble:.44};
 for(const pass of [0,1])for(const p of paths){const hw=W[p.tier];for(const[x,y]of p.pts){const[a,b]=q(x,y);
  if(pass===0){E(c,a,b,hw*26+2,hw*13+1.5,p.tier==='cobble'?'#9fa088':p.tier==='dirt'?'#a8926a':'#93a06f');continue;}
  if(p.tier==='trail'){if(r()<.3)continue;E(c,a+(r()-.5)*3,b+(r()-.5)*1.5,hw*26*(.6+r()*.5),hw*13*(.6+r()*.5),r()>.5?'#c2ad7f':'#b5a476');continue;}
  E(c,a,b,hw*26,hw*13,p.tier==='cobble'?(r()>.5?'#d1c8ab':'#c4bea4'):(r()>.5?'#d4bb8c':'#cbb184'));
  if(p.tier==='cobble'&&r()<.5)R(c,a+(r()-.5)*hw*40,b+(r()-.5)*hw*18,2,1,r()>.5?'#e6ddc2':'#b4b39c');
  else if(p.tier==='dirt'&&r()<.2)R(c,a+(r()-.5)*hw*40,b+(r()-.5)*hw*18,2,1,'#b8ab8b');}}}
function contains(rect,x,y){return x>=rect.x&&x<rect.x+rect.w&&y>=rect.y&&y<rect.y+rect.h;}
export function makeGround(state){
 const canvas=createCanvas(1200,900),c=canvas.getContext('2d'),r=rng(730);
 R(c,0,0,1200,900,'#9cac7d');
 for(let i=0;i<2000;i++){const x=r()*1200,y=r()*900;E(c,x,y,5+r()*18,2+r()*6,i%3?'#97a776':'#a8b586');}
 for(let i=0;i<6000;i++){const x=r()*1200,y=r()*900;R(c,x,y,1+r()*3,1,i%5===0?'#c2ca9a':'#8fa477');if(i%31===0){R(c,x,y-2,1,3,'#879b6b');R(c,x+2,y-1,1,2,'#b9c68d');}}
 const roads=siteRoads(state),roadAt=(x,y)=>roads.find(p=>contains(p,x,y));
 c.save();c.translate(ORIGIN_X,ORIGIN_Y);
 paintPaths(c,state,r);
 for(const road of roads)top(c,road.x,road.y,road.w,road.h,-1,'#aaa78c');
 c.save();c.beginPath();for(const road of roads){for(const[i,[x,y]]of [[road.x,road.y],[road.x+road.w,road.y],[road.x+road.w,road.y+road.h],[road.x,road.y+road.h]].entries()){const[a,b]=q(x,y);if(i)c.lineTo(a,b);else c.moveTo(a,b);}c.closePath();}c.clip();
 // Shared road union: curbs are only drawn on the outer edge, never across a junction.
 for(let y=-12;y<30;y+=.5)for(let x=-12;x<42;x+=.5){const road=roadAt(x+.25,y+.25);if(!road)continue;
  if(road.kind==='stone'){
   top(c,x+.025,y+.025,.45,.45,0,r()>.5?'#d1c8ab':'#c4bea4');stroke(c,[x+.045,y+.05,.1],[x+.42,y+.05,.1],'#e6ddc2');stroke(c,[x+.45,y+.05,.1],[x+.45,y+.44,.1],'#a9aa93');
   if(r()<.14)stroke(c,[x+.08,y+.28,.2],[x+.28,y+.12,.2],'#b4b39c');
  }else{
   top(c,x,y,.5,.5,0,r()>.5?'#d9c5a1':'#deccab');if(r()<.3){const[a,b]=q(x+.1+r()*.3,y+.1+r()*.3);R(c,a,b,2,1,'#b8ab8b');}
  }
  for(const[dx,dy,a,b]of[[.5,0,[x+.5,y],[x+.5,y+.5]],[-.5,0,[x,y],[x,y+.5]],[0,.5,[x,y+.5],[x+.5,y+.5]],[0,-.5,[x,y],[x+.5,y]]])if(!roadAt(x+.25+dx,y+.25+dy)){stroke(c,[...a,-1],[...b,-1],'#969b7b',2);stroke(c,[...a,0],[...b,0],'#d4d0ad');}
 }
 c.restore();
 // Empty plot corners mark future space without filling it with immovable decorations.
 for(const[x,y]of[[.25,.25],[state.grid.width-.25,.25],[.25,state.grid.height-.25],[state.grid.width-.25,state.grid.height-.25]]){
  const[a,b]=q(x,y);R(c,a-1,b-8,3,9,'#aa9673');R(c,a-1,b-8,3,2,'#e0c9a0');
 }
 c.restore();
 // Fade the village ground's edges so it melts into the world floor around it.
 c.save();c.globalCompositeOperation='destination-in';c.translate(548,300);c.scale(1,.55);const fade=c.createRadialGradient(0,0,330,0,0,560);fade.addColorStop(0,'rgba(0,0,0,1)');fade.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=fade;c.fillRect(-700,-900,1400,1800);c.restore();
 return{canvas};
}

export function makeCottage({roof='#8fa0b1',seed=1}={}){
 return stamp(170,166,78,92,c=>{
  const w=2.6,h=2.5,z=35;top(c,.1,.2,w+.3,h+.3,0,'#7f917048');cube(c,0,0,w,h,0,z,'#e0cdaa','#f0e1be','#c0bda0');
  for(let t=0;t<2.6;t+=.5){stroke(c,[t,h,0],[t,h,35],C.edge,2);stroke(c,[w,t,0],[w,t,35],C.edge,2);}stroke(c,[0,h,7],[w,h,7],'#afaa8b',3);stroke(c,[w,0,7],[w,h,7],'#a2a58b',3);
  const door=[[1.0,h,0],[1.55,h,0],[1.55,h,25],[1.0,h,25]];face(c,door,'#ae8d6a',C.edge);stroke(c,[1.07,h,1],[1.07,h,24],C.light);const[dx,dy]=q(1.43,h,13);R(c,dx,dy,2,2,'#e9cd8f');
  for(const x of [.25,1.95]){face(c,[[x,h,14],[x+.4,h,14],[x+.4,h,25],[x,h,25]],'#a5c0b8',C.edge);stroke(c,[x+.2,h,14],[x+.2,h,25],C.light);stroke(c,[x,h,19],[x+.4,h,19],C.light);}
  face(c,[[w,.5,16],[w,1.1,16],[w,1.1,27],[w,.5,27]],'#acc3bb',C.edge);stroke(c,[w,.8,16],[w,.8,27],C.light);
  // Two roof planes and a gable. Roof shingles follow the projected axes.
  const peak=z+27;
  face(c,[[-.13,-.15,z],[w/2,-.15,peak],[w/2,h+.18,peak],[-.13,h+.18,z]],roof,C.ink);
  face(c,[[w/2,-.15,peak],[w+.13,-.15,z],[w+.13,h+.18,z],[w/2,h+.18,peak]],'#728a9c',C.ink);
  for(let x=.05;x<w/2;x+=.23){const zz=z+(x+.13)/(w/2+.13)*27;stroke(c,[x,-.15,zz],[x,h+.18,zz],'#b3bfca');}
  for(let x=w/2+.18;x<w+.13;x+=.23){const zz=peak-(x-w/2)/(w/2+.13)*27;stroke(c,[x,-.15,zz],[x,h+.18,zz],'#8ba4b1');}
  for(let y=.1;y<h+.18;y+=.33){stroke(c,[-.1,y,z+1],[w/2,y,peak],'#7d92a4');stroke(c,[w/2,y,peak],[w+.1,y,z+1],'#657f94');}
  face(c,[[0,h+.19,z],[w/2,h+.19,peak-2],[w,h+.19,z]],'#e5d5b0',C.edge);stroke(c,[w/2,h+.19,z],[w/2,h+.19,peak-2],C.edge,2);stroke(c,[0,h+.19,z],[w,h+.19,z],C.light,2);
  cube(c,.87,h+.02,.84,.42,0,3,'#b2a283','#d5c4a0','#938e77');
  const r=rng(seed);for(let i=0;i<8;i++){const[x,y]=q(.12+i*.32,h+.7);R(c,x,y-2,2,2,r()>.5?'#ebc6ac':'#dcd799');}
 });
}
// Village homes: one generator, many characters. A spec picks the footprint, walls, roof and the touches that make a home its own.
const ROOFS={slate:['#8fa0b1','#728a9c','#b3bfca','#5f7488'],dusk:['#7f8796','#646c7c','#9aa2b0','#525866'],terra:['#c98a72','#a86c58','#e0a88e','#87543f'],moss:['#93a679','#768c62','#b0c193','#5f7350'],thatch:['#d9bc78','#b99a55','#ecd59a','#987b42'],plum:['#a39bb8','#857d9c','#c0b9d2','#6a6382'],shingle:['#ad8160','#8f664a','#c99d78','#6f4f38']};
const WALLS={plaster:['#ecdfbf','#cdc1a2'],stone:['#c6bfab','#a59e8b'],log:['#c08f63','#9a714c'],brick:['#cf9576','#a9735d'],timber:['#efe3c4','#cbbf9f']};
export const HOME_STYLES={
 inn:{w:2.6,h:2.5,z:52,ridge:'x',roof:'terra',wall:'plaster',storeys:2,sign:'mug',chimney:[.5,.6],lantern:true,porch:true},
 bakery:{w:2.6,h:2.3,z:31,ridge:'x',roof:'terra',wall:'timber',awning:['#d77d6a','#f4e5c9'],sign:'bread',chimney:[2,.5]},
 stone:{w:2.4,h:2.4,z:50,ridge:'y',roof:'slate',wall:'stone',storeys:2,chimney:[.4,1.6],flowers:true},
 cabin:{w:2.4,h:2.2,z:28,ridge:'y',roof:'shingle',wall:'log',porch:true,chimney:[1.9,.5],woodpile:true},
 thatch:{w:2.2,h:2,z:26,ridge:'x',roof:'thatch',wall:'plaster',pitch:32,shutters:'#7f9a8a',flowers:true},
 smithy:{w:2.6,h:2.3,z:30,ridge:'y',roof:'dusk',wall:'stone',forge:true,sign:'anvil',chimney:[.45,.5],smoke:'dark'},
 brick:{w:2.6,h:2.2,z:32,ridge:'x',roof:'moss',wall:'brick',shutters:'#6f8fb0',chimney:[2.1,.6],dormer:true},
 tall:{w:2,h:2,z:56,ridge:'y',roof:'plum',wall:'timber',storeys:2,pitch:30,flowers:true,shutters:'#c98a72'},
 dojo:{w:2.8,h:2.4,z:30,ridge:'x',roof:'dusk',wall:'timber',sign:'sword',porch:true,lantern:true,shutters:'#8a6a4a'},
 tannery:{w:2.6,h:2.3,z:30,ridge:'y',roof:'shingle',wall:'log',sign:'hide',chimney:[.5,.5],woodpile:true,porch:true},
 apothecary:{w:2.4,h:2.3,z:34,ridge:'x',roof:'plum',wall:'plaster',awning:['#8fb3c9','#f4e5c9'],sign:'potion',chimney:[1.9,.5],flowers:true},
 jeweler:{w:2.4,h:2.2,z:36,ridge:'y',roof:'slate',wall:'stone',sign:'gem',shutters:'#6f8fb0',lantern:true},
 caravan:{w:2.8,h:2.4,z:30,ridge:'x',roof:'terra',wall:'timber',sign:'cart',porch:true,woodpile:true,lantern:true},
 auction:{w:2.6,h:2.5,z:56,ridge:'x',roof:'plum',wall:'stone',storeys:2,sign:'gem',lantern:true,porch:true,shutters:'#c98a72'},
 clinic:{w:2.6,h:2.4,z:36,ridge:'x',roof:'slate',wall:'plaster',awning:['#f4f1ea','#d9584a'],sign:'cross',chimney:[2.1,.5],flowers:true,lantern:true},
 store:{w:2.6,h:2.3,z:32,ridge:'x',roof:'moss',wall:'timber',awning:['#7fa37a','#f4e5c9'],sign:'bag',chimney:[2.1,.5],flowers:true},
};
/** The arena where the guild association holds rank exams: a sand ring with a fence, banners and, as it grows, stands. */
export function makeArena(level=1){
 // The guild association's exam ground: a ringed sand floor, stands for onlookers, a judge's podium and practice targets.
 const w=4.2,h=3.4;
 return stamp(240,200,104,112,c=>{
  top(c,-.2,-.2,w+.4,h+.4,0,'#5f705040');
  top(c,0,0,w,h,0,'#bdb5a3',C.edge);top(c,.25,.25,w-.5,h-.5,.5,'#e3cfa6','#c9b088');
  for(let x=.3;x<w-.2;x+=.6)for(let y=.3;y<h-.2;y+=.6){const[px,py]=q(x+((y*7)%.3),y,.6);R(c,px,py,2,1,'#d4bf96');}
  // Painted ring in the middle of the floor.
  for(let k=0;k<24;k++){const a=k/24*Math.PI*2,b2=(k+1)/24*Math.PI*2;stroke(c,[w/2+Math.cos(a)*1.1,h/2+.2+Math.sin(a)*.9,.6],[w/2+Math.cos(b2)*1.1,h/2+.2+Math.sin(b2)*.9,.6],'#fff4dc');}
  // Stands along the back two sides, with onlookers once the arena grows.
  const tiers=level>=2?3:2;
  for(let t=0;t<tiers;t++){cube(c,-.6-t*.32,-.6,.32,h+.4,0,6+t*6,'#a88d6c','#c9b08e','#8f7b61');cube(c,-.6,-.6-t*.32,w+.4,.32,0,6+t*6,'#a88d6c','#c9b08e','#8f7b61');}
  if(level>=2)for(let k=0;k<10;k++){const onBack=k%2,[px,py]=onBack?q(.3+k*.38,-.75-((k>>1)%2)*.3,14+((k>>1)%2)*6):q(-.75-((k>>1)%2)*.3,.3+k*.3,14+((k>>1)%2)*6);R(c,px-1,py-6,3,4,['#d98978','#8fa0b1','#e8b04a','#7fae5a'][k%4]);E(c,px,py-8,1.5,1.5,'#f7d4ae');}
  // Gate arch at the front-left with the association's banner.
  const[gx,gy]=q(.2,h+.05,0),[hx,hy]=q(1.2,h+.05,0);R(c,gx-2,gy-30,4,30,'#8a8f88');R(c,hx-2,hy-30,4,30,'#8a8f88');L(c,gx,gy-30,hx,hy-30,'#6b4f3a',4);
  {const[mx,my]=q(.7,h+.05,26);R(c,mx-6,my-2,12,14,'#b85a4a');R(c,mx-6,my-2,12,2,'#d9806e');R(c,mx-2,my+2,4,4,'#f4e5c9');R(c,mx-1,my+7,2,3,'#f4e5c9');}
  // Judge's podium with a flag, two practice targets.
  cube(c,w-.9,.2,.6,.5,0,12,'#8a6446','#b08a68','#6b4f3a');{const[fx,fy]=q(w-.6,.45,12);R(c,fx,fy-22,1,22,'#5a3f30');R(c,fx+1,fy-22,8,5,'#6f9ad1');E(c,fx-3,fy-4,2,2,'#f7d4ae');R(c,fx-5,fy-2,5,4,'#5a4a6a');}
  for(const[x,y]of[[w-.6,h-.8],[w-1.3,h-.5]]){const[px,py]=q(x,y,.6);R(c,px-1,py-14,2,14,'#6b4f3a');E(c,px,py-17,5,5,'#efe6d2');E(c,px,py-17,3.5,3.5,'#d9584a');E(c,px,py-17,2,2,'#efe6d2');E(c,px,py-17,.8,.8,'#d9584a');}
  if(level>=3)for(const[x,y]of[[w,0],[w,h],[0,h]]){const[px,py]=q(x,y,0);R(c,px-2,py-16,4,16,'#8a8f88');E(c,px,py-18,3,2,'#f4b860');E(c,px,py-20,1.5,2,'#fff1c4');}
 });
}
export function makeStall(seed=1,variant=0){
 // Each stall sells something different: produce, cloth and pots, or herbs and potions.
 const [a,b]=[['#d77d6a','#f4e5c9'],['#7fa37a','#f4e5c9'],['#6f9ad1','#f4e5c9']][variant%3];
 return object(c=>{
  top(c,-.15,-.1,2.1,1.6,0,'#5f705040');
  for(const [x,y] of [[0,0],[1.72,0]])cube(c,x,y,.08,.08,0,38,'#8f6a4c','#b98a60','#6f5240');
  cube(c,.05,.05,1.7,.4,0,10,'#a88d6c','#c4b08e','#8f7b61');
  cube(c,0,.6,1.8,.55,0,13,'#b98a60','#e5bc87','#85634c');stroke(c,[0,1.15,6],[1.8,1.15,6],'#85634c');
  const ware=(k,x,y)=>{const[px,py]=q(x,y,14);
   if(variant%3===0){if(k%3===0){E(c,px,py-2,4,3,'#d9853e');R(c,px,py-6,1,2,'#6f8a52');}else if(k%3===1){for(const[dx,dy]of[[-2,0],[2,0],[0,-2]]){E(c,px+dx,py+dy-1,2,2,'#d8604f');R(c,px+dx,py+dy-2,1,1,'#f09a86');}}else{E(c,px,py-2,3.5,2.5,'#7fae5a');E(c,px,py-3,2,1.5,'#a8cc90');}}
   else if(variant%3===1){if(k%2){R(c,px-4,py-4,8,4,['#c98a72','#8fa0b1','#d6b072'][k%3]);R(c,px-4,py-4,8,1,'#fff3e0');}else{E(c,px,py-3,3,3,'#b07a55');R(c,px-1,py-7,2,2,'#8a5a3e');R(c,px-2,py-3,4,1,'#d8a07a');}}
   else{R(c,px-1,py-5,3,5,['#7fd0c4','#d9584a','#b98ad1','#e8b04a'][k%4]);R(c,px,py-6,1,1,'#ffffff');R(c,px+3,py-2,3,2,'#6f9a62');}};
  for(let k=0;k<6;k++)ware(k,.18+k*.27,.82+(k%2)*.12);
  // Striped canopy sloping toward the front.
  for(let k=0;k<7;k++){const u0=-.1+k*.29;face(c,[[u0,-.15,40],[u0+.29,-.15,40],[u0+.29,.55,33],[u0,.55,33]],k%2?b:a);}
  for(let k=0;k<7;k++){const[px,py]=q(-.1+k*.29+.145,.55,33);E(c,px,py+1,4,2,k%2?b:a);}
  stroke(c,[-.1,.55,33],[1.93,.55,33],C.ink);
  // A crate and a basket at the stall's foot.
  cube(c,1.9,.9,.35,.35,0,7,'#b58b64','#d0a87d','#8a6446');const[bx,by]=q(-.2,1.25,0);E(c,bx,by-3,5,3,'#c9a77f');E(c,bx,by-5,4,2,'#9fc27a');
 },150,120,64,56);
}
export function makeHome(name,seed=1){
 const s=HOME_STYLES[name]||HOME_STYLES.thatch,{w,h,z,ridge,storeys=1}=s,pitch=s.pitch||(ridge==='y'?w:h)*11,o=.16,[r0,r1,rl,rk]=ROOFS[s.roof],[w0,w1]=WALLS[s.wall],r=rng(seed),peak=z+pitch;
 let smoke=null;const nightLights=[];const footX=Math.ceil(h*24)+30,footY=peak+40,result=stamp(Math.ceil((w+h)*24)+60+(s.forge?40:0),footY+Math.ceil((w+h)*12)+30,footX,footY,c=>{
  const F=(u,zz)=>[u,h,zz],S=(u,zz)=>[w,u,zz],quad=(at,u0,u1,z0,z1,color,edge)=>face(c,[at(u0,z0),at(u1,z0),at(u1,z1),at(u0,z1)],color,edge);
  top(c,-.1,.1,w+.45,h+.4,0,'#5f705040');
  if(s.porch)plank(c,ridge==='x'?.2:.2,h,ridge==='x'?w-.4:w-.4,.55,0);
  // Walls with their own material.
  quad(F,0,w,0,z,w0,C.ink);quad(S,0,h,0,z,w1,C.ink);
  for(const [at,len,col] of [[F,w,w0],[S,h,w1]]){
   const dark=ArtShade(col,-26),light=ArtShade(col,14);
   if(s.wall==='stone')for(let zz=5,k=0;zz<z;zz+=6,k++){stroke(c,at(0,zz),at(len,zz),dark);for(let u=(k%2)*.25+.12;u<len;u+=.5)stroke(c,at(u,zz),at(u,Math.min(z,zz+6)),dark);stroke(c,at(0,zz+1),at(len,zz+1),light);}
   else if(s.wall==='log')for(let zz=4;zz<z;zz+=5){stroke(c,at(0,zz),at(len,zz),dark);stroke(c,at(0,zz+2),at(len,zz+2),light);}
   else if(s.wall==='brick')for(let zz=3,k=0;zz<z;zz+=3,k++){stroke(c,at(0,zz),at(len,zz),light);if(k%2)for(let u=.15;u<len;u+=.3)stroke(c,at(u,zz),at(u,zz+3),dark);}
   else{quad(at,0,len,0,5,ArtShade(col,-40));stroke(c,at(0,5),at(len,5),C.edge,2);}
   if(s.wall==='timber'||s.wall==='plaster'){for(const u of [0,len])stroke(c,at(u,0),at(u,z),C.edge,3);stroke(c,at(0,z-1),at(len,z-1),C.edge,3);}
   if(s.wall==='timber'){for(let u=len/3;u<len-.1;u+=len/3)stroke(c,at(u,5),at(u,z),C.edge,2);stroke(c,at(.1,6),at(len/3-.05,z/(storeys)-3),C.edge,2);stroke(c,at(len-.1,6),at(len*2/3+.05,z/storeys-3),C.edge,2);}
   if(storeys>1){stroke(c,at(0,z/2),at(len,z/2),C.ink,3);stroke(c,at(0,z/2+2),at(len,z/2+2),C.light);}
   if(s.wall==='log'){const [ex,ey]=q(...at(len,0));for(let zz=4;zz<z;zz+=5)E(c,ex+(at===F?0:0),ey-zz-1,2,2,'#d9b083');}
  }
  // Windows, door, shutters and flower boxes.
  const win=(at,u,zb,ww,wh,lit)=>{
   nightLights.push({points:[at(u+.05,zb+2),at(u+ww-.05,zb+2),at(u+ww-.05,zb+wh-2),at(u+.05,zb+wh-2)].map(v=>q(...v)),colors:['#a5c0b8','#f0d79a','#e6f2ee']});
   if(s.shutters){quad(at,u-.16,u,zb,zb+wh,s.shutters,C.ink);quad(at,u+ww,u+ww+.16,zb,zb+wh,s.shutters,C.ink);}
   quad(at,u,u+ww,zb,zb+wh,'#7a5f4a');quad(at,u+.05,u+ww-.05,zb+2,zb+wh-2,lit?'#f0d79a':'#a5c0b8');stroke(c,at(u+ww/2,zb+2),at(u+ww/2,zb+wh-2),C.light);stroke(c,at(u+.05,zb+wh/2),at(u+ww-.05,zb+wh/2),C.light);
   if(!lit)stroke(c,at(u+.1,zb+wh-4),at(u+.2,zb+wh-3),'#e6f2ee');
   if(s.flowers&&zb<z*.6){quad(at,u-.05,u+ww+.05,zb-3,zb,'#9a7a5c',C.ink);for(let k=0;k<4;k++){const [fx,fy]=q(...at(u+.04+k*ww/3.5,zb+1));R(c,fx,fy-2,2,2,['#ebc6ac','#f2b8c8','#f4d070','#d8c4ef'][(k+seed)%4]);R(c,fx-1,fy,3,1,'#7d9a64');}}
  };
  const levels=storeys>1?[6,z/2+6]:[Math.round(z*.35)];
  const doorU=s.awning?w/2-.3:w*.62,doorW=s.porch&&name==='inn'?.75:.55;
  for(const zb of levels){const wh=Math.min(15,Math.round(z/storeys*.45));
   if(zb===levels[0]){quad(F,doorU,doorU+doorW,0,Math.min(25,z/storeys-3),'#7a5f4a',C.ink);quad(F,doorU+.05,doorU+doorW-.05,0,Math.min(23,z/storeys-5),r()>.5?'#ae8d6a':'#9a7656');const [dx,dy]=q(...F(doorU+doorW-.12,11));R(c,dx,dy,2,2,'#e9cd8f');
    win(F,doorU>1?.25:doorU+doorW+.35,zb,.42,wh,name==='inn');if(w>2.5&&doorU>1.2)win(F,.85,zb,.42,wh);}
   else{win(F,.3,zb,.42,wh,name==='inn');win(F,w-.75,zb,.42,wh);}
   win(S,h*.5-.2,zb,.42,wh,zb>z/2&&name!=='inn');
  }
  if(s.awning){const [a,b]=s.awning,zA=Math.min(26,z-3);for(let k=0;k<6;k++){const u0=doorU-.45+k*.25;face(c,[F(u0,zA),F(u0+.25,zA),[u0+.25,h+.45,zA-9],[u0,h+.45,zA-9]],k%2?b:a);}stroke(c,F(doorU-.45,zA),F(doorU+1.05,zA),C.ink);stroke(c,[doorU-.45,h+.45,zA-9],[doorU+1.05,h+.45,zA-9],C.edge,2);
   cube(c,doorU+1.15,h+.1,.5,.32,0,8,'#c79b6a','#e8c99a','#a3805a');for(let k=0;k<3;k++){const [bx,by]=q(doorU+1.25+k*.13,h+.25,9);E(c,bx,by-1,2.4,1.6,'#d9a05a');}}
  if(s.porch){const roofZ=Math.min(26,z/storeys+(storeys>1?0:-4));for(const u of [.25,w-.25])stroke(c,[u,h+.5,0],[u,h+.5,roofZ],C.edge,2);face(c,[F(.1,roofZ+6),F(w-.1,roofZ+6),[w-.1,h+.62,roofZ],[.1,h+.62,roofZ]],r1,C.ink);for(let u=.3;u<w-.1;u+=.28)stroke(c,F(u,roofZ+6),[u,h+.62,roofZ],rk);}
  // Roof: two planes, darker on the side away from the light, with courses following the slope.
  const thatch=s.roof==='thatch';
  if(ridge==='y'){
   face(c,[[-o,-o,z],[w/2,-o,peak],[w/2,h+o,peak],[-o,h+o,z]],r0,C.ink);face(c,[[w/2,-o,peak],[w+o,-o,z],[w+o,h+o,z],[w/2,h+o,peak]],r1,C.ink);
   for(let y=.1;y<h+o;y+=thatch?.17:.3){stroke(c,[-o+.05,y,z+1],[w/2,y,peak],thatch?rl:rk);stroke(c,[w/2,y,peak],[w+o-.05,y,z+1],rk);}
   for(let k=1;k<4;k++){const f=k/4;stroke(c,[-o+(w/2+o)*f,-o,z+pitch*f],[-o+(w/2+o)*f,h+o,z+pitch*f],rl);}
   face(c,[F(0,z),[w/2,h+.01,peak-3],F(w,z)].map(p=>[p[0],h+o+.01,p[2]]),w0,C.ink);stroke(c,[-o,h+o,z],[w/2,h+o,peak],C.ink,3);stroke(c,[w/2,h+o,peak],[w+o,h+o,z],C.ink,3);stroke(c,[-o,h+o+.02,z+1],[w/2,h+o+.02,peak+1],rl,1);
   if(storeys===1||true){const zb=z+pitch*.3;quad((u,zz)=>[u,h+o+.02,zz],w/2-.2,w/2+.2,zb,zb+9,'#7a5f4a');quad((u,zz)=>[u,h+o+.02,zz],w/2-.15,w/2+.15,zb+1,zb+8,'#a5c0b8');nightLights.push({points:[[w/2-.15,h+o+.02,zb+1],[w/2+.15,h+o+.02,zb+1],[w/2+.15,h+o+.02,zb+8],[w/2-.15,h+o+.02,zb+8]].map(v=>q(...v)),colors:['#a5c0b8']});}
   stroke(c,[w/2,-o,peak],[w/2,h+o,peak],C.ink,3);
  }else{
   face(c,[[-o,-o,z],[w+o,-o,z],[w+o,h/2,peak],[-o,h/2,peak]],r1,C.ink);face(c,[[-o,h/2,peak],[w+o,h/2,peak],[w+o,h+o,z],[-o,h+o,z]],r0,C.ink);
   for(let x=.1;x<w+o;x+=thatch?.17:.3)stroke(c,[x,h/2,peak],[x,h+o-.05,z+1],thatch?rl:rk);
   for(let k=1;k<4;k++){const f=k/4;stroke(c,[-o,h+o-(h/2+o)*f,z+pitch*f],[w+o,h+o-(h/2+o)*f,z+pitch*f],rl);}
   face(c,[[w+o+.01,0,z],[w+o+.01,h/2,peak-3],[w+o+.01,h,z]],w1,C.ink);stroke(c,[w+o,-o,z],[w+o,h/2,peak],C.ink,3);stroke(c,[w+o,h/2,peak],[w+o,h+o,z],C.ink,3);
   {const zb=z+pitch*.3;quad((u,zz)=>[w+o+.02,u,zz],h/2-.18,h/2+.18,zb,zb+8,'#7a5f4a');quad((u,zz)=>[w+o+.02,u,zz],h/2-.13,h/2+.13,zb+1,zb+7,'#a5c0b8');nightLights.push({points:[[w+o+.02,h/2-.13,zb+1],[w+o+.02,h/2+.13,zb+1],[w+o+.02,h/2+.13,zb+7],[w+o+.02,h/2-.13,zb+7]].map(v=>q(...v)),colors:['#a5c0b8']});}
   stroke(c,[-o,h/2,peak],[w+o,h/2,peak],C.ink,3);
   if(s.dormer){const u=w*.35,zz=z+pitch*.35;cube(c,u,h*.6,.6,.35,zz-6,12,w0,r0,w1);face(c,[[u-.06,h*.6+.37,zz+6],[u+.3,h*.6+.37,zz+14],[u+.66,h*.6+.37,zz+6]],r1,C.ink);quad((uu,z2)=>[uu,h*.6+.36,z2],u+.15,u+.45,zz-3,zz+5,'#a5c0b8',C.ink);nightLights.push({points:[[u+.15,h*.6+.36,zz-3],[u+.45,h*.6+.36,zz-3],[u+.45,h*.6+.36,zz+5],[u+.15,h*.6+.36,zz+5]].map(v=>q(...v)),colors:['#a5c0b8']});}
  }
  if(thatch){const eave=ridge==='x'?[[-o,h+o],[w+o,h+o]]:[[-o,h+o],[-o,-o]];for(let k=0;k<=24;k++){const f=k/24,[x,y]=q(eave[0][0]+(eave[1][0]-eave[0][0])*f,eave[0][1]+(eave[1][1]-eave[0][1])*f,z);R(c,x,y,1,2+(k%3),k%2?rk:r0);}}
  // Chimney, then the special touches.
  if(s.chimney){const [cx,cy]=s.chimney,base=ridge==='y'?z+pitch*(1-Math.abs(cx+.18-w/2)/(w/2+o)):z+pitch*(1-Math.abs(cy+.18-h/2)/(h/2+o));cube(c,cx,cy,.36,.36,base-8,22,'#b8b0a0','#d6cfbe','#948c7d');top(c,cx+.06,cy+.06,.24,.24,base+14.2,'#4f4540');smoke=q(cx+.18,cy+.18,base+16);}
  if(s.forge){cube(c,w+.15,.3,.9,1.5,0,18,'#a59e8b','#8f877a','#857d70');face(c,[[w+.1,.2,24],[w+1.15,.2,16],[w+1.15,1.9,16],[w+.1,1.9,24]],r1,C.ink);quad((u,zz)=>[w+1.05,u,zz],.55,1.25,0,11,'#3f3530');quad((u,zz)=>[w+1.06,u,zz],.7,1.1,1,6,'#e8935a');quad((u,zz)=>[w+1.07,u,zz],.8,1,1,4,'#fff1c4');cube(c,w+1.3,1.55,.35,.22,0,6,'#5f5a5a','#8a8484','#4a4545');cube(c,w+1.22,1.5,.5,.32,6,3,'#5f5a5a','#9a9494','#4a4545');}
  if(s.sign){const at=ridge==='x'?F:S,u=ridge==='x'?w-.12:.12,[sx,sy]=q(...(at===F?F(w+.05,z-6):S(-.05,z-6)));R(c,sx,sy,9,1,C.ink);R(c,sx+2,sy+1,1,3,C.ink);R(c,sx+7,sy+1,1,3,C.ink);R(c,sx,sy+4,10,9,C.edge);R(c,sx+1,sy+5,8,7,'#e8c99a');
   if(s.sign==='bread'){E(c,sx+5,sy+9,3,2,'#c98a4a');R(c,sx+3,sy+8,1,1,'#f0c890');R(c,sx+6,sy+8,1,1,'#f0c890');}else if(s.sign==='sword'){R(c,sx+5,sy+6,1,6,'#8f9a98');R(c,sx+3,sy+10,5,1,'#8a6446');R(c,sx+5,sy+11,1,2,'#8a6446');}else if(s.sign==='bag'){R(c,sx+3,sy+7,4,5,'#c9a06a');R(c,sx+4,sy+6,2,1,'#8a6446');R(c,sx+3,sy+8,4,1,'#e8c070');}else if(s.sign==='potion'){R(c,sx+4,sy+6,2,2,'#b8946a');E(c,sx+5,sy+10,3,2,'#7fb0c8');R(c,sx+4,sy+9,2,1,'#c8e4ef');}else if(s.sign==='hide'){R(c,sx+3,sy+7,5,5,'#a87650');R(c,sx+2,sy+7,1,2,'#a87650');R(c,sx+8,sy+7,1,2,'#a87650');R(c,sx+4,sy+8,3,1,'#c99a72');}else if(s.sign==='gem'){R(c,sx+4,sy+7,3,1,'#bfe3f0');R(c,sx+3,sy+8,5,2,'#7fb6d6');R(c,sx+4,sy+10,3,1,'#5a8fb0');R(c,sx+5,sy+11,1,1,'#5a8fb0');}else if(s.sign==='cart'){R(c,sx+2,sy+7,6,3,'#b0855a');E(c,sx+3,sy+11,1,1,'#5a4a3a');E(c,sx+7,sy+11,1,1,'#5a4a3a');}else if(s.sign==='cross'){R(c,sx+2,sy+6,6,6,'#fff7ea');R(c,sx+4,sy+7,2,4,'#d9584a');R(c,sx+3,sy+8,4,2,'#d9584a');}else if(s.sign==='anvil'){R(c,sx+2,sy+7,6,2,'#5f5a5a');R(c,sx+4,sy+9,2,2,'#5f5a5a');R(c,sx+3,sy+11,4,1,'#5f5a5a');}else{R(c,sx+3,sy+7,4,5,'#e8c070');R(c,sx+3,sy+6,4,1,'#fff7ea');R(c,sx+7,sy+8,1,3,'#b8946a');}}
  if(s.lantern){const [lx,ly]=q(...F(.15,z/2-4));R(c,lx-2,ly-6,5,6,'#5a463f');R(c,lx-1,ly-5,3,4,'#f4d48a');R(c,lx,ly-8,1,2,'#5a463f');}
  if(s.woodpile){for(let k=0;k<3;k++)for(let m=0;m<3-k;m++){const [lx,ly]=q(w+.18,.3+m*.28+k*.14,3+k*5);E(c,lx,ly,2.6,2.6,'#8a6446');E(c,lx,ly,1.4,1.4,'#d9b083');}}
 });
 const [lx,ly]=q(.15,h,z/2-1),[dx,dy]=q(w*.62+.25,h+.35,0);
 result.nightLights=[...nightLights,{kind:'lamp',x:lx,y:ly},{kind:'spill',x:dx,y:dy,radius:42}];
 if(smoke)result.smoke={x:smoke[0],y:smoke[1],dark:s.smoke==='dark'};
 return result;
}
/** The village dojo: a low hall under a two-tier roof, sliding doors open onto a sand yard with practice dummies. Footprint 3.6×3. */
export function makeDojo(seed=149){
 const out=stamp(220,190,96,118,c=>{
  const quad=(pts,col,edge)=>face(c,pts,col,edge),sand='#dccb9c';
  top(c,-.1,-.1,3.9,3.3,0,'#5f705040');
  // Sand yard with rake lines in front of the hall.
  top(c,0,2.1,3.6,.9,0,sand,'#c4b080');for(let x=.2;x<3.5;x+=.35)stroke(c,[x,2.15,.1],[x,2.95,.1],'#cdbb8a');
  // Stone plinth and steps.
  cube(c,-.1,-.1,3.2,2.2,0,5,'#a59d8f','#cfc7b4','#8f877a');cube(c,1.2,2.1,.7,.3,0,3,'#a59d8f','#cfc7b4','#8f877a');
  // Walls: dark posts, sliding paper doors (two pulled open), plank side.
  quad([[0,2,5],[3,2,5],[3,2,30],[0,2,30]],'#efe6d2',C.ink);
  for(let u=0;u<=3.01;u+=.6){stroke(c,[u,2,5],[u,2,30],'#5a3f30',3);}
  for(let u=.05;u<3;u+=.6)for(let zz=9;zz<29;zz+=5)stroke(c,[u,2,zz],[u+.5,2,zz],'#c9bda2');
  for(const u of [1.2,1.8]){quad([[u+.04,2,5],[u+.56,2,5],[u+.56,2,28],[u+.04,2,28]],'#3f3530');quad([[u+.06,2.01,5],[u+.54,2.01,5],[u+.54,2.01,9],[u+.06,2.01,9]],'#c9b98a');}
  {const [dx,dy]=q(1.75,2.01,14);R(c,dx-1,dy-8,3,10,'#8a6446');R(c,dx-4,dy-6,9,2,'#8a6446');E(c,dx,dy-11,3,3,'#d9c08a');}
  quad([[3,0,5],[3,2,5],[3,2,30],[3,0,30]],'#8a6446',C.ink);for(let zz=9;zz<30;zz+=4)stroke(c,[3,0,zz],[3,2,zz],'#6f4f38');for(const u of [0,1,2])stroke(c,[3,u,5],[3,u,30],'#5a3f30',3);
  stroke(c,[0,2,30],[3,2,30],'#5a3f30',3);stroke(c,[3,0,30],[3,2,30],'#5a3f30',3);
  // Lower roof skirt with upturned corners.
  const tile='#5f6670',tileDark='#4c525c',tileLight='#7a828c';
  quad([[-.35,-.35,30],[3.35,-.35,30],[2.6,.3,40],[.4,.3,40]],tileDark,C.ink);
  quad([[-.35,2.35,30],[3.35,2.35,30],[2.6,1.7,40],[.4,1.7,40]],tile,C.ink);
  quad([[3.35,-.35,30],[3.35,2.35,30],[2.6,1.7,40],[2.6,.3,40]],tileDark,C.ink);
  for(let u=-.2;u<3.3;u+=.25)stroke(c,[u,2.35,30],[u*.6+.4*.4+.4*(1-.6)+u*0,1.7,40],tileLight);
  for(const [x,y] of [[-.35,2.35],[3.35,2.35],[3.35,-.35]]){const [px,py]=q(x,y,30);P(c,[[px-4,py+1],[px+4,py+1],[px+(x<0?-5:5),py-5]],tileDark);}
  // Upper storey and gable roof.
  cube(c,.45,.35,2.1,1.3,40,7,'#efe6d2','#efe6d2','#d8cdb4');
  quad([[.15,.4,47],[2.85,.4,47],[2.85,1,60],[.15,1,60]],tileDark,C.ink);
  quad([[.15,1.6,47],[2.85,1.6,47],[2.85,1,60],[.15,1,60]],tile,C.ink);
  quad([[2.86,.4,47],[2.86,1,60],[2.86,1.6,47]],'#8a6446',C.ink);for(let k=1;k<4;k++)stroke(c,[2.87,1-.15*k,48+k*2],[2.87,1+.15*k,48+k*2],'#c9a77f');
  stroke(c,[.1,1,61],[2.9,1,61],C.ink,3);for(const x of [.05,2.95]){const [px,py]=q(x,1,61);R(c,px-2,py-5,4,4,'#4c525c');R(c,px+(x<1?-4:2),py-7,3,3,'#4c525c');}
  // Name board over the entrance: crossed swords.
  {const [bx,by]=q(1.5,2.02,34);R(c,bx-14,by-5,28,11,'#3f3530');R(c,bx-13,by-4,26,9,'#5a3f30');R(c,bx-13,by-4,26,1,'#c9a050');R(c,bx-13,by+4,26,1,'#c9a050');L(c,bx-6,by-2,bx+5,by+3,'#e6dfcc');L(c,bx+6,by-2,bx-5,by+3,'#e6dfcc');R(c,bx-1,by,2,2,'#c9a050');}
  // Banners on poles at the yard corners, practice dummies and a weapon rack.
  for(const [x,y] of [[.1,2.95],[3.45,2.95]]){const [px,py]=q(x,y,0);R(c,px,py-46,2,46,'#5a3f30');R(c,px+2,py-44,7,18,'#b85a4a');R(c,px+2,py-44,7,2,'#d9806e');R(c,px+4,py-38,3,3,'#f4e5c9');R(c,px+3,py-26,2,3,'#b85a4a');R(c,px+6,py-26,2,4,'#b85a4a');}
  for(const [x,y] of [[.6,2.6],[2.7,2.55]]){const [px,py]=q(x,y,0);R(c,px-1,py-20,3,20,'#6b4f3a');R(c,px-7,py-15,15,2,'#6b4f3a');E(c,px,py-13,4,6,'#d9c08a');E(c,px,py-22,3,3,'#e6cf8e');R(c,px-3,py-12,6,1,'#a3824a');}
  {const [px,py]=q(3.3,.9,0);R(c,px-6,py-18,14,2,'#6b4f3a');R(c,px-6,py-8,14,2,'#6b4f3a');R(c,px-6,py-18,2,18,'#5a3f30');R(c,px+6,py-18,2,18,'#5a3f30');L(c,px-3,py-22,px-3,py-2,'#c4ccd0');L(c,px+1,py-24,px+1,py-2,'#a77a55');L(c,px+4,py-21,px+4,py-2,'#c4ccd0');}
 });
 out.nightLights=[...[[.35,2,17],[2.65,2,17]].map(v=>{const[x,y]=q(...v);return{kind:'lamp',x,y};}),{points:[[.05,2,7],[.55,2,7],[.55,2,28],[.05,2,28]].map(v=>q(...v)),colors:['#efe6d2']},{kind:'spill',x:q(1.5,2.4,0)[0],y:q(1.5,2.4,0)[1],radius:42}];
 return out;
}
/** Draw on top of a home sprite: same foot, extra margin around it for things set out front. */
function dressHome(base,pad,paint){const out=stamp(base.canvas.width+pad*2,base.canvas.height+pad,base.footX+pad,base.footY,c=>{c.drawImage(base.canvas,-base.footX,-base.footY);paint(c);});out.nightLights=base.nightLights;return out;}
/** General store: a goods-filled window, a table of wares, barrels, sacks and a chalkboard out front. */
export function makeShop(seed=131){
 const base=makeHome('store',seed),{w,h}=HOME_STYLES.store;
 const out=dressHome(base,30,c=>{
  // Shop window: shelves of bottles and loaves behind the glass.
  face(c,[[.2,h,9],[.95,h,9],[.95,h,22],[.2,h,22]],'#5a463f',C.ink);face(c,[[.24,h+.01,10],[.91,h+.01,10],[.91,h+.01,21],[.24,h+.01,21]],'#cfe3dc');
  for(const zz of [12,17])stroke(c,[.24,h+.02,zz],[.91,h+.02,zz],'#8a6446');
  for(let k=0;k<6;k++){const[x,y]=q(.3+k*.11,h+.02,13+(k%2)*5);R(c,x,y-3,2,3,['#d9584a','#6f9ad1','#7fae5a','#e8b04a','#b98ad1','#d9584a'][k]);R(c,x,y-4,1,1,'#ffffff');}
  // Table of wares, barrels, sacks and a chalkboard sign.
  cube(c,.1,h+.25,.9,.38,0,9,'#b98a60','#e5bc87','#85634c');
  for(let k=0;k<5;k++){const[x,y]=q(.2+k*.17,h+.42,10);E(c,x,y-1,3,2,['#e2a93c','#d98978','#9fc27a','#c98a4a','#e8cd8c'][k]);R(c,x-1,y-3,1,1,'#fff8e7');}
  for(const [x,y] of [[2.05,h+.35],[2.4,h+.55]]){const[px,py]=q(x,y,0);E(c,px,py-1,6,2.5,'#6b4f3a');R(c,px-6,py-12,12,11,'#94735a');R(c,px-6,py-12,3,11,'#b08a68');for(const dy of [-10,-4])R(c,px-6,py+dy,12,1,'#5a463f');E(c,px,py-12,6,2.5,'#c9a77f');}
  for(const [x,y] of [[1.45,h+.5],[1.7,h+.7]]){const[px,py]=q(x,y,0);E(c,px,py-4,5,5,'#d9c8a0');E(c,px-1,py-5,3,3,'#efe2c0');R(c,px-1,py-10,3,2,'#b8a274');}
  {const[px,py]=q(1.1,h+.95,0);L(c,px-5,py,px-1,py-15,'#6b4f3a',2);L(c,px+5,py,px+1,py-15,'#6b4f3a',2);R(c,px-5,py-14,10,10,'#3f4a45');R(c,px-4,py-13,8,1,'#e6dfcc');R(c,px-4,py-10,6,1,'#e8b04a');R(c,px-4,py-7,7,1,'#e6dfcc');}
 });
 out.smoke=base.smoke&&{...base.smoke};return out;
}
/** Smithy: the forge annex glows, swords and a shield hang on a rack, a quench barrel stands by the anvil. */
export function makeSmithyShop(seed=31,frame=0){
 const base=makeHome('smithy',seed),{w,h}=HOME_STYLES.smithy;
 const out=dressHome(base,30,c=>{
  const [gx,gy]=q(w+1.05,.9,5);for(let k=3;k>=1;k--)E(c,gx,gy,6+k*4,4+k*3,`rgba(244,160,80,${(frame?.12:.08)*(4-k)})`);
  for(let k=0;k<4;k++){const[sx,sy]=q(w+1.25+(k%2)*.12,1.5,10+k*3+frame*2);R(c,sx+((k*5+frame*3)%7)-3,sy,1,1,k%2?'#fff1c4':'#f4b860');}
  // Weapon rack with swords and a round shield.
  const[rx,ry]=q(.4,h+.35,0);R(c,rx-12,ry-22,26,2,'#6b4f3a');R(c,rx-12,ry-10,26,2,'#6b4f3a');R(c,rx-12,ry-22,2,22,'#5a3f30');R(c,rx+12,ry-22,2,22,'#5a3f30');
  for(const dx of [-7,-2,3]){L(c,rx+dx,ry-27,rx+dx,ry-3,'#c4ccd0');R(c,rx+dx-2,ry-8,5,1,'#8a6446');R(c,rx+dx,ry-28,1,1,'#ffffff');}
  E(c,rx+9,ry-15,5,6,'#8a6446');E(c,rx+9,ry-15,3,4,'#c9a050');R(c,rx+8,ry-16,2,2,'#e8c878');
  // Quench barrel and a stack of iron bars.
  const[bx,by]=q(w-.2,h+.4,0);E(c,bx,by-1,6,2.5,'#5a463f');R(c,bx-6,by-11,12,10,'#7b5d45');R(c,bx-6,by-11,3,10,'#94735a');R(c,bx-6,by-8,12,1,'#4f4540');E(c,bx,by-11,6,2.5,'#6f9ab0');R(c,bx-2,by-12,3,1,'#c8e3e7');
  for(let k=0;k<3;k++){const[ix,iy]=q(w-.9,h+.45+k*.08,k*2);R(c,ix-6,iy-2,12,2,'#6f7478');R(c,ix-6,iy-2,12,1,'#9aa2a8');}
 });
 out.smoke=base.smoke&&{...base.smoke};return out;
}
export function makeOutdoor(type,guild={}){
 return object(c=>{
  if(type==='well'){
   cube(c,0,0,1,1,0,10,'#b9b9a4','#e2d9bb','#999f8f');top(c,.18,.18,.64,.64,10.1,'#6b8d88',C.ink);
   for(const[x,y]of[[.1,.2],[.86,.8]])cube(c,x,y,.1,.1,10,26,C.wood,C.light,C.edge);
   face(c,[[-.12,.08,34],[.48,.08,48],[.48,1.05,48],[-.12,1.05,34]],'#c4a282',C.edge);face(c,[[.48,.08,48],[1.12,.08,34],[1.12,1.05,34],[.48,1.05,48]],'#a68870',C.edge);stroke(c,[.48,.18,47],[.48,.95,47],C.light,2);for(let y=.28;y<1;y+=.23){stroke(c,[-.12,y,34],[.48,y,48],'#ddbb92');stroke(c,[.48,y,48],[1.12,y,34],'#bb9e7d');}
  }else if(type==='table'){table(c,1.4,.8);top(c,.22,.18,.6,.4,17.2,'#f0e2bd');plant(c);}
  else if(type==='planter'){cube(c,0,0,1.25,.5,0,5,'#b4906a','#d7bb8c','#937653');for(let i=0;i<5;i++){const[x,y]=q(.15+i*.23,.23,7);E(c,x,y-3,4,4,'#91aa81');R(c,x-1,y-6,3,3,i%2?'#e8c59f':'#d8aaa3');}}
  else if(type==='banner'){
   const[x,y]=q(.2,.2),color=guild.bannerColor||'#ad8175';cube(c,0,0,.45,.45,0,4);R(c,x,y-51,2,50,C.edge);R(c,x-15,y-50,31,2,C.edge);P(c,[[x-13,y-48],[x+13,y-48],[x+13,y-25],[x,y-18],[x-13,y-25]],color);R(c,x-10,y-45,20,1,'#e0b6a1');drawGuildEmblem(c,guild.bannerSymbol,x-9,y-44,18,C.cream);R(c,x-3,y-25,7,2,'#e1bc8c');
  }else if(type==='crates'){cube(c,0,0,.6,.6,0,13);cube(c,.72,.15,.45,.45,0,10);stroke(c,[0,.6,2],[.6,.6,11],C.edge);stroke(c,[0,.6,11],[.6,.6,2],C.edge);}
  else plant(c,true);
 });
}
// ---- Festival grounds: shared little painters for lights, flags, tents and booths. ----
const FEST=['#d9584a','#e8b04a','#6f9ad1','#7fae5a','#b98ad1','#f08a6a'];
/** A drooping wire from a to b ([x,y,z] each) with bulbs; frame 0/1 swaps which bulbs shine brightest. */
function festBulbs(c,a,b,frame=0,sag=7,seed=0,step=.3){
 const n=Math.max(2,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/step)),pt=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t-sag*4*t*(1-t)];
 for(let k=0;k<n;k++)stroke(c,pt(k/n),pt((k+1)/n),'#5a463f');
 for(let k=1;k<n;k++){const[x,y]=q(...pt(k/n)),col=FEST[(k+seed)%FEST.length],on=(k+frame+seed)%2===0;
  if(on)E(c,x,y+2.5,4,3,col+'38');R(c,x,y,1,1,'#5a463f');R(c,x-1,y+1,3,3,on?ArtShade(col,40):ArtShade(col,-10));if(on)R(c,x,y+1,1,1,'#fff6dc');}
}
/** A drooping cord of little triangle flags from a to b. */
function festFlags(c,a,b,sag=6,seed=0,step=.22){
 const n=Math.max(2,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/step)),pt=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t-sag*4*t*(1-t)];
 for(let k=0;k<n;k++){const p0=q(...pt(k/n)),p1=q(...pt((k+1)/n)),col=FEST[(k+seed)%FEST.length];
  P(c,[[p0[0],p0[1]],[p1[0],p1[1]],[(p0[0]+p1[0])/2,(p0[1]+p1[1])/2+6]],col);L(c,p0[0],p0[1],(p0[0]+p1[0])/2,(p0[1]+p1[1])/2+5,ArtShade(col,30));L(c,...p0,...p1,'#6b4f3a');}
}
function festPole(c,x,y,z=36,cap='#e8b04a'){const[px,py]=q(x,y,0);E(c,px+1,py,3,1.5,'#5f705050');R(c,px-1,py-z,3,z,'#7b5a42');R(c,px-1,py-z,1,z,'#a8805c');R(c,px-2,py-z-3,5,3,cap);R(c,px-1,py-z-3,2,1,'#fff1c4');}
/** Little pointed tent: striped canvas walls and a pyramid roof with a pennant. */
function festTent(c,x,y,s,a,b,wallZ=12,peak=24,flag='#e8b04a'){
 top(c,x-.1,y-.05,s+.3,s+.25,0,'#5f705040');
 const F=(u,z)=>[x+u,y+s,z],S=(u,z)=>[x+s,y+u,z],n=4;
 face(c,[F(0,0),F(s,0),F(s,wallZ),F(0,wallZ)],b,C.ink);face(c,[S(0,0),S(s,0),S(s,wallZ),S(0,wallZ)],ArtShade(b,-30),C.ink);
 for(let k=0;k<n;k+=2){face(c,[F(k*s/n,0),F((k+1)*s/n,0),F((k+1)*s/n,wallZ),F(k*s/n,wallZ)],a);face(c,[S(k*s/n,0),S((k+1)*s/n,0),S((k+1)*s/n,wallZ),S(k*s/n,wallZ)],ArtShade(a,-30));}
 // Door flap pulled open on the front.
 face(c,[F(s*.38,0),F(s*.62,0),F(s*.5,wallZ-1)],'#5a463f');stroke(c,F(s*.38,0),F(s*.5,wallZ-1),C.cream);
 const apex=[x+s/2,y+s/2,wallZ+peak],o=.07;
 for(let k=0;k<n;k++){const u0=-o+k*(s+2*o)/n,u1=u0+(s+2*o)/n;
  face(c,[[x+u0,y+s+o,wallZ],[x+u1,y+s+o,wallZ],apex],k%2?b:a);face(c,[[x+s+o,y+u0,wallZ],[x+s+o,y+u1,wallZ],apex],ArtShade(k%2?b:a,-30));}
 stroke(c,[x-o,y+s+o,wallZ],apex,C.ink);stroke(c,[x+s+o,y+s+o,wallZ],apex,C.ink);stroke(c,[x+s+o,y-o,wallZ],apex,C.ink);
 stroke(c,[x-o,y+s+o,wallZ],[x+s+o,y+s+o,wallZ],C.ink);stroke(c,[x+s+o,y-o,wallZ],[x+s+o,y+s+o,wallZ],C.ink);
 for(let k=0;k<6;k++){const f=(k+.5)/6,[px,py]=q(x-o+(s+2*o)*f,y+s+o,wallZ),[rx,ry]=q(x+s+o,y-o+(s+2*o)*f,wallZ);E(c,px,py+1,2,1.5,k%2?a:b);E(c,rx,ry+1,2,1.5,ArtShade(k%2?a:b,-30));}
 const[tx,ty]=q(...apex);R(c,tx,ty-9,1,9,'#5a463f');P(c,[[tx+1,ty-9],[tx+8,ty-7],[tx+1,ty-5]],flag);R(c,tx-1,ty-10,3,2,'#e8b04a');
}
/** A small festival booth: counter, two posts and a striped canopy, wares on top. */
function festBooth(c,x,y,w,a,b,seed=0){
 top(c,x-.1,y-.05,w+.3,.95,0,'#5f705040');
 for(const u of [x,x+w-.08])cube(c,u,y,.08,.08,0,32,'#8f6a4c','#b98a60','#6f5240');
 cube(c,x,y+.35,w,.45,0,12,'#b98a60','#e5bc87','#85634c');face(c,[[x,y+.8,3],[x+w,y+.8,3],[x+w,y+.8,10],[x,y+.8,10]],a);stroke(c,[x,y+.8,10],[x+w,y+.8,10],C.ink);
 const r=rng(seed+7);for(let k=0;k<Math.floor(w*4);k++){const[px,py]=q(x+.15+k*.25,y+.55+(k%2)*.1,13),col=FEST[Math.floor(r()*FEST.length)];
  if(seed%3===0){E(c,px,py-3,3,3,col);R(c,px,py-6,1,3,'#f4e5c9');R(c,px-1,py-4,1,1,'#fff6dc');}else if(seed%3===1){R(c,px-1,py-6,3,6,col);R(c,px-1,py-6,3,1,ArtShade(col,40));}else{E(c,px,py-2,3,2,'#e8cd8c');R(c,px-1,py-3,2,1,'#fff6dc');}}
 const n=Math.max(3,Math.round(w/.26)),sw=(w+.2)/n;
 for(let k=0;k<n;k++){const u0=x-.1+k*sw;face(c,[[u0,y-.12,34],[u0+sw,y-.12,34],[u0+sw,y+.55,28],[u0,y+.55,28]],k%2?b:a);const[px,py]=q(u0+sw/2,y+.55,28);E(c,px,py+1,3,2,k%2?b:a);}
 stroke(c,[x-.1,y+.55,28],[x+w+.1,y+.55,28],C.ink);
}
function festBench(c,x,y,w=.8,along='x'){
 const bw=along==='x'?w:.24,bh=along==='x'?.24:w;
 for(const[u,v]of along==='x'?[[x+.04,y+.04],[x+w-.12,y+.04]]:[[x+.04,y+.04],[x+.04,y+w-.12]])cube(c,u,v,.08,.16,0,5,'#7b5a42','#a8805c','#5f4434');
 cube(c,x,y,bw,bh,5,2,'#a8805c','#d9b083','#7b5a42');
}
function festLantern(c,x,y,frame=0,h=26){
 const[px,py]=q(x,y,0);E(c,px+1,py,3,1.5,'#5f705050');R(c,px-1,py-h,2,h,'#5a463f');R(c,px-3,py-h-1,7,2,'#5a463f');
 const lit=frame?'#ffe2a0':'#f8d27e';E(c,px+1,py-h-6,8,7,frame?'#f4b8603a':'#f4b8602e');R(c,px-2,py-h-9,6,8,'#c9584a');R(c,px-1,py-h-8,4,6,lit);R(c,px-2,py-h-10,6,1,'#5a463f');R(c,px-2,py-h-1,6,1,'#5a463f');R(c,px,py-h-7,1,3,'#fff6dc');
}
/** Hanging paper lantern centred at screen point (x,y). */
function paperLantern(c,x,y,col='#d9584a',frame=0,size=1){
 const rx=Math.round(4*size),ry=Math.round(5*size);E(c,x,y,rx+4,ry+3,col+(frame?'30':'22'));R(c,x,y-ry-3,1,3,'#5a463f');R(c,x-rx+1,y-ry-1,rx*2-1,2,'#5a463f');
 E(c,x,y,rx,ry,col);E(c,x-1,y-1,rx-2,ry-2,ArtShade(col,frame?55:40));R(c,x-rx+1,y-1,rx*2-1,1,ArtShade(col,-25));R(c,x-1,y-ry+2,1,2,'#fff6dc');
 R(c,x-rx+1,y+ry-1,rx*2-1,2,'#5a463f');R(c,x,y+ry+1,1,3,'#e8b04a');
}
/** Festival fairground ("ลานเทศกาล"), footprint 5×4. level 1-3; frame 0/1 twinkles the string lights (and turns the wheel a notch). */
export function makeFairground(level=1,frame=0){
 const w=5,h=4;
 return stamp(270,200,124,76,c=>{
  // Packed-earth plaza with a trodden lighter centre.
  top(c,-.2,-.15,w+.45,h+.4,0,'#5f705040');
  top(c,0,0,w,h,0,'#bfa57c',C.edge);top(c,.2,.2,w-.4,h-.4,.4,'#d5bf95','#c3a97f');
  const r=rng(511);for(let k=0;k<70;k++){const[px,py]=q(.3+r()*(w-.6),.3+r()*(h-.6),.5);R(c,px,py,2,1,r()>.5?'#c6ad84':'#e2d0a8');}
  for(let k=0;k<12;k++){const[px,py]=q(r()*w,k%2?h-.05:r()*.1,0);R(c,px,py-2,1,2,'#879b6b');R(c,px+2,py-1,1,2,'#b9c68d');}
  // Back row of tents and booths.
  festTent(c,.25,.25,1.05,'#d9584a','#f4e5c9',12,24,'#6f9ad1');
  festBooth(c,1.75,.2,1.45,'#6f9ad1','#f4e5c9',1);
  if(level<3)festTent(c,3.6,.3,1.05,'#7fae5a','#f4e5c9',12,22,'#d9584a');
  else{
   // Wooden wheel at the back-right corner, gondolas turning slowly.
   const cx=4.1,y0=.75,cz=40,R0=1,Rz=27,rim=t=>[cx+Math.cos(t)*R0*.62,y0,cz+Math.sin(t)*Rz],spin=frame*Math.PI/8;
   top(c,cx-.75,y0-.3,1.5,.7,0,'#5f705040');
   for(const dy of [-.18])for(const dx of [-.55,.55])stroke(c,[cx+dx,y0+dy,0],[cx,y0+dy,cz],'#6b4f3a',2);
   for(let k=0;k<24;k++)stroke(c,rim(k/24*Math.PI*2),rim((k+1)/24*Math.PI*2),'#8a6446',2);
   for(let k=0;k<8;k++)stroke(c,[cx,y0,cz],rim(k/8*Math.PI*2+spin),'#a8805c');
   for(let k=0;k<24;k++)stroke(c,rim(k/24*Math.PI*2),rim((k+1)/24*Math.PI*2),'#d9b083');
   for(let k=0;k<8;k++){const[gx,gy]=q(...rim(k/8*Math.PI*2+spin)),col=FEST[k%FEST.length];R(c,gx,gy,1,2,'#5a463f');R(c,gx-3,gy+2,7,5,col);R(c,gx-3,gy+2,7,1,ArtShade(col,40));R(c,gx-2,gy+4,5,1,'#5a463f');}
   {const[hx,hy]=q(cx,y0,cz);E(c,hx,hy,3,3,'#e8b04a');R(c,hx,hy-1,1,1,'#fff1c4');}
   for(const dx of [-.55,.55])stroke(c,[cx+dx,y0+.18,0],[cx,y0+.18,cz],'#8a6446',2);
   cube(c,cx-.3,y0+.35,.6,.35,0,5,'#a88d6c','#c9b08e','#8f7b61');
  }
  // Light poles and wires along the back edges.
  const ph=36,corners=[[0,0],[w,0],[0,h],[w,h]];
  for(const[x,y]of [[0,0],[w,0],[0,h]])festPole(c,x,y,ph);
  festBulbs(c,[0,0,ph],[w,0,ph],frame,8,0);festBulbs(c,[0,0,ph],[0,h,ph],frame,8,2);
  // Side stalls along the left once the fair grows.
  if(level>=3){festTent(c,.2,2.15,.9,'#b98ad1','#f4e5c9',10,20,'#e8b04a');festBooth(c,3.55,2.15,1.25,'#d9584a','#f4e5c9',2);}
  else if(level>=2)festBooth(c,.2,2.2,1.2,'#7fae5a','#f4e5c9',0);
  // Centrepiece: maypole with ribbons from level 2.
  const mx=2.45,my=2.05;
  if(level>=2){
   top(c,mx-.7,my-.7,1.4,1.4,.5,'#c9b088');const mz=58;
   for(let k=0;k<10;k++){const t=k/10*Math.PI*2,gx=mx+Math.cos(t)*.62,gy=my+Math.sin(t)*.62;if(Math.sin(t)<-.2)stroke(c,[mx,my,mz-4],[gx,gy,1],FEST[k%FEST.length]);}
   const[px,py]=q(mx,my,0);R(c,px-1,py-mz,3,mz,'#c49a6c');R(c,px-1,py-mz,1,mz,'#e8c99a');for(let z=8;z<mz-6;z+=7)R(c,px-1,py-z,3,2,FEST[(z/7|0)%FEST.length]);
   for(let k=0;k<10;k++){const t=k/10*Math.PI*2,gx=mx+Math.cos(t)*.62,gy=my+Math.sin(t)*.62;if(Math.sin(t)>=-.2){stroke(c,[mx,my,mz-4],[gx,gy,1],FEST[k%FEST.length]);const[ex,ey]=q(gx,gy,0);R(c,ex-1,ey-1,2,2,ArtShade(FEST[k%FEST.length],-20));}}
   E(c,px,py-mz+1,5,2,'#7fae5a');for(let k=0;k<5;k++)R(c,px-4+k*2,py-mz-(k%2),2,2,['#f2b8c8','#fff1c4','#f4d070','#f2b8c8','#d8c4ef'][k]);R(c,px-1,py-mz-5,3,3,'#e8b04a');
  }else{
   // A simple fire bowl in the middle at the first level.
   const[px,py]=q(mx,my,0);E(c,px,py,8,4,'#8a8f88');E(c,px,py-1,6,3,'#5a463f');E(c,px,py-4,4,4,frame?'#f4b860':'#e8935a');E(c,px,py-6,2,3,'#fff1c4');E(c,px,py-4,10,7,'#f4b86026');
  }
  // Benches and lantern posts around the plaza.
  festBench(c,1.05,3.25,.85);festBench(c,3.15,3.3,.85);festBench(c,4.5,1.3,.8,'y');
  festLantern(c,.35,3.6,frame);festLantern(c,4.6,3.55,frame);if(level>=2){festLantern(c,4.6,.4+(level>=3?1.25:0),frame);festLantern(c,.3,1.75,frame);}
  // Front wires with bunting and bulbs, then the front pole.
  festPole(c,w,h,ph);
  festFlags(c,[0,h,ph-2],[w,h,ph-2],7,1);festBulbs(c,[w,0,ph],[w,h,ph],frame,8,4);
  festBulbs(c,[0,0,ph+1],[w,h,ph+1],frame,14,3,.34);
  if(level>=2)festFlags(c,[0,h,ph-3],[w,0,ph-3],12,3,.26);
  // Big decorated gate arch on the front edge at level 3.
  if(level>=3){
   const g0=1.7,g1=3.3,gy=h+.05,gz=46;
   for(const x of [g0,g1-.2]){cube(c,x,gy-.1,.2,.2,0,gz,'#b85a4a','#d9806e','#8a3f34');for(let z=6;z<gz;z+=10)stroke(c,[x,gy+.1,z],[x+.2,gy+.1,z+2],'#e8b04a');}
   for(let k=0;k<16;k++){const t0=k/16,t1=(k+1)/16,z=t=>gz+2+12*Math.sin(Math.PI*t);stroke(c,[g0+(g1-g0)*t0,gy,z(t0)],[g0+(g1-g0)*t1,gy,z(t1)],'#8a3f34',4);stroke(c,[g0+(g1-g0)*t0,gy,z(t0)+1],[g0+(g1-g0)*t1,gy,z(t1)+1],'#e8b04a',2);}
   face(c,[[g0+.25,gy+.01,gz-8],[g1-.25,gy+.01,gz-8],[g1-.25,gy+.01,gz+6],[g0+.25,gy+.01,gz+6]],'#f4e5c9',C.ink);face(c,[[g0+.3,gy+.02,gz-6],[g1-.3,gy+.02,gz-6],[g1-.3,gy+.02,gz+4],[g0+.3,gy+.02,gz+4]],'#d9584a');
   for(let k=0;k<5;k++){const[sx,sy]=q(g0+.45+k*.18,gy+.03,gz-3+(k%2));R(c,sx,sy-3,2,4,'#fff1c4');}
   for(let k=0;k<9;k++){const t=(k+.5)/9,[bx,by]=q(g0+(g1-g0)*t,gy,gz+2+12*Math.sin(Math.PI*t)),on=(k+frame)%2===0;R(c,bx-1,by-3,3,3,on?'#fff1c4':'#e8935a');if(on)E(c,bx,by-2,4,3,'#f4b86040');}
   for(const x of [g0+.1,g1-.1]){const[fx,fy]=q(x,gy,gz);R(c,fx,fy-12,1,12,'#5a463f');P(c,[[fx+1,fy-12],[fx+9,fy-10],[fx+1,fy-7]],x<2.5?'#6f9ad1':'#7fae5a');}
   for(const x of [g0-.1,g1+.1]){const[px,py]=q(x,gy+.25,0);E(c,px,py-1,5,2.5,'#6b4f3a');E(c,px,py-5,4,4,'#7fae5a');R(c,px-2,py-8,2,2,'#f2b8c8');R(c,px+1,py-6,2,2,'#f4d070');}
  }
 });
}
/** Lantern music stage ("เวทีโคมไฟ"), footprint 3.4×2.8. level 1-3; frame 0/1 flickers the lanterns. */
export function makeStage(level=1,frame=0){
 const w=3.4,h=2.8,sx=.2,sy=.2,sw=3,sd=1.45,sz=11;
 return stamp(190,180,84,96,c=>{
  top(c,-.15,-.1,w+.35,h+.3,0,'#5f705040');
  top(c,0,0,w,h,0,'#c6b18a',C.edge);top(c,.15,sd+.35,w-.3,h-sd-.5,.3,'#d5bf95','#c3a97f');
  // Back curtain wall standing on the stage.
  const back=(u,z)=>[sx+u,sy+.05,z];
  cube(c,sx,sy,sw,sd,0,sz,'#8a6446','#d4af7e','#6b4f3a');
  for(let yy=sy+.25;yy<sy+sd;yy+=.25)stroke(c,[sx+.02,yy,sz+.1],[sx+sw-.02,yy,sz+.1],'#b68e64');
  for(let z=3;z<sz;z+=4)stroke(c,[sx,sy+sd,z],[sx+sw,sy+sd,z],'#7b5a42');
  face(c,[back(0,sz),back(sw,sz),back(sw,sz+40),back(0,sz+40)],'#8a3f34',C.ink);
  for(let u=.15;u<sw;u+=.3){stroke(c,back(u,sz+1),back(u,sz+39),'#a8503f');stroke(c,back(u+.08,sz+1),back(u+.08,sz+39),'#6f3029');}
  // Gold sun emblem on the backdrop.
  {const[ex,ey]=q(...back(sw/2,sz+24));E(c,ex,ey,8,8,'#e8b04a');E(c,ex,ey,6,6,'#8a3f34');E(c,ex,ey,4,4,'#f4d070');for(let k=0;k<8;k++){const t=k/8*Math.PI*2;R(c,ex+Math.cos(t)*10,ey+Math.sin(t)*10,2,2,'#e8b04a');}}
  // Instruments: two drums, a xylophone and a gong.
  const drum=(x,y,s=1)=>{const[px,py]=q(x,y,sz);E(c,px,py-1,6*s,3*s,'#5a463f');R(c,px-6*s,py-11*s,12*s,10*s,'#b85a4a');R(c,px-6*s,py-11*s,3*s,10*s,'#d9806e');for(let k=0;k<4;k++)R(c,px-5*s+k*3*s,py-11*s,1,10*s,'#e8b04a');E(c,px,py-11*s,6*s,3*s,'#efe2c0');E(c,px,py-11*s,4*s,2*s,'#f8eedb');};
  drum(sx+.5,sy+.6);drum(sx+.95,sy+.95,.75);
  cube(c,sx+1.6,sy+.55,.8,.3,sz,5,'#8a6446','#b08a68','#6b4f3a');for(let k=0;k<7;k++){const[px,py]=q(sx+1.65+k*.1,sy+.6,sz+5.2);R(c,px-1,py-1,2,3,['#e8b04a','#d9b083'][k%2]);}
  {const[gx,gy]=q(sx+2.65,sy+.35,sz);R(c,gx-9,gy-28,2,28,'#6b4f3a');R(c,gx+8,gy-28,2,28,'#6b4f3a');R(c,gx-9,gy-28,19,2,'#6b4f3a');R(c,gx,gy-26,1,4,'#5a463f');E(c,gx,gy-16,6,6,'#c9a050');E(c,gx,gy-16,4,4,'#e8c878');E(c,gx,gy-16,1.5,1.5,'#a67c3a');}
  // Side curtains tied back at the front of the stage.
  const fy=sy+sd;
  for(const[u0,u1]of[[0,.35],[sw-.35,sw]])face(c,[[sx+u0,fy,sz],[sx+u1,fy,sz],[sx+u1,fy,sz+40],[sx+u0,fy,sz+40]],'#b85a4a',C.ink);
  for(const u of [.1,.22,sw-.25,sw-.12])stroke(c,[sx+u,fy+.01,sz+1],[sx+u,fy+.01,sz+39],'#8a3f34');
  for(const u of [.18,sw-.18]){const[tx,ty]=q(sx+u,fy+.02,sz+16);R(c,tx-3,ty,7,2,'#e8b04a');}
  // Front steps up to the stage.
  cube(c,sx+1.1,fy,.8,.25,0,7,'#a88d6c','#d4af7e','#8f7b61');cube(c,sx+1.1,fy+.25,.8,.2,0,3.5,'#a88d6c','#d4af7e','#8f7b61');
  // Posts and a valance carrying paper lanterns.
  const pz=level>=2?54:50,posts=[[sx,sy],[sx+sw-.12,sy],[sx,fy-.12],[sx+sw-.12,fy-.12]];
  for(const[x,y]of posts)cube(c,x,y,.12,.12,sz,pz-sz,'#8a3f34','#b85a4a','#6f3029');
  face(c,[[sx,fy,pz-6],[sx+sw,fy,pz-6],[sx+sw,fy,pz],[sx,fy,pz]],'#e8b04a',C.ink);
  for(let k=0;k<8;k++){const u=(k+.5)/8*sw,[vx,vy]=q(sx+u,fy,pz-6);P(c,[[vx-5,vy],[vx+5,vy+0],[vx,vy+4]],k%2?'#b85a4a':'#8a3f34');}
  const lcol=['#d9584a','#e8b04a','#d9584a','#f08a6a'];
  for(let k=0;k<4;k++){const[lx,ly]=q(sx+.45+k*.7,fy,pz-6);R(c,lx,ly+3,1,4+(k%2)*3,'#5a463f');paperLantern(c,lx,ly+13+(k%2)*3,lcol[k],(k+frame)%2,.9);}
  // Roof canopy: a Thai-style gable with upturned eaves from level 2.
  if(level>=2){
   const rz=pz,ro=.3,peak=rz+18,x0=sx-ro,x1=sx+sw+ro,y0=sy-ro,y1=fy+ro,ym=(sy+fy)/2;
   face(c,[[x0,y0,rz],[x1,y0,rz],[x1,ym,peak],[x0,ym,peak]],'#7b4a3c',C.ink);
   face(c,[[x0,ym,peak],[x1,ym,peak],[x1,y1,rz],[x0,y1,rz]],'#b85a4a',C.ink);
   for(let x=x0+.2;x<x1;x+=.25)stroke(c,[x,ym,peak],[x,y1-.03,rz+1],'#9a473a');
   stroke(c,[x0,y1,rz],[x1,y1,rz],'#e8b04a',2);
   face(c,[[x1+.01,y0+.05,rz],[x1+.01,ym,peak-2],[x1+.01,y1-.05,rz]],'#e8b04a',C.ink);face(c,[[x1+.02,y0+.2,rz+1],[x1+.02,ym,peak-5],[x1+.02,y1-.2,rz+1]],'#8a3f34');
   stroke(c,[x0,ym,peak],[x1,ym,peak],C.ink,3);stroke(c,[x0,ym,peak+1],[x1,ym,peak+1],'#e8b04a');
   for(const[x,y,z]of[[x0,y1,rz],[x1,y1,rz],[x1,y0,rz]]){const[px,py]=q(x,y,z);P(c,[[px-3,py+1],[px+3,py+1],[px+(x<1?-5:5),py-6]],'#e8b04a');}
   for(const x of [x0,x1]){const[px,py]=q(x,ym,peak);P(c,[[px-2,py],[px+2,py],[px+(x<1?-4:4),py-8]],'#e8b04a');}
  }
  // Big lantern strings and banners at level 3.
  if(level>=3){
   for(const[x,y,col]of[[.05,h-.05,'#6f9ad1'],[w-.05,h-.05,'#7fae5a']]){const[px,py]=q(x,y,0);R(c,px-1,py-50,2,50,'#6b4f3a');R(c,px-2,py-53,4,3,'#e8b04a');R(c,px+1,py-48,8,22,col);R(c,px+1,py-48,8,2,ArtShade(col,40));R(c,px+3,py-42,4,4,'#f4e5c9');P(c,[[px+1,py-26],[px+9,py-26],[px+5,py-21]],col);}
   for(const[a,b]of[[[sx,fy,pz],[.05,h-.05,50]],[[sx+sw,fy,pz],[w-.05,h-.05,50]]]){
    const n=4,pt=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t-12*4*t*(1-t)];
    for(let k=0;k<12;k++)stroke(c,pt(k/12),pt((k+1)/12),'#5a463f');
    for(let k=1;k<n;k++){const[lx,ly]=q(...pt(k/n));R(c,lx,ly,1,3,'#5a463f');paperLantern(c,lx,ly+9,lcol[(k+1)%4],(k+frame)%2,1.1);}
   }
  }
  // Audience benches in front.
  for(const[y,dx]of[[sd+.65,0],[sd+1.05,.15]])for(const x of [.35+dx,1.95+dx])festBench(c,x,y,1.05);
  festLantern(c,.15,h-.2,frame,22);if(level<3)festLantern(c,w-.15,h-.2,frame,22);
 });
}
/** Small festival props. kind: 'bunting' (flag cord between two poles 2 tiles apart along x), 'lantern' (floating sky lantern),
 * 'confetti', 'balloon'. frame 0/1 animates. Foot (footX,footY) is the ground point the prop stands on (for 'lantern' and
 * 'confetti' it is the point directly beneath them). */
export function makeFestivalDecor(kind='bunting',frame=0){
 if(kind==='bunting')return stamp(80,64,14,52,c=>{festPole(c,0,0,34,'#e8b04a');festPole(c,2,0,34,'#e8b04a');festFlags(c,[0,0,32],[2,0,32],7+frame,frame);});
 if(kind==='lantern')return stamp(28,64,14,60,c=>{
  // Khom loi: a glowing paper lantern drifting high above its foot point, a soft shadow under it.
  E(c,0,0,4,1.5,'#5f705030');const y=-34-frame;
  E(c,0,y,11,12,frame?'#f4b86030':'#f4b86024');E(c,0,y,7,8,'#f4b86030');
  P(c,[[-5,y-9],[5,y-9],[6,y+5],[-6,y+5]],'#f4d48a');P(c,[[-4,y-8],[1,y-8],[1,y+4],[-5,y+4]],'#fff1c4');R(c,-6,y+5,13,1,'#c9584a');R(c,-5,y-10,11,1,'#e8b04a');
  R(c,-1,y+6,3,2,frame?'#fff6dc':'#f4b860');R(c,0,y+5,1,1,'#ffffff');
 });
 if(kind==='confetti')return stamp(48,44,24,40,c=>{const r=rng(91+frame*17);
  for(let k=0;k<18;k++){const x=(r()-.5)*40,y=-4-r()*32,col=FEST[k%FEST.length];if((k+frame)%3===0)R(c,x,y,1,2,col);else R(c,x,y,2,1,col);}
  for(let k=0;k<6;k++){const[px,py]=q((r()-.5)*.8,(r()-.5)*.8,0);R(c,px,py,1,1,FEST[(k+2)%FEST.length]);}});
 // balloon
 return stamp(28,60,14,56,c=>{const sway=frame?1:-1,col='#d9584a',bx=sway,by=-38;
  E(c,0,0,3,1.5,'#5f705040');R(c,-1,-3,3,3,'#8a6446');
  for(let k=0;k<12;k++){const t=k/12;R(c,Math.round(bx*t*t+Math.sin(t*6)*.6),Math.round(-3+(by+8)*t),1,3,'#e6dfcc');}
  E(c,bx,by,7,8,ArtShade(col,-25));E(c,bx-1,by-1,6,7,col);E(c,bx-3,by-4,2,3,ArtShade(col,55));P(c,[[bx-2,by+9],[bx+2,by+9],[bx,by+7]],ArtShade(col,-25));
 });
}
/** The heroes' monument, footprint 2×2: a stepped stone plinth and a bronze adventurer raising a sword.
    Level 2 adds flower beds and lanterns; level 3 gilds the statue and adds banners. */
export function makeMonument(level=1){
 return stamp(110,170,55,110,c=>{
  top(c,-.15,-.1,2.35,2.3,0,'#5f705040');
  top(c,0,0,2,2,0,'#cfc6ae',C.edge);
  if(level>=2)for(const [x,y] of [[.05,.05],[1.55,.05],[.05,1.55],[1.55,1.55]]){top(c,x,y,.4,.4,.5,'#7f9a62');for(let k=0;k<3;k++){const[px,py]=q(x+.1+k*.1,y+.2,2);R(c,px,py,2,2,['#e8a0b0','#f4d48a','#c9a0e0'][k]);}}
  cube(c,.3,.3,1.4,1.4,0,8,'#a9a594','#cfcab8','#8d897a');
  cube(c,.45,.45,1.1,1.1,8,14,'#b8b4a2','#dedac8','#99957f');
  if(level>=3){const[px,py]=q(1.55,1.0,15);R(c,px-3,py-5,8,6,'#e8c070');R(c,px-2,py-4,6,1,'#fff1c4');}
  // The statue: a striding adventurer, sword raised, cape behind.
  const metal=level>=3?['#e8c070','#f8e2a0','#b08a3a']:['#7f9a8a','#a9c4b4','#5f786a'];
  const[x,y]=q(1,1,22);
  P(c,[[x-7,y-10],[x+6,y-12],[x+8,y-2],[x-9,y]],metal[2]);
  R(c,x-5,y-2,4,14,metal[0]);R(c,x+1,y-2,4,14,metal[0]);R(c,x-5,y-2,2,14,metal[1]);
  R(c,x-6,y-18,12,17,metal[0]);R(c,x-6,y-18,4,17,metal[1]);R(c,x-6,y-8,12,2,metal[2]);
  E(c,x,y-23,5,5,metal[0]);E(c,x-1,y-24,3,3,metal[1]);
  R(c,x+5,y-26,3,10,metal[0]);R(c,x+6,y-48,2,24,metal[1]);R(c,x+4,y-26,6,2,metal[2]);
  R(c,x-10,y-14,5,4,metal[0]);
  if(level>=2)for(const [lx,ly] of [[-.1,1.9],[2,1.9]]){const[px,py]=q(lx,ly,0);R(c,px-1,py-16,2,16,'#5a463f');E(c,px,py-18,3,3,'#f4b860');E(c,px,py-19,1.5,1.5,'#fff1c4');}
  if(level>=3)for(const [lx,ly] of [[0,.2],[.2,0]]){const[px,py]=q(lx,ly,0);R(c,px,py-40,1,40,'#5a463f');P(c,[[px+1,py-40],[px+12,py-36],[px+1,py-31]],'#b85a4a');}
 });
}
