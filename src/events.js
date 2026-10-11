/* The storyteller: small happenings, choices to make and big events, paced so they never pile up.
   Pure logic; game.js passes a context of its own helpers. */

const DAY = 240;
// Gaps in game seconds between beats. After a big event the village gets a quiet spell.
export const PACING = { firstMinor: 150, minor: [170, 290], firstDecision: 420, decision: [420, 660], firstMajor: 900, major: [1000, 1500], calmAfterMajor: 300, decisionWait: 300 };

const pick = (ctx, list) => list[Math.floor(ctx.random() * list.length) % list.length];
const span = (ctx, [a, b]) => a + ctx.random() * (b - a);
const RAID_SPECIES = [['leafSlime', 'hornHare'], ['hornHare', 'mossWolf'], ['mossWolf', 'acornBeetle'], ['pebbleCrab', 'crystalBat'], ['lanternGhost', 'mistWisp']];
const BOSSES = [{ rank: 'E', zone: 'woods', species: 'hollowKeeper' }, { rank: 'D', zone: 'hills', species: 'bellGuardian' }, { rank: 'C', zone: 'mist', species: 'heartGuardian' }];

/** Small happenings: a line in the news and a small nudge to the world. */
const MINOR = [
  { id: 'rain', icon: '🌧', weight: 3, run: ctx => { ctx.res('herb', 3); return 'ฝนตกพรำทั้งบ่าย แปลงสมุนไพรรอบหมู่บ้านงอกงาม (สมุนไพร +3)'; } },
  { id: 'bard', icon: '🎶', weight: 2, run: ctx => { ctx.moraleAll(5); return 'นักกวีพเนจรมาร้องเพลงหน้ากิลด์ ทุกคนที่อยู่บ้านอารมณ์ดีขึ้น'; } },
  { id: 'peddler', icon: '🛒', weight: 2, run: ctx => { const k = pick(ctx, ['wood', 'stone', 'herb']); ctx.market(k, 25); return `พ่อค้าเร่ขน${({ wood: 'ไม้', stone: 'หิน', herb: 'สมุนไพร' })[k]}มาขายในตลาด ราคาตกลงชั่วคราว`; } },
  { id: 'kids', icon: '🎁', weight: 2, run: ctx => { const g = 40 + Math.floor(ctx.random() * 50); ctx.gold(g, 'ของขวัญจากชาวบ้าน'); return `เด็ก ๆ เจอหีบเก่าริมลำธาร เอามามอบให้กิลด์ (${g} G)`; } },
  { id: 'lanterns', icon: '🏮', weight: 1, when: ctx => ctx.villageLevel() >= 2, run: ctx => { ctx.prosperity(30); ctx.moraleAll(3); return 'คืนโคมลอย ชาวบ้านจุดโคมริมถนน หมู่บ้านคึกคักขึ้น'; } },
  { id: 'shortage', icon: '📉', weight: 1, run: ctx => { ctx.market('herb', -999); return 'สมุนไพรขาดตลาด ราคาพุ่ง ใครมีสมุนไพรเก็บไว้ขายตอนนี้ได้ราคาดี'; } },
  { id: 'swarm', icon: '🐾', weight: 2, run: ctx => { const z = pick(ctx, ctx.openZones()); ctx.swarm(z, 4); return `ข่าวจากนักล่า: มอนที่${ctx.zoneName(z)}ชุกชุมกว่าปกติ`; } },
  { id: 'stranger', icon: '🍺', weight: 2, run: ctx => { return ctx.newFree() ? 'มีนักผจญภัยหน้าใหม่เดินทางมาลงทะเบียนกับกิลด์' : 'นักผจญภัยผ่านทางแวะดื่มที่โรงเตี๊ยม แต่ห้องพักเต็มเลยเดินทางต่อ'; } },
];

