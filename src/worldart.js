/* Pixel sprites for the overworld scenery: farm plots, windmill, pond life, pasture and wildflowers.
   Front-view props return { canvas, footX, footY }; grid-shaped pieces return { canvas, x, y, depthY } in world pixels. */
import { gridPoint } from './guild-art.js';

const Art = () => window.ArtCore;
function sprite(w, h, footX, footY, paint) { const A = Art(), canvas = A.createCanvas(w, h); paint(canvas.getContext('2d'), A); return { canvas, footX, footY }; }
function rand(seed) { let a = (seed * 2654435761) >>> 0 || 7; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }
const pick = (r, list) => list[Math.floor(r() * list.length)];

/** A sprite that covers a rectangle of the ground grid. P(x, y, z) gives canvas pixels for a grid point raised z pixels. */
function isoSprite(x0, y0, x1, y1, up, down, paint) {
  const pts = [gridPoint(x0, y0), gridPoint(x1, y0), gridPoint(x0, y1), gridPoint(x1, y1)];
  const minX = Math.floor(Math.min(...pts.map(p => p.x))) - 3, maxX = Math.ceil(Math.max(...pts.map(p => p.x))) + 3;
  const minY = Math.floor(Math.min(...pts.map(p => p.y))) - up, maxY = Math.ceil(Math.max(...pts.map(p => p.y))) + down;
  const A = Art(), canvas = A.createCanvas(maxX - minX, maxY - minY), c = canvas.getContext('2d');
  const P = (x, y, z = 0) => { const p = gridPoint(x, y); return [Math.round(p.x - minX), Math.round(p.y - minY - z)]; };
  paint(c, P, A);
  return { canvas, x: minX, y: minY, depthY: gridPoint(x1, y1).y };
}
/** Same idea for a small grid-shaped prop that sits on a point: local grid (0,0)..(w,h), foot at its centre. */
function isoProp(w, h, up, paint) {
  const s = isoSprite(0, 0, w, h, up, 4, paint), o = gridPoint(w / 2, h / 2);
  return { canvas: s.canvas, footX: o.x - s.x, footY: o.y - s.y };
}
function isoBox(c, P, A, x, y, w, h, z0, z1, top, left, right) {
  A.poly(c, [P(x, y + h, z0), P(x + w, y + h, z0), P(x + w, y + h, z1), P(x, y + h, z1)], left);
  A.poly(c, [P(x + w, y, z0), P(x + w, y + h, z0), P(x + w, y + h, z1), P(x + w, y, z1)], right);
  A.poly(c, [P(x, y, z1), P(x + w, y, z1), P(x + w, y + h, z1), P(x, y + h, z1)], top);
}

