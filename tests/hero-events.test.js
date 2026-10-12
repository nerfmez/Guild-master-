import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, act, tick, serializeGame, deserializeGame } from '../src/game.js';
import { HERO_ENCOUNTERS, heroEncounterView, heroEncounterModifiers, tickHeroEncounters } from '../src/hero-events.js';

function game(seed = 73) {
  const s = createGame(seed); s.policy = { memberHunting: false, autoPetitions: false, registration: false };
  assert.equal(act(s, 'heroMode', { on: true }).ok, true);
  return s;
}
function offer(s, id) { s.hero.encounters.pending = { id, serial: ++s.hero.encounters.serial }; }
const quiet = () => ({ log() {}, reward() {} });

test('encounters require active exploration, safe space and a quiet storyteller', () => {
  const s = game(), e = s.hero.encounters;
  e.nextIn = 0; s.world.monsters = [];
  tickHeroEncounters(s, quiet(), 1); assert.equal(e.pending, null, 'standing still does not farm encounters');
  e.travel = 11; s.director.pending = { id: 'other' };
  tickHeroEncounters(s, quiet(), 1); assert.equal(e.pending, null);
  s.director.pending = null; s.heroCall = {step:'walk'};
  tickHeroEncounters(s, quiet(), 1); assert.equal(e.pending, null, 'first-call tutorial has priority');
  s.heroCall = {step:'done',skipped:true}; s.world.monsters = [{ id: 'near', x: s.hero.x + 2, y: s.hero.y }];
  tickHeroEncounters(s, quiet(), 1); assert.equal(e.pending, null, 'no popup during nearby combat');
  s.world.monsters = []; s.hero.active = false;
  tickHeroEncounters(s, quiet(), 1); assert.equal(e.pending, null, 'management mode has no encounters');
  s.hero.active = true; tickHeroEncounters(s, quiet(), 1); assert.ok(e.pending);
  assert.ok(e.nextIn >= 65 && e.nextIn <= 115);
});

test('saved encounter RNG is reproducible, mixes tones, avoids recent repeats and leaves world RNG alone', () => {
  const a = game(91), b = game(91), worldRng = a.world.rng, picks = [];
  for (let i = 0; i < 18; i++) for (const s of [a, b]) {
    s.world.monsters = []; s.hero.encounters.nextIn = 0; s.hero.encounters.travel = 11;
    tickHeroEncounters(s, quiet(), 1);
    if (s === a) picks.push(s.hero.encounters.pending.id);
    else assert.equal(s.hero.encounters.pending.id, picks.at(-1));
    assert.equal(act(s, 'resolveHeroEncounter', { choiceId: 'leave' }).ok, true);
  }
  assert.equal(a.world.rng, worldRng);
  for (let i = 1; i < picks.length; i++) {
    assert.ok(!picks.slice(Math.max(0, i - 3), i).includes(picks[i]));
    assert.notEqual(HERO_ENCOUNTERS.find(x => x.id === picks[i]).tone, HERO_ENCOUNTERS.find(x => x.id === picks[i - 1]).tone);
  }
});

test('paid choices are checked again on action, and can only reward once', () => {
  const s = game(); offer(s, 'goblinAuction'); s.gold = 0;
  assert.equal(heroEncounterView(s).pending.choices.find(c => c.id === 'buy').disabled, true);
  assert.equal(act(s, 'resolveHeroEncounter', { choiceId: 'buy' }).ok, false);
  assert.ok(s.hero.encounters.pending);
  s.gold = 100;
  assert.equal(act(s, 'resolveHeroEncounter', { choiceId: 'buy' }).ok, true);
  const after = serializeGame(s);
  assert.equal(act(s, 'resolveHeroEncounter', { choiceId: 'buy' }).ok, false);
  assert.equal(serializeGame(s), after);
});

