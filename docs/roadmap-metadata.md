# Roadmap enrichment metadata

## Scope and provenance

This is a static, original editorial layer over the existing NeetCode 150. It does not change the 150-problem catalog, Blind 75 membership, the fixed 50-problem program/order, storage version, user history, budgets, review scheduling, timers or optional practice. No network request is needed at runtime. Recommendations never add problems to a queue.

- **Tags:** individually authored from the problem topics and commonly known algorithmic approaches, not copied from LeetCode tags, solutions or editorials. Data structures and techniques are separate normalized English vocabularies. Tags may describe useful alternative approaches; they are neither a required implementation nor an exhaustive inventory. Scalar-only problems may have no data-structure tag. Prefix Sum, Prefix Product and Prefix Maximum are distinct to avoid mislabeling multiplication or maxima as sums.
- **Similar questions:** manually authored, directional recommendations restricted to these same 150 slugs. These are **not official LeetCode similar questions**. Each link includes an original short rationale and one of `same-pattern`, `prerequisite`, `next-challenge`, `useful-contrast`. A prerequisite is a suggested preparation exercise, not a hard dependency or program-order change. Reverse links are not implied. Fewer links are kept where the catalog has no close equivalent; generic pairings are not added to meet a quota.
- **Companies:** public candidate-report evidence only, not official company tags, frequency rankings or hiring predictions. Plain-text company names are used. No logo assets were imported and no logo asset permission has been established. No premium-derived company datasets, editorials, solutions or report bodies were imported.

### Coverage (latest integration snapshot: 2026-10-23)

- Tags: **150/150**, each with at least one technique.
- Recommendations: **150/150**, **437 directed links**; 141 problems have three, five have two and four have one. The one-link cases are Encode and Decode Strings, Merge Triplets to Form Target Triplet, Pow(x, n), and Detect Squares. Their closest contrasts are deliberately not padded with weak extra matches.
- Company definitions: all **12** targets (Google, Amazon, Microsoft, Meta, Apple, Shopify, Stripe, Uber, Bloomberg, Datadog, Snowflake, NVIDIA).
- Company evidence: **66 source-backed rows / 65 distinct company–slug pairs**: 65 newly integrated research rows (46 exact-topic mappings, 19 related variants), plus the retained prior Amazon / `lru-cache` variation. Exact means the candidate narrative names, links or clearly describes the canonical topic without a stated twist; it does **not** mean the employer confirmed it. Unlisted pairs remain **unknown**, not negative evidence.

## Company evidence and limitations

The latest public-source research handoff (`research/companies.md` in managed run artifacts) fetched and
read candidate narratives and checked all slugs against NeetCode 150. This implementation integrates
that snapshot, **without independently re-fetching sources**. No accounts, credentials, browser profile,
live API, company-tag export, premium-derived dataset, prep list or copied report body was used.

The threshold for a company interview is **five distinct documented slugs**, counting both exact-topic
and qualified-variant mappings. Multiple sources for a slug count once. Enabled companies are Google (6,
variant-heavy: only one exact), Amazon (14), Microsoft (6), Meta (9), Apple (8), Uber (5), Bloomberg (8),
and NVIDIA (9, mostly systems/firmware contexts). These are evidence counts; the **mock coding interview**
pool counts only rows that report coding. One Bloomberg row (`lru-cache`, a design discussion with
**no coding reported**) stays as qualified provenance but is excluded from the pool and the threshold, so
Bloomberg offers 7 problems (still above the threshold of five). Shopify, Stripe, Datadog and Snowflake have zero
qualifying rows and display **Not enough documented data**. Their absence is not a claim about interviews.
Roadmap All offers every company with evidence; interview enablement is a separate threshold.

Most new sources are user-submitted interviewexperiences.in narratives. The researcher notes that some
may be mirrored or AI-rewritten from other reports; authorship and employer confirmation are unverified.
Only first-person narrative passages naming/linking/describing the problem were counted, not that site's
generated question lists, summaries or aggregate frequencies. NVIDIA additionally uses first-person
GeeksforGeeks and Taro accounts. Medium confidence means a description/variant mapping or uncertain
mirror authorship, not independent confirmation. Source content is not bundled. No logo permissions
were established; names remain plain text.

