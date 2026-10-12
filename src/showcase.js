/* Big animated shows for the arena: rank exam rounds (three trials, then the results stamped one by one)
   and festivals (a knockout tournament fought match by match, a lantern night, a harvest fair).
   Everything is drawn on one canvas from the game state plus the wall clock for motion. */
import { drawSprite } from './render.js';
import { makeMonster } from './monsters.js';
import { EXAM_STAGES, EXAM_RULES, examStage } from './exams.js';
import { festivalView } from './festivals.js';
import { FESTIVALS, JOBS } from './content.js';

const W = 960, H = 540;
const HAIRS = ['#5b4637', '#8b5a3c', '#d9b26f', '#a66c59', '#6f6a8f', '#e9e2d0', '#73818d', '#c79894'];
const hashOf = s => [...String(s)].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);
/** A body to draw for anyone on the sand: guild members as they are, outsiders from their name. */
function lookOf(state, who) {
  const m = who.kind === 'member' && state.members.find(x => x.id === who.id);
  if (m) return m;
  const f = (state.world?.free || []).find(x => x.id === who.id);
  if (f) return { id: f.id, name: f.name, class: f.class, hair: f.hair };
  return { id: who.id || who.name, name: who.name, class: JOBS[who.cls] ? who.cls : 'warrior', hair: HAIRS[hashOf(who.name) % HAIRS.length] };
}
const rnd = seed => { let a = seed >>> 0 || 7; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; };
const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

