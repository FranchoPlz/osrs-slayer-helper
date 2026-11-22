import { useEffect, useState } from 'react';
import { imgUrl, isSurface, mapTiles, wikiUrl, placePage } from '../lib/wikiparse.js';
import { STYLE_TAB, tierFor, locationMatches, locationPointers, transportOptions } from '../lib/advice.js';
import { ICON, SKILL_IMG, SLOT_IMG } from '../lib/icons.js';
import { livePlace, mapVersion } from '../store.js';

/**
 * Wiki image. `img` is a file name or { file, w }. `size` is the display box in px;
 * big images are fetched as a 2x thumbnail. Falls back to `fallback`, then hides, if the file fails to load.
 */
export function Img({ img, size, alt = '', className = '', title, fallback }) {
  const [fails, setFails] = useState(0);
  const src = imgUrl(fails && fallback ? fallback : img, size ? size * 2 : undefined);
  if (!src || fails > (fallback ? 1 : 0)) return null;
  return (
    <img
      className={className} src={src} alt={alt} title={title} loading="lazy" decoding="async"
      crossOrigin="anonymous" referrerPolicy="no-referrer" onError={() => setFails(fails + 1)}
      style={size ? { maxWidth: size, maxHeight: size } : undefined}
    />
  );
}

/** Small inline pixel icon */
export const Icon = ({ file, alt = '', title }) => <Img img={file} alt={alt} title={title} className="icon" />;

/** Fixed-size box with a monster render, or nothing if there is no image */
export const Portrait = ({ img, size = 48, alt = '' }) => (
  <span className="portrait" style={{ width: size, height: size }}>{img && <Img img={img} size={size} alt={alt} />}</span>
);

export const Verdict = ({ action, big }) => (
  <span className={`verdict v-${(action || 'none').toLowerCase()} ${big ? 'big' : ''}`}>{action || '-'}</span>
);

