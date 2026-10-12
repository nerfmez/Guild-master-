/* Sound for the guild: gentle generative music that follows the camera (village, meadow, misty woods, canyon,
   dragon peak, festivals, boss fights) and small synthesized effects for combat and the menus.
   Everything is made with WebAudio oscillators and noise: no audio files, nothing to download. */

let ctx = null, master = null, musicBus = null, fxBus = null, noiseBuf = null;
const opts = { music: true, sfx: true, volume: .8 };
function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = opts.volume; master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = opts.music ? .32 : 0; musicBus.connect(master);
  fxBus = ctx.createGain(); fxBus.gain.value = opts.sfx ? .5 : 0; fxBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}
/** Browsers start audio only after a tap or key: call this from the first user gesture. */
export function unlockAudio() { if (!ensure()) return; if (ctx.state === 'suspended') ctx.resume(); }
export function setAudio(next = {}) {
  Object.assign(opts, next);
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(opts.volume, t, .05);
  musicBus.gain.setTargetAtTime(opts.music ? .32 : 0, t, .3);
  fxBus.gain.setTargetAtTime(opts.sfx ? .5 : 0, t, .05);
}
export const audioOptions = () => ({ ...opts });

// ---- Tiny synth voices ----
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
function tone(bus, freq, start, dur, { type = 'triangle', gain = .2, attack = .01, release = .25, detune = 0, slide = 0, filter = 0 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, start); o.detune.value = detune;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), start + dur);
  g.gain.setValueAtTime(0, start); g.gain.linearRampToValueAtTime(gain, start + attack);
  g.gain.setValueAtTime(gain, start + Math.max(attack, dur - release)); g.gain.exponentialRampToValueAtTime(.0005, start + dur + release);
  let out = g;
  if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; g.connect(f); out = f; }
  o.connect(g); out.connect(bus); o.start(start); o.stop(start + dur + release + .05);
}
function noise(bus, start, dur, { gain = .2, type = 'bandpass', freq = 1200, q = 1, sweep = 0 } = {}) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, start); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), start + dur);
  g.gain.setValueAtTime(gain, start); g.gain.exponentialRampToValueAtTime(.0005, start + dur);
  s.connect(f); f.connect(g); g.connect(bus); s.start(start); s.stop(start + dur + .05);
}

