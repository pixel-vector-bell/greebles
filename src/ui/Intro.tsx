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
  /** Make sure there's a Greeble to catch (and snares to catch it with). */
  seed?: boolean;
}

const STEPS: Step[] = [
  { title: 'Welcome, explorer!', text: 'You\'re stranded on a strange planet. The little natives here are called Greebles. They\'re friendly, and they\'ll help you explore, find scrap, and fight off the robots. Let\'s catch your first one!', next: "Let's go" },
  { title: 'Catch a Greeble', tab: 'wilds', point: '.gr-spawn', seed: true, text: 'Greebles wander into the Wilds. Tap one to go after it. When the ring around it is small, tap Throw. The smaller the ring, the better your throw!',
    done: w => w.s.stats.caught >= 1 },
  { title: 'Build your team', tab: 'fight', top: true, point: '.gr-teamadd .gr-btn.g', text: 'Nice catch! Your Team is who fights robots, and only the team gains xp. Tap "Add" to put your Greeble on the team.',
    done: w => w.teamList.length > 0 },
  { title: 'Auto-patrol', tab: 'fight', point: '.gr-auto', text: 'Auto-patrol is on: your team fights a robot every couple of minutes, even while the game is closed. Each fight spends a ration. Trawlers in camp make rations.', next: 'Got it' },
  { title: 'Catch one more', tab: 'wilds', point: '.gr-spawn', seed: true, text: 'Now catch a second Greeble. This one can work in camp.',
    done: w => w.s.stats.caught >= 2 },
  { title: 'Put it to work', tab: 'camp', top: true, point: '.gr-sendbag .gr-btn.g', text: 'Greebles in camp earn scrap and bring back materials, even while the game is closed. Trawlers make rations for the team. Diggers make beacon charges so you can call more Greebles. Tap "Camp".',
    done: w => w.s.camp.some(Boolean) },
  { title: 'Candy & evolving', tab: 'bag', text: 'Every Greeble you catch gives candy for its family. To evolve, a Greeble needs the right level AND enough candy. Levels stop at a cap (🔒) until you beat the next area boss.', next: 'Got it' },
  { title: 'Call more Greebles', tab: 'wilds', point: '.gr-beacon', text: 'When the Wilds are empty, turn on a Beacon. Diggers in camp make the charges. Greebles wander in fast for 30 minutes.', next: 'Nice' },
  { title: "You're all set!", text: 'Catch more Greebles, train your team, and beat the boss of each area. Each tab shows a quick tip the first time you open it.', next: 'Start exploring' },
];

export function Intro({ w, tab, setTab, save }: { w: World; tab: Tab; setTab: (t: Tab) => void; save: () => void }) {
  const i = Math.min(w.s.intro, STEPS.length - 1);
  const st = STEPS[i];
  const advance = () => { w.s.intro = i + 1 >= STEPS.length ? 99 : i + 1; const nx = STEPS[i + 1]; if (nx?.tab) setTab(nx.tab); save(); };
  const doneNow = !!(st.done && st.done(w));
  if (st.tab && tab !== st.tab) queueMicrotask(() => setTab(st.tab!));
  // make sure there's something to catch on the catch steps
  if (st.seed && w.here.length === 0) queueMicrotask(() => { w.addSpawn(Date.now(), 'wild', i === 1 ? 'scrappling' : 'ashpup'); w.drain(); save(); });
  // and something to catch it with
  if (st.seed && w.count('snare') < 3) w.s.items.snare = 5;
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
