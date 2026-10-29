/**
 * Greebles content. Every Greeble is the SAME species (a short, goblin-like native of the planet).
 * What differs is the KIND (Ash, Tide, Scrap, ...), its CASTE (the job it's good at) and its RARITY.
 * Kinds come in families of 1-3 stages; you only meet stage 1 (and Legendaries / Mythics) in the wilds,
 * the rest you get by evolving. Robots patrol the planet. They are enemies only — never caught.
 */
export type Role = 'mine' | 'fish' | 'fight';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type ItemId = 'snare' | 'good' | 'great' | 'star' | 'treat' | 'beacon' | 'ember' | 'pearl' | 'sun' | 'moon' | 'gear' | 'core'
  | 'ore' | 'kelp' | 'crystal' | 'lureDig' | 'lureTrawl' | 'lureFight' | 'lureRare';
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
  // ── 0.3: Tide Pools ────────────────────────────────────
  k('shellit', 'Shell Greeble', 'fish', 'common', 1, '◒', '#c8a070', { evo: [{ to: 'shellor', lv: 16 }] }),
  k('shellor', 'Shellback Greeble', 'fish', 'common', 2, '◓', '#a07848'),
  k('coralin', 'Coral Greeble', 'fish', 'uncommon', 1, '✿', '#e07888', { evo: [{ to: 'coraleth', lv: 20, item: 'pearl' }] }),
  k('coraleth', 'Reef Greeble', 'fish', 'uncommon', 2, '❀', '#c04868'),
  // ── 0.3: Rust Fields ───────────────────────────────────
  k('boltik', 'Bolt Greeble', 'fight', 'common', 1, 'ϟ', '#d8c040', { tags: ['storm'], evo: [{ to: 'boltrax', lv: 16 }] }),
  k('boltrax', 'Volt Greeble', 'fight', 'common', 2, '⚡', '#e8a820', { evo: [{ to: 'boltaros', lv: 30 }] }),
  k('boltaros', 'Storm Volt', 'fight', 'common', 3, '☈', '#f0d050'),
  k('cogling', 'Cog Greeble', 'mine', 'uncommon', 1, '⚙', '#8a8a98', { evo: [{ to: 'cogmaw', lv: 20 }] }),
  k('cogmaw', 'Gear Greeble', 'mine', 'uncommon', 2, '⛭', '#5a5a6a'),
  // ── 0.3: Glass Spires ──────────────────────────────────
  k('shardy', 'Shard Greeble', 'mine', 'common', 1, '◆', '#90d8f0', { evo: [{ to: 'shardon', lv: 18 }] }),
  k('shardon', 'Crystal Greeble', 'mine', 'common', 2, '❖', '#60b8e8', { evo: [{ to: 'shardros', lv: 32, night: true }] }),
  k('shardros', 'Spire Greeble', 'mine', 'common', 3, '⟁', '#3a90d8'),
  k('lumen', 'Glow Greeble', 'fish', 'rare', 1, '✺', '#f0f0a0', { tags: ['night'], evo: [{ to: 'lumenar', lv: 24, item: 'sun' }] }),
  k('lumenar', 'Radiant Greeble', 'fish', 'rare', 2, '☀', '#fff0a0'),
  k('aurelith', 'Crystal Sovereign', 'mine', 'legendary', 1, '♛', '#a8f0ff'),
  // ── 0.8: Void Rift ─────────────────────────────────────
  k('riftling', 'Rift Pup', 'fight', 'common', 1, '◌', '#6a4aa0', { evo: [{ to: 'riftor', lv: 26 }] }),
  k('riftor', 'Rift Greeble', 'fight', 'common', 2, '◍', '#503080', { evo: [{ to: 'riftmaw', lv: 34 }] }),
  k('riftmaw', 'Rift Breaker', 'fight', 'common', 3, '◎', '#341a60'),
  k('glimmet', 'Glimmer Greeble', 'fish', 'uncommon', 1, '✦', '#b0a0ff', { tags: ['storm'], evo: [{ to: 'glimmeron', lv: 28, night: true }] }),
  k('glimmeron', 'Starfall Greeble', 'fish', 'uncommon', 2, '✧', '#8070e0'),
  k('echolet', 'Echo Greeble', 'mine', 'rare', 1, '◔', '#60c0b0', { evo: [{ to: 'echoran', lv: 30, item: 'moon' }] }),
  k('echoran', 'Echo Warden', 'mine', 'rare', 2, '◕', '#309080'),
  k('riftking', 'Rift Sovereign', 'fight', 'legendary', 1, '♚', '#c8a8ff'),
  // ── Mythic ─────────────────────────────────────────────
  k('starborn', 'Starborn Greeble', 'fight', 'mythic', 1, '✺', '#ff8ad8', { tags: ['night'], nightOnly: true }),
  k('tidecrown', 'Tidecrown Greeble', 'fish', 'mythic', 1, '♕', '#40e0e0'),
  k('gearheart', 'Gearheart Greeble', 'fight', 'mythic', 1, '⚙', '#ffb040'),
  k('verdance', 'Verdant Greeble', 'mine', 'mythic', 1, '❦', '#60e070'),
  k('riftborn', 'Riftborn Greeble', 'mine', 'mythic', 1, '✪', '#e070ff'),
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
  gear: { name: 'Robot Gear', icon: '⚙️', desc: 'Dropped by robots. Craft with it at the workbench.' },
  core: { name: 'Power Core', icon: '🔋', desc: 'A rare robot part from big robots and bosses.' },
  ore: { name: 'Ore', icon: '🪨', desc: 'Dug up by Dig Greebles in camp.' },
  kelp: { name: 'Kelp', icon: '🌱', desc: 'Pulled in by Trawl Greebles in camp.' },
  crystal: { name: 'Crystal', icon: '🔷', desc: 'Rare. Dig Greebles find it in the Glass Spires.' },
  lureDig: { name: 'Dig Bait', icon: '🟤', desc: '30 min: Greebles wander in fast, mostly Dig ones.' },
  lureTrawl: { name: 'Trawl Bait', icon: '🔵', desc: '30 min: Greebles wander in fast, mostly Trawl ones.' },
  lureFight: { name: 'Skirmish Bait', icon: '🔴', desc: '30 min: Greebles wander in fast, mostly Skirmish ones.' },
  lureRare: { name: 'Shiny Bait', icon: '🌈', desc: '30 min: Greebles wander in fast, rare ones 3× more, Prismatic 3× more.' },
};
export type LureId = 'lureDig' | 'lureTrawl' | 'lureFight' | 'lureRare';
export const LURES: Record<LureId, { role?: Role; rare?: boolean }> = { lureDig: { role: 'mine' }, lureTrawl: { role: 'fish' }, lureFight: { role: 'fight' }, lureRare: { rare: true } };
export const LURE_MS = 30 * 60 * 1000;
export const LURE_SPAWN_MIN = 3 * 60 * 1000, LURE_SPAWN_MAX = 6 * 60 * 1000;
/** Camp jobs: what each caste brings back (chance per 15 s tick, before bonuses). */
export const JOB: Record<Role, { item: ItemId; chance: number }> = { mine: { item: 'ore', chance: 0.12 }, fish: { item: 'kelp', chance: 0.12 }, fight: { item: 'gear', chance: 0.08 } };
export const FAVOR_MULT = 1.5;

