import { describe, expect, it } from 'vitest';
import { World, newGame, migrate } from '../src/sim/world';
import { SHIP_PARTS, PERKS, DAY_MS } from '../src/sim/content';
import { ELEMENTS, FAMILIES, HUNTS, MORPHS, RECIPES, REGIONS, RULES, SPAWNABLE, STRONG, craterAt, elementOf, isNight, morph, stormAt, typeMult } from '../src/sim/content';

const T0 = 1_800_000_000_000;
const MIN = 60_000, HOUR = 60 * MIN;
const fresh = (seed = 7) => new World(newGame(seed, T0));
const give = (w: World, sp: string, lv = 1, stars = 1) => { const u = `g${w.s.nextId++}`; w.s.bag.push({ u, sp, lv, xp: 0, stars, prism: false, en: RULES.maxEnergy }); return u; };
/** A Greeble on the team (0.13: only the team fights). Makes room on the team if it's full. */
const fighter = (w: World, sp: string, lv = 1, stars = 1) => {
  const u = give(w, sp, lv, stars);
  if (!w.s.team.includes(null)) { if (w.s.team.length < 6) w.s.team.push(null); else w.s.team[0] = null; }
  expect(w.toTeam(u).ok).toBe(true); return u;
};
/** Put one Greeble in the wilds and start catching it. */
const meet = (w: World, sp = 'ashpup', lv = 1) => { const x = w.addSpawn(T0, 'wild', sp); x.lv = lv; w.drain(); expect(w.startEncounter(x.id).ok).toBe(true); return x; };

describe('content', () => {
  it('has ~45 kinds, and every evolution points at a real kind of the same caste', () => {
    expect(MORPHS.length).toBeGreaterThanOrEqual(60);
    for (const m of MORPHS) for (const e of m.evo ?? []) { expect(morph(e.to).role).toBe(m.role); expect(morph(e.to).stage).toBe(m.stage + 1); }
    expect(FAMILIES.flat().length).toBe(MORPHS.length); // every kind sits in exactly one family
  });
  it('only stage-1 kinds spawn', () => { for (const m of SPAWNABLE) expect(m.stage).toBe(1); });
  it('the planet clock: day/night, storms and craters are fixed for everyone', () => {
    expect(isNight(T0 + 0)).toBe(isNight(T0 + 2 * HOUR));
    expect(stormAt(T0)).toEqual(stormAt(T0));
    let craters = 0;
    for (let i = 0; i < 40; i++) if (craterAt(T0 + i * RULES.craterBlockMs)) craters++;
    expect(craters).toBeGreaterThan(20);
  });
});

describe('the wilds', () => {
  it('a new game starts with 3 starter Greebles waiting', () => {
    const w = fresh();
    expect(w.s.spawns.map(x => x.sp).sort()).toEqual(['ashpup', 'scrappling', 'tidling']);
  });

  it('Greebles gather while you are away (cap 6), then wander off', () => {
    const w = fresh();
    w.s.spawns = [];
    w.updateWilds(T0 + 2 * HOUR);
    const wild = () => w.s.spawns.filter(x => x.src === 'wild').length;
    expect(wild()).toBeGreaterThanOrEqual(5);
    expect(wild()).toBeLessThanOrEqual(RULES.ambientCap);
    w.updateWilds(T0 + 30 * HOUR);
    expect(wild()).toBeLessThanOrEqual(RULES.ambientCap);
  });

  it('while you sit there it stays fairly quiet (~1 every 15 min)', () => {
    const w = fresh();
    w.s.spawns = []; w.s.nextAmbientAt = T0; w.s.nextWreckAt = Infinity;
    let wild = 0;
    for (let t = T0; t < T0 + HOUR; t += 1000) { w.updateWilds(t); for (const e of w.drain()) if (e.t === 'spawn' && e.src === 'wild') wild++; }
    expect(wild).toBeGreaterThanOrEqual(3); expect(wild).toBeLessThanOrEqual(7);
  });

  it('a Beacon brings Greebles in fast', () => {
    const w = fresh();
    w.s.spawns = []; w.s.items.beacon = 1;
    expect(w.useBeacon(T0).ok).toBe(true);
    w.updateWilds(T0 + 10 * MIN);
    expect(w.s.spawns.filter(x => x.src === 'beacon').length).toBeGreaterThanOrEqual(3);
    expect(w.useBeacon(T0).ok).toBe(false);
  });

  it('a Glow Crater spawns a lot while it is lit, boosting its caste', () => {
    // find a crater window
    let t = T0; let c = craterAt(t);
    while (!c) { t += RULES.craterBlockMs; c = craterAt(t); }
    const w = new World(newGame(3, c.start - 1000));
    w.s.spawns = [];
    w.updateWilds(c.start + 20 * MIN);
    const crater = w.s.spawns.filter(x => x.src === 'crater');
    expect(crater.length).toBeGreaterThanOrEqual(3);
  });

  it('a week away does not take forever and leaves a sane wilds', () => {
    const w = fresh();
    const start = performance.now();
    w.catchUp(7 * 24 * HOUR, T0 + 7 * 24 * HOUR);
    expect(performance.now() - start).toBeLessThan(500);
    expect(w.s.spawns.length).toBeLessThanOrEqual(RULES.ambientCap + RULES.craterCap + RULES.beaconCap + RULES.wreckBurst);
  });

  it('Prismatics happen about 1 in 400', () => {
    const w = fresh(99);
    let p = 0; const N = 40_000;
    for (let i = 0; i < N; i++) { if (w.addSpawn(T0, 'wild').prism) p++; if (i % 50 === 0) { w.s.spawns = []; w.drain(); } }
    expect(p / N).toBeGreaterThan(1 / 600); expect(p / N).toBeLessThan(1 / 280);
  });

  it('rarity tiers roughly follow 55/27/12/5/0.9', () => {
    const w = fresh(5);
    const c: Record<string, number> = {};
    // the weekly swarm boosts one kind 8×; measure in a week where the swarm kind is common
    let t = T0 + 10 * MIN; while (w.swarmKind(t).rarity !== 'common') t += 7 * 24 * HOUR;
    for (let i = 0; i < 20_000; i++) { const m = w.rollKind(t); c[m.rarity] = (c[m.rarity] ?? 0) + 1; }
    expect(c.common / 20_000).toBeGreaterThan(0.45);
    expect(c.legendary ?? 0).toBe(0);  // no Legendary until you beat the area boss…
    expect(c.mythic ?? 0).toBe(0);     // …and the Mythic only comes from its own stormy-night event
    w.s.bossBeaten.ash = T0;
    let leg = 0; for (let i = 0; i < 20_000; i++) if (w.rollKind(T0 + 10 * MIN).rarity === 'legendary') leg++;
    expect(leg).toBeGreaterThan(50); expect(leg).toBeLessThan(400);
  });
});

