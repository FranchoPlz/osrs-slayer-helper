import { useEffect, useState } from 'react';
import {
  BestLocation, Card, Collapsible, EquipmentSetups, GearPick, GearTiers, Img, Item, LocationList, Portrait, Prose, Stat, Verdict, sortLocations,
} from './ui.jsx';
import { fmt } from '../lib/engine.js';
import { prayerFor, requiredItems, weaponHints, ytSearch } from '../lib/advice.js';
import { ICON, MASTER_IMG, PRAYER_IMG } from '../lib/icons.js';
import { wikiUrl } from '../lib/wikiparse.js';
import { getLive, go, liveLookup, setOverride, setSettings } from '../store.js';

export default function TaskView({ data, name, settings, evaluation, lookupOnly }) {
  const snapshot = lookupOnly ? null : data.wikiFor(name);
  const [live, setLive] = useState(() => getLive(name));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const wiki = live || snapshot;

  const refresh = async () => {
    setLoading(true); setError(null);
    try { setLive(await liveLookup(name, snapshot?.monsterPage)); }
    catch (e) { setError(navigator.onLine ? e.message : 'You are offline. Showing saved data.'); }
    setLoading(false);
  };
  useEffect(() => { if (!wiki && !loading) refresh(); }, [name]); // auto live-lookup when nothing cached

  const row = evaluation?.rows.find((r) => r.key === data.key(name));
  const assigners = data.allTasks.find((t) => t.key === data.key(name))?.masters || [];
  const masterLabel = data.master(settings.master)?.label || settings.master;
  const monster = wiki?.monster;
  const chosen = row?.chosen;
  const items = requiredItems(wiki?.infobox?.otherReq, wiki?.intro, wiki?.strategy?.slice(0, 2500));
  const prayers = prayerFor(monster?.attackStyle);
  const locations = sortLocations(wiki?.locations, chosen?.mob.variant);
  const image = monster?.image || data.imageFor(name);

  return (
    <div className="view">
      <section className="task-hero panel">
        <Portrait img={image} size={112} alt={name} />
        <div className="task-hero-body">
          <h1>{name}</h1>
          {row ? (
            <>
              <div className="verdict-line">
                <Verdict action={row.action} big />
                <OverrideControl row={row} master={settings.master} />
              </div>
              <p className="reason">{row.reason}</p>
            </>
          ) : (
            <p className="reason muted">{masterLabel} doesn't assign this task.</p>
          )}
          <MasterSwitch data={data} settings={settings} assigners={assigners} />
        </div>
      </section>

      {loading && !wiki && <Card><p className="muted">Looking it up on the OSRS Wiki...</p></Card>}
      {error && <Card><p className="warn">{error}</p></Card>}

      {chosen && (
        <Card title="Best method" icon={ICON.combat}>
          <p className="method">{chosen.mob.variant}</p>
          <div className="stats">
            <Stat icon={ICON.slayer} label="XP/h" value={fmt.k(chosen.rates.xph)} />
            <Stat icon={ICON.coins} label="GP/h" value={fmt.k(chosen.rates.gph)} />
            <Stat icon={ICON.watch} label="Task" value={fmt.h(chosen.rates.hours)} sub={`${Math.round(row.length)} kills`} />
          </div>
          {(row.extend || row.bracelet) && (
            <div className="perks">
              {row.extend && <Item name="Extend this task" icon={ICON.extend} />}
              {row.bracelet && <Item name={row.bracelet === 'Slaughter' ? 'Bracelet of slaughter' : 'Expeditious bracelet'} icon={row.bracelet === 'Slaughter' ? ICON.slaughter : ICON.expeditious} />}
            </div>
          )}
        </Card>
      )}

      {wiki && (prayers.length > 0 || items.length > 0) && (
        <Card title="Bring" icon={ICON.inventory}>
          <div className="item-list">
            {prayers.map((p) => PRAYER_IMG[p]
              ? <Item key={p} name={p} icon={PRAYER_IMG[p]} />
              : <Item key={p} name={p} icon="Anti-dragon shield.png" />)}
            {items.map((i) => {
              const helm = i.coveredByHelm && settings.slayerHelm;
              return <Item key={i.name} name={helm ? `${i.name} (helm)` : i.name} icon={helm ? ICON.helm : i.icon} dim={helm} note={i.coveredByHelm ? 'Covered by a slayer helmet' : undefined} />;
            })}
          </div>
        </Card>
      )}

      {locations.length > 0 && (
        <Card title="Where">
          <BestLocation l={locations[0]} />
        </Card>
      )}

      {wiki?.gearTiers?.length > 0 && (
        <Card title="Gear" icon={ICON.equipment} right={<a className="small" href="#/settings">budget: {settings.budget}</a>}>
          <GearPick key={chosen?.mob.variant} sets={wiki.gearTiers} budget={settings.budget} variant={chosen?.mob.variant} />
        </Card>
      )}

      <Collapsible title="More" className="more">
        <More data={data} name={name} row={row} wiki={wiki} live={live} settings={settings} locations={locations} refresh={refresh} loading={loading} />
      </Collapsible>
    </div>
  );
}