// ── 0.4: crafting with robot parts ─────────────────────────
export interface Recipe { out: ItemId; n: number; cost: Partial<Record<ItemId, number>> }
export const RECIPES: Recipe[] = [
  { out: 'snare', n: 5, cost: { gear: 2 } },
  { out: 'snare', n: 5, cost: { ore: 3 } },
  { out: 'good', n: 1, cost: { gear: 3 } },
  { out: 'great', n: 1, cost: { ore: 5, kelp: 5 } },
  { out: 'treat', n: 2, cost: { kelp: 3 } },
  { out: 'lureDig', n: 1, cost: { ore: 12, gear: 2 } },
  { out: 'lureTrawl', n: 1, cost: { kelp: 12, gear: 2 } },
  { out: 'lureFight', n: 1, cost: { gear: 14 } },
  { out: 'lureRare', n: 1, cost: { crystal: 3, ore: 10, kelp: 10 } },
  { out: 'beacon', n: 1, cost: { gear: 15, core: 1 } },
  { out: 'ember', n: 1, cost: { ore: 25, core: 2 } },
  { out: 'pearl', n: 1, cost: { kelp: 25, core: 2 } },
  { out: 'sun', n: 1, cost: { crystal: 4, core: 2 } },
  { out: 'moon', n: 1, cost: { crystal: 4, core: 2 } },
  { out: 'star', n: 1, cost: { gear: 40, core: 5 } },
];

