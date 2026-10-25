/**
 * Greebles content: every Greeble is the SAME species (a short, goblin-like native of the planet).
 * What differs is the MORPH (Ash, Tide, Scrap, ...) and the CASTE (the job it is good at).
 * Robots patrol the planet. They are enemies only — they never join the bag.
 */
export type Role = 'mine' | 'fish' | 'fight';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'chase';

export interface Morph {
  id: string;
  name: string;
  role: Role;
  rarity: Rarity;
  /** Grafting this morph up to `evoLv` turns it into `evo`. */
  evo?: string;
  evoLv?: number;
  mark: string;
  color: string;
}

export const MORPHS: Morph[] = [
  { id: 'gleck', name: 'Ash Greeble', role: 'mine', rarity: 'common', evo: 'gleckor', evoLv: 10, mark: '▲', color: '#6e5a88' },
  { id: 'gleckor', name: 'Hulking Ash', role: 'mine', rarity: 'uncommon', mark: '◆', color: '#4a3868' },
  { id: 'vorr', name: 'Moss Greeble', role: 'mine', rarity: 'common', mark: '⬡', color: '#8a6048' },
  { id: 'klyx', name: 'Glass Greeble', role: 'mine', rarity: 'common', mark: '✧', color: '#70c8c0' },
  { id: 'zoln', name: 'Ember Greeble', role: 'mine', rarity: 'uncommon', mark: '◉', color: '#c45a32' },
  { id: 'umberith', name: 'Umber Greeble', role: 'mine', rarity: 'uncommon', mark: '▣', color: '#5a4838' },
  { id: 'phaest', name: 'Prime Digger', role: 'mine', rarity: 'rare', evo: 'phaestyn', evoLv: 16, mark: '✦', color: '#d4a060' },
  { id: 'phaestyn', name: 'Titan Digger', role: 'mine', rarity: 'rare', mark: '✸', color: '#e8c878' },
  { id: 'quorvex', name: 'Apex Digger', role: 'mine', rarity: 'chase', mark: '★', color: '#e0c36a' },
  { id: 'nulith', name: 'Tide Greeble', role: 'fish', rarity: 'common', evo: 'nulithar', evoLv: 10, mark: '☽', color: '#4a88b8' },
  { id: 'nulithar', name: 'Deep Tide', role: 'fish', rarity: 'uncommon', mark: '☾', color: '#2a6088' },
  { id: 'iskari', name: 'Drift Greeble', role: 'fish', rarity: 'common', mark: '◇', color: '#7ec8e0' },
  { id: 'vesperid', name: 'Veil Greeble', role: 'fish', rarity: 'common', mark: '✧', color: '#8a70b0' },
  { id: 'thalune', name: 'Murk Greeble', role: 'fish', rarity: 'uncommon', mark: '≈', color: '#3a7080' },
  { id: 'orryx', name: 'Keen Trawler', role: 'fish', rarity: 'uncommon', mark: '◈', color: '#50a090' },
  { id: 'caelith', name: 'Prime Trawler', role: 'fish', rarity: 'rare', mark: '▽', color: '#a8d0e8' },
  { id: 'aelurion', name: 'Apex Trawler', role: 'fish', rarity: 'chase', mark: '✧', color: '#d0e8f0' },
  { id: 'draug', name: 'Scrap Greeble', role: 'fight', rarity: 'common', evo: 'draugoth', evoLv: 10, mark: '✕', color: '#8a3048' },
  { id: 'draugoth', name: 'Hulking Scrap', role: 'fight', rarity: 'uncommon', mark: '⚔', color: '#6a1830' },
  { id: 'velm', name: 'Rust Greeble', role: 'fight', rarity: 'common', mark: '△', color: '#c07050' },
  { id: 'skarnox', name: 'Thorn Greeble', role: 'fight', rarity: 'common', mark: '▽', color: '#607848' },
  { id: 'pyrrax', name: 'Cinder Greeble', role: 'fight', rarity: 'uncommon', mark: '▲', color: '#d05028' },
  { id: 'hokari', name: 'Hollow Greeble', role: 'fight', rarity: 'uncommon', mark: '☰', color: '#4a5068' },
  { id: 'nyxil', name: 'Prime Scrapper', role: 'fight', rarity: 'rare', mark: '▼', color: '#3a2048' },
  { id: 'myrrhax', name: 'Apex Scrapper', role: 'fight', rarity: 'chase', mark: '♔', color: '#e0c36a' },
];

/** Hunt weight per rarity (out of 100). */
export const WEIGHT: Record<Rarity, number> = { common: 56, uncommon: 28, rare: 12, chase: 4 };
/** Chance the Greeble follows you home once you meet it. */
export const CATCH: Record<Rarity, number> = { common: 0.9, uncommon: 0.7, rare: 0.4, chase: 0.12 };
/** Scrap per level when you sell one. */
export const SELL: Record<Rarity, number> = { common: 4, uncommon: 10, rare: 28, chase: 80 };
/** Base power by rarity (plus level). */
export const BASE_POWER: Record<Rarity, number> = { common: 2, uncommon: 3, rare: 5, chase: 8 };

export interface Robot { id: string; name: string; short: string; hp: number; atk: number; xp: number; }
export const ROBOTS: Robot[] = [
  { id: 'drone', name: 'Rust drone', short: 'Drone', hp: 16, atk: 3, xp: 8 },
  { id: 'pylon', name: 'Sentinel pylon', short: 'Pylon', hp: 32, atk: 7, xp: 18 },
  { id: 'colossus', name: 'Patrol colossus', short: 'Colossus', hp: 58, atk: 12, xp: 32 },
];

export const RULES = {
  /** Real cooldown between walks. (The spike used 1:00 while Josh was testing.) */
  huntMs: 5 * 60 * 1000,
  /** Chance a walk finds nothing at all. */
  emptyWalk: 0.2,
  bagMax: 50,
  campSlots: 4,
  /** Camp workers earn once per this many ms. */
  campTickMs: 15_000,
  campXp: 3,
  /** One round of a robot fight. */
  fightTickMs: 1000,
  maxLevel: 40,
  /** Offline catch-up is capped so a week away doesn't break the economy. */
  offlineCapMs: 8 * 60 * 60 * 1000,
  startScrap: 20,
} as const;

export const xpNeed = (lv: number) => 20 + lv * 12;

const byId = new Map(MORPHS.map(m => [m.id, m]));
export function morph(id: string): Morph {
  const m = byId.get(id);
  if (!m) throw new Error(`unknown morph ${id}`);
  return m;
}
export const hasMorph = (id: string) => byId.has(id);
export const robot = (id: string) => ROBOTS.find(r => r.id === id);

/** Evolved forms never show up on a walk — you only get them by grafting. */
export const WILD_MORPHS = MORPHS.filter(m => !MORPHS.some(x => x.evo === m.id));

export const roleLabel = (r: Role) => (r === 'mine' ? 'Dig' : r === 'fish' ? 'Trawl' : 'Skirmish');
