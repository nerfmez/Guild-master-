/* The living world: adventurers (guild members and free adventurers) walk out to hunting grounds,
   fight monsters in real time, carry fallen friends home, and sell their loot in the village.
   Pure simulation: game.js calls tickLife with a small context of its own helpers. */
import { siteQuestRoute, SITE_QUEST_SITES, FRONTIER_CAMP } from './site.js';
import { HUNT_ZONES, MONSTER_STATS, CLASS_COMBAT, HUNT_ECONOMY, ADVENTURER_RANKS, JOBS, ROOKIE_NAMES, TRAIT_NAMES, HAIR_COLORS, ROOKIE_LINES, MONSTER_PART, TREASURES, TRADE_RULES, JOB_COMBAT } from './content.js';

const SUB = 0.25;          // seconds per combat step
const WALK = 1.7;          // tiles per second
const CARRY = 1.15;
const PORTER = 2.1;
const AGGRO = 3.2, LEASH = 9;
const HIT = .6;            // share of power dealt per basic hit
const CROWD = 2;           // monsters that gang up on one adventurer at most
export const INN = { x: -2.2, y: 11.2 };
const TOWN_SPOTS = [[-2.2, 11.6], [-1, 12.4], [-6.5, 15.6], [3.5, 16.2], [8, 16.4], [14, 16.3], [22, 16.2], [-4, 16.8], [24.5, 16.4]];
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rankIdx = r => ADVENTURER_RANKS.indexOf(r || 'F');
// Quest foes may be species without hunting stats; they get a plain profile scaled to the quest.
const DEFAULT_STATS = { hp: 100, atk: 10, rate: 1.6, reach: 1, speed: .7, xp: 20, gold: [5, 10], mat: 'herb' };
const statsOf = species => MONSTER_STATS[species] || DEFAULT_STATS;
const rootOf = id => JOBS[id]?.base || JOBS[id]?.parent || id;

// Effects for the renderer only (damage numbers, skills, KOs); never saved.
let fx = [];
const emit = e => { fx.push(e); if (fx.length > 300) fx.splice(0, fx.length - 300); };
export function drainFx() { const out = fx; fx = []; return out; }

export function createWorld(seed = 1) {
  return { rng: ((seed >>> 0) ^ 0x2545f491) >>> 0 || 9, nextId: 1, monsters: [], hunters: [], porters: [], free: [], freeClock: 30, departClock: 3, kills: 0 };
}
function rand(w) { let x = w.rng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; w.rng = x >>> 0 || 9; return w.rng / 4294967296; }
const pick = (w, list) => list[Math.floor(rand(w) * list.length) % list.length];
export function pointIn(w, zone, spread = 1) { const a = rand(w) * Math.PI * 2, d = Math.sqrt(rand(w)) * zone.r * spread; return { x: zone.x + Math.cos(a) * d, y: zone.y + Math.sin(a) * d * .8 }; }

/** Keep every open hunting ground stocked; fallen monsters return after a while. */
function stockZones(state, ctx, step) {
  const w = state.world;
  for (const [zoneId, zone] of Object.entries(HUNT_ZONES)) {
    if (!ctx.zoneOpen(zone)) continue;
    const living = w.monsters.filter(m => m.zone === zoneId && !m.raid && !m.boss && !m.elite);
    for (const m of living) if (m.dead) { m.respawn -= step; if (m.respawn <= 0) { const p = pointIn(w, zone); Object.assign(m, { dead: false, hp: m.maxHp, x: p.x, y: p.y, hx: p.x, hy: p.y, target: null }); } }
    for (let i = living.length; i < zone.count; i++) w.monsters.push(spawnMonster(w, pick(w, zone.species), zoneId, pointIn(w, zone)));
  }
}
export function spawnMonster(w, species, zone, p, extra = {}) {
  const s = statsOf(species);
  return { id: `mon-${w.nextId++}`, species, zone, x: p.x, y: p.y, hx: p.x, hy: p.y, hp: s.hp, maxHp: s.hp, cd: rand(w) * s.rate, target: null, dead: false, respawn: 0, wait: rand(w) * 4, tx: p.x, ty: p.y, ...extra };
}

// ---- Free adventurers: they live at the inn, hunt on their own and spend in the village. ----
export function freeLevelRank(level) { return level >= 13 ? 'B' : level >= 9 ? 'C' : level >= 6 ? 'D' : level >= 3 ? 'E' : 'F'; }
function newFree(state, ctx) {
  const w = state.world, used = new Set([...state.members.map(m => m.name), ...w.free.map(f => f.name)]);
  const names = ROOKIE_NAMES.filter(n => !used.has(n));
  const level = clamp(1 + Math.floor(rand(w) * (2 + ctx.guildRankIndex() * 2)), 1, 12);
  return { id: `fa-${w.nextId++}`, name: pick(w, names.length ? names : ROOKIE_NAMES), class: pick(w, ['warrior', 'archer', 'mage', 'healer']), trait: pick(w, TRAIT_NAMES), hair: pick(w, HAIR_COLORS),
    description: pick(w, ROOKIE_LINES), level, xp: 0, rank: freeLevelRank(level), energy: 100, purse: 20 + Math.floor(rand(w) * 40), potions: 1, affinity: Math.floor(rand(w) * 20),
    mode: 'arrive', x: -14, y: 17.5, tx: INN.x, ty: INN.y, wait: 0 };
}
function tickTown(state, ctx, step) {
  const w = state.world, want = ctx.freeTarget();
  w.freeClock -= step;
  if (w.freeClock <= 0) {
    w.freeClock = 70 + rand(w) * 60;
    const town = w.free.filter(f => f.mode !== 'gone');
    if (town.length < want) { const f = newFree(state, ctx); w.free.push(f); ctx.log(`นักผจญภัยอิสระ ${f.name} (${JOBS[f.class].name} Lv.${f.level}) มาพักที่โรงเตี๊ยม`, 'info'); }
  }
  for (const f of w.free) {
    if (f.mode === 'out') continue;
    f.energy = clamp(f.energy + 0.12 * step, 0, 100);
    // Stroll between the inn, the market and the shops.
    const d = Math.hypot(f.tx - f.x, f.ty - f.y);
    if (d > .05) { const s = Math.min(d, step * 1.1); f.x += (f.tx - f.x) / d * s; f.y += (f.ty - f.y) / d * s; }
    else if ((f.wait -= step) <= 0) { const [x, y] = pick(w, TOWN_SPOTS); f.tx = x + (rand(w) - .5); f.ty = y + (rand(w) - .5) * .6; f.wait = 4 + rand(w) * 10; if (f.mode === 'arrive') f.mode = 'town'; }
  }
}

// ---- Residents: registered adventurers at home live in town — their room, the market, the guild hall. ----
const GUILD_VISITORS = 8, STROLL = 1.1;
function chooseErrand(state, ctx, m, inside) {
  const w = state.world, t = m.town, r = rand(w);
  const cap = ctx.hallCap?.() || GUILD_VISITORS, bar = ctx.hasBar?.();
  if (m.energy < 50 || m.injury > 20) t.goal = bar && m.energy >= 30 && r < 0.3 && inside < cap ? 'guild' : 'lodge';
  else if (r < (bar ? 0.4 : 0.3) && inside < cap) t.goal = 'guild';
  else if (r < 0.85) t.goal = 'town';
  else t.goal = 'lodge';
  const shops = t.goal === 'town' && ctx.shopSpots ? ctx.shopSpots() : [];
  const spot = shops.length && rand(w) < 0.6 ? (p => [p.x, p.y])(pick(w, shops)) : pick(w, TOWN_SPOTS);
  const at = t.goal === 'guild' ? ctx.door() : t.goal === 'lodge' ? ctx.lodge(m) : { x: spot[0] + (rand(w) - .5) * 1.4, y: spot[1] + (rand(w) - .5) * .8 };
  t.tx = at.x; t.ty = at.y; t.at = 'street';
}
function tickResidents(state, ctx, step) {
  if (!ctx.atHome) return;
  let inside = state.members.filter(m => m.town?.at === 'guild').length;
  for (const m of state.members) {
    if (!ctx.atHome(m)) { m.town = null; continue; }
    // Back from a job, a team that won heads straight into the guild to celebrate at the bar.
    if (!m.town) { const d = ctx.door(); m.town = { x: d.x, y: d.y, tx: d.x, ty: d.y, wait: 0, at: 'street', goal: m.celebrate && ctx.hasBar?.() ? 'guild' : 'town' }; if (m.celebrate && !ctx.hasBar?.()) m.celebrate = false; }
    const t = m.town, indoors = ctx.indoors(m);
    // Training, chores and treatment happen in the guild hall: walk there first.
    if (indoors && t.at !== 'guild' && t.goal !== 'guild') { const d = ctx.door(); Object.assign(t, { at: 'street', goal: 'guild', tx: d.x, ty: d.y }); }
    if (t.at === 'street') {
      const d = Math.hypot(t.tx - t.x, t.ty - t.y);
      if (d > .05) { const s = Math.min(d, step * STROLL * (0.55 + 0.45 * clamp(m.energy / 100, 0, 1))); t.x += (t.tx - t.x) / d * s; t.y += (t.ty - t.y) / d * s; continue; }
      if (t.goal === 'guild' && (indoors || m.celebrate || inside < (ctx.hallCap?.() || GUILD_VISITORS))) { t.at = 'guild'; t.wait = (m.celebrate ? 20 : 8) + rand(state.world) * 14; inside += 1; if (!indoors) ctx.visitGuild?.(m); continue; }
      if (t.goal === 'lodge') { t.at = 'lodge'; t.wait = 15 + rand(state.world) * 25; continue; }
      if ((t.wait -= step) > 0) continue;
      t.wait = 4 + rand(state.world) * 9; chooseErrand(state, ctx, m, inside);
      continue;
    }
    if (indoors) continue;
    // Resting in their room until fresh, or a short visit to the guild hall.
    if ((t.wait -= step) > 0 || (t.at === 'lodge' && m.energy < 85 && t.wait > -90)) continue;
    if (t.at === 'guild') inside -= 1;
    const out = t.at === 'guild' ? ctx.door() : ctx.lodge(m);
    Object.assign(t, { x: out.x, y: out.y, wait: 2 + rand(state.world) * 4 });
    chooseErrand(state, ctx, m, inside);
  }
}
/** The guild calls everyone fit to fight to a world boss's ground (the rally bounty). */
export function rallyToBoss(state, ctx, zoneId, fit) {
  const w = state.world, party = `pt-${w.nextId++}`, door = ctx.door(), out = [];
  for (const m of state.members.filter(fit)) { m.task = 'rest'; w.hunters.push(makeHunter(state, ctx, m, 'member', zoneId, party, m.town ? { x: m.town.x, y: m.town.y } : door)); out.push(m); }
  return out;
}

