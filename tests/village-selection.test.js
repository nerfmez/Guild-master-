import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {pointInRect,SITE_COTTAGES} from '../src/site.js';
import {VILLAGE_LOTS} from '../src/content.js';
// Exercise the actual renderer methods without requiring Phaser's browser runtime.
const source=readFileSync(new URL('../src/world.js',import.meta.url),'utf8');
const methods=source.slice(source.indexOf(' hitVillageBuilding(p){'),source.indexOf(' drawGhost(){'));
const art=readFileSync(new URL('../src/guild-art.js',import.meta.url),'utf8');
const projection=art.slice(art.indexOf('export const CELL_W='),art.indexOf('export function gridPolygon')).replaceAll('export ','');
const Renderer=vm.runInNewContext(`${projection}\nclass Renderer{${methods}};Renderer`,{pointInRect,SITE_COTTAGES,Math,getRoomSize:()=>({w:1,h:1}),partitionRect:r=>r});
const worldPoint=(x,y)=>({x:500+(x-y)*24,y:80+(x+y)*12});
function renderer(){const r=new Renderer();Object.assign(r,{villageProps:new Map(),cottageProps:[],villageRects:()=>[],state:{facilities:[],rooms:[]},actors:new Map(),furnitureSprites:[],camera:{zoom:1},onSelect:s=>r.selected=s});return r;}
function image(depth,opaqueX,flipX=false){const data=new Uint8ClampedArray(4*4*4);data[(1*4+opaqueX)*4+3]=255;return {visible:true,active:true,x:0,y:0,scaleX:1,scaleY:1,depth,flipX,texture:{getSourceImage:()=>({width:4,height:4,getContext:()=>({getImageData:()=>({data})})})}};}
test('village roof selects opaque pixels, ignores empty space and respects mirroring',()=>{const r=renderer();r.villageProps.set('home',{key:'h0',images:[image(1,0,true)]});assert.equal(r.hitVillageBuilding({x:3,y:1}),'h0');assert.equal(r.hitVillageBuilding({x:0,y:1}),null);});
test('frontmost visible roof wins, hidden buildings are excluded',()=>{const r=renderer(),front=image(2,0);r.villageProps.set('a',{key:'h0',images:[image(1,0)]});r.villageProps.set('b',{key:'h1',images:[front]});assert.equal(r.hitVillageBuilding({x:0,y:1}),'h1');front.visible=false;assert.equal(r.hitVillageBuilding({x:0,y:1}),'h0');});
test('tap routes each home, moved lot and fixed cottage to its own details',()=>{const r=renderer();r.villageRects=()=>VILLAGE_LOTS.houses.slice(0,3).map((b,i)=>({...b,key:'h'+i,w:2,h:2}));for(let i=0;i<3;i++){const b=r.villageRects()[i];r.select(worldPoint(b.x+1,b.y+1));assert.equal(r.selected.kind,'villageBuilding');assert.equal(r.selected.id,'h'+i);}r.villageRects=()=>[{key:'h1',x:45,y:32,w:2,h:3}];r.select(worldPoint(46,34));assert.equal(r.selected.id,'h1');for(const b of SITE_COTTAGES){r.select(worldPoint(b.x+1,b.y+1));assert.equal(r.selected.id,b.style);}r.selected=null;r.select(worldPoint(70,70));assert.equal(r.selected,null);});
test('placement input takes priority over building detail selection',()=>{const r=renderer();r.pending={};r.footprint=()=>({w:2,h:2});r.setPending=(x,y)=>r.placed={x,y};r.select(worldPoint(4,6));assert.deepEqual(r.placed,{x:3,y:5});assert.equal(r.selected,undefined);});
