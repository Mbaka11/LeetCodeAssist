# Roadmap enrichment metadata

## Scope and provenance

This is a static, original editorial layer over the existing NeetCode 150. It does not change the 150-problem catalog, Blind 75 membership, the fixed 50-problem program/order, storage version, user history, budgets, review scheduling, timers or optional practice. No network request is needed at runtime. Recommendations never add problems to a queue.

- **Tags:** individually authored from the problem topics and commonly known algorithmic approaches, not copied from LeetCode tags, solutions or editorials. Data structures and techniques are separate normalized English vocabularies. Tags may describe useful alternative approaches; they are neither a required implementation nor an exhaustive inventory. Scalar-only problems may have no data-structure tag. Prefix Sum, Prefix Product and Prefix Maximum are distinct to avoid mislabeling multiplication or maxima as sums.
- **Similar questions:** manually authored, directional recommendations restricted to these same 150 slugs. These are **not official LeetCode similar questions**. Each link includes an original short rationale and one of `same-pattern`, `prerequisite`, `next-challenge`, `useful-contrast`. A prerequisite is a suggested preparation exercise, not a hard dependency or program-order change. Reverse links are not implied. Fewer links are kept where the catalog has no close equivalent; generic pairings are not added to meet a quota.
- **Companies:** public candidate-report evidence only, not official company tags, frequency rankings or hiring predictions. Plain-text company names are used. No logo assets were imported and no logo asset permission has been established. No premium-derived company datasets, editorials, solutions or report bodies were imported.

### Coverage (snapshot: 2026-10-20)

- Tags: **150/150**, each with at least one technique.
- Recommendations: **150/150**, **437 directed links**; 141 problems have three, five have two and four have one. The one-link cases are Encode and Decode Strings, Merge Triplets to Form Target Triplet, Pow(x, n), and Detect Squares. Their closest contrasts are deliberately not padded with weak extra matches.
- Company definitions: all **12** targets (Google, Amazon, Microsoft, Meta, Apple, Shopify, Stripe, Uber, Bloomberg, Datadog, Snowflake, NVIDIA).
- Company evidence: **one qualified related-variant row** for Amazon / `lru-cache`; **zero verified exact canonical problem/company pairs**. All other pairs are **unknown**, not negative evidence.

## Company evidence and limitations

The public-source research handoff (`research/company-evidence.md` in the managed run artifacts) inspected original reports without accounts or credentials. Eight original report fetches were attempted, two were readable, and six returned HTTP 403. Rejected search leads were not promoted to evidence. Its automated semantic source check was unavailable/unclear; manual inspection supported only the narrowly qualified row below. This metadata implementation did not independently re-fetch the source.

