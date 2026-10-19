import { describe, expect, it } from 'vitest';
import { createActivity } from '../core/activities';
import { groupActivities } from './groupActivities';

const make = (slug: string, type: 'recall' | 'resolve', id: string) => ({
  activity: { ...createActivity([], { slug, type, dueDate: '2025-01-06', createdAt: '2025-01-06' }), id },
  variant: type === 'resolve' ? 'carried' : 'planned',
});

describe('groupActivities presentation', () => {
  it('groups by slug without merging attempts or changing first-problem priority', () => {
    const a = make('two-sum', 'recall', 'a');
    const b = make('valid-anagram', 'recall', 'b');
    const c = make('two-sum', 'resolve', 'c');
    const d = make('two-sum', 'resolve', 'd');
    const items = [a, b, c, d];
    const before = structuredClone(items);
    const groups = groupActivities(items);
    expect(groups.map((g) => g.slug)).toEqual(['two-sum', 'valid-anagram']);
    expect(groups[0]!.items).toEqual([a, c, d]);
    expect(groups[0]!.items[1]).toBe(c);
    expect(groups[0]!.items[1]!.variant).toBe('carried');
    expect(items).toEqual(before);
  });

  it('orders attempts by existing history without sorting or mutating the input plan', () => {
    const a = make('two-sum', 'recall', 'a');
    const b = make('two-sum', 'resolve', 'b');
    const c = make('two-sum', 'resolve', 'virtual');
    const input = [b, c, a];
    expect(groupActivities(input, [a.activity, b.activity])[0]!.items).toEqual([a, b, c]);
    expect(input).toEqual([b, c, a]);
  });

  it('handles an empty plan', () => expect(groupActivities([])).toEqual([]));
});
