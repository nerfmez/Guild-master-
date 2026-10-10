/* The guild's trade: adventurers sell monster parts and treasures at the guild counter, the guild stores them,
   makes goods in the village workshops and sells to the town, by caravan to the capital, or to collectors.
   Pure logic; game.js passes a context of its own helpers. */
import { PARTS, GOODS, TREASURES, BUY_RATES, TRADE_RULES as R } from './content.js';

export function createTrade() {
  return { buyRate: 'fair', autoWholesale: true, store: {}, goods: {}, treasures: [], displayed: [], work: {}, halt: {}, demand: {},
    caravan: null, contract: null, stats: { bought: 0, spent: 0, earned: 0, made: 0, trips: 0 }, recent: [] };
}
const sum = obj => Object.values(obj).reduce((s, n) => s + n, 0);
export const storeCapacity = state => R.storeBase + (state.upgrades?.storehouse || 0) * R.storePerLevel;
export const storeUsed = t => sum(t.store) + Object.values(t.goods).reduce((s, g) => s + g.count, 0);
export const goodValue = g => g && g.count ? g.value / g.count : 0;
export const itemValue = (t, id) => PARTS[id] ? PARTS[id].value : goodValue(t.goods[id]);
/** What the town's merchants pay now: a little less for each unit they already took recently. */
export function wholesalePrice(t, id) {
  const factor = Math.max(R.wholesaleFloor, R.wholesale * (1 - (t.demand[id] || 0) / 80));
  return Math.max(1, Math.round(itemValue(t, id) * factor));
}
export const caravanCapacity = state => R.caravanCapacity + Math.max(0, (state.village?.caravan || 1) - 1) * R.caravanPerLevel;
const remember = (t, text) => { t.recent.unshift(text); if (t.recent.length > 8) t.recent.length = 8; };

/** An adventurer home from the hunt sells parts and treasures to the guild counter. */
export function sellLoot(state, ctx, hunter, who) {
  const t = state.trade, bag = hunter.bag, rate = BUY_RATES[t.buyRate]?.rate || BUY_RATES.fair.rate;
  const free = hunter.kind === 'free', willing = !free || t.buyRate !== 'low' || (who.affinity || 0) >= 50;
  let budget = state.gold - R.reserve, paid = 0, sold = 0, elsewhere = 0, found = [];
  const items = [...Object.entries(bag.parts || {}).flatMap(([id, n]) => Array(n).fill({ part: id })), ...(bag.treasures || []).map(id => ({ treasure: id }))];
  for (const item of items) {
    const value = item.part ? PARTS[item.part]?.value : TREASURES[item.treasure]?.value;
    if (!value) continue;
    const price = Math.round(value * rate), room = item.part ? storeUsed(t) < storeCapacity(state) : t.treasures.length < 12;
    if (willing && room && budget >= price) {
      budget -= price; paid += price; sold += 1;
      if (item.part) t.store[item.part] = (t.store[item.part] || 0) + 1;
      else { t.treasures.push({ id: item.treasure, from: who.name }); found.push(TREASURES[item.treasure].name); }
    } else elsewhere += Math.round(value * 0.6);
  }
  bag.parts = {}; bag.treasures = [];
  who.purse = (who.purse || 0) + paid + elsewhere;
  if (paid) { ctx.expense(paid, 'รับซื้อของจากนักผจญภัย'); t.stats.bought += sold; t.stats.spent += paid; remember(t, `${who.name} ขายของ ${sold} ชิ้น · ${paid} G`); }
  if (free && sold) who.affinity = Math.min(100, (who.affinity || 0) + (t.buyRate === 'generous' ? 3 : 1));
  for (const name of found) ctx.log(`💰 ${who.name}เจอ${name}ระหว่างล่า และนำมาขายให้กิลด์!`, 'success');
  return { sold, paid };
}

