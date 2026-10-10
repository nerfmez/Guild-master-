/* One continuous world around the guild, in the guild's own 2:1 projection.
   Biomes are soft fields that blend into each other: meadow west, woods north fading into mist,
   dry hills east beyond the river. Paths wind out from the village roads to landmark quest sites. */
import { gridPoint } from './guild-art.js';
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
  { x: -14, y: 19.8, text: 'ทุ่งใบชา', region: 'meadow', flip: true },
  { x: 3.8, y: -16, text: 'ป่าหมอกจันทร์', region: 'mist' },
  { x: 45.5, y: 18.8, text: 'ซากหอระฆัง', region: 'ruins' },
];
export const VILLAGE_HOMES = [[-9, 20.5, 31, 'smithy'], [-2, 21.5, 44, 'thatch'], [8, 21.5, 52, 'stone'], [14, 22, 63, 'cabin'], [24, 21.5, 75, 'brick'], [-8, -3, 88, 'tall']];

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
// Each smoothed point knows how far it is from the end of its line (rem) and from its start (run).
function measure(pts) { let run = 0; pts.forEach((p, i) => { if (i) run += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y); p.run = run; }); pts.forEach(p => { p.rem = run - p.run; }); return pts; }
const SMOOTH = Object.fromEntries(Object.entries(PATHS).map(([k, v]) => [k, measure(smoothPath(v))]));
const SMOOTH_RIVER = smoothPath(RIVER, 8);
// A creek rises in the misty woods and winds east under the north road into the river.
export const CREEK = [[-27, -41], [-21, -37.5], [-14, -35], [-8, -32.8], [-2, -33.5], [3.6, -32], [9, -34.5], [15, -33], [21, -35.5], [28, -34], [35, -35.5], [43.6, -32]];
const SMOOTH_CREEK = measure(smoothPath(CREEK, 6));
export const FOOTBRIDGE = { x: 2.3, y: -33, w: 2.4, h: 1.4 };
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
export function inWater(x, y, pad = 0) { return distTo(SMOOTH_RIVER, x, y) < 2.2 + pad || distTo(SMOOTH_CREEK, x, y) < .9 + pad || ((x - LAKE.x) / (LAKE.rx + pad)) ** 2 + ((y - LAKE.y) / (LAKE.ry + pad)) ** 2 < 1; }

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
  plaza: ['#cdc6b2', '#bfb8a3'].map(hex), plazaLine: hex('#a9a28e'), worn: hex('#b9b98a'), mossBank: hex('#6f8a68'),
  litter: ['#b58a5a', '#c4a062', '#9a7a52'].map(hex), moss: hex('#5f7c6c'), bare: ['#c9b98e', '#bfae84'].map(hex), clover: hex('#c4d39c'),
};
function segmentsNear(lines, x0, y0, x1, y1, pad) { const out = []; for (const pts of lines) for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if (Math.max(a.x, b.x) < x0 - pad || Math.min(a.x, b.x) > x1 + pad || Math.max(a.y, b.y) < y0 - pad || Math.min(a.y, b.y) > y1 + pad) continue; out.push([a, b]); } return out; }
function segDist(segs, x, y) { let best = 1e9; for (const [a, b] of segs) { const dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy || 1, t = clamp01(((x - a.x) * dx + (y - a.y) * dy) / len), px = a.x + dx * t - x, py = a.y + dy * t - y; best = Math.min(best, px * px + py * py); } return Math.sqrt(best); }
let nearRem = 0, nearRun = 0;
function segNear(segs, x, y) { let best = 1e9; for (const [a, b] of segs) { const dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy || 1, t = clamp01(((x - a.x) * dx + (y - a.y) * dy) / len), px = a.x + dx * t - x, py = a.y + dy * t - y, d = px * px + py * py; if (d < best) { best = d; nearRem = a.rem + (b.rem - a.rem) * t; nearRun = a.run + (b.run - a.run) * t; } } return Math.sqrt(best); }

