import { START_BUILDING,buildingRect,protectedAreas,intersects,isInsideBuilding,partitionSize,partitionRect,containsRect,pointInRect,partitionDoor,canCrossPartition,partitionWallBlocks } from './site.js';
import { FACILITIES, MEMBERS, QUESTS, EQUIPMENT, JOBS, RANKS, RANK_REQUIREMENTS, MERIT_LABELS, GUILD_EVENTS, MISSION_POLICIES,ROOM_TYPES,BUILDING_STAGES,LOOT,RARITIES,PAYOUT_PLANS,FEE_MULTIPLIER,VILLAGER_NAMES,GUILD_UPGRADES,VILLAGE_LEVELS,VILLAGE_PROJECTS,VILLAGE_LOTS,TRAIT_NAMES,ROOKIE_NAMES,ROOKIE_LINES,HAIR_COLORS,MATERIALS,CONSUMABLES,ADVENTURER_RANKS,ADVENTURER_RANK_RULES,TOWN_CAPS,STAFF,STAFF_MAX_LEVEL,RANK_POWER,CLASS_TIERS,MONSTER_STATS,HUNT_ZONES,VILLAGE_BUSINESSES,PARTS,MONSTER_PART,BUY_RATES,TREASURES } from './content.js';
const MONSTER_STATS_KEYS = new Set(Object.keys(MONSTER_STATS));

import { tickLife, createWorld, rallyDefenders, recallHunters, addFree, freeStats, freeLevelRank, rallyToBoss, spawnMonster, pointIn, worldRandom, createHero, setHeroActive, sanitizeHero, startExpedition, recallExpedition } from './life.js';
import { createDirector, tickDirector, raidReached, bossDefeated, resolveDecision, sanitizeDirector } from './events.js';
import { SPECIES } from './monsters.js';
import { tickTown, sanitizePaths, sanitizeHomes, population, housingCapacity, homeStatus, spotFree, ROTATABLE, homeOf, villageBuildings, doorOf } from './town.js';
import { goalBoard, claimGoal, sanitizeMastery, setGoalJobs } from './goals.js';
import { createProgress, sanitizeProgress, addChest, rollChest, recordKill, recordTreasure, offerPolicies, choosePolicy, hasPolicy, newDailyGoals, dailyView, POLICIES, CHESTS, CHEST_RARITIES, TREASURE_SETS, CODEX_FAMILIES } from './progress.js';
import { createFestivals, startFestival, tickFestivals, sanitizeFestivals, festivalStatus, festivalVisitors, festivalEntrants } from './festivals.js';
import { createExams, registerExam, withdrawExam, tickExams, sanitizeExams } from './exams.js';
import { createTrade, sellLoot, tickTrade, dailyTrade, wholesale, sendCaravan, treasureAction, sanitizeTrade, storeUsed, storeCapacity } from './trade.js';
export const SAVE_VERSION = 6;
export const DAY_LENGTH = 240;
const RESOURCE_KEYS = ['gold', 'wood', 'stone', 'herb'];
const MAX_LEVEL = 20;
const MAX_MEMBERS = 80;
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
/** The basic job at the root of a class line (warrior, archer, mage or healer). */
export const rootClass = id => JOBS[id]?.base || JOBS[id]?.parent || id;
const equipmentBaseClass = member => rootClass(member.class);
const classTier = id => JOBS[id]?.tier || (JOBS[id]?.parent ? 2 : 1);
const memberRankIndex = member => ADVENTURER_RANKS.indexOf(member.rank || 'F');
const roomLevel = (state, type) => state.facilities.reduce((sum, facility) => sum + (facility.type === type ? facility.level : 0), 0);
const bestRoomLevel = (state, type) => Math.max(0, ...state.facilities.filter(room => room.type === type).map(room => room.level));
const memberById = (state, id) => state.members.find(member => member.id === id);
// Away on a mission, or on an errand in the village (a lesson, an exam, a class trial).
const isBusy = (state, memberId) => state.missions.some(mission => mission.status === 'active' && mission.memberIds.includes(memberId)) || Boolean(memberById(state, memberId)?.errand) || Boolean(state.world?.hunters?.some(h => h.id === memberId));
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
  const gold = (amount.gold || 0) * direction;
  if (gold > 0 && state.record) state.record.income = Math.round((state.record.income || 0) + gold);
  if (gold && state.today) { const book = gold > 0 ? state.today.income : state.today.expense, key = ledgerKey(reason); book[key] = Math.round((book[key] || 0) + Math.abs(gold)); }
}
/** Group ledger lines for the day's summary: "ค่านายหน้า: ลาดตระเวน" counts as commission. */
const ledgerKey = reason => String(reason || 'อื่น ๆ').replace(/[:：].*$/, '').replace(/^(รับ|สร้าง|อัปเกรด|ซื้อ|ขาย|หมู่บ้าน|พัฒนา|ค่าเรียน|ค่าสมัครสอบแรงค์).*$/, '$1').slice(0, 28);
const newDay = day => ({ day, income: {}, expense: {}, joined: 0, left: 0, jobs: 0, failed: 0, effSum: 0, effN: 0 });

function canAfford(state, cost) {
  return RESOURCE_KEYS.every(key => state[key] >= (cost[key] || 0));
}

function createMember(content, level = 1) {
  const member = { id: content.id, name: content.name, class: content.class, level, xp: 0, energy: 100, morale: 80,
    injury: 0, task: 'rest', equipment: { weapon: null, accessory: null }, missionsDone: 0, trainingProgress: 0, waitingReason: null, purse: 0, pack: { ration: 0, potion: 0 }, wear: { weapon: 100, accessory: 100 }, rank: content.rank || 'F', points: 0, errand: null, examReadyAt: 0, regular: !content.rookie, autoTrain: false, town: null, unhappy: 0, celebrate: false };
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
      {id:'room-2',type:'infirmary',x:10.5,y:4.5,rotation:0,level:1},
      {id:'room-3',type:'infirmary',x:11.75,y:4.5,rotation:0,level:1},
      {id:'room-4',type:'kitchen',x:5.75,y:7.75,rotation:1,level:1},
      {id:'room-5',type:'training',x:7.25,y:7.75,rotation:0,level:1},
      {id:'room-6',type:'workshop',x:9.5,y:8.25,rotation:2,level:1},
    ],
    missions: [], completedQuests: {}, questRuns: {}, bonds: {}, inventory: {}, log: [], ledger: [],
    goals: { firstMission: false, firstCraft: false, firstUpgrade: false, firstRecruit: false, firstExpansion: false },
    settings: { speed: 1, sound: true, music: true, volume: 0.8, paused: false },
    story: { chapter: 1, finished: false }, frontier: { camp: 0 }, bounty: null, mastery: { claimed: {} }, exams: createExams(), festivals: createFestivals(), eventCooldowns: {}, daily: { missionCounts: {}, work: {}, lessons: {}, garden: false },
    bankruptcyDays: 0, today: newDay(1), history: [],
    policy: { memberHunting: true, autoPetitions: true, registration: true }, world: createWorld(seed), director: createDirector(), applicants: [], applicantClock: 90, petitions: [], petitionClock: 20, petitionRng: (((seed >>> 0) || 123) ^ 0x5bd1e995) >>> 0 || 7, payoutPlan: 'standard',
    record: { jobs: 0, bounties: 0, income: 0, hall: 0, joined: 0, passed: 0 }, progress: createProgress(), market: { ...MARKET_START }, shops: { ration: 0, potion: 0, gear: {} }, staff: {}, upgrades: { signboard: 0, contracts: 0, storehouse: 0, trophyHall: 0, coffer: 0 }, village: { prosperity: 0, houses: 3, occupancy: 1, raidScar: 0, grown: 1, inn: 0, clinic: 0, shop: 0, market: 0, smithy: 0, dojo: 0, arena: 0, tannery: 0, apothecary: 0, jeweler: 0, caravan: 0, auction: 0, fairground: 0, stage: 0, monument: 0, trade: 0, paths: {}, homes: {} }, trade: createTrade(), hero: createHero(), idleBank: 0,
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
  addLog(state, 'บ้านเก่าข้างต้นไม้เปิดเป็นกิลด์แล้ว ติดคำร้องลาดตระเวนบนกระดาน นักผจญภัยจะมารับงานเอง', 'story');
  syncImportant(state);
  return state;
}

export const PROFILE_LOOKS = {
  hair: ['#5b4637', '#8b5a3c', '#d9b26f', '#a66c59', '#6f6a8f', '#e9e2d0'],
  outfit: ['#d98978', '#94b7c5', '#90b89c', '#b7aec9', '#e7bd74', '#8a7a68'],
  skin: ['#f7d4ae', '#e8b88c', '#b9805a'],
  hairStyle: ['short', 'long'],
};
export const DEFAULT_PROFILE = { masterName: 'หัวหน้ากิลด์', guildName: 'กิลด์ดาวเหนือ', hair: PROFILE_LOOKS.hair[0], outfit: PROFILE_LOOKS.outfit[0], skin: PROFILE_LOOKS.skin[0], hairStyle: 'short' };
/** Clean player-entered names and look choices; unknown values fall back to defaults. */
export function normalizeProfile(input = {}) {
  const text = (value, fallback) => { const clean = String(value ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20); return clean || fallback; };
  const pick = (key, value) => PROFILE_LOOKS[key].includes(value) ? value : DEFAULT_PROFILE[key];
  return { masterName: text(input.masterName, DEFAULT_PROFILE.masterName), guildName: text(input.guildName, DEFAULT_PROFILE.guildName),
    hair: pick('hair', input.hair), outfit: pick('outfit', input.outfit), skin: pick('skin', input.skin), hairStyle: pick('hairStyle', input.hairStyle) };
}

export const INTRO_STEPS = ['reception', 'board', 'training', 'patrol', 'wait', 'visit', 'done'];
const INTRO_ARRIVALS = { board: { next: ['mira'], after: 'training', delay: 6 }, training: { next: ['finn', 'lune'], after: 'patrol', delay: 8 }, patrol: { next: ['noa'], after: 'done', delay: 10 } };
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
  if (intro.step === 'reception' && has('reception')) intro.step = 'board';
  if (intro.step === 'board' && has('board')) introWait(state, 'board');
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
  const basePower = (job.power + (member.level - 1) * 2.7 + (weapon?.power || 0) + (accessory?.power || 0) + (traitOf(member).power || 0)) * (RANK_POWER[member.rank || 'F'] || 1);
  // How well they are looked after (wounds, rest, mood, gear, supplies) decides how much of that strength they bring.
  const condition = memberCondition(member);
  return { power: Math.round(basePower * condition.eff), basePower: Math.round(basePower), efficiency: condition.eff, condition,
    health: Math.round(job.health + (member.level - 1) * 8 + (weapon?.health || 0) + (accessory?.health || 0) + (traitOf(member).health || 0)),
    role: job.role, jobName: job.name, xpNeeded: xpNeeded(member.level), busy: isBusy(state, member.id),
    energy: Math.round(member.energy), morale: Math.round(member.morale), injury: Math.round(member.injury),
    canSpecialize: classChoices(state, member).some(c => c.ok), rank: member.rank || 'F', errand: member.errand?.kind || null,
    trait: contentOf(member)?.trait,
    waitingReason: member.waitingReason || null,
  };
}

// ---- Condition: five things the guild master looks after, which add up to how well an adventurer works. ----
export const CONDITIONS = [
  { id: 'health', name: 'บาดแผล', icon: '🩹', w: 0.25, badText: 'บาดเจ็บ', fix: ['clinic', 'infirmary'], fixText: 'คลินิกในเมือง เตียงรักษาในกิลด์' },
  { id: 'rest', name: 'ความเหนื่อย', icon: '💤', w: 0.25, badText: 'เหนื่อยล้า', fix: ['inn', 'dining', 'kitchen'], fixText: 'ขยายโรงเตี๊ยม โต๊ะอาหารและครัวในกิลด์' },
  { id: 'mood', name: 'อารมณ์', icon: '😊', w: 0.2, badText: 'ขวัญเสีย', fix: ['bar', 'lounge', 'shop', 'stage'], fixText: 'บาร์ ชุดโต๊ะน้ำชา ร้านค้า เทศกาล ค่าตอบแทนที่ยุติธรรม' },
  { id: 'gear', name: 'อุปกรณ์', icon: '⚔', w: 0.15, badText: 'อุปกรณ์สึก', fix: ['smithy'], fixText: 'โรงตีเหล็ก (ซ่อมและขายของดี) โต๊ะช่าง' },
  { id: 'supplies', name: 'เสบียง', icon: '🎒', w: 0.15, badText: 'ไม่มีเสบียง', fix: ['shop'], fixText: 'ร้านค้า (เสบียงและยา) ตลาดนัด (สมุนไพร)' },
];
export const EFFICIENCY_RANGE = [0.6, 1.2];
/** Each condition from 0 (bad) to 1 (good), and the efficiency they add up to: 60% when everything is bad, 120% when all is well. */
export function memberCondition(member) {
  const wear = slot => (member.wear?.[slot] ?? 100) / 100;
  const weapon = member.equipment?.weapon, accessory = member.equipment?.accessory;
  const c = {
    health: clamp(1 - (member.injury || 0) / 100, 0, 1),
    rest: clamp((member.energy ?? 100) / 100, 0, 1),
    mood: clamp((member.morale ?? 80) / 100, 0, 1),
    gear: weapon ? clamp((wear('weapon') + (accessory ? wear('accessory') : wear('weapon'))) / 2, 0, 1) : 0.4,
    supplies: Math.min(1, (member.pack?.ration > 0 ? 0.5 : 0) + (member.pack?.potion > 0 ? 0.5 : 0)),
  };
  c.eff = Math.round((EFFICIENCY_RANGE[0] + (EFFICIENCY_RANGE[1] - EFFICIENCY_RANGE[0]) * CONDITIONS.reduce((sum, d) => sum + d.w * c[d.id], 0)) * 100) / 100;
  return c;
}
const avgEff = state => state.members.length ? state.members.reduce((a, m) => a + memberCondition(m).eff, 0) / state.members.length : 1;
/** Gold an adventurer brings the guild in a day: yesterday's book, or today's so far once the day is under way. */
function incomePerHead(state) {
  const last = state.history?.[state.history.length - 1], sum = book => Object.values(book || {}).reduce((a, b) => a + b, 0);
  let income = last ? last.incomeTotal : 0;
  if (!income && state.today && state.clock > DAY_LENGTH * 0.2) income = sum(state.today.income) / (state.clock / DAY_LENGTH);
  return Math.max(10, (income || state.members.length * 40) * 0.7 / Math.max(1, state.members.length));
}
/** The guild's efficiency at a glance: the average, each condition, who is short of it, and what that costs in gold a day. */
export function getEfficiencyReport(state) {
  const ms = state.members, n = Math.max(1, ms.length), conds = ms.map(memberCondition);
  const avg = ms.length ? Math.round(conds.reduce((a, c) => a + c.eff, 0) / n * 100) / 100 : 1, perHead = incomePerHead(state);
  const dims = CONDITIONS.map(d => {
    const gap = conds.reduce((a, c) => a + (EFFICIENCY_RANGE[1] - EFFICIENCY_RANGE[0]) * d.w * (1 - c[d.id]), 0);
    return { ...d, avg: Math.round(conds.reduce((a, c) => a + c[d.id], 0) / n * 100) / 100, bad: conds.filter(c => c[d.id] < 0.5).length, gold: Math.round(perHead * gap / Math.max(0.6, avg)) };
  });
  const last = state.history?.[state.history.length - 1];
  return { avg, perHead: Math.round(perHead), dims, losses: dims.filter(d => d.gold >= 5).sort((a, b) => b.gold - a.gold), comfort: townComfort(state), trend: last ? Math.round((avg - last.eff) * 100) : 0 };
}
/** What one more level of a building would win back each day, from the losses it addresses (a rough estimate shown before buying). */
const FIX_EFFECT = { bar: { mood: 0.15 }, dining: { rest: 0.15 }, clinic: { health: 0.35 }, infirmary: { health: 0.15 }, inn: { rest: 0.2 }, kitchen: { rest: 0.12, mood: 0.06 }, lounge: { mood: 0.25 }, shop: { supplies: 0.4, mood: 0.06 }, market: { supplies: 0.15 }, smithy: { gear: 0.4 }, stage: { mood: 0.12 }, fairground: { mood: 0.08 }, monument: { mood: 0.1 } };
export function investmentGain(state, id) {
  const fx = FIX_EFFECT[id]; if (!fx) return null;
  const report = getEfficiencyReport(state), parts = Object.entries(fx).map(([dim, f]) => { const d = report.dims.find(x => x.id === dim); return { dim, name: d.name, icon: d.icon, gold: Math.round(d.gold * f * (id === 'shop' && state.village?.shop ? 0.6 : id === 'smithy' && state.village?.smithy ? 0.6 : 1)) }; });
  return { gold: parts.reduce((a, p) => a + p.gold, 0), parts };
}
/** How comfortable life in town is: moods drift towards this while adventurers are at home. */
export function townComfort(state) {
  const v = state.village || {};
  const room = getLodging(state), crowded = room.count >= room.lodging * 0.95 ? -10 : 0;
  const parts = [['พื้นฐาน', 36], ['ที่พักแออัด', crowded], ['ชุดโต๊ะน้ำชา', bestRoomLevel(state, 'lounge') * 6], ['เตาทำอาหาร', bestRoomLevel(state, 'kitchen') * 4], ['ร้านค้า', (v.shop || 0) * 3], ['โรงเตี๊ยม', (v.inn || 0) * 3],
    ['เวทีและลานเทศกาล', (v.stage || 0) * 3 + (v.fairground || 0) * 2], ['อนุสาวรีย์', (v.monument || 0) * 3], ['เทศกาลกำลังจัด', state.festivals?.live ? 12 : 0],
    ['ค่าตอบแทนปกติ', (PAYOUT_PLANS[state.payoutPlan]?.morale || 0) * 1.5], ['นโยบายกิลด์อบอุ่น', hasPolicy(state, 'cheer') ? 6 : 0]].filter(([, n]) => n);
  return { value: clamp(Math.round(parts.reduce((a, [, n]) => a + n, 0)), 20, 95), parts };
}

