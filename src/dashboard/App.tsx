import { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { ConfirmButton } from '../components/ConfirmButton';
import { NavBar } from '../components/NavBar';
import { parseRoute, type Route } from '../lib/route';
import { useAppState } from '../lib/useAppState';
import { PlaceholderView } from './PlaceholderView';
import { ProblemView } from './ProblemView';
import { SettingsView } from './SettingsView';
import { SetupView } from './SetupView';
import { TodayView } from './TodayView';

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
      <NavBar route={route} />
      <main className="page">
        {route.view === 'today' ? <TodayView state={state} actions={actions} /> : null}
        {route.view === 'calendar' ? (
          <PlaceholderView title="Calendar" text="Day-by-day planned, done and carried counts arrive in the next stage." />
        ) : null}
        {route.view === 'roadmap' ? (
          <PlaceholderView title="Roadmap" text="The NeetCode categories with progress counters arrive in the next stage." />
        ) : null}
        {route.view === 'problem' ? (
          <ProblemView key={route.slug} slug={route.slug} state={state} actions={actions} />
        ) : null}
        {route.view === 'settings' ? <SettingsView state={state} actions={actions} /> : null}
      </main>
    </>
  );
}