describe('catching', () => {
  it('a Star Snare always catches, and the Greeble joins the bag with its stars', () => {
    const w = fresh(); w.s.items.star = 1;
    const x = meet(w, 'phaest', 7);
    expect(w.throwSnare('star', 0).ok).toBe(true);
    const g = w.s.bag.find(g => g.sp === 'phaest')!;
    expect(g.lv).toBe(7); expect(g.stars).toBe(x.stars);
    expect(w.s.caught.phaest).toBe(true);
    expect(w.s.spawns.some(y => y.id === x.id)).toBe(false);
    expect(w.s.enc).toBeNull();
  });

  it('better snares, better throws and treats all raise the odds', () => {
    const w = fresh(); meet(w, 'zoln');
    const base = w.catchChance('snare', 0);
    expect(w.catchChance('good', 0)).toBeGreaterThan(base);
    expect(w.catchChance('snare', 3)).toBeGreaterThan(w.catchChance('snare', 1));
    w.useTreat();
    expect(w.catchChance('snare', 0)).toBeGreaterThan(base);
  });

  it('rarer Greebles are harder and run off more', () => {
    const tries = (sp: string) => {
      let caught = 0, fled = 0;
      for (let i = 0; i < 400; i++) {
        const w = fresh(i); w.s.items.snare = 50; w.s.bag = []; meet(w, sp);
        w.throwSnare('snare', 1);
        if (w.s.bag.length) caught++; else if (!w.s.enc) fled++;
      }
      return { caught, fled };
    };
    const common = tries('ashpup'), legend = tries('quorvex');
    expect(common.caught).toBeGreaterThan(legend.caught * 3);
    expect(legend.fled).toBeGreaterThan(common.fled);
  });

  it('using up snares stops you, and a full bag blocks catching', () => {
    const w = fresh(); w.s.items.snare = 0; meet(w);
    expect(w.throwSnare('snare', 0).ok).toBe(false);
    w.leaveEncounter();
    w.s.bagMax = 1; give(w, 'ashpup');
    const x = w.addSpawn(T0, 'wild', 'vorr');
    expect(w.startEncounter(x.id).ok).toBe(false);
  });

  it('field guide rewards pay out as you catch new kinds', () => {
    const w = fresh(); w.s.items.star = 10;
    const startGood = w.count('good'), startBag = w.s.bagMax;
    for (const sp of ['ashpup', 'tidling', 'scrappling', 'vorr', 'velm', 'skarnox']) { meet(w, sp); w.throwSnare('star', 0); }
    expect(w.count('good')).toBe(startGood + 5);
    expect(w.s.bagMax).toBe(startBag + 10);
    expect(w.s.claimed.c3 && w.s.claimed.c6).toBe(true);
  });
});

describe('evolving', () => {
  it('level evolutions are offered once the level is reached, and fill the guide', () => {
    const w = fresh();
    const u = give(w, 'ashpup', 9); w.s.candy.ashpup = 100;
    expect(w.evoOptions(w.get(u)!, T0).every(o => !o.ready)).toBe(true);
    w.get(u)!.lv = 10;
    expect(w.evolve(u, 'gleck', T0).ok).toBe(true);
    expect(w.s.candy.ashpup).toBe(100 - 25);
    expect(w.get(u)!.sp).toBe('gleck');
    expect(w.s.caught.gleck).toBe(true);
  });

  it('item evolutions use up the item; branch evolutions let you pick', () => {
    const w = fresh();
    const u = give(w, 'klyx', 18); w.s.candy.klyx = 99;
    w.s.bossBeaten = { ash: T0 };
    expect(w.evolve(u, 'klyxen', T0).ok).toBe(false);
    w.s.items.moon = 1;
    expect(w.evolve(u, 'klyxen', T0).ok).toBe(true);
    expect(w.count('moon')).toBe(0);
    expect(w.get(u)!.sp).toBe('klyxen');
  });

  it('night evolutions only work at night', () => {
    const w = fresh();
    const u = give(w, 'vesperid', 16); w.s.candy.vesperid = 99;
    let day = T0; while (isNight(day)) day += MIN;
    let night = T0; while (!isNight(night)) night += MIN;
    expect(w.evolve(u, 'vesperax', day).ok).toBe(false);
    expect(w.evolve(u, 'vesperax', night).ok).toBe(true);
  });

  it('0.13: evolving costs family candy; catching, hatching and sending home give it', () => {
    const w = fresh();
    const u = give(w, 'ashpup', 10);
    expect(w.evoOptions(w.get(u)!, T0)[0].why).toMatch(/candy/);
    expect(w.evolve(u, 'gleck', T0).ok).toBe(false);
    // a catch gives 5 (7 for a 4★ or better); the whole family shares it
    const x = w.addSpawn(T0, 'wild', 'ashpup'); x.stars = 4; w.startEncounter(x.id); w.s.items.star = 1; w.throwSnare('star', 0);
    expect(w.candyOf('ashpup')).toBe(7); expect(w.candyOf('gleckor')).toBe(7);
    // sending one home gives 2
    const extra = w.s.bag[w.s.bag.length - 1].u;
    expect(w.sell(extra).ok).toBe(true); expect(w.candyOf('ashpup')).toBe(9);
    w.s.candy.ashpup = 25;
    expect(w.evolve(u, 'gleck', T0).ok).toBe(true); expect(w.candyOf('gleck')).toBe(0);
    // stage 2 → 3 costs more
    w.get(u)!.lv = 25; w.s.bossBeaten = { ash: T0, tide: T0, rust: T0 };
    w.s.candy.ashpup = 59; expect(w.evolve(u, 'gleckor', T0).ok).toBe(false);
    w.s.candy.ashpup = 60; expect(w.evolve(u, 'gleckor', T0).ok).toBe(true);
  });

  it('0.13: grafting is gone', () => {
    const w = fresh() as any;
    expect(w.graft).toBeUndefined(); expect(w.graftPartners).toBeUndefined();
  });

  it('0.13: levels stop at the cap until the next boss falls; extra xp is kept and pays out', () => {
    const w = fresh();
    const u = fighter(w, 'draug', 11, 3);
    expect(w.levelCap).toBe(12);
    const g = w.get(u)!;
    (w as any).addXp(g, 50_000);
    expect(g.lv).toBe(12); expect(g.xp).toBe(w.bankMax(g));
    w.s.bossBeaten.ash = T0; (w as any).raiseCap();
    expect(w.levelCap).toBe(20); expect(g.lv).toBeGreaterThan(12);
    // wild Greebles are always well under the cap
    for (let i = 0; i < 100; i++) expect(w.addSpawn(T0, 'wild').lv).toBeLessThanOrEqual(20 - 8);
    // camp gives no xp any more
    const c = give(w, 'ashpup', 3); w.assign(c); w.advance(HOUR, T0);
    expect(w.get(c)!.lv).toBe(3); expect(w.get(c)!.xp).toBe(0);
  });
});