// ---- Farm ----
const WOOD = { post: '#6f533f', postLight: '#9a7a5c', rail: '#b48d5f', railShade: '#7b5d45' };
function fenceRun(c, P, A, ax, ay, bx, by, gate) {
  const len = Math.hypot(bx - ax, by - ay), steps = Math.max(1, Math.round(len)), dx = (bx - ax) / steps, dy = (by - ay) / steps;
  for (let i = 0; i < steps; i++) {
    if (gate && i === gate) continue;
    const x = ax + dx * i, y = ay + dy * i;
    for (const z of [4, 8]) { A.line(c, ...P(x, y, z + 1), ...P(x + dx, y + dy, z + 1), WOOD.railShade); A.line(c, ...P(x, y, z + 2), ...P(x + dx, y + dy, z + 2), WOOD.rail); }
  }
  for (let i = 0; i <= steps; i++) {
    const [px, py] = P(ax + dx * i, ay + dy * i);
    A.rect(c, px - 1, py - 11, 3, 12, WOOD.post); A.rect(c, px - 1, py - 11, 1, 11, WOOD.postLight); A.rect(c, px - 1, py - 12, 3, 1, WOOD.postLight); A.rect(c, px - 2, py, 5, 1, '#00000022');
  }
}
/** Post-and-rail fence around a plot, split so the back two sides sort behind the crop and the front two in front. */
export function makeFieldFence(f, part) {
  const x0 = f.x - .3, y0 = f.y - .3, x1 = f.x + f.w + .3, y1 = f.y + f.h + .3;
  return isoSprite(x0, y0, x1, y1, 16, 3, (c, P, A) => {
    if (part === 'back') { fenceRun(c, P, A, x0, y1, x0, y0); fenceRun(c, P, A, x0, y0, x1, y0); }
    else { fenceRun(c, P, A, x0, y1, x1, y1, Math.round((x1 - x0) / 2)); fenceRun(c, P, A, x1, y0, x1, y1); }
  });
}
/** Ripe wheat in rows; frame 0/1 sway the heads for a breeze. `part` splits the plot at x + y = split so a figure can stand inside it. */
export function makeWheat(f, frame = 0, part = 'all', split = 0) {
  return isoSprite(f.x, f.y, f.x + f.w, f.y + f.h, 20, 2, (c, P, A) => {
    const r = rand(41), plants = [];
    for (let y = f.y + .2; y < f.y + f.h - .05; y += .25) for (let x = f.x + .15; x < f.x + f.w - .1; x += .22) plants.push([x + (r() - .5) * .08, y, r(), r()]);
    plants.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
    for (const [x, y, a, b] of plants) {
      if (part !== 'all' && (x + y < split) !== (part === 'back')) continue;
      const [px, py] = P(x, y), h = 10 + Math.floor(a * 6), sway = (Math.sin(x * 1.7 + y * .9) > 0) === !!frame ? 1 : 0;
      A.rect(c, px, py - h + 2, 1, h - 2, b < .5 ? '#b89a5a' : '#a88b50');
      A.rect(c, px - 1 + sway, py - h - 2, 2, 5, b < .3 ? '#d8b86e' : '#e7cb83'); A.rect(c, px + sway, py - h - 3, 1, 2, '#f4e2a8');
      if (a > .7) A.rect(c, px + 1, py - h + 4, 2, 1, '#c9ab63');
    }
  });
}
/** A kitchen plot: cabbages, carrots and a row of pumpkins. */
export function makeVegPatch(f) {
  return isoSprite(f.x, f.y, f.x + f.w, f.y + f.h, 12, 2, (c, P, A) => {
    const r = rand(77), plants = [];
    for (let y = f.y + .45, row = 0; y < f.y + f.h; y += .75, row++) for (let x = f.x + .35; x < f.x + f.w - .2; x += .6) plants.push([x + (r() - .5) * .1, y, row % 3, r()]);
    plants.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
    for (const [x, y, kind, v] of plants) {
      const [px, py] = P(x, y);
      if (kind === 0) { A.ellipse(c, px, py - 3, 5, 3.5, '#6f9a5c'); A.ellipse(c, px, py - 4, 3.5, 2.5, '#9cc47c'); A.ellipse(c, px - 1, py - 5, 1.6, 1.2, '#c4e0a2'); A.rect(c, px - 4, py - 1, 8, 1, '#00000022'); }
      else if (kind === 1) { for (const d of [-2, 0, 2]) A.line(c, px, py - 1, px + d, py - 7 + Math.abs(d), d ? '#7fa86a' : '#94bc78'); A.rect(c, px - 1, py - 1, 3, 2, '#e08a4a'); A.rect(c, px - 1, py - 1, 1, 1, '#f2b27a'); }
      else { A.ellipse(c, px, py - 3, 4.5, 3, '#d9853e'); A.rect(c, px - 1, py - 6, 1, 5, '#b86a30'); A.rect(c, px + 2, py - 5, 1, 4, '#b86a30'); A.ellipse(c, px - 2, py - 4, 1.2, 1, '#f0b06a'); A.rect(c, px, py - 8, 1, 3, '#6f8a52'); if (v > .5) A.rect(c, px + 1, py - 8, 3, 1, '#7fa86a'); }
    }
  });
}
export function makeScarecrow() {
  return sprite(30, 48, 15, 45, (c, A) => {
    A.ellipse(c, 15, 45, 8, 2, '#00000026');
    A.rect(c, 14, 14, 3, 32, WOOD.post); A.rect(c, 14, 14, 1, 32, WOOD.postLight);
    A.rect(c, 3, 20, 25, 3, WOOD.post); A.rect(c, 3, 20, 25, 1, WOOD.postLight);
    // Patched shirt with straw poking out of the cuffs and hem.
    A.poly(c, [[7, 19], [24, 19], [22, 33], [9, 33]], '#a8604f'); A.poly(c, [[16, 19], [24, 19], [22, 33], [16, 33]], '#8f4f42');
    A.rect(c, 10, 24, 4, 4, '#d8b27c'); A.rect(c, 10, 24, 4, 1, '#ecd1a0'); A.rect(c, 15, 19, 1, 14, '#6f3d35');
    for (const [x, y] of [[3, 19], [1, 21], [26, 19], [28, 21], [10, 33], [13, 34], [18, 34], [21, 33]]) A.rect(c, x, y, 2, 2, '#e6cf8e');
    // Burlap head, stitched smile and a floppy hat.
    A.ellipse(c, 15, 13, 6, 5.5, '#e2cfa0'); A.ellipse(c, 13, 12, 3, 3, '#efe0bb');
    A.rect(c, 12, 12, 2, 2, '#4f4540'); A.rect(c, 17, 12, 2, 2, '#4f4540'); for (let x = 12; x < 19; x += 2) A.rect(c, x, 16, 1, 1, '#8a6446');
    A.rect(c, 5, 8, 21, 3, '#8a6446'); A.rect(c, 5, 8, 21, 1, '#a77a55'); A.poly(c, [[9, 8], [11, 1], [20, 1], [22, 8]], '#9a6b48'); A.rect(c, 10, 5, 12, 2, '#d0705a');
    // A crow keeping it company.
    A.ellipse(c, 25, 17, 2.5, 2, '#3f3a40'); A.rect(c, 26, 14, 2, 2, '#3f3a40'); A.rect(c, 28, 15, 2, 1, '#e8a54a'); A.rect(c, 22, 16, 2, 1, '#2f2a30');
  });
}
export function makeHayBale(seed = 0) {
  return isoProp(1.1, .75, 18, (c, P, A) => {
    const dark = '#a3824a';
    A.poly(c, [P(-.15, .9), P(1.3, .9), P(1.3, -.1), P(-.15, -.1)], '#00000018');
    isoBox(c, P, A, 0, 0, 1.1, .75, 0, 12, '#ecd496', '#d6b86f', '#c0a05e');
    for (const t of [.33, .72]) { A.line(c, ...P(t * 1.1, .75, 0), ...P(t * 1.1, .75, 12), dark); A.line(c, ...P(t * 1.1, .75, 12), ...P(t * 1.1, 0, 12), dark); }
    const r = rand(seed + 5); for (let i = 0; i < 14; i++) { const [x, y] = P(r() * 1.1, r() * .75, 12); A.rect(c, x, y, 2, 1, '#f6e4ae'); }
    for (let i = 0; i < 6; i++) { const [x, y] = P(r() * 1.1, .75, 2 + r() * 8); A.rect(c, x, y, 1, 2, '#bfa060'); }
  });
}
export function makeWindmill() {
  return sprite(64, 118, 32, 114, (c, A) => {
    A.ellipse(c, 32, 113, 24, 5, '#00000026');
    A.rect(c, 10, 98, 44, 15, '#a59d8f'); A.rect(c, 10, 98, 44, 2, '#cfc7b4');
    for (let x = 12; x < 54; x += 8) A.rect(c, x + (x % 16 ? 0 : 4), 101, 1, 5, '#8f877a'); A.rect(c, 10, 105, 44, 1, '#8f877a');
    // Tapered white tower with a shaded east side.
    A.poly(c, [[13, 99], [51, 99], [44, 30], [20, 30]], '#ebe3d1'); A.poly(c, [[36, 99], [51, 99], [44, 30], [36, 30]], '#d3c8b2');
    A.poly(c, [[13, 99], [17, 99], [22, 30], [20, 30]], '#f6f0e2');
    for (const y of [52, 76]) A.rect(c, 16 + (99 - y) * .1, y, 32 - (99 - y) * .2, 1, '#c4b9a2');
    A.rect(c, 26, 82, 12, 17, '#6f533f'); A.rect(c, 27, 83, 10, 16, '#8a6446'); A.rect(c, 31, 83, 1, 16, '#6f533f'); A.rect(c, 26, 81, 12, 2, '#5a463f'); A.rect(c, 34, 90, 1, 2, '#e7bd74');
    A.rect(c, 28, 56, 8, 9, '#5a463f'); A.rect(c, 29, 57, 6, 7, '#9fc0c8'); A.rect(c, 29, 57, 2, 3, '#d8eef0'); A.rect(c, 27, 65, 10, 2, '#9a7a5c');
    // Cap.
    A.poly(c, [[14, 32], [50, 32], [43, 16], [21, 16]], '#a8604f'); A.poly(c, [[32, 32], [50, 32], [43, 16], [32, 16]], '#8f4f42');
    A.poly(c, [[21, 16], [43, 16], [36, 9], [28, 9]], '#c0705c'); A.rect(c, 12, 31, 40, 3, '#6f3d35'); A.rect(c, 30, 5, 3, 5, '#6f533f');
    A.rect(c, 29, 22, 6, 6, '#5a463f'); A.rect(c, 30, 23, 4, 4, '#9a7a5c');
  });
}
/** The windmill sails at an angle (radians), centred on the hub. */
export function makeSails(angle = 0) {
  return sprite(104, 104, 52, 52, (c, A) => {
    const cx = 52, cy = 52, rot = (a, r, s) => [cx + Math.cos(a) * r - Math.sin(a) * s, cy + Math.sin(a) * r + Math.cos(a) * s];
    for (let k = 0; k < 4; k++) {
      const a = angle + k * Math.PI / 2;
      A.poly(c, [rot(a, 11, 1), rot(a, 47, 1), rot(a, 47, 10), rot(a, 11, 8)], '#efe6d2');
      A.poly(c, [rot(a, 11, 6), rot(a, 47, 7), rot(a, 47, 10), rot(a, 11, 8)], '#d9cdb4');
      for (let r = 17; r < 47; r += 7) A.line(c, ...rot(a, r, 1), ...rot(a, r, 9), '#a58463');
      A.line(c, ...rot(a, 11, 10), ...rot(a, 47, 10), '#a58463');
      A.line(c, ...rot(a, 0, 0), ...rot(a, 49, 0), '#5a463f', 2);
    }
    A.ellipse(c, cx, cy, 4, 4, '#5a463f'); A.ellipse(c, cx - 1, cy - 1, 2, 2, '#9a7a5c');
  });
}

