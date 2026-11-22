import { useMemo, useRef, useState } from 'react';
import { go } from '../store.js';
import { norm } from '../lib/engine.js';

/** Build autocomplete entries: tasks, bosses, monster variants (sheet + wiki) mapped to their task */
export function buildIndex(data) {
  const entries = [];
  const seen = new Set();
  const add = (label, sub, route, weight) => {
    const k = `${norm(label)}|${route.join('/')}`;
    if (seen.has(k)) return;
    seen.add(k);
    entries.push({ label, sub, route, weight, n: label.toLowerCase() });
  };
  for (const t of data.allTasks) {
    if (t.boss) add(t.name, 'Boss task', ['boss', t.name], 3);
    else add(t.name, `Slayer task · ${t.masters.length} masters`, ['task', t.name], 4);
  }
  for (const name of Object.keys(data.wiki?.bosses || {})) add(name, 'Boss', ['boss', name], 3);
  for (const m of data.sheet.mobs) {
    if (m.task === 'Like a Boss') continue;
    const base = m.variant.replace(/\s*\(.*\)/, '');
    if (norm(base) !== norm(m.task)) add(base, `→ ${m.task} task`, ['task', m.task], 2);
  }
  for (const [task, w] of Object.entries(data.wiki?.tasks || {})) {
    for (const v of w.variants || []) if (norm(v.monster) !== norm(task)) add(v.monster, `→ ${task} task`, ['task', task], 1);
  }
  return entries;
}

export default function Search({ data, autoFocus, compact }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const index = useMemo(() => buildIndex(data), [data]);
  const inputRef = useRef();

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const words = s.split(/\s+/);
    return index
      .map((e) => {
        if (!words.every((w) => e.n.includes(w))) return null;
        const score = (e.n.startsWith(s) ? 100 : 0) + (e.n.split(/\s+/).some((w) => w.startsWith(words[0])) ? 30 : 0) + e.weight * 5 - e.n.length * 0.1;
        return { ...e, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [q, index]);

  const choose = (r) => {
    setQ(''); setOpen(false); inputRef.current?.blur();
    if (r) go(...r.route);
    else if (q.trim()) go('lookup', q.trim());
  };

  return (
    <div className={`search ${compact ? 'compact' : ''}`}>
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        type="search"
        placeholder="Search a monster or task… (e.g. abyssal, gargoyle, hydra)"
        value={q}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
          if (e.key === 'Escape') setOpen(false);
        }}
        aria-autocomplete="list"
      />
      {open && q.trim() && (
        <ul className="ac" role="listbox">
          {results.map((r, i) => (
            <li key={r.label + r.route.join()} role="option" aria-selected={i === active}
              className={i === active ? 'active' : ''} onMouseDown={() => choose(r)} onMouseEnter={() => setActive(i)}>
              <span className="ac-label">{highlight(r.label, q)}</span>
              <span className="ac-sub">{r.sub}</span>
            </li>
          ))}
          <li className={`ac-wiki ${active === results.length ? 'active' : ''}`} onMouseDown={() => choose(null)}>
            🔎 Look up “{q.trim()}” live on the OSRS Wiki
          </li>
        </ul>
      )}
    </div>
  );
}

function highlight(label, q) {
  const i = label.toLowerCase().indexOf(q.trim().toLowerCase());
  if (i < 0) return label;
  return <>{label.slice(0, i)}<mark>{label.slice(i, i + q.trim().length)}</mark>{label.slice(i + q.trim().length)}</>;
}