describe('camp, shop and robots', () => {
  it('camp pays every 15 s; stars and stages pay more', () => {
    const w = fresh();
    const lo = give(w, 'ashpup', 1, 1), hi = give(w, 'gleckor', 1, 5);
    expect(w.yieldOf(w.get(hi)!)).toBeGreaterThan(w.yieldOf(w.get(lo)!));
    w.assign(lo);
    const before = w.s.scrap;
    w.advance(RULES.campTickMs * 4);
    expect(w.s.scrap - before).toBeCloseTo(4 * w.yieldOf(w.get(lo)!));
  });

  it('the shop sells for scrap', () => {
    const w = fresh(); w.s.scrap = 100;
    const s0 = w.count('snare');
    expect(w.buy('snare', 5).ok).toBe(true);
    expect(w.count('snare')).toBe(s0 + 5); expect(w.s.scrap).toBe(50);
    expect(w.buy('beacon').ok).toBe(false);
    expect(w.buy('star').ok).toBe(false);
  });

  it('beating a wreck robot releases a burst of Greebles', () => {
    const w = fresh();
    w.s.wreck = { robot: 'drone', until: T0 + HOUR };
    const f = fighter(w, 'draug', 20, 5);
    expect(w.wouldWin(f, 'drone', true)).toBe(true);
    expect(w.startFight(f, 'drone', true).ok).toBe(true);
    w.s.spawns = [];
    w.advance(60_000, T0);
    expect(w.s.wreck).toBeNull();
    expect(w.s.spawns.filter(x => x.src === 'wreck').length).toBe(RULES.wreckBurst);
    expect(w.s.stats.wrecks).toBe(1);
  });

  it('the win check matches a real fight', () => {
    const w = fresh();
    for (const lv of [1, 3, 6, 10, 20]) for (const r of ['drone', 'pylon', 'colossus']) {
      w.s.team = [null, null, null]; w.s.autoPatrol = false;
      const u = fighter(w, 'velm', lv); const guess = w.wouldWin(u, r);
      w.startFight(u, r); w.advance(120_000, T0);
      expect(w.s.stats.wins > 0).toBe(guess); w.s.stats.wins = 0; w.s.stats.losses = 0;
    }
  });
});

describe('saves', () => {
  it('0.13: saves from before the new rules start over (with a one-time notice)', () => {
    const old = { version: 8, scrap: 99999, bag: [{ u: 'g1', sp: 'draug', lv: 30, xp: 5, stars: 5 }], camp: ['g1'], stats: { caught: 40 }, lastSeen: T0 };
    const s = migrate(old, T0);
    expect(s.version).toBe(9); expect(s.bag).toEqual([]); expect(s.scrap).toBe(RULES.startScrap);
    expect(s.newRules).toBe(true); expect(s.intro).toBe(0); expect(s.caught).toEqual({});
    expect(s.spawns.length).toBeGreaterThan(0);
    // an empty old save (never played) just starts fresh with no notice
    expect(migrate({ version: 3, bag: [] }, T0).newRules).toBeUndefined();
  });

  it('round-trips through JSON', () => {
    const w = fresh(); give(w, 'nulith', 4); w.updateWilds(T0 + HOUR);
    const back = migrate(JSON.parse(JSON.stringify(w.s)), T0 + HOUR);
    expect(back.bag).toEqual(w.s.bag);
    expect(back.spawns).toEqual(w.s.spawns);
    expect(back.items).toEqual(w.s.items);
  });

  it('cleans up junk without crashing', () => {
    const s = migrate({ version: 9, bag: [{ u: 'g1', sp: 'nope' }, { u: 'g2', sp: 'velm', lv: 99, stars: 9, en: 99 }, null], camp: ['g1', 'g2', 'g2'], team: ['g2', 'zz'], scrap: 'lots', candy: { velm: 5, nope: 3, ashpup: -1 },
      items: { snare: -4, good: 'x', beacon: 2 }, spawns: [{ id: 'w1', sp: 'zzz' }], enc: { spawn: 'w9' } }, T0);
    expect(s.bag.map(g => g.u)).toEqual(['g2']);
    expect(s.bag[0].lv).toBe(RULES.maxLevel); expect(s.bag[0].stars).toBe(5); expect(s.bag[0].en).toBe(RULES.maxEnergy);
    expect(s.team).toEqual([null, null, null]);   // it's camping, so it can't also be on the team
    expect(s.candy).toEqual({ velm: 5 });
    expect(s.items.snare).toBeUndefined(); expect(s.items.beacon).toBe(2);
    expect(s.spawns).toEqual([]); expect(s.enc).toBeNull();
    expect(migrate(null, T0).bag).toEqual([]);
  });
});

