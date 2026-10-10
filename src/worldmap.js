/* World map: the guild and village in the middle, regions around, teams walking out to their quests. */
import { drawSprite, drawFoe } from './render.js';
import { QUESTS, JOBS, REGIONS, RANKS } from './content.js';

const T = 8, COLS = 150, ROWS = 100, W = COLS * T, H = ROWS * T;
const GATE = { x: 75, y: 61 };
// Region zones, roads from the guild gate, and where each quest happens.
const ZONES = {
  meadow: { x: 42, y: 72, rx: 24, ry: 17, ground: '#c9dcaa', edge: '#a9c88f', name: 'ทุ่งใบชา' },
  ruins: { x: 114, y: 30, rx: 22, ry: 16, ground: '#d6cfbd', edge: '#b8ae98', name: 'ซากหอระฆัง' },
  mist: { x: 34, y: 24, rx: 24, ry: 17, ground: '#a7bdb4', edge: '#86a39a', name: 'ป่าหมอกจันทร์' },
};
const ROADS = { meadow: [[68, 66], [56, 70]], ruins: [[86, 54], [100, 42]], mist: [[70, 48], [52, 34]] };
const SITES = {
  patrol: [58, 74], herbs: [34, 78], escort: [46, 64],
  hollow: [104, 36], crystals: [120, 22], ruins: [124, 36],
  mistpath: [44, 28], rescue: [28, 18], heart: [22, 28],
};
const AMBIENT = { meadow: 'patrol', ruins: 'crystals', mist: 'mistpath' };
const VILLAGE = [[64, 63, '#94b7c5'], [86, 64, '#d98978'], [60, 56, '#b7aec9'], [90, 57, '#94b7c5'], [68, 70, '#e7bd74'], [83, 71, '#90b89c']];

function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }
const rect = (c, x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const blob = (c, x, y, r, color) => { for (let dy = -r; dy <= r; dy++) { const w = Math.round(Math.sqrt(r * r - dy * dy)); rect(c, x - w, y + dy, w * 2, 1, color); } };
const inZone = (z, x, y, pad = 1) => ((x - z.x) / (z.rx * pad)) ** 2 + ((y - z.y) / (z.ry * pad)) ** 2 <= 1;
const regionOpen = (state, id) => RANKS.indexOf(state.rank) >= RANKS.indexOf(REGIONS.find(r => r.id === id)?.rank || 'F');

function routeFor(quest) {
  const site = SITES[quest.id] || [ZONES[quest.region].x, ZONES[quest.region].y];
  return [[GATE.x, GATE.y], ...(ROADS[quest.region] || []), site].map(([x, y]) => ({ x: x * T, y: y * T }));
}
function along(points, d) {
  let left = Math.max(0, d);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= len || i === points.length - 1) { const k = len ? Math.min(1, left / len) : 0, dx = b.x - a.x, dy = b.y - a.y; return { x: a.x + dx * k, y: a.y + dy * k, dir: Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'west' : 'east') : (dy < 0 ? 'north' : 'south') }; }
    left -= len;
  }
  return { ...points[points.length - 1], dir: 'south' };
}
const lengthOf = points => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);

