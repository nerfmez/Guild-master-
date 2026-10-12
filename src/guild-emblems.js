// One monochrome design for the picker, preview and the flag in the village.
// Paths share a 24 × 24 view box and use even-odd filling for the small cutouts.
export const GUILD_SYMBOLS = [
  { id: 'leaf', name: 'ใบไม้', path: 'M20 3C10 2 3 8 4 16L7 19C15 21 22 13 20 3ZM7 17L17 7L18 8L8 18ZM6 16L8 18L4 22L2 20Z' },
  { id: 'star', name: 'ดาว', path: 'M12 2L14.7 9.3L22 12L14.7 14.7L12 22L9.3 14.7L2 12L9.3 9.3Z' },
  { id: 'moon', name: 'จันทร์', path: 'M17.6 2.8A10 10 0 1 0 21.2 18.6A9.3 9.3 0 0 1 17.6 2.8Z' },
  { id: 'sword', name: 'ดาบ', path: 'M12 2L14 5V14H18V16H14V20H15V22H9V20H10V16H6V14H10V5ZM11.5 6V12H12.5V6Z' },
  { id: 'shield', name: 'โล่', path: 'M4 3H20V10C20 16 17 20 12 22C7 20 4 16 4 10ZM7 6V10C7 14 9 17 12 19C15 17 17 14 17 10V6ZM12 8L15 12L12 16L9 12Z' },
  { id: 'sun', name: 'ตะวัน', path: 'M17 12A5 5 0 1 0 7 12A5 5 0 1 0 17 12ZM11 1H13V5H11ZM11 19H13V23H11ZM1 11H5V13H1ZM19 11H23V13H19ZM3.5 4.9L4.9 3.5L7.7 6.3L6.3 7.7ZM16.3 17.7L17.7 16.3L20.5 19.1L19.1 20.5ZM16.3 6.3L19.1 3.5L20.5 4.9L17.7 7.7ZM3.5 19.1L6.3 16.3L7.7 17.7L4.9 20.5Z' },
];
const symbols = new Map(GUILD_SYMBOLS.map(s => [s.id, s]));
const paths = new Map();
function symbolOf(id) { return symbols.get(id) || symbols.get('leaf'); }

export function guildEmblemSvg(id) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${symbolOf(id).path}" fill="currentColor" fill-rule="evenodd"/></svg>`;
}

export function drawGuildEmblem(ctx, id, x, y, size = 24, color = '#f4e5c9') {
  const symbol = symbolOf(id);
  if (!paths.has(symbol.id)) paths.set(symbol.id, new Path2D(symbol.path));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.fill(paths.get(symbol.id), 'evenodd');
  ctx.restore();
}
