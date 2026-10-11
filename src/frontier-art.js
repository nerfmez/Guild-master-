/* The frontier east of the hills (rank B): Red Wind Canyon and Sleeping Dragon Peak.
   Holds the two biomes' geometry (read by the overworld's ground painter), the region's small scenery sprites,
   and decorateFrontier, which places the region's landmarks and scatters its scenery through the world renderer's helpers. */
import { WORLD_PATHS, SITE_QUEST_SITES, FRONTIER_CAMP, FRONTIER_ZONES, siteSmoothPath } from './site.js';
import { makeDryGrass } from './worldart.js';
import { ROCK, paintRock, makeMesa, makeRockArch, makeFrontierCamp, makeHarpyCliff, makeEmberMine, makeWyrmPit, makeDrakeNests, makeWyvernSpire, makeDragonCaldera } from './landmarks.js';

/** Biome centres (grid units); `frontier` tells the overworld these weights come from frontierWeights. */
export const FRONTIER_BIOMES = {
  canyon: { x: 100, y: 19, r: 26, color: [201, 148, 103], frontier: true },
  peak: { x: 127, y: -13, r: 26, color: [108, 102, 112], frontier: true },
};
/** The crater at the summit; lava seams in the ground glow brighter toward it. */
export const CALDERA = { x: 129.8, y: -20.4 };
const clamp01 = v => Math.max(0, Math.min(1, v));
/**
 * Canyon and peak weights at a grid point, given the overworld's edge noise n (-.25..25).
 * Each biome is a soft disc; beyond x≈80 the whole east fades into one or the other so the far corners are never plain grass.
 */
export function frontierWeights(x, y, n) {
  const C = FRONTIER_BIOMES.canyon, P = FRONTIER_BIOMES.peak, dc = Math.hypot(x - C.x, y - C.y) / C.r, dp = Math.hypot(x - P.x, y - P.y) / P.r;
  const east = clamp01((x - 80) / 12 + n * .8), share = clamp01(.5 + (dp - dc) * 2.2);
  return { canyon: Math.max(clamp01((1 - dc) * 1.4 + n), east * share), peak: Math.max(clamp01((1 - dp) * 1.4 + n), east * (1 - share)) };
}
// The same value noise the overworld uses, so scenery agrees with the painted ground.
function hash2(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function noise(x, y) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1); return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; }
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }
const frontierAt = (x, y) => frontierWeights(x, y, noise(x * .09, y * .09) * .5 - .25);