/** Choices: each option says what it costs and what it brings. `data` is filled when the event starts. */
const DECISIONS = [
  { id: 'poorFarmer', icon: '🌾', weight: 3, title: 'ชาวนาจ่ายไม่ไหว', text: d => `${d.client}ถูกหมูป่ารื้อแปลงผักจนเสียหาย แต่ไม่มีเงินจ้างกิลด์`,
    start: ctx => ({ client: pick(ctx, ['ลุงมั่น', 'ป้าบัว', 'ยายเย็น', 'พี่ต้นกล้า']) }),
    choices: [
      { id: 'free', label: 'ช่วยฟรี', desc: 'เงิน −40 (เสบียงทีม) · ชื่อเสียง +10 · หมู่บ้านรุ่งเรือง +25', apply: ctx => { ctx.gold(-40, 'ช่วยชาวนาโดยไม่คิดเงิน'); ctx.rep(10); ctx.prosperity(25); return 'ชาวบ้านเล่าต่อกันว่ากิลด์ไม่ทิ้งใคร'; } },
      { id: 'half', label: 'คิดครึ่งราคา', desc: 'เงิน +20 · ชื่อเสียง +4', apply: ctx => { ctx.gold(20, 'ค่าจ้างครึ่งราคาจากชาวนา'); ctx.rep(4); return 'ชาวนายิ้มทั้งน้ำตาและจ่ายเท่าที่มี'; } },
      { id: 'no', label: 'ปฏิเสธอย่างสุภาพ', desc: 'ไม่เสียอะไร · ขวัญสมาชิกที่บ้าน −3', apply: ctx => { ctx.moraleAll(-3); return 'สมาชิกบางคนมองตามชาวนาที่เดินกลับไปเงียบ ๆ'; } },
    ] },
  { id: 'quarrel', icon: '💢', weight: 2, title: 'สมาชิกทะเลาะกัน', when: ctx => ctx.homeMembers().length >= 2, text: d => `${d.a.name}กับ${d.b.name}ทะเลาะกันเรื่องใครเก็บหีบสมบัติ`,
    start: ctx => { const [a, b] = ctx.homeMembers().sort(() => ctx.random() - .5); return { a: { id: a.id, name: a.name }, b: { id: b.id, name: b.name } }; },
    choices: [
      { id: 'dinner', label: 'เลี้ยงข้าวคืนดี', desc: 'เงิน −60 · ทั้งคู่สนิทกันขึ้นมาก', apply: (ctx, d) => { ctx.gold(-60, 'มื้อคืนดีของสมาชิก'); ctx.bond(d.a.id, d.b.id, 15); ctx.morale(d.a.id, 6); ctx.morale(d.b.id, 6); return 'จบด้วยเสียงหัวเราะรอบโต๊ะอาหาร'; } },
      { id: 'spar', label: 'ให้ซ้อมดาบกันที่ลาน', desc: 'ทั้งคู่ได้ XP +40 · แรง −20', apply: (ctx, d) => { for (const p of [d.a, d.b]) { ctx.xp(p.id, 40); ctx.energy(p.id, -20); } ctx.bond(d.a.id, d.b.id, 6); return 'เหงื่อท่วมทั้งคู่ แต่ยอมรับฝีมือกันมากขึ้น'; } },
      { id: 'ignore', label: 'ปล่อยให้คุยกันเอง', desc: 'ขวัญทั้งคู่ −6', apply: (ctx, d) => { ctx.morale(d.a.id, -6); ctx.morale(d.b.id, -6); return 'บรรยากาศในกิลด์อึมครึมไปทั้งวัน'; } },
    ] },
  { id: 'lostAdventurer', icon: '🔦', weight: 2, title: 'นักผจญภัยหลงทาง', when: ctx => ctx.freeList().length >= 1, text: d => `เพื่อนของ${d.name}มาบอกว่าเขาหายไปที่${d.zone}ตั้งแต่เมื่อคืน`,
    start: ctx => { const f = pick(ctx, ctx.freeList()); return { id: f.id, name: f.name, zone: ctx.zoneName(pick(ctx, ctx.openZones())) }; },
    choices: [
      { id: 'search', label: 'ส่งคนออกตามหา', desc: 'เงิน −30 · ขวัญของเขา +15', apply: (ctx, d) => { ctx.gold(-30, 'ค่าคนตามหานักผจญภัย'); ctx.affinity(d.id, 45); return `${d.name}กลับมาอย่างปลอดภัย และซึ้งใจกิลด์มาก`; } },
      { id: 'wait', label: 'รอดูอีกสักวัน', desc: 'ไม่เสียอะไร', apply: (ctx, d) => `${d.name}เดินกลับมาเองในตอนเย็น เหนื่อยแต่ไม่เป็นไร` },
    ] },
  { id: 'treasureMap', icon: '🗺', weight: 2, title: 'พ่อค้าขายแผนที่ขุมทรัพย์', text: () => 'พ่อค้าแปลกหน้าบอกว่าแผนที่นี้พาไปถึงหีบโบราณ ราคา 150 G',
    choices: [
      { id: 'buy', label: 'ซื้อ (เสี่ยงดวง)', desc: 'เงิน −150 · 55% ได้ 420 G', apply: ctx => { ctx.gold(-150, 'ซื้อแผนที่ขุมทรัพย์'); if (ctx.random() < .55) { ctx.gold(420, 'ขุมทรัพย์ตามแผนที่'); return 'แผนที่เป็นของจริง! ทีมขุดเจอหีบเหรียญเก่า'; } return 'ขุดจนเย็นเจอแต่รากไม้ แผนที่ปลอมแน่นอน'; } },
      { id: 'pass', label: 'ไม่ซื้อ', desc: 'ไม่เสียอะไร', apply: () => 'พ่อค้ายักไหล่แล้วเดินไปเสนอโรงเตี๊ยมต่อ' },
    ] },
  { id: 'bridge', icon: '🌉', weight: 2, title: 'สะพานไม้ชำรุด', text: () => 'ผู้ใหญ่บ้านขอให้กิลด์ช่วยซ่อมสะพานข้ามลำธาร ไม่งั้นรถเสบียงผ่านไม่ได้',
    choices: [
      { id: 'fund', label: 'ออกค่าซ่อม', desc: 'เงิน −100 · ไม้ −10 · หมู่บ้านรุ่งเรือง +60 · ชื่อเสียง +6', when: ctx => ctx.has('wood', 10), apply: ctx => { ctx.gold(-100, 'ซ่อมสะพานหมู่บ้าน'); ctx.res('wood', -10); ctx.prosperity(60); ctx.rep(6); return 'ชาวบ้านช่วยกันตอกตะปูจนสะพานแข็งแรงกว่าเดิม'; } },
      { id: 'members', label: 'ส่งสมาชิกไปช่วยแรง', desc: 'สมาชิกที่บ้านแรง −25 · หมู่บ้านรุ่งเรือง +30', apply: ctx => { for (const m of ctx.homeMembers()) ctx.energy(m.id, -25); ctx.prosperity(30); return 'ทุกคนเหนื่อย แต่ได้ข้าวกล่องจากชาวบ้านกลับมา'; } },
      { id: 'no', label: 'ไม่ช่วย', desc: 'หมู่บ้านรุ่งเรือง −15', apply: ctx => { ctx.prosperity(-15); return 'รถเสบียงต้องอ้อมไกล ของในตลาดมาช้าลง'; } },
    ] },
  { id: 'apprentice', icon: '📖', weight: 2, title: 'เด็กหนุ่มขอเป็นศิษย์', when: ctx => ctx.homeMembers().some(m => m.level >= 3), text: d => `เด็กหนุ่มจากหมู่บ้านอยากเรียนวิชาจาก${d.name}`,
    start: ctx => { const m = ctx.homeMembers().filter(x => x.level >= 3).sort((a, b) => b.level - a.level)[0]; return { id: m.id, name: m.name }; },
    choices: [
      { id: 'teach', label: 'รับสอน', desc: 'ครูแรง −30 · แต้มผลงาน +12 · มีนักผจญภัยหน้าใหม่ที่ชื่นชมกิลด์มาลงทะเบียน', apply: (ctx, d) => { ctx.energy(d.id, -30); ctx.points(d.id, 12); ctx.newFree(50); return `${d.name}สอนจนค่ำ ศิษย์ใหม่ตั้งใจจะเข้ากิลด์สักวัน`; } },
      { id: 'later', label: 'ไว้คราวหน้า', desc: 'ไม่เสียอะไร', apply: () => 'เด็กหนุ่มรับปากว่าจะกลับมาใหม่' },
    ] },
  { id: 'rival', icon: '⚔', weight: 1, title: 'กิลด์คู่แข่งมาเปิดสาขา', when: ctx => ctx.rankIndex() >= 1, text: () => 'กิลด์จากเมืองใหญ่มาตั้งโต๊ะรับงานกลางตลาด เสนอค่าจ้างถูกกว่าเรา',
    choices: [
      { id: 'compete', label: 'จัดงานโชว์ฝีมือแข่ง', desc: 'เงิน −80 · ชื่อเสียง +14', apply: ctx => { ctx.gold(-80, 'งานโชว์ฝีมือของกิลด์'); ctx.rep(14); return 'ชาวบ้านมามุงดูสมาชิกเราจนตลาดแตก กิลด์คู่แข่งเก็บโต๊ะกลับไป'; } },
      { id: 'partner', label: 'ชวนร่วมมือ', desc: 'เงิน +120 · ชื่อเสียง −5', apply: ctx => { ctx.gold(120, 'ส่วนแบ่งจากกิลด์พันธมิตร'); ctx.rep(-5); return 'ตกลงแบ่งงานกัน เงินดีแต่บางคนว่าเราไม่มีจุดยืน'; } },
    ] },
];

