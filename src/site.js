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

/** World trails as control points in grid units (smoothed with Catmull-Rom when drawn). */
export const WORLD_PATHS = {
  west: [[6, 17.5], [-4, 17.5], [-12, 17.5], [-18, 19.5], [-24, 22.5], [-30, 24], [-38, 22], [-46, 25]],
  lake: [[-30, 24], [-30.6, 27], [-30.2, 30], [-30.4, 31.9]],
  north: [[2, 8], [2, -2], [2, -12], [1, -20], [5, -28], [2, -36], [-2, -44], [2, -52], [4, -58]],
  mistdeep: [[-2, -44], [-7, -47], [-10, -50]],
  east: [[20, 17.5], [34, 17.5], [42, 17.5], [48, 15], [54, 10], [58, 4], [62, -1]],
  hills: [[48, 15], [54, 18], [59, 20]],
};

/** Where each quest takes place on the world map (grid units). */
export const SITE_QUEST_SITES = {
  patrol: { x: -18, y: 21.6 }, herbs: { x: -28.6, y: 30.4 }, escort: { x: 46.5, y: 16.2 },
  hollow: { x: 8.5, y: -27.5 }, crystals: { x: 59.5, y: 21.5 }, ruins: { x: 63, y: -3 },
  mistpath: { x: 1, y: -40 }, rescue: { x: -10.5, y: -49 }, heart: { x: 4, y: -59 },
};
// Where each route leaves the village roads, then which path points it follows.
const ROUTES = {
  patrol: ['west', 3], herbs: ['west', 5, 'lake'], escort: ['east', 2],
  crystals: ['east', 3, 'hills'], ruins: ['east', 6],
  hollow: ['north', 4], mistpath: ['north', 5], rescue: ['north', 6, 'mistdeep'], heart: ['north', 8],
};
/** Smooth a control polyline into dense points. */
export function siteSmoothPath(points, steps = 6) {
  const out = [], p = i => points[Math.max(0, Math.min(points.length - 1, i))];
  for (let i = 0; i < points.length - 1; i++) for (let s = 0; s < steps; s++) {
    const t = s / steps, [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const f = k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t);
    out.push({ x: f(0), y: f(1) });
  }
  const last = points[points.length - 1]; out.push({ x: last[0], y: last[1] }); return out;
}

/** Route in grid units from the guild door to a quest's site, along the village roads and world trails. */
export function siteQuestRoute(door, quest) {
  const site = SITE_QUEST_SITES[quest.id] || { x: 0, y: 20 }, plan = ROUTES[quest.id] || ['west', 2], road = 17.5;
  const [name, last, branch] = plan, points = WORLD_PATHS[name].slice(0, last + 1);
  const out = [{ x: door.x, y: door.y }, { x: door.x, y: road }];
  if (name === 'north') out.push({ x: 2, y: road });
  out.push(...siteSmoothPath(points, 4));
  if (branch) out.push(...siteSmoothPath(WORLD_PATHS[branch], 4).slice(1));
  out.push(site);
  return out;
}
