# Optional practice

Dashboard route: `#/practice`. This is not the older extra-practice/bonus Activity flow.

## Isolation

Simulations and drills never create or update Activities, scheduled reviews, problem status, solved checks,
notes, the fixed 50-problem program/order, budgets or timers on Activities. They do not count toward
program progress, pace, worked totals, logged time, streak, heatmaps, calendar, reminders, or independent
weekly-review evidence. **Weekly review does not show them, even separately.** Their completed records
appear only in Practice history and JSON backups. Accepted detection remains unchanged for Activities;
it does not finish or score a simulation. There is no network/API dependency for practice.

## Interviews

- Default global pool: catalog problems with an in-progress/done Activity, non-untouched learned status,
  or true solved check. Planned/skipped work, notes and favorites are not work evidence. Simulation/drill
  records do not unlock any problem. A warning toggle explicitly permits unworked catalog problems.
- Difficulty/category filters intersect the chosen pool; empty intersections cannot start.
- Choose 25, 35 or 45 minutes. The countdown derives from elapsed timestamps, not tick counts; reaching
  zero displays a notice, not an automatic rating/save or Activity completion. Actual elapsed duration
  can exceed the target. The checklist freezes on End; a self-rating and optional reflection (1000
  characters maximum) are saved together with checklist completion.
- Active sessions show only the problem title/link, timer, generic interview checklist and self-rating.
  No technique/structure tags, related questions, notes, hints or per-problem company disclosures are
  mounted during a session. LeetCode's own page may show hints; users must avoid them for a blind mock.
- Company pools use documented slugs only (exact and qualified related variants). At least **five distinct
  documented slugs** are required (the filtered pool is not re-checked against it). A source that reports no coding
  (the Bloomberg LRU Cache design discussion) stays as Roadmap evidence but is never drawn or counted. Duplicate sources for one slug do not increase coverage or sampling
  weight. Exact-topic mappings receive weight 3 and variant-only mappings weight 1: an editorial sampling
  choice, **not reported frequency or an estimate of a future interview**. There is no pattern fallback.
  Company pools may include unworked topics; setup explicitly discloses this. Sources, qualifications,
  dates and caveats appear with completed history. See `roadmap-metadata.md` for research limitations.

## Drills and spoilers

All 50 mandatory program problems have an original one-line summary, one correct pseudo-code outline,
two plausible wrong outlines, and explanations for each. Technique/structure questions use the existing
editorial tag vocabularies. A wrong answer is never a registered tag, a curated also-valid alternative
(`src/data/drillAmbiguity.ts`, one audited entry for each of the 50 problems), a member of a closely related group
(for example Hash Table/Hash Set, Queue/Deque, Sorting/Sweep Line, Greedy/Dynamic Programming, DFS/BFS/Recursion), or a
generic tag (Array, String, Simulation). Questions ask “Which is a useful …”: one useful editorial choice, not the only
possible algorithm or structure. A technique question is skipped when the only technique is the vague “Simulation”.
Structure questions are omitted when a problem's only data-structure key is a generic Array or String, or it has none; a technique question is omitted when its only technique is Simulation. Complexity questions are not included.

For a problem that has not been worked, technique/structure feedback is generic tag-level wording only; the outline
rationale, which is the problem's core insight, is shown only for worked problems. The three outlines of each question
have comparable length, so the correct one is not recognisable by length.

The default pool is worked-only, as defined above. Including unworked technique/structure questions
requires an explicit warning toggle. Pseudo-code questions **always** require prior work, even with that
toggle. Hide techniques makes hint-based drills disabled by default; an explicit local enable checkbox
allows the user to proceed without changing their Roadmap preference. A session requests up to 5/10/20
unique slug/kind questions, shortened honestly when the pool is smaller. Immediate feedback freezes the
first choice. Finish shows the score, then Save records it. Score history is separate from all learning
metrics.

## Persistence and sync handoff

`AppState.version` stays **1**. Both new root fields are optional; old backups import unchanged and absent
fields remain absent. Empty collections and all valid records round-trip through validation/export/import.

- `simulations?: Record<string, SimulationRecord>`
  - key equals nonempty `record.id` (UI uses UUID).
  - `createdAt`, `endedAt`: finite epoch milliseconds, nonnegative and chronologically ordered.
  - `slug`: nonempty string; retained even if a future catalog omits it.
  - `mode: 'global' | 'company'`; `companyId?: CompanyId` is required only in company mode.
  - `outcome: 'solved' | 'partial' | 'not'`.
  - `checklist`: eight boolean keys from `INTERVIEW_STEPS` (`clarify`, `examples`, `bruteForce`, `optimize`,
    `complexity`, `code`, `test`, `communicate`).
  - `durationMs`: finite nonnegative elapsed time, no greater than `endedAt - createdAt`.
  - `targetMinutes: 25 | 35 | 45`; `reflection`: string, up to 1000 characters.
- `drillSessions?: Record<string, DrillSessionRecord>`
  - matching nonempty `id`, `createdAt`, `endedAt` as above; `includeUnworked: boolean`.
  - `answers`: 1–20 unique slug/kind records, each `{ slug, kind: 'technique' | 'structure' | 'outline',
    correct: boolean }`.
  - `score` and `total` must equal the correct-answer count and answer-array length.

**Merge semantics:** merge each collection independently by record ID as whole immutable completed
records, not by slug/date or nested checklist/answer fields. Local saves append through the serialized
store and reject an already-existing ID, preserving concurrent distinct IDs. There are no local
edit/delete actions or tombstones for these collections. Sync must preserve both optional collections
without turning their records into Activities; restore/import/reset retain their existing whole-state
semantics. Conflict handling for an externally imported same-ID/different-content record belongs to the
sync protocol, not a field-level union.

Unfinished sessions live only in React state. The UI warns that leaving loses them, registers an unload
warning, and the dashboard navigation bar asks for confirmation before leaving the Practice view with an active
interview or drill (browser Back/Forward cannot be intercepted and still discard it). After an answer in a drill,
keyboard focus moves to the Next/Finish button. This does not affect any persisted program timer.
Storage failures leave the result/reflection on screen for retry. Saved results are immutable in this UI.