function paintWorld(state) {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d'), r = rng(4242); c.imageSmoothingEnabled = false;
  rect(c, 0, 0, W, H, '#b7cf98');
  for (let i = 0; i < 2600; i++) rect(c, r() * W, r() * H, 2 + r() * 4, 1, ['#aac58c', '#c2d7a3', '#a3be86'][i % 3]);
  // Region grounds with soft edges.
  for (const [id, z] of Object.entries(ZONES)) for (let y = z.y - z.ry - 2; y <= z.y + z.ry + 2; y++) for (let x = z.x - z.rx - 2; x <= z.x + z.rx + 2; x++) {
    if (inZone(z, x, y)) { rect(c, x * T, y * T, T, T, z.ground); if (r() < .18) rect(c, x * T + 2, y * T + 3, 4 + r() * 6, 2, z.edge); if (id === 'ruins' && r() < .06) rect(c, x * T + 1, y * T + 1, T - 2, T - 2, '#c4bba6'); }
    else if (inZone(z, x, y, 1.12) && r() < .45) rect(c, x * T + r() * 4, y * T + r() * 4, T - 2, T - 2, z.ground);
  }
  // A pond and the river bend give the land some shape.
  for (let i = 0; i < 40; i++) blob(c, (96 + Math.sin(i / 6) * 6) * T + i * 3, (80 + i * .45) * T, 9, '#9cc3cf');
  blob(c, 52 * T, 88 * T, 26, '#9cc3cf'); blob(c, 52 * T, 88 * T, 20, '#b2d3dc');
  // Roads: wide dirt from the gate out to each region.
  for (const [id, pts] of Object.entries(ROADS)) {
    const all = [[GATE.x, GATE.y], ...pts, [ZONES[id].x, ZONES[id].y]];
    for (let i = 1; i < all.length; i++) { const [ax, ay] = all[i - 1], [bx, by] = all[i], steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 2); for (let s = 0; s <= steps; s++) { const k = s / steps; blob(c, (ax + (bx - ax) * k) * T, (ay + (by - ay) * k) * T, 7, '#c9b58b'); blob(c, (ax + (bx - ax) * k) * T, (ay + (by - ay) * k) * T, 5, '#e3d2a8'); } }
  }
  // Trees and props, kept off roads, the village and quest sites.
  const clear = (x, y) => Math.hypot(x - 75, y - 62) < 18 || Object.values(SITES).some(([sx, sy]) => Math.hypot(x - sx, y - sy) < 5);
  for (let i = 0; i < 520; i++) {
    const x = r() * COLS, y = r() * ROWS, px = x * T, py = y * T; if (clear(x, y)) continue;
    const pixel = c.getImageData(px | 0, py | 0, 1, 1).data; if (pixel[0] > 195 && pixel[1] > 180 && pixel[2] < 175 && pixel[2] > 120) continue;
    const mist = inZone(ZONES.mist, x, y, 1.1), ruins = inZone(ZONES.ruins, x, y, 1.05);
    if (ruins && r() < .6) { rect(c, px - 4, py - 10, 8, 14, '#b8b0a0'); rect(c, px - 4, py - 10, 8, 2, '#d8d0bd'); rect(c, px - 4, py + 2, 8, 2, '#8b8477'); continue; }
    const leaf = mist ? ['#6f8f86', '#8aa9a0'] : ['#7fa678', '#a3c693'];
    rect(c, px - 1, py, 3, 6, '#7b5d45'); blob(c, px, py + 3, 7, '#00000020'); blob(c, px, py - 3, 7, leaf[0]); blob(c, px - 2, py - 5, 4, leaf[1]);
    if (mist && r() < .25) { rect(c, px + 6, py + 3, 3, 2, '#c9e6f0'); rect(c, px + 7, py + 5, 1, 2, '#e8e3d0'); }
  }
  for (let i = 0; i < 90; i++) { const x = r() * COLS, y = r() * ROWS; if (!clear(x, y) && inZone(ZONES.meadow, x, y)) rect(c, x * T, y * T, 3, 3, ['#f2b8a8', '#fff3d6', '#f4d49a'][i % 3]); }
  // Village houses around the guild, and the guild hall itself.
  for (const [x, y, roof] of VILLAGE) house(c, x * T, y * T, roof, 1);
  house(c, 75 * T, 57 * T, '#d98978', 1.7);
  rect(c, 75 * T - 2, 50 * T, 2, 14, '#7b5d45'); rect(c, 75 * T, 50 * T, 12, 8, '#d98978'); rect(c, 75 * T + 3, 51 * T + 2, 6, 4, '#fff8e7');
  rect(c, 79 * T, 66 * T, 6, 6, '#8a8f8a'); rect(c, 79 * T + 1, 66 * T + 1, 4, 4, '#9cc3cf');
  // Locked regions sit under a dark veil with a padlock.
  for (const [id, z] of Object.entries(ZONES)) if (!regionOpen(state, id)) {
    c.globalAlpha = .55; for (let y = z.y - z.ry; y <= z.y + z.ry; y++) for (let x = z.x - z.rx; x <= z.x + z.rx; x++) if (inZone(z, x, y, 1.08)) rect(c, x * T, y * T, T, T, '#2b2a28'); c.globalAlpha = 1;
    const px = z.x * T, py = z.y * T; rect(c, px - 9, py - 4, 18, 14, '#4f4540'); rect(c, px - 8, py - 3, 16, 12, '#e7bd74'); rect(c, px - 5, py - 11, 10, 2, '#fff1c4'); rect(c, px - 5, py - 11, 2, 8, '#fff1c4'); rect(c, px + 3, py - 11, 2, 8, '#fff1c4'); rect(c, px - 1, py + 1, 2, 5, '#6f5a3a');
  }
  return canvas;
}
function house(c, x, y, roof, s) {
  const w = 22 * s, h = 14 * s;
  rect(c, x - w / 2 + 2, y + 2, w, h, '#00000022'); rect(c, x - w / 2, y, w, h, '#efe2c8'); rect(c, x - w / 2, y + h - 2, w, 2, '#c9b893');
  c.fillStyle = roof; c.beginPath(); c.moveTo(x - w / 2 - 3, y + 1); c.lineTo(x, y - 10 * s); c.lineTo(x + w / 2 + 3, y + 1); c.closePath(); c.fill();
  rect(c, x - w / 2 - 3, y, w + 6, 2, '#00000026'); rect(c, x - 2 * s, y + h - 7 * s, 4 * s, 7 * s, '#8a6a4a'); rect(c, x + 4 * s, y + 4 * s, 4 * s, 3 * s, '#9cc3cf');
}

