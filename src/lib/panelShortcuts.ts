/**
 * Side-panel keyboard shortcuts. They are page-level key handlers, so they only fire while the side
 * panel document has focus, and never while the user is typing. All of them use Alt, so they cannot
 * collide with typing; the browser command Alt+Shift+L (open the side panel) is a separate extension
 * command and is not handled here.
 */
import { useEffect, useRef } from 'react';

export type PanelShortcut =
  | 'timer'
  | 'finish'
  | 'outcome-solo'
  | 'outcome-hint'
  | 'outcome-solution'
  | 'outcome-stuck'
  | 'save'
  | 'help';

export interface PanelShortcutInfo {
  keys: string;
  description: string;
}

/** What the "Shortcuts" disclosure lists. */
export const PANEL_SHORTCUT_LIST: readonly PanelShortcutInfo[] = [
  { keys: 'Alt+T', description: 'Start, pause or resume the timer of the selected activity' },
  { keys: 'Alt+R', description: 'Open Finish for the selected activity (pauses the timer)' },
  { keys: 'Alt+1 … Alt+4', description: 'In Finish: Solo, Hint, Solution, Stuck' },
  { keys: 'Alt+Enter', description: 'In Finish: save the result when the form is valid' },
  { keys: 'Alt+?', description: 'Show or hide this list' },
];

const OUTCOME_SHORTCUTS: Record<string, PanelShortcut> = {
  '1': 'outcome-solo',
  '2': 'outcome-hint',
  '3': 'outcome-solution',
  '4': 'outcome-stuck',
};

/** Input types that do not take typed text, so Alt shortcuts stay available while one has focus. */
const NON_TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
  'button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'image', 'file',
]);

/** Text fields, selects and editable regions: keys typed there are never shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !NON_TEXT_INPUT_TYPES.has((target as HTMLInputElement).type);
  const editable = target.closest('[contenteditable]');
  return editable !== null && editable.getAttribute('contenteditable') !== 'false';
}

function keyName(event: KeyboardEvent): string {
  const code = event.code;
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad') && code.length === 7) return code.slice(6);
  if (code.startsWith('Key')) return code.slice(3).toLowerCase();
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

/** The shortcut a key event stands for, or null (wrong keys, extra modifiers, typing in a field). */
export function panelShortcutFromEvent(event: KeyboardEvent): PanelShortcut | null {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.isComposing || event.repeat) return null;
  if (isTypingTarget(event.target)) return null;
  // Alt+? is Alt+Shift+/ on most layouts: the only combination that may carry Shift.
  if (event.key === '?' || (event.shiftKey && event.code === 'Slash')) return 'help';
  if (event.shiftKey) return null;
  const key = keyName(event);
  if (key === 't') return 'timer';
  if (key === 'r') return 'finish';
  if (key === 'Enter') return 'save';
  return OUTCOME_SHORTCUTS[key] ?? null;
}

/**
 * Calls `handler` for every shortcut while enabled. Return true when the shortcut was used (the browser
 * default is then prevented); return false to leave the key alone.
 */
export function usePanelShortcuts(handler: (shortcut: PanelShortcut) => boolean, enabled = true): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    if (!enabled) return undefined;
    const listener = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return;
      const shortcut = panelShortcutFromEvent(event);
      if (shortcut !== null && latest.current(shortcut)) event.preventDefault();
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [enabled]);
}
