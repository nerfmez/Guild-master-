/* Live shows in the village: the people of a festival or an exam round really walk in, fight, perform and get judged
   on the map, a little at a time, and the result comes out of what happens. Shared by festivals.js and exams.js.
   Pure module (grid units); the effects go to the renderer through the same channel as the hunting grounds. */
import { JOBS } from './content.js';
import { emitFx } from './life.js';

export const SHOW_DT = 0.1;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
/** How each line of work fights in a show: reach, swing time, the hit's look and its signature move. */
export const SHOW_STYLE = {
  warrior: { reach: .95, cd: 1, ranged: false, hit: 'slash', skill: 'cleave', skillName: 'ฟันหนัก', mult: 1.9 },
  archer: { reach: 3, cd: 1.15, ranged: true, hit: 'arrow', skill: 'volley', skillName: 'ยิงสามดอก', mult: 1.7 },
  mage: { reach: 2.7, cd: 1.4, ranged: true, hit: 'fire', skill: 'fireball', skillName: 'ลูกไฟ', mult: 2.1 },
  healer: { reach: 1, cd: 1.1, ranged: false, hit: 'light', skill: 'mend', skillName: 'แสงอวยพร', mult: 1 },
};
export const rootClass = cls => { let id = cls; for (let i = 0; i < 4 && JOBS[id]?.parent; i++) id = JOBS[id].parent; return SHOW_STYLE[JOBS[id]?.base || id] ? (JOBS[id]?.base || id) : 'warrior'; };
export const fx = e => emitFx({ show: true, ...e });

/** Someone in a show: where they are, where they are going, and what they are doing. */
export function showActor(o) {
  return { mode: 'walk', path: [], hp: 100, maxHp: 100, cd: .5, skillCd: 3, swing: 0, fx: 0, fy: 1, ...o, tx: o.tx ?? o.x, ty: o.ty ?? o.y };
}
/** Send an actor along the road: out of the door, down to the street, along it, then up to the spot. */
export function walkTo(a, spot, street = 17.5) {
  const pts = [];
  if (Math.abs(a.y - spot.y) > 4 && Math.abs(a.x - spot.x) > 2) { pts.push({ x: a.x, y: street }, { x: spot.x, y: street }); }
  pts.push({ x: spot.x, y: spot.y });
  a.path = pts; a.mode = 'walk';
}
export function goTo(a, spot) { a.path = [{ x: spot.x, y: spot.y }]; a.mode = 'walk'; }
/** One step along the path; true when the actor has arrived. */
export function stepActor(a, dt, speed = 1.6) {
  if (!a.path?.length) return true;
  let left = speed * dt;
  while (left > 0 && a.path.length) {
    const p = a.path[0], d = Math.hypot(p.x - a.x, p.y - a.y);
    if (d > 1e-3) { a.fx = (p.x - a.x) / d; a.fy = (p.y - a.y) / d; }
    if (d <= left) { a.x = p.x; a.y = p.y; a.path.shift(); left -= d; }
    else { a.x += (p.x - a.x) / d * left; a.y += (p.y - a.y) / d * left; left = 0; }
  }
  if (!a.path.length && a.mode === 'walk') a.mode = 'idle';
  return !a.path.length;
}
export function stepAll(list, dt, speed) { for (const a of list) if (a.path?.length) stepActor(a, dt, speed); }

/** One tick of a one-on-one fight inside a ring. `atk` is each side's damage per normal hit; returns the loser when one falls. */
export function duelStep(a, b, dt, rand, ring) {
  for (const [s, o] of [[a, b], [b, a]]) {
    if (s.hp <= 0 || o.hp <= 0) continue;
    const st = SHOW_STYLE[rootClass(s.cls)] || SHOW_STYLE.warrior, d = dist(s, o);
    s.cd -= dt; s.skillCd -= dt; s.swing = Math.max(0, s.swing - dt); s.stun = Math.max(0, (s.stun || 0) - dt);
    if (s.stun > 0) continue;
    const dx = (o.x - s.x) / (d || 1), dy = (o.y - s.y) / (d || 1); s.fx = dx; s.fy = dy;
    // Fighters at range keep their distance; close fighters press in.
    let mx = 0, my = 0;
    if (st.ranged && d < 1.5) { mx = -dx; my = -dy; } else if (d > st.reach) { mx = dx; my = dy; }
    if (mx || my) {
      const sp = (st.ranged ? 1.3 : 1.6) * dt;
      s.x += mx * sp; s.y += my * sp;
      if (ring) { const rx = s.x - ring.x, ry = (s.y - ring.y) / .8, rd = Math.hypot(rx, ry); if (rd > ring.r) { s.x = ring.x + rx / rd * ring.r; s.y = ring.y + ry / rd * ring.r * .8; } }
    }
    if (d > st.reach + .15 || s.cd > 0) continue;
    s.cd = st.cd * (.9 + rand() * .2); s.swing = .3;
    const crit = rand() < .12, big = s.skillCd <= 0;
    let dmg = s.atk * (.85 + rand() * .3) * (crit ? 1.6 : 1);
    if (big) {
      s.skillCd = 5 + rand() * 2.5;
      fx({ type: 'skill', id: s.id, x: s.x, y: s.y, tx: o.x, ty: o.y, skill: st.skill, name: st.skillName });
      if (st.skill === 'mend') { const heal = Math.round(s.maxHp * .22); s.hp = Math.min(s.maxHp, s.hp + heal); fx({ type: 'heal', x: s.x, y: s.y, amount: heal }); dmg *= .8; }
      else dmg *= st.mult;
    }
    dmg = Math.max(1, Math.round(dmg));
    o.hp = Math.max(0, o.hp - dmg);
    fx({ type: 'hit', id: o.id, from: s.id, x: o.x, y: o.y, fx: s.x, fy: s.y, amount: dmg, kind: st.hit, crit: crit || big });
    if (o.hp <= 0) { o.mode = 'down'; s.mode = 'cheer'; return o; }
  }
  return null;
}
/** Damage per normal hit for a fight of about ten blows between equals, with strength mattering a good deal. */
export function duelAtk(mine, theirs) { return 10 * Math.pow(Math.max(1, mine) / Math.max(1, theirs), .9); }

/** Where things happen at a venue, from the building's rectangle (grid units) and which way its door faces. */
export function venueGeometry(rect) {
  const rot = rect.rot === 1, cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const front = rot ? { x: rect.x + rect.w + .6, y: cy } : { x: cx, y: rect.y + rect.h + .6 };
  return { rect, rot, center: { x: cx, y: cy }, front, ring: { x: cx, y: cy + .1, r: Math.min(rect.w, rect.h) * .36 } };
}
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export { clamp };
