// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultState } from '../core/state';
import { createTestApp } from '../lib/testing';
import { ProblemView } from './ProblemView';

afterEach(cleanup);
describe('ProblemView favorites', () => {
  it('stars and unstars the problem without changing the solved checkbox, notes or work', async () => {
    const { store, actions } = createTestApp(defaultState('2025-01-01'));
    function Harness() {
      const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
      return snapshot.status === 'ready' ? <ProblemView slug="two-sum" state={snapshot.state} actions={actions} /> : null;
    }
    render(<Harness />);
    const star = await screen.findByRole('button', { name: 'Favorite Two Sum' });
    fireEvent.click(star);
    await waitFor(() => expect(star.getAttribute('aria-pressed')).toBe('true'));
    fireEvent.click(star);
    await waitFor(() => expect(star.getAttribute('aria-pressed')).toBe('false'));
    expect(await store.readState()).toEqual({ ...defaultState('2025-01-01'), favorites: { 'two-sum': false } });
  });
});
