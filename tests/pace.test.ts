import { describe, expect, it } from 'vitest';
import { runBot } from './bot';

/**
 * 0.13 pace targets (Josh, 2026-10-26). A simple test player opens the game 6 times a day for 15 minutes,
 * leaves it closed in between and overnight, and plays sensibly (see tests/bot.ts).
 * Windows are loose on purpose: the test player is much dumber than a real one.
 */
describe('0.13 pace (30 days of a pretend player)', () => {
  for (const seed of [11, 5, 23, 42]) it(`seed ${seed}: bosses, evolving and upgrades land in their windows`, () => {
    const { log } = runBot(30, seed);
    const b = log.boss;
    expect(b.ash).toBeLessThanOrEqual(2);                       // Ash boss: day 1
    expect(log.firstEvolve!).toBeLessThanOrEqual(3);            // first evolve: day 1-2
    expect(b.tide).toBeGreaterThanOrEqual(1); expect(b.tide).toBeLessThanOrEqual(5);     // Tide boss: about day 3
    expect(b.rust).toBeGreaterThanOrEqual(4); expect(b.rust).toBeLessThanOrEqual(12);    // Rust boss: about day 7
    expect(b.glass).toBeGreaterThanOrEqual(9); expect(b.glass).toBeLessThanOrEqual(20);  // Glass boss: about day 14
    if (b.void !== undefined) expect(b.void).toBeGreaterThanOrEqual(14);                 // Void boss: about day 21
    expect(log.allUpgrades!).toBeGreaterThanOrEqual(12); expect(log.allUpgrades!).toBeLessThanOrEqual(24);  // 2-3 weeks
    // and nothing is close to maxed on day 2 (Josh's 0.12 save had a level 30 then)
    expect(log.nightly[1][1]).toBeLessThanOrEqual(22);
    expect(log.nightly[1][4]).toBeLessThanOrEqual(12);
  }, 120_000);
});
