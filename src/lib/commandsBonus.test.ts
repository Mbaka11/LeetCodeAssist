import { describe, expect, it } from 'vitest';
import { findActivity } from '../core/activities';
import { planDay } from '../core/planner';
import { START, day, newState } from '../core/testing';
import { BONUS_POOL } from '../data/bonus';
import type { Activity, AppState } from '../core/types';
import * as commands from './commands';
import { badgeText, summarizeToday } from './reminders';

function at(date: string, hour = 10): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y!, m! - 1, d!, hour, 0, 0).getTime();
}

const bonusActivities = (state: AppState): Activity[] =>
  state.activities.filter((a) => a.type === 'new' && BONUS_POOL.includes(a.slug));

describe('bonus offers through the commands', () => {
  it('persists two offers with the plan and never duplicates them on repeated materializing', () => {
    const state = commands.materializeToday(newState(), at(START));
    expect(bonusActivities(state)).toHaveLength(2);
    expect(commands.materializeToday(state, at(START))).toBe(state);
    const later = commands.materializeToday(state, at(day(4)));
    expect(bonusActivities(later).map((a) => a.id)).toEqual(bonusActivities(state).map((a) => a.id));
  });

  it('starts an offered problem from the side panel without a duplicate and keeps its hints on resume', () => {
    const now = at(START);
    const state = commands.materializeToday(newState(), now);
    const offer = planDay(state, START).bonuses[1]!.activity;
    const started = commands.startExtraPractice(state, offer.slug, now);
    expect(started.activityId).toBe(offer.id);
    expect(started.state.activities).toHaveLength(state.activities.length);
    const hinted = commands.revealHint(started.state, offer.id, 2);
    const paused = commands.pauseActivity(hinted, offer.id, now + 60_000);
    const resumed = commands.startExtraPractice(paused, offer.slug, now + 120_000);
    expect(resumed.activityId).toBe(offer.id);
    expect(resumed.state.activities).toHaveLength(state.activities.length);
    expect(findActivity(resumed.state, offer.id)).toMatchObject({ status: 'in_progress', hintsUsed: 2, id: offer.id });
  });

  it('keeps a running bonus resumable after midnight with the same id, timer and hints', () => {
    const now = at(START);
    let state = commands.materializeToday(newState(), now);
    const offer = planDay(state, START).bonuses[0]!.activity;
    state = commands.startActivity(state, offer.id, now);
    state = commands.revealHint(state, offer.id, 1);
    state = commands.pauseActivity(state, offer.id, now + 10 * 60_000);
    const stored = findActivity(state, offer.id)!;
    const nextDay = commands.materializeToday(state, at(day(2)));
    const plan = planDay(nextDay, day(2));
    expect(plan.bonuses.find((b) => b.activity.id === offer.id)!.activity).toEqual(stored);
    expect(plan.bonuses).toHaveLength(2);
    const resumed = commands.resumeActivity(nextDay, offer.id, at(day(2)));
    expect(findActivity(resumed, offer.id)).toMatchObject({ status: 'in_progress', hintsUsed: 1 });
    const done = commands.completeActivity(resumed, offer.id, { outcome: 'hint' }, at(day(2)) + 5 * 60_000);
    expect(findActivity(done, offer.id)).toMatchObject({ status: 'done', completedAt: day(2) });
    expect(findActivity(done, offer.id)!.totalMs).toBe(15 * 60_000);
  });

  it('starts an unlisted pool problem as one extra that joins the offers without displacing core items', () => {
    const now = at(START);
    const state = commands.materializeToday(newState(), now);
    const before = planDay(state, START);
    const unlisted = 'generate-parentheses';
    expect(before.bonuses.map((b) => b.activity.slug)).not.toContain(unlisted);
    const started = commands.startExtraPractice(state, unlisted, now);
    expect(started.state.activities).toHaveLength(state.activities.length + 1);
    const again = commands.startExtraPractice(started.state, unlisted, now + 1000);
    expect(again.activityId).toBe(started.activityId);
    expect(again.state.activities).toHaveLength(started.state.activities.length);
    const after = planDay(started.state, START);
    expect(after.bonuses.map((b) => b.activity.id)).toContain(started.activityId);
    expect(after.items.map((i) => i.activity.id)).toEqual(before.items.map((i) => i.activity.id));
    expect(after.plannedMinutes).toBe(before.plannedMinutes);
  });

  it('skips an offer: it is replaced at once, planned duplicates are retired, and it comes back later', () => {
    const now = at(START);
    let state = commands.materializeToday(newState(), now);
    const first = planDay(state, START).bonuses[0]!.activity;
    const twin: Activity = { ...first, id: `${first.id}#legacy`, dueDate: day(2) };
    state = { ...state, activities: [...state.activities, twin] };
    const skipped = commands.skipActivity(state, first.id, now);
    expect(findActivity(skipped, first.id)?.status).toBe('skipped');
    expect(findActivity(skipped, twin.id)?.status).toBe('skipped');
    const plan = planDay(skipped, START);
    expect(plan.bonuses).toHaveLength(2);
    expect(plan.bonuses.map((b) => b.activity.slug)).not.toContain(first.slug);
    // Nothing is dropped from the history, and no recall is planned for a skipped new problem.
    expect(skipped.activities.some((a) => a.id === first.id)).toBe(true);
    expect(skipped.activities.some((a) => a.type === 'recall' && a.slug === first.slug)).toBe(false);
  });

  it('completing an offer replenishes the slot once the plan is persisted again, with reviews from that day', () => {
    const now = at(START);
    let state = commands.materializeToday(newState(), now);
    const [a, b] = planDay(state, START).bonuses.map((x) => x.activity);
    state = commands.completeActivity(state, a!.id, { outcome: 'solo', totalMs: 20 * 60_000 }, now);
    state = commands.completeActivity(state, b!.id, { outcome: 'solo', totalMs: 25 * 60_000 }, now);
    const next = commands.materializeToday(state, now);
    const open = planDay(next, START).bonuses;
    expect(open).toHaveLength(2);
    expect(open.every((o) => o.persisted)).toBe(true);
    expect(new Set([a!.slug, b!.slug, ...open.map((o) => o.activity.slug)]).size).toBe(4);
    for (const done of [a!, b!]) {
      expect(next.activities.filter((x) => x.slug === done.slug && x.type === 'recall' && x.status === 'planned')).toHaveLength(1);
    }
  });

  it('keeps the offers out of the toolbar badge and the day summary', () => {
    const now = at(START);
    const state = commands.materializeToday(newState(), now);
    const plan = planDay(state, START);
    expect(plan.bonuses).toHaveLength(2);
    const open = plan.items.filter((i) => i.activity.status === 'planned' || i.activity.status === 'in_progress');
    expect(badgeText(state, now)).toBe(String(open.length));
    expect(summarizeToday(state, now)!.open).toHaveLength(open.length);
    expect(summarizeToday(state, now)!.remainingMinutes).toBe(plan.remainingMinutes);
  });
});
