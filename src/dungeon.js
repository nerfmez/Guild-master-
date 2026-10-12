/* Top-down dungeon view of a mission: one generator, themed per region, laid out per quest. */
import { drawSprite, drawFoe } from './render.js';
import { JOBS, RARITIES, CLASS_COMBAT } from './content.js';

const T = 10, COLS = 40, ROWS = 22, W = COLS * T, H = ROWS * T;
const THEMES = {
  meadow: { floor: ['#cfe0b0', '#c7daa8'], path: '#e8d9b2', wall: '#83aa7c', top: '#a3c693', dark: '#5f8a62', deco: ['#f2b8a8', '#fff3d6', '#f4d49a'], fog: '#26301f' },
  ruins: { floor: ['#d9d3c5', '#d0c9b9'], path: '#e5ddcb', wall: '#a59d8f', top: '#c5bdab', dark: '#7b7469', deco: ['#b7aed0', '#c9c1ad', '#9fae9e'], fog: '#25222a' },
  mist: { floor: ['#adc1b8', '#a3b8b0'], path: '#c6d3ca', wall: '#5f7a72', top: '#7d988e', dark: '#455b55', deco: ['#c9e6f0', '#e8d8f2', '#9fd3c7'], fog: '#1b2626' },
};
const STOP_WALK = 0.25;

function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }
function hashText(text) { let n = 2166136261; for (const ch of String(text)) n = Math.imul(n ^ ch.charCodeAt(0), 16777619); return n >>> 0; }
const rect = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

const layouts = new Map();
/** Rooms joined by two-tile corridors: entrance, two encounter rooms, then the boss room. */
export function buildDungeon(quest) {
  const key = quest.id + ':' + quest.region;
  if (layouts.has(key)) return layouts.get(key);
  const r = rng(hashText(quest.id || 'quest')), grid = new Uint8Array(COLS * ROWS), seg = new Int8Array(COLS * ROWS).fill(-1);
  const rooms = [1, 11, 21, 30].map((x0, i) => {
    const w = i === 0 ? 6 : i === 3 ? 9 : 6 + Math.floor(r() * 3), h = i === 0 ? 6 : i === 3 ? 9 : 5 + Math.floor(r() * 3);
    const x = Math.min(COLS - 1 - w, x0 + Math.floor(r() * 2)), y = 2 + Math.floor(r() * (ROWS - 4 - h));
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  });
  const carve = (x, y, kind, s) => { if (x < 1 || y < 1 || x >= COLS - 1 || y >= ROWS - 1) return; const i = y * COLS + x; if (!grid[i]) { grid[i] = kind; seg[i] = s; } };
  rooms.forEach((room, i) => { for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) carve(x, y, 1, i * 2); });
  const path = [{ x: rooms[0].cx, y: rooms[0].cy }], stops = [0];
  const length = () => path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.y - path[i].y), 0);
  for (let i = 0; i < 3; i++) {
    const a = rooms[i], b = rooms[i + 1], mid = Math.floor((a.x + a.w + b.x) / 2), ay = Math.floor(a.cy), by = Math.floor(b.cy);
    for (let x = Math.floor(a.cx); x <= mid; x++) { carve(x, ay, 2, i * 2 + 1); carve(x, ay - 1, 2, i * 2 + 1); }
    for (let y = Math.min(ay, by) - 1; y <= Math.max(ay, by); y++) { carve(mid, y, 2, i * 2 + 1); carve(mid + 1, y, 2, i * 2 + 1); }
    for (let x = mid; x <= Math.floor(b.cx); x++) { carve(x, by, 2, i * 2 + 1); carve(x, by - 1, 2, i * 2 + 1); }
    path.push({ x: mid + 1, y: ay }, { x: mid + 1, y: by }, { x: b.cx, y: b.cy });
    stops.push(length());
  }
  const decor = [];
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if (grid[y * COLS + x] === 1 && r() < .07) decor.push({ x, y, kind: Math.floor(r() * 3) });
  const walls = Array.from({ length: COLS * ROWS }, () => r());
  // A chest tucked into a corner of each encounter room, opened as the party arrives.
  const chests = [1, 2].map(i => { const room = rooms[i], top = r() < .5; return { room: i, x: room.x + .6 + (r() < .5 ? 0 : room.w - 2.2), y: top ? room.y + .4 : room.y + room.h - 1.4 }; });
  const torches = rooms.slice(1).flatMap(room => [[room.x + 1, room.y - .4], [room.x + room.w - 2, room.y - .4]]);
  const layout = { rooms, grid, seg, path, stops, total: length(), decor, walls, chests, torches };
  layouts.set(key, layout);
  return layout;
}

