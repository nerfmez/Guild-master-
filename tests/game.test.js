import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY_LENGTH, getLodging, regularLimit, boardStatus, boardThreshold, getAdventurerRank, classChoices, marketPrice, tradeQuote, addApplicant, addPetition, getAvailableRecruits, getRankProgress, renownFactor, getVillageInfo, getGuildUpgradeCost, getCraftCost, createGame as createLivingGame, tick, act, serializeGame, deserializeGame, getGuildStats, getMemberStats, getAvailableQuests, previewMission, canPlaceFacility, getRoomSize, findWalkPath, getBuildingExpansionCost } from '../src/game.js';
import { QUESTS, RANKS } from '../src/content.js';

const party = ['mira', 'finn', 'lune'];
// Most tests check one system at a time, so members stay at the guild instead of wandering off to hunt.
function createGame(...args) { const state = createLivingGame(...args); state.policy.memberHunting = false; state.policy.autoPetitions = false; state.policy.registration = false; return state; }
// Villagers bring petitions over time; tests post one straight to the board when none is waiting.
function ensurePetition(state, questId) {
  if (!state.petitions.some(p => p.questId === questId && p.status === 'posted' && !p.missionId)) addPetition(state, questId, { status: 'posted' });
}
// Adventurers walk into town and register over time; tests have one arrive at the door right now.
function hire(state, memberId) {
  if (!addApplicant(state, memberId, { status: 'waiting' })) return { ok: false };
  tick(state, 0.01);
  return { ok: state.members.some(m => m.id === memberId) };
}
function dispatch(state, questId = 'patrol', ids = party, policy = 'balanced') {
  ensurePetition(state, questId);
  const result = act(state, 'sendMission', { questId, memberIds: ids, policy });
  assert.equal(result.ok, true, result.message);
  return state.missions.at(-1);
}
// Quests play out in real time: walk out, fight, walk home. Advise the team when a choice comes up.
function complete(state, mission) {
  for (let i = 0; i < 2000 && mission.status === 'active'; i++) {
    if (mission.event && !mission.event.resolved) assert.equal(act(state, 'chooseEvent', { missionId: mission.id, choiceId: 'help' }).ok, true);
    tick(state, 0.5);
  }
  assert.notEqual(mission.status, 'active', 'the quest finished');
  return mission;
}

test('starter team completes an actual encounter, earns materials, and recovers at home', () => {
  const state = createGame(99);
  const before = state.gold;
  const mission = dispatch(state);
  // The team walks out to the site and fights there in real time.
  for (let i = 0; i < 400 && !(mission.phase === 'battle' && mission.combat.enemyHp < mission.combat.enemyMaxHp); i++) tick(state, 0.25);
  assert.equal(mission.phase, 'battle');
  assert.ok(state.world.monsters.some(m => m.quest === mission.id), 'the quest foes stand at the site');
  for (let i = 0; i < 600 && !mission.event; i++) tick(state, 0.5);
  assert.ok(mission.event, 'a choice comes up before the boss');
  assert.equal(act(state, 'chooseEvent', { missionId: mission.id, choiceId: 'help' }).ok, true);
  complete(state, mission);
  assert.equal(mission.status, 'completed');
  assert.equal(state.completedQuests.patrol, 1);
  assert.ok(state.gold > before);
  assert.ok(state.wood > 32);
  assert.ok(state.rep > 0);
  const energy = state.members[0].energy;
  tick(state, 50);
  assert.ok(state.members[0].energy > energy);
  assert.ok(state.bonds['finn:mira'] > 0);
});

test('invalid and double booked commands are atomic', () => {
  const state = createGame();
  dispatch(state);
  for (const [type, payload] of [
    ['sendMission', { questId: 'herbs', memberIds: party }],
    ['sendMission', { questId: 'patrol', memberIds: ['mira', 'mira', 'finn'] }],
    ['setTask', { memberId: 'mira', task: 'train' }],
    ['build', { type: 'infirmary', x: 4, y: 3 }],
    ['build', { type: 'infirmary', x: 1, y: 1 }],
    ['equip', { memberId: 'mira', equipmentId: 'oak-blade' }],
    ['recruit', { memberId: 'sera' }],
    ['craft', { equipmentId: 'moon-charm' }],
    ['upgrade', { facilityId: 'missing' }],
    ['chooseEvent', { missionId: state.missions[0].id, choiceId: 'cheat' }],
  ]) {
    const before = JSON.stringify(state);
    assert.equal(act(state, type, payload).ok, false, type);
    assert.equal(JSON.stringify(state), before, `${type} must not mutate on refusal`);
  }
});

test('placement, expansion and room upgrade enforce bounds and occupancy', () => {
  const state = createGame();
  assert.equal(act(state, 'build', { type: 'infirmary', x: 8.5, y: 4.5 }).ok, true);
  const room = state.facilities.at(-1);
  assert.equal(act(state, 'move', { facilityId: room.id, x: 4, y: 3 }).ok, false);
  assert.equal(act(state, 'move', { facilityId: room.id, x: 8.75, y: 4.5 }).ok, true);
  assert.equal(act(state, 'expand').ok, false);
  state.rank = 'E';
  state.gold = 3000; state.wood = 100; state.stone = 100;
  assert.equal(act(state, 'expand').ok, true);
  assert.deepEqual(state.grid, { width: 26, height: 20 });
  assert.equal(act(state, 'build', { type: 'garden', x: 16, y: 4 }).ok, true);
  assert.equal(act(state, 'upgrade', { facilityId: room.id }).ok, true);
  assert.equal(room.level, 2);
  assert.equal(act(state, 'demolish', { facilityId: 'room-2' }).ok, true);
  // Adventurers sleep in town now: the last bed in the hall can go too.
  assert.equal(act(state, 'demolish', { facilityId: room.id }).ok, true);
});

test('equipment transfers preserve inventory and enforce class and busy restrictions', () => {
  const state = createGame();
  const initialPower = getMemberStats(state, 'mira').power;
  assert.equal(act(state, 'craft', { equipmentId: 'oak-blade' }).ok, true);
  assert.equal(act(state, 'equip', { memberId: 'finn', equipmentId: 'oak-blade' }).ok, false);
  assert.equal(state.inventory['oak-blade'], 1);
  assert.equal(act(state, 'equip', { memberId: 'mira', equipmentId: 'oak-blade' }).ok, true);
  assert.equal(state.inventory['oak-blade'], 0);
  assert.ok(getMemberStats(state, 'mira').power > initialPower);
  dispatch(state);
  assert.equal(act(state, 'equip', { memberId: 'mira', equipmentId: null, slot: 'weapon' }).ok, false);
  act(state, 'recallMission', { missionId: state.missions[0].id });
  tick(state, 60);
  assert.equal(act(state, 'equip', { memberId: 'mira', equipmentId: null, slot: 'weapon' }).ok, true, 'home again after the recall');
  assert.equal(state.inventory['oak-blade'], 1);
});

test('bankrupt guild remains playable, charges modest upkeep, and limits daily workshop chores', () => {
  const state = createGame();
  state.gold = 0;
  tick(state, 240);
  assert.ok(state.gold < 20, 'only the small market fees of free adventurers come in');
  assert.equal(state.day, 2);
  assert.equal(previewMission(state, 'patrol', party).ok, true);
  complete(state, dispatch(state));
  assert.ok(state.gold >= 60);
  act(state, 'setTask', { memberId: 'noa', task: 'work' });
  const wood = state.wood;
  tick(state, 180);
  assert.equal(state.wood - wood, 2);
  assert.notEqual(state.members.find(member => member.id === 'noa').task, 'work', 'two chores a day, then back to their own time');
  assert.equal(getGuildStats(state).upkeep, 12 + state.facilities.length * 3);
  assert.ok(state.gold >= 0);
});

test('the board sends out more jobs at once as it grows, and lodging in town caps how many adventurers register', () => {
  const state = createGame();
  state.rank = 'E'; state.gold = 6000; state.wood = 200; state.stone = 100;
  assert.equal(getGuildStats(state).boardCap, 0, 'no board, no jobs taken by themselves');
  assert.equal(act(state, 'build', { type: 'board', x: 8.5, y: 4.5 }).ok, true);
  assert.equal(getGuildStats(state).boardCap, 2);
  assert.equal(act(state, 'upgrade', { facilityId: state.facilities.at(-1).id }).ok, true);
  assert.equal(getGuildStats(state).boardCap, 4);
  assert.equal(act(state, 'build', { type: 'dispatch', x: 5.5, y: 6.5, rotation:2 }).ok, true);
  assert.equal(getGuildStats(state).boardCap, 5, 'a planning table adds one more');
  // Lodging: the inn's rooms plus rooms let in houses, never more than the town draws at its level.
  const room = getLodging(state);
  assert.equal(room.lodging, 6 + 3 * 2);
  assert.equal(room.cap, Math.min(room.lodging, room.town));
  assert.equal(getGuildStats(state).memberCap, room.cap);
  assert.equal(act(state, 'buildProject', { projectId: 'inn' }).ok, true);
  assert.equal(getLodging(state).lodging, room.lodging + 8);
  assert.equal(getLodging(deserializeGame(serializeGame(state))).lodging, room.lodging + 8, 'the inn survives save and load');
  // Nobody is hired any more: hiring commands are gone and newcomers register by themselves.
  assert.equal(act(state, 'recruit', { memberId: 'sera' }).ok, false);
  state.policy.registration = true;
  const count = state.members.length;
  tick(state, 400);
  assert.ok(state.members.length > count, 'newcomers walked in and registered');
  assert.ok(state.members.length <= getLodging(state).cap);
  assert.ok(state.members.filter(m => m.bio).every(m => !m.regular), 'rookies become named regulars only by working with the guild');
  assert.doesNotThrow(() => serializeGame(state));
});

test('save roundtrip keeps deterministic mission events and imported corruption is rejected', () => {
  const state = createGame(42);
  dispatch(state);
  tick(state, 25);
  const saved = serializeGame(state);
  const restored = deserializeGame(saved);
  assert.deepEqual(restored, state);
  tick(state, 100);
  tick(restored, 100);
  assert.deepEqual(restored, state);
  for (const mutate of [
    data => { data.gold = -1; },
    data => { data.members.push(data.members[0]); },
    data => { data.inventory.cheat = 12; },
    data => { data.facilities[1].x = data.facilities[0].x; },
    data => { data.story.chapter = 99; },
    data => { data.members[0].equipment.weapon = 'moon-wand'; },
    data => { data.grid.width = 999; },
    data => { data.version = 999; },
  ]) {
    const data = JSON.parse(saved); delete data.checksum; mutate(data);
    assert.throws(() => deserializeGame(JSON.stringify(data)));
  }
  const corrupt = JSON.parse(saved); corrupt.gold += 1;
  assert.throws(() => deserializeGame(JSON.stringify(corrupt)), /เสียหาย/);
});

test('version one bookkeeping migrates safely and unavailable stories cannot be dispatched', () => {
  const data = createGame();
  data.version = 1;
  delete data.daily; delete data.goals; delete data.eventCooldowns; delete data.inventory;
  const state = deserializeGame(JSON.stringify(data));
  assert.equal(state.version, 6);
  assert.ok(state.daily.missionCounts);
  assert.equal(act(state, 'sendMission', { questId: 'heart', memberIds: party }).ok, false);
  state.rep = 999;
  complete(state, dispatch(state));
  assert.equal(state.rank, 'F', 'renown alone cannot promote without a record of work and the exam');
  assert.equal(getAvailableQuests(state).find(quest => quest.id === 'escort').locked, true);
  assert.equal(getAvailableQuests(state).find(quest => quest.id === 'hollow').locked, true);
});

test('late story contracts require guild investment as well as a strong fighting party', () => {
  const state = createGame();
  state.rank = 'B'; state.rep = 500; state.completedQuests.mistpath = 1;
  let rescue = getAvailableQuests(state).find(quest => quest.id === 'rescue');
  assert.equal(rescue.locked, true);
  assert.match(rescue.lockReason, /6 คน/);
  assert.match(rescue.lockReason, /โต๊ะวางแผน/);
  assert.match(rescue.lockReason, /ขยายที่ดิน/);
  const before = JSON.stringify(state);
  assert.equal(act(state, 'sendMission', { questId: 'rescue', memberIds: party }).ok, false);
  assert.equal(JSON.stringify(state), before);
  state.gold = 9000; state.wood = 500; state.stone = 500;
  assert.equal(act(state, 'expand').ok, true);
  assert.equal(act(state, 'build', { type: 'infirmary', x: 8.5, y: 4.5 }).ok, true);
  for (const memberId of ['sera', 'toma']) assert.equal(hire(state, memberId).ok, true);
  rescue = getAvailableQuests(state).find(quest => quest.id === 'rescue');
  assert.match(rescue.lockReason, /โต๊ะวางแผน/);
  assert.equal(act(state, 'build', { type: 'dispatch', x: 5.5, y: 6.5, rotation:2 }).ok, true);
  assert.equal(getAvailableQuests(state).find(quest => quest.id === 'rescue').locked, false);
  state.rank = 'A'; state.completedQuests.rescue = 1;
  assert.match(getAvailableQuests(state).find(quest => quest.id === 'heart').lockReason, /โพรง|หอระฆัง/);
  state.completedQuests.hollow = 1; state.completedQuests.ruins = 1;
  assert.match(getAvailableQuests(state).find(quest => quest.id === 'heart').lockReason, /2 จุดใช้งาน/);
  assert.equal(act(state, 'upgrade', { facilityId: 'room-4' }).ok, true);
  assert.equal(getAvailableQuests(state).find(quest => quest.id === 'heart').locked, true);
  assert.equal(act(state, 'upgrade', { facilityId: 'room-6' }).ok, true);
  assert.equal(getAvailableQuests(state).find(quest => quest.id === 'heart').locked, false, 'players may choose any two rooms');
});

