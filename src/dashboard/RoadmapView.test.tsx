import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { roadmapTiers } from '../core/roadmap';
import { defaultState } from '../core/state';
import type { AppState } from '../core/types';
import type { AppActions } from '../lib/actions';
import { RoadmapView } from './RoadmapView';

const actions = new Proxy({}, { get: () => () => Promise.resolve() }) as AppActions;

describe('RoadmapView (render smoke test)', () => {
  const base = defaultState('2025-01-06');

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
