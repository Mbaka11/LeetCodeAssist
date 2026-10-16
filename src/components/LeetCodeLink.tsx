import type { ReactNode } from 'react';
import { openSidePanelBestEffort } from '../lib/sidePanel';

/**
 * Link to a problem on LeetCode that opens in a new tab. In the dashboard the same click also opens the
 * side panel (best effort, inside the user gesture) so the activity is at hand next to the problem.
 */
export function LeetCodeLink({
  href,
  openPanel = false,
  className = 'link-out',
  children = 'LeetCode ↗',
}: {
  href: string;
  /** Also open the side panel in this window (dashboard only: the side panel itself is already open). */
  openPanel?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noreferrer"
      {...(openPanel ? { onClick: openSidePanelBestEffort } : {})}
    >
      {children}
    </a>
  );
}
