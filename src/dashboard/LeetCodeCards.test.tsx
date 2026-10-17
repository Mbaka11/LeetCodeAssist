import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { errorFromStatus, utcDayStart, type ProfileCache } from '../lib/leetcodeProfile';
import type { SubmissionEvent } from '../lib/leetcodeSubmissions';
import { LeetCodeDetectionCard, LeetCodeDetectionPanel, LeetCodeProfileForm } from './LeetCodeSettings';
import { LeetCodeStreakBody, LeetCodeStreakCard } from './LeetCodeStreakCard';

const NOW = Date.UTC(2025, 2, 12, 15, 30);
const TODAY = utcDayStart(NOW);
const DAY = 86_400;
const noop = (): void => undefined;

function cache(patch: Partial<ProfileCache> = {}): ProfileCache {
  return {
    username: 'neo',
    fetchedAt: NOW - 5 * 60_000,
    attemptedAt: NOW - 5 * 60_000,
    calendar: {
      reportedStreak: null,
      reportedActiveDays: null,
      activeYears: [2025],
      days: { [String(TODAY)]: 2, [String(TODAY - DAY)]: 1, [String(TODAY - 2 * DAY)]: 7 },
    },
    ...patch,
  };
}

const body = (props: Partial<Parameters<typeof LeetCodeStreakBody>[0]>): string =>
  renderToStaticMarkup(
    <LeetCodeStreakBody username="neo" cache={cache()} now={NOW} refreshing={false} onRefresh={noop} {...props} />,
  );

describe('LeetCodeStreakBody', () => {
  it('asks for a username when none is set', () => {
    const html = body({ username: undefined, cache: null });
    expect(html).toContain('Set your LeetCode username in');
    expect(html).toContain('#/settings');
    expect(html).not.toContain('Refresh');
  });

  it('shows streak stats, a 16-week grid, the profile link and the data age', () => {
    const html = body({});
    expect(html).toContain('Current streak');
    expect(html).toContain('3 days');
    expect(html).toContain('Longest streak');
    expect(html).toContain('Active days this year');
    expect(html).toContain('including today');
    expect((html.match(/class="heat-week"/g) ?? []).length).toBe(16);
    expect(html).toContain('aria-label="Mar 12 (UTC): 2 submissions"');
    expect(html).toContain('https://leetcode.com/u/neo/');
    expect(html).toContain('Updated 5 min ago');
    expect(html).toContain('>Refresh<');
  });

  it('says when today still has no submission', () => {
    const days = { [String(TODAY - DAY)]: 1 };
    const html = body({ cache: cache({ calendar: { reportedStreak: null, reportedActiveDays: null, activeYears: [], days } }) });
    expect(html).toContain('submit today to keep it going');
  });

  it('shows an error next to the old numbers', () => {
    const html = body({ cache: cache({ error: errorFromStatus(429) }) });
    expect(html).toContain('role="alert"');
    expect(html).toContain('slow down');
    expect(html).toContain('Current streak');
  });

  it('shows an error alone when nothing was ever fetched, and a loading state', () => {
    const failed = body({ cache: { username: 'neo', fetchedAt: null, attemptedAt: NOW, error: errorFromStatus(500) } });
    expect(failed).toContain('server problem');
    expect(failed).not.toContain('Current streak');
    expect(body({ cache: null, refreshing: true })).toContain('Loading your LeetCode calendar');
    expect(body({ cache: null })).toContain('No data yet.');
  });

  it('ignores a cache that belongs to another username', () => {
    expect(body({ username: 'trinity' })).toContain('No data yet.');
  });

  it('renders as a card without a browser (empty state)', () => {
    const html = renderToStaticMarkup(<LeetCodeStreakCard now={NOW} />);
    expect(html).toContain('LeetCode streak');
    expect(html).toContain('Set your LeetCode username');
  });
});

describe('LeetCode settings cards', () => {
  const events: SubmissionEvent[] = [
    { type: 'submit', slug: 'two-sum', state: 'SUBMITTED', status_msg: '', lang: '', at: NOW - 60_000 },
    { type: 'check', slug: 'two-sum', state: 'SUCCESS', status_msg: 'Wrong Answer', lang: 'python3', at: NOW - 50_000 },
    { type: 'check', slug: 'two-sum', state: 'SUCCESS', status_msg: 'Accepted', lang: 'python3', at: NOW - 10_000 },
  ];
  const panel = (enabled: boolean, list: readonly SubmissionEvent[]): string =>
    renderToStaticMarkup(
      <LeetCodeDetectionPanel enabled={enabled} events={list} now={NOW} onToggle={noop} onClear={noop} message={null} />,
    );

  it('shows the toggle, diagnostics without bodies, the privacy note and the clear button', () => {
    const html = panel(true, events);
    expect(html).toContain('Detect accepted submissions');
    expect(html).toContain('checked=""');
    expect(html).toContain('Submissions seen');
    expect(html).toContain('2 (1 Accepted)');
    expect(html).toContain('Accepted, Wrong Answer');
    expect(html).toContain('Last event');
    expect(html).toContain('Clear detected events');
    expect(html).toContain('never reads or stores');
    expect(html).toContain('sends nothing');
  });

  it('degrades gracefully when nothing was detected', () => {
    const html = panel(true, []);
    expect(html).toContain('none yet');
    expect(html).toContain('never');
    expect(html).toContain('Nothing detected yet');
    expect(html).toContain('disabled=""'); // nothing to clear
    expect(panel(false, [])).not.toContain('checked=""');
  });

  it('renders the cards without a browser (defaults: detection on)', () => {
    const html = renderToStaticMarkup(<LeetCodeDetectionCard />);
    expect(html).toContain('LeetCode detection');
    expect(html).toContain('checked=""');
  });

  it('renders the username field with its saved value', () => {
    const html = renderToStaticMarkup(<LeetCodeProfileForm prefs={{ detectionEnabled: true, username: 'Neo_99' }} />);
    expect(html).toContain('LeetCode username');
    expect(html).toContain('value="Neo_99"');
    expect(html).toContain('maxLength="40"');
  });
});
