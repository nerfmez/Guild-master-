import { START_BUILDING,buildingRect,protectedAreas,intersects,isInsideBuilding,partitionSize,partitionRect,containsRect,pointInRect,partitionDoor,canCrossPartition,partitionWallBlocks } from './site.js';
import { FACILITIES, MEMBERS, QUESTS, EQUIPMENT, JOBS, RANKS, RANK_REQUIREMENTS, GUILD_EVENTS, MISSION_POLICIES,ROOM_TYPES,BUILDING_STAGES } from './content.js';

export const SAVE_VERSION = 4;
export const DAY_LENGTH = 240;
const RESOURCE_KEYS = ['gold', 'wood', 'stone', 'herb'];
const MAX_LEVEL = 20;
const MAX_LOG = 100;
const MAX_LEDGER = 120;
const EQUIPMENT_BY_ID = Object.fromEntries(EQUIPMENT.map(item => [item.id, item]));
const QUEST_BY_ID = Object.fromEntries(QUESTS.map(quest => [quest.id, quest]));
const MEMBER_BY_ID = Object.fromEntries(MEMBERS.map(member => [member.id, member]));
const TRAIT_BONUSES = {
  'ใจเย็น': { injuryReduction: 3, health: 5 }, 'ช่างสังเกต': { power: 1, scouting: 0.04 },
  'ใฝ่รู้': { training: 0.04 }, 'อ่อนโยน': { healing: 0.04, morale: 0.006 },
  'รักอิสระ': { scouting: 0.04, power: 1 }, 'ขยัน': { training: 0.035 },
  'ร่าเริง': { morale: 0.015 }, 'รอบคอบ': { injuryReduction: 3 },
  'กล้าหาญ': { power: 2 }, 'ช่างพูด': { morale: 0.012 },
  'อดทน': { recovery: 0.025, health: 6 }, 'สุขุม': { injuryReduction: 2, power: 1 },
};
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const rankIndex = rank => RANKS.indexOf(rank);
export const getRankIndex = rankIndex;
export function getRoomSize(type,rotation=0){const d=FACILITIES[type];return rotation%2?{w:d?.h??0,h:d?.w??0}:{w:d?.w??0,h:d?.h??0};}
export function getFacilityEntry(f){const d=getRoomSize(f.type,f.rotation||0),r=f.rotation||0;return r===0?{x:f.x+d.w/2,y:f.y+d.h+.5}:r===1?{x:f.x-.5,y:f.y+d.h/2}:r===2?{x:f.x+d.w/2,y:f.y-.5}:{x:f.x+d.w+.5,y:f.y+d.h/2};}
const hasRank = (state, rank) => rankIndex(state.rank) >= rankIndex(rank);
const success = message => ({ ok: true, message });
const failure = message => ({ ok: false, message });
const equipmentBaseClass = member => JOBS[member.class]?.parent || member.class;
const roomLevel = (state, type) => state.facilities.reduce((sum, facility) => sum + (facility.type === type ? facility.level : 0), 0);
const bestRoomLevel = (state, type) => Math.max(0, ...state.facilities.filter(room => room.type === type).map(room => room.level));
const memberById = (state, id) => state.members.find(member => member.id === id);
const isBusy = (state, memberId) => state.missions.some(mission => mission.status === 'active' && mission.memberIds.includes(memberId));
const availableMember = (state, id) => memberById(state, id) && !isBusy(state, id);
const finiteNumber = n => typeof n === 'number' && Number.isFinite(n);
const traitOf = member => TRAIT_BONUSES[MEMBER_BY_ID[member.id]?.trait] || {};

function nextRandom(state) {
  let x = state.rng | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.rng = x >>> 0 || 123;
  return state.rng / 4294967296;
}

function addLog(state, text, type = 'info') {
  state.log.unshift({ text, day: state.day, type });
  if (state.log.length > MAX_LOG) state.log.length = MAX_LOG;
}

function transact(state, amount, reason, direction = -1) {
  for (const key of RESOURCE_KEYS) state[key] += (amount[key] || 0) * direction;
  state.ledger.unshift({ day: state.day, time: Math.round(state.clock), text: reason, gold: ((amount.gold || 0) * direction) || 0,
    wood: ((amount.wood || 0) * direction) || 0, stone: ((amount.stone || 0) * direction) || 0, herb: ((amount.herb || 0) * direction) || 0 });
  if (state.ledger.length > MAX_LEDGER) state.ledger.length = MAX_LEDGER;
}

function canAfford(state, cost) {
  return RESOURCE_KEYS.every(key => state[key] >= (cost[key] || 0));
}

function createMember(content, level = 1) {
  return { id: content.id, name: content.name, class: content.class, level, xp: 0, energy: 100, morale: 80,
    injury: 0, task: 'rest', equipment: { weapon: null, accessory: null }, missionsDone: 0, trainingProgress: 0, waitingReason: null };
}

export function createGame(seed = 123) {
  const state = {
    version: SAVE_VERSION, seed: seed >>> 0 || 123, rng: seed >>> 0 || 123, nextId: 10,
    gold: 1200, wood: 32, stone: 20, herb: 12, rep: 0, day: 1, clock: 0, elapsed: 0,
    rank: 'F', landLevel: 0, grid: { width: 20, height: 16 }, building:{...START_BUILDING},rooms:[],
    members: MEMBERS.filter(member => member.starter).map(member => createMember(member)),
    facilities: [
      {id:'room-1',type:'reception',x:5.5,y:4.5,rotation:0,level:1},
      {id:'room-2',type:'dorm',x:10.5,y:4.5,rotation:0,level:1},
      {id:'room-3',type:'infirmary',x:11.75,y:4.5,rotation:0,level:1},
      {id:'room-4',type:'kitchen',x:5.75,y:7.75,rotation:1,level:1},
      {id:'room-5',type:'training',x:7.25,y:7.75,rotation:0,level:1},
      {id:'room-6',type:'workshop',x:9.5,y:8.25,rotation:2,level:1},
    ],
    missions: [], completedQuests: {}, questRuns: {}, bonds: {}, inventory: {}, log: [], ledger: [],
    goals: { firstMission: false, firstCraft: false, firstUpgrade: false, firstRecruit: false, firstExpansion: false },
    settings: { speed: 1, sound: true, paused: false },
    story: { chapter: 1, finished: false }, eventCooldowns: {}, daily: { missionCounts: {}, work: {}, garden: false },
    bankruptcyDays: 0,
  };
  addLog(state, 'บ้านเก่าข้างต้นไม้เปิดเป็นกิลด์แล้ว ส่งสมาชิก 3 คนลาดตระเวนทางหมู่บ้านเพื่อเริ่มต้น', 'story');
  return state;
}

export function getMemberStats(state, memberOrId) {
  const member = typeof memberOrId === 'string' ? memberById(state, memberOrId) : memberOrId;
  if (!member || !JOBS[member.class]) return null;
  const job = JOBS[member.class];
  const weapon = EQUIPMENT_BY_ID[member.equipment?.weapon];
  const accessory = EQUIPMENT_BY_ID[member.equipment?.accessory];
  const basePower = job.power + (member.level - 1) * 2.7 + (weapon?.power || 0) + (accessory?.power || 0) + (traitOf(member).power || 0);
  const moraleFactor = 0.85 + member.morale * 0.002;
  const energyFactor = 0.7 + member.energy * 0.003;
  const injuryFactor = 1 - member.injury * 0.004;
  return { power: Math.round(basePower * moraleFactor * energyFactor * injuryFactor), basePower: Math.round(basePower),
    health: Math.round(job.health + (member.level - 1) * 8 + (weapon?.health || 0) + (accessory?.health || 0) + (traitOf(member).health || 0)),
    role: job.role, jobName: job.name, xpNeeded: xpNeeded(member.level), busy: isBusy(state, member.id),
    energy: Math.round(member.energy), morale: Math.round(member.morale), injury: Math.round(member.injury),
    canSpecialize: member.level >= 5 && !job.parent && hasRank(state, 'D'),
    trait: MEMBER_BY_ID[member.id].trait,
    waitingReason: member.waitingReason || null,
  };
}

function xpNeeded(level) { return 35 + level * 15; }
function addXp(state, member, amount) {
  if (member.level >= MAX_LEVEL) return;
  member.xp += amount;
  while (member.level < MAX_LEVEL && member.xp >= xpNeeded(member.level)) {
    member.xp -= xpNeeded(member.level);
    member.level += 1;
    member.morale = clamp(member.morale + 4, 0, 100);
    addLog(state, `${member.name} เติบโตเป็นเลเวล ${member.level}`, 'level');
  }
  if (member.level >= MAX_LEVEL) member.xp = 0;
}

export function getGuildStats(state) {
  const nextRank = RANKS[rankIndex(state.rank) + 1] || null;
  const next = nextRank ? RANK_REQUIREMENTS[nextRank] : null;
  const previousRep = RANK_REQUIREMENTS[state.rank].rep;
  const today = state.ledger.filter(entry => entry.day === state.day);
  const memberCap = Math.min(12, roomLevel(state, 'dorm') * 4);
  return { power: state.members.reduce((sum, member) => sum + getMemberStats(state, member).power, 0),
    memberCount: state.members.length, memberCap, teamCap: hasRank(state, 'E') && roomLevel(state, 'dispatch') ? 2 : 1,
    activeMissions: state.missions.filter(mission => mission.status === 'active').length,
    recoveryRate: 0.16 + bestRoomLevel(state, 'dorm') * 0.045 + bestRoomLevel(state, 'kitchen') * 0.025,
    restSlots: roomLevel(state, 'dorm') * 2, trainingSlots: roomLevel(state, 'training') * 2,
    healingSlots: roomLevel(state, 'infirmary') * 2,
    incomeToday: today.reduce((sum, entry) => sum + Math.max(0, entry.gold), 0),
    expenseToday: today.reduce((sum, entry) => sum + Math.max(0, -entry.gold), 0),
    rankProgress: next ? clamp((state.rep - previousRep) / (next.rep - previousRep), 0, 1) : 1,
    nextRank, nextRankRep: next?.rep ?? state.rep, nextRankQuest: next?.quest ?? null,
    upkeep: state.members.length * 6 + state.facilities.length * 2,
    roomCount: state.facilities.length,
    expansionCost: getExpansionCost(state), inventoryCount: Object.values(state.inventory).reduce((sum, count) => sum + count, 0),
  };
}

