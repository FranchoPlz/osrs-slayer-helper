import { describe, expect, test } from 'bun:test';
import { imgUrl, itemOf, mapTiles, parseInventory, parseMasterPage, parseRecommendedEquipment, parseSlayerEquipment, placeEntrance } from '../src/lib/wikiparse.js';
import { bringItems, recommendStyle, transportOptions } from '../src/lib/advice.js';

const MASTER_TABLE = `{| class="wikitable sortable" style="text-align:center;"
!Monster
!Amount
!Extended amount
![[Task weight|Weight]]
!Unlock Requirement
!Quantity Modifier
!Points Modifier
!Clue Scroll Modifier
!Clues Dropped
!XP% Modifier
!|Superior Unique% Modifier
|-
|[[Slayer task/Wyrms|Wyrms]]
|80-120
|200-250
|{{+=|weight|10|echo=2}}
|{{SCP|Slayer|62}}
|50-100
|25-40
|75%-150%
|{{ilink|Clue scroll (hard)|txt=Hard clues|pic=Clue_scroll_(hard)}}
|35%-75%
|35%-75%
|-
|[[Slayer task/Hydras|Hydras]]
|150-200
|{{NA}}
|{{+=|weight|8|echo=2}}
|{{SCP|Slayer|95}}
|50-100
|15-30
|75%-150%
|{{ilink|Clue scroll (elite)|txt=Elite clues|pic=Clue_scroll_(elite)}}
|10%-30%
|75%-150%
|-
!colspan="3"|Total [[task weight]]
!{{#var:weight}}
!colspan="7"|
|}`;

describe('parseMasterPage', () => {
  const tasks = parseMasterPage(`Intro text\n${MASTER_TABLE}\nOutro`);

  test('reads one row per task with amounts, weight and Slayer requirement', () => {
    expect(tasks.map((t) => t.task)).toEqual(['Wyrms', 'Hydras']);
    expect(tasks[0]).toMatchObject({ page: 'Slayer task/Wyrms', min: 80, max: 120, eMin: 200, eMax: 250, weight: 10, slayerReq: 62 });
    expect(tasks[1]).toMatchObject({ weight: 8, slayerReq: 95, eMin: null, eMax: null });
  });

  test('reads the points and XP modifier ranges', () => {
    expect(tasks[0].points).toEqual([25, 40]);
    expect(tasks[0].xpMod).toEqual([35, 75]);
    expect(tasks[1].xpMod).toEqual([10, 30]);
  });

  test('ignores tables without a Monster/Weight header', () => {
    expect(parseMasterPage('{| class="wikitable"\n!Tasks Completed\n!Modifier\n|-\n|10\n|Points\n|}')).toEqual([]);
  });
});

describe('itemOf', () => {
  test('uses the plink pic when given', () => {
    expect(itemOf("{{plink|Slayer helmet (i)|pic=Black mask (i)}}")).toEqual({ name: 'Slayer helmet (i)', icon: 'Black mask (i).png' });
  });

  test('falls back to the plink page, then a plain link', () => {
    expect(itemOf('{{plinkp|abyssal whip}}').icon).toBe('Abyssal whip.png');
    expect(itemOf('[[Dragon defender#Uncharged|Dragon defender]]').icon).toBe('Dragon defender.png');
  });

  test('keeps every alternative in the name but takes the first item icon', () => {
    const it = itemOf('{{plink|Amulet of fury}} / {{plink|Amulet of glory}}');
    expect(it.icon).toBe('Amulet of fury.png');
    expect(it.name).toContain('Amulet of glory');
  });
});

