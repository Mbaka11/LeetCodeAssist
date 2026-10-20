import { useId, useState } from 'react';
import { Button } from '../components/Button';
import { catalogProblems, type CatalogId } from '../core/catalog';
import { COMPANIES, COMPANY_EVIDENCE, DATA_STRUCTURE_TAGS, TECHNIQUE_TAGS, getProblemMetadata } from '../core/problemMetadata';
import { getProblemStatus } from '../core/state';
import type { AppState, Settings } from '../core/types';
import { isBonusProblem } from '../data/bonus';
import { CATEGORY_NAMES } from '../data/neetcode150';
import { isPremiumProblem } from '../data/premium';
import { BENCHMARKS, PROGRAM_QUEUE } from '../data/program';
import type { AppActions } from '../lib/actions';
import { STATUS_LABELS } from '../lib/instructions';
import { RoadmapProblemList } from './RoadmapProblemList';

const PROGRAM_SLUGS: ReadonlySet<string> = new Set([...PROGRAM_QUEUE, ...BENCHMARKS.flatMap((b) => [b.easy, b.medium])]);
const SOURCED_COMPANIES = COMPANIES.filter((company) => COMPANY_EVIDENCE.some((row) => row.companyId === company.id));
const EMPTY_FILTERS = { search: '', category: '', difficulty: '', status: '', access: '', scope: '', technique: '', structure: '', company: '' };

/** Local filters change presentation only; catalog totals and persisted progress live in RoadmapView. */
export function RoadmapAllView({ state, actions, catalog, change }: {
  state: AppState;
  actions: AppActions;
  catalog: CatalogId;
  change: (patch: Partial<Settings>) => void;
}) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const id = useId();
  const problems = catalogProblems(catalog);
  const detailed = state.settings.roadmapDetail === 'detailed';
  const hideTechniques = state.settings.roadmapHideTechniques === true;
  const categories = CATEGORY_NAMES.filter((category) => problems.some((p) => p.category === category));
  const filtered = problems.filter((problem) => {
    const metadata = getProblemMetadata(problem.slug);
    return problem.title.toLowerCase().includes(filters.search.trim().toLowerCase()) &&
      (!filters.category || problem.category === filters.category) &&
      (!filters.difficulty || problem.difficulty === filters.difficulty) &&
      (!filters.status || getProblemStatus(state, problem.slug) === filters.status) &&
      (!filters.access || isPremiumProblem(problem.slug) === (filters.access === 'premium')) &&
      (!filters.scope || (filters.scope === 'program' ? PROGRAM_SLUGS.has(problem.slug) :
        filters.scope === 'bonus' ? isBonusProblem(problem.slug) : !PROGRAM_SLUGS.has(problem.slug) && !isBonusProblem(problem.slug))) &&
      (hideTechniques || !filters.technique || metadata?.techniques.some((tag) => tag === filters.technique)) &&
      (hideTechniques || !filters.structure || metadata?.dataStructures.some((tag) => tag === filters.structure)) &&
      (!filters.company || metadata?.companyEvidence.evidence.some((row) => row.companyId === filters.company));
  });
  const select = (key: Exclude<keyof typeof EMPTY_FILTERS, 'search'>, label: string, options: readonly { value: string; label: string }[], disabled = false) => (
    <label htmlFor={`${id}-${key}`}>
      {label}
      <select id={`${id}-${key}`} value={filters[key]} disabled={disabled}
        onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value }))}>
        <option value="">Any</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
  const options = (values: readonly string[]) => values.map((value) => ({ value, label: value }));
  return (
    <section className="stack" aria-label="All catalog problems">
      <div className="card stack-tight">
        <div className="row">
          <div className="view-toggle" role="group" aria-label="All row detail">
            {(['compact', 'detailed'] as const).map((mode) => <Button key={mode}
              variant={detailed === (mode === 'detailed') ? 'primary' : 'secondary'}
              aria-pressed={detailed === (mode === 'detailed')}
              onClick={() => change({ roadmapDetail: mode })}>{mode === 'compact' ? 'Compact' : 'Detailed'}</Button>)}
          </div>
          <label className="choice"><input type="checkbox" checked={hideTechniques} onChange={(event) => {
            setFilters((current) => ({ ...current, technique: '', structure: '' }));
            change({ roadmapHideTechniques: event.target.checked });
          }} />Hide techniques / solution hints</label>
        </div>
        <p className="muted">Hide hints removes data-structure and technique tags and clears/disables their filters. Company filters include only documented reports (including qualified variants), not a complete interview history.</p>
        <div className="roadmap-filters" role="group" aria-label="Filter problems">
          <label htmlFor={`${id}-search`}>Search titles<input id={`${id}-search`} type="search" value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} /></label>
          {select('category', 'Category', options(categories))}
          {select('difficulty', 'Difficulty', options(['Easy', 'Medium', 'Hard']))}
          {select('status', 'Learning status', Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })))}
          {select('access', 'Access', [{ value: 'free', label: 'Free' }, { value: 'premium', label: 'Premium' }])}
          {select('scope', 'Program membership', [{ value: 'program', label: '30-day program or benchmark' }, { value: 'bonus', label: 'Bonus' }, { value: 'outside', label: 'Outside program and bonus pool' }])}
          {select('technique', 'Technique', hideTechniques ? [] : options(TECHNIQUE_TAGS), hideTechniques)}
          {select('structure', 'Data structure', hideTechniques ? [] : options(DATA_STRUCTURE_TAGS), hideTechniques)}
          {select('company', 'Company evidence', SOURCED_COMPANIES.map((company) => ({ value: company.id, label: company.name })))}
        </div>
        <div className="row">
          <Button onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</Button>
          <span role="status">Showing {filtered.length} of {problems.length}</span>
        </div>
        <p className="muted">Filters never change catalog counters, progress or scheduled work. Checkmarks are shared with Tree and Grid.</p>
      </div>
      {filtered.length === 0 ? <p className="muted">No problems match these filters. Clear filters to show the catalog.</p> : null}
      {categories.map((category) => {
        const rows = filtered.filter((problem) => problem.category === category);
        if (rows.length === 0) return null;
        return <section key={category} className="card category">
          <details open>
            <summary><h2 className="inline-heading">{category}</h2> <span className="muted">({rows.length})</span></summary>
            <RoadmapProblemList problems={rows} state={state} actions={actions} detailed={detailed} hideTechniques={hideTechniques} />
          </details>
        </section>;
      })}
    </section>
  );
}
