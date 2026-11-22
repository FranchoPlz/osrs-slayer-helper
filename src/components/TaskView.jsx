import { useEffect, useState } from 'react';
import { Card, Collapsible, EquipmentSetups, GearTiers, Locations, Prose, Stat, Verdict } from './ui.jsx';
import { fmt, MASTER_POINTS } from '../lib/engine.js';
import { prayerFor, requiredItems, weaponHints, ytSearch } from '../lib/advice.js';
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
    catch (e) { setError(navigator.onLine ? e.message : 'You are offline — showing saved data.'); }
    setLoading(false);
  };
  useEffect(() => { if (!wiki && !loading) refresh(); }, [name]); // auto live-lookup when nothing cached

  const row = evaluation?.rows.find((r) => r.key === data.key(name));
  const assigners = data.allTasks.find((t) => t.key === data.key(name))?.masters || [];
  const masterLabel = data.master(settings.master)?.label || settings.master;
  const monster = wiki?.monster;
  const items = requiredItems(wiki?.infobox?.otherReq, wiki?.intro, wiki?.strategy?.slice(0, 2500));
  const prayers = prayerFor(monster?.attackStyle);
  const hints = weaponHints(monster);
  const chosen = row?.chosen;

  return (
    <div className="view">
      <div className="title-row">
        <div>
          <h1>{name}</h1>
          <p className="muted small">
            {wiki?.title ? <>Wiki: <a href={wikiUrl(wiki.title)} target="_blank" rel="noreferrer">{wiki.title}</a></> : 'Not in offline data'}
            {live && <> · live {new Date(live.liveAt).toLocaleDateString()}</>}
          </p>
        </div>
        {row && <Verdict action={row.action} big />}
      </div>

      {/* ---------- verdict ---------- */}
      {row ? (
        <Card title={`Verdict for ${masterLabel}`} right={<MasterPicker data={data} settings={settings} assigners={assigners} />}>
          <p className="reason"><Verdict action={row.action} /> {row.reason}</p>
          <div className="stats">
            <Stat label="Chance" value={fmt.pct(row.chance)} sub={`weight ${row.weight}`} />
            <Stat label="Task size" value={row.min ? `${row.min}–${row.max}` : fmt.k(row.length)} sub={row.eMin ? `ext ${row.eMin}–${row.eMax}` : 'kills'} />
            <Stat label="Sheet author" value={row.sheetActionNorm || '–'} sub="v3.8 sheet" />
            <Stat label="Your avg" value={settings.goal === 'gp' ? fmt.k(evaluation.summary.gph) + ' gp/h' : fmt.k(evaluation.summary.xph) + ' xp/h'} sub={masterLabel} />
          </div>
          <div className="override">
            <span className="muted small">Override:</span>
            {['Auto', 'Do', 'Skip', 'Block'].map((a) => (
              <button key={a} className={(row.override.action || 'Auto') === a ? 'on' : ''} onClick={() => setOverride(settings.master, row.task, { action: a })}>{a}</button>
            ))}
            <label className="check"><input type="checkbox" checked={!!row.override.locked} onChange={(e) => setOverride(settings.master, row.task, { locked: e.target.checked || undefined })} /> Not unlocked</label>
          </div>
          {row.locations?.length > 0 && (
            <p className="small muted">Konar sends you to: {row.locations.map((l) => l.name).join(', ')}</p>
          )}
        </Card>
      ) : (
        <Card title="Assignment">
          <p className="muted">{masterLabel} doesn’t assign this task.{assigners.length > 0 && ' Assigned by:'}</p>
          <div className="chips">{assigners.map((m) => <button key={m} className="chip" onClick={() => setSettings({ master: m })}>{data.master(m)?.label || m}</button>)}</div>
        </Card>
      )}

      {/* ---------- best method ---------- */}
      {row?.variants?.length > 0 && (
        <Card title="Best way to kill it">
          {chosen ? (
            <>
              <h3 className="method">{chosen.mob.variant}</h3>
              <div className="stats">
                <Stat label="XP / hr" value={fmt.k(chosen.rates.xph)} />
                <Stat label="Profit / hr" value={fmt.k(chosen.rates.gph)} />
                <Stat label="Kills / hr" value={fmt.k(chosen.mob.kph)} />
                <Stat label="Task time" value={fmt.h(chosen.rates.hours)} />
              </div>
              <ul className="tips">
                {row.extend && <li>⏫ <b>Extend</b> this task (the sheet recommends it).</li>}
                {row.bracelet && <li>📿 Wear a <b>Bracelet of {row.bracelet === 'Slaughter' ? 'slaughter' : row.bracelet.toLowerCase()}</b> ({row.bracelet === 'Slaughter' ? 'longer task for a good one' : 'finish this one faster'}).</li>}
                {chosen.mob.killsTrip && <li>🎒 About {chosen.mob.killsTrip} kills per trip, ~{chosen.mob.travel}s travel per trip.</li>}
                {chosen.mob.notes && <li>📝 {chosen.mob.notes}</li>}
                {chosen.mob.quality != null && <li className="muted">Data quality {chosen.mob.quality}/5 (sheet author's confidence)</li>}
              </ul>
            </>
          ) : <p className="muted">None of the rated methods fit your settings. Check the list below.</p>}
          <Collapsible title={`All ${row.variants.length} methods compared`} open={!chosen}>
            <table className="variants">
              <thead><tr><th>Method</th><th>XP/h</th><th>GP/h</th><th></th></tr></thead>
              <tbody>
                {[...row.variants].sort((a, b) => (b.allRates?.xph || 0) - (a.allRates?.xph || 0)).map((v) => (
                  <tr key={v.mob.variant} className={`${v === chosen ? 'chosen' : ''} ${v.blocker || !v.allRates ? 'dim' : ''}`}>
                    <td>{v.mob.variant}{v.blocker && <div className="small warn">{v.blocker}</div>}{!v.allRates && <div className="small muted">no rate data</div>}</td>
                    <td>{fmt.k(v.allRates?.xph)}</td>
                    <td>{fmt.k(v.allRates?.gph)}</td>
                    <td>{v.rates && v !== chosen && <button className="mini" onClick={() => setOverride(settings.master, row.task, { variant: v.mob.variant })}>Use</button>}
                      {v === chosen && row.override.variant && <button className="mini" onClick={() => setOverride(settings.master, row.task, { variant: undefined })}>Auto</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Collapsible>
        </Card>
      )}

      {loading && !wiki && <Card><p className="muted">Looking it up on the OSRS Wiki…</p></Card>}
      {error && <Card><p className="warn">{error}</p></Card>}

      {/* ---------- requirements & how to fight ---------- */}
      {wiki && (
        <Card title="How to fight it">
          <div className="facts">
            {wiki.infobox?.slayerReq && <Fact k="Slayer" v={wiki.infobox.slayerReq} />}
            {wiki.infobox?.combatReq && <Fact k="Combat" v={wiki.infobox.combatReq} />}
            {wiki.infobox?.otherReq && <Fact k="Other reqs" v={wiki.infobox.otherReq} />}
            {monster?.combat && <Fact k="Combat lvl" v={monster.combat} />}
            {monster?.hitpoints && <Fact k="Hitpoints" v={monster.hitpoints} />}
            {monster?.maxHit && <Fact k="Max hit" v={monster.maxHit} />}
            {monster?.attackStyle && <Fact k="Attacks with" v={monster.attackStyle} />}
            {monster?.aggressive && <Fact k="Aggressive" v={monster.aggressive} />}
            {monster?.poisonous && monster.poisonous !== 'No' && <Fact k="Poisonous" v={monster.poisonous} />}
            {monster?.attributes && <Fact k="Attributes" v={monster.attributes} />}
          </div>
          {prayers.length > 0 && <p>🙏 <b>Pray:</b> {prayers.join(', ')}</p>}
          {hints.length > 0 && <ul className="tips">{hints.map((h) => <li key={h}>⚔ {h}</li>)}</ul>}
          {items.length > 0 && (
            <div className="bring">
              <b>Bring:</b>{' '}
              {items.map((i) => <span key={i.name} className={`tag ${i.coveredByHelm && settings.slayerHelm ? 'dim' : 'gold'}`} title={i.coveredByHelm ? 'Covered by a slayer helmet' : ''}>{i.name}{i.coveredByHelm && settings.slayerHelm ? ' (helm ✓)' : ''}</span>)}
            </div>
          )}
        </Card>
      )}

      {wiki && (
        <Card title="Where to kill it & how to get there">
          <Locations locations={wiki.locations} places={data.wiki?.places} chosenVariant={chosen?.mob.variant} />
        </Card>
      )}

      {wiki && (wiki.gearTiers?.length > 0 || wiki.equipment?.length > 0 || wiki.inventory) && (
        <Card title="Gear">
          {wiki.gearTiers?.length > 0 && <GearTiers sets={wiki.gearTiers} budget={settings.budget} />}
          {wiki.equipment?.length > 0 && (
            <Collapsible title="Example setups from the Wiki" open={!wiki.gearTiers?.length}>
              <EquipmentSetups setups={wiki.equipment} />
            </Collapsible>
          )}
          {wiki.inventory && <Collapsible title="Inventory"><Prose text={wiki.inventory} /></Collapsible>}
        </Card>
      )}

      {wiki && (
        <Card title="Strategy">
          <Prose text={wiki.intro} max={3} />
          {wiki.strategy && <Collapsible title="Full strategy notes"><Prose text={wiki.strategy} /></Collapsible>}
          {wiki.variants?.length > 0 && (
            <Collapsible title="Monster variants">
              <ul className="plain">{wiki.variants.map((v, i) => <li key={i}><b>{v.monster}</b> {v.combat && `(lvl ${v.combat})`} — {v.locations.join(', ')}{v.notes && <div className="small muted">{v.notes}</div>}</li>)}</ul>
            </Collapsible>
          )}
        </Card>
      )}

      <Card title="More help">
        <div className="links big">
          {wiki?.title && <a href={wikiUrl(wiki.title)} target="_blank" rel="noreferrer">📖 Wiki task page</a>}
          {wiki?.strategiesTitle && <a href={wikiUrl(wiki.strategiesTitle)} target="_blank" rel="noreferrer">📘 Wiki strategies</a>}
          {monster?.title && <a href={wikiUrl(monster.title)} target="_blank" rel="noreferrer">👹 Monster page</a>}
          <a href={ytSearch(name)} target="_blank" rel="noreferrer">▶ Video guides</a>
          <a href={data.sheet.source} target="_blank" rel="noreferrer">📊 Efficiency sheet</a>
        </div>
        <button className="link-btn" onClick={refresh} disabled={loading}>{loading ? 'Refreshing…' : '↻ Refresh this monster from the Wiki'}</button>
        {MASTER_POINTS[settings.master] === 0 && <p className="small muted">Turael/Spria tasks reset your streak if used to skip.</p>}
      </Card>
    </div>
  );
}

const Fact = ({ k, v }) => <div className="fact"><span>{k}</span><strong>{v}</strong></div>;

function MasterPicker({ data, settings, assigners }) {
  return (
    <select value={settings.master} onChange={(e) => setSettings({ master: e.target.value })} aria-label="Slayer master">
      {data.sheet.masters.map((m) => <option key={m.id} value={m.id}>{m.label}{assigners.includes(m.id) ? '' : ' (n/a)'}</option>)}
    </select>
  );
}

export function BossView({ data, name, settings }) {
  const b = data.bossWiki(name);
  const mob = data.sheet.mobs.find((m) => m.variant.startsWith(name));
  const prayers = prayerFor(b?.monster?.attackStyle);
  return (
    <div className="view">
      <div className="title-row"><div><h1>{name}</h1><p className="muted small">Boss / “Like a Boss” task option</p></div></div>
      {mob?.xph > 0 && (
        <Card title="Rates (sheet)">
          <div className="stats">
            <Stat label="Kills / hr" value={fmt.k(mob.kph)} />
            <Stat label="XP / hr" value={fmt.k(mob.xph)} />
            <Stat label="Profit / hr" value={fmt.k(mob.gph)} />
          </div>
          {mob.notes && <p className="small">{mob.notes}</p>}
        </Card>
      )}
      {b ? (
        <>
          <Card title="Fight overview">
            <div className="facts">
              {b.monster?.combat && <Fact k="Combat lvl" v={b.monster.combat} />}
              {b.monster?.hitpoints && <Fact k="Hitpoints" v={b.monster.hitpoints} />}
              {b.monster?.maxHit && <Fact k="Max hit" v={b.monster.maxHit} />}
              {b.monster?.attackStyle && <Fact k="Attacks with" v={b.monster.attackStyle} />}
              {b.monster?.slayerLevel && b.monster.slayerLevel !== 'None' && <Fact k="Slayer" v={b.monster.slayerLevel} />}
            </div>
            {prayers.length > 0 && <p>🙏 <b>Pray:</b> {prayers.join(', ')}</p>}
            <ul className="tips">{weaponHints(b.monster).map((h) => <li key={h}>⚔ {h}</li>)}</ul>
            {b.requirements && <Collapsible title="Suggested skills / requirements"><Prose text={b.requirements} /></Collapsible>}
            {b.transport && <Collapsible title="How to get there"><Prose text={b.transport} /></Collapsible>}
          </Card>
          {b.gearTiers?.length > 0 && <Card title="Gear"><GearTiers sets={b.gearTiers} budget={settings.budget} />{b.inventory && <Collapsible title="Inventory"><Prose text={b.inventory} /></Collapsible>}</Card>}
          <Card title="Strategy">
            <Prose text={b.intro} max={2} />
            {b.strategy && <Collapsible title="Full strategy notes"><Prose text={b.strategy} /></Collapsible>}
          </Card>
          <Card title="More help">
            <div className="links big">
              <a href={wikiUrl(b.title)} target="_blank" rel="noreferrer">📖 Wiki page</a>
              {b.strategiesTitle && <a href={wikiUrl(b.strategiesTitle)} target="_blank" rel="noreferrer">📘 Wiki strategies</a>}
              <a href={ytSearch(name + ' boss')} target="_blank" rel="noreferrer">▶ Video guides</a>
            </div>
          </Card>
        </>
      ) : <Card><p className="muted">No boss data saved. <button className="link-btn" onClick={() => go('lookup', name)}>Look it up live</button></p></Card>}
    </div>
  );
}