// ---- Departures ----
function chooseZone(ctx, rank, power) {
  const zones = Object.entries(HUNT_ZONES).filter(([, z]) => ctx.zoneOpen(z) && rankIdx(z.rank) <= rankIdx(rank) + 1);
  // The hardest ground they can handle: a zone a rank above needs a strong adventurer.
  const fit = zones.filter(([, z]) => rankIdx(z.rank) <= rankIdx(rank) || power >= 34 + rankIdx(z.rank) * 18);
  // A world boss draws everyone who is allowed into its ground.
  const boss = ctx.bossZone?.();
  if (boss && fit.some(([id]) => id === boss)) return boss;
  return (fit.length ? fit : zones).sort((a, b) => rankIdx(b[1].rank) - rankIdx(a[1].rank))[0]?.[0] || null;
}
function makeHunter(state, ctx, who, kind, zoneId, party, start) {
  const zone = HUNT_ZONES[zoneId], stats = kind === 'member' ? ctx.stats(who) : freeStats(who), w = state.world;
  const path = [...zone.via.map(([x, y]) => ({ x, y })), pointIn(w, zone, .6)];
  // Wounds keep their mark out in the field: a hurt adventurer sets out with less to give.
  const hp = Math.round(stats.health * (1 - (who.injury || 0) / 200));
  return { id: who.id, kind, zone: zoneId, party, mode: 'go', x: start.x + (rand(w) - .5) * .4, y: start.y + (rand(w) - .5) * .4, path, hp, maxHp: stats.health,
    power: stats.power ?? stats.basePower, pace: 0.7 + 0.3 * clamp((who.energy ?? 100) / 100, 0, 1), cls: rootOf(who.class), job: who.class, atkCd: rand(w), skillCd: 3 + rand(w) * 4, guard: 0, target: null, carrying: null, carriedBy: null,
    bag: { gold: 0, herb: 0, wood: 0, stone: 0, kills: 0, merit: 0, parts: {}, treasures: [] }, quota: 7 + Math.floor(rand(w) * 4) };
}
export function freeStats(f) {
  const job = JOBS[f.class], power = (job.power + (f.level - 1) * 2.7 + 4) * ({ F: 1, E: 1.04, D: 1.08, C: 1.13, B: 1.19 }[f.rank] || 1);
  return { basePower: Math.round(power), health: Math.round(job.health + (f.level - 1) * 8), role: job.role };
}
function departures(state, ctx) {
  const w = state.world;
  // Guild members with nothing to do head out in small parties.
  const ready = state.members.filter(m => ctx.freeToHunt(m));
  while (ready.length) {
    const lead = ready.shift(), lp = ctx.stats(lead), zone = chooseZone(ctx, lead.rank, lp.basePower);
    if (!zone || rand(w) > 0.3) continue;
    const mates = ready.filter(m => chooseZone(ctx, m.rank, ctx.stats(m).basePower) === zone).sort((a, b) => ctx.bond(lead.id, b.id) - ctx.bond(lead.id, a.id)).slice(0, rand(w) < .35 ? 0 : 2);
    mates.forEach(m => ready.splice(ready.indexOf(m), 1));
    const party = `pt-${w.nextId++}`, door = ctx.door();
    // They set off from wherever they are in town: the market, the inn, the guild steps.
    for (const m of [lead, ...mates]) { m.task = 'rest'; m.autoTrain = false; w.hunters.push(makeHunter(state, ctx, m, 'member', zone, party, m.town ? { x: m.town.x, y: m.town.y } : door)); }
    ctx.log(`${[lead, ...mates].map(m => m.name).join(' · ')} ออกไปล่ามอนที่${HUNT_ZONES[zone].name}`, 'hunt');
  }
  // Free adventurers go alone or in pairs.
  const idle = w.free.filter(f => f.mode === 'town' && f.energy >= 75);
  for (const f of idle) {
    if (f.mode !== 'town' || rand(w) > 0.3) continue;
    const zone = chooseZone(ctx, f.rank, freeStats(f).basePower);
    if (!zone) continue;
    const buddy = rand(w) < .4 ? idle.find(o => o !== f && o.mode === 'town' && chooseZone(ctx, o.rank, freeStats(o).basePower) === zone) : null;
    const party = `pt-${w.nextId++}`;
    for (const a of [f, buddy].filter(Boolean)) { a.mode = 'out'; w.hunters.push(makeHunter(state, ctx, a, 'free', zone, party, { x: a.x, y: a.y })); }
  }
}

