import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, tick, act, serializeGame, deserializeGame, getGuildStats, getMemberStats, getAvailableQuests, previewMission, canPlaceFacility, getRoomSize, findWalkPath, getBuildingExpansionCost } from '../src/game.js';
import { QUESTS, RANKS } from '../src/content.js';

const party = ['mira', 'finn', 'lune'];
function dispatch(state, questId = 'patrol', ids = party, policy = 'balanced') {
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
  assert.equal(act(state, 'recruit', { memberId: 'sera' }).ok, false);
  assert.equal(act(state, 'build', { type: 'dorm', x: 8.5, y: 4.5 }).ok, true);
  assert.equal(act(state, 'recruit', { memberId: 'sera' }).ok, true);
  assert.equal(act(state, 'recruit', { memberId: 'toma' }).ok, true);
  dispatch(state);
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
  assert.equal(state.version, 4);
  assert.ok(state.daily.missionCounts);
  assert.equal(act(state, 'sendMission', { questId: 'heart', memberIds: party }).ok, false);
  state.rep = 999;
  complete(state, dispatch(state));
  assert.equal(state.rank, 'E', 'reputation alone cannot skip escort story gate');
  assert.equal(getAvailableQuests(state).find(quest => quest.id === 'hollow').locked, true);
});

test('authored campaign can reach all three regions and final rescue without modifying resources or levels', () => {
  const state = createGame(24);
  for (const [memberId, equipmentId] of [['mira', 'oak-blade'], ['finn', 'leaf-bow'], ['lune', 'moon-wand']]) {
    assert.equal(act(state, 'craft', { equipmentId }).ok, true);
    assert.equal(act(state, 'equip', { memberId, equipmentId }).ok, true);
  }
  const seenRegions = new Set();
  let completed = 0;
  while (!state.story.finished && completed < 70) {
    // Invest only earned funds; later rescue needs a functional expanded guild.
    if (RANKS.indexOf(state.rank) >= 1) {
      if (state.landLevel < 1) act(state, 'expand');
      if (getGuildStats(state).memberCap < 6) act(state, 'build', { type: 'dorm', x: 8.5, y: 4.5 });
      if (!state.facilities.some(room => room.type === 'dispatch')) act(state, 'build', { type: 'dispatch', x: 5.5, y: 6.5, rotation:2 });
      for (const memberId of ['sera', 'toma']) if (!state.members.some(member => member.id === memberId)) act(state, 'recruit', { memberId });
      for (const facilityId of ['room-2', 'room-5']) {
        const room = state.facilities.find(room => room.id === facilityId);
        if (room.level < 2) act(state, 'upgrade', { facilityId });
      }
    }
    // Make room for progression, using earned materials rather than state edits.
    if (RANKS.indexOf(state.rank) >= 2) {
      for (const member of state.members) if (getMemberStats(state, member).canSpecialize) {
        const classId = ({ warrior: 'guardian', archer: 'ranger', mage: 'sage', healer: 'cleric' })[member.class];
        if (classId) act(state, 'specialize', { memberId: member.id, classId });
      }
    }
    tick(state, 110);
    const available = getAvailableQuests(state).filter(quest => !quest.locked && previewMission(state, quest.id, party, 'cautious').ok);
    const nextStory = available.find(quest => !quest.completed && ['escort', 'hollow', 'ruins', 'mistpath', 'rescue', 'heart'].includes(quest.id));
    let quest = nextStory || available.filter(quest => !quest.final).sort((a, b) => b.reward.rep - a.reward.rep)[0];
    let preview = previewMission(state, quest.id, party, 'cautious');
    if (preview.readiness < 0.9) {
      party.forEach(memberId => act(state, 'setTask', { memberId, task: 'train' }));
      tick(state, 200);
      party.forEach(memberId => act(state, 'setTask', { memberId, task: 'rest' }));
      tick(state, 200);
      preview = previewMission(state, quest.id, party, 'cautious');
    }
    if (!preview.ok) {
      quest = QUESTS.find(quest => quest.id === 'patrol');
      preview = previewMission(state, quest.id, party, 'cautious');
    }
    const mission = dispatch(state, quest.id, party, 'cautious');
    complete(state, mission);
    assert.equal(mission.status, 'completed', `${quest.id} readiness ${preview.readiness}`);
    seenRegions.add(quest.region);
    completed += 1;
    assert.ok(state.gold >= 0 && state.wood >= 0 && state.stone >= 0 && state.herb >= 0);
    assert.doesNotThrow(() => serializeGame(state));
  }
  assert.ok(completed < 70, 'campaign should not require an endless repeat grind');
  assert.deepEqual([...seenRegions].sort(), ['meadow', 'mist', 'ruins']);
  assert.equal(state.rank, 'A');
  assert.equal(state.story.finished, true);
  assert.equal(state.completedQuests.heart, 1);
  assert.ok(state.completedQuests.rescue > 0);
  assert.equal(state.landLevel, 1);
  assert.equal(state.members.length, 6);
  assert.ok(state.facilities.some(room => room.type === 'dispatch'));
  assert.ok(state.facilities.filter(room => room.level >= 2).length >= 2);
  assert.equal(state.story.chapter, 5);
  assert.ok(previewMission(state, 'patrol', party).ok, 'free play continues after final quest');
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
  for (const memberId of ['sera', 'toma']) assert.equal(act(state, 'recruit', { memberId }).ok, true);
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
  const oldPower = getMemberStats(state, member).power;
  assert.equal(act(state, 'specialize', { memberId: 'mira', classId: 'guardian' }).ok, true);
  assert.ok(getMemberStats(state, member).power > oldPower);
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
 const migrated=deserializeGame(JSON.stringify(old));assert.equal(migrated.version,4);assert.equal(migrated.gold,2314);assert.equal(migrated.members[0].level,4);assert.equal(migrated.facilities[1].level,2);assert.equal(migrated.facilities.length,6);assert.doesNotThrow(()=>serializeGame(migrated));
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
