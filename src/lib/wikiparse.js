// Minimal MediaWiki wikitext parser tailored to OSRS Wiki slayer task + monster pages.
// Pure JS, used both by the build-time snapshot script (Node) and live lookups in the browser.

export const WIKI = 'https://oldschool.runescape.wiki';
export const API = `${WIKI}/api.php`;
export const wikiUrl = (title) => `${WIKI}/w/${encodeURIComponent(title.replace(/ /g, '_'))}`;

/**
 * Wiki map tiles for a W x H px view centred on a {{Map}} spot { x, y, mapID, plane }.
 * At `zoom` a game tile is 2^zoom px; each 256px tile file is named by plane and tile column/row (row counts north).
 */
export function mapTiles(m, version, zoom, W, H) {
  const ppt = 2 ** zoom, span = 256 / ppt, out = [];
  for (let i = Math.floor((m.x - W / 2 / ppt) / span); i <= Math.floor((m.x + W / 2 / ppt) / span); i++) {
    for (let j = Math.floor((m.y - H / 2 / ppt) / span); j <= Math.floor((m.y + H / 2 / ppt) / span); j++) {
      out.push({
        src: `https://maps.runescape.wiki/osrs/versions/${version}/tiles/rendered/${m.mapID ?? 0}/${zoom}/${m.plane || 0}_${i}_${j}.png`,
        left: W / 2 - (m.x - i * span) * ppt,
        top: H / 2 - ((j + 1) * span - m.y) * ppt,
      });
    }
  }
  return out;
}

/**
 * URL of a Wiki image. `img` is a file name or { file, w } (w = original width, from fetchImageWidths).
 * Images wider than `width` are served as a `width`px thumbnail; smaller ones as the original.
 */
export function imgUrl(img, width) {
  const file = typeof img === 'string' ? img : img?.file;
  if (!file) return null;
  const f = encodeURIComponent(file.replace(/ /g, '_'));
  return width && img?.w > width ? `${WIKI}/images/thumb/${f}/${width}px-${f}` : `${WIKI}/images/${f}`;
}

/** File name from a [[File:X.png|...]] link */
export const fileOf = (raw) => (raw || '').match(/\[\[\s*(?:File|Image):([^|\]]+)/i)?.[1].trim() || null;

// ---------- low level scanning ----------

/** Find top-level templates {{Name ...}} (case-insensitive name match). Returns [{start,end,inner}] */
export function findTemplates(text, name) {
  const out = [];
  const re = new RegExp(`\\{\\{\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[|}\\n]`, 'gi');
  let m;
  while ((m = re.exec(text))) {
    const start = m.index;
    const end = matchBraces(text, start);
    if (end < 0) break;
    out.push({ start, end, inner: text.slice(start + 2, end - 2) });
    re.lastIndex = end;
  }
  return out;
}

/** Given index of "{{", return index just after the matching "}}" */
function matchBraces(text, start) {
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') { depth++; i++; }
    else if (text[i] === '}' && text[i + 1] === '}') { depth--; i++; if (depth === 0) return i + 1; }
  }
  return -1;
}

/** Split on a separator only at depth 0 of {{ }} and [[ ]] */
function splitTop(text, sep = '|') {
  const parts = [];
  let depthT = 0, depthL = 0, cur = '';
  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (two === '{{') { depthT++; cur += two; i++; continue; }
    if (two === '}}') { depthT--; cur += two; i++; continue; }
    if (two === '[[') { depthL++; cur += two; i++; continue; }
    if (two === ']]') { depthL--; cur += two; i++; continue; }
    if (text[i] === sep && depthT === 0 && depthL === 0) { parts.push(cur); cur = ''; continue; }
    cur += text[i];
  }
  parts.push(cur);
  return parts;
}

