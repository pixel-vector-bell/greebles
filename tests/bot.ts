/**
 * A pretend player for pace tests. It opens the game 6 times a day (every 3 hours from 8 am to 11 pm),
 * plays for 15 minutes each time, and leaves the game closed the rest of the time (overnight too).
 * It catches everything, keeps its best Greebles on the team, sends extra copies home for candy,
 * evolves when it can, buys upgrades, fights bosses it should beat, and moves on to new areas.
 */
import { vi } from 'vitest';
import { World, newGame, type Greeble } from '../src/sim/world';
import { ITEMS, REGIONS, ROBOTS, UPGRADES, evoCandy, familyRoot, morph, type ItemId, type SnareId, type UpgradeId } from '../src/sim/content';

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
export interface PaceLog {
  firstEvolve?: number; firstStage3?: number; boss: Record<string, number>; allUpgrades?: number;
  /** [day, best level, caught, scrap, upgrades bought] each night */
  nightly: [number, number, number, number, number][];
}

export function runBot(days: number, seed = 11, opts: { sessions?: number[]; sessionMin?: number } = {}): { w: World; log: PaceLog } {
  const T0 = Date.UTC(2027, 0, 4, 8, 0, 0);   // a Monday, 8 am
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  const w = new World(newGame(seed, T0));
  const log: PaceLog = { boss: {}, nightly: [] };
  const sessions = opts.sessions ?? [8, 11, 14, 17, 20, 23];
  const sessionMin = opts.sessionMin ?? 15;
  let t = T0;
  const day = () => (t - T0) / DAY;
  const at = (ms: number) => { t = ms; vi.setSystemTime(t); };

  const upgradesBought = () => UPGRADES.reduce((n, u) => n + w.up(u.id), 0);
  const upgradesMax = UPGRADES.reduce((n, u) => n + u.prices.length, 0) - 0;
  const note = () => {
    for (const r of REGIONS) if (w.s.bossBeaten[r.id] && log.boss[r.id] === undefined) log.boss[r.id] = day();
    if (log.firstEvolve === undefined && w.s.stats.evolved > 0) log.firstEvolve = day();
    if (log.firstStage3 === undefined && w.s.bag.some(g => morph(g.sp).stage === 3)) log.firstStage3 = day();
    if (log.allUpgrades === undefined && UPGRADES.every(u => w.upgradePrice(u.id) === null || (u.id === 'tent' && w.s.camp.length >= 8))) log.allUpgrades = day();
  };

  const snareFor = (sp: string): SnareId => {
    const r = morph(sp).rarity;
    const pref: SnareId[] = r === 'legendary' || r === 'mythic' || r === 'epic' ? ['star', 'great', 'good', 'snare'] : r === 'rare' ? ['great', 'good', 'snare'] : r === 'uncommon' ? ['good', 'snare'] : ['snare', 'good'];
    return pref.find(k => w.count(k) > 0) ?? 'snare';
  };
  /** A player saving up candy goes back to an area where that family lives. */
  const farmArea = () => {
    const want = [...w.s.bag].filter(g => morph(g.sp).stage === 2 && (morph(g.sp).evo ?? []).some(e => e.lv - g.lv <= 8) && w.candyOf(g.sp) < evoCandy(morph(g.sp)))
      .sort((a, b) => b.lv - a.lv)[0];
    const root = want && familyRoot(want.sp);
    const reg = root && [...REGIONS].reverse().find(r => w.isOpen(r.id) && r.kinds.includes(root));
    return reg ? reg.id : w.unlockedTop();
  };
  const catchAll = () => {
    for (const x of [...w.here]) {
      if (w.s.bag.length >= w.s.bagMax) tidy(true);
      if (w.s.bag.length >= w.s.bagMax) return;
      if (!w.startEncounter(x.id).ok) continue;
      for (let k = 0; k < 8 && w.s.enc; k++) {
        if (w.count(snareFor(x.sp)) < 1) { if (w.s.scrap >= 100) w.buy('snare', 10); else break; }
        w.throwSnare(snareFor(x.sp), 2);   // a "Great" throw most of the time
      }
      w.leaveEncounter();
    }
    w.drain();
  };
  /** Keep the best 2 of each kind; send the rest home (for candy). */
  const tidy = (hard = false) => {
    const by = new Map<string, Greeble[]>();
    for (const g of w.s.bag) { const a = by.get(g.sp) ?? []; a.push(g); by.set(g.sp, a); }
    for (const list of by.values()) {
      list.sort((a, b) => Number(b.prism) - Number(a.prism) || b.stars - a.stars || b.lv - a.lv);
      for (const g of list.slice(hard ? 1 : 2)) if (!w.busy(g.u) && !g.prism) w.sell(g.u);
    }
  };
  const evolveAll = () => {
    for (const g of [...w.s.bag].sort((a, b) => w.power(b) - w.power(a))) {
      for (const o of w.evoOptions(g, t)) {
        if (o.ready) { w.evolve(g.u, o.evo.to, t); break; }
        if (o.evo.item && o.why.startsWith('Needs a ') && w.s.scrap >= (ITEMS[o.evo.item as ItemId].price ?? 1e9) + 300) { w.buy(o.evo.item, 1); w.evolve(g.u, o.evo.to, t); break; }
      }
    }
  };
  const arrange = () => {
    const pool = [...w.s.bag].filter(g => !w.inNest(g.u) && w.s.expo?.u !== g.u && !w.fighting(g.u));
    // a sensible player picks the team for the boss it's working toward (element matters)
    const bossEl = REGIONS[w.s.unlocked - 1].boss.el;
    const score = (g: Greeble) => w.hitOn(g, bossEl) * 3 + w.fighterHp(g) - w.hitBy(g, REGIONS[w.s.unlocked - 1].boss.atk, bossEl) * 20;
    // …and gives xp to a Greeble that has the candy to evolve once it levels up
    const nearEvo = (g: Greeble) => (morph(g.sp).evo ?? []).some(e => w.candyOf(g.sp) >= evoCandy(morph(g.sp)) * 0.6 && g.lv < e.lv && e.lv <= w.levelCap);
    const ranked = pool.sort((a, b) => score(b) - score(a));
    // a player who wants a stage 3 trains one stage-2 Greeble of a 3-stage family on the team
    const s2 = ranked.filter(g => morph(g.sp).stage === 2 && (morph(g.sp).evo ?? []).length).sort((a, b) => b.lv - a.lv)[0];
    const trainee = s2 ?? ranked.find(g => nearEvo(g) && !ranked.slice(0, w.teamMax - 1).includes(g));
    let best = (trainee ? [...ranked.slice(0, w.teamMax - 1), trainee] : ranked.slice(0, w.teamMax)).map(g => g.u);
    // sticky: keep a current member unless the newcomer is clearly (25%) better
    const cur = w.teamList.map(g => g.u);
    if (cur.length >= w.teamMax) {
      const sc = (u: string) => score(w.get(u)!);
      const out = cur.filter(u => !best.includes(u)), inn = best.filter(u => !cur.includes(u) && u !== trainee?.u);
      best = cur.slice();
      for (const u of inn.sort((a, b) => sc(b) - sc(a))) {
        const worst = best.filter(x => out.includes(x)).sort((a, b) => sc(a) - sc(b))[0];
        if (worst && sc(u) > sc(worst) * 1.25 + 5) { best[best.indexOf(worst)] = u; out.splice(out.indexOf(worst), 1); }
      }
      if (trainee && !best.includes(trainee.u) && !best.some(u => nearEvo(w.get(u)!))) best[best.length - 1] = trainee.u;
    }
    for (const u of [...w.s.team]) if (u && !best.includes(u) && !w.fighting(u)) w.offTeam(u);
    for (const u of best) w.toTeam(u);
    const workers = [...w.s.bag].filter(g => !w.busy(g.u)).sort((a, b) => w.yieldOf(b) - w.yieldOf(a));
    for (let i = 0; i < w.s.camp.length; i++) {
      const cur = w.s.camp[i] ? w.get(w.s.camp[i]!) : undefined;
      const nx = workers[0];
      if (!nx) break;
      if (!cur || w.yieldOf(nx) > w.yieldOf(cur)) { workers.shift(); w.assign(nx.u, i); }
    }
  };
  const PRIORITY: UpgradeId[] = ['squad', 'bedroll', 'tent', 'bench', 'press', 'away', 'bag'];
  const shop = () => {
    for (let guard = 0; guard < 20; guard++) {
      const opts = PRIORITY.map(id => ({ id, p: w.upgradePrice(id) })).filter(o => o.p !== null && !(o.id === 'tent' && w.s.camp.length >= 8)) as { id: UpgradeId; p: number }[];
      if (!opts.length) return;
      const cheap = opts.sort((a, b) => a.p - b.p)[0];
      if (w.s.scrap - cheap.p < 200) return;
      w.buyUpgrade(cheap.id);
    }
  };
  const tryBoss = () => {
    const top = w.unlockedTop();
    if (w.s.region !== top) w.travel(top);
    if (t < w.bossReadyAt(w.s.region) || w.s.fight) return;
    const team = w.readyTeam(3).map(g => g.u);
    if (!team.length) return;
    if (w.winOdds(team, 'boss', 'boss') < 0.55) return;
    w.startFight(team, 'boss', 'boss');
    for (let k = 0; k < 600 && w.s.fight; k++) w.advance(1000, t);
  };
  const daily = () => { const d = w.ensureDaily(t); d.tasks.forEach((_, i) => w.claimTask(i, t)); };
  const expo = () => {
    if (!w.expoReady(t)) return;
    const g = [...w.s.bag].filter(x => !w.busy(x.u)).sort((a, b) => b.lv - a.lv)[0];
    if (g) w.sendExpedition(g.u, t);
  };

  for (let d = 0; d < days; d++) {
    for (const h of sessions) {
      const open = T0 + d * DAY + (h - 8) * HOUR;
      if (open > t) { const gone = open - t; at(open); w.catchUp(gone, t); w.drain(); }
      for (let m = 0; m < sessionMin; m += 5) {
        tryBoss(); if (!w.s.fight) w.travel(m % 10 === 0 ? farmArea() : w.unlockedTop());
        w.updateWilds(t); catchAll(); tidy(); evolveAll(); arrange(); daily(); expo(); shop();
        w.advance(5 * MIN, t); at(t + 5 * MIN); w.updateWilds(t); w.drain();
        note();
      }
    }
    log.nightly.push([d + 1, Math.max(0, ...w.s.bag.map(g => g.lv)), w.s.stats.caught, Math.round(w.s.scrap), upgradesBought()]);
  }
  vi.useRealTimers();
  void ROBOTS; void upgradesMax;
  return { w, log };
}
