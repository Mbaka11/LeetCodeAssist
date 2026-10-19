import type { MouseEvent, ReactNode } from 'react';
import type { Activity, BudgetOverrides } from '../core/types';
import { getProblem, problemUrl } from '../data/neetcode150';
import type { AppActions } from '../lib/actions';
import { groupActivities } from '../lib/groupActivities';
import { difficultyTone } from '../lib/instructions';
import type { AcceptedPrompt } from '../lib/leetcodeSubmissions';
import { problemHref } from '../lib/route';
import { ActivityCard, type CardVariant } from './ActivityCard';
import { Badge } from './Badge';

export interface ProblemActivityItem {
  activity: Activity;
  variant?: CardVariant;
}

/** Classic card for one activity, shared heading and numbered rows for repeats. No data is merged. */
export function ProblemActivities({ items, history, now, actions, budgets, compact = false,
  openProblemSheet, accepted, selectedActivityId, footer, unfinishedFirst = false,
}: {
  items: readonly ProblemActivityItem[];
  history: readonly Activity[];
  now: number;
  actions: AppActions;
  budgets?: BudgetOverrides | undefined;
  compact?: boolean;
  openProblemSheet?: ((slug: string) => void) | undefined;
  accepted?: AcceptedPrompt | undefined;
  selectedActivityId?: string | undefined;
  /** Used for the single-problem side panel's repeat-practice action. */
  footer?: ReactNode;
  unfinishedFirst?: boolean;
}) {
  return <div className="stack-tight problem-groups">
    {groupActivities(items, history, unfinishedFirst).map((group) => {
      const problem = getProblem(group.slug);
      const title = problem?.title ?? group.slug;
      const done = group.items.filter((item) => item.activity.status === 'done').length;
      const running = group.items.some((item) => item.activity.timer.running);
      const multiple = group.items.length > 1;
      // Keep this wrapper and each keyed ActivityCard mounted when the group grows/shrinks, so a Finish
      // form does not lose its outcome, minutes or date when another attempt appears.
      return <section key={group.slug} className={`problem-activity-group${multiple ? '' : ' problem-single'}${running ? ' has-running' : ''}`}
        aria-label={`${title} activities`}>
        {multiple ? <header className={`activity-head problem-group-head${compact ? '' : ' has-leetcode-link'}`}>
          <a className="activity-title" href={problemHref(group.slug)}
            {...(openProblemSheet ? { onClick: (event: MouseEvent<HTMLAnchorElement>) => {
              event.preventDefault(); openProblemSheet(group.slug);
            } } : {})}>{title}</a>
          {problem ? <Badge tone={difficultyTone(problem.difficulty)}>{problem.difficulty}</Badge> : null}
          {problem && !compact ? <span className="muted">{problem.category}</span> : null}
          <span className="muted">{group.items.length} activities · {done} done</span>
          {!compact ? <a className="link-out activity-leetcode" href={problem?.url ?? problemUrl(group.slug)} target="_blank" rel="noreferrer">LeetCode ↗</a> : null}
        </header> : null}
        <div className="problem-attempts">
          {group.items.map((item, index) => <ActivityCard key={item.activity.id}
            activity={item.activity} variant={item.variant ?? 'planned'} now={now} actions={actions}
            budgets={budgets} compact={compact} grouped={multiple} attemptNumber={index + 1}
            openProblemSheet={openProblemSheet}
            accepted={accepted} autoOpenAccepted={item.activity.id === selectedActivityId} />)}
        </div>
        {footer}
      </section>;
    })}
  </div>;
}
