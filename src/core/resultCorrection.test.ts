import { describe, expect, it } from 'vitest';
import { createActivity, isReviewType } from './activities';
import { confirmResultCorrection, correctionDateBounds, prepareResultCorrection, type ResultEdit } from './resultCorrection';
import { applyOutcome } from './reviews';
import { defaultState, deserializeState, serializeState, validateState } from './state';
import type { Activity, AppState } from './types';

const NOW = new Date(2025, 0, 30, 12).getTime();
const DAY = '2025-01-06';
function learned(type: 'new' | 'benchmark' = 'new', slug = 'two-sum') {
  const base = defaultState(DAY);
  const activity = createActivity([], { type, slug, dueDate: DAY, createdAt: DAY });
  const state = applyOutcome({ ...base, activities: [activity] }, activity.id, {
    outcome: 'solo', completedDate: DAY, totalMs: 600_000, now: 0,
  });
  return { state, id: activity.id, edit: { completedDate: DAY, totalMs: 600_000, outcome: 'solo' } as ResultEdit };
}
function pending(state: AppState, slug = 'two-sum') {
  return state.activities.filter((a) => a.slug === slug && a.status === 'planned' && isReviewType(a.type) && !a.extra);
}
function editFor(a: Activity): ResultEdit { return { completedDate: a.completedAt!, totalMs: a.totalMs!, outcome: a.outcome! }; }