// ---- Pond ----
export function makeReeds(seed = 0) {
  const r = rand(seed + 13);
  return sprite(18, 26, 9, 23, (c, A) => {
    A.ellipse(c, 9, 23, 6, 1.5, '#5f7d5a55');
    for (let i = 0; i < 7; i++) { const x = 3 + r() * 12, h = 10 + r() * 11, lean = (r() - .5) * 5; A.line(c, x, 23, x + lean, 23 - h, pick(r, ['#6f8f5a', '#88a66a', '#7d9c62', '#a3bd80'])); if (i < 2 + seed % 2) { A.rect(c, x + lean * .8 - 1, 23 - h * .85, 2, 4, '#8a6446'); A.rect(c, x + lean * .8 - 1, 23 - h * .85, 1, 2, '#a77a55'); } }
    for (let i = 0; i < 2; i++) { const x = 4 + r() * 10; A.line(c, x, 23, x + (i ? 5 : -5), 15, '#94b076'); }
  });
}
export function makeLily(seed = 0) {
  return sprite(16, 9, 8, 5, (c, A) => {
    A.ellipse(c, 8, 5, 6.5, 3, '#6f9a62'); A.ellipse(c, 7, 4, 5, 2.2, '#8fb47a'); A.poly(c, [[8, 5], [14, 3], [14, 6]], '#94bcc6'); A.rect(c, 4, 3, 3, 1, '#a8cc90');
    if (seed === 0) { A.rect(c, 5, 1, 4, 3, '#f2b8c8'); A.rect(c, 6, 0, 2, 1, '#f8d4de'); A.rect(c, 6, 2, 2, 1, '#fff3d6'); }
  });
}
/** A plank jetty running out over the water toward -x; the shore end is at x + w. */
export function makeDock(d) {
  return isoSprite(d.x, d.y, d.x + d.w, d.y + d.h, 10, 12, (c, P, A) => {
    const post = (x, y) => { const [px, py] = P(x, y, 4); A.rect(c, px - 1, py - 2, 3, 10, '#5a463f'); A.rect(c, px - 1, py - 2, 1, 9, '#7b5d45'); A.rect(c, px - 2, py + 7, 5, 1, '#d8eef0'); };
    post(d.x + .1, d.y + .1);
    for (let x = d.x, i = 0; x < d.x + d.w - .01; x += .34, i++) A.poly(c, [P(x, d.y, 4), P(x + .3, d.y, 4), P(x + .3, d.y + d.h, 4), P(x, d.y + d.h, 4)], i % 2 ? '#b58b64' : '#c99d70');
    A.line(c, ...P(d.x, d.y + d.h, 4), ...P(d.x + d.w, d.y + d.h, 4), '#7b5d45'); A.line(c, ...P(d.x, d.y + d.h, 3), ...P(d.x + d.w, d.y + d.h, 3), '#6f533f');
    A.line(c, ...P(d.x, d.y, 4), ...P(d.x, d.y + d.h, 4), '#7b5d45');
    for (const x of [d.x + .1, d.x + d.w * .5]) post(x, d.y + d.h - .1);
    const [bx, by] = P(d.x + .5, d.y + .5, 4); A.rect(c, bx - 3, by - 6, 6, 5, '#9a7a5c'); A.rect(c, bx - 3, by - 6, 6, 1, '#b8946a'); A.rect(c, bx + 4, by - 3, 3, 2, '#6f8fb0');
  });
}
export function makeDuck(frame = 0, plain = false) {
  return sprite(14, 11, 7, 8, (c, A) => {
    A.rect(c, 1 + frame, 9, 4, 1, '#d8eef0'); A.rect(c, 8 - frame, 9, 5, 1, '#d8eef0');
    A.ellipse(c, 6, 7, 4.5, 2.5, plain ? '#f4f0e6' : '#c9b79a'); A.ellipse(c, 5, 6, 3, 1.5, plain ? '#ffffff' : '#ddd0b6'); A.rect(c, 2, 5, 2, 2, plain ? '#e4ddd0' : '#8a7a62');
    A.ellipse(c, 10, 3.5, 2, 2, plain ? '#ffffff' : '#4f8a62'); A.rect(c, 12, 3, 2, 1, '#e8a54a'); A.rect(c, 10, 3, 1, 1, '#2f2a30');
    if (!plain) A.rect(c, 9, 5, 3, 1, '#f4f0e6');
  });
}