test('training, specialization, gatherings and choices apply meaningful stat effects', () => {
  const state = createGame();
  const initialXp = state.members.find(member => member.id === 'lune').xp;
  act(state, 'setTask', { memberId: 'lune', task: 'train' });
  tick(state, 100);
  assert.ok(state.members.find(member => member.id === 'lune').xp > initialXp);
  assert.ok(state.members.find(member => member.id === 'lune').energy < 100);
  state.rank = 'D';
  const member = state.members.find(member => member.id === 'mira');
  member.level = 5;
  const oldPower = getMemberStats(state, member).basePower;
  assert.equal(act(state, 'specialize', { memberId: 'mira', classId: 'guardian' }).ok, false, 'class change needs rank D and a dojo');
  member.rank = 'D'; state.village.dojo = 1;
  assert.equal(act(state, 'specialize', { memberId: 'mira', classId: 'guardian' }).ok, true);
  assert.equal(member.errand.kind, 'classTrial', 'the trial happens at the dojo');
  tick(state, 41);
  assert.equal(member.class, 'guardian');
  assert.ok(getMemberStats(state, member).basePower > oldPower);
  member.energy = 40;
  assert.equal(act(state, 'hostEvent', { eventId: 'tea' }).ok, true);
  assert.equal(member.energy, 55);
  assert.ok(state.bonds['finn:mira'] > 0);
  const before = JSON.stringify(state);
  assert.equal(act(state, 'hostEvent', { eventId: 'tea' }).ok, false);
  assert.equal(JSON.stringify(state), before);
  const mission = dispatch(state);
  for (let i = 0; i < 600 && !mission.event; i++) tick(state, 0.5);
  const herb = state.herb;
  assert.equal(act(state, 'chooseEvent', { missionId: mission.id, choiceId: 'rest' }).ok, true);
  assert.equal(state.herb, herb - 1);
  assert.ok(mission.decisionBonus > 0);
});

test('room capacity creates queues and construction cannot seal existing rooms from the gate', () => {
  const state = createGame();
  state.members.forEach(member => { member.energy = 20; member.injury = 10; });
  tick(state, 1);
  const energyGains = state.members.map(member => member.energy - 20);
  // Everyone rests in their own room in town: no queue for beds any more.
  assert.equal(energyGains.filter(gain => gain > 0.1).length, 4);
  assert.equal(state.members.filter(member => member.waitingReason).length, 0);
  assert.equal(state.members.filter(member => member.injury < 9.9).length, 4, 'two treatment beds, two patients each');
  state.members.forEach(member => { member.energy = 100; member.injury = 0; act(state, 'setTask', { memberId: member.id, task: 'train' }); });
  tick(state, 1);
  assert.equal(state.members.filter(member => member.xp > 0).length, 2);
  assert.equal(state.members.filter(member => member.waitingReason === 'รอผลัดเข้าหุ่นฝึก').length, 2);
  state.gold = 5000; state.wood = 500; state.stone = 500;
  const before = JSON.stringify(state);
  const sealed = act(state, 'build', {type:'infirmary',x:8,y:8.75,rotation:1});
  assert.equal(sealed.ok, false);
  assert.match(sealed.message, /ทางเข้า/);
  assert.equal(JSON.stringify(state), before);
});

test('free furnishings rotate and move at quarter tiles without blocking entrances',()=>{
 const state=createGame(),before=JSON.stringify(state);
 assert.equal(act(state,'move',{facilityId:'room-5',x:11.5,y:8.5,rotation:3}).ok,false,'Indoor furniture cannot face through the outer wall');
 assert.equal(act(state,'rotate',{facilityId:'room-2'}).ok,false,'Bed cannot rotate through the neighboring medical bed');
 assert.equal(JSON.stringify(state),before);
 assert.equal(act(state,'move',{facilityId:'room-2',x:8.25,y:4.75,rotation:1}).ok,true);
 const bed=state.facilities.find(f=>f.id==='room-2');assert.deepEqual(getRoomSize(bed.type,bed.rotation),{w:2,h:1});
 assert.equal(act(state,'rotate',{facilityId:bed.id}).ok,true);
 assert.equal(bed.rotation,2);assert.deepEqual(deserializeGame(serializeGame(state)),state);
 const path=findWalkPath(state,{x:9.25,y:10.25},{x:8.75,y:4.25});assert.ok(path.length>0);
 assert.ok(path.every(p=>state.facilities.every(f=>{const d=getRoomSize(f.type,f.rotation);return !(p.x>f.x&&p.x<f.x+d.w&&p.y>f.y&&p.y<f.y+d.h);})), 'Walk route stays clear of furniture');
});

test('building extension opens continuous floor and outdoor planting respects roads and trees',()=>{
 const state=createGame(),cost=getBuildingExpansionCost(state),gold=state.gold;
 assert.equal(act(state,'build',{type:'infirmary',x:13.5,y:7}).ok,false);
 assert.equal(act(state,'expandBuilding').ok,true);assert.equal(state.gold,gold-cost.gold);assert.deepEqual(state.building,{x:5,y:4,width:10,height:8,level:1});
 assert.equal(act(state,'build',{type:'infirmary',x:13.5,y:7}).ok,true);
 state.rank='E';state.gold=10000;state.wood=500;state.stone=500;
 for(const [x,y]of [[1,1],[8.25,12],[5.5,5]])assert.equal(canPlaceFacility(state,'garden',x,y).ok,false);
 assert.equal(act(state,'build',{type:'garden',x:16,y:4}).ok,true);
 assert.equal(act(state,'expand').ok,true);assert.equal(canPlaceFacility(state,'garden',23,1).ok,false,'Tree footprint remains protected after buying land');
});

test('old room saves migrate to furnishings while retaining progress and rejecting broken geometry',()=>{
 const old=createGame(27);old.version=2;delete old.building;
 const places=[[4,3],[8,3],[12,3],[4,6],[8,6],[12,6]];
 old.facilities.forEach((f,i)=>{f.x=places[i][0];f.y=places[i][1];delete f.rotation;});old.facilities[1].level=2;old.gold=2314;old.members[0].level=4;
 const migrated=deserializeGame(JSON.stringify(old));assert.equal(migrated.version,6);assert.equal(migrated.gold,2314);assert.equal(migrated.members[0].level,4);assert.equal(migrated.facilities[1].level,2);assert.equal(migrated.facilities.length,6);assert.doesNotThrow(()=>serializeGame(migrated));
 old.facilities[1].x=old.facilities[0].x;assert.throws(()=>deserializeGame(JSON.stringify(old)),/ผัง/);
});

 test('mission preview accepts missing selections without throwing',()=>{assert.doesNotThrow(()=>previewMission(createGame(),'patrol',null));});


test('empty floor accepts player-sized rooms and door access governs furniture placement',()=>{
 const s=createGame();assert.deepEqual(s.rooms,[]);
 assert.equal(act(s,'buildRoom',{type:'dorm',x:10,y:4,width:3,height:3}).ok,true);
 assert.equal(s.rooms.length,1);const before=JSON.stringify(s);
 for(const payload of [{type:'hall',x:9,y:4,width:3,height:3},{type:'hall',x:12,y:7,width:3,height:3},{type:'hall',x:5,y:4,width:3,height:2,rotation:2}])assert.equal(act(s,'buildRoom',payload).ok,false);
 assert.equal(JSON.stringify(s),before);assert.deepEqual(deserializeGame(serializeGame(s)),s);
 assert.equal(act(s,'move',{facilityId:'room-5',x:9.5,y:6.5}).ok,false,'Furniture cannot straddle a partition');
});

test('moving and rotating a room carries its furniture and shrinking refuses to discard objects',()=>{
 const s=createGame();act(s,'buildRoom',{type:'dorm',x:10,y:4,width:3,height:3});const room=s.rooms[0];
 assert.equal(act(s,'rotateRoom',{roomId:room.id}).ok,true);assert.equal(s.facilities.find(f=>f.id==='room-2').rotation,1);
 assert.equal(act(s,'expandBuilding').ok,true);
 assert.equal(act(s,'moveRoom',{roomId:room.id,x:11.75,y:5.5}).ok,true);
 assert.equal(s.facilities.find(f=>f.id==='room-2').x,12.25);assert.equal(s.facilities.find(f=>f.id==='room-2').y,6);
 const before=JSON.stringify(s);assert.equal(act(s,'resizeRoom',{roomId:room.id,width:2,height:2}).ok,false);assert.equal(JSON.stringify(s),before);
 assert.equal(act(s,'resizeRoom',{roomId:room.id,width:4,height:3}).ok,true);assert.deepEqual(deserializeGame(serializeGame(s)),s);
 assert.equal(act(s,'demolishRoom',{roomId:room.id}).ok,true);assert.equal(s.rooms.length,0);assert.equal(s.facilities.length,6);
});

test('floor extensions unlock in order with rank requirements and v3 saves keep an open floor',()=>{
 const s=createGame();s.gold=10000;s.wood=500;s.stone=500;
 assert.equal(act(s,'expandBuilding').ok,true);const before=JSON.stringify(s);assert.equal(act(s,'expandBuilding').ok,false);assert.equal(JSON.stringify(s),before);
 s.rank='E';assert.equal(act(s,'expandBuilding').ok,true);assert.equal(act(s,'expandBuilding').ok,false);
 s.rank='D';assert.equal(act(s,'expandBuilding').ok,true);assert.equal(s.building.width,14);assert.equal(s.building.height,12);assert.equal(act(s,'expandBuilding').ok,false);
 const old=createGame();old.version=3;delete old.rooms;const restored=deserializeGame(JSON.stringify(old));assert.deepEqual(restored.rooms,[]);assert.deepEqual(restored.facilities,old.facilities);assert.equal(restored.gold,old.gold);
});

test('opening chapter starts empty and brings adventurers in step by step', () => {
  const state = createGame(7, { opening: true });
  assert.equal(state.members.length, 0);
  assert.equal(state.facilities.length, 0);
  assert.equal(state.intro.step, 'reception');
  const roundTrip = () => deserializeGame(serializeGame(state));
  assert.equal(roundTrip().intro.step, 'reception');
  tick(state, 30);
  assert.equal(state.members.length, 0, 'nobody arrives before the hall is ready');
  assert.equal(act(state, 'build', { type: 'reception', x: 5.5, y: 4.5 }).ok, true);
  assert.equal(state.intro.step, 'board');
  assert.equal(act(state, 'build', { type: 'board', x: 8.5, y: 4.5 }).ok, true);
  assert.equal(state.intro.step, 'wait');
  assert.equal(act(state, 'welcomeVisitors').ok, false);
  tick(state, 7);
  assert.deepEqual(state.intro.visitors, ['mira']);
  assert.equal(roundTrip().intro.step, 'visit');
  assert.equal(act(state, 'welcomeVisitors').ok, true);
  assert.deepEqual(state.members.map(m => m.id), ['mira']);
  assert.equal(state.intro.step, 'training');
  roundTrip();
  assert.equal(act(state, 'build', { type: 'training', x: 7.25, y: 7.75 }).ok, true);
  tick(state, 9);
  assert.deepEqual(state.intro.visitors, ['finn', 'lune']);
  act(state, 'welcomeVisitors');
  assert.equal(state.intro.step, 'patrol');
  complete(state, dispatch(state));
  assert.ok(state.completedQuests.patrol);
  tick(state, 11);
  assert.deepEqual(state.intro.visitors, ['noa']);
  act(state, 'welcomeVisitors');
  assert.equal(state.intro.step, 'done');
  assert.equal(state.members.length, 4);
  assert.equal(roundTrip().members.length, 4);
});

test('guild master profile is cleaned, saved and editable', async () => {
  const { normalizeProfile } = await import('../src/game.js');
  const state = createGame(3, { opening: true, profile: { masterName: '  อาริน<script>  ', guildName: 'กิลด์ดาวเหนือ', hair: '#d9b26f', outfit: 'red', hairStyle: 'long' } });
  assert.equal(state.profile.masterName, 'อารินscript');
  assert.equal(state.profile.guildName, 'กิลด์ดาวเหนือ');
  assert.equal(state.profile.hair, '#d9b26f');
  assert.equal(state.profile.outfit, normalizeProfile({}).outfit);
  assert.equal(deserializeGame(serializeGame(state)).profile.hairStyle, 'long');
  assert.equal(act(state, 'setProfile', { guildName: '' }).ok, true);
  assert.equal(state.profile.guildName, 'กิลด์ดาวเหนือ');
  assert.equal(createGame().profile, undefined);
});

