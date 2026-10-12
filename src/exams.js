/* Rank exams run in rounds at the village arena. Members sign up (and pay) before a round; when it is due they walk to
   the arena and everyone sits the same three trials together, live on the map:
   - break a boulder: each examinee has a rock of their own and strikes it until it splits, or the time runs out,
   - stand under the golem's hammer: the judging golem slams the sand where the red marks show; step aside or take the blow,
   - duel an examiner: one bout each against an association examiner, who holds back but tests them properly.
   The scores come from what happens; the average decides the pass. Pure module: game.js passes a small context. */
import { ADVENTURER_RANK_RULES } from './content.js';
import { SHOW_DT, SHOW_STYLE, rootClass, showActor, walkTo, goTo, stepAll, duelStep, venueGeometry, fx, dist, clamp } from './venue.js';

/** A round every half day: a short walk in, then three trials of sixteen seconds each. */
export const EXAM_RULES = { every: 120, firstAt: 60, gather: 12, stageTime: 16, passMark: 60, maxSeats: 8 };
export const EXAM_STAGES = [
  { id: 'power', name: 'ทุบหินทดสอบพลัง', icon: '🪨', text: 'ผู้สอบทุกคนทุบหินผาของตัวเองให้แตกภายในเวลา' },
  { id: 'guard', name: 'ยืนหยัดใต้ค้อนโกเลม', icon: '🛡', text: 'โกเลมกรรมการทุบพื้นตรงวงแดง หลบให้ทันหรือรับไว้ให้ไหว' },
  { id: 'duel', name: 'ประลองกับกรรมการ', icon: '⚔', text: 'ดวลหนึ่งต่อหนึ่งกับกรรมการจากสมาคม' },
];
const ROCK_HP = 100, GOLEM_EVERY = 1.6, SLAM_WARN = 1, SLAM_DMG = 22;

export function createExams() { return { round: 0, next: EXAM_RULES.firstAt, queue: [], session: null, last: null }; }

/** Sign a member up for the next round; the fee is paid now. */
export function registerExam(state, ctx, member) {
  const ex = state.exams;
  if (!ctx.arena()) return { ok: false, message: 'ต้องสร้างสนามสอบในหมู่บ้านก่อน' };
  if (ex.queue.some(q => q.id === member.id)) return { ok: false, message: `${member.name}สมัครสอบรอบถัดไปแล้ว` };
  if (ex.session?.examinees.some(e => e.id === member.id)) return { ok: false, message: `${member.name}กำลังสอบอยู่` };
  const info = ctx.rankInfo(member);
  if (!info.eligible) return { ok: false, message: info.cooldown ? `สอบใหม่ได้รอบถัดไป (อีก ${info.cooldown} วินาที)` : info.needs[0] || 'ยังสอบไม่ได้' };
  if (ex.queue.length >= EXAM_RULES.maxSeats) return { ok: false, message: 'ที่นั่งสอบรอบนี้เต็มแล้ว' };
  if (!ctx.payFee(member, info.rule.fee, `ค่าสมัครสอบแรงค์${member.name}`)) return { ok: false, message: `ค่าสอบ ${info.rule.fee} G ไม่พอ` };
  ex.queue.push({ id: member.id, rank: info.next });
  ctx.log(`${member.name}สมัครสอบแรงค์ ${info.next} รอบที่ ${ex.round + 1}`, 'member');
  return { ok: true, message: `${member.name}สมัครสอบรอบถัดไปแล้ว · เริ่มในอีก ${Math.max(0, Math.ceil(ex.next - state.elapsed))} วินาที` };
}
export function withdrawExam(state, member) {
  const ex = state.exams, i = ex.queue.findIndex(q => q.id === member.id);
  if (i < 0) return { ok: false, message: 'ไม่ได้สมัครไว้' };
  ex.queue.splice(i, 1);
  return { ok: true, message: `${member.name}ถอนชื่อจากการสอบ (ค่าสมัครไม่คืน)` };
}

