(() => {
  'use strict';

  // Original hand-drawn Canvas props. Coordinates describe a front/top view.
  const P = {
    edge: '#67472e', deep: '#795333', grain: '#93673e', oak: '#b38a53',
    oakMid: '#bf985f', oakLight: '#d3b179', oakTop: '#e1c58e',
    stoneEdge: '#726554', stone: '#928a76', stoneLight: '#b5ae94',
    iron: '#696456', ironLight: '#a29c82', cloth: '#d7d4bb',
    clothLight: '#eae6ce', clothEdge: '#a4aa98', green: '#8c963d',
    greenDeep: '#6d782e', greenLight: '#b0b758', white: '#f2e6bc',
    yellow: '#d7b65d'
  };

  function makeDrawing(width, height, seed) {
    const A = window.ArtCore;
    if (!A) throw new Error('Load ArtCore before VillageProps.');
    const canvas = A.createCanvas(width, height);
    return {
      A, canvas, c: canvas.getContext('2d'), width, height,
      random: A.rng(seed >>> 0), footX: width / 2, footY: height - 2
    };
  }

  function finish(d) {
    return { canvas: d.canvas, width: d.width, height: d.height,
      footX: d.footX, footY: d.footY };
  }

  function edgedPoly(d, points, color, edge = P.edge) {
    d.A.poly(d.c, points, color);
    points.forEach((p, i) => {
      const q = points[(i + 1) % points.length];
      d.A.line(d.c, p[0], p[1], q[0], q[1], edge);
    });
  }

  function plank(d, x, y, width, height, color = P.oak, horizontal = false) {
    const { A, c, random } = d;
    A.rect(c, x, y, width, height, P.edge);
    A.rect(c, x + 1, y + 1, width - 2, height - 2, color);
    A.line(c, x + 1, y + 1, x + width - 2, y + 1, P.oakLight);
    A.line(c, x + 1, y + 2, x + 1, y + height - 2, P.oakMid);
    A.line(c, x + width - 2, y + 2, x + width - 2, y + height - 2, P.grain);
    const count = Math.max(1, Math.floor((horizontal ? width : height) / 10));
    for (let i = 0; i < count; i++) {
      const start = 3 + Math.floor(random() * Math.max(1, (horizontal ? width : height) - 8));
      const cross = 2 + Math.floor(random() * Math.max(1, (horizontal ? height : width) - 4));
      if (horizontal) A.line(c, x + start, y + cross, x + Math.min(width - 3, start + 4), y + cross, P.grain);
      else A.line(c, x + cross, y + start, x + cross, y + Math.min(height - 3, start + 5), P.grain);
    }
  }

  function ring(d, cx, cy, rx, ry, outer, inner) {
    d.A.ellipse(d.c, cx, cy, rx, ry, outer);
    d.A.ellipse(d.c, cx, cy, rx - 1, Math.max(1, ry - 1), inner);
  }

  function bottle(d, x, y, color = '#859047') {
    const { A, c } = d;
    A.rect(c, x + 3, y, 3, 3, P.edge);
    A.rect(c, x + 3, y + 1, 2, 3, P.oakLight);
    edgedPoly(d, [[x + 3, y + 3], [x + 6, y + 3], [x + 6, y + 6],
      [x + 8, y + 8], [x + 8, y + 17], [x + 1, y + 17], [x + 1, y + 8], [x + 3, y + 6]], color);
    A.rect(c, x + 2, y + 9, 5, 5, P.clothLight);
    A.rect(c, x + 3, y + 10, 2, 3, P.yellow);
    A.line(c, x + 2, y + 7, x + 2, y + 15, '#d3d496');
    A.rect(c, x + 6, y + 15, 1, 1, '#68793b');
  }

  function mug(d, x, y) {
    const { A, c } = d;
    ring(d, x + 6, y + 5, 2, 3, P.edge, P.cloth);
    A.rect(c, x, y + 2, 6, 7, P.edge);
    A.rect(c, x + 1, y + 3, 4, 5, P.cloth);
    ring(d, x + 3, y + 2, 3, 2, P.clothLight, '#8b7660');
    A.rect(c, x + 1, y + 4, 1, 3, P.clothLight);
  }

  function stool(d, x, y) {
    const { A, c } = d;
    A.rect(c, x + 2, y + 6, 3, 7, P.edge);
    A.rect(c, x + 11, y + 6, 3, 7, P.edge);
    A.rect(c, x + 3, y + 7, 1, 5, P.oak);
    A.rect(c, x + 12, y + 7, 1, 5, P.oak);
    A.ellipse(c, x + 8, y + 6, 8, 5, P.edge);
    A.ellipse(c, x + 8, y + 5, 7, 4, P.oak);
    A.ellipse(c, x + 8, y + 3, 7, 4, P.oakLight);
    A.line(c, x + 3, y + 1, x + 11, y + 1, P.oakTop);
    A.line(c, x + 2, y + 4, x + 13, y + 4, P.oakMid);
  }

  function makeBarrel(d) {
    const { A, c } = d;
    A.ellipse(c, 10, 20, 9, 4, P.edge);
    A.rect(c, 1, 5, 18, 15, P.edge);
    A.rect(c, 2, 6, 16, 14, P.oak);
    A.ellipse(c, 10, 20, 8, 3, P.oak);
    A.rect(c, 3, 7, 3, 13, P.oakMid);
    A.rect(c, 14, 7, 3, 13, P.grain);
    [5, 9, 13, 16].forEach(x => A.line(c, x, 7, x, 22 - Math.abs(10 - x) / 4, P.grain));
    [9, 17].forEach(y => {
      A.rect(c, 1, y, 18, 3, P.edge);
      A.rect(c, 2, y, 16, 2, '#938874');
      A.rect(c, 3, y, 6, 1, '#b3a88a');
      A.rect(c, 16, y + 1, 2, 1, '#736854');
      A.rect(c, 4, y + 1, 1, 1, P.iron);
    });
    ring(d, 10, 5, 10, 5, P.edge, P.oakLight);
    ring(d, 10, 5, 8, 4, P.oakTop, P.oakMid);
    A.line(c, 4, 7, 11, 1, P.grain);
    A.line(c, 8, 8, 15, 2, P.grain);
    A.line(c, 3, 4, 8, 1, P.oakTop);
    d.footY = 23;
  }

  function makeCrate(d) {
    const { A, c } = d;
    edgedPoly(d, [[1, 6], [6, 1], [21, 1], [21, 16], [17, 19], [1, 19]], P.oak);
    edgedPoly(d, [[1, 6], [6, 1], [21, 1], [17, 6]], P.oakLight);
    edgedPoly(d, [[17, 6], [21, 1], [21, 16], [17, 19]], P.grain);
    A.rect(c, 3, 8, 12, 9, P.oakMid);
    [6, 10, 14].forEach(x => A.line(c, x, 8, x, 17, P.grain));
    A.line(c, 3, 8, 14, 16, P.edge, 3);
    A.line(c, 3, 8, 14, 16, P.oakLight, 1);
    A.line(c, 4, 17, 14, 8, P.grain, 2);
    A.line(c, 4, 16, 14, 8, P.oakTop);
    A.line(c, 2, 6, 17, 6, P.oakTop);
    [3, 15].forEach(x => [7, 17].forEach(y => A.rect(c, x, y, 1, 1, P.edge)));
    A.line(c, 18, 8, 20, 6, P.oakMid);
  }

  function makeTable(d) {
    const { A, c } = d;
    // Benches leave a little room around the table for people to sit.
    plank(d, 1, 14, 7, 26, P.oak);
    plank(d, 60, 14, 7, 26, P.oak);
    A.rect(c, 2, 38, 4, 5, P.edge);
    A.rect(c, 61, 38, 4, 5, P.edge);
    A.rect(c, 12, 25, 4, 14, P.edge);
    A.rect(c, 53, 25, 4, 14, P.edge);
    A.rect(c, 13, 28, 2, 10, P.oak);
    A.rect(c, 54, 28, 2, 10, P.oak);
    edgedPoly(d, [[9, 10], [59, 10], [61, 14], [61, 29], [8, 29], [7, 25], [7, 14]], P.oakMid);
    for (let y = 11; y < 27; y += 5) {
      A.line(c, 9, y, 59, y, y === 11 ? P.oakTop : P.oakLight);
      A.line(c, 8, y + 4, 60, y + 4, P.grain);
    }
    A.rect(c, 8, 27, 53, 2, P.grain);
    A.rect(c, 22, 10, 28, 21, P.clothEdge);
    A.rect(c, 23, 10, 26, 19, P.cloth);
    A.rect(c, 23, 11, 25, 1, P.clothLight);
    A.rect(c, 24, 26, 24, 2, '#c1c7b5');
    A.line(c, 46, 11, 46, 25, P.clothLight);
    edgedPoly(d, [[18, 15], [33, 15], [37, 18], [35, 24], [18, 24]], P.oakLight);
    A.line(c, 18, 23, 34, 23, P.grain);
    A.rect(c, 36, 19, 5, 2, P.oakLight);
    ring(d, 27, 18, 8, 5, '#9f733e', '#dabb70');
    A.poly(c, [[20, 16], [24, 14], [30, 14], [33, 17], [31, 19], [24, 18]], '#edcf8a');
    [[24, 15], [28, 15], [31, 17]].forEach(([x, y]) => A.line(c, x, y, x - 1, y + 3, P.clothLight));
    bottle(d, 42, 1);
    mug(d, 10, 4);
    ring(d, 53, 23, 4, 3, '#9b5436', '#bd7045');
    A.rect(c, 51, 20, 2, 1, '#e0a36d');
    A.line(c, 53, 19, 54, 16, P.greenDeep);
    A.rect(c, 54, 17, 3, 1, P.green);
    d.footY = 42;
  }

  function makeWell(d, options) {
    const { A, c } = d;
    // Stone cylinder and masonry joints remain visible below the rim.
    A.ellipse(c, 23, 44, 20, 7, P.stoneEdge);
    A.rect(c, 3, 34, 40, 10, P.stoneEdge);
    A.rect(c, 4, 35, 38, 9, P.stone);
    A.ellipse(c, 23, 43, 19, 6, P.stone);
    A.rect(c, 6, 37, 7, 5, P.stoneLight);
    A.rect(c, 14, 38, 10, 5, '#a49c83');
    A.rect(c, 25, 38, 9, 5, '#968b73');
    A.rect(c, 35, 37, 5, 4, '#827764');
    A.line(c, 5, 43, 40, 43, P.stoneEdge);
    [13, 24, 34].forEach(x => A.line(c, x, 35, x, 42, P.stoneEdge));
    [8, 19, 30, 38].forEach(x => A.line(c, x, 44, x, 47, P.stoneEdge));
    ring(d, 23, 34, 21, 9, P.stoneEdge, P.stoneLight);
    A.ellipse(c, 23, 34, 14, 6, '#665d4e');
    A.ellipse(c, 23, 35, 12, 4, '#53695f');
    A.line(c, 13, 37, 23, 38, '#85968a');
    for (const [x, y, x2, y2] of [[5, 30, 12, 32], [13, 27, 16, 30], [25, 26, 25, 29], [34, 29, 32, 31], [39, 35, 35, 35], [31, 40, 29, 38], [18, 42, 18, 39], [7, 37, 11, 36]]) {
      A.line(c, x, y, x2, y2, P.stoneEdge);
    }
    if (options.roof !== false) {
      plank(d, 6, 12, 4, 26, P.oak);
      plank(d, 36, 12, 4, 26, P.grain);
      plank(d, 9, 21, 28, 4, P.oak, true);
      A.rect(c, 22, 23, 1, 12, P.edge);
      A.line(c, 20, 24, 25, 24, P.oakLight);
      edgedPoly(d, [[1, 13], [14, 1], [31, 1], [44, 13], [44, 17], [1, 17]], P.grain);
      edgedPoly(d, [[1, 13], [14, 1], [31, 1], [44, 13]], P.oakMid);
      A.line(c, 14, 2, 31, 2, P.oakTop);
      [5, 9].forEach(y => A.line(c, 14 - y, y, 31 + y, y, P.grain));
      [[13, 3, 8, 8], [22, 3, 20, 8], [31, 3, 33, 8], [11, 9, 7, 12], [26, 9, 27, 12], [36, 9, 39, 12]].forEach(a => A.line(c, ...a, P.grain));
      A.line(c, 2, 13, 43, 13, P.oakLight);
    }
    // Bucket on the right edge, a separate material from the stone.
    A.line(c, 33, 33, 34, 29, P.iron);
    A.line(c, 34, 29, 38, 29, P.iron);
    A.line(c, 38, 29, 39, 34, P.iron);
    edgedPoly(d, [[32, 34], [40, 34], [39, 42], [33, 42]], P.oak);
    A.line(c, 34, 35, 34, 40, P.oakLight);
    A.line(c, 37, 35, 37, 41, P.grain);
    ring(d, 36, 34, 4, 2, P.edge, '#8d7656');
    A.line(c, 33, 40, 39, 40, P.iron);
    d.footY = 49;
  }

  function makePlanter(d) {
    const { A, c, random } = d;
    edgedPoly(d, [[2, 11], [41, 11], [40, 20], [5, 20]], P.oak);
    A.rect(c, 4, 13, 36, 2, P.oakLight);
    A.rect(c, 5, 18, 35, 1, P.grain);
    A.line(c, 12, 15, 12, 19, P.grain);
    A.line(c, 31, 15, 31, 19, P.grain);
    A.rect(c, 2, 10, 40, 4, P.edge);
    A.rect(c, 3, 11, 38, 2, P.oakMid);
    A.rect(c, 4, 9, 36, 2, '#6b6336');
    for (let i = 0; i < 13; i++) {
      const x = 4 + i * 2.8;
      const y = 6 + Math.floor(random() * 6);
      A.ellipse(c, x, y, 4, 3, i % 3 ? P.green : P.greenDeep);
      A.rect(c, x - 2, y - 1, 3, 2, P.greenLight);
    }
    for (let i = 0; i < 9; i++) {
      const x = 5 + i * 4 + Math.floor(random() * 2);
      const y = 2 + Math.floor(random() * 6);
      A.rect(c, x, y + 2, 1, 7, P.greenDeep);
      const color = i % 3 ? P.white : '#e7cc82';
      A.rect(c, x - 1, y - 1, 3, 1, color);
      A.rect(c, x - 2, y, 5, 2, color);
      A.rect(c, x - 1, y + 2, 3, 1, color);
      A.rect(c, x, y + 1, 1, 1, P.yellow);
    }
    d.footY = 20;
  }

  function makeLamp(d) {
    const { A, c } = d;
    A.ellipse(c, 7, 41, 5, 2, P.edge);
    plank(d, 5, 5, 4, 36, P.deep);
    A.rect(c, 6, 6, 1, 33, P.oakLight);
    A.line(c, 7, 4, 12, 4, P.iron, 2);
    A.line(c, 12, 4, 12, 8, P.iron);
    edgedPoly(d, [[7, 10], [10, 7], [13, 10]], P.iron);
    edgedPoly(d, [[7, 10], [13, 10], [13, 18], [7, 18]], '#d0b56c', P.iron);
    A.rect(c, 8, 11, 2, 6, '#ebd591');
    A.line(c, 11, 11, 11, 17, P.iron);
    A.rect(c, 9, 14, 1, 2, P.white);
    A.rect(c, 6, 18, 8, 2, P.iron);
    A.rect(c, 7, 20, 6, 1, P.edge);
    d.footY = 42;
  }

  function makeCart(d) {
    const { A, c } = d;
    // Wheels behind the cargo bed; the handle leads toward the bottom-right.
    ring(d, 9, 27, 6, 8, P.edge, P.oak);
    ring(d, 9, 27, 4, 6, P.oakLight, P.grain);
    A.line(c, 5, 23, 12, 30, P.edge);
    A.line(c, 6, 31, 12, 23, P.edge);
    A.rect(c, 8, 26, 2, 2, P.iron);
    A.line(c, 32, 24, 44, 34, P.edge, 3);
    A.line(c, 33, 24, 45, 34, P.oakLight);
    edgedPoly(d, [[5, 9], [33, 6], [41, 15], [36, 27], [10, 28], [5, 21]], P.grain);
    edgedPoly(d, [[7, 8], [34, 6], [39, 14], [36, 20], [10, 21]], P.oakLight);
    A.line(c, 11, 9, 13, 20, P.grain);
    A.line(c, 21, 8, 23, 19, P.grain);
    A.line(c, 31, 7, 33, 18, P.grain);
    A.rect(c, 9, 21, 27, 3, P.oakMid);
    A.line(c, 10, 21, 36, 21, P.oakLight);
    A.line(c, 10, 25, 35, 25, P.edge);
    [13, 21, 30].forEach(x => A.rect(c, x, 23, 1, 2, P.grain));
    // Three tied cloth rolls, with shaded folded ends.
    [[11, 10, 10, 8], [21, 5, 11, 11], [29, 12, 8, 8]].forEach(([x, y, w, h], i) => {
      edgedPoly(d, [[x + 2, y], [x + w - 2, y], [x + w, y + 3], [x + w - 1, y + h], [x + 1, y + h], [x, y + 3]], i === 1 ? '#ded5b8' : P.cloth);
      A.rect(c, x + 2, y + 1, w - 4, 2, P.clothLight);
      A.line(c, x + Math.floor(w / 2), y + 1, x + Math.floor(w / 2), y + h, P.grain);
      A.line(c, x + 1, y + h - 2, x + w - 1, y + h - 2, P.clothEdge);
    });
    ring(d, 34, 28, 7, 8, P.edge, P.oak);
    ring(d, 34, 28, 5, 6, P.oakLight, P.grain);
    A.line(c, 30, 24, 38, 32, P.edge);
    A.line(c, 30, 32, 38, 24, P.edge);
    A.rect(c, 33, 27, 3, 3, P.iron);
    A.rect(c, 33, 27, 1, 1, P.ironLight);
    d.footY = 35;
  }

  function makeSign(d) {
    const { A, c } = d;
    plank(d, 3, 0, 5, 36, P.oak);
    plank(d, 7, 3, 19, 4, P.oak, true);
    A.line(c, 12, 6, 12, 10, P.iron);
    A.line(c, 22, 6, 22, 10, P.iron);
    edgedPoly(d, [[9, 9], [25, 9], [27, 12], [27, 24], [24, 28], [11, 28], [8, 25], [8, 12]], P.oakMid);
    A.line(c, 11, 11, 24, 11, P.oakTop);
    A.line(c, 9, 25, 25, 25, P.grain);
    A.line(c, 11, 13, 11, 23, P.oakLight);
    A.line(c, 23, 13, 23, 23, P.grain);
    // A small forged sword emblem: no lettering or raster asset.
    edgedPoly(d, [[18, 12], [20, 15], [18, 21], [16, 20]], '#b9b7a1', P.deep);
    A.line(c, 18, 14, 17, 19, P.clothLight);
    A.line(c, 14, 20, 21, 21, P.deep, 2);
    A.line(c, 17, 21, 16, 24, '#824d32', 2);
    A.rect(c, 15, 24, 3, 2, P.deep);
    A.rect(c, 4, 34, 3, 2, P.grain);
    d.footX = 6;
    d.footY = 36;
  }

  function makeWoodpile(d) {
    const { A, c } = d;
    const logs = [[3, 10, 23, 6], [11, 12, 25, 7], [3, 5, 29, 6], [14, 3, 22, 6], [9, 0, 25, 6]];
    logs.forEach(([x, y, length, height], index) => {
      edgedPoly(d, [[x + 3, y], [x + length - 3, y], [x + length, y + 2], [x + length - 1, y + height], [x + 1, y + height], [x, y + 2]], index % 2 ? P.oak : P.grain);
      A.line(c, x + 3, y + 1, x + length - 4, y + 1, P.oakLight);
      A.line(c, x + 5, y + height - 1, x + length - 4, y + height - 1, P.deep);
      ring(d, x + length - 2, y + 3, 4, 3, P.edge, P.oakTop);
      ring(d, x + length - 2, y + 3, 2, 2, P.grain, P.oakLight);
      A.rect(c, x + length - 2, y + 3, 1, 1, P.grain);
    });
    d.footY = 19;
  }

  function makeFenceSegment(options = {}) {
    const length = Math.max(18, Math.min(400, Math.round(options.width || 68)));
    const vertical = !!options.vertical;
    const d = makeDrawing(vertical ? 13 : length, vertical ? length : 25, options.seed ?? 14);
    const { A, c } = d;
    if (!vertical) {
      plank(d, 1, 8, length - 2, 4, P.oak, true);
      plank(d, 1, 17, length - 2, 4, P.oak, true);
      const step = Math.min(32, length - 8);
      const posts = [3];
      for (let x = 3 + step; x < length - 8; x += step) posts.push(x);
      posts.push(length - 8);
      [...new Set(posts)].forEach(x => {
        plank(d, x, 2, 6, 23, P.oakMid);
        A.rect(c, x + 1, 2, 4, 2, P.oakTop);
        A.rect(c, x + 1, 5, 1, 15, P.oakLight);
      });
      d.footY = 24;
    } else {
      plank(d, 3, 1, 3, length - 2, P.grain);
      plank(d, 9, 1, 3, length - 2, P.grain);
      const posts = [0];
      for (let y = 27; y < length - 15; y += 27) posts.push(y);
      posts.push(length - 15);
      [...new Set(posts)].forEach(y => {
        plank(d, 2, y + 1, 8, 14, P.oak);
        A.rect(c, 3, y + 1, 6, 2, P.oakLight);
        A.line(c, 3, y + 3, 3, y + 13, P.oakTop);
        A.line(c, 8, y + 4, 8, y + 13, P.grain);
      });
      d.footX = 6;
      d.footY = length - 1;
    }
    return finish(d);
  }

  const definitions = {
    barrel: [20, 25, makeBarrel], crate: [22, 20, makeCrate],
    table: [68, 44, makeTable], well: [45, 52, makeWell],
    planter: [44, 22, makePlanter], lamp: [15, 44, makeLamp],
    cart: [48, 37, makeCart], sign: [28, 38, makeSign],
    woodpile: [40, 20, makeWoodpile], stool: [18, 15, d => stool(d, 1, 1)]
  };

  function makeProp(type, options = {}) {
    if (type === 'fence-h' || type === 'fence-v') {
      return makeFenceSegment({ ...options, vertical: type === 'fence-v' });
    }
    const def = definitions[type];
    if (!def) throw new Error(`Unknown VillageProps type: ${type}`);
    const d = makeDrawing(def[0], def[1], options.seed ?? 113);
    def[2](d, options);
    return finish(d);
  }

  window.VillageProps = Object.freeze({ makeProp, makeFenceSegment });
})();
