import { buildingRect,siteRoads,siteDecorations,partitionRect,partitionDoor } from './site.js';
import { FACILITIES,ROOM_TYPES } from './content.js';

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
function cube(c,x,y,w,h,z,height,color=C.wood,light=C.light,dark=C.edge){
 const r=projection?.r||0,yy=r===1||r===2?y:y+h,xx=r===2||r===3?x:x+w;
 face(c,[[x,yy,z],[x+w,yy,z],[x+w,yy,z+height],[x,yy,z+height]],color,C.ink);
 face(c,[[xx,y,z],[xx,y+h,z],[xx,y+h,z+height],[xx,y,z+height]],dark,C.ink);
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
function contains(rect,x,y){return x>=rect.x&&x<rect.x+rect.w&&y>=rect.y&&y<rect.y+rect.h;}
export function makeGround(state){
 const canvas=createCanvas(1200,900),c=canvas.getContext('2d'),r=rng(730);
 R(c,0,0,1200,900,'#9cac7d');
 for(let i=0;i<2000;i++){const x=r()*1200,y=r()*900;E(c,x,y,5+r()*18,2+r()*6,i%3?'#97a776':'#a8b586');}
 for(let i=0;i<6000;i++){const x=r()*1200,y=r()*900;R(c,x,y,1+r()*3,1,i%5===0?'#c2ca9a':'#8fa477');if(i%31===0){R(c,x,y-2,1,3,'#879b6b');R(c,x+2,y-1,1,2,'#b9c68d');}}
 const roads=siteRoads(state),roadAt=(x,y)=>roads.find(p=>contains(p,x,y));
 c.save();c.translate(ORIGIN_X,ORIGIN_Y);
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
 store:{w:2.6,h:2.3,z:32,ridge:'x',roof:'moss',wall:'timber',awning:['#7fa37a','#f4e5c9'],sign:'bag',chimney:[2.1,.5],flowers:true},
};
/** The arena where the guild association holds rank exams: a sand ring with a fence, banners and, as it grows, stands. */
export function makeArena(level=1){
 const w=4,h=3;
 return stamp(220,170,96,100,c=>{
  top(c,-.2,-.2,w+.4,h+.4,0,'#5f705040');
  top(c,0,0,w,h,0,'#d8c39a',C.edge);top(c,.5,.4,w-1,h-.8,.2,'#e3cfa6','#c9b088');
  for(let k=0;k<6;k++){const[x,y]=q(.6+((k*1.7)%2.8),.6+((k*.9)%1.8),.3);R(c,x,y,2,1,'#c9b088');}
  stroke(c,[w/2,.4,.3],[w/2,h-.4,.3],'#fff4dc');
  const post=(x,y)=>cube(c,x-.05,y-.05,.1,.1,0,9,'#8f6a4c','#b98a60','#6f5240');
  for(let x=0;x<=w;x+=.5){post(x,0);}for(let y=.5;y<=h;y+=.5){post(0,y);}
  stroke(c,[0,0,7],[w,0,7],'#b98a60',2);stroke(c,[0,0,7],[0,h,7],'#b98a60',2);
  if(level>=2){cube(c,-.9,-.3,.7,h+.6,0,10,'#a88d6c','#c4b08e','#8f7b61');cube(c,-.6,-.3,.4,h+.6,10,8,'#a88d6c','#d4bf9a','#8f7b61');}
  if(level>=3){cube(c,-.3,-.9,w+.6,.7,0,10,'#a88d6c','#c4b08e','#8f7b61');}
  for(const [x,y,col] of [[0,0,'#d77d6a'],[w,0,'#6f9ad1'],[0,h,'#7fa37a']]){cube(c,x-.05,y-.05,.1,.1,0,34,'#6f5240','#8f6a4c','#5a463f');const[fx,fy]=q(x,y,33);P(c,[[fx,fy],[fx+11,fy+3],[fx,fy+7]],col);L(c,fx,fy,fx+11,fy+3,C.ink);}
  for(let x=0;x<=w;x+=.5)post(x,h);for(let y=.5;y<h;y+=.5)post(w,y);
  stroke(c,[0,h,7],[w,h,7],'#c99d78',2);stroke(c,[w,0,7],[w,h,7],'#c99d78',2);
  const[sx,sy]=q(w/2,h,9);R(c,sx-9,sy-12,18,9,C.ink);R(c,sx-8,sy-11,16,7,'#f4e5c9');R(c,sx-5,sy-9,10,1,'#8a6446');R(c,sx-4,sy-7,8,1,'#8a6446');
 });
}
/** A market stall: counter of goods under a striped canopy. */
export function makeStall(seed=1,variant=0){
 const [a,b]=[['#d77d6a','#f4e5c9'],['#7fa37a','#f4e5c9'],['#6f9ad1','#f4e5c9']][variant%3],goods=['#e2a93c','#d98978','#9fc27a','#e8cd8c','#c98a4a','#b7aec9'];
 return object(c=>{
  top(c,-.1,-.1,1.8,1.3,0,'#5f705040');
  for(const [x,y] of [[0,0],[1.52,0]])cube(c,x,y,.08,.08,0,32,'#8f6a4c','#b98a60','#6f5240');
  cube(c,.05,.1,1.5,.35,0,8,'#a88d6c','#c4b08e','#8f7b61');
  cube(c,0,.6,1.6,.45,0,12,'#b98a60','#e5bc87','#85634c');
  for(let k=0;k<5;k++){const[x,y]=q(.2+k*.3,.82,13);E(c,x-1,y-1,3,2,goods[(k+variant)%6]);E(c,x+2,y,2.5,1.8,goods[(k+variant+2)%6]);R(c,x-1,y-3,1,1,'#fff8e7');}
  for(const [x,y] of [[0,.95],[1.52,.95]])cube(c,x,y,.08,.08,0,27,'#8f6a4c','#b98a60','#6f5240');
  for(let k=0;k<6;k++){const u0=-.06+k*.285;face(c,[[u0,-.12,35],[u0+.285,-.12,35],[u0+.285,1.12,28],[u0,1.12,28]],k%2?b:a,C.ink);}
  for(let k=0;k<6;k++){const u0=-.06+k*.285;face(c,[[u0,1.12,28],[u0+.285,1.12,28],[u0+.285,1.12,24],[u0,1.12,24]],k%2?a:b,C.edge);}
  for(let k=0;k<2;k++){const[x,y]=q(1.75,.3+k*.4,0);R(c,x-4,y-9,9,9,'#85634c');R(c,x-3,y-8,7,7,'#c79b6a');R(c,x-3,y-5,7,1,'#a3805a');}
 },120,110,56,66);
}
export function makeHome(name,seed=1){
 const s=HOME_STYLES[name]||HOME_STYLES.thatch,{w,h,z,ridge,storeys=1}=s,pitch=s.pitch||(ridge==='y'?w:h)*11,o=.16,[r0,r1,rl,rk]=ROOFS[s.roof],[w0,w1]=WALLS[s.wall],r=rng(seed),peak=z+pitch;
 let smoke=null;const footX=Math.ceil(h*24)+30,footY=peak+40,result=stamp(Math.ceil((w+h)*24)+60+(s.forge?40:0),footY+Math.ceil((w+h)*12)+30,footX,footY,c=>{
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
   if(storeys===1||true){const zb=z+pitch*.3;quad((u,zz)=>[u,h+o+.02,zz],w/2-.2,w/2+.2,zb,zb+9,'#7a5f4a');quad((u,zz)=>[u,h+o+.02,zz],w/2-.15,w/2+.15,zb+1,zb+8,'#a5c0b8');}
   stroke(c,[w/2,-o,peak],[w/2,h+o,peak],C.ink,3);
  }else{
   face(c,[[-o,-o,z],[w+o,-o,z],[w+o,h/2,peak],[-o,h/2,peak]],r1,C.ink);face(c,[[-o,h/2,peak],[w+o,h/2,peak],[w+o,h+o,z],[-o,h+o,z]],r0,C.ink);
   for(let x=.1;x<w+o;x+=thatch?.17:.3)stroke(c,[x,h/2,peak],[x,h+o-.05,z+1],thatch?rl:rk);
   for(let k=1;k<4;k++){const f=k/4;stroke(c,[-o,h+o-(h/2+o)*f,z+pitch*f],[w+o,h+o-(h/2+o)*f,z+pitch*f],rl);}
   face(c,[[w+o+.01,0,z],[w+o+.01,h/2,peak-3],[w+o+.01,h,z]],w1,C.ink);stroke(c,[w+o,-o,z],[w+o,h/2,peak],C.ink,3);stroke(c,[w+o,h/2,peak],[w+o,h+o,z],C.ink,3);
   {const zb=z+pitch*.3;quad((u,zz)=>[w+o+.02,u,zz],h/2-.18,h/2+.18,zb,zb+8,'#7a5f4a');quad((u,zz)=>[w+o+.02,u,zz],h/2-.13,h/2+.13,zb+1,zb+7,'#a5c0b8');}
   stroke(c,[-o,h/2,peak],[w+o,h/2,peak],C.ink,3);
   if(s.dormer){const u=w*.35,zz=z+pitch*.35;cube(c,u,h*.6,.6,.35,zz-6,12,w0,r0,w1);face(c,[[u-.06,h*.6+.37,zz+6],[u+.3,h*.6+.37,zz+14],[u+.66,h*.6+.37,zz+6]],r1,C.ink);quad((uu,z2)=>[uu,h*.6+.36,z2],u+.15,u+.45,zz-3,zz+5,'#a5c0b8',C.ink);}
  }
  if(thatch){const eave=ridge==='x'?[[-o,h+o],[w+o,h+o]]:[[-o,h+o],[-o,-o]];for(let k=0;k<=24;k++){const f=k/24,[x,y]=q(eave[0][0]+(eave[1][0]-eave[0][0])*f,eave[0][1]+(eave[1][1]-eave[0][1])*f,z);R(c,x,y,1,2+(k%3),k%2?rk:r0);}}
  // Chimney, then the special touches.
  if(s.chimney){const [cx,cy]=s.chimney,base=ridge==='y'?z+pitch*(1-Math.abs(cx+.18-w/2)/(w/2+o)):z+pitch*(1-Math.abs(cy+.18-h/2)/(h/2+o));cube(c,cx,cy,.36,.36,base-8,22,'#b8b0a0','#d6cfbe','#948c7d');top(c,cx+.06,cy+.06,.24,.24,base+14.2,'#4f4540');smoke=q(cx+.18,cy+.18,base+16);}
  if(s.forge){cube(c,w+.15,.3,.9,1.5,0,18,'#a59e8b','#8f877a','#857d70');face(c,[[w+.1,.2,24],[w+1.15,.2,16],[w+1.15,1.9,16],[w+.1,1.9,24]],r1,C.ink);quad((u,zz)=>[w+1.05,u,zz],.55,1.25,0,11,'#3f3530');quad((u,zz)=>[w+1.06,u,zz],.7,1.1,1,6,'#e8935a');quad((u,zz)=>[w+1.07,u,zz],.8,1,1,4,'#fff1c4');cube(c,w+1.3,1.55,.35,.22,0,6,'#5f5a5a','#8a8484','#4a4545');cube(c,w+1.22,1.5,.5,.32,6,3,'#5f5a5a','#9a9494','#4a4545');}
  if(s.sign){const at=ridge==='x'?F:S,u=ridge==='x'?w-.12:.12,[sx,sy]=q(...(at===F?F(w+.05,z-6):S(-.05,z-6)));R(c,sx,sy,9,1,C.ink);R(c,sx+2,sy+1,1,3,C.ink);R(c,sx+7,sy+1,1,3,C.ink);R(c,sx,sy+4,10,9,C.edge);R(c,sx+1,sy+5,8,7,'#e8c99a');
   if(s.sign==='bread'){E(c,sx+5,sy+9,3,2,'#c98a4a');R(c,sx+3,sy+8,1,1,'#f0c890');R(c,sx+6,sy+8,1,1,'#f0c890');}else if(s.sign==='sword'){R(c,sx+5,sy+6,1,6,'#8f9a98');R(c,sx+3,sy+10,5,1,'#8a6446');R(c,sx+5,sy+11,1,2,'#8a6446');}else if(s.sign==='bag'){R(c,sx+3,sy+7,4,5,'#c9a06a');R(c,sx+4,sy+6,2,1,'#8a6446');R(c,sx+3,sy+8,4,1,'#e8c070');}else if(s.sign==='anvil'){R(c,sx+2,sy+7,6,2,'#5f5a5a');R(c,sx+4,sy+9,2,2,'#5f5a5a');R(c,sx+3,sy+11,4,1,'#5f5a5a');}else{R(c,sx+3,sy+7,4,5,'#e8c070');R(c,sx+3,sy+6,4,1,'#fff7ea');R(c,sx+7,sy+8,1,3,'#b8946a');}}
  if(s.lantern){const [lx,ly]=q(...F(.15,z/2-4));R(c,lx-2,ly-6,5,6,'#5a463f');R(c,lx-1,ly-5,3,4,'#f4d48a');R(c,lx,ly-8,1,2,'#5a463f');}
  if(s.woodpile){for(let k=0;k<3;k++)for(let m=0;m<3-k;m++){const [lx,ly]=q(w+.18,.3+m*.28+k*.14,3+k*5);E(c,lx,ly,2.6,2.6,'#8a6446');E(c,lx,ly,1.4,1.4,'#d9b083');}}
 });
 if(smoke)result.smoke={x:smoke[0],y:smoke[1],dark:s.smoke==='dark'};
 return result;
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