// ── 0.4: elements ──────────────────────────────────────────
export type Element = 'ash' | 'tide' | 'ember' | 'moss' | 'glass' | 'rust' | 'storm' | 'void';
export interface ElementDef { id: Element; name: string; icon: string; color: string; move: string }
export const ELEMENTS: Record<Element, ElementDef> = {
  ash: { id: 'ash', name: 'Ash', icon: '🌋', color: '#9a8aa8', move: 'Cinder Cloud' },
  tide: { id: 'tide', name: 'Tide', icon: '💧', color: '#4a9ad8', move: 'Riptide' },
  ember: { id: 'ember', name: 'Ember', icon: '🔥', color: '#e0602a', move: 'Flare Burst' },
  moss: { id: 'moss', name: 'Moss', icon: '🌿', color: '#6aa848', move: 'Vine Lash' },
  glass: { id: 'glass', name: 'Glass', icon: '💎', color: '#70d0e0', move: 'Prism Beam' },
  rust: { id: 'rust', name: 'Rust', icon: '🔩', color: '#b8704a', move: 'Scrap Toss' },
  storm: { id: 'storm', name: 'Storm', icon: '⚡', color: '#e0c840', move: 'Thunderclap' },
  void: { id: 'void', name: 'Void', icon: '🌀', color: '#a07ae0', move: 'Null Pulse' },
};
/** Who each element is strong against. (The reverse is weak.) */
export const STRONG: Record<Element, Element[]> = {
  tide: ['ember', 'rust'], ember: ['moss', 'glass'], moss: ['tide', 'ash'], ash: ['ember', 'storm'],
  storm: ['void', 'rust'], glass: ['storm', 'void'], rust: ['glass', 'moss'], void: ['ash', 'tide'],
};
export const STRONG_MULT = 1.5, WEAK_MULT = 0.67;
export function typeMult(att: Element, def: Element): number {
  if (STRONG[att].includes(def)) return STRONG_MULT;
  if (STRONG[def].includes(att)) return WEAK_MULT;
  return 1;
}
/** Element of every family (by stage-1 id), plus a few evolutions that change element. */
const FAMILY_EL: Record<string, Element> = {
  ashpup: 'ash', vorr: 'moss', klyx: 'glass', umberith: 'ash', zoln: 'ember', phaest: 'ember', quorvex: 'ash',
  tidling: 'tide', iskari: 'storm', vesperid: 'void', thalune: 'tide', orryx: 'tide', caelith: 'storm', aelurion: 'tide',
  scrappling: 'rust', velm: 'rust', skarnox: 'moss', hokari: 'void', pyrrax: 'ember', nyxil: 'void', myrrhax: 'rust',
  shellit: 'tide', coralin: 'moss', boltik: 'storm', cogling: 'rust', shardy: 'glass', lumen: 'glass', aurelith: 'glass', starborn: 'void',
  riftling: 'void', glimmet: 'storm', echolet: 'glass', riftking: 'void', tidecrown: 'tide', gearheart: 'rust', verdance: 'moss', riftborn: 'void',
};
const EL_OVERRIDE: Record<string, Element> = { klyxen: 'void', lumenar: 'ember', boltaros: 'storm', thalorn: 'void' };
/** Moves charge up one per round; tap at MOVE_CHARGE, or it fires by itself (weaker) at MOVE_AUTO. */
export const MOVE_CHARGE = 4, MOVE_AUTO = 6, MOVE_TAP_MULT = 3, MOVE_AUTO_MULT = 2;
export const EVO_ITEMS: ItemId[] = ['ember', 'pearl', 'sun', 'moon'];
export const START_ITEMS: Partial<Record<ItemId, number>> = { snare: 20, good: 3, treat: 3 };

