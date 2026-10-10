/* The world around the guild, drawn in the same 2:1 projection: regions, roads, quest sites and foes. */
import { gridPoint, CELL_W, CELL_H } from './guild-art.js';
import { drawFoe } from './render.js';
import { REGIONS, RANKS } from './content.js';

// Regions sit at the ends of the village roads: meadow west, ruins east, misty woods north.
export const REGIONS_WORLD = {
  meadow: { x0: -42, y0: 6, x1: -14, y1: 30, palette: ['#adc28c', '#a8bd87', '#b4c892'], dots: ['#f2b8a8', '#fff3d6', '#f4d49a'], gate: { x: -13, y: 17.5 }, label: { x: -20, y: 12 } },
  ruins: { x0: 44, y0: 4, x1: 72, y1: 30, palette: ['#d3ccb9', '#c9c1ad', '#bfb8a3'], dots: ['#a39b8a', '#e1d9c4'], gate: { x: 43, y: 17.5 }, label: { x: 50, y: 8 } },
  mist: { x0: -14, y0: -44, x1: 16, y1: -16, palette: ['#8fa894', '#88a18d', '#96ae9b'], dots: ['#c9e6f0', '#e8d8f2'], gate: { x: 2, y: -15 }, label: { x: 8, y: -20 } },
};
export const ROAD_EXTENSIONS = [
  { x: -42, y: 16.75, w: 30, h: 1.5, kind: 'stone' },
  { x: 42, y: 16.75, w: 30, h: 1.5, kind: 'stone' },
  { x: 1.25, y: -44, w: 1.5, h: 32, kind: 'earth' },
];
export const QUEST_SITES = {
  patrol: { x: -18, y: 21 }, herbs: { x: -32, y: 24 }, escort: { x: -30, y: 12 },
  hollow: { x: 50, y: 12 }, crystals: { x: 62, y: 9 }, ruins: { x: 64, y: 24 },
  mistpath: { x: 7, y: -24 }, rescue: { x: -6, y: -32 }, heart: { x: 5, y: -39 },
};
export const VILLAGE_HOMES = [[-9, 20, 31], [-2, 21.5, 44], [8, 21, 52], [14, 22, 63], [30, 20, 75]];

/** Waypoints in grid units from the guild door to a quest site. */
export function questRoute(door, quest) {
  const site = QUEST_SITES[quest.id] || { x: 0, y: 20 }, road = 17.5;
  const start = [{ x: door.x, y: door.y }, { x: door.x, y: road }];
  if (quest.region === 'meadow') return [...start, { x: -13, y: road }, { x: site.x, y: road }, site];
  if (quest.region === 'ruins') return [...start, { x: 43, y: road }, { x: site.x, y: road }, site];
  return [...start, { x: 2, y: road }, { x: 2, y: -15 }, { x: 2, y: site.y }, site];
}
export const regionOpen = (state, id) => RANKS.indexOf(state.rank) >= RANKS.indexOf(REGIONS.find(r => r.id === id)?.rank || 'F');

function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }
function surface(x0, y0, x1, y1) {
  // Canvas covering an iso rectangle, with a mapper from grid units to canvas pixels.
  const corners = [gridPoint(x0, y0), gridPoint(x1, y0), gridPoint(x0, y1), gridPoint(x1, y1)], pad = 8;
  const minX = Math.min(...corners.map(p => p.x)) - pad, minY = Math.min(...corners.map(p => p.y)) - pad;
  const canvas = document.createElement('canvas'); canvas.width = Math.ceil(Math.max(...corners.map(p => p.x)) - minX + pad); canvas.height = Math.ceil(Math.max(...corners.map(p => p.y)) - minY + pad);
  const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
  const at = (x, y) => { const p = gridPoint(x, y); return [p.x - minX, p.y - minY]; };
  const cell = (x, y, s, color) => { const e = .03, pts = [at(x - e, y - e), at(x + s + e, y - e), at(x + s + e, y + s + e), at(x - e, y + s + e)]; c.fillStyle = color; c.beginPath(); pts.forEach(([a, b], i) => i ? c.lineTo(a, b) : c.moveTo(a, b)); c.closePath(); c.fill(); };
  return { canvas, c, at, cell, x: minX, y: minY };
}