// ---- Music: each area has a scale, a tempo and an instrument; a little seeded generator plays it forever. ----
const AREAS = {
  village: { name: 'หมู่บ้าน', bpm: 84, root: 60, scale: [0, 2, 4, 7, 9], lead: 'triangle', bass: 'sine', pad: [0, 4, 7], drum: 'soft', density: .55 },
  meadow: { name: 'ทุ่งใบชา', bpm: 92, root: 62, scale: [0, 2, 4, 7, 9], lead: 'square', bass: 'triangle', pad: [0, 7, 12], drum: 'soft', density: .5, leadGain: .05 },
  mist: { name: 'ป่าหมอก', bpm: 66, root: 57, scale: [0, 2, 3, 7, 8], lead: 'sine', bass: 'sine', pad: [0, 3, 7], drum: null, density: .35 },
  canyon: { name: 'หุบผา', bpm: 100, root: 55, scale: [0, 3, 5, 7, 10], lead: 'sawtooth', bass: 'triangle', pad: [0, 7], drum: 'hand', density: .5, leadGain: .035, filter: 1800 },
  peak: { name: 'ยอดเขา', bpm: 76, root: 50, scale: [0, 1, 5, 7, 8], lead: 'sawtooth', bass: 'sawtooth', pad: [0, 7], drum: 'deep', density: .4, leadGain: .03, filter: 1200 },
  boss: { name: 'บอส', bpm: 138, root: 50, scale: [0, 1, 3, 6, 7], lead: 'square', bass: 'sawtooth', pad: [0, 6], drum: 'battle', density: .75, leadGain: .04, filter: 2200 },
  festival: { name: 'เทศกาล', bpm: 120, root: 65, scale: [0, 2, 4, 5, 7, 9], lead: 'square', bass: 'triangle', pad: [0, 4, 7], drum: 'party', density: .7, leadGain: .045 },
  night: { name: 'โคมลอย', bpm: 70, root: 62, scale: [0, 2, 4, 7, 9], lead: 'sine', bass: 'sine', pad: [0, 4, 7, 11], drum: null, density: .4 },
};
let area = null, nextBar = 0, bar = 0, timer = null, seed = 1;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
function scheduleBar(a, t0) {
  const beat = 60 / a.bpm, steps = 8, step = beat / 2, chordRoot = [0, 5, 3, 4][bar % 4], sc = a.scale;
  const deg = k => a.root + sc[((k % sc.length) + sc.length) % sc.length] + 12 * Math.floor(k / sc.length);
  // Pad: a soft chord held for the whole bar.
  for (const iv of a.pad) tone(musicBus, midi(a.root - 12 + iv + [0, 5, -3, 7][bar % 4] % 12), t0, beat * 4 - .1, { type: 'sine', gain: .028, attack: .4, release: .6, filter: 900 });
  // Bass on beats 1 and 3.
  for (const b of [0, 2]) tone(musicBus, midi(deg(chordRoot) - 24), t0 + b * beat, beat * .9, { type: a.bass, gain: .07, attack: .01, release: .15, filter: 500 });
  // Lead: a stepwise walk over the scale, resting now and then.
  let k = chordRoot + 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < steps; i++) {
    if (rnd() > a.density) continue;
    k += [-2, -1, -1, 0, 1, 1, 2][Math.floor(rnd() * 7)];
    k = Math.max(2, Math.min(12, k));
    tone(musicBus, midi(deg(k)), t0 + i * step, step * (rnd() < .3 ? 1.8 : .9), { type: a.lead, gain: a.leadGain || .06, attack: .008, release: .18, filter: a.filter || 0 });
  }
  // Percussion.
  if (a.drum) for (let i = 0; i < steps; i++) {
    const t = t0 + i * step;
    if (a.drum === 'soft' && i % 4 === 2) noise(musicBus, t, .05, { gain: .03, freq: 6000, q: .7 });
    if (a.drum === 'hand' && (i % 3 === 0 || i === 7)) tone(musicBus, i % 3 ? 220 : 140, t, .08, { type: 'sine', gain: .09, slide: .5, release: .08 });
    if (a.drum === 'deep' && i % 4 === 0) tone(musicBus, 70, t, .25, { type: 'sine', gain: .14, slide: .4, release: .2 });
    if (a.drum === 'battle') { if (i % 2 === 0) tone(musicBus, 90, t, .12, { type: 'sine', gain: .15, slide: .45, release: .1 }); if (i % 4 === 2) noise(musicBus, t, .12, { gain: .07, freq: 1800 }); noise(musicBus, t, .03, { gain: .025, freq: 8000 }); }
    if (a.drum === 'party') { if (i % 4 === 0) tone(musicBus, 100, t, .1, { type: 'sine', gain: .12, slide: .5, release: .08 }); if (i % 4 === 2) noise(musicBus, t, .08, { gain: .05, freq: 2500 }); if (i % 2) noise(musicBus, t, .03, { gain: .02, freq: 9000 }); }
  }
  bar++;
  return beat * 4;
}
function pump() {
  if (!ctx || !area) return;
  const a = AREAS[area];
  while (nextBar < ctx.currentTime + .6) nextBar += scheduleBar(a, Math.max(nextBar, ctx.currentTime + .05));
}
/** Switch the music to an area's theme (cross-fading at the next bar). */
export function setMusicArea(id) {
  if (!AREAS[id] || id === area) return;
  if (!ensure()) return;
  area = id; seed = [...id].reduce((s, c) => s * 31 + c.charCodeAt(0), 7) >>> 0; bar = 0;
  nextBar = Math.max(nextBar, ctx.currentTime + .1);
  if (!timer) timer = setInterval(pump, 200);
}
export const musicArea = () => area;
export const MUSIC_AREAS = AREAS;

