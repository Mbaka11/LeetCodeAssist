import { describe, expect, it } from 'vitest';
import { applyOutcome, needsBonusSimplify, simplifyBonusReviews } from './reviews';
import { day, newState } from './testing';
import type { Activity, ActivityType, AppState } from './types';

const slug = 'minimum-window-substring';

function activity(type: ActivityType, status: Activity['status'], due: string, extra: Partial<Activity> = {}): Activity {
  return { id: `${type}:${slug}:${due}`, slug, type, dueDate: due, status, createdAt: day(1),
    timer: { startedAt: null, accumulatedMs: 0, running: false }, ...extra };
}

/** A bonus finished on day 1 under the old rule: recall, rebuild, resolve and blind are all planned. */
function oldRuleState(): AppState {
  const base = newState();
  return { ...base, activities: [
    activity('new', 'done', day(1), { completedAt: day(1), outcome: 'solo', totalMs: 1_800_000 }),
    activity('recall', 'planned', day(2)), activity('rebuild', 'planned', day(4)),
    activity('resolve', 'planned', day(8)), activity('blind', 'planned', day(22)),
  ] };
}

describe('bonus problems come back as two rebuilds', () => {
  it('finishing a bonus plans rebuilds at +2 and +6 days, with no recall, resolve or blind', () => {
    const base = newState();
    const planned = { ...base, activities: [activity('new', 'planned', day(1))] };
    const next = applyOutcome(planned, `new:${slug}:${day(1)}`, { outcome: 'solo', completedDate: day(1), now: 0, totalMs: 60_000 });
    const open = next.activities.filter((a) => a.status === 'planned');
    expect(open.map((a) => `${a.type}@${a.dueDate}`).sort()).toEqual([`rebuild@${day(3)}`, `rebuild@${day(7)}`]);
  });

  it('the last solo rebuild marks the bonus problem as reviewed', () => {
    const base = newState();
    let state: AppState = { ...base, activities: [activity('new', 'planned', day(1))] };
    state = applyOutcome(state, `new:${slug}:${day(1)}`, { outcome: 'solo', completedDate: day(1), now: 0, totalMs: 60_000 });
    state = applyOutcome(state, `rebuild:${slug}:${day(3)}`, { outcome: 'solo', completedDate: day(3), now: 0, totalMs: 60_000 });
    expect(state.problemStatus[slug]).toBe('learning');
    state = applyOutcome(state, `rebuild:${slug}:${day(7)}`, { outcome: 'solo', completedDate: day(7), now: 0, totalMs: 60_000 });
    expect(state.problemStatus[slug]).toBe('reviewed');
  });

  it('moves a bonus finished under the old rule to two rebuilds without deleting anything', () => {
    const state = oldRuleState();
    expect(needsBonusSimplify(state)).toBe(true);
    const next = simplifyBonusReviews(state);
    expect(next.activities).toHaveLength(state.activities.length + 1); // one rebuild added, nothing removed
    const byType = (type: ActivityType, status: Activity['status']) => next.activities.filter((a) => a.type === type && a.status === status);
    expect(byType('recall', 'skipped')).toHaveLength(1);
    expect(byType('resolve', 'skipped')).toHaveLength(1);
    expect(byType('blind', 'skipped')).toHaveLength(1);
    expect(byType('rebuild', 'planned').map((a) => a.dueDate).sort()).toEqual([day(4), day(7)]);
    expect(needsBonusSimplify(next)).toBe(false);
    expect(simplifyBonusReviews(next)).toBe(next);
  });

  it('leaves program problems alone', () => {
    const state: AppState = { ...newState(), activities: [
      { ...activity('new', 'done', day(1), { completedAt: day(1) }), slug: 'two-sum', id: 'new:two-sum:1' },
      { ...activity('recall', 'planned', day(2)), slug: 'two-sum', id: 'recall:two-sum:2' },
    ] };
    expect(needsBonusSimplify(state)).toBe(false);
  });
});
