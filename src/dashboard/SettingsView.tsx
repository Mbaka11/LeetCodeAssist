import { useRef, useState, type FormEvent } from 'react';
import { SyncSettings, SyncBackups, useSyncInfo } from './SyncSettings';
import { NotesMarkdownExport } from '../components/NotesMarkdownExport';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ConfirmButton } from '../components/ConfirmButton';
import { BUDGETED_TYPES, DEFAULT_BUDGETS, DIFFICULTIES, effectiveBudgets } from '../core/activities';
import { localDateFromTimestamp } from '../core/dates';
import { BUDGET_MAX_MINUTES, BUDGET_MIN_MINUTES } from '../core/state';
import type { AppState, BudgetOverrides, BudgetedType, Difficulty } from '../core/types';
import type { AppActions } from '../lib/actions';
import { ACTIVITY_LABELS } from '../lib/instructions';
import { chromeLeetCodeStorage } from '../lib/leetcodeStorage';
import { backupBeforeLocalReplace } from '../lib/sync';
import { LeetCodeDetectionCard, LeetCodeProfileCard } from './LeetCodeSettings';

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

type BudgetInputs = Record<BudgetedType, Record<Difficulty, string>>;

/** The cells that differ from the defaults, or undefined when none does. Throws on an invalid cell. */
function overridesFromInputs(inputs: BudgetInputs): BudgetOverrides | undefined {
  const overrides: BudgetOverrides = {};
  for (const type of BUDGETED_TYPES) {
    for (const difficulty of DIFFICULTIES) {
      const minutes = Number(inputs[type][difficulty]);
      if (!Number.isInteger(minutes) || minutes < BUDGET_MIN_MINUTES || minutes > BUDGET_MAX_MINUTES) {
        throw new Error(
          `${ACTIVITY_LABELS[type]} ${difficulty}: enter whole minutes from ${BUDGET_MIN_MINUTES} to ${BUDGET_MAX_MINUTES}.`,
        );
      }
      if (minutes !== DEFAULT_BUDGETS[type][difficulty]) {
        overrides[type] = { ...overrides[type], [difficulty]: minutes };
      }
    }
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

function inputsFrom(overrides: BudgetOverrides | undefined): BudgetInputs {
  const table = effectiveBudgets(overrides);
  const inputs = {} as BudgetInputs;
  for (const type of BUDGETED_TYPES) {
    inputs[type] = {
      Easy: String(table[type].Easy),
      Medium: String(table[type].Medium),
      Hard: String(table[type].Hard),
    };
  }
  return inputs;
}

function BudgetsForm({
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
  const [inputs, setInputs] = useState<BudgetInputs>(() => inputsFrom(state.settings.budgets));

  const save = (event: FormEvent): void => {
    event.preventDefault();
    let budgets: BudgetOverrides | undefined;
    try {
      budgets = overridesFromInputs(inputs);
    } catch (e) {
      setMessage({ tone: 'error', text: errorText(e) });
      return;
    }
    actions.updateSettings({ budgets }).then(
      () => setMessage({ tone: 'good', text: 'Budgets saved.' }),
      (e: unknown) => setMessage({ tone: 'error', text: errorText(e) }),
    );
  };

  const reset = (): void => {
    setInputs(inputsFrom(undefined));
    actions.updateSettings({ budgets: undefined }).then(
      () => setMessage({ tone: 'good', text: 'Budgets reset to the defaults.' }),
      (e: unknown) => setMessage({ tone: 'error', text: errorText(e) }),
    );
  };

  return (
    <form className="stack-tight" onSubmit={save}>
      <table className="table budget-table">
        <thead>
          <tr>
            <th>Activity</th>
            {DIFFICULTIES.map((difficulty) => (
              <th key={difficulty}>{difficulty}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BUDGETED_TYPES.map((type) => (
            <tr key={type}>
              <th scope="row">{ACTIVITY_LABELS[type]}</th>
              {DIFFICULTIES.map((difficulty) => (
                <td key={difficulty}>
                  <input
                    type="number"
                    min={BUDGET_MIN_MINUTES}
                    max={BUDGET_MAX_MINUTES}
                    step={1}
                    required
                    aria-label={`${ACTIVITY_LABELS[type]} ${difficulty} budget in minutes`}
                    value={inputs[type][difficulty]}
                    onChange={(e) => {
                      const { value } = e.target;
                      setInputs((prev) => ({ ...prev, [type]: { ...prev[type], [difficulty]: value } }));
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <Button type="submit" variant="primary">
          Save budgets
        </Button>
        <Button onClick={reset}>
          Reset to defaults
        </Button>
        {message ? (
          <span className={message.tone === 'good' ? 'tone-good' : 'error'}>{message.text}</span>
        ) : null}
      </div>
    </form>
  );
}

function DataSection({ actions }: { actions: AppActions }) {
  const sync = useSyncInfo();
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
    const { name, text } = pendingImport;
    // With sync enabled the current data is saved locally first; the import is stopped if that backup cannot be stored.
    const backup = typeof chrome !== 'undefined' && chrome.storage?.local ? backupBeforeLocalReplace(chrome.storage.local) : Promise.resolve();
    backup.then(() => actions.importJson(text)).then(
      () => setMessage({ tone: 'good', text: `Imported ${name}.` }),
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
          onConfirm={() => {
            void actions.reset();
            chromeLeetCodeStorage().clearAll().catch(() => undefined);
          }}
        >
          Reset all data
        </ConfirmButton>
      </div>
      {pendingImport ? (
        <div className="row">
          <span>
            Replace all current data with <strong>{pendingImport.name}</strong>? The file is validated first.
            {sync.config.enabled ? ' Sync is enabled: this import is a local change set and will propagate to your other devices (overlapping remote changes may require choices).' : ''}
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
  const [budgetMessage, setBudgetMessage] = useState<Message | null>(null);
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
      <Card title="Time budgets (minutes)">
        <p className="muted">
          How long each activity should take, by problem difficulty. The planner, the calendar, the
          reminders and the cards all use these. Benchmarks stay at 30 min per problem.
        </p>
        <BudgetsForm
          key={JSON.stringify(state.settings.budgets ?? null)}
          state={state}
          actions={actions}
          message={budgetMessage}
          setMessage={setBudgetMessage}
        />
      </Card>
      <SyncSettings />
      <LeetCodeDetectionCard />
      <LeetCodeProfileCard />
      <Card title="Your data">
        <p className="muted">
          Data is stored locally, and also in Chrome sync only if you enable it. Export a backup, restore one, or start over. Resetting while sync is enabled only clears this device: the Chrome sync copy is kept, and after setup this device adopts it again. Disable sync first to start over without it.
        </p>
        <NotesMarkdownExport state={state} />
        <DataSection actions={actions} />
        <SyncBackups />
      </Card>
    </div>
  );
}