// ---- Shared stage dressing ----
function sky(c, top, bottom) { const g = c.createLinearGradient(0, 0, 0, H * .55); g.addColorStop(0, top); g.addColorStop(1, bottom); c.fillStyle = g; c.fillRect(0, 0, W, H * .55); }
function crowd(c, t, y, rows, cheer = 0, night = false) {
  const r = rnd(41);
  for (let row = 0; row < rows; row++) for (let x = -10; x < W + 20; x += 18) {
    const jitter = r() * 8, hop = Math.max(0, Math.sin(t * (5 + r() * 3) + x * .3)) * (2 + cheer * 6) * (r() < .5 + cheer * .4 ? 1 : 0);
    const px = x + jitter + (row % 2) * 9, py = y + row * 16 - hop;
    c.fillStyle = night ? ['#2e2a3e', '#3a3350', '#2b2f45'][row % 3] : ['#8a6f5a', '#a07c66', '#7b6a7f', '#6f7f6a'][Math.floor(r() * 4)];
    c.fillRect(px - 6, py, 12, 14); c.beginPath(); c.arc(px, py - 4, 5.5, 0, Math.PI * 2); c.fill();
    if (cheer > .3 && r() < .35) { c.fillRect(px - 9, py - 10 - hop, 3, 10); c.fillRect(px + 6, py - 10 - hop, 3, 10); }
  }
}
function banners(c, t, colors) {
  for (let i = 0; i < 9; i++) {
    const x = 40 + i * 110, sway = Math.sin(t * 2 + i) * 3;
    c.fillStyle = '#5a4130'; c.fillRect(x, 70, 4, 90);
    c.fillStyle = colors[i % colors.length]; c.beginPath(); c.moveTo(x + 4, 74); c.lineTo(x + 40 + sway, 80); c.lineTo(x + 4, 96); c.closePath(); c.fill();
  }
}
function sand(c, y0 = 300) {
  const g = c.createLinearGradient(0, y0, 0, H); g.addColorStop(0, '#e4cf9e'); g.addColorStop(1, '#c9ad7a'); c.fillStyle = g; c.fillRect(0, y0, W, H - y0);
  c.strokeStyle = '#fff4dc88'; c.lineWidth = 3; c.beginPath(); c.ellipse(W / 2, y0 + 120, 330, 80, 0, 0, Math.PI * 2); c.stroke();
  const r = rnd(9); c.fillStyle = '#bfa06e'; for (let i = 0; i < 140; i++) c.fillRect(r() * W, y0 + r() * (H - y0), 2, 1);
}
function person(c, state, who, x, y, scale = 3, phase = 0, facing = 1, opts = {}) {
  c.save(); c.translate(Math.round(x), Math.round(y));
  if (opts.rot) c.rotate(opts.rot);
  c.scale(scale, scale);
  c.fillStyle = 'rgba(60,40,20,.25)'; c.beginPath(); c.ellipse(0, 0, 8, 2.5, 0, 0, Math.PI * 2); c.fill();
  drawSprite(c, 0, 0, lookOf(state, who), phase, Boolean(opts.walk), facing);
  if (opts.flash) { c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(-14, -34, 28, 36); }
  c.restore();
}
function label(c, text, x, y, size = 16, color = '#fff7e6', align = 'center', stroke = '#3a2a1c') {
  c.font = `700 ${size}px "Noto Sans Thai", "Sarabun", system-ui, sans-serif`; c.textAlign = align; c.textBaseline = 'middle';
  c.lineWidth = Math.max(3, size / 5); c.strokeStyle = stroke; c.strokeText(text, x, y); c.fillStyle = color; c.fillText(text, x, y);
}
function panelLabel(c, text, x, y, size = 16, color = '#5a4a38', align = 'center') { label(c, text, x, y, size, color, align, '#fff3dc'); }
function burst(c, x, y, t, color, n = 10, r0 = 6, r1 = 40) {
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + t * 2, d = r0 + (r1 - r0) * t; c.fillStyle = color; c.globalAlpha = Math.max(0, 1 - t); c.fillRect(x + Math.cos(a) * d - 2, y + Math.sin(a) * d - 2, 4, 4); }
  c.globalAlpha = 1;
}
function confetti(c, t, n = 80) {
  const r = rnd(77), cols = ['#d9584a', '#f4b860', '#7fd0c4', '#b98ad1', '#8fc48a', '#fff1c4'];
  for (let i = 0; i < n; i++) { const x = (r() * W + Math.sin(t * 2 + i) * 30) % W, y = ((r() * H + t * (60 + r() * 80)) % (H + 40)) - 20; c.fillStyle = cols[i % cols.length]; c.save(); c.translate(x, y); c.rotate(t * 3 + i); c.fillRect(-4, -2, 8, 4); c.restore(); }
}
function sweepBanner(c, text, sub, k, color = '#b85a4a') {
  // Slides in from the left, holds, slides out to the right.
  const x = k < .15 ? -W + ease(k / .15) * W : k > .85 ? ease((k - .85) / .15) * W : 0;
  c.save(); c.translate(x, 0); c.fillStyle = color; c.globalAlpha = .92; c.fillRect(0, H / 2 - 56, W, 112); c.globalAlpha = 1;
  c.fillStyle = '#f4b860'; c.fillRect(0, H / 2 - 56, W, 5); c.fillRect(0, H / 2 + 51, W, 5);
  label(c, text, W / 2, H / 2 - 12, 40); label(c, sub, W / 2, H / 2 + 28, 18, '#ffe9c7'); c.restore();
}