describe('saved-result correction preview and commit', () => {
  it('does not mutate on preview; duration-only corrections preserve review IDs and status and audit prior values', () => {
    const { state, id, edit } = learned();
    const original = serializeState(state);
    const patch = { ...edit, totalMs: 900_000 };
    const { preview } = prepareResultCorrection(state, id, patch, NOW);
    expect(serializeState(state)).toBe(original);
    expect(preview.retired).toHaveLength(0);
    expect(preview.added).toHaveLength(0);
    expect(preview.scheduleRecalculated).toBe(false);
    const saved = confirmResultCorrection(state, id, patch, preview.fingerprint, NOW + 1000);
    expect(pending(saved)).toEqual(pending(state));
    expect(saved.problemStatus).toEqual(state.problemStatus);
    expect(saved.activities.find((a) => a.id === id)).toMatchObject({ totalMs: 900_000,
      corrections: [{ at: NOW + 1000, previousDate: DAY, previousOutcome: 'solo', previousTotalMs: 600_000 }] });
    expect(deserializeState(serializeState(saved))).toEqual(saved);
  });

  it.each([['new', 'two-sum'], ['benchmark', 'contains-duplicate'], ['new', 'valid-sudoku']] as const)(
    'moves pending %s reviews from the corrected %s anchor, retaining old plans as skipped', (type, slug) => {
      const { state, id, edit } = learned(type, slug);
      const { preview, state: next } = prepareResultCorrection(state, id, { ...edit, completedDate: '2025-01-07' }, NOW);
      expect(preview.retired).toHaveLength(4);
      expect(preview.added.map((a) => a.dueDate)).toEqual(['2025-01-08', '2025-01-10', '2025-01-14', '2025-01-28']);
      expect(preview.retired.every((a) => next.activities.some((b) => b.id === a.id && b.status === 'skipped'))).toBe(true);
      expect(next.activities).toHaveLength(state.activities.length + 4);
      expect(next.activities.find((a) => a.id === id)?.completedAt).toBe('2025-01-07');
    },
  );

  it('replays later completed reviews and never changes their fields', () => {
    const fixture = learned();
    const recall = pending(fixture.state).find((a) => a.type === 'recall')!;
    const state = applyOutcome(fixture.state, recall.id, { outcome: 'solo', completedDate: '2025-01-08', totalMs: 300_000, now: 0 });
    const { state: next } = prepareResultCorrection(state, fixture.id, { ...fixture.edit, completedDate: '2025-01-07' }, NOW);
    expect(next.activities.find((a) => a.id === recall.id)).toEqual(state.activities.find((a) => a.id === recall.id));
    expect(pending(next).some((a) => a.type === 'recall')).toBe(false);
    expect(pending(next).map((a) => a.dueDate)).toEqual(['2025-01-10', '2025-01-14', '2025-01-28']);
  });

  it('changing a recall to Solution adds a retry and updates status without removing the normal cycle', () => {
    const fixture = learned();
    const recall = pending(fixture.state).find((a) => a.type === 'recall')!;
    const state = applyOutcome(fixture.state, recall.id, { outcome: 'solo', completedDate: '2025-01-07', totalMs: 300_000, now: 0 });
    const done = state.activities.find((a) => a.id === recall.id)!;
    const { preview, state: next } = prepareResultCorrection(state, recall.id, { ...editFor(done), outcome: 'solution' }, NOW);
    expect(preview.added.map((a) => [a.type, a.dueDate])).toEqual([['retry', '2025-01-08']]);
    expect(preview.retired).toHaveLength(0);
    expect(preview.statusAfter).toBe('consolidating');
    expect(next.activities.find((a) => a.id === fixture.id)).toEqual(state.activities.find((a) => a.id === fixture.id));
  });

  it('recomputes mastery from a corrected Blind outcome and preserves the completed Blind record identity', () => {
    const fixture = learned();
    const blind = pending(fixture.state).find((a) => a.type === 'blind')!;
    const state = applyOutcome(fixture.state, blind.id, { outcome: 'solo', completedDate: '2025-01-27', totalMs: 300_000, now: 0 });
    const done = state.activities.find((a) => a.id === blind.id)!;
    const { preview, state: next } = prepareResultCorrection(state, blind.id, { ...editFor(done), outcome: 'hint' }, NOW);
    expect(preview.statusBefore).toBe('mastered');
    expect(preview.statusAfter).toBe('consolidating');
    expect(pending(next).some((a) => a.type === 'resolve' && a.dueDate === '2025-02-03')).toBe(true);
    expect(next.activities.find((a) => a.id === blind.id)?.id).toBe(blind.id);
  });

  it('removes a no-longer-needed pending retry when a failed recall is corrected to Solo', () => {
    const fixture = learned();
    const recall = pending(fixture.state).find((a) => a.type === 'recall')!;
    const failed = applyOutcome(fixture.state, recall.id, { outcome: 'solution', completedDate: '2025-01-07', totalMs: 300_000, now: 0 });
    const done = failed.activities.find((a) => a.id === recall.id)!;
    const { preview, state: corrected } = prepareResultCorrection(failed, recall.id, { ...editFor(done), outcome: 'solo' }, NOW);
    expect(preview.retired.map((a) => a.type)).toEqual(['retry']);
    expect(preview.statusAfter).toBe('learning');
    expect(pending(corrected).some((a) => a.type === 'retry')).toBe(false);
  });

  it('lets later completed extra attempts keep their cycle-reset effects instead of reviving an older cycle', () => {
    const fixture = learned();
    const recall = pending(fixture.state).find((a) => a.type === 'recall')!;
    let source = applyOutcome(fixture.state, recall.id, { outcome: 'solo', completedDate: '2025-01-07', totalMs: 100, now: 0 });
    for (const [date, outcome] of [['2025-01-08', 'hint'], ['2025-01-10', 'solo']] as const) {
      const a = createActivity(source.activities, { slug: 'two-sum', type: 'resolve', dueDate: date, createdAt: date, extra: true });
      source = applyOutcome({ ...source, activities: [...source.activities, a] }, a.id,
        { outcome, completedDate: date, totalMs: 100, now: 0 });
    }
    const { preview, state: corrected } = prepareResultCorrection(source, fixture.id, { ...fixture.edit, completedDate: '2025-01-07' }, NOW);
    expect(preview.retired).toHaveLength(0);
    expect(preview.added).toHaveLength(0);
    expect(pending(corrected)).toEqual(pending(source));
    expect(preview.statusAfter).toBe('reviewed');
    expect(corrected.activities.filter((a) => a.id !== fixture.id && a.status === 'done'))
      .toEqual(source.activities.filter((a) => a.id !== fixture.id && a.status === 'done'));
  });

  it('protects started reviews, optional practice and unrelated problems', () => {
    const { state, id, edit } = learned();
    const rebuild = pending(state).find((a) => a.type === 'rebuild')!;
    const active: Activity = { ...rebuild, status: 'in_progress', timer: { running: true, startedAt: NOW - 1000, accumulatedMs: 500 } };
    const extra = { ...createActivity(state.activities, { slug: 'two-sum', type: 'resolve', dueDate: '2025-01-30', createdAt: DAY }), extra: true };
    const other = createActivity(state.activities, { slug: 'valid-anagram', type: 'new', dueDate: DAY, createdAt: DAY });
    const source = { ...state, activities: [...state.activities.map((a) => a.id === active.id ? active : a), extra, other] };
    const { state: next } = prepareResultCorrection(source, id, { ...edit, completedDate: '2025-01-07' }, NOW);
    expect(next.activities.find((a) => a.id === active.id)).toEqual(active);
    expect(next.activities.find((a) => a.id === extra.id)).toEqual(extra);
    expect(next.activities.find((a) => a.id === other.id)).toEqual(other);
    expect(pending(next).some((a) => a.type === 'rebuild')).toBe(false);
  });

  it('shows the replacement of a manually moved pending review in the preview', () => {
    const { state, id, edit } = learned();
    const recall = pending(state)[0]!;
    const source = { ...state, activities: state.activities.map((a) => a.id === recall.id ? { ...a, dueDate: '2025-02-15' } : a) };
    const { preview } = prepareResultCorrection(source, id, { ...edit, outcome: 'hint' }, NOW);
    expect(preview.retired.map((a) => a.dueDate)).toContain('2025-02-15');
    expect(preview.added.map((a) => a.dueDate)).toContain('2025-01-07');
  });

  it('rejects date reordering, future dates, invalid outcomes and invalid durations', () => {
    const { state, id, edit } = learned();
    for (const patch of [{ completedDate: '2025-01-05' }, { completedDate: '2025-02-01' },
      { totalMs: -1 }, { totalMs: Infinity }, { totalMs: 0.1 }, { outcome: 'unknown' }]) {
      expect(() => prepareResultCorrection(state, id, { ...edit, ...patch } as ResultEdit, NOW)).toThrow();
    }
    const recall = pending(state)[0]!;
    const later = applyOutcome(state, recall.id, { outcome: 'solo', completedDate: '2025-01-08', totalMs: 100, now: 0 });
    expect(correctionDateBounds(later, id, '2025-01-30').max).toBe('2025-01-08');
    expect(() => prepareResultCorrection(later, id, { ...edit, completedDate: '2025-01-09' }, NOW)).toThrow(/order/);
    const withApproach = { ...state, activities: state.activities.map((a) => a.id === id ? { ...a, approachMs: 500_000 } : a) };
    expect(() => prepareResultCorrection(withApproach, id, { ...edit, totalMs: 100 }, NOW)).toThrow(/approach time/);
  });

  it('refuses stale confirmation after another activity, settings edit or local-date rollover', () => {
    const { state, id, edit } = learned();
    const patch = { ...edit, totalMs: 900_000 };
    const { preview } = prepareResultCorrection(state, id, patch, NOW);
    const different = { ...state, settings: { ...state.settings, dailyTargetMin: 155 } };
    expect(() => confirmResultCorrection(different, id, patch, preview.fingerprint, NOW)).toThrow(/changed/);
    expect(() => confirmResultCorrection(state, id, patch, preview.fingerprint, NOW + 86_400_000)).toThrow(/changed/);
    const recall = pending(state)[0]!;
    const completed = applyOutcome(state, recall.id, { outcome: 'solo', completedDate: '2025-01-30', totalMs: 100, now: 0 });
    expect(() => confirmResultCorrection(completed, id, patch, preview.fingerprint, NOW)).toThrow(/changed/);
  });

  it('preserves multiple audit entries and validates them on import', () => {
    const { state, id, edit } = learned();
    const first = prepareResultCorrection(state, id, { ...edit, totalMs: 900_000 }, NOW).state;
    const next = prepareResultCorrection(first, id, { ...edit, totalMs: 1_000_000 }, NOW + 1).state;
    expect(next.activities.find((a) => a.id === id)?.corrections).toHaveLength(2);
    expect(validateState(next)).toEqual(next);
    const invalid = structuredClone(next);
    invalid.activities.find((a) => a.id === id)!.corrections![0]!.at = -1;
    expect(() => validateState(invalid)).toThrow(/corrections/);
  });

  it('returns the original state for no changes and never edits an uncompleted activity', () => {
    const { state, id, edit } = learned();
    expect(prepareResultCorrection(state, id, edit, NOW).state).toBe(state);
    expect(() => prepareResultCorrection(state, pending(state)[0]!.id, edit, NOW)).toThrow(/completed result/);
  });
});