/** Ground of a region: an organic patch of its own floor, scattered with flowers, stones or moss. */
export function makeRegionGround(id) {
  const z = REGIONS_WORLD[id], s = surface(z.x0, z.y0, z.x1, z.y1), r = rng(id.length * 977 + 3);
  const cx = (z.x0 + z.x1) / 2, cy = (z.y0 + z.y1) / 2, rx = (z.x1 - z.x0) / 2, ry = (z.y1 - z.y0) / 2;
  for (let y = z.y0; y < z.y1; y += .5) for (let x = z.x0; x < z.x1; x += .5) {
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (r() - .5) * .25; if (d > 1) continue;
    s.cell(x, y, .5, z.palette[r() < .82 ? 0 : r() < .5 ? 1 : 2]);
    if (id === 'ruins' && r() < .5) { const [a, b] = s.at(x, y); s.c.fillStyle = '#00000014'; s.c.fillRect(a - 6, b + 2, 12, 1); }
    if (r() < .06) { const [a, b] = s.at(x + .25, y + .25); s.c.fillStyle = z.dots[Math.floor(r() * z.dots.length)]; s.c.fillRect(Math.round(a), Math.round(b), 2, 2); }
  }
  return s;
}
/** Road strips continuing the village roads out to the regions, paved like the guild's own roads. */
export function makeRoad(road) {
  const s = surface(road.x, road.y, road.x + road.w, road.y + road.h), r = rng(Math.abs(road.x * 31 + road.y * 17) + 5);
  for (let y = road.y; y < road.y + road.h - .01; y += .5) for (let x = road.x; x < road.x + road.w - .01; x += .5) {
    if (road.kind === 'stone') { s.cell(x, y, .5, '#aaa78c'); s.cell(x + .03, y + .03, .44, r() > .5 ? '#d1c8ab' : '#c4bea4'); }
    else { s.cell(x, y, .5, r() > .5 ? '#d9c5a1' : '#deccab'); if (r() < .3) { const [a, b] = s.at(x + .25, y + .25); s.c.fillStyle = '#b8ab8b'; s.c.fillRect(Math.round(a), Math.round(b), 2, 1); } }
  }
  return s;
}
/** A foe baked for the scene, standing on its feet at (footX, footY). */
export function makeFoeSprite(quest, scale = .5, flash = false) {
  const w = Math.ceil(90 * scale) + 8, h = Math.ceil(70 * scale) + 8, canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false; c.translate(Math.round(w / 2), h - 4); c.scale(scale, scale); drawFoe(c, 0, 0, quest, 0, flash);
  return { canvas, footX: Math.round(w / 2), footY: h - 4 };
}
/** Broken pillar for the ruins. */
export function makePillar(seed = 1) {
  const r = rng(seed), tall = 18 + Math.floor(r() * 22), canvas = document.createElement('canvas'); canvas.width = 22; canvas.height = tall + 12;
  const c = canvas.getContext('2d'), R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  R(3, tall + 4, 18, 5, '#00000022'); R(4, 6, 14, tall, '#b8b0a0'); R(4, 6, 6, tall, '#cfc7b4'); R(14, 6, 4, tall, '#9d9586'); R(2, tall + 2, 18, 5, '#a59d8f'); R(2, tall + 2, 18, 1, '#cfc7b4');
  R(4, 4, 14, 3, '#d8d0bd'); if (r() < .6) { R(10, 2, 8, 3, '#b8b0a0'); } R(6, 10 + Math.floor(r() * 8), 4, 1, '#00000022');
  return { canvas, footX: 11, footY: tall + 6 };
}
/** Signpost at a locked region's gate. */
export function makeGateSign(text) {
  const canvas = document.createElement('canvas'); canvas.width = 92; canvas.height = 46; const c = canvas.getContext('2d');
  c.fillStyle = '#7b5d45'; c.fillRect(44, 16, 4, 30); c.fillStyle = '#4f4540'; c.fillRect(2, 2, 88, 18); c.fillStyle = '#e7bd74'; c.fillRect(3, 3, 86, 16);
  c.fillStyle = '#5a4a36'; c.font = 'bold 9px "Noto Sans Thai", sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'center'; c.fillText(text, 46, 11);
  return { canvas, footX: 46, footY: 44 };
}
export { CELL_W, CELL_H };
