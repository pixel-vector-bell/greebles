import {
  BASE_POWER, CATCH_BASE, EVO_ITEMS, FLEE, ITEMS, MORPHS, REWARDS, RARITIES, ROBOTS, RULES, SELL, SNARE_MULT, SPAWNABLE,
  STAR_WEIGHTS, START_ITEMS, THROW_MULT, TIER_WEIGHT, TREAT_MULT, WILD_MAX_LV,
  craterAt, hasMorph, isNight, morph, robot, stormAt, xpNeed,
  type Evo, type ItemId, type Morph, type Rarity, type Role, type SnareId,
} from './content';
import { nextRandom } from './rng';

export const SAVE_VERSION = 2;

export interface Greeble { u: string; sp: string; lv: number; xp: number; stars: number; prism: boolean; caughtAt?: number }
export type SpawnSrc = 'wild' | 'crater' | 'beacon' | 'wreck' | 'mythic';
export interface Spawn { id: string; sp: string; lv: number; stars: number; prism: boolean; src: SpawnSrc; at: number; until: number; x: number; y: number }
export interface Encounter { spawn: string; treat: boolean; throws: number }
export interface Fight { u: string; robot: string; hp: number; maxHp: number; robotHp: number; robotMax: number; carry: number; wreck: boolean }
export interface Wreck { robot: string; until: number }

export interface Stats {
  caught: number; thrown: number; fled: number; prisms: number; sold: number; grafts: number; evolved: number;
  wins: number; losses: number; wrecks: number; scrapEarned: number; perfects: number;
}

export interface GameState {
  version: number;
  rng: number;
  nextId: number;
  scrap: number;
  bag: Greeble[];
  bagMax: number;
  camp: (string | null)[];
  campCarry: number;
  fight: Fight | null;
  items: Partial<Record<ItemId, number>>;
  // the wilds
  spawns: Spawn[];
  wildClock: number;          // real time the wilds were last simulated to
  nextAmbientAt: number;
  nextCraterAt: number;
  nextBeaconAt: number;
  beaconUntil: number;
  wreck: Wreck | null;
  nextWreckAt: number;
  enc: Encounter | null;
  /** Kinds met in the wilds (or owned). */
  seen: Record<string, true>;
  /** Kinds ever owned. */
  caught: Record<string, true>;
  prismCaught: Record<string, true>;
  claimed: Record<string, true>;
  stats: Stats;
  lastSeen: number;
  tips: Record<string, true>;
}

const freshStats = (): Stats => ({ caught: 0, thrown: 0, fled: 0, prisms: 0, sold: 0, grafts: 0, evolved: 0, wins: 0, losses: 0, wrecks: 0, scrapEarned: 0, perfects: 0 });

export function newGame(seed = (Math.random() * 2 ** 31) | 0, now = Date.now()): GameState {
  const s: GameState = {
    version: SAVE_VERSION, rng: seed, nextId: 1, scrap: RULES.startScrap,
    bag: [], bagMax: RULES.bagMax, camp: Array(RULES.campSlots).fill(null), campCarry: 0, fight: null,
    items: { ...START_ITEMS },
    spawns: [], wildClock: now, nextAmbientAt: now + RULES.ambientMinMs, nextCraterAt: 0, nextBeaconAt: 0, beaconUntil: 0,
    wreck: null, nextWreckAt: now + RULES.wreckFirstMs, enc: null,
    seen: {}, caught: {}, prismCaught: {}, claimed: {}, stats: freshStats(), lastSeen: now, tips: {},
  };
  // A few Greebles are already out there on day one.
  const w = new World(s);
  w.addSpawn(now, 'wild', 'ashpup');
  w.addSpawn(now, 'wild', 'tidling');
  w.addSpawn(now, 'wild', 'scrappling');
  w.drain();
  return s;
}

