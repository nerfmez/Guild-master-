/* Native fullscreen where available; focus mode keeps unsupported mobile browsers playable. */
export function initFullscreen(button, { notify = () => {}, resize = () => {} } = {}) {
  const root = document.documentElement;
  const current = () => document.fullscreenElement || document.webkitFullscreenElement;
  const sync = () => { const on = Boolean(current()) || document.body.classList.contains('play-focus'); button.textContent = on ? '↙' : '⛶'; const label=current()?'ออกจากเต็มจอ':on?'ออกจากโหมดเล่น':'เล่นเต็มจอ';button.setAttribute('aria-label',label); button.setAttribute('aria-pressed', String(on)); button.title=label; resize(); };
  button.addEventListener('click', async () => {
    try {
      if (current()) { const exit = document.exitFullscreen || document.webkitExitFullscreen; await exit.call(document); }
      else if (document.body.classList.contains('play-focus')) document.body.classList.remove('play-focus');
      else { const request = root.requestFullscreen || root.webkitRequestFullscreen;
        if (request) await request.call(root,...(root.requestFullscreen?[{navigationUI:'hide'}]:[]));
        else { document.body.classList.add('play-focus'); notify('เปิดโหมดเล่นซ่อนแถบข้อมูลแล้ว · เบราว์เซอร์นี้ไม่รองรับการซ่อนแถบด้านบน'); }
      }
    } catch { document.body.classList.add('play-focus'); notify('เบราว์เซอร์ไม่อนุญาตเต็มจอ · เปิดโหมดเล่นซ่อนแถบข้อมูลแทน'); }
    sync();
  });
  document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('play-focus')) { document.body.classList.remove('play-focus'); sync(); } });
  sync(); return { sync };
}
