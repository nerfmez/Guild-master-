/* Original pixel props, drawn at native resolution. No external sprite data. */
(() => {
  'use strict';
  const { rng, rect, poly, line, ellipse, createCanvas } = window.ArtCore;
  const cache = new Map();
  const LEAVES = {
    green: ['#667655', '#77895e', '#92a775', '#a8b985', '#bdcb9a', '#d1dab4'],
    gold: ['#857653', '#a08c62', '#baaa79', '#cebd8e', '#decca4', '#ebddba'],
  };

  function sprite(width, height, footX, footY, paint) {
    // A transparent two-pixel guard keeps serrated foliage and ground-contact shadows intact.
    const canvas = createCanvas(width + 4, height + 4);
    const c = canvas.getContext('2d');
    c.translate(2, 2);
    paint(c);
    return { canvas, width: width + 4, height: height + 4, footX: footX + 2, footY: footY + 2 };
  }

  function memo(kind, options, paint) {
    const key = kind + ':' + JSON.stringify(options);
    if (!cache.has(key)) cache.set(key, paint());
    return cache.get(key);
  }

  const LEAF_FORMS = [
    [[-.22,-.93],[.01,-.83],[.28,-1.01],[.47,-.79],[.42,-.58],[.73,-.64],[.90,-.36],
      [.69,-.17],[1,.06],[.88,.32],[.63,.31],[.59,.66],[.35,.58],[.14,.95],[-.12,.84],
      [-.25,.60],[-.48,.77],[-.75,.52],[-.69,.29],[-.99,.19],[-.77,-.01],[-1,-.30],
      [-.77,-.56],[-.54,-.42],[-.50,-.80]],
    [[-.62,-.73],[-.26,-.90],[-.07,-.70],[.23,-.98],[.46,-.82],[.39,-.50],[.73,-.52],
      [.98,-.19],[.75,-.06],[.91,.30],[.64,.34],[.59,.66],[.27,.53],[.10,.90],[-.11,.97],
      [-.33,.65],[-.62,.75],[-.82,.46],[-.63,.16],[-1,.06],[-.85,-.20],[-.65,-.14],[-.76,-.46]],
    [[-.44,-.91],[-.11,-.78],[.15,-1],[.44,-.79],[.43,-.62],[.75,-.71],[.93,-.40],
      [.64,-.18],[.90,.01],[.74,.27],[1,.41],[.73,.66],[.43,.51],[.33,.79],[.04,.93],
      [-.14,.63],[-.43,.80],[-.65,.59],[-.61,.37],[-.94,.24],[-.77,-.07],[-1,-.28],
      [-.73,-.52],[-.49,-.43]],
  ];
  const LIGHT_FORMS = [
    [[-.63,-.25],[-.50,-.51],[-.30,-.48],[-.27,-.78],[-.08,-.58],[.13,-.76],[.35,-.52],
      [.12,-.32],[.42,-.39],[.48,-.11],[.20,.01],[.22,.20],[-.03,.32],[-.15,.11],[-.42,.29],[-.40,.02],[-.66,.06]],
    [[-.70,-.34],[-.52,-.64],[-.23,-.61],[-.17,-.81],[.07,-.57],[.33,-.62],[.39,-.40],
      [.13,-.20],[.41,-.10],[.18,.06],[.02,.02],[-.02,.29],[-.30,.21],[-.40,-.02],[-.66,.06]],
  ];

  // Authored branching contours have deep asymmetrical notches, never radial bubbles.
  function leafShape(cx, cy, rx, ry, random, variant = 0) {
    const form = LEAF_FORMS[variant % LEAF_FORMS.length];
    const flip = variant % 2 ? -1 : 1;
    const skew = (random() - 0.5) * 0.23;
    return form.map(([x,y]) => [Math.round(cx + (x * flip + y * skew) * rx), Math.round(cy + y * ry)]);
  }

  function leafSprig(c, x, y, scale, color, flip = false) {
    const s = scale, d = flip ? -1 : 1;
    poly(c, [[x, y], [x + d * s, y - s], [x + d * (s * 3), y - s], [x + d * (s * 3), y],
      [x + d * (s * 2), y + s], [x + d * (s * 2), y + s * 2], [x, y + s * 2]], color);
  }

  function leafMasses(c, masses, palette, random) {
    // Combined dark silhouette, then the overlapping body masses. Small gaps expose twigs.
    const shapes = masses.map((m, i) => ({ ...m, shape: leafShape(m.x, m.y, m.rx, m.ry, random, i), i }));
    for (const mass of shapes) poly(c, mass.shape, palette[0]);
    for (const mass of shapes) {
      const bodyColor = palette[mass.shade ?? 2];
      const inner = mass.shape.map(([x, y]) => [Math.round(mass.x + (x - mass.x) * 0.94), Math.round(mass.y + (y - mass.y) * 0.93) - 1]);
      poly(c, inner, bodyColor);
      // Shadow is a branching lower-right wedge, not a circular inset ring.
      const edge = [[.04,-.13],[.65,-.28],[.92,.07],[.68,.35],[.53,.34],[.41,.68],[.13,.87],
        [-.14,.64],[-.39,.69],[-.36,.40],[-.03,.22]].map(([x,y]) => [Math.round(mass.x+x*mass.rx),Math.round(mass.y+y*mass.ry)]);
      poly(c, edge, palette[Math.max(1, (mass.shade ?? 2) - 1)]);
      // A connected group of angular leaves runs through each branch; no repeated pale balls.
      const flip = mass.i % 3 === 0 ? -1 : 1;
      const highlight = LIGHT_FORMS[mass.i % 2].map(([x,y]) => [
        Math.round(mass.x+(x*flip-.12)*mass.rx),Math.round(mass.y+(y-.05)*mass.ry),
      ]);
      poly(c, highlight, palette[Math.min(4, (mass.shade ?? 2) + 1)]);
      leafSprig(c, Math.round(mass.x - mass.rx * 0.45), Math.round(mass.y - mass.ry * 0.46), 1,
        palette[Math.min(5, (mass.shade ?? 2) + 2)]);
      if (mass.rx > 8) {
        leafSprig(c, Math.round(mass.x + mass.rx * 0.38), Math.round(mass.y - mass.ry * 0.30), 1, palette[Math.min(4, (mass.shade ?? 2) + 1)], true);
        leafSprig(c, Math.round(mass.x - mass.rx * 0.11), Math.round(mass.y + mass.ry * 0.43), 1, palette[Math.max(1, (mass.shade ?? 2) - 1)]);
      }
      if (mass.i % 3 === 1) {
        poly(c, [[mass.x+mass.rx*.1,mass.y+mass.ry*.81],[mass.x+mass.rx*.2,mass.y+mass.ry*.32],
          [mass.x+mass.rx*.33,mass.y+mass.ry*.55]],palette[0]);
      }
    }
    return shapes;
  }

  function trunk(c, cx, footY, crownBottom, birch, random, scale) {
    const outline = birch ? '#82775d' : '#6f5434';
    const low = birch ? '#a6a58b' : '#937043';
    const mid = birch ? '#d1d1b4' : '#b18a4d';
    const high = birch ? '#e3e0c4' : '#c9a668';
    const topY = crownBottom - 27 * scale;
    const center = cx - 2 * scale;
    // A very slight natural lean, with roots reaching into the grass.
    poly(c, [[cx - 6 * scale, footY], [cx - 4 * scale, footY - 12 * scale], [cx - 5 * scale, footY - 32 * scale],
      [center - 5 * scale, topY], [center + 2 * scale, topY - 1], [cx + 4 * scale, footY - 18 * scale],
      [cx + 4 * scale, footY - 5 * scale], [cx + 8 * scale, footY + 1], [cx + 2 * scale, footY + 2]], outline);
    poly(c, [[cx - 3 * scale, footY], [cx - 2 * scale, footY - 15 * scale], [cx - 3 * scale, footY - 34 * scale],
      [center - 3 * scale, topY + 1], [center, topY], [cx + 2 * scale, footY - 17 * scale],
      [cx + 2 * scale, footY - 3 * scale], [cx + 5 * scale, footY]], mid);
    poly(c, [[cx + 1, footY], [cx + 2 * scale, footY - 19 * scale], [center, topY + 2],
      [center + 2 * scale, topY], [cx + 4 * scale, footY - 18 * scale], [cx + 3 * scale, footY]], low);
    line(c, cx - 3 * scale, footY - 4, cx - 3 * scale, footY - 17 * scale, high, Math.max(1, Math.round(2 * scale)));
    line(c, cx - 3 * scale, footY - 20 * scale, center - 2 * scale, topY + 2, high, 2);
    // Forks lift vertically; foliage hides most of them.
    line(c, cx, crownBottom + 4 * scale, cx - 14 * scale, crownBottom - 21 * scale, outline, Math.round(5 * scale));
    line(c, cx - 1, crownBottom + 2 * scale, cx - 14 * scale, crownBottom - 20 * scale, mid, Math.round(3 * scale));
    line(c, cx, crownBottom + 2 * scale, cx + 14 * scale, crownBottom - 22 * scale, outline, Math.round(4 * scale));
    line(c, cx, crownBottom, cx + 14 * scale, crownBottom - 21 * scale, mid, Math.round(2 * scale));
    line(c, cx - 3, footY, cx - 9 * scale, footY + 1, low, 2);
    if (birch) {
      // Few broken horizontal marks, with warm gray undersides rather than zebra stripes.
      const marks = [[-3, 7, 3], [1, 15, 2], [-3, 25, 4], [0, 34, 3], [-3, 42, 2]];
      for (const [dx, up, width] of marks) {
        const x = cx + dx * scale, y = footY - up * scale;
        rect(c, x, y, width * scale, scale, '#8d8b75');
        if (up % 2) rect(c, x + 1, y - 1, Math.max(1, width - 1), 1, '#b1b09a');
      }
    } else {
      for (let i = 0; i < 4; i++) {
        const x = cx - 2 + i % 3;
        const y = footY - 7 - i * 8;
        line(c, x, y, x - 1, y - 5 - Math.round(random() * 2), low, 1);
      }
    }
  }

  function makeTree(options = {}) {
    const seed = options.seed ?? 1;
    const kind = options.kind === 'oak' ? 'oak' : 'birch';
    const season = options.season === 'gold' ? 'gold' : 'green';
    const large = options.size === 'large' || (typeof options.size === 'number' && options.size > 1);
    const width = large || kind === 'oak' ? 85 : 64;
    const height = large || kind === 'oak' ? 112 : 96;
    return memo('tree', { seed, kind, season, width, height }, () => {
      const random = rng(seed);
      const palette = LEAVES[season];
      const footX = Math.round(width * 0.49), footY = height - 5;
      const sx = width / 64, sy = (height - 25) / 71;
      const crownBottom = Math.round(height * 0.73);
      return sprite(width, height, footX, footY, c => {
        // Native-pixel ground contact, kept shallow for the high top-down camera.
        ellipse(c, footX + 7 * sx, footY + 1, 13 * sx, 3, '#7c7c31');
        trunk(c, footX, footY, crownBottom, kind === 'birch', random, Math.min(1.15, sx));
        const pattern = kind === 'birch' ? [
          [24, 12, 10, 8, 3], [38, 16, 11, 9, 3], [17, 25, 10, 10, 3],
          [31, 29, 12, 11, 3], [47, 29, 10, 11, 2],
          [11, 46, 8, 10, 2], [23, 47, 12, 12, 3], [40, 48, 12, 12, 2], [52, 48, 8, 9, 1],
          [15, 59, 11, 9, 2], [30, 60, 13, 10, 2], [46, 61, 11, 9, 1],
        ] : [
          [23, 13, 10, 10, 3], [38, 14, 11, 10, 3], [14, 26, 10, 11, 3],
          [29, 26, 12, 12, 3], [45, 26, 11, 12, 2], [11, 41, 8, 11, 2],
          [21, 40, 12, 12, 3], [36, 42, 13, 13, 2], [52, 43, 9, 11, 2],
          [14, 54, 10, 10, 2], [28, 57, 12, 11, 2], [44, 56, 12, 11, 1],
        ];
        const lean = (random() - 0.5) * 3;
        const masses = pattern.map(([x, y, rx, ry, shade], i) => ({
          x: Math.round((x + lean + (random() - 0.5) * 3) * sx),
          y: Math.round((y + (random() - 0.5) * 3) * sy),
          rx: Math.round(rx * sx * (0.88 + random() * 0.19)),
          ry: Math.round(ry * sy * (0.87 + random() * 0.21)), shade,
        }));
        leafMasses(c, masses, palette, random);
        // Dark twigs only peek out at the underside, where separate crown branches join.
        line(c, footX - 4 * sx, crownBottom - 1, footX - 11 * sx, crownBottom - 9, palette[0], 2);
        line(c, footX + 3 * sx, crownBottom - 3, footX + 12 * sx, crownBottom - 8, palette[0], 2);
        line(c, footX - 3 * sx, crownBottom + 2, footX - 5 * sx, crownBottom - 5, kind === 'birch' ? '#c6c8a9' : '#a6854c', 2);
        rect(c, footX - 6, footY + 1, 3, 1, '#a7a740');
      });
    });
  }

  function makeBush(options = {}) {
    const seed = options.seed ?? 1, gold = Boolean(options.gold);
    return memo('bush', { seed, gold }, () => {
      const random = rng(seed), palette = LEAVES[gold ? 'gold' : 'green'];
      return sprite(43, 31, 22, 28, c => {
        ellipse(c, 25, 27, 17, 3, '#7c7c31');
        const masses = [[9, 17, 7, 8, 2], [18, 11, 8, 9, 3], [29, 12, 8, 9, 2],
          [35, 20, 6, 8, 1], [18, 22, 9, 7, 2], [29, 23, 8, 6, 2]].map(([x, y, rx, ry, shade]) => ({
          x: x + Math.round(random() * 2 - 1), y, rx, ry, shade,
        }));
        leafMasses(c, masses, palette, random);
        line(c, 8, 28, 6, 25, '#90933d', 1);
        line(c, 36, 28, 39, 24, '#90933d', 1);
      });
    });
  }

  function makeRock(options = {}) {
    const seed = options.seed ?? 1;
    const large = options.size === 'large' || (typeof options.size === 'number' && options.size > 1);
    const width = large ? 31 : 23, height = large ? 24 : 18;
    return memo('rock', { seed, width, height }, () => {
      const random = rng(seed), sx = width / 23, sy = height / 18;
      const pts = points => points.map(([x, y]) => [Math.round(x * sx), Math.round(y * sy)]);
      return sprite(width, height, Math.round(width / 2), height - 2, c => {
        ellipse(c, width * 0.58, height - 2, width * 0.42, 2, '#7f7e36');
        poly(c, pts([[1, 12], [4, 6], [9, 2], [16, 1], [21, 7], [22, 13], [18, 17], [6, 17]]), '#847c60');
        poly(c, pts([[2, 11], [5, 6], [10, 3], [16, 2], [20, 7], [14, 10], [7, 10]]), '#c6c2a8');
        poly(c, pts([[7, 10], [14, 10], [20, 7], [21, 13], [17, 16], [7, 15], [2, 11]]), '#a3a38e');
        poly(c, pts([[14, 10], [20, 7], [21, 13], [17, 16], [12, 15]]), '#939580');
        line(c, 5 * sx, 6 * sy, 10 * sx, 3 * sy, '#d7d1b7', 1);
        if (random() > 0.5) line(c, 7 * sx, 12 * sy, 9 * sx, 10 * sy, '#898e79', 1);
        rect(c, width * 0.25, height - 2, 3, 1, '#a2a449');
      });
    });
  }

  function makeGrassTuft(options = {}) {
    const seed = options.seed ?? 1, flowers = Boolean(options.flowers);
    return memo('grass', { seed, flowers }, () => {
      const random = rng(seed);
      return sprite(flowers ? 19 : 14, flowers ? 13 : 10, flowers ? 10 : 7, flowers ? 11 : 8, c => {
        const blades = [[2, 8, 1, 5], [4, 8, 3, 3], [6, 8, 6, 5], [7, 8, 9, 4], [10, 8, 12, 6]];
        for (const [x, y, xx, yy] of blades) {
          const jitter = Math.round(random() * 2 - 1);
          line(c, x, y, xx, yy + jitter, '#adb447', 1);
          rect(c, xx, yy + jitter, 1, 1, '#bdc356');
        }
        if (flowers) {
          for (const [x, y] of [[5, 3], [14, 7]]) {
            line(c, x, y + 2, x - 1, y + 5, '#a5ac42', 1);
            rect(c, x - 2, y, 2, 2, '#e5dfae');
            rect(c, x + 1, y, 2, 2, '#f0e7bf');
            rect(c, x, y - 2, 1, 2, '#f0e7bf');
            rect(c, x, y + 2, 1, 1, '#e8ddb0');
            rect(c, x, y, 1, 2, '#c5a85b');
          }
        }
      });
    });
  }

  window.VillageNature = { makeTree, makeBush, makeRock, makeGrassTuft };
})();
