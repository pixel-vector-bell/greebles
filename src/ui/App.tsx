import { useEffect, useRef, useState } from 'react';
import { World, newGame, type GameEvent, type Greeble } from '../sim/world';
import { MORPHS, ROBOTS, RULES, morph, roleLabel, xpNeed, type Morph } from '../sim/content';
import { saveLocal, wipeLocal } from '../save/storage';
import { onHubFlush, sendToHub } from '../save/hub';
import { devEnabled } from '../save/dev';
import { WhatsNew } from './WhatsNew';
import pkg from '../../package.json';

type Tab = 'walk' | 'camp' | 'bag' | 'fight' | 'guide';
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'walk', icon: '🧭', label: 'Walk' }, { id: 'camp', icon: '⛺', label: 'Camp' },
  { id: 'bag', icon: '🎒', label: 'Bag' }, { id: 'fight', icon: '⚔️', label: 'Fight' }, { id: 'guide', icon: '📖', label: 'Guide' },
];

const fmtTime = (ms: number) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmtDur = (ms: number) => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
const n = (v: number) => Math.floor(v).toLocaleString('en-US');

function Badge({ m, size = 40 }: { m: Morph; size?: number }) {
  return <div className={`gr-badge r-${m.rarity}`} style={{ background: m.color, width: size, height: size, fontSize: size * 0.48 }}>{m.mark}</div>;
}

function message(e: GameEvent, w: World): string | null {
  switch (e.t) {
    case 'walkEmpty': return 'You walked a long way. Nothing followed you back.';
    case 'walkFled': return `A ${morph(e.sp).name} watched you, then vanished.`;
    case 'walkBagFull': return `A ${morph(e.sp).name} wanted to come, but your bag is full. Sell or graft first.`;
    case 'caught': return `${e.first ? 'New! ' : ''}A ${morph(e.sp).name} followed you home.`;
    case 'sold': return `Sold a ${morph(e.sp).name} for ${n(e.scrap)} scrap.`;
    case 'grafted': return `Grafted. ${morph(e.sp).name} is now level ${e.lv}.`;
    case 'evolved': return `✨ Your ${morph(e.from).name} grew into a ${morph(e.to).name}!`;
    case 'fightWon': return `Won! Your ${morph(e.sp).name} broke the robot ${ROBOTS.find(r => r.id === e.robot)?.short.toLowerCase()}. +${n(e.scrap)} scrap.`;
    case 'fightLost': return `Your ${morph(e.sp).name} ran from the fight. Level up and try again.`;
    case 'level': { const g = w.get(e.u); return g && !w.inCamp(e.u) ? `${morph(g.sp).name} reached level ${e.lv}.` : null; }
  }
}

const TIPS: { id: string; tab: Tab; text: string }[] = [
  { id: 'walk', tab: 'walk', text: 'You are stranded on a strange planet. Tap “Walk the planet”. Sometimes a Greeble follows you home.' },
  { id: 'camp', tab: 'camp', text: 'Greebles in camp earn scrap and xp every 15 seconds, even when the game is closed. You have 4 camp spots.' },
  { id: 'bag', tab: 'bag', text: 'Got two of the same Greeble? Graft one into the other for a big level jump. Some grow into a new form.' },
  { id: 'fight', tab: 'fight', text: 'Robots patrol the planet. Send a Skirmish Greeble to break them for scrap and xp. Robots never join you.' },
];