describe('0.3: areas, bosses, camp upgrades', () => {
  it('every area kind is real, stage 1, and every area has a Legendary + a boss', () => {
    for (const r of REGIONS) {
      for (const k of r.kinds) expect(morph(k).stage).toBe(1);
      expect(morph(r.legendary).rarity).toBe('legendary');
      expect(r.boss.hp).toBeGreaterThan(0);
    }
    // every catchable kind lives somewhere
    for (const m of SPAWNABLE) if (m.rarity !== 'mythic') expect(REGIONS.some(r => r.kinds.includes(m.id) || r.legendary === m.id)).toBe(true);
  });

  it('only the area you are in spawns its kinds, at its level', () => {
    const w = fresh(); w.s.unlocked = 4; w.s.bossBeaten = { ash: T0, tide: T0, rust: T0 }; w.travel('glass');
    const swarm = w.swarmKind(T0).id;
    for (let i = 0; i < 200; i++) { const x = w.addSpawn(T0, 'wild'); expect([...REGIONS[3].kinds, swarm]).toContain(x.sp); expect(x.lv).toBeGreaterThan(REGIONS[3].lvl); expect(x.reg).toBe('glass'); }
    expect(w.here.every(x => x.reg === 'glass')).toBe(true);
  });

  it('locked areas cannot be visited', () => {
    const w = fresh();
    expect(w.travel('tide').ok).toBe(false);
    expect(w.s.region).toBe('ash');
  });

  it('a team beats the first boss: opens the next area, calls out the Legendary, then rests 2 h', () => {
    const w = fresh();
    const team = [fighter(w, 'draugoth', 25, 4), fighter(w, 'velmor', 20, 4), fighter(w, 'gleckor', 25, 3)];
    expect(w.wouldWin(team, 'boss', 'boss')).toBe(true);
    expect(w.startFight(team, 'boss', 'boss').ok).toBe(true);
    w.advance(120_000, T0);
    expect(w.s.fight).toBeNull();
    expect(w.s.unlocked).toBe(2);
    expect(w.s.bossBeaten.ash).toBe(T0);
    expect(w.s.spawns.some(x => x.sp === 'quorvex' && x.src === 'legend')).toBe(true);
    expect(w.count('star')).toBeGreaterThan(0);
    expect(w.travel('tide').ok).toBe(true);
  });

  it('a weak team loses to the boss and keeps its Greebles', () => {
    const w = fresh();
    const u = fighter(w, 'scrappling', 1);
    expect(w.wouldWin([u], 'boss', 'boss')).toBe(false);
    w.startFight([u], 'boss', 'boss'); w.advance(300_000, T0);
    expect(w.s.unlocked).toBe(1); expect(w.get(u)).toBeDefined();
  });

  it('team win-check matches the real boss fight (within a little luck)', () => {
    let agree = 0, total = 0;
    for (const lv of [5, 10, 15, 20, 25, 30]) {
      const w = fresh(lv);
      const team = [fighter(w, 'draug', lv, 3), fighter(w, 'velm', lv, 3), fighter(w, 'skarnox', lv, 3)];
      const guess = w.wouldWin(team, 'boss', 'boss');
      w.startFight(team, 'boss', 'boss'); w.advance(600_000, T0);
      total++; if ((w.s.stats.bosses > 0) === guess) agree++;
    }
    expect(agree).toBeGreaterThanOrEqual(total - 1);
  });

  it('patrol robots are tougher in later areas', () => {
    const w = fresh(); w.s.unlocked = 4;
    const ash = w.foe('drone', 'patrol')!.hp; w.travel('rust');
    expect(w.foe('drone', 'patrol')!.hp).toBeGreaterThan(ash * 3);
  });

  it('camp upgrades: tents, bag, workbench, night watch, snare press', () => {
    const w = fresh(); w.s.scrap = 1_000_000;
    const slots = w.s.camp.length, bag = w.s.bagMax;
    expect(w.buyUpgrade('tent').ok).toBe(true); expect(w.s.camp.length).toBe(slots + 1);
    expect(w.buyUpgrade('bag').ok).toBe(true); expect(w.s.bagMax).toBe(bag + 10);
    const u = give(w, 'gleckor', 30, 5); const before = w.yieldOf(w.get(u)!);
    w.buyUpgrade('bench'); expect(w.yieldOf(w.get(u)!)).toBeGreaterThan(before);
    w.buyUpgrade('away'); expect(w.offlineCap).toBe(RULES.offlineCapMs + 4 * HOUR);
    w.buyUpgrade('press'); const sn = w.count('snare'); w.advance(HOUR, T0); expect(w.count('snare')).toBe(sn + 2);
    for (let i = 0; i < 10; i++) w.buyUpgrade('tent');
    expect(w.s.camp.length).toBeLessThanOrEqual(RULES.maxCampSlots);
  });

  it('0.13: bigger team and bedrolls', () => {
    const w = fresh(); w.s.scrap = 1_000_000;
    expect(w.teamMax).toBe(3);
    for (let i = 0; i < 5; i++) w.buyUpgrade('squad');
    expect(w.teamMax).toBe(6); expect(w.s.team.length).toBe(6);
    const g = w.get(give(w, 'ashpup'))!; const slow = w.enMs(g);
    w.buyUpgrade('bedroll'); expect(w.enMs(g)).toBeLessThan(slow);
  });
});

