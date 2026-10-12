/* The guild master in the field: classes, the skill book, the master's own gear, the gathering spots and the
   golden contracts only the master can take. Pure data and helpers; life.js plays the fights, game.js pays out. */
import { HUNT_ZONES } from './content.js';

/** Walkable world for the master; the frontier east of x 80 opens at guild rank B. */
export const HERO_BOUNDS = { x0: -60, x1: 148, y0: -66, y1: 56, westOnly: 80 };
export const HERO = { speed: 3.2, dashSpeed: 9, dashTime: 0.18, dashCd: 1.1, perfect: 0.14, downTime: 4, injury: 120, comboGap: 0.9, assist: 2.6, interact: 1.4, gatherCd: 0.8, carrySpeed: 0.7 };

/** Four ways to fight. `attack` is the basic button; s1/s2 are skills on cooldowns; `ult` fills from hits and perfect dodges. */
export const HERO_CLASSES = {
  warrior: { name: 'นักรบ', icon: '🛡', hp: 1.25, power: 1, desc: 'ฟันต่อเนื่อง 3 จังหวะ แข็งแรงที่สุด ตัดไม้และขุดหินได้มากกว่า',
    attack: { kind: 'melee', reach: 1.5, cd: 0.42, hit: 'slash', combo: [1, 1.1, 1.6] },
    s1: { id: 'spin', name: 'ฟันหมุน', icon: '🌀', cd: 5, radius: 2.3, mult: 1.6 },
    s2: { id: 'shield', name: 'ยกโล่', icon: '🛡', cd: 9, guard: 3, taunt: 4 },
    ult: { id: 'quake', name: 'กระแทกพื้น', icon: '💥', radius: 3.2, mult: 3, stun: 1.5 } },
  archer: { name: 'นักธนู', icon: '🏹', hp: 0.95, power: 1.05, desc: 'ยิงจากระยะไกล วางกับดัก เก็บสมุนไพรและของหายากได้ไวตา',
    attack: { kind: 'ranged', reach: 6, cd: 0.5, hit: 'arrow' },
    s1: { id: 'volley', name: 'ยิงกระจาย', icon: '🎯', cd: 5, reach: 6, cone: 0.55, targets: 5, mult: 1.2 },
    s2: { id: 'trap', name: 'กับดัก', icon: '🪤', cd: 8, life: 12, stun: 2.5, mult: 1.5 },
    ult: { id: 'rain', name: 'ฝนธนู', icon: '☔', reach: 5, radius: 3, mult: 2.5, slow: 3 } },
  mage: { name: 'นักเวท', icon: '✦', hp: 0.85, power: 1.15, desc: 'ลูกไฟแรง กระจายวง แช่แข็งศัตรู วาร์ปหนี เจอสมุนไพรหายากบ่อย',
    attack: { kind: 'ranged', reach: 5.5, cd: 0.7, hit: 'fire', splash: 0.9 },
    s1: { id: 'frost', name: 'วงน้ำแข็ง', icon: '❄', cd: 6, radius: 2.6, mult: 1, slow: 3 },
    s2: { id: 'blink', name: 'วาร์ป', icon: '✧', cd: 7, dist: 3.5 },
    ult: { id: 'meteor', name: 'อุกกาบาต', icon: '☄', reach: 5, radius: 3, mult: 4 } },
  healer: { name: 'นักบวช', icon: '✚', hp: 1.05, power: 0.85, desc: 'ฟาดไม้เท้า รักษาตัวเองและเพื่อน ปลุกคนที่สลบให้ลุกขึ้นสู้ต่อ',
    attack: { kind: 'melee', reach: 1.8, cd: 0.55, hit: 'holy' },
    s1: { id: 'heal', name: 'วงรักษา', icon: '✚', cd: 7, radius: 4, amount: 0.35 },
    s2: { id: 'ward', name: 'โล่แสง', icon: '🔆', cd: 9, guard: 3, radius: 4 },
    ult: { id: 'revive', name: 'ปลุกคนสลบ', icon: '🌟', radius: 4.5, amount: 0.5 } },
};
/** Changing class: the first choice is free; later the dojo teaches the new way for a fee. */
export const CLASS_CHANGE_FEE = 150;

