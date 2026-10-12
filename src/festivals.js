/* Festivals: the guild master picks a festival the village has a building for, sets the prize money and an item,
   and the whole village comes out, on the map, in real time:
   - the tournament: eight fighters walk into the arena and fight it out match by match; whoever is left standing goes through,
   - the harvest fair: the farms carry their best produce to the fairground and the judge tastes and scores each one in turn,
   - the lantern night: musicians play on the stage, members come to listen, and everyone lets a lantern go at the end.
   Pure module: game.js passes a small context of its own helpers; venue.js moves the people and settles the fights. */
import { FESTIVALS, ROOKIE_NAMES, JOBS } from './content.js';
import { SHOW_DT, showActor, walkTo, goTo, stepActor, stepAll, duelStep, duelAtk, venueGeometry, fx, dist, clamp } from './venue.js';

const VISITOR_TOWNS = ['เมืองท่าคลื่นคราม', 'นครหินเงิน', 'หมู่บ้านใบไผ่', 'ป้อมลมหนาว', 'เมืองหลวง'];
const VISITOR_NAMES = ['กาเรน', 'ไอริส', 'ทอร์ก', 'ซาฟิร่า', 'โรวัน', 'เมลดา', 'คาอิ', 'ลีโอน่า', 'บรันโด', 'ยูน่า'];
const FARMS = ['ไร่ลุงมั่น', 'สวนป้าบัว', 'ไร่ฟักทองยักษ์', 'สวนชาริมธาร', 'ไร่ข้าวโพดหวาน'];
const PRODUCE = ['pumpkin', 'cabbage', 'wheat', 'melon', 'corn'];
const STAGE_NAMES = ['รอบแปดคน', 'รอบรองชนะเลิศ', 'รอบชิงชนะเลิศ'];
const VENUE = { tournament: 'arena', harvest: 'fairground', lantern: 'stage' };
export const FESTIVAL_VENUE = VENUE;

export function createFestivals() { return { live: null, ready: {}, history: [], held: 0 }; }

/** Can the guild hold this festival now? */
export function festivalStatus(state, ctx, kind) {
  const f = FESTIVALS[kind]; if (!f) return { ok: false, reason: 'ไม่มีเทศกาลนี้' };
  const level = ctx.building(f.building), fest = state.festivals;
  if (level < f.level) return { ok: false, reason: `ต้องสร้าง${ctx.buildingName(f.building)}ในหมู่บ้านก่อน`, level };
  if (fest.live) return { ok: false, reason: `กำลังจัด${FESTIVALS[fest.live.kind].name}อยู่`, level };
  if (kind === 'tournament' && state.exams?.session) return { ok: false, reason: 'สนามสอบกำลังใช้สอบเลื่อนแรงค์ รอให้รอบสอบจบก่อน', level };
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
/** Eight fighters and the first round of the draw; the later rounds are filled in as the fights are won. */
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
  for (let i = fighters.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [fighters[i], fighters[j]] = [fighters[j], fighters[i]]; }
  live.fighters = fighters;
  live.matches = [0, 2, 4, 6].map(i => ({ a: i, b: i + 1, winner: null, stage: 0 }));
  live.champion = null;
}

/** Who signs up for the tournament: adventurers enter by themselves, the strongest first; a bigger purse tempts more of them. */
export function festivalEntrants(state, ctx, gold) {
  const want = gold >= 700 ? 4 : gold >= 300 ? 3 : gold >= 150 ? 2 : 1;
  return state.members.filter(m => ctx.canEnter(m.id) && (m.morale ?? 50) >= 35).sort((a, b) => ctx.power(b) - ctx.power(a)).slice(0, want).map(m => m.id);
}

