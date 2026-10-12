/* The village grows its own paths: each new building gets a footpath from its door to the nearest road,
   winding around whatever stands in the way and joining paths that are already there. Paths start as
   trodden trails and wear into dirt roads, and into cobbles once the village is a town.
   Pure logic: grid units only, no drawing. */
import { VILLAGE_LOTS, VILLAGE_BUSINESSES, BUILDING_FOOTPRINTS, BUILDING_STAGES, FACILITIES, HOUSE_TIERS, HOME_NEEDS, HOUSE_UPGRADES } from './content.js';
import { buildingRect, WORLD_PATHS, SITE_COTTAGES, SITE_TREES, siteRoads, siteDecorations } from './site.js';

const RES = 0.5;
const lotOf = (state, key) => state.village?.lots?.[key] || (key[0] === 'h' ? VILLAGE_LOTS.houses[+key.slice(1)] : VILLAGE_LOTS[key]);
/** Every village building standing now, as rectangles in grid units. */
export function villageBuildings(state) {
  const v = state.village || {}, out = [];
  const add = (key, kind) => { const at = lotOf(state, key); if (!at) return; const [fw, fh] = BUILDING_FOOTPRINTS[kind], rot = at.rot === 1 ? 1 : 0; out.push({ key, kind, x: at.x, y: at.y, w: rot ? fh : fw, h: rot ? fw : fh, rot }); };
  for (let i = 0; i < Math.min(v.houses || 0, VILLAGE_LOTS.houses.length); i++) add('h' + i, 'house');
  for (const id of VILLAGE_BUSINESSES) if (v[id] > 0) add(id, id);
  return out;
}
/** Buildings can turn: rot 0 faces their door south-west (+y), rot 1 south-east (+x); the art is mirrored. */
export const ROTATABLE = key => key[0] === 'h' || !['market', 'arena'].includes(key);
export const footprintOf = (kind, rot) => { const [w, h] = BUILDING_FOOTPRINTS[kind] || BUILDING_FOOTPRINTS.house; return rot === 1 ? [h, w] : [w, h]; };
export const doorOf = b => b.rot === 1 ? { x: b.x + b.w + 0.5, y: b.y + b.h / 2 } : { x: b.x + b.w / 2, y: b.y + b.h + 0.5 };

/** The roads a new path may join: village streets, world trails and paths grown earlier. */
function network(state, except) {
  const b = buildingRect(state), door = b.x + b.w / 2;
  const lines = [[[-12, 17.5], [42, 17.5]], [[2, -12], [2, 17.5]], [[door, b.y + b.h], [door, 17.5]], ...Object.values(WORLD_PATHS),
    ...SITE_COTTAGES.map(c => [[c.x + c.w / 2, c.y + c.h], [c.x + c.w / 2, 17.5]])];
  for (const [key, p] of Object.entries(state.village?.paths || {})) if (key !== except) lines.push(p.pts);
  return lines;
}
function nearestOn(lines, x, y) {
  let best = { d: Infinity, x, y };
  for (const pts of lines) for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)), px = ax + dx * t, py = ay + dy * t, d = Math.hypot(px - x, py - y);
    if (d < best.d) best = { d, x: px, y: py };
  }
  return best;
}
// Soft ground: a smooth bumpy field so paths wander a little instead of running ruler-straight.
const bump = (x, y) => (Math.sin(x * 0.9 + y * 0.35) + Math.sin(y * 1.15 - x * 0.45 + 1.7) + Math.sin((x + y) * 0.6 + 4.1)) / 6 + 0.5;

