import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdventurerRank, classChoices, marketPrice, tradeQuote, addApplicant, addPetition, getAvailableRecruits, getRankProgress, renownFactor, getVillageInfo, getGuildUpgradeCost, getCraftCost, createGame, tick, act, serializeGame, deserializeGame, getGuildStats, getMemberStats, getAvailableQuests, previewMission, canPlaceFacility, getRoomSize, findWalkPath, getBuildingExpansionCost } from '../src/game.js';
import { QUESTS, RANKS } from '../src/content.js';

const party = ['mira', 'finn', 'lune'];
// Villagers bring petitions over time; tests post one straight to the board when none is waiting.
function ensurePetition(state, questId) {
  if (!state.petitions.some(p => p.questId === questId && p.status === 'posted' && !p.missionId)) addPetition(state, questId, { status: 'posted' });
}
// Applicants walk to the door over time; tests seat one there directly.
function hire(state, memberId) {
  if (!state.applicants.some(a => a.memberId === memberId && a.status === 'waiting')) addApplicant(state, memberId, { status: 'waiting' });
  return act(state, 'recruit', { memberId });
}
function dispatch(state, questId = 'patrol', ids = party, policy = 'balanced') {
  ensurePetition(state, questId);
  const result = act(state, 'sendMission', { questId, memberIds: ids, policy });
  assert.equal(result.ok, true, result.message);
  return state.missions.at(-1);
}
function complete(state, mission) {
  tick(state, mission.duration * 0.45);
  if (mission.event) {
    assert.equal(mission.event.resolved, false);
    assert.equal(act(state, 'chooseEvent', { missionId: mission.id, choiceId: 'help' }).ok, true);
  }
  tick(state, mission.duration - mission.progress + 0.1);
  return mission;
}

test('starter team completes an actual encounter, earns materials, and recovers at home', () => {
  const state = createGame(99);
  const before = state.gold;
  const mission = dispatch(state);
  tick(state, 26);
  assert.equal(mission.phase, 'battle');
  assert.ok(mission.combat.enemyHp < mission.combat.enemyMaxHp);
  assert.ok(mission.combat.partyHp < mission.combat.partyMaxHp);
  assert.ok(mission.combat.log.length > 0);
  assert.equal(act(state, 'chooseEvent', { missionId: mission.id, choiceId: 'help' }).ok, true);
  tick(state, mission.duration - mission.progress);
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
    ['build', { type: 'dorm', x: 4, y: 3 }],
    ['build', { type: 'dorm', x: 1, y: 1 }],
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
  assert.equal(act(state, 'build', { type: 'dorm', x: 8.5, y: 4.5 }).ok, true);
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
  assert.equal(act(state, 'demolish', { facilityId: room.id }).ok, false);
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
  assert.equal(act(state, 'equip', { memberId: 'mira', equipmentId: null, slot: 'weapon' }).ok, true);
  assert.equal(state.inventory['oak-blade'], 1);
});

test('bankrupt guild remains playable, charges modest upkeep, and limits daily workshop chores', () => {
  const state = createGame();
  state.gold = 0;
  tick(state, 240);
  assert.equal(state.gold, 0);
  assert.equal(state.day, 2);
  assert.equal(previewMission(state, 'patrol', party).ok, true);
  complete(state, dispatch(state));
  assert.ok(state.gold >= 100);
  act(state, 'setTask', { memberId: 'noa', task: 'work' });
  const wood = state.wood;
  tick(state, 180);
  assert.equal(state.wood - wood, 2);
  assert.equal(state.members.find(member => member.id === 'noa').task, 'rest');
  assert.equal(getGuildStats(state).upkeep, 36);
  assert.ok(state.gold >= 0);
});

test('two teams require dispatch room, beds and six unique available members', () => {
  const state = createGame();
  state.rank = 'E'; state.gold = 6000; state.wood = 200; state.stone = 100;
  assert.equal(hire(state, 'sera').ok, false);
  assert.equal(act(state, 'build', { type: 'dorm', x: 8.5, y: 4.5 }).ok, true);
  assert.equal(hire(state, 'sera').ok, true);
  assert.equal(hire(state, 'toma').ok, true);
  dispatch(state);
  ensurePetition(state, 'herbs');
  assert.equal(act(state, 'sendMission', { questId: 'herbs', memberIds: ['noa', 'sera', 'toma'] }).ok, false);
  assert.equal(act(state, 'build', { type: 'dispatch', x: 5.5, y: 6.5, rotation:2 }).ok, true);
  assert.equal(getGuildStats(state).teamCap, 2);
  dispatch(state, 'herbs', ['noa', 'sera', 'toma']);
  assert.equal(getGuildStats(state).activeMissions, 2);
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
    data => { data.story.finished = true; },
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
  assert.equal(state.version, 5);
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
  assert.equal(act(state, 'build', { type: 'dorm', x: 8.5, y: 4.5 }).ok, true);
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
  tick(state, 25);
  const oldDuration = mission.duration;
  assert.equal(act(state, 'chooseEvent', { missionId: mission.id, choiceId: 'rest' }).ok, true);
  assert.equal(mission.duration, oldDuration + 18);
  assert.ok(mission.decisionBonus > 0);
});

