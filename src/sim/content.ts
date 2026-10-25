/**
 * Greebles content. Every Greeble is the SAME species (a short, goblin-like native of the planet).
 * What differs is the KIND (Ash, Tide, Scrap, ...), its CASTE (the job it's good at) and its RARITY.
 * Kinds come in families of 1-3 stages; you only meet stage 1 (and Legendaries / Mythics) in the wilds,
 * the rest you get by evolving. Robots patrol the planet. They are enemies only — never caught.
 */
export type Role = 'mine' | 'fish' | 'fight';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type ItemId = 'snare' | 'good' | 'great' | 'star' | 'treat' | 'beacon' | 'ember' | 'pearl' | 'sun' | 'moon';
export type SnareId = 'snare' | 'good' | 'great' | 'star';
export type Tag = 'night' | 'storm';

export interface Evo { to: string; lv: number; item?: ItemId; night?: boolean }
export interface Morph {
  id: string; name: string; role: Role; rarity: Rarity; stage: 1 | 2 | 3;
  mark: string; color: string;
  evo?: Evo[];
  /** Shows up more at night / in storms. */
  tags?: Tag[];
  /** Only ever appears at night. */
  nightOnly?: boolean;
}

const k = (id: string, name: string, role: Role, rarity: Rarity, stage: 1 | 2 | 3, mark: string, color: string, more: Partial<Morph> = {}): Morph =>
  ({ id, name, role, rarity, stage, mark, color, ...more });