// ---- Pasture ----
/** Sheep frames: 0/1 walking, 2 grazing. Faces right; flip for left. */
export function makeSheep(frame = 0) {
  return sprite(22, 18, 11, 16, (c, A) => {
    A.ellipse(c, 11, 16, 8, 1.6, '#00000024');
    const legs = frame === 1 ? [[5, 0], [8, 1], [13, 0], [16, 1]] : [[5, 1], [8, 0], [13, 1], [16, 0]];
    for (const [x, dy] of legs) A.rect(c, x, 12 + dy, 2, 4 - dy, '#4f4540');
    for (const [x, y, rx] of [[6, 9, 4], [10, 7, 5], [14, 9, 4], [10, 11, 6]]) A.ellipse(c, x, y, rx, 3.5, '#d9d1c0');
    for (const [x, y, rx] of [[6, 8, 3.5], [10, 6, 4.5], [14, 8, 3.5], [10, 9, 5]]) A.ellipse(c, x, y, rx, 3, '#f6f2e8');
    A.rect(c, 8, 4, 3, 1, '#ffffff'); A.rect(c, 12, 5, 2, 1, '#ffffff');
    const hy = frame === 2 ? 11 : 6;
    A.ellipse(c, 18, hy, 2.5, 2.5, '#4f4540'); A.rect(c, 15, hy - 1, 2, 2, '#4f4540'); A.rect(c, 16, hy - 3, 2, 1, '#6a5e57');
    if (frame !== 2) A.rect(c, 18, hy - 1, 1, 1, '#fff7ea');
    A.ellipse(c, 16, hy - 2, 2, 1.5, '#f6f2e8');
  });
}

