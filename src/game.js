import { START_BUILDING,buildingRect,protectedAreas,intersects,isInsideBuilding,partitionSize,partitionRect,containsRect,pointInRect,partitionDoor,canCrossPartition,partitionWallBlocks } from './site.js';
import { FACILITIES, MEMBERS, QUESTS, EQUIPMENT, JOBS, RANKS, RANK_REQUIREMENTS, MERIT_LABELS, GUILD_EVENTS, MISSION_POLICIES,ROOM_TYPES,BUILDING_STAGES,LOOT,RARITIES,PAYOUT_PLANS,FEE_MULTIPLIER,VILLAGER_NAMES,GUILD_UPGRADES,VILLAGE_LEVELS,VILLAGE_PROJECTS,VILLAGE_LOTS,TRAIT_NAMES,ROOKIE_NAMES,ROOKIE_LINES,HAIR_COLORS,MATERIALS,CONSUMABLES } from './content.js';

export const SAVE_VERSION = 5;
export const DAY_LENGTH = 240;
const RESOURCE_KEYS = ['gold', 'wood', 'stone', 'herb'];
const MAX_LEVEL = 20;
const MAX_LOG = 100;
const MAX_LEDGER = 120;
const EQUIPMENT_BY_ID = Object.fromEntries(EQUIPMENT.map(item => [item.id, item]));
const QUEST_BY_ID = Object.fromEntries(QUESTS.map(quest => [quest.id, quest]));
const MEMBER_BY_ID = Object.fromEntries(MEMBERS.map(member => [member.id, member]));
const TRAIT_BONUSES = {
  'ใจเย็น': { injuryReduction: 3, health: 5 }, 'ช่างสังเกต': { power: 1, scouting: 0.04, luck: 0.05 },
  'ใฝ่รู้': { training: 0.04 }, 'อ่อนโยน': { healing: 0.04, morale: 0.006 },
  'รักอิสระ': { scouting: 0.04, power: 1, luck: 0.03 }, 'ขยัน': { training: 0.035 },
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
/** Authored content for a named member, or the stored biography of a rookie who walked in. */
export const contentOf = member => MEMBER_BY_ID[member?.id] || member?.bio || null;
const traitOf = member => TRAIT_BONUSES[contentOf(member)?.trait] || {};

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
  const member = { id: content.id, name: content.name, class: content.class, level, xp: 0, energy: 100, morale: 80,
    injury: 0, task: 'rest', equipment: { weapon: null, accessory: null }, missionsDone: 0, trainingProgress: 0, waitingReason: null, purse: 0, pack: { ration: 0, potion: 0 }, wear: { weapon: 100, accessory: 100 } };
  if (content.rookie) { member.bio = { name: content.name, class: content.class, trait: content.trait, hair: content.hair, description: content.description, rookie: true }; member.hair = content.hair; }
  return member;
}

export function createGame(seed = 123, options = {}) {
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
    applicants: [], applicantClock: 90, petitions: [], petitionClock: 20, petitionRng: (((seed >>> 0) || 123) ^ 0x5bd1e995) >>> 0 || 7, payoutPlan: 'standard',
    record: { jobs: 0 }, market: { ...MARKET_START }, shops: { ration: 0, potion: 0, gear: {} }, upgrades: { signboard: 0, contracts: 0, clerk: 0, coffer: 0 }, village: { prosperity: 0, houses: 3, shop: 0, market: 0, smithy: 0, trade: 0 }, idleBank: 0,
  };
  if (options.opening) {
    // Opening chapter: an empty hall, then adventurers arrive one step at a time.
    state.members = []; state.facilities = []; state.wood = 40; state.stone = 24;
    state.intro = { step: 'reception', timer: 0, visitors: [], next: [], after: null };
    state.profile = normalizeProfile(options.profile);
    addLog(state, `${state.profile.masterName} รับบ้านเก่าข้างต้นไม้มาเปิดเป็น${state.profile.guildName} เริ่มจากวางโต๊ะรับคำร้อง`, 'story');
    syncImportant(state);
    return state;
  }
  addLog(state, 'บ้านเก่าข้างต้นไม้เปิดเป็นกิลด์แล้ว ส่งสมาชิกไปลาดตระเวนทางหมู่บ้านเพื่อเริ่มต้น', 'story');
  syncImportant(state);
  return state;
}

export const PROFILE_LOOKS = {
  hair: ['#5b4637', '#8b5a3c', '#d9b26f', '#a66c59', '#6f6a8f', '#e9e2d0'],
  outfit: ['#d98978', '#94b7c5', '#90b89c', '#b7aec9', '#e7bd74', '#8a7a68'],
  skin: ['#f7d4ae', '#e8b88c', '#b9805a'],
  hairStyle: ['short', 'long'],
};
export const DEFAULT_PROFILE = { masterName: 'หัวหน้ากิลด์', guildName: 'กิลด์ใบอ่อน', hair: PROFILE_LOOKS.hair[0], outfit: PROFILE_LOOKS.outfit[0], skin: PROFILE_LOOKS.skin[0], hairStyle: 'short' };
/** Clean player-entered names and look choices; unknown values fall back to defaults. */
export function normalizeProfile(input = {}) {
  const text = (value, fallback) => { const clean = String(value ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20); return clean || fallback; };
  const pick = (key, value) => PROFILE_LOOKS[key].includes(value) ? value : DEFAULT_PROFILE[key];
  return { masterName: text(input.masterName, DEFAULT_PROFILE.masterName), guildName: text(input.guildName, DEFAULT_PROFILE.guildName),
    hair: pick('hair', input.hair), outfit: pick('outfit', input.outfit), skin: pick('skin', input.skin), hairStyle: pick('hairStyle', input.hairStyle) };
}

export const INTRO_STEPS = ['reception', 'dorm', 'training', 'patrol', 'wait', 'visit', 'done'];
const INTRO_ARRIVALS = { dorm: { next: ['mira'], after: 'training', delay: 6 }, training: { next: ['finn', 'lune'], after: 'patrol', delay: 8 }, patrol: { next: ['noa'], after: 'done', delay: 10 } };
export function introActive(state) { return Boolean(state.intro && state.intro.step !== 'done'); }
function introWait(state, from) {
  const arrival = INTRO_ARRIVALS[from];
  Object.assign(state.intro, { step: 'wait', timer: 0, next: [...arrival.next], after: arrival.after, delay: arrival.delay });
}
/** Advance the opening chapter when its condition is met; members only join through welcomeVisitors. */
function advanceIntro(state, seconds = 0) {
  const intro = state.intro;
  if (!introActive(state)) return;
  const has = type => state.facilities.some(f => f.type === type);
  if (intro.step === 'reception' && has('reception')) intro.step = 'dorm';
  if (intro.step === 'dorm' && has('dorm')) introWait(state, 'dorm');
  if (intro.step === 'training' && has('training')) introWait(state, 'training');
  if (intro.step === 'patrol' && state.completedQuests.patrol) introWait(state, 'patrol');
  if (intro.step === 'wait') {
    intro.timer += seconds;
    if (intro.timer >= (intro.delay || 6)) { intro.visitors = intro.next; intro.next = []; intro.step = 'visit'; }
  }
}
function welcomeVisitors(state) {
  const intro = state.intro;
  if (!introActive(state) || intro.step !== 'visit' || !intro.visitors.length) return failure('ยังไม่มีใครมาที่ประตู');
  const names = [];
  for (const id of intro.visitors) {
    const content = MEMBER_BY_ID[id];
    if (!content || memberById(state, id)) continue;
    state.members.push(createMember(content)); names.push(content.name);
  }
  intro.visitors = []; intro.step = intro.after || 'done'; intro.after = null;
  addLog(state, `${names.join(' · ')} เข้าร่วมกิลด์แล้ว`, 'story');
  advanceIntro(state);
  return success(`ยินดีต้อนรับ ${names.join(' · ')}`);
}

