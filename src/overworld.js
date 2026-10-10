/* One continuous world around the guild, in the guild's own 2:1 projection.
   Biomes are soft fields that blend into each other: meadow west, woods north fading into mist,
   dry hills east beyond the river. Paths wind out from the village roads to landmark quest sites. */
import { gridPoint } from './guild-art.js';
import { drawFoe } from './render.js';
import { REGIONS, RANKS } from './content.js';

export const WORLD = { x0: -62, y0: -68, x1: 84, y1: 58 };
const VILLAGE = { x: 10, y: 8, r: 19 };
export const BIOMES = {
  meadow: { x: -32, y: 26, r: 28, color: [172, 187, 128] },
  forest: { x: 2, y: -30, r: 26, color: [122, 148, 104] },
  mist: { x: -2, y: -52, r: 18, color: [96, 126, 114] },
  hills: { x: 58, y: 10, r: 24, color: [178, 172, 126] },
};
const BASE = [156, 172, 125];
// Paths are written as control points in grid units and smoothed with Catmull-Rom.
export const PATHS = {
  west: [[6, 17.5], [-4, 17.5], [-12, 17.5], [-18, 19.5], [-24, 22.5], [-30, 24], [-38, 22], [-46, 25]],
  lake: [[-30, 24], [-31, 27], [-29, 29]],
  north: [[2, 8], [2, -2], [2, -12], [1, -20], [5, -28], [2, -36], [-2, -44], [2, -52], [4, -58]],
  mistdeep: [[-2, -44], [-7, -47], [-10, -50]],
  east: [[20, 17.5], [34, 17.5], [42, 17.5], [48, 15], [54, 10], [58, 4], [62, -1]],
  hills: [[48, 15], [54, 18], [59, 20]],
};
export const RIVER = [[47, -70], [45, -42], [40, -20], [42, 0], [41, 17.5], [38, 34], [33, 60]];
export const LAKE = { x: -37, y: 32, rx: 6.5, ry: 4.5 };
export const BRIDGE = { x: 39.6, y: 16.6, w: 3.4, h: 1.8 };
export const QUEST_SITES = {
  patrol: { x: -18, y: 21.6 }, herbs: { x: -29, y: 29 }, escort: { x: 46.5, y: 16.2 },
  hollow: { x: 8.5, y: -27.5 }, crystals: { x: 59.5, y: 21.5 }, ruins: { x: 63, y: -3 },
  mistpath: { x: 1, y: -40 }, rescue: { x: -10.5, y: -49 }, heart: { x: 4, y: -59 },
};
// Where each route leaves the village roads, then which path points it follows.
const ROUTES = {
  patrol: ['west', 3], herbs: ['west', 5, 'lake'], escort: ['east', 2],
  crystals: ['east', 3, 'hills'], ruins: ['east', 6],
  hollow: ['north', 4], mistpath: ['north', 5], rescue: ['north', 6, 'mistdeep'], heart: ['north', 8],
};
export const SIGNPOSTS = [
  { x: -14, y: 19.8, text: 'ทุ่งใบชา →', region: 'meadow' },
  { x: 3.8, y: -16, text: 'ป่าหมอกจันทร์ ↑', region: 'mist' },
  { x: 45.5, y: 18.8, text: 'ซากหอระฆัง →', region: 'ruins' },
];
export const VILLAGE_HOMES = [[-9, 20.5, 31], [-2, 21.5, 44], [8, 21.5, 52], [14, 22, 63], [24, 21.5, 75], [-8, -3, 88]];

export const regionOpen = (state, id) => RANKS.indexOf(state.rank) >= RANKS.indexOf(REGIONS.find(r => r.id === id)?.rank || 'F');
const clamp01 = v => Math.max(0, Math.min(1, v));
function hash2(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise(x, y) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1); return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; }
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }

/** Smooth a control polyline into dense points. */
export function smoothPath(points, steps = 6) {
  const out = [], p = i => points[Math.max(0, Math.min(points.length - 1, i))];
  for (let i = 0; i < points.length - 1; i++) for (let s = 0; s < steps; s++) {
    const t = s / steps, [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const f = k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t);
    out.push({ x: f(0), y: f(1) });
  }
  const last = points[points.length - 1]; out.push({ x: last[0], y: last[1] }); return out;
}
const SMOOTH = Object.fromEntries(Object.entries(PATHS).map(([k, v]) => [k, smoothPath(v)]));
const SMOOTH_RIVER = smoothPath(RIVER, 8);
const distTo = (pts, x, y) => { let best = 1e9; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy || 1, t = clamp01(((x - a.x) * dx + (y - a.y) * dy) / len), px = a.x + dx * t - x, py = a.y + dy * t - y; best = Math.min(best, px * px + py * py); } return Math.sqrt(best); };

