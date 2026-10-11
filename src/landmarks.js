/* Quest landmarks: one hand-drawn set piece per quest, in the guild's pixel style.
   Each maker returns { canvas, footX, footY }; animated ones take a frame number. */
import { gridPoint } from './guild-art.js';

const Art = () => window.ArtCore;
function sprite(w, h, footX, footY, paint) { const A = Art(), canvas = A.createCanvas(w, h); paint(canvas.getContext('2d'), A); return { canvas, footX, footY }; }
function rand(seed) { let a = (seed * 2654435761) >>> 0 || 7; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }
/** Draw in local grid units around a foot point: P(x, y, z) → canvas pixels. */
function iso(footX, footY) { return (x, y, z = 0) => { const p = gridPoint(x, y), o = gridPoint(0, 0); return [Math.round(footX + p.x - o.x), Math.round(footY + p.y - o.y - z)]; }; }

const LEAF = {
  oak: ['#5e6e4e', '#6f8258', '#8a9f6e', '#a2b67f', '#b9c896', '#cfd8ae'],
  mist: ['#2f4a47', '#3b5c57', '#4c716a', '#62897f', '#82a898', '#acd0bc'],
};
/** A big crown built from the village trees' own leaf masses: back masses first, lit ones toward the upper left. */
function canopy(c, A, r, cx, cy, rx, ry, pal, count) {
  const masses = [];
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2, d = .25 + Math.sqrt(r()) * .75, x = cx + Math.cos(a) * rx * d * .78, y = cy + Math.sin(a) * ry * d * .72;
    const lit = (x - cx) / rx + (y - cy) / ry, size = .22 + r() * .14;
    masses.push({ x: Math.round(x), y: Math.round(y), rx: Math.round(rx * size), ry: Math.round(ry * size * 1.05), shade: lit < -.5 ? 3 : lit < .3 ? 2 : 1 });
  }
  masses.push({ x: cx, y: cy, rx: Math.round(rx * .45), ry: Math.round(ry * .5), shade: 2 });
  masses.sort((p, q) => p.y - q.y);
  window.VillageNature.leafMasses(c, masses, pal, r);
}
function bark(c, A, r, x, y, w, h, base, light, dark) {
  A.rect(c, x, y, w, h, base); A.rect(c, x, y, Math.max(2, w * .28), h, light); A.rect(c, x + w - Math.max(2, w * .2), y, Math.max(2, w * .2), h, dark);
  for (let i = 0; i < w / 3; i++) { const lx = x + 2 + r() * (w - 4), ly = y + r() * h * .6; A.rect(c, lx, ly, 1, 6 + r() * h * .35, dark); }
}
/**
 * Buttress roots: each flares out of the trunk's foot and sinks into the ground in a concave curve,
 * so the tree stands on the ground rather than on legs. roots: [dir, length, groundDrop, height].
 */
function rootFlare(c, A, r, cx, groundY, half, roots, pal) {
  for (const [dir, len, drop, hgt] of roots) {
    const sx = cx + dir * half * .7, ex = cx + dir * (half + len), steps = 18, top = [], bot = [];
    for (let k = 0; k <= steps; k++) { const f = k / steps, x = sx + (ex - sx) * f, g = groundY + drop * f; top.push([x, g - hgt * (1 - f) ** 2 - 1.5]); bot.push([x, g + 1.5 + (1 - f) * 1.5]); }
    const lit = dir < 0;
    A.poly(c, [...top, ...bot.slice().reverse()], pal[0]);
    A.poly(c, [...top.map(([x, y]) => [x, y + 1.2]), ...bot.slice().reverse().map(([x, y]) => [x, y - 1])], lit ? pal[1] : pal[3]);
    for (let k = 1; k < steps * .75; k++) { const [x, y] = top[k]; A.rect(c, x, y + 1, 1, 1, lit ? pal[2] : pal[1]); }
    // Moss and grass where the root meets the ground.
    const [tx, ty] = bot[steps]; A.rect(c, tx - 3, ty - 2, 5, 2, '#7f9a6a'); A.rect(c, tx - 1, ty - 4, 1, 3, '#8fae72'); A.rect(c, tx + 2, ty - 3, 1, 2, '#9cb985');
    const [mx, my] = top[Math.round(steps * .45)]; if (r() < .6) A.rect(c, mx - 2, my, 4, 2, '#7f9a6a');
  }
}
const glow = (c, A, x, y, rx, ry, rgb, a) => { for (let k = 3; k >= 1; k--) A.ellipse(c, x, y, rx * k / 3, ry * k / 3, `rgba(${rgb},${a * (4 - k) / 3})`); };

// ---- Forest: the great oak and its hollow ----
export function makeGreatOak() {
  const r = rand(17);
  return sprite(170, 186, 85, 176, (c, A) => {
    A.ellipse(c, 85, 176, 62, 9, '#00000026');
    A.poly(c, [[54, 170], [116, 170], [106, 140], [102, 84], [68, 84], [64, 140]], '#5a4433'); A.poly(c, [[56, 169], [114, 169], [104, 140], [100, 86], [70, 86], [66, 140]], '#7b5d45'); A.poly(c, [[56, 169], [70, 169], [72, 140], [76, 86], [70, 86], [66, 140]], '#97765a');
    rootFlare(c, A, r, 85, 170, 30, [[-1, 30, 2, 20], [-.55, 18, 6, 14], [1, 32, 1, 20], [.6, 20, 6, 15], [-1, 14, -4, 10], [1, 14, -4, 10]], ['#4a382b', '#7b5d45', '#a8876a', '#5f4636']);
    for (let i = 0; i < 14; i++) { const lx = 72 + r() * 28; A.rect(c, lx, 88 + r() * 30, 1, 8 + r() * 24, '#5a4433'); }
    A.poly(c, [[62, 90], [44, 70], [50, 66], [66, 84]], '#7b5d45'); A.poly(c, [[108, 92], [128, 70], [122, 66], [104, 86]], '#6e5340');
    // The hollow: an arched door into the dark, worn steps leading down, a lantern hung beside it.
    A.ellipse(c, 85, 152, 12, 14, '#4f3a2c'); A.rect(c, 73, 152, 24, 17, '#4f3a2c');
    A.ellipse(c, 85, 153, 10, 12, '#231c19'); A.rect(c, 75, 153, 20, 16, '#231c19');
    for (let k = 0; k < 4; k++) { A.rect(c, 77 + k, 166 - k * 3, 16 - k * 2, 2, ['#6b5646', '#5a4a3d', '#4a3d33', '#3a302a'][k]); }
    A.ellipse(c, 85, 146, 4, 3, 'rgba(240,190,110,.18)');
    A.rect(c, 99, 140, 1, 5, '#3f3530'); A.rect(c, 97, 145, 5, 7, '#4f4540'); A.rect(c, 98, 146, 3, 5, '#f4d48a'); glow(c, A, 99, 148, 9, 7, '244,212,138', .22);
    canopy(c, A, r, 85, 62, 82, 56, LEAF.oak, 24);
    // The bell nobody rings, hanging from the low left limb.
    A.line(c, 46, 72, 46, 82, '#5a463f'); A.poly(c, [[41, 92], [51, 92], [49, 83], [43, 83]], '#c9a050'); A.rect(c, 42, 84, 3, 7, '#e8c878'); A.rect(c, 40, 92, 13, 2, '#9a7838'); A.rect(c, 45, 94, 2, 2, '#7a5a28');
    for (const [x, y] of [[50, 174], [122, 173], [60, 176]]) { A.rect(c, x, y - 4, 2, 4, '#efe4cc'); A.ellipse(c, x + 1, y - 4, 3.5, 2, '#c9604f'); A.rect(c, x, y - 5, 1, 1, '#fff7ea'); }
    for (const [x, y] of [[70, 108], [101, 118], [66, 136]]) { A.rect(c, x, y, 5, 3, '#7f9a6a'); A.rect(c, x + 1, y - 1, 2, 1, '#9cb985'); }
  });
}

// ---- Ruins road: the crystal cave ----
export function makeCrystalCave(frame = 0) {
  const r = rand(23);
  return sprite(140, 104, 70, 96, (c, A) => {
    A.ellipse(c, 70, 96, 60, 7, '#00000026');
    // A mound of tumbled stone with moss on top.
    const stones = [[36, 78, 26, 18], [72, 66, 34, 28], [106, 78, 24, 18], [52, 56, 20, 16], [92, 52, 18, 15], [70, 42, 16, 12]];
    for (const [x, y, rx, ry] of stones) { A.ellipse(c, x, y, rx, ry, '#8a867c'); A.ellipse(c, x - rx * .2, y - ry * .25, rx * .78, ry * .66, '#a7a39a'); A.ellipse(c, x - rx * .35, y - ry * .45, rx * .35, ry * .25, '#c2beb4'); }
    for (const [x, y, w] of [[54, 42, 14], [66, 31, 16], [86, 39, 12], [30, 62, 10]]) { A.rect(c, x, y, w, 3, '#7f9a6a'); A.rect(c, x + 2, y - 1, w - 5, 1, '#9cb985'); }
    // Cave mouth glowing from within.
    glow(c, A, 70, 78, 62, 30, '170,150,240', .22 + frame * .06);
    A.ellipse(c, 70, 78, 18, 16, '#4a4352'); A.rect(c, 52, 78, 36, 18, '#4a4352'); A.ellipse(c, 70, 80, 15, 13, '#2a2433'); A.rect(c, 55, 80, 30, 16, '#2a2433');
    A.ellipse(c, 70, 92, 10, 4, '#5a4f7a');
    // Crystal clusters: faceted, two-tone, with bright edges.
    const shard = (x, y, w, h, lean, a, b, hi) => {
      A.poly(c, [[x, y], [x + w / 2 + lean, y - h], [x + w, y]], a); A.poly(c, [[x + w / 2 + lean, y - h], [x + w, y], [x + w / 2, y]], b);
      A.line(c, x + w / 2 + lean, y - h + 1, x + w / 2, y - 1, hi);
    };
    const purple = ['#c7bfe6', '#9f92cf', '#f0ecff'], blue = ['#bcd6ea', '#8fb2cf', '#effaff'];
    for (const [x, y, w, h, lean, p] of [[16, 94, 16, 40, -3, purple], [30, 95, 12, 26, 3, blue], [8, 95, 9, 16, -4, blue], [90, 92, 18, 50, 4, purple], [106, 94, 13, 32, 5, blue], [120, 95, 9, 18, 6, purple], [84, 95, 9, 18, -3, blue], [60, 95, 7, 12, -1, purple], [74, 95, 6, 10, 1, blue], [44, 40, 10, 20, -2, purple], [98, 48, 9, 16, 2, blue]]) shard(x, y, w, h, lean, ...p);
    const sparkles = frame ? [[28, 70], [98, 60], [64, 90], [50, 28]] : [[36, 80], [108, 72], [76, 86], [100, 36]];
    for (const [x, y] of sparkles) { A.rect(c, x, y - 2, 1, 5, '#ffffff'); A.rect(c, x - 2, y, 5, 1, '#ffffff'); }
  });
}

