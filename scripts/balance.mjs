// Balance report: a plain player through the story and an hour of free play, per seed.
import { simulate } from '../tests/simulate.js';
const seeds = process.argv.slice(2).map(Number).filter(Number.isFinite);
for (const seed of seeds.length ? seeds : [1, 2, 3]) {
  const { metrics: m } = simulate(seed, { freePlay: 3600 });
  const min = s => s === undefined ? '-' : `${Math.round(s / 60)}m`;
  console.log(`seed ${seed}: story ${min(m.finishedAt)} · ranks ${Object.entries(m.ranks).map(([r, t]) => r + ' ' + min(t)).join(', ')}`);
  console.log(`  village ${Object.entries(m.village).map(([l, t]) => 'L' + l + ' ' + min(t)).join(', ')} · board runs ${m.boardRuns} · player runs ${m.playerRuns} · failures ${m.failures}`);
  console.log(`  village trade ${Math.round(m.trade)} G · gold low ${m.minGold} · upgrades ${m.upgrades} · projects ${m.projects} · final ${JSON.stringify(m.final)}`);
  console.log(`  ledger ${Object.entries(m.ledger).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' | ')}`);
}
