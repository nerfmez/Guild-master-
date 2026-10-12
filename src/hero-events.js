/* Encounters for the player-controlled guild master. Their own saved random stream
   keeps idle guild simulations unchanged; only time spent playing Hero advances them. */
import { HERO_BOUNDS } from './hero.js';
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const reward = (ctx, data) => ctx.reward(data);
const buff = (state, kind) => { state.hero.encounters.buffs = [{ kind, left: 30 }]; };
const toneNames = { funny: 'เรื่องปั่นข้างทาง', strange: 'เรื่องประหลาด', exciting: 'จังหวะลุ้น' };
const BUFFS = {
  tea: { name: 'ชาหกแต่ขาไว', speed: 1.25, power: 1, regen: 1 },
  cape: { name: 'ผ้าคลุมตากผ้า', speed: 1, power: 1.2, regen: 1 },
  mushroom: { name: 'จังหวะเห็ดดิสโก้', speed: 1.15, power: 1, regen: 1.5 },
};

export const HERO_ENCOUNTERS = [
  { id: 'gooseToll', tone: 'funny', icon: '♬', title: 'ห่านด่านตรวจเอกสาร',
    text: 'ห่านตัวหนึ่งขวางทางแล้วร้อง “ก๊าบ!” สามครั้ง ชาวบ้านแปลให้ว่า: ใบอนุญาตเป็นตัวเอกหมดอายุแล้ว ต้องต่อที่ห่านเท่านั้น',
    choices: [
      { id: 'honk', label: 'ก๊าบกลับอย่างมืออาชีพ', desc: 'ชื่อเสียง +2 · XP +8', run: (s, c) => { reward(c, { rep: 2, xp: 8 }); return 'คุณก๊าบสำเนียงราชการ ห่านประทับใจจนประทับตราด้วยรอยเท้า ชาวบ้านยกให้เป็นล่ามประจำหมู่บ้าน'; } },
      { id: 'pay', label: 'จ่ายค่าธรรมเนียมขนมปัง', cost: 10, desc: 'เงิน −10 G · ฟื้น HP 25', run: (s, c) => { reward(c, { hp: 25 }); return 'ห่านกินขนมปัง ส่วนคุณได้ขนมปังจากแม่ค้าผู้ขำจนมือสั่น ห่านยืนยันว่าไม่มีผลประโยชน์ทับซ้อน'; } },
    ] },
  { id: 'slimeUnion', tone: 'funny', icon: '◇', title: 'สไลม์ตั้งสหภาพ',
    text: 'สไลม์สองตัวถือป้าย “หยุดตีตอนพักเที่ยง” พวกมันยื่นข้อเรียกร้องให้เพิ่มเวลางีบ และเลิกเรียกว่าเยลลี่เดินได้',
    choices: [
      { id: 'talk', label: 'เซ็นข้อตกลงพักเที่ยง', desc: 'สมุนไพร +2 · ชื่อเสียง +1', run: (s, c) => { reward(c, { herb: 2, rep: 1 }); return 'สไลม์มอบสมุนไพรแทนลายเซ็น แล้วถามว่ากิลด์รับสมัครฝ่ายบุคคลที่ไม่มีบุคคลไหม'; } },
      { id: 'spar', label: 'ท้าดวลนอกเวลางาน', desc: 'สู้สไลม์ 2 ตัวใน 35 วิ · รางวัล 35 G และ XP +15', challenge: { kind: 'hunt', species: 'leafSlime', count: 2, seconds: 35, reward: { gold: 35, xp: 15 }, objective: 'ปราบสไลม์คู่เจรจากับทีมของคุณ', win: 'สไลม์ยอมรับผลดวล แล้วส่งใบเบิกโอทีมาให้คุณเซ็น', lose: 'สไลม์เลิกงานตรงเวลา คู่เจรจาเด้งกลับบ้านอย่างมีศักดิ์ศรี' } },
    ] },
  { id: 'teaSprint', tone: 'funny', icon: '♨', title: 'ชาเข้มจนรองเท้าสั่น',
    text: 'ลุงร้านชาท้าให้ชิมสูตร “ตื่นยันชาติหน้า” บนถ้วยเขียนว่าอ่อนโยน แต่ช้อนข้าง ๆ กำลังวิ่งวนเอง',
    choices: [
      { id: 'drink', label: 'ชนถ้วยกับลุง', desc: 'เดินเร็วขึ้น 25% นาน 30 วิ', run: s => { buff(s, 'tea'); return 'ชาไม่ได้ทำให้คุณตาสว่างอย่างเดียว ตอนนี้รองเท้าตื่นก่อนเจ้าของแล้ว'; } },
      { id: 'water', label: 'ขอน้ำเปล่าแบบไม่วิ่ง', desc: 'ฟื้น HP 20', run: (s, c) => { reward(c, { hp: 20 }); return 'ลุงบอกว่าสูตรนี้ปลอดภัย น้ำเปล่าส่ายหน้าเล็กน้อย แต่คุณเลือกเชื่อลุง'; } },
    ] },
  { id: 'laundryCape', tone: 'funny', icon: '⚑', title: 'ผ้าคลุมผู้กล้าหอมปรับผ้านุ่ม',
    text: 'ผ้าปูเตียงปลิวมาติดไหล่คุณพอดี เด็ก ๆ ตะโกนว่า “ฮีโร่มาแล้ว!” เจ้าของผ้าตะโกนว่า “ผ้าเพิ่งซัก!”',
    choices: [
      { id: 'pose', label: 'ขอใส่เท่สักครึ่งนาที', desc: 'โจมตีแรงขึ้น 20% นาน 30 วิ', run: s => { buff(s, 'cape'); return 'เจ้าของผ้าอนุญาตถ้าไม่เปื้อน คุณตั้งชื่อท่าว่า พลังหอมติดทนนาน'; } },
      { id: 'return', label: 'คืนผ้าแล้วช่วยตาก', desc: 'เงิน +15 G · ชื่อเสียง +2', run: (s, c) => { reward(c, { gold: 15, rep: 2 }); return 'ได้รับค่าช่วยตากผ้า เด็ก ๆ เรียกคุณว่า จอมยุทธ์ไม้หนีบผ้า'; } },
    ] },
  { id: 'mushroomDisco', tone: 'strange', icon: '♪', title: 'เห็ดดิสโก้ขอเพลง',
    text: 'วงเห็ดเรืองแสงเปิดฟลอร์กลางทาง DJ เห็ดบอกว่าเพลงต่อไปต้องมีคนเต้น ไม่งั้นสปอร์จะน้อยใจ',
    choices: [
      { id: 'dance', label: 'เต้นท่าที่ไม่มีใครขอ', desc: 'เดินเร็วขึ้น 15% · ฟื้น HP เร็วขึ้น 50% นาน 30 วิ', run: s => { buff(s, 'mushroom'); return 'ท่าของคุณประหลาดจนเห็ดปรับ BPM ไม่ทัน แต่ฟลอร์แตกจริง ๆ'; } },
      { id: 'clap', label: 'ปรบมือจากข้างเวที', desc: 'สมุนไพร +2 · XP +8', run: (s, c) => { reward(c, { herb: 2, xp: 8 }); return 'DJ แจกของที่ระลึกเป็นสมุนไพร ย้ำว่านี่ไม่ใช่หมวกของสมาชิกวง'; } },
    ] },
  { id: 'goblinAuction', tone: 'funny', icon: '◈', title: 'ประมูลกล่องที่ห้ามเขย่า',
    text: 'ก็อบลินขายกล่องสุ่มราคา 20 G ยืนยันว่าไม่มีมอนอยู่ข้างใน เสียงจากกล่องพูดว่า “ถูกต้องครับ”',
    choices: [
      { id: 'buy', label: 'ซื้อด้วยความมั่นใจที่ผิดที่', cost: 20, desc: 'เงิน −20 G · 50% ได้ 55 G · อีก 50% ได้สมุนไพร 1', run: (s, c) => { if (random(s.hero.encounters) < .5) { reward(c, { gold: 55 }); return 'กล่องมีเงิน 55 G จริง ๆ เสียงเมื่อกี้คือก็อบลินทำเสียงเอง ฝีมือขายของน่ากลัวกว่ามอน'; } reward(c, { herb: 1 }); return 'กล่องมีสมุนไพรหนึ่งต้นกับกระดาษ “ครั้งหน้าอาจรวย” อย่างน้อยกระดาษไม่ได้กัด'; } },
      { id: 'inspect', label: 'ถามว่ามีใบเสร็จไหม', desc: 'XP +6', run: (s, c) => { reward(c, { xp: 6 }); return 'ก็อบลินวิ่งหนีทันที คุณได้รับประสบการณ์การเป็นลูกค้าที่ร้านค้าไม่ต้องการ'; } },
    ] },
  { id: 'ghostHomework', tone: 'strange', icon: '☾', title: 'ผีลืมส่งการบ้าน',
    text: 'เงาเย็นเฉียบโผล่จากต้นไม้ “ช่วยด้วย… ข้าถูกสาป…” มันยื่นสมุดคณิตศาสตร์: 7 + 8 เท่าไร ครูจะตรวจในอีกสามร้อยปี',
    choices: [
      { id: 'fifteen', label: 'ตอบ 15 อย่างมั่นใจ', desc: 'เงิน +20 G · XP +12', run: (s, c) => { reward(c, { gold: 20, xp: 12 }); return 'ผีโล่งใจจนโปร่งใสกว่าเดิม มอบค่าติวแล้วขอตัวไปหลอกครูว่าเครื่องพิมพ์เสีย'; } },
      { id: 'seventyEight', label: 'ตอบ 78 เพราะเอามาต่อกัน', desc: 'ฟื้น HP 15 · XP +5', run: (s, c) => { reward(c, { hp: 15, xp: 5 }); return 'ผีหัวเราะจนลืมสาป อากาศรอบตัวอุ่นขึ้น มันบอกว่าจะไปลองถามครูศิลปะแทน'; } },
    ] },
  { id: 'talkingStone', tone: 'strange', icon: '◆', title: 'ก้อนหินอ่านอนาคต',
    text: 'ก้อนหินกระซิบว่า “อีกสามวินาทีเจ้าจะตัดสินใจเรื่องโง่ ๆ” จากนั้นเสนอให้ลูบหัวเพื่อลุ้นสมบัติ มันไม่มีหัวที่เห็นชัด',
    choices: [
      { id: 'rub', label: 'ลูบด้านที่น่าจะเป็นหัว', desc: '60% ได้ 40 G · อีก 40% เสีย HP 12 (ไม่ทำให้สลบ)', run: (s, c) => { if (random(s.hero.encounters) < .6) { reward(c, { gold: 40 }); return 'หินจามเหรียญออกมา แล้วบอกว่าอนาคตเปลี่ยนได้ถ้าเกาคางถูกที่'; } reward(c, { hp: -12 }); return 'คุณลูบเท้าหิน มันสะดุ้งแล้วกลิ้งทับปลายรองเท้า คำทำนายแม่นอย่างน่าหงุดหงิด'; } },
      { id: 'compliment', label: 'ชมว่ามันดูหนักแน่นดี', desc: 'หิน +2', run: (s, c) => { reward(c, { stone: 2 }); return 'หินเขินจนสะเก็ดหลุดสองก้อน ยืนยันว่าไม่ได้อาย แค่กัดเซาะตามธรรมชาติ'; } },
    ] },
  { id: 'lostCourier', tone: 'exciting', icon: '➶', title: 'พัสดุที่กำลังจาม',
    text: 'คนส่งของข้อเท้าพลิกฝากพัสดุไปยังจุดนัดหมายใกล้ ๆ “อย่าช้านะ ยาในกล่องจะจาม!” กล่องสั่นเหมือนกำลังกลั้นอยู่',
    choices: [
      { id: 'deliver', label: 'รับวิ่งส่งเอง', desc: 'ไปถึงจุดแสงใน 35 วิ · รางวัล 40 G และ XP +18', challenge: { kind: 'reach', seconds: 35, range: 9, reward: { gold: 40, xp: 18 }, objective: 'นำพัสดุไปถึงจุดแสง', win: 'ส่งทันก่อนกล่องจาม! ผู้รับบอกว่านี่คือยารักษาอาการจามของกล่อง', lose: 'ส่งไม่ทัน คนส่งของมารับไปเอง กล่องจามจนใบเสร็จปลิว ไม่มีใครหักค่าปรับคุณ' } },
      { id: 'splint', label: 'ช่วยหาไม้ดามข้อเท้าแทน', desc: 'ชื่อเสียง +2', run: (s, c) => { reward(c, { rep: 2 }); return 'ช่วยคนส่งของเดินต่อได้ เขายิ้มขอบคุณ ส่วนพัสดุบอก “ฮัดชิ่ว” เบา ๆ'; } },
    ] },
  { id: 'fallingStar', tone: 'exciting', icon: '✦', title: 'ดาวตกลงผิดที่',
    text: 'ดาวดวงเล็กตกลงใกล้ ๆ มีเสียงประกาศจากฟ้าว่า “ของหล่น ใครเก็บได้เอาไปเลย แต่เราจะดูดกลับในสามสิบวินาที”',
    choices: [
      { id: 'chase', label: 'วิ่งตามแสงดาว!', desc: 'ไปถึงจุดแสงใน 30 วิ · ได้หีบไม้และ XP +20', challenge: { kind: 'reach', seconds: 30, range: 11, reward: { chest: 'wood', xp: 20 }, objective: 'เก็บดาวก่อนถูกดูดกลับ', win: 'คว้าดาวทัน! มันกลายเป็นหีบไม้ ท้องฟ้าขอให้คุณอย่าให้คะแนนบริการแค่ดาวเดียว', lose: 'ดาวถูกดูดกลับฟ้าพร้อมเสียง “ขออภัยในความไม่สะดวก” คุณยังมีรองเท้าครบคู่' } },
      { id: 'wish', label: 'ขอพรให้เข่าไม่ลั่น', desc: 'ฟื้น HP 30', run: (s, c) => { reward(c, { hp: 30 }); return 'ดาวกะพริบรับคำขอ เข่าของคุณเงียบลง ส่วนกระเป๋าเงินยังเงียบเหมือนเดิม'; } },
    ] },
  { id: 'echoDuel', tone: 'exciting', icon: '⚔', title: 'เงาท้าดวลแต่จำท่าไม่ได้',
    text: 'เงาของคุณหลุดออกมาท้าดวล มันแปลงเป็นเห็ดนักสู้แล้วถามว่า “ท่าฟันหมุนกดปุ่มไหนนะ?” นี่เป็นโอกาสก่อนมันอ่านคู่มือจบ',
    choices: [
      { id: 'duel', label: 'ดวลก่อนมันจำปุ่มได้', desc: 'ปราบเงา 1 ตัวใน 40 วิ · รางวัล 45 G และ XP +25', challenge: { kind: 'hunt', species: 'mushHopper', count: 1, seconds: 40, reward: { gold: 45, xp: 25 }, objective: 'ปราบเงานักสู้กับทีมของคุณ', win: 'เงาขอยอมแพ้ แล้วกลับมาติดเท้าคุณพร้อมบ่นว่าเกมนี้ไม่มีปุ่มง่ายกว่านี้หรือ', lose: 'เงากลับมาติดเท้าเพราะอ่านคู่มือไม่เข้าใจ ถือว่าเสมอแบบไม่มีกรรมการ' } },
      { id: 'pose', label: 'ท้าประกวดท่ายืนเท่แทน', desc: 'XP +10 · ชื่อเสียง +1', run: (s, c) => { reward(c, { xp: 10, rep: 1 }); return 'เงาทำท่าเดียวกับคุณทุกครั้ง กรรมการให้เสมอ แต่ชาวบ้านยกให้คุณชนะเพราะมีสี'; } },
    ] },
  { id: 'honeyAlarm', tone: 'exciting', icon: '!', title: 'สัญญาณเตือนขโมยน้ำผึ้ง',
    text: 'ผึ้งสามตัวเข้าใจว่าคุณเป็นโจร เพราะเสื้อสีเดียวกับป้ายผู้ต้องสงสัย เจ้าของสวนขอให้ช่วยหยุดพวกมันโดยไม่ทำต้นชาเสียหาย',
    choices: [
      { id: 'fight', label: 'ใช้ฝีมือเคลียร์ความเข้าใจผิด', desc: 'สู้ผึ้ง 3 ตัวใน 45 วิ · รางวัล 45 G และสมุนไพร +3', challenge: { kind: 'hunt', species: 'fuzzBee', count: 3, seconds: 45, reward: { gold: 45, herb: 3 }, objective: 'ปราบผึ้งทั้งสามกับทีมของคุณ', win: 'ผึ้งเลิกไล่ เจ้าของสวนแจกค่าขอโทษและรับปากว่าจะวาดป้ายผู้ต้องสงสัยให้ชัดกว่านี้', lose: 'คนสวนเป่านกหวีดเรียกผึ้งกลับรัง ป้ายใหม่เขียนว่า “อย่าจับคนจากสีเสื้อ”' } },
      { id: 'explain', label: 'ชูใบเสร็จร้านน้ำผึ้ง', desc: 'ฟื้น HP 20 · ชื่อเสียง +1', run: (s, c) => { reward(c, { hp: 20, rep: 1 }); return 'ผึ้งอ่านใบเสร็จแล้วผงกหัว คนสวนยอมรับว่าแผนกสืบสวนของสวนยังต้องอบรม'; } },
    ] },
  { id: 'fakeBoss', tone: 'funny', icon: '♛', title: 'บอสประจำซอยเพิ่งเปิดตัว',
    text: 'กระต่ายใส่มงกุฎกระดาษตะโกนว่า “ข้าคือภัยพิบัติ!” เสียงเด็กหลังพุ่มไม้กระซิบ “อย่าลืมประโยคที่ซ้อมสิ”',
    choices: [
      { id: 'act', label: 'เล่นบทผู้กล้าประกอบฉาก', desc: 'ดวลกระต่าย 1 ตัวใน 30 วิ · รางวัล 25 G และ XP +12', challenge: { kind: 'hunt', species: 'hornHare', count: 1, seconds: 30, reward: { gold: 25, xp: 12 }, objective: 'ชนะบอสกระดาษกับทีมของคุณ', win: 'บอสล้มอย่างสมศักดิ์ศรี เด็ก ๆ ปรบมือแล้วขอจองคุณเล่นภาคสอง', lose: 'ผู้กำกับสั่งคัต กระต่ายลืมบทและวิ่งไปกินหญ้าแทน ไม่มีการเรียกเก็บค่าถ่ายซ่อม' } },
      { id: 'audience', label: 'เป็นผู้ชมแถวหน้า', desc: 'ฟื้น HP 15 · ชื่อเสียง +1', run: (s, c) => { reward(c, { hp: 15, rep: 1 }); return 'เด็กแจกขนมและที่นั่ง VIP บอสกระดาษแพ้ลมก่อนถึงฉากสุดท้าย'; } },
    ] },
  { id: 'umbrellaOracle', tone: 'strange', icon: '☂', title: 'พยากรณ์อากาศจากร่มพูดได้',
    text: 'ร่มลอยได้พยากรณ์ว่า “วันนี้ฝนเหรียญ 0% แต่ถ้าเดินไปทางนั้นอาจมีของหล่น 100%” มันชี้ด้วยด้ามอย่างสุภาพ',
    choices: [
      { id: 'follow', label: 'ตามคำพยากรณ์', desc: 'ไปถึงจุดแสงใน 35 วิ · ได้ 30 G และไม้ +3', challenge: { kind: 'reach', seconds: 35, range: 8, reward: { gold: 30, wood: 3 }, objective: 'หาของหล่นตามที่ร่มชี้', win: 'เจอถุงเหรียญกับไม้ที่มีคนฝากไว้ ร่มกระซิบว่าอาชีพเสริมของมันคือพนักงานส่งของ', lose: 'ร่มเปลี่ยนคำพยากรณ์เป็น “ของหล่นถูกเก็บแล้ว 100%” แล้วแกล้งหุบตัว' } },
      { id: 'forecast', label: 'ถามโอกาสฝนตกในใจ', desc: 'XP +8', run: (s, c) => { reward(c, { xp: 8 }); return 'ร่มเปิดตัวเต็มที่แล้วพูด “พกเราไว้ดีกว่า” คุณเพิ่งเจอการขายตรงที่มีมารยาทที่สุด'; } },
    ] },
];
const definitions = new Map(HERO_ENCOUNTERS.map(e => [e.id, e]));

