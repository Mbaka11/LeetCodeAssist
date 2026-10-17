import { Button } from '../components/Button';
import { Card } from '../components/Card';
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
  const prefs = useLeetCodePrefs();
  const detectedEvents = useSubmissionEvents();
  const anyRunning = snapshot.status === 'ready' && snapshot.state.activities.some((a) => a.timer.running);
  const now = useNow(anyRunning ? 1000 : 30_000);
  const open = (hash: string): void => void openDashboard(hash);
  const openProblem = (slug: string): void =>
    void openProblemInBrowser(slug).catch((e: unknown) => console.error('Could not open the problem', e));

  if (snapshot.status === 'loading') return <main className="panel muted">Loading…</main>;
  if (snapshot.status === 'empty') {
    return (
      <main className="panel">
        <Card title="Set up your program">
          <p className="muted">Choose a start date in the dashboard to begin the 30-day program.</p>
          <Button variant="primary" onClick={() => open('')}>
            Open the dashboard
          </Button>
        </Card>
      </main>
    );
  }
  if (snapshot.status === 'error') {
    return (
      <main className="panel">
        <Card title="Stored data could not be read">
          <p className="error">{snapshot.message}</p>
          <Button onClick={() => open('#/settings')}>Open the dashboard</Button>
        </Card>
      </main>
    );
  }
  return (
    <main className="panel">
      <ProblemPanel
        state={snapshot.state}
        actions={actions}
        slug={problemSlugFromUrl(url)}
        now={now}
        openDashboard={open}
        openProblem={openProblem}
        {...(prefs.detectionEnabled ? { submissionEvents: detectedEvents } : {})}
      />
    </main>
  );
}