// ---- Movement and combat ----
function moveTo(a, p, speed, dt) { const d = dist(a, p); if (d < 1e-3) return true; const s = Math.min(d, speed * dt); a.x += (p.x - a.x) / d * s; a.y += (p.y - a.y) / d * s; return s >= d - 1e-6; }
function walkPath(h, speed, dt) { while (h.path.length && moveTo(h, h.path[0], speed, dt)) { h.path.shift(); dt = 0; } return !h.path.length; }
function homeRoute(h, ctx) {
  if (h.party.startsWith('pt-defend')) return [h.kind === 'member' ? ctx.door() : { ...INN }];
  if (h.via) return [...h.via].reverse().map(([x, y]) => ({ x, y })).concat([ctx.door()]);
  const zone = HUNT_ZONES[h.zone], back = [...zone.via].reverse().map(([x, y]) => ({ x, y }));
  return [...back, h.kind === 'member' ? ctx.door() : { ...INN }];
}
const viaOf = h => h.via || HUNT_ZONES[h.zone]?.via || [];
function startReturn(state, ctx, partyId) {
  for (const h of state.world.hunters) if (h.party === partyId && ['go', 'hunt'].includes(h.mode)) { h.mode = 'return'; h.target = null; h.path = homeRoute(h, ctx); }
}
function hitMonster(state, ctx, h, m, dmg, kind) {
  if (m.under > 0 || m.dead) return;
  if (m.air > 0 && ['slash', 'holy'].includes(kind)) { emit({ type: 'miss', id: m.id, x: m.x, y: m.y }); return; }
  if (statsOf(m.species).trait === 'armor') dmg *= .7;
  m.hp -= dmg; m.target ??= h.id; m.calm = 0;
  emit({ type: 'hit', id: m.id, from: h.id, x: m.x, y: m.y, fx: h.x, fy: h.y, amount: Math.round(dmg), kind, crit: dmg > h.power * .6 });
  if (m.hp > 0) return;
  m.dead = true; m.respawn = 30 + rand(state.world) * 20; state.world.kills++;
  emit({ type: 'kill', id: m.id, x: m.x, y: m.y, species: m.species });
  ctx.codex?.(m.species);
  const s = statsOf(m.species), party = state.world.hunters.filter(o => o.party === h.party && o.mode === 'hunt' && dist(o, m) < 9);
  if (m.quest) { h.bag.kills += 1; const qp = MONSTER_PART[m.species]; if (qp && (m.questBoss || rand(state.world) < .5)) { h.bag.parts ??= {}; h.bag.parts[qp] = (h.bag.parts[qp] || 0) + (m.questBoss ? 4 : 1); } return; }
  h.bag.gold += s.gold[0] + Math.floor(rand(state.world) * (s.gold[1] - s.gold[0] + 1));
  if (rand(state.world) < .7) h.bag[s.mat] += 1 + (s.boss ? 4 : 0);
  h.bag.kills += 1;
  // Parts for the guild counter, and now and then a treasure; bosses always guard one.
  const part = MONSTER_PART[m.species];
  if (part && rand(state.world) < TRADE_RULES.partChance) { h.bag.parts ??= {}; h.bag.parts[part] = (h.bag.parts[part] || 0) + (s.boss ? 5 : 1); }
  const zoneRank = rankIdx(HUNT_ZONES[m.zone]?.rank || 'F');
  if (s.boss || m.elite || rand(state.world) < TRADE_RULES.treasureChance * (1 + zoneRank * 0.5) * (ctx.luck?.() || 1)) {
    const pool = Object.entries(TREASURES).filter(([, t]) => !t.boss && rankIdx(t.rank) <= zoneRank).map(([id]) => id);
    h.bag.treasures ??= [];
    if (s.boss) h.bag.treasures.push('rustCrown');
    else if (pool.length) h.bag.treasures.push(pool[Math.floor(rand(state.world) * pool.length) % pool.length]);
  }
  for (const o of party) {
    const who = o.kind === 'member' ? state.members.find(x => x.id === o.id) : state.world.free.find(x => x.id === o.id);
    if (!who) continue;
    const share = Math.round(s.xp * (party.length > 1 ? .7 : 1));
    if (o.kind === 'member') { ctx.addXp(who, share); const gap = rankIdx(HUNT_ZONES[o.zone]?.rank || 'F') - rankIdx(who.rank); o.bag.merit += gap >= 1 ? 2 : gap === 0 ? 1 : .3; }
    else freeXp(ctx, who, share);
  }
  if (m.raid || m.boss || m.elite) ctx.onSpecialKill?.(m, h);
}
function freeXp(ctx, f, amount) {
  f.xp += amount;
  while (f.level < 20 && f.xp >= ctx.xpNeeded(f.level)) { f.xp -= ctx.xpNeeded(f.level); f.level += 1; f.rank = freeLevelRank(f.level); }
}
/** How this adventurer fights: their own job's style, or their base class's. */
const combatOf = h => JOB_COMBAT[h.job] || JOB_COMBAT[h.cls] || JOB_COMBAT.warrior;
const HEALERS = new Set(['healer', 'cleric', 'saint']);
function useSkill(state, ctx, h, m, near, party, cc) {
  const w = state.world, p = h.power * HIT * cc.dmg * (h.buff > 0 ? 1 + h.buffAmt : 1), around = r => near.filter(x => dist(x, m) < r), mine = r => near.filter(x => dist(x, h) < r);
  const heal = (o, frac) => { const amt = o.maxHp * frac; o.hp = Math.min(o.maxHp, o.hp + amt); emit({ type: 'heal', x: o.x, y: o.y, amount: Math.round(amt) }); };
  const slow = (x, t) => { x.slow = Math.max(x.slow || 0, t); };
  switch (cc.skill) {
    case 'guard': h.guard = 5; for (const x of mine(4)) x.target = h.id; break;
    case 'shieldwall': h.guard = 6; for (const o of party) if (dist(o, h) < 3) o.guard = Math.max(o.guard, 3); for (const x of mine(4.5)) x.target = h.id; break;
    case 'aegis': h.guard = 6; for (const o of party) { heal(o, .2); o.guard = Math.max(o.guard, 2.5); } for (const x of mine(5)) x.target = h.id; break;
    case 'cleave': for (const x of mine(1.8)) hitMonster(state, ctx, h, x, p * 1.4, 'slash'); break;
    case 'whirlwind': for (const x of mine(2.4)) hitMonster(state, ctx, h, x, p * 1.9 * (rand(w) < .3 ? 1.6 : 1), 'slash'); break;
    case 'volley': for (const x of mine(cc.reach + .5).slice(0, 3)) hitMonster(state, ctx, h, x, p * 1.2, 'arrow'); break;
    case 'snare': slow(m, 4); hitMonster(state, ctx, h, m, p * 1.4, 'arrow'); break;
    case 'thornward': for (const x of mine(cc.reach + .5).slice(0, 4)) { slow(x, 3); hitMonster(state, ctx, h, x, p * 1.25, 'arrow'); } break;
    case 'aimed': hitMonster(state, ctx, h, m, p * 2.6, 'pierce'); break;
    case 'deadeye': hitMonster(state, ctx, h, m, p * 3.6 * 1.3, 'pierce'); break;
    case 'fireball': for (const x of around(1.6)) hitMonster(state, ctx, h, x, p * 1.8, 'fire'); break;
    case 'frost': for (const x of around(2)) { slow(x, 4); hitMonster(state, ctx, h, x, p * 1.2, 'frost'); } break;
    case 'timewarp': for (const x of around(2.4)) { slow(x, 5); hitMonster(state, ctx, h, x, p * 1.5, 'frost'); } for (const o of party) if (o !== h) o.skillCd = Math.max(0, o.skillCd - 3); break;
    case 'meteor': for (const x of around(2.2)) hitMonster(state, ctx, h, x, p * 2.4, 'fire'); break;
    case 'chain': { let k = 2; for (const x of [m, ...near.filter(x => x !== m).sort((a, b) => dist(a, m) - dist(b, m))].slice(0, 5)) { hitMonster(state, ctx, h, x, p * k, 'spark'); k *= .8; } break; }
    case 'blessing': for (const o of party) heal(o, .3); break;
    case 'sanctuary': for (const o of party) { heal(o, .35); o.guard = Math.max(o.guard, 2); } break;
    case 'miracle': {
      for (const o of party) heal(o, .5);
      const fallen = w.hunters.find(o => o.party === h.party && o.mode === 'down' && !o.carriedBy && dist(o, h) < 6);
      if (fallen) { fallen.hp = fallen.maxHp * .4; fallen.mode = fallen.mission ? 'hunt' : 'return'; if (!fallen.mission) fallen.path = homeRoute(fallen, ctx); w.porters = w.porters.filter(o => o.target !== fallen.id); emit({ type: 'revive', id: fallen.id, x: fallen.x, y: fallen.y }); }
      break;
    }
    case 'valor': for (const o of party) { o.buff = 6; o.buffAmt = .3; } break;
    case 'crescendo': for (const o of party) { o.buff = 7; o.buffAmt = .4; heal(o, .2); } break;
  }
}
function fight(state, ctx, h, dt) {
  const w = state.world, cc = combatOf(h), party = w.hunters.filter(o => o.party === h.party && o.mode !== 'down' && o.mode !== 'carried');
  h.atkCd -= dt; h.skillCd -= dt; h.guard = Math.max(0, h.guard - dt); h.buff = Math.max(0, (h.buff || 0) - dt);
  const near = w.monsters.filter(m => !m.dead && (h.zone === m.zone || m.raid || m.boss) && dist(h, m) < (m.raid ? 14 : 11));
  const support = HEALERS.has(h.job) || HEALERS.has(h.cls) || h.cls === 'healer';
  // Healers mend the most hurt friend first, and save their big skill for when several are hurt.
  if (support) {
    const hurt = party.filter(o => o.hp < o.maxHp * .75 && dist(o, h) < cc.reach + 1).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    const fallen = cc.skill === 'miracle' && w.hunters.some(o => o.party === h.party && o.mode === 'down' && !o.carriedBy);
    if (h.skillCd <= 0 && near.length && (party.filter(o => o.hp < o.maxHp * .6).length >= 2 || fallen)) {
      h.skillCd = cc.cd; emit({ type: 'skill', id: h.id, x: h.x, y: h.y, skill: cc.skill, name: cc.name }); useSkill(state, ctx, h, near[0], near, party, cc); return;
    }
    if (hurt && h.atkCd <= 0) { const amt = h.power * .9; hurt.hp = Math.min(hurt.maxHp, hurt.hp + amt); emit({ type: 'heal', x: hurt.x, y: hurt.y, amount: Math.round(amt) }); h.atkCd = cc.rate; return; }
  }
  let m = near.find(x => x.id === h.target);
  if (!m) {
    const taken = id => w.hunters.filter(o => o.target === id && o.party !== h.party).length;
    m = near.filter(x => taken(x.id) < 2).sort((a, b) => dist(h, a) - dist(h, b))[0];
    h.target = m?.id || null;
  }
  if (!m) { if (h.mode === 'defend') return; if (h.mission) { missionIdle(state, h, dt); return; } if (!h.wander || dist(h, h.wander) < .2) h.wander = pointIn(w, HUNT_ZONES[h.zone] || { x: h.x, y: h.y, r: 2 }, .7); moveTo(h, h.wander, WALK * .6, dt); return; }
  if (dist(h, m) > cc.reach) { moveTo(h, { x: m.x + (h.x > m.x ? .4 : -.4), y: m.y }, WALK, dt); return; }
  if (h.skillCd <= 0 && !support) {
    h.skillCd = cc.cd;
    emit({ type: 'skill', id: h.id, x: h.x, y: h.y, tx: m.x, ty: m.y, skill: cc.skill, name: cc.name });
    useSkill(state, ctx, h, m, near, party, cc);
    return;
  }
  if (h.atkCd <= 0) {
    h.atkCd = cc.rate;
    const crit = rand(w) < (cc.attack === 'pierce' ? .2 : .1), dmg = h.power * HIT * cc.dmg * (h.buff > 0 ? 1 + h.buffAmt : 1) * (.85 + rand(w) * .3) * (crit ? 1.6 : 1);
    hitMonster(state, ctx, h, m, dmg, cc.attack);
  }
}
// ---- Boss phases: at half life every boss gets angry; the frontier's two great foes have whole acts of their own. ----
export const BOSS_PHASES = {
  wyvernMatriarch: [{ at: .7, name: 'ทะยานขึ้นฟ้า', act: 'fly' }, { at: .4, name: 'พายุใต้ปีก', act: 'adds' }, { at: .2, name: 'โกรธจัด', act: 'enrage' }],
  emberDragon: [{ at: .75, name: 'วงแหวนเพลิง', act: 'ring' }, { at: .5, name: 'ปลุกลูกสมุนลาวา', act: 'adds' }, { at: .3, name: 'ตื่นเต็มที่', act: 'enrage' }],
  sandWyrm: [{ at: .5, name: 'ทรายคลั่ง', act: 'enrage' }],
};
function bossPhases(state, ctx, m, s, dt) {
  const phases = BOSS_PHASES[m.species] || [{ at: .4, name: 'โกรธจัด', act: 'enrage' }], ratio = m.hp / m.maxHp;
  m.phase ??= 0;
  while (m.phase < phases.length && ratio <= phases[m.phase].at) {
    const ph = phases[m.phase++];
    m.phaseName = ph.name; emit({ type: 'phase', id: m.id, x: m.x, y: m.y, name: ph.name, species: m.species });
    if (ph.act === 'enrage') { m.enraged = true; m.atk = Math.round((m.atk || s.atk) * 1.25 * 10) / 10; }
    if (ph.act === 'fly') { m.air = 6; m.target = null; }
    if (ph.act === 'ring') m.ringCd = 2;
    if (ph.act === 'adds') for (const [i, sp] of ((s.adds && s.adds.length) ? s.adds : ['magmaTortoise', 'stoneDrake']).entries()) {
      const a = spawnMonster(state.world, sp, m.zone, { x: m.x + (i ? 1.2 : -1.2), y: m.y + .8 }, { quest: m.quest, hp: Math.round(m.maxHp * .08), maxHp: Math.round(m.maxHp * .08), atk: Math.round((m.atk || s.atk) * .45 * 10) / 10 });
      state.world.monsters.push(a);
    }
  }
  // The dragon's ring of fire: a warning circle first, then the flames.
  if (m.ringCd !== undefined) {
    m.ringCd -= dt;
    if (m.ringCd <= 0 && !m.warn) { m.warn = 1.4; emit({ type: 'telegraph', id: m.id, x: m.x, y: m.y, r: 2.8, time: 1.4 }); }
    if (m.warn > 0) { m.warn -= dt; if (m.warn <= 0) { m.warn = 0; m.ringCd = 9; emit({ type: 'firering', id: m.id, x: m.x, y: m.y, r: 2.8 }); for (const h of state.world.hunters) if (h.mission === m.quest && ['hunt', 'go'].includes(h.mode) && dist(h, m) < 2.8) strike(state, ctx, m, h, (m.atk || s.atk) * .9, 'fire'); } }
  }
}
/** Where a quest raider is headed when nobody is in its way: the wagon or a spot in the field. */
function goalOf(state, m) {
  const rt = missionOf(state, m.quest)?.rt; if (!rt) return null;
  if (m.goal === 'wagon' && rt.wagon && rt.stage === 'escort') return { x: rt.wagon.x, y: rt.wagon.y, wagon: rt.wagon };
  if (m.goal === 'field' && rt.field) { m.spot ??= { x: rt.field.x + (rand(state.world) - .5) * rt.field.r * 1.4, y: rt.field.y + (rand(state.world) - .5) * rt.field.r }; return m.spot; }
  return null;
}
function strike(state, ctx, m, t, dmg, kind) {
  const hero = state.hero;
  dmg *= (.85 + rand(state.world) * .3) * (t.guard > 0 ? .6 : 1);
  if (t === hero) { heroHurt(state, ctx, m, dmg); return; }
  t.hp -= dmg; emit({ type: 'hurt', id: t.id, by: m.id, x: t.x, y: t.y, amount: Math.round(dmg), kind });
  if (t.hp <= 0) knockOut(state, ctx, t);
}
function monsterAct(state, ctx, m, dt) {
  const w = state.world, s = statsOf(m.species), trait = s.trait;
  if (m.slow > 0) { m.slow -= dt; dt *= .5; }
  m.calm = (m.calm || 0) + dt; m.dashCd = (m.dashCd || 4) - dt; m.skillCd = (m.skillCd ?? 5) - dt;
  // Burrowers vanish under the sand, then burst up beside someone.
  if (m.under > 0) {
    m.under -= dt;
    if (m.under <= 0) { const v = w.hunters.filter(h => h.mission === m.quest && ['hunt', 'go'].includes(h.mode)); const t = v[Math.floor(rand(w) * v.length)]; if (t) { m.x = t.x + .6; m.y = t.y; } emit({ type: 'erupt', id: m.id, x: m.x, y: m.y });
      for (const h of v) if (dist(h, m) < 1.6) strike(state, ctx, m, h, (m.atk || s.atk) * 1.2, 'erupt'); }
    return;
  }
  if (m.questBoss || s.boss) bossPhases(state, ctx, m, s, dt);
  if (m.air > 0) { m.air -= dt; if (m.air <= 0) { emit({ type: 'dive', id: m.id, x: m.x, y: m.y }); for (const h of state.world.hunters) if (h.mission === m.quest && ['hunt', 'go'].includes(h.mode) && dist(h, m) < 2.4) strike(state, ctx, m, h, (m.atk || s.atk) * 1.6, 'slam'); } }
  if (m.air > 0) return;
  if (trait === 'regen' && m.calm > 3) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * .015 * dt);
  // Quest parties only meet their own quest's foes; wild monsters leave them be.
  const targets = w.hunters.filter(h => ['hunt', 'go', 'return', 'carry', 'defend'].includes(h.mode) && (h.mission ? m.quest === h.mission : !m.quest));
  const hero = state.hero;
  if (hero?.active && !(hero.down > 0)) targets.push(hero);
  const goal = m.quest ? goalOf(state, m) : null;
  let t = targets.find(h => h.id === m.target);
  if (!t || dist(t, m) > LEASH || (!m.raid && !m.quest && Math.hypot(m.x - m.hx, m.y - m.hy) > LEASH)) {
    const guards = targets.filter(h => h.guard > 0 && dist(h, m) < 4);
    // Monsters gang up on one adventurer only so far; the rest keep their distance.
    const crowd = id => w.monsters.filter(o => o !== m && !o.dead && o.target === id).length;
    const aggro = goal && trait === 'thief' ? 1.4 : AGGRO;
    const pool = targets.filter(h => dist(h, m) < (trait === 'dive' ? 5 : aggro) && (m.boss || m.raid || m.quest || crowd(h.id) < CROWD));
    t = guards[0] || (trait === 'dive' ? pool.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] : pool.sort((a, b) => dist(a, m) - dist(b, m))[0]) || null;
    m.target = t?.id || null;
  }
  m.fighting = Boolean(t);
  if (!t) {
    if (goal) {
      // Raiders go for the wagon or the crops, and set about them when they get there.
      const reach = goal.wagon ? 1.1 : .2;
      if (dist(m, goal) > reach) { moveTo(m, goal, Math.max(.6, s.speed || .6), dt); return; }
      m.cd -= dt; if (m.cd > 0) return; m.cd = s.rate;
      if (goal.wagon) { goal.wagon.hp -= (m.atk || s.atk) * (.85 + rand(w) * .3); emit({ type: 'hurt', id: 'wagon', by: m.id, x: goal.wagon.x, y: goal.wagon.y, amount: Math.round(m.atk || s.atk), wagon: true }); }
      else emit({ type: 'munch', id: m.id, x: m.x, y: m.y });
      return;
    }
    if (m.raid) { moveTo(m, ctx.door(), s.speed || .6, dt); if (dist(m, ctx.door()) < 1.2) ctx.onRaidReach?.(m); return; }
    if (!s.speed) return;
    if ((m.wait -= dt) <= 0 && Math.hypot(m.tx - m.x, m.ty - m.y) < .1) { const a = rand(w) * Math.PI * 2, d = rand(w) * 2.5; m.tx = m.hx + Math.cos(a) * d; m.ty = m.hy + Math.sin(a) * d * .8; m.wait = 2 + rand(w) * 5; }
    moveTo(m, { x: m.tx, y: m.ty }, s.speed * .5, dt); m.hp = Math.min(m.maxHp, m.hp + m.maxHp * (m.boss ? .002 : .02) * dt); return;
  }
  const atk = m.atk || s.atk, d = dist(t, m);
  // Signature moves first: a charge from range, a burrow, a fire breath.
  if (trait === 'charge' && m.dashCd <= 0 && d > 1.4 && d < 4.5) { m.dashCd = 6; emit({ type: 'charge', id: m.id, x: m.x, y: m.y, tx: t.x, ty: t.y }); m.x = t.x + (m.x > t.x ? .7 : -.7); m.y = t.y; strike(state, ctx, m, t, atk * 1.5, 'charge'); m.cd = s.rate; return; }
  if (trait === 'burrow' && m.skillCd <= 0) { m.skillCd = 9; m.under = 1.8; m.target = null; emit({ type: 'burrow', id: m.id, x: m.x, y: m.y }); return; }
  if (trait === 'breath' && m.skillCd <= 0 && d < 4) {
    m.skillCd = 8; emit({ type: 'breath', id: m.id, x: m.x, y: m.y, tx: t.x, ty: t.y });
    for (const h of targets) if (dist(h, t) < 2.4) strike(state, ctx, m, h, atk * 1.1, 'fire');
    return;
  }
  if (trait === 'summon' && m.questBoss && (m.summoned || 0) < 2 && m.hp < m.maxHp * (m.summoned ? .34 : .67)) {
    m.summoned = (m.summoned || 0) + 1; emit({ type: 'summon', id: m.id, x: m.x, y: m.y });
    for (const [i, sp] of (s.adds || ['leafSlime']).entries()) { const a = spawnMonster(w, sp, m.zone, { x: m.x + (i ? .9 : -.9), y: m.y + .7 }, { quest: m.quest, hp: Math.round(m.maxHp * .07), maxHp: Math.round(m.maxHp * .07), atk: Math.round(atk * .45 * 10) / 10 }); w.monsters.push(a); }
  }
  if (d > s.reach) { if (s.speed) moveTo(m, t, s.speed * (trait === 'swarm' ? 1.2 : 1), dt); return; }
  m.cd -= dt;
  if (m.cd > 0) return;
  m.cd = s.rate * (m.enraged ? .75 : 1);
  m.hits = (m.hits || 0) + 1;
  if (trait === 'ranged') emit({ type: 'spit', id: m.id, x: m.x, y: m.y, tx: t.x, ty: t.y, species: m.species });
  if (trait === 'slam' && m.hits % 3 === 0) { emit({ type: 'slam', id: m.id, x: t.x, y: t.y }); for (const h of targets) if (h !== t && dist(h, t) < 1.7) strike(state, ctx, m, h, atk * .8, 'slam'); }
  strike(state, ctx, m, t, atk, trait === 'ranged' ? 'spit' : 'bite');
}
function knockOut(state, ctx, h) {
  const w = state.world;
  // A carrier who falls drops the friend they carried; both wait for help.
  if (h.carrying) { const c = w.hunters.find(o => o.id === h.carrying); if (c) { c.carriedBy = null; c.mode = 'down'; } h.carrying = null; }
  h.hp = 0; h.mode = 'down'; h.target = null; h.path = [];
  emit({ type: 'ko', id: h.id, x: h.x, y: h.y });
  for (const m of w.monsters) if (m.target === h.id) m.target = null;
  const name = h.kind === 'member' ? state.members.find(m => m.id === h.id)?.name : w.free.find(f => f.id === h.id)?.name;
  if (h.kind === 'member') ctx.log(`${name}สลบที่${HUNT_ZONES[h.zone]?.name || 'นอกเมือง'}!`, 'warning');
  // Hunting parties go home with their fallen; a quest party fights on until the job is done or everyone is down.
  if (!h.mission) startReturn(state, ctx, h.party);
}
/** A conscious friend picks up the fallen; with nobody left, porters set out from the guild. */
function arrangeCarry(state, ctx) {
  const w = state.world;
  for (const down of w.hunters.filter(h => h.mode === 'down' && !h.carriedBy)) {
    const friend = w.hunters.filter(o => o.party === down.party && (down.mission ? ['return'] : ['return', 'hunt', 'go', 'defend']).includes(o.mode) && !o.carrying && o.hp > 0).sort((a, b) => dist(a, down) - dist(b, down))[0];
    if (friend) { friend.carrying = down.id; friend.mode = 'carry'; friend.path = [{ x: down.x, y: down.y }, ...homeRoute(friend, ctx)]; down.carriedBy = friend.id; down.mode = 'carried'; continue; }
    if (down.kind === 'member' && !w.porters.some(p => p.target === down.id)) {
      const door = ctx.door();
      w.porters.push({ id: `por-${w.nextId++}`, target: down.id, x: door.x, y: door.y, path: [...(down.party.startsWith('pt-defend') ? [] : viaOf(down).map(([x, y]) => ({ x, y }))), { x: down.x, y: down.y }], mode: 'go' });
      ctx.log(`ส่งคนแบกเปลออกไปรับ${state.members.find(m => m.id === down.id)?.name}กลับบ้าน`, 'warning');
    }
    if (down.kind === 'free' && !w.porters.some(p => p.target === down.id)) w.porters.push({ id: `por-${w.nextId++}`, target: down.id, x: INN.x, y: INN.y, path: [...HUNT_ZONES[down.zone].via.map(([x, y]) => ({ x, y })), { x: down.x, y: down.y }], mode: 'go', inn: true });
  }
}
function tickPorters(state, ctx, dt) {
  const w = state.world;
  for (const p of [...w.porters]) {
    const down = w.hunters.find(h => h.id === p.target);
    if (!down) { w.porters = w.porters.filter(o => o !== p); continue; }
    if (p.mode === 'go') { if (walkPath(p, PORTER, dt)) { p.mode = 'back'; p.path = (down.party.startsWith('pt-defend') ? [] : [...viaOf(down)].reverse().map(([x, y]) => ({ x, y }))).concat([p.inn ? { ...INN } : ctx.door()]); down.mode = 'carried'; down.carriedBy = p.id; } }
    else { const done = walkPath(p, CARRY, dt); down.x = p.x; down.y = p.y; if (done) { arriveHome(state, ctx, down); w.porters = w.porters.filter(o => o !== p); } }
  }
}
/** Home again: sell the loot (the guild takes its share), the fallen go to bed. */
function arriveHome(state, ctx, h) {
  const w = state.world, bag = h.bag, mats = ['herb', 'wood', 'stone'];
  if (h.mission) { const ms = state.missions?.find(x => x.id === h.mission); if (ms?.rt) { ms.rt.back ??= {}; ms.rt.back[h.id] = { hp: Math.max(0, h.hp) / h.maxHp, ko: h.mode === 'carried' || h.hp <= 0 }; } }
  const matValue = mats.reduce((sum, k) => sum + bag[k] * ctx.price(k) * HUNT_ECONOMY.matPrice, 0), income = Math.floor(bag.gold + matValue);
  for (const k of mats) if (bag[k]) ctx.marketAdd(k, bag[k]);
  const who = h.kind === 'member' ? state.members.find(m => m.id === h.id) : w.free.find(f => f.id === h.id);
  if (who) {
    const sale = ctx.sellLoot?.(h, who) || { sold: 0, paid: 0 };
    if (sale.sold) emit({ type: 'sell', id: h.id, x: h.x, y: h.y, amount: sale.sold, gold: sale.paid });
    const share = h.kind === 'member' ? HUNT_ECONOMY.guildCut : HUNT_ECONOMY.marketFee;
    const guild = Math.floor(income * share);
    who.purse = (who.purse || 0) + income - guild;
    if (guild > 0) ctx.income(guild, h.kind === 'member' ? 'ส่วนแบ่งการล่าของสมาชิก' : 'ค่าธรรมเนียมจุดรับซื้อของ');
    ctx.prosperity(income * .012);
    if (h.kind === 'member') {
      who.points = (who.points || 0) + Math.round(bag.merit);
      if (bag.kills) ctx.renown?.(h.zone, bag.kills);
      who.energy = clamp(who.energy - 8, 0, 100);
      if (h.mode === 'carried' || h.hp <= 0) { who.injury = clamp((who.injury || 0) + 30, 0, 100); who.morale = clamp(who.morale - 6, 0, 100); ctx.log(`${who.name}ถูกหามกลับถึงกิลด์ ต้องพักรักษาตัว`, 'warning'); }
      else if (bag.kills && !h.mission) ctx.log(`${who.name}กลับจาก${HUNT_ZONES[h.zone].name} ล่าได้ ${bag.kills} ตัว ได้เงิน ${income} G (กิลด์ได้ ${guild} G)${sale.sold ? ` · ขายของให้กิลด์ ${sale.sold} ชิ้น` : ''}`, 'hunt');
    } else {
      who.mode = 'town'; who.x = INN.x; who.y = INN.y; who.tx = INN.x; who.ty = INN.y; who.wait = 6;
      who.affinity = clamp((who.affinity || 0) + (bag.kills ? 3 : 0), 0, 100);
      if (h.mode === 'carried' || h.hp <= 0) who.energy = 10;
      if (who.potions < 1 && who.purse >= 22) { who.purse -= 22; who.potions = 1; ctx.prosperity(2); }
    }
  }
  if (h.carrying) { const c = w.hunters.find(o => o.id === h.carrying); if (c) { c.x = h.x; c.y = h.y; arriveHome(state, ctx, c); } }
  w.hunters = w.hunters.filter(o => o.id !== h.id);
}
function stepHunters(state, ctx, dt) {
  const w = state.world;
  for (const h of [...w.hunters]) {
    if (!w.hunters.includes(h)) continue;
    const who = h.kind === 'member' ? state.members.find(m => m.id === h.id) : w.free.find(f => f.id === h.id);
    if (!who) { w.hunters = w.hunters.filter(o => o !== h); continue; }
    if (h.mode === 'down' || h.mode === 'carried') { if (h.carriedBy) { const c = w.hunters.find(o => o.id === h.carriedBy) || w.porters.find(o => o.id === h.carriedBy); if (c) { h.x = c.x; h.y = c.y - .05; } } continue; }
    who.energy = clamp(who.energy - 0.05 * dt, 0, 100);
    if (h.mode === 'go') {
      // Ambushed on the way in: stand and fight.
      const ambush = !h.mission && w.monsters.some(m => !m.dead && m.target === h.id && dist(m, h) < 2.5);
      if (ambush || walkPath(h, WALK * (h.pace || 1), dt)) { h.mode = 'hunt'; h.path = []; }
      continue;
    }
    if (h.mode === 'return' || h.mode === 'carry') { if (walkPath(h, h.mode === 'carry' ? CARRY : WALK * (h.pace || 1), dt)) arriveHome(state, ctx, h); continue; }
    if (h.mode === 'defend' || h.mode === 'hunt') {
      // A potion when badly hurt; leave when the bag is full, tired, or still hurting with no potion.
      if (h.hp < h.maxHp * .35) {
        if (h.kind === 'member' && who.pack?.potion > 0) { who.pack.potion -= 1; h.hp = Math.min(h.maxHp, h.hp + h.maxHp * .5); emit({ type: 'heal', x: h.x, y: h.y, amount: Math.round(h.maxHp * .5), potion: true }); }
        else if (h.kind === 'free' && who.potions > 0) { who.potions -= 1; h.hp = Math.min(h.maxHp, h.hp + h.maxHp * .5); emit({ type: 'heal', x: h.x, y: h.y, amount: Math.round(h.maxHp * .5), potion: true }); }
        else if (h.mode === 'hunt' && !h.mission) { startReturn(state, ctx, h.party); continue; }
      }
      if (h.mode === 'hunt' && !h.mission && (h.bag.kills >= h.quota || who.energy < 30)) { startReturn(state, ctx, h.party); continue; }
      fight(state, ctx, h, dt);
      if (h.mode === 'defend' && !w.monsters.some(m => m.raid && !m.dead)) { h.mode = 'return'; h.path = [h.kind === 'member' ? ctx.door() : { ...INN }]; }
    }
  }
}

