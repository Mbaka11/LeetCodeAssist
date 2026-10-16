import type { ReactNode } from 'react';

export type BadgeTone =
  | 'neutral'
  | 'new'
  | 'recall'
  | 'rebuild'
  | 'resolve'
  | 'blind'
  | 'retry'
  | 'benchmark'
  | 'easy'
  | 'medium'
  | 'hard'
  | 'good'
  | 'warn'
  | 'bad';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