// Where each examinee stands: one or two rows across the sand, with their rock just behind them.
function laneSpot(g, i, n) {
  const r = g.rect, rows = n > 6 ? 2 : 1, per = Math.ceil(n / rows), row = Math.floor(i / per), col = i % per;
  const span = r.w - 1.2, x = r.x + .6 + (per === 1 ? span / 2 : col * span / (per - 1));
  return { x, y: r.y + r.h * (rows === 1 ? .62 : .5 + row * .3) };
}
function startRound(state, ctx) {
  const ex = state.exams, now = state.elapsed, g = venueGeometry(ctx.venue('arena'));
  ex.round += 1;
  const entrants = [];
  for (const q of ex.queue) {
    const member = state.members.find(m => m.id === q.id);
    if (!member || ctx.busy(member) || !ADVENTURER_RANK_RULES[q.rank]) { if (member) ctx.refund?.(member, q.rank); continue; }
    entrants.push({ who: member, id: member.id, kind: 'member', name: member.name, cls: member.class, rank: q.rank, from: member.rank || 'F', chance: ctx.chance(member, ADVENTURER_RANK_RULES[q.rank]) });
  }
  ex.queue = [];
  if (!entrants.length) return;
  // Free adventurers from the inn sit the same round, so members have rivals to beat.
  for (const f of ctx.rivals(Math.min(3, 1 + Math.floor(ctx.random() * 3)))) entrants.push({ id: f.id, kind: 'free', name: f.name, cls: f.class, rank: f.next, from: f.rank, chance: .35 + ctx.random() * .4 });
  const open = Math.max(now, ex.next) + EXAM_RULES.gather, end = open + EXAM_RULES.stageTime * EXAM_STAGES.length, n = entrants.length;
  const examinees = entrants.map((e, i) => {
    const spot = laneSpot(g, i, n), from = e.kind === 'member' ? ctx.door() : ctx.inn();
    const a = showActor({ id: e.id, kind: e.kind, name: e.name, cls: e.cls, rank: e.rank, from: e.from, chance: e.chance, skill: examSkill(e.chance, ctx.random), pass: null, scores: [0, 0, 0], x: from.x + (i % 3) * .3, y: from.y + .3, spot, rock: { x: spot.x, y: spot.y - .75, hp: ROCK_HP } });
    walkTo(a, spot); return a;
  });
  for (const e of entrants) if (e.who) { e.who.errand = { kind: 'exam', start: now, end, rank: e.rank, round: ex.round }; e.who.task = 'rest'; }
  const c = g.center;
  ex.session = { round: ex.round, start: now, open, end, examinees, stage: -1, golem: { x: c.x, y: g.rect.y + .7, swing: 0, next: 0, marks: [] }, examiners: [] };
  ctx.log(`การสอบเลื่อนแรงค์รอบที่ ${ex.round} เริ่มแล้วที่สนามสอบ! ผู้เข้าสอบ ${examinees.length} คน`, 'rank');
  fx({ type: 'examStart', round: ex.round, x: c.x, y: c.y });
}
/** How well someone performs on the day: their preparation (the odds) plus the form they happen to be in. */
export function examSkill(chance, random = () => .5) { const form = (random() - .5) * .55 + (random() - .5) * .35; return clamp(.02 + chance * .9 + form, .02, 1); }

