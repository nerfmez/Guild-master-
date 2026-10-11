/* The guild master's objectives: a chapter-by-chapter path through every system in the game.
   Each objective teaches one thing (how, step by step), shows how far along the guild is, points at the menu
   that does it, and pays a small reward when claimed. Pure module: reads the state, never changes it except claimGoal. */
import { RANKS } from './content.js';

const rankAt = (state, r) => RANKS.indexOf(state.rank) >= RANKS.indexOf(r);
const count = (list, f) => (list || []).filter(f).length;
const tier = (state, id) => { let n = 1, cur = id; for (let k = 0; k < 3; k++) { const p = GOAL_JOBS[cur]; if (!p) break; n++; cur = p; } return n; };
let GOAL_JOBS = {};
/** game.js hands over the class tree so this module stays free of other imports. */
export function setGoalJobs(parents) { GOAL_JOBS = parents; }

/** have/need for one objective; `done` when have >= need. */
const n = (have, need) => ({ have: Math.min(have, need), need });
export const GOAL_CHAPTERS = [
  { id: 'open', name: 'บทที่ 1 · เปิดประตูกิลด์', goals: [
    { id: 'patrol', title: 'ส่งทีมลาดตระเวนครั้งแรก', action: 'quest:patrol', reward: { gold: 60 },
      why: 'ภารกิจคือหัวใจของกิลด์ ทีมจะเดินออกไปบนแผนที่จริงและสู้กับมอนแบบเรียลไทม์',
      how: ['กดเมนู “คำร้อง” ที่แถบล่าง', 'เลือกคำร้อง “ลาดตระเวนทางหมู่บ้าน”', 'กด ⚡ เลือกทีมให้ หรือแตะเลือกสมาชิกเอง แล้วกด “ออกเดินทาง!”', 'กด “ดูการต่อสู้สดในโลก” เพื่อตามทีมไป'],
      check: s => n(s.completedQuests.patrol ? 1 : 0, 1) },
    { id: 'board', title: 'วางกระดานคำร้อง', action: 'build:board', reward: { gold: 40, wood: 4 },
      why: 'เมื่อมีกระดาน นักผจญภัยที่ว่างจะเดินมาหยิบงานทั่วไปไปทำเอง กิลด์ได้ค่านายหน้าโดยไม่ต้องสั่งทุกครั้ง',
      how: ['กดเมนู “สร้าง”', 'เลือกกระดานคำร้อง แล้วแตะพื้นในกิลด์เพื่อวาง', 'กดหมุนได้ถ้าวางไม่ลง'],
      check: s => n(s.facilities.some(f => f.type === 'board') ? 1 : 0, 1) },
    { id: 'jobs', title: 'ทำคำร้องให้ชาวบ้าน 5 งาน', action: 'quests', reward: { gold: 80, herb: 3 },
      why: 'ชาวบ้านเดินมาส่งคำร้องที่โต๊ะ ค่าจ้างแบ่งเป็นค่านายหน้าของกิลด์และค่าแรงของนักผจญภัย',
      how: ['ชาวบ้านมาเคาะประตู เลือก “รับ” เพื่อติดกระดาน', 'ตั้งค่าตอบแทน: ให้มาก คนรีบรับ ให้น้อย กิลด์ได้มาก', 'แต่ละงานมีรูปแบบต่างกัน: คุ้มกันเกวียน ป้องกันไร่ เก็บของ ลาดตระเวน'],
      check: s => n(s.record?.jobs || 0, 5) },
    { id: 'members', title: 'มีสมาชิก 4 คน', action: 'members', reward: { gold: 60 },
      why: 'ยิ่งคนมาก ยิ่งส่งทีมได้หลายงาน คนดังจะมาสมัครเมื่อกิลด์มีชื่อเสียง',
      how: ['รอคนมาสมัครที่ประตู หรือดูแท็บ “นักผจญภัยอิสระ” ในเมนูสมาชิก', 'นักผจญภัยอิสระที่ชอบกิลด์มากพอ ชวนเข้ากิลด์ได้'],
      check: s => n(s.members.length, 4) },
    { id: 'room', title: 'อัปเกรดห้องใดก็ได้เป็นระดับ 2', action: 'build', reward: { wood: 8, stone: 6 },
      why: 'ห้องระดับสูงทำงานดีขึ้น เช่น ห้องนอนพักเร็วขึ้น ห้องฝึกได้ XP มากขึ้น',
      how: ['กดห้องในฉากกิลด์ หรือเปิดเมนู “สร้าง”', 'เลือกห้องแล้วกด “อัปเกรด”'],
      check: s => n(s.facilities.some(f => (f.level || 1) >= 2) ? 1 : 0, 1) },
  ] },
  { id: 'village', name: 'บทที่ 2 · หมู่บ้านรอบกิลด์', goals: [
    { id: 'houses', title: 'มีบ้านในหมู่บ้าน 5 หลัง', action: 'village', reward: { gold: 80 },
      why: 'ครอบครัวใหม่ทำให้คำร้องมาถี่ขึ้น และหมู่บ้านต้องมีคนพอถึงจะเลื่อนระดับ',
      how: ['เปิดเมนู “หมู่บ้าน”', 'กด “สร้างบ้าน” แล้วเลือกที่วาง', 'บ้านโตเองเมื่อมีร้านหรือสิ่งที่ครอบครัวต้องการอยู่ใกล้'],
      check: s => n(s.village?.houses || 0, 5) },
    { id: 'shop', title: 'สร้างร้านค้าในหมู่บ้าน', action: 'village', reward: { gold: 60, herb: 3 },
      why: 'นักผจญภัยใช้เงินของตัวเองซื้อเสบียงและยา เงินหมุนกลับเข้าหมู่บ้าน',
      how: ['เมนู “หมู่บ้าน” → ร้านค้า → สร้าง', 'ร้านเติมของทุกเช้าจากตลาดนัด'], check: s => n(s.village?.shop || 0, 1) },
    { id: 'arena', title: 'สร้างสนามสอบ', action: 'village', reward: { gold: 80 },
      why: 'สมาคมกิลด์จัดสอบเลื่อนแรงค์ที่สนามนี้เป็นรอบ ๆ ทุกครึ่งวัน และยังใช้จัดงานประลองยุทธได้',
      how: ['เมนู “หมู่บ้าน” → สนามสอบ → สร้าง'], check: s => n(s.village?.arena || 0, 1) },
    { id: 'exam', title: 'สมาชิกสอบผ่านแรงค์ E', action: 'members', reward: { gold: 80 },
      why: 'แรงค์สูงขึ้น รับงานยากขึ้นได้และแข็งแรงขึ้น การสอบเป็นรอบ ทุกคนในรอบสอบพร้อมกัน 3 ด่าน',
      how: ['เลือกสมาชิกที่แต้มผลงานและเลเวลพอ', 'กด “สมัครสอบรอบถัดไป” (จ่ายค่าสมัคร)', 'เมื่อรอบเริ่ม แตะแจ้งเตือนเพื่อดูการสอบที่สนาม'],
      check: s => n(count(s.members, m => RANKS.indexOf(m.rank || 'F') >= 1), 1) },
    { id: 'level2', title: 'หมู่บ้านระดับ 2', action: 'village', reward: { gold: 120, wood: 6, stone: 6 },
      why: 'หมู่บ้านโตเมื่อมีทั้งความรุ่งเรืองและชาวเมือง เปิดอาคารใหม่อย่างตลาดนัดและโรงปรุงยา',
      how: ['ทำคำร้องให้ชาวบ้าน', 'สร้างบ้านและร้าน', 'ให้นักผจญภัยใช้จ่ายในหมู่บ้าน'], check: s => n(s.villageLevel || 1, 2) },
  ] },
  { id: 'trade', name: 'บทที่ 3 · การค้าของกิลด์', goals: [
    { id: 'counter', title: 'รับซื้อของจากนักผจญภัย 10 ชิ้น', action: 'market', reward: { gold: 60 },
      why: 'นักผจญภัยที่กลับจากล่ามอนขายชิ้นส่วนให้เคาน์เตอร์กิลด์ กิลด์เก็บไว้ในโกดังเพื่อแปรรูปหรือขายต่อ',
      how: ['เปิดเมนู “ตลาด” → วัตถุดิบ', 'ตั้งราคารับซื้อ: ราคาดีคนอิสระชอบมาขาย กดราคาได้กำไรมาก'], check: s => n(s.trade?.stats?.bought || 0, 10) },
    { id: 'workshop', title: 'สร้างโรงแปรรูป 1 แห่ง', action: 'village', reward: { gold: 80 },
      why: 'โรงฟอกหนัง โรงปรุงยา และร้านเจียระไน แปรรูปชิ้นส่วน 3 ชิ้นเป็นสินค้าที่มีราคามากกว่า',
      how: ['เมนู “หมู่บ้าน” → เลือกโรงแปรรูป → สร้าง', 'ดูสินค้าที่ผลิตได้ในเมนู “ตลาด”'],
      check: s => n((s.village?.tannery || 0) + (s.village?.apothecary || 0) + (s.village?.jeweler || 0) ? 1 : 0, 1) },
    { id: 'caravan', title: 'ส่งคาราวานไปเมืองหลวง', action: 'market', reward: { gold: 120 },
      why: 'คาราวานขนของในโกดังไปขายได้ราคาสูงกว่าขายส่ง แต่ต้องรอเดินทาง',
      how: ['สร้างลานคาราวานในหมู่บ้าน', 'เมนู “ตลาด” → คาราวาน → ส่ง'], check: s => n(s.trade?.stats?.trips || 0, 1) },
    { id: 'display', title: 'วางโชว์สมบัติ 1 ชิ้น', action: 'trade', reward: { gold: 60 },
      why: 'สมบัติที่วางโชว์ดึงคนมาชม ได้ค่าเข้าชมและชื่อเสียงทุกวัน หรือจะขาย/ประมูลก็ได้',
      how: ['เมนู “ตลาด” → สมบัติ', 'เลือก “วางโชว์”'], check: s => n((s.trade?.displayed || []).length, 1) },
  ] },
  { id: 'growth', name: 'บทที่ 4 · นักผจญภัยเติบโต', goals: [
    { id: 'gear', title: 'สมาชิกถืออาวุธ 3 คน', action: 'workshop', reward: { stone: 8 },
      why: 'อาวุธเพิ่มพลังโจมตี ทำเองได้ที่โต๊ะช่าง หรือให้สมาชิกซื้อเองที่โรงตีเหล็ก',
      how: ['เมนู “คราฟต์” → ทำอาวุธ', 'กด “จัดอุปกรณ์ให้ทุกคน”'], check: s => n(count(s.members, m => m.equipment?.weapon), 3) },
    { id: 'class2', title: 'สมาชิกเลื่อนอาชีพขั้นที่ 2', action: 'members', reward: { gold: 120 },
      why: 'อาชีพขั้นสูงมีท่าโจมตีและสกิลของตัวเอง เช่น ฟันกวาด ศรตรึง วงน้ำแข็ง',
      how: ['ต้องมีโรงฝึกในหมู่บ้าน', 'สมาชิกแรงค์ D เลเวล 5 ขึ้นไป', 'เมนู “สมาชิก” → เลือกคน → เลือกเส้นทางอาชีพ'], check: s => n(count(s.members, m => tier(s, m.class) >= 2), 1) },
    { id: 'hero', title: 'ออกไปปราบมอนด้วยตัวเอง 3 ตัว', action: 'hero', reward: { gold: 60 },
      why: 'หัวหน้ากิลด์ออกไปเดินในโลกได้ เดินด้วย WASD หรือจอยสัมผัส โจมตี หลบ และใช้สกิล',
      how: ['กดปุ่ม ⚔ มุมจอ', 'J/แตะ = โจมตี · Space = หลบ · K = สกิล'], check: s => n(s.hero?.kills || 0, 3) },
    { id: 'rankD', title: 'กิลด์เลื่อนเป็นระดับ D', action: 'promotion', reward: { gold: 150 },
      why: 'กิลด์ระดับสูงขึ้นเปิดพื้นที่และคำร้องใหม่ ต้องมีชื่อเสียงและผลงานครบ แล้วผ่านภารกิจสอบของสมาคม',
      how: ['ดูรายการที่ยังขาดได้ที่การ์ดเป้าหมาย', 'เมื่อพร้อม จดหมายสอบจะมาเป็นคำร้องสำคัญ'], check: s => n(rankAt(s, 'D') ? 1 : 0, 1) },
  ] },
  { id: 'festival', name: 'บทที่ 5 · งานเทศกาล', goals: [
    { id: 'fest1', title: 'จัดงานเทศกาลครั้งแรก', action: 'festival', reward: { gold: 100 },
      why: 'หัวหน้ากิลด์กำหนดเงินรางวัลและของรางวัลเอง ยิ่งรางวัลสูง คนมาเยอะ ชื่อเสียงและความรุ่งเรืองยิ่งเพิ่ม',
      how: ['ต้องมีอาคารรองรับ: สนามสอบ (ประลองยุทธ) · ลานเทศกาล (เก็บเกี่ยว) · เวทีโคมไฟ (โคมลอย)', 'เมนู “เทศกาล” → เลือกงาน → ตั้งรางวัล → ประกาศ', 'กด “ดูงาน” เพื่อชมการแข่งขัน'],
      check: s => n(s.festivals?.held || 0, 1) },
    { id: 'tourney', title: 'สมาชิกคว้าแชมป์งานประลองยุทธ', action: 'festival', reward: { gold: 200 },
      why: 'ถ้าสมาชิกชนะ เงินรางวัลเข้ากระเป๋าเขา และของรางวัลกลับคลังกิลด์ แถมชื่อเสียงเพิ่ม',
      how: ['ส่งสมาชิกที่แข็งที่สุดลงแข่ง (สูงสุด 4 คน)', 'รางวัลสูงดึงคนดังต่างเมืองมาแข่งด้วย'],
      check: s => n((s.festivals?.history || []).some(x => x.kind === 'tournament' && x.champion?.kind === 'member') ? 1 : 0, 1) },
    { id: 'rankC', title: 'กิลด์เลื่อนเป็นระดับ C', action: 'promotion', reward: { gold: 250 },
      why: 'เปิดป่าหมอกจันทร์และบทสรุปของบทที่หนึ่ง', how: ['ทำเป้าหมายเลื่อนระดับให้ครบ', 'ผ่านภารกิจสอบ “ปลดผนึกหอระฆัง”'], check: s => n(rankAt(s, 'C') ? 1 : 0, 1) },
    { id: 'heart', title: 'รักษาหัวใจป่า (จบบทที่หนึ่ง)', action: 'quest:heart', reward: { gold: 300 },
      why: 'ภารกิจนี้ยังเป็นการสอบเลื่อนเป็นกิลด์ B ด้วย', how: ['ผ่านสามเรื่องราวของป่าหมอก', 'อัปเกรดห้อง 2 จุดเป็นระดับ 2'], check: s => n(s.completedQuests.heart ? 1 : 0, 1) },
  ] },
  { id: 'frontier', name: 'บทที่ 6 · ชายแดนตะวันออก', goals: [
    { id: 'rankB', title: 'กิลด์เลื่อนเป็นระดับ B', action: 'promotion', reward: { gold: 400 },
      why: 'เปิดชายแดนตะวันออก หุบผาลมแดงและยอดเขามังกรหลับ อาชีพขั้นที่ 3 และนักผจญภัยแรงค์ B',
      how: ['ทำผลงานให้ครบตามรายการเลื่อนระดับ', 'ผ่านหัวใจป่า'], check: s => n(rankAt(s, 'B') ? 1 : 0, 1) },
    { id: 'camp', title: 'ตั้งค่ายแนวหน้าที่หุบผาลมแดง', action: 'quest:canyonroad', reward: { gold: 300, wood: 20 },
      why: 'ค่ายเป็นบ้านหลังที่สองของกิลด์ ทีมที่ผ่านค่ายได้พักฟื้น และเปิดเขตล่ามอนชายแดน',
      how: ['รับคำร้อง “บุกเบิกทางสู่หุบผาลมแดง”', 'คุ้มกันเกวียนช่างไม้ไปถึงปากหุบ'], check: s => n(s.frontier?.camp ? 1 : 0, 1) },
    { id: 'bounty', title: 'ปราบเป้าหมายใบประกาศจับ', action: 'quests', reward: { gold: 200 },
      why: 'สมาคมติดค่าหัวมอนหัวหน้าฝูงเป็นระยะ สมาชิกที่ออกล่าในเขตนั้นจะไปปราบเอง',
      how: ['ดูใบประกาศจับที่กระดานคำร้อง', 'ให้สมาชิกที่แข็งแรงออกล่าในเขตนั้น หรือออกไปเองในโหมดหัวหน้ากิลด์'], check: s => n(s.record?.bounties || 0, 1) },
    { id: 'camp2', title: 'ขยายค่ายแนวหน้าเป็นระดับ 2', action: 'upgrades', reward: { stone: 30 },
      why: 'ค่ายระดับ 2 รองรับภารกิจจู่โจมที่ส่งได้ถึง 6 คน', how: ['เมนู “กิลด์” → พัฒนากิลด์ → ค่ายแนวหน้า'], check: s => n(s.frontier?.camp || 0, 2) },
    { id: 'matriarch', title: 'ปราบแม่พญาไวเวิร์น', action: 'quest:matriarch', reward: { gold: 500 },
      why: 'ภารกิจจู่โจมแรก ส่งสองทีมรวม 6 คน', how: ['ให้สมาชิกสอบผ่านแรงค์ B อย่างน้อย 2 คน (ต้องมีสนามสอบระดับ 3)', 'มีสมาชิกอย่างน้อย 8 คน', 'ขยายค่ายแนวหน้าเป็นระดับ 2'], check: s => n(s.completedQuests.matriarch ? 1 : 0, 1) },
    { id: 'dragon', title: 'ราชันมังกรเพลิง (จบบทที่สอง)', action: 'quest:dragon', reward: { gold: 1000 },
      why: 'บทสุดท้ายของชายแดน ราชันมังกรพ่นไฟเป็นวงกว้าง ต้องมีคนรักษาและแทงค์', how: ['ส่งทีมจู่โจมที่ดีที่สุด', 'พกยาและอาหารไปด้วย'], check: s => n(s.completedQuests.dragon ? 1 : 0, 1) },
  ] },
];
export const GOAL_LIST = GOAL_CHAPTERS.flatMap(ch => ch.goals.map(g => ({ ...g, chapter: ch.id, chapterName: ch.name })));

