import { useEffect, useState, useSyncExternalStore } from 'react';
import { API, fetchWikitext, fetchImageWidths, parseTaskPage, parseMonsterPage, parseRecommendedEquipment, placeEntrance, sectionText, taskPageCandidates, monsterPageCandidates, toPlain, splitSections } from './lib/wikiparse.js';

const KEY = 'slayer-helper:settings:v1';

export const DEFAULT_SETTINGS = {
  master: 'Duradel',
  goal: 'xp', // xp | gp | balanced
  slayerLevel: 85,
  stats: { attack: 90, strength: 90, defence: 85, ranged: 90, magic: 90, prayer: 70, hitpoints: 90 },
  ancients: true,
  cannon: true,
  allowWildy: false,
  bosses: true,
  budget: 'mid', // low | mid | high | max
  blockSlots: 6,
  slayerHelm: true,
  overrides: {},
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const s = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...s, stats: { ...DEFAULT_SETTINGS.stats, ...(s.stats || {}) } };
  } catch { return DEFAULT_SETTINGS; }
}

let state = load();
const subs = new Set();
export function setSettings(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  subs.forEach((f) => f());
}
export const useSettings = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => state);

export function setOverride(master, task, patch) {
  setSettings((s) => {
    const k = `${master}|${task}`;
    const next = { ...(s.overrides[k] || {}), ...patch };
    Object.keys(next).forEach((x) => (next[x] === undefined || next[x] === 'Auto') && delete next[x]);
    const overrides = { ...s.overrides, [k]: next };
    if (!Object.keys(next).length) delete overrides[k];
    return { overrides };
  });
}

// ---------- data loading ----------
let dataPromise;
export function loadData() {
  dataPromise ||= Promise.all([
    fetch(`${import.meta.env.BASE_URL}data/sheet.json`).then((r) => r.json()),
    fetch(`${import.meta.env.BASE_URL}data/wiki.json`).then((r) => r.json()),
  ]);
  return dataPromise;
}

// ---------- live wiki lookups (cached per browser) ----------
// v2: gear tiers are { name, icon } objects and monsters carry an image
const LIVE = 'slayer-helper:live2:';
export function getLive(name) {
  try { return JSON.parse(localStorage.getItem(LIVE + name) || 'null'); } catch { return null; }
}
/** Names looked up live in this browser, most recent last */
export function recentLookups(n = 5) {
  // localStorage key order is unspecified, so order by fetch time
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith(LIVE)).map((k) => k.slice(LIVE.length))
      .map((name) => [name, getLive(name)?.liveAt || '']).sort((a, b) => a[1].localeCompare(b[1])).map(([name]) => name).slice(-n);
  } catch { return []; }
}

/** Fetch fresh task + monster + strategies data from the OSRS Wiki for a task/monster name */
export async function liveLookup(name, hintPage) {
  const taskCands = taskPageCandidates(name);
  const first = await fetchWikitext([...taskCands, ...monsterPageCandidates(name)]);
  const taskHit = taskCands.map((c) => first[c]).find(Boolean);
  let result;
  if (taskHit) {
    result = parseTaskPage(taskHit.wikitext, taskHit.title);
    result.monsterPage = result.variants[0]?.page || hintPage || name;
  } else {
    const mp = monsterPageCandidates(name).map((c) => first[c]).find(Boolean);
    if (!mp) throw new Error(`Nothing found on the Wiki for "${name}"`);
    result = { title: mp.title, intro: toPlain(splitSections(mp.wikitext)[0].body).slice(0, 1500), strategy: '', equipment: [], gearTiers: [], variants: [], locations: [], monsterPage: mp.title };
  }
  const second = await fetchWikitext([result.monsterPage, `${result.monsterPage}/Strategies`]);
  const mp = second[result.monsterPage];
  if (mp) result.monster = parseMonsterPage(mp.wikitext, mp.title);
  if (result.monster?.image) {
    const w = await fetchImageWidths([result.monster.image.file]).catch(() => ({}));
    result.monster.image.w = w[result.monster.image.file];
  }
  const sp = second[`${result.monsterPage}/Strategies`];
  if (sp) {
    result.strategiesTitle = sp.title;
    result.gearTiers = [...(result.gearTiers || []), ...parseRecommendedEquipment(sp.wikitext)];
    result.inventory ||= sectionText(sp.wikitext, /^inventory/i, 1200);
    const more = sectionText(sp.wikitext, /strateg|mechanic|fight/i, 3000);
    if (more) result.strategy = [result.strategy, more].filter(Boolean).join('\n\n');
  }
  result.liveAt = new Date().toISOString();
  try { localStorage.setItem(LIVE + name, JSON.stringify(result)); } catch { /* quota */ }
  return result;
}

export async function livePlace(page) {
  const r = await fetchWikitext([page]);
  const pg = r[page];
  if (!pg) return null;
  return {
    title: pg.title,
    transport: sectionText(pg.wikitext, /^(transportation|getting there|travel|access|entrances?)/i, 1500) || toPlain(splitSections(pg.wikitext)[0].body).slice(0, 600),
    entrance: placeEntrance(pg.wikitext),
  };
}

let mapVer;
/** Current Wiki map tile version. It changes with game updates and old ones get deleted, so ask the Wiki (1.7 KB). */
export function mapVersion() {
  const q = new URLSearchParams({ action: 'parse', text: '{{Map|3222,3218}}', contentmodel: 'wikitext', prop: 'text', format: 'json', formatversion: '2', origin: '*' });
  mapVer ||= fetch(`${API}?${q}`).then((r) => r.json()).then((j) => j.parse.text.match(/versions\/([^/]+)\/tiles/)[1])
    .catch((e) => { mapVer = null; throw e; });
  return mapVer;
}

// ---------- tiny hash router ----------
export function useRoute() {
  // Decode each part after splitting, so names with "/" survive; a malformed "%" in the URL goes home instead of crashing
  const get = () => { try { return location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent); } catch { return ['']; } };
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const f = () => { setRoute(get()); window.scrollTo(0, 0); };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return route;
}
export const go = (...parts) => { location.hash = '/' + parts.map(encodeURIComponent).join('/'); };