// ---- Trial 1: a rock each. ----
function trialPower(s, dt, rand, t) {
  for (const e of s.examinees) {
    if (e.rock.hp <= 0 || e.path.length) continue;
    const st = SHOW_STYLE[rootClass(e.cls)] || SHOW_STYLE.warrior;
    e.cd -= dt; e.swing = Math.max(0, e.swing - dt); e.mode = 'fight'; e.fx = 0; e.fy = -1;
    if (e.cd > 0) continue;
    e.cd = st.cd * (.85 + rand() * .3); e.swing = .3;
    const dmg = Math.round((4.2 + e.skill * 7.6) * (.6 + rand() * .8) * (rand() < .1 ? 1.6 : 1));
    e.rock.hp = Math.max(0, e.rock.hp - dmg);
    fx({ type: 'rockHit', id: e.id, x: e.rock.x, y: e.rock.y, fx: e.x, fy: e.y, amount: dmg, kind: st.hit, left: e.rock.hp / ROCK_HP });
    if (e.rock.hp <= 0) { e.rock.at = t; e.mode = 'cheer'; fx({ type: 'rockBreak', id: e.id, x: e.rock.x, y: e.rock.y }); }
  }
}
function scorePower(e) { return Math.round(e.rock.hp <= 0 ? clamp(62 + (EXAM_RULES.stageTime - e.rock.at) / EXAM_RULES.stageTime * 70, 62, 100) : clamp((1 - e.rock.hp / ROCK_HP) * 64, 5, 60)); }
// ---- Trial 2: the golem's hammer. ----
function trialGuard(s, dt, rand) {
  const gm = s.golem;
  gm.next -= dt; gm.swing = Math.max(0, gm.swing - dt);
  for (const e of s.examinees) { if (e.dodge > 0) { e.dodge -= dt; if (e.dodge <= 0) goTo(e, e.spot); } }
  // A red mark first; whoever reads it in time steps out before the hammer lands.
  for (const mk of gm.marks) {
    mk.t -= dt;
    if (!mk.moved && mk.t < SLAM_WARN * .55) { mk.moved = true; for (const e of s.examinees) if (dist(e, mk) < .95 && e.hp > 0 && rand() < .28 + e.skill * .6) { e.dodge = .9; goTo(e, { x: e.x + (e.x >= mk.x ? .95 : -.95), y: e.y + .15 }); } }
    if (mk.t <= 0) {
      gm.swing = .4; fx({ type: 'slam', id: 'golem', x: mk.x, y: mk.y });
      for (const e of s.examinees) if (e.hp > 0 && dist(e, mk) < .55) { const d = Math.round(SLAM_DMG * (.8 + rand() * .4)); e.hp = Math.max(0, e.hp - d); fx({ type: 'hurt', id: e.id, x: e.x, y: e.y, amount: d }); if (e.hp <= 0) { e.mode = 'down'; fx({ type: 'ko', id: e.id, x: e.x, y: e.y, show: true }); } }
    }
  }
  gm.marks = gm.marks.filter(m => m.t > 0);
  if (gm.next <= 0) {
    gm.next = GOLEM_EVERY;
    const standing = s.examinees.filter(e => e.hp > 0), k = Math.max(1, Math.round(standing.length / 3));
    for (let i = 0; i < k && standing.length; i++) { const e = standing.splice(Math.floor(rand() * standing.length), 1)[0]; const mk = { x: e.spot.x, y: e.spot.y, t: SLAM_WARN }; gm.marks.push(mk); fx({ type: 'telegraph', id: 'golem', x: mk.x, y: mk.y, r: .8 }); }
  }
}
// ---- Trial 3: a bout against an examiner each (in two waves when the round is big). ----
function duelWaves(n) { return n > 6 ? 2 : 1; }
function setDuels(s, g, wave, rand) {
  const n = s.examinees.length, per = Math.ceil(n / duelWaves(n)), group = s.examinees.slice(wave * per, wave * per + per);
  s.examiners = group.map((e, i) => {
    const spot = e.spot, ex = showActor({ id: `examiner-${i}`, name: 'กรรมการ', cls: ['warrior', 'archer', 'mage', 'healer'][i % 4], kind: 'examiner', x: spot.x, y: spot.y - .9, hp: 100, maxHp: 100, atk: 9.5, cd: .8, skillCd: 6, foe: e.id, seed: 500 + i });
    Object.assign(e, { hp: 100, maxHp: 100, atk: 2.5 + e.skill * 9, cd: .4 + rand() * .4, skillCd: 3 + rand() * 2, mode: 'fight', dealt: 0, duel: true });
    return ex;
  });
  for (const e of s.examinees) if (!group.includes(e) && !e.scores[2]) { e.mode = 'idle'; e.duel = false; }
  s.wave = wave;
}
function trialDuel(s, dt, rand, g) {
  for (const ex of s.examiners) {
    const e = s.examinees.find(x => x.id === ex.foe); if (!e || !e.duel) continue;
    const before = ex.hp, ring = { x: e.spot.x, y: e.spot.y - .45, r: .9 };
    const loser = duelStep(e, ex, dt, rand, ring);
    e.dealt += Math.max(0, before - ex.hp);
    // The examiner yields when beaten; an examinee who drops is helped up and the bout is over.
    if (loser) { e.duel = false; if (loser === ex) { ex.hp = 1; ex.mode = 'idle'; e.won = true; fx({ type: 'announce', x: e.x, y: e.y - .6, text: 'ชนะกรรมการ!', small: true }); } else { e.mode = 'down'; } }
  }
}
function scoreDuel(e) { return Math.round(clamp(e.dealt * .55 + (e.hp / e.maxHp) * 30 + (e.won ? 12 : 0), 5, 100)); }

