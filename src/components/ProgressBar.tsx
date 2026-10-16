export function ProgressBar({ value, max, done }: { value: number; max: number; done?: boolean }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className={`progress${done ? ' progress-done' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
    >
      <div className="progress-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}
