import { isAccepted, type SubmissionEvent } from './leetcodeSubmissions';

export interface DetectionSnapshot {
  lastSubmit: SubmissionEvent | null;
  lastAccepted: SubmissionEvent | null;
  lastResult: SubmissionEvent | null;
  /** Latest Submit has no later final result for the same slug. Not an endpoint/connection health check. */
  waitingForResult: boolean;
}

/** Latest stored observations by receipt time, optionally scoped to a problem. Never sends a request. */
export function detectionSnapshot(events: readonly SubmissionEvent[], slug?: string | null): DetectionSnapshot {
  let lastSubmit: SubmissionEvent | null = null;
  let lastAccepted: SubmissionEvent | null = null;
  let lastResult: SubmissionEvent | null = null;
  for (const event of events) {
    if (slug && event.slug !== slug) continue;
    if (event.type === 'submit') {
      if (!lastSubmit || event.at >= lastSubmit.at) lastSubmit = event;
    } else {
      if (!lastResult || event.at >= lastResult.at) lastResult = event;
      if (isAccepted(event) && (!lastAccepted || event.at >= lastAccepted.at)) lastAccepted = event;
    }
  }
  const waitingForResult = lastSubmit !== null && !events.some((event) =>
    event.type === 'check' && event.slug === lastSubmit.slug && event.at >= lastSubmit.at);
  return { lastSubmit, lastAccepted, lastResult, waitingForResult };
}
