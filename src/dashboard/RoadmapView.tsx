import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Stat } from '../components/Stat';
import { roadmapTiers } from '../core/roadmap';
import { getProblemStatus, problemStats, type CategoryStats } from '../core/state';
import type { AppState, Difficulty } from '../core/types';
import { CATEGORIES, problemsInCategory, type CategoryName } from '../data/neetcode150';
import { BENCHMARKS, PROGRAM_QUEUE } from '../data/program';
import type { AppActions } from '../lib/actions';
import { STATUS_LABELS, STATUS_TONES, difficultyTone } from '../lib/instructions';
import { problemHref } from '../lib/route';

const DIFFICULTIES: readonly Difficulty[] = ['Easy', 'Medium', 'Hard'];
const TIERS = roadmapTiers();
const BENCHMARK_SLUGS: ReadonlySet<string> = new Set(BENCHMARKS.flatMap((b) => [b.easy, b.medium]));
const PROGRAM_SLUGS: ReadonlySet<string> = new Set(PROGRAM_QUEUE);

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
  const prerequisites = CATEGORIES.find((c) => c.name === name)?.prerequisites ?? [];
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
        <ul className="problem-list">
          {problemsInCategory(name).map((problem) => {
            const status = getProblemStatus(state, problem.slug);
            return (
              <li key={problem.slug} className="problem-row">
                <label className="choice">
                  <input
                    type="checkbox"
                    checked={state.checked[problem.slug] === true}
                    onChange={() => void actions.toggleChecked(problem.slug)}
                    aria-label={`${problem.title} solved`}
                  />
                  <a href={problemHref(problem.slug)}>{problem.title}</a>
                </label>
                <span className="problem-meta">
                  <Badge tone={difficultyTone(problem.difficulty)}>{problem.difficulty}</Badge>
                  {PROGRAM_SLUGS.has(problem.slug) ? <Badge>30-day program</Badge> : null}
                  {BENCHMARK_SLUGS.has(problem.slug) ? <Badge tone="benchmark">Benchmark</Badge> : null}
                  <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
                  <a className="link-out" href={problem.url} target="_blank" rel="noreferrer">
                    LeetCode ↗
                  </a>
                </span>
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}

export function RoadmapView({ state, actions }: { state: AppState; actions: AppActions }) {
  const stats = problemStats(state);
  const byCategory = new Map(stats.byCategory.map((s) => [s.category, s]));

  return (
    <div className="stack">
      <Card title="NeetCode 150 roadmap">
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
        </p>
      </Card>

      {TIERS.map((names, tier) => (
        <div key={tier} className="roadmap-tier">
          {names.map((name) => (
            <CategoryCard key={name} name={name} stats={byCategory.get(name)!} state={state} actions={actions} />
          ))}
        </div>
      ))}
    </div>
  );
}
