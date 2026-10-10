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
  lake: [[-30, 24], [-30.6, 27], [-30.2, 30], [-30.4, 31.9]],
  north: [[2, 8], [2, -2], [2, -12], [1, -20], [5, -28], [2, -36], [-2, -44], [2, -52], [4, -58]],
  mistdeep: [[-2, -44], [-7, -47], [-10, -50]],
  east: [[20, 17.5], [34, 17.5], [42, 17.5], [48, 15], [54, 10], [58, 4], [62, -1]],
  hills: [[48, 15], [54, 18], [59, 20]],
};
export const RIVER = [[47, -70], [45, -42], [40, -20], [42, 0], [41, 17.5], [38, 34], [33, 60]];
export const LAKE = { x: -37, y: 32, rx: 6.5, ry: 4.5 };
export const BRIDGE = { x: 39.6, y: 16.6, w: 3.4, h: 1.8 };
export const QUEST_SITES = {
  patrol: { x: -18, y: 21.6 }, herbs: { x: -28.6, y: 30.4 }, escort: { x: 46.5, y: 16.2 },
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

// ---- Meadow scene: hand-placed farm, windmill, pond and pasture west of the village. ----
export const FIELDS = [
  { kind: 'wheat', x: -27.5, y: 10.5, w: 6, h: 4.5 },
  { kind: 'veg', x: -20, y: 12, w: 3.5, h: 3 },
];
export const DOCK = { x: -33.9, y: 31.4, w: 3.4, h: 1 };

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const TONES = {
  base: ['#9cac7d', '#a3b283', '#94a576'].map(hex), meadow: ['#a9ba84', '#b2c28b', '#a0b27c'].map(hex),
  forest: ['#8b9d6d', '#93a474', '#829566'].map(hex), mist: ['#768e7e', '#7d9585', '#6e8677'].map(hex),
  hills: ['#b3ae86', '#bab48c', '#aaa57e'].map(hex),
  dirt: ['#ddc9a2', '#d4bf97', '#e4d2ad'].map(hex), dirtEdge: hex('#c4ad86'), pebble: hex('#bfb39b'),
  water: ['#94bcc6', '#9cc4cd'].map(hex), shine: hex('#c8e3e7'), bank: hex('#7c9372'), sand: hex('#cfc19a'),
  wheatSoil: ['#b39d6d', '#a28c5f'].map(hex), vegSoil: ['#8f7656', '#7c6548'].map(hex),
  plaza: ['#cdc6b2', '#bfb8a3'].map(hex), plazaLine: hex('#a9a28e'),
};
const GRASS = ['meadow', 'forest', 'hills', 'mist'], DARK = Object.fromEntries(['base', ...GRASS].map(k => [k, TONES[k][2].map(c => c - 14)]));
function segmentsNear(lines, x0, y0, x1, y1, pad) { const out = []; for (const pts of lines) for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if (Math.max(a.x, b.x) < x0 - pad || Math.min(a.x, b.x) > x1 + pad || Math.max(a.y, b.y) < y0 - pad || Math.min(a.y, b.y) > y1 + pad) continue; out.push([a, b]); } return out; }
function segDist(segs, x, y) { let best = 1e9; for (const [a, b] of segs) { const dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy || 1, t = clamp01(((x - a.x) * dx + (y - a.y) * dy) / len), px = a.x + dx * t - x, py = a.y + dy * t - y; best = Math.min(best, px * px + py * py); } return Math.sqrt(best); }

/**
 * Crisp pixel ground for one chunk of the world, painted a few rows at a time.
 * (left, top) are world pixels; the canvas covers size × size world pixels at `scale` world pixels per canvas pixel.
 */
