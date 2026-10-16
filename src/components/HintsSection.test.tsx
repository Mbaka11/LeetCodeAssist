import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createActivity } from '../core/activities';
import type { Activity } from '../core/types';
import { getHints } from '../data/hints';
import type { AppActions } from '../lib/actions';
import { HintsSection } from './HintsSection';

const actions = new Proxy({}, { get: () => () => Promise.resolve() }) as AppActions;
const SLUG = 'two-sum';

function activity(hintsUsed?: number): Activity {
  return {
    ...createActivity([], { type: 'new', slug: SLUG, dueDate: '2025-01-06', createdAt: '2025-01-06' }),
    ...(hintsUsed !== undefined ? { hintsUsed } : {}),
  };
}

function render(slug: string, a?: Activity): string {
  return renderToStaticMarkup(<HintsSection slug={slug} activity={a} actions={actions} />);
}

describe('HintsSection', () => {
  it('shows three progressive reveal buttons and no hint text at first', () => {
    const html = render(SLUG, activity());
    expect(html).toContain('Reveal hint 1');
    expect(html).toContain('Reveal hint 2');
    expect(html).toContain('Reveal hint 3');
    // Only the next hint can be revealed.
    expect(html.match(/<button[^>]*disabled=""[^>]*>Reveal hint \d</g)).toHaveLength(2);
    expect(html).not.toContain('Hint 1 ·');
    expect(html).toContain('pre-selects');
  });

  it('shows the revealed hints from the activity and offers the next one', () => {
    const hints = getHints(SLUG)!;
    const html = render(SLUG, activity(2));
    expect(html).toContain('Hint 1 · Nudge');
    expect(html).toContain('Hint 2 · Insight');
    expect(html).not.toContain('Hint 3 · Sketch');
    expect(html).toContain(hints.nudge.slice(0, 20));
    expect(html).not.toContain('Reveal hint 1');
    expect(html).not.toContain('Reveal hint 2');
    expect(html).toContain('Reveal hint 3');
    expect(html).not.toMatch(/disabled=""[^>]*>Reveal hint 3/);
  });

  it('shows everything and no buttons once all three are revealed', () => {
    const html = render(SLUG, activity(3));
    expect(html).toContain('Hint 3 · Sketch');
    expect(html).not.toContain('Reveal hint');
  });

  it('says hints are not recorded when no attempt is open', () => {
    const html = render(SLUG);
    expect(html).toContain('not recorded');
    expect(html).toContain('Reveal hint 1');
  });

  it('renders nothing for a problem without hints', () => {
    expect(render('not-a-real-problem', activity())).toBe('');
  });
});
