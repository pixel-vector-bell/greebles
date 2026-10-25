import { CATCH, RULES, WEIGHT, WILD_MORPHS, BASE_POWER, SELL, hasMorph, morph, robot, xpNeed, type Morph } from './content';
import { nextRandom } from './rng';

export const SAVE_VERSION = 1;

export interface Greeble { u: string; sp: string; lv: number; xp: number; }

export interface Fight {
  u: string;          // which Greeble is fighting
  robot: string;
  hp: number; maxHp: number;
  robotHp: number;
  carry: number;      // ms toward the next round
}

export interface Stats {
  walks: number; caught: number; sold: number; grafts: number; evolved: number;
  wins: number; losses: number; scrapEarned: number;
}

export interface GameState {
  version: number;
  rng: number;
  nextId: number;
  scrap: number;
  bag: Greeble[];
  camp: (string | null)[];
  /** Real time (ms) when the next walk is allowed. */
  huntAt: number;
  /** ms toward the next camp payout. */
  campCarry: number;
  fight: Fight | null;
  /** Morphs the player has ever owned (the field guide). */
  seen: Record<string, true>;
  stats: Stats;
  lastSeen: number;
  /** Tutorial tips already shown. */
  tips: Record<string, true>;
}

export function newGame(seed = (Math.random() * 2 ** 31) | 0, now = Date.now()): GameState {
  return {
    version: SAVE_VERSION, rng: seed, nextId: 1, scrap: RULES.startScrap,
    bag: [], camp: Array(RULES.campSlots).fill(null), huntAt: 0, campCarry: 0, fight: null,
    seen: {}, stats: { walks: 0, caught: 0, sold: 0, grafts: 0, evolved: 0, wins: 0, losses: 0, scrapEarned: 0 },
    lastSeen: now, tips: {},
  };
}

export type GameEvent =
  | { t: 'walkEmpty' }
  | { t: 'walkFled'; sp: string }
  | { t: 'walkBagFull'; sp: string }
  | { t: 'caught'; sp: string; first: boolean }
  | { t: 'sold'; sp: string; scrap: number }
  | { t: 'grafted'; sp: string; lv: number }
  | { t: 'evolved'; from: string; to: string }
  | { t: 'level'; u: string; lv: number }
  | { t: 'fightWon'; sp: string; robot: string; scrap: number }
  | { t: 'fightLost'; sp: string; robot: string };

export type ActionResult = { ok: true } | { ok: false; why: string };

export class World {
  s: GameState;
  private events: GameEvent[] = [];

  constructor(state: GameState | null) {
    this.s = state ?? newGame();
  }

  drain(): GameEvent[] { const e = this.events; this.events = []; return e; }
  private emit(e: GameEvent) { this.events.push(e); }
  private rand() { return nextRandom(this.s); }

  // ── lookups ───────────────────────────────────────────────
  get(u: string) { return this.s.bag.find(g => g.u === u); }
  inCamp(u: string) { return this.s.camp.includes(u); }
  power(g: Greeble) { const m = morph(g.sp); return BASE_POWER[m.rarity] + g.lv + (m.role === 'fight' ? 2 : 0); }
  fighterHp(g: Greeble) { return 10 + this.power(g) * 2; }
  yieldOf(g: Greeble) { const m = morph(g.sp); return 1 + Math.floor(g.lv / 4) + (m.role === 'fight' ? 1 : 0); }
  sellValue(g: Greeble) { return SELL[morph(g.sp).rarity] * g.lv; }
  /** Scrap per camp payout (every 15 s) from everyone working right now. */
  get campYield() { return this.s.camp.reduce((n, u) => { const g = u ? this.get(u) : undefined; return n + (g ? this.yieldOf(g) : 0); }, 0); }
  huntLeft(now: number) { return Math.max(0, this.s.huntAt - now); }
  huntReady(now: number) { return now >= this.s.huntAt; }
  /** Another copy of the same morph that can be fed into `u` (in the bag, not camping, not fighting). */
  graftPartner(u: string) {
    const g = this.get(u); if (!g) return undefined;
    return this.s.bag.find(x => x.u !== u && x.sp === g.sp && !this.inCamp(x.u) && this.s.fight?.u !== x.u);
  }

  /** Add xp, level up, and grow into the next form once it reaches its grow level. Returns true if it grew. */
  private addXp(g: Greeble, xp: number): boolean {
    g.xp += xp;
    while (g.lv < RULES.maxLevel && g.xp >= xpNeed(g.lv)) { g.xp -= xpNeed(g.lv); g.lv++; this.emit({ t: 'level', u: g.u, lv: g.lv }); }
    if (g.lv >= RULES.maxLevel) g.xp = 0;
    const m = morph(g.sp);
    if (m.evo && m.evoLv && g.lv >= m.evoLv) {
      g.sp = m.evo;
      this.s.seen[m.evo] = true;
      this.s.stats.evolved++;
      this.emit({ t: 'evolved', from: m.id, to: m.evo });
      return true;
    }
    return false;
  }

