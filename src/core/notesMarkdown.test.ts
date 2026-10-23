import { describe, expect, it } from 'vitest';
import { notesMarkdown } from './notesMarkdown';
import { defaultState } from './state';

describe('notesMarkdown', () => {
  it('handles no saved notes', () => {
    expect(notesMarkdown(defaultState('2025-01-01'))).toBe('# LeetCode Assist notes\n\nNo notes saved yet.\n');
  });
  it('exports all note fields with catalog facts, safely fences code and preserves unknown legacy slugs', () => {
    const note = { slug: 'two-sum', trigger: 'a *cue*', principle: 'Remember\nfrom memory', pitfall: '<tag>', complexity: 'O(n)', code: 'print("````")\n# own snippet', updatedAt: '2025-01-01' };
    const state = { notes: { 'two-sum': note, 'retired-problem': { ...note, slug: 'retired-problem', code: undefined } } };
    const before = structuredClone(state);
    const output = notesMarkdown(state);
    expect(output).toContain('## Two Sum\n\nCategory: Arrays & Hashing  \nDifficulty: Easy');
    expect(output).toContain('### Trigger\n\na \\*cue\\*');
    expect(output).toContain('### Principle\n\nRemember\nfrom memory');
    expect(output).toContain('### Pitfall\n\n\\<tag\\>');
    expect(output).toContain('### Complexity\n\nO(n)');
    expect(output).toContain('`````python\nprint("````")\n# own snippet\n`````');
    expect(output).toContain('## retired-problem\n\nCategory: Unknown  \nDifficulty: Unknown');
    expect(output).toContain('### Code\n\n(empty)');
    expect(state).toEqual(before);
  });
});