export function templateParams(inner) {
  const parts = splitTop(inner);
  const name = parts.shift().trim();
  const named = {}, positional = [];
  for (const p of parts) {
    const eq = p.indexOf('=');
    const lb = p.indexOf('{{'), ll = p.indexOf('[[');
    const firstNest = Math.min(lb < 0 ? Infinity : lb, ll < 0 ? Infinity : ll);
    if (eq > 0 && eq < firstNest) named[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
    else positional.push(p.trim());
  }
  return { name, named, positional };
}

// ---------- wikitext -> plain text ----------

const SIMPLE_TEMPLATES = {
  yes: () => 'Yes', no: () => 'No', na: () => 'N/A', '*': () => '•',
};

function renderTemplate(inner) {
  const { name, named, positional } = templateParams(inner);
  const n = name.toLowerCase();
  if (SIMPLE_TEMPLATES[n]) return SIMPLE_TEMPLATES[n]();
  if (n === 'scp') return `${positional[1] ?? ''} ${positional[0] ?? ''}`.trim();
  if (n === 'skill clickpic' || n === 'skillreq') return `${positional[1] ?? ''} ${positional[0] ?? ''}`.trim();
  if (n === 'coins') return positional[0] ?? '';
  if (n === 'fairycode') return `fairy ring ${(positional[0] || '').toUpperCase()}`;
  if (n === 'floornumber') return `floor ${named.uk ?? named.us ?? positional[0] ?? ''}`.trim();
  if (n === 'plink' || n === 'plinkt' || n === 'plinkp') return named.txt || positional[1] || positional[0] || '';
  if (n === 'boostable') return '';
  if (n === 'efn' || n === 'sic' || n.startsWith('cite') || n === 'reflist' || n === 'main' || n === 'see also') return '';
  if (n === 'nowrap' || n === 'tooltip') return positional[0] ?? '';
  if (n === 'm' || n === 'members') return '';
  return '';
}

export function toPlain(wt) {
  if (!wt) return '';
  let t = wt;
  t = t.replace(/<!--[\s\S]*?-->/g, '');
  t = t.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<\/?(span|div|small|big|sup|sub|center|u|s|code|nowiki|includeonly|noinclude)[^>]*>/gi, '');
  // remove tables entirely in prose
  t = removeTables(t);
  // templates (innermost first, repeat)
  for (let guard = 0; guard < 10 && t.includes('{{'); guard++) {
    t = t.replace(/\{\{([^{}]*)\}\}/g, (_, inner) => renderTemplate(inner));
  }
  t = t.replace(/\[\[(?:File|Image|Category):[^\]]*(?:\[\[[^\]]*\]\][^\]]*)*\]\]/gi, '');
  t = t.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1');
  t = t.replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1').replace(/\[https?:\/\/[^\]]+\]/g, '');
  t = t.replace(/'''''|'''|''/g, '');
  t = t.replace(/<\/?tabber>/gi, '');
  t = t.replace(/^[ \t]*[*#:]+[ \t]*/gm, '• ');
  t = t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

function removeTables(t) {
  let out = '', depth = 0;
  for (const line of t.split('\n')) {
    if (/^\s*\{\|/.test(line)) { depth++; continue; }
    if (depth > 0 && /^\s*\|\}/.test(line)) { depth--; continue; }
    if (depth === 0) out += line + '\n';
  }
  return out;
}

// ---------- sections & tables ----------

export function splitSections(wt) {
  const lines = wt.split('\n');
  const sections = [{ level: 1, title: '_intro', body: '' }];
  for (const line of lines) {
    const m = line.match(/^(={2,6})\s*(.+?)\s*\1\s*$/);
    if (m) sections.push({ level: m[1].length, title: m[2], body: '' });
    else sections[sections.length - 1].body += line + '\n';
  }
  return sections;
}

/** Body of a section including its sub-sections */
function sectionWithChildren(sections, title) {
  const i = sections.findIndex((s) => s.title.toLowerCase() === title.toLowerCase());
  if (i < 0) return '';
  let body = sections[i].body;
  for (let j = i + 1; j < sections.length && sections[j].level > sections[i].level; j++) {
    body += `\n=== ${sections[j].title} ===\n` + sections[j].body;
  }
  return body;
}

/** Parse first wikitable in text into rows of raw cell wikitext (template-aware). */
export function parseTables(text) {
  const tables = [];
  let i = 0;
  while ((i = text.indexOf('{|', i)) >= 0) {
    // find matching |} considering templates
    let j = i + 2, depth = 1;
    while (j < text.length && depth > 0) {
      if (text.startsWith('{{', j)) { const e = matchBraces(text, j); j = e < 0 ? text.length : e; continue; }
      if (text.startsWith('{|', j)) { depth++; j += 2; continue; }
      if (text.startsWith('|}', j)) { depth--; j += 2; continue; }
      j++;
    }
    tables.push(parseTableBody(text.slice(i + 2, j - 2)));
    i = j;
  }
  return tables;
}

function parseTableBody(body) {
  // protect templates so their line-leading pipes don't look like cells
  const stash = [];
  let prot = '', k = 0;
  while (k < body.length) {
    if (body.startsWith('{{', k)) {
      const e = matchBraces(body, k);
      if (e < 0) { prot += body.slice(k); break; }
      stash.push(body.slice(k, e)); prot += `\u0000${stash.length - 1}\u0000`; k = e; continue;
    }
    prot += body[k++];
  }
  const restore = (s) => s.replace(/\u0000(\d+)\u0000/g, (_, n) => stash[+n]);
  const rows = [];
  let header = [], cur = null;
  const lines = prot.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('|+')) continue;
    if (line.startsWith('|-')) { if (cur) rows.push(cur); cur = []; continue; }
    if (line.startsWith('!')) {
      line.slice(1).split('!!').forEach((c) => header.push(stripAttrs(restore(c)).trim()));
      continue;
    }
    if (line.startsWith('|')) {
      if (!cur) cur = [];
      line.slice(1).split('||').forEach((c) => cur.push(stripAttrs(restore(c))));
      continue;
    }
    if (cur && cur.length) cur[cur.length - 1] += '\n' + restore(raw);
  }
  if (cur && cur.length) rows.push(cur);
  return { header, rows: rows.filter((r) => r.length) };
}