test('missions roll quest-specific chest loot, and luck finds rarer treasure', async () => {
  const { getTeamLuck } = await import('../src/game.js');
  const { LOOT, EQUIPMENT } = await import('../src/content.js');
  const state = createGame(11);
  const mission = dispatch(state);
  assert.equal(mission.loot.length, 3);
  const allowed = new Set(Object.values(LOOT.patrol).flat().map(e => e.id || e.key));
  for (const entry of mission.loot) assert.ok(allowed.has(entry.id || entry.key), 'patrol chests come from the patrol table');
  const inventory = Object.values(state.inventory).reduce((a, b) => a + b, 0);
  complete(state, mission);
  assert.equal(mission.result.success, true);
  assert.equal(mission.result.loot.length, 3);
  const items = mission.result.loot.filter(e => e.kind === 'item').length;
  assert.equal(Object.values(state.inventory).reduce((a, b) => a + b, 0), inventory + items);
  assert.equal(deserializeGame(serializeGame(state)).missions.at(-1).result.loot.length, 3);
  // A scout, observant trait and a careful plan raise luck; luck shifts rolls toward rare finds.
  assert.ok(getTeamLuck(state, ['mira', 'finn', 'lune'], 'cautious', 1.3) > getTeamLuck(state, ['mira', 'lune', 'noa'], 'bold', 1));
  const { rollLoot } = await import('../src/game.js');
  const rareShare = luck => { const s = createGame(5); let rare = 0; for (let i = 0; i < 400; i++) rare += rollLoot(s, 'mistpath', luck).filter(e => e.tier === 'rare' || e.tier === 'legendary').length; return rare / 1200; };
  assert.ok(rareShare(0.45) > rareShare(0) * 1.6, 'high luck finds clearly more rare treasure');
  assert.ok(EQUIPMENT.filter(e => e.loot).every(e => e.workshopLevel === 99), 'treasures cannot be crafted');
});

test('teams of one to three can travel, auto-picked teams cover the quest roles', async () => {
  const { suggestTeam } = await import('../src/game.js');
  const state = createGame(21);
  assert.equal(previewMission(state, 'patrol', []).ok, false);
  assert.equal(previewMission(state, 'patrol', ['mira', 'mira']).ok, false);
  const solo = dispatch(state, 'patrol', ['finn']);
  assert.deepEqual(solo.memberIds, ['finn']);
  complete(state, solo);
  assert.ok(['completed', 'failed'].includes(solo.status));
  assert.equal(deserializeGame(serializeGame(state)).missions.at(-1).memberIds.length, 1);
  const fresh = createGame(22);
  const team = suggestTeam(fresh, 'herbs');
  assert.equal(team.length, 3);
  assert.ok(team.includes('noa') && team.includes('finn'), 'healer and scout cover the herb quest');
});

test('items can be sold and auto-equip gives each member the best gear', async () => {
  const { getSellPrice } = await import('../src/game.js');
  const state = createGame(23);
  state.inventory['oak-blade'] = 1; state.inventory['echo-blade'] = 1; state.inventory['ribbon'] = 2;
  assert.equal(act(state, 'autoEquip').ok, true);
  assert.equal(state.members.find(m => m.id === 'mira').equipment.weapon, 'echo-blade');
  assert.equal(state.members.filter(m => m.equipment.accessory === 'ribbon').length, 2);
  const gold = state.gold;
  assert.equal(act(state, 'sellItem', { equipmentId: 'oak-blade' }).ok, true);
  assert.equal(state.gold, gold + getSellPrice('oak-blade'));
  assert.equal(act(state, 'sellItem', { equipmentId: 'oak-blade' }).ok, false);
});

test('villagers walk in with petitions; the guild accepts, declines or lets them leave', () => {
  const state = createGame(5);
  state.petitionClock = 1;
  tick(state, 2);
  const petition = state.petitions.find(p => !p.important);
  assert.ok(petition, 'a villager sets out with a request');
  assert.equal(petition.status, 'coming');
  assert.ok(petition.eta > 3, 'the walk from home takes time');
  tick(state, petition.eta + 0.5);
  assert.equal(petition.status, 'waiting');
  const before = JSON.stringify(state);
  assert.equal(act(state, 'acceptPetition', { petitionId: petition.id, plan: 'cheap' }).ok, false);
  assert.equal(JSON.stringify(state), before);
  assert.equal(act(state, 'acceptPetition', { petitionId: petition.id, plan: 'generous' }).ok, true);
  assert.equal(petition.status, 'posted');
  assert.equal(petition.plan, 'generous');
  // Without acceptance a villager waits a while, then goes home.
  const other = addPetition(state, 'herbs', { status: 'waiting' });
  tick(state, other.patience + 1);
  assert.ok(!state.petitions.includes(other));
  const third = addPetition(state, 'herbs', { status: 'waiting' });
  assert.equal(act(state, 'declinePetition', { petitionId: third.id }).ok, true);
  assert.ok(!state.petitions.includes(third));
  const important = state.petitions.find(p => p.important);
  assert.equal(important.questId, 'patrol');
  assert.equal(act(state, 'declinePetition', { petitionId: important.id }).ok, false);
  assert.deepEqual(deserializeGame(serializeGame(state)), state);
});

test('board jobs pay the team their share and the guild its commission', () => {
  const state = createGame(8);
  const petition = state.petitions.find(p => p.questId === 'patrol');
  const gold = state.gold;
  act(state, 'sendMission', { questId: 'patrol', memberIds: party, petitionId: petition.id, plan: 'thrifty' });
  assert.equal(petition.status, 'taken');
  const mission = state.missions.at(-1);
  complete(state, mission);
  assert.equal(mission.status, 'completed');
  assert.ok(!state.petitions.includes(petition), 'finished petitions leave the board');
  assert.ok(Math.abs(mission.result.wages - petition.fee / 2) <= 1, 'the team shares half the fee');
  const purse = party.reduce((sum, id) => sum + state.members.find(m => m.id === id).purse, 0);
  assert.ok(purse >= Math.round(petition.fee / 2) - 1);
  const bought = state.ledger.filter(e => e.text === 'รับซื้อของจากนักผจญภัย').reduce((sum, e) => sum + e.gold, 0);
  assert.ok(state.gold - gold - bought >= Math.floor(petition.fee / 2) - 1, 'the guild keeps its commission (minus loot it bought at the counter)');
  assert.ok(state.village.prosperity > 0);
  assert.ok(!state.petitions.some(p => p.questId === 'patrol'), 'cleared story steps stop coming as important letters');
});

test('adventurers read the board, form parties and take every job themselves, story letters included; the master only sets the pay', () => {
  const state = createGame(11);
  const job = addPetition(state, 'herbs', { status: 'posted', plan: 'generous' });
  tick(state, 20);
  assert.equal(job.missionId, null, 'nobody picks up work without a board');
  assert.equal(boardStatus(state, job).kind, 'board', 'the board tells why a job is still open');
  let placed = false;
  for (let y = 4.5; y < 9.5 && !placed; y += 0.25) for (let x = 5.5; x < 12.5 && !placed; x += 0.25) placed = act(state, 'build', { type: 'board', x, y }).ok;
  assert.ok(placed, 'the board fits in the starting hall');
  tick(state, 15);
  const story = state.petitions.find(p => p.important && p.questId === 'patrol');
  assert.ok(!story || story.missionId, 'the elder\'s letter is taken by adventurers too: nothing is reserved for the player');
  // The first party out took the elder's letter; the herbs go to whoever is free and strong enough next.
  for (let i = 0; i < 400 && !job.missionId; i++) tick(state, 1);
  assert.ok(job.missionId, 'an idle adventurer took the job');
  const mission = state.missions.find(m => m.id === job.missionId);
  assert.equal(mission.auto, true);
  assert.ok(mission.memberIds.length >= 1 && mission.memberIds.length <= 3);
  assert.equal(boardStatus(state, job).kind, 'taken');
  assert.equal(act(state, 'recallMission', { missionId: mission.id }).ok, true);
  assert.equal(job.status, 'posted', 'recalled work returns to the board');
  assert.equal(job.missionId, null);
  // Pay is the master's lever: thrifty pay asks for a safer job, an added bonus makes takers braver.
  const hard = addPetition(state, 'escort', { status: 'posted', plan: 'thrifty' });
  const strict = boardThreshold(hard), gold = state.gold;
  assert.equal(act(state, 'boostPetition', { petitionId: hard.id }).ok, true);
  assert.ok(boardThreshold(hard) < strict);
  assert.equal(state.gold, gold - hard.bonus, 'the bonus is held by the guild until the job is done');
  assert.equal(act(state, 'declinePetition', { petitionId: hard.id }).ok, true);
  assert.equal(state.gold, gold, 'a withdrawn job hands the bonus back');
  assert.doesNotThrow(() => serializeGame(state));
});

test('idle guild upgrades and village projects grow income, petitions and the village', () => {
  const state = createGame(3);
  state.gold = 20000; state.wood = 500; state.stone = 500; state.herb = 100;
  const interval = getVillageInfo(state).interval;
  assert.equal(act(state, 'buyUpgrade', { upgradeId: 'signboard' }).ok, true);
  assert.ok(getVillageInfo(state).interval < interval);
  assert.ok(getGuildUpgradeCost(state, 'signboard').gold > 140, 'each level costs more');
  assert.equal(act(state, 'buyUpgrade', { upgradeId: 'coffer' }).ok, true);
  const gold = state.gold;
  tick(state, 200);
  assert.ok(state.gold > gold, 'the coffer pays while time passes');
  const offline = act(state, 'collectIdle', { seconds: 99999 });
  assert.equal(offline.gold, Math.floor(0.25 * 7200), 'offline income is capped at two hours');
  assert.equal(act(state, 'buildProject', { projectId: 'market' }).ok, false, 'market needs a bigger village');
  assert.equal(act(state, 'buildProject', { projectId: 'shop' }).ok, true);
  assert.equal(act(state, 'buildProject', { projectId: 'house' }).ok, true);
  assert.equal(state.village.houses, 4);
  assert.equal(act(state, 'buildProject', { projectId: 'house' }).ok, false, 'a small village only has so many lots');
  state.village.prosperity = 1000;
  assert.equal(getVillageInfo(state).level, 2, 'a village level also needs people living there');
  for (let i = 0; i < 4; i++) state.village.homes['h' + i] = { tier: 2, progress: 0 };
  assert.equal(getVillageInfo(state).level, 3);
  assert.equal(act(state, 'buildProject', { projectId: 'house' }).ok, true);
  assert.equal(act(state, 'buildProject', { projectId: 'market' }).ok, true);
  assert.equal(act(state, 'buildProject', { projectId: 'smithy' }).ok, true);
  assert.equal(getCraftCost(state, { cost: { gold: 100, wood: 5 } }).gold, 90);
  state.market.wood = 60;
  const wood = state.wood;
  assert.equal(act(state, 'buyMaterial', { key: 'wood' }).ok, true);
  assert.equal(state.wood, wood + 10);
  // Adventurers spend their wages in the village shop: morale up, village more prosperous.
  const mira = state.members.find(m => m.id === 'mira');
  mira.purse = 400; mira.morale = 60;
  const prosperity = state.village.prosperity;
  tick(state, 30);
  assert.ok(mira.purse < 400 && mira.morale > 60 && state.village.prosperity > prosperity);
  const restored = deserializeGame(serializeGame(state));
  assert.deepEqual(restored.village, state.village);
  assert.deepEqual(restored.upgrades, state.upgrades);
  const data = JSON.parse(serializeGame(state)); delete data.checksum; data.upgrades.coffer = 99;
  assert.throws(() => deserializeGame(JSON.stringify(data)));
});

test('version four saves gain an empty board, important letters and a starting village', () => {
  const old = createGame(13);
  old.version = 4;
  for (const key of ['petitions', 'petitionClock', 'petitionRng', 'payoutPlan', 'upgrades', 'village', 'idleBank']) delete old[key];
  old.members.forEach(member => { delete member.purse; });
  const state = deserializeGame(JSON.stringify(old));
  assert.equal(state.version, 6);
  assert.equal(state.village.houses, 3);
  assert.ok(state.petitions.some(p => p.questId === 'patrol' && p.important));
  assert.equal(state.members[0].purse, 0);
  complete(state, dispatch(state));
});

test('board teams use their own slots, so the player can still send important work', () => {
  const state = createGame(17);
  state.gold = 5000; state.wood = 200; state.stone = 200;
  let placed = false;
  for (let y = 4.5; y < 9.5 && !placed; y += 0.25) for (let x = 5.5; x < 12.5 && !placed; x += 0.25) placed = act(state, 'build', { type: 'board', x, y }).ok;
  // Noa stays home for the player's important job.
  act(state, 'setAutoWork', { memberId: 'noa', autoWork: false });
  const job = addPetition(state, 'herbs', { status: 'posted', plan: 'generous' });
  tick(state, 10);
  assert.ok(job.missionId, 'free adventurers took the board job');
  const stats = getGuildStats(state);
  assert.equal(stats.boardMissions, 1);
  assert.equal(stats.activeMissions, 0, 'the player slot stays open');
  const second = addPetition(state, 'herbs', { status: 'posted', plan: 'generous' });
  tick(state, 10);
  assert.equal(second.missionId, null, 'a level 1 board sends one team at a time');
  const important = state.petitions.find(p => p.important);
  const result = act(state, 'sendMission', { questId: 'patrol', memberIds: ['noa'], petitionId: important.id });
  assert.equal(result.ok, true, result.message);
  assert.equal(getGuildStats(state).activeMissions, 1);
  assert.doesNotThrow(() => deserializeGame(serializeGame(state)));
});

