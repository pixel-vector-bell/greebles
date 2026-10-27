import {
  BASE_POWER, CATCH_BASE, EVO_ITEMS, FLEE, ITEMS, MORPHS, REWARDS, RARITIES, ROBOTS, RULES, SELL, SNARE_MULT, SPAWNABLE,
  STAR_WEIGHTS, START_ITEMS, THROW_MULT, TIER_WEIGHT, TREAT_MULT, WILD_MAX_LV,
  craterAt, hash32, hasMorph, isNight, morph, robot, stormAt, xpNeed,
  REGIONS, BOSS_REMATCH_MS, TEAM_MAX, UPGRADES, PRESS_MS_PER_SNARE, region, regionIndex, robotIn,
  JOB, FAVOR_MULT, LURES, LURE_MS, LURE_SPAWN_MIN, LURE_SPAWN_MAX, type LureId,
  HUNTS, HUNT_SPAWN_MS, type Hunt, NEST_MS, EGG_MAX, HATCH_MS, EGG_PRISM_MULT, TASK_POOL, DAILY_COUNT, ELEMENTS, familyRoot, SHIP_PARTS, PERKS, perkCost, SIGNAL_STEP, EXPEDITION_MS, DAY_MS, WEEK_MS, SWARM_MULT, type PartId, type PerkId,
  RECIPES, MOVE_AUTO, MOVE_AUTO_MULT, MOVE_CHARGE, MOVE_TAP_MULT, elementOf, typeMult, type Element,
  LEVEL_CAPS, XP_BANK_LEVELS, AUTO_RESERVE, WILD_UNDER_CAP, ENERGY_COST, CANDY, evoCandy, CAMP_SCRAP_MULT, PATROL_SCRAP_MULT,
  type Evo, type ItemId, type Morph, type Rarity, type RegionId, type Role, type SnareId, type UpgradeId,
} from './content';
import { nextRandom } from './rng';

export const SAVE_VERSION = 9;

/** `en` = energy (0 to RULES.maxEnergy, can be fractional while it refills). */
export interface Greeble { u: string; sp: string; lv: number; xp: number; stars: number; prism: boolean; en: number; caughtAt?: number }
export type SpawnSrc = 'wild' | 'crater' | 'beacon' | 'wreck' | 'mythic' | 'legend' | 'lure';
export interface Spawn { id: string; sp: string; lv: number; stars: number; prism: boolean; src: SpawnSrc; at: number; until: number; x: number; y: number; reg: RegionId }
export interface Encounter { spawn: string; treat: boolean; throws: number }
export type FightKind = 'patrol' | 'wreck' | 'boss';
export interface Fighter { u: string; hp: number; maxHp: number; charge: number; boost: boolean }
export interface Fight { team: Fighter[]; robot: string; robotHp: number; robotMax: number; carry: number; kind: FightKind; reg: RegionId; /** convenience: first fighter */ u: string; /** started by Auto-patrol */ auto?: boolean }
export interface Wreck { robot: string; until: number }
export interface Egg { id: string; sp: string; prism: boolean; stars: number; left: number; total: number }
export interface DailyTask { id: string; key: string; need: number; label: string; base: number; done: boolean }

