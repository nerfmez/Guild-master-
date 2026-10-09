/** Optional browser smoke test. Run with node tests/ui-smoke.mjs; excluded from npm test.
 * Set PLAYWRIGHT_MODULE / BROWSER_EXECUTABLE when using another Playwright installation.
 * Uses the real UI and read-only diagnostics. Virtual time advances the normal game loop.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { serializeGame } from '../src/game.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.UI_SMOKE_PORT || 5182);
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || '/root/.cache/ms-playwright/chromium_headless_shell-1194/chrome-linux/headless_shell' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  for (let attempt = 0; attempt < 20; attempt++) {
    try { await page.goto(`http://127.0.0.1:${port}`); break; }
    catch (error) { if (attempt === 19) throw error; await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  await page.waitForFunction(() => Boolean(window.guildDebug));
  await page.evaluate(() => document.fonts.ready);
  const state = () => page.evaluate(() => window.guildDebug.getState());
  const click = selector => page.locator(selector).first().click();
  const nav = tab => click(`.bottom-nav [data-tab="${tab}"]`);
  const sceneClick = async (x, y) => {
    const point = await page.evaluate(({ x, y }) => window.guildDebug.getScenePoint(x + 0.5, y + 0.5), { x, y });
    await page.mouse.click(point.x, point.y);
  };

  await click('[data-quest="patrol"]');
  await click('[data-pick-member="mira"]');
  assert.equal(await page.locator('[data-send-mission]').isDisabled(), true, 'Incomplete team cannot leave');
  assert.match(await page.locator('.readiness').textContent(), /3|สาม/, 'Disabled action explains the missing members');
  await click('[data-pick-member="finn"]');
  await click('[data-pick-member="lune"]');
  await click('[data-send-mission]');
  await click('[data-speed="4"]');
  await page.clock.runFor(6000);
  assert.equal(await page.locator('[data-event-choice="help"]').isVisible(), true, 'Journey event appears');
  await click('[data-event-choice="help"]');
  await page.clock.runFor(10000);
  const completed = await state();
  assert.equal(completed.missions.at(-1).status, 'completed');
  assert.equal(completed.missions.at(-1).event.choiceId, 'help');
  assert.equal(completed.completedQuests.patrol, 1);
  assert.equal(completed.gold, 1310, 'Mission reward is paid once');
  await click('#pause-button');

  await nav('workshop');
  await click('[data-craft="oak-blade"]');
  await click('[data-equip="oak-blade"]');
  assert.equal((await state()).members.find(member => member.id === 'mira').equipment.weapon, 'oak-blade');
  assert.equal((await state()).gold, 1225);

  await nav('build');
  assert.equal(await page.locator('[data-build="reception"]').isDisabled(), true, 'Unique room cannot be built twice');
  await click('[data-facility="room-1"]');
  await click('[data-upgrade="room-1"]');
  assert.match(await page.locator('#confirm-message').textContent(), /234.*11.*6/, 'Upgrade confirms the actual cost');
  const beforeUpgrade = await state();
  await click('#confirm-ok');
  const afterUpgrade = await state();
  assert.deepEqual([beforeUpgrade.gold - afterUpgrade.gold, beforeUpgrade.wood - afterUpgrade.wood, beforeUpgrade.stone - afterUpgrade.stone], [234, 11, 6]);

  await nav('build');
  await click('[data-facility="room-2"]');
  await click('[data-move="room-2"]');
  await sceneClick(5, 4);
  assert.deepEqual((await state()).facilities.find(room => room.id === 'room-2'), { id: 'room-2', type: 'dorm', x: 8, y: 3, level: 1 }, 'Overlapping move is rejected');
  await sceneClick(8, 11);
  const moved = await state();
  assert.equal(moved.facilities.find(room => room.id === 'room-2').y, 11);
  assert.equal(moved.gold, afterUpgrade.gold, 'Moving a room is free');

  // Valid imported saves can have an engine pause flag. Import must resume the
  // simulation and apply the saved controls, rather than displaying a running
  // UI over an engine that refuses to tick.
  const pausedImport = await state();
  delete pausedImport.checksum;
  pausedImport.settings = { ...pausedImport.settings, paused: true, speed: 2, sound: false };
  const importText = serializeGame(pausedImport);
  await click('#settings-button');
  await page.locator('#import-file').setInputFiles({ name: 'paused-guild.json', mimeType: 'application/json', buffer: Buffer.from(importText) });
  await page.locator('#confirm-dialog').waitFor({ state: 'visible' });
  await click('#confirm-ok');
  const imported = await state();
  assert.equal(imported.settings.paused, false, 'Import clears the engine pause flag');
  assert.equal(imported.settings.speed, 2);
  assert.equal(imported.settings.sound, false);
  assert.equal(await page.locator('[data-speed="2"]').getAttribute('aria-pressed'), 'true', 'Import applies saved speed to the UI');
  await page.clock.runFor(1000);
  assert.ok((await state()).elapsed > imported.elapsed + 1, 'Imported game actually advances at the saved speed');
  await click('#pause-button');

  await click('#settings-button');
  await click('[data-save-now]');
  await page.locator('#settings-dialog [aria-label="ปิด"]').click();
  const saved = await state();
  await page.reload();
  await page.waitForFunction(() => Boolean(window.guildDebug));
  await page.evaluate(() => document.fonts.ready);
  assert.equal((await state()).gold, saved.gold, 'Reload does not repeat rewards');
  assert.deepEqual((await state()).completedQuests, saved.completedQuests);
  await page.clock.resume();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, 'Phone layout has no horizontal overflow');
  assert.deepEqual(errors, [], 'No uncaught JavaScript errors');

  if (process.env.UI_SMOKE_EVIDENCE) {
    await mkdir(process.env.UI_SMOKE_EVIDENCE, { recursive: true });
    await page.screenshot({ path: `${process.env.UI_SMOKE_EVIDENCE}/mobile-smoke.png`, fullPage: true });
  }
  console.log('UI smoke passed: team, event, mission reward, craft/equip, upgrade cost, move guard, paused-save import/control sync, save/reload, mobile.');
} finally {
  await browser.close();
  server.kill();
}