/** Interactive world map drawn on its own canvas over the guild scene. */
export class WorldMap {
  constructor(canvas, { onTeam = () => {}, onRegion = () => {} } = {}) {
    this.canvas = canvas; this.onTeam = onTeam; this.onRegion = onRegion;
    this.zoom = 1.5; this.cx = 72 * T; this.cy = 62 * T; this.pointers = new Map(); this.memory = new Map(); this.teams = []; this.clock = 0; this.last = 0;
    const on = (name, fn, opts) => canvas.addEventListener(name, fn, opts);
    on('pointerdown', e => { canvas.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (this.pointers.size === 1) this.drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false }; if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom }; } });
    on('pointermove', e => {
      if (!this.pointers.has(e.pointerId)) return; this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2 && this.pinch) { const [a, b] = [...this.pointers.values()]; this.setZoom(this.pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / this.pinch.d); return; }
      const d = this.drag; if (!d) return; if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6) d.moved = true;
      if (d.moved) { this.cx -= (e.clientX - d.x) / this.zoom; this.cy -= (e.clientY - d.y) / this.zoom; this.clamp(); } d.x = e.clientX; d.y = e.clientY;
    });
    const end = e => { if (this.drag && !this.drag.moved && this.pointers.size === 1) this.tap(e); this.pointers.delete(e.pointerId); if (this.pointers.size < 2) this.pinch = null; if (!this.pointers.size) this.drag = null; };
    on('pointerup', end); on('pointercancel', e => { this.pointers.delete(e.pointerId); this.drag = null; this.pinch = null; });
    on('wheel', e => { e.preventDefault(); this.setZoom(this.zoom * Math.exp(-e.deltaY * .0015)); }, { passive: false });
  }
  setZoom(z) { this.zoom = Math.max(1, Math.min(4, z)); this.clamp(); }
  home() { this.zoom = 1.5; this.cx = 72 * T; this.cy = 62 * T; this.clamp(); }
  clamp() { const b = this.canvas.getBoundingClientRect(), hw = b.width / 2 / this.zoom, hh = b.height / 2 / this.zoom; this.cx = Math.max(Math.min(hw, W / 2), Math.min(W - Math.min(hw, W / 2), this.cx)); this.cy = Math.max(Math.min(hh, H / 2), Math.min(H - Math.min(hh, H / 2), this.cy)); }
  toWorld(e) { const b = this.canvas.getBoundingClientRect(); return { x: (e.clientX - b.left - b.width / 2) / this.zoom + this.cx, y: (e.clientY - b.top - b.height / 2) / this.zoom + this.cy }; }
  tap(e) {
    const p = this.toWorld(e);
    const team = this.teams.find(t => Math.abs(p.x - t.x) < 16 && p.y > t.y - 30 && p.y < t.y + 8); if (team) { this.onTeam(team.id); return; }
    const zone = Object.entries(ZONES).find(([, z]) => inZone(z, p.x / T, p.y / T)); if (zone) this.onRegion(zone[0]);
  }
  /** Draw a frame. Positions come from each mission's progress, so the map always agrees with the engine. */
  draw(state, now, paused) {
    const c = this.canvas.getContext('2d'), b = this.canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (!b.width || !b.height) return;
    if (this.canvas.width !== Math.round(b.width * dpr) || this.canvas.height !== Math.round(b.height * dpr)) { this.canvas.width = Math.round(b.width * dpr); this.canvas.height = Math.round(b.height * dpr); this.clamp(); }
    if (!paused) this.clock += Math.max(0, Math.min(.1, now - (this.last || now))); this.last = now;
    const t = this.clock, key = state.rank;
    if (this.paintedFor !== key) { this.painting = paintWorld(state); this.paintedFor = key; }
    c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false; rect(c, 0, 0, this.canvas.width, this.canvas.height, '#9fbd84');
    c.setTransform(this.zoom * dpr, 0, 0, this.zoom * dpr, (b.width / 2 - this.cx * this.zoom) * dpr, (b.height / 2 - this.cy * this.zoom) * dpr);
    c.drawImage(this.painting, 0, 0);
    const actors = [];
    // Monsters roam their regions.
    for (const [id, z] of Object.entries(ZONES)) {
      if (!regionOpen(state, id)) continue; const quest = QUESTS.find(q => q.id === AMBIENT[id]);
      for (let i = 0; i < 4; i++) { const a = t * .25 + i * 1.7, x = (z.x + Math.cos(a + i) * z.rx * .55) * T, y = (z.y + Math.sin(a * 1.3 + i * 2) * z.ry * .5) * T; actors.push({ y, draw: () => { c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(.3, .3); drawFoe(c, 0, 0, quest, t, false); c.restore(); } }); }
    }
    // Quest sites: a small flag, with the quest name when zoomed in.
    for (const q of QUESTS) { if (!regionOpen(state, q.region)) continue; const [sx, sy] = SITES[q.id]; rect(c, sx * T, sy * T - 12, 1, 12, '#7b5d45'); rect(c, sx * T + 1, sy * T - 12, 7, 5, state.completedQuests?.[q.id] ? '#90b89c' : '#e7bd74'); }
    // Teams on their way, fighting, or heading home.
    this.teams = [];
    for (const m of (state.missions || []).filter(m => m.status === 'active' || m.status === 'decision')) {
      const quest = QUESTS.find(q => q.id === m.questId); if (!quest) continue;
      const route = routeFor(quest), total = lengthOf(route), ratio = Math.max(0, Math.min(1, m.progress / (m.duration || 1)));
      let mem = this.memory.get(m.id); if (!mem) { mem = { strike: m.combat?.lastStrike || 0, strikeAt: -9, wave: 0 }; this.memory.set(m.id, mem); }
      if (mem.strike !== (m.combat?.lastStrike || 0)) { mem.strike = m.combat?.lastStrike || 0; mem.strikeAt = t; }
      const phase = ratio < .18 ? 'go' : ratio < .88 ? 'fight' : 'back', wave = phase === 'fight' ? Math.min(2, Math.floor((ratio - .18) / .7 * 3)) : -1;
      if (wave !== mem.wave) { if (mem.wave >= 0) mem.poofAt = t; mem.wave = wave; }
      const members = m.memberIds.map(id => state.members.find(x => x.id === id)).filter(Boolean), site = route[route.length - 1];
      const foe = { x: site.x + 18, y: site.y + 2 };
      const spots = members.map((member, i) => {
        if (phase === 'fight') return { member, x: site.x - 4 - (i === 1 ? 8 : 0), y: site.y - 8 + i * 9, dir: 'east', walking: false };
        const d = phase === 'go' ? total * ratio / .18 : total * (1 - (ratio - .88) / .12), p = along(route, phase === 'go' ? d - i * 12 : d + i * 12);
        return { member, x: p.x, y: p.y + 6, dir: phase === 'back' ? ({ east: 'west', west: 'east', north: 'south', south: 'north' })[p.dir] : p.dir, walking: !paused };
      });
      const age = t - mem.strikeAt, striking = phase === 'fight' && !paused && age >= 0 && age < .7, striker = striking ? spots.find(s => s.member.id === m.combat?.log?.[0]?.memberId) : null;
      if (phase === 'fight') actors.push({ y: foe.y, draw: () => { c.save(); c.translate(Math.round(foe.x), Math.round(foe.y + Math.sin(t * 3) * 1.5)); c.scale(wave === 2 ? .5 : .36, wave === 2 ? .5 : .36); drawFoe(c, 0, 0, quest, t, striking && age > .28 && age < .42); c.restore(); } });
      for (const s of spots) actors.push({ y: s.y, draw: () => {
        let x = s.x, pose = phase === 'fight' ? (Math.floor(t * 1.6 + s.y) % 2 ? 'breath' : 'idle') : 'idle';
        if (s === striker) { x += Math.round(Math.sin(Math.min(1, age / .7) * Math.PI) * 7); pose = age < .25 ? 'train0' : 'train1'; }
        drawSprite(c, x, s.y, s.member, t * 8 + s.y, s.walking && phase !== 'fight', 1, s.dir, pose);
      } });
      const lead = spots[0]; if (!lead) continue;
      this.teams.push({ id: m.id, x: lead.x, y: lead.y });
      actors.push({ y: 1e6, draw: () => {
        // Effects above everyone: strike sparks, damage numbers, poof on a defeated foe, the team's tag.
        if (striking) { const role = JOBS[striker?.member.class]?.role || 'damage'; if (age > .1 && age < .32 && striker && role !== 'tank' && role !== 'damage') { const k = (age - .1) / .22; rect(c, striker.x + (foe.x - striker.x) * k - 2, striker.y - 10 + (foe.y - 10 - striker.y + 10) * k - 2, 4, 4, role === 'scout' ? '#8a6a4a' : role === 'heal' ? '#f4d49a' : '#b7c9f2'); }
          if (age > .22 && age < .45) { c.strokeStyle = '#fff8e7'; c.lineWidth = 2; c.beginPath(); c.arc(foe.x - 2, foe.y - 10, 8, -2.4, -.4); c.stroke(); }
          const dmg = m.combat?.log?.[0]?.damage; if (age > .28 && Number.isFinite(dmg)) { c.font = 'bold 9px sans-serif'; c.fillStyle = '#4f4540'; c.fillText(String(dmg), foe.x - 3, foe.y - 24 - age * 12); c.fillStyle = '#fff1c4'; c.fillText(String(dmg), foe.x - 4, foe.y - 25 - age * 12); } }
        const pa = t - (mem.poofAt ?? -9); if (pa >= 0 && pa < .8) { c.globalAlpha = 1 - pa / .8; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; rect(c, foe.x + Math.cos(a) * (3 + pa * 16) - 2, foe.y - 6 + Math.sin(a) * (2 + pa * 9) - pa * 5, 5, 4, '#f3ead2'); } c.globalAlpha = 1; }
        const label = quest.name, w = Math.min(90, label.length * 4.6 + 12), tx = lead.x - w / 2, ty = lead.y - 40;
        rect(c, tx - 1, ty - 1, w + 2, 15, '#4f4540'); rect(c, tx, ty, w, 13, m.event && !m.event.resolved ? '#fff1c4' : '#f8edd3');
        c.font = 'bold 7px "Noto Sans Thai", sans-serif'; c.fillStyle = '#5a4a36'; c.textBaseline = 'middle'; c.fillText((m.event && !m.event.resolved ? '! ' : '') + label, tx + 4, ty + 5);
        rect(c, tx + 3, ty + 10, w - 6, 2, '#e6dcc4'); rect(c, tx + 3, ty + 10, (w - 6) * ratio, 2, '#7fae6f');
      } });
    }
    actors.sort((a, b) => a.y - b.y).forEach(a => a.draw());
    // Region names and drifting cloud shadows.
    for (const [id, z] of Object.entries(ZONES)) { const open = regionOpen(state, id); c.font = 'bold 9px "Noto Sans Thai", sans-serif'; const text = open ? z.name : `${z.name} · กิลด์ ${REGIONS.find(r => r.id === id)?.rank}`, w = c.measureText(text).width + 12; rect(c, z.x * T - w / 2, (z.y - z.ry) * T - 4, w, 14, open ? '#3d352cb0' : '#2b2a28d0'); c.fillStyle = '#fff8e7'; c.textBaseline = 'middle'; c.fillText(text, z.x * T - w / 2 + 6, (z.y - z.ry) * T + 3); }
    c.font = 'bold 9px "Noto Sans Thai", sans-serif'; { const text = 'กิลด์ · หมู่บ้าน', w = c.measureText(text).width + 12; rect(c, 75 * T - w / 2, 73 * T, w, 14, '#d98978d8'); c.fillStyle = '#fff8e7'; c.fillText(text, 75 * T - w / 2 + 6, 73 * T + 7); }
    for (const id of [...this.memory.keys()]) if (!(state.missions || []).some(m => m.id === id && (m.status === 'active' || m.status === 'decision'))) this.memory.delete(id);
  }
}