export interface Robot { id: string; name: string; short: string; hp: number; atk: number; xp: number; weight: number; el: Element }
export const ROBOTS: Robot[] = [
  { id: 'drone', name: 'Rust drone', short: 'Drone', hp: 16, atk: 3, xp: 8, weight: 50, el: 'rust' },
  { id: 'pylon', name: 'Sentinel pylon', short: 'Pylon', hp: 32, atk: 7, xp: 18, weight: 35, el: 'storm' },
  { id: 'colossus', name: 'Patrol colossus', short: 'Colossus', hp: 58, atk: 12, xp: 32, weight: 15, el: 'ember' },
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
  campTickMs: 15_000,
  fightTickMs: 1000, maxLevel: 40,
  // 0.13: the team, energy and auto-patrol
  teamSlots: 3, maxEnergy: 10,
  /** One energy comes back this often while resting in camp… */
  enCampMs: 10 * MIN,
  /** …and this often anywhere else (on the team, in the bag). */
  enRestMs: 40 * MIN,
  /** Auto-patrol picks a new fight this long after the last one ends. */
  patrolGapMs: 2 * MIN,
  offlineCapMs: 8 * HOUR,
  startScrap: 50,
} as const;

/** 0.13: a much steeper curve (level 10 ≈ 1,060 xp in total, level 30 ≈ 15,500). */
export const xpNeed = (lv: number) => Math.round(30 + 10 * lv + 1.2 * lv * lv);
/** Highest level your Greebles can reach after beating N area bosses (in order). */
export const LEVEL_CAPS = [12, 20, 28, 34, 40] as const;
/** Xp past the cap is kept (up to this many of the next level's worth) and pays out when the cap goes up. */
export const XP_BANK_LEVELS = 1;
/** Energy each fighter spends to start a fight. */
export const ENERGY_COST = { patrol: 1, wreck: 2, boss: 3 } as const;
/** Auto-patrol stops when a Greeble is down to this much energy, so the team can always take on a boss. */
export const AUTO_RESERVE = 3;
/** Candy (one kind per family): how much you get. */
export const CANDY = { catch: 5, goodStars: 2, prismMult: 2, hatch: 8, home: 4, expo: 5 } as const;
/** Shared fight fuel. Trawlers make it in camp. The whole team spends it. */
export const RATION_CAP = 12;
export const RATION_RESERVE = 3;
export const RATION_START = 6;
export const RATION_COST = { patrol: 1, wreck: 2, boss: 3 } as const;
/** How long one Trawl camper takes to make 1 ration, by stage. */
export const RATION_MS: Record<1 | 2 | 3, number> = { 1: 26 * MIN, 2: 20 * MIN, 3: 16 * MIN };
/** Dig campers restock beacon charges (the stay-and-play button). */
export const BEACON_CHARGE_CAP = 3;
export const BEACON_CHARGE_START = 1;
export const BEACON_CHARGE_MS: Record<1 | 2 | 3, number> = { 1: 3 * HOUR, 2: 2 * HOUR, 3: 80 * MIN };
/** Campers gain 1 xp every this many camp ticks (a tick is 15 s). */
export const CAMP_XP_EVERY = 10;
/** Candy to evolve out of this stage (rare and epic families cost more). */
export function evoCandy(m: Morph): number {
  const pricey = m.rarity === 'rare' || m.rarity === 'epic' || m.rarity === 'legendary';
  return m.stage === 1 ? (pricey ? 50 : 25) : (pricey ? 120 : 60);
}
/** Scrap from camp and from patrols is much lower than before 0.13 (bosses still pay big). */
export const CAMP_SCRAP_MULT = 0.07, PATROL_SCRAP_MULT = 0.5;

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
  { id: 'c50', need: 50, label: '2 Star Snares + 3 Beacons', give: { star: 2, beacon: 3 } },
  { id: 'c55', need: 55, label: '+30 bag space', give: { bag: 30 } },
  { id: 'c60', need: 60, label: '5 Star Snares', give: { star: 5 } },
  { id: 'c65', need: 65, label: '3 Star Snares + 3 Shiny Bait', give: { star: 3, lureRare: 3 } },
];

