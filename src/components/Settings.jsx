import { Card, Img } from './ui.jsx';
import { MasterPicker } from './MasterView.jsx';
import { rulesFor } from '../lib/engine.js';
import { ICON, SKILL_IMG } from '../lib/icons.js';
import { DEFAULT_SETTINGS, setSettings } from '../store.js';

const STATS = ['attack', 'strength', 'defence', 'ranged', 'magic', 'prayer', 'hitpoints'];

export default function Settings({ data, settings }) {
  const set = (k) => (e) => setSettings({ [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? clamp(+e.target.value) : e.target.value });
  const setStat = (k) => (e) => setSettings((s) => ({ stats: { ...s.stats, [k]: clamp(+e.target.value) } }));
  const overrides = Object.keys(settings.overrides).length;
  const maxBlocks = rulesFor(settings.master).maxBlocks;

  return (
    <div className="view">
      <Card title="Master">
        <MasterPicker data={data} current={settings.master} />
      </Card>

      <Card title="Goal">
        <div className="seg">
          {[['xp', 'Slayer XP'], ['gp', 'Profit'], ['balanced', 'Balanced']].map(([v, l]) => (
            <button key={v} className={settings.goal === v ? 'on' : ''} onClick={() => setSettings({ goal: v })}>{l}</button>
          ))}
        </div>
        <label className="field">Block slots
          <input type="number" min="0" max="7" value={settings.blockSlots} onChange={(e) => setSettings({ blockSlots: Math.max(0, Math.min(7, +e.target.value)) })} />
        </label>
        {Number.isFinite(maxBlocks) && settings.blockSlots > maxBlocks && <p className="small muted">{settings.master} only has {maxBlocks} block slots.</p>}
      </Card>

      <Card title="Levels">
        <div className="grid-stats">
          <label className="skill"><Img img={SKILL_IMG.slayer} alt="Slayer" /><input type="number" min="1" max="99" value={settings.slayerLevel} onChange={set('slayerLevel')} aria-label="Slayer" /></label>
          {STATS.map((k) => (
            <label key={k} className="skill"><Img img={SKILL_IMG[k]} alt={k} />
              <input type="number" min="1" max="99" value={settings.stats[k]} onChange={setStat(k)} aria-label={k} />
            </label>
          ))}
        </div>
      </Card>

      <Card title="Unlocks">
        <Toggle icon={ICON.ancients} label="Ancient Magicks" checked={settings.ancients} onChange={set('ancients')} />
        <Toggle icon={ICON.cannon} label="Dwarf multicannon" checked={settings.cannon} onChange={set('cannon')} />
        <Toggle icon={ICON.wildy} label="Wilderness is fine" checked={settings.allowWildy} onChange={set('allowWildy')} />
        <Toggle icon={ICON.boss} label="Boss variants on task" checked={settings.bosses} onChange={set('bosses')} />
        <Toggle icon={ICON.helm} label="Slayer helmet" checked={settings.slayerHelm} onChange={set('slayerHelm')} />
      </Card>

      <Card title="Gear budget">
        <div className="seg">
          {[['low', '< 20M'], ['mid', '20-200M'], ['high', '200M-1B'], ['max', 'Maxed']].map(([v, l]) => (
            <button key={v} className={settings.budget === v ? 'on' : ''} onClick={() => setSettings({ budget: v })}>{l}</button>
          ))}
        </div>
      </Card>

      <Card title="Data">
        <p className="small">Efficiency sheet {data.sheet.version}, synced {new Date(data.sheet.fetchedAt).toLocaleDateString()}</p>
        <p className="small">Wiki snapshot {new Date(data.wiki.fetchedAt).toLocaleDateString()}: {Object.keys(data.wiki.tasks).length} tasks, {Object.keys(data.wiki.bosses).length} bosses, {Object.keys(data.wiki.places).length} locations</p>
        <div className="row-btns">
          <button disabled={!overrides} onClick={() => setSettings({ overrides: {} })}>Clear {overrides} overrides</button>
          <button onClick={() => { if (confirm('Reset all settings?')) setSettings(DEFAULT_SETTINGS); }}>Reset settings</button>
        </div>
      </Card>
    </div>
  );
}

const clamp = (n) => (Number.isFinite(n) ? Math.max(1, Math.min(99, n)) : 1);
const Toggle = ({ icon, label, checked, onChange }) => (
  <label className="toggle"><input type="checkbox" checked={!!checked} onChange={onChange} /><span className="track" />{icon && <Img img={icon} alt="" className="icon" />}<span>{label}</span></label>
);
