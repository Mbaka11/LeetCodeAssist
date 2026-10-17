import { describe, expect, it } from 'vitest';
import { bonusTimeImpact } from './bonusTime';

const base = { targetMinutes: 150, capMinutes: 180 };

describe('bonusTimeImpact', () => {
  it('stays within the target when the offer fits', () => {
    const impact = bonusTimeImpact({ ...base, countedMinutes: 100, offerMinutes: 40 });
    expect(impact).toMatchObject({ level: 'within-target', extraMinutes: 40, totalMinutes: 140 });
    expect(impact.message).toContain('Adds ~40 min');
    expect(impact.message).toContain('within your 2h30 target');
  });

  it('reaching the target exactly is still within it', () => {
    expect(bonusTimeImpact({ ...base, countedMinutes: 110, offerMinutes: 40 }).level).toBe('within-target');
  });

  it('warns that the target is exceeded while the cap still holds', () => {
    const impact = bonusTimeImpact({ ...base, countedMinutes: 130, offerMinutes: 40 });
    expect(impact.level).toBe('over-target');
    expect(impact.message).toContain('over your 2h30 target by 20 min');
    expect(impact.message).toContain('under the 3h cap');
  });

  it('warns explicitly when the cap is exceeded, also when the core plan alone already fills it', () => {
    const impact = bonusTimeImpact({ ...base, countedMinutes: 175, offerMinutes: 40 });
    expect(impact.level).toBe('over-cap');
    expect(impact.message).toContain('over your 3h cap by 35 min');
    const full = bonusTimeImpact({ ...base, countedMinutes: 180, offerMinutes: 25 });
    expect(full.level).toBe('over-cap');
    expect(full.totalMinutes).toBe(205);
  });
});