export const MORPHS: Morph[] = [
  // ── Dig ────────────────────────────────────────────────
  k('ashpup', 'Ash Pup', 'mine', 'common', 1, '▴', '#8a76a4', { evo: [{ to: 'gleck', lv: 10 }] }),
  k('gleck', 'Ash Greeble', 'mine', 'common', 2, '▲', '#6e5a88', { evo: [{ to: 'gleckor', lv: 25 }] }),
  k('gleckor', 'Hulking Ash', 'mine', 'common', 3, '◆', '#4a3868'),
  k('vorr', 'Moss Greeble', 'mine', 'common', 1, '⬡', '#7a8a48', { evo: [{ to: 'vorrak', lv: 12 }] }),
  k('vorrak', 'Moss Burrower', 'mine', 'common', 2, '⬢', '#5e7034', { evo: [{ to: 'vorrakan', lv: 28 }] }),
  k('vorrakan', 'Moss Titan', 'mine', 'common', 3, '❖', '#3e5222'),
  k('klyx', 'Glass Greeble', 'mine', 'uncommon', 1, '✧', '#70c8c0', { tags: ['storm'], evo: [{ to: 'klyxar', lv: 18, item: 'sun' }, { to: 'klyxen', lv: 18, item: 'moon' }] }),
  k('klyxar', 'Prism Greeble', 'mine', 'uncommon', 2, '✦', '#e8d070'),
  k('klyxen', 'Dusk Glass', 'mine', 'uncommon', 2, '✶', '#5a5aa8'),
  k('umberith', 'Umber Greeble', 'mine', 'uncommon', 1, '▣', '#7a5c44', { evo: [{ to: 'umberox', lv: 20 }] }),
  k('umberox', 'Umber Hulk', 'mine', 'uncommon', 2, '■', '#5a4030'),
  k('zoln', 'Ember Greeble', 'mine', 'rare', 1, '◉', '#c45a32', { evo: [{ to: 'zolnath', lv: 20, item: 'ember' }] }),
  k('zolnath', 'Magma Greeble', 'mine', 'rare', 2, '⬤', '#e0401a'),
  k('phaest', 'Prime Digger', 'mine', 'epic', 1, '✦', '#d4a060', { evo: [{ to: 'phaestyn', lv: 30 }] }),
  k('phaestyn', 'Titan Digger', 'mine', 'epic', 2, '✸', '#e8c878'),
  k('quorvex', 'Apex Digger', 'mine', 'legendary', 1, '★', '#e0c36a'),
  // ── Trawl ──────────────────────────────────────────────
  k('tidling', 'Tide Pup', 'fish', 'common', 1, '◗', '#6aa8d8', { evo: [{ to: 'nulith', lv: 10 }] }),
  k('nulith', 'Tide Greeble', 'fish', 'common', 2, '☽', '#4a88b8', { evo: [{ to: 'nulithar', lv: 25 }] }),
  k('nulithar', 'Deep Tide', 'fish', 'common', 3, '☾', '#2a6088'),
  k('iskari', 'Drift Greeble', 'fish', 'common', 1, '◇', '#7ec8e0', { tags: ['storm'], evo: [{ to: 'iskaran', lv: 14 }] }),
  k('iskaran', 'Drift Glider', 'fish', 'common', 2, '◈', '#4eb0d0'),
  k('vesperid', 'Veil Greeble', 'fish', 'uncommon', 1, '✧', '#8a70b0', { tags: ['night'], evo: [{ to: 'vesperax', lv: 16, night: true }] }),
  k('vesperax', 'Night Veil', 'fish', 'uncommon', 2, '✷', '#4a3078'),
  k('thalune', 'Murk Greeble', 'fish', 'uncommon', 1, '≈', '#3a7080', { tags: ['storm'], evo: [{ to: 'thalorn', lv: 18, item: 'pearl' }] }),
  k('thalorn', 'Murk Leviathan', 'fish', 'uncommon', 2, '≋', '#1e5060'),
  k('orryx', 'Keen Trawler', 'fish', 'rare', 1, '◈', '#50a090', { evo: [{ to: 'orryxan', lv: 24 }] }),
  k('orryxan', 'Keen Harpooner', 'fish', 'rare', 2, '➶', '#2e8070'),
  k('caelith', 'Prime Trawler', 'fish', 'epic', 1, '▽', '#a8d0e8', { evo: [{ to: 'caelithar', lv: 30 }] }),
  k('caelithar', 'Sky Trawler', 'fish', 'epic', 2, '▼', '#d0e8ff'),
  k('aelurion', 'Apex Trawler', 'fish', 'legendary', 1, '❂', '#d0e8f0'),
  // ── Skirmish ───────────────────────────────────────────
  k('scrappling', 'Scrap Pup', 'fight', 'common', 1, '×', '#a04860', { evo: [{ to: 'draug', lv: 10 }] }),
  k('draug', 'Scrap Greeble', 'fight', 'common', 2, '✕', '#8a3048', { evo: [{ to: 'draugoth', lv: 25 }] }),
  k('draugoth', 'Hulking Scrap', 'fight', 'common', 3, '⚔', '#6a1830'),
  k('velm', 'Rust Greeble', 'fight', 'common', 1, '△', '#c07050', { evo: [{ to: 'velmor', lv: 14 }] }),
  k('velmor', 'Rust Brawler', 'fight', 'common', 2, '▲', '#a05030'),
  k('skarnox', 'Thorn Greeble', 'fight', 'common', 1, '▽', '#607848', { evo: [{ to: 'skarnex', lv: 14 }] }),
  k('skarnex', 'Bramble Greeble', 'fight', 'common', 2, '✣', '#405a2c'),
  k('hokari', 'Hollow Greeble', 'fight', 'uncommon', 1, '☰', '#4a5068', { tags: ['night'], evo: [{ to: 'hokarion', lv: 18, night: true }] }),
  k('hokarion', 'Hollow Shade', 'fight', 'uncommon', 2, '☷', '#2a3048'),
  k('pyrrax', 'Cinder Greeble', 'fight', 'rare', 1, '▲', '#d05028', { evo: [{ to: 'pyrraxis', lv: 20, item: 'ember' }] }),
  k('pyrraxis', 'Inferno Greeble', 'fight', 'rare', 2, '✹', '#f03a10'),
  k('nyxil', 'Prime Scrapper', 'fight', 'epic', 1, '▼', '#5a3a78', { evo: [{ to: 'nyxilar', lv: 30 }] }),
  k('nyxilar', 'Void Scrapper', 'fight', 'epic', 2, '✠', '#2a1848'),
  k('myrrhax', 'Apex Scrapper', 'fight', 'legendary', 1, '♔', '#e0c36a'),
  // ── Mythic ─────────────────────────────────────────────
  k('starborn', 'Starborn Greeble', 'fight', 'mythic', 1, '✺', '#ff8ad8', { tags: ['night'], nightOnly: true }),
];

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
export const RARITY_LABEL: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic' };
/** How often each tier shows up in the wilds (out of 100). */
export const TIER_WEIGHT: Record<Rarity, number> = { common: 55, uncommon: 27, rare: 12, epic: 5, legendary: 0.9, mythic: 0.1 };
/** Catch chance with a plain Snare and an okay throw. */
export const CATCH_BASE: Record<Rarity, number> = { common: 0.55, uncommon: 0.38, rare: 0.25, epic: 0.14, legendary: 0.07, mythic: 0.04 };
/** Chance it runs off after breaking free. */
export const FLEE: Record<Rarity, number> = { common: 0.08, uncommon: 0.12, rare: 0.2, epic: 0.25, legendary: 0.3, mythic: 0.35 };
/** Scrap per level when you sell one. */
export const SELL: Record<Rarity, number> = { common: 4, uncommon: 10, rare: 28, epic: 60, legendary: 200, mythic: 500 };
export const BASE_POWER: Record<Rarity, number> = { common: 2, uncommon: 3, rare: 5, epic: 7, legendary: 10, mythic: 12 };
/** Highest level a wild one can have. */
export const WILD_MAX_LV: Record<Rarity, number> = { common: 5, uncommon: 8, rare: 12, epic: 15, legendary: 20, mythic: 25 };