/** Big events, never two at once, with a quiet spell after. */
const MAJOR = [
  { id: 'raid', icon: '🚨', weight: 3, title: 'มอนบุกหมู่บ้าน!', when: ctx => ctx.elapsed() > 600 },
  { id: 'celebrity', icon: '🌟', weight: 2, title: 'คนดังมาเยือน', when: ctx => ctx.rankIndex() >= 1 },
  { id: 'boss', icon: '👑', weight: 2, title: 'บอสโลกปรากฏ!', when: ctx => BOSSES.some(b => ctx.rankIndex() >= ['F', 'E', 'D', 'C'].indexOf(b.rank)) },
  { id: 'storm', icon: '⛈', weight: 2, title: 'พายุใหญ่กำลังมา', when: ctx => ctx.elapsed() > 900 },
];
const CELEBRITIES = [
  { name: 'เอลวิน อัศวินเงิน', line: 'อัศวินเงินผู้ปราบมังกรขาว เดินทางผ่านมาและอยากเห็นกิลด์ที่ชาวบ้านพูดถึง' },
  { name: 'มาดามลิเลีย', line: 'นักเวทชื่อดังจากหอคอยตะวันออก แวะพักระหว่างเดินทางไปเมืองหลวง' },
  { name: 'บารุก นักล่าค่าหัว', line: 'นักล่าค่าหัวอันดับหนึ่งของภาคเหนือ ตามล่ามอนตัวใหญ่มาถึงแถวนี้' },
];
const MAJOR_DECISIONS = {
  celebrity: { title: 'คนดังมาเยือน', text: d => `${d.name} — ${d.line}`,
    start: ctx => ({ ...pick(ctx, CELEBRITIES), famous: ctx.famousCandidate() }),
    choices: [
      { id: 'feast', label: 'จัดงานเลี้ยงต้อนรับ', desc: 'เงิน −120 · ชื่อเสียง +22 · ขวัญทุกคน +8 · คนดังที่ตามข่าวอาจมาสมัคร', apply: (ctx, d) => { ctx.gold(-120, 'งานเลี้ยงต้อนรับแขกคนดัง'); ctx.rep(22); ctx.moraleAll(8); if (d.famous) { ctx.addApplicant(d.famous); return `งานเลี้ยงคึกคัก ข่าวไปถึง${d.famousName}ซึ่งกำลังเดินทางมาที่กิลด์!`; } return 'แขกประทับใจ ชื่อกิลด์ดังไปถึงเมืองข้าง ๆ'; } },
      { id: 'lesson', label: 'ขอให้ช่วยสอนสมาชิก', desc: 'สมาชิกที่อยู่บ้าน XP +60 · ชื่อเสียง +6', apply: ctx => { for (const m of ctx.homeMembers()) ctx.xp(m.id, 60); ctx.rep(6); return 'ทั้งบ่ายเป็นคาบเรียนที่ทุกคนจำไปอีกนาน'; } },
      { id: 'greet', label: 'ต้อนรับตามปกติ', desc: 'ชื่อเสียง +5', apply: ctx => { ctx.rep(5); return 'แขกจิบชา ยิ้ม และออกเดินทางต่อ'; } },
    ] },
  storm: { title: 'พายุใหญ่กำลังมา', text: () => 'เมฆดำตั้งเค้าทางตะวันตก ชาวบ้านกังวลว่าบ้านริมทุ่งจะรับไม่ไหว',
    choices: [
      { id: 'shelter', label: 'เปิดกิลด์เป็นที่หลบภัย', desc: 'เงิน −80 (อาหาร) · หมู่บ้านรุ่งเรือง +50 · ชื่อเสียง +12', apply: ctx => { ctx.gold(-80, 'อาหารสำหรับผู้หลบพายุ'); ctx.prosperity(50); ctx.rep(12); ctx.recallHunters(); return 'คืนนั้นกิลด์เต็มไปด้วยชาวบ้าน เสียงเพลงกลบเสียงฟ้าร้อง'; } },
      { id: 'brace', label: 'ช่วยกันเสริมหลังคาบ้าน', desc: 'ไม้ −12 · สมาชิกที่บ้านแรง −20 · หมู่บ้านรุ่งเรือง +25', when: ctx => ctx.has('wood', 12), apply: ctx => { ctx.res('wood', -12); for (const m of ctx.homeMembers()) ctx.energy(m.id, -20); ctx.prosperity(25); ctx.recallHunters(); return 'บ้านทุกหลังรอดพายุ มีแค่ป้ายร้านปลิวไปหนึ่งป้าย'; } },
      { id: 'wait', label: 'ปิดประตูรอพายุผ่าน', desc: 'หมู่บ้านรุ่งเรือง −30', apply: ctx => { ctx.prosperity(-30); ctx.recallHunters(); return 'เช้ามาหลังคาหลายบ้านปลิว ชาวบ้านเริ่มซ่อมกันเอง'; } },
    ] },
};