// ---- Ruins: the bell tower ----
export function makeBellTower(frame = 0) {
  const w = 2.3, h = 2.3, H = 132, footX = 76, footY = 214, P = iso(footX, footY), r = rand(31);
  return sprite(156, 224, footX, footY, (c, A) => {
    const quad = (pts, col) => A.poly(c, pts.map(p => P(...p)), col), line = (a, b, col, wd) => A.line(c, ...P(...a), ...P(...b), col, wd);
    A.ellipse(c, footX, footY - 2, 64, 12, '#00000024');
    const x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2;
    // Plinth.
    quad([[x0 - .2, y1 + .2, 0], [x1 + .2, y1 + .2, 0], [x1 + .2, y1 + .2, 8], [x0 - .2, y1 + .2, 8]], '#a59d8f');
    quad([[x1 + .2, y0 - .2, 0], [x1 + .2, y1 + .2, 0], [x1 + .2, y1 + .2, 8], [x1 + .2, y0 - .2, 8]], '#8f877a');
    // Walls with a jagged, broken crown (higher on the left).
    const crown = u => H - 6 + Math.round(Math.sin(u * 5.3) * 5) - (u > .7 ? (u - .7) * 60 : 0);
    // Inner faces of the far walls show above the broken front.
    const back = u => H - 8 + (Math.floor(u * 7) % 2 ? 8 : 0) - (u > .75 ? Math.round((u - .75) * 40) : 0);
    const bl = [[x0, y1, 8], [x0, y0, 8]]; for (let u = 0; u <= 1.001; u += .1) bl.push([x0, y0 + h * u, back(u)]); quad(bl.reverse(), '#857d70');
    const br = [[x0, y0, 8], [x1, y0, 8]]; for (let u = 1; u >= -.001; u -= .1) br.push([x0 + w * u, y0, back(1 - u)]); quad(br, '#7b7366');
    for (let z = 20; z < H - 8; z += 10) { line([x0, y1, z], [x0, y0, z], '#857d70'); line([x0, y0, z], [x1, y0, z], '#7d7568'); }
    const left = [[x0, y1, 8], [x1, y1, 8]]; for (let u = 1; u >= 0; u -= .1) left.push([x0 + w * u, y1, crown(u * .5)]); quad(left, '#ccc4b2');
    const right = [[x1, y1, 8], [x1, y0, 8]]; for (let u = 1; u >= 0; u -= .1) right.push([x1, y0 + h * (1 - u), crown(.5 + (1 - u) * .5)]); quad(right, '#a9a191');
    for (let z = 16; z < H - 8; z += 8) { line([x0, y1, z], [x1, y1, z], '#b3ab99'); line([x1, y1, z], [x1, y0, z], '#958d7f'); for (let u = ((z / 8) % 2) * .25 + .12; u < w; u += .5) { if (z + 8 < crown(u / w * .5)) line([x0 + u, y1, z], [x0 + u, y1, z + 8], '#b3ab99'); if (z + 8 < crown(.5 + u / h * .5)) line([x1, y1 - u, z], [x1, y1 - u, z + 8], '#958d7f'); } }
    line([x1, y1, 8], [x1, y1, H - 10], '#e2dccb');
    // Wall-top caps give the broken crown its thickness.
    for (let u = 0; u < 1; u += .05) { line([x0 + w * u, y1, crown(u * .5)], [x0 + w * (u + .05), y1, crown((u + .05) * .5)], '#e6dfcc', 2); line([x1, y1 - h * u, crown(.5 + u * .5)], [x1, y1 - h * (u + .05), crown(.5 + (u + .05) * .5)], '#cfc7b4', 2); }
    // Belfry arches with the bell visible, and a smaller arch on the shaded face.
    const arch = (at, u, zb, ww, hh, fill) => { const pts = []; for (let k = 0; k <= 8; k++) { const a = Math.PI * k / 8; pts.push(at(u + ww / 2 - Math.cos(a) * ww / 2, zb + hh + Math.sin(a) * ww * 12)); } pts.push(at(u + ww, zb), at(u, zb)); quad(pts, fill); };
    const F = (u, z) => [x0 + u, y1, z], S = (u, z) => [x1, y1 - u, z];
    arch(F, .55, 70, .9, 22, '#5a4f47'); arch(F, .62, 72, .76, 20, '#2f2a26');
    const [bx, by] = P(...F(1, 84)), swing = frame ? 1 : 0; A.line(c, bx, by - 8, bx, by - 3, '#5a463f'); A.poly(c, [[bx - 7 + swing, by + 9], [bx + 7 + swing, by + 9], [bx + 5, by - 3], [bx - 5, by - 3]], '#c9a050'); A.rect(c, bx - 4, by - 1, 3, 9, '#e8c878'); A.rect(c, bx - 8 + swing, by + 9, 17, 2, '#9a7838'); A.rect(c, bx + swing, by + 11, 2, 2, '#7a5a28');
    arch(S, .7, 74, .6, 16, '#4a4540'); arch(S, .76, 76, .48, 14, '#25211e');
    // The sealed door: heavy boards under a glowing rune ring.
    arch(F, .65, 8, .7, 22, '#4f4540'); arch(F, .7, 8, .6, 20, '#6c5444');
    for (let u = .76; u < 1.28; u += .12) line(F(u, 9), F(u, 30), '#55402f');
    const [sx, sy] = P(...F(1, 20)), pulse = frame ? .45 : .3;
    glow(c, A, sx, sy, 16, 14, '140,230,215', pulse);
    A.ellipse(c, sx, sy, 7, 7, '#7fd8c8'); A.ellipse(c, sx, sy, 5, 5, '#4f4540'); A.rect(c, sx - 1, sy - 4, 2, 8, '#bff4ea'); A.rect(c, sx - 4, sy - 1, 8, 2, '#bff4ea');
    // Ivy and moss climbing the lit face.
    for (let k = 0; k < 26; k++) { const u = .05 + r() * .5, z = 10 + r() * 60 * (1 - u); const [ix, iy] = P(...F(u, z)); A.rect(c, ix, iy, 2, 2, r() < .5 ? '#6f9a62' : '#86b076'); }
    for (let k = 0; k < 12; k++) { const u = r() * 1.6, z = 10 + r() * 30; const [ix, iy] = P(...S(u + .2, z)); A.rect(c, ix, iy, 2, 2, '#5f8a5a'); }
    // Fallen blocks at its feet.
    for (const [x, y, z] of [[x1 + .6, y1 - .2, 0], [x0 - .3, y1 + .6, 0], [x1 + .3, y1 + .5, 0]]) { quad([[x, y + .35, z], [x + .45, y + .35, z], [x + .45, y + .35, z + 7], [x, y + .35, z + 7]], '#b5ad9d'); quad([[x, y, z + 7], [x + .45, y, z + 7], [x + .45, y + .35, z + 7], [x, y + .35, z + 7]], '#d6cfbd'); quad([[x + .45, y, z], [x + .45, y + .35, z], [x + .45, y + .35, z + 7], [x + .45, y, z + 7]], '#958d7f'); }
  });
}

// ---- Mist: the heart of the forest ----
export function makeHeartTree(frame = 0) {
  const r = rand(41);
  return sprite(250, 266, 125, 254, (c, A) => {
    A.ellipse(c, 125, 254, 96, 12, '#00000030');
    // A twisting trunk: two strands wound together.
    A.poly(c, [[86, 246], [164, 246], [150, 214], [148, 150], [154, 110], [138, 92], [112, 92], [98, 112], [104, 150], [100, 214]], '#5a4a40');
    A.poly(c, [[86, 246], [108, 246], [110, 214], [110, 160], [118, 120], [112, 92], [98, 112], [104, 150], [100, 214]], '#75625a');
    for (let k = 0; k < 8; k++) A.line(c, 102 + k * 7, 242, 112 + k * 4 + Math.sin(k) * 6, 100, k % 2 ? '#4a3d35' : '#66534a');
    rootFlare(c, A, r, 125, 246, 38, [[-1, 44, 3, 26], [-.6, 26, 7, 18], [1, 46, 2, 26], [.62, 28, 7, 19], [-1, 20, -5, 12], [1, 22, -5, 12], [-.2, 10, 8, 10]], ['#3a2f29', '#5a4a40', '#857066', '#4a3d35']);
    A.poly(c, [[112, 100], [70, 70], [76, 64], [120, 92]], '#5a4a40'); A.poly(c, [[138, 98], [184, 66], [178, 60], [132, 92]], '#4f4038');
    // The heart: a hollow in the trunk where a green light beats.
    const beat = frame ? 1 : 0;
    A.ellipse(c, 126, 176, 15, 19, '#2e2622'); glow(c, A, 126, 174, 26 + beat * 6, 22 + beat * 5, '160,240,200', .3 + beat * .12);
    A.poly(c, [[126, 186], [116, 174], [117, 166], [121, 163], [126, 167], [131, 163], [135, 166], [136, 174]], beat ? '#c4f6dc' : '#9fe8c0');
    A.rect(c, 120, 166, 2, 2, '#ffffff');
    canopy(c, A, r, 125, 74, 116, 66, LEAF.mist, 30);
    // Spirit lights drifting in the canopy, and moss with candles on an offering stone.
    for (let i = 0; i < 14; i++) { const x = 30 + r() * 190, y = 20 + r() * 110, on = (i + frame) % 2; glow(c, A, x, y, 4, 4, '220,250,210', on ? .5 : .25); A.rect(c, x, y, on ? 2 : 1, on ? 2 : 1, '#f4fff0'); }
    A.rect(c, 176, 238, 26, 12, '#8a867e'); A.rect(c, 176, 238, 26, 3, '#a7a39a'); A.rect(c, 178, 235, 22, 3, '#7f9a6a');
    for (const x of [181, 189, 196]) { A.rect(c, x, 229, 2, 6, '#efe6d2'); A.rect(c, x, 227 - frame, 2, 2, '#f4b860'); glow(c, A, x + 1, 227, 4, 4, '244,200,120', .3); }
  });
}

// ---- Mist road: an old stone gate with hanging charms, and stone lanterns ----
/** The gate stands across a road running along grid y; pillars at x = -1.2 and +1.2. */
export function makeMistGate() {
  const footX = 80, footY = 110, P = iso(footX, footY);
  return sprite(160, 126, footX, footY, (c, A) => {
    const pillar = (x) => {
      const [bx, by] = P(x, 0, 0);
      A.ellipse(c, bx, by, 10, 3, '#00000026');
      A.rect(c, bx - 6, by - 76, 12, 76, '#8a8f88'); A.rect(c, bx - 6, by - 76, 4, 76, '#a9ada4'); A.rect(c, bx + 3, by - 76, 3, 76, '#6f746e');
      A.rect(c, bx - 8, by - 6, 16, 6, '#7f847d'); A.rect(c, bx - 8, by - 6, 16, 2, '#a9ada4');
      for (let z = 12; z < 70; z += 13) A.rect(c, bx - 6, by - z, 12, 1, '#767b74');
      A.rect(c, bx - 6, by - 30, 4, 10, '#6f9a76'); A.rect(c, bx + 1, by - 58, 5, 6, '#6f9a76');
    };
    pillar(-1.2); pillar(1.2);
    // Lintel: a heavy slab with upturned ends, and a mossy crown.
    const [lx, ly] = P(-1.2, 0, 80), [rx, ry] = P(1.2, 0, 80);
    A.poly(c, [[lx - 16, ly - 2], [rx + 16, ry - 2], [rx + 18, ry - 10], [rx + 10, ry - 8], [lx - 10, ly - 8], [lx - 18, ly - 10]], '#767b74');
    A.poly(c, [[lx - 16, ly - 2], [rx + 16, ry - 2], [rx + 16, ry + 4], [lx - 16, ly + 4]], '#8a8f88'); A.line(c, lx - 16, ly - 2, rx + 16, ry - 2, '#b9bdb4');
    A.poly(c, [[lx - 8, ly + 12], [rx + 8, ry + 12], [rx + 8, ry + 17], [lx - 8, ly + 17]], '#8a8f88');
    for (let k = 0; k < 9; k++) { const f = k / 8, x = lx - 8 + (rx - lx + 16) * f, y = ly - 8 + (ry - ly) * f; A.rect(c, x, y - 2, 4, 3, k % 2 ? '#6f9a76' : '#86ad88'); }
    // Paper charms on cords.
    for (let k = 0; k < 4; k++) { const f = (k + .5) / 4, x = lx + (rx - lx) * f, y = ly + 17 + (ry - ly) * f; A.line(c, x, y, x, y + 6, '#d9c8a0'); A.rect(c, x - 2, y + 6, 5, 9, '#efe6d2'); A.rect(c, x - 1, y + 8, 3, 1, '#b85a4a'); A.rect(c, x - 1, y + 11, 3, 1, '#b85a4a'); }
  });
}
export function makeStoneLantern(frame = 0) {
  return sprite(26, 44, 13, 40, (c, A) => {
    A.ellipse(c, 13, 40, 9, 2.5, '#00000026');
    A.rect(c, 6, 34, 14, 6, '#7f847d'); A.rect(c, 6, 34, 14, 2, '#a9ada4');
    A.rect(c, 10, 22, 6, 12, '#8a8f88'); A.rect(c, 10, 22, 2, 12, '#a9ada4');
    A.rect(c, 5, 19, 16, 3, '#7f847d');
    A.rect(c, 7, 11, 12, 8, '#8a8f88'); A.rect(c, 10, 12, 6, 6, frame ? '#ffe7a8' : '#f4d48a'); A.rect(c, 12, 13, 2, 4, '#fff7da');
    A.poly(c, [[3, 11], [23, 11], [17, 5], [9, 5]], '#767b74'); A.rect(c, 3, 10, 20, 2, '#a9ada4'); A.rect(c, 12, 2, 2, 3, '#767b74');
    A.rect(c, 4, 9, 5, 2, '#6f9a76'); A.rect(c, 6, 33, 4, 2, '#6f9a76');
    for (let k = 3; k >= 1; k--) A.ellipse(c, 13, 15, 3 + k * 3, 2 + k * 2.4, `rgba(244,212,138,${(frame ? .13 : .1) * (4 - k)})`);
  });
}