function questLockReason(state, quest) {
  if (!hasRank(state, quest.rank)) return `ต้องมีกิลด์ระดับ ${quest.rank}`;
  if (quest.requires && !state.completedQuests[quest.requires]) return `ต้องผ่าน ${QUEST_BY_ID[quest.requires].name} ก่อน`;
  if (quest.id === 'rescue') {
    const needs = [];
    if (state.members.length < 6) needs.push('มีสมาชิกอย่างน้อย 6 คน');
    if (!roomLevel(state, 'dispatch')) needs.push('วางโต๊ะวางแผนเพื่อรองรับ 2 ทีม');
    if (state.landLevel < 1) needs.push('ขยายที่ดินอย่างน้อย 1 ครั้ง');
    if (needs.length) return `เตรียมกิลด์ช่วยทีมสำรวจ: ${needs.join(' · ')}`;
  }
  if (quest.final) {
    const missingStories = ['hollow', 'ruins', 'rescue'].filter(id => !state.completedQuests[id]);
    if (missingStories.length) return `ต้องผ่าน ${missingStories.map(id => QUEST_BY_ID[id].name).join(' · ')} ก่อน`;
    if (state.facilities.filter(room => room.level >= 2).length < 2) return 'เตรียมกิลด์รับทุกคนกลับบ้าน: อัปเกรดจุดใช้งานที่เลือกอย่างน้อย 2 จุดใช้งานเป็นระดับ 2';
  }
  if (quest.final && state.story.finished) return 'ผ่านบทสรุปแล้ว';
  return '';
}

export function getAvailableQuests(state) {
  return QUESTS.map(quest => {
    const reason = questLockReason(state, quest);
    return { ...quest, locked: Boolean(reason), lockReason: reason, available: !reason,
      completed: Boolean(state.completedQuests[quest.id]), completions: state.completedQuests[quest.id] || 0 };
  });
}

export function getAvailableRecruits(state) {
  const stats = getGuildStats(state);
  return MEMBERS.filter(member => !member.starter && !memberById(state, member.id)).map(member => {
    let reason = '';
    if (!hasRank(state, member.unlockRank)) reason = `ต้องมีกิลด์ระดับ ${member.unlockRank}`;
    else if (stats.memberCount >= stats.memberCap) reason = 'พื้นที่พักเต็มแล้ว';
    else if (state.gold < member.cost) reason = 'เหรียญไม่เพียงพอ';
    return { ...member, available: !reason, reason };
  });
}

function bondKey(a, b) { return [a, b].sort().join(':'); }
function teamBonds(state, ids) {
  let total = 0;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) total += state.bonds[bondKey(ids[i], ids[j])] || 0;
  return total;
}
function improveBonds(state, ids, amount) {
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const key = bondKey(ids[i], ids[j]);
    const previous = state.bonds[key] || 0;
    state.bonds[key] = clamp(previous + amount, 0, 100);
    if (previous < 30 && state.bonds[key] >= 30) addLog(state, `${memberById(state, ids[i]).name} กับ ${memberById(state, ids[j]).name} เริ่มรู้ใจกัน ได้โบนัสประสานทีม`, 'bond');
  }
}

export function previewMission(state, questId, memberIds = [], policy = 'balanced') {
  const quest = QUEST_BY_ID[questId];
  const selectedPolicy = MISSION_POLICIES[policy];
  if (!quest) return { ok: false, reason: 'ไม่พบภารกิจ', power: 0, difficulty: 0, readiness: 0, roles: [], missingRoles: [], duration: 0, cost: {}, energy: 0, verdict: 'ยังจัดทีมไม่ได้' };
  const members = Array.isArray(memberIds) ? memberIds.map(id => memberById(state, id)).filter(Boolean) : [];
  const roles = [...new Set(members.map(member => getMemberStats(state, member).role))];
  const missingRoles = quest.tags.filter(role => !roles.includes(role));
  const roleBonus = (quest.tags.length - missingRoles.length) * 0.07;
  const bondBonus = Math.min(0.18, teamBonds(state, Array.isArray(memberIds)?memberIds:[]) * 0.0008);
  const libraryBonus = quest.tags.includes('magic') ? bestRoomLevel(state, 'library') * 0.035 : 0;
  const traitBonus = members.reduce((sum, member) => sum + (quest.tags.includes('scout') ? traitOf(member).scouting || 0 : 0) + (quest.tags.includes('heal') ? traitOf(member).healing || 0 : 0), 0);
  const power = Math.round(members.reduce((sum, member) => sum + getMemberStats(state, member).power, 0) * (1 + roleBonus + bondBonus + libraryBonus + traitBonus) * (selectedPolicy?.power || 1));
  const readiness = power / quest.difficulty;
  let reason = questLockReason(state, quest);
  if (!reason && !selectedPolicy) reason = 'แผนเดินทางไม่ถูกต้อง';
  if (!reason && (!Array.isArray(memberIds) || memberIds.length !== 3 || new Set(memberIds).size !== 3 || members.length !== 3)) reason = 'เลือกสมาชิกที่ต่างกัน 3 คน';
  if (!reason && members.some(member => isBusy(state, member.id))) reason = 'สมาชิกบางคนกำลังทำภารกิจ';
  if (!reason && members.some(member => member.energy < 25 || member.injury > 40)) reason = 'สมาชิกต้องพักให้พลังอย่างน้อย 25 และบาดเจ็บไม่เกิน 40';
  if (!reason && getGuildStats(state).activeMissions >= getGuildStats(state).teamCap) reason = 'ทีมภารกิจเต็มแล้ว';
  if (!reason && !canAfford(state, quest.cost)) reason = 'เสบียงไม่เพียงพอ';
  if (!reason && state.missions.some(mission => mission.status === 'active' && mission.questId === quest.id)) reason = 'ภารกิจนี้มีทีมเดินทางอยู่แล้ว';
  return { ok: !reason, reason, power, difficulty: quest.difficulty, readiness, roles, missingRoles,
    duration: Math.round(quest.duration * (selectedPolicy?.duration || 1)), cost: { ...quest.cost },
    energy: Math.round(quest.energy * (selectedPolicy?.energy || 1)),
    verdict: readiness >= 1.25 ? 'พร้อมมาก' : readiness >= 0.95 ? 'พร้อมเดินทาง' : readiness >= 0.72 ? 'เสี่ยงบาดเจ็บ' : 'ควรฝึกและเตรียมอุปกรณ์', policy,
    bondBonus: Math.round(bondBonus * 100), reward: { ...quest.reward },
  };
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function canPlaceFacility(state,type,x,y,ignoreId=null,rotation=0,checkAccess=true){
 if(!FACILITIES[type])return failure('ไม่พบเฟอร์นิเจอร์');
 if(!finiteNumber(x)||!finiteNumber(y)||!Number.isInteger(x*4)||!Number.isInteger(y*4))return failure('วางได้ครั้งละหนึ่งในสี่ช่อง');
 if(!Number.isInteger(rotation)||rotation<0||rotation>3)return failure('ทิศทางไม่ถูกต้อง');
 const size=getRoomSize(type,rotation),area={x,y,...size},b=buildingRect(state);
 if(x<0||y<0||x+size.w>state.grid.width||y+size.h>state.grid.height)return failure('อยู่นอกที่ดินกิลด์');
 if(type!=='garden'&&(x<b.x+.25||y<b.y+.25||x+size.w>b.x+b.w-.25||y+size.h>b.y+b.h-.25))return failure('วางภายในอาคาร หรือขยายอาคารก่อน');
 if(type==='garden'&&intersects(area,b))return failure('แปลงสมุนไพรต้องอยู่กลางแจ้ง');
 const entrance={x:b.x+b.w/2-.5,y:b.y+b.h-.75,w:1,h:1.5};
 if(intersects(area,entrance)||protectedAreas(state).some(p=>intersects(area,p)))return failure('ต้องเว้นถนนและทางเข้าอาคาร');
 if(state.facilities.some(f=>f.id!==ignoreId&&intersects(area,{...f,...getRoomSize(f.type,f.rotation||0)})))return failure('ตำแหน่งนี้ทับเฟอร์นิเจอร์');
 if((state.rooms||[]).some(room=>intersects(area,partitionRect(room))&&!containsRect(partitionRect(room),area,.25)))return failure('เฟอร์นิเจอร์ทับผนังห้อง');
 const planned=[...state.facilities.filter(f=>f.id!==ignoreId),{type,x,y,rotation}];
 if(checkAccess&&!hasWalkableEntries(state,planned))return failure('ต้องมีทางเดินถึงด้านใช้งานของทุกชิ้น');
 return success('วางได้');
}

const NAV_STEP=.25;
function navigation(state,facilities,start){
 const w=state.grid.width/NAV_STEP,h=state.grid.height/NAV_STEP,at=(x,y)=>y*w+x;
 const valid=(x,y)=>x>=0&&y>=0&&x<w&&y<h;
 const point=(x,y)=>({x:(x+.5)*NAV_STEP,y:(y+.5)*NAV_STEP});
 const blocked=new Uint8Array(w*h),visited=new Uint8Array(w*h),parent=new Int32Array(w*h);parent.fill(-1);
 const areas=facilities.map(f=>({...f,...getRoomSize(f.type,f.rotation||0)}));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=point(x,y);if(areas.some(a=>p.x>a.x-.08&&p.x<a.x+a.w+.08&&p.y>a.y-.08&&p.y<a.y+a.h+.08)||(state.rooms||[]).some(room=>partitionWallBlocks(room,p)))blocked[at(x,y)]=1;}
 const b=buildingRect(state),door=b.x+b.w/2;
 const sx=Math.floor(start.x/NAV_STEP),sy=Math.floor(start.y/NAV_STEP),queue=[];
 if(valid(sx,sy)&&!blocked[at(sx,sy)]){queue.push([sx,sy]);visited[at(sx,sy)]=1;}
 for(let i=0;i<queue.length;i++){
  const[x,y]=queue[i],p=point(x,y);
  for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(!valid(nx,ny))continue;const id=at(nx,ny);if(blocked[id]||visited[id])continue;
   const q=point(nx,ny);if(isInsideBuilding(state,p.x,p.y)!==isInsideBuilding(state,q.x,q.y)&&!(Math.abs(q.x-door)<=.55&&Math.abs(p.x-door)<=.55&&Math.max(p.y,q.y)>=b.y+b.h&&Math.min(p.y,q.y)<b.y+b.h))continue;
   if((state.rooms||[]).some(room=>pointInRect(partitionRect(room),p)!==pointInRect(partitionRect(room),q)&&!canCrossPartition(room,p,q)))continue;
   visited[id]=1;parent[id]=at(x,y);queue.push([nx,ny]);
  }
 }
 return{w,h,visited,parent,point,at,valid};
}
function hasWalkableEntries(state,facilities){
 const b=buildingRect(state),nav=navigation(state,facilities,{x:b.x+b.w/2,y:b.y+b.h-.25});
 const reached=p=>{const x=Math.floor(p.x/NAV_STEP),y=Math.floor(p.y/NAV_STEP);return nav.valid(x,y)&&nav.visited[nav.at(x,y)];};
 if(!(state.rooms||[]).every(room=>reached(partitionDoor(room).inside)))return false;
 return facilities.every(f=>{
  const p=getFacilityEntry(f),d=getRoomSize(f.type,f.rotation||0),r=f.rotation||0;
  if(f.type!=='garden'&&!isInsideBuilding(state,p.x,p.y))return false;
  const face=r===0?{x:f.x+d.w/2,y:f.y+d.h-.1}:r===1?{x:f.x+.1,y:f.y+d.h/2}:r===2?{x:f.x+d.w/2,y:f.y+.1}:{x:f.x+d.w-.1,y:f.y+d.h/2};
  if((state.rooms||[]).some(room=>pointInRect(partitionRect(room),face)!==pointInRect(partitionRect(room),p)&&!canCrossPartition(room,face,p)))return false;
  return reached(p);
 });
}

