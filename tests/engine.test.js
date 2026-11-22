import { describe, expect, test } from 'bun:test';
import sheet from '../public/data/sheet.json';
import wiki from '../public/data/wiki.json';
import { evaluateMaster, indexData, pointsPerTask, rankOffers } from '../src/lib/engine.js';

const data = indexData(sheet, wiki);
const SETTINGS = { goal: 'xp', slayerLevel: 99, blockSlots: 6, overrides: {}, ancients: true, cannon: true, bosses: true, slayerHelm: true };

describe('Mortimer', () => {
  const mort = data.master('Mortimer');
  const ev = evaluateMaster(data, 'Mortimer', SETTINGS);

  test('is loaded from the Wiki snapshot alongside the sheet masters', () => {
    expect(mort).toBeTruthy();
    expect(mort.tasks.length).toBeGreaterThan(20);
    expect(data.allTasks.find((t) => t.name === 'Venators')?.masters).toContain('Mortimer');
  });

  test('has 2 block slots and a 100 point skip, whatever the settings say', () => {
    expect(ev.summary.blockSlots).toBe(2);
    expect(ev.summary.skipCost).toBe(100);
    expect(ev.rows.filter((r) => r.action === 'Block').length).toBeLessThanOrEqual(2);
  });

  test('earns points only through the Points modifier (1 task in 5)', () => {
    const p = pointsPerTask(mort);
    const rated = mort.tasks.filter((t) => t.points?.[0] != null);
    const lo = Math.min(...rated.map((t) => t.points[0])) / 5;
    const hi = Math.max(...rated.map((t) => t.points[1])) / 5;
    expect(p).toBeGreaterThanOrEqual(lo);
    expect(p).toBeLessThanOrEqual(hi);
  });

  test('locks tasks above the Slayer level', () => {
    const low = evaluateMaster(data, 'Mortimer', { ...SETTINGS, slayerLevel: 80 });
    expect(low.rows.find((r) => r.task === 'Hydras').locked).toBeTruthy(); // 95 Slayer
    expect(low.rows.find((r) => r.task === 'Abyssal demons').locked).toBeTruthy(); // 85 Slayer
    expect(low.rows.find((r) => r.task === 'Gargoyles').locked).toBeFalsy(); // 75 Slayer
  });

  test('other masters keep their sheet rules', () => {
    const d = evaluateMaster(data, 'Duradel', SETTINGS);
    expect(d.summary.blockSlots).toBe(6);
    expect(d.summary.skipCost).toBe(30);
  });
});

describe('rankOffers', () => {
  const ev = evaluateMaster(data, 'Mortimer', SETTINGS);
  const scored = ev.rows.filter((r) => r.value != null && !r.locked).sort((a, b) => b.value - a.value);
  const best = scored[0], worst = scored[scored.length - 1];

  test('puts the better task first', () => {
    const r = rankOffers(ev, [{ task: worst.task, mod: null }, { task: best.task, mod: null }], 'xp');
    expect(r[0].task).toBe(best.task);
  });

  test('a big enough XP modifier can flip the order', () => {
    // Pick a pair within 20% so a +50% XP modifier on the weaker one must win
    const i = scored.findIndex((r, j) => j > 0 && r.value > scored[j - 1].value * 0.8 && r.value < scored[j - 1].value);
    const [a, b] = [scored[i - 1], scored[i]];
    const r = rankOffers(ev, [{ task: a.task, mod: null }, { task: b.task, mod: 'xp', value: 50 }], 'xp');
    expect(r[0].task).toBe(b.task);
    expect(r[0].score).toBeCloseTo(b.value * 1.5);
  });

  test('breaks near-ties by modifier: points before quantity', () => {
    const r = rankOffers(ev, [{ task: best.task, mod: 'quantity' }, { task: best.task, mod: 'points' }], 'xp');
    expect(r.map((o) => o.mod)).toEqual(['points', 'quantity']);
  });

  test('sorts tasks with no score last', () => {
    const r = rankOffers(ev, [{ task: 'Not a task', mod: null }, { task: worst.task, mod: null }], 'xp');
    expect(r[0].task).toBe(worst.task);
    expect(r[1].score).toBeNull();
  });
});