// ---- Mist: the lost team's camp ----
export function makeLostCamp() {
  const r = rand(53);
  return sprite(130, 80, 65, 70, (c, A) => {
    A.ellipse(c, 65, 70, 56, 7, '#00000022');
    // A sagging tent with a torn flap.
    A.poly(c, [[14, 66], [42, 26], [48, 26], [76, 62], [76, 66]], '#a3967a'); A.poly(c, [[14, 66], [42, 26], [46, 66]], '#cbbd9a');
    A.poly(c, [[30, 66], [43, 40], [47, 66]], '#3f3833'); A.poly(c, [[43, 40], [52, 52], [47, 62]], '#cbbd9a');
    A.line(c, 42, 26, 42, 66, '#8a7d62'); A.line(c, 48, 26, 80, 68, '#6b5f4a'); A.rect(c, 41, 22, 2, 5, '#6b4f3a');
    // A tattered team flag.
    A.rect(c, 96, 18, 2, 50, '#6b4f3a'); A.poly(c, [[98, 19], [118, 23], [112, 27], [118, 32], [98, 32]], '#b85a4a'); A.rect(c, 102, 23, 6, 4, '#f4e5c9');
    // Packs, a bedroll and a crate, left in a hurry.
    A.rect(c, 78, 54, 14, 12, '#8a6446'); A.rect(c, 78, 54, 14, 2, '#a77a55'); A.line(c, 78, 54, 92, 66, '#6b4f3a'); A.line(c, 92, 54, 78, 66, '#6b4f3a');
    A.ellipse(c, 64, 64, 9, 4, '#6f8fb0'); A.ellipse(c, 60, 63, 4, 3, '#8aa6c4'); A.rect(c, 63, 60, 1, 8, '#4f6a86');
    A.rect(c, 100, 60, 9, 9, '#7b5d45'); A.rect(c, 101, 58, 7, 3, '#94735a'); A.rect(c, 103, 63, 3, 3, '#c9a77f');
    A.rect(c, 22, 66, 10, 6, '#efe6d2'); A.line(c, 23, 68, 30, 68, '#a39b8a'); A.line(c, 23, 70, 28, 70, '#a39b8a');
    for (let k = 0; k < 5; k++) { const x = 52 + k * 7 + r() * 3; A.rect(c, x, 75 - (k % 2), 2, 1, '#5a4a3f'); }
  });
}
/** Campfire inside a ring of stones; three flame frames. */
export function makeCampfire(frame = 0) {
  return sprite(44, 40, 22, 32, (c, A) => {
    A.ellipse(c, 22, 32, 16, 4, '#00000026');
    glow(c, A, 22, 24, 20, 12, '244,180,96', .18 + (frame % 3) * .04);
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, x = 22 + Math.cos(a) * 12, y = 29 + Math.sin(a) * 4.5; A.ellipse(c, x, y, 3, 2, '#9a968c'); A.rect(c, x - 2, y - 2, 2, 1, '#c2beb4'); }
    A.line(c, 13, 30, 30, 25, '#6b4f3a', 3); A.line(c, 14, 25, 31, 30, '#7b5d45', 3);
    const f = frame % 3, sway = [0, 1, -1][f];
    A.poly(c, [[14, 28], [30, 28], [26 + sway, 14 - f], [22 + sway, 6 + f], [18, 16]], '#e8935a');
    A.poly(c, [[17, 28], [27, 28], [24 + sway, 16], [21 + sway, 10 + f], [19, 18]], '#f4b860');
    A.poly(c, [[19, 28], [25, 28], [23, 20], [22 + sway, 16 + f]], '#fff1c4');
    A.rect(c, 25 + sway * 2, 6 - f, 1, 1, '#f4b860'); A.rect(c, 17 - sway, 9 + f, 1, 1, '#e8935a');
  });
}

// ---- Meadow: the bread wagon ----
export function makeBreadWagon(frame = 0) {
  return sprite(124, 82, 62, 74, (c, A) => {
    A.ellipse(c, 62, 74, 54, 6, '#00000024');
    // Donkey, hitched and patient (ears flick between frames).
    A.rect(c, 13, 54, 3, 18, '#6f655d'); A.rect(c, 26, 54, 3, 18, '#6f655d'); A.rect(c, 17, 55, 3, 17, '#857a70'); A.rect(c, 30, 55, 3, 17, '#857a70');
    A.ellipse(c, 23, 50, 13, 8, '#9a8f84'); A.ellipse(c, 21, 47, 9, 4, '#b0a69a'); A.rect(c, 33, 44, 2, 6, '#6f655d');
    A.poly(c, [[10, 46], [4, 36], [0, 40], [2, 50], [8, 52]], '#9a8f84'); A.ellipse(c, 2, 44, 3.5, 4, '#b0a69a'); A.rect(c, 0, 47, 3, 3, '#e8e0d4'); A.rect(c, 4, 40, 1, 1, '#2f2a30');
    A.poly(c, frame ? [[6, 36], [4, 26], [8, 34]] : [[6, 36], [8, 26], [9, 35]], '#857a70'); A.poly(c, [[8, 37], [12, 28], [11, 37]], '#857a70');
    A.line(c, 32, 50, 46, 58, '#5a463f', 2);
    // Wagon bed, big spoked wheels, and a striped canvas hood.
    A.rect(c, 44, 48, 70, 14, '#8a6446'); A.rect(c, 44, 48, 70, 3, '#a77a55'); for (let x = 50; x < 112; x += 9) A.rect(c, x, 51, 1, 11, '#6f4f38');
    const wheel = (x, y, rr) => { A.ellipse(c, x, y, rr, rr, '#5a463f'); A.ellipse(c, x, y, rr - 2, rr - 2, '#9a7a5c'); A.ellipse(c, x, y, rr - 3, rr - 3, '#5a463f'); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4 + frame * .2; A.line(c, x - Math.cos(a) * (rr - 3), y - Math.sin(a) * (rr - 3), x + Math.cos(a) * (rr - 3), y + Math.sin(a) * (rr - 3), '#9a7a5c'); } A.ellipse(c, x, y, 2, 2, '#c9a77f'); };
    wheel(56, 64, 10); wheel(102, 64, 10);
    for (let k = 0; k < 6; k++) { const x0 = 46 + k * 11; A.poly(c, [[x0, 48], [x0 + 11, 48], [x0 + 11, 22 + Math.abs(k - 2.5) * 3], [x0, 22 + Math.abs(k - 2.5) * 3]], k % 2 ? '#efe3c4' : '#d9a088'); }
    A.ellipse(c, 80, 24, 34, 9, '#efe3c4'); A.ellipse(c, 80, 22, 30, 6, '#f8efd8'); A.rect(c, 46, 47, 66, 2, '#c9b78f');
    // Loaves peeking out the back, plus a crate tied on.
    for (const [x, y] of [[106, 42], [110, 44], [104, 46]]) { A.ellipse(c, x, y, 5, 3, '#c98a4a'); A.rect(c, x - 2, y - 2, 4, 1, '#e8b070'); }
    A.rect(c, 60, 38, 12, 10, '#b58b64'); A.rect(c, 60, 38, 12, 2, '#d0a87d'); A.line(c, 60, 43, 72, 43, '#8a6446');
  });
}

// ---- Meadow: the watch post on the village road ----
export function makeWatchPost(frame = 0) {
  return sprite(70, 124, 35, 118, (c, A) => {
    A.ellipse(c, 35, 118, 24, 5, '#00000024');
    for (const [x, d] of [[16, 1], [52, -1]]) { A.line(c, x, 118, x + d * 6, 52, '#6b4f3a', 3); A.line(c, x - 1, 118, x + d * 6 - 1, 52, '#8a6a4a'); }
    A.line(c, 20, 100, 48, 70, '#7b5d45', 2); A.line(c, 48, 100, 20, 70, '#7b5d45', 2);
    // Ladder.
    A.line(c, 26, 118, 30, 54, '#94735a'); A.line(c, 34, 118, 38, 54, '#94735a'); for (let y = 112; y > 56; y -= 8) A.line(c, 26 + (118 - y) / 16, y, 34 + (118 - y) / 16, y, '#b48d5f');
    // Platform, rail and a little roof.
    A.rect(c, 12, 48, 46, 6, '#7b5d45'); A.rect(c, 12, 48, 46, 2, '#a77a55');
    A.rect(c, 12, 36, 2, 12, '#6b4f3a'); A.rect(c, 56, 36, 2, 12, '#6b4f3a'); A.rect(c, 34, 36, 2, 12, '#6b4f3a'); A.rect(c, 12, 36, 46, 2, '#94735a'); A.rect(c, 12, 42, 46, 1, '#94735a');
    A.rect(c, 14, 20, 2, 16, '#6b4f3a'); A.rect(c, 54, 20, 2, 16, '#6b4f3a');
    A.poly(c, [[6, 22], [35, 6], [64, 22], [60, 24], [35, 11], [10, 24]], '#a8604f'); A.poly(c, [[10, 24], [35, 11], [35, 16], [14, 26]], '#c0705c'); A.poly(c, [[35, 11], [60, 24], [56, 26], [35, 16]], '#8f4f42');
    // Brass bell to warn the village, and a pennant in the wind.
    A.line(c, 24, 26, 24, 29, '#5a463f'); A.poly(c, [[20, 35], [28, 35], [27, 29], [21, 29]], '#c9a050'); A.rect(c, 21, 30, 2, 4, '#e8c878');
    A.rect(c, 34, -2 + 6, 1, 4, '#6b4f3a'); A.poly(c, frame ? [[35, 4], [46, 6], [35, 9]] : [[35, 4], [45, 3], [44, 7], [35, 8]], '#6f8fb0');
    A.rect(c, 44, 41, 6, 6, '#e7bd74'); A.rect(c, 45, 42, 4, 4, '#f4d48a');
  });
}

// ---- Meadow: starlight tea ----
export function makeTeaBush(seed = 0, frame = 0) {
  const r = rand(seed + 61);
  return sprite(34, 24, 17, 20, (c, A) => {
    A.ellipse(c, 17, 20, 13, 3, '#00000024');
    A.ellipse(c, 17, 13, 14, 8, '#4f7a58'); A.ellipse(c, 15, 11, 11, 6, '#628f68'); A.ellipse(c, 12, 9, 6, 3.5, '#80aa7e');
    for (let i = 0; i < 14; i++) { const x = 5 + r() * 24, y = 6 + r() * 12; A.rect(c, x, y, 2, 1, r() < .5 ? '#9cc488' : '#3f6a4a'); }
    const stars = [[8, 6], [22, 9], [15, 14], [26, 15], [11, 15]];
    stars.forEach(([x, y], k) => { if ((k + frame + seed) % 2) { A.rect(c, x, y - 1, 1, 3, '#fff6c0'); A.rect(c, x - 1, y, 3, 1, '#fff6c0'); } else A.rect(c, x, y, 1, 1, '#f4e8a0'); });
  });
}
export function makeTeaBasket() {
  return sprite(24, 18, 12, 15, (c, A) => {
    A.ellipse(c, 12, 15, 9, 2, '#00000024');
    A.poly(c, [[4, 8], [20, 8], [18, 15], [6, 15]], '#b48d5f'); for (let x = 6; x < 19; x += 3) A.line(c, x, 9, x - .5, 14, '#94735a'); A.rect(c, 4, 8, 16, 2, '#d0a87d');
    A.line(c, 5, 8, 12, 1, '#94735a', 2); A.line(c, 12, 1, 19, 8, '#94735a', 2);
    for (const [x, y] of [[8, 6], [12, 5], [15, 6]]) { A.rect(c, x, y, 3, 2, '#628f68'); A.rect(c, x, y, 1, 1, '#fff6c0'); }
  });
}