test('a hands-off guild master finishes chapter one in about an hour and a half and the frontier chapter at rank B, ranks climb by renown and merit, and money circulates', async () => {
  const { simulate } = await import('./simulate.js');
  for (const seed of [1, 2, 3, 4, 5]) {
    const { state, metrics: m } = simulate(seed);
    const min = s => s / 60;
    assert.ok(m.chapterOneAt != null, `seed ${seed} heals the forest heart`);
    assert.ok(min(m.chapterOneAt) >= 45 && min(m.chapterOneAt) <= 130, `seed ${seed} chapter one takes 45-130 game minutes, took ${min(m.chapterOneAt)}`);
    assert.ok(m.finishedAt !== null, `seed ${seed} finishes the frontier story`);
    assert.ok(min(m.finishedAt) >= 160 && min(m.finishedAt) <= 340, `seed ${seed} the dragon falls after about 2.7-5.5 game hours, took ${min(m.finishedAt)}`);
    assert.ok(min(m.ranks.E) <= 35 && min(m.ranks.D) <= 70 && min(m.ranks.C) <= 120 && min(m.ranks.B) <= 190, `seed ${seed} ranks E/D/C/B at ${min(m.ranks.E)}/${min(m.ranks.D)}/${min(m.ranks.C)}/${min(m.ranks.B)} minutes`);
    assert.equal(state.rank, 'B', `seed ${seed} the game stops at rank B for now`);
    assert.equal(state.frontier.camp >= 2, true, `seed ${seed} the frontier camp grew for the raids`);
    assert.equal(m.bankruptDays, 0, `seed ${seed} never misses upkeep`);
    assert.ok(m.failures <= m.boardRuns * 0.08, `seed ${seed} real fights can go wrong now and then, but rarely (${m.failures} of ${m.boardRuns})`);
    assert.equal(m.playerRuns, 0, `seed ${seed} nobody is sent by hand: adventurers take every job themselves`);
    assert.ok(state.members.length >= 40, `seed ${seed} a grown town is full of adventurers (${state.members.length})`);
    assert.ok(m.boardRuns >= 30, `seed ${seed} adventurers took board work by themselves (${m.boardRuns})`);
    assert.ok(state.members.filter(member => member.id.startsWith('r-')).length >= 1, `seed ${seed} rookies were drawn in by fame`);
    assert.ok(state.members.filter(member => member.points > 0).length >= state.members.length * 0.9, `seed ${seed} mentoring gives nearly everyone, rookies included, real work (newcomers just arrived may not have yet)`);
    assert.ok(m.trade >= 5000, `seed ${seed} adventurers spent their wages in the village (${Math.round(m.trade)} G)`);
    assert.ok(state.members.every(member => member.equipment.weapon), `seed ${seed} everyone ends up armed`);
    assert.ok(m.village[5] === undefined || m.village[5] > m.chapterOneAt * 1.2, `seed ${seed} the top village level is left for later`);
    const idle = m.ledger['ดอกผลกองทุนและค่าแผงตลาด'] || 0, commission = m.ledger['ค่านายหน้า'] || 0;
    assert.ok(idle > commission * 0.1 && idle < commission, `seed ${seed} idle income matters but does not replace work (${idle} vs ${commission})`);
    assert.doesNotThrow(() => serializeGame(state));
  }
});

test('promotion needs renown and a record of work, then the exam letter arrives', () => {
  const state = createGame(21);
  state.rep = 60;
  state.record.jobs = 3;
  tick(state, 1);
  assert.equal(getRankProgress(state).examReady, false);
  assert.ok(!state.petitions.some(p => p.questId === 'escort'), 'no exam letter before the record is complete');
  assert.equal(getAvailableQuests(state).find(q => q.id === 'escort').locked, true);
  state.record.jobs = 4;
  tick(state, 1);
  const progress = getRankProgress(state);
  assert.equal(progress.rank, 'E');
  assert.ok(progress.merits.every(m => m.ok) && progress.examReady);
  const exam = state.petitions.find(p => p.questId === 'escort' && p.important);
  assert.ok(exam, 'the association sends the exam as an important letter');
  state.members.forEach(m => { m.level = 6; });
  complete(state, dispatch(state, 'escort', party, 'cautious'));
  assert.equal(state.rank, 'E');
  assert.equal(state.progress.offer?.cards.length, 3, 'a rank-up offers three guild policies');
  assert.ok(state.progress.chests.some(c => c.tier === 'gold'), 'and a gold chest');
  // Easy work far below the guild's rank earns little renown.
  state.rank = 'C';
  assert.equal(renownFactor(state, QUESTS.find(q => q.id === 'patrol')), 0.1);
  const b = getRankProgress(state);
  assert.equal(b.rank, 'B');
  assert.equal(b.future, false, 'B is playable: the forest heart is its exam');
  assert.equal(b.exam, 'heart');
  state.rank = 'B';
  assert.equal(getRankProgress(state).future, true, 'A waits for the next chapter');
});

test('fame draws newcomers to town; rookies register on arrival with no fee, famous adventurers wait for the right guild', () => {
  const state = createGame(31);
  state.policy.registration = true;
  state.gold = 3000;
  state.applicantClock = 1;
  tick(state, 2);
  const applicant = state.applicants[0];
  assert.ok(applicant, 'someone sets out for the guild');
  assert.ok(applicant.bio?.name && applicant.rookieId, 'early newcomers are rookies');
  const gold = state.gold;
  tick(state, applicant.eta + 1);
  const rookie = state.members.find(m => m.id === applicant.rookieId);
  assert.ok(rookie, 'they sign the book at the counter by themselves');
  assert.ok(!state.applicants.includes(applicant));
  assert.ok(state.gold >= gold - 1, 'nobody is paid to join');
  assert.equal(rookie.regular, false, 'a newcomer is not a regular yet');
  assert.ok(getMemberStats(state, rookie).trait, 'rookies have a trait like everyone else');
  assert.deepEqual(deserializeGame(serializeGame(state)), state);
  // A full town turns newcomers away until there is more lodging.
  state.applicants = [];
  while (state.members.length < getLodging(state).cap) addApplicant(state, null, { status: 'waiting' }) && tick(state, 0.01);
  state.applicantClock = 0;
  tick(state, 60);
  assert.equal(state.applicants.length, 0, 'no room, nobody comes');
  // Five jobs done with the guild makes a rookie one of its named regulars.
  rookie.missionsDone = 5;
  // Famous adventurers wait for renown and a guild that suits them.
  state.rank = 'C';
  assert.match(getAvailableRecruits(state).find(m => m.id === 'yuki').reason, /ชื่อเสียง/);
  state.rep = 500;
  assert.match(getAvailableRecruits(state).find(m => m.id === 'yuki').reason, /ชั้นตำรา/);
  assert.equal(getAvailableRecruits(state).find(m => m.id === 'poppy').available, false);
  const data = JSON.parse(serializeGame(state)); delete data.checksum; data.members.find(m => m.id === rookie.id).bio.trait = 'cheater';
  assert.throws(() => deserializeGame(JSON.stringify(data)));
});

test('the village market moves with supply, shops restock from it, and adventurers buy, use and mend their own gear', () => {
  const state = createGame(41);
  state.gold = 8000; state.wood = 300; state.stone = 300; state.herb = 100;
  const price = marketPrice(state, 'herb');
  const sold = tradeQuote(state, 'herb', true).gold;
  assert.equal(act(state, 'sellMaterial', { key: 'herb' }).ok, true);
  assert.ok(marketPrice(state, 'herb') < price, 'selling floods the market');
  assert.ok(tradeQuote(state, 'herb', true).gold < sold, 'the next lot fetches less');
  assert.ok(tradeQuote(state, 'herb', false).gold > tradeQuote(state, 'herb', true).gold, 'buying back costs more than selling');
  assert.equal(act(state, 'buildProject', { projectId: 'shop' }).ok, true);
  assert.equal(act(state, 'buildProject', { projectId: 'smithy' }).ok, true);
  assert.ok(state.shops.ration > 0 && state.shops.potion > 0, 'the shop stocks supplies from market herbs');
  assert.ok(state.shops.gear['oak-blade'] > 0, 'the smithy forges first-tier gear from market wood and stone');
  // Wages buy supplies and gear; nobody spends the guild's gold.
  const mira = state.members.find(m => m.id === 'mira'), gold = state.gold;
  mira.purse = 300;
  tick(state, 10);
  assert.equal(mira.equipment.weapon, 'oak-blade');
  assert.equal(mira.pack.ration, 1);
  assert.equal(mira.pack.potion, 1);
  assert.ok(state.gold >= gold, 'the guild pays nothing for members\' own purchases');
  // A journey uses the ration and wears the blade.
  const mission = dispatch(state, 'patrol', party);
  assert.deepEqual(mission.rations, ['mira']);
  assert.equal(mira.pack.ration, 0);
  complete(state, mission);
  assert.ok(mira.wear.weapon < 100);
  mira.wear.weapon = 10;
  const worn = getMemberStats(state, mira);
  mira.purse = 200;
  mira.shopClock = 0;
  tick(state, 1);
  assert.equal(mira.wear.weapon, 100, 'the smithy mends worn gear for a fee');
  assert.ok(getMemberStats(state, mira).condition.gear > worn.condition.gear && getMemberStats(state, mira).efficiency > worn.efficiency, 'mended gear lifts how well they work');
  assert.deepEqual(deserializeGame(serializeGame(state)).shops, state.shops);
});

test('adventurers rank up by level, merit points and an exam at the arena; ranks limit the work they can take', () => {
  const state = createGame(51);
  state.gold = 5000; state.wood = 300; state.stone = 300;
  const mira = state.members.find(m => m.id === 'mira');
  assert.equal(mira.rank, 'F');
  // Rank F can take F and E work, not D.
  state.rank = 'D';
  assert.match(previewMission(state, 'crystals', ['mira']).reason, /แรงค์/);
  state.rank = 'F';
  mira.level = 3; mira.points = 30; mira.purse = 100;
  assert.match(getAdventurerRank(state, mira).needs.join(), /สนามสอบ/, 'exams need an arena');
  assert.equal(act(state, 'buildProject', { projectId: 'arena' }).ok, true);
  const info = getAdventurerRank(state, mira);
  assert.equal(info.eligible, true);
  assert.equal(act(state, 'rankExam', { memberId: 'mira' }).ok, true, 'members sign up for the next round');
  assert.equal(mira.purse, 70, 'the member pays the exam fee from their own wages');
  assert.equal(act(state, 'rankExam', { memberId: 'mira' }).ok, false, 'one seat per round');
  assert.ok(state.exams.queue.some(q => q.id === 'mira'));
  assert.deepEqual(deserializeGame(serializeGame(state)).exams, state.exams);
  // The round starts on the arena's schedule and everyone sits it together.
  state.exams.next = state.elapsed + 1;
  tick(state, 2);
  assert.equal(mira.errand?.kind, 'exam');
  assert.ok(state.exams.session.examinees.some(e => e.id === 'mira'));
  assert.equal(previewMission(state, 'patrol', ['mira']).ok, false, 'away at the arena');
  assert.deepEqual(deserializeGame(serializeGame(state)).exams, state.exams);
  const examinee = state.exams.session.examinees.find(e => e.id === 'mira');
  assert.equal(examinee.scores.length, 3, 'three trials');
  tick(state, 61);
  assert.equal(mira.errand, null);
  assert.equal(state.exams.session, null);
  assert.ok(state.exams.last.results.some(r => r.id === 'mira'), 'results are read out');
  assert.equal(mira.rank === 'E', examinee.pass, 'the scores and the result agree');
  assert.ok(mira.rank === 'E' || mira.examReadyAt > state.elapsed, 'passed, or retries next round');
  // Merit points: work above one's rank counts more.
  const before = mira.points;
  mira.rank = 'F';
  complete(state, dispatch(state, 'patrol', party));
  assert.equal(mira.points - before, 10);
  // Lessons at the dojo: paid from the purse, limited per day.
  assert.equal(act(state, 'buildProject', { projectId: 'dojo' }).ok, true);
  const lune = state.members.find(m => m.id === 'lune');
  lune.purse = 100; lune.energy = 100; lune.injury = 0; lune.errand = null;
  const xp = lune.xp + lune.level * 1000;
  assert.equal(act(state, 'takeLesson', { memberId: 'lune' }).ok, true);
  assert.equal(act(state, 'takeLesson', { memberId: 'lune' }).ok, false);
  tick(state, 31);
  assert.ok(lune.xp + lune.level * 1000 > xp);
  // Tier-3 classes open at adventurer rank B.
  lune.class = 'sage';
  assert.match(classChoices(state, lune)[0].reason, /แรงค์ B/);
});

