import { useMemo } from 'react';
import { Card } from '../components/Card';
import { PACE_FEW_SAMPLES, PACE_MAX_MONTHS, paceData, type PacePanel, type PaceRow, type PaceSample } from '../core/pace';
import type { AppState } from '../core/types';

const W = 320, H = 176, LEFT = 34, RIGHT = 10, TOP = 12, BOTTOM = 30;
const SERIES = [
  { key: 'first', label: 'First attempts', className: 'pace-first' },
  { key: 'review', label: 'Reviews', className: 'pace-review' },
  { key: 'simulation', label: 'Simulations', className: 'pace-sim' },
] as const;
type SeriesKey = (typeof SERIES)[number]['key'];

const minutes = (value: number): string => `${Math.round(value * 10) / 10} min`;
const sampleText = (s: PaceSample | undefined): string => (s ? `${minutes(s.median)} (n=${s.count})` : '—');
const samples = (n: number): string => `${n} ${n === 1 ? 'sample' : 'samples'}`;

function Marker({ series, x, y, few }: { series: SeriesKey; x: number; y: number; few: boolean }) {
  const className = `${SERIES.find((s) => s.key === series)!.className}${few ? ' pace-few' : ''}`;
  if (series === 'first') return <circle className={className} cx={x} cy={y} r={3.6} />;
  if (series === 'review') return <rect className={className} x={x - 3.4} y={y - 3.4} width={6.8} height={6.8} />;
  return <polygon className={className} points={`${x},${y - 4.4} ${x + 4.4},${y} ${x},${y + 4.4} ${x - 4.4},${y}`} />;
}

function PanelChart({ panel, months }: { panel: PacePanel; months: string[] }) {
  const medians = panel.rows.flatMap((r) => SERIES.map((s) => r[s.key]?.median ?? 0));
  const top = Math.max(panel.guidelineMinutes, ...medians);
  const yMax = Math.ceil((top * 1.1) / 10) * 10;
  const x = (i: number): number => (months.length === 1 ? LEFT + (W - LEFT - RIGHT) / 2 : LEFT + (i * (W - LEFT - RIGHT)) / (months.length - 1));
  const y = (value: number): number => TOP + (H - TOP - BOTTOM) * (1 - value / yMax);
  const labelEvery = Math.ceil(months.length / 6);
  const withData = panel.rows.filter((r) => SERIES.some((s) => r[s.key]));
  const summary = withData.length === 0 ? 'no samples' : `${withData.length} ${withData.length === 1 ? 'month' : 'months'} with samples`;
  return <figure className="pace-figure">
    <figcaption><strong>{panel.difficulty}</strong></figcaption>
    <svg className="pace-svg" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`${panel.difficulty}: median logged minutes per month, ${summary}. Editorial guideline ${panel.guidelineMinutes} minutes, not data. A data table follows.`}>
      {[0, yMax / 2, yMax].map((tick) => <g key={tick}>
        <line className="pace-grid" x1={LEFT} x2={W - RIGHT} y1={y(tick)} y2={y(tick)} />
        <text className="pace-text" x={LEFT - 4} y={y(tick) + 3} textAnchor="end">{tick}</text>
      </g>)}
      <line className="pace-guide" x1={LEFT} x2={W - RIGHT} y1={y(panel.guidelineMinutes)} y2={y(panel.guidelineMinutes)} />
      <text className="pace-text" x={W - RIGHT} y={y(panel.guidelineMinutes) - 3} textAnchor="end">Guideline {panel.guidelineMinutes} min (editorial, not data)</text>
      {months.map((month, i) => i % labelEvery === 0 ? <text className="pace-text" key={month} x={x(i)} y={H - 14} textAnchor="middle">{month.slice(2)}</text> : null)}
      <text className="pace-text" x={LEFT} y={H - 2}>min</text>
      {SERIES.map((s) => {
        // Lines join only neighbouring months that both have samples; nothing is extended beyond the data.
        const segments: string[] = [];
        panel.rows.forEach((row: PaceRow, i) => {
          const sample = row[s.key];
          const previous = i > 0 ? panel.rows[i - 1]![s.key] : undefined;
          if (sample && previous) segments.push(`M${x(i - 1)} ${y(previous.median)}L${x(i)} ${y(sample.median)}`);
        });
        return <g key={s.key} className={s.className}>
          {segments.length ? <path className="pace-line" d={segments.join('')} fill="none" /> : null}
          {panel.rows.map((row, i) => {
            const sample = row[s.key];
            return sample ? <g key={row.month}><title>{`${panel.difficulty}, ${s.label}, ${row.month}: median ${minutes(sample.median)} from ${samples(sample.count)}`}</title>
              <Marker series={s.key} x={x(i)} y={y(sample.median)} few={sample.count < PACE_FEW_SAMPLES} /></g> : null;
          })}
        </g>;
      })}
    </svg>
    <details>
      <summary>{panel.difficulty} data table</summary>
      {withData.length === 0 ? <p className="muted">No {panel.difficulty} samples in these months.</p> : <div className="table-scroll"><table className="table">
        <caption>{panel.difficulty}: median logged minutes per month (n = samples). Guideline {panel.guidelineMinutes} min is editorial, not data.</caption>
        <thead><tr><th scope="col">Month</th>{SERIES.map((s) => <th scope="col" key={s.key}>{s.label}</th>)}</tr></thead>
        <tbody>{withData.map((row) => <tr key={row.month}><th scope="row">{row.month}</th>{SERIES.map((s) => <td key={s.key}>{sampleText(row[s.key])}</td>)}</tr>)}</tbody>
      </table></div>}
    </details>
  </figure>;
}

