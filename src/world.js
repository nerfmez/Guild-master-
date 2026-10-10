import { SITE_COTTAGES,SITE_TREES,SITE_BUSHES,siteDecorations,buildingRect,partitionSize,partitionRect,pointInRect } from './site.js';
import { FACILITIES } from './content.js';
import { getRoomSize,getFacilityEntry,findWalkPath,getWalkableSpots,canPlaceFacility,canPlacePartition,previewPartitionMove } from './game.js';
import { makeActorTexture } from './render.js';
import { makeBuilding,makePartition,makeRoom,makeGround,makeCottage,makeOutdoor,gridPoint,gridPosition,gridPolygon,CELL_W,CELL_H,ORIGIN_X,ORIGIN_Y } from './guild-art.js';

const hash=s=>[...String(s)].reduce((a,c)=>(Math.imul(a,31)+c.charCodeAt(0))>>>0,17);
export class GuildRenderer {
 constructor(canvas,onSelect=()=>{}){
  this.canvas=canvas;this.onSelect=onSelect;this.state={facilities:[],members:[],missions:[]};
  this.zoom=1;this.actors=new Map();this.rooms=[];this.furnitureSprites=[];this.signature='';this.buildType=null;this.moveId=null;this.rotation=0;this.siteProps=[];this.roomMode=null;this.roomMoveId=null;
  this.pointers=new Map();this.elapsed=0;this.ready=false;this.frozen=new URLSearchParams(location.search).has('still');
  const box=canvas.parentElement.getBoundingClientRect();
  this.width=Math.round(box.width);this.height=Math.round(box.height);
  // Android content providers can restrict GPU contexts for downloaded files.
  let context=null;
  if(location.protocol!=='content:'){try{context=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true})||canvas.getContext('experimental-webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});if(context?.isContextLost())context=null;}catch{}}
  this.start(context?Phaser.WEBGL:Phaser.CANVAS,context);
  // Mobile browsers may wipe canvases of a backgrounded tab; baked textures are then blank.
  this.repairs=[];const check=()=>{if(!document.hidden)this.checkScene();};
  setInterval(check,3000);document.addEventListener('visibilitychange',()=>setTimeout(check,400));window.addEventListener('pageshow',()=>setTimeout(check,400));
 }
 sceneBlank(){
  // A wiped texture canvas reads as fully transparent, although it was painted opaque.
  if(this.grassCanvas){try{if(this.grassCanvas.getContext('2d').getImageData(0,0,1,1).data[3]===0)return true;}catch{}}
  // At the default view the hall is centred; a scene of only the clear colour drew nothing.
  if(this.userPanned||this.zoom!==1||!this.canvas.width||!this.canvas.height)return false;
  try{const probe=this.probe||(this.probe=document.createElement('canvas'));probe.width=40;probe.height=24;const c=probe.getContext('2d',{willReadFrequently:true});c.imageSmoothingEnabled=false;
   const w=this.canvas.width,h=this.canvas.height;c.drawImage(this.canvas,w*.3,h*.3,w*.4,h*.4,0,0,40,24);
   const a=c.getImageData(0,0,40,24).data;let other=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-156)+Math.abs(a[i+1]-172)+Math.abs(a[i+2]-125)>12)other++;
   return other<10;}catch{return false;}
 }
 checkScene(){
  if(!this.ready||Date.now()-this.readyAt<1500||!this.sceneBlank())return;
  const now=Date.now();this.repairs=this.repairs.filter(t=>now-t<60000);
  if(this.repairs.length>=3){window.guildBoot?.show('ฉากกิลด์ไม่แสดงภาพ · R12',null,()=>this.recoverCanvas(undefined,true));return;}
  this.repairs.push(now);console.warn('Guild scene blank; redrawing');window.guildBoot?.note('blank '+(this.renderType===Phaser.WEBGL?'webgl':'canvas')+' '+this.canvas.width+'x'+this.canvas.height);this.recoverCanvas(undefined,true);
 }
 showStatus(text,retry=false){const node=document.getElementById('scene-status');if(!node)return;node.hidden=false;node.querySelector('span').textContent=text;const button=node.querySelector('button');button.hidden=!retry;button.onclick=()=>this.recoverCanvas(undefined,true);}
 start(type,context=null){
  const owner=this,canvas=this.canvas;this.renderType=type;this.showStatus('กำลังเปิดกิลด์…');
  class GuildScene extends Phaser.Scene{
   constructor(){super('guild');}
   create(){owner.scene=this;try{owner.setup();}catch(error){owner.ready=false;owner.recoverCanvas(error);}}
   update(_time,delta){owner.update(Math.min(.05,delta/1000));}
  }
  this.bootTimer=setTimeout(()=>{if(!this.ready)this.recoverCanvas();},10000);
  try{this.game=new Phaser.Game({type,context,canvas,parent:canvas.parentElement,width:this.width,height:this.height,
   backgroundColor:'#9cac7d',pixelArt:true,roundPixels:true,antialias:false,transparent:false,
   scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.NO_CENTER},
   fps:{target:30},input:{activePointers:3,keyboard:false},scene:GuildScene,banner:false,
   render:{preserveDrawingBuffer:true,antialias:false,roundPixels:true}});}catch(error){queueMicrotask(()=>this.recoverCanvas(error));}
 }
 recoverCanvas(error,force=false){
  clearTimeout(this.bootTimer);window.guildBoot?.note('restart'+(error?': '+(error.message||error):this.ready?'':' (timeout)'));
  if(error)console.warn('Guild scene startup:',error.message||error);
  if(this.renderType===Phaser.CANVAS&&!force){this.ready=false;window.guildBoot?.fail(error||new Error('ตัววาดฉาก Canvas เริ่มทำงานไม่สำเร็จ'));const button=document.querySelector('#scene-status button');if(button)button.onclick=()=>this.recoverCanvas(undefined,true);return;}
  const canvas=this.canvas.cloneNode(false);this.canvas.replaceWith(canvas);
  // A failed boot has no next frame to process Phaser's deferred destruction.
  if(this.game){this.game.destroy(false);this.game.runDestroy();}
  this.canvas=canvas;this.ready=false;this.scene=null;this.camera=null;this.actors=new Map();this.rooms=[];this.furnitureSprites=[];this.siteProps=[];this.idleKey=null;this.pointers.clear();this.drag=null;this.pinch=null;
  this.start(Phaser.CANVAS);
 }
 texture(key,canvas){const t=this.scene.textures;if(t.exists(key))t.remove(key);t.addCanvas(key,canvas).setFilter(Phaser.Textures.FilterMode.NEAREST);return key;}
 put(key,sprite,x,y,depth=y){if(!this.scene.textures.exists(key))this.texture(key,sprite.canvas);return this.scene.add.image(x-sprite.footX,y-sprite.footY,key).setOrigin(0).setDepth(depth);}
 setup(){
  this.ready=true;this.camera=this.scene.cameras.main;this.camera.roundPixels=true;
  this.width=this.game.scale.width;this.height=this.game.scale.height;
  const base=makeGround(this.state),grass=document.createElement('canvas');grass.width=128;grass.height=128;
  this.grassCanvas=grass;const gc=grass.getContext('2d');gc.fillStyle='#9cac7d';gc.fillRect(0,0,128,128);let grassSeed=3187;const randomGrass=()=>{grassSeed=(Math.imul(grassSeed,1664525)+1013904223)>>>0;return grassSeed/4294967296;};for(let i=0;i<280;i++){gc.fillStyle=['#97a776','#a8b586','#8fa477','#b9c68d'][i%4];gc.fillRect(Math.floor(randomGrass()*128),Math.floor(randomGrass()*128),1+Math.floor(randomGrass()*5),1);}this.texture('meadow',grass);
  this.scene.add.tileSprite(-512,-512,2048,1664,'meadow').setOrigin(0).setDepth(-10000);
  this.groundImage=this.scene.add.image(0,0,this.texture('ground',base.canvas)).setOrigin(0).setDepth(-9999);
  this.decorate();this.ghost=this.scene.add.graphics().setDepth(9999);this.bindInput();
  this.game.scale.on('resize',size=>{this.width=size.width;this.height=size.height;this.applyView();});
  this.center();this.rebuild();this.syncActors();this.canvas.dataset.renderer='Phaser '+(this.renderType===Phaser.WEBGL?'WebGL':'Canvas');
  clearTimeout(this.bootTimer);window.guildBoot?.ready();const status=document.getElementById('scene-status');if(status)status.hidden=true;
  this.readyAt=Date.now();if(this.renderType===Phaser.CANVAS){this.canvas.addEventListener('contextlost',()=>window.guildBoot?.note('context lost'),{once:true});}if(this.renderType===Phaser.CANVAS)this.canvas.addEventListener('contextrestored',()=>this.recoverCanvas(undefined,true),{once:true});
  if(this.renderType===Phaser.WEBGL)this.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();queueMicrotask(()=>this.recoverCanvas());},{once:true});
  this.canvas.dispatchEvent(new CustomEvent('guild-renderer-ready'));
 }
 decorate(){
  const N=window.VillageNature;
  for(const[x,y,seed,gold]of SITE_TREES){const p=gridPoint(x,y);this.put('tree-'+seed,N.makeTree({seed,season:gold?'gold':'green',kind:seed%4===0?'oak':'birch'}),p.x,p.y);}
  for(const c of SITE_COTTAGES){const p=gridPoint(c.x,c.y);this.put('cottage-'+c.seed,makeCottage({seed:c.seed}),p.x,p.y,p.y+30);}
  for(const[x,y,seed,gold]of SITE_BUSHES){const p=gridPoint(x,y);this.put('bush-'+seed,N.makeBush({seed,gold:!!gold}),p.x,p.y);}
 }

 setState(state){
  this.state=state;const signature=JSON.stringify([state.grid,state.building,state.rooms,state.facilities.map(f=>[f.id,f.type,f.x,f.y,f.level,f.rotation])]);
  if(signature!==this.signature){this.signature=signature;if(this.ready)this.rebuild();}
  if(this.ready)this.syncActors();
 }
 rebuild(){
  if(!this.ready)return;for(const image of this.rooms)image.destroy();this.rooms=[];this.furnitureSprites=[];
  const terrain=makeGround(this.state);this.groundImage.setTexture(this.texture('ground',terrain.canvas));
  for(const image of this.siteProps)image.destroy();this.siteProps=[];
  for(const d of siteDecorations(this.state)){const p=gridPoint(d.x,d.y);this.siteProps.push(this.put('outside-'+d.type,makeOutdoor(d.type),p.x,p.y,p.y+12));}
  for(const part of makeBuilding(this.state).layers){const p=gridPoint(part.x,part.y),key='building-'+part.name;this.rooms.push(this.put(this.texture(key,part.sprite.canvas),part.sprite,p.x,p.y,p.y+part.sort));}
  for(const room of this.state.rooms||[])for(const part of makePartition(room,this.state).layers){const p=gridPoint(part.x,part.y),key='partition-'+room.id+'-'+part.name;this.rooms.push(this.put(this.texture(key,part.sprite.canvas),part.sprite,p.x,p.y,p.y+part.sort));}
  for(const f of this.state.facilities)for(const part of makeRoom(f).layers){const p=gridPoint(f.x+part.x,f.y+part.y),key='furniture-'+f.id+'-'+part.name;const image=this.put(this.texture(key,part.sprite.canvas),part.sprite,p.x,p.y,p.y+part.sort);this.rooms.push(image);this.furnitureSprites.push({f,image,canvas:part.sprite.canvas,alpha:part.sprite.canvas.getContext('2d').getImageData(0,0,part.sprite.canvas.width,part.sprite.canvas.height).data});}
  if(!this.userPanned){const b=buildingRect(this.state),p=gridPoint(b.x+b.w/2,b.y+b.h/2);this.focusX=p.x;this.focusY=p.y+22;this.applyView();}
 }

 roomFor(m){let type=m.waitingReason?'reception':m.injury>0?'infirmary':m.energy<60||m.task==='rest'?'dorm':m.task==='train'?'training':m.task==='work'?'workshop':'reception';
  if(m.task==='rest'&&m.energy>=95&&!m.injury&&!m.waitingReason)type=['reception','kitchen','training','dorm'][hash(m.id)%4];
  return this.state.facilities.find(f=>f.type===type)||this.state.facilities[0];}

 syncActors(){
  const ids=new Set([...this.state.members.map(m=>m.id),'master']);for(const [id,a] of this.actors)if(!ids.has(id)){a.image.destroy();this.actors.delete(id);}
  const idleKey=this.signature+'|'+this.state.members.map(m=>m.id).join(',');if(this.idleKey!==idleKey){this.idleKey=idleKey;const hall=buildingRect(this.state),spots=getWalkableSpots(this.state),claimed=[];this.idleSpots=this.state.members.map((m,i)=>{const desired=[{x:2.5,y:2.5},{x:4.25,y:2},{x:5,y:3.5},{x:1.75,y:2.75}][i%4],tx=hall.x+desired.x,ty=hall.y+desired.y+(Math.floor(i/4)*.6);const p=spots.filter(p=>claimed.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=.8)).sort((a,b)=>(a.x-tx)**2+(a.y-ty)**2-((b.x-tx)**2+(b.y-ty)**2))[0]||spots[i%spots.length];claimed.push(p);return p;});}
  const away=new Set(this.state.missions.filter(m=>['active','decision'].includes(m.status)).flatMap(m=>m.memberIds));
  for(const m of this.state.members){const room=this.roomFor(m),b=room&&getRoomSize(room.type,room.rotation||0),n=hash(m.id);
   if(!b)continue;const roommates=this.state.members.filter(other=>this.roomFor(other)?.id===room.id),slot=roommates.findIndex(other=>other.id===m.id);
   const entry=getFacilityEntry(room),hall=buildingRect(this.state),idle=m.energy>=95&&!m.injury&&m.task==='rest',index=this.state.members.findIndex(other=>other.id===m.id);
   const logical=idle?this.idleSpots[index]:{x:entry.x+(slot-(roommates.length-1)/2)*.22,y:entry.y};
   const target=gridPoint(logical.x,logical.y);
   let a=this.actors.get(m.id);if(!a){
    this.bakeActor(m);
    a={image:this.scene.add.image(target.x,target.y,`actor-${m.id}-${m.class}-south-0`).setOrigin(.5,46/52),x:target.x,y:target.y,clock:n%6,roomId:room.id,class:m.class,direction:['south','east','south','west'][n%4]};this.actors.set(m.id,a);
    // A new arrival walks up the road and in through the front door.
    if(this.arrivals?.delete(m.id)&&!this.frozen){const door=hall.x+hall.w/2,start=gridPoint(door,hall.y+hall.h+3),inside=gridPoint(door,hall.y+hall.h-.5);a.x=start.x;a.y=start.y;a.image.setPosition(start.x,start.y);a.path=[inside,...this.pathBetween(inside.x,inside.y,target.x,target.y)];}
   }
   if(a.class!==m.class){this.bakeActor(m);a.class=m.class;}
   if(a.roomId!==room.id||(a.home&&Math.hypot(a.home.x-target.x,a.home.y-target.y)>3)){a.path=this.pathBetween(a.x,a.y,target.x,target.y);a.roomId=room.id;}
   const anchor=room.x+','+room.y+','+room.rotation;if(a.roomAnchor&&a.roomAnchor!==anchor){a.x=target.x;a.y=target.y;a.path=[];}a.roomAnchor=anchor;
   a.member=m;a.home=target;a.logicalHome=logical;a.away=away.has(m.id);a.image.setVisible(!a.away);if(this.frozen){a.x=target.x;a.y=target.y;}
  }
  this.syncMaster();
 }
 syncMaster(){
  // The player's guild master keeps the reception desk, or waits by the door before it exists.
  const p=this.state.profile,old=this.actors.get('master');
  if(!p){if(old){old.image.destroy();this.actors.delete('master');}return;}
  const m={id:'master',name:p.masterName,class:'master',hair:p.hair,outfit:p.outfit,skin:p.skin,hairStyle:p.hairStyle},look=[p.hair,p.outfit,p.skin,p.hairStyle].join();
  const desk=this.state.facilities.find(f=>f.type==='reception'),hall=buildingRect(this.state);
  const logical=desk?(()=>{const e=getFacilityEntry(desk);return{x:e.x+.35,y:e.y+.2};})():{x:hall.x+hall.w/2,y:hall.y+hall.h-.8};
  const target=gridPoint(logical.x,logical.y);let a=old;
  if(!a){this.bakeActor(m);a={image:this.scene.add.image(target.x,target.y,'actor-master-master-south-0').setOrigin(.5,46/52),x:target.x,y:target.y,clock:0,direction:'south',look};this.actors.set('master',a);}
  else if(a.look!==look){this.bakeActor(m);a.look=look;}
  if(a.home&&Math.hypot(a.home.x-target.x,a.home.y-target.y)>3)a.path=this.pathBetween(a.x,a.y,target.x,target.y);
  a.member=m;a.home=target;a.away=false;a.image.setVisible(true);if(this.frozen){a.x=target.x;a.y=target.y;}
 }
 arrive(ids){this.arrivals??=new Set();for(const id of ids)this.arrivals.add(id);}
 bakeActor(m){for(const direction of ['south','east','north','west'])for(let frame=0;frame<4;frame++)this.texture(`actor-${m.id}-${m.class}-${direction}-${frame}`,makeActorTexture(m,frame*Math.PI/2,frame>0,1,direction));}
 pathBetween(sx,sy,tx,ty){return findWalkPath(this.state,gridPosition(sx,sy),gridPosition(tx,ty)).map(p=>gridPoint(p.x,p.y));}

 update(dt){
  if(!this.ready)return;const playing=!this.frozen&&!document.hidden&&!this.state.settings?.paused&&!document.getElementById('confirm-dialog').open&&!document.getElementById('settings-dialog').open;
  const elapsed=playing?dt*(this.state.settings?.speed||1):0;this.elapsed+=elapsed;
  for(const a of this.actors.values()){
   if(a.away)continue;a.clock+=elapsed;
   if(!a.path?.length&&a.clock>6){a.clock=0;const n=hash(a.member.id+Math.floor(this.elapsed/6));const home=gridPosition(a.home.x,a.home.y),p=gridPoint(home.x+((n%9)-4)*.05,home.y);a.path=[p];}
   const p=a.path?.[0];let walking=false;if(p){const dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy);walking=d>1;
    if(d<=1)a.path.shift();else{const step=Math.min(d,elapsed*22);a.x+=dx/d*step;a.y+=dy/d*step;a.direction=Math.abs(dx)>Math.abs(dy)*1.6?(dx<0?'west':'east'):(dy<0?'north':'south');}}
   const frame=walking&&playing?1+Math.floor(this.elapsed*6)%3:0;a.image.setTexture(`actor-${a.member.id}-${a.member.class}-${a.direction}-${frame}`).setPosition(Math.round(a.x),Math.round(a.y)).setDepth(a.y);
  }

  this.drawGhost();
 }
 applyView(){if(!this.ready)return;const b=buildingRect(this.state),span=(b.w+b.h)*24,tall=(b.w+b.h)*12+40;this.baseZoom=this.width<620?Math.min(1.7,(this.width-28)/(span+110),(this.height-180)/(tall+90)):Math.max(.45,Math.min(3,(this.width-100)/(span+320),(this.height-145)/(tall+110)));this.camera.setViewport(0,0,this.width,this.height);this.camera.setZoom(this.baseZoom*this.zoom);this.camera.centerOn(this.focusX??548,this.focusY??294);}
 center(){this.zoom=1;const b=buildingRect(this.state),p=gridPoint(b.x+b.w/2,b.y+b.h/2);this.focusX=p.x;this.focusY=p.y+22;this.userPanned=false;this.applyView();}

 resetView(){this.center();}
 setZoom(z){this.zoom=Math.max(.6,Math.min(2.4,Number(z)||1));this.applyView();}
 rotatePlacement(){this.rotation=(this.rotation+1)%4;this.drawGhost();return this.rotation;}
 setBuildMode(type){this.roomMode=null;this.roomMoveId=null;this.buildType=type;this.moveId=null;this.rotation=0;this.canvas.style.cursor=type?'crosshair':'grab';}
 setMoveMode(id){this.roomMode=null;this.roomMoveId=null;this.moveId=id;this.buildType=null;this.rotation=this.state.facilities.find(f=>f.id===id)?.rotation||0;this.canvas.style.cursor=id?'crosshair':'grab';}
 setRoomMode(room,id=null){this.buildType=null;this.moveId=null;this.roomMode=room?{...room}:null;this.roomMoveId=id;this.rotation=room?.rotation||0;this.canvas.style.cursor=room?'crosshair':'grab';}
 worldToScreen(x,y){const p=gridPoint(x/32,y/32),z=this.camera?.zoom||1;return{x:(p.x-(this.focusX??548))*z+this.width/2,y:(p.y-(this.focusY??294))*z+this.height/2};}
 screenPoint(e){const b=this.canvas.getBoundingClientRect();return{x:(e.clientX-b.left)*this.width/b.width,y:(e.clientY-b.top)*this.height/b.height};}
 worldPoint(p){const z=this.camera.zoom;return{x:(p.x-this.width/2)/z+this.focusX,y:(p.y-this.height/2)/z+this.focusY};}
 bindInput(){
  const bind=(name,fn,options)=>this.canvas.addEventListener(name,fn,options);
  bind('pointerdown',e=>{const p=this.screenPoint(e);this.canvas.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,p);
   if(this.pointers.size===1)this.drag={id:e.pointerId,start:p,last:p,moved:false};
   if(this.pointers.size===2){const[a,b]=[...this.pointers.values()];this.pinch={dist:Math.hypot(a.x-b.x,a.y-b.y),zoom:this.zoom};this.drag.moved=true;}});
  bind('pointermove',e=>{const p=this.screenPoint(e);this.hover=this.worldPoint(p);if(!this.pointers.has(e.pointerId))return;this.pointers.set(e.pointerId,p);
   if(this.pointers.size===2&&this.pinch){const[a,b]=[...this.pointers.values()];this.setZoom(this.pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/this.pinch.dist);return;}
   if(this.drag?.id===e.pointerId){const d=this.drag;if(Math.hypot(p.x-d.start.x,p.y-d.start.y)>6)d.moved=true;if(d.moved){this.userPanned=true;this.focusX-=(p.x-d.last.x)/this.camera.zoom;this.focusY-=(p.y-d.last.y)/this.camera.zoom;this.applyView();}d.last=p;}});
  bind('pointerup',e=>{const p=this.screenPoint(e);if(this.drag?.id===e.pointerId&&!this.drag.moved)this.select(this.worldPoint(p));this.pointers.delete(e.pointerId);if(this.pointers.size<2)this.pinch=null;if(!this.pointers.size)this.drag=null;});
  bind('pointercancel',e=>{this.pointers.delete(e.pointerId);this.drag=null;this.pinch=null;});bind('pointerleave',()=>{if(!this.drag)this.hover=null;});
  bind('wheel',e=>{e.preventDefault();const p=this.screenPoint(e),before=this.worldPoint(p);this.setZoom(this.zoom*Math.exp(-e.deltaY*.001));const after=this.worldPoint(p);this.focusX+=before.x-after.x;this.focusY+=before.y-after.y;this.applyView();},{passive:false});
 }
 select(p){
  const tile=gridPosition(p.x,p.y),x=Math.round(tile.x*4)/4,y=Math.round(tile.y*4)/4;
  if(this.roomMode){this.onSelect({kind:this.roomMoveId?'moveRoom':'room',x,y,roomId:this.roomMoveId,rotation:this.rotation});return;}
  if(this.buildType){this.onSelect({kind:'build',x,y,rotation:this.rotation});return;}if(this.moveId){this.onSelect({kind:'move',x,y,facilityId:this.moveId,rotation:this.rotation});return;}
  for(const a of [...this.actors.values()].sort((a,b)=>b.y-a.y))if(!a.away&&Math.abs(p.x-a.x)<11&&p.y>a.y-44&&p.y<a.y+4){this.onSelect({kind:'member',id:a.member.id});return;}
  for(const a of [...this.furnitureSprites].sort((a,b)=>b.image.depth-a.image.depth)){const x=Math.floor(p.x-a.image.x),y=Math.floor(p.y-a.image.y);if(x>=0&&y>=0&&x<a.canvas.width&&y<a.canvas.height&&a.alpha[(y*a.canvas.width+x)*4+3]>50){this.onSelect({kind:'facility',id:a.f.id});return;}}
  for(const f of this.state.facilities){const d=getRoomSize(f.type,f.rotation||0);if(tile.x>=f.x&&tile.x<f.x+d.w&&tile.y>=f.y&&tile.y<f.y+d.h){this.onSelect({kind:'facility',id:f.id});return;}}
  for(const room of this.state.rooms||[])if(pointInRect(partitionRect(room),tile)){this.onSelect({kind:'partition',id:room.id});return;}
 }
 drawGhost(){
  this.ghost.clear();if(!this.buildType&&!this.moveId&&!this.roomMode)return;
  const f=this.state.facilities.find(f=>f.id===this.moveId),type=this.buildType||f?.type,d=this.roomMode?partitionSize({...this.roomMode,rotation:this.rotation}):FACILITIES[type]&&getRoomSize(type,this.rotation);if(!d)return;
  const {width:w,height:h}=this.state.grid,g=this.ghost;g.lineStyle(1,0xf4e4b8,.3);
  for(let x=0;x<=w;x++){const a=gridPoint(x,0),b=gridPoint(x,h);g.lineBetween(a.x,a.y,b.x,b.y);}for(let y=0;y<=h;y++){const a=gridPoint(0,y),b=gridPoint(w,y);g.lineBetween(a.x,a.y,b.x,b.y);}
  if(!this.hover)return;const tile=gridPosition(this.hover.x,this.hover.y),x=Math.round(tile.x*4)/4,y=Math.round(tile.y*4)/4,polygon=gridPolygon(x,y,d.w,d.h);
  const key=this.signature+'|'+type+'|'+x+'|'+y+'|'+this.rotation+'|'+this.moveId+'|'+JSON.stringify(this.roomMode);if(this.ghostCheck?.key!==key){const candidate=this.roomMode&&{...this.roomMode,x,y,rotation:this.rotation};const place=candidate?this.roomMoveId?previewPartitionMove(this.state,{roomId:this.roomMoveId,x,y,rotation:this.rotation}):canPlacePartition(this.state,candidate):canPlaceFacility(this.state,type,x,y,this.moveId,this.rotation);this.ghostCheck={key,ok:place.ok};}
  const good=this.ghostCheck.ok,color=good?0x92c583:0xdb8468;g.fillStyle(color,.45);g.fillPoints(polygon,true);g.lineStyle(2,color,1);g.strokePoints(polygon,true);if(this.roomMode){const r=this.rotation,p=r===0?gridPoint(x+d.w/2,y+d.h):r===1?gridPoint(x,y+d.h/2):r===2?gridPoint(x+d.w/2,y):gridPoint(x+d.w,y+d.h/2);g.fillStyle(0xffefd0,1);g.fillCircle(p.x,p.y,4);}
 }

 getInfo(){return{engine:'Phaser',version:Phaser.VERSION,renderer:this.game?.renderer?.type===Phaser.WEBGL?'WebGL':this.game?.renderer?.type===Phaser.CANVAS?'Canvas':'starting',ready:this.ready,viewport:[this.width,this.height],zoom:this.camera?.zoom,projection:'isometric 2:1',roomCount:(this.state.rooms||[]).length,facilityCount:this.state.facilities.length,building:{...this.state.building},drawnParts:this.rooms.length,camera:{width:this.camera?.width,height:this.camera?.height,scrollX:this.camera?.scrollX,scrollY:this.camera?.scrollY,focus:[this.focusX,this.focusY]},canvas:[this.canvas.width,this.canvas.height]};}
 destroy(){clearTimeout(this.bootTimer);this.game?.destroy(false);}
}