  /** Would this Greeble win against this robot? (Same rules as a real fight, run on a copy.) */
  wouldWin(g: Greeble, robotId: string): boolean {
    const r = robot(robotId); if (!r) return false;
    const pow = Math.max(1, this.power(g)), hurt = Math.max(1, r.atk - Math.floor(g.lv / 5));
    let hp = this.fighterHp(g), rhp = r.hp;
    for (;;) { rhp -= pow; if (rhp <= 0) return true; hp -= hurt; if (hp <= 0) return false; }
  }
  private earn(n: number) { this.s.scrap += n; this.s.stats.scrapEarned += n; }

  // ── actions ───────────────────────────────────────────────
  private rollMorph(): Morph {
    let total = 0;
    for (const m of WILD_MORPHS) total += WEIGHT[m.rarity];
    let r = this.rand() * total;
    for (const m of WILD_MORPHS) { r -= WEIGHT[m.rarity]; if (r < 0) return m; }
    return WILD_MORPHS[WILD_MORPHS.length - 1];
  }

  /** Walk the planet. Starts the cooldown whatever happens. */
  walk(now: number): ActionResult {
    if (!this.huntReady(now)) return { ok: false, why: 'Still resting.' };
    this.s.huntAt = now + RULES.huntMs;
    this.s.stats.walks++;
    if (this.rand() < RULES.emptyWalk) { this.emit({ t: 'walkEmpty' }); return { ok: true }; }
    const m = this.rollMorph();
    if (this.rand() > CATCH[m.rarity]) { this.emit({ t: 'walkFled', sp: m.id }); return { ok: true }; }
    if (this.s.bag.length >= RULES.bagMax) { this.emit({ t: 'walkBagFull', sp: m.id }); return { ok: true }; }
    const first = !this.s.seen[m.id];
    this.s.bag.push({ u: `g${this.s.nextId++}`, sp: m.id, lv: 1, xp: 0 });
    this.s.seen[m.id] = true;
    this.s.stats.caught++;
    this.emit({ t: 'caught', sp: m.id, first });
    return { ok: true };
  }

  sell(u: string): ActionResult {
    const g = this.get(u); if (!g) return { ok: false, why: 'Not in the bag.' };
    if (this.s.fight?.u === u) return { ok: false, why: 'It is fighting right now.' };
    const scrap = this.sellValue(g);
    this.s.camp = this.s.camp.map(x => (x === u ? null : x));
    this.s.bag = this.s.bag.filter(x => x.u !== u);
    this.earn(scrap);
    this.s.stats.sold++;
    this.emit({ t: 'sold', sp: g.sp, scrap });
    return { ok: true };
  }

  /** Feed a second copy of the same morph into this one: big xp, and evolve at the evo level. */
  graft(u: string): ActionResult {
    const g = this.get(u); if (!g) return { ok: false, why: 'Not in the bag.' };
    const other = this.graftPartner(u);
    if (!other) return { ok: false, why: `Need another ${morph(g.sp).name} in the bag (not camping).` };
    this.s.bag = this.s.bag.filter(x => x.u !== other.u);
    this.s.stats.grafts++;
    if (!this.addXp(g, 40 + other.lv * 15)) this.emit({ t: 'grafted', sp: g.sp, lv: g.lv });
    return { ok: true };
  }

  /** Put a Greeble in a camp slot (first empty one if no slot is given). */
  assign(u: string, slot?: number): ActionResult {
    if (!this.get(u)) return { ok: false, why: 'Not in the bag.' };
    if (this.s.fight?.u === u) return { ok: false, why: 'It is fighting right now.' };
    const i = slot ?? this.s.camp.findIndex(x => !x);
    if (i < 0 || i >= RULES.campSlots) return { ok: false, why: 'Camp is full.' };
    this.s.camp = this.s.camp.map(x => (x === u ? null : x));
    this.s.camp[i] = u;
    return { ok: true };
  }

  bench(slot: number): ActionResult {
    if (slot < 0 || slot >= RULES.campSlots) return { ok: false, why: 'No such camp.' };
    this.s.camp[slot] = null;
    return { ok: true };
  }

  startFight(u: string, robotId: string): ActionResult {
    const g = this.get(u), r = robot(robotId);
    if (!g || !r) return { ok: false, why: 'Pick a Greeble and a robot.' };
    if (this.s.fight) return { ok: false, why: 'A fight is already on.' };
    if (morph(g.sp).role !== 'fight') return { ok: false, why: 'Only Skirmish Greebles fight robots.' };
    if (this.inCamp(u)) return { ok: false, why: 'Bench it from camp first.' };
    const hp = this.fighterHp(g);
    this.s.fight = { u, robot: r.id, hp, maxHp: hp, robotHp: r.hp, carry: 0 };
    return { ok: true };
  }

