/* The monster bestiary: every creature is original pixel art at native size, outlined like the guild's
   characters, with two animation frames and a white hit flash. Feet sit at the bottom centre of the canvas. */

const Art = () => window.ArtCore;
const OUT = '#4a3f3a';

/**
 * Species. kind: how it moves in the world (hop, walk, float, root).
 * biome: where it lives. size: canvas [w, h]. lift: float height above its shadow.
 */
export const SPECIES = {
  leafSlime: { name: 'สไลม์ใบไม้', kind: 'hop', biome: 'meadow', size: [22, 20] },
  waterSlime: { name: 'สไลม์น้ำค้าง', kind: 'hop', biome: 'water', size: [22, 20] },
  thornling: { name: 'พุ่มหนามจิ๋ว', kind: 'root', biome: 'meadow', size: [24, 22] },
  hornHare: { name: 'กระต่ายเขากิ่ง', kind: 'hop', biome: 'meadow', size: [24, 22] },
  fuzzBee: { name: 'ผึ้งปุยยักษ์', kind: 'float', biome: 'meadow', size: [22, 30], lift: 12 },
  fluffBoar: { name: 'หมูป่าขนฟู', kind: 'walk', biome: 'meadow', size: [34, 26] },
  pondFrog: { name: 'กบนักรบใบบัว', kind: 'hop', biome: 'water', size: [24, 24] },
  mushHopper: { name: 'เห็ดกระโดด', kind: 'hop', biome: 'forest', size: [20, 22] },
  acornBeetle: { name: 'ด้วงหมวกลูกโอ๊ก', kind: 'walk', biome: 'forest', size: [24, 18] },
  mossWolf: { name: 'หมาป่ามอส', kind: 'walk', biome: 'forest', size: [36, 28] },
  hollowKeeper: { name: 'ผู้เฝ้าโพรง', kind: 'walk', biome: 'forest', size: [30, 34] },
  pebbleCrab: { name: 'ปูกรวดหิน', kind: 'walk', biome: 'hills', size: [28, 18] },
  crystalBat: { name: 'ค้างคาวผลึก', kind: 'float', biome: 'hills', size: [32, 30], lift: 14 },
  marbleGolem: { name: 'โกเลมหินอ่อน', kind: 'walk', biome: 'hills', size: [36, 40] },
  bellGuardian: { name: 'ผู้พิทักษ์ระฆัง', kind: 'walk', biome: 'ruins', size: [42, 54] },
  mistWisp: { name: 'ภูตหมอก', kind: 'float', biome: 'mist', size: [26, 40], lift: 10 },
  lanternGhost: { name: 'ผีตะเกียง', kind: 'float', biome: 'mist', size: [24, 36], lift: 10 },
  glowMoth: { name: 'แมลงเม่าเรืองแสง', kind: 'float', biome: 'mist', size: [24, 30], lift: 14 },
  bindingRoots: { name: 'รากไม้พันธนาการ', kind: 'root', biome: 'mist', size: [38, 36] },
  heartGuardian: { name: 'ผู้พิทักษ์หัวใจป่า', kind: 'walk', biome: 'mist', size: [56, 60] },
};
/** Which creature each quest's fight is against. */
export const QUEST_FOE = { patrol: 'leafSlime', herbs: 'thornling', escort: 'fluffBoar', hollow: 'hollowKeeper', crystals: 'marbleGolem', ruins: 'bellGuardian', mistpath: 'mistWisp', rescue: 'bindingRoots', heart: 'heartGuardian' };

// ---- Drawing helpers ----
const eye = (A, c, x, y, h = 3, col = '#2f2a30') => { A.rect(c, x, y, 2, h, col); A.rect(c, x, y, 1, 1, '#ffffff'); };
const blush = (A, c, x, y) => A.rect(c, x, y, 3, 1, '#f0a0a0');

