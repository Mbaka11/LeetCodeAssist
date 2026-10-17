import { describe, expect, it } from 'vitest';
import { BONUS_POOL } from '../data/bonus';
import { CATEGORY_NAMES, type CategoryName } from '../data/neetcode150';
import {
  BONUS_SLOTS,
  introducedCategories,
  isCategoryReady,
  nextPrerequisite,
  openBonusOffers,
  selectBonusSlugs,
} from './bonus';
import { createActivity } from './activities';
import { complete, day, newState } from './testing';
import type { AppState } from './types';

const NONE: ReadonlySet<string> = new Set();

function workedState(...slugs: string[]): AppState {
  let state = newState();
  for (const slug of slugs) {
    const activity = createActivity(state.activities, { type: 'new', slug, dueDate: day(1), createdAt: day(1) });
    state = { ...state, activities: [...state.activities, activity] };
    state = complete(state, activity.id, 'solo', day(1), 20);
  }
  return state;
}

describe('categories: introduced and prerequisite-ready', () => {
  it('introduces the categories of completed activities and of today\'s core work', () => {
    const state = workedState('two-sum', 'valid-palindrome');
    expect([...introducedCategories(state, ['binary-search'])].sort()).toEqual(
      ['Arrays & Hashing', 'Binary Search', 'Two Pointers'].sort(),
    );
    expect(introducedCategories(newState(), []).size).toBe(0);
  });

  it('makes a category ready when it is introduced or all its prerequisites are', () => {
    const introduced = new Set<CategoryName>(['Arrays & Hashing']);
    expect(isCategoryReady('Arrays & Hashing', introduced)).toBe(true);
    expect(isCategoryReady('Two Pointers', introduced)).toBe(true);
    expect(isCategoryReady('Stack', introduced)).toBe(true);
    expect(isCategoryReady('Sliding Window', introduced)).toBe(false);
    expect(isCategoryReady('Graphs', introduced)).toBe(false);
    expect(isCategoryReady('1-D Dynamic Programming', introduced)).toBe(false);
    expect(isCategoryReady('Trees', new Set<CategoryName>(['Binary Search']))).toBe(false); // needs Linked List too
    expect(isCategoryReady('Trees', new Set<CategoryName>(['Binary Search', 'Linked List']))).toBe(true);
    expect(isCategoryReady('Math & Geometry', new Set<CategoryName>(['Math & Geometry']))).toBe(true);
  });

  it('names the earliest category to start so that a locked one becomes ready', () => {
    const arrays = new Set<CategoryName>(['Arrays & Hashing']);
    expect(nextPrerequisite('Two Pointers', arrays)).toBeNull();
    expect(nextPrerequisite('Sliding Window', arrays)).toBe('Two Pointers');
    expect(nextPrerequisite('Graphs', arrays)).toBe('Two Pointers');
    const throughTrees = new Set<CategoryName>(['Arrays & Hashing', 'Two Pointers', 'Binary Search', 'Linked List', 'Trees']);
    expect(nextPrerequisite('Graphs', throughTrees)).toBe('Backtracking');
    expect(nextPrerequisite('Advanced Graphs', throughTrees)).toBe('Backtracking'); // Graphs comes first
    expect(nextPrerequisite('Greedy', throughTrees)).toBe('Heap / Priority Queue');
  });

  it('every category is reachable from Arrays & Hashing through prerequisites', () => {
    const introduced = new Set<CategoryName>(['Arrays & Hashing']);
    for (let guard = 0; guard < CATEGORY_NAMES.length; guard += 1) {
      for (const name of CATEGORY_NAMES) if (isCategoryReady(name, introduced)) introduced.add(name);
    }
    expect([...introduced].sort()).toEqual([...CATEGORY_NAMES].sort());
  });
});

