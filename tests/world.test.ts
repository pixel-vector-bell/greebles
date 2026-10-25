import { describe, expect, it } from 'vitest';
import { World, newGame, migrate } from '../src/sim/world';
import { FAMILIES, MORPHS, REGIONS, RULES, SPAWNABLE, craterAt, isNight, morph, stormAt } from '../src/sim/content';

const T0 = 1_800_000_000_000;
const MIN = 60_000, HOUR = 60 * MIN;
const fresh = (seed = 7) => new World(newGame(seed, T0));
const give = (w: World, sp: string, lv = 1, stars = 1) => { const u = `g${w.s.nextId++}`; w.s.bag.push({ u, sp, lv, xp: 0, stars, prism: false }); return u; };
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
    for (let i = 0; i < N; i++) { if (w.addSpawn(T0, 'wild').prism) p++; if (i % 500 === 0) { w.s.spawns = []; w.drain(); } }
    expect(p / N).toBeGreaterThan(1 / 600); expect(p / N).toBeLessThan(1 / 280);
  });

  it('rarity tiers roughly follow 55/27/12/5/0.9', () => {
    const w = fresh(5);
    const c: Record<string, number> = {};
    for (let i = 0; i < 20_000; i++) { const m = w.rollKind(T0 + 10 * MIN); c[m.rarity] = (c[m.rarity] ?? 0) + 1; }
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
    const u = give(w, 'ashpup', 9);
    expect(w.evoOptions(w.get(u)!, T0).every(o => !o.ready)).toBe(true);
    w.get(u)!.lv = 10;
    expect(w.evolve(u, 'gleck', T0).ok).toBe(true);
    expect(w.get(u)!.sp).toBe('gleck');
    expect(w.s.caught.gleck).toBe(true);
  });

  it('item evolutions use up the item; branch evolutions let you pick', () => {
    const w = fresh();
    const u = give(w, 'klyx', 18);
    expect(w.evolve(u, 'klyxen', T0).ok).toBe(false);
    w.s.items.moon = 1;
    expect(w.evolve(u, 'klyxen', T0).ok).toBe(true);
    expect(w.count('moon')).toBe(0);
    expect(w.get(u)!.sp).toBe('klyxen');
  });

  it('night evolutions only work at night', () => {
    const w = fresh();
    const u = give(w, 'vesperid', 16);
    let day = T0; while (isNight(day)) day += MIN;
    let night = T0; while (!isNight(night)) night += MIN;
    expect(w.evolve(u, 'vesperax', day).ok).toBe(false);
    expect(w.evolve(u, 'vesperax', night).ok).toBe(true);
  });

  it('graft gives xp and can raise stars (keeps the better stars)', () => {
    const w = fresh();
    const a = give(w, 'ashpup', 3, 2); give(w, 'ashpup', 4, 4);
    expect(w.graft(a).ok).toBe(true);
    expect(w.get(a)!.stars).toBe(4);
    expect(w.get(a)!.lv).toBeGreaterThan(3);
    expect(w.s.bag.length).toBe(1);
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
    const f = give(w, 'draug', 20, 5);
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
      const u = give(w, 'velm', lv); const guess = w.wouldWin(u, r);
      w.startFight(u, r); w.advance(120_000, T0);
      expect(w.s.stats.wins > 0).toBe(guess); w.s.stats.wins = 0; w.s.stats.losses = 0;
    }
  });
});