export type GameEvent =
  | { t: 'spawn'; src: SpawnSrc; sp: string; prism: boolean }
  | { t: 'caught'; sp: string; first: boolean; prism: boolean; stars: number; scrap: number; quality: number }
  | { t: 'broke'; sp: string; quality: number }
  | { t: 'fled'; sp: string }
  | { t: 'sold'; sp: string; scrap: number }
  | { t: 'grafted'; sp: string; lv: number; stars: number; starUp: boolean }
  | { t: 'evolved'; u: string; from: string; to: string }
  | { t: 'level'; u: string; lv: number }
  | { t: 'canEvolve'; u: string; sp: string }
  | { t: 'fightWon'; sp: string; robot: string; scrap: number; loot: Partial<Record<ItemId, number>>; wreck: boolean }
  | { t: 'fightLost'; sp: string; robot: string; wreck: boolean }
  | { t: 'wreck'; robot: string }
  | { t: 'reward'; id: string; label: string }
  | { t: 'beacon' };

export type ActionResult = { ok: true } | { ok: false; why: string };
const fail = (why: string): ActionResult => ({ ok: false, why });
const OK: ActionResult = { ok: true };

const STEP = 30_000; // the wilds are simulated in 30 s steps

export class World {
  s: GameState;
  private events: GameEvent[] = [];

  constructor(state: GameState | null) { this.s = state ?? newGame(); }

  drain(): GameEvent[] { const e = this.events; this.events = []; return e; }
  private emit(e: GameEvent) { this.events.push(e); }
  private rand() { return nextRandom(this.s); }
  private between(a: number, b: number) { return a + this.rand() * (b - a); }
  private uid(prefix: string) { return `${prefix}${this.s.nextId++}`; }

  // ── lookups ───────────────────────────────────────────────
  get(u: string) { return this.s.bag.find(g => g.u === u); }
  spawn(id: string) { return this.s.spawns.find(x => x.id === id); }
  inCamp(u: string) { return this.s.camp.includes(u); }
  busy(u: string) { return this.inCamp(u) || this.s.fight?.u === u; }
  count(item: ItemId) { return this.s.items[item] ?? 0; }
  private give(item: ItemId, n: number) { this.s.items[item] = this.count(item) + n; }
  quality(g: { stars: number; prism: boolean }) { return (1 + (g.stars - 1) * 0.1) * (g.prism ? 1.2 : 1); }
  power(g: Greeble) { const m = morph(g.sp); return Math.round((BASE_POWER[m.rarity] + (m.stage - 1) * 2 + g.lv + (m.role === 'fight' ? 2 : 0)) * this.quality(g)); }
  fighterHp(g: Greeble) { return 10 + this.power(g) * 2; }
  yieldOf(g: Greeble) { const m = morph(g.sp); return Math.round((1 + Math.floor(g.lv / 4) + (m.stage - 1) + (m.role === 'fight' ? 1 : 0)) * this.quality(g) * 10) / 10; }
  sellValue(g: Greeble) { return Math.round(SELL[morph(g.sp).rarity] * g.lv * (g.prism ? 5 : 1)); }
  get campYield() { return Math.round(this.s.camp.reduce((n, u) => { const g = u ? this.get(u) : undefined; return n + (g ? this.yieldOf(g) : 0); }, 0) * 10) / 10; }
  get caughtCount() { return Object.keys(this.s.caught).length; }
  graftPartner(u: string) {
    const g = this.get(u); if (!g) return undefined;
    return this.s.bag.filter(x => x.u !== u && x.sp === g.sp && !this.busy(x.u)).sort((a, b) => a.stars - b.stars || a.lv - b.lv)[0];
  }
  /** Evolution options for this Greeble right now, with why each one is or isn't ready. */
  evoOptions(g: Greeble, now: number): { evo: Evo; ready: boolean; why: string }[] {
    return (morph(g.sp).evo ?? []).map(evo => {
      const why = g.lv < evo.lv ? `Reach level ${evo.lv}`
        : evo.item && this.count(evo.item) < 1 ? `Needs a ${ITEMS[evo.item].name}`
        : evo.night && !isNight(now) ? 'Only at night'
        : '';
      return { evo, ready: !why, why };
    });
  }

  private addXp(g: Greeble, xp: number) {
    const before = this.evoOptions(g, Date.now()).some(o => o.ready);
    g.xp += xp;
    while (g.lv < RULES.maxLevel && g.xp >= xpNeed(g.lv)) { g.xp -= xpNeed(g.lv); g.lv++; this.emit({ t: 'level', u: g.u, lv: g.lv }); }
    if (g.lv >= RULES.maxLevel) g.xp = 0;
    if (!before && (morph(g.sp).evo ?? []).some(e => g.lv >= e.lv && (!e.item || this.count(e.item) > 0) && !e.night)) this.emit({ t: 'canEvolve', u: g.u, sp: g.sp });
  }
  private earn(n: number) { this.s.scrap += n; this.s.stats.scrapEarned += n; }