test('temporary buffs change walking and attacks, expire during Hero play, and clear on exit', () => {
  const s = game(); s.world.monsters = []; offer(s, 'teaSprint');
  act(s, 'resolveHeroEncounter', { choiceId: 'drink' });
  assert.equal(heroEncounterModifiers(s.hero).speed, 1.25);
  const x = s.hero.x; s.hero.input = { dx: 1, dy: 0 }; tick(s, 1);
  assert.ok(s.hero.x - x > 3.8, 'buff is used by movement simulation');
  s.hero.input = {}; tick(s, 30);
  assert.equal(heroEncounterModifiers(s.hero).speed, 1);
  offer(s, 'laundryCape'); act(s, 'resolveHeroEncounter', { choiceId: 'pose' });
  const m = { id: 'test-foe', species: 'leafSlime', x: s.hero.x + .5, y: s.hero.y, hx: s.hero.x + .5, hy: s.hero.y, hp: 100, maxHp: 100, target: null, cd: 100 };
  s.world.monsters = [m]; s.hero.fx = 1; s.hero.fy = 0; s.hero.input = { s1: true }; tick(s, .25);
  assert.ok(100 - m.hp > 33, 'power buff affects the spin attack');
  act(s, 'heroMode', { on: false }); assert.equal(s.hero.encounters.buffs.length, 0);
});

test('reach challenges award a chest only at the destination, and survive save/load', () => {
  let s = game(); offer(s, 'fallingStar'); act(s, 'resolveHeroEncounter', { choiceId: 'chase' });
  assert.equal(s.progress.chests.length, 0);
  const c = s.hero.encounters.challenge;
  assert.ok(Math.hypot(c.goal.x - s.hero.x, c.goal.y - s.hero.y) > 1.2);
  s = deserializeGame(serializeGame(s));
  assert.deepEqual(s.hero.encounters.challenge.goal, c.goal);
  Object.assign(s.hero, c.goal); tick(s, .25);
  assert.equal(s.hero.encounters.challenge, null);
  assert.equal(s.progress.chests.length, 1);
  tick(s, 1); assert.equal(s.progress.chests.length, 1, 'no repeated completion reward');
});

test('combat challenges count the player’s actual kills and remove event monsters on victory', () => {
  let s = game(); offer(s, 'slimeUnion'); act(s, 'resolveHeroEncounter', { choiceId: 'spar' });
  const ids = [...s.hero.encounters.challenge.monsterIds];
  s = deserializeGame(serializeGame(s));
  assert.deepEqual(s.hero.encounters.challenge.monsterIds, ids);
  for (const id of ids) {
    const m = s.world.monsters.find(m => m.id === id); m.hp = 1;
    Object.assign(s.hero, { x: m.x - .5, y: m.y, fx: 1, fy: 0, atkCd: 0 });
    s.hero.input = { attack: true }; tick(s, .25);
  }
  assert.equal(s.hero.encounters.challenge, null);
  assert.ok(s.hero.encounters.notice.won);
  assert.equal(s.hero.kills, 2);
  assert.ok(ids.every(id => !s.world.monsters.some(m => m.id === id)));
  assert.ok(s.ledger.some(e => e.gold === 35 && e.text.includes('Hero')));
});

test('timeout, abandoning and knockout clean up without awarding the challenge', () => {
  for (const end of ['timeout', 'abandon', 'knockout', 'exit']) {
    const s = game(); offer(s, 'honeyAlarm'); act(s, 'resolveHeroEncounter', { choiceId: 'fight' });
    const ids = [...s.hero.encounters.challenge.monsterIds], gold = s.gold;
    if (end === 'timeout') { s.hero.encounters.challenge.left = .1; tickHeroEncounters(s, quiet(), .25); }
    if (end === 'abandon') assert.equal(act(s, 'abandonHeroChallenge').ok, true);
    if (end === 'knockout') { s.hero.down = 4; tickHeroEncounters(s, quiet(), .25); }
    if (end === 'exit') act(s, 'heroMode', { on: false });
    assert.equal(s.hero.encounters.challenge, null, end);
    assert.equal(s.gold, gold, end);
    assert.ok(ids.every(id => !s.world.monsters.some(m => m.id === id)), end);
  }
});

