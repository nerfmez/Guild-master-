/* Rank exams run in rounds at the village arena. Members sign up (and pay) before a round,
   everyone in the round sits the same three trials together, and the results are read out at the end.
   Pure module: game.js passes a small context of its own helpers. */
import { ADVENTURER_RANK_RULES } from './content.js';

/** A round every half day; three trials of twenty seconds each. */
export const EXAM_RULES = { every: 120, firstAt: 60, stageTime: 20, passMark: 60, maxSeats: 8 };
export const EXAM_STAGES = [
  { id: 'power', name: 'ทุบหินทดสอบพลัง', icon: '🪨', text: 'ผู้สอบทุกคนทุบหินผาให้แตกภายในเวลา' },
  { id: 'guard', name: 'ยืนหยัดใต้ค้อนโกเลม', icon: '🛡', text: 'โกเลมกรรมการเหวี่ยงค้อน ใครล้มก่อนเสียคะแนน' },
  { id: 'duel', name: 'ประลองกับกรรมการ', icon: '⚔', text: 'ดวลหนึ่งต่อหนึ่งกับนักผจญภัยแรงค์สูงของสมาคม' },
];
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

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

/** Scores for the three trials, shaped so the total agrees with the pass/fail roll. */
function rollScores(ctx, chance, pass) {
  const r = () => ctx.random();
  const target = pass ? EXAM_RULES.passMark + 4 + r() * 30 * chance : EXAM_RULES.passMark - 6 - r() * 34 * (1 - chance);
  const spread = [r() - .5, r() - .5, r() - .5].map(x => x * 24), mean = (spread[0] + spread[1] + spread[2]) / 3;
  return spread.map(x => Math.round(clamp(target + x - mean, 5, 100)));
}
function startRound(state, ctx) {
  const ex = state.exams, now = state.elapsed;
  ex.round += 1;
  const examinees = [];
  for (const q of ex.queue) {
    const member = state.members.find(m => m.id === q.id);
    if (!member || ctx.busy(member) || !ADVENTURER_RANK_RULES[q.rank]) { if (member) ctx.refund?.(member, q.rank); continue; }
    const chance = ctx.chance(member, ADVENTURER_RANK_RULES[q.rank]), pass = ctx.random() < chance;
    examinees.push({ id: member.id, kind: 'member', name: member.name, cls: member.class, rank: q.rank, from: member.rank || 'F', chance, pass, scores: rollScores(ctx, chance, pass) });
    member.errand = { kind: 'exam', start: now, end: now + EXAM_RULES.stageTime * EXAM_STAGES.length, rank: q.rank, round: ex.round };
    member.task = 'rest';
  }
  ex.queue = [];
  if (!examinees.length) return;
  // Free adventurers from the inn sit the same round, so members have rivals to beat.
  for (const f of ctx.rivals(Math.min(3, 1 + Math.floor(ctx.random() * 3)))) {
    const chance = .35 + ctx.random() * .4, pass = ctx.random() < chance;
    examinees.push({ id: f.id, kind: 'free', name: f.name, cls: f.class, rank: f.next, from: f.rank, chance, pass, scores: rollScores(ctx, chance, pass) });
  }
  ex.session = { round: ex.round, start: now, end: now + EXAM_RULES.stageTime * EXAM_STAGES.length, examinees };
  ctx.log(`การสอบเลื่อนแรงค์รอบที่ ${ex.round} เริ่มแล้วที่สนามสอบ! ผู้เข้าสอบ ${examinees.length} คน`, 'rank');
  ctx.emit?.({ type: 'examStart', round: ex.round });
}
function finishRound(state, ctx) {
  const ex = state.exams, s = ex.session;
  const results = s.examinees.map(e => ({ id: e.id, kind: e.kind, name: e.name, cls: e.cls, rank: e.rank, from: e.from, total: Math.round(e.scores.reduce((a, b) => a + b, 0) / e.scores.length), pass: e.pass }));
  for (const e of s.examinees) {
    if (e.kind !== 'member') continue;
    const member = state.members.find(m => m.id === e.id); if (!member) continue;
    member.errand = null;
    if (e.pass) { member.rank = e.rank; member.morale = clamp(member.morale + 8, 0, 100); ctx.log(`${member.name}สอบผ่าน! เลื่อนเป็นนักผจญภัยแรงค์ ${e.rank}`, 'rank'); }
    else { member.examReadyAt = state.elapsed + EXAM_RULES.every * .8; member.morale = clamp(member.morale - 6, 0, 100); ctx.log(`${member.name}สอบแรงค์ ${e.rank} ไม่ผ่าน จะฝึกแล้วกลับมาสอบรอบหน้า`, 'warning'); }
  }
  ex.last = { round: s.round, at: state.elapsed, results };
  ex.session = null;
}
/** Advance the arena's calendar: open a round when it is due, read out the results when it ends. */
export function tickExams(state, ctx) {
  const ex = state.exams;
  if (!ctx.arena()) { ex.next = Math.max(ex.next, state.elapsed + EXAM_RULES.firstAt); return; }
  if (ex.session && state.elapsed >= ex.session.end) finishRound(state, ctx);
  if (!ex.session && state.elapsed >= ex.next) { ex.next = state.elapsed + EXAM_RULES.every; startRound(state, ctx); }
}
/** Which trial a running round is on (0-2) and how far through it, for the screens. */
export function examStage(state) {
  const s = state.exams?.session; if (!s) return null;
  const t = Math.max(0, state.elapsed - s.start), i = Math.min(EXAM_STAGES.length - 1, Math.floor(t / EXAM_RULES.stageTime));
  return { index: i, stage: EXAM_STAGES[i], progress: clamp((t - i * EXAM_RULES.stageTime) / EXAM_RULES.stageTime, 0, 1), left: Math.max(0, Math.ceil(s.end - state.elapsed)) };
}
export function sanitizeExams(data, ids) {
  const ex = createExams(); if (!data || typeof data !== 'object') return ex;
  const num = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
  if (Number.isInteger(data.round) && data.round >= 0) ex.round = data.round;
  if (num(data.next, 0, 1e10)) ex.next = data.next;
  ex.queue = (Array.isArray(data.queue) ? data.queue : []).filter(q => q && ids.has(q.id) && ADVENTURER_RANK_RULES[q.rank]).slice(0, EXAM_RULES.maxSeats).map(q => ({ id: q.id, rank: q.rank }));
  const okEntry = e => e && typeof e.name === 'string' && ADVENTURER_RANK_RULES[e.rank] && typeof e.pass === 'boolean';
  const s = data.session;
  if (s && num(s.start, 0, 1e10) && num(s.end, s.start, s.start + 600) && Array.isArray(s.examinees) && s.examinees.every(e => okEntry(e) && Array.isArray(e.scores) && e.scores.length === 3 && e.scores.every(v => num(v, 0, 100))))
    ex.session = { round: Number.isInteger(s.round) ? s.round : ex.round, start: s.start, end: s.end, examinees: s.examinees.map(e => ({ ...e, scores: [...e.scores] })) };
  const l = data.last;
  if (l && Array.isArray(l.results) && l.results.every(okEntry)) ex.last = { round: l.round | 0, at: num(l.at, 0, 1e10) ? l.at : 0, results: l.results.map(r => ({ ...r })) };
  return ex;
}
