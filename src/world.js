import { FACILITIES } from './content.js';
import { canPlaceFacility } from './game.js';
import { makeActorTexture } from './render.js';
import { makeRoom,makeGround,gridPoint,roomBounds,CELL_W,CELL_H,ORIGIN_X,ORIGIN_Y } from './guild-art.js';

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
   backgroundColor:'#929a32',pixelArt:true,roundPixels:true,antialias:false,transparent:false,
   scale:{mode:Phaser.Scale.RESIZE,autoCenter:Phaser.Scale.NO_CENTER},
   fps:{target:30},input:{activePointers:3,keyboard:false},scene:GuildScene,banner:false,
   render:{preserveDrawingBuffer:true,antialias:false,roundPixels:true}});
 }
 texture(key,canvas){const t=this.scene.textures;if(t.exists(key))t.remove(key);t.addCanvas(key,canvas).setFilter(Phaser.Textures.FilterMode.NEAREST);return key;}
 put(key,sprite,x,y,depth=y){if(!this.scene.textures.exists(key))this.texture(key,sprite.canvas);return this.scene.add.image(x-sprite.footX,y-sprite.footY,key).setOrigin(0).setDepth(depth);}
 setup(){
  this.ready=true;this.camera=this.scene.cameras.main;this.camera.roundPixels=true;
  this.width=this.game.scale.width;this.height=this.game.scale.height;
  const base=window.VillageTerrain.makeTerrain(),grass=document.createElement('canvas');grass.width=64;grass.height=64;
  grass.getContext('2d').drawImage(base.canvas,360,40,64,64,0,0,64,64);this.texture('meadow',grass);
  this.scene.add.tileSprite(-512,-512,2048,1664,'meadow').setOrigin(0).setDepth(-10000);
  this.groundImage=this.scene.add.image(0,0,this.texture('ground',base.canvas)).setOrigin(0).setDepth(-9999);
  this.decorate();this.ghost=this.scene.add.graphics().setDepth(9999);this.bindInput();
  this.game.scale.on('resize',size=>{this.width=size.width;this.height=size.height;if(!this.userPanned)this.focusY=this.height<560?260:294;this.applyView();});
  this.center();this.rebuild();this.syncActors();this.canvas.dataset.renderer='Phaser WebGL';
  this.canvas.dispatchEvent(new CustomEvent('guild-renderer-ready'));
 }
 decorate(){
  const {VillageBuildings:B,VillageNature:N,VillageProps:P,ArtCore:A}=window;
  const shadowCanvas=A.createCanvas(960,640),c=shadowCanvas.getContext('2d');
  const tree=(x,y,seed,gold,kind='birch')=>{
   const s=N.makeTree({seed,season:gold?'gold':'green',kind});
   c.save();c.globalAlpha=.4;c.translate(x-s.footX,y+3);c.transform(1,0,-.35,-.3,s.height*.35,s.height*.30);c.drawImage(s.canvas,0,0);c.globalCompositeOperation='source-in';c.restore();
   this.put('tree-'+seed,s,x,y);
  };
  const trees=[[68,144,101,1],[176,104,102,0],[307,81,103,1],[431,70,104,0],[650,107,105,1],[893,124,106,0],
   [15,319,107,1],[139,374,108,0],[893,321,109,1],[814,421,110,0],[288,527,111,1],[879,583,112,1],[453,609,113,0],
   [193,656,114,1],[706,695,115,0],[-50,548,116,0],[547,-17,117,1],[885,-20,118,0]];
  for(const [x,y,s,g] of trees)tree(x,y,s,g,s%5===0?'oak':'birch');
  // Cast shadows are silhouettes of the actual foliage, rather than oval decals.
  c.globalCompositeOperation='source-in';c.fillStyle='#576429';c.fillRect(0,0,960,640);
  this.scene.add.image(0,0,this.texture('tree-shadows',shadowCanvas)).setOrigin(0).setDepth(-9998).setAlpha(.75);
  this.put('village-left',B.makeHouse({seed:21,variant:'cottage'}),109,239);
  this.put('village-right',B.makeHouse({seed:36,variant:'cottage'}),775,251);
  this.put('village-shed',B.makeShed({seed:42}),132,498);
  const props=[['well',688,385],['table',584,503],['cart',804,484],['sign',659,430],['lamp',650,314],
   ['planter',741,270],['barrel',691,280],['crate',714,277],['woodpile',139,510],['barrel',86,511],['table',358,459]];
  for(let i=0;i<props.length;i++){const [type,x,y]=props[i];this.put('prop-'+i,P.makeProp(type,{seed:i+4}),x,y);}
  for(const [x,y,w,v] of [[794,285,151,0],[873,281,90,1],[169,275,100,0],[111,267,47,1],[730,536,190,0],[819,524,65,1]]){
   this.put(`fence-${x}-${y}`,P.makeFenceSegment({width:w,vertical:!!v,seed:x}),x,y);
  }
  for(const [x,y,s,g] of [[192,124,201,0],[335,111,202,1],[666,138,203,1],[933,190,204,0],[876,393,205,0],[259,427,206,0],[430,500,207,1],[182,591,208,1],[672,585,209,0]]){
   this.put('bush-'+s,N.makeBush({seed:s,gold:!!g}),x,y);
  }
  for(const [x,y,s] of [[211,140,301],[748,600,302],[902,437,303],[203,550,304]])this.put('rock-'+s,N.makeRock({seed:s,size:20}),x,y);
  this.water=this.scene.add.graphics().setDepth(-9997).setAlpha(.42);
 }
 setState(state){
  this.state=state;const signature=JSON.stringify([state.grid,state.facilities.map(f=>[f.id,f.type,f.x,f.y,f.level])]);
  if(signature!==this.signature){this.signature=signature;if(this.ready)this.rebuild();}
  if(this.ready)this.syncActors();
 }
 rebuild(){
  if(!this.ready)return;for(const image of this.rooms)image.destroy();this.rooms=[];
  const terrain=makeGround(this.state);this.groundImage.setTexture(this.texture('ground',terrain.canvas));
  for(const f of this.state.facilities){const p=gridPoint(f.x,f.y),s=makeRoom(f),key='room-'+f.id;
   this.rooms.push(this.put(this.texture(key,s.canvas),s,p.x,p.y,p.y-1));
  }
 }
 roomFor(m){let type=m.waitingReason?'reception':m.injury>0?'infirmary':m.energy<60||m.task==='rest'?'dorm':m.task==='train'?'training':m.task==='work'?'workshop':'reception';
  return this.state.facilities.find(f=>f.type===type)||this.state.facilities[0];}
 syncActors(){
  const ids=new Set(this.state.members.map(m=>m.id));for(const [id,a] of this.actors)if(!ids.has(id)){a.image.destroy();this.actors.delete(id);}
  const away=new Set(this.state.missions.filter(m=>['active','decision'].includes(m.status)).flatMap(m=>m.memberIds));
  for(const m of this.state.members){const room=this.roomFor(m),b=room&&roomBounds(room),n=hash(m.id);
   if(!b)continue;const roommates=this.state.members.filter(other=>this.roomFor(other)?.id===room.id),slot=roommates.findIndex(other=>other.id===m.id);
   const target={x:b.x+19+(slot+.5)*(b.w-38)/Math.max(1,roommates.length),y:b.y+b.h-12-slot%2*6};
   let a=this.actors.get(m.id);if(!a){
    for(let frame=0;frame<4;frame++)this.texture(`actor-${m.id}-${m.class}-${frame}`,makeActorTexture(m,frame*Math.PI/2,frame>0));
    a={image:this.scene.add.image(target.x,target.y,`actor-${m.id}-${m.class}-0`).setOrigin(.5,40/46),x:target.x,y:target.y,clock:n%6,roomId:room.id,class:m.class};this.actors.set(m.id,a);
   }
   if(a.class!==m.class){for(let frame=0;frame<4;frame++)this.texture(`actor-${m.id}-${m.class}-${frame}`,makeActorTexture(m,frame*Math.PI/2,frame>0));a.class=m.class;}
   if(a.roomId!==room.id){a.path=this.pathBetween(a.x,a.y,target.x,target.y);a.roomId=room.id;}
   a.member=m;a.home=target;a.away=away.has(m.id);a.image.setVisible(!a.away);if(this.frozen){a.x=target.x;a.y=target.y;}
  }
 }
 pathBetween(sx,sy,tx,ty){
  const {width:w,height:h}=this.state.grid,fs=this.state.facilities;
  const at=(x,y)=>fs.find(f=>{const d=FACILITIES[f.type];return x>=f.x&&x<f.x+d.w&&y>=f.y&&y<f.y+d.h;});
  const tile=(x,y)=>({x:Math.floor((x-ORIGIN_X)/CELL_W),y:Math.floor((y-ORIGIN_Y)/CELL_H)});
  const start=tile(sx,sy),end=tile(tx,ty),sr=at(start.x,start.y),er=at(end.x,end.y);
  const open=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&(!at(x,y)||[sr?.id,er?.id].includes(at(x,y)?.id));
  const q=[start],visited=new Map([[`${start.x},${start.y}`,null]]);let found=false;
  for(let i=0;i<q.length;i++){const p=q[i];if(p.x===end.x&&p.y===end.y){found=true;break;}
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=p.x+dx,y=p.y+dy,key=`${x},${y}`;if(open(x,y)&&!visited.has(key)){visited.set(key,p);q.push({x,y});}}
  }
  if(!found)return[{x:tx,y:ty}];const path=[];let p=end;while(p){const v=gridPoint(p.x+.5,p.y+.65);path.unshift(v);p=visited.get(`${p.x},${p.y}`);}path.push({x:tx,y:ty});return path;
 }
 update(dt){
  if(!this.ready)return;const playing=!this.frozen&&!document.hidden&&!this.state.settings?.paused&&!document.getElementById('confirm-dialog').open&&!document.getElementById('settings-dialog').open;
  const elapsed=playing?dt*(this.state.settings?.speed||1):0;this.elapsed+=elapsed;
  for(const a of this.actors.values()){
   if(a.away)continue;a.clock+=elapsed;
   if(!a.path?.length&&a.clock>6){a.clock=0;const n=hash(a.member.id+Math.floor(this.elapsed/6));a.path=[{x:a.home.x+((n%17)-8),y:a.home.y}];}
   const p=a.path?.[0];let walking=false;if(p){const dx=p.x-a.x,dy=p.y-a.y,d=Math.hypot(dx,dy);walking=d>1;
    if(d<=1)a.path.shift();else{const step=Math.min(d,elapsed*22);a.x+=dx/d*step;a.y+=dy/d*step;if(Math.abs(dx)>.5)a.image.setFlipX(dx<0);}}
   const frame=walking&&playing?1+Math.floor(this.elapsed*6)%3:0;a.image.setTexture(`actor-${a.member.id}-${a.member.class}-${frame}`).setPosition(Math.round(a.x),Math.round(a.y)).setDepth(a.y);
  }
  if(Math.floor(this.elapsed*3)!==this.waterFrame){this.waterFrame=Math.floor(this.elapsed*3);this.water.clear();this.water.fillStyle(0xb6d4bc);
   for(let i=0;i<20;i++){const x=12+i%4*28+Math.sin(this.elapsed*.2+i)*3,y=410+Math.floor(i/4)*38;if(x<40+(y-410)*.4)this.water.fillRect(Math.round(x),y,5+i%3*3,1);}}
  this.drawGhost();
 }
 applyView(){if(!this.ready)return;this.baseZoom=this.width<620?Math.min(1.5,(this.width-20)/360):Math.max(.9,Math.min(3.5,this.width/575,(this.height-160)/200));this.camera.setViewport(0,0,this.width,this.height);this.camera.setZoom(this.baseZoom*this.zoom);this.camera.centerOn(this.focusX??438,this.focusY??294);}
 center(){this.zoom=1;this.focusX=438;this.focusY=this.height<560?260:294;this.userPanned=false;this.applyView();}
 resetView(){this.center();}
 setZoom(z){this.zoom=Math.max(.6,Math.min(2.4,Number(z)||1));this.applyView();}
 setBuildMode(type){this.buildType=type;this.moveId=null;this.canvas.style.cursor=type?'crosshair':'grab';}
 setMoveMode(id){this.moveId=id;this.buildType=null;this.canvas.style.cursor=id?'crosshair':'grab';}
 worldToScreen(x,y){const p=gridPoint(x/32,y/32),z=this.camera?.zoom||1;return{x:(p.x-(this.focusX??438))*z+this.width/2,y:(p.y-(this.focusY??294))*z+this.height/2};}
 screenPoint(e){const b=this.canvas.getBoundingClientRect();return{x:(e.clientX-b.left)*this.width/b.width,y:(e.clientY-b.top)*this.height/b.height};}
 worldPoint(p){return this.camera.getWorldPoint(p.x,p.y);}
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
  const x=Math.floor((p.x-ORIGIN_X)/CELL_W),y=Math.floor((p.y-ORIGIN_Y)/CELL_H);
  if(this.buildType){this.onSelect({kind:'build',x,y});return;}if(this.moveId){this.onSelect({kind:'move',x,y,facilityId:this.moveId});return;}
  for(const a of [...this.actors.values()].sort((a,b)=>b.y-a.y))if(!a.away&&Math.abs(p.x-a.x)<11&&p.y>a.y-32&&p.y<a.y+4){this.onSelect({kind:'member',id:a.member.id});return;}
  for(const f of this.state.facilities){const b=roomBounds(f);if(p.x>=b.x&&p.x<b.x+b.w&&p.y>=b.y-18&&p.y<b.y+b.h+6){this.onSelect({kind:'facility',id:f.id});return;}}
 }
 drawGhost(){
  this.ghost.clear();if(!this.buildType&&!this.moveId)return;
  const f=this.state.facilities.find(f=>f.id===this.moveId),type=this.buildType||f?.type,d=FACILITIES[type];if(!d)return;
  const {width:w,height:h}=this.state.grid,g=this.ghost;g.lineStyle(1,0xf4e4b8,.3);
  for(let x=0;x<=w;x++){const p=gridPoint(x,0);g.lineBetween(p.x,p.y,p.x,p.y+h*CELL_H);}for(let y=0;y<=h;y++){const p=gridPoint(0,y);g.lineBetween(p.x,p.y,p.x+w*CELL_W,p.y);}
  if(!this.hover)return;const x=Math.floor((this.hover.x-ORIGIN_X)/CELL_W),y=Math.floor((this.hover.y-ORIGIN_Y)/CELL_H),p=gridPoint(x,y);
  const good=canPlaceFacility(this.state,type,x,y,this.moveId).ok,color=good?0x92c583:0xdb8468;g.fillStyle(color,.45);g.fillRect(p.x,p.y,d.w*CELL_W,d.h*CELL_H);g.lineStyle(2,color,1);g.strokeRect(p.x,p.y,d.w*CELL_W,d.h*CELL_H);
 }
 getInfo(){return{engine:'Phaser',version:Phaser.VERSION,renderer:this.game.renderer.type===Phaser.WEBGL?'WebGL':'unknown',ready:this.ready,viewport:[this.width,this.height],zoom:this.camera?.zoom,roomCount:this.rooms.length,camera:{width:this.camera?.width,height:this.camera?.height,scrollX:this.camera?.scrollX,scrollY:this.camera?.scrollY,focus:[this.focusX,this.focusY]},canvas:[this.canvas.width,this.canvas.height]};}
 destroy(){this.game.destroy(false);}
}