/** The master's skill book: three branches, three steps each; one point per level after the first. */
export const HERO_TREE = {
  p1: { branch: 'power', name: 'คมอาวุธ', text: 'พลังโจมตี +12%' }, p2: { branch: 'power', name: 'จุดตาย', text: 'โอกาสคริติคอล +12%', needs: 'p1' }, p3: { branch: 'power', name: 'พลังล้น', text: 'เกจท่าไม้ตายเต็มไวขึ้น 30%', needs: 'p2' },
  v1: { branch: 'vigor', name: 'กายแกร่ง', text: 'HP สูงสุด +15%' }, v2: { branch: 'vigor', name: 'ฟื้นตัวไว', text: 'ฟื้น HP เร็วขึ้น 2 เท่า', needs: 'v1' }, v3: { branch: 'vigor', name: 'ตั้งหลัก', text: 'สลบแล้วไม่เสียของ และบาดเจ็บสั้นลงครึ่งหนึ่ง', needs: 'v2' },
  l1: { branch: 'lead', name: 'ผู้นำ', text: 'บัฟผู้นำกว้างขึ้นและแรงขึ้น (+20% พลังทีม)', }, l2: { branch: 'lead', name: 'สหายร่วมทาง', text: 'เพื่อนร่วมทางแรงขึ้น 20%', needs: 'l1' }, l3: { branch: 'lead', name: 'ขวัญทีม', text: 'ช่วยคนสลบแล้วได้ความผูกพันสองเท่า และงานที่นำได้รางวัลเพิ่ม', needs: 'l2' },
};
export const TREE_BRANCHES = { power: 'พลัง', vigor: 'ความอึด', lead: 'ผู้นำ' };

/** Rare materials only the master brings home. */
export const RARE_MATS = { heartwood: { name: 'แก่นไม้เก่า', icon: '🪵' }, ore: { name: 'แร่ผลึก', icon: '💎' }, glowHerb: { name: 'สมุนไพรเรืองแสง', icon: '🌿' } };
/** The master's own gear: any class can use it; the weapon takes the shape of the class. */
export const HERO_GEAR = {
  w1: { slot: 'weapon', name: 'อาวุธไม้โอ๊ก', power: 6, cost: { gold: 120, wood: 12 } },
  w2: { slot: 'weapon', name: 'อาวุธเหล็กกล้า', power: 14, cost: { gold: 420, stone: 24, ore: 2 } },
  w3: { slot: 'weapon', name: 'อาวุธเกล็ดมังกร', power: 28, burn: true, cost: { gold: 1600, heartwood: 3, ore: 3, parts: { drakeScale: 4 } } },
  a1: { slot: 'armor', name: 'เสื้อหนังพราน', hp: 40, cost: { gold: 100, parts: { pelt: 3 } } },
  a2: { slot: 'armor', name: 'เกราะผลึก', hp: 90, def: 0.1, cost: { gold: 480, stone: 16, ore: 3, parts: { core: 1 } } },
  a3: { slot: 'armor', name: 'เกราะเพลิง', hp: 160, def: 0.2, cost: { gold: 1500, glowHerb: 3, heartwood: 2, parts: { magma: 4 } } },
  c1: { slot: 'charm', name: 'เครื่องรางใบไม้', regen: 1, cost: { gold: 90, herb: 6, glowHerb: 1 } },
  c2: { slot: 'charm', name: 'เครื่องรางนักเก็บ', gather: 0.5, cost: { gold: 260, heartwood: 2 } },
  c3: { slot: 'charm', name: 'ตราผู้นำ', lead: 0.1, cost: { gold: 700, ore: 2, glowHerb: 2, parts: { mask: 3 } } },
};

