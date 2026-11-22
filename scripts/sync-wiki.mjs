// Builds an offline snapshot of OSRS Wiki slayer data for every task in public/data/sheet.json
// Output: public/data/wiki.json  { tasks: { [sheetTask]: {...} }, bosses: { [boss]: {...} } }
import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchWikitext, parseTaskPage, parseMonsterPage, taskPageCandidates, monsterPageCandidates, parseRecommendedEquipment, sectionText, placePage, toPlain, splitSections } from '../src/lib/wikiparse.js';

const UA = 'osrs-slayer-helper/0.1 (personal self-hosted PWA; build-time snapshot)';
const SHEET = path.resolve('public/data/sheet.json');
const OUT = path.resolve('public/data/wiki.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Sheet task names that don't map cleanly to a wiki "Slayer task/..." page
const OVERRIDES = {
  'TzHaar': 'Slayer task/TzHaar',
  'Tzhaar': 'Slayer task/TzHaar',
  'Fossil Island Wyvern': 'Slayer task/Fossil Island wyverns',
  'Revenant': 'Slayer task/Revenants',
  'Lizards': 'Slayer task/Lizards',
  'Lizard': 'Slayer task/Lizards',
  'Metal Dragons': 'Slayer task/Metal dragons',
  'Kalphite': 'Slayer task/Kalphites',
  'Elves': 'Slayer task/Elves',
  'Dwarves': 'Slayer task/Dwarves',
  'Wolves': 'Slayer task/Wolves',
  'Hydra': 'Slayer task/Hydras',
  'Jellies': 'Slayer task/Jellies',
  'Fossil Island Wyverns': 'Slayer task/Fossil Island wyverns',
  'Revenants': 'Slayer task/Revenants',
  'Minotaurs': 'Slayer task/minotaur',
  'Mutated Zygomite': 'Slayer task/Zygomites',
  'Scabarite': 'Slayer task/Scabarites',
};
const BOSS_PAGE = { 'Barrows Brothers': 'Barrows', 'Dagannoth Kings': 'Dagannoth Kings', 'Whisperer': 'The Whisperer', 'Leviathan': 'The Leviathan' };

async function batchFetch(titles) {
  const out = {};
  const uniq = [...new Set(titles)];
  for (let i = 0; i < uniq.length; i += 40) {
    const chunk = uniq.slice(i, i + 40);
    for (let attempt = 0; attempt < 3; attempt++) {
      try { Object.assign(out, await fetchWikitext(chunk, { userAgent: UA })); break; }
      catch (e) { console.warn('retry', e.message); await sleep(2000 * (attempt + 1)); }
    }
    process.stdout.write(`\r  fetched ${Math.min(i + 40, uniq.length)}/${uniq.length}`);
    await sleep(400);
  }
  process.stdout.write('\n');
  return out;
}

const sheet = JSON.parse(await fs.readFile(SHEET, 'utf8'));
const taskNames = new Set(), bossNames = new Set();
for (const m of sheet.masters) for (const t of m.tasks) (t.weight > 0 ? taskNames : bossNames).add(t.task);
// Boss options from "Like a Boss" in mob data
for (const mob of sheet.mobs) if (mob.task === 'Like a Boss') bossNames.add(mob.variant.replace(/\s*\(Like a Boss\)/, ''));

console.log(`Resolving ${taskNames.size} tasks, ${bossNames.size} bosses`);
const candidates = {};
for (const t of taskNames) candidates[t] = OVERRIDES[t] ? [OVERRIDES[t], ...taskPageCandidates(t)] : taskPageCandidates(t);
const pages = await batchFetch(Object.values(candidates).flat());

const tasks = {};
const monsterTitles = new Set();
for (const t of taskNames) {
  const hit = candidates[t].map((c) => pages[c]).find(Boolean);
  if (!hit) { tasks[t] = { title: null, missing: true }; continue; }
  const parsed = parseTaskPage(hit.wikitext, hit.title);
  parsed.monsterPage = parsed.variants[0]?.page || t.replace(/s$/, '');
  monsterTitles.add(parsed.monsterPage);
  tasks[t] = parsed;
}
const missing = [...taskNames].filter((t) => tasks[t].missing);
if (missing.length) console.log('  no task page for:', missing.join(', '));
for (const t of missing) monsterPageCandidates(t).forEach((c) => monsterTitles.add(c));

console.log(`Fetching ${monsterTitles.size} monster infoboxes + ${bossNames.size} boss pages`);
const stratTitles = [...monsterTitles].map((m) => `${m}/Strategies`);
const bossTitles = [...bossNames].flatMap((b) => [BOSS_PAGE[b] || b, `${BOSS_PAGE[b] || b}/Strategies`]);
const mpages = await batchFetch([...monsterTitles, ...stratTitles, ...bossTitles]);

for (const t of taskNames) {
  const tk = tasks[t];
  const mp = tk.missing ? monsterPageCandidates(t).map((c) => mpages[c]).find(Boolean) : mpages[tk.monsterPage];
  tk.monster = mp ? parseMonsterPage(mp.wikitext, mp.title) : null;
  const sp = !tk.missing && mpages[`${tk.monsterPage}/Strategies`];
  if (sp) {
    tk.strategiesTitle = sp.title;
    const extra = parseRecommendedEquipment(sp.wikitext);
    tk.gearTiers = [...(tk.gearTiers || []), ...extra];
    if (!tk.inventory) tk.inventory = sectionText(sp.wikitext, /^inventory/i, 1200);
    const more = sectionText(sp.wikitext, /strateg|mechanic|fight/i, 3000);
    if (more) tk.strategy = [tk.strategy, more].filter(Boolean).join('\n\n');
  }
  if (tk.missing && mp) {
    tk.title = mp.title; tk.missing = false;
    tk.intro = toPlain(splitSections(mp.wikitext)[0].body).slice(0, 1500);
  }
}

const bosses = {};
for (const b of bossNames) {
  const page = BOSS_PAGE[b] || b;
  const mp = mpages[page], sp = mpages[`${page}/Strategies`];
  const sections = sp ? splitSections(sp.wikitext) : [];
  const pick = sections.filter((s) => /requirement|equipment|inventory|strateg|mechanic|overview|fight|phase/i.test(s.title) && s.body.length > 200);
  bosses[b] = {
    title: mp?.title || page,
    strategiesTitle: sp?.title || null,
    monster: mp ? parseMonsterPage(mp.wikitext, mp.title) : null,
    gearTiers: sp ? parseRecommendedEquipment(sp.wikitext) : [],
    inventory: sp ? sectionText(sp.wikitext, /^inventory/i, 1200) : '',
    transport: sp ? sectionText(sp.wikitext, /transport|getting there|travel/i, 1500) : '',
    requirements: sp ? sectionText(sp.wikitext, /requirement|suggested skills/i, 1000) : '',
    intro: mp ? toPlain(splitSections(mp.wikitext)[0].body).slice(0, 1500) : '',
    strategy: toPlain((sp ? splitSections(sp.wikitext)[0].body : '') + '\n' + pick.slice(0, 4).map((s) => `${s.title}:\n${s.body}`).join('\n')).slice(0, 6000),
  };
}

// "How to get there" for every location mentioned in task location tables
const placeNames = new Set();
for (const t of Object.values(tasks)) for (const l of t.locations || []) if (placePage(l.name)) placeNames.add(placePage(l.name));
console.log(`Fetching transport info for ${placeNames.size} locations`);
const ppages = await batchFetch([...placeNames]);
const places = {};
for (const p of placeNames) {
  const pg = ppages[p];
  if (!pg) continue;
  const transport = sectionText(pg.wikitext, /^(transportation|getting there|travel|access|entrances?)/i, 1500);
  places[p] = { title: pg.title, transport: transport || toPlain(splitSections(pg.wikitext)[0].body).slice(0, 600) };
}

await fs.writeFile(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), tasks, bosses, places }));
const size = (await fs.stat(OUT)).size;
console.log(`Wrote ${OUT} (${(size / 1024).toFixed(0)} KB)`);
