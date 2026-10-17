import { useId, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { LeetCodeLink } from '../components/LeetCodeLink';
import { ProgressBar } from '../components/ProgressBar';
import { Stat } from '../components/Stat';
import {
  TREE_NODE_HEIGHT,
  TREE_NODE_WIDTH,
  categoryDifficultyCounts,
  layoutRoadmapTree,
  roadmapTiers,
} from '../core/roadmap';
import { getProblemStatus, problemStats, type CategoryStats } from '../core/state';
import type { AppState, Difficulty, RoadmapViewMode } from '../core/types';
import { CATEGORIES, problemsInCategory, type CategoryName } from '../data/neetcode150';
import { isBonusProblem } from '../data/bonus';
import { BENCHMARKS, PROGRAM_QUEUE } from '../data/program';
import type { AppActions } from '../lib/actions';
import { STATUS_LABELS, STATUS_TONES, difficultyTone } from '../lib/instructions';
import { problemHref } from '../lib/route';

const DIFFICULTIES: readonly Difficulty[] = ['Easy', 'Medium', 'Hard'];
const TIERS = roadmapTiers();
const TREE = layoutRoadmapTree();
const BENCHMARK_SLUGS: ReadonlySet<string> = new Set(BENCHMARKS.flatMap((b) => [b.easy, b.medium]));
const PROGRAM_SLUGS: ReadonlySet<string> = new Set(PROGRAM_QUEUE);

function prerequisitesOf(name: CategoryName): readonly CategoryName[] {
  return CATEGORIES.find((c) => c.name === name)?.prerequisites ?? [];
}

/** The problems of one category: checkbox, link, difficulty, program badges, status pill, LeetCode link. */
function ProblemList({ name, state, actions }: { name: CategoryName; state: AppState; actions: AppActions }) {
  return (
    <ul className="problem-list">
      {problemsInCategory(name).map((problem) => {
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
  state,
  actions,
}: {
  name: CategoryName;
  stats: CategoryStats;
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
      <ProgressBar value={stats.worked} max={stats.total} done={stats.worked === stats.total} />
      <p className="muted category-stats">
        worked {stats.worked} · solo in review {stats.soloInReview} · consolidating {stats.consolidating}
      </p>
      {prerequisites.length > 0 ? <p className="muted category-after">After: {prerequisites.join(', ')}</p> : null}
      <details>
        <summary>Problems ({stats.total})</summary>
        <ProblemList name={name} state={state} actions={actions} />
      </details>
    </section>
  );
}

function GridView({
  state,
  actions,
  byCategory,
}: {
  state: AppState;
  actions: AppActions;
  byCategory: ReadonlyMap<string, CategoryStats>;
}) {
  return (
    <>
      {TIERS.map((names, tier) => (
        <div key={tier} className="roadmap-tier">
          {names.map((name) => (
            <CategoryCard key={name} name={name} stats={byCategory.get(name)!} state={state} actions={actions} />
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
}: {
  state: AppState;
  actions: AppActions;
  byCategory: ReadonlyMap<string, CategoryStats>;
}) {
  const [selected, setSelected] = useState<CategoryName>(CATEGORIES[0]!.name);
  const markerId = useId();
  const counts = categoryDifficultyCounts(state);
  const selectedStats = byCategory.get(selected)!;
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
            const stats = byCategory.get(node.name)!;
            const byDifficulty = counts.get(node.name)!;
            const prerequisites = prerequisitesOf(node.name);
            const classes = ['tree-node'];
            if (node.name === selected) classes.push('selected');
            if (stats.worked === stats.total) classes.push('complete');
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
                <ProgressBar value={stats.worked} max={stats.total} done={stats.worked === stats.total} />
                <span className="muted tree-node-stats">
                  solo {stats.soloInReview} · consolidating {stats.consolidating}
                </span>
                <span className="muted tree-node-stats">
                  {DIFFICULTIES.map((d) => `${d} ${byDifficulty[d].worked}/${byDifficulty[d].total}`).join(' · ')}
                </span>
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
        <ProblemList name={selected} state={state} actions={actions} />
      </section>
    </>
  );
}

const VIEW_LABELS: Record<RoadmapViewMode, string> = { tree: 'Tree', grid: 'Grid' };

export function RoadmapView({ state, actions }: { state: AppState; actions: AppActions }) {
  const stats = problemStats(state);
  const byCategory = new Map(stats.byCategory.map((s) => [s.category, s]));
  const view: RoadmapViewMode = state.settings.roadmapView ?? 'tree';
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="stack">
      <Card
        title="NeetCode 150 roadmap"
        actions={
          <div className="view-toggle" role="group" aria-label="Roadmap layout">
            {(['tree', 'grid'] as const).map((mode) => (
              <Button
                key={mode}
                variant={view === mode ? 'primary' : 'secondary'}
                aria-pressed={view === mode}
                onClick={() => {
                  setError(null);
                  actions
                    .updateSettings({ roadmapView: mode })
                    .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
                }}
              >
                {VIEW_LABELS[mode]}
              </Button>
            ))}
          </div>
        }
      >
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
          “Worked” counts problems you have started in the program or ticked as solved. “Solo in review”
          means a re-solve or blind review was solved on your own.
          {view === 'tree'
            ? ' Arrows point from a category to the ones that build on it; select a category to see its problems.'
            : ''}
        </p>
        {error ? <p className="error">{error}</p> : null}
      </Card>

      {view === 'tree' ? (
        <TreeView state={state} actions={actions} byCategory={byCategory} />
      ) : (
        <GridView state={state} actions={actions} byCategory={byCategory} />
      )}
    </div>
  );
}
