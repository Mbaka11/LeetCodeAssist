import { useId, useState } from 'react';
import { Button } from '../components/Button';
import { CompanyLogo } from '../components/CompanyLogo';
import { ConfirmButton } from '../components/ConfirmButton';
import { catalogProblems, type CatalogId } from '../core/catalog';
import { COMPANIES, COMPANY_EVIDENCE, DATA_STRUCTURE_TAGS, TECHNIQUE_TAGS, getProblemMetadata } from '../core/problemMetadata';
import { getProblemStatus } from '../core/state';
import type { AppState, Settings, RoadmapFilters } from '../core/types';
import { isBonusProblem } from '../data/bonus';
import { CATEGORY_NAMES } from '../data/neetcode150';
import { isPremiumProblem } from '../data/premium';
import { BENCHMARKS, PROGRAM_QUEUE } from '../data/program';
import type { AppActions } from '../lib/actions';
import { STATUS_LABELS } from '../lib/instructions';
import { RoadmapProblemList } from './RoadmapProblemList';

const PROGRAM_SLUGS: ReadonlySet<string> = new Set([...PROGRAM_QUEUE, ...BENCHMARKS.flatMap((b) => [b.easy, b.medium])]);
const SOURCED_COMPANIES = COMPANIES.filter((company) => COMPANY_EVIDENCE.some((row) => row.companyId === company.id));
const EMPTY_FILTERS: RoadmapFilters = { search: '', category: '', difficulty: '', status: '', access: '', scope: '', technique: '', structure: '', company: '', favoritesOnly: false };

