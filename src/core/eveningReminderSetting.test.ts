import { describe, expect, it } from 'vitest';
import { defaultState, deserializeState, serializeState, StateValidationError, validateState } from './state';
import { isUntouchedState, mergeStates } from './syncMerge';
import type { AppState } from './types';

const base = (): AppState => defaultState('2026-01-01');
const withSetting = (state: AppState, value: boolean | undefined): AppState => ({
  ...state,
  settings: { ...state.settings, ...(value === undefined ? {} : { eveningOnlyIfOpen: value }) },
});

describe('settings.eveningOnlyIfOpen', () => {
  it('is optional: legacy data stays valid and without the field', () => {
    const legacy = deserializeState(serializeState(base()));
    expect(legacy.settings).not.toHaveProperty('eveningOnlyIfOpen');
    expect(validateState(legacy)).toEqual(legacy);
    expect(legacy.version).toBe(1);
  });

  it.each([true, false])('round-trips %s', (value) => {
    expect(deserializeState(serializeState(withSetting(base(), value)))).toEqual(withSetting(base(), value));
  });

  it.each([1, 'false', null, {}])('rejects %j', (value) => {
    expect(() => validateState({ ...base(), settings: { ...base().settings, eveningOnlyIfOpen: value } })).toThrow(StateValidationError);
  });
});

describe('settings.eveningOnlyIfOpen and sync', () => {
  it('merges as its own settings record: one-sided change propagates, other settings are kept', () => {
    const left = { ...withSetting(base(), false), settings: { ...base().settings, eveningOnlyIfOpen: false, dailyCapMin: 200 } };
    const right = { ...base(), settings: { ...base().settings, morningNotify: '07:45' } };
    const result = mergeStates(base(), left, right);
    expect(result.conflicts).toEqual([]);
    expect(result.state.settings).toMatchObject({ eveningOnlyIfOpen: false, dailyCapMin: 200, morningNotify: '07:45' });
  });

  it('turning it back on (removing the field) on one device propagates as a deletion', () => {
    const before = withSetting(base(), false);
    const result = mergeStates(before, base(), before);
    expect(result.conflicts).toEqual([]);
    expect(result.state.settings).not.toHaveProperty('eveningOnlyIfOpen');
  });

  it('conflicts when both devices pick different values, keeping neither mixed', () => {
    const result = mergeStates(base(), withSetting(base(), false), withSetting(base(), true));
    expect(result.conflicts.map((c) => c.path)).toEqual(['settings/eveningOnlyIfOpen']);
  });

  it('the default (absent) keeps a fresh device untouched; a stored value does not', () => {
    expect(isUntouchedState(base())).toBe(true);
    expect(isUntouchedState(withSetting(base(), false))).toBe(false);
  });
});