/** Monthly median logged minutes per difficulty. Informational only; independent of the Logs filters. */
export function PaceChart({ state }: { state: AppState }) {
  const data = useMemo(() => paceData(state), [state]);
  return <Card title="Pace by month">
    <p className="muted">Median logged minutes of completed activities with logged time, by completion month and problem difficulty. Reviews include optional
      extra repeats; benchmarks are excluded. Independent of the filters above and never used for scheduling or budgets.</p>
    {!data.hasData ? <p role="status">No completed activities with logged time yet. The chart appears after you log time on a catalog problem.</p> : <>
      <p>Showing at most the last {PACE_MAX_MONTHS} months ({data.months[0]} to {data.months.at(-1)}). First attempts: {samples(data.counts.first)}; reviews: {samples(data.counts.review)}{data.counts.simulation > 0 ? `; simulations: ${samples(data.counts.simulation)}` : ''}.</p>
      <ul className="pace-legend row" aria-label="Chart legend">
        <li><svg width="16" height="12" aria-hidden="true"><circle className="pace-first" cx="8" cy="6" r="3.6" /></svg> First attempts</li>
        <li><svg width="16" height="12" aria-hidden="true"><rect className="pace-review" x="4.6" y="2.6" width="6.8" height="6.8" /></svg> Reviews</li>
        {data.counts.simulation > 0 ? <li><svg width="16" height="12" aria-hidden="true"><polygon className="pace-sim" points="8,1.6 12.4,6 8,10.4 3.6,6" /></svg> Simulation durations (Practice, separate from logged time)</li> : null}
        <li><svg width="22" height="12" aria-hidden="true"><line className="pace-guide" x1="1" x2="21" y1="6" y2="6" /></svg> Editorial guideline (not data)</li>
        <li><svg width="16" height="12" aria-hidden="true"><circle className="pace-first pace-few" cx="8" cy="6" r="3.6" /></svg> Hollow marker: fewer than {PACE_FEW_SAMPLES} samples</li>
      </ul>
      <p className="muted">Guideline lines (Easy 15, Medium 30, Hard 45 minutes) are an editorial reference for interview-style pacing, not measured data and not a target
        the program enforces. Lines connect only consecutive months that both have samples; there is no trend or forecast. Medians of one or two samples are weak signals.</p>
      <div className="pace-panels">{data.panels.map((panel) => <PanelChart key={panel.difficulty} panel={panel} months={data.months} />)}</div>
    </>}
  </Card>;
}
