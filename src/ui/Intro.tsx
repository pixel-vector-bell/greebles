import { useEffect } from 'react';
import type { World } from '../sim/world';

type Tab = 'wilds' | 'camp' | 'bag' | 'fight' | 'shop' | 'ship' | 'guide';
interface Step {
  title: string; text: string;
  /** Tab this step happens on (we switch there). */
  tab?: Tab;
  /** Done when this is true (the player did the thing); otherwise shows a "Next" button. */
  done?: (w: World) => boolean;
  /** CSS selector of the thing to point at. */
  point?: string;
  next?: string;
  /** Put the coach card at the top so it doesn't cover what it points at. */
  top?: boolean;
}

const STEPS: Step[] = [
  { title: 'Welcome, explorer!', text: 'Your ship crashed on a strange planet. The little natives here are called Greebles. They\'re friendly, and they\'ll help you survive, find scrap and fight off the robots. Let\'s catch your first one!', next: "Let's go" },
  { title: 'Catch a Greeble', tab: 'wilds', point: '.gr-spawn', text: 'Greebles wander into the Wilds. Tap one to go after it. When the ring around it is small, tap Throw. The smaller the ring, the better your throw!',
    done: w => w.s.stats.caught >= 1 },
  { title: 'Gotcha!', tab: 'camp', top: true, point: '.gr-sendbag .gr-btn.g', text: 'Nice catch! Now put it to work. Greebles in camp earn scrap and bring back materials, even while the game is closed. Tap "Camp" next to your Greeble.',
    done: w => w.s.camp.some(Boolean) },
  { title: 'Your camp is working', tab: 'camp', point: '.gr-subtabs [data-k=nest]', text: 'Every 15 seconds your campers earn scrap. Dig Greebles find Ore, Trawl Greebles pull in Kelp and Skirmish Greebles salvage Gears. Later, open the Nest (glowing up top) and put two of the same family in it to get eggs.', next: 'Got it' },
  { title: 'Daily tasks', tab: 'wilds', point: '.gr-daily', text: 'Every day you get 3 small tasks here. Finish them for scrap and snares, plus a bonus when you finish all 3.', next: 'Nice' },
  { title: "You're all set!", text: 'Catch more Greebles, evolve them in the Bag, fight robots on the Fight tab, and fix your ship to get home. Each tab shows a quick tip the first time you open it. Have fun!', next: 'Start exploring' },
];

export function Intro({ w, tab, setTab, save }: { w: World; tab: Tab; setTab: (t: Tab) => void; save: () => void }) {
  const i = Math.min(w.s.intro, STEPS.length - 1);
  const st = STEPS[i];
  const advance = () => { w.s.intro = i + 1 >= STEPS.length ? 99 : i + 1; const nx = STEPS[i + 1]; if (nx?.tab) setTab(nx.tab); save(); };
  const doneNow = !!(st.done && st.done(w));
  if (st.tab && tab !== st.tab) queueMicrotask(() => setTab(st.tab!));
  // make sure there's something to catch on step 2
  if (i === 1 && w.here.length === 0) queueMicrotask(() => { w.addSpawn(Date.now(), 'wild', 'ashpup'); w.drain(); save(); });
  // and something to catch it with
  if (i === 1 && w.count('snare') < 3) w.s.items.snare = 5;
  const modal = !st.done;
  // bring the thing we point at into view (it may be below the fold)
  useEffect(() => {
    if (!st.point) return;
    const t = setTimeout(() => document.querySelector(st.point!)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
    return () => clearTimeout(t);
  }, [i, tab]);
  const skip = () => { w.s.intro = 99; save(); };
  // auto-advance when the player has done the thing
  if (doneNow) { queueMicrotask(advance); return null; }
  return (
    <>
      {st.point && <style>{`${st.point} { outline: 3px solid #ffd23c !important; outline-offset: 4px; border-radius: 12px; animation: gr-intro-pulse 1.2s ease-in-out infinite; }`}</style>}
      <div className={`gr-intro ${modal ? 'modal' : 'coach'} ${st.top ? 'top' : ''}`}>
        <div className="gr-intro-card">
          <div className="gr-intro-step">{i + 1} / {STEPS.length}</div>
          <h2>{st.title}</h2>
          <p>{st.text}</p>
          <div className="gr-intro-btns">
            {i < STEPS.length - 1 && <button className="gr-intro-skip" onClick={skip}>Skip intro</button>}
            {st.next && <button className="gr-btn-big" onClick={advance}>{st.next}</button>}
          </div>
        </div>
      </div>
    </>
  );
}