LeetCode Discuss fetches returned 403 in the latest research. Blocked/snippet-only, ambiguous,
secondhand, vendor-content and out-of-catalog leads were excluded. No fetch-protocol workaround was
used. The research's optional semantic source checker was not run; the evidence rests on its direct
page-reading handoff. Search-listing-only publication dates were **not** promoted to known dates.
Known dates from site company listings are explicitly marked `reportedDateBasis: 'company-listing'`;
page dates use `'page'`. Partial interview periods retain title-only/year-unspecified caveats. Missing
dates remain unknown; snapshot date is integration time, not a new source fetch or interview date.

### New source-backed associations

All rows below have integration snapshot **2026-10-23**. `exact` is an uncorroborated canonical-topic
mapping; `related-variant` is expressly not a verified canonical specification. Per-row qualifications,
confidence, provenance dates and host caveats are also typed in `src/data/companies.ts` and rendered with
source disclosures/history. No frequency/probability claim is derived from these counts.

| Company | Slug | Association / mapping confidence | Source | Known publication / interview period |
| --- | --- | --- | --- | --- |
| google | `two-sum` | exact / high | [Google  /  L4  /  Software Engineer  /  India  /  Aug 2026  /  Reject](https://interviewexperiences.in/experience/google/google-l4-software-engineer-india-aug-2026-reject) | unknown / August 2026 (title only) |
| google | `number-of-islands` | related-variant / medium | [Google L4 Interview Experience Date October 5th 2026](https://interviewexperiences.in/experience/google/google-l4-interview-experience-date-october-5th-2026) | unknown / October 5, 2026 |
| google | `find-median-from-data-stream` | related-variant / medium | [Google SWE Internship Interview Experience](https://interviewexperiences.in/experience/google/google-swe-internship-interview-experience) | unknown / unknown |
| google | `merge-intervals` | related-variant / medium | [Google - L4 SWE III - phone screen - Zurich](https://interviewexperiences.in/experience/google/google-l4-swe-iii-phone-screen-zurich) | unknown / unknown |
| google | `course-schedule-ii` | related-variant / medium | [Google L3 interview Experience (onsite)](https://interviewexperiences.in/experience/google/google-l3-interview-experience-onsite) | unknown / unknown |
| google | `coin-change` | related-variant / medium | [Google Interview Experience – Google University Graduate 2026](https://interviewexperiences.in/experience/google/google-interview-experience-google-university-graduate-2026) | unknown / unknown |
| amazon | `reverse-nodes-in-k-group` | exact / high | [Amazon SDE II Interview Experience + Need Honest Feedback](https://interviewexperiences.in/experience/amazon/amazon-sde-ii-interview-experience-need-honest-feedback) | unknown / unknown |
| amazon | `number-of-islands` | exact / high | [Amazon SDE II Interview Experience + Need Honest Feedback](https://interviewexperiences.in/experience/amazon/amazon-sde-ii-interview-experience-need-honest-feedback) | unknown / unknown |
| amazon | `longest-substring-without-repeating-characters` | exact / high | [Amazon SDE II Interview Experience + Need Honest Feedback](https://interviewexperiences.in/experience/amazon/amazon-sde-ii-interview-experience-need-honest-feedback) | unknown / unknown |
| amazon | `serialize-and-deserialize-binary-tree` | exact / high | [Amazon SDE II Interview Experience + Need Honest Feedback](https://interviewexperiences.in/experience/amazon/amazon-sde-ii-interview-experience-need-honest-feedback) | unknown / unknown |
| amazon | `house-robber` | exact / high | [Amazon SDE 1 Interview Experience 2026](https://interviewexperiences.in/experience/amazon/amazon-sde-1-interview-experience-2026) | unknown / February 4 (narrative year unspecified; title says 2026) |
| amazon | `lru-cache` | exact / high | [Amazon SDE 1 Interview Experience 2026](https://interviewexperiences.in/experience/amazon/amazon-sde-1-interview-experience-2026) | unknown / February 4 (narrative year unspecified; title says 2026) |
| amazon | `course-schedule-ii` | exact / high | [Amazon SDE 1 Interview Experience 2026](https://interviewexperiences.in/experience/amazon/amazon-sde-1-interview-experience-2026) | unknown / unknown |
| amazon | `largest-rectangle-in-histogram` | related-variant / medium | [Amazon SDE 1 Interview Experience 2026](https://interviewexperiences.in/experience/amazon/amazon-sde-1-interview-experience-2026) | unknown / February 24 (year unspecified) |
| amazon | `search-in-rotated-sorted-array` | exact / high | [Amazon SDE-1 Interview Experience  /  Offer Received](https://interviewexperiences.in/experience/amazon/amazon-sde-1-interview-experience-offer-received) | unknown / May 8, 2026 (narrative heading) |
| amazon | `rotting-oranges` | related-variant / high | [Amazon SDE-1 Interview Experience  /  Offer Received](https://interviewexperiences.in/experience/amazon/amazon-sde-1-interview-experience-offer-received) | unknown / May 8, 2026 (narrative heading) |
| amazon | `merge-intervals` | exact / high | [Amazon SDE 2 (L5)  /  Bangalore  /  Interview Experience](https://interviewexperiences.in/experience/amazon/amazon-sde-2-l5-bangalore-interview-experience) | unknown / unknown |
| amazon | `product-of-array-except-self` | exact / high | [Amazon SDE 2 (L5)  /  Bangalore  /  Interview Experience](https://interviewexperiences.in/experience/amazon/amazon-sde-2-l5-bangalore-interview-experience) | unknown / unknown |
| amazon | `koko-eating-bananas` | related-variant / medium | [Amazon SDE-2 Experience](https://interviewexperiences.in/experience/amazon/amazon-sde-2-experience) | unknown / unknown |
| amazon | `find-median-from-data-stream` | related-variant / medium | [Amazon SDE-2 Experience](https://interviewexperiences.in/experience/amazon/amazon-sde-2-experience) | unknown / unknown |
| microsoft | `meeting-rooms-ii` | exact / high | [Microsoft - SDE II Interview experience](https://interviewexperiences.in/experience/microsoft/microsoft-sde-ii-interview-experience) | unknown / February 27, 2026 |
| microsoft | `letter-combinations-of-a-phone-number` | exact / high | [Microsoft  /  SDE 2  /  Interview Experience  /  Hyderabad  /  Rejected](https://interviewexperiences.in/experience/microsoft/microsoft-sde-2-interview-experience-hyderabad-rejected) | unknown / December 2025 |
| microsoft | `number-of-islands` | exact / high | [Microsoft  /  SDE 2  /  Interview Experience  /  Hyderabad  /  Rejected](https://interviewexperiences.in/experience/microsoft/microsoft-sde-2-interview-experience-hyderabad-rejected) | unknown / December 2025 |
| microsoft | `gas-station` | exact / high | [Microsoft  /  SWE internship  /  March 2025](https://interviewexperiences.in/experience/microsoft/microsoft-swe-internship-march-2025) | unknown / March 2025 |
| microsoft | `word-search` | exact / high | [My Microsoft On-Campus Internship Interview Experience](https://interviewexperiences.in/experience/microsoft/my-microsoft-on-campus-internship-interview-experience) | unknown / unknown |
| microsoft | `longest-repeating-character-replacement` | related-variant / medium | [SDE 2 Microsoft Interview Experience](https://interviewexperiences.in/experience/microsoft/sde-2-microsoft-interview-experience) | unknown / unknown |
| meta | `lru-cache` | exact / high | [Meta E4  /  Onsite  /  Reject](https://interviewexperiences.in/experience/meta/meta-e4-onsite-reject-1) | unknown / unknown |
| meta | `word-ladder` | exact / high | [Meta E4  /  Onsite  /  Reject](https://interviewexperiences.in/experience/meta/meta-e4-onsite-reject-1) | unknown / unknown |
| meta | `daily-temperatures` | related-variant / medium | [Meta E4  /  Onsite  /  Reject](https://interviewexperiences.in/experience/meta/meta-e4-onsite-reject-1) | unknown / unknown |
| meta | `binary-tree-right-side-view` | exact / high | [Meta Onsite E5 Infra](https://interviewexperiences.in/experience/meta/meta-onsite-e5-infra) | unknown / unknown |
| meta | `diameter-of-binary-tree` | exact / high | [Meta E5 Full Loop](https://interviewexperiences.in/experience/meta/meta-e5-full-loop) | unknown / unknown |
| meta | `k-closest-points-to-origin` | exact / high | [Meta E6 ML-SWE / Downlevel](https://interviewexperiences.in/experience/meta/meta-e6-ml-swe-downlevel) | unknown / unknown |
| meta | `kth-largest-element-in-an-array` | related-variant / medium | [Meta E6 ML-SWE / Downlevel](https://interviewexperiences.in/experience/meta/meta-e6-ml-swe-downlevel) | unknown / unknown |
| meta | `minimum-window-substring` | exact / high | [Meta  /  E5 (Prod) Onsite  /  U.S.  /  Rejected](https://interviewexperiences.in/experience/meta/meta-e5-prod-onsite-us-rejected) | unknown / unknown |
| meta | `powx-n` | exact / high | [Meta  /  E5 (Prod) Onsite  /  U.S.  /  Rejected](https://interviewexperiences.in/experience/meta/meta-e5-prod-onsite-us-rejected) | unknown / unknown |
| apple | `valid-sudoku` | related-variant / medium | [Apple interview experience - Full Stack Software engineer](https://interviewexperiences.in/experience/apple/apple-interview-experience-full-stack-software-engineer) | unknown / unknown |
| apple | `merge-intervals` | exact / medium | [Apple interview experience - Full Stack Software engineer](https://interviewexperiences.in/experience/apple/apple-interview-experience-full-stack-software-engineer) | unknown / unknown |
| apple | `spiral-matrix` | exact / medium | [Apple Full Stack Developer Interview](https://interviewexperiences.in/experience/apple/apple-full-stack-developer-interview) | unknown / unknown |
| apple | `rotate-image` | exact / medium | [Apple Interview Experience (Reliability Eng. IS&T Intern)](https://interviewexperiences.in/experience/apple/apple-interview-experience) | unknown / unknown |
| apple | `merge-k-sorted-lists` | exact / high | [Apple Interview Experience (Reliability Eng. IS&T Intern)](https://interviewexperiences.in/experience/apple/apple-interview-experience) | unknown / unknown |
| apple | `lru-cache` | exact / high | [Apple Interview Experience (Reliability Eng. IS&T Intern)](https://interviewexperiences.in/experience/apple/apple-interview-experience) | unknown / unknown |
| apple | `coin-change` | exact / high | [Apple  /  Junior Software Engineer (ICT-2)  /  Offcampus](https://interviewexperiences.in/experience/apple/apple-junior-software-engineer-ict-2-offcampus) | unknown / unknown |
| apple | `coin-change-ii` | exact / high | [Apple  /  Junior Software Engineer (ICT-2)  /  Offcampus](https://interviewexperiences.in/experience/apple/apple-junior-software-engineer-ict-2-offcampus) | unknown / unknown |
| uber | `alien-dictionary` | exact / high | [Uber  /  SDE-2 (L4)  /  Interview  /  2026  /  Pending Results](https://interviewexperiences.in/experience/uber/uber-sde-2-l4-interview-2026-pending-results) | unknown / February–March 2026 |
| uber | `design-twitter` | related-variant / medium | [Uber  /  SDE-2 (L4)  /  Interview  /  2026  /  Pending Results](https://interviewexperiences.in/experience/uber/uber-sde-2-l4-interview-2026-pending-results) | unknown / February–March 2026 |
| uber | `cheapest-flights-within-k-stops` | exact / high | [Uber  /  Software Engineer II (SE-2)  /  Bangalore  /  Interview Experience](https://interviewexperiences.in/experience/uber/uber-software-engineer-ii-se-2-bangalore-interview-experience) | unknown / unknown |
| uber | `find-median-from-data-stream` | exact / high | [Uber SDE-II Interview Experience](https://interviewexperiences.in/experience/uber/uber-sde-ii-interview-experience-2) | 2026-08-22 (company-listing) / April 2026 |
| uber | `reverse-nodes-in-k-group` | exact / medium | [Uber L4 Interview Experience Ongoing](https://interviewexperiences.in/experience/uber/uber-l4-interview-experience-ongoing) | unknown / unknown |
| bloomberg | `rotting-oranges` | exact / high | [Bloomberg Interview SSE - Bquant  /  SF  /  2026  /  Reject](https://interviewexperiences.in/experience/bloomberg/bloomberg-interview-sse-bquant-sf-2026-reject) | 2026-02-08 (company-listing) / unknown |
| bloomberg | `validate-binary-search-tree` | exact / high | [Bloomberg SSE screen round](https://interviewexperiences.in/experience/bloomberg/bloomberg-sse-screen-round) | 2026-02-26 (company-listing) / unknown |
| bloomberg | `implement-trie-prefix-tree` | related-variant / medium | [Bloomberg SSE screen round](https://interviewexperiences.in/experience/bloomberg/bloomberg-sse-screen-round) | 2026-02-26 (company-listing) / unknown |
| bloomberg | `longest-substring-without-repeating-characters` | exact / high | [Bloomberg  /  July 2022  /  Offer Accepted](https://interviewexperiences.in/experience/bloomberg/bloomberg-july-2022-offer-accepted) | unknown / July 2022 (title) |
| bloomberg | `subsets` | exact / high | [Bloomberg  /  July 2022  /  Offer Accepted](https://interviewexperiences.in/experience/bloomberg/bloomberg-july-2022-offer-accepted) | unknown / July 2022 (title) |
| bloomberg | `subsets-ii` | exact / high | [Bloomberg  /  July 2022  /  Offer Accepted](https://interviewexperiences.in/experience/bloomberg/bloomberg-july-2022-offer-accepted) | unknown / July 2022 (title) |
| bloomberg | `lru-cache` (design discussion, **no coding reported**; excluded from mock interviews and the threshold) | related-variant / medium | [Bloomberg  /  July 2022  /  Offer Accepted](https://interviewexperiences.in/experience/bloomberg/bloomberg-july-2022-offer-accepted) | unknown / July 2022 (title) |
| bloomberg | `two-sum` | exact / medium | [Bloomberg  /  July 2022  /  Offer Accepted](https://interviewexperiences.in/experience/bloomberg/bloomberg-july-2022-offer-accepted) | unknown / July 2022 (title) |
| nvidia | `serialize-and-deserialize-binary-tree` | exact / high | [NVIDIA interview experience(rejection)](https://interviewexperiences.in/experience/nvidia/nvidia-interview-experiencerejection) | 2025-06-04 (company-listing) / unknown |
| nvidia | `two-sum` | exact / medium | [Nvidia Software Engineer Interview Experience - Israel, Texas](https://www.jointaro.com/interviews/companies/nvidia/experiences/software-engineer-israel-tx-july-18-2024-no-offer-positive-e25051dd/) | 2024-07-18 (page) / unknown |
| nvidia | `set-matrix-zeroes` | related-variant / medium | [Nvidia ASIC Verification Engineer Interview Experience - Israel](https://www.jointaro.com/interviews/companies/nvidia/experiences/asic-verification-engineer-israel-december-20-2023-no-offer-neutral-dab62e25/) | 2023-12-20 (page) / unknown |
| nvidia | `reverse-linked-list` | exact / high | [Nvidia Interview Experience For FW developer - GeeksforGeeks](https://www.geeksforgeeks.org/interview-experiences/nvidia-interview-experience-for-fw-developer/) | unknown / unknown |
| nvidia | `number-of-1-bits` | exact / medium | [Nvidia Interview Experience For FW developer - GeeksforGeeks](https://www.geeksforgeeks.org/interview-experiences/nvidia-interview-experience-for-fw-developer/) | unknown / unknown |
| nvidia | `reverse-nodes-in-k-group` | related-variant / medium | [Nvidia Interview Experience for SDE-2 - GeeksforGeeks](https://www.geeksforgeeks.org/interview-experiences/nvidia-interview-experience-for-sde-2/) | unknown / unknown |
| nvidia | `search-in-rotated-sorted-array` | exact / medium | [Nvidia Interview Experience for SDE-2 - GeeksforGeeks](https://www.geeksforgeeks.org/interview-experiences/nvidia-interview-experience-for-sde-2/) | unknown / unknown |
| nvidia | `min-stack` | related-variant / medium | [Nvidia Interview Experience for SDE-2 - GeeksforGeeks](https://www.geeksforgeeks.org/interview-experiences/nvidia-interview-experience-for-sde-2/) | unknown / unknown |
| nvidia | `add-two-numbers` | exact / medium | [Nvidia Interview Experience for Software Engineer - GeeksforGeeks](https://www.geeksforgeeks.org/interview-experiences/nvidia-interview-experience-for-software-engineer/) | unknown / unknown |

### Retained earlier evidence (snapshot 2026-10-20)

The previously approved Amazon LRU variation is preserved as a separate source, not upgraded or erased
because a different newly fetched report supports an exact-topic mapping. Its original URL returned
403 in the latest research and was **not re-verified**. It adds neither a distinct topic nor extra
sampling weight. Its qualification and unknown dates remain intact:

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

The four insufficient-data companies had ambiguous/vendor/blocked leads or practical problems outside
the 150-problem catalog. None of those leads was padded into the registry to meet a threshold.

**UI requirement:** render the evidence label, qualification, source link and self-report disclaimer together. Never shorten a qualified variant to “Amazon asked LRU Cache” or show it as exact. Exact-topic rows must still show the candidate-self-report qualification, not an employer-confirmed question badge. If the consuming UI cannot preserve the variation qualification, omit the association. Missing dates must remain unknown. Missing pair evidence must display unknown/no verified evidence, never “not asked.”

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

const metadata = getProblemMetadata('binary-search');
// {
//   slug: 'binary-search', dataStructures: ['Array'],
//   techniques: ['Binary Search'], similarProblems: [{ slug, relation, rationale }, ...],
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

`ProblemMetadata` has `slug`, `dataStructures`, `techniques`, `similarProblems`, and `companyEvidence`. A recommendation has `slug`, `relation`, and `rationale`. Evidence has `companyId`, `slug`, `association` (`exact` or `related-variant`), optional mapping `confidence`, `label`, `qualification`, and `source` (`kind`, HTTPS `url`, `title`, `snapshotDate`, optional `reportedDate`/`reportedDateBasis`, optional partial `interviewDate` or qualified `interviewPeriod`, optional host `caveat`). Unknown years/dates are omitted, not filled with guessed defaults. Types are read-only; consumers must not mutate registry values.

Data definitions live in `src/data/problemMetadata.ts`, `src/data/similarProblems.ts`, and `src/data/companies.ts`; the facade only joins them by slug. Metadata is not persisted and has no dependency on state/history. Recommendation targets remain the full 150 even when the UI is filtered to Blind 75; consuming UI can label catalog membership without changing recommendation or program semantics.

## Validation

Focused Vitest tests check exact 150 coverage/order against the unchanged catalog, 75 subset and fixed 50 program size, valid unique tags, per-link known/non-self/unique targets, relation vocabulary and nonempty rationales, all 12 text companies, source-backed evidence with HTTPS links and valid known dates, explicit variant qualification and unknown year/publication date, unknown-coverage selectors, and preservation of base problem records/catalog/program order during lookups. TypeScript validates cross-registry slug references. These structural tests do not independently certify editorial recommendation quality or verify a candidate's interview account.

## Practice integration

`src/data/companies.ts` also exports `companyInterviewSlugs`, `companyInterviewEnabled` and
`COMPANY_INTERVIEW_MIN_PROBLEMS` (5). Simulation pools include only these documented slugs and intersect
the selected difficulty/category. Exact-topic slugs get sampling weight 3, variant-only slugs weight 1;
this is a practice design choice, not reported frequency. Duplicate source rows add no weight. No
pattern-related fallback is included. Per-problem evidence is hidden during a mock and disclosed after
saving. Simulation/drill results are separate optional version-1 state records; see
[optional-practice.md](optional-practice.md) for spoiler policy, metrics isolation and sync semantics.