// ---- Exam rounds ----
const STAGE_LOOK = ['#b85a4a', '#5a7fa8', '#7a5aa8'];
function scoreboard(c, list, upto, partial, y0) {
  const cols = Math.min(list.length, 8), w = Math.min(112, (W - 40) / cols), x0 = (W - cols * w) / 2;
  list.slice(0, 8).forEach((e, i) => {
    const x = x0 + i * w + w / 2, shown = e.scores.map((v, k) => k < upto ? v : k === upto ? Math.round(v * partial) : 0), total = Math.round(shown.reduce((a, b) => a + b, 0) / 3);
    c.fillStyle = '#fff3dcee'; c.fillRect(x - w / 2 + 4, y0, w - 8, 78);
    panelLabel(c, e.name.slice(0, 9), x, y0 + 12, 13, e.kind === 'member' ? '#8a6420' : '#5a4a38');
    shown.forEach((v, k) => { c.fillStyle = '#e6dac0'; c.fillRect(x - w / 2 + 12, y0 + 26 + k * 12, w - 24, 8); c.fillStyle = STAGE_LOOK[k]; c.fillRect(x - w / 2 + 12, y0 + 26 + k * 12, (w - 24) * v / 100, 8); });
    const passLine = x - w / 2 + 12 + (w - 24) * EXAM_RULES.passMark / 100; c.fillStyle = '#f4b860'; c.fillRect(passLine, y0 + 24, 2, 34);
    panelLabel(c, `${total}`, x, y0 + 68, 14, total >= EXAM_RULES.passMark ? '#4f7a3a' : '#5a4a38');
  });
}
export function drawExamShow(canvas, state, now) {
  const c = canvas.getContext('2d'), t = now / 1000, ex = state.exams, s = ex?.session, st = examStage(state);
  canvas.width = W; canvas.height = H; c.imageSmoothingEnabled = false;
  sky(c, '#8ec5e8', '#f4e2c0'); crowd(c, t, 150, 4, s ? .5 : .2); banners(c, t, ['#b85a4a', '#5a7fa8', '#d9a441']); sand(c);
  if (!s) {
    const last = ex?.last;
    if (last && state.elapsed - last.at < 40) return drawExamResults(c, state, last, t, state.elapsed - last.at);
    label(c, 'สนามสอบเลื่อนแรงค์', W / 2, H / 2 - 30, 34); label(c, `รอบถัดไปเริ่มในอีก ${Math.max(0, Math.ceil(ex.next - state.elapsed))} วินาที · สมัครแล้ว ${ex.queue.length} คน`, W / 2, H / 2 + 14, 18);
    return;
  }
  const list = s.examinees, n = list.length, k = st.index, p = st.progress;
  label(c, `การสอบเลื่อนแรงค์ รอบที่ ${s.round}`, 20, 26, 20, '#fff7e6', 'left'); label(c, `${st.stage.icon} ${st.stage.name} · เหลือ ${st.left} วินาที`, W - 20, 26, 18, '#ffe9c7', 'right');
  const spot = i => ({ x: W / 2 + (i - (n - 1) / 2) * Math.min(105, 840 / n), y: 360 });
  if (k === 0) {
    // Power: everyone strikes a boulder; it cracks as their score fills.
    list.forEach((e, i) => {
      const { x, y } = spot(i), hit = (t * 1.6 + i * .37) % 1, swing = hit < .2;
      const crack = Math.min(1, e.scores[0] / 100 * p * 1.3);
      c.fillStyle = '#8a8f88'; c.beginPath(); c.ellipse(x + 26, y - 14, 20 - crack * 6, 18 - crack * 6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#b3b8b0'; c.beginPath(); c.ellipse(x + 22, y - 18, 12 - crack * 4, 9, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#4a3f3a'; c.lineWidth = 2; for (let j = 0; j < Math.floor(crack * 5); j++) { c.beginPath(); c.moveTo(x + 26, y - 14); c.lineTo(x + 26 + Math.cos(j * 2.3) * 16, y - 14 + Math.sin(j * 2.3) * 14); c.stroke(); }
      person(c, state, e, x - 10 + (swing ? 8 : 0), y, 3, t * 4 + i, 1, { rot: swing ? .25 : 0 });
      if (swing) burst(c, x + 18, y - 20, hit / .2, '#e8dccb', 8, 4, 26);
    });
  } else if (k === 1) {
    // Endurance: the examiner golem swings at the line; weaker candidates stagger back.
    const swing = (t * .8) % 1, gx = W / 2, gy = 330, mon = makeMonster('marbleGolem', swing > .35 && swing < .6 ? 2 : Math.floor(t * 2) % 2), k4 = 4;
    c.fillStyle = 'rgba(60,40,20,.25)'; c.beginPath(); c.ellipse(gx, gy, 70, 16, 0, 0, Math.PI * 2); c.fill();
    c.drawImage(mon.canvas, Math.round(gx - mon.footX * k4), Math.round(gy - mon.footY * k4), mon.canvas.width * k4, mon.canvas.height * k4);
    label(c, 'โกเลมกรรมการ', gx, gy + 18, 14, '#ffe9c7');
    const impact = swing > .45 && swing < .6;
    list.forEach((e, i) => { const { x } = spot(i), y = 420, weak = e.scores[1] < 55, back = impact ? (weak ? 22 : 6) : 0;
      person(c, state, e, x, y + back * .3, 3, t * 3 + i, 1, { flash: impact && weak });
      c.fillStyle = '#6f9ad1'; c.fillRect(x + 10, y - 40 + back * .3, 8, 22); });
    if (impact) { c.fillStyle = '#ffffff55'; c.fillRect(0, 0, W, H); }
  } else {
    // The duel: examiner against each candidate in turn, sparks on every clash.
    const turn = Math.min(n - 1, Math.floor(p * n)), local = (p * n) % 1;
    list.forEach((e, i) => { const { x, y } = spot(i); if (i !== turn) person(c, state, e, x, y + 40, 2, t * 2 + i, 1); });
    const e = list[turn], clash = Math.abs(Math.sin(t * 6)) > .92, lead = e.scores[2] / 100;
    person(c, state, e, W / 2 - 70 + (clash ? 20 : 0), 330, 4, t * 5, 1);
    person(c, state, { name: 'กรรมการ', kind: 'judge', cls: 'paladin' }, W / 2 + 70 - (clash ? 20 : 0), 330, 4, t * 5 + 1, -1);
    if (clash) burst(c, W / 2, 280, (t * 6) % 1, '#fff1c4', 12, 6, 50);
    c.fillStyle = '#fff3dcee'; c.fillRect(W / 2 - 160, 200, 320, 14); c.fillStyle = '#d9584a'; c.fillRect(W / 2 - 158, 202, 316 * (1 - local * (1 - lead)), 10);
    label(c, `${e.name} ดวลกับกรรมการ`, W / 2, 186, 18);
  }
  scoreboard(c, list, k, p, 440);
  if (p < .2) sweepBanner(c, `${st.stage.icon} ด่านที่ ${k + 1}: ${st.stage.name}`, st.stage.text, p / .2, STAGE_LOOK[k]);
}
function drawExamResults(c, state, last, t, age) {
  const list = last.results, n = list.length;
  label(c, `ประกาศผลสอบรอบที่ ${last.round}`, W / 2, 40, 30);
  list.forEach((r, i) => {
    const x = W / 2 + (i - (n - 1) / 2) * Math.min(105, 840 / n), y = 330, show = age - 1 - i * 1.1;
    person(c, state, r, x, y, 3, t * 3 + i, 1);
    label(c, r.name.slice(0, 9), x, y + 22, 13); label(c, `${r.total} คะแนน`, x, y + 40, 12, '#ffe9c7');
    if (show > 0) {
      const k = ease(show / .35), sc = 2.4 - 1.4 * k;
      c.save(); c.translate(x, y - 110); c.rotate(-.2); c.scale(sc, sc); c.globalAlpha = Math.min(1, show * 4);
      c.strokeStyle = r.pass ? '#3f8f4a' : '#b8433a'; c.lineWidth = 4; c.strokeRect(-46, -20, 92, 40);
      label(c, r.pass ? `ผ่าน ${r.rank}` : 'ไม่ผ่าน', 0, 0, 22, r.pass ? '#3f8f4a' : '#b8433a', 'center', '#fff7e6'); c.restore(); c.globalAlpha = 1;
      if (r.pass && show < 1.2) burst(c, x, y - 60, show / 1.2, '#f4b860', 14, 8, 70);
    }
  });
  if (age > 1 + n * 1.1 && list.some(r => r.pass && r.kind === 'member')) confetti(c, t, 60);
}

// ---- Festivals ----
export function drawFestivalShow(canvas, state, now) {
  const c = canvas.getContext('2d'), t = now / 1000, live = state.festivals?.live, v = festivalView(state);
  canvas.width = W; canvas.height = H; c.imageSmoothingEnabled = false;
  if (!live) {
    const last = state.festivals?.history?.[0];
    sky(c, '#8ec5e8', '#f4e2c0'); sand(c, 300); crowd(c, t, 200, 4, .2);
    label(c, last ? `${FESTIVALS[last.kind].name} จบแล้ว` : 'ยังไม่มีเทศกาล', W / 2, H / 2 - 40, 30);
    if (last) last.lines.slice(0, 4).forEach((l, i) => label(c, l, W / 2, H / 2 + i * 26, 16, '#ffe9c7'));
    if (last && state.elapsed - last.at < 15) confetti(c, t, 60);
    return;
  }
  const f = FESTIVALS[live.kind];
  if (live.kind === 'lantern') drawLantern(c, state, live, v, t);
  else if (live.kind === 'harvest') drawHarvest(c, state, live, v, t);
  else drawTournament(c, state, live, v, t);
  label(c, `${f.icon} ${f.name}`, 20, 26, 20, '#fff7e6', 'left');
  label(c, v.phase === 'prep' ? `เตรียมงาน · เริ่มในอีก ${v.left} วินาที` : `ผู้มาเที่ยว ${live.visitors} คน · เหลือ ${v.left} วินาที`, W - 20, 26, 16, '#ffe9c7', 'right');
  label(c, `รางวัล ${live.gold} G${live.item ? ' + ' + live.item.name : ''}`, W - 20, 50, 14, '#f4d48a', 'right');
}
function bunting(c, t, y) {
  const cols = ['#d9584a', '#f4b860', '#5a7fa8', '#8fc48a', '#b98ad1'];
  c.strokeStyle = '#5a4130'; c.lineWidth = 2; c.beginPath(); for (let x = 0; x <= W; x += 20) c.lineTo(x, y + Math.sin(x / W * Math.PI) * 18); c.stroke();
  for (let i = 0; i < 24; i++) { const x = i * 40 + 10, yy = y + Math.sin(x / W * Math.PI) * 18, sway = Math.sin(t * 3 + i) * 2; c.fillStyle = cols[i % cols.length]; c.beginPath(); c.moveTo(x, yy); c.lineTo(x + 16, yy); c.lineTo(x + 8 + sway, yy + 18); c.closePath(); c.fill(); }
}
function bracket(c, live, v) {
  const F = live.fighters, M = live.matches, done = v.done ?? 0, y = 486, w = W / 8;
  c.fillStyle = '#fff3dcee'; c.fillRect(0, y - 26, W, H - y + 26);
  F.forEach((f, i) => {
    const out = M.some((m, k) => k < done && (m.a === i || m.b === i) && m.winner !== i), wins = M.filter((m, k) => k < done && m.winner === i).length;
    const playing = v.current != null && (M[v.current].a === i || M[v.current].b === i), x = i * w + w / 2;
    c.fillStyle = playing ? '#f3d6c9' : out ? '#e9e2d5' : '#fff8e7'; c.fillRect(i * w + 4, y - 18, w - 8, 44);
    panelLabel(c, f.name.split('แห่ง')[0].slice(0, 9), x, y - 2, 13, out ? '#8a7a6a' : f.kind === 'member' ? '#8a6420' : f.kind === 'famous' ? '#a44332' : '#5a4a38');
    panelLabel(c, out ? 'ตกรอบ' : '★'.repeat(wins) || (f.kind === 'member' ? 'กิลด์เรา' : f.kind === 'famous' ? 'คนดัง' : ''), x, y + 16, 11, out ? '#7a6a5a' : '#8a6420');
  });
}
function drawTournament(c, state, live, v, t) {
  sky(c, '#8ec5e8', '#f4e2c0'); crowd(c, t, 168, 5, v.phase === 'live' ? .7 : .3); bunting(c, t, 64); sand(c, 300);
  const F = live.fighters, M = live.matches;
  bracket(c, live, v);
  if (v.phase === 'prep') {
    F.forEach((f, i) => person(c, state, f, 90 + i * 112, 400 + (i % 2) * 22, 3, t * 3 + i, i % 2 ? -1 : 1, { walk: true }));
    label(c, 'ผู้เข้าแข่งขันกำลังวอร์มอัพ · จับสลากสายแล้ว', W / 2, 120, 24);
    return;
  }
  const idx = v.current;
  if (idx == null) {
    const champ = F[live.champion];
    c.fillStyle = '#f4b86055'; c.beginPath(); c.arc(W / 2, 360, 90 + Math.sin(t * 3) * 8, 0, Math.PI * 2); c.fill();
    person(c, state, champ, W / 2, 420, 6, t * 4, 1);
    label(c, '🏆 แชมป์งานประลองยุทธ', W / 2, 110, 26, '#ffe28a'); label(c, champ.name, W / 2, 150, 34); confetti(c, t, 90);
    return;
  }
  const m = M[idx], a = F[m.a], b = F[m.b], k = v.matchProgress, aWins = m.winner === m.a;
  const stageName = ['รอบแปดคน', 'รอบรองชนะเลิศ', 'รอบชิงชนะเลิศ'][m.stage];
  label(c, `${stageName} · คู่ที่ ${idx + 1}/7`, W / 2, 62, 20, '#ffe9c7');
  const hpLoser = Math.max(0, 1 - ease(k / .85)), hpWinner = 1 - (1 - m.left / 100) * ease(k / .85);
  const hpA = aWins ? hpWinner : hpLoser, hpB = aWins ? hpLoser : hpWinner, done = k > .85;
  const clash = !done && Math.abs(Math.sin(t * 5.5)) > .9, ax = W / 2 - 120 + (clash ? 40 : 0), bx = W / 2 + 120 - (clash ? 40 : 0);
  const fallA = done && !aWins, fallB = done && aWins;
  person(c, state, a, ax, 420, 6, t * 5, 1, { rot: fallA ? -1.3 : 0, flash: clash && Math.sin(t * 11) > 0 });
  person(c, state, b, bx, 420, 6, t * 5 + 1, -1, { rot: fallB ? 1.3 : 0, flash: clash && Math.sin(t * 11) < 0 });
  if (clash) { burst(c, W / 2, 340, (t * 5.5) % 1, '#fff1c4', 16, 8, 70); c.fillStyle = '#ffffff33'; c.fillRect(0, 0, W, H); }
  const bar = (x, hp, f, align) => { c.fillStyle = '#fff3dcee'; c.fillRect(x, 88, 330, 26); c.fillStyle = hp > .3 ? '#8fc48a' : '#d9584a'; c.fillRect(align === 'left' ? x + 3 : x + 3 + 324 * (1 - hp), 91, 324 * hp, 20);
    label(c, f.name.slice(0, 16), align === 'left' ? x + 4 : x + 326, 132, 17, f.kind === 'member' ? '#ffe28a' : '#fff7e6', align); label(c, `${JOBS[f.cls]?.name || ''} · พลัง ${f.power}`, align === 'left' ? x + 4 : x + 326, 154, 12, '#ffe9c7', align); };
  bar(24, hpA, a, 'left'); bar(W - 354, hpB, b, 'right');
  label(c, 'VS', W / 2, 101, 34, '#f4b860');
  if (done) label(c, `${(aWins ? a : b).name} ชนะ!`, W / 2, 230, 32, '#ffe28a');
}
function drawLantern(c, state, live, v, t) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1d1d3a'); g.addColorStop(1, '#4a3a5a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const r = rnd(5); c.fillStyle = '#fff6dc'; for (let i = 0; i < 70; i++) { c.globalAlpha = .3 + .7 * Math.abs(Math.sin(t + i)); c.fillRect(r() * W, r() * H * .5, 2, 2); } c.globalAlpha = 1;
  // The stage and the band.
  c.fillStyle = '#6b4f3a'; c.fillRect(W / 2 - 220, 300, 440, 40); c.fillStyle = '#8a6446'; c.fillRect(W / 2 - 220, 292, 440, 10);
  c.fillStyle = '#8a2f3a'; c.fillRect(W / 2 - 230, 150, 30, 150); c.fillRect(W / 2 + 200, 150, 30, 150);
  const band = state.members.slice(0, 4);
  band.forEach((m, i) => person(c, state, { id: m.id, kind: 'member' }, W / 2 - 120 + i * 80, 298 - Math.abs(Math.sin(t * 4 + i)) * 4, 3, t * 3 + i, 1));
  crowd(c, t, 380, 5, .6, true);
  // Lanterns rise faster as the night goes on, and all of them at the end.
  const count = v.phase === 'prep' ? 6 : Math.round(10 + v.progress * 70);
  for (let i = 0; i < count; i++) { const rr = rnd(100 + i), x = rr() * W, speed = 12 + rr() * 22, y = H - ((t * speed + rr() * H) % (H + 60)); c.fillStyle = '#f4b86044'; c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 2); c.fill(); c.fillStyle = '#f4d48a'; c.fillRect(x - 6, y - 8, 12, 14); c.fillStyle = '#fff1c4'; c.fillRect(x - 3, y - 5, 5, 8); }
  if (v.phase === 'live' && v.progress > .85) label(c, 'ปล่อยโคม!', W / 2, 110, 40, '#ffe28a');
}
function drawHarvest(c, state, live, v, t) {
  sky(c, '#9fd0ef', '#f6e6c4');
  c.fillStyle = '#a9ba84'; c.fillRect(0, 270, W, H - 270);
  const cols = ['#d77d6a', '#7fa37a', '#6f9ad1', '#e8b04a'];
  for (let i = 0; i < 6; i++) { const x = 40 + i * 155; c.fillStyle = '#b98a60'; c.fillRect(x, 300, 120, 50); for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? cols[i % 4] : '#f4e5c9'; c.fillRect(x - 6 + k * 22, 270, 22, 26); } c.fillStyle = ['#d9853e', '#8fc48a', '#d8604f'][i % 3]; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(x + 14 + k * 22, 296, 8, 0, Math.PI * 2); c.fill(); } }
  crowd(c, t, 380, 6, .5);
  // The giant-vegetable contest: farms' scores rise through the fair.
  const farms = live.farms || [];
  c.fillStyle = '#fff3dcee'; c.fillRect(W / 2 - 240, 90, 480, 30 + farms.length * 26);
  panelLabel(c, '🎃 ประกวดผลผลิต', W / 2, 108, 18);
  farms.forEach((f, i) => { const sc = Math.round(f.score * Math.min(1, v.progress * 1.2)); c.fillStyle = '#e6dac0'; c.fillRect(W / 2 - 100, 128 + i * 26, 300, 14); c.fillStyle = i === 0 && v.progress > .8 ? '#f4b860' : '#8fc48a'; c.fillRect(W / 2 - 100, 128 + i * 26, 3 * sc, 14); panelLabel(c, f.name, W / 2 - 110, 135 + i * 26, 13, '#5a4a38', 'right'); });
  if (v.progress > .9) confetti(c, t, 40);
}
