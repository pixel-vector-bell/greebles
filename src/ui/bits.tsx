import { useState } from 'react';
import { ELEMENTS, type Element, type Morph } from '../sim/content';

/** Art lives next to index.html in art/<id>.webp; if a picture is missing we fall back to the old shape. */
export const artUrl = (id: string) => `./art/${id}.webp`;

export function Badge({ m, size = 40, prism = false }: { m: Morph; size?: number; prism?: boolean }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`gr-badge r-${m.rarity} ${prism ? 'prism' : ''} ${broken ? '' : 'art'}`}
      style={{ background: prism ? undefined : broken ? m.color : undefined, width: size, height: size, fontSize: size * 0.48 }}>
      {broken ? m.mark : <img src={artUrl(m.id)} alt="" draggable={false} onError={() => setBroken(true)} />}
    </div>
  );
}

/** Boss robot art (art/boss_<area>.webp), emoji fallback. */
export function BossArt({ reg, size = 44 }: { reg: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="gr-badge robot boss art" style={{ width: size, height: size }}>
      {broken ? '🦾' : <img src={artUrl(`boss_${reg}`)} alt="" draggable={false} onError={() => setBroken(true)} />}
    </div>
  );
}

/** Quality stars. `hidden` = not caught yet, so you don't know them. */
export function Stars({ n, hidden = false }: { n: number; hidden?: boolean }) {
  if (hidden) return <span className="gr-stars hidden">? ? ? ? ?</span>;
  return <span className="gr-stars">{'★'.repeat(n)}<i>{'★'.repeat(5 - n)}</i></span>;
}

export const n = (v: number) => (Number.isInteger(v) ? v : Math.floor(v)).toLocaleString('en-US');
export const fmtTime = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};
export const fmtDur = (ms: number) => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };

export function El({ id, long = false }: { id: Element; long?: boolean }) {
  const e = ELEMENTS[id];
  return <span className="gr-el" style={{ borderColor: e.color, color: e.color }} title={e.name}>{e.icon}{long ? ` ${e.name}` : ''}</span>;
}