describe('0.4: elements, moves, robot parts', () => {
  it('every kind has an element; the chart is balanced (each beats 2, each is beaten by 2)', () => {
    for (const m of MORPHS) expect(ELEMENTS[elementOf(m.id)]).toBeDefined();
    const beatenBy: Record<string, number> = {};
    for (const e of Object.keys(STRONG)) { expect(STRONG[e as keyof typeof STRONG].length).toBe(2); for (const x of STRONG[e as keyof typeof STRONG]) beatenBy[x] = (beatenBy[x] ?? 0) + 1; }
    for (const e of Object.keys(ELEMENTS)) expect(beatenBy[e]).toBe(2);
    expect(typeMult('tide', 'ember')).toBe(1.5); expect(typeMult('ember', 'tide')).toBeLessThan(1); expect(typeMult('tide', 'glass')).toBe(1);
  });

  it('the right element hits harder', () => {
    const w = fresh();
    const tide = give(w, 'nulith', 15), ember = give(w, 'zoln', 15);
    // colossus is Ember: Tide beats it
    expect(w.hitOn(w.get(tide)!, 'ember')).toBeGreaterThan(w.hitOn(w.get(tide)!, 'glass'));
    expect(w.hitBy(w.get(ember)!, 20, 'tide')).toBeGreaterThan(w.hitBy(w.get(ember)!, 20, 'moss'));
  });

  it('any caste can fight a patrol now', () => {
    const w = fresh();
    const u = fighter(w, 'gleck', 20, 4);
    expect(w.startFight(u, 'drone').ok).toBe(true);
    w.advance(60_000, T0); expect(w.s.stats.wins).toBe(1);
  });

  it('a tapped move does 3x and resets the charge; untapped fires at 2x on its own', () => {
    const w = fresh();
    const u = fighter(w, 'draug', 5, 1); w.s.autoPatrol = false;
    w.startFight(u, 'colossus');
    w.s.fight!.robotHp = w.s.fight!.robotMax = 1e6;    // won't end
    w.s.fight!.team[0].hp = w.s.fight!.team[0].maxHp = 1e6;
    const g = w.get(u)!; const base = w.hitOn(g, 'ember');
    expect(w.useMove(u).ok).toBe(false);               // not charged
    w.advance(4000, T0); w.drain();
    expect(w.useMove(u).ok).toBe(true);
    const before = w.s.fight!.robotHp; w.advance(1000, T0);
    expect(before - w.s.fight!.robotHp).toBe(base * 3);
    expect(w.s.fight!.team[0].charge).toBe(0);
    w.drain(); w.advance(6000, T0);
    const moves = w.drain().filter(e => e.t === 'move');
    expect(moves.length).toBe(1); expect((moves[0] as any).tapped).toBe(false);
  });

  it('robots drop gears; gears craft into items', () => {
    const w = fresh();
    const u = fighter(w, 'draugoth', 25, 5);
    w.startFight(u, 'drone'); w.advance(60_000, T0);
    expect(w.count('gear')).toBeGreaterThan(0);
    w.s.items.gear = 100; w.s.items.core = 10;
    const star = RECIPES.findIndex(r => r.out === 'star' && r.cost.gear);
    expect(w.craft(star).ok).toBe(true);
    expect(w.count('star')).toBe(1); expect(w.count('gear')).toBe(60); expect(w.count('core')).toBe(5);
    w.s.items.gear = 0; expect(w.craft(RECIPES.findIndex(r => r.cost.gear === 2)).ok).toBe(false);
  });

  it('bosses always drop Power Cores', () => {
    const w = fresh();
    const team = [fighter(w, 'draugoth', 30, 5), fighter(w, 'velmor', 30, 5), fighter(w, 'skarnex', 30, 5)];
    w.startFight(team, 'boss', 'boss'); w.advance(300_000, T0);
    expect(w.s.stats.bosses).toBe(1); expect(w.count('core')).toBeGreaterThan(0);
  });
});

describe('0.5: camp jobs, area favour, bait', () => {
  it('campers bring back materials by caste', () => {
    const w = fresh(11);
    w.assign(give(w, 'gleckor', 20, 5)); w.assign(give(w, 'nulithar', 20, 5)); w.assign(give(w, 'draugoth', 20, 5));
    w.advance(HOUR, T0);
    expect(w.count('ore')).toBeGreaterThan(0); expect(w.count('kelp')).toBeGreaterThan(0); expect(w.count('gear')).toBeGreaterThan(0);
  });

  it('the favoured caste works better (Dig in Ash Flats, Trawl in Tide Pools)', () => {
    const w = fresh(); w.s.unlocked = 4;
    const dig = w.get(give(w, 'gleck', 10, 3))!, trawl = w.get(give(w, 'nulith', 10, 3))!;
    expect(w.jobOf(dig).chance).toBeGreaterThan(w.jobOf(trawl).chance);
    expect(w.yieldOf(dig)).toBeGreaterThan(w.yieldOf(trawl) - 0.01);
    w.travel('tide');
    expect(w.jobOf(trawl).chance).toBeGreaterThan(w.jobOf(dig).chance);
  });

  it('strong Dig Greebles in the Glass Spires find Crystal', () => {
    const w = fresh(); w.s.unlocked = 4; w.travel('glass');
    const g = w.get(give(w, 'shardon', 20, 5))!;
    expect(w.jobOf(g).item).toBe('crystal');
  });

  it('caste bait brings in mostly that caste; only one bait at a time', () => {
    const w = fresh(21); w.s.items.lureTrawl = 2; w.s.spawns = [];
    expect(w.useLure('lureTrawl', T0).ok).toBe(true);
    expect(w.useLure('lureTrawl', T0).ok).toBe(false);
    let trawl = 0, total = 0;
    for (let t = T0; t < T0 + 30 * MIN; t += 30_000) { w.updateWilds(t); for (const x of w.s.spawns.filter(x => x.src === 'lure')) { total++; if (morph(x.sp).role === 'fish') trawl++; } w.s.spawns = w.s.spawns.filter(x => x.src !== 'lure'); }
    expect(total).toBeGreaterThanOrEqual(4);
    expect(trawl / total).toBeGreaterThan(0.5);
    w.updateWilds(T0 + 31 * MIN); expect(w.s.lure).toBeNull();
  });

  it('crafting uses materials', () => {
    const w = fresh(); w.s.items.kelp = 3;
    const i = RECIPES.findIndex(r => r.out === 'treat');
    const t0 = w.count('treat');
    expect(w.craft(i).ok).toBe(true); expect(w.count('treat')).toBe(t0 + 2); expect(w.count('kelp')).toBe(0);
    expect(w.craft(i).ok).toBe(false);
  });
});