export function findWalkPath(state,start,goal){
 const nav=navigation(state,state.facilities,start),gx=Math.floor(goal.x/NAV_STEP),gy=Math.floor(goal.y/NAV_STEP);if(!nav.valid(gx,gy)||!nav.visited[nav.at(gx,gy)])return[];
 const path=[];let id=nav.at(gx,gy);while(id!==-1){path.unshift(nav.point(id%nav.w,Math.floor(id/nav.w)));id=nav.parent[id];}return path;
}
export function getWalkableSpots(state){
 const b=buildingRect(state),nav=navigation(state,state.facilities,{x:b.x+b.w/2,y:b.y+b.h-.25}),spots=[];
 for(let y=0;y<nav.h;y++)for(let x=0;x<nav.w;x++)if(nav.visited[nav.at(x,y)]){const p=nav.point(x,y);if(p.x>b.x+.5&&p.x<b.x+b.w-.5&&p.y>b.y+.5&&p.y<b.y+b.h-.5)spots.push(p);}
 return spots.length?spots:[{x:b.x+b.w/2,y:b.y+b.h-.25}];
}
export function getBuildingExpansionCost(state){const level=state.building.level;return{gold:300+level*200,wood:12+level*6,stone:8+level*4};}
function expandBuilding(state){
 const b=state.building;if(b.level>=3)return failure('อาคารขยายเต็มแล้ว');
 if(!hasRank(state,BUILDING_STAGES[b.level+1].rank))return failure('ต่อเติมขั้นนี้ต้องมีกิลด์ระดับ '+BUILDING_STAGES[b.level+1].rank);
 const next={...b,width:b.width+2,height:b.height+2,level:b.level+1},area={x:next.x,y:next.y,w:next.width,h:next.height};
 if(area.x+area.w>state.grid.width||area.y+area.h>state.grid.height||protectedAreas({...state,building:next}).some(p=>intersects(area,p)))return failure('ซื้อที่ดินเพิ่มก่อนขยายอาคาร');
 if(state.facilities.some(f=>f.type==='garden'&&intersects(area,{...f,...getRoomSize(f.type,f.rotation||0)})))return failure('ย้ายแปลงสมุนไพรออกจากพื้นที่ต่อเติมก่อน');
 const cost=getBuildingExpansionCost(state);if(!canAfford(state,cost))return failure('วัสดุต่อเติมอาคารไม่เพียงพอ');
 const planned={...state,building:next};if(!hasWalkableEntries(planned,state.facilities))return failure('ทางเข้าใหม่ถูกบัง ต้องย้ายของก่อน');
 transact(state,cost,'ต่อเติมอาคารกิลด์');state.building=next;addLog(state,'ต่อเติมพื้นอาคารแล้ว จัดวางของในพื้นที่ใหม่ได้','build');return success('ขยายอาคารแล้ว');
}
function rotate(state,payload){const f=state.facilities.find(f=>f.id===payload.facilityId);if(!f)return failure('ไม่พบเฟอร์นิเจอร์');return move(state,{facilityId:f.id,x:f.x,y:f.y,rotation:((f.rotation||0)+1)%4});}

export function getPartitionCost(width,height){const area=width*height;return{gold:40+area*8,wood:Math.ceil(area*.45),stone:Math.ceil(area*.15)};}
export function canPlacePartition(state,room,ignoreId=null,checkAccess=true){
 if(!room||!ROOM_TYPES[room.type]||!Number.isInteger(room.width)||!Number.isInteger(room.height)||room.width<2||room.height<2||room.width>14||room.height>14)return failure('ขนาดห้องต้องเป็น 2–14 ช่อง');
 if(!finiteNumber(room.x)||!finiteNumber(room.y)||!Number.isInteger(room.x*4)||!Number.isInteger(room.y*4)||!Number.isInteger(room.rotation)||room.rotation<0||room.rotation>3)return failure('ตำแหน่งหรือทิศห้องไม่ถูกต้อง');
 const area=partitionRect(room),b=buildingRect(state);
 if(!containsRect(b,area))return failure('สร้างห้องได้ในพื้นที่อาคารที่เปิดแล้ว');
 if((state.rooms||[]).some(other=>other.id!==ignoreId&&intersects(area,partitionRect(other))))return failure('ห้องทับกัน');
 if(state.facilities.some(f=>{const a={...f,...getRoomSize(f.type,f.rotation||0)};return intersects(a,area)&&!containsRect(area,a,.25);}))return failure('ผนังห้องทับของ ต้องย้ายของก่อน');
 const planned={...state,rooms:[...(state.rooms||[]).filter(r=>r.id!==ignoreId),room]};
 if(checkAccess&&!hasWalkableEntries(planned,state.facilities))return failure('ต้องเว้นทางผ่านประตูห้องและทางใช้งานของ');
 return success('วางห้องได้');
}
function buildPartition(state,payload){
 const room={id:'partition-'+state.nextId,type:payload.type,x:payload.x,y:payload.y,width:payload.width,height:payload.height,rotation:payload.rotation??0};
 const place=canPlacePartition(state,room);if(!place.ok)return place;
 const cost=getPartitionCost(room.width,room.height);if(!canAfford(state,cost))return failure('วัสดุสร้างห้องไม่เพียงพอ');
 transact(state,cost,'สร้าง'+ROOM_TYPES[room.type].name);state.nextId++;state.rooms.push(room);addLog(state,'กั้น'+ROOM_TYPES[room.type].name+'แล้ว จัดของภายในได้','build');return success('สร้างห้องแล้ว');
}
export function previewPartitionMove(state,payload){
 const room=state.rooms.find(r=>r.id===payload.roomId);if(!room)return failure('ไม่พบห้อง');
 const next={...room,x:payload.x??room.x,y:payload.y??room.y,width:payload.width??room.width,height:payload.height??room.height,rotation:payload.rotation??room.rotation};
 const old=partitionRect(room),delta=(next.rotation-room.rotation+4)%4;
 const members=state.facilities.filter(f=>containsRect(old,{...f,...getRoomSize(f.type,f.rotation||0)}));
 const included=new Set(members.map(f=>f.id));
 const facilities=state.facilities.map(f=>{if(!included.has(f.id))return {...f};const d=getRoomSize(f.type,f.rotation||0),x=f.x-old.x,y=f.y-old.y;
  const [lx,ly]=delta===1?[old.h-y-d.h,x]:delta===2?[old.w-x-d.w,old.h-y-d.h]:delta===3?[y,old.w-x-d.w]:[x,y];
  return{...f,x:next.x+lx,y:next.y+ly,rotation:((f.rotation||0)+delta)%4};});
 const planned={...state,rooms:state.rooms.map(r=>r.id===room.id?next:r),facilities};
 if(facilities.some(f=>included.has(f.id)&&!containsRect(partitionRect(next),{...f,...getRoomSize(f.type,f.rotation||0)},.25)))return failure('ย้ายของออกก่อนลดขนาดห้อง');
 const place=canPlacePartition(planned,next,room.id);if(!place.ok)return place;
 if(facilities.some(f=>!canPlaceFacility(planned,f.type,f.x,f.y,f.id,f.rotation||0,false).ok))return failure('ห้องหรือของภายในทับของอื่น');
 const added=Math.max(0,next.width*next.height-room.width*room.height),cost=added?{gold:added*8,wood:Math.ceil(added*.45),stone:Math.ceil(added*.15)}:{};
 if(!canAfford(state,cost))return failure('วัสดุเพิ่มขนาดห้องไม่เพียงพอ');
 return{...success('วางห้องได้'),next,facilities,cost};
}
function movePartition(state,payload){
 const preview=previewPartitionMove(state,payload);if(!preview.ok)return preview;
 if(Object.keys(preview.cost).length)transact(state,preview.cost,'เพิ่มขนาดห้อง');Object.assign(state.rooms.find(r=>r.id===payload.roomId),preview.next);state.facilities.forEach(f=>Object.assign(f,preview.facilities.find(o=>o.id===f.id)));return success('ปรับห้องพร้อมของภายในแล้ว');
}
function demolishPartition(state,payload){
 const room=state.rooms.find(r=>r.id===payload.roomId);if(!room)return failure('ไม่พบห้อง');
 const refund=Object.fromEntries(Object.entries(getPartitionCost(room.width,room.height)).map(([k,v])=>[k,Math.floor(v*.4)]));
 transact(state,refund,'รื้อผนังห้อง',1);state.rooms=state.rooms.filter(r=>r.id!==room.id);return success('รื้อผนังแล้ว ของภายในยังอยู่');
}

