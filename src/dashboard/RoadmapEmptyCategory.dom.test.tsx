// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultState } from '../core/state';
import type { AppState } from '../core/types';
import { CATEGORIES } from '../data/neetcode150';
import type { AppActions } from '../lib/actions';
import { RoadmapView } from './RoadmapView';

// A catalog that only has Arrays & Hashing problems: every other category is empty (a connector node).
vi.mock('../core/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../core/catalog')>();
  return {
    ...actual,
    catalogProblems: (id: Parameters<typeof actual.catalogProblems>[0]) =>
      id === 'blind75'
        ? actual.catalogProblems(id).filter((problem) => problem.category === 'Arrays & Hashing')
        : actual.catalogProblems(id),
  };
});

afterEach(cleanup);

const actions = new Proxy({}, { get: () => () => Promise.resolve() }) as AppActions;
const emptyCatalogState = (view: 'tree' | 'grid'): AppState => {
  const base = defaultState('2025-01-06');
  return { ...base, settings: { ...base.settings, roadmapCatalog: 'blind75', roadmapView: view } };
};

describe('RoadmapView with categories that have no problem in the catalog', () => {
  it('keeps every tree node, labels the empty ones and does not crash when one is selected', () => {
    const { container } = render(<RoadmapView state={emptyCatalogState('tree')} actions={actions} />);
    const nodes = [...container.querySelectorAll<HTMLElement>('.tree-node')];
    expect(nodes).toHaveLength(CATEGORIES.length);
    const empty = nodes.filter((node) => node.classList.contains('empty'));
    expect(empty).toHaveLength(CATEGORIES.length - 1);
    expect(empty[0]!.textContent).toContain('None in Blind 75');
    for (const node of empty) {
      fireEvent.click(node);
      expect(screen.getByText(/No Blind 75 problem is in this category/)).toBeTruthy();
      expect(container.querySelectorAll('section.category input[type="checkbox"]')).toHaveLength(0);
    }
    // The prerequisite edges are all still drawn.
    expect(container.querySelectorAll('.tree-edge')).toHaveLength(
      CATEGORIES.reduce((n, c) => n + c.prerequisites.length, 0),
    );
  });

  it('shows a clear note instead of an empty problem panel in the grid', () => {
    const { container } = render(<RoadmapView state={emptyCatalogState('grid')} actions={actions} />);
    expect(container.querySelectorAll('section.category')).toHaveLength(CATEGORIES.length);
    expect(screen.getAllByText(/No Blind 75 problem is in this category/)).toHaveLength(CATEGORIES.length - 1);
    expect(container.querySelectorAll('details')).toHaveLength(1);
  });
});