  private fightRound() {
    const f = this.s.fight!; const g = this.get(f.u); const r = robot(f.robot);
    if (!g || !r) { this.s.fight = null; return; }
    f.robotHp -= Math.max(1, this.power(g));
    if (f.robotHp <= 0) {
      this.addXp(g, r.xp + 8);
      const scrap = 4 + g.lv;
      this.earn(scrap);
      this.s.stats.wins++;
      this.s.fight = null;
      this.emit({ t: 'fightWon', sp: g.sp, robot: r.id, scrap });
      return;
    }
    f.hp -= Math.max(1, r.atk - Math.floor(g.lv / 5));
    if (f.hp <= 0) {
      this.s.stats.losses++;
      this.s.fight = null;
      this.emit({ t: 'fightLost', sp: g.sp, robot: r.id });
    }
  }

  private campPayout() {
    for (const u of this.s.camp) {
      const g = u ? this.get(u) : undefined; if (!g) continue;
      this.earn(this.yieldOf(g));
      this.addXp(g, RULES.campXp);
    }
  }

  /** Move the world forward by real elapsed ms (camp payouts + fight rounds). */
  advance(ms: number) {
    if (!(ms > 0)) return;
    this.s.campCarry += ms;
    while (this.s.campCarry >= RULES.campTickMs) { this.s.campCarry -= RULES.campTickMs; this.campPayout(); }
    let f = this.s.fight;
    if (f) {
      f.carry += ms;
      while (f && f.carry >= RULES.fightTickMs) { f.carry -= RULES.fightTickMs; this.fightRound(); f = this.s.fight; }
    }
  }

  /** Offline catch-up: same rules, capped. Returns what was earned for the welcome-back card. */
  catchUp(ms: number): { ms: number; scrap: number; levels: number } {
    const capped = Math.min(Math.max(0, ms), RULES.offlineCapMs);
    const before = this.s.scrap;
    this.advance(capped);
    const levels = this.drain().filter(e => e.t === 'level').length;
    return { ms: capped, scrap: this.s.scrap - before, levels };
  }
}

/** Old or hand-edited saves are cleaned up here so a bad blob can never crash the game. */
export function migrate(raw: any): GameState {
  const fresh = newGame();
  if (!raw || typeof raw !== 'object') return fresh;
  const num = (v: any, d: number) => (typeof v === 'number' && isFinite(v) ? v : d);
  const bag: Greeble[] = Array.isArray(raw.bag)
    ? raw.bag.filter((g: any) => g && typeof g.u === 'string' && hasMorph(g.sp))
        .map((g: any) => ({ u: g.u, sp: g.sp, lv: Math.min(RULES.maxLevel, Math.max(1, num(g.lv, 1) | 0)), xp: Math.max(0, num(g.xp, 0)) }))
        .slice(0, RULES.bagMax)
    : [];
  const ids = new Set(bag.map(g => g.u));
  const camp: (string | null)[] = Array(RULES.campSlots).fill(null);
  if (Array.isArray(raw.camp)) raw.camp.slice(0, RULES.campSlots).forEach((u: any, i: number) => { if (typeof u === 'string' && ids.has(u) && !camp.includes(u)) camp[i] = u; });
  let fight: Fight | null = null;
  const f = raw.fight;
  if (f && ids.has(f.u) && robot(f.robot) && !camp.includes(f.u)) {
    fight = { u: f.u, robot: f.robot, hp: num(f.hp, 1), maxHp: num(f.maxHp, 1), robotHp: num(f.robotHp, 1), carry: Math.max(0, num(f.carry, 0)) };
  }
  const seen: Record<string, true> = {};
  for (const k of Object.keys(raw.seen ?? {})) if (hasMorph(k)) seen[k] = true;
  for (const g of bag) seen[g.sp] = true;
  // keep generated ids unique even if nextId was lost
  const maxId = bag.reduce((n, g) => Math.max(n, parseInt(g.u.replace(/\D/g, ''), 10) || 0), 0);
  return {
    version: SAVE_VERSION,
    rng: num(raw.rng, fresh.rng) | 0,
    nextId: Math.max(num(raw.nextId, 1), maxId + 1),
    scrap: Math.max(0, num(raw.scrap, RULES.startScrap)),
    bag, camp, fight, seen,
    huntAt: num(raw.huntAt, 0),
    campCarry: Math.min(RULES.campTickMs, Math.max(0, num(raw.campCarry, 0))),
    stats: { ...fresh.stats, ...Object.fromEntries(Object.entries(raw.stats ?? {}).filter(([k, v]) => k in fresh.stats && typeof v === 'number')) },
    lastSeen: num(raw.lastSeen, Date.now()),
    tips: { ...(raw.tips && typeof raw.tips === 'object' ? raw.tips : {}) },
  };
}

