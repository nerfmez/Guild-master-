/** A plain, reasonable player for balance checks: answers petitions, lets the board run,
 * sends the important steps itself, and invests only what the guild has earned. */
import { createGame, tick, act, getGuildStats, getMemberStats, getAvailableQuests, previewMission, suggestTeam, getVillageInfo, getProjectStatus, getGuildUpgradeCost, getAvailableRecruits, getUpgradeCost, getRankProgress, classChoices, getAdventurerRank } from '../src/game.js';
import { RANKS, GUILD_UPGRADES, GOODS, PARTS, HOME_NEEDS } from '../src/content.js';
import { storeUsed, storeCapacity, caravanLoad } from '../src/trade.js';
import { homeStatus } from '../src/town.js';

const STEP = 5;
const lastTry = new WeakMap();
function placeSomewhere(state, type) {
  // Scanning the whole floor is slow: after a failed search, wait two minutes before looking again.
  const tries = lastTry.get(state) || {}; lastTry.set(state, tries);
  if (state.elapsed - (tries[type] ?? -1e9) < 120) return false;
  tries[type] = state.elapsed;
  for (let y = 4.5; y < 16; y += 0.25) for (let x = 5.25; x < 18; x += 0.25) if (act(state, 'build', { type, x, y }).ok) return true;
  return false;
}
const canPay = (state, cost, reserve = 0) => Object.entries(cost || {}).every(([k, v]) => state[k] - (k === 'gold' ? reserve : 0) >= v);

