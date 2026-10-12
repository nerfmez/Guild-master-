/* Bake small warm light layers once; the renderer only fades/moves them at dusk. */
export function nightAmount(clock = 0) {
  const t = ((clock % 240) + 240) % 240 / 240;
  return t < .2 ? 1 : t < .25 ? (.25 - t) / .05 : t < .72 ? 0 : t < .8 ? (t - .72) / .08 : 1;
}

// Pixel anchors for the existing farm and frontier sprites, relative to their feet.
export function sceneryNightLights(key,sprite) {
  const at=(x,y,kind='lamp',radius=36)=>({kind,x:x-sprite.footX,y:y-sprite.footY,radius});
  const pane=(points,colors)=>({points:points.map(([x,y])=>[x-sprite.footX,y-sprite.footY]),colors});
  if(key==='lm-lamp')return[at(10,14,'lamp',30),at(7,40,'spill',36)];
  if(key==='barn')return[pane([[28,95],[43,95],[43,110],[28,110]],['#687b77','#b4bda0','#4e625d']),at(79,105),at(66,132,'spill',42)];
  if(key==='windmill')return[pane([[29,57],[35,57],[35,64],[29,64]],['#9fc0c8','#d8eef0']),at(42,86),at(32,111,'spill',36)];
  if(key==='lm-post-0')return[at(54,38,'lamp',30)];
  if(key==='lm-fire-0')return[at(22,27,'spill',44)];
  if(key.startsWith('lm-frontier-camp'))return[{kind:'spill',x:-31.2,y:4.8,radius:46}];
  return [];
}

export function makeNightLight(sprite) {
  const pad = 48, width = sprite.canvas.width + pad * 2, height = sprite.canvas.height + pad * 2;
  const canvas = () => { const c = document.createElement('canvas'); c.width = width; c.height = height; return c; };
  const panes = canvas(), glow = canvas(), p = panes.getContext('2d'), g = glow.getContext('2d');
  const ox = sprite.footX + pad, oy = sprite.footY + pad;
  const polygon = (ctx, points) => { ctx.beginPath(); points.forEach(([x,y], i) => i ? ctx.lineTo(ox+x,oy+y) : ctx.moveTo(ox+x,oy+y)); ctx.closePath(); ctx.fill(); };
  const colors = new Set();
  for (const light of sprite.nightLights || []) {
    if (light.points) {
      p.fillStyle = '#ffda95'; polygon(p, light.points);
      for (const color of light.colors || []) colors.add(color.toLowerCase());
    }
  }
  // Illuminate the glass, retaining mullions, shutters and anything in front of it.
  const pixels = p.getImageData(pad,pad,sprite.canvas.width,sprite.canvas.height);
  const original = sprite.canvas.getContext('2d').getImageData(0,0,sprite.canvas.width,sprite.canvas.height).data;
  for (let i=0; i<pixels.data.length; i+=4) if (pixels.data[i+3]) {
    const color = '#'+[original[i],original[i+1],original[i+2]].map(v=>v.toString(16).padStart(2,'0')).join('');
    if (!colors.has(color)) pixels.data[i+3]=0;
  }
  p.putImageData(pixels,pad,pad);
  for (const light of sprite.nightLights || []) {
    const points = light.points;
    const x = ox + (points ? points.reduce((s,a)=>s+a[0],0)/points.length : light.x);
    const y = oy + (points ? points.reduce((s,a)=>s+a[1],0)/points.length : light.y);
    if (light.kind === 'lamp') {
      p.fillStyle='#795338'; p.fillRect(Math.round(x)-3,Math.round(y)-4,6,8);
      p.fillStyle='#ffd17e'; p.fillRect(Math.round(x)-2,Math.round(y)-3,4,6);
      p.fillStyle='#fff0c3'; p.fillRect(Math.round(x)-1,Math.round(y)-2,2,4);
    }
    const radius = light.radius || (points ? 22 : 36), sy = light.kind === 'spill' ? .5 : .8;
    g.save(); g.translate(x,y); g.scale(1,sy);
    const halo=g.createRadialGradient(0,0,0,0,0,radius);
    halo.addColorStop(0,light.kind==='spill'?'rgba(255,154,65,.3)':'rgba(255,172,76,.38)');
    halo.addColorStop(.4,'rgba(255,158,64,.13)'); halo.addColorStop(1,'rgba(255,150,50,0)');
    g.fillStyle=halo;g.fillRect(-radius,-radius,radius*2,radius*2);g.restore();
  }
  return {panes,glow,pad};
}
