/* The "one more turn" layer: the monster book, treasure sets, guild policies picked at every rank-up,
   reward chests with a rarity roll and short daily goals. Pure module: game.js feeds it counters and
   hands its rewards to the guild. */
import { TREASURES, HUNT_ZONES } from './content.js';

export const CODEX_NAMES = {
  leafSlime: 'สไลม์ใบไม้', waterSlime: 'สไลม์หยดน้ำค้าง', thornling: 'พุ่มหนามจิ๋ว', hornHare: 'กระต่ายเขากิ่ง', fuzzBee: 'ผึ้งปุยยักษ์',
  fluffBoar: 'หมูป่าขนฟู', pondFrog: 'กบนักรบใบบัว', mushHopper: 'เห็ดกระโดด', acornBeetle: 'ด้วงหมวกลูกโอ๊ก', mossWolf: 'หมาป่ามอส',
  hollowKeeper: 'ผู้เฝ้าโพรง', pebbleCrab: 'ปูกรวดหิน', crystalBat: 'ค้างคาวผลึก', marbleGolem: 'โกเลมหินอ่อน', bellGuardian: 'ผู้พิทักษ์ระฆัง',
  mistWisp: 'ภูตหมอก', lanternGhost: 'ผีตะเกียง', glowMoth: 'แมลงเม่าเรืองแสง', bindingRoots: 'รากไม้พันธนาการ', heartGuardian: 'ผู้พิทักษ์หัวใจป่า',
  fieldMole: 'ตุ่นขุดไร่', cropGoblin: 'ก็อบลินขโมยผัก', roadBandit: 'โจรป่าหน้ากากใบไม้', dustLizard: 'กิ้งก่าฝุ่นแดง', cliffHarpy: 'ฮาร์ปี้หน้าผา',
  emberImp: 'ภูตถ่านไฟ', sandWyrm: 'หนอนทรายยักษ์', stoneDrake: 'มังกรหินน้อย', magmaTortoise: 'เต่าแมกมา', stormRoc: 'นกฟ้าคำราม',
  wyvernMatriarch: 'แม่พญาไวเวิร์น', emberDragon: 'ราชันมังกรเพลิง',
};
/** Pages of the monster book: one per hunting ground, the village jobs, and the great foes. */
export const CODEX_FAMILIES = [
  ...Object.entries(HUNT_ZONES).map(([id, z]) => ({ id, name: z.name, rank: z.rank, species: z.species })),
  { id: 'village', name: 'งานในหมู่บ้าน', rank: 'F', species: ['waterSlime', 'pondFrog', 'fluffBoar', 'fieldMole', 'cropGoblin', 'roadBandit', 'bindingRoots'] },
  { id: 'great', name: 'ศัตรูตัวฉกาจ', rank: 'D', species: ['hollowKeeper', 'bellGuardian', 'heartGuardian', 'sandWyrm', 'wyvernMatriarch', 'emberDragon'] },
];
const BOOKED = new Set(CODEX_FAMILIES.flatMap(f => f.species));
/** Treasure sets: own every piece once (found, bought back or shown) and the set pays out. */
export const TREASURE_SETS = [
  { id: 'village', name: 'ของเก่าในหมู่บ้าน', icon: '🏺', items: ['oldCoin', 'silverBangle', 'jadeIdol'], reward: { gold: 300, rep: 15 } },
  { id: 'explorer', name: 'ของสะสมนักสำรวจ', icon: '🧭', items: ['jadeIdol', 'starMap', 'dragonEgg'], reward: { gold: 700, rep: 30 } },
  { id: 'crowns', name: 'มงกุฎแห่งชายแดน', icon: '👑', items: ['rustCrown', 'emberCrown'], reward: { gold: 1200, rep: 50 } },
];