/** Advance the living world by `step` seconds of game time. */
export function tickLife(state, ctx, step) {
  state.world ??= createWorld(state.seed);
  const w = state.world;
  let left = step;
  while (left > 1e-9) {
    const dt = Math.min(SUB, left); left -= dt;
    stockZones(state, ctx, dt);
    tickTown(state, ctx, dt);
    tickResidents(state, ctx, dt);
    w.departClock -= dt;
    if (w.departClock <= 0) { w.departClock = 3; departures(state, ctx); }
    stepHunters(state, ctx, dt);
    tickHero(state, ctx, dt);
    tickExpeditions(state, ctx, dt);
    for (const m of w.monsters) if (!m.dead) monsterAct(state, ctx, m, dt);
    w.monsters = w.monsters.filter(m => !(m.dead && (m.raid || m.boss || m.swarm || m.quest || m.elite)));
    arrangeCarry(state, ctx);
    tickPorters(state, ctx, dt);
  }
}
/** Send out the defenders (members and free adventurers at home) when monsters reach the village. */
export function rallyDefenders(state, ctx) {
  const w = state.world, party = `pt-defend-${w.nextId++}`, door = ctx.door();
  for (const m of state.members.filter(m => ctx.freeToDefend(m))) { const h = makeHunter(state, ctx, m, 'member', 'meadow', party, door); h.mode = 'defend'; h.path = []; w.hunters.push(h); }
  for (const f of w.free.filter(f => f.mode === 'town' && f.energy > 30)) { f.mode = 'out'; const h = makeHunter(state, ctx, f, 'free', 'meadow', party, f); h.mode = 'defend'; h.path = []; w.hunters.push(h); }
}
/** Call every hunting party home (a storm, an emergency). */
export function recallHunters(state, ctx) {
  for (const party of new Set(state.world.hunters.filter(h => ['go', 'hunt'].includes(h.mode) && !h.party.startsWith('pt-defend')).map(h => h.party))) startReturn(state, ctx, party);
}
/** A new free adventurer arrives at the inn, optionally already fond of the guild. */
export function addFree(state, ctx, affinity = null) {
  const f = newFree(state, ctx);
  if (affinity !== null) f.affinity = clamp(affinity, 0, 100);
  state.world.free.push(f);
  return f;
}
export function worldRandom(state) { return rand(state.world); }

