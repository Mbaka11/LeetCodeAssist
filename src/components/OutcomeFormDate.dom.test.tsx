// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OutcomeForm } from './OutcomeForm';

afterEach(cleanup);

function setup(today = '2025-01-07') {
  const save = vi.fn();
  const cancel = vi.fn();
  const form = (date: string, submitting = false) => (
    <OutcomeForm today={date} initialMinutes={30} initialOutcome="solo" onSubmit={save} onCancel={cancel} submitting={submitting} />
  );
  const view = render(form(today));
  return { save, cancel, update: (date: string, submitting = false) => view.rerender(form(date, submitting)) };
}

const selectedDate = (): string => (screen.getByRole('combobox', { name: 'Completed on' }) as HTMLSelectElement).value;
const saveButton = (): HTMLButtonElement => screen.getByRole('button', { name: 'Save result' }) as HTMLButtonElement;

describe('Finish completion date', () => {
  it('defaults to the displayed Today date and sends it explicitly', () => {
    const { save } = setup();
    expect(selectedDate()).toBe('2025-01-07');
    expect(screen.getByRole('option', { name: 'Yesterday (2025-01-06)' })).toBeTruthy();
    fireEvent.click(saveButton());
    expect(save).toHaveBeenCalledExactlyOnceWith('solo', undefined, '2025-01-07');
  });

  it('sends Yesterday without changing the timer total or saving on selection', () => {
    const { save } = setup();
    fireEvent.change(screen.getByRole('combobox', { name: 'Completed on' }), { target: { value: '2025-01-06' } });
    expect(save).not.toHaveBeenCalled();
    expect((screen.getByRole('spinbutton', { name: 'Time logged (min)' }) as HTMLInputElement).value).toBe('30');
    expect(screen.getByText(/Choosing Yesterday can make a review due today/)).toBeTruthy();
    fireEvent.click(saveButton());
    expect(save).toHaveBeenCalledExactlyOnceWith('solo', undefined, '2025-01-06');
  });

  it('keeps the chosen outcome and explicitly edited minutes with Yesterday', () => {
    const { save } = setup();
    fireEvent.change(screen.getByRole('combobox', { name: 'Completed on' }), { target: { value: '2025-01-06' } });
    fireEvent.click(screen.getByRole('radio', { name: /Hint/ }));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Time logged (min)' }), { target: { value: '25' } });
    fireEvent.click(saveButton());
    expect(save).toHaveBeenCalledExactlyOnceWith('hint', 25 * 60_000, '2025-01-06');
  });

  it('keeps the selected calendar date when the open form crosses midnight', () => {
    const { save, update } = setup('2025-12-31');
    update('2026-01-01');
    expect(selectedDate()).toBe('2025-12-31');
    expect((screen.getByRole('option', { name: 'Yesterday (2025-12-31)' }) as HTMLOptionElement).selected).toBe(true);
    fireEvent.click(saveButton());
    expect(save).toHaveBeenCalledExactlyOnceWith('solo', undefined, '2025-12-31');
  });

  it('requires a new choice if the selected date becomes older than yesterday', () => {
    const { save, update } = setup();
    fireEvent.change(screen.getByRole('combobox', { name: 'Completed on' }), { target: { value: '2025-01-06' } });
    update('2025-01-08');
    expect(selectedDate()).toBe('2025-01-06');
    expect(screen.getByRole('alert').textContent).toContain('Choose a date again');
    expect(saveButton().disabled).toBe(true);
    fireEvent.click(saveButton());
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Completed on' }), { target: { value: '2025-01-07' } });
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    expect(save).toHaveBeenCalledExactlyOnceWith('solo', undefined, '2025-01-07');
  });

  it('disables date editing, duplicate saves and cancellation while saving', () => {
    const { save, cancel, update } = setup();
    update('2025-01-07', true);
    expect((screen.getByRole('combobox', { name: 'Completed on' }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Saving…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(save).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });
});