/** Guild policies: at every guild rank-up the master keeps one card of three, so no two guilds play alike. */
export const POLICIES = {
  broker: { name: 'นายหน้ามือทอง', icon: '💰', text: 'ค่านายหน้าจากคำร้องทุกใบ +12%' },
  welcome: { name: 'ประตูเปิดกว้าง', icon: '🚪', text: 'นักผจญภัยหน้าใหม่มาลงทะเบียนถี่ขึ้น 30%' },
  tavern: { name: 'โรงเตี๊ยมคึกคัก', icon: '🍺', text: 'ราคาเครื่องดื่มและอาหารในกิลด์ +25%' },
  medic: { name: 'หมอประจำกิลด์', icon: '🩹', text: 'บาดแผลหายเร็วขึ้น 40%' },
  drill: { name: 'ครูฝึกเข้มงวด', icon: '🎯', text: 'นักผจญภัยได้ XP มากขึ้น 15%' },
  fame: { name: 'ชื่อเสียงขจรไกล', icon: '📣', text: 'ชื่อเสียงจากงานที่สำเร็จ +20%' },
  thrift: { name: 'ช่างประจำกิลด์', icon: '🔨', text: 'ค่าอัปเกรดของใช้ในกิลด์ −15%' },
  scavenger: { name: 'ตาไวของมีค่า', icon: '🔎', text: 'โอกาสพบสมบัติตอนล่ามอน ×2' },
  cheer: { name: 'กิลด์อบอุ่น', icon: '💛', text: 'อารมณ์ของนักผจญภัยทุกคน +6' },
  trader: { name: 'พ่อค้าเจ้าเสน่ห์', icon: '⚖', text: 'ขายส่ง คาราวาน และประมูลได้เงิน +10%' },
};

/** Chests: the tier sets the odds of each rarity; the rarity sets what is inside. */
export const CHEST_RARITIES = {
  common: { name: 'ธรรมดา', color: '#b9a888', mult: 1 },
  rare: { name: 'หายาก', color: '#6aa6d8', mult: 2 },
  epic: { name: 'ล้ำค่า', color: '#b07ad8', mult: 4 },
  legend: { name: 'ตำนาน', color: '#f0b43c', mult: 8 },
};
export const CHESTS = {
  wood: { name: 'หีบไม้', icon: '📦', odds: { common: 70, rare: 24, epic: 5, legend: 1 } },
  silver: { name: 'หีบเงิน', icon: '🎁', odds: { common: 30, rare: 45, epic: 20, legend: 5 } },
  gold: { name: 'หีบทอง', icon: '💎', odds: { common: 0, rare: 45, epic: 40, legend: 15 } },
};
const MAX_CHESTS = 12;

/** Short goals for one game day, measured from the counters at dawn. */
export const DAILY_POOL = {
  jobs: { icon: '📜', text: n => `ทำคำร้องสำเร็จ ${n} งาน`, need: [3, 4, 6], counter: 'jobs' },
  kills: { icon: '⚔', text: n => `ปราบมอน ${n} ตัว`, need: [15, 25, 40], counter: 'kills' },
  bought: { icon: '⚖', text: n => `รับซื้อของที่เคาน์เตอร์ ${n} ชิ้น`, need: [6, 10, 16], counter: 'bought' },
  hall: { icon: '🍺', text: n => `ขายเครื่องดื่มและอาหาร ${n} G`, need: [30, 60, 120], counter: 'hall' },
  income: { icon: '◈', text: n => `รายรับรวม ${n} G`, need: [250, 500, 900], counter: 'income' },
  joined: { icon: '🧑', text: n => `มีหน้าใหม่มาลงทะเบียน ${n} คน`, need: [1, 2, 3], counter: 'joined' },
  promote: { icon: '🎫', text: () => 'นักผจญภัยสอบผ่าน 1 คน', need: [1, 1, 1], counter: 'passed' },
};

export function createProgress() {
  return { kills: {}, families: {}, treasures: {}, sets: {}, policies: [], offer: null, chests: [], chestSeq: 1, opened: 0, daily: null, firsts: 0 };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length) % list.length];

