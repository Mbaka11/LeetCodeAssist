import type { ReactNode } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LeetCodeDetectionStatus } from '../components/LeetCodeDetectionStatus';
import { problemSlugFromUrl } from '../lib/leetcodeUrl';
import { openDashboard } from '../lib/openDashboard';
import { openProblemInBrowser } from '../lib/sidePanel';
import { useAppState } from '../lib/useAppState';
import { useLeetCodePrefs, useSubmissionEvents } from '../lib/useLeetCodeData';
import { useNow } from '../lib/useNow';
import { ProblemPanel } from './ProblemPanel';
import { useActiveTabUrl } from './useActiveTabUrl';

export function SidePanelApp() {
  const { snapshot, actions } = useAppState();
  const url = useActiveTabUrl();
  const slug = problemSlugFromUrl(url);
  const prefs = useLeetCodePrefs();
  const detectedEvents = useSubmissionEvents();
  const anyRunning = snapshot.status === 'ready' && snapshot.state.activities.some((a) => a.timer.running);
  const activityStarted = snapshot.status === 'ready'
    ? snapshot.state.activities.some((a) => a.slug === slug && a.status === 'in_progress')
    : snapshot.status === 'empty' ? false : undefined;
  const now = useNow(anyRunning ? 1000 : 30_000);
  const open = (hash: string): void => void openDashboard(hash);
  const openProblem = (target: string): void =>
    void openProblemInBrowser(target).catch((e: unknown) => console.error('Could not open the problem', e));
  const panel = (content: ReactNode): ReactNode => (
    <main className="panel">
      <div className="stack">
        <LeetCodeDetectionStatus enabled={prefs.detectionEnabled} events={detectedEvents} now={now}
          currentSlug={slug} activityStarted={activityStarted} onOpenSettings={() => open('#/settings')} />
        {content}
      </div>
    </main>
  );

  if (snapshot.status === 'loading') return panel(<p className="muted">Loading…</p>);
  if (snapshot.status === 'empty') {
    return panel(
      <Card title="Set up your program">
        <p className="muted">Choose a start date in the dashboard to begin the 30-day program.</p>
        <Button variant="primary" onClick={() => open('')}>Open the dashboard</Button>
      </Card>,
    );
  }
  if (snapshot.status === 'error') {
    return panel(
      <Card title="Stored data could not be read">
        <p className="error">{snapshot.message}</p>
        <Button onClick={() => open('#/settings')}>Open the dashboard</Button>
      </Card>,
    );
  }
  return panel(
    <ProblemPanel
      state={snapshot.state}
      actions={actions}
      slug={slug}
      now={now}
      openDashboard={open}
      openProblem={openProblem}
      {...(prefs.detectionEnabled ? { submissionEvents: detectedEvents } : {})}
    />,
  );
}
