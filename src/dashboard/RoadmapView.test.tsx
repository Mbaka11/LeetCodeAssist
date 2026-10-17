import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { catalogProblems } from '../core/catalog';
import { roadmapTiers } from '../core/roadmap';
import { defaultState } from '../core/state';
import type { AppState, RoadmapViewMode } from '../core/types';
import { CATEGORIES } from '../data/neetcode150';
import type { AppActions } from '../lib/actions';
import { RoadmapView } from './RoadmapView';

const actions = new Proxy({}, { get: () => () => Promise.resolve() }) as AppActions;

function withView(state: AppState, roadmapView?: RoadmapViewMode): AppState {
  return roadmapView ? { ...state, settings: { ...state.settings, roadmapView } } : state;
}

describe('RoadmapView grid layout (render smoke test)', () => {
  const base = withView(defaultState('2025-01-06'), 'grid');

  it('lists every category tier by tier (roadmap order) with counters and the 150 problems', () => {
    const html = renderToStaticMarkup(<RoadmapView state={base} actions={actions} />);
    let last = -1;
    for (const name of roadmapTiers().flat()) {
      const at = html.indexOf(`<h2>${name.replace('&', '&amp;')}</h2>`);
      expect(at, name).toBeGreaterThan(last);
      last = at;
    }
    expect(html).toContain('0/150');
    expect(html).toContain('Easy');
    expect(html).toContain('Medium');
    expect(html).toContain('Hard');
    expect(html).toContain('worked 0 · solo in review 0 · consolidating 0');
    expect(html.match(/type="checkbox"/g)).toHaveLength(150);
    expect(html).toContain('30-day program');
    expect(html).toContain('Benchmark');
    expect(html).toContain('href="#/problem/two-sum"');
    expect(html).toContain('https://leetcode.com/problems/two-sum/');
    expect(html).toContain('After: Arrays &amp; Hashing');
    expect(html).not.toContain('tree-node');
  });

  it('reflects checked problems and statuses', () => {
    const state: AppState = {
      ...base,
      checked: { 'two-sum': true },
      problemStatus: { 'valid-anagram': 'mastered', 'contains-duplicate': 'consolidating' },
    };
    const html = renderToStaticMarkup(<RoadmapView state={state} actions={actions} />);
    expect(html).toContain('3/150');
    expect(html).toContain('Mastered');
    expect(html).toContain('Consolidating');
    expect(html).toContain('worked 3 · solo in review 1 · consolidating 1');
    expect(html.match(/checked=""/g)).toHaveLength(3);
  });
});

describe('RoadmapView tree layout (render smoke test)', () => {
  const base = defaultState('2025-01-06');

  it('is the default layout and the toggle shows which layout is active', () => {
    for (const state of [base, withView(base, 'tree')]) {
      const html = renderToStaticMarkup(<RoadmapView state={state} actions={actions} />);
      expect(html).toContain('role="group" aria-label="Roadmap layout"');
      expect(html).toMatch(/aria-pressed="true"[^>]*>Tree</);
      expect(html).toMatch(/aria-pressed="false"[^>]*>Grid</);
    }
    const grid = renderToStaticMarkup(<RoadmapView state={withView(base, 'grid')} actions={actions} />);
    expect(grid).toMatch(/aria-pressed="false"[^>]*>Tree</);
    expect(grid).toMatch(/aria-pressed="true"[^>]*>Grid</);
  });

  it('renders a node per category with progress and difficulty counters, and an edge per prerequisite', () => {
    const html = renderToStaticMarkup(<RoadmapView state={base} actions={actions} />);
    expect(html.match(/<button type="button" class="tree-node[ "]/g)).toHaveLength(CATEGORIES.length);
    expect(html.match(/class="tree-edge[ "]/g)).toHaveLength(CATEGORIES.reduce((n, c) => n + c.prerequisites.length, 0));
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('Easy 0/3 · Medium 0/6 · Hard 0/0');
    expect(html).toContain('solo 0 · consolidating 0');
    expect(html).toContain('After: Binary Search, Linked List');
    expect(html).toContain('Start here');
    expect(html).toContain('aria-label="Roadmap prerequisite tree"');
  });

  it('shows the problems of the selected category (the first one by default) below the tree', () => {
    const html = renderToStaticMarkup(<RoadmapView state={base} actions={actions} />);
    expect(html).toContain('<h2>Arrays &amp; Hashing</h2>');
    expect(html.match(/type="checkbox"/g)).toHaveLength(9);
    expect(html).toContain('href="#/problem/contains-duplicate"');
    expect(html).toContain('https://leetcode.com/problems/two-sum/');
    expect(html).toContain('30-day program');
    expect(html).toContain('Untouched');
  });

  it('reflects progress on the nodes', () => {
    const state: AppState = {
      ...base,
      checked: { 'two-sum': true },
      problemStatus: { 'valid-anagram': 'mastered', 'contains-duplicate': 'consolidating' },
    };
    const html = renderToStaticMarkup(<RoadmapView state={state} actions={actions} />);
    expect(html).toContain('Easy 3/3');
    expect(html).toContain('solo 1 · consolidating 1');
    expect(html.match(/checked=""/g)).toHaveLength(3);
  });
});

describe('RoadmapView worked problems', () => {
  it('shows a problem worked in the plan as checked, even without a manual check', () => {
    const state: AppState = {
      ...withView(defaultState('2025-01-06'), 'grid'),
      problemStatus: { 'valid-anagram': 'learning' },
    };
    const html = renderToStaticMarkup(<RoadmapView state={state} actions={actions} />);
    expect(html.match(/type="checkbox"[^>]*checked=""/g)?.length ?? 0).toBe(1);
    expect(html).toContain('Completed in your plan');
  });
});

