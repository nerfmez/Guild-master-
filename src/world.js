import { SITE_COTTAGES,SITE_TREES,SITE_BUSHES,siteDecorations,buildingRect,partitionSize,partitionRect,pointInRect } from './site.js';
import { FACILITIES } from './content.js';
import { getRoomSize,getFacilityEntry,findWalkPath,getWalkableSpots,canPlaceFacility,canPlacePartition,previewPartitionMove } from './game.js';
import { makeActorTexture } from './render.js';
import { QUESTS } from './content.js';
import { WORLD,QUEST_SITES,VILLAGE_HOMES,SIGNPOSTS,FIELDS,DOCK,LAKE,MEADOW_SCENE,WILD_SCENE,FOOTBRIDGE,questRoute,regionOpen,biomeAt,makeGroundPainter,scatterMeadow,scatterNature,mistTint,makeFoeSprite,makeBridge,makeFog } from './overworld.js';
import { makeGreatOak,makeCrystalCave,makeBellTower,makeHeartTree,makeMistGate,makeStoneLantern,makeLostCamp,makeCampfire,makeBreadWagon,makeWatchPost,makeTeaBush,makeTeaBasket,makeSignpost,makeBarricade } from './landmarks.js';
import { makeFieldFence,makeWheat,makeVegPatch,makeScarecrow,makeHayBale,makeWindmill,makeSails,makeReeds,makeLily,makeDock,makeDuck,makeSheep,makeTallGrass,makeDryGrass,makeFlowerPatch,makeMushrooms,makeStump,makeButterfly,makePine,makeWillow,makeFruitTree,makeDeadTree,makeFern,makeFallenLog,makeBerryBush,makeGlowShrooms,makeStandingStone,makeBoulders,makeRuinWall,makePillar,makeBeehive,makeTent,makeChoppingStump,makeDeer,makeGoat,makeFirefly } from './worldart.js';
import { makeBuilding,makePartition,makeRoom,makeGround,makeCottage,makeHome,HOME_STYLES,makeOutdoor,gridPoint,gridPosition,gridPolygon,CELL_W,CELL_H,ORIGIN_X,ORIGIN_Y } from './guild-art.js';

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
  if(this.repairs.length>=3){window.guildBoot?.show('ฉากกิลด์ไม่แสดงภาพ · R28',null,()=>this.recoverCanvas(undefined,true));return;}
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
  this.canvas=canvas;this.ready=false;this.scene=null;this.camera=null;this.actors=new Map();this.rooms=[];this.furnitureSprites=[];this.siteProps=[];this.idleKey=null;this.placementKey=null;this.ghostBox=null;this.pointers.clear();this.drag=null;this.pinch=null;
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
  this.scene.add.tileSprite(-1700,-1200,5400,3000,'meadow').setOrigin(0).setDepth(-10000);
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
 addHome(style,seed,x,y){
  const st=HOME_STYLES[style],key='home-'+style,p=gridPoint(x,y),c=gridPoint(x+st.w/2,y+st.h/2);let s=this.homeSprites?.get(key);
  if(!s||!this.scene.textures.exists(key)){s=makeHome(style,seed);(this.homeSprites??=new Map()).set(key,s);this.texture(key,s.canvas);}
  if(s.smoke)(this.chimneys??=[]).push({x:p.x+s.smoke.x,y:p.y+s.smoke.y,dark:s.smoke.dark,clock:Math.random()});
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
   if(!job){let bd=Infinity;for(const c of this.groundChunks){if(c.image||c.left>v.right+m||c.left+c.size<v.x-m||c.top>v.bottom+m||c.top+c.size<v.y-m)continue;const d=(c.left+c.size/2-v.centerX)**2+(c.top+c.size/2-v.centerY)**2;if(d<bd){bd=d;job=c;}}
    if(!job)return;this.groundJob=job;job.painter=makeGroundPainter(job.left,job.top,job.size,2);}
   if(job.painter.step(6)){const key=`ground-chunk-${job.left}-${job.top}`;this.texture(key,job.painter.canvas);job.image=this.scene.add.image(job.left,job.top,key).setOrigin(0).setScale(2).setDepth(-9999.5);job.painter=null;this.groundJob=null;}
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
  const blooms=[];
  for(const item of scatterMeadow()){const v=Math.floor(Math.abs(item.x*7+item.y*13))%2,y=at(item.x,item.y);
   if(item.kind==='flowers'){place(`fp-${item.theme}-${v}`,()=>makeFlowerPatch(item.theme,v),item.x,item.y,y-4);blooms.push(item);}
   else if(item.kind==='tallgrass')place('tg-'+item.seed,()=>makeTallGrass(item.seed),item.x,item.y);
   else if(item.kind==='bush')place('mb-'+item.seed,()=>N.makeBush({seed:item.seed}),item.x,item.y);
   else if(item.kind==='rock')place('mr-'+item.seed,()=>N.makeRock({seed:item.seed,size:'small'}),item.x,item.y);
   else if(item.kind==='reeds')place('reeds-'+item.seed,()=>makeReeds(item.seed),item.x,item.y);
   else if(item.kind==='lily')place('lily-'+item.seed,()=>makeLily(item.seed),item.x,item.y,y-60);}
  // The rest of the world: woods with glades, misty trees, rocky hills.
  const fireflySpots=[];
  for(const item of scatterNature()){const m=item.mist||0,k=item.kind,y=at(item.x,item.y),tint=(key,make)=>place(`${key}-${m}`,()=>mistTint(make(),m),item.x,item.y);
   if(k==='tree')tint(`wt-${item.seed}-${item.gold?1:0}`,()=>N.makeTree({seed:item.seed,season:item.gold?'gold':'green',kind:item.seed%2?'oak':'birch'}));
   else if(k==='pine')tint(`wp-${item.seed}-${item.tone}`,()=>makePine(item.seed,item.tone));
   else if(k==='dead')tint('wdt-'+item.seed,()=>makeDeadTree(item.seed));
   else if(k==='willow')place('ww-'+item.seed,()=>makeWillow(item.seed),item.x,item.y);
   else if(k==='fruit')place('wfr-'+item.seed,()=>makeFruitTree(item.seed),item.x,item.y);
   else if(k==='hive')place('whive',makeBeehive,item.x,item.y);
   else if(k==='fern')tint('wfe-'+item.seed,()=>makeFern(item.seed));
   else if(k==='log')tint('wlog-'+item.seed%2,()=>makeFallenLog(item.seed));
   else if(k==='berry')place('wbe-'+item.seed,()=>makeBerryBush(item.seed),item.x,item.y);
   else if(k==='shroom'){place('wgs-'+item.seed,()=>makeGlowShrooms(item.seed),item.x,item.y);fireflySpots.push(item);}
   else if(k==='stone')place(`wst-${item.seed%4}-${item.rune?1:0}`,()=>makeStandingStone(item.seed%4,item.rune),item.x,item.y);
   else if(k==='boulders')place('wbo-'+item.seed%4,()=>makeBoulders(item.seed%4),item.x,item.y);
   else if(k==='wall')place('wwall-'+item.seed,()=>makeRuinWall(item.seed,item.len),item.x,item.y);
   else if(k==='pillar')place('wpil-'+item.seed,()=>makePillar(item.seed),item.x,item.y);
   else if(k==='tent')place('wtent',makeTent,item.x,item.y);
   else if(k==='woodpile')place('wpile',()=>V.makeProp('woodpile',{seed:3}),item.x,item.y);
   else if(k==='chop')place('wchop',makeChoppingStump,item.x,item.y);
   else if(k==='rock')place(`wr-${item.seed}`,()=>N.makeRock({seed:item.seed,size:item.seed%2?'large':'small'}),item.x,item.y);
   else if(k==='bush')place('wb-'+item.seed,()=>N.makeBush({seed:item.seed}),item.x,item.y);
   else if(k==='flowers'){tint(`wfl-${item.theme}-${item.seed}`,()=>makeFlowerPatch(item.theme,item.seed));if(!m&&item.seed===0)blooms.push(item);}
   else if(k==='mushroom')tint('wm-'+item.seed,()=>makeMushrooms(item.seed));
   else if(k==='stump')tint('ws-'+item.seed,()=>makeStump(item.seed));
   else if(k==='drygrass')place('wd-'+item.seed,()=>makeDryGrass(item.seed),item.x,item.y);
   else if(k==='reeds')place('reeds-'+item.seed,()=>makeReeds(item.seed),item.x,item.y);
   else tint('wg-'+item.seed,()=>makeTallGrass(item.seed));
  }
  this.chimneys=[];this.puffs=[];
  for(const [x,y,seed,style] of VILLAGE_HOMES)this.worldProps.push(this.addHome(style,seed,x,y));
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
  // Foes roam near their homes: slimes out past the farm, golems on the hills, guardians in the woods.
  this.foes=[];this.worldSigns=[];this.signRank=null;this.parties=new Map();
  const homes={meadow:[[-46,34],[-50,20],[-38,40],[-16,35],[-52,28]],ruins:[[56,6],[60,14],[66,4],[52,22],[64,-8]],mist:[[-4,-34],[6,-44],[-8,-54],[8,-50],[-2,-60]]};
  for(const [region,list] of Object.entries(homes)){const quest=QUESTS.find(q=>q.region===region&&!q.story)||QUESTS.find(q=>q.region===region);for(const [x,y] of list)this.foes.push({region,quest,hx:x,hy:y,x,y,tx:x,ty:y,wait:Math.random()*3,image:this.scene.add.image(0,0,this.foeTexture(quest,.42)).setOrigin(.5,1)});}
  // Nothing outside the view is drawn until the first cull pass decides what is near.
  for(const img of this.worldProps)img.setVisible(false);for(const f of this.foes)f.image.setVisible(false);
 }
 updateCritters(dt,t,playing){
  const P=MEADOW_SCENE.pasture;
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
 foeTexture(quest,scale,flash=false){const key=`foe-${quest.id}-${scale}-${flash?1:0}`;if(!this.scene.textures.exists(key)){const s=makeFoeSprite(quest,scale,flash);this.texture(key,s.canvas);}return key;}
 refreshWorldSigns(){
  const key=this.state.rank;if(this.signRank===key||!this.scene)return;this.signRank=key;for(const s of this.worldSigns||[])s.destroy();this.worldSigns=[];
  for(const sign of SIGNPOSTS)if(!regionOpen(this.state,sign.region)){const rank={meadow:'F',ruins:'D',mist:'B'}[sign.region],p=gridPoint(sign.x+1.2,sign.y-1.6);
   if(!this.scene.textures.exists('barrier'))this.texture('barrier',makeBarricade().canvas);const b=makeBarricade();this.worldSigns.push(this.scene.add.image(p.x-b.footX,p.y-b.footY,'barrier').setOrigin(0).setDepth(p.y));
   const lock=makeSignpost(`ต้องเป็นกิลด์ ${rank}`,true,sign.flip),q=gridPoint(sign.x+2.4,sign.y-2.6);this.texture('lock-'+sign.region+rank,lock.canvas);this.worldSigns.push(this.scene.add.image(q.x-lock.footX,q.y-lock.footY,'lock-'+sign.region+rank).setOrigin(0).setDepth(q.y));}
 }
 updateWorld(dt,playing){
  if(!this.foes)return;this.refreshWorldSigns();const t=this.realTime||0;this.updateGround();this.updateCritters(dt,t,playing);
  for(const f of this.foes){
   if(playing){f.wait-=dt;if(f.wait<=0){f.tx=f.hx+(Math.random()-.5)*7;f.ty=f.hy+(Math.random()-.5)*7;f.wait=3+Math.random()*4;}
    const dx=f.tx-f.x,dy=f.ty-f.y,d=Math.hypot(dx,dy);if(d>.05){f.x+=dx/d*Math.min(d,dt*.8);f.y+=dy/d*Math.min(d,dt*.8);}}
   const p=gridPoint(f.x,f.y);f.image.setPosition(Math.round(p.x),Math.round(p.y+Math.sin(t*3+f.x)*1.5)).setDepth(p.y).setFlipX(f.tx<f.x);
  }
  for(const fog of this.fogs||[])fog.image.setPosition(fog.x+Math.sin(t*.12+fog.phase)*40,fog.y+Math.cos(t*.09+fog.phase)*10).setAlpha(.4+Math.sin(t*.3+fog.phase)*.15);
  for(const a of this.animated||[])if(a.image.visible)a.image.setTexture(`${a.key}-${Math.floor(t*a.fps+a.phase)%a.frames}`);
  // Only draw world props near the view.
  this.cullClock=(this.cullClock||0)-dt;if(this.cullClock<=0&&this.camera){this.cullClock=.25;const v=this.camera.worldView,m=220;for(const c of this.groundChunks||[])c.image?.setVisible(c.left<v.right+m&&c.left+c.size>v.x-m&&c.top<v.bottom+m&&c.top+c.size>v.y-m);for(const img of this.worldProps||[])img.setVisible(img.x+img.width>v.x-m&&img.x<v.right+m&&img.y+img.height>v.y-m&&img.y<v.bottom+m);for(const f of this.foes)f.image.setVisible(f.image.x>v.x-m&&f.image.x<v.right+m&&f.image.y>v.y-m&&f.image.y<v.bottom+m+60);}
  // Mission foes, strike effects and the floating quest tag for each travelling team.
  const live=new Set();
  for(const m of this.state.missions||[]){if(m.status!=='active'&&m.status!=='decision')continue;const quest=QUESTS.find(q=>q.id===m.questId);if(!quest)continue;live.add(m.id);
   let party=this.parties.get(m.id);if(!party){party={strike:m.combat?.lastStrike||0,strikeAt:-9,wave:-1};this.parties.set(m.id,party);}
   if(party.strike!==(m.combat?.lastStrike||0)){party.strike=m.combat?.lastStrike||0;party.strikeAt=t;}
   const ratio=Math.max(0,Math.min(1,m.progress/(m.duration||1))),phase=ratio<.18?'go':ratio<.88?'fight':'back',wave=phase==='fight'?Math.min(2,Math.floor((ratio-.18)/.7*3)):-1,site=QUEST_SITES[quest.id];
   if(wave!==party.wave){if(party.wave>=0&&site)this.dustPuff(site.x+.6,site.y-.3,.8,.8);party.wave=wave;}
   if(phase==='fight'&&site){const age=t-party.strikeAt,hit=age>.28&&age<.42,p=gridPoint(site.x+.9,site.y),scale=wave===2?.62:.42;
    if(!party.foe)party.foe=this.scene.add.image(0,0,this.foeTexture(quest,scale)).setOrigin(.5,1);
    party.foe.setTexture(this.foeTexture(quest,scale,hit)).setVisible(true).setPosition(Math.round(p.x),Math.round(p.y+Math.sin(t*3)*1.5)).setDepth(p.y).setFlipX(true);
    const dmg=m.combat?.log?.[0]?.damage;if(age>=0&&age<.9&&Number.isFinite(dmg)){if(!party.num)party.num=this.scene.add.text(0,0,'',{fontFamily:'sans-serif',fontSize:'10px',fontStyle:'bold',color:'#fff1c4',stroke:'#4f4540',strokeThickness:3}).setOrigin(.5).setResolution(2);party.num.setText(String(dmg)).setVisible(age>.28).setPosition(p.x,p.y-34-age*16).setDepth(p.y+100).setAlpha(Math.max(0,1-age/.9));}else party.num?.setVisible(false);}
   else{party.foe?.setVisible(false);party.num?.setVisible(false);}
   party.ratio=ratio;party.phase=phase;
  }
  for(const [id,party] of this.parties)if(!live.has(id)){party.foe?.destroy();party.num?.destroy();party.tag?.destroy();this.parties.delete(id);}
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
   const pending=m.event&&!m.event.resolved,text=`${pending?'! ':''}${quest.name} ${Math.round(ratio*100)}%`;if(party.tag.text!==text)party.tag.setText(text);party.tag.setBackgroundColor(pending?'#fff1c4':'#f8edd3').setPosition(Math.round(p.x),Math.round(p.y-27)).setDepth(p.y+200).setVisible(true);}
 }
 clampFocus(){const a=gridPoint(WORLD.x0,WORLD.y1),b=gridPoint(WORLD.x1,WORLD.y0),c=gridPoint(WORLD.x0,WORLD.y0),d=gridPoint(WORLD.x1,WORLD.y1);this.focusX=Math.max(a.x+300,Math.min(b.x-300,this.focusX));this.focusY=Math.max(c.y+200,Math.min(d.y-200,this.focusY));}
 focusGrid(x,y,zoom){const p=gridPoint(x,y);this.focusX=p.x;this.focusY=p.y;this.userPanned=true;if(zoom)this.zoom=zoom;this.applyView();}
 focusMission(id){this.followMission=id;const a=[...this.actors.values()].find(a=>a.missionId===id&&a.image.visible)||[...this.actors.values()].find(a=>a.missionId===id);const m=(this.state.missions||[]).find(m=>m.id===id),quest=m&&QUESTS.find(q=>q.id===m.questId),site=quest&&QUEST_SITES[quest.id];
  const p=a?.image.visible?{x:a.x,y:a.y}:site?gridPoint(site.x,site.y):null;if(!p)return;this.focusX=p.x;this.focusY=p.y;this.userPanned=true;this.applyView();}
 roomFor(m){let type=m.waitingReason?'reception':m.injury>0?'infirmary':m.energy<60||m.task==='rest'?'dorm':m.task==='train'?'training':m.task==='work'?'workshop':'reception';
  if(m.task==='rest'&&m.energy>=95&&!m.injury&&!m.waitingReason)type=['reception','kitchen','training','dorm'][hash(m.id)%4];
  return this.state.facilities.find(f=>f.type===type)||this.state.facilities[0];}

 syncActors(){
  const ids=new Set([...this.state.members.map(m=>m.id),'master']);for(const [id,a] of this.actors)if(!ids.has(id)){a.image.destroy();a.emote?.destroy();this.actors.delete(id);}
  const idleKey=this.signature+'|'+this.state.members.map(m=>m.id).join(',');if(this.idleKey!==idleKey){this.idleKey=idleKey;const hall=buildingRect(this.state),spots=getWalkableSpots(this.state),claimed=[];this.idleSpots=this.state.members.map((m,i)=>{const desired=[{x:2.5,y:2.5},{x:4.25,y:2},{x:5,y:3.5},{x:1.75,y:2.75}][i%4],tx=hall.x+desired.x,ty=hall.y+desired.y+(Math.floor(i/4)*.6);const p=spots.filter(p=>claimed.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=.8)).sort((a,b)=>(a.x-tx)**2+(a.y-ty)**2-((b.x-tx)**2+(b.y-ty)**2))[0]||spots[i%spots.length];claimed.push(p);return p;});}
  const away=new Set(this.state.missions.filter(m=>['active','decision'].includes(m.status)).flatMap(m=>m.memberIds));
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
 // Up to two people share a bed's pillow: sleepers in the dorm, patients in the infirmary.
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
   if(a.away){a.emote?.setVisible(false);this.updateTraveler(a,playing);continue;}a.clock+=elapsed;
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
   const inBed=a.bed&&home&&!walking&&(pose==='sleep'||m.injury>0);if(inBed)pose='bed';
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
  // Follow a watched team until the player drags the view or the team is home.
  if(this.followMission){const a=[...this.actors.values()].find(a=>a.missionId===this.followMission&&a.away&&a.image.visible);const live=(this.state.missions||[]).some(m=>m.id===this.followMission&&(m.status==='active'||m.status==='decision'));if(!live)this.followMission=null;else if(a){const k=1-Math.pow(.02,Math.min(dt,.1));this.focusX+=(a.x-this.focusX)*k;this.focusY+=(a.y-this.focusY)*k;this.applyView();}}
  if(this.pending&&this.pendingDraw){const k=1-Math.pow(.0004,Math.min(dt,.1));this.pendingDraw.x+=(this.pending.x-this.pendingDraw.x)*k;this.pendingDraw.y+=(this.pending.y-this.pendingDraw.y)*k;if(Math.abs(this.pending.x-this.pendingDraw.x)+Math.abs(this.pending.y-this.pendingDraw.y)<.01)this.pendingDraw={...this.pending};this.positionGhost();}
  this.drawGhost();
 }
 applyView(){if(!this.ready)return;const b=buildingRect(this.state),span=(b.w+b.h)*24,tall=(b.w+b.h)*12+40;this.baseZoom=this.width<620?Math.min(1.7,(this.width-28)/(span+110),(this.height-180)/(tall+90)):Math.max(.45,Math.min(3,(this.width-100)/(span+320),(this.height-145)/(tall+110)));this.camera.setViewport(0,0,this.width,this.height);this.camera.setZoom(this.baseZoom*this.zoom);this.camera.centerOn(this.focusX??548,this.focusY??294);}
 center(){this.zoom=1;const b=buildingRect(this.state),p=gridPoint(b.x+b.w/2,b.y+b.h/2);this.focusX=p.x;this.focusY=p.y+22;this.userPanned=false;this.applyView();}

 resetView(){this.center();}
 setZoom(z){this.zoom=Math.max(.3,Math.min(2.4,Number(z)||1));this.applyView();}
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
 worldToScreen(x,y){const p=gridPoint(x/32,y/32),z=this.camera?.zoom||1;return{x:(p.x-(this.focusX??548))*z+this.width/2,y:(p.y-(this.focusY??294))*z+this.height/2};}
 screenPoint(e){const b=this.canvas.getBoundingClientRect();return{x:(e.clientX-b.left)*this.width/b.width,y:(e.clientY-b.top)*this.height/b.height};}
 worldPoint(p){const z=this.camera.zoom;return{x:(p.x-this.width/2)/z+this.focusX,y:(p.y-this.height/2)/z+this.focusY};}
 bindInput(){
  const bind=(name,fn,options)=>this.canvas.addEventListener(name,fn,options);
  bind('pointerdown',e=>{const p=this.screenPoint(e);this.canvas.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,p);
   if(this.pointers.size===1){const drag=this.drag={id:e.pointerId,start:p,last:p,moved:false},w=this.worldPoint(p);
    if(this.pending&&this.hitPending(w))this.grabPending(drag,w);
    else if(!this.pending){const id=this.hitFacility(w);if(id)drag.hold=setTimeout(()=>{if(this.drag!==drag||drag.moved||this.pointers.size!==1)return;
     // Press and hold lifts a placed item straight into a drag.
     this.onSelect({kind:'pickup',id});this.setMoveMode(id);if(this.pending){this.grabPending(drag,this.worldPoint(drag.last));navigator.vibrate?.(12);}},380);}}
   if(this.pointers.size===2){const[a,b]=[...this.pointers.values()];this.pinch={dist:Math.hypot(a.x-b.x,a.y-b.y),zoom:this.zoom};this.drag.moved=true;this.drag.item=false;clearTimeout(this.drag.hold);}});
  bind('pointermove',e=>{const p=this.screenPoint(e);this.hover=this.worldPoint(p);if(!this.pointers.has(e.pointerId))return;this.pointers.set(e.pointerId,p);
   if(this.pointers.size===2&&this.pinch){const[a,b]=[...this.pointers.values()];this.setZoom(this.pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/this.pinch.dist);return;}
   if(this.drag?.id===e.pointerId&&this.drag.item){const d=this.drag,t=gridPosition(this.worldPoint(p).x,this.worldPoint(p).y);d.moved=true;d.last=p;this.setPending(t.x-d.offset.x,t.y-d.offset.y);return;}
   if(this.drag?.id===e.pointerId){const d=this.drag;if(Math.hypot(p.x-d.start.x,p.y-d.start.y)>6){d.moved=true;clearTimeout(d.hold);}if(d.moved){this.userPanned=true;this.followMission=null;this.clampFocus?.();this.focusX-=(p.x-d.last.x)/this.camera.zoom;this.focusY-=(p.y-d.last.y)/this.camera.zoom;this.applyView();}d.last=p;}});
  bind('pointerup',e=>{const p=this.screenPoint(e);if(this.drag?.id===e.pointerId){clearTimeout(this.drag.hold);if(this.drag.item)this.canvas.style.cursor='crosshair';else if(!this.drag.moved)this.select(this.worldPoint(p));}this.pointers.delete(e.pointerId);if(this.pointers.size<2)this.pinch=null;if(!this.pointers.size)this.drag=null;});
  bind('pointercancel',e=>{clearTimeout(this.drag?.hold);this.pointers.delete(e.pointerId);this.drag=null;this.pinch=null;});bind('pointerleave',()=>{if(!this.drag)this.hover=null;});
  bind('wheel',e=>{e.preventDefault();const p=this.screenPoint(e),before=this.worldPoint(p);this.setZoom(this.zoom*Math.exp(-e.deltaY*.001));const after=this.worldPoint(p);this.focusX+=before.x-after.x;this.focusY+=before.y-after.y;this.applyView();},{passive:false});
 }
 select(p){
  const tile=gridPosition(p.x,p.y),x=Math.round(tile.x*4)/4,y=Math.round(tile.y*4)/4;
  if(this.pending){const d=this.footprint();this.setPending(tile.x-d.w/2,tile.y-d.h/2);return;}
  for(const a of [...this.actors.values()].sort((a,b)=>b.y-a.y))if(a.image.visible&&Math.abs(p.x-a.x)<9&&p.y>a.y-30&&p.y<a.y+4){if(a.away&&a.missionId){this.onSelect({kind:'mission',id:a.missionId});return;}if(!a.away){this.onSelect({kind:'member',id:a.member.id});return;}}
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
