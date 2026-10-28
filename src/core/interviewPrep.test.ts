import { describe, expect, it } from 'vitest';
import { COMPANIES, companyInterviewEnabled, companyInterviewSlugs } from '../data/companies';
import { getProblem } from '../data/neetcode150';
import { createActivity } from './activities';
import { interviewPrepView, prepDateRange } from './interviewPrep';
import { planDay } from './planner';
import { programQueue } from './queue';
import { computeStreak, defaultState, deserializeState, loggedTotals, serializeState, validateState } from './state';
import type { InterviewPrep } from './practiceTypes';
import type { Activity, ActivityType, AppState } from './types';
import { weeklySummary } from './weekly';
import { workedTotals } from './worked';

const TODAY = '2025-06-10';
const prep: InterviewPrep = { companyId: 'google', date: '2025-06-24', createdAt: 1000 };
const slugs = companyInterviewSlugs('google').filter((s) => getProblem(s)).sort((a, b) => getProblem(a)!.neetcodeOrder - getProblem(b)!.neetcodeOrder);
const [s1, s2, s3, s4] = slugs as [string, string, string, string];
let counter = 0;
function activity(slug: string, type: ActivityType, change: Partial<Activity>): Activity {
  return { ...createActivity([], { slug, type, dueDate: '2025-06-01', createdAt: '2025-06-01' }), id: `x${counter++}`, ...change };
}
const doneOn = (slug: string, type: ActivityType, completedAt: string, minutes: number, outcome: Activity['outcome'] = 'solo') =>
  activity(slug, type, { status: 'done', completedAt, outcome, totalMs: minutes * 60_000 });
function stateWith(activities: Activity[], extra: Partial<AppState> = {}): AppState {
  return { ...defaultState('2025-01-01'), activities, ...extra };
}

describe('prepDateRange', () => {
  it('spans today through 365 days ahead', () => {
    expect(prepDateRange('2025-06-10')).toEqual({ min: '2025-06-10', max: '2026-06-10' });
    expect(prepDateRange('2024-03-01').max).toBe('2025-03-01');
  });
});