/**
 * Crisp pixel ground for one chunk of the world, painted a few rows at a time.
 * (left, top) are world pixels; the canvas covers size × size world pixels at `scale` world pixels per canvas pixel.
 */
export function makeGroundPainter(left, top, size, scale = 2) {
  const n = Math.ceil(size / scale), canvas = document.createElement('canvas'); canvas.width = n; canvas.height = n;
  const c = canvas.getContext('2d'), img = c.createImageData(n, n), d = img.data, o = gridPoint(0, 0);
  const toGrid = (px, py) => { const A = (left + px * scale - o.x) / 24, B = (top + py * scale - o.y) / 12; return [(A + B) / 2, (B - A) / 2]; };
  const corners = [toGrid(0, 0), toGrid(n, 0), toGrid(0, n), toGrid(n, n)], gx0 = Math.min(...corners.map(p => p[0])), gx1 = Math.max(...corners.map(p => p[0])), gy0 = Math.min(...corners.map(p => p[1])), gy1 = Math.max(...corners.map(p => p[1]));
  const paths = segmentsNear(Object.values(SMOOTH), gx0, gy0, gx1, gy1, 3), river = segmentsNear([SMOOTH_RIVER], gx0, gy0, gx1, gy1, 4), creek = segmentsNear([SMOOTH_CREEK], gx0, gy0, gx1, gy1, 3);
  const fields = FIELDS.filter(f => f.x < gx1 + 1 && f.x + f.w > gx0 - 1 && f.y < gy1 + 1 && f.y + f.h > gy0 - 1);
  // Smooth fields (distances, biome weights) are sampled every L canvas pixels and interpolated; detail stays per pixel.
  const L = 4, cols = Math.ceil(n / L) + 2, F = 15, lattice = new Map();
  function latticeRow(j) {
    let r = lattice.get(j); if (r) return r;
    r = new Float32Array(cols * F);
    for (let k = 0; k < cols; k++) {
      const [x, y] = toGrid(k * L, j * L), o = k * F, w = biomeAt(x, y);
      r[o] = river.length ? segDist(river, x, y) : 99; r[o + 1] = Math.hypot((x - LAKE.x) / LAKE.rx, (y - LAKE.y) / LAKE.ry);
      r[o + 2] = paths.length ? segNear(paths, x, y) : 99; r[o + 9] = paths.length ? nearRem : 0; r[o + 11] = Math.hypot(x - VILLAGE.x, y - VILLAGE.y);
      r[o + 10] = creek.length ? segNear(creek, x, y) : 99; r[o + 12] = creek.length ? nearRun : 0; r[o + 13] = noise(x * .32 + 20, y * .32); r[o + 14] = GROVE(x, y); r[o + 3] = Math.hypot(x - 63, y + 3) - 4.6 - (noise(x * .45, y * .45) - .5) * 2.4;
      r[o + 4] = w.meadow; r[o + 5] = w.forest; r[o + 6] = w.hills; r[o + 7] = w.mist; r[o + 8] = noise(x * .55, y * .55);
    }
    lattice.set(j, r); lattice.delete(j - 2); return r;
  }
  let row = 0, r0, r1, q, fx, fy;
  const I = f => { const a = r0[q + f] + (r0[q + F + f] - r0[q + f]) * fx, b = r1[q + f] + (r1[q + F + f] - r1[q + f]) * fx; return a + (b - a) * fy; };
  const put = (i, col) => { d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; };
  function pixel(px, py) {
    const A = (left + (px + .5) * scale - o.x) / 24, B = (top + (py + .5) * scale - o.y) / 12, x = (A + B) / 2, y = (B - A) / 2, i = (py * n + px) * 4, t = BAYER[(py & 3) * 4 + (px & 3)], h = hash2(px + Math.floor(left / scale), py + Math.floor(top / scale));
    const j = Math.floor(py / L), k = Math.floor(px / L); fy = (py - j * L) / L; fx = (px - k * L) / L; r0 = latticeRow(j); r1 = latticeRow(j + 1); q = k * F;
    const rd = I(0), ld = I(1), pd = I(2);
    // Water: river and lake, with a darker wet bank and a few glints.
    if (rd < 2.05 || ld < 1) { put(i, h < .01 || (t < .3 && noise(x * 2.2, y * .8) > .8) ? TONES.shine : TONES.water[noise(x * 1.3, y * 1.3) + t * .3 > .75 ? 1 : 0]); return; }
    if (rd < 2.5 || ld < 1.12) { put(i, (rd < 2.25 || ld < 1.05) && t < .55 ? TONES.bank : TONES.sand); return; }
    // Creek: narrow at its spring, widening toward the river, with mossy banks.
    const cd = I(10), cw = cd < 1.2 ? (.12 + Math.min(1, I(12) / 30) * .5) * Math.min(1, I(12) / 4) : 0;
    if (cd < cw) { put(i, h < .015 || (t < .25 && noise(x * 2.6, y * 2.6) > .78) ? TONES.shine : TONES.water[noise(x * 1.6, y * 1.6) + t * .3 > .7 ? 1 : 0]); return; }
    if (cd < cw + .22) { put(i, t < .6 - (cd - cw) * 2 ? TONES.bank : TONES.mossBank); return; }
    // Paths: solid dirt near the village, wearing into a patchy trail further out and fading away at the end.
    if (pd < 1) {
      const wear = clamp01(1 - (I(11) - 21) / 24), taper = clamp01(I(9) / 6), half = (.24 + .26 * wear) * (.3 + .7 * taper), solid = (.45 + .55 * wear) * (.25 + .75 * taper), a = 1 - pd / half;
      if (a > -.35) {
        const m = noise(x * 1.1 + 3, y * 1.1) * .6 + t * .4, cut = solid * (.6 + a) - (1 - solid) * .2;
        if (a > 0 && m < cut) { put(i, h < .02 ? TONES.pebble : TONES.dirt[noise(x * 2, y * 2) > .62 ? 1 : h < .3 ? 2 : 0]); return; }
        if (m < cut + .16) { put(i, a > -.1 && t < .5 ? TONES.dirtEdge : TONES.worn); return; }
      }
    }
    // Farm plots: furrows that follow the grid.
    for (const f of fields) if (x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h) { const tones = f.kind === 'wheat' ? TONES.wheatSoil : TONES.vegSoil; put(i, tones[Math.floor((y - f.y) * 4) % 2]); return; }
    // Ruins plaza: worn flagstones fraying into the grass.
    const pz = I(3);
    if (pz < 0 || (pz < .5 && t < (.5 - pz) / .5)) { const sx = x / .8, sy = y / .8 + (Math.floor(x / .8) % 2) * .5, edge = (sx - Math.floor(sx) < .12) || (sy - Math.floor(sy) < .14); put(i, h < .03 ? TONES.hills[2] : edge ? TONES.plazaLine : TONES.plaza[hash2(Math.floor(sx), Math.floor(sy)) < .5 ? 0 : 1]); return; }
    // Grass: biome palettes blended by weight, then quantised with an ordered dither so it stays crisp pixel art.
    const wm = I(4), wf = I(5), wh = I(6), ws = I(7), wb = Math.max(0, 1 - wm - wf - wh - ws), tot = wm + wf + wh + ws + wb;
    let key = 'base', best = .3;
    if (wm > best) { key = 'meadow'; best = wm; } if (wf > best) { key = 'forest'; best = wf; } if (wh > best) { key = 'hills'; best = wh; } if (ws > best * .9) { key = 'mist'; best = ws; }
    const clump = I(8) + (hash2(Math.floor(x * 2.4), Math.floor(y * 2.4)) - .5) * .25 - Math.max(0, I(14) - .45) * .5 * Math.min(1, (wf + ws) * 1.6), tone = clump > .66 + t * .08 ? 1 : clump < .3 + t * .08 ? 2 : 0;
    for (let ch = 0; ch < 3; ch++) { const mix = (TONES.base[tone][ch] * wb + TONES.meadow[tone][ch] * wm + TONES.forest[tone][ch] * wf + TONES.hills[tone][ch] * wh + TONES.mist[tone][ch] * ws) / tot; d[i + ch] = Math.floor(mix / 5 + t) * 5; }
    d[i + 3] = 255;
    if (h < .01) { d[i] -= 14; d[i + 1] -= 14; d[i + 2] -= 14; return; }
    // Biome texture: leaf litter in the woods, bare earth on the hills, clover in the meadow.
    if (key === 'forest' || key === 'mist') { if (h > .975) put(i, TONES.litter[Math.floor(h * 997) % 3]); else if (key === 'mist' && clump < .25 && h > .93) put(i, TONES.moss); }
    else if (key === 'hills') { const bare = I(13); if (bare > .72 && t < (bare - .72) * 14) put(i, TONES.bare[h < .5 ? 0 : 1]); else if (h > .985) put(i, TONES.pebble); }
    else if (key === 'meadow' && clump > .72 && h > .96) put(i, TONES.clover);
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
  const r = rng(808), items = [], clear = (x, y) => nearPath(x, y, 1.5) || inWater(x, y, .6) || FIELDS.some(f => x > f.x - 1.2 && x < f.x + f.w + 1.2 && y > f.y - 1.2 && y < f.y + f.h + 1.2) || Math.hypot(x - MEADOW_SCENE.windmill.x, y - MEADOW_SCENE.windmill.y) < 3 || Math.hypot(x - MEADOW_SCENE.barn.x, y - MEADOW_SCENE.barn.y) < 3.2 || MEADOW_SCENE.trees.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < 1.6) || Object.values(QUEST_SITES).some(s => Math.hypot(s.x - x, s.y - y) < 2.4) || Math.hypot(x + 21.4, y - 23.2) < 2.2 || Math.hypot(x + 26.4, y - 31.6) < 2.8;
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

/** Hand-placed scenes in the other areas. */
export const ORCHARD = { x: 1, y: 30, w: 12, h: 6 };
export const WILD_SCENE = {
  camp: { x: -4.5, y: -17 }, deer: { x: -15, y: -22, r: 4 }, goats: { x: 53, y: 4, r: 3.4 },
  circle: { x: -13, y: -58, r: 3.2 },
};
const GROVE = (x, y) => noise(x * .11 + 70, y * .11);
function wildLandmarks() {
  const items = [], W = WILD_SCENE, S = QUEST_SITES;
  // Woodcutter's camp beside the north road.
  items.push({ kind: 'tent', x: W.camp.x - 1, y: W.camp.y - 1 }, { kind: 'woodpile', x: W.camp.x + 1.2, y: W.camp.y - 1.4 }, { kind: 'chop', x: W.camp.x + 1.3, y: W.camp.y + .6 });
  for (const [dx, dy, seed] of [[-2.4, .8, 0], [-1.2, 2, 1], [2.6, 1.8, 0], [.4, -2.8, 1], [-3, -1.6, 0]]) items.push({ kind: 'stump', x: W.camp.x + dx, y: W.camp.y + dy, seed, mist: 0 });
  items.push({ kind: 'log', x: W.camp.x - 2.2, y: W.camp.y + 2.4, seed: 1 });
  // A ring of rune stones in the deep mist.
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; items.push({ kind: 'stone', x: W.circle.x + Math.cos(a) * W.circle.r, y: W.circle.y + Math.sin(a) * W.circle.r * .9, seed: k, rune: true }); }
  items.push({ kind: 'shroom', x: W.circle.x, y: W.circle.y, seed: 2 });
  // The creek's spring: a few mossy stones and reeds where the water rises.
  const [sx, sy] = CREEK[0]; items.push({ kind: 'boulders', x: sx - .9, y: sy - .4, seed: 1 }, { kind: 'reeds', x: sx + .3, y: sy + .9, seed: 0 }, { kind: 'reeds', x: sx - .6, y: sy + .8, seed: 2 }, { kind: 'fern', x: sx + 1, y: sy - .8, seed: 1, mist: 1 });
  // The ruins: broken walls and pillars around the bell tower's plaza, rubble spilling outward.
  const R = S.ruins;
  for (const [dx, dy, seed, len] of [[-4.6, -3.8, 0, 2.6], [1.4, -5, 1, 2], [-5.4, 2, 2, 1.8], [2.6, 3.6, 3, 2.4]]) items.push({ kind: 'wall', x: R.x + dx, y: R.y + dy, seed, len });
  for (const [dx, dy, seed] of [[-3, .2, 0], [-1.4, 3.4, 1], [5.8, 1.2, 2], [.6, -3.6, 3], [4.4, 3.6, 4]]) items.push({ kind: 'pillar', x: R.x + dx, y: R.y + dy, seed });
  for (const [dx, dy, seed] of [[-6.6, -.6, 0], [6.8, 4.4, 1], [-2, 6.2, 2]]) items.push({ kind: 'boulders', x: R.x + dx, y: R.y + dy, seed });
  // Standing stones on the far hill and the crystal outcrop's scree.
  for (const [x, y, seed] of [[71, 13, 1], [72.6, 15, 2], [70, 16.4, 3]]) items.push({ kind: 'stone', x, y, seed, rune: false });
  for (const [x, y, seed] of [[56.4, 25, 3], [63.4, 19.4, 1], [66, 24, 2]]) items.push({ kind: 'boulders', x, y, seed });
  // Orchard south of the village, with beehives at its end.
  for (let y = ORCHARD.y + 1, row = 0; y < ORCHARD.y + ORCHARD.h; y += 2.2, row++) for (let x = ORCHARD.x + 1 + (row % 2) * 1.2; x < ORCHARD.x + ORCHARD.w; x += 2.4) items.push({ kind: 'fruit', x, y, seed: Math.floor(x * 3 + y) % 4 });
  for (let k = 0; k < 3; k++) items.push({ kind: 'hive', x: ORCHARD.x + ORCHARD.w + 1.2, y: ORCHARD.y + 1.2 + k * 1.5 });
  return items;
}
const SCENE_CLEAR = () => [
  { x: WILD_SCENE.camp.x, y: WILD_SCENE.camp.y, r: 4.2 }, { ...WILD_SCENE.deer }, { x: WILD_SCENE.goats.x, y: WILD_SCENE.goats.y, r: 4 },
  { x: WILD_SCENE.circle.x, y: WILD_SCENE.circle.y, r: 4.6 }, { x: QUEST_SITES.ruins.x, y: QUEST_SITES.ruins.y, r: 8 }, { x: 71, y: 14.6, r: 2.6 },
  { x: FOOTBRIDGE.x + 1, y: FOOTBRIDGE.y + .7, r: 2.6 },
  // Breathing room around each quest's set piece.
  { x: QUEST_SITES.hollow.x + 2.6, y: QUEST_SITES.hollow.y - 2, r: 5.5 }, { x: QUEST_SITES.heart.x + 3, y: QUEST_SITES.heart.y - 3, r: 8.5 },
  { x: QUEST_SITES.crystals.x + 2, y: QUEST_SITES.crystals.y - 1.4, r: 5 }, { x: QUEST_SITES.rescue.x - 1, y: QUEST_SITES.rescue.y - 1, r: 5 },
  { x: 0, y: -41, r: 4.5 }, { x: 47.8, y: 14.6, r: 3.5 },
];

