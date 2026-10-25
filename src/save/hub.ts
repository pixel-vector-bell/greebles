import { loadLocal } from './storage';
import { migrate, type GameState } from '../sim/world';
import { MORPHS } from '../sim/content';

/**
 * Cloud save through the IdleForge hub. Inside the hub (?hub=1) the game asks the parent page
 * for its cloud copy on start ("gr:hello" -> "gr:load") and hands every save back ("gr:save").
 * The hub keeps it in the player's account, so the same Greebles show up on phone and PC.
 * Rule: whichever copy was played most recently (lastSeen) wins.
 */
const inHub = () => new URLSearchParams(location.search).has('hub') && window.parent !== window;

export async function pickStartSave(): Promise<GameState | null> {
  const local = loadLocal();
  if (!inHub()) return local;
  try { if (sessionStorage.getItem('greebles.fresh')) { sessionStorage.removeItem('greebles.fresh'); return local; } } catch { /* ignore */ }
  const cloud = await new Promise<GameState | null>(resolve => {
    let finished = false;
    const done = (v: GameState | null) => {
      if (finished) return; finished = true;
      window.removeEventListener('message', on); clearInterval(again); clearTimeout(timer); resolve(v);
    };
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== window.parent || e.data?.type !== 'gr:load') return;
      try { done(e.data.json ? migrate(JSON.parse(e.data.json)) : null); } catch { done(null); }
    };
    const hello = () => window.parent.postMessage({ type: 'gr:hello' }, location.origin);
    const again = window.setInterval(hello, 300);
    const timer = window.setTimeout(() => done(null), 4000); // offline / old hub: play local
    window.addEventListener('message', on);
    hello();
  });
  if (cloud && (!local || cloud.lastSeen > local.lastSeen)) return cloud;
  return local;
}

export function summary(s: GameState): string {
  const caught = Object.keys(s.caught ?? {}).length;
  const wild = s.spawns?.length ?? 0;
  if (!s.bag.length) return wild ? `New — ${wild} Greebles are waiting in the wilds` : 'New — catch your first Greeble';
  const prism = s.bag.filter(g => g.prism).length;
  return `Guide ${caught}/${MORPHS.length}${prism ? ` · ✨${prism}` : ''} · ${s.bag.length} in bag${wild ? ` · ${wild} in the wilds` : ''}`;
}

export function sendToHub(s: GameState, flush = false): void {
  if (!inHub()) return;
  try { window.parent.postMessage({ type: 'gr:save', json: JSON.stringify(s), summary: summary(s), flush }, location.origin); } catch { /* ignore */ }
}

/** The hub asks for a last save when the player taps the back button. */
export function onHubFlush(cb: () => void): () => void {
  const on = (e: MessageEvent) => { if (e.origin === location.origin && e.data?.type === 'gr:flush') cb(); };
  window.addEventListener('message', on);
  return () => window.removeEventListener('message', on);
}