describe('interviewPrepView', () => {
  it('lists exactly the documented coding problems in catalog order with your status', () => {
    const view = interviewPrepView(stateWith([], { problemStatus: { [s1]: 'reviewed' }, checked: { [s2]: true } }), prep, TODAY);
    expect(view.problems.map((p) => p.slug)).toEqual(slugs);
    expect(view.companyName).toBe('Google');
    expect(view.problems[0]).toMatchObject({ slug: s1, status: 'reviewed', worked: true });
    expect(view.problems[1]).toMatchObject({ slug: s2, status: 'untouched', worked: true });
    expect(view.problems[2]).toMatchObject({ slug: s3, status: 'untouched', worked: false });
  });
  it('computes days left, today and a passed date', () => {
    const state = stateWith([]);
    expect(interviewPrepView(state, prep, TODAY)).toMatchObject({ daysLeft: 14, passed: false });
    expect(interviewPrepView(state, { ...prep, date: TODAY }, TODAY)).toMatchObject({ daysLeft: 0, passed: false });
    expect(interviewPrepView(state, { ...prep, date: '2025-06-09' }, TODAY)).toMatchObject({ daysLeft: -1, passed: true });
  });
  it('flags untouched problems by the Practice worked rule (activities, learned status, solved check)', () => {
    const state = stateWith([activity(s1, 'new', { status: 'in_progress' }), activity(s2, 'new', { status: 'planned' })], { problemStatus: { [s3]: 'learning' } });
    const untouched = interviewPrepView(state, prep, TODAY).untouched.map((p) => p.slug);
    expect(untouched).not.toContain(s1);
    expect(untouched).not.toContain(s3);
    expect(untouched).toContain(s2);
    expect(untouched).toContain(s4);
    expect(untouched).toHaveLength(slugs.length - 2);
  });
  it('ranks the slowest by median logged minutes, with sample counts, ignoring activities without time', () => {
    const state = stateWith([
      doneOn(s1, 'new', '2025-06-01', 50), doneOn(s1, 'recall', '2025-06-02', 10), doneOn(s1, 'rebuild', '2025-06-03', 12),
      doneOn(s2, 'new', '2025-06-01', 40),
      doneOn(s3, 'new', '2025-06-01', 20), doneOn(s3, 'recall', '2025-06-02', 22),
      doneOn(s4, 'new', '2025-06-01', 5), activity(s4, 'recall', { status: 'done', completedAt: '2025-06-02', outcome: 'solo' }),
      doneOn('not-a-google-problem-slug', 'new', '2025-06-01', 500),
    ]);
    const view = interviewPrepView(state, prep, TODAY);
    expect(view.slowest.map((p) => [p.slug, p.medianMinutes, p.samples])).toEqual([[s2, 40, 1], [s3, 21, 2], [s1, 12, 3]]);
    expect(view.problems.find((p) => p.slug === s4)).toMatchObject({ medianMinutes: 5, samples: 1 });
    expect(interviewPrepView(stateWith([]), prep, TODAY).slowest).toEqual([]);
  });
  it('reuses the weekly fragile rule, limited to this company', () => {
    const state = stateWith([doneOn(s1, 'new', '2025-06-01', 30, 'stuck'), doneOn(s2, 'new', '2025-06-01', 30, 'solo'),
      doneOn('contains-duplicate', 'new', '2025-06-02', 10, 'stuck')]);
    const view = interviewPrepView(state, prep, TODAY);
    expect(view.fragile.map((f) => f.slug)).toEqual(weeklySummary(state, TODAY).fragile.map((f) => f.slug).filter((s) => slugs.includes(s)));
    expect(view.fragile).toEqual([{ slug: s1, title: getProblem(s1)!.title, reason: 'Latest eligible attempt was Stuck' }]);
  });
  it('lists scheduled reviews strictly before the interview date, marks overdue ones, and skips done/other-company/new ones', () => {
    const review = (slug: string, dueDate: string, change: Partial<Activity> = {}) => activity(slug, 'recall', { dueDate, ...change });
    const state = stateWith([
      review(s1, '2025-06-23'), review(s2, '2025-06-24'), review(s3, '2025-06-08'), review(s4, '2025-06-12', { status: 'in_progress' }),
      review(s1, '2025-06-11', { status: 'done', completedAt: '2025-06-11' }), review(s2, '2025-06-12', { status: 'skipped' }),
      activity(s2, 'new', { dueDate: '2025-06-12' }), review('contains-duplicate', '2025-06-12'),
    ]);
    const view = interviewPrepView(state, prep, TODAY);
    expect(view.scheduledBefore.map((r) => [r.slug, r.dueDate, r.overdue])).toEqual([[s3, '2025-06-08', true], [s4, '2025-06-12', false], [s1, '2025-06-23', false]]);
    expect(interviewPrepView(state, { ...prep, date: '2025-06-09' }, TODAY).scheduledBefore).toEqual([]);
  });
  it('reports a company without enough documented data as disabled but still computes its list', () => {
    const weak = COMPANIES.find((c) => !companyInterviewEnabled(c.id))!;
    const view = interviewPrepView(stateWith([]), { companyId: weak.id, date: prep.date, createdAt: 1 }, TODAY);
    expect(view.companyEnabled).toBe(false);
    expect(view.problems.map((p) => p.slug).sort()).toEqual(companyInterviewSlugs(weak.id).sort());
    expect(interviewPrepView(stateWith([]), prep, TODAY).companyEnabled).toBe(true);
  });
  it('is read-only: the state and every program/progress view stay identical with and without a prep', () => {
    const state = stateWith([doneOn(s1, 'resolve', '2025-06-05', 30), activity(s2, 'recall', { dueDate: '2025-06-12' })], { problemStatus: { [s1]: 'learning' } });
    const withPrep: AppState = { ...state, interviewPrep: prep };
    const snapshot = structuredClone(withPrep);
    interviewPrepView(withPrep, prep, TODAY);
    expect(withPrep).toEqual(snapshot);
    const view = (s: AppState) => ({ queue: programQueue(s), plan: planDay(s, TODAY), worked: workedTotals(s), streak: computeStreak(s, TODAY), logged: loggedTotals(s, TODAY), weekly: weeklySummary(s, TODAY) });
    expect(view(withPrep)).toEqual(view(state));
    expect(programQueue(withPrep)).toHaveLength(50);
  });
});

describe('interviewPrep state validation (version 1)', () => {
  it('keeps legacy absence and round-trips a prep', () => {
    expect('interviewPrep' in deserializeState(serializeState(defaultState('2025-01-01')))).toBe(false);
    const state = { ...defaultState('2025-01-01'), interviewPrep: prep };
    expect(deserializeState(serializeState(state))).toEqual(state);
    expect(state.version).toBe(1);
  });
  it('accepts a past date (it shows as passed) and rejects malformed values', () => {
    const base = defaultState('2025-01-01');
    expect(validateState({ ...base, interviewPrep: { ...prep, date: '2020-01-01' } }).interviewPrep?.date).toBe('2020-01-01');
    for (const bad of [null, 'x', [], { ...prep, companyId: 'nope' }, { ...prep, date: '2025-02-30' }, { ...prep, date: 20250624 }, { ...prep, date: '24/06/2025' },
      { ...prep, createdAt: -1 }, { ...prep, createdAt: 'now' }, { ...prep, createdAt: Infinity }, { date: prep.date, createdAt: 1 }]) {
      expect(() => validateState({ ...base, interviewPrep: bad })).toThrow();
    }
  });
});