// ---- Setting the scene: who walks in from where, and where they wait. ----
function benchSpot(g, i) { const r = g.rect; return g.rot ? { x: r.x + .55, y: r.y + .45 + i * (r.h - .9) / 7 } : { x: r.x + .45 + i * (r.w - .9) / 7, y: r.y + .55 }; }
function sideSpot(g, i) { const r = g.rect; return g.rot ? { x: r.x + r.w - .35, y: r.y + .5 + (i % 8) * (r.h - 1) / 7 } : { x: r.x + .5 + (i % 8) * (r.w - 1) / 7, y: r.y + r.h - .3 }; }
function startPoint(ctx, who, i) {
  if (who.kind === 'member') { const d = ctx.door(); return { x: d.x + (i % 3) * .3, y: d.y + .3 }; }
  if (who.kind === 'free') return { x: ctx.inn().x + (i % 2) * .3, y: ctx.inn().y + .4 };
  // Outsiders arrive along the east road.
  return { x: 46 + (i % 4) * .6, y: 17.5 + (i % 2) * .3 };
}
function stageTournament(state, ctx, live) {
  const g = venueGeometry(ctx.venue('arena'));
  live.actors = live.fighters.map((f, i) => { const a = showActor({ id: f.id, name: f.name, cls: f.cls, kind: f.kind, ...startPoint(ctx, f, i), power: f.power, seat: i }); walkTo(a, benchSpot(g, i)); return a; });
  live.show = { phase: 'gather', match: 0, t: 0 };
}
function stageHarvest(state, ctx, live) {
  const g = venueGeometry(ctx.venue('fairground')), homes = ctx.homes(), r = ctx.random;
  live.farms = FARMS.map((name, i) => ({ name, produce: PRODUCE[i], score: null, quality: Math.round(40 + r() * 60) }));
  const c = g.center, entries = live.farms.map((_, i) => { const a = -Math.PI * .9 + i * Math.PI * .45; return { x: c.x + Math.cos(a) * 1.6, y: c.y + Math.sin(a) * 1.1 + .3 }; });
  live.actors = live.farms.map((farm, i) => { const h = homes[i % Math.max(1, homes.length)] || { x: c.x + 6, y: 17.5 }; const a = showActor({ id: `farmer-${i}`, name: farm.name, cls: 'villager', kind: 'farmer', x: h.x, y: h.y, carry: farm.produce, entry: entries[i], seed: 300 + i }); walkTo(a, entries[i]); return a; });
  live.actors.push(showActor({ id: 'judge', name: 'ผู้ใหญ่บ้าน', cls: 'villager', kind: 'judge', x: c.x, y: c.y + .2, seed: 299 }));
  live.show = { phase: 'gather', visit: 0, t: 0 };
}
function stageLantern(state, ctx, live) {
  const g = venueGeometry(ctx.venue('stage')), r = g.rect, c = g.center;
  const back = g.rot ? (i => ({ x: r.x + .7, y: c.y - .8 + i * .8 })) : (i => ({ x: c.x - .8 + i * .8, y: r.y + .8 }));
  live.actors = [0, 1, 2].map(i => { const a = showActor({ id: `musician-${i}`, name: ['นักพิณ', 'มือกลอง', 'นักขลุ่ย'][i], cls: 'villager', kind: 'musician', x: 46, y: 17.5 + i * .3, seed: 400 + i, instrument: ['lute', 'drum', 'flute'][i] }); walkTo(a, back(i)); return a; });
  // Members at home come to listen; they stand with the crowd in front of the stage.
  for (const [i, id] of ctx.audience(6, live.end + 5).entries()) {
    const m = state.members.find(x => x.id === id); if (!m) continue;
    const d = ctx.door(), front = g.front, spot = g.rot ? { x: front.x + .4 + Math.floor(i / 3) * .7, y: c.y - .9 + (i % 3) * .9 } : { x: c.x - .9 + (i % 3) * .9, y: front.y + .4 + Math.floor(i / 3) * .7 };
    const a = showActor({ id, name: m.name, cls: m.class, kind: 'member', x: d.x, y: d.y + .3, listener: true }); walkTo(a, spot); live.actors.push(a);
  }
  live.audience = live.actors.filter(a => a.kind === 'member').map(a => a.id);
  live.show = { phase: 'gather', t: 0, released: 0 };
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
  const members = kind === 'tournament' ? festivalEntrants(state, ctx, gold) : [];
  ctx.pay(gold, `เงินรางวัล${f.name}`);
  const now = state.elapsed;
  const live = { v: 2, kind, gold, item, start: now, open: now + f.prep, end: now + f.prep + f.length, length: f.length, visitors: festivalVisitors(state, ctx, kind, gold, item?.value || 0), members };
  if (kind === 'tournament') { seedBracket(state, ctx, live, members); for (const id of members) ctx.enter(id, now + 600); stageTournament(state, ctx, live); }
  if (kind === 'harvest') stageHarvest(state, ctx, live);
  if (kind === 'lantern') stageLantern(state, ctx, live);
  state.festivals.live = live;
  ctx.log(`ประกาศ${f.name}! รางวัล ${gold} G${item ? ' และ' + item.name : ''} · เริ่มในอีก ${f.prep} วินาที`, 'cozy');
  return { ok: true, message: `ประกาศ${f.name}แล้ว ชาวบ้านกำลังมารวมตัว` };
}

