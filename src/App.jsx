import { useEffect, useMemo, useState } from 'react';
import { indexData, evaluateMaster, fmt } from './lib/engine.js';
import { ICON, MASTER_IMG } from './lib/icons.js';
import { loadData, recentLookups, useRoute, useSettings, go } from './store.js';
import Search from './components/Search.jsx';
import TaskView, { BossView } from './components/TaskView.jsx';
import MasterView from './components/MasterView.jsx';
import MortimerPicker from './components/MortimerPicker.jsx';
import Settings from './components/Settings.jsx';
import { Card, Img, Portrait } from './components/ui.jsx';

export default function App() {
  const [raw, setRaw] = useState(null);
  const [err, setErr] = useState(null);
  const settings = useSettings();
  const route = useRoute();

  useEffect(() => { loadData().then(setRaw).catch((e) => setErr(e.message)); }, []);
  const data = useMemo(() => (raw ? indexData(raw[0], raw[1]) : null), [raw]);
  const evaluation = useMemo(() => (data ? evaluateMaster(data, settings.master, settings) : null), [data, settings]);

  if (err) return <div className="boot">Couldn't load data: {err}</div>;
  if (!data) return <div className="boot"><div className="spinner" />Loading slayer data...</div>;

  const [view, arg] = route;
  let body;
  if (view === 'task' && arg) body = <TaskView key={arg} data={data} name={arg} settings={settings} evaluation={evaluation} />;
  else if (view === 'lookup' && arg) body = <TaskView key={'l' + arg} data={data} name={arg} settings={settings} evaluation={evaluation} lookupOnly={!data.wikiFor(arg)} />;
  else if (view === 'boss' && arg) body = <BossView key={arg} data={data} name={arg} settings={settings} />;
  else if (view === 'masters') body = <MasterView data={data} settings={settings} evaluation={evaluation} />;
  else if (view === 'settings') body = <Settings data={data} settings={settings} />;
  else body = <Home data={data} settings={settings} evaluation={evaluation} />;

  const tab = ['masters', 'settings'].includes(view) ? view : 'search';
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/"><Img img={ICON.slayer} alt="" /><span>Slayer Helper</span></a>
        {view ? <Search data={data} compact /> : null}
      </header>
      <main>{body}</main>
      <nav className="bottombar">
        <a href="#/" className={tab === 'search' ? 'on' : ''}><Img img={ICON.slayer} alt="" /><span>Task</span></a>
        <a href="#/masters" className={tab === 'masters' ? 'on' : ''}><Img img={MASTER_IMG[settings.master]} alt="" /><span>Masters</span></a>
        <a href="#/settings" className={tab === 'settings' ? 'on' : ''}><Img img={ICON.settings} alt="" /><span>Settings</span></a>
      </nav>
    </div>
  );
}

const TaskTiles = ({ data, rows, sub }) => (
  <div className="tiles">
    {rows.map((r) => (
      <button key={r.task} className="tile" onClick={() => go('task', r.task)}>
        <Portrait img={data.imageFor(r.task)} size={48} />
        <span>{r.task}</span>
        {sub && <small>{sub(r)}</small>}
      </button>
    ))}
  </div>
);

function Home({ data, settings, evaluation }) {
  const { summary } = evaluation;
  const master = data.master(settings.master);
  const top = evaluation.rows.filter((r) => r.action === 'Do' && r.chosen).sort((a, b) => b.value - a.value).slice(0, 6);
  const recent = recentLookups();
  const rate = (r) => `${fmt.k(settings.goal === 'gp' ? r.chosen.rates.gph : r.chosen.rates.xph)}/h`;
  return (
    <div className="view home">
      <div className="hero">
        <h1>What's your task?</h1>
        <Search data={data} autoFocus />
      </div>

      <a className="panel master-strip" href="#/masters">
        <Img img={MASTER_IMG[settings.master]} alt="" />
        <span>
          <strong>{master?.label}</strong>
          <span className="small muted">{{ xp: 'Slayer XP', gp: 'Profit', balanced: 'Balanced' }[settings.goal]} · Slayer {settings.slayerLevel}</span>
        </span>
        <span className="spacer" />
        <span className="strip-rate"><Img img={ICON.slayer} alt="" />{fmt.k(summary.xph)}/h</span>
        <span className="strip-rate"><Img img={ICON.coins} alt="" />{fmt.k(summary.gph)}/h</span>
      </a>

      {settings.master === 'Mortimer' && <MortimerPicker data={data} evaluation={evaluation} goal={settings.goal} />}

      {summary.blocks.length > 0 && <Card title={`Block (${summary.blocks.length}/${summary.blockSlots})`}><TaskTiles data={data} rows={summary.blocks} /></Card>}
      {summary.skips.length > 0 && <Card title="Skip"><TaskTiles data={data} rows={summary.skips} /></Card>}
      <Card title="Best tasks"><TaskTiles data={data} rows={top} sub={rate} /></Card>
      {recent.length > 0 && (
        <Card title="Looked up live">
          <div className="chips">{recent.map((n) => <button key={n} className="chip" onClick={() => go('lookup', n)}>{n}</button>)}</div>
        </Card>
      )}
    </div>
  );
}
