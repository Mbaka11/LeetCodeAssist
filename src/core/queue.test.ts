import { describe, expect, it } from 'vitest';
import { PROGRAM_QUEUE } from '../data/program';
import { POSTPONE_BEHIND, postponeInQueue, programQueue, queuePosition } from './queue';

describe('programQueue', () => {
  it('is the program queue unless the user reordered it', () => {
    expect(programQueue({})).toBe(PROGRAM_QUEUE);
    expect(queuePosition({}, 'two-sum')).toBe(PROGRAM_QUEUE.indexOf('two-sum') + 1);
    expect(queuePosition({}, 'contains-duplicate')).toBeNull();
  });

  it('uses the saved order, drops unknown slugs and appends problems the saved order misses', () => {
    const queue = programQueue({ queue: ['valid-anagram', 'not-a-problem', 'two-sum'] });
    expect(queue.slice(0, 2)).toEqual(['valid-anagram', 'two-sum']);
    expect(queue).not.toContain('not-a-problem');
    expect([...queue].sort()).toEqual([...PROGRAM_QUEUE].sort());
    expect(queuePosition({ queue: ['valid-anagram', 'two-sum'] }, 'two-sum')).toBe(2);
  });
});

describe('postponeInQueue', () => {
  const none = new Set<string>();

  it('puts the problem behind the next two unfinished ones', () => {
    expect(postponeInQueue(['a', 'b', 'c', 'd', 'e'], 'a', none)).toEqual(['b', 'c', 'a', 'd', 'e']);
    expect(POSTPONE_BEHIND).toBe(2);
  });

  it('does not count finished problems and never loses a problem', () => {
    const queue = ['x', 'a', 'done1', 'b', 'done2', 'c', 'd'];
    const result = postponeInQueue(queue, 'a', new Set(['x', 'done1', 'done2']));
    expect(result).toEqual(['x', 'done1', 'b', 'done2', 'c', 'a', 'd']);
    expect([...result].sort()).toEqual([...queue].sort());
  });

  it('goes to the end when fewer than two problems are left, and ignores unknown slugs', () => {
    expect(postponeInQueue(['a', 'b'], 'a', none)).toEqual(['b', 'a']);
    expect(postponeInQueue(['a'], 'a', none)).toEqual(['a']);
    expect(postponeInQueue(['a', 'b'], 'zzz', none)).toEqual(['a', 'b']);
  });
});