function tickSession(state, ctx, s, dt) {
  const g = venueGeometry(ctx.venue('arena')), t = state.elapsed - s.open, rand = ctx.random;
  stepAll(s.examinees, dt, t < 0 ? 3.6 : 2.6);
  for (const x of s.examiners) if (x.path?.length) stepAll([x], dt, 1.6);
  const stage = t < 0 ? -1 : Math.min(2, Math.floor(t / EXAM_RULES.stageTime)), within = t - stage * EXAM_RULES.stageTime;
  if (stage !== s.stage) {
    // The end of a trial: its scores are read out, and everyone is set up for the next.
    if (s.stage === 0) for (const e of s.examinees) e.scores[0] = scorePower(e);
    if (s.stage === 1) for (const e of s.examinees) e.scores[1] = Math.round(clamp(20 + e.hp * .75, 5, 100));
    if (stage >= 0) for (const e of s.examinees) { Object.assign(e, { x: e.path.length ? e.spot.x : e.x, y: e.path.length ? e.spot.y : e.y, path: [], hp: 100, maxHp: 100, cd: .3 + rand() * .5, swing: 0, mode: 'idle', dodge: 0 }); }
    if (stage >= 0) fx({ type: 'announce', x: g.center.x, y: g.center.y, text: `${EXAM_STAGES[stage].icon} ด่าน ${stage + 1}: ${EXAM_STAGES[stage].name}` });
    if (stage === 1) { s.golem.next = 1.2; s.golem.marks = []; }
    if (stage === 2) setDuels(s, g, 0, rand);
    s.stage = stage;
  }
  if (stage === 0) trialPower(s, dt, rand, within);
  if (stage === 1) trialGuard(s, dt, rand);
  if (stage === 2) {
    const waves = duelWaves(s.examinees.length), wave = Math.min(waves - 1, Math.floor(within / (EXAM_RULES.stageTime / waves)));
    if (wave !== s.wave) { for (const e of s.examinees) if (e.duel || (e.dealt !== undefined && !e.scores[2] && s.examiners.some(x => x.foe === e.id))) { e.scores[2] = scoreDuel(e); e.duel = false; } setDuels(s, g, wave, rand); }
    trialDuel(s, dt, rand, g);
  }
}
function finishRound(state, ctx) {
  const ex = state.exams, s = ex.session;
  for (const e of s.examinees) {
    if (!e.scores[2]) e.scores[2] = scoreDuel(e);
    const total = Math.round(e.scores.reduce((a, b) => a + b, 0) / e.scores.length);
    e.total = total; e.pass = total >= EXAM_RULES.passMark;
  }
  const results = s.examinees.map(e => ({ id: e.id, kind: e.kind, name: e.name, cls: e.cls, rank: e.rank, from: e.from, total: e.total, pass: e.pass, scores: [...e.scores] }));
  for (const e of s.examinees) {
    if (e.kind !== 'member') continue;
    const member = state.members.find(m => m.id === e.id); if (!member) continue;
    member.errand = null;
    if (e.pass) { ctx.passed?.(); member.rank = e.rank; member.morale = clamp(member.morale + 8, 0, 100); ctx.log(`${member.name}สอบผ่าน! ได้ ${e.total} คะแนน เลื่อนเป็นนักผจญภัยแรงค์ ${e.rank}`, 'rank'); }
    else { member.examReadyAt = state.elapsed + EXAM_RULES.every * .8; member.morale = clamp(member.morale - 6, 0, 100); ctx.log(`${member.name}สอบแรงค์ ${e.rank} ไม่ผ่าน (${e.total} คะแนน) จะฝึกแล้วกลับมาสอบรอบหน้า`, 'warning'); }
  }
  const g = venueGeometry(ctx.venue('arena'));
  fx({ type: 'examResults', x: g.center.x, y: g.center.y, results: s.examinees.map(e => ({ id: e.id, pass: e.pass, total: e.total, x: e.x, y: e.y })) });
  // Everyone walks home from where they stood.
  for (const e of s.examinees) ctx.release?.(e.id, e.x, e.y);
  ex.last = { round: s.round, at: state.elapsed, results };
  ex.session = null;
}
/** Advance the arena's calendar and the round in progress: call the examinees in, run the trials, read out the results. */
export function tickExams(state, ctx, seconds = 1) {
  const ex = state.exams;
  if (!ctx.arena()) { ex.next = Math.max(ex.next, state.elapsed + EXAM_RULES.firstAt); return; }
  if (ex.session) {
    let left = seconds;
    while (left > 1e-9 && ex.session) { const dt = Math.min(SHOW_DT, left); left -= dt; tickSession(state, ctx, ex.session, dt); }
    if (state.elapsed >= ex.session.end) finishRound(state, ctx);
  }
  // The arena hosts one thing at a time: a round waits for the tournament to finish.
  if (!ex.session && state.elapsed >= ex.next && ctx.arenaBusy?.()) ex.next = state.elapsed + 15;
  if (!ex.session && state.elapsed >= ex.next) { startRound(state, ctx); ex.next = state.elapsed + EXAM_RULES.every; }
}
/** Which trial a running round is on and how far through it, for the live panel. */
export function examStage(state) {
  const s = state.exams?.session; if (!s) return null;
  const t = state.elapsed - s.open;
  if (t < 0) return { index: -1, stage: { id: 'gather', name: 'ผู้สอบกำลังเดินมาที่สนาม', icon: '🚶' }, progress: clamp(1 + t / EXAM_RULES.gather, 0, 1), left: Math.max(0, Math.ceil(s.end - state.elapsed)) };
  const i = Math.min(EXAM_STAGES.length - 1, Math.floor(t / EXAM_RULES.stageTime));
  return { index: i, stage: EXAM_STAGES[i], progress: clamp((t - i * EXAM_RULES.stageTime) / EXAM_RULES.stageTime, 0, 1), left: Math.max(0, Math.ceil(s.end - state.elapsed)) };
}
export function sanitizeExams(data, ids) {
  const ex = createExams(); if (!data || typeof data !== 'object') return ex;
  const num = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
  if (Number.isInteger(data.round) && data.round >= 0) ex.round = data.round;
  if (num(data.next, 0, 1e10)) ex.next = data.next;
  ex.queue = (Array.isArray(data.queue) ? data.queue : []).filter(q => q && ids.has(q.id) && ADVENTURER_RANK_RULES[q.rank]).slice(0, EXAM_RULES.maxSeats).map(q => ({ id: q.id, rank: q.rank }));
  const okEntry = e => e && typeof e.name === 'string' && ADVENTURER_RANK_RULES[e.rank] && (typeof e.pass === 'boolean' || e.pass === null);
  const s = data.session;
  // Only rounds saved by the live arena come back (they carry where everyone stands); an older round is simply sat again.
  if (s && num(s.start, 0, 1e10) && num(s.open, s.start, s.start + 600) && num(s.end, s.open, s.open + 600) && s.golem && Array.isArray(s.examiners) && Array.isArray(s.examinees)
    && s.examinees.every(e => okEntry(e) && Array.isArray(e.scores) && e.scores.length === 3 && e.scores.every(v => num(v, 0, 100)) && num(e.x, -200, 200) && num(e.y, -200, 200) && e.rock && e.spot))
    ex.session = JSON.parse(JSON.stringify(s));
  const l = data.last;
  if (l && Array.isArray(l.results) && l.results.every(okEntry)) ex.last = { round: l.round | 0, at: num(l.at, 0, 1e10) ? l.at : 0, results: l.results.map(r => ({ ...r, scores: Array.isArray(r.scores) ? r.scores.slice(0, 3) : undefined })) };
  return ex;
}
