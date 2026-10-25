/**
 * Tiny synth sound effects (Web Audio, no files to download).
 * Sound is on by default; the choice is kept in localStorage. iPhones need a tap before audio plays,
 * so the context is created/resumed on the first user gesture.
 */
type Note = { f: number; t: number; d: number; type?: OscillatorType; v?: number; slide?: number };

const KEY = 'greebles.sound';
let ctx: AudioContext | null = null;
let on = (() => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } })();

export const soundOn = () => on;
export function setSound(v: boolean) { on = v; try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* ignore */ } if (v) unlock(); }

export function unlock() {
  try {
    if (!ctx) { const A = (window as any).AudioContext || (window as any).webkitAudioContext; if (!A) return; ctx = new A(); }
    if (ctx!.state === 'suspended') void ctx!.resume();
  } catch { /* no audio */ }
}

function play(notes: Note[]) {
  if (!on) return;
  unlock();
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + 0.01;
  const master = ctx.createGain(); master.gain.value = 0.18; master.connect(ctx.destination);
  for (const n of notes) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = n.type ?? 'triangle';
    o.frequency.setValueAtTime(n.f, t0 + n.t);
    if (n.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, n.f * n.slide), t0 + n.t + n.d);
    g.gain.setValueAtTime(0.0001, t0 + n.t);
    g.gain.exponentialRampToValueAtTime(n.v ?? 0.8, t0 + n.t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.t + n.d);
    o.connect(g); g.connect(master);
    o.start(t0 + n.t); o.stop(t0 + n.t + n.d + 0.05);
  }
}
const arp = (fs: number[], step: number, d: number, type: OscillatorType = 'triangle', v = 0.8): Note[] => fs.map((f, i) => ({ f, t: i * step, d, type, v }));

export const sfx = {
  tap: () => play([{ f: 660, t: 0, d: 0.05, type: 'square', v: 0.25 }]),
  throw: () => play([{ f: 300, t: 0, d: 0.28, type: 'sine', slide: 3 }]),
  wobble: () => play([{ f: 220, t: 0, d: 0.08, type: 'square', v: 0.3 }, { f: 220, t: 0.35, d: 0.08, type: 'square', v: 0.3 }, { f: 220, t: 0.7, d: 0.08, type: 'square', v: 0.3 }]),
  perfect: () => play(arp([1046, 1318], 0.06, 0.12, 'sine', 0.5)),
  caught: () => play(arp([523, 659, 784, 1046], 0.08, 0.22)),
  caughtRare: () => play([...arp([523, 659, 784, 1046, 1318, 1568], 0.07, 0.3), { f: 2093, t: 0.45, d: 0.6, type: 'sine', v: 0.4 }]),
  prism: () => play([...arp([784, 988, 1175, 1568, 1976, 2349], 0.05, 0.35, 'sine', 0.55), ...arp([1568, 2349], 0.12, 0.5, 'triangle', 0.3).map(n => ({ ...n, t: n.t + 0.35 }))]),
  broke: () => play([{ f: 330, t: 0, d: 0.2, type: 'sawtooth', slide: 0.5, v: 0.4 }]),
  fled: () => play([{ f: 520, t: 0, d: 0.35, type: 'triangle', slide: 0.3, v: 0.5 }]),
  hit: () => play([{ f: 140, t: 0, d: 0.1, type: 'square', slide: 0.5, v: 0.4 }]),
  move: () => play([{ f: 200, t: 0, d: 0.25, type: 'sawtooth', slide: 4, v: 0.45 }, { f: 90, t: 0.15, d: 0.25, type: 'square', slide: 0.5, v: 0.4 }]),
  win: () => play(arp([392, 523, 659, 784], 0.09, 0.2, 'square', 0.35)),
  lose: () => play(arp([392, 330, 262, 196], 0.12, 0.25, 'triangle', 0.5)),
  boss: () => play([...arp([262, 330, 392, 523, 392, 523, 659, 784, 1046], 0.1, 0.25, 'square', 0.35), { f: 1046, t: 0.95, d: 0.9, type: 'triangle', v: 0.5 }]),
  evolve: () => play([{ f: 200, t: 0, d: 1.0, type: 'sine', slide: 5, v: 0.5 }, ...arp([784, 988, 1175, 1568], 0.09, 0.4).map(n => ({ ...n, t: n.t + 0.9 }))]),
  coin: () => play(arp([988, 1318], 0.06, 0.12, 'square', 0.25)),
  spawn: () => play(arp([880, 1175], 0.07, 0.1, 'sine', 0.3)),
  mythic: () => play([{ f: 110, t: 0, d: 1.6, type: 'sawtooth', v: 0.25, slide: 2 }, ...arp([523, 622, 784, 932, 1046, 1244], 0.12, 0.5, 'sine', 0.5).map(n => ({ ...n, t: n.t + 0.3 }))]),
};
