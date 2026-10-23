// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultState } from '../core/state';
import { NotesMarkdownExport } from './NotesMarkdownExport';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('NotesMarkdownExport', () => {
  it('explains empty notes and does not offer an empty download', () => {
    render(<NotesMarkdownExport state={defaultState('2025-01-01')} />);
    expect(screen.getByRole('button', { name: 'Export all notes (.md)' })).toHaveProperty('disabled', true);
    expect(screen.getByText('No notes saved yet.')).toBeTruthy();
  });
  it('downloads all notes as a dated Markdown file and revokes the temporary URL', () => {
    const create = vi.fn(() => 'blob:notes');
    const revoke = vi.fn();
    vi.stubGlobal('URL', class extends URL { static override createObjectURL = create; static override revokeObjectURL = revoke; });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const state = defaultState('2025-01-01');
    state.notes['two-sum'] = { slug: 'two-sum', trigger: 'cue', principle: 'mine', pitfall: '', complexity: 'O(n)', code: 'my_code()', updatedAt: '2025-01-01' };
    render(<NotesMarkdownExport state={state} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export all notes (.md)' }));
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]).toHaveLength(1);
    expect(click).toHaveBeenCalledOnce();
    const link = click.mock.instances[0] as HTMLAnchorElement;
    expect(link.download).toMatch(/^leetcode-assist-notes-\d{4}-\d{2}-\d{2}\.md$/);
    expect(link.href).toBe('blob:notes');
    expect(revoke).toHaveBeenCalledWith('blob:notes');
    expect(screen.getByRole('status').textContent).toBe('All notes exported as Markdown.');
  });
});
