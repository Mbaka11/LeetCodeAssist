# Optional practice

Dashboard route: `#/practice`. This is not the older extra-practice/bonus Activity flow.

## Isolation

Simulations and drills never create or update Activities, scheduled reviews, problem status, solved checks,
notes, the fixed 50-problem program/order, budgets or timers on Activities. They do not count toward
program progress, pace, worked totals, logged time, streak, heatmaps, calendar, reminders, or independent
weekly-review evidence. **Weekly review does not show them, even separately.** Their completed records
appear only in Practice history and JSON backups. The one deliberate exception is the Logs **Pace by month**
chart, which can overlay the median duration of saved simulations as a separate, labelled series; it is never
added to logged minutes, totals or any other metric (see "Pace chart" below). Accepted detection remains unchanged for Activities;
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

## Two-problem session

Setup offers **Start two-problem session** next to **Start interview**; the single-problem simulation is unchanged.

- Two different problems come from the same pool as a single simulation (global worked pool, an explicit unworked
  toggle, or an enabled company pool, plus the difficulty/category filters). At least two eligible problems are
  required. Both are drawn at the start with the same sampling rules, but problem 2 stays hidden until it starts.
- Each problem has its own timestamp-derived timer (counting up) and a **45-minute reminder**: a visible status banner
  appears once 45 minutes have elapsed for that problem. The timer keeps running, nothing is saved or ended
  automatically, and there is no sound. The "interview length" selector applies to single interviews only.
- A **5-minute break** screen follows problem 1 (checkbox, on by default). It has its own countdown, is skippable
  (**Skip break**) and never auto-starts problem 2; after 5 minutes it offers **Start problem 2**. Break time is
  not part of either problem's time. Turning the option off goes straight to problem 2.
- Each problem has the same eight-step checklist, self-rating and reflection. After problem 2 a **summary page** shows
  both outcomes, total time (sum of the two problem times), checklist completion (x/16), the per-problem reflections,
  and a text field for a session reflection. **Save session** writes both records in one step (all or nothing).
- During the session only titles, links, timers and the checklist are shown: no tags, similar questions, hints, notes
  or company evidence (evidence appears with the saved history, as for single simulations). Accepted detection does not
  finish or score it. Unfinished sessions are discarded on leaving, with the same navigation and unload warnings.
- Saved history shows the two linked records as one entry (total time, checklist, outcomes, both problems and the
  session reflection). If only one record of a session exists on a device (for example after a partial sync) it is shown
  as an incomplete session.

## Pace chart

The Logs page has a **Pace by month** card (not Weekly review: the weekly review is a seven-day comparison and, per the
isolation rules above, never shows practice records; a month-by-month view over all history fits Logs, next to the
other long-term history views). It is independent of the Logs filters.

- Data: completed activities with logged time (`totalMs > 0`) on catalog problems, grouped by completion month and
  difficulty. **First attempts** are `new` activities; **reviews** are every review type (including optional extra
  repeats). Benchmarks, skipped activities, activities without logged time and uncatalogued problems are excluded. The
  value is the **median** with the sample count. At most the last 12 contiguous months ending at the latest month with
  data are shown; months without samples stay empty.
- One chart per difficulty (Easy, Medium, Hard) with a dashed reference line at **15 / 30 / 45 minutes**, labelled an
  editorial guideline, not data and not a program target. If simulations exist, their median duration per month is
  overlaid as a third, separately labelled series (diamond markers). Simulation time is never added to activity time.
- Few samples: a point with fewer than 3 samples is drawn hollow, every point's tooltip and the table show `n`, lines
  join only consecutive months that both have samples, and there is no trend line or forecast.
- Pure SVG/CSS with a `viewBox` (scales to a 360px width), distinct marker shapes in addition to colors, an
  `aria-label` per chart and a collapsible text table per difficulty with the same numbers. Empty data shows an
  explanatory message. Calculation: `src/core/pace.ts`.

## Interview prep

An optional, informational panel (Practice -> **Interview prep**). It stores one `interviewPrep` value and **never
schedules anything, changes the plan, reviews, program, budgets or counts**.

- Choose a company (only those with at least five documented coding problems are selectable, the same rule as
  company simulations) and an interview date from today up to 365 days ahead. Edit or **Clear prep** at any time
  (clearing asks for confirmation). A saved prep whose date has passed is shown as passed; a company that later falls
  below the threshold stays visible but cannot start a simulation.
- The summary shows days left, that company's documented coding problems in catalog order with your status (the
  Roadmap problem status, plus "not worked" using the Practice worked rule), the untouched ones, your slowest ones
  (median logged minutes of completed activities, with attempt counts; not adjusted for difficulty, and one or two
  attempts are a weak signal), the problems still fragile by the weekly-review rule (`weeklySummary(...).fragile`
  restricted to the company), and the review activities that are already planned/in progress with a due date before the
  interview date (overdue ones are flagged; empty for a passed date). Only problem titles appear, no tags or hints.
- **Start a company simulation** opens the Interview simulation setup with that company's pool chosen; nothing starts
  until you press Start. Calculation: `src/core/interviewPrep.ts`.

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
  - Optional two-problem session link (absent on single simulations and on every record saved before it existed):
    `sessionId` (nonempty string, at most 100 characters) and `part` (`1 | 2`) must be present together;
    `sessionReflection` (string up to 1000 characters) is allowed on part 2 only. Session records use
    `targetMinutes: 45` (the reminder length). The two records are saved together but remain independent records.
- `interviewPrep?: { companyId: CompanyId; date: string; createdAt: number }`
  - `companyId` is a known company; `date` a valid `YYYY-MM-DD` (a past date is valid and shows as passed; only the UI
    and the save action restrict new dates to today..+365 days); `createdAt` finite nonnegative epoch milliseconds,
    kept when the prep is edited. Absent means no prep; clearing removes the field.
- `drillSessions?: Record<string, DrillSessionRecord>`
  - matching nonempty `id`, `createdAt`, `endedAt` as above; `includeUnworked: boolean`.
  - `answers`: 1–20 unique slug/kind records, each `{ slug, kind: 'technique' | 'structure' | 'outline',
    correct: boolean }`.
  - `score` and `total` must equal the correct-answer count and answer-array length.

**Merge semantics:** `interviewPrep` is one whole value (record path `interviewPrep`, like `queue`): changed on one
device only it is adopted or published (including clearing it); edited differently on both, or cleared on one and
edited on the other, it is a conflict the user resolves (fields are never mixed). The two records of a two-problem
session are ordinary `simulations` records and merge by ID like any other. Merge each collection independently by record ID as whole immutable completed
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