export function getMemberStats(state, memberOrId) {
  const member = typeof memberOrId === 'string' ? memberById(state, memberOrId) : memberOrId;
  if (!member || !JOBS[member.class]) return null;
  const job = JOBS[member.class];
  const weapon = EQUIPMENT_BY_ID[member.equipment?.weapon];
  const accessory = EQUIPMENT_BY_ID[member.equipment?.accessory];
  const basePower = job.power + (member.level - 1) * 2.7 + (weapon?.power || 0) * wearFactor(member, 'weapon') + (accessory?.power || 0) * wearFactor(member, 'accessory') + (traitOf(member).power || 0);
  const moraleFactor = 0.85 + member.morale * 0.002;
  const energyFactor = 0.7 + member.energy * 0.003;
  const injuryFactor = 1 - member.injury * 0.004;
  return { power: Math.round(basePower * moraleFactor * energyFactor * injuryFactor), basePower: Math.round(basePower),
    health: Math.round(job.health + (member.level - 1) * 8 + (weapon?.health || 0) + (accessory?.health || 0) + (traitOf(member).health || 0)),
    role: job.role, jobName: job.name, xpNeeded: xpNeeded(member.level), busy: isBusy(state, member.id),
    energy: Math.round(member.energy), morale: Math.round(member.morale), injury: Math.round(member.injury),
    canSpecialize: member.level >= 5 && !job.parent && hasRank(state, 'D'),
    trait: contentOf(member)?.trait,
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
    // Teams that took board work by themselves use the board's own slots, never the player's.
    activeMissions: state.missions.filter(mission => mission.status === 'active' && !mission.auto).length,
    boardCap: bestRoomLevel(state, 'board'), boardMissions: state.missions.filter(mission => mission.status === 'active' && mission.auto).length,
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

// ---- Promotion: renown plus a record of work, then the association's exam. ----
const EXAM_RANK = Object.fromEntries(Object.entries(RANK_REQUIREMENTS).filter(([, r]) => r.quest).map(([rank, r]) => [r.quest, rank]));
function meritValue(state, merit) {
  switch (merit.kind) {
    case 'jobs': return state.record?.jobs || 0;
    case 'members': return state.members.length;
    case 'quests': return Object.keys(state.completedQuests).length;
    case 'board': return roomLevel(state, 'board') ? 1 : 0;
    case 'village': return getVillageInfo(state).level;
    case 'geared': return state.members.filter(member => member.equipment?.weapon).length;
    case 'level': return state.members.filter(member => member.level >= merit.level).length;
    default: return 0;
  }
}
/** The next rank's renown, merit checklist and exam, for the promotion panel and the rules below. */
export function getRankProgress(state, rank = RANKS[rankIndex(state.rank) + 1]) {
  const req = rank && RANK_REQUIREMENTS[rank];
  if (!req) return null;
  const merits = req.merits.map(merit => { const have = meritValue(state, merit); return { kind: merit.kind, label: MERIT_LABELS[merit.kind](merit.n, merit), have: Math.min(have, merit.n), need: merit.n, ok: have >= merit.n }; });
  const ready = !req.future && state.rep >= req.rep && merits.every(m => m.ok);
  return { rank, rep: state.rep, repNeeded: req.rep, merits, exam: req.quest, examReady: ready, examPassed: Boolean(req.quest && state.completedQuests[req.quest]), future: Boolean(req.future) };
}
const examReady = (state, quest) => { const rank = EXAM_RANK[quest.id]; return Boolean(rank) && rankIndex(rank) === rankIndex(state.rank) + 1 && getRankProgress(state, rank).examReady; };
/** Renown fades for work far below the guild's rank, so easy jobs cannot carry a promotion. */
export function renownFactor(state, quest) { const gap = rankIndex(state.rank) - rankIndex(quest.rank); return gap <= 0 ? 1 : gap === 1 ? 0.5 : gap === 2 ? 0.25 : 0.1; }
function questLockReason(state, quest) {
  const examRank = EXAM_RANK[quest.id];
  if (examRank && !hasRank(state, quest.rank) && rankIndex(examRank) === rankIndex(state.rank) + 1 && !examReady(state, quest)) return `สอบเลื่อนเป็นกิลด์ ${examRank}: ทำชื่อเสียงและผลงานให้ครบก่อน`;
  if (!hasRank(state, quest.rank) && !examReady(state, quest)) return `ต้องมีกิลด์ระดับ ${quest.rank}`;
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

/** Why a named adventurer would (or would not yet) come to the door. */
function namedReason(state, member) {
  if (!hasRank(state, member.unlockRank)) return `ต้องมีกิลด์ระดับ ${member.unlockRank}`;
  const f = member.famous;
  if (!f) return '';
  if (state.rep < f.rep) return `ต้องมีชื่อเสียง ${f.rep} · ${f.hint}`;
  if (f.needs === 'memberLevel' && !state.members.some(m => m.level >= f.value)) return f.hint;
  if (f.needs === 'facility' && !roomLevel(state, f.value)) return f.hint;
  if (f.needs === 'quest' && !state.completedQuests[f.value]) return f.hint;
  return '';
}
/** Named adventurers who have not joined: whether they would come, and what the guild still lacks. */
export function getAvailableRecruits(state) {
  return MEMBERS.filter(member => !member.starter && !memberById(state, member.id)).map(member => {
    const reason = namedReason(state, member);
    return { ...member, available: !reason, reason, applying: (state.applicants || []).some(a => a.memberId === member.id) };
  });
}
/** Fame draws applicants: about every 4 minutes at first, faster as renown grows. */
export function applicantInterval(state) { return Math.max(50, Math.round(240 / (1 + state.rep / 150))); }
const APPLICANT_START = { x: -12, y: 17.5 };
function applicantContent(state, applicant) {
  return applicant.memberId ? MEMBER_BY_ID[applicant.memberId] : { ...applicant.bio, id: applicant.rookieId, rookie: true, cost: applicant.fee };
}
/** Put an applicant at the door (named by id, or a new rookie), used by the arrival timer and by tests. */
export function addApplicant(state, memberId = null, options = {}) {
  state.applicants ??= [];
  const status = options.status || 'coming', b = buildingRect(state);
  const eta = Math.round((Math.abs(APPLICANT_START.x - (b.x + b.w / 2)) + Math.abs(APPLICANT_START.y - (b.y + b.h))) / PETITION_WALK + 3);
  const applicant = { id: `app-${state.nextId++}`, status, eta: status === 'coming' ? eta : 0, etaTotal: eta, patience: 160, memberId: null, rookieId: null, bio: null, level: 1, fee: 0, famous: false };
  if (memberId) {
    const content = MEMBER_BY_ID[memberId];
    if (!content || content.starter || memberById(state, memberId)) return null;
    Object.assign(applicant, { memberId, level: content.famous ? content.famous.level : Math.max(1, rankIndex(state.rank) + 1), fee: content.cost, famous: Boolean(content.famous) });
  } else {
    const pick = list => list[Math.floor(petitionRandom(state) * list.length) % list.length];
    const used = new Set([...state.members.map(m => m.name), ...state.applicants.map(a => a.bio?.name)]);
    const name = pick(ROOKIE_NAMES.filter(n => !used.has(n)).length ? ROOKIE_NAMES.filter(n => !used.has(n)) : ROOKIE_NAMES);
    applicant.rookieId = `r-${state.nextId++}`;
    applicant.bio = { name, class: pick(['warrior', 'archer', 'mage', 'healer']), trait: pick(TRAIT_NAMES), hair: pick(HAIR_COLORS), description: pick(ROOKIE_LINES) };
    applicant.level = Math.max(1, rankIndex(state.rank) + (petitionRandom(state) < 0.3 ? 1 : 0));
    applicant.fee = 60 + rankIndex(state.rank) * 70 + applicant.level * 10;
  }
  state.applicants.push(applicant);
  return applicant;
}
function tickApplicants(state, step) {
  state.applicants ??= [];
  if (!introActive(state) && roomLevel(state, 'reception')) {
    state.applicantClock = (state.applicantClock ?? 60) - step;
    if (state.applicantClock <= 0) {
      state.applicantClock = applicantInterval(state) * (0.8 + petitionRandom(state) * 0.4);
      if (state.applicants.length < 2 && state.members.length < 12) {
        const named = getAvailableRecruits(state).filter(m => m.available && !m.applying);
        const famous = named.filter(m => m.famous);
        const choice = famous.length ? famous[0] : named.length && petitionRandom(state) < 0.5 ? named[0] : null;
        const applicant = addApplicant(state, choice?.id || null);
        if (applicant?.famous) addLog(state, `ข่าวลือว่า${MEMBER_BY_ID[applicant.memberId].name}กำลังเดินทางมาที่กิลด์!`, 'rank');
      }
    }
  }
  for (const applicant of [...state.applicants]) {
    if (applicant.status === 'coming') {
      applicant.eta -= step;
      if (applicant.eta <= 0) { applicant.status = 'waiting'; applicant.eta = 0; addLog(state, `${applicantContent(state, applicant).name}มาขอสมัครเป็นนักผจญภัย`, 'member'); }
    } else if ((applicant.patience -= step) <= 0) {
      state.applicants = state.applicants.filter(a => a !== applicant);
      addLog(state, `${applicantContent(state, applicant).name}รอนานเกินไปจึงไปหากิลด์อื่น`, 'info');
    }
  }
}
function recruit(state, payload) {
  state.applicants ??= [];
  const applicant = state.applicants.find(a => a.status === 'waiting' && (a.id === payload.applicantId || (payload.memberId && a.memberId === payload.memberId)));
  if (!applicant) return failure('ยังไม่มีผู้สมัครคนนี้ที่ประตู');
  const content = applicantContent(state, applicant), stats = getGuildStats(state);
  if (stats.memberCount >= stats.memberCap) return failure('พื้นที่พักเต็มแล้ว วางเตียงเพิ่มก่อน');
  if (state.gold < applicant.fee) return failure('เหรียญไม่เพียงพอสำหรับค่าแรกเข้า');
  transact(state, { gold: applicant.fee }, `รับ ${content.name} เข้ากิลด์`);
  state.members.push(createMember(content, applicant.level));
  state.applicants = state.applicants.filter(a => a !== applicant);
  state.goals.firstRecruit = true;
  addLog(state, `${content.name} เข้าร่วมกิลด์: ${content.description}`, applicant.famous ? 'rank' : 'member');
  return success(`${content.name} เข้าร่วมกิลด์แล้ว`);
}
function declineApplicant(state, payload) {
  const applicant = (state.applicants || []).find(a => a.id === payload.applicantId);
  if (!applicant) return failure('ไม่พบผู้สมัคร');
  state.applicants = state.applicants.filter(a => a !== applicant);
  return success('ขอบคุณที่สนใจกิลด์ของเรา');
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

/** Chance of better chest finds: scouts, observant traits, lucky charms, careful plans and a strong team. */
export function getTeamLuck(state, memberIds = [], policy = 'balanced', readiness = 0) {
  const members = memberIds.map(id => memberById(state, id)).filter(Boolean);
  let luck = members.some(member => JOBS[member.class]?.role === 'scout') ? 0.12 : 0;
  for (const member of members) {
    luck += traitOf(member).luck || 0;
    for (const slot of ['weapon', 'accessory']) luck += EQUIPMENT_BY_ID[member.equipment?.[slot]]?.luck || 0;
  }
  luck += policy === 'cautious' ? 0.06 : policy === 'bold' ? -0.04 : 0;
  luck += clamp(((readiness || 0) - 1) * 0.15, 0, 0.08);
  return Math.round(clamp(luck, 0, 0.45) * 100) / 100;
}
/** Three chests per mission (two rooms and the boss); luck moves weight from common to rare finds. */
export function rollLoot(state, questId, luck) {
  const table = LOOT[questId];
  if (!table) return [];
  return [0, 1, 2].map(index => {
    const weights = { common: RARITIES.common.weight * (1 - luck) * (index === 2 ? 0.5 : 1), uncommon: RARITIES.uncommon.weight * (1 + luck),
      rare: RARITIES.rare.weight * (1 + luck * 4), legendary: RARITIES.legendary.weight * (1 + luck * 6) * (index === 2 ? 2 : 1) };
    let pick = nextRandom(state) * Object.values(weights).reduce((a, b) => a + b, 0), tier = 'common';
    for (const [name, weight] of Object.entries(weights)) { if (pick < weight) { tier = name; break; } pick -= weight; }
    const list = table[tier] || table.common, entry = list[Math.floor(nextRandom(state) * list.length) % list.length];
    return entry.kind === 'mat' ? { tier, kind: 'mat', key: entry.key, amount: entry.min + Math.floor(nextRandom(state) * (entry.max - entry.min + 1)) } : { tier, kind: 'item', id: entry.id };
  });
}
function grantLoot(state, mission, count) {
  const found = [];
  for (const entry of (mission.loot || []).slice(0, count)) {
    if (entry.kind === 'mat') transact(state, { [entry.key]: entry.amount }, 'หีบสมบัติ', 1);
    else if ((state.inventory[entry.id] || 0) < 24) state.inventory[entry.id] = (state.inventory[entry.id] || 0) + 1;
    else transact(state, { gold: 40 }, 'ขายของซ้ำจากหีบ', 1);
    found.push(entry);
    if (entry.kind === 'item' && EQUIPMENT_BY_ID[entry.id].loot) { state.foundTreasures ??= []; if (!state.foundTreasures.includes(entry.id)) state.foundTreasures.push(entry.id); }
    if (entry.kind === 'item' && (entry.tier === 'rare' || entry.tier === 'legendary')) addLog(state, `พบสมบัติ${RARITIES[entry.tier].name}: ${EQUIPMENT_BY_ID[entry.id].name}!`, 'loot');
  }
  return found;
}
/** Best available team (up to three) for a quest: cover its roles first, then add the strongest rested members. */
export function suggestTeam(state, questId, policy = 'balanced') {
  const quest = QUEST_BY_ID[questId];
  if (!quest) return [];
  const ready = state.members.filter(member => !isBusy(state, member.id) && member.energy >= 25 && member.injury <= 40);
  const score = member => getMemberStats(state, member).power * (0.6 + member.energy / 250);
  const team = [];
  for (const role of quest.tags) {
    const pick = ready.filter(member => !team.includes(member) && getMemberStats(state, member).role === role).sort((a, b) => score(b) - score(a))[0];
    if (pick && team.length < 3) team.push(pick);
  }
  for (const member of ready.filter(member => !team.includes(member)).sort((a, b) => score(b) - score(a))) if (team.length < 3) team.push(member);
  return team.map(member => member.id);
}
const SELL_RARITY = { rare: 120, legendary: 320 };
export function getSellPrice(id) { const item = EQUIPMENT_BY_ID[id]; if (!item) return 0; return item.loot ? SELL_RARITY[item.rarity] || 60 : Math.max(10, Math.round((item.cost.gold || 0) * 0.5)); }
function sellItem(state, payload) {
  const item = EQUIPMENT_BY_ID[payload.equipmentId];
  if (!item) return failure('ไม่พบอุปกรณ์');
  if (!(state.inventory[item.id] > 0)) return failure('ไม่มีของชิ้นนี้ในคลัง');
  state.inventory[item.id] -= 1;
  const price = getSellPrice(item.id);
  transact(state, { gold: price }, `ขาย${item.name}`, 1);
  return success(`ขาย${item.name} ได้ ${price} G`);
}
/** Give every member at home the strongest weapon and accessory available to their class. */
function autoEquip(state) {
  const value = item => (item?.power || 0) * 2 + (item?.health || 0) * 0.5 + (item?.luck || 0) * 40;
  let changes = 0;
  const members = state.members.filter(member => !isBusy(state, member.id)).sort((a, b) => getMemberStats(state, b).basePower - getMemberStats(state, a).basePower);
  for (const slot of ['weapon', 'accessory']) for (const member of members) {
    const current = EQUIPMENT_BY_ID[member.equipment[slot]];
    const best = EQUIPMENT.filter(item => item.slot === slot && state.inventory[item.id] > 0 && (!item.classes.length || item.classes.includes(equipmentBaseClass(member))))
      .sort((a, b) => value(b) - value(a))[0];
    if (best && value(best) > value(current)) { state.inventory[best.id] -= 1; if (current) state.inventory[current.id] = (state.inventory[current.id] || 0) + 1; member.equipment[slot] = best.id; (member.wear ??= { weapon: 100, accessory: 100 })[slot] = 100; changes++; }
  }
  return changes ? success(`จัดอุปกรณ์ใหม่ ${changes} ชิ้น`) : failure('ทุกคนใส่ของที่ดีที่สุดอยู่แล้ว');
}
export function previewMission(state, questId, memberIds = [], policy = 'balanced', options = {}) {
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
  if (!reason && (!Array.isArray(memberIds) || memberIds.length < 1 || memberIds.length > 3 || new Set(memberIds).size !== memberIds.length || members.length !== memberIds.length)) reason = 'เลือกสมาชิก 1–3 คน';
  if (!reason && members.some(member => isBusy(state, member.id))) reason = 'สมาชิกบางคนกำลังทำภารกิจ';
  if (!reason && members.some(member => member.energy < 25 || member.injury > 40)) reason = 'สมาชิกต้องพักให้พลังอย่างน้อย 25 และบาดเจ็บไม่เกิน 40';
  const slots = getGuildStats(state);
  if (!reason && (options.auto ? slots.boardMissions >= slots.boardCap : slots.activeMissions >= slots.teamCap)) reason = options.auto ? 'ช่องทีมจากกระดานเต็มแล้ว' : 'ทีมภารกิจเต็มแล้ว';
  if (!reason && !canAfford(state, quest.cost)) reason = 'เสบียงไม่เพียงพอ';
  if (!reason && state.missions.some(mission => mission.status === 'active' && mission.questId === quest.id)) reason = 'ภารกิจนี้มีทีมเดินทางอยู่แล้ว';
  const luck = getTeamLuck(state, Array.isArray(memberIds) ? memberIds : [], policy, readiness);
  return { ok: !reason, reason, power, difficulty: quest.difficulty, readiness, roles, missingRoles, luck,
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
  const preview = previewMission(state, payload.questId, payload.memberIds, payload.policy || 'balanced', { auto: payload.auto });
  if (!preview.ok) return failure(preview.reason);
  const quest = QUEST_BY_ID[payload.questId];
  state.petitions ??= [];
  const petition = payload.petitionId ? state.petitions.find(p => p.id === payload.petitionId)
    : state.petitions.filter(p => p.questId === quest.id && p.status === 'posted' && !p.missionId).sort((a, b) => Number(b.important) - Number(a.important))[0];
  if (!petition || petition.questId !== quest.id || petition.status !== 'posted' || petition.missionId) return failure('ยังไม่มีคำร้องนี้บนกระดาน รับคำร้องจากชาวบ้านก่อน');
  if (payload.plan !== undefined && !PAYOUT_PLANS[payload.plan]) return failure('แผนค่าตอบแทนไม่ถูกต้อง');
  if (payload.plan) petition.plan = payload.plan;
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
  mission.luck = preview.luck;
  mission.loot = rollLoot(state, quest.id, preview.luck);
  mission.petition = { id: petition.id, fee: petition.fee, plan: petition.plan, client: petition.client, important: petition.important };
  mission.prep = payload.auto ? 5 : 0;
  if (payload.auto) mission.auto = true;
  petition.status = 'taken'; petition.missionId = mission.id;
  state.missions.push(mission);
  party.forEach(member => { member.task = 'mission'; });
  // Members who packed rations take them along: the journey tires them less.
  mission.rations = party.filter(member => member.pack?.ration > 0).map(member => { member.pack.ration -= 1; return member.id; });
  addLog(state, payload.auto ? `${party.map(member => member.name).join(' · ')} หยิบงาน “${quest.name}” จากกระดานแล้ว` : `ส่ง ${party.map(member => member.name).join(' · ')} ไป${quest.name}`, 'mission');
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
    let wages = 0;
    if (mission.petition) {
      // The client pays the fee; the guild keeps its commission and the team shares the rest.
      const pay = getPayout(state, Math.floor(mission.petition.fee * multiplier), mission.petition.plan);
      rewards.gold = pay.guild; wages = pay.adventurers;
      mission.memberIds.forEach(id => { const member = memberById(state, id); member.purse = (member.purse || 0) + wages / mission.memberIds.length; });
      state.village.prosperity += pay.fee * 0.05;
    }
    transact(state, rewards, mission.petition ? `ค่านายหน้า: ${quest.name}` : `รางวัล: ${quest.name}`, 1);
    // Work the adventurers picked up by themselves earns the guild half the renown of work it sends.
    const rep = Math.max(1, Math.round(quest.reward.rep * multiplier * renownFactor(state, quest) * (mission.auto ? 0.5 : 1) * (1 + roomLevel(state, 'reception') * 0.05)));
    state.rep += rep;
    state.completedQuests[quest.id] = (state.completedQuests[quest.id] || 0) + 1;
    if (mission.petition) { state.record ??= { jobs: 0 }; state.record.jobs += 1; }
    state.questRuns[quest.id] = (state.questRuns[quest.id] || 0) + 1;
    mission.result = { success: true, reward: { ...rewards, rep }, wages: Math.round(wages), title: 'กลับบ้านอย่างปลอดภัย', message: mission.petition ? `${quest.name} สำเร็จ ${mission.petition.client}จ่าย ${Math.floor(mission.petition.fee * multiplier)} G · กิลด์ได้ค่านายหน้า ${rewards.gold} G · ทีมได้ ${Math.round(wages)} G` : `${quest.name} สำเร็จ ได้ ${rewards.gold} เหรียญ และชื่อเสียง ${rep}` };
    if (mission.petition) state.petitions = state.petitions.filter(p => p.id !== mission.petition.id);
    mission.result.loot = grantLoot(state, mission, 3);
    state.goals.firstMission = true;
    improveBonds(state, mission.memberIds, 9);
    if (quest.id === 'hollow') state.story.chapter = Math.max(2, state.story.chapter);
    if (quest.id === 'ruins') state.story.chapter = Math.max(3, state.story.chapter);
    if (quest.id === 'rescue') state.story.chapter = Math.max(4, state.story.chapter);
    if (quest.final) {
      state.story.finished = true;
      state.story.chapter = 5;
      state.story.finishedAt = state.elapsed;
      addLog(state, 'หมอกจางลง ทีมสำรวจกลับถึงบ้าน หัวใจป่าผลิใบใหม่ ชาวเมืองร่วมฉลองใต้ต้นไม้ของกิลด์ — จบบทแรก (เดโม่) แล้ว เล่นดูแลกิลด์ต่อได้ ระดับ B ขึ้นไปจะเปิดพร้อมแผนที่ใหม่ในเกมเต็ม', 'story');
    }
    addLog(state, mission.result.message, 'success');
  } else {
    mission.result = { success: false, reward: {}, title: 'ถอยกลับมาพัก', message: `ทีมถอยจาก${quest.name} ทุกคนกลับมาแล้ว ลองฝึกและเตรียมอุปกรณ์ก่อนออกใหม่` };
    reopenPetition(state, mission);
    mission.result.loot = grantLoot(state, mission, 1);
    addLog(state, mission.result.message, 'warning');
  }
  mission.memberIds.forEach(id => {
    const member = memberById(state, id);
    member.task = 'rest';
    member.energy = clamp(member.energy - mission.energyCost * (mission.rations?.includes(member.id) ? 0.7 : 1), 0, 100);
    member.morale = clamp(member.morale + (won ? 7 : -9) + (won && mission.petition ? PAYOUT_PLANS[mission.petition.plan]?.morale || 0 : 0), 20, 100);
    const injury = won ? Math.max(0, Math.round((1.12 - readiness) * 23 + mission.risk * 3)) : 16 + Math.round(mission.risk * 10);
    const healerReduction = mission.roles?.includes('heal') ? 3 : 0;
    let hurt = Math.max(0, injury - (traitOf(member).injuryReduction || 0) - healerReduction);
    if (hurt > 4 && member.pack?.potion > 0) { member.pack.potion -= 1; hurt = Math.round(hurt / 2); }
    member.injury = clamp(member.injury + hurt, 0, 100);
    // Gear wears with every journey, more on a retreat; the smithy mends it.
    member.wear ??= { weapon: 100, accessory: 100 };
    for (const slot of ['weapon', 'accessory']) if (member.equipment[slot]) member.wear[slot] = Math.max(0, member.wear[slot] - Math.round(7 + mission.risk * 6 + (won ? 0 : 8)));
    member.missionsDone += won ? 1 : 0;
    addXp(state, member, quest.reward.xp * (won ? 1 : 0.35));
  });
  updateRank(state);
  trimMissions(state);
}

/** A failed or recalled job goes back on the board for another try. */
function reopenPetition(state, mission) {
  const petition = mission.petition && state.petitions?.find(p => p.id === mission.petition.id);
  if (petition) { petition.status = 'posted'; petition.missionId = null; petition.age = 0; }
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
  while (nextRank && getRankProgress(state, nextRank).examReady && (!RANK_REQUIREMENTS[nextRank].quest || state.completedQuests[RANK_REQUIREMENTS[nextRank].quest])) {
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
  const shop = state.village?.shop || 0, market = state.village?.market || 0;
  if (shop) transact(state, { gold: shop * 20 }, 'ค่าเช่าร้านค้าในหมู่บ้าน', 1);
  if (market) transact(state, { wood: market * 3, stone: market * 2, herb: market * 2 }, 'ของจากตลาดนัด', 1);
  settleIdle(state, true);
  restockShops(state);
  state.daily = { missionCounts: {}, work: {}, garden: Boolean(garden) };
  if (state.day % 3 === 0) {
    const choices = ['ชาวบ้านฝากขนมปังมาให้กิลด์ สมาชิกทุกคนขวัญดีขึ้น', 'เด็ก ๆ นำภาพวาดทีมกิลด์มาติดผนัง ทุกคนยิ้มให้กัน'];
    const text = choices[Math.floor(nextRandom(state) * choices.length)];
    state.members.forEach(member => { member.morale = clamp(member.morale + 4, 0, 100); });
    addLog(state, text, 'cozy');
  }
}


// ---- Petitions: villagers bring requests, the guild posts them, adventurers take them. ----
const IMPORTANT_QUESTS = new Set(['patrol', ...Object.values(RANK_REQUIREMENTS).map(r => r.quest).filter(Boolean), ...QUESTS.filter(q => q.story).map(q => q.id), ...QUESTS.map(q => q.requires).filter(Boolean)]);
const PETITION_WALK = 0.9;
const BOARD_LIFETIME = 720;
/** Story and rank steps stay "important" (reserved for the player) until first cleared. */
export function isImportantQuest(state, questId) { return IMPORTANT_QUESTS.has(questId) && !state.completedQuests[questId]; }
function petitionRandom(state) {
  let x = state.petitionRng | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.petitionRng = x >>> 0 || 7;
  return state.petitionRng / 4294967296;
}
const questOpen = (state, quest) => (hasRank(state, quest.rank) || examReady(state, quest)) && (!quest.requires || state.completedQuests[quest.requires]);
/** Where a client's home door is, for walking times; lots come from content, the inn and bakery stand by the guild. */
export function petitionHome(home) {
  if (home === 'inn') return { x: -2.2, y: 10.8 };
  if (home === 'bakery') return { x: 24.3, y: 15.8 };
  if (home === 'elder') return { x: 0.3, y: -0.5 };
  if (home === 'road') return { x: -12, y: 17.5 };
  const lot = VILLAGE_LOTS.houses[home];
  return lot ? { x: lot.x + 1.2, y: lot.y + 2.4 } : { x: 2, y: 18 };
}
export function guildDoor(state) { const b = buildingRect(state); return { x: b.x + b.w / 2, y: b.y + b.h + 0.6 }; }
export function petitionWalkTime(state, home) { const a = petitionHome(home), b = guildDoor(state); return Math.round((Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) / PETITION_WALK + 3); }
export function getPayout(state, fee, planId = 'standard') {
  const plan = PAYOUT_PLANS[planId] || PAYOUT_PLANS.standard, bonus = Math.min(0.4, (state.upgrades?.contracts || 0) * 0.04);
  const guild = Math.min(fee, Math.round(fee * (1 - plan.share + bonus)));
  return { fee, guild, adventurers: fee - guild, plan };
}
function syncImportant(state) {
  state.petitions ??= [];
  // Letters for steps already cleared some other way are taken down.
  if (state.petitions.some(p => p.important && !p.missionId && !isImportantQuest(state, p.questId))) state.petitions = state.petitions.filter(p => !p.important || p.missionId || isImportantQuest(state, p.questId));
  for (const quest of QUESTS) {
    if (!isImportantQuest(state, quest.id) || !questOpen(state, quest)) continue;
    if (state.petitions.some(p => p.questId === quest.id && p.important)) continue;
    state.petitions.push({ id: `pet-${state.nextId++}`, questId: quest.id, client: 'ผู้ใหญ่บ้าน', seed: 7, home: 'elder', important: true, reserved: true,
      fee: Math.round(quest.reward.gold * FEE_MULTIPLIER), plan: 'standard', status: 'posted', eta: 0, etaTotal: 20, patience: 80, age: 0, missionId: null });
  }
}
export function getVillageInfo(state) {
  const v = state.village || { prosperity: 0, houses: 3 };
  let index = 0;
  for (let i = 0; i < VILLAGE_LEVELS.length; i++) if (v.prosperity >= VILLAGE_LEVELS[i].prosperity) index = i;
  const now = VILLAGE_LEVELS[index], next = VILLAGE_LEVELS[index + 1] || null;
  return { level: now.level, name: now.name, prosperity: Math.floor(v.prosperity), next, progress: next ? clamp((v.prosperity - now.prosperity) / (next.prosperity - now.prosperity), 0, 1) : 1,
    houses: v.houses, maxHouses: Math.min(VILLAGE_LOTS.houses.length, 2 + now.level * 2), shop: v.shop || 0, market: v.market || 0, smithy: v.smithy || 0,
    interval: petitionInterval(state), maxWaiting: 2 + Math.floor(now.level / 2), maxPosted: 4 + roomLevel(state, 'reception'), idleRate: idleRate(state) };
}
function petitionInterval(state) {
  const houses = state.village?.houses || 0, sign = state.upgrades?.signboard || 0;
  return Math.max(10, Math.round(52 / ((1 + sign * 0.1) * (1 + houses * 0.12))));
}
/** Gold per second that keeps flowing in, even while the game is closed. */
export function idleRate(state) { return Math.round(((state.upgrades?.coffer || 0) * 0.25 + (state.village?.market || 0) * 0.15) * 100) / 100; }
const levelCost = (base, growth, level) => Object.fromEntries(Object.entries(base).map(([key, value]) => [key, Math.ceil(value * Math.pow(growth, level))]));
export function getGuildUpgradeCost(state, id) { const u = GUILD_UPGRADES[id]; return u ? levelCost(u.base, u.growth, state.upgrades?.[id] || 0) : null; }
export function getProjectCost(state, id) { const p = VILLAGE_PROJECTS[id]; if (!p) return null; const level = id === 'house' ? Math.max(0, (state.village?.houses || 0) - 3) : state.village?.[id] || 0; return levelCost(p.base, p.growth, level); }
export function getProjectStatus(state, id) {
  const p = VILLAGE_PROJECTS[id], info = getVillageInfo(state);
  if (!p) return { ok: false, reason: 'ไม่พบโครงการ', level: 0 };
  const level = id === 'house' ? info.houses : info[id], max = id === 'house' ? info.maxHouses : p.max;
  let reason = '';
  if (info.level < p.villageLevel) reason = `ต้องเป็น${VILLAGE_LEVELS[p.villageLevel - 1].name} (ระดับ ${p.villageLevel})`;
  else if (level >= p.max) reason = 'สร้างครบแล้ว';
  else if (level >= max) reason = `หมู่บ้านระดับ ${info.level} มีที่ดินว่างครบแล้ว ให้หมู่บ้านเติบโตก่อน`;
  else if (!canAfford(state, getProjectCost(state, id))) reason = 'ทรัพยากรไม่เพียงพอ';
  return { ok: !reason, reason, level, max: p.max, cost: getProjectCost(state, id) };
}
export const TRADE_LOT = { wood: 10, stone: 10, herb: 5 };
const MARKET_START = { wood: 30, stone: 24, herb: 20 };
/** A material's price: scarce in the village means dear, plenty means cheap (half to one and a half of base). */
export function marketPrice(state, key) { const stock = state.market?.[key] ?? MARKET_START[key]; return Math.round(MATERIALS[key].price * clamp(1.5 - stock / 60, 0.5, 1.5) * 10) / 10; }
/** Gold for selling (or cost of buying) a lot, unit by unit as the price moves. */
export function tradeQuote(state, key, sell = true) {
  let stock = state.market?.[key] ?? MARKET_START[key], gold = 0;
  for (let i = 0; i < TRADE_LOT[key]; i++) { const price = MATERIALS[key].price * clamp(1.5 - stock / 60, 0.5, 1.5); if (sell) { gold += price * 0.9; stock += 1; } else { gold += price * 1.2; stock -= 1; } }
  return { amount: TRADE_LOT[key], gold: sell ? Math.floor(gold) : Math.ceil(gold), available: sell || (state.market?.[key] ?? MARKET_START[key]) >= TRADE_LOT[key] };
}
/** What an adventurer pays the smithy for a piece of gear, and to mend it. */
export function gearPrice(item) { return Math.round((item.cost.gold || 0) * 1.2 + (item.cost.wood || 0) * 4 + (item.cost.stone || 0) * 5 + (item.cost.herb || 0) * 6); }
export function repairCost(item, wear) { return Math.ceil(gearPrice(item) * 0.25 * (100 - wear) / 100); }
const gearValue = item => (item?.power || 0) * 2 + (item?.health || 0) * 0.5 + (item?.luck || 0) * 40;
/** Worn gear (below a quarter) keeps only 60% of its power until mended. */
const wearFactor = (member, slot) => (member.wear?.[slot] ?? 100) < 25 ? 0.6 : 1;

/** Add a petition straight to the desk or the board (used by the village flow and by tests). */
export function addPetition(state, questId, options = {}) {
  const quest = QUEST_BY_ID[questId];
  if (!quest) return null;
  const homes = [...Array(Math.min(state.village?.houses || 0, VILLAGE_LOTS.houses.length)).keys(), 'inn', 'bakery'];
  const home = options.home ?? homes[Math.floor(petitionRandom(state) * homes.length) % homes.length];
  const status = options.status || 'coming', eta = petitionWalkTime(state, home);
  const petition = { id: `pet-${state.nextId++}`, questId, client: VILLAGER_NAMES[Math.floor(petitionRandom(state) * VILLAGER_NAMES.length) % VILLAGER_NAMES.length],
    seed: Math.floor(petitionRandom(state) * 100000), home, important: false, reserved: false,
    fee: Math.round(quest.reward.gold * FEE_MULTIPLIER * (0.85 + petitionRandom(state) * 0.3)), plan: options.plan || state.payoutPlan || 'standard',
    status, eta: status === 'coming' ? eta : 0, etaTotal: eta, patience: 80 + (state.upgrades?.clerk || 0) * 25, age: 0, missionId: null };
  state.petitions.push(petition);
  return petition;
}
function spawnPetition(state) {
  const open = QUESTS.filter(q => questOpen(state, q) && !q.final && !isImportantQuest(state, q.id)
    && state.petitions.filter(p => p.questId === q.id).length < 2);
  if (!open.length) return null;
  // Villagers bring work that suits the guild's standing: mostly at its rank, less of what it has outgrown.
  const weights = open.map(q => { const gap = rankIndex(state.rank) - rankIndex(q.rank); return gap <= 0 ? 3 : gap === 1 ? 1.2 : 0.5; });
  let pick = petitionRandom(state) * weights.reduce((a, b) => a + b, 0), quest = open[0];
  for (let i = 0; i < open.length; i++) { if (pick < weights[i]) { quest = open[i]; break; } pick -= weights[i]; }
  return addPetition(state, quest.id);
}
function postPetition(state, petition, planId) {
  petition.status = 'posted'; petition.plan = PAYOUT_PLANS[planId] ? planId : 'standard'; petition.age = 0;
  state.village.prosperity += 4;
}
/** Free adventurers: at home, rested, not training, and willing to take board work. */
function freeForBoard(state, member) {
  return !isBusy(state, member.id) && member.task !== 'train' && member.energy >= 70 && member.injury <= 15 && member.autoWork !== false;
}
/** The smallest strong-enough team from the free adventurers: cover roles, then add the strongest until ready. */
function pickBoardTeam(state, quest, planId) {
  const plan = PAYOUT_PLANS[planId] || PAYOUT_PLANS.standard;
  const pool = state.members.filter(member => freeForBoard(state, member));
  if (!pool.length) return null;
  const score = member => getMemberStats(state, member).power;
  const team = [];
  const ready = () => previewMission(state, quest.id, team.map(m => m.id), 'balanced', { auto: true }).readiness >= plan.readiness + 0.1;
  for (const role of quest.tags) {
    if (team.length >= 3 || (team.length && ready())) break;
    const pick = pool.filter(m => !team.includes(m) && getMemberStats(state, m).role === role).sort((a, b) => score(b) - score(a))[0];
    if (pick) team.push(pick);
  }
  for (const member of pool.filter(m => !team.includes(m)).sort((a, b) => score(b) - score(a))) { if (team.length >= 3 || (team.length && ready())) break; team.push(member); }
  const preview = previewMission(state, quest.id, team.map(m => m.id), 'balanced', { auto: true });
  return preview.ok && preview.readiness >= plan.readiness ? team.map(m => m.id) : null;
}
function tickPetitions(state, step) {
  state.petitions ??= [];
  syncImportant(state);
  const desk = roomLevel(state, 'reception') > 0, info = getVillageInfo(state);
  if (desk && !introActive(state)) {
    state.petitionClock -= step;
    if (state.petitionClock <= 0) {
      state.petitionClock = info.interval * (0.75 + petitionRandom(state) * 0.5);
      const queued = state.petitions.filter(p => p.status === 'coming' || p.status === 'waiting').length;
      const posted = state.petitions.filter(p => p.status === 'posted' && !p.important).length;
      if (queued < info.maxWaiting && posted < info.maxPosted) spawnPetition(state);
    }
  }
  for (const petition of [...state.petitions]) {
    if (petition.status === 'coming') {
      petition.eta -= step;
      if (petition.eta <= 0) { petition.status = 'waiting'; petition.eta = 0; addLog(state, `${petition.client}มาส่งคำร้อง “${QUEST_BY_ID[petition.questId].name}” ที่โต๊ะรับคำร้อง`, 'petition'); }
    } else if (petition.status === 'waiting') {
      const posted = state.petitions.filter(p => p.status === 'posted' && !p.important).length;
      if ((state.upgrades?.clerk || 0) > 0 && posted < info.maxPosted) { postPetition(state, petition, state.payoutPlan); addLog(state, `เสมียนรับคำร้อง “${QUEST_BY_ID[petition.questId].name}” ขึ้นกระดานแล้ว`, 'petition'); continue; }
      petition.patience -= step;
      if (petition.patience <= 0) { state.petitions = state.petitions.filter(p => p !== petition); addLog(state, `${petition.client}รอนานเกินไปเลยกลับบ้านก่อน`, 'info'); }
    } else if (petition.status === 'posted') {
      petition.age += step;
      if (!petition.important && petition.age > BOARD_LIFETIME) { state.petitions = state.petitions.filter(p => p !== petition); addLog(state, `คำร้อง “${QUEST_BY_ID[petition.questId].name}” ไม่มีใครรับจนหมดเวลา ชาวบ้านไปหาทางอื่นแล้ว`, 'warning'); }
    }
  }
  // Adventurers with nothing to do walk to the board and take work they can handle.
  if (!roomLevel(state, 'board')) return;
  const stats = getGuildStats(state);
  if (stats.boardMissions >= stats.boardCap) return;
  const board = state.petitions.filter(p => p.status === 'posted' && !p.reserved && !p.missionId && p.age >= 8 / (PAYOUT_PLANS[p.plan]?.eager || 1))
    .sort((a, b) => (PAYOUT_PLANS[b.plan]?.share || 0) * b.fee - (PAYOUT_PLANS[a.plan]?.share || 0) * a.fee);
  for (const petition of board) {
    const quest = QUEST_BY_ID[petition.questId];
    if (state.missions.some(m => m.status === 'active' && m.questId === quest.id) || !canAfford(state, quest.cost)) continue;
    const team = pickBoardTeam(state, quest, petition.plan);
    if (!team) continue;
    const result = sendMission(state, { questId: quest.id, memberIds: team, policy: 'balanced', petitionId: petition.id, auto: true });
    if (result.ok) break;
  }
}
function settleIdle(state, force = false) {
  if (state.idleBank >= 40 || (force && state.idleBank >= 1)) {
    const gold = Math.floor(state.idleBank);
    state.idleBank -= gold;
    transact(state, { gold }, 'ดอกผลกองทุนและค่าแผงตลาด', 1);
  }
}
function tickVillage(state, step) {
  state.idleBank = (state.idleBank || 0) + idleRate(state) * step;
  settleIdle(state);
  for (const member of state.members) {
    if (isBusy(state, member.id)) continue;
    member.shopClock = (member.shopClock ?? (hashId(member.id) % 8)) - step;
    if (member.shopClock > 0) continue;
    member.shopClock = 8;
    memberShopping(state, member);
  }
}
const hashId = id => [...String(id)].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);
/** Money spent in the village shops makes the village more prosperous. */
function spendInVillage(state, member, gold) { member.purse -= gold; state.village.prosperity += gold * 0.1; state.village.trade = (state.village.trade || 0) + gold; }
/** An adventurer at home looks after themselves: mend gear, pack supplies, save for and buy better gear, then treats. */
function memberShopping(state, member) {
  const v = state.village, shops = state.shops;
  member.pack ??= { ration: 0, potion: 0 }; member.wear ??= { weapon: 100, accessory: 100 };
  if (v.smithy) for (const slot of ['weapon', 'accessory']) {
    const item = EQUIPMENT_BY_ID[member.equipment[slot]];
    if (!item || member.wear[slot] >= 60) continue;
    const cost = repairCost(item, member.wear[slot]);
    if (member.purse >= cost) { spendInVillage(state, member, cost); member.wear[slot] = 100; }
  }
  if (v.shop) for (const id of ['ration', 'potion']) {
    if ((member.pack[id] || 0) >= 1 || !(shops[id] > 0) || member.purse < CONSUMABLES[id].price) continue;
    spendInVillage(state, member, CONSUMABLES[id].price); shops[id] -= 1; member.pack[id] = (member.pack[id] || 0) + 1;
  }
  if (v.smithy) for (const slot of ['weapon', 'accessory']) {
    const current = EQUIPMENT_BY_ID[member.equipment[slot]];
    const best = Object.entries(shops.gear).filter(([, n]) => n > 0).map(([id]) => EQUIPMENT_BY_ID[id])
      .filter(item => item.slot === slot && (!item.classes.length || item.classes.includes(equipmentBaseClass(member))) && gearValue(item) > gearValue(current) * 1.15 + 2 && gearPrice(item) <= member.purse)
      .sort((a, b) => gearValue(b) - gearValue(a))[0];
    if (!best) continue;
    spendInVillage(state, member, gearPrice(best)); if (!(shops.gear[best.id] -= 1)) delete shops.gear[best.id];
    if (current) { shops.gear[current.id] = (shops.gear[current.id] || 0) + 1; member.purse += Math.floor(gearPrice(current) * 0.25); }
    member.equipment[slot] = best.id; member.wear[slot] = 100;
    addLog(state, `${member.name}ซื้อ${best.name}ด้วยเงินของตัวเองที่โรงตีเหล็ก`, 'member');
  }
  // Treats only from savings beyond what the next upgrade needs.
  if (v.shop && member.purse > 90) { const treat = Math.min(member.purse - 90, 6 + v.shop * 3); spendInVillage(state, member, treat); member.morale = clamp(member.morale + treat * 0.5, 0, 100); }
}
/** Each morning the shops restock from the village market, and the village uses up some of its stock. */
function restockShops(state) {
  const v = state.village, shops = state.shops, m = state.market;
  const take = (cost, times = 1) => { for (const [k, n] of Object.entries(cost)) if ((m[k] || 0) < n * times) return false; for (const [k, n] of Object.entries(cost)) m[k] -= n * times; return true; };
  if (v.shop) for (const [id, c] of Object.entries(CONSUMABLES)) { const want = (id === 'ration' ? 4 : 3) * v.shop; while ((shops[id] || 0) < want && take({ herb: c.herb })) shops[id] = (shops[id] || 0) + 1; }
  if (v.smithy) for (const item of EQUIPMENT.filter(e => !e.loot && e.workshopLevel <= v.smithy && hasRank(state, e.unlockRank))) {
    while ((shops.gear[item.id] || 0) < 1 + (v.smithy >= 2 ? 1 : 0) && take({ wood: item.cost.wood || 0, stone: item.cost.stone || 0, herb: item.cost.herb || 0 })) shops.gear[item.id] = (shops.gear[item.id] || 0) + 1;
  }
  for (const k of Object.keys(MATERIALS)) m[k] = Math.max(0, Math.floor(m[k] * 0.9));
}
function sellMaterial(state, payload) {
  const key = payload.key;
  if (!MATERIALS[key]) return failure('ตลาดไม่รับของชนิดนี้');
  const quote = tradeQuote(state, key, true);
  if (state[key] < quote.amount) return failure(`มี${MATERIALS[key].name}ไม่ถึง ${quote.amount}`);
  transact(state, { [key]: quote.amount }, `ขาย${MATERIALS[key].name}ให้ตลาด`);
  transact(state, { gold: quote.gold }, `ขาย${MATERIALS[key].name}ให้ตลาด`, 1);
  state.market[key] += quote.amount;
  return success(`ขาย${MATERIALS[key].name} ${quote.amount} ได้ ${quote.gold} G`);
}
function buyUpgrade(state, payload) {
  const u = GUILD_UPGRADES[payload.upgradeId];
  if (!u) return failure('ไม่พบการพัฒนา');
  const level = state.upgrades[payload.upgradeId] || 0;
  if (level >= u.max) return failure('พัฒนาถึงระดับสูงสุดแล้ว');
  const cost = getGuildUpgradeCost(state, payload.upgradeId);
  if (!canAfford(state, cost)) return failure('ทรัพยากรไม่เพียงพอ');
  transact(state, cost, `พัฒนา${u.name}`);
  state.upgrades[payload.upgradeId] = level + 1;
  addLog(state, `${u.name} เป็นระดับ ${level + 1}`, 'build');
  return success(`${u.name} ระดับ ${level + 1}`);
}
function buildProject(state, payload) {
  const id = payload.projectId, p = VILLAGE_PROJECTS[id], status = getProjectStatus(state, id);
  if (!status.ok) return failure(status.reason);
  transact(state, status.cost, `หมู่บ้าน: ${p.name}`);
  if (id === 'house') state.village.houses += 1; else state.village[id] = (state.village[id] || 0) + 1;
  if (id === 'shop' || id === 'smithy') restockShops(state);
  const before = getVillageInfo(state).level;
  state.village.prosperity += p.prosperity;
  const after = getVillageInfo(state);
  addLog(state, id === 'house' ? 'ครอบครัวใหม่ย้ายเข้าบ้านหลังใหม่ในหมู่บ้าน' : `${p.name}ระดับ ${state.village[id]} เปิดในหมู่บ้านแล้ว`, 'build');
  if (after.level > before) addLog(state, `หมู่บ้านเติบโตเป็น “${after.name}” บ้านเรือนขยายและมีที่ดินว่างเพิ่ม`, 'rank');
  return success(id === 'house' ? 'สร้างบ้านใหม่แล้ว' : `${p.name}ระดับ ${state.village[id]}`);
}
function buyMaterial(state, payload) {
  const key = payload.key;
  if (!MATERIALS[key]) return failure('ตลาดไม่มีของชนิดนี้');
  const quote = tradeQuote(state, key, false);
  if (!quote.available) return failure(`ตลาดมี${MATERIALS[key].name}ไม่พอ`);
  if (state.gold < quote.gold) return failure('เหรียญไม่เพียงพอ');
  transact(state, { gold: quote.gold }, `ซื้อ${MATERIALS[key].name}จากตลาด`);
  transact(state, { [key]: quote.amount }, `ซื้อ${MATERIALS[key].name}จากตลาด`, 1);
  state.market[key] -= quote.amount;
  state.village.prosperity += quote.gold * 0.1;
  return success(`ซื้อ${MATERIALS[key].name} +${quote.amount}`);
}
/** Income earned while the game was closed: the coffer and market keep paying for up to two hours. */
function collectIdle(state, payload) {
  const seconds = clamp(Number(payload.seconds) || 0, 0, 7200), gold = Math.floor(idleRate(state) * seconds);
  if (gold < 1) return failure('ยังไม่มีดอกผลสะสม');
  transact(state, { gold }, 'ดอกผลระหว่างปิดเกม', 1);
  return { ok: true, message: `ระหว่างที่ไม่อยู่ กองทุนและตลาดได้ ${gold} G`, gold };
}
function petitionCommand(state, type, payload) {
  const petition = state.petitions.find(p => p.id === payload.petitionId);
  if (!petition) return failure('ไม่พบคำร้องนี้');
  if (type === 'acceptPetition') {
    if (petition.status !== 'waiting') return failure('คำร้องนี้ยังไม่ถึงโต๊ะหรือรับไปแล้ว');
    if (state.petitions.filter(p => p.status === 'posted' && !p.important).length >= getVillageInfo(state).maxPosted) return failure('กระดานเต็มแล้ว อัปเกรดโต๊ะรับคำร้องหรือรอให้งานเดิมเสร็จ');
    if (payload.plan && !PAYOUT_PLANS[payload.plan]) return failure('แผนค่าตอบแทนไม่ถูกต้อง');
    postPetition(state, petition, payload.plan || state.payoutPlan);
    addLog(state, `รับคำร้องของ${petition.client}: ${QUEST_BY_ID[petition.questId].name} (${PAYOUT_PLANS[petition.plan].name})`, 'petition');
    return success('ติดคำร้องบนกระดานแล้ว');
  }
  if (type === 'declinePetition') {
    if (petition.important) return failure('คำร้องสำคัญปฏิเสธไม่ได้');
    if (petition.missionId) return failure('มีทีมรับงานนี้อยู่');
    state.petitions = state.petitions.filter(p => p !== petition);
    return success('ปฏิเสธคำร้องอย่างสุภาพแล้ว');
  }
  // setPetition: change payout plan or reserve for the player's own pick.
  if (petition.status !== 'posted' || petition.missionId) return failure('แก้ได้เฉพาะคำร้องบนกระดานที่ยังไม่มีคนรับ');
  if (payload.plan !== undefined) { if (!PAYOUT_PLANS[payload.plan]) return failure('แผนค่าตอบแทนไม่ถูกต้อง'); petition.plan = payload.plan; }
  if (payload.reserved !== undefined) petition.reserved = petition.important || Boolean(payload.reserved);
  return success(petition.reserved ? 'จองงานนี้ไว้ให้ทีมที่คุณเลือก' : 'เปิดให้นักผจญภัยหยิบเอง');
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
      if (mission.prep > 0) { mission.prep = Math.max(0, mission.prep - step); continue; }
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
    if (state.intro) advanceIntro(state, step);
    tickPetitions(state, step);
    tickApplicants(state, step);
    tickVillage(state, step);
    if (state.clock >= DAY_LENGTH - 0.00001) {
      state.clock = 0;
      state.day += 1;
      dailyUpdate(state);
    }
    remaining -= step;
  }
  return state;
}

function build(state, payload) {
  const content = FACILITIES[payload.type];
  if (!content) return failure('ไม่พบของชนิดนี้');
  if (!hasRank(state, content.unlockRank)) return failure(`ต้องมีกิลด์ระดับ ${content.unlockRank}`);
  if (['reception', 'dispatch', 'board'].includes(payload.type) && state.facilities.some(room => room.type === payload.type)) return failure('ของชนิดนี้มีได้หนึ่งชิ้น');
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

/** The village smithy takes 10% off the gold of every recipe per level. */
export function getCraftCost(state, item) { const off = Math.min(0.3, (state.village?.smithy || 0) * 0.1); return { ...item.cost, gold: Math.round((item.cost.gold || 0) * (1 - off)) }; }
function craft(state, payload) {
  const item = EQUIPMENT_BY_ID[payload.equipmentId];
  if (!item) return failure('ไม่พบสูตรอุปกรณ์');
  if (!hasRank(state, item.unlockRank)) return failure(`สูตรนี้ต้องมีกิลด์ระดับ ${item.unlockRank}`);
  if (bestRoomLevel(state, 'workshop') < item.workshopLevel) return failure(`ต้องมีโต๊ะช่างระดับ ${item.workshopLevel}`);
  const cost = getCraftCost(state, item);
  if (!canAfford(state, cost)) return failure('วัตถุดิบไม่เพียงพอ');
  if ((state.inventory[item.id] || 0) >= 24) return failure('มีอุปกรณ์ชนิดนี้มากเพียงพอแล้ว');
  transact(state, cost, `สร้าง${item.name}`);
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
  (member.wear ??= { weapon: 100, accessory: 100 })[item.slot] = 100;
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
  const result = command(state, type, payload);
  if (result?.ok && state?.intro) advanceIntro(state);
  return result;
}
function command(state, type, payload = {}) {
  if (!state || typeof state !== 'object') return failure('ไม่พบข้อมูลกิลด์');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return failure('คำสั่งไม่ถูกต้อง');
  switch (type) {
    case 'welcomeVisitors': return welcomeVisitors(state);
    case 'sellItem': return sellItem(state, payload);
    case 'autoEquip': return autoEquip(state);
    case 'setProfile': state.profile = normalizeProfile({ ...(state.profile || DEFAULT_PROFILE), ...payload }); return success(`บันทึกข้อมูล${state.profile.guildName}แล้ว`);
    case 'sendMission': return sendMission(state, { ...payload, auto: false });
    case 'acceptPetition': case 'declinePetition': case 'setPetition': return petitionCommand(state, type, payload);
    case 'setPayoutPlan': if (!PAYOUT_PLANS[payload.plan]) return failure('แผนค่าตอบแทนไม่ถูกต้อง'); state.payoutPlan = payload.plan; return success(`ตั้งค่าตอบแทนเริ่มต้นเป็น${PAYOUT_PLANS[payload.plan].name}`);
    case 'setAutoWork': { const member = memberById(state, payload.memberId); if (!member) return failure('ไม่พบสมาชิก'); member.autoWork = Boolean(payload.autoWork); return success(member.autoWork ? `${member.name} หยิบงานจากกระดานเองได้` : `${member.name} รอให้คุณเลือกงานให้`); }
    case 'buyUpgrade': return buyUpgrade(state, payload);
    case 'buildProject': return buildProject(state, payload);
    case 'buyMaterial': return buyMaterial(state, payload);
    case 'sellMaterial': return sellMaterial(state, payload);
    case 'collectIdle': return collectIdle(state, payload);
    case 'chooseEvent': return chooseEvent(state, payload);
    case 'recallMission': {
      const mission = state.missions.find(item => item.id === payload.missionId && item.status === 'active');
      if (!mission) return failure('ไม่พบทีมที่กำลังเดินทาง');
      mission.status = 'recalled'; mission.finishedAt = state.elapsed;
      mission.result = { success: false, reward: {}, title: 'กลับก่อนอย่างปลอดภัย', message: 'เรียกทีมกลับแล้ว เสบียงที่ใช้ไปไม่คืน' };
      mission.memberIds.forEach(id => { const member = memberById(state, id); member.task = 'rest'; member.energy = Math.max(0, member.energy - Math.round(mission.energyCost * clamp(mission.progress / mission.duration, 0, 1))); });
      reopenPetition(state, mission);
      addLog(state, `เรียกทีม${QUEST_BY_ID[mission.questId].name}กลับกิลด์`, 'mission');
      trimMissions(state);
      return success('เรียกทีมกลับแล้ว');
    }
    case 'recruit': return recruit(state, payload);
    case 'declineApplicant': return declineApplicant(state, payload);
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

const validRookie = m => typeof m.id === 'string' && /^r-\d+$/.test(m.id) && m.bio && typeof m.bio.name === 'string' && m.bio.name.length > 0 && m.bio.name.length <= 20
  && JOBS[m.bio.class] && !JOBS[m.bio.class].parent && TRAIT_NAMES.includes(m.bio.trait) && /^#[0-9a-f]{6}$/i.test(m.bio.hair) && m.bio.rookie === true && typeof m.bio.description === 'string';
/** Migrate v1 exports with missing optional bookkeeping, and reject corrupted state. */
export function deserializeGame(source) {
  if (typeof source !== 'string' || source.length > 2000000) throw new Error('ไฟล์เซฟใหญ่เกินไปหรือไม่ใช่ข้อความ');
  let data;
  try { data = JSON.parse(source); } catch { throw new Error('อ่านไฟล์เซฟไม่ได้'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('รูปแบบเซฟไม่ถูกต้อง');
  const savedChecksum = data.checksum;
  delete data.checksum;
  if (savedChecksum !== undefined && (typeof savedChecksum !== 'string' || savedChecksum !== saveChecksum(JSON.stringify(data)))) throw new Error('ไฟล์เซฟเสียหายหรือข้อมูลถูกเปลี่ยนหลังบันทึก');
  if (![1,2,3,4,SAVE_VERSION].includes(data.version)) throw new Error('เวอร์ชันเซฟนี้ยังไม่รองรับ');
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
  const opening = Boolean(data.intro) && data.intro.step !== 'done';
  if (data.intro !== undefined) {
    const intro = data.intro, starters = new Set(MEMBERS.filter(member => member.starter).map(member => member.id));
    if (!intro || typeof intro !== 'object' || !INTRO_STEPS.includes(intro.step) || !finiteNumber(intro.timer) || intro.timer < 0
      || !Array.isArray(intro.visitors) || !Array.isArray(intro.next) || [...intro.visitors, ...intro.next].some(id => !starters.has(id))
      || (intro.after !== null && intro.after !== undefined && !INTRO_STEPS.includes(intro.after))) throw new Error('ข้อมูลช่วงเริ่มเกมไม่ถูกต้อง');
    state.intro = { step: intro.step, timer: intro.timer, visitors: [...intro.visitors], next: [...intro.next], after: intro.after ?? null, delay: finiteNumber(intro.delay) ? intro.delay : 6 };
  }
  if (data.profile !== undefined) { if (!data.profile || typeof data.profile !== 'object') throw new Error('ข้อมูลหัวหน้ากิลด์ไม่ถูกต้อง'); state.profile = normalizeProfile(data.profile); }
  if (!Array.isArray(state.members) || state.members.length < (opening ? 0 : 3) || state.members.length > 12) throw new Error('รายชื่อสมาชิกไม่ถูกต้อง');
  const ids = new Set();
  state.members = state.members.map(member => {
    if (!member || !(MEMBER_BY_ID[member.id] || validRookie(member)) || ids.has(member.id) || !JOBS[member.class]) throw new Error('พบสมาชิกซ้ำหรืออาชีพไม่ถูกต้อง');
    ids.add(member.id);
    const content = contentOf(member);
    const baseClass = JOBS[member.class].parent || member.class;
    if (baseClass !== content.class) throw new Error('สายอาชีพสมาชิกไม่ถูกต้อง');
    const normalized = { ...createMember(content), ...member, name: content.name, ...(content.rookie ? { bio: { ...member.bio }, hair: member.bio.hair } : {}), equipment: { weapon: null, accessory: null, ...member.equipment } };
    validateNumber(normalized, 'level', 1, MAX_LEVEL, true);
    validateNumber(normalized, 'xp', 0, 1000000);
    for (const key of ['energy', 'morale', 'injury']) validateNumber(normalized, key, 0, 100);
    if (!['rest', 'train', 'work', 'mission'].includes(normalized.task)) throw new Error('งานสมาชิกไม่ถูกต้อง');
    for (const slot of ['weapon', 'accessory']) {
      const item = EQUIPMENT_BY_ID[normalized.equipment[slot]];
      if (normalized.equipment[slot] !== null && (!item || item.slot !== slot || (item.classes.length && !item.classes.includes(baseClass)))) throw new Error('อุปกรณ์สมาชิกไม่ถูกต้อง');
    }
    if (!finiteNumber(normalized.trainingProgress) || normalized.trainingProgress < 0) normalized.trainingProgress = 0;
    if (!finiteNumber(normalized.purse) || normalized.purse < 0 || normalized.purse > 100000000) normalized.purse = 0;
    if (normalized.autoWork !== undefined) normalized.autoWork = Boolean(normalized.autoWork);
    const count = n => Number.isInteger(n) && n >= 0 && n <= 9 ? n : 0, pct = n => finiteNumber(n) ? clamp(n, 0, 100) : 100;
    normalized.pack = { ration: count(member.pack?.ration), potion: count(member.pack?.potion) };
    normalized.wear = { weapon: pct(member.wear?.weapon), accessory: pct(member.wear?.accessory) };
    if (normalized.shopClock !== undefined && !finiteNumber(normalized.shopClock)) delete normalized.shopClock;
    return normalized;
  });
  if (!Array.isArray(state.facilities) || state.facilities.length < (opening ? 0 : 1) || state.facilities.length > 100) throw new Error('รายชื่อห้องไม่ถูกต้อง');
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
  if ((!opening && !state.facilities.some(room => room.type === 'reception')) || roomLevel(state, 'dorm') * 4 < state.members.length) throw new Error('โต๊ะรับคำร้องหรือเตียงพักไม่เพียงพอ');
  if (!Array.isArray(state.missions) || state.missions.length > 22) throw new Error('รายการภารกิจไม่ถูกต้อง');
  const missionIds = new Set(), assigned = new Set();
  for (const mission of state.missions) {
    if (!mission || !QUEST_BY_ID[mission.questId] || typeof mission.id !== 'string' || missionIds.has(mission.id) || !['active', 'completed', 'failed', 'recalled'].includes(mission.status)) throw new Error('ข้อมูลภารกิจไม่ถูกต้อง');
    missionIds.add(mission.id);
    if (!Array.isArray(mission.memberIds) || mission.memberIds.length < 1 || mission.memberIds.length > 3 || new Set(mission.memberIds).size !== mission.memberIds.length || mission.memberIds.some(id => !ids.has(id))) throw new Error('สมาชิกภารกิจไม่ถูกต้อง');
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
      const validLoot = entry => entry && RARITIES[entry.tier] && ((entry.kind === 'mat' && RESOURCE_KEYS.includes(entry.key) && Number.isInteger(entry.amount) && entry.amount >= 0 && entry.amount < 10000) || (entry.kind === 'item' && EQUIPMENT_BY_ID[entry.id]));
      mission.loot = Array.isArray(mission.loot) ? mission.loot.filter(validLoot).slice(0, 3) : [];
      mission.luck = finiteNumber(mission.luck) ? clamp(mission.luck, 0, 0.45) : 0;
      mission.prep = finiteNumber(mission.prep) ? clamp(mission.prep, 0, 10) : 0;
      if (mission.result) mission.result.loot = Array.isArray(mission.result.loot) ? mission.result.loot.filter(validLoot).slice(0, 3) : [];
      if (mission.event) {
        if (!Array.isArray(mission.event.choices) || mission.event.choices.some(choice => !['help', 'press', 'rest'].includes(choice.id))) throw new Error('ตัวเลือกภารกิจไม่ถูกต้อง');
      }
    }
  }
  // Petitions, idle upgrades and the village (save v5); older saves start with an empty board.
  const validPetition = p => p && typeof p.id === 'string' && QUEST_BY_ID[p.questId] && ['coming', 'waiting', 'posted', 'taken'].includes(p.status) && finiteNumber(p.fee) && p.fee >= 0 && p.fee < 1000000 && PAYOUT_PLANS[p.plan];
  const petitionIds = new Set();
  state.petitions = (Array.isArray(data.petitions) ? data.petitions : []).filter(validPetition).slice(0, 40).filter(p => !petitionIds.has(p.id) && petitionIds.add(p.id)).map(p => {
    const mission = p.missionId ? state.missions.find(m => m.id === p.missionId && m.status === 'active') : null;
    return { id: p.id, questId: p.questId, client: String(p.client || 'ชาวบ้าน').slice(0, 30), seed: finiteNumber(p.seed) ? p.seed : 1,
      home: p.home === 'inn' || p.home === 'bakery' || p.home === 'elder' || (Number.isInteger(p.home) && p.home >= 0 && p.home < VILLAGE_LOTS.houses.length) ? p.home : 'inn',
      important: Boolean(p.important), reserved: Boolean(p.reserved || p.important), fee: Math.round(p.fee), plan: p.plan,
      status: p.status === 'taken' && !mission ? 'posted' : p.status, eta: finiteNumber(p.eta) ? clamp(p.eta, 0, 600) : 0, etaTotal: finiteNumber(p.etaTotal) ? clamp(p.etaTotal, 1, 600) : 20,
      patience: finiteNumber(p.patience) ? clamp(p.patience, 0, 1000) : 80, age: finiteNumber(p.age) ? clamp(p.age, 0, 100000) : 0, missionId: mission ? mission.id : null };
  });
  for (const mission of state.missions) {
    if (mission.petition && (!finiteNumber(mission.petition.fee) || mission.petition.fee < 0 || !PAYOUT_PLANS[mission.petition.plan])) throw new Error('ค่าจ้างภารกิจไม่ถูกต้อง');
  }
  state.petitionClock = finiteNumber(data.petitionClock) ? clamp(data.petitionClock, 0, 1000) : 20;
  state.petitionRng = Number.isInteger(data.petitionRng) && data.petitionRng > 0 ? data.petitionRng >>> 0 : defaults.petitionRng;
  state.payoutPlan = PAYOUT_PLANS[data.payoutPlan] ? data.payoutPlan : 'standard';
  state.upgrades = { ...defaults.upgrades };
  for (const [id, u] of Object.entries(GUILD_UPGRADES)) { const level = data.upgrades?.[id] ?? 0; if (!Number.isInteger(level) || level < 0 || level > u.max) throw new Error('ระดับการพัฒนากิลด์ไม่ถูกต้อง'); state.upgrades[id] = level; }
  const village = { ...defaults.village, ...(data.village && typeof data.village === 'object' ? data.village : {}) };
  validateNumber(village, 'prosperity', 0, 1000000000);
  validateNumber(village, 'houses', 0, VILLAGE_LOTS.houses.length, true);
  for (const id of ['shop', 'market', 'smithy']) validateNumber(village, id, 0, VILLAGE_PROJECTS[id].max, true);
  state.village = { prosperity: village.prosperity, houses: village.houses, shop: village.shop, market: village.market, smithy: village.smithy, trade: finiteNumber(village.trade) && village.trade >= 0 ? village.trade : 0 };
  state.idleBank = finiteNumber(data.idleBank) ? clamp(data.idleBank, 0, 1000000) : 0;
  const appIds = new Set();
  state.applicants = (Array.isArray(data.applicants) ? data.applicants : []).filter(a => a && typeof a.id === 'string' && !appIds.has(a.id) && appIds.add(a.id) && ['coming', 'waiting'].includes(a.status)
    && finiteNumber(a.fee) && a.fee >= 0 && a.fee < 100000 && Number.isInteger(a.level) && a.level >= 1 && a.level <= MAX_LEVEL
    && (a.memberId ? MEMBER_BY_ID[a.memberId] && !MEMBER_BY_ID[a.memberId].starter && !ids.has(a.memberId) : validRookie({ id: a.rookieId, bio: { ...a.bio, rookie: true } }))).slice(0, 4)
    .map(a => ({ id: a.id, status: a.status, eta: finiteNumber(a.eta) ? clamp(a.eta, 0, 600) : 0, etaTotal: finiteNumber(a.etaTotal) ? clamp(a.etaTotal, 1, 600) : 20, patience: finiteNumber(a.patience) ? clamp(a.patience, 0, 1000) : 160,
      memberId: a.memberId || null, rookieId: a.memberId ? null : a.rookieId, bio: a.memberId ? null : { name: a.bio.name, class: a.bio.class, trait: a.bio.trait, hair: a.bio.hair, description: a.bio.description }, level: a.level, fee: a.fee, famous: Boolean(a.famous) }));
  state.market = Object.fromEntries(Object.keys(MATERIALS).map(k => [k, Number.isInteger(data.market?.[k]) && data.market[k] >= 0 && data.market[k] < 1000000 ? data.market[k] : defaults.market[k]]));
  const stock = n => Number.isInteger(n) && n >= 0 && n < 1000 ? n : 0;
  state.shops = { ration: stock(data.shops?.ration), potion: stock(data.shops?.potion), gear: Object.fromEntries(Object.entries(data.shops?.gear || {}).filter(([id, n]) => EQUIPMENT_BY_ID[id] && !EQUIPMENT_BY_ID[id].loot && stock(n) > 0)) };
  state.applicantClock = finiteNumber(data.applicantClock) ? clamp(data.applicantClock, 0, 1000) : 90;
  // Older saves count the quests they already cleared as their record of work.
  const jobs = data.record?.jobs ?? Object.values(state.completedQuests).reduce((sum, n) => sum + n, 0);
  state.record = { jobs: Number.isInteger(jobs) && jobs >= 0 && jobs < 10000000 ? jobs : 0 };
  if (data.foundTreasures !== undefined) state.foundTreasures = Array.isArray(data.foundTreasures) ? [...new Set(data.foundTreasures.filter(id => EQUIPMENT_BY_ID[id]?.loot))] : [];
  state.inventory = { ...(data.inventory || {}) };
  if (!state.inventory || typeof state.inventory !== 'object' || Array.isArray(state.inventory)) throw new Error('คลังอุปกรณ์ไม่ถูกต้อง');
  for (const [id, count] of Object.entries(state.inventory)) if (!EQUIPMENT_BY_ID[id] || !Number.isInteger(count) || count < 0 || count > 1000) throw new Error('จำนวนอุปกรณ์ไม่ถูกต้อง');
  for (const key of ['completedQuests', 'questRuns']) {
    state[key] = { ...(data[key] || {}) };
    for (const [id, count] of Object.entries(state[key])) if (!QUEST_BY_ID[id] || !Number.isInteger(count) || count < 0 || count > 1000000) throw new Error('ประวัติภารกิจไม่ถูกต้อง');
  }
  state.bonds = { ...(data.bonds || {}) };
  for (const [key, value] of Object.entries(state.bonds)) if (!/^[\w-]+:[\w-]+$/.test(key) || !key.split(':').every(id => ids.has(id)) || !finiteNumber(value) || value < 0 || value > 100) throw new Error('ความสัมพันธ์สมาชิกไม่ถูกต้อง');
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
  state.nextId = Math.max(Number.isInteger(data.nextId) ? data.nextId : 10, ...[...roomIds,...partitionIds, ...missionIds, ...petitionIds, ...appIds, ...state.applicants.map(a => a.rookieId).filter(Boolean), ...state.members.map(m => m.id).filter(id => /^r-\d+$/.test(id))].map(id => (Number(id.split('-').pop()) || 0) + 1));
  syncImportant(state);
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