// ---- Wild plants ----
const GREENS = ['#7d9360', '#8fa56c', '#a2b67b', '#b7c98e'];
const DRY = ['#a8935e', '#bba66f', '#cdb980', '#ddcc95'];
function blades(seed, tones, count, height) {
  const r = rand(seed + 3);
  return sprite(22, height + 4, 11, height + 1, (c, A) => {
    const list = Array.from({ length: count }, () => [3 + r() * 16, height * (.45 + r() * .55), (r() - .5) * 6, Math.floor(r() * 4)]).sort((a, b) => a[3] - b[3]);
    for (const [x, h, lean, tone] of list) { A.line(c, x, height + 1, x + lean * .5, height + 1 - h * .6, tones[Math.max(0, tone - 1)]); A.line(c, x + lean * .5, height + 1 - h * .6, x + lean, height + 1 - h, tones[tone]); }
  });
}
export function makeTallGrass(seed = 0) { return blades(seed, GREENS, 13 + seed * 2, 13 + seed * 2); }
export function makeDryGrass(seed = 0) { return blades(seed + 20, DRY, 11, 12); }
const BLOOMS = [
  [['#f2b8c8', '#f8d4de'], ['#fff7ea', '#fffdf6']],
  [['#f4d070', '#fbe6a0'], ['#f0c050', '#f8dc88']],
  [['#b9a3db', '#d2c2ec'], ['#9f88c8', '#bba6e0']],
  [['#e0715f', '#f09a86'], ['#d65a4a', '#ec8572']],
  [['#fffaf0', '#ffffff'], ['#f4f0e6', '#ffffff']],
];
/** A drift of wildflowers. Themes: 0 pink, 1 buttercup, 2 lavender, 3 poppy, 4 daisy. */
export function makeFlowerPatch(theme = 0, seed = 0) {
  const r = rand(theme * 31 + seed * 7 + 1), [a, b] = BLOOMS[theme % 5];
  return sprite(34, 18, 17, 12, (c, A) => {
    for (let i = 0; i < 8; i++) { const x = 3 + r() * 28, y = 8 + r() * 7; A.rect(c, x, y, 2, 1, pick(r, ['#7d9a64', '#8fae72'])); }
    const n = 9 + Math.floor(r() * 5), list = Array.from({ length: n }, () => [3 + r() * 28, 3 + r() * 11, r()]).sort((p, q) => p[1] - q[1]);
    for (const [x, y, v] of list) {
      const [base, light] = v < .6 ? a : b;
      A.rect(c, x, y + 1, 1, 3, '#6d8d5b');
      if (theme === 2) { A.rect(c, x, y - 3, 1, 4, base); A.rect(c, x, y - 3, 1, 1, light); A.rect(c, x - 1, y - 1, 1, 2, base); }
      else if (theme === 4 || theme === 1) { A.rect(c, x - 1, y, 3, 1, base); A.rect(c, x, y - 1, 1, 3, base); A.rect(c, x, y, 1, 1, theme === 4 ? '#f0c860' : '#e6a83a'); }
      else if (theme === 3) { A.rect(c, x - 1, y - 1, 3, 2, base); A.rect(c, x - 1, y - 1, 2, 1, light); A.rect(c, x, y, 1, 1, '#5f3a35'); }
      else { A.rect(c, x - 1, y - 1, 3, 2, base); A.rect(c, x, y - 1, 1, 1, light); }
    }
  });
}
export function makeMushrooms(seed = 0) {
  const r = rand(seed + 61), cap = seed % 2 ? ['#a77a55', '#c49770'] : ['#c9604f', '#e08672'];
  return sprite(16, 13, 8, 11, (c, A) => {
    for (let i = 0; i < 2 + seed % 2; i++) {
      const x = 4 + r() * 8, h = 3 + r() * 3, w = 2 + r() * 2;
      A.rect(c, x - 1, 11 - h, 2, h, '#efe4cc'); A.ellipse(c, x, 11 - h, w + 1, 2, cap[0]); A.rect(c, x - w, 10 - h, w, 1, cap[1]);
      if (!(seed % 2)) A.rect(c, x, 10 - h, 1, 1, '#fff7ea');
    }
  });
}
export function makeStump(seed = 0) {
  return sprite(24, 18, 12, 14, (c, A) => {
    A.ellipse(c, 12, 15, 10, 2.5, '#00000022');
    A.rect(c, 4, 7, 16, 8, '#7b5d45'); A.rect(c, 4, 7, 4, 8, '#94735a'); A.rect(c, 17, 7, 3, 8, '#5f4636'); A.rect(c, 2, 13, 4, 2, '#7b5d45'); A.rect(c, 18, 12, 4, 3, '#6b4f3a');
    A.ellipse(c, 12, 7, 8, 3, '#d9b98a'); A.ellipse(c, 12, 7, 5, 1.8, '#c4a273'); A.ellipse(c, 12, 7, 2, .8, '#d9b98a');
    if (seed % 2) { A.rect(c, 14, 4, 3, 2, '#8fb47a'); A.rect(c, 15, 3, 1, 1, '#a8cc90'); }
  });
}
export function makeButterfly(frame = 0, tone = 0) {
  const [w, s] = [['#fff7ea', '#e4ddd0'], ['#f4d070', '#d9b050'], ['#a8c6e8', '#86a8d0'], ['#f2b8c8', '#d898aa']][tone % 4];
  return sprite(8, 6, 4, 5, (c, A) => {
    A.rect(c, 3, 1, 1, 4, '#4f4540');
    if (frame) { A.rect(c, 1, 1, 2, 2, w); A.rect(c, 4, 1, 2, 2, w); A.rect(c, 1, 3, 2, 1, s); A.rect(c, 4, 3, 2, 1, s); A.rect(c, 0, 1, 1, 1, w); A.rect(c, 6, 1, 1, 1, w); }
    else { A.rect(c, 2, 0, 1, 3, w); A.rect(c, 4, 0, 1, 3, w); }
  });
}