function stripAttrs(cell) {
  // "style=... | content" -> content (only when the pipe is top-level and precedes content)
  const parts = splitTop(cell);
  if (parts.length > 1 && /^[\s\w-]+=/.test(parts[0]) && !parts[0].includes('[[')) return parts.slice(1).join('|');
  return cell;
}

// ---------- page parsers ----------

function parseMapTemplate(cell) {
  const t = findTemplates(cell, 'Map')[0];
  if (!t) return null;
  const { named, positional } = templateParams(t.inner);
  const coord = positional.find((p) => /^\d+,\d+/.test(p));
  if (!coord) return null;
  const [x, y] = coord.split(',').map(Number);
  return { mapID: named.mapid ? Number(named.mapid) : 0, plane: named.plane ? Number(named.plane) : 0, x, y };
}

const yn = (s) => {
  const p = toPlain(s).toLowerCase();
  if (p.startsWith('yes')) return true;
  if (p.startsWith('no')) return false;
  return p || null;
};

export function parseTaskPage(wt, title) {
  const out = { title, infobox: null, intro: '', strategy: '', equipment: [], variants: [], locations: [], requirements: '' };
  const ib = findTemplates(wt, 'Infobox Slayer')[0];
  if (ib) {
    const { named } = templateParams(ib.inner);
    out.infobox = {
      slayerReq: toPlain(named.skillreq || ''),
      combatReq: toPlain(named.combatreq || ''),
      otherReq: toPlain(named.otherreq || ''),
      masters: Object.fromEntries(
        ['turael', 'spria', 'mazchna', 'vannaka', 'chaeldar', 'konar', 'nieve', 'steve', 'duradel', 'krystilia', 'mortimer']
          .filter((k) => named[k]).map((k) => [k, toPlain(named[k])]),
      ),
    };
  }
  const body = ib ? wt.slice(0, ib.start) + wt.slice(ib.end) : wt;
  const sections = splitSections(body);
  out.intro = toPlain(sections[0].body);
  const strat = sections.filter((s) => /strateg|method|tips|requirement/i.test(s.title) && !/shop/i.test(s.title));
  out.strategy = toPlain(strat.map((s) => (s.level > 2 ? `${s.title}:\n` : '') + s.body).join('\n'));

  // Equipment: <tabber> Tab name= {{Equipment ...}} text |-| ...
  const eq = sectionWithChildren(sections, 'Equipment') || sectionWithChildren(sections, 'Recommended equipment');
  if (eq) {
    const tabbed = eq.includes('<tabber>') ? eq.replace(/<\/?tabber>/g, '').split(/\|-\|/) : [eq];
    for (const chunk of tabbed) {
      const m = chunk.match(/^\s*([^=\n{]+?)\s*=\s*\n/);
      const tpl = findTemplates(chunk, 'Equipment')[0];
      if (!tpl) continue;
      const { named } = templateParams(tpl.inner);
      const slots = {};
      const EQ_SLOT = { torso: 'body', gloves: 'hands', boots: 'feet' };
      for (const s of ['head', 'cape', 'neck', 'ammo', 'weapon', 'torso', 'shield', 'legs', 'gloves', 'boots', 'ring', 'special']) {
        if (named[s]) slots[EQ_SLOT[s] || s] = itemOf(named[s]);
      }
      const text = toPlain(chunk.slice(tpl.end)).split('\n\n').slice(0, 3).join('\n\n');
      out.equipment.push({ name: m ? toPlain(m[1]) : 'Recommended', slots, text });
    }
  }

  out.gearTiers = parseRecommendedEquipment(body);
  out.inventory = sectionText(body, /^inventory/i, 1200);

  // Variants + locations tables
  for (const tbl of parseTables(body)) {
    const H = tbl.header.map((h) => toPlain(h).toLowerCase());
    if (H.includes('monster') && H.includes('locations')) {
      const iM = H.indexOf('monster'), iC = H.findIndex((h) => h.startsWith('combat')), iX = H.findIndex((h) => h.includes('xp')), iL = H.indexOf('locations'), iN = H.indexOf('notes');
      for (const r of tbl.rows) {
        const link = (r[iM] || '').match(/\[\[([^\]|#]+)/);
        out.variants.push({
          monster: toPlain(r[iM]), page: link ? link[1].trim() : toPlain(r[iM]),
          combat: iC >= 0 ? toPlain(r[iC]) : null, slayerXp: iX >= 0 ? toPlain(r[iX]) : null,
          locations: iL >= 0 ? toPlain(r[iL]).split('\n').map((s) => s.replace(/^•\s*/, '')).filter(Boolean) : [],
          notes: iN >= 0 ? toPlain(r[iN]).replace(/^•\s*/gm, '') : '',
        });
      }
    } else if (H[0] === 'location' && (H.includes('multicombat') || H.includes('cannonable') || H.includes('maplink'))) {
      const col = (name) => H.findIndex((h) => h.startsWith(name));
      const iMap = col('maplink'), iA = col('amount'), iMu = col('multi'), iCa = col('cannon'), iSa = col('safespot'), iN = col('notes');
      for (const r of tbl.rows) {
        out.locations.push({
          name: toPlain(r[0]),
          map: iMap >= 0 ? parseMapTemplate(r[iMap] || '') : null,
          amount: iA >= 0 ? toPlain(r[iA]) : null,
          multi: iMu >= 0 ? yn(r[iMu]) : null,
          cannon: iCa >= 0 ? yn(r[iCa]) : null,
          safespot: iSa >= 0 ? yn(r[iSa]) : null,
          notes: iN >= 0 ? toPlain(r[iN]) : '',
        });
      }
    }
  }
  return out;
}

export function parseMonsterPage(wt, title) {
  const ib = findTemplates(wt, 'Infobox Monster')[0];
  if (!ib) return null;
  const { named } = templateParams(ib.inner);
  const g = (k) => {
    const v = named[k] ?? named[`${k}1`];
    return v === undefined ? null : toPlain(v);
  };
  const n = (k) => { const v = parseFloat(g(k)); return Number.isFinite(v) ? v : null; };
  const defs = { stab: n('dstab'), slash: n('dslash'), crush: n('dcrush'), magic: n('dmagic'), light: n('dlight'), standard: n('dstandard'), heavy: n('dheavy') };
  const ranged = [defs.light, defs.standard, defs.heavy].filter((v) => v !== null);
  const styleDefs = { Stab: defs.stab, Slash: defs.slash, Crush: defs.crush, Magic: defs.magic, Ranged: ranged.length ? Math.min(...ranged) : n('drange') };
  const valid = Object.entries(styleDefs).filter(([, v]) => v !== null);
  valid.sort((a, b) => a[1] - b[1]);
  const image = fileOf(named.image ?? named.image1);
  return {
    title,
    image: image ? { file: image } : null,
    combat: g('combat'), hitpoints: g('hitpoints'), maxHit: g('max hit'),
    attackStyle: g('attack style'), aggressive: g('aggressive'), poisonous: g('poisonous'),
    attributes: g('attributes'), size: g('size'), slayerLevel: g('slaylvl'), slayerXp: g('slayxp'),
    weakness: [g('elementalweaknesstype'), g('elementalweaknesspercent') ? `${g('elementalweaknesspercent')}%` : null].filter(Boolean).join(' ') || null,
    immunePoison: g('immunepoison') || (named.poisonresistance === '100' ? 'Immune' : null),
    immuneCannon: g('immunecannon'), immuneVenom: g('immunevenom'),
    defences: styleDefs,
    weakestStyle: valid.length ? valid[0][0] : null,
  };
}

// ---------- fetching (works in Node 18+ and browser) ----------

/** Fetch raw wikitext for up to 50 titles. Returns { [requestedTitle]: { title, wikitext } | null } */
export async function fetchWikitext(titles, { userAgent } = {}) {
  const params = new URLSearchParams({
    action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main',
    titles: titles.join('|'), redirects: '1', format: 'json', formatversion: '2', origin: '*',
  });
  const headers = userAgent ? { 'User-Agent': userAgent } : {};
  const res = await fetch(`${API}?${params}`, { headers });
  if (!res.ok) throw new Error(`Wiki HTTP ${res.status}`);
  const data = await res.json();
  const q = data.query || {};
  const alias = {};
  for (const n of q.normalized || []) alias[n.from] = n.to;
  for (const r of q.redirects || []) alias[r.from] = r.to;
  const resolve = (t) => { let x = t, i = 0; while (alias[x] && i++ < 5) x = alias[x]; return x; };
  const byTitle = {};
  for (const p of q.pages || []) {
    if (p.missing || !p.revisions) continue;
    byTitle[p.title] = { title: p.title, wikitext: p.revisions[0].slots.main.content };
  }
  const out = {};
  for (const t of titles) out[t] = byTitle[resolve(t)] || null;
  return out;
}

/** Original pixel widths of up to 50 Wiki files: { [file]: width }. Missing files are left out. */
export async function fetchImageWidths(files, { userAgent } = {}) {
  const params = new URLSearchParams({
    action: 'query', prop: 'imageinfo', iiprop: 'size', titles: files.map((f) => `File:${f}`).join('|'),
    format: 'json', formatversion: '2', origin: '*',
  });
  const res = await fetch(`${API}?${params}`, { headers: userAgent ? { 'User-Agent': userAgent } : {} });
  if (!res.ok) throw new Error(`Wiki HTTP ${res.status}`);
  const q = (await res.json()).query || {};
  const alias = Object.fromEntries((q.normalized || []).map((n) => [n.to, n.from]));
  const out = {};
  for (const p of q.pages || []) {
    const w = p.imageinfo?.[0]?.width;
    if (w) out[(alias[p.title] || p.title).replace(/^File:/, '')] = w;
  }
  return out;
}

/** Candidate wiki task-page titles for a sheet task name */
export function taskPageCandidates(task) {
  const base = task.trim();
  const lower = base[0] + base.slice(1).toLowerCase();
  const forms = new Set();
  for (const b of [base, lower, base.toLowerCase()]) {
    forms.add(b);
    if (!/s$/i.test(b)) forms.add(b + 's');
    if (/y$/i.test(b)) forms.add(b.slice(0, -1) + 'ies');
    if (/s$/i.test(b)) forms.add(b.slice(0, -1));
  }
  return [...forms].map((f) => `Slayer task/${f}`);
}

/** Candidate monster page titles for a name (wiki uses sentence case) */
export function monsterPageCandidates(name) {
  const base = name.trim();
  const lower = base[0] + base.slice(1).toLowerCase();
  const out = new Set([base, lower]);
  for (const b of [base, lower]) {
    if (/ies$/.test(b)) out.add(b.slice(0, -3) + 'y');
    else if (/s$/.test(b)) out.add(b.slice(0, -1));
  }
  return [...out];
}

// ---------- tiered gear ({{Recommended equipment}}) ----------

const RE_SLOTS = ['head', 'neck', 'cape', 'body', 'legs', 'weapon', 'shield', 'ammo', 'hands', 'feet', 'ring', 'special'];

/** A gear cell -> { name, icon }: display text plus the icon of its first linked item */
export function itemOf(raw) {
  const name = toPlain(raw).replace(/\s*\n\s*/g, ' ').trim();
  const tpl = (raw.match(/\{\{\s*plink[pt]?\s*\|[^{}]*\}\}/i) || [])[0];
  let page = null, pic = null;
  if (tpl) {
    const { named, positional } = templateParams(tpl.slice(2, -2));
    page = positional[0]; pic = named.pic;
  } else {
    page = raw.match(/\[\[([^\]|]+)/)?.[1];
  }
  page = (pic || page || (name.length < 40 ? name : '')).replace(/#.*$/, '').trim();
  return { name, icon: page ? `${page[0].toUpperCase()}${page.slice(1)}.png` : null };
}

/** Returns [{ style, slots: { head: [{ name, icon }, ...best to cheapest], ... } }] */
export function parseRecommendedEquipment(wt) {
  const sets = [];
  for (const tpl of findTemplates(wt, 'Recommended equipment')) {
    const { named } = templateParams(tpl.inner);
    const slots = {};
    for (const s of RE_SLOTS) {
      const tiers = [];
      for (let i = 1; i <= 12; i++) {
        const v = named[`${s}${i}`];
        if (v === undefined) continue;
        const item = itemOf(v);
        if (item.name) tiers.push(item);
      }
      if (tiers.length) slots[s] = tiers;
    }
    if (Object.keys(slots).length) sets.push({ style: toPlain(named.style || 'Recommended'), slots });
  }
  return sets;
}

/**
 * Task table of a Slayer Master page (used for Mortimer, who is not in the efficiency sheet).
 * Returns [{ task, page, min, max, eMin, eMax, weight, slayerReq, points: [lo, hi], xpMod: [lo, hi] }]
 */
export function parseMasterPage(wt) {
  const range = (s) => {
    const m = toPlain(s || '').match(/(-?\d+)%?\s*[-–]\s*(-?\d+)/);
    return m ? [+m[1], +m[2]] : [null, null];
  };
  for (const tbl of parseTables(wt)) {
    const H = tbl.header.map((h) => toPlain(h).replace(/^\|/, '').toLowerCase());
    if (H[0] !== 'monster' || !H.includes('weight')) continue;
    const col = (re) => H.findIndex((h) => re.test(h));
    const iA = col(/^amount/), iE = col(/^extended/), iW = col(/^weight/), iR = col(/unlock|requirement/), iP = col(/^points/), iX = col(/^xp/);
    return tbl.rows.map((r) => {
      const link = r[0].match(/\[\[([^\]|#]+)(?:\|([^\]]+))?\]\]/);
      const wTpl = findTemplates(r[iW] || '', '+=')[0];
      const weight = wTpl ? +templateParams(wTpl.inner).positional[1] : parseFloat(toPlain(r[iW]));
      const [min, max] = range(r[iA]);
      const [eMin, eMax] = range(r[iE]);
      return {
        task: toPlain(link ? link[2] || link[1] : r[0]).trim(),
        page: link ? link[1].trim() : null,
        min, max, eMin, eMax, weight,
        slayerReq: +((r[iR] || '').match(/\{\{\s*scp\s*\|\s*slayer\s*\|\s*(\d+)/i)?.[1] || 1),
        points: iP >= 0 ? range(r[iP]) : null,
        xpMod: iX >= 0 ? range(r[iX]) : null,
      };
    }).filter((t) => t.task && Number.isFinite(t.weight));
  }
  return [];
}

/** Plain text of a named section (first match, includes children), capped */
export function sectionText(wt, re, cap = 2000) {
  const sections = splitSections(wt);
  const i = sections.findIndex((s) => re.test(s.title));
  if (i < 0) return '';
  let body = sections[i].body;
  for (let j = i + 1; j < sections.length && sections[j].level > sections[i].level; j++) body += `\n${sections[j].title}:\n${sections[j].body}`;
  const txt = toPlain(body);
  return txt.length > cap ? txt.slice(0, cap).replace(/\s+\S*$/, '') + '…' : txt;
}

/** Strip floor / parenthetical qualifiers from a location name to get its wiki page */
export const placePage = (name) => (name || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+-.*$/, '').trim();
