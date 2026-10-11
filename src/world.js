import { SITE_COTTAGES,SITE_TREES,SITE_BUSHES,siteDecorations,siteRoads,buildingRect,partitionSize,partitionRect,pointInRect } from './site.js';
import { FACILITIES,VILLAGE_LOTS,VILLAGE_PROJECTS,HUNT_ZONES,CLASS_COMBAT,MONSTER_STATS,JOBS,VILLAGE_BUSINESSES,JOB_COMBAT } from './content.js';
import { getRoomSize,getFacilityEntry,findWalkPath,getWalkableSpots,canPlaceFacility,canPlacePartition,previewPartitionMove,getVillageInfo,petitionHome } from './game.js';
import { makeActorTexture,villagerLook,applicantLook } from './render.js';
import { drainFx } from './life.js';
import { pathTier, footprintOf, ROTATABLE, homeOf } from './town.js';
const SHOT_COLORS={arrow:0xc9a06a,pierce:0xf3e2b0,magic:0xb7a6ff,bolt:0xf08a4b,fire:0xf08a4b,frostbolt:0x9fd3f0,frost:0x9fd3f0,spark:0xc9dcff,light:0xfff1c4,note:0xf2b8d8};
import { QUESTS,REGIONS } from './content.js';
import { WORLD,QUEST_SITES,SIGNPOSTS,FIELDS,DOCK,LAKE,MEADOW_SCENE,WILD_SCENE,FOOTBRIDGE,questRoute,regionOpen,villageSpotProblem,VILLAGE_FOOTPRINT,monsterSpawns,inWater,biomeAt,makeGroundPainter,setVillagePaths,scatterMeadow,scatterNature,mistTint,makeBridge,makeFog } from './overworld.js';
import { SPECIES,makeMonster,questFoe } from './monsters.js';
import { decorateFrontier } from './frontier-art.js';
import { makeFrontierCamp } from './landmarks.js';
import { makeGreatOak,makeCrystalCave,makeBellTower,makeHeartTree,makeMistGate,makeStoneLantern,makeLostCamp,makeCampfire,makeBreadWagon,makeWatchPost,makeTeaBush,makeTeaBasket,makeSignpost,makeBarricade } from './landmarks.js';
import { makeFieldFence,makeWheat,makeVegPatch,makeScarecrow,makeHayBale,makeWindmill,makeSails,makeReeds,makeLily,makeDock,makeDuck,makeSheep,makeTallGrass,makeDryGrass,makeFlowerPatch,makeMushrooms,makeStump,makeButterfly,makePine,makeWillow,makeFruitTree,makeDeadTree,makeFern,makeFallenLog,makeBerryBush,makeGlowShrooms,makeStandingStone,makeBoulders,makeRuinWall,makePillar,makeBeehive,makeTent,makeChoppingStump,makeDeer,makeGoat,makeFirefly } from './worldart.js';
import { makeBuilding,makePartition,makeRoom,makeGround,makeCottage,makeHome,makeDojo,makeShop,makeSmithyShop,HOME_STYLES,makeOutdoor,makeStall,makeArena,makeMonument,makeFairground,makeStage,makeFestivalDecor,gridPoint,gridPosition,gridPolygon,CELL_W,CELL_H,ORIGIN_X,ORIGIN_Y } from './guild-art.js';

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
  if(this.repairs.length>=3){window.guildBoot?.show('ฉากกิลด์ไม่แสดงภาพ · R40',null,()=>this.recoverCanvas(undefined,true));return;}
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
  this.bootTimer=setTimeout(()=>{if(!this.ready)this.recoverCanvas();},30000);
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
  this.canvas=canvas;this.ready=false;this.scene=null;this.camera=null;this.actors=new Map();this.rooms=[];this.furnitureSprites=[];this.siteProps=[];this.idleKey=null;this.placementKey=null;this.ghostBox=null;this.villageGhost=null;this.pointers.clear();this.drag=null;this.pinch=null;
  this.start(Phaser.CANVAS);
 }
 // Baked canvases are registered as plain image sources: a CanvasTexture would read every pixel back with getImageData, which stalls GPU-backed canvases.
 texture(key,canvas){const t=this.scene.textures;if(t.exists(key))t.remove(key);t.addImage(key,canvas).setFilter(Phaser.Textures.FilterMode.NEAREST);return key;}
 put(key,sprite,x,y,depth=y){if(!this.scene.textures.exists(key))this.texture(key,sprite.canvas);return this.scene.add.image(x-sprite.footX,y-sprite.footY,key).setOrigin(0).setDepth(depth);}
 setup(){
  this.ready=true;this.camera=this.scene.cameras.main;this.camera.roundPixels=true;
  this.width=this.game.scale.width;this.height=this.game.scale.height;
  const base=makeGround(this.state),grass=document.createElement('canvas');grass.width=128;grass.height=128;
  this.grassCanvas=grass;const gc=grass.getContext('2d');gc.fillStyle='#9cac7d';gc.fillRect(0,0,128,128);let grassSeed=3187;const randomGrass=()=>{grassSeed=(Math.imul(grassSeed,1664525)+1013904223)>>>0;return grassSeed/4294967296;};for(let i=0;i<280;i++){gc.fillStyle=['#97a776','#a8b586','#8fa477','#b9c68d'][i%4];gc.fillRect(Math.floor(randomGrass()*128),Math.floor(randomGrass()*128),1+Math.floor(randomGrass()*5),1);}this.texture('meadow',grass);
  // A flat backdrop under the painted ground; a tiled sprite this size cost about a second to build on tablets.
  this.scene.add.rectangle(-1700,-1200,5400,3000,0x9cac7d).setOrigin(0).setDepth(-10000);
  this.groundImage=this.scene.add.image(0,0,this.texture('ground',base.canvas)).setOrigin(0).setDepth(-9999);
  this.decorate();this.ghost=this.scene.add.graphics().setDepth(9999);this.bindInput();
  this.game.scale.on('resize',size=>{this.width=size.width;this.height=size.height;this.applyView();});
  this.center();this.rebuild();this.syncActors();this.canvas.dataset.renderer='Phaser '+(this.renderType===Phaser.WEBGL?'WebGL':'Canvas');
  clearTimeout(this.bootTimer);window.guildBoot?.ready();const status=document.getElementById('scene-status');if(status)status.hidden=true;
  this.readyAt=Date.now();if(this.renderType===Phaser.CANVAS){this.canvas.addEventListener('contextlost',()=>window.guildBoot?.note('context lost'),{once:true});}if(this.renderType===Phaser.CANVAS)this.canvas.addEventListener('contextrestored',()=>this.recoverCanvas(undefined,true),{once:true});
  if(this.renderType===Phaser.WEBGL)this.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();queueMicrotask(()=>this.recoverCanvas());},{once:true});
  this.refreshPlacement();this.canvas.dispatchEvent(new CustomEvent('guild-renderer-ready'));
 }
 decorate(){
  this.decorateWorld();
  const N=window.VillageNature;
  for(const[x,y,seed,gold]of SITE_TREES){const p=gridPoint(x,y);this.put('tree-'+seed,N.makeTree({seed,season:gold?'gold':'green',kind:seed%4===0?'oak':'birch'}),p.x,p.y);}
  for(const c of SITE_COTTAGES)this.addHome(c.style,c.seed,c.x,c.y);
  for(const[x,y,seed,gold]of SITE_BUSHES){const p=gridPoint(x,y);this.put('bush-'+seed,N.makeBush({seed,gold:!!gold}),p.x,p.y);}
 }

 setState(state){
  this.state=state;const signature=JSON.stringify([state.grid,state.building,state.rooms,state.facilities.map(f=>[f.id,f.type,f.x,f.y,f.level,f.rotation])]);
  if(signature!==this.signature){this.signature=signature;if(this.ready)this.rebuild();}
  if(this.ready){this.syncActors();this.syncVillage();}
 }
 rebuild(){
  if(!this.ready)return;for(const image of this.rooms)image.destroy();this.rooms=[];this.furnitureSprites=[];
  // Only redraw what changed: the village ground depends on the grid and roads, furniture on its type, level and turn.
  const groundSig=JSON.stringify([this.state.grid,siteRoads(this.state)]);
  if(groundSig!==this.groundSig||!this.scene.textures.exists('ground')){this.groundSig=groundSig;const terrain=makeGround(this.state);this.groundImage.setTexture(this.texture('ground',terrain.canvas));}
  for(const image of this.siteProps)image.destroy();this.siteProps=[];
  for(const d of siteDecorations(this.state)){const p=gridPoint(d.x,d.y);this.siteProps.push(this.put('outside-'+d.type,makeOutdoor(d.type),p.x,p.y,p.y+12));}
  for(const part of makeBuilding(this.state).layers){const p=gridPoint(part.x,part.y),key='building-'+part.name;this.rooms.push(this.put(this.texture(key,part.sprite.canvas),part.sprite,p.x,p.y,p.y+part.sort));}
  for(const room of this.state.rooms||[])for(const part of makePartition(room,this.state).layers){const p=gridPoint(part.x,part.y),key='partition-'+room.id+'-'+part.name;this.rooms.push(this.put(this.texture(key,part.sprite.canvas),part.sprite,p.x,p.y,p.y+part.sort));}
  const furn=this.furnitureCache??=new Map();
  for(const f of this.state.facilities){
   const sig=JSON.stringify([f.type,f.level,f.rotation||0]);let cached=furn.get(f.id);
   if(!cached||cached.sig!==sig||cached.parts.some(c=>!this.scene.textures.exists(c.key))){cached={sig,parts:makeRoom(f).layers.map(part=>{const key='furniture-'+f.id+'-'+part.name;this.texture(key,part.sprite.canvas);return{part,key,canvas:part.sprite.canvas,alpha:part.sprite.canvas.getContext('2d').getImageData(0,0,part.sprite.canvas.width,part.sprite.canvas.height).data};})};furn.set(f.id,cached);}
   for(const c of cached.parts){const p=gridPoint(f.x+c.part.x,f.y+c.part.y),image=this.put(c.key,c.part.sprite,p.x,p.y,p.y+c.part.sort);this.rooms.push(image);this.furnitureSprites.push({f,image,canvas:c.canvas,alpha:c.alpha});}
  }
  for(const a of this.furnitureSprites)if(a.f.id===this.moveId)a.image.setAlpha(.25);
  this.animateChanges();
  if(!this.userPanned){const b=buildingRect(this.state),p=gridPoint(b.x+b.w/2,b.y+b.h/2);this.focusX=p.x;this.focusY=p.y+22;this.applyView();}
 }

 // Newly placed or moved items drop in with a bounce and a puff of dust.
 animateChanges(){
  const where=new Map([...this.state.facilities.map(f=>['f:'+f.id,[f.x,f.y,f.rotation||0].join()]),...(this.state.rooms||[]).map(r=>['r:'+r.id,[r.x,r.y,r.width,r.height,r.rotation||0].join()])]);
  const before=this.placedAt;this.placedAt=where;if(!before||this.frozen)return;
  const changed=[...where].filter(([id,at])=>before.get(id)!==at).map(([id])=>id);if(!changed.length||changed.length>2)return;
  for(const id of changed){const [kind,key]=[id[0],id.slice(2)];
   const images=kind==='f'?this.furnitureSprites.filter(a=>a.f.id===key).map(a=>a.image):this.rooms.filter(image=>String(image.texture?.key||'').startsWith('partition-'+key+'-'));
   for(const image of images){const y=image.y;image.y=y-16;image.setScale(1,1);this.scene.tweens.add({targets:image,y,duration:360,ease:'Bounce.easeOut'});}
   const item=kind==='f'?this.state.facilities.find(f=>f.id===key):this.state.rooms.find(r=>r.id===key);if(!item)continue;
   const d=kind==='f'?getRoomSize(item.type,item.rotation||0):partitionSize(item);
   this.scene.time.delayedCall(170,()=>this.dustPuff(item.x,item.y,d.w,d.h));}
 }
 dustPuff(x,y,w,h){if(!this.scene)return;const corners=[[x,y+h],[x+w,y+h],[x+w,y],[x+w/2,y+h],[x+w,y+h/2],[x,y+h/2]];
  for(const [cx,cy] of corners){const p=gridPoint(cx,cy),puff=this.scene.add.graphics().setDepth(9997).setPosition(p.x,p.y);puff.fillStyle(0xf3ead2,.95);puff.fillCircle(0,0,4);
   const c=gridPoint(x+w/2,y+h/2),dx=p.x-c.x,dy=p.y-c.y,len=Math.hypot(dx,dy)||1;
   this.scene.tweens.add({targets:puff,x:p.x+dx/len*14,y:p.y+dy/len*7-4,scale:2.4,alpha:0,duration:480,ease:'Quad.easeOut',onComplete:()=>puff.destroy()});}}

 // ---- The world outside: regions, roads, village, roaming foes and travelling teams. ----
 // A village home; its chimney (if any) puffs smoke.
 addHome(style,seed,x,y,rot=0){
  // Turned buildings (rot 1) are the same art mirrored about their top corner: the door then faces south-east.
  const st=style==='dojo'?{w:3.6,h:3}:HOME_STYLES[style],key='home-'+style,p=gridPoint(x,y),dw=st.w,dh=style==='dojo'?4:st.h,c=rot?gridPoint(x+dh/2,y+dw/2):gridPoint(x+dw/2,y+dh/2);let s=this.homeSprites?.get(key);
  if(!s||!this.scene.textures.exists(key)){s=style==='dojo'?makeDojo(seed):style==='store'?makeShop(seed):style==='smithy'?makeSmithyShop(seed):makeHome(style,seed);(this.homeSprites??=new Map()).set(key,s);this.texture(key,s.canvas);}
  if(s.smoke)(this.chimneys??=[]).push({x:p.x+(rot?-s.smoke.x:s.smoke.x),y:p.y+s.smoke.y,dark:s.smoke.dark,clock:Math.random()});
  if(rot)return this.scene.add.image(p.x-(s.canvas.width-s.footX),p.y-s.footY,key).setOrigin(0).setFlipX(true).setDepth(c.y+4);
  return this.scene.add.image(p.x-s.footX,p.y-s.footY,key).setOrigin(0).setDepth(c.y+4);
 }
 // World ground is painted lazily in crisp chunks around the view, a few rows per frame.
 initGround(){
  for(const c of this.groundChunks||[])c.image?.destroy();this.groundJob=null;
  const CH=1024,pts=[[WORLD.x0,WORLD.y0],[WORLD.x1,WORLD.y0],[WORLD.x0,WORLD.y1],[WORLD.x1,WORLD.y1]].map(([x,y])=>gridPoint(x,y));
  const x0=Math.floor(Math.min(...pts.map(p=>p.x))/CH)*CH,x1=Math.max(...pts.map(p=>p.x)),y0=Math.floor(Math.min(...pts.map(p=>p.y))/CH)*CH,y1=Math.max(...pts.map(p=>p.y));
  this.groundChunks=[];for(let top=y0;top<y1;top+=CH)for(let left=x0;left<x1;left+=CH)this.groundChunks.push({left,top,size:CH,image:null,painter:null});
 }
 updateGround(budget=8){
  if(!this.groundChunks||!this.camera)return;const v=this.camera.worldView,m=200,start=performance.now();
  while(performance.now()-start<budget){
   let job=this.groundJob;
   if(!job){let bd=Infinity;for(const c of this.groundChunks){if((c.image&&!c.stale)||c.left>v.right+m||c.left+c.size<v.x-m||c.top>v.bottom+m||c.top+c.size<v.y-m)continue;const d=(c.left+c.size/2-v.centerX)**2+(c.top+c.size/2-v.centerY)**2;if(d<bd){bd=d;job=c;}}
    if(!job)return;this.groundJob=job;job.painter=makeGroundPainter(job.left,job.top,job.size,2);}
   if(job.painter.step(6)){
    // A stale chunk keeps showing its old picture until the new one is ready, then swaps without a blank frame.
    const old=job.image?.texture?.key,key=`ground-chunk-${job.left}-${job.top}-${job.ver=(job.ver||0)+1}`;this.texture(key,job.painter.canvas);
    if(job.image)job.image.setTexture(key);else job.image=this.scene.add.image(job.left,job.top,key).setOrigin(0).setScale(2).setDepth(-9999.5);
    if(old&&old!==key&&this.scene.textures.exists(old))this.scene.textures.remove(old);job.stale=false;job.painter=null;this.groundJob=null;}
  }
 }
 decorateWorld(){
  const N=window.VillageNature,V=window.VillageProps,B=window.VillageBuildings;this.worldProps=[];this.initGround();this.cullClock=0;
  const meta=this.propMeta??=new Map();const place=(key,make,x,y,depth)=>{const p=gridPoint(x,y);let s=meta.get(key);if(!s||!this.scene.textures.exists(key)){s=make();meta.set(key,s);this.texture(key,s.canvas);}const image=this.scene.add.image(p.x-s.footX,p.y-s.footY,key).setOrigin(0).setDepth(depth??p.y);this.worldProps.push(image);return image;};
  const flat=(key,s,depth)=>{this.texture(key,s.canvas);const image=this.scene.add.image(s.x,s.y,key).setOrigin(0).setDepth(depth);this.worldProps.push(image);return image;};
  const bake=(key,make)=>{if(!this.scene.textures.exists(key))this.texture(key,make().canvas);return key;};
  const bridge=makeBridge();flat('world-bridge',bridge,bridge.depthY);const foot=makeBridge(FOOTBRIDGE,'y');flat('foot-bridge',foot,foot.depthY);
  const M=MEADOW_SCENE,S=QUEST_SITES,at=(x,y)=>gridPoint(x,y).y;
  // The farm west of the village: fenced wheat with a scarecrow, a kitchen plot, hay, a barn and a turning windmill.
  this.wheat=[];
  for(const f of FIELDS){
   flat('fence-back-'+f.kind,makeFieldFence(f,'back'),at(f.x,f.y)-2);flat('fence-front-'+f.kind,makeFieldFence(f,'front'),at(f.x+f.w,f.y+f.h)+14);
   if(f.kind==='wheat'){const split=M.scarecrow.x+M.scarecrow.y;for(const part of ['back','front']){const keys=[0,1].map(k=>{const s=makeWheat(f,k,part,split);this.texture(`wheat-${part}-${k}`,s.canvas);return s;});this.wheat.push({part,image:flat(`wheat-${part}-0`,keys[0],at(M.scarecrow.x,M.scarecrow.y)+(part==='back'?-1:1))});}}
   else flat('veg-'+f.kind,makeVegPatch(f),at(f.x+f.w/2,f.y+f.h/2));
  }
  place('scarecrow',makeScarecrow,M.scarecrow.x,M.scarecrow.y);
  M.hay.forEach(([x,y],i)=>place('hay-'+i%2,()=>makeHayBale(i%2),x,y));
  place('barn',()=>B.makeShed({seed:731,variant:'barn',roof:'terra'}),M.barn.x,M.barn.y,at(M.barn.x,M.barn.y)+16);
  const mill=place('windmill',makeWindmill,M.windmill.x,M.windmill.y);for(let k=0;k<6;k++)bake('sails-'+k,()=>makeSails(k*Math.PI/12));
  const hub=gridPoint(M.windmill.x,M.windmill.y);this.sails=this.scene.add.image(hub.x,hub.y-89,'sails-0').setDepth(mill.depth+1);this.worldProps.push(this.sails);
  for(const [x,y] of M.lamps)place('lm-lamp',()=>V.makeProp('lamp',{seed:7}),x,y);
  for(const [x,y,seed,gold] of M.trees)place(`mt-${seed}-${gold}`,()=>N.makeTree({seed,season:gold?'gold':'green',kind:seed%2?'oak':'birch'}),x,y);
  flat('dock',makeDock(DOCK),at(DOCK.x,DOCK.y));
  // Meadow flora: drifts of themed wildflowers, swaying grass, reeds and lilies on the pond.
  // Flora is placed a little each frame, nearest the village first, so the game opens without a long freeze.
  const meadowItems=scatterMeadow(),natureItems=scatterNature();
  const blooms=[...meadowItems.filter(i=>i.kind==='flowers'),...natureItems.filter(i=>i.kind==='flowers'&&!(i.mist||0)&&i.seed===0)],fireflySpots=natureItems.filter(i=>i.kind==='shroom');
  const placeMeadow=item=>{const v=Math.floor(Math.abs(item.x*7+item.y*13))%2,y=at(item.x,item.y);
   if(item.kind==='flowers'){place(`fp-${item.theme}-${v}`,()=>makeFlowerPatch(item.theme,v),item.x,item.y,y-4);}
   else if(item.kind==='tallgrass')place('tg-'+item.seed,()=>makeTallGrass(item.seed),item.x,item.y);
   else if(item.kind==='bush')place('mb-'+item.seed,()=>N.makeBush({seed:item.seed}),item.x,item.y);
   else if(item.kind==='rock')place('mr-'+item.seed,()=>N.makeRock({seed:item.seed,size:'small'}),item.x,item.y);
   else if(item.kind==='reeds')place('reeds-'+item.seed,()=>makeReeds(item.seed),item.x,item.y);
   else if(item.kind==='lily')place('lily-'+item.seed,()=>makeLily(item.seed),item.x,item.y,y-60);};
  // The rest of the world: woods with glades, misty trees, rocky hills.
  const placeNature=item=>{const m=item.mist||0,k=item.kind,y=at(item.x,item.y),tint=(key,make)=>place(`${key}-${m}`,()=>mistTint(make(),m),item.x,item.y);
   if(k==='tree')tint(`wt-${item.seed}-${item.gold?1:0}`,()=>N.makeTree({seed:item.seed,season:item.gold?'gold':'green',kind:item.seed%2?'oak':'birch'}));
   else if(k==='pine')tint(`wp-${item.seed}-${item.tone}`,()=>makePine(item.seed,item.tone));
   else if(k==='dead')tint('wdt-'+item.seed,()=>makeDeadTree(item.seed));
   else if(k==='willow')place('ww-'+item.seed,()=>makeWillow(item.seed),item.x,item.y);
   else if(k==='fruit')place('wfr-'+item.seed,()=>makeFruitTree(item.seed),item.x,item.y);
   else if(k==='hive')place('whive',makeBeehive,item.x,item.y);
   else if(k==='fern')tint('wfe-'+item.seed,()=>makeFern(item.seed));
   else if(k==='log')tint('wlog-'+item.seed%2,()=>makeFallenLog(item.seed));
   else if(k==='berry')place('wbe-'+item.seed,()=>makeBerryBush(item.seed),item.x,item.y);
   else if(k==='shroom')place('wgs-'+item.seed,()=>makeGlowShrooms(item.seed),item.x,item.y);
   else if(k==='stone')place(`wst-${item.seed%4}-${item.rune?1:0}`,()=>makeStandingStone(item.seed%4,item.rune),item.x,item.y);
   else if(k==='boulders')place('wbo-'+item.seed%4,()=>makeBoulders(item.seed%4),item.x,item.y);
   else if(k==='wall')place('wwall-'+item.seed,()=>makeRuinWall(item.seed,item.len),item.x,item.y);
   else if(k==='pillar')place('wpil-'+item.seed,()=>makePillar(item.seed),item.x,item.y);
   else if(k==='tent')place('wtent',makeTent,item.x,item.y);
   else if(k==='woodpile')place('wpile',()=>V.makeProp('woodpile',{seed:3}),item.x,item.y);
   else if(k==='chop')place('wchop',makeChoppingStump,item.x,item.y);
   else if(k==='rock')place(`wr-${item.seed}`,()=>N.makeRock({seed:item.seed,size:item.seed%2?'large':'small'}),item.x,item.y);
   else if(k==='bush')place('wb-'+item.seed,()=>N.makeBush({seed:item.seed}),item.x,item.y);
   else if(k==='flowers'){tint(`wfl-${item.theme}-${item.seed}`,()=>makeFlowerPatch(item.theme,item.seed));}
   else if(k==='mushroom')tint('wm-'+item.seed,()=>makeMushrooms(item.seed));
   else if(k==='stump')tint('ws-'+item.seed,()=>makeStump(item.seed));
   else if(k==='drygrass')place('wd-'+item.seed,()=>makeDryGrass(item.seed),item.x,item.y);
   else if(k==='reeds')place('reeds-'+item.seed,()=>makeReeds(item.seed),item.x,item.y);
   else tint('wg-'+item.seed,()=>makeTallGrass(item.seed));
  };
  const flora=[...meadowItems.map(item=>({item,meadow:true})),...natureItems.map(item=>({item}))].sort((a,b)=>Math.hypot(a.item.x-10,a.item.y-8)-Math.hypot(b.item.x-10,b.item.y-8));
  this.decorJob=(function*(){for(const f of flora){if(this.underBuilding(f.item.x,f.item.y))continue;const n=this.worldProps.length;(f.meadow?placeMeadow:placeNature)(f.item);for(let k=n;k<this.worldProps.length;k++){const img=this.worldProps[k];img.setVisible(false);img.flora={x:f.item.x,y:f.item.y};}yield;}}).call(this);
  this.chimneys=[];this.puffs=[];
  this.villageSig=null;this.villageProps=new Map();this.syncVillage();
  // Landmarks where quests happen.
  // Each quest has its own set piece; some of them breathe (sparkle, flicker, sway).
  this.animated=[];const anim=(key,make,frames,fps,x,y,depth)=>{for(let f=0;f<frames;f++)bake(`${key}-${f}`,()=>make(f));const image=place(`${key}-0`,()=>make(0),x,y,depth);this.animated.push({image,key,frames,fps,phase:Math.random()*frames});return image;};
  anim('lm-post',makeWatchPost,2,1.5,-21.4,23.2);
  for(const [x,y,seed] of [[-26.6,29.4,0],[-25.3,30.8,1],[-26.8,32.3,2],[-25,33,1],[-27.9,33.8,0]])anim('lm-tea'+seed,f=>makeTeaBush(seed,f),2,1.2,x,y);
  place('lm-basket',makeTeaBasket,-27.7,31.3);
  anim('lm-wagon',makeBreadWagon,2,.7,47.8,14.6);
  place('lm-oak',makeGreatOak,S.hollow.x+2.6,S.hollow.y-2);
  anim('lm-cave',makeCrystalCave,2,1.6,S.crystals.x+2.2,S.crystals.y-1.4);
  anim('lm-tower',makeBellTower,2,.8,66,-5);
  place('lm-gate',makeMistGate,1,-38);
  for(const [x,y] of [[-1.7,-40.8],[.9,-40.8],[-2.9,-43.2],[-.3,-43.2]])anim('lm-lantern',makeStoneLantern,2,3,x,y);
  place('lm-camp',makeLostCamp,S.rescue.x-1.9,S.rescue.y-1.8);
  anim('lm-fire',makeCampfire,3,7,S.rescue.x+1.1,S.rescue.y-.8);
  anim('lm-heart',makeHeartTree,2,.9,S.heart.x+3,S.heart.y-3);
  const frontier=decorateFrontier({place,anim,flat,bake,at,scene:this.scene,props:this.worldProps,animated:this.animated,campLevel:this.state.frontier?.camp||0});this.campSprite=frontier?.camp||null;this.campShown=this.state.frontier?.camp||0;
  for(const sign of SIGNPOSTS)place('sign-'+sign.region,()=>makeSignpost(sign.text,false,sign.flip),sign.x,sign.y);
  // Little lives: sheep in the pasture, ducks on the pond, butterflies over the flowers.
  const puff=dark=>{const c=document.createElement('canvas');c.width=c.height=10;const g=c.getContext('2d');g.fillStyle=dark?'#8d8782':'#f4f0e6';g.fillRect(2,0,6,10);g.fillRect(0,2,10,6);g.fillRect(1,1,8,8);g.fillStyle=dark?'#a9a39d':'#ffffff';g.fillRect(2,2,4,3);return{canvas:c};};bake('puff',()=>puff(false));bake('puff-dark',()=>puff(true));
  for(let k=0;k<3;k++)bake('sheep-'+k,()=>makeSheep(k));for(let k=0;k<2;k++){bake('duck-'+k,()=>makeDuck(k));bake('duckw-'+k,()=>makeDuck(k,true));}for(let k=0;k<2;k++)for(let c=0;c<4;c++)bake(`fly-${k}-${c}`,()=>makeButterfly(k,c));
  for(let k=0;k<3;k++){bake('deer-'+k,()=>makeDeer(k));bake('fawn-'+k,()=>makeDeer(k,true));bake('goat-'+k,()=>makeGoat(k));}bake('firefly',()=>makeFirefly(1));
  const herd=(home,n,tex,foot,speed,squash=.8)=>Array.from({length:n},(_,i)=>{const a=i*2.1+n,x=home.x+Math.cos(a)*home.r*.6,y=home.y+Math.sin(a)*home.r*.5,image=this.scene.add.image(0,0,tex+'-2').setOrigin(.5,foot);this.worldProps.push(image);return{x,y,tx:x,ty:y,wait:1+i*.7,image,tex,home,speed,squash};});
  this.grazers=[...herd(M.pasture,6,'sheep',14/18,.45),...herd(WILD_SCENE.deer,2,'deer',25/28,.7,1),...herd(WILD_SCENE.deer,1,'fawn',25/28,.75,1),...herd(WILD_SCENE.goats,5,'goat',18/20,.4,1)];
  this.fireflies=[...fireflySpots.map(s=>[s.x,s.y]),...Array.from({length:40},(_,i)=>[-30+(i*13.7)%60,-66+(i*7.3)%40])].filter(([x,y])=>biomeAt(x,y).mist>.3||fireflySpots.some(s=>s.x===x)).slice(0,26).map(([x,y],i)=>{const p=gridPoint(x,y),image=this.scene.add.image(p.x,p.y,'firefly').setBlendMode(Phaser.BlendModes.ADD).setDepth(p.y+60);this.worldProps.push(image);return{x:p.x,y:p.y-14,phase:i*2.3,image};});
  this.ducks=Array.from({length:4},(_,i)=>{const image=this.scene.add.image(0,0,'duck-0').setOrigin(.5,8/11);this.worldProps.push(image);return{a:i*1.7,k:.3+(i%3)*.14,speed:(i%2?1:-1)*(.05+i*.012),plain:i===3,image};});
  this.flies=blooms.filter((_,i)=>i%5===0).slice(0,26).map((b,i)=>{const p=gridPoint(b.x,b.y),image=this.scene.add.image(p.x,p.y,'fly-0-0').setOrigin(.5);this.worldProps.push(image);return{x:p.x,y:p.y-12,tone:(b.theme+i)%4,phase:i*1.9,image};});
  // Drifting fog over the misty woods.
  this.fogs=[];for(let i=0;i<16;i++){const x=-22+(i*7.3)%34,y=-62+(i*5.9)%28;if(biomeAt(x,y).mist<.35)continue;const p=gridPoint(x,y);bake('fog-'+i%3,()=>makeFog(i%3));this.fogs.push({image:this.scene.add.image(p.x,p.y,'fog-'+i%3).setDepth(p.y+80).setAlpha(.55),x:p.x,y:p.y,phase:i});}
  // Monsters live all over the world, each kind in its own habitat, each moving its own way.
  this.foes=[];this.worldSigns=[];this.signRank=null;this.parties=new Map();
  // Hunting grounds are stocked by the simulation itself; decorative creatures roam everywhere else.
  for(const m of monsterSpawns()){if(Object.values(HUNT_ZONES).some(z=>Math.hypot(m.x-z.x,m.y-z.y)<z.r+4))continue;const sp=SPECIES[m.id],w=sp.size[0];
   const shadowKey='msh-'+w;if(!this.scene.textures.exists(shadowKey)){const c=document.createElement('canvas');c.width=Math.round(w*.8);c.height=5;const g=c.getContext('2d');g.fillStyle='rgba(60,50,40,.24)';g.beginPath();g.ellipse(c.width/2,2.5,c.width/2,2.5,0,0,Math.PI*2);g.fill();this.texture(shadowKey,c);}
   const tex=this.monTex(m.id,0),src=makeMonster(m.id,0);
   this.foes.push({id:m.id,kind:sp.kind,hx:m.x,hy:m.y,r:m.r,x:m.x,y:m.y,tx:m.x,ty:m.y,wait:Math.random()*4,hop:0,phase:Math.random()*6,flip:Math.random()<.5,
    shadow:this.scene.add.image(0,0,shadowKey).setOrigin(.5),image:this.scene.add.image(0,0,tex).setOrigin(src.footX/src.canvas.width,src.footY/src.canvas.height)});}
  // Nothing outside the view is drawn until the first cull pass decides what is near.
  for(const img of this.worldProps)img.setVisible(false);for(const f of this.foes){f.image.setVisible(false);f.shadow.setVisible(false);}
 }
 updateCritters(dt,t,playing){
  const P=MEADOW_SCENE.pasture;
  const sheep=(this.grazers||[]).filter(g=>g.tex==='sheep'),keep=Math.ceil(sheep.length*(this.flockLeft??1));sheep.forEach((g,i)=>g.image.setAlpha(i<keep?1:0));
  for(const s of this.grazers||[]){const H=s.home;
   if(playing){s.wait-=dt;if(s.wait<=0&&Math.hypot(s.tx-s.x,s.ty-s.y)<.05){const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random())*H.r;s.tx=H.x+Math.cos(a)*r;s.ty=H.y+Math.sin(a)*r*s.squash;s.wait=3+Math.random()*6;}
    const dx=s.tx-s.x,dy=s.ty-s.y,d=Math.hypot(dx,dy);if(d>.05){s.x+=dx/d*Math.min(d,dt*s.speed);s.y+=dy/d*Math.min(d,dt*s.speed);const sx=(dx-dy);if(Math.abs(sx)>.01)s.flip=sx<0;}}
   const moving=Math.hypot(s.tx-s.x,s.ty-s.y)>.05,p=gridPoint(s.x,s.y);s.image.setTexture(s.tex+'-'+(moving?Math.floor(t*6+s.wait)%2:2)).setFlipX(!!s.flip).setPosition(Math.round(p.x),Math.round(p.y)).setDepth(p.y);
  }
  for(const f of this.fireflies||[])f.image.setPosition(Math.round(f.x+Math.sin(t*.4+f.phase)*20),Math.round(f.y+Math.cos(t*.53+f.phase)*10)).setAlpha(.35+.65*Math.max(0,Math.sin(t*1.3+f.phase)));
  for(const d of this.ducks||[]){if(playing)d.a+=dt*d.speed;const x=LAKE.x-1.2+Math.cos(d.a)*LAKE.rx*d.k,y=LAKE.y+Math.sin(d.a)*LAKE.ry*d.k,p=gridPoint(x,y),vx=-Math.sin(d.a)*LAKE.rx*d.speed,vy=Math.cos(d.a)*LAKE.ry*d.speed;
   d.image.setTexture((d.plain?'duckw-':'duck-')+(Math.floor(t*2+d.a*3)%2)).setFlipX(vx-vy<0).setPosition(Math.round(p.x),Math.round(p.y+Math.sin(t*2+d.a)*.6)).setDepth(p.y);}
  for(const f of this.flies||[]){const x=f.x+Math.sin(t*.7+f.phase)*22+Math.sin(t*1.9+f.phase)*6,y=f.y+Math.cos(t*.5+f.phase)*9-Math.abs(Math.sin(t*4+f.phase))*4;
   f.image.setTexture(`fly-${Math.floor(t*9+f.phase)%2}-${f.tone}`).setPosition(Math.round(x),Math.round(y)).setDepth(f.y+40);}
  for(const ch of this.chimneys||[]){ch.clock-=dt;if(ch.clock>0)continue;ch.clock=.8+Math.random()*.5;let pf=this.puffs.find(p=>!p.live);if(!pf&&this.puffs.length<70){pf={image:this.scene.add.image(0,0,'puff').setVisible(false)};this.puffs.push(pf);}if(pf)Object.assign(pf,{live:true,age:0,x:ch.x,y:ch.y,seed:Math.random()*6});if(pf)pf.image.setTexture(ch.dark?'puff-dark':'puff');}
  for(const pf of this.puffs||[])if(pf.live){pf.age+=dt;const a=pf.age/3.2;if(a>=1){pf.live=false;pf.image.setVisible(false);continue;}pf.image.setVisible(true).setPosition(Math.round(pf.x+a*16+Math.sin(pf.age*2+pf.seed)*2),Math.round(pf.y-a*36)).setScale(.7+a*1.3).setAlpha((1-a)*.75).setDepth(pf.y+400);}
  if(this.sails)this.sails.setTexture('sails-'+(Math.floor(t*2.5)%6));
  for(const w of this.wheat||[])w.image.setTexture(`wheat-${w.part}-${Math.floor(t/1.1)%2}`);
 }
 monTex(id,frame,flash=false){const key=`mon-${id}-${frame}-${flash?1:0}`;if(!this.scene.textures.exists(key))this.texture(key,makeMonster(id,frame,flash).canvas);return key;}
 refreshWorldSigns(){
  const key=this.state.rank;if(this.signRank===key||!this.scene)return;this.signRank=key;for(const s of this.worldSigns||[])s.destroy();this.worldSigns=[];
  for(const sign of SIGNPOSTS)if(!regionOpen(this.state,sign.region)){const rank=REGIONS.find(r=>r.id===sign.region)?.rank||'B',p=gridPoint(sign.x+1.2,sign.y-1.6);
   if(!this.scene.textures.exists('barrier'))this.texture('barrier',makeBarricade().canvas);const b=makeBarricade();this.worldSigns.push(this.scene.add.image(p.x-b.footX,p.y-b.footY,'barrier').setOrigin(0).setDepth(p.y));
   const lock=makeSignpost(`ต้องเป็นกิลด์ ${rank}`,true,sign.flip),q=gridPoint(sign.x+2.4,sign.y-2.6);this.texture('lock-'+sign.region+rank,lock.canvas);this.worldSigns.push(this.scene.add.image(q.x-lock.footX,q.y-lock.footY,'lock-'+sign.region+rank).setOrigin(0).setDepth(q.y));}
 }
 updateWorld(dt,playing){
  if(!this.foes)return;
  // The frontier camp grows in place when the guild upgrades it.
  const camp=this.state.frontier?.camp||0;if(this.campSprite&&camp!==this.campShown){this.campShown=camp;const key=camp?'lm-frontier-camp-l'+camp:'lm-frontier-camp';for(let f=0;f<3;f++)if(!this.scene.textures.exists(`${key}-${f}`))this.texture(`${key}-${f}`,makeFrontierCamp(camp,f).canvas);const a=this.animated?.find(x=>x.image===this.campSprite);if(a)a.key=key;this.campSprite.setTexture(key+'-0');}this.refreshWorldSigns();const t=this.realTime||0;if(this.decorJob){const start=performance.now();while(performance.now()-start<7)if(this.decorJob.next().done){this.decorJob=null;break;}this.cullClock=0;}this.updateGround();this.updateCritters(dt,t,playing);
  const SPEED={hop:.9,walk:.55,float:.5,root:0};
  for(const f of this.foes){
   const moving=Math.hypot(f.tx-f.x,f.ty-f.y)>.05;
   if(playing&&f.kind!=='root'){
    f.wait-=dt;if(f.wait<=0&&!moving){for(let k=0;k<4;k++){const a=Math.random()*Math.PI*2,d=Math.sqrt(Math.random())*f.r,tx=f.hx+Math.cos(a)*d,ty=f.hy+Math.sin(a)*d;if((f.id==='pondFrog'||f.id==='waterSlime'?!inWater(tx,ty,.05):!inWater(tx,ty,.4))&&Math.hypot(tx-10,ty-8)>17){f.tx=tx;f.ty=ty;break;}}f.wait=(f.kind==='float'?1:2)+Math.random()*5;}
    if(moving){const dx=f.tx-f.x,dy=f.ty-f.y,d=Math.hypot(dx,dy),sp=SPEED[f.kind]*(f.id==='marbleGolem'||f.id==='bellGuardian'||f.id==='heartGuardian'?.5:f.id==='mossWolf'||f.id==='fluffBoar'?1.4:1);
     if(f.kind==='hop'){f.hop+=dt*2.2;if(f.hop>=1)f.hop-=1;}
     const step=f.kind==='hop'?(f.hop>.1&&f.hop<.9?sp*1.4:0):sp;f.x+=dx/d*Math.min(d,dt*step);f.y+=dy/d*Math.min(d,dt*step);if(Math.abs(dx-dy)>.02)f.flip=dx-dy<0;}
    else f.hop=0;
   }
   if(!f.image.visible)continue;
   const p=gridPoint(f.x,f.y);let lift=0,frame;
   if(f.kind==='hop'){lift=moving?Math.sin(f.hop*Math.PI)*7:0;frame=moving?(f.hop<.12||f.hop>.88?1:0):Math.floor(t*1.4+f.phase)%2;}
   else if(f.kind==='walk')frame=Math.floor(t*(moving?6:1.2)+f.phase)%2;
   else if(f.kind==='float'){lift=Math.sin(t*2+f.phase)*2.5;frame=Math.floor(t*6+f.phase)%2;}
   else frame=Math.floor(t*1.3+f.phase)%2;
   f.image.setTexture(this.monTex(f.id,frame)).setPosition(Math.round(p.x),Math.round(p.y-lift)).setDepth(p.y).setFlipX(f.flip);
   f.shadow.setPosition(Math.round(p.x),Math.round(p.y)).setDepth(p.y-.5).setScale(f.kind==='float'?.75:1-lift/24);
  }
  for(const fog of this.fogs||[])fog.image.setPosition(fog.x+Math.sin(t*.12+fog.phase)*40,fog.y+Math.cos(t*.09+fog.phase)*10).setAlpha(.4+Math.sin(t*.3+fog.phase)*.15);
  for(const a of this.animated||[])if(a.image.visible)a.image.setTexture(`${a.key}-${Math.floor(t*a.fps+a.phase)%a.frames}`);
  // Only draw world props near the view.
  this.cullClock=(this.cullClock||0)-dt;if(this.cullClock<=0&&this.camera){this.cullClock=.25;const v=this.camera.worldView,m=220;for(const c of this.groundChunks||[])c.image?.setVisible(c.left<v.right+m&&c.left+c.size>v.x-m&&c.top<v.bottom+m&&c.top+c.size>v.y-m);for(const img of this.worldProps||[])img.setVisible(img.x+img.width>v.x-m&&img.x<v.right+m&&img.y+img.height>v.y-m&&img.y<v.bottom+m);for(const f of this.foes){const p=gridPoint(f.x,f.y),on=p.x>v.x-m&&p.x<v.right+m&&p.y>v.y-m&&p.y<v.bottom+m+60;f.image.setVisible(on);f.shadow.setVisible(on);}}
  // Mission foes, strike effects and the floating quest tag for each travelling team.
  const live=new Set();
  for(const m of this.state.missions||[]){if(m.status!=='active'&&m.status!=='decision')continue;const quest=QUESTS.find(q=>q.id===m.questId);if(!quest)continue;live.add(m.id);
   let party=this.parties.get(m.id);if(!party){party={strike:m.combat?.lastStrike||0,strikeAt:-9,wave:-1};this.parties.set(m.id,party);}
   if(party.strike!==(m.combat?.lastStrike||0)){party.strike=m.combat?.lastStrike||0;party.strikeAt=t;}
   const ratio=Math.max(0,Math.min(1,m.progress/(m.duration||1))),phase=ratio<.18?'go':ratio<.88?'fight':'back',wave=phase==='fight'?Math.min(2,Math.floor((ratio-.18)/.7*3)):-1,site=QUEST_SITES[quest.id];
   if(wave!==party.wave){if(party.wave>=0&&site)this.dustPuff(site.x+.6,site.y-.3,.8,.8);party.wave=wave;}
   if(phase==='fight'&&site){const age=t-party.strikeAt,hit=age>.28&&age<.42,p=gridPoint(site.x+.9,site.y),species=questFoe(quest),src=makeMonster(species,0);
    if(!party.foe)party.foe=this.scene.add.image(0,0,this.monTex(species,0)).setOrigin(src.footX/src.canvas.width,src.footY/src.canvas.height);
    party.foe.setTexture(this.monTex(species,Math.floor(t*3)%2,hit)).setScale(wave===2?1.4:1).setVisible(true).setPosition(Math.round(p.x),Math.round(p.y-(SPECIES[species].kind==='float'?Math.sin(t*2)*2.5:0))).setDepth(p.y).setFlipX(true);
    const dmg=m.combat?.log?.[0]?.damage;if(age>=0&&age<.9&&Number.isFinite(dmg)){if(!party.num)party.num=this.scene.add.text(0,0,'',{fontFamily:'sans-serif',fontSize:'10px',fontStyle:'bold',color:'#fff1c4',stroke:'#4f4540',strokeThickness:3}).setOrigin(.5).setResolution(2);party.num.setText(String(dmg)).setVisible(age>.28).setPosition(p.x,p.y-34-age*16).setDepth(p.y+100).setAlpha(Math.max(0,1-age/.9));}else party.num?.setVisible(false);}
   else{party.foe?.setVisible(false);party.num?.setVisible(false);}
   party.ratio=ratio;party.phase=phase;
  }
  for(const [id,party] of this.parties)if(!live.has(id)){party.foe?.destroy();party.num?.destroy();party.tag?.destroy();this.parties.delete(id);}
 }
 // A member on an errand walks out along the road to the dojo or arena, stays a while, and walks back.
 updateErrand(a,playing){
  const e=a.member.errand,lot=this.villageLot(e.kind==='exam'||e.kind==='festival'?'arena':'dojo'),b=buildingRect(this.state),door={x:b.x+b.w/2,y:b.y+b.h+.4};
  const site=e.kind==='exam'||e.kind==='festival'?{x:lot.x+2+((hash(a.member.id)%3)-1)*.5,y:lot.y+1.5}:{x:lot.x+1.3,y:lot.y+2.9};
  const route=[door,{x:door.x,y:17.5},{x:site.x,y:17.5},site],total=route.slice(1).reduce((s,p,k)=>s+Math.hypot(p.x-route[k].x,p.y-route[k].y),0);
  const r=Math.max(0,Math.min(1,(this.state.elapsed-e.start)/((e.end-e.start)||1))),walk=e.kind==='exam'||e.kind==='festival'?.12:.3;
  const along=d=>{let left=d;for(let k=1;k<route.length;k++){const p=route[k-1],q=route[k],len=Math.hypot(q.x-p.x,q.y-p.y);if(left<=len||k===route.length-1){const f=len?Math.max(0,Math.min(1,left/len)):0;return{x:p.x+(q.x-p.x)*f,y:p.y+(q.y-p.y)*f};}left-=len;}return route[route.length-1];};
  const pos=r<walk?along(total*r/walk):r>1-walk?along(total*(1-r)/walk):site,p=gridPoint(pos.x,pos.y),dx=p.x-a.x,dy=p.y-a.y,moving=Math.hypot(dx,dy)>.05;
  if(moving)a.direction=Math.abs(dx)>Math.abs(dy)*1.6?(dx<0?'west':'east'):(dy<0?'north':'south');
  a.x=p.x;a.y=p.y;const t=(this.realTime||0)+hash(a.member.id)%7;
  const pose=moving&&playing?'walk'+(Math.floor(this.elapsed*8)%4):e.kind==='classTrial'?(Math.floor(t*1.5)%2?'breath':'idle'):'train'+(Math.floor(t*(e.kind==='exam'?3:2.4))%2);
  a.image.setVisible(true).setTexture(`actor-${a.member.id}-${a.member.class}-${pose.startsWith('train')?'south':a.direction}-${pose}`).setPosition(Math.round(p.x),Math.round(p.y)).setDepth(Math.round(p.y)+.3);
 }
 updateTraveler(a,playing){
  const m=(this.state.missions||[]).find(m=>(m.status==='active'||m.status==='decision')&&m.memberIds.includes(a.member.id)),quest=m&&QUESTS.find(q=>q.id===m.questId);
  if(!m||!quest){a.image.setVisible(false);return;}
  a.missionId=m.id;const b=buildingRect(this.state),door={x:b.x+b.w/2,y:b.y+b.h+.4},route=questRoute(door,quest),i=m.memberIds.indexOf(a.member.id);
  const total=route.slice(1).reduce((sum,p,k)=>sum+Math.hypot(p.x-route[k].x,p.y-route[k].y),0),ratio=Math.max(0,Math.min(1,m.progress/(m.duration||1)));
  const along=d=>{let left=d;for(let k=1;k<route.length;k++){const p=route[k-1],q=route[k],len=Math.hypot(q.x-p.x,q.y-p.y);if(left<=len||k===route.length-1){const f=len?Math.max(0,Math.min(1,left/len)):0;return{x:p.x+(q.x-p.x)*f,y:p.y+(q.y-p.y)*f};}left-=len;}return route[route.length-1];};
  let pos,phase=ratio<.18?'go':ratio<.88?'fight':'back';
  if(phase==='fight'){const s=QUEST_SITES[quest.id],o=[[-1.1,-.5],[-1.5,.5],[-.6,.9]][i%3];pos={x:s.x+o[0],y:s.y+o[1]};}
  else{const d=phase==='go'?total*ratio/.18-i*1.1:total*(1-(ratio-.88)/.12)+i*1.1;if(d<0){a.image.setVisible(false);return;}pos=along(d);}
  const p=gridPoint(pos.x,pos.y),dx=p.x-a.x,dy=p.y-a.y,moving=Math.hypot(dx,dy)>.05;
  if(moving)a.direction=Math.abs(dx)>Math.abs(dy)*1.6?(dx<0?'west':'east'):(dy<0?'north':'south');
  a.x=p.x;a.y=p.y;const m2=a.member,t=this.realTime||0,party=this.parties?.get(m.id);let pose;
  if(phase==='fight'){const age=t-(party?.strikeAt??-9),striker=m.combat?.log?.[0]?.memberId===m2.id&&age>=0&&age<.7&&playing;pose=striker?(age<.25?'train0':'train1'):(Math.floor(t*1.5+i)%2?'breath':'idle');a.direction='east';}
  else pose=moving&&playing?'walk'+(Math.floor(this.elapsed*8)%4):'idle';
  const facing=pose.startsWith('train')?'south':a.direction;
  a.image.setVisible(true).setTexture(`actor-${m2.id}-${m2.class}-${facing}-${pose}`).setPosition(Math.round(p.x+(pose==='train1'?6:0)),Math.round(p.y)).setDepth(Math.round(p.y)+(i+1)/10);
  // The first member carries the quest tag.
  if(i===0&&party){if(!party.tag)party.tag=this.scene.add.text(0,0,'',{fontFamily:'"Noto Sans Thai", sans-serif',fontSize:'7px',fontStyle:'bold',color:'#5a4a36',backgroundColor:'#f8edd3',padding:{x:3,y:1}}).setOrigin(.5,1).setResolution(2);
   const pending=m.event&&!m.event.resolved,text=`${pending?'! ':''}${quest.name} ${Math.round(ratio*100)}%`;if(party.tag.text!==text)party.tag.setText(text);const tagScale=Math.min(1,1.3/(this.camera?.zoom||1));party.tag.setBackgroundColor(pending?'#fff1c4':'#f8edd3').setScale(tagScale).setPosition(Math.round(p.x),Math.round(p.y-27)).setDepth(p.y+200).setVisible(true);}
 }
 // ---- The village: homes appear on their lots as houses are built and grow with the village level. ----
 villageLot(key){const own=this.state?.village?.lots?.[key];if(own)return own;return key[0]==='h'&&/^h\d+$/.test(key)?VILLAGE_LOTS.houses[+key.slice(1)]:VILLAGE_LOTS[key];}
 /** Footprints of the village buildings that stand now (grid units). */
 villageRects(except){const v=getVillageInfo(this.state),out=[];
  for(let i=0;i<Math.min(v.houses,VILLAGE_LOTS.houses.length);i++){const key='h'+i;if(key===except)continue;const at=this.villageLot(key),[w,h]=footprintOf('house',at.rot);out.push({key,x:at.x,y:at.y,w,h});}
  for(const id of VILLAGE_BUSINESSES)if(v[id]&&id!==except){const at=this.villageLot(id),[w,h]=footprintOf(id,at.rot);out.push({key:id,x:at.x,y:at.y,w,h});}
  return out;}
 underBuilding(x,y){return (this.villageRects()||[]).some(r=>x>r.x-.6&&x<r.x+r.w+.6&&y>r.y-.6&&y<r.y+r.h+.6);}
 // ---- Choosing where a village building goes: tap the map, see green or red, then confirm. ----
 villageBlockers(key){const g=this.state.grid||{width:20,height:16},b=buildingRect(this.state);
  return[{x:-.5,y:-.5,w:g.width+1,h:g.height+1},{x:b.x-1,y:b.y-1,w:b.w+2,h:b.h+3},...siteRoads(this.state),...SITE_COTTAGES.map(c=>({x:c.x-.3,y:c.y-.3,w:c.w+.6,h:c.h+.6})),...SITE_TREES.map(([x,y])=>({x:x-.5,y:y-.5,w:1,h:1})),...this.villageRects(key).map(r=>({x:r.x-.4,y:r.y-.4,w:r.w+.8,h:r.h+.8}))];}
 startVillagePlacement(key,kind,moving=false){
  const lot=this.villageLot(key),rot=moving&&lot?.rot===1?1:0,[w,h]=footprintOf(kind,rot),blockers=this.villageBlockers(key),ok=(x,y)=>!villageSpotProblem(x,y,w,h,blockers);
  let start=lot||{x:8,y:21};
  if(!ok(start.x,start.y))search:for(let r=1;r<30;r+=1)for(let a=0;a<Math.PI*2;a+=.35){const x=Math.round((start.x+Math.cos(a)*r)*4)/4,y=Math.round((start.y+Math.sin(a)*r*.8)*4)/4;if(ok(x,y)){start={x,y};break search;}}
  this.villagePick={key,kind,w,h,rot,x:start.x,y:start.y,blockers};this.stopFollow?.();
  const p=gridPoint(start.x+w/2,start.y+h/2);this.focusX=p.x;this.focusY=p.y;this.userPanned=true;this.zoom=Math.max(this.zoom,1);this.applyView();this.updateVillagePick();}
 updateVillagePick(){const v=this.villagePick;if(!v)return;v.problem=villageSpotProblem(v.x,v.y,v.w,v.h,v.blockers);
  const g=this.villageGhost??=this.scene.add.graphics().setDepth(9998);g.clear();const pts=gridPolygon(v.x,v.y,v.w,v.h),col=v.problem?0xd9584a:0x6fae5a;
  g.fillStyle(col,.35);g.fillPoints(pts,true);g.lineStyle(2,col,.95);g.strokePoints(pts,true);g.setVisible(true);
  this.onVillagePick?.({ok:!v.problem,message:v.problem});}
 getVillagePick(){const v=this.villagePick;return v?{ok:!v.problem,message:v.problem,x:v.x,y:v.y,rot:v.rot}:null;}
 /** Turn the building being placed: its footprint swaps and the door faces the other way. */
 rotateVillagePick(){const v=this.villagePick;if(!v||!ROTATABLE(v.key))return false;v.rot=v.rot?0:1;[v.w,v.h]=footprintOf(v.kind,v.rot);this.updateVillagePick();return true;}
 stopVillagePlacement(){this.villagePick=null;this.villageGhost?.clear();}
 // Village footpaths grow by themselves: repaint the village ground and the world chunks they cross when they change.
 syncPaths(){const v=getVillageInfo(this.state),paths=this.state.village?.paths||{};
  const sig=JSON.stringify(Object.entries(paths).map(([k,p])=>[k,p.pts.length,p.pts[0],pathTier(p.wear,v.level)]));if(sig===this.pathSig)return;const first=this.pathSig===undefined;this.pathSig=sig;
  setVillagePaths(Object.values(paths).map(p=>p.pts));
  if(this.groundImage&&this.scene.textures.exists('ground')){const terrain=makeGround(this.state);this.groundImage.setTexture(this.texture('ground',terrain.canvas));}
  if(first||!this.groundChunks)return;
  const boxes=Object.values(paths).filter(p=>p.pts.length>1).map(p=>{const g=p.pts.map(([x,y])=>gridPoint(x,y));return{x0:Math.min(...g.map(q=>q.x))-60,x1:Math.max(...g.map(q=>q.x))+60,y0:Math.min(...g.map(q=>q.y))-40,y1:Math.max(...g.map(q=>q.y))+40};});
  for(const c of this.groundChunks)if(boxes.some(b=>b.x1>c.left&&b.x0<c.left+c.size&&b.y1>c.top&&b.y0<c.top+c.size)){if(this.groundJob===c){this.groundJob=null;c.painter=null;}c.stale=true;}}
 syncVillage(){
  this.syncPaths();
  if(!this.scene||!this.state||!this.worldProps)return;const v=getVillageInfo(this.state),want=[];
  // Buildings stand where the player put them (older saves fall back to the original lots); each home looks as grown as its family.
  const homeStyle=(lot,tier)=>tier<3?lot.styles[tier]:lot.styles[2]==='tall'?'stone':'tall';
  VILLAGE_LOTS.houses.forEach((lot,i)=>{if(i<v.houses){const at=this.villageLot('h'+i);want.push({key:'h'+i,style:homeStyle(lot,homeOf(this.state,'h'+i).tier),seed:lot.seed,x:at.x,y:at.y,rot:at.rot||0});}});
  for(const id of VILLAGE_BUSINESSES){const lot=VILLAGE_LOTS[id],at=this.villageLot(id);if(v[id])want.push(id==='market'?{key:id,market:v[id],seed:lot.seed,x:at.x,y:at.y}:id==='arena'?{key:id,arena:v[id],x:at.x,y:at.y}:id==='fairground'||id==='stage'?{key:id,fest:id,level:v[id],x:at.x,y:at.y}:id==='monument'?{key:id,monument:v[id],x:at.x,y:at.y}:{key:id,style:lot.style,seed:lot.seed,x:at.x,y:at.y,rot:at.rot||0});}
  const sig=JSON.stringify(want);if(sig===this.villageSig)return;const first=this.villageSig===null;this.villageSig=sig;
  const old=this.villageProps,next=new Map();
  for(const w of want){const id=w.key+':'+(w.lot?'lot':w.market?'market'+w.market:w.arena?'arena'+w.arena:w.fest?w.fest+w.level:w.monument?'monument'+w.monument:w.style)+':'+w.x+','+w.y+','+(w.rot||0);if(old.has(id)){next.set(id,old.get(id));old.delete(id);continue;}
   const images=[],before=(this.chimneys||[]).length;
   if(w.lot){const s=makeSignpost('ที่ดินว่าง');if(!this.scene.textures.exists('lot-sign'))this.texture('lot-sign',s.canvas);const p=gridPoint(w.x,w.y);images.push(this.scene.add.image(p.x-s.footX,p.y-s.footY,'lot-sign').setOrigin(0).setDepth(p.y).setAlpha(.9));}
   else if(w.market){for(let k=0;k<w.market;k++){const key='stall-'+k,sp=makeStall(w.seed+k,k);if(!this.scene.textures.exists(key))this.texture(key,sp.canvas);const at=[[0,0],[2.1,.3],[.9,2.1]][k],p=gridPoint(w.x+at[0],w.y+at[1]),c=gridPoint(w.x+at[0]+.8,w.y+at[1]+.6);images.push(this.scene.add.image(p.x-sp.footX,p.y-sp.footY,key).setOrigin(0).setDepth(c.y+4));}}
   else if(w.arena){const key='arena-'+w.arena,sp=makeArena(w.arena);if(!this.scene.textures.exists(key))this.texture(key,sp.canvas);const p=gridPoint(w.x,w.y),c=gridPoint(w.x+2,w.y+1.5);images.push(this.scene.add.image(p.x-sp.footX,p.y-sp.footY,key).setOrigin(0).setDepth(c.y-20));}
   else if(w.monument){const key='monument-'+w.monument,sp=makeMonument(w.monument);if(!this.scene.textures.exists(key))this.texture(key,sp.canvas);const p=gridPoint(w.x,w.y),c=gridPoint(w.x+1,w.y+1);images.push(this.scene.add.image(p.x-sp.footX,p.y-sp.footY,key).setOrigin(0).setDepth(c.y+6));}
   else if(w.fest){const make=w.fest==='stage'?makeStage:makeFairground,[fw,fh]=w.fest==='stage'?[3.4,2.8]:[5,4];for(let f=0;f<2;f++){const k=`${w.fest}-${w.level}-${f}`;if(!this.scene.textures.exists(k))this.texture(k,make(w.level,f).canvas);}const sp=make(w.level,0),p=gridPoint(w.x,w.y),c=gridPoint(w.x+fw/2,w.y+fh/2),img=this.scene.add.image(p.x-sp.footX,p.y-sp.footY,`${w.fest}-${w.level}-0`).setOrigin(0).setDepth(c.y-20);img.festKey=`${w.fest}-${w.level}`;images.push(img);}
   else images.push(this.addHome(w.style,w.seed,w.x,w.y,w.rot));
   const chimneys=(this.chimneys||[]).slice(before);
   for(const image of images){this.worldProps.push(image);if(!first&&!w.lot){const y=image.y;image.y=y-18;this.scene.tweens.add({targets:image,y,duration:420,ease:'Bounce.easeOut'});}}
   if(!first&&!w.lot)this.scene.time.delayedCall(220,()=>this.dustPuff(w.x,w.y,2.4,2.2));
   next.set(id,{images,chimneys});}
  for(const e of old.values()){for(const image of e.images){image.destroy();const i=this.worldProps.indexOf(image);if(i>=0)this.worldProps.splice(i,1);}this.chimneys=(this.chimneys||[]).filter(c=>!e.chimneys.includes(c));}
  this.villageProps=next;this.cullClock=0;
  // Grass and flowers never grow through a building.
  for(let k=this.worldProps.length-1;k>=0;k--){const img=this.worldProps[k];if(img.flora&&this.underBuilding(img.flora.x,img.flora.y)){img.destroy();this.worldProps.splice(k,1);}}
 }
 // ---- Villagers bringing petitions: they walk from home along the road, in through the door, and wait at the desk. ----
 bakeVillager(m){for(const direction of ['south','east','north','west']){for(const pose of ['idle','breath'])this.texture(`actor-${m.id}-villager-${direction}-${pose}`,makeActorTexture(m,0,false,1,direction,pose));
  for(let frame=0;frame<4;frame++)this.texture(`actor-${m.id}-villager-${direction}-walk${frame}`,makeActorTexture(m,frame*Math.PI/2+Math.PI/4,true,1,direction));}}
 villagerRoute(home){const h=petitionHome(home),b=buildingRect(this.state),door=b.x+b.w/2,road=17.5,path=Number.isInteger(home)&&this.state.village?.paths?.['h'+home]?.pts;
  // Villagers keep to the footpath their feet wore from home to the road.
  if(path&&path.length>1){const end=path[path.length-1];return[...path.map(([x,y])=>({x,y})),...(Math.abs(end[1]-road)>.3?[{x:end[0],y:road}]:[]),{x:door,y:road},{x:door,y:b.y+b.h+.6},{x:door,y:b.y+b.h-.4}];}
  return[h,{x:h.x,y:road},{x:door,y:road},{x:door,y:b.y+b.h+.6},{x:door,y:b.y+b.h-.4}];}
 updateVillagers(dt,playing){
  if(!this.scene)return;this.villagers??=new Map();const elapsed=playing?dt*(this.state.settings?.speed||1):0,live=new Set();
  const desk=this.state.facilities.find(f=>f.type==='reception'),b=buildingRect(this.state),spot=desk?getFacilityEntry(desk):{x:b.x+b.w/2,y:b.y+b.h-1.2};let queue=0;
  const along=(route,d)=>{let left=d;for(let k=1;k<route.length;k++){const p=route[k-1],q=route[k],len=Math.hypot(q.x-p.x,q.y-p.y);if(left<=len||k===route.length-1){const f=len?Math.max(0,Math.min(1,left/len)):0;return{x:p.x+(q.x-p.x)*f,y:p.y+(q.y-p.y)*f};}left-=len;}return route[route.length-1];};
  const length=route=>route.slice(1).reduce((sum,p,k)=>sum+Math.hypot(p.x-route[k].x,p.y-route[k].y),0);
  // Villagers with petitions and adventurers applying to join share the walk and the queue at the desk.
  const visitors=[...(this.state.petitions||[]).map(p=>({...p,look:null})),...(this.state.applicants||[]).map(a=>({...a,home:'road',look:applicantLook(a)}))];
  for(const p of visitors){if(p.status!=='coming'&&p.status!=='waiting')continue;live.add(p.id);let v=this.villagers.get(p.id);
   if(!v){const look=p.look||villagerLook(p),key=`actor-${look.id}-${look.class}`;if(!this.scene.textures.exists(key+'-south-idle'))p.look?this.bakeActor(look):this.bakeVillager(look);const start=gridPoint(...Object.values(petitionHome(p.home)));
    v={look,key,home:p.home,image:this.scene.add.image(start.x,start.y,key+'-south-idle').setOrigin(.5,48/52),x:start.x,y:start.y,direction:'south',path:[],phase:Math.random()*6};this.villagers.set(p.id,v);}
   let goal;
   if(p.status==='coming'){const route=this.villagerRoute(p.home),f=1-Math.max(0,p.eta)/(p.etaTotal||1);goal=gridPoint(...Object.values(along(route,length(route)*Math.max(0,Math.min(1,f)))));v.path=[];v.queued=false;}
   else{const slot=queue++,target=gridPoint(spot.x+(slot%2?.45:0)*(slot>0?1:0),spot.y+.15+slot*.5);if(!v.queued||Math.hypot(v.target.x-target.x,v.target.y-target.y)>2){v.path=this.pathBetween(v.x,v.y,target.x,target.y);if(!v.path.length)v.path=[target];v.queued=true;v.target=target;}goal=v.path[0]||target;}
   this.stepVillager(v,goal,elapsed,p.status==='coming');
  }
  for(const [id,v] of this.villagers){if(live.has(id))continue;
   // A villager whose request was answered walks back home and fades out.
   // An applicant who was hired is now a member; their own actor takes over.
   if(!v.leaving&&this.state.members.some(m=>m.id===v.look.id)){v.image.destroy();this.villagers.delete(id);continue;}
   if(!v.leaving){v.leaving=true;v.ttl=30;const route=[...this.villagerRoute(v.home)].reverse().map(p=>gridPoint(p.x,p.y)),inside=gridPoint(...Object.values(this.villagerRoute(v.home)[4]));v.path=[...this.pathBetween(v.x,v.y,inside.x,inside.y),...route.slice(1)];}
   v.ttl-=dt;if(v.path[0]&&Math.hypot(v.path[0].x-v.x,v.path[0].y-v.y)<=1)v.path.shift();
   if(!v.path.length||v.ttl<=0){v.image.setAlpha(Math.max(0,v.image.alpha-dt*2));if(v.image.alpha<=0){v.image.destroy();this.villagers.delete(id);}continue;}
   this.stepVillager(v,v.path[0],elapsed,false,true);}
 }
 stepVillager(v,goal,elapsed,direct,walkPath=false){
  const dx=goal.x-v.x,dy=goal.y-v.y,d=Math.hypot(dx,dy);let walking=false;
  if(d>.6){walking=true;if(direct&&d>60){v.x=goal.x;v.y=goal.y;}else{const step=Math.min(d,elapsed*(direct?Math.max(22,d*3):24));v.x+=dx/d*step;v.y+=dy/d*step;}v.direction=Math.abs(dx)>Math.abs(dy)*1.6?(dx<0?'west':'east'):(dy<0?'north':'south');}
  else if(!direct&&!walkPath&&v.path?.length)v.path.shift();
  const t=(this.realTime||0)+v.phase,pose=walking&&elapsed>0?'walk'+(Math.floor(this.elapsed*8)%4):Math.floor(t*1.5)%2?'breath':'idle',facing=!walking&&v.queued?'north':v.direction;
  v.image.setTexture(`${v.key}-${facing}-${pose}`).setPosition(Math.round(v.x),Math.round(v.y)).setDepth(Math.round(v.y)+.5);
 }
 clampFocus(){const a=gridPoint(WORLD.x0,WORLD.y1),b=gridPoint(WORLD.x1,WORLD.y0),c=gridPoint(WORLD.x0,WORLD.y0),d=gridPoint(WORLD.x1,WORLD.y1);this.focusX=Math.max(a.x+300,Math.min(b.x-300,this.focusX));this.focusY=Math.max(c.y+200,Math.min(d.y-200,this.focusY));}
 /** Grid position at the centre of the view, for music that follows the camera. */
 viewGrid(){return gridPosition(this.focusX||0,this.focusY||0);}
 focusGrid(x,y,zoom){const p=gridPoint(x,y);this.focusX=p.x;this.focusY=p.y;this.userPanned=true;if(zoom)this.zoom=zoom;this.applyView();}
 // Follow camera: glides and zooms to a team or one adventurer and stays with them until the screen is touched.
 focusMission(id){this.startFollow('mission',id);}
 startFollow(kind,id){
  this.follow={kind,id};this.userPanned=true;this.zoomTarget=Math.max(.3,Math.min(2.4,2.1/(this.baseZoom||1)));
  const p=this.followPoint();if(!p){this.follow=null;this.zoomTarget=null;return;}
  this.onFollow?.(this.followInfo());
 }
 stopFollow(){if(!this.follow)return;this.follow=null;this.zoomTarget=null;this.onFollow?.(null);}
 followMissionFor(){const f=this.follow;if(!f)return null;if(f.kind==='mission')return(this.state.missions||[]).find(m=>m.id===f.id);return(this.state.missions||[]).find(m=>(m.status==='active'||m.status==='decision')&&m.memberIds.includes(f.id));}
 followInfo(){
  const f=this.follow;if(!f)return null;
  if(f.kind==='event'){const foes=this.eventFoes();if(f.id==='boss'){const b=foes[0];return{kind:'event',id:f.id,missionId:null,name:'บอสโลก',quest:b?`HP ${Math.max(0,Math.round(b.hp/b.maxHp*100))}% · ${HUNT_ZONES[b.zone]?.name||''}`:null};}return{kind:'event',id:f.id,missionId:null,name:'มอนบุกหมู่บ้าน',quest:`เหลือ ${foes.length} ตัว`};}
  const m=this.followMissionFor(),quest=m&&QUESTS.find(q=>q.id===m.questId);
  const hunter=f.kind==='member'&&this.state.world?.hunters?.find(h=>h.id===f.id);if(hunter)return{kind:f.kind,id:f.id,missionId:null,name:(this.state.members||[]).find(x=>x.id===f.id)?.name||'',quest:`${({go:'กำลังเดินไป',hunt:'กำลังล่ามอนที่',return:'กำลังกลับจาก',carry:'แบกเพื่อนกลับจาก',carried:'สลบ ถูกหามกลับจาก',down:'สลบอยู่ที่',defend:'ป้องกันเมือง'})[hunter.mode]||''}${hunter.mode==='defend'?'':hunter.mission?(QUESTS.find(q=>q.id===(this.state.missions||[]).find(x=>x.id===hunter.mission)?.questId)?.name||''):HUNT_ZONES[hunter.zone]?.name||''}`};
  const names=f.kind==='member'?[(this.state.members||[]).find(x=>x.id===f.id)?.name]:(m?.memberIds||[]).map(id=>(this.state.members||[]).find(x=>x.id===id)?.name);
  return{kind:f.kind,id:f.id,missionId:m?.id||null,name:names.filter(Boolean).join(' · ')||'ทีม',quest:quest?.name||null};
 }
 eventFoes(){const id=this.follow?.id;return(this.state.world?.monsters||[]).filter(m=>!m.dead&&(id==='boss'?m.boss:m.raid));}
 followPoint(){
  const f=this.follow;if(!f)return null;
  if(f.kind==='event'){const foes=this.eventFoes();if(!foes.length)return null;const p=gridPoint(foes.reduce((s,m)=>s+m.x,0)/foes.length,foes.reduce((s,m)=>s+m.y,0)/foes.length);return{x:p.x,y:p.y-10};}
  if(f.kind==='member'){const a=this.actors.get(f.id);return a&&a.image.visible?{x:a.x,y:a.y-10}:null;}
  const team=[...this.actors.values()].filter(a=>a.missionId===f.id&&a.away&&a.image.visible);
  if(team.length)return{x:team.reduce((s,a)=>s+a.x,0)/team.length,y:team.reduce((s,a)=>s+a.y,0)/team.length-10};
  const m=(this.state.missions||[]).find(m=>m.id===f.id),quest=m&&QUESTS.find(q=>q.id===m.questId),site=quest&&QUEST_SITES[quest.id];return site?gridPoint(site.x,site.y):null;
 }
 // ---- The living world: hunters, free adventurers, porters and monsters drawn from the simulation ----
 actorKey(look){const key=`actor-${look.id}-${look.class}`;if(!this.scene.textures.exists(key+'-south-idle'))look.class==='villager'?this.bakeVillager(look):this.bakeActor(look);return key;}
 poseFor(h,moved,t,seed){
  if(h.mode==='down'||h.mode==='carried')return'sleep';
  const cc=JOB_COMBAT[h.job]||JOB_COMBAT[h.cls];if((h.mode==='hunt'||h.mode==='defend')&&cc&&cc.rate-h.atkCd<.28&&h.atkCd>0)return'train1';
  if(moved)return'walk'+(Math.floor(this.elapsed*8)%4);
  return Math.floor(t*1.5+seed)%2?'breath':'idle';
 }
 placeBody(image,key,h,p,pose,dir,depth){
  const lying=h&&(h.mode==='down'||h.mode==='carried');
  image.setTexture(`${key}-${lying||pose.startsWith('train')?'south':dir}-${pose}`).setVisible(true);
  if(lying){image.setRotation(-Math.PI/2).setPosition(Math.round(p.x),Math.round(p.y-(h.mode==='carried'?20:4))).setDepth(depth+(h.mode==='carried'?2:-.2));}
  else image.setRotation(0).setPosition(Math.round(p.x),Math.round(p.y)).setDepth(depth);
 }
 updateHunter(a,h,playing){
  const p=gridPoint(h.x,h.y),dx=p.x-a.x,dy=p.y-a.y,moved=Math.hypot(dx,dy)>.05&&playing;
  if(moved)a.direction=Math.abs(dx)>Math.abs(dy)*1.6?(dx<0?'west':'east'):(dy<0?'north':'south');
  a.x=p.x;a.y=p.y;const m=a.member,pose=this.poseFor(h,moved,this.realTime||0,hash(m.id)%5);
  this.placeBody(a.image,`actor-${m.id}-${m.class}`,h,p,pose,a.direction,Math.round(p.y)+.3);
 }
 // The guild's caravan rolls out along the east road to the capital and back.
 updateCaravan(){const c=this.state.trade?.caravan;if(!c){this.wagon?.setVisible(false);return;}
  if(!this.scene.textures.exists('caravan-wagon')){const sp=makeBreadWagon(0);this.texture('caravan-wagon',sp.canvas);this.wagonFoot={x:sp.footX,y:sp.footY};}
  this.wagon??=this.scene.add.image(0,0,'caravan-wagon').setScale(.6);
  const lot=this.villageLot('caravan')||{x:38.5,y:19.5},home={x:lot.x+1.4,y:lot.y+2.6},far={x:64,y:17.5},road={x:Math.max(home.x,36),y:17.5};
  const k=1-c.left/c.total,out=k<.5,f=out?k*2:(1-k)*2,leg=Math.hypot(road.x-home.x,road.y-home.y),tot=leg+Math.hypot(far.x-road.x,far.y-road.y),d=f*tot;
  const at=d<leg?{x:home.x+(road.x-home.x)*d/(leg||1),y:home.y+(road.y-home.y)*d/(leg||1)}:{x:road.x+(far.x-road.x)*(d-leg)/(tot-leg),y:17.5};
  const p=gridPoint(at.x,at.y);this.wagon.setOrigin(this.wagonFoot.x/this.wagon.width,this.wagonFoot.y/this.wagon.height).setPosition(Math.round(p.x),Math.round(p.y)).setDepth(p.y+2).setFlipX(!out).setVisible(at.x<60);}
 // ---- The guild master on foot: the player's own character in the world. ----
 slashArc(x,y,angle){const g=this.scene.add.graphics().setDepth(y+400).setPosition(x,y);g.lineStyle(3,0xfff8e7,.95);g.beginPath();g.arc(0,0,14,angle-1.1,angle+1.1);g.strokePath();g.lineStyle(1,0xffe08a,.9);g.beginPath();g.arc(0,0,10,angle-.9,angle+.9);g.strokePath();this.scene.tweens.add({targets:g,alpha:0,scale:1.3,duration:220,onComplete:()=>g.destroy()});}
 updateHero(dt){
  const h=this.state.hero,master=this.actors.get('master');
  if(!h?.active){if(this.heroImage)this.heroImage.setVisible(false);this.heroCam=false;return;}
  if(master)master.image.setVisible(false);
  const p=this.state.profile||{masterName:'หัวหน้ากิลด์',hair:'#5b4637',outfit:'#6f8f6a',skin:'#f1c9a5',hairStyle:'short'},m={id:'master',name:p.masterName,class:'master',hair:p.hair,outfit:p.outfit,skin:p.skin,hairStyle:p.hairStyle};
  if(!this.scene.textures.exists('actor-master-master-south-idle'))this.bakeActor(m);
  this.heroImage??=this.scene.add.image(0,0,'actor-master-master-south-idle').setOrigin(.5,48/52);
  const at=gridPoint(h.x,h.y),sx=h.fx-h.fy,sy=h.fx+h.fy,dir=Math.abs(sx)>Math.abs(sy)?(sx>0?'east':'west'):(sy>0?'south':'north');
  const pose=h.down>0?'sleep':h.swing>0?(h.swing>.12?'train0':'train1'):h.moving?'walk'+(Math.floor((this.realTime||0)*10)%4):Math.floor((this.realTime||0)*1.5)%2?'breath':'idle';
  this.placeBody(this.heroImage,'actor-master-master',{mode:h.down>0?'down':'hunt'},at,pose,dir,at.y+1);
  this.heroImage.setVisible(true).setAlpha(h.dash>0?.6:1);
  // Health and a little name tag above the master's head.
  const ratio=h.hp/Math.max(1,h.maxHp);this.hpBars.fillStyle(0x3b302a,.85).fillRect(Math.round(at.x-11),Math.round(at.y-40),22,4);this.hpBars.fillStyle(ratio<.35?0xe0a050:0x7fd18b,1).fillRect(Math.round(at.x-10),Math.round(at.y-39),Math.round(20*ratio),2);
  // The camera stays with the master.
  if(!this.heroCam){this.heroCam=true;this.stopFollow?.();this.zoomTarget=Math.max(.3,Math.min(2.4,2.1/(this.baseZoom||1)));}
  const k=1-Math.pow(.004,Math.min(dt,.1));this.focusX+=(at.x-this.focusX)*k;this.focusY+=(at.y-10-this.focusY)*k;this.userPanned=true;
  if(this.zoomTarget){this.zoom+=(this.zoomTarget-this.zoom)*Math.min(1,dt*4);if(Math.abs(this.zoomTarget-this.zoom)<.005){this.zoom=this.zoomTarget;this.zoomTarget=null;}}
  this.applyView();
 }
 // While a festival runs its building twinkles, bunting and balloons go up, and lanterns rise over the village.
 updateFestival(dt){
  const live=this.state.festivals?.live,t=this.realTime||0;
  for(const e of this.villageProps?.values()||[])for(const img of e.images)if(img.festKey)img.setTexture(`${img.festKey}-${live?Math.floor(t*2)%2:0}`);
  const key=live?live.kind+live.start:null;
  if(key!==this.festKey){for(const d of this.festDecor||[])d.image.destroy();this.festDecor=[];this.festKey=key;
   if(live){const F={tournament:'arena',harvest:'fairground',lantern:'stage'}[live.kind],lot=this.villageLot(F),[w,h]=VILLAGE_FOOTPRINT[F]||[4,3];
    for(const kind of ['bunting','balloon','lantern','confetti'])for(let f=0;f<2;f++){const k=`fest-${kind}-${f}`;if(!this.scene.textures.exists(k))this.texture(k,makeFestivalDecor(kind,f).canvas);}
    const spots=[[-.6,h+.4,'bunting'],[w+.2,h+.2,'bunting'],[-.8,-.2,'balloon'],[w+.6,-.4,'balloon'],[w/2,h+1.2,'confetti']];
    for(const [dx,dy,kind] of spots){const sp=makeFestivalDecor(kind,0),p=gridPoint(lot.x+dx,lot.y+dy);this.festDecor.push({kind,image:this.scene.add.image(p.x-sp.footX,p.y-sp.footY,`fest-${kind}-0`).setOrigin(0).setDepth(p.y+2),x:p.x,y:p.y});}
    if(live.kind==='lantern')for(let i=0;i<14;i++){const p=gridPoint(lot.x+w/2+(i%5-2)*2.2,lot.y+h/2+Math.floor(i/5)*1.6),sp=makeFestivalDecor('lantern',0);this.festDecor.push({kind:'sky',image:this.scene.add.image(p.x,p.y,'fest-lantern-0').setOrigin(.5,1).setBlendMode(Phaser.BlendModes.ADD),x:p.x,y:p.y,phase:i*1.7,foot:sp.footY});}}}
  for(const d of this.festDecor||[]){if(d.kind==='sky'){const open=this.state.elapsed>=live.open,k=open?((t*.12+d.phase*.07)%1):0;d.image.setTexture('fest-lantern-'+(Math.floor(t*2+d.phase)%2)).setPosition(Math.round(d.x+Math.sin(t+d.phase)*6),Math.round(d.y-k*260)).setAlpha(open?1-k*.7:0).setDepth(d.y+900);}
   else d.image.setTexture(`fest-${d.kind}-${Math.floor(t*2+d.x)%2}`);}
 }
 updateLife(dt,playing){
  this.updateCaravan();
  this.updateFestival(dt);
  const w=this.state.world;if(!w||!this.scene)return;const t=this.realTime||0;
  this.lifeSprites??=new Map();this.hpBars??=this.scene.add.graphics().setDepth(99990);this.hpBars.clear();
  const seen=new Set(),hunters=new Map(w.hunters.map(h=>[h.id,h]));
  const bar=(x,y,ratio,color)=>{if(ratio>=1)return;this.hpBars.fillStyle(0x3b302a,.8).fillRect(Math.round(x-8),Math.round(y),16,3);this.hpBars.fillStyle(color,1).fillRect(Math.round(x-7),Math.round(y)+1,Math.max(1,Math.round(14*Math.max(0,ratio))),1);};
  const sprite=(id,make)=>{let s=this.lifeSprites.get(id);if(!s){s=make();this.lifeSprites.set(id,s);}seen.add(id);return s;};
  // Monsters of the hunting grounds, raids and bosses.
  for(const m of w.monsters){
   const sp=SPECIES[m.species],src=makeMonster(m.species,0),s=sprite(m.id,()=>({image:this.scene.add.image(0,0,this.monTex(m.species,0)).setOrigin(src.footX/src.canvas.width,src.footY/src.canvas.height),shadow:this.scene.add.image(0,0,'msh-'+sp.size[0]).setOrigin(.5),last:{x:m.x,y:m.y},alpha:1,flash:0}));
   if(!this.scene.textures.exists('msh-'+sp.size[0])){const c=document.createElement('canvas');c.width=Math.round(sp.size[0]*.8);c.height=5;const g=c.getContext('2d');g.fillStyle='rgba(60,50,40,.24)';g.beginPath();g.ellipse(c.width/2,2.5,c.width/2,2.5,0,0,Math.PI*2);g.fill();this.texture('msh-'+sp.size[0],c);s.shadow.setTexture('msh-'+sp.size[0]);}
   s.alpha=m.dead?Math.max(0,s.alpha-dt*2.5):Math.min(1,s.alpha+dt*2);s.flash=Math.max(0,s.flash-dt);
   const p=gridPoint(m.x,m.y),moving=Math.hypot(m.x-s.last.x,m.y-s.last.y)>.002;if(moving&&Math.abs((m.x-s.last.x)-(m.y-s.last.y))>.001)s.flip=(m.x-s.last.x)-(m.y-s.last.y)<0;s.last={x:m.x,y:m.y};
   s.atk=Math.max(0,(s.atk||0)-dt);const lift=m.air>0?28+Math.sin(t*3)*4:sp.kind==='float'?Math.sin(t*2+hash(m.id)%7)*2.5:sp.kind==='hop'&&moving?Math.abs(Math.sin(t*7))*5:0,frame=s.atk>0?2:Math.floor(t*(moving?6:1.5)+hash(m.id)%5)%2,scale=MONSTER_STATS[m.species]?.boss?(m.species==='emberDragon'?1.25:1.6):m.elite?1.35:m.raid?1.15:1;
   const under=m.under>0;s.image.setTexture(this.monTex(m.species,frame,s.flash>0)).setPosition(Math.round(p.x),Math.round(p.y-lift+(under?10:0))).setDepth(p.y).setFlipX(!!s.flip).setScale(scale).setAlpha(under?.25:s.alpha).setVisible(s.alpha>0).setTint(m.elite?0xffe0b0:0xffffff);
   // Bosses carry a wide health bar with their name and current act.
   if((m.questBoss||MONSTER_STATS[m.species]?.boss)&&!m.dead){const y=p.y-sp.size[1]*scale-14,w=64,r=Math.max(0,m.hp/m.maxHp);this.hpBars.fillStyle(0x2c241e,.9).fillRect(Math.round(p.x-w/2-1),Math.round(y-1),w+2,7);this.hpBars.fillStyle(m.enraged?0xff5a3a:0xd9623f,1).fillRect(Math.round(p.x-w/2),Math.round(y),Math.round(w*r),5);
    s.label??=this.scene.add.text(0,0,'',{fontFamily:'"Noto Sans Thai", sans-serif',fontSize:'9px',fontStyle:'bold',color:'#ffe9c7',stroke:'#3b302a',strokeThickness:3}).setOrigin(.5,1).setResolution(2);s.label.setText(`${SPECIES[m.species]?.name||''}${m.phaseName?' · '+m.phaseName:''}`).setPosition(Math.round(p.x),Math.round(y-2)).setDepth(p.y+2).setVisible(s.alpha>0);}else s.label?.setVisible(false);
   if(m.elite&&!m.dead){s.crown??=this.scene.add.text(0,0,'👑',{fontSize:'12px'}).setOrigin(.5,1);s.crown.setPosition(Math.round(p.x),Math.round(p.y-sp.size[1]*scale-10)).setDepth(p.y+1).setVisible(s.alpha>0);}else s.crown?.setVisible(false);
   s.shadow.setPosition(Math.round(p.x),Math.round(p.y)).setDepth(p.y-.5).setAlpha(s.alpha).setVisible(s.alpha>0);
   if(!m.dead&&!under)bar(p.x,p.y-sp.size[1]*scale-6,m.hp/m.maxHp,m.raid||m.elite||MONSTER_STATS[m.species]?.boss?0xd9623f:0xe0a24a);
  }
  // Free adventurers: in town, out hunting, or carried home.
  for(const f of w.free){
   const look={id:f.id,name:f.name,class:f.class,hair:f.hair},key=this.actorKey(look),h=f.mode==='out'?hunters.get(f.id):null;
   const s=sprite(f.id,()=>({image:this.scene.add.image(0,0,key+'-south-idle').setOrigin(.5,48/52),x:f.x,y:f.y,dir:'south'}));
   const gx=h?h.x:f.x,gy=h?h.y:f.y,p=gridPoint(gx,gy),dx=p.x-(s.px??p.x),dy=p.y-(s.py??p.y),moved=Math.hypot(dx,dy)>.05&&playing;s.px=p.x;s.py=p.y;
   if(moved)s.dir=Math.abs(dx)>Math.abs(dy)*1.6?(dx<0?'west':'east'):(dy<0?'north':'south');
   const pose=h?this.poseFor(h,moved,t,hash(f.id)%5):moved?'walk'+(Math.floor(this.elapsed*8)%4):(Math.floor(t*1.5+hash(f.id)%5)%2?'breath':'idle');
   this.placeBody(s.image,key,h,p,pose,s.dir,Math.round(p.y)+.25);
   if(h&&h.mode!=='down'&&h.mode!=='carried')bar(p.x,p.y-30,h.hp/h.maxHp,0x7fae6f);
  }
  for(const h of w.hunters)if(h.kind==='member'&&h.mode!=='down'&&h.mode!=='carried'){const p=gridPoint(h.x,h.y);bar(p.x,p.y-30,h.hp/h.maxHp,0x6fb2d6);}
  // Porters sent from the guild with a stretcher.
  for(const pt of w.porters){
   const look=villagerLook({seed:hash(pt.id),client:'คนแบกเปล'}),key=this.actorKey(look),s=sprite(pt.id,()=>({image:this.scene.add.image(0,0,key+'-south-idle').setOrigin(.5,48/52),dir:'south'}));
   const p=gridPoint(pt.x,pt.y),dx=p.x-(s.px??p.x),dy=p.y-(s.py??p.y),moved=Math.hypot(dx,dy)>.05&&playing;s.px=p.x;s.py=p.y;if(moved)s.dir=Math.abs(dx)>Math.abs(dy)*1.6?(dx<0?'west':'east'):(dy<0?'north':'south');
   this.placeBody(s.image,key,null,p,moved?'walk'+(Math.floor(this.elapsed*8)%4):'idle',s.dir,Math.round(p.y)+.2);
  }
  // Quest scenes: the escorted wagon, the raided field, the nodes being gathered and the survivors walking home.
  this.questGfx??=this.scene.add.graphics().setDepth(-9000);this.questGfx.clear();this.cropGfx?.clear();this.flockLeft=1;
  for(const ms of this.state.missions||[]){const rt=ms.rt;if(!rt||ms.status!=='active')continue;
   if(rt.wagon){const wg=rt.wagon,p=gridPoint(wg.x,wg.y);if(!this.scene.textures.exists('qwagon-0'))for(let f=0;f<2;f++)this.texture('qwagon-'+f,makeBreadWagon(f).canvas);
    const s=sprite('wagon-'+ms.id,()=>({image:this.scene.add.image(0,0,'qwagon-0').setOrigin(62/124,74/82),last:{x:wg.x,y:wg.y}}));const dx=wg.x-s.last.x,dy=wg.y-s.last.y;if(Math.abs(dx-dy)>.001)s.flip=dx-dy<0;s.last={x:wg.x,y:wg.y};
    s.image.setTexture('qwagon-'+(wg.moving?Math.floor(t*4)%2:0)).setPosition(Math.round(p.x),Math.round(p.y-(wg.moving?Math.abs(Math.sin(t*9)):0))).setDepth(p.y+40).setFlipX(!!s.flip).setScale(.62);
    bar(p.x,p.y-52,wg.hp/wg.maxHp,0xe8b04a);if(rt.ambushed&&Math.floor(t*2)%2)this.hpBars.fillStyle(0xd9584a,1).fillTriangle(p.x-5,p.y-64,p.x+5,p.y-64,p.x,p.y-57);}
   if(rt.field){const f=rt.field,lost=1-rt.crops/100,c=gridPoint(f.x,f.y);
    // Eaten patches open up in the wheat: bare soil and stubble drawn over the crop, more as the field is lost.
    if(f.kind==='crops'){const F=FIELDS.find(x=>x.kind==='wheat'),g=this.cropGfx??=this.scene.add.graphics();g.setDepth(gridPoint(MEADOW_SCENE.scarecrow.x,MEADOW_SCENE.scarecrow.y).y+3);
     const cells=[];for(let yy=0;yy<4;yy++)for(let xx=0;xx<6;xx++)cells.push([F.x+.5+xx*(F.w-1)/5,F.y+.5+yy*(F.h-1)/3,(xx*7+yy*13)%24]);cells.sort((a,b)=>a[2]-b[2]);
     for(const [x,y] of cells.slice(0,Math.round(lost*cells.length))){const q=gridPoint(x,y);g.fillStyle(0x9a7d55,1).fillEllipse(q.x,q.y,30,15);g.fillStyle(0x7f6646,1).fillEllipse(q.x+2,q.y+1,20,9);g.lineStyle(1,0xc9a86a,1);for(let k=-2;k<=2;k++)g.lineBetween(q.x+k*5,q.y-1,q.x+k*5+1,q.y-5);}}
    else this.flockLeft=rt.crops/100;
    this.hpBars.fillStyle(0x3b302a,.85).fillRect(Math.round(c.x-30),Math.round(c.y-70),60,7);this.hpBars.fillStyle(rt.crops>50?0x9fd06a:rt.crops>25?0xe8b04a:0xd9584a,1).fillRect(Math.round(c.x-29),Math.round(c.y-69),Math.round(58*rt.crops/100),5);}
   if(rt.nodes&&rt.stage!=='go')for(const [i,nd] of rt.nodes.entries()){const q=gridPoint(nd.x,nd.y),done=nd.progress>=1,g=this.questGfx;
    g.fillStyle(done?0x9fd06a:0xfff1c4,done?.5:.35+.25*Math.sin(t*4+i)).fillEllipse(q.x,q.y,20,10);if(!done){g.lineStyle(2,0xf4b860,1).beginPath();g.arc(q.x,q.y-14,6,-Math.PI/2,-Math.PI/2+Math.PI*2*nd.progress);g.strokePath();}}
   if(rt.npcs)rt.npcs.forEach((n,i)=>{const look=villagerLook({seed:hash(ms.id)+i,client:'ทีมสำรวจ'}),key=this.actorKey(look),s=sprite(`npc-${ms.id}-${i}`,()=>({image:this.scene.add.image(0,0,key+'-south-idle').setOrigin(.5,48/52),dir:'south'}));
    const p=gridPoint(n.x,n.y),dx=p.x-(s.px??p.x),dy=p.y-(s.py??p.y),moved=Math.hypot(dx,dy)>.05&&playing;s.px=p.x;s.py=p.y;if(moved)s.dir=Math.abs(dx)>Math.abs(dy)*1.6?(dx<0?'west':'east'):(dy<0?'north':'south');
    this.placeBody(s.image,key,null,p,moved?'walk'+(Math.floor(this.elapsed*8)%4):'idle',s.dir,Math.round(p.y)+.2);});
  }
  for(const [id,s] of this.lifeSprites)if(!seen.has(id)){s.image.destroy();s.shadow?.destroy();s.crown?.destroy();s.label?.destroy();this.lifeSprites.delete(id);}
  this.playFx(dt);
 }
 // Damage numbers, skill flashes and knock-outs.
 floatText(x,y,text,color,size=9){
  this.fxTexts??=[];let o=this.fxTexts.find(o=>!o.live);
  if(!o){if(this.fxTexts.length>=48)return;o={text:this.scene.add.text(0,0,'',{fontFamily:'"Noto Sans Thai", sans-serif',fontSize:'9px',fontStyle:'bold',color:'#fff',stroke:'#3b302a',strokeThickness:3}).setOrigin(.5,1).setResolution(2)};this.fxTexts.push(o);}
  Object.assign(o,{live:true,age:0,x,y,drift:(Math.random()-.5)*8});o.text.setText(text).setColor(color).setFontSize(size).setVisible(true).setAlpha(1);
 }
 ring(x,y,color,radius=18){const g=this.scene.add.graphics().setDepth(y+300).setPosition(x,y);g.lineStyle(2,color,.9).strokeEllipse(0,0,radius*2,radius);this.scene.tweens.add({targets:g,scale:1.6,alpha:0,duration:520,onComplete:()=>g.destroy()});}
 shot(from,to,color,kind){const g=this.scene.add.graphics().setDepth(Math.max(from.y,to.y)+250);g.lineStyle(kind==='pierce'||kind==='spark'?3:2,color,1);
  // Lightning zigzags, notes and bolts end in a small burst; arrows and shots are straight lines.
  if(kind==='spark'){const n=5;g.beginPath();g.moveTo(from.x,from.y-14);for(let i=1;i<n;i++){const k=i/n;g.lineTo(from.x+(to.x-from.x)*k+(Math.random()-.5)*8,from.y-14+(to.y-from.y+4)*k+(Math.random()-.5)*8);}g.lineTo(to.x,to.y-10);g.strokePath();}else g.lineBetween(from.x,from.y-14,to.x,to.y-10);
  if(kind!=='arrow'&&kind!=='pierce'){g.fillStyle(color,.9);g.fillCircle(to.x,to.y-10,kind==='fire'?6:4);}this.scene.tweens.add({targets:g,alpha:0,duration:260,onComplete:()=>g.destroy()});}
 playFx(dt){
  const events=drainFx();if(!this.scene)return;
  const view=this.camera?.worldView,near=p=>!view||(p.x>view.x-80&&p.x<view.right+80&&p.y>view.y-80&&p.y<view.bottom+80);
  for(const e of events){
   const p=gridPoint(e.x,e.y);if(!near(p))continue;this.onFx?.(e);
   if(e.type==='hit'){const s=this.lifeSprites?.get(e.id);if(s)s.flash=.12;this.floatText(p.x,p.y-28,String(e.amount),e.crit?'#ffd36a':'#ffffff',e.crit?11:9);const col=SHOT_COLORS[e.kind];if(col){const f=gridPoint(e.fx,e.fy);this.shot(f,p,col,e.kind);}else if(e.kind==='holy')this.ring(p.x,p.y-8,0xfff1c4,10);}
   else if(e.type==='hurt'){this.floatText(p.x,p.y-(e.wagon?56:34),String(e.amount),e.wagon?'#ffcf7a':'#ff8a7a',9);const ms=this.lifeSprites?.get(e.by);if(ms)ms.atk=.3;}
   else if(e.type==='spit'){const f=gridPoint(e.x,e.y),q=gridPoint(e.tx,e.ty);this.shot({x:f.x,y:f.y-6},q,/ember|magma|Dragon|stone/.test(e.species)?0xf08a4b:/mist|wisp|ghost/.test(e.species)?0x9fd6d0:0x9fd06a,'bolt');}
   else if(e.type==='charge'){this.dustPuff(e.x-.5,e.y-.5,1,1);this.floatText(p.x,p.y-40,'พุ่งชน!','#ffcf7a',9);}
   else if(e.type==='slam'){this.ring(p.x,p.y,0xb39d6d,30);this.ring(p.x,p.y,0xe8dccb,18);this.floatText(p.x,p.y-30,'ทุบพื้น!','#ffcf7a',9);}
   else if(e.type==='burrow'){this.dustPuff(e.x-.6,e.y-.6,1.2,1.2);this.floatText(p.x,p.y-30,'มุดดิน!','#e8dccb',9);}
   else if(e.type==='erupt'){this.ring(p.x,p.y,0xd9b26f,34);this.dustPuff(e.x-.8,e.y-.8,1.6,1.6);this.floatText(p.x,p.y-50,'โผล่จากทราย!','#ffcf7a',10);this.camera?.shake?.(160,.004);}
   else if(e.type==='breath'){const q=gridPoint(e.tx,e.ty);for(let k=1;k<=5;k++){const x=p.x+(q.x-p.x)*k/5,y=p.y-20+(q.y-p.y+12)*k/5;this.scene.time.delayedCall(k*60,()=>this.ring(x,y,k%2?0xf08a4b:0xffd36a,10+k*5));}this.floatText(p.x,p.y-70,'พ่นไฟ!','#ff9a5a',12);this.camera?.shake?.(200,.005);}
   else if(e.type==='summon'){this.ring(p.x,p.y,0xb98ad1,36);this.floatText(p.x,p.y-60,'เรียกสมุน!','#d9b8ff',11);}
   else if(e.type==='phase'){this.floatText(p.x,p.y-80,'⚠ '+e.name,'#ffb070',13);this.ring(p.x,p.y,0xff7a4a,46);this.camera?.shake?.(260,.006);}
   else if(e.type==='telegraph'){const r=e.r*CELL_W*1.4,g=this.scene.add.graphics().setDepth(p.y-2).setPosition(p.x,p.y);g.fillStyle(0xd9584a,.22).fillEllipse(0,0,r*2,r);g.lineStyle(2,0xff5a3a,.9).strokeEllipse(0,0,r*2,r);this.scene.tweens.add({targets:g,alpha:{from:.4,to:1},yoyo:true,repeat:2,duration:230,onComplete:()=>g.destroy()});}
   else if(e.type==='firering'){for(let k=0;k<10;k++){const a=k/10*Math.PI*2,q=gridPoint(e.x+Math.cos(a)*e.r*.8,e.y+Math.sin(a)*e.r*.8);this.ring(q.x,q.y,k%2?0xf08a4b:0xffd36a,14);}this.camera?.shake?.(220,.006);}
   else if(e.type==='dive'){this.ring(p.x,p.y,0xd9c8a0,40);this.dustPuff(e.x-.9,e.y-.9,1.8,1.8);this.floatText(p.x,p.y-40,'โฉบลงมา!','#ffcf7a',11);}
   else if(e.type==='miss')this.floatText(p.x,p.y-60,'ฟันไม่ถึง!','#bfe3ff',8);
   else if(e.type==='munch')this.floatText(p.x,p.y-24,'งั่ม!','#f4b860',8);
   else if(e.type==='gather'){this.floatText(p.x,p.y-20,e.done?'เสร็จ!':'+','#bff0a0',e.done?10:9);}
   else if(e.type==='questWave')this.floatText(p.x,p.y-40,e.scenario==='escort'?'ซุ่มโจมตี!':e.scenario==='defend'?'มอนบุกระลอกใหม่!':`ศัตรูระลอก ${e.wave}!`,'#ffd36a',11);
   else if(e.type==='questBoss'){this.floatText(p.x,p.y-60,'บอสปรากฏตัว!','#ff8a5a',13);this.ring(p.x,p.y,0xd9584a,40);}
   else if(e.type==='questClear'){this.floatText(p.x,p.y-50,'สำเร็จ!','#9fe08a',13);this.ring(p.x,p.y,0x9fe08a,36);}
   else if(e.type==='heal')this.floatText(p.x,p.y-36,'+'+e.amount,e.potion?'#9fe0ff':'#8fe28a',9);
   else if(e.type==='skill'){this.floatText(p.x,p.y-44,e.name,'#fff1c4',8);if(e.skill==='fireball'){const q=gridPoint(e.tx,e.ty);this.ring(q.x,q.y,0xf08a4b,22);}else this.ring(p.x,p.y,e.skill==='guard'?0x8eb6e0:e.skill==='blessing'?0x9fe08a:0xe8cd8c,e.skill==='blessing'?28:16);}
   else if(e.type==='ko')this.floatText(p.x,p.y-30,'สลบ!','#ffb0a0',10);
   else if(e.type==='kill')this.dustPuff(e.x-.4,e.y-.4,.8,.8);
   else if(e.type==='swing'){const f=gridPoint(e.x+e.fx*.8,e.y+e.fy*.8);this.slashArc(f.x,f.y-12,Math.atan2(f.y-p.y,f.x-p.x));}
   else if(e.type==='dash')this.dustPuff(e.x-.3,e.y-.3,.6,.6);
   else if(e.type==='dodge')this.floatText(p.x,p.y-38,'หลบ!','#bfe3ff',9);
   else if(e.type==='level'){this.floatText(p.x,p.y-48,'LEVEL UP! Lv.'+e.level,'#ffe08a',11);this.ring(p.x,p.y,0xffe08a,26);}
   else if(e.type==='revive')this.floatText(p.x,p.y-40,'ฟื้นแล้ว','#9fe08a',9);
   else if(e.type==='sell')this.floatText(p.x,p.y-40,`ขายของ ${e.amount} ชิ้น`,'#ffe08a',9);
  }
  for(const o of this.fxTexts||[])if(o.live){o.age+=dt;if(o.age>.9){o.live=false;o.text.setVisible(false);continue;}o.text.setPosition(Math.round(o.x+o.drift*o.age),Math.round(o.y-o.age*22)).setAlpha(Math.min(1,(.9-o.age)*3)).setDepth(o.y+500);}
 }
 roomFor(m){if(this.prepping?.has(m.id)){const board=this.state.facilities.find(f=>f.type==='board');if(board)return board;}let type=m.waitingReason?'reception':m.injury>0?'infirmary':m.energy<60||m.task==='rest'?'dorm':m.task==='train'?'training':m.task==='work'?'workshop':'reception';
  if(m.task==='rest'&&m.energy>=95&&!m.injury&&!m.waitingReason)type=['reception','kitchen','training','dorm'][hash(m.id)%4];
  // Sleepers and patients are spread over every bed, two to a bed, instead of crowding the first one.
  if(type==='dorm'||type==='infirmary'){const plan=this.bedPlan();const f=plan.get(m.id);if(f)return f;if(type==='dorm'&&this.wantsBed(m))return this.state.facilities.find(f=>f.type==='reception')||this.state.facilities[0];}
  return this.state.facilities.find(f=>f.type===type)||this.state.facilities[0];}
 wantsBed(m){return m.injury>0||(m.task==='rest'&&m.energy<95&&!m.waitingReason);}
 bedPlan(){
  const key=this.state.elapsed|0;if(this.bedPlanKey===key&&this.bedPlanCache)return this.bedPlanCache;
  const plan=new Map(),away=new Set((this.state.missions||[]).filter(x=>x.status==='active'||x.status==='decision').flatMap(x=>x.memberIds));
  for(const type of ['infirmary','dorm']){const beds=this.state.facilities.filter(f=>f.type===type);let slot=0;
   for(const m of [...this.state.members].sort((a,b)=>a.id<b.id?-1:1)){if(plan.has(m.id)||away.has(m.id)||m.errand)continue;const wants=type==='infirmary'?m.injury>0:!m.injury&&m.task==='rest'&&m.energy<95&&!m.waitingReason;if(!wants)continue;
    if(slot>=beds.length*2)break;plan.set(m.id,beds[slot%beds.length]);slot++;}}
  this.bedPlanKey=key;this.bedPlanCache=plan;return plan;}

 syncActors(){
  const ids=new Set([...this.state.members.map(m=>m.id),'master']);for(const [id,a] of this.actors)if(!ids.has(id)){a.image.destroy();a.emote?.destroy();this.actors.delete(id);}
  const idleKey=this.signature+'|'+this.state.members.map(m=>m.id).join(',');if(this.idleKey!==idleKey){this.idleKey=idleKey;const hall=buildingRect(this.state),spots=getWalkableSpots(this.state),claimed=[];this.idleSpots=this.state.members.map((m,i)=>{const desired=[{x:2.5,y:2.5},{x:4.25,y:2},{x:5,y:3.5},{x:1.75,y:2.75}][i%4],tx=hall.x+desired.x,ty=hall.y+desired.y+(Math.floor(i/4)*.6);const p=spots.filter(p=>claimed.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=.8)).sort((a,b)=>(a.x-tx)**2+(a.y-ty)**2-((b.x-tx)**2+(b.y-ty)**2))[0]||spots[i%spots.length];claimed.push(p);return p;});}
  // Adventurers who just took a board job gather at the board for a moment before heading out.
  this.prepping=new Set(this.state.missions.filter(m=>m.status==='active'&&m.prep>0).flatMap(m=>m.memberIds));
  const away=new Set([...this.state.missions.filter(m=>['active','decision'].includes(m.status)&&!(m.prep>0)).flatMap(m=>m.memberIds),...this.state.members.filter(m=>m.errand).map(m=>m.id),...(this.state.world?.hunters||[]).filter(h=>h.kind==='member').map(h=>h.id)]);
  for(const m of this.state.members){const room=this.roomFor(m),b=room&&getRoomSize(room.type,room.rotation||0),n=hash(m.id);
   if(!b)continue;const roommates=this.state.members.filter(other=>this.roomFor(other)?.id===room.id),slot=roommates.findIndex(other=>other.id===m.id);
   const entry=getFacilityEntry(room),hall=buildingRect(this.state),idle=m.energy>=95&&!m.injury&&m.task==='rest',index=this.state.members.findIndex(other=>other.id===m.id);
   // Spread people sharing a room point into a small cluster so nobody stands inside anybody else.
   const spread=[[0,0],[.5,0],[-.5,0],[.25,.45],[-.25,.45],[.75,.45],[-.75,.45],[0,.9]][slot%8],shift=roommates.length===2?-.25:0;
   const logical=idle?this.idleSpots[index]:{x:entry.x+spread[0]+shift,y:entry.y+spread[1]};
   const target=gridPoint(logical.x,logical.y);
   let a=this.actors.get(m.id);if(!a){
    this.bakeActor(m);
    a={image:this.scene.add.image(target.x,target.y,`actor-${m.id}-${m.class}-south-idle`).setOrigin(.5,48/52),x:target.x,y:target.y,clock:n%6,roomId:room.id,class:m.class,direction:['south','east','south','west'][n%4]};this.actors.set(m.id,a);
    // A new arrival walks up the road and in through the front door.
    if(this.arrivals?.delete(m.id)&&!this.frozen){const door=hall.x+hall.w/2,start=gridPoint(door,hall.y+hall.h+3),inside=gridPoint(door,hall.y+hall.h-.5);a.x=start.x;a.y=start.y;a.image.setPosition(start.x,start.y);a.path=[inside,...this.pathBetween(inside.x,inside.y,target.x,target.y)];}
   }
   if(a.class!==m.class){this.bakeActor(m);a.class=m.class;}
   if(a.roomId!==room.id||(a.home&&Math.hypot(a.home.x-target.x,a.home.y-target.y)>3)){a.path=this.pathBetween(a.x,a.y,target.x,target.y);a.roomId=room.id;}
   const anchor=room.x+','+room.y+','+room.rotation;if(a.roomAnchor&&a.roomAnchor!==anchor){a.x=target.x;a.y=target.y;a.path=[];}a.roomAnchor=anchor;
   a.member=m;a.home=target;a.logicalHome=logical;a.away=away.has(m.id);if(!a.away)a.image.setVisible(true);if(this.frozen){a.x=target.x;a.y=target.y;}
  }
  this.assignBeds();
  this.syncMaster();
 }
 // Each bed takes one sleeper first and a second only when every bed is in use: sleepers in the dorm, patients in the infirmary.
 assignBeds(){
  const pillow=(f,lx)=>{const d=FACILITIES[f.type],r=f.rotation||0,ly=.33,[x,y]=r===1?[d.h-ly,lx]:r===2?[d.w-lx,d.h-ly]:r===3?[ly,d.w-lx]:[lx,ly];const p=gridPoint(f.x+x,f.y+y),base=gridPoint(f.x,f.y);return{x:p.x,y:p.y-13,depth:base.y+(d.w+d.h)*6+1};};
  const used=new Map();
  for(const a of this.actors.values()){a.bed=null;const m=a.member;if(!m||a.away||m.id==='master')continue;const f=this.state.facilities.find(f=>f.id===a.roomId);if(!f||!['dorm','infirmary'].includes(f.type))continue;
   const wants=f.type==='dorm'?m.task==='rest'&&m.energy<95&&!m.injury&&!m.waitingReason:m.injury>0;if(!wants)continue;
   const k=used.get(f.id)||0;if(k>=2)continue;used.set(f.id,k+1);a.bed=pillow(f,k?.68:.3);}
 }
 syncMaster(){
  // The player's guild master keeps the reception desk, or waits by the door before it exists.
  const p=this.state.profile,old=this.actors.get('master');
  if(!p){if(old){old.image.destroy();this.actors.delete('master');}return;}
  const m={id:'master',name:p.masterName,class:'master',hair:p.hair,outfit:p.outfit,skin:p.skin,hairStyle:p.hairStyle},look=[p.hair,p.outfit,p.skin,p.hairStyle].join();
  const desk=this.state.facilities.find(f=>f.type==='reception'),hall=buildingRect(this.state);
  // Behind the counter, on the far side from where visitors stand.
  const logical=desk?(()=>{const e=getFacilityEntry(desk),d=getRoomSize(desk.type,desk.rotation||0),cx=desk.x+d.w/2,cy=desk.y+d.h/2;return{x:cx+(cx-e.x)*.9,y:cy+(cy-e.y)*.9};})():{x:hall.x+hall.w/2,y:hall.y+hall.h-.8};
  const target=gridPoint(logical.x,logical.y);let a=old;
  if(!a){this.bakeActor(m);a={image:this.scene.add.image(target.x,target.y,'actor-master-master-south-idle').setOrigin(.5,48/52),x:target.x,y:target.y,clock:0,direction:'south',look};this.actors.set('master',a);}
  else if(a.look!==look){this.bakeActor(m);a.look=look;}
  if(a.home&&Math.hypot(a.home.x-target.x,a.home.y-target.y)>3)a.path=this.pathBetween(a.x,a.y,target.x,target.y);
  a.member=m;a.home=target;a.away=false;a.image.setVisible(true);if(this.frozen){a.x=target.x;a.y=target.y;}
 }
 arrive(ids){this.arrivals??=new Set();for(const id of ids)this.arrivals.add(id);}
 bakeActor(m){for(const direction of ['south','east','north','west']){
  for(const pose of direction==='south'?['idle','breath','blink','sleep','train0','train1','work0','work1','bed']:['idle','breath','blink','sleep','train0','train1','work0','work1'])this.texture(`actor-${m.id}-${m.class}-${direction}-${pose}`,makeActorTexture(m,0,false,1,direction,pose));
  for(let frame=0;frame<4;frame++)this.texture(`actor-${m.id}-${m.class}-${direction}-walk${frame}`,makeActorTexture(m,frame*Math.PI/2+Math.PI/4,true,1,direction));}}
 emoteTexture(kind){const key='emote-'+kind;if(this.scene.textures.exists(key))return key;const c=document.createElement('canvas');c.width=14;c.height=12;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  const px=(x,y,w,h,col)=>{g.fillStyle=col;g.fillRect(x,y,w,h);};
  if(kind==='z'){px(1,1,12,10,'#4f4540');px(2,2,10,8,'#fff8e7');px(4,3,6,1,'#6f6a8f');px(8,4,2,1,'#6f6a8f');px(6,5,2,1,'#6f6a8f');px(4,6,2,1,'#6f6a8f');px(4,7,6,1,'#6f6a8f');}
  else{px(1,1,12,10,'#4f4540');px(2,2,10,8,'#fff8e7');px(6,3,2,6,'#d98978');px(4,5,6,2,'#d98978');}
  this.texture(key,c);return key;}
 pathBetween(sx,sy,tx,ty){return findWalkPath(this.state,gridPosition(sx,sy),gridPosition(tx,ty)).map(p=>gridPoint(p.x,p.y));}

 update(dt){
  if(!this.ready)return;const playing=!this.frozen&&!document.hidden&&!this.state.settings?.paused&&!document.getElementById('confirm-dialog').open&&!document.getElementById('settings-dialog').open;
  const elapsed=playing?dt*(this.state.settings?.speed||1):0;this.elapsed+=elapsed;this.realTime=(this.realTime||0)+dt;
  for(const a of this.actors.values()){
   if(a.away){a.emote?.setVisible(false);const hunter=this.state.world?.hunters?.find(h=>h.id===a.member.id);if(a.member.errand)this.updateErrand(a,playing);else if(hunter)this.updateHunter(a,hunter,playing);else this.updateTraveler(a,playing);continue;}a.image.setRotation(0);a.clock+=elapsed;
   if(!a.path?.length&&a.clock>6){a.clock=0;const n=hash(a.member.id+Math.floor(this.elapsed/6));const home=gridPosition(a.home.x,a.home.y),p=gridPoint(home.x+((n%9)-4)*.05,home.y);a.path=[p];}
   const p=a.path?.[0];let walking=false;if(p){const dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy);walking=d>1;
    if(d<=1)a.path.shift();else{const step=Math.min(d,elapsed*22);a.x+=dx/d*step;a.y+=dy/d*step;a.direction=Math.abs(dx)>Math.abs(dy)*1.6?(dx<0?'west':'east'):(dy<0?'north':'south');}}
   // Pose from activity: stride while walking, otherwise train / work / sleep at home, or breathe and blink.
   const m=a.member,home=!a.path?.length,t=this.realTime+(hash(m.id)%97)/13;let pose;
   if(walking&&playing)pose='walk'+(Math.floor(this.elapsed*8)%4);
   else if(home&&m.task==='train'&&!m.waitingReason)pose='train'+(Math.floor(t*2.4)%2);
   else if(home&&m.task==='work')pose='work'+(Math.floor(t*2.2)%2);
   else if(home&&m.task==='rest'&&m.energy<95&&!m.waitingReason&&!m.injury)pose='sleep';
   else pose=t%4.3<.15?'blink':Math.floor(t*1.5)%2?'breath':'idle';
   const inBed=a.bed&&home&&!walking&&(pose==='sleep'||m.injury>0);if(inBed)pose='bed';else if(pose==='sleep')pose=Math.floor(t*1.2)%2?'breath':'idle';
   const facing=pose.startsWith('walk')?a.direction:pose==='idle'||pose==='breath'||pose==='blink'?a.direction:'south';
   a.image.setTexture(`actor-${m.id}-${m.class}-${facing}-${pose}`);
   if(inBed)a.image.setPosition(Math.round(a.bed.x),Math.round(a.bed.y)).setDepth(a.bed.depth+(hash(m.id)%89)/1000);
   else a.image.setPosition(Math.round(a.x),Math.round(a.y)).setDepth(Math.round(a.y)+(hash(m.id)%89)/100);
   const emote=pose==='sleep'||(pose==='bed'&&!m.injury)?'z':home&&m.injury>0?'heal':null;
   if(emote){if(!a.emote)a.emote=this.scene.add.image(0,0,this.emoteTexture(emote)).setOrigin(.5,1);if(a.emoteKind!==emote){a.emote.setTexture(this.emoteTexture(emote));a.emoteKind=emote;}
    const float=Math.sin(t*2.2)*1.5;const ex=inBed?a.bed.x+5:a.x+7,ey=inBed?a.bed.y-12:a.y-24;a.emote.setVisible(true).setPosition(Math.round(ex),Math.round(ey+float)).setDepth((inBed?a.bed.depth:Math.round(a.y))+1).setAlpha(.75+Math.sin(t*2.2)*.25);}
   else a.emote?.setVisible(false);
  }

  this.updateWorld(dt,playing);
  this.updateVillagers(dt,playing);
  this.updateLife(dt,playing);
  this.updateHero(dt);
  // Follow a watched team until the player drags the view or the team is home.
  if(this.follow){
   const m=this.follow.kind==='mission'?(this.state.missions||[]).find(m=>m.id===this.follow.id):null;
   if(this.follow.kind==='mission'&&!(m&&(m.status==='active'||m.status==='decision')))this.stopFollow();
   else{const p=this.followPoint();if(!p&&this.follow.kind==='event')this.stopFollow();else if(p){const k=1-Math.pow(.015,Math.min(dt,.1));this.focusX+=(p.x-this.focusX)*k;this.focusY+=(p.y-this.focusY)*k;}
    if(this.zoomTarget){const k=1-Math.pow(.05,Math.min(dt,.1));this.zoom+=(this.zoomTarget-this.zoom)*k;if(Math.abs(this.zoomTarget-this.zoom)<.005)this.zoom=this.zoomTarget;}
    this.applyView();const info=this.followInfo(),sig=JSON.stringify(info);if(sig!==this.followSig){this.followSig=sig;this.onFollow?.(info);}}
  }
  if(this.pending&&this.pendingDraw){const k=1-Math.pow(.0004,Math.min(dt,.1));this.pendingDraw.x+=(this.pending.x-this.pendingDraw.x)*k;this.pendingDraw.y+=(this.pending.y-this.pendingDraw.y)*k;if(Math.abs(this.pending.x-this.pendingDraw.x)+Math.abs(this.pending.y-this.pendingDraw.y)<.01)this.pendingDraw={...this.pending};this.positionGhost();}
  this.drawGhost();
 }
 applyView(){if(!this.ready)return;const b=buildingRect(this.state),span=(b.w+b.h)*24,tall=(b.w+b.h)*12+40;this.baseZoom=this.width<620?Math.min(1.7,(this.width-28)/(span+110),(this.height-180)/(tall+90)):Math.max(.45,Math.min(3,(this.width-100)/(span+320),(this.height-145)/(tall+110)));this.camera.setViewport(0,0,this.width,this.height);this.camera.setZoom(this.baseZoom*this.zoom);this.camera.centerOn(this.focusX??548,this.focusY??294);}
 center(){this.zoom=1;const b=buildingRect(this.state),p=gridPoint(b.x+b.w/2,b.y+b.h/2);this.focusX=p.x;this.focusY=p.y+22;this.userPanned=false;this.applyView();}

 resetView(){this.center();}
 setZoom(z){this.zoomTarget=null;this.zoom=Math.max(.3,Math.min(2.4,Number(z)||1));this.applyView();}
 rotatePlacement(){this.rotation=(this.rotation+1)%4;this.buildGhost();this.placementChanged();return this.rotation;}
 setBuildMode(type){this.roomMode=null;this.roomMoveId=null;this.buildType=type;this.moveId=null;this.rotation=0;this.canvas.style.cursor=type?'crosshair':'grab';this.refreshPlacement();}
 setMoveMode(id){this.roomMode=null;this.roomMoveId=null;this.moveId=id;this.buildType=null;this.rotation=this.state.facilities.find(f=>f.id===id)?.rotation||0;this.canvas.style.cursor=id?'crosshair':'grab';this.refreshPlacement();}
 setRoomMode(room,id=null){this.buildType=null;this.moveId=null;this.roomMode=room?{...room}:null;this.roomMoveId=id;this.rotation=room?.rotation||0;this.canvas.style.cursor=room?'crosshair':'grab';this.refreshPlacement();}

 // Placement session: a pending spot the player drags around, then confirms from the app's bar.
 placementMode(){return this.buildType?'b:'+this.buildType:this.moveId?'m:'+this.moveId:this.roomMode?'r:'+(this.roomMoveId||'new')+':'+this.roomMode.type+':'+this.roomMode.width+'x'+this.roomMode.height:null;}
 refreshPlacement(){
  if(!this.ready)return;const mode=this.placementMode();if(mode===this.placementKey)return;this.placementKey=mode;
  for(const a of this.furnitureSprites)a.image.setAlpha(1);
  if(!mode){this.pending=null;this.pendingDraw=null;this.ghostBox?.destroy();this.ghostBox=null;this.placementChanged();return;}
  const f=this.moveId&&this.state.facilities.find(f=>f.id===this.moveId),room=this.roomMoveId&&(this.state.rooms||[]).find(r=>r.id===this.roomMoveId);
  if(f){this.pending={x:f.x,y:f.y};for(const a of this.furnitureSprites)if(a.f.id===f.id)a.image.setAlpha(.25);}
  else if(room)this.pending={x:room.x,y:room.y};
  else this.pending=this.findOpenSpot();
  this.pendingDraw={...this.pending};this.buildGhost();this.placementChanged();
 }
 footprint(){const f=this.state.facilities.find(f=>f.id===this.moveId),type=this.buildType||f?.type;return this.roomMode?partitionSize({...this.roomMode,rotation:this.rotation}):FACILITIES[type]?getRoomSize(type,this.rotation):{w:1,h:1};}
 checkAt(x,y){const f=this.state.facilities.find(f=>f.id===this.moveId),type=this.buildType||f?.type;
  if(this.roomMode){const c={...this.roomMode,x,y,rotation:this.rotation};return this.roomMoveId?previewPartitionMove(this.state,{roomId:this.roomMoveId,x,y,rotation:this.rotation}):canPlacePartition(this.state,c);}
  return canPlaceFacility(this.state,type,x,y,this.moveId,this.rotation);}
 findOpenSpot(){const b=buildingRect(this.state),d=this.footprint(),cx=b.x+(b.w-d.w)/2,cy=b.y+(b.h-d.h)/2,spots=[];
  for(let y=b.y;y<=b.y+b.h-d.h;y+=.5)for(let x=b.x;x<=b.x+b.w-d.w;x+=.5)spots.push({x,y});
  spots.sort((a,c)=>Math.hypot(a.x-cx,a.y-cy)-Math.hypot(c.x-cx,c.y-cy));
  for(const p of spots.slice(0,160))if(this.checkAt(p.x,p.y).ok)return p;
  return{x:Math.round(cx*4)/4,y:Math.round(cy*4)/4};}
 buildGhost(){
  this.ghostBox?.destroy();this.ghostBox=null;if(!this.pending||this.roomMode)return;
  const f=this.state.facilities.find(f=>f.id===this.moveId),type=this.buildType||f?.type;if(!FACILITIES[type])return;
  const origin=gridPoint(0,0),box=this.scene.add.container(0,0).setDepth(9998);
  for(const part of makeRoom({id:'ghost',type,x:0,y:0,rotation:this.rotation,level:f?.level||1}).layers){const key=`ghost-${type}-${this.rotation}-${f?.level||1}-${part.name}`;if(!this.scene.textures.exists(key))this.texture(key,part.sprite.canvas);const p=gridPoint(part.x,part.y);box.add(this.scene.add.image(p.x-origin.x-part.sprite.footX,p.y-origin.y-part.sprite.footY,key).setOrigin(0));}
  this.ghostBox=box;this.positionGhost();}
 positionGhost(){if(!this.ghostBox||!this.pendingDraw)return;const p=gridPoint(this.pendingDraw.x,this.pendingDraw.y),lift=this.drag?.item?6:0;this.ghostBox.setPosition(p.x,p.y-lift).setAlpha(this.getPlacement().ok?.88:.5);}
 setPending(x,y){const g=this.state.grid,d=this.footprint();x=Math.max(0,Math.min(g.width-d.w,Math.round(x*4)/4));y=Math.max(0,Math.min(g.height-d.h,Math.round(y*4)/4));if(this.pending&&this.pending.x===x&&this.pending.y===y)return;this.pending={x,y};this.placementChanged();}
 getPlacement(){
  if(!this.pending)return{active:false};const {x,y}=this.pending,key=this.signature+'|'+this.placementKey+'|'+x+'|'+y+'|'+this.rotation;
  if(this.ghostCheck?.key!==key){const place=this.checkAt(x,y);this.ghostCheck={key,ok:place.ok,message:place.message||''};}
  const kind=this.roomMode?(this.roomMoveId?'moveRoom':'room'):this.buildType?'build':'move';
  return{active:true,kind,x,y,rotation:this.rotation,ok:this.ghostCheck.ok,message:this.ghostCheck.message,facilityId:this.moveId,roomId:this.roomMoveId};}
 placementChanged(){this.onPlacement?.(this.getPlacement());}
 hitPending(p){if(!this.pending)return false;const t=gridPosition(p.x,p.y),d=this.footprint(),c=gridPoint(this.pending.x+d.w/2,this.pending.y+d.h/2);
  return(t.x>=this.pending.x-.4&&t.x<=this.pending.x+d.w+.4&&t.y>=this.pending.y-.4&&t.y<=this.pending.y+d.h+.4)||(Math.abs(p.x-c.x)<30&&p.y>c.y-48&&p.y<c.y+14);}
 hitFacility(p){const tile=gridPosition(p.x,p.y);
  for(const a of [...this.furnitureSprites].sort((a,b)=>b.image.depth-a.image.depth)){const x=Math.floor(p.x-a.image.x),y=Math.floor(p.y-a.image.y);if(x>=0&&y>=0&&x<a.canvas.width&&y<a.canvas.height&&a.alpha[(y*a.canvas.width+x)*4+3]>50)return a.f.id;}
  for(const f of this.state.facilities){const d=getRoomSize(f.type,f.rotation||0);if(tile.x>=f.x&&tile.x<f.x+d.w&&tile.y>=f.y&&tile.y<f.y+d.h)return f.id;}return null;}
 grabPending(drag,p){const t=gridPosition(p.x,p.y);drag.item=true;drag.offset={x:t.x-this.pending.x,y:t.y-this.pending.y};this.canvas.style.cursor='grabbing';}
 /** Screen positions of adventurers out in the world (for tests and debugging). */
 travellerPoints(){const z=this.camera?.zoom||1;return[...this.actors.values()].filter(a=>a.away&&a.image.visible).map(a=>({id:a.member.id,x:(a.x-(this.focusX??548))*z+this.width/2,y:(a.y-12-(this.focusY??294))*z+this.height/2}));}
 worldToScreen(x,y){const p=gridPoint(x/32,y/32),z=this.camera?.zoom||1;return{x:(p.x-(this.focusX??548))*z+this.width/2,y:(p.y-(this.focusY??294))*z+this.height/2};}
 screenPoint(e){const b=this.canvas.getBoundingClientRect();return{x:(e.clientX-b.left)*this.width/b.width,y:(e.clientY-b.top)*this.height/b.height};}
 worldPoint(p){const z=this.camera.zoom;return{x:(p.x-this.width/2)/z+this.focusX,y:(p.y-this.height/2)/z+this.focusY};}
 bindInput(){
  const bind=(name,fn,options)=>this.canvas.addEventListener(name,fn,options);
  bind('pointerdown',e=>{this.stopFollow();const p=this.screenPoint(e);this.canvas.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,p);
   if(this.pointers.size===1){const drag=this.drag={id:e.pointerId,start:p,last:p,moved:false},w=this.worldPoint(p);
    if(this.pending&&this.hitPending(w))this.grabPending(drag,w);
    else if(!this.pending){const id=this.hitFacility(w);if(id)drag.hold=setTimeout(()=>{if(this.drag!==drag||drag.moved||this.pointers.size!==1)return;
     // Press and hold lifts a placed item straight into a drag.
     this.onSelect({kind:'pickup',id});this.setMoveMode(id);if(this.pending){this.grabPending(drag,this.worldPoint(drag.last));navigator.vibrate?.(12);}},380);}}
   if(this.pointers.size===2){const[a,b]=[...this.pointers.values()];this.pinch={dist:Math.hypot(a.x-b.x,a.y-b.y),zoom:this.zoom};this.drag.moved=true;this.drag.item=false;clearTimeout(this.drag.hold);}});
  bind('pointermove',e=>{const p=this.screenPoint(e);this.hover=this.worldPoint(p);if(!this.pointers.has(e.pointerId))return;this.pointers.set(e.pointerId,p);
   if(this.pointers.size===2&&this.pinch){const[a,b]=[...this.pointers.values()];this.setZoom(this.pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/this.pinch.dist);return;}
   if(this.drag?.id===e.pointerId&&this.drag.item){const d=this.drag,t=gridPosition(this.worldPoint(p).x,this.worldPoint(p).y);d.moved=true;d.last=p;this.setPending(t.x-d.offset.x,t.y-d.offset.y);return;}
   if(this.drag?.id===e.pointerId){const d=this.drag;if(Math.hypot(p.x-d.start.x,p.y-d.start.y)>6){d.moved=true;clearTimeout(d.hold);}if(d.moved){this.userPanned=true;this.clampFocus?.();this.focusX-=(p.x-d.last.x)/this.camera.zoom;this.focusY-=(p.y-d.last.y)/this.camera.zoom;this.applyView();}d.last=p;}});
  bind('pointerup',e=>{const p=this.screenPoint(e);if(this.drag?.id===e.pointerId){clearTimeout(this.drag.hold);if(this.drag.item)this.canvas.style.cursor='crosshair';else if(!this.drag.moved)this.select(this.worldPoint(p));}this.pointers.delete(e.pointerId);if(this.pointers.size<2)this.pinch=null;if(!this.pointers.size)this.drag=null;});
  bind('pointercancel',e=>{clearTimeout(this.drag?.hold);this.pointers.delete(e.pointerId);this.drag=null;this.pinch=null;});bind('pointerleave',()=>{if(!this.drag)this.hover=null;});
  bind('wheel',e=>{e.preventDefault();const p=this.screenPoint(e),before=this.worldPoint(p);this.setZoom(this.zoom*Math.exp(-e.deltaY*.001));const after=this.worldPoint(p);this.focusX+=before.x-after.x;this.focusY+=before.y-after.y;this.applyView();},{passive:false});
 }
 select(p){
  const tile=gridPosition(p.x,p.y),x=Math.round(tile.x*4)/4,y=Math.round(tile.y*4)/4;
  if(this.pending){const d=this.footprint();this.setPending(tile.x-d.w/2,tile.y-d.h/2);return;}
  if(this.villagePick){const v=this.villagePick;v.x=Math.round((tile.x-v.w/2)*4)/4;v.y=Math.round((tile.y-v.h/2)*4)/4;this.updateVillagePick();return;}
  // Small figures get a finger-sized hit area at any zoom; tapping one out in the world follows them.
  const reach=Math.max(9,20/(this.camera?.zoom||1));
  for(const a of [...this.actors.values()].sort((a,b)=>Math.hypot(p.x-a.x,p.y-a.y+12)-Math.hypot(p.x-b.x,p.y-b.y+12)))if(a.image.visible&&Math.abs(p.x-a.x)<reach&&p.y>a.y-30-reach*.6&&p.y<a.y+4+reach*.4){if(a.away&&a.missionId){this.startFollow('member',a.member.id);return;}if(!a.away){this.onSelect({kind:'member',id:a.member.id});return;}}
  for(const a of [...this.furnitureSprites].sort((a,b)=>b.image.depth-a.image.depth)){const x=Math.floor(p.x-a.image.x),y=Math.floor(p.y-a.image.y);if(x>=0&&y>=0&&x<a.canvas.width&&y<a.canvas.height&&a.alpha[(y*a.canvas.width+x)*4+3]>50){this.onSelect({kind:'facility',id:a.f.id});return;}}
  for(const f of this.state.facilities){const d=getRoomSize(f.type,f.rotation||0);if(tile.x>=f.x&&tile.x<f.x+d.w&&tile.y>=f.y&&tile.y<f.y+d.h){this.onSelect({kind:'facility',id:f.id});return;}}
  for(const room of this.state.rooms||[])if(pointInRect(partitionRect(room),tile)){this.onSelect({kind:'partition',id:room.id});return;}
 }
 drawGhost(){
  this.ghost.clear();if(!this.buildType&&!this.moveId&&!this.roomMode)return;
  const f=this.state.facilities.find(f=>f.id===this.moveId),type=this.buildType||f?.type,d=this.roomMode?partitionSize({...this.roomMode,rotation:this.rotation}):FACILITIES[type]&&getRoomSize(type,this.rotation);if(!d)return;
  const {width:w,height:h}=this.state.grid,g=this.ghost;g.lineStyle(1,0xf4e4b8,.3);
  for(let x=0;x<=w;x++){const a=gridPoint(x,0),b=gridPoint(x,h);g.lineBetween(a.x,a.y,b.x,b.y);}for(let y=0;y<=h;y++){const a=gridPoint(0,y),b=gridPoint(w,y);g.lineBetween(a.x,a.y,b.x,b.y);}
  if(!this.pending)return;const {x,y}=this.pending,polygon=gridPolygon(x,y,d.w,d.h);
  const good=this.getPlacement().ok,color=good?0x92c583:0xdb8468;g.fillStyle(color,.45);g.fillPoints(polygon,true);g.lineStyle(2,color,1);g.strokePoints(polygon,true);if(this.roomMode){const r=this.rotation,p=r===0?gridPoint(x+d.w/2,y+d.h):r===1?gridPoint(x,y+d.h/2):r===2?gridPoint(x+d.w/2,y):gridPoint(x+d.w,y+d.h/2);g.fillStyle(0xffefd0,1);g.fillCircle(p.x,p.y,4);}
 }

 getInfo(){return{engine:'Phaser',version:Phaser.VERSION,renderer:this.game?.renderer?.type===Phaser.WEBGL?'WebGL':this.game?.renderer?.type===Phaser.CANVAS?'Canvas':'starting',ready:this.ready,viewport:[this.width,this.height],zoom:this.camera?.zoom,projection:'isometric 2:1',roomCount:(this.state.rooms||[]).length,facilityCount:this.state.facilities.length,building:{...this.state.building},drawnParts:this.rooms.length,camera:{width:this.camera?.width,height:this.camera?.height,scrollX:this.camera?.scrollX,scrollY:this.camera?.scrollY,focus:[this.focusX,this.focusY]},canvas:[this.canvas.width,this.canvas.height]};}
 destroy(){clearTimeout(this.bootTimer);this.game?.destroy(false);}
}