describe('imgUrl', () => {
  test('serves small images at their original size', () => {
    expect(imgUrl({ file: 'Abyssal demon.png', w: 80 }, 224)).toBe('https://oldschool.runescape.wiki/images/Abyssal_demon.png');
  });

  test('thumbnails images wider than the requested width', () => {
    expect(imgUrl({ file: 'Cerberus.png', w: 600 }, 224)).toBe('https://oldschool.runescape.wiki/images/thumb/Cerberus.png/224px-Cerberus.png');
  });

  test('never thumbnails when the original width is unknown (the Wiki returns nothing for oversized thumbs)', () => {
    expect(imgUrl('Slayer icon.png', 32)).toBe('https://oldschool.runescape.wiki/images/Slayer_icon.png');
  });

  test('escapes special characters in file names', () => {
    expect(imgUrl("Kree'arra.png")).toBe("https://oldschool.runescape.wiki/images/Kree'arra.png");
    expect(imgUrl('Protect from Melee (1).png')).toContain('Protect_from_Melee_(1).png');
    expect(imgUrl(null)).toBeNull();
  });
});

describe('mapTiles', () => {
  test('lays tiles out like the Wiki does (Brimhaven Dungeon map: 250px, zoom 0, centred on 2752,3109)', () => {
    const tiles = mapTiles({ x: 2752, y: 3109, mapID: 0, plane: 0 }, 'v1', 0, 250, 250);
    const at = (name) => tiles.find((t) => t.src.endsWith(name));
    expect(tiles).toHaveLength(4);
    expect(at('/0/0/0_10_12.png')).toMatchObject({ left: -67, top: -94 });
    expect(at('/0/0/0_11_11.png')).toMatchObject({ left: 189, top: 162 });
  });

  test('uses the map id, zoom and plane of the spot', () => {
    expect(mapTiles({ x: 2704, y: 9431, mapID: 46, plane: 1 }, 'v1', 2, 1, 1)[0].src)
      .toBe('https://maps.runescape.wiki/osrs/versions/v1/tiles/rendered/46/2/1_42_147.png');
  });
});

describe('placeEntrance', () => {
  test('takes the surface spot from the infobox map', () => {
    expect(placeEntrance('{{Infobox Location\n|name = Slayer Tower\n|map = {{Map|name=Slayer Tower|3429,3555|plane=0|mapID=0}}\n}}'))
      .toEqual({ mapID: 0, plane: 0, x: 3429, y: 3555 });
  });

  test('prefers the pin titled as the entrance, and skips dungeon maps', () => {
    const wt = `{{Infobox Location|map = [[File:Catacombs map.png]]}}
{{Map|1650,10000|mapID=0}}
{{Map|mtype=pin|caption=Entrances
|x:1696,y:3865,title:[[Greater demon]]s
|x:1639,y:3674,title:Main Entrance - Statue
}}`;
    expect(placeEntrance(wt)).toEqual({ mapID: 0, plane: 0, x: 1639, y: 3674 });
    expect(placeEntrance('{{Map|2704,9431|mapID=46}}')).toBeNull();
  });
});

describe('transportOptions', () => {
  test('lists teleports in the order the Wiki mentions them, with fairy ring codes', () => {
    const r = transportOptions(
      "The fastest way is Xeric's talisman, or the Kourend Castle Teleport spell.\n\n• Use a Taverley teleport tablet.\n• Fairy ring code fairy ring CIS, then fairy ring DJR.",
    );
    expect(r.map((x) => x.label)).toEqual(["Xeric's talisman", 'Kourend Castle Teleport', 'Taverley Teleport', 'Fairy ring']);
    expect(r[2]).toMatchObject({ icon: 'Taverley teleport.png', text: '• Use a Taverley teleport tablet.' });
    expect(r[3].codes).toEqual(['CIS', 'DJR']);
  });

  test('does not turn minigame or home teleports into destinations', () => {
    const r = transportOptions('Use the Soul Wars Minigame Teleport or the Lumbridge Home Teleport.');
    expect(r.map((x) => x.label)).toEqual(['Minigame teleport']);
  });
});