// ---- Signposts ----
/** A post with an arrow board pointing along the road; locked roads hang a warm-yellow notice. */
export function makeSignpost(text, locked = false, flip = false) {
  return sprite(92, 46, 46, 43, (c, A) => {
    A.ellipse(c, 46, 43, 8, 2, '#00000026');
    A.rect(c, 44, 8, 4, 35, '#6b4f3a'); A.rect(c, 44, 8, 1, 35, '#8a6a4a'); A.rect(c, 43, 6, 6, 3, '#5a463f');
    const board = locked ? ['#e7bd74', '#f4d8a0', '#b8904e'] : ['#d9b27c', '#f0d4a0', '#b48d5f'], L = 8, R = 84, tip = flip ? L : R;
    const pts = flip ? [[L, 18], [L + 8, 10], [R, 10], [R, 26], [L + 8, 26]] : [[L, 10], [R - 8, 10], [R, 18], [R - 8, 26], [L, 26]];
    A.poly(c, pts.map(([x, y]) => [x, y + 1]), '#4f3a2c'); A.poly(c, pts, board[0]); A.rect(c, L + 2, 11, R - L - 10, 1, board[1]); A.rect(c, L + 2, 24, R - L - 10, 1, board[2]);
    A.rect(c, tip === R ? L + 3 : R - 6, 17, 2, 2, '#6b4f3a');
    c.fillStyle = '#4f3a2c'; c.font = 'bold 9px "Noto Sans Thai", sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillText(text, 46 + (flip ? 3 : -3), 18.5);
  });
}
/** Crossed-log barricade with a rope and a red pennant. */
export function makeBarricade() {
  return sprite(72, 40, 36, 34, (c, A) => {
    A.ellipse(c, 36, 34, 30, 4, '#00000024');
    for (const [x0, x1] of [[6, 30], [30, 6], [42, 66], [66, 42]]) { A.line(c, x0, 34, x1, 12, '#6b4f3a', 4); A.line(c, x0, 33, x1, 11, '#94735a'); }
    A.rect(c, 4, 18, 64, 6, '#7b5d45'); A.rect(c, 4, 18, 64, 2, '#a77a55'); A.ellipse(c, 4, 21, 3, 3, '#d9b98a'); A.ellipse(c, 68, 21, 3, 3, '#d9b98a');
    A.line(c, 18, 16, 54, 16, '#d9c8a0'); A.poly(c, [[34, 4], [44, 7], [34, 10]], '#c9584a'); A.rect(c, 33, 3, 1, 14, '#5a463f');
  });
}

// ======== The frontier (rank B): Red Wind Canyon and Sleeping Dragon Peak ========
/** Rock palettes: tones run dark → lit; alt is the ochre stratum that bands canyon walls. */
export const ROCK = {
  canyon: { edge: '#6a3828', tones: ['#8a4a33', '#a85e3f', '#c47a50', '#da9866', '#eebb88'], alt: ['#93573a', '#b0703f', '#cc8d58', '#e0aa70', '#f2c992'], strata: 9 },
  peak: { edge: '#16141a', tones: ['#1f1c23', '#2c2831', '#3b3641', '#504957', '#6e6679'], alt: null, strata: 0 },
};
function vhash(x, y, s) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s = 0) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); const a = vhash(ix, iy, s), b = vhash(ix + 1, iy, s), c = vhash(ix, iy + 1, s), d = vhash(ix + 1, iy + 1, s); return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; }
/** Merge overlapping [left, right] spans. */
export function mergeSpans(list) { return list.sort((a, b) => a[0] - b[0]).reduce((acc, sp) => { const last = acc[acc.length - 1]; if (last && sp[0] <= last[1]) last[1] = Math.max(last[1], sp[1]); else acc.push([...sp]); return acc; }, []); }
/**
 * Paint a rock mass pixel by pixel: spans(y) gives the [left, right] spans covering each row.
 * Light comes from the upper left; chunky facets come from coarse noise, canyon walls carry wavy strata,
 * ledges with open sky above catch the light, and the silhouette gets a dark outline.
 * opts: { seed, ridge: { x, y, n } } — ridge adds radial gullies (a volcano's flanks).
 */
export function paintRock(c, A, spans, y0, y1, pal, opts = {}) {
  const seed = opts.seed || 1, rows = new Map();
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) rows.set(y, (spans(y) || []).map(([l, r]) => [Math.round(l), Math.round(r)]).filter(([l, r]) => r > l));
  const covered = (y, x) => (rows.get(y) || []).some(([l, r]) => x >= l && x < r);
  for (const [y, list] of rows) for (const [l, r] of list) {
    const w = r - l;
    for (let x = l; x < r; x++) {
      const u = (x - l) / Math.max(1, w - 1);
      let v = .2 + (1 - u) * .5 + (vnoise(x * .09, y * .12, seed) - .5) * .5 + (vnoise(x * .28, y * .2, seed + 7) - .5) * .14;
      if (opts.ridge) { const a = Math.atan2(x - opts.ridge.x, (y - opts.ridge.y) * 2.2 + 30); v += Math.sin(a * opts.ridge.n + vnoise(x * .05, y * .05, seed) * 3) * .13; }
      if (y > y1 - 4) v -= .12;
      const sky = !covered(y - 1, x), sky2 = !covered(y - 2, x) || !covered(y - 3, x);
      let tones = pal.tones;
      if (pal.strata && Math.sin((y + (vnoise(x * .04, y * .02, seed + 3) - .5) * 14) / pal.strata * Math.PI) > .55) tones = pal.alt;
      let col;
      if (x === l || x === r - 1) col = pal.edge;
      else if (sky) col = u < .75 ? tones[4] : tones[2];
      else if (sky2) col = tones[Math.min(4, Math.max(0, Math.floor(v * 5) + 1))];
      else col = tones[Math.min(4, Math.max(0, Math.floor(v * 5)))];
      // Thin crevices.
      if (!sky && x > l + 1 && x < r - 2 && vhash(Math.floor(x / 2), Math.floor(y / 9), seed + 11) < .05 && vnoise(x * .5, y * .08, seed) > .5) col = tones[0];
      A.rect(c, x, y, 1, 1, col);
    }
    // Outline where the top meets the sky.
    for (let x = l; x < r; x++) if (!covered(y - 1, x)) A.rect(c, x, y - 1, 1, 1, pal.edge);
  }
}
/** Spans for a rough column: half-width given by half(t) (t 0 at the foot, 1 at the top), edges roughened. */
function profile(cx, footY, h, half, seed, rough = 3, lean = 0) {
  return y => { const t = (footY - y) / h; if (t < 0 || t > 1) return []; const hw = half(t), x = cx + lean * t, e = rough; return [[x - hw + (vnoise(y * .18, 1, seed) - .5) * e * 2 + (vhash(y >> 2, 3, seed) - .5) * e, x + hw + (vnoise(y * .18, 9, seed) - .5) * e * 2 + (vhash(y >> 2, 5, seed) - .5) * e]]; };
}
const ember = (c, A, x, y, rx, ry, a) => glow(c, A, x, y, rx, ry, '247,160,80', a);
const tuft = (c, A, x, y, col = '#c9b071') => { A.rect(c, x, y - 3, 1, 3, col); A.rect(c, x + 2, y - 4, 1, 4, '#b39a5e'); A.rect(c, x - 2, y - 2, 1, 2, col); };
const stoneHeap = (c, A, x, y, s) => { A.ellipse(c, x, y, s + 1, s * .75 + 1, ROCK.peak.edge); A.ellipse(c, x, y, s, s * .75, ROCK.peak.tones[2]); A.ellipse(c, x - s * .25, y - s * .25, s * .6, s * .4, ROCK.peak.tones[3]); A.ellipse(c, x - s * .4, y - s * .4, s * .25, s * .15, ROCK.peak.tones[4]); };
const rubble = (c, A, x, y, s, pal) => { A.ellipse(c, x, y, s + 1, s * .6 + 1, pal.edge); A.ellipse(c, x, y, s, s * .6, pal.tones[2]); A.ellipse(c, x - s * .3, y - s * .2, s * .5, s * .3, pal.tones[4]); };

// ---- Canyon: flat-topped mesas and a wind-carved arch ----
export function makeMesa(seed = 0) {
  const r = rand(seed + 701), W = 120 + seed * 16, H = 64 + seed * 14, w = W + 40, h = H + 40, cx = w / 2, footY = h - 12;
  return sprite(w, h, cx, footY, (c, A) => {
    A.ellipse(c, cx + 6, footY, W * .6, 10, '#00000026');
    const top = footY - H, half = t => W / 2 * (t < .25 ? 1.06 - t * .7 : .885 - (t - .25) * .1) * (1 - (t > .6 && t < .66 ? .03 : 0));
    paintRock(c, A, profile(cx, footY, H, half, seed + 3, 4), top, footY, ROCK.canyon, { seed: seed + 3 });
    // The plateau seen from above, ragged at its rim, with dry grass.
    const tw = half(1) - 1, pts = [];
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, j = 1 + (vhash(k, 1, seed) - .5) * .12; pts.push([cx + Math.cos(a) * tw * j, top + 2 + Math.sin(a) * tw * .3 * j]); }
    A.poly(c, pts.map(([x, y]) => [x, y + 1]), '#a85e3f'); A.poly(c, pts, '#e8b47f'); A.poly(c, pts.map(([x, y]) => [cx - 6 + (x - cx) * .7, top + 1 + (y - top) * .6]), '#f2c896');
    for (let k = 0; k < 9; k++) tuft(c, A, cx - tw * .7 + r() * tw * 1.4, top + 1 + r() * tw * .3);
    for (let k = 0; k < 9; k++) rubble(c, A, cx - W * .55 + r() * W * 1.1, footY - 2 - r() * 5, 2 + r() * 3, ROCK.canyon);
  });
}
export function makeRockArch(seed = 0) {
  const r = rand(seed + 733), w = 180, h = 140, footY = 128, cx = 90, H = 104;
  return sprite(w, h, cx, footY, (c, A) => {
    A.ellipse(c, cx, footY, 80, 9, '#00000026');
    const outer = profile(cx, footY, H, t => 72 * (t < .15 ? 1.05 - t * .4 : 1 - Math.pow(Math.max(0, t - .55) / .45, 2.2) * .55), seed + 5, 4);
    const holeW = 40, holeTop = footY - 70;
    const holeSpan = y => { if (y < holeTop) return null; const k = Math.min(1, (y - holeTop) / 26), hw = holeW * Math.sqrt(1 - (1 - k) ** 2) + (vnoise(y * .2, 4, seed) - .5) * 4; return [cx + 4 - hw, cx + 4 + hw]; };
    paintRock(c, A, y => outer(y).flatMap(([l, rr]) => { const hole = holeSpan(y); if (!hole || y > footY - 1) return [[l, rr]]; return [[l, Math.min(rr, hole[0])], [Math.max(l, hole[1]), rr]].filter(([a, b]) => b > a + 1); }), footY - H, footY, ROCK.canyon, { seed: seed + 5 });
    // Warm light under the span.
    for (let k = 0; k < 5; k++) tuft(c, A, cx - 30 + r() * 60, footY - r() * 3);
    for (let k = 0; k < 6; k++) rubble(c, A, cx - 80 + r() * 160, footY - r() * 4, 2 + r() * 3, ROCK.canyon);
  });
}