export function App({ start }: { start: ReturnType<typeof newGame> | null }) {
  const worldRef = useRef<World | null>(null);
  if (!worldRef.current) worldRef.current = new World(start);
  const world = worldRef.current;
  const dev = devEnabled();
  if (dev) (window as any).__gr = world;
  const [, setFrame] = useState(0);
  const redraw = () => setFrame(f => (f + 1) % 1e6);
  const [tab, setTab] = useState<Tab>('walk');
  const [toast, setToast] = useState<string | null>(null);
  const [menu, setMenu] = useState<null | 'settings' | 'news' | 'dev'>(null);
  const [away, setAway] = useState<null | { ms: number; scrap: number; levels: number }>(null);
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(1); speedRef.current = speed;

  const flushEvents = () => {
    const msgs = world.drain().map(e => message(e, world)).filter(Boolean) as string[];
    if (msgs.length) setToast(msgs[msgs.length - 1]);
  };
  const act = (r: { ok: boolean; why?: string }) => { if (!r.ok && r.why) setToast(r.why); flushEvents(); save(); redraw(); };
  const save = (flush = false) => { world.s.lastSeen = Date.now(); saveLocal(world.s); sendToHub(world.s, flush); };

  // offline catch-up, then a 1 s loop
  useEffect(() => {
    const gone = Date.now() - world.s.lastSeen;
    if (gone > 1000) { const r = world.catchUp(gone); if (r.ms >= 60_000 && r.scrap > 0) setAway(r); }
    let last = Date.now();
    const iv = window.setInterval(() => {
      const now = Date.now();
      world.advance((now - last) * speedRef.current);
      last = now;
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

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2800); return () => clearTimeout(t); }, [toast]);

  const s = world.s;
  const now = Date.now();
  const tip = TIPS.find(t => t.tab === tab && !s.tips[t.id]);
  const closeTip = (id: string) => { s.tips[id] = true; save(); redraw(); };

  const startOver = () => {
    if (!confirm('Start over? Your Greebles, scrap and camp will be gone.')) return;
    world.s = newGame();   // swap the state in place so the running loops pick it up
    world.drain();
    wipeLocal();
    try { sessionStorage.setItem('greebles.fresh', '1'); } catch { /* ignore */ }
    save(true);
    setMenu(null); setTab('walk'); redraw();
  };

  return (
    <div className="gr-app">
      <header className="gr-top">
        <div className="gr-title"><b>GREEBLES</b><span>Lost on a strange planet</span></div>
        <div className="gr-sp" />
        <div className="gr-pill" title="Scrap">🔩 <span>{n(s.scrap)}</span></div>
        <button className="gr-icon" onClick={() => setMenu('news')} title="What's new">📜</button>
        <button className="gr-icon" onClick={() => setMenu('settings')} title="Settings">⚙</button>
      </header>
      <div className="gr-sub">Bag {s.bag.length}/{RULES.bagMax} · Camp {s.camp.filter(Boolean).length}/{RULES.campSlots} · +{world.campYield} scrap / 15s{speed > 1 && <b className="gr-fast"> · ×{speed}</b>}</div>

      <main className="gr-main">
        {tip && <div className="gr-tip"><p>💡 {tip.text}</p><button onClick={() => closeTip(tip.id)}>Got it</button></div>}
        {tab === 'walk' && <WalkView w={world} now={now} act={act} />}
        {tab === 'camp' && <CampView w={world} act={act} />}
        {tab === 'bag' && <BagView w={world} act={act} />}
        {tab === 'fight' && <FightView w={world} act={act} />}
        {tab === 'guide' && <GuideView w={world} />}
      </main>

      <nav className="gr-tabs">
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => { setTab(t.id); setToast(null); }}>
            <span className="gr-ti">{t.icon}</span><span>{t.label}</span>
            {t.id === 'walk' && tab !== 'walk' && world.huntReady(now) && <i className="gr-dot" />}
            {t.id === 'fight' && s.fight && <i className="gr-dot red" />}
          </button>
        ))}
      </nav>

      {toast && <div className="gr-toast" onClick={() => setToast(null)}>{toast}</div>}

      {away && (
        <div className="gr-sheet-back" onClick={() => setAway(null)}>
          <div className="gr-sheet" onClick={e => e.stopPropagation()}>
            <h2>Welcome back</h2>
            <p>You were gone {fmtDur(away.ms)}{away.ms >= RULES.offlineCapMs ? ' (camp counts up to 8 hours)' : ''}.</p>
            <p className="gr-big">+{n(away.scrap)} scrap</p>
            {away.levels > 0 && <p>Your campers went up {away.levels} level{away.levels > 1 ? 's' : ''}.</p>}
            <button className="gr-btn-big" onClick={() => setAway(null)}>Nice</button>
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
            <div className="gr-btns">
              {[1, 10, 100].map(v => <button key={v} className={`gr-btn ${speed === v ? 'g' : ''}`} onClick={() => setSpeed(v)}>×{v}</button>)}
            </div>
            <div className="gr-btns">
              <button className="gr-btn" onClick={() => { s.huntAt = 0; redraw(); }}>Walk now</button>
              <button className="gr-btn" onClick={() => { s.scrap += 1000; save(); redraw(); }}>+1000 scrap</button>
              <button className="gr-btn" onClick={() => { const r = world.catchUp(60 * 60 * 1000); setToast(`Skipped 1 h: +${n(r.scrap)} scrap`); redraw(); }}>Skip 1 h</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type V = { w: World; act: (r: { ok: boolean; why?: string }) => void };

function WalkView({ w, now, act }: V & { now: number }) {
  const ready = w.huntReady(now);
  const left = w.huntLeft(now);
  const pct = ready ? 100 : 100 - (left / RULES.huntMs) * 100;
  return (
    <>
      <section className="gr-card gr-walk">
        <h2>Explore</h2>
        <p className="gr-dim">Walk out into the wilds. A Greeble might decide it likes you. Rarer ones are shy.</p>
        <div className="gr-timer">{ready ? 'Ready' : fmtTime(left)}</div>
        <div className="gr-bar"><div style={{ width: `${pct}%` }} /></div>
        <button className="gr-btn-big" disabled={!ready} onClick={() => act(w.walk(Date.now()))}>{ready ? 'Walk the planet' : 'Resting…'}</button>
      </section>
      <section className="gr-card">
        <h2>Greebles vs machines</h2>
        <p className="gr-dim">Every Greeble is the same little creature, but each one has a job: <b>Dig</b>, <b>Trawl</b> or <b>Skirmish</b>. Camp four of them to earn scrap. Graft two of the same kind to make one stronger. Send Skirmishers to break the robots that patrol the planet.</p>
      </section>
    </>
  );
}

function Row({ g, w, right }: { g: Greeble; w: World; right?: React.ReactNode }) {
  const m = morph(g.sp);
  const xpPct = g.lv >= RULES.maxLevel ? 100 : (g.xp / xpNeed(g.lv)) * 100;
  return (
    <div className="gr-row">
      <Badge m={m} />
      <div className="gr-grow">
        <b>{m.name}</b> <span className="gr-lv">lv {g.lv}</span>
        <div className="gr-dim small"><span className={`r-${m.rarity}`}>{m.rarity}</span> · {roleLabel(m.role)} · +{w.yieldOf(g)} scrap{m.evo ? ` · grows @${m.evoLv}` : ''}</div>
        <div className="gr-xp"><div style={{ width: `${xpPct}%` }} /></div>
      </div>
      {right}
    </div>
  );
}

function CampView({ w, act }: V) {
  const s = w.s;
  const free = s.bag.filter(g => !w.inCamp(g.u) && s.fight?.u !== g.u).sort((a, b) => w.yieldOf(b) - w.yieldOf(a) || b.lv - a.lv);
  const full = !s.camp.includes(null);
  return (
    <>
      <section className="gr-card">
        <h2>Camp · {s.camp.filter(Boolean).length}/{RULES.campSlots} working</h2>
        <p className="gr-dim">Every 15 seconds each camper earns scrap and a little xp. It keeps going while you are away (up to 8 hours).</p>
        {s.camp.map((u, i) => { const g = u ? w.get(u) : undefined; return g
          ? <Row key={i} g={g} w={w} right={<button className="gr-btn" onClick={() => act(w.bench(i))}>Bench</button>} />
          : <div key={i} className="gr-row empty">Empty camp spot {i + 1}</div>; })}
      </section>
      <section className="gr-card">
        <h2>Send from bag</h2>
        {!free.length ? <div className="gr-empty">Walk the planet to find Greebles, then park them here.</div>
          : free.map(g => <Row key={g.u} g={g} w={w} right={<button className="gr-btn g" disabled={full} onClick={() => act(w.assign(g.u))}>Camp</button>} />)}
      </section>
    </>
  );
}

function BagView({ w, act }: V) {
  const s = w.s;
  const sorted = [...s.bag].sort((a, b) => morph(a.sp).name.localeCompare(morph(b.sp).name) || b.lv - a.lv);
  const sell = (g: Greeble) => {
    const m = morph(g.sp);
    if ((m.rarity === 'rare' || m.rarity === 'chase' || g.lv >= 10 || w.inCamp(g.u)) && !confirm(`Sell your ${m.name} (lv ${g.lv})${w.inCamp(g.u) ? ', which is camping,' : ''} for ${w.sellValue(g)} scrap?`)) return;
    act(w.sell(g.u));
  };
  return (
    <section className="gr-card">
      <h2>Bag {s.bag.length}/{RULES.bagMax}</h2>
      <p className="gr-dim">Sell for scrap, or graft two of the same kind for a big level jump.</p>
      {!sorted.length && <div className="gr-empty">Empty. Go for a walk.</div>}
      {sorted.map(g => {
        const tag = w.inCamp(g.u) ? '⛺ camping' : s.fight?.u === g.u ? '⚔️ fighting' : null;
        const canGraft = !!w.graftPartner(g.u);
        return (
          <div key={g.u} className="gr-bagitem">
            <Row g={g} w={w} />
            <div className="gr-btns">
              {tag && <span className="gr-tag">{tag}</span>}
              {canGraft && <button className="gr-btn o" onClick={() => act(w.graft(g.u))}>Graft</button>}
              <button className="gr-btn d" disabled={s.fight?.u === g.u} onClick={() => sell(g)}>Sell {n(w.sellValue(g))}</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function FightView({ w, act }: V) {
  const s = w.s;
  if (s.fight) {
    const f = s.fight, g = w.get(f.u)!, m = morph(g.sp), r = ROBOTS.find(x => x.id === f.robot)!;
    return (
      <section className="gr-card">
        <h2>Battle</h2>
        <div className="gr-row"><Badge m={m} /><div className="gr-grow"><b>{m.name}</b> lv {g.lv} · HP {Math.max(0, f.hp)}<div className="gr-hp"><div style={{ width: `${Math.max(0, (100 * f.hp) / f.maxHp)}%` }} /></div></div></div>
        <div className="gr-vs">VS</div>
        <div className="gr-row"><div className="gr-badge robot">🤖</div><div className="gr-grow"><b>{r.name}</b> · HP {Math.max(0, f.robotHp)}<div className="gr-hp bot"><div style={{ width: `${Math.max(0, (100 * f.robotHp) / r.hp)}%` }} /></div></div></div>
        <p className="gr-dim">The fight plays itself, one hit a second. Camp keeps working.</p>
      </section>
    );
  }
  const fighters = s.bag.filter(g => morph(g.sp).role === 'fight').sort((a, b) => w.power(b) - w.power(a));
  return (
    <section className="gr-card">
      <h2>Robot patrol</h2>
      <p className="gr-dim">Only Skirmish Greebles fight. Bigger robots hit harder but pay more xp. ✓ means you should win, ✗ means level up first. Campers have to be benched first.</p>
      <div className="gr-robots">{ROBOTS.map(r => <div key={r.id} className="gr-robot"><b>{r.name}</b><span>HP {r.hp} · hits {r.atk}</span></div>)}</div>
      {!fighters.length ? <div className="gr-empty">You need a Skirmish Greeble (Scrap, Rust, Thorn…). Keep walking.</div>
        : fighters.map(g => (
          <div key={g.u} className="gr-bagitem">
            <Row g={g} w={w} />
            <div className="gr-btns">
              <span className="gr-tag pow">Power {w.power(g)}{w.inCamp(g.u) ? ' · ⛺ camping' : ''}</span>
              {ROBOTS.map(r => { const win = w.wouldWin(g, r.id); return <button key={r.id} className={`gr-btn ${win ? 'g' : 'd'}`} disabled={w.inCamp(g.u)} title={win ? 'You should win' : 'Too strong for now'} onClick={() => act(w.startFight(g.u, r.id))}>{win ? '✓' : '✗'} {r.short}</button>; })}
            </div>
          </div>))}
    </section>
  );
}

function GuideView({ w }: { w: World }) {
  const s = w.s;
  const found = MORPHS.filter(m => s.seen[m.id]).length;
  const roles = ['mine', 'fish', 'fight'] as const;
  return (
    <>
      <section className="gr-card">
        <h2>Field guide · {found}/{MORPHS.length}</h2>
        <p className="gr-dim">Every kind of Greeble you have owned. Grown forms only come from grafting.</p>
        {roles.map(role => (
          <div key={role}>
            <h3 className="gr-h3">{roleLabel(role)}</h3>
            <div className="gr-guide">
              {MORPHS.filter(m => m.role === role).map(m => s.seen[m.id]
                ? <div key={m.id} className="gr-gitem"><Badge m={m} size={36} /><span>{m.name}</span></div>
                : <div key={m.id} className="gr-gitem unk"><div className="gr-badge" style={{ width: 36, height: 36 }}>?</div><span>???</span></div>)}
            </div>
          </div>
        ))}
      </section>
      <section className="gr-card">
        <h2>Your trip so far</h2>
        <div className="gr-stats">
          <span>Walks</span><b>{n(s.stats.walks)}</b><span>Greebles found</span><b>{n(s.stats.caught)}</b>
          <span>Grafts</span><b>{n(s.stats.grafts)}</b><span>Grown</span><b>{n(s.stats.evolved)}</b>
          <span>Robots broken</span><b>{n(s.stats.wins)}</b><span>Scrap earned</span><b>{n(s.stats.scrapEarned)}</b>
        </div>
      </section>
    </>
  );
}