export function makeGroundPainter(left, top, size, scale = 2) {
  const n = Math.ceil(size / scale), canvas = document.createElement('canvas'); canvas.width = n; canvas.height = n;
  const c = canvas.getContext('2d'), img = c.createImageData(n, n), d = img.data, o = gridPoint(0, 0);
  const toGrid = (px, py) => { const A = (left + px * scale - o.x) / 24, B = (top + py * scale - o.y) / 12; return [(A + B) / 2, (B - A) / 2]; };
  const corners = [toGrid(0, 0), toGrid(n, 0), toGrid(0, n), toGrid(n, n)], gx0 = Math.min(...corners.map(p => p[0])), gx1 = Math.max(...corners.map(p => p[0])), gy0 = Math.min(...corners.map(p => p[1])), gy1 = Math.max(...corners.map(p => p[1]));
  const paths = segmentsNear(Object.values(SMOOTH), gx0, gy0, gx1, gy1, 3), river = segmentsNear([SMOOTH_RIVER], gx0, gy0, gx1, gy1, 4);
  const fields = FIELDS.filter(f => f.x < gx1 + 1 && f.x + f.w > gx0 - 1 && f.y < gy1 + 1 && f.y + f.h > gy0 - 1);
  // Smooth fields (distances, biome weights) are sampled every L canvas pixels and interpolated; detail stays per pixel.
  const L = 4, cols = Math.ceil(n / L) + 2, F = 9, lattice = new Map();
  function latticeRow(j) {
    let r = lattice.get(j); if (r) return r;
    r = new Float32Array(cols * F);
    for (let k = 0; k < cols; k++) {
      const [x, y] = toGrid(k * L, j * L), o = k * F, w = biomeAt(x, y);
      r[o] = river.length ? segDist(river, x, y) : 99; r[o + 1] = Math.hypot((x - LAKE.x) / LAKE.rx, (y - LAKE.y) / LAKE.ry);
      r[o + 2] = paths.length ? segDist(paths, x, y) : 99; r[o + 3] = Math.hypot(x - 63, y + 3) - 4.6 - (noise(x * .45, y * .45) - .5) * 2.4;
      r[o + 4] = w.meadow; r[o + 5] = w.forest; r[o + 6] = w.hills; r[o + 7] = w.mist; r[o + 8] = noise(x * .55, y * .55);
    }
    lattice.set(j, r); lattice.delete(j - 2); return r;
  }
  const v = new Float32Array(F);
  let row = 0;
  const put = (i, col) => { d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; };
  function pixel(px, py) {
    const A = (left + (px + .5) * scale - o.x) / 24, B = (top + (py + .5) * scale - o.y) / 12, x = (A + B) / 2, y = (B - A) / 2, i = (py * n + px) * 4, t = BAYER[(py & 3) * 4 + (px & 3)], h = hash2(px + Math.floor(left / scale), py + Math.floor(top / scale));
    const j = Math.floor(py / L), k = Math.floor(px / L), fy = (py - j * L) / L, fx = (px - k * L) / L, r0 = latticeRow(j), r1 = latticeRow(j + 1), q = k * F;
    for (let f = 0; f < F; f++) { const a = r0[q + f] + (r0[q + F + f] - r0[q + f]) * fx, b = r1[q + f] + (r1[q + F + f] - r1[q + f]) * fx; v[f] = a + (b - a) * fy; }
    const rd = v[0], ld = v[1], pd = v[2], pz = v[3];
    // Water: river and lake, with a darker wet bank and a few glints.
    if (rd < 2.05 || ld < 1) { put(i, h < .01 || (t < .3 && noise(x * 2.2, y * .8) > .8) ? TONES.shine : TONES.water[noise(x * 1.3, y * 1.3) + t * .3 > .75 ? 1 : 0]); return; }
    if (rd < 2.5 || ld < 1.12) { put(i, (rd < 2.25 || ld < 1.05) && t < .55 ? TONES.bank : TONES.sand); return; }
    // Paths: dirt with a dithered edge and the odd pebble.
    if (pd < .5) { put(i, h < .02 ? TONES.pebble : TONES.dirt[noise(x * 2, y * 2) > .62 ? 1 : h < .3 ? 2 : 0]); return; }
    if (pd < .66 && t < (.66 - pd) / .16) { put(i, TONES.dirtEdge); return; }
    // Farm plots: furrows that follow the grid.
    for (const f of fields) if (x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h) { const tones = f.kind === 'wheat' ? TONES.wheatSoil : TONES.vegSoil; put(i, tones[Math.floor((y - f.y) * 4) % 2]); return; }
    // Ruins plaza: worn flagstones fraying into the grass.
    if (pz < 0 || (pz < .5 && t < (.5 - pz) / .5)) { const sx = x / .8, sy = y / .8 + (Math.floor(x / .8) % 2) * .5, edge = (sx - Math.floor(sx) < .12) || (sy - Math.floor(sy) < .14); put(i, h < .03 ? TONES.hills[2] : edge ? TONES.plazaLine : TONES.plaza[hash2(Math.floor(sx), Math.floor(sy)) < .5 ? 0 : 1]); return; }
    // Grass: biomes dithered against each other, with tonal clumps.
    let key = 'base', best = 0;
    for (let b = 0; b < 4; b++) { const w = v[4 + b]; if (w > t * .9 + .05 && w > best * .6) { key = GRASS[b]; best = w; } }
    const tones = TONES[key], clump = v[8] + (hash2(Math.floor(x * 2.4), Math.floor(y * 2.4)) - .5) * .25;
    put(i, tones[clump > .66 + t * .08 ? 1 : clump < .3 + t * .08 ? 2 : 0]);
    if (h < .01) put(i, DARK[key]);
  }
  return { canvas, size: n, scale, left, top, step(budgetRows = 24) { const end = Math.min(n, row + budgetRows); for (; row < end; row++) for (let px = 0; px < n; px++) pixel(px, row); if (row >= n) c.putImageData(img, 0, 0); return row >= n; } };
}

