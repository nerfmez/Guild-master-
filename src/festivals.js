/* Festivals: the guild master picks a festival the village has a building for, sets the prize money and an item,
   and the whole village comes out. A tournament is an eight-fighter knockout played out match by match;
   the harvest fair turns the budget into prosperity; the lantern festival lifts every heart in the guild.
   Pure module: game.js passes a small context of its own helpers. */
import { FESTIVALS, ROOKIE_NAMES, JOBS } from './content.js';

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const VISITOR_TOWNS = ['เมืองท่าคลื่นคราม', 'นครหินเงิน', 'หมู่บ้านใบไผ่', 'ป้อมลมหนาว', 'เมืองหลวง'];
const VISITOR_NAMES = ['กาเรน', 'ไอริส', 'ทอร์ก', 'ซาฟิร่า', 'โรวัน', 'เมลดา', 'คาอิ', 'ลีโอน่า', 'บรันโด', 'ยูน่า'];
const FARMS = ['ไร่ลุงมั่น', 'สวนป้าบัว', 'ไร่ฟักทองยักษ์', 'สวนชาริมธาร', 'ไร่ข้าวโพดหวาน'];

export function createFestivals() { return { live: null, ready: {}, history: [], held: 0 }; }

/** Can the guild hold this festival now? */
export function festivalStatus(state, ctx, kind) {
  const f = FESTIVALS[kind]; if (!f) return { ok: false, reason: 'ไม่มีเทศกาลนี้' };
  const level = ctx.building(f.building), fest = state.festivals;
  if (level < f.level) return { ok: false, reason: `ต้องสร้าง${ctx.buildingName(f.building)}ในหมู่บ้านก่อน`, level };
  if (fest.live) return { ok: false, reason: `กำลังจัด${FESTIVALS[fest.live.kind].name}อยู่`, level };
  const wait = Math.max(0, Math.ceil((fest.ready[kind] || 0) - state.elapsed));
  if (wait) return { ok: false, reason: `จัดได้อีกครั้งในอีก ${wait} วินาที`, level, wait };
  return { ok: true, reason: '', level };
}
/** Visitors drawn in: the bigger the prize and the village, the bigger the crowd. */
export function festivalVisitors(state, ctx, kind, gold, itemValue = 0) {
  const f = FESTIVALS[kind]; if (!f) return 0;
  return Math.round(10 + (gold + itemValue) / 25 + ctx.building(f.building) * 8 + ctx.villageLevel() * 4);
}

function fighterFromMember(ctx, member) { return { id: member.id, kind: 'member', name: member.name, cls: member.class, power: ctx.power(member) }; }
function seedBracket(state, ctx, live, memberIds) {
  const r = ctx.random, fighters = [];
  for (const id of memberIds) { const m = state.members.find(x => x.id === id); if (m) fighters.push(fighterFromMember(ctx, m)); }
  const avg = fighters.length ? fighters.reduce((s, x) => s + x.power, 0) / fighters.length : ctx.guildPower();
  // Famous fighters from other towns come when the purse is worth the trip.
  const famous = live.gold >= 1500 ? 3 : live.gold >= 700 ? 2 : live.gold >= 300 ? 1 : 0;
  for (let i = 0; i < famous && fighters.length < 8; i++) {
    const cls = ['warrior', 'archer', 'mage', 'healer'][Math.floor(r() * 4)];
    fighters.push({ id: `visitor-${i}`, kind: 'famous', name: `${VISITOR_NAMES[Math.floor(r() * VISITOR_NAMES.length)]}แห่ง${VISITOR_TOWNS[Math.floor(r() * VISITOR_TOWNS.length)]}`, cls, power: Math.round(avg * (1.05 + r() * .35) + live.gold / 120) });
  }
  for (const f of ctx.freeFighters(8 - fighters.length)) fighters.push({ id: f.id, kind: 'free', name: f.name, cls: f.class, power: f.power });
  while (fighters.length < 8) { const cls = ['warrior', 'archer', 'mage', 'healer'][Math.floor(r() * 4)]; fighters.push({ id: `local-${fighters.length}`, kind: 'local', name: ROOKIE_NAMES[Math.floor(r() * ROOKIE_NAMES.length)], cls, power: Math.round(avg * (.6 + r() * .35)) }); }
  // Shuffle the draw, then play every match now so the screens can reveal them one by one.
  for (let i = fighters.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [fighters[i], fighters[j]] = [fighters[j], fighters[i]]; }
  const matches = [], slot = live.length / 7;
  let round = fighters.map((_, i) => i), k = 0;
  for (let stage = 0; round.length > 1; stage++) {
    const next = [];
    for (let i = 0; i < round.length; i += 2) {
      const a = fighters[round[i]], b = fighters[round[i + 1]], pa = a.power ** 2 / (a.power ** 2 + b.power ** 2), win = r() < pa ? round[i] : round[i + 1];
      // How the fight looked: the loser's last hit point is gone; the winner keeps what the gap allows.
      const margin = clamp(Math.abs(pa - .5) * 2 + r() * .3, .08, .9);
      matches.push({ a: round[i], b: round[i + 1], winner: win, stage, at: live.open + k * slot, left: Math.round(margin * 100) });
      next.push(win); k++;
    }
    round = next;
  }
  live.fighters = fighters; live.matches = matches; live.champion = round[0];
}