function withCatalog(state: AppState, roadmapCatalog: 'neetcode150' | 'blind75'): AppState {
  return { ...state, settings: { ...state.settings, roadmapCatalog } };
}

describe('RoadmapView catalog selector (render smoke test)', () => {
  const base = defaultState('2025-01-06');

  it('shows the catalog selector separate from the layout toggle, NeetCode 150 by default', () => {
    const html = renderToStaticMarkup(<RoadmapView state={base} actions={actions} />);
    expect(html).toContain('role="group" aria-label="Problem catalog"');
    expect(html).toContain('role="group" aria-label="Roadmap layout"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>NeetCode 150</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>Blind 75</);
    expect(html).toContain('NeetCode 150 roadmap');
    // Tree layout is unchanged by the catalog.
    expect(html).toMatch(/aria-pressed="true"[^>]*>Tree</);
  });

  it('keeps the layout toggle when Blind 75 is selected', () => {
    for (const view of ['tree', 'grid'] as const) {
      const state = withView(withCatalog(base, 'blind75'), view);
      const html = renderToStaticMarkup(<RoadmapView state={state} actions={actions} />);
      expect(html).toMatch(/aria-pressed="true"[^>]*>Blind 75</);
      expect(html).toMatch(/aria-pressed="false"[^>]*>NeetCode 150</);
      expect(html).toMatch(new RegExp(`aria-pressed="true"[^>]*>${view === 'tree' ? 'Tree' : 'Grid'}<`));
      expect(html).toContain('Blind 75 roadmap');
    }
  });

  it('shows both compact catalog counters and explains that Blind 75 is a subset', () => {
    const state: AppState = {
      ...base,
      checked: { 'two-sum': true },
      problemStatus: { 'valid-anagram': 'learning', 'min-stack': 'learning' },
    };
    for (const catalog of ['neetcode150', 'blind75'] as const) {
      const html = renderToStaticMarkup(<RoadmapView state={withCatalog(state, catalog)} actions={actions} />);
      expect(html).toContain('aria-label="Progress in both catalogs"');
      expect(html).toContain('NeetCode 150 <strong>3/150</strong>');
      // min-stack is in the NeetCode 150 but not in the Blind 75.
      expect(html).toContain('Blind 75 <strong>2/75</strong>');
      expect(html).toContain('Blind 75 is a subset of the NeetCode 150');
      expect(html).toContain('never adds 150 + 75');
    }
  });

  it('filters the tree stats and the problem list to the chosen catalog', () => {
    const html = renderToStaticMarkup(<RoadmapView state={withCatalog(base, 'blind75')} actions={actions} />);
    expect(html.match(/<button type="button" class="tree-node[ "]/g)).toHaveLength(CATEGORIES.length);
    const inArrays = catalogProblems('blind75').filter((p) => p.category === 'Arrays & Hashing');
    expect(inArrays.length).toBeGreaterThan(0);
    expect(inArrays.length).toBeLessThan(9);
    // The selected category panel lists exactly the Blind 75 problems of Arrays & Hashing.
    expect(html.match(/type="checkbox"/g)).toHaveLength(inArrays.length);
    for (const problem of inArrays) expect(html).toContain(`href="#/problem/${problem.slug}"`);
    expect(html).not.toContain('href="#/problem/min-stack"');
    // The overall counter and the node counters use the catalog totals.
    expect(html).toContain('<div class="stat-value">0/75</div>');
    const difficultyTotals = ['Easy', 'Medium', 'Hard'].reduce(
      (sum, d) => sum + catalogProblems('blind75').filter((p) => p.difficulty === d).length,
      0,
    );
    expect(difficultyTotals).toBe(75);
  });

  it('lists only Blind 75 problems in the grid and keeps 75 checkboxes in total', () => {
    const html = renderToStaticMarkup(<RoadmapView state={withView(withCatalog(base, 'blind75'), 'grid')} actions={actions} />);
    expect(html.match(/type="checkbox"/g)).toHaveLength(75);
    expect(html).not.toContain('href="#/problem/min-stack"');
    expect(html).toContain('href="#/problem/two-sum"');
    expect(html).toContain('0/75');
  });

  it('labels Premium problems and says they are never scheduled', () => {
    const html = renderToStaticMarkup(<RoadmapView state={withView(withCatalog(base, 'blind75'), 'grid')} actions={actions} />);
    expect(html).toContain('>Premium</span>');
    expect(html).toContain('labelled and never scheduled');
    expect(html.match(/>Premium<\/span>/g)).toHaveLength(6);
    const all = renderToStaticMarkup(<RoadmapView state={withView(base, 'grid')} actions={actions} />);
    expect(all.match(/>Premium<\/span>/g)).toHaveLength(7);
  });

  it('shares the same checks and statuses across catalogs', () => {
    const state: AppState = { ...base, checked: { 'two-sum': true }, problemStatus: { 'valid-anagram': 'mastered' } };
    for (const catalog of ['neetcode150', 'blind75'] as const) {
      const html = renderToStaticMarkup(<RoadmapView state={withView(withCatalog(state, catalog), 'grid')} actions={actions} />);
      expect(html.match(/checked=""/g)).toHaveLength(2);
      expect(html).toContain('Mastered');
    }
  });
});
