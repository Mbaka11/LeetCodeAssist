import { describe, expect, it } from 'vitest';
import { suggestedOutcome } from './activities';

describe('suggestedOutcome', () => {
  it('pre-selects "hint" as soon as a hint was revealed', () => {
    expect(suggestedOutcome(1)).toBe('hint');
    expect(suggestedOutcome(2)).toBe('hint');
    expect(suggestedOutcome(3)).toBe('hint');
  });

  it('suggests nothing without hints', () => {
    expect(suggestedOutcome(undefined)).toBeNull();
    expect(suggestedOutcome(0)).toBeNull();
  });
});
