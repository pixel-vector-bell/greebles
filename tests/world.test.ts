import { describe, expect, it } from 'vitest';
import { World, newGame, migrate } from '../src/sim/world';
import { ELEMENTS, FAMILIES, MORPHS, RECIPES, REGIONS, RULES, SPAWNABLE, STRONG, craterAt, elementOf, isNight, morph, stormAt, typeMult } from '../src/sim/content';

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
    expect(s.version).toBe(5);
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
    const u = give(w, 'gleck', 20, 4);
    expect(w.startFight(u, 'drone').ok).toBe(true);
    w.advance(60_000, T0); expect(w.s.stats.wins).toBe(1);
  });

  it('a tapped move does 3x and resets the charge; untapped fires at 2x on its own', () => {
    const w = fresh();
    const u = give(w, 'draug', 5, 1);
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
    const u = give(w, 'draugoth', 25, 5);
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
    const team = [give(w, 'draugoth', 30, 5), give(w, 'velmor', 30, 5), give(w, 'skarnex', 30, 5)];
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
