import type { ReactNode } from 'react';

/** A long explanation folded under a short summary, so the page leads with the data. */
export function Explain({ summary = 'How this works', children }: { summary?: string; children: ReactNode }) {
  return (
    <details className="explain">
      <summary>{summary}</summary>
      {children}
    </details>
  );
}
