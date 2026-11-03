import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { complete, day, newState, simulateDay } from '../core/testing';
import { createActivity } from '../core/activities';
import type { AppState } from '../core/types';
import { RetrospectiveCards } from './RetrospectiveCard';

function run(days: number): AppState {
  let state = newState();
  for (let d = 1; d <= days; d += 1) state = simulateDay(state, day(d)).state;
  return state;
}

const render = (state: AppState, date: string): string => renderToStaticMarkup(<RetrospectiveCards state={state} today={date} />);

describe('RetrospectiveCards', () => {
  it('renders nothing before the last week of a phase', () => {
    expect(render(newState(), day(10))).toBe('');
  });

  it('shows the Day 30 card as locked with its opening date during the last week', () => {
    const html = render(run(22), day(23));
    expect(html).toContain('Day 30 retrospective');
    expect(html).toContain('Opens on');
    expect(html).not.toContain('Problems learned');
  });

  it('shows the Day 30 numbers, reviews and benchmark pairs once day 30 is reached', () => {
    const html = render(run(30), day(30));
    expect(html).toContain('Day 30 retrospective');
    expect(html).toContain('Problems learned');
    expect(html).toContain('50 of 50');
    expect(html).toContain('Reviews by type');
    expect(html).toContain('Re-solve');
    expect(html).toContain('Benchmark pairs');
    expect(html).toContain('Contains Duplicate');
    expect(html).toContain('No category has three or more attempts');
    expect(html).not.toContain('Day 60 retrospective');
  });

  it('adds the Day 60 card with the day 45 and 60 pairs after day 60', () => {
    const html = render(run(60), day(60));
    expect(html).toContain('Day 30 retrospective');
    expect(html).toContain('Day 60 retrospective');
    expect(html).toContain('Palindrome Partitioning');
    expect(html).toContain('Word Ladder');
  });

  it('names a weak category and what needed help', () => {
    let state = newState();
    for (const [i, outcome] of (['solo', 'hint', 'stuck', 'solution'] as const).entries()) {
      const slug = ['valid-parentheses', 'min-stack', 'daily-temperatures', 'valid-parentheses'][i]!;
      const activity = createActivity(state.activities, { type: i === 0 ? 'new' : 'recall', slug, dueDate: day(2 + i), createdAt: day(2 + i) });
      state = complete({ ...state, activities: [...state.activities, activity] }, activity.id, outcome, day(2 + i), 20);
    }
    const html = render(state, day(31));
    expect(html).toContain('Weakest categories');
    expect(html).toContain('Stack');
    expect(html).toContain('3 of 4 attempts needed help (75%)');
  });
});