function paintMap(layout, region) {
  const theme = THEMES[region] || THEMES.meadow, canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
  const { grid, rooms, decor, walls } = layout, at = (x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS) ? 0 : grid[y * COLS + x];
  rect(c, 0, 0, W, H, theme.dark);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const kind = at(x, y), px = x * T, py = y * T, n = walls[y * COLS + x];
    if (kind) {
      rect(c, px, py, T, T, kind === 2 ? theme.path : theme.floor[(x + y) % 2]);
      if (region === 'ruins' && kind === 1) { rect(c, px, py, T, 1, '#00000010'); rect(c, px, py, 1, T, '#00000010'); if (n < .12) rect(c, px + 3, py + 4, 4, 1, '#0000001c'); }
      else if (n < .18) rect(c, px + 2 + Math.floor(n * 30), py + 3, 1, 2, '#0000001a');
      continue;
    }
    // Deep walls read as forest or rubble; walls next to the floor get a lit top and a front face.
    const edge = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].some(([dx, dy]) => at(x + dx, y + dy));
    if (!edge) continue;
    rect(c, px, py, T, T, theme.wall);
    if (at(x, y + 1)) { rect(c, px, py + T - 4, T, 4, theme.dark); rect(c, px, py + T - 4, T, 1, '#00000022'); }
    if (region === 'ruins') { rect(c, px, py, T, 1, theme.top); rect(c, px + (y % 2 ? 0 : 5), py, 1, T - 4, '#00000018'); rect(c, px, py + 5, T, 1, '#00000014'); }
    else { rect(c, px + 1 + Math.floor(n * 3), py + 1, 6, 4, theme.top); rect(c, px + 2 + Math.floor(n * 3), py + 1, 2, 1, '#ffffff30'); }
  }
  // Forest canopies or rubble over the deep walls, drawn after tiles so they overlap softly.
  const blob = (x, y, r, color) => { for (let dy = -r; dy <= r; dy++) { const w = Math.round(Math.sqrt(r * r - dy * dy)); rect(c, x - w, y + dy, w * 2, 1, color); } };
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (at(x, y)) continue; const n = walls[y * COLS + x], near = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => at(x + dx, y + dy));
    if (near || n > .55) continue; const px = x * T + 5 + Math.floor(n * 8) - 2, py = y * T + 5 + Math.floor(n * 13) % 5 - 2;
    if (region === 'ruins') { rect(c, px - 4, py - 2, 8, 5, '#6c655b'); rect(c, px - 4, py - 2, 8, 1, '#8d8679'); }
    else { blob(px, py + 2, 7, '#00000024'); blob(px, py, 7, theme.wall); blob(px - 1, py - 2, 4, theme.top); rect(c, px - 3, py - 4, 2, 1, '#ffffff2a'); }
  }
  for (const d of decor) {
    const px = d.x * T, py = d.y * T, col = theme.deco[d.kind % theme.deco.length];
    if (region === 'meadow') { rect(c, px + 3, py + 3, 3, 3, col); rect(c, px + 4, py + 6, 1, 2, '#6d8d6b'); }
    else if (region === 'ruins') { rect(c, px + 2, py + 4, 5, 3, '#9b9385'); rect(c, px + 2, py + 4, 5, 1, '#c8c0ad'); }
    else { rect(c, px + 3, py + 5, 4, 2, col); rect(c, px + 4, py + 7, 2, 2, '#e8e3d0'); }
  }
  // Entrance sign and the boss room's circle.
  const e = rooms[0], b = rooms[3];
  rect(c, e.x * T + 4, e.y * T + 6, 2, 10, '#8a6a4a'); rect(c, e.x * T, e.y * T + 3, 12, 6, '#d9b27c'); rect(c, e.x * T, e.y * T + 3, 12, 1, '#f0d4a0'); rect(c, e.x * T + 3, e.y * T + 5, 6, 1, '#8a6a4a');
  const bx = b.cx * T, by = b.cy * T;
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; rect(c, bx + Math.cos(a) * 28 - 1, by + Math.sin(a) * 18 - 1, 2, 2, region === 'mist' ? '#c9e6f0aa' : region === 'ruins' ? '#b7aed0aa' : '#f2b8a8aa'); }
  if (region === 'ruins') for (const room of rooms.slice(1)) for (const [dx, dy] of [[0, 0], [room.w - 1, 0]]) { const px = (room.x + dx) * T, py = (room.y + dy) * T; rect(c, px + 1, py - 6, 8, 14, '#b8b0a0'); rect(c, px + 1, py - 6, 8, 2, '#d8d0bd'); rect(c, px + 1, py + 6, 8, 2, '#8b8477'); }
  return canvas;
}
const paintings = new Map();