// ---- The tournament, one match at a time. ----
const matchName = m => STAGE_NAMES[m.stage] + (m.stage < 2 ? ` คู่ที่ ${m.stage === 0 ? m.index + 1 : m.index - 3}` : '');
function tickTournament(state, ctx, live, dt) {
  const s = live.show, g = venueGeometry(ctx.venue('arena')), ring = g.ring, actor = i => live.actors[i];
  s.t += dt;
  stepAll(live.actors, dt, 1.7);
  if (s.phase === 'gather') { if (state.elapsed >= live.open) { s.phase = 'call'; fx({ type: 'announce', x: ring.x, y: ring.y, text: `⚔ งานประลองยุทธเริ่มแล้ว!` }); } return; }
  const m = live.matches[s.match];
  if (s.phase === 'call') {
    m.index = s.match;
    const a = actor(m.a), b = actor(m.b);
    goTo(a, { x: ring.x - .9, y: ring.y }); goTo(b, { x: ring.x + .9, y: ring.y });
    s.phase = 'walk'; s.t = 0; return;
  }
  const a = actor(m.a), b = actor(m.b);
  if (s.phase === 'walk') {
    if ((!a.path.length && !b.path.length) || s.t > 8) {
      Object.assign(a, { x: ring.x - .9, y: ring.y, path: [], mode: 'ready' }); Object.assign(b, { x: ring.x + .9, y: ring.y, path: [], mode: 'ready' });
      fx({ type: 'announce', x: ring.x, y: ring.y, text: `${matchName(m)}: ${a.name} ปะทะ ${b.name}` });
      s.phase = 'ready'; s.t = 0;
    }
    return;
  }
  if (s.phase === 'ready') {
    if (s.t < 1.6) return;
    for (const [x, y] of [[a, b], [b, a]]) Object.assign(x, { hp: 100, maxHp: 100, atk: duelAtk(x.power, y.power), cd: .3 + ctx.random() * .4, skillCd: 3 + ctx.random() * 2, mode: 'fight', stun: 0 });
    fx({ type: 'announce', x: ring.x, y: ring.y, text: 'เริ่ม!' });
    s.phase = 'fight'; s.t = 0; return;
  }
  if (s.phase === 'fight') {
    let loser = duelStep(a, b, dt, ctx.random, ring);
    // A long bout goes to the judges: whoever has more left.
    if (!loser && s.t > 30) { loser = a.hp / a.maxHp < b.hp / b.maxHp ? a : b; loser.mode = 'down'; (loser === a ? b : a).mode = 'cheer'; }
    if (!loser) return;
    const winner = loser === a ? b : a, wi = loser === a ? m.b : m.a;
    m.winner = wi;
    fx({ type: 'ko', id: loser.id, x: loser.x, y: loser.y, show: true });
    fx({ type: 'announce', x: ring.x, y: ring.y, text: `${winner.name} ชนะ!`, cheer: true });
    s.phase = 'after'; s.t = 0; return;
  }
  if (s.phase === 'after') {
    if (s.t < 2.4) return;
    const winner = actor(m.winner), loser = actor(m.winner === m.a ? m.b : m.a);
    loser.mode = 'idle'; goTo(loser, sideSpot(g, live.matches.filter(x => x.winner !== null).length + 1));
    // The next round's pairs are drawn from this round's winners as they come in.
    const done = live.matches.filter(x => x.winner !== null);
    if (done.length === 4 || done.length === 6) {
      const prev = live.matches.slice(done.length === 4 ? 0 : 4, done.length);
      for (let i = 0; i < prev.length; i += 2) live.matches.push({ a: prev[i].winner, b: prev[i + 1].winner, winner: null, stage: done.length === 4 ? 1 : 2 });
    }
    if (live.matches.length === 7 && live.matches[6].winner !== null) {
      live.champion = live.matches[6].winner;
      goTo(winner, { x: ring.x, y: ring.y }); winner.mode = 'cheer';
      fx({ type: 'champion', id: winner.id, x: ring.x, y: ring.y, text: `🏆 ${winner.name} คว้าแชมป์!` });
      s.phase = 'ceremony'; s.t = 0; return;
    }
    winner.mode = 'idle'; winner.hp = winner.maxHp; goTo(winner, benchSpot(g, winner.seat));
    s.match += 1; s.phase = 'call'; s.t = 0;
    return;
  }
  if (s.phase === 'ceremony' && s.t > 5) s.phase = 'done';
}

