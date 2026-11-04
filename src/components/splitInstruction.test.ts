import { describe, expect, it } from 'vitest';
import { ACTIVITY_INSTRUCTIONS } from '../lib/instructions';
import { splitInstruction } from './ActivityCard';

describe('splitInstruction', () => {
  it('keeps the gist of each instruction visible and the rest behind "more"', () => {
    expect(splitInstruction(ACTIVITY_INSTRUCTIONS.recall)[0]).toBe('Retrieval only, no editor and no code.');
    expect(splitInstruction(ACTIVITY_INSTRUCTIONS.new)[0]).toBe('Search, code, understand, write notes.');
    expect(splitInstruction(ACTIVITY_INSTRUCTIONS.resolve)[0]).toBe('Interview conditions.');
    for (const text of Object.values(ACTIVITY_INSTRUCTIONS)) {
      const [head, rest] = splitInstruction(text);
      expect(head.length).toBeLessThanOrEqual(81);
      // Nothing is lost: the two parts hold every word of the instruction.
      expect(`${head} ${rest}`.replace(/[.:]/g, '').replace(/\s+/g, ' ').trim()).toBe(text.replace(/[.:]/g, '').replace(/\s+/g, ' ').trim());
    }
  });

  it('returns short instructions whole', () => {
    expect(splitInstruction('Targeted redo of a review you failed yesterday.')).toEqual(['Targeted redo of a review you failed yesterday.', '']);
  });
});