export interface Stats {
  caught: number; thrown: number; fled: number; prisms: number; sold: number; evolved: number;
  wins: number; losses: number; wrecks: number; scrapEarned: number; perfects: number; bosses: number;
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
  /** 0.13: the Greebles that fight. Campers work and rest; the team fights. */
  team: (string | null)[];
  /** 0.13: the team fights patrols on its own while it has energy (also while you're away). */
  autoPatrol: boolean;
  patrolCarry: number;
  /** 0.13: candy per family (keyed by the family's first stage). Spent to evolve. */
  candy: Record<string, number>;
  /** 0.13: this save was reset for the new rules (show the notice once). */
  newRules?: boolean;
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
  /** The area you're exploring right now, and how many areas are open. */
  region: RegionId;
  unlocked: number;
  /** When each area's boss was last beaten (0 = never). */
  bossBeaten: Partial<Record<RegionId, number>>;
  upgrades: Partial<Record<UpgradeId, number>>;
  pressCarry: number;
  /** Bait set out in an area: Greebles wander in fast for 30 min. */
  lure: { id: LureId; reg: RegionId; until: number; next: number } | null;
  // ── 0.6: the long game (these survive a signal home) ──────
  ship: Partial<Record<PartId, true>>;
  /** How many times you've signalled home (each run is tougher and pays more). */
  signals: number;
  /** Signal Points to spend on perks. */
  sp: number;
  perks: Partial<Record<PerkId, number>>;
  /** Daily expedition: who's out, and when they come back. */
  expo: { u: string; until: number; reg: RegionId } | null;
  expoDay: number;
  /** Week number the swarm reward was claimed. */
  bestEver: { caught: number; bosses: number };
  /** 0.8: lifetime counters for Mythic Hunts (survive a signal home). */
  tally: Record<string, number>;
  /** 0.8: hunts finished (time the Mythic was first called) and Mythics caught from them. */
  hunts: Record<string, number>;
  /** 0.9: two Greebles of one family in the nest lay eggs; eggs hatch over time. */
  nest: [string | null, string | null];
  nestCarry: number;
  eggs: Egg[];
  /** 0.9: three small goals a day (progress = tally now − tally at the start of the day). */
  daily: { day: number; tasks: DailyTask[]; bonus: boolean } | null;
  /** 0.9: new-player walkthrough step (99 = done). */
  intro: number;
  /** Materials brought back by campers (for the welcome-back card / stats). */
  gathered: Partial<Record<ItemId, number>>;
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

const freshStats = (): Stats => ({ caught: 0, thrown: 0, fled: 0, prisms: 0, sold: 0, evolved: 0, wins: 0, losses: 0, wrecks: 0, scrapEarned: 0, perfects: 0, bosses: 0 });

export function newGame(seed = (Math.random() * 2 ** 31) | 0, now = Date.now()): GameState {
  const s: GameState = {
    version: SAVE_VERSION, rng: seed, nextId: 1, scrap: RULES.startScrap,
    bag: [], bagMax: RULES.bagMax, camp: Array(RULES.campSlots).fill(null), campCarry: 0, fight: null,
    team: Array(RULES.teamSlots).fill(null), autoPatrol: true, patrolCarry: 0, candy: {},
    items: { ...START_ITEMS },
    spawns: [], wildClock: now, nextAmbientAt: now + RULES.ambientMinMs, nextCraterAt: 0, nextBeaconAt: 0, beaconUntil: 0,
    wreck: null, nextWreckAt: now + RULES.wreckFirstMs, enc: null,
    region: 'ash', unlocked: 1, bossBeaten: {}, upgrades: {}, pressCarry: 0, lure: null, gathered: {},
    ship: {}, signals: 0, sp: 0, perks: {}, expo: null, expoDay: 0, bestEver: { caught: 0, bosses: 0 }, tally: {}, hunts: {},
    nest: [null, null], nestCarry: 0, eggs: [], daily: null, intro: 0,
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
  | { t: 'evolved'; u: string; from: string; to: string }
  | { t: 'level'; u: string; lv: number }
  | { t: 'canEvolve'; u: string; sp: string }
  | { t: 'fightWon'; sp: string; robot: string; scrap: number; loot: Partial<Record<ItemId, number>>; wreck: boolean; auto?: boolean }
  | { t: 'fightLost'; sp: string; robot: string; wreck: boolean; auto?: boolean }
  | { t: 'candy'; root: string; n: number }
  | { t: 'capUp'; cap: number }
  | { t: 'bossWon'; reg: RegionId; first: boolean; scrap: number; unlocked?: RegionId; loot: Partial<Record<ItemId, number>> }
  | { t: 'bossLost'; reg: RegionId }
  | { t: 'move'; u: string; dmg: number; tapped: boolean; mult: number }
  | { t: 'crafted'; out: ItemId; n: number }
  | { t: 'lure'; id: LureId }
  | { t: 'shipPart'; id: PartId; done: boolean }
  | { t: 'expoBack'; sp: string; found: Partial<Record<ItemId, number>>; greeble?: string; prism: boolean }
  | { t: 'wreck'; robot: string }
  | { t: 'reward'; id: string; label: string }
  | { t: 'beacon' }
  | { t: 'huntDone'; id: string; mythic: string }
  | { t: 'huntCall'; id: string; mythic: string }
  | { t: 'eggLaid'; sp: string }
  | { t: 'eggReady'; sp: string }
  | { t: 'hatched'; sp: string; prism: boolean; stars: number }
  | { t: 'task'; label: string }
  | { t: 'taskBonus' };

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

  // ── 0.9: nest & eggs ──────────────────────────────────────
  /** Why the nest can't lay right now ('' = it's laying). */
  nestWhy(): string {
    const [a, b] = this.s.nest.map(u => (u ? this.get(u) : undefined));
    if (!a || !b) return 'Put two Greebles from the same family in the nest.';
    if (familyRoot(a.sp) !== familyRoot(b.sp)) return 'They need to be from the same family (like Ash Pup + Hulking Ash).';
    if (this.s.eggs.length >= EGG_MAX) return `The incubator is full (${EGG_MAX} eggs). Hatch one first.`;
    return '';
  }
  canNest(g: Greeble): string {
    const m = morph(g.sp);
    if (m.rarity === 'legendary' || m.rarity === 'mythic') return `${m.name} is too rare to nest.`;
    return '';
  }
  toNest(u: string, slot?: 0 | 1): ActionResult {
    const g = this.get(u); if (!g) return fail('Not in the bag.');
    const why = this.canNest(g); if (why) return fail(why);
    if (this.inNest(u)) return OK;
    if (this.inCamp(u) || this.inTeam(u) || this.fighting(u) || this.s.expo?.u === u) return fail('It is busy. Take it off the team or out of camp first.');
    const i = slot ?? (this.s.nest[0] ? 1 : 0);
    if (this.s.nest[i]) return fail('That nest spot is taken.');
    this.s.nest[i] = u;
    this.s.nestCarry = 0;
    return OK;
  }
  fromNest(slot: 0 | 1): ActionResult { this.s.nest[slot] = null; this.s.nestCarry = 0; return OK; }
  /** ms until the next egg (or null if the nest isn't laying). */
  get nextEggIn() { return this.nestWhy() ? null : Math.max(0, NEST_MS - this.s.nestCarry); }
  private layEgg() {
    const [a, b] = this.s.nest.map(u => this.get(u!)!) as [Greeble, Greeble];
    const root = morph(familyRoot(a.sp));
    let stars = Math.max(this.rollStars(), this.rollStars());
    if (a.stars + b.stars >= 8 && this.rand() < 0.35) stars++;
    const prismMult = EGG_PRISM_MULT * (a.prism || b.prism ? 3 : 1) * (1 + this.perk('shine') * 0.25);
    const ms = HATCH_MS[root.rarity] || HATCH_MS.common;
    this.s.eggs.push({ id: this.uid('e'), sp: root.id, prism: this.rand() < RULES.prismOdds * prismMult, stars: Math.min(5, stars), left: ms, total: ms });
    this.emit({ t: 'eggLaid', sp: root.id });
  }
  /** Catching Greebles warms your eggs: each catch takes 10 minutes off every egg. */
  private warmEggs(ms: number) {
    for (const e of this.s.eggs) if (e.left > 0) { e.left = Math.max(0, e.left - ms); if (e.left === 0) this.emit({ t: 'eggReady', sp: e.sp }); }
  }
  hatch(id: string): ActionResult {
    const i = this.s.eggs.findIndex(e => e.id === id); if (i < 0) return fail('No such egg.');
    const e = this.s.eggs[i];
    if (e.left > 0) return fail('It is not ready yet.');
    if (this.s.bag.length >= this.s.bagMax) return fail('Your bag is full.');
    this.s.eggs.splice(i, 1);
    this.s.bag.push({ u: this.uid('g'), sp: e.sp, lv: 1, xp: 0, stars: e.stars, prism: e.prism, en: RULES.maxEnergy, caughtAt: Date.now() });
    this.s.caught[e.sp] = true; this.s.seen[e.sp] = true;
    this.addCandy(e.sp, CANDY.hatch * (e.prism ? CANDY.prismMult : 1));
    if (e.prism) { this.s.prismCaught[e.sp] = true; this.s.stats.prisms++; this.tick('prism'); }
    this.tick('hatch');
    this.emit({ t: 'hatched', sp: e.sp, prism: e.prism, stars: e.stars });
    this.checkRewards(); this.checkHunts(Date.now());
    return OK;
  }

  // ── 0.9: daily tasks ──────────────────────────────────────
  /** Make sure today's tasks exist (a new set every day). */
  ensureDaily(now: number) {
    const day = Math.floor(now / DAY_MS);
    if (this.s.daily?.day === day) return this.s.daily;
    // elements you can actually find right now
    const els = [...new Set(REGIONS.filter(r => this.isOpen(r.id)).flatMap(r => r.kinds).map(k => elementOf(k)))];
    const pool = TASK_POOL.filter(t => !(t.id === 'catch15' && this.s.stats.caught < 20));
    const picked: DailyTask[] = [];
    const used = new Set<string>();
    while (picked.length < DAILY_COUNT && used.size < pool.length) {
      const d = pool[Math.floor(this.rand() * pool.length)];
      if (used.has(d.id) || (d.id.startsWith('catch') && picked.some(p => p.id.startsWith('catch')))) { used.add(d.id); continue; }
      used.add(d.id);
      let key = d.key, label = d.label;
      if (d.el) { const el = els[Math.floor(this.rand() * els.length)] ?? 'ash'; key = `catch:${el}`; label = label.replace('{el}', ELEMENTS[el].name); }
      picked.push({ id: d.id, key, need: d.need, label, base: this.tallyOf(key), done: false });
    }
    this.s.daily = { day, tasks: picked, bonus: false };
    return this.s.daily;
  }
  taskProgress(t: DailyTask) { return Math.min(t.need, this.tallyOf(t.key) - t.base); }
  /** Scrap for one daily task (grows with how far you've gone). */
  get taskScrap() { return Math.round(60 * this.s.unlocked * this.hard); }
  claimTask(i: number, now: number): ActionResult {
    const d = this.ensureDaily(now); const t = d.tasks[i];
    if (!t) return fail('No such task.');
    if (t.done) return fail('Already claimed.');
    if (this.taskProgress(t) < t.need) return fail('Not done yet.');
    t.done = true;
    this.earn(this.taskScrap); this.give('good', 3);
    this.emit({ t: 'task', label: t.label });
    if (!d.bonus && d.tasks.every(x => x.done)) { d.bonus = true; this.give('great', 2); this.give('lureRare', 1); this.emit({ t: 'taskBonus' }); }
    return OK;
  }

  // ── 0.8: Mythic Hunts ─────────────────────────────────────
  tick(key: string, n = 1) { this.s.tally[key] = (this.s.tally[key] ?? 0) + n; }
  tallyOf(key: string) { return this.s.tally[key] ?? 0; }
  huntDone(h: Hunt) { return h.steps.every(st => this.tallyOf(st.key) >= st.need); }
  /** Where a hunt is at: 'locked' (area not open), 'open' (working on it), 'ready' (done, Mythic can be called), 'out' (Mythic is waiting), 'caught'. */
  huntState(h: Hunt, now: number): 'locked' | 'open' | 'ready' | 'out' | 'caught' {
    if (this.s.caught[h.mythic] && this.s.hunts[h.id]) return 'caught';
    if (!this.isOpen(h.reg)) return 'locked';
    if (!this.huntDone(h)) return 'open';
    return this.s.spawns.some(x => x.sp === h.mythic && x.src === 'mythic' && x.until > now) ? 'out' : 'ready';
  }
  private checkHunts(now: number) {
    for (const h of HUNTS) if (!this.s.hunts[h.id] && this.isOpen(h.reg) && this.huntDone(h)) {
      this.s.hunts[h.id] = now;
      this.give('star', 1);
      this.emit({ t: 'huntDone', id: h.id, mythic: h.mythic });
    }
  }
  /** Call a finished hunt's Mythic into its area (free; you can call it again if it wanders off). */
  callMythic(id: string, now: number): ActionResult {
    const h = HUNTS.find(x => x.id === id); if (!h) return fail('No such hunt.');
    const st = this.huntState(h, now);
    if (st === 'locked' || st === 'open') return fail('Finish the hunt first.');
    if (st === 'out') return fail('It is already out there. Go find it!');
    if (h.night && !isNight(now)) return fail('It only comes out at night.');
    if (!this.s.hunts[h.id]) this.s.hunts[h.id] = now;
    const reg0 = this.s.region; this.s.region = h.reg;
    this.addSpawn(now, 'mythic', h.mythic, HUNT_SPAWN_MS);
    this.s.region = reg0;
    this.emit({ t: 'huntCall', id: h.id, mythic: h.mythic });
    return OK;
  }

  // ── lookups ───────────────────────────────────────────────
  get(u: string) { return this.s.bag.find(g => g.u === u); }
  spawn(id: string) { return this.s.spawns.find(x => x.id === id); }
  inCamp(u: string) { return this.s.camp.includes(u); }
  busy(u: string) { return this.inCamp(u) || this.inTeam(u) || this.fighting(u) || this.s.expo?.u === u || this.inNest(u); }
  inTeam(u: string) { return this.s.team.includes(u); }
  /** Team members, in slot order. */
  get teamList(): Greeble[] { return this.s.team.map(u => (u ? this.get(u) : undefined)).filter(Boolean) as Greeble[]; }
  /** Team members with at least `cost` energy (and not out on an expedition). */
  readyTeam(cost = 1): Greeble[] { return this.teamList.filter(g => this.energy(g) >= cost && this.s.expo?.u !== g.u); }
  energy(g: Greeble) { return Math.floor(g.en + 1e-9); }
  /** ms for one energy to come back for this Greeble right now. */
  enMs(g: Greeble) { return (this.inCamp(g.u) ? RULES.enCampMs : RULES.enRestMs) / (1 + this.up('bedroll') * 0.25); }
  /** How many area bosses you've beaten, in order (sets the level cap). */
  get bossesInOrder() { let i = 0; while (i < REGIONS.length && this.s.bossBeaten[REGIONS[i].id]) i++; return i; }
  get levelCap() { return LEVEL_CAPS[Math.min(LEVEL_CAPS.length - 1, this.bossesInOrder)]; }
  candyOf(sp: string) { return this.s.candy[familyRoot(sp)] ?? 0; }
  private addCandy(sp: string, n: number) { const r = familyRoot(sp); this.s.candy[r] = (this.s.candy[r] ?? 0) + n; this.emit({ t: 'candy', root: r, n }); }
  inNest(u: string) { return this.s.nest.includes(u); }
  perk(id: PerkId) { return this.s.perks[id] ?? 0; }
  /** Robots get tougher each time you signal home (and pay more). */
  get hard() { return 1 + this.s.signals * SIGNAL_STEP; }
  get shipDone() { return SHIP_PARTS.every(p => this.s.ship[p.id]); }
  /** Signal Points you'd get for signalling home now. */
  get signalReward() { return 3 + Math.floor(this.caughtCount / 10) + this.s.stats.bosses + Object.keys(this.s.prismCaught).length; }
  get ambientCap() { return RULES.ambientCap + this.perk('roam'); }
  /** Swarm: one kind is everywhere for a whole week (same for everyone). */
  swarmKind(t: number) { const pool = SPAWNABLE.filter(m => m.rarity !== 'mythic' && m.rarity !== 'legendary'); return pool[hash32(Math.floor(t / WEEK_MS) * 31 + 5) % pool.length]; }
  fighting(u: string) { return !!this.s.fight?.team.some(f => f.u === u); }
  get reg() { return region(this.s.region); }
  up(id: UpgradeId) { return this.s.upgrades[id] ?? 0; }
  get teamMax() { return Math.min(TEAM_MAX, RULES.teamSlots + this.up('squad')); }
  get offlineCap() { return RULES.offlineCapMs + (this.up('away') + this.perk('watch')) * 4 * 60 * 60 * 1000; }
  isOpen(id: RegionId) { return regionIndex(id) < this.s.unlocked; }
  /** The newest area you've opened. */
  unlockedTop(): RegionId { return REGIONS[Math.min(REGIONS.length, this.s.unlocked) - 1].id; }
  bossReadyAt(id: RegionId) { const b = this.s.bossBeaten[id]; return b ? b + BOSS_REMATCH_MS : 0; }
  count(item: ItemId) { return this.s.items[item] ?? 0; }
  private give(item: ItemId, n: number) { this.s.items[item] = this.count(item) + n; }
  quality(g: { stars: number; prism: boolean }) { return (1 + (g.stars - 1) * 0.1) * (g.prism ? 1.2 : 1); }
  power(g: Greeble) { const m = morph(g.sp); return Math.round((BASE_POWER[m.rarity] + (m.stage - 1) * 2 + g.lv + (m.role === 'fight' ? 2 : 0)) * this.quality(g)); }
  fighterHp(g: Greeble) { return 10 + this.power(g) * 2; }
  yieldOf(g: Greeble) { const m = morph(g.sp); return Math.round((1 + Math.floor(g.lv / 10) + (m.stage - 1) + (m.role === 'fight' ? 1 : 0)) * this.quality(g) * (1 + this.up('bench') * 0.1) * (m.role === this.reg.favor ? 1.25 : 1) * (1 + this.perk('thrift') * 0.2) * CAMP_SCRAP_MULT * 10) / 10; }
  /** Bosses: everyone can help, but only Skirmish Greebles hit at full power. */
  teamPower(g: Greeble) { return Math.max(1, Math.round(this.power(g) * (morph(g.sp).role === 'fight' ? 1 : 0.6))); }
  sellValue(g: Greeble) { return Math.round(SELL[morph(g.sp).rarity] * g.lv * (g.prism ? 5 : 1) * 0.5); }
  get campYield() { return Math.round(this.s.camp.reduce((n, u) => { const g = u ? this.get(u) : undefined; return n + (g ? this.yieldOf(g) : 0); }, 0) * 10) / 10; }
  get caughtCount() { return Object.keys(this.s.caught).length; }
  /** Evolution options for this Greeble right now, with why each one is or isn't ready. */
  evoOptions(g: Greeble, now: number): { evo: Evo; ready: boolean; why: string }[] {
    return (morph(g.sp).evo ?? []).map(evo => {
      const need = evoCandy(morph(g.sp));
      const why = g.lv < evo.lv ? (evo.lv > this.levelCap ? `Reach level ${evo.lv} (beat the next boss to raise the cap)` : `Reach level ${evo.lv}`)
        : this.candyOf(g.sp) < need ? `Needs ${need} candy (have ${this.candyOf(g.sp)})`
        : evo.item && this.count(evo.item) < 1 ? `Needs a ${ITEMS[evo.item].name}`
        : evo.night && !isNight(now) ? 'Only at night'
        : '';
      return { evo, ready: !why, why };
    });
  }

  /** Xp you can bank at the level cap (it pays out when the cap goes up). */
  bankMax(g: Greeble) { return g.lv >= RULES.maxLevel ? 0 : xpNeed(g.lv) * XP_BANK_LEVELS; }
  private addXp(g: Greeble, xp: number) {
    const before = this.evoOptions(g, Date.now()).some(o => o.ready);
    const cap = this.levelCap;
    g.xp += xp;
    while (g.lv < cap && g.xp >= xpNeed(g.lv)) { g.xp -= xpNeed(g.lv); g.lv++; this.emit({ t: 'level', u: g.u, lv: g.lv }); }
    if (g.lv >= RULES.maxLevel) g.xp = 0;
    else if (g.lv >= cap) g.xp = Math.min(g.xp, this.bankMax(g));
    if (!before && this.evoOptions(g, Date.now()).some(o => o.ready || o.why === 'Only at night')) this.emit({ t: 'canEvolve', u: g.u, sp: g.sp });
  }
  private earn(n: number) { this.s.scrap += n; this.s.stats.scrapEarned += n; }

  // ── the wilds ─────────────────────────────────────────────
  private rollStars() {
    let r = this.rand() * STAR_WEIGHTS.reduce((a, b) => a + b, 0);
    for (let i = 0; i < STAR_WEIGHTS.length; i++) { r -= STAR_WEIGHTS[i]; if (r < 0) return i + 1; }
    return 1;
  }
  /** Pick a kind to spawn. `role` boosts one caste (Glow Crater); `rareBoost` shifts odds up (robot wrecks). */
  rollKind(t: number, opts: { role?: Role; rareBoost?: number; prismBoost?: number; roleMult?: number } = {}): Morph {
    const night = isNight(t), storm = !!stormAt(t)?.on;
    const reg = this.reg;
    const pool = SPAWNABLE.filter(m => (!m.nightOnly || night) && m.rarity !== 'mythic' && m.rarity !== 'legendary' && reg.kinds.includes(m.id));
    // An area's Legendary only roams once you've beaten that area's boss.
    if (this.s.bossBeaten[reg.id]) pool.push(morph(reg.legendary));
    const perTier = new Map<Rarity, number>();
    for (const m of pool) perTier.set(m.rarity, (perTier.get(m.rarity) ?? 0) + 1);
    const swarm = this.swarmKind(t).id;
    if (!pool.some(m => m.id === swarm)) pool.push(morph(swarm));   // the swarm kind shows up in every area
    const weights = pool.map(m => {
      let w = TIER_WEIGHT[m.rarity] / perTier.get(m.rarity)!;
      if (opts.rareBoost && RARITIES.indexOf(m.rarity) >= 2) w *= opts.rareBoost;
      if (opts.role && m.role === opts.role) w *= opts.roleMult ?? 4;
      if (m.id === swarm) w *= SWARM_MULT;
      if (night && m.tags?.includes('night')) w *= 3;
      if (storm && m.tags?.includes('storm')) w *= 3;
      return w;
    });
    let r = this.rand() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r < 0) return pool[i]; }
    return pool[0];
  }
  addSpawn(t: number, src: SpawnSrc, sp?: string, life?: number, opts: { role?: Role; rareBoost?: number; prismBoost?: number; roleMult?: number } = {}): Spawn {
    const m = sp ? morph(sp) : this.rollKind(t, opts);
    const lifeMs = life ?? (src === 'wild' ? RULES.ambientLifeMs : src === 'beacon' || src === 'lure' ? RULES.beaconLifeMs : src === 'wreck' ? RULES.wreckSpawnLifeMs : RULES.ambientLifeMs);
    const x: Spawn = {
      id: this.uid('w'), sp: m.id, lv: Math.max(1, Math.min(this.levelCap - WILD_UNDER_CAP, 1 + Math.floor(this.rand() * WILD_MAX_LV[m.rarity]) + this.reg.lvl)), stars: this.rollStars(),
      prism: this.rand() < RULES.prismOdds * (opts.prismBoost ?? 1) * (1 + this.perk('shine') * 0.25), src, at: t, until: t + lifeMs, x: 0, y: 0, reg: this.s.region,
    };
    // spread them out so tiles don't sit on top of each other (best of a few tries)
    let best = { x: 0.5, y: 0.5, d: -1 };
    for (let i = 0; i < 12; i++) {
      const p = { x: 0.12 + this.rand() * 0.76, y: 0.14 + this.rand() * 0.7 };
      const d = this.here.reduce((m, o) => Math.min(m, Math.hypot((o.x - p.x) * 1.2, o.y - p.y)), 9);
      if (d > best.d) best = { ...p, d };
      if (d > 0.22) break;
    }
    x.x = best.x; x.y = best.y;
    this.s.spawns.push(x);
    this.emit({ t: 'spawn', src, sp: x.sp, prism: x.prism });
    return x;
  }
  /** Greebles waiting in the area you're in. */
  get here() { return this.s.spawns.filter(x => x.reg === this.s.region); }
  private countSrc(src: SpawnSrc) { return this.here.filter(x => x.src === src).length; }

