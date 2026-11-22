import { useState } from 'react';
import { Card, Img, Portrait, Verdict } from './ui.jsx';
import { MODIFIERS, fmt, rankOffers } from '../lib/engine.js';
import { MASTER_IMG, MODIFIER_IMG } from '../lib/icons.js';
import { go } from '../store.js';

const EMPTY = { task: '', mod: null, value: '' };

/** Mortimer offers 2-3 tasks, each with a modifier: enter them and get the one to take */
export default function MortimerPicker({ data, evaluation, goal }) {
  const [offers, setOffers] = useState([EMPTY, EMPTY]);
  const tasks = evaluation.rows.filter((r) => !r.locked).map((r) => r.task).sort();
  const set = (i, patch) => setOffers((o) => o.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const filled = offers.filter((o) => o.task).map((o) => ({ ...o, value: o.value === '' ? undefined : +o.value }));
  const ranked = filled.length >= 2 ? rankOffers(evaluation, filled, goal) : [];
  const best = ranked[0];

  return (
    <Card title="Pick Mortimer's task" icon={MASTER_IMG.Mortimer} className="picker">
      <div className="offers">
        {offers.map((o, i) => (
          <div key={i} className={`offer ${best && best.task === o.task ? 'best' : ''}`}>
            <div className="offer-task">
              <Portrait img={o.task && data.imageFor(o.task)} size={36} />
              <select value={o.task} onChange={(e) => set(i, { task: e.target.value })} aria-label={`Offered task ${i + 1}`}>
                <option value="">Task {i + 1}...</option>
                {tasks.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="mods" role="group" aria-label="Modifier">
              {MODIFIERS.map((m) => (
                <button key={m.id} className={o.mod === m.id ? 'on' : ''} title={m.label} onClick={() => set(i, { mod: o.mod === m.id ? null : m.id, value: '' })}>
                  <Img img={MODIFIER_IMG[m.id]} alt="" /><span>{m.label}</span>
                </button>
              ))}
            </div>
            {(o.mod === 'xp' || o.mod === 'points') && (
              <label className="mod-value small">
                {o.mod === 'xp' ? 'XP bonus %' : 'Points'}
                <input type="number" min="0" max="500" step="5" value={o.value} placeholder="avg" onChange={(e) => set(i, { value: e.target.value })} />
              </label>
            )}
          </div>
        ))}
      </div>
      <div className="row-btns">
        {offers.length < 3 && <button className="mini" onClick={() => setOffers([...offers, EMPTY])}>Add a third task</button>}
        {offers.length > 2 && <button className="mini" onClick={() => setOffers(offers.slice(0, 2))}>Remove third</button>}
        {filled.length > 0 && <button className="mini" onClick={() => setOffers([EMPTY, EMPTY])}>Clear</button>}
      </div>

      {best && (
        <ol className="ranking">
          {ranked.map((o, i) => (
            <li key={o.task + i} className={i === 0 ? 'top' : ''}>
              <Portrait img={data.imageFor(o.task)} size={32} />
              <button className="link-btn" onClick={() => go('task', o.task)}>{o.task}</button>
              {o.mod && <span className="tag"><Img img={MODIFIER_IMG[o.mod]} alt="" />{MODIFIERS.find((m) => m.id === o.mod).label}{o.value ? ` ${o.mod === 'xp' ? '+' : ''}${o.value}${o.mod === 'xp' ? '%' : ''}` : ''}</span>}
              <span className="spacer" />
              {o.row?.chosen && <span className="small muted">{fmt.k(goal === 'gp' ? o.row.chosen.rates.gph : o.row.chosen.rates.xph)} {goal === 'gp' ? 'gp/h' : 'xp/h'}</span>}
              {i === 0 ? <Verdict action="Take" /> : o.row && <Verdict action={o.row.action} />}
            </li>
          ))}
        </ol>
      )}
      {best && <p className="small muted">{explain(best, ranked[1])}</p>}
    </Card>
  );
}

function explain(best, next) {
  if (best.score == null) return 'No rate data for these tasks, so pick by modifier.';
  if (next?.score == null) return `${best.task} is the only one with rate data.`;
  const diff = Math.round(((best.score - next.score) / Math.abs(next.score || 1)) * 100);
  if (diff <= 5 && best.mod) return `Rates are within 5%, so the ${MODIFIERS.find((m) => m.id === best.mod).label.toLowerCase()} modifier decides it.`;
  return `${diff}% better than ${next.task} for your goal${best.mod === 'xp' ? ', counting the XP bonus' : ''}.`;
}