// ── 0.3: areas of the planet ──────────────────────────────
export type RegionId = 'ash' | 'tide' | 'rust' | 'glass' | 'void';
export interface Boss { name: string; hp: number; atk: number; xp: number; scrap: number; el: Element }
export interface Region {
  id: RegionId; name: string; icon: string; blurb: string;
  /** Wild Greebles here are this many levels higher. */
  lvl: number;
  /** Campers of this caste work 1.5× better here. */
  favor: Role;
  /** Robots here are this much tougher. */
  mult: number;
  /** 0.13: patrol xp here (robots are tougher, but xp grows slowly so levelling stays steady). */
  xpMult: number;
  kinds: string[];
  legendary: string;
  boss: Boss;
}
export const REGIONS: Region[] = [
  { id: 'ash', name: 'Ash Flats', icon: '🏜️', blurb: 'Dusty, warm, and full of young Greebles.', lvl: 0, mult: 0.6, xpMult: 1, favor: 'mine',
    kinds: ['ashpup', 'vorr', 'scrappling', 'velm', 'skarnox', 'tidling', 'umberith', 'zoln', 'phaest'], legendary: 'quorvex',
    boss: { name: 'Rust Warden', hp: 1100, atk: 4, xp: 150, scrap: 300, el: 'rust' } },
  { id: 'tide', name: 'Tide Pools', icon: '🌊', blurb: 'Warm shallow water. Trawl Greebles love it here.', lvl: 5, mult: 2.2, xpMult: 0.7, favor: 'fish',
    kinds: ['tidling', 'iskari', 'vesperid', 'thalune', 'orryx', 'caelith', 'shellit', 'coralin', 'vorr'], legendary: 'aelurion',
    boss: { name: 'Tide Dredger', hp: 1950, atk: 5, xp: 400, scrap: 1200, el: 'tide' } },
  { id: 'rust', name: 'Rust Fields', icon: '⚙️', blurb: 'An old robot junkyard. The robots here hit hard.', lvl: 10, mult: 4, xpMult: 0.55, favor: 'fight',
    kinds: ['scrappling', 'velm', 'hokari', 'pyrrax', 'nyxil', 'umberith', 'zoln', 'boltik', 'cogling'], legendary: 'myrrhax',
    boss: { name: 'Scrap Colossus', hp: 3200, atk: 9, xp: 900, scrap: 4000, el: 'storm' } },
  { id: 'glass', name: 'Glass Spires', icon: '💎', blurb: 'Tall crystal towers that glow at night. The rarest Greebles live here.', lvl: 15, mult: 7, xpMult: 0.5, favor: 'mine',
    kinds: ['klyx', 'vesperid', 'hokari', 'shardy', 'lumen', 'iskari', 'phaest', 'caelith', 'nyxil'], legendary: 'aurelith',
    boss: { name: 'Prism Sentinel', hp: 9000, atk: 13, xp: 2000, scrap: 12000, el: 'glass' } },
  { id: 'void', name: 'Void Rift', icon: '🕳️', blurb: 'A crack in the planet where the sky leaks in. Robots guard it fiercely.', lvl: 20, mult: 12, xpMult: 0.65, favor: 'fight',
    kinds: ['riftling', 'glimmet', 'echolet', 'hokari', 'nyxil', 'vesperid', 'lumen', 'klyx'], legendary: 'riftking',
    boss: { name: 'Null Engine', hp: 13000, atk: 12, xp: 4000, scrap: 30000, el: 'void' } },
];
export const region = (id: string): Region => REGIONS.find(r => r.id === id) ?? REGIONS[0];
export const regionIndex = (id: string) => Math.max(0, REGIONS.findIndex(r => r.id === id));
export const BOSS_REMATCH_MS = 2 * 60 * 60 * 1000;
/** Most Greebles a team can ever have (start with RULES.teamSlots, buy more with the Team upgrade). */
export const TEAM_MAX = 6;
/** Robot stats in an area: tougher the further you go. */
export const robotIn = (rb: Robot, reg: Region) => ({ hp: Math.round(rb.hp * reg.mult), atk: Math.round(rb.atk * Math.sqrt(reg.mult)), xp: Math.round((rb.xp + 8) * reg.xpMult) });
/** Wild Greebles are always a few levels under your level cap, so you still have to train them. */
export const WILD_UNDER_CAP = 8;

