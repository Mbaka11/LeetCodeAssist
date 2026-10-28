// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createActivity } from '../core/activities';
import { defaultState } from '../core/state';
import type { Activity, AppState } from '../core/types';
import { companyInterviewSlugs } from '../data/companies';
import { getProblem } from '../data/neetcode150';
import { createTestApp } from '../lib/testing';
import { PracticeView } from './PracticeView';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const NOW = new Date(2025, 5, 10, 12).getTime();
const slugs = companyInterviewSlugs('google').filter((s) => getProblem(s)).sort((a, b) => getProblem(a)!.neetcodeOrder - getProblem(b)!.neetcodeOrder);
const [s1, s2, s3] = slugs as [string, string, string];
const title = (slug: string) => getProblem(slug)!.title;
const activity = (slug: string, change: Partial<Activity>): Activity => ({ ...createActivity([], { slug, type: 'new', dueDate: '2025-06-01', createdAt: '2025-06-01' }), id: `${slug}-${change.type ?? 'new'}-${change.dueDate ?? ''}`, ...change });

async function setup(initial: AppState = defaultState('2025-01-01')) {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  const app = createTestApp(initial);
  function Harness() {
    const snapshot = useSyncExternalStore(app.store.subscribe, app.store.getSnapshot);
    return snapshot.status === 'ready' ? <PracticeView state={snapshot.state} actions={app.actions} /> : null;
  }
  render(<Harness />);
  await screen.findByRole('button', { name: 'Start interview' });
  fireEvent.click(screen.getByRole('button', { name: 'Interview prep' }));
  return app;
}