describe('0.6: ship, signal home, perks, expeditions, swarm', () => {
  const rich = (w: World) => { w.s.scrap = 1e7; for (const k of ['ore', 'kelp', 'gear', 'core', 'crystal'] as const) w.s.items[k] = 9999; };

  it('ship parts go in order and need the right bosses', () => {
    const w = fresh(); rich(w);
    expect(w.buildPart('engine').ok).toBe(false);          // hull first
    expect(w.buildPart('hull').ok).toBe(true);
    expect(w.buildPart('engine').ok).toBe(false);          // needs the Tide Dredger
    w.s.bossBeaten = { ash: T0, tide: T0, rust: T0, glass: T0 };
    for (const p of SHIP_PARTS.slice(1)) expect(w.buildPart(p.id).ok).toBe(true);
    expect(w.shipDone).toBe(true);
  });

  it('signal home keeps the guide, perks and 3 Greebles; resets the rest; robots get tougher', () => {
    const w = fresh(); rich(w);
    w.s.bossBeaten = { ash: T0, tide: T0, rust: T0, glass: T0 }; w.s.unlocked = 4;
    for (const p of SHIP_PARTS) w.buildPart(p.id);
    const keep = [give(w, 'draugoth', 30, 5), give(w, 'gleckor', 20, 4), give(w, 'nulith', 10), give(w, 'velm', 5)];
    w.s.caught = { draugoth: true, gleckor: true, nulith: true, velm: true }; w.s.claimed = { c3: true };
    const hpBefore = w.foe('drone', 'patrol')!.hp;
    const reward = w.signalReward;
    expect(w.signalHome(keep, T0).ok).toBe(true);
    expect(w.s.signals).toBe(1); expect(w.s.sp).toBe(reward);
    expect(w.s.bag.length).toBe(3); expect(w.s.bag[0].lv).toBe(12);   // half level, but no higher than the first cap
    expect(w.s.caught.velm).toBe(true);                    // guide kept
    expect(w.s.unlocked).toBe(1); expect(w.s.ship).toEqual({}); expect(w.s.scrap).toBe(RULES.startScrap);
    expect(w.foe('drone', 'patrol')!.hp).toBeGreaterThan(hpBefore);
    expect(w.s.bagMax).toBe(RULES.bagMax);                 // c3 gave snares, not bag
  });

  it('perks cost Signal Points and do things', () => {
    const w = fresh(); w.s.sp = 10;
    meet(w, 'zoln'); const c0 = w.catchChance('snare', 0); w.leaveEncounter();
    expect(w.buyPerk('lucky').ok).toBe(true);
    meet(w, 'zoln'); expect(w.catchChance('snare', 0)).toBeGreaterThan(c0); w.leaveEncounter();
    expect(w.buyPerk('roam').ok).toBe(true); expect(w.ambientCap).toBe(RULES.ambientCap + 1);
    expect(w.s.sp).toBe(8);
    w.s.sp = 100; for (let i = 0; i < 10; i++) w.buyPerk('roam');
    expect(w.perk('roam')).toBe(PERKS.find(p => p.id === 'roam')!.max);
  });

  it('one expedition a day; the Greeble comes back with loot and a rare friend', () => {
    const w = fresh(); w.s.spawns = [];
    const u = give(w, 'gleck', 20, 4);
    const day = Math.floor(T0 / DAY_MS) * DAY_MS + DAY_MS + 1000;
    expect(w.sendExpedition(u, day).ok).toBe(true);
    expect(w.busy(u)).toBe(true);
    expect(w.sendExpedition(give(w, 'velm'), day).ok).toBe(false);
    w.s.wildClock = day; w.updateWilds(day + 4 * HOUR + 1000);
    const back = w.drain().find(e => e.t === 'expoBack');
    expect(back).toBeDefined(); expect(w.s.expo).toBeNull(); expect(w.count('ore')).toBeGreaterThan(0);
    expect(w.sendExpedition(u, day + 5 * HOUR).ok).toBe(false);      // same day
    expect(w.sendExpedition(u, day + DAY_MS).ok).toBe(true);         // next day
  });

  it('the weekly swarm kind is much more common', () => {
    const w = fresh(3); const sw = w.swarmKind(T0).id;
    let n = 0; for (let i = 0; i < 3000; i++) if (w.rollKind(T0).id === sw) n++;
    expect(n / 3000).toBeGreaterThan(0.15);
  });
});


describe('0.8: Mythic Hunts + Void Rift', () => {
  it('has a 5th area with its own boss and Legendary', () => {
    expect(REGIONS.length).toBe(5);
    const v = REGIONS[4];
    expect(v.id).toBe('void'); expect(morph(v.legendary).rarity).toBe('legendary');
    for (const k of v.kinds) expect(morph(k).stage).toBe(1);
  });
  it('every Mythic has exactly one hunt, and Mythics never roll in normal spawns', () => {
    const mythics = MORPHS.filter(m => m.rarity === 'mythic');
    expect(mythics.length).toBe(5);
    for (const m of mythics) expect(HUNTS.filter(h => h.mythic === m.id).length).toBe(1);
    const w = new World(newGame(5, T0));
    w.s.unlocked = 5;
    for (const r of REGIONS) { w.s.region = r.id; w.s.bossBeaten[r.id] = T0; for (let i = 0; i < 400; i++) expect(morph(w.addSpawn(T0, 'wild').sp).rarity).not.toBe('mythic'); }
  });
  it('a hunt finishes from tallies, gives a Star Snare, and calls its Mythic in its area', () => {
    const w = new World(newGame(9, T0));
    const h = HUNTS.find(x => x.id === 'h_verd')!;
    expect(w.huntState(h, T0)).toBe('open');
    expect(w.callMythic(h.id, T0).ok).toBe(false);
    const stars = w.count('star');
    w.s.tally['catch:moss'] = 15; w.s.tally['craft'] = 9; w.s.tally['evolve'] = 5;
    w.s.items.ore = 10;
    const ri = RECIPES.findIndex(r => r.out === 'snare' && r.cost.ore);
    expect(w.craft(ri).ok).toBe(true);
    expect(w.s.hunts[h.id]).toBeTruthy();
    expect(w.count('star')).toBe(stars + 1);
    expect(w.drain().some(e => e.t === 'huntDone')).toBe(true);
    expect(w.huntState(h, T0)).toBe('ready');
    expect(w.callMythic(h.id, T0).ok).toBe(true);
    const x = w.s.spawns.find(y => y.sp === 'verdance')!;
    expect(x.reg).toBe('ash'); expect(x.src).toBe('mythic');
    expect(w.huntState(h, T0)).toBe('out');
    expect(w.callMythic(h.id, T0).ok).toBe(false);
  });
  it('a locked area hunt stays locked; tallies count catches by element', () => {
    const w = new World(newGame(11, T0));
    expect(w.huntState(HUNTS.find(x => x.id === 'h_rift')!, T0)).toBe('locked');
    const sp = w.addSpawn(T0, 'wild', 'tidling');
    w.startEncounter(sp.id); w.s.items.star = 1;
    expect(w.throwSnare('star', 3).ok).toBe(true);
    expect(w.tallyOf('catch')).toBe(1); expect(w.tallyOf('catch:tide')).toBe(1); expect(w.tallyOf('perfect')).toBe(1);
  });
  it('hunt progress survives a signal home and old saves', () => {
    const w = new World(newGame(13, T0));
    w.s.tally['patrol'] = 12; w.s.hunts['h_tide'] = T0;
    for (const p of ['hull', 'engine', 'fuel', 'antenna', 'nav'] as const) w.s.ship[p] = true;
    expect(w.signalHome([], T0).ok).toBe(true);
    expect(w.tallyOf('patrol')).toBe(12); expect(w.s.hunts['h_tide']).toBe(T0);
    const old: any = JSON.parse(JSON.stringify(w.s)); delete old.tally; delete old.hunts; old.version = 9;
    const m = migrate(old, T0);
    expect(m.tally).toEqual({}); expect(m.hunts).toEqual({}); expect(m.version).toBe(9);
  });
});