describe('saves', () => {
  it('0.1 saves carry over: Greebles come as 3★ and get starter snares', () => {
    const old = { scrap: 120, bag: [{ u: 'g1', sp: 'draug', lv: 12, xp: 5 }, { u: 'g2', sp: 'nulith', lv: 3, xp: 0 }, { u: 'g3', sp: 'gone', lv: 1 }],
      camp: ['g2', null, null, null], huntAt: 0, campCarry: 0, fight: null, seen: { draug: true }, stats: { caught: 2 }, lastSeen: T0, tips: { walk: true } };
    const s = migrate(old, T0);
    expect(s.version).toBe(3);
    expect(s.region).toBe('ash'); expect(s.unlocked).toBe(1);
    expect(s.bag.map(g => g.sp)).toEqual(['draug', 'nulith']);
    expect(s.bag[0].stars).toBe(3);
    expect(s.camp[0]).toBe('g2');
    expect(s.items.snare).toBeGreaterThanOrEqual(20);
    expect(s.caught.draug && s.caught.nulith).toBe(true);
    expect(s.spawns.length).toBeGreaterThan(0);
  });

  it('round-trips through JSON', () => {
    const w = fresh(); give(w, 'nulith', 4); w.updateWilds(T0 + HOUR);
    const back = migrate(JSON.parse(JSON.stringify(w.s)), T0 + HOUR);
    expect(back.bag).toEqual(w.s.bag);
    expect(back.spawns).toEqual(w.s.spawns);
    expect(back.items).toEqual(w.s.items);
  });

  it('cleans up junk without crashing', () => {
    const s = migrate({ version: 2, bag: [{ u: 'g1', sp: 'nope' }, { u: 'g2', sp: 'velm', lv: 99, stars: 9 }, null], camp: ['g1', 'g2', 'g2'], scrap: 'lots',
      items: { snare: -4, good: 'x', beacon: 2 }, spawns: [{ id: 'w1', sp: 'zzz' }], enc: { spawn: 'w9' } }, T0);
    expect(s.bag.map(g => g.u)).toEqual(['g2']);
    expect(s.bag[0].lv).toBe(RULES.maxLevel); expect(s.bag[0].stars).toBe(5);
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
    const w = fresh(); w.s.unlocked = 4; w.travel('glass');
    for (let i = 0; i < 200; i++) { const x = w.addSpawn(T0, 'wild'); expect(REGIONS[3].kinds).toContain(x.sp); expect(x.lv).toBeGreaterThan(REGIONS[3].lvl); expect(x.reg).toBe('glass'); }
    expect(w.here.every(x => x.reg === 'glass')).toBe(true);
  });

  it('locked areas cannot be visited', () => {
    const w = fresh();
    expect(w.travel('tide').ok).toBe(false);
    expect(w.s.region).toBe('ash');
  });

  it('a team beats the first boss: opens the next area, calls out the Legendary, then rests 2 h', () => {
    const w = fresh();
    const team = [give(w, 'draugoth', 25, 4), give(w, 'velmor', 20, 4), give(w, 'gleckor', 25, 3)];
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
    const u = give(w, 'scrappling', 1);
    expect(w.wouldWin([u], 'boss', 'boss')).toBe(false);
    w.startFight([u], 'boss', 'boss'); w.advance(300_000, T0);
    expect(w.s.unlocked).toBe(1); expect(w.get(u)).toBeDefined();
  });

  it('team win-check matches the real boss fight (within a little luck)', () => {
    let agree = 0, total = 0;
    for (const lv of [5, 10, 15, 20, 25, 30]) {
      const w = fresh(lv);
      const team = [give(w, 'draug', lv, 3), give(w, 'velm', lv, 3), give(w, 'skarnox', lv, 3)];
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
    const u = give(w, 'gleck', 10); const before = w.yieldOf(w.get(u)!);
    w.buyUpgrade('bench'); expect(w.yieldOf(w.get(u)!)).toBeGreaterThan(before);
    w.buyUpgrade('away'); expect(w.offlineCap).toBe(RULES.offlineCapMs + 4 * HOUR);
    w.buyUpgrade('press'); const sn = w.count('snare'); w.advance(HOUR, T0); expect(w.count('snare')).toBe(sn + 2);
    for (let i = 0; i < 10; i++) w.buyUpgrade('tent');
    expect(w.s.camp.length).toBeLessThanOrEqual(RULES.maxCampSlots);
  });

  it('0.2 saves (single-Greeble fight, no areas) carry over', () => {
    const old = { version: 2, bag: [{ u: 'g1', sp: 'draug', lv: 12, xp: 0, stars: 2, prism: false }], camp: [null, null, null, null],
      fight: { u: 'g1', robot: 'drone', hp: 30, maxHp: 40, robotHp: 5, robotMax: 16, carry: 0, wreck: false },
      spawns: [{ id: 'w9', sp: 'ashpup', lv: 2, stars: 1, prism: false, src: 'wild', at: T0, until: T0 + HOUR, x: .5, y: .5 }], items: { snare: 5 } };
    const s = migrate(old, T0);
    expect(s.fight?.team[0].u).toBe('g1'); expect(s.fight?.kind).toBe('patrol');
    expect(s.spawns[0].reg).toBe('ash');
    const w = new World(s); w.advance(5000, T0);
    expect(w.s.fight).toBeNull(); expect(w.s.stats.wins).toBe(1);
  });
});
