import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
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
    expect(html.match(/checked=""/g)).toHaveLength(1);
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
    expect(html.match(/checked=""/g)).toHaveLength(1);
  });
});
