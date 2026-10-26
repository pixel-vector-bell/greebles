import { useState } from 'react';

/** Remembers which sub-menu each tab was on, so going back to a tab keeps your place. */
const memory = new Map<string, string>();

export interface SubItem<K extends string> { k: K; label: string; dot?: boolean; hide?: boolean }

/** Sub-menu for a tab: one short page at a time instead of one very long page. */
export function useSub<K extends string>(tab: string, first: K): [K, (k: K) => void] {
  const [k, setK] = useState<K>(() => (memory.get(tab) as K) ?? first);
  return [k, (v: K) => { memory.set(tab, v); setK(v); document.querySelector('.gr-pane .gr-main, .gr-main:not(.gr-left)')?.scrollTo({ top: 0 }); }];
}
export const setSubMemory = (tab: string, k: string) => memory.set(tab, k);

export function SubTabs<K extends string>({ items, on, set }: { items: SubItem<K>[]; on: K; set: (k: K) => void }) {
  const shown = items.filter(i => !i.hide);
  return (
    <div className="gr-subtabs" role="tablist" style={{ gridTemplateColumns: `repeat(${shown.length}, 1fr)` }}>
      {shown.map(i => (
        <button key={i.k} data-k={i.k} role="tab" aria-selected={on === i.k} className={on === i.k ? 'on' : ''} onClick={() => set(i.k)}>
          {i.label}{i.dot && <i className="gr-subdot" />}
        </button>
      ))}
    </div>
  );
}