// ---- Small scenery sprites ----
const Art = () => window.ArtCore;
function sprite(w, h, footX, footY, paint) { const A = Art(), canvas = A.createCanvas(w, h); paint(canvas.getContext('2d'), A); return { canvas, footX, footY }; }
function rand(seed) { let a = (seed * 2654435761) >>> 0 || 7; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }
const glow = (c, A, x, y, rx, ry, rgb, a) => { for (let k = 3; k >= 1; k--) A.ellipse(c, x, y, rx * k / 3, ry * k / 3, `rgba(${rgb},${a * (4 - k) / 3})`); };
/** Rounded stones of the given palette, lit from the upper left. */
function stones(c, A, list, pal) {
  for (const [x, y, rx, ry] of list) { A.ellipse(c, x, y + 1, rx + 1, ry + 1, pal[0]); A.ellipse(c, x, y, rx, ry, pal[1]); A.ellipse(c, x - rx * .25, y - ry * .3, rx * .68, ry * .58, pal[2]); A.ellipse(c, x - rx * .42, y - ry * .5, rx * .28, ry * .22, pal[3]); A.rect(c, x - rx * .1, y + ry * .55, rx * .8, 1, pal[0]); }
}
const RED = ['#7a3f2c', '#b56a48', '#d08a5e', '#ecb98a'], SLATE = ['#221f26', '#3f3a45', '#575060', '#7d7588'];
export function makeRedBoulder(seed = 0) {
  const r = rand(seed + 1301);
  return sprite(54, 38, 27, 32, (c, A) => {
    A.ellipse(c, 28, 32, 24, 4, '#00000026');
    stones(c, A, [[18 + r() * 4, 22, 12 + r() * 3, 10], [35 + r() * 3, 25, 9, 7], [26, 28, 7, 4]], RED);
    A.rect(c, 14, 17, 10, 1, '#e0aa70'); A.rect(c, 31, 22, 6, 1, '#e0aa70');
  });
}
/** Hoodoo: a tall weathered column with a darker cap stone balanced on top. */
export function makeHoodoo(seed = 0) {
  const r = rand(seed + 1331), H = 40 + seed * 14, w = 44, h = H + 22, cx = 22, footY = h - 5;
  return sprite(w, h, cx, footY, (c, A) => {
    A.ellipse(c, cx + 2, footY, 16, 3.5, '#00000026');
    const stepsL = Array.from({ length: 30 }, () => Math.floor(r() * 3) - 1);
    paintRock(c, A, y => { const t = (footY - y) / H; if (t < 0 || t > 1) return []; const half = 9 - Math.sin(t * Math.PI * 2.2) * 2.4 - t * 2 + (t < .12 ? (0.12 - t) * 30 : 0), s = stepsL[Math.floor((footY - y) / 4) % 30]; return [[cx - half + s, cx + half]]; }, footY - H, footY, ROCK.canyon, 5 + seed, seed + 61);
    const capY = footY - H; stones(c, A, [[cx + 1, capY - 3, 12, 6]], ['#5a3428', '#8a4a33', '#a55c3c', '#c97a52']);
    A.rect(c, cx - 6, capY - 8, 7, 1, '#d08a5e');
  });
}
export function makeDryShrub(seed = 0) {
  const r = rand(seed + 1361);
  return sprite(34, 28, 17, 24, (c, A) => {
    A.ellipse(c, 17, 24, 13, 3, '#00000024');
    for (let k = 0; k < 16; k++) { const a = Math.PI * (1.05 + r() * .9), len = 7 + r() * 9; A.line(c, 17, 23, 17 + Math.cos(a) * len, 23 + Math.sin(a) * len * .9, k % 3 ? '#8a6a4a' : '#6b4f3a'); }
    for (let k = 0; k < 14; k++) { const x = 6 + r() * 22, y = 8 + r() * 12; A.rect(c, x, y, 2, 1, k % 3 ? '#a59a62' : '#c2b678'); }
    if (seed % 3 === 1) for (let k = 0; k < 4; k++) A.rect(c, 8 + r() * 18, 8 + r() * 10, 1, 1, '#e8935a');
  });
}
/** Desert succulents: a ribbed barrel with a crown of flowers, a spiky rosette, or a paddle plant. */
export function makeSucculent(seed = 0) {
  const r = rand(seed + 1391), kind = seed % 3;
  return sprite(34, 40, 17, 36, (c, A) => {
    A.ellipse(c, 17, 36, 11, 3, '#00000026');
    if (kind === 0) {
      A.ellipse(c, 17, 26, 9, 11, '#4f6f50'); A.ellipse(c, 15, 24, 7, 9, '#6c8f62'); A.ellipse(c, 13, 21, 3, 5, '#8fb37a');
      for (const x of [11, 15, 19, 23]) A.line(c, x, 17, x, 35, '#3f5a42');
      for (let k = 0; k < 8; k++) A.rect(c, 9 + r() * 16, 18 + r() * 16, 1, 1, '#efe6d2');
      for (const [x, col] of [[13, '#e86a7a'], [17, '#f4b860'], [21, '#e86a7a']]) { A.rect(c, x - 1, 14, 3, 2, col); A.rect(c, x, 13, 1, 1, '#fff1c4'); }
    } else if (kind === 1) {
      for (let k = 0; k < 11; k++) { const a = Math.PI * (1.08 + k / 10 * .84), len = 10 + (k % 3) * 4; A.line(c, 17, 34, 17 + Math.cos(a) * len, 34 + Math.sin(a) * len, '#4f6f50', 2); A.line(c, 17, 33, 17 + Math.cos(a) * (len - 2), 33 + Math.sin(a) * (len - 2), k < 5 ? '#8fb37a' : '#6c8f62'); A.rect(c, 17 + Math.cos(a) * len, 34 + Math.sin(a) * len, 1, 1, '#c9584a'); }
      A.line(c, 17, 30, 18, 6, '#8a7a4a', 1); for (let k = 0; k < 4; k++) A.rect(c, 16 + (k % 2) * 2, 6 + k * 3, 2, 2, '#f2cf6a');
    } else {
      const pad = (x, y, rx, ry, col) => { A.ellipse(c, x, y, rx + 1, ry + 1, '#3f5a42'); A.ellipse(c, x, y, rx, ry, col); A.ellipse(c, x - rx * .3, y - ry * .3, rx * .4, ry * .4, '#8fb37a'); };
      pad(17, 28, 6, 8, '#6c8f62'); pad(11, 18, 5, 6, '#6c8f62'); pad(23, 17, 4.5, 6, '#5f8258'); pad(16, 10, 4, 5, '#6c8f62');
      for (let k = 0; k < 10; k++) A.rect(c, 8 + r() * 18, 6 + r() * 26, 1, 1, '#efe6d2');
      A.rect(c, 22, 10, 3, 3, '#e86a7a'); A.rect(c, 15, 4, 3, 3, '#f4b860');
    }
  });
}
export function makeBones(seed = 0) {
  return sprite(46, 26, 23, 21, (c, A) => {
    const bone = '#efe6d2', dark = '#c9bea5';
    A.ellipse(c, 23, 21, 18, 3, '#00000020');
    if (seed % 2 === 0) {
      for (let k = 0; k < 5; k++) { const x = 9 + k * 6; A.line(c, x, 21, x + 4, 7 + Math.abs(k - 2) * 2, dark, 2); A.line(c, x, 20, x + 4, 6 + Math.abs(k - 2) * 2, bone); }
      A.line(c, 6, 18, 40, 15, dark, 2); A.line(c, 6, 17, 40, 14, bone);
    } else {
      A.ellipse(c, 18, 16, 9, 6, dark); A.ellipse(c, 17, 15, 8, 5, bone); A.ellipse(c, 14, 15, 2, 2, '#4a3f3a'); A.ellipse(c, 20, 15, 2, 2, '#4a3f3a');
      A.poly(c, [[10, 12], [3, 4], [12, 10]], dark); A.poly(c, [[24, 12], [32, 3], [22, 10]], dark); A.rect(c, 14, 19, 7, 2, dark);
      A.line(c, 30, 20, 42, 17, dark, 2); A.ellipse(c, 42, 17, 2, 2, bone); A.ellipse(c, 30, 20, 2, 2, bone);
    }
  });
}
/** Sharp glassy spires of obsidian, with violet glints. */
export function makeObsidianSpire(seed = 0) {
  const r = rand(seed + 1421), H = 30 + seed * 12;
  return sprite(46, H + 14, 23, H + 9, (c, A) => {
    const foot = H + 9; A.ellipse(c, 23, foot, 17, 3.5, '#00000030');
    const shard = (x, w, h, lean) => { A.poly(c, [[x - w / 2, foot], [x + lean, foot - h], [x + w / 2, foot]], '#2a2530'); A.poly(c, [[x - w / 2, foot], [x + lean, foot - h], [x - w / 8, foot]], '#4a4258'); A.line(c, x + lean, foot - h + 2, x - w / 8, foot - 2, '#8a7fa4'); A.rect(c, x + lean - 1, foot - h + 3, 1, 2, '#c4b8e0'); };
    shard(14, 12, H * .55, -3); shard(24, 16, H, 1 + r() * 2); shard(33, 10, H * .4, 3);
    stones(c, A, [[10, foot - 2, 4, 2.5], [37, foot - 1, 3, 2]], SLATE);
  });
}
export function makeAshRock(seed = 0) {
  const r = rand(seed + 1451);
  return sprite(54, 36, 27, 31, (c, A) => {
    A.ellipse(c, 27, 31, 23, 4, '#00000030');
    stones(c, A, [[19 + r() * 3, 22, 12, 9], [35, 24, 9, 7], [27, 27, 7, 4]], SLATE);
    A.rect(c, 15, 15, 6, 1, '#8a8394'); if (seed % 2) { A.line(c, 18, 26, 27, 23, '#b3402a'); A.rect(c, 22, 24, 2, 1, '#f7a04a'); }
    for (let k = 0; k < 4; k++) A.rect(c, 10 + r() * 34, 14 + r() * 12, 2, 1, '#8c8689');
  });
}
/** A lava vent: a cone of black rock with a glowing throat and a breath of steam (three frames). */
export function makeLavaVent(seed = 0, frame = 0) {
  const r = rand(seed + 1481), f = frame % 3;
  return sprite(56, 64, 28, 56, (c, A) => {
    glow(c, A, 28, 46, 26, 12, '247,140,60', .16 + f * .05);
    A.ellipse(c, 28, 56, 22, 5, '#00000030');
    A.poly(c, [[6, 56], [18, 42], [38, 42], [50, 56]], '#2b2730'); A.poly(c, [[6, 56], [18, 42], [26, 42], [20, 56]], '#4a4452'); A.poly(c, [[38, 42], [50, 56], [42, 56]], '#1f1c23');
    A.ellipse(c, 28, 42, 10, 3.5, '#3a2a26'); A.ellipse(c, 28, 42, 8, 2.5, f === 1 ? '#f7c35a' : '#ec7a35'); A.ellipse(c, 27, 42, 4, 1.2, '#fff1c4');
    A.line(c, 28, 44, 24, 55, '#d9572e', 2); A.rect(c, 25, 50, 1, 2, '#f7c35a');
    for (let k = 0; k < 3; k++) { const y = 34 - ((f + k) % 3) * 10, a = .5 - ((f + k) % 3) * .14; A.ellipse(c, 28 + (k - 1) * 3 + (seed % 2 ? f : -f), y, 5 + (f + k) % 3 * 2, 4 + (f + k) % 3, `rgba(226,218,214,${a})`); }
    if (f !== 2) { A.rect(c, 24 + r() * 8, 36 - f * 3, 1, 1, '#f7c35a'); A.rect(c, 26 + r() * 6, 33 - f * 4, 1, 1, '#ffcf7a'); }
  });
}
/** A fumarole: a crack in the slate breathing pale steam (three frames). */
export function makeSteamVent(seed = 0, frame = 0) {
  const f = frame % 3;
  return sprite(40, 54, 20, 48, (c, A) => {
    A.ellipse(c, 20, 47, 14, 4, '#3a3540'); A.ellipse(c, 20, 47, 9, 2.2, '#1f1c23'); A.rect(c, 13, 45, 4, 1, '#d9cf9a'); A.rect(c, 24, 48, 3, 1, '#e8df9e');
    for (let k = 0; k < 4; k++) { const s = (f + k) % 4, y = 42 - s * 9, a = .55 - s * .12; A.ellipse(c, 20 + Math.sin(k + seed) * 3 + s, y, 4 + s * 2, 3 + s, `rgba(236,232,228,${a})`); }
  });
}
export function makeCharredSnag(seed = 0) {
  const r = rand(seed + 1511);
  return sprite(40, 56, 20, 52, (c, A) => {
    A.ellipse(c, 20, 52, 10, 2.5, '#00000030');
    A.poly(c, [[16, 52], [24, 52], [22, 20], [19, 14], [18, 20]], '#2b2428'); A.poly(c, [[16, 52], [19, 52], [19, 18], [18, 20]], '#4a3f46');
    for (const [x0, y0, x1, y1] of [[20, 32, 8, 20], [21, 26, 32, 14], [8, 20, 5, 12], [32, 14, 35, 8], [21, 40, 30, 34]]) A.line(c, x0, y0, x1, y1, '#2b2428', 2);
    for (let k = 0; k < 4; k++) A.rect(c, 17 + r() * 5, 24 + r() * 24, 1, 2, '#b3402a');
    A.rect(c, 13, 51, 14, 2, '#8c8689');
  });
}
/** Fire lilies: the only flowers that bloom in ash. */
export function makeFireLily(seed = 0, frame = 0) {
  const r = rand(seed + 1541);
  return sprite(30, 26, 15, 22, (c, A) => {
    A.ellipse(c, 15, 22, 10, 2.5, '#00000026');
    for (let k = 0; k < 4; k++) { const x = 7 + k * 5 + r() * 2, h = 8 + r() * 6; A.line(c, x, 22, x + (r() - .5) * 3, 22 - h, '#4f6f50'); A.poly(c, [[x - 3, 22 - h], [x, 22 - h - 5], [x + 3, 22 - h], [x, 22 - h + 2]], k % 2 ? '#ec7a35' : '#d9572e'); A.rect(c, x, 22 - h - 2, 1, 1, (k + frame) % 2 ? '#fff1c4' : '#f7c35a'); }
  });
}

