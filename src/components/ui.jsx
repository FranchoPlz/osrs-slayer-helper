import { useState } from 'react';
import { mapUrl, wikiUrl, placePage } from '../lib/wikiparse.js';
import { tierFor, locationMatches } from '../lib/advice.js';
import { livePlace } from '../store.js';

export const Verdict = ({ action, big }) => (
  <span className={`verdict v-${(action || 'none').toLowerCase()} ${big ? 'big' : ''}`}>{action || '—'}</span>
);

export function Card({ title, right, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && <header><h2>{title}</h2>{right}</header>}
      {children}
    </section>
  );
}

export function Collapsible({ title, children, open: initial = false }) {
  const [open, setOpen] = useState(initial);
  return (
    <div className={`collapsible ${open ? 'open' : ''}`}>
      <button className="collapsible-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{title}</span><span className="chev">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

export const Prose = ({ text, max }) => {
  if (!text) return null;
  const paras = text.split(/\n{2,}/).slice(0, max || 99);
  return <div className="prose">{paras.map((p, i) => <p key={i}>{p.split('\n').map((l, j) => <span key={j}>{l}<br /></span>)}</p>)}</div>;
};

const flag = (v, label) => v === true ? <span className="tag ok">{label}</span> : v === false ? <span className="tag no">no {label.toLowerCase()}</span> : null;

export function Locations({ locations, places, chosenVariant }) {
  if (!locations?.length) return <p className="muted">The Wiki has no location table for this task. Check the Wiki page below.</p>;
  const sorted = [...locations].sort((a, b) => locationMatches(chosenVariant, b.name) - locationMatches(chosenVariant, a.name));
  return (
    <ul className="locations">
      {sorted.map((l, i) => <LocationItem key={i} l={l} place={places?.[placePage(l.name)]} best={locationMatches(chosenVariant, l.name)} />)}
    </ul>
  );
}

function LocationItem({ l, place, best }) {
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(false);
  const p = live || place;
  return (
    <li className={best ? 'best' : ''}>
      <div className="loc-head">
        <strong>{l.name}</strong>
        {best && <span className="tag gold">your method</span>}
        {l.amount && <span className="tag">{l.amount} spawns</span>}
        {flag(l.multi, 'Multi')}{flag(l.cannon, 'Cannon')}{flag(l.safespot, 'Safespot')}
      </div>
      {l.notes && <p className="small">{l.notes}</p>}
      <div className="links">
        {l.map && <a href={mapUrl(l.map)} target="_blank" rel="noreferrer">🗺 Map</a>}
        <a href={wikiUrl(placePage(l.name))} target="_blank" rel="noreferrer">Wiki</a>
      </div>
      <Collapsible title="How to get there">
        {p?.transport ? <Prose text={p.transport} /> : <p className="muted">No transport info cached.</p>}
        {!live && (
          <button className="link-btn" disabled={loading} onClick={async () => { setLoading(true); try { setLive(await livePlace(placePage(l.name))); } catch { /* offline */ } setLoading(false); }}>
            {loading ? 'Loading…' : '↻ Fetch latest from Wiki'}
          </button>
        )}
      </Collapsible>
    </li>
  );
}

const SLOT_ORDER = ['head', 'cape', 'neck', 'ammo', 'weapon', 'body', 'torso', 'shield', 'legs', 'hands', 'gloves', 'feet', 'boots', 'ring', 'special'];
const SLOT_ICON = { head: '⛑', cape: '🧣', neck: '📿', ammo: '➹', weapon: '⚔', body: '🛡', torso: '🛡', shield: '◈', legs: '👖', hands: '🧤', gloves: '🧤', feet: '🥾', boots: '🥾', ring: '💍', special: '✦' };

export function GearTiers({ sets, budget }) {
  const [tab, setTab] = useState(0);
  if (!sets?.length) return null;
  const set = sets[Math.min(tab, sets.length - 1)];
  const slots = SLOT_ORDER.filter((s) => set.slots[s]);
  return (
    <div className="gear">
      {sets.length > 1 && (
        <div className="tabs">{sets.map((s, i) => <button key={i} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>{s.style}</button>)}</div>
      )}
      <p className="small muted">Best on the left, cheapest on the right. <span className="gold-text">Gold</span> = the pick for your budget (Settings).</p>
      <div className="gear-rows">
        {slots.map((s) => {
          const tiers = set.slots[s];
          const pick = tierFor(budget, tiers.length);
          return (
            <div className="gear-row" key={s}>
              <div className="slot" title={s}>{SLOT_ICON[s]} <span>{s}</span></div>
              <div className="tiers">
                {tiers.map((t, i) => <span key={i} className={`tier ${i === pick ? 'pick' : ''}`}><em>{i + 1}</em>{t}</span>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EquipmentSetups({ setups }) {
  const [tab, setTab] = useState(0);
  if (!setups?.length) return null;
  const s = setups[Math.min(tab, setups.length - 1)];
  return (
    <div className="gear">
      {setups.length > 1 && <div className="tabs">{setups.map((x, i) => <button key={i} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>{x.name}</button>)}</div>}
      <div className="setup-grid">
        {Object.entries(s.slots).map(([slot, item]) => (
          <div key={slot} className="setup-slot"><span className="muted">{SLOT_ICON[slot] || '•'} {slot}</span><strong>{item}</strong></div>
        ))}
      </div>
      {s.text && <Prose text={s.text} max={2} />}
    </div>
  );
}

export const Stat = ({ label, value, sub }) => (
  <div className="stat"><span className="stat-label">{label}</span><span className="stat-value">{value}</span>{sub && <span className="stat-sub">{sub}</span>}</div>
);