// ---- Effects ----
const last = new Map();
function limited(key, gap) { const now = ctx.currentTime, t = last.get(key) || 0; if (now - t < gap) return true; last.set(key, now); return false; }
const SFX = {
  slash: t => { noise(fxBus, t, .09, { gain: .16, freq: 2500, sweep: .4, q: 1.5 }); },
  arrow: t => { noise(fxBus, t, .12, { gain: .1, freq: 4000, sweep: .5, q: 3 }); },
  pierce: t => { noise(fxBus, t, .08, { gain: .12, freq: 5000, sweep: .4, q: 4 }); tone(fxBus, 900, t, .05, { type: 'square', gain: .03 }); },
  bolt: t => { tone(fxBus, 600, t, .12, { type: 'sawtooth', gain: .05, slide: 1.8, filter: 2000 }); },
  frostbolt: t => { tone(fxBus, 1200, t, .14, { type: 'sine', gain: .06, slide: 1.4 }); tone(fxBus, 1800, t + .03, .1, { type: 'sine', gain: .04 }); },
  spark: t => { for (let i = 0; i < 3; i++) noise(fxBus, t + i * .03, .04, { gain: .12, freq: 3000 + i * 1500, q: 6 }); },
  fire: t => { noise(fxBus, t, .35, { gain: .2, type: 'lowpass', freq: 1500, sweep: .25 }); },
  light: t => { tone(fxBus, 1046, t, .08, { type: 'sine', gain: .05 }); },
  note: t => { tone(fxBus, 784 + Math.floor(Math.random() * 3) * 98, t, .12, { type: 'triangle', gain: .06 }); },
  holy: t => { tone(fxBus, 880, t, .15, { type: 'sine', gain: .06 }); tone(fxBus, 1320, t + .02, .15, { type: 'sine', gain: .04 }); },
  hit: t => { noise(fxBus, t, .05, { gain: .12, freq: 900, q: 1 }); tone(fxBus, 160, t, .05, { type: 'sine', gain: .08, slide: .5 }); },
  hurt: t => { tone(fxBus, 220, t, .08, { type: 'square', gain: .04, slide: .6, filter: 1200 }); },
  heal: t => { [0, 4, 7].forEach((s, i) => tone(fxBus, midi(79 + s), t + i * .05, .12, { type: 'sine', gain: .05 })); },
  ko: t => { tone(fxBus, 180, t, .4, { type: 'triangle', gain: .12, slide: .3 }); },
  kill: t => { noise(fxBus, t, .18, { gain: .09, type: 'lowpass', freq: 900, sweep: .3 }); tone(fxBus, 660, t + .05, .1, { type: 'triangle', gain: .05, slide: 1.5 }); },
  level: t => { [0, 4, 7, 12].forEach((s, i) => tone(fxBus, midi(72 + s), t + i * .08, .18, { type: 'square', gain: .045, filter: 3000 })); },
  coin: t => { tone(fxBus, 1318, t, .06, { type: 'square', gain: .035, filter: 4000 }); tone(fxBus, 1760, t + .07, .14, { type: 'square', gain: .035, filter: 4000 }); },
  skill: t => { tone(fxBus, 520, t, .2, { type: 'triangle', gain: .06, slide: 2 }); noise(fxBus, t, .2, { gain: .05, freq: 3000, sweep: 2 }); },
  slam: t => { tone(fxBus, 70, t, .35, { type: 'sine', gain: .25, slide: .5 }); noise(fxBus, t, .3, { gain: .12, type: 'lowpass', freq: 600, sweep: .4 }); },
  roar: t => { tone(fxBus, 110, t, .9, { type: 'sawtooth', gain: .1, slide: .55, filter: 700 }); tone(fxBus, 165, t, .8, { type: 'sawtooth', gain: .07, slide: .5, filter: 600 }); noise(fxBus, t, .8, { gain: .08, type: 'lowpass', freq: 500 }); },
  warn: t => { for (let i = 0; i < 3; i++) tone(fxBus, 880, t + i * .16, .07, { type: 'square', gain: .04, filter: 2500 }); },
  boom: t => { noise(fxBus, t, .7, { gain: .3, type: 'lowpass', freq: 800, sweep: .15 }); tone(fxBus, 55, t, .6, { type: 'sine', gain: .25, slide: .5 }); },
  wave: t => { tone(fxBus, 392, t, .12, { type: 'square', gain: .04 }); tone(fxBus, 523, t + .13, .2, { type: 'square', gain: .04 }); },
  clear: t => { [0, 4, 7, 12, 16].forEach((s, i) => tone(fxBus, midi(67 + s), t + i * .09, .25, { type: 'triangle', gain: .06 })); },
  click: t => { tone(fxBus, 1500, t, .02, { type: 'square', gain: .02, filter: 4000 }); },
  stamp: t => { tone(fxBus, 90, t, .15, { type: 'sine', gain: .2, slide: .6 }); noise(fxBus, t, .1, { gain: .1, type: 'lowpass', freq: 1200 }); },
  fanfare: t => { [[0, .0], [4, .12], [7, .24], [12, .36], [7, .52], [12, .62]].forEach(([s, d]) => tone(fxBus, midi(72 + s), t + d, .16, { type: 'square', gain: .045, filter: 3500 })); },
  munch: t => { noise(fxBus, t, .06, { gain: .06, freq: 700, q: 2 }); },
  dig: t => { noise(fxBus, t, .3, { gain: .1, type: 'lowpass', freq: 400, sweep: .5 }); },
};
/** Play one named effect (rate-limited so a big fight stays pleasant). */
export function sfx(name, gap = .05) {
  if (!opts.sfx || !SFX[name] || !ensure() || ctx.state !== 'running') return;
  if (limited(name, gap)) return;
  SFX[name](ctx.currentTime + .005);
}
/** Map a world event (from the simulation's fx queue) to its sound. */
export function fxSound(e) {
  switch (e.type) {
    case 'hit': return sfx(SFX[e.kind] ? e.kind : 'hit', .06);
    case 'hurt': return sfx('hurt', .09);
    case 'heal': return sfx('heal', .25);
    case 'skill': return sfx('skill', .2);
    case 'ko': return sfx('ko', .3);
    case 'kill': return sfx('kill', .1);
    case 'level': return sfx('level', .5);
    case 'sell': return sfx('coin', .3);
    case 'spit': return sfx('bolt', .12);
    case 'charge': return sfx('slam', .3);
    case 'slam': case 'dive': case 'erupt': return sfx('slam', .25);
    case 'burrow': return sfx('dig', .4);
    case 'breath': case 'firering': return sfx('boom', .4);
    case 'phase': return sfx('roar', 1);
    case 'summon': return sfx('roar', 1);
    case 'telegraph': return sfx('warn', .5);
    case 'questWave': return sfx('wave', .5);
    case 'questBoss': return sfx('roar', 1);
    case 'questClear': return sfx('clear', 1);
    case 'munch': return sfx('munch', .25);
    case 'swing': return sfx('slash', .08);
    default: return undefined;
  }
}