export const SNARES: SnareId[] = ['snare', 'good', 'great', 'star'];
export const SNARE_MULT: Record<SnareId, number> = { snare: 1, good: 1.6, great: 2.3, star: Infinity };
/** Okay / Nice / Great / Perfect throw. */
export const THROW_MULT = [1, 1.25, 1.5, 1.9] as const;
export const THROW_LABEL = ['', 'Nice!', 'Great!', 'Perfect!'] as const;
export const TREAT_MULT = 1.5;
/** 1 to 5 quality stars, rolled on every Greeble in the wilds. */
export const STAR_WEIGHTS = [40, 30, 18, 9, 3];

export interface ItemDef { name: string; icon: string; desc: string; price?: number }
export const ITEMS: Record<ItemId, ItemDef> = {
  snare: { name: 'Snare', icon: '🟢', desc: 'A basic snare.', price: 10 },
  good: { name: 'Good Snare', icon: '🔵', desc: 'Catches 1.6× better.', price: 40 },
  great: { name: 'Great Snare', icon: '🟣', desc: 'Catches 2.3× better.', price: 120 },
  star: { name: 'Star Snare', icon: '🌟', desc: 'Never misses. Found, not sold.' },
  treat: { name: 'Glowmoss Treat', icon: '🍃', desc: 'Calms a Greeble: next throw 1.5× better.', price: 25 },
  beacon: { name: 'Beacon', icon: '🛰️', desc: '30 minutes of Greebles wandering in fast.', price: 300 },
  ember: { name: 'Ember Core', icon: '🔥', desc: 'Evolves Ember and Cinder Greebles.', price: 800 },
  pearl: { name: 'Tide Pearl', icon: '🫧', desc: 'Evolves Murk Greebles.', price: 800 },
  sun: { name: 'Sun Prism', icon: '🌞', desc: 'Evolves a Glass Greeble into a Prism Greeble.', price: 800 },
  moon: { name: 'Moon Prism', icon: '🌙', desc: 'Evolves a Glass Greeble into a Dusk Glass.', price: 800 },
};
export const EVO_ITEMS: ItemId[] = ['ember', 'pearl', 'sun', 'moon'];
export const START_ITEMS: Partial<Record<ItemId, number>> = { snare: 20, good: 3, treat: 3 };

export interface Robot { id: string; name: string; short: string; hp: number; atk: number; xp: number; weight: number }
export const ROBOTS: Robot[] = [
  { id: 'drone', name: 'Rust drone', short: 'Drone', hp: 16, atk: 3, xp: 8, weight: 50 },
  { id: 'pylon', name: 'Sentinel pylon', short: 'Pylon', hp: 32, atk: 7, xp: 18, weight: 35 },
  { id: 'colossus', name: 'Patrol colossus', short: 'Colossus', hp: 58, atk: 12, xp: 32, weight: 15 },
];

const MIN = 60_000, HOUR = 60 * MIN;
export const RULES = {
  // the wilds
  ambientMinMs: 10 * MIN, ambientMaxMs: 20 * MIN,   // a Greeble wanders in about every 15 min…
  ambientCap: 6,                                    // …up to 6 waiting…
  ambientLifeMs: 2 * HOUR,                          // …and each stays 2 hours.
  hotMinMs: 60_000, hotMaxMs: 120_000,              // Glow Crater / Beacon spawn every 1-2 min
  craterBlockMs: 3 * HOUR, craterLenMs: 30 * MIN, craterChance: 0.75, craterCap: 5,
  beaconLenMs: 30 * MIN, beaconCap: 4, beaconLifeMs: 15 * MIN,
  wreckFirstMs: 45 * MIN, wreckMinMs: 2 * HOUR, wreckMaxMs: 4 * HOUR, wreckLifeMs: HOUR,
  wreckBurst: 4, wreckSpawnLifeMs: 20 * MIN, wreckHpMult: 1.5,
  dayMs: 2 * HOUR, nightStartMs: 80 * MIN,          // 80 min day, 40 min night
  stormBlockMs: 2 * HOUR, stormLenMs: 40 * MIN, stormChance: 0.25,
  prismOdds: 1 / 400,
  /** Offline, only the last few hours of the wilds matter (everything older has wandered off). */
  wildSimMaxMs: 3 * HOUR,
  // camp / bag / fights
  bagMax: 50, campSlots: 4, maxCampSlots: 8,
  campTickMs: 15_000, campXp: 3,
  fightTickMs: 1000, maxLevel: 40,
  offlineCapMs: 8 * HOUR,
  startScrap: 50,
} as const;

