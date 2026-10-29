import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { World, newGame, migrate } from '../src/sim/world';
import { REGIONS, RULES } from '../src/sim/content';

const T0 = 1_800_000_000_000;
const HOUR = 60 * 60_000;
const fresh = (seed = 7) => new World(newGame(seed, T0));
const give = (w: World, sp: string, lv = 1, stars = 1) => {
  const u = `g${w.s.nextId++}`;
  w.s.bag.push({ u, sp, lv, xp: 0, stars, prism: false, en: RULES.maxEnergy });
  return u;
};
const fighter = (w: World, sp: string, lv = 1, stars = 1) => {
  const u = give(w, sp, lv, stars);
  if (!w.s.team.includes(null)) w.s.team.push(null);
  expect(w.toTeam(u).ok).toBe(true);
  return u;
};

describe('0.14: rations, camp, stars, beacons', () => {
  it('a patrol with no rations fails, and a patrol with 1 ration spends 1 without touching energy', () => {
    const w = fresh();
    w.s.autoPatrol = false;
    const u = fighter(w, 'draug', 8, 3);
    const before = w.get(u)!.en;
    (w.s as { rations: number }).rations = 0;
    const no = w.startFight(u, 'drone');
    expect(no.ok).toBe(false);
    if (!no.ok) expect(no.why.toLowerCase()).toContain('ration');
    (w.s as { rations: number }).rations = 1;
    expect(w.startFight(u, 'drone').ok).toBe(true);
    expect((w.s as { rations: number }).rations).toBe(0);
    expect(w.get(u)!.en).toBe(before);
  });

  it('auto-patrol stops at 3 rations and keeps fighting offline while a Trawler is in camp', () => {
    const w = fresh();
    const a = fighter(w, 'draug', 10, 3);
    const dig = give(w, 'tidling', 1, 1);
    expect(w.assign(dig).ok).toBe(true);
    (w.s as { rations: number }).rations = 12;
    w.catchUp(8 * HOUR, T0 + 8 * HOUR);
    expect(w.s.stats.wins).toBeGreaterThan(10);
    expect((w.s as { rations: number }).rations).toBeGreaterThanOrEqual(3);
    expect(w.get(a)!.lv).toBeGreaterThan(1);
  });

  it('a camper is short of level 10 after 24 hours and past it after 60', () => {
    const w = fresh();
    w.s.autoPatrol = false;
    const u = give(w, 'ashpup', 1, 1);
    w.assign(u);
    w.advance(24 * HOUR, T0);
    expect(w.get(u)!.lv).toBeLessThan(10);
    w.advance(36 * HOUR, T0);
    expect(w.get(u)!.lv).toBeGreaterThanOrEqual(10);
  });

  it('a 5-star is 16% stronger than a 1-star, and Prismatic stays 1.2×', () => {
    const w = fresh();
    const one = w.quality({ stars: 1, prism: false });
    const five = w.quality({ stars: 5, prism: false });
    const prism = w.quality({ stars: 5, prism: true });
    expect(five / one).toBeCloseTo(1.16, 5);
    expect(prism / five).toBeCloseTo(1.2, 5);
  });

  it('sending a Greeble home pays 4 candy', () => {
    const w = fresh();
    const u = give(w, 'ashpup', 1, 1);
    expect(w.sell(u).ok).toBe(true);
    expect(w.s.candy.ashpup).toBe(4);
  });

  it('a stage-1 Digger makes no beacon charge in 2 hours and 1 charge in 3 hours, capped at 3', () => {
    const w = fresh();
    w.s.autoPatrol = false;
    (w.s as { beaconCharges: number }).beaconCharges = 0;
    const u = give(w, 'ashpup', 1, 1);
    w.assign(u);
    w.advance(2 * HOUR, T0);
    expect((w.s as { beaconCharges: number }).beaconCharges ?? 0).toBe(0);
    w.advance(1 * HOUR, T0);
    expect((w.s as { beaconCharges: number }).beaconCharges).toBe(1);
    (w.s as { beaconCharges: number }).beaconCharges = 3;
    w.advance(12 * HOUR, T0);
    expect((w.s as { beaconCharges: number }).beaconCharges).toBe(3);
    expect(w.useBeacon(T0).ok).toBe(true);
    expect(w.s.beaconUntil).toBeGreaterThan(T0);
  });

  it('a v9 save keeps its bag and gets 8 rations, with no wipe notice', () => {
    const raw = {
      version: 9,
      bag: [{ u: 'g1', sp: 'ashpup', lv: 4, xp: 0, stars: 2, prism: false, en: 7 }, { u: 'g2', sp: 'draug', lv: 6, xp: 0, stars: 3, prism: false, en: 10 }],
      team: ['g2', null, null],
      stats: { caught: 2 },
    };
    const m = migrate(raw, T0);
    expect(m.bag.map(g => g.u).sort()).toEqual(['g1', 'g2']);
    expect(m.newRules).toBeUndefined();
    expect((m as { rations: number }).rations).toBe(8);
  });

  it('Ash spawns stay Ash kinds (no weekly swarm injection)', () => {
    const w = fresh(3);
    const allowed = new Set(REGIONS[0].kinds);
    for (let i = 0; i < 2000; i++) expect(allowed.has(w.rollKind(T0).id)).toBe(true);
  });

  it('player-facing copy does not say the ship crashed', () => {
    const text = readFileSync('src/ui/Intro.tsx', 'utf8') + '\n' + readFileSync('src/sim/content.ts', 'utf8');
    expect(text.toLowerCase()).not.toContain('crashed');
    expect(text.toLowerCase()).not.toContain('fix your ship');
  });
});