/** Route a footpath from a building's door to the nearest road. Returns control points, or null. */
export function routePath(state, key) {
  const all = villageBuildings(state), me = all.find(b => b.key === key);
  if (!me) return null;
  // Leave by whichever side faces the nearest road: the front door, or a side or back door.
  const front = doorOf(me), lines = network(state, key), sides = [front, ...[{ x: me.x + me.w / 2, y: me.y - 0.5 }, { x: me.x - 0.5, y: me.y + me.h / 2 }, { x: me.x + me.w + 0.5, y: me.y + me.h / 2 }, { x: me.x + me.w / 2, y: me.y + me.h + 0.5 }].filter(p => Math.hypot(p.x - front.x, p.y - front.y) > 0.1)];
  const start = sides.map(p => ({ ...p, d: nearestOn(lines, p.x, p.y).d + (p === sides[0] ? 0 : 1.5) })).sort((a, b) => a.d - b.d)[0], goal = nearestOn(lines, start.x, start.y);
  if (goal.d < 0.6) return [[start.x, start.y], [goal.x, goal.y]].map(p => p.map(v => Math.round(v * 4) / 4));
  const g = buildingRect(state), solid = [...all.map(b => ({ x: b.x - 0.3, y: b.y - 0.3, w: b.w + 0.6, h: b.h + 0.6 })), { x: g.x - 0.5, y: g.y - 0.5, w: g.w + 1, h: g.h + 0.6 },
    ...SITE_COTTAGES.map(c => ({ x: c.x - 0.3, y: c.y - 0.3, w: c.w + 0.6, h: c.h + 0.6 }))];
  const blocked = (x, y) => solid.some(r => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
  const pad = 8, x0 = Math.min(start.x, goal.x) - pad, y0 = Math.min(start.y, goal.y) - pad, cols = Math.ceil((Math.max(start.x, goal.x) + pad - x0) / RES), rows = Math.ceil((Math.max(start.y, goal.y) + pad - y0) / RES);
  const at = (i, j) => ({ x: x0 + i * RES, y: y0 + j * RES }), idx = (i, j) => j * cols + i;
  const si = Math.round((start.x - x0) / RES), sj = Math.round((start.y - y0) / RES);
  const cost = new Float64Array(cols * rows).fill(Infinity), from = new Int32Array(cols * rows).fill(-1), done = new Uint8Array(cols * rows);
  const open = [[0, si, sj]]; cost[idx(si, sj)] = 0;
  const own = Object.entries(state.village?.paths || {}).filter(([k]) => k !== key).map(([, p]) => p.pts);
  let end = -1;
  while (open.length) {
    let best = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[best][0]) best = k;
    const [, i, j] = open.splice(best, 1)[0], here = idx(i, j);
    if (done[here]) continue; done[here] = 1;
    const p = at(i, j);
    if (nearestOn(lines, p.x, p.y).d < 0.45) { end = here; break; }
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
      const n = idx(ni, nj); if (done[n]) continue;
      const q = at(ni, nj); if (blocked(q.x, q.y)) continue;
      // Walking along an earlier path is cheaper, so paths merge into shared lanes.
      const shared = own.length && nearestOn(own, q.x, q.y).d < 0.6 ? 0.5 : 1;
      const c = cost[here] + Math.hypot(di, dj) * RES * (0.8 + bump(q.x, q.y) * 0.9) * shared;
      if (c < cost[n]) { cost[n] = c; from[n] = here; open.push([c + Math.hypot(q.x - goal.x, q.y - goal.y) * 0.8, ni, nj]); }
    }
    if (open.length > 20000) break;
  }
  if (end < 0) return null;
  const cells = []; for (let n = end; n >= 0; n = from[n]) cells.push(at(n % cols, Math.floor(n / cols)));
  cells.reverse();
  const last = cells[cells.length - 1], join = nearestOn(lines, last.x, last.y);
  const pts = [start, ...cells.filter((_, k) => k > 0 && k < cells.length - 1 && k % 3 === 0), last, { x: join.x, y: join.y }];
  return pts.map(p => [Math.round(p.x * 4) / 4, Math.round(p.y * 4) / 4]).filter((p, k, a) => !k || p[0] !== a[k - 1][0] || p[1] !== a[k - 1][1]);
}

