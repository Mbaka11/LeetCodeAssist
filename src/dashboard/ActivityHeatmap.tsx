import { Card } from '../components/Card';
import { activityHeatDays } from '../core/activityHeatmap';
import { addDays } from '../core/dates';
import type { AppState } from '../core/types';

export function ActivityHeatmap({ state, today }: { state: AppState; today: string }) {
  const ranges = [
    { label: 'Program days 1–30', start: state.settings.startDate, count: 30 },
    { label: 'Recent 12 weeks', start: addDays(today, -83), count: 84 },
  ];
  return <Card title="Activity minutes" className="activity-heatmap">
    <p className="muted">Completed activity logs, local dates. Includes optional attempts; this does not change your streak or plan.</p>
    <div className="activity-heat-ranges">
    {ranges.map(({ label, start, count }) => {
      const days = activityHeatDays(state, start, count, today);
      const weeks = Array.from({ length: Math.ceil(count / 7) }, (_, index) => days.slice(index * 7, index * 7 + 7));
      return <section key={label} className="stack-tight activity-heat-range">
        <h3>{label}</h3>
        <p className="muted">{start} – {addDays(start, count - 1)}</p>
        <div className="heat-grid" role="group" aria-label={`${label}: logged minutes per day`}>
          {weeks.map((week) => <div className="heat-week" key={week[0]!.date}>
            {week.map((day) => {
              const text = `${day.date}: ${Number(day.minutes.toFixed(1))} minutes logged${day.future ? ' (future)' : ''}`;
              return <span key={day.date} role="img" aria-label={text} title={text}
                className={`heat-cell heat-${day.future ? 'future' : day.level}`} />;
            })}
          </div>)}
        </div>
      </section>;
    })}
    </div>
    <p className="heat-legend activity-heat-legend" aria-label="Minutes legend: 0, under 30, 30 to under 60, 60 to under 120, 120 or more; dashed means future">
      {['0', '<30', '30–59', '60–119', '120+'].map((label, level) => <span key={label}>
        <span className={`heat-cell heat-${level}`} aria-hidden="true" /> {label} min
      </span>)}
      <span><span className="heat-cell heat-future" aria-hidden="true" /> Future</span>
    </p>
  </Card>;
}
