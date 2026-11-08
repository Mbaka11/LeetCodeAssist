import type { ReactNode } from 'react';

export function Stat({
  label,
  value,
  hint,
  tone,
  title,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'good' | 'warn' | 'bad';
  /** Extra detail shown on hover. */
  title?: string;
}) {
  return (
    <div className="stat" title={title}>
      <div className="stat-label">{label}</div>
      <div className={`stat-value${tone ? ` tone-${tone}` : ''}`}>{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}