export function getUpgradeCost(state, facilityId) {
  const room = typeof facilityId === 'object' ? facilityId : state.facilities.find(facility => facility.id === facilityId);
  if (!room || !FACILITIES[room.type]) return null;
  const base = FACILITIES[room.type].cost;
  return Object.fromEntries(RESOURCE_KEYS.map(key => [key, Math.ceil((base[key] || 0) * (0.7 + room.level * 0.6))]));
}
export function getExpansionCost(state) {
  return { gold: 500 + state.landLevel * 350, wood: 18 + state.landLevel * 8, stone: 12 + state.landLevel * 6 };
}

function sendMission(state, payload) {
  const preview = previewMission(state, payload.questId, payload.memberIds, payload.policy || 'balanced');
  if (!preview.ok) return failure(preview.reason);
  const quest = QUEST_BY_ID[payload.questId];
  const party = payload.memberIds.map(id => memberById(state, id));
  const maxHp = party.reduce((sum, member) => sum + getMemberStats(state, member).health, 0);
  transact(state, quest.cost, `เสบียง: ${quest.name}`);
  const mission = { id: `mission-${state.nextId++}`, questId: quest.id, memberIds: [...payload.memberIds],
    duration: preview.duration, progress: 0, policy: payload.policy || 'balanced', status: 'active', event: null,
    power: preview.power, difficulty: quest.difficulty, readiness: preview.readiness, energyCost: preview.energy,
    roles: [...preview.roles],
    risk: nextRandom(state), eventDone: false, decisionBonus: 0, decisionDamage: 0, phase: 'travel',
    combat: { partyHp: maxHp, partyMaxHp: maxHp, enemyHp: quest.difficulty * 5, enemyMaxHp: quest.difficulty * 5,
      enemyName: quest.enemy, wave: 1, lastStrike: 0, log: [] },
  };
  state.missions.push(mission);
  party.forEach(member => { member.task = 'mission'; });
  addLog(state, `ส่ง ${party.map(member => member.name).join(' · ')} ไป${quest.name}`, 'mission');
  return success(`ทีมออกเดินทางไป${quest.name}แล้ว`);
}

function missionEvent(state, mission) {
  const quest = QUEST_BY_ID[mission.questId];
  const flavor = quest.region === 'meadow' ? ['รถเข็นติดหล่ม', 'ทีมเจอชาวบ้านที่รถเข็นติดหล่ม ถ้าช่วยจะช้าลงเล็กน้อย แต่ได้คำแนะนำทางปลอดภัย'] :
    quest.region === 'ruins' ? ['ทางแยกใต้ซากหิน', 'พบประตูเก่าที่มีร่องรอยเวท จะศึกษาอย่างรอบคอบหรือเร่งผ่านไปดี?'] :
      ['สัญญาณไฟในหมอก', 'แสงไฟชี้เส้นทางอีกสาย ทีมเลือกพักสำรวจหรือเดินหน้าตามแผนได้'];
  mission.event = { id: `${mission.id}-event`, title: flavor[0], text: flavor[1], resolved: false,
    choices: [
      { id: 'help', label: 'ช่วยและสำรวจ', description: 'เดินทางเพิ่ม 12 วินาที · ทีมรับมือดีขึ้น · ได้สมุนไพร 2' },
      { id: 'press', label: 'เดินหน้าตามแผน', description: 'จบตามเวลา · ใช้พลังเพิ่ม 4' },
      { id: 'rest', label: 'พักและเช็กอุปกรณ์', description: 'เดินทางเพิ่ม 18 วินาที · เสี่ยงบาดเจ็บลดลง · ใช้สมุนไพร 1' },
    ] };
  addLog(state, `ข่าวจาก${quest.name}: ${flavor[0]} — เลือกได้ระหว่างที่กิลด์ยังทำงาน`, 'event');
}

function chooseEvent(state, payload) {
  const mission = state.missions.find(item => item.id === payload.missionId && item.status === 'active');
  if (!mission || !mission.event || mission.event.resolved) return failure('เหตุการณ์นี้จบไปแล้วหรือยังไม่เกิด');
  const choice = mission.event.choices.find(item => item.id === payload.choiceId);
  if (!choice) return failure('ตัวเลือกไม่ถูกต้อง');
  if (choice.id === 'rest' && state.herb < 1) return failure('ต้องใช้สมุนไพร 1');
  if (choice.id === 'help') { mission.duration += 12; mission.decisionBonus += 0.09; mission.bonusHerb = 2; }
  if (choice.id === 'press') { mission.energyCost += 4; mission.decisionBonus += 0.025; }
  if (choice.id === 'rest') { transact(state, { herb: 1 }, 'สมุนไพรพักระหว่างทาง'); mission.duration += 18; mission.decisionBonus += 0.12; mission.decisionDamage -= 0.08; }
  mission.event.resolved = true;
  mission.event.choiceId = choice.id;
  addLog(state, `ทีม${QUEST_BY_ID[mission.questId].name} เลือก${choice.label}`, 'event');
  return success('ส่งคำแนะนำให้ทีมแล้ว');
}

function updateCombat(mission, quest) {
  const ratio = mission.progress / mission.duration;
  mission.phase = ratio < 0.18 ? 'travel' : ratio < 0.88 ? 'battle' : 'return';
  const battleRatio = clamp((ratio - 0.18) / 0.7, 0, 1);
  const readiness = mission.readiness + mission.decisionBonus;
  const efficiency = clamp(readiness / 0.82, 0, 1.35);
  mission.combat.enemyHp = Math.max(0, Math.round(mission.combat.enemyMaxHp * (1 - battleRatio * efficiency)));
  const roles = mission.roles || [];
  const protection = (roles.includes('tank') ? 0.08 : 0) + (roles.includes('heal') ? 0.14 : 0) + (roles.includes('support') ? 0.07 : 0);
  const damage = clamp(0.72 / Math.max(0.25, readiness) + mission.risk * 0.12 + mission.decisionDamage - protection, 0.12, 1.2);
  mission.combat.partyHp = Math.max(0, Math.round(mission.combat.partyMaxHp * (1 - battleRatio * damage)));
  mission.combat.wave = Math.min(3, 1 + Math.floor(battleRatio * 3));
  const strike = Math.floor(mission.progress / 7);
  if (strike > mission.combat.lastStrike && mission.phase === 'battle') {
    mission.combat.lastStrike = strike;
    const member = mission.memberIds[strike % mission.memberIds.length];
    mission.combat.log.unshift({ memberId: member, text: strike % 3 === 0 ? 'ท่าประสานทีม' : 'โจมตี', damage: Math.round(mission.power / 8) });
    if (mission.combat.log.length > 4) mission.combat.log.length = 4;
  }
}