/** Everything outside the meadow: groves of mixed trees with open glades, misty pines, dry rocky hills, a southern orchard. */
export function scatterNature() {
  const r = rng(5150), items = wildLandmarks(), zones = SCENE_CLEAR();
  const inOrchard = (x, y) => x > ORCHARD.x - 1 && x < ORCHARD.x + ORCHARD.w + 2.5 && y > ORCHARD.y - 1 && y < ORCHARD.y + ORCHARD.h + 1;
  const clear = (x, y) => Math.hypot(x - VILLAGE.x, y - VILLAGE.y) < 16 || nearPath(x, y, 1.5) || inWater(x, y, .7) || Object.values(QUEST_SITES).some(s => Math.hypot(s.x - x, s.y - y) < 4) || (x > -2 && x < 34 && y > -4 && y < 26) || (x > MEADOW_BOX.x0 && x < MEADOW_BOX.x1 && y > MEADOW_BOX.y0 && y < MEADOW_BOX.y1) || inOrchard(x, y) || zones.some(z => Math.hypot(z.x - x, z.y - y) < z.r);
  for (let y = WORLD.y0 + 1; y < WORLD.y1 - 1; y += 1.45) for (let x = WORLD.x0 + 1; x < WORLD.x1 - 1; x += 1.45) {
    const jx = x + (r() - .5) * 1.2, jy = y + (r() - .5) * 1.2, roll = r(), seed = Math.floor(r() * 8); if (clear(jx, jy)) continue;
    const b = biomeAt(jx, jy), edge = Math.max(0, (Math.hypot(jx - VILLAGE.x, jy - VILLAGE.y) - 50) / 22), grove = GROVE(jx, jy), canopy = clamp01((grove - .4) / .2);
    const mist = Math.round(clamp01(b.mist * 1.3) * 3), woods = (b.forest * .8 + b.mist * .85 + edge * .6 * (1 - b.hills)) * canopy * .7 + b.hills * .015 + .008;
    if (roll < woods) {
      if (b.mist > .35) items.push(seed < 5 ? { kind: 'pine', x: jx, y: jy, seed: seed % 6, tone: 1, mist } : seed < 6 ? { kind: 'dead', x: jx, y: jy, seed: seed % 3, mist } : { kind: 'tree', x: jx, y: jy, seed, mist, gold: false });
      else if (b.hills > .4) items.push({ kind: 'pine', x: jx, y: jy, seed: seed % 6, tone: 2, mist: 0 });
      else if (b.forest > .25 && (jy < -30 ? seed < 5 : seed < 2)) items.push({ kind: 'pine', x: jx, y: jy, seed: seed % 6, tone: 0, mist });
      else items.push({ kind: 'tree', x: jx, y: jy, mist, gold: seed % 5 === 0 && b.forest < .6, seed });
      continue;
    }
    const u = (roll - woods) / (1 - woods);
    if (b.mist > .35) { if (u < .1) items.push({ kind: 'shroom', x: jx, y: jy, seed: seed % 3 }); else if (u < .26) items.push({ kind: 'fern', x: jx, y: jy, seed: seed % 3, mist }); else if (u < .28) items.push({ kind: 'stone', x: jx, y: jy, seed, rune: seed % 3 === 0 }); else if (u < .32) items.push({ kind: 'log', x: jx, y: jy, seed, mist }); }
    else if (b.forest > .3 && canopy > .5) { if (u < .26) items.push({ kind: 'fern', x: jx, y: jy, seed: seed % 3, mist }); else if (u < .33) items.push({ kind: 'mushroom', x: jx, y: jy, seed: seed % 3, mist }); else if (u < .37) items.push({ kind: 'berry', x: jx, y: jy, seed: seed % 2 }); else if (u < .4) items.push({ kind: 'log', x: jx, y: jy, seed, mist }); else if (u < .42) items.push({ kind: 'stump', x: jx, y: jy, seed: seed % 2, mist }); }
    else if (b.forest > .3) { if (u < .22) items.push({ kind: 'flowers', x: jx, y: jy, theme: [4, 0, 2, 1][seed % 4], seed: seed % 2, mist }); else if (u < .36) items.push({ kind: 'tallgrass', x: jx, y: jy, seed: seed % 3, mist }); else if (u < .4) items.push({ kind: 'berry', x: jx, y: jy, seed: seed % 2 }); }
    else if (b.hills > .35) { if (u < .24) items.push({ kind: 'drygrass', x: jx, y: jy, seed: seed % 3 }); else if (u < .3) items.push({ kind: 'rock', x: jx, y: jy, seed: seed % 4 }); else if (u < .315) items.push({ kind: 'boulders', x: jx, y: jy, seed: seed % 4 }); else if (u < .36) items.push({ kind: 'flowers', x: jx, y: jy, theme: 1, seed: seed % 2, mist: 0 }); }
    else { const bloom = noise(jx * .2 + 5, jy * .2) > .6; if (u < .14) items.push({ kind: 'tallgrass', x: jx, y: jy, seed: seed % 3, mist: 0 }); else if (u < (bloom ? .5 : .2)) items.push({ kind: 'flowers', x: jx, y: jy, theme: Math.floor(noise(jx * .12 + 40, jy * .12) * 4.99), seed: seed % 2, mist: 0 }); else if (u < (bloom ? .53 : .23)) items.push({ kind: 'bush', x: jx, y: jy, seed: seed % 4 }); }
  }
  // Reeds and ferns along the creek, willows leaning over the river.
  SMOOTH_CREEK.forEach((p, i) => { if (i % 2) return; const side = i % 4 ? 1 : -1, x = p.x + side * .35, y = p.y + side * .95; if (!nearPath(x, y, 1.2) && Math.hypot(x - FOOTBRIDGE.x - 1, y - FOOTBRIDGE.y) > 2) items.push({ kind: 'reeds', x, y, seed: i % 3 }); });
  SMOOTH_RIVER.forEach((p, i) => { if (i % 7) return; for (const side of [-1, 1]) { const x = p.x + side * 3.4, y = p.y + (r() - .5) * 2; if (!nearPath(x, y, 2) && Math.hypot(x - BRIDGE.x, y - BRIDGE.y) > 4 && r() < .55) items.push({ kind: 'willow', x, y, seed: i % 3 }); } });
  return items;
}

