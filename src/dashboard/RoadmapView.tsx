import { useId, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LeetCodeLink } from '../components/LeetCodeLink';
import { ProgressBar } from '../components/ProgressBar';
import { Stat } from '../components/Stat';
import { CATALOG_IDS, catalogProblems, type CatalogId } from '../core/catalog';
import {
  TREE_NODE_HEIGHT,
  TREE_NODE_WIDTH,
  categoryDifficultyCounts,
  layoutRoadmapTree,
  roadmapTiers,
} from '../core/roadmap';
import { getProblemStatus, problemStats, type CategoryStats } from '../core/state';
import type { AppState, Difficulty, Problem, RoadmapViewMode } from '../core/types';
import { CATEGORIES, type CategoryName } from '../data/neetcode150';
import { isBonusProblem } from '../data/bonus';
import { isPremiumProblem } from '../data/premium';
import { BENCHMARKS, PROGRAM_QUEUE } from '../data/program';
import type { AppActions } from '../lib/actions';
import { STATUS_LABELS, STATUS_TONES, difficultyTone } from '../lib/instructions';
import { problemHref } from '../lib/route';

const DIFFICULTIES: readonly Difficulty[] = ['Easy', 'Medium', 'Hard'];
const TIERS = roadmapTiers();
const TREE = layoutRoadmapTree();
const BENCHMARK_SLUGS: ReadonlySet<string> = new Set(BENCHMARKS.flatMap((b) => [b.easy, b.medium]));
const PROGRAM_SLUGS: ReadonlySet<string> = new Set(PROGRAM_QUEUE);

const CATALOG_LABELS: Record<CatalogId, string> = { neetcode150: 'NeetCode 150', blind75: 'Blind 75' };

const NO_STATS = { total: 0, worked: 0, soloInReview: 0, consolidating: 0 };
const NO_DIFFICULTY_COUNTS: Record<Difficulty, { worked: number; total: number }> = {
  Easy: { worked: 0, total: 0 },
  Medium: { worked: 0, total: 0 },
  Hard: { worked: 0, total: 0 },
};

/** Stats of a category, zero when the catalog has no problem in it (the tree keeps the node as a connector). */
function statsOf(byCategory: ReadonlyMap<string, CategoryStats>, name: CategoryName): CategoryStats {
  return byCategory.get(name) ?? { category: name, ...NO_STATS };
}

function prerequisitesOf(name: CategoryName): readonly CategoryName[] {
  return CATEGORIES.find((c) => c.name === name)?.prerequisites ?? [];
}

/** The problems of a category that belong to the chosen catalog, in roadmap order. */
function categoryProblems(name: CategoryName, catalog: CatalogId): readonly Problem[] {
  return catalogProblems(catalog).filter((problem) => problem.category === name);
}