// ---- Canyon mouth: the guild's frontier camp; level 0..3 adds tents, palisade, cookhouse and a watchtower ----
export function makeFrontierCamp(level = 0, frame = 0) {
  const footX = 140, footY = 168, P = iso(footX, footY), r = rand(91), L = Math.max(0, Math.min(3, level | 0)), E = 2.5;
  return sprite(280, 236, footX, footY, (c, A) => {
    // Trampled ground: soft overlapping patches of packed sand rather than a hard square.
    for (let k = 0; k < 14; k++) { const [x, y] = P(-E * .8 + r() * E * 1.6, -E * .8 + r() * E * 1.6); A.ellipse(c, x, y, 20 + r() * 26, 9 + r() * 10, '#d8b088'); }
    for (let k = 0; k < 10; k++) { const [x, y] = P(-E * .6 + r() * E * 1.2, -E * .6 + r() * E * 1.2); A.ellipse(c, x, y, 14 + r() * 18, 6 + r() * 7, '#e2bd92'); }
    for (let k = 0; k < 50; k++) { const [x, y] = P(-E + r() * E * 2, -E + r() * E * 2); A.rect(c, x, y, 2, 1, r() < .5 ? '#c99a6c' : '#ecc9a0'); }
    const stake = (x, y, hgt) => { const [px, py] = P(x, y); A.rect(c, px - 2, py - hgt, 4, hgt, '#7b5d45'); A.rect(c, px - 2, py - hgt, 1, hgt, '#a77a55'); A.rect(c, px + 1, py - hgt, 1, hgt, '#5a4433'); A.poly(c, [[px - 2, py - hgt], [px + 2, py - hgt], [px, py - hgt - 5]], '#94735a'); A.rect(c, px - 1, py - hgt - 3, 1, 2, '#c49a6c'); };
    const wall = (ax, ay, bx, by, hgt, skip) => { const n = Math.round(Math.hypot(bx - ax, by - ay) / .32), pts = []; for (let i = 0; i <= n; i++) { const t = i / n; if (skip && skip(t)) continue; pts.push([ax + (bx - ax) * t, ay + (by - ay) * t]); } for (const [x, y] of pts) stake(x, y, hgt + Math.round(Math.sin(x * 9 + y * 5) * 2)); for (const z of [hgt * .35, hgt * .7]) for (let i = 1; i < pts.length; i++) if (Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) < .5) A.line(c, ...P(pts[i - 1][0], pts[i - 1][1], z), ...P(pts[i][0], pts[i][1], z), '#d9c8a0'); };
    if (L >= 1) { wall(-E, -E, E, -E, 22); wall(-E, -E, -E, E, 22); }
    const tent = (x, y, s, cloth, stripe) => {
      const [px, py] = P(x, y), w = 30 * s, hh = 30 * s;
      A.ellipse(c, px + 2, py, w * .9, 5 * s, '#00000026');
      A.poly(c, [[px - w, py], [px - 4 * s, py - hh], [px + 4 * s, py - hh], [px + w * .9, py - 4 * s], [px + w * .9, py]], cloth[1]);
      A.poly(c, [[px - w, py], [px - 4 * s, py - hh], [px + 2 * s, py]], cloth[0]);
      A.poly(c, [[px - w * .55, py], [px - 4 * s, py - hh * .62], [px, py]], '#3f3833'); A.poly(c, [[px - 4 * s, py - hh * .62], [px + 3 * s, py - hh * .35], [px, py]], cloth[0]);
      A.line(c, px - w * .85, py - 3 * s, px - 3 * s, py - hh + 3, stripe); A.line(c, px - 4 * s, py - hh, px + 4 * s, py - hh, '#6b4f3a', 2); A.rect(c, px - 5 * s, py - hh - 5 * s, 2, 6 * s, '#6b4f3a');
      A.line(c, px + w * .9, py - 4 * s, px + w * 1.2, py + 1, '#8a7d62'); A.rect(c, px + w * 1.2, py, 2, 2, '#5a4433');
    };
    const crate = (x, y, s = 1) => { const [px, py] = P(x, y); A.rect(c, px - 7 * s, py - 12 * s, 14 * s, 12 * s, '#8a6446'); A.rect(c, px - 7 * s, py - 12 * s, 14 * s, 2, '#b58b64'); A.rect(c, px + 4 * s, py - 10 * s, 3 * s, 10 * s, '#6f4f38'); A.line(c, px - 7 * s, py - 10 * s, px + 4 * s, py, '#6f4f38'); A.rect(c, px - 7 * s, py - 12 * s, 1, 12 * s, '#4f3a2c'); };
    const barrel = (x, y) => { const [px, py] = P(x, y); A.ellipse(c, px, py - 1, 6, 2, '#00000022'); A.rect(c, px - 5, py - 13, 10, 12, '#94643f'); A.rect(c, px - 5, py - 13, 3, 12, '#b5804f'); A.rect(c, px + 3, py - 13, 2, 12, '#6f4a30'); A.rect(c, px - 5, py - 10, 10, 1, '#5a4a3f'); A.rect(c, px - 5, py - 5, 10, 1, '#5a4a3f'); A.ellipse(c, px, py - 13, 5, 2, '#c49a6c'); };
    if (L >= 3) {
      const [tx, ty] = P(-E + .7, -E + .7), H = 92;
      for (const [dx, d] of [[-14, 1], [14, -1]]) { A.line(c, tx + dx, ty, tx + dx + d * 5, ty - H, '#6b4f3a', 3); A.line(c, tx + dx - 1, ty, tx + dx + d * 5 - 1, ty - H, '#8a6a4a'); }
      A.line(c, tx - 12, ty - 20, tx + 11, ty - 54, '#7b5d45', 2); A.line(c, tx + 12, ty - 20, tx - 11, ty - 54, '#7b5d45', 2);
      A.rect(c, tx - 20, ty - H - 4, 40, 6, '#7b5d45'); A.rect(c, tx - 20, ty - H - 4, 40, 2, '#a77a55');
      for (const x of [-19, -6, 6, 17]) A.rect(c, tx + x, ty - H - 16, 2, 12, '#6b4f3a'); A.rect(c, tx - 20, ty - H - 16, 40, 2, '#94735a');
      A.rect(c, tx - 17, ty - H - 30, 2, 14, '#6b4f3a'); A.rect(c, tx + 15, ty - H - 30, 2, 14, '#6b4f3a');
      A.poly(c, [[tx - 26, ty - H - 28], [tx, ty - H - 44], [tx + 26, ty - H - 28], [tx + 22, ty - H - 25], [tx, ty - H - 38], [tx - 22, ty - H - 25]], '#a8604f'); A.poly(c, [[tx - 22, ty - H - 25], [tx, ty - H - 38], [tx, ty - H - 34], [tx - 18, ty - H - 23]], '#c0705c');
      A.rect(c, tx + 8, ty - H - 13, 5, 6, '#e7bd74'); A.rect(c, tx + 9, ty - H - 12, 3, 4, frame % 2 ? '#fff1c4' : '#f4d48a'); glow(c, A, tx + 10, ty - H - 10, 10, 8, '244,212,138', .22);
      A.rect(c, tx, ty - H - 52, 1, 9, '#5a463f'); A.poly(c, frame % 2 ? [[tx + 1, ty - H - 52], [tx + 14, ty - H - 49], [tx + 1, ty - H - 46]] : [[tx + 1, ty - H - 52], [tx + 13, ty - H - 51], [tx + 12, ty - H - 47], [tx + 1, ty - H - 46]], '#c9584a');
    }
    if (L >= 2) {
      const [kx, ky] = P(E - 1, -E + .6);
      A.ellipse(c, kx, ky + 1, 34, 6, '#00000022');
      A.rect(c, kx - 30, ky - 26, 3, 26, '#6b4f3a'); A.rect(c, kx + 26, ky - 30, 3, 30, '#6b4f3a'); A.rect(c, kx - 4, ky - 34, 3, 34, '#5a4433');
      A.rect(c, kx - 24, ky - 16, 48, 16, '#b07a52'); A.rect(c, kx - 24, ky - 16, 48, 2, '#c99466'); for (let x = kx - 22; x < kx + 24; x += 6) A.rect(c, x, ky - 14, 1, 14, '#8a5c3e');
      A.poly(c, [[kx - 34, ky - 24], [kx + 32, ky - 36], [kx + 34, ky - 31], [kx - 32, ky - 19]], '#c9a26c'); A.poly(c, [[kx - 34, ky - 24], [kx + 32, ky - 36], [kx + 32, ky - 34], [kx - 34, ky - 22]], '#e0c08a');
      for (let k = 0; k < 9; k++) A.line(c, kx - 30 + k * 7, ky - 23 - k * 1.3, kx - 30 + k * 7, ky - 19 - k * 1.3, '#a8844f');
      A.rect(c, kx + 14, ky - 46, 6, 12, '#8a867c'); A.rect(c, kx + 14, ky - 46, 2, 12, '#a7a39a');
      const s = frame % 3; A.ellipse(c, kx + 17 + s, ky - 52 - s * 3, 4, 3, 'rgba(236,230,220,.6)'); A.ellipse(c, kx + 20 + s * 2, ky - 60 - s * 3, 5, 4, 'rgba(236,230,220,.4)');
      for (let k = 0; k < 5; k++) A.rect(c, kx - 20 + k * 3, ky - 22 + (k % 2), 2, 3, '#c9483a');
      barrel(E - .2, -E + 1.7); crate(E - .3, -E + 2.6, .8);
    }
    if (L >= 1) tent(-1.3, -1.5, .85, ['#e8dcc0', '#c4b494'], '#b85a4a');
    tent(.3, -.6, 1, ['#efe3c4', '#cbbd9a'], '#6f8fb0');
    if (L >= 2) tent(-1.8, .5, .8, ['#e3d2b0', '#bba684'], '#7f9a6a');
    crate(1.2, .6); crate(1.6, 1.2, .8); barrel(1.9, .3);
    if (L >= 1) { barrel(-1.2, 1.6); crate(-.6, 2, .7); const [hx, hy] = P(1.6, 2.1); A.rect(c, hx - 10, hy - 12, 2, 12, '#6b4f3a'); A.rect(c, hx + 8, hy - 12, 2, 12, '#6b4f3a'); A.rect(c, hx - 11, hy - 12, 22, 2, '#94735a'); }
    // Campfire with a cooking pot on a tripod.
    const [fx, fy] = P(-.2, 1.1), f = frame % 3, sway = [0, 1, -1][f];
    glow(c, A, fx, fy - 6, 26, 14, '244,180,96', .2 + f * .04);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; A.ellipse(c, fx + Math.cos(a) * 9, fy + Math.sin(a) * 3.5, 2.5, 1.8, '#9a968c'); }
    A.line(c, fx - 7, fy, fx + 6, fy - 3, '#6b4f3a', 2);
    A.poly(c, [[fx - 6, fy], [fx + 6, fy], [fx + 3 + sway, fy - 10 - f], [fx + sway, fy - 15 + f], [fx - 3, fy - 8]], '#e8935a'); A.poly(c, [[fx - 3, fy], [fx + 4, fy], [fx + 1 + sway, fy - 9], [fx - 1, fy - 6]], '#fff1c4');
    A.line(c, fx - 10, fy + 1, fx, fy - 20, '#5a4433'); A.line(c, fx + 10, fy + 1, fx, fy - 20, '#5a4433'); A.line(c, fx, fy - 20, fx, fy - 14, '#3f3530'); A.ellipse(c, fx, fy - 11, 5, 3.5, '#3f3a3a'); A.rect(c, fx - 3, fy - 13, 3, 1, '#6a6460');
    A.ellipse(c, fx - 1 + sway, fy - 24 - f * 2, 3, 2, 'rgba(236,230,220,.45)');
    for (const [x, y] of [[-1, 1.7], [.7, 1.9]]) { const [lx, ly] = P(x, y); A.rect(c, lx - 8, ly - 4, 16, 4, '#7b5d45'); A.rect(c, lx - 8, ly - 4, 16, 1, '#a77a55'); A.ellipse(c, lx - 8, ly - 2, 2, 2, '#c49a6c'); }
    // The guild banner by the gate, with the leaf crest.
    const [bx, by] = P(1.4, 2.4), bh = 64 + L * 8, wave = frame % 3;
    A.rect(c, bx, by - bh, 2, bh, '#5a463f'); A.rect(c, bx - 1, by - bh - 3, 4, 3, '#c9a050');
    A.poly(c, [[bx + 2, by - bh + 2], [bx + 26, by - bh + 2 + wave], [bx + 24, by - bh + 20 + wave], [bx + 26, by - bh + 36 - wave], [bx + 14, by - bh + 31], [bx + 2, by - bh + 36]], '#c9584a'); A.poly(c, [[bx + 2, by - bh + 2], [bx + 10, by - bh + 2], [bx + 10, by - bh + 34], [bx + 2, by - bh + 36]], '#d9685a'); A.rect(c, bx + 2, by - bh + 2, 24, 2, '#e8a08a');
    A.ellipse(c, bx + 13, by - bh + 17, 5, 7, '#f4e5c9'); A.line(c, bx + 13, by - bh + 11, bx + 13, by - bh + 24, '#7f9a6a'); A.rect(c, bx + 11, by - bh + 15, 4, 1, '#7f9a6a');
    // Front palisade with an open gate toward the trail.
    if (L >= 2) { wall(E, -E, E, E, 20); wall(-E, E, E, E, 20, t => t > .36 && t < .64); const g = [P(-E + E * 2 * .34, E), P(-E + E * 2 * .66, E)]; for (const [gx, gy] of g) { A.rect(c, gx - 3, gy - 32, 6, 32, '#6b4f3a'); A.rect(c, gx - 3, gy - 32, 2, 32, '#94735a'); } A.line(c, g[0][0], g[0][1] - 32, g[1][0], g[1][1] - 32, '#5a4433', 3); A.line(c, g[0][0], g[0][1] - 33, g[1][0], g[1][1] - 33, '#94735a'); }
    else if (L >= 1) for (const [x, y] of [[E, -E + .4], [E, E - .4], [-E + .4, E], [E - .4, E]]) stake(x, y, 16);
  });
}