/** Workshops turn three parts of their kind into one good; the store sells its surplus when nearly full. */
export function tickTrade(state, ctx, step) {
  const t = state.trade;
  for (const [goodId, good] of Object.entries(GOODS)) {
    const level = state.village?.[good.workshop] || 0;
    if (!level) continue;
    const job = t.work[good.workshop] ??= { busy: false, progress: 0, value: 0 };
    if (!job.busy) {
      if (t.halt[good.workshop]) continue;
      const stock = Object.entries(t.store).filter(([id, n]) => PARTS[id]?.kind === good.kind && n > 0).sort((a, b) => b[1] - a[1]);
      if (stock.reduce((s, [, n]) => s + n, 0) < R.recipe) continue;
      let need = R.recipe, value = 0;
      for (const [id] of stock) while (need > 0 && t.store[id] > 0) { t.store[id] -= 1; if (!t.store[id]) delete t.store[id]; value += PARTS[id].value; need -= 1; }
      Object.assign(job, { busy: true, progress: 0, value: Math.round(value * R.goodsValue) });
    }
    job.progress += step * (1 + (level - 1) * 0.5);
    if (job.progress >= R.workTime) {
      const g = t.goods[goodId] ??= { count: 0, value: 0 };
      g.count += 1; g.value += job.value; t.stats.made += 1;
      Object.assign(job, { busy: false, progress: 0, value: 0 });
    }
  }
  if (t.autoWholesale && storeUsed(t) >= storeCapacity(state) * 0.9) {
    while (storeUsed(t) > storeCapacity(state) * 0.75) {
      const [id] = Object.entries(t.store).sort((a, b) => b[1] - a[1])[0] || [];
      if (!id) break;
      wholesale(state, ctx, { id, count: Math.min(5, t.store[id]) }, true);
    }
  }
  if (t.caravan) {
    t.caravan.left -= step;
    if (t.caravan.left <= 0) caravanHome(state, ctx);
  }
  if (!t.contract && (state.village?.caravan || 0) > 0) t.contract = newContract(state, ctx);
}

/** Sell parts or goods to the town's merchants right now. */
export function wholesale(state, ctx, payload, auto = false) {
  const t = state.trade, id = payload.id, isGood = Boolean(GOODS[id]);
  const have = isGood ? t.goods[id]?.count || 0 : t.store[id] || 0;
  if (!have) return { ok: false, message: 'ไม่มีของชิ้นนี้ในโกดัง' };
  const count = Math.max(1, Math.min(have, payload.count === 'all' ? have : Math.floor(Number(payload.count) || 1)));
  let gold = 0;
  for (let i = 0; i < count; i++) { gold += wholesalePrice(t, id); t.demand[id] = (t.demand[id] || 0) + 1; }
  if (isGood) { const g = t.goods[id], avg = goodValue(g); g.count -= count; g.value = Math.max(0, g.value - avg * count); if (!g.count) delete t.goods[id]; }
  else { t.store[id] -= count; if (!t.store[id]) delete t.store[id]; }
  const name = (PARTS[id] || GOODS[id]).name;
  ctx.income(gold, 'ขายส่งให้ร้านในเมือง'); t.stats.earned += gold;
  remember(t, `${auto ? 'โกดังใกล้เต็ม ขาย' : 'ขาย'}${name} ${count} ชิ้น · +${gold} G`);
  if (auto) ctx.log(`📦 โกดังใกล้เต็ม ขาย${name} ${count} ชิ้นให้ร้านในเมือง (+${gold} G)`, 'info');
  return { ok: true, message: `ขาย${name} ${count} ชิ้น ได้ ${gold} G` };
}

/** Once a day the townsfolk buy goods from the guild's workshops, collectors pay to see the display, and prices recover. */
export function dailyTrade(state, ctx) {
  const t = state.trade, want = R.townDemand + ctx.villageLevel() * R.townDemandPerLevel;
  let gold = 0, sold = 0;
  for (const [id, g] of Object.entries(t.goods)) {
    const n = Math.min(g.count, want);
    if (!n) continue;
    const avg = goodValue(g);
    gold += Math.round(avg * n); sold += n; g.count -= n; g.value = Math.max(0, g.value - avg * n);
    if (!g.count) delete t.goods[id];
  }
  if (gold) { ctx.income(gold, 'ขายสินค้าให้ชาวเมือง'); ctx.prosperity(gold * 0.05); t.stats.earned += gold; remember(t, `ชาวเมืองซื้อสินค้า ${sold} ชิ้น · +${gold} G`); }
  const tips = Math.round(t.displayed.reduce((s, d) => s + (TREASURES[d.id]?.value || 0), 0) * R.displayTip);
  if (tips) { ctx.income(tips, 'ค่าเข้าชมห้องจัดแสดง'); t.stats.earned += tips; }
  for (const id of Object.keys(t.demand)) { t.demand[id] *= 1 - R.demandRecover; if (t.demand[id] < 0.5) delete t.demand[id]; }
}