// ---- Landmark and prop sprites. Each returns { canvas, footX, footY }. ----
function sprite(w, h, footX, footY, paint) { const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false; const R = (x, y, ww, hh, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh)); }; paint(c, R); return { canvas, footX, footY }; }
/** Tint a baked sprite toward the mist palette. */
export function mistTint(src, level) {
  if (!level) return src;
  return sprite(src.canvas.width, src.canvas.height, src.footX, src.footY, c => { c.drawImage(src.canvas, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = `rgba(52,86,88,${.15 * level})`; c.fillRect(0, 0, src.canvas.width, src.canvas.height); });
}
export function makeBridge(B = BRIDGE, span = 'x') {
  const corners = [gridPoint(B.x, B.y), gridPoint(B.x + B.w, B.y), gridPoint(B.x, B.y + B.h), gridPoint(B.x + B.w, B.y + B.h)];
  const minX = Math.min(...corners.map(p => p.x)) - 4, minY = Math.min(...corners.map(p => p.y)) - 14, maxX = Math.max(...corners.map(p => p.x)) + 4, maxY = Math.max(...corners.map(p => p.y)) + 6;
  const out = sprite(Math.ceil(maxX - minX), Math.ceil(maxY - minY), 0, 0, c => {
    const P = (x, y, z = 0) => { const p = gridPoint(x, y); return [p.x - minX, p.y - minY - z]; };
    const quad = (pts, col) => { c.fillStyle = col; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fill(); };
    const X = span === 'x', len = X ? B.w : B.h, wid = X ? B.h : B.w, at = (u, v, z) => X ? P(B.x + u, B.y + v, z) : P(B.x + v, B.y + u, z);
    for (let u = 0; u < len - .01; u += .34) quad([at(u, 0, 3), at(u + .3, 0, 3), at(u + .3, wid, 3), at(u, wid, 3)], Math.round(u * 3) % 2 ? '#b58b64' : '#c99d70');
    c.strokeStyle = '#7b5d45'; c.lineWidth = 2;
    for (const v of [.05, wid - .05]) { c.beginPath(); c.moveTo(...at(0, v, 11)); c.lineTo(...at(len, v, 11)); c.stroke(); for (let u = 0; u <= len + .01; u += len / 3) { c.beginPath(); c.moveTo(...at(u, v, 3)); c.lineTo(...at(u, v, 12)); c.stroke(); } }
  });
  out.x = minX; out.y = minY; out.depthY = gridPoint(B.x + B.w, B.y + B.h).y; return out;
}
export function makeFog(seed = 0) {
  const r = rng(seed + 31); return sprite(200, 70, 100, 35, c => { for (let i = 0; i < 6; i++) { const x = 40 + r() * 120, y = 20 + r() * 30, rad = 18 + r() * 22, g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, 'rgba(238,244,241,.5)'); g.addColorStop(1, 'rgba(238,244,241,0)'); c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2); } });
}

