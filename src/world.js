import { FACILITIES } from './content.js';
import { canPlaceFacility } from './game.js';
import { makeActorTexture } from './render.js';
import { makeRoom,makeGround,makeCottage,makeOutdoor,gridPoint,gridPosition,gridPolygon,CELL_W,CELL_H,ORIGIN_X,ORIGIN_Y } from './guild-art.js';

const hash=s=>[...String(s)].reduce((a,c)=>(Math.imul(a,31)+c.charCodeAt(0))>>>0,17);
export class GuildRenderer {
 constructor(canvas,onSelect=()=>{}){
  this.canvas=canvas;this.onSelect=onSelect;this.state={facilities:[],members:[],missions:[]};
  this.zoom=1;this.actors=new Map();this.rooms=[];this.signature='';this.buildType=null;this.moveId=null;
  this.pointers=new Map();this.elapsed=0;this.ready=false;this.frozen=new URLSearchParams(location.search).has('still');
  const owner=this;
  class GuildScene extends Phaser.Scene{
   constructor(){super('guild');}
   create(){owner.scene=this;owner.setup();}
   update(_time,delta){owner.update(Math.min(.05,delta/1000));}
  }
  const box=canvas.parentElement.getBoundingClientRect();
  this.width=Math.round(box.width);this.height=Math.round(box.height);
  this.game=new Phaser.Game({type:Phaser.WEBGL,canvas,parent:canvas.parentElement,width:this.width,height:this.height,
   backgroundColor:'#9cac7d',pixelArt:true,roundPixels:true,antialias:false,transparent:false,
   scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.NO_CENTER},
   fps:{target:30},input:{activePointers:3,keyboard:false},scene:GuildScene,banner:false,
   render:{preserveDrawingBuffer:true,antialias:false,roundPixels:true}});
 }
 texture(key,canvas){const t=this.scene.textures;if(t.exists(key))t.remove(key);t.addCanvas(key,canvas).setFilter(Phaser.Textures.FilterMode.NEAREST);return key;}
 put(key,sprite,x,y,depth=y){if(!this.scene.textures.exists(key))this.texture(key,sprite.canvas);return this.scene.add.image(x-sprite.footX,y-sprite.footY,key).setOrigin(0).setDepth(depth);}
 setup(){
  this.ready=true;this.camera=this.scene.cameras.main;this.camera.roundPixels=true;
  this.width=this.game.scale.width;this.height=this.game.scale.height;
  const base=makeGround(this.state),grass=document.createElement('canvas');grass.width=64;grass.height=64;
  grass.getContext('2d').drawImage(base.canvas,1000,700,64,64,0,0,64,64);this.texture('meadow',grass);
  this.scene.add.tileSprite(-512,-512,2048,1664,'meadow').setOrigin(0).setDepth(-10000);
  this.groundImage=this.scene.add.image(0,0,this.texture('ground',base.canvas)).setOrigin(0).setDepth(-9999);
  this.decorate();this.ghost=this.scene.add.graphics().setDepth(9999);this.bindInput();
  this.game.scale.on('resize',size=>{this.width=size.width;this.height=size.height;this.applyView();});
  this.center();this.rebuild();this.syncActors();this.canvas.dataset.renderer='Phaser WebGL';
  this.canvas.dispatchEvent(new CustomEvent('guild-renderer-ready'));
 }
 decorate(){
  const {VillageNature:N}=window;
  const trees=[[-2,2,101,0],[1,-1,102,0],[5,-2,103,1],[10,-2,104,0],[17,-1,105,1],[22,3,106,0],
   [-1,8,107,0],[-2,13,108,0],[20,7,109,1],[23,13,110,0],[6,17,111,1],[18,19,112,1],[10,21,113,0],
   [1,19,114,1],[24,20,115,0],[12,-6,116,0]];
  for(const[x,y,seed,gold]of trees){const p=gridPoint(x,y);this.put('tree-'+seed,N.makeTree({seed,season:gold?'gold':'green',kind:seed%4===0?'oak':'birch'}),p.x,p.y);}
  for(const[x,y,seed]of [[-1,5,21],[20,1,36],[20,16,42],[7,18,47]]){const p=gridPoint(x,y);this.put('cottage-'+seed,makeCottage({seed}),p.x,p.y,p.y+30);}
  for(const[type,x,y]of [['well',16.5,8],['table',8,13.3],['banner',3.4,6.2],['planter',3.4,9.2],['planter',14.8,10.5],['crates',18.8,4.6],['plant',3.3,2.5]]){
   const p=gridPoint(x,y);this.put('outside-'+type+'-'+x,makeOutdoor(type),p.x,p.y,p.y+12);
  }
  for(const[x,y,seed,gold]of [[2,2,201,0],[8,-1,202,1],[18,6,203,0],[-3,9,204,0],[18,14,205,0],[2,15,206,0],[11,16,207,0],[14,20,208,1],[21,10,209,0]]){
   const p=gridPoint(x,y);this.put('bush-'+seed,N.makeBush({seed,gold:!!gold}),p.x,p.y);
  }
  for(const[x,y,seed]of [[2.1,8.5,301],[16,16,302],[22,8,303],[4,17,304]]){const p=gridPoint(x,y);this.put('rock-'+seed,N.makeRock({seed,size:20}),p.x,p.y);}
 }

 setState(state){
  this.state=state;const signature=JSON.stringify([state.grid,state.facilities.map(f=>[f.id,f.type,f.x,f.y,f.level])]);
  if(signature!==this.signature){this.signature=signature;if(this.ready)this.rebuild();}
  if(this.ready)this.syncActors();
 }
 rebuild(){
  if(!this.ready)return;for(const image of this.rooms)image.destroy();this.rooms=[];
  const terrain=makeGround(this.state);this.groundImage.setTexture(this.texture('ground',terrain.canvas));
  for(const f of this.state.facilities){const room=makeRoom(f);
   for(const part of room.layers){const p=gridPoint(f.x+part.x,f.y+part.y),key='room-'+f.id+'-'+part.name;
    this.rooms.push(this.put(this.texture(key,part.sprite.canvas),part.sprite,p.x,p.y,p.y+part.sort));
   }
  }
 }

 roomFor(m){let type=m.waitingReason?'reception':m.injury>0?'infirmary':m.energy<60||m.task==='rest'?'dorm':m.task==='train'?'training':m.task==='work'?'workshop':'reception';
  if(m.task==='rest'&&m.energy>=95&&!m.injury&&!m.waitingReason)type=['reception','kitchen','training','dorm'][hash(m.id)%4];
  return this.state.facilities.find(f=>f.type===type)||this.state.facilities[0];}

 syncActors(){
  const ids=new Set(this.state.members.map(m=>m.id));for(const [id,a] of this.actors)if(!ids.has(id)){a.image.destroy();this.actors.delete(id);}
  const away=new Set(this.state.missions.filter(m=>['active','decision'].includes(m.status)).flatMap(m=>m.memberIds));
  for(const m of this.state.members){const room=this.roomFor(m),b=room&&FACILITIES[room.type],n=hash(m.id);
   if(!b)continue;const roommates=this.state.members.filter(other=>this.roomFor(other)?.id===room.id),slot=roommates.findIndex(other=>other.id===m.id);
   const target=gridPoint(room.x+.45+(slot+.5)*(b.w-.9)/Math.max(1,roommates.length),room.y+b.h-.45-slot%2*.15);
   let a=this.actors.get(m.id);if(!a){
    for(let frame=0;frame<4;frame++)this.texture(`actor-${m.id}-${m.class}-${frame}`,makeActorTexture(m,frame*Math.PI/2,frame>0));
    a={image:this.scene.add.image(target.x,target.y,`actor-${m.id}-${m.class}-0`).setOrigin(.5,40/46),x:target.x,y:target.y,clock:n%6,roomId:room.id,class:m.class};this.actors.set(m.id,a);
   }
   if(a.class!==m.class){for(let frame=0;frame<4;frame++)this.texture(`actor-${m.id}-${m.class}-${frame}`,makeActorTexture(m,frame*Math.PI/2,frame>0));a.class=m.class;}
   if(a.roomId!==room.id){a.path=this.pathBetween(a.x,a.y,target.x,target.y);a.roomId=room.id;}
   const anchor=room.x+','+room.y;if(a.roomAnchor&&a.roomAnchor!==anchor){a.x=target.x;a.y=target.y;a.path=[];}a.roomAnchor=anchor;
   a.member=m;a.home=target;a.away=away.has(m.id);a.image.setVisible(!a.away);if(this.frozen){a.x=target.x;a.y=target.y;}
  }
 }
 pathBetween(sx,sy,tx,ty){
  const {width:w,height:h}=this.state.grid,fs=this.state.facilities;
  const at=(x,y)=>fs.find(f=>{const d=FACILITIES[f.type];return x>=f.x&&x<f.x+d.w&&y>=f.y&&y<f.y+d.h;});
  const source=gridPosition(sx,sy),target=gridPosition(tx,ty),sr=at(source.x,source.y),er=at(target.x,target.y);
  const door=f=>{const d=FACILITIES[f.type];return{x:f.x+Math.floor(d.w/2)+.5,y:f.y+d.h+.5};};
  const a=sr?door(sr):source,b=er?door(er):target,start={x:Math.floor(a.x),y:Math.floor(a.y)},end={x:Math.floor(b.x),y:Math.floor(b.y)};
  const open=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&!at(x,y);
  const q=[start],visited=new Map([[`${start.x},${start.y}`,null]]);let found=false;
  for(let i=0;i<q.length;i++){const p=q[i];if(p.x===end.x&&p.y===end.y){found=true;break;}
   for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy,key=`${x},${y}`;if(open(x,y)&&!visited.has(key)){visited.set(key,p);q.push({x,y});}}
  }
  if(!found)return[];const path=[];let p=end;while(p){path.unshift(gridPoint(p.x+.5,p.y+.5));p=visited.get(`${p.x},${p.y}`);}
  if(sr)path.unshift(gridPoint(a.x,sr.y+FACILITIES[sr.type].h-.25));
  if(er)path.push(gridPoint(b.x,er.y+FACILITIES[er.type].h-.25));path.push({x:tx,y:ty});return path;
 }

 update(dt){
  if(!this.ready)return;const playing=!this.frozen&&!document.hidden&&!this.state.settings?.paused&&!document.getElementById('confirm-dialog').open&&!document.getElementById('settings-dialog').open;
  const elapsed=playing?dt*(this.state.settings?.speed||1):0;this.elapsed+=elapsed;
  for(const a of this.actors.values()){
   if(a.away)continue;a.clock+=elapsed;
   if(!a.path?.length&&a.clock>6){a.clock=0;const n=hash(a.member.id+Math.floor(this.elapsed/6));const home=gridPosition(a.home.x,a.home.y),p=gridPoint(home.x+((n%9)-4)*.05,home.y);a.path=[p];}
   const p=a.path?.[0];let walking=false;if(p){const dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy);walking=d>1;
    if(d<=1)a.path.shift();else{const step=Math.min(d,elapsed*22);a.x+=dx/d*step;a.y+=dy/d*step;if(Math.abs(dx)>.5)a.image.setFlipX(dx<0);}}
   const frame=walking&&playing?1+Math.floor(this.elapsed*6)%3:0;a.image.setTexture(`actor-${a.member.id}-${a.member.class}-${frame}`).setPosition(Math.round(a.x),Math.round(a.y)).setDepth(a.y);
  }

  this.drawGhost();
 }
 applyView(){if(!this.ready)return;this.baseZoom=this.width<620?Math.min(1.7,(this.width-28)/465,(this.height-180)/315):Math.max(.65,Math.min(3.3,(this.width-100)/620,(this.height-145)/310));this.camera.setViewport(0,0,this.width,this.height);this.camera.setZoom(this.baseZoom*this.zoom);this.camera.centerOn(this.focusX??572,this.focusY??260);}
 center(){this.zoom=1;this.focusX=572;this.focusY=260;this.userPanned=false;this.applyView();}

 resetView(){this.center();}
 setZoom(z){this.zoom=Math.max(.6,Math.min(2.4,Number(z)||1));this.applyView();}
 setBuildMode(type){this.buildType=type;this.moveId=null;this.canvas.style.cursor=type?'crosshair':'grab';}
 setMoveMode(id){this.moveId=id;this.buildType=null;this.canvas.style.cursor=id?'crosshair':'grab';}
 worldToScreen(x,y){const p=gridPoint(x/32,y/32),z=this.camera?.zoom||1;return{x:(p.x-(this.focusX??572))*z+this.width/2,y:(p.y-(this.focusY??260))*z+this.height/2};}
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
  const tile=gridPosition(p.x,p.y),x=Math.floor(tile.x),y=Math.floor(tile.y);
  if(this.buildType){this.onSelect({kind:'build',x,y});return;}if(this.moveId){this.onSelect({kind:'move',x,y,facilityId:this.moveId});return;}
  for(const a of [...this.actors.values()].sort((a,b)=>b.y-a.y))if(!a.away&&Math.abs(p.x-a.x)<11&&p.y>a.y-32&&p.y<a.y+4){this.onSelect({kind:'member',id:a.member.id});return;}
  for(const f of this.state.facilities){const d=FACILITIES[f.type];if(tile.x>=f.x&&tile.x<f.x+d.w&&tile.y>=f.y&&tile.y<f.y+d.h){this.onSelect({kind:'facility',id:f.id});return;}}
 }
 drawGhost(){
  this.ghost.clear();if(!this.buildType&&!this.moveId)return;
  const f=this.state.facilities.find(f=>f.id===this.moveId),type=this.buildType||f?.type,d=FACILITIES[type];if(!d)return;
  const {width:w,height:h}=this.state.grid,g=this.ghost;g.lineStyle(1,0xf4e4b8,.3);
  for(let x=0;x<=w;x++){const a=gridPoint(x,0),b=gridPoint(x,h);g.lineBetween(a.x,a.y,b.x,b.y);}for(let y=0;y<=h;y++){const a=gridPoint(0,y),b=gridPoint(w,y);g.lineBetween(a.x,a.y,b.x,b.y);}
  if(!this.hover)return;const tile=gridPosition(this.hover.x,this.hover.y),x=Math.floor(tile.x),y=Math.floor(tile.y),polygon=gridPolygon(x,y,d.w,d.h);
  const good=canPlaceFacility(this.state,type,x,y,this.moveId).ok,color=good?0x92c583:0xdb8468;g.fillStyle(color,.45);g.fillPoints(polygon,true);g.lineStyle(2,color,1);g.strokePoints(polygon,true);
 }

 getInfo(){return{engine:'Phaser',version:Phaser.VERSION,renderer:this.game.renderer.type===Phaser.WEBGL?'WebGL':'unknown',ready:this.ready,viewport:[this.width,this.height],zoom:this.camera?.zoom,projection:'isometric 2:1',roomCount:this.state.facilities.length,drawnParts:this.rooms.length,camera:{width:this.camera?.width,height:this.camera?.height,scrollX:this.camera?.scrollX,scrollY:this.camera?.scrollY,focus:[this.focusX,this.focusY]},canvas:[this.canvas.width,this.canvas.height]};}
 destroy(){this.game.destroy(false);}
}
