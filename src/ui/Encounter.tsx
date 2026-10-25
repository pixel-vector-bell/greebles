import { useEffect, useRef, useState } from 'react';
import type { World, Spawn } from '../sim/world';
import { ITEMS, RARITY_LABEL, SNARES, THROW_LABEL, elementOf, morph, roleLabel, type SnareId } from '../sim/content';
import { Badge, El, Stars } from './bits';
import { sfx } from './sfx';

/**
 * The catch screen. The Greeble bobs around; a ring around it shrinks and grows.
 * Tap THROW when the ring is small: Nice / Great / Perfect throws catch better.
 */
export function Encounter({ w, onDone, act }: { w: World; onDone: () => void; act: (r: { ok: boolean; why?: string }) => void }) {
  const enc = w.s.enc;
  const live: Spawn | undefined = enc ? w.spawn(enc.spawn) : undefined;
  const [snare, setSnare] = useState<SnareId>(() => SNARES.find(s => w.count(s) > 0) ?? 'snare');
  const [phase, setPhase] = useState<'aim' | 'flying' | 'wobble' | 'caught' | 'broke' | 'fled'>('aim');
  const [label, setLabel] = useState('');
  const ring = useRef(1);
  const ringEl = useRef<HTMLDivElement>(null);
  const bodyEl = useRef<HTMLDivElement>(null);
  const result = useRef<{ caught: boolean; fled: boolean; reward?: string } | null>(null);
  const last = useRef<Spawn | undefined>(undefined);
  if (live) last.current = live;
  // While the snare is in the air the Greeble may already be in your bag: keep showing it.
  const x = live ?? (phase !== 'aim' ? last.current : undefined);

  // ring + bobbing animation (DOM writes only, no React re-render per frame)
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const speed = x ? 0.0016 + ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].indexOf(morph(x.sp).rarity) * 0.00035 : 0.002;
    const loop = (t: number) => {
      const p = (t - t0) * speed;
      ring.current = 0.45 + 0.55 * (0.5 + 0.5 * Math.cos(p));          // 1 → 0.45 → 1 (never smaller than the Greeble)
      if (ringEl.current) ringEl.current.style.transform = `translate(-50%,-50%) scale(${ring.current})`;
      if (bodyEl.current && phase === 'aim') bodyEl.current.style.transform = `translate(${Math.sin(p * 0.7) * 34}px, ${Math.sin(p * 1.3) * 10}px)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, x?.id]);

  useEffect(() => { if (!x) onDone(); }, [!x]);
  if (!x) return null;
  const m = morph(x.sp);
  const hasSnare = w.count(snare) > 0;
  const chance = w.catchChance(snare, 0);

  const throwIt = () => {
    if (phase !== 'aim' || !hasSnare) return;
    const r = ring.current;
    const q = r < 0.52 ? 3 : r < 0.64 ? 2 : r < 0.78 ? 1 : 0;
    const caughtBefore = w.s.stats.caught, fledBefore = w.s.stats.fled;
    const res = w.throwSnare(snare, q);
    if (!res.ok) { act(res); return; }
    const evs = w.drain();
    const reward = evs.find(e => e.t === 'reward') as { label: string } | undefined;
    result.current = { caught: w.s.stats.caught > caughtBefore, fled: w.s.stats.fled > fledBefore, reward: reward?.label };
    const got = evs.find(e => e.t === 'caught') as { first: boolean; scrap: number } | undefined;
    setLabel([THROW_LABEL[q], got ? `${got.first ? 'NEW! ' : ''}+${got.scrap} scrap${reward ? ` · Guide reward: ${reward.label}` : ''}` : ''].filter(Boolean).join(' '));
    setPhase('flying'); sfx.throw();
    if (q === 3) setTimeout(() => sfx.perfect(), 120);
    setTimeout(() => { setPhase('wobble'); sfx.wobble(); }, 450);
    setTimeout(() => {
      const r2 = result.current!;
      setPhase(r2.caught ? 'caught' : r2.fled ? 'fled' : 'broke');
      if (r2.caught) (x.prism ? sfx.prism : ['epic', 'legendary', 'mythic'].includes(m.rarity) ? sfx.caughtRare : sfx.caught)();
      else if (r2.fled) sfx.fled(); else sfx.broke();
      act({ ok: true });
      if (!r2.caught && !r2.fled) setTimeout(() => setPhase('aim'), 900);
    }, 450 + (result.current.caught ? 1800 : 1100));
  };

  if (phase === 'caught' || phase === 'fled') return <ResultCard phase={phase} label={label} m={m} prism={x.prism} stars={x.stars} lv={x.lv} onDone={onDone} />;

  return (
    <div className={`gr-enc ${x.prism ? 'prism' : ''} r-bg-${m.rarity}`}>
      <div className="gr-enc-top">
        <button className="gr-btn" onClick={() => { w.leaveEncounter(); onDone(); }}>🏃 Leave</button>
        <div className="gr-enc-name">
          <b>{x.prism && '✨ '}{m.name}</b>
          <span><span className={`r-${m.rarity}`}>{RARITY_LABEL[m.rarity]}</span> · <El id={elementOf(m.id)} long /> · {roleLabel(m.role)} · lv {x.lv}</span>
        </div>
      </div>
      <div className="gr-enc-field" onClick={throwIt}>
        <div className="gr-enc-target">
          <div ref={bodyEl} className={`gr-enc-body ${phase}`}>
            <Badge m={m} size={96} prism={x.prism} />
            <div ref={ringEl} className={`gr-ring q${chance > 0.5 ? 'e' : chance > 0.25 ? 'm' : 'h'}`} />
            {phase !== 'aim' && <div className={`gr-snare-ball ${phase}`}>{ITEMS[snare].icon}</div>}
          </div>
        </div>
        <div className="gr-enc-msg">
          {phase === 'aim' && (enc?.treat ? '🍃 It looks calm.' : 'Tap when the ring is small!')}
          {phase === 'flying' && label}
          {phase === 'wobble' && '…'}
          {phase === 'broke' && `${label ? label + ' ' : ''}Argh! It broke free.`}
        </div>
      </div>
      <div className="gr-enc-bar">
        <div className="gr-snares">
          {SNARES.map(s => (
            <button key={s} className={`gr-snare ${snare === s ? 'on' : ''}`} disabled={w.count(s) < 1} onClick={() => setSnare(s)}>
              <span>{ITEMS[s].icon}</span><small>{ITEMS[s].name.replace(' Snare', '')}</small><b>{w.count(s)}</b>
            </button>
          ))}
          <button className="gr-snare treat" disabled={w.count('treat') < 1 || !!enc?.treat || phase !== 'aim'} onClick={() => act(w.useTreat())}>
            <span>🍃</span><small>Treat</small><b>{w.count('treat')}</b>
          </button>
        </div>
        <button className="gr-btn-big" disabled={phase !== 'aim' || !hasSnare} onClick={throwIt}>
          {hasSnare ? `Throw ${ITEMS[snare].name}` : `No ${ITEMS[snare].name}s — buy some in the Shop`}
        </button>
        <div className="gr-dim small center">{Math.round(chance * 100)}% catch · Nice / Great / Perfect throws go higher</div>
        <div className="gr-dim small center">Quality <Stars n={x.stars} hidden /></div>
      </div>
    </div>
  );
}

function ResultCard({ phase, label, m, prism, stars, lv, onDone }: { phase: 'caught' | 'fled'; label: string; m?: ReturnType<typeof morph>; prism?: boolean; stars?: number; lv?: number; onDone: () => void }) {
  return (
    <div className="gr-sheet-back"><div className={`gr-sheet ${prism ? 'prism' : ''}`}>
      {phase === 'caught' && m ? (<>
        <h2>Gotcha!</h2>
        <div className="gr-center"><Badge m={m} size={96} prism={prism} /></div>
        <p><b>{prism && '✨ '}{m.name}</b> lv {lv} joined you.</p>
        <p><Stars n={stars ?? 1} /></p>
        {prism && <p className="gr-prism-text">A PRISMATIC Greeble! About 1 in 400.</p>}
        {m.rarity === 'mythic' && <p className="gr-prism-text">🌠 A MYTHIC Greeble! One of the rarest on the planet.</p>}
        {label && <p className="gr-dim">{label}</p>}
      </>) : (<>
        <h2>It ran off…</h2>
        {m && <p>The {m.name} slipped away into the wilds.</p>}
      </>)}
      <button className="gr-btn-big" onClick={onDone}>OK</button>
    </div></div>
  );
}
