import { useState } from 'react';
import { COMPANY_EVIDENCE_DISCLAIMER, getProblemMetadata, type CompanyEvidence } from '../core/problemMetadata';
import { getProblemStatus } from '../core/state';
import type { AppState } from '../core/types';
import { getProblem } from '../data/neetcode150';
import { STATUS_LABELS, STATUS_TONES, difficultyTone } from '../lib/instructions';
import { problemHref } from '../lib/route';
import { Badge } from './Badge';
import { LeetCodeLink } from './LeetCodeLink';

export function ProblemTags({ slug }: { slug: string }) {
  const metadata = getProblemMetadata(slug);
  return metadata ? (
    <span className="metadata-tags" aria-label="Data structures and techniques">
      {metadata.dataStructures.map((tag) => <Badge key={`structure-${tag}`}>{tag}</Badge>)}
      {metadata.techniques.map((tag) => <Badge key={`technique-${tag}`}>{tag}</Badge>)}
    </span>
  ) : null;
}

export function CompanyBadges({ slug }: { slug: string }) {
  const evidence = getProblemMetadata(slug)?.companyEvidence.evidence ?? [];
  return evidence.length ? (
    <div className="metadata-tags">
      {evidence.slice(0, 2).map((row) => (
        <details key={`${row.companyId}:${row.source.url}`} className="company-evidence-disclosure">
          <summary><Badge>{row.label}</Badge> <span>Source and caveats</span></summary>
          <div className="problem-metadata">
            <CompanyEvidenceDetails row={row} />
            <p className="muted">{COMPANY_EVIDENCE_DISCLAIMER}</p>
          </div>
        </details>
      ))}
      {evidence.length > 2 ? <a href={problemHref(slug)}>+{evidence.length - 2} company reports</a> : null}
    </div>
  ) : <span className="muted">Company evidence: not documented</span>;
}

function CompanyEvidenceDetails({ row }: { row: CompanyEvidence }) {
  return <>
    <p>{row.qualification}</p>
    <a href={row.source.url} target="_blank" rel="noopener noreferrer">{row.source.title} ↗</a>
    <p className="muted">
      Research integration snapshot: {row.source.snapshotDate} (not a fresh source check).
      {' '}Publication date: {row.source.reportedDate ?? 'unknown'}.
      {' '}Interview date: {row.source.interviewPeriod ?? (row.source.interviewDate
        ? `${row.source.interviewDate.month}/${row.source.interviewDate.day}, ${row.source.interviewDate.year ?? 'year unknown'}`
        : 'unknown')}.
      {row.source.reportedDateBasis ? ` Publication-date source: ${row.source.reportedDateBasis}.` : ''}
      {row.source.caveat ? ` ${row.source.caveat}` : ''}
    </p>
  </>;
}

/** Original editorial metadata, never an instruction to schedule or start practice. */
function MetadataContent({ slug, state, openProblemSheet }: {
  slug: string;
  state: AppState;
  openProblemSheet?: (slug: string) => void;
}) {
  const metadata = getProblemMetadata(slug);
  if (!metadata) return null;
  return (
    <div className="stack-tight problem-metadata">
      <h3>Data structures and techniques</h3>
      <ProblemTags slug={slug} />
      <p className="muted">Original editorial labels: useful approaches, not official tags or prescribed solutions.</p>
      <h3>Company evidence</h3>
      {metadata.companyEvidence.evidence.length === 0 ? <p className="muted">Not documented for this problem. Missing evidence does not mean it was never asked.</p> : (
        <ul className="metadata-evidence">
          {metadata.companyEvidence.evidence.map((row) => (
            <li key={`${row.companyId}:${row.source.url}`}>
              <strong>{row.label}</strong>
              <CompanyEvidenceDetails row={row} />
            </li>
          ))}
        </ul>
      )}
      <p className="muted">{COMPANY_EVIDENCE_DISCLAIMER}</p>
      <h3>Similar questions</h3>
      <p className="muted">Original editorial suggestions, not official LeetCode recommendations. These links never add scheduled work; some targets may be outside your selected catalog.</p>
      <ul className="metadata-similar">
        {metadata.similarProblems.map((similar) => {
          const target = getProblem(similar.slug);
          if (!target) return null;
          const status = getProblemStatus(state, similar.slug);
          return (
            <li key={similar.slug}>
              <div className="row">
                <a href={problemHref(similar.slug)} onClick={openProblemSheet ? (event) => { event.preventDefault(); openProblemSheet(similar.slug); } : undefined}>{target.title}</a>
                <Badge tone={difficultyTone(target.difficulty)}>{target.difficulty}</Badge>
                <Badge tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Badge>
                {state.checked[similar.slug] ? <Badge>Checked solved</Badge> : null}
                <LeetCodeLink href={target.url} />
              </div>
              <p><span className="muted">{similar.relation.replaceAll('-', ' ')}: </span>{similar.rationale}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Callers key by slug and review lock so a new problem/review never inherits an open disclosure. */
export function ProblemMetadataSection({ slug, state, collapsed = false, protectedReview = false, openProblemSheet }: {
  slug: string;
  state: AppState;
  collapsed?: boolean;
  protectedReview?: boolean;
  openProblemSheet?: (slug: string) => void;
}) {
  const [open, setOpen] = useState(!collapsed && !protectedReview && !state.settings.roadmapHideTechniques);
  return (
    <section className="card" aria-label="Problem metadata">
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>Explore metadata and similar questions (contains technique hints)</summary>
        {protectedReview ? <p className="muted">Review in progress or due: try recalling first. Expanding this section reveals technique hints and related-question rationales.</p> : null}
        {open ? <MetadataContent slug={slug} state={state} openProblemSheet={openProblemSheet} /> : null}
      </details>
    </section>
  );
}