/** Every objective with its progress; the first unclaimed one is "current". */
export function goalBoard(state, villageLevel = 1) {
  const view = { ...state, villageLevel }, claimed = state.mastery?.claimed || {};
  const list = GOAL_LIST.map(g => { const p = g.check(view); return { ...g, have: p.have, need: p.need, done: p.have >= p.need, claimed: Boolean(claimed[g.id]) }; });
  const current = list.find(g => !g.claimed) || null;
  return { list, current, claimable: list.filter(g => g.done && !g.claimed) };
}
export function claimGoal(state, id, villageLevel = 1) {
  const g = goalBoard(state, villageLevel).list.find(x => x.id === id);
  if (!g) return { ok: false, message: 'ไม่พบเป้าหมายนี้' };
  if (g.claimed) return { ok: false, message: 'รับรางวัลไปแล้ว' };
  if (!g.done) return { ok: false, message: `ยังไม่สำเร็จ (${g.have}/${g.need})` };
  state.mastery ??= { claimed: {} };
  state.mastery.claimed[id] = true;
  return { ok: true, reward: g.reward, message: `สำเร็จ: ${g.title}` };
}
export function sanitizeMastery(data) {
  const ids = new Set(GOAL_LIST.map(g => g.id));
  return { claimed: Object.fromEntries(Object.entries(data?.claimed || {}).filter(([id, v]) => ids.has(id) && v === true)) };
}
