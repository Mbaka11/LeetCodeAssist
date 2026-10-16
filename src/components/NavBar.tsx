import type { ReactNode } from 'react';
import type { Route } from '../lib/route';

const LINKS: { view: Route['view']; href: string; label: string }[] = [
  { view: 'today', href: '#/today', label: 'Today' },
  { view: 'calendar', href: '#/calendar', label: 'Calendar' },
  { view: 'roadmap', href: '#/roadmap', label: 'Roadmap' },
  { view: 'settings', href: '#/settings', label: 'Settings' },
];

export function NavBar({ route, actions }: { route: Route; actions?: ReactNode }) {
  return (
    <header className="navbar">
      <span className="brand">LeetCode Assist</span>
      <nav aria-label="Views">
        {LINKS.map((link) => (
          <a
            key={link.view}
            href={link.href}
            className={route.view === link.view ? 'active' : undefined}
            aria-current={route.view === link.view ? 'page' : undefined}
          >
            {link.label}
          </a>
        ))}
      </nav>
      {actions ? (
        <>
          <span className="spacer" />
          {actions}
        </>
      ) : null}
    </header>
  );
}
