import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, act, tick, getFestivalInfo } from '../src/game.js';
import { isGameNight } from '../src/festivals.js';

test('lanterns are restricted to 18:00–06:00 and daytime rejection charges nothing', () => {
  for (const clock of [60, 120, 179.9]) {
    const s = createGame(11); s.village.stage = 1; s.clock = clock;
    const gold = s.gold;
    assert.equal(getFestivalInfo(s, 'lantern').ok, false);
    assert.equal(act(s, 'startFestival', { kind: 'lantern', gold: 120 }).ok, false);
    assert.equal(s.gold, gold); assert.equal(s.festivals.live, null);
  }
  for (const clock of [0, 30, 180, 239]) { const s = createGame(); s.village.stage = 1; s.clock = clock; assert.equal(isGameNight(s), true); assert.equal(getFestivalInfo(s, 'lantern').ok, true); }
});
test('a late-night lantern festival finishes by dawn and opening reflects its real preparation time', () => {
  const s = createGame(11); s.village.stage = 1; s.clock = 50; s.elapsed = 50;
  const info = getFestivalInfo(s, 'lantern'); assert.equal(info.prep + info.length, 10);
  assert.equal(act(s, 'startFestival', { kind: 'lantern', gold: 120 }).ok, true);
  assert.equal(s.festivals.live.end, 60);
  tick(s, 10); assert.equal(s.festivals.live, null); assert.equal(s.festivals.held, 1);
  assert.equal(isGameNight(s), false);
});
test('a festival started in the evening stays within the same night across midnight', () => {
  const s = createGame(11); s.village.stage = 1; s.clock = 180; s.elapsed = 180;
  assert.equal(act(s, 'startFestival', { kind: 'lantern', gold: 120 }).ok, true);
  const duration = s.festivals.live.end - s.elapsed;
  assert.ok(duration <= 120); tick(s, duration);
  assert.equal(s.festivals.live, null); assert.equal(s.day, 2); assert.equal(isGameNight(s), true);
});
test('the dawn cutoff only restricts lanterns, not the other festivals', () => {
  const s = createGame(); s.village.stage = s.village.arena = s.village.fairground = 1; s.clock = 55;
  assert.equal(getFestivalInfo(s, 'lantern').ok, false);
  assert.equal(getFestivalInfo(s, 'tournament').ok, true); assert.equal(getFestivalInfo(s, 'harvest').ok, true);
});