| Field | Value |
| --- | --- |
| Company / roadmap topic | Amazon / `lru-cache` |
| Association | `related-variant`, **not** an exact canonical question |
| Safe display label | **Reported at Amazon — LRU Cache variation** |
| Source | [Amazon India \| SDE-1 \| University Grad](https://leetcode.com/discuss/post/6304191/Amazon-India-or-SDE-1-or-University-Grad/) |
| Evidence kind | Public candidate self-report, uncorroborated |
| Factual paraphrase | A candidate report describes an LRU Cache variation in an Amazon interview. Mapping that variation to this roadmap topic is editorial interpretation. |
| Interview date | December 13; **year unknown** |
| Publication date | **Unknown** (`reportedDate` absent) |
| Snapshot date | `2026-10-20`, the runtime date when the research snapshot was integrated; **not** an interview date or new source-verification date |

The source's graduation/batch references do not establish an interview year. Do not infer a report date, location-wide claim, frequency, employer endorsement or current hiring guarantee. Public visibility does not establish an open-content license; the implementation stores a factual paraphrase, source title and attribution URL, not the report's prose. Availability may change.

A fetched Meta report listed interview alternatives rather than identifying the actual question; neither that ambiguous list nor its general kth-largest preparation advice was ingested. Blocked reports and premium-derived exports were excluded. This explains sparse coverage, not whether those companies ask these problems.

**UI requirement:** render the evidence label, qualification, source link and self-report disclaimer together. Never shorten the row to “Amazon asked LRU Cache” or show it as an exact company-question badge. If the consuming UI cannot preserve the variation qualification, omit the association. Missing dates must remain unknown. Missing pair evidence must display unknown/no verified evidence, never “not asked.”

## API handoff

Import the public facade from `src/core/problemMetadata.ts`:

```ts
import {
  getProblemMetadata,
  getCompanyEvidence,
  COMPANIES,
  COMPANY_EVIDENCE_DISCLAIMER,
  DATA_STRUCTURE_TAGS,
  TECHNIQUE_TAGS,
  SIMILAR_RELATIONS,
} from '../core/problemMetadata';

const metadata = getProblemMetadata('two-sum');
// {
//   slug: 'two-sum', dataStructures: ['Array', 'Hash Table'],
//   techniques: ['Hashing'], similarProblems: [{ slug, relation, rationale }, ...],
//   companyEvidence: { status: 'unknown', evidence: [] }
// }
const amazon = getCompanyEvidence('lru-cache', 'amazon');
if (amazon.status === 'reported') {
  // Display each row's qualified label, qualification and source URL, plus disclaimer.
  const rows = amazon.evidence;
}
const google = getCompanyEvidence('lru-cache', 'google'); // status: 'unknown'
const missing = getProblemMetadata('not-in-the-catalog'); // undefined
```

Exports:

| Export | Purpose |
| --- | --- |
| `getProblemMetadata(slug: string): ProblemMetadata \| undefined` | Read-only static tags, recommendations and explicitly reported/unknown company evidence. Unknown slug returns `undefined`, including object prototype names. |
| `getCompanyEvidence(slug: string, companyId?: CompanyId): CompanyEvidenceCoverage` | Optional company filter; no matching research always returns `{ status: 'unknown', evidence: [] }`. Omit company ID to return all known rows for that topic. |
| `COMPANIES` | Read-only `{ id, name }` text definitions; definitions alone assert no problem association. |
| `COMPANY_EVIDENCE`, `COMPANY_EVIDENCE_DISCLAIMER` | Qualified, source-backed rows and the accompanying self-report/unknown-coverage disclaimer. |
| `DATA_STRUCTURE_TAGS`, `TECHNIQUE_TAGS` | Normalized read-only English tag lists for labels/filter choices. |
| `SIMILAR_RELATIONS` | The four supported directional relation labels. |
| Types | `ProblemMetadata`, `ProblemTags`, `MetadataProblemSlug`, `DataStructureTag`, `TechniqueTag`, `SimilarProblem`, `SimilarRelation`, `CompanyDefinition`, `CompanyId`, `CompanyEvidence`, `CompanyEvidenceCoverage`, `MetadataDate`. |

`ProblemMetadata` has `slug`, `dataStructures`, `techniques`, `similarProblems`, and `companyEvidence`. A recommendation has `slug`, `relation`, and `rationale`. Evidence has `companyId`, `slug`, `association`, `label`, `qualification`, and `source` (`kind`, HTTPS `url`, `title`, `snapshotDate`, optional `reportedDate`, optional partial `interviewDate`). Unknown years/dates are omitted, not filled with guessed defaults. Types are read-only; consumers must not mutate registry values.

Data definitions live in `src/data/problemMetadata.ts`, `src/data/similarProblems.ts`, and `src/data/companies.ts`; the facade only joins them by slug. Metadata is not persisted and has no dependency on state/history. Recommendation targets remain the full 150 even when the UI is filtered to Blind 75; consuming UI can label catalog membership without changing recommendation or program semantics.

## Validation

Focused Vitest tests check exact 150 coverage/order against the unchanged catalog, 75 subset and fixed 50 program size, valid unique tags, per-link known/non-self/unique targets, relation vocabulary and nonempty rationales, all 12 text companies, source-backed evidence with HTTPS links and valid known dates, explicit variant qualification and unknown year/publication date, unknown-coverage selectors, and preservation of base problem records/catalog/program order during lookups. TypeScript validates cross-registry slug references. These structural tests do not independently certify editorial recommendation quality or verify a candidate's interview account.