/** Spots to gather by hand, scattered through each hunting ground (and a few near the village); each regrows the day after. */
const NODE_PLAN = { meadow: { tree: 3, herb: 5 }, woods: { tree: 7, herb: 2 }, hills: { rock: 7 }, mist: { herb: 5, tree: 2 }, canyon: { rock: 5 }, peak: { rock: 4 } };
const VILLAGE_NODES = [['tree', -16, 2], ['tree', 17, -3], ['rock', 19, 27], ['herb', -12, 28], ['tree', -20, -6], ['rock', 28, 6]];
export const GATHER_NODES = (() => {
  let k = 4021; const r = () => ((k = Math.imul(k, 1664525) + 1013904223 >>> 0) / 4294967296);
  const out = VILLAGE_NODES.map(([kind, x, y], i) => ({ id: `v${i}`, kind, x, y, zone: null }));
  for (const [zone, plan] of Object.entries(NODE_PLAN)) { const z = HUNT_ZONES[zone]; if (!z) continue;
    for (const [kind, n] of Object.entries(plan)) for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = (0.35 + r() * 0.75) * z.r; out.push({ id: `${zone}-${kind}-${i}`, kind, zone, x: Math.round((z.x + Math.cos(a) * d) * 10) / 10, y: Math.round((z.y + Math.sin(a) * d * 0.8) * 10) / 10 }); } }
  return out;
})();
export const NODE_KINDS = { tree: { name: 'ต้นไม้', verb: 'ตัดไม้', res: 'wood', rare: 'heartwood', base: [3, 5], icon: '🪓' }, rock: { name: 'หิน', verb: 'ขุดหิน', res: 'stone', rare: 'ore', base: [3, 5], icon: '⛏' }, herb: { name: 'กอสมุนไพร', verb: 'เก็บสมุนไพร', res: 'herb', rare: 'glowHerb', base: [2, 4], icon: '🌿' } };
/** What a spot gives: the class and the charm decide how much, and how often something rare turns up. */
export function gatherYield(node, cls, gear, rand) {
  const k = NODE_KINDS[node.kind], [a, b] = k.base;
  let n = a + Math.floor(rand() * (b - a + 1));
  if (cls === 'warrior' && node.kind !== 'herb') n += 2;
  if ((cls === 'mage' || cls === 'healer') && node.kind === 'herb') n += 2;
  const charm = HERO_GEAR[gear?.charm]?.gather || 0; n = Math.round(n * (1 + charm));
  const rareChance = 0.12 + (node.zone === 'mist' && node.kind === 'herb' ? 0.25 : 0) + (cls === 'archer' ? 0.08 : 0) + (cls === 'mage' && node.kind === 'herb' ? 0.1 : 0) + charm * 0.2;
  return { res: k.res, amount: n, rare: rand() < rareChance ? k.rare : null };
}

/** Golden contracts on the board, only the master can take them; a couple each morning. */
export const CONTRACT_KINDS = {
  elite: { name: 'ล่าตัวแรร์', icon: '👹', text: z => `ตัวแรร์ปรากฏที่${z}`, reward: { chest: 'silver', rare: 2, rep: 5 } },
  gather: { name: 'เสบียงพิเศษ', icon: '🧺', text: n => `เก็บของด้วยมือตัวเอง ${n} จุด`, need: 5, reward: { chest: 'wood', rare: 1, gold: 80 } },
  lead: { name: 'นำทีมด้วยตัวเอง', icon: '🚩', text: () => 'อยู่กับทีมที่ทำคำร้องจนงานสำเร็จ 1 งาน', reward: { chest: 'silver', rep: 4 } },
  rescue: { name: 'ไม่ทิ้งใครไว้ข้างหลัง', icon: '🚑', text: () => 'แบกนักผจญภัยที่สลบกลับกิลด์ 1 คน', reward: { chest: 'wood', rep: 3, gold: 60 } },
};

/** Power and life from level, class, gear and the skill book. */
export function computeHeroStats(hero) {
  const h = hero || {}, lvl = h.level || 1, cls = HERO_CLASSES[h.cls] || HERO_CLASSES.warrior, gear = h.gear || {}, t = h.tree || {};
  const g = id => HERO_GEAR[gear[id]] || {};
  const power = Math.round((16 + lvl * 4) * cls.power * (t.p1 ? 1.12 : 1) + (g('weapon').power || 0));
  const maxHp = Math.round(((140 + lvl * 20) * cls.hp + (g('armor').hp || 0)) * (t.v1 ? 1.15 : 1));
  return { power, maxHp, def: g('armor').def || 0, crit: 0.15 + (t.p2 ? 0.12 : 0), regen: 0.01 * (t.v2 ? 2 : 1) + (g('charm').regen ? 0.008 : 0), burn: Boolean(g('weapon').burn),
    ultGain: t.p3 ? 1.3 : 1, lead: 0.15 + (t.l1 ? 0.05 : 0) + (g('charm').lead || 0), leadReach: t.l1 ? 6 : 4, ally: t.l2 ? 1.2 : 1 };
}
export const heroXpNeeded = level => 40 + level * 30;
export const treePoints = hero => Math.max(0, (hero?.level || 1) - 1) - Object.keys(hero?.tree || {}).length;