describe('selectBonusSlugs', () => {
  it('takes the first ready pool problems in pool order', () => {
    const selection = selectBonusSlugs(newState(), { pool: BONUS_POOL, count: BONUS_SLOTS, coreSlugs: ['two-sum'], exclude: NONE });
    expect(selection).toEqual({ slugs: [BONUS_POOL[0], BONUS_POOL[1]], hold: null });
  });

  it('skips excluded and already worked problems and never repeats them', () => {
    const state = workedState('valid-sudoku');
    const selection = selectBonusSlugs(state, {
      pool: BONUS_POOL,
      count: 2,
      coreSlugs: [],
      exclude: new Set(['container-with-most-water']),
    });
    expect(selection.slugs).toEqual(['generate-parentheses', 'evaluate-reverse-polish-notation']);
  });

  it('puts a skipped problem behind the ones that were never skipped, without dropping it', () => {
    let state = newState();
    const skipped = createActivity(state.activities, { type: 'new', slug: 'valid-sudoku', dueDate: day(1), createdAt: day(1) });
    state = { ...state, activities: [{ ...skipped, status: 'skipped' }] };
    const pool = ['valid-sudoku', 'container-with-most-water', 'generate-parentheses'];
    expect(selectBonusSlugs(state, { pool, count: 2, coreSlugs: ['two-sum'], exclude: NONE }).slugs).toEqual([
      'container-with-most-water',
      'generate-parentheses',
    ]);
    expect(selectBonusSlugs(state, { pool, count: 3, coreSlugs: ['two-sum'], exclude: NONE }).slugs).toEqual([
      'container-with-most-water',
      'generate-parentheses',
      'valid-sudoku',
    ]);
  });

  it('explains a shortfall: locked with the next prerequisite, or exhausted', () => {
    const locked = selectBonusSlugs(newState(), { pool: ['word-search'], count: 2, coreSlugs: ['two-sum'], exclude: NONE });
    expect(locked.slugs).toEqual([]);
    expect(locked.hold).toMatchObject({ reason: 'locked', category: 'Backtracking', nextPrerequisite: 'Two Pointers' });
    const exhausted = selectBonusSlugs(workedState('valid-sudoku'), { pool: ['valid-sudoku'], count: 2, coreSlugs: [], exclude: NONE });
    expect(exhausted.hold).toMatchObject({ reason: 'exhausted' });
    expect(selectBonusSlugs(newState(), { pool: BONUS_POOL, count: 0, coreSlugs: [], exclude: NONE })).toEqual({ slugs: [], hold: null });
  });

  it('unlocks later categories as earlier ones are introduced', () => {
    const state = workedState('two-sum', 'valid-palindrome', 'binary-search', 'reverse-linked-list');
    const trees = ['count-good-nodes-in-binary-tree', 'task-scheduler'];
    expect(selectBonusSlugs(state, { pool: trees, count: 2, coreSlugs: [], exclude: NONE }).slugs).toEqual([
      'count-good-nodes-in-binary-tree',
    ]); // Trees is ready, Heap / Priority Queue still waits for Trees
    const withTrees = workedState('two-sum', 'valid-palindrome', 'binary-search', 'reverse-linked-list', 'invert-binary-tree');
    expect(selectBonusSlugs(withTrees, { pool: trees, count: 2, coreSlugs: [], exclude: NONE }).slugs).toEqual(trees);
  });
});

describe('openBonusOffers', () => {
  it('returns started offers always and planned ones once per problem, up to the slots', () => {
    let state = newState();
    const add = (type: 'new', slug: string, due: string, status: 'planned' | 'in_progress' | 'skipped'): void => {
      state = { ...state, activities: [...state.activities, { ...createActivity(state.activities, { type, slug, dueDate: due, createdAt: due }), status }] };
    };
    add('new', 'valid-sudoku', day(1), 'planned');
    add('new', 'valid-sudoku', day(2), 'planned');
    add('new', 'container-with-most-water', day(2), 'skipped');
    add('new', 'generate-parentheses', day(2), 'planned');
    add('new', 'car-fleet', day(3), 'in_progress');
    const pool = new Set(BONUS_POOL);
    expect(openBonusOffers(state, pool, 2).map((a) => a.slug)).toEqual(['valid-sudoku', 'car-fleet']);
    expect(openBonusOffers(state, pool, 3).map((a) => a.slug)).toEqual(['valid-sudoku', 'generate-parentheses', 'car-fleet']);
    expect(openBonusOffers(state, pool, 0).map((a) => a.slug)).toEqual(['car-fleet']);
  });
});