describe('gear and inventory', () => {
  test('names gear sets after their <tabber> tab, else their style', () => {
    const wt = '<tabber>\n|-|\nMelee=\n{{Recommended equipment\n|style = Melee\n|head1 = {{plink|Slayer helmet (i)}}\n}}\n|-|\nMelee (Hallowfell)=\n{{Recommended equipment\n|style = Melee\n|weapon1 = {{plink|Hallowfell}}\n}}\n</tabber>\n{{Recommended equipment\n|style = Ranged\n|ammo1 = {{plink|Amethyst arrow}}\n}}';
    expect(parseRecommendedEquipment(wt).map((s) => s.style)).toEqual(['Melee', 'Melee (Hallowfell)', 'Ranged']);
  });

  test('reads {{Inventory}} slots, counting repeats and quantities, skipping templates', () => {
    const wt = '{{Inventory|align=right\n|1= Prayer potion(4)\n|2= Prayer potion(4)\n|3= {{Cheap food}}\n|10= Fire rune\\1000\n|27= Rock hammer\n}}';
    expect(parseInventory(wt)).toEqual([
      { name: 'Prayer potion(4)', icon: 'Prayer potion(4).png', count: 2 },
      { name: 'Fire rune', icon: 'Fire rune.png', count: 1000 },
      { name: 'Rock hammer', icon: 'Rock hammer.png', count: 1 },
    ]);
  });

  const TABLE = parseSlayerEquipment(`{| class="wikitable"
! {{SCP|Slayer}} Level
! colspan="2" | Item
! Cost
! class="unsortable" | Use(s)
|-
| 75
| {{plinkt|Rock hammer}}
| 500 coins
| Finishing off [[Gargoyle]]s
|-
| 75
| {{plinkt|Rock thrownhammer}}
| 200 coins
| Finishing off [[Gargoyle]]s (one per gargoyle)
|-
| 10
| {{plinkt|Facemask}}
| 200 coins
|
* Protecting against the [[Smoke Dungeon]], and [[Dust devil]]s
|-
| 44
| {{plinkt|Boots of stone}}
| 200 coins
| Protecting from the heat of the [[Karuulm Slayer Dungeon]]
|}`);

  test('brings the Slayer equipment a task needs, alternatives merged, plus items the text names', () => {
    expect(bringItems(TABLE, ['Gargoyles'], ['Bring a salve amulet'])).toEqual([
      { name: 'Rock hammer / Rock thrownhammer', icon: 'Rock hammer.png', coveredByHelm: false, for: 'Gargoyle' },
      { name: 'Salve amulet', icon: 'Salve amulet(ei).png', coveredByHelm: false },
    ]);
    expect(bringItems(TABLE, ['Dust devils'], ['wear a facemask'])).toEqual([{ name: 'Facemask', icon: 'Facemask.png', coveredByHelm: true, for: 'Dust devil' }]);
    expect(bringItems(TABLE, ['Wyrms', 'Karuulm Slayer Dungeon'], []).map((i) => i.name)).toEqual(['Boots of stone']);
    expect(bringItems(TABLE, ['Wyrms', 'Wyrmscraig'], [])).toEqual([]);
  });

  test('recommends the style the method names, else a clearly lowest defence, else melee', () => {
    const demon = { defences: { Stab: 20, Slash: 20, Crush: 20, Magic: 0, Ranged: 20 } };
    expect(recommendStyle('Abyssal Demon (Catacombs -- Melee)', demon).style).toBe('melee');
    expect(recommendStyle('Abyssal Demon (Slayer Tower)', demon).style).toBe('magic');
    expect(recommendStyle('Magic Axe', { defences: { Stab: 0, Slash: 0, Crush: 0, Magic: 0, Ranged: 0 } }).style).toBe('melee');
    expect(recommendStyle('Hydra (Karuulm)', { defences: { Stab: 160, Slash: 160, Crush: 160, Magic: 160, Ranged: 0 } }).style).toBe('ranged');
  });
});
