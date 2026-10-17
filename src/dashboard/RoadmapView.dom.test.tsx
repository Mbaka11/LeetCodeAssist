// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultState } from '../core/state';
import type { AppState } from '../core/types';
import { CATEGORIES } from '../data/neetcode150';
import type { AppActions } from '../lib/actions';
import { STORAGE_KEY, type AppStore } from '../lib/storage';
import { createTestApp } from '../lib/testing';
import { RoadmapView } from './RoadmapView';

afterEach(cleanup);

function Harness({ store, actions }: { store: AppStore; actions: AppActions }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return snapshot.status === 'ready' ? <RoadmapView state={snapshot.state} actions={actions} /> : null;
}

const stored = (mock: { data: Record<string, unknown> }): AppState => mock.data[STORAGE_KEY] as AppState;
const counters = (container: HTMLElement): string =>
  container.querySelector('.catalog-counters')!.textContent!.replace(/\s+/g, ' ').trim();

describe('RoadmapView catalog selection (DOM)', () => {
  it('persists the catalog independently of the layout and keeps both counters visible', async () => {
    const { mock, store, actions } = createTestApp(defaultState('2025-01-06'));
    const { container } = render(<Harness store={store} actions={actions} />);
    await waitFor(() => expect(screen.getByText('NeetCode 150 roadmap')).toBeTruthy());
    expect(counters(container)).toBe('NeetCode 150 0/150 · Blind 75 0/75');

    fireEvent.click(screen.getByRole('button', { name: 'Blind 75' }));
    await waitFor(() => expect(screen.getByText('Blind 75 roadmap')).toBeTruthy());
    expect(stored(mock).settings.roadmapCatalog).toBe('blind75');
    expect(stored(mock).settings.roadmapView).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Blind 75' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Tree' }).getAttribute('aria-pressed')).toBe('true');
    expect(counters(container)).toBe('NeetCode 150 0/150 · Blind 75 0/75');

    fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
    await waitFor(() => expect(stored(mock).settings.roadmapView).toBe('grid'));
    expect(stored(mock).settings.roadmapCatalog).toBe('blind75');
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(75);

    fireEvent.click(screen.getByRole('button', { name: 'NeetCode 150' }));
    await waitFor(() => expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(150));
    expect(stored(mock).settings.roadmapCatalog).toBe('neetcode150');
    expect(stored(mock).settings.roadmapView).toBe('grid');
  });

  it('shares one checkbox state across catalogs and counts overlap in both counters', async () => {
    const { mock, store, actions } = createTestApp({
      ...defaultState('2025-01-06'),
      settings: { ...defaultState('2025-01-06').settings, roadmapView: 'grid' },
    });
    const { container } = render(<Harness store={store} actions={actions} />);
    await waitFor(() => expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(150));

    // Tick a Blind 75 problem and a NeetCode-150-only problem while the NeetCode 150 is selected.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Two Sum solved' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Min Stack solved' }));
    await waitFor(() => expect(counters(container)).toBe('NeetCode 150 2/150 · Blind 75 1/75'));
    expect(stored(mock).checked).toEqual({ 'two-sum': true, 'min-stack': true });

    fireEvent.click(screen.getByRole('button', { name: 'Blind 75' }));
    await waitFor(() => expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(75));
    expect((screen.getByRole('checkbox', { name: 'Two Sum solved' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole('checkbox', { name: 'Min Stack solved' })).toBeNull();
    expect(counters(container)).toBe('NeetCode 150 2/150 · Blind 75 1/75');

    // Unticking in the Blind 75 view is the same stored check: no second progress store.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Two Sum solved' }));
    await waitFor(() => expect(counters(container)).toBe('NeetCode 150 1/150 · Blind 75 0/75'));
    expect(stored(mock).checked['two-sum']).toBeFalsy();
  });

  it('selects every category of the tree in the Blind 75 without crashing', async () => {
    const { store, actions } = createTestApp({
      ...defaultState('2025-01-06'),
      settings: { ...defaultState('2025-01-06').settings, roadmapCatalog: 'blind75' },
    });
    const { container } = render(<Harness store={store} actions={actions} />);
    await waitFor(() => expect(container.querySelectorAll('.tree-node')).toHaveLength(CATEGORIES.length));
    for (const node of [...container.querySelectorAll<HTMLElement>('.tree-node')]) {
      fireEvent.click(node);
      const panel = container.querySelector('section.category')!;
      expect(within(panel as HTMLElement).getByRole('heading', { level: 2 }).textContent).toBe(
        node.querySelector('strong')!.textContent,
      );
    }
  });
});