// ---- Canyon: the harpy cliffs, with nests on the ledges ----
export function makeHarpyCliff(frame = 0) {
  const r = rand(113), w = 200, h = 216, cx = 100, footY = 204;
  return sprite(w, h, cx, footY, (c, A) => {
    A.ellipse(c, cx, footY, 90, 11, '#00000026');
    const a = profile(cx - 8, footY, 176, t => 58 * (1 - t * t * .75) * (t < .1 ? 1.15 - t * 1.5 : 1), 21, 5, 10), b = profile(cx + 50, footY, 112, t => 32 * (1 - t * t * .8), 22, 4, -6), d = profile(cx - 58, footY, 132, t => 30 * (1 - t * t * .8), 23, 4, -4);
    paintRock(c, A, y => mergeSpans([...a(y), ...b(y), ...d(y)]), footY - 178, footY, ROCK.canyon, { seed: 17 });
    // Ledges: shelves that catch the light and throw a shadow under them.
    const ledges = [[cx - 26, 72, 34], [cx + 16, 110, 34], [cx - 50, 136, 26], [cx + 50, 126, 24], [cx + 4, 46, 22]];
    for (const [x, y, lw] of ledges) { A.rect(c, x - lw / 2, y + 3, lw, 3, '#7a3f2c'); A.rect(c, x - lw / 2, y, lw, 3, '#e9bf95'); A.rect(c, x - lw / 2, y, lw, 1, '#f6d6a6'); A.rect(c, x - lw / 2 - 1, y, 1, 3, ROCK.canyon.edge); A.rect(c, x + lw / 2, y, 1, 3, ROCK.canyon.edge); }
    for (const [x, y, len] of [[cx - 22, 78, 26], [cx + 20, 116, 22], [cx - 46, 142, 18], [cx + 6, 52, 20]]) { A.rect(c, x, y, 2, len, '#efe6d2'); A.rect(c, x + 3, y, 1, len * .6, '#e2d6bd'); }
    const nest = (x, y, s, kind) => {
      A.ellipse(c, x, y, 12 * s, 4 * s, '#5a4433'); A.ellipse(c, x, y - 1, 11 * s, 3.5 * s, '#8a6a4a');
      for (let k = 0; k < 10; k++) { const an = r() * Math.PI; A.line(c, x - Math.cos(an) * 12 * s, y - 2 + Math.sin(an) * 2, x + Math.cos(an) * 6 * s, y - 3, k % 2 ? '#a7845c' : '#6b4f3a'); }
      if (kind === 'eggs') for (const dx of [-4, 1, 5]) { A.ellipse(c, x + dx * s, y - 4, 2.6, 3.4, '#e9dfc8'); A.rect(c, x + dx * s - 1, y - 6, 1, 1, '#ffffff'); A.rect(c, x + dx * s + 1, y - 3, 1, 1, '#a39a86'); }
      if (kind === 'chick') { const bb = frame % 2; A.ellipse(c, x, y - 6 - bb, 6, 5, '#d9cbb0'); A.ellipse(c, x - 1, y - 7 - bb, 4, 3, '#efe6d2'); A.rect(c, x - 3, y - 9 - bb, 1, 1, '#2f2a30'); A.poly(c, [[x - 6, y - 8 - bb], [x - 10, y - 7 + bb], [x - 6, y - 6 - bb]], '#e2a64a'); }
      for (let k = 0; k < 3; k++) { const fx = x + (r() - .5) * 20 * s, fy = y - 2 + r() * 3; A.line(c, fx, fy, fx + 5, fy - 2, '#8f7aa8'); A.rect(c, fx + 4, fy - 3, 2, 1, '#c4b6d6'); }
    };
    nest(cx - 26, 72, 1.1, 'eggs'); nest(cx + 16, 110, 1, 'chick'); nest(cx - 50, 136, .8, 'eggs'); nest(cx + 4, 46, .9, 'twigs');
    const fx = 160 + frame * 6, fy = 60 - frame * 5; A.line(c, fx, fy, fx + 8, fy - 3, '#8f7aa8'); A.line(c, fx + 1, fy - 1, fx + 7, fy - 4, '#c4b6d6');
    for (let k = 0; k < 8; k++) rubble(c, A, cx - 84 + r() * 168, footY - 1 - r() * 6, 2 + r() * 3, ROCK.canyon);
    for (let k = 0; k < 5; k++) tuft(c, A, cx - 70 + r() * 140, footY - r() * 3);
  });
}

// ---- Canyon's far end: the ember mine, its rails glowing with hot ore ----
export function makeEmberMine(frame = 0) {
  const r = rand(127), w = 230, h = 176, footX = 115, footY = 156, P = iso(footX, footY);
  return sprite(w, h, footX, footY, (c, A) => {
    A.ellipse(c, footX, footY - 2, 104, 12, '#00000024');
    const hill = profile(footX - 8, footY - 8, 116, t => 100 * Math.sqrt(1 - Math.pow(t, 1.6)) * (1 - t * .25) + 6, 29, 5, 8);
    paintRock(c, A, hill, footY - 124, footY - 8, ROCK.canyon, { seed: 29 });
    for (let k = 0; k < 6; k++) tuft(c, A, footX - 60 + r() * 110, 48 + r() * 30);
    const ex = footX - 4, ey = footY - 30, pulse = frame % 3;
    glow(c, A, ex, ey - 14, 40, 28, '247,140,60', .18 + pulse * .07);
    A.ellipse(c, ex, ey - 44, 24, 10, '#3a2a26'); A.rect(c, ex - 24, ey - 44, 48, 44, '#3a2a26'); A.rect(c, ex - 20, ey - 42, 40, 42, '#1f1716'); A.ellipse(c, ex, ey - 42, 20, 8, '#1f1716');
    A.ellipse(c, ex, ey - 8, 16, 7, `rgba(247,150,70,${.25 + pulse * .08})`); A.ellipse(c, ex, ey - 6, 9, 3, `rgba(255,214,140,${.2 + pulse * .07})`);
    for (const x of [-24, 20]) { A.rect(c, ex + x, ey - 50, 5, 50, '#6b4f3a'); A.rect(c, ex + x, ey - 50, 2, 50, '#94735a'); }
    A.rect(c, ex - 30, ey - 56, 60, 7, '#7b5d45'); A.rect(c, ex - 30, ey - 56, 60, 2, '#a77a55'); A.rect(c, ex - 30, ey - 49, 60, 1, '#4f3a2c');
    A.rect(c, ex - 10, ey - 66, 20, 9, '#b58b64'); A.rect(c, ex - 10, ey - 66, 20, 2, '#d0a87d'); A.rect(c, ex - 6, ey - 63, 12, 1, '#6b4f3a'); A.rect(c, ex - 4, ey - 61, 8, 1, '#6b4f3a');
    A.rect(c, ex + 28, ey - 46, 1, 6, '#3f3530'); A.rect(c, ex + 25, ey - 40, 7, 8, '#4f4540'); A.rect(c, ex + 26, ey - 39, 5, 6, pulse ? '#ffd88a' : '#f4b860'); glow(c, A, ex + 28, ey - 36, 12, 10, '244,190,110', .25);
    // Rails out of the mine, sleepers and rails catching the glow.
    for (let u = 0; u <= 3.6; u += .45) { const [ax, ay] = P(-1.2 + u, -.55), [bx, by] = P(-1.2 + u, .55); A.line(c, ax, ay + 1, bx, by + 1, '#5a4433', 3); A.line(c, ax, ay, bx, by, '#7b5d45'); }
    for (const v of [-.38, .38]) { A.line(c, ...P(-1.2, v), ...P(2.6, v), '#6f655d'); A.line(c, ...P(-1.2, v, 1), ...P(2.6, v, 1), '#c9c0b0'); }
    for (let k = 0; k < 6; k++) { const u = (k * .65 + frame * .22) % 3.8, [gx, gy] = P(-1.2 + u, k % 2 ? .38 : -.38, 1); A.rect(c, gx, gy, 2, 1, '#ffcf7a'); ember(c, A, gx, gy, 4, 2, .3); }
    const [kx, ky] = P(1.1, 0);
    A.ellipse(c, kx, ky + 2, 18, 4, '#00000030');
    A.poly(c, [[kx - 16, ky - 18], [kx + 16, ky - 18], [kx + 13, ky - 4], [kx - 13, ky - 4]], '#6f655d'); A.poly(c, [[kx - 16, ky - 18], [kx - 4, ky - 18], [kx - 4, ky - 4], [kx - 13, ky - 4]], '#8a8278'); A.rect(c, kx - 16, ky - 18, 32, 2, '#a59d8f');
    A.rect(c, kx - 16, ky - 12, 32, 1, '#4f4540'); for (const dx of [-9, 8]) { A.ellipse(c, kx + dx, ky - 2, 4, 4, '#3f3a3a'); A.ellipse(c, kx + dx, ky - 2, 1.5, 1.5, '#8a8278'); }
    ember(c, A, kx, ky - 22, 22, 12, .18 + pulse * .07);
    for (const [dx, dy, s] of [[-9, -21, 6], [-2, -24, 7], [6, -21, 6], [11, -19, 4], [-12, -19, 4]]) { A.ellipse(c, kx + dx, ky + dy, s, s * .75, '#4f3a3a'); A.ellipse(c, kx + dx - 1, ky + dy - 1, s * .6, s * .45, '#b3402a'); A.rect(c, kx + dx - 1, ky + dy - 2, 2, 1, (pulse + dx) % 3 ? '#f7c35a' : '#fff1c4'); }
    for (const [x, y, s] of [[-2.2, 1.1, 1], [-2.4, -1, .8], [2.8, 1.3, .7]]) { const [px, py] = P(x, y); A.ellipse(c, px, py - 3 * s, 11 * s, 6 * s, '#5a4848'); A.ellipse(c, px - 2, py - 5 * s, 7 * s, 4 * s, '#6f5a58'); A.rect(c, px - 3, py - 6 * s, 2, 2, '#ec7a35'); A.rect(c, px + 3, py - 4 * s, 2, 1, '#f7c35a'); }
    const [qx, qy] = P(-2.6, .2); A.line(c, qx - 6, qy, qx + 6, qy - 14, '#94735a', 2); A.poly(c, [[qx + 1, qy - 16], [qx + 12, qy - 14], [qx + 9, qy - 11]], '#8a8f88');
  });
}

