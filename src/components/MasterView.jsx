import { Card, Stat, Verdict } from './ui.jsx';
import { fmt } from '../lib/engine.js';
import { go, setSettings } from '../store.js';

export default function MasterView({ data, settings, evaluation }) {
  const { rows, summary, bosses } = evaluation;
  const label = data.master(settings.master)?.label;
  return (
    <div className="view">
      <h1>Slayer masters</h1>
      <div className="chips scroll">
        {data.sheet.masters.map((m) => (
          <button key={m.id} className={`chip ${m.id === settings.master ? 'on' : ''}`} onClick={() => setSettings({ master: m.id })}>{m.label}</button>
        ))}
      </div>

      {summary && (
        <Card title={`${label}: your setup`}>
          <div className="stats">
            <Stat label="Expected XP/h" value={fmt.k(summary.xph)} sub="incl. skips & travel" />
            <Stat label="Expected GP/h" value={fmt.k(summary.gph)} />
            <Stat label="Skip rate" value={fmt.pct(summary.skipRate)} />
            <Stat label="Net points/task" value={summary.pointsPerTask ? summary.netPoints.toFixed(1) : '–'} sub={`${summary.pointsPerTask} earned avg`} />
          </div>
          <p className="small"><b>Block list ({summary.blocks.length}/{summary.blockSlots}):</b> {summary.blocks.map((r) => r.task).join(', ') || 'none'}</p>
          <p className="small"><b>Skip:</b> {summary.skips.map((r) => r.task).join(', ') || 'none'}</p>
          <p className="small muted">Goal: {settings.goal === 'xp' ? 'Slayer XP' : settings.goal === 'gp' ? 'Profit' : 'Balanced'} · change in Settings</p>
        </Card>
      )}

      <Card title="All tasks" className="flush">
        <table className="tasks">
          <thead><tr><th>Task</th><th>%</th><th>Call</th><th>{settings.goal === 'gp' ? 'GP/h' : 'XP/h'}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.task} onClick={() => go('task', r.task)} className={r.manual ? 'manual' : ''}>
                <td>
                  {r.task}
                  <div className="small muted">{r.chosen ? r.chosen.mob.variant : r.reason}</div>
                </td>
                <td>{(r.chance * 100).toFixed(1)}</td>
                <td><Verdict action={r.action} />{r.sheetActionNorm && r.sheetActionNorm !== r.action && r.action !== 'Locked' && <div className="small muted">sheet: {r.sheetActionNorm}</div>}</td>
                <td>{r.chosen ? fmt.k(settings.goal === 'gp' ? r.chosen.rates.gph : r.chosen.rates.xph) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {bosses?.length > 0 && (
        <Card title="Boss task options">
          <div className="chips">{bosses.map((b) => <button key={b.task} className="chip" onClick={() => go('boss', b.task)}>{b.task} <Verdict action={b.sheetAction} /></button>)}</div>
        </Card>
      )}
    </div>
  );
}