// ---- The guild master, played by the player: walk the world, swing, spin and dodge. ----
export const HERO = { speed: 3.2, dashSpeed: 9, dashTime: 0.18, dashCd: 1.2, atkCd: 0.45, reach: 1.5, skillCd: 5, skillReach: 2.3, downTime: 4 };
export const heroXpNeeded = level => 40 + level * 30;
export function heroStats(level) { return { power: 16 + level * 4, maxHp: 140 + level * 20 }; }
export function createHero() { return { active: false, x: 0, y: 0, hp: 160, maxHp: 160, level: 1, xp: 0, atkCd: 0, skillCd: 0, dashCd: 0, dash: 0, down: 0, fx: 0, fy: 1, kills: 0, id: 'hero', mode: 'hunt', guard: 0 }; }
function heroHurt(state, ctx, m, dmg) {
  const hero = state.hero;
  if (hero.dash > 0) { emit({ type: 'dodge', id: 'hero', x: hero.x, y: hero.y }); return; }
  hero.hp -= dmg; emit({ type: 'hurt', id: 'hero', by: m.id, x: hero.x, y: hero.y, amount: Math.round(dmg) });
  if (hero.hp > 0) return;
  hero.hp = 0; hero.down = HERO.downTime; emit({ type: 'ko', id: 'hero', x: hero.x, y: hero.y });
  for (const o of state.world.monsters) if (o.target === 'hero') o.target = null;
  ctx.log('หัวหน้ากิลด์สลบ! ชาวบ้านช่วยกันหามกลับกิลด์', 'warning');
}
function heroStrike(state, ctx, m, dmg, kind) {
  const hero = state.hero, w = state.world;
  m.hp -= dmg; m.target = 'hero';
  emit({ type: 'hit', id: m.id, from: 'hero', x: m.x, y: m.y, fx: hero.x, fy: hero.y, amount: Math.round(dmg), kind, crit: dmg > heroStats(hero.level).power * 1.4 });
  if (m.hp > 0) return;
  m.dead = true; m.respawn = 30 + rand(w) * 20; w.kills++; hero.kills++;
  emit({ type: 'kill', id: m.id, x: m.x, y: m.y, species: m.species });
  ctx.codex?.(m.species);
  const s = statsOf(m.species);
  // What the master takes goes straight to the guild: coins to the coffers, parts to the storehouse.
  const gold = s.gold[0] + Math.floor(rand(w) * (s.gold[1] - s.gold[0] + 1));
  ctx.income(gold, 'หัวหน้ากิลด์ออกล่าเอง');
  const part = MONSTER_PART[m.species];
  if (part && rand(w) < TRADE_RULES.partChance) ctx.storePart?.(part, s.boss ? 5 : 1);
  hero.xp += s.xp;
  while (hero.xp >= heroXpNeeded(hero.level)) {
    hero.xp -= heroXpNeeded(hero.level); hero.level += 1;
    const st = heroStats(hero.level); hero.maxHp = st.maxHp; hero.hp = st.maxHp;
    emit({ type: 'level', id: 'hero', x: hero.x, y: hero.y, level: hero.level });
    ctx.log(`⭐ หัวหน้ากิลด์เลเวลอัปเป็น Lv.${hero.level}!`, 'success');
  }
  if (m.raid || m.boss) ctx.onSpecialKill?.(m, hero);
}
function tickHero(state, ctx, dt) {
  const hero = state.hero; if (!hero?.active) return;
  const input = hero.input || {}, w = state.world;
  hero.atkCd = Math.max(0, hero.atkCd - dt); hero.skillCd = Math.max(0, hero.skillCd - dt); hero.dashCd = Math.max(0, hero.dashCd - dt); hero.dash = Math.max(0, hero.dash - dt);
  if (hero.down > 0) {
    hero.down -= dt;
    if (hero.down <= 0) { const door = ctx.door(); Object.assign(hero, { x: door.x, y: door.y, down: 0, hp: Math.round(hero.maxHp * 0.4) }); emit({ type: 'revive', id: 'hero', x: hero.x, y: hero.y }); }
    return;
  }
  hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * 0.01 * dt);
  const len = Math.hypot(input.dx || 0, input.dy || 0);
  if (input.dash && hero.dashCd <= 0) { hero.dash = HERO.dashTime; hero.dashCd = HERO.dashCd; input.dash = false; emit({ type: 'dash', id: 'hero', x: hero.x, y: hero.y }); }
  if (len > 0.05) { hero.fx = input.dx / len; hero.fy = input.dy / len; }
  const speed = hero.dash > 0 ? HERO.dashSpeed : len > 0.05 ? HERO.speed * Math.min(1, len) : 0;
  if (speed) { hero.x = clamp(hero.x + hero.fx * speed * dt, -60, 80); hero.y = clamp(hero.y + hero.fy * speed * dt, -70, 45); }
  hero.moving = speed > 0;
  const living = w.monsters.filter(m => !m.dead);
  if (input.skill && hero.skillCd <= 0) {
    hero.skillCd = HERO.skillCd; input.skill = false; hero.swing = 0.35;
    emit({ type: 'skill', id: 'hero', x: hero.x, y: hero.y, skill: 'spin', name: 'ฟันหมุนรอบตัว' });
    const power = heroStats(hero.level).power;
    for (const m of living.filter(m => dist(m, hero) < HERO.skillReach)) heroStrike(state, ctx, m, power * 1.6 * (0.9 + rand(w) * 0.2), 'slash');
  } else if (input.attack && hero.atkCd <= 0) {
    hero.atkCd = HERO.atkCd; hero.swing = 0.25;
    emit({ type: 'swing', id: 'hero', x: hero.x, y: hero.y, fx: hero.fx, fy: hero.fy });
    const power = heroStats(hero.level).power;
    // A swing hits whatever is in front, within reach.
    for (const m of living) {
      const dx = m.x - hero.x, dy = m.y - hero.y, d = Math.hypot(dx, dy);
      if (d > HERO.reach || (d > 0.3 && (dx * hero.fx + dy * hero.fy) / d < -0.1)) continue;
      const crit = rand(w) < 0.15;
      heroStrike(state, ctx, m, power * (0.9 + rand(w) * 0.2) * (crit ? 1.7 : 1), 'slash');
    }
  }
  hero.swing = Math.max(0, (hero.swing || 0) - dt);
}
/** Step out of the guild as the master, or go back to the desk. */
export function setHeroActive(state, ctx, on) {
  state.hero ??= createHero();
  const hero = state.hero;
  if (on) { const door = ctx.door(); Object.assign(hero, { active: true, x: door.x, y: door.y + 0.4, down: 0, dash: 0 }); if (hero.hp <= 0) hero.hp = hero.maxHp; }
  else { hero.active = false; hero.input = null; for (const m of state.world.monsters) if (m.target === 'hero') m.target = null; }
  return hero;
}
export function sanitizeHero(data) {
  const h = createHero(); if (!data || typeof data !== 'object') return h;
  const num = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
  h.level = Number.isInteger(data.level) && data.level >= 1 && data.level <= 99 ? data.level : 1;
  const st = heroStats(h.level); h.maxHp = st.maxHp; h.hp = num(data.hp, 0, st.maxHp) ? data.hp : st.maxHp;
  h.xp = num(data.xp, 0, 1e6) ? data.xp : 0; h.kills = Number.isInteger(data.kills) && data.kills >= 0 ? data.kills : 0;
  h.active = Boolean(data.active) && num(data.x, -60, 80) && num(data.y, -70, 45); if (h.active) { h.x = data.x; h.y = data.y; }
  if (num(data.fx, -1, 1) && num(data.fy, -1, 1)) { h.fx = data.fx; h.fy = data.fy; }
  return h;
}

