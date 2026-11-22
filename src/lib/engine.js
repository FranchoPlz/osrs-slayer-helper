// Recommendation engine: decides Do / Skip / Block per task for a slayer master,
// based on the sheet's per-variant rates and the user's goal + settings.

export const norm = (s) =>
  (s || '').toLowerCase().replace(/[^a-z]/g, '').replace(/ies$/, 'y').replace(/s$/, '');

const ALIASES = { abberantspectre: 'aberrantspectre' };
const key = (s) => ALIASES[norm(s)] || norm(s);

// Average reward points per task (from the sheet's long-run streak tables)
export const MASTER_POINTS = {
  Duradel: 29, Nieve: 26.6, Konar: 35.5, Krystilia: 44, Chaeldar: 17.75, Vannaka: 7.1, Mazchna: 3.03, TuraelSpria: 0,
};
const DEFAULT_RULES = { skipCost: 30, maxBlocks: Infinity };
// Mortimer: skips cost 100, only 2 block slots, and points come only from his "Points" modifier
export const MASTER_RULES = { Mortimer: { skipCost: 100, maxBlocks: 2 } };
export const rulesFor = (masterId) => ({ ...DEFAULT_RULES, ...MASTER_RULES[masterId] });
// Mortimer's five modifiers (points, quantity, clue, superior, XP) are equally likely; we assume all
// are unlocked (40+ Mortimer tasks), so a task carries the points modifier 1 time in 5.
const MORTIMER_MODIFIERS = 5;

/** Average points per completed task for a master */
export function pointsPerTask(master) {
  if (MASTER_POINTS[master.id] !== undefined) return MASTER_POINTS[master.id];
  const rated = master.tasks.filter((t) => t.points?.[0] != null);
  const w = rated.reduce((s, t) => s + t.weight, 0);
  if (!w) return 0;
  return rated.reduce((s, t) => s + t.weight * (t.points[0] + t.points[1]) / 2, 0) / w / MORTIMER_MODIFIERS;
}
const BETWEEN_TASKS_S = 80;

export const isWildy = (v) => /wild|wildy|revenant|callisto|artio|venenatis|spindel|vet'?ion|calvar|scorpia|chaos ele|chaos fan|crazy arch/i.test(v || '');

const BOSS_RE = /sire|kree|vorkath|callisto|artio|venenatis|spindel|vet'?ion|calvar|king black|cerberus|^kraken|thermonuclear|grotesque|alchemical|araxxor|zulrah|sarachnis|giant mole|kalphite queen|dagannoth (rex|prime|supreme|kings)|graardor|k'ril|zilyana|duke|leviathan|whisperer|vardorvis|muspah|scorpia|chaos ele|chaos fan|crazy arch|barrows|inferno|fight cave|jad|maggot king|shellbane|scurrius|hespori|tormented demon|nex|corp/i;
export const isBossVariant = (v) => BOSS_RE.test(v || '');

/** Is a sheet method/variant usable with the player's settings? Returns null if ok, else a reason. */
export function variantBlocker(v, masterId, s = {}) {
  const magic = s.stats?.magic ?? 99;
  if (masterId !== 'Krystilia' && isWildy(v) && !s.allowWildy) return 'Wilderness disabled in settings';
  if (/barrage/i.test(v) && !(s.ancients && magic >= 86)) return 'Needs Ancient Magicks + 86 Magic';
  if (/burst/i.test(v) && !(s.ancients && magic >= 62)) return 'Needs Ancient Magicks + 62 Magic';
  if (/cannon/i.test(v) && !s.cannon) return 'Needs a dwarf multicannon';
  if (isBossVariant(v) && !s.bosses) return 'Boss variants disabled in settings';
  return null;
}