// ---- The harvest fair: the judge goes round the entries. ----
function tickHarvest(state, ctx, live, dt) {
  const s = live.show, judge = live.actors.find(a => a.kind === 'judge'), farmers = live.actors.filter(a => a.kind === 'farmer'), g = venueGeometry(ctx.venue('fairground'));
  s.t += dt;
  stepAll(live.actors, dt, 1.3);
  if (s.phase === 'gather') { for (const f of farmers) if (!f.path.length) f.mode = 'idle'; if (state.elapsed >= live.open) { s.phase = 'visit'; s.t = 0; fx({ type: 'announce', x: g.center.x, y: g.center.y, text: '🌾 การประกวดผลผลิตเริ่มแล้ว!' }); } return; }
  if (s.phase === 'visit') {
    const f = farmers[s.visit];
    if (!f) { s.phase = 'crown'; s.t = 0; return; }
    if (!judge.path.length && dist(judge, f) > .7) { goTo(judge, { x: f.entry.x + .45, y: f.entry.y + .25 }); return; }
    if (judge.path.length) return;
    judge.mode = 'inspect'; s.phase = 'taste'; s.t = 0; fx({ type: 'inspect', id: judge.id, x: f.x, y: f.y }); return;
  }
  if (s.phase === 'taste') {
    if (s.t < 3.2) return;
    const farm = live.farms[s.visit]; farm.score = farm.quality;
    fx({ type: 'score', x: farmers[s.visit].x, y: farmers[s.visit].y, text: `${farm.score} คะแนน`, good: farm.score >= 80 });
    judge.mode = 'idle'; s.visit += 1; s.phase = 'visit'; s.t = 0; return;
  }
  if (s.phase === 'crown') {
    if (s.t < 1.5 || s.crowned) return;
    s.crowned = true;
    const best = live.farms.reduce((b, f, i) => f.score > live.farms[b].score ? i : b, 0), w = farmers[best];
    live.champion = best; goTo(w, { x: g.center.x, y: g.center.y + .2 }); w.mode = 'cheer'; goTo(judge, { x: g.center.x + .6, y: g.center.y });
    fx({ type: 'champion', id: w.id, x: g.center.x, y: g.center.y, text: `🏅 ${live.farms[best].name} ชนะการประกวด!` });
  }
}

// ---- The lantern night: music first, then everyone lets their lantern go. ----
function tickLantern(state, ctx, live, dt) {
  const s = live.show, g = venueGeometry(ctx.venue('stage'));
  s.t += dt;
  stepAll(live.actors, dt, 1.5);
  for (const a of live.actors) if (!a.path.length) a.mode = a.kind === 'musician' && state.elapsed >= live.open ? 'play' : a.mode === 'walk' ? 'idle' : a.mode;
  if (s.phase === 'gather') { if (state.elapsed >= live.open) { s.phase = 'music'; s.t = 0; fx({ type: 'announce', x: g.center.x, y: g.center.y, text: '🎶 คอนเสิร์ตใต้แสงโคมเริ่มแล้ว' }); } return; }
  if (s.phase === 'music') {
    for (const a of live.actors) if (a.listener && !a.path.length) a.mode = 'dance';
    if (state.elapsed >= live.end - 14) { s.phase = 'release'; s.t = 0; fx({ type: 'announce', x: g.center.x, y: g.center.y, text: '🏮 ได้เวลาปล่อยโคม!' }); }
    return;
  }
  if (s.phase === 'release') {
    // A few at a time, the crowd sends its lanterns up.
    const want = Math.min(live.visitors, Math.floor(s.t * 4));
    for (; s.released < want; s.released++) { const k = s.released, a = (k * 2.4) % (Math.PI * 2), d = 1.4 + (k % 5) * .45; fx({ type: 'lanternUp', x: g.front.x + Math.cos(a) * d, y: g.front.y + Math.abs(Math.sin(a)) * d * .7 + .5 }); }
  }
}