test('old saves and malformed encounter data recover; orphan enemies are removed', () => {
  const s = game(), raw = JSON.parse(serializeGame(s)); delete raw.checksum; delete raw.hero.encounters;
  assert.equal(deserializeGame(JSON.stringify(raw)).hero.encounters.pending, null);
  offer(s, 'slimeUnion'); act(s, 'resolveHeroEncounter', { choiceId: 'spar' });
  const data = JSON.parse(serializeGame(s));
  delete data.checksum;
  data.hero.encounters.challenge.choiceId = 'does-not-exist';
  data.hero.encounters.pending = { id: 'bad-event' };
  data.hero.encounters.buffs = [{ kind: 'god-mode', left: 1e9 }];
  const back = deserializeGame(JSON.stringify(data));
  assert.equal(back.hero.encounters.challenge, null); assert.equal(back.hero.encounters.pending, null);
  assert.deepEqual(back.hero.encounters.buffs, []);
  assert.ok(!back.world.monsters.some(m => m.heroEncounter));
});

test('every encounter has a free escape option and every authored choice runs without corrupting a save', () => {
  for (const def of HERO_ENCOUNTERS) for (const choice of [...def.choices, { id: 'leave' }]) {
    const s = game(); offer(s, def.id);
    assert.equal(heroEncounterView(s).pending.choices.at(-1).id, 'leave');
    assert.equal(act(s, 'resolveHeroEncounter', { choiceId: choice.id }).ok, true, `${def.id}/${choice.id}`);
    assert.doesNotThrow(() => deserializeGame(serializeGame(s)), def.id);
  }
});

test('R48 basic attacks for all four classes benefit from the power buff', () => {
  for (const cls of ['warrior', 'archer', 'mage', 'healer']) {
    const s = game(); s.hero.cls = cls;
    const m = { id: 'buff-target', species: 'leafSlime', x: s.hero.x + .5, y: s.hero.y, hx: s.hero.x + .5, hy: s.hero.y, hp: 100, maxHp: 100, cd: 100 };
    s.world.monsters = [m]; s.hero.fx = 1; s.hero.fy = 0;
    const plain = deserializeGame(serializeGame(s));
    offer(s, 'laundryCape'); act(s, 'resolveHeroEncounter', { choiceId: 'pose' });
    for (const state of [s, plain]) { state.hero.input = { attack: true }; tick(state, .25); }
    assert.ok(m.hp < plain.world.monsters.find(x => x.id === m.id).hp, cls);
  }
});

test('R48 companion kills count toward the player’s encounter, without crediting personal hero kills', () => {
  const s = game();
  assert.equal(act(s, 'heroCompanions', { ids: [s.members[0].id] }).ok, true);
  offer(s, 'fakeBoss'); act(s, 'resolveHeroEncounter', { choiceId: 'act' });
  const ally = s.world.hunters.find(h => h.escort), m = s.world.monsters.find(m => m.heroEncounter);
  assert.ok(ally); Object.assign(m, { x: ally.x + .2, y: ally.y, hp: 1 }); ally.atkCd = 0; ally.skillCd = 100;
  s.hero.input = {}; tick(s, .25);
  assert.equal(s.hero.encounters.challenge, null);
  assert.equal(s.hero.encounters.notice.won, true);
  assert.equal(s.hero.kills, 0);
});

test('R48 destination markers respect western bounds and the unlocked eastern frontier', () => {
  for (const [rank, x, max] of [['F', 78, 80], ['B', 144, 148]]) {
    const s = game(); s.rank = rank; s.hero.x = x; s.hero.y = 55;
    offer(s, 'fallingStar'); act(s, 'resolveHeroEncounter', { choiceId: 'chase' });
    const goal = s.hero.encounters.challenge.goal;
    assert.ok(goal.x >= -60 && goal.x <= max && goal.y >= -66 && goal.y <= 56);
    assert.deepEqual(deserializeGame(serializeGame(s)).hero.encounters.challenge.goal, goal);
    Object.assign(s.hero, goal); tick(s, .25); assert.equal(s.hero.encounters.notice.won, true);
  }
});
