/* The monster bestiary: every creature is original pixel art at native size, outlined like the guild's
   characters. Frames 0 and 1 are the idle/move bob, frame 2 is the attack lunge, and a white hit flash
   can be laid over any of them. Everything faces right; feet sit at the bottom centre of the canvas.
   Floating creatures bake the air under them into the canvas so their anchor stays on the ground. */

const Art = () => window.ArtCore;
const OUT = '#4a3f3a';

/**
 * Species. kind: how it moves in the world (hop, walk, float, root).
 * biome: where it lives. size: canvas [w, h]. lift: float height above its shadow.
 */
export const SPECIES = {
  leafSlime: { name: 'สไลม์ใบไม้', kind: 'hop', biome: 'meadow', size: [24, 22] },
  waterSlime: { name: 'สไลม์หยดน้ำค้าง', kind: 'hop', biome: 'water', size: [24, 23] },
  thornling: { name: 'พุ่มหนามจิ๋ว', kind: 'root', biome: 'meadow', size: [26, 24] },
  hornHare: { name: 'กระต่ายเขากิ่ง', kind: 'hop', biome: 'meadow', size: [28, 27] },
  fuzzBee: { name: 'ผึ้งปุยยักษ์', kind: 'float', biome: 'meadow', size: [26, 30], lift: 12 },
  fluffBoar: { name: 'หมูป่าขนฟู', kind: 'walk', biome: 'meadow', size: [38, 28] },
  pondFrog: { name: 'กบนักรบใบบัว', kind: 'hop', biome: 'water', size: [28, 26] },
  mushHopper: { name: 'เห็ดกระโดด', kind: 'hop', biome: 'forest', size: [22, 24] },
  acornBeetle: { name: 'ด้วงหมวกลูกโอ๊ก', kind: 'walk', biome: 'forest', size: [28, 20] },
  mossWolf: { name: 'หมาป่ามอส', kind: 'walk', biome: 'forest', size: [40, 30] },
  hollowKeeper: { name: 'ผู้เฝ้าโพรง', kind: 'walk', biome: 'forest', size: [34, 36] },
  pebbleCrab: { name: 'ปูกรวดหิน', kind: 'walk', biome: 'hills', size: [32, 22] },
  crystalBat: { name: 'ค้างคาวผลึก', kind: 'float', biome: 'hills', size: [36, 32], lift: 14 },
  marbleGolem: { name: 'โกเลมหินอ่อน', kind: 'walk', biome: 'hills', size: [40, 42] },
  bellGuardian: { name: 'ผู้พิทักษ์ระฆัง', kind: 'walk', biome: 'ruins', size: [48, 56] },
  mistWisp: { name: 'ภูตหมอก', kind: 'float', biome: 'mist', size: [28, 40], lift: 10 },
  lanternGhost: { name: 'ผีตะเกียง', kind: 'float', biome: 'mist', size: [28, 36], lift: 10 },
  glowMoth: { name: 'แมลงเม่าเรืองแสง', kind: 'float', biome: 'mist', size: [30, 32], lift: 14 },
  bindingRoots: { name: 'รากไม้พันธนาการ', kind: 'root', biome: 'mist', size: [42, 40] },
  heartGuardian: { name: 'ผู้พิทักษ์หัวใจป่า', kind: 'walk', biome: 'mist', size: [62, 64] },
  // Farm raiders and road ambushers.
  fieldMole: { name: 'ตุ่นขุดไร่', kind: 'walk', biome: 'meadow', size: [26, 20] },
  cropGoblin: { name: 'ก็อบลินขโมยผัก', kind: 'walk', biome: 'meadow', size: [28, 28] },
  roadBandit: { name: 'โจรป่าหน้ากากใบไม้', kind: 'walk', biome: 'forest', size: [30, 28] },
  // Red Wind Canyon.
  dustLizard: { name: 'กิ้งก่าฝุ่นแดง', kind: 'walk', biome: 'canyon', size: [36, 22] },
  cliffHarpy: { name: 'ฮาร์ปี้หน้าผา', kind: 'float', biome: 'canyon', size: [34, 38], lift: 14 },
  emberImp: { name: 'ภูตถ่านไฟ', kind: 'float', biome: 'canyon', size: [26, 32], lift: 12 },
  sandWyrm: { name: 'หนอนทรายยักษ์', kind: 'root', biome: 'canyon', size: [60, 56] },
  // Sleeping Dragon Peak.
  stoneDrake: { name: 'มังกรหินน้อย', kind: 'walk', biome: 'peak', size: [36, 28] },
  magmaTortoise: { name: 'เต่าแมกมา', kind: 'walk', biome: 'peak', size: [44, 34] },
  stormRoc: { name: 'นกฟ้าคำราม', kind: 'float', biome: 'peak', size: [46, 40], lift: 16 },
  wyvernMatriarch: { name: 'แม่พญาไวเวิร์น', kind: 'float', biome: 'peak', size: [70, 60], lift: 14 },
  emberDragon: { name: 'ราชันมังกรเพลิง', kind: 'walk', biome: 'peak', size: [110, 90] },
};
/** Which creature each quest's fight is against. */
export const QUEST_FOE = { patrol: 'leafSlime', herbs: 'thornling', escort: 'fluffBoar', hollow: 'hollowKeeper', crystals: 'marbleGolem', ruins: 'bellGuardian', mistpath: 'mistWisp', rescue: 'bindingRoots', heart: 'heartGuardian' };
/** The flavour of each species' attack, for hit effects. */
export const MONSTER_ATTACK = {
  leafSlime: 'slam', waterSlime: 'spit', thornling: 'sting', hornHare: 'slam', fuzzBee: 'sting', fluffBoar: 'slam', pondFrog: 'sting',
  mushHopper: 'spit', acornBeetle: 'bite', mossWolf: 'bite', hollowKeeper: 'claw', pebbleCrab: 'claw', crystalBat: 'zap', marbleGolem: 'slam',
  bellGuardian: 'slam', mistWisp: 'zap', lanternGhost: 'fire', glowMoth: 'zap', bindingRoots: 'slam', heartGuardian: 'zap',
  fieldMole: 'claw', cropGoblin: 'slam', roadBandit: 'slam', dustLizard: 'bite', cliffHarpy: 'claw', emberImp: 'fire', sandWyrm: 'bite',
  stoneDrake: 'fire', magmaTortoise: 'fire', stormRoc: 'zap', wyvernMatriarch: 'claw', emberDragon: 'fire',
};

// ---- Drawing kit ----
const INK = '#2f2a30', WH = '#ffffff', BLUSH = '#f29a9a', MAW = '#5a2630', TONGUE = '#e0707a';
function pen(c, A) {
  return {
    c, A,
    R: (x, y, w, h, k) => A.rect(c, x, y, w, h, k),
    E: (x, y, rx, ry, k) => A.ellipse(c, x, y, rx, ry, k),
    P: (pts, k) => A.poly(c, pts, k),
    L: (x0, y0, x1, y1, k, wd) => A.line(c, x0, y0, x1, y1, k, wd),
  };
}
/** A shaded ball: dark rim, mid body nudged up-left, a soft light patch and an optional glint. */
function ball(g, cx, cy, rx, ry, [d, m, l], spec = true) {
  g.E(cx, cy, rx, ry, d);
  g.E(cx - rx * .1, cy - ry * .14, rx * .86, ry * .8, m);
  g.E(cx - rx * .34, cy - ry * .4, rx * .42, ry * .34, l);
  if (spec && rx > 3) g.R(cx - rx * .5, cy - ry * .62, Math.max(1, rx * .2), 1, WH);
}
/** Vertical band of a colour clipped to an ellipse (stripes, belly plates). */
function band(g, cx, cy, rx, ry, x0, x1, k, inset = 0) {
  for (let x = Math.ceil(x0); x < x1; x++) { const t = (x + .5 - cx) / rx; if (Math.abs(t) >= 1) continue; const half = ry * Math.sqrt(1 - t * t) - inset; if (half > 0) g.R(x, cy - half, 1, half * 2, k); }
}
/** Shaded rectangle: lit left/top edge, dark right/bottom edge. */
function block(g, x, y, w, h, [d, m, l]) { g.R(x, y, w, h, m); g.R(x, y, 1, h, l); g.R(x, y, w, 1, l); g.R(x + w - 1, y, 1, h, d); g.R(x, y + h - 1, w, 1, d); }
function eye(g, x, y, h = 3, col = INK) { g.R(x, y, 2, h, col); g.R(x, y, 1, 1, WH); }
/** A pair of eyes; when angry they narrow and grow slanted brows. */
function eyes(g, x1, x2, y, angry, h = 3, col = INK) {
  if (!angry) { eye(g, x1, y, h, col); eye(g, x2, y, h, col); return; }
  eye(g, x1, y + 1, Math.max(1, h - 1), col); eye(g, x2, y + 1, Math.max(1, h - 1), col);
  g.R(x1 - 1, y - 1, 2, 1, INK); g.R(x1 + 1, y, 2, 1, INK); g.R(x2 - 1, y, 2, 1, INK); g.R(x2 + 1, y - 1, 2, 1, INK);
}
function blush(g, x, y, w = 2) { g.R(x, y, w, 1, BLUSH); }
/** An open mouth with a tongue and two little fangs. */
function maw(g, x, y, w, h, fangs = true) { g.R(x, y, w, h, MAW); if (h > 2) g.R(x + 1, y + h - 1, Math.max(1, w - 2), 1, TONGUE); if (fangs && w > 2) { g.R(x, y, 1, 1, WH); g.R(x + w - 1, y, 1, 1, WH); } }
/** Soft rings of light; kept faint so the outline pass ignores them. */
function glow(g, cx, cy, rx, ry, rgb, n = 3, a = .13) { for (let k = n; k >= 1; k--) g.E(cx, cy, rx * k / n, ry * k / n, `rgba(${rgb},${a})`); }
function sparks(g, pts, cols = ['#ffd36a', '#ff9a3c', '#fff2b0']) { pts.forEach(([x, y, s = 1], i) => g.R(x, y, s, s, cols[i % cols.length])); }
const lerp = (a, b, t) => a + (b - a) * t;
/** A pointed leaf from (x, y) to its tip, with a lit upper half. */
function leaf(g, x, y, dx, dy, [d, l], wd = 2) {
  const len = Math.hypot(dx, dy) || 1, nx = -dy / len * wd, ny = dx / len * wd, mx = x + dx * .45, my = y + dy * .45;
  g.P([[x, y], [mx + nx, my + ny], [x + dx, y + dy], [mx - nx, my - ny]], d); g.P([[x, y], [mx - nx, my - ny], [x + dx, y + dy]], l);
}

// ---- Shared bodies ----
function slime(g, f, w, h, pal, water) {
  const atk = f === 2, H = atk ? 17 : f ? 12 : 14, rx = atk ? 8 : f ? 10.5 : 9, cx = w / 2 + (atk ? 1 : 0), top = h - H, ry = H * .62, my = top + ry;
  if (water) { const tip = atk ? 3 : 4; g.P([[cx - 4, top + 3], [cx + 1 + (atk ? 2 : 0), top - tip], [cx + 4, top + 3]], pal[0]); g.P([[cx - 2, top + 3], [cx + 1 + (atk ? 2 : 0), top - tip + 2], [cx + 2, top + 3]], pal[2]); }
  g.E(cx, my, rx, ry, pal[0]); g.R(cx - rx, my, rx * 2, h - my - 1, pal[0]); g.R(cx - rx + 1, h - 1, rx * 2 - 2, 1, pal[0]);
  g.E(cx - .5, my - .5, rx - 1, ry - 1, pal[1]); g.R(cx - rx + 1, my, rx * 2 - 2.5, h - my - 3, pal[1]);
  g.E(cx - rx * .35, my - ry * .3, rx * .45, ry * .4, pal[2]);
  g.R(cx - rx + 2, h - 3, rx * 2 - 4, 1, pal[3]);
  g.R(cx - rx * .55, top + 2, 2, 1, WH); g.R(cx - rx * .55 - 1, top + 3, 1, 2, WH);
  if (water) { g.E(cx + rx * .45, my + ry * .4, 1.5, 1.5, pal[2]); g.R(cx + rx * .45, my + ry * .4 - 1, 1, 1, WH); g.E(cx - rx * .5, h - 5, 1, 1, pal[2]); }
  const ey = Math.round(my + (f === 1 ? 1 : 0)), ex = Math.round(cx);
  eyes(g, ex - 3, ex + 2, ey - 1, atk, 3);
  blush(g, ex - 6, ey + 3, 3); blush(g, ex + 4, ey + 3, 3);
  if (atk) maw(g, ex - 1, ey + 3, 4, 3); else g.R(ex, ey + 3, 2, 1, INK);
  if (!water) {
    const sx = Math.round(cx) - 1, st = top + 1;
    g.R(sx, st - 3, 1, 4, '#4f7a3a');
    const spread = atk ? 2 : f ? -1 : 0;
    leaf(g, sx, st - 2, -7, -3 - spread, ['#4f8a42', '#86c062'], 1.8); leaf(g, sx + 1, st - 3, 7, -5 - spread, ['#5f9a4a', '#a8d880'], 2);
    g.R(sx + 4, top + 4, 2, 2, '#f4f0d8'); g.R(sx + 4, top + 4, 1, 1, '#f6c45a');
  }
}

/** A four-legged walker's legs: [x, lift] pairs, with darker far legs. */
function legs4(g, list, y, h, w, pal, hoof) {
  for (const [x, d, far] of list) { const k = far ? pal[0] : pal[1]; g.R(x, y + d, w, h - d, k); if (!far) g.R(x, y + d, 1, h - d - 1, pal[2]); g.R(x - (hoof ? 0 : 1), y + h - 2, w + (hoof ? 0 : 1), 2, hoof || pal[0]); }
}