// ── 0.3: camp upgrades (bought with scrap) ─────────────────
export type UpgradeId = 'tent' | 'bag' | 'away' | 'bench' | 'press' | 'squad' | 'bedroll';
export interface UpgradeDef { id: UpgradeId; name: string; icon: string; desc: string; prices: number[]; effect: (lv: number) => string }
export const UPGRADES: UpgradeDef[] = [
  { id: 'squad', name: 'Bigger team', icon: '🛡️', desc: 'One more team spot (up to 6).', prices: [3000, 12000, 40000], effect: lv => `${3 + lv} on the team` },
  { id: 'bedroll', name: 'Bedrolls', icon: '🛏️', desc: 'Greebles get energy back 25% faster.', prices: [2500, 9000, 30000], effect: lv => `+${lv * 25}% energy` },
  { id: 'tent', name: 'Extra tent', icon: '⛺', desc: 'One more camp spot (up to 8 total).', prices: [1500, 6000, 18000, 45000], effect: lv => `+${lv} spot${lv === 1 ? '' : 's'}` },
  { id: 'bag', name: 'Bigger bag', icon: '🎒', desc: '+10 bag space.', prices: [600, 1500, 3500, 8000, 16000, 30000, 50000, 80000], effect: lv => `+${lv * 10} space` },
  { id: 'away', name: 'Night watch', icon: '🔦', desc: 'Camp keeps earning longer while you are away.', prices: [2500, 9000, 24000, 50000], effect: lv => `${8 + lv * 4} h away` },
  { id: 'bench', name: 'Workbench', icon: '🔨', desc: 'Campers earn 10% more scrap.', prices: [900, 2500, 7000, 18000, 40000], effect: lv => `+${lv * 10}% scrap` },
  { id: 'press', name: 'Snare press', icon: '🟢', desc: 'Makes free Snares, even while you are away.', prices: [3000, 12000, 36000], effect: lv => `${lv * 2} Snares / hour` },
];
export const PRESS_MS_PER_SNARE = 30 * 60 * 1000;  // per level: 1 snare / 30 min

