// Derived, rule-based advice from wiki monster data + text

// [name, covered by a slayer helmet, Wiki icon file (defaults to `${name}.png`)]
const SLAYER_ITEMS = [
  ['Nose peg', true], ['Earmuffs', true], ['Facemask', true], ['Spiny helmet', true], ['Reinforced goggles', true],
  ['Rock hammer'], ['Rock thrownhammer'], ['Granite hammer'], ['Bag of salt'], ['Ice cooler'], ['Fungicide spray', false, 'Fungicide.png'],
  ['Leaf-bladed', false, 'Leaf-bladed sword.png'], ['Mirror shield'], ["V's shield"], ['Witchwood icon'], ['Insulated boots'], ['Boots of stone'],
  ['Slayer gloves'], ['Fishing explosive'], ['Anti-dragon shield'], ['Dragonfire shield'], ['Antifire', false, 'Antifire potion(4).png'],
  ['Light source', false, 'Bullseye lantern.png'], ['Teleport anchoring scroll'], ['Ectophial'], ['Salve amulet', false, 'Salve amulet(ei).png'],
  ['Brittle key'], ['Holy water'], ['Lit bug lantern'], ['Wolfbane'], ['Silver sickle'], ['Rope'], ['Dramen staff'],
];

/** Items/unlocks the text says you need or that are strongly recommended */
export function requiredItems(...texts) {
  const t = texts.filter(Boolean).join('\n').toLowerCase();
  const out = [];
  for (const [name, helm, icon] of SLAYER_ITEMS) if (t.includes(name.toLowerCase().replace(/-/g, '')) || t.includes(name.toLowerCase())) out.push({ name, coveredByHelm: !!helm, icon: icon || `${name}.png` });
  return out;
}

export function prayerFor(attackStyle) {
  const s = (attackStyle || '').toLowerCase();
  const out = [];
  if (/stab|slash|crush|melee/.test(s)) out.push('Protect from Melee');
  if (/ranged|missiles/.test(s)) out.push('Protect from Missiles');
  if (/magic/.test(s)) out.push('Protect from Magic');
  if (/dragonfire/.test(s)) out.push('Antifire + anti-dragon shield');
  return out;
}

export function weaponHints(monster) {
  const attrs = (monster?.attributes || '').toLowerCase();
  const out = [];
  if (attrs.includes('demon')) out.push('Demon: Arclight / Emberlight, Scorching bow or Demonbane spells');
  if (attrs.includes('dragon') || attrs.includes('draconic')) out.push('Dragon: Dragon hunter lance / crossbow / wand, bring antifire');
  if (attrs.includes('undead')) out.push('Undead: Salve amulet (ei) instead of slayer helm (bonuses don\'t stack)');
  if (attrs.includes('kalphite')) out.push('Kalphite: Keris partisan');
  if (attrs.includes('vampyre')) out.push('Vampyre: Blisterwood / Ivandis flail required for tier 2-3');
  if (attrs.includes('leafy')) out.push('Leafy: leaf-bladed weapons or broad bolts/arrows, Magic Dart');
  if (attrs.includes('shade')) out.push('Shade: Shade killing gear from Shades of Mort\'ton');
  if (attrs.includes('golem')) out.push('Golem: Barronite mace');
  if (attrs.includes('penance')) out.push('Penance: Penance trident unlocks');
  if (attrs.includes('spectral')) out.push('Spectral: magic is weaker; melee/range fine');
  if (attrs.includes('xerician')) out.push('Xerician: Twisted bow / Kodai scale well');
  if (monster?.weakestStyle) out.push(`Lowest defence: ${monster.weakestStyle}${monster.defences?.[monster.weakestStyle] != null ? ` (${monster.defences[monster.weakestStyle]})` : ''}`);
  if (monster?.weakness) out.push(`Elemental weakness: ${monster.weakness}`);
  return out;
}

/** Choose which tier index to highlight for a given budget */
export function tierFor(budget, n) {
  if (n <= 1) return 0;
  const f = { max: 0, high: 0.3, mid: 0.6, low: 1 }[budget] ?? 0.6;
  return Math.round(f * (n - 1));
}

/** Fuzzy-match a sheet variant like "Abyssal Demon (Catacombs -- Barrage)" to a wiki location name */
export function locationMatches(variant, locName) {
  const inner = ((variant || '').match(/\(([^)]+)\)/)?.[1] || '').split('--')[0].trim().toLowerCase();
  if (!inner) return false;
  const l = (locName || '').toLowerCase();
  const words = inner.replace(/wildy/g, 'wilderness').split(/\s+/).filter((w) => w.length > 2 && !/level|cave|the/.test(w));
  return words.length > 0 && words.every((w) => l.includes(w));
}

export const ytSearch = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`osrs ${q} slayer guide`)}`;