test('the living world: members hunt in real time, carry the fallen home, sell loot and pay the guild its share', () => {
  const state = createLivingGame(61);
  assert.ok(state.policy.memberHunting);
  let left = false;
  for (let t = 0; t < 40 && !left; t++) { tick(state, 3); left = state.world.hunters.some(h => h.kind === 'member'); }
  assert.ok(left, 'rested members head out to hunt on their own');
  const hunter = state.world.hunters.find(h => h.kind === 'member');
  assert.equal(hunter.zone, 'meadow', 'rank F members hunt the meadow');
  assert.equal(previewMission(state, 'patrol', [hunter.id]).ok, false, 'a hunter is away from the guild');
  assert.ok(state.world.monsters.filter(m => m.zone === 'meadow').length >= 8, 'the meadow is stocked');
  assert.deepEqual(deserializeGame(serializeGame(state)).world.hunters.length, state.world.hunters.length, 'a hunt survives save and load');
  const gold = state.gold, kills = state.world.kills;
  for (let t = 0; t < 120 && state.world.hunters.some(h => h.id === hunter.id); t++) tick(state, 5);
  assert.ok(!state.world.hunters.some(h => h.id === hunter.id), 'the party comes home');
  assert.ok(state.world.kills > kills, 'monsters were fought and beaten');
  assert.ok(state.ledger.some(e => /ส่วนแบ่งการล่า/.test(e.label || e.reason || e.text || '')) || state.trade.stats.bought > 0, 'the guild took its share or bought the loot');
  assert.ok(gold > 0);
  const member = state.members.find(m => m.id === hunter.id);
  assert.ok(member.purse > 0, 'the member keeps most of what they earned');
  // A knocked-out hunter is carried home by a friend, or by porters from the guild.
  const s2 = createLivingGame(62);
  for (let t = 0; t < 40 && !s2.world.hunters.length; t++) tick(s2, 3);
  const h2 = s2.world.hunters.find(h => h.kind === 'member');
  for (let t = 0; t < 40 && h2.mode === 'go'; t++) tick(s2, 2);
  h2.hp = 1;
  const monster = s2.world.monsters.find(m => !m.dead && m.zone === h2.zone);
  Object.assign(monster, { x: h2.x, y: h2.y, hx: h2.x, hy: h2.y, target: h2.id, cd: 0 });
  const potionsBefore = s2.members.find(m => m.id === h2.id).pack.potion;
  for (let t = 0; t < 200 && h2.mode !== 'carried'; t++) tick(s2, .5);
  assert.equal(h2.mode, 'carried', 'they fall and are carried, never killed');
  assert.equal(potionsBefore, 0);
  for (let t = 0; t < 200 && s2.world.hunters.some(h => h.id === h2.id); t++) tick(s2, 2);
  const fallen = s2.members.find(m => m.id === h2.id);
  assert.ok(fallen.injury >= 25, 'home again, they need the infirmary');
});

test('adventurers live in town: they rest in their rooms, stroll to the market, drop in at the guild; old free adventurers register', () => {
  const state = createLivingGame(71);
  state.policy.memberHunting = false;
  tick(state, 120);
  const places = new Set(state.members.map(m => m.town?.at));
  assert.ok(state.members.every(m => m.town), 'everyone at home is somewhere in town');
  assert.ok(places.size >= 2, 'they are spread over town, their rooms and the guild hall');
  const out = state.members.find(m => m.town.at === 'street');
  if (out) assert.ok(Math.abs(out.town.x) < 60 && Math.abs(out.town.y) < 60);
  assert.deepEqual(deserializeGame(serializeGame(state)).members.map(m => m.town?.at), state.members.map(m => m.town?.at));
  // A save from before registration: free adventurers at the inn become registered rookies.
  const data = JSON.parse(serializeGame(state)); delete data.checksum;
  data.version = 5;
  data.world.free = [{ id: 'fa-3', name: 'ภู', class: 'archer', trait: 'ขยัน', hair: '#5b4637', description: 'x', level: 4, xp: 0, rank: 'E', energy: 90, purse: 55, potions: 1, affinity: 10, mode: 'town', x: 0, y: 12, tx: 0, ty: 12, wait: 0 }];
  const migrated = deserializeGame(JSON.stringify(data));
  const joined = migrated.members.find(m => m.name === 'ภู');
  assert.ok(joined && /^r-\d+$/.test(joined.id) && joined.rank === 'E' && joined.purse === 55);
  assert.equal(migrated.world.free.length, 0);
  assert.ok(migrated.members.filter(m => m.id !== joined.id).every(m => m.regular), 'everyone hired before registration is a regular');
  assert.doesNotThrow(() => serializeGame(migrated));
});

test('the storyteller paces small happenings, choices and big events, and big events play out in the world', () => {
  const state = createGame(81);
  state.completedQuests.patrol = 1;
  // Nothing happens in the first minutes, then small happenings come a few minutes apart.
  tick(state, 120);
  assert.equal(state.director.history.length, 0, 'a quiet start');
  tick(state, 300);
  assert.ok(state.director.history.length >= 1, 'a small happening arrived');
  // A choice waits for the player; answering applies its effect.
  state.director.nextDecision = state.elapsed; state.director.nextMinor = state.elapsed + 999; state.director.nextMajor = state.elapsed + 9999;
  tick(state, 1);
  const pending = state.director.pending;
  assert.ok(pending && pending.choices.length >= 2, 'a decision is waiting');
  assert.equal(act(state, 'resolveEvent', { choiceId: 'nope' }).ok, false);
  const restored = deserializeGame(serializeGame(state));
  assert.equal(restored.director.pending.id, pending.id, 'a waiting choice survives save and load');
  assert.equal(act(state, 'resolveEvent', { choiceId: pending.choices[0].id }).ok, true);
  assert.equal(state.director.pending, null);
  assert.equal(state.director.history[0].id, pending.id);
  // An unanswered choice settles itself on its gentlest option.
  state.director.nextDecision = state.elapsed; tick(state, 1);
  assert.ok(state.director.pending);
  tick(state, 310);
  assert.ok(!state.director.pending || state.director.pending.id !== pending.id, 'the old choice settled');
  // A raid: monsters walk in from the west road and the people at home go out to meet them.
  const raid = createGame(82);
  raid.completedQuests.patrol = 1; raid.elapsed = 1000;
  Object.assign(raid.director, { nextMajor: 1000, nextDecision: 9999, nextMinor: 9999, history: [{ id: 'boss' }, { id: 'celebrity' }, { id: 'storm' }] });
  raid.members.forEach(m => { m.level = 8; m.energy = 100; });
  tick(raid, 1);
  assert.equal(raid.director.active?.id, 'raid');
  assert.ok(raid.world.monsters.filter(m => m.raid).length >= 5, 'raiders on the road');
  assert.ok(raid.world.hunters.some(h => h.party.startsWith('pt-defend')), 'defenders rally');
  assert.ok(raid.director.alert?.watch === 'raid', 'the player is told and can watch');
  for (let t = 0; t < 150 && raid.director.active; t++) tick(raid, 2);
  assert.equal(raid.director.active, null, 'the raid ends');
  assert.ok(!raid.world.monsters.some(m => m.raid), 'no raiders are left behind');
  assert.equal(raid.director.history[0].id, 'raid');
  // A world boss draws hunters who may enter its ground; beating it pays the guild.
  const boss = createLivingGame(83);
  boss.completedQuests.patrol = 1; boss.rank = 'E'; boss.elapsed = 1000;
  Object.assign(boss.director, { nextMajor: 1000, nextDecision: 9999, nextMinor: 9999, history: [{ id: 'raid' }, { id: 'celebrity' }, { id: 'storm' }] });
  tick(boss, 1);
  const keeper = boss.world.monsters.find(m => m.boss);
  assert.equal(boss.director.active?.id, 'boss');
  assert.equal(keeper.zone, 'woods');
  const gold = boss.gold;
  keeper.hp = 1;
  boss.members.forEach(m => { m.level = 9; m.rank = 'E'; m.energy = 100; });
  for (let t = 0; t < 200 && boss.world.monsters.includes(keeper); t++) tick(boss, 2);
  assert.ok(!boss.world.monsters.includes(keeper), 'the boss falls');
  assert.equal(boss.director.active, null);
  assert.ok(boss.gold > gold, 'the association pays a bounty');
  assert.equal(boss.director.history[0].outcome, 'สำเร็จ');
});

test('routine petitions go up on the board by themselves unless the player turns that off; important letters still wait', () => {
  const state = createLivingGame(91);
  state.policy.memberHunting = false;
  const routine = addPetition(state, 'patrol', { status: 'waiting' });
  tick(state, 10);
  assert.equal(routine.status, 'waiting', 'the player has a moment to set the pay first');
  tick(state, 20);
  assert.equal(routine.status, 'posted');
  assert.equal(act(state, 'setPolicy', { autoPetitions: false }).ok, true);
  const manual = addPetition(state, 'patrol', { status: 'waiting' });
  tick(state, 40);
  assert.equal(manual.status, 'waiting');
  assert.equal(deserializeGame(serializeGame(state)).policy.autoPetitions, false);
});

test('hunters sell parts and treasures at the guild counter; the guild makes goods, sells to town, by caravan or to collectors', async () => {
  const { storeUsed, caravanLoad } = await import('../src/trade.js');
  const state = createGame(101);
  state.gold = 5000;
  // A member comes home with parts and a treasure: the guild pays them and keeps the loot.
  const m = state.members[0];
  state.world.hunters.push({ id: m.id, kind: 'member', zone: 'meadow', party: 'pt-x', mode: 'return', x: -2, y: 13, path: [], hp: 50, maxHp: 50, power: 10, cls: 'warrior', atkCd: 0, skillCd: 0, guard: 0, target: null, carrying: null, carriedBy: null,
    bag: { gold: 0, herb: 0, wood: 0, stone: 0, kills: 3, merit: 0, parts: { pelt: 6, jelly: 3 }, treasures: ['oldCoin'] }, quota: 9 });
  const purse = m.purse || 0, gold = state.gold;
  tick(state, 2);
  assert.ok(!state.world.hunters.some(h => h.id === m.id), 'home');
  assert.equal(state.trade.store.pelt, 6); assert.equal(state.trade.store.jelly, 3);
  assert.equal(state.trade.treasures[0].id, 'oldCoin');
  assert.ok(m.purse > purse && state.gold < gold, 'the guild paid for the loot');
  // A low buying price keeps more margin; free adventurers then sell elsewhere unless they love the guild.
  assert.equal(act(state, 'setBuyRate', { rate: 'low' }).ok, true);
  assert.equal(act(state, 'setBuyRate', { rate: 'nope' }).ok, false);
  act(state, 'setBuyRate', { rate: 'fair' });
  // Selling to the town's merchants: each unit a little cheaper than the last.
  const before = state.gold;
  assert.equal(act(state, 'wholesale', { id: 'jelly', count: 'all' }).ok, true);
  assert.ok(state.gold > before && !state.trade.store.jelly);
  // A tannery turns three hides into leather goods worth more than the hides.
  state.village.tannery = 1;
  tick(state, 60);
  assert.ok(state.trade.goods.leather?.count >= 1, 'leather goods made');
  assert.ok(state.trade.goods.leather.value / state.trade.goods.leather.count > 3 * 12, 'goods are worth more than their parts');
  // Townsfolk buy goods at the end of the day.
  state.trade.goods.leather.count += 2; state.trade.goods.leather.value += 120;
  const day = state.day, g2 = state.gold;
  tick(state, 240 - state.clock + 1);
  assert.ok(state.day > day && state.gold > g2 - 400, 'the day turns');
  assert.ok(state.ledger.some(e => e.text === 'ขายสินค้าให้ชาวเมือง'), 'goods sold to the town');
  // Caravan: needs the yard, takes the contract first, comes back richer.
  assert.equal(act(state, 'sendCaravan', {}).ok, false);
  state.village.caravan = 1; state.trade.store.crystal = 20;
  tick(state, 1);
  assert.ok(state.trade.contract, 'a contract from the capital');
  const plan = caravanLoad(state);
  assert.ok(plan.count > 0 && plan.expect > plan.value);
  assert.equal(act(state, 'sendCaravan', { escort: true }).ok, true);
  assert.ok(storeUsed(state.trade) < 20);
  const g3 = state.gold;
  assert.ok(deserializeGame(serializeGame(state)).trade.caravan, 'a caravan on the road survives save and load');
  tick(state, 370);
  assert.equal(state.trade.caravan, null);
  assert.ok(state.ledger.some(e => e.text === 'คาราวานกลับจากเมืองหลวง') && state.gold > g3);
  // Treasures: display for renown, or sell to a collector.
  const rep = state.rep;
  state.trade.treasures = [{ id: 'jadeIdol', from: 'x' }, { id: 'oldCoin', from: 'y' }];
  assert.equal(act(state, 'displayTreasure', { index: 0 }).ok, true);
  assert.ok(state.rep > rep && state.trade.displayed.length === 1);
  const g4 = state.gold;
  assert.equal(act(state, 'sellTreasure', { index: 0 }).ok, true);
  assert.equal(state.gold, g4 + 120);
  // The auction house sells lots each morning, usually above the collector's price when the town is rich.
  state.trade.treasures = [{ id: 'jadeIdol', from: 'x' }];
  assert.equal(act(state, 'auctionTreasure', { index: 0 }).ok, false, 'needs an auction house');
  state.village.auction = 1; state.rep = 1500;
  for (let i = 0; i < 6; i++) state.village.homes['h' + (i % 3)] = { tier: 3, progress: 0 };
  assert.equal(act(state, 'auctionTreasure', { index: 0 }).ok, true);
  assert.equal(state.trade.auction.length, 1);
  assert.equal(deserializeGame(serializeGame(state)).trade.auction.length, 1, 'lots survive save and load');
  const g5 = state.gold;
  tick(state, 240 - state.clock + 1);
  assert.equal(state.trade.auction.length, 0);
  const sale = state.ledger.find(e => e.text === 'ประมูลสมบัติ');
  assert.ok(sale && sale.gold > 380, `the auction beat the collector (${sale?.gold})`);
  assert.ok(state.gold > g5 - 500);
});