// ---- Layout: landmark footing next to each quest site ----
const S = SITE_QUEST_SITES;
/** Where each set piece stands relative to its quest site, how much room it needs, and its depth offset. */
export const FRONTIER_LANDMARKS = {
  harpy: { x: S.harpy.x + 2.2, y: S.harpy.y - 3, clear: 5 },
  emberdig: { x: S.emberdig.x + 2, y: S.emberdig.y - 1.4, clear: 5 },
  wyrm: { x: S.wyrm.x, y: S.wyrm.y, clear: 6 },
  drakes: { x: S.drakes.x + 1.6, y: S.drakes.y - 1.4, clear: 4.5 },
  matriarch: { x: S.matriarch.x + 1.8, y: S.matriarch.y - 1.6, clear: 4 },
  dragon: { x: CALDERA.x, y: CALDERA.y, clear: 8.5 },
};
// Hand-placed rock set pieces that frame the canyon.
const MESAS = [[84, 4, 1], [104, 9.5, 0], [114, 26, 2], [93, 34, 1], [79, 26, 0], [124, 34, 0], [138, 20, 2], [108, 44, 1]];
const ARCHES = [[100.5, 30, 0], [131, 10, 1]];
const HOODOO_GROUPS = [[89.5, 21, 3], [108.5, 13.2, 2], [97.5, 41, 3], [117.5, 21.5, 2], [80.5, 17.5, 2], [128, 28, 3]];