// ── 0.6: the long game ─────────────────────────────────────
export type PartId = 'hull' | 'engine' | 'fuel' | 'antenna' | 'nav';
export interface ShipPart { id: PartId; name: string; icon: string; desc: string; cost: Partial<Record<ItemId, number>>; scrap: number; needBoss?: RegionId }
export const SHIP_PARTS: ShipPart[] = [
  { id: 'hull', name: 'Patch the hull', icon: '🛡️', desc: 'Seal the cracks so the ship holds air.', cost: { ore: 60, gear: 40 }, scrap: 3000 },
  { id: 'engine', name: 'Rebuild the engine', icon: '⚙️', desc: 'Needs parts from the Tide Dredger.', cost: { gear: 120, core: 6 }, scrap: 10000, needBoss: 'tide' },
  { id: 'fuel', name: 'Brew fuel', icon: '🛢️', desc: 'Kelp makes surprisingly good rocket fuel.', cost: { kelp: 150, core: 8 }, scrap: 20000, needBoss: 'rust' },
  { id: 'antenna', name: 'Raise the antenna', icon: '📡', desc: 'Crystal focuses the signal.', cost: { crystal: 10, gear: 150, core: 10 }, scrap: 40000, needBoss: 'glass' },
  { id: 'nav', name: 'Fix the nav core', icon: '🧭', desc: 'The last piece. Then you can call home.', cost: { crystal: 20, core: 20 }, scrap: 80000, needBoss: 'glass' },
];
export type PerkId = 'lucky' | 'shine' | 'thrift' | 'pack' | 'roam' | 'watch';
export interface PerkDef { id: PerkId; name: string; icon: string; desc: string; max: number }
export const PERKS: PerkDef[] = [
  { id: 'lucky', name: 'Lucky hands', icon: '🍀', desc: '+10% catch chance', max: 5 },
  { id: 'shine', name: 'Shine sense', icon: '✨', desc: '+25% Prismatic odds', max: 4 },
  { id: 'thrift', name: 'Scrapper', icon: '🔩', desc: '+20% scrap from camp', max: 5 },
  { id: 'pack', name: 'Care package', icon: '📦', desc: 'Start each trip with +5 Good and +2 Great Snares', max: 3 },
  { id: 'roam', name: 'Greeble magnet', icon: '🧲', desc: '+1 Greeble can wait in the wilds', max: 3 },
  { id: 'watch', name: 'Night owl', icon: '🦉', desc: 'Camp earns +4 h longer while away', max: 3 },
];
/** Signal Points cost of the next level of a perk. */
export const perkCost = (lv: number) => lv + 1;
/** Each signal home makes the robots this much tougher — and pay this much more. */
export const SIGNAL_STEP = 0.5;

// ── 0.8: Mythic Hunts ──────────────────────────────────────
/** Tally keys counted over the whole game: 'catch', 'catch:<element>', 'perfect', 'patrol', 'wreck', 'boss:<area>', 'prism', 'evolve', 'expo', 'craft', 'night'. */
export interface HuntStep { label: string; key: string; need: number }
export interface Hunt { id: string; mythic: string; name: string; blurb: string; reg: RegionId; steps: HuntStep[]; night?: boolean }
export const HUNTS: Hunt[] = [
  { id: 'h_verd', mythic: 'verdance', name: 'The Green Whisper', reg: 'ash', blurb: 'Old Greebles say something green sleeps under Ash Flats.',
    steps: [{ label: 'Catch 15 Moss Greebles', key: 'catch:moss', need: 15 }, { label: 'Make 10 things at the Workbench', key: 'craft', need: 10 }, { label: 'Evolve 5 Greebles', key: 'evolve', need: 5 }] },
  { id: 'h_tide', mythic: 'tidecrown', name: 'Crown of the Tides', reg: 'tide', blurb: 'Bubbles rise in rings in the Tide Pools. Something is down there.',
    steps: [{ label: 'Catch 25 Tide Greebles', key: 'catch:tide', need: 25 }, { label: 'Land 15 Perfect throws', key: 'perfect', need: 15 }, { label: 'Beat the Tide Dredger 3 times', key: 'boss:tide', need: 3 }] },
  { id: 'h_gear', mythic: 'gearheart', name: 'The Ticking Heart', reg: 'rust', blurb: 'Deep in the junk you can hear ticking. It is not a robot.',
    steps: [{ label: 'Break 40 patrol robots', key: 'patrol', need: 40 }, { label: 'Clear 6 robot wrecks', key: 'wreck', need: 6 }, { label: 'Beat the Scrap Colossus 3 times', key: 'boss:rust', need: 3 }] },
  { id: 'h_star', mythic: 'starborn', name: 'Falling Star', reg: 'glass', night: true, blurb: 'On stormy nights, something bright falls over the Glass Spires.',
    steps: [{ label: 'Catch 30 Greebles at night', key: 'night', need: 30 }, { label: 'Catch 2 Prismatic Greebles', key: 'prism', need: 2 }, { label: 'Send 3 daily expeditions', key: 'expo', need: 3 }] },
  { id: 'h_rift', mythic: 'riftborn', name: 'Born of the Rift', reg: 'void', blurb: 'The Void Rift hums. Something wants out.',
    steps: [{ label: 'Catch 30 Void Greebles', key: 'catch:void', need: 30 }, { label: 'Beat the Null Engine 2 times', key: 'boss:void', need: 2 }, { label: 'Catch 100 Greebles (any)', key: 'catch', need: 100 }] },
];
/** Once a hunt is done, its Mythic waits this long in its area. */
export const HUNT_SPAWN_MS = 60 * 60 * 1000;