/** Open a festival: the guild pays the purse now (it is held until the prize-giving). */
export function startFestival(state, ctx, payload) {
  const kind = payload.kind, f = FESTIVALS[kind], st = festivalStatus(state, ctx, kind);
  if (!st.ok) return { ok: false, message: st.reason };
  const gold = Math.round(Number(payload.gold) || 0);
  if (gold < f.minGold || gold > f.maxGold) return { ok: false, message: `เงินรางวัลต้องอยู่ระหว่าง ${f.minGold}–${f.maxGold} G` };
  if (state.gold < gold) return { ok: false, message: 'เงินกิลด์ไม่พอสำหรับเงินรางวัล' };
  const item = payload.item ? ctx.takeItem(payload.item) : null;
  if (payload.item && !item) return { ok: false, message: 'ไม่มีของรางวัลชิ้นนั้นในคลังแล้ว' };
  const members = kind === 'tournament' ? [...new Set(payload.memberIds || [])].filter(id => ctx.canEnter(id)).slice(0, 4) : [];
  ctx.pay(gold, `เงินรางวัล${f.name}`);
  const now = state.elapsed;
  const live = { kind, gold, item, start: now, open: now + f.prep, end: now + f.prep + f.length, length: f.length, visitors: festivalVisitors(state, ctx, kind, gold, item?.value || 0), members };
  if (kind === 'tournament') { seedBracket(state, ctx, live, members); for (const id of members) ctx.enter(id, live.end); }
  if (kind === 'harvest') { const r = ctx.random; live.farms = FARMS.map(name => ({ name, score: Math.round(40 + r() * 60) })).sort((a, b) => b.score - a.score); }
  state.festivals.live = live;
  ctx.log(`ประกาศ${f.name}! รางวัล ${gold} G${item ? ' และ' + item.name : ''} · เริ่มในอีก ${f.prep} วินาที`, 'cozy');
  return { ok: true, message: `ประกาศ${f.name}แล้ว ชาวบ้านกำลังมารวมตัว` };
}