test('engine modules use plain named imports so the single-file export can bundle them', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  for (const file of (await readdir(new URL('../src/', import.meta.url))).filter(f => f.endsWith('.js'))) {
    const source = await readFile(new URL('../src/' + file, import.meta.url), 'utf8');
    assert.ok(!/import\s*\{[^}]*\bas\b[^}]*\}/.test(source), `${file} renames an import, which export.mjs cannot bundle`);
    assert.ok(!/^export\s*\{/m.test(source), `${file} re-exports a list, which export.mjs cannot bundle`);
  }
});

test('the village grows its own footpaths: new buildings get a winding path to the road that wears into a road', async () => {
  const { villageBuildings, pathTier } = await import('../src/town.js');
  const state = createGame(111);
  state.gold = 99999; state.wood = 999; state.stone = 999; state.village.prosperity = 300;
  for (const id of ['house', 'shop', 'dojo', 'tannery']) assert.equal(act(state, 'buildProject', { projectId: id }).ok, true);
  tick(state, 10);
  const buildings = villageBuildings(state);
  for (const b of buildings) {
    const p = state.village.paths[b.key];
    assert.ok(p && p.pts.length >= 2, `${b.key} has a path`);
    // No point of the path runs through a building.
    for (const [x, y] of p.pts.slice(1, -1)) assert.ok(!buildings.some(o => x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h), `${b.key} path avoids buildings`);
  }
  const dojo = state.village.paths.dojo;
  assert.ok(dojo.pts.length > 3, 'a far building gets a long, winding path');
  assert.equal(pathTier(dojo.wear, 1), 'trail', 'new paths start as trails');
  tick(state, 1200);
  assert.ok(state.village.paths.dojo.wear > dojo.wear || state.village.paths.dojo.wear === 1, 'feet wear them in');
  assert.equal(pathTier(0.9, 4), 'cobble'); assert.equal(pathTier(0.9, 2), 'dirt');
  const back = deserializeGame(serializeGame(state));
  assert.deepEqual(back.village.paths.dojo.pts, state.village.paths.dojo.pts, 'paths survive save and load');
});

test('homes grow by themselves when what families need is nearby; village levels need people; buildings can move and turn', async () => {
  const { homeStatus, population, villageBuildings, doorOf } = await import('../src/town.js');
  const state = createGame(121);
  state.gold = 99999; state.wood = 999; state.stone = 999;
  assert.equal(population(state), 9, 'three cottages of three');
  // Without food nearby a cottage waits; with a shop next door it grows into a wooden house.
  const before = homeStatus(state, 'h0', 1);
  assert.deepEqual(before.missing, before.met.food ? [] : ['food']);
  assert.equal(act(state, 'buildProject', { projectId: 'shop', spot: { x: 1, y: 25 } }).ok, true);
  tick(state, 170);
  assert.equal(state.village.homes.h0.tier, 1, 'the cottage became a wooden house');
  assert.ok(population(state) > 9);
  assert.ok(state.log.some(e => /ขยายเป็นบ้านไม้/.test(e.text)));
  // A village level needs people as well as prosperity.
  state.village.prosperity = 3000;
  assert.ok(getVillageInfo(state).level < 4, 'not enough people for a town yet');
  // Buildings can be turned: the footprint swaps and the door (and its path) moves to the other face.
  const shop = villageBuildings(state).find(b => b.key === 'shop');
  assert.equal(act(state, 'moveVillageBuilding', { key: 'shop', spot: { x: shop.x, y: shop.y, rot: 1 } }).ok, true);
  const turned = villageBuildings(state).find(b => b.key === 'shop');
  assert.equal(turned.rot, 1); assert.equal(turned.w, shop.h); assert.equal(turned.h, shop.w);
  assert.ok(doorOf(turned).x > turned.x + turned.w, 'the door faces east now');
  tick(state, 2);
  assert.ok(state.village.paths.shop.pts.length >= 2, 'a new path grows from the new door');
  assert.equal(act(state, 'moveVillageBuilding', { key: 'shop', spot: { x: 6, y: 5 } }).ok, false, 'not on the guild');
  assert.equal(act(state, 'moveVillageBuilding', { key: 'market', spot: { x: 30, y: 30, rot: 1 } }).ok, false, 'not built');
  const back = deserializeGame(serializeGame(state));
  assert.equal(back.village.lots.shop.rot, 1);
  assert.equal(back.village.homes.h0.tier, 1);
});

test('the guild master can step out, walk, fight monsters, dodge, get knocked out and rest at the guild', () => {
  const state = createGame(131);
  assert.equal(act(state, 'heroMode', { on: true }).ok, true);
  const hero = state.hero;
  assert.ok(hero.active);
  // Walk west along the road toward the meadow.
  const start = hero.x;
  hero.input = { dx: -1, dy: 0 };
  tick(state, 2);
  assert.ok(hero.x < start - 5, 'the master walks');
  // Stand next to a monster and swing until it falls: coins go into the master's pack, the master gets experience.
  tick(state, 1);
  const m = state.world.monsters.find(x => !x.dead && x.zone === 'meadow');
  Object.assign(hero, { x: m.x - 0.8, y: m.y, fx: 1, fy: 0 });
  hero.input = { attack: true };
  const gold = state.gold, xp = hero.xp;
  for (let i = 0; i < 40 && !m.dead; i++) { hero.x = m.x - 0.8; hero.y = m.y; tick(state, 0.25); }
  assert.ok(m.dead, 'the swing kills the monster');
  assert.ok(hero.pack.gold > 0 && (hero.xp > xp || hero.level > 1), 'coins in the pack, experience for the master');
  // A dodge makes the master untouchable for a moment.
  hero.input = { dash: true, dx: 1, dy: 0 };
  tick(state, 0.05);
  assert.ok(hero.dash > 0 && hero.dashCd > 0);
  // Knocked out, then carried home to rest at the guild.
  hero.input = {}; hero.hp = 1; hero.dash = 0;
  const foe = state.world.monsters.find(x => !x.dead && x.zone === 'meadow');
  Object.assign(foe, { x: hero.x + 0.3, y: hero.y, hx: hero.x, hy: hero.y, target: 'hero', cd: 0 });
  for (let i = 0; i < 20 && !(hero.down > 0); i++) tick(state, 0.25);
  assert.ok(hero.down > 0, 'knocked out');
  tick(state, 5);
  assert.equal(hero.down, 0); assert.ok(hero.hp > 0 && Math.abs(hero.y - 11) < 6, 'back at the guild');
  assert.equal(hero.active, false, 'resting, not out in the field');
  assert.ok(hero.injuredUntil > state.elapsed);
  const back = deserializeGame(serializeGame(state));
  assert.equal(back.hero.level, hero.level); assert.equal(back.hero.injuredUntil, hero.injuredUntil);
  state.elapsed = hero.injuredUntil + 1;
  assert.equal(act(state, 'heroMode', { on: true }).ok, true, 'out again once healed');
});

test('quests play out in real time: the party walks to the site, fights waves and a boss, and a wiped party is carried home as a failure', () => {
  const state = createGame(141);
  state.members.forEach(m => { m.level = 6; m.energy = 100; });
  const mission = dispatch(state, 'patrol');
  assert.ok(mission.realtime && mission.rt, 'the expedition starts at once');
  assert.ok(state.world.hunters.filter(h => h.party === mission.id).length === party.length, 'each member walks out');
  for (let i = 0; i < 400 && mission.rt.stage === 'go'; i++) tick(state, 0.25);
  assert.equal(mission.rt.stage, 'fight');
  assert.ok(state.world.monsters.some(m => m.quest === mission.id), 'the first wave waits at the site');
  complete(state, mission);
  assert.equal(mission.status, 'completed');
  assert.ok(!state.world.monsters.some(m => m.quest === mission.id), 'no quest foes are left behind');
  // A hopeless fight: everyone falls, porters bring them home and the job goes back on the board.
  const weak = createGame(142);
  weak.members.forEach(m => { m.level = 1; m.energy = 100; });
  const m2 = dispatch(weak, 'patrol', ['lune']);
  for (let i = 0; i < 400 && m2.rt.stage !== 'fight'; i++) tick(weak, 0.25);
  for (const foe of weak.world.monsters.filter(x => x.quest === m2.id)) { foe.atk = 500; foe.hp = foe.maxHp = 5000; }
  complete(weak, m2);
  assert.equal(m2.status, 'failed');
  assert.ok(weak.members.find(m => m.id === 'lune').injury >= 25, 'carried home hurt');
});

test('every job fights its own way: chain lightning jumps, snares slow, a saint lifts a fallen friend', async () => {
  const { JOB_COMBAT } = await import('../src/content.js');
  const jobs = Object.keys(JOB_COMBAT);
  assert.equal(jobs.length, 20, 'all twenty jobs have a combat style');
  assert.equal(new Set(jobs.map(j => JOB_COMBAT[j].skill)).size, 20, 'and each has its own skill');
  const run = (job, setup) => {
    const state = createLivingGame(151);
    state.policy.memberHunting = false;
    const m = state.members[0]; m.class = job; m.energy = 100;
    tick(state, 1);
    const foes = state.world.monsters.filter(x => !x.dead && x.zone === 'meadow').slice(0, 4);
    const hunter = { id: m.id, kind: 'member', zone: 'meadow', party: 'pt-t', mode: 'hunt', x: foes[0].x - 1, y: foes[0].y, path: [], hp: 100, maxHp: 100, power: 40, cls: 'mage', job, atkCd: 9, skillCd: 0, guard: 0, target: foes[0].id, carrying: null, carriedBy: null, bag: { gold: 0, herb: 0, wood: 0, stone: 0, kills: 0, merit: 0, parts: {}, treasures: [] }, quota: 99 };
    foes.forEach((f, i) => Object.assign(f, { x: hunter.x + 1 + i * .3, y: hunter.y + (i % 2) * .4, hx: hunter.x + 1, hy: hunter.y, hp: 999, maxHp: 999 }));
    state.world.hunters.push(hunter);
    setup?.(state, hunter);
    tick(state, 0.25);
    return { state, foes, hunter };
  };
  const chain = run('stormcaller');
  assert.ok(chain.foes.filter(f => f.hp < 999).length >= 3, 'chain lightning hits several foes');
  const snare = run('ranger');
  assert.ok(snare.foes[0].slow > 0, 'a snared foe is slowed');
  const saint = run('saint', (state, h) => {
    const friend = { ...h, id: state.members[1].id, job: 'warrior', cls: 'warrior', mode: 'down', hp: 0, target: null, skillCd: 9 };
    state.world.hunters.push(friend); h.hp = 55;
  });
  const lifted = saint.state.world.hunters.find(x => x.id === saint.state.members[1].id);
  assert.ok(lifted && lifted.mode !== 'down' && lifted.hp > 0, 'the miracle lifts the fallen friend');
});

test('late game: frontier gear needs monster parts, workshops keep forge parts, the trophy hall and monument pay back daily', () => {
  const state = createGame(91);
  state.rank = 'B'; state.gold = 20000; state.stone = 200; state.wood = 200; state.herb = 100;
  const bench = state.facilities.find(f => f.type === 'workshop');
  if (bench) bench.level = 3; else state.facilities.push({ id: 'ws-test', type: 'workshop', x: 0, y: 0, rotation: 0, level: 3 });
  assert.match(act(state, 'craft', { equipmentId: 'drake-blade' }).message, /เกล็ดมังกรหิน/, 'parts are checked');
  state.trade.store = { drakeScale: 3, magma: 1 };
  assert.equal(act(state, 'craft', { equipmentId: 'drake-blade' }).ok, true);
  assert.deepEqual(state.trade.store, {}, 'the parts are used up');
  assert.equal(state.inventory['drake-blade'], 1);
  // Workshops never turn forge parts into everyday goods.
  state.village.tannery = 1; state.trade.store = { scale: 6 };
  tick(state, 30);
  assert.equal(state.trade.store.scale, 6);
  // Trophy hall and monument: daily tickets, renown and morale.
  state.upgrades.trophyHall = 2; state.village.monument = 1;
  const rep = state.rep, gold = state.gold;
  tick(state, 240);
  assert.ok(state.rep >= rep + 3, 'the monument adds renown every day');
  assert.ok(state.ledger.some(e => e.text === 'ค่าเข้าชมหอเกียรติยศ' && e.gold === 60));
  assert.ok(Number.isFinite(gold));
  assert.deepEqual(deserializeGame(serializeGame(state)).upgrades, state.upgrades);
});

