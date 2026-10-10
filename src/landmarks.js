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