test('room capacity creates queues and construction cannot seal existing rooms from the gate', () => {
  const state = createGame();
  state.members.forEach(member => { member.energy = 20; member.injury = 10; });
  tick(state, 1);
  const energyGains = state.members.map(member => member.energy - 20);
  assert.equal(energyGains.filter(gain => gain > 0.2).length, 2);
  assert.equal(state.members.filter(member => member.waitingReason).length, 2);
  assert.equal(state.members.filter(member => member.injury < 9.9).length, 2);
  state.members.forEach(member => { member.energy = 100; member.injury = 0; act(state, 'setTask', { memberId: member.id, task: 'train' }); });
  tick(state, 1);
  assert.equal(state.members.filter(member => member.xp > 0).length, 2);
  assert.equal(state.members.filter(member => member.waitingReason === 'รอผลัดเข้าหุ่นฝึก').length, 2);
  state.gold = 5000; state.wood = 500; state.stone = 500;
  const before = JSON.stringify(state);
  const sealed = act(state, 'build', {type:'dorm',x:8,y:8.75,rotation:1});
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
 assert.equal(act(state,'build',{type:'dorm',x:13.5,y:7}).ok,false);
 assert.equal(act(state,'expandBuilding').ok,true);assert.equal(state.gold,gold-cost.gold);assert.deepEqual(state.building,{x:5,y:4,width:10,height:8,level:1});
 assert.equal(act(state,'build',{type:'dorm',x:13.5,y:7}).ok,true);
 state.rank='E';state.gold=10000;state.wood=500;state.stone=500;
 for(const [x,y]of [[1,1],[8.25,12],[5.5,5]])assert.equal(canPlaceFacility(state,'garden',x,y).ok,false);
 assert.equal(act(state,'build',{type:'garden',x:16,y:4}).ok,true);
 assert.equal(act(state,'expand').ok,true);assert.equal(canPlaceFacility(state,'garden',23,1).ok,false,'Tree footprint remains protected after buying land');
});

test('old room saves migrate to furnishings while retaining progress and rejecting broken geometry',()=>{
 const old=createGame(27);old.version=2;delete old.building;
 const places=[[4,3],[8,3],[12,3],[4,6],[8,6],[12,6]];
 old.facilities.forEach((f,i)=>{f.x=places[i][0];f.y=places[i][1];delete f.rotation;});old.facilities[1].level=2;old.gold=2314;old.members[0].level=4;
 const migrated=deserializeGame(JSON.stringify(old));assert.equal(migrated.version,5);assert.equal(migrated.gold,2314);assert.equal(migrated.members[0].level,4);assert.equal(migrated.facilities[1].level,2);assert.equal(migrated.facilities.length,6);assert.doesNotThrow(()=>serializeGame(migrated));
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
  assert.equal(state.intro.step, 'dorm');
  assert.equal(act(state, 'build', { type: 'dorm', x: 10.5, y: 4.5 }).ok, true);
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
  const purse = party.reduce((sum, id) => sum + state.members.find(m => m.id === id).purse, 0);
  assert.equal(Math.round(purse), Math.round(petition.fee / 2));
  assert.ok(state.gold - gold >= Math.floor(petition.fee / 2) - 1);
  assert.ok(state.village.prosperity > 0);
  assert.ok(!state.petitions.some(p => p.questId === 'patrol'), 'cleared story steps stop coming as important letters');
});

