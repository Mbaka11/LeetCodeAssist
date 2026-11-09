/**
 * A progress bar. `planned` (>= value) adds a lighter band showing what is planned on top of what is done.
 */
export function ProgressBar({ value, max, done, planned }: { value: number; max: number; done?: boolean; planned?: number }) {
  const pct = (n: number): number => (max > 0 ? Math.min(100, Math.round((n / max) * 100)) : 0);
  return (
    <div
      className={`progress${done ? ' progress-done' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      {...(planned !== undefined ? { 'aria-valuetext': `${value} of ${max} done, ${planned} planned` } : {})}
    >
      {planned !== undefined && planned > value ? (
        <div className="progress-planned" style={{ width: `${pct(planned)}%` }} />
      ) : null}
      <div className="progress-fill" style={{ width: `${pct(value)}%` }} />
    </div>
  );
}