  // ── the wilds ─────────────────────────────────────────────
  private rollStars() {
    let r = this.rand() * STAR_WEIGHTS.reduce((a, b) => a + b, 0);
    for (let i = 0; i < STAR_WEIGHTS.length; i++) { r -= STAR_WEIGHTS[i]; if (r < 0) return i + 1; }
    return 1;
  }
  /** Pick a kind to spawn. `role` boosts one caste (Glow Crater); `rareBoost` shifts odds up (robot wrecks). */
  rollKind(t: number, opts: { role?: Role; rareBoost?: number } = {}): Morph {
    const night = isNight(t), storm = !!stormAt(t)?.on;
    const pool = SPAWNABLE.filter(m => (!m.nightOnly || night) && m.rarity !== 'mythic');
    const perTier = new Map<Rarity, number>();
    for (const m of pool) perTier.set(m.rarity, (perTier.get(m.rarity) ?? 0) + 1);
    const weights = pool.map(m => {
      let w = TIER_WEIGHT[m.rarity] / perTier.get(m.rarity)!;
      if (opts.rareBoost && RARITIES.indexOf(m.rarity) >= 2) w *= opts.rareBoost;
      if (opts.role && m.role === opts.role) w *= 4;
      if (night && m.tags?.includes('night')) w *= 3;
      if (storm && m.tags?.includes('storm')) w *= 3;
      return w;
    });
    let r = this.rand() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r < 0) return pool[i]; }
    return pool[0];
  }
  addSpawn(t: number, src: SpawnSrc, sp?: string, life?: number, opts: { role?: Role; rareBoost?: number } = {}): Spawn {
    const m = sp ? morph(sp) : this.rollKind(t, opts);
    const lifeMs = life ?? (src === 'wild' ? RULES.ambientLifeMs : src === 'beacon' ? RULES.beaconLifeMs : src === 'wreck' ? RULES.wreckSpawnLifeMs : RULES.ambientLifeMs);
    const x: Spawn = {
      id: this.uid('w'), sp: m.id, lv: 1 + Math.floor(this.rand() * WILD_MAX_LV[m.rarity]), stars: this.rollStars(),
      prism: this.rand() < RULES.prismOdds, src, at: t, until: t + lifeMs, x: 0, y: 0,
    };
    // spread them out so tiles don't sit on top of each other (best of a few tries)
    let best = { x: 0.5, y: 0.5, d: -1 };
    for (let i = 0; i < 12; i++) {
      const p = { x: 0.12 + this.rand() * 0.76, y: 0.14 + this.rand() * 0.7 };
      const d = this.s.spawns.reduce((m, o) => Math.min(m, Math.hypot((o.x - p.x) * 1.2, o.y - p.y)), 9);
      if (d > best.d) best = { ...p, d };
      if (d > 0.22) break;
    }
    x.x = best.x; x.y = best.y;
    this.s.spawns.push(x);
    this.emit({ t: 'spawn', src, sp: x.sp, prism: x.prism });
    return x;
  }
  private countSrc(src: SpawnSrc) { return this.s.spawns.filter(x => x.src === src).length; }

  /** Bring the wilds up to real time `now`: Greebles wander in and out, hot spots switch on and off. */
  updateWilds(now: number) {
    const s = this.s;
    if (!(now > s.wildClock)) return;
    // Anything older than a few hours has wandered off anyway, so don't simulate a whole week.
    if (now - s.wildClock > RULES.wildSimMaxMs) {
      s.wildClock = now - RULES.wildSimMaxMs;
      s.nextAmbientAt = Math.max(s.nextAmbientAt, s.wildClock);
      s.nextWreckAt = Math.max(Math.min(s.nextWreckAt, s.wildClock + RULES.wreckMaxMs), s.wildClock);
    }
    for (let t = s.wildClock + STEP; t <= now; t += STEP) this.wildStep(t);
    s.wildClock = now - ((now - s.wildClock) % STEP);
    this.expire(now);
  }
  private expire(t: number) {
    const s = this.s;
    s.spawns = s.spawns.filter(x => x.until > t || s.enc?.spawn === x.id);
    if (s.wreck && s.wreck.until <= t && !(s.fight?.wreck)) s.wreck = null;
  }
  private wildStep(t: number) {
    const s = this.s;
    this.expire(t);
    if (t >= s.nextAmbientAt) {
      if (this.countSrc('wild') < RULES.ambientCap) this.addSpawn(t, 'wild');
      s.nextAmbientAt = t + this.between(RULES.ambientMinMs, RULES.ambientMaxMs);
    }
    const c = craterAt(t);
    if (c?.on) {
      if (t >= s.nextCraterAt) {
        if (this.countSrc('crater') < RULES.craterCap) this.addSpawn(t, 'crater', undefined, c.end - t + 5 * 60_000, { role: c.role });
        s.nextCraterAt = t + this.between(RULES.hotMinMs, RULES.hotMaxMs);
      }
    }
    if (t < s.beaconUntil && t >= s.nextBeaconAt) {
      if (this.countSrc('beacon') < RULES.beaconCap) this.addSpawn(t, 'beacon');
      s.nextBeaconAt = t + this.between(RULES.hotMinMs, RULES.hotMaxMs);
    }
    // The Starborn Greeble: very rarely, on a stormy night.
    if (isNight(t) && stormAt(t)?.on && !s.spawns.some(x => x.src === 'mythic') && this.rand() < 1 / 400) this.addSpawn(t, 'mythic', 'starborn', 20 * 60_000);
    if (!s.wreck && t >= s.nextWreckAt) {
      let r = this.rand() * ROBOTS.reduce((a, b) => a + b.weight, 0);
      const bot = ROBOTS.find(b => (r -= b.weight) < 0) ?? ROBOTS[0];
      s.wreck = { robot: bot.id, until: t + RULES.wreckLifeMs };
      s.nextWreckAt = t + this.between(RULES.wreckMinMs, RULES.wreckMaxMs);
      this.emit({ t: 'wreck', robot: bot.id });
    }
  }

  useBeacon(now: number): ActionResult {
    if (this.count('beacon') < 1) return fail('You have no Beacons. The shop sells them.');
    this.s.items.beacon = this.count('beacon') - 1;
    this.s.beaconUntil = Math.max(now, this.s.beaconUntil) + RULES.beaconLenMs;
    this.s.nextBeaconAt = now;
    this.emit({ t: 'beacon' });
    this.updateWilds(now + 1);
    return OK;
  }

  // ── catching ──────────────────────────────────────────────
  startEncounter(id: string): ActionResult {
    const x = this.spawn(id); if (!x) return fail('It wandered off.');
    if (this.s.enc && this.s.enc.spawn !== id) return fail('You are already trying to catch one.');
    if (this.s.bag.length >= this.s.bagMax) return fail('Your bag is full. Sell or graft some Greebles first.');
    this.s.enc = this.s.enc ?? { spawn: id, treat: false, throws: 0 };
    this.s.seen[x.sp] = true;
    return OK;
  }
  leaveEncounter(): ActionResult { this.s.enc = null; return OK; }
  useTreat(): ActionResult {
    const e = this.s.enc; if (!e) return fail('No Greeble here.');
    if (e.treat) return fail('It is already calm.');
    if (this.count('treat') < 1) return fail('You have no treats.');
    this.s.items.treat = this.count('treat') - 1;
    e.treat = true;
    return OK;
  }
  /** Chance this snare + throw catches the current Greeble. */
  catchChance(snare: SnareId, quality: number): number {
    const e = this.s.enc; const x = e && this.spawn(e.spawn); if (!x) return 0;
    if (snare === 'star') return 1;
    const m = morph(x.sp);
    const lvPenalty = 1 - Math.min(0.3, (x.lv - 1) * 0.012);
    return Math.min(0.97, CATCH_BASE[m.rarity] * SNARE_MULT[snare] * THROW_MULT[Math.max(0, Math.min(3, quality | 0))] * (e!.treat ? TREAT_MULT : 1) * lvPenalty);
  }
  /** Throw a snare. `quality` 0-3 = okay / Nice / Great / Perfect (from the throw ring). */
  throwSnare(snare: SnareId, quality: number): ActionResult {
    const s = this.s, e = s.enc; const x = e && this.spawn(e.spawn);
    if (!e || !x) { s.enc = null; return fail('It wandered off.'); }
    if (this.count(snare) < 1) return fail(`You have no ${ITEMS[snare].name}s left.`);
    if (s.bag.length >= s.bagMax) return fail('Your bag is full.');
    const q = Math.max(0, Math.min(3, quality | 0));
    const chance = this.catchChance(snare, q);
    s.items[snare] = this.count(snare) - 1;
    s.stats.thrown++; e.throws++;
    if (q === 3) s.stats.perfects++;
    e.treat = false;
    const m = morph(x.sp);
    if (this.rand() < chance) {
      const first = !s.caught[x.sp];
      s.bag.push({ u: this.uid('g'), sp: x.sp, lv: x.lv, xp: 0, stars: x.stars, prism: x.prism, caughtAt: Date.now() });
      s.caught[x.sp] = true; s.seen[x.sp] = true;
      if (x.prism) { s.prismCaught[x.sp] = true; s.stats.prisms++; }
      s.stats.caught++;
      const scrap = (3 + RARITIES.indexOf(m.rarity) * 6) * (first ? 3 : 1) + q * 2;
      this.earn(scrap);
      s.spawns = s.spawns.filter(y => y.id !== x.id);
      s.enc = null;
      this.emit({ t: 'caught', sp: x.sp, first, prism: x.prism, stars: x.stars, scrap, quality: q });
      this.checkRewards();
      return OK;
    }
    if (this.rand() < FLEE[m.rarity] + Math.max(0, e.throws - 3) * 0.05) {
      s.stats.fled++;
      s.spawns = s.spawns.filter(y => y.id !== x.id);
      s.enc = null;
      this.emit({ t: 'fled', sp: x.sp });
    } else this.emit({ t: 'broke', sp: x.sp, quality: q });
    return OK;
  }

  private checkRewards() {
    const n = this.caughtCount;
    for (const r of REWARDS) if (n >= r.need && !this.s.claimed[r.id]) {
      this.s.claimed[r.id] = true;
      for (const [k, v] of Object.entries(r.give) as [string, number][]) {
        if (k === 'bag') this.s.bagMax += v;
        else if (k === 'camp') { if (this.s.camp.length < RULES.maxCampSlots) this.s.camp.push(null); }
        else this.give(k as ItemId, v);
      }
      this.emit({ t: 'reward', id: r.id, label: r.label });
    }
  }

  // ── shop ──────────────────────────────────────────────────
  buy(item: ItemId, n = 1): ActionResult {
    const price = ITEMS[item].price;
    if (!price) return fail('Not for sale.');
    if (this.s.scrap < price * n) return fail(`Needs ${price * n} scrap.`);
    this.s.scrap -= price * n;
    this.give(item, n);
    return OK;
  }

  // ── the bag ───────────────────────────────────────────────
  sell(u: string): ActionResult {
    const g = this.get(u); if (!g) return fail('Not in the bag.');
    if (this.s.fight?.u === u) return fail('It is fighting right now.');
    const scrap = this.sellValue(g);
    this.s.camp = this.s.camp.map(x => (x === u ? null : x));
    this.s.bag = this.s.bag.filter(x => x.u !== u);
    this.earn(scrap);
    this.s.stats.sold++;
    this.emit({ t: 'sold', sp: g.sp, scrap });
    return OK;
  }

  /** Feed a duplicate in: big xp, and a chance to raise quality stars. */
  graft(u: string): ActionResult {
    const g = this.get(u); if (!g) return fail('Not in the bag.');
    const other = this.graftPartner(u);
    if (!other) return fail(`Needs another ${morph(g.sp).name} that isn't camping or fighting.`);
    this.s.bag = this.s.bag.filter(x => x.u !== other.u);
    const before = g.stars;
    if (other.stars > g.stars) g.stars = other.stars;
    else if (g.stars < 5 && this.rand() < (other.stars === g.stars ? 0.35 : 0.12)) g.stars++;
    if (other.prism && !g.prism) g.prism = true; // feeding a Prismatic in passes the shine on
    this.s.stats.grafts++;
    this.addXp(g, 40 + other.lv * 15);
    this.emit({ t: 'grafted', sp: g.sp, lv: g.lv, stars: g.stars, starUp: g.stars > before });
    return OK;
  }

  evolve(u: string, to: string, now: number): ActionResult {
    const g = this.get(u); if (!g) return fail('Not in the bag.');
    const opt = this.evoOptions(g, now).find(o => o.evo.to === to);
    if (!opt) return fail('It cannot become that.');
    if (!opt.ready) return fail(opt.why);
    if (opt.evo.item) this.s.items[opt.evo.item] = this.count(opt.evo.item) - 1;
    const from = g.sp;
    g.sp = to;
    this.s.seen[to] = true; this.s.caught[to] = true;
    if (g.prism) this.s.prismCaught[to] = true;
    this.s.stats.evolved++;
    this.emit({ t: 'evolved', u, from, to });
    this.checkRewards();
    return OK;
  }

  // ── camp ──────────────────────────────────────────────────
  assign(u: string, slot?: number): ActionResult {
    if (!this.get(u)) return fail('Not in the bag.');
    if (this.s.fight?.u === u) return fail('It is fighting right now.');
    const i = slot ?? this.s.camp.findIndex(x => !x);
    if (i < 0 || i >= this.s.camp.length) return fail('Camp is full.');
    this.s.camp = this.s.camp.map(x => (x === u ? null : x));
    this.s.camp[i] = u;
    return OK;
  }
  bench(slot: number): ActionResult {
    if (slot < 0 || slot >= this.s.camp.length) return fail('No such camp spot.');
    this.s.camp[slot] = null;
    return OK;
  }

  // ── robots ────────────────────────────────────────────────
  wouldWin(g: Greeble, robotId: string, wreck = false): boolean {
    const r = robot(robotId); if (!r) return false;
    const pow = Math.max(1, this.power(g)), hurt = Math.max(1, r.atk - Math.floor(g.lv / 5));
    let hp = this.fighterHp(g), rhp = Math.round(r.hp * (wreck ? RULES.wreckHpMult : 1));
    for (;;) { rhp -= pow; if (rhp <= 0) return true; hp -= hurt; if (hp <= 0) return false; }
  }
  startFight(u: string, robotId: string, wreck = false): ActionResult {
    const g = this.get(u), r = robot(robotId);
    if (!g || !r) return fail('Pick a Greeble and a robot.');
    if (this.s.fight) return fail('A fight is already on.');
    if (morph(g.sp).role !== 'fight') return fail('Only Skirmish Greebles fight robots.');
    if (this.inCamp(u)) return fail('Bench it from camp first.');
    if (wreck && (!this.s.wreck || this.s.wreck.robot !== robotId)) return fail('The wreck is gone.');
    const hp = this.fighterHp(g), rhp = Math.round(r.hp * (wreck ? RULES.wreckHpMult : 1));
    this.s.fight = { u, robot: r.id, hp, maxHp: hp, robotHp: rhp, robotMax: rhp, carry: 0, wreck };
    return OK;
  }
  private fightRound(now: number) {
    const f = this.s.fight!; const g = this.get(f.u); const r = robot(f.robot);
    if (!g || !r) { this.s.fight = null; return; }
    f.robotHp -= Math.max(1, this.power(g));
    if (f.robotHp <= 0) {
      this.addXp(g, Math.round((r.xp + 8) * (f.wreck ? 1.5 : 1)));
      const scrap = Math.round((4 + g.lv + ROBOTS.indexOf(r) * 6) * (f.wreck ? 2 : 1));
      this.earn(scrap);
      const loot: Partial<Record<ItemId, number>> = { snare: 2 + Math.floor(this.rand() * 3) };
      if (this.rand() < 0.25 + ROBOTS.indexOf(r) * 0.15) loot.good = 1;
      if (this.rand() < 0.03 + ROBOTS.indexOf(r) * 0.04 + (f.wreck ? 0.1 : 0)) loot[EVO_ITEMS[Math.floor(this.rand() * EVO_ITEMS.length)]] = 1;
      if (f.wreck && this.rand() < 0.5) loot.great = 1;
      for (const [k, v] of Object.entries(loot) as [ItemId, number][]) this.give(k, v);
      this.s.stats.wins++;
      const wasWreck = f.wreck;
      this.s.fight = null;
      if (wasWreck) {
        this.s.stats.wrecks++;
        this.s.wreck = null;
        for (let i = 0; i < RULES.wreckBurst; i++) this.addSpawn(now, 'wreck', undefined, RULES.wreckSpawnLifeMs, { rareBoost: 3 });
      }
      this.emit({ t: 'fightWon', sp: g.sp, robot: r.id, scrap, loot, wreck: wasWreck });
      return;
    }
    f.hp -= Math.max(1, r.atk - Math.floor(g.lv / 5));
    if (f.hp <= 0) {
      this.s.stats.losses++;
      const wasWreck = f.wreck;
      this.s.fight = null;
      this.emit({ t: 'fightLost', sp: g.sp, robot: r.id, wreck: wasWreck });
    }
  }

  private campPayout() {
    for (const u of this.s.camp) {
      const g = u ? this.get(u) : undefined; if (!g) continue;
      this.earn(this.yieldOf(g));
      this.addXp(g, RULES.campXp);
    }
  }

  /** Move camp + fights forward by `ms` (real or sped up). The wilds use real time: see updateWilds. */
  advance(ms: number, now = Date.now()) {
    if (!(ms > 0)) return;
    this.s.campCarry += ms;
    while (this.s.campCarry >= RULES.campTickMs) { this.s.campCarry -= RULES.campTickMs; this.campPayout(); }
    let f = this.s.fight;
    if (f) {
      f.carry += ms;
      while (f && f.carry >= RULES.fightTickMs) { f.carry -= RULES.fightTickMs; this.fightRound(now); f = this.s.fight; }
    }
  }

  /** Offline catch-up: camp (capped) + the wilds. Returns what happened for the welcome-back card. */
  catchUp(ms: number, now = Date.now()): { ms: number; scrap: number; levels: number; waiting: number } {
    const capped = Math.min(Math.max(0, ms), RULES.offlineCapMs);
    const before = this.s.scrap;
    this.advance(capped, now);
    this.updateWilds(now);
    const levels = this.drain().filter(e => e.t === 'level').length;
    return { ms: capped, scrap: this.s.scrap - before, levels, waiting: this.s.spawns.length };
  }
}

