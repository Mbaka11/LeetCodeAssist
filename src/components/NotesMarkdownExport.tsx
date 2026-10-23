import { useState } from 'react';
import { localDateFromTimestamp } from '../core/dates';
import { notesMarkdown } from '../core/notesMarkdown';
import type { AppState } from '../core/types';
import { Button } from './Button';

export function NotesMarkdownExport({ state }: { state: AppState }) {
  const [message, setMessage] = useState<string | null>(null);
  const empty = Object.keys(state.notes).length === 0;
  return <div className="stack-tight">
    <div className="row"><Button disabled={empty} onClick={() => {
      try {
        const url = URL.createObjectURL(new Blob([notesMarkdown(state)], { type: 'text/markdown;charset=utf-8' }));
        try {
          const link = document.createElement('a');
          link.href = url;
          link.download = `leetcode-assist-notes-${localDateFromTimestamp(Date.now())}.md`;
          link.click();
          setMessage('All notes exported as Markdown.');
        } finally { URL.revokeObjectURL(url); }
      } catch (e: unknown) { setMessage(e instanceof Error ? e.message : String(e)); }
    }}>Export all notes (.md)</Button></div>
    {empty ? <p className="muted">No notes saved yet.</p> : null}
    {message ? <p role="status">{message}</p> : null}
  </div>;
}