export function createHeroEncounters(seed = 1) {
  return { rng: (seed >>> 0) || 1, nextIn: 24, travel: 0, killsAtLast: 0, serial: 0, recent: [], history: [], pending: null, challenge: null, buffs: [] };
}
function random(e) { e.rng = (Math.imul(e.rng, 1664525) + 1013904223) >>> 0; return e.rng / 4294967296; }
export function heroEncounterModifiers(hero) {
  const result = { speed: 1, power: 1, regen: 1 };
  for (const b of hero.encounters?.buffs || []) if (b.left > 0 && BUFFS[b.kind]) for (const key of Object.keys(result)) result[key] *= BUFFS[b.kind][key];
  return result;
}
function remember(state, ctx, def, outcome) {
  const e = state.hero.encounters;
  e.history.unshift({ id: def.id, day: state.day, outcome }); e.history.length = Math.min(e.history.length, 16);
  ctx.log(`${def.icon} ${def.title} — ${outcome}`, 'event');
}
function resetPacing(hero) {
  const e = hero.encounters; e.nextIn = 65 + random(e) * 50; e.travel = 0; e.killsAtLast = hero.kills;
}
function removeChallengeMonsters(state) {
  const ids = new Set(state.hero.encounters.challenge?.monsterIds || []);
  state.world.monsters = state.world.monsters.filter(m => !ids.has(m.id));
}
function finishChallenge(state, ctx, won, reason = '') {
  const e = state.hero.encounters, challenge = e.challenge, def = definitions.get(challenge.eventId);
  const choice = def.choices.find(c => c.id === challenge.choiceId);
  removeChallengeMonsters(state); e.challenge = null;
  if (won) reward(ctx, { ...choice.challenge.reward, from: def.title });
  const outcome = reason || (won ? choice.challenge.win : choice.challenge.lose);
  e.notice = { eventId: def.id, outcome, won, left: 12 };
  remember(state, ctx, def, outcome);
}
export function cancelHeroEncounters(state, ctx) {
  const e = state.hero.encounters; if (!e) return;
  if (e.challenge) finishChallenge(state, ctx, false, 'กลับกิลด์ก่อนจบเหตุการณ์ · ไม่เสียค่าปรับ');
  e.pending = null; e.buffs = []; delete e.notice; delete e.lastX; delete e.lastY;
}
export function recordHeroEncounterKill(hero, monster) {
  const c = hero.encounters?.challenge;
  if (c?.kind === 'hunt' && c.monsterIds.includes(monster.id) && !c.defeated.includes(monster.id)) c.defeated.push(monster.id);
}
export function tickHeroEncounters(state, ctx, dt) {
  const hero = state.hero; if (!hero) return;
  if (!hero.active) { const e = hero.encounters; if (e && (e.pending || e.challenge || e.buffs.length || e.notice)) cancelHeroEncounters(state, ctx); return; }
  const e = hero.encounters ??= createHeroEncounters(state.seed + 37);
  if (hero.down > 0) { if (e.challenge) finishChallenge(state, ctx, false, 'ชาวบ้านหามกลับกิลด์แล้ว · เหตุการณ์ยุติ ไม่มีค่าปรับ'); e.pending = null; e.lastX = hero.x; e.lastY = hero.y; return; }
  for (const b of e.buffs) b.left = Math.max(0, b.left - dt); e.buffs = e.buffs.filter(b => b.left > 0);
  if (e.notice) { e.notice.left -= dt; if (e.notice.left <= 0) delete e.notice; }
  if (Number.isFinite(e.lastX)) e.travel += Math.min(distance(hero, { x: e.lastX, y: e.lastY }), 12 * dt);
  e.lastX = hero.x; e.lastY = hero.y;
  if (e.challenge) {
    const c = e.challenge; c.left = Math.max(0, c.left - dt);
    const won = c.kind === 'reach' ? distance(hero, c.goal) <= 1.2 : c.defeated.length >= c.monsterIds.length;
    if (won) finishChallenge(state, ctx, true);
    else if (c.left <= 0 || (c.kind === 'hunt' && c.monsterIds.some(id => !c.defeated.includes(id) && !state.world.monsters.some(m => m.id === id && !m.dead)))) finishChallenge(state, ctx, false);
    return;
  }
  if (e.pending) return;
  e.nextIn = Math.max(0, e.nextIn - dt);
  if (e.nextIn > 0 || (state.heroCall && (state.heroCall.step !== 'done' || state.heroCall.report)) || hero.carry || (e.travel < 10 && hero.kills <= e.killsAtLast) || state.director?.pending || state.director?.active || state.director?.incoming) return;
  // Give the player a breath between fights, never cover an incoming attack with a choice.
  if (state.world.monsters.some(m => !m.dead && distance(m, hero) < 4.5)) return;
  const last = definitions.get(e.recent[0]);
  const pool = HERO_ENCOUNTERS.filter(def => !e.recent.slice(0, 3).includes(def.id) && def.tone !== last?.tone);
  const def = pool[Math.floor(random(e) * pool.length)];
  e.pending = { id: def.id, serial: ++e.serial }; e.recent.unshift(def.id); e.recent.length = Math.min(6, e.recent.length);
  resetPacing(hero);
  ctx.log(`${def.icon} ${def.title} — หัวหน้ากิลด์เจอเรื่องระหว่างเดินทาง`, 'event');
}
export function resolveHeroEncounter(state, ctx, choiceId) {
  const hero = state.hero, e = hero?.encounters;
  if (!hero?.active || hero.down > 0 || !e?.pending) return { ok: false, message: 'ไม่มีเหตุการณ์ Hero รอตัดสินใจ' };
  const def = definitions.get(e.pending.id);
  if (choiceId === 'leave') { e.pending = null; remember(state, ctx, def, 'เดินต่ออย่างปลอดภัย ไม่เสียอะไร'); return { ok: true, message: 'คุณเดินต่อ เรื่องนี้เอาไว้เล่าตอนกลับกิลด์' }; }
  const choice = def.choices.find(c => c.id === choiceId);
  if (!choice) return { ok: false, message: 'ตัวเลือกไม่ถูกต้อง' };
  if (choice.cost && state.gold < choice.cost) return { ok: false, message: `เงินกิลด์ไม่พอ ต้องใช้ ${choice.cost} G` };
  if (choice.cost) ctx.pay(choice.cost, def.title);
  e.pending = null;
  if (!choice.challenge) { const message = choice.run(state, ctx); remember(state, ctx, def, message); return { ok: true, message }; }
  const spec = choice.challenge;
  const bounds = ctx.bounds || { ...HERO_BOUNDS, x1: HERO_BOUNDS.westOnly };
  const challenge = { eventId: def.id, choiceId: choice.id, kind: spec.kind, left: spec.seconds, monsterIds: [], defeated: [] };
  if (spec.kind === 'reach') {
    const angle = random(e) * Math.PI * 2;
    challenge.goal = { x: clamp(hero.x + Math.cos(angle) * spec.range, bounds.x0 + 2, bounds.x1 - 2), y: clamp(hero.y + Math.sin(angle) * spec.range, bounds.y0 + 2, bounds.y1 - 2) };
  } else for (let i = 0; i < spec.count; i++) {
    const angle = i * Math.PI * 2 / spec.count, at = { x: clamp(hero.x + Math.cos(angle) * 2.8, bounds.x0 + 1, bounds.x1 - 1), y: clamp(hero.y + Math.sin(angle) * 2.8, bounds.y0 + 1, bounds.y1 - 1) };
    challenge.monsterIds.push(ctx.spawn(spec.species, at, def.id));
  }
  e.challenge = challenge;
  return { ok: true, message: `${spec.objective} · ${spec.seconds} วินาที` };
}
export function abandonHeroChallenge(state, ctx) {
  if (!state.hero?.active || !state.hero.encounters?.challenge) return { ok: false, message: 'ไม่มีภารกิจย่อย Hero' };
  finishChallenge(state, ctx, false, 'ขอถอนตัวจากเหตุการณ์ · ไม่เสียค่าปรับ');
  return { ok: true, message: 'ถอนตัวแล้ว เดินสำรวจต่อได้เลย' };
}
export function heroEncounterView(state) {
  const hero = state.hero, e = hero?.encounters;
  if (!hero?.active || !e) return null;
  const def = definitions.get(e.pending?.id);
  const pending = def ? { ...e.pending, title: def.title, text: def.text, icon: def.icon, tone: toneNames[def.tone], choices: [...def.choices.map(c => ({ id: c.id, label: c.label, desc: c.desc, disabled: Boolean(c.cost && state.gold < c.cost) })), { id: 'leave', label: 'เดินต่อก่อน', desc: 'ไม่เสียอะไร · ข้ามเหตุการณ์นี้' }] } : null;
  const challenge = e.challenge, activeDef = definitions.get(challenge?.eventId), choice = activeDef?.choices.find(c => c.id === challenge.choiceId);
  const notice = e.notice && definitions.has(e.notice.eventId) ? { ...e.notice, title: definitions.get(e.notice.eventId).title } : null;
  return { pending, notice, challenge: choice ? { ...challenge, title: activeDef.title, icon: activeDef.icon, objective: choice.challenge.objective, need: choice.challenge.count || 1, have: challenge.kind === 'hunt' ? challenge.defeated.length : 0, distance: challenge.goal ? distance(hero, challenge.goal) : null } : null, buffs: e.buffs.filter(b => b.left > 0 && BUFFS[b.kind]).map(b => ({ ...b, name: BUFFS[b.kind].name })) };
}