// The curve steepens so levels keep meaning something across a long game (L5 ~143 XP, L10 ~380, L15 ~743).
function xpNeeded(level) { return Math.round(30 + level * 10 + level * level * 2.5); }
function addXp(state, member, amount) {
  if (member.level >= MAX_LEVEL) return;
  member.xp += amount * (hasPolicy(state, 'drill') ? 1.15 : 1);
  while (member.level < MAX_LEVEL && member.xp >= xpNeeded(member.level)) {
    member.xp -= xpNeeded(member.level);
    member.level += 1;
    member.morale = clamp(member.morale + 4, 0, 100);
    addLog(state, `${member.name} เติบโตเป็นเลเวล ${member.level}`, 'level');
  }
  if (member.level >= MAX_LEVEL) member.xp = 0;
}

/** Jobs the board can have out at once: two per level of board, one more per planning table. */
export function jobSlots(state) { return roomLevel(state, 'board') ? Math.min(8, roomLevel(state, 'board') * 2) + roomLevel(state, 'dispatch') : 0; }
export function getGuildStats(state) {
  const nextRank = RANKS[rankIndex(state.rank) + 1] || null;
  const next = nextRank ? RANK_REQUIREMENTS[nextRank] : null;
  const previousRep = RANK_REQUIREMENTS[state.rank].rep;
  const today = state.ledger.filter(entry => entry.day === state.day);
  const lodging = getLodging(state), memberCap = lodging.cap;
  return { power: state.members.reduce((sum, member) => sum + getMemberStats(state, member).power, 0),
    memberCount: state.members.length, memberCap, teamCap: hasRank(state, 'E') && roomLevel(state, 'dispatch') ? 2 : 1,
    // Teams that took board work by themselves use the board's own slots, never the player's.
    activeMissions: state.missions.filter(mission => mission.status === 'active' && !mission.auto).reduce((n, mission) => n + (QUEST_BY_ID[mission.questId]?.raid ? 2 : 1), 0),
    boardCap: jobSlots(state), boardMissions: state.missions.filter(mission => mission.status === 'active' && mission.auto).length,
    recoveryRate: 0.14 + (state.village?.inn || 0) * 0.03 + bestRoomLevel(state, 'kitchen') * 0.025,
    restSlots: 999, lodging, trainingSlots: roomLevel(state, 'training') * 2,
    healingSlots: roomLevel(state, 'infirmary') * 2,
    incomeToday: today.reduce((sum, entry) => sum + Math.max(0, entry.gold), 0),
    expenseToday: today.reduce((sum, entry) => sum + Math.max(0, -entry.gold), 0),
    rankProgress: next ? clamp((state.rep - previousRep) / (next.rep - previousRep), 0, 1) : 1,
    nextRank, nextRankRep: next?.rep ?? state.rep, nextRankQuest: next?.quest ?? null,
    upkeep: 12 + state.facilities.length * 3,
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
    case 'classed': return state.members.filter(member => classTier(member.class) >= 2).length;
    case 'ranked': return state.members.filter(member => memberRankIndex(member) >= ADVENTURER_RANKS.indexOf(merit.rank)).length;
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
    if (!roomLevel(state, 'dispatch')) needs.push('วางโต๊ะวางแผนให้ทีมวางแผนร่วมกัน');
    if (state.landLevel < 1) needs.push('ขยายที่ดินอย่างน้อย 1 ครั้ง');
    if (needs.length) return `เตรียมกิลด์ช่วยทีมสำรวจ: ${needs.join(' · ')}`;
  }
  if (quest.id === 'heart') {
    const missingStories = ['hollow', 'ruins', 'rescue'].filter(id => !state.completedQuests[id]);
    if (missingStories.length) return `ต้องผ่าน ${missingStories.map(id => QUEST_BY_ID[id].name).join(' · ')} ก่อน`;
    if (state.facilities.filter(room => room.level >= 2).length < 2) return 'เตรียมกิลด์รับทุกคนกลับบ้าน: อัปเกรดจุดใช้งานที่เลือกอย่างน้อย 2 จุดใช้งานเป็นระดับ 2';
  }
  if (quest.raid && (state.frontier?.camp || 0) < 2) return 'ภารกิจจู่โจม: ขยายค่ายแนวหน้าเป็นระดับ 2 ก่อน (เมนูกิลด์ → พัฒนากิลด์)';
  if (quest.raid && state.members.length < 8) return 'ภารกิจจู่โจม: ต้องมีสมาชิกอย่างน้อย 8 คน';
  if (quest.raid && state.members.filter(m => memberRankIndex(m) >= ADVENTURER_RANKS.indexOf('B')).length < 2) return 'ภารกิจจู่โจม: ต้องมีนักผจญภัยแรงค์ B อย่างน้อย 2 คน';
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
// ---- Registration: adventurers come to town by themselves, sign the guild's book and take a room in town. ----
// ---- The town as a city: what people need against what the town can give, and how happy that makes them. ----
/** Demand against capacity for the things a growing town runs short of; anything over capacity shows red. */
export function townNeeds(state) {
  const v = state.village || {}, pop = population(state), ms = state.members, room = getLodging(state);
  const atHome = ms.filter(m => !isBusy(state, m.id)).length;
  return [
    { id: 'lodging', icon: '🛏', name: 'ที่พักนักผจญภัย', demand: ms.length + (state.applicants || []).length, cap: room.lodging, fix: 'ขยายโรงเตี๊ยมหรือสร้างบ้าน' },
    { id: 'clinic', icon: '🩹', name: 'รักษาบาดแผล', demand: ms.filter(m => m.injury > 20).length, cap: (v.clinic || 0) * 6 + roomLevel(state, 'infirmary') * 2, fix: 'สร้างคลินิกหรือเตียงรักษา' },
    { id: 'bar', icon: '🍺', name: 'ที่นั่งบาร์และโต๊ะอาหาร', demand: Math.ceil(ms.length * 0.25), cap: hallSeats(state).total, fix: 'วางบาร์หรือโต๊ะอาหารเพิ่ม' },
    { id: 'repair', icon: '🔨', name: 'ซ่อมอุปกรณ์', demand: ms.filter(m => Object.entries(m.equipment || {}).some(([slot, id]) => id && (m.wear?.[slot] ?? 100) < 60)).length, cap: (v.smithy || 0) * 8, fix: 'สร้างหรือขยายโรงตีเหล็ก' },
    { id: 'food', icon: '🍞', name: 'อาหารในเมือง', demand: pop + ms.length, cap: 20 + (v.shop || 0) * 16 + (v.market || 0) * 24 + (v.inn || 0) * 6, fix: 'ร้านค้า ตลาดนัด โรงเตี๊ยม' },
    { id: 'safety', icon: '🛡', name: 'ความปลอดภัย', demand: Math.ceil(pop / 6), cap: Math.round(atHome * 0.6 + (v.dojo || 0) * 3 + (v.arena || 0) * 2 + staffOn(state, 'scout') * 3), fix: 'ให้นักผจญภัยอยู่เมืองมากขึ้น โรงฝึก หน่วยข่าว' },
  ].map(n => ({ ...n, over: n.demand > n.cap }));
}
/** How happy the townsfolk are, and why: food, safety, homes that have what they need, things to enjoy, the guild's help, raids. */
export function townSatisfaction(state) {
  const v = state.village || {}, needs = Object.fromEntries(townNeeds(state).map(n => [n.id, n])), level = getVillageInfo(state).level;
  const homes = Math.min(v.houses || 0, VILLAGE_LOTS.houses.length), happyHomes = [...Array(homes).keys()].filter(i => !(homeStatus(state, 'h' + i, level).missing || []).length).length;
  const short = n => n.cap >= n.demand ? 0 : Math.min(1, (n.demand - n.cap) / Math.max(1, n.demand));
  const parts = [['พื้นฐาน', 50], ['อาหารพอ', needs.food.over ? -Math.round(25 * short(needs.food)) : 8], ['ความปลอดภัย', needs.safety.over ? -Math.round(20 * short(needs.safety)) : 8],
    ['บ้านมีครบ', homes ? Math.round(happyHomes / homes * 12) : 0], ['ที่เที่ยว', Math.min(15, (v.stage || 0) * 4 + (v.fairground || 0) * 3 + (v.arena || 0) * 2 + (v.monument || 0) * 3 + (state.festivals?.live ? 8 : 0))],
    ['กิลด์ช่วยงาน', Math.min(10, (state.today?.jobs || 0) * 2)], ['มอนบุกเมือง', -Math.min(20, Math.round(v.raidScar || 0))]].filter(([, n]) => n);
  return { value: clamp(Math.round(parts.reduce((a, [, n]) => a + n, 0)), 0, 100), parts };
}
/** Each second: satisfaction drifts to its target, families move in or out with it, and raid scars fade. */
function tickCity(state, step) {
  const v = state.village; if (!v) return;
  const target = townSatisfaction(state).value;
  v.satisfaction = clamp((v.satisfaction ?? target) + (target - (v.satisfaction ?? target)) * 0.01 * step, 0, 100);
  const before = population(state);
  v.occupancy = clamp((v.occupancy ?? 1) + (v.satisfaction >= 60 ? 0.002 : v.satisfaction < 40 ? -0.002 : 0) * step, 0.6, 1);
  const after = population(state);
  if (after !== before && state.today) { if (after > before) state.today.movedIn = (state.today.movedIn || 0) + after - before; else state.today.movedOut = (state.today.movedOut || 0) + before - after; }
  v.raidScar = Math.max(0, (v.raidScar || 0) - step * 0.02);
}
/** Room for adventurers in town: the inn and rooms let in houses, never more than the town draws at its level. */
export function getLodging(state) {
  const v = state.village || {}, inn = 6 + (v.inn || 0) * 8, rooms = Math.min(v.houses || 0, VILLAGE_LOTS.houses.length) * 2;
  const level = getVillageInfo(state).level, town = TOWN_CAPS[level - 1] ?? TOWN_CAPS[TOWN_CAPS.length - 1];
  const count = state.members.length, coming = (state.applicants || []).length;
  return { inn, rooms, lodging: inn + rooms, town, cap: Math.min(town, inn + rooms), count, coming, limit: inn + rooms <= town ? 'lodging' : 'town' };
}
/** Seconds between newcomers while there is room: renown brings them faster. */
export function applicantInterval(state) { return Math.max(10, Math.round(45 / ((1 + state.rep / 300) * (1 + staffOn(state, 'registrar') * 0.15) * (hasPolicy(state, 'welcome') ? 1.3 : 1)))); }
/** Named regulars stay about a quarter of everyone registered (never fewer than four). */
export function regularLimit(state) { return Math.max(4, Math.ceil(state.members.length / 4)); }
const APPLICANT_START = { x: -12, y: 17.5 };
function applicantContent(state, applicant) {
  return applicant.memberId ? MEMBER_BY_ID[applicant.memberId] : { ...applicant.bio, id: applicant.rookieId, rookie: true, cost: 0 };
}
/** Someone walking up the road to register (named by id, or a new rookie), used by the arrival timer, events and tests. */
export function addApplicant(state, memberId = null, options = {}) {
  state.applicants ??= [];
  const b = buildingRect(state);
  const eta = options.status === 'waiting' ? 0 : Math.round((Math.abs(APPLICANT_START.x - (b.x + b.w / 2)) + Math.abs(APPLICANT_START.y - (b.y + b.h))) / PETITION_WALK + 3);
  const applicant = { id: `app-${state.nextId++}`, status: 'coming', eta, etaTotal: Math.max(1, eta), memberId: null, rookieId: null, bio: null, level: 1, famous: false };
  if (memberId) {
    const content = MEMBER_BY_ID[memberId];
    if (!content || content.starter || memberById(state, memberId) || state.applicants.some(a => a.memberId === memberId)) return null;
    Object.assign(applicant, { memberId, level: content.famous ? content.famous.level : Math.max(1, rankIndex(state.rank) + 1), famous: Boolean(content.famous) });
  } else {
    const pick = list => list[Math.floor(petitionRandom(state) * list.length) % list.length];
    const used = new Set([...state.members.map(m => m.name), ...state.applicants.map(a => a.bio?.name)]);
    const fresh = ROOKIE_NAMES.filter(n => !used.has(n));
    applicant.rookieId = `r-${state.nextId++}`;
    applicant.bio = { name: pick(fresh.length ? fresh : ROOKIE_NAMES), class: pick(['warrior', 'archer', 'mage', 'healer']), trait: pick(TRAIT_NAMES), hair: pick(HAIR_COLORS), description: pick(ROOKIE_LINES) };
    // Newcomers suit the guild's standing: a famous guild draws adventurers who already have some years behind them.
    applicant.level = clamp(1 + Math.floor(petitionRandom(state) * (1 + rankIndex(state.rank) * 2.2)) + Math.floor(staffOn(state, 'registrar') / 3), 1, 14);
  }
  if (options.affinity) applicant.fond = true;
  state.applicants.push(applicant);
  return applicant;
}
/** Sign the newcomer into the guild's book; they take a room in town and are free to work from now on. */
function registerApplicant(state, applicant) {
  state.applicants = state.applicants.filter(a => a !== applicant);
  const content = applicantContent(state, applicant);
  if (!content || memberById(state, content.id)) return null;
  const joined = createMember(content, applicant.level);
  joined.rank = content.rookie ? freeLevelRank(applicant.level) : applicant.level >= 6 ? 'D' : applicant.level >= 3 ? 'E' : 'F';
  joined.regular = !content.rookie;
  joined.purse = 20 + applicant.level * 12;
  if (applicant.fond) joined.morale = 95;
  state.members.push(joined);
  if (state.today) state.today.joined += 1;
  if (state.record) state.record.joined = (state.record.joined || 0) + 1;
  state.goals.firstRecruit = true;
  addLog(state, `${content.name} (${JOBS[content.class].name} Lv.${applicant.level}) ลงทะเบียนกับกิลด์ เช่าห้องพักในเมืองแล้ว`, applicant.famous ? 'rank' : 'member');
  return joined;
}
function tickApplicants(state, step) {
  state.applicants ??= [];
  if (!introActive(state) && roomLevel(state, 'reception') && state.policy?.registration !== false) {
    state.applicantClock = (state.applicantClock ?? 30) - step;
    if (state.applicantClock <= 0) {
      state.applicantClock = applicantInterval(state) * (0.8 + petitionRandom(state) * 0.4);
      const room = getLodging(state);
      if (room.count + room.coming < room.cap && room.coming < 3) {
        const named = getAvailableRecruits(state).filter(m => m.available && !m.applying);
        const famous = named.filter(m => m.famous);
        const choice = famous.length ? famous[0] : named.length && petitionRandom(state) < 0.35 ? named[0] : null;
        const applicant = addApplicant(state, choice?.id || null);
        if (applicant?.famous) addLog(state, `ข่าวลือว่า${MEMBER_BY_ID[applicant.memberId].name}กำลังเดินทางมาที่เมือง!`, 'rank');
      }
    }
  }
  for (const applicant of [...state.applicants]) {
    applicant.eta -= step;
    if (applicant.eta <= 0) registerApplicant(state, applicant);
  }
}
// ---- Guild staff: hired by the master, paid every morning, better with each few days on the job. ----
export const staffLevel = (state, id) => state.staff?.[id]?.level || 0;
/** A staff member only works when their station (furniture) is in the hall. */
export const staffOn = (state, id) => STAFF[id] && roomLevel(state, STAFF[id].needs) ? staffLevel(state, id) : 0;
export const staffSalary = (id, level) => Math.round(STAFF[id].salary * (1 + 0.35 * (Math.max(1, level) - 1)));
export function staffStatus(state, id) {
  const def = STAFF[id], level = staffLevel(state, id);
  if (!def) return { ok: false, reason: 'ไม่พบตำแหน่งนี้' };
  const station = FACILITIES[def.needs]?.name || def.needs;
  let reason = '';
  if (level) reason = 'จ้างแล้ว';
  else if (!roomLevel(state, def.needs)) reason = `ต้องวาง${station}ในกิลด์ก่อน`;
  else if (state.gold < def.hire) reason = `ค่าจ้างแรกเข้า ${def.hire} G ไม่พอ`;
  return { ok: !reason, reason, level, hired: Boolean(level), working: Boolean(staffOn(state, id)), station, days: state.staff?.[id]?.days || 0, nextAt: level ? level * 2 : 0, salary: staffSalary(id, level || 1), hire: def.hire };
}
function hireStaff(state, id) {
  const st = staffStatus(state, id);
  if (!st.ok) return failure(st.reason);
  transact(state, { gold: STAFF[id].hire }, `จ้าง${STAFF[id].name}`);
  state.staff = { ...(state.staff || {}), [id]: { level: 1, days: 0 } };
  addLog(state, `${STAFF[id].icon} ${STAFF[id].name}เริ่มงานที่${st.station}แล้ว`, 'build');
  return success(`จ้าง${STAFF[id].name}แล้ว · เงินเดือน ${st.salary} G/วัน`);
}
function fireStaff(state, id) {
  if (!staffLevel(state, id)) return failure('ยังไม่ได้จ้างตำแหน่งนี้');
  const staff = { ...state.staff }; delete staff[id]; state.staff = staff;
  return success(`${STAFF[id].name}ลาออกแล้ว`);
}
/** Each morning: salaries are paid, and staff who worked grow more skilled every few days. */
function payStaff(state) {
  for (const [id, s] of Object.entries(state.staff || {})) {
    if (!STAFF[id]) continue;
    const pay = staffSalary(id, s.level);
    if (state.gold < pay) { addLog(state, `เงินไม่พอจ่ายเงินเดือน${STAFF[id].name} วันนี้เขาไม่ได้พัฒนาฝีมือ`, 'warning'); continue; }
    transact(state, { gold: pay }, 'เงินเดือนพนักงาน');
    if (!staffOn(state, id)) continue;
    s.days = (s.days || 0) + 1;
    if (s.level < STAFF_MAX_LEVEL && s.days >= s.level * 2) { s.level += 1; s.days = 0; addLog(state, `${STAFF[id].icon} ${STAFF[id].name}เก่งขึ้นเป็นเลเวล ${s.level}`, 'level'); }
  }
}
/** Seats in the hall: four stools at every bar, four chairs at every dining table (meals need the kitchen). */
export function hallSeats(state) {
  const bars = state.facilities.filter(f => f.type === 'bar').length, tables = roomLevel(state, 'kitchen') ? state.facilities.filter(f => f.type === 'dining').length : 0;
  return { bar: bars * 4, dining: tables * 4, total: bars * 4 + tables * 4 };
}
/** A drink at the bar: better with a bigger bar and a bartender; a team back from a won job celebrates and spends more. */
export function barPrice(state, celebrate = false) {
  return Math.round((3 + bestRoomLevel(state, 'bar') * 1.5) * (1 + staffOn(state, 'bartender') * 0.2) * (celebrate ? 2.5 : 1) * (hasPolicy(state, 'tavern') ? 1.25 : 1));
}
/** A meal at a dining table: cooked at the stove, better with a cook. */
export function mealPrice(state) {
  return Math.round((4 + bestRoomLevel(state, 'kitchen') * 1.5 + bestRoomLevel(state, 'dining')) * (1 + staffOn(state, 'cook') * 0.15) * (hasPolicy(state, 'tavern') ? 1.25 : 1));
}
/** An adventurer dropping in sits down: a meal when tired (and there is a table and a kitchen), otherwise a drink at the bar. */
function visitGuild(state, member) {
  const celebrate = Boolean(member.celebrate); member.celebrate = false;
  const seats = hallSeats(state);
  if (!seats.total) return;
  const meal = seats.dining > 0 && (member.energy < 75 || !seats.bar) && !celebrate;
  const price = meal ? mealPrice(state) : barPrice(state, celebrate);
  if ((member.purse || 0) < price + 10) return;
  member.purse -= price;
  transact(state, { gold: price }, meal ? 'อาหารจากครัว' : 'บาร์และครัว', 1);
  state.record.hall = (state.record.hall || 0) + price;
  state.village.prosperity += price * 0.02;
  const cook = staffOn(state, 'cook'), bartender = staffOn(state, 'bartender'), kitchen = bestRoomLevel(state, 'kitchen');
  if (meal) { member.energy = clamp(member.energy + 5 + kitchen + cook * 2, 0, 100); member.morale = clamp(member.morale + 1, 0, 100); }
  else { member.energy = clamp(member.energy + 2, 0, 100); member.morale = clamp(member.morale + 2 + bartender + (celebrate ? 5 : 0), 0, 100); }
  member.atBar = state.elapsed; member.seatKind = meal ? 'dining' : 'bar';
}
/** An unhappy adventurer moves away: their room frees up, friendships and exam places go with them. */
function leaveTown(state, member) {
  state.members = state.members.filter(m => m !== member);
  for (const key of Object.keys(state.bonds)) if (key.split(':').includes(member.id)) delete state.bonds[key];
  if (state.exams) state.exams.queue = state.exams.queue.filter(q => q.id !== member.id);
  delete state.daily.lessons?.[member.id]; delete state.daily.work?.[member.id];
  if (state.today) state.today.left += 1;
  addLog(state, `${member.name}ขวัญเสียมานาน จึงย้ายออกจากเมืองไปหากิลด์อื่น`, 'warning');
}
/** A rookie who keeps coming back becomes one of the guild's named regulars. */
function maybeRegular(state, member) {
  if (member.regular || (member.missionsDone || 0) < 5 || state.members.filter(m => m.regular).length >= regularLimit(state)) return;
  member.regular = true;
  addLog(state, `${member.name}รับงานกับกิลด์จนเป็นขาประจำแล้ว ทุกคนในกิลด์รู้จักชื่อ`, 'member');
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
  const ready = state.members.filter(member => !isBusy(state, member.id) && member.energy >= 25 && member.injury <= 40 && rankAllows(member, quest));
  const score = member => getMemberStats(state, member).power * (0.6 + member.energy / 250);
  const team = [];
  for (const role of quest.tags) {
    const pick = ready.filter(member => !team.includes(member) && getMemberStats(state, member).role === role).sort((a, b) => score(b) - score(a))[0];
    if (pick && team.length < partyLimit(quest)) team.push(pick);
  }
  for (const member of ready.filter(member => !team.includes(member)).sort((a, b) => score(b) - score(a))) if (team.length < partyLimit(quest)) team.push(member);
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
/** Raids take up to six members (two teams); every other quest takes one to three. */
export const partyLimit = quest => quest?.raid ? 6 : 3;
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
  // Parties that plan together at the guild's party table set out better prepared.
  const tableBonus = options.auto ? bestRoomLevel(state, 'dispatch') * 0.03 : 0;
  const power = Math.round(members.reduce((sum, member) => sum + getMemberStats(state, member).power, 0) * (1 + roleBonus + bondBonus + libraryBonus + traitBonus + tableBonus) * (selectedPolicy?.power || 1));
  const readiness = power / quest.difficulty;
  let reason = questLockReason(state, quest);
  if (!reason && !selectedPolicy) reason = 'แผนเดินทางไม่ถูกต้อง';
  if (!reason && (!Array.isArray(memberIds) || memberIds.length < 1 || memberIds.length > partyLimit(quest) || new Set(memberIds).size !== memberIds.length || members.length !== memberIds.length)) reason = `เลือกสมาชิก 1–${partyLimit(quest)} คน`;
  if (!reason && members.some(member => isBusy(state, member.id))) reason = 'สมาชิกบางคนไม่อยู่กิลด์';
  const underRanked = members.find(member => !rankAllows(member, quest));
  if (!reason && underRanked) reason = `${underRanked.name} แรงค์ ${underRanked.rank || 'F'} รับงานระดับ ${quest.rank} ไม่ได้ (ต้องแรงค์ ${ADVENTURER_RANKS[ADVENTURER_RANKS.indexOf(quest.rank) - 1]} ขึ้นไป)`;
  if (!reason && members.some(member => member.energy < 25 || member.injury > 40)) reason = 'สมาชิกต้องพักให้พลังอย่างน้อย 25 และบาดเจ็บไม่เกิน 40';
  const slots = getGuildStats(state);
  if (!reason && (options.auto ? slots.boardMissions >= slots.boardCap : slots.activeMissions >= slots.teamCap)) reason = options.auto ? 'ช่องทีมจากกระดานเต็มแล้ว' : 'ทีมภารกิจเต็มแล้ว';
  if (!reason && quest.raid && !options.auto && slots.activeMissions + 2 > slots.teamCap && slots.activeMissions < slots.teamCap) reason = 'ภารกิจจู่โจมใช้ 2 ช่องทีม รอทีมอื่นกลับก่อน';
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
  const thrift = hasPolicy(state, 'thrift') ? 0.85 : 1;
  return Object.fromEntries(RESOURCE_KEYS.map(key => [key, Math.ceil((base[key] || 0) * (0.7 + room.level * 0.6) * thrift)]));
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
  mission.petition = { id: petition.id, fee: petition.fee, plan: petition.plan, client: petition.client, important: petition.important, bonus: petition.bonus || 0 };
  mission.prep = payload.auto ? 5 : 0;
  if (payload.auto) mission.auto = true;
  mission.realtime = true;
  petition.status = 'taken'; petition.missionId = mission.id;
  state.missions.push(mission);
  party.forEach(member => { member.task = 'mission'; member.autoTrain = false; });
  if (!mission.prep) startExpedition(state, lifeContext(state), mission, quest);
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

function resolveMission(state, mission, outcome) {
  const quest = QUEST_BY_ID[mission.questId];
  if (mission.event && !mission.event.resolved) {
    mission.event.resolved = true;
    mission.event.choiceId = 'auto';
    addLog(state, `ทีมตัดสินใจตามแผนสมดุลเมื่อไม่มีคำแนะนำเพิ่มเติม`, 'event');
  }
  const readiness = mission.readiness + mission.decisionBonus;
  const won = outcome ?? (readiness >= 0.82 && mission.combat.partyHp > 0);
  mission.status = won ? 'completed' : 'failed';
  if (state.today) { if (won) state.today.jobs += 1; else state.today.failed += 1; }
  mission.progress = mission.duration;
  mission.finishedAt = state.elapsed;
  const dailyCount = state.daily.missionCounts[quest.id] || 0;
  state.daily.missionCounts[quest.id] = dailyCount + 1;
  const wasCompleted = Boolean(state.completedQuests[quest.id]);
  if (won) {
    // Repeat contracts pay less; they are renewable work, not unlimited full first-clear bounties.
    // A field half-eaten or a battered wagon pays less: the client only pays for what was saved.
    const saved = mission.rt?.field ? clamp(mission.rt.crops / 100, 0, 1) : mission.rt?.wagon ? clamp(mission.rt.wagon.hp / mission.rt.wagon.maxHp, 0, 1) : 1;
    const multiplier = (!wasCompleted ? 1 : dailyCount >= 3 ? 0.35 : 0.7) * (0.5 + 0.5 * saved);
    const rewards = Object.fromEntries(RESOURCE_KEYS.map(key => [key, Math.floor((quest.reward[key] || 0) * multiplier)]));
    rewards.herb += mission.bonusHerb || 0;
    let wages = 0;
    if (mission.petition) {
      // The client pays the fee; the guild keeps its commission and the team shares the rest.
      const pay = getPayout(state, Math.floor(mission.petition.fee * multiplier), mission.petition.plan);
      rewards.gold = Math.round(pay.guild * (hasPolicy(state, 'broker') ? 1.12 : 1)); wages = pay.adventurers + (mission.petition.bonus || 0);
      mission.memberIds.forEach(id => { const member = memberById(state, id); member.purse = (member.purse || 0) + wages / mission.memberIds.length; });
      state.village.prosperity += pay.fee * 0.05;
    }
    transact(state, rewards, mission.petition ? `ค่านายหน้า: ${quest.name}` : `รางวัล: ${quest.name}`, 1);
    // Work the adventurers picked up by themselves earns the guild half the renown of work it sends.
    const rep = Math.max(1, Math.round(quest.reward.rep * multiplier * renownFactor(state, quest) * (mission.auto ? 0.5 : 1) * (1 + roomLevel(state, 'reception') * 0.05) * (1 + (state.upgrades?.trophyHall || 0) * 0.06) * (hasPolicy(state, 'fame') ? 1.2 : 1)));
    state.rep += rep;
    state.completedQuests[quest.id] = (state.completedQuests[quest.id] || 0) + 1;
    if (mission.petition) { state.record ??= { jobs: 0 }; state.record.jobs += 1; }
    state.questRuns[quest.id] = (state.questRuns[quest.id] || 0) + 1;
    mission.result = { success: true, reward: { ...rewards, rep }, wages: Math.round(wages), title: 'กลับบ้านอย่างปลอดภัย', message: mission.petition ? `${quest.name} สำเร็จ ${mission.petition.client}จ่าย ${Math.floor(mission.petition.fee * multiplier)} G · กิลด์ได้ค่านายหน้า ${rewards.gold} G · ทีมได้ ${Math.round(wages)} G` : `${quest.name} สำเร็จ ได้ ${rewards.gold} เหรียญ และชื่อเสียง ${rep}` };
    if (mission.petition) state.petitions = state.petitions.filter(p => p.id !== mission.petition.id);
    mission.result.loot = grantLoot(state, mission, 3);
    if (mission.rt?.field) mission.result.saved = { what: mission.rt.field.name, pct: Math.round(saved * 100) };
    if (mission.rt?.wagon) mission.result.saved = { what: 'เกวียน', pct: Math.round(saved * 100) };
    if (mission.rt?.npcs) mission.result.rescued = mission.rt.npcs.length;
    if (quest.id === 'dragon' && !wasCompleted) { state.trade.treasures = [...(state.trade.treasures || []), { id: 'emberCrown', from: 'ราชันมังกรเพลิง' }]; noteTreasure(state, 'emberCrown'); addLog(state, 'ทีมนำมงกุฎเพลิงราชันมังกรกลับมาด้วย! วางโชว์หรือประมูลได้ที่ตลาด', 'story'); }
    state.goals.firstMission = true;
    improveBonds(state, mission.memberIds, 9);
    if (quest.id === 'hollow') state.story.chapter = Math.max(2, state.story.chapter);
    if (quest.id === 'ruins') state.story.chapter = Math.max(3, state.story.chapter);
    if (quest.id === 'rescue') state.story.chapter = Math.max(4, state.story.chapter);
    if (quest.id === 'heart' && state.story.chapter < 5) {
      state.story.chapter = 5;
      addLog(state, 'หมอกจางลง ทีมสำรวจกลับถึงบ้าน หัวใจป่าผลิใบใหม่ — จบบทที่หนึ่ง! สมาคมกิลด์ส่งจดหมายเชิญไปชายแดนตะวันออก', 'story');
    }
    if (quest.id === 'canyonroad') { state.frontier = { ...(state.frontier || {}), camp: Math.max(1, state.frontier?.camp || 0) }; state.story.chapter = Math.max(6, state.story.chapter); addLog(state, 'ค่ายแนวหน้าตั้งขึ้นที่ปากหุบผาลมแดงแล้ว ทีมที่ผ่านจะได้พักและรักษาตัวที่นี่', 'story'); }
    if (quest.id === 'wyrm') state.story.chapter = Math.max(7, state.story.chapter);
    if (quest.final) {
      state.story.finished = true;
      state.story.chapter = 8;
      state.story.finishedAt = state.elapsed;
      addLog(state, 'ราชันมังกรเพลิงกลับสู่การหลับใหล ภูเขาไฟสงบ ชาวชายแดนจุดโคมฉลองทั้งคืน — จบบทที่สอง! เล่นดูแลกิลด์ต่อได้ แรงค์ A จะเปิดในบทต่อไป', 'story');
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
    member.morale = clamp(member.morale + (won ? 4 : -9) + (won && mission.petition ? PAYOUT_PLANS[mission.petition.plan]?.morale || 0 : 0), 20, 100);
    // Real-time quests hurt as much as the fight did: knocked-out members were already hurt on the way home.
    const back = mission.rt?.back?.[member.id];
    const injury = back ? (back.ko ? 0 : Math.round((1 - back.hp) * 22)) : won ? Math.max(0, Math.round((1.12 - readiness) * 23 + mission.risk * 3)) : 16 + Math.round(mission.risk * 10);
    const healerReduction = mission.roles?.includes('heal') ? 3 : 0;
    let hurt = Math.max(0, injury - (traitOf(member).injuryReduction || 0) - healerReduction);
    if (hurt > 4 && member.pack?.potion > 0) { member.pack.potion -= 1; hurt = Math.round(hurt / 2); }
    member.injury = clamp(member.injury + hurt, 0, 100);
    // Gear wears with every journey, more on a retreat; the smithy mends it.
    member.wear ??= { weapon: 100, accessory: 100 };
    for (const slot of ['weapon', 'accessory']) if (member.equipment[slot]) member.wear[slot] = Math.max(0, member.wear[slot] - Math.round(7 + mission.risk * 6 + (won ? 0 : 8)));
    member.missionsDone += won ? 1 : 0;
    if (won) member.celebrate = true;
    maybeRegular(state, member);
    // Personal merit: work above one's rank counts for more, work far below for little.
    const gap = ADVENTURER_RANKS.indexOf(quest.rank) - memberRankIndex(member);
    member.points = (member.points || 0) + Math.round(10 * (gap >= 1 ? 1.5 : gap === 0 ? 1 : gap === -1 ? 0.5 : 0.2) * (won ? 1 : 0.3));
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
    state.progress ??= createProgress();
    if (state.progress.offer) choosePolicy(state.progress, state.progress.offer.cards[0]);
    addChest(state.progress, 'gold', `เลื่อนเป็นกิลด์ระดับ ${nextRank}`);
    offerPolicies(state.progress, nextRank, () => worldRandom(state));
    state.celebrate = { kind: 'rank', rank: nextRank, at: state.elapsed };
    nextRank = RANKS[rankIndex(state.rank) + 1];
  }
}

/** Close the day's book: where the money came from and went, how well everyone worked, who came and who left. */
function closeDay(state) {
  const t = state.today || newDay(state.day - 1), eff = t.effN ? Math.round(t.effSum / t.effN * 100) / 100 : getEfficiencyReport(state).avg;
  const sum = book => Object.values(book).reduce((a, b) => a + b, 0);
  const city = { pop: population(state), sat: Math.round(state.village?.satisfaction ?? 0), movedIn: t.movedIn || 0, movedOut: t.movedOut || 0 };
  const summary = { ...city, day: t.day, income: t.income, expense: t.expense, incomeTotal: sum(t.income), expenseTotal: sum(t.expense), eff, joined: t.joined, left: t.left, jobs: t.jobs, failed: t.failed, members: state.members.length, losses: getEfficiencyReport(state).losses.map(l => ({ id: l.id, gold: l.gold })) };
  state.history = [...(state.history || []), summary].slice(-7);
  state.today = newDay(state.day);
}
function dailyUpdate(state) {
  closeDay(state);
  payStaff(state);
  dailyTrade(state, tradeContext(state));
  if (state.bounty && !state.world.monsters.some(m => m.id === state.bounty.monsterId && !m.dead)) state.bounty = null;
  if (state.day % 2 === 0) postBounty(state);
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
  const people = population(state);
  if (shop) transact(state, { gold: Math.round(shop * (12 + people * 0.25)) }, 'ค่าเช่าร้านค้าในหมู่บ้าน', 1);
  // Townsfolk drop in at the guild's bar too: a bigger town fills more tables.
  if (roomLevel(state, 'bar')) transact(state, { gold: Math.round(people * 0.5 * bestRoomLevel(state, 'bar') * (1 + staffOn(state, 'bartender') * 0.2)) }, 'บาร์และครัว (ชาวเมือง)', 1);
  if (market) transact(state, { wood: market * 3, stone: market * 2, herb: market * 2 }, 'ของจากตลาดนัด', 1);
  const hall = state.upgrades?.trophyHall || 0, monument = state.village?.monument || 0;
  if (hall) transact(state, { gold: hall * 30 }, 'ค่าเข้าชมหอเกียรติยศ', 1);
  if (monument) { state.rep += monument * 3; state.members.forEach(member => { member.morale = clamp(member.morale + monument * 2, 0, 100); }); }
  settleIdle(state, true);
  restockShops(state);
  state.daily = { missionCounts: {}, work: {}, lessons: {}, garden: Boolean(garden) };
  startDailyGoals(state);
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
export const AUTO_PETITION_WAIT = 25;
/** Story and rank steps stay "important" (a letter from the elder, well paid) until first cleared. */
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
    state.petitions.push({ id: `pet-${state.nextId++}`, questId: quest.id, client: 'ผู้ใหญ่บ้าน', seed: 7, home: 'elder', important: true, reserved: false, bonus: 0,
      fee: Math.round(quest.reward.gold * FEE_MULTIPLIER), plan: 'standard', status: 'posted', eta: 0, etaTotal: 20, patience: 80, age: 0, missionId: null });
  }
}
export function getVillageInfo(state) {
  const v = state.village || { prosperity: 0, houses: 3 };
  // A level needs both prosperity and people living in the village.
  const people = population(state);
  let index = 0;
  for (let i = 0; i < VILLAGE_LEVELS.length; i++) if (v.prosperity >= VILLAGE_LEVELS[i].prosperity && people >= VILLAGE_LEVELS[i].population) index = i;
  const now = VILLAGE_LEVELS[index], next = VILLAGE_LEVELS[index + 1] || null;
  const part = (have, from, to) => to > from ? clamp((have - from) / (to - from), 0, 1) : 1;
  return { level: now.level, name: now.name, prosperity: Math.floor(v.prosperity), population: people, next, progress: next ? Math.min(part(v.prosperity, now.prosperity, next.prosperity), part(people, now.population, next.population)) : 1,
    houses: v.houses, inn: v.inn || 0, maxHouses: Math.min(VILLAGE_LOTS.houses.length, 2 + now.level * 2), ...Object.fromEntries(VILLAGE_BUSINESSES.map(id => [id, v[id] || 0])),
    interval: petitionInterval(state), maxWaiting: 2 + Math.floor(now.level / 2), maxPosted: 4 + roomLevel(state, 'reception'), idleRate: idleRate(state) };
}
function petitionInterval(state) {
  const people = population(state), sign = state.upgrades?.signboard || 0;
  return Math.max(34, Math.round(85 / ((1 + sign * 0.1) * (1 + people * 0.03) * (1 + staffOn(state, 'receptionist') * 0.08))));
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
    seed: Math.floor(petitionRandom(state) * 100000), home, important: false, reserved: false, bonus: 0,
    fee: Math.round(quest.reward.gold * FEE_MULTIPLIER * (0.85 + petitionRandom(state) * 0.3)), plan: options.plan || state.payoutPlan || 'standard',
    status, eta: status === 'coming' ? eta : 0, etaTotal: eta, patience: 80 + staffOn(state, 'receptionist') * 25, age: 0, missionId: null };
  state.petitions.push(petition);
  return petition;
}
function spawnPetition(state) {
  const open = QUESTS.filter(q => questOpen(state, q) && !q.final && !isImportantQuest(state, q.id)
    && state.petitions.filter(p => p.questId === q.id).length < 2);
  if (!open.length) return null;
  // Villagers bring work that suits the guild's standing: mostly at its rank, less of what it has outgrown.
  // Work the guild has never done comes a little more often, so its record stays varied.
  const weights = open.map(q => { const gap = rankIndex(state.rank) - rankIndex(q.rank); return (gap <= 0 ? 3 : gap === 1 ? 1.2 : 0.5) * (state.completedQuests[q.id] ? 1 : 2); });
  let pick = petitionRandom(state) * weights.reduce((a, b) => a + b, 0), quest = open[0];
  for (let i = 0; i < open.length; i++) { if (pick < weights[i]) { quest = open[i]; break; } pick -= weights[i]; }
  return addPetition(state, quest.id);
}
export const bonusStep = petition => Math.max(20, Math.round(petition.fee * 0.15 / 10) * 10);
function refundBonus(state, petition) { if (petition.bonus > 0) { transact(state, { gold: petition.bonus }, 'คืนเงินค่าหัวเพิ่ม', 1); petition.bonus = 0; } }
function postPetition(state, petition, planId) {
  petition.status = 'posted'; petition.plan = PAYOUT_PLANS[planId] ? planId : 'standard'; petition.age = 0;
  state.village.prosperity += 4;
}
/** Free adventurers: at home, rested, not training, and willing to take board work. */
function freeForBoard(state, member) {
  return !isBusy(state, member.id) && (member.task !== 'train' || member.autoTrain) && memberCondition(member).eff >= 0.9 && member.energy >= 60 && member.morale >= 25 && member.injury <= 25 && member.autoWork !== false;
}
/** How sure a team must be before taking a job: thrifty pay asks for a safer job, an added bonus makes them braver. */
export function boardThreshold(petition) {
  const plan = PAYOUT_PLANS[petition?.plan] || PAYOUT_PLANS.standard;
  return Math.max(0.7, plan.readiness - Math.min(0.25, (petition?.bonus || 0) / Math.max(1, petition?.fee || 1) * 0.6));
}
/** The smallest strong-enough team from a pool: cover roles, then add the strongest until ready. */
function pickTeam(state, quest, pool, threshold, options = {}) {
  if (!pool.length) return null;
  const limit = partyLimit(quest);
  // Adventurers favour work at or above their own rank: it counts towards their next rank.
  const score = member => getMemberStats(state, member).basePower * (ADVENTURER_RANKS.indexOf(quest.rank) >= memberRankIndex(member) ? 1.2 : 0.85);
  const team = [];
  const readiness = () => previewMission(state, quest.id, team.map(m => m.id), 'balanced', { auto: true }).readiness;
  const ready = () => readiness() >= threshold + 0.1;
  for (const role of quest.tags) {
    if (team.length >= limit || (team.length && ready())) break;
    const pick = pool.filter(m => !team.includes(m) && getMemberStats(state, m).role === role).sort((a, b) => score(b) - score(a))[0];
    if (pick) team.push(pick);
  }
  for (const member of pool.filter(m => !team.includes(m)).sort((a, b) => score(b) - score(a))) { if (team.length >= limit || (team.length && ready())) break; team.push(member); }
  // Mentoring: a team with room takes along the free junior who most needs the experience.
  const top = Math.max(-1, ...team.map(memberRankIndex));
  const junior = options.mentor && team.length && team.length < limit && pool.filter(m => !team.includes(m) && memberRankIndex(m) < top).sort((a, b) => memberRankIndex(a) - memberRankIndex(b) || (a.points || 0) - (b.points || 0))[0];
  if (junior) { team.push(junior); if (!ready()) team.pop(); }
  return { ids: team.map(m => m.id), readiness: team.length ? readiness() : 0 };
}
function pickBoardTeam(state, quest, petition) {
  // Low spirits: only easy work, nothing above their own rank.
  const pool = state.members.filter(member => freeForBoard(state, member) && rankAllows(member, quest) && (member.morale >= 45 || ADVENTURER_RANKS.indexOf(quest.rank) <= memberRankIndex(member)));
  const team = pickTeam(state, quest, pool, boardThreshold(petition), { mentor: true });
  if (!team) return null;
  const preview = previewMission(state, quest.id, team.ids, 'balanced', { auto: true });
  return preview.ok && preview.readiness >= boardThreshold(petition) ? team.ids : null;
}
/** Why a job on the board is still open: what the guild master can do about it. */
export function boardStatus(state, petition) {
  const quest = QUEST_BY_ID[petition.questId], mission = petition.missionId && state.missions.find(m => m.id === petition.missionId && m.status === 'active');
  if (mission) return { kind: 'taken', mission, text: `${mission.memberIds.map(id => memberById(state, id)?.name).join(' · ')} รับงานนี้แล้ว` };
  if (petition.status !== 'posted') return { kind: 'desk', text: petition.status === 'coming' ? 'ชาวบ้านกำลังเดินมาที่กิลด์' : 'รอที่ว่างบนกระดาน' };
  const stats = getGuildStats(state), need = boardThreshold(petition);
  if (!roomLevel(state, 'board')) return { kind: 'board', text: 'ยังไม่มีกระดานคำร้องในกิลด์' };
  const lock = questLockReason(state, quest);
  if (lock) return { kind: 'locked', text: lock };
  if (state.missions.some(m => m.status === 'active' && m.questId === quest.id)) return { kind: 'same', text: 'มีทีมทำงานแบบเดียวกันอยู่ รอทีมนั้นกลับก่อน' };
  if (!canAfford(state, quest.cost)) return { kind: 'supplies', text: `กิลด์ไม่มีเสบียงให้ทีม (ต้องการ ${Object.entries(quest.cost).map(([k, n]) => `${n} ${k === 'gold' ? 'G' : k}`).join(' ')})` };
  const ranked = state.members.filter(m => rankAllows(m, quest));
  if (!ranked.length) return { kind: 'rank', text: `ยังไม่มีใครแรงค์ถึง (ต้องแรงค์ ${ADVENTURER_RANKS[Math.max(0, ADVENTURER_RANKS.indexOf(quest.rank) - 1)]} ขึ้นไป)` };
  const best = pickTeam(state, quest, ranked, need);
  if (!best || best.readiness < need) return { kind: 'hard', readiness: best?.readiness || 0, need, text: `ยากเกินไป: ทีมที่ดีที่สุดในเมืองพร้อม ${Math.round((best?.readiness || 0) * 100)}% ต้องการ ${Math.round(need * 100)}%` };
  if (stats.boardMissions >= stats.boardCap) return { kind: 'slots', text: `กระดานส่งทีมเต็ม (${stats.boardCap} งานพร้อมกัน) อัปเกรดกระดานเพื่อรับงานเพิ่ม` };
  const free = ranked.filter(m => freeForBoard(state, m)), now = pickTeam(state, quest, free, need);
  if (now && now.readiness >= need) return { kind: 'soon', text: 'มีคนกำลังอ่านใบนี้อยู่' };
  if (now && now.readiness >= 0.85) return { kind: 'pay', text: 'ค่าตอบแทนน้อย: คนที่ว่างอยู่ไม่อยากเสี่ยงกับค่าจ้างนี้ ลองเพิ่มค่าตอบแทน' };
  return { kind: 'busy', text: `คนที่เก่งพอกำลังพักหรือออกงาน (ว่างตอนนี้ ${free.length} คน)` };
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
      if (petition.eta <= 0) { petition.status = 'waiting'; petition.eta = 0; petition.waited = 0; }
    } else if (petition.status === 'waiting') {
      const posted = state.petitions.filter(p => p.status === 'posted' && !p.important).length;
      // The desk pins every request up at the guild's usual pay as soon as there is room on the board.
      petition.waited = (petition.waited || 0) + step;
      if (state.policy?.autoPetitions !== false && petition.waited >= (staffOn(state, 'receptionist') ? 0 : AUTO_PETITION_WAIT) && posted < info.maxPosted) { postPetition(state, petition, state.payoutPlan); addLog(state, `${petition.client}ฝากคำร้อง “${QUEST_BY_ID[petition.questId].name}” ขึ้นกระดานแล้ว`, 'petition'); continue; }
      petition.patience -= step;
      if (petition.patience <= 0) { state.petitions = state.petitions.filter(p => p !== petition); addLog(state, `${petition.client}รอนานเกินไปเลยกลับบ้านก่อน`, 'info'); }
    } else if (petition.status === 'posted') {
      petition.age += step;
      if (!petition.important && petition.age > BOARD_LIFETIME) { refundBonus(state, petition); state.petitions = state.petitions.filter(p => p !== petition); addLog(state, `คำร้อง “${QUEST_BY_ID[petition.questId].name}” ไม่มีใครรับจนหมดเวลา ชาวบ้านไปหาทางอื่นแล้ว`, 'warning'); }
    }
  }
  // Adventurers with nothing to do walk to the board and take work they can handle.
  if (!roomLevel(state, 'board')) return;
  const stats = getGuildStats(state);
  if (stats.boardMissions >= stats.boardCap) return;
  const appeal = p => (PAYOUT_PLANS[p.plan]?.share || 0) * p.fee + (p.bonus || 0) + (p.important ? 400 : 0);
  const board = state.petitions.filter(p => p.status === 'posted' && !p.missionId && p.age >= 8 / ((PAYOUT_PLANS[p.plan]?.eager || 1) * (1 + Math.min(1, (p.bonus || 0) / Math.max(1, p.fee)))))
    .sort((a, b) => appeal(b) - appeal(a));
  for (const petition of board) {
    const quest = QUEST_BY_ID[petition.questId];
    if (state.missions.some(m => m.status === 'active' && m.questId === quest.id) || !canAfford(state, quest.cost)) continue;
    const team = pickBoardTeam(state, quest, petition);
    if (!team) continue;
    const result = sendMission(state, { questId: quest.id, memberIds: team, policy: 'balanced', petitionId: petition.id, auto: true });
    if (result.ok) break;
  }
}
/** Rally bounty: in a crisis the guild pays everyone at home to turn out — against a raid at the gate or a world boss. */
export function rallyCost(state) { return 15 + rankIndex(state.rank) * 10; }
function rally(state) {
  const raid = state.world.monsters.some(m => m.raid && !m.dead), boss = bossAlive(state);
  if (!raid && !boss) return failure('ตอนนี้ไม่มีมอนบุกหรือบอสโลก');
  const fit = m => !isBusy(state, m.id) && m.injury <= 50 && m.energy >= 20;
  const ready = state.members.filter(fit), each = rallyCost(state);
  if (!ready.length) return failure('ไม่มีใครอยู่ในเมืองที่สู้ไหว');
  const count = Math.min(ready.length, Math.floor(state.gold / each));
  if (!count) return failure(`ต้องมีเงินอย่างน้อย ${each} G`);
  const called = new Set(ready.sort((a, b) => getMemberStats(state, b).basePower - getMemberStats(state, a).basePower).slice(0, count).map(m => m.id));
  const pick = m => called.has(m.id);
  transact(state, { gold: count * each }, 'ค่าหัวระดมพล');
  for (const m of state.members) if (called.has(m.id)) { m.purse = (m.purse || 0) + each; m.morale = clamp(m.morale + 5, 0, 100); }
  if (raid) { const ctx = lifeContext(state); rallyDefenders(state, { ...ctx, freeToDefend: pick }); }
  else rallyToBoss(state, lifeContext(state), boss.zone, pick);
  addLog(state, `ระดมพล! ${count} คนรับค่าหัว ${each} G ออกไป${raid ? 'ป้องกันเมือง' : `สู้${monsterName(boss.species)}`}`, 'event');
  return success(`ระดมพล ${count} คน (จ่าย ${count * each} G)`);
}
function settleIdle(state, force = false) {
  if (state.idleBank >= 40 || (force && state.idleBank >= 1)) {
    const gold = Math.floor(state.idleBank);
    state.idleBank -= gold;
    transact(state, { gold }, 'ดอกผลกองทุนและค่าแผงตลาด', 1);
  }
}
// ---- The living world: the helpers life.js needs from the guild. ----
export const hunterOf = (state, id) => state.world?.hunters?.find(h => h.id === id) || null;
function lifeContext(state) {
  return {
    stats: member => getMemberStats(state, member), addXp: (member, xp) => addXp(state, member, xp), xpNeeded,
    log: (text, type) => addLog(state, text, type), income: (gold, reason) => transact(state, { gold }, reason, 1),
    prosperity: n => { state.village.prosperity += n; }, price: key => marketPrice(state, key), marketAdd: (key, n) => { state.market[key] = (state.market[key] || 0) + n; },
    zoneOpen: zone => hasRank(state, zone.rank) && (zone.rank !== 'B' || (state.frontier?.camp || 0) > 0), guildRankIndex: () => rankIndex(state.rank), door: () => guildDoor(state),
    bond: (a, b) => state.bonds[bondKey(a, b)] || 0, freeTarget: () => 0,
    // Guild work comes first: while the board has open jobs, adventurers wait until they are fresher before going hunting.
    freeToHunt: member => state.policy?.memberHunting !== false && !introActive(state) && !isBusy(state, member.id) && member.energy >= ((state.petitions || []).some(p => p.status === 'posted' && !p.missionId && roomLevel(state, 'board')) ? 78 : 70) && member.injury <= 15 && member.autoWork !== false && (member.task !== 'train' || member.autoTrain) && !member.waitingReason,
    // Word of the guild's hunters spreads: fair renown for work at the guild's own level.
    renown: (zone, kills) => { const z = HUNT_ZONES[zone]; if (z) state.rep += Math.round(kills * 0.15 * renownFactor(state, z) * 10) / 10; },
    storePart: (part, n) => { const t = state.trade, room = storeCapacity(state) - storeUsed(t); if (room > 0) t.store[part] = (t.store[part] || 0) + Math.min(n, room); },
    quest: id => QUEST_BY_ID[id], needsEvent: mission => { const q = QUEST_BY_ID[mission.questId]; return Boolean(q.story || (q.id === 'patrol' && !state.completedQuests.patrol)); },
    missionEvent: mission => missionEvent(state, mission), finishMission: (mission, won) => { if (mission.status === 'active') resolveMission(state, mission, Boolean(won)); },
    sellLoot: (hunter, who) => sellLoot(state, tradeContext(state), hunter, who),
    bossZone: () => bossAlive(state)?.zone || state.bounty?.zone || null,
    freeToDefend: member => !isBusy(state, member.id) && member.injury <= 40 && member.energy >= 20,
    onSpecialKill: (monster, hunter) => onSpecialKill(state, monster, hunter), codex: species => noteKill(state, species), luck: () => hasPolicy(state, 'scavenger') ? 2 : 1, onRaidReach: monster => onRaidReach(state, monster),
    campLevel: () => state.frontier?.camp || 0,
    atHome: member => !isBusy(state, member.id), lodge: member => lodgeSpot(state, member),
    visitGuild: member => visitGuild(state, member), hallCap: () => 8 + hallSeats(state).total, hasBar: () => hallSeats(state).total > 0,
    // Shops, the smithy, the dojo, the market: adventurers in town go where the village has something for them.
    shopSpots: () => villageBuildings(state).filter(b => b.kind !== 'house').map(b => doorOf(b)),
    indoors: member => member.task === 'train' || member.task === 'work' || (member.injury > 15 && roomLevel(state, 'infirmary') > 0) || state.missions.some(m => m.status === 'active' && m.prep > 0 && m.memberIds.includes(member.id)),
  };
}
/** Where an adventurer's room is: the inn first, then the rooms let in village houses. */
function lodgeSpot(state, member) {
  // The wounded go to the clinic when the town has one.
  if (member.injury > 20 && state.village?.clinic) { const b = villageBuildings(state).find(x => x.kind === 'clinic'); if (b) return doorOf(b); }
  const i = Math.max(0, state.members.indexOf(member)), v = state.village || {}, inn = 6 + (v.inn || 0) * 8, houses = Math.min(v.houses || 0, VILLAGE_LOTS.houses.length);
  if (i < inn || !houses) { const p = petitionHome('inn'); return { x: p.x + ((i % 3) - 1) * 0.35, y: p.y + 0.5 }; }
  return petitionHome(Math.floor((i - inn) / 2) % houses);
}
function onSpecialKill(state, monster, hunter) {
  if (monster.boss) bossDefeated(state, directorContext(state), monsterName(monster.species));
  if (monster.elite && state.bounty?.monsterId === monster.id) claimBounty(state, hunter);
}
// ---- The bounty board: now and then the association posts a price on a named pack leader. ----
const BOUNTY_TITLES = ['จ่าฝูง', 'เจ้าถิ่น', 'ตาเดียว', 'เขี้ยวเหล็ก', 'หางไฟ'];
function postBounty(state) {
  if (state.bounty || rankIndex(state.rank) < 2) return;
  const ctxZones = Object.entries(HUNT_ZONES).filter(([, z]) => hasRank(state, z.rank) && (z.rank !== 'B' || (state.frontier?.camp || 0) > 0));
  if (!ctxZones.length) return;
  const [zoneId, zone] = ctxZones.sort((a, b) => rankIndex(b[1].rank) - rankIndex(a[1].rank))[Math.floor(petitionRandom(state) * Math.min(2, ctxZones.length))];
  const species = zone.species[Math.floor(petitionRandom(state) * zone.species.length)], st = MONSTER_STATS[species], w = state.world;
  const title = BOUNTY_TITLES[Math.floor(petitionRandom(state) * BOUNTY_TITLES.length)], p = pointIn(w, zone, .5);
  const m = spawnMonster(w, species, zoneId, p, { elite: true, hp: st.hp * 4, maxHp: st.hp * 4, atk: Math.round(st.atk * 1.7), title });
  w.monsters.push(m);
  const reward = Math.round((120 + rankIndex(zone.rank) * 90) * (1 + rankIndex(state.rank) * .2));
  state.bounty = { monsterId: m.id, species, zone: zoneId, title, reward, rep: 6 + rankIndex(zone.rank) * 4, day: state.day };
  addLog(state, `ใบประกาศจับ: “${title}” ${monsterName(species)} ที่${zone.name} ค่าหัว ${reward} G`, 'event');
}
function claimBounty(state, hunter) {
  const b = state.bounty; state.bounty = null;
  const member = hunter?.kind === 'member' ? memberById(state, hunter.id) : null;
  if (member) {
    state.record.bounties = (state.record.bounties || 0) + 1;
    transact(state, { gold: Math.round(b.reward * .5) }, `ค่าหัว ${b.title}`, 1); member.purse = (member.purse || 0) + Math.round(b.reward * .5); member.points = (member.points || 0) + 20; state.rep += b.rep;
    addLog(state, `${member.name}ปราบ “${b.title}” ได้! สมาคมจ่ายค่าหัว ${b.reward} G (ครึ่งหนึ่งเข้ากิลด์)`, 'success');
  } else {
    const f = state.world.free.find(x => x.id === hunter?.id); if (f) { f.purse = (f.purse || 0) + b.reward; f.affinity = clamp((f.affinity || 0) + 12, 0, 100); }
    state.rep += Math.round(b.rep / 3);
    addLog(state, `${f?.name || 'นักผจญภัยอิสระ'}ปราบ “${b.title}” และรับค่าหัวไป`, 'hunt');
  }
}
function onRaidReach(state, monster) { monster.dead = true; raidReached(state, directorContext(state)); }
const monsterName = species => SPECIES[species]?.name || species;
const bossAlive = state => state.world.monsters.find(m => m.boss && !m.dead) || null;
// ---- The storyteller: helpers events.js uses to touch the guild and the world. ----
function directorContext(state) {
  const w = state.world, member = id => memberById(state, id);
  const nudge = (id, key, n) => { const m = member(id); if (m) m[key] = clamp((m[key] || 0) + n, 0, 100); };
  const home = () => state.members.filter(m => !isBusy(state, m.id));
  return {
    random: () => worldRandom(state), log: (text, type) => addLog(state, text, type),
    gold: (n, reason) => { if (n >= 0) transact(state, { gold: n }, reason, 1); else { const pay = Math.min(state.gold, -n); if (pay > 0) transact(state, { gold: pay }, reason); } },
    rep: n => { state.rep = Math.max(0, state.rep + n); }, prosperity: n => { state.village.prosperity = Math.max(0, state.village.prosperity + n); },
    res: (key, n) => { state[key] = Math.max(0, (state[key] || 0) + n); }, has: (key, n) => (state[key] || 0) >= n,
    market: (key, n) => { state.market[key] = clamp((state.market[key] ?? 30) + n, 0, 120); },
    moraleAll: n => { for (const m of home()) nudge(m.id, 'morale', n); }, morale: (id, n) => nudge(id, 'morale', n), energy: (id, n) => nudge(id, 'energy', n),
    xp: (id, n) => { const m = member(id); if (m) addXp(state, m, n); }, points: (id, n) => { const m = member(id); if (m) m.points = (m.points || 0) + n; },
    bond: (a, b, n) => { if (member(a) && member(b)) improveBonds(state, [a, b], n); },
    affinity: (id, n) => nudge(id, 'morale', Math.round(n / 3)),
    homeMembers: home, freeList: () => home().filter(m => !m.regular),
    openZones: () => Object.keys(HUNT_ZONES).filter(id => hasRank(state, HUNT_ZONES[id].rank)), zoneName: id => HUNT_ZONES[id]?.name || id,
    swarm: (zone, n) => { const z = HUNT_ZONES[zone]; for (let i = 0; i < n; i++) w.monsters.push(spawnMonster(w, z.species[i % z.species.length], zone, pointIn(w, z), { swarm: true })); },
    newFree: (affinity = null) => { const room = getLodging(state); if (room.count + room.coming >= room.cap) return null; const a = addApplicant(state, null, { affinity: affinity !== null }); addLog(state, `${a.bio.name} นักผจญภัยหน้าใหม่กำลังเดินทางมาลงทะเบียนกับกิลด์`, 'info'); return a; },
    rankIndex: () => rankIndex(state.rank), villageLevel: () => getVillageInfo(state).level, elapsed: () => state.elapsed, day: () => state.day,
    ready: () => !introActive(state) && Boolean(state.completedQuests.patrol),
    raidLeft: () => w.monsters.filter(m => m.raid && !m.dead).length, removeRaid: () => { w.monsters = w.monsters.filter(m => !m.raid); },
    bossAlive: () => Boolean(bossAlive(state)), removeBoss: () => { w.monsters = w.monsters.filter(m => !m.boss); },
    spawnRaid: (species, count) => { const weak = 1 - staffOn(state, 'scout') * 0.06; for (let i = 0; i < count; i++) { const m = spawnMonster(w, species[i % species.length], 'raid', { x: -15 - (i % 3) * 1.2 - Math.floor(i / 3) * .8, y: 17 + (i % 2) * .9 }, { raid: true }); m.hp = m.maxHp = Math.round(m.maxHp * weak); w.monsters.push(m); } },
    spawnBoss: (species, zone) => { const z = HUNT_ZONES[zone]; w.monsters.push(spawnMonster(w, species, zone, { x: z.x, y: z.y }, { boss: true })); },
    rally: () => rallyDefenders(state, lifeContext(state)), recallHunters: () => recallHunters(state, lifeContext(state)),
    scout: () => staffOn(state, 'scout'), population: () => population(state), scar: n => { state.village.raidScar = (state.village.raidScar || 0) + n; },
    alert: info => { state.director.alert = { ...info, until: state.elapsed + 45 }; },
    monsterName, memberName: id => MEMBER_BY_ID[id]?.name || id,
    famousCandidate: () => getAvailableRecruits(state).find(m => m.famous && !m.applying && hasRank(state, m.unlockRank))?.id || null,
    addApplicant: id => { const a = addApplicant(state, id); if (a) addLog(state, `ข่าวลือว่า${MEMBER_BY_ID[id].name}กำลังเดินทางมาที่กิลด์!`, 'rank'); },
  };
}
export function getDirector(state) { return state.director; }
// ---- Trade: helpers trade.js uses. ----
function tradeContext(state) {
  return {
    income: (gold, reason) => { if (gold > 0) transact(state, { gold: hasPolicy(state, 'trader') && /ขายส่ง|คาราวาน|ประมูล/.test(reason) ? Math.round(gold * 1.1) : gold }, reason, 1); }, found: id => noteTreasure(state, id), expense: (gold, reason) => { if (gold > 0) transact(state, { gold }, reason); },
    margin: () => roomLevel(state, 'appraisal') ? bestRoomLevel(state, 'appraisal') * 0.05 + staffOn(state, 'appraiser') * 0.04 : 0,
    log: (text, type) => addLog(state, text, type), random: () => worldRandom(state), villageLevel: () => getVillageInfo(state).level,
    rep: n => { state.rep += n; }, prosperity: n => { state.village.prosperity += n; }, renown: () => state.rep,
    merchants: () => Object.values(state.village.homes || {}).filter(h => h.tier >= 3).length,
    openParts: () => [...new Set(Object.values(HUNT_ZONES).filter(z => hasRank(state, z.rank)).flatMap(z => z.species.map(sp => MONSTER_PART[sp]).filter(Boolean)))],
  };
}
function sanitizeWorld(data, state, ids) {
  const fresh = createWorld(state.seed);
  if (!data || typeof data !== 'object') return fresh;
  const num = n => finiteNumber(n) && Math.abs(n) < 1e7;
  const monsters = (Array.isArray(data.monsters) ? data.monsters : []).filter(m => m && typeof m.id === 'string' && MONSTER_STATS_KEYS.has(m.species) && num(m.x) && num(m.y) && num(m.hp)).slice(0, 120);
  const free = (Array.isArray(data.free) ? data.free : []).filter(f => f && /^fa-\d+$/.test(f.id) && JOBS[f.class] && !JOBS[f.class].parent && TRAIT_NAMES.includes(f.trait) && typeof f.name === 'string' && f.name.length <= 20
    && Number.isInteger(f.level) && f.level >= 1 && f.level <= MAX_LEVEL && num(f.x) && num(f.y)).slice(0, 30);
  const freeIds = new Set(free.map(f => f.id));
  const hunters = (Array.isArray(data.hunters) ? data.hunters : []).filter(h => h && (h.kind === 'member' ? ids.has(h.id) : freeIds.has(h.id)) && num(h.x) && num(h.y) && num(h.hp) && h.bag && typeof h.party === 'string').slice(0, 60);
  for (const h of hunters) {
    h.bag.parts = Object.fromEntries(Object.entries(h.bag.parts && typeof h.bag.parts === 'object' ? h.bag.parts : {}).filter(([id, n]) => PARTS[id] && Number.isInteger(n) && n > 0 && n < 1000));
    h.bag.treasures = (Array.isArray(h.bag.treasures) ? h.bag.treasures : []).filter(id => TREASURES[id]).slice(0, 10);
  }
  const hunterIds = new Set(hunters.map(h => h.id));
  for (const f of free) if (f.mode === 'out' && !hunterIds.has(f.id)) f.mode = 'town';
  const porters = (Array.isArray(data.porters) ? data.porters : []).filter(p => p && hunterIds.has(p.target) && num(p.x) && num(p.y) && Array.isArray(p.path)).slice(0, 20);
  return { ...fresh, rng: Number.isInteger(data.rng) && data.rng > 0 ? data.rng >>> 0 : fresh.rng, nextId: Number.isInteger(data.nextId) && data.nextId > 0 ? data.nextId : 1,
    monsters, free, hunters, porters, freeClock: num(data.freeClock) ? data.freeClock : 30, departClock: num(data.departClock) ? data.departClock : 3, kills: Number.isInteger(data.kills) ? data.kills : 0 };
}