test('bosses fight in acts: the dragon warns before its ring of fire, calls minions and grows angry', async () => {
  const { spawnMonster, tickLife, createWorld } = await import('../src/life.js');
  const state = createGame(92);
  state.world = createWorld(1);
  const m = spawnMonster(state.world, 'emberDragon', 'q:x', { x: 0, y: 0 }, { quest: 'x', questBoss: true, hp: 1000, maxHp: 1000, atk: 10 });
  state.world.monsters.push(m);
  const ctx = { zoneOpen: () => false, freeTarget: () => 0, door: () => ({ x: 5, y: 5 }), log: () => {}, needsEvent: () => false, quest: () => null, freeToHunt: () => false, guildRankIndex: () => 0 };
  m.hp = 700; tickLife(state, ctx, 0.25);
  assert.equal(m.phaseName, 'วงแหวนเพลิง');
  m.hp = 450; tickLife(state, ctx, 0.25);
  assert.ok(state.world.monsters.filter(x => x.quest === 'x').length >= 3, 'minions join at half life');
  m.hp = 250; tickLife(state, ctx, 0.25);
  assert.equal(m.enraged, true);
  // The ring is announced before it lands.
  for (let i = 0; i < 20; i++) tickLife(state, ctx, 0.25);
  assert.ok(m.ringCd > 0 || m.warn > 0);
});

test('sound settings are saved and cleaned', () => {
  const state = createGame(93);
  assert.equal(state.settings.music, true);
  const data = JSON.parse(serializeGame(state)); delete data.checksum; data.settings.volume = 9; data.settings.music = false;
  const back = deserializeGame(JSON.stringify(data));
  assert.equal(back.settings.volume, 1); assert.equal(back.settings.music, false);
});

test('village objectives ask only for what the village can build at that point', async () => {
  const { GOAL_LIST } = await import('../src/goals.js');
  const state = createGame(94);
  const order = GOAL_LIST.map(g => g.id), houses = GOAL_LIST.find(g => g.id === 'houses');
  assert.ok(order.indexOf('houses') < order.indexOf('level2'));
  assert.ok(houses.check({ ...state, village: { ...state.village, houses: 99 }, villageLevel: 1 }).need <= getVillageInfo(state).maxHouses, 'a level-1 village can hold enough houses');
});

test('condition: wounds, rest, mood, gear and supplies add up to an efficiency that decides how well adventurers work', async () => {
  const { memberCondition, getEfficiencyReport, investmentGain, townComfort } = await import('../src/game.js');
  const state = createGame(5);
  const mira = state.members.find(m => m.id === 'mira');
  Object.assign(mira, { injury: 0, energy: 100, morale: 100, pack: { ration: 1, potion: 1 }, equipment: { weapon: 'oak-sword', accessory: null }, wear: { weapon: 100, accessory: 100 } });
  assert.equal(memberCondition(mira).eff, 1.2, 'everything looked after: 120%');
  const strong = getMemberStats(state, mira).power;
  Object.assign(mira, { injury: 60, energy: 20, morale: 20, pack: { ration: 0, potion: 0 } });
  mira.wear.weapon = 10;
  assert.ok(memberCondition(mira).eff < 0.8);
  assert.ok(getMemberStats(state, mira).power < strong * 0.7, 'a worn-out adventurer fights far below their best');
  // The report puts a price on each shortfall and on what a building would win back.
  const report = getEfficiencyReport(state);
  assert.ok(report.losses.length && report.losses.every(l => l.gold > 0));
  assert.ok(investmentGain(state, 'clinic').gold > 0, 'a clinic would win back gold lost to wounds');
  // The clinic heals people in town; with none, wounds close slowly.
  const slow = createGame(5), fast = createGame(5); fast.village.clinic = 2;
  for (const s of [slow, fast]) { for (const m of s.members) m.injury = 50; s.facilities = s.facilities.filter(f => f.type !== 'infirmary'); tick(s, 30); }
  assert.ok(fast.members[0].injury < slow.members[0].injury - 2);
  // Mood drifts towards how comfortable the town is.
  const comfy = townComfort(state).value;
  mira.morale = 0; tick(state, 60);
  assert.ok(mira.morale > 10 && mira.morale <= comfy + 5);
});

test('unhappy adventurers move away, the day closes with a summary, and beds are gone from the guild', () => {
  const state = createGame(6);
  for (const id of ['sera', 'toma']) { addApplicant(state, id, { status: 'waiting' }); tick(state, 0.01); }
  const gloomy = state.members.find(m => m.id === 'toma');
  gloomy.morale = 0; gloomy.regular = false;
  state.facilities = state.facilities.filter(f => !['lounge', 'kitchen'].includes(f.type));
  for (let i = 0; i < 40 && state.members.includes(gloomy); i++) { gloomy.morale = 0; tick(state, 10); }
  assert.ok(!state.members.includes(gloomy), 'gloomy for too long, they leave town');
  tick(state, DAY_LENGTH);
  const last = state.history.at(-1);
  assert.ok(last && last.left >= 1 && last.eff > 0, 'the day closes with who came, who left and how well everyone worked');
  assert.equal(act(state, 'build', { type: 'dorm', x: 8.5, y: 4.5 }).ok, false, 'no beds to build any more');
  const data = JSON.parse(serializeGame(state)); delete data.checksum;
  data.facilities.push({ id: 'room-99', type: 'dorm', x: 8.5, y: 4.5, rotation: 0, level: 1 });
  assert.ok(!deserializeGame(JSON.stringify(data)).facilities.some(f => f.type === 'dorm'), 'old beds are cleared from saves');
});

test('the guild is home: a bar that earns and restores, an appraisal table, a party table, and staff who are paid and grow', async () => {
  const { barPrice, staffStatus } = await import('../src/game.js');
  const state = createGame(9);
  state.gold = 5000; state.wood = 200; state.stone = 200;
  assert.equal(act(state, 'hireStaff', { role: 'bartender' }).ok, false, 'a bartender needs a bar to work at');
  let placed = false;
  for (let y = 4.5; y < 9.5 && !placed; y += 0.25) for (let x = 5.5; x < 12.5 && !placed; x += 0.25) placed = act(state, 'build', { type: 'bar', x, y }).ok;
  assert.ok(placed, 'the bar fits in the hall');
  assert.equal(act(state, 'hireStaff', { role: 'bartender' }).ok, true);
  assert.equal(staffStatus(state, 'bartender').level, 1);
  // A visit to the bar: the adventurer pays from their purse, the guild earns, they rest and cheer up.
  const { tickLife } = await import('../src/life.js');
  const m = state.members[0];
  Object.assign(m, { purse: 200, energy: 50, morale: 40, celebrate: true });
  const gold = state.gold, price = barPrice(state, true);
  assert.ok(price > barPrice(state), 'a celebration costs more than a quiet drink');
  m.town = { x: 0, y: 0, tx: 0, ty: 0, wait: 0, at: 'street', goal: 'guild' };
  const door = state.facilities.length && (await import('../src/game.js')).guildDoor(state);
  Object.assign(m.town, { x: door.x, y: door.y, tx: door.x, ty: door.y });
  state.policy.memberHunting = false;
  tick(state, 0.5);
  assert.equal(m.town.at, 'guild');
  assert.ok(state.gold >= gold + price - 1 && m.purse <= 200 - price + 1, 'the guild earned from the bar');
  assert.ok(m.energy > 50 && m.morale > 40);
  // Staff are paid every morning and grow more skilled every few days.
  const before = state.gold;
  tick(state, 240 * 2 + 5);
  assert.ok(state.ledger.some(e => e.text === 'เงินเดือนพนักงาน'));
  assert.equal(staffStatus(state, 'bartender').level, 2, 'two days on the job: level 2');
  assert.ok(before > 0);
  // The appraisal table buys a little under value; the party table makes self-formed teams stronger.
  for (let y = 4.5; y < 9.5; y += 0.25) for (let x = 5.5; x < 12.5; x += 0.25) if (!state.facilities.some(f => f.type === 'dispatch')) act(state, 'build', { type: 'dispatch', x, y });
  const ids = ['mira', 'finn'];
  const plain = previewMission(createGame(9), 'patrol', ids, 'balanced', { auto: true }).power;
  assert.ok(previewMission(state, 'patrol', ids, 'balanced', { auto: true }).power > plain * 1.02 || state.members.find(x => x.id === 'mira').energy < 90, 'parties formed at the table are better prepared');
  assert.deepEqual(deserializeGame(serializeGame(state)).staff, state.staff);
});

test('the intel scout warns of a raid before it comes and the raiders arrive weaker', async () => {
  const { tickDirector } = await import('../src/events.js');
  const state = createGame(12);
  state.completedQuests.patrol = 1;
  state.facilities.push({ id: 'room-80', type: 'dispatch', x: 5.5, y: 6.5, rotation: 2, level: 1 });
  state.staff = { scout: { level: 2, days: 0 } };
  state.elapsed = 1000;
  const d = state.director; d.nextMajor = 0; d.calmUntil = 0; d.nextMinor = 1e9; d.nextDecision = 1e9;
  // Storms and visitors happened lately, so the next big event is a raid or a world boss.
  d.history = [{ id: 'storm', title: '', icon: '', day: 1, outcome: '' }, { id: 'celebrity', title: '', icon: '', day: 1, outcome: '' }];
  let warned = false;
  for (let i = 0; i < 400 && !d.active; i++) { tick(state, 1); if (d.incoming) warned = true; }
  assert.ok(warned, 'the scout warns before it comes');
  assert.ok(d.active, 'then it arrives as foretold');
  if (d.active?.id === 'raid') assert.ok(state.world.monsters.filter(m => m.raid).every(m => m.maxHp < 999999));
});

test('a living town: needs against capacity, satisfaction that moves families in and out, and a party when it grows', async () => {
  const { townNeeds, townSatisfaction, getVillageInfo } = await import('../src/game.js');
  const { population, housingCapacity } = await import('../src/town.js');
  const state = createGame(14);
  const needs = townNeeds(state);
  assert.deepEqual(needs.map(n => n.id), ['lodging', 'clinic', 'bar', 'repair', 'food', 'safety']);
  assert.ok(needs.every(n => Number.isFinite(n.demand) && Number.isFinite(n.cap)));
  // Starved of food and safety, the town grows unhappy and families leave; rooms stand empty.
  state.village.houses = 8; state.village.homes = Object.fromEntries([...Array(8).keys()].map(i => ['h' + i, { tier: 2, progress: 0 }]));
  const full = housingCapacity(state);
  state.village.satisfaction = 20; state.village.raidScar = 30;
  assert.ok(townSatisfaction(state).value < 60);
  tick(state, 120);
  assert.ok(population(state) < full, 'unhappy families move away');
  assert.ok(state.today.movedOut > 0);
  // A happy town fills its homes again.
  state.village.shop = 3; state.village.market = 2; state.village.raidScar = 0; state.village.satisfaction = 90;
  for (const m of state.members) { m.energy = 100; m.injury = 0; }
  tick(state, 200);
  assert.ok(population(state) > Math.round(full * 0.75));
  // Growing a level throws a party.
  state.village.prosperity = 999999; state.village.houses = 10;
  state.village.homes = Object.fromEntries([...Array(10).keys()].map(i => ['h' + i, { tier: 3, progress: 0 }])); state.village.occupancy = 1;
  tick(state, 2);
  assert.ok(getVillageInfo(state).level > 1 && state.village.grown === getVillageInfo(state).level && state.village.celebrateAt > 0);
  assert.deepEqual(deserializeGame(serializeGame(state)).village.grown, state.village.grown);
  // The day's summary keeps the town's numbers for trends on screen.
  tick(state, DAY_LENGTH);
  assert.ok(Number.isFinite(state.history.at(-1).pop) && Number.isFinite(state.history.at(-1).sat));
});

test('dining tables seat four for a meal from the kitchen; tired adventurers eat, rested ones drink at the bar', async () => {
  const { hallSeats, mealPrice, guildDoor } = await import('../src/game.js');
  const state = createGame(15);
  state.gold = 5000; state.wood = 200; state.stone = 200; state.policy.memberHunting = false;
  let placed = false;
  for (let y = 4.5; y < 9.5 && !placed; y += 0.25) for (let x = 5.5; x < 12.5 && !placed; x += 0.25) placed = act(state, 'build', { type: 'dining', x, y }).ok;
  assert.ok(placed, 'a dining table fits in the hall');
  assert.equal(hallSeats(state).dining, 4, 'four chairs, with the kitchen there to cook');
  assert.equal(act(state, 'hireStaff', { role: 'cook' }).ok, true, 'the cook works at the kitchen');
  const m = state.members[0], door = guildDoor(state);
  Object.assign(m, { purse: 200, energy: 40, morale: 60 });
  m.town = { x: door.x, y: door.y, tx: door.x, ty: door.y, wait: 0, at: 'street', goal: 'guild' };
  const price = mealPrice(state), gold = state.gold;
  tick(state, 0.5);
  assert.equal(m.seatKind, 'dining', 'a tired adventurer sits down for a meal');
  assert.ok(m.energy > 40 && state.gold >= gold + price - 1);
});

