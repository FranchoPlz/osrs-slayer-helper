import { describe, expect, test } from 'bun:test';
import { imgUrl, itemOf, parseMasterPage } from '../src/lib/wikiparse.js';

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
