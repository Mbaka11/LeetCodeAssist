import { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { ConfirmButton } from '../components/ConfirmButton';
import { NavBar } from '../components/NavBar';
import { parseRoute, type Route } from '../lib/route';
import { useAppState } from '../lib/useAppState';
import { CalendarView } from './CalendarView';
import { LogsView } from './LogsView';
import { OpenSidePanelButton } from './OpenSidePanelButton';
import { ProblemView } from './ProblemView';
import { RoadmapView } from './RoadmapView';
import { SyncBanner } from './SyncSettings';
import { SettingsView } from './SettingsView';
import { SetupView } from './SetupView';
import { TodayView } from './TodayView';
import { WeeklyView } from './WeeklyView';
import { PracticeView } from './PracticeView';

/** Logs and the Calendar need more width than the default page column. */
const PAGE_CLASSES: Partial<Record<Route['view'], string>> = {
  logs: 'page page-wide',
  calendar: 'page page-calendar',
};

function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = (): void => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function App() {
  const { snapshot, actions } = useAppState();
  const route = useHashRoute();

  if (snapshot.status === 'loading') {
    return <main className="page centered muted">Loading…</main>;
  }
  if (snapshot.status === 'empty') {
    return <SetupView actions={actions} />;
  }
  if (snapshot.status === 'error') {
    return (
      <main className="page narrow">
        <Card title="Stored data could not be read">
          <p className="error">{snapshot.message}</p>
          <p className="muted">
            Your data was left untouched. Resetting deletes it and lets you start over.
          </p>
          <ConfirmButton prompt="Delete all stored data?" confirmLabel="Delete and start over" onConfirm={() => void actions.reset()}>
            Reset all data
          </ConfirmButton>
        </Card>
      </main>
    );
  }

  const { state } = snapshot;
  return (
    <>
      <NavBar route={route} actions={<OpenSidePanelButton />} />
      <main className={PAGE_CLASSES[route.view] ?? 'page'}>
        <SyncBanner />
        {route.view === 'today' ? <TodayView state={state} actions={actions} /> : null}
        {route.view === 'calendar' ? <CalendarView state={state} actions={actions} /> : null}
        {route.view === 'roadmap' ? <RoadmapView state={state} actions={actions} /> : null}
        {route.view === 'logs' ? <LogsView state={state} actions={actions} /> : null}
        {route.view === 'weekly' ? <WeeklyView state={state} /> : null}
        {route.view === 'practice' ? <PracticeView state={state} actions={actions} /> : null}
        {route.view === 'problem' ? (
          <ProblemView key={route.slug} slug={route.slug} state={state} actions={actions} />
        ) : null}
        {route.view === 'settings' ? <SettingsView state={state} actions={actions} /> : null}
      </main>
    </>
  );
}