/** Old (0.1) or hand-edited saves are cleaned up here so a bad blob can never crash the game. */
export function migrate(raw: any, now = Date.now()): GameState {
  const fresh = newGame(undefined, now);
  if (!raw || typeof raw !== 'object') return fresh;
  const num = (v: any, d: number) => (typeof v === 'number' && isFinite(v) ? v : d);
  const bagMax = Math.max(RULES.bagMax, Math.min(500, num(raw.bagMax, RULES.bagMax) | 0));
  const bag: Greeble[] = Array.isArray(raw.bag)
    ? raw.bag.filter((g: any) => g && typeof g.u === 'string' && hasMorph(g.sp))
        .map((g: any) => ({
          u: g.u, sp: g.sp, lv: Math.min(RULES.maxLevel, Math.max(1, num(g.lv, 1) | 0)), xp: Math.max(0, num(g.xp, 0)),
          // 0.1 Greebles had no stars: they come over as 3★ (a thank-you for playing early).
          stars: Math.min(5, Math.max(1, num(g.stars, 3) | 0)), prism: g.prism === true, caughtAt: num(g.caughtAt, 0) || undefined,
        }))
        .slice(0, bagMax)
    : [];
  const ids = new Set(bag.map(g => g.u));
  const slots = Math.min(RULES.maxCampSlots, Math.max(RULES.campSlots, Array.isArray(raw.camp) ? raw.camp.length : RULES.campSlots));
  const camp: (string | null)[] = Array(slots).fill(null);
  if (Array.isArray(raw.camp)) raw.camp.slice(0, slots).forEach((u: any, i: number) => { if (typeof u === 'string' && ids.has(u) && !camp.includes(u)) camp[i] = u; });
  let fight: Fight | null = null;
  const f = raw.fight;
  if (f && ids.has(f.u) && robot(f.robot) && !camp.includes(f.u)) {
    const r = robot(f.robot)!;
    fight = { u: f.u, robot: f.robot, hp: num(f.hp, 1), maxHp: num(f.maxHp, 1), robotHp: num(f.robotHp, 1), robotMax: num(f.robotMax, r.hp), carry: Math.max(0, num(f.carry, 0)), wreck: f.wreck === true };
  }
  const known = (o: any) => { const r: Record<string, true> = {}; for (const k of Object.keys(o && typeof o === 'object' ? o : {})) if (hasMorph(k)) r[k] = true; return r; };
  const seen = known(raw.seen), caught = known(raw.caught ?? raw.seen), prismCaught = known(raw.prismCaught);
  for (const g of bag) { seen[g.sp] = true; caught[g.sp] = true; if (g.prism) prismCaught[g.sp] = true; }
  const items: Partial<Record<ItemId, number>> = {};
  for (const k of Object.keys(ITEMS) as ItemId[]) { const v = num(raw.items?.[k], NaN); if (v >= 0) items[k] = Math.floor(v); }
  const isV1 = !raw.version || raw.version < 2;
  if (isV1) for (const [k, v] of Object.entries(START_ITEMS) as [ItemId, number][]) items[k] = (items[k] ?? 0) + v;
  const spawns: Spawn[] = Array.isArray(raw.spawns)
    ? raw.spawns.filter((x: any) => x && typeof x.id === 'string' && hasMorph(x.sp) && num(x.until, 0) > 0).slice(0, 40)
        .map((x: any) => ({ id: x.id, sp: x.sp, lv: Math.max(1, num(x.lv, 1) | 0), stars: Math.min(5, Math.max(1, num(x.stars, 1) | 0)), prism: x.prism === true,
          src: (['wild', 'crater', 'beacon', 'wreck', 'mythic'].includes(x.src) ? x.src : 'wild') as SpawnSrc, at: num(x.at, now), until: num(x.until, now), x: num(x.x, 0.5), y: num(x.y, 0.5) }))
    : fresh.spawns;
  const sid = new Set(spawns.map(x => x.id));
  const enc: Encounter | null = raw.enc && sid.has(raw.enc.spawn) ? { spawn: raw.enc.spawn, treat: raw.enc.treat === true, throws: Math.max(0, num(raw.enc.throws, 0) | 0) } : null;
  const wreck: Wreck | null = raw.wreck && robot(raw.wreck.robot) ? { robot: raw.wreck.robot, until: num(raw.wreck.until, 0) } : null;
  const maxId = [...bag.map(g => g.u), ...spawns.map(x => x.id)].reduce((n, u) => Math.max(n, parseInt(u.replace(/\D/g, ''), 10) || 0), 0);
  const stats = freshStats();
  for (const [k, v] of Object.entries(raw.stats ?? {})) if (k in stats && typeof v === 'number' && isFinite(v)) (stats as any)[k] = v;
  const claimed: Record<string, true> = {};
  for (const k of Object.keys(raw.claimed ?? {})) if (REWARDS.some(r => r.id === k)) claimed[k] = true;
  const wildClock = num(raw.wildClock, now);
  return {
    version: SAVE_VERSION,
    rng: num(raw.rng, fresh.rng) | 0,
    nextId: Math.max(num(raw.nextId, 1), maxId + 1),
    scrap: Math.max(0, num(raw.scrap, RULES.startScrap)),
    bag, bagMax, camp, fight, items, spawns, enc, wreck, seen, caught, prismCaught, claimed, stats,
    campCarry: Math.min(RULES.campTickMs, Math.max(0, num(raw.campCarry, 0))),
    wildClock: Math.min(wildClock, now),
    nextAmbientAt: num(raw.nextAmbientAt, now + RULES.ambientMinMs),
    nextCraterAt: num(raw.nextCraterAt, 0), nextBeaconAt: num(raw.nextBeaconAt, 0), beaconUntil: num(raw.beaconUntil, 0),
    nextWreckAt: num(raw.nextWreckAt, now + RULES.wreckFirstMs),
    lastSeen: num(raw.lastSeen, now),
    tips: isV1 ? {} : { ...(raw.tips && typeof raw.tips === 'object' ? raw.tips : {}) },
  };
}

export const ALL_KINDS = MORPHS.length;
