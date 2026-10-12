/** Pacing across the whole journey: run the hands-off bot over several seeds and pay plans and print one line per run.
 *  node tests/pacing.mjs [plans=standard,generous,thrifty] [seeds=1,2,3,4,5] */
import { simulate } from './simulate.js';
const plans = (process.argv[2] || 'standard,generous,thrifty').split(','), seeds = (process.argv[3] || '1,2,3,4,5').split(',').map(Number);
const min = s => s == null ? null : Math.round(s / 60);
for (const plan of plans) for (const seed of seeds) {
  const t0 = Date.now(), { state, metrics: m } = simulate(seed, { plan });
  console.log(JSON.stringify({ plan, seed, E: min(m.ranks.E), D: min(m.ranks.D), C: min(m.ranks.C), B: min(m.ranks.B), ch1: min(m.chapterOneAt), fin: min(m.finishedAt), village: Object.fromEntries(Object.entries(m.village).map(([k, v]) => [k, min(v)])),
    members: state.members.length, fail: m.failures, runs: m.boardRuns, minGold: Math.round(m.minGold), bankrupt: m.bankruptDays, gold: m.final.gold, chests: m.chests || 0, ms: Date.now() - t0 }));
}