export function sanitizeHeroEncounters(data, hero, monsters = []) {
  const fresh = createHeroEncounters(); if (!data || typeof data !== 'object') return fresh;
  const number = (v, lo, hi, fallback) => Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
  fresh.rng = Number.isInteger(data.rng) ? (data.rng >>> 0) || 1 : 1;
  fresh.nextIn = number(data.nextIn, 0, 115, 24); fresh.travel = number(data.travel, 0, 1000, 0);
  fresh.killsAtLast = number(data.killsAtLast, 0, hero.kills, hero.kills); fresh.serial = Math.floor(number(data.serial, 0, 1e9, 0));
  fresh.recent = (Array.isArray(data.recent) ? data.recent : []).filter(id => definitions.has(id)).slice(0, 6);
  fresh.history = (Array.isArray(data.history) ? data.history : []).filter(h => h && definitions.has(h.id)).slice(0, 16).map(h => ({ id: h.id, day: Math.floor(number(h.day, 1, 1e7, 1)), outcome: String(h.outcome || '').slice(0, 300) }));
  if (!hero.active) return fresh;
  if (definitions.has(data.notice?.eventId) && Number.isFinite(data.notice.left) && data.notice.left > 0) fresh.notice = { eventId: data.notice.eventId, outcome: String(data.notice.outcome || '').slice(0, 300), won: Boolean(data.notice.won), left: Math.min(12, data.notice.left) };
  fresh.buffs = (Array.isArray(data.buffs) ? data.buffs : []).filter(b => b && BUFFS[b.kind] && Number.isFinite(b.left) && b.left > 0).slice(0, 1).map(b => ({ kind: b.kind, left: Math.min(30, b.left) }));
  if (definitions.has(data.pending?.id)) fresh.pending = { id: data.pending.id, serial: fresh.serial };
  const c = data.challenge, choice = definitions.get(c?.eventId)?.choices.find(x => x.id === c.choiceId && x.challenge);
  if (choice && !fresh.pending && Number.isFinite(c.left) && c.left > 0) {
    const spec = choice.challenge, validGoal = c.goal && Number.isFinite(c.goal.x) && Number.isFinite(c.goal.y) && c.goal.x >= HERO_BOUNDS.x0 && c.goal.x <= HERO_BOUNDS.x1 && c.goal.y >= HERO_BOUNDS.y0 && c.goal.y <= HERO_BOUNDS.y1;
    const ids = (Array.isArray(c.monsterIds) ? c.monsterIds : []).filter(id => typeof id === 'string').slice(0, spec.count || 0);
    const defeated = [...new Set((Array.isArray(c.defeated) ? c.defeated : []).filter(id => ids.includes(id)))];
    if (spec.kind === 'reach' ? validGoal : ids.length === spec.count && new Set(ids).size === ids.length && ids.every(id => defeated.includes(id) || monsters.some(m => m.id === id && m.heroEncounter === c.eventId && m.species === spec.species && !m.dead))) {
      fresh.challenge = { eventId: c.eventId, choiceId: c.choiceId, kind: spec.kind, left: Math.min(spec.seconds, c.left), monsterIds: ids, defeated, ...(spec.kind === 'reach' ? { goal: { x: c.goal.x, y: c.goal.y } } : {}) };
    }
  }
  return fresh;
}