test('one more turn: the monster book pays for first kills and full pages, chests roll a rarity, treasure sets pay out', async () => {
  const { CODEX_FAMILIES, rollChest, CHESTS } = await import('../src/progress.js');
  const { noteKill, noteTreasure } = await import('../src/game.js');
  const state = createGame(301);
  const gold = state.gold, meadow = CODEX_FAMILIES.find(f => f.id === 'meadow');
  // The book counts kills from anywhere: the living world reports them through the life context.
  for (const sp of meadow.species) { const before = state.gold; noteKill(state, sp); assert.ok(state.gold > before, 'a first kill pays a bonus'); }
  assert.ok(state.progress.families.meadow, 'a full page is marked');
  assert.ok(state.progress.chests.some(c => c.tier === 'silver'), 'and pays a silver chest');
  const again = state.gold; noteKill(state, meadow.species[0]); assert.equal(state.gold, again, 'only the first of a kind pays');
  assert.ok(state.gold > gold);
  // Chests: the tier sets the odds; a gold chest never rolls common.
  let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 200; i++) assert.notEqual(rollChest({ tier: 'gold' }, rand).rarity, 'common');
  const n = state.progress.chests.length, before = state.gold;
  const r = act(state, 'openChest', {});
  assert.ok(r.ok && state.gold > before && state.progress.chests.length === n - 1 && state.progress.opened === 1);
  assert.ok(CHESTS[r.chest.tier] && r.chest.rarity);
  // Treasure sets: the village set pays once every piece has reached the guild.
  for (const id of ['oldCoin', 'silverBangle', 'jadeIdol']) { state.trade.treasures.push({ id, from: 'test' }); noteTreasure(state, id); }
  assert.ok(state.progress.sets.village, 'the set is complete');
  assert.ok(state.progress.chests.some(c => c.tier === 'gold'), 'a full set pays a gold chest');
  // Everything survives a save.
  const back = deserializeGame(serializeGame(state));
  assert.deepEqual(back.progress.kills, state.progress.kills);
  assert.equal(back.progress.chests.length, state.progress.chests.length);
  assert.ok(back.progress.sets.village && back.progress.families.meadow);
});

test('daily goals: three every morning, a wood chest each, a silver chest for all three', () => {
  const state = createGame(302);
  tick(state, 1);
  const p = state.progress;
  assert.equal(p.daily.day, state.day); assert.equal(p.daily.list.length, 3);
  // Push every counter far past the goal.
  state.record.jobs += 99; state.world.kills += 999; state.trade.stats.bought += 99; state.record.hall += 9999; state.record.income += 99999; state.record.joined += 9; state.record.passed += 9;
  tick(state, 1);
  assert.ok(p.daily.list.every(g => g.done) && p.daily.bonus);
  assert.equal(p.chests.filter(c => c.tier === 'wood').length, 3);
  assert.equal(p.chests.filter(c => c.tier === 'silver').length, 1);
  // A new day brings new goals measured from the new morning.
  tick(state, DAY_LENGTH);
  assert.equal(p.daily.day, state.day); assert.ok(p.daily.list.every(g => !g.done));
});

test('guild policies change the numbers they promise; coming back after a while leaves a chest at the door', async () => {
  const { offerPolicies } = await import('../src/progress.js');
  const { getUpgradeCost, applicantInterval, nearGoals } = await import('../src/game.js');
  const state = createGame(303);
  const f = state.facilities[0], cost = getUpgradeCost(state, f.id).gold, wait = applicantInterval(state);
  state.progress.offer = { rank: 'E', cards: ['thrift', 'welcome', 'medic'] };
  assert.equal(act(state, 'choosePolicy', { policyId: 'broker' }).ok, false, 'only an offered card');
  assert.ok(act(state, 'choosePolicy', { policyId: 'thrift' }).ok);
  assert.ok(getUpgradeCost(state, f.id).gold < cost, 'the workshop policy makes upgrades cheaper');
  assert.equal(state.progress.offer, null);
  offerPolicies(state.progress, 'D', () => 0.5);
  assert.ok(!state.progress.offer.cards.includes('thrift'), 'a policy already kept is not offered again');
  state.progress.offer = { rank: 'D', cards: ['welcome'] }; act(state, 'choosePolicy', { policyId: 'welcome' });
  assert.ok(applicantInterval(state) < wait, 'an open door brings newcomers sooner');
  const r = act(state, 'collectIdle', { seconds: 1800 });
  assert.ok(r.ok && r.chest === 'wood', 'half an hour away: a wood chest');
  assert.ok(nearGoals(state).length <= 3);
  assert.equal(deserializeGame(serializeGame(state)).progress.policies.join(), 'thrift,welcome');
});

test('the pay plan is a real choice, and every plan still gets the guild through the whole story', async () => {
  const { simulate } = await import('./simulate.js');
  for (const plan of ['generous', 'thrifty']) for (const seed of [1, 2]) {
    const { state, metrics: m } = simulate(seed, { plan });
    const min = s => s / 60;
    assert.ok(m.finishedAt !== null && min(m.finishedAt) >= 150 && min(m.finishedAt) <= 340, `${plan} seed ${seed} finishes the frontier story in time (${min(m.finishedAt)})`);
    assert.equal(m.bankruptDays, 0, `${plan} seed ${seed} never misses upkeep`);
    assert.ok(m.failures <= m.boardRuns * 0.14, `${plan} seed ${seed} fails rarely (${m.failures}/${m.boardRuns})`);
    assert.equal(state.rank, 'B');
  }
});

test('tournament: adventurers sign up by themselves, the strongest first, more of them for a bigger purse', async () => {
  const { getFestivalEntrants } = await import('../src/game.js');
  const state = createGame(304);
  state.village.arena = 1;
  const few = getFestivalEntrants(state, 100), many = getFestivalEntrants(state, 900);
  assert.equal(few.length, 1); assert.ok(many.length > few.length && many.length <= 4);
  const r = act(state, 'startFestival', { kind: 'tournament', gold: 900, memberIds: [] });
  assert.ok(r.ok, r.message);
  assert.deepEqual(state.festivals.live.members, many, 'the guild master does not pick the fighters');
  const fighter = id => state.festivals.live.fighters.find(f => f.id === id).power;
  assert.ok(many.every((id, i) => i === 0 || fighter(id) <= fighter(many[i - 1])), 'the strongest sign up first');
});

test('the guild master in the field: gather by hand, fight with a class, carry the pack home, and lose half of it when knocked out', async () => {
  const { GATHER_NODES, HERO_CLASSES } = await import('../src/hero.js');
  const { heroNearby } = await import('../src/life.js');
  const state = createGame(401);
  tick(state, 1);
  assert.ok(act(state, 'heroMode', { on: true }).ok);
  // A spot to gather: wood goes into the pack, and the spot is spent until tomorrow.
  const node = GATHER_NODES.find(n => n.kind === 'tree'); state.hero.x = node.x + .3; state.hero.y = node.y;
  assert.equal(heroNearby(state).kind, 'gather');
  state.hero.input = { act: true }; tick(state, .3);
  assert.ok(state.hero.pack.wood >= 3, 'wood in the pack');
  assert.notEqual(heroNearby(state)?.id, node.id, 'the spot is spent for today');
  // Each class has its own skills and finisher; a perfect hit run fills the gauge.
  for (const cls of Object.keys(HERO_CLASSES)) {
    state.hero.cls = cls; state.hero.s1Cd = 0; state.hero.s2Cd = 0; state.hero.ult = 100;
    const m = state.world.monsters.find(x => !x.dead); m.x = state.hero.x + 1; m.y = state.hero.y; m.hp = m.maxHp;
    state.hero.input = { ult: true }; tick(state, .3); assert.equal(state.hero.ult < 100, true, `${cls} uses the finisher`);
    state.hero.input = { s1: true }; tick(state, .3); assert.ok(state.hero.s1Cd > 0, `${cls} skill 1`);
    state.hero.input = { s2: true }; tick(state, .3); assert.ok(state.hero.s2Cd > 0, `${cls} skill 2`);
  }
  // Home: the pack is put away.
  const wood = state.wood, carried = state.hero.pack.wood;
  assert.ok(act(state, 'heroMode', { on: false }).ok);
  assert.equal(state.wood, wood + carried); assert.equal(state.hero.pack.wood, 0);
  // Out again and knocked out: half the pack is lost and the master must rest.
  act(state, 'heroMode', { on: true }); state.hero.x += 12; state.hero.pack.wood = 10; state.hero.hp = 1;
  const m = state.world.monsters.find(x => !x.dead); m.x = state.hero.x + .5; m.y = state.hero.y; m.target = 'hero'; m.cd = 0;
  for (let i = 0; i < 40 && !(state.hero.down > 0); i++) tick(state, .25);
  assert.ok(state.hero.down > 0); assert.equal(state.hero.pack.wood, 5);
  tick(state, 5);
  assert.equal(state.hero.active, false);
  assert.equal(act(state, 'heroMode', { on: true }).ok, false, 'resting after being carried home');
  const back = deserializeGame(serializeGame(state));
  assert.equal(back.hero.cls, state.hero.cls); assert.ok(back.hero.injuredUntil > 0); assert.deepEqual(back.hero.nodes, state.hero.nodes);
});

test('the master’s class, skill book and gear: first class is free, a change needs the dojo, crafting takes rare finds', async () => {
  const state = createGame(402);
  assert.ok(act(state, 'heroClass', { cls: 'archer' }).ok, 'the first choice is free');
  assert.equal(act(state, 'heroClass', { cls: 'mage' }).ok, false, 'changing needs a dojo');
  state.village.dojo = 1; const gold = state.gold;
  assert.ok(act(state, 'heroClass', { cls: 'mage' }).ok); assert.ok(state.gold < gold, 'the dojo charges for the lesson');
  assert.equal(act(state, 'heroTree', { node: 'p1' }).ok, false, 'no points at level 1');
  state.hero.level = 3;
  assert.equal(act(state, 'heroTree', { node: 'p2' }).ok, false, 'steps come in order');
  const { heroStats } = await import('../src/life.js'), before = heroStats(state.hero).power;
  assert.ok(act(state, 'heroTree', { node: 'p1' }).ok); assert.ok(heroStats(state.hero).power > before);
  assert.equal(act(state, 'heroCraft', { gear: 'w2' }).ok, false, 'steel needs ore the master found');
  state.hero.mats.ore = 2; state.stone = 50; state.gold = 2000;
  assert.ok(act(state, 'heroCraft', { gear: 'w2' }).ok); assert.equal(state.hero.gear.weapon, 'w2'); assert.equal(state.hero.mats.ore, 0);
});

test('master jobs: golden contracts every morning, rescuing the fallen, leading a team, and companions at the master’s side', () => {
  const state = createGame(403);
  tick(state, 1);
  assert.equal(state.hero.contracts.length, 2, 'two golden contracts');
  // Rescue: a fallen adventurer is carried home by the master and gets off lightly.
  act(state, 'heroMode', { on: true });
  const door = { x: state.hero.x, y: state.hero.y }; state.hero.x += 12;
  const member = state.members[0];
  state.world.hunters.push({ id: member.id, kind: 'member', zone: 'meadow', party: 'pt-x', mode: 'down', x: state.hero.x + .5, y: state.hero.y, path: [], hp: 0, maxHp: 100, power: 10, cls: 'warrior', job: 'warrior', atkCd: 0, skillCd: 0, guard: 0, target: null, carrying: null, carriedBy: null, bag: { gold: 0, herb: 0, wood: 0, stone: 0, kills: 0, merit: 0, parts: {}, treasures: [] }, quota: 5 });
  const injury = member.injury;
  state.hero.input = { act: true }; tick(state, .3);
  assert.equal(state.hero.carry, member.id);
  state.hero.x = door.x; state.hero.y = door.y; tick(state, .3);
  assert.equal(state.hero.carry, null, 'at the guild door: delivered');
  assert.equal(state.hero.stats.rescued, 1);
  assert.ok(member.injury - injury <= 12, 'lighter wounds than waiting for the stretcher');
  // Companions walk out beside the master and are busy meanwhile.
  act(state, 'heroMode', { on: false });
  const ids = state.members.filter(m => m.id !== member.id).slice(0, 2).map(m => m.id);
  assert.ok(act(state, 'heroCompanions', { ids }).ok);
  act(state, 'heroMode', { on: true }); tick(state, .5);
  assert.deepEqual(state.world.hunters.filter(h => h.escort).map(h => h.id).sort(), [...ids].sort());
  assert.ok(ids.every(id => state.members.find(m => m.id === id).errand?.kind === 'companion'));
  act(state, 'heroMode', { on: false }); tick(state, 60);
  assert.ok(!state.world.hunters.some(h => h.escort), 'they go home with the master');
});