// ---- Quests in real time: every job plays out on the map the way the villager described it. ----
// explore: walk to the site, beat its waves and the boss.   patrol: fight through checkpoints along the trail.
// escort: the wagon really rolls, and stops when ambushed.  defend: raiders are already eating the field when the party arrives.
// gather: members harvest nodes while waves interrupt.      rescue: clear the camp, then walk the survivors home.
const REGION_FOES = { meadow: ['leafSlime', 'hornHare', 'thornling', 'fuzzBee'], ruins: ['pebbleCrab', 'crystalBat', 'acornBeetle', 'mossWolf'], mist: ['mistWisp', 'lanternGhost', 'glowMoth'],
  canyon: ['dustLizard', 'cliffHarpy', 'emberImp'], peak: ['stoneDrake', 'stormRoc', 'magmaTortoise'] };
export const QUEST_FOES = {
  patrol: ['leafSlime', 'hornHare'], herbs: ['thornling', 'fuzzBee'], escort: ['fluffBoar', 'hornHare'], farmraid: ['fieldMole', 'cropGoblin'], pasture: ['mossWolf'],
  bandits: ['roadBandit', 'mossWolf'], crystals: ['pebbleCrab', 'crystalBat'], hollow: ['mushHopper', 'acornBeetle'], ruins: ['pebbleCrab', 'crystalBat', 'marbleGolem'],
  mistpath: ['mistWisp', 'glowMoth'], rescue: ['bindingRoots', 'lanternGhost'], heart: ['glowMoth', 'lanternGhost', 'mistWisp'],
  canyonroad: ['dustLizard', 'cliffHarpy'], harpy: ['cliffHarpy'], emberdig: ['emberImp', 'dustLizard'], wyrm: ['dustLizard', 'emberImp'],
  drakes: ['stoneDrake', 'magmaTortoise'], matriarch: ['stormRoc', 'stoneDrake'], dragon: ['magmaTortoise', 'stoneDrake', 'stormRoc'],
};
export const QUEST_BOSS = { patrol: 'hornHare', herbs: 'thornling', escort: 'fluffBoar', hollow: 'hollowKeeper', crystals: 'marbleGolem', ruins: 'bellGuardian', mistpath: 'mistWisp', rescue: 'bindingRoots', heart: 'heartGuardian',
  farmraid: 'cropGoblin', pasture: 'mossWolf', bandits: 'roadBandit', canyonroad: 'dustLizard', harpy: 'cliffHarpy', emberdig: 'emberImp', wyrm: 'sandWyrm', drakes: 'magmaTortoise', matriarch: 'wyvernMatriarch', dragon: 'emberDragon' };