function slime(c, A, f, w, h, pal, sprout) {
  const cx = w / 2, squash = f ? 1 : 0, rx = 8 + squash * 1.5, ry = 7 - squash * 1.5, by = h - 1 - ry;
  A.ellipse(c, cx, by, rx, ry, pal[0]); A.rect(c, cx - rx, by, rx * 2, ry, pal[0]);
  A.ellipse(c, cx, by - 1, rx - 1, ry - 1, pal[1]); A.rect(c, cx - rx + 1, by - 1, rx * 2 - 2, ry, pal[1]);
  A.ellipse(c, cx - 2, by - 3, rx - 4, ry - 3, pal[2]); A.rect(c, cx - 5, by - ry + 2, 2, 2, '#ffffff'); A.rect(c, cx - 3, by - ry + 1, 1, 1, '#ffffff');
  A.rect(c, cx - rx + 1, h - 2, rx * 2 - 2, 1, pal[3]);
  eye(A, c, cx - 4, by - 1); eye(A, c, cx + 2, by - 1); blush(A, c, cx - 7, by + 2); blush(A, c, cx + 4, by + 2);
  if (sprout) { const top = by - ry; A.rect(c, cx, top - 3, 1, 3, '#5f8a4a'); A.poly(c, [[cx, top - 3], [cx - 5, top - 6], [cx - 2, top - 2]], '#6f9a52'); A.poly(c, [[cx + 1, top - 3], [cx + 6, top - 7], [cx + 3, top - 2]], '#86b066'); }
  else { A.rect(c, cx + 3, by - ry + 1, 2, 1, pal[2]); }
}

