import { useEffect, useRef, useState } from 'react';
import { World, newGame, type GameEvent, type Greeble, type Egg } from '../sim/world';
import { Intro } from './Intro';
import {
  FAMILIES, ITEMS, MORPHS, RARITY_LABEL, REWARDS, ROBOTS, RULES, SNARES, craterAt, isNight, morph, roleLabel, stormAt, untilFlip, xpNeed,
  REGIONS, TEAM_MAX, UPGRADES, region, robotIn, ENERGY_COST, AUTO_RESERVE, evoCandy, CANDY,
  ELEMENTS, MOVE_AUTO, MOVE_CHARGE, RECIPES, STRONG, elementOf, typeMult,
  LURES, SHIP_PARTS, PERKS, perkCost, EXPEDITION_MS, DAY_MS, WEEK_MS, HUNTS, EGG_MAX, familyRoot,
  type Element, type ItemId, type LureId, type RegionId,
} from '../sim/content';
import { saveLocal, wipeLocal } from '../save/storage';
import { onHubFlush, sendToHub } from '../save/hub';
import { devEnabled } from '../save/dev';
import { WhatsNew } from './WhatsNew';
import { Encounter } from './Encounter';
import { Badge, BossArt, RobotArt, El, Stars, fmtDur, fmtTime, n } from './bits';
import { sfx, setSound, soundOn, unlock } from './sfx';
import { SubTabs, useSub } from './Sub';
import pkg from '../../package.json';

type Tab = 'wilds' | 'camp' | 'bag' | 'fight' | 'shop' | 'ship' | 'guide';
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'wilds', icon: '🌿', label: 'Wilds' }, { id: 'camp', icon: '⛺', label: 'Camp' },
  { id: 'bag', icon: '🎒', label: 'Bag' }, { id: 'fight', icon: '⚔️', label: 'Fight' },
  { id: 'shop', icon: '🛒', label: 'Shop' }, { id: 'ship', icon: '🚀', label: 'Ship' }, { id: 'guide', icon: '📖', label: 'Guide' },
];

function message(e: GameEvent, w: World): string | null {
  switch (e.t) {
    case 'spawn': return e.prism ? `✨ Something is sparkling in the wilds…` : e.src === 'mythic' ? '🌠 Something strange fell from the stormy sky…' : null;
    case 'sold': return `Sent a ${morph(e.sp).name} home: +${CANDY.home} 🍬 ${morph(familyRoot(e.sp)).name} candy, +${n(e.scrap)} scrap.`;
    case 'capUp': return `🔓 Level cap raised! Your Greebles can now reach level ${e.cap}.`;
    case 'fightWon': {
      if (e.auto) return null;   // Auto-patrol wins are quiet (they add up on the Fight tab)
      const loot = Object.entries(e.loot).map(([k, v]) => `${v} ${ITEMS[k as ItemId].name}${v! > 1 ? 's' : ''}`).join(', ');
      return `${e.wreck ? '🔧 Wreck cleared! Greebles came out of hiding. ' : 'Won! '}+${n(e.scrap)} scrap${loot ? `, ${loot}` : ''}.`;
    }
    case 'fightLost': return e.auto ? null : `Your team lost that one. Knocked-out Greebles need to rest (camp is fastest).`;
    case 'canEvolve': { const g = w.get(e.u); return g ? `🌟 Your ${morph(g.sp).name} is ready to evolve! (Bag)` : null; }
    case 'wreck': return `🤖 A robot is guarding a wreck. Beat it on the Fight tab for a burst of Greebles!`;
    case 'reward': return `📖 Guide reward: ${e.label}!`;
    case 'beacon': return '🛰️ Beacon on! Greebles will wander in fast for 30 minutes.';
    case 'shipPart': return e.done ? '🚀 The ship is fixed! You can signal home now.' : `🔧 Ship repair done: ${SHIP_PARTS.find(p => p.id === e.id)?.name}.`;
    case 'expoBack': return `🧭 Your ${morph(e.sp).name} is back from its expedition with loot${e.greeble ? `, and a ${e.prism ? '✨ PRISMATIC ' : ''}${morph(e.greeble).name} followed it home!` : '!'}`;
    case 'lure': return `🪤 ${ITEMS[e.id].name} is out! Greebles will wander in for 30 minutes.`;
    case 'crafted': return `🔨 Made ${e.n} ${ITEMS[e.out].name}${e.n > 1 ? 's' : ''}.`;
    case 'move': { const g = w.get(e.u); return g ? `${ELEMENTS[elementOf(g.sp)].icon} ${ELEMENTS[elementOf(g.sp)].move}! ${n(e.dmg)} damage${e.mult > 1 ? ' — super strong!' : ''}` : null; }
    case 'bossLost': return `Your team was beaten by the ${region(e.reg).boss.name}. Level up, evolve, and try again!`;
    case 'huntDone': return `🌠 Mythic Hunt complete! Call ${morph(e.mythic).name} from the Guide tab (+1 Star Snare).`;
    case 'eggLaid': return `🥚 Your nest laid ${/^[AEIOU]/.test(morph(e.sp).name) ? 'an' : 'a'} ${morph(e.sp).name} egg!`;
    case 'eggReady': return `🐣 An egg is ready to hatch! (Camp)`;
    case 'task': return `📋 Daily task done: ${e.label}!`;
    case 'taskBonus': return '🎉 All 3 daily tasks done! Bonus: 2 Great Snares + a Shiny Bait.';
    case 'huntCall': return `🌠 ${morph(e.mythic).name} has appeared in ${region(HUNTS.find(h => h.id === e.id)!.reg).name}!`;
    default: return null;
  }
}

const TIPS: { id: string; tab: Tab; text: string }[] = [
  { id: 'wilds', tab: 'wilds', text: 'Greebles wander into the wilds over time, even when the game is closed (up to 6 at once). Tap one, then throw a snare when the ring is small!' },
  { id: 'camp', tab: 'camp', text: 'Campers earn scrap and bring back Ore, Kelp or Gears, even while the game is closed. They also rest here: energy comes back 4× faster in camp. Campers don\'t gain xp; only your team does.' },
  { id: 'bag', tab: 'bag', text: 'Evolving needs a level AND candy. Every Greeble you catch gives candy for its family, and sending extra copies home gives a little more.' },
  { id: 'fight', tab: 'fight', text: 'Only your Team fights, and each fight costs energy (⚡). Auto-patrol keeps fighting on its own while your team has energy. Swap tired Greebles for rested campers!' },
  { id: 'boss', tab: 'fight', text: 'Beat an area\'s boss to open the next area and raise your level cap. Bosses hit your whole team, so bring Greebles at the cap with the right element.' },
  { id: 'ship', tab: 'ship', text: 'Fix your ship piece by piece. When it\'s done, signal home: start a new, harder trip and earn Signal Points for perks that last forever.' },
  { id: 'shop', tab: 'shop', text: 'Spend scrap on snares, treats and Beacons, or craft them at the Workbench from robot parts.' },
];

/** Wide screens (PC / tablet landscape) get the two-pane layout: Wilds on the left, other tabs on the right. */
function useDesktop() {
  const q = '(min-width: 1000px) and (min-height: 560px)';
  const [d, setD] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q); const on = () => setD(m.matches);
    m.addEventListener('change', on); return () => m.removeEventListener('change', on);
  }, []);
  return d;
}

