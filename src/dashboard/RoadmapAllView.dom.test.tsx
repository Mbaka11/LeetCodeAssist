// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogProblems } from '../core/catalog';
import { COMPANIES, COMPANY_EVIDENCE, getProblemMetadata } from '../core/problemMetadata';
import { defaultState } from '../core/state';
import type { AppState } from '../core/types';
import { CATEGORY_NAMES } from '../data/neetcode150';
import { isBonusProblem } from '../data/bonus';
import { isPremiumProblem } from '../data/premium';
import { BENCHMARKS, PROGRAM_QUEUE } from '../data/program';
import type { AppActions } from '../lib/actions';
import { STORAGE_KEY, type AppStore } from '../lib/storage';
import { createTestApp } from '../lib/testing';
import { RoadmapView } from './RoadmapView';

afterEach(cleanup);
function Harness({ store, actions }: { store: AppStore; actions: AppActions }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return snapshot.status === 'ready' ? <RoadmapView state={snapshot.state} actions={actions} /> : null;
}
function setup(patch: Partial<AppState> = {}) {
  const state: AppState = { ...defaultState('2025-01-06'), settings: { ...defaultState('2025-01-06').settings, roadmapView: 'all' }, ...patch };
  const app = createTestApp(state);
  const rendered = render(<Harness store={app.store} actions={app.actions} />);
  return { ...app, ...rendered, state };
}
function select(label: string, value: string) { fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } }); }
function rowSlugs(container: HTMLElement) { return [...container.querySelectorAll<HTMLAnchorElement>('.problem-row .choice a')].map((a) => a.hash.replace('#/problem/', '')); }