// ---- Canyon floor: the sand wyrm's pit, a slow sand whirlpool ringed with bones ----
export function makeWyrmPit(frame = 0) {
  const w = 260, h = 150, cx = 130, cy = 82, r = rand(149), RX = 104, RY = 48;
  return sprite(w, h, cx, cy, (c, A) => {
    // A soft drifted rim fading into the ground, then the funnel stepping down in rings that turn each frame.
    for (let k = 0; k < 26; k++) { const a = k / 26 * Math.PI * 2, x = cx + Math.cos(a) * (RX + 6), y = cy + 3 + Math.sin(a) * (RY + 5); A.ellipse(c, x, y, 16 + r() * 8, 7 + r() * 3, k % 3 ? '#d9ab78' : '#e3b886'); }
    A.ellipse(c, cx, cy + 2, RX + 2, RY + 2, '#ecc796');
    const rings = 7;
    for (let k = 0; k < rings; k++) {
      const t = k / rings, rx = RX * (1 - t * .86), ry = RY * (1 - t * .86), col = ['#ddae7e', '#d29f70', '#c48c60', '#b57c54', '#a36c48', '#8f5b3e', '#7a4b34'][k];
      A.ellipse(c, cx, cy + t * 10, rx, ry, col);
      const n = 14 - k, spin = frame * (.18 + t * .35);
      for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2 + spin + k * .7, x = cx + Math.cos(a) * rx * .86, y = cy + t * 10 + Math.sin(a) * ry * .86; A.line(c, x, y, x + Math.cos(a + 1.4) * 6, y + Math.sin(a + 1.4) * 3, k < 3 ? '#efcf9f' : '#c48c60'); }
    }
    A.ellipse(c, cx, cy + 10, 12, 5, '#4a2c22'); A.ellipse(c, cx, cy + 10, 7, 3, '#2a1a16');
    const bone = '#efe6d2', boneDark = '#c9bea5';
    for (let k = 0; k < 6; k++) { const x = 34 + k * 9, base = cy + 32 - k * 2; A.line(c, x, base, x + 6, base - 22 + Math.abs(k - 2.5) * 2, boneDark, 3); A.line(c, x, base - 1, x + 6, base - 23 + Math.abs(k - 2.5) * 2, bone); }
    A.line(c, 30, cy + 16, 88, cy + 6, boneDark, 3); A.line(c, 30, cy + 15, 88, cy + 5, bone);
    const sx = 200, sy = cy + 26; A.ellipse(c, sx, sy, 18, 9, boneDark); A.ellipse(c, sx - 2, sy - 2, 16, 7, bone); A.poly(c, [[sx + 12, sy - 4], [sx + 34, sy + 2], [sx + 12, sy + 6]], bone); A.ellipse(c, sx - 3, sy - 2, 4, 3, '#4a3f3a'); A.rect(c, sx + 14, sy + 2, 14, 1, '#4a3f3a'); for (let k = 0; k < 4; k++) A.rect(c, sx + 15 + k * 4, sy + 2, 1, 3, bone);
    A.poly(c, [[sx - 10, sy - 6], [sx - 22, sy - 26], [sx - 6, sy - 8]], boneDark);
    for (let k = 0; k < 6; k++) { const a = 3.6 + k * .26, x = cx + Math.cos(a) * (RX + 2), y = cy + Math.sin(a) * (RY + 2); A.ellipse(c, x, y, 3, 2, bone); A.rect(c, x - 1, y - 2, 2, 1, '#ffffff'); }
    for (let k = 0; k < 18; k++) { const a = r() * Math.PI * 2, rr = .9 + r() * .1; A.rect(c, cx + Math.cos(a) * RX * rr, cy + Math.sin(a) * RY * rr, 2, 1, '#f3d7aa'); }
  });
}

// ---- Lower slopes: drake nests among warm black rock, eggs that glow ----
export function makeDrakeNests(frame = 0) {
  const footX = 120, footY = 150, P = iso(footX, footY), r = rand(163);
  return sprite(240, 170, footX, footY, (c, A) => {
    // A shelf of black rock behind, and boulders around the hollow, shelter the nests.
    const [rx0, ry0] = P(-.4, -2.3), ridgeA = profile(rx0 - 40, ry0 + 6, 46, t => 34 * (1 - t * t * .8), 51, 4, 6), ridgeB = profile(rx0 + 30, ry0 + 4, 32, t => 28 * (1 - t * t * .8), 52, 4, -4);
    A.ellipse(c, rx0, ry0 + 6, 80, 9, '#00000026');
    paintRock(c, A, y => mergeSpans([...ridgeA(y), ...ridgeB(y)]), ry0 - 50, ry0 + 6, ROCK.peak, { seed: 51 });
    for (const [x, y, s] of [[-3.2, -1.4, 10], [-2.8, 1.8, 8], [3.4, -.8, 9], [2.8, 2.4, 7]]) { const [px, py] = P(x, y); A.ellipse(c, px + 2, py + 1, s * 1.5, s * .45, '#00000030'); stoneHeap(c, A, px, py - s * .5, s); }
    for (let k = 0; k < 6; k++) { const [x, y] = P(-2.5 + r() * 5, -1.5 + r() * 3); A.line(c, x, y, x + 10 + r() * 8, y + 2 - r() * 4, '#b3402a'); A.rect(c, x + 4, y, 2, 1, '#f7a04a'); }
    const nest = (x, y, eggs, s = 1) => {
      const [px, py] = P(x, y);
      ember(c, A, px, py - 6, 28 * s, 12 * s, .16);
      A.ellipse(c, px, py + 1, 22 * s, 8 * s, '#00000030'); A.ellipse(c, px, py - 2, 19 * s, 6.5 * s, '#6b4f3a');
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, sx = px + Math.cos(a) * 19 * s, sy = py - 2 + Math.sin(a) * 6.5 * s; A.ellipse(c, sx, sy, 4 * s, 3 * s, k % 3 ? '#4a4450' : '#3a3540'); A.rect(c, sx - 2, sy - 2, 2, 1, '#6e6676'); }
      for (let k = 0; k < 8; k++) { const a = r() * Math.PI * 2; A.line(c, px + Math.cos(a) * 16 * s, py - 3 + Math.sin(a) * 5 * s, px + Math.cos(a + .5) * 10 * s, py - 4, k % 2 ? '#a7845c' : '#5a4433'); }
      A.ellipse(c, px, py - 3, 13 * s, 4 * s, '#3a2a26');
      eggs.forEach(([dx, col, hot], k) => {
        const wob = frame % 2 && k === 1 ? 1 : 0, ex = px + dx * s + wob, ey = py - 7;
        A.ellipse(c, ex, ey, 5 * s + 1, 7 * s + 1, '#2a1f1c'); A.ellipse(c, ex, ey, 5 * s, 7 * s, col[0]); A.ellipse(c, ex - 1.5, ey - 2, 2.6 * s, 3.6 * s, col[1]); A.rect(c, ex - 2, ey - 4, 1, 2, '#ffffff');
        A.rect(c, ex + 1, ey + 1, 2, 1, col[2]); A.rect(c, ex - 2, ey + 3, 1, 1, col[2]);
        if (hot) { A.line(c, ex - 2, ey - 1, ex + 1, ey + 2, '#f7c35a'); A.line(c, ex + 1, ey + 2, ex + 3, ey, '#f7c35a'); ember(c, A, ex, ey, 9, 9, .22 + (frame % 2) * .1); }
      });
    };
    nest(-1.2, -.2, [[-8, ['#b3402a', '#e0784a', '#7a2a20']], [2, ['#d9a04a', '#f2cf7a', '#9a6a28'], true], [10, ['#8a5a7a', '#b58aa8', '#5a3a50']]]);
    nest(1.6, .9, [[-5, ['#5f7f6a', '#8fb39a', '#3a5a46']], [5, ['#b3402a', '#e0784a', '#7a2a20'], true]], .85);
    nest(1.2, -1.8, [[0, ['#d9a04a', '#f2cf7a', '#9a6a28']]], .7);
    const [bx, by] = P(-2.2, 2); A.line(c, bx - 9, by, bx + 9, by - 3, '#c9bea5', 3); A.line(c, bx - 9, by - 1, bx + 9, by - 4, '#efe6d2'); A.ellipse(c, bx - 10, by - 1, 3, 3, '#efe6d2'); A.ellipse(c, bx + 10, by - 4, 3, 3, '#efe6d2');
    const [qx, qy] = P(.2, 2.2); A.poly(c, [[qx - 5, qy], [qx, qy - 6], [qx + 5, qy], [qx, qy + 2]], '#7f8f6a'); A.line(c, qx, qy - 5, qx, qy + 1, '#b9c896'); A.rect(c, qx - 2, qy - 3, 1, 1, '#e8f0d0');
  });
}

// ---- Upper slopes: the wyvern spire, a needle of black rock with the matriarch's nest at its tip ----
export function makeWyvernSpire(frame = 0) {
  const w = 160, h = 280, cx = 80, footY = 266, r = rand(181);
  return sprite(w, h, cx, footY, (c, A) => {
    A.ellipse(c, cx, footY, 60, 10, '#00000030');
    const needle = profile(cx, footY, 200, t => 38 * Math.pow(1 - t, .8) + 7 + (t > .3 && t < .36 ? 4 : 0), 41, 5, 10);
    const b1 = profile(cx - 30, footY, 70, t => 22 * (1 - t), 42, 4, -6), b2 = profile(cx + 30, footY, 96, t => 18 * (1 - t), 43, 4, 4), b3 = profile(cx + 12, footY - 120, 40, t => 8 * (1 - t), 44, 2, 10);
    paintRock(c, A, y => mergeSpans([...b1(y), ...needle(y), ...b2(y), ...b3(y)]), footY - 204, footY, ROCK.peak, { seed: 41 });
    for (let k = 0; k < 4; k++) { const y = 170 + k * 18; for (let j = 0; j < 3; j++) A.line(c, cx - 16 + j * 4, y, cx - 8 + j * 4, y + 12, '#6e6676'); }
    A.line(c, cx + 8, footY - 30, cx + 3, footY - 90, '#b3402a'); A.line(c, cx + 3, footY - 90, cx + 9, footY - 130, '#b3402a'); A.rect(c, cx + 5, footY - 70, 1, 3, '#f7a04a'); ember(c, A, cx + 6, footY - 80, 10, 30, .1);
    // The great nest: a woven bowl overhanging the tip, bones and a glinting scale caught in it.
    const nx = cx + 10, ny = footY - 196;
    A.ellipse(c, nx, ny + 8, 40, 14, '#3f3027');
    for (let k = 0; k < 40; k++) { const a = Math.PI * (k / 40), x = nx - Math.cos(a) * 38, y = ny + 2 + Math.sin(a) * 14; A.line(c, x, y, x + (r() - .5) * 18, y - 4 + r() * 8, k % 3 ? '#8a6a4a' : '#5a4433', 2); }
    A.ellipse(c, nx, ny, 36, 9, '#6b4f3a'); A.ellipse(c, nx, ny + 1, 28, 6, '#3a2a26');
    for (let k = 0; k < 22; k++) { const a = r() * Math.PI * 2, x = nx + Math.cos(a) * 36, y = ny + Math.sin(a) * 9; A.line(c, x, y, x + Math.cos(a) * (6 + r() * 10), y + (r() - .6) * 6, k % 2 ? '#a7845c' : '#5a4433'); }
    for (let k = 0; k < 7; k++) { const x = nx - 26 + k * 9 + r() * 3; A.line(c, x, ny + 14, x + (r() - .5) * 4, ny + 22 + r() * 12, '#5a4433'); }
    A.line(c, nx - 30, ny - 3, nx - 12, ny - 7, '#efe6d2', 2); A.ellipse(c, nx - 31, ny - 3, 2, 2, '#efe6d2');
    A.ellipse(c, nx + 2, ny - 6, 9, 11, '#2a2030'); A.ellipse(c, nx + 2, ny - 6, 8, 10, '#6a5a7a'); A.ellipse(c, nx - 1, ny - 9, 4, 5, '#9a88ac'); A.rect(c, nx - 2, ny - 13, 2, 2, '#e8e0f0'); ember(c, A, nx + 2, ny - 4, 16, 10, .12 + (frame % 2) * .08);
    A.poly(c, [[nx + 18, ny - 3], [nx + 24, ny - 9], [nx + 30, ny - 3], [nx + 24, ny]], '#5f7f8a'); A.rect(c, nx + 23, ny - 7, 2, 2, frame % 2 ? '#ffffff' : '#bfe3ee');
    const sx = cx - 26, sy = footY - 130; A.line(c, sx, sy, sx - 18, sy - 26, '#7b5d45', 2); A.poly(c, frame % 2 ? [[sx - 17, sy - 25], [sx - 4, sy - 30], [sx - 9, sy - 22]] : [[sx - 17, sy - 25], [sx - 5, sy - 26], [sx - 10, sy - 20]], '#c9584a');
    for (let k = 0; k < 7; k++) rubble(c, A, cx - 56 + r() * 112, footY - r() * 6, 2 + r() * 3, ROCK.peak);
  });
}