// ---- Homes and the people in them ----
const center = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
/** Where each kind of service stands: village buildings plus the guild, the inn and the bakery. */
function providers(state, all = villageBuildings(state)) {
  const g = buildingRect(state), out = all.filter(b => b.kind !== 'house').map(b => ({ kind: b.kind, ...center(b) }));
  out.push({ kind: 'guild', x: g.x + g.w / 2, y: g.y + g.h / 2 });
  for (const c of SITE_COTTAGES) out.push({ kind: c.style, x: c.x + c.w / 2, y: c.y + c.h / 2 });
  return out;
}
export const homeOf = (state, key) => state.village?.homes?.[key] || { tier: 0, progress: 0 };
/** Which needs a home has met right now. */
export function needsMet(state, key, list = providers(state), all = villageBuildings(state)) {
  const b = all.find(x => x.key === key); if (!b) return {};
  const at = center(b), out = {};
  for (const [id, n] of Object.entries(HOME_NEEDS)) {
    if (n.road) { out[id] = (state.village?.paths?.[key]?.wear || 0) >= n.road && (state.village?.paths?.[key]?.pts?.length || 0) > 1; continue; }
    out[id] = list.some(p => n.from.includes(p.kind) && Math.hypot(p.x - at.x, p.y - at.y) <= n.reach);
  }
  return out;
}
/** The next step for a home: what it still needs, and how far along it is. */
export function homeStatus(state, key, villageLevel) {
  const home = homeOf(state, key), next = HOUSE_UPGRADES[home.tier], met = needsMet(state, key);
  if (!next) return { tier: home.tier, done: true, met, missing: [] };
  const missing = next.needs.filter(id => !met[id]);
  return { tier: home.tier, next, met, missing, levelOk: villageLevel >= next.level, progress: home.progress };
}
/** Everyone the houses could hold, before anyone moves away. */
export function housingCapacity(state) {
  let n = 0; for (let i = 0; i < Math.min(state.village?.houses || 0, VILLAGE_LOTS.houses.length); i++) n += HOUSE_TIERS[homeOf(state, 'h' + i).tier]?.residents || 0;
  return n;
}
/** People living in town: unhappy towns lose families, and rooms stand empty until it is worth living in again. */
export function population(state) { return Math.round(housingCapacity(state) * (state.village?.occupancy ?? 1)); }
const HOME_CLOCK = new WeakMap();
/** Homes whose needs are met grow one tier at a time; nobody is ever moved back down. */
function growHomes(state, step, villageLevel, log) {
  const v = state.village; v.homes ??= {};
  // Homes only change slowly: look again about once a second of game time.
  const clock = (HOME_CLOCK.get(v) || 0) + step;
  if (clock < 1) { HOME_CLOCK.set(v, clock); return; }
  step = clock; HOME_CLOCK.set(v, 0);
  const all = villageBuildings(state), list = providers(state, all);
  for (let i = 0; i < Math.min(v.houses || 0, VILLAGE_LOTS.houses.length); i++) {
    const key = 'h' + i, home = v.homes[key] ??= { tier: 0, progress: 0 }, next = HOUSE_UPGRADES[home.tier];
    if (!next) continue;
    const met = needsMet(state, key, list, all), ok = villageLevel >= next.level && next.needs.every(id => met[id]);
    home.progress = ok ? home.progress + step / next.time : Math.max(0, home.progress - step / (next.time * 4));
    if (home.progress >= 1) { home.tier += 1; home.progress = 0; log?.(`🏡 บ้านหลังหนึ่งในหมู่บ้านขยายเป็น${HOUSE_TIERS[home.tier].name} มี${HOUSE_TIERS[home.tier].people}ย้ายมาเพิ่ม`, 'build'); }
  }
  for (const key of Object.keys(v.homes)) if (!/^h\d+$/.test(key) || +key.slice(1) >= (v.houses || 0)) delete v.homes[key];
}