function finish(state, ctx) {
  const fest = state.festivals, live = fest.live, f = FESTIVALS[live.kind], level = ctx.building(f.building), value = live.gold + (live.item?.value || 0);
  const out = { kind: live.kind, at: state.elapsed, gold: live.gold, item: live.item?.name || null, visitors: live.visitors, lines: [] };
  const tickets = Math.round(live.visitors * (1.5 + level * .5));
  ctx.income(tickets, `ค่าเข้าชม${f.name}`); out.lines.push(`ผู้มาเที่ยว ${live.visitors} คน · ค่าเข้าชม +${tickets} G`);
  ctx.prosperity(live.visitors * 1.5);
  const rep = Math.round(clamp(4 + value / 35, 4, 140) * (1 + level * .1)); ctx.rep(rep); out.lines.push(`ชื่อเสียงกิลด์ +${rep}`);
  if (live.kind === 'tournament') {
    const champ = live.fighters[live.champion ?? live.matches.at(-1)?.winner ?? 0]; out.champion = { name: champ.name, kind: champ.kind, cls: champ.cls };
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
    const best = live.champion ?? live.farms.reduce((b, f, i) => f.quality > live.farms[b].quality ? i : b, 0), winner = live.farms[best]; out.champion = { name: winner.name, kind: 'farm' };
    const boost = Math.round(value * 1.6 * (1 + level * .15)); ctx.prosperity(boost); ctx.moraleAll(6);
    out.lines.push(`${winner.name}ชนะการประกวดผลผลิต · ความรุ่งเรือง +${boost}`);
  }
  if (live.kind === 'lantern') {
    for (const id of live.audience || []) ctx.leave(id);
    const lift = clamp(10 + Math.round(value / 60), 10, 40); ctx.moraleAll(lift); ctx.energyAll(Math.round(lift / 2)); ctx.bondHome(4 + level * 2);
    if ((live.audience || []).length > 1) ctx.bond(live.audience, 4);
    const guests = 1 + (value >= 600 ? 1 : 0) + (level >= 3 ? 1 : 0); for (let i = 0; i < guests; i++) ctx.addFree();
    out.lines.push(`สมาชิกขวัญดีขึ้น +${lift} · นักผจญภัยต่างเมืองแวะมาพัก ${guests} คน`);
    if (value >= 900) { ctx.applicant(null); out.lines.push('มีคนประทับใจโคมลอยจนขอสมัครเข้ากิลด์'); }
  }
  // Everyone in the show walks home from where they stood.
  for (const a of live.actors || []) if (a.kind === 'member' || a.kind === 'free') ctx.release?.(a.id, a.x, a.y);
  fest.ready[live.kind] = state.elapsed + f.cooldown;
  fest.held += 1;
  fest.history = [out, ...fest.history].slice(0, 6);
  fest.live = null;
  ctx.log(`${f.name}จบลงอย่างสนุกสนาน · ${out.lines.join(' · ')}`, 'cozy');
  return out;
}
/** Advance the running festival in small steps: the show plays out, then the prize-giving. */
export function tickFestivals(state, ctx, seconds = 1) {
  const live = state.festivals?.live; if (!live) return null;
  if (!live.opened && state.elapsed >= live.open) { live.opened = true; ctx.log(`${FESTIVALS[live.kind].name}เริ่มแล้ว! ชาวบ้านเต็มลาน`, 'cozy'); }
  let left = seconds;
  while (left > 1e-9) {
    const dt = Math.min(SHOW_DT, left); left -= dt;
    if (live.kind === 'tournament') tickTournament(state, ctx, live, dt);
    else if (live.kind === 'harvest') tickHarvest(state, ctx, live, dt);
    else tickLantern(state, ctx, live, dt);
  }
  // The tournament ends when the champion has been cheered; its expected end moves with the fights.
  if (live.kind === 'tournament') {
    const left = 7 - live.matches.filter(m => m.winner !== null).length;
    if (live.show.phase === 'done') return finish(state, ctx);
    live.end = Math.max(state.elapsed + 1, state.elapsed + left * 13 + (live.show.phase === 'gather' ? live.open - state.elapsed : 0) + 5);
    return null;
  }
  if (state.elapsed >= live.end) return finish(state, ctx);
  return null;
}
/** What the live panel shows: the draw and the bout on now, the farms' scores, or the time to the lanterns. */
export function festivalView(state) {
  const live = state.festivals?.live; if (!live) return null;
  const t = state.elapsed, phase = t < live.open ? 'prep' : 'live', s = live.show || {};
  const out = { kind: live.kind, phase, step: s.phase, left: Math.max(0, Math.ceil((phase === 'prep' ? live.open : live.end) - t)), progress: clamp((t - live.open) / Math.max(1, live.end - live.open), 0, 1), visitors: live.visitors, gold: live.gold };
  if (live.kind === 'tournament') {
    const actor = i => live.actors?.[i];
    out.fighters = live.fighters.map((f, i) => ({ name: f.name, kind: f.kind, cls: f.cls, out: live.matches.some(m => m.winner !== null && (m.a === i || m.b === i) && m.winner !== i) }));
    out.matches = live.matches.map(m => ({ a: m.a, b: m.b, winner: m.winner, stage: m.stage }));
    const m = live.matches[s.match];
    if (m && ['walk', 'ready', 'fight', 'after'].includes(s.phase)) out.bout = { name: matchName({ ...m, index: s.match }), a: { name: actor(m.a)?.name, hp: actor(m.a)?.hp ?? 100, cls: actor(m.a)?.cls, kind: live.fighters[m.a].kind }, b: { name: actor(m.b)?.name, hp: actor(m.b)?.hp ?? 100, cls: actor(m.b)?.cls, kind: live.fighters[m.b].kind }, winner: m.winner === null ? null : m.winner === m.a ? 'a' : 'b' };
    if (live.champion !== null && live.champion !== undefined) out.champion = live.fighters[live.champion].name;
    out.done = live.matches.filter(m => m.winner !== null).length;
  }
  if (live.kind === 'harvest') { out.farms = live.farms.map(f => ({ name: f.name, produce: f.produce, score: f.score })); out.judging = s.phase === 'visit' || s.phase === 'taste' ? live.farms[s.visit]?.name || null : null; if (live.champion !== undefined && live.champion !== null) out.champion = live.farms[live.champion].name; }
  if (live.kind === 'lantern') { out.release = Math.max(0, Math.ceil(live.end - 14 - t)); out.audience = (live.audience || []).length; out.released = s.released || 0; }
  return out;
}
const okActor = a => a && typeof a.id === 'string' && Number.isFinite(a.x) && Number.isFinite(a.y) && Math.abs(a.x) < 200 && Math.abs(a.y) < 200;
export function sanitizeFestivals(data, ids) {
  const fest = createFestivals(); if (!data || typeof data !== 'object') return fest;
  const num = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
  for (const [k, v] of Object.entries(data.ready || {})) if (FESTIVALS[k] && num(v, 0, 1e10)) fest.ready[k] = v;
  fest.held = Number.isInteger(data.held) && data.held >= 0 ? data.held : 0;
  fest.history = (Array.isArray(data.history) ? data.history : []).filter(h => h && FESTIVALS[h.kind] && Array.isArray(h.lines)).slice(0, 6).map(h => ({ ...h, lines: h.lines.filter(l => typeof l === 'string').slice(0, 6) }));
  const l = data.live;
  // Only festivals saved by the live shows come back; an older save's festival is refunded by the caller.
  if (l && l.v === 2 && FESTIVALS[l.kind] && num(l.gold, 0, 1e6) && num(l.start, 0, 1e10) && num(l.open, l.start, l.start + 600) && num(l.end, l.open, l.open + 1200) && Array.isArray(l.members) && l.members.every(id => ids.has(id))
    && Array.isArray(l.actors) && l.actors.length <= 40 && l.actors.every(okActor) && l.show && typeof l.show.phase === 'string') {
    const ok = l.kind !== 'tournament' || (Array.isArray(l.fighters) && l.fighters.length === 8 && Array.isArray(l.matches) && l.matches.length >= 4 && l.matches.length <= 7 && l.fighters.every(f => f && typeof f.name === 'string' && num(f.power, 0, 1e5) && JOBS[f.cls]) && l.actors.length === 8
      && l.matches.every(m => Number.isInteger(m.a) && Number.isInteger(m.b) && m.a >= 0 && m.a < 8 && m.b >= 0 && m.b < 8 && (m.winner === null || m.winner === m.a || m.winner === m.b)) && Number.isInteger(l.show.match) && l.show.match >= 0 && l.show.match < l.matches.length);
    const okFarms = l.kind !== 'harvest' || (Array.isArray(l.farms) && l.farms.length === 5);
    if (ok && okFarms) fest.live = JSON.parse(JSON.stringify(l));
  }
  return fest;
}