// ---- Caravans to the capital ----
function newContract(state, ctx) {
  const goods = Object.keys(GOODS).filter(id => state.village?.[GOODS[id].workshop] > 0);
  const parts = ctx.openParts();
  const useGood = goods.length && ctx.random() < 0.6, list = useGood ? goods : parts;
  if (!list.length) return null;
  const id = list[Math.floor(ctx.random() * list.length) % list.length];
  return { id, count: useGood ? 3 + Math.floor(ctx.random() * 4) : 8 + Math.floor(ctx.random() * 10) };
}
/** What would go on the wagon now: the contract first, then the most valuable goods and parts. */
export function caravanLoad(state) {
  const t = state.trade, cap = caravanCapacity(state), load = [];
  let room = cap;
  const take = (id, max) => { const have = GOODS[id] ? t.goods[id]?.count || 0 : t.store[id] || 0, n = Math.min(have, max, room); if (n > 0) { load.push({ id, n }); room -= n; } };
  if (t.contract) take(t.contract.id, t.contract.count);
  const rest = [...Object.keys(t.goods), ...Object.keys(t.store)].filter(id => !load.some(l => l.id === id)).sort((a, b) => itemValue(t, b) - itemValue(t, a));
  for (const id of rest) take(id, Infinity);
  const value = Math.round(load.reduce((s, l) => s + itemValue(t, l.id) * l.n, 0));
  const met = Boolean(t.contract) && load.some(l => l.id === t.contract.id && l.n >= t.contract.count);
  return { load, value, met, cap, count: cap - room, expect: Math.round(value * R.caravanMarkup + (met ? itemValue(t, t.contract.id) * t.contract.count * R.contractBonus : 0)) };
}
export function sendCaravan(state, ctx, payload) {
  const t = state.trade;
  if (!(state.village?.caravan > 0)) return { ok: false, message: 'ต้องสร้างลานคาราวานในหมู่บ้านก่อน' };
  if (t.caravan) return { ok: false, message: 'คาราวานยังเดินทางอยู่' };
  const plan = caravanLoad(state);
  if (!plan.load.length) return { ok: false, message: 'โกดังว่าง ยังไม่มีของให้ขนไป' };
  const escort = Boolean(payload.escort);
  if (escort && state.gold < R.escortCost) return { ok: false, message: `ค่าจ้างผู้คุ้มกัน ${R.escortCost} G ไม่พอ` };
  if (escort) ctx.expense(R.escortCost, 'จ้างผู้คุ้มกันคาราวาน');
  const bonus = plan.met ? Math.round(itemValue(t, t.contract.id) * t.contract.count * R.contractBonus) : 0;
  for (const { id, n } of plan.load) {
    if (GOODS[id]) { const g = t.goods[id], avg = goodValue(g); g.count -= n; g.value = Math.max(0, g.value - avg * n); if (!g.count) delete t.goods[id]; }
    else { t.store[id] -= n; if (!t.store[id]) delete t.store[id]; }
  }
  t.caravan = { left: R.caravanTime, total: R.caravanTime, value: plan.value, bonus, escort, count: plan.count };
  ctx.log(`🐎 คาราวานออกเดินทางไปเมืองหลวง ขนของ ${plan.count} ชิ้น${plan.met ? ' ครบตามใบสั่งซื้อ' : ''}`, 'info');
  return { ok: true, message: `คาราวานออกเดินทางแล้ว คาดว่าได้ราว ${plan.expect} G` };
}
function caravanHome(state, ctx) {
  const t = state.trade, c = t.caravan;
  let gold = Math.round(c.value * R.caravanMarkup) + c.bonus, note = '';
  if (!c.escort && ctx.random() < R.caravanRisk) { gold = Math.round(gold * (1 - R.caravanLoss)); note = ' แต่ถูกโจรดักปล้นกลางทาง เสียของไปบางส่วน'; }
  ctx.income(gold, 'คาราวานกลับจากเมืองหลวง'); t.stats.earned += gold; t.stats.trips += 1;
  ctx.log(`🐎 คาราวานกลับถึงบ้าน ขายของได้ ${gold} G${c.bonus ? ` (รวมโบนัสใบสั่งซื้อ ${c.bonus} G)` : ''}${note}`, note ? 'warning' : 'success');
  remember(t, `คาราวานกลับมา · +${gold} G`);
  t.caravan = null; t.contract = null;
}