/** Paths for new buildings appear on their own; feet wear them into roads over time. */
export function tickTown(state, step, villageLevel, log) {
  const v = state.village; if (!v) return;
  growHomes(state, step, villageLevel, log);
  v.paths ??= {};
  const standing = new Set(villageBuildings(state).map(b => b.key));
  for (const key of Object.keys(v.paths)) if (!standing.has(key)) delete v.paths[key];
  for (const key of standing) if (!v.paths[key]) { const pts = routePath(state, key); v.paths[key] = { pts: pts || [], wear: 0.2 }; break; }
  for (const [key, p] of Object.entries(v.paths)) p.wear = Math.min(1, p.wear + step * (key[0] === 'h' ? 0.0004 : 0.0007) * (1 + villageLevel * 0.4));
}
/** What a path looks like now: a trail, a dirt road, or cobbles once the village is a town. */
export const pathTier = (wear, villageLevel) => wear >= 0.85 && villageLevel >= 4 ? 'cobble' : wear >= 0.5 ? 'dirt' : 'trail';
export function sanitizePaths(data) {
  const out = {};
  for (const [key, p] of Object.entries(data && typeof data === 'object' ? data : {})) {
    if (!(/^h\d{1,2}$/.test(key) || VILLAGE_BUSINESSES.includes(key)) || !p || !Array.isArray(p.pts)) continue;
    const pts = p.pts.filter(q => Array.isArray(q) && q.length === 2 && q.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 200)).slice(0, 80);
    out[key] = { pts, wear: typeof p.wear === 'number' && p.wear >= 0 && p.wear <= 1 ? p.wear : 0.2 };
  }
  return out;
}
export function sanitizeHomes(data, houses) {
  const out = {};
  for (const [key, h] of Object.entries(data && typeof data === 'object' ? data : {})) {
    if (!/^h\d{1,2}$/.test(key) || +key.slice(1) >= houses || !h) continue;
    out[key] = { tier: Number.isInteger(h.tier) && h.tier >= 0 && h.tier < HOUSE_TIERS.length ? h.tier : 0, progress: typeof h.progress === 'number' && h.progress >= 0 && h.progress < 1 ? h.progress : 0 };
  }
  return out;
}
/** Reserve the hall's actual future footprint, independently of purchased land. */
export function guildExpansionReserve(state) {
  const g=buildingRect(state),last=BUILDING_STAGES.at(-1);
  return {x:g.x-1,y:g.y-1,w:Math.max(g.w,last.width)+2,h:Math.max(g.h,last.height)+3};
}
export function villagePlacementBlockers(state,key) {
  return [
    {...guildExpansionReserve(state),reason:'พื้นที่สำหรับต่อเติมกิลด์และทางเข้า'},
    ...siteRoads(state).map(r=>({...r,reason:'ต้องเว้นถนนและทางเข้า'})),
    ...SITE_COTTAGES.map(c=>({x:c.x-.3,y:c.y-.3,w:c.w+.6,h:c.h+.6,reason:'ทับอาคารเดิม'})),
    ...siteDecorations(state).map(r=>({...r,reason:'ทับของรอบกิลด์'})),
    ...SITE_TREES.map(([x,y])=>({x:x-.5,y:y-.5,w:1,h:1,reason:'ทับต้นไม้'})),
    ...villageBuildings(state).filter(b=>b.key!==key).map(b=>({x:b.x-.4,y:b.y-.4,w:b.w+.8,h:b.h+.8,reason:'ทับอาคารอื่น'})),
    ...(state.facilities||[]).filter(f=>FACILITIES[f.type]).map(f=>{const d=FACILITIES[f.type];return{x:f.x,y:f.y,w:f.rotation%2?d.h:d.w,h:f.rotation%2?d.w:d.h,reason:'ทับของหรือแปลงสมุนไพรของกิลด์'};})
  ];
}
export function villagePlacementProblem(state,key,kind,x,y,rot=0) {
  const [w,h]=footprintOf(kind,rot);
  const block=villagePlacementBlockers(state,key).find(r=>x<r.x+r.w&&x+w>r.x&&y<r.y+r.h&&y+h>r.y);
  return block?.reason||null;
}
export const spotFree=(state,key,kind,x,y,rot)=>!villagePlacementProblem(state,key,kind,x,y,rot);