function resolveMission(state, mission) {
  const quest = QUEST_BY_ID[mission.questId];
  if (mission.event && !mission.event.resolved) {
    mission.event.resolved = true;
    mission.event.choiceId = 'auto';
    addLog(state, `ทีมตัดสินใจตามแผนสมดุลเมื่อไม่มีคำแนะนำเพิ่มเติม`, 'event');
  }
  const readiness = mission.readiness + mission.decisionBonus;
  const won = readiness >= 0.82 && mission.combat.partyHp > 0;
  mission.status = won ? 'completed' : 'failed';
  mission.progress = mission.duration;
  mission.finishedAt = state.elapsed;
  const dailyCount = state.daily.missionCounts[quest.id] || 0;
  state.daily.missionCounts[quest.id] = dailyCount + 1;
  const wasCompleted = Boolean(state.completedQuests[quest.id]);
  if (won) {
    // Repeat contracts pay less; they are renewable work, not unlimited full first-clear bounties.
    const multiplier = !wasCompleted ? 1 : dailyCount >= 3 ? 0.35 : 0.7;
    const rewards = Object.fromEntries(RESOURCE_KEYS.map(key => [key, Math.floor((quest.reward[key] || 0) * multiplier)]));
    rewards.herb += mission.bonusHerb || 0;
    transact(state, rewards, `รางวัล: ${quest.name}`, 1);
    const rep = Math.max(2, Math.round(quest.reward.rep * multiplier * (1 + roomLevel(state, 'reception') * 0.05)));
    state.rep += rep;
    state.completedQuests[quest.id] = (state.completedQuests[quest.id] || 0) + 1;
    state.questRuns[quest.id] = (state.questRuns[quest.id] || 0) + 1;
    mission.result = { success: true, reward: { ...rewards, rep }, title: 'กลับบ้านอย่างปลอดภัย', message: `${quest.name} สำเร็จ ได้ ${rewards.gold} เหรียญ และชื่อเสียง ${rep}` };
    state.goals.firstMission = true;
    improveBonds(state, mission.memberIds, 9);
    if (quest.id === 'hollow') state.story.chapter = Math.max(2, state.story.chapter);
    if (quest.id === 'ruins') state.story.chapter = Math.max(3, state.story.chapter);
    if (quest.id === 'rescue') state.story.chapter = Math.max(4, state.story.chapter);
    if (quest.final) {
      state.story.finished = true;
      state.story.chapter = 5;
      state.story.finishedAt = state.elapsed;
      addLog(state, 'หมอกจางลง ทีมสำรวจกลับถึงบ้าน หัวใจป่าผลิใบใหม่ ชาวเมืองร่วมฉลองใต้ต้นไม้ของกิลด์ — จบฤดูกาลแรกแล้ว เล่นดูแลกิลด์ต่อได้', 'story');
    }
    addLog(state, mission.result.message, 'success');
  } else {
    mission.result = { success: false, reward: {}, title: 'ถอยกลับมาพัก', message: `ทีมถอยจาก${quest.name} ทุกคนกลับมาแล้ว ลองฝึกและเตรียมอุปกรณ์ก่อนออกใหม่` };
    addLog(state, mission.result.message, 'warning');
  }
  mission.memberIds.forEach(id => {
    const member = memberById(state, id);
    member.task = 'rest';
    member.energy = clamp(member.energy - mission.energyCost, 0, 100);
    member.morale = clamp(member.morale + (won ? 7 : -9), 20, 100);
    const injury = won ? Math.max(0, Math.round((1.12 - readiness) * 23 + mission.risk * 3)) : 16 + Math.round(mission.risk * 10);
    const healerReduction = mission.roles?.includes('heal') ? 3 : 0;
    member.injury = clamp(member.injury + Math.max(0, injury - (traitOf(member).injuryReduction || 0) - healerReduction), 0, 100);
    member.missionsDone += won ? 1 : 0;
    addXp(state, member, quest.reward.xp * (won ? 1 : 0.35));
  });
  updateRank(state);
  trimMissions(state);
}

function trimMissions(state) {
  const past = state.missions.filter(mission => mission.status !== 'active');
  if (past.length > 20) {
    const remove = new Set(past.slice(0, past.length - 20).map(mission => mission.id));
    state.missions = state.missions.filter(mission => !remove.has(mission.id));
  }
}

function updateRank(state) {
  let nextRank = RANKS[rankIndex(state.rank) + 1];
  while (nextRank && state.rep >= RANK_REQUIREMENTS[nextRank].rep && (!RANK_REQUIREMENTS[nextRank].quest || state.completedQuests[RANK_REQUIREMENTS[nextRank].quest])) {
    state.rank = nextRank;
    transact(state, { gold: 120 + rankIndex(nextRank) * 45 }, `เงินสนับสนุนกิลด์ระดับ ${nextRank}`, 1);
    addLog(state, `กิลด์เลื่อนเป็นระดับ ${nextRank}! เปิดคำร้องและสิ่งปลูกสร้างใหม่`, 'rank');
    nextRank = RANKS[rankIndex(state.rank) + 1];
  }
}

function dailyUpdate(state) {
  // New guilds are not charged before their first mission pays anything.
  const upkeep = state.goals?.firstMission ? getGuildStats(state).upkeep : 0;
  const paid = Math.min(state.gold, upkeep);
  if (paid) transact(state, { gold: paid }, 'อาหารและดูแลกิลด์ประจำวัน');
  if (paid < upkeep) {
    state.bankruptcyDays += 1;
    state.members.forEach(member => { member.morale = Math.max(30, member.morale - 3); });
    addLog(state, 'เงินดูแลกิลด์ไม่พอ สมาชิกช่วยกันประหยัด รับงานลาดตระเวนฟรีเพื่อฟื้นตัวได้', 'warning');
  } else state.bankruptcyDays = 0;
  const garden = roomLevel(state, 'garden');
  if (garden) transact(state, { herb: garden * 2 }, 'เก็บสมุนไพรจากสวน', 1);
  state.daily = { missionCounts: {}, work: {}, garden: Boolean(garden) };
  if (state.day % 3 === 0) {
    const choices = ['ชาวบ้านฝากขนมปังมาให้กิลด์ สมาชิกทุกคนขวัญดีขึ้น', 'เด็ก ๆ นำภาพวาดทีมกิลด์มาติดผนัง ทุกคนยิ้มให้กัน'];
    const text = choices[Math.floor(nextRandom(state) * choices.length)];
    state.members.forEach(member => { member.morale = clamp(member.morale + 4, 0, 100); });
    addLog(state, text, 'cozy');
  }
}

/** Advance game time. Callers choose speed; tick itself never reads the DOM or timers. */
export function tick(state, seconds) {
  if (!finiteNumber(seconds) || seconds <= 0 || state.settings.paused) return state;
  let remaining = Math.min(seconds, 3600);
  while (remaining > 0) {
    const step = Math.min(1, remaining, DAY_LENGTH - state.clock);
    const stats = getGuildStats(state);
    state.elapsed += step;
    state.clock += step;
    const idleMembers = state.members.filter(member => !isBusy(state, member.id));
    const trainingAssignments = new Set(idleMembers.filter(member => member.task === 'train' && member.energy > 12 && member.injury <= 40)
      .sort((a, b) => a.trainingProgress - b.trainingProgress || a.level - b.level)
      .slice(0, stats.trainingSlots).map(member => member.id));
    const restAssignments = new Set(idleMembers.filter(member => member.task === 'rest')
      .sort((a, b) => a.energy - b.energy).slice(0, stats.restSlots).map(member => member.id));
    const healingAssignments = new Set(idleMembers.filter(member => member.injury > 0)
      .sort((a, b) => b.injury - a.injury).slice(0, stats.healingSlots).map(member => member.id));
    for (const member of state.members) {
      member.waitingReason = null;
      if (isBusy(state, member.id)) continue;
      if (member.task === 'train' && trainingAssignments.has(member.id)) {
        const training = bestRoomLevel(state, 'training');
        member.energy = clamp(member.energy - 0.052 * step, 0, 100);
        member.trainingProgress += step;
        addXp(state, member, (0.16 + training * 0.06 + bestRoomLevel(state, 'library') * 0.04 + (traitOf(member).training || 0)) * step);
        if (member.energy <= 12) { member.task = 'rest'; addLog(state, `${member.name} เหนื่อยจากการฝึกและกลับไปพัก`, 'info'); }
      } else if (member.task === 'train') {
        member.waitingReason = 'รอผลัดเข้าหุ่นฝึก';
        member.energy = clamp(member.energy + 0.07 * step, 0, 100);
      } else if (member.task === 'work') {
        const worked = state.daily.work[member.id] || 0;
        member.trainingProgress += step;
        member.energy = clamp(member.energy - step * 0.015, 0, 100);
        if (member.trainingProgress >= 60 && worked < 2) {
          member.trainingProgress -= 60;
          state.daily.work[member.id] = worked + 1;
          transact(state, { wood: 1, herb: worked === 1 ? 1 : 0 }, `${member.name} ช่วยงานกิลด์`, 1);
        }
        if (member.energy < 25 || (state.daily.work[member.id] || 0) >= 2) member.task = 'rest';
      } else {
        const rate = restAssignments.has(member.id) ? stats.recoveryRate : 0.07;
        if (!restAssignments.has(member.id) && member.energy < 100) member.waitingReason = 'พักที่ลานระหว่างรอเตียง';
        member.energy = clamp(member.energy + (rate + (traitOf(member).recovery || 0)) * step, 0, 100);
        member.morale = clamp(member.morale + (0.006 + bestRoomLevel(state, 'lounge') * 0.006 + (traitOf(member).morale || 0)) * step, 0, 100);
      }
      if (healingAssignments.has(member.id)) member.injury = clamp(member.injury - (0.08 + bestRoomLevel(state, 'infirmary') * 0.06) * step, 0, 100);
      else if (member.task === 'rest') member.injury = clamp(member.injury - 0.025 * step, 0, 100);
    }
    for (const mission of [...state.missions]) {
      if (mission.status !== 'active') continue;
      mission.progress += step;
      const quest = QUEST_BY_ID[mission.questId];
      const hasDecision = quest.story || (quest.id === 'patrol' && !state.completedQuests.patrol);
      if (hasDecision && !mission.eventDone && mission.progress >= mission.duration * 0.4) {
        mission.eventDone = true;
        missionEvent(state, mission);
      }
      updateCombat(mission, quest);
      if (mission.progress >= mission.duration) resolveMission(state, mission);
    }
    if (state.clock >= DAY_LENGTH - 0.00001) {
      state.clock = 0;
      state.day += 1;
      dailyUpdate(state);
    }
    remaining -= step;
  }
  return state;
}

