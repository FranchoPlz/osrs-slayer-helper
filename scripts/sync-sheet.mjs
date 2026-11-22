// Downloads the community slayer efficiency Google Sheet and converts it to public/data/sheet.json
// Usage: node scripts/sync-sheet.mjs [path-to-local.xlsx]
import fs from 'node:fs/promises';
import path from 'node:path';
import XLSX from 'xlsx';

const SHEET_ID = process.env.SLAYER_SHEET_ID || '1WM2rbCBiNTyOXTwOwXO6WltO4dfPO7cler4-ruCet7o';
const OUT = path.resolve('public/data/sheet.json');
const MASTERS = ['Duradel', 'Nieve', 'Konar', 'Krystilia', 'Chaeldar', 'Vannaka', 'Mazchna', 'TuraelSpria'];
const MASTER_LABEL = { TuraelSpria: 'Turael / Spria' };

async function loadWorkbook() {
  const local = process.argv[2];
  let buf;
  if (local) {
    buf = await fs.readFile(local);
  } else {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`;
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`Sheet download failed: HTTP ${res.status} (is the sheet shared "anyone with the link"?)`);
    buf = Buffer.from(await res.arrayBuffer());
  }
  return XLSX.read(buf, { type: 'buffer', cellDates: false });
}

const clean = (v) => (v === '' || v === undefined ? null : v);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v) => (v === null || v === undefined || v === '' ? null : String(v).trim());

function rowsOf(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
}

// Map header names (first contiguous block of headers) to column indexes
function headerIndex(header) {
  const idx = {};
  for (let i = 0; i < header.length; i++) {
    const h = header[i];
    if (h === null || h === '') break;
    idx[String(h).trim()] = i;
  }
  return idx;
}
const pick = (row, idx, ...names) => {
  for (const n of names) if (n in idx) return clean(row[idx[n]]);
  return null;
};

function parseMaster(ws, name) {
  const rows = rowsOf(ws);
  const idx = headerIndex(rows[0]);
  const tasks = [];
  for (const r of rows.slice(1)) {
    const monster = str(r[idx.Monster]);
    const weight = num(pick(r, idx, 'Weight'));
    if (monster && /^(Total Doing|Total Skips|Gross Weight|Total Weight|Skip )/.test(monster)) break;
    if (!monster || weight === null) continue;
    const action = str(pick(r, idx, 'Action', 'Do/Skip/Block'));
    tasks.push({
      task: monster,
      weight,
      baseWeight: num(pick(r, idx, 'Base Weight')) ?? weight,
      location: str(pick(r, idx, 'Location')),
      sheetAction: action,
      extend: pick(r, idx, 'Extend', 'Extension') === true,
      bracelet: str(pick(r, idx, 'Bracelet')),
      boss: weight === 0,
      cape: pick(r, idx, 'Slayer Cape') === true,
      variant: str(pick(r, idx, 'Variant')),
      min: num(pick(r, idx, 'Min')),
      max: num(pick(r, idx, 'Max')),
      eMin: num(pick(r, idx, 'eMin')),
      eMax: num(pick(r, idx, 'eMax')),
      avgLength: num(pick(r, idx, 'Avg Task Length', 'Average Amount')),
    });
  }
  return { id: name, label: MASTER_LABEL[name] || name, tasks };
}

// "Task Lengths" tab: side-by-side blocks for Duradel / Konar / Nieve / Krystilia
function parseTaskLengths(ws) {
  const rows = rowsOf(ws);
  const header = rows[0];
  const blocks = [];
  header.forEach((h, i) => {
    const m = typeof h === 'string' && h.match(/^(\w+) Tasks$/);
    if (m) blocks.push({ master: m[1], col: i });
  });
  const out = {};
  for (const b of blocks) {
    const hasLoc = header[b.col + 1] === 'Location';
    const o = hasLoc ? 1 : 0;
    out[b.master] = [];
    for (const r of rows.slice(1)) {
      const task = str(r[b.col]);
      if (!task) continue;
      out[b.master].push({
        task,
        location: hasLoc ? str(r[b.col + 1]) : null,
        min: num(r[b.col + 1 + o]), max: num(r[b.col + 2 + o]),
        eMin: num(r[b.col + 3 + o]), eMax: num(r[b.col + 4 + o]),
      });
    }
  }
  return out;
}

function parseMobData(ws) {
  const rows = rowsOf(ws);
  const idx = headerIndex(rows[1]);
  const mobs = [];
  for (const r of rows.slice(2)) {
    const task = str(r[idx.Task]);
    const variant = str(r[idx['Monster Variant']]);
    if (!task || !variant) continue;
    mobs.push({
      task, variant,
      brimstone: num(pick(r, idx, 'Brimstone Rate')),
      larrans: num(pick(r, idx, "Larran's Rate")),
      xpKill: num(pick(r, idx, 'XP/Kill')),
      gpKill: num(pick(r, idx, 'GP/Kill')),
      gpKillKonar: num(pick(r, idx, 'GP/Kill (Konar)')),
      gpKillKrystilia: num(pick(r, idx, 'GP/Kill (Krystilia)')),
      costKill: num(pick(r, idx, 'Cost/Kill')),
      travel: num(pick(r, idx, 'Travel Time')),
      killsTrip: num(pick(r, idx, 'Kills/Trip')),
      kph: num(pick(r, idx, 'Raw Kills/Hour')),
      xph: num(pick(r, idx, 'Raw XP/Hour')),
      gph: num(pick(r, idx, 'Raw Profit/Hour')),
      quality: num(pick(r, idx, 'Data Quality')),
      notes: str(pick(r, idx, 'Notes About Data')),
    });
  }
  return mobs;
}

const wb = await loadWorkbook();
const masters = MASTERS.filter((m) => wb.Sheets[m]).map((m) => parseMaster(wb.Sheets[m], m));
const lengths = wb.Sheets['Task Lengths'] ? parseTaskLengths(wb.Sheets['Task Lengths']) : {};
// Fill min/max for high-level masters from the Task Lengths tab
for (const m of masters) {
  const L = lengths[m.id];
  if (!L) continue;
  for (const t of m.tasks) {
    const hit = L.find((l) => l.task === t.task && (!t.location || l.location === t.location)) || L.find((l) => l.task === t.task);
    if (hit) Object.assign(t, { min: t.min ?? hit.min, max: t.max ?? hit.max, eMin: t.eMin ?? hit.eMin, eMax: t.eMax ?? hit.eMax });
  }
}
const mobs = parseMobData(wb.Sheets['Mob Data']);
const log = wb.Sheets['Update Log'] ? rowsOf(wb.Sheets['Update Log']) : [];
const version = log.length ? str(log[0][0]) : null;

const out = { source: `https://docs.google.com/spreadsheets/d/${SHEET_ID}`, version, fetchedAt: new Date().toISOString(), masters, mobs };
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(out));
console.log(`Sheet ${version}: ${masters.map((m) => `${m.label}=${m.tasks.length}`).join(', ')}; ${mobs.length} mob variants -> ${OUT}`);
