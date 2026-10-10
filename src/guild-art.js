import { FACILITIES } from './content.js';

// Original pixel artwork. Every floor and object uses the same 2:1 projection.
const {rect:R,poly:P,line:L,ellipse:E,rng,createCanvas}=window.ArtCore;
export const CELL_W=24;
export const CELL_H=12;
export const ORIGIN_X=500;
export const ORIGIN_Y=80;
export const gridPoint=(x,y)=>({x:ORIGIN_X+(x-y)*CELL_W,y:ORIGIN_Y+(x+y)*CELL_H});
export function gridPosition(x,y){const a=(x-ORIGIN_X)/CELL_W,b=(y-ORIGIN_Y)/CELL_H;return{x:(a+b)/2,y:(b-a)/2};}
export function gridPolygon(x,y,w,h){return [[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([a,b])=>gridPoint(a,b));}
const C={ink:'#695345',edge:'#85634c',wood:'#b98a60',light:'#e5bc87',cream:'#f4e5c9',plaster:'#e0d8bc',stone:'#b8b7a2',green:'#879f73'};
const q=(x,y,z=0)=>[(x-y)*CELL_W,(x+y)*CELL_H-z];
function face(c,points,color,edge){const p=points.map(v=>q(...v));P(c,p,color);if(edge)for(let i=0;i<p.length;i++)L(c,...p[i],...p[(i+1)%p.length],edge);}
function top(c,x,y,w,h,z,color,edge){face(c,[[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z]],color,edge);}
function cube(c,x,y,w,h,z,height,color=C.wood,light=C.light,dark=C.edge){
 face(c,[[x,y+h,z],[x+w,y+h,z],[x+w,y+h,z+height],[x,y+h,z+height]],color,C.ink);
 face(c,[[x+w,y,z],[x+w,y+h,z],[x+w,y+h,z+height],[x+w,y,z+height]],dark,C.ink);
 top(c,x,y,w,h,z+height,light,C.ink);
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
 for(let z=4;z<25;z+=10){face(c,[[.08,.29,z],[w-.08,.29,z],[w-.08,.29,z+8],[.08,.29,z+8]],'#736252');
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
function furnace(c){cube(c,0,0,.65,.65,0,15,'#b2b5a8','#ded6bc','#8c968a');face(c,[[.13,.66,4],[.5,.66,4],[.5,.66,12],[.13,.66,12]],'#666b62',C.ink);stroke(c,[.19,.67,5],[.44,.67,8],'#dd9e6b',3);stroke(c,[.25,.67,5],[.37,.67,10],'#f2d595',2);}
function dummy(c){
 cube(c,0,0,.65,.35,0,2,'#b79a70','#dec194','#8b7156');const[x,y]=q(.32,.18);R(c,x-1,y-26,3,25,C.edge);L(c,x-10,y-18,x+10,y-18,C.edge,3);E(c,x,y-30,6,7,'#a07d57');E(c,x-1,y-32,5,5,'#d4b687');R(c,x-5,y-23,10,8,'#bc9363');R(c,x-4,y-22,8,2,'#e2c89c');
}
export function makeRoom(f){
 const d=FACILITIES[f.type],w=d.w,h=d.h,layers=[];
 const add=(name,x,y,paint,sort=0,spec)=>layers.push({name,x,y,sort,sprite:spec||object(paint)});
 add('floor',0,0,null,-9500,stamp((w+h)*24+10,(w+h)*12+14,h*24+5,4,c=>{
  cube(c,0,0,w,h,-5,5,'#ae9c80','#e0c194','#8d806b');plank(c,0,0,w,h);
  if(f.type==='infirmary')top(c,.15,.2,w-.3,h-.4,.1,'#c9d2bb48');
 }));
 if(f.type!=='garden'){
  for(let i=0;i<w;i++)add('wall-x-'+i,i,0,c=>{wall(c,'x',1);if(i===Math.floor(w/2))windowOn(c,'x');},6);
  for(let j=0;j<h;j++)add('wall-y-'+j,0,j,c=>{wall(c,'y',1);if(j===1)windowOn(c,'y');},6);
 }
 const furniture=(name,x,y,paint,w=1,h=1)=>add(name,x,y,paint,(w+h)*6);
 const pot=(x,y,flowers=false)=>furniture('plant-'+x+'-'+y,x,y,c=>plant(c,flowers),.32,.32);
 if(f.type==='reception'){
  add('rug',1,1.12,c=>rug(c,2,1.45,'#c69487'),-9000);
  furniture('records',.20,.12,c=>shelf(c,1.2),1.2,.3);
  furniture('desk',1.45,.35,c=>{table(c,1.95,.86);top(c,.5,.12,.6,.45,17.2,'#f7ead0',C.edge);stroke(c,[.59,.19,17.3],[.98,.19,17.3],'#c2ab8b');stroke(c,[.59,.3,17.3],[.86,.3,17.3],'#c2ab8b');cube(c,1.35,.25,.17,.17,17,5,'#b28c62','#e2bc85','#8d6a54');},1.95,.86);
  furniture('chair',1.9,1.45,stool,.36,.36);pot(3.3,2.3,true);
 }else if(f.type==='dorm'){
  furniture('bed-a',.28,.3,c=>bed(c,'#b5abc9'),.92,1.55);furniture('bed-b',2.62,.3,c=>bed(c,'#a8bbc4'),.92,1.55);
  furniture('nightstand',1.6,.25,c=>{table(c,.52,.48);const[x,y]=q(.25,.23,17);R(c,x-1,y-8,2,7,C.edge);P(c,[[x-5,y-5],[x-3,y-10],[x+3,y-10],[x+5,y-5]],'#f1dfbb');},.52,.48);
  add('rug',1.35,1.5,c=>rug(c,1.3,.75,'#c4aea5'),-9000);
 }else if(f.type==='infirmary'){
  furniture('medical-bed',.28,.3,c=>bed(c,'#a0baa5',true),.92,1.55);furniture('medicine',1.5,.15,c=>shelf(c,1.12),1.12,.3);pot(2.22,1.25);
 }else if(f.type==='kitchen'||f.type==='lounge'){
  furniture('cabinet',.25,.15,c=>shelf(c,1.2),1.2,.3);furniture('stove',.3,1.1,furnace,.65,.65);
  furniture('dining',1.6,1.05,c=>{table(c,1.6,.9);top(c,.18,.14,1.22,.55,17.2,'#f2e5cb');for(const[x,y]of[[.36,.3],[1.18,.4]]){const[p,t]=q(x,y,18);E(c,p,t,4,2,'#fff0d6');E(c,p,t,2,1,'#c3a876');}cube(c,.7,.26,.25,.19,17.3,3,'#d4a575','#f1cb8e','#aa805a');},1.6,.9);
  furniture('bench',1.65,2.12,c=>{cube(c,0,0,1.5,.25,0,8,'#bc956d','#e3bd8b','#997858');},1.5,.25);pot(3.35,.3);
 }else if(f.type==='training'){
  add('rug',.6,1.08,c=>rug(c,2.65,1.55,'#bfbd96'),-9000);furniture('dummy-a',.6,.55,dummy,.65,.35);furniture('dummy-b',2.6,.55,dummy,.65,.35);
  furniture('weapons',1.6,.2,c=>{cube(c,0,0,.48,.32,0,5);for(let i=0;i<3;i++){const[x,y]=q(.1+i*.15,.18,6);R(c,x,y-24,1,23,'#b8c5b5');R(c,x-3,y-8,7,2,C.edge);R(c,x,y-6,2,5,'#ad8563');}},.48,.32);
 }else if(f.type==='workshop'){
  furniture('tools',.25,.12,c=>shelf(c,2.25),2.25,.3);furniture('workbench',.35,1.0,c=>{table(c,1.65,.65);cube(c,.6,.18,.6,.28,17,5,'#929b94','#c5ccc0','#717f79');const[x,y]=q(1.22,.33,18);L(c,x,y,x+5,y-5,C.edge,2);L(c,x+3,y-6,x+7,y-3,'#a3aaa0',3);},1.65,.65);furniture('forge',2.05,1.85,furnace,.65,.65);
 }else if(f.type==='garden'){
  for(let y=.3;y<2.5;y+=.8)for(let x=.3;x<2.5;x+=.8)furniture('herbs-'+x+'-'+y,x,y,c=>{cube(c,0,0,.6,.5,0,4,'#a18b6b','#c5b092','#8d8065');for(let i=0;i<3;i++){const[a,b]=q(.1+i*.17,.22,6);P(c,[[a-3,b],[a-4,b-4],[a,b-3],[a+2,b-7],[a+4,b-2],[a+3,b]],'#87a076');R(c,a,b-5,2,2,'#dec6a1');}},.6,.5);
 }else if(f.type==='library'){
  furniture('books',.25,.1,c=>shelf(c,2.35),2.35,.3);furniture('reading',.8,1.25,c=>{table(c,1.45,.8);top(c,.3,.18,.68,.43,17.2,'#f0e4c8',C.edge);stroke(c,[.64,.18,17.4],[.64,.61,17.4],C.edge);},1.45,.8);furniture('chair',1.22,2.26,stool,.36,.36);
 }else{
  furniture('maps',.3,.12,c=>shelf(c,2.2),2.2,.3);furniture('planning-table',.6,1.1,c=>{table(c,1.65,.95);top(c,.22,.17,1.15,.56,17.2,'#dbe0bd',C.edge);stroke(c,[.35,.25,17.3],[1.18,.57,17.3],'#9caf9b');},1.65,.95);pot(2.4,2.3);
 }
 // Low near cuts expose the room; the gap on y=h is its usable doorway.
 for(let i=0;i<w;i++)if(i!==Math.floor(w/2))add('cut-x-'+i,i,h,c=>wall(c,'x',1,5),6);
 for(let j=0;j<h;j++)add('cut-y-'+j,w,j,c=>wall(c,'y',1,5),6);
 return{layers};
}
function earthPath(c,points,width){const p=points.map(([x,y])=>gridPoint(x,y));c.lineJoin='round';c.lineCap='round';c.beginPath();p.forEach((v,i)=>i?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y));c.strokeStyle='#a5a47c';c.lineWidth=width+6;c.stroke();c.strokeStyle='#d9c6a0';c.lineWidth=width;c.stroke();c.strokeStyle='#e4d1ac';c.lineWidth=width-5;c.stroke();}
export function makeGround(state){
 const canvas=createCanvas(1200,900),c=canvas.getContext('2d'),r=rng(730);
 R(c,0,0,1200,900,'#9cac7d');
 for(let i=0;i<2100;i++){const x=r()*1200,y=r()*900;E(c,x,y,5+r()*18,2+r()*6,i%3?'#97a776':'#a8b586');}
 for(let i=0;i<6500;i++){const x=r()*1200,y=r()*900;R(c,x,y,1+r()*3,1,i%5===0?'#c2ca9a':'#8fa477');if(i%31===0){R(c,x,y-2,1,3,'#879b6b');R(c,x+2,y-1,1,2,'#b9c68d');}}
 earthPath(c,[[-8,12],[2,12],[8,12],[17,12],[25,12]],30);earthPath(c,[[17,-9],[17,2],[17,12],[17,24]],28);earthPath(c,[[1,-7],[1,4],[1,12],[1,22]],24);
 const fs=state.facilities;if(fs.length){
  const x=Math.min(...fs.map(f=>f.x))-.2,y=Math.min(...fs.map(f=>f.y))-.2,w=Math.max(...fs.map(f=>f.x+FACILITIES[f.type].w))-x+.2,h=Math.max(...fs.map(f=>f.y+FACILITIES[f.type].h))-y+.2;
  c.save();c.translate(ORIGIN_X,ORIGIN_Y);cube(c,x,y,w,h,-6,6,'#aca78c','#d6c29d','#8e927b');plank(c,x,y,w,h);c.restore();
  earthPath(c,[[x+1.8,y+h+.3],[x+1.8,12]],19);
 }
 // A shallow pond has a stepped, irregular shoreline and reed clusters.
 const pond=[[88,380],[132,362],[184,378],[215,407],[200,448],[153,473],[98,461],[65,429]];
 P(c,pond,'#8f9f7c');P(c,pond.map(([x,y])=>[142+(x-142)*.93,415+(y-415)*.9]),'#a8c1b2');P(c,[[93,386],[136,376],[180,391],[198,414],[181,441],[150,456],[105,444],[83,420]],'#94b4aa');
 for(let i=0;i<28;i++){const x=100+r()*86,y=390+r()*52;R(c,x,y,5+r()*10,1,'#c9d8bd');}
 for(const[x,y]of[[83,394],[101,463],[202,418]]){L(c,x,y,x-3,y-12,'#788f69');L(c,x+3,y,x+5,y-16,'#829868');R(c,x+4,y-17,3,5,'#ad9170');}
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
export function makeOutdoor(type){
 return object(c=>{
  if(type==='well'){
   cube(c,0,0,1,1,0,10,'#b9b9a4','#e2d9bb','#999f8f');top(c,.18,.18,.64,.64,10.1,'#6b8d88',C.ink);
   for(const[x,y]of[[.1,.2],[.86,.8]])cube(c,x,y,.1,.1,10,26,C.wood,C.light,C.edge);
   face(c,[[-.12,.08,34],[.48,.08,48],[.48,1.05,48],[-.12,1.05,34]],'#c4a282',C.edge);face(c,[[.48,.08,48],[1.12,.08,34],[1.12,1.05,34],[.48,1.05,48]],'#a68870',C.edge);stroke(c,[.48,.18,47],[.48,.95,47],C.light,2);for(let y=.28;y<1;y+=.23){stroke(c,[-.12,y,34],[.48,y,48],'#ddbb92');stroke(c,[.48,y,48],[1.12,y,34],'#bb9e7d');}
  }else if(type==='table'){table(c,1.4,.8);top(c,.22,.18,.6,.4,17.2,'#f0e2bd');plant(c);}
  else if(type==='planter'){cube(c,0,0,1.25,.5,0,5,'#b4906a','#d7bb8c','#937653');for(let i=0;i<5;i++){const[x,y]=q(.15+i*.23,.23,7);E(c,x,y-3,4,4,'#91aa81');R(c,x-1,y-6,3,3,i%2?'#e8c59f':'#d8aaa3');}}
  else if(type==='banner'){
   const[x,y]=q(.2,.2);cube(c,0,0,.45,.45,0,4);R(c,x,y-51,2,50,C.edge);R(c,x-15,y-50,31,2,C.edge);P(c,[[x-13,y-48],[x+13,y-48],[x+13,y-25],[x,y-18],[x-13,y-25]],'#ad8175');R(c,x-10,y-45,20,1,'#e0b6a1');R(c,x-1,y-41,3,14,C.cream);R(c,x-6,y-35,13,3,C.cream);R(c,x-3,y-25,7,2,'#e1bc8c');
  }else if(type==='crates'){cube(c,0,0,.6,.6,0,13);cube(c,.72,.15,.45,.45,0,10);stroke(c,[0,.6,2],[.6,.6,11],C.edge);stroke(c,[0,.6,11],[.6,.6,2],C.edge);}
  else plant(c,true);
 });
}