/** Biome weights at a grid position (0..1 each), softened by noise so edges wander. */
export function biomeAt(x, y) {
  const n = noise(x * .09, y * .09) * .5 - .25, out = {};
  const village = clamp01(1 - Math.hypot(x - VILLAGE.x, y - VILLAGE.y) / VILLAGE.r);
  for (const [id, b] of Object.entries(BIOMES)) out[id] = clamp01((1 - Math.hypot(x - b.x, y - b.y) / b.r) * 1.4 + n) * (1 - village);
  out.mist = Math.min(out.mist, out.forest + .3);
  return out;
}
export function nearPath(x, y, pad = 1.6) { return Object.values(SMOOTH).some(p => distTo(p, x, y) < pad); }
export function inWater(x, y, pad = 0) { return distTo(SMOOTH_RIVER, x, y) < 2.2 + pad || ((x - LAKE.x) / (LAKE.rx + pad)) ** 2 + ((y - LAKE.y) / (LAKE.ry + pad)) ** 2 < 1; }

/** Route in grid units from the guild door to a quest's landmark, along the village roads and world paths. */
export function questRoute(door, quest) {
  const site = QUEST_SITES[quest.id] || { x: 0, y: 20 }, plan = ROUTES[quest.id] || ['west', 2], road = 17.5;
  const [name, last, branch] = plan, points = PATHS[name].slice(0, last + 1);
  const out = [{ x: door.x, y: door.y }, { x: door.x, y: road }];
  if (name === 'north') out.push({ x: 2, y: road });
  out.push(...smoothPath(points, 4));
  if (branch) out.push(...smoothPath(PATHS[branch], 4).slice(1));
  out.push(site);
  return out;
}

/** The world floor at quarter resolution: blended biome colours under light alpha, with opaque paths and water. */
export function makeWorldGround() {
  const SCALE = 4, o = gridPoint(0, 0), a = gridPoint(WORLD.x0, WORLD.y1), b = gridPoint(WORLD.x1, WORLD.y0), c0 = gridPoint(WORLD.x0, WORLD.y0), c1 = gridPoint(WORLD.x1, WORLD.y1);
  const minX = a.x, maxX = b.x, minY = c0.y, maxY = c1.y, w = Math.ceil((maxX - minX) / SCALE), h = Math.ceil((maxY - minY) / SCALE);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d'), img = c.createImageData(w, h), d = img.data;
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const A = (px * SCALE + minX - o.x) / 24, B = (py * SCALE + minY - o.y) / 12, gx = (A + B) / 2, gy = (B - A) / 2, wts = biomeAt(gx, gy);
    let r = BASE[0], g = BASE[1], bl = BASE[2];
    for (const [id, wt] of Object.entries(wts)) { if (!wt) continue; const col = BIOMES[id].color, k = Math.min(1, wt * (id === 'mist' ? 1.15 : .9)); r += (col[0] - r) * k; g += (col[1] - g) * k; bl += (col[2] - bl) * k; }
    const grain = (noise(gx * .7, gy * .7) - .5) * 12, i = (py * w + px) * 4;
    d[i] = r + grain; d[i + 1] = g + grain; d[i + 2] = bl + grain * .6; d[i + 3] = 200;
  }
  c.putImageData(img, 0, 0);
  // Water and paths, stamped as soft iso ellipses so their edges stay organic.
  const at = (x, y) => { const p = gridPoint(x, y); return [(p.x - minX) / SCALE, (p.y - minY) / SCALE]; };
  const stamp = (x, y, rad, color) => { const [sx, sy] = at(x, y); c.fillStyle = color; c.beginPath(); c.ellipse(sx, sy, rad * 24 / SCALE * 1.414, rad * 12 / SCALE * 1.414, 0, 0, Math.PI * 2); c.fill(); };
  const lake = (pad, color) => { for (let y = LAKE.y - LAKE.ry - pad; y <= LAKE.y + LAKE.ry + pad; y += .4) for (let x = LAKE.x - LAKE.rx - pad; x <= LAKE.x + LAKE.rx + pad; x += .4) if (((x - LAKE.x) / (LAKE.rx + pad)) ** 2 + ((y - LAKE.y) / (LAKE.ry + pad)) ** 2 < 1) stamp(x, y, .45, color); };
  for (const p of SMOOTH_RIVER) stamp(p.x, p.y, 2.9, 'rgb(128,150,118)'); lake(.8, 'rgb(128,150,118)');
  for (const p of SMOOTH_RIVER) stamp(p.x, p.y, 2.2, 'rgb(146,188,198)'); lake(0, 'rgb(146,188,198)');
  for (let i = 0; i < SMOOTH_RIVER.length; i += 3) { const p = SMOOTH_RIVER[i]; stamp(p.x + (hash2(i, 3) - .5) * 2, p.y + (hash2(i, 7) - .5) * 2, .35, 'rgba(206,230,232,.6)'); }
  const trail = (rad, color) => { for (const pts of Object.values(SMOOTH)) for (let i = 1; i < pts.length; i++) { const A = pts[i - 1], B = pts[i], n = Math.ceil(Math.hypot(B.x - A.x, B.y - A.y) * 3); for (let s = 0; s <= n; s++) { const k = s / n; stamp(A.x + (B.x - A.x) * k, A.y + (B.y - A.y) * k, rad, color); } } };
  trail(1.05, 'rgb(190,176,138)'); trail(.75, 'rgb(222,206,168)');
  // Farm plots beside the west path, and a worn stone plaza around the ruins.
  for (let i = 0; i < 4; i++) for (let y = 13.5; y < 17; y += .5) stamp(-22 + i * 1.6, y, .5, i % 2 ? 'rgb(170,150,108)' : 'rgb(150,170,104)');
  for (let y = -8; y < 2; y += .6) for (let x = 58; x < 68; x += .6) if (Math.hypot(x - 63, y + 3) < 5 && hash2(x * 5, y * 5) < .7) stamp(x, y, .4, hash2(x, y) < .5 ? 'rgb(205,198,178)' : 'rgb(190,183,163)');
  return { canvas, x: minX, y: minY, scale: SCALE };
}