export function addChest(p, tier, from) {
  if (!CHESTS[tier]) return null;
  const chest = { id: p.chestSeq++, tier, from: String(from || '').slice(0, 40) };
  p.chests.push(chest);
  // A full shelf keeps the best chests.
  if (p.chests.length > MAX_CHESTS) { const order = ['wood', 'silver', 'gold']; p.chests.sort((a, b) => order.indexOf(b.tier) - order.indexOf(a.tier)); p.chests.length = MAX_CHESTS; }
  return chest;
}
/** Roll what a chest holds. Gold scales with the guild's rank so a late chest still feels good. */
export function rollChest(chest, rand, rankIdx = 0) {
  const odds = CHESTS[chest.tier].odds, total = Object.values(odds).reduce((a, b) => a + b, 0);
  let r = rand() * total, rarity = 'common';
  for (const [id, w] of Object.entries(odds)) { if (r < w) { rarity = id; break; } r -= w; }
  const m = CHEST_RARITIES[rarity].mult, scale = 1 + rankIdx * 0.35;
  const reward = { gold: Math.round((15 + rand() * 15) * m * scale) };
  const mat = pick(rand, ['wood', 'stone', 'herb']);
  reward[mat] = Math.round((3 + rand() * 3) * Math.sqrt(m));
  if (rarity !== 'common') reward.rep = Math.round(2 * m);
  let treasure = null;
  if (rarity === 'epic' || rarity === 'legend') {
    const pool = Object.entries(TREASURES).filter(([, t]) => !t.boss && (rarity === 'legend' || t.value <= 400)).map(([id]) => id);
    if (rarity === 'legend' || rand() < 0.5) treasure = pick(rand, pool);
  }
  return { rarity, reward, treasure };
}

/** A monster fell: count it in the book. Returns the news (first of its kind, a page completed). */
export function recordKill(p, species) {
  if (!BOOKED.has(species)) return null;
  const first = !p.kills[species];
  p.kills[species] = (p.kills[species] || 0) + 1;
  if (!first) return null;
  p.firsts += 1;
  const done = CODEX_FAMILIES.filter(f => !p.families[f.id] && f.species.every(s => p.kills[s]));
  for (const f of done) p.families[f.id] = true;
  return { first: species, name: CODEX_NAMES[species], pages: done };
}
/** A treasure came into the guild's hands: mark it, and pay any set it completes. */
export function recordTreasure(p, id) {
  if (!TREASURES[id]) return [];
  p.treasures[id] = true;
  const done = TREASURE_SETS.filter(s => !p.sets[s.id] && s.items.every(i => p.treasures[i]));
  for (const s of done) p.sets[s.id] = true;
  return done;
}
export function codexView(p) {
  const families = CODEX_FAMILIES.map(f => ({ ...f, done: Boolean(p.families[f.id]), have: f.species.filter(s => p.kills[s]).length,
    entries: f.species.map(s => ({ id: s, name: CODEX_NAMES[s], kills: p.kills[s] || 0 })) }));
  const sets = TREASURE_SETS.map(s => ({ ...s, done: Boolean(p.sets[s.id]), have: s.items.filter(i => p.treasures[i]).length,
    entries: s.items.map(i => ({ id: i, name: TREASURES[i].name, icon: TREASURES[i].icon, owned: Boolean(p.treasures[i]) })) }));
  return { families, sets, seen: Object.keys(p.kills).length, total: BOOKED.size };
}