function More({ data, name, row, wiki, live, settings, locations, refresh, loading }) {
  const monster = wiki?.monster;
  const hints = weaponHints(monster);
  const chosen = row?.chosen;
  return (
    <div className="more-body">
      {row?.variants?.length > 0 && (
        <section>
          <h3>All methods</h3>
          <table className="variants">
            <thead><tr><th>Method</th><th>XP/h</th><th>GP/h</th><th /></tr></thead>
            <tbody>
              {[...row.variants].sort((a, b) => (b.allRates?.xph || 0) - (a.allRates?.xph || 0)).map((v) => (
                <tr key={v.mob.variant} className={`${v === chosen ? 'chosen' : ''} ${v.blocker || !v.allRates ? 'dim' : ''}`}>
                  <td>{v.mob.variant}{v.blocker && <div className="small warn">{v.blocker}</div>}{v.mob.notes && v === chosen && <div className="small muted">{v.mob.notes}</div>}</td>
                  <td>{fmt.k(v.allRates?.xph)}</td>
                  <td>{fmt.k(v.allRates?.gph)}</td>
                  <td>
                    {v.rates && v !== chosen && <button className="mini" onClick={() => setOverride(settings.master, row.task, { variant: v.mob.variant })}>Use</button>}
                    {v === chosen && row.override.variant && <button className="mini" onClick={() => setOverride(settings.master, row.task, { variant: undefined })}>Auto</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted">
            Chance {fmt.pct(row.chance)} · {row.min ? `${row.min}-${row.max}` : Math.round(row.length)} kills{row.eMin ? ` (extended ${row.eMin}-${row.eMax})` : ''}
            {row.sheetActionNorm && ` · Sheet author: ${row.sheetActionNorm}`}
            {row.points && ` · Mortimer points ${row.points[0]}-${row.points[1]}, XP +${row.xpMod?.[0]}-${row.xpMod?.[1]}%`}
          </p>
        </section>
      )}

      {locations.length > 0 && (
        <section>
          <h3>Locations and transport</h3>
          <LocationList locations={locations} places={data.wiki?.places} />
        </section>
      )}

      {wiki && (monster || wiki.infobox) && (
        <section>
          <h3>Monster</h3>
          <div className="facts">
            {wiki.infobox?.slayerReq && <Fact k="Slayer" v={wiki.infobox.slayerReq} />}
            {wiki.infobox?.combatReq && <Fact k="Combat req" v={wiki.infobox.combatReq} />}
            {monster?.combat && <Fact k="Combat lvl" v={monster.combat} />}
            {monster?.hitpoints && <Fact k="Hitpoints" v={monster.hitpoints} />}
            {monster?.maxHit && <Fact k="Max hit" v={monster.maxHit} />}
            {monster?.attackStyle && <Fact k="Attacks with" v={monster.attackStyle} />}
            {monster?.aggressive && <Fact k="Aggressive" v={monster.aggressive} />}
            {monster?.attributes && <Fact k="Attributes" v={monster.attributes} />}
            {wiki.infobox?.otherReq && <Fact k="Other reqs" v={wiki.infobox.otherReq} />}
          </div>
          {hints.length > 0 && <ul className="plain small">{hints.map((h) => <li key={h}>{h}</li>)}</ul>}
        </section>
      )}

      {wiki?.gearTiers?.length > 0 && <section><h3>Every gear tier</h3><GearTiers sets={wiki.gearTiers} budget={settings.budget} /></section>}
      {wiki?.equipment?.length > 0 && <section><h3>Example setups</h3><EquipmentSetups setups={wiki.equipment} /></section>}
      {wiki?.inventory && <Collapsible title="Inventory"><Prose text={wiki.inventory} /></Collapsible>}
      {wiki?.intro && <Collapsible title="Strategy"><Prose text={[wiki.intro, wiki.strategy].filter(Boolean).join('\n\n')} /></Collapsible>}
      {wiki?.variants?.length > 0 && (
        <Collapsible title="Monster variants">
          <ul className="plain">{wiki.variants.map((v, i) => <li key={i}><b>{v.monster}</b>{v.combat && ` (lvl ${v.combat})`}: {v.locations.join(', ')}{v.notes && <div className="small muted">{v.notes}</div>}</li>)}</ul>
        </Collapsible>
      )}

      <section className="links">
        {wiki?.title && <a href={wikiUrl(wiki.title)} target="_blank" rel="noreferrer">Wiki task page</a>}
        {wiki?.strategiesTitle && <a href={wikiUrl(wiki.strategiesTitle)} target="_blank" rel="noreferrer">Wiki strategies</a>}
        {monster?.title && <a href={wikiUrl(monster.title)} target="_blank" rel="noreferrer">Monster page</a>}
        <a href={ytSearch(name)} target="_blank" rel="noreferrer">Videos</a>
        <a href={data.sheet.source} target="_blank" rel="noreferrer">Efficiency sheet</a>
      </section>
      <p className="small muted">
        {live ? `Live Wiki data from ${new Date(live.liveAt).toLocaleDateString()}` : wiki ? 'Offline Wiki snapshot' : 'Not in offline data'}
        {' · '}<button className="link-btn" onClick={refresh} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh from the Wiki'}</button>
      </p>
      {settings.master === 'TuraelSpria' && <p className="small muted">Turael/Spria tasks reset your streak when used to skip.</p>}
    </div>
  );
}

const Fact = ({ k, v }) => <div className="fact"><span>{k}</span><strong>{v}</strong></div>;

/** Compact Do/Skip/Block override behind a "change" toggle */
function OverrideControl({ row, master }) {
  const [open, setOpen] = useState(false);
  const current = row.override.action || 'Auto';
  return (
    <span className="override">
      {row.manual && <span className="tag">your call</span>}
      <button className="mini" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'done' : 'change'}</button>
      {open && (
        <span className="seg sm">
          {['Auto', 'Do', 'Skip', 'Block'].map((a) => (
            <button key={a} className={current === a ? 'on' : ''} onClick={() => setOverride(master, row.task, { action: a })}>{a}</button>
          ))}
          <label className="check"><input type="checkbox" checked={!!row.override.locked} onChange={(e) => setOverride(master, row.task, { locked: e.target.checked || undefined })} /> not unlocked</label>
        </span>
      )}
    </span>
  );
}

function MasterSwitch({ data, settings, assigners }) {
  return (
    <div className="master-switch">
      {data.masters.filter((m) => assigners.includes(m.id)).map((m) => (
        <button key={m.id} className={`head-btn ${m.id === settings.master ? 'on' : ''}`} title={m.label} onClick={() => setSettings({ master: m.id })}>
          <Img img={MASTER_IMG[m.id]} alt={m.label} />
        </button>
      ))}
      {!assigners.includes(settings.master) && <span className="small muted">Assigned by the masters above</span>}
    </div>
  );
}

export function BossView({ data, name, settings }) {
  const b = data.bossWiki(name);
  const mob = data.sheet.mobs.find((m) => m.variant.startsWith(name));
  const prayers = prayerFor(b?.monster?.attackStyle);
  return (
    <div className="view">
      <section className="task-hero panel">
        <Portrait img={b?.monster?.image} size={112} alt={name} />
        <div className="task-hero-body">
          <h1>{name}</h1>
          <p className="reason muted">Boss task option</p>
        </div>
      </section>
      {mob?.xph > 0 && (
        <Card title="Rates" icon={ICON.combat}>
          <div className="stats">
            <Stat icon={ICON.slayer} label="XP/h" value={fmt.k(mob.xph)} />
            <Stat icon={ICON.coins} label="GP/h" value={fmt.k(mob.gph)} />
            <Stat icon={ICON.combat} label="Kills/h" value={fmt.k(mob.kph)} />
          </div>
        </Card>
      )}
      {prayers.length > 0 && (
        <Card title="Bring" icon={ICON.inventory}>
          <div className="item-list">{prayers.map((p) => <Item key={p} name={p} icon={PRAYER_IMG[p] || 'Anti-dragon shield.png'} />)}</div>
        </Card>
      )}
      {b?.gearTiers?.length > 0 && <Card title="Gear" icon={ICON.equipment}><GearPick sets={b.gearTiers} budget={settings.budget} /></Card>}
      {b ? (
        <Collapsible title="More" className="more">
          <div className="more-body">
            <section>
              <h3>Monster</h3>
              <div className="facts">
                {b.monster?.combat && <Fact k="Combat lvl" v={b.monster.combat} />}
                {b.monster?.hitpoints && <Fact k="Hitpoints" v={b.monster.hitpoints} />}
                {b.monster?.maxHit && <Fact k="Max hit" v={b.monster.maxHit} />}
                {b.monster?.attackStyle && <Fact k="Attacks with" v={b.monster.attackStyle} />}
              </div>
              <ul className="plain small">{weaponHints(b.monster).map((h) => <li key={h}>{h}</li>)}</ul>
              {mob?.notes && <p className="small muted">{mob.notes}</p>}
            </section>
            {b.gearTiers?.length > 0 && <section><h3>Every gear tier</h3><GearTiers sets={b.gearTiers} budget={settings.budget} /></section>}
            {b.requirements && <Collapsible title="Suggested skills"><Prose text={b.requirements} /></Collapsible>}
            {b.transport && <Collapsible title="Getting there"><Prose text={b.transport} /></Collapsible>}
            {b.inventory && <Collapsible title="Inventory"><Prose text={b.inventory} /></Collapsible>}
            <Collapsible title="Strategy"><Prose text={[b.intro, b.strategy].filter(Boolean).join('\n\n')} /></Collapsible>
            <section className="links">
              <a href={wikiUrl(b.title)} target="_blank" rel="noreferrer">Wiki page</a>
              {b.strategiesTitle && <a href={wikiUrl(b.strategiesTitle)} target="_blank" rel="noreferrer">Wiki strategies</a>}
              <a href={ytSearch(name + ' boss')} target="_blank" rel="noreferrer">Videos</a>
            </section>
          </div>
        </Collapsible>
      ) : <Card><p className="muted">No boss data saved. <button className="link-btn" onClick={() => go('lookup', name)}>Look it up live</button></p></Card>}
    </div>
  );
}