// ---- The summit: the caldera of Sleeping Dragon Peak ----
export function makeDragonCaldera(frame = 0) {
  const w = 440, h = 320, cx = 220, footY = 292, r = rand(211), f = frame % 3;
  return sprite(w, h, cx, footY, (c, A) => {
    A.ellipse(c, cx, footY - 4, 206, 26, 'rgba(40,30,36,.28)');
    // The cone: concave flanks rising steeply to a ragged rim, with gullies radiating down.
    const rimY = 112, RX = 92, RY = 24, FOOT = 206;
    paintRock(c, A, y => { if (y < rimY) return []; const t = (y - rimY) / (footY - rimY), by = y - (footY - 30), base = by > 0 ? FOOT * Math.sqrt(Math.max(0, 1 - (by / 28) ** 2)) : 1e9, half = Math.min(base, RX + 6 + (FOOT - RX - 6) * Math.pow(t, 1.5)); return [[cx - half + (vnoise(y * .15, 2, 77) - .5) * 10, cx + half + (vnoise(y * .15, 8, 77) - .5) * 10]]; }, rimY, footY - 2, ROCK.peak, { seed: 77, ridge: { x: cx, y: rimY - 40, n: 16 } });
    // Old cooled flows glinting faintly.
    for (let k = 0; k < 5; k++) { const x0 = cx - 80 + k * 40 + (r() - .5) * 10; let x = x0; for (let y = rimY + RY + 6; y < footY - 14; y += 6) { const nx = x + (r() - .5) * 6; A.line(c, x, y, nx, y + 6, '#5a3530'); x = nx; } }
    // Crater: the back wall, lit orange from the lake below.
    A.ellipse(c, cx, rimY, RX + 4, RY + 2, '#16141a'); A.ellipse(c, cx, rimY, RX, RY, '#2b2730'); A.ellipse(c, cx, rimY + 4, RX - 8, RY - 6, '#5a3530'); A.ellipse(c, cx, rimY + 6, RX - 12, RY - 9, '#7a3a2a');
    A.ellipse(c, cx, rimY + 9, RX - 16, RY - 12, '#d9572e'); A.ellipse(c, cx - 6, rimY + 8, RX - 30, RY - 16, '#ec7a35'); A.ellipse(c, cx - 14, rimY + 7, RX - 58, RY - 20, '#f7c35a');
    for (let k = 0; k < 14; k++) { const a = k * 2.4 + f * .5, x = cx + Math.cos(a) * (RX - 30) * ((k * 37 % 10) / 10), y = rimY + 9 + Math.sin(a) * 6; A.rect(c, x, y, 6 + k % 4, 1, k % 3 ? '#8a2e22' : '#fff1c4'); }
    // The sleeper: a dark body coiled around the lake, lit orange from beneath, spine plates against the glow.
    glow(c, A, cx, rimY + 8, RX - 10, RY - 8, '255,200,110', .16 + f * .05);
    // Tail outermost and thin, the body thickening as it spirals in, the head tucked on top of its coils.
    const body = [], N = 44;
    for (let k = 0; k <= N; k++) { const t = k / N, a = Math.PI * (.35 + t * 2.1), rr = 1 - t * .6; body.push([cx + 4 + Math.cos(a) * 62 * rr, rimY + 6 + Math.sin(a) * 10 * rr - t * 5, 2 + t * 9]); }
    for (const [x, y, rad] of body) A.ellipse(c, x, y + 2, rad + 1, rad * .8 + 1, '#e07a3a');
    for (const [x, y, rad] of body) { A.ellipse(c, x, y, rad, rad * .8, '#2a2028'); A.ellipse(c, x - rad * .2, y - rad * .35, rad * .6, rad * .3, '#4f3b48'); }
    for (let k = 4; k < N - 3; k += 3) { const [x, y, rad] = body[k]; A.poly(c, [[x - 3, y - rad * .6], [x, y - rad * .8 - 6], [x + 3, y - rad * .6]], '#1a1519'); A.rect(c, x, y - rad * .8 - 3, 1, 2, '#f7a04a'); }
    const [hx0, hy0] = body[N], hx = hx0 - 6, hy = hy0 - 4;
    A.ellipse(c, hx + 1, hy + 3, 15, 8, '#e07a3a');
    A.ellipse(c, hx, hy, 17, 10, '#7a3a2a'); A.poly(c, [[hx - 8, hy - 6], [hx - 35, hy - 1], [hx - 34, hy + 9], [hx - 6, hy + 9]], '#7a3a2a');
    A.ellipse(c, hx, hy, 15, 8, '#2a2028'); A.poly(c, [[hx - 8, hy - 4], [hx - 32, hy + 1], [hx - 31, hy + 7], [hx - 6, hy + 7]], '#2a2028');
    A.line(c, hx - 31, hy + 8, hx - 6, hy + 9, '#f7a04a'); A.line(c, hx - 29, hy, hx - 8, hy - 5, '#5a4452'); A.rect(c, hx - 30, hy + 2, 2, 2, '#f7a04a');
    A.poly(c, [[hx + 2, hy - 6], [hx + 24, hy - 24], [hx + 8, hy - 3]], '#231c24'); A.poly(c, [[hx + 8, hy - 3], [hx + 30, hy - 13], [hx + 12, hy + 1]], '#231c24'); A.line(c, hx + 3, hy - 7, hx + 22, hy - 23, '#8a7890'); A.line(c, hx + 9, hy - 3, hx + 28, hy - 12, '#8a7890');
    A.line(c, hx - 5, hy - 1, hx + 2, hy, f === 1 ? '#fff1c4' : '#f7a04a'); glow(c, A, hx - 1, hy - 1, 8, 4, '247,195,90', f === 1 ? .35 : .15);
    A.ellipse(c, hx - 40 - f * 3, hy - 2 - f * 4, 4 + f, 3 + f, 'rgba(230,220,214,.45)');
    // The front lip hides the sleeper's belly.
    const lip = []; for (let k = 0; k <= 48; k++) { const a = k / 48 * Math.PI; lip.push([cx - Math.cos(a) * RX, rimY + Math.sin(a) * RY + (vnoise(k * .5, 3, 5) - .5) * 4]); }
    A.poly(c, [...lip, ...lip.slice().reverse().map(([x, y]) => [x, y + 14])], '#3b3641');
    A.poly(c, [...lip, ...lip.slice().reverse().map(([x, y]) => [x, y + 4])], '#625a6b');
    for (let k = 0; k <= 48; k += 2) { const [x, y] = lip[k]; A.rect(c, x, y - 1, 3, 2, x < cx ? '#857c90' : '#4d4756'); }
    glow(c, A, cx, rimY - 4, RX + 16, RY + 6, '247,140,60', .07 + f * .03);
    // Smoke rising from the crater.
    for (let k = 0; k < 5; k++) { const s = (f + k) % 3, sx = cx - 50 + k * 26 + (k % 2 ? s * 3 : -s * 3), sy = rimY - 14 - s * 18 - (k % 2) * 8; A.ellipse(c, sx, sy, 12 + s * 4, 8 + s * 2, `rgba(120,110,118,${.4 - s * .1})`); A.ellipse(c, sx - 3, sy - 3, 8 + s * 2, 5 + s, `rgba(200,192,196,${.35 - s * .09})`); }
    // A lava spill through a notch in the front lip, running down the flank.
    const nx = cx + 40, ny = rimY + RY + 2, flow = [[nx, ny], [nx + 6, ny + 34], [nx - 2, ny + 70], [nx + 12, ny + 110], [nx + 6, footY - 18]];
    for (let k = 1; k < flow.length; k++) { A.line(c, ...flow[k - 1], ...flow[k], '#5a2420', 8); A.line(c, ...flow[k - 1], ...flow[k], '#d9572e', 4); A.line(c, flow[k - 1][0] - 1, flow[k - 1][1], flow[k][0] - 1, flow[k][1], '#f7c35a'); }
    for (let k = 0; k < 4; k++) { const t = (k / 4 + f / 12) % 1, i = Math.min(flow.length - 2, Math.floor(t * (flow.length - 1))), u = t * (flow.length - 1) - i; A.rect(c, flow[i][0] + (flow[i + 1][0] - flow[i][0]) * u - 1, flow[i][1] + (flow[i + 1][1] - flow[i][1]) * u, 2, 2, '#fff1c4'); }
    ember(c, A, nx + 6, footY - 18, 26, 9, .3); A.ellipse(c, nx + 6, footY - 16, 16, 4, '#d9572e'); A.ellipse(c, nx + 4, footY - 17, 9, 2, '#f7c35a');
    // Treasure: gold spilling over the left rim, winking in the glow.
    const tx = cx - 96, ty = rimY + 16;
    for (let k = 0; k < 18; k++) { const x = tx + (r() - .3) * 28, y = ty + r() * 20; A.ellipse(c, x, y, 3, 1.6, '#8a6420'); A.rect(c, x - 2, y - 1, 3, 1, '#f2cf6a'); }
    A.rect(c, tx - 4, ty + 2, 11, 8, '#5a4433'); A.rect(c, tx - 4, ty + 2, 11, 2, '#c9a050'); A.rect(c, tx, ty + 5, 2, 2, '#f2cf6a');
    A.poly(c, [[tx + 12, ty + 6], [tx + 16, ty - 4], [tx + 20, ty + 6]], '#9fd3f0'); A.rect(c, tx + 15, ty - 1, 1, 4, '#effaff');
    const tw = [[tx - 2, ty + 4], [tx + 14, ty + 12], [tx + 6, ty + 18]][f]; A.rect(c, tw[0], tw[1] - 3, 1, 7, '#ffffff'); A.rect(c, tw[0] - 3, tw[1], 7, 1, '#ffffff');
    // Bones of those who came before: a horned skull on the slope and a broken sword.
    const bx = cx - 138, by = footY - 30;
    A.ellipse(c, bx, by, 15, 8, '#c9bea5'); A.ellipse(c, bx - 1, by - 2, 13, 6, '#efe6d2'); A.ellipse(c, bx - 4, by - 2, 3, 3, '#4a3f3a'); A.ellipse(c, bx + 5, by - 2, 3, 3, '#4a3f3a');
    A.poly(c, [[bx - 12, by - 4], [bx - 26, by - 18], [bx - 9, by - 7]], '#e2d6bd'); A.poly(c, [[bx + 11, by - 4], [bx + 24, by - 20], [bx + 8, by - 7]], '#e2d6bd'); A.rect(c, bx - 6, by + 4, 12, 3, '#c9bea5');
    const wx = cx + 150, wy = footY - 22; A.line(c, wx, wy, wx + 6, wy - 26, '#b9c3cc', 2); A.line(c, wx - 5, wy - 6, wx + 5, wy - 8, '#7b5d45', 2); A.rect(c, wx - 1, wy - 1, 3, 3, '#c9a050');
    for (let k = 0; k < 12; k++) rubble(c, A, cx - 190 + r() * 380, footY - 2 - r() * 10, 2 + r() * 4, ROCK.peak);
  });
}