/** Local filters change presentation only; catalog totals and persisted progress live in RoadmapView. */
export function RoadmapAllView({ state, actions, catalog, change }: {
  state: AppState;
  actions: AppActions;
  catalog: CatalogId;
  change: (patch: Partial<Settings>) => void;
}) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterName, setFilterName] = useState('');
  const [savedId, setSavedId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const run = (task: Promise<void>): void => {
    setError(null);
    task.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };
  const id = useId();
  const problems = catalogProblems(catalog);
  const detailed = state.settings.roadmapDetail === 'detailed';
  const hideTechniques = state.settings.roadmapHideTechniques === true;
  const groupBy = state.settings.roadmapGroup === 'company' ? 'company' : 'category';
  const categories = CATEGORY_NAMES.filter((category) => problems.some((p) => p.category === category));
  const filtered = problems.filter((problem) => {
    const metadata = getProblemMetadata(problem.slug);
    return (!filters.favoritesOnly || state.favorites?.[problem.slug] === true) &&
      problem.title.toLowerCase().includes(filters.search.trim().toLowerCase()) &&
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
  const groups: { key: string; title: string; companyId?: string; rows: typeof filtered }[] = groupBy === 'category'
    ? categories.map((category) => ({ key: category, title: category, rows: filtered.filter((p) => p.category === category) }))
    : [...SOURCED_COMPANIES.map((company) => ({ key: company.id, title: company.name, companyId: company.id,
        rows: filtered.filter((p) => getProblemMetadata(p.slug)?.companyEvidence.evidence.some((row) => row.companyId === company.id)) })),
      { key: 'undocumented', title: 'No documented company evidence',
        rows: filtered.filter((p) => (getProblemMetadata(p.slug)?.companyEvidence.evidence.length ?? 0) === 0) }]
      .sort((a, b) => (a.key === 'undocumented' ? 1 : b.key === 'undocumented' ? -1 : b.rows.length - a.rows.length));
  const visibleGroups = groups.filter((group) => group.rows.length > 0);
  const select = (key: Exclude<keyof RoadmapFilters, 'search' | 'favoritesOnly'>, label: string, options: readonly { value: string; label: string }[], disabled = false) => (
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
          <div className="view-toggle" role="group" aria-label="Group problems by">
            {(['category', 'company'] as const).map((mode) => <Button key={mode}
              variant={groupBy === mode ? 'primary' : 'secondary'}
              aria-pressed={groupBy === mode}
              onClick={() => change({ roadmapGroup: mode })}>{mode === 'category' ? 'Group by category' : 'Group by company'}</Button>)}
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
        <label className="choice"><input type="checkbox" checked={filters.favoritesOnly}
          onChange={(event) => setFilters((current) => ({ ...current, favoritesOnly: event.target.checked }))} />Favorites only</label>
        <div className="row" role="group" aria-label="Saved filters">
          <label>Saved filter<select value={savedId} onChange={(event) => {
            const key = event.target.value;
            setSavedId(key);
            setFilterName(state.savedRoadmapFilters?.[key]?.name ?? '');
          }}><option value="">Choose a saved filter</option>
            {Object.entries(state.savedRoadmapFilters ?? {}).map(([key, entry]) => <option key={key} value={key}>{entry.name}</option>)}
          </select></label>
          <Button disabled={!state.savedRoadmapFilters?.[savedId]} onClick={() => {
            const saved = state.savedRoadmapFilters?.[savedId];
            if (!saved) return;
            const known = (value: string, values: readonly string[]) => values.includes(value) ? value : '';
            setFilters({ ...saved.filters,
              category: known(saved.filters.category, categories),
              technique: hideTechniques ? '' : known(saved.filters.technique, TECHNIQUE_TAGS),
              structure: hideTechniques ? '' : known(saved.filters.structure, DATA_STRUCTURE_TAGS),
              company: known(saved.filters.company, SOURCED_COMPANIES.map((company) => company.id)),
            });
          }}>Apply filter</Button>
          <label>Filter name<input value={filterName} maxLength={80} onChange={(event) => setFilterName(event.target.value)} /></label>
          <Button disabled={!filterName.trim()} onClick={() => run(actions.saveRoadmapFilter(crypto.randomUUID(), {
            name: filterName.trim(), filters: { ...filters, ...(hideTechniques ? { technique: '', structure: '' } : {}) },
          }))}>Save current filters</Button>
          <Button disabled={!state.savedRoadmapFilters?.[savedId] || !filterName.trim()} onClick={() => {
            const saved = state.savedRoadmapFilters?.[savedId];
            if (saved) run(actions.saveRoadmapFilter(savedId, { ...saved, name: filterName.trim() }));
          }}>Rename filter</Button>
          {state.savedRoadmapFilters?.[savedId]
            ? <ConfirmButton prompt={`Delete the saved filter "${state.savedRoadmapFilters[savedId]!.name}"?`} confirmLabel="Delete filter" onConfirm={() => {
              run(actions.deleteRoadmapFilter(savedId)); setSavedId(''); setFilterName('');
            }}>Delete filter</ConfirmButton>
            : <Button disabled>Delete filter</Button>}
        </div>
        <p className="muted">Saved filters apply to the current catalog. Unavailable tags/categories are cleared when applied; hidden technique filters are never applied.</p>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <div className="row">
          <Button onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</Button>
          <span role="status">Showing {filtered.length} of {problems.length}</span>
        </div>
        <p className="muted">Filters never change catalog counters, progress or scheduled work. Checkmarks are shared with Tree and Grid.</p>
      </div>
      {filtered.length === 0 ? <p className="muted">No problems match these filters. Clear filters to show the catalog.</p> : null}
      {groupBy === 'company' ? <p className="muted">Grouped by companies with documented public reports. A problem appears under every company that has evidence for it, so group counts can add up to more than {filtered.length}. Not documented means unknown, never "not asked".</p> : null}
      {visibleGroups.map(({ key, title, companyId, rows }) => {
        return <section key={key} className="card category">
          <details open>
            <summary><h2 className="inline-heading">{companyId ? <CompanyLogo companyId={companyId} name={title} size={22} /> : null}{companyId ? ' ' : ''}{title}</h2> <span className="muted">({rows.length})</span></summary>
            <RoadmapProblemList problems={rows} state={state} actions={actions} detailed={detailed} hideTechniques={hideTechniques} />
          </details>
        </section>;
      })}
    </section>
  );
}