/** Three policy cards the guild does not have yet. */
export function offerPolicies(p, rank, rand) {
  const pool = Object.keys(POLICIES).filter(id => !p.policies.includes(id));
  const cards = [];
  while (cards.length < 3 && pool.length) cards.push(pool.splice(Math.floor(rand() * pool.length) % pool.length, 1)[0]);
  p.offer = cards.length ? { rank, cards } : null;
  return p.offer;
}
export function choosePolicy(p, id) {
  if (!p.offer) return { ok: false, message: 'ยังไม่มีนโยบายให้เลือก' };
  if (!p.offer.cards.includes(id)) return { ok: false, message: 'เลือกได้เฉพาะการ์ดที่เสนอ' };
  p.policies.push(id); p.offer = null;
  return { ok: true, message: `นโยบายกิลด์: ${POLICIES[id].icon} ${POLICIES[id].name} · ${POLICIES[id].text}` };
}
export const hasPolicy = (state, id) => Boolean(state.progress?.policies?.includes(id));

/** Three goals for the new day; harder as the guild grows. `counters` is a snapshot at dawn. */
export function newDailyGoals(p, day, counters, rankIdx, rand) {
  const ids = Object.keys(DAILY_POOL).filter(id => id !== 'promote' || rankIdx >= 1);
  const step = Math.min(2, Math.floor(rankIdx / 2)), list = [];
  while (list.length < 3 && ids.length) {
    const id = ids.splice(Math.floor(rand() * ids.length) % ids.length, 1)[0], def = DAILY_POOL[id];
    list.push({ id, need: def.need[step], base: counters[def.counter] || 0, done: false });
  }
  p.daily = { day, list, bonus: false };
  return p.daily;
}
export function dailyView(p, counters) {
  if (!p.daily) return [];
  return p.daily.list.map(g => { const def = DAILY_POOL[g.id]; return { ...g, icon: def.icon, text: def.text(g.need), have: Math.min(g.need, Math.max(0, (counters[def.counter] || 0) - g.base)) }; });
}

export function sanitizeProgress(data) {
  const p = createProgress(), d = data && typeof data === 'object' ? data : {};
  const flags = (o, ok) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k, v]) => ok(k) && v === true));
  p.kills = Object.fromEntries(Object.entries(d.kills && typeof d.kills === 'object' ? d.kills : {}).filter(([k, v]) => BOOKED.has(k) && Number.isInteger(v) && v > 0 && v < 1e9));
  p.families = flags(d.families, k => CODEX_FAMILIES.some(f => f.id === k));
  p.treasures = flags(d.treasures, k => Boolean(TREASURES[k]));
  p.sets = flags(d.sets, k => TREASURE_SETS.some(s => s.id === k));
  p.policies = [...new Set((Array.isArray(d.policies) ? d.policies : []).filter(id => POLICIES[id]))].slice(0, 10);
  if (d.offer && Array.isArray(d.offer.cards)) { const cards = d.offer.cards.filter(id => POLICIES[id] && !p.policies.includes(id)).slice(0, 3); if (cards.length) p.offer = { rank: String(d.offer.rank || '').slice(0, 2), cards }; }
  p.chests = (Array.isArray(d.chests) ? d.chests : []).filter(c => c && CHESTS[c.tier] && Number.isInteger(c.id)).slice(0, MAX_CHESTS).map(c => ({ id: c.id, tier: c.tier, from: String(c.from || '').slice(0, 40) }));
  p.chestSeq = Math.max(Number.isInteger(d.chestSeq) ? d.chestSeq : 1, ...p.chests.map(c => c.id + 1), 1);
  p.opened = Number.isInteger(d.opened) && d.opened >= 0 ? d.opened : 0;
  p.firsts = Object.keys(p.kills).length;
  if (d.daily && Number.isInteger(d.daily.day) && Array.isArray(d.daily.list)) {
    const list = d.daily.list.filter(g => g && DAILY_POOL[g.id] && Number.isFinite(g.need) && g.need > 0 && Number.isFinite(g.base) && g.base >= 0).slice(0, 3).map(g => ({ id: g.id, need: g.need, base: g.base, done: g.done === true }));
    p.daily = { day: d.daily.day, list, bonus: d.daily.bonus === true };
  }
  return p;
}
