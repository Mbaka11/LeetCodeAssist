// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OutcomeForm } from './OutcomeForm';

afterEach(cleanup);

function setup(today = '2025-01-06') {
  const save = vi.fn();
  const cancel = vi.fn();
  const form = (date: string, submitting = false) => (
    <OutcomeForm today={date} initialMinutes={30} initialOutcome="solo" onSubmit={save} onCancel={cancel} submitting={submitting} />
  );
  const view = render(form(today));
  return { save, cancel, update: (date: string, submitting = false) => view.rerender(form(date, submitting)) };
}

const saveButton = (): HTMLButtonElement => screen.getByRole('button', { name: 'Save result' }) as HTMLButtonElement;

describe('automatic Finish training date', () => {
  it('displays the training date without asking for a date choice', () => {
    const { save } = setup();
    expect(screen.queryByRole('combobox', { name: 'Completed on' })).toBeNull();
    expect(screen.getByText('2025-01-06')).toBeTruthy();
    expect(screen.getByText(/day changes at 04:00/)).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(saveButton());
    expect(save).toHaveBeenCalledExactlyOnceWith('solo', undefined, '2025-01-06');
  });

  it('keeps outcome and edited minutes when the automatic training date advances at 04:00', () => {
    const { save, update } = setup();
    fireEvent.click(screen.getByRole('radio', { name: /Hint/ }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Time logged (min)' }), { target: { value: '25' } });
    update('2025-01-07');
    expect(screen.getByText('2025-01-07')).toBeTruthy();
    fireEvent.click(saveButton());
    expect(save).toHaveBeenCalledExactlyOnceWith('hint', 25 * 60_000, '2025-01-07');
  });

  it('does not freeze an old training date in a form left open overnight', () => {
    const { save, update } = setup('2025-12-31');
    update('2026-01-01');
    fireEvent.click(saveButton());
    expect(save).toHaveBeenCalledExactlyOnceWith('solo', undefined, '2026-01-01');
  });

  it('still rejects invalid minutes', () => {
    const { save } = setup();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Time logged (min)' }), { target: { value: '-1' } });
    expect(saveButton().disabled).toBe(true);
    fireEvent.click(saveButton());
    expect(save).not.toHaveBeenCalled();
  });

  it('disables duplicate saves and cancellation while saving', () => {
    const { save, cancel, update } = setup();
    update('2025-01-06', true);
    fireEvent.click(screen.getByRole('button', { name: 'Saving…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(save).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });
});