/** Hand-placed meadow pieces west of the village; the rest of the world is scattered by biome below. */
export const MEADOW_BOX = { x0: -50, y0: 4, x1: -10, y1: 40 };
export const MEADOW_SCENE = {
  barn: { x: -30, y: 9.6 }, windmill: { x: -35.5, y: 13.5 }, scarecrow: { x: -24.4, y: 12.8 },
  hay: [[-33.4, 11.2], [-26.6, 7.6], [-25.3, 8]], lamps: [[-6, 16.1], [-15.5, 17.4], [-27.5, 22.4]],
  trees: [[-22.5, 31, 3, 0], [-41, 18.5, 5, 1], [-45, 29, 1, 0], [-46.5, 31.6, 6, 0], [-14.5, 28.5, 7, 1], [-37, 7, 2, 0], [-43.5, 25, 4, 1]],
  pasture: { x: -21, y: 29, r: 3.6 },
};
export function scatterMeadow() {
  const r = rng(808), items = [], clear = (x, y) => nearPath(x, y, 1.5) || inWater(x, y, .6) || FIELDS.some(f => x > f.x - 1.2 && x < f.x + f.w + 1.2 && y > f.y - 1.2 && y < f.y + f.h + 1.2) || Math.hypot(x - MEADOW_SCENE.windmill.x, y - MEADOW_SCENE.windmill.y) < 3 || Math.hypot(x - MEADOW_SCENE.barn.x, y - MEADOW_SCENE.barn.y) < 3.2 || MEADOW_SCENE.trees.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < 1.6) || Object.values(QUEST_SITES).some(s => Math.hypot(s.x - x, s.y - y) < 2.4);
  for (let y = MEADOW_BOX.y0; y < MEADOW_BOX.y1; y += 1.1) for (let x = MEADOW_BOX.x0; x < MEADOW_BOX.x1; x += 1.1) {
    const jx = x + (r() - .5) * .9, jy = y + (r() - .5) * .9, roll = r(), theme = Math.floor(noise(jx * .12 + 40, jy * .12) * 4.99);
    if (clear(jx, jy) || Math.hypot(jx - VILLAGE.x, jy - VILLAGE.y) < 17) continue;
    const bloom = noise(jx * .22, jy * .22), grass = noise(jx * .3 + 9, jy * .3 + 3);
    if (bloom > .62 && roll < .75) items.push({ kind: 'flowers', x: jx, y: jy, theme });
    else if (grass > .58 && roll < .7) items.push({ kind: 'tallgrass', x: jx, y: jy, seed: Math.floor(r() * 3) });
    else if (roll < .035) items.push({ kind: 'bush', x: jx, y: jy, seed: Math.floor(r() * 4), mist: 0 });
    else if (roll < .05) items.push({ kind: 'rock', x: jx, y: jy, seed: Math.floor(r() * 4) });
  }
  // Reeds ring the lake and lily pads float on it.
  for (let a = 0; a < Math.PI * 2; a += .32) { if (Math.abs(a - 5.5) < .5) continue; const k = 1.08 + r() * .08; items.push({ kind: 'reeds', x: LAKE.x + Math.cos(a) * LAKE.rx * k, y: LAKE.y + Math.sin(a) * LAKE.ry * k, seed: Math.floor(r() * 3) }); }
  for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, k = .25 + r() * .6; items.push({ kind: 'lily', x: LAKE.x + Math.cos(a) * LAKE.rx * k, y: LAKE.y + Math.sin(a) * LAKE.ry * k, seed: i % 3 }); }
  return items;
}