export function indexData(sheet, wiki) {
  const mobsByTask = {};
  for (const m of sheet.mobs) (mobsByTask[key(m.task)] ||= []).push(m);
  const wikiByTask = {};
  for (const [name, w] of Object.entries(wiki?.tasks || {})) wikiByTask[key(name)] = w;
  // Sheet masters plus masters only on the Wiki (Mortimer)
  const masters = [...sheet.masters, ...(wiki?.masters || []).filter((m) => !sheet.masters.some((s) => s.id === m.id))];
  const allTasks = new Map();
  for (const master of masters) {
    for (const t of master.tasks) {
      const k = t.boss ? `boss:${key(t.task)}` : key(t.task);
      if (!allTasks.has(k)) allTasks.set(k, { key: k, name: t.task, boss: t.boss, masters: [] });
      allTasks.get(k).masters.push(master.id);
    }
  }
  const wikiOf = (task) => wikiByTask[key(task)] || null;
  return {
    sheet, wiki, masters,
    mobsFor: (task) => mobsByTask[key(task)] || [],
    wikiFor: wikiOf,
    bossWiki: (name) => wiki?.bosses?.[name] || null,
    /** Monster image ({ file, w }) for a task or boss name */
    imageFor: (name) => wikiOf(name)?.monster?.image || wiki?.bosses?.[name]?.monster?.image || null,
    allTasks: [...allTasks.values()].sort((a, b) => a.name.localeCompare(b.name)),
    master: (id) => masters.find((m) => m.id === id),
    key,
  };
}

/** Per-hour rates for a mob variant given master + task length (accounts for travel/banking). */
export function variantRates(mob, masterId, length) {
  if (!mob || !mob.kph || !mob.xpKill) return null;
  const gpKill =
    (masterId === 'Konar' && mob.gpKillKonar) || (masterId === 'Krystilia' && mob.gpKillKrystilia) || mob.gpKill || 0;
  const kills = length || 100;
  const trips = mob.killsTrip ? Math.ceil(kills / mob.killsTrip) : 1;
  const hours = kills / mob.kph + (trips * (mob.travel || 0) + BETWEEN_TASKS_S) / 3600;
  const xp = kills * mob.xpKill, gp = kills * (gpKill - (mob.costKill || 0));
  return { hours, xp, gp, xph: xp / hours, gph: gp / hours, kph: mob.kph };
}

export function valueOf(rates, goal, scale) {
  if (!rates) return null;
  if (goal === 'gp') return rates.gph;
  if (goal === 'xp') return rates.xph;
  // balanced: normalise each against master averages
  return rates.xph / scale.xph + rates.gph / scale.gph;
}

const slayerReqOf = (w) => {
  const m = (w?.infobox?.slayerReq || w?.monster?.slayerLevel || '').match(/(\d+)/);
  return m ? +m[1] : 1;
};

/**
 * Evaluate every task for a master. Returns { rows, summary }.
 * settings: { goal, slayerLevel, blockSlots, allowWildy, overrides: { [master|task]: {action, variant, locked} } }
 */