describe('0.9: nest, eggs, daily tasks, intro', () => {
  const add = (w: World, sp: string, extra: Partial<{ stars: number; prism: boolean; lv: number }> = {}) => {
    const g = { u: 'g' + w.s.nextId++, sp, lv: extra.lv ?? 5, xp: 0, stars: extra.stars ?? 3, prism: extra.prism ?? false, en: RULES.maxEnergy };
    w.s.bag.push(g); return g.u;
  };
  it('two of the same family lay an egg every 2h, of the stage-1 kind', () => {
    const w = fresh(21);
    const a = add(w, 'ashpup'), b = add(w, 'gleckor');
    expect(w.toNest(a).ok).toBe(true); expect(w.toNest(b).ok).toBe(true);
    expect(w.nestWhy()).toBe('');
    w.advance(2 * HOUR + 1000, T0);
    expect(w.s.eggs.length).toBe(1); expect(w.s.eggs[0].sp).toBe('ashpup');
    expect(w.drain().some(e => e.t === 'eggLaid')).toBe(true);
  });
  it('different families, legendaries and busy Greebles cannot nest', () => {
    const w = fresh(22);
    const a = add(w, 'ashpup'), b = add(w, 'tidling'), l = add(w, 'quorvex');
    w.toNest(a); w.toNest(b);
    expect(w.nestWhy()).toMatch(/same family/);
    w.advance(5 * HOUR, T0); expect(w.s.eggs.length).toBe(0);
    expect(w.toNest(l).ok).toBe(false);
    // nesting Greebles can't camp or fight
    expect(w.assign(a).ok).toBe(false);
    expect(w.startFight(a, 'drone').ok).toBe(false);
  });
  it('the incubator holds 3 eggs; eggs hatch over time and catching warms them', () => {
    const w = fresh(23);
    w.toNest(add(w, 'tidling')); w.toNest(add(w, 'nulith'));
    w.advance(20 * HOUR, T0);
    expect(w.s.eggs.length).toBe(3);
    // all common eggs (1h) laid long ago are ready
    const e0 = w.s.eggs[0];
    expect(e0.left).toBe(0);
    const bag = w.s.bag.length;
    expect(w.hatch(e0.id).ok).toBe(true);
    expect(w.s.bag.length).toBe(bag + 1);
    const baby = w.s.bag[w.s.bag.length - 1];
    expect(baby.sp).toBe('tidling'); expect(baby.lv).toBe(1);
    expect(w.tallyOf('hatch')).toBe(1);
    // a fresh egg isn't ready, but catching warms it
    w.s.eggs = [{ id: 'e1', sp: 'zoln', prism: false, stars: 2, left: 30 * MIN, total: 4 * HOUR }];
    expect(w.hatch('e1').ok).toBe(false);
    const sp = w.addSpawn(T0, 'wild', 'ashpup'); w.startEncounter(sp.id); w.s.items.star = 1; w.throwSnare('star', 0);
    expect(w.s.eggs[0].left).toBe(20 * MIN);
  });
  it('eggs are Prismatic more often than wild Greebles, much more with a Prismatic parent', () => {
    const count = (prism: boolean) => {
      const w = fresh(31); let p = 0; const N = 6000;
      w.toNest(add(w, 'ashpup', { prism })); w.toNest(add(w, 'gleck'));
      for (let i = 0; i < N; i++) { w.s.eggs = []; w.s.nestCarry = 2 * HOUR; w.advance(1, T0); if (w.s.eggs[0]?.prism) p++; }
      return p / N;
    };
    const plain = count(false), withPrism = count(true);
    expect(plain).toBeGreaterThan(1 / 400); expect(withPrism).toBeGreaterThan(plain * 2);
  });
  it('daily tasks: 3 per day, progress from tallies, claim pays once, all 3 = bonus', () => {
    const w = fresh(41);
    const d = w.ensureDaily(T0);
    expect(d.tasks.length).toBe(3);
    expect(new Set(d.tasks.map(t => t.id)).size).toBe(3);
    expect(w.ensureDaily(T0 + HOUR)).toBe(d);
    expect(w.claimTask(0, T0).ok).toBe(false);
    for (const t of d.tasks) w.s.tally[t.key] = (w.s.tally[t.key] ?? 0) + t.need;
    const scrap = w.s.scrap, great = w.count('great');
    for (let i = 0; i < 3; i++) expect(w.claimTask(i, T0).ok).toBe(true);
    expect(w.claimTask(0, T0).ok).toBe(false);
    expect(w.s.scrap).toBe(scrap + 3 * w.taskScrap);
    expect(w.count('great')).toBe(great + 2); expect(d.bonus).toBe(true);
    // a new day = new tasks, starting from 0
    const d2 = w.ensureDaily(T0 + 24 * HOUR);
    expect(d2).not.toBe(d); for (const t of d2.tasks) expect(w.taskProgress(t)).toBe(0);
  });
  it('new games start the intro; old saves skip it; nest/eggs migrate', () => {
    expect(newGame(1, T0).intro).toBe(0);
    const old: any = JSON.parse(JSON.stringify(newGame(2, T0)));
    delete old.intro; delete old.nest; delete old.eggs; delete old.daily; old.version = 9;
    old.bag.push({ u: 'g99', sp: 'ashpup', lv: 3, xp: 0, stars: 2, prism: false, en: 10 });
    const m = migrate(old, T0);
    expect(m.intro).toBe(99); expect(m.nest).toEqual([null, null]); expect(m.eggs).toEqual([]); expect(m.daily).toBeNull();
  });
});


