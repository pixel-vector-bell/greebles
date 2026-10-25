import md from '../../CHANGELOG.md?raw';

interface Entry { title: string; items: string[] }
function parse(src: string): Entry[] {
  const out: Entry[] = [];
  for (const line of src.split('\n')) {
    if (line.startsWith('## ')) out.push({ title: line.slice(3).trim(), items: [] });
    else if (/^- /.test(line) && out.length) out[out.length - 1].items.push(line.slice(2));
  }
  return out;
}

export function WhatsNew({ onClose }: { onClose: () => void }) {
  return (
    <div className="gr-sheet-back" onClick={onClose}>
      <div className="gr-sheet tall" onClick={e => e.stopPropagation()}>
        <div className="gr-sheet-h"><b>What's new</b><button onClick={onClose}>✕</button></div>
        <div className="gr-news">
          {parse(md).map(e => (<section key={e.title}><h3>{e.title}</h3><ul>{e.items.map((i, k) => <li key={k}>{i}</li>)}</ul></section>))}
        </div>
      </div>
    </div>
  );
}