function recruit(state, payload) {
  const content = MEMBER_BY_ID[payload.memberId];
  if (!content || content.starter) return failure('ไม่พบผู้สมัครคนนี้');
  if (memberById(state, content.id)) return failure('สมาชิกอยู่ในกิลด์แล้ว');
  const available = getAvailableRecruits(state).find(member => member.id === content.id);
  if (!available?.available) return failure(available?.reason || 'ยังรับสมาชิกไม่ได้');
  transact(state, { gold: content.cost }, `รับ ${content.name} เข้ากิลด์`);
  state.members.push(createMember(content, Math.max(1, rankIndex(state.rank))));
  state.goals.firstRecruit = true;
  addLog(state, `${content.name} เข้าร่วมกิลด์: ${content.description}`, 'member');
  return success(`${content.name} เข้าร่วมกิลด์แล้ว`);
}

function build(state, payload) {
  const content = FACILITIES[payload.type];
  if (!content) return failure('ไม่พบของชนิดนี้');
  if (!hasRank(state, content.unlockRank)) return failure(`ต้องมีกิลด์ระดับ ${content.unlockRank}`);
  if (['reception', 'dispatch'].includes(payload.type) && state.facilities.some(room => room.type === payload.type)) return failure('ของชนิดนี้มีได้หนึ่งชิ้น');
  const place = canPlaceFacility(state,payload.type,payload.x,payload.y,null,payload.rotation??0);
  if (!place.ok) return place;
  if (!canAfford(state, content.cost)) return failure('ทรัพยากรสำหรับวางของไม่เพียงพอ');
  transact(state, content.cost, `สร้าง${content.name}`);
  state.facilities.push({ id: `room-${state.nextId++}`, type: content.id, x: payload.x, y: payload.y, rotation:payload.rotation??0, level: 1 });
  addLog(state, `สร้าง${content.name}แล้ว สมาชิกเริ่มเข้าใช้พื้นที่ใหม่`, 'build');
  return success(`สร้าง${content.name}แล้ว`);
}

function move(state, payload) {
  const room = state.facilities.find(item => item.id === payload.facilityId);
  if (!room) return failure('ไม่พบจุดใช้งาน');
  const place = canPlaceFacility(state,room.type,payload.x,payload.y,room.id,payload.rotation??room.rotation??0);
  if (!place.ok) return place;
  room.x=payload.x;room.y=payload.y;room.rotation=payload.rotation??room.rotation??0;
  return success(`ย้าย${FACILITIES[room.type].name}แล้ว`);
}

function upgrade(state, payload) {
  const room = state.facilities.find(item => item.id === payload.facilityId);
  if (!room) return failure('ไม่พบจุดใช้งาน');
  if (room.level >= FACILITIES[room.type].maxLevel) return failure('ของชิ้นนี้อยู่ระดับสูงสุดแล้ว');
  const cost = getUpgradeCost(state, room.id);
  if (!canAfford(state, cost)) return failure('ทรัพยากรสำหรับอัปเกรดไม่เพียงพอ');
  transact(state, cost, `อัปเกรด${FACILITIES[room.type].name}`);
  room.level += 1;
  state.goals.firstUpgrade = true;
  addLog(state, `${FACILITIES[room.type].name} เป็นระดับ ${room.level}`, 'build');
  return success(`อัปเกรดจุดใช้งานเป็นระดับ ${room.level} แล้ว`);
}

function demolish(state, payload) {
  const room = state.facilities.find(item => item.id === payload.facilityId);
  if (!room) return failure('ไม่พบจุดใช้งาน');
  if (room.type === 'reception') return failure('โต๊ะรับคำร้องเป็นหัวใจของบ้าน ย้ายได้แต่รื้อไม่ได้');
  if (room.type === 'dorm' && (roomLevel(state, 'dorm') - room.level) * 4 < state.members.length) return failure('สมาชิกจะไม่มีที่พักเพียงพอ');
  if (room.type === 'dispatch' && getGuildStats(state).activeMissions > 1) return failure('รอให้ทีมที่สองกลับก่อนรื้อโต๊ะวางแผน');
  const refund = Object.fromEntries(RESOURCE_KEYS.map(key => [key, Math.floor((FACILITIES[room.type].cost[key] || 0) * 0.4)]));
  transact(state, refund, `รื้อ${FACILITIES[room.type].name} คืนวัสดุบางส่วน`, 1);
  state.facilities = state.facilities.filter(item => item.id !== room.id);
  if (room.type === 'training' && !roomLevel(state, 'training')) state.members.filter(member => member.task === 'train').forEach(member => { member.task = 'rest'; });
  return success('รื้อของและคืนวัสดุ 40% แล้ว');
}

function expand(state) {
  if (state.landLevel >= 2) return failure('ขยายที่ดินเต็มแล้ว');
  if (!hasRank(state, state.landLevel === 0 ? 'E' : 'C')) return failure(`ขยายครั้งนี้ต้องมีกิลด์ระดับ ${state.landLevel === 0 ? 'E' : 'C'}`);
  const cost = getExpansionCost(state);
  if (!canAfford(state, cost)) return failure('ทรัพยากรสำหรับขยายที่ดินไม่เพียงพอ');
  transact(state, cost, 'ซื้อที่ดินขยายกิลด์');
  state.landLevel += 1;
  state.grid.width += 6;
  state.grid.height += 4;
  state.goals.firstExpansion = true;
  addLog(state, 'รั้วกิลด์ขยับออกแล้ว มีพื้นที่ใหม่ให้จัดของและสวน', 'build');
  return success('ขยายที่ดินกิลด์แล้ว');
}

function craft(state, payload) {
  const item = EQUIPMENT_BY_ID[payload.equipmentId];
  if (!item) return failure('ไม่พบสูตรอุปกรณ์');
  if (!hasRank(state, item.unlockRank)) return failure(`สูตรนี้ต้องมีกิลด์ระดับ ${item.unlockRank}`);
  if (bestRoomLevel(state, 'workshop') < item.workshopLevel) return failure(`ต้องมีโต๊ะช่างระดับ ${item.workshopLevel}`);
  if (!canAfford(state, item.cost)) return failure('วัตถุดิบไม่เพียงพอ');
  if ((state.inventory[item.id] || 0) >= 24) return failure('มีอุปกรณ์ชนิดนี้มากเพียงพอแล้ว');
  transact(state, item.cost, `สร้าง${item.name}`);
  state.inventory[item.id] = (state.inventory[item.id] || 0) + 1;
  state.goals.firstCraft = true;
  addLog(state, `โต๊ะช่างสร้าง${item.name}แล้ว เลือกสมาชิกเพื่อสวมใส่ได้`, 'craft');
  return success(`สร้าง${item.name}แล้ว`);
}

function equip(state, payload) {
  const member = memberById(state, payload.memberId);
  if (!member) return failure('ไม่พบสมาชิก');
  if (isBusy(state, member.id)) return failure('รอสมาชิกกลับจากภารกิจก่อนเปลี่ยนอุปกรณ์');
  if (payload.equipmentId === null) {
    if (!['weapon', 'accessory'].includes(payload.slot)) return failure('เลือกช่องอุปกรณ์ที่จะถอด');
    const equipped = member.equipment[payload.slot];
    if (equipped) state.inventory[equipped] = (state.inventory[equipped] || 0) + 1;
    member.equipment[payload.slot] = null;
    return success('ถอดอุปกรณ์แล้ว');
  }
  const item = EQUIPMENT_BY_ID[payload.equipmentId];
  if (!item) return failure('ไม่พบอุปกรณ์');
  if (item.classes.length && !item.classes.includes(equipmentBaseClass(member))) return failure('อาชีพนี้ใช้อุปกรณ์ชิ้นนี้ไม่ได้');
  if (!(state.inventory[item.id] > 0)) return failure('ยังไม่มีอุปกรณ์ในคลัง');
  const old = member.equipment[item.slot];
  if (old === item.id) return failure('สวมอุปกรณ์นี้อยู่แล้ว');
  state.inventory[item.id] -= 1;
  if (old) state.inventory[old] = (state.inventory[old] || 0) + 1;
  member.equipment[item.slot] = item.id;
  return success(`${member.name} สวม${item.name}แล้ว`);
}

function specialize(state, payload) {
  const member = memberById(state, payload.memberId);
  if (!member || !JOBS[payload.classId]) return failure('ไม่พบสมาชิกหรืออาชีพ');
  if (isBusy(state, member.id)) return failure('รอสมาชิกกลับก่อนเปลี่ยนอาชีพ');
  if (!getMemberStats(state, member).canSpecialize) return failure('ต้องเป็นอาชีพพื้นฐาน เลเวล 5 และกิลด์ระดับ D');
  if (!JOBS[member.class].next.includes(payload.classId)) return failure('อาชีพนี้ต่อจากสายเดิมไม่ได้');
  if (state.gold < 180) return failure('ต้องใช้ 180 เหรียญ');
  transact(state, { gold: 180 }, `เปลี่ยนอาชีพ${member.name}`);
  member.class = payload.classId;
  addLog(state, `${member.name} ค้นพบเส้นทางของตัวเอง เป็น${JOBS[member.class].name}แล้ว`, 'level');
  return success('เปลี่ยนอาชีพแล้ว');
}

