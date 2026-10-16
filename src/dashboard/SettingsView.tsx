import { useRef, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConfirmButton } from '../components/ConfirmButton';
import { localDateFromTimestamp } from '../core/dates';
import type { AppState } from '../core/types';
import type { AppActions } from '../lib/actions';

interface Message {
  tone: 'good' | 'error';
  text: string;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The message lives outside the form: a saved change re-keys (remounts) the form. */
function SettingsForm({
  state,
  actions,
  message,
  setMessage,
}: {
  state: AppState;
  actions: AppActions;
  message: Message | null;
  setMessage: (message: Message | null) => void;
}) {
  const { settings } = state;
  const [startDate, setStartDate] = useState(settings.startDate);
  const [target, setTarget] = useState(String(settings.dailyTargetMin));
  const [cap, setCap] = useState(String(settings.dailyCapMin));
  const [morning, setMorning] = useState(settings.morningNotify);
  const [evening, setEvening] = useState(settings.eveningNotify);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    actions
      .updateSettings({
        startDate,
        dailyTargetMin: Number(target),
        dailyCapMin: Number(cap),
        morningNotify: morning,
        eveningNotify: evening,
      })
      .then(
        () => setMessage({ tone: 'good', text: 'Settings saved.' }),
        (e: unknown) => setMessage({ tone: 'error', text: errorText(e) }),
      );
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="field">
        <span>Program start date (day 1)</span>
        <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </label>
      <label className="field">
        <span>Daily target (min)</span>
        <input type="number" min={1} step={5} required value={target} onChange={(e) => setTarget(e.target.value)} />
      </label>
      <label className="field">
        <span>Daily cap (min)</span>
        <input type="number" min={1} step={5} required value={cap} onChange={(e) => setCap(e.target.value)} />
      </label>
      <label className="field">
        <span>Morning summary</span>
        <input type="time" required value={morning} onChange={(e) => setMorning(e.target.value)} />
      </label>
      <label className="field">
        <span>Evening reminder</span>
        <input type="time" required value={evening} onChange={(e) => setEvening(e.target.value)} />
      </label>
      <div className="row full">
        <Button type="submit" variant="primary">
          Save settings
        </Button>
        {message ? (
          <span className={message.tone === 'good' ? 'tone-good' : 'error'}>{message.text}</span>
        ) : null}
      </div>
    </form>
  );
}

function DataSection({ actions }: { actions: AppActions }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<{ name: string; text: string } | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const exportJson = (): void => {
    actions.exportJson().then(
      (json) => {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `leetcode-assist-${localDateFromTimestamp(Date.now())}.json`;
        link.click();
        URL.revokeObjectURL(url);
        setMessage({ tone: 'good', text: 'Exported.' });
      },
      (e: unknown) => setMessage({ tone: 'error', text: errorText(e) }),
    );
  };

  const chooseFile = (file: File | undefined): void => {
    if (!file) return;
    file.text().then(
      (text) => {
        setMessage(null);
        setPendingImport({ name: file.name, text });
      },
      (e: unknown) => setMessage({ tone: 'error', text: errorText(e) }),
    );
  };

  const confirmImport = (): void => {
    if (!pendingImport) return;
    actions.importJson(pendingImport.text).then(
      () => setMessage({ tone: 'good', text: `Imported ${pendingImport.name}.` }),
      (e: unknown) => setMessage({ tone: 'error', text: `Import failed: ${errorText(e)}` }),
    );
    setPendingImport(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <div className="stack-tight">
      <div className="row">
        <Button onClick={exportJson}>Export JSON</Button>
        <Button onClick={() => fileInput.current?.click()}>Import JSON…</Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => chooseFile(e.target.files?.[0])}
        />
        <ConfirmButton
          prompt="Delete all progress, notes and settings?"
          confirmLabel="Yes, reset everything"
          onConfirm={() => void actions.reset()}
        >
          Reset all data
        </ConfirmButton>
      </div>
      {pendingImport ? (
        <div className="row">
          <span>
            Replace all current data with <strong>{pendingImport.name}</strong>? The file is validated first.
          </span>
          <Button variant="danger" onClick={confirmImport}>
            Import and replace
          </Button>
          <Button variant="ghost" onClick={() => setPendingImport(null)}>
            Cancel
          </Button>
        </div>
      ) : null}
      {message ? <p className={message.tone === 'good' ? 'tone-good' : 'error'}>{message.text}</p> : null}
    </div>
  );
}

export function SettingsView({ state, actions }: { state: AppState; actions: AppActions }) {
  const [message, setMessage] = useState<Message | null>(null);
  return (
    <div className="stack narrow-left">
      <Card title="Settings">
        <SettingsForm
          key={JSON.stringify(state.settings)}
          state={state}
          actions={actions}
          message={message}
          setMessage={setMessage}
        />
      </Card>
      <Card title="Your data">
        <p className="muted">
          Everything is stored locally in this browser. Export a backup, restore one, or start over.
        </p>
        <DataSection actions={actions} />
      </Card>
    </div>
  );
}