describe('Roadmap All presentation and local filters', () => {
  it('expands all 150 in existing category order; switches catalog and resets local filters without changing layout', async () => {
    const { container, mock } = setup();
    await screen.findByText('Showing 150 of 150');
    expect(rowSlugs(container)).toEqual(catalogProblems('neetcode150').map((p) => p.slug));
    expect([...container.querySelectorAll('.category h2')].map((h) => h.textContent)).toEqual(CATEGORY_NAMES);
    expect([...container.querySelectorAll<HTMLDetailsElement>('.category details')].every((d) => d.open)).toBe(true);
    const first = container.querySelector<HTMLDetailsElement>('.category details')!;
    first.open = false;
    fireEvent(first, new Event('toggle'));
    expect(first.open).toBe(false);
    select('Category', 'Stack');
    select('Search titles', 'MIN STACK');
    expect(screen.getByText('Showing 1 of 150')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Blind 75' }));
    await screen.findByText('Showing 75 of 75');
    expect(rowSlugs(container)).toEqual(catalogProblems('blind75').map((p) => p.slug));
    expect((screen.getByLabelText('Category', { exact: true }) as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('Search titles') as HTMLInputElement).value).toBe('');
    const stored = mock.data[STORAGE_KEY] as AppState;
    expect(stored.settings.roadmapView).toBe('all');
    expect(stored.activities).toEqual([]);
  });

  it('filters title case-insensitively, combines filters, clears empty states and never rewrites counters/progress', async () => {
    const { container, mock } = setup({ checked: { 'two-sum': true }, problemStatus: { 'two-sum': 'learning' } });
    await screen.findByText('Showing 150 of 150');
    const counters = container.querySelector('.catalog-counters')!.textContent;
    select('Search titles', '  tWo SuM  ');
    expect(rowSlugs(container)).toEqual(['two-sum', 'two-sum-ii-input-array-is-sorted']);
    select('Difficulty', 'Easy');
    select('Learning status', 'learning');
    expect(rowSlugs(container)).toEqual(['two-sum']);
    expect(screen.getByText('Showing 1 of 150')).toBeTruthy();
    select('Access', 'premium');
    expect(screen.getByText('Showing 0 of 150')).toBeTruthy();
    expect(screen.getByText(/No problems match these filters/)).toBeTruthy();
    expect(container.querySelector('.catalog-counters')!.textContent).toBe(counters);
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(rowSlugs(container)).toHaveLength(150);
    expect((mock.data[STORAGE_KEY] as AppState).checked).toEqual({ 'two-sum': true });
    expect((mock.data[STORAGE_KEY] as AppState).activities).toEqual([]);
  });

  it('filters access, program/bonus/outside, technique, structure and only sourced companies', async () => {
    const { container } = setup();
    await screen.findByText('Showing 150 of 150');
    const problems = catalogProblems('neetcode150');
    const program = new Set<string>([...PROGRAM_QUEUE, ...BENCHMARKS.flatMap((b) => [b.easy, b.medium])]);
    const checks = [
      ['Access', 'premium', problems.filter((p) => isPremiumProblem(p.slug))],
      ['Access', 'free', problems.filter((p) => !isPremiumProblem(p.slug))],
      ['Program membership', 'program', problems.filter((p) => program.has(p.slug))],
      ['Program membership', 'bonus', problems.filter((p) => isBonusProblem(p.slug))],
      ['Program membership', 'outside', problems.filter((p) => !program.has(p.slug) && !isBonusProblem(p.slug))],
      ['Technique', 'Hashing', problems.filter((p) => getProblemMetadata(p.slug)?.techniques.includes('Hashing'))],
      ['Data structure', 'Array', problems.filter((p) => getProblemMetadata(p.slug)?.dataStructures.includes('Array'))],
      ['Company evidence', 'amazon', problems.filter((p) => getProblemMetadata(p.slug)?.companyEvidence.evidence.some((row) => row.companyId === 'amazon'))],
    ] as const;
    for (const [label, value, expected] of checks) {
      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
      select(label, value);
      expect(rowSlugs(container), `${label} ${value}`).toEqual(expected.map((p) => p.slug));
    }
    expect(within(screen.getByLabelText('Company evidence', { exact: true })).getAllByRole('option').map((o) => o.textContent)).toEqual(['Any', ...COMPANIES.filter((c) => COMPANY_EVIDENCE.some((row) => row.companyId === c.id)).map((c) => c.name)]);
  });

  it('filters every company with documented evidence, without premium-derived or unknown options', async () => {
    const { container } = setup();
    await screen.findByText('Showing 150 of 150');
    for (const company of COMPANIES.filter((c) => COMPANY_EVIDENCE.some((row) => row.companyId === c.id))) {
      select('Company evidence', company.id);
      expect(rowSlugs(container)).toEqual(catalogProblems('neetcode150').filter((p) => getProblemMetadata(p.slug)?.companyEvidence.evidence.some((row) => row.companyId === company.id)).map((p) => p.slug));
    }
  });

  it('keeps compact badges/links; persists Detailed and hides tags while clearing and disabling tag filters', async () => {
    const { container, mock } = setup();
    await screen.findByText('Showing 150 of 150');
    expect(container.querySelectorAll('.metadata-tags')).toHaveLength(0);
    expect(container.querySelector('.problem-row .choice a')!.getAttribute('href')).toBe('#/problem/contains-duplicate');
    expect(container.querySelector('.problem-row a[href="https://leetcode.com/problems/contains-duplicate/"]')).toBeTruthy();
    expect(screen.getAllByText('Premium')).toHaveLength(8); // option plus seven row badges
    expect(screen.getAllByText('Benchmark').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bonus').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Detailed' }));
    await waitFor(() => expect(container.querySelectorAll('[aria-label="Data structures and techniques"]')).toHaveLength(150));
    expect(screen.getByText('Reported at Amazon — LRU Cache variation')).toBeTruthy();
    expect(screen.getAllByText('Company evidence: not documented')).toHaveLength(catalogProblems('neetcode150').filter((p) => !getProblemMetadata(p.slug)?.companyEvidence.evidence.length).length);
    select('Technique', 'Hashing');
    expect(rowSlugs(container).length).toBeLessThan(150);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide techniques / solution hints' }));
    await screen.findByText('Showing 150 of 150');
    expect(container.querySelector('[aria-label="Data structures and techniques"]')).toBeNull();
    for (const label of ['Technique', 'Data structure']) {
      const filter = screen.getByLabelText(label, { exact: true }) as HTMLSelectElement;
      expect(filter.disabled).toBe(true);
      expect(filter.value).toBe('');
      expect(filter.options.length).toBe(1);
    }
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide techniques / solution hints' }));
    await waitFor(() => expect(container.querySelectorAll('[aria-label="Data structures and techniques"]')).toHaveLength(150));
    expect((mock.data[STORAGE_KEY] as AppState).settings).toMatchObject({ roadmapDetail: 'detailed', roadmapHideTechniques: false });
    fireEvent.click(screen.getByRole('button', { name: 'Compact' }));
    await waitFor(() => expect(container.querySelectorAll('[aria-label="Data structures and techniques"]')).toHaveLength(0));
  });

  it('exposes company sources and caveats through an inline native disclosure instead of a hover-only tooltip', async () => {
    const { container, mock } = setup();
    await screen.findByText('Showing 150 of 150');
    fireEvent.click(screen.getByRole('button', { name: 'Detailed' }));
    await screen.findByText('Reported at Amazon — LRU Cache variation');
    select('Company evidence', 'amazon');
    select('Search titles', 'LRU Cache');
    const before = structuredClone(mock.data[STORAGE_KEY]);
    const disclosure = container.querySelector<HTMLDetailsElement>('.company-evidence-disclosure')!;
    const summary = disclosure.querySelector('summary')!;
    expect(disclosure.open).toBe(false);
    expect(summary.textContent).toContain('Source and caveats');
    summary.focus();
    expect(document.activeElement).toBe(summary);
    fireEvent.click(summary);
    expect(disclosure.open).toBe(true);
    expect(within(disclosure).getByText(/exact canonical question is not verified/)).toBeTruthy();
    expect(within(disclosure).getByText(/not independently confirmed or employer-endorsed/)).toBeTruthy();
    expect(within(disclosure).getByText(/Publication date: unknown.*Interview date: 12\/13, year unknown/)).toBeTruthy();
    const link = within(disclosure).getByRole('link', { name: /Amazon India/ });
    expect(link.getAttribute('href')).toBe('https://leetcode.com/discuss/post/6304191/Amazon-India-or-SDE-1-or-University-Grad/');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    fireEvent.click(summary);
    expect(disclosure.open).toBe(false);
    expect(rowSlugs(container)).toEqual(['lru-cache']);
    expect(mock.data[STORAGE_KEY]).toEqual(before);
  });

  it('keeps company evidence inside the selected catalog and reports an empty intersection honestly', async () => {
    const state = defaultState('2025-01-06');
    const { container, mock } = setup({ settings: { ...state.settings, roadmapView: 'all', roadmapCatalog: 'blind75' } });
    await screen.findByText('Showing 75 of 75');
    select('Company evidence', 'amazon');
    expect(rowSlugs(container)).toEqual(catalogProblems('blind75').filter((p) => getProblemMetadata(p.slug)?.companyEvidence.evidence.some((row) => row.companyId === 'amazon')).map((p) => p.slug));
    select('Search titles', 'LRU Cache');
    expect(screen.getByText('Showing 0 of 75')).toBeTruthy();
    expect(rowSlugs(container)).toEqual([]); // The qualified LRU variation is not in Blind 75.
    expect(container.querySelector('.catalog-counters')!.textContent).toContain('0/150');
    expect(container.querySelector('.catalog-counters')!.textContent).toContain('0/75');
    expect((mock.data[STORAGE_KEY] as AppState).activities).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(rowSlugs(container)).toHaveLength(75);
  });

  it('reports preference save failure without changing rows or persisted progress', async () => {
    const { container, actions, mock } = setup({ checked: { 'two-sum': true } });
    await screen.findByText('Showing 150 of 150');
    const before = structuredClone(mock.data[STORAGE_KEY]);
    const update = vi.spyOn(actions, 'updateSettings').mockRejectedValueOnce(new Error('Synthetic storage failure'));
    fireEvent.click(screen.getByRole('button', { name: 'Detailed' }));
    await screen.findByText('Synthetic storage failure');
    expect(container.querySelectorAll('.problem-row-details')).toHaveLength(0);
    expect(rowSlugs(container)).toHaveLength(150);
    expect(mock.data[STORAGE_KEY]).toEqual(before);
    update.mockRestore();
  });

  it('shares check state with Grid and Tree without altering the existing views', async () => {
    const { container } = setup();
    await screen.findByText('Showing 150 of 150');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Two Sum solved' }));
    await waitFor(() => expect(container.querySelector('.catalog-counters')!.textContent).toContain('1/150'));
    for (const layout of ['Grid', 'Tree', 'List']) {
      fireEvent.click(screen.getByRole('button', { name: layout }));
      await waitFor(() => expect((screen.getByRole('checkbox', { name: 'Two Sum solved' }) as HTMLInputElement).checked).toBe(true));
    }
    expect(screen.getByText('Showing 150 of 150')).toBeTruthy();
  });
});