export const xpNeed = (lv: number) => 20 + lv * 12;

/** Field guide rewards for catching N different kinds. */
export interface Reward { id: string; need: number; label: string; give: Partial<Record<ItemId | 'bag' | 'camp', number>> }
export const REWARDS: Reward[] = [
  { id: 'c3', need: 3, label: '5 Good Snares', give: { good: 5 } },
  { id: 'c6', need: 6, label: '+10 bag space', give: { bag: 10 } },
  { id: 'c10', need: 10, label: 'A 5th camp spot', give: { camp: 1 } },
  { id: 'c15', need: 15, label: '3 Great Snares + a Beacon', give: { great: 3, beacon: 1 } },
  { id: 'c20', need: 20, label: '+10 bag space', give: { bag: 10 } },
  { id: 'c25', need: 25, label: 'A 6th camp spot', give: { camp: 1 } },
  { id: 'c30', need: 30, label: 'A Star Snare + 2 Beacons', give: { star: 1, beacon: 2 } },
  { id: 'c35', need: 35, label: 'One of every evolution item', give: { ember: 1, pearl: 1, sun: 1, moon: 1 } },
  { id: 'c40', need: 40, label: 'A 7th camp spot + 20 bag space', give: { camp: 1, bag: 20 } },
  { id: 'c45', need: 45, label: '3 Star Snares + an 8th camp spot', give: { star: 3, camp: 1 } },
];

const byId = new Map(MORPHS.map(m => [m.id, m]));
export function morph(id: string): Morph {
  const m = byId.get(id);
  if (!m) throw new Error(`unknown kind ${id}`);
  return m;
}
export const hasMorph = (id: string) => byId.has(id);
export const robot = (id: string) => ROBOTS.find(r => r.id === id);
/** Only stage 1 shows up in the wilds. */
export const SPAWNABLE = MORPHS.filter(m => m.stage === 1);
/** Families for the field guide: each stage-1 kind and everything it can become. */
export const FAMILIES: Morph[][] = SPAWNABLE.map(root => {
  const out: Morph[] = [];
  const walk = (m: Morph) => { out.push(m); for (const e of m.evo ?? []) walk(morph(e.to)); };
  walk(root);
  return out;
});
export const roleLabel = (r: Role) => (r === 'mine' ? 'Dig' : r === 'fish' ? 'Trawl' : 'Skirmish');
const ROLES: Role[] = ['mine', 'fish', 'fight'];

// ── the planet's clock: day/night, storms, Glow Craters ──────────
/** Small integer hash, so the planet's schedule is the same on every device. */
export function hash32(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}
const mod = (a: number, b: number) => ((a % b) + b) % b;
export const isNight = (t: number) => mod(t, RULES.dayMs) >= RULES.nightStartMs;
/** ms until day turns to night (or night to day). */
export const untilFlip = (t: number) => { const p = mod(t, RULES.dayMs); return p < RULES.nightStartMs ? RULES.nightStartMs - p : RULES.dayMs - p; };

export interface Window { start: number; end: number; on: boolean }
function windowAt(t: number, block: number, len: number, chance: number, salt: number): (Window & { h: number }) | null {
  const b = Math.floor(t / block);
  const h = hash32(b * 7 + salt);
  if (h % 1000 >= chance * 1000) return null;
  const start = b * block + ((h >>> 10) % (block - len));
  return { start, end: start + len, on: t >= start && t < start + len, h };
}
export function stormAt(t: number): Window | null { return windowAt(t, RULES.stormBlockMs, RULES.stormLenMs, RULES.stormChance, 2); }
export function craterAt(t: number): (Window & { role: Role }) | null {
  const w = windowAt(t, RULES.craterBlockMs, RULES.craterLenMs, RULES.craterChance, 1);
  return w && { start: w.start, end: w.end, on: w.on, role: ROLES[(w.h >>> 24) % 3] };
}
