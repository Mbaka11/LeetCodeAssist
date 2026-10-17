import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Stat } from '../components/Stat';
import {
  computeStreakStats,
  formatAgo,
  heatGrid,
  profileUrl,
  type HeatCell,
  type ProfileCache,
} from '../lib/leetcodeProfile';
import { requestProfileRefresh, useLeetCodePrefs, useProfileCache } from '../lib/useLeetCodeData';

const WEEKS = 16;

function cellLabel(cell: HeatCell): string {
  const date = new Date(cell.dayStart * 1000).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  });
  return `${date} (UTC): ${cell.count} ${cell.count === 1 ? 'submission' : 'submissions'}`;
}

export function HeatGrid({ cache, now }: { cache: ProfileCache; now: number }) {
  const grid = heatGrid(cache.calendar?.days ?? {}, now, WEEKS);
  return (
    <div className="heat-grid" role="group" aria-label={`Submissions per day, last ${WEEKS} weeks`}>
      {grid.map((week) => (
        <div className="heat-week" key={week[0]?.dayStart}>
          {week.map((cell) => (
            <span
              key={cell.dayStart}
              role="img"
              aria-label={cell.future ? 'Future day' : cellLabel(cell)}
              title={cell.future ? undefined : cellLabel(cell)}
              className={`heat-cell heat-${cell.future ? 'future' : cell.level}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function days(count: number): string {
  return `${count} ${count === 1 ? 'day' : 'days'}`;
}

/** What the card shows for a username and its cached data. */
export function LeetCodeStreakBody({
  username,
  cache,
  now,
  refreshing,
  onRefresh,
}: {
  username: string | undefined;
  cache: ProfileCache | null;
  now: number;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  if (!username) {
    return (
      <p className="muted">
        Set your LeetCode username in <a href="#/settings">Settings</a> to see your submission streak here.
      </p>
    );
  }
  const current = cache !== null && cache.username === username ? cache : null;
  const paused = current?.blockedUntil !== undefined && now < current.blockedUntil;
  const stats = current?.calendar ? computeStreakStats(current.calendar.days, now) : null;
  return (
    <div className="stack-tight">
      {current?.error ? (
        <p className="error" role="alert">
          {current.error.message}
        </p>
      ) : null}
      {stats && current ? (
        <>
          <div className="stats">
            <Stat
              label="Current streak"
              value={days(stats.current)}
              hint={
                stats.activeToday
                  ? 'including today'
                  : stats.current > 0
                    ? 'submit today to keep it going'
                    : 'no submission yesterday or today'
              }
            />
            <Stat label="Longest streak" value={days(stats.longest)} hint="in the returned year" />
            <Stat
              label="Active days this year"
              value={stats.activeDaysThisYear}
              hint="days with a submission (UTC)"
            />
          </div>
          <HeatGrid cache={current} now={now} />
          <p className="muted heat-legend">
            Last {WEEKS} weeks, UTC days · fewer
            {[0, 1, 2, 3, 4].map((level) => (
              <span key={level} className={`heat-cell heat-${level}`} aria-hidden="true" />
            ))}
            more
          </p>
        </>
      ) : current?.error ? null : (
        <p className="muted">{refreshing ? 'Loading your LeetCode calendar…' : 'No data yet.'}</p>
      )}
      <div className="row">
        <Button onClick={onRefresh} disabled={refreshing || paused}>
          {refreshing ? 'Refreshing…' : paused ? 'Refresh paused' : 'Refresh'}
        </Button>
        {paused && current?.blockedUntil !== undefined ? (
          <span className="muted">LeetCode asked to slow down; retry in {Math.ceil((current.blockedUntil - now) / 60_000)} min.</span>
        ) : null}
        <a href={profileUrl(username)} target="_blank" rel="noreferrer">
          Open your LeetCode profile ↗
        </a>
        <span className="spacer" />
        {current?.fetchedAt != null ? (
          <span className="muted">Updated {formatAgo(current.fetchedAt, now)}</span>
        ) : null}
      </div>
    </div>
  );
}

export function LeetCodeStreakCard({ now }: { now: number }) {
  const prefs = useLeetCodePrefs();
  const cache = useProfileCache();
  const [refreshing, setRefreshing] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const { username } = prefs;

  const refresh = (force: boolean): void => {
    setRequestError(null);
    setRefreshing(true);
    requestProfileRefresh(force)
      .catch(() => setRequestError('Could not reach the extension background worker. Reload the page and try again.'))
      .finally(() => setRefreshing(false));
  };

  // Opening the page asks for data; the background worker refreshes at most once an hour.
  useEffect(() => {
    if (username) refresh(false);
  }, [username]);

  return (
    <Card title="LeetCode streak">
      <LeetCodeStreakBody
        username={username}
        cache={cache}
        now={now}
        refreshing={refreshing}
        onRefresh={() => refresh(true)}
      />
      {requestError ? <p className="error">{requestError}</p> : null}
    </Card>
  );
}