describe('Favorites and saved All filters', () => {
  it('shares stars in every layout and filters favorites without changing checkmarks or progress', async () => {
    const { container, store } = setup();
    await screen.findByText('Showing 150 of 150');
    const counters = container.querySelector('.catalog-counters')!.textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Favorite Two Sum' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Favorite Two Sum' }).getAttribute('aria-pressed')).toBe('true'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Favorites only' }));
    expect(rowSlugs(container)).toEqual(['two-sum']);
    expect(container.querySelector('.catalog-counters')!.textContent).toBe(counters);
    for (const layout of ['Grid', 'Tree', 'List']) {
      fireEvent.click(screen.getByRole('button', { name: layout }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Favorite Two Sum' }).getAttribute('aria-pressed')).toBe('true'));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Favorite Two Sum' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Favorite Two Sum' }).getAttribute('aria-pressed')).toBe('false'));
    const state = await store.readState();
    expect(state.favorites).toEqual({ 'two-sum': false });
    expect(state.activities).toEqual([]);
    expect(state.checked).toEqual({});
    expect(state.problemStatus).toEqual({});
  });

  it('saves, applies across catalogs, renames and deletes named filters by stable record ID', async () => {
    const { store } = setup();
    await screen.findByText('Showing 150 of 150');
    select('Search titles', 'sum');
    select('Difficulty', 'Easy');
    select('Filter name', 'Easy sums');
    fireEvent.click(screen.getByRole('button', { name: 'Save current filters' }));
    await screen.findByRole('option', { name: 'Easy sums' });
    const saved = (await store.readState()).savedRoadmapFilters!;
    const key = Object.keys(saved)[0]!;
    expect(saved[key]!.filters).toMatchObject({ search: 'sum', difficulty: 'Easy' });
    fireEvent.click(screen.getByRole('button', { name: 'Blind 75' }));
    await screen.findByText('Showing 75 of 75');
    select('Saved filter', key);
    fireEvent.click(screen.getByRole('button', { name: 'Apply filter' }));
    expect(screen.getByText('Showing 1 of 75')).toBeTruthy();
    select('Filter name', 'Renamed');
    fireEvent.click(screen.getByRole('button', { name: 'Rename filter' }));
    await screen.findByRole('option', { name: 'Renamed' });
    expect((await store.readState()).savedRoadmapFilters![key]!.filters).toEqual(saved[key]!.filters);
    fireEvent.click(screen.getByRole('button', { name: 'Delete filter' }));
    // Nothing is deleted until the inline confirmation; Cancel keeps the preset.
    expect(screen.getByText('Delete the saved filter "Renamed"?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('option', { name: 'Renamed' })).toBeTruthy();
    expect((await store.readState()).savedRoadmapFilters![key]).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Delete filter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete filter' }));
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Renamed' })).toBeNull());
    expect((await store.readState()).savedRoadmapFilters).toEqual({});
    expect((await store.readState()).activities).toEqual([]);
  });

  it('never restores technique hints from a preset when hints are hidden', async () => {
    const { store } = setup();
    await screen.findByText('Showing 150 of 150');
    select('Technique', 'Hashing');
    select('Data structure', 'Array');
    select('Filter name', 'Tags');
    fireEvent.click(screen.getByRole('button', { name: 'Save current filters' }));
    await screen.findByRole('option', { name: 'Tags' });
    const key = Object.keys((await store.readState()).savedRoadmapFilters!)[0]!;
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide techniques / solution hints' }));
    await screen.findByText('Showing 150 of 150');
    select('Saved filter', key);
    fireEvent.click(screen.getByRole('button', { name: 'Apply filter' }));
    expect((screen.getByLabelText('Technique', { exact: true }) as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('Data structure', { exact: true }) as HTMLSelectElement).value).toBe('');
    expect(screen.getByText('Showing 150 of 150')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hide techniques / solution hints' }));
    await waitFor(() => expect((screen.getByLabelText('Technique', { exact: true }) as HTMLSelectElement).disabled).toBe(false));
    expect(screen.getByText('Showing 150 of 150')).toBeTruthy();
  });

  it('surfaces saved-filter storage errors', async () => {
    const { actions } = setup();
    await screen.findByText('Showing 150 of 150');
    vi.spyOn(actions, 'saveRoadmapFilter').mockRejectedValueOnce(new Error('Cannot save filter'));
    select('Filter name', 'Failure');
    fireEvent.click(screen.getByRole('button', { name: 'Save current filters' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Cannot save filter');
  });
});


it('clears unavailable metadata and categories when applying an older preset', async () => {
  const { actions } = setup();
  await screen.findByText('Showing 150 of 150');
  await actions.saveRoadmapFilter('retired', { name: 'Older catalog', filters: {
    search: '', category: 'Retired category', difficulty: '', status: '', access: '', scope: '',
    technique: 'Retired technique', structure: 'Retired structure', company: 'retired-company', favoritesOnly: false,
  } });
  await screen.findByRole('option', { name: 'Older catalog' });
  select('Saved filter', 'retired');
  fireEvent.click(screen.getByRole('button', { name: 'Apply filter' }));
  for (const label of ['Category', 'Technique', 'Data structure', 'Company evidence']) {
    expect(screen.getByLabelText(label, { exact: true })).toHaveProperty('value', '');
  }
  expect(screen.getByText('Showing 150 of 150')).toBeTruthy();
});

describe('List layout: labels, star placement and company grouping', () => {
  it('labels the third layout List (stored value stays all) and keeps the star at the end of each row, not before the title', async () => {
    const { container } = setup();
    await screen.findByText('Showing 150 of 150');
    const layout = within(screen.getByRole('group', { name: 'Roadmap layout' }));
    expect(layout.getAllByRole('button').map((b) => b.textContent)).toEqual(['Tree', 'Grid', 'List']);
    const row = container.querySelector('.problem-row')!;
    expect(row.firstElementChild!.classList.contains('choice')).toBe(true);
    const meta = row.querySelector('.problem-meta')!;
    expect(meta.lastElementChild!.classList.contains('favorite-star')).toBe(true);
  });

  it('groups by company with logos or monograms, persists the choice, and puts undocumented problems last', async () => {
    const { container, mock } = setup();
    await screen.findByText('Showing 150 of 150');
    fireEvent.click(screen.getByRole('button', { name: 'Group by company' }));
    await waitFor(() => expect(container.querySelectorAll('.category h2').length).toBeGreaterThan(1));
    const titles = [...container.querySelectorAll('.category h2')].map((h) => h.textContent!.trim());
    expect(titles.some((t) => t.endsWith('Amazon'))).toBe(true);
    expect(titles.at(-1)).toBe('No documented company evidence');
    expect(titles.some((t) => t.endsWith('Shopify'))).toBe(false); // no evidence, so no group
    const amazon = [...container.querySelectorAll('.category')].find((c) => c.querySelector('h2')!.textContent!.trim().endsWith('Amazon'))!;
    expect(amazon.querySelector('.company-monogram')?.textContent).toBe('A'); // Amazon has no bundled brand mark
    const google = [...container.querySelectorAll('.category')].find((c) => c.querySelector('h2')!.textContent!.trim() === 'Google')!;
    expect(google.querySelector('svg.company-logo path')).toBeTruthy();
    expect((mock.data[STORAGE_KEY] as AppState).settings.roadmapGroup).toBe('company');
    expect((mock.data[STORAGE_KEY] as AppState).activities).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Group by category' }));
    await waitFor(() => expect([...container.querySelectorAll('.category h2')].map((h) => h.textContent!.trim())).toEqual(CATEGORY_NAMES));
  });
});