function hostEvent(state, payload) {
  const event = GUILD_EVENTS.find(item => item.id === payload.eventId);
  if (!event) return failure('ไม่พบกิจกรรม');
  if (!roomLevel(state, event.requires)) return failure(`ต้องมี${FACILITIES[event.requires].name}`);
  if ((state.eventCooldowns[event.id] || 0) > state.elapsed) return failure('เพิ่งจัดกิจกรรมนี้ รออีกสักพัก');
  if (!canAfford(state, event.cost)) return failure('วัตถุดิบจัดกิจกรรมไม่เพียงพอ');
  const guests = state.members.filter(member => !isBusy(state, member.id));
  if (!guests.length) return failure('รอให้มีสมาชิกกลับบ้านก่อน');
  transact(state, event.cost, event.name);
  guests.forEach(member => { member.energy = clamp(member.energy + (event.id === 'tea' ? 15 : 30), 0, 100); member.morale = clamp(member.morale + (event.id === 'tea' ? 12 : 20), 0, 100); });
  improveBonds(state, guests.map(member => member.id), event.id === 'tea' ? 5 : 9);
  state.eventCooldowns[event.id] = state.elapsed + event.cooldown;
  addLog(state, `${event.name} — ${guests.map(member => member.name).join(' · ')} ใช้เวลาด้วยกัน`, 'cozy');
  return success(`จัด${event.name}แล้ว`);
}

/** Every rejected command leaves state unchanged. */
export function act(state, type, payload = {}) {
  if (!state || typeof state !== 'object') return failure('ไม่พบข้อมูลกิลด์');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return failure('คำสั่งไม่ถูกต้อง');
  switch (type) {
    case 'sendMission': return sendMission(state, payload);
    case 'chooseEvent': return chooseEvent(state, payload);
    case 'recallMission': {
      const mission = state.missions.find(item => item.id === payload.missionId && item.status === 'active');
      if (!mission) return failure('ไม่พบทีมที่กำลังเดินทาง');
      mission.status = 'recalled'; mission.finishedAt = state.elapsed;
      mission.result = { success: false, reward: {}, title: 'กลับก่อนอย่างปลอดภัย', message: 'เรียกทีมกลับแล้ว เสบียงที่ใช้ไปไม่คืน' };
      mission.memberIds.forEach(id => { const member = memberById(state, id); member.task = 'rest'; member.energy = Math.max(0, member.energy - Math.round(mission.energyCost * clamp(mission.progress / mission.duration, 0, 1))); });
      addLog(state, `เรียกทีม${QUEST_BY_ID[mission.questId].name}กลับกิลด์`, 'mission');
      trimMissions(state);
      return success('เรียกทีมกลับแล้ว');
    }
    case 'recruit': return recruit(state, payload);
    case 'setTask': {
      const member = memberById(state, payload.memberId);
      if (!member) return failure('ไม่พบสมาชิก');
      if (isBusy(state, member.id)) return failure('สมาชิกกำลังทำภารกิจ');
      if (!['rest', 'train', 'work'].includes(payload.task)) return failure('งานไม่ถูกต้อง');
      if (payload.task === 'train' && !roomLevel(state, 'training')) return failure('ต้องมีหุ่นฝึก');
      if (payload.task === 'train' && (member.energy <= 12 || member.injury > 40)) return failure('สมาชิกต้องพักก่อนฝึก');
      member.task = payload.task; member.trainingProgress = 0;
      return success('เปลี่ยนงานสมาชิกแล้ว');
    }
    case 'buildRoom': return buildPartition(state,payload);
    case 'moveRoom': return movePartition(state,payload);
    case 'rotateRoom': {const room=state.rooms.find(r=>r.id===payload.roomId);return room?movePartition(state,{roomId:room.id,rotation:(room.rotation+1)%4}):failure('ไม่พบห้อง');}
    case 'resizeRoom': return movePartition(state,payload);
    case 'demolishRoom': return demolishPartition(state,payload);
    case 'build': return build(state, payload);
    case 'move': return move(state, payload);
    case 'rotate': return rotate(state,payload);
    case 'expandBuilding': return expandBuilding(state);
    case 'upgrade': return upgrade(state, payload);
    case 'demolish': return demolish(state, payload);
    case 'expand': return expand(state);
    case 'craft': return craft(state, payload);
    case 'equip': return equip(state, payload);
    case 'specialize': return specialize(state, payload);
    case 'hostEvent': return hostEvent(state, payload);
    case 'setSpeed': {
      if (![1, 2, 4].includes(payload.speed)) return failure('ความเร็วต้องเป็น 1, 2 หรือ 4');
      state.settings.speed = payload.speed; return success('เปลี่ยนความเร็วแล้ว');
    }
    case 'pause': state.settings.paused = Boolean(payload.paused); return success(state.settings.paused ? 'หยุดเวลาแล้ว' : 'เดินเวลาต่อแล้ว');
    case 'setSound': state.settings.sound = Boolean(payload.sound); return success('เปลี่ยนเสียงแล้ว');
    default: return failure('ไม่รู้จักคำสั่งนี้');
  }
}

function validateNumber(object, key, min, max, integer = false) {
  if (!finiteNumber(object[key]) || object[key] < min || object[key] > max || (integer && !Number.isInteger(object[key]))) throw new Error(`ข้อมูลเซฟไม่ถูกต้อง: ${key}`);
}

