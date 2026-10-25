import { describe, expect, it } from 'vitest';
import { World, newGame, migrate } from '../src/sim/world';
import { MORPHS, RULES, WILD_MORPHS, morph } from '../src/sim/content';

const fresh = (seed = 7) => new World(newGame(seed, 0));
const give = (w: World, sp: string, lv = 1) => { const u = `g${w.s.nextId++}`; w.s.bag.push({ u, sp, lv, xp: 0 }); return u; };

describe('walking the planet', () => {
  it('starts a 5 minute cooldown and refuses a second walk', () => {
    const w = fresh();
    expect(w.walk(1000).ok).toBe(true);
    expect(w.s.huntAt).toBe(1000 + RULES.huntMs);
    expect(w.walk(2000).ok).toBe(false);
    expect(w.walk(1000 + RULES.huntMs).ok).toBe(true);
  });

  it('only ever finds base forms, and over many walks finds Greebles', () => {
    const w = fresh(123);
    for (let i = 0; i < 400; i++) { w.walk(i * RULES.huntMs); if (w.s.bag.length >= RULES.bagMax) w.s.bag = []; }
    const caught = w.drain().filter(e => e.t === 'caught') as { sp: string }[];
    expect(caught.length).toBeGreaterThan(100);
    const wild = new Set(WILD_MORPHS.map(m => m.id));
    for (const c of caught) expect(wild.has(c.sp)).toBe(true);
    expect(wild.has('gleckor')).toBe(false);
  });

  it('a full bag turns the Greeble away', () => {
    const w = fresh();
    for (let i = 0; i < RULES.bagMax; i++) give(w, 'gleck');
    for (let i = 0; i < 30; i++) w.walk(i * RULES.huntMs);
    expect(w.s.bag.length).toBe(RULES.bagMax);
  });
});

describe('camp', () => {
  it('pays scrap every 15 s and only 4 can camp', () => {
    const w = fresh();
    const ids = [0, 1, 2, 3, 4].map(() => give(w, 'gleck'));
    ids.slice(0, 4).forEach(u => expect(w.assign(u).ok).toBe(true));
    expect(w.assign(ids[4]).ok).toBe(false);
    const before = w.s.scrap;
    w.advance(RULES.campTickMs * 2);
    expect(w.s.scrap - before).toBe(4 * 2 * 1);
  });

  it('offline catch-up is capped at 8 hours', () => {
    const w = fresh();
    w.assign(give(w, 'gleck', 1));
    const r = w.catchUp(100 * 60 * 60 * 1000);
    expect(r.ms).toBe(RULES.offlineCapMs);
    expect(r.scrap).toBeGreaterThan(0);
  });
});

describe('graft and sell', () => {
  it('graft needs a second copy that is not camping', () => {
    const w = fresh();
    const a = give(w, 'gleck'); const b = give(w, 'gleck');
    w.assign(b);
    expect(w.graft(a).ok).toBe(false);
    w.bench(0);
    expect(w.graft(a).ok).toBe(true);
    expect(w.s.bag.length).toBe(1);
    expect(w.get(a)!.lv).toBeGreaterThan(1);
  });

  it('an Ash Greeble grows into a Hulking Ash at level 10', () => {
    const w = fresh();
    const a = give(w, 'gleck', 9); give(w, 'gleck', 7); // 40 + 7*15 = 145 xp >= 128 needed at lv 9
    w.graft(a);
    expect(w.get(a)!.sp).toBe('gleckor');
    expect(w.s.seen.gleckor).toBe(true);
  });

  it('a camper that levels up past its grow level grows too (not only by grafting)', () => {
    const w = fresh();
    const a = give(w, 'draug', 9); w.get(a)!.xp = 127; w.assign(a);
    w.advance(RULES.campTickMs);
    expect(w.get(a)!.lv).toBe(10);
    expect(w.get(a)!.sp).toBe('draugoth');
  });

  it('selling pays by rarity times level and frees the camp slot', () => {
    const w = fresh();
    const a = give(w, 'phaest', 3); w.assign(a);
    const before = w.s.scrap;
    expect(w.sell(a).ok).toBe(true);
    expect(w.s.scrap - before).toBe(28 * 3);
    expect(w.s.camp.includes(a)).toBe(false);
  });
});

describe('robots', () => {
  it('only Skirmish Greebles fight, and a strong one breaks a drone', () => {
    const w = fresh();
    expect(w.startFight(give(w, 'gleck'), 'drone').ok).toBe(false);
    const f = give(w, 'draug', 10);
    expect(w.startFight(f, 'drone').ok).toBe(true);
    w.advance(30_000);
    expect(w.s.fight).toBeNull();
    expect(w.s.stats.wins).toBe(1);
  });

  it('the win check matches a real fight', () => {
    const w = fresh();
    for (const lv of [1, 3, 6, 10, 20]) for (const r of ['drone', 'pylon', 'colossus']) {
      const u = give(w, 'velm', lv); const guess = w.wouldWin(w.get(u)!, r);
      w.startFight(u, r); w.advance(120_000);
      expect(w.s.stats.wins > 0).toBe(guess); w.s.stats.wins = 0; w.s.stats.losses = 0;
    }
  });

  it('a level 1 Scrap Greeble loses to a colossus', () => {
    const w = fresh();
    const f = give(w, 'draug', 1);
    w.startFight(f, 'colossus');
    w.advance(60_000);
    expect(w.s.stats.losses).toBe(1);
    expect(w.get(f)).toBeDefined(); // losing never deletes your Greeble
  });
});

describe('saves', () => {
  it('round-trips through JSON', () => {
    const w = fresh();
    const a = give(w, 'nulith', 4); w.assign(a); w.walk(0);
    const back = migrate(JSON.parse(JSON.stringify(w.s)));
    expect(back.bag).toEqual(w.s.bag);
    expect(back.camp).toEqual(w.s.camp);
    expect(back.huntAt).toBe(w.s.huntAt);
  });

  it('cleans up junk without crashing', () => {
    const s = migrate({ bag: [{ u: 'g1', sp: 'nope' }, { u: 'g2', sp: 'velm', lv: 99 }, null], camp: ['g1', 'g2', 'g2', 'zzz', 'x'], scrap: 'lots', fight: { u: 'gone', robot: 'drone' } });
    expect(s.bag.map(g => g.u)).toEqual(['g2']);
    expect(s.bag[0].lv).toBe(RULES.maxLevel);
    expect(s.camp).toEqual([null, 'g2', null, null]);
    expect(s.fight).toBeNull();
    expect(s.scrap).toBe(RULES.startScrap);
    expect(s.nextId).toBeGreaterThan(2);
    expect(migrate(null).bag).toEqual([]);
  });

  it('every evolution target exists', () => {
    for (const m of MORPHS) if (m.evo) expect(morph(m.evo).role).toBe(m.role);
  });
});
