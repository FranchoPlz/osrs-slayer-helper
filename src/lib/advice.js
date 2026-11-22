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

// Wiki map icon for transport whose own Wiki image is a huge render (quetzal, glider, canoe, ...)
export const TRANSPORT_ICON = 'Transportation icon.png';

// [label, pattern, Wiki icon]
const TRANSPORTS = [
  ['Fairy ring', /fairy ring/i, 'Fairy ring icon.png'],
  ['Spirit tree', /spirit tree/i, 'Spirit tree icon.png'],
  ["Xeric's talisman", /xeric's talisman/i, "Xeric's talisman.png"],
  ['Games necklace', /games necklace/i, 'Games necklace(8).png'],
  ['Skills necklace', /skills necklace/i, 'Skills necklace(6).png'],
  ['Slayer ring', /slayer ring/i, 'Slayer ring.png'],
  ['Ring of dueling', /ring of dueling/i, 'Ring of dueling(8).png'],
  ['Amulet of glory', /amulet of glory|\bglory\b/i, 'Amulet of glory(6).png'],
  ['Combat bracelet', /combat bracelet/i, 'Combat bracelet(6).png'],
  ['Digsite pendant', /digsite pendant/i, 'Digsite pendant.png'],
  ['Necklace of passage', /necklace of passage/i, 'Necklace of passage.png'],
  ['Burning amulet', /burning amulet/i, 'Burning amulet.png'],
  ['Ring of wealth', /ring of wealth/i, 'Ring of wealth (5).png'],
  ['Ring of returning', /ring of returning/i, 'Ring of returning.png'],
  ['Ring of the elements', /ring of the elements/i, 'Ring of the elements.png'],
  ['Ring of shadows', /ring of shadows/i, 'Ring of shadows.png'],
  ['Camulet', /camulet/i, 'Camulet.png'],
  ['Ectophial', /ectophial/i, 'Ectophial.png'],
  ['Royal seed pod', /royal seed/i, 'Royal seed pod.png'],
  ["Drakan's medallion", /drakan's medallion/i, "Drakan's medallion.png"],
  ["Kharedst's memoirs", /kharedst's memoirs|book of the dead/i, "Kharedst's memoirs.png"],
  ['Teleport crystal', /teleport crystal/i, 'Teleport crystal.png'],
  ['Crystal teleport seed', /crystal teleport seed/i, 'Crystal teleport seed.png'],
  ['Icy basalt', /icy basalt/i, 'Icy basalt.png'],
  ['Stony basalt', /stony basalt/i, 'Stony basalt.png'],
  ["Pharaoh's sceptre", /pharaoh's sceptre/i, "Pharaoh's sceptre (uncharged).png"],
  ['Ardougne cloak', /ardougne cloak/i, 'Ardougne cloak 4.png'],
  ['Karamja gloves', /karamja gloves/i, 'Karamja gloves 4.png'],
  ['Desert amulet', /desert amulet/i, 'Desert amulet 4.png'],
  ['Fremennik sea boots', /fremennik sea boots/i, 'Fremennik sea boots 4.png'],
  ["Explorer's ring", /explorer's ring/i, "Explorer's ring 4.png"],
  ['Morytania legs', /morytania legs/i, 'Morytania legs 4.png'],
  ['Western banner', /western banner/i, 'Western banner 4.png'],
  ['Kandarin headgear', /kandarin headgear/i, 'Kandarin headgear 4.png'],
  ["Rada's blessing", /rada's blessing/i, "Rada's blessing 4.png"],
  ['Diary cape', /achievement diary cape/i, 'Achievement diary cape.png'],
  ['Minigame teleport', /minigame teleport/i, 'Grouping icon.png'],
  ['House portal', /house portal|portal nexus|portal chamber|player-owned house|\bPOH\b/i, 'Portal nexus icon.png'],
  ['Quetzal', /quetzal/i, TRANSPORT_ICON],
  ['Gnome glider', /gnome glider/i, TRANSPORT_ICON],
  ['Charter ship', /charter/i, TRANSPORT_ICON],
  ['Canoe', /canoe/i, TRANSPORT_ICON],
  ['Minecart', /minecart/i, TRANSPORT_ICON],
  ['Balloon', /balloon/i, TRANSPORT_ICON],
  ['Magic carpet', /magic carpet/i, TRANSPORT_ICON],
  ['Mushtree', /mushtree/i, TRANSPORT_ICON],
];
// "Kourend Castle Teleport" (spell) and "Taverley teleport tablet"
const SPELL = /\b((?:[A-Z][\w'-]+ ){1,3})(Teleport\b|teleport (?:tablet|tab)\b)/g;
const NOT_A_PLACE = /^(?:(?:Use|Using|Cast|Casting|The|A|An|Or|And|Via|With|Then|Alternatively|Players|Take|Taking|Several)\s+)+/;
// Not a destination, or a minigame teleport (already its own entry)
const SKIP_SPELL = /^(?:House|Respawn|Home|Lunar Home|Lumbridge Home)$|Minigame$/;
const FAIRY_CODE = /\b[A-D][I-L][P-S]\b/g;

/**
 * Teleports and transport named in Wiki "getting there" text, in the order the text mentions them
 * (the Wiki lists the fastest first). Each is { label, icon, fallback?, text: the sentence it came from, codes? (fairy ring) }.
 */
export function transportOptions(...texts) {
  const all = texts.filter(Boolean).join('\n');
  const out = new Map();
  for (const s of all.split(/(?<=[.!?])\s+|\n+/)) {
    const hits = [];
    for (const [label, re, icon] of TRANSPORTS) { const i = s.search(re); if (i >= 0) hits.push([i, { label, icon }]); }
    for (const m of s.matchAll(SPELL)) {
      const place = m[1].replace(NOT_A_PLACE, '').trim();
      if (!place || SKIP_SPELL.test(place)) continue;
      const spell = m[2] === 'Teleport';
      hits.push([m.index, { label: `${place} Teleport`, icon: spell ? `${place} Teleport.png` : `${place} teleport.png`, fallback: TRANSPORT_ICON }]);
    }
    for (const [, h] of hits.sort((a, b) => a[0] - b[0])) {
      const key = h.label.toLowerCase();
      if (!out.has(key)) out.set(key, { ...h, text: s.trim() });
    }
  }
  const ring = out.get('fairy ring');
  if (ring) ring.codes = [...new Set(all.match(FAIRY_CODE))];
  return [...out.values()];
}

export const ytSearch = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`osrs ${q} slayer guide`)}`;