function pointAt(layout, d) {
  const { path } = layout; let left = Math.max(0, d);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= len || i === path.length - 1) { const k = len ? Math.min(1, left / len) : 0, dx = b.x - a.x, dy = b.y - a.y; return { x: a.x + dx * k, y: a.y + dy * k, dir: Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'west' : 'east') : (dy < 0 ? 'north' : 'south') }; }
    left -= len;
  }
  return { ...path[path.length - 1], dir: 'east' };
}

/** Where the party is and what it is doing, from the mission's progress. */
export function missionStage(mission, layout) {
  const done = mission.status !== 'active' && mission.status !== 'decision';
  const ratio = done ? 1 : Math.max(0, Math.min(1, mission.progress / (mission.duration || 1))), s = layout.stops;
  if (done) return { d: 0, walking: false, fight: -1, target: 3, back: true, ratio };
  if (ratio < .18) return { d: s[1] * ratio / .18, walking: true, fight: -1, target: 1, ratio };
  if (ratio < .88) {
    const br = (ratio - .18) / .7, wave = Math.min(2, Math.floor(br * 3)), wr = br * 3 - wave;
    if (wave > 0 && wr < STOP_WALK) return { d: s[wave] + (s[wave + 1] - s[wave]) * wr / STOP_WALK, walking: true, fight: -1, target: wave + 1, ratio };
    return { d: s[wave + 1], walking: false, fight: wave + 1, target: wave + 1, ratio };
  }
  return { d: s[3] * (1 - (ratio - .88) / .12), walking: true, fight: -1, target: 3, back: true, ratio };
}