function finish(state, ctx) {
  const fest = state.festivals, live = fest.live, f = FESTIVALS[live.kind], level = ctx.building(f.building), value = live.gold + (live.item?.value || 0);
  const out = { kind: live.kind, at: state.elapsed, gold: live.gold, item: live.item?.name || null, visitors: live.visitors, lines: [] };
  const tickets = Math.round(live.visitors * (1.5 + level * .5));
  ctx.income(tickets, `ค่าเข้าชม${f.name}`); out.lines.push(`ผู้มาเที่ยว ${live.visitors} คน · ค่าเข้าชม +${tickets} G`);
  ctx.prosperity(live.visitors * 1.5);
  const rep = Math.round(clamp(4 + value / 35, 4, 140) * (1 + level * .1)); ctx.rep(rep); out.lines.push(`ชื่อเสียงกิลด์ +${rep}`);
  if (live.kind === 'tournament') {
    const champ = live.fighters[live.champion]; out.champion = { name: champ.name, kind: champ.kind, cls: champ.cls };
    for (const id of live.members) ctx.leave(id);
    if (champ.kind === 'member') {
      const m = state.members.find(x => x.id === champ.id);
      if (m) { m.purse = (m.purse || 0) + live.gold; m.morale = clamp(m.morale + 15, 0, 100); m.points = (m.points || 0) + 25; ctx.xp(m, 40); }
      if (live.item) ctx.returnItem(live.item);
      ctx.rep(Math.round(rep * .5)); out.lines.push(`${champ.name}ของกิลด์เราคว้าแชมป์! ได้เงินรางวัลเข้ากระเป๋า${live.item ? ' และ' + live.item.name + 'กลับคลังกิลด์' : ''}`);
    } else {
      out.lines.push(`${champ.name}คว้าแชมป์และรางวัลไป`);
      if (champ.kind === 'free') ctx.freeWin(champ.id, live.gold);
      if (champ.kind === 'famous' && live.gold >= 700) { ctx.applicant(champ); out.lines.push(`${champ.name}ประทับใจหมู่บ้าน ขอสมัครเข้ากิลด์!`); }
    }
    for (const id of live.members) { const m = state.members.find(x => x.id === id); if (m) { ctx.xp(m, 25); m.energy = clamp(m.energy - 15, 0, 100); } }
    if (live.members.length > 1) ctx.bond(live.members, 6);
  }
  if (live.kind === 'harvest') {
    const winner = live.farms[0]; out.champion = { name: winner.name, kind: 'farm' };
    const boost = Math.round(value * 1.6 * (1 + level * .15)); ctx.prosperity(boost); ctx.moraleAll(6);
    out.lines.push(`${winner.name}ชนะการประกวดผลผลิต · ความรุ่งเรือง +${boost}`);
  }
  if (live.kind === 'lantern') {
    const lift = clamp(10 + Math.round(value / 60), 10, 40); ctx.moraleAll(lift); ctx.energyAll(Math.round(lift / 2)); ctx.bondHome(4 + level * 2);
    const guests = 1 + (value >= 600 ? 1 : 0) + (level >= 3 ? 1 : 0); for (let i = 0; i < guests; i++) ctx.addFree();
    out.lines.push(`สมาชิกขวัญดีขึ้น +${lift} · นักผจญภัยต่างเมืองแวะมาพัก ${guests} คน`);
    if (value >= 900) { ctx.applicant(null); out.lines.push('มีคนประทับใจโคมลอยจนขอสมัครเข้ากิลด์'); }
  }
  fest.ready[live.kind] = state.elapsed + f.cooldown;
  fest.held += 1;
  fest.history = [out, ...fest.history].slice(0, 6);
  fest.live = null;
  ctx.log(`${f.name}จบลงอย่างสนุกสนาน · ${out.lines.join(' · ')}`, 'cozy');
  return out;
}
/** Advance the running festival: opening, then the prize-giving at the end. */
export function tickFestivals(state, ctx) {
  const live = state.festivals?.live; if (!live) return null;
  if (!live.opened && state.elapsed >= live.open) { live.opened = true; ctx.log(`${FESTIVALS[live.kind].name}เริ่มแล้ว! ชาวบ้านเต็มลาน`, 'cozy'); }
  if (state.elapsed >= live.end) return finish(state, ctx);
  return null;
}
/** What the screens show: which match is on and who has won so far. */
export function festivalView(state) {
  const live = state.festivals?.live; if (!live) return null;
  const t = state.elapsed, phase = t < live.open ? 'prep' : 'live';
  const out = { kind: live.kind, phase, left: Math.max(0, Math.ceil((phase === 'prep' ? live.open : live.end) - t)), progress: clamp((t - live.open) / live.length, 0, 1) };
  if (live.matches) {
    const slot = live.length / 7, idx = live.matches.findIndex(m => t < m.at + slot);
    out.current = idx < 0 ? null : idx; out.done = live.matches.filter(m => t >= m.at + slot).length;
    out.matchProgress = idx < 0 ? 1 : clamp((t - live.matches[idx].at) / slot, 0, 1);
  }
  return out;
}
export function sanitizeFestivals(data, ids) {
  const fest = createFestivals(); if (!data || typeof data !== 'object') return fest;
  const num = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
  for (const [k, v] of Object.entries(data.ready || {})) if (FESTIVALS[k] && num(v, 0, 1e10)) fest.ready[k] = v;
  fest.held = Number.isInteger(data.held) && data.held >= 0 ? data.held : 0;
  fest.history = (Array.isArray(data.history) ? data.history : []).filter(h => h && FESTIVALS[h.kind] && Array.isArray(h.lines)).slice(0, 6).map(h => ({ ...h, lines: h.lines.filter(l => typeof l === 'string').slice(0, 6) }));
  const l = data.live;
  if (l && FESTIVALS[l.kind] && num(l.gold, 0, 1e6) && num(l.start, 0, 1e10) && num(l.open, l.start, l.start + 600) && num(l.end, l.open, l.open + 600) && Array.isArray(l.members) && l.members.every(id => ids.has(id))) {
    const ok = !l.matches || (Array.isArray(l.fighters) && l.fighters.length === 8 && Array.isArray(l.matches) && l.matches.length === 7 && l.fighters.every(f => f && typeof f.name === 'string' && num(f.power, 0, 1e5) && JOBS[f.cls]));
    if (ok) fest.live = JSON.parse(JSON.stringify(l));
  }
  return fest;
}