// ---- Treasures: sell to a collector, or keep in the guild's display for renown and visitors. ----
export function treasureAction(state, ctx, payload, display) {
  const t = state.trade, i = Number(payload.index), item = Number.isInteger(i) ? t.treasures[i] : null, def = item && TREASURES[item.id];
  if (!def) return { ok: false, message: 'ไม่พบสมบัติชิ้นนี้' };
  if (display) {
    if (t.displayed.length >= R.displaySlots) return { ok: false, message: 'ตู้จัดแสดงเต็มแล้ว' };
    t.treasures.splice(i, 1); t.displayed.push(item); ctx.rep(def.rep);
    ctx.log(`🏛 นำ${def.name}ขึ้นตู้จัดแสดงในกิลด์ ชาวบ้านแวะมาชม (ชื่อเสียง +${def.rep})`, 'success');
    return { ok: true, message: `จัดแสดง${def.name}แล้ว` };
  }
  t.treasures.splice(i, 1); ctx.income(def.value, 'ขายสมบัติให้นักสะสม'); t.stats.earned += def.value;
  remember(t, `ขาย${def.name} · +${def.value} G`);
  return { ok: true, message: `ขาย${def.name}ได้ ${def.value} G` };
}

/** Rebuild trade state from a save, keeping only known items and sane numbers. */
export function sanitizeTrade(data) {
  const t = createTrade();
  if (!data || typeof data !== 'object') return t;
  const count = n => Number.isInteger(n) && n > 0 && n < 100000;
  const num = (n, max) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
  if (BUY_RATES[data.buyRate]) t.buyRate = data.buyRate;
  t.autoWholesale = data.autoWholesale !== false;
  for (const [id, n] of Object.entries(data.store || {})) if (PARTS[id] && count(n)) t.store[id] = n;
  for (const [id, g] of Object.entries(data.goods || {})) if (GOODS[id] && g && count(g.count) && num(g.value, 1e8)) t.goods[id] = { count: g.count, value: g.value };
  const treasure = x => x && TREASURES[x.id] ? { id: x.id, from: typeof x.from === 'string' ? x.from.slice(0, 20) : '' } : null;
  t.treasures = (Array.isArray(data.treasures) ? data.treasures : []).map(treasure).filter(Boolean).slice(0, 12);
  t.displayed = (Array.isArray(data.displayed) ? data.displayed : []).map(treasure).filter(Boolean).slice(0, R.displaySlots);
  for (const good of Object.values(GOODS)) { const j = data.work?.[good.workshop]; if (j && typeof j === 'object' && num(j.progress, 1e4) && num(j.value, 1e7)) t.work[good.workshop] = { busy: Boolean(j.busy), progress: j.progress, value: j.value }; if (data.halt?.[good.workshop]) t.halt[good.workshop] = true; }
  for (const [id, n] of Object.entries(data.demand || {})) if ((PARTS[id] || GOODS[id]) && num(n, 1e5)) t.demand[id] = n;
  const c = data.caravan;
  if (c && num(c.left, 1e5) && num(c.total, 1e5) && num(c.value, 1e8) && num(c.bonus, 1e8) && num(c.count, 1e5)) t.caravan = { left: c.left, total: c.total, value: c.value, bonus: c.bonus, escort: Boolean(c.escort), count: c.count };
  if (data.contract && (PARTS[data.contract.id] || GOODS[data.contract.id]) && count(data.contract.count)) t.contract = { id: data.contract.id, count: Math.min(data.contract.count, 100) };
  for (const k of Object.keys(t.stats)) if (num(data.stats?.[k], 1e10)) t.stats[k] = data.stats[k];
  t.recent = (Array.isArray(data.recent) ? data.recent : []).filter(x => typeof x === 'string' && x.length <= 120).slice(0, 8);
  return t;
}