export function createDirector() {
  return { nextMinor: PACING.firstMinor, nextDecision: PACING.firstDecision, nextMajor: PACING.firstMajor, calmUntil: 0, pending: null, active: null, alert: null, history: [] };
}
function chooseWeighted(ctx, list, history) {
  const recent = new Set(history.slice(0, 4).map(h => h.id));
  const pool = list.filter(e => !recent.has(e.id) && (!e.when || e.when(ctx)));
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let r = ctx.random() * total;
  for (const e of pool) { if (r < e.weight) return e; r -= e.weight; }
  return pool[0] || null;
}
function remember(d, id, title, icon, day, outcome = '') { d.history.unshift({ id, title, icon, day, outcome }); if (d.history.length > 14) d.history.length = 14; }
function openDecision(ctx, d, def, kind) {
  const data = def.start ? def.start(ctx) : {};
  if (data.famous) data.famousName = ctx.memberName(data.famous);
  d.pending = { id: def.id, kind, icon: def.icon || '❔', title: def.title, text: def.text(data), data, choices: def.choices.filter(c => !c.when || c.when(ctx)).map(c => ({ id: c.id, label: c.label, desc: c.desc })), expires: ctx.elapsed() + PACING.decisionWait };
  ctx.log(`${d.pending.icon} ${def.title} — มีเรื่องให้ตัดสินใจ`, 'event');
}