// ---- Night ambience: crickets, a soft breeze, an owl now and then; frogs by water, deeper wind in the mist. ----
let ambBus = null, ambLevel = 0, ambPlace = 'village', ambTimer = null, breeze = null;
const ambNext = { crickets: [0, 0, 0], owl: 0, frog: 0, chime: 0 };
function ambGain() { return (opts.sfx ? 1 : 0) * ambLevel; }
function startBreeze() {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = 'lowpass'; f.frequency.value = 380; g.gain.value = 0;
  lfo.frequency.value = .07; lg.gain.value = 120; lfo.connect(lg); lg.connect(f.frequency);
  s.connect(f); f.connect(g); g.connect(ambBus); s.start(); lfo.start();
  breeze = { g, f };
}
function chirp(t, pitch, pulses, gain) {
  for (let k = 0; k < pulses; k++) tone(ambBus, pitch, t + k * .07, .028, { type: 'sine', gain, attack: .004, release: .02 });
}
function ambTick() {
  if (!ctx || ctx.state !== 'running') return;
  const level = ambGain(), now = ctx.currentTime;
  if (!breeze) startBreeze();
  const mist = ambPlace === 'mist' || ambPlace === 'peak';
  breeze.g.gain.setTargetAtTime(level * (mist ? .1 : .045), now, .8);
  breeze.f.frequency.setTargetAtTime(mist ? 260 : 380, now, 1);
  if (level < .02) return;
  // Three crickets, each with its own pitch and rhythm.
  ambNext.crickets.forEach((at, i) => {
    if (now < at) return;
    if (!mist || i === 0) chirp(now + .05, [4300, 4700, 3900][i], 3 + (i % 2), .022 * level);
    ambNext.crickets[i] = now + .55 + i * .23 + Math.random() * .9;
  });
  if (now >= ambNext.owl) {
    if (ambNext.owl) { const t = now + .1, f = mist ? 300 : 360; tone(ambBus, f, t, .22, { type: 'sine', gain: .07 * level, attack: .06, release: .18, slide: .9, filter: 900 }); tone(ambBus, f * .94, t + .45, .35, { type: 'sine', gain: .06 * level, attack: .08, release: .25, slide: .88, filter: 900 }); }
    ambNext.owl = now + 14 + Math.random() * 18;
  }
  if (ambPlace === 'meadow' && now >= ambNext.frog) {
    if (ambNext.frog) for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) tone(ambBus, 150 + Math.random() * 30, now + .1 + k * .16, .08, { type: 'sawtooth', gain: .035 * level, attack: .01, release: .05, filter: 600, slide: .8 });
    ambNext.frog = now + 2.5 + Math.random() * 4;
  }
  if (mist && now >= ambNext.chime) {
    if (ambNext.chime) { const root = 72 + [0, 3, 7, 10][Math.floor(Math.random() * 4)]; tone(ambBus, midi(root), now + .1, .6, { type: 'sine', gain: .03 * level, attack: .005, release: 1.2 }); }
    ambNext.chime = now + 6 + Math.random() * 8;
  }
}
/** Night ambience follows the night (0 day … 1 deep night) and the area the camera is looking at. */
export function setNightAmbience(level, place = 'village') {
  if (!ensure()) return;
  if (!ambBus) { ambBus = ctx.createGain(); ambBus.gain.value = .9; ambBus.connect(master); }
  ambLevel = Math.max(0, Math.min(1, level)); ambPlace = place;
  if (!ambTimer) ambTimer = setInterval(ambTick, 150);
}
