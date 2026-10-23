/**
 * One page-level guard for unsaved work that lives only in component state (an active practice session).
 * `NavBar` asks before leaving the view; closing the tab is covered separately by `beforeunload`.
 */
let unsavedMessage: string | null = null;

export function setUnsavedWorkGuard(message: string | null): void {
  unsavedMessage = message;
}

/** True when there is nothing to lose or the user agrees to leave. */
export function confirmLeaveWithUnsavedWork(ask: (message: string) => boolean = (message) => window.confirm(message)): boolean {
  return unsavedMessage === null || ask(unsavedMessage);
}