// ---- The bestiary ----
const DRAW = {
  leafSlime: (g, f) => slime(g, f, 24, 22, ['#3f7a44', '#74b866', '#b4e08e', '#4f8a50'], false),
  waterSlime: (g, f) => slime(g, f, 24, 23, ['rgba(62,116,170,.95)', 'rgba(110,170,222,.92)', 'rgba(196,236,250,.95)', 'rgba(78,134,186,.95)'], true),

  thornling(g, f) {
    const atk = f === 2, cx = atk ? 14 : 13, cy = 13 - (f === 1 ? 1 : 0);
    // Root feet anchored in the soil.
    g.E(13, 22, 9, 2, '#6b5040'); g.R(5, 21, 3, 2, '#5a4436'); g.R(18, 21, 3, 2, '#5a4436'); g.R(10, 22, 6, 2, '#7d5f4a');
    const thorns = [[-10, -1], [-8, -7], [-3, -10], [4, -10], [9, -6], [10, 1], [-9, 5], [8, 6]];
    const reach = atk ? 4 : f ? 2 : 3;
    for (const [dx, dy] of thorns) { const a = Math.atan2(dy, dx), x = cx + dx, y = cy + dy; g.P([[x - Math.sin(a) * 2, y + Math.cos(a) * 2], [x + Math.cos(a) * reach, y + Math.sin(a) * reach], [x + Math.sin(a) * 2, y - Math.cos(a) * 2]], '#e8d8b0'); }
    ball(g, cx, cy, 10, 9, ['#2f6238', '#4f9450', '#82c068'], false);
    for (const [x, y] of [[-6, -4], [-2, -7], [3, -6], [-7, 2], [6, -2]]) { g.R(cx + x, cy + y, 2, 1, '#86c06a'); g.R(cx + x + 1, cy + y + 1, 1, 1, '#2f5a38'); }
    // Wild rose on top.
    const rx = cx + 3, ry = cy - 9; g.E(rx, ry, 3, 2.5, '#e2607a'); g.E(rx - .5, ry - .5, 2, 1.5, '#f590a6'); g.R(rx, ry, 1, 1, '#ffe08a');
    // Face.
    eyes(g, cx - 2, cx + 3, cy - 1, true, 3);
    if (atk) { g.R(cx - 2, cy + 4, 7, 3, MAW); for (let x = cx - 2; x < cx + 5; x += 2) g.R(x, cy + 4, 1, 1, '#f4ead0'); } else g.R(cx - 1, cy + 4, 4, 1, INK);
    blush(g, cx - 6, cy + 3); blush(g, cx + 6, cy + 3);
  },

  hornHare(g, f) {
    g.c.translate(0, 3);
    const atk = f === 2, up = f === 1 ? 1 : 0, fur = ['#d4c4ae', '#f1e7d6', '#fffaf0'];
    const bx = atk ? 12 : 11, by = (atk ? 14 : 16) - up, hx = atk ? 21 : 19, hy = (atk ? 10 : 11) - up;
    // Feet.
    if (atk) { g.L(6, 17, 2, 21, '#cdbca4', 2); g.R(0, 21, 4, 2, '#cdbca4'); g.L(17, 17, 21, 19, '#e4d8c4', 2); } else { g.R(6, 21, 7, 2, '#cdbca4'); g.R(16, 21, 4, 2, '#e4d8c4'); }
    // Fluffy tail and body.
    g.E(bx - 8, by - 2, 2.5, 2.5, fur[2]);
    ball(g, bx, by, atk ? 9 : 8, 5.5, fur, false);
    g.E(bx + 3, by + 2, 4, 2, fur[2]);
    // Ears swept back, inner pink.
    const ea = atk ? 4 : 0;
    g.L(hx - 1, hy - 3, hx - 1 - ea, hy - 11 + ea, fur[0], 3);
    g.L(hx - 3, hy - 3, hx - 6 - ea, hy - 10 + ea, fur[1], 3); g.L(hx - 3, hy - 4, hx - 6 - ea, hy - 10 + ea, '#f2b4b4');
    // Branch antlers with a leaf.
    const ax = atk ? 4 : 0, ay = atk ? 3 : 0;
    g.L(hx + 1, hy - 4, hx + 3 + ax, hy - 10 + ay, '#8a6a4c'); g.L(hx + 2, hy - 7 + ay / 2, hx + 6 + ax, hy - 8 + ay, '#8a6a4c'); g.L(hx + 3 + ax, hy - 10 + ay, hx + 1 + ax, hy - 12 + ay, '#a8865f');
    g.P([[hx + 6 + ax, hy - 8 + ay], [hx + 9 + ax, hy - 10 + ay], [hx + 8 + ax, hy - 7 + ay]], '#7fbf62');
    // Head.
    ball(g, hx, hy, 5.5, 4.5, fur, false);
    g.E(hx + 3, hy + 1.5, 2.5, 2, fur[2]);
    eyes(g, hx + 1, hx + 1, hy - 2, atk, 3);
    g.R(hx + 5, hy, 1, 1, '#e08a8a'); blush(g, hx + 1, hy + 2);
    if (atk) g.R(hx + 4, hy + 2, 2, 1, MAW);
    if (atk) { g.R(0, 15, 2, 1, '#e8dcc6'); g.R(1, 18, 3, 1, '#e8dcc6'); }
  },

  fuzzBee(g, f) {
    g.c.translate(0, 3);
    const atk = f === 2, cx = 12, cy = 11 + (f === 1 ? 1 : 0), body = ['#c98a28', '#f2c14e', '#ffe48c'];
    // Wings (behind).
    const wy = atk ? -3 : f ? 2 : 0;
    g.E(6, cy - 8 + wy, 5, 3.5, '#a8d4ea'); g.E(6.5, cy - 8.5 + wy, 4, 2.6, '#e4f6ff'); g.L(3, cy - 8 + wy, 9, cy - 7 + wy, '#c4e4f4');
    g.E(12, cy - 10 + wy, 4, 3, '#a8d4ea'); g.E(12, cy - 10.5 + wy, 3, 2.2, '#f4fcff'); g.R(10, cy - 11 + wy, 2, 1, WH);
    // Stinger.
    if (atk) g.P([[cx + 2, cy + 6], [cx + 7, cy + 11], [cx + 5, cy + 5]], '#4a3a34'); else g.P([[cx - 7, cy + 1], [cx - 11, cy + 3], [cx - 7, cy + 4]], '#4a3a34');
    ball(g, cx, cy, 8.5, 7, body, false);
    band(g, cx, cy, 8.5, 7, cx - 5, cx - 3, '#5a4036', 1); band(g, cx, cy, 8.5, 7, cx - 1, cx + 1, '#5a4036', 1);
    band(g, cx, cy, 8.5, 7, cx - 4, cx - 3, '#6e5248', 2); band(g, cx, cy, 8.5, 7, cx, cx + 1, '#6e5248', 2);
    // Fuzzy collar and fluff tufts.
    for (const [x, y] of [[cx + 2, cy - 7], [cx + 4, cy - 6], [cx - 3, cy - 7], [cx - 7, cy - 4], [cx + 1, cy + 6], [cx - 4, cy + 6]]) g.R(x, y, 2, 1, '#fff2c0');
    g.E(cx - 4, cy - 3, 2, 1.5, '#fff2b0'); g.R(cx - 5, cy - 4, 1, 1, WH);
    // Face.
    eyes(g, cx + 3, cx + 3, cy - 2, atk, 3);
    blush(g, cx + 4, cy + 2); g.R(cx + 6, cy + 1, 1, 1, '#c98a28');
    if (atk) maw(g, cx + 5, cy + 2, 2, 2, false);
    // Antennae.
    g.L(cx + 4, cy - 6, cx + 5, cy - 10, '#7a5a48'); g.R(cx + 5, cy - 11, 2, 2, '#f2c14e'); g.L(cx + 6, cy - 5, cx + 9, cy - 8, '#7a5a48'); g.R(cx + 9, cy - 9, 2, 2, '#f2c14e');
    // Dangly legs.
    for (const x of [cx - 3, cx, cx + 3]) g.R(x, cy + 7, 1, atk ? 1 : 2, '#4a3a34');
  },

  fluffBoar(g, f) {
    const atk = f === 2, b = f === 1 ? 1 : 0, fur = ['#6e4a36', '#9a6c4a', '#c4966a'], mane = ['#c8ac80', '#ecd8b2', '#fff4dc'];
    const bx = atk ? 18 : 16, hx = atk ? 30 : 28, hy = (atk ? 18 : 15) + b;
    const L = atk ? [[4, 0, 1], [10, 0], [22, 0, 1], [27, 0]] : f ? [[8, 1, 1], [12, 0], [21, 1, 1], [25, 0]] : [[8, 0, 1], [12, 1], [21, 0, 1], [25, 1]];
    legs4(g, L, 21, 7, 3, fur, '#3f3230');
    // Curly tail.
    g.R(bx - 13, 13 + b, 2, 1, fur[1]); g.R(bx - 14, 12 + b, 1, 2, fur[1]); g.R(bx - 13, 11 + b, 1, 1, fur[1]);
    ball(g, bx, 16 + b, 12, 7.5, fur, false);
    g.E(bx + 1, 20 + b, 8, 2, fur[2]);
    // Fluffy mane along the back.
    for (let k = 0; k < 6; k++) { const x = bx - 9 + k * 3.4, y = 8 + b + (k % 2); ball(g, x, y + 1, 2.6, 2.2, mane, false); }
    // Head.
    ball(g, hx, hy, 6.5, 6, fur, false);
    g.P([[hx - 4, hy - 4], [hx - 3, hy - 10], [hx, hy - 5]], fur[0]); g.P([[hx - 3, hy - 5], [hx - 3, hy - 8], [hx - 1, hy - 5]], '#e09a8a');
    for (const [x, y] of [[hx - 2, hy - 6], [hx, hy - 7], [hx + 2, hy - 6]]) g.R(x, y, 2, 2, mane[1]);
    // Snout and tusks.
    g.R(hx + 4, hy, 5, 5, '#c97f72'); g.R(hx + 4, hy, 4, 4, '#eaa293'); g.R(hx + 6, hy + 1, 1, 2, '#8a4a40'); g.R(hx + 8, hy + 1, 1, 2, '#8a4a40');
    g.R(hx + 3, hy + 3, 1, 3, '#fff4dc'); g.R(hx + 3, hy + 2, 1, 1, '#fff4dc'); g.R(hx + 8, hy + 4, 1, 2, '#fff4dc');
    eyes(g, hx + 1, hx + 1, hy - 3, atk, 3);
    blush(g, hx - 1, hy + 2);
    if (atk) { g.E(3, 25, 3, 2, 'rgba(220,196,150,.85)'); g.E(7, 26, 2.5, 1.5, 'rgba(236,216,176,.85)'); }
  },

  pondFrog(g, f) {
    const atk = f === 2, up = f === 1 ? 2 : 0, skin = ['#3f7a4a', '#6aaa5a', '#9ad27a'], cx = atk ? 12 : 11;
    // Reed spear.
    if (atk) { g.R(cx + 2, 15 - up, 13, 1, '#9a7a4c'); g.R(cx + 2, 16 - up, 13, 1, '#7a5c3a'); g.P([[25, 13 - up], [28, 15.5 - up], [25, 18 - up]], '#b8c4c8'); g.R(25, 14 - up, 1, 2, WH); }
    else { g.R(22, 4 - up, 1, 20, '#9a7a4c'); g.R(23, 4 - up, 1, 20, '#7a5c3a'); g.P([[20.5, 5 - up], [22.5, 0 - up], [24.5, 5 - up]], '#b8c4c8'); g.R(22, 1 - up, 1, 2, WH); g.R(20, 9 - up, 5, 1, '#c96a5a'); }
    // Back legs.
    g.E(cx - 6, 22, 4, 2.5, skin[0]); g.E(cx + 6, 22, 4, 2.5, skin[0]); g.R(cx - 10, 23, 4, 2, skin[1]); g.R(cx + 6, 23, 4, 2, skin[1]);
    ball(g, cx, 19 - up, 9, 6, skin, false);
    g.E(cx + 1, 21 - up, 5.5, 2.5, '#e8f0b4'); g.E(cx + 1, 20.5 - up, 4, 1.5, '#f8fcd8');
    // Spots.
    g.R(cx - 6, 16 - up, 2, 1, skin[0]); g.R(cx - 4, 19 - up, 1, 1, skin[0]);
    // Eyes on top.
    for (const ex of [cx - 4, cx + 4]) { ball(g, ex, 13 - up, 3.2, 3, skin, false); g.E(ex + .5, 13 - up, 2, 2, '#fffbe8'); }
    if (atk) { g.R(cx - 5, 12 - up, 2, 2, INK); g.R(cx + 4, 12 - up, 2, 2, INK); g.R(cx - 7, 10 - up, 3, 1, INK); g.R(cx + 4, 10 - up, 3, 1, INK); }
    else { eye(g, cx - 4, 12 - up, 2); eye(g, cx + 4, 12 - up, 2); }
    // Mouth.
    if (atk) maw(g, cx - 3, 17 - up, 7, 2, false); else { g.R(cx - 3, 17 - up, 7, 1, '#2f4a32'); g.R(cx - 4, 16 - up, 1, 1, '#2f4a32'); g.R(cx + 4, 16 - up, 1, 1, '#2f4a32'); }
    blush(g, cx - 7, 17 - up); blush(g, cx + 6, 17 - up);
    // Lily pad hat.
    g.E(cx, 9 - up, 8, 2.5, '#3f7a3a'); g.E(cx - 1, 8.5 - up, 6.5, 1.8, '#5fa04a');
    g.R(cx + 3, 8 - up, 3, 1, '#9ad27a'); g.E(cx - 4, 7 - up, 1.5, 1.5, '#f4a0c0'); g.R(cx - 4, 7 - up, 1, 1, '#ffe0ec');
  },

  mushHopper(g, f) {
    const atk = f === 2, up = f === 1 ? 1 : 0, lean = atk ? 2 : 0, stem = ['#d8c8b0', '#f4ead8', '#fffaf0'];
    g.R(6, 21, 4, 3, '#cdbca4'); g.R(13, 21, 4, 3, '#cdbca4'); g.R(6, 21, 1, 2, stem[2]); g.R(13, 21, 1, 2, stem[2]);
    // Stem body.
    g.E(11.5 + lean / 2, 17 - up, 6, 5, stem[0]); g.E(11 + lean / 2, 16.5 - up, 5, 4.2, stem[1]); g.R(8 + lean / 2, 14 - up, 2, 4, stem[2]);
    eyes(g, 9 + lean, 13 + lean, 15 - up, atk, 3);
    blush(g, 7 + lean, 19 - up); blush(g, 14 + lean, 19 - up);
    if (atk) maw(g, 11 + lean, 18 - up, 2, 2, false); else g.R(11 + lean, 19 - up, 2, 1, INK);
    // Cap.
    const cx = 11 + lean, cy = 10 - up + (atk ? 1 : 0);
    g.E(cx, cy + 2, 10, 2, '#e8d4bc'); for (let x = cx - 8; x < cx + 9; x += 2) g.R(x, cy + 2, 1, 2, '#c8b098');
    g.E(cx, cy, 10.5, 6, '#a83a3a'); g.E(cx - 1, cy - 1, 9, 4.8, '#d8544a'); g.E(cx - 3, cy - 3, 4.5, 2.2, '#f07a62');
    g.R(cx - 10, cy + 1, 21, 1, '#a83a3a');
    for (const [x, y, s] of [[-6, -2, 2], [-1, -4, 2], [4, -3, 2], [7, 0, 1], [1, 0, 1], [-4, 1, 1]]) { g.R(cx + x, cy + y, s, s, '#fff2e8'); }
    g.R(cx - 5, cy - 4, 2, 1, WH);
    if (atk) sparks(g, [[cx + 10, cy - 6], [cx + 12, cy - 3, 2], [cx + 8, cy - 8], [cx + 13, cy - 7]], ['#d8f08a', '#f4f8c0', '#b8e070']);
  },

  acornBeetle(g, f) {
    const atk = f === 2, b = f === 1 ? 1 : 0;
    // Legs.
    const lx = f === 1 ? [5, 11, 16] : [6, 12, 17];
    for (const x of lx) { g.L(x, 15, x - 2, 19, '#3f3530'); g.L(x + 1, 15, x + 3, 19, '#3f3530'); }
    // Body under the cap.
    ball(g, 12, 14, 9.5, 4.5, ['#6e4a32', '#a77a55', '#c99a6e'], false);
    // Acorn cap shell, cross-hatched.
    const sy = 9 - b + (atk ? -1 : 0);
    g.E(11, sy, 10, 5, '#5a3f2c'); g.E(10.5, sy - .5, 9, 4.2, '#7a5a3e'); g.E(9, sy - 2, 5, 2, '#9a7650');
    for (let y = sy - 3; y <= sy + 3; y += 2) for (let x = 3 + ((y & 2) ? 1 : 0); x < 20; x += 3) g.R(x, y, 1, 1, '#5a3f2c');
    g.R(2, sy + 3, 18, 1, '#4a3424'); g.R(10, sy - 7, 2, 3, '#5a463f'); g.R(11, sy - 8, 2, 1, '#7a5a3e');
    // Head and horn.
    const hx = atk ? 22 : 21, hy = atk ? 11 : 13 - b * 0;
    ball(g, hx, hy, 5, 4.5, ['#6a5244', '#94786a', '#b89c8c'], false); blush(g, hx + 1, hy + 2);
    if (atk) { g.L(hx + 2, hy - 2, hx + 5, hy - 7, '#4a3e3a', 2); g.R(hx + 5, hy - 8, 1, 1, '#f4e8a0'); g.L(hx + 3, hy + 2, hx + 6, hy + 1, '#4a3e3a'); g.L(hx + 3, hy + 3, hx + 6, hy + 4, '#4a3e3a'); }
    else { g.L(hx + 1, hy - 3, hx + 3, hy - 7, '#4a3e3a', 2); g.R(hx + 4, hy - 8, 1, 1, '#6a5a52'); g.R(hx + 3, hy + 2, 3, 1, '#4a3e3a'); }
    eyes(g, hx + 1, hx + 1, hy - 2, atk, 3);
  },

  mossWolf(g, f) {
    const atk = f === 2, b = f === 1 ? 1 : 0, fur = ['#5a6660', '#7f8c86', '#a8b4ac'], moss = ['#4f7a42', '#6fa052', '#a2cc7a'];
    const bx = atk ? 19 : 18, hx = atk ? 32 : 31, hy = (atk ? 15 : 12) + b;
    const L = atk ? [[4, 0, 1], [9, 0], [25, 0, 1], [30, 0]] : f ? [[9, 1, 1], [13, 0], [24, 1, 1], [28, 0]] : [[9, 0, 1], [13, 1], [24, 0, 1], [28, 1]];
    legs4(g, L, 22, 8, 3, fur);
    // Bushy tail with moss tip.
    g.P([[bx - 10, 16 + b], [bx - 17, 9 + b], [bx - 18, 13 + b], [bx - 14, 19 + b]], fur[1]); g.P([[bx - 12, 15 + b], [bx - 17, 10 + b], [bx - 16, 14 + b]], fur[2]); g.E(bx - 17, 10 + b, 2, 2, moss[1]);
    ball(g, bx, 18 + b, 13, 6.5, fur, false);
    g.E(bx + 2, 22 + b, 9, 2, '#d8dccc');
    // Mossy mane.
    for (const [x, y, r] of [[bx - 6, 12, 3], [bx - 1, 11, 3.5], [bx + 5, 11, 4], [bx + 9, 14, 4], [bx + 8, 19, 3]]) ball(g, x, y + b, r, r * .8, moss, false);
    g.R(bx + 4, 8 + b, 1, 2, '#e8e0a0'); g.R(bx - 2, 9 + b, 1, 1, '#f4b0c0');
    // Head.
    ball(g, hx, hy, 5.5, 5, fur, false);
    g.P([[hx - 3, hy - 3], [hx - 2, hy - 10], [hx + 1, hy - 4]], fur[0]); g.P([[hx, hy - 4], [hx + 2, hy - 10], [hx + 4, hy - 3]], fur[1]); g.R(hx + 2, hy - 7, 1, 2, '#c8a0a0');
    if (atk) {
      g.P([[hx + 2, hy - 1], [hx + 9, hy - 2], [hx + 9, hy + 1], [hx + 3, hy + 1]], fur[1]); g.R(hx + 8, hy - 2, 1, 1, INK);
      g.P([[hx + 2, hy + 2], [hx + 8, hy + 4], [hx + 3, hy + 5]], fur[0]); g.R(hx + 3, hy + 1, 6, 2, MAW); g.R(hx + 4, hy + 1, 1, 1, WH); g.R(hx + 7, hy + 1, 1, 1, WH); g.R(hx + 5, hy + 3, 1, 1, WH);
    } else { g.R(hx + 3, hy, 5, 3, fur[1]); g.R(hx + 3, hy + 2, 5, 1, '#d8dccc'); g.R(hx + 7, hy, 1, 1, INK); }
    eyes(g, hx + 1, hx + 1, hy - 2, atk, 2, '#f0d860'); g.R(hx + 2, hy - 1, 1, 1, INK);
  },

  hollowKeeper(g, f) {
    const atk = f === 2, b = f === 1 ? 1 : 0, bark = ['#5a4232', '#7b5d45', '#9c7a5c'];
    g.R(11, 32, 5, 4, '#c9a050'); g.R(19, 32, 5, 4, '#c9a050'); g.R(11, 32, 2, 1, '#e8c878'); g.R(19, 32, 2, 1, '#e8c878');
    // Wings.
    if (atk) { g.P([[6, 20], [-1, 10], [1, 22], [5, 27]], bark[0]); g.P([[28, 20], [35, 8], [34, 22], [30, 27]], bark[0]); g.P([[6, 21], [1, 13], [3, 22]], bark[1]); }
    else { g.P([[5, 19 + b], [1, 29 + b], [7, 27]], bark[0]); g.P([[29, 19 + b], [33, 29 + b], [27, 27]], bark[0]); }
    ball(g, 17, 22 + b, 11.5, 11, bark, false);
    g.E(17, 26 + b, 6.5, 5.5, '#c9a77f'); g.E(16, 25 + b, 5, 4, '#e0c49c');
    for (let k = 0; k < 4; k++) g.R(14 + (k % 2) * 3, 23 + k * 2 + b, 2, 1, '#a8865f');
    // Bark grain.
    g.R(8, 18 + b, 1, 4, bark[0]); g.R(26, 20 + b, 1, 5, bark[0]);
    // Leafy crown and ear tufts.
    g.P([[7, 12 + b], [4, 4 + b], [11, 9 + b]], bark[1]); g.P([[27, 12 + b], [30, 4 + b], [23, 9 + b]], bark[0]);
    ball(g, 17, 11 + b, 11, 4.5, ['#4f7a42', '#6fa052', '#a2cc7a'], false);
    g.R(12, 8 + b, 2, 1, '#c8e8a0'); g.E(23, 8 + b, 1.5, 1.5, '#f4c050');
    // Eyes.
    for (const x of [12, 22]) { g.E(x, 17 + b, 4.5, 4.5, '#3e2e24'); g.E(x, 17 + b, 3.5, 3.5, atk ? '#ffd860' : '#f0c040'); g.E(x - 1, 16 + b, 1.5, 1.5, '#ffe9a0'); g.R(x - 1, 16 + b, 2, 3, INK); g.R(x - 1, 16 + b, 1, 1, WH); }
    if (atk) { g.R(7, 12 + b, 5, 1, INK); g.R(11, 13 + b, 3, 1, INK); g.R(20, 13 + b, 3, 1, INK); g.R(22, 12 + b, 5, 1, INK); }
    // Beak.
    if (atk) { g.P([[15, 20 + b], [19, 20 + b], [17, 23 + b]], '#e8a54a'); g.P([[15, 23 + b], [19, 23 + b], [17, 25 + b]], '#c8853a'); }
    else g.P([[15, 20 + b], [19, 20 + b], [17, 24 + b]], '#e8a54a');
    // Lantern.
    const lx = atk ? 32 : 30, ly = atk ? 14 : 26;
    if (atk) glow(g, lx, ly + 3, 9, 9, '255,220,140', 3, .14);
    g.L(lx, ly - 3, lx, ly, '#3f3530'); g.R(lx - 2, ly, 5, 7, '#4f4540'); g.R(lx - 1, ly + 1, 3, 5, f === 1 ? '#ffe7a8' : '#f4d48a'); g.R(lx - 1, ly + 1, 1, 1, WH); g.R(lx - 3, ly, 7, 1, '#6b5f58');
  },

  pebbleCrab(g, f) {
    const atk = f === 2, b = f === 1 ? 1 : 0, shell = ['#cf7a58', '#e89a72', '#f8c098'];
    const L = f === 1 ? [4, 8, 21, 25] : [5, 9, 20, 24];
    for (const x of L) { g.L(x + 1, 14, x - (x < 15 ? 2 : -2), 18, '#b0603e'); g.L(x - (x < 15 ? 2 : -2), 18, x - (x < 15 ? 2 : -2), 21, '#b0603e'); }
    ball(g, 16, 14, 11, 6, shell, false);
    // Stone shell with moss.
    ball(g, 16, 10 - b, 10, 6, ['#7c786e', '#a6a296', '#cfcbbf'], true);
    g.R(12, 9 - b, 1, 1, '#7c786e'); g.R(19, 7 - b, 2, 1, '#7c786e'); g.R(18, 12 - b, 1, 1, '#8c887e');
    g.E(19, 5 - b, 3.5, 1.5, '#6f9a52'); g.R(18, 4 - b, 2, 1, '#9cc478');
    // Claws.
    const cy = atk ? 4 : 10, open = atk ? 3 : 1;
    for (const [x, dir] of [[3, -1], [29, 1]]) {
      g.L(x - dir * 3, 13, x, cy + 4, '#c86a48', 2);
      ball(g, x, cy + 2, 3.5, 3, shell, false);
      g.P([[x - 2, cy], [x - 2 + dir * 1, cy - 3 - open], [x + 1, cy - 1]], shell[1]); g.P([[x + 1, cy], [x + 2 + dir, cy - 2 - open], [x + 3, cy + 1]], shell[0]);
    }
    // Eye stalks and face.
    g.R(13, 3 - b, 1, 4, '#b0603e'); g.R(19, 3 - b, 1, 4, '#b0603e');
    g.E(13.5, 2 - b, 2, 2, '#fffbe8'); g.E(19.5, 2 - b, 2, 2, '#fffbe8'); g.R(14, 1 - b + (atk ? 1 : 0), 1, atk ? 1 : 2, INK); g.R(20, 1 - b + (atk ? 1 : 0), 1, atk ? 1 : 2, INK);
    if (atk) { g.R(11, -1 - b + 1, 3, 1, INK); g.R(20, -1 - b + 1, 3, 1, INK); }
    if (atk) maw(g, 15, 15, 3, 2, false); else g.R(15, 16, 3, 1, '#8a3a2a');
    blush(g, 10, 15); blush(g, 21, 15);
  },

  crystalBat(g, f) {
    const atk = f === 2, cy = 12 + (f === 1 ? 1 : 0), wing = atk ? -6 : f ? 4 : 0, mem = ['#3f3260', '#5a4a84', '#7a6aa8'];
    for (const dir of [-1, 1]) {
      const sx = 18 + dir * 4, tip = 18 + dir * 17;
      g.P([[sx, cy - 2], [18 + dir * 10, cy - 8 + wing], [tip, cy - 4 + wing], [18 + dir * 15, cy + 2 + wing / 2], [18 + dir * 12, cy + 1], [18 + dir * 9, cy + 5], [sx, cy + 4]], dir < 0 ? mem[1] : mem[0]);
      g.L(sx, cy - 2, 18 + dir * 10, cy - 8 + wing, '#2f2648'); g.L(18 + dir * 10, cy - 8 + wing, tip, cy - 4 + wing, '#2f2648');
      g.L(18 + dir * 10, cy - 8 + wing, 18 + dir * 12, cy + 1, '#2f2648');
    }
    ball(g, 18, cy + 1, 6.5, 6, ['#5a4a7a', '#8070a8', '#a898cc'], false);
    g.E(18, cy + 4, 3.5, 2.5, '#c8bce4');
    // Crystal ears.
    g.P([[13, cy - 3], [11, cy - 13], [16, cy - 4]], '#a8c8f0'); g.P([[13, cy - 4], [12, cy - 11], [14, cy - 4]], '#e0f0ff');
    g.P([[23, cy - 3], [25, cy - 13], [20, cy - 4]], '#7fa4d8'); g.P([[23, cy - 4], [24, cy - 10], [22, cy - 4]], '#c0dcf8');
    g.P([[17, cy - 5], [18, cy - 9], [19, cy - 5]], '#d8b8f8');
    if (atk) { glow(g, 11, cy - 10, 4, 4, '200,230,255', 2, .2); glow(g, 25, cy - 10, 4, 4, '200,230,255', 2, .2); sparks(g, [[9, cy - 15], [27, cy - 14], [14, cy - 15]], ['#e8f4ff', '#b8d8ff', '#ffffff']); }
    eyes(g, 15, 20, cy - 1, atk, 2, '#ffe880');
    if (atk) { g.R(16, cy + 3, 4, 2, MAW); g.R(16, cy + 3, 1, 2, WH); g.R(19, cy + 3, 1, 2, WH); } else { g.R(16, cy + 3, 1, 2, WH); g.R(19, cy + 3, 1, 2, WH); }
    blush(g, 13, cy + 2); blush(g, 21, cy + 2);
    g.R(16, cy + 7, 1, 2, '#3f3260'); g.R(19, cy + 7, 1, 2, '#3f3260');
  },

  marbleGolem(g, f) {
    const atk = f === 2, s = f === 1 ? 1 : 0, stone = ['#a49e92', '#cfc9bc', '#ece8de'], dark = ['#8a8478', '#aaa498', '#c4beb2'];
    // Legs.
    block(g, 10, 34 + s, 8, 8 - s, dark); block(g, 22, 35 - s, 8, 7 + s, dark);
    // Torso.
    block(g, 7, 15, 26, 21, stone); g.R(29, 16, 3, 19, stone[0]);
    g.L(10, 19, 15, 30, '#b8b0c8'); g.L(12, 24, 9, 30, '#b8b0c8'); g.L(25, 17, 22, 24, '#b8b0c8');
    // Crystal core.
    glow(g, 20, 26, 7, 7, '200,180,255', 3, .12);
    g.P([[20, 20], [24, 26], [20, 31], [16, 26]], '#9c88e0'); g.P([[20, 20], [24, 26], [20, 26]], '#d0c4ff'); g.R(19, 23, 1, 3, WH);
    // Arms.
    if (atk) {
      block(g, 0, 16, 8, 14, dark); g.R(0, 14, 8, 3, '#6f9a52');
      block(g, 28, 0, 10, 10, stone); block(g, 30, 9, 7, 8, dark); g.R(28, 0, 10, 2, '#86b066'); sparks(g, [[26, 2], [39, 4], [38, 0]], ['#ece8de', '#cfc9bc']);
    } else {
      block(g, 0, 16 + s, 8, 15, dark); g.R(0, 14 + s, 8, 3, '#6f9a52'); g.R(1, 14 + s, 3, 1, '#9cc478');
      block(g, 32, 17 - s, 8, 15, stone); g.R(32, 15 - s, 8, 3, '#5f8a4a');
      block(g, 0, 29 + s, 8, 4, dark); block(g, 32, 30 - s, 8, 4, stone);
    }
    // Head.
    block(g, 12, 3 + (atk ? 1 : 0), 16, 13, ['#b4aea2', '#dcd6ca', '#f4f0e8']);
    const hy = atk ? 1 : 0;
    g.R(14, 9 + hy, 4, 2, atk ? '#ff9a50' : '#f0c040'); g.R(22, 9 + hy, 4, 2, atk ? '#ff9a50' : '#f0c040'); g.R(14, 9 + hy, 1, 1, '#fff4c0'); g.R(22, 9 + hy, 1, 1, '#fff4c0');
    if (atk) { g.R(13, 7 + hy, 5, 1, '#6a645a'); g.R(22, 7 + hy, 5, 1, '#6a645a'); g.R(17, 13 + hy, 6, 1, '#6a645a'); }
    g.R(12, 1 + hy, 7, 3, '#6f9a52'); g.R(13, 1 + hy, 3, 1, '#9cc478'); g.E(17, 1.5 + hy, 1.5, 1.5, '#f4e070');
  },

  bellGuardian(g, f) {
    const atk = f === 2, sw = f === 1 ? 1 : 0, steel = ['#6a7278', '#9aa2a8', '#c8d0d4'];
    // Cloak.
    g.P([[11, 24], [33, 24], [38, 54], [6, 54]], '#6a3a4c'); g.P([[11, 24], [21, 24], [17, 54], [6, 54]], '#8e5266'); g.R(7, 52, 30, 2, '#c9a050');
    // Body armour.
    block(g, 13, 22, 20, 22, steel); g.R(13, 34, 20, 2, '#c9a050'); g.R(13, 34, 20, 1, '#e8c878');
    g.E(23, 28, 3, 3, '#c9a050'); g.R(22, 27, 1, 1, '#ffe8a0');
    block(g, 15, 44, 6, 10, steel); block(g, 25, 44, 6, 10, steel); g.R(14, 52, 8, 4, '#4f565c'); g.R(24, 52, 8, 4, '#4f565c');
    // Pauldrons.
    ball(g, 12, 24, 5, 4, steel, false); ball(g, 34, 24, 5, 4, steel, false);
    // Bronze bell head.
    const hx = atk ? 2 : 0;
    g.P([[12 + sw + hx, 23], [34 + sw + hx, 23], [31 + hx, 9], [26 + hx, 4], [20 + hx, 4], [15 + hx, 9]], '#9a7232');
    g.P([[13 + sw + hx, 22], [30 + sw + hx, 22], [28 + hx, 9], [25 + hx, 5], [20 + hx, 5], [16 + hx, 9]], '#c9a050');
    g.P([[14 + sw + hx, 21], [19 + hx, 21], [19 + hx, 7], [16 + hx, 10]], '#ecd08a'); g.R(17 + hx, 9, 1, 8, '#fff4c8');
    g.R(10 + sw + hx, 21, 26, 3, '#7a5a28'); g.R(10 + sw + hx, 21, 26, 1, '#b08a48'); g.R(21 + hx, 1, 4, 4, '#7a5a28'); g.R(22 + hx, 2, 2, 1, '#b08a48');
    g.R(16 + hx, 13, 14, 4, '#2a2420');
    const glowCol = atk ? '#ff8a6a' : '#7fe8d0';
    g.R(18 + hx, 14, 3, 2, glowCol); g.R(25 + hx, 14, 3, 2, glowCol);
    if (atk) glow(g, 23 + hx, 15, 10, 4, '255,140,110', 2, .16);
    // Halberd.
    if (atk) {
      g.L(18, 42, 46, 14, '#6b4f3a', 2); g.P([[44, 10], [48, 8], [48, 18], [44, 17]], steel[2]); g.P([[41, 16], [45, 20], [40, 22]], steel[1]); g.R(46, 11, 1, 5, WH);
      ball(g, 22, 38, 4, 4, steel, false);
    } else {
      g.R(40, 4, 2, 50, '#6b4f3a'); g.R(40, 4, 1, 50, '#8a6a4c'); g.P([[42, 6], [46, 10], [42, 17]], steel[2]); g.P([[40, 6], [35, 9], [40, 14]], steel[1]); g.R(40, 1, 2, 4, steel[2]); g.R(39, 18, 4, 2, '#c9a050');
      ball(g, 38, 28, 4, 4, steel, false);
    }
  },

  mistWisp(g, f) {
    const atk = f === 2, tail = f === 1 ? 2 : -2, cx = atk ? 16 : 14, cy = atk ? 15 : 16;
    glow(g, cx, cy, 13, 13, '190,250,230', 3, .1);
    g.P([[cx - 8, cy + 2], [cx + 8, cy + 2], [cx + 6, cy + 12], [cx + 1 + tail, cy + 18], [cx - 2 + tail, cy + 23], [cx - 3, cy + 16], [cx - 7, cy + 11]], 'rgba(170,222,214,.9)');
    g.P([[cx - 5, cy + 4], [cx + 4, cy + 4], [cx + 2, cy + 12], [cx - 1 + tail, cy + 18], [cx - 2, cy + 12]], 'rgba(214,244,238,.9)');
    if (atk) { g.P([[cx + 6, cy - 4], [cx + 13, cy - 8], [cx + 10, cy - 1]], 'rgba(214,244,238,.9)'); g.P([[cx + 6, cy + 3], [cx + 13, cy + 6], [cx + 9, cy]], 'rgba(214,244,238,.9)'); }
    ball(g, cx, cy, 9, 9, ['rgba(160,214,206,.95)', 'rgba(210,242,236,.95)', 'rgba(250,255,253,.95)'], false);
    g.P([[cx - 8, cy - 3], [cx - 13, cy - 8 + tail], [cx - 8, cy + 2]], 'rgba(200,238,230,.9)'); g.P([[cx + 1, cy - 8], [cx + 3, cy - 13 - tail], [cx + 5, cy - 7]], 'rgba(220,246,240,.95)');
    if (atk) { g.R(cx - 4, cy - 1, 3, 3, '#2e6a64'); g.R(cx + 2, cy - 1, 3, 3, '#2e6a64'); g.R(cx - 3, cy, 1, 1, '#c8fff0'); g.R(cx + 3, cy, 1, 1, '#c8fff0'); g.E(cx, cy + 4, 2, 1.5, '#2e6a64'); }
    else { g.R(cx - 4, cy - 1, 3, 4, '#3f6a66'); g.R(cx + 2, cy - 1, 3, 4, '#3f6a66'); g.R(cx - 4, cy - 1, 1, 1, WH); g.R(cx + 2, cy - 1, 1, 1, WH); }
    blush(g, cx - 6, cy + 3); blush(g, cx + 5, cy + 3);
    g.E(cx, cy + 9, 2.5, 2.5, 'rgba(150,250,210,.85)'); g.R(cx - 1, cy + 8, 2, 2, '#f0fff8');
    if (atk) sparks(g, [[cx + 12, cy - 2], [cx + 10, cy + 8], [cx - 10, cy - 8]], ['#c8fff0', '#ffffff', '#a0f0d8']);
  },

  lanternGhost(g, f) {
    const atk = f === 2, cy = 12 + (f === 1 ? 1 : 0), sheet = ['#c8c0d8', '#ece8f4', '#ffffff'];
    const hem = f === 1 ? 2 : 0;
    g.P([[4, cy + 1], [19, cy + 1], [20, cy + 14], [17, cy + 12 + hem], [14, cy + 15], [11, cy + 12 + hem], [8, cy + 15], [5, cy + 12], [3, cy + 13]], sheet[0]);
    g.P([[5, cy + 1], [17, cy + 1], [17, cy + 11], [14, cy + 13], [11, cy + 10 + hem], [8, cy + 13], [5, cy + 10]], sheet[1]);
    ball(g, 11.5, cy, 8.5, 8, sheet, true);
    // Nightcap.
    g.P([[5, cy - 5], [17, cy - 6], [10, cy - 14], [4, cy - 13]], '#6a5a9a'); g.P([[6, cy - 6], [12, cy - 7], [9, cy - 13]], '#8a7ab8'); g.E(3, cy - 13, 2, 2, '#f4e08a'); g.R(4, cy - 6, 14, 2, '#f4e8d0');
    // Face.
    if (atk) { g.R(8, cy - 1, 2, 2, '#4a3f5a'); g.R(14, cy - 1, 2, 2, '#4a3f5a'); g.R(7, cy - 3, 3, 1, '#4a3f5a'); g.R(14, cy - 3, 3, 1, '#4a3f5a'); g.E(12, cy + 4, 2.5, 2, '#4a3f5a'); g.R(11, cy + 5, 2, 1, TONGUE); }
    else { g.R(8, cy - 1, 2, 3, '#4a3f5a'); g.R(14, cy - 1, 2, 3, '#4a3f5a'); g.R(8, cy - 1, 1, 1, WH); g.R(14, cy - 1, 1, 1, WH); g.R(11, cy + 3, 2, 1, '#4a3f5a'); }
    blush(g, 6, cy + 2); blush(g, 15, cy + 2);
    // Lantern.
    const lx = atk ? 23 : 22, ly = atk ? cy - 4 : cy + 6;
    glow(g, lx, ly + 4, atk ? 9 : 7, atk ? 9 : 7, '255,214,130', 3, atk ? .18 : .13);
    g.L(18, cy + 4, lx, ly - 2, sheet[1], 2); g.L(lx, ly - 2, lx, ly, '#3f3530');
    g.R(lx - 3, ly, 6, 1, '#6b5f58'); g.R(lx - 2, ly + 1, 5, 7, '#4f4540'); g.R(lx - 1, ly + 2, 3, 5, f === 1 ? '#ffe7a8' : '#f4d48a'); g.R(lx, ly + 3, 1, 2, atk ? '#ff8a3a' : '#ffb050'); g.R(lx - 3, ly + 8, 6, 1, '#6b5f58');
    if (atk) sparks(g, [[lx + 3, ly - 3], [lx - 2, ly - 5], [lx + 4, ly + 1]]);
  },

  glowMoth(g, f) {
    const atk = f === 2, cy = 12 + (f === 1 ? 1 : 0), up = atk ? -4 : f ? 3 : 0;
    // Upper and lower wings.
    for (const dir of [-1, 1]) {
      const k = dir < 0 ? ['#a8b8d0', '#d4e2f0', '#f0f6fc'] : ['#98a8c4', '#c4d4e8', '#e4eef8'];
      ball(g, 15 + dir * 8, cy - 3 + up, 7, 5.5 - up / 3, k, false);
      ball(g, 15 + dir * 6, cy + 6, 4.5, 3.5, k, false);
      const sx = 15 + dir * 9, sy = cy - 3 + up;
      glow(g, sx, sy, 4, 4, '150,250,220', 2, atk ? .26 : .18); g.E(sx, sy, 2, 2, '#7fe0c8'); g.R(sx, sy - 1, 1, 1, '#e8fff8');
      g.R(15 + dir * 6, cy + 6, 1, 1, '#7fe0c8');
    }
    // Body.
    ball(g, 15, cy + 2, 3, 6.5, ['#6a6078', '#8a8298', '#aaa2b8'], false);
    for (let y = cy + 2; y < cy + 8; y += 2) g.R(13, y, 4, 1, '#6a6078');
    // Fluffy collar and head.
    g.E(15, cy - 3, 4, 2.5, '#f4eedc'); g.R(13, cy - 4, 2, 1, WH);
    ball(g, 15, cy - 6, 3.5, 3, ['#8a8298', '#aaa2b8', '#ccc4d8'], false);
    eyes(g, 14, 16, cy - 7, atk, 2);
    if (atk) g.R(15, cy - 4, 1, 1, MAW);
    // Feathery antennae.
    g.L(14, cy - 9, 10, cy - 14, '#8a8298'); g.L(16, cy - 9, 20, cy - 14, '#8a8298'); g.R(9, cy - 15, 2, 2, '#c8f0e0'); g.R(20, cy - 15, 2, 2, '#c8f0e0');
    if (atk) sparks(g, [[3, cy - 10], [27, cy - 9], [6, cy + 10], [25, cy + 11], [15, cy - 17]], ['#c8fff0', '#7fe0c8', '#ffffff']);
  },

  bindingRoots(g, f) {
    const atk = f === 2, sway = f === 1 ? 1 : -1, bark = ['#3f3028', '#5e4a3e', '#80685a'];
    const tendrils = atk
      ? [[8, 0, 12, '#3f3028'], [33, 42, 6, '#3f3028'], [14, 28, 0, '#5e4a3e'], [28, 42, 16, '#5e4a3e']]
      : [[8, 3 + sway, 6, '#3f3028'], [33, 37 - sway, 4, '#3f3028'], [14, 10 - sway, 0, '#5e4a3e'], [28, 31 + sway, 2, '#5e4a3e']];
    for (const [x0, x1, top, col] of tendrils) {
      let px = x0, py = 36;
      for (let k = 1; k <= 12; k++) { const t = k / 12, x = lerp(x0, x1, t) + Math.sin(t * 6 + sway) * 2, y = 36 - (36 - top) * t, wd = Math.max(1, Math.round(5 - t * 4)); g.L(px, py, x, y, col, wd); if (wd > 2) g.L(px - 1, py, x - 1, y, bark[2]); px = x; py = y; }
      const ex = x1 + Math.sin(6 + sway) * 2; g.P([[ex, top], [ex + 3, top - 3], [ex + 2, top + 1]], '#6fa052'); g.R(ex + 1, top - 1, 1, 1, '#a2cc7a');
    }
    // Knotted trunk heart.
    ball(g, 21, 28, 13, 10, bark, false);
    for (const [x, y] of [[12, 26], [28, 24], [16, 33], [27, 32]]) g.R(x, y, 3, 1, bark[0]);
    g.E(13, 21, 3, 1.5, '#6fa052'); g.R(12, 20, 2, 1, '#a2cc7a'); g.E(30, 22, 2, 1, '#6fa052');
    // Great eye.
    const lid = f === 1 ? 1 : 0;
    g.E(21, 26, 6, 5, '#2a201c'); g.E(21, 26, 4.5, 3.6 - lid, atk ? '#ffe070' : '#c9f0a0'); g.E(21, 26, 2.5, 2 - lid / 2, atk ? '#ffb040' : '#9ad870');
    g.R(21, 24 + lid, 1, 4 - lid * 2, INK); g.R(19, 24 + lid, 1, 1, WH);
    if (atk) { glow(g, 21, 26, 10, 8, '255,220,110', 2, .14); g.R(15, 20, 4, 1, bark[0]); g.R(24, 20, 4, 1, bark[0]); }
    // Root base.
    for (let k = 0; k < 6; k++) { g.R(6 + k * 6, 36, 5, 4, bark[0]); g.R(6 + k * 6, 36, 2, 1, bark[1]); }
  },

  heartGuardian(g, f) {
    const atk = f === 2, br = f === 1 ? 1 : 0, bark = ['#3f3028', '#5e4a3e', '#80685a'], moss = ['#3f6a42', '#5f9452', '#92c072'];
    const hx = atk ? 52 : 48, hy = atk ? 30 : 25;
    // Legs.
    legs4(g, atk ? [[10, 0, 1], [16, 0], [38, 0, 1], [46, 0]] : [[15, 0, 1], [21, 1], [35, 0, 1], [41, 1]], 46, 18, 5, bark, '#2a201c');
    // Body of bark with a mossy back.
    ball(g, 29, 42, 21, 12, bark, false);
    for (const [x, y] of [[14, 44], [22, 48], [34, 47], [42, 42]]) g.R(x, y, 4, 1, bark[0]);
    ball(g, 26, 34, 17, 6.5, moss, false);
    for (const [x, y] of [[13, 31], [21, 29], [33, 31], [40, 35], [17, 35]]) { g.R(x, y, 3, 2, '#b8dc94'); }
    for (const [x, y, k] of [[18, 28, '#f4b0c8'], [30, 28, '#fff0a0'], [37, 32, '#f4b0c8']]) { g.R(x, y, 2, 2, k); g.R(x, y, 1, 1, WH); }
    // Tail tuft.
    g.P([[9, 36], [2, 31], [4, 42]], bark[1]); g.E(3, 31, 2.5, 2, moss[1]);
    // Glowing heart in the chest.
    const gl = atk ? 1.4 : 1, HX = 40, HY = 44;
    // Neck and stag head.
    g.P([[36, 36], [hx - 6, hy + 1], [hx + 3, hy + 2], [hx + 1, hy + 9], [47, 38]], bark[1]); g.P([[38, 35], [hx - 5, hy + 2], [hx - 2, hy + 3], [41, 37]], bark[2]);
    ball(g, hx, hy, 7.5, 7, bark, false);
    g.P([[hx + 3, hy - 1], [hx + 10, hy + 1], [hx + 10, hy + 5], [hx + 3, hy + 5]], bark[1]); g.R(hx + 9, hy + 2, 2, 2, '#2a201c'); g.R(hx + 4, hy + 4, 6, 1, bark[0]);
    if (atk) { g.R(hx + 4, hy + 5, 6, 2, MAW); g.R(hx + 5, hy + 5, 1, 1, WH); }
    g.R(hx, hy - 2, 4, 2, atk ? '#ffffff' : '#c4f6dc'); g.R(hx + 1, hy - 2, 1, 1, WH); glow(g, hx + 2, hy - 1, 4, 3, '150,250,200', 2, .2);
    g.P([[hx - 6, hy - 3], [hx - 11, hy - 6], [hx - 6, hy]], bark[1]);
    glow(g, HX, HY, (8 + br) * gl * 1.5, (7 + br) * gl * 1.5, '150,250,200', 3, atk ? .18 : .12);
    g.E(HX, HY - 1, 6, 5.5, bark[0]); g.P([[HX, HY + 4], [HX - 5, HY - 1], [HX - 4, HY - 4], [HX, HY - 3], [HX + 4, HY - 4], [HX + 5, HY - 1]], atk ? '#e8fff4' : br ? '#c4f6dc' : '#9fe8c0'); g.R(HX - 3, HY - 3, 2, 1, WH);
    // Branch antlers with leaves and blossoms.
    const lean = atk ? 5 : 0;
    const antler = (x, dir) => {
      g.L(x, hy - 5, x + dir * 2 + lean, hy - 17, bark[1], 2); g.L(x + dir + lean / 2, hy - 11, x + dir * 8 + lean, hy - 16, bark[1], 2); g.L(x + dir * 2 + lean, hy - 15, x - dir * 3 + lean, hy - 23, bark[1], 2); g.L(x + dir * 6 + lean, hy - 15, x + dir * 10 + lean, hy - 21, bark[1]);
      for (const [lx, ly] of [[x + dir * 8 + lean, hy - 17], [x - dir * 3 + lean, hy - 24], [x + dir * 10 + lean, hy - 22]]) { ball(g, lx, ly, 2.5, 2, moss, false); g.R(lx, ly - 1, 1, 1, '#d8f0b0'); }
    };
    antler(hx - 3, -1); antler(hx + 3, 1);
    g.R(hx - 9 + lean, hy - 26, 2, 2, '#f4b0c8'); g.R(hx + 12 + lean, hy - 20, 2, 2, '#fff0a0');
    if (atk) sparks(g, [[hx + 14, hy - 4], [hx + 12, hy + 10], [56, 40], [hx - 14, hy - 12]], ['#c8fff0', '#ffffff', '#9fe8c0']);
  },

  // ---- Farm raiders ----
  fieldMole(g, f) {
    const atk = f === 2, b = f === 1 ? 1 : 0, fur = ['#5a4238', '#7e5e4c', '#a58268'];
    // Dirt mound behind.
    g.E(5, 18, 5, 3, '#8a6448'); g.E(4, 17, 3.5, 2, '#a87c58'); g.R(3, 15, 1, 1, '#c89c74'); g.R(6, 16, 1, 1, '#6a4c38');
    ball(g, 12, 13 + b, 9.5, 6.5 - b / 2, fur, false);
    g.E(14, 16 + b, 6, 2.5, '#c49a7e');
    // Back feet.
    g.R(6, 18, 4, 2, '#e8a0a0'); g.R(13, 18, 4, 2, '#e8a0a0');
    // Mining hat with candle.
    g.E(10, 7 + b, 5.5, 2.5, '#d8a840'); g.E(9.5, 6.5 + b, 4, 1.5, '#f0c860'); g.R(4, 8 + b, 12, 1, '#a87c28'); g.R(10, 3 + b, 2, 3, '#f4ecd8'); g.R(10, 1 + b, 2, 2, atk ? '#ff9a3c' : '#ffd060'); g.R(10, 2 + b, 1, 1, '#fff6c0');
    // Snout with a pink star nose.
    const nx = atk ? 23 : 22;
    g.P([[17, 10 + b], [nx - 1, 12 + b], [nx - 1, 15 + b], [17, 16 + b]], fur[2]);
    g.R(nx - 1, 12 + b, 3, 3, '#f08aa0'); g.R(nx - 1, 11 + b, 1, 1, '#f08aa0'); g.R(nx + 1, 15 + b, 1, 1, '#f08aa0'); g.R(nx - 1, 12 + b, 1, 1, '#ffd0dc');
    // Squinty eye.
    if (atk) { g.R(15, 10 + b, 3, 1, INK); g.R(16, 11 + b, 2, 1, INK); } else { g.R(15, 11 + b, 3, 1, INK); g.R(15, 10 + b, 1, 1, INK); g.R(17, 10 + b, 1, 1, INK); }
    blush(g, 15, 13 + b);
    if (atk) maw(g, 18, 15 + b, 3, 2, true);
    // Big digging claws.
    const cx = atk ? 20 : 17, cy = atk ? 6 : 16;
    g.E(cx, cy + b, 3, 2.5, '#f2a8b0'); g.E(cx - .5, cy - .5 + b, 2, 1.5, '#ffd0d8');
    for (let k = 0; k < 3; k++) g.R(cx + 2, cy - 2 + k * 2 + b, 3, 1, '#f4ecd8');
    if (atk) sparks(g, [[24, 3], [25, 9], [23, 1]], ['#a87c58', '#c89c74', '#8a6448']);
  },

  cropGoblin(g, f) {
    const atk = f === 2, b = f === 1 ? 1 : 0, skin = ['#4f7a3a', '#7aa852', '#a8d078'];
    // Feet.
    g.R(9, 25, 4, 3, '#6a4c38'); g.R(15, 25, 4, 3, '#6a4c38'); g.R(9, 25 + (f === 1 ? 0 : 1), 1, 1, '#8a6a4c');
    // Burlap sack on the back with a carrot sticking out.
    const sx = atk ? 6 : 6, sy = 14 + b;
    ball(g, sx, sy, 6, 7, ['#9a7a4c', '#c4a06a', '#e0c08a'], false);
    g.R(sx - 3, sy - 2, 1, 4, '#8a6a3e'); g.R(sx + 1, sy + 1, 2, 1, '#8a6a3e'); g.R(sx - 1, sy - 7, 4, 2, '#7a5a30');
    g.P([[sx, sy - 7], [sx - 3, sy - 14], [sx + 1, sy - 8]], '#f08a3a'); g.R(sx - 4, sy - 16, 1, 3, '#6fae54'); g.R(sx - 2, sy - 16, 1, 3, '#8cc46a');
    // Body in a patched tunic.
    ball(g, 14, 20 + b, 6, 5.5, ['#6a4c38', '#8f6a4a', '#b08a64'], false);
    g.R(12, 20 + b, 3, 3, '#c4a06a'); g.R(12, 20 + b, 1, 1, '#e0c08a'); g.R(9, 17 + b, 11, 2, '#7a3a3a');
    // Head with big ears.
    const hx = atk ? 17 : 16, hy = 11 + b;
    g.P([[hx - 5, hy - 1], [hx - 12, hy - 5], [hx - 5, hy + 2]], skin[0]); g.P([[hx - 5, hy], [hx - 10, hy - 4], [hx - 5, hy + 1]], '#e0a0a0');
    g.P([[hx + 5, hy - 1], [hx + 11, hy - 5], [hx + 5, hy + 2]], skin[1]); g.P([[hx + 5, hy], [hx + 9, hy - 4], [hx + 5, hy + 1]], '#f0b8b0');
    ball(g, hx, hy, 6, 5.5, skin, false);
    // Leaf cap.
    g.P([[hx - 6, hy - 3], [hx - 2, hy - 9], [hx + 6, hy - 6], [hx + 5, hy - 3]], '#3f7a3a'); g.P([[hx - 4, hy - 4], [hx - 1, hy - 8], [hx + 4, hy - 5]], '#5fa04a'); g.L(hx - 1, hy - 8, hx - 3, hy - 11, '#5a463f');
    eyes(g, hx - 2, hx + 2, hy - 1, atk, 2, '#f4d040'); g.R(hx - 1, hy, 1, 1, INK); g.R(hx + 3, hy, 1, 1, INK);
    g.R(hx + 1, hy + 2, 2, 1, skin[0]);
    if (atk) { maw(g, hx - 1, hy + 3, 4, 2, true); } else { g.R(hx - 1, hy + 3, 4, 1, '#2f3a24'); g.R(hx + 2, hy + 4, 1, 1, WH); }
    blush(g, hx - 4, hy + 2); blush(g, hx + 4, hy + 2);
    // Turnip held in hand (raised to throw on attack).
    const tx = atk ? 24 : 22, ty = atk ? 4 : 20 + b;
    g.L(18, 19 + b, tx - 1, ty + 2, skin[1], 2);
    ball(g, tx, ty, 3.5, 3.5, ['#9a5a9a', '#c88ac8', '#f4e8f4'], false); g.R(tx - 1, ty + 2, 3, 1, '#f4f0f4'); g.R(tx, ty + 3, 1, 2, '#e8dce8');
    g.P([[tx, ty - 3], [tx - 3, ty - 7], [tx - 1, ty - 3]], '#5fa04a'); g.P([[tx, ty - 3], [tx + 3, ty - 7], [tx + 1, ty - 3]], '#86c06a');
  },

  roadBandit(g, f) {
    const atk = f === 2, b = f === 1 ? 1 : 0, fur = ['#5e5866', '#857e8e', '#aea8b6'];
    // Ringed tail.
    for (let k = 0; k < 5; k++) { const x = 8 - k * 1.6, y = 20 - k * 2.4 + b; g.E(x, y, 3.2, 2.6, k % 2 ? '#3f3a46' : fur[1]); }
    g.E(2, 9 + b, 2.5, 2.2, '#3f3a46');
    // Legs and body.
    g.R(10, 24, 4, 4, fur[0]); g.R(15, 24, 4, 4, fur[0]); g.R(9, 26, 5, 2, '#3f3a46'); g.R(15, 26, 5, 2, '#3f3a46');
    ball(g, 14, 20 + b, 6.5, 6, fur, false);
    g.E(15, 22 + b, 3.5, 3, '#e8e2ea');
    // Leaf scarf.
    g.P([[8, 15 + b], [20, 15 + b], [18, 18 + b], [10, 18 + b]], '#4f8a42'); g.P([[9, 16 + b], [4, 19 + b + (f === 1 ? 1 : 0)], [8, 18 + b]], '#6fae54');
    // Head.
    const hx = atk ? 18 : 16, hy = 10 + b;
    g.P([[hx - 6, hy - 2], [hx - 5, hy - 9], [hx - 2, hy - 5]], fur[0]); g.R(hx - 5, hy - 6, 1, 2, '#e0b0b8');
    g.P([[hx + 1, hy - 5], [hx + 4, hy - 9], [hx + 5, hy - 3]], fur[1]); g.R(hx + 3, hy - 6, 1, 2, '#e0b0b8');
    ball(g, hx, hy, 6.5, 5.5, fur, false);
    g.P([[hx + 2, hy + 1], [hx + 9, hy + 2], [hx + 7, hy + 5], [hx + 1, hy + 5]], '#f0ecf2'); g.R(hx + 8, hy + 1, 2, 2, INK); g.R(hx + 8, hy + 1, 1, 1, '#8a8090');
    // Leaf mask across the eyes, its tails flapping behind.
    g.R(hx - 5, hy - 2, 12, 4, '#3f7a3a'); g.R(hx - 5, hy - 2, 12, 1, '#6fae54'); g.P([[hx - 5, hy - 2], [hx - 10, hy - 4 - b], [hx - 9, hy + 1]], '#4f8a42'); g.P([[hx - 6, hy], [hx - 11, hy + 2 + b], [hx - 7, hy + 2]], '#6fae54');
    eyes(g, hx, hx + 4, hy - 1, atk, 2, INK); g.R(hx - 1, hy - 1, 1, 2, WH); g.R(hx + 3, hy - 1, 1, 2, WH);
    if (atk) maw(g, hx + 4, hy + 4, 3, 2, true); else g.R(hx + 5, hy + 4, 2, 1, INK);
    // Wooden club: over the shoulder, swung forward on attack.
    if (atk) { g.L(hx + 4, hy + 9, 28, 16, '#7a5a3a', 2); ball(g, 27, 17, 3, 4, ['#6a4a30', '#9a7048', '#c09068'], false); g.R(26, 15, 1, 1, '#4a3424'); sparks(g, [[29, 11], [25, 22], [29, 22]], ['#fff2b0', '#ffffff']); }
    else { g.L(20, 19 + b, 23, 6 + b, '#7a5a3a', 2); ball(g, 24, 4 + b, 3, 4, ['#6a4a30', '#9a7048', '#c09068'], false); g.R(25, 3 + b, 1, 1, '#4a3424'); g.R(23, 6 + b, 1, 1, '#4a3424'); }
    g.E(20, 19 + b, 2, 2, fur[1]);
  },

  // ---- Red Wind Canyon ----
  dustLizard(g, f) {
    const atk = f === 2, b = f === 1 ? 1 : 0, skin = ['#9a3e2e', '#c95c3e', '#ec8a5c'];
    // Tail sweeping back.
    g.P([[10, 14], [0, 13 + b * 2], [1, 15 + b * 2], [11, 18]], skin[0]); g.P([[10, 15], [3, 14 + b * 2], [10, 16]], skin[1]);
    // Splayed legs.
    for (const [x, d] of [[9, f === 1 ? 1 : 0], [21, f === 1 ? 0 : 1]]) { g.R(x, 16, 3, 4 - d, skin[0]); g.R(x - 2, 20 - d, 6, 2, '#7a2e22'); }
    // Body with ochre bands and back spikes.
    ball(g, 16, 14 + b / 2, 9, 4.5, skin, false);
    g.E(17, 17, 7, 1.5, '#f4c08a');
    for (const x of [11, 15, 19]) g.R(x, 12 + b / 2, 2, 2, '#e8b050');
    for (const x of [9, 12, 15, 18, 21]) g.P([[x, 10 + b / 2], [x + 1, 7 + b / 2], [x + 2, 10 + b / 2]], '#f0c060');
    // Frill.
    const fx = atk ? 26 : 25, hy = atk ? 11 : 12 + b / 2;
    if (atk) { g.E(fx - 1, hy, 6, 7, '#e8a040'); g.E(fx - 1, hy, 5, 6, '#f4c860'); for (let k = -2; k <= 2; k++) g.L(fx - 1, hy, fx - 2 + k * 2, hy - 6 + Math.abs(k), '#c86a2a'); g.E(fx - 1, hy, 4, 4, '#e86a3a'); }
    else { g.P([[fx - 3, hy - 3], [fx - 1, hy - 6], [fx + 1, hy - 3]], '#e8a040'); g.P([[fx - 3, hy + 3], [fx - 1, hy + 5], [fx + 1, hy + 2]], '#d88a30'); }
    // Head.
    ball(g, fx + 3, hy, 5, 3.5, skin, false);
    g.R(fx + 4, hy + 2, 5, 1, '#f4c08a');
    eyes(g, fx + 3, fx + 3, hy - 2, atk, 2, '#ffd860'); g.R(fx + 4, hy - 1, 1, 1, INK);
    if (atk) { g.P([[fx + 4, hy + 1], [fx + 10, hy], [fx + 10, hy + 4], [fx + 4, hy + 3]], MAW); g.R(fx + 6, hy + 3, 3, 1, TONGUE); g.L(fx + 9, hy + 2, fx + 11, hy + 1, '#f06a8a'); g.R(fx + 5, hy + 1, 1, 1, WH); }
    else g.R(fx + 6, hy + 1, 3, 1, '#7a2e22');
    if (atk) { g.E(4, 19, 3, 2, 'rgba(232,180,130,.8)'); g.E(8, 20, 2, 1.5, 'rgba(240,200,150,.8)'); }
  },

  cliffHarpy(g, f) {
    const atk = f === 2, cy = 13 + (f === 1 ? 1 : 0), wing = atk ? -5 : f ? 4 : 0, feath = ['#8a3a2a', '#b85a3a', '#e08a58'];
    // Wings.
    for (const dir of [-1, 1]) {
      const cx = 17, k = dir < 0 ? feath : ['#7a3024', '#a04a32', '#c87048'];
      g.P([[cx + dir * 3, cy - 1], [cx + dir * 11, cy - 9 + wing], [cx + dir * 16, cy - 6 + wing], [cx + dir * 15, cy - 2 + wing], [cx + dir * 13, cy + 2 + wing / 2], [cx + dir * 10, cy + 4], [cx + dir * 4, cy + 4]], k[1]);
      g.P([[cx + dir * 4, cy], [cx + dir * 11, cy - 7 + wing], [cx + dir * 13, cy - 5 + wing], [cx + dir * 6, cy + 2]], k[2]);
      for (let j = 0; j < 3; j++) g.L(cx + dir * (10 + j * 2), cy - 4 + wing + j, cx + dir * (9 + j * 2), cy + 2 + wing / 2, k[0]);
    }
    // Tail feathers.
    g.P([[14, cy + 8], [11, cy + 14], [17, cy + 11], [20, cy + 14], [19, cy + 8]], feath[0]);
    // Body.
    ball(g, 17, cy + 5, 5.5, 5.5, feath, false);
    g.E(18, cy + 7, 3, 3, '#f4dcb0');
    // Taloned legs.
    const ly = atk ? cy + 8 : cy + 10;
    for (const x of [15, 19]) { g.R(x + (atk ? 2 : 0), ly, 1, 4, '#e8b040'); g.R(x - 1 + (atk ? 3 : 0), ly + 4, 3, 1, '#e8b040'); g.R(x - 1 + (atk ? 5 : 0), ly + 5, 1, 1, INK); }
    // Head with a feathery crest.
    const hx = atk ? 19 : 18, hy = cy - 4;
    g.P([[hx - 4, hy - 3], [hx - 9, hy - 9], [hx - 2, hy - 6]], feath[1]); g.P([[hx - 2, hy - 5], [hx - 4, hy - 12], [hx + 1, hy - 6]], feath[2]); g.P([[hx, hy - 5], [hx + 3, hy - 11], [hx + 3, hy - 5]], '#f0b060');
    ball(g, hx, hy, 5.5, 5, feath, false);
    g.E(hx + 2, hy + 1, 3.5, 3, '#f8e4c0');
    eyes(g, hx + 1, hx + 1, hy - 1, atk, 2, '#e8a020'); g.R(hx + 2, hy, 1, 1, INK); g.R(hx - 2, hy + 2, 2, 1, BLUSH);
    if (atk) { g.P([[hx + 4, hy], [hx + 8, hy + 1], [hx + 4, hy + 1]], '#f0c040'); g.P([[hx + 4, hy + 2], [hx + 7, hy + 3], [hx + 4, hy + 3]], '#d8a030'); }
    else g.P([[hx + 4, hy], [hx + 7, hy + 2], [hx + 4, hy + 2]], '#f0c040');
  },

  emberImp(g, f) {
    const atk = f === 2, cy = 13 + (f === 1 ? 1 : 0), coal = ['#2a2228', '#443840', '#62545c'];
    glow(g, 13, cy, 13, 12, '255,150,70', 3, .13);
    // Tiny bat wings.
    const wy = f === 1 ? 2 : atk ? -2 : 0;
    g.P([[9, cy - 2], [2, cy - 7 + wy], [3, cy + 1 + wy], [8, cy + 2]], coal[1]); g.P([[17, cy - 2], [24, cy - 7 + wy], [23, cy + 1 + wy], [18, cy + 2]], coal[0]);
    g.L(9, cy - 2, 2, cy - 7 + wy, '#ff9a3c'); g.L(17, cy - 2, 24, cy - 7 + wy, '#c8602a');
    // Tail.
    g.L(9, cy + 6, 4, cy + 11, coal[1]); g.P([[2, cy + 10], [5, cy + 13], [5, cy + 9]], '#ff9a3c');
    // Flame hair.
    const fl = f === 1 ? 1 : 0;
    g.P([[7, cy - 4], [8, cy - 12 - fl], [11, cy - 7], [13, cy - 14 + fl], [15, cy - 7], [18, cy - 11 - fl], [19, cy - 4]], '#ff7a2a');
    g.P([[9, cy - 4], [10, cy - 9 - fl], [12, cy - 6], [13, cy - 11 + fl], [15, cy - 6], [17, cy - 8], [17, cy - 4]], '#ffc040'); g.P([[11, cy - 4], [13, cy - 8], [15, cy - 4]], '#fff2a0');
    // Coal body with ember cracks.
    ball(g, 13, cy + 1, 7, 6.5, coal, false);
    g.L(8, cy + 3, 11, cy + 5, '#ff8a3a'); g.L(16, cy + 4, 18, cy + 2, '#ff8a3a'); g.R(12, cy + 6, 2, 1, '#ffc040');
    // Horns.
    g.P([[8, cy - 4], [6, cy - 8], [10, cy - 5]], '#d8c8b0'); g.P([[18, cy - 4], [20, cy - 8], [16, cy - 5]], '#b8a890');
    // Glowing face.
    eyes(g, 11, 15, cy - 1, atk, 2, '#ffd040');
    if (atk) { g.R(12, cy + 3, 4, 2, '#ff6a2a'); g.R(13, cy + 3, 2, 1, '#fff2a0'); } else { g.R(12, cy + 3, 3, 1, '#ff8a3a'); }
    blush(g, 9, cy + 2); blush(g, 16, cy + 2);
    // Fireball in hand on attack.
    if (atk) { glow(g, 22, cy + 3, 6, 6, '255,200,80', 3, .2); ball(g, 22, cy + 3, 3.5, 3.5, ['#ff6a2a', '#ffb040', '#fff2a0'], false); g.R(21, cy + 2, 1, 1, WH); g.P([[19, cy + 1], [15, cy - 1], [19, cy + 5]], '#ff9a3c'); }
    else { g.R(18, cy + 3, 2, 2, coal[1]); g.R(18, cy + 2, 1, 1, '#ffb040'); }
    sparks(g, f === 1 ? [[4, cy - 9], [21, cy - 12], [23, cy + 8]] : [[5, cy - 11], [22, cy - 10], [3, cy + 6]]);
  },

  sandWyrm(g, f) {
    const atk = f === 2, s = f === 1 ? 1 : 0, hide = ['#9a4a2a', '#c8703e', '#eca468'], belly = ['#d8a060', '#f0c888'];
    // Sand mound.
    g.E(30, 51, 29, 5, '#c8904e'); g.E(29, 50, 26, 3.6, '#e0b070'); g.E(24, 49, 14, 2, '#f0cc90');
    for (const [x, y] of [[8, 52], [15, 49], [44, 50], [51, 52], [36, 53]]) g.R(x, y, 2, 1, '#b07a40');
    // Segmented body rising from the sand.
    const head = atk ? [42, 18] : [32, 14 + s], base = [24, 50];
    const N = 9;
    for (let k = 0; k < N; k++) {
      const t = k / (N - 1), x = lerp(base[0], head[0], t) + Math.sin(t * 3.2) * (atk ? -7 : -5) * (1 - t) + (k === 0 ? 0 : s * Math.sin(t * 5)), y = lerp(base[1], head[1] + 10, t), r = lerp(10, 8, t);
      ball(g, x, y, r, r * .62, hide, false); g.E(x + r * .2, y + r * .2, r * .55, r * .3, belly[0]); g.R(x - r + 1, y + r * .45, r * 2 - 2, 1, hide[0]);
      if (k % 2) for (const dx of [-r * .6, 0, r * .6]) g.P([[x + dx - 1, y - r * .5], [x + dx, y - r * .5 - 3], [x + dx + 1, y - r * .5]], '#f0c060');
    }
    // Head: a round maw ringed with teeth and frilled plates.
    const [hx, hy] = head;
    for (const [dx, dy, len] of [[-9, -6, 6], [-4, -11, 6], [3, -12, 6], [9, -8, 6], [-11, 1, 5]]) g.P([[hx + dx - 2, hy + dy + 3], [hx + dx + Math.sign(dx || 1) * 1, hy + dy - len + 3], [hx + dx + 2, hy + dy + 3]], '#e8a040');
    ball(g, hx, hy, 12, 11, hide, false);
    for (let k = 0; k < 4; k++) g.L(hx - 9 + k * 3, hy - 6 - (k === 1 || k === 2 ? 2 : 0), hx - 8 + k * 3, hy + 6, hide[0]);
    // Little eyes up top.
    for (const x of [hx - 4, hx + 1]) { g.E(x, hy - 6, 1.6, 1.6, '#2a1a14'); g.R(x, hy - 7, 1, 1, '#ffd860'); }
    if (atk) { g.R(hx - 7, hy - 9, 4, 1, '#5a2a1a'); g.R(hx, hy - 9, 4, 1, '#5a2a1a'); }
    // Maw, facing forward-right.
    const mx = hx + 5, my = hy + 2, mr = atk ? 7 : 4.5;
    g.E(mx, my, mr + 1.5, mr + 1, '#7a2e22'); g.E(mx, my, mr, mr * .85, '#4a1a20'); g.E(mx + 1, my + 1, mr * .5, mr * .4, '#2a0e14');
    if (atk) g.E(mx + 1, my + 2, mr * .45, mr * .3, '#c04a5a');
    const teeth = atk ? 10 : 7;
    for (let k = 0; k < teeth; k++) { const a = k / teeth * Math.PI * 2, tx = mx + Math.cos(a) * mr * .85, ty = my + Math.sin(a) * mr * .72; g.R(tx, ty, 1, 1, '#fff4dc'); }
    if (atk) sparks(g, [[56, 10], [54, 26], [58, 18, 2], [6, 44], [52, 44]], ['#e0b070', '#f0cc90', '#c8904e']);
  },

  // ---- Sleeping Dragon Peak ----
  stoneDrake(g, f) {
    const atk = f === 2, b = f === 1 ? 1 : 0, slate = ['#4a5260', '#6e7888', '#9aa4b4'], gold = '#e8c060';
    const L = atk ? [[8, 0, 1], [11, 0], [19, 0, 1], [22, 0]] : f ? [[9, 1, 1], [12, 0], [19, 1, 1], [22, 0]] : [[9, 0, 1], [12, 1], [19, 0, 1], [22, 1]];
    legs4(g, L, 21, 7, 3, slate, '#2f3440');
    // Tail with a gold spade.
    g.P([[8, 17 + b], [1, 13 + b], [0, 15 + b], [7, 21]], slate[0]); g.P([[1, 11 + b], [-1, 14 + b], [3, 15 + b]], gold);
    // Folded wing.
    g.P([[12, 12 + b], [6, 3 + b - (atk ? 3 : 0)], [11, 5 + b - (atk ? 3 : 0)], [17, 11 + b]], '#5a4a6a'); g.P([[12, 12 + b], [8, 5 + b - (atk ? 3 : 0)], [14, 11 + b]], '#7a6a8e'); g.L(12, 12 + b, 6, 3 + b - (atk ? 3 : 0), '#3a3240');
    ball(g, 15, 17 + b, 9, 6, slate, false);
    // Lava belly plates.
    band(g, 16, 19 + b, 7, 3, 11, 22, '#e8955a', 0); for (let x = 12; x < 22; x += 3) g.R(x, 18 + b, 1, 4, '#c86a3a');
    // Back spikes.
    for (const x of [10, 13, 16]) g.P([[x, 12 + b], [x + 1, 9 + b], [x + 2, 12 + b]], '#3a3f4a');
    // Head.
    const hx = atk ? 26 : 25, hy = (atk ? 13 : 11) + b;
    ball(g, hx, hy, 5.5, 5, slate, false);
    g.P([[hx + 2, hy - 1], [hx + 8, hy], [hx + 8, hy + 3], [hx + 2, hy + 4]], slate[1]); g.R(hx + 7, hy, 1, 1, INK);
    g.P([[hx - 3, hy - 3], [hx - 7, hy - 8], [hx - 1, hy - 4]], gold); g.P([[hx, hy - 4], [hx - 2, hy - 9], [hx + 2, hy - 4]], '#f8dc90');
    eyes(g, hx, hx, hy - 2, atk, 2, '#ffb040'); g.R(hx + 1, hy - 1, 1, 1, INK);
    blush(g, hx - 1, hy + 2);
    if (atk) { g.R(hx + 3, hy + 3, 5, 2, MAW); g.R(hx + 4, hy + 3, 1, 1, WH); glow(g, hx + 11, hy + 3, 5, 4, '255,170,80', 2, .22); g.P([[hx + 7, hy + 2], [hx + 12, hy], [hx + 11, hy + 3], [hx + 12, hy + 6], [hx + 7, hy + 5]], '#ff8a3a'); g.P([[hx + 7, hy + 3], [hx + 10, hy + 2], [hx + 10, hy + 4]], '#ffe080'); }
    else g.R(hx + 3, hy + 3, 5, 1, slate[0]);
  },

  magmaTortoise(g, f) {
    const atk = f === 2, b = f === 1 ? 1 : 0, rock = ['#34303c', '#524a5a', '#766c7e'], lava = ['#e8582a', '#ff9a3c', '#ffe08a'];
    // Stumpy legs.
    const legC = ['#5a4a44', '#7a6a62', '#9a8a80'];
    for (const [x, d] of [[7, f === 1 ? 1 : 0], [14, f === 1 ? 0 : 1], [26, f === 1 ? 1 : 0], [32, f === 1 ? 0 : 1]]) { block(g, x, 26 + d, 5, 8 - d, legC); g.R(x, 32, 5, 2, '#3f3430'); g.R(x + 1, 33, 1, 1, '#d8c8b0'); g.R(x + 3, 33, 1, 1, '#d8c8b0'); }
    // Head.
    const hx = atk ? 39 : 37, hy = (atk ? 21 : 23) + b;
    if (atk) g.R(31, hy - 1, 6, 5, legC[1]);
    ball(g, hx, hy, 6, 5, legC, false);
    g.P([[hx + 4, hy - 1], [hx + 7, hy + 1], [hx + 4, hy + 2]], '#d8a040');
    eyes(g, hx, hx, hy - 2, atk, 2, '#ffb040'); g.R(hx + 1, hy - 1, 1, 1, INK); blush(g, hx - 2, hy + 1);
    if (atk) { g.R(hx + 2, hy + 2, 4, 2, MAW); g.R(hx + 3, hy + 3, 2, 1, '#ff9a3c'); }
    // Volcanic shell.
    g.E(20, 26, 18, 4, '#3f3430'); g.R(3, 25, 34, 3, '#6a5a52');
    ball(g, 20, 19 - b / 2, 16, 11, rock, false);
    // Hex plates and lava seams.
    for (const [x0, y0, x1, y1] of [[8, 20, 14, 14], [14, 14, 22, 12], [22, 12, 29, 16], [29, 16, 32, 23], [14, 14, 16, 25], [22, 12, 24, 25], [8, 20, 12, 26]]) g.L(x0, y0 - b / 2, x1, y1 - b / 2, lava[0]);
    for (const [x, y] of [[14, 14], [22, 12], [29, 16]]) g.R(x, y - b / 2, 1, 1, lava[2]);
    glow(g, 20, 9, 9, 6, '255,150,70', 3, atk ? .2 : .12);
    // Crater vent with bubbling lava and smoke.
    g.E(20, 9 - b / 2, 5, 2.5, '#1e1a20'); g.E(20, 9 - b / 2, 3.5, 1.5, lava[1]); g.R(19, 8 - b / 2, 2, 1, lava[2]);
    if (atk) { for (const [x, y, r] of [[18, 3, 2], [23, 1, 1.5], [15, 0, 1.5], [26, 4, 1]]) ball(g, x, y, r, r, lava, false); }
    else { g.E(21 + b, 4, 2, 1.5, 'rgba(200,190,200,.55)'); g.E(23 + b, 1.5, 1.5, 1, 'rgba(220,210,220,.45)'); }
    g.R(10, 14 - b / 2, 3, 1, '#7a7080');
  },

  stormRoc(g, f) {
    const atk = f === 2, cy = 15 + (f === 1 ? 1 : 0), wing = atk ? -7 : f ? 5 : 0, plume = ['#2f3e58', '#4a6488', '#7896bc'];
    if (atk) glow(g, 22, cy - 6, 20, 12, '255,240,140', 2, .1);
    for (const dir of [-1, 1]) {
      const cx = 22, k = dir < 0 ? plume : ['#26324a', '#3e5476', '#5e7ca2'];
      g.P([[cx + dir * 4, cy - 2], [cx + dir * 12, cy - 11 + wing], [cx + dir * 21, cy - 9 + wing], [cx + dir * 23, cy - 5 + wing], [cx + dir * 20, cy - 1 + wing], [cx + dir * 17, cy + 3 + wing / 2], [cx + dir * 12, cy + 4], [cx + dir * 5, cy + 4]], k[1]);
      g.P([[cx + dir * 5, cy - 1], [cx + dir * 12, cy - 9 + wing], [cx + dir * 17, cy - 8 + wing], [cx + dir * 8, cy + 1]], k[2]);
      for (let j = 0; j < 4; j++) g.L(cx + dir * (13 + j * 3), cy - 6 + wing + j, cx + dir * (12 + j * 2), cy + 2 + wing / 2, k[0]);
      g.R(cx + dir * 21, cy - 8 + wing, 1, 2, '#f4e070');
    }
    // Tail fan.
    g.P([[17, cy + 4], [10, cy + 12], [16, cy + 10], [18, cy + 14], [21, cy + 8]], plume[0]); g.R(12, cy + 10, 2, 1, '#f4e070');
    ball(g, 22, cy + 3, 7, 6.5, plume, false);
    g.E(24, cy + 5, 3.5, 3.5, '#c8d4e0'); g.E(23.5, cy + 4.5, 2.5, 2.5, '#eef2f6'); g.R(23, cy + 6, 2, 1, '#aab8c8'); g.R(25, cy + 3, 1, 1, '#aab8c8');
    // Talons.
    const ty = atk ? cy + 9 : cy + 10;
    for (const x of [20, 25]) { g.R(x + (atk ? 2 : 0), ty, 1, 3, '#e8b040'); g.R(x - 1 + (atk ? 3 : 0), ty + 3, 3, 1, '#e8b040'); }
    // Head with a lightning crest.
    const hx = atk ? 30 : 29, hy = cy - 6;
    g.P([[hx - 3, hy - 3], [hx - 6, hy - 9], [hx - 3, hy - 7], [hx - 5, hy - 13], [hx, hy - 5]], '#f4d040'); g.P([[hx - 3, hy - 4], [hx - 4, hy - 8], [hx - 2, hy - 5]], '#fff4a0');
    ball(g, hx, hy, 5, 4.5, plume, false);
    g.E(hx + 1, hy + 2, 3, 2, '#e8eef4');
    eyes(g, hx + 1, hx + 1, hy - 2, atk, 2, '#ffe060'); g.R(hx + 2, hy - 1, 1, 1, INK);
    if (atk) { g.P([[hx + 4, hy - 1], [hx + 9, hy], [hx + 6, hy + 1], [hx + 4, hy + 1]], '#f0c040'); g.P([[hx + 4, hy + 2], [hx + 7, hy + 3], [hx + 4, hy + 3]], '#c89030'); }
    else { g.P([[hx + 4, hy - 1], [hx + 8, hy], [hx + 7, hy + 2], [hx + 4, hy + 2]], '#f0c040'); g.R(hx + 7, hy + 2, 1, 1, '#c89030'); }
    // Static crackle.
    const bolt = (x, y) => { g.L(x, y, x + 2, y + 2, '#fff4a0'); g.L(x + 2, y + 2, x, y + 4, '#fff4a0'); g.L(x, y + 4, x + 2, y + 6, '#ffe060'); };
    if (atk) { bolt(3, cy - 16); bolt(40, cy - 15); bolt(36, cy + 8); }
    else if (f === 1) bolt(42, cy - 2); else bolt(1, cy - 2);
  },

  wyvernMatriarch(g, f) {
    const atk = f === 2, cy = 26 + (f === 1 ? 1 : 0), wing = atk ? -6 : f ? 5 : 0;
    const hide = ['#3a3048', '#5a4a6e', '#806c96'], mem = ['#4a2e44', '#7a4660', '#a8667e'], gold = ['#b8862e', '#e8c060', '#fff0b0'];
    // Far wing.
    g.P([[36, cy - 4], [46, cy - 18 + wing], [60, cy - 24 + wing], [69, cy - 20 + wing], [64, cy - 12 + wing], [60, cy - 4 + wing / 2], [54, cy + 2], [44, cy + 2]], mem[0]);
    g.L(36, cy - 4, 60, cy - 24 + wing, hide[0], 2); g.L(60, cy - 24 + wing, 69, cy - 20 + wing, hide[0]);
    for (const [x, y] of [[64, cy - 12 + wing], [60, cy - 4 + wing / 2], [54, cy + 2]]) g.L(60, cy - 24 + wing, x, y, hide[0]);
    // Tail curling below.
    for (let k = 0; k < 12; k++) { const t = k / 11, x = 26 - t * 18 + Math.sin(t * 4) * 3, y = cy + 6 + t * 18, r = 4 - t * 2.6; ball(g, x, y, r + 1, r, hide, false); }
    g.P([[6, cy + 22], [2, cy + 27], [9, cy + 27], [11, cy + 23]], gold[1]); g.R(5, cy + 25, 2, 1, gold[2]);
    // Body.
    ball(g, 32, cy + 2, 12, 9, hide, false);
    band(g, 34, cy + 5, 8, 4.5, 27, 42, '#e0c49a', 0); for (let x = 29; x < 41; x += 3) g.R(x, cy + 3, 1, 5, '#c4a478');
    for (const x of [22, 26, 30]) g.P([[x, cy - 6], [x + 2, cy - 10], [x + 3, cy - 5]], gold[0]);
    // Hind legs with talons.
    for (const [x, d] of [[27, 0], [36, atk ? -2 : 1]]) { g.R(x, cy + 9 + d, 4, 7, hide[0]); g.R(x - 1, cy + 15 + d, 6, 2, hide[1]); for (let k = 0; k < 3; k++) g.R(x - 1 + k * 2, cy + 17 + d, 1, 2, gold[2]); }
    // Neck and crowned head.
    const hx = atk ? 56 : 53, hy = atk ? cy - 12 : cy - 14;
    g.P([[38, cy - 4], [hx - 6, hy + 2], [hx - 2, hy + 6], [44, cy + 2]], hide[1]); g.P([[39, cy - 3], [hx - 5, hy + 3], [43, cy]], hide[2]);
    for (let k = 0; k < 3; k++) g.R(lerp(42, hx - 4, k / 3), lerp(cy, hy + 6, k / 3), 3, 1, '#e0c49a');
    ball(g, hx, hy, 7, 6, hide, false);
    g.P([[hx + 3, hy - 2], [hx + 13, hy + 1], [hx + 12, hy + 4], [hx + 3, hy + 5]], hide[1]); g.R(hx + 11, hy + 1, 1, 1, INK);
    if (atk) { g.P([[hx + 3, hy + 4], [hx + 13, hy + 6], [hx + 11, hy + 9], [hx + 3, hy + 7]], hide[0]); g.R(hx + 4, hy + 4, 8, 2, MAW); for (let x = hx + 4; x < hx + 12; x += 2) g.R(x, hy + 4, 1, 1, WH); }
    else g.R(hx + 4, hy + 4, 8, 1, hide[0]);
    // Golden crown of horns.
    g.P([[hx - 4, hy - 3], [hx - 12, hy - 10], [hx - 2, hy - 6]], gold[1]); g.P([[hx - 1, hy - 5], [hx - 6, hy - 14], [hx + 2, hy - 6]], gold[1]); g.P([[hx + 2, hy - 5], [hx + 2, hy - 12], [hx + 5, hy - 5]], gold[0]);
    g.L(hx - 5, hy - 10, hx - 3, hy - 6, gold[2]); g.R(hx, hy - 6, 2, 2, '#c8506a');
    eyes(g, hx + 2, hx + 2, hy - 2, atk, 2, '#ffd860'); g.R(hx + 3, hy - 1, 1, 1, INK);
    // Near wing (arm-wing), in front.
    g.P([[30, cy - 3], [20, cy - 16 + wing], [6, cy - 22 + wing], [0, cy - 16 + wing], [5, cy - 9 + wing], [8, cy - 1 + wing / 2], [16, cy + 4], [26, cy + 4]], mem[1]);
    g.P([[29, cy - 2], [20, cy - 14 + wing], [10, cy - 18 + wing], [14, cy - 10 + wing], [24, cy + 1]], mem[2]);
    g.L(30, cy - 3, 6, cy - 22 + wing, hide[0], 2); g.L(6, cy - 22 + wing, 0, cy - 16 + wing, hide[0]);
    for (const [x, y] of [[5, cy - 9 + wing], [8, cy - 1 + wing / 2], [16, cy + 4]]) g.L(6, cy - 22 + wing, x, y, hide[0]);
    g.R(5, cy - 24 + wing, 2, 2, gold[1]);
    if (atk) sparks(g, [[66, cy - 4], [68, cy - 14], [64, cy - 20], [2, cy - 28]], [gold[2], gold[1], WH]);
  },

  emberDragon(g, f) {
    const atk = f === 2, br = f === 1 ? 1 : 0;
    const hide = ['#5a1e22', '#8a2f2e', '#b8483c', '#d8684a'], obs = ['#1e1a22', '#34303a', '#4e4856'], gold = ['#a87a2a', '#e0b050', '#fff0b0'];
    const mem = ['#4a1a20', '#7a2a2c', '#a8443a', '#c45a44'], lava = ['#e8582a', '#ff9a3c', '#ffe08a'];
    const by = 62, wing = atk ? -6 : br ? -2 : 0, H3 = hide.slice(0, 3);
    const bone = (x0, y0, x1, y1, wd = 2) => g.L(x0, y0, x1, y1, hide[0], wd);
    // Far wing (behind the body), darker.
    const fw = [[46, by - 14], [54, by - 40 + wing], [66, by - 52 + wing], [76, by - 50 + wing], [74, by - 40 + wing], [70, by - 30 + wing / 2], [62, by - 20], [54, by - 12]];
    g.P(fw, mem[0]); bone(46, by - 14, 66, by - 52 + wing); bone(66, by - 52 + wing, 76, by - 50 + wing);
    for (const [x, y] of [[74, by - 40 + wing], [70, by - 30 + wing / 2], [62, by - 20]]) g.L(66, by - 52 + wing, x, y, hide[0]);
    g.P([[65, by - 55 + wing], [67, by - 59 + wing], [68, by - 53 + wing]], gold[1]);
    // Far legs.
    block(g, 27, by + 10, 9, 16, [obs[0], hide[0], hide[1]]); block(g, 60, by + 12, 8, 14, [obs[0], hide[0], hide[1]]);
    g.R(26, by + 24, 11, 3, obs[1]); g.R(59, by + 24, 10, 3, obs[1]);
    // Tail sweeping round on the ground with an obsidian blade tip.
    for (let k = 0; k < 16; k++) { const t = k / 15, x = 30 - t * 24 + Math.sin(t * 3) * 4, y = by + 6 + t * 18 - Math.sin(t * Math.PI) * 4, r = 8 - t * 5.5; ball(g, x, y, r + 1, r, H3, false); g.R(x - r * .3, y + r * .5, r * 1.2, 1, gold[0]); if (k % 3 === 1) g.P([[x - 1, y - r], [x + 1, y - r - 4], [x + 2, y - r]], obs[1]); }
    g.P([[2, by + 20], [0, by + 28], [6, by + 26], [10, by + 22]], obs[1]); g.P([[3, by + 22], [2, by + 26], [6, by + 24]], obs[2]);
    // Body.
    ball(g, 48, by, 27, 18, H3, false);
    g.E(40, by - 9, 13, 5, hide[3]); g.R(32, by - 12, 4, 1, '#f08a68');
    for (const [x, y] of [[28, by - 2], [36, by + 4], [44, by - 4], [26, by + 8], [52, by + 2]]) { g.R(x, y, 3, 1, hide[0]); g.R(x, y - 1, 2, 1, hide[3]); }
    g.E(50, by + 14, 20, 3.5, hide[0]);
    // Back spines.
    for (let k = 0; k < 7; k++) { const x = 26 + k * 6, y = by - 15 - Math.sin(k / 6 * Math.PI) * 4; g.P([[x - 2, y + 3], [x + 1, y - 6], [x + 3, y + 3]], obs[1]); g.P([[x - 1, y + 2], [x + 1, y - 4], [x + 1, y + 2]], obs[2]); }
    // Lava cracks on the flank.
    g.L(30, by + 2, 36, by + 6, lava[0]); g.L(36, by + 6, 34, by + 11, lava[0]); g.L(44, by + 8, 50, by + 12, lava[0]); g.R(36, by + 6, 1, 1, lava[2]); g.R(49, by + 11, 1, 1, lava[1]);
    // Neck (a tapered sweep up to the head) with gold throat plates.
    const hx = atk ? 82 : 85, hy = atk ? 40 : 27 + br;
    g.P([[56, by - 14], [62, hy + 18], [hx - 7, hy], [hx + 3, hy + 5], [hx - 2, hy + 16], [78, by - 4], [70, by + 2]], hide[1]);
    g.P([[58, by - 14], [63, hy + 18], [hx - 6, hy + 1], [hx - 4, hy + 4], [66, hy + 19], [62, by - 12]], hide[2]);
    g.P([[hx + 2, hy + 6], [hx - 2, hy + 16], [78, by - 4], [74, by - 2], [hx - 5, hy + 15], [hx - 2, hy + 6]], gold[1]);
    for (let k = 1; k < 6; k++) { const t = k / 6; g.L(lerp(hx - 2, 74, t), lerp(hy + 7, by - 3, t), lerp(hx + 2, 78, t), lerp(hy + 6, by - 4, t), gold[0]); }
    for (let k = 0; k < 4; k++) { const t = (k + .5) / 4, x = lerp(58, hx - 7, t), y = lerp(by - 15, hy, t); g.P([[x - 2, y + 2], [x - 4, y - 3], [x + 2, y]], obs[1]); }
    // Chest furnace glowing through the scales.
    const ga = atk ? .22 : br ? .17 : .13, cx = 68, cy = by + 2;
    glow(g, cx, cy, 15 + br * 2, 14 + br * 2, '255,160,70', 3, ga);
    g.E(cx, cy, 7 + br, 7 + br, lava[0]); g.E(cx - .5, cy - .5, 5 + br, 5 + br, lava[1]); g.E(cx - 1, cy - 1, 2.5 + br, 2.5 + br, lava[2]); g.R(cx - 3, cy - 4, 1, 2, WH);
    for (const [x0, y0, x1, y1] of [[cx - 7, cy, cx - 12, cy + 4], [cx + 2, cy + 6, cx + 3, cy + 11], [cx - 4, cy - 6, cx - 8, cy - 10]]) g.L(x0, y0, x1, y1, lava[1]);
    // Near hind leg (big haunch) and front leg, each with gold claws.
    ball(g, 34, by + 6, 10, 9, H3, false);
    block(g, 31, by + 13, 10, 13, H3); g.R(29, by + 23, 14, 4, hide[0]); g.R(29, by + 23, 14, 1, hide[2]); for (let k = 0; k < 4; k++) g.R(30 + k * 4, by + 26, 2, 2, gold[2]);
    const fx = atk ? 74 : 71;
    ball(g, fx + 4, by + 9, 6, 6, H3, false);
    block(g, fx, by + 12, 9, 14, H3); g.R(fx - 1, by + 23, 12, 4, hide[0]); g.R(fx - 1, by + 23, 12, 1, hide[2]); for (let k = 0; k < 3; k++) g.R(fx + k * 4, by + 26, 2, 2, gold[2]);
    // Far horn, then the head and the near horn.
    g.P([[hx - 1, hy - 6], [hx + 2, hy - 9], [hx - 3, hy - 16], [hx - 10, hy - 21], [hx - 7, hy - 15], [hx - 3, hy - 10]], gold[0]);
    ball(g, hx, hy, 9.5, 8, H3, false);
    g.P([[hx + 3, hy - 6], [hx + 17, hy - 3], [hx + 19, hy + 1], [hx + 4, hy + 3]], hide[1]); g.P([[hx + 3, hy - 6], [hx + 16, hy - 3], [hx + 4, hy - 3]], hide[2]);
    g.R(hx + 15, hy - 3, 2, 1, obs[0]); g.R(hx + 10, hy - 5, 4, 1, hide[3]);
    // Jaw.
    if (atk) {
      g.P([[hx + 1, hy + 3], [hx + 15, hy + 10], [hx + 13, hy + 13], [hx - 1, hy + 8]], hide[0]);
      g.P([[hx + 4, hy + 2], [hx + 18, hy + 1], [hx + 15, hy + 9], [hx + 3, hy + 5]], '#3a0e14');
      for (let x = hx + 6; x < hx + 18; x += 3) { g.R(x, hy + 2, 1, 2, WH); g.R(x - 1, hy + 7 + (x - hx) / 6, 1, 1, WH); }
      // Fire breath roaring out of the maw.
      const mx = hx + 15, my = hy + 5;
      glow(g, mx + 6, my, 12, 10, '255,180,80', 3, .22);
      g.P([[mx - 2, my - 3], [mx + 6, my - 8], [mx + 9, my - 5], [110, my - 9], [106, my - 1], [110, my + 4], [104, my + 7], [108, my + 12], [mx + 6, my + 8], [mx - 2, my + 3]], lava[0]);
      g.P([[mx - 1, my - 2], [mx + 6, my - 5], [104, my - 5], [102, my], [105, my + 5], [mx + 6, my + 5], [mx - 1, my + 2]], lava[1]);
      g.P([[mx, my - 1], [mx + 8, my - 2], [mx + 6, my], [mx + 9, my + 2], [mx, my + 1]], lava[2]);
    } else {
      g.P([[hx + 2, hy + 3], [hx + 17, hy + 2], [hx + 15, hy + 6], [hx + 1, hy + 6]], hide[0]); g.R(hx + 5, hy + 3, 12, 1, '#3a0e14');
      for (let x = hx + 7; x < hx + 17; x += 3) g.R(x, hy + 4, 1, 1, WH);
      g.E(hx + 19, hy - 5 - br, 1.5, 1, 'rgba(200,190,190,.55)'); g.E(hx + 21, hy - 8 - br, 1.2, 1, 'rgba(220,210,210,.4)');
    }
    // Brow ridge and a glowing eye.
    g.P([[hx - 2, hy - 7], [hx + 9, hy - 5], [hx + 8, hy - 3], [hx - 1, hy - 4]], obs[1]); g.R(hx, hy - 6, 6, 1, obs[2]);
    glow(g, hx + 4, hy - 2, 5, 4, '255,220,100', 2, .22);
    g.R(hx + 1, hy - 3, 5, 3, '#2a0e10'); g.R(hx + 1, hy - 3, 5, 2, atk ? '#fff4a0' : '#ffd040'); g.R(hx + 4, hy - 3, 1, 3, INK);
    // Near horn sweeping back, with a pale highlight.
    g.P([[hx - 5, hy - 4], [hx - 2, hy - 8], [hx - 9, hy - 13], [hx - 17, hy - 15], [hx - 23, hy - 12], [hx - 16, hy - 12], [hx - 9, hy - 9]], gold[1]);
    g.L(hx - 3, hy - 8, hx - 16, hy - 14, gold[2]); g.L(hx - 8, hy - 9, hx - 16, hy - 12, gold[0]);
    // Cheek frills.
    g.P([[hx - 7, hy + 1], [hx - 15, hy + 1], [hx - 8, hy + 5]], obs[1]); g.P([[hx - 6, hy + 4], [hx - 12, hy + 9], [hx - 4, hy + 7]], obs[2]);
    // Near wing, half spread over the back, with a scalloped trailing edge.
    const W = (x, y) => [x, y + wing * (1 - (y - (by - 60)) / 60)];
    const sh = [50, by - 12], el = W(42, by - 36), wr = W(32, by - 52), tips = [W(22, by - 56), W(10, by - 46), W(6, by - 30), W(14, by - 18), W(28, by - 10)];
    const edge = [sh, el, wr, tips[0]];
    for (let k = 1; k < tips.length; k++) { const a = tips[k - 1], b = tips[k]; edge.push([(a[0] + b[0]) / 2 + 3, (a[1] + b[1]) / 2 + 2], b); }
    edge.push([40, by - 6]);
    g.P(edge, mem[1]);
    g.P([sh, el, wr, [tips[1][0] + 6, tips[1][1] + 4], [tips[2][0] + 8, tips[2][1] + 2], [tips[3][0] + 8, tips[3][1] - 2], [34, by - 10]], mem[2]);
    g.P([sh, el, [wr[0] + 2, wr[1] + 6], [tips[2][0] + 14, tips[2][1]], [38, by - 12]], mem[3]);
    bone(sh[0], sh[1], el[0], el[1], 3); bone(el[0], el[1], wr[0], wr[1], 3); bone(wr[0], wr[1], tips[0][0], tips[0][1], 2);
    for (const t of tips.slice(1)) bone(wr[0], wr[1], t[0], t[1], 2);
    g.R(el[0] - 1, el[1] - 1, 3, 3, hide[2]); g.P([[wr[0] - 1, wr[1]], [wr[0] + 1, wr[1] - 5], [wr[0] + 3, wr[1]]], gold[1]); g.R(wr[0] + 1, wr[1] - 3, 1, 1, gold[2]);
    g.E(49, by - 11, 4, 3.5, hide[1]); g.R(47, by - 13, 2, 1, hide[3]);
    // Drifting embers.
    const emb = atk ? [[80, 10, 2], [96, 22], [60, 6], [72, 2, 2], [104, 30], [50, 18], [88, 6]] : br ? [[74, 12, 2], [82, 4], [58, 22], [96, 12], [64, 4], [52, 28]] : [[76, 16, 2], [84, 7], [60, 26], [98, 16], [66, 8], [54, 32]];
    for (const [x, y, s = 1] of emb) glow(g, x, y, s + 1.5, s + 1.5, '255,170,80', 1, .3);
    sparks(g, emb, [lava[1], lava[2], lava[0]]);
  },
};