export function App({ start }: { start: ReturnType<typeof newGame> | null }) {
  const worldRef = useRef<World | null>(null);
  if (!worldRef.current) worldRef.current = new World(start);
  const world = worldRef.current;
  const dev = devEnabled();
  if (dev) (window as any).__gr = world;
  const [, setFrame] = useState(0);
  const redraw = () => setFrame(f => (f + 1) % 1e6);
  const [tab, setTab] = useState<Tab>('wilds');
  const [toast, setToast] = useState<string | null>(null);
  const [menu, setMenu] = useState<null | 'settings' | 'news' | 'dev' | 'reset'>(null);
  const desktop = useDesktop();
  const [away, setAway] = useState<null | { ms: number; scrap: number; levels: number; waiting: number; got: Partial<Record<ItemId, number>>; eggs: number; wins: number }>(null);
  const [bossWin, setBossWin] = useState<null | Extract<GameEvent, { t: 'bossWon' }>>(null);
  const [evolving, setEvolving] = useState<null | { from: string; to: string; prism: boolean }>(null);
  const [hatched, setHatched] = useState<null | { sp: string; prism: boolean; stars: number }>(null);
  const [encOpen, setEncOpen] = useState(() => !!world.s.enc);
  const [encKey, setEncKey] = useState(0);
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1); speedRef.current = speed;

  const flushEvents = () => {
    const evs = world.drain();
    const evo = evs.find(e => e.t === 'evolved') as Extract<GameEvent, { t: 'evolved' }> | undefined;
    const bw = evs.find(e => e.t === 'bossWon') as Extract<GameEvent, { t: 'bossWon' }> | undefined;
    if (bw) setBossWin(bw);
    const ht = evs.find(e => e.t === 'hatched') as Extract<GameEvent, { t: 'hatched' }> | undefined;
    if (ht) setHatched({ sp: ht.sp, prism: ht.prism, stars: ht.stars });
    if (evo) setEvolving({ from: evo.from, to: evo.to, prism: !!world.get(evo.u)?.prism });
    // sounds (one per batch, most exciting wins)
    const has = (t: GameEvent['t']) => evs.some(e => e.t === t);
    if (bw) sfx.boss(); else if (evo) sfx.evolve(); else if (has('huntDone') || has('huntCall')) sfx.mythic();
    else if (has('hatched')) sfx.caughtRare(); else if (has('taskBonus') || has('task')) sfx.win(); else if (has('eggLaid') || has('eggReady')) sfx.spawn();
    else if (has('fightWon')) sfx.win(); else if (has('fightLost') || has('bossLost')) sfx.lose();
    else if (has('move')) sfx.move(); else if (has('crafted') || has('sold') || has('shipPart')) sfx.coin();
    else if (evs.some(e => e.t === 'spawn' && (e.prism || e.src === 'mythic'))) sfx.mythic();
    const msgs = evs.map(e => message(e, world)).filter(Boolean) as string[];
    if (msgs.length) setToast(msgs[msgs.length - 1]);
  };
  const save = (flush = false) => { world.s.lastSeen = Date.now(); saveLocal(world.s); sendToHub(world.s, flush); };
  const act = (r: { ok: boolean; why?: string }) => { if (!r.ok && r.why) setToast(r.why); flushEvents(); save(); redraw(); };

  // offline catch-up, then a 250 ms loop
  useEffect(() => {
    const now = Date.now();
    const gone = now - world.s.lastSeen;
    const r = world.catchUp(gone, now);
    if (gone >= 10 * 60_000 && (r.scrap > 0 || r.waiting > 0 || r.eggs > 0 || r.wins > 0) && world.s.intro >= 99 && !world.s.newRules) setAway(r);
    let last = Date.now();
    const iv = window.setInterval(() => {
      const t = Date.now();
      world.advance((t - last) * speedRef.current, t);
      world.updateWilds(t);
      last = t;
      flushEvents();
      redraw();
    }, 250);
    return () => clearInterval(iv);
  }, []);

  // saving: every 5 s, on hide, and when the hub asks
  useEffect(() => {
    const iv = window.setInterval(() => save(), 5000);
    const vis = () => { if (document.hidden) save(true); };
    document.addEventListener('visibilitychange', vis);
    const hide = () => save(true);
    window.addEventListener('pagehide', hide);
    const off = onHubFlush(() => save(true));
    save();
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', hide); off(); };
  }, []);

  // toasts wait while a big pop-up is open, then show for 3.2 s
  const popup = !!(evolving || hatched || bossWin);
  useEffect(() => { if (!toast || popup) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast, popup]);

  const s = world.s;
  const now = Date.now();
  const tip = s.intro < 99 ? undefined : TIPS.find(t => t.tab === tab && !s.tips[t.id]);
  const closeTip = (id: string) => { s.tips[id] = true; save(); redraw(); };
  const readyToEvolve = s.bag.some(g => world.evoOptions(g, now).some(o => o.ready));

  const startOver = () => {
    world.s = newGame();
    world.drain();
    wipeLocal();
    try { sessionStorage.setItem('greebles.fresh', '1'); } catch { /* ignore */ }
    save(true);
    setMenu(null); setTab('wilds'); setEncOpen(false); redraw();
  };
  // Desktop: Wilds always shows on the left, so the right pane shows Camp when "Wilds" is picked.
  const pane: Tab = desktop && tab === 'wilds' ? 'camp' : tab;
  const navEl = (
    <nav className={`gr-tabs ${desktop ? 'desk' : ''}`}>
      {TABS.filter(t => !desktop || t.id !== 'wilds').map(t => (
        <button key={t.id} className={pane === t.id ? 'on' : ''} onClick={() => { setTab(t.id); setToast(null); }}>
          <span className="gr-ti">{t.icon}</span><span>{t.label}</span>
          {t.id === 'wilds' && tab !== 'wilds' && world.here.length > 0 && <i className="gr-count">{world.here.length}</i>}
          {t.id === 'bag' && readyToEvolve && <i className="gr-dot gold" />}
          {t.id === 'camp' && s.eggs.some(e => e.left <= 0) && <i className="gr-dot gold" />}
          {t.id === 'guide' && HUNTS.some(h => world.huntState(h, now) === 'ready') && <i className="gr-dot gold" />}
          {t.id === 'fight' && (s.fight || s.wreck) && <i className={`gr-dot ${s.wreck ? 'gold' : 'red'}`} />}
        </button>
      ))}
    </nav>
  );
  const engage = (id: string) => { const r = world.startEncounter(id); if (!r.ok) act(r); else { setEncKey(k => k + 1); setEncOpen(true); save(); redraw(); } };

  return (
    <div className={`gr-app ${desktop ? 'desk' : ''}`} onPointerDown={unlock}>
      <header className="gr-top">
        <div className="gr-title"><b>GREEBLES</b><span>{world.reg.icon} {world.reg.name} {isNight(now) ? '🌙' : '☀️'}{stormAt(now)?.on ? '⛈️' : ''}</span></div>
        <div className="gr-sp" />
        <div className="gr-pill" title="Scrap">🔩 <span>{n(s.scrap)}</span></div>
        <button className="gr-icon" onClick={() => setMenu('news')} title="What's new">📜</button>
        <button className="gr-icon" onClick={() => setMenu('settings')} title="Settings">⚙</button>
      </header>
      <div className="gr-sub">Team {s.team.filter(Boolean).length}/{s.team.length} · Camp {s.camp.filter(Boolean).length}/{s.camp.length} · Bag {s.bag.length}/{s.bagMax} · 🔒 lv {world.levelCap} · 🟢 {world.count('snare')}{speed > 1 && <b className="gr-fast"> · ×{speed}</b>}</div>

      <div className="gr-body">
      {desktop && (
        <main className="gr-main gr-left">
          <WildsView w={world} now={now} engage={engage} act={act} />
        </main>
      )}
      <div className="gr-pane">
      {desktop && navEl}
      <main className="gr-main">
        {tip && <div className="gr-tip"><p>💡 {tip.text}</p><button onClick={() => closeTip(tip.id)}>Got it</button></div>}
        {pane === 'wilds' && <WildsView w={world} now={now} engage={engage} act={act} />}
        {pane === 'camp' && <CampView w={world} act={act} now={now} />}
        {pane === 'bag' && <BagView w={world} act={act} now={now} />}
        {pane === 'fight' && <FightView w={world} act={act} now={now} />}
        {pane === 'shop' && <ShopView w={world} act={act} now={now} />}
        {pane === 'ship' && <ShipView w={world} act={act} now={now} onSignal={() => { setTab('wilds'); setToast('📡 Signal sent! A new trip begins, and the robots are tougher now.'); }} />}
        {pane === 'guide' && <GuideView w={world} act={act} now={now} onGo={() => setTab('wilds')} />}
      </main>
      </div>
      </div>

      {!desktop && navEl}


      {toast && !evolving && !hatched && !bossWin && !encOpen && <div className="gr-toast" onClick={() => setToast(null)}>{toast}</div>}

      {encOpen && <Encounter key={encKey} w={world} act={act} onDone={() => { setEncOpen(false); world.s.enc = null; save(); redraw(); }} />}

      {evolving && (
        <div className="gr-sheet-back" onClick={() => setEvolving(null)}>
          <div className={`gr-sheet gr-evo ${evolving.prism ? 'prism' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="gr-evo-flash" />
            <h2>Your {morph(evolving.from).name} is changing!</h2>
            <div className="gr-evo-row">
              <div className="gr-evo-from"><Badge m={morph(evolving.from)} size={72} prism={evolving.prism} /></div>
              <span className="gr-evo-arrow">➜</span>
              <div className="gr-evo-to"><Badge m={morph(evolving.to)} size={96} prism={evolving.prism} /></div>
            </div>
            <p>It became a <b>{evolving.prism && '✨ '}{morph(evolving.to).name}</b>!</p>
            <button className="gr-btn-big" onClick={() => setEvolving(null)}>Amazing</button>
          </div>
        </div>
      )}

      {hatched && (
        <div className="gr-sheet-back" onClick={() => setHatched(null)}>
          <div className={`gr-sheet gr-hatch ${hatched.prism ? 'prism' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="gr-evo-flash" />
            <h2>🐣 It hatched!</h2>
            <div className="gr-center gr-evo-to"><Badge m={morph(hatched.sp)} size={104} prism={hatched.prism} /></div>
            <p>A baby <b>{hatched.prism && '✨ '}{morph(hatched.sp).name}</b> joined you.</p>
            <p><Stars n={hatched.stars} /></p>
            {hatched.prism && <p className="gr-prism-text">A PRISMATIC egg! Lucky!</p>}
            <button className="gr-btn-big" onClick={() => setHatched(null)}>Welcome!</button>
          </div>
        </div>
      )}

      {bossWin && (
        <div className="gr-sheet-back" onClick={() => setBossWin(null)}>
          <div className="gr-sheet gr-boss-win" onClick={e => e.stopPropagation()}>
            <h2>🏆 {region(bossWin.reg).boss.name} defeated!</h2>
            <p className="gr-big">+{n(bossWin.scrap)} scrap</p>
            <p>{Object.entries(bossWin.loot).map(([k, v]) => `${ITEMS[k as ItemId].icon} ${v} ${ITEMS[k as ItemId].name}`).join(' · ')}</p>
            {bossWin.unlocked && <p className="gr-big2">🗺️ {region(bossWin.unlocked).name} is open!</p>}
            <p className="gr-prism-text">{morph(region(bossWin.reg).legendary).name}, the Legendary of {region(bossWin.reg).name}, has appeared in the wilds…</p>
            <button className="gr-btn-big" onClick={() => { setBossWin(null); setTab('wilds'); }}>Go find it</button>
          </div>
        </div>
      )}

      {away && !encOpen && (
        <div className="gr-sheet-back" onClick={() => setAway(null)}>
          <div className="gr-sheet" onClick={e => e.stopPropagation()}>
            <h2>Welcome back</h2>
            <p>You were gone {fmtDur(away.ms)}{away.ms >= world.offlineCap ? ` (camp counts up to ${Math.round(world.offlineCap / 3600000)} hours)` : ''}.</p>
            {away.scrap > 0 && <p className="gr-big">+{n(away.scrap)} scrap</p>}
            {Object.keys(away.got).length > 0 && <p>Your campers brought back {(Object.entries(away.got) as [ItemId, number][]).map(([k, v]) => `${ITEMS[k].icon} ${n(v)} ${ITEMS[k].name}`).join(' · ')}</p>}
            {away.eggs > 0 && <p>🥚 Your nest laid {away.eggs} egg{away.eggs > 1 ? 's' : ''}.</p>}
            {away.wins > 0 && <p>⚔️ Auto-patrol beat {away.wins} robot{away.wins > 1 ? 's' : ''}.</p>}
            {away.levels > 0 && <p>Your team went up {away.levels} level{away.levels > 1 ? 's' : ''}.</p>}
            {away.waiting > 0 && <p className="gr-big2">🌿 {away.waiting} Greeble{away.waiting > 1 ? 's are' : ' is'} out in the wilds!</p>}
            <button className="gr-btn-big" onClick={() => { setAway(null); setTab('wilds'); }}>{away.waiting > 0 ? 'Go catch them' : 'Nice'}</button>
          </div>
        </div>
      )}

      {s.newRules && !encOpen && (
        <div className="gr-sheet-back">
          <div className="gr-sheet gr-newrules" onClick={e => e.stopPropagation()}>
            <h2>🆕 New rules, fresh start</h2>
            <p>Greebles was too easy, so the rules changed from the ground up, and every save starts over:</p>
            <ul>
              <li>🛡️ <b>Your Team</b> does the fighting. Campers work and rest.</li>
              <li>⚡ Fights cost <b>energy</b>. It comes back over time, 4× faster in camp.</li>
              <li>🍬 Evolving needs a level <b>and candy</b>. Every catch gives candy for its family.</li>
              <li>🔒 Levels stop at a <b>cap</b> until you beat the next boss.</li>
              <li>🧬 Grafting is gone.</li>
            </ul>
            <button className="gr-btn-big" onClick={() => { delete s.newRules; save(true); redraw(); }}>Let's go</button>
          </div>
        </div>
      )}
      {menu === 'news' && <WhatsNew onClose={() => setMenu(null)} />}
      {menu === 'settings' && (
        <div className="gr-sheet-back" onClick={() => setMenu(null)}>
          <div className="gr-sheet" onClick={e => e.stopPropagation()}>
            <div className="gr-sheet-h"><b>Settings</b><button onClick={() => setMenu(null)}>✕</button></div>
            <button className="gr-row-btn" onClick={() => { setSound(!soundOn()); if (soundOn()) sfx.caught(); redraw(); }}>{soundOn() ? '🔊 Sound: on' : '🔇 Sound: off'}</button>
            <button className="gr-row-btn" onClick={() => { s.tips = {}; save(); setMenu(null); redraw(); }}>Show the tips again</button>
            {dev && <button className="gr-row-btn" onClick={() => setMenu('dev')}>🛠 Test tools</button>}
            <button className="gr-row-btn bad" onClick={() => setMenu('reset')}>🔄 Start over (erase progress)</button>
            <p className="gr-ver">Greebles v{pkg.version}</p>
          </div>
        </div>
      )}
      {menu === 'reset' && (
        <div className="gr-sheet-back" onClick={() => setMenu(null)}>
          <div className="gr-sheet gr-reset" onClick={e => e.stopPropagation()}>
            <div className="gr-sheet-h"><b>🔄 Start over?</b><button onClick={() => setMenu(null)}>✕</button></div>
            <p>This erases <b>everything</b> on every device: your {s.bag.length} Greeble{s.bag.length === 1 ? '' : 's'}, {n(s.scrap)} scrap, items, eggs, the Field Guide ({Object.keys(s.caught).length} caught), hunts, ship parts and permanent Signal perks. (Sound setting is kept.)</p>
            <p className="gr-dim">You'll start fresh at the crash site with the walkthrough. This can't be undone.</p>
            <ResetConfirm onYes={startOver} onNo={() => setMenu(null)} />
          </div>
        </div>
      )}
      {s.intro < 99 && !encOpen && !evolving && !hatched && !s.newRules && <Intro w={world} tab={tab} setTab={setTab} save={() => { save(); redraw(); }} />}
      {menu === 'dev' && dev && (
        <div className="gr-sheet-back" onClick={() => setMenu(null)}>
          <div className="gr-sheet" onClick={e => e.stopPropagation()}>
            <div className="gr-sheet-h"><b>Test tools</b><button onClick={() => setMenu(null)}>✕</button></div>
            <p className="gr-dim small">Camp + fight speed</p>
            <div className="gr-btns left">{[1, 10, 100].map(v => <button key={v} className={`gr-btn ${speed === v ? 'g' : ''}`} onClick={() => setSpeed(v)}>×{v}</button>)}</div>
            <div className="gr-btns left">
              <button className="gr-btn" onClick={() => { for (let i = 0; i < 3; i++) world.addSpawn(Date.now(), 'wild'); act({ ok: true }); }}>+3 Greebles</button>
              <button className="gr-btn" onClick={() => { world.addSpawn(Date.now(), 'wild').prism = true; act({ ok: true }); }}>+1 Prismatic</button>
              <button className="gr-btn" onClick={() => { world.addSpawn(Date.now(), 'wild', 'quorvex'); act({ ok: true }); }}>+Legendary</button>
              <button className="gr-btn" onClick={() => { for (const e of s.eggs) e.left = 0; s.nestCarry = 2 * 3600e3; world.advance(1, Date.now()); act({ ok: true }); }}>Eggs ready</button>
              <button className="gr-btn" onClick={() => { s.intro = 0; save(); setMenu(null); setTab('wilds'); redraw(); }}>Replay intro</button>
              <button className="gr-btn" onClick={() => { for (const h of HUNTS) for (const st of h.steps) s.tally[st.key] = Math.max(s.tally[st.key] ?? 0, st.need); s.unlocked = REGIONS.length; act({ ok: true }); }}>Finish all hunts</button>
              <button className="gr-btn" onClick={() => { s.scrap += 1000; s.items.snare = world.count('snare') + 20; save(); redraw(); }}>+1000 scrap, +20 snares</button>
              <button className="gr-btn" onClick={() => { s.nextWreckAt = 0; world.updateWilds(Date.now() + 30_000); act({ ok: true }); }}>Robot wreck</button>
              <button className="gr-btn" onClick={() => { const r = world.catchUp(60 * 60 * 1000); setToast(`Skipped 1 h: +${n(r.scrap)} scrap, ${r.wins} patrol wins`); redraw(); }}>Skip 1 h (camp)</button>
              <button className="gr-btn" onClick={() => { for (const g of s.bag) g.en = RULES.maxEnergy; act({ ok: true }); }}>Full energy</button>
              <button className="gr-btn" onClick={() => { for (const g of s.bag) s.candy[familyRoot(g.sp)] = (s.candy[familyRoot(g.sp)] ?? 0) + 50; act({ ok: true }); }}>+50 candy (bag)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Two-step erase: tap once to arm, then a 2-second wait before "Erase everything" works (no accidents). */
function ResetConfirm({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  const [armed, setArmed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setReady(true), 2000); return () => clearTimeout(t); }, [armed]);
  return (
    <div className="gr-btns">
      <button className="gr-btn" onClick={onNo}>Keep playing</button>
      {!armed
        ? <button className="gr-btn bad" onClick={() => setArmed(true)}>Start over…</button>
        : <button className="gr-btn bad solid" disabled={!ready} onClick={onYes}>{ready ? 'Erase everything' : 'Are you sure?'}</button>}
    </div>
  );
}

type V = { w: World; act: (r: { ok: boolean; why?: string }) => void };

function WildsView({ w, now, engage, act }: V & { now: number; engage: (id: string) => void }) {
  const s = w.s;
  const crater = craterAt(now);
  const nextCrater = crater && !crater.on && crater.start > now ? crater : craterAt(now + RULES.craterBlockMs - (now % RULES.craterBlockMs) + 1);
  const storm = stormAt(now);
  const beaconLeft = Math.max(0, s.beaconUntil - now);
  const spawns = [...w.here].sort((a, b) => a.at - b.at);
  const reg = w.reg;
  const elsewhere = (id: RegionId) => s.spawns.filter(x => x.reg === id).length;
  return (
    <>
      <div className="gr-regions">
        {REGIONS.map((r, i) => {
          const open = w.isOpen(r.id); const k = elsewhere(r.id);
          return (
            <button key={r.id} className={`gr-region ${s.region === r.id ? 'on' : ''} ${open ? '' : 'locked'}`} onClick={() => act(w.travel(r.id))}>
              <span>{open ? r.icon : '🔒'}</span><small>{r.name}</small>
              {open && k > 0 && s.region !== r.id && <i className="gr-count">{k}</i>}
              {!open && <small className="gr-dim">Beat {REGIONS[i - 1].boss.name}</small>}
            </button>
          );
        })}
      </div>
      <p className="gr-dim small gr-region-blurb">{reg.icon} <b>{reg.name}</b> — {reg.blurb}{reg.lvl ? ` Wild Greebles here are +${reg.lvl} levels.` : ''} {roleLabel(reg.favor)} campers work 1.5× better here.{s.bossBeaten[reg.id] ? ` ${morph(reg.legendary).name} roams here now…` : ''}</p>
      <section className={`gr-wilds reg-${reg.id} ${isNight(now) ? 'night' : ''} ${storm?.on ? 'storm' : ''}`} style={{ backgroundImage: `url(./art/bg_${reg.id}.webp)` }}>
        <div className="gr-wilds-shade" />
        {spawns.map(x => {
          const m = morph(x.sp);
          return (
            <button key={x.id} className={`gr-spawn src-${x.src} ${x.prism ? 'prism' : ''}`} style={{ left: `${x.x * 100}%`, top: `${x.y * 100}%` }} onClick={() => engage(x.id)} title={m.name}>
              <Badge m={m} size={46} prism={x.prism} />
              <small className={s.seen[x.sp] ? `r-${m.rarity}` : 'unk'}>{s.seen[x.sp] ? m.name : '???'}</small>
            </button>
          );
        })}
        {!spawns.length && <div className="gr-wilds-empty">It's quiet out here…<br /><small>Greebles wander in over time. Check back soon, or find a hot spot below.</small></div>}
        <div className="gr-wilds-count">{spawns.length} out there</div>
      </section>

      <DailyCard w={w} act={act} now={now} />
      <section className="gr-card">
        <h2>Hot spots</h2>
        <div className="gr-spot">
          <span className="gr-spot-ic">🌋</span>
          <div className="gr-grow">
            <b>Glow Crater</b>
            {crater?.on
              ? <div className="gr-ok small">ACTIVE for {fmtTime(crater.end - now)} · {roleLabel(crater.role)} Greebles every 1-2 min!</div>
              : <div className="gr-dim small">{nextCrater ? `Lights up in ${fmtTime(nextCrater.start - now)} (${roleLabel(nextCrater.role)} Greebles)` : 'Dark for now. It lights up at random times.'}</div>}
          </div>
        </div>
        <div className="gr-spot">
          <span className="gr-spot-ic">🛰️</span>
          <div className="gr-grow">
            <b>Beacon</b> <span className="gr-dim small">· you have {w.count('beacon')}</span>
            <div className="gr-dim small">{beaconLeft > 0 ? <span className="gr-ok">ON for {fmtTime(beaconLeft)}</span> : '30 min of Greebles wandering in fast.'}</div>
          </div>
          <button className="gr-btn o" disabled={w.count('beacon') < 1} onClick={() => act(w.useBeacon(Date.now()))}>{beaconLeft > 0 ? '+30 min' : 'Turn on'}</button>
        </div>
        <div className="gr-spot">
          <span className="gr-spot-ic">🐝</span>
          <div className="gr-grow"><b>This week's swarm</b><div className="gr-dim small">{s.seen[w.swarmKind(now).id] ? morph(w.swarmKind(now).id).name : 'A mystery Greeble'} is everywhere, in every area! Ends in {fmtTime(WEEK_MS - (now % WEEK_MS))}.</div></div>
        </div>
        <ExpoSpot w={w} act={act} now={now} />
        <div className="gr-spot">
          <span className="gr-spot-ic">🪤</span>
          <div className="gr-grow">
            <b>Bait</b>
            {s.lure && s.lure.until > now
              ? <div className="gr-ok small">{ITEMS[s.lure.id].name} out in {region(s.lure.reg).name} for {fmtTime(s.lure.until - now)}</div>
              : <div className="gr-dim small">Set out bait for 30 min of Greebles. Craft it at the Workbench.</div>}
            {!(s.lure && s.lure.until > now) && <div className="gr-btns left">{(Object.keys(LURES) as LureId[]).map(id => <button key={id} className="gr-btn" disabled={w.count(id) < 1} onClick={() => act(w.useLure(id, Date.now()))}>{ITEMS[id].icon} {w.count(id)}</button>)}</div>}
          </div>
        </div>
        <div className="gr-spot">
          <span className="gr-spot-ic">🤖</span>
          <div className="gr-grow">
            <b>Robot wreck</b>
            <div className="gr-dim small">{s.wreck ? <span className="gr-gold">A {ROBOTS.find(r => r.id === s.wreck!.robot)?.name} is guarding one! ({fmtTime(s.wreck.until - now)} left) → Fight tab</span> : `Next one in about ${fmtTime(Math.max(0, s.nextWreckAt - now))}`}</div>
          </div>
        </div>
        <div className="gr-spot">
          <span className="gr-spot-ic">{isNight(now) ? '🌙' : '☀️'}</span>
          <div className="gr-grow">
            <b>{isNight(now) ? 'Night' : 'Day'}{storm?.on ? ' · Storm' : ''}</b>
            <div className="gr-dim small">{isNight(now) ? 'Night Greebles are out.' : 'Night falls'} {isNight(now) ? `Day in ${fmtTime(untilFlip(now))}.` : `in ${fmtTime(untilFlip(now))}.`}{storm?.on ? ` Storm Greebles are out for ${fmtTime(storm.end - now)}.` : ''}</div>
          </div>
        </div>
      </section>
    </>
  );
}

/** ⚡ energy bar (10 pips' worth). */
function Energy({ g, w }: { g: Greeble; w: World }) {
  const e = w.energy(g);
  return <span className={`gr-en ${e < 1 ? 'out' : e < 3 ? 'low' : ''}`} title="Energy">⚡{e}<i><b style={{ width: `${(100 * g.en) / RULES.maxEnergy}%` }} /></i></span>;
}

function Row({ g, w, right, now }: { g: Greeble; w: World; right?: React.ReactNode; now?: number }) {
  const m = morph(g.sp);
  const capped = g.lv >= w.levelCap && g.lv < RULES.maxLevel;
  const xpPct = g.lv >= RULES.maxLevel ? 100 : capped ? 100 : (g.xp / xpNeed(g.lv)) * 100;
  const evo = now ? w.evoOptions(g, now) : [];
  const need = evo.length ? evoCandy(m) : 0;
  return (
    <div className="gr-row">
      <Badge m={m} prism={g.prism} />
      <div className="gr-grow">
        <b>{g.prism && '✨'}{m.name}</b> <El id={elementOf(g.sp)} /> <span className="gr-lv">lv {g.lv}</span>{capped && <span className="gr-cap" title="At the level cap: beat the next boss to go higher">🔒</span>} <Stars n={g.stars} /> <Energy g={g} w={w} />
        <div className="gr-dim small"><span className={`r-${m.rarity}`}>{RARITY_LABEL[m.rarity]}</span> · {roleLabel(m.role)} · +{w.yieldOf(g)}{evo.length > 0 && !evo.some(o => o.ready) ? ` · evolves at lv ${evo[0].evo.lv}${evo.map(o => o.evo.item ? ' +' + ITEMS[o.evo.item].icon : o.evo.night ? ' 🌙' : '').join('')} · 🍬 ${w.candyOf(g.sp)}/${need}` : ''}{capped && g.xp > 0 ? ` · ${n(g.xp)} xp saved` : ''}</div>
        <div className={`gr-xp ${capped ? 'capped' : ''}`}><div style={{ width: `${xpPct}%` }} /></div>
      </div>
      {right}
    </div>
  );
}

function DailyCard({ w, act, now }: V & { now: number }) {
  const d = w.ensureDaily(now);
  const left = DAY_MS - (now % DAY_MS);
  return (
    <section className="gr-card gr-daily">
      <h2>📋 Today's tasks <span className="gr-dim small">· new ones in {fmtTime(left)}</span></h2>
      {d.tasks.map((t, i) => { const v = w.taskProgress(t); const ready = v >= t.need && !t.done; return (
        <div key={i} className={`gr-task ${t.done ? 'done' : ''}`}>
          <div className="gr-grow"><b>{t.done ? '✅ ' : ''}{t.label}</b>
            <div className="gr-bar thin"><div style={{ width: `${(100 * v) / t.need}%` }} /></div></div>
          <span className="gr-dim small">{v}/{t.need}</span>
          {t.done ? <span className="gr-dim small">Done</span>
            : <button className={`gr-btn ${ready ? 'o' : ''}`} disabled={!ready} onClick={() => act(w.claimTask(i, Date.now()))}>{ready ? 'Claim' : `🔩 ${n(w.taskScrap)}`}</button>}
        </div>); })}
      <p className="gr-dim small">Each task: 🔩 {n(w.taskScrap)} scrap + 3 Good Snares. Finish all 3 for a bonus: 2 Great Snares + a 🌈 Shiny Bait{d.bonus ? ' ✅' : ''}.</p>
    </section>
  );
}

function EggView({ e, w, act }: { e: Egg; w: World; act: V['act'] }) {
  const ready = e.left <= 0; const pct = 100 * (1 - e.left / e.total);
  const m = morph(e.sp);
  return (
    <div className={`gr-egg ${ready ? 'ready' : ''}`}>
      <div className="gr-egg-shell" style={{ ['--egg' as any]: m.color }}><span>🥚</span></div>
      <small>{w.s.seen[e.sp] ? m.name : 'Mystery'} egg</small>
      {ready ? <button className="gr-btn o" onClick={() => act(w.hatch(e.id))}>Hatch!</button>
        : <><div className="gr-bar thin"><div style={{ width: `${pct}%` }} /></div><small className="gr-dim">{fmtTime(e.left)}</small></>}
    </div>
  );
}

function NestCard({ w, act, now }: V & { now: number }) {
  const s = w.s;
  const [pick, setPick] = useState<0 | 1 | null>(null);
  void now;
  const why = w.nestWhy();
  const first = s.nest[0] ? w.get(s.nest[0]) : s.nest[1] ? w.get(s.nest[1]) : undefined;
  const choices = s.bag.filter(g => !w.busy(g.u) && !w.canNest(g) && (!first || familyRoot(first.sp) === familyRoot(g.sp)))
    .sort((a, b) => morph(a.sp).name.localeCompare(morph(b.sp).name) || b.stars - a.stars).slice(0, 24);
  return (
    <section className="gr-card gr-nest">
      <h2>🪺 Nest & eggs</h2>
      <p className="gr-dim small">Put two Greebles from the same family in the nest. They lay an egg about every 2 hours, even while you're away. Eggs hatch over time, and every Greeble you catch warms them by 10 minutes. Eggs often have better stars, and they're 3× more likely to be ✨ Prismatic (9× if a parent is Prismatic).</p>
      <div className="gr-nest-row">
        {([0, 1] as const).map(i => { const u = s.nest[i]; const g = u ? w.get(u) : undefined; return (
          <div key={i} className="gr-nest-spot">
            {g ? <><Badge m={morph(g.sp)} size={52} prism={g.prism} /><small>{morph(g.sp).name}</small><small><Stars n={g.stars} /></small><button className="gr-btn" onClick={() => act(w.fromNest(i))}>Take out</button></>
              : <button className="gr-nest-empty" onClick={() => setPick(pick === i ? null : i)}>＋<small>Add</small></button>}
          </div>); })}
        <div className="gr-nest-status">{why ? <span className="gr-dim small">{why}</span> : <span className="gr-ok small">🥚 Next egg in {fmtTime(w.nextEggIn ?? 0)}</span>}</div>
      </div>
      {pick !== null && (
        <div className="gr-team">{choices.length ? choices.map(g => (
          <button key={g.u} className="gr-pick" onClick={() => { act(w.toNest(g.u, pick)); setPick(null); }}>
            <Badge m={morph(g.sp)} size={34} prism={g.prism} /><small>{morph(g.sp).name}</small><small className="gr-gold">{'★'.repeat(g.stars)}</small>
          </button>)) : <div className="gr-empty">{first ? `No free ${morph(familyRoot(first.sp)).name}-family Greebles. Bench one from camp or catch another.` : 'No free Greebles. Bench some from camp first.'}</div>}</div>
      )}
      <h3 className="gr-sub-h">Incubator · {s.eggs.length}/{EGG_MAX}</h3>
      <div className="gr-eggs">{s.eggs.length ? s.eggs.map(e => <EggView key={e.id} e={e} w={w} act={act} />) : <div className="gr-empty">No eggs yet.</div>}</div>
    </section>
  );
}

function CampView({ w, act, now }: V & { now: number }) {
  const s = w.s;
  const jobTag = (g: Greeble) => { const j = w.jobOf(g); return <span className="gr-job">{w.favored(g) && '⭐'}{ITEMS[j.item].icon} {Math.round(j.chance * 100)}%</span>; };
  const free = s.bag.filter(g => (!w.busy(g.u) || (w.inTeam(g.u) && !w.fighting(g.u))) && !w.inCamp(g.u)).sort((a, b) => Number(w.inTeam(a.u)) - Number(w.inTeam(b.u)) || w.yieldOf(b) - w.yieldOf(a) || b.lv - a.lv);
  const full = !s.camp.includes(null);
  const [sub, setSub] = useSub<'work' | 'nest' | 'build'>('camp', 'work');
  const eggReady = s.eggs.some(e => e.left <= 0);
  const canBuy = UPGRADES.some(u => { const p = w.upgradePrice(u.id); return p !== null && s.scrap >= p && !(u.id === 'tent' && s.camp.length >= RULES.maxCampSlots); });
  return (
    <>
      <SubTabs on={sub} set={setSub} items={[{ k: 'work', label: '⛺ Workers' }, { k: 'nest', label: '🪺 Nest', dot: eggReady }, { k: 'build', label: '🔨 Upgrades', dot: canBuy }]} />
      {sub === 'work' && <>
      <section className="gr-card">
        <h2>Camp · {s.camp.filter(Boolean).length}/{s.camp.length} working</h2>
        <p className="gr-dim">Camp is set up in {w.reg.icon} <b>{w.reg.name}</b>. Every 15 seconds each camper earns scrap and has a chance to bring back 🪨 Ore (Dig), 🌱 Kelp (Trawl) or ⚙️ Gears (Skirmish). ⭐ {roleLabel(w.reg.favor)} Greebles work 1.5× better here. Campers rest too: ⚡ energy comes back 4× faster in camp. They don't gain xp (only your team does). Keeps going while you're away (up to {Math.round(w.offlineCap / 3600000)} h).</p>
        {s.camp.map((u, i) => { const g = u ? w.get(u) : undefined; return g
          ? <Row key={i} g={g} w={w} right={<div className="gr-btns col">{jobTag(g)}<button className="gr-btn" disabled={s.team.every(Boolean)} title={s.team.every(Boolean) ? 'The team is full' : ''} onClick={() => act(w.toTeam(g.u))}>🛡 Team</button><button className="gr-btn" onClick={() => act(w.bench(i))}>Bench</button></div>} />
          : null; })}
        {s.camp.some(u => !u) && <div className="gr-row empty">{s.camp.filter(u => !u).length} empty camp spot{s.camp.filter(u => !u).length > 1 ? 's' : ''}. Pick one from “Send from bag” below.</div>}
      </section>
      <section className="gr-card gr-sendbag">
        <h2>Send from bag</h2>
        {!free.length ? <div className="gr-empty">Catch Greebles in the Wilds, then park them here.</div>
          : free.slice(0, 30).map(g => <Row key={g.u} g={g} w={w} right={<div className="gr-btns col">{w.inTeam(g.u) && <span className="gr-tag">🛡 on team</span>}<button className="gr-btn g" disabled={full} onClick={() => act(w.assign(g.u))}>Camp</button></div>} />)}
      </section>
      </>}
      {sub === 'nest' && <NestCard w={w} act={act} now={now} />}
      {sub === 'build' && <section className="gr-card">
        <h2>Build your camp</h2>
        <p className="gr-dim small">Spend scrap on upgrades that last forever.</p>
        {UPGRADES.map(u => {
          const lv = w.up(u.id); const price = w.upgradePrice(u.id);
          const maxed = price === null || (u.id === 'tent' && s.camp.length >= RULES.maxCampSlots);
          return (
            <div key={u.id} className="gr-row">
              <span className="gr-item-ic">{u.icon}</span>
              <div className="gr-grow"><b>{u.name}</b> <span className="gr-dim small">· lv {lv}/{u.prices.length}{lv ? ` · now ${u.effect(lv)}` : ''}</span><div className="gr-dim small">{u.desc}</div></div>
              <button className="gr-btn g" disabled={maxed || s.scrap < (price ?? Infinity)} onClick={() => act(w.buyUpgrade(u.id))}>{maxed ? 'Max' : n(price!)}</button>
            </div>
          );
        })}
      </section>}
    </>
  );
}

type Sort = 'kind' | 'level' | 'rarity' | 'new';
function BagView({ w, act, now }: V & { now: number }) {
  const s = w.s;
  const [sort, setSort] = useState<Sort>('kind');
  const rank = (g: Greeble) => ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].indexOf(morph(g.sp).rarity);
  const sorted = [...s.bag].sort((a, b) =>
    sort === 'level' ? b.lv - a.lv : sort === 'rarity' ? rank(b) - rank(a) || b.lv - a.lv : sort === 'new' ? (b.caughtAt ?? 0) - (a.caughtAt ?? 0)
      : morph(a.sp).name.localeCompare(morph(b.sp).name) || b.stars - a.stars || b.lv - a.lv);
  const sell = (g: Greeble) => {
    const m = morph(g.sp);
    const where = w.inCamp(g.u) ? ', which is camping,' : w.inTeam(g.u) ? ', which is on your team,' : '';
    if ((g.prism || rank(g) >= 2 || g.lv >= 10 || g.stars >= 4 || where) && !confirm(`Send your ${g.prism ? 'PRISMATIC ' : ''}${m.name} (lv ${g.lv}, ${g.stars}★)${where} home? You get ${CANDY.home} candy and ${w.sellValue(g)} scrap. It's gone for good.`)) return;
    act(w.sell(g.u));
  };
  return (
    <section className="gr-card">
      <h2>Bag {s.bag.length}/{s.bagMax}</h2>
      <p className="gr-dim small">🍬 Every Greeble you catch gives {CANDY.catch} candy for its family ({CANDY.catch + CANDY.goodStars} for 4★ or better, double for Prismatic). Hatching gives {CANDY.hatch}. Sending a Greeble home gives {CANDY.home}. Evolving costs candy: {evoCandy(morph('ashpup'))} for the first step, {evoCandy(morph('gleck'))} for the second (more for rare families).</p>
      <div className="gr-sort">{(['kind', 'level', 'rarity', 'new'] as Sort[]).map(k => <button key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{k === 'kind' ? 'Kind' : k === 'level' ? 'Level' : k === 'rarity' ? 'Rarity' : 'Newest'}</button>)}</div>
      {!sorted.length && <div className="gr-empty">Empty. Go catch some in the Wilds.</div>}
      {sorted.map(g => {
        const tag = w.fighting(g.u) ? '⚔️ fighting' : w.inTeam(g.u) ? '🛡 team' : w.inCamp(g.u) ? '⛺ camping' : w.inNest(g.u) ? '🪺 nest' : w.s.expo?.u === g.u ? '🧭 exploring' : null;
        const ready = w.evoOptions(g, now).filter(o => o.ready);
        const cost = evoCandy(morph(g.sp));
        return (
          <div key={g.u} className={`gr-bagitem ${ready.length ? 'evo-ready' : ''}`}>
            <Row g={g} w={w} now={now} />
            <div className="gr-btns">
              {tag && <span className="gr-tag">{tag}</span>}
              {ready.map(o => <button key={o.evo.to} className="gr-btn evo" onClick={() => act(w.evolve(g.u, o.evo.to, Date.now()))}>🌟 Evolve{ready.length > 1 || o.evo.item ? ` → ${morph(o.evo.to).name}` : ''} · 🍬{cost}</button>)}
              {!w.inTeam(g.u) && !w.busy(g.u) && <button className="gr-btn" disabled={s.team.every(Boolean)} onClick={() => act(w.toTeam(g.u))}>🛡 Team</button>}
              <button className="gr-btn d" disabled={w.fighting(g.u) || w.s.expo?.u === g.u} onClick={() => sell(g)}>Send home</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function FightView({ w, act, now }: V & { now: number }) {
  const s = w.s;
  const [sub, setSub] = useSub<'team' | 'boss' | 'patrol' | 'chart'>('fight', 'team');
  const reg = w.reg;
  if (s.fight) {
    const f = s.fight;
    const foe = (() => { const r0 = s.region; s.region = f.reg; const x = w.foe(f.robot, f.kind); s.region = r0; return x; })();
    return (
      <section className={`gr-card ${f.kind === 'boss' ? 'gr-boss' : ''}`}>
        <h2>{f.kind === 'boss' ? `Boss: ${foe?.name}` : f.kind === 'wreck' ? 'Battle at the wreck' : f.auto ? 'Auto-patrol' : 'Battle'} · {region(f.reg).icon} {region(f.reg).name}</h2>
        <div className="gr-row">{f.kind === 'boss' ? <BossArt reg={f.reg} /> : <RobotArt id={f.robot} />}<div className="gr-grow"><b>{foe?.name}</b> {foe && <El id={foe.el} />} · HP {n(Math.max(0, f.robotHp))}<div className="gr-hp bot"><div style={{ width: `${Math.max(0, (100 * f.robotHp) / f.robotMax)}%` }} /></div></div></div>
        <div className="gr-vs">VS</div>
        {f.team.map(x => { const g = w.get(x.u); if (!g) return null; const m = morph(g.sp); const el = elementOf(g.sp); const mult = foe ? typeMult(el, foe.el) : 1;
          const ready = x.charge >= MOVE_CHARGE; return (
          <div key={x.u} className={`gr-row ${x.hp <= 0 ? 'down' : ''}`}>
            <Badge m={m} prism={g.prism} />
            <div className="gr-grow"><b>{m.name}</b> <El id={el} />
              <div className="gr-dim small">lv {g.lv} · HP {Math.max(0, x.hp)}/{x.maxHp}{x.hp <= 0 ? <span className="gr-bad"> · knocked out</span> : mult > 1 ? <span className="gr-ok"> · strong!</span> : mult < 1 ? <span className="gr-bad"> · weak</span> : null}</div>
              <div className="gr-hp"><div style={{ width: `${Math.max(0, (100 * x.hp) / x.maxHp)}%` }} /></div>
              <div className="gr-charge"><div style={{ width: `${Math.min(100, (100 * x.charge) / MOVE_AUTO)}%` }} className={ready ? 'ready' : ''} /></div>
            </div>
            <button className={`gr-move ${ready && !x.boost ? 'ready' : ''} ${x.boost ? 'armed' : ''}`} disabled={x.hp <= 0 || !ready || x.boost} onClick={() => act(w.useMove(x.u))}>
              {ELEMENTS[el].icon}<small>{x.boost ? 'Ready!' : ELEMENTS[el].move}</small>
            </button>
          </div>); })}
        <p className="gr-dim small">Moves charge up each round. Tap one when it glows for a 3× hit (if you don't, it fires on its own at 2×).{f.kind === 'boss' ? ' Bosses hit your whole team every round.' : ''} A Greeble that gets knocked out loses all its energy.</p>
      </section>
    );
  }
  const wr = s.wreck && ROBOTS.find(r => r.id === s.wreck!.robot);
  const bossReady = w.bossReadyAt(reg.id);
  const boss = w.foe('boss', 'boss')!;
  const bossEl = reg.boss.el;
  const bossUp = now >= bossReady;
  const patrolTeam = w.readyTeam(ENERGY_COST.patrol).map(g => g.u);
  const wreckTeam = w.readyTeam(ENERGY_COST.wreck).map(g => g.u);
  const bossTeam = w.readyTeam(ENERGY_COST.boss).map(g => g.u);
  const bossWin = bossTeam.length > 0 && w.wouldWin(bossTeam, 'boss', 'boss');
  const tired = w.teamList.filter(g => !bossTeam.includes(g.u));
  const noTeam = !w.teamList.length;
  const goTeam = <button className="gr-btn o" onClick={() => setSub('team')}>Pick your team</button>;
  return (
    <>
      <SubTabs on={sub} set={setSub} items={[{ k: 'team', label: '🛡 Team', dot: noTeam }, { k: 'patrol', label: '🤖 Patrol', dot: !!wr }, { k: 'boss', label: '🦾 Boss', dot: bossUp && !s.bossBeaten[reg.id] && bossWin }, { k: 'chart', label: '📊 Elements' }]} />
      {sub === 'team' && <TeamCard w={w} act={act} />}
      {sub === 'boss' && <section className="gr-card gr-boss">
        <div className="gr-boss-head"><BossArt reg={reg.id} size={64} /><h2>{reg.boss.name} <span className="gr-dim small">· boss of {reg.icon} {reg.name}</span></h2></div>
        <p className="gr-dim">HP {n(boss.hp)} · hits <b>everyone</b> for {boss.atk} · <El id={bossEl} long /> Strong against it: {(Object.keys(STRONG) as Element[]).filter(e => STRONG[e].includes(bossEl)).map(e => <El key={e} id={e} long />)}. Costs ⚡{ENERGY_COST.boss} per fighter.{s.bossBeaten[reg.id] ? ' Beat it again for more loot.' : ` Win to raise your level cap${REGIONS[REGIONS.findIndex(r => r.id === reg.id) + 1] ? `, open ${REGIONS[REGIONS.findIndex(r => r.id === reg.id) + 1].name},` : ''} and call out ${morph(reg.legendary).name}, the Legendary of this area!`}</p>
        {now < bossReady ? <div className="gr-empty">Being rebuilt… back in {fmtTime(bossReady - now)}</div> : noTeam ? <div className="gr-empty">Your team is empty. {goTeam}</div> : (<>
          <div className="gr-team">
            {w.teamList.map(g => { const m = morph(g.sp); const ok = bossTeam.includes(g.u); return (
              <div key={g.u} className={`gr-pick ${ok ? 'on' : 'off'}`}>
                <Badge m={m} size={34} prism={g.prism} /><small>{m.name} · lv {g.lv}</small><small><El id={elementOf(g.sp)} /> <span className={typeMult(elementOf(g.sp), bossEl) > 1 ? 'gr-ok' : typeMult(elementOf(g.sp), bossEl) < 1 ? 'gr-bad' : 'gr-gold'}>⚔ {w.hitOn(g, bossEl)}</span></small><small className={ok ? 'gr-ok' : 'gr-bad'}>⚡{w.energy(g)}{ok ? '' : ' tired'}</small>
              </div>); })}
          </div>
          {tired.length > 0 && <p className="gr-dim small">{tired.length} team member{tired.length > 1 ? 's are' : ' is'} too tired (needs ⚡{ENERGY_COST.boss}). Swap in rested campers on the Team tab.</p>}
          <button className={`gr-btn-big ${bossTeam.length && !bossWin ? 'risky' : ''}`} disabled={!bossTeam.length} onClick={() => act(w.startFight(bossTeam, 'boss', 'boss'))}>
            {!bossTeam.length ? 'Nobody has enough energy' : `${bossWin ? '✓' : '✗ Risky —'} Fight with ${bossTeam.length} (⚡${ENERGY_COST.boss} each)`}
          </button>
          {!bossWin && bossTeam.length > 0 && <p className="gr-dim small">✗ means your team would probably lose. Level up to the cap (🔒 {w.levelCap}), evolve, and bring the right elements.</p>}
        </>)}
      </section>}
      {sub === 'patrol' && wr && (
        <section className="gr-card gr-wreck">
          <div className="gr-boss-head"><RobotArt id={wr.id} size={56} /><h2>Robot wreck</h2></div>
          <p className="gr-dim">A {wr.name} (tougher than usual) is guarding a wreck for {fmtTime(s.wreck!.until - now)}. Beat it and {RULES.wreckBurst} Greebles come out of hiding, with better odds of rare ones. Costs ⚡{ENERGY_COST.wreck} per fighter.</p>
          {noTeam ? <div className="gr-empty">Your team is empty. {goTeam}</div> : !wreckTeam.length ? <div className="gr-empty">Your team is too tired. Let them rest, or swap in rested campers.</div>
            : (() => { const win = w.wouldWin(wreckTeam, wr.id, 'wreck'); return <button className={`gr-btn-big ${win ? '' : 'risky'}`} onClick={() => act(w.startFight(wreckTeam, wr.id, 'wreck'))}>{win ? '✓' : '✗ Risky —'} Attack with {wreckTeam.length} (⚡{ENERGY_COST.wreck} each)</button>; })()}
        </section>
      )}
      {sub === 'patrol' && <section className="gr-card">
        <h2>Robot patrol · {reg.icon} {reg.name}</h2>
        <AutoSwitch w={w} act={act} />
        <p className="gr-dim">Your team fights together (⚡{ENERGY_COST.patrol} each). Skirmish Greebles hit hardest, and the right element hits 1.5× (the wrong one 0.67×). Wins pay xp, a little scrap, snares and Robot Gears. ✓ means you should win.</p>
        {noTeam ? <div className="gr-empty">Your team is empty. {goTeam}</div> : (
          <div className="gr-robots">{ROBOTS.map(r => { const st = robotIn(r, reg); const win = patrolTeam.length > 0 && w.wouldWin(patrolTeam, r.id); return (
            <div key={r.id} className="gr-robot"><RobotArt id={r.id} size={52} /><b>{r.name} <El id={r.el} /></b><span>HP {n(st.hp)} · hits {st.atk} · {st.xp} xp</span>
              <button className={`gr-btn ${win ? 'g' : 'd'}`} disabled={!patrolTeam.length} onClick={() => act(w.startFight(patrolTeam, r.id))}>{win ? '✓' : '✗'} Fight</button>
            </div>); })}</div>
        )}
        {!noTeam && !patrolTeam.length && <p className="gr-dim small">Everyone on the team is out of energy. They get it back over time (4× faster resting in camp).</p>}
        {patrolTeam.length > 0 && !w.autoPick() && <p className="gr-dim small">Your team can't beat any robot here yet (✗). Add more Greebles to the team, or pick ones with a better element.</p>}
      </section>}
      {sub === 'chart' && <section className="gr-card">
        <h2>Element chart</h2>
        <p className="gr-dim small">Each element hits two others 1.5× harder, and takes 1.5× from those that beat it.</p>
        <div className="gr-chart">{(Object.keys(STRONG) as Element[]).map(e => <div key={e}><El id={e} long /> <span className="gr-dim">beats</span> {STRONG[e].map(x => <El key={x} id={x} long />)}</div>)}</div>
      </section>}
    </>
  );
}

function AutoSwitch({ w, act }: V) {
  const on = w.s.autoPatrol;
  return (
    <button className={`gr-auto ${on ? 'on' : ''}`} onClick={() => act(w.setAutoPatrol(!on))} role="switch" aria-checked={on}>
      <span className="gr-auto-knob" /><b>Auto-patrol {on ? 'ON' : 'OFF'}</b>
      <small>{on ? `Your team fights a patrol every ${Math.round(RULES.patrolGapMs / 60000)} min on its own, even while you're away. It stops at ⚡${AUTO_RESERVE} so you're always ready for a boss.` : 'Turn on to fight patrols on their own.'}</small>
    </button>
  );
}

/** The team: who fights. Swap tired members for rested campers. */
function TeamCard({ w, act }: V) {
  const s = w.s;
  const [swap, setSwap] = useState<string | null>(null);
  const bench = s.bag.filter(g => !w.inTeam(g.u) && !w.inNest(g.u) && s.expo?.u !== g.u)
    .sort((a, b) => w.energy(b) - w.energy(a) || w.teamPower(b) - w.teamPower(a)).slice(0, 24);
  const full = s.team.every(Boolean);
  const pick = (u: string) => { if (swap) { act(w.swapIn(u, swap)); setSwap(null); } else act(w.toTeam(u)); };
  return (
    <>
      <section className="gr-card gr-teamcard">
        <h2>🛡 Your team · {w.teamList.length}/{s.team.length}</h2>
        <p className="gr-dim small">Only your team fights, and only your team gains xp. Each fight costs energy (⚡). Energy comes back 1 every {Math.round(RULES.enRestMs / 60000)} min, or 1 every {Math.round(RULES.enCampMs / 60000)} min while resting in camp. Levels stop at 🔒 {w.levelCap} until you beat the next area boss.{s.team.length < TEAM_MAX ? ' Buy more team spots in Camp → Upgrades.' : ''}</p>
        <AutoSwitch w={w} act={act} />
        {s.team.map((u, i) => { const g = u ? w.get(u) : undefined; return g
          ? <Row key={i} g={g} w={w} right={<div className="gr-btns col">
              <button className={`gr-btn ${swap === g.u ? 'o' : ''}`} disabled={w.fighting(g.u)} onClick={() => setSwap(swap === g.u ? null : g.u)}>{swap === g.u ? 'Pick below…' : '⇄ Swap'}</button>
              <button className="gr-btn" disabled={w.fighting(g.u)} onClick={() => act(w.offTeam(g.u))}>Remove</button></div>} />
          : <div key={i} className="gr-row empty">Empty team spot. Add a Greeble from the list below.</div>; })}
      </section>
      <section className="gr-card gr-teamadd">
        <h2>{swap ? `Swap in for ${morph(w.get(swap)?.sp ?? 'ashpup').name}` : 'Add to the team'}</h2>
        {swap && <p className="gr-dim small">The one you swap out goes to rest in camp if it takes a camper's spot.</p>}
        {!bench.length ? <div className="gr-empty">Catch some Greebles in the Wilds first.</div>
          : bench.map(g => <Row key={g.u} g={g} w={w} right={<div className="gr-btns col">{w.inCamp(g.u) && <span className="gr-tag">⛺ resting</span>}<span className="gr-tag pow">⚔ {w.teamPower(g)}</span><button className="gr-btn g" disabled={!swap && full} onClick={() => pick(g.u)}>{swap ? 'Swap in' : 'Add'}</button></div>} />)}
      </section>
    </>
  );
}

function ShopView({ w, act, now }: V & { now: number }) {
  const shop: ItemId[] = ['snare', 'good', 'great', 'treat', 'beacon', 'ember', 'pearl', 'sun', 'moon'];
  const owned = (Object.keys(ITEMS) as ItemId[]).filter(k => w.count(k) > 0);
  const [sub, setSub] = useSub<'buy' | 'craft' | 'items'>('shop', 'buy');
  const canCraft = RECIPES.some(r => (Object.entries(r.cost) as [ItemId, number][]).every(([k, v]) => w.count(k) >= v));
  return (
    <>
      <SubTabs on={sub} set={setSub} items={[{ k: 'buy', label: '🛒 Buy' }, { k: 'craft', label: '🔧 Workbench', dot: canCraft }, { k: 'items', label: '🎒 My items' }]} />
      {sub === 'buy' && <section className="gr-card">
        <h2>Shop</h2>
        <p className="gr-dim">You have <b className="gr-gold">{n(w.s.scrap)} scrap</b>.</p>
        {shop.map(k => {
          const it = ITEMS[k]; const p = it.price!;
          return (
            <div key={k} className="gr-row">
              <span className="gr-item-ic">{it.icon}</span>
              <div className="gr-grow"><b>{it.name}</b> <span className="gr-dim small">· have {w.count(k)}</span><div className="gr-dim small">{it.desc}</div></div>
              <div className="gr-btns col">
                <button className="gr-btn g" disabled={w.s.scrap < p} onClick={() => act(w.buy(k, 1))}>{n(p)}</button>
                {SNARES.includes(k as any) && <button className="gr-btn" disabled={w.s.scrap < p * 10} onClick={() => act(w.buy(k, 10))}>×10 {n(p * 10)}</button>}
              </div>
            </div>
          );
        })}
      </section>}
      {sub === 'craft' && <section className="gr-card">
        <h2>Workbench</h2>
        <p className="gr-dim small">Robots drop ⚙️ Gears and 🔋 Cores. Camp Greebles bring back 🪨 Ore (Dig), 🌱 Kelp (Trawl) and sometimes 🔷 Crystal (Dig in the Glass Spires).</p>
        <div className="gr-items">{(['gear', 'core', 'ore', 'kelp', 'crystal'] as ItemId[]).map(k => <span key={k} className="gr-chip">{ITEMS[k].icon} {n(w.count(k))}</span>)}</div>
        {RECIPES.map((r, i) => {
          const ok = (Object.entries(r.cost) as [ItemId, number][]).every(([k, v]) => w.count(k) >= v);
          return (
            <div key={i} className="gr-row">
              <span className="gr-item-ic">{ITEMS[r.out].icon}</span>
              <div className="gr-grow"><b>{r.n > 1 ? `${r.n}× ` : ''}{ITEMS[r.out].name}</b> <span className="gr-dim small">· have {w.count(r.out)}</span><div className="gr-cost">{(Object.entries(r.cost) as [ItemId, number][]).map(([k, v]) => <span key={k} className={w.count(k) >= v ? '' : 'gr-bad'}>{ITEMS[k].icon} {v} {ITEMS[k].name.replace('Robot ', '').replace('Power ', '')}</span>)}</div></div>
              <button className="gr-btn o" disabled={!ok} onClick={() => act(w.craft(i))}>Craft</button>
            </div>
          );
        })}
      </section>}
      {sub === 'items' && <section className="gr-card">
        <h2>Your items</h2>
        {!owned.length ? <div className="gr-empty">Nothing yet.</div> : <div className="gr-items">{owned.map(k => <span key={k} className="gr-chip">{ITEMS[k].icon} {ITEMS[k].name} ×{w.count(k)}</span>)}</div>}
        <p className="gr-dim small">{isNight(now) ? '🌙 It is night: Night Veils and Hollow Shades can evolve now.' : 'Some Greebles only evolve at night.'}</p>
      </section>}
    </>
  );
}

function HuntsCard({ w, act, now, onGo }: V & { now: number; onGo: () => void }) {
  return (
    <section className="gr-card gr-hunts">
      <h2>🌠 Mythic Hunts</h2>
      <p className="gr-dim small">Mythics almost never wander in by chance. Finish a hunt's goals (they count over all your trips) to call its Mythic. Each Mythic waits 1 hour; if it gets away you can call it again.</p>
      {HUNTS.map(h => {
        const st = w.huntState(h, now); const m = morph(h.mythic); const r = region(h.reg);
        return (
          <div key={h.id} className={`gr-hunt ${st}`}>
            <div className="gr-row">
              {st === 'caught' || st === 'ready' || st === 'out' ? <Badge m={m} size={46} /> : <div className="gr-badge mystery" style={{ width: 46, height: 46 }}>?</div>}
              <div className="gr-grow"><b>{h.name}</b><div className="gr-dim small">{r.icon} {r.name}{h.night ? ' · 🌙 night' : ''}</div>
                <div className="gr-dim small">{st === 'locked' ? `Open ${r.name} to start this hunt.` : st === 'caught' ? `You caught ${m.name}! ✅` : h.blurb}</div>
              </div>
              {st === 'ready' && <button className="gr-btn o" onClick={() => act(w.callMythic(h.id, Date.now()))}>Call it</button>}
              {st === 'out' && <button className="gr-btn g" onClick={onGo}>Find it</button>}
            </div>
            {(st === 'open' || st === 'ready') && <div className="gr-steps">{h.steps.map(x => { const v = Math.min(x.need, w.tallyOf(x.key)); return (
              <div key={x.key} className={v >= x.need ? 'done' : ''}><span>{v >= x.need ? '✅' : '▫️'} {x.label}</span><b>{v}/{x.need}</b></div>); })}</div>}
          </div>
        );
      })}
    </section>
  );
}

function GuideView({ w, act, now, onGo }: V & { now: number; onGo: () => void }) {
  const s = w.s;
  const caught = w.caughtCount;
  const next = REWARDS.find(r => !s.claimed[r.id]);
  const prisms = Object.keys(s.prismCaught).length;
  const [sub, setSub] = useSub<'hunts' | 'kinds' | 'rewards' | 'stats'>('guide', 'kinds');
  const huntReady = HUNTS.some(h => w.huntState(h, now) === 'ready');
  return (
    <>
      <SubTabs on={sub} set={setSub} items={[{ k: 'kinds', label: '📖 Greebles' }, { k: 'hunts', label: '🌠 Hunts', dot: huntReady }, { k: 'rewards', label: '🎁 Rewards' }, { k: 'stats', label: '📈 Stats' }]} />
      {sub === 'hunts' && <HuntsCard w={w} act={act} now={now} onGo={onGo} />}
      {sub === 'kinds' && <section className="gr-card">
        <h2>Field guide · {caught}/{MORPHS.length} caught</h2>
        <p className="gr-dim small">Seen {Object.keys(s.seen).length} · ✨ Prismatic {prisms}/{MORPHS.length}</p>
        <div className="gr-bar"><div style={{ width: `${(caught / MORPHS.length) * 100}%` }} /></div>
        {next ? <p className="gr-dim small">Next reward at {next.need} caught: <b className="gr-gold">{next.label}</b>{caught >= next.need ? ' (catch any new kind to claim it)' : ''}</p> : <p className="gr-dim small">All guide rewards claimed! 🎉</p>}
        {FAMILIES.map(fam => (
          <div key={fam[0].id} className="gr-fam">
            {fam.map((m, i) => {
              const got = s.caught[m.id], seen = s.seen[m.id];
              return (
                <div key={m.id} className={`gr-gitem ${got ? '' : seen ? 'seen' : 'unk'}`}>
                  {i > 0 && <span className="gr-fam-arrow">›</span>}
                  {got || seen ? <Badge m={m} size={36} prism={!!s.prismCaught[m.id]} /> : <div className="gr-badge" style={{ width: 36, height: 36 }}>?</div>}
                  <span>{got || seen ? m.name : '???'}{s.prismCaught[m.id] ? ' ✨' : ''}</span>
                  {(got || seen) && <small className={`r-${m.rarity}`}>{RARITY_LABEL[m.rarity]}</small>}
                </div>
              );
            })}
          </div>
        ))}
      </section>}
      {sub === 'rewards' && <section className="gr-card">
        <h2>Guide rewards</h2>
        {REWARDS.map(r => <div key={r.id} className={`gr-reward ${s.claimed[r.id] ? 'done' : ''}`}><span>{s.claimed[r.id] ? '✅' : `${Math.min(caught, r.need)}/${r.need}`}</span><b>{r.label}</b></div>)}
      </section>}
      {sub === 'stats' && <section className="gr-card">
        <h2>Your trip so far</h2>
        <div className="gr-stats">
          <span>Greebles caught</span><b>{n(s.stats.caught)}</b><span>Snares thrown</span><b>{n(s.stats.thrown)}</b>
          <span>Perfect throws</span><b>{n(s.stats.perfects)}</b><span>Got away</span><b>{n(s.stats.fled)}</b>
          <span>✨ Prismatics caught</span><b>{n(s.stats.prisms)}</b><span>Evolved</span><b>{n(s.stats.evolved)}</b>
          <span>Robots broken</span><b>{n(s.stats.wins)}</b><span>Wrecks cleared</span><b>{n(s.stats.wrecks)}</b>
          <span>Scrap earned</span><b>{n(s.stats.scrapEarned)}</b>
        </div>
      </section>}
    </>
  );
}

function ExpoSpot({ w, act, now }: V & { now: number }) {
  const s = w.s;
  const [pick, setPick] = useState(false);
  const e = s.expo;
  const free = s.bag.filter(g => !w.busy(g.u)).sort((a, b) => b.lv - a.lv).slice(0, 8);
  return (
    <div className="gr-spot">
      <span className="gr-spot-ic">🧭</span>
      <div className="gr-grow">
        <b>Daily expedition</b>
        {e ? <div className="gr-ok small">{morph(w.get(e.u)?.sp ?? 'ashpup').name} is exploring {region(e.reg).name}. Back in {fmtTime(e.until - now)}.</div>
          : w.expoReady(now) ? <div className="gr-dim small">Send one Greeble off for 4 hours. It brings back lots of loot, and a rare Greeble follows it home.</div>
          : <div className="gr-dim small">Next one in {fmtTime(DAY_MS - (now % DAY_MS))}.</div>}
        {pick && !e && <div className="gr-btns left">{free.map(g => <button key={g.u} className="gr-btn" onClick={() => { act(w.sendExpedition(g.u, Date.now())); setPick(false); }}>{morph(g.sp).name} lv {g.lv}</button>)}</div>}
      </div>
      {!e && w.expoReady(now) && <button className="gr-btn o" onClick={() => setPick(p => !p)}>{pick ? 'Cancel' : 'Send'}</button>}
    </div>
  );
}

function ShipView({ w, act, now, onSignal }: V & { now: number; onSignal: () => void }) {
  const s = w.s;
  const [keep, setKeep] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const done = SHIP_PARTS.filter(p => s.ship[p.id]).length;
  void now; void EXPEDITION_MS;
  const toggle = (u: string) => setKeep(k => k.includes(u) ? k.filter(x => x !== u) : k.length >= 3 ? k : [...k, u]);
  const best = [...s.bag].sort((a, b) => b.lv * b.stars - a.lv * a.stars).slice(0, 16);
  const [sub, setSub] = useSub<'fix' | 'signal' | 'perks'>('ship', 'fix');
  const canFix = SHIP_PARTS.some(p => !s.ship[p.id] && !w.canBuild(p.id));
  const canPerk = PERKS.some(p => w.perk(p.id) < p.max && s.sp >= perkCost(w.perk(p.id)));
  return (
    <>
      <SubTabs on={sub} set={setSub} items={[{ k: 'fix', label: '🔧 Repairs', dot: canFix }, { k: 'signal', label: '📡 Signal home', dot: w.shipDone }, { k: 'perks', label: '✨ Perks', dot: canPerk }]} />
      {sub === 'fix' && <section className="gr-card gr-shipcard">
        <h2>🚀 Your ship · {done}/{SHIP_PARTS.length} fixed</h2>
        <p className="gr-dim small">You crashed here. Fix the ship one piece at a time, then signal home.{s.signals ? ` Trips home so far: ${s.signals}. Robots are ${Math.round(w.hard * 100)}% as tough as on your first trip (and pay that much more).` : ''}</p>
        <div className="gr-bar"><div style={{ width: `${(done / SHIP_PARTS.length) * 100}%` }} /></div>
        {SHIP_PARTS.map(p => {
          const why = w.canBuild(p.id); const got = !!s.ship[p.id];
          return (
            <div key={p.id} className={`gr-row ${got ? 'down' : ''}`}>
              <span className="gr-item-ic">{got ? '✅' : p.icon}</span>
              <div className="gr-grow"><b>{p.name}</b><div className="gr-dim small">{p.desc}</div>
                {!got && <div className="gr-cost"><span className={s.scrap >= p.scrap ? '' : 'gr-bad'}>🔩 {n(p.scrap)}</span>{(Object.entries(p.cost) as [ItemId, number][]).map(([k, v]) => <span key={k} className={w.count(k) >= v ? '' : 'gr-bad'}>{ITEMS[k].icon} {v} {ITEMS[k].name.replace('Robot ', '').replace('Power ', '')}</span>)}{p.needBoss && !s.bossBeaten[p.needBoss] && <span className="gr-bad">🦾 beat {region(p.needBoss).boss.name}</span>}</div>}
              </div>
              {!got && <button className="gr-btn g" disabled={!!why} title={why ?? ''} onClick={() => act(w.buildPart(p.id))}>Build</button>}
            </div>
          );
        })}
      </section>}

      {sub === 'signal' && <section className={`gr-card ${w.shipDone ? 'gr-boss-win' : ''}`}>
        <h2>📡 Signal home</h2>
        <p className="gr-dim small">Start a new trip. You <b>keep</b>: your Field Guide, Prismatic marks, perks, Signal Points and <b>3 Greebles</b> (at half level). Everything else starts over, and the robots get tougher, but they pay more too.</p>
        <p>You'd get <b className="gr-gold">{w.signalReward} Signal Points</b> <span className="gr-dim small">(3 + 1 per 10 kinds caught + 1 per boss win + 1 per Prismatic kind)</span></p>
        {!w.shipDone ? <div className="gr-empty">Fix all {SHIP_PARTS.length} parts of the ship first.</div> : !confirmOpen
          ? <button className="gr-btn-big" onClick={() => setConfirmOpen(true)}>Get ready to signal home…</button>
          : (<>
            <p className="gr-dim small">Pick up to 3 Greebles to bring along ({keep.length}/3):</p>
            <div className="gr-team">{best.map(g => { const m = morph(g.sp); const on = keep.includes(g.u); return (
              <button key={g.u} className={`gr-pick ${on ? 'on' : ''}`} disabled={!on && keep.length >= 3} onClick={() => toggle(g.u)}>
                <Badge m={m} size={34} prism={g.prism} /><small>{m.name}</small><small className="gr-gold">lv {g.lv} {'★'.repeat(g.stars)}</small>
              </button>); })}</div>
            <button className="gr-btn-big" onClick={() => { if (confirm(`Signal home and start a new trip? You keep the Field Guide, perks and ${keep.length} Greeble(s).`)) { const r = w.signalHome(keep, Date.now()); act(r); if (r.ok) onSignal(); } }}>📡 Signal home</button>
          </>)}
      </section>}

      {sub === 'perks' && <section className="gr-card">
        <h2>✨ Perks · {s.sp} Signal Point{s.sp === 1 ? '' : 's'}</h2>
        <p className="gr-dim small">Perks last forever, through every trip home.</p>
        {PERKS.map(p => { const lv = w.perk(p.id); const c = perkCost(lv); return (
          <div key={p.id} className="gr-row">
            <span className="gr-item-ic">{p.icon}</span>
            <div className="gr-grow"><b>{p.name}</b> <span className="gr-dim small">· lv {lv}/{p.max}</span><div className="gr-dim small">{p.desc}</div></div>
            <button className="gr-btn o" disabled={lv >= p.max || s.sp < c} onClick={() => act(w.buyPerk(p.id))}>{lv >= p.max ? 'Max' : `${c} SP`}</button>
          </div>); })}
      </section>}
    </>
  );
}
