import { Badge } from '../components/Badge';
import { LeetCodeLink } from '../components/LeetCodeLink';
import { CompanyBadges, ProblemTags } from '../components/ProblemMetadata';
import { getProblemStatus } from '../core/state';
import type { AppState, Problem } from '../core/types';
import { isBonusProblem } from '../data/bonus';
import { isPremiumProblem } from '../data/premium';
import { BENCHMARKS, PROGRAM_QUEUE } from '../data/program';
import type { AppActions } from '../lib/actions';
import { STATUS_LABELS, STATUS_TONES, difficultyTone } from '../lib/instructions';
import { problemHref } from '../lib/route';

const BENCHMARK_SLUGS: ReadonlySet<string> = new Set(BENCHMARKS.flatMap((b) => [b.easy, b.medium]));
const PROGRAM_SLUGS: ReadonlySet<string> = new Set(PROGRAM_QUEUE);

/** The problems of one category: checkbox, link, difficulty, program badges, status pill, LeetCode link. */
export function RoadmapProblemList({
  problems,
  state,
  actions,
  detailed = false,
  hideTechniques = false,
}: {
  problems: readonly Problem[];
  state: AppState;
  actions: AppActions;
  detailed?: boolean;
  hideTechniques?: boolean;
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
            {detailed ? <div className="problem-row-details">
              {!hideTechniques ? <ProblemTags slug={problem.slug} /> : null}
              <CompanyBadges slug={problem.slug} />
            </div> : null}
          </li>
        );
      })}
    </ul>
  );
}