// ---- Where monsters live ----
const SPAWNS = [
  ['leafSlime', 'meadow', 7], ['thornling', 'meadow', 3], ['hornHare', 'meadow', 5], ['fuzzBee', 'meadow', 4], ['fluffBoar', 'meadow', 3], ['mushHopper', 'meadow', 2],
  ['pondFrog', 'water', 4], ['waterSlime', 'water', 4],
  ['mushHopper', 'forest', 4], ['acornBeetle', 'forest', 5], ['mossWolf', 'forest', 3], ['hollowKeeper', 'forest', 2], ['fuzzBee', 'forest', 1],
  ['pebbleCrab', 'hills', 5], ['crystalBat', 'hills', 4], ['marbleGolem', 'hills', 4], ['fluffBoar', 'hills', 2],
  ['mistWisp', 'mist', 5], ['lanternGhost', 'mist', 3], ['glowMoth', 'mist', 4], ['bindingRoots', 'mist', 3],
  ['leafSlime', 'base', 3], ['hornHare', 'base', 3], ['fuzzBee', 'base', 2],
];
const HABITAT = {
  meadow: (b, x, y) => b.meadow > .45, forest: (b, x, y) => b.forest > .45 && b.mist < .3, hills: (b, x, y) => b.hills > .45, mist: (b, x, y) => b.mist > .4,
  base: (b, x, y) => b.meadow < .3 && b.forest < .3 && b.hills < .3 && b.mist < .2 && Math.hypot(x - VILLAGE.x, y - VILLAGE.y) < 42,
  water: (b, x, y) => inWater(x, y, 1.6) && !inWater(x, y, .15),
};
/** Monster homes across the world: { id, x, y, r } where r is how far each one wanders. */
export function monsterSpawns() {
  const r = rng(9091), out = [{ id: 'bellGuardian', x: QUEST_SITES.ruins.x - 1, y: QUEST_SITES.ruins.y + 1, r: 2.5 }, { id: 'heartGuardian', x: QUEST_SITES.heart.x - 1, y: QUEST_SITES.heart.y + 4, r: 2.5 }];
  for (const [id, habitat, count] of SPAWNS) for (let n = 0, tries = 0; n < count && tries < 600; tries++) {
    const x = WORLD.x0 + 4 + r() * (WORLD.x1 - WORLD.x0 - 8), y = WORLD.y0 + 4 + r() * (WORLD.y1 - WORLD.y0 - 8), b = biomeAt(x, y);
    if (!HABITAT[habitat](b, x, y) || (habitat !== 'water' && inWater(x, y, .6)) || Math.hypot(x - VILLAGE.x, y - VILLAGE.y) < 19 || out.some(o => Math.hypot(o.x - x, o.y - y) < 3)) continue;
    out.push({ id, x, y, r: habitat === 'water' ? 2 : 3.5 + r() * 2 }); n++;
  }
  return out;
}