describe('Interview prep tab', () => {
  it('sets a prep from enabled companies and a date within today..+365 days, showing days left', async () => {
    const { store } = await setup();
    const pool = screen.getByLabelText('Company');
    for (const name of ['Shopify', 'Stripe', 'Datadog', 'Snowflake']) {
      expect((within(pool).getByRole('option', { name: `${name} — Not enough documented data` }) as HTMLOptionElement).disabled).toBe(true);
    }
    expect((within(pool).getByRole('option', { name: /Google — \d+ documented topics/ }) as HTMLOptionElement).disabled).toBe(false);
    const date = screen.getByLabelText('Interview date') as HTMLInputElement;
    expect([date.min, date.max]).toEqual(['2025-06-10', '2026-06-10']);
    const save = screen.getByRole('button', { name: 'Save interview prep' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(pool, { target: { value: 'google' } });
    for (const bad of ['2025-06-09', '2026-06-11', '']) {
      fireEvent.change(date, { target: { value: bad } });
      expect(save.disabled).toBe(true);
    }
    fireEvent.change(date, { target: { value: '2025-06-24' } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    const summary = await screen.findByLabelText('Interview prep summary');
    expect(within(summary).getByRole('heading', { name: 'Google · 2025-06-24' })).toBeTruthy();
    expect(within(summary).getByText('14 days left')).toBeTruthy();
    expect((await store.readState()).interviewPrep).toEqual({ companyId: 'google', date: '2025-06-24', createdAt: NOW });
  });

  it('lists the documented problems with status, untouched, slowest, fragile and scheduled reviews', async () => {
    const state: AppState = {
      ...defaultState('2025-01-01'),
      interviewPrep: { companyId: 'google', date: '2025-06-24', createdAt: 1 },
      problemStatus: { [s1]: 'learning' },
      activities: [
        activity(s1, { status: 'done', completedAt: '2025-06-01', outcome: 'stuck', totalMs: 40 * 60_000 }),
        activity(s2, { status: 'done', completedAt: '2025-06-02', outcome: 'solo', totalMs: 12 * 60_000 }),
        activity(s2, { type: 'recall', dueDate: '2025-06-20' }),
        activity(s3, { type: 'blind', dueDate: '2025-06-24' }),
      ],
    };
    const { store } = await setup(state);
    const before = await store.readState();
    const summary = await screen.findByLabelText('Interview prep summary');
    const problems = within(within(summary).getByLabelText('Documented problems')).getAllByRole('row').slice(1);
    expect(problems.map((row) => within(row).getAllByRole('cell')[0]!.textContent)).toEqual(slugs.map(title));
    expect(within(problems[0]!).getByText(/learning/)).toBeTruthy();
    expect(within(problems[0]!).getByText('40 min median · 1 attempt')).toBeTruthy();
    expect(within(problems[1]!).getByText('untouched')).toBeTruthy();
    expect(within(summary).getByLabelText('Untouched problems').textContent).toContain(`Untouched (${slugs.length - 2})`);
    expect(within(within(summary).getByLabelText('Untouched problems')).queryByText(title(s1))).toBeNull();
    expect(within(within(summary).getByLabelText('Untouched problems')).getByText(title(s3))).toBeTruthy();
    const slowest = within(summary).getByLabelText('Slowest problems');
    expect(within(slowest).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      `${title(s1)} — 40 min median · 1 attempt`, `${title(s2)} — 12 min median · 1 attempt`]);
    expect(slowest.textContent).toContain('not adjusted for difficulty');
    expect(within(within(summary).getByLabelText('Fragile problems')).getByText(`${title(s1)} — Latest eligible attempt was Stuck`)).toBeTruthy();
    const scheduled = within(summary).getByLabelText('Scheduled reviews before the interview');
    expect(within(scheduled).getAllByRole('listitem').map((li) => li.textContent)).toEqual([`2025-06-20 — ${title(s2)} (Recall)`]);
    expect(summary.textContent).toContain('Nothing is added or moved');
    // Purely informational: viewing changes nothing.
    expect(await store.readState()).toEqual(before);
  });

  it('shows a passed date as passed and lists no upcoming reviews', async () => {
    await setup({ ...defaultState('2025-01-01'), interviewPrep: { companyId: 'google', date: '2025-06-08', createdAt: 1 },
      activities: [activity(s1, { type: 'recall', dueDate: '2025-06-07' })] });
    const summary = await screen.findByLabelText('Interview prep summary');
    expect(within(summary).getByText('This interview date has passed (2 days ago)')).toBeTruthy();
    const scheduled = within(summary).getByLabelText('Scheduled reviews before the interview');
    expect(within(scheduled).queryAllByRole('listitem')).toEqual([]);
    expect(within(scheduled).getByText('The interview date has passed.')).toBeTruthy();
  });

  it('shows today and tomorrow wording', async () => {
    await setup({ ...defaultState('2025-01-01'), interviewPrep: { companyId: 'google', date: '2025-06-10', createdAt: 1 } });
    expect(await screen.findByText('The interview is today')).toBeTruthy();
    cleanup();
    await setup({ ...defaultState('2025-01-01'), interviewPrep: { companyId: 'google', date: '2025-06-11', createdAt: 1 } });
    expect(await screen.findByText('1 day left')).toBeTruthy();
  });

  it('keeps a prep for a company without enough documented data visible but cannot start its simulation', async () => {
    await setup({ ...defaultState('2025-01-01'), interviewPrep: { companyId: 'shopify', date: '2025-06-24', createdAt: 1 } });
    const summary = await screen.findByLabelText('Interview prep summary');
    expect(within(summary).getByText(/no longer has enough documented coding problems/)).toBeTruthy();
    expect((within(summary).getByRole('button', { name: 'Start a Shopify simulation' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('opens the simulation setup with the company pool chosen', async () => {
    await setup({ ...defaultState('2025-01-01'), interviewPrep: { companyId: 'google', date: '2025-06-24', createdAt: 1 } });
    fireEvent.click(await screen.findByRole('button', { name: 'Start a Google simulation' }));
    expect((screen.getByLabelText('Interview pool', { exact: true }) as HTMLSelectElement).value).toBe('google');
    expect((screen.getByRole('button', { name: 'Start interview' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Start two-problem session' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('edits the prep (company and date) and clears it with confirmation', async () => {
    const { store } = await setup({ ...defaultState('2025-01-01'), interviewPrep: { companyId: 'google', date: '2025-06-24', createdAt: 7 }, checked: { [s1]: true } });
    fireEvent.click(await screen.findByRole('button', { name: 'Edit prep' }));
    expect((screen.getByLabelText('Company') as HTMLSelectElement).value).toBe('google');
    expect((screen.getByLabelText('Interview date') as HTMLInputElement).value).toBe('2025-06-24');
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'amazon' } });
    fireEvent.change(screen.getByLabelText('Interview date'), { target: { value: '2025-07-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save interview prep' }));
    await screen.findByRole('heading', { name: 'Amazon · 2025-07-01' });
    expect((await store.readState()).interviewPrep).toEqual({ companyId: 'amazon', date: '2025-07-01', createdAt: 7 });
    fireEvent.click(screen.getByRole('button', { name: 'Edit prep' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'Amazon · 2025-07-01' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear prep' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear prep' }));
    await waitFor(() => expect(screen.queryByLabelText('Interview prep summary')).toBeNull());
    const after = await store.readState();
    expect('interviewPrep' in after).toBe(false);
    expect(after.checked).toEqual({ [s1]: true });
    expect(screen.getByRole('button', { name: 'Save interview prep' })).toBeTruthy();
  });

  it('shows a save error without losing the form', async () => {
    const { actions } = await setup();
    vi.spyOn(actions, 'saveInterviewPrep').mockRejectedValueOnce(new Error('Storage is full'));
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'google' } });
    fireEvent.change(screen.getByLabelText('Interview date'), { target: { value: '2025-06-24' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save interview prep' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Storage is full');
    expect((screen.getByLabelText('Interview date') as HTMLInputElement).value).toBe('2025-06-24');
  });
});