// ---- Adventurer ranks, lessons and exams: errands in the village. ----
/** A member may join work up to one rank above their own. */
const rankAllows = (member, quest) => ADVENTURER_RANKS.indexOf(quest.rank) <= memberRankIndex(member) + 1;
export function getAdventurerRank(state, member) {
  const next = ADVENTURER_RANKS[memberRankIndex(member) + 1], rule = next && ADVENTURER_RANK_RULES[next];
  if (!rule) return { rank: member.rank || 'F', next: null };
  const needs = [];
  if (rule.future) needs.push('เปิดในบทต่อไป');
  if (member.level < rule.level) needs.push(`เลเวล ${member.level}/${rule.level}`);
  if ((member.points || 0) < rule.points) needs.push(`แต้มผลงาน ${member.points || 0}/${rule.points}`);
  if ((state.village?.arena || 0) < rule.arena) needs.push(rule.arena > 1 ? `สนามสอบระดับ ${rule.arena}` : 'สร้างสนามสอบในหมู่บ้าน');
  const cooldown = Math.max(0, Math.ceil((member.examReadyAt || 0) - state.elapsed));
  const queued = Boolean(state.exams?.queue?.some(q => q.id === member.id)), sitting = member.errand?.kind === 'exam';
  return { rank: member.rank || 'F', next, rule, needs, cooldown, queued, sitting, nextRound: Math.max(0, Math.ceil((state.exams?.next ?? 0) - state.elapsed)), eligible: !needs.length && !cooldown && !queued && !sitting, chance: examChance(state, member, rule) };
}
function examChance(state, member, rule) {
  // The exam weighs strength and staying power, so healers and tanks are judged fairly beside strikers.
  const stats = getMemberStats(state, member), score = stats.basePower + stats.health * 0.08;
  return Math.round(clamp(0.15 + (score / rule.exam - 0.75) * 1.4, 0.05, 0.97) * 100) / 100;
}
/** Fees come from the member's own purse; the guild covers what they cannot. */
function payFee(state, member, fee, reason) {
  const own = Math.min(member.purse || 0, fee), rest = fee - own;
  if (rest > state.gold) return false;
  member.purse -= own;
  state.village.prosperity += own * 0.1;
  if (rest > 0) transact(state, { gold: rest }, reason);
  return true;
}
function startErrand(state, member, kind, duration, data = {}) {
  member.errand = { kind, start: state.elapsed, end: state.elapsed + duration, ...data };
  member.task = 'rest';
}
export function lessonFee(state) { return 10 + (state.village?.dojo || 0) * 8; }
/** Festivals (festivals.js): the guild master sets the prizes; the village and the guild feel the effects. */
function festivalContext(state) {
  const home = () => state.members.filter(m => !isBusy(state, m.id));
  const memberPower = m => { const st = getMemberStats(state, m); return Math.round(st.basePower + st.health * 0.08); };
  return {
    building: id => state.village?.[id] || 0, buildingName: id => VILLAGE_PROJECTS[id]?.name || id, villageLevel: () => getVillageInfo(state).level,
    random: () => petitionRandom(state), power: memberPower,
    guildPower: () => state.members.length ? state.members.reduce((s, m) => s + memberPower(m), 0) / state.members.length : 30,
    freeFighters: n => (state.world?.free || []).filter(f => f.mode === 'town').slice(0, n).map(f => { const st = freeStats(f); return { id: f.id, name: f.name, class: f.class, power: Math.round(st.basePower + st.health * 0.08) }; }),
    takeItem: item => {
      if (item?.type === 'gear' && (state.inventory[item.id] || 0) > 0 && EQUIPMENT_BY_ID[item.id]) { state.inventory[item.id] -= 1; return { type: 'gear', id: item.id, name: EQUIPMENT_BY_ID[item.id].name, value: gearPrice(EQUIPMENT_BY_ID[item.id]) }; }
      const i = item?.type === 'treasure' ? (state.trade?.treasures || []).indexOf(item.id) : -1;
      if (i >= 0 && TREASURES[item.id]) { state.trade.treasures.splice(i, 1); return { type: 'treasure', id: item.id, name: TREASURES[item.id].name, value: TREASURES[item.id].value }; }
      return null;
    },
    returnItem: item => { if (item.type === 'gear') state.inventory[item.id] = (state.inventory[item.id] || 0) + 1; else state.trade.treasures.push({ id: item.id, from: item.from || '' }); },
    canEnter: id => { const m = memberById(state, id); return Boolean(m) && !isBusy(state, id) && m.injury <= 40 && m.energy >= 30; },
    enter: (id, end) => { const m = memberById(state, id); if (m) { m.errand = { kind: 'festival', start: state.elapsed, end }; m.task = 'rest'; } },
    leave: id => { const m = memberById(state, id); if (m?.errand?.kind === 'festival') m.errand = null; },
    pay: (gold, reason) => transact(state, { gold }, reason), income: (gold, reason) => { if (gold > 0) transact(state, { gold }, reason, 1); },
    prosperity: n => { state.village.prosperity += n; }, rep: n => { state.rep += n; }, xp: (m, n) => addXp(state, m, n),
    bond: (ids, n) => improveBonds(state, ids, n), bondHome: n => { const ids = home().map(m => m.id); if (ids.length > 1) improveBonds(state, ids, n); },
    moraleAll: n => { for (const m of state.members) m.morale = clamp(m.morale + n, 0, 100); }, energyAll: n => { for (const m of home()) m.energy = clamp(m.energy + n, 0, 100); },
    freeWin: (id, gold) => { const f = state.world?.free?.find(x => x.id === id); if (f) { f.purse = (f.purse || 0) + gold; f.affinity = clamp((f.affinity || 0) + 10, 0, 100); } },
    applicant: champ => { const a = addApplicant(state, null, { status: 'coming' }); if (a && champ) { a.bio.name = champ.name.split('แห่ง')[0]; a.bio.class = JOBS[champ.cls] ? champ.cls : a.bio.class; a.level = Math.max(a.level, rankIndex(state.rank) * 3 + 2); a.fee += 150; a.famous = true; } },
    addFree: () => addFree(state, lifeContext(state)), log: (text, type) => addLog(state, text, type),
  };
}
setGoalJobs(Object.fromEntries(Object.entries(JOBS).filter(([, j]) => j.parent).map(([id, j]) => [id, j.parent])));
/** The guild master's objectives (goals.js), with this guild's village level filled in. */
export function getGoals(state) { return goalBoard(state, getVillageInfo(state).level); }
function claimGoalReward(state, id) {
  const r = claimGoal(state, id, getVillageInfo(state).level);
  if (!r.ok) return failure(r.message);
  transact(state, r.reward, `รางวัลเป้าหมาย: ${r.message.replace('สำเร็จ: ', '')}`, 1);
  addLog(state, `${r.message} · รับรางวัลแล้ว`, 'success');
  return success(r.message);
}
/** For the festival menu: can it be held now, and how many visitors would these prizes draw. */
export function getFestivalInfo(state, kind, gold = 0, itemValue = 0) {
  const ctx = festivalContext(state);
  return { ...festivalStatus(state, ctx, kind), visitors: festivalVisitors(state, ctx, kind, gold, itemValue) };
}
/** Prize items the guild could hand out: spare gear in the store room and treasures held for sale. */
export function festivalPrizeItems(state) {
  return [...Object.entries(state.inventory || {}).filter(([id, n]) => n > 0 && EQUIPMENT_BY_ID[id]).map(([id, n]) => ({ type: 'gear', id, name: EQUIPMENT_BY_ID[id].name, value: gearPrice(EQUIPMENT_BY_ID[id]), count: n })),
    ...[...new Set(state.trade?.treasures || [])].filter(id => TREASURES[id]).map(id => ({ type: 'treasure', id, name: TREASURES[id].name, value: TREASURES[id].value, count: state.trade.treasures.filter(x => x === id).length }))];
}
/** The frontier camp grows with the guild's money once the first camp stands. */
export const CAMP_COSTS = [null, null, { gold: 1400, wood: 30, stone: 30 }, { gold: 2600, wood: 50, stone: 50 }];
function upgradeCamp(state) {
  const lv = state.frontier?.camp || 0;
  if (!lv) return failure('ต้องผ่านคำร้อง “บุกเบิกทางสู่หุบผาลมแดง” เพื่อตั้งค่ายก่อน');
  const cost = CAMP_COSTS[lv + 1]; if (!cost) return failure('ค่ายแนวหน้าระดับสูงสุดแล้ว');
  if (!canAfford(state, cost)) return failure('เงินหรือวัสดุไม่พอ');
  transact(state, cost, `ขยายค่ายแนวหน้าเป็นระดับ ${lv + 1}`);
  state.frontier.camp = lv + 1;
  addLog(state, `ค่ายแนวหน้าขยายเป็นระดับ ${lv + 1}${lv + 1 === 2 ? ' · เปิดภารกิจจู่โจมแล้ว' : ' · ทีมพักฟื้นที่ค่ายได้เร็วขึ้น'}`, 'build');
  return success('ขยายค่ายแล้ว');
}
/** Exams run in rounds at the arena (exams.js); members sign up and pay before a round starts. */
function examContext(state) {
  return {
    arena: () => state.village?.arena || 0, passed: () => { state.record.passed = (state.record.passed || 0) + 1; }, rankInfo: member => getAdventurerRank(state, member),
    payFee: (member, fee, reason) => payFee(state, member, fee, reason), log: (text, type) => addLog(state, text, type),
    random: () => petitionRandom(state), busy: member => isBusy(state, member.id), chance: (member, rule) => examChance(state, member, rule),
    refund: (member, rank) => { member.purse = (member.purse || 0) + (ADVENTURER_RANK_RULES[rank]?.fee || 0); addLog(state, `${member.name}ติดงานตอนสอบเริ่ม ได้ค่าสมัครคืน`, 'member'); },
    rivals: n => (state.world?.free || []).filter(f => f.mode === 'town' && ADVENTURER_RANKS.indexOf(f.rank) < ADVENTURER_RANKS.indexOf('C')).slice(0, n)
      .map(f => ({ id: f.id, name: f.name, class: f.class, rank: f.rank, next: ADVENTURER_RANKS[ADVENTURER_RANKS.indexOf(f.rank) + 1] })),
  };
}
function startExam(state, member) {
  const r = registerExam(state, examContext(state), member);
  return r.ok ? success(r.message) : failure(r.message);
}
function startLesson(state, member) {
  const dojo = state.village?.dojo || 0, taken = state.daily.lessons?.[member.id] || 0;
  if (!dojo) return failure('ต้องสร้างโรงฝึกในหมู่บ้าน');
  if (taken >= dojo) return failure('วันนี้เรียนครบแล้ว');
  if (isBusy(state, member.id)) return failure('รอสมาชิกกลับมาที่กิลด์ก่อน');
  if (member.energy < 40 || member.injury > 30) return failure('ต้องพักก่อนไปเรียน');
  if (!payFee(state, member, lessonFee(state), `ค่าเรียน${member.name}`)) return failure('ค่าเรียนไม่พอ');
  state.daily.lessons = { ...(state.daily.lessons || {}), [member.id]: taken + 1 };
  startErrand(state, member, 'lesson', 30);
  return success(`${member.name} ไปเรียนที่โรงฝึก`);
}
function finishErrand(state, member) {
  const errand = member.errand;
  member.errand = null;
  if (errand.kind === 'lesson') {
    member.energy = clamp(member.energy - 12, 0, 100);
    addXp(state, member, 20 + (state.village?.dojo || 1) * 10);
  } else if (errand.kind === 'exam') {
    // The arena reads out the results itself (exams.js); nothing to settle here.
  } else if (errand.kind === 'classTrial' && JOBS[errand.classId]) {
    member.class = errand.classId;
    addLog(state, `${member.name}ผ่านพิธีที่โรงฝึก เป็น${JOBS[member.class].name}แล้ว`, 'level');
  }
}
function tickErrands(state) {
  for (const member of state.members) if (member.errand && state.elapsed >= member.errand.end) finishErrand(state, member);
}
function tickVillage(state, step) {
  tickTown(state, step, getVillageInfo(state).level, (text, type) => addLog(state, text, type));
  if (Math.floor(state.elapsed) !== Math.floor(state.elapsed - step)) tickCity(state, Math.max(1, step));
  const level = getVillageInfo(state).level;
  if (level > (state.village.grown || 1)) { state.village.grown = level; state.village.celebrateAt = state.elapsed; addLog(state, `🎉 ${getVillageInfo(state).name}! เมืองเติบโตขึ้น ชาวเมืองจัดงานฉลองกันทั้งคืน`, 'rank'); }
  state.idleBank = (state.idleBank || 0) + idleRate(state) * step;
  settleIdle(state);
  const trainingSlots = roomLevel(state, 'training') * 2;
  let trainers = state.members.filter(m => m.task === 'train' && !isBusy(state, m.id)).length;
  for (const member of [...state.members]) {
    if (isBusy(state, member.id)) continue;
    // Gloomy for too long, they pack up and look for a better town (regulars give the guild more time).
    member.unhappy = member.morale < 25 ? (member.unhappy || 0) + step : Math.max(0, (member.unhappy || 0) - step * 2);
    if (member.unhappy > (member.regular ? 480 : 240) && state.members.length > 4 && !state.festivals?.live) { leaveTown(state, member); continue; }
    // A member who is ready, rested and can pay their own fee goes to the arena by themselves.
    if (member.energy >= 50 && member.injury <= 20 && !member.waitingReason) {
      const rank = getAdventurerRank(state, member);
      if (rank.eligible && rank.chance >= 0.35 && (member.purse || 0) >= rank.rule.fee && startExam(state, member).ok) continue;
    }
    // A rested adventurer with time on their hands now and then drops in at the guild to use a free training dummy.
    if (member.task === 'rest' && member.energy >= 78 && !member.injury && trainers < trainingSlots && worldRandom(state) < 0.02 * step) { member.task = 'train'; member.autoTrain = true; member.trainingProgress = 0; trainers += 1; continue; }
    member.shopClock = (member.shopClock ?? (hashId(member.id) % 8)) - step;
    if (member.shopClock > 0) continue;
    member.shopClock = 8;
    memberShopping(state, member);
  }
}
const hashId = id => [...String(id)].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);
/** Money spent in the village shops makes the village more prosperous. */
function spendInVillage(state, member, gold) { member.purse -= gold; state.village.prosperity += gold * 0.05; state.village.trade = (state.village.trade || 0) + gold; }
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
  // Then they look after their own growth: an exam when ready, otherwise a lesson at the dojo.
  if (member.energy >= 60 && member.injury <= 20 && member.autoWork !== false) {
    const info = getAdventurerRank(state, member);
    if (info.eligible && info.chance >= 0.5 && member.purse >= info.rule.fee) { startExam(state, member); return; }
    if (v.dojo && (state.daily.lessons?.[member.id] || 0) < v.dojo && member.purse >= lessonFee(state) + 30 && member.level < 20) { startLesson(state, member); return; }
  }
  // Treats only from savings beyond what the next upgrade needs.
  if (v.shop && member.purse > 90) { const treat = Math.min(member.purse - 90, 6 + v.shop * 3); spendInVillage(state, member, treat); member.morale = clamp(member.morale + treat * 0.5, 0, 100); }
}
/** Each morning the shops restock from the village market, and the village uses up some of its stock. */
function restockShops(state) {
  const v = state.village, shops = state.shops, m = state.market;
  const take = (cost, times = 1) => { for (const [k, n] of Object.entries(cost)) if ((m[k] || 0) < n * times) return false; for (const [k, n] of Object.entries(cost)) m[k] -= n * times; return true; };
  if (v.shop) for (const [id, c] of Object.entries(CONSUMABLES)) { const want = (id === 'ration' ? 4 : 3) * v.shop; while ((shops[id] || 0) < want && take({ herb: c.herb })) shops[id] = (shops[id] || 0) + 1; }
  if (v.smithy) for (const item of EQUIPMENT.filter(e => !e.loot && !e.parts && e.workshopLevel <= v.smithy && hasRank(state, e.unlockRank))) {
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
/** Move a village building, or turn it to face the other way; its footpath grows again from the new door. */
function moveVillageBuilding(state, payload) {
  const key = String(payload.key || ''), spot = payload.spot || {}, house = /^h\d{1,2}$/.test(key);
  const kind = house ? 'house' : key, built = house ? +key.slice(1) < (state.village.houses || 0) : state.village[key] > 0;
  if (!built || (!house && !VILLAGE_BUSINESSES.includes(key))) return failure('ไม่พบอาคารนี้');
  const rot = spot.rot === 1 ? 1 : 0;
  if (rot && !ROTATABLE(key)) return failure('อาคารนี้หมุนไม่ได้');
  if (!finiteNumber(spot.x) || !finiteNumber(spot.y) || Math.abs(spot.x) > 90 || Math.abs(spot.y) > 90) return failure('ตำแหน่งที่ตั้งไม่ถูกต้อง');
  const x = Math.round(spot.x * 4) / 4, y = Math.round(spot.y * 4) / 4;
  if (!spotFree(state, key, kind, x, y, rot)) return failure('ทับอาคารอื่นหรือที่ดินกิลด์');
  state.village.lots = { ...(state.village.lots || {}), [key]: { x, y, ...(rot ? { rot: 1 } : {}) } };
  if (state.village.paths) delete state.village.paths[key];
  return success('ย้ายอาคารแล้ว ทางเดินจะค่อย ๆ เกิดใหม่จากประตู');
}
function buildProject(state, payload) {
  const id = payload.projectId, p = VILLAGE_PROJECTS[id], status = getProjectStatus(state, id);
  if (!status.ok) return failure(status.reason);
  // The player picks where a new building stands; upgrades stay where they are.
  const key = id === 'house' ? 'h' + state.village.houses : id, spot = payload.spot;
  if (spot && (!finiteNumber(spot.x) || !finiteNumber(spot.y) || Math.abs(spot.x) > 90 || Math.abs(spot.y) > 90)) return failure('ตำแหน่งที่ตั้งไม่ถูกต้อง');
  transact(state, status.cost, `หมู่บ้าน: ${p.name}`);
  if (spot && !state.village.lots?.[key]) state.village.lots = { ...(state.village.lots || {}), [key]: { x: Math.round(spot.x * 4) / 4, y: Math.round(spot.y * 4) / 4, ...(spot.rot === 1 && ROTATABLE(key) ? { rot: 1 } : {}) } };
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
  if (!quote.available) {
    // The village market is empty: a merchant can bring a lot from the capital, at twice the price.
    if (!payload.import) return failure(`ตลาดมี${MATERIALS[key].name}ไม่พอ · สั่งจากเมืองหลวงได้ในราคาสองเท่า`);
    const gold = Math.round(MATERIALS[key].price * quote.amount * 2);
    if (state.gold < gold) return failure('เหรียญไม่เพียงพอ');
    transact(state, { gold }, `สั่ง${MATERIALS[key].name}จากเมืองหลวง`);
    transact(state, { [key]: quote.amount }, `สั่ง${MATERIALS[key].name}จากเมืองหลวง`, 1);
    return success(`สั่ง${MATERIALS[key].name}จากเมืองหลวง +${quote.amount} (${gold} G)`);
  }
  if (state.gold < quote.gold) return failure('เหรียญไม่เพียงพอ');
  transact(state, { gold: quote.gold }, `ซื้อ${MATERIALS[key].name}จากตลาด`);
  transact(state, { [key]: quote.amount }, `ซื้อ${MATERIALS[key].name}จากตลาด`, 1);
  state.market[key] -= quote.amount;
  state.village.prosperity += quote.gold * 0.1;
  return success(`ซื้อ${MATERIALS[key].name} +${quote.amount}`);
}
/** Income earned while the game was closed: the coffer and market keep paying for up to two hours. */
function collectIdle(state, payload) {
  const away = Math.max(0, Number(payload.seconds) || 0), seconds = clamp(away, 0, 7200), gold = Math.floor(idleRate(state) * seconds);
  // Ten minutes or more away: the villagers leave a small chest at the door.
  const chest = away >= 600 && !introActive(state) ? addChest(state.progress, away >= 4 * 3600 ? 'silver' : 'wood', 'ของฝากจากชาวบ้านระหว่างที่คุณไม่อยู่') : null;
  if (gold < 1 && !chest) return failure('ยังไม่มีดอกผลสะสม');
  if (gold >= 1) transact(state, { gold }, 'ดอกผลระหว่างปิดเกม', 1);
  return { ok: true, message: [gold >= 1 ? `ระหว่างที่ไม่อยู่ กองทุนและตลาดได้ ${gold} G` : '', chest ? `ชาวบ้านฝาก${CHESTS[chest.tier].name}ไว้ที่ประตู` : ''].filter(Boolean).join(' · '), gold, chest: chest?.tier || null, seconds: Math.round(away) };
}

// ---- One more turn: the monster book, treasure sets, chests, daily goals and guild policies. ----
/** A monster fell anywhere in the world: the first of its kind pays a little, a full page pays a chest. */
export function noteKill(state, species) {
  const news = recordKill(state.progress, species);
  if (!news) return;
  const gold = 20 + rankIndex(state.rank) * 10;
  transact(state, { gold }, 'โบนัสสมุดภาพมอน', 1); state.rep += 1;
  addLog(state, `📖 บันทึกใหม่ในสมุดภาพมอน: ${news.name} · โบนัส ${gold} G`, 'codex');
  for (const page of news.pages) { addChest(state.progress, 'silver', `สมุดภาพครบหน้า ${page.name}`); addLog(state, `📖 สมุดภาพครบหน้า “${page.name}”! ได้หีบเงิน`, 'reward'); }
}
/** A treasure reached the guild: finish any set it completes. */
export function noteTreasure(state, id) {
  for (const set of recordTreasure(state.progress, id)) {
    transact(state, { gold: set.reward.gold }, `ครบชุดสมบัติ ${set.name}`, 1); state.rep += set.reward.rep;
    addChest(state.progress, 'gold', `ครบชุดสมบัติ ${set.name}`);
    addLog(state, `${set.icon} ครบชุดสมบัติ “${set.name}”! +${set.reward.gold} G ชื่อเสียง +${set.reward.rep} และหีบทอง`, 'reward');
  }
}
/** Counters the daily goals measure. */
export function progressCounters(state) {
  const r = state.record || {};
  return { jobs: r.jobs || 0, kills: state.world?.kills || 0, bought: state.trade?.stats?.bought || 0, hall: r.hall || 0, income: r.income || 0, joined: r.joined || 0, passed: r.passed || 0 };
}
function startDailyGoals(state) {
  if (introActive(state)) return;
  newDailyGoals(state.progress, state.day, progressCounters(state), rankIndex(state.rank), () => worldRandom(state));
}
function checkDailyGoals(state) {
  const p = state.progress; if (!p || introActive(state)) return;
  if (!p.daily || p.daily.day !== state.day) { startDailyGoals(state); return; }
  const view = dailyView(p, progressCounters(state));
  view.forEach((g, i) => {
    if (g.done || g.have < g.need) return;
    p.daily.list[i].done = true;
    addChest(p, 'wood', `เป้าหมายวันนี้: ${g.text}`);
    addLog(state, `✅ เป้าหมายวันนี้สำเร็จ: ${g.text} · ได้หีบไม้`, 'reward');
  });
  if (!p.daily.bonus && p.daily.list.length && p.daily.list.every(g => g.done)) {
    p.daily.bonus = true; addChest(p, 'silver', 'ทำเป้าหมายวันนี้ครบทั้ง 3 อย่าง');
    addLog(state, '🌟 ทำเป้าหมายวันนี้ครบทุกข้อ! ได้หีบเงินเป็นรางวัลพิเศษ', 'reward');
  }
}
/** The adventurers who would sign up for a tournament with this purse. */
export function getFestivalEntrants(state, gold) { return festivalEntrants(state, festivalContext(state), gold); }
export function getDailyGoals(state) { return state.progress?.daily?.day === state.day ? dailyView(state.progress, progressCounters(state)) : []; }
/** Open a chest: roll the rarity, pay out, and send any treasure to the guild's strongroom. */
function openChest(state, payload) {
  const p = state.progress, chest = p.chests.find(c => c.id === Number(payload.chestId)) || (payload.chestId == null ? p.chests[0] : null);
  if (!chest) return failure('ไม่มีหีบให้เปิด');
  const roll = rollChest(chest, () => worldRandom(state), rankIndex(state.rank));
  p.chests = p.chests.filter(c => c !== chest); p.opened += 1;
  const { rep = 0, ...goods } = roll.reward;
  transact(state, goods, `เปิด${CHESTS[chest.tier].name}`, 1); state.rep += rep;
  let treasure = null;
  if (roll.treasure) {
    if ((state.trade.treasures || []).length < 12) { state.trade.treasures.push({ id: roll.treasure, from: CHESTS[chest.tier].name }); treasure = roll.treasure; noteTreasure(state, roll.treasure); }
    else { const value = TREASURES[roll.treasure].value; transact(state, { gold: value }, 'ห้องเก็บสมบัติเต็ม ขายสมบัติจากหีบ', 1); roll.reward.gold += value; }
  }
  const rarity = CHEST_RARITIES[roll.rarity];
  return { ok: true, message: `${CHESTS[chest.tier].icon} ${CHESTS[chest.tier].name} · ${rarity.name}: +${roll.reward.gold} G${treasure ? ` และ${TREASURES[treasure].name}` : ''}`, chest: { ...chest, rarity: roll.rarity, reward: roll.reward, treasure } };
}
/** What is close: up to three small targets for the corner of the screen. */
export function nearGoals(state) {
  const out = [];
  const daily = getDailyGoals(state).filter(g => !g.done).sort((a, b) => b.have / b.need - a.have / a.need)[0];
  if (daily) out.push({ icon: daily.icon, text: `วันนี้: ${daily.text}`, have: daily.have, need: daily.need, action: 'tab:goals' });
  // The cheapest upgrade still out of reach, or one that is ready now.
  const ups = state.facilities.filter(f => FACILITIES[f.type] && (f.level || 1) < (FACILITIES[f.type].maxLevel || 3)).map(f => ({ f, c: getUpgradeCost(state, f.id) }))
    .map(x => ({ ...x, short: Math.max(0, (x.c.gold || 0) - state.gold), mats: ['wood', 'stone', 'herb'].every(k => (state[k] || 0) >= (x.c[k] || 0)) })).filter(x => x.mats).sort((a, b) => a.short - b.short || (a.c.gold || 0) - (b.c.gold || 0));
  const up = ups[0];
  if (up) out.push({ icon: '⬆', text: up.short ? `อีก ${up.short} G → ${FACILITIES[up.f.type].name}ระดับ ${(up.f.level || 1) + 1}` : `พร้อมแล้ว: ${FACILITIES[up.f.type].name}ระดับ ${(up.f.level || 1) + 1}`, have: Math.min(state.gold, up.c.gold || 0), need: up.c.gold || 1, action: `upgrade:${up.f.id}`, ready: !up.short });
  // The monster-book page closest to full.
  const p = state.progress, pages = p ? CODEX_FAMILIES.map(f => ({ f, have: f.species.filter(s => p.kills[s]).length })).filter(x => !p.families[x.f.id] && x.have > 0).sort((a, b) => (b.have / b.f.species.length) - (a.have / a.f.species.length)) : [];
  if (pages[0]) out.push({ icon: '📖', text: `สมุดภาพ: อีก ${pages[0].f.species.length - pages[0].have} ชนิด ครบหน้า${pages[0].f.name}`, have: pages[0].have, need: pages[0].f.species.length, action: 'tab:codex' });
  return out.slice(0, 3);
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
    refundBonus(state, petition);
    state.petitions = state.petitions.filter(p => p !== petition);
    return success('ปฏิเสธคำร้องอย่างสุภาพแล้ว');
  }
  if (petition.status !== 'posted' || petition.missionId) return failure('แก้ได้เฉพาะคำร้องบนกระดานที่ยังไม่มีคนรับ');
  if (type === 'boostPetition') {
    // The guild puts up extra money of its own: braver takers, sooner.
    const step = bonusStep(petition);
    if ((petition.bonus || 0) >= step * 4) return failure('เพิ่มค่าหัวได้สูงสุด 4 ครั้งต่อใบ');
    if (state.gold < step) return failure(`ต้องมี ${step} G`);
    transact(state, { gold: step }, `ค่าหัวเพิ่ม: ${QUEST_BY_ID[petition.questId].name}`);
    petition.bonus = (petition.bonus || 0) + step;
    return success(`เพิ่มค่าหัว +${step} G (รวม ${petition.bonus} G) นักผจญภัยกล้ารับงานนี้มากขึ้น`);
  }
  // setPetition: change how the fee is split.
  if (payload.plan !== undefined) { if (!PAYOUT_PLANS[payload.plan]) return failure('แผนค่าตอบแทนไม่ถูกต้อง'); petition.plan = payload.plan; }
  return success(`ค่าตอบแทน: ${PAYOUT_PLANS[petition.plan].name}`);
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
    const idleMembers = state.members.filter(member => !isBusy(state, member.id)), comfort = townComfort(state).value;
    const trainingAssignments = new Set(idleMembers.filter(member => member.task === 'train' && member.energy > 12 && member.injury <= 40)
      .sort((a, b) => a.trainingProgress - b.trainingProgress || a.level - b.level)
      .slice(0, stats.trainingSlots).map(member => member.id));
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
        if (member.energy <= (member.autoTrain ? 45 : 12)) { member.task = 'rest'; if (!member.autoTrain) addLog(state, `${member.name} เหนื่อยจากการฝึกและกลับไปพัก`, 'info'); member.autoTrain = false; }
      } else if (member.task === 'train') {
        if (member.autoTrain) { member.task = 'rest'; member.autoTrain = false; }
        else member.waitingReason = 'รอผลัดเข้าหุ่นฝึก';
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
        // Everyone has a room in town now: rest is never short of beds.
        member.energy = clamp(member.energy + (stats.recoveryRate + (traitOf(member).recovery || 0)) * step, 0, 100);
        member.morale = clamp(member.morale + ((comfort - member.morale) * 0.006 + (traitOf(member).morale || 0)) * step, 0, 100);
      }
      if (healingAssignments.has(member.id)) member.injury = clamp(member.injury - (0.08 + bestRoomLevel(state, 'infirmary') * 0.06) * step * (hasPolicy(state, 'medic') ? 1.4 : 1), 0, 100);
      else if (member.task === 'rest') member.injury = clamp(member.injury - (0.015 + (state.village?.clinic || 0) * 0.04) * step * (hasPolicy(state, 'medic') ? 1.4 : 1), 0, 100);
    }
    for (const mission of [...state.missions]) {
      if (mission.status !== 'active') continue;
      if (mission.prep > 0) { mission.prep = Math.max(0, mission.prep - step); if (mission.prep > 0 || mission.rt) continue; }
      // Quests play out in the living world: the party walks out, fights there and walks home.
      if (mission.realtime) { if (!mission.rt) startExpedition(state, lifeContext(state), mission, QUEST_BY_ID[mission.questId]); continue; }
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
    if (state.today && Math.floor(state.elapsed / 10) !== Math.floor((state.elapsed - step) / 10) && state.members.length) { state.today.effSum += avgEff(state); state.today.effN += 1; }
    tickPetitions(state, step);
    tickApplicants(state, step);
    tickExams(state, examContext(state));
    if (state.festivals?.live) tickFestivals(state, festivalContext(state));
    tickErrands(state);
    tickVillage(state, step);
    tickLife(state, lifeContext(state), step);
    tickDirector(state, directorContext(state));
    tickTrade(state, tradeContext(state), step);
    checkDailyGoals(state);
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
  // Frontier gear also takes monster parts from the guild's store.
  const store = state.trade?.store || {};
  const short = Object.entries(item.parts || {}).find(([id, n]) => (store[id] || 0) < n);
  if (short) return failure(`ต้องมี${PARTS[short[0]].name} ${short[1]} ชิ้นในโกดัง (มี ${store[short[0]] || 0})`);
  if ((state.inventory[item.id] || 0) >= 24) return failure('มีอุปกรณ์ชนิดนี้มากเพียงพอแล้ว');
  transact(state, cost, `สร้าง${item.name}`);
  for (const [id, n] of Object.entries(item.parts || {})) { store[id] -= n; if (!store[id]) delete store[id]; }
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

/** Which next classes a member could take, and what each still needs. */
export function classChoices(state, member) {
  const job = JOBS[member.class];
  return (job?.next || []).map(id => {
    const next = JOBS[id], rule = CLASS_TIERS[classTier(id)];
    let reason = '';
    if (next.future) reason = `เปิดในบทต่อไป (แรงค์ ${rule.rank})`;
    else if (memberRankIndex(member) < ADVENTURER_RANKS.indexOf(rule.rank)) reason = `ต้องแรงค์ ${rule.rank}`;
    else if (member.level < rule.level) reason = `ต้องเลเวล ${rule.level}`;
    else if ((state.village?.dojo || 0) < rule.dojo) reason = rule.dojo > 1 ? `ต้องมีโรงฝึกระดับ ${rule.dojo}` : 'ต้องสร้างโรงฝึกในหมู่บ้าน';
    return { id, name: next.name, tier: classTier(id), fee: rule.fee, ok: !reason, reason };
  });
}
function specialize(state, payload) {
  const member = memberById(state, payload.memberId);
  if (!member || !JOBS[payload.classId]) return failure('ไม่พบสมาชิกหรือคลาส');
  if (isBusy(state, member.id)) return failure('รอสมาชิกกลับมาที่กิลด์ก่อน');
  const choice = classChoices(state, member).find(c => c.id === payload.classId);
  if (!choice) return failure('คลาสนี้ไม่ได้ต่อจากสายเดิม');
  if (!choice.ok) return failure(choice.reason);
  if (!payFee(state, member, choice.fee, `พิธีเปลี่ยนคลาส${member.name}`)) return failure(`ค่าพิธี ${choice.fee} G ไม่พอ`);
  startErrand(state, member, 'classTrial', 40, { classId: choice.id });
  addLog(state, `${member.name}ไปทำพิธีเปลี่ยนคลาสที่โรงฝึก`, 'level');
  return success(`${member.name} ไปที่โรงฝึกแล้ว`);
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
    case 'acceptPetition': case 'declinePetition': case 'setPetition': case 'boostPetition': return petitionCommand(state, type, payload);
    case 'rally': return rally(state);
    case 'hireStaff': return hireStaff(state, payload.role);
    case 'fireStaff': return fireStaff(state, payload.role);
    case 'setPayoutPlan': if (!PAYOUT_PLANS[payload.plan]) return failure('แผนค่าตอบแทนไม่ถูกต้อง'); state.payoutPlan = payload.plan; return success(`ตั้งค่าตอบแทนเริ่มต้นเป็น${PAYOUT_PLANS[payload.plan].name}`);
    case 'setAutoWork': { const member = memberById(state, payload.memberId); if (!member) return failure('ไม่พบสมาชิก'); member.autoWork = Boolean(payload.autoWork); return success(member.autoWork ? `${member.name} หยิบงานจากกระดานเองได้` : `${member.name} รอให้คุณเลือกงานให้`); }
    case 'buyUpgrade': return buyUpgrade(state, payload);
    case 'buildProject': return buildProject(state, payload);
    case 'buyMaterial': return buyMaterial(state, payload);
    case 'sellMaterial': return sellMaterial(state, payload);
    case 'collectIdle': return collectIdle(state, payload);
    case 'openChest': return openChest(state, payload);
    case 'choosePolicy': { const r = choosePolicy(state.progress, payload.policyId); if (r.ok) addLog(state, r.message, 'policy'); return r.ok ? success(r.message) : failure(r.message); }
    case 'chooseEvent': return chooseEvent(state, payload);
    case 'recallMission': {
      const mission = state.missions.find(item => item.id === payload.missionId && item.status === 'active');
      if (!mission) return failure('ไม่พบทีมที่กำลังเดินทาง');
      if (mission.rt) recallExpedition(state, lifeContext(state), mission);
      mission.status = 'recalled'; mission.finishedAt = state.elapsed;
      mission.result = { success: false, reward: {}, title: 'กลับก่อนอย่างปลอดภัย', message: 'เรียกทีมกลับแล้ว เสบียงที่ใช้ไปไม่คืน' };
      mission.memberIds.forEach(id => { const member = memberById(state, id); member.task = 'rest'; member.energy = Math.max(0, member.energy - Math.round(mission.energyCost * clamp(mission.progress / mission.duration, 0, 1))); });
      reopenPetition(state, mission);
      addLog(state, `เรียกทีม${QUEST_BY_ID[mission.questId].name}กลับกิลด์`, 'mission');
      trimMissions(state);
      return success('เรียกทีมกลับแล้ว');
    }
    case 'recruit': case 'declineApplicant': case 'inviteFree': return failure('นักผจญภัยมาลงทะเบียนกับกิลด์เองแล้ว ไม่ต้องจ้าง');
    case 'setBuyRate': if (!BUY_RATES[payload.rate]) return failure('ราคารับซื้อไม่ถูกต้อง'); state.trade.buyRate = payload.rate; return success(`ตั้งราคารับซื้อเป็น${BUY_RATES[payload.rate].name}`);
    case 'setAutoWholesale': state.trade.autoWholesale = Boolean(payload.on); return success(state.trade.autoWholesale ? 'โกดังใกล้เต็มจะขายส่งเอง' : 'เก็บของไว้ทั้งหมด ไม่ขายเอง');
    case 'toggleWorkshop': if (!VILLAGE_PROJECTS[payload.workshop] || !['tannery', 'apothecary', 'jeweler'].includes(payload.workshop)) return failure('ไม่พบโรงงานนี้'); state.trade.halt[payload.workshop] = !state.trade.halt[payload.workshop]; if (!state.trade.halt[payload.workshop]) delete state.trade.halt[payload.workshop]; return success(state.trade.halt[payload.workshop] ? `${VILLAGE_PROJECTS[payload.workshop].name}หยุดรับวัตถุดิบ` : `${VILLAGE_PROJECTS[payload.workshop].name}กลับมาทำงาน`);
    case 'heroMode': { if (introActive(state)) return failure('รอให้บทนำจบก่อน'); const hero = setHeroActive(state, lifeContext(state), Boolean(payload.on)); return success(hero.active ? 'หัวหน้ากิลด์ออกไปข้างนอกเอง' : 'หัวหน้ากิลด์กลับมาประจำโต๊ะ'); }
    case 'moveVillageBuilding': return moveVillageBuilding(state, payload);
    case 'wholesale': return wholesale(state, tradeContext(state), payload);
    case 'sendCaravan': return sendCaravan(state, tradeContext(state), payload);
    case 'sellTreasure': return treasureAction(state, tradeContext(state), payload, false);
    case 'displayTreasure': return treasureAction(state, tradeContext(state), payload, true);
    case 'auctionTreasure': return treasureAction(state, tradeContext(state), payload, 'auction');
    case 'resolveEvent': return resolveDecision(state, directorContext(state), payload.choiceId);
    case 'setPolicy': {
      state.policy = { ...(state.policy || {}) };
      if (payload.autoPetitions !== undefined) { state.policy.autoPetitions = Boolean(payload.autoPetitions); return success(state.policy.autoPetitions ? 'คำร้องทั่วไปจะขึ้นกระดานเองตามค่าตอบแทนปกติ' : 'คุณจะรับคำร้องทุกใบด้วยตัวเอง'); }
      if (payload.memberHunting !== undefined) state.policy.memberHunting = Boolean(payload.memberHunting);
      return success(state.policy.memberHunting ? 'สมาชิกออกล่ามอนเองได้' : 'สมาชิกอยู่ประจำกิลด์ รอรับงาน');
    }
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
    case 'rankExam': { const member = memberById(state, payload.memberId); return member ? startExam(state, member) : failure('ไม่พบสมาชิก'); }
    case 'upgradeCamp': return upgradeCamp(state);
    case 'claimGoal': return claimGoalReward(state, payload.goalId);
    case 'startFestival': { const r = startFestival(state, festivalContext(state), payload); return r.ok ? success(r.message) : failure(r.message); }
    case 'withdrawExam': { const member = memberById(state, payload.memberId); if (!member) return failure('ไม่พบสมาชิก'); const r = withdrawExam(state, member); return r.ok ? success(r.message) : failure(r.message); }
    case 'takeLesson': { const member = memberById(state, payload.memberId); return member ? startLesson(state, member) : failure('ไม่พบสมาชิก'); }
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
  if (![1,2,3,4,5,SAVE_VERSION].includes(data.version)) throw new Error('เวอร์ชันเซฟนี้ยังไม่รองรับ');
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
    // The opening used to ask for beds before the board (save v5).
    if (intro && intro.step === 'dorm') intro.step = 'board';
    if (intro && intro.after === 'dorm') intro.after = 'board';
    if (!intro || typeof intro !== 'object' || !INTRO_STEPS.includes(intro.step) || !finiteNumber(intro.timer) || intro.timer < 0
      || !Array.isArray(intro.visitors) || !Array.isArray(intro.next) || [...intro.visitors, ...intro.next].some(id => !starters.has(id))
      || (intro.after !== null && intro.after !== undefined && !INTRO_STEPS.includes(intro.after))) throw new Error('ข้อมูลช่วงเริ่มเกมไม่ถูกต้อง');
    state.intro = { step: intro.step, timer: intro.timer, visitors: [...intro.visitors], next: [...intro.next], after: intro.after ?? null, delay: finiteNumber(intro.delay) ? intro.delay : 6 };
  }
  if (data.profile !== undefined) { if (!data.profile || typeof data.profile !== 'object') throw new Error('ข้อมูลหัวหน้ากิลด์ไม่ถูกต้อง'); state.profile = normalizeProfile(data.profile); }
  if (!Array.isArray(state.members) || state.members.length < (opening ? 0 : 3) || state.members.length > MAX_MEMBERS) throw new Error('รายชื่อสมาชิกไม่ถูกต้อง');
  const ids = new Set();
  state.members = state.members.map(member => {
    if (!member || !(MEMBER_BY_ID[member.id] || validRookie(member)) || ids.has(member.id) || !JOBS[member.class]) throw new Error('พบสมาชิกซ้ำหรืออาชีพไม่ถูกต้อง');
    ids.add(member.id);
    const content = contentOf(member);
    const baseClass = rootClass(member.class);
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
    if (!ADVENTURER_RANKS.includes(normalized.rank)) normalized.rank = normalized.level >= 6 ? 'D' : normalized.level >= 3 ? 'E' : 'F';
    if (!Number.isInteger(normalized.points) || normalized.points < 0 || normalized.points > 10000000) normalized.points = (normalized.missionsDone || 0) * 10;
    if (!finiteNumber(normalized.examReadyAt) || normalized.examReadyAt < 0) normalized.examReadyAt = 0;
    // Before registration (save v6) everyone in the guild had been hired by hand: they are the first regulars.
    normalized.regular = !content.rookie || data.version < 6 || Boolean(member.regular);
    normalized.autoTrain = Boolean(member.autoTrain);
    normalized.celebrate = Boolean(member.celebrate);
    if (finiteNumber(member.atBar)) normalized.atBar = member.atBar; else delete normalized.atBar;
    if (['bar', 'dining'].includes(member.seatKind)) normalized.seatKind = member.seatKind; else delete normalized.seatKind;
    normalized.unhappy = finiteNumber(member.unhappy) ? clamp(member.unhappy, 0, 10000) : 0;
    const t = member.town;
    normalized.town = t && ['street', 'guild', 'lodge'].includes(t.at) && ['x', 'y', 'tx', 'ty', 'wait'].every(k => finiteNumber(t[k]) && Math.abs(t[k]) < 1000) ? { x: t.x, y: t.y, tx: t.tx, ty: t.ty, wait: t.wait, at: t.at, ...(['guild', 'lodge', 'town'].includes(t.goal) ? { goal: t.goal } : {}) } : null;
    const e = member.errand;
    normalized.errand = e && ['lesson', 'exam', 'classTrial', 'festival'].includes(e.kind) && finiteNumber(e.start) && finiteNumber(e.end) && e.end - e.start <= 120
      && (e.kind !== 'exam' || ADVENTURER_RANK_RULES[e.rank]) && (e.kind !== 'classTrial' || JOBS[e.classId]?.parent === normalized.class) ? { ...e } : null;
    return normalized;
  });
  // Beds left the guild in R42: adventurers sleep in town. Old saves simply lose them.
  if (Array.isArray(state.facilities)) state.facilities = state.facilities.filter(f => f?.type !== 'dorm');
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
  if (!opening && !state.facilities.some(room => room.type === 'reception')) throw new Error('ไม่มีโต๊ะรับคำร้อง');
  if (!Array.isArray(state.missions) || state.missions.length > 40) throw new Error('รายการภารกิจไม่ถูกต้อง');
  const missionIds = new Set(), assigned = new Set();
  for (const mission of state.missions) {
    if (!mission || !QUEST_BY_ID[mission.questId] || typeof mission.id !== 'string' || missionIds.has(mission.id) || !['active', 'completed', 'failed', 'recalled'].includes(mission.status)) throw new Error('ข้อมูลภารกิจไม่ถูกต้อง');
    missionIds.add(mission.id);
    if (!Array.isArray(mission.memberIds) || mission.memberIds.length < 1 || mission.memberIds.length > partyLimit(QUEST_BY_ID[mission.questId]) || new Set(mission.memberIds).size !== mission.memberIds.length || mission.memberIds.some(id => !ids.has(id))) throw new Error('สมาชิกภารกิจไม่ถูกต้อง');
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
      important: Boolean(p.important), reserved: false, fee: Math.round(p.fee), plan: p.plan, bonus: Number.isInteger(p.bonus) && p.bonus >= 0 && p.bonus < 1000000 ? p.bonus : 0,
      status: p.status === 'taken' && !mission ? 'posted' : p.status, eta: finiteNumber(p.eta) ? clamp(p.eta, 0, 600) : 0, etaTotal: finiteNumber(p.etaTotal) ? clamp(p.etaTotal, 1, 600) : 20,
      patience: finiteNumber(p.patience) ? clamp(p.patience, 0, 1000) : 80, age: finiteNumber(p.age) ? clamp(p.age, 0, 100000) : 0, ...(finiteNumber(p.waited) ? { waited: clamp(p.waited, 0, 1000) } : {}), missionId: mission ? mission.id : null };
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
  for (const id of VILLAGE_BUSINESSES) { village[id] ??= 0; validateNumber(village, id, 0, VILLAGE_PROJECTS[id].max, true); }
  village.inn = Number.isInteger(village.inn) ? clamp(village.inn, 0, VILLAGE_PROJECTS.inn.max) : 0;
  const unit = (x, lo, hi, d) => finiteNumber(x) ? clamp(x, lo, hi) : d;
  state.village = { prosperity: village.prosperity, houses: village.houses, inn: village.inn, occupancy: unit(village.occupancy, 0.6, 1, 1), ...(finiteNumber(village.satisfaction) ? { satisfaction: clamp(village.satisfaction, 0, 100) } : {}), raidScar: unit(village.raidScar, 0, 100, 0), grown: Number.isInteger(village.grown) ? clamp(village.grown, 1, 5) : 1, ...(finiteNumber(village.celebrateAt) ? { celebrateAt: village.celebrateAt } : {}), ...Object.fromEntries(VILLAGE_BUSINESSES.map(id => [id, village[id]])), trade: finiteNumber(village.trade) && village.trade >= 0 ? village.trade : 0 };
  const lots = Object.fromEntries(Object.entries(village.lots && typeof village.lots === 'object' ? village.lots : {}).filter(([key, lot]) => (/^h\d{1,2}$/.test(key) || VILLAGE_BUSINESSES.includes(key)) && lot && finiteNumber(lot.x) && finiteNumber(lot.y) && Math.abs(lot.x) <= 90 && Math.abs(lot.y) <= 90).map(([key, lot]) => [key, { x: lot.x, y: lot.y, ...(lot.rot === 1 && ROTATABLE(key) ? { rot: 1 } : {}) }]));
  if (Object.keys(lots).length) state.village.lots = lots;
  state.village.paths = sanitizePaths(village.paths);
  // Older saves had no homes of their own: give each house the look it had from the village level.
  const oldTier = (() => { let lv = 1; for (const l of VILLAGE_LEVELS) if (village.prosperity >= l.prosperity) lv = l.level; return lv >= 5 ? 2 : lv >= 3 ? 1 : 0; })();
  state.village.homes = village.homes ? sanitizeHomes(village.homes, state.village.houses) : Object.fromEntries([...Array(state.village.houses).keys()].map(i => ['h' + i, { tier: oldTier, progress: 0 }]));
  state.idleBank = finiteNumber(data.idleBank) ? clamp(data.idleBank, 0, 1000000) : 0;
  const appIds = new Set();
  // Applicants no longer wait at the door to be hired: anyone on the way (or left waiting in an old save) registers on arrival.
  state.applicants = (Array.isArray(data.applicants) ? data.applicants : []).filter(a => a && typeof a.id === 'string' && !appIds.has(a.id) && appIds.add(a.id) && ['coming', 'waiting'].includes(a.status)
    && Number.isInteger(a.level) && a.level >= 1 && a.level <= MAX_LEVEL
    && (a.memberId ? MEMBER_BY_ID[a.memberId] && !MEMBER_BY_ID[a.memberId].starter && !ids.has(a.memberId) : validRookie({ id: a.rookieId, bio: { ...a.bio, rookie: true } }))).slice(0, 4)
    .map(a => ({ id: a.id, status: 'coming', eta: a.status === 'coming' && finiteNumber(a.eta) ? clamp(a.eta, 0, 600) : 0, etaTotal: finiteNumber(a.etaTotal) ? clamp(a.etaTotal, 1, 600) : 20,
      memberId: a.memberId || null, rookieId: a.memberId ? null : a.rookieId, bio: a.memberId ? null : { name: a.bio.name, class: a.bio.class, trait: a.bio.trait, hair: a.bio.hair, description: a.bio.description }, level: a.level, famous: Boolean(a.famous), ...(a.fond ? { fond: true } : {}) }));
  state.market = Object.fromEntries(Object.keys(MATERIALS).map(k => [k, Number.isInteger(data.market?.[k]) && data.market[k] >= 0 && data.market[k] < 1000000 ? data.market[k] : defaults.market[k]]));
  const stock = n => Number.isInteger(n) && n >= 0 && n < 1000 ? n : 0;
  state.shops = { ration: stock(data.shops?.ration), potion: stock(data.shops?.potion), gear: Object.fromEntries(Object.entries(data.shops?.gear || {}).filter(([id, n]) => EQUIPMENT_BY_ID[id] && !EQUIPMENT_BY_ID[id].loot && stock(n) > 0)) };
  state.world = sanitizeWorld(data.world, state, ids);
  state.policy = { memberHunting: data.policy?.memberHunting !== false, autoPetitions: data.policy?.autoPetitions !== false, registration: data.policy?.registration !== false };
  state.director = sanitizeDirector(data.director, state.elapsed);
  state.trade = sanitizeTrade(data.trade);
  state.exams = sanitizeExams(data.exams, new Set(state.members.map(m => m.id)));
  state.mastery = sanitizeMastery(data.mastery);
  const bty = data.bounty;
  state.bounty = bty && typeof bty.monsterId === 'string' && MONSTER_STATS_KEYS.has(bty.species) && HUNT_ZONES[bty.zone] && finiteNumber(bty.reward) && state.world.monsters.some(m => m.id === bty.monsterId) ? { monsterId: bty.monsterId, species: bty.species, zone: bty.zone, title: String(bty.title || ''), reward: bty.reward, rep: finiteNumber(bty.rep) ? bty.rep : 0, day: bty.day | 0 } : null;
  state.festivals = sanitizeFestivals(data.festivals, new Set(state.members.map(m => m.id)));
  state.hero = sanitizeHero(data.hero);
  // A quest party that lost its walkers sets out again from the door.
  for (const m of state.missions) if (m.status === 'active' && m.rt && !state.world.hunters.some(h => h.party === m.id)) delete m.rt;
  state.applicantClock = finiteNumber(data.applicantClock) ? clamp(data.applicantClock, 0, 1000) : 90;
  // Older saves count the quests they already cleared as their record of work.
  const jobs = data.record?.jobs ?? Object.values(state.completedQuests).reduce((sum, n) => sum + n, 0);
  const counter = v => Number.isFinite(v) && v >= 0 && v < 1e12 ? Math.round(v) : 0;
  state.record = { jobs: Number.isInteger(jobs) && jobs >= 0 && jobs < 10000000 ? jobs : 0, bounties: Number.isInteger(data.record?.bounties) && data.record.bounties >= 0 ? data.record.bounties : 0,
    income: counter(data.record?.income), hall: counter(data.record?.hall), joined: counter(data.record?.joined), passed: counter(data.record?.passed) };
  state.progress = sanitizeProgress(data.progress);
  if (!data.progress) for (const x of [...(data.trade?.treasures || []), ...(data.trade?.displayed || [])]) { const id = typeof x === 'string' ? x : x?.id; if (TREASURES[id]) state.progress.treasures[id] = true; }
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
  state.settings.paused = Boolean(state.settings.paused); state.settings.sound = Boolean(state.settings.sound); state.settings.music = state.settings.music !== false; state.settings.volume = finiteNumber(state.settings.volume) ? clamp(state.settings.volume, 0, 1) : 0.8;
  state.goals = { ...defaults.goals, ...data.goals };
  state.story = { ...defaults.story, ...data.story };
  state.frontier = { camp: Number.isInteger(data.frontier?.camp) && data.frontier.camp >= 0 && data.frontier.camp <= 3 ? data.frontier.camp : 0 };
  if (state.completedQuests.canyonroad && !state.frontier.camp) state.frontier.camp = 1;
  validateNumber(state.story, 'chapter', 1, 8, true);
  // Saves that finished the old demo at the forest heart carry on into the frontier chapter.
  state.story.finished = Boolean(state.story.finished) && Boolean(state.completedQuests.dragon);
  if (state.story.finished && !state.completedQuests.dragon) throw new Error('บทสรุปเกมไม่ตรงกับประวัติภารกิจ');
  state.daily = { ...defaults.daily, ...data.daily, missionCounts: { ...(data.daily?.missionCounts || {}) }, work: { ...(data.daily?.work || {}) }, lessons: Object.fromEntries(Object.entries(data.daily?.lessons || {}).filter(([id, n]) => ids.has(id) && Number.isInteger(n) && n >= 0 && n <= 3)) };
  for (const [id, value] of Object.entries(state.daily.missionCounts)) if (!QUEST_BY_ID[id] || !Number.isInteger(value) || value < 0 || value > 1000000) throw new Error('ประวัติภารกิจประจำวันไม่ถูกต้อง');
  for (const [id, value] of Object.entries(state.daily.work)) if (!ids.has(id) || !Number.isInteger(value) || value < 0 || value > 2) throw new Error('ประวัติงานประจำวันไม่ถูกต้อง');
  state.eventCooldowns = { ...(data.eventCooldowns || {}) };
  for (const [id, value] of Object.entries(state.eventCooldowns)) if (!GUILD_EVENTS.some(event => event.id === id) || !finiteNumber(value) || value < 0 || value > 1000000000) throw new Error('เวลากิจกรรมไม่ถูกต้อง');
  state.log = Array.isArray(data.log) ? data.log.filter(item => item && typeof item.text === 'string' && item.text.length < 1000).slice(0, MAX_LOG) : defaults.log;
  state.ledger = Array.isArray(data.ledger) ? data.ledger.filter(item => item && typeof item.text === 'string' && finiteNumber(item.gold)).slice(0, MAX_LEDGER) : [];
  state.nextId = Math.max(Number.isInteger(data.nextId) ? data.nextId : 10, ...[...roomIds,...partitionIds, ...missionIds, ...petitionIds, ...appIds, ...state.applicants.map(a => a.rookieId).filter(Boolean), ...state.members.map(m => m.id).filter(id => /^r-\d+$/.test(id))].map(id => (Number(id.split('-').pop()) || 0) + 1));
  const book = b => Object.fromEntries(Object.entries(b && typeof b === 'object' ? b : {}).filter(([k, v]) => typeof k === 'string' && k.length <= 40 && finiteNumber(v) && v >= 0 && v < 1e9).slice(0, 40));
  const int = v => Number.isInteger(v) && v >= 0 && v < 1e7 ? v : 0;
  const t = data.today;
  state.today = t && typeof t === 'object' ? { day: int(t.day) || state.day, income: book(t.income), expense: book(t.expense), joined: int(t.joined), left: int(t.left), jobs: int(t.jobs), failed: int(t.failed), effSum: finiteNumber(t.effSum) ? clamp(t.effSum, 0, 1e7) : 0, effN: int(t.effN) } : newDay(state.day);
  state.history = (Array.isArray(data.history) ? data.history : []).filter(h => h && typeof h === 'object' && finiteNumber(h.eff)).slice(-7).map(h => ({ day: int(h.day), income: book(h.income), expense: book(h.expense), incomeTotal: finiteNumber(h.incomeTotal) ? h.incomeTotal : 0, expenseTotal: finiteNumber(h.expenseTotal) ? h.expenseTotal : 0, eff: clamp(h.eff, 0, 2), joined: int(h.joined), left: int(h.left), jobs: int(h.jobs), failed: int(h.failed), members: int(h.members), losses: (Array.isArray(h.losses) ? h.losses : []).filter(l => l && CONDITIONS.some(d => d.id === l.id) && finiteNumber(l.gold)).map(l => ({ id: l.id, gold: l.gold })) }));
  state.staff = Object.fromEntries(Object.entries(data.staff && typeof data.staff === 'object' ? data.staff : {}).filter(([id, v]) => STAFF[id] && v && Number.isInteger(v.level) && v.level >= 1 && v.level <= STAFF_MAX_LEVEL).map(([id, v]) => [id, { level: v.level, days: Number.isInteger(v.days) && v.days >= 0 && v.days < 1000 ? v.days : 0 }]));
  migrateFree(state);
  // Saves from before lodging: the town's inn grows to fit everyone who already lives there.
  if (data.version < 6) while (state.village.inn < VILLAGE_PROJECTS.inn.max && getLodging(state).lodging < state.members.length) state.village.inn += 1;
  syncImportant(state);
  state.rng = state.rng >>> 0 || 123;
  state.members.forEach(member => { if (assigned.has(member.id)) member.task = 'mission'; else if (member.task === 'mission') member.task = 'rest'; });
  state.version = SAVE_VERSION;
  if (getGuildStats(state).activeMissions > getGuildStats(state).teamCap) throw new Error('จำนวนทีมภารกิจเกินความจุกิลด์');
  return state;
}

/** Free adventurers from before registration (save v5) sign the guild's book: there is only one kind of adventurer now. */
function migrateFree(state) {
  const w = state.world;
  for (const f of w.free || []) {
    if (state.members.length >= MAX_MEMBERS) break;
    const member = createMember({ id: `r-${state.nextId++}`, name: f.name, class: f.class, trait: f.trait, hair: f.hair, description: f.description, rookie: true }, f.level);
    Object.assign(member, { rank: ADVENTURER_RANKS.includes(f.rank) ? f.rank : freeLevelRank(f.level), purse: finiteNumber(f.purse) ? clamp(f.purse, 0, 1e6) : 0, xp: finiteNumber(f.xp) ? clamp(f.xp, 0, 1e6) : 0, energy: finiteNumber(f.energy) ? clamp(f.energy, 0, 100) : 80, regular: false });
    state.members.push(member);
  }
  const gone = new Set((w.free || []).map(f => f.id));
  w.free = [];
  w.hunters = w.hunters.filter(h => !(h.kind === 'free' && gone.has(h.id)));
  const hunterIds = new Set(w.hunters.map(h => h.id));
  w.porters = w.porters.filter(p => hunterIds.has(p.target));
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
