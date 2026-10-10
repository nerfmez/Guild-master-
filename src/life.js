/* The living world: adventurers (guild members and free adventurers) walk out to hunting grounds,
   fight monsters in real time, carry fallen friends home, and sell their loot in the village.
   Pure simulation: game.js calls tickLife with a small context of its own helpers. */
import { HUNT_ZONES, MONSTER_STATS, CLASS_COMBAT, HUNT_ECONOMY, ADVENTURER_RANKS, JOBS, ROOKIE_NAMES, TRAIT_NAMES, HAIR_COLORS, ROOKIE_LINES } from './content.js';

const SUB = 0.25;          // seconds per combat step
const WALK = 1.7;          // tiles per second
const CARRY = 1.15;
const PORTER = 2.1;
const AGGRO = 3.2, LEASH = 9;
export const INN = { x: -2.2, y: 11.2 };
const TOWN_SPOTS = [[-2.2, 11.6], [-1, 12.4], [-6.5, 15.6], [3.5, 16.2], [8, 16.4], [14, 16.3], [22, 16.2], [-4, 16.8], [24.5, 16.4]];
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rankIdx = r => ADVENTURER_RANKS.indexOf(r || 'F');
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
function pointIn(w, zone, spread = 1) { const a = rand(w) * Math.PI * 2, d = Math.sqrt(rand(w)) * zone.r * spread; return { x: zone.x + Math.cos(a) * d, y: zone.y + Math.sin(a) * d * .8 }; }

/** Keep every open hunting ground stocked; fallen monsters return after a while. */
function stockZones(state, ctx, step) {
  const w = state.world;
  for (const [zoneId, zone] of Object.entries(HUNT_ZONES)) {
    if (!ctx.zoneOpen(zone)) continue;
    const living = w.monsters.filter(m => m.zone === zoneId && !m.raid && !m.boss);
    for (const m of living) if (m.dead) { m.respawn -= step; if (m.respawn <= 0) { const p = pointIn(w, zone); Object.assign(m, { dead: false, hp: m.maxHp, x: p.x, y: p.y, hx: p.x, hy: p.y, target: null }); } }
    for (let i = living.length; i < zone.count; i++) w.monsters.push(spawnMonster(w, pick(w, zone.species), zoneId, pointIn(w, zone)));
  }
}
export function spawnMonster(w, species, zone, p, extra = {}) {
  const s = MONSTER_STATS[species];
  return { id: `mon-${w.nextId++}`, species, zone, x: p.x, y: p.y, hx: p.x, hy: p.y, hp: s.hp, maxHp: s.hp, cd: rand(w) * s.rate, target: null, dead: false, respawn: 0, wait: rand(w) * 4, tx: p.x, ty: p.y, ...extra };
}

// ---- Free adventurers: they live at the inn, hunt on their own and spend in the village. ----
export function freeLevelRank(level) { return level >= 9 ? 'C' : level >= 6 ? 'D' : level >= 3 ? 'E' : 'F'; }
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

