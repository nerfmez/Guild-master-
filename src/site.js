// Shared physical layout: placement, navigation and artwork read the same geometry.
export const START_BUILDING={x:5,y:4,width:8,height:6,level:0};
export const SITE_COTTAGES=[{x:-3.5,y:8,w:2.6,h:2.5,seed:21},{x:23,y:13,w:2.6,h:2.5,seed:36}];
export const SITE_TREES=[[-4,1,101,0],[-3,6,102,0],[1,-2,103,1],[8,-3,104,0],[17,-2,105,1],[23,1,106,0],[-4,14,107,0],[25,8,109,0],[28,20,110,0],[-2,22,111,1],[18,23,112,1],[10,24,113,0],[24,22,114,1]];
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
