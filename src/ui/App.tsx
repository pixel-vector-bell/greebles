import { useEffect, useRef, useState } from 'react';
import { World, newGame, type GameEvent, type Greeble } from '../sim/world';
import {
  FAMILIES, ITEMS, MORPHS, RARITY_LABEL, REWARDS, ROBOTS, RULES, SNARES, craterAt, isNight, morph, roleLabel, stormAt, untilFlip, xpNeed,
  type ItemId,
} from '../sim/content';
import { saveLocal, wipeLocal } from '../save/storage';
import { onHubFlush, sendToHub } from '../save/hub';
import { devEnabled } from '../save/dev';
import { WhatsNew } from './WhatsNew';
import { Encounter } from './Encounter';
import { Badge, Stars, fmtDur, fmtTime, n } from './bits';
import pkg from '../../package.json';

type Tab = 'wilds' | 'camp' | 'bag' | 'fight' | 'shop' | 'guide';
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'wilds', icon: '🌿', label: 'Wilds' }, { id: 'camp', icon: '⛺', label: 'Camp' },
  { id: 'bag', icon: '🎒', label: 'Bag' }, { id: 'fight', icon: '⚔️', label: 'Fight' },
  { id: 'shop', icon: '🛒', label: 'Shop' }, { id: 'guide', icon: '📖', label: 'Guide' },
];

function message(e: GameEvent, w: World): string | null {
  switch (e.t) {
    case 'spawn': return e.prism ? `✨ Something is sparkling in the wilds…` : e.src === 'mythic' ? '🌠 Something strange fell from the stormy sky…' : null;
    case 'sold': return `Sold a ${morph(e.sp).name} for ${n(e.scrap)} scrap.`;
    case 'grafted': return `Grafted. ${morph(e.sp).name} is now level ${e.lv}${e.starUp ? ` and ${e.stars}★!` : '.'}`;
    case 'fightWon': {
      const loot = Object.entries(e.loot).map(([k, v]) => `${v} ${ITEMS[k as ItemId].name}${v! > 1 ? 's' : ''}`).join(', ');
      return `${e.wreck ? '🔧 Wreck cleared! Greebles came out of hiding. ' : 'Won! '}+${n(e.scrap)} scrap${loot ? `, ${loot}` : ''}.`;
    }
    case 'fightLost': return `Your ${morph(e.sp).name} ran from the fight. Level up and try again.`;
    case 'canEvolve': { const g = w.get(e.u); return g ? `🌟 Your ${morph(g.sp).name} is ready to evolve! (Bag)` : null; }
    case 'wreck': return `🤖 A robot is guarding a wreck. Beat it on the Fight tab for a burst of Greebles!`;
    case 'reward': return `📖 Guide reward: ${e.label}!`;
    case 'beacon': return '🛰️ Beacon on! Greebles will wander in fast for 30 minutes.';
    default: return null;
  }
}