export function evaluateMaster(data, masterId, settings) {
  const master = data.master(masterId);
  if (!master) return { rows: [], summary: null };
  const rules = rulesFor(masterId);
  const { goal = 'xp', slayerLevel = 99, overrides = {} } = settings;
  const blockSlots = Math.min(settings.blockSlots ?? 6, rules.maxBlocks);
  const { skipCost } = rules;

  // Konar has one row per location; merge into one task with summed weight
  const merged = new Map();
  for (const t of master.tasks) {
    if (t.boss) continue;
    const k = data.key(t.task);
    if (!merged.has(k)) merged.set(k, { ...t, weight: 0, locations: [] });
    const m = merged.get(k);
    m.weight += t.weight;
    if (t.location) m.locations.push({ name: t.location, weight: t.weight, variant: t.variant });
  }

  const rows = [...merged.values()].map((t) => {
    const ov = overrides[`${masterId}|${t.task}`] || {};
    const wiki = data.wikiFor(t.task);
    const req = t.slayerReq || slayerReqOf(wiki);
    const length = t.avgLength || ((t.min || 0) + (t.max || 0)) / 2 || 100;
    const variants = data.mobsFor(t.task)
      .filter((m) => masterId !== 'Krystilia' || isWildy(m.variant) || m.gpKillKrystilia != null || m.larrans != null)
      .map((m) => {
        const blocker = variantBlocker(m.variant, masterId, settings);
        return { mob: m, rates: blocker ? null : variantRates(m, masterId, length), allRates: variantRates(m, masterId, length), blocker };
      });
    const locked = !!ov.locked || req > slayerLevel;
    return { ...t, key: data.key(t.task), wiki, req, length, variants, override: ov, locked, reqLocked: req > slayerLevel };
  });

  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);
  const rated = rows.filter((r) => r.variants.some((v) => v.rates));
  const scale = {
    xph: avg(rated.map((r) => Math.max(...r.variants.filter((v) => v.rates).map((v) => v.rates.xph)))) || 1,
    gph: avg(rated.map((r) => Math.max(...r.variants.filter((v) => v.rates).map((v) => v.rates.gph)))) || 1,
  };

  for (const r of rows) {
    const withRates = r.variants.filter((v) => v.rates);
    withRates.sort((a, b) => valueOf(b.rates, goal, scale) - valueOf(a.rates, goal, scale));
    const chosenName = r.override.variant;
    r.best = withRates[0] || null;
    r.chosen = (chosenName && withRates.find((v) => v.mob.variant === chosenName)) || r.best;
    r.value = r.chosen ? valueOf(r.chosen.rates, goal, scale) : null;
    r.hours = r.chosen ? r.chosen.rates.hours : null;
    r.chance = totalWeight ? r.weight / totalWeight : 0;
  }

  // --- iterative do/skip/block solve ---
  const pts = pointsPerTask(master);
  const eligible = rows.filter((r) => !r.locked);
  const known = eligible.filter((r) => r.value !== null);
  const fixed = (r) => r.override.action && r.override.action !== 'Auto';
  let R = 0, block = new Set(), skip = new Set();
  const kw = known.reduce((a, r) => a + r.weight, 0);
  const avgHours = kw ? known.reduce((a, r) => a + r.weight * Math.min(r.hours, 3), 0) / kw : 0.5;
  const skipHours = pts > 0 ? (skipCost / pts) * avgHours : Infinity;

  for (let iter = 0; iter < 12; iter++) {
    const doing = known.filter((r) => !block.has(r) && !skip.has(r) && (!fixed(r) || r.override.action === 'Do'));
    const num = doing.reduce((s, r) => s + r.weight * r.value * r.hours, 0);
    const den = doing.reduce((s, r) => s + r.weight * r.hours, 0) +
      (Number.isFinite(skipHours) ? [...skip].reduce((s, r) => s + r.weight * skipHours, 0) : 0);
    R = den ? num / den : 0;
    const loss = (r) => r.weight * r.hours * (R - r.value);
    const nb = new Set(), ns = new Set();
    const userBlocks = eligible.filter((r) => r.override.action === 'Block');
    userBlocks.forEach((r) => nb.add(r));
    const autoBlocks = known.filter((r) => !fixed(r) && loss(r) > 0).sort((a, b) => loss(b) - loss(a));
    for (const r of autoBlocks) { if (nb.size >= blockSlots) break; nb.add(r); }
    eligible.filter((r) => r.override.action === 'Skip').forEach((r) => ns.add(r));
    if (Number.isFinite(skipHours)) {
      for (const r of known) {
        if (nb.has(r) || fixed(r)) continue;
        if (r.value < R * (1 - skipHours / r.hours)) ns.add(r);
      }
      // points sustainability: skip weight share * skip cost <= points per completed task
      let sk = [...ns].filter((r) => !fixed(r)).sort((a, b) => b.value - a.value);
      const doneW = () => eligible.filter((r) => !nb.has(r) && !ns.has(r)).reduce((s, r) => s + r.weight, 0);
      const skipW = () => [...ns].reduce((s, r) => s + r.weight, 0);
      while (sk.length && (skipW() / Math.max(doneW(), 1)) * skipCost > pts) ns.delete(sk.shift());
    }
    const same = eqSet(nb, block) && eqSet(ns, skip);
    block = nb; skip = ns;
    if (same) break;
  }

  for (const r of rows) {
    if (r.locked) { r.action = 'Locked'; r.reason = r.reqLocked ? `Needs ${r.req} Slayer` : 'Marked as not unlocked'; continue; }
    if (r.override.action && r.override.action !== 'Auto') { r.action = r.override.action; r.reason = 'Your choice'; r.manual = true; }
    else if (r.value === null) {
      r.action = normaliseAction(r.sheetAction) || 'Do';
      r.reason = r.sheetAction ? 'No rate data, so this is the sheet author\'s call' : 'No rate data for this task';
    } else if (block.has(r)) r.action = 'Block';
    else if (skip.has(r)) r.action = 'Skip';
    else r.action = 'Do';
    if (r.value !== null && !r.reason) {
      const pct = R ? Math.round(((r.value - R) / R) * 100) : 0;
      const costH = r.weight * r.hours;
      if (r.action === 'Block') r.reason = `${Math.abs(pct)}% below your average and comes up ${(r.chance * 100).toFixed(1)}% of the time (${r.hours.toFixed(1)}h per task). One of your ${blockSlots} worst`;
      else if (r.action === 'Skip') r.reason = `${Math.abs(pct)}% below your average; skipping (${skipCost} pts) is cheaper than ${r.hours.toFixed(1)}h on it`;
      else r.reason = pct >= 0 ? `${pct}% above your average rate` : `${Math.abs(pct)}% below average, but not worth spending points on`;
      r.cost = costH;
    }
    r.sheetActionNorm = normaliseAction(r.sheetAction);
  }

  // summary
  const doRows = rows.filter((r) => r.action === 'Do' && r.chosen);
  const hrs = doRows.reduce((s, r) => s + r.weight * r.hours, 0);
  const skipW = rows.filter((r) => r.action === 'Skip').reduce((s, r) => s + r.weight, 0);
  const doneW = rows.filter((r) => r.action === 'Do').reduce((s, r) => s + r.weight, 0);
  const totalHrs = hrs + (Number.isFinite(skipHours) ? skipW * skipHours : 0);
  const summary = {
    avgValue: R,
    xph: totalHrs ? doRows.reduce((s, r) => s + r.weight * r.chosen.rates.xp, 0) / totalHrs : 0,
    gph: totalHrs ? doRows.reduce((s, r) => s + r.weight * r.chosen.rates.gp, 0) / totalHrs : 0,
    blocks: rows.filter((r) => r.action === 'Block'),
    skips: rows.filter((r) => r.action === 'Skip'),
    skipRate: doneW ? skipW / (doneW + skipW) : 0,
    pointsPerTask: pts,
    netPoints: pts - (doneW ? (skipW / doneW) * skipCost : 0),
    scale, goal, blockSlots, skipCost,
  };
  rows.sort((a, b) => b.weight - a.weight || a.task.localeCompare(b.task));
  return { rows, summary, bosses: master.tasks.filter((t) => t.boss) };
}