test('free adventurers walk to the board and take unreserved work by themselves', () => {
  const state = createGame(11);
  const job = addPetition(state, 'herbs', { status: 'posted', plan: 'generous' });
  tick(state, 20);
  assert.equal(job.missionId, null, 'nobody picks up work without a board');
  assert.ok(state.petitions.some(p => p.important && !p.missionId), 'important work waits for the player');
  let placed = false;
  for (let y = 4.5; y < 9.5 && !placed; y += 0.25) for (let x = 5.5; x < 12.5 && !placed; x += 0.25) placed = act(state, 'build', { type: 'board', x, y }).ok;
  assert.ok(placed, 'the board fits in the starting hall');
  act(state, 'setPetition', { petitionId: job.id, reserved: true });
  tick(state, 20);
  assert.equal(job.missionId, null, 'reserved work is left for the player');
  act(state, 'setPetition', { petitionId: job.id, reserved: false });
  tick(state, 10);
  assert.ok(job.missionId, 'an idle adventurer took the job');
  const mission = state.missions.find(m => m.id === job.missionId);
  assert.equal(mission.auto, true);
  assert.ok(mission.memberIds.length >= 1 && mission.memberIds.length <= 3);
  assert.equal(previewMission(state, 'herbs', mission.memberIds).ok, false, 'the team is busy');
  assert.equal(act(state, 'recallMission', { missionId: mission.id }).ok, true);
  assert.equal(job.status, 'posted', 'recalled work returns to the board');
  assert.equal(job.missionId, null);
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
  assert.equal(state.version, 5);
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

test('a plain player finishes the demo in one to two hours, ranks climb by renown and merit, and money circulates', async () => {
  const { simulate } = await import('./simulate.js');
  for (const seed of [1, 2, 3, 4, 5]) {
    const { state, metrics: m } = simulate(seed, { freePlay: 3600 });
    const min = s => s / 60;
    assert.ok(m.finishedAt !== null, `seed ${seed} finishes the demo story`);
    assert.ok(min(m.finishedAt) >= 50 && min(m.finishedAt) <= 120, `seed ${seed} demo takes 50-120 game minutes, took ${min(m.finishedAt)}`);
    assert.ok(min(m.ranks.E) <= 20 && min(m.ranks.D) <= 60 && min(m.ranks.C) <= 105, `seed ${seed} ranks E/D/C at ${min(m.ranks.E)}/${min(m.ranks.D)}/${min(m.ranks.C)} minutes`);
    assert.equal(state.rank, 'C', `seed ${seed} the demo stops at rank C`);
    assert.equal(m.bankruptDays, 0, `seed ${seed} never misses upkeep`);
    assert.equal(m.failures, 0, `seed ${seed} teams only take work they can handle`);
    assert.ok(m.boardRuns >= 30, `seed ${seed} adventurers took board work by themselves (${m.boardRuns})`);
    assert.ok(state.members.filter(member => member.id.startsWith('r-')).length >= 1, `seed ${seed} rookies were drawn in by fame`);
    assert.ok(state.members.every(member => member.points > 0), `seed ${seed} mentoring gives every member, rookies included, real work`);
    assert.ok(m.trade >= 5000, `seed ${seed} adventurers spent their wages in the village (${Math.round(m.trade)} G)`);
    assert.ok(state.members.every(member => member.equipment.weapon), `seed ${seed} everyone ends up armed`);
    assert.ok(m.village[5] === undefined || m.village[5] > m.finishedAt * 1.3, `seed ${seed} the top village level is left for later`);
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
  // Easy work far below the guild's rank earns little renown.
  state.rank = 'C';
  assert.equal(renownFactor(state, QUESTS.find(q => q.id === 'patrol')), 0.1);
  assert.equal(getRankProgress(state).future, true, 'B opens with the full game');
});

test('fame draws applicants to the door; rookies are generated and famous adventurers wait for the right guild', () => {
  const state = createGame(31);
  state.gold = 3000;
  state.applicantClock = 1;
  tick(state, 2);
  const applicant = state.applicants[0];
  assert.ok(applicant, 'someone sets out for the guild');
  tick(state, applicant.eta + 1);
  assert.equal(applicant.status, 'waiting');
  assert.ok(applicant.bio?.name && applicant.rookieId, 'early applicants are new rookies');
  // A full dorm turns them away until a bed is added.
  assert.equal(act(state, 'recruit', { applicantId: applicant.id }).ok, false);
  let placed = false;
  for (let y = 4.5; y < 9.5 && !placed; y += 0.25) for (let x = 5.5; x < 12.5 && !placed; x += 0.25) placed = act(state, 'build', { type: 'dorm', x, y }).ok;
  assert.equal(act(state, 'recruit', { applicantId: applicant.id }).ok, true);
  const rookie = state.members.at(-1);
  assert.equal(rookie.id, applicant.rookieId);
  assert.ok(getMemberStats(state, rookie).trait, 'rookies have a trait like everyone else');
  assert.deepEqual(deserializeGame(serializeGame(state)), state);
  // Famous adventurers wait for renown and a guild that suits them.
  state.rank = 'C';
  assert.match(getAvailableRecruits(state).find(m => m.id === 'yuki').reason, /ชื่อเสียง/);
  state.rep = 500;
  assert.match(getAvailableRecruits(state).find(m => m.id === 'yuki').reason, /ชั้นตำรา/);
  assert.equal(getAvailableRecruits(state).find(m => m.id === 'poppy').available, false);
  const data = JSON.parse(serializeGame(state)); delete data.checksum; data.members.at(-1).bio.trait = 'cheater';
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
  const worn = getMemberStats(state, mira).basePower;
  mira.purse = 200;
  mira.shopClock = 0;
  tick(state, 1);
  assert.equal(mira.wear.weapon, 100, 'the smithy mends worn gear for a fee');
  assert.ok(getMemberStats(state, mira).basePower > worn);
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
  assert.equal(act(state, 'rankExam', { memberId: 'mira' }).ok, true);
  assert.equal(mira.errand.kind, 'exam');
  assert.equal(mira.purse, 70, 'the member pays the exam fee from their own wages');
  assert.equal(previewMission(state, 'patrol', ['mira']).ok, false, 'away at the arena');
  assert.deepEqual(deserializeGame(serializeGame(state)).members.find(m => m.id === 'mira').errand, mira.errand);
  tick(state, 26);
  assert.equal(mira.errand, null);
  assert.ok(mira.rank === 'E' || mira.examReadyAt > state.elapsed, 'passed, or waits a day to retry');
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
  // Tier-3 classes are visible goals for the full game.
  lune.class = 'sage';
  assert.match(classChoices(state, lune)[0].reason, /เกมเต็ม/);
});
