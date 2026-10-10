/* Top-down dungeon view of a mission: one generator, themed per region, laid out per quest. */
import { drawSprite, drawFoe } from './render.js';

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
  const layout = { rooms, grid, seg, path, stops, total: length(), decor, walls };
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

function hpBar(c, x, y, w, ratio, color, label) {
  rect(c, x - 1, y - 1, w + 2, 6, '#4f4540'); rect(c, x, y, w, 4, '#e6dcc4'); rect(c, x, y, w * Math.max(0, Math.min(1, ratio)), 4, color);
  if (label) { c.fillStyle = '#fff8e7'; c.font = 'bold 8px "Noto Sans Thai", sans-serif'; c.textBaseline = 'bottom'; c.fillText(label, x, y - 2); }
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
  c.save(); c.scale(canvas.width / W, canvas.height / H);
  c.drawImage(paintings.get(key), 0, 0);
  // Enemies: two minions in each encounter room and the boss; cleared rooms are empty.
  const cleared = room => stage.back ? (room < 3 || won !== false) : stage.fight > 0 ? room < stage.fight : room < stage.target;
  const attackAge = t - memory.strikeAt, attacking = stage.fight > 0 && !paused && attackAge >= 0 && attackAge < .7, hit = attacking && attackAge > .28 && attackAge < .42;
  const foes = [];
  for (let room = 1; room <= 3; room++) {
    if (cleared(room)) continue;
    const rm = layout.rooms[room], boss = room === 3, bob = Math.round(Math.sin(t * 3 + room) * 1.5);
    const spots = boss ? [[rm.cx + 1.6, rm.cy + .6]] : [[rm.cx + 1.2, rm.cy - .4], [rm.cx + 1.8, rm.cy + 1.1]];
    for (const [x, y] of spots) foes.push({ x: x * T, y: y * T + bob, scale: boss ? .62 : .38, flash: hit && stage.fight === room, room });
  }
  // Party: follow the path in a line, or face the foe in a fan when fighting.
  const members = (mission.memberIds || []).map(id => (state.members || []).find(m => m.id === id)).filter(Boolean);
  const party = members.map((member, i) => {
    if (stage.fight > 0) { const rm = layout.rooms[stage.fight]; return { member, x: (rm.cx - 1.4 - (i === 1 ? .6 : 0)) * T, y: (rm.cy + (i - 1) * 1.3 + .6) * T, dir: 'east' }; }
    const p = pointAt(layout, stage.back ? stage.d + i * 1.4 : stage.d - i * 1.4);
    return { member, x: p.x * T, y: (p.y + .7) * T, dir: stage.back ? ({ east: 'west', west: 'east', north: 'south', south: 'north' })[p.dir] : p.dir };
  });
  const strike = combat.log?.[0], striker = attacking ? party.find(p => p.member.id === strike?.memberId) : null;
  const actors = [...foes.map(f => ({ ...f, foe: true })), ...party].sort((a, b) => a.y - b.y);
  for (const a of actors) {
    if (a.foe) { c.save(); c.translate(Math.round(a.x), Math.round(a.y)); c.scale(a.scale, a.scale); drawFoe(c, 0, 0, quest, t, a.flash); c.restore(); continue; }
    let x = a.x, pose = stage.fight > 0 ? (Math.floor(t * 1.6 + a.y) % 2 ? 'breath' : 'idle') : 'idle';
    if (a === striker) { x += Math.round(Math.sin(Math.min(1, attackAge / .7) * Math.PI) * 9); pose = attackAge < .25 ? 'train0' : 'train1'; }
    drawSprite(c, x, a.y, a.member, t * 8 + a.y, stage.walking && !paused, 1, a.dir, pose);
  }
  // Strike effects: a slash on the target and a floating damage number.
  if (attacking && foes.length) {
    const target = foes.find(f => f.room === stage.fight) || foes[0];
    if (attackAge > .22 && attackAge < .45) { c.strokeStyle = '#fff8e7'; c.lineWidth = 2; c.beginPath(); c.arc(target.x - 2, target.y - 12, 9, -2.4, -.4); c.stroke(); }
    if (attackAge > .28 && Number.isFinite(strike?.damage)) { c.fillStyle = '#4f4540'; c.font = 'bold 10px sans-serif'; c.textBaseline = 'bottom'; const y = target.y - 22 - attackAge * 14; c.fillText(String(strike.damage), target.x - 4, y + 1); c.fillStyle = '#fff1c4'; c.fillText(String(strike.damage), target.x - 5, y); }
  }
  // Fog of war: rooms and corridors ahead of the party stay dark.
  c.fillStyle = theme.fog;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const s = layout.seg[y * COLS + x]; if (s > memory.reveal) { c.globalAlpha = .82; c.fillRect(x * T, y * T, T, T); } }
  c.globalAlpha = 1;
  if (region === 'mist') { c.globalAlpha = .18; for (let i = 0; i < 3; i++) rect(c, ((t * 6 + i * 140) % (W + 160)) - 160, 40 + i * 55, 160, 14, '#eef4f1'); c.globalAlpha = 1; }
  // Event marker and treasure.
  if (options.eventPending && party[0]) { const p = party[0]; rect(c, p.x - 4, p.y - 40, 9, 11, '#4f4540'); rect(c, p.x - 3, p.y - 39, 7, 9, '#fff1c4'); rect(c, p.x, p.y - 38, 1, 5, '#d98978'); rect(c, p.x, p.y - 32, 1, 1, '#d98978'); }
  if (stage.back && won) { const b = layout.rooms[3]; rect(c, b.cx * T - 7, b.cy * T - 6, 14, 10, '#4f4540'); rect(c, b.cx * T - 6, b.cy * T - 5, 12, 8, '#d9b27c'); rect(c, b.cx * T - 6, b.cy * T - 5, 12, 3, '#e7bd74'); }
  // HUD.
  rect(c, 0, 0, W, 16, '#3d352cb0');
  hpBar(c, 6, 8, 90, (combat.partyHp || 0) / Math.max(1, combat.partyMaxHp || 1), '#90b89c', 'ทีม');
  if (stage.fight > 0) hpBar(c, W - 96, 8, 90, (combat.enemyHp || 0) / Math.max(1, combat.enemyMaxHp || 1), '#d98978', stage.fight === 3 ? 'บอส' : 'ศัตรู');
  const caption = mission.status === 'completed' ? 'กลับบ้านแล้ว' : mission.status === 'failed' || mission.status === 'recalled' ? 'ถอยกลับบ้าน' : stage.back ? 'เดินทางกลับบ้าน' : stage.fight > 0 ? (stage.fight === 3 ? 'ห้องบอส!' : `ห้อง ${stage.fight}/3`) : `กำลังเดินไปห้อง ${stage.target}/3`;
  c.fillStyle = '#fff8e7'; c.font = 'bold 9px "Noto Sans Thai", sans-serif'; c.textBaseline = 'middle'; const tw = c.measureText(caption).width; c.fillText(caption, (W - tw) / 2, 8);
  if (paused) { c.fillStyle = '#fff8e7'; c.fillText('หยุดเวลา', W - 44, H - 8); }
  c.restore();
}