/** The problems of one category: checkbox, link, difficulty, program badges, status pill, LeetCode link. */
function ProblemList({
  problems,
  state,
  actions,
}: {
  problems: readonly Problem[];
  state: AppState;
  actions: AppActions;
}) {
  return (
    <ul className="problem-list">
      {problems.map((problem) => {
        const status = getProblemStatus(state, problem.slug);
        const worked = status !== 'untouched'; // done in the program or a benchmark: shown as checked
        return (
          <li key={problem.slug} className="problem-row">
            <label className="choice">
              <input
                type="checkbox"
                checked={worked || state.checked[problem.slug] === true}
                disabled={worked}
                title={worked ? 'Completed in your plan' : undefined}
                onChange={() => void actions.toggleChecked(problem.slug)}
                aria-label={`${problem.title} solved`}
              />
              <a href={problemHref(problem.slug)}>{problem.title}</a>
            </label>
            <span className="problem-meta">
              <Badge tone={difficultyTone(problem.difficulty)}>{problem.difficulty}</Badge>
              {PROGRAM_SLUGS.has(problem.slug) ? <Badge>30-day program</Badge> : null}
              {BENCHMARK_SLUGS.has(problem.slug) ? <Badge tone="benchmark">Benchmark</Badge> : null}
              {isBonusProblem(problem.slug) ? <Badge tone="warn">Bonus</Badge> : null}
              {isPremiumProblem(problem.slug) ? (
                <span title="Needs LeetCode Premium. It stays in the catalog but is never scheduled.">
                  <Badge tone="neutral">Premium</Badge>
                </span>
              ) : null}
              <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
              <LeetCodeLink href={problem.url} openPanel />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function CategoryCard({
  name,
  stats,
  problems,
  catalog,
  state,
  actions,
}: {
  name: CategoryName;
  stats: CategoryStats;
  problems: readonly Problem[];
  catalog: CatalogId;
  state: AppState;
  actions: AppActions;
}) {
  const prerequisites = prerequisitesOf(name);
  return (
    <section className="card category">
      <header className="card-header">
        <h2>{name}</h2>
        <span className="muted">
          {stats.worked}/{stats.total}
        </span>
      </header>
      <ProgressBar value={stats.worked} max={stats.total} done={stats.total > 0 && stats.worked === stats.total} />
      <p className="muted category-stats">
        worked {stats.worked} · solo in review {stats.soloInReview} · consolidating {stats.consolidating}
      </p>
      {prerequisites.length > 0 ? <p className="muted category-after">After: {prerequisites.join(', ')}</p> : null}
      {problems.length === 0 ? (
        <p className="muted">No {CATALOG_LABELS[catalog]} problem is in this category.</p>
      ) : (
        <details>
          <summary>Problems ({stats.total})</summary>
          <ProblemList problems={problems} state={state} actions={actions} />
        </details>
      )}
    </section>
  );
}

function GridView({
  state,
  actions,
  byCategory,
  catalog,
}: {
  state: AppState;
  actions: AppActions;
  byCategory: ReadonlyMap<string, CategoryStats>;
  catalog: CatalogId;
}) {
  return (
    <>
      {TIERS.map((names, tier) => (
        <div key={tier} className="roadmap-tier">
          {names.map((name) => (
            <CategoryCard
              key={name}
              name={name}
              stats={statsOf(byCategory, name)}
              problems={categoryProblems(name, catalog)}
              catalog={catalog}
              state={state}
              actions={actions}
            />
          ))}
        </div>
      ))}
    </>
  );
}

function TreeView({
  state,
  actions,
  byCategory,
  catalog,
}: {
  state: AppState;
  actions: AppActions;
  byCategory: ReadonlyMap<string, CategoryStats>;
  catalog: CatalogId;
}) {
  const [selected, setSelected] = useState<CategoryName>(CATEGORIES[0]!.name);
  const markerId = useId();
  const counts = categoryDifficultyCounts(state, catalog);
  const selectedStats = statsOf(byCategory, selected);
  const selectedProblems = categoryProblems(selected, catalog);
  const selectedPrerequisites = prerequisitesOf(selected);

  return (
    <>
      <div className="tree-scroll" role="region" aria-label="Roadmap prerequisite tree" tabIndex={0}>
        <div className="tree-canvas" style={{ width: TREE.width, height: TREE.height }}>
          <svg className="tree-edges" width={TREE.width} height={TREE.height} aria-hidden="true" focusable="false">
            <defs>
              <marker id={`${markerId}-edge`} className="tree-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
              <marker id={`${markerId}-active`} className="tree-arrow tree-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            </defs>
            {TREE.edges.map((edge) => {
              const active = edge.from === selected || edge.to === selected;
              return (
                <path
                  key={`${edge.from}>${edge.to}`}
                  d={edge.path}
                  className={`tree-edge${active ? ' tree-edge-active' : ''}`}
                  markerEnd={`url(#${markerId}-${active ? 'active' : 'edge'})`}
                />
              );
            })}
          </svg>
          {TREE.nodes.map((node) => {
            const stats = statsOf(byCategory, node.name);
            const byDifficulty = counts.get(node.name) ?? NO_DIFFICULTY_COUNTS;
            const prerequisites = prerequisitesOf(node.name);
            const classes = ['tree-node'];
            if (node.name === selected) classes.push('selected');
            if (stats.total > 0 && stats.worked === stats.total) classes.push('complete');
            if (stats.total === 0) classes.push('empty');
            return (
              <button
                key={node.name}
                type="button"
                className={classes.join(' ')}
                style={{ left: node.x, top: node.y, width: TREE_NODE_WIDTH, height: TREE_NODE_HEIGHT }}
                aria-pressed={node.name === selected}
                onClick={() => setSelected(node.name)}
              >
                <span className="tree-node-title">
                  <strong>{node.name}</strong>
                  <span className="muted">
                    {stats.worked}/{stats.total}
                  </span>
                </span>
                <ProgressBar value={stats.worked} max={stats.total} done={stats.total > 0 && stats.worked === stats.total} />
                {stats.total === 0 ? (
                  <span className="muted tree-node-stats">None in {CATALOG_LABELS[catalog]}</span>
                ) : (
                  <>
                    <span className="muted tree-node-stats">
                      solo {stats.soloInReview} · consolidating {stats.consolidating}
                    </span>
                    <span className="muted tree-node-stats">
                      {DIFFICULTIES.map((d) => `${d} ${byDifficulty[d].worked}/${byDifficulty[d].total}`).join(' · ')}
                    </span>
                  </>
                )}
                {prerequisites.length > 0 ? (
                  <span className="muted tree-node-stats">After: {prerequisites.join(', ')}</span>
                ) : (
                  <span className="muted tree-node-stats">Start here</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <section className="card category" aria-label={`${selected} problems`}>
        <header className="card-header">
          <h2>{selected}</h2>
          <span className="muted">
            {selectedStats.worked}/{selectedStats.total}
          </span>
        </header>
        <p className="muted category-stats">
          worked {selectedStats.worked} · solo in review {selectedStats.soloInReview} · consolidating{' '}
          {selectedStats.consolidating}
          {selectedPrerequisites.length > 0 ? ` · after ${selectedPrerequisites.join(', ')}` : ''}
        </p>
        {selectedProblems.length === 0 ? (
          <p className="muted">No {CATALOG_LABELS[catalog]} problem is in this category. It stays in the tree as a connector.</p>
        ) : (
          <ProblemList problems={selectedProblems} state={state} actions={actions} />
        )}
      </section>
    </>
  );
}

const VIEW_LABELS: Record<RoadmapViewMode, string> = { tree: 'Tree', grid: 'Grid' };

/** Both catalog counters side by side, so the overlap is visible whichever catalog is selected. */
function CatalogCounters({ state, selected }: { state: AppState; selected: CatalogId }) {
  return (
    <p className="catalog-counters" role="group" aria-label="Progress in both catalogs">
      {CATALOG_IDS.map((id, index) => {
        const { overall } = problemStats(state, id);
        return (
          <span key={id}>
            {index > 0 ? <span aria-hidden="true"> · </span> : null}
            <span className={id === selected ? 'catalog-counter catalog-counter-active' : 'catalog-counter'}>
              {CATALOG_LABELS[id]} <strong>{overall.worked}/{overall.total}</strong>
            </span>
          </span>
        );
      })}
    </p>
  );
}

export function RoadmapView({ state, actions }: { state: AppState; actions: AppActions }) {
  const catalog: CatalogId = state.settings.roadmapCatalog ?? 'neetcode150';
  const stats = problemStats(state, catalog);
  const byCategory = new Map(stats.byCategory.map((s) => [s.category, s]));
  const view: RoadmapViewMode = state.settings.roadmapView ?? 'tree';
  const [error, setError] = useState<string | null>(null);
  const premiumCount = catalogProblems(catalog).filter((p) => isPremiumProblem(p.slug)).length;

  const change = (patch: { roadmapView?: RoadmapViewMode; roadmapCatalog?: CatalogId }): void => {
    setError(null);
    actions.updateSettings(patch).catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };

  return (
    <div className="stack">
      <Card
        title={`${CATALOG_LABELS[catalog]} roadmap`}
        actions={
          <div className="roadmap-controls">
            <div className="view-toggle" role="group" aria-label="Problem catalog">
              {CATALOG_IDS.map((id) => (
                <Button
                  key={id}
                  variant={catalog === id ? 'primary' : 'secondary'}
                  aria-pressed={catalog === id}
                  onClick={() => change({ roadmapCatalog: id })}
                >
                  {CATALOG_LABELS[id]}
                </Button>
              ))}
            </div>
            <div className="view-toggle" role="group" aria-label="Roadmap layout">
              {(['tree', 'grid'] as const).map((mode) => (
                <Button
                  key={mode}
                  variant={view === mode ? 'primary' : 'secondary'}
                  aria-pressed={view === mode}
                  onClick={() => change({ roadmapView: mode })}
                >
                  {VIEW_LABELS[mode]}
                </Button>
              ))}
            </div>
          </div>
        }
      >
        <CatalogCounters state={state} selected={catalog} />
        <div className="stats">
          {DIFFICULTIES.map((difficulty) => {
            const counts = stats.byDifficulty[difficulty];
            return (
              <Stat
                key={difficulty}
                label={difficulty}
                value={`${counts.worked}/${counts.total}`}
                hint={`${counts.soloInReview} solo in review · ${counts.consolidating} consolidating`}
              />
            );
          })}
          <Stat
            label="All"
            value={`${stats.overall.worked}/${stats.overall.total}`}
            hint={`${stats.overall.soloInReview} solo in review · ${stats.overall.consolidating} consolidating`}
          />
        </div>
        <ProgressBar value={stats.overall.worked} max={stats.overall.total} done={stats.overall.worked === stats.overall.total} />
        <p className="muted">
          Blind 75 is a subset of the NeetCode 150: its 75 problems are also among the 150. Switching the catalog
          only filters this page. It never adds 150 + 75, resets anything or changes your plan, and both catalogs
          share the same checkboxes and statuses.
        </p>
        <p className="muted">
          “Worked” counts problems you have started in the program or ticked as solved (ticks count here, not in
          the distinct total on Today and Calendar). “Solo in review” means a re-solve or blind review was solved
          on your own.
          {premiumCount > 0
            ? ` ${premiumCount} Premium ${premiumCount === 1 ? 'problem is' : 'problems are'} labelled and never scheduled.`
            : ''}
          {view === 'tree'
            ? ' Arrows point from a category to the ones that build on it; select a category to see its problems.'
            : ''}
        </p>
        {error ? <p className="error">{error}</p> : null}
      </Card>

      {view === 'tree' ? (
        <TreeView state={state} actions={actions} byCategory={byCategory} catalog={catalog} />
      ) : (
        <GridView state={state} actions={actions} byCategory={byCategory} catalog={catalog} />
      )}
    </div>
  );
}