/** Nature positions: sparse around the village, thickening into woods and mist and toward the world's edge. */
export function scatterNature() {
  const r = rng(5150), items = [];
  const clear = (x, y) => Math.hypot(x - VILLAGE.x, y - VILLAGE.y) < 15 || nearPath(x, y, 1.8) || inWater(x, y, 1) || Object.values(QUEST_SITES).some(s => Math.hypot(s.x - x, s.y - y) < 5) || (x > -2 && x < 34 && y > -4 && y < 26);
  for (let y = WORLD.y0 + 1; y < WORLD.y1 - 1; y += 1.5) for (let x = WORLD.x0 + 1; x < WORLD.x1 - 1; x += 1.5) {
    const jx = x + (r() - .5) * 1.3, jy = y + (r() - .5) * 1.3; if (clear(jx, jy)) { r(); r(); continue; }
    const b = biomeAt(jx, jy), edge = Math.max(0, (Math.hypot(jx - VILLAGE.x, jy - VILLAGE.y) - 50) / 26);
    const tree = Math.min(.8, .05 * (1 - b.hills) + b.forest * .5 + b.mist * .4 + b.meadow * .03 + edge * .5 * (1 - b.hills * 1.2)), roll = r(), seed = Math.floor(r() * 8);
    const mist = Math.round(clamp01(b.mist * 1.3) * 3);
    if (roll < tree) items.push({ kind: 'tree', x: jx, y: jy, mist, gold: b.meadow > .4 && seed % 3 === 0, seed });
    else if (roll < tree + .04 + b.meadow * .12) items.push({ kind: b.hills > .4 ? 'rock' : b.meadow > .3 ? 'flower' : 'bush', x: jx, y: jy, mist, seed: seed % 4 });
    else if (b.hills > .45 && roll < tree + .2) items.push({ kind: 'rock', x: jx, y: jy, seed: seed % 4 });
  }
  return items;
}