/** Everything outside the meadow: woods with clearings, misty trees, rocky hills, and calm grass near home. */
export function scatterNature() {
  const r = rng(5150), items = [];
  const clear = (x, y) => Math.hypot(x - VILLAGE.x, y - VILLAGE.y) < 16 || nearPath(x, y, 1.8) || inWater(x, y, 1) || Object.values(QUEST_SITES).some(s => Math.hypot(s.x - x, s.y - y) < 5) || (x > -2 && x < 34 && y > -4 && y < 26) || (x > MEADOW_BOX.x0 && x < MEADOW_BOX.x1 && y > MEADOW_BOX.y0 && y < MEADOW_BOX.y1);
  for (let y = WORLD.y0 + 1; y < WORLD.y1 - 1; y += 1.7) for (let x = WORLD.x0 + 1; x < WORLD.x1 - 1; x += 1.7) {
    const jx = x + (r() - .5) * 1.4, jy = y + (r() - .5) * 1.4, roll = r(), seed = Math.floor(r() * 8); if (clear(jx, jy)) continue;
    const b = biomeAt(jx, jy), edge = Math.max(0, (Math.hypot(jx - VILLAGE.x, jy - VILLAGE.y) - 52) / 24), glade = noise(jx * .14 + 70, jy * .14) > .66;
    const mist = Math.round(clamp01(b.mist * 1.3) * 3), woods = (b.forest * .42 + b.mist * .36 + edge * .35 * (1 - b.hills)) * (glade ? .08 : 1) + .012;
    if (roll < woods) items.push({ kind: 'tree', x: jx, y: jy, mist, gold: seed % 5 === 0 && b.forest < .5, seed });
    else if (b.hills > .4 && roll < woods + .14) items.push({ kind: 'rock', x: jx, y: jy, seed: seed % 4 });
    else if ((b.forest > .35 || b.mist > .3) && roll < woods + .1) items.push({ kind: glade ? 'flowers' : seed % 3 ? 'mushroom' : 'stump', x: jx, y: jy, theme: 4, seed: seed % 3, mist });
    else if (roll < woods + .05) items.push({ kind: b.hills > .3 ? 'drygrass' : 'tallgrass', x: jx, y: jy, seed: seed % 3, mist });
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
  return sprite(76, 32, 38, 30, (c, R) => {
    R(36, 12, 3, 20, '#6b4f3a'); R(37, 12, 1, 20, '#8a6a4a'); R(1, 1, 74, 13, '#5a463f'); R(2, 2, 72, 11, locked ? '#e7bd74' : '#d9b27c'); R(2, 2, 72, 1, '#f0d4a0'); R(2, 12, 72, 1, '#b48d5f');
    c.fillStyle = '#4f3a2c'; c.font = 'bold 8px "Noto Sans Thai", sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillText(text, 38, 7.5);
  });
}
