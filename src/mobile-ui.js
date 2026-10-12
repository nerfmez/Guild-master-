/* Keep the world's corners clear on phones; the original controls live in a drawer. */
export function initMobileUI({ beforeOpen = () => {}, afterClose = () => {}, beforeSceneOnly = () => {}, afterSceneOnly = () => {} } = {}) {
  const $ = id => document.getElementById(id), button = $('notifications-button'), dialog = $('notifications-dialog');
  const media = matchMedia('(max-width:900px), (max-height:500px), (pointer:coarse) and (max-width:1400px)'), records = [];
  const nodes = [document.querySelector('.corner-stack'), $('city-stats'),$('event-banner')];
  const anchors = nodes.map(node => { const anchor = document.createComment('HUD home'); node.before(anchor); return anchor; });
  const sync = () => { const goals = $('near-goals').querySelectorAll('button').length + 1 + Number(!$('event-banner').hidden), unread = records.filter(r => !r.read).length;
    $('notifications-count').textContent = String(goals + unread); button.setAttribute('aria-label', `ข่าวและเป้าหมาย ${goals + unread} เรื่อง`); button.classList.toggle('urgent', $('goal-card').classList.contains('urgent') || unread > 0);
  };
  const render = () => { const box = $('notification-news'); box.replaceChildren();
    if (!records.length) { const p = document.createElement('p'); p.className = 'tiny-note'; p.textContent = 'ข่าวใหม่จะรวมไว้ที่นี่ เป้าหมายและหีบอยู่ด้านล่าง'; box.append(p); }
    for (const record of records) { const el = document.createElement(record.action ? 'button' : 'p'); el.className = 'notification-news' + (record.error ? ' error' : ''); el.textContent = record.text;
      if (record.action) { el.type = 'button'; el.addEventListener('click', () => { dialog.close(); record.action(); }); } box.append(el);
    }
  };
  const layout = () => { document.body.classList.toggle('compact-ui', media.matches);
    nodes.forEach((node, i) => { if (media.matches) $('notification-hud').append(node); else anchors[i].after(node); });
    if (!media.matches && dialog.open) dialog.close(); sync();
  };
  button.addEventListener('click', () => { beforeOpen(); records.forEach(r => r.read = true); render(); sync(); dialog.showModal(); });
  $('notifications-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', afterClose);
  $('notification-hud').addEventListener('click',event=>{if(event.target.closest('button'))dialog.close();},true);
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  $('view-controls-toggle').addEventListener('click', () => { const el = $('view-controls-toggle'), expanded = el.getAttribute('aria-expanded') !== 'true'; el.setAttribute('aria-expanded', String(expanded)); document.querySelector('.world-actions').classList.toggle('expanded', expanded); });
  $('hero-details-toggle').addEventListener('click',()=>{const on=document.body.classList.toggle('hero-details-open');$('hero-details-toggle').setAttribute('aria-expanded',String(on));});
  $('hero-map-toggle').addEventListener('click',()=>{const on=document.body.classList.toggle('hero-map-open');$('hero-map-toggle').setAttribute('aria-pressed',String(on));});
  document.querySelectorAll('.dock-btn').forEach(el=>{if(!el.hasAttribute('aria-label'))el.setAttribute('aria-label',el.querySelector('span').textContent.trim());});
  $('dock-toggle').addEventListener('click',()=>{const on=document.body.classList.toggle('landscape-dock-open');$('dock-toggle').setAttribute('aria-expanded',String(on));$('dock-toggle').setAttribute('aria-label',on?'พับเมนู':'เปิดเมนู');$('dock-toggle').textContent=on?'×':'☰';});
  $('dock').addEventListener('click',event=>{if(event.target.closest('.dock-btn')){document.body.classList.remove('landscape-dock-open');$('dock-toggle').setAttribute('aria-expanded','false');$('dock-toggle').setAttribute('aria-label','เปิดเมนู');$('dock-toggle').textContent='☰';}});
  const sceneOnly=on=>{document.body.classList.toggle('scene-only',on);$('scene-only-button').setAttribute('aria-pressed',String(on));if(on){beforeSceneOnly();$('restore-ui').focus({preventScroll:true});}else{afterSceneOnly();$('scene-only-button').focus({preventScroll:true});}};
  $('scene-only-button').addEventListener('click',()=>sceneOnly(true));
  $('restore-ui').addEventListener('click',()=>sceneOnly(false));
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('scene-only')){event.preventDefault();sceneOnly(false);}});
  media.addEventListener('change', layout); layout();
  return { sync, reset() { records.length = 0; render(); sync(); }, compact: () => media.matches, record(text, error, action) { records.unshift({ text, error, action, read: dialog.open }); records.length = Math.min(records.length, 24); if (dialog.open) render(); sync(); } };
}
