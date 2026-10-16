import { describe, expect, it } from 'vitest';
import { CATEGORY_NAMES, PROBLEMS_BY_SLUG } from './neetcode150';
import {
  BENCHMARKS,
  CONSOLIDATION_DAYS,
  DAY_SKELETON,
  PROGRAM_QUEUE,
  benchmarkForDay,
  expectedNewDone,
} from './program';

describe('PROGRAM_QUEUE', () => {
  it('has about 53 unique problems that all exist in the NeetCode 150', () => {
    expect(PROGRAM_QUEUE).toHaveLength(53);
    expect(new Set(PROGRAM_QUEUE).size).toBe(PROGRAM_QUEUE.length);
    for (const slug of PROGRAM_QUEUE) {
      expect(PROBLEMS_BY_SLUG.has(slug), slug).toBe(true);
    }
  });

  it('is mostly Easy/Medium with at most 2 Hard, both at the end', () => {
    const difficulties = PROGRAM_QUEUE.map((slug) => PROBLEMS_BY_SLUG.get(slug)!.difficulty);
    const hardIndexes = difficulties.flatMap((d, i) => (d === 'Hard' ? [i] : []));
    expect(hardIndexes.length).toBeLessThanOrEqual(2);
    for (const index of hardIndexes) {
      expect(index).toBeGreaterThanOrEqual(PROGRAM_QUEUE.length - 3);
    }
  });

  it('follows the roadmap category order for the first 36 problems', () => {
    const categoryIndex = (slug: string) =>
      CATEGORY_NAMES.indexOf(PROBLEMS_BY_SLUG.get(slug)!.category as (typeof CATEGORY_NAMES)[number]);
    const indexes = PROGRAM_QUEUE.slice(0, 36).map(categoryIndex);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });
});

describe('BENCHMARKS', () => {
  it('reserves one Easy and one Medium unseen problem for days 1, 15 and 30', () => {
    expect(BENCHMARKS.map((b) => b.day)).toEqual([1, 15, 30]);
    for (const benchmark of BENCHMARKS) {
      expect(PROBLEMS_BY_SLUG.get(benchmark.easy)?.difficulty).toBe('Easy');
      expect(PROBLEMS_BY_SLUG.get(benchmark.medium)?.difficulty).toBe('Medium');
    }
    expect(benchmarkForDay(15)?.easy).toBe('balanced-binary-tree');
    expect(benchmarkForDay(2)).toBeUndefined();
  });

  it('never overlaps with the queue and has no duplicates', () => {
    const slugs = BENCHMARKS.flatMap((b) => [b.easy, b.medium]);
    expect(new Set(slugs).size).toBe(6);
    for (const slug of slugs) {
      expect(PROGRAM_QUEUE).not.toContain(slug);
    }
  });
});

describe('DAY_SKELETON', () => {
  it('covers days 1-30 with consolidation and benchmark flags', () => {
    expect(DAY_SKELETON.map((d) => d.day)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(DAY_SKELETON.filter((d) => d.consolidation).map((d) => d.day)).toEqual([
      ...CONSOLIDATION_DAYS,
    ]);
    expect(DAY_SKELETON.filter((d) => d.benchmark).map((d) => d.day)).toEqual([1, 15, 30]);
    for (const day of DAY_SKELETON) {
      if (day.consolidation) expect(day.focus).toEqual([]);
      else expect(day.focus.length).toBeGreaterThan(0);
    }
  });

  it('matches the weekly themes', () => {
    const focus = (from: number, to: number) =>
      new Set(DAY_SKELETON.filter((d) => d.day >= from && d.day <= to).flatMap((d) => d.focus));
    expect(focus(1, 7)).toEqual(
      new Set(['Arrays & Hashing', 'Two Pointers', 'Sliding Window', 'Stack']),
    );
    expect(focus(8, 14)).toEqual(new Set(['Binary Search', 'Linked List', 'Trees']));
    expect(focus(15, 21)).toEqual(
      new Set(['Heap / Priority Queue', 'Backtracking', 'Graphs', 'Intervals']),
    );
  });
});

describe('expectedNewDone', () => {
  it('counts 2 per non-consolidation day, capped by the queue', () => {
    expect(expectedNewDone(0)).toBe(0);
    expect(expectedNewDone(1)).toBe(2);
    expect(expectedNewDone(6)).toBe(12);
    expect(expectedNewDone(7)).toBe(12);
    expect(expectedNewDone(8)).toBe(14);
    expect(expectedNewDone(30)).toBe(52);
    expect(expectedNewDone(60)).toBe(52);
    expect(expectedNewDone(30, 10)).toBe(10);
  });
});