// ---- Real-time dungeon battle (visual): cooldowns per class, projectiles, skills and floating numbers. ----
const rootOf = id => JOBS[id]?.base || JOBS[id]?.parent || id;
const PACE = { warrior: 1.1, archer: 1.2, mage: 1.6, healer: 1.5 };
function fightTick(memory, stage, party, foes, mission, t, paused) {
  let b = memory.battle;
  if (!b || b.room !== stage.fight) b = memory.battle = { room: stage.fight, last: t, cd: {}, skill: {}, foeCd: {}, act: {}, melee: {}, hurt: {}, foeHit: {}, foeLunge: {}, floats: [], shots: [], seed: 7 + stage.fight };
  const dt = paused ? 0 : Math.max(0, Math.min(.1, t - b.last)); b.last = t;
  const rand = () => { b.seed = (Math.imul(b.seed, 1664525) + 1013904223) >>> 0; return b.seed / 4294967296; };
  const living = foes.filter(f => f.room === stage.fight), hit = mission.power ? Math.max(3, Math.round(mission.power / 8)) : 8;
  if (!dt || !living.length) return b;
  const float = (x, y, text, color, size = 9) => { b.floats.push({ x, y, text, color, size, at: t }); if (b.floats.length > 40) b.floats.shift(); };
  for (const p of party) {
    const id = p.member.id, cls = rootOf(p.member.class), cc = CLASS_COMBAT[cls] || CLASS_COMBAT.warrior;
    b.cd[id] = (b.cd[id] ?? rand() * 1.2) - dt; b.skill[id] = (b.skill[id] ?? 3 + rand() * 4) - dt;
    const target = living[Math.floor(rand() * living.length) % living.length];
    if (b.skill[id] <= 0) {
      b.skill[id] = 7 + rand() * 4; b.act[id] = t; b.melee[id] = cls === 'warrior';
      float(p.x, p.y - 44, cc.skillName, '#fff1c4', 8); b.shots.push({ kind: 'ring', x: p.x, y: p.y - 8, at: t, color: cls === 'healer' ? '#9fe08a' : cls === 'mage' ? '#f08a4b' : cls === 'archer' ? '#e8cd8c' : '#8eb6e0' });
      if (cls === 'healer') for (const q of party) float(q.x, q.y - 30, '+' + Math.round(hit * 1.5), '#8fe28a');
      else for (const f of living) { b.foeHit[f.key] = t + .1; float(f.x, f.y - 26, String(Math.round(hit * (cls === 'mage' ? 1.8 : 1.3) * (.85 + rand() * .3))), '#ffd36a', 10); }
      continue;
    }
    if (b.cd[id] > 0) continue;
    b.cd[id] = (PACE[cls] || 1.3) * (.85 + rand() * .3); b.act[id] = t; b.melee[id] = cls === 'warrior';
    if (cls === 'healer') { const q = party[Math.floor(rand() * party.length)]; float(q.x, q.y - 30, '+' + Math.round(hit * .9), '#8fe28a'); b.shots.push({ kind: 'heal', x: q.x, y: q.y - 12, at: t }); continue; }
    const crit = rand() < .12, dmg = Math.round(hit * cc.dmg * (crit ? 1.6 : 1) * (.85 + rand() * .3));
    if (cls === 'warrior') { b.foeHit[target.key] = t; float(target.x, target.y - 26, String(dmg), crit ? '#ffd36a' : '#ffffff', crit ? 11 : 9); b.shots.push({ kind: 'slash', x: target.x, y: target.y - 12, at: t }); }
    else { b.shots.push({ kind: cls === 'archer' ? 'arrow' : 'bolt', fx: p.x + 6, fy: p.y - 14, tx: target.x, ty: target.y - 14, at: t, key: target.key, dmg, crit }); }
  }
  // Projectiles land after a short flight.
  for (const s of b.shots) if ((s.kind === 'arrow' || s.kind === 'bolt') && !s.done && t - s.at >= .22) { s.done = true; b.foeHit[s.key] = t; float(s.tx, s.ty - 12, String(s.dmg), s.crit ? '#ffd36a' : '#ffffff', s.crit ? 11 : 9); }
  // Foes strike back at their own pace.
  for (const f of living) {
    b.foeCd[f.key] = (b.foeCd[f.key] ?? .6 + rand()) - dt;
    if (b.foeCd[f.key] > 0) continue;
    b.foeCd[f.key] = (f.boss ? 2 : 1.6) * (.85 + rand() * .3); b.foeLunge[f.key] = t;
    const q = party[Math.floor(rand() * party.length)]; if (!q) continue;
    b.hurt[q.member.id] = t; float(q.x, q.y - 30, String(Math.max(1, Math.round(hit * (f.boss ? .9 : .45) * (.8 + rand() * .4)))), '#ff8a7a');
  }
  b.shots = b.shots.filter(s => t - s.at < .6);
  return b;
}
function drawBattleFx(c, b, t) {
  for (const s of b.shots) {
    const k = Math.min(1, (t - s.at) / .22);
    if (s.kind === 'arrow' && !s.done) { const x = s.fx + (s.tx - s.fx) * k, y = s.fy + (s.ty - s.fy) * k; rect(c, x - 5, y, 6, 1, '#8a6a4a'); rect(c, x + 1, y - 1, 2, 3, '#e3e9e6'); }
    else if (s.kind === 'bolt' && !s.done) { const x = s.fx + (s.tx - s.fx) * k, y = s.fy + (s.ty - s.fy) * k; c.globalAlpha = .45; rect(c, x - 7, y - 1, 6, 3, '#f0a060'); c.globalAlpha = 1; rect(c, x - 2, y - 2, 4, 4, '#f08a4b'); rect(c, x - 1, y - 1, 2, 2, '#fff1c4'); }
    else if (s.kind === 'slash') { const a = t - s.at; if (a < .25) { c.strokeStyle = '#fff8e7'; c.lineWidth = 2; c.beginPath(); c.arc(s.x - 2, s.y, 9, -2.4 + a * 4, -.4 + a * 4); c.stroke(); } }
    else if (s.kind === 'ring' || s.kind === 'heal') { const a = (t - s.at) / .6; c.globalAlpha = Math.max(0, 1 - a); c.strokeStyle = s.kind === 'heal' ? '#9fe08a' : s.color; c.lineWidth = 2; c.beginPath(); c.ellipse(s.x, s.y + 6, 6 + a * 14, 3 + a * 6, 0, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1; }
  }
  c.textBaseline = 'bottom';
  for (const f of b.floats) {
    const a = t - f.at; if (a < 0 || a > .9) continue;
    c.globalAlpha = Math.min(1, (.9 - a) * 3); c.font = `bold ${f.size}px "Noto Sans Thai", sans-serif`;
    const w = c.measureText(f.text).width, x = f.x - w / 2, y = f.y - a * 16;
    c.fillStyle = '#3d2f28'; c.fillText(f.text, x + 1, y + 1); c.fillStyle = f.color; c.fillText(f.text, x, y);
  }
  c.globalAlpha = 1;
}
function banner(c, x, y, text, color, size = 10) {
  c.font = `bold ${size}px "Noto Sans Thai", sans-serif`; c.textBaseline = 'middle'; const w = Math.ceil(c.measureText(text).width) + 14, h = size + 8;
  rect(c, x - w / 2 - 1, y - h / 2 - 1, w + 2, h + 2, '#4f4540'); rect(c, x - w / 2, y - h / 2, w, h, color); rect(c, x - w / 2, y - h / 2, w, 2, '#ffffff40');
  c.fillStyle = '#fff8e7'; c.fillText(text, x - w / 2 + 7, y + 1);
}
function hpBar(c, x, y, w, ratio, color, label) {
  rect(c, x - 1, y - 1, w + 2, 6, '#4f4540'); rect(c, x, y, w, 4, '#e6dcc4'); rect(c, x, y, w * Math.max(0, Math.min(1, ratio)), 4, color);
  if (label) { c.fillStyle = '#584c43'; c.font = 'bold 8px "Noto Sans Thai", sans-serif'; c.textBaseline = 'bottom'; c.fillText(label, x, y - 2); }
}

/** Draw the mission as a top-down dungeon: fogged map, walking party, fights in each room. */
export function drawDungeonScene(canvas, mission, quest, state, options = {}) {
  if (!canvas || !mission || !quest) return;
  const layout = buildDungeon(quest), region = quest.region || 'meadow', theme = THEMES[region] || THEMES.meadow;
  const key = quest.id + ':' + region; if (!paintings.has(key)) paintings.set(key, paintMap(layout, region));
  const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
  const now = Number(options.time ?? performance.now() / 1000), paused = Boolean(options.paused);
  let memory = canvas.__dungeon;
  if (!memory || memory.id !== mission.id) memory = canvas.__dungeon = { id: mission.id, last: now, clock: 0, strike: mission.combat?.lastStrike || 0, strikeAt: -10, reveal: 0 };
  if (!paused) memory.clock += Math.max(0, Math.min(.1, now - memory.last)); memory.last = now;
  if (memory.strike !== (mission.combat?.lastStrike || 0)) { memory.strike = mission.combat?.lastStrike || 0; memory.strikeAt = memory.clock; }
  const t = memory.clock, stage = missionStage(mission, layout), combat = mission.combat || {}, won = mission.result?.success;
  memory.reveal = Math.max(memory.reveal, stage.target * 2, stage.back ? 6 : 0);
  memory.clearAt ??= {}; memory.openAt ??= {};
  if (memory.fight > 0 && stage.fight !== memory.fight && !memory.clearAt[memory.fight]) memory.clearAt[memory.fight] = t;
  if (stage.fight === 3 && memory.bossAt === undefined) memory.bossAt = t;
  memory.fight = stage.fight;
  const shake = memory.bossAt !== undefined && t - memory.bossAt < .45 ? Math.round(Math.sin(t * 60) * 2) : 0;
  c.save(); c.scale(canvas.width / W, canvas.height / H); c.translate(shake, 0);
  c.drawImage(paintings.get(key), 0, 0);
  // Ambient life per region: torches in the ruins, butterflies in the meadow, fireflies in the mist.
  if (region === 'ruins') for (const [x, y] of layout.torches) { const f = Math.sin(t * 9 + x) > 0 ? 1 : 0; rect(c, x * T + 3, y * T + 2, 2, 6, '#6b5440'); rect(c, x * T + 2, y * T - 2 - f, 4, 4, '#f4b860'); rect(c, x * T + 3, y * T - 1 - f, 2, 2, '#fff1c4'); c.globalAlpha = .18; rect(c, x * T - 4, y * T - 6, 16, 14, '#f4d49a'); c.globalAlpha = 1; }
  else for (let i = 0; i < 6; i++) { const room = layout.rooms[i % 4], x = (room.cx + Math.sin(t * .7 + i * 2.1) * room.w * .35) * T, y = (room.cy + Math.cos(t * .9 + i * 1.3) * room.h * .3) * T;
    if (region === 'meadow') { const flap = Math.sin(t * 14 + i) > 0; rect(c, x - (flap ? 2 : 1), y, flap ? 2 : 1, 2, i % 2 ? '#f2b8a8' : '#fff3d6'); rect(c, x + 1, y, flap ? 2 : 1, 2, i % 2 ? '#f2b8a8' : '#fff3d6'); }
    else { c.globalAlpha = .5 + Math.sin(t * 3 + i) * .4; rect(c, x, y, 2, 2, '#e8ffc4'); c.globalAlpha = .2; rect(c, x - 2, y - 2, 6, 6, '#e8ffc4'); c.globalAlpha = 1; } }
  // Chests open when the party reaches their room; a sparkle marks the moment.
  for (const chest of layout.chests) {
    const opened = stage.back || stage.target > chest.room || memory.clearAt[chest.room] !== undefined;
    if (opened && memory.openAt[chest.room] === undefined) memory.openAt[chest.room] = t;
    const x = chest.x * T, y = chest.y * T;
    rect(c, x - 1, y + 1, 14, 10, '#4f4540'); rect(c, x, y + 4, 12, 6, '#b5835a'); rect(c, x, y + 6, 12, 1, '#e7bd74'); rect(c, x + 5, y + 5, 2, 3, '#e7bd74');
    if (opened) { rect(c, x, y - 2, 12, 4, '#8f6646'); rect(c, x + 2, y + 3, 8, 2, '#f4d49a'); } else { rect(c, x, y + 1, 12, 4, '#c8946a'); rect(c, x, y + 1, 12, 1, '#e3b487'); }
    // Sparkles take the colour of what the chest held; rare and legendary finds glow longer.
    const tier = mission.loot?.[chest.room - 1]?.tier || 'common', glow = RARITIES[tier]?.color || '#fff1c4', long = tier === 'rare' || tier === 'legendary' ? 2.4 : 1.2;
    const age = t - (memory.openAt[chest.room] ?? -9);
    if (age >= 0 && age < long) { c.globalAlpha = 1 - age / long; for (let i = 0; i < (long > 2 ? 8 : 4); i++) { const a = i * Math.PI * 2 / (long > 2 ? 8 : 4) + age * 3; rect(c, x + 6 + Math.cos(a) * (4 + age * 10), y - 2 + Math.sin(a) * (3 + age * 6) - age * 8, 2, 2, i % 2 ? '#fff1c4' : glow); }
      if (tier !== 'common') { rect(c, x + 3, y - 12 - age * 6, 6, 6, '#4f4540'); rect(c, x + 4, y - 11 - age * 6, 4, 4, glow); rect(c, x + 4, y - 11 - age * 6, 2, 1, '#ffffff'); }
      c.globalAlpha = 1; }
    if (opened && (tier === 'rare' || tier === 'legendary')) { c.globalAlpha = .25 + Math.sin(t * 4) * .1; rect(c, x - 2, y - 1, 16, 12, glow); c.globalAlpha = 1; }
  }
  // Enemies: two minions in each encounter room and the boss; cleared rooms are empty.
  const cleared = room => stage.back ? (room < 3 || won !== false) : stage.fight > 0 ? room < stage.fight : room < stage.target;
  const foes = [];
  // How much of the current room's foes is left: the wave's share of the mission's battle, so the fight matches the outcome.
  const ratio = Math.max(0, Math.min(1, (mission.progress || 0) / (mission.duration || 1))), br = (ratio - .18) / .7, wave = Math.min(2, Math.floor(Math.max(0, br) * 3));
  const waveLeft = stage.fight > 0 ? 1 - Math.max(0, Math.min(1, ((br * 3 - wave) - (wave > 0 ? STOP_WALK : 0)) / (1 - (wave > 0 ? STOP_WALK : 0)))) : 1;
  for (let room = 1; room <= 3; room++) {
    if (cleared(room)) continue;
    const rm = layout.rooms[room], boss = room === 3, bob = Math.round(Math.sin(t * 3 + room) * 1.5);
    const spots = boss ? [[rm.cx + 1.6, rm.cy + .6]] : [[rm.cx + 1.2, rm.cy - .4], [rm.cx + 1.8, rm.cy + 1.1]];
    spots.forEach(([x, y], i) => {
      const hp = room === stage.fight ? Math.max(0, Math.min(1, waveLeft * spots.length - (spots.length - 1 - i))) : 1;
      if (hp > 0) foes.push({ x: x * T, y: y * T + bob, scale: boss ? .62 : .38, flash: false, room, hp, boss, key: room * 10 + i });
    });
  }
  // Party: follow the path in a line, or face the foe in a fan when fighting.
  const members = (mission.memberIds || []).map(id => (state.members || []).find(m => m.id === id)).filter(Boolean);
  const party = members.map((member, i) => {
    if (stage.fight > 0) { const rm = layout.rooms[stage.fight]; return { member, x: (rm.cx - 1.4 - (i === 1 ? .6 : 0)) * T, y: (rm.cy + (i - 1) * 1.3 + .6) * T, dir: 'east' }; }
    const p = pointAt(layout, stage.back ? stage.d + i * 1.4 : stage.d - i * 1.4);
    return { member, x: p.x * T, y: (p.y + .7) * T, dir: stage.back ? ({ east: 'west', west: 'east', north: 'south', south: 'north' })[p.dir] : p.dir };
  });
  // Real-time battle: every adventurer fights at their class's pace and foes hit back (drawn from the mission's own numbers).
  const battle = stage.fight > 0 ? fightTick(memory, stage, party, foes, mission, t, paused) : (memory.battle = null);
  const striker = null, strike = null;
  const partyRatio = (combat.partyHp || 0) / Math.max(1, combat.partyMaxHp || 1);
  const actors = [...foes.map(f => ({ ...f, foe: true })), ...party].sort((a, b) => a.y - b.y);
  for (const a of actors) {
    if (a.foe) { if (a.room === 3) { c.globalAlpha = .28 + Math.sin(t * 4) * .1; c.fillStyle = '#d98978'; c.beginPath(); c.ellipse(a.x, a.y + 1, 22, 8, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
      const lunge = battle?.foeLunge?.[a.key] !== undefined && t - battle.foeLunge[a.key] < .35 ? Math.round(-Math.sin((t - battle.foeLunge[a.key]) / .35 * Math.PI) * 7) : 0;
      const flash = battle?.foeHit?.[a.key] !== undefined && t - battle.foeHit[a.key] < .12;
      drawFoe(c, Math.round(a.x + lunge), Math.round(a.y), quest, t, flash, a.room === 3 ? 44 : 22);
      if (a.room === stage.fight) hpBar(c, a.x - 10, a.y - (a.boss ? 50 : 30), 20, a.hp, '#d98978');
      continue; }
    if (stage.walking && !paused) { const k = (t * 4 + a.y / 7) % 1; c.globalAlpha = .45 * (1 - k); rect(c, a.x - 2 - (a.dir === 'east' ? 4 + k * 4 : a.dir === 'west' ? -4 - k * 4 : 0), a.y - 1 - k * 2, 3, 2, '#e8dcc0'); c.globalAlpha = 1; }
    let x = a.x, pose = stage.fight > 0 ? (Math.floor(t * 1.6 + a.y) % 2 ? 'breath' : 'idle') : 'idle';
    const act = battle?.act?.[a.member.id];
    if (act !== undefined && t - act < .5) { const k = (t - act) / .5; x += (battle.melee?.[a.member.id] ? Math.round(Math.sin(k * Math.PI) * 9) : 0); pose = k < .4 ? 'train0' : 'train1'; }
    const hurt = battle?.hurt?.[a.member.id] !== undefined && t - battle.hurt[a.member.id] < .15;
    if (hurt) c.globalAlpha = .55;
    drawSprite(c, x, a.y, a.member, t * 8 + a.y, stage.walking && !paused, 1, a.dir, pose);
    c.globalAlpha = 1;
    if (stage.fight > 0) { const i = party.indexOf(a), r = Math.max(0, Math.min(1, partyRatio + ((i * 37) % 9 - 4) / 60)); hpBar(c, a.x - 9, a.y - 34, 18, r, r < .35 ? '#e0a050' : '#90b89c'); }
  }
  if (battle) drawBattleFx(c, battle, t);
  // Fog of war: rooms and corridors ahead of the party stay dark.
  c.fillStyle = theme.fog;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const s = layout.seg[y * COLS + x]; if (s > memory.reveal) { c.globalAlpha = .82; c.fillRect(x * T, y * T, T, T); } }
  c.globalAlpha = 1;
  if (region === 'mist') { c.globalAlpha = .18; for (let i = 0; i < 3; i++) rect(c, ((t * 6 + i * 140) % (W + 160)) - 160, 40 + i * 55, 160, 14, '#eef4f1'); c.globalAlpha = 1; }
  // Event marker and treasure.
  if (options.eventPending && party[0]) { const p = party[0]; rect(c, p.x - 4, p.y - 40, 9, 11, '#4f4540'); rect(c, p.x - 3, p.y - 39, 7, 9, '#fff1c4'); rect(c, p.x, p.y - 38, 1, 5, '#d98978'); rect(c, p.x, p.y - 32, 1, 1, '#d98978'); }
  if (stage.back && won) { const b = layout.rooms[3]; rect(c, b.cx * T - 7, b.cy * T - 6, 14, 10, '#4f4540'); rect(c, b.cx * T - 6, b.cy * T - 5, 12, 8, '#d9b27c'); rect(c, b.cx * T - 6, b.cy * T - 5, 12, 3, '#e7bd74'); }
  // Cleared rooms puff into smoke with a short "clear" tag.
  for (const [room, at] of Object.entries(memory.clearAt)) { const age = t - at, rm = layout.rooms[room]; if (age < 0 || age > 1.1) continue;
    c.globalAlpha = Math.max(0, 1 - age / 1.1); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, d = 4 + age * 18; rect(c, (rm.cx + 1.4) * T + Math.cos(a) * d - 3, rm.cy * T + Math.sin(a) * d * .6 - 3 - age * 6, 6, 5, '#f3ead2'); }
    banner(c, (rm.cx + 1.2) * T, rm.cy * T - 22 - age * 10, 'เคลียร์!', '#7fae6f'); c.globalAlpha = 1; }
  if (memory.bossAt !== undefined && t - memory.bossAt < 1.4) { c.globalAlpha = Math.min(1, (1.4 - (t - memory.bossAt)) * 2); banner(c, W / 2, H / 2 - 10, 'บอสปรากฏ!', '#d98978', 14); c.globalAlpha = 1; }
  if (mission.status === 'completed' || mission.status === 'failed' || mission.status === 'recalled') banner(c, W / 2, H / 2 - 10, mission.status === 'completed' ? 'ภารกิจสำเร็จ!' : 'ถอยกลับบ้าน', mission.status === 'completed' ? '#7fae6f' : '#a59d8f', 14);
  // HUD.
  rect(c, 0, 0, W, 16, '#fff3dcee');
  hpBar(c, 6, 8, 90, (combat.partyHp || 0) / Math.max(1, combat.partyMaxHp || 1), '#90b89c', 'ทีม');
  if (stage.fight > 0) hpBar(c, W - 96, 8, 90, (combat.enemyHp || 0) / Math.max(1, combat.enemyMaxHp || 1), '#d98978', stage.fight === 3 ? 'บอส' : 'ศัตรู');
  const caption = mission.status === 'completed' ? 'กลับบ้านแล้ว' : mission.status === 'failed' || mission.status === 'recalled' ? 'ถอยกลับบ้าน' : stage.back ? 'เดินทางกลับบ้าน' : stage.fight > 0 ? (stage.fight === 3 ? 'ห้องบอส!' : `ห้อง ${stage.fight}/3`) : `กำลังเดินไปห้อง ${stage.target}/3`;
  c.fillStyle = '#584c43'; c.font = 'bold 9px "Noto Sans Thai", sans-serif'; c.textBaseline = 'middle'; const tw = c.measureText(caption).width; c.fillText(caption, (W - tw) / 2, 8);
  if (paused) { c.fillStyle = '#584c43'; c.fillText('หยุดเวลา', W - 44, H - 8); }
  c.restore();
}