/** Advance the storyteller. It waits for the opening chapter and first patrol before starting. */
export function tickDirector(state, ctx) {
  const d = state.director, now = ctx.elapsed();
  if (!ctx.ready()) { d.nextMinor = Math.max(d.nextMinor, now + 60); d.nextDecision = Math.max(d.nextDecision, now + PACING.firstDecision * .5); d.nextMajor = Math.max(d.nextMajor, now + PACING.firstMajor * .6); return; }
  // An ongoing big event resolves itself.
  if (d.active) {
    if (d.active.id === 'raid') {
      const left = ctx.raidLeft();
      if (!left || now > d.active.until) { finishRaid(ctx, d, left); }
    } else if (d.active.id === 'boss' && (!ctx.bossAlive() || now > d.active.until)) {
      if (ctx.bossAlive()) { ctx.removeBoss(); ctx.log('บอสถอยกลับเข้าป่าลึก นักผจญภัยไม่ทันได้ปราบ', 'warning'); remember(d, 'boss', 'บอสโลก', '👑', ctx.day(), 'หนีไป'); }
      d.active = null; d.calmUntil = now + PACING.calmAfterMajor;
    }
  }
  // A choice left unanswered takes its last, gentlest option.
  if (d.pending && now > d.pending.expires) resolveDecision(state, ctx, d.pending.choices.at(-1).id, true);
  // The intel scout's warning runs out: the raid or the boss arrives as foretold.
  if (d.incoming && now >= d.incoming.at) { const ev = MAJOR.find(e => e.id === d.incoming.id); delete d.incoming; if (ev && !d.active) startMajor(state, ctx, d, ev); return; }
  if (now < d.calmUntil || d.incoming) return;
  if (!d.active && !d.pending && now >= d.nextMajor) {
    const ev = chooseWeighted(ctx, MAJOR, d.history);
    d.nextMajor = now + span(ctx, PACING.major); d.calmUntil = now + 60;
    d.nextMinor = Math.max(d.nextMinor, now + 90); d.nextDecision = Math.max(d.nextDecision, now + 240);
    const scout = ctx.scout?.() || 0;
    if (ev && scout && (ev.id === 'raid' || ev.id === 'boss')) {
      d.incoming = { id: ev.id, at: now + scout * 25 };
      if (ev.id === 'raid') ctx.recallHunters();
      ctx.log(`🦅 หน่วยข่าวรายงาน: ${ev.id === 'raid' ? 'ฝูงมอนกำลังมุ่งหน้ามาที่หมู่บ้าน' : 'บอสโลกกำลังตื่น'} จะถึงในอีก ${scout * 25} วินาที${ev.id === 'raid' ? ' เรียกนักผจญภัยกลับมาเตรียมตัวแล้ว' : ''}`, 'rank');
      ctx.alert({ icon: '🦅', title: 'หน่วยข่าวรายงาน', text: `${ev.id === 'raid' ? 'มอนบุก' : 'บอสโลก'}ในอีก ${scout * 25} วินาที`, watch: null });
    } else if (ev) startMajor(state, ctx, d, ev);
    return;
  }
  if (!d.pending && now >= d.nextDecision) {
    const ev = chooseWeighted(ctx, DECISIONS, d.history);
    d.nextDecision = now + span(ctx, PACING.decision);
    if (ev) openDecision(ctx, d, ev, 'decision');
    return;
  }
  if (now >= d.nextMinor) {
    const ev = chooseWeighted(ctx, MINOR, d.history);
    d.nextMinor = now + span(ctx, PACING.minor);
    if (ev) { const text = ev.run(ctx); ctx.log(`${ev.icon} ${text}`, 'event'); remember(d, ev.id, text, ev.icon, ctx.day()); }
  }
}
function startMajor(state, ctx, d, ev) {
  if (ev.id === 'raid') {
    const species = RAID_SPECIES[Math.min(RAID_SPECIES.length - 1, ctx.rankIndex())], count = 5 + ctx.rankIndex() * 2;
    ctx.spawnRaid(species, count);
    d.active = { id: 'raid', until: ctx.elapsed() + 240, total: count, reached: 0 };
    ctx.rally();
    ctx.log(`🚨 มอนบุกหมู่บ้าน! ${count} ตัวกำลังมาตามถนนฝั่งตะวันตก นักผจญภัยในเมืองออกไปป้องกัน`, 'rank');
    ctx.alert({ icon: '🚨', title: 'มอนบุกหมู่บ้าน!', text: 'นักผจญภัยในเมืองกำลังออกไปป้องกัน', watch: 'raid' });
  } else if (ev.id === 'boss') {
    const boss = [...BOSSES].reverse().find(b => ctx.rankIndex() >= ['F', 'E', 'D', 'C'].indexOf(b.rank));
    ctx.spawnBoss(boss.species, boss.zone);
    d.active = { id: 'boss', until: ctx.elapsed() + DAY * 1.5, zone: boss.zone };
    ctx.log(`👑 ${ctx.monsterName(boss.species)}ปรากฏที่${ctx.zoneName(boss.zone)}! นักผจญภัยที่แรงค์ถึงกำลังแห่ไปปราบ`, 'rank');
    ctx.alert({ icon: '👑', title: 'บอสโลกปรากฏ!', text: `${ctx.monsterName(boss.species)}ที่${ctx.zoneName(boss.zone)}`, watch: 'boss' });
  } else openDecision(ctx, d, { ...MAJOR_DECISIONS[ev.id], id: ev.id, icon: ev.icon }, 'major');
}
function finishRaid(ctx, d, left) {
  const a = d.active, won = !left && a.reached < Math.ceil(a.total / 2);
  if (left) ctx.removeRaid();
  if (won) { const g = 120 + ctx.rankIndex() * 60; ctx.gold(g, 'รางวัลป้องกันหมู่บ้านจากผู้ใหญ่บ้าน'); ctx.rep(15); ctx.prosperity(20); ctx.log(`🎉 ไล่มอนออกจากหมู่บ้านได้! ผู้ใหญ่บ้านมอบรางวัล ${g} G`, 'success'); remember(d, 'raid', 'มอนบุกหมู่บ้าน', '🚨', ctx.day(), 'ป้องกันสำเร็จ'); }
  else { ctx.log(`มอนบุกถึงหน้ากิลด์ ${a.reached} ตัว ร้านค้าเสียหาย หมู่บ้านต้องซ่อมแซม`, 'warning'); remember(d, 'raid', 'มอนบุกหมู่บ้าน', '🚨', ctx.day(), 'เสียหาย'); }
  d.active = null; d.calmUntil = ctx.elapsed() + PACING.calmAfterMajor;
}
/** A raider reached the guild door: damage, then it slinks away. */
export function raidReached(state, ctx) {
  const a = state.director?.active;
  if (a?.id === 'raid') a.reached += 1;
  ctx.prosperity(-15); ctx.gold(-20, 'ความเสียหายจากมอนบุก');
}
export function bossDefeated(state, ctx, name) {
  const d = state.director;
  const g = 200 + ctx.rankIndex() * 80;
  ctx.gold(g, 'รางวัลปราบบอสโลกจากสมาคม'); ctx.rep(25); ctx.prosperity(40);
  ctx.log(`👑 ปราบ${name}สำเร็จ! สมาคมกิลด์มอบรางวัล ${g} G`, 'success');
  ctx.alert({ icon: '🎉', title: `ปราบ${name}แล้ว!`, text: `รางวัล ${g} G · ชื่อเสียง +25` });
  remember(d, 'boss', `ปราบ${name}`, '👑', ctx.day(), 'สำเร็จ');
  d.active = null; d.calmUntil = ctx.elapsed() + PACING.calmAfterMajor;
}
export function resolveDecision(state, ctx, choiceId, auto = false) {
  const d = state.director, p = d.pending;
  if (!p) return { ok: false, message: 'ไม่มีเรื่องรอตัดสินใจ' };
  const def = p.kind === 'major' ? MAJOR_DECISIONS[p.id] : DECISIONS.find(e => e.id === p.id);
  const choice = def?.choices.find(c => c.id === choiceId);
  if (!choice || !p.choices.some(c => c.id === choiceId)) return { ok: false, message: 'ตัวเลือกไม่ถูกต้อง' };
  const outcome = choice.apply(ctx, p.data) || '';
  d.pending = null;
  if (p.kind === 'major') { d.calmUntil = ctx.elapsed() + PACING.calmAfterMajor; }
  remember(d, p.id, p.title, p.icon, ctx.day(), `${choice.label}${auto ? ' (ตามค่าเริ่มต้น)' : ''}`);
  ctx.log(`${p.icon} ${p.title}: ${choice.label} — ${outcome}`, 'event');
  return { ok: true, message: outcome };
}
export const EVENT_IDS = new Set([...MINOR, ...DECISIONS, ...MAJOR].map(e => e.id));
/** Rebuild the storyteller from a save, keeping only what still makes sense. */
export function sanitizeDirector(data, elapsed = 0) {
  const fresh = createDirector();
  if (!data || typeof data !== 'object') { fresh.nextMinor += elapsed; fresh.nextDecision += elapsed; fresh.nextMajor += elapsed; return fresh; }
  const num = (n, fallback) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n < 1e8 ? n : fallback;
  const text = (s, max = 200) => typeof s === 'string' && s.length <= max ? s : '';
  const plain = (v, depth = 0) => {
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string') return v.slice(0, 200);
    if (depth > 2 || typeof v !== 'object' || Array.isArray(v)) return null;
    return Object.fromEntries(Object.entries(v).slice(0, 12).map(([k, x]) => [k, plain(x, depth + 1)]));
  };
  const d = { nextMinor: num(data.nextMinor, elapsed + PACING.firstMinor), nextDecision: num(data.nextDecision, elapsed + PACING.firstDecision), nextMajor: num(data.nextMajor, elapsed + PACING.firstMajor), calmUntil: num(data.calmUntil, 0), pending: null, active: null, alert: null, history: [] };
  const p = data.pending;
  const def = p && (p.kind === 'major' ? MAJOR_DECISIONS[p.id] : p.kind === 'decision' ? DECISIONS.find(e => e.id === p.id) : null);
  if (def && Array.isArray(p.choices)) {
    const choices = p.choices.filter(c => c && def.choices.some(x => x.id === c.id)).map(c => ({ id: c.id, label: text(c.label, 60), desc: text(c.desc) }));
    if (choices.length) d.pending = { id: p.id, kind: p.kind, icon: text(p.icon, 4) || '❔', title: text(p.title, 60), text: text(p.text, 300), data: plain(p.data) || {}, choices, expires: num(p.expires, elapsed + PACING.decisionWait) };
  }
  const a = data.active;
  if (a && ['raid', 'boss'].includes(a.id)) d.active = { id: a.id, until: num(a.until, elapsed + 120), total: num(a.total, 1), reached: num(a.reached, 0), zone: text(a.zone, 20) };
  if (data.alert && typeof data.alert === 'object') d.alert = { icon: text(data.alert.icon, 4), title: text(data.alert.title, 80), text: text(data.alert.text), watch: ['raid', 'boss'].includes(data.alert.watch) ? data.alert.watch : null, until: num(data.alert.until, 0) };
  if (data.incoming && ['raid', 'boss'].includes(data.incoming.id)) d.incoming = { id: data.incoming.id, at: num(data.incoming.at, elapsed) };
  d.history = (Array.isArray(data.history) ? data.history : []).filter(h => h && EVENT_IDS.has(h.id)).slice(0, 14).map(h => ({ id: h.id, title: text(h.title), icon: text(h.icon, 4), day: num(h.day, 1), outcome: text(h.outcome, 120) }));
  return d;
}
