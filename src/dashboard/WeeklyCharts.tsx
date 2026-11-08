/** Hand-drawn SVG charts of the weekly review. Colours come from the theme tokens; text always accompanies them. */
import type { OutcomeCounts, WeeklyCategory, WeeklyDay } from '../core/weekly';
import { OUTCOME_LABELS } from '../lib/instructions';
import { formatMinutes } from '../lib/format';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekday = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()]!;
};

const W = 560, H = 190, LEFT = 38, RIGHT = 8, TOP = 10, BOTTOM = 26;

/** Minutes logged per day of the chosen week (solid) against the same weekday of the previous week (outline). */
export function DailyMinutesChart({ days }: { days: readonly WeeklyDay[] }) {
  const max = Math.max(30, ...days.flatMap((d) => [d.minutes, d.previousMinutes]));
  const yMax = Math.ceil(max / 30) * 30;
  const plotW = W - LEFT - RIGHT;
  const slot = plotW / days.length;
  const barW = Math.min(26, slot / 2 - 4);
  const y = (value: number): number => TOP + (H - TOP - BOTTOM) * (1 - value / yMax);
  const total = days.reduce((sum, d) => sum + d.minutes, 0);
  return (
    <figure className="wk-figure">
      <svg className="wk-svg" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Minutes logged per day this week (${Math.round(total)} in total) against the previous week. A table follows.`}>
        {[0, yMax / 2, yMax].map((tick) => (
          <g key={tick}>
            <line className="wk-grid" x1={LEFT} x2={W - RIGHT} y1={y(tick)} y2={y(tick)} />
            <text className="wk-text" x={LEFT - 6} y={y(tick) + 3} textAnchor="end">{Math.round(tick)}</text>
          </g>
        ))}
        {days.map((day, i) => {
          const cx = LEFT + slot * i + slot / 2;
          return (
            <g key={day.date}>
              <title>{`${day.date}: ${formatMinutes(day.minutes)} (previous week ${formatMinutes(day.previousMinutes)})`}</title>
              <rect className="wk-bar-prev" x={cx - barW - 2} width={barW} y={y(day.previousMinutes)}
                height={Math.max(0, y(0) - y(day.previousMinutes))} rx={3} />
              <rect className="wk-bar" x={cx + 2} width={barW} y={y(day.minutes)}
                height={Math.max(0, y(0) - y(day.minutes))} rx={3} />
              {day.minutes > 0 ? <text className="wk-text wk-value" x={cx + 2 + barW / 2} y={y(day.minutes) - 4} textAnchor="middle">{Math.round(day.minutes)}</text> : null}
              <text className="wk-text" x={cx} y={H - 8} textAnchor="middle">{weekday(day.date)}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="wk-legend">
        <span><i className="wk-swatch wk-swatch-cur" aria-hidden="true" /> This week</span>
        <span><i className="wk-swatch wk-swatch-prev" aria-hidden="true" /> Previous week</span>
        <span className="muted">minutes per day</span>
      </figcaption>
      <table className="visually-hidden">
        <caption>Minutes logged per day</caption>
        <thead><tr><th>Day</th><th>This week</th><th>Previous week</th></tr></thead>
        <tbody>{days.map((d) => <tr key={d.date}><td>{d.date}</td><td>{Math.round(d.minutes)}</td><td>{Math.round(d.previousMinutes)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

const OUTCOME_ORDER = ['solo', 'hint', 'solution', 'stuck', 'unrated'] as const;
const outcomeLabel = (key: (typeof OUTCOME_ORDER)[number]): string => (key === 'unrated' ? 'No outcome' : OUTCOME_LABELS[key]);

function OutcomeBar({ label, counts }: { label: string; counts: OutcomeCounts }) {
  const total = OUTCOME_ORDER.reduce((sum, key) => sum + counts[key], 0);
  return (
    <div className="wk-outcome-row">
      <span className="wk-outcome-label">{label}</span>
      {total === 0 ? <span className="muted">no activities</span> : (
        <div className="wk-stack" role="img"
          aria-label={`${label}: ${OUTCOME_ORDER.filter((k) => counts[k] > 0).map((k) => `${counts[k]} ${outcomeLabel(k)}`).join(', ')}`}>
          {OUTCOME_ORDER.filter((key) => counts[key] > 0).map((key) => (
            <span key={key} className={`wk-seg wk-seg-${key}`} style={{ flexGrow: counts[key] }} title={`${outcomeLabel(key)}: ${counts[key]}`}>
              {counts[key]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** How the completed activities of the week ended, against the previous week. */
export function OutcomeMix({ current, previous }: { current: OutcomeCounts; previous: OutcomeCounts }) {
  return (
    <div className="wk-outcomes">
      <OutcomeBar label="This week" counts={current} />
      <OutcomeBar label="Previous" counts={previous} />
      <p className="wk-legend">
        {OUTCOME_ORDER.map((key) => <span key={key}><i className={`wk-swatch wk-seg-${key}`} aria-hidden="true" /> {outcomeLabel(key)} {current[key]}</span>)}
      </p>
    </div>
  );
}

/** Activities per category as bars; the amber part is the attempts that needed help. */
export function CategoryBars({ categories }: { categories: readonly WeeklyCategory[] }) {
  const max = Math.max(1, ...categories.map((c) => c.attempts));
  return (
    <ul className="wk-categories">
      {categories.map((c) => {
        const helpedShare = c.attempts === 0 ? 0 : (c.helped / c.attempts) * 100;
        return (
          <li key={c.category} className="wk-category">
            <span className="wk-category-name">{c.category}</span>
            <span className="wk-track" role="img"
              aria-label={`${c.attempts} activities, ${c.helped} of ${c.rated} rated needed help`}>
              <span className="wk-fill" style={{ width: `${(c.attempts / max) * 100}%` }}>
                <span className="wk-fill-help" style={{ width: `${helpedShare}%` }} />
              </span>
            </span>
            <span className="wk-category-text">
              <strong>{c.attempts}</strong> act.
              {c.rated === 0 ? '' : <> · help {c.helped}/{c.rated} ({Math.round((c.helped / c.rated) * 100)}%)</>}
              {c.firstWorked > 0 ? <> · {c.firstWorked} new</> : null}
              {c.independentReviewProblems > 0 || c.previousIndependentReviewProblems > 0 ? (
                <> · solo reviews {c.independentReviewProblems} <span className="muted">(prev {c.previousIndependentReviewProblems})</span>{c.independentReviewProblems > c.previousIndependentReviewProblems ? ' ▲' : ''}</>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