/** Migrate v1 exports with missing optional bookkeeping, and reject corrupted state. */
export function deserializeGame(source) {
  if (typeof source !== 'string' || source.length > 2000000) throw new Error('ไฟล์เซฟใหญ่เกินไปหรือไม่ใช่ข้อความ');
  let data;
  try { data = JSON.parse(source); } catch { throw new Error('อ่านไฟล์เซฟไม่ได้'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('รูปแบบเซฟไม่ถูกต้อง');
  const savedChecksum = data.checksum;
  delete data.checksum;
  if (savedChecksum !== undefined && (typeof savedChecksum !== 'string' || savedChecksum !== saveChecksum(JSON.stringify(data)))) throw new Error('ไฟล์เซฟเสียหายหรือข้อมูลถูกเปลี่ยนหลังบันทึก');
  if (![1,2,3,SAVE_VERSION].includes(data.version)) throw new Error('เวอร์ชันเซฟนี้ยังไม่รองรับ');
  // Clone through JSON above; imports can never change the caller's previous state.
  const defaults = createGame(data.seed || 123);
  const state = { ...defaults, ...data };
  if (!RANKS.includes(state.rank)) throw new Error('ระดับกิลด์ไม่ถูกต้อง');
  for (const key of RESOURCE_KEYS) validateNumber(state, key, 0, 100000000);
  validateNumber(state, 'rep', 0, 100000000);
  validateNumber(state, 'day', 1, 1000000, true);
  validateNumber(state, 'clock', 0, DAY_LENGTH);
  validateNumber(state, 'elapsed', 0, 1000000000);
  validateNumber(state, 'landLevel', 0, 2, true);
  if (!state.grid || state.grid.width !== 20 + state.landLevel * 6 || state.grid.height !== 16 + state.landLevel * 4) throw new Error('ขนาดที่ดินไม่ตรงกับระดับการขยาย');
  if (!Array.isArray(state.members) || state.members.length < 3 || state.members.length > 12) throw new Error('รายชื่อสมาชิกไม่ถูกต้อง');
  const ids = new Set();
  state.members = state.members.map(member => {
    if (!member || !MEMBER_BY_ID[member.id] || ids.has(member.id) || !JOBS[member.class]) throw new Error('พบสมาชิกซ้ำหรืออาชีพไม่ถูกต้อง');
    ids.add(member.id);
    const content = MEMBER_BY_ID[member.id];
    const baseClass = JOBS[member.class].parent || member.class;
    if (baseClass !== content.class) throw new Error('สายอาชีพสมาชิกไม่ถูกต้อง');
    const normalized = { ...createMember(content), ...member, name: content.name, equipment: { weapon: null, accessory: null, ...member.equipment } };
    validateNumber(normalized, 'level', 1, MAX_LEVEL, true);
    validateNumber(normalized, 'xp', 0, 1000000);
    for (const key of ['energy', 'morale', 'injury']) validateNumber(normalized, key, 0, 100);
    if (!['rest', 'train', 'work', 'mission'].includes(normalized.task)) throw new Error('งานสมาชิกไม่ถูกต้อง');
    for (const slot of ['weapon', 'accessory']) {
      const item = EQUIPMENT_BY_ID[normalized.equipment[slot]];
      if (normalized.equipment[slot] !== null && (!item || item.slot !== slot || (item.classes.length && !item.classes.includes(baseClass)))) throw new Error('อุปกรณ์สมาชิกไม่ถูกต้อง');
    }
    if (!finiteNumber(normalized.trainingProgress) || normalized.trainingProgress < 0) normalized.trainingProgress = 0;
    return normalized;
  });
  if (!Array.isArray(state.facilities) || state.facilities.length < 1 || state.facilities.length > 100) throw new Error('รายชื่อห้องไม่ถูกต้อง');
  if(data.version<3&&!data.building){
    state.building={x:5,y:4,width:Math.min(12,state.grid.width-6),height:Math.min(10,state.grid.height-5),level:2};
    const oldAreas=[];for(const f of state.facilities){const w=['reception','dorm','kitchen','training','lounge'].includes(f?.type)?4:3;const area={x:f?.x,y:f?.y,w,h:3};if(!f||!FACILITIES[f.type]||!Number.isInteger(f.x)||!Number.isInteger(f.y)||f.x<0||f.y<0||f.x+w>state.grid.width||f.y+3>state.grid.height||oldAreas.some(a=>intersects(a,area)))throw new Error('ผังในเซฟเดิมไม่ถูกต้อง');oldAreas.push(area);}
    const packed=[];
    for(const original of state.facilities){
      if(!original||!FACILITIES[original.type])throw new Error('เฟอร์นิเจอร์ในเซฟไม่ถูกต้อง');
      let placed=null;
      for(let y=original.type==='garden'?1:4.5;y<state.grid.height&&!placed;y+=.5)for(let x=original.type==='garden'?3:5.5;x<state.grid.width&&!placed;x+=.5){
        const f={...original,x,y,rotation:0};
        if(canPlaceFacility({...state,facilities:packed},f.type,x,y,null,0,true).ok)placed=f;
      }
      if(!placed)throw new Error('อาคารไม่พอสำหรับเซฟเดิม');packed.push(placed);
    }
    state.facilities=packed;
  }
  const b=state.building;
  if(!b||b.x!==5||b.y!==4||!Number.isInteger(b.level)||b.level<0||b.level>3||b.width!==8+b.level*2||b.height!==6+b.level*2||b.x+b.width>state.grid.width||b.y+b.height>state.grid.height)throw new Error('ขนาดอาคารไม่ถูกต้อง');
  state.rooms=data.rooms??[];if(!Array.isArray(state.rooms)||state.rooms.length>50)throw new Error('รายการห้องไม่ถูกต้อง');
  const partitionIds=new Set();for(const room of state.rooms){if(!room||typeof room.id!=='string'||partitionIds.has(room.id)||!canPlacePartition(state,room,room.id,false).ok)throw new Error('ผังห้องไม่ถูกต้อง');partitionIds.add(room.id);}
  const roomIds = new Set();
  for (const room of state.facilities) {
    if (!room || typeof room.id !== 'string' || roomIds.has(room.id) || !FACILITIES[room.type]) throw new Error('ห้องไม่ถูกต้อง');
    roomIds.add(room.id);
    validateNumber(room, 'level', 1, 3, true);
    if (!canPlaceFacility(state, room.type,room.x,room.y,room.id,room.rotation??0,false).ok) throw new Error('ห้องในเซฟวางทับกันหรืออยู่นอกพื้นที่');
  }
  if(!hasWalkableEntries(state,state.facilities))throw new Error('ทางใช้งานเฟอร์นิเจอร์ถูกบัง');
  if (!state.facilities.some(room => room.type === 'reception') || roomLevel(state, 'dorm') * 4 < state.members.length) throw new Error('โต๊ะรับคำร้องหรือเตียงพักไม่เพียงพอ');
  if (!Array.isArray(state.missions) || state.missions.length > 22) throw new Error('รายการภารกิจไม่ถูกต้อง');
  const missionIds = new Set(), assigned = new Set();
  for (const mission of state.missions) {
    if (!mission || !QUEST_BY_ID[mission.questId] || typeof mission.id !== 'string' || missionIds.has(mission.id) || !['active', 'completed', 'failed', 'recalled'].includes(mission.status)) throw new Error('ข้อมูลภารกิจไม่ถูกต้อง');
    missionIds.add(mission.id);
    if (!Array.isArray(mission.memberIds) || mission.memberIds.length !== 3 || new Set(mission.memberIds).size !== 3 || mission.memberIds.some(id => !ids.has(id))) throw new Error('สมาชิกภารกิจไม่ถูกต้อง');
    validateNumber(mission, 'duration', 1, 10000);
    validateNumber(mission, 'progress', 0, 10000);
    if (!MISSION_POLICIES[mission.policy]) throw new Error('แผนภารกิจไม่ถูกต้อง');
    if (mission.status === 'active') {
      if (mission.progress >= mission.duration || mission.memberIds.some(id => assigned.has(id))) throw new Error('สมาชิกถูกส่งซ้ำหรือภารกิจจบแล้ว');
      mission.memberIds.forEach(id => assigned.add(id));
      for (const key of ['power', 'difficulty', 'readiness', 'energyCost', 'risk']) validateNumber(mission, key, 0, 100000);
      mission.decisionBonus ??= 0; mission.decisionDamage ??= 0;
      mission.roles = mission.roles || [...new Set(mission.memberIds.map(id => JOBS[memberById(state, id).class].role))];
      if (!Array.isArray(mission.roles) || mission.roles.some(role => !['tank', 'scout', 'magic', 'heal', 'support', 'damage'].includes(role))) throw new Error('บทบาททีมไม่ถูกต้อง');
      validateNumber(mission, 'decisionBonus', 0, 1);
      validateNumber(mission, 'decisionDamage', -1, 1);
      if (!mission.combat || !finiteNumber(mission.combat.partyMaxHp) || !finiteNumber(mission.combat.enemyMaxHp) || mission.combat.partyMaxHp <= 0 || mission.combat.enemyMaxHp <= 0) throw new Error('ข้อมูลต่อสู้ไม่ถูกต้อง');
      mission.combat.log = Array.isArray(mission.combat.log) ? mission.combat.log.slice(0, 4) : [];
      if (mission.event) {
        if (!Array.isArray(mission.event.choices) || mission.event.choices.some(choice => !['help', 'press', 'rest'].includes(choice.id))) throw new Error('ตัวเลือกภารกิจไม่ถูกต้อง');
      }
    }
  }
  state.inventory = { ...(data.inventory || {}) };
  if (!state.inventory || typeof state.inventory !== 'object' || Array.isArray(state.inventory)) throw new Error('คลังอุปกรณ์ไม่ถูกต้อง');
  for (const [id, count] of Object.entries(state.inventory)) if (!EQUIPMENT_BY_ID[id] || !Number.isInteger(count) || count < 0 || count > 1000) throw new Error('จำนวนอุปกรณ์ไม่ถูกต้อง');
  for (const key of ['completedQuests', 'questRuns']) {
    state[key] = { ...(data[key] || {}) };
    for (const [id, count] of Object.entries(state[key])) if (!QUEST_BY_ID[id] || !Number.isInteger(count) || count < 0 || count > 1000000) throw new Error('ประวัติภารกิจไม่ถูกต้อง');
  }
  state.bonds = { ...(data.bonds || {}) };
  for (const [key, value] of Object.entries(state.bonds)) if (!/^\w+:\w+$/.test(key) || !key.split(':').every(id => ids.has(id)) || !finiteNumber(value) || value < 0 || value > 100) throw new Error('ความสัมพันธ์สมาชิกไม่ถูกต้อง');
  state.settings = { ...defaults.settings, ...data.settings };
  if (![1, 2, 4].includes(state.settings.speed)) throw new Error('ความเร็วเซฟไม่ถูกต้อง');
  state.settings.paused = Boolean(state.settings.paused); state.settings.sound = Boolean(state.settings.sound);
  state.goals = { ...defaults.goals, ...data.goals };
  state.story = { ...defaults.story, ...data.story };
  validateNumber(state.story, 'chapter', 1, 5, true);
  state.story.finished = Boolean(state.story.finished);
  if (state.story.finished && !state.completedQuests.heart) throw new Error('บทสรุปเกมไม่ตรงกับประวัติภารกิจ');
  state.daily = { ...defaults.daily, ...data.daily, missionCounts: { ...(data.daily?.missionCounts || {}) }, work: { ...(data.daily?.work || {}) } };
  for (const [id, value] of Object.entries(state.daily.missionCounts)) if (!QUEST_BY_ID[id] || !Number.isInteger(value) || value < 0 || value > 1000000) throw new Error('ประวัติภารกิจประจำวันไม่ถูกต้อง');
  for (const [id, value] of Object.entries(state.daily.work)) if (!ids.has(id) || !Number.isInteger(value) || value < 0 || value > 2) throw new Error('ประวัติงานประจำวันไม่ถูกต้อง');
  state.eventCooldowns = { ...(data.eventCooldowns || {}) };
  for (const [id, value] of Object.entries(state.eventCooldowns)) if (!GUILD_EVENTS.some(event => event.id === id) || !finiteNumber(value) || value < 0 || value > 1000000000) throw new Error('เวลากิจกรรมไม่ถูกต้อง');
  state.log = Array.isArray(data.log) ? data.log.filter(item => item && typeof item.text === 'string' && item.text.length < 1000).slice(0, MAX_LOG) : defaults.log;
  state.ledger = Array.isArray(data.ledger) ? data.ledger.filter(item => item && typeof item.text === 'string' && finiteNumber(item.gold)).slice(0, MAX_LEDGER) : [];
  state.nextId = Math.max(Number.isInteger(data.nextId) ? data.nextId : 10, ...[...roomIds,...partitionIds, ...missionIds].map(id => (Number(id.split('-').pop()) || 0) + 1));
  state.rng = state.rng >>> 0 || 123;
  state.members.forEach(member => { if (assigned.has(member.id)) member.task = 'mission'; else if (member.task === 'mission') member.task = 'rest'; });
  state.version = SAVE_VERSION;
  if (getGuildStats(state).activeMissions > getGuildStats(state).teamCap) throw new Error('จำนวนทีมภารกิจเกินความจุกิลด์');
  return state;
}

export function serializeGame(state) {
  const serialized = JSON.stringify(state);
  // Validate our own exports too: callers never receive an unusable save file.
  deserializeGame(serialized);
  const data = JSON.parse(serialized);
  data.checksum = saveChecksum(serialized);
  return JSON.stringify(data);
}

// Integrity check for accidental file corruption; this is not security or anti-cheat.
function saveChecksum(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
