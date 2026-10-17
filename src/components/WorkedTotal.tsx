import type { WorkedTotals } from '../core/worked';

/** "Program 5/50 · Benchmarks 2/6 · Bonus 1", with "Other n" only when it is not zero. */
export function workedBreakdown(totals: WorkedTotals): string {
  const parts = [
    `Program ${totals.program}/${totals.programTotal}`,
    `Benchmarks ${totals.benchmark}/${totals.benchmarkTotal}`,
    `Bonus ${totals.bonus}`,
  ];
  if (totals.other > 0) parts.push(`Other ${totals.other}`);
  return parts.join(' · ');
}

/**
 * Total of distinct problems worked (at least one finished attempt), with its breakdown. One component for
 * Today and Calendar so both read the same numbers (`workedTotals`). The program counter stays separate.
 */
export function WorkedTotal({ totals }: { totals: WorkedTotals }) {
  return (
    <div className="worked-total" role="group" aria-label="Distinct problems worked">
      <div className="worked-total-main">
        <span className="worked-total-value">{totals.total}</span>
        <span className="worked-total-label">{totals.total === 1 ? 'problem worked' : 'problems worked'}</span>
      </div>
      <div className="worked-total-detail">
        <span className="worked-total-breakdown">{workedBreakdown(totals)}</span>
        <span className="muted worked-total-note">
          Each problem counts once. Reviews never add to it, and a bonus never replaces a program problem.
        </span>
      </div>
    </div>
  );
}