  /** Walk to another area. Greebles you leave behind stay there until they wander off. */
  travel(id: RegionId): ActionResult {
    if (!this.isOpen(id)) return fail(`Beat the ${REGIONS[regionIndex(id) - 1]?.boss.name ?? 'boss'} to open ${region(id).name}.`);
    if (this.s.enc) return fail('Finish catching first.');
    if (this.s.fight?.kind === 'boss') return fail('Finish the boss fight first.');
    this.s.region = id;
    return OK;
  }

  /** Bring the wilds up to real time `now`: Greebles wander in and out, hot spots switch on and off. */
  updateWilds(now: number) {
    const s = this.s;
    if (!(now > s.wildClock)) return;
    // Anything older than a few hours has wandered off anyway, so don't simulate a whole week.
    if (s.expo && now >= s.expo.until && now - s.wildClock > RULES.wildSimMaxMs) this.expoReturn(now);
    if (now - s.wildClock > RULES.wildSimMaxMs) {
      s.wildClock = now - RULES.wildSimMaxMs;
      s.nextAmbientAt = Math.max(s.nextAmbientAt, s.wildClock);
      s.nextWreckAt = Math.max(Math.min(s.nextWreckAt, s.wildClock + RULES.wreckMaxMs), s.wildClock);
    }
    for (let t = s.wildClock + STEP; t <= now; t += STEP) this.wildStep(t);
    if (s.expo && now >= s.expo.until) this.expoReturn(now);
    s.wildClock = now - ((now - s.wildClock) % STEP);
    this.expire(now);
  }
  private expire(t: number) {
    const s = this.s;
    s.spawns = s.spawns.filter(x => x.until > t || s.enc?.spawn === x.id);
    if (s.wreck && s.wreck.until <= t && s.fight?.kind !== 'wreck') s.wreck = null;
  }
  private wildStep(t: number) {
    const s = this.s;
    this.expire(t);
    if (t >= s.nextAmbientAt) {
      if (this.countSrc('wild') < this.ambientCap) this.addSpawn(t, 'wild');
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
    const lu = s.lure;
    if (lu) {
      if (t >= lu.until) s.lure = null;
      else if (t >= lu.next) {
        const def = LURES[lu.id];
        const reg0 = s.region; s.region = lu.reg;
        if (this.countSrc('lure') < RULES.beaconCap) this.addSpawn(t, 'lure', undefined, undefined, def.rare ? { rareBoost: 3, prismBoost: 3 } : { role: def.role, roleMult: 12 });
        s.region = reg0;
        lu.next = t + this.between(LURE_SPAWN_MIN, LURE_SPAWN_MAX);
      }
    }
    // The Starborn Greeble: very rarely, on a stormy night.
    if (isNight(t) && stormAt(t)?.on && !this.here.some(x => x.src === 'mythic') && this.rand() < 1 / 400) this.addSpawn(t, 'mythic', 'starborn', 20 * 60_000);
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

  useLure(id: LureId, now: number): ActionResult {
    if (!LURES[id]) return fail('That is not bait.');
    if (this.count(id) < 1) return fail('You have none. Craft some at the Workbench.');
    if (this.s.lure && this.s.lure.until > now) return fail('Bait is already out.');
    this.s.items[id] = this.count(id) - 1;
    this.s.lure = { id, reg: this.s.region, until: now + LURE_MS, next: now };
    this.emit({ t: 'lure', id });
    this.updateWilds(now + 1);
    return OK;
  }

  // ── the ship, signalling home, expeditions ────────────────
  canBuild(id: PartId): string | null {
    const p = SHIP_PARTS.find(x => x.id === id); if (!p) return 'No such part.';
    if (this.s.ship[id]) return 'Already done.';
    const i = SHIP_PARTS.indexOf(p);
    if (i > 0 && !this.s.ship[SHIP_PARTS[i - 1].id]) return `Do "${SHIP_PARTS[i - 1].name}" first.`;
    if (p.needBoss && !this.s.bossBeaten[p.needBoss]) return `Beat the ${region(p.needBoss).boss.name} first.`;
    if (this.s.scrap < p.scrap) return `Needs ${p.scrap.toLocaleString('en-US')} scrap.`;
    const short = (Object.entries(p.cost) as [ItemId, number][]).find(([k, v]) => this.count(k) < v);
    if (short) return `Needs ${short[1]} ${ITEMS[short[0]].name}.`;
    return null;
  }
  buildPart(id: PartId): ActionResult {
    const why = this.canBuild(id); if (why) return fail(why);
    const p = SHIP_PARTS.find(x => x.id === id)!;
    this.s.scrap -= p.scrap;
    for (const [k, v] of Object.entries(p.cost) as [ItemId, number][]) this.s.items[k] = this.count(k) - v;
    this.s.ship[id] = true;
    this.emit({ t: 'shipPart', id, done: this.shipDone });
    return OK;
  }
  /**
   * Signal home: start a new trip on the planet. You keep your Field Guide, Prismatic marks, perks
   * and up to 3 Greebles of your choice. Everything else resets, robots get tougher (and pay more),
   * and you get Signal Points for perks.
   */
  signalHome(keep: string[], now: number): ActionResult {
    if (!this.shipDone) return fail('Finish repairing the ship first.');
    if (this.s.fight || this.s.enc) return fail('Finish what you are doing first.');
    const kept = [...new Set(keep)].slice(0, 3).map(u => this.get(u)).filter(Boolean) as Greeble[];
    const old = this.s;
    const fresh = newGame(old.rng, now);
    const pack = this.perk('pack');
    const s: GameState = {
      ...fresh,
      nextId: old.nextId,
      bag: kept.map(g => ({ ...g, lv: Math.min(LEVEL_CAPS[0], Math.max(1, Math.floor(g.lv / 2))), xp: 0, en: RULES.maxEnergy })),
      seen: old.seen, caught: old.caught, prismCaught: old.prismCaught, claimed: old.claimed,
      stats: { ...old.stats }, tips: old.tips,
      signals: old.signals + 1, sp: old.sp + this.signalReward, perks: old.perks,
      bestEver: { caught: Math.max(old.bestEver.caught, old.stats.caught), bosses: Math.max(old.bestEver.bosses, old.stats.bosses) },
      expoDay: old.expoDay, tally: old.tally, hunts: old.hunts, intro: 99, daily: old.daily,
    };
    s.items = { ...s.items, good: (s.items.good ?? 0) + pack * 5, great: (s.items.great ?? 0) + pack * 2 };
    // the Field Guide rewards you already claimed stay claimed, but the bag/camp they gave come back too
    for (const r of REWARDS) if (old.claimed[r.id]) {
      if (r.give.bag) s.bagMax += r.give.bag;
      if (r.give.camp) for (let i = 0; i < r.give.camp; i++) if (s.camp.length < RULES.maxCampSlots) s.camp.push(null);
    }
    this.s = s;
    return OK;
  }
  buyPerk(id: PerkId): ActionResult {
    const d = PERKS.find(p => p.id === id); if (!d) return fail('No such perk.');
    const lv = this.perk(id);
    if (lv >= d.max) return fail('Maxed out.');
    const c = perkCost(lv);
    if (this.s.sp < c) return fail(`Needs ${c} Signal Points.`);
    this.s.sp -= c;
    this.s.perks[id] = lv + 1;
    return OK;
  }
  /** One expedition a day: send a Greeble off for 4 hours; it comes back with loot (and maybe a friend). */
  expoReady(now: number) { return !this.s.expo && Math.floor(now / DAY_MS) > this.s.expoDay; }
  sendExpedition(u: string, now: number): ActionResult {
    const g = this.get(u); if (!g) return fail('Pick a Greeble.');
    if (this.s.expo) return fail('Someone is already out exploring.');
    if (!this.expoReady(now)) return fail('One expedition a day. Come back tomorrow!');
    if (this.busy(u)) return fail('It is busy. Take it off the team or out of camp first.');
    this.s.expo = { u, until: now + EXPEDITION_MS, reg: this.s.region };
    this.s.expoDay = Math.floor(now / DAY_MS);
    this.tick('expo'); this.checkHunts(now);
    return OK;
  }
  private expoReturn(t: number) {
    const e = this.s.expo!; const g = this.get(e.u);
    this.s.expo = null;
    if (!g) return;
    const ri = regionIndex(e.reg), q = this.quality(g), lvl = 1 + g.lv / 20;
    const found: Partial<Record<ItemId, number>> = {};
    const add = (k: ItemId, n: number) => { if (n > 0) { found[k] = (found[k] ?? 0) + n; this.give(k, n); } };
    add('ore', Math.round((10 + ri * 8) * q * lvl)); add('kelp', Math.round((10 + ri * 8) * q * lvl)); add('gear', Math.round((6 + ri * 6) * q * lvl));
    add('core', ri + (this.rand() < 0.5 ? 1 : 0)); add('great', 2 + ri); add('treat', 3);
    if (ri >= 3) add('crystal', 2 + Math.floor(this.rand() * 3));
    if (this.rand() < 0.3) add('lureRare', 1);
    this.addXp(g, 200 + ri * 150);
    this.addCandy(g.sp, CANDY.expo);
    // a rare friend follows it home and waits in the wilds of that area
    const reg0 = this.s.region; this.s.region = e.reg;
    const friend = this.addSpawn(t, 'wild', undefined, 2 * 60 * 60_000, { rareBoost: 4, prismBoost: 2 });
    this.s.region = reg0;
    this.emit({ t: 'expoBack', sp: g.sp, found, greeble: friend.sp, prism: friend.prism });
  }

  // ── catching ──────────────────────────────────────────────
  startEncounter(id: string): ActionResult {
    const x = this.spawn(id); if (!x) return fail('It wandered off.');
    if (this.s.enc && this.s.enc.spawn !== id) return fail('You are already trying to catch one.');
    if (this.s.bag.length >= this.s.bagMax) return fail('Your bag is full. Send some Greebles home first (Bag tab).');
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
    return Math.min(0.97, CATCH_BASE[m.rarity] * SNARE_MULT[snare] * THROW_MULT[Math.max(0, Math.min(3, quality | 0))] * (e!.treat ? TREAT_MULT : 1) * lvPenalty * (1 + this.perk('lucky') * 0.1));
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
    if (q === 3) { s.stats.perfects++; this.tick('perfect'); }
    if (q >= 1) this.tick('goodThrow');
    e.treat = false;
    const m = morph(x.sp);
    if (this.rand() < chance) {
      const first = !s.caught[x.sp];
      s.bag.push({ u: this.uid('g'), sp: x.sp, lv: x.lv, xp: 0, stars: x.stars, prism: x.prism, en: RULES.maxEnergy, caughtAt: Date.now() });
      s.caught[x.sp] = true; s.seen[x.sp] = true;
      this.addCandy(x.sp, (CANDY.catch + (x.stars >= 4 ? CANDY.goodStars : 0)) * (x.prism ? CANDY.prismMult : 1));
      if (x.prism) { s.prismCaught[x.sp] = true; s.stats.prisms++; this.tick('prism'); }
      s.stats.caught++;
      this.tick('catch'); this.tick(`catch:${elementOf(x.sp)}`); if (isNight(Date.now())) this.tick('night');
      this.warmEggs(10 * 60_000);
      const scrap = (3 + RARITIES.indexOf(m.rarity) * 6) * (first ? 3 : 1) + q * 2;
      this.earn(scrap);
      s.spawns = s.spawns.filter(y => y.id !== x.id);
      s.enc = null;
      this.emit({ t: 'caught', sp: x.sp, first, prism: x.prism, stars: x.stars, scrap, quality: q });
      this.checkRewards();
      this.checkHunts(Date.now());
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
    if (this.fighting(u)) return fail('It is fighting right now.');
    if (this.s.expo?.u === u) return fail('It is out on an expedition.');
    const scrap = this.sellValue(g);
    this.s.camp = this.s.camp.map(x => (x === u ? null : x));
    this.s.team = this.s.team.map(x => (x === u ? null : x));
    this.addCandy(g.sp, CANDY.home);
    this.s.nest = this.s.nest.map(x => (x === u ? null : x)) as [string | null, string | null];
    this.s.bag = this.s.bag.filter(x => x.u !== u);
    this.earn(scrap);
    this.s.stats.sold++;
    this.emit({ t: 'sold', sp: g.sp, scrap });
    return OK;
  }

  evolve(u: string, to: string, now: number): ActionResult {
    const g = this.get(u); if (!g) return fail('Not in the bag.');
    const opt = this.evoOptions(g, now).find(o => o.evo.to === to);
    if (!opt) return fail('It cannot become that.');
    if (!opt.ready) return fail(opt.why);
    if (opt.evo.item) this.s.items[opt.evo.item] = this.count(opt.evo.item) - 1;
    const root = familyRoot(g.sp);
    this.s.candy[root] = this.candyOf(g.sp) - evoCandy(morph(g.sp));
    const from = g.sp;
    g.sp = to;
    this.s.seen[to] = true; this.s.caught[to] = true;
    if (g.prism) this.s.prismCaught[to] = true;
    this.s.stats.evolved++; this.tick('evolve'); this.checkHunts(now);
    this.emit({ t: 'evolved', u, from, to });
    this.checkRewards();
    return OK;
  }

  // ── camp ──────────────────────────────────────────────────
  assign(u: string, slot?: number): ActionResult {
    if (!this.get(u)) return fail('Not in the bag.');
    if (this.fighting(u)) return fail('It is fighting right now.');
    if (this.inNest(u)) return fail('It is in the nest. Take it out first.');
    if (this.s.expo?.u === u) return fail('It is out on an expedition.');
    const i = slot ?? this.s.camp.findIndex(x => !x);
    if (i < 0 || i >= this.s.camp.length) return fail('Camp is full.');
    this.s.camp = this.s.camp.map(x => (x === u ? null : x));
    this.s.team = this.s.team.map(x => (x === u ? null : x));   // moving to camp takes it off the team
    this.s.camp[i] = u;
    return OK;
  }
  /** Put a Greeble on the team (one tap: it leaves camp if it was working). */
  toTeam(u: string, slot?: number): ActionResult {
    if (!this.get(u)) return fail('Not in the bag.');
    if (this.inTeam(u)) return OK;
    if (this.fighting(u)) return fail('It is fighting right now.');
    if (this.inNest(u)) return fail('It is in the nest. Take it out first.');
    if (this.s.expo?.u === u) return fail('It is out on an expedition.');
    while (this.s.team.length < this.teamMax) this.s.team.push(null);
    const i = slot ?? this.s.team.findIndex(x => !x);
    if (i < 0 || i >= this.s.team.length) return fail(`The team is full (${this.s.team.length}). Take one off first.`);
    if (this.s.team[i]) return fail('That team spot is taken.');
    this.s.camp = this.s.camp.map(x => (x === u ? null : x));
    this.s.team[i] = u;
    return OK;
  }
  offTeam(u: string): ActionResult {
    if (this.fighting(u)) return fail('It is fighting right now.');
    this.s.team = this.s.team.map(x => (x === u ? null : x));
    return OK;
  }
  /** Swap two Greebles: `out` leaves the team (to camp, in `inn`'s old spot if it was camping), `inn` joins. */
  swapIn(inn: string, out: string): ActionResult {
    if (!this.inTeam(out)) return fail('That one is not on the team.');
    if (this.fighting(out) || this.fighting(inn)) return fail('Wait for the fight to end.');
    const campSlot = this.s.camp.indexOf(inn);
    const ti = this.s.team.indexOf(out);
    this.s.team[ti] = null;
    const r = this.toTeam(inn, ti);
    if (!r.ok) { this.s.team[ti] = out; return r; }
    if (campSlot >= 0 && !this.s.camp[campSlot]) this.s.camp[campSlot] = out;   // the tired one rests in camp
    return OK;
  }
  setAutoPatrol(on: boolean): ActionResult { this.s.autoPatrol = on; this.s.patrolCarry = 0; return OK; }
  bench(slot: number): ActionResult {
    if (slot < 0 || slot >= this.s.camp.length) return fail('No such camp spot.');
    this.s.camp[slot] = null;
    return OK;
  }

  // ── robots ────────────────────────────────────────────────
  /** Robot stats for a fight in the current area. */
  foe(robotId: string, kind: FightKind): { name: string; hp: number; atk: number; xp: number; scrap: number; el: Element; tier: number; all?: boolean } | null {
    const reg = this.reg;
    const h = this.hard;
    if (kind === 'boss') return { name: reg.boss.name, hp: Math.round(reg.boss.hp * h), atk: Math.round(reg.boss.atk * Math.sqrt(h)), xp: reg.boss.xp, scrap: Math.round(reg.boss.scrap * h), el: reg.boss.el, tier: 3, all: true };
    const r = robot(robotId); if (!r) return null;
    const st = robotIn(r, reg);
    const wreck = kind === 'wreck' ? RULES.wreckHpMult : 1;
    return { name: r.name, hp: Math.round(st.hp * wreck * h), atk: Math.round(st.atk * Math.sqrt(h)), xp: st.xp, scrap: Math.round((4 + ROBOTS.indexOf(r) * 6) * reg.mult * h), el: r.el, tier: ROBOTS.indexOf(r) };
  }
  /** One normal hit from this Greeble on this robot (element-aware). Skirmish hit full, other castes 60%. */
  hitOn(g: Greeble, el: Element) { return Math.max(1, Math.round(this.teamPower(g) * typeMult(elementOf(g.sp), el))); }
  /** One hit from the robot on this Greeble. */
  hitBy(g: Greeble, atk: number, el: Element) { return Math.max(1, Math.round(atk * typeMult(el, elementOf(g.sp))) - Math.floor(g.lv / 5)); }
  /** Only team members fight, and each needs enough energy for this kind of fight. */
  private teamOf(us: string[], kind: FightKind = 'patrol', checkEnergy = true): Greeble[] | string {
    const ids = [...new Set(us)].slice(0, TEAM_MAX);
    const team = ids.map(u => this.get(u)).filter(Boolean) as Greeble[];
    if (!team.length) return 'Put Greebles on your team first (Fight → Team).';
    if (team.some(g => !this.inTeam(g.u))) return 'Only Greebles on your team can fight.';
    if (team.some(g => this.s.expo?.u === g.u)) return 'One of them is out on an expedition.';
    if (checkEnergy && team.some(g => this.energy(g) < ENERGY_COST[kind])) return `Each fighter needs ⚡${ENERGY_COST[kind]} energy. Let tired ones rest in camp.`;
    return team;
  }
  /** Simulate a fight on copies (moves fire on their own): would this team win? */
  wouldWin(us: string | string[], robotId: string, kind: FightKind | boolean = 'patrol'): boolean {
    return this.winOdds(us, robotId, kind) >= 0.5;
  }
  /** Rough chance to win (0-1), from a few simulated fights. */
  winOdds(us: string | string[], robotId: string, kind: FightKind | boolean = 'patrol'): number {
    const k: FightKind = typeof kind === 'boolean' ? (kind ? 'wreck' : 'patrol') : kind;
    const team = this.teamOf(Array.isArray(us) ? us : [us], k, false); const foe = this.foe(robotId, k);
    if (typeof team === 'string' || !foe) return 0;
    if (team.length === 1 || foe.all) return this.simFight(team, foe, 0) ? 1 : 0;   // one target (or a boss hitting everyone): no luck involved
    let wins = 0; const N = 9;
    for (let i = 0; i < N; i++) if (this.simFight(team, foe, i)) wins++;
    return wins / N;
  }
  private simFight(team: Greeble[], foe: { hp: number; atk: number; el: Element; all?: boolean }, seed: number): boolean {
    const hp = team.map(g => this.fighterHp(g)), ch = team.map(() => 0);
    const rs = { rng: seed * 7919 + 13 };
    let rhp = foe.hp;
    for (let guard = 0; guard < 5000; guard++) {
      for (let i = 0; i < team.length; i++) if (hp[i] > 0) {
        ch[i]++;
        let dmg = this.hitOn(team[i], foe.el);
        if (ch[i] >= MOVE_AUTO) { dmg *= MOVE_AUTO_MULT; ch[i] = 0; }
        rhp -= dmg;
      }
      if (rhp <= 0) return true;
      const alive = hp.map((h, i) => (h > 0 ? i : -1)).filter(i => i >= 0);
      if (foe.all) for (const t of alive) hp[t] -= this.hitBy(team[t], foe.atk, foe.el);   // bosses hit the whole team
      else { const t = alive[Math.floor(nextRandom(rs) * alive.length)]; hp[t] -= this.hitBy(team[t], foe.atk, foe.el); }
      if (hp.every(h => h <= 0)) return false;
    }
    return false;
  }
  startFight(us: string | string[], robotId: string, kind: FightKind | boolean = 'patrol', auto = false): ActionResult {
    const k: FightKind = typeof kind === 'boolean' ? (kind ? 'wreck' : 'patrol') : kind;
    if (this.s.fight) return fail('A fight is already on.');
    const team = this.teamOf(Array.isArray(us) ? us : [us], k);
    if (typeof team === 'string') return fail(team);
    if (k === 'wreck' && (!this.s.wreck || this.s.wreck.robot !== robotId)) return fail('The wreck is gone.');
    if (k === 'boss' && Date.now() < this.bossReadyAt(this.s.region)) return fail('The boss is still being rebuilt. Come back later.');
    const foe = this.foe(robotId, k);
    if (!foe) return fail('No such robot.');
    this.s.fight = {
      team: team.map(g => { const hp = this.fighterHp(g); return { u: g.u, hp, maxHp: hp, charge: 0, boost: false }; }), u: team[0].u,
      robot: k === 'boss' ? 'boss' : robotId, robotHp: foe.hp, robotMax: foe.hp, carry: 0, kind: k, reg: this.s.region,
      ...(auto ? { auto: true } : {}),
    };
    for (const g of team) g.en = Math.max(0, g.en - ENERGY_COST[k]);
    this.s.patrolCarry = 0;
    return OK;
  }
  /** Tap a charged Greeble's special move: its next hit does 3× damage. */
  useMove(u: string): ActionResult {
    const x = this.s.fight?.team.find(t => t.u === u);
    if (!x || x.hp <= 0) return fail('It is not fighting.');
    if (x.charge < MOVE_CHARGE) return fail('Not charged yet.');
    if (x.boost) return fail('Already ready!');
    x.boost = true;
    return OK;
  }
  private fightRound(now: number) {
    const f = this.s.fight!;
    const reg0 = this.s.region; this.s.region = f.reg; // fight in the area it started in
    try { this.fightRoundIn(f, now); } finally { this.s.region = reg0; }
  }
  private fightRoundIn(f: Fight, now: number) {
    const foe = this.foe(f.robot, f.kind);
    const alive = f.team.filter(x => x.hp > 0 && this.get(x.u));
    if (!foe || !alive.length) { this.s.fight = null; return; }
    for (const x of alive) {
      const g = this.get(x.u)!;
      x.charge = (x.charge ?? 0) + 1;
      let dmg = this.hitOn(g, foe.el);
      if (x.boost) { dmg *= MOVE_TAP_MULT; this.emit({ t: 'move', u: x.u, dmg, tapped: true, mult: typeMult(elementOf(g.sp), foe.el) }); x.boost = false; x.charge = 0; }
      else if (x.charge >= MOVE_AUTO) { dmg *= MOVE_AUTO_MULT; this.emit({ t: 'move', u: x.u, dmg, tapped: false, mult: typeMult(elementOf(g.sp), foe.el) }); x.charge = 0; }
      f.robotHp -= dmg;
    }
    const lead = this.get(alive[0].u)!;
    if (f.robotHp <= 0) {
      this.s.fight = null;
      this.s.stats.wins++;
      // 0.13: everyone who fought gets the full xp (energy is what limits fighting now)
      const share = Math.round(foe.xp * (f.kind === 'wreck' ? 1.5 : f.kind === 'boss' && this.s.bossBeaten[f.reg] ? 0.5 : 1));
      for (const x of f.team) { const g = this.get(x.u); if (g) { if (x.hp <= 0) g.en = 0; this.addXp(g, share); } }
      const loot: Partial<Record<ItemId, number>> = {};
      const add = (k: ItemId, n: number) => { loot[k] = (loot[k] ?? 0) + n; };
      const ri = regionIndex(f.reg);
      // robot parts: everyone drops gears, big robots and bosses can drop a Power Core
      add('gear', (1 + foe.tier + Math.floor(this.rand() * 2)) * (ri + 1) * (f.kind === 'boss' ? 4 : f.kind === 'wreck' ? 2 : 1));
      if (f.kind === 'boss' ? true : this.rand() < [0.02, 0.06, 0.15][foe.tier] + (f.kind === 'wreck' ? 0.1 : 0)) add('core', f.kind === 'boss' ? 1 + ri : 1);
      if (f.kind === 'boss') {
        const reg = region(f.reg); const first = !this.s.bossBeaten[f.reg];
        const scrap = Math.round(foe.scrap * (first ? 1 : 0.15));   // rematches pay a little
        this.earn(scrap);
        this.s.bossBeaten[f.reg] = now;
        this.s.stats.bosses++; this.tick(`boss:${f.reg}`); this.checkHunts(now);
        add('great', first ? 5 : 2); add('beacon', 1);
        if (first) { add('star', 1); add(EVO_ITEMS[Math.floor(this.rand() * EVO_ITEMS.length)], 1); }
        for (const [k, v] of Object.entries(loot) as [ItemId, number][]) this.give(k, v);
        let unlocked: RegionId | undefined;
        if (first && ri + 1 < REGIONS.length && this.s.unlocked <= ri + 1) { this.s.unlocked = ri + 2; unlocked = REGIONS[ri + 1].id; }
        if (first) this.raiseCap();
        const reg0 = this.s.region; this.s.region = f.reg;
        this.addSpawn(now, 'legend', reg.legendary, 30 * 60_000);
        this.s.region = reg0;
        this.emit({ t: 'bossWon', reg: f.reg, first, scrap, unlocked, loot });
        return;
      }
      const scrap = Math.round((foe.scrap + lead.lv) * (f.kind === 'wreck' ? 2 : 1) * PATROL_SCRAP_MULT);
      this.earn(scrap);
      add('snare', 2 + Math.floor(this.rand() * 3));
      if (this.rand() < 0.25 + foe.tier * 0.15) add('good', 1);
      if (this.rand() < 0.03 + foe.tier * 0.04 + (f.kind === 'wreck' ? 0.1 : 0)) add(EVO_ITEMS[Math.floor(this.rand() * EVO_ITEMS.length)], 1);
      if (f.kind === 'wreck' && this.rand() < 0.5) add('great', 1);
      for (const [k, v] of Object.entries(loot) as [ItemId, number][]) this.give(k, v);
      this.tick(f.kind === 'wreck' ? 'wreck' : 'patrol'); this.checkHunts(now);
      if (f.kind === 'wreck') {
        this.s.stats.wrecks++;
        this.s.wreck = null;
        for (let i = 0; i < RULES.wreckBurst; i++) this.addSpawn(now, 'wreck', undefined, RULES.wreckSpawnLifeMs, { rareBoost: 3 });
      }
      this.emit({ t: 'fightWon', sp: lead.sp, robot: f.robot, scrap, loot, wreck: f.kind === 'wreck', ...(f.auto ? { auto: true } : {}) });
      return;
    }
    // a boss hits the whole team every round; other robots hit one Greeble
    const targets = foe.all ? alive : [alive[Math.floor(this.rand() * alive.length)]];
    for (const tgt of targets) {
      tgt.hp -= this.hitBy(this.get(tgt.u)!, foe.atk, foe.el);
      if (tgt.hp <= 0) { const g = this.get(tgt.u); if (g) g.en = 0; }   // knocked out: no energy left
    }
    if (f.team.every(x => x.hp <= 0)) {
      this.s.stats.losses++;
      this.s.fight = null;
      if (f.kind === 'boss') this.emit({ t: 'bossLost', reg: f.reg });
      else this.emit({ t: 'fightLost', sp: lead.sp, robot: f.robot, wreck: f.kind === 'wreck', ...(f.auto ? { auto: true } : {}) });
    }
  }

  // ── crafting ──────────────────────────────────────────────
  craft(i: number): ActionResult {
    const r = RECIPES[i]; if (!r) return fail('No such recipe.');
    const cost = Object.entries(r.cost) as [ItemId, number][];
    const short = cost.find(([k, v]) => this.count(k) < v);
    if (short) return fail(`Needs ${short[1]} ${ITEMS[short[0]].name}.`);
    for (const [k, v] of cost) this.s.items[k] = this.count(k) - v;
    this.give(r.out, r.n);
    this.emit({ t: 'crafted', out: r.out, n: r.n });
    this.tick('craft'); this.checkHunts(Date.now());
    return OK;
  }

  // ── camp upgrades ─────────────────────────────────────────
  upgradePrice(id: UpgradeId): number | null { const d = UPGRADES.find(u => u.id === id)!; return d.prices[this.up(id)] ?? null; }
  buyUpgrade(id: UpgradeId): ActionResult {
    const price = this.upgradePrice(id);
    if (price === null) return fail('Already maxed out.');
    if (id === 'tent' && this.s.camp.length >= RULES.maxCampSlots) return fail('Camp already has 8 spots.');
    if (id === 'squad' && this.s.team.length >= TEAM_MAX) return fail(`The team already has ${TEAM_MAX} spots.`);
    if (this.s.scrap < price) return fail(`Needs ${price.toLocaleString('en-US')} scrap.`);
    this.s.scrap -= price;
    this.s.upgrades[id] = this.up(id) + 1;
    if (id === 'tent') this.s.camp.push(null);
    if (id === 'bag') this.s.bagMax += 10;
    if (id === 'squad') while (this.s.team.length < this.teamMax) this.s.team.push(null);
    return OK;
  }

  /** Is this Greeble's caste favoured where camp is right now? */
  favored(g: Greeble) { return morph(g.sp).role === this.reg.favor; }
  /** Chance per tick this camper brings something back, and what. */
  jobOf(g: Greeble): { item: ItemId; chance: number } {
    const m = morph(g.sp); const j = JOB[m.role];
    const item: ItemId = m.role === 'mine' && this.s.region === 'glass' && g.lv >= 15 ? 'crystal' : j.item;
    const chance = Math.min(0.9, j.chance * this.quality(g) * (1 + (m.stage - 1) * 0.25) * (this.favored(g) ? FAVOR_MULT : 1) * (item === 'crystal' ? 0.4 : 1));
    return { item, chance };
  }
  private campPayout() {
    const ri = regionIndex(this.s.region);
    for (const u of this.s.camp) {
      const g = u ? this.get(u) : undefined; if (!g) continue;
      this.earn(this.yieldOf(g));
      const job = this.jobOf(g);
      if (this.rand() < job.chance) {
        const n = job.item === 'crystal' ? 1 : 1 + Math.floor(ri / 2) + Math.floor(g.lv / 20);
        this.give(job.item, n);
        this.s.gathered[job.item] = (this.s.gathered[job.item] ?? 0) + n;
      }
    }
  }

  /** The level cap just went up: banked xp pays out. */
  private raiseCap() {
    for (const g of this.s.bag) this.addXp(g, 0);
    this.emit({ t: 'capUp', cap: this.levelCap });
  }
  /** Pick what Auto-patrol fights next: the toughest patrol robot the ready team should beat. */
  autoPick(): { team: string[]; robot: string } | null {
    // it keeps enough energy back that the team is always ready for a boss
    const team = this.readyTeam(ENERGY_COST.patrol + AUTO_RESERVE).map(g => g.u);
    if (!team.length) return null;
    for (let i = ROBOTS.length - 1; i >= 0; i--) if (this.winOdds(team, ROBOTS[i].id, 'patrol') >= 0.7) return { team, robot: ROBOTS[i].id };
    return null;
  }
  /** Move camp + fights forward by `ms` (real or sped up). The wilds use real time: see updateWilds. */
  advance(ms: number, now = Date.now()) {
    if (!(ms > 0)) return;
    // in slices, so energy, fights and Auto-patrol take turns the same way online and offline
    let left = ms;
    while (left > 0) { const d = Math.min(left, RULES.campTickMs); this.step(d, now); left -= d; }
  }
  private step(ms: number, now: number) {
    this.s.campCarry += ms;
    while (this.s.campCarry >= RULES.campTickMs) { this.s.campCarry -= RULES.campTickMs; this.campPayout(); }
    // energy comes back (fastest while resting in camp)
    for (const g of this.s.bag) if (g.en < RULES.maxEnergy) g.en = Math.min(RULES.maxEnergy, g.en + ms / this.enMs(g));
    this.warmEggs(ms);
    if (!this.nestWhy()) {
      // eggs laid part-way through this step have been warming since they were laid (matters for long offline catch-ups)
      let at = NEST_MS - this.s.nestCarry;   // ms into this step when the next egg drops
      this.s.nestCarry += ms;
      while (this.s.nestCarry >= NEST_MS && !this.nestWhy()) {
        this.s.nestCarry -= NEST_MS; this.layEgg();
        const egg = this.s.eggs[this.s.eggs.length - 1];
        egg.left = Math.max(0, egg.left - Math.max(0, ms - at));
        at += NEST_MS;
      }
      if (this.nestWhy()) this.s.nestCarry = 0;
    }
    const press = this.up('press');
    if (press) {
      this.s.pressCarry += ms * press;
      const made = Math.floor(this.s.pressCarry / PRESS_MS_PER_SNARE);
      if (made) { this.s.pressCarry -= made * PRESS_MS_PER_SNARE; this.give('snare', made); }
    }
    // fights and Auto-patrol share this slice's time exactly (time left after a fight ends counts toward the next one)
    let budget = ms;
    for (let guard = 0; budget > 0 && guard < 50; guard++) {
      const f = this.s.fight;
      if (f) {
        f.carry += budget; budget = 0;
        while (this.s.fight === f && f.carry >= RULES.fightTickMs) { f.carry -= RULES.fightTickMs; this.fightRound(now); }
        if (this.s.fight !== f) { budget = f.carry; this.s.patrolCarry = 0; }
      } else if (this.s.autoPatrol && !this.s.enc) {
        const need = RULES.patrolGapMs - this.s.patrolCarry;
        if (budget < need) { this.s.patrolCarry += budget; budget = 0; break; }
        budget -= need; this.s.patrolCarry = 0;
        const pick = this.autoPick();   // nobody ready = look again after another gap
        if (pick) this.startFight(pick.team, pick.robot, 'patrol', true);
      } else break;
    }
  }

  /** Offline catch-up: camp (capped) + the wilds. Returns what happened for the welcome-back card. */
  catchUp(ms: number, now = Date.now()): { ms: number; scrap: number; levels: number; waiting: number; got: Partial<Record<ItemId, number>>; eggs: number; wins: number } {
    const capped = Math.min(Math.max(0, ms), this.offlineCap);
    const before = this.s.scrap;
    const g0 = { ...this.s.gathered };
    this.advance(capped, now);
    this.updateWilds(now);
    const evs = this.drain();
    const levels = evs.filter(e => e.t === 'level').length;
    const eggs = evs.filter(e => e.t === 'eggLaid').length;
    const wins = evs.filter(e => e.t === 'fightWon').length;
    const got: Partial<Record<ItemId, number>> = {};
    for (const [k, v] of Object.entries(this.s.gathered) as [ItemId, number][]) { const d = v - (g0[k] ?? 0); if (d > 0) got[k] = d; }
    return { ms: capped, scrap: this.s.scrap - before, levels, waiting: this.here.length, got, eggs, wins };
  }
}

/** Old (0.1 - 0.5) or hand-edited saves are cleaned up here so a bad blob can never crash the game. */
export function migrate(raw: any, now = Date.now()): GameState {
  const fresh = newGame(undefined, now);
  if (!raw || typeof raw !== 'object') return fresh;
  const num = (v: any, d: number) => (typeof v === 'number' && isFinite(v) ? v : d);
  // 0.13 changed the rules from the ground up (team, energy, candy, level caps), so older saves start over.
  if (num(raw.version, 0) < 9) {
    const played = (Array.isArray(raw.bag) && raw.bag.length > 0) || num(raw.stats?.caught, 0) > 0;
    if (played) fresh.newRules = true;
    return fresh;
  }
  const bagMax = Math.max(RULES.bagMax, Math.min(500, num(raw.bagMax, RULES.bagMax) | 0));
  const bag: Greeble[] = Array.isArray(raw.bag)
    ? raw.bag.filter((g: any) => g && typeof g.u === 'string' && hasMorph(g.sp))
        .map((g: any) => ({
          u: g.u, sp: g.sp, lv: Math.min(RULES.maxLevel, Math.max(1, num(g.lv, 1) | 0)), xp: Math.max(0, num(g.xp, 0)),
          // 0.1 Greebles had no stars: they come over as 3★ (a thank-you for playing early).
          stars: Math.min(5, Math.max(1, num(g.stars, 3) | 0)), prism: g.prism === true, en: Math.min(RULES.maxEnergy, Math.max(0, num(g.en, RULES.maxEnergy))), caughtAt: num(g.caughtAt, 0) || undefined,
        }))
        .slice(0, bagMax)
    : [];
  const ids = new Set(bag.map(g => g.u));
  const slots = Math.min(RULES.maxCampSlots, Math.max(RULES.campSlots, Array.isArray(raw.camp) ? raw.camp.length : RULES.campSlots));
  const camp: (string | null)[] = Array(slots).fill(null);
  if (Array.isArray(raw.camp)) raw.camp.slice(0, slots).forEach((u: any, i: number) => { if (typeof u === 'string' && ids.has(u) && !camp.includes(u)) camp[i] = u; });
  const teamLen = Math.min(TEAM_MAX, Math.max(RULES.teamSlots, Array.isArray(raw.team) ? raw.team.length : 0, RULES.teamSlots + Math.max(0, num(raw.upgrades?.squad, 0) | 0)));
  const team: (string | null)[] = Array(teamLen).fill(null);
  if (Array.isArray(raw.team)) raw.team.slice(0, teamLen).forEach((u: any, i: number) => { if (typeof u === 'string' && ids.has(u) && !camp.includes(u) && !team.includes(u)) team[i] = u; });
  let fight: Fight | null = null;
  const f = raw.fight;
  const regIds = REGIONS.map(r => r.id) as string[];
  if (f && typeof f === 'object') {
    // 0.2 fights had a single Greeble ({u, hp, maxHp, wreck}); 0.3 has a team.
    const team: Fighter[] = (Array.isArray(f.team) ? f.team : [{ u: f.u, hp: f.hp, maxHp: f.maxHp }])
      .filter((x: any) => x && ids.has(x.u) && team.includes(x.u)).slice(0, TEAM_MAX)
      .map((x: any) => ({ u: x.u, hp: num(x.hp, 1), maxHp: num(x.maxHp, 1), charge: Math.max(0, num(x.charge, 0) | 0), boost: x.boost === true }));
    const kind: FightKind = f.kind === 'boss' || f.kind === 'wreck' ? f.kind : f.wreck === true ? 'wreck' : 'patrol';
    if (team.length && (kind === 'boss' || robot(f.robot))) {
      fight = { team, u: team[0].u, robot: kind === 'boss' ? 'boss' : f.robot, robotHp: num(f.robotHp, 1), robotMax: num(f.robotMax, 1),
        carry: Math.max(0, num(f.carry, 0)), kind, reg: (regIds.includes(f.reg) ? f.reg : 'ash') as RegionId, ...(f.auto === true ? { auto: true } : {}) };
    }
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
          src: (['wild', 'crater', 'beacon', 'wreck', 'mythic', 'legend', 'lure'].includes(x.src) ? x.src : 'wild') as SpawnSrc, at: num(x.at, now), until: num(x.until, now), x: num(x.x, 0.5), y: num(x.y, 0.5),
          reg: (regIds.includes(x.reg) ? x.reg : 'ash') as RegionId }))
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
  const unlocked = Math.min(REGIONS.length, Math.max(1, num(raw.unlocked, 1) | 0));
  const reg = (regIds.includes(raw.region) && regIds.indexOf(raw.region) < unlocked ? raw.region : 'ash') as RegionId;
  const bossBeaten: Partial<Record<RegionId, number>> = {};
  for (const id of regIds) { const v = num(raw.bossBeaten?.[id], 0); if (v > 0) bossBeaten[id as RegionId] = v; }
  const upgrades: Partial<Record<UpgradeId, number>> = {};
  for (const u of UPGRADES) { const v = Math.min(u.prices.length, Math.max(0, num(raw.upgrades?.[u.id], 0) | 0)); if (v) upgrades[u.id] = v; }
  return {
    region: reg, unlocked, bossBeaten, upgrades, pressCarry: Math.max(0, num(raw.pressCarry, 0)),
    lure: raw.lure && LURES[raw.lure.id as LureId] && regIds.includes(raw.lure.reg) ? { id: raw.lure.id, reg: raw.lure.reg, until: num(raw.lure.until, 0), next: num(raw.lure.next, 0) } : null,
    ship: Object.fromEntries(SHIP_PARTS.filter(p => raw.ship?.[p.id] === true).map(p => [p.id, true])) as Partial<Record<PartId, true>>,
    signals: Math.max(0, num(raw.signals, 0) | 0), sp: Math.max(0, num(raw.sp, 0) | 0),
    perks: Object.fromEntries(PERKS.map(p => [p.id, Math.min(p.max, Math.max(0, num(raw.perks?.[p.id], 0) | 0))]).filter(([, v]) => v)) as Partial<Record<PerkId, number>>,
    expo: raw.expo && ids.has(raw.expo.u) && regIds.includes(raw.expo.reg) ? { u: raw.expo.u, until: num(raw.expo.until, 0), reg: raw.expo.reg } : null,
    expoDay: Math.max(0, num(raw.expoDay, 0) | 0),
    bestEver: { caught: Math.max(0, num(raw.bestEver?.caught, 0)), bosses: Math.max(0, num(raw.bestEver?.bosses, 0)) },
    nest: (() => { const n = Array.isArray(raw.nest) ? raw.nest : []; const free = (u: any) => typeof u === 'string' && ids.has(u) && !camp.includes(u) && !team.includes(u); const a = free(n[0]) ? n[0] : null; const b = free(n[1]) && n[1] !== a ? n[1] : null; return [a, b] as [string | null, string | null]; })(),
    team, autoPatrol: raw.autoPatrol !== false, patrolCarry: Math.max(0, num(raw.patrolCarry, 0)),
    candy: Object.fromEntries(Object.entries(raw.candy ?? {}).filter(([k, v]) => hasMorph(k) && typeof v === 'number' && isFinite(v) && v >= 0).map(([k, v]) => [k, Math.floor(v as number)])) as Record<string, number>,
    ...(raw.newRules === true ? { newRules: true } : {}),
    nestCarry: Math.max(0, num(raw.nestCarry, 0)),
    eggs: Array.isArray(raw.eggs) ? raw.eggs.filter((e: any) => e && typeof e.id === 'string' && hasMorph(e.sp)).slice(0, EGG_MAX)
      .map((e: any) => ({ id: e.id, sp: e.sp, prism: e.prism === true, stars: Math.min(5, Math.max(1, num(e.stars, 1) | 0)), left: Math.max(0, num(e.left, 0)), total: Math.max(1, num(e.total, 1)) })) : [],
    daily: raw.daily && typeof raw.daily.day === 'number' && Array.isArray(raw.daily.tasks)
      ? { day: raw.daily.day, bonus: raw.daily.bonus === true, tasks: raw.daily.tasks.filter((t: any) => t && typeof t.key === 'string').slice(0, DAILY_COUNT)
          .map((t: any) => ({ id: String(t.id), key: t.key, need: Math.max(1, num(t.need, 1) | 0), label: String(t.label ?? ''), base: num(t.base, 0), done: t.done === true })) }
      : null,
    // anyone who already played skips the walkthrough
    intro: typeof raw.intro === 'number' ? raw.intro : (bag.length > 0 || num(raw.stats?.caught, 0) > 0 ? 99 : 0),
    tally: Object.fromEntries(Object.entries(raw.tally ?? {}).filter(([k, v]) => typeof k === 'string' && typeof v === 'number' && isFinite(v) && v >= 0).slice(0, 200)) as Record<string, number>,
    hunts: Object.fromEntries(Object.entries(raw.hunts ?? {}).filter(([k, v]) => HUNTS.some(h => h.id === k) && typeof v === 'number' && v > 0)) as Record<string, number>,
    gathered: Object.fromEntries(Object.entries(raw.gathered ?? {}).filter(([k, v]) => k in ITEMS && typeof v === 'number' && v >= 0)) as Partial<Record<ItemId, number>>,
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
