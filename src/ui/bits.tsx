import type { Morph } from '../sim/content';

export function Badge({ m, size = 40, prism = false }: { m: Morph; size?: number; prism?: boolean }) {
  return (
    <div className={`gr-badge r-${m.rarity} ${prism ? 'prism' : ''}`}
      style={{ background: prism ? undefined : m.color, width: size, height: size, fontSize: size * 0.48 }}>
      {m.mark}
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