/** Fields the raiders go for: crops in the wheat field, sheep in the pasture. */
export const DEFEND_FIELDS = { farmraid: { x: -24.5, y: 12.7, r: 2.4, kind: 'crops', name: 'ไร่ข้าวสาลี' }, pasture: { x: -21, y: 29, r: 3, kind: 'flock', name: 'ฝูงแกะ' } };
export const EXPEDITION = { waves: [0.25, 0.3, 0.45], hpPerDifficulty: 5.4, atkPerDifficulty: 0.17, eventWait: 30, bossHp: 1.3, wagonSpeed: .85, gatherTime: 7, defendGap: 22 };
export const CAMP_AT = FRONTIER_CAMP;
const scenarioOf = quest => quest?.scenario || 'explore';
const missionOf = (state, id) => state.missions?.find(x => x.id === id);
/** Send the party out: each member becomes a walker on the world map heading for the quest's site. */
export function startExpedition(state, ctx, mission, quest) {
  const w = state.world, door = ctx.door(), route = siteQuestRoute(door, quest), via = route.slice(1, -1).map(p => [p.x, p.y]), site = SITE_QUEST_SITES[quest.id] || route[route.length - 1];
  const kind = scenarioOf(quest);
  const rt = mission.rt = { kind, stage: 'go', wave: 0, waves: EXPEDITION.waves.length, site: { x: site.x, y: site.y }, at: { x: site.x, y: site.y }, clock: 0, foes: [], back: {} };
  if (kind === 'patrol') {
    // Two checkpoints on the way out, then the site itself.
    const pick = f => route[Math.max(1, Math.min(route.length - 2, Math.round((route.length - 1) * f)))];
    rt.points = [pick(.45), pick(.75), site].map(p => ({ x: p.x, y: p.y })); rt.leg = 0; rt.at = { ...rt.points[0] };
  }
  if (kind === 'escort') {
    const hp = Math.round(120 + quest.difficulty * 3);
    rt.wagon = { x: door.x, y: door.y + .6, hp, maxHp: hp, path: route.slice(1).map(p => ({ x: p.x, y: p.y })), total: 0, done: 0, moving: false };
    for (let i = 1; i < route.length; i++) rt.wagon.total += dist(route[i - 1], route[i]);
    // Ambushes wait until the wagon has left the village behind, then spread over the rest of the road.
    const out = Math.min(.5, 20 / Math.max(1, rt.wagon.total));
    rt.ambush = [.25, .6, .92].map(f => out + (1 - out) * f); rt.stage = 'escort';
  }
  if (kind === 'defend') {
    const field = DEFEND_FIELDS[quest.id] || { x: site.x, y: site.y - 2.5, r: 2.4, kind: 'crops', name: 'ไร่' };
    rt.field = { ...field }; rt.crops = 100; rt.at = { x: field.x, y: field.y }; rt.nextWave = EXPEDITION.defendGap;
    spawnWave(state, mission, quest);
  }
  if (kind === 'gather') {
    rt.nodes = Array.from({ length: 4 }, (_, i) => { const a = i / 4 * Math.PI * 2 + .4; return { x: site.x + Math.cos(a) * 1.8, y: site.y + Math.sin(a) * 1.3, progress: 0 }; });
  }
  for (const id of mission.memberIds) {
    const member = state.members.find(m => m.id === id); if (!member) continue;
    const st = ctx.stats(member), first = rt.points?.[0] || site, spot = { x: first.x - 1.2 + rand(w) * 1.2, y: first.y + (rand(w) - .5) * 1.4 };
    const legVia = kind === 'patrol' ? route.slice(1, route.indexOf(route.find(p => p.x === first.x && p.y === first.y)) + 0).map(p => ({ x: p.x, y: p.y })) : via.map(([x, y]) => ({ x, y }));
    w.hunters = w.hunters.filter(h => h.id !== id);
    w.hunters.push({ id, kind: 'member', zone: 'q:' + mission.id, party: mission.id, mission: mission.id, via, mode: kind === 'escort' ? 'hunt' : 'go', x: door.x + (rand(w) - .5) * .4, y: door.y + (rand(w) - .5) * .4,
      path: kind === 'escort' ? [] : [...legVia, spot], hp: st.health, maxHp: st.health, power: st.basePower, cls: rootOf(member.class), job: member.class, atkCd: rand(w), skillCd: 3 + rand(w) * 4, guard: 0, target: null, carrying: null, carriedBy: null,
      bag: { gold: 0, herb: 0, wood: 0, stone: 0, kills: 0, merit: 0, parts: {}, treasures: [] }, quota: 999 });
  }
}
/** A wave of the quest's foes around `at` (the site, a checkpoint, the wagon or the field). */
function spawnWave(state, mission, quest) {
  const w = state.world, rt = mission.rt, last = rt.wave === rt.waves - 1, pool = QUEST_FOES[quest.id] || REGION_FOES[quest.region] || REGION_FOES.meadow;
  const big = mission.memberIds.length > 3 ? mission.memberIds.length / 3 : 1;
  const share = EXPEDITION.waves[rt.wave], total = quest.difficulty * EXPEDITION.hpPerDifficulty * share, atk = quest.difficulty * EXPEDITION.atkPerDifficulty / Math.sqrt(big);
  const count = Math.round((rt.wave + 2) * Math.min(1.6, big));
  const bossHp = total * 0.75 * EXPEDITION.bossHp * (quest.raid ? 1.4 : 1);
  const foes = last ? [{ species: QUEST_BOSS[quest.id] || pool[0], hp: bossHp, boss: true }, ...Array.from({ length: Math.max(1, count - 2) }, (_, i) => ({ species: pool[(i + 1) % pool.length], hp: total * 0.25 / Math.max(1, count - 2) }))]
    : Array.from({ length: count }, (_, i) => ({ species: pool[(rt.wave + i) % pool.length], hp: total / count }));
  let at = rt.at, goal = null;
  if (rt.kind === 'escort') { const wg = rt.wagon, ahead = wg.path[0] || wg, dx = ahead.x - wg.x, dy = ahead.y - wg.y, d = Math.hypot(dx, dy) || 1; at = { x: wg.x + dx / d * 3.2, y: wg.y + dy / d * 3.2 }; goal = 'wagon'; }
  if (rt.kind === 'defend') { const f = rt.field; at = { x: f.x - f.r - 1.6, y: f.y - f.r * .6 }; goal = 'field'; }
  rt.foes = [];
  foes.forEach((f, i) => {
    const a = i / foes.length * Math.PI * 1.4 - .7, p = { x: at.x + 1.6 * Math.cos(a) + (rt.kind === 'explore' || rt.kind === 'patrol' ? 1.2 : 0), y: at.y + 1.1 * Math.sin(a) };
    const m = spawnMonster(w, f.species, 'q:' + mission.id, p, { quest: mission.id, hp: Math.round(f.hp), maxHp: Math.round(f.hp), atk: Math.round(atk * (f.boss ? 1.6 : 1) * 10) / 10, questBoss: Boolean(f.boss), goal });
    w.monsters.push(m); rt.foes.push(m.id);
  });
  emit({ type: last ? 'questBoss' : 'questWave', id: mission.id, x: at.x, y: at.y, wave: rt.wave + 1, scenario: rt.kind });
}
/** What a quest member does when nothing is attacking: follow the wagon, guard the field, gather, or hold the site. */
function missionIdle(state, h, dt) {
  const ms = missionOf(state, h.mission), rt = ms?.rt; if (!rt) return;
  const slot = (parseInt(String(h.id).replace(/\D/g, ''), 10) || 0) % 4, off = [[-.9, -.5], [.9, -.5], [-.9, .6], [.9, .6]][slot];
  if (rt.kind === 'escort' && rt.wagon) { const p = { x: rt.wagon.x + off[0], y: rt.wagon.y + off[1] }; if (dist(h, p) > .25) moveTo(h, p, WALK * 1.1, dt); return; }
  if (rt.kind === 'gather' && rt.stage === 'gather') {
    const node = rt.nodes.filter(n => n.progress < 1).sort((a, b) => dist(a, h) - dist(b, h))[0];
    if (node) { if (dist(h, node) > .55) moveTo(h, node, WALK, dt); else { node.progress = Math.min(1, node.progress + dt / EXPEDITION.gatherTime); h.gatherCd = (h.gatherCd || 0) - dt; if (h.gatherCd <= 0) { h.gatherCd = 1.1; emit({ type: 'gather', id: h.id, x: node.x, y: node.y, done: node.progress >= 1 }); } } return; }
  }
  if (rt.kind === 'defend' && rt.field) { const p = { x: rt.field.x + off[0] * 1.6, y: rt.field.y + off[1] * 1.6 }; if (dist(h, p) > .3) moveTo(h, p, WALK, dt); return; }
  const site = rt.at || rt.site; if (site && dist(h, site) > 1.6) moveTo(h, { x: site.x - .6, y: site.y }, WALK, dt);
}
/** Send the standing members on to the next checkpoint of a patrol. */
function nextLeg(state, mission) {
  const rt = mission.rt, w = state.world, to = rt.points[rt.leg];
  rt.at = { ...to };
  for (const h of w.hunters.filter(o => o.party === mission.id && o.mode === 'hunt')) { h.mode = 'go'; h.target = null; h.path = [{ x: to.x - 1 + rand(w), y: to.y + (rand(w) - .5) * 1.2 }]; }
}
function tickExpeditions(state, ctx, dt) {
  const w = state.world;
  for (const mission of state.missions || []) {
    const rt = mission.rt; if (!rt || mission.status !== 'active' || rt.stage === 'done') continue;
    rt.kind ??= 'explore';
    const quest = ctx.quest(mission.questId), party = w.hunters.filter(h => h.party === mission.id), standing = party.filter(h => !['down', 'carried'].includes(h.mode));
    rt.clock += dt;
    const foesLeft = w.monsters.filter(m => m.quest === mission.id && !m.dead);
    const fail = text => { rt.stage = 'return'; rt.won = false; w.monsters = w.monsters.filter(m => m.quest !== mission.id); startReturn(state, ctx, mission.id); if (text) ctx.log(text, 'warning'); };
    const clearWave = () => {
      rt.wave += 1;
      if (rt.wave >= rt.waves) { rt.stage = 'return'; rt.won = true; startReturn(state, ctx, mission.id); emit({ type: 'questClear', id: mission.id, x: rt.at.x, y: rt.at.y });
        if (rt.kind === 'rescue') rt.npcs = [0, 1].map(i => ({ x: rt.site.x + .6 * i, y: rt.site.y + .4, follow: standing[i % Math.max(1, standing.length)]?.id || null })); return true; }
      return false;
    };
    if (rt.stage !== 'return' && !standing.length) {
      // Everyone is down: the foes wander off and the porters bring the party home.
      rt.stage = 'return'; rt.won = false; w.monsters = w.monsters.filter(m => m.quest !== mission.id);
      ctx.log(`ทีม${quest.name}ล้มหมดทั้งทีม! คนแบกเปลออกไปรับกลับบ้าน`, 'warning');
    } else if (rt.kind === 'escort') {
      const wg = rt.wagon;
      if (rt.stage === 'escort') {
        if (wg.hp <= 0) fail(`เกวียนของ${quest.name}พังกลางทาง! ทีมต้องถอยกลับ`);
        else {
          const progress = wg.done / Math.max(1, wg.total), arrived = !wg.path.length;
          if (!foesLeft.length) {
            if (rt.ambushed) { rt.ambushed = false; rt.wave += 1; }
            else if (rt.wave < rt.waves && (progress >= rt.ambush[rt.wave] || arrived)) { rt.ambushed = true; spawnWave(state, mission, quest); }
            else if (arrived) { rt.stage = 'return'; rt.won = true; rt.at = { x: wg.x, y: wg.y }; emit({ type: 'questClear', id: mission.id, x: wg.x, y: wg.y }); startReturn(state, ctx, mission.id); }
          }
          wg.moving = !rt.ambushed && !arrived && rt.stage === 'escort' && standing.every(h => dist(h, wg) < 4.2);
          if (wg.moving) { const before = { x: wg.x, y: wg.y }; walkPath(wg, EXPEDITION.wagonSpeed, dt); wg.done += dist(before, wg); }
        }
      }
    } else if (rt.kind === 'defend' && rt.stage !== 'return') {
      // Raiders standing in the field eat it; the party must chase them out before nothing is left.
      const eating = foesLeft.filter(m => dist(m, rt.field) < rt.field.r + .4 && !m.fighting);
      rt.crops = Math.max(0, rt.crops - eating.length * dt * (rt.field.kind === 'flock' ? .55 : .7));
      if (rt.stage === 'go' && standing.some(h => h.mode === 'hunt')) rt.stage = 'fight';
      rt.nextWave -= dt;
      if (rt.crops <= 0) fail(`${rt.field.name}ถูกกินจนหมด! ทีม${quest.name}ไม่ทัน`);
      else if (!foesLeft.length) { if (rt.wave === rt.waves - 1) clearWave(); else { rt.wave += 1; rt.nextWave = EXPEDITION.defendGap; spawnWave(state, mission, quest); } }
      else if (rt.nextWave <= 0 && rt.wave < rt.waves - 1) { rt.wave += 1; rt.nextWave = EXPEDITION.defendGap; spawnWave(state, mission, quest); }
    } else if (rt.stage === 'go') {
      if (standing.every(h => h.mode === 'hunt')) {
        if (rt.kind === 'gather') { rt.stage = 'gather'; spawnWave(state, mission, quest); }
        else { rt.stage = 'fight'; spawnWave(state, mission, quest); }
      }
    } else if (rt.stage === 'gather') {
      const done = rt.nodes.reduce((sum, n) => sum + n.progress, 0) / rt.nodes.length;
      if (!foesLeft.length) { if (rt.wave === rt.waves - 1) clearWave(); else if (done >= (rt.wave + 1) / (rt.waves - 1) - 1e-6) { rt.wave += 1; spawnWave(state, mission, quest); } }
    } else if (rt.stage === 'fight' && !foesLeft.length) {
      if (rt.kind === 'patrol' && rt.leg < rt.points.length - 1) {
        rt.wave += 1; rt.leg += 1;
        if (rt.leg === rt.points.length - 1 && ctx.needsEvent(mission) && !mission.eventDone) { mission.eventDone = true; ctx.missionEvent(mission); rt.stage = 'event'; rt.eventAt = rt.clock; rt.afterEvent = 'leg'; }
        else { rt.stage = 'go'; nextLeg(state, mission); }
      }
      else if (rt.wave + 1 >= rt.waves) clearWave();
      else if (rt.wave + 1 === rt.waves - 1 && ctx.needsEvent(mission) && !mission.eventDone) { rt.wave += 1; mission.eventDone = true; ctx.missionEvent(mission); rt.stage = 'event'; rt.eventAt = rt.clock; }
      else { rt.wave += 1; spawnWave(state, mission, quest); }
    } else if (rt.stage === 'event' && (mission.event?.resolved || rt.clock - rt.eventAt > EXPEDITION.eventWait)) {
      if (rt.afterEvent === 'leg') { rt.afterEvent = null; rt.stage = 'go'; nextLeg(state, mission); }
      else { rt.stage = 'fight'; spawnWave(state, mission, quest); }
    }
    // The frontier camp patches up any quest party passing by.
    if (ctx.campLevel?.() > 0) for (const h of standing) if (dist(h, CAMP_AT) < 3.2 && h.hp < h.maxHp) { h.hp = Math.min(h.maxHp, h.hp + h.maxHp * .04 * ctx.campLevel() * dt); }
    // Rescued explorers walk home beside the friend who found them.
    if (rt.npcs) for (const n of rt.npcs) { const f = w.hunters.find(o => o.id === n.follow) || party[0]; if (f) moveTo(n, { x: f.x - .5, y: f.y + .4 }, WALK * 1.05, dt); }
    // Progress for the guild's screens: out, each wave, then home.
    const waveDone = foesLeft.length ? 1 - foesLeft.reduce((s, m) => s + m.hp, 0) / Math.max(1, foesLeft.reduce((s, m) => s + m.maxHp, 0)) : 0;
    const out = rt.stage === 'go' ? standing.reduce((s, h) => s + (h.mode === 'hunt' ? 1 : 1 - h.path.length / Math.max(1, h.via.length + 1)), 0) / Math.max(1, standing.length) : 1;
    const back = rt.stage === 'return' ? 1 - party.length / Math.max(1, mission.memberIds.length) : 0;
    const work = rt.kind === 'escort' ? rt.wagon.done / Math.max(1, rt.wagon.total) : rt.kind === 'gather' ? (rt.nodes.reduce((s, n) => s + n.progress, 0) / rt.nodes.length) * .7 + (rt.wave / rt.waves) * .3 : (rt.wave + waveDone) / rt.waves;
    mission.progress = mission.duration * Math.min(0.99, rt.stage === 'return' ? 0.85 + 0.14 * back : rt.kind === 'escort' ? 0.05 + 0.8 * work : rt.stage === 'go' && rt.kind !== 'patrol' ? 0.2 * out : 0.2 + 0.65 * work);
    mission.phase = rt.stage === 'return' ? 'return' : (rt.stage === 'go' && !foesLeft.length) || (rt.kind === 'escort' && rt.wagon.moving) ? 'travel' : 'battle';
    mission.combat.partyHp = Math.round(party.reduce((s, h) => s + Math.max(0, h.hp), 0)); mission.combat.partyMaxHp = Math.round(party.reduce((s, h) => s + h.maxHp, 0)) || mission.combat.partyMaxHp;
    mission.combat.enemyHp = Math.round(foesLeft.reduce((s, m) => s + m.hp, 0)); mission.combat.enemyMaxHp = Math.round(foesLeft.reduce((s, m) => s + m.maxHp, 0)) || 1; mission.combat.wave = Math.min(rt.waves, rt.wave + 1);
    if (rt.stage === 'return' && !party.length) { rt.stage = 'done'; rt.npcs = null; ctx.finishMission(mission, rt.won); }
  }
}
/** Call a quest party home early (the player recalled it). */
export function recallExpedition(state, ctx, mission) {
  state.world.monsters = state.world.monsters.filter(m => m.quest !== mission.id);
  startReturn(state, ctx, mission.id);
  if (mission.rt) { mission.rt.stage = 'return'; mission.rt.won = false; }
}
