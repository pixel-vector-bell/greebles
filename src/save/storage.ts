import { migrate, type GameState } from '../sim/world';

export const KEY = 'greebles.save.v1';

export function loadLocal(): GameState | null {
  try { const t = localStorage.getItem(KEY); return t ? migrate(JSON.parse(t)) : null; } catch { return null; }
}
export function saveLocal(s: GameState): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full / private mode */ }
}
export function wipeLocal(): void { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