export const MODIFIERS = [
  { id: 'points', label: 'Points' },
  { id: 'quantity', label: 'Quantity' },
  { id: 'clue', label: 'Clues' },
  { id: 'superior', label: 'Superior' },
  { id: 'xp', label: 'XP' },
];
const TIE_ORDER = ['points', 'xp', 'superior', 'clue', 'quantity'];

/**
 * Mortimer offers 2-3 tasks, each with a modifier. Rank them, best first.
 * offers: [{ task, mod: MODIFIERS id | null, value?: number (XP% / points; defaults to the task's midpoint) }]
 * The XP modifier scales Slayer XP/h (xp and balanced goals). Other modifiers break near-ties (within 5%).
 */
export function rankOffers(evaluation, offers, goal) {
  const { rows, summary } = evaluation;
  const mid = (r) => (r && r[0] != null ? (r[0] + r[1]) / 2 : null);
  const ranked = offers.map((o) => {
    const row = rows.find((r) => r.key === key(o.task)) || null;
    const value = o.value ?? (o.mod === 'xp' ? mid(row?.xpMod) : o.mod === 'points' ? mid(row?.points) : null);
    let score = row && !row.locked ? row.value : null;
    if (score != null && o.mod === 'xp' && value && goal !== 'gp') {
      score = goal === 'xp' ? score * (1 + value / 100) : score + (row.chosen.rates.xph * value) / 100 / summary.scale.xph;
    }
    const pct = score != null && summary.avgValue ? Math.round(((score - summary.avgValue) / summary.avgValue) * 100) : null;
    return { ...o, value, row, score, pct };
  });
  const tie = (o) => (o.mod ? TIE_ORDER.indexOf(o.mod) : TIE_ORDER.length);
  return ranked.sort((a, b) => {
    if (a.score == null || b.score == null) return (a.score == null) - (b.score == null);
    const close = Math.abs(a.score - b.score) <= 0.05 * Math.max(Math.abs(a.score), Math.abs(b.score));
    return close ? tie(a) - tie(b) || b.score - a.score : b.score - a.score;
  });
}

function normaliseAction(a) {
  if (!a) return null;
  const s = a.toLowerCase();
  if (s.startsWith('do')) return 'Do';
  if (s.startsWith('skip')) return 'Skip';
  if (s.startsWith('block')) return 'Block';
  if (s.startsWith('lock')) return 'Locked';
  return null;
}
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const eqSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

export const fmt = {
  k: (n) => (n == null || !Number.isFinite(n) ? '-' : Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`),
  pct: (n) => `${(n * 100).toFixed(1)}%`,
  h: (n) => (n == null ? '-' : n < 1 ? `${Math.round(n * 60)}m` : `${n.toFixed(1)}h`),
};