// ---- Departures ----
function chooseZone(ctx, rank, power) {
  const zones = Object.entries(HUNT_ZONES).filter(([, z]) => ctx.zoneOpen(z) && rankIdx(z.rank) <= rankIdx(rank) + 1);
  // The hardest ground they can handle: a zone a rank above needs a strong adventurer.
  const fit = zones.filter(([, z]) => rankIdx(z.rank) <= rankIdx(rank) || power >= 34 + rankIdx(z.rank) * 18);
  return (fit.length ? fit : zones).sort((a, b) => rankIdx(b[1].rank) - rankIdx(a[1].rank))[0]?.[0] || null;
}
function makeHunter(state, ctx, who, kind, zoneId, party, start) {
  const zone = HUNT_ZONES[zoneId], stats = kind === 'member' ? ctx.stats(who) : freeStats(who), w = state.world;
  const path = [...zone.via.map(([x, y]) => ({ x, y })), pointIn(w, zone, .6)];
  return { id: who.id, kind, zone: zoneId, party, mode: 'go', x: start.x + (rand(w) - .5) * .4, y: start.y + (rand(w) - .5) * .4, path, hp: stats.health, maxHp: stats.health,
    power: stats.basePower, cls: rootOf(who.class), atkCd: rand(w), skillCd: 3 + rand(w) * 4, guard: 0, target: null, carrying: null, carriedBy: null,
    bag: { gold: 0, herb: 0, wood: 0, stone: 0, kills: 0, merit: 0 }, quota: 7 + Math.floor(rand(w) * 4) };
}
export function freeStats(f) {
  const job = JOBS[f.class], power = (job.power + (f.level - 1) * 2.7 + 4) * ({ F: 1, E: 1.04, D: 1.08, C: 1.13 }[f.rank] || 1);
  return { basePower: Math.round(power), health: Math.round(job.health + (f.level - 1) * 8), role: job.role };
}
function departures(state, ctx) {
  const w = state.world;
  // Guild members with nothing to do head out in small parties.
  const ready = state.members.filter(m => ctx.freeToHunt(m));
  while (ready.length) {
    const lead = ready.shift(), lp = ctx.stats(lead), zone = chooseZone(ctx, lead.rank, lp.basePower);
    if (!zone || rand(w) > 0.45) continue;
    const mates = ready.filter(m => chooseZone(ctx, m.rank, ctx.stats(m).basePower) === zone).sort((a, b) => ctx.bond(lead.id, b.id) - ctx.bond(lead.id, a.id)).slice(0, rand(w) < .35 ? 0 : 2);
    mates.forEach(m => ready.splice(ready.indexOf(m), 1));
    const party = `pt-${w.nextId++}`, door = ctx.door();
    for (const m of [lead, ...mates]) { m.task = 'rest'; w.hunters.push(makeHunter(state, ctx, m, 'member', zone, party, door)); }
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
  const zone = HUNT_ZONES[h.zone], back = [...zone.via].reverse().map(([x, y]) => ({ x, y }));
  return [...back, h.kind === 'member' ? ctx.door() : { ...INN }];
}
function startReturn(state, ctx, partyId) {
  for (const h of state.world.hunters) if (h.party === partyId && ['go', 'hunt'].includes(h.mode)) { h.mode = 'return'; h.target = null; h.path = homeRoute(h, ctx); }
}
function hitMonster(state, ctx, h, m, dmg, kind) {
  m.hp -= dmg; m.target ??= h.id;
  emit({ type: 'hit', x: m.x, y: m.y, amount: Math.round(dmg), kind, crit: dmg > h.power * .6 });
  if (m.hp > 0) return;
  m.dead = true; m.respawn = 30 + rand(state.world) * 20; state.world.kills++;
  emit({ type: 'kill', x: m.x, y: m.y, species: m.species });
  const s = MONSTER_STATS[m.species], party = state.world.hunters.filter(o => o.party === h.party && o.mode === 'hunt' && dist(o, m) < 9);
  h.bag.gold += s.gold[0] + Math.floor(rand(state.world) * (s.gold[1] - s.gold[0] + 1));
  if (rand(state.world) < .7) h.bag[s.mat] += 1 + (s.boss ? 4 : 0);
  h.bag.kills += 1;
  for (const o of party) {
    const who = o.kind === 'member' ? state.members.find(x => x.id === o.id) : state.world.free.find(x => x.id === o.id);
    if (!who) continue;
    const share = Math.round(s.xp * (party.length > 1 ? .7 : 1));
    if (o.kind === 'member') { ctx.addXp(who, share); const gap = rankIdx(HUNT_ZONES[o.zone]?.rank || 'F') - rankIdx(who.rank); o.bag.merit += gap >= 1 ? 2 : gap === 0 ? 1 : .3; }
    else freeXp(ctx, who, share);
  }
  if (m.raid || m.boss) ctx.onSpecialKill?.(m, h);
}
function freeXp(ctx, f, amount) {
  f.xp += amount;
  while (f.level < 20 && f.xp >= ctx.xpNeeded(f.level)) { f.xp -= ctx.xpNeeded(f.level); f.level += 1; f.rank = freeLevelRank(f.level); }
}
function fight(state, ctx, h, dt) {
  const w = state.world, cc = CLASS_COMBAT[h.cls] || CLASS_COMBAT.warrior, party = w.hunters.filter(o => o.party === h.party && o.mode !== 'down' && o.mode !== 'carried');
  h.atkCd -= dt; h.skillCd -= dt; h.guard = Math.max(0, h.guard - dt);
  const near = w.monsters.filter(m => !m.dead && (h.zone === m.zone || m.raid || m.boss) && dist(h, m) < (m.raid ? 14 : 11));
  // Healers mend the most hurt friend first.
  if (h.cls === 'healer') {
    const hurt = party.filter(o => o.hp < o.maxHp * .75 && dist(o, h) < cc.reach + 1).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (h.skillCd <= 0 && party.filter(o => o.hp < o.maxHp * .6).length >= 2) {
      for (const o of party) { const amt = o.maxHp * .35; o.hp = Math.min(o.maxHp, o.hp + amt); emit({ type: 'heal', x: o.x, y: o.y, amount: Math.round(amt) }); }
      emit({ type: 'skill', x: h.x, y: h.y, skill: 'blessing', name: cc.skillName }); h.skillCd = cc.skillCd; return;
    }
    if (hurt && h.atkCd <= 0) { const amt = h.power * .9; hurt.hp = Math.min(hurt.maxHp, hurt.hp + amt); emit({ type: 'heal', x: hurt.x, y: hurt.y, amount: Math.round(amt) }); h.atkCd = cc.rate; return; }
  }
  let m = near.find(x => x.id === h.target);
  if (!m) {
    const taken = id => w.hunters.filter(o => o.target === id && o.party !== h.party).length;
    m = near.filter(x => taken(x.id) < 2).sort((a, b) => dist(h, a) - dist(h, b))[0];
    h.target = m?.id || null;
  }
  if (!m) { if (h.mode === 'defend') return; if (!h.wander || dist(h, h.wander) < .2) h.wander = pointIn(w, HUNT_ZONES[h.zone] || { x: h.x, y: h.y, r: 2 }, .7); moveTo(h, h.wander, WALK * .6, dt); return; }
  if (dist(h, m) > cc.reach) { moveTo(h, { x: m.x + (h.x > m.x ? .4 : -.4), y: m.y }, WALK, dt); return; }
  if (h.skillCd <= 0) {
    h.skillCd = cc.skillCd;
    emit({ type: 'skill', x: h.x, y: h.y, tx: m.x, ty: m.y, skill: cc.skill, name: cc.skillName });
    if (cc.skill === 'guard') { h.guard = 5; for (const x of near.filter(x => dist(x, h) < 4)) x.target = h.id; }
    else if (cc.skill === 'volley') for (const x of near.filter(x => dist(x, h) < cc.reach + .5).slice(0, 3)) hitMonster(state, ctx, h, x, h.power * .45 * cc.dmg * 1.2, 'arrow');
    else if (cc.skill === 'fireball') for (const x of near.filter(x => dist(x, m) < 1.6)) hitMonster(state, ctx, h, x, h.power * .45 * cc.dmg * 1.8, 'fire');
    else if (cc.skill === 'blessing') for (const o of party) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * .25);
    return;
  }
  if (h.atkCd <= 0) {
    h.atkCd = cc.rate;
    const crit = rand(w) < .1, dmg = h.power * .45 * cc.dmg * (.85 + rand(w) * .3) * (crit ? 1.6 : 1);
    hitMonster(state, ctx, h, m, dmg, h.cls === 'archer' ? 'arrow' : h.cls === 'mage' ? 'magic' : h.cls === 'healer' ? 'light' : 'slash');
  }
}
function monsterAct(state, ctx, m, dt) {
  const w = state.world, s = MONSTER_STATS[m.species];
  const targets = w.hunters.filter(h => ['hunt', 'go', 'return', 'carry', 'defend'].includes(h.mode));
  let t = targets.find(h => h.id === m.target);
  if (!t || dist(t, m) > LEASH || (!m.raid && Math.hypot(m.x - m.hx, m.y - m.hy) > LEASH)) {
    const guards = targets.filter(h => h.guard > 0 && dist(h, m) < 4);
    t = guards[0] || targets.filter(h => dist(h, m) < AGGRO).sort((a, b) => dist(a, m) - dist(b, m))[0] || null;
    m.target = t?.id || null;
  }
  if (!t) {
    if (m.raid) { moveTo(m, ctx.door(), s.speed || .6, dt); if (dist(m, ctx.door()) < 1.2) ctx.onRaidReach?.(m); return; }
    if (!s.speed) return;
    if ((m.wait -= dt) <= 0 && Math.hypot(m.tx - m.x, m.ty - m.y) < .1) { const a = rand(w) * Math.PI * 2, d = rand(w) * 2.5; m.tx = m.hx + Math.cos(a) * d; m.ty = m.hy + Math.sin(a) * d * .8; m.wait = 2 + rand(w) * 5; }
    moveTo(m, { x: m.tx, y: m.ty }, s.speed * .5, dt); m.hp = Math.min(m.maxHp, m.hp + m.maxHp * .02 * dt); return;
  }
  if (dist(t, m) > s.reach) { if (s.speed) moveTo(m, t, s.speed, dt); return; }
  m.cd -= dt;
  if (m.cd > 0) return;
  m.cd = s.rate;
  const dmg = s.atk * (.85 + rand(w) * .3) * (t.guard > 0 ? .6 : 1);
  t.hp -= dmg; emit({ type: 'hurt', x: t.x, y: t.y, amount: Math.round(dmg) });
  if (t.hp <= 0) knockOut(state, ctx, t);
}
function knockOut(state, ctx, h) {
  const w = state.world;
  if (h.carrying) { const c = w.hunters.find(o => o.id === h.carrying); if (c) c.carriedBy = null; h.carrying = null; }
  h.hp = 0; h.mode = 'down'; h.target = null; h.path = [];
  emit({ type: 'ko', x: h.x, y: h.y });
  for (const m of w.monsters) if (m.target === h.id) m.target = null;
  const name = h.kind === 'member' ? state.members.find(m => m.id === h.id)?.name : w.free.find(f => f.id === h.id)?.name;
  if (h.kind === 'member') ctx.log(`${name}สลบที่${HUNT_ZONES[h.zone]?.name || 'นอกเมือง'}!`, 'warning');
  startReturn(state, ctx, h.party);
}
/** A conscious friend picks up the fallen; with nobody left, porters set out from the guild. */
function arrangeCarry(state, ctx) {
  const w = state.world;
  for (const down of w.hunters.filter(h => h.mode === 'down' && !h.carriedBy)) {
    const friend = w.hunters.filter(o => o.party === down.party && ['return', 'hunt', 'go', 'defend'].includes(o.mode) && !o.carrying && o.hp > 0).sort((a, b) => dist(a, down) - dist(b, down))[0];
    if (friend) { friend.carrying = down.id; friend.mode = 'carry'; friend.path = [{ x: down.x, y: down.y }, ...homeRoute(friend, ctx)]; down.carriedBy = friend.id; down.mode = 'carried'; continue; }
    if (down.kind === 'member' && !w.porters.some(p => p.target === down.id)) {
      const door = ctx.door();
      w.porters.push({ id: `por-${w.nextId++}`, target: down.id, x: door.x, y: door.y, path: [...(down.party.startsWith('pt-defend') ? [] : HUNT_ZONES[down.zone].via.map(([x, y]) => ({ x, y }))), { x: down.x, y: down.y }], mode: 'go' });
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
    if (p.mode === 'go') { if (walkPath(p, PORTER, dt)) { p.mode = 'back'; p.path = (down.party.startsWith('pt-defend') ? [] : [...HUNT_ZONES[down.zone].via].reverse().map(([x, y]) => ({ x, y }))).concat([p.inn ? { ...INN } : ctx.door()]); down.mode = 'carried'; down.carriedBy = p.id; } }
    else { const done = walkPath(p, CARRY, dt); down.x = p.x; down.y = p.y; if (done) { arriveHome(state, ctx, down); w.porters = w.porters.filter(o => o !== p); } }
  }
}
/** Home again: sell the loot (the guild takes its share), the fallen go to bed. */
function arriveHome(state, ctx, h) {
  const w = state.world, bag = h.bag, mats = ['herb', 'wood', 'stone'];
  const matValue = mats.reduce((sum, k) => sum + bag[k] * ctx.price(k) * HUNT_ECONOMY.matPrice, 0), income = Math.floor(bag.gold + matValue);
  for (const k of mats) if (bag[k]) ctx.marketAdd(k, bag[k]);
  const who = h.kind === 'member' ? state.members.find(m => m.id === h.id) : w.free.find(f => f.id === h.id);
  if (who) {
    const share = h.kind === 'member' ? HUNT_ECONOMY.guildCut : HUNT_ECONOMY.marketFee;
    const guild = Math.floor(income * share);
    who.purse = (who.purse || 0) + income - guild;
    if (guild > 0) ctx.income(guild, h.kind === 'member' ? 'ส่วนแบ่งการล่าของสมาชิก' : 'ค่าธรรมเนียมจุดรับซื้อของ');
    ctx.prosperity(income * .05);
    if (h.kind === 'member') {
      who.points = (who.points || 0) + Math.round(bag.merit);
      who.energy = clamp(who.energy - 8, 0, 100);
      if (h.mode === 'carried' || h.hp <= 0) { who.injury = clamp((who.injury || 0) + 30, 0, 100); who.morale = clamp(who.morale - 6, 0, 100); ctx.log(`${who.name}ถูกหามกลับถึงกิลด์ ต้องพักรักษาตัว`, 'warning'); }
      else if (bag.kills) ctx.log(`${who.name}กลับจาก${HUNT_ZONES[h.zone].name} ล่าได้ ${bag.kills} ตัว ขายของได้ ${income} G (กิลด์ได้ ${guild} G)`, 'hunt');
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
    if (h.mode === 'go') { if (walkPath(h, WALK, dt)) h.mode = 'hunt'; continue; }
    if (h.mode === 'return' || h.mode === 'carry') { if (walkPath(h, h.mode === 'carry' ? CARRY : WALK, dt)) arriveHome(state, ctx, h); continue; }
    if (h.mode === 'defend' || h.mode === 'hunt') {
      // A potion when badly hurt; leave when the bag is full, tired, or still hurting with no potion.
      if (h.hp < h.maxHp * .35) {
        if (h.kind === 'member' && who.pack?.potion > 0) { who.pack.potion -= 1; h.hp = Math.min(h.maxHp, h.hp + h.maxHp * .5); emit({ type: 'heal', x: h.x, y: h.y, amount: Math.round(h.maxHp * .5), potion: true }); }
        else if (h.kind === 'free' && who.potions > 0) { who.potions -= 1; h.hp = Math.min(h.maxHp, h.hp + h.maxHp * .5); emit({ type: 'heal', x: h.x, y: h.y, amount: Math.round(h.maxHp * .5), potion: true }); }
        else if (h.mode === 'hunt') { startReturn(state, ctx, h.party); continue; }
      }
      if (h.mode === 'hunt' && (h.bag.kills >= h.quota || who.energy < 30)) { startReturn(state, ctx, h.party); continue; }
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
    w.departClock -= dt;
    if (w.departClock <= 0) { w.departClock = 3; departures(state, ctx); }
    stepHunters(state, ctx, dt);
    for (const m of w.monsters) if (!m.dead) monsterAct(state, ctx, m, dt);
    w.monsters = w.monsters.filter(m => !(m.dead && (m.raid || m.boss)));
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
export function worldRandom(state) { return rand(state.world); }
export { pointIn };