export function decorateFrontier(api) {
  const { place, anim, at } = api, r = rng(70707), C = FRONTIER_CAMP;
  // Lines no scenery may cover: the trails themselves and each quest's last steps off the trail to its site.
  const trails = ['east', 'frontier', 'peakpath'].map(k => siteSmoothPath(WORLD_PATHS[k], 5));
  const hops = [['canyonroad', 'frontier', 8], ['harpy', 'frontier', 9], ['wyrm', 'frontier', 10], ['emberdig', 'frontier', 12], ['drakes', 'peakpath', 13], ['matriarch', 'peakpath', 14], ['dragon', 'peakpath', 16]]
    .map(([id, path, i]) => [{ x: WORLD_PATHS[path][i][0], y: WORLD_PATHS[path][i][1] }, S[id]]);
  const distLine = (pts, x, y) => { let best = 1e9; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, len = dx * dx + dy * dy || 1, t = clamp01(((x - a.x) * dx + (y - a.y) * dy) / len); best = Math.min(best, Math.hypot(a.x + dx * t - x, a.y + dy * t - y)); } return best; };
  const keep = [{ x: C.x, y: C.y, r: 5.5 }, ...Object.values(FRONTIER_ZONES).map(z => ({ x: z.x, y: z.y, r: z.r + .8 })),
    ...['canyonroad', 'harpy', 'wyrm', 'emberdig', 'drakes', 'matriarch', 'dragon'].map(id => ({ x: S[id].x, y: S[id].y, r: 3.4 })),
    ...Object.values(FRONTIER_LANDMARKS).map(l => ({ x: l.x, y: l.y, r: l.clear })), { x: 73.6, y: 11.6, r: 3.5 }, { x: 110.6, y: 13.2, r: 3.5 }];
  const blocked = (x, y, pad = 1.5) => trails.some(p => distLine(p, x, y) < pad) || hops.some(h => distLine(h, x, y) < pad * .8) || keep.some(k => Math.hypot(k.x - x, k.y - y) < k.r);

  // ---- Landmarks ----
  anim('lm-frontier-camp', f => makeFrontierCamp(0, f), 3, 3, C.x, C.y);
  const L = FRONTIER_LANDMARKS;
  anim('lm-harpy', makeHarpyCliff, 2, 1.2, L.harpy.x, L.harpy.y);
  anim('lm-ember', makeEmberMine, 3, 2.5, L.emberdig.x, L.emberdig.y);
  // The pit is a hollow in the ground: it sorts behind anyone standing in it.
  anim('lm-wyrm', makeWyrmPit, 3, 1.6, L.wyrm.x, L.wyrm.y, at(L.wyrm.x, L.wyrm.y) - 70);
  anim('lm-drakes', makeDrakeNests, 2, 1.4, L.drakes.x, L.drakes.y);
  anim('lm-spire', makeWyvernSpire, 2, 1.1, L.matriarch.x, L.matriarch.y);
  anim('lm-caldera', makeDragonCaldera, 3, 2, L.dragon.x, L.dragon.y);
  for (const [x, y, seed] of MESAS) if (!blocked(x, y, 3)) place('fr-mesa-' + seed, () => makeMesa(seed), x, y);
  for (const [x, y, seed] of ARCHES) if (!blocked(x, y, 3)) place('fr-arch-' + seed, () => makeRockArch(seed), x, y);
  for (const [x, y, n] of HOODOO_GROUPS) for (let k = 0; k < n; k++) { const hx = x + (r() - .5) * 3, hy = y + (r() - .5) * 2.4, seed = Math.floor(r() * 3); if (!blocked(hx, hy, 1.4)) place('fr-hoodoo-' + seed, () => makeHoodoo(seed), hx, hy); }
  const solid = [...MESAS.map(([x, y]) => ({ x, y, r: 4 })), ...ARCHES.map(([x, y]) => ({ x, y, r: 3.6 })), ...HOODOO_GROUPS.map(([x, y]) => ({ x, y, r: 2.2 }))];

  // ---- Scatter: sparse dry scenery, denser in clumps, never on trails, sites, camp or hunting grounds ----
  let vents = 0;
  for (let y = -66; y < 57; y += 1.75) for (let x = 72; x < 149; x += 1.75) {
    const jx = x + (r() - .5) * 1.4, jy = y + (r() - .5) * 1.4, roll = r(), u = r(), seed = Math.floor(r() * 6);
    const w = frontierAt(jx, jy), f = w.canyon + w.peak; if (f < .35) continue;
    const clump = noise(jx * .16 + 90, jy * .16 - 30), cal = Math.hypot(jx - CALDERA.x, jy - CALDERA.y), density = .035 + clamp01((clump - .45) * 2.2) * .2 + (cal < 22 ? .05 : 0);
    if (roll > density || blocked(jx, jy) || solid.some(s => Math.hypot(s.x - jx, s.y - jy) < s.r)) continue;
    if (w.canyon >= w.peak) {
      if (u < .26) place('fr-shrub-' + seed % 3, () => makeDryShrub(seed % 3), jx, jy);
      else if (u < .42) place('fr-rock-' + seed % 4, () => makeRedBoulder(seed % 4), jx, jy);
      else if (u < .56) place('fr-succ-' + seed % 3, () => makeSucculent(seed % 3), jx, jy);
      else if (u < .66) place('fr-hoodoo-' + seed % 3, () => makeHoodoo(seed % 3), jx, jy);
      else if (u < .72) place('fr-bones-' + seed % 2, () => makeBones(seed % 2), jx, jy, at(jx, jy) - 6);
      else place('wd-' + seed % 3, () => makeDryGrass(seed % 3), jx, jy);
    } else {
      if (u < .26) place('fr-ash-' + seed % 3, () => makeAshRock(seed % 3), jx, jy);
      else if (u < .44) place('fr-spire-' + seed % 3, () => makeObsidianSpire(seed % 3), jx, jy);
      else if (u < .56 && cal < 28 && vents < 18) { vents++; anim('fr-vent-' + seed % 2, fr => makeLavaVent(seed % 2, fr), 3, 3 + (seed % 3), jx, jy); }
      else if (u < .64) { vents++; anim('fr-steam-' + seed % 2, fr => makeSteamVent(seed % 2, fr), 3, 2.5, jx, jy); }
      else if (u < .76) place('fr-snag-' + seed % 3, () => makeCharredSnag(seed % 3), jx, jy);
      else if (u < .88) anim('fr-lily-' + seed % 2, fr => makeFireLily(seed % 2, fr), 2, 1.5, jx, jy);
      else place('fr-bones-' + seed % 2, () => makeBones(seed % 2), jx, jy, at(jx, jy) - 6);
    }
  }
  // A few vents ring the caldera so the summit always smokes.
  for (const [dx, dy, seed] of [[-2, 8.5, 0], [8.5, 3, 1], [-9, -1, 1], [6, -7.5, 0]]) { const x = CALDERA.x + dx, y = CALDERA.y + dy; if (!blocked(x, y, 1.2)) anim('fr-vent-' + seed, fr => makeLavaVent(seed, fr), 3, 3.5, x, y); }
}