const DRAW = {
  leafSlime: (c, A, f) => slime(c, A, f, 22, 20, ['#5f9a62', '#8fc48a', '#b4e0a2', '#4f8152'], true),
  waterSlime: (c, A, f) => slime(c, A, f, 22, 20, ['#5f8fb0', '#8ec0de', '#c0e4f2', '#4f7898'], false),
  thornling(c, A, f) {
    const cx = 12, cy = 12;
    A.rect(c, cx - 5, 19, 3, 3, '#5a463f'); A.rect(c, cx + 2, 19, 3, 3, '#5a463f');
    A.ellipse(c, cx, cy, 9, 8, '#3f6a42'); A.ellipse(c, cx - 1, cy - 1, 7.5, 6.5, '#55864f'); A.ellipse(c, cx - 3, cy - 3, 4, 3, '#6f9e5f');
    const spikes = f ? [[2, 8], [5, 2], [12, 0], [19, 2], [22, 9], [21, 15], [3, 15]] : [[2, 10], [6, 1], [13, 1], [20, 3], [22, 11], [20, 16], [2, 14]];
    for (const [x, y] of spikes) { A.rect(c, x, y, 2, 2, '#d9c8a0'); A.rect(c, x, y, 1, 1, '#f4ead0'); }
    A.rect(c, cx - 5, cy - 1, 3, 3, '#e05a5a'); A.rect(c, cx + 2, cy - 1, 3, 3, '#e05a5a'); A.rect(c, cx - 5, cy - 1, 1, 1, '#ffd0d0'); A.rect(c, cx + 2, cy - 1, 1, 1, '#ffd0d0');
    A.line(c, cx - 6, cy - 3 + f, cx - 2, cy - 2, '#2f2a30'); A.line(c, cx + 6, cy - 3 + f, cx + 2, cy - 2, '#2f2a30');
    A.rect(c, cx - 2, cy + 4, 4, 1, '#2f2a30'); A.rect(c, cx + 5, cy - 6, 2, 2, '#c94a5a');
  },
  hornHare(c, A, f) {
    const up = f ? 0 : 1;
    A.ellipse(c, 11, 16 - up, 7, 5, '#efe6d6'); A.ellipse(c, 10, 15 - up, 5, 3.5, '#fffaf0'); A.rect(c, 4, 13 - up, 3, 3, '#fffaf0');
    A.rect(c, 7, 19, 4, 2, '#e4d8c4'); A.rect(c, 13, 19, 4, 2, '#e4d8c4');
    A.ellipse(c, 17, 10 - up, 5, 4.5, '#efe6d6'); A.ellipse(c, 16, 9 - up, 3.5, 3, '#fffaf0');
    A.rect(c, 13, 2 - up, 2, 6, '#efe6d6'); A.rect(c, 16, 1 - up, 2, 7, '#efe6d6'); A.rect(c, 16, 2 - up, 1, 5, '#f0b8b8');
    A.line(c, 14, 4 - up, 11, 0, '#9a7a5c'); A.line(c, 12, 2 - up, 10, 2 - up, '#9a7a5c'); A.line(c, 18, 3 - up, 21, 0, '#9a7a5c'); A.line(c, 20, 1 - up, 22, 2 - up, '#9a7a5c');
    eye(A, c, 18, 9 - up, 2); A.rect(c, 21, 11 - up, 1, 1, '#e08a8a'); blush(A, c, 16, 12 - up);
  },
  fuzzBee(c, A, f) {
    const y = 12;
    A.poly(c, f ? [[8, y - 5], [3, y - 12], [10, y - 9]] : [[8, y - 5], [1, y - 8], [9, y - 9]], '#e8f4f8'); A.poly(c, f ? [[13, y - 5], [18, y - 13], [11, y - 9]] : [[13, y - 5], [21, y - 9], [12, y - 9]], '#d8eef4');
    A.ellipse(c, 11, y, 7, 6, '#f4c850'); A.ellipse(c, 10, y - 1, 5.5, 4.5, '#fbdc78');
    A.rect(c, 6, y - 1, 10, 2, '#4f4038'); A.rect(c, 7, y + 3, 8, 1, '#4f4038'); A.rect(c, 4, y - 3, 2, 2, '#fff2b0');
    eye(A, c, 13, y - 4, 2); A.rect(c, 18, y + 1, 2, 1, '#4f4038'); A.line(c, 12, y - 6, 14, y - 9, '#4f4038'); A.rect(c, 14, y - 10, 2, 2, '#4f4038');
  },
  fluffBoar(c, A, f) {
    const legs = f ? [[7, 1], [11, 0], [21, 1], [25, 0]] : [[7, 0], [11, 1], [21, 0], [25, 1]];
    for (const [x, d] of legs) A.rect(c, x, 20 + d, 3, 6 - d, '#5a463f');
    A.ellipse(c, 16, 15, 13, 8, '#8a6446'); A.ellipse(c, 15, 13, 11, 6, '#a77a55');
    for (let k = 0; k < 7; k++) { const x = 5 + k * 3.4, y = 8 + (k % 2) * 2; A.rect(c, x, y, 3, 2, '#c49770'); A.rect(c, x + 1, y - 1, 1, 1, '#d9b08a'); }
    A.ellipse(c, 27, 15, 6, 5.5, '#a77a55'); A.rect(c, 30, 15, 4, 4, '#e8a090'); A.rect(c, 32, 16, 1, 1, '#8a4a40'); A.rect(c, 30, 18, 1, 2, '#f4ead0'); A.rect(c, 33, 18, 1, 2, '#f4ead0');
    A.poly(c, [[23, 9], [26, 4], [27, 10]], '#8a6446'); eye(A, c, 27, 12, 2); A.rect(c, 3, 12, 3, 2, '#8a6446');
  },
  pondFrog(c, A, f) {
    const up = f ? 0 : 2;
    A.ellipse(c, 12, 18 - up, 8, 5, '#6aa05a'); A.ellipse(c, 11, 17 - up, 6, 3.5, '#88bf72'); A.ellipse(c, 12, 20 - up, 5, 2, '#d8e8a8');
    A.rect(c, 3, 21, 5, 2, '#5a8a4a'); A.rect(c, 16, 21, 5, 2, '#5a8a4a');
    A.ellipse(c, 8, 12 - up, 3, 3, '#88bf72'); A.ellipse(c, 16, 12 - up, 3, 3, '#88bf72'); eye(A, c, 7, 11 - up, 2); eye(A, c, 15, 11 - up, 2);
    A.rect(c, 9, 16 - up, 6, 1, '#3f5a3a'); A.ellipse(c, 12, 8 - up, 7, 2.5, '#4f8a5a'); A.rect(c, 11, 4 - up, 2, 4, '#4f8a5a');
    A.line(c, 21, 19 - up, 23, 9 - up, '#9a7a5c'); A.rect(c, 20, 15 - up, 4, 1, '#9a7a5c');
  },
  mushHopper(c, A, f) {
    const up = f ? 0 : 1;
    A.rect(c, 6, 18, 3, 3, '#e4d8c4'); A.rect(c, 11, 18, 3, 3, '#e4d8c4');
    A.rect(c, 6, 11 - up, 8, 8, '#f4ead8'); A.rect(c, 6, 11 - up, 2, 8, '#fffaf0');
    eye(A, c, 7, 13 - up, 2); eye(A, c, 11, 13 - up, 2); blush(A, c, 6, 16 - up);
    A.ellipse(c, 10, 9 - up, 9, 5, '#c9504a'); A.ellipse(c, 9, 7 - up, 7, 3, '#e06a5a'); A.rect(c, 1, 10 - up, 18, 1, '#a8443e');
    for (const [x, y] of [[5, 6], [12, 5], [15, 8], [8, 9]]) A.rect(c, x, y - up, 2, 2, '#fff2e8');
  },
  acornBeetle(c, A, f) {
    const legs = f ? [5, 10, 15] : [6, 11, 16];
    for (const x of legs) { A.line(c, x, 14, x - 2, 17, '#3f3530'); A.line(c, x + 1, 14, x + 3, 17, '#3f3530'); }
    A.ellipse(c, 11, 11, 9, 5, '#a77a55'); A.ellipse(c, 10, 10, 7, 3.5, '#c49770');
    A.ellipse(c, 10, 7, 9, 4, '#6b4f3a'); for (let x = 3; x < 18; x += 3) A.rect(c, x, 5 + (x % 2), 2, 1, '#8a6a4a'); A.rect(c, 9, 2, 2, 2, '#5a463f');
    A.ellipse(c, 20, 11, 3.5, 3, '#3f3530'); eye(A, c, 20, 10, 2, '#f4e8a0'); A.line(c, 21, 8, 23, 5, '#3f3530');
  },
  mossWolf(c, A, f) {
    const legs = f ? [[8, 1], [12, 0], [24, 1], [28, 0]] : [[8, 0], [12, 1], [24, 0], [28, 1]];
    for (const [x, d] of legs) A.rect(c, x, 21 + d, 3, 7 - d, '#5f6a62');
    A.ellipse(c, 18, 17, 13, 6.5, '#7f8a82'); A.ellipse(c, 17, 15, 11, 4.5, '#9aa59c'); A.ellipse(c, 18, 20, 9, 2.5, '#d8dccc');
    A.poly(c, [[5, 14], [0, 8], [2, 16]], '#7f8a82'); A.rect(c, 0, 8, 2, 2, '#6f9a62');
    A.poly(c, [[20, 10], [26, 7], [30, 13], [26, 20], [21, 18]], '#9aa59c'); for (const [x, y, w] of [[19, 9, 6], [21, 12, 7], [20, 15, 6], [10, 11, 5], [14, 10, 4]]) { A.rect(c, x, y, w, 2, '#6f9a62'); A.rect(c, x + 1, y - 1, w - 3, 1, '#9cc488'); }
    A.ellipse(c, 30, 11, 5, 4, '#9aa59c'); A.rect(c, 33, 12, 3, 2, '#9aa59c'); A.rect(c, 35, 12, 1, 1, '#2f2a30');
    A.poly(c, [[27, 7], [28, 2], [30, 7]], '#7f8a82'); A.poly(c, [[30, 7], [32, 2], [33, 8]], '#7f8a82'); eye(A, c, 31, 9, 2, '#e8d070');
  },
  hollowKeeper(c, A, f) {
    A.rect(c, 10, 30, 4, 3, '#c9a050'); A.rect(c, 17, 30, 4, 3, '#c9a050');
    A.ellipse(c, 15, 21, 11, 11, '#7b5d45'); A.ellipse(c, 14, 20, 9, 9, '#94735a'); A.ellipse(c, 15, 25, 6, 5, '#c9a77f');
    for (let k = 0; k < 4; k++) A.rect(c, 12 + (k % 2) * 3, 22 + k * 2, 2, 1, '#a8865f');
    A.ellipse(c, 15, 10, 11, 5, '#6f9a62'); A.ellipse(c, 14, 9, 8, 3, '#86b076'); A.poly(c, [[5, 9], [3, 3], [9, 7]], '#7b5d45'); A.poly(c, [[25, 9], [27, 3], [21, 7]], '#7b5d45');
    const lid = f ? 2 : 0;
    for (const x of [10, 20]) { A.ellipse(c, x, 16, 4, 4, '#f4e8c0'); A.ellipse(c, x, 16, 3, 3, '#f0c040'); A.rect(c, x - 1, 15 + lid, 2, 2 - lid / 2, '#2f2a30'); if (lid) A.rect(c, x - 3, 13, 7, 2, '#94735a'); }
    A.poly(c, [[14, 19], [16, 19], [15, 22]], '#e8a54a');
    A.poly(c, [[4, 18], [0, 27], [6, 24]], '#6b4f3a'); A.poly(c, [[26, 18], [30, 27], [24, 24]], '#6b4f3a');
    A.line(c, 28, 24, 28, 27, '#3f3530'); A.rect(c, 26, 27, 5, 6, '#4f4540'); A.rect(c, 27, 28, 3, 4, f ? '#ffe7a8' : '#f4d48a');
  },
  pebbleCrab(c, A, f) {
    const legs = f ? [3, 7, 19, 23] : [4, 8, 18, 22];
    for (const x of legs) A.line(c, x + 1, 12, x, 17, '#b0705a');
    A.ellipse(c, 14, 11, 10, 6, '#c9805f'); A.ellipse(c, 14, 8, 9, 5, '#9a968c'); A.ellipse(c, 13, 7, 7, 3.5, '#b4b0a5'); A.rect(c, 10, 5, 3, 2, '#cbc7bc'); A.rect(c, 16, 9, 2, 1, '#7f9a6a');
    A.ellipse(c, 3, 8 - f, 3, 3, '#d98a6a'); A.rect(c, 1, 5 - f, 2, 2, '#d98a6a'); A.ellipse(c, 25, 8 - f, 3, 3, '#d98a6a'); A.rect(c, 26, 5 - f, 2, 2, '#d98a6a');
    A.rect(c, 11, 3, 1, 3, '#b0705a'); A.rect(c, 16, 3, 1, 3, '#b0705a'); eye(A, c, 10, 2, 2); eye(A, c, 16, 2, 2);
  },
  crystalBat(c, A, f) {
    const y = 12, wing = f ? -4 : 3;
    A.poly(c, [[12, y], [2, y - 6 + wing], [0, y + 2 + wing], [5, y + 1 + wing], [8, y + 5]], '#6a5a8a'); A.poly(c, [[20, y], [30, y - 6 + wing], [32, y + 2 + wing], [27, y + 1 + wing], [24, y + 5]], '#5a4a78');
    A.ellipse(c, 16, y + 1, 6, 6, '#7a6a9a'); A.ellipse(c, 15, y, 4, 4, '#9282b4');
    A.poly(c, [[11, y - 4], [10, y - 12], [14, y - 5]], '#c7bfe6'); A.poly(c, [[21, y - 4], [22, y - 12], [18, y - 5]], '#a598cf'); A.rect(c, 11, y - 10, 1, 4, '#f0ecff');
    eye(A, c, 13, y - 1, 2, '#f4e8a0'); eye(A, c, 17, y - 1, 2, '#f4e8a0'); A.rect(c, 14, y + 3, 1, 2, '#ffffff'); A.rect(c, 17, y + 3, 1, 2, '#ffffff');
  },
  marbleGolem(c, A, f) {
    const step = f ? 1 : 0;
    A.rect(c, 9, 33 + step, 7, 7 - step, '#a9a3b8'); A.rect(c, 20, 34 - step, 7, 6 + step, '#a9a3b8');
    A.rect(c, 6, 14, 24, 21, '#c9c4b8'); A.rect(c, 6, 14, 24, 3, '#e6e2d8'); A.rect(c, 26, 14, 4, 21, '#aaa498');
    A.line(c, 9, 18, 15, 30, '#b4afc4'); A.line(c, 22, 16, 18, 24, '#b4afc4');
    A.poly(c, [[18, 20], [22, 25], [18, 30], [14, 25]], '#b9a8e8'); A.poly(c, [[18, 20], [22, 25], [18, 25]], '#d8ccff'); A.rect(c, 17, 23, 1, 3, '#ffffff');
    A.rect(c, 0, 15 + step, 7, 14, '#bdb8ac'); A.rect(c, 0, 15 + step, 7, 2, '#e0dcd2'); A.rect(c, 29, 16 - step, 7, 14, '#aaa498'); A.rect(c, 29, 16 - step, 7, 2, '#cfcabe');
    A.rect(c, 0, 13 + step, 8, 3, '#7f9a6a'); A.rect(c, 28, 14 - step, 8, 3, '#6f8a5a');
    A.rect(c, 11, 3, 14, 12, '#d6d2c8'); A.rect(c, 11, 3, 14, 2, '#eeebe2'); A.rect(c, 22, 3, 3, 12, '#b4afa4');
    A.rect(c, 13, 8, 3, 2, '#f0c040'); A.rect(c, 20, 8, 3, 2, '#f0c040'); A.rect(c, 12, 1, 5, 2, '#7f9a6a');
  },
  bellGuardian(c, A, f) {
    const sw = f ? 1 : 0;
    A.poly(c, [[10, 24], [32, 24], [36, 52], [6, 52]], '#7a4a5a'); A.poly(c, [[10, 24], [20, 24], [16, 52], [6, 52]], '#945a6a');
    A.rect(c, 12, 22, 18, 22, '#9aa2a8'); A.rect(c, 12, 22, 5, 22, '#c4ccd0'); A.rect(c, 26, 22, 4, 22, '#7a8288'); A.rect(c, 12, 34, 18, 2, '#c9a050');
    A.rect(c, 14, 44, 5, 9, '#7a8288'); A.rect(c, 23, 44, 5, 9, '#7a8288'); A.rect(c, 13, 51, 7, 3, '#5f666c'); A.rect(c, 22, 51, 7, 3, '#5f666c');
    A.rect(c, 8, 22, 7, 6, '#9aa2a8'); A.rect(c, 27, 22, 7, 6, '#7a8288');
    // Bronze bell for a head, a dark slit glowing within.
    A.poly(c, [[11 + sw, 22], [31 + sw, 22], [28, 8], [24, 4], [18, 4], [14, 8]], '#c9a050'); A.poly(c, [[11 + sw, 22], [18, 22], [17, 8], [18, 4], [14, 8]], '#e8c878');
    A.rect(c, 9 + sw, 21, 24, 3, '#9a7838'); A.rect(c, 19, 1, 4, 4, '#9a7838'); A.rect(c, 15, 13, 12, 3, '#2f2a26'); A.rect(c, 17, 14, 2, 1, '#7fd8c8'); A.rect(c, 23, 14, 2, 1, '#7fd8c8');
    // Halberd.
    A.rect(c, 37, 4, 2, 48, '#6b4f3a'); A.poly(c, [[39, 6], [42, 10], [39, 16]], '#c4ccd0'); A.poly(c, [[37, 6], [33, 9], [37, 13]], '#9aa2a8'); A.rect(c, 37, 2, 2, 3, '#c4ccd0');
    A.rect(c, 33, 24, 5, 5, '#9aa2a8');
  },
  mistWisp(c, A, f) {
    const tail = f ? 2 : -2;
    A.poly(c, [[5, 18], [21, 18], [20, 28], [15 + tail, 34], [12 + tail, 38], [11, 32], [6, 28]], 'rgba(200,232,226,.75)');
    A.ellipse(c, 13, 16, 9, 9, 'rgba(216,240,236,.9)'); A.ellipse(c, 11, 13, 5, 4, 'rgba(255,255,255,.9)');
    A.rect(c, 8, 15, 3, 4, '#3f5a56'); A.rect(c, 15, 15, 3, 4, '#3f5a56'); A.rect(c, 8, 15, 1, 1, '#ffffff'); A.rect(c, 15, 15, 1, 1, '#ffffff');
    A.ellipse(c, 13, 24, 3, 3, 'rgba(160,240,210,.7)'); A.rect(c, 12, 23, 2, 2, '#e8fff4');
    A.poly(c, [[5, 14], [1, 10 + tail], [5, 18]], 'rgba(216,240,236,.8)'); A.poly(c, [[21, 14], [25, 10 - tail], [21, 18]], 'rgba(216,240,236,.8)');
  },
  lanternGhost(c, A, f) {
    A.poly(c, [[4, 14], [18, 14], [18, 26], [15, 24 + f * 2], [12, 27], [9, 24 + f * 2], [6, 27], [4, 25]], '#e8e2f0'); A.ellipse(c, 11, 12, 8, 8, '#f4f0fa'); A.ellipse(c, 9, 9, 4, 3, '#ffffff');
    A.rect(c, 7, 11, 2, 3, '#4a3f5a'); A.rect(c, 13, 11, 2, 3, '#4a3f5a'); A.rect(c, 10, 15, 3, 2, '#4a3f5a'); blush(A, c, 5, 15); blush(A, c, 14, 15);
    A.line(c, 18, 18, 20, 18, '#e8e2f0'); A.line(c, 20, 18, 20, 21, '#3f3530'); A.rect(c, 18, 21, 5, 7, '#4f4540'); A.rect(c, 19, 22, 3, 5, f ? '#ffe7a8' : '#f4d48a');
    for (let k = 3; k >= 1; k--) A.ellipse(c, 20.5, 24, k * 2.5, k * 2.5, `rgba(244,212,138,${.12 * (4 - k)})`);
  },
  glowMoth(c, A, f) {
    const y = 12, wing = f ? 3 : 0;
    A.ellipse(c, 6, y - 2 + wing, 6, 5 - wing / 2, '#d8e4f0'); A.ellipse(c, 18, y - 2 + wing, 6, 5 - wing / 2, '#c8d6e6');
    A.ellipse(c, 6, y + 4, 4, 3, '#c8d6e6'); A.ellipse(c, 18, y + 4, 4, 3, '#b8c8dc');
    for (const [x, yy] of [[5, y - 3], [19, y - 3]]) { A.rect(c, x, yy + wing, 2, 2, '#9fe8d8'); A.ellipse(c, x + 1, yy + wing + 1, 3, 3, 'rgba(160,240,220,.3)'); }
    A.ellipse(c, 12, y + 1, 2.5, 6, '#8a8296'); A.ellipse(c, 12, y - 5, 2.5, 2.5, '#a49cb0'); eye(A, c, 11, y - 6, 1, '#2f2a30');
    A.line(c, 11, y - 7, 8, y - 11, '#8a8296'); A.line(c, 13, y - 7, 16, y - 11, '#8a8296');
  },
  bindingRoots(c, A, f) {
    const sway = f ? 1 : -1;
    for (const [x0, x1, top, col] of [[6, 2 + sway, 6, '#4f4038'], [30, 34 - sway, 4, '#4f4038'], [12, 8 - sway, 0, '#5a4a40'], [25, 29 + sway, 2, '#5a4a40']]) {
      for (let k = 0; k < 14; k++) { const t = k / 13, x = x0 + (x1 - x0) * t + Math.sin(t * 6 + sway) * 2, y = 34 - (34 - top) * t; A.rect(c, x, y, 4 - t * 2.5, 3, col); }
      A.rect(c, x1 + Math.sin(6 + sway) * 2, top - 1, 2, 2, '#6f9a62');
    }
    A.ellipse(c, 19, 26, 12, 9, '#4f4038'); A.ellipse(c, 18, 24, 10, 7, '#6b584c'); A.ellipse(c, 16, 22, 5, 3, '#857066');
    A.ellipse(c, 19, 24, 5, 4, '#2f2622'); A.ellipse(c, 19, 24, 3.5, 3, '#c9f0a0'); A.rect(c, 19, 23, 1, 3, '#2f2a30'); A.rect(c, 18, 22, 1, 1, '#ffffff');
    for (let k = 0; k < 5; k++) A.rect(c, 8 + k * 6, 33, 4, 3, '#4f4038');
  },
  heartGuardian(c, A, f) {
    const br = f ? 1 : 0;
    // Legs and a body of bark and moss.
    for (const [x, d] of [[14, 0], [20, 1], [34, 0], [40, 1]]) { A.rect(c, x, 44 + d, 4, 16 - d, '#4f4038'); A.rect(c, x, 44 + d, 1, 15, '#6b584c'); A.rect(c, x - 1, 57, 6, 3, '#3a2f29'); }
    A.ellipse(c, 27, 40, 20, 11, '#5a4a40'); A.ellipse(c, 26, 38, 17, 8, '#6b584c');
    A.ellipse(c, 24, 33, 16, 6, '#4f7a58'); A.ellipse(c, 22, 31, 12, 4, '#6f9a62'); for (const [x, y] of [[12, 30], [20, 28], [32, 30], [38, 34]]) A.rect(c, x, y, 3, 2, '#9cc488');
    // Glowing heart in the chest.
    for (let k = 3; k >= 1; k--) A.ellipse(c, 40, 40, 4 + k * 3 + br, 3 + k * 2.5 + br, `rgba(160,240,200,${.12 * (4 - k)})`);
    A.poly(c, [[40, 45], [36, 40], [37, 37], [40, 38], [43, 37], [44, 40]], br ? '#c4f6dc' : '#9fe8c0');
    // Stag head with branch antlers.
    A.poly(c, [[34, 36], [40, 26], [48, 24], [46, 34], [40, 40]], '#5a4a40'); A.poly(c, [[36, 34], [41, 27], [44, 27], [40, 36]], '#6b584c');
    A.ellipse(c, 46, 24, 7, 7, '#6b584c'); A.ellipse(c, 45, 22, 5, 5, '#857066'); A.rect(c, 50, 25, 5, 5, '#6b584c'); A.rect(c, 53, 26, 2, 2, '#3a2f29');
    A.rect(c, 46, 21, 3, 2, '#c4f6dc'); A.rect(c, 47, 21, 1, 1, '#ffffff');
    const antler = (x, dir) => { A.line(c, x, 18, x + dir * 2, 6, '#5a4a40', 2); A.line(c, x + dir, 12, x + dir * 7, 7, '#5a4a40', 2); A.line(c, x + dir * 2, 8, x - dir * 3, 1, '#5a4a40', 2); A.line(c, x + dir * 6, 8, x + dir * 9, 2, '#5a4a40'); for (const [lx, ly] of [[x + dir * 7, 6], [x - dir * 3, 1], [x + dir * 9, 2]]) { A.rect(c, lx - 1, ly - 1, 3, 2, '#86b076'); A.rect(c, lx, ly - 2, 1, 1, '#c0d6a2'); } };
    antler(42, -1); antler(48, 1);
    A.poly(c, [[4, 34], [0, 30], [3, 40]], '#6b584c'); A.rect(c, 0, 29, 3, 2, '#86b076');
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

const cache = new Map();
/** One frame of a creature: { canvas, footX, footY, lift }. Frames 0/1 animate; flash paints it white for a hit. */
export function makeMonster(id, frame = 0, flash = false) {
  const key = `${id}:${frame}:${flash}`; if (cache.has(key)) return cache.get(key);
  const sp = SPECIES[id] || SPECIES.leafSlime, [w, h] = sp.size, A = Art();
  const canvas = document.createElement('canvas'); canvas.width = w + 2; canvas.height = h + 2;
  const c = canvas.getContext('2d', { willReadFrequently: true }); c.imageSmoothingEnabled = false; c.translate(1, 1);
  (DRAW[id] || DRAW.leafSlime)(c, A, frame % 2);
  c.setTransform(1, 0, 0, 1, 0, 0);
  outline(canvas, sp.kind === 'float' && (id === 'mistWisp') ? '#6f9a96' : OUT);
  if (flash) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(0, 0, canvas.width, canvas.height); c.globalCompositeOperation = 'source-over'; }
  const out = { canvas, footX: Math.round(canvas.width / 2), footY: canvas.height - 1, lift: sp.lift || 0 };
  cache.set(key, out); return out;
}
/** The species a quest fights. */
export const questFoe = quest => QUEST_FOE[quest?.id] || 'leafSlime';
