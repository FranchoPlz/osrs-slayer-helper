import { Card } from './ui.jsx';
import { DEFAULT_SETTINGS, setSettings } from '../store.js';

const STATS = ['attack', 'strength', 'defence', 'ranged', 'magic', 'prayer', 'hitpoints'];

export default function Settings({ data, settings }) {
  const set = (k) => (e) => setSettings({ [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? clamp(+e.target.value) : e.target.value });
  const setStat = (k) => (e) => setSettings((s) => ({ stats: { ...s.stats, [k]: clamp(+e.target.value) } }));
  const overrides = Object.keys(settings.overrides).length;

  return (
    <div className="view">
      <h1>Settings</h1>
      <p className="muted small">These filter every recommendation: which methods you can use, which gear tier is highlighted, and which tasks to block or skip. Saved on this device only.</p>

      <Card title="Goal">
        <div className="seg">
          {[['xp', 'Slayer XP'], ['gp', 'Profit'], ['balanced', 'Balanced']].map(([v, l]) => (
            <button key={v} className={settings.goal === v ? 'on' : ''} onClick={() => setSettings({ goal: v })}>{l}</button>
          ))}
        </div>
        <label className="field">Slayer master
          <select value={settings.master} onChange={set('master')}>{data.sheet.masters.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
        </label>
        <label className="field">Block slots
          <input type="number" min="0" max="7" value={settings.blockSlots} onChange={(e) => setSettings({ blockSlots: Math.max(0, Math.min(7, +e.target.value)) })} />
        </label>
      </Card>

      <Card title="Your levels">
        <label className="field">Slayer<input type="number" min="1" max="99" value={settings.slayerLevel} onChange={set('slayerLevel')} /></label>
        <div className="grid-stats">
          {STATS.map((k) => (
            <label key={k} className="field small-field">{k[0].toUpperCase() + k.slice(1)}
              <input type="number" min="1" max="99" value={settings.stats[k]} onChange={setStat(k)} />
            </label>
          ))}
        </div>
        <p className="small muted">Tasks needing a higher Slayer level show as Locked. Magic decides burst (62+) and barrage (86+) methods.</p>
      </Card>

      <Card title="Unlocks & preferences">
        <Toggle label="Ancient Magicks (burst / barrage)" checked={settings.ancients} onChange={set('ancients')} />
        <Toggle label="Dwarf multicannon" checked={settings.cannon} onChange={set('cannon')} />
        <Toggle label="OK with the Wilderness" checked={settings.allowWildy} onChange={set('allowWildy')} />
        <Toggle label="Kill boss variants on task (Sire, Kree, Vorkath…)" checked={settings.bosses} onChange={set('bosses')} />
        <Toggle label="I have a slayer helmet" checked={settings.slayerHelm} onChange={set('slayerHelm')} />
      </Card>

      <Card title="Gear budget">
        <div className="seg">
          {[['low', '< 20M'], ['mid', '20–200M'], ['high', '200M–1B'], ['max', 'Maxed']].map(([v, l]) => (
            <button key={v} className={settings.budget === v ? 'on' : ''} onClick={() => setSettings({ budget: v })}>{l}</button>
          ))}
        </div>
        <p className="small muted">Picks which tier to highlight in the Wiki's tiered gear tables.</p>
      </Card>

      <Card title="Data">
        <p className="small">Efficiency sheet: <b>{data.sheet.version}</b> (synced {new Date(data.sheet.fetchedAt).toLocaleDateString()})</p>
        <p className="small">Wiki snapshot: {new Date(data.wiki.fetchedAt).toLocaleDateString()} · {Object.keys(data.wiki.tasks).length} tasks, {Object.keys(data.wiki.bosses).length} bosses, {Object.keys(data.wiki.places).length} locations</p>
        <p className="small muted">Any monster can be refreshed live from the Wiki on its page. To refresh everything, run <code>npm run sync</code> and redeploy.</p>
        <div className="row-btns">
          <button disabled={!overrides} onClick={() => setSettings({ overrides: {} })}>Clear {overrides} task overrides</button>
          <button onClick={() => { if (confirm('Reset all settings?')) setSettings(DEFAULT_SETTINGS); }}>Reset settings</button>
        </div>
      </Card>
    </div>
  );
}

const clamp = (n) => (Number.isFinite(n) ? Math.max(1, Math.min(99, n)) : 1);
const Toggle = ({ label, checked, onChange }) => (
  <label className="toggle"><input type="checkbox" checked={!!checked} onChange={onChange} /><span className="track" /><span>{label}</span></label>
);
