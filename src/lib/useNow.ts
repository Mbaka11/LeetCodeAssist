import { useEffect, useState } from 'react';

/**
 * Current timestamp that refreshes every `intervalMs`. Used only for display: timers are derived
 * from stored timestamps, never from counting ticks.
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
