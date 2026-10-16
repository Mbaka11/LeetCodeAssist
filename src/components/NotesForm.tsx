import { useEffect, useState } from 'react';
import type { Note } from '../core/types';
import type { NoteFields } from '../lib/commands';
import { Button } from './Button';

const EMPTY: NoteFields = { trigger: '', principle: '', pitfall: '', complexity: '', code: '' };

function fieldsOf(note: Note | undefined): NoteFields {
  return note
    ? {
        trigger: note.trigger,
        principle: note.principle,
        pitfall: note.pitfall,
        complexity: note.complexity,
        code: note.code ?? '',
      }
    : EMPTY;
}

export function NotesForm({
  note,
  onSave,
}: {
  note: Note | undefined;
  onSave: (fields: NoteFields) => Promise<void>;
}) {
  const [fields, setFields] = useState<NoteFields>(() => fieldsOf(note));
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Pick up edits made on another surface while the form has no unsaved changes.
  const updatedAt = note?.updatedAt;
  const storedFields = JSON.stringify(fieldsOf(note));
  useEffect(() => {
    if (!dirty) setFields(JSON.parse(storedFields) as NoteFields);
  }, [updatedAt, storedFields, dirty]);

  const set = (key: keyof NoteFields) => (value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setStatus('idle');
  };

  return (
    <form
      className="notes-form"
      onSubmit={(event) => {
        event.preventDefault();
        setStatus('saving');
        onSave(fields).then(
          () => {
            setDirty(false);
            setStatus('saved');
          },
          () => setStatus('error'),
        );
      }}
    >
      <label className="field">
        <span>Trigger</span>
        <input
          value={fields.trigger}
          placeholder="What makes you recognise this pattern? (e.g. “Click”)"
          onChange={(e) => set('trigger')(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Principle</span>
        <textarea rows={3} value={fields.principle} onChange={(e) => set('principle')(e.target.value)} />
      </label>
      <label className="field">
        <span>Pitfall</span>
        <textarea rows={2} value={fields.pitfall} onChange={(e) => set('pitfall')(e.target.value)} />
      </label>
      <label className="field">
        <span>Complexity</span>
        <input
          value={fields.complexity}
          placeholder="Time and space"
          onChange={(e) => set('complexity')(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Python snippet</span>
        <textarea
          className="mono"
          rows={10}
          spellCheck={false}
          value={fields.code}
          onChange={(e) => set('code')(e.target.value)}
        />
      </label>
      <div className="row">
        <Button type="submit" variant="primary" disabled={!dirty || status === 'saving'}>
          Save notes
        </Button>
        {status === 'saved' ? <span className="tone-good">Saved</span> : null}
        {status === 'error' ? <span className="error">Could not save notes</span> : null}
        {note ? <span className="muted">Last saved {note.updatedAt}</span> : null}
      </div>
    </form>
  );
}
