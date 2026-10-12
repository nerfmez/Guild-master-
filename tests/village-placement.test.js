import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,act,serializeGame,deserializeGame} from '../src/game.js';
import {guildExpansionReserve,villagePlacementProblem,villagePlacementBlockers} from '../src/town.js';
const rich=()=>{const s=createGame(73);Object.assign(s,{gold:99999,wood:999,stone:999,rank:'E'});return s;};
test('unused land outside the future hall is buildable regardless of guild land purchases',()=>{
 const s=rich();const reserve=guildExpansionReserve(s);
 assert.equal(villagePlacementProblem(s,'shop','shop',3.25,0),null,'unused corner within the original land');
 assert.equal(act(s,'buildProject',{projectId:'shop',spot:{x:3.25,y:0}}).ok,true);
 assert.equal(villagePlacementProblem(s,'h3','house',22,19),null);
 assert.equal(act(s,'expand').ok,true);
 assert.deepEqual(guildExpansionReserve(s),reserve,'buying land does not grow the hall reservation');
 assert.equal(villagePlacementProblem(s,'h3','house',22,19),null,'newly owned empty land stays available');
 assert.equal(act(s,'buildProject',{projectId:'house',spot:{x:22,y:19}}).ok,true);
 const loaded=deserializeGame(serializeGame(s));assert.deepEqual(loaded.village.lots.h3,{x:22,y:19});
});
test('building relocation and rotation work inside formerly blocked land',()=>{
 const s=rich();s.village.shop=1;
 assert.equal(act(s,'expand').ok,true);
 assert.equal(act(s,'moveVillageBuilding',{key:'shop',spot:{x:22,y:19,rot:1}}).ok,true);
 assert.deepEqual(s.village.lots.shop,{x:22,y:19,rot:1});
 assert.equal(villagePlacementProblem(s,'h3','house',22,19), 'ทับอาคารอื่น');
});
test('the true hall expansion, roads and outdoor guild facilities remain protected without charging',()=>{
 const s=rich();
 for(const [x,y] of [[6,5],[15,7],[3.25,17]]){
  const before={gold:s.gold,wood:s.wood,stone:s.stone,houses:s.village.houses};
  assert.equal(act(s,'buildProject',{projectId:'house',spot:{x,y}}).ok,false);
  assert.deepEqual({gold:s.gold,wood:s.wood,stone:s.stone,houses:s.village.houses},before);
 }
 assert.match(villagePlacementProblem(s,'shop','shop',15,7),/ต่อเติม/);
 s.facilities.push({id:'outside-garden',type:'garden',x:22,y:19,rotation:0});
 assert.match(villagePlacementProblem(s,'shop','shop',22,19),/แปลงสมุนไพร/);
 assert.ok(!villagePlacementBlockers(s,'shop').some(r=>r.x===-.5&&r.y===-.5),'no whole-grid reservation');
});
test('upgrading an existing village building keeps its position',()=>{
 const s=rich();assert.equal(act(s,'buildProject',{projectId:'shop',spot:{x:3.25,y:0}}).ok,true);
 const before={...s.village.lots.shop};
 assert.equal(act(s,'buildProject',{projectId:'shop',spot:{x:6,y:5}}).ok,true);
 assert.deepEqual(s.village.lots.shop,before);
});