/** Draw outlines around every opaque pixel so the creatures read against grass like the guild's characters. */
function outline(canvas, color) {
  const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height, img = c.getImageData(0, 0, w, h), d = img.data, out = new Uint8ClampedArray(d);
  const [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; if (d[i + 3] > 40) continue;
    let near = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h && d[(ny * w + nx) * 4 + 3] > 120) near = Math.max(near, d[(ny * w + nx) * 4 + 3]); }
    if (near) { out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = Math.min(255, near); }
  }
  img.data.set(out); c.putImageData(img, 0, 0);
}

const OUTLINE = { mistWisp: '#5f8a86', lanternGhost: '#5a5070', glowMoth: '#4f5a70' };
const cache = new Map();
/** One frame of a creature: { canvas, footX, footY, lift }. Frames 0/1 animate the idle bob, frame 2 is the attack pose; flash paints it white for a hit. */
export function makeMonster(id, frame = 0, flash = false) {
  const fr = frame === 2 ? 2 : ((Math.floor(Number(frame)) || 0) % 2 + 2) % 2;
  const sid = SPECIES[id] ? id : 'leafSlime', key = `${sid}:${fr}:${!!flash}`; if (cache.has(key)) return cache.get(key);
  const sp = SPECIES[sid], [w, h] = sp.size, A = Art();
  const canvas = document.createElement('canvas'); canvas.width = w + 2; canvas.height = h + 2;
  const c = canvas.getContext('2d', { willReadFrequently: true }); c.imageSmoothingEnabled = false; c.translate(1, 1);
  DRAW[sid](pen(c, A), fr);
  c.setTransform(1, 0, 0, 1, 0, 0);
  outline(canvas, OUTLINE[sid] || OUT);
  if (flash) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(0, 0, canvas.width, canvas.height); c.globalCompositeOperation = 'source-over'; }
  const out = { canvas, footX: Math.round(canvas.width / 2), footY: canvas.height - 1, lift: sp.lift || 0 };
  cache.set(key, out); return out;
}
/** The species a quest fights. */
export const questFoe = quest => QUEST_FOE[quest?.id] || 'leafSlime';