// ---- Landmark and prop sprites. Each returns { canvas, footX, footY }. ----
function sprite(w, h, footX, footY, paint) { const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false; const R = (x, y, ww, hh, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh)); }; paint(c, R); return { canvas, footX, footY }; }
/** Tint a baked sprite toward the mist palette. */
export function mistTint(src, level) {
  if (!level) return src;
  return sprite(src.canvas.width, src.canvas.height, src.footX, src.footY, c => { c.drawImage(src.canvas, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = `rgba(52,86,88,${.15 * level})`; c.fillRect(0, 0, src.canvas.width, src.canvas.height); });
}
export function makeFoeSprite(quest, scale = .5, flash = false) {
  const w = Math.ceil(90 * scale) + 8, h = Math.ceil(70 * scale) + 8;
  return sprite(w, h, Math.round(w / 2), h - 4, c => { c.translate(Math.round(w / 2), h - 4); c.scale(scale, scale); drawFoe(c, 0, 0, quest, 0, flash); });
}
export function makeFlowers(seed = 0) {
  const r = rng(seed + 9); return sprite(26, 14, 13, 10, (c, R) => { for (let i = 0; i < 7; i++) { const x = 3 + r() * 20, y = 3 + r() * 8; R(x, y + 2, 1, 3, '#6d8d6b'); R(x - 1, y, 3, 2, ['#f2b8a8', '#fff3d6', '#f4d49a', '#d8c4ef'][(i + seed) % 4]); } });
}
export function makeBellTower() {
  return sprite(84, 150, 42, 144, (c, R) => {
    R(10, 136, 66, 10, '#00000026');
    R(16, 40, 50, 100, '#b5ad9d'); R(16, 40, 22, 100, '#ccc4b2'); R(56, 40, 10, 100, '#9d9586');
    for (let y = 46; y < 138; y += 10) { R(16, y, 50, 1, '#00000018'); R(y % 20 ? 28 : 40, y, 1, 10, '#00000014'); }
    R(30, 60, 20, 30, '#4f4540'); R(32, 62, 16, 26, '#6c625a'); R(36, 66, 8, 10, '#d4ad5f'); R(37, 66, 6, 2, '#f0d48d'); R(39, 76, 2, 3, '#b48a3c');
    R(28, 112, 26, 28, '#4f4540'); R(30, 114, 22, 26, '#2f2a26');
    R(16, 32, 12, 10, '#ccc4b2'); R(30, 26, 10, 16, '#b5ad9d'); R(46, 36, 10, 6, '#b5ad9d'); R(58, 30, 8, 12, '#9d9586');
    R(4, 132, 12, 8, '#a59d8f'); R(4, 132, 12, 2, '#cfc7b4'); R(66, 128, 14, 10, '#a59d8f'); R(66, 128, 14, 2, '#cfc7b4');
    R(20, 90, 6, 14, '#7f9a72'); R(18, 96, 4, 6, '#94b085'); R(60, 70, 5, 16, '#7f9a72');
  });
}
export function makeCrystals() {
  return sprite(64, 56, 32, 50, (c, R) => {
    R(8, 46, 50, 6, '#00000022');
    const shard = (x, y, w, h, a, b) => { c.fillStyle = a; c.beginPath(); c.moveTo(x, y + h); c.lineTo(x + w / 2, y); c.lineTo(x + w, y + h); c.closePath(); c.fill(); c.fillStyle = b; c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w, y + h); c.lineTo(x + w / 2, y + h); c.closePath(); c.fill(); };
    R(10, 40, 44, 8, '#9d9586'); R(10, 40, 44, 2, '#cfc7b4');
    shard(14, 14, 14, 30, '#c7bfe6', '#a598cf'); shard(26, 2, 16, 42, '#d8d0f2', '#b2a6dc'); shard(40, 18, 12, 26, '#bcd6ea', '#93b6cf'); shard(8, 26, 10, 18, '#bcd6ea', '#93b6cf');
    R(31, 10, 2, 12, '#ffffff'); R(17, 22, 1, 8, '#ffffff');
  });
}
const blobber = R => (x, y, r, col) => { for (let dy = -r; dy <= r; dy++) { const w = Math.round(Math.sqrt(r * r - dy * dy)); R(x - w, y + dy, w * 2, 1, col); } };
export function makeHollowOak() {
  return sprite(120, 132, 60, 126, (c, R) => {
    const blob = blobber(R);
    R(30, 118, 60, 10, '#00000026');
    R(44, 60, 32, 64, '#7b5d45'); R(44, 60, 12, 64, '#94735a'); R(70, 60, 6, 64, '#5f4636'); R(36, 116, 48, 8, '#7b5d45');
    R(52, 92, 16, 24, '#3a2f2b'); R(54, 94, 12, 22, '#26201d'); R(58, 108, 3, 3, '#e7bd74');
    blob(60, 42, 38, '#5f8a62'); blob(40, 50, 24, '#6f9a6d'); blob(82, 48, 24, '#6f9a6d'); blob(56, 30, 24, '#83aa7c'); blob(48, 24, 10, '#a3c693');
  });
}
export function makeAncientTree() {
  return sprite(200, 220, 100, 212, (c, R) => {
    const blob = blobber(R);
    R(40, 202, 120, 14, '#00000030');
    for (const [x, w] of [[60, 20], [118, 22]]) R(x, 190, w, 18, '#5f4636');
    R(76, 90, 48, 120, '#6b5040'); R(76, 90, 16, 120, '#86664f'); R(116, 90, 8, 120, '#4f3a2c');
    blob(100, 70, 66, '#4f7a66'); blob(60, 86, 40, '#5c8a72'); blob(144, 84, 40, '#5c8a72'); blob(96, 46, 44, '#6f9a82'); blob(84, 34, 18, '#8fb8a0');
    for (let i = 0; i < 9; i++) { const x = 50 + (i * 37) % 100, y = 40 + (i * 23) % 70; R(x - 1, y - 1, 5, 5, '#f4e8a044'); R(x, y, 3, 3, '#f4e8a0'); }
    R(92, 150, 16, 18, '#9fd3a8'); R(96, 154, 8, 10, '#d8f2d6');
  });
}
export function makeCampfire(frame = 0) {
  return sprite(40, 34, 20, 28, (c, R) => {
    R(6, 24, 28, 6, '#00000022'); R(8, 22, 24, 4, '#7b5d45'); R(12, 20, 16, 4, '#94735a');
    const f = frame % 2; R(14, 10 + f, 12, 12 - f, '#e8935a'); R(16, 6 + f * 2, 8, 12, '#f4b860'); R(18, 4 + f, 4, 8, '#fff1c4');
    R(26, 26, 10, 4, '#b5ad9d');
  });
}
export function makeBridge() {
  const corners = [gridPoint(BRIDGE.x, BRIDGE.y), gridPoint(BRIDGE.x + BRIDGE.w, BRIDGE.y), gridPoint(BRIDGE.x, BRIDGE.y + BRIDGE.h), gridPoint(BRIDGE.x + BRIDGE.w, BRIDGE.y + BRIDGE.h)];
  const minX = Math.min(...corners.map(p => p.x)) - 4, minY = Math.min(...corners.map(p => p.y)) - 14, maxX = Math.max(...corners.map(p => p.x)) + 4, maxY = Math.max(...corners.map(p => p.y)) + 6;
  const out = sprite(Math.ceil(maxX - minX), Math.ceil(maxY - minY), 0, 0, c => {
    const P = (x, y, z = 0) => { const p = gridPoint(x, y); return [p.x - minX, p.y - minY - z]; };
    const quad = (pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); };
    for (let x = BRIDGE.x; x < BRIDGE.x + BRIDGE.w - .01; x += .34) quad([P(x, BRIDGE.y, 3), P(x + .3, BRIDGE.y, 3), P(x + .3, BRIDGE.y + BRIDGE.h, 3), P(x, BRIDGE.y + BRIDGE.h, 3)], Math.round(x * 3) % 2 ? '#b58b64' : '#c99d70');
    c.strokeStyle = '#7b5d45'; c.lineWidth = 2;
    for (const y of [BRIDGE.y + .05, BRIDGE.y + BRIDGE.h - .05]) { c.beginPath(); c.moveTo(...P(BRIDGE.x, y, 11)); c.lineTo(...P(BRIDGE.x + BRIDGE.w, y, 11)); c.stroke(); for (let x = BRIDGE.x; x <= BRIDGE.x + BRIDGE.w + .01; x += BRIDGE.w / 3) { c.beginPath(); c.moveTo(...P(x, y, 3)); c.lineTo(...P(x, y, 12)); c.stroke(); } }
  });
  out.x = minX; out.y = minY; out.depthY = gridPoint(BRIDGE.x + BRIDGE.w, BRIDGE.y + BRIDGE.h).y; return out;
}
export function makeLogBarrier() {
  return sprite(64, 30, 32, 24, (c, R) => { R(6, 20, 54, 6, '#00000022'); R(4, 10, 56, 10, '#7b5d45'); R(4, 10, 56, 3, '#94735a'); R(2, 10, 6, 10, '#c9a77f'); R(3, 12, 3, 5, '#a8865f'); R(56, 10, 6, 10, '#c9a77f'); R(20, 4, 6, 8, '#7b5d45'); });
}
export function makeFog(seed = 0) {
  const r = rng(seed + 31); return sprite(200, 70, 100, 35, c => { for (let i = 0; i < 6; i++) { const x = 40 + r() * 120, y = 20 + r() * 30, rad = 18 + r() * 22, g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, 'rgba(238,244,241,.5)'); g.addColorStop(1, 'rgba(238,244,241,0)'); c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2); } });
}
export function makeSignText(text, locked = false) {
  return sprite(110, 46, 55, 44, (c, R) => {
    R(53, 18, 4, 28, '#7b5d45'); R(2, 2, 106, 18, '#4f4540'); R(3, 3, 104, 16, locked ? '#e7bd74' : '#d9b27c'); R(3, 3, 104, 2, '#f0d4a0');
    c.fillStyle = '#4f3a2c'; c.font = 'bold 10px "Noto Sans Thai", sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillText(text, 55, 11);
  });
}
