import { useEffect, useMemo, useState } from 'react';
import { indexData, evaluateMaster, fmt } from './lib/engine.js';
import { loadData, useRoute, useSettings, go } from './store.js';
import Search from './components/Search.jsx';
import TaskView, { BossView } from './components/TaskView.jsx';
import MasterView from './components/MasterView.jsx';
import Settings from './components/Settings.jsx';
import { Card, Verdict } from './components/ui.jsx';

export default function App() {
  const [raw, setRaw] = useState(null);
  const [err, setErr] = useState(null);
  const settings = useSettings();
  const route = useRoute();

  useEffect(() => { loadData().then(setRaw).catch((e) => setErr(e.message)); }, []);
  const data = useMemo(() => (raw ? indexData(raw[0], raw[1]) : null), [raw]);
  const evaluation = useMemo(() => (data ? evaluateMaster(data, settings.master, settings) : null), [data, settings]);

  if (err) return <div className="boot">Couldn’t load data: {err}</div>;
  if (!data) return <div className="boot"><div className="spinner" />Loading slayer data…</div>;

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
        <a className="brand" href="#/">⚔ <span>Slayer Helper</span></a>
        {tab !== 'search' || view ? <Search data={data} compact /> : null}
      </header>
      <main>{body}</main>
      <nav className="bottombar">
        <a href="#/" className={tab === 'search' ? 'on' : ''}>🔎<span>Search</span></a>
        <a href="#/masters" className={tab === 'masters' ? 'on' : ''}>📋<span>Masters</span></a>
        <a href="#/settings" className={tab === 'settings' ? 'on' : ''}>⚙<span>Settings</span></a>
      </nav>
    </div>
  );
}

function Home({ data, settings, evaluation }) {
  const top = evaluation.rows.filter((r) => r.action === 'Do' && r.chosen).sort((a, b) => b.value - a.value).slice(0, 5);
  const recent = (() => { try { return Object.keys(localStorage).filter((k) => k.startsWith('slayer-helper:live:')).map((k) => k.split(':').pop()).slice(-5); } catch { return []; } })();
  return (
    <div className="view home">
      <div className="hero">
        <h1>What’s your task?</h1>
        <p className="muted">Type a monster. You get whether to do, skip or block it, the best method and spot, how to get there, and gear tiers for your budget.</p>
        <Search data={data} autoFocus />
        <p className="small muted">Master: <b>{data.master(settings.master)?.label}</b> · Goal: <b>{settings.goal}</b> · Slayer {settings.slayerLevel} · <a href="#/settings">change</a></p>
      </div>
      <Card title={`Block list for ${data.master(settings.master)?.label}`} right={<a href="#/masters" className="small">all tasks →</a>}>
        <div className="chips">{evaluation.summary.blocks.map((r) => <button key={r.task} className="chip" onClick={() => go('task', r.task)}><Verdict action="Block" /> {r.task}</button>)}</div>
        {evaluation.summary.skips.length > 0 && <div className="chips">{evaluation.summary.skips.map((r) => <button key={r.task} className="chip" onClick={() => go('task', r.task)}><Verdict action="Skip" /> {r.task}</button>)}</div>}
      </Card>
      <Card title="Best tasks to get">
        <ul className="plain">{top.map((r) => <li key={r.task}><a href={`#/task/${encodeURIComponent(r.task)}`}>{r.task}</a> <span className="muted small">— {r.chosen.mob.variant} · {fmt.k(r.chosen.rates.xph)} xp/h · {fmt.k(r.chosen.rates.gph)} gp/h</span></li>)}</ul>
      </Card>
      {recent.length > 0 && <Card title="Recently looked up live"><div className="chips">{recent.map((n) => <button key={n} className="chip" onClick={() => go('lookup', n)}>{n}</button>)}</div></Card>}
    </div>
  );
}