const TIPS: { id: string; tab: Tab; text: string }[] = [
  { id: 'wilds', tab: 'wilds', text: 'Greebles wander into the wilds over time, even when the game is closed (up to 6 at once). Tap one, then throw a snare when the ring is small!' },
  { id: 'camp', tab: 'camp', text: 'Greebles in camp earn scrap and xp every 15 seconds, even when the game is closed. Better stars and evolved forms earn more.' },
  { id: 'bag', tab: 'bag', text: 'Greebles evolve when they reach the right level (some need an item, or night time). Graft a copy in for a big level jump and a chance at more stars.' },
  { id: 'fight', tab: 'fight', text: 'Robots patrol the planet. Skirmish Greebles break them for scrap and snares. Beat a robot at a wreck and Greebles come out of hiding.' },
  { id: 'shop', tab: 'shop', text: 'Spend scrap on snares, treats and Beacons. A Beacon brings Greebles in fast for 30 minutes.' },
];

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
  const [menu, setMenu] = useState<null | 'settings' | 'news' | 'dev'>(null);
  const [away, setAway] = useState<null | { ms: number; scrap: number; levels: number; waiting: number }>(null);
  const [evolving, setEvolving] = useState<null | { from: string; to: string; prism: boolean }>(null);
  const [encOpen, setEncOpen] = useState(() => !!world.s.enc);
  const [encKey, setEncKey] = useState(0);
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1); speedRef.current = speed;

  const flushEvents = () => {
    const evs = world.drain();
    const evo = evs.find(e => e.t === 'evolved') as Extract<GameEvent, { t: 'evolved' }> | undefined;
    if (evo) setEvolving({ from: evo.from, to: evo.to, prism: !!world.get(evo.u)?.prism });
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
    if (gone >= 10 * 60_000 && (r.scrap > 0 || r.waiting > 0)) setAway(r);
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

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast]);

  const s = world.s;
  const now = Date.now();
  const tip = TIPS.find(t => t.tab === tab && !s.tips[t.id]);
  const closeTip = (id: string) => { s.tips[id] = true; save(); redraw(); };
  const readyToEvolve = s.bag.some(g => world.evoOptions(g, now).some(o => o.ready));

  const startOver = () => {
    if (!confirm('Start over? Your Greebles, scrap and items will be gone.')) return;
    world.s = newGame();
    world.drain();
    wipeLocal();
    try { sessionStorage.setItem('greebles.fresh', '1'); } catch { /* ignore */ }
    save(true);
    setMenu(null); setTab('wilds'); setEncOpen(false); redraw();
  };
  const engage = (id: string) => { const r = world.startEncounter(id); if (!r.ok) act(r); else { setEncKey(k => k + 1); setEncOpen(true); save(); redraw(); } };

  return (
    <div className="gr-app">
      <header className="gr-top">
        <div className="gr-title"><b>GREEBLES</b><span>{isNight(now) ? '🌙 Night' : '☀️ Day'}{stormAt(now)?.on ? ' · ⛈️ Storm' : ''}</span></div>
        <div className="gr-sp" />
        <div className="gr-pill" title="Scrap">🔩 <span>{n(s.scrap)}</span></div>
        <button className="gr-icon" onClick={() => setMenu('news')} title="What's new">📜</button>
        <button className="gr-icon" onClick={() => setMenu('settings')} title="Settings">⚙</button>
      </header>
      <div className="gr-sub">Bag {s.bag.length}/{s.bagMax} · Camp {s.camp.filter(Boolean).length}/{s.camp.length} · +{world.campYield} scrap / 15s · 🟢 {world.count('snare')}{speed > 1 && <b className="gr-fast"> · ×{speed}</b>}</div>

      <main className="gr-main">
        {tip && <div className="gr-tip"><p>💡 {tip.text}</p><button onClick={() => closeTip(tip.id)}>Got it</button></div>}
        {tab === 'wilds' && <WildsView w={world} now={now} engage={engage} act={act} />}
        {tab === 'camp' && <CampView w={world} act={act} />}
        {tab === 'bag' && <BagView w={world} act={act} now={now} />}
        {tab === 'fight' && <FightView w={world} act={act} now={now} />}
        {tab === 'shop' && <ShopView w={world} act={act} now={now} />}
        {tab === 'guide' && <GuideView w={world} />}
      </main>

      <nav className="gr-tabs">
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => { setTab(t.id); setToast(null); }}>
            <span className="gr-ti">{t.icon}</span><span>{t.label}</span>
            {t.id === 'wilds' && tab !== 'wilds' && s.spawns.length > 0 && <i className="gr-count">{s.spawns.length}</i>}
            {t.id === 'bag' && readyToEvolve && <i className="gr-dot gold" />}
            {t.id === 'fight' && (s.fight || s.wreck) && <i className={`gr-dot ${s.wreck ? 'gold' : 'red'}`} />}
          </button>
        ))}
      </nav>

      {toast && <div className="gr-toast" onClick={() => setToast(null)}>{toast}</div>}

      {encOpen && <Encounter key={encKey} w={world} act={act} onDone={() => { setEncOpen(false); world.s.enc = null; save(); redraw(); }} />}

      {evolving && (
        <div className="gr-sheet-back" onClick={() => setEvolving(null)}>
          <div className={`gr-sheet gr-evo ${evolving.prism ? 'prism' : ''}`} onClick={e => e.stopPropagation()}>
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

      {away && !encOpen && (
        <div className="gr-sheet-back" onClick={() => setAway(null)}>
          <div className="gr-sheet" onClick={e => e.stopPropagation()}>
            <h2>Welcome back</h2>
            <p>You were gone {fmtDur(away.ms)}{away.ms >= RULES.offlineCapMs ? ' (camp counts up to 8 hours)' : ''}.</p>
            {away.scrap > 0 && <p className="gr-big">+{n(away.scrap)} scrap</p>}
            {away.levels > 0 && <p>Your campers went up {away.levels} level{away.levels > 1 ? 's' : ''}.</p>}
            {away.waiting > 0 && <p className="gr-big2">🌿 {away.waiting} Greeble{away.waiting > 1 ? 's are' : ' is'} out in the wilds!</p>}
            <button className="gr-btn-big" onClick={() => { setAway(null); setTab('wilds'); }}>{away.waiting > 0 ? 'Go catch them' : 'Nice'}</button>
          </div>
        </div>
      )}

      {menu === 'news' && <WhatsNew onClose={() => setMenu(null)} />}
      {menu === 'settings' && (
        <div className="gr-sheet-back" onClick={() => setMenu(null)}>
          <div className="gr-sheet" onClick={e => e.stopPropagation()}>
            <div className="gr-sheet-h"><b>Settings</b><button onClick={() => setMenu(null)}>✕</button></div>
            <button className="gr-row-btn" onClick={() => { s.tips = {}; save(); setMenu(null); redraw(); }}>Show the tips again</button>
            {dev && <button className="gr-row-btn" onClick={() => setMenu('dev')}>🛠 Test tools</button>}
            <button className="gr-row-btn bad" onClick={startOver}>Start over</button>
            <p className="gr-ver">Greebles v{pkg.version}</p>
          </div>
        </div>
      )}
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
              <button className="gr-btn" onClick={() => { s.scrap += 1000; s.items.snare = world.count('snare') + 20; save(); redraw(); }}>+1000 scrap, +20 snares</button>
              <button className="gr-btn" onClick={() => { s.nextWreckAt = 0; world.updateWilds(Date.now() + 30_000); act({ ok: true }); }}>Robot wreck</button>
              <button className="gr-btn" onClick={() => { const r = world.catchUp(60 * 60 * 1000); setToast(`Skipped 1 h: +${n(r.scrap)} scrap`); redraw(); }}>Skip 1 h (camp)</button>
            </div>
          </div>
        </div>
      )}
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
  const spawns = [...s.spawns].sort((a, b) => a.at - b.at);
  return (
    <>
      <section className={`gr-wilds ${isNight(now) ? 'night' : ''} ${storm?.on ? 'storm' : ''}`}>
        {spawns.map(x => {
          const m = morph(x.sp);
          return (
            <button key={x.id} className={`gr-spawn src-${x.src} ${x.prism ? 'prism' : ''}`} style={{ left: `${x.x * 100}%`, top: `${x.y * 100}%` }} onClick={() => engage(x.id)} title={m.name}>
              <Badge m={m} size={46} prism={x.prism} />
              <small className={`r-${m.rarity}`}>{s.seen[x.sp] ? m.name : '???'}</small>
            </button>
          );
        })}
        {!spawns.length && <div className="gr-wilds-empty">It's quiet out here…<br /><small>Greebles wander in over time. Check back soon, or find a hot spot below.</small></div>}
        <div className="gr-wilds-count">{spawns.length} out there</div>
      </section>

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

function Row({ g, w, right, now }: { g: Greeble; w: World; right?: React.ReactNode; now?: number }) {
  const m = morph(g.sp);
  const xpPct = g.lv >= RULES.maxLevel ? 100 : (g.xp / xpNeed(g.lv)) * 100;
  const evo = now ? w.evoOptions(g, now) : [];
  return (
    <div className="gr-row">
      <Badge m={m} prism={g.prism} />
      <div className="gr-grow">
        <b>{g.prism && '✨'}{m.name}</b> <span className="gr-lv">lv {g.lv}</span> <Stars n={g.stars} />
        <div className="gr-dim small"><span className={`r-${m.rarity}`}>{RARITY_LABEL[m.rarity]}</span> · {roleLabel(m.role)} · +{w.yieldOf(g)}{evo.length > 0 && !evo.some(o => o.ready) ? ` · evolves ${evo.map(o => o.evo.item ? '+' + ITEMS[o.evo.item].icon : o.evo.night ? '🌙' : '').join('/')}@${evo[0].evo.lv}` : ''}</div>
        <div className="gr-xp"><div style={{ width: `${xpPct}%` }} /></div>
      </div>
      {right}
    </div>
  );
}

function CampView({ w, act }: V) {
  const s = w.s;
  const free = s.bag.filter(g => !w.busy(g.u)).sort((a, b) => w.yieldOf(b) - w.yieldOf(a) || b.lv - a.lv);
  const full = !s.camp.includes(null);
  return (
    <>
      <section className="gr-card">
        <h2>Camp · {s.camp.filter(Boolean).length}/{s.camp.length} working</h2>
        <p className="gr-dim">Every 15 seconds each camper earns scrap and a little xp, even while you're away (up to 8 hours). The Field Guide unlocks more spots.</p>
        {s.camp.map((u, i) => { const g = u ? w.get(u) : undefined; return g
          ? <Row key={i} g={g} w={w} right={<button className="gr-btn" onClick={() => act(w.bench(i))}>Bench</button>} />
          : <div key={i} className="gr-row empty">Empty camp spot {i + 1}</div>; })}
      </section>
      <section className="gr-card">
        <h2>Send from bag</h2>
        {!free.length ? <div className="gr-empty">Catch Greebles in the Wilds, then park them here.</div>
          : free.slice(0, 30).map(g => <Row key={g.u} g={g} w={w} right={<button className="gr-btn g" disabled={full} onClick={() => act(w.assign(g.u))}>Camp</button>} />)}
      </section>
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
    if ((g.prism || rank(g) >= 2 || g.lv >= 10 || g.stars >= 4 || w.inCamp(g.u)) && !confirm(`Sell your ${g.prism ? 'PRISMATIC ' : ''}${m.name} (lv ${g.lv}, ${g.stars}★)${w.inCamp(g.u) ? ', which is camping,' : ''} for ${w.sellValue(g)} scrap?`)) return;
    act(w.sell(g.u));
  };
  return (
    <section className="gr-card">
      <h2>Bag {s.bag.length}/{s.bagMax}</h2>
      <div className="gr-sort">{(['kind', 'level', 'rarity', 'new'] as Sort[]).map(k => <button key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{k === 'kind' ? 'Kind' : k === 'level' ? 'Level' : k === 'rarity' ? 'Rarity' : 'Newest'}</button>)}</div>
      {!sorted.length && <div className="gr-empty">Empty. Go catch some in the Wilds.</div>}
      {sorted.map(g => {
        const tag = w.inCamp(g.u) ? '⛺ camping' : s.fight?.u === g.u ? '⚔️ fighting' : null;
        const canGraft = !!w.graftPartner(g.u);
        const ready = w.evoOptions(g, now).filter(o => o.ready);
        return (
          <div key={g.u} className={`gr-bagitem ${ready.length ? 'evo-ready' : ''}`}>
            <Row g={g} w={w} now={now} />
            <div className="gr-btns">
              {tag && <span className="gr-tag">{tag}</span>}
              {ready.map(o => <button key={o.evo.to} className="gr-btn evo" onClick={() => act(w.evolve(g.u, o.evo.to, Date.now()))}>🌟 Evolve{ready.length > 1 || o.evo.item ? ` → ${morph(o.evo.to).name}` : ''}</button>)}
              {canGraft && <button className="gr-btn o" onClick={() => act(w.graft(g.u))}>Graft</button>}
              <button className="gr-btn d" disabled={s.fight?.u === g.u} onClick={() => sell(g)}>Sell {n(w.sellValue(g))}</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function FightView({ w, act, now }: V & { now: number }) {
  const s = w.s;
  if (s.fight) {
    const f = s.fight, g = w.get(f.u)!, m = morph(g.sp), r = ROBOTS.find(x => x.id === f.robot)!;
    return (
      <section className="gr-card">
        <h2>{f.wreck ? 'Battle at the wreck' : 'Battle'}</h2>
        <div className="gr-row"><Badge m={m} prism={g.prism} /><div className="gr-grow"><b>{m.name}</b> lv {g.lv} · HP {Math.max(0, f.hp)}<div className="gr-hp"><div style={{ width: `${Math.max(0, (100 * f.hp) / f.maxHp)}%` }} /></div></div></div>
        <div className="gr-vs">VS</div>
        <div className="gr-row"><div className="gr-badge robot">🤖</div><div className="gr-grow"><b>{r.name}</b> · HP {Math.max(0, f.robotHp)}<div className="gr-hp bot"><div style={{ width: `${Math.max(0, (100 * f.robotHp) / f.robotMax)}%` }} /></div></div></div>
        <p className="gr-dim">The fight plays itself, one hit a second. Camp keeps working.</p>
      </section>
    );
  }
  const fighters = s.bag.filter(g => morph(g.sp).role === 'fight').sort((a, b) => w.power(b) - w.power(a));
  const wr = s.wreck && ROBOTS.find(r => r.id === s.wreck!.robot);
  return (
    <>
      {wr && (
        <section className="gr-card gr-wreck">
          <h2>🤖 Robot wreck</h2>
          <p className="gr-dim">A {wr.name} (tougher than usual) is guarding a wreck for {fmtTime(s.wreck!.until - now)}. Beat it and {RULES.wreckBurst} Greebles come out of hiding, with better odds of rare ones.</p>
          {!fighters.length ? <div className="gr-empty">You need a Skirmish Greeble.</div> : fighters.slice(0, 6).map(g => {
            const win = w.wouldWin(g, wr.id, true);
            return <Row key={g.u} g={g} w={w} right={<button className={`gr-btn ${win ? 'g' : 'd'}`} disabled={w.inCamp(g.u)} onClick={() => act(w.startFight(g.u, wr.id, true))}>{win ? '✓' : '✗'} Attack</button>} />;
          })}
        </section>
      )}
      <section className="gr-card">
        <h2>Robot patrol</h2>
        <p className="gr-dim">Only Skirmish Greebles fight. Wins pay scrap, xp and snares (sometimes an evolution item). ✓ means you should win.</p>
        <div className="gr-robots">{ROBOTS.map(r => <div key={r.id} className="gr-robot"><b>{r.name}</b><span>HP {r.hp} · hits {r.atk}</span></div>)}</div>
        {!fighters.length ? <div className="gr-empty">You need a Skirmish Greeble (Scrap, Rust, Thorn…). Catch one in the Wilds.</div>
          : fighters.map(g => (
            <div key={g.u} className="gr-bagitem">
              <Row g={g} w={w} />
              <div className="gr-btns">
                <span className="gr-tag pow">Power {w.power(g)}{w.inCamp(g.u) ? ' · ⛺ camping' : ''}</span>
                {ROBOTS.map(r => { const win = w.wouldWin(g, r.id); return <button key={r.id} className={`gr-btn ${win ? 'g' : 'd'}`} disabled={w.inCamp(g.u)} onClick={() => act(w.startFight(g.u, r.id))}>{win ? '✓' : '✗'} {r.short}</button>; })}
              </div>
            </div>))}
      </section>
    </>
  );
}

function ShopView({ w, act, now }: V & { now: number }) {
  const shop: ItemId[] = ['snare', 'good', 'great', 'treat', 'beacon', 'ember', 'pearl', 'sun', 'moon'];
  const owned = (Object.keys(ITEMS) as ItemId[]).filter(k => w.count(k) > 0);
  return (
    <>
      <section className="gr-card">
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
      </section>
      <section className="gr-card">
        <h2>Your items</h2>
        {!owned.length ? <div className="gr-empty">Nothing yet.</div> : <div className="gr-items">{owned.map(k => <span key={k} className="gr-chip">{ITEMS[k].icon} {ITEMS[k].name} ×{w.count(k)}</span>)}</div>}
        <p className="gr-dim small">{isNight(now) ? '🌙 It is night: Night Veils and Hollow Shades can evolve now.' : 'Some Greebles only evolve at night.'}</p>
      </section>
    </>
  );
}

function GuideView({ w }: { w: World }) {
  const s = w.s;
  const caught = w.caughtCount;
  const next = REWARDS.find(r => !s.claimed[r.id]);
  const prisms = Object.keys(s.prismCaught).length;
  return (
    <>
      <section className="gr-card">
        <h2>Field guide · {caught}/{MORPHS.length} caught</h2>
        <p className="gr-dim small">Seen {Object.keys(s.seen).length} · ✨ Prismatic {prisms}/{MORPHS.length}</p>
        <div className="gr-bar"><div style={{ width: `${(caught / MORPHS.length) * 100}%` }} /></div>
        {next && <p className="gr-dim small">Next reward at {next.need} caught: <b className="gr-gold">{next.label}</b></p>}
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
      </section>
      <section className="gr-card">
        <h2>Guide rewards</h2>
        {REWARDS.map(r => <div key={r.id} className={`gr-reward ${s.claimed[r.id] ? 'done' : ''}`}><span>{s.claimed[r.id] ? '✅' : `${Math.min(caught, r.need)}/${r.need}`}</span><b>{r.label}</b></div>)}
      </section>
      <section className="gr-card">
        <h2>Your trip so far</h2>
        <div className="gr-stats">
          <span>Greebles caught</span><b>{n(s.stats.caught)}</b><span>Snares thrown</span><b>{n(s.stats.thrown)}</b>
          <span>Perfect throws</span><b>{n(s.stats.perfects)}</b><span>Got away</span><b>{n(s.stats.fled)}</b>
          <span>✨ Prismatics caught</span><b>{n(s.stats.prisms)}</b><span>Evolved</span><b>{n(s.stats.evolved)}</b>
          <span>Robots broken</span><b>{n(s.stats.wins)}</b><span>Wrecks cleared</span><b>{n(s.stats.wrecks)}</b>
          <span>Scrap earned</span><b>{n(s.stats.scrapEarned)}</b>
        </div>
      </section>
    </>
  );
}