export function simulate(seed = 1, { maxSeconds = 4 * 3600, plan = "standard", log = false, maxMembers = 8, freePlay = 0 } = {}) {
  const state = createGame(seed);
  const m = { seed, ranks: {}, village: {}, finishedAt: null, boardRuns: 0, playerRuns: 0, failures: 0, minGold: state.gold, goldSamples: [], petitionsSeen: 0, petitionsLost: 0, upgrades: 0, projects: 0 };
  const seen = new Set();
  let lastMissions = new Set();
  const say = text => { if (log) console.log(`[${Math.round(state.elapsed)}s day ${state.day}] ${text}`); };
  m.ledger = {};
  let top = state.ledger[0];
  const book = () => { for (const entry of state.ledger) { if (entry === top) break; const key = entry.text.replace(/[:：].*$/, '').replace(/^(สร้าง|อัปเกรด|รับ|เปลี่ยนอาชีพ|ซื้อ|ขาย|หมู่บ้าน|พัฒนา).*$/, '$1').slice(0, 24); m.ledger[key] = (m.ledger[key] || 0) + entry.gold; } top = state.ledger[0]; };
  while (state.elapsed < maxSeconds) {
    tick(state, STEP);
    book();
    for (const p of state.petitions) if (!seen.has(p.id) && !p.important) { seen.add(p.id); m.petitionsSeen++; }
    // Count runs as they finish.
    for (const mission of state.missions) if (mission.status !== 'active' && !lastMissions.has(mission.id)) {
      lastMissions.add(mission.id);
      if (mission.status === 'completed') mission.auto ? m.boardRuns++ : m.playerRuns++; else m.failures++;
    }
    m.minGold = Math.min(m.minGold, state.gold);
    m.bankruptDays = Math.max(m.bankruptDays || 0, state.bankruptcyDays);
    book();
    if (state.elapsed % 600 < STEP) m.goldSamples.push(Math.round(state.gold));
    if (log && state.elapsed % 300 < STEP) { const p = getRankProgress(state); if (p) say(`toward ${p.rank}: rep ${p.rep}/${p.repNeeded} ${p.merits.filter(x => !x.ok).map(x => x.label + ' ' + x.have + '/' + x.need).join(', ')} members ${state.members.length} gold ${Math.round(state.gold)}`); }
    const rank = state.rank; if (!(rank in m.ranks)) { m.ranks[rank] = Math.round(state.elapsed); say(`rank ${rank}`); }
    const vl = getVillageInfo(state).level; if (!(vl in m.village)) { m.village[vl] = Math.round(state.elapsed); say(`village ${vl}`); }
    if (state.story.finished && m.finishedAt === null) { m.finishedAt = Math.round(state.elapsed); say('story finished'); }
    if (m.finishedAt !== null && state.elapsed >= m.finishedAt + freePlay) break;

    // 1. Answer petitions at the desk.
    for (const p of state.petitions.filter(p => p.status === 'waiting')) act(state, 'acceptPetition', { petitionId: p.id, plan });
    // 2. Guild essentials, in order of need.
    const stats = getGuildStats(state), reserve = 150;
    if (!state.facilities.some(f => f.type === 'board') && state.gold >= 120 + reserve) placeSomewhere(state, 'board');
    if (RANKS.indexOf(state.rank) >= 1 && !state.facilities.some(f => f.type === 'dispatch') && state.gold > 340 + reserve) placeSomewhere(state, 'dispatch') || act(state, 'expandBuilding');
    if (stats.memberCount >= stats.memberCap && state.members.length < maxMembers && stats.memberCap < 12 && state.gold > 400 + reserve) placeSomewhere(state, 'dorm') || act(state, 'expandBuilding');
    // Applicants come to the door; hire while there is room, the fee is affordable and the guild needs hands.
    for (const a of state.applicants.filter(a => a.status === 'waiting')) {
      if (state.members.length < maxMembers && getGuildStats(state).memberCount < getGuildStats(state).memberCap && state.gold > a.fee + reserve) { act(state, 'recruit', { applicantId: a.id }); say(`hire ${a.memberId || a.bio.name} lv${a.level}`); }
      else if (state.members.length >= maxMembers) act(state, 'declineApplicant', { applicantId: a.id });
    }
    // Surplus materials go to the village market, which keeps the shops stocked.
    for (const key of ['wood', 'stone', 'herb']) if (state[key] > 80 && state.market[key] < 60) act(state, 'sellMaterial', { key });
    if (RANKS.indexOf(state.rank) >= 3 && state.landLevel < 1) act(state, 'expand');
    // The arena lets members rank up; the dojo teaches and holds class trials.
    if (!state.village.arena && getProjectStatus(state, 'arena').ok && state.gold > getProjectStatus(state, 'arena').cost.gold + reserve) { act(state, 'buildProject', { projectId: 'arena' }); say('build arena'); }
    if (RANKS.indexOf(state.rank) >= 1 && !state.village.dojo && getProjectStatus(state, 'dojo').ok && state.gold > getProjectStatus(state, 'dojo').cost.gold + reserve) { act(state, 'buildProject', { projectId: 'dojo' }); say('build dojo'); }
    // Like a player answering the goal card: sponsor exams for members who are ready but short of the fee.
    for (const member of state.members) { const r = getAdventurerRank(state, member); if (r.eligible && r.chance >= 0.4 && !member.errand && member.purse < r.rule.fee && state.gold > r.rule.fee + reserve) act(state, 'rankExam', { memberId: member.id }); }
    for (const member of state.members) { const choice = classChoices(state, member).find(c => c.ok); if (choice && act(state, 'specialize', { memberId: member.id, classId: choice.id }).ok) say(`class ${member.id} -> ${choice.id}`); }
    if (state.facilities.filter(f => f.level >= 2).length < 2 && RANKS.indexOf(state.rank) >= 3) for (const f of state.facilities.filter(f => ['dorm', 'training', 'reception'].includes(f.type))) if (canPay(state, getUpgradeCost(state, f.id), reserve)) { act(state, 'upgrade', { facilityId: f.id }); break; }
    act(state, 'autoEquip');
    // The goal card asks for a new kind of work: the player sends a team to something the guild has never done.
    const progress = getRankProgress(state);
    if (progress?.merits?.some(x => x.kind === 'quests' && !x.ok) && !state.missions.some(x => x.status === 'active' && !x.auto)) {
      const fresh = getAvailableQuests(state).find(q => !q.locked && !state.completedQuests[q.id] && !q.story && !q.final);
      if (fresh) { const team = suggestTeam(state, fresh.id, 'cautious'), pv = previewMission(state, fresh.id, team, 'cautious'); if (pv.ok && pv.readiness >= 1) act(state, 'sendMission', { questId: fresh.id, memberIds: team, policy: 'cautious' }); }
    }
    // 3. The player's own teams take the important steps.
    for (const p of state.petitions.filter(p => p.important && !p.missionId)) {
      const q = getAvailableQuests(state).find(q => q.id === p.questId);
      if (!q || q.locked) continue;
      const team = suggestTeam(state, q.id, 'cautious'), preview = previewMission(state, q.id, team, 'cautious');
      if (preview.ok && preview.readiness >= 1) { act(state, 'sendMission', { questId: q.id, memberIds: team, policy: 'cautious', petitionId: p.id }); say(`send ${q.id} ${team.join(',')}`); }
    }
    // Members who wait at home train when they can.
    // Before the board, idle members train; afterwards board work and the dojo grow them, so nobody is kept off the board.
    const hasBoard = state.facilities.some(f => f.type === 'board');
    for (const member of state.members) {
      if (hasBoard && member.task === 'train') act(state, 'setTask', { memberId: member.id, task: 'rest' });
      else if (!hasBoard && !getMemberStats(state, member).busy && member.task === 'rest' && member.energy > 95 && state.elapsed % 120 < STEP) act(state, 'setTask', { memberId: member.id, task: 'train' });
    }
    // Trade: parts no workshop wants go to the town's merchants; a caravan leaves when the wagon would be well filled.
    const t = state.trade, used = storeUsed(t);
    if (used > storeCapacity(state) * 0.5) for (const id of Object.keys(t.store)) if (!(state.village[GOODS[Object.keys(GOODS).find(g => GOODS[g].kind === PARTS[id].kind)].workshop] > 0)) act(state, 'wholesale', { id, count: 'all' });
    if (state.village.caravan && !t.caravan && caravanLoad(state).count >= 15) { act(state, 'sendCaravan', { escort: state.gold > 1500 }); m.caravans = (m.caravans || 0) + 1; }
    for (const [i, x] of t.treasures.entries()) { act(state, t.displayed.length < 3 ? 'displayTreasure' : 'sellTreasure', { index: i }); break; }
    // 4. Spend surplus: village first, then idle upgrades, cheapest first.
    const options = [...['house', 'shop', 'market', 'smithy', 'tannery', 'apothecary', 'jeweler', 'caravan'].map(id => ({ kind: 'project', id, status: getProjectStatus(state, id) })).filter(o => o.status.ok).map(o => ({ ...o, cost: o.status.cost })),
      ...Object.keys(GUILD_UPGRADES).filter(id => state.upgrades[id] < GUILD_UPGRADES[id].max).map(id => ({ kind: 'upgrade', id, cost: getGuildUpgradeCost(state, id) }))].sort((a, b) => a.cost.gold - b.cost.gold);
    // Homes tell the player what they lack: build what the first unmet need asks for, and houses when people are short.
    const vi = getVillageInfo(state), wants = new Set();
    for (let i = 0; i < state.village.houses; i++) for (const need of homeStatus(state, 'h' + i, vi.level).missing || []) for (const id of HOME_NEEDS[need].from || []) wants.add(id);
    if (vi.next && vi.population < vi.next.population) wants.add('house');
    // A wanted building short of wood or stone: buy the materials at the market first.
    for (const id of wants) {
      const st = getProjectStatus(state, id);
      if (st.ok || !st.cost || st.level >= st.max || state.gold < (st.cost.gold || 0) + 500) continue;
      for (const key of ['wood', 'stone']) if ((st.cost[key] || 0) > state[key]) act(state, 'buyMaterial', { key });
      break;
    }
    const wanted = options.find(o => o.kind === 'project' && wants.has(o.id));
    const option = wanted && canPay(state, wanted.cost, 300) ? wanted : options[0];
    if (option && canPay(state, option.cost, option === wanted ? 300 : 600)) {
      if (option.kind === 'project' ? act(state, 'buildProject', { projectId: option.id }).ok : act(state, 'buyUpgrade', { upgradeId: option.id }).ok) { option.kind === 'project' ? m.projects++ : m.upgrades++; say(`buy ${option.id}`); }
    }
  }
  m.lostPetitions = m.petitionsSeen - state.petitions.length;
  m.trade = state.village.trade || 0;
  m.final = { elapsed: Math.round(state.elapsed), day: state.day, rank: state.rank, gold: Math.round(state.gold), village: getVillageInfo(state).level, houses: state.village.houses, upgrades: { ...state.upgrades }, members: state.members.length };
  return { state, metrics: m };
}