// ── 0.9: nest & eggs ───────────────────────────────────────
/** Two Greebles of the same family in the nest lay an egg about this often (keeps going while away). */
export const NEST_MS = 2 * 60 * 60 * 1000;
/** Eggs wait in the incubator; this many at once. */
export const EGG_MAX = 3;
/** How long an egg takes to hatch, by the rarity of what's inside. */
export const HATCH_MS: Record<Rarity, number> = { common: 60 * 60 * 1000, uncommon: 2 * 60 * 60 * 1000, rare: 4 * 60 * 60 * 1000, epic: 6 * 60 * 60 * 1000, legendary: 0, mythic: 0 };
/** Eggs are 3× more likely to be Prismatic than a wild Greeble (9× with a Prismatic parent). */
export const EGG_PRISM_MULT = 3;

// ── 0.9: daily tasks ───────────────────────────────────────
/** Each day you get 3 of these. `key` is a tally key (see HuntStep); `el` = pick an element you can catch. */
export interface TaskDef { id: string; key: string; need: number; label: string; el?: boolean }
export const TASK_POOL: TaskDef[] = [
  { id: 'catch8', key: 'catch', need: 8, label: 'Catch 8 Greebles' },
  { id: 'catch15', key: 'catch', need: 15, label: 'Catch 15 Greebles' },
  { id: 'catchEl', key: 'catch:', need: 4, label: 'Catch 4 {el} Greebles', el: true },
  { id: 'perfect', key: 'perfect', need: 3, label: 'Land 3 Perfect throws' },
  { id: 'nice', key: 'goodThrow', need: 6, label: 'Land 6 Nice (or better) throws' },
  { id: 'patrol', key: 'patrol', need: 8, label: 'Break 8 patrol robots' },
  { id: 'craft', key: 'craft', need: 2, label: 'Make 2 things at the Workbench' },
  { id: 'evolve', key: 'evolve', need: 1, label: 'Evolve a Greeble' },
  { id: 'hatch', key: 'hatch', need: 1, label: 'Hatch an egg' },
];
export const DAILY_COUNT = 3;
export const EXPEDITION_MS = 4 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;
export const SWARM_MULT = 8;

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
const rootOf = new Map<string, string>();
for (const fam of FAMILIES) for (const m of fam) rootOf.set(m.id, fam[0].id);
export const elementOf = (id: string): Element => EL_OVERRIDE[id] ?? FAMILY_EL[rootOf.get(id) ?? id] ?? 'ash';
/** The stage-1 kind a Greeble's family starts from (what hatches from its egg). */
export const familyRoot = (id: string) => rootOf.get(id) ?? id;
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
