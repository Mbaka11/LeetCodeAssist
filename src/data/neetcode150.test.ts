import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  CATEGORY_NAMES,
  NEETCODE_150,
  PROBLEMS_BY_SLUG,
  getProblem,
  problemsInCategory,
} from './neetcode150';

const EXPECTED_COUNTS = [9, 5, 6, 7, 7, 11, 15, 7, 9, 3, 13, 6, 12, 11, 8, 6, 8, 7];

describe('NEETCODE_150', () => {
  it('has 150 problems with unique slugs', () => {
    expect(NEETCODE_150).toHaveLength(150);
    expect(new Set(NEETCODE_150.map((p) => p.slug)).size).toBe(150);
    expect(PROBLEMS_BY_SLUG.size).toBe(150);
  });

  it('has the expected number of problems per category, in roadmap order', () => {
    expect(CATEGORY_NAMES).toHaveLength(EXPECTED_COUNTS.length);
    CATEGORY_NAMES.forEach((name, i) => {
      expect(problemsInCategory(name), name).toHaveLength(EXPECTED_COUNTS[i]!);
    });
  });

  it('numbers problems 1..150 in list order and builds LeetCode URLs', () => {
    NEETCODE_150.forEach((problem, i) => {
      expect(problem.neetcodeOrder).toBe(i + 1);
      expect(problem.url).toBe(`https://leetcode.com/problems/${problem.slug}/`);
      expect(problem.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(problem.title.length).toBeGreaterThan(0);
    });
    expect(getProblem('two-sum')?.difficulty).toBe('Easy');
    expect(getProblem('does-not-exist')).toBeUndefined();
  });

  it('only uses valid difficulties', () => {
    for (const problem of NEETCODE_150) {
      expect(['Easy', 'Medium', 'Hard']).toContain(problem.difficulty);
    }
  });
});

describe('CATEGORIES', () => {
  it('lists every category once in roadmap order', () => {
    expect(CATEGORIES.map((c) => c.name)).toEqual([...CATEGORY_NAMES]);
  });

  it('only references known prerequisites and has no cycles', () => {
    const names = new Set<string>(CATEGORY_NAMES);
    const prereqs = new Map(
      CATEGORIES.map((c) => [c.name as string, c.prerequisites as readonly string[]]),
    );
    for (const category of CATEGORIES) {
      for (const prerequisite of category.prerequisites) {
        expect(names.has(prerequisite)).toBe(true);
        expect(prerequisite).not.toBe(category.name);
      }
    }
    const visiting = new Set<string>();
    const done = new Set<string>();
    const visit = (name: string): void => {
      expect(visiting.has(name), `cycle at ${name}`).toBe(false);
      if (done.has(name)) return;
      visiting.add(name);
      for (const next of prereqs.get(name) ?? []) visit(next);
      visiting.delete(name);
      done.add(name);
    };
    for (const name of names) visit(name);
  });

  it('has a single root: Arrays & Hashing', () => {
    const roots = CATEGORIES.filter((c) => c.prerequisites.length === 0).map((c) => c.name);
    expect(roots).toEqual(['Arrays & Hashing']);
  });
});
