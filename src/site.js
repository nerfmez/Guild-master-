// Shared physical layout: placement, navigation and artwork read the same geometry.
export const START_BUILDING={x:5,y:4,width:8,height:6,level:0};
export const SITE_COTTAGES=[{x:-3.5,y:8,w:2.6,h:2.5,seed:21,style:'inn'},{x:23,y:13,w:2.6,h:2.5,seed:36,style:'bakery'}];
export const SITE_TREES=[[-4.5,2.8,101,0],[-3,6,102,0],[1,-2,103,1],[8,-3,104,0],[17,-2,105,1],[23,1,106,0],[-4,14,107,0],[25,8,109,0],[28,20,110,0],[-4.6,25,111,1],[18,23,112,1],[11.6,25.6,113,0],[28.5,24.5,114,1]];
export const SITE_BUSHES=[[-3,1,201,0],[19,-1,202,1],[23,5,203,0],[-3,20,204,0],[27,14,205,0],[20,22,206,0]];
export function intersects(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
export function buildingRect(state){const b=state.building||START_BUILDING;return{x:b.x,y:b.y,w:b.width,h:b.height};}
export function siteRoads(state){const b=buildingRect(state),door=b.x+b.w/2;return[
 {x:-12,y:16.75,w:54,h:1.5,kind:'stone'},
 {x:1.25,y:-12,w:1.5,h:30.25,kind:'earth'},
 {x:door-.6,y:b.y+b.h,w:1.2,h:17.5-(b.y+b.h),kind:'stone'},
 ...SITE_COTTAGES.map(c=>({x:c.x+c.w/2-.45,y:c.y+c.h,w:.9,h:17.5-c.y-c.h,kind:'earth'})),
];}
export function siteDecorations(state){const b=buildingRect(state),door=b.x+b.w/2;return[{type:'banner',x:door-1.3,y:b.y+b.h+.35,w:.45,h:.45},{type:'planter',x:door+.9,y:b.y+b.h+.35,w:1.25,h:.5},{type:'well',x:-3,y:3,w:1,h:1}];}
export function protectedAreas(state){return[...siteRoads(state),...SITE_COTTAGES,...siteDecorations(state),...SITE_TREES.map(([x,y])=>({x:x-.2,y:y-.2,w:.5,h:.5})),...SITE_BUSHES.map(([x,y])=>({x:x-.25,y:y-.25,w:.7,h:.7}))];}
export function isInsideBuilding(state,x,y){const b=buildingRect(state);return x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h;}

export function partitionSize(room){return (room.rotation||0)%2?{w:room.height,h:room.width}:{w:room.width,h:room.height};}
export function partitionRect(room){return{x:room.x,y:room.y,...partitionSize(room)};}
export function containsRect(outer,inner,inset=0){return inner.x>=outer.x+inset&&inner.y>=outer.y+inset&&inner.x+inner.w<=outer.x+outer.w-inset&&inner.y+inner.h<=outer.y+outer.h-inset;}
export function pointInRect(rect,p){return p.x>=rect.x&&p.x<rect.x+rect.w&&p.y>=rect.y&&p.y<rect.y+rect.h;}
export function partitionDoor(room){
 const a=partitionRect(room),r=room.rotation||0,vertical=r%2===1,span=vertical?a.h:a.w;
 const center=vertical?a.y+a.h/2:a.x+a.w/2,width=Math.min(2,span-1);
 const boundary=r===0?a.y+a.h:r===1?a.x:r===2?a.y:a.x+a.w;
 const inside=r===0?{x:center,y:boundary-.25}:r===1?{x:boundary+.25,y:center}:r===2?{x:center,y:boundary+.25}:{x:boundary-.25,y:center};
 return{axis:vertical?'x':'y',boundary,center,width,inside};
}
export function canCrossPartition(room,p,q){
 const d=partitionDoor(room),other=d.axis==='x'?'y':'x',half=d.width/2-.04;
 return Math.abs(p[other]-d.center)<=half&&Math.abs(q[other]-d.center)<=half&&Math.min(p[d.axis],q[d.axis])<=d.boundary&&Math.max(p[d.axis],q[d.axis])>=d.boundary;
}

export function partitionWallBlocks(room,p){
 const a=partitionRect(room),d=partitionDoor(room);if(p.x<a.x-.08||p.x>a.x+a.w+.08||p.y<a.y-.08||p.y>a.y+a.h+.08)return false;
 const edges=[['x',a.x],['x',a.x+a.w],['y',a.y],['y',a.y+a.h]];
 return edges.some(([axis,boundary])=>Math.abs(p[axis]-boundary)<.08&&!(axis===d.axis&&boundary===d.boundary&&Math.abs(p[axis==='x'?'y':'x']-d.center)<d.width/2-.04));
}
