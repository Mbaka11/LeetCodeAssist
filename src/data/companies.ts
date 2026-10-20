import type { MetadataProblemSlug } from './problemMetadata';

/** Plain-text names only: no logo asset permissions have been established. */
export const COMPANIES = [
  { id: 'google', name: 'Google' },
  { id: 'amazon', name: 'Amazon' },
  { id: 'microsoft', name: 'Microsoft' },
  { id: 'meta', name: 'Meta' },
  { id: 'apple', name: 'Apple' },
  { id: 'shopify', name: 'Shopify' },
  { id: 'stripe', name: 'Stripe' },
  { id: 'uber', name: 'Uber' },
  { id: 'bloomberg', name: 'Bloomberg' },
  { id: 'datadog', name: 'Datadog' },
  { id: 'snowflake', name: 'Snowflake' },
  { id: 'nvidia', name: 'NVIDIA' },
] as const;

export type CompanyDefinition = (typeof COMPANIES)[number];
export type CompanyId = CompanyDefinition['id'];
export type MetadataDate = `${number}-${number}-${number}`;

export interface CompanyEvidence {
  readonly companyId: CompanyId;
  readonly slug: MetadataProblemSlug;
  readonly association: 'related-variant';
  /** Display this qualified label, not an unqualified "asked" badge. */
  readonly label: string;
  readonly qualification: string;
  readonly source: {
    readonly kind: 'self-reported-interview';
    readonly url: `https://${string}`;
    readonly title: string;
    /** Date this research snapshot was integrated; not a fresh source fetch or interview date. */
    readonly snapshotDate: MetadataDate;
    /** Publication date, only when known. Absent means unknown. */
    readonly reportedDate?: MetadataDate;
    /** A source may give month/day without a year; never infer that year. */
    readonly interviewDate?: { readonly month: number; readonly day: number; readonly year?: number };
  };
}

export const COMPANY_EVIDENCE_DISCLAIMER =
  'Reported at a company in a public candidate self-report, not independently confirmed or employer-endorsed. A related variant is not a verified canonical LeetCode question. Missing evidence means unknown, not never asked.';

/** Factual paraphrase of the sole qualified association approved by the public-source research. */
export const COMPANY_EVIDENCE: readonly CompanyEvidence[] = [
  {
    companyId: 'amazon',
    slug: 'lru-cache',
    association: 'related-variant',
    label: 'Reported at Amazon — LRU Cache variation',
    qualification: 'A candidate report describes an LRU Cache variation. The mapping to this roadmap topic is editorial; the exact canonical question is not verified.',
    source: {
      kind: 'self-reported-interview',
      url: 'https://leetcode.com/discuss/post/6304191/Amazon-India-or-SDE-1-or-University-Grad/',
      title: 'Amazon India | SDE-1 | University Grad',
      snapshotDate: '2026-10-20',
      interviewDate: { month: 12, day: 13 },
    },
  },
];

export type CompanyEvidenceCoverage =
  | { readonly status: 'unknown'; readonly evidence: readonly [] }
  | { readonly status: 'reported'; readonly evidence: readonly CompanyEvidence[] };

/** Optional company filter; an empty research result is explicitly unknown, never a negative claim. */
export function getCompanyEvidence(slug: string, companyId?: CompanyId): CompanyEvidenceCoverage {
  const evidence = COMPANY_EVIDENCE.filter(
    (row) => row.slug === slug && (companyId === undefined || row.companyId === companyId),
  );
  return evidence.length === 0 ? { status: 'unknown', evidence: [] } : { status: 'reported', evidence };
}
