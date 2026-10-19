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

  it('disables Refresh and says so while LeetCode has asked to slow down', () => {
    const html = body({ cache: cache({ blockedUntil: NOW + 10 * 60_000 }) });
    expect(html).toContain('Refresh paused');
    expect(html).toContain('disabled');
    expect(html).toContain('retry in 10 min');
    expect(body({})).not.toContain('Refresh paused');
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

describe('LeetCodeStreakBody compact mode', () => {
  const compact = (props: Partial<Parameters<typeof LeetCodeStreakBody>[0]> = {}): string => body({ compact: true, ...props });

  it('keeps Refresh, the username link and the data age visible next to compact numbers and a 16-week grid', () => {
    const html = compact();
    expect(html).toContain('streak-compact');
    expect(html).toContain('>Current<');
    expect(html).toContain('>Longest<');
    expect(html).toContain('>Active days<');
    expect(html).toContain('3 days');
    expect((html.match(/class="heat-week"/g) ?? []).length).toBe(16);
    expect(html).toContain('heat-grid heat-grid-compact');
    expect(html).toContain('>Refresh<');
    expect(html).toContain('>@neo ↗<');
    expect(html).toContain('https://leetcode.com/u/neo/');
    expect(html).toContain('Updated 5 min ago');
    expect(html).toContain('UTC days');
    expect(html).toContain('including today');
    // The long stat hints are not repeated in the compact layout.
    expect(html).not.toContain('Current streak');
    expect(html).not.toContain('days with a submission');
  });

  it('keeps the same paused, error, loading and empty semantics, with Refresh still visible', () => {
    const paused = compact({ cache: cache({ blockedUntil: NOW + 10 * 60_000 }) });
    expect(paused).toContain('Refresh paused');
    expect(paused).toContain('disabled');
    expect(paused).toContain('retry in 10 min');
    const failed = compact({ cache: { username: 'neo', fetchedAt: null, attemptedAt: NOW, error: errorFromStatus(500) } });
    expect(failed).toContain('role="alert"');
    expect(failed).toContain('server problem');
    expect(failed).toContain('>Refresh<');
    expect(compact({ cache: null, refreshing: true })).toContain('Refreshing…');
    expect(compact({ cache: null, refreshing: true })).toContain('Loading your LeetCode calendar');
    expect(compact({ cache: null })).toContain('No data yet.');
    expect(compact({ cache: cache({ error: errorFromStatus(429) }) })).toContain('Current');
    const none = compact({ username: undefined, cache: null });
    expect(none).toContain('Set your LeetCode username in');
    expect(none).not.toContain('Refresh');
  });

  it('says when today still has no submission', () => {
    const days = { [String(TODAY - DAY)]: 1 };
    const html = compact({ cache: cache({ calendar: { reportedStreak: null, reportedActiveDays: null, activeYears: [], days } }) });
    expect(html).toContain('submit today to keep it going');
  });

  it('renders the card in compact mode without a browser', () => {
    const html = renderToStaticMarkup(<LeetCodeStreakCard now={NOW} compact />);
    expect(html).toContain('cal-streak');
    expect(html).toContain('Set your LeetCode username');
  });

  it('is not compact by default', () => {
    expect(body({})).not.toContain('streak-compact');
    expect(body({})).toContain('Open your LeetCode profile ↗');
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
    expect(html).toContain('pauses its timer and opens the Finish form');
    expect(html).toContain('Nothing is completed automatically');
  });

  it('degrades gracefully when nothing was detected', () => {
    const html = panel(true, []);
    expect(html).toContain('none yet');
    expect(html).toContain('never');
    expect(html).toContain('Nothing detected yet');
    expect(html).toContain('disabled=""'); // nothing to clear
    expect(panel(false, [])).not.toContain('checked=""');
  });

  it('explains the submissions-without-results failure without requesting private data', () => {
    const html = panel(true, [events[0]!]);
    expect(html).toContain('no final results have been recorded');
    expect(html).toContain('never headers, cookies or full responses');
    expect(panel(false, [events[0]!])).not.toContain('no final results have been recorded');
    expect(panel(true, events)).not.toContain('no final results have been recorded');
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
