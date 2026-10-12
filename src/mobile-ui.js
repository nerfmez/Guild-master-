/* Keep the world's corners clear on phones; the original controls live in a drawer. */
export function initMobileUI({ beforeOpen = () => {}, afterClose = () => {}, beforeSceneOnly = () => {}, afterSceneOnly = () => {} } = {}) {
  const $ = id => document.getElementById(id), button = $('notifications-button'), dialog = $('notifications-dialog');
  const media = matchMedia('(max-width:900px), (max-height:500px), (pointer:coarse) and (max-width:1400px)'), records = [];
  const nodes = [document.querySelector('.corner-stack'), $('city-stats'),$('event-banner')];
  const anchors = nodes.map(node => { const anchor = document.createComment('HUD home'); node.before(anchor); return anchor; });
  const sync = () => { const unread = records.filter(r => !r.read).length;
    $('notifications-count').textContent = String(unread); button.setAttribute('aria-label', `ข่าวใหม่ ${unread} เรื่อง`); button.classList.toggle('urgent', unread > 0);
  };
  const render = () => { const box = $('notification-news'); box.replaceChildren();
    if (!records.length) { const p = document.createElement('p'); p.className = 'tiny-note'; p.textContent = 'ยังไม่มีข่าวใหม่'; box.append(p); }
    for (const record of records) { const el = document.createElement(record.action ? 'button' : 'p'); el.className = 'notification-news' + (record.error ? ' error' : ''); el.textContent = record.text;
      if (record.action) { el.type = 'button'; el.addEventListener('click', () => { dialog.close(); record.action(); }); } box.append(el);
    }
  };
  const layout = () => { document.body.classList.toggle('compact-ui', media.matches);
    nodes.forEach((node, i) => { anchors[i].after(node); });
    if (!media.matches && dialog.open) dialog.close(); sync();
  };
  const drawer=$('quick-drawer'), drawerContent=$('quick-drawer-content'); let activeDrawer=null;
  const closeDrawer=()=>{drawer.hidden=true;activeDrawer=null;};
  const showDrawer=(type)=>{if(activeDrawer===type&&!drawer.hidden){closeDrawer();return;}beforeOpen();activeDrawer=type;drawer.hidden=false;$('quick-drawer-title').textContent=type==='news'?'📰 ข่าวสาร':'📜 เควสผู้เล่น';if(type==='news'){records.forEach(r=>r.read=true);sync();drawerContent.replaceChildren();if(!records.length){const p=document.createElement('p');p.className='tiny-note';p.textContent='ยังไม่มีข่าวใหม่';drawerContent.append(p);}for(const record of records){const item=document.createElement(record.action?'button':'div');item.className='quick-entry';item.textContent=record.text;if(record.action)item.addEventListener('click',()=>{closeDrawer();record.action();});drawerContent.append(item);}}else{drawerContent.innerHTML=window.guildQuickQuests?.()||'<p>กำลังโหลดเควส</p>';}};
  button.addEventListener('click',()=>showDrawer('news'));
  $('quick-drawer-close').addEventListener('click',closeDrawer);
  $('notifications-close').addEventListener('click', () => dialog.close());
  $('quest-alert-button').addEventListener('click',()=>showDrawer('quests'));
  drawerContent.addEventListener('click',event=>{const target=event.target.closest('[data-quick-action]');if(!target)return;closeDrawer();window.guildQuickAction?.(target.dataset.quickAction);});
  dialog.addEventListener('close', afterClose);
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
  return { sync, setQuestCount(count) { const badge=$('quest-alert-count'); if(!badge)return;badge.textContent=String(count);badge.hidden=count===0;$('quest-alert-button').classList.toggle('urgent',count>0);$('quest-alert-button').setAttribute('aria-label',count?`เควสผู้เล่น มี ${count} เป้าหมาย`:'เควสผู้เล่น'); }, reset() { records.length = 0; render(); sync(); }, compact: () => media.matches, record(text, error, action) { records.unshift({ text, error, action, read: dialog.open }); records.length = Math.min(records.length, 24); if (dialog.open) render(); sync(); } };
}
