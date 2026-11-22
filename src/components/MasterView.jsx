import { Card, Img, Portrait, Stat, Verdict } from './ui.jsx';
import MortimerPicker from './MortimerPicker.jsx';
import { fmt } from '../lib/engine.js';
import { ICON, MASTER_IMG } from '../lib/icons.js';
import { go, setSettings } from '../store.js';

export function MasterPicker({ data, current }) {
  return (
    <div className="master-grid">
      {data.masters.map((m) => (
        <button key={m.id} className={`master-btn ${m.id === current ? 'on' : ''}`} onClick={() => setSettings({ master: m.id })}>
          <Img img={MASTER_IMG[m.id]} alt="" />
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function MasterView({ data, settings, evaluation }) {
  const { rows, summary, bosses } = evaluation;
  const rate = (r) => (settings.goal === 'gp' ? r.chosen.rates.gph : r.chosen.rates.xph);
  return (
    <div className="view">
      <MasterPicker data={data} current={settings.master} />

      {summary && (
        <section className="panel">
          <div className="stats">
            <Stat icon={ICON.slayer} label="XP/h" value={fmt.k(summary.xph)} sub="with skips and travel" />
            <Stat icon={ICON.coins} label="GP/h" value={fmt.k(summary.gph)} />
            <Stat icon={ICON.gem} label="Points/task" value={summary.pointsPerTask ? summary.netPoints.toFixed(1) : '-'} sub={`skip ${summary.skipCost} · ${summary.blockSlots} blocks`} />
          </div>
        </section>
      )}

      {settings.master === 'Mortimer' && <MortimerPicker data={data} evaluation={evaluation} goal={settings.goal} />}

      <Card title="Tasks" className="flush" right={<span className="small muted">{settings.goal === 'gp' ? 'GP/h' : 'XP/h'}</span>}>
        <ul className="task-list">
          {rows.map((r) => (
            <li key={r.task} className={r.manual ? 'manual' : ''}><a href={`#/task/${encodeURIComponent(r.task)}`}>
              <Portrait img={data.imageFor(r.task)} size={36} />
              <span className="task-name">
                {r.task}
                <span className="small muted">{(r.chance * 100).toFixed(1)}%{r.chosen ? ` · ${r.chosen.mob.variant}` : r.action === 'Locked' ? ` · ${r.reason}` : ''}</span>
              </span>
              <span className="task-rate">{r.chosen ? fmt.k(rate(r)) : '-'}</span>
              <Verdict action={r.action} />
            </a></li>
          ))}
        </ul>
      </Card>

      {bosses?.length > 0 && (
        <Card title="Boss tasks">
          <div className="tiles">
            {bosses.map((b) => (
              <button key={b.task} className="tile" onClick={() => go('boss', b.task)}>
                <Portrait img={data.imageFor(b.task)} size={48} />
                <span>{b.task}</span>
                {b.sheetAction && <Verdict action={b.sheetAction} />}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
