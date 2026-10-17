import { formatMinutes } from './format';

/** How an optional bonus problem changes today's time compared with the target and the cap. */
export type BonusImpactLevel = 'within-target' | 'over-target' | 'over-cap';

export interface BonusImpact {
  /** Estimated minutes the offer adds on top of what is already counted today. */
  extraMinutes: number;
  /** Counted minutes today including the offer. */
  totalMinutes: number;
  level: BonusImpactLevel;
  /** Plain-language sentence for the UI; the level is always spelled out so colour is never the only signal. */
  message: string;
}

/**
 * Estimates what starting an optional offer adds. `countedMinutes` is the core plan plus any bonus work
 * already finished today; the offer is compared with the daily target and the hard cap. It is advice only:
 * the user decides, and the offer stays outside the core budget either way.
 */
export function bonusTimeImpact(input: {
  countedMinutes: number;
  offerMinutes: number;
  targetMinutes: number;
  capMinutes: number;
}): BonusImpact {
  const { countedMinutes, offerMinutes, targetMinutes, capMinutes } = input;
  const totalMinutes = countedMinutes + offerMinutes;
  const adds = `Adds ~${formatMinutes(offerMinutes)}, about ${formatMinutes(totalMinutes)} counted today`;
  if (totalMinutes > capMinutes) {
    return {
      extraMinutes: offerMinutes,
      totalMinutes,
      level: 'over-cap',
      message: `${adds}: over your ${formatMinutes(capMinutes)} cap by ${formatMinutes(totalMinutes - capMinutes)}. Only start it if you really have the time.`,
    };
  }
  if (totalMinutes > targetMinutes) {
    return {
      extraMinutes: offerMinutes,
      totalMinutes,
      level: 'over-target',
      message: `${adds}: over your ${formatMinutes(targetMinutes)} target by ${formatMinutes(totalMinutes - targetMinutes)}, still under the ${formatMinutes(capMinutes)} cap.`,
    };
  }
  return {
    extraMinutes: offerMinutes,
    totalMinutes,
    level: 'within-target',
    message: `${adds}: within your ${formatMinutes(targetMinutes)} target.`,
  };
}