describe('0.13: team, energy, auto-patrol', () => {
  it('a brand-new starter, or any 2 level-1 Ash Flats Greebles, beats an Ash drone (so Auto-patrol always gets going)', () => {
    for (const sp of fresh().s.spawns.map(x => x.sp)) {
      const w = fresh(); const u = fighter(w, sp, 1, 1);
      expect(w.wouldWin(u, 'drone')).toBe(true); expect(w.autoPick()?.robot).toBeDefined();
    }
    const kinds = REGIONS[0].kinds;
    for (const a of kinds) for (const b of kinds) {
      const w = fresh(); fighter(w, a, 1, 1); fighter(w, b, 1, 1);
      expect(w.autoPick()?.robot).toBeDefined();
    }
  });
  it('only the team fights; moving to camp takes a Greeble off the team (and back in one tap)', () => {
    const w = fresh(); w.s.autoPatrol = false;
    const a = give(w, 'draug', 8, 3);
    expect(w.startFight(a, 'drone').ok).toBe(false);          // not on the team
    expect(w.toTeam(a).ok).toBe(true); expect(w.startFight(a, 'drone').ok).toBe(true);
    w.advance(60_000, T0); expect(w.s.stats.wins).toBe(1);
    expect(w.assign(a).ok).toBe(true); expect(w.inTeam(a)).toBe(false); expect(w.inCamp(a)).toBe(true);
    expect(w.toTeam(a).ok).toBe(true); expect(w.inCamp(a)).toBe(false);
    // swap a rested camper in for a tired team member
    const b = give(w, 'velm', 8, 3); w.assign(b);
    expect(w.swapIn(b, a).ok).toBe(true); expect(w.inTeam(b)).toBe(true); expect(w.inCamp(a)).toBe(true);
  });
  it('fights cost energy; a knocked-out Greeble has none left; energy comes back fastest in camp', () => {
    const w = fresh(); w.s.autoPatrol = false;
    const a = fighter(w, 'draug', 10, 3);
    w.startFight(a, 'drone'); expect(w.energy(w.get(a)!)).toBe(9);
    w.advance(60_000, T0);
    // boss costs 3 each, and a weak one gets knocked out
    const weak = fighter(w, 'ashpup', 1, 1);
    w.startFight([a, weak], 'boss', 'boss'); w.advance(600_000, T0);
    expect(w.get(weak)!.en).toBeLessThan(1);
    // energy refills: 1 per 40 min on the team, 1 per 10 min in camp
    const t = w.get(a)!; t.en = 0; w.advance(40 * MIN, T0); expect(w.energy(t)).toBe(1);
    w.assign(a); t.en = 0; w.advance(40 * MIN, T0); expect(w.energy(t)).toBe(4);
    // not enough energy = can't fight
    w.toTeam(a); t.en = 0;
    expect(w.startFight(a, 'drone').ok).toBe(false);
  });
  it('auto-patrol fights on its own (also offline) and keeps 3 energy back for bosses', () => {
    const w = fresh();
    const a = fighter(w, 'draug', 10, 3), b = fighter(w, 'velm', 10, 3);
    const r = w.catchUp(8 * HOUR, T0 + 8 * HOUR);
    expect(r.wins).toBeGreaterThan(10);
    for (const u of [a, b]) expect(w.energy(w.get(u)!)).toBeGreaterThanOrEqual(3);
    expect(w.get(a)!.lv).toBeGreaterThan(10);
    // off = no fights
    const w2 = fresh(); fighter(w2, 'draug', 10, 3); w2.setAutoPatrol(false);
    expect(w2.catchUp(8 * HOUR, T0 + 8 * HOUR).wins).toBe(0);
  });
  it('offline catch-up gives the same result as playing it out in small steps', () => {
    const mk = () => { const w = fresh(77); fighter(w, 'draug', 10, 3); fighter(w, 'velm', 9, 2); w.assign(give(w, 'ashpup', 4)); return w; };
    const a = mk(), b = mk();
    a.advance(3 * HOUR, T0);
    for (let t = 0; t < 3 * HOUR; t += 250) b.advance(250, T0);
    expect(b.s.stats.wins).toBe(a.s.stats.wins);
    expect(b.s.bag.map(g => g.lv)).toEqual(a.s.bag.map(g => g.lv));
    for (let i = 0; i < a.s.bag.length; i++) expect(Math.abs(b.s.bag[i].en - a.s.bag[i].en)).toBeLessThan(0.05);
    expect(Math.round(b.s.scrap)).toBe(Math.round(a.s.scrap));
  });
  it('bosses hit the whole team; a team at the right level cap wins, one from the area before loses', () => {
    const team = (w: World, sp: string[], lv: number) => sp.map(x => fighter(w, x, lv, 3));
    const w = fresh(); w.s.scrap = 1e6; w.buyUpgrade('squad');
    w.s.bossBeaten = { ash: T0 - 1e9 }; w.s.unlocked = 2; w.travel('tide');
    const strong = team(w, ['draug', 'gleck', 'nulith', 'velmor'], 20);
    expect(w.wouldWin(strong, 'boss', 'boss')).toBe(true);
    const w2 = fresh(); w2.s.scrap = 1e6; w2.buyUpgrade('squad');
    w2.s.bossBeaten = { ash: T0 - 1e9 }; w2.s.unlocked = 2; w2.travel('tide');
    const weak = team(w2, ['scrappling', 'ashpup', 'tidling', 'velm'], 12);
    expect(w2.wouldWin(weak, 'boss', 'boss')).toBe(false);
  });
});
