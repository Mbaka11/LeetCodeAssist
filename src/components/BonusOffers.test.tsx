import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { materializePlan, planDay, type DayPlan } from '../core/planner';
import { day, newState, simulateDay } from '../core/testing';
import type { AppState } from '../core/types';
import { getProblem } from '../data/neetcode150';
import type { AppActions } from '../lib/actions';
import { startExtraPractice } from '../lib/commands';
import { BonusOffers } from './BonusOffers';

const actions = new Proxy({}, { get: () => () => Promise.resolve() }) as AppActions;
const NOW = new Date(2025, 0, 6, 10).getTime();

function render(plan: DayPlan, targetMinutes = 150): string {
  return renderToStaticMarkup(
    <BonusOffers plan={plan} targetMinutes={targetMinutes} now={NOW} actions={actions} budgets={undefined} />,
  );
}

const count = (html: string, needle: string): number => html.split(needle).length - 1;

describe('BonusOffers', () => {
  it('renders both optional offers with the optional / not-in-core-time / reviews hint', () => {
    const plan = planDay(newState(), day(1));
    const html = render(plan);
    expect(html).toContain('Optional bonus problems (2 offered)');
    expect(count(html, 'class="bonus-offer"')).toBe(2);
    expect(count(html, '>Optional</span>')).toBe(2);
    expect(html).toContain('not included in today&#x27;s core plan time');
    expect(html).toContain('adds its own later reviews');
    for (const offer of plan.bonuses) {
      expect(html).toContain(getProblem(offer.activity.slug)!.title);
    }
    // Both offers can be started.
    expect(count(html, '>Start</button>')).toBe(2);
  });

  it('shows the added time against the target for each offer', () => {
    const html = render(planDay(newState(), day(1)));
    expect(count(html, 'bonus-impact bonus-impact-')).toBe(2);
    expect(html).toContain('Adds ~');
  });

  it('still offers both problems and warns about the cap when the core plan already fills it', () => {
    const base = newState();
    const tight: AppState = { ...base, settings: { ...base.settings, dailyTargetMin: 30, dailyCapMin: 40 } };
    const plan = planDay(tight, day(1));
    expect(plan.plannedMinutes).toBeGreaterThan(plan.capMinutes);
    expect(plan.bonuses).toHaveLength(2);
    const html = render(plan, 30);
    expect(count(html, 'class="bonus-offer"')).toBe(2);
    expect(count(html, 'bonus-impact-over-cap')).toBe(2);
    expect(html).toContain('over your 40 min cap');
  });

  it('keeps a started offer visible with its timer controls and no extra-time warning', () => {
    const state = materializePlan(newState(), planDay(newState(), day(1)));
    const offer = planDay(state, day(1)).bonuses[0]!;
    const started = startExtraPractice(state, offer.activity.slug, NOW).state;
    const plan = planDay(started, day(1));
    expect(plan.bonuses).toHaveLength(2);
    const html = render(plan);
    expect(html).toContain('>Pause</button>');
    expect(html).toContain('>Approach found</button>');
    expect(html).toContain('>Finish</button>');
    expect(count(html, 'bonus-impact bonus-impact-')).toBe(1);
  });

  it('counts a started offer in the time impact shown for the other offer', () => {
    const state = materializePlan(newState(), planDay(newState(), day(1)));
    const [first, second] = planDay(state, day(1)).bonuses;
    const base = planDay(state, day(1));
    const roomy = base.plannedMinutes + Math.max(first!.minutes, second!.minutes);
    expect(roomy).toBeLessThan(base.capMinutes);
    // Before anything is started, either offer alone fits the target.
    expect(count(render(base, roomy), 'bonus-impact-within-target')).toBe(2);
    const started = startExtraPractice(state, first!.activity.slug, NOW).state;
    const html = render(planDay(started, day(1)), roomy);
    // The running offer adds its minutes, so the remaining planned offer now goes over the target.
    expect(count(html, 'bonus-impact bonus-impact-')).toBe(1);
    expect(html).not.toContain('bonus-impact-within-target');
    expect(html).toMatch(/bonus-impact-over-(target|cap)/);
  });

  it('lists finished bonus problems in one line and offers two new ones', () => {
    const first = simulateDay(newState(), day(1), { bonus: true });
    const finished = first.plan.bonuses.map((b) => b.activity.slug);
    const plan = planDay(first.state, day(1));
    expect(plan.completedBonuses).toHaveLength(2);
    const html = render(plan);
    expect(html).toContain('Finished today (2):');
    expect(html).toContain('Logs and the Calendar');
    expect(count(html, 'class="bonus-offer"')).toBe(2);
    for (const slug of finished) {
      expect(plan.bonuses.some((b) => b.activity.slug === slug)).toBe(false);
    }
    // Finished work is not a card: no Done activity is rendered in the offers.
    expect(html).not.toContain('activity-done');
  });

  it('shows the hold message when fewer than two offers are possible', () => {
    const plan = planDay(newState(), day(1));
    const hold = { reason: 'locked' as const, message: 'More bonus problems unlock after Backtracking.' };
    const html = render({ ...plan, bonuses: plan.bonuses.slice(0, 1), bonusHold: hold });
    expect(count(html, 'class="bonus-offer"')).toBe(1);
    expect(html).toContain('More bonus problems unlock after Backtracking.');
  });

  it('renders nothing without offers, hold or finished problems', () => {
    const plan = planDay(newState(), day(1));
    expect(render({ ...plan, bonuses: [], completedBonuses: [], bonusHold: null })).toBe('');
  });
});