export function Card({ title, icon, right, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      {(title || right) && (
        <header>
          <h2>{icon && <Icon file={icon} />}{title}</h2>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Collapsible({ title, children, open: initial = false, className = '' }) {
  const [open, setOpen] = useState(initial);
  return (
    <div className={`collapsible ${open ? 'open' : ''} ${className}`}>
      <button className="collapsible-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{title}</span><span className="chev" aria-hidden="true" />
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

export const Stat = ({ icon, label, value, sub }) => (
  <div className="stat">
    <span className="stat-label">{icon && <Icon file={icon} />}{label}</span>
    <span className="stat-value">{value}</span>
    {sub && <span className="stat-sub">{sub}</span>}
  </div>
);

/** Item with its inventory icon */
export const Item = ({ name, icon, dim, note }) => (
  <span className={`item ${dim ? 'dim' : ''}`} title={note}>
    <span className="item-icon">{icon && <Img img={icon} alt="" />}</span>
    <span>{name}</span>
  </span>
);

// ---------- locations ----------

const LocFlags = ({ l }) => (
  <>
    {l.multi === true && <Icon file={ICON.multi} title="Multicombat" alt="Multicombat" />}
    {l.cannon === true && <Icon file={ICON.cannon} title="Cannon allowed" alt="Cannon" />}
    {l.safespot === true && <span className="tag">safespot</span>}
  </>
);

/** Locations ordered so the one matching the chosen method comes first */
export function sortLocations(locations, chosenVariant) {
  return [...(locations || [])].sort((a, b) => locationMatches(chosenVariant, b.name) - locationMatches(chosenVariant, a.name));
}

/** The fight location (best by default); "change" lists every location to pick from */
export function LocationPick({ locations, current, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <Card title="Where" icon={ICON.map} className="where-card" right={locations.length > 1 && (
      <button className="mini" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'done' : `change (${locations.length})`}</button>
    )}>
      <div className="best-loc"><strong>{current.name}</strong></div>
      <LocFacts l={current} />
      <LocNotes notes={current.notes} />
      {open && (
        <ul className="loc-options">
          {locations.map((l, i) => (
            <li key={i}>
              <button className={l === current ? 'on' : ''} onClick={() => { onPick(l.name); setOpen(false); }}>
                <span>{l.name}</span> <LocFlags l={l} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Spawns, combat type, cannon, safespot and Wilderness as icon chips */
function LocFacts({ l }) {
  const wildy = /wilderness/i.test(`${l.name} ${l.notes}`);
  return (
    <div className="loc-facts">
      {l.amount?.split(/\n+|<\/?br\s*\/?>/i).filter((a) => a.trim()).map((a) => (
        <span key={a} className="tag"><Icon file={ICON.slayer} alt="" />{/^\d+$/.test(a.trim()) ? `${a.trim()} spawns` : a}</span>
      ))}
      {l.multi != null && <span className="tag"><Icon file={l.multi ? ICON.multi : ICON.combat} alt="" />{l.multi ? 'Multicombat' : 'Single combat'}</span>}
      {l.cannon != null && <span className={`tag ${l.cannon ? '' : 'off'}`}><Icon file={ICON.cannon} alt="" />{l.cannon ? 'Cannon' : 'No cannon'}</span>}
      {l.safespot === true && <span className="tag"><Icon file={SKILL_IMG.ranged} alt="" />Safespot</span>}
      {wildy && <span className="tag warn"><Icon file={ICON.wildy} alt="" />Wilderness</span>}
    </div>
  );
}

/** Location notes as a few iconed one-liners; the full Wiki text folds away */
function LocNotes({ notes }) {
  const { points, cut } = locationPointers(notes);
  if (!points.length) return null;
  return (
    <>
      <ul className="pointers">
        {points.map((p, i) => (
          <li key={i}><span className="pt-icon">{p.icon ? <Img img={p.icon} alt="" /> : <span className="dot" />}</span><span>{p.text}</span></li>
        ))}
      </ul>
      {cut && <Collapsible title="Full Wiki notes"><Prose text={notes} /></Collapsible>}
    </>
  );
}

/** Map of a location next to the teleports and transport the Wiki names for it, as icons. The full text sits under "Directions". */
export function GettingThere({ l, place }) {
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(false);
  const page = placePage(l.name);
  const p = live || place;
  const routes = transportOptions(l.notes, p?.transport);
  const entrance = !isSurface(l.map) && p?.entrance; // underground spot: also show where to go in
  return (
    <Card title={`Getting to ${l.name}`} icon={ICON.map} className="travel" right={<a className="small" href={wikiUrl(page)} target="_blank" rel="noreferrer">Wiki</a>}>
      <div className="travel-body">
        {(l.map || entrance) && (
          <div className="travel-maps">
            {l.map && <LocationMap map={l.map} label={entrance && 'Fight spot'} />}
            {entrance && <LocationMap map={entrance} label="Entrance" />}
          </div>
        )}
        <div className="travel-side">
          {routes.length > 0 ? <Routes routes={routes} /> : <p className="muted">No teleports named on the Wiki.</p>}
          {p?.transport && <Collapsible title="Directions"><Prose text={p.transport} /></Collapsible>}
          {!live && (
            <p className="small muted">
              <button className="link-btn" disabled={loading} onClick={async () => { setLoading(true); try { setLive(await livePlace(page)); } catch { /* offline */ } setLoading(false); }}>
                {loading ? 'Loading...' : 'Fetch latest from the Wiki'}
              </button>
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Teleport/transport icons, fastest first; tap one for the Wiki sentence about it */
export const Routes = ({ routes }) => (
  <ul className="routes">
    {routes.map((r) => (
      <li key={r.label}>
        <details>
          <summary>
            <span className="item-icon"><Img img={r.icon} fallback={r.fallback} alt="" /></span>
            <span className="route-label">{r.label}</span>
            {r.codes?.map((c) => <span key={c} className="ring-code">{c}</span>)}
          </summary>
          <p className="small">{r.text}</p>
        </details>
      </li>
    ))}
  </ul>
);

// View boxes the tiles are laid out in; they scale to the card width
const MAP_W = 560, MAP_H = 380, INSET_W = 180, INSET_H = 130;
const pct = (n, of) => `${(n / of) * 100}%`;

const MapTiles = ({ map, version, zoom, w, h }) => mapTiles(map, version, zoom, w, h).map((t) => (
  <img key={t.src} src={t.src} alt="" crossOrigin="anonymous" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
    style={{ left: pct(t.left, w), top: pct(t.top, h), width: `calc(${pct(256, w)} + 1px)` }} />
));

/** Wiki world map around a location, with a pin on it, and a zoomed-out inset showing where in the world it is */
function LocationMap({ map, label }) {
  const [version, setVersion] = useState(null);
  const [zoom, setZoom] = useState(2);
  useEffect(() => { mapVersion().then(setVersion, () => {}); }, []);
  if (!version) return null;
  return (
    <div className="loc-map">
      <MapTiles map={map} version={version} zoom={zoom} w={MAP_W} h={MAP_H} />
      <span className="loc-pin" />
      {label && <span className="loc-label">{label}</span>}
      <span className="loc-zoom">
        <button className="mini" onClick={() => setZoom(zoom + 1)} disabled={zoom >= 3} aria-label="Zoom in">+</button>
        <button className="mini" onClick={() => setZoom(zoom - 1)} disabled={zoom <= -2} aria-label="Zoom out">-</button>
      </span>
      {isSurface(map) && zoom > -1 && (
        <span className="loc-inset" aria-hidden="true">
          <MapTiles map={map} version={version} zoom={-3} w={INSET_W} h={INSET_H} />
          <span className="loc-pin sm" />
        </span>
      )}
    </div>
  );
}

// ---------- gear ----------

// Worn-equipment screen layout (3 columns, empty cells are null)
const EQUIP_LAYOUT = [
  [null, 'head', null],
  ['cape', 'neck', 'ammo'],
  ['weapon', 'body', 'shield'],
  [null, 'legs', null],
  ['hands', 'feet', 'ring'],
];

/** OSRS worn-equipment style grid. items: { [slot]: { name, icon } } */
export function EquipGrid({ items }) {
  return (
    <div className="equip">
      {EQUIP_LAYOUT.flat().map((slot, i) => {
        if (!slot) return <span key={i} />;
        const it = items[slot];
        return (
          <div key={i} className={`equip-cell ${it ? '' : 'empty'}`}>
            <span className="slot-box" title={it?.name || slot}>
              {it?.icon ? <Img img={it.icon} alt={it.name} /> : <Img img={SLOT_IMG[slot]} alt={slot} className="slot-ghost" />}
            </span>
            <span className="equip-name">{it?.name || ''}</span>
          </div>
        );
      })}
      {items.special && <div className="equip-special"><Item {...items.special} /></div>}
    </div>
  );
}

const StyleTabs = ({ names, tab, setTab }) =>
  names.length > 1 ? <div className="tabs">{names.map((n, i) => <button key={i} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>{n}</button>)}</div> : null;

/** The budget pick from each slot's tier list, laid out as worn equipment; opens on the tab of `style` (melee/ranged/magic) */
export function GearPick({ sets, budget, style }) {
  const preferred = Math.max(0, sets.findIndex((s) => STYLE_TAB[style]?.test(s.style)));
  const [tab, setTab] = useState(preferred);
  const set = sets[Math.min(tab, sets.length - 1)];
  const items = Object.fromEntries(Object.entries(set.slots).map(([s, tiers]) => [s, tiers[tierFor(budget, tiers.length)]]));
  return (
    <div className="gear">
      <StyleTabs names={sets.map((s) => s.style)} tab={tab} setTab={setTab} />
      <EquipGrid items={items} />
    </div>
  );
}

const SLOT_ORDER = ['head', 'cape', 'neck', 'ammo', 'weapon', 'body', 'shield', 'legs', 'hands', 'feet', 'ring', 'special'];

/** Every tier per slot, best first; the budget pick is outlined */
export function GearTiers({ sets, budget }) {
  const [tab, setTab] = useState(0);
  const set = sets[Math.min(tab, sets.length - 1)];
  return (
    <div className="gear">
      <StyleTabs names={sets.map((s) => s.style)} tab={tab} setTab={setTab} />
      <div className="gear-rows">
        {SLOT_ORDER.filter((s) => set.slots[s]).map((s) => {
          const tiers = set.slots[s];
          const pick = tierFor(budget, tiers.length);
          return (
            <div className="gear-row" key={s}>
              <span className="slot-box sm" title={s}><Img img={SLOT_IMG[s] || SLOT_IMG.weapon} alt={s} className="slot-ghost" /></span>
              <div className="tiers">
                {tiers.map((t, i) => (
                  <span key={i} className={`slot-box sm ${i === pick ? 'pick' : ''}`} title={t.name}>{t.icon ? <Img img={t.icon} alt={t.name} /> : <small>{t.name}</small>}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="small muted">Best on the left. The outlined item is the pick for your budget.</p>
    </div>
  );
}

export function EquipmentSetups({ setups }) {
  const [tab, setTab] = useState(0);
  const s = setups[Math.min(tab, setups.length - 1)];
  return (
    <div className="gear">
      <StyleTabs names={setups.map((x) => x.name)} tab={tab} setTab={setTab} />
      <EquipGrid items={s.slots} />
      {s.text && <Prose text={s.text} max={2} />}
    </div>
  );
}
