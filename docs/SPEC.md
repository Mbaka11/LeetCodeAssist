# LeetCode Assist — Product & Technical Spec (v1; current as of the unreleased post-0.8.0 work)

A Chrome extension (Manifest V3) that runs a **30-day LeetCode bootcamp** built on the
**NeetCode 150** roadmap. You open it and it tells you exactly what to do today:
new problems, spaced reviews, and how long it should take. It notifies you, sits next
to LeetCode in a side panel, and tracks progress, notes and timing.

## 1. Goal (measurable)

Exit criteria on day 30, measured on **unseen** problems:

- **Easy:** solved alone in ≤ 20 min in ≥ 80 % of attempts.
- **Medium:** approach found in ≤ 15 min and accepted in ≤ 45 min in ≥ 60 % of attempts.

Three timed **benchmarks** (1 Easy + 1 Medium, unseen, 60 min budget) on days 1, 15, 30.
Benchmark problems are reserved and never appear in the learning queue.

## 2. Daily budget

- Default target **150 min**, hard planning cap **180 min** (both configurable).
- Consolidation days **7, 14, 21, 28**: no new problems, target **90 min** (reviews,
  failed items, and "blind" mixed practice).
- Normal day: 2 new problems from the queue, and a **third** one when the next queue problem is Easy and the
  day's planned minutes with it stay ≤ cap + **30 min** (the *soft overflow*, `SOFT_OVERFLOW_MIN` in
  `src/core/planner.ts`); reviews and the first two new problems still respect the plain cap, so the core
  plan can reach at most cap + 30.
- **Optional bonus offers.** Besides the core plan (also on consolidation days and after the queue is
  exhausted) the planner keeps up to **two** optional bonus problems on offer (`BONUS_SLOTS`, `src/core/bonus.ts`).
  They are **outside the core budget**: not in `plannedMinutes`, `remainingMinutes`, carried-over work, pace, the
  toolbar badge, reminders, the plan-done ratio or projections, and they never become debt. They are shown even
  when the core plan already fills the cap; the UI states the extra estimated time and warns explicitly when
  starting one would pass the daily target or the cap (`bonusTimeImpact`, `src/lib/bonusTime.ts`).
- The bonuses come from the **bonus pool** (`BONUS_POOL`, `src/data/bonus.ts`): **46** extra NeetCode 150
  problems that are not in the program queue or the benchmarks, ordered by roadmap category and
  difficulty, all Medium except one Hard (every free Easy problem is in the program). The Mediums that did not
  fit the queue come first in their category.
- **Readiness rule.** A pool problem is a candidate only when its category is *ready*: *introduced* (some
  completed activity of any type, or a core item of today's plan, is in that category) or *prerequisite-ready*
  (every prerequisite category of the roadmap graph is introduced). Candidates keep pool order; a problem with a
  skipped `new` activity moves behind every never-skipped candidate (a postponement, not a deletion); a problem
  with a completed activity is never offered again. When fewer than two can be offered, `bonusHold` explains why
  (locked category and the next prerequisite to start, or pool exhausted).
- **Persisted, renewable offers.** Open offers are stored as ordinary `new` activities of pool slugs (planned or
  in progress) and are *sticky*: they survive reloads and days, a started one keeps its timer and hints, and they
  are never re-ranked. Completing or skipping one frees its slot at once (no per-day limit) and the planner
  refills it; `materializePlan` persists at most the two open offers. Records from 0.5 (one planned pool activity
  per date) are read as offers and never rewritten or deleted. A completed bonus starts the normal review cycle
  (D+1/3/7/21) and counts as worked in the roadmap, but it **does not count toward pace** and not toward the
  *x*/*N* program counter (*N* = the queue length), and it never consumes the program queue. Its four reviews are
  core work and are fitted before new problems, so many finished bonus problems can crowd out program new
  problems on later days (accepted trade-off, no limit). Skipping an offer re-dates it (and retired twins) to the
  skip day, so the Calendar and Logs show a skip on the day it happened.
- **Distinct problems worked** (`workedTotals`, `src/core/worked.ts`): a slug counts once when it has any `done`
  activity. Buckets are disjoint in the order program, benchmark, bonus pool, other:
  *Program x/50 · Benchmarks x/6 · Bonus x* (+ *Other* when non-zero), `total` is their sum. Reviews, blind and
  re-solve attempts and extra practice never count a slug again; planned, skipped, in-progress and manually
  ticked problems do not count. It is derived from history only (no stored counter), and the program counter
  stays separate.

## 3. Activity types & review cycle

| Type | When | Instruction | Budget Easy / Medium / Hard (min) |
|---|---|---|---:|
| `new` | queue | Search, code, understand, write notes. Help ladder: hint at 15–20 min without an approach, read the solution at 35–45 min then **re-code it from memory**. | 25 / 40 / 50 |
| `recall` | done + 1 day | Without notes: state the approach, why it works, time/space complexity. | 5 / 8 / 10 |
| `rebuild` | done + 3 days | Rebuild the algorithm in pseudocode or code, check edge cases. | 10 / 15 / 18 |
| `resolve` | done + 7 days | Solve from a blank editor, no hints, no old solution. | 15 / 25 / 30 |
| `blind` | done + 21 days | Solve with the category hidden. Solved alone ⇒ **mastered**. | 15 / 20 / 25 |
| `retry` | next day after a failure | Targeted redo of a failed review. | 10 / 15 / 18 |
| `benchmark` | days 1, 15, 30 | Timed unseen Easy + Medium. Once done, each problem enters the normal review cycle (D+1/3/7/21) like a `new` problem. | 30 per problem (60 for the pair) |

**Budgets depend on the problem difficulty.** A problem outside NeetCode 150 counts as Medium. The values
above are the defaults (`DEFAULT_BUDGETS`, `src/core/activities.ts`); the user can override any cell in
Settings (`settings.budgets`, integers 1–180). Every consumer (planner time totals and cap, projection,
calendar, reminders and the cards in the UI) gets its minutes from the single function
`estimatedMinutes(type, slug, settings.budgets)`, so an override applies everywhere. Benchmarks keep their
flat budget. Changing a budget changes the plan from then on; history is never rewritten.

**Offsets are computed from the date the `new` activity was actually completed**, not the
planned date. Every later stage is scheduled from the actual completion of the previous
anchor (the `new` completion), i.e. recall = D+1, rebuild = D+3, resolve = D+7, blind = D+21.

Outcome per completed activity: `solo` | `hint` | `solution` | `stuck`.

Rules:
- `recall`/`rebuild` with outcome `solution` or `stuck` ⇒ schedule a `retry` next day;
  the normal cycle continues.
- `resolve` with `solo` ⇒ blind stays at D+21. With `hint`/`solution`/`stuck` ⇒ status
  `consolidating`, schedule a new `rebuild` at +3 and `resolve` at +7 from **that** day
  (blind is pushed accordingly to resolve-day + 14).
- `blind` with `solo` ⇒ status `mastered`. Otherwise ⇒ `consolidating`, `resolve` again at +7.
- **Merge overlapping reviews**: never more than one review activity per problem on a day;
  keep the strongest (`blind` > `resolve` > `retry` > `rebuild` > `recall`).
- Reviews continue after day 30 (a problem learned on day 29 gets its resolve on day 36).

### Completion date and late logging

The shared **Finish** form (Today and side panel, including an Accepted-opened form) displays an automatic
training date, with no Today/Yesterday selector. A training day starts at **04:00 local wall-clock time**:
00:00–03:59 belongs to the preceding calendar date. `trainingDateFromTimestamp` compares local hours and
uses calendar-day arithmetic, not a fixed millisecond subtraction, so daylight-saving changes work too.
Civil dates remain civil dates for LeetCode events, interview appointments and backup filenames.

`commands.completeActivity` derives `completedAt` from the actual save-time clock. Its optional `completedDate`
is only an expected-date race guard, not an override: a mismatch rejects without a write and asks for a retry.
A timer started before 04:00 does not retain the old day's credit when saved after the boundary. The timer
always uses actual timestamps. New results store additive `completedAtMs` (actual save timestamp), preserved
by validation, sync, JSON backups and audited corrections, and displayed in Logs and attempt history.
Legacy results keep their dates and may lack this field; no history is inferred or automatically redated.

The planner, dashboard, side panel, calendar, weekly window, streak, reminder badge and review operations
use the training date. Review offsets remain +1/3/7/21 training dates; the next day's reviews activate at
04:00, not midnight. An open Finish form updates its displayed date at the boundary without resetting its
outcome or edited time. Pending saves remain disabled and errors retain the form's values.

Unstarted missed benchmarks are exposed as `DayPlan.missedBenchmarks`, separately from the core plan,
its minutes, badge and plan-done denominator. Missing fixed pairs are materialized once at their original
due date; done/skipped pairs are not recreated. Starting an old benchmark keeps the existing core-plan
behaviour for in-progress work. Its completion credits the current training date, never its missed date.
Legacy backdated records retain their existing calendar presentation (including fulfilled unopened new slots).
The 50-problem order and review intervals are unchanged, as is LeetCode's public calendar and UTC streak.

### Correcting completed results

Logs exposes **Correct…** only for done activities. A native modal edits date, total minutes and outcome,
then requires **Preview changes → Confirm correction**. Preview is pure; Cancel makes no write. A preview
fingerprint includes the local date, settings, this problem's status and all its activities. Commit recomputes
against latest storage under the existing lock and rejects stale fingerprints; unrelated history is preserved.

`prepareResultCorrection` / `confirmResultCorrection` in `src/core/resultCorrection.ts` implement the policy:
- Duration-only edits preserve all reviews and learning status. The timer and approach timestamp are not
  rewritten. Duration must be a non-negative integer millisecond value at least the recorded approach time.
- Dates range from program start (or an original earlier completion) to today, additionally bounded by the
  previous/next completed attempt of this problem. Same-day ties keep saved activity order; an edit cannot
  reorder completed attempts. This avoids interpreting an original learning event after a later completed test.
- Date/outcome edits replay completed attempts for this problem in that order through the existing outcome
  rules. Completed scheduled reviews consume their replay counterparts; optional repetitions do not. Running
  scheduled reviews are preserved and their counterpart is not duplicated. Completed attempts other than the
  target, started work and optional practice retain their fields, IDs and timers.
- Desired unstarted scheduled reviews are matched by type/date to existing plans. Matches keep their IDs;
  obsolete plans become skipped history, and missing plans get fresh unique IDs. Manual rescheduling can be
  superseded, explicitly warned about in preview. Overdue generated reviews remain due; no catch-up is fabricated.
  Other future work may rebalance under the unchanged cap. Only this problem's derived learning status changes.
- If another completed attempt lacks an outcome, schedule replay is refused rather than inventing that
  outcome; duration-only correction remains available. Skipped/manual-move history has no provenance graph:
  replay derives the new scheduled cycle from completed evidence, not from guessed historical user intent.

Each edit appends `Activity.corrections` with actual edit time and previous date/duration/outcome. JSON
validation/import/export preserves this optional audit; the state version stays 1. Logs/CSV and weekly metrics
use corrected current values, not audit snapshots. Repeated confirmation cannot silently overwrite a newer edit.

### Weekly learning evidence

The read-only `#/weekly` route compares `[end-6, end]` with `[end-13, end-7]` in local calendar dates. End
follows today by default, with previous/next windows and an explicit end-date control (never future). Done
activities alone contribute time/volume. First-worked counts use the earliest recorded completion per slug;
repeated attempts never multiply that number. Per-category rows show current activity count, first-worked
problems, and current/previous distinct problems with independent scheduled reviews (Solo, no recorded hints,
review type, not optional extra practice). Help means Hint/Solution outcome or a recorded hint; the denominator
contains rated attempts (known outcome or recorded hints), not unknown legacy outcomes. Categories from either
period are included, even when the current period is empty. Unknown metadata goes to Other / uncatalogued.

The fragile list is a snapshot as of end, not only the last week's new failures. It uses the latest rated
non-extra scheduled review; otherwise a rated initial completion, otherwise available rated extra evidence.
Hint/Solution, recorded hints or Stuck produce a reason and evidence date/type. Optional immediate Solo repeats
do not erase an earlier scheduled-review signal. Unknown outcomes are not success, future completions are
excluded, and absence from the list does not imply mastery. Small samples/different difficulty limit comparisons.
No action, adaptive schedule, budget calibration, mandatory problem or queue change is triggered by this view.

### Moving and postponing

Plans can be adjusted without losing anything:

- **Move a review** (`Move…` on a Today card or in the Calendar day detail): choose a new date
  (today up to 60 days ahead). Only the `dueDate` of the planned review changes; its type and the history stay.
  If the problem already has a planned review on that day the stronger one is kept and the weaker one
  is marked skipped (merge rule); a day on which that problem's review is already in progress is
  rejected. Started or finished activities, benchmarks and optional practice
  cannot be moved.
- **Postpone a `new` problem** (replaces the destructive *Skip*): the activity is marked `skipped` with
  `postponed: true` (kept in history) and the problem moves back in the queue behind the **next two**
  unfinished problems (`AppState.queue` stores the new order). It is planned again later and never
  leaves the program. A plain skip (benchmarks, optional practice) still drops the item.
- Stopping a *started* review keeps the old behaviour: it is marked skipped and planned again tomorrow.

### Hints

Every program, benchmark and bonus-pool problem has three progressive hints (`src/data/hints.ts`): **nudge**
(technique family), **insight** (key observation) and **sketch** (algorithm outline with complexity;
no code). Revealing hint *n* stores `hintsUsed = max(hintsUsed, n)` on the open activity. When the
outcome form opens for an activity with `hintsUsed > 0` it pre-selects **Hint** and explains why; the
user can still pick another outcome. Hints used are shown in the attempt history.

Problem status: `untouched` → `learning` (new done) → `consolidating` (a review failed) →
`reviewed` (resolve solo) → `mastered` (blind solo).

## 4. Queue-based planner (no fixed dates for new problems)

- New problems come from an **ordered queue** (50 problems, NeetCode roadmap order, Easy and Medium only,
  no Hard). Queue = `src/data/program.ts`. It holds every free Easy problem of the NeetCode 150 except the
  benchmark ones (the Premium-only Easy *Meeting Rooms* is left out) plus the core Mediums of each pattern; the
  other Mediums are bonus-pool problems. The size is chosen so that, with reviews on time, a user who does the
  plan has **all queue problems introduced by day 30** (a test projects the whole program day by day and
  checks it). The optional bonus is not part of the queue (see §2).
- Planner for a day (pure function `planDay(state, date, settings)`):
  1. Overdue + due reviews, sorted by priority: `retry`, `recall`, `rebuild`, `resolve`, `blind`;
     overdue first. Reviews never get dropped; if they exceed the cap, the remainder is
     shown as "carried over" and spread forward (max cap per day).
  2. Benchmark if it's day 1/15/30.
  3. Fill remaining budget with the next queue items (2 normally, 0 on consolidation days,
     fewer if reviews fill the budget); a third one when it is Easy and the day stays ≤ cap + 30 (soft
     overflow, §2). A problem postponed today is not offered again today. Then up to two optional bonus
     offers (`DayPlan.bonuses`, §2), outside the budget, with the finished ones in `completedBonuses`.
  4. **Pace indicator**: `actualNewDone - expectedNewDone(dayIndex, queueLength)` ("+2 ahead" /
     "−1 behind"); `expectedNewDone` is 2 per normal day capped by the real queue length, so it reaches the
     whole queue by day 30 (the queue stays within 2 × the 26 normal days). Only program-queue problems
     count, bonus-pool problems do not. The expectation does not count the optional third Easy problem, so
     a user who follows the plan on those days reads "+1 ahead" until the queue is exhausted (day 30 is "on pace").
- Missing days never produce an impossible day: the cap is always respected.
- The queue order is `PROGRAM_QUEUE` unless the user postponed problems (`AppState.queue`).
- History is append-only; past activities are never rewritten.

The planner and review generator are **pure TypeScript with no browser APIs**, fully unit
tested. Decisive test: a problem completed on day 1 creates recall day 2, rebuild day 4,
resolve day 8, blind day 22, and the state survives a serialize/deserialize round-trip.

## 5. Data model

```ts
type Difficulty = 'Easy' | 'Medium' | 'Hard';
interface Problem { slug: string; title: string; difficulty: Difficulty; category: string;
  url: string; neetcodeOrder: number }            // static, src/data/neetcode150.ts
type ActivityType = 'new'|'recall'|'rebuild'|'resolve'|'blind'|'retry'|'benchmark';
type Outcome = 'solo'|'hint'|'solution'|'stuck';
interface TimerState { startedAt: number|null; accumulatedMs: number; running: boolean }
interface Activity { id: string; slug: string; type: ActivityType; dueDate: string /*YYYY-MM-DD*/;
  status: 'planned'|'in_progress'|'done'|'skipped'; timer: TimerState;
  approachMs?: number; totalMs?: number; outcome?: Outcome; completedAt?: string; completedAtMs?: number; createdAt: string;
  extra?: boolean;      // optional practice, never debt
  hintsUsed?: number;   // 1-3: hints revealed during the attempt (additive, absent = none)
  postponed?: boolean; // skipped `new` that was moved back in the queue
  corrections?: { at: number; previousDate: string; previousTotalMs?: number; previousOutcome?: Outcome }[] }
interface Note { slug: string; trigger: string /*"Click"*/; principle: string; pitfall: string;
  complexity: string; code?: string; updatedAt: string }
interface Settings { startDate: string; dailyTargetMin: number; dailyCapMin: number;
  morningNotify: string /*"08:30"*/; eveningNotify: string /*"20:00"*/; language: 'python';
  roadmapView?: 'tree'|'grid'|'all';    // absent = 'tree'
  roadmapCatalog?: 'neetcode150'|'blind75';  // absent = 'neetcode150'
  roadmapDetail?: 'compact'|'detailed';     // All layout; absent = 'compact'
  roadmapHideTechniques?: boolean;         // absent = false
  sidePanelFocus?: boolean;                // side-panel Focus mode; absent = false
  eveningOnlyIfOpen?: boolean;             // evening reminder only while today is not done; absent = true
  budgets?: BudgetOverrides }     // partial minutes per type and difficulty; absent = defaults
type BudgetOverrides = { [T in Exclude<ActivityType,'benchmark'>]?: Partial<Record<Difficulty, number>> }
interface AppState { version: 1; settings: Settings; activities: Activity[];
  notes: Record<string, Note>; problemStatus: Record<string, ProblemStatus>; checked: Record<string, boolean>;
  queue?: string[];                // saved queue order after postponing; absent = PROGRAM_QUEUE
  favorites?: Record<string, boolean>;                  // by slug; false = explicit unstar (kept for sync)
  savedRoadmapFilters?: Record<string, { name: string; filters: RoadmapFilters }>; // by UUID
  simulations?: Record<string, SimulationRecord>;       // immutable, by id (section 6e)
  drillSessions?: Record<string, DrillSessionRecord>;   // immutable, by id (section 6e)
  interviewPrep?: { companyId: CompanyId; date: string; createdAt: number } } // optional, one whole value (section 6e)
// SimulationRecord additionally has optional sessionId + part (1|2) together, and sessionReflection on part 2 only.
```

`hintsUsed`, `postponed`, `corrections`, `completedAtMs`, `roadmapView`, `roadmapCatalog`, `roadmapDetail`,
`roadmapHideTechniques`, `sidePanelFocus`, `eveningOnlyIfOpen`, `budgets`, `queue`, `favorites`, `savedRoadmapFilters`, `simulations`,
`drillSessions` and `interviewPrep` (and the simulation fields `sessionId`, `part`, `sessionReflection`) are optional and additive: data saved by 0.1 stays valid and absent fields stay absent, so
`version` remains `1`. Exact field rules: `presentation-state.md` and `optional-practice.md`. Sync (section 6f) adds no
fields and keeps its own state (config, status, base snapshot, conflicts, backups) in separate `chrome.storage.local`
keys that are not part of `AppState` or the JSON backup. Every optional `AppState` and `Settings` field travels through the
sync merge (guarded by `src/core/syncFieldCoverage.test.ts`); the device-local appearance preference
(`leetcodeAssist.appearance.v1`: theme and text size) does not.

The timer is derived from timestamps (`accumulatedMs + (now - startedAt)`), never from tick counting.
Dates are local calendar dates (YYYY-MM-DD) computed in the user's timezone.

## 6. Extension surfaces

Built with **WXT + React + TypeScript**, storage in `chrome.storage.local` (single `AppState`
key, versioned), JSON export/import from Settings.

1. **Dashboard** (full tab, opened from the toolbar icon): views
   - **Today**: planned vs logged time, ordered activity list, "Start next activity",
     per-activity instruction, timer (start/pause/resume, "approach found" button),
     outcome form, pace indicator, streak, and the **problems worked** total (`WorkedTotal`: distinct
     problems with a finished attempt, *Program x/50 · Benchmarks x/6 · Bonus x*, *Other* only when non-zero;
     a short note says reviews never add to it and a bonus never replaces a program problem). Below the core
     list an **Optional bonus problems** card shows the up-to-two offers (`BonusOffers`): each is labelled
     *Optional*, says it is not part of the core plan time and adds later reviews, shows the estimated extra
     time and warns when starting it would pass the target or the cap, and keeps timer controls while started
     (the header names a running bonus). Finished bonus problems are only mentioned in one line (they live in
     Logs and the Calendar); `bonusHold` explains fewer than two offers. Today persists unsaved offers once
     (`needsMaterializing` looks at every offer).
   - **Calendar**: a compact **summary row** with the overview card (streak, *Plan done*, *Time logged*, program
     problems learned *x*/*N* (*N* = queue length), days elapsed *d*/30, the problems-worked total) and a compact
     **LeetCode streak** card side by side from 1000 px (stacked below; cards use `min-width: 0`, the heat grid and
     the day table scroll inside their card, so the page never scrolls sideways). The layout rules are scoped to
     `.cal-summary` and `.page-calendar` and do not change global card or stat sizes. Explanations (*How these
     are counted*) and the start date editor (*Change start date*) sit behind `<details>` controls. The
     full-width day grid follows directly (days 1–30 (+ overflow), planned/done/carried counts and minutes per
     day with a small minutes bar per cell); the day detail below it defaults to today. The streak (≥ 1 activity done and ≥ 30 min logged) is separate
     from **Plan done** (a past or current day whose *core* activities are ≥ 80% done: activities
     due that day that are not optional practice, the bonus or postponed; skipped ones count as not
     done; a day without core activities is neither done nor missed; the stats tile reads "*n* of *m*
     days" over the elapsed days that had core activities, and done days carry a *Plan done* badge),
     and a **Time logged** tile (total over the last 7 days, all-time total as hint). **Hovering or focusing** a day opens a popover (not a `title`) listing its
     activities (type, problem, estimated minutes, total); Escape closes it. For **future** days the
     popover is a **projection** labelled *projected*: the pure planner is run day by day from today,
     assuming every planned activity is done solo on budget and nothing else changes
     (`projectDay` in `src/core/projection.ts`). The day detail has `Move…` for planned reviews and
     `Postpone` for today's new problems. A finished bonus appears on its completion day with a *Bonus*
     badge; an open offer is listed on today only, labelled *Optional*, and unopened offers never become missed
     days. (In 0.9.1 the **Activity minutes** heatmap moved to **Logs**, below the summary; the two ranges sit side by side.) It shows completed-log minutes per local day for
     program days 1–30 and a separately labelled recent 12 weeks (`src/core/activityHeatmap.ts`; skipped estimates
     and running timers excluded; it never feeds the streak or Plan done).
   - **Roadmap**: a **NeetCode 150 | Blind 75** catalog selector (stored in `settings.roadmapCatalog`, default
     NeetCode 150) and a **Tree | Grid | List** toggle (stored value `all`; optional `settings.roadmapGroup` = `category`|`company` groups List) (`settings.roadmapView`, default Tree), independent of each other.
     The catalog filters the problem lists, the counters and the tree/grid stats (`problemStats(state, catalog)`,
     `categoryDifficultyCounts(state, catalog)`); both catalogs read the same `problemStatus`, `checked` and
     activities, so nothing is duplicated or reset. Both counters (*NeetCode 150 x/150 · Blind 75 y/75*) are
     always visible, with a note that Blind 75 is a subset (not 150 + 75). Every category keeps its tree node;
     a category without problems in the catalog would be labelled and show no problem panel (all 18 currently have
     at least one Blind 75 problem). Premium problems carry a *Premium* badge and are never scheduled. *Tree*
     draws the NeetCode prerequisite graph left to right (one column per tier, SVG arrows, scrollable);
     each node shows worked/total, solo in review, consolidating and Easy/Medium/Hard counters, and
     selecting a node lists its problems below (checkbox, status pill, program/benchmark/bonus badges,
     LeetCode link). *Grid* is the earlier card layout: per category "worked / solo in review /
     consolidating", Easy/Medium/Hard counters (x/150), check boxes, program items badged.
   - **Logs**: a table of every completed or skipped activity, newest first: date, program day, type,
     problem (link to its sheet) with difficulty, category, logged time, approach time, budget, delta
     versus budget, outcome, hints used and status (done, skipped or postponed). Skipped rows show the due
     date; the budget is the *current* budget (including overrides), also for older rows. Filters: type,
     difficulty, outcome, category, date range and free-text search on the title. A summary row covers the
     filtered set: count, total time, average time against average budget, and the solo rate (share of
     done rows with outcome `solo`). *Export CSV* downloads the filtered rows. Filtering, summary and CSV
     are pure helpers in `src/core/logs.ts`. Below the heatmap, **Pace by month** (`src/core/pace.ts`) charts the median
     logged minutes per completion month and difficulty, first attempts and reviews separately, with sample counts,
     hollow few-sample markers, an editorial 15/30/45-minute guideline line (labelled as not data) and, when simulations
     exist, a separate overlay of simulation medians; see `optional-practice.md`.
   - **Problem sheet**: program position, notes (Trigger, Principle, Pitfall, Complexity, Python
     snippet), hints, attempt history (type, duration, approach time, hints used, outcome), next review.
     During review activities notes are **hidden until the user clicks "Reveal"**.
   - **Practice** (`#/practice`): optional interview simulations and pattern drills, separate from the program
     (section 6e).
   - **Settings**: start date, daily target and cap, notification times, a compact **time budgets** table
     (rows = activity types, columns = Easy / Medium / Hard, *Reset to defaults*), **Sync** (section 6f), detection and
     LeetCode profile cards, an **Appearance** card (theme system/dark/light and text size small/normal/large, stored on this
     device only), and *Your data*: JSON export/import/reset (the export can add an optional top-level `leetcodeSettings`
     section with the LeetCode username and the two detection switches; import restores it only when the file has it and the
     user ticks the option, and a malformed section refuses the whole file), *Export all notes (.md)* (a reading export,
     not a backup format) and the local pre-merge sync backups.
2. **Side panel** (`chrome.sidePanel`): one **global** panel per window. The service worker calls
   `setOptions({ path, enabled: true })` once (no per-tab enabling), so the panel stays open while
   the user switches or opens tabs and follows the active tab's URL.
   - On a LeetCode problem page (`/problems/<slug>/`): title, difficulty, category, program position
     (*n*/*N* with *N* the queue length, or *Bonus problem*), status, next review, today's activity with its instruction, timer and outcome form, for either bonus offer too (or
     an offer to start extra practice; for a pool problem that is not on offer it says the practice is optional and outside the core plan time), **hints** (three progressive *Reveal hint 1/2/3* buttons),
     notes (hidden during reviews until *Reveal*) and the attempt history including hints used.
   - **Focus mode** (toggle, persisted as `settings.sidePanelFocus`): for the current activity (running, then paused
     in-progress, then planned; the same one hints and Accepted use) only the title/link, instruction, timer controls,
     hints and Finish form are visible; the toggle keeps one label (*Focus mode*) with `aria-pressed`. Other attempts,
     metadata, notes, history and the optional-practice footer are hidden, and the detection panel is hidden but
     mounted and replaced by a one-line detection summary; everything stays mounted where it holds state, so timers
     and unsaved Finish edits survive toggling; detection and Accepted auto-Finish are unchanged. Without a current
     activity the toggle explains that and the normal panel stays visible.
   - **Shortcuts** (only while the panel document has focus and the target is not a text field): Alt+T start/pause/resume
     the selected activity, Alt+R open Finish, Alt+1..4 choose the outcome, Alt+Enter save a valid form, Alt+? toggles the
     visible list. They call the same handlers as the buttons; Alt+Shift+L stays the browser command.
   - On any other page: an **Open a LeetCode problem** state with today's checklist (core items, the up-to-two
     optional bonus offers marked *Optional bonus*, carried-over reviews); each item has an
     **Open** button that navigates the active tab (when it is a LeetCode or empty tab) or opens a new
     tab.
   - Opening: the dashboard's *Open side panel* button, the shortcut **Alt+Shift+L**, and clicking a
     LeetCode problem link in the dashboard (which also calls `chrome.sidePanel.open({ windowId })`
     in the same click handler, best effort).
3. **Background service worker**: the sync service (section 6f, registered first), `chrome.alarms` for the morning summary notification
   ("Today: 2 new, 2 recalls, 1 rebuild · ~2h20") and the evening summary ("Today: 3 done, 1 left, 95 min logged",
   built from the same plan as the badge). With `settings.eveningOnlyIfOpen` (absent = on) the evening summary is
   skipped when today's core plan has nothing left or no activities; off sends it on every evening with planned
   activities. A notification that fires on a later day than scheduled is dropped, and the 04:00 rollover alarm clears
   the previous day's notifications. Toolbar **badge** = remaining activities today; clicking a
   notification opens the dashboard.

Permissions: `storage` (also covers `chrome.storage.sync`), `alarms`, `notifications`, `sidePanel`, `tabs`; host `https://leetcode.com/*`.
The manifest carries a fixed public `key` (section 6f), so the extension ID is `ghpljfdplcicmcfoemfifmmibbdjcmja`. The two content
scripts of the LeetCode features (section 6a) are declared for `https://leetcode.com/*` (since 0.9.3, so in-page navigation from the problem list is observed); they only act on `/problems/<slug>/...` pages.

### Grouped problem activities

Today renders one problem card per slug **within each activity section**, using a shared `ProblemActivities`
component. A single activity uses the classic standalone card without numbering or an extra group heading/count;
only groups of two or more show a shared heading and numbered rows. Wrappers and activity keys stay stable when
a group grows or shrinks, preserving an open Finish form and its outcome, date and minutes. The first
appearance preserves the problem's plan priority within each unfinished/finished partition in Today. Groups
with any open attempt precede fully closed groups, using a stable partition; side-panel behavior is unchanged.
The LeetCode link has a reserved top-right header area, not a place in the metadata badge flow. Rows inside a group follow the stored
activity order (virtual activities follow persisted ones). The title, category, difficulty and LeetCode link
appear once. Each independent attempt has a type and sequence number; done rows show outcome, time, approach
time and hints compactly, while open rows retain instructions, their own timer, Move/Postpone/Skip and Finish.
Extra attempts are labelled **Extra practice**. The group heading shows activity count and done count.

The side panel groups all matching current activities and keeps the repeat-practice action inside that group
when there is no open attempt. Fresh Accepted is still passed to the rows, but only the selected attempt may
auto-open Finish; stable slug/activity keys keep an existing form and its choices intact on rerenders. The
non-problem-page checklist groups repeats in one row with per-type counts, aggregate minutes and one Open
button; the header's activity totals stay unchanged.

This is presentation only: no stored activities are merged/deleted, no review rules or budgets change, and
program/worked counters still use the existing underlying records. Optional bonuses and carried work retain
separate sections in Today. Full dated history and one-row-per-attempt Logs/CSV remain available.

## 6a. LeetCode features: accepted detection, submission streak, timer colours

The API contract behind the first two is documented, with its confidence level, in `docs/leetcode-api.md`.

**Accepted detection (passive).** A content script in the page's own (MAIN) world on `leetcode.com/*` (events only on `/problems/<slug>/...` pages)
wraps `fetch` and `XMLHttpRequest` and only *observes*: it never alters a request or response, never submits
or retries anything. For the submit route (`/problems/<slug>/submit/`) it notes slug and time; for the result
polling routes (`/submissions/detail/<id>/check/` and `/submissions/detail/<id>/v2/check/`) it reads a bounded
clone of the response and keeps only `state`, `status_msg`, `lang` (and `status_runtime`/`status_memory` when present). It posts the event with
`window.postMessage` to an isolated content script, which validates origin and shape and relays it with
`chrome.runtime.sendMessage`; the background worker validates again, stamps its own receipt time and appends
it to a capped list (200 events, own storage key `leetcodeAssist.submissionEvents.v1`, written under a lock,
not part of `AppState`). Pure parsing and validation: `src/lib/leetcodeSubmissions.ts`.
- Side panel: a **fresh Accepted** arriving while the matching **in-progress** activity is on screen pauses
  its timer and opens the usual **Finish** form. The running activity takes precedence if more than one is
  open for that problem; at most one card auto-opens, and other matching cards mark that event as already
  observed so a pause cannot trigger a second form. The form still requires **Save result**:
  **Solo** is pre-selected only when `hintsUsed` is 0, otherwise **Hint**; the user can change the outcome and
  time. Nothing is ever completed automatically. The notice includes language, timestamp and earlier failed
  attempts; non-Python results add a gentle note.
- Auto-opening is limited to events newer than the card's initial observation and the current timer start
  (if running). Events present on mount, loaded from storage before that boundary, or already handled do not
  auto-open. Starting/switching activities resets the observation boundary; **Cancel** consumes the event so
  storage updates and timer ticks do not reopen the form. A later Accepted can open it again. An already-open
  manual form and its selected outcome are left untouched.
- Older detected results still offer *Accepted at 23:14 (Python3) — finish this activity?* and a manual
  *Finish this activity…* button. This advisory uses the latest Accepted since the local 04:00 training-day boundary, not a persisted
  first-start timestamp (the activity schema is unchanged). A closed side panel cannot automatically open a
  form or stop a timer; reopening it after a verdict uses the manual button instead.
- Settings, *LeetCode detection*: on/off (default on; when off, events are dropped by the worker and none are
  stored), diagnostics (submissions seen, results seen, Accepted count, last `status_msg` values, last event
  time, no bodies), *Clear detected events* and a plain-language privacy note. With nothing detected, every
  activity is finished by hand exactly as before.

**Detection status indicator.** `LeetCodeDetectionStatus` can be shown above side-panel content (including
setup/error states) using **Show detection status in side panel** in Settings. It is hidden by default and
always available in Settings. Visibility lives in optional `LeetCodePrefs.showDetectionStatus` (absent = false)
and is independent of `detectionEnabled`: hiding the panel cannot stop observation or automatic Finish opening,
and toggling it must preserve an already-open form. Its labelled on/off badge represents the stored detection preference,
not observer liveness. Two always-visible rows show the last saved Submit and Accepted across all problems,
including local date/time and problem title (language when present). None recorded means absent from the
capped local event list, not no submission in the user's real LeetCode history. Turning detection off keeps
old observations; Clear detected events removes both timestamps. Existing watched storage drives updates;
no new keys, request, heartbeat, permissions or timer/completion actions are introduced.

Feedback is scoped to the active problem when one is open: no observations; Submit with no later final
result for the same slug; the latest unsuccessful verdict; or Accepted with/without an in-progress activity.
A result for a different problem cannot answer the current problem's Submit, and an old Accepted cannot
answer a newer Submit. This correlates problem and receipt time, not submission IDs; it cannot prove the
health of an individual request. Latest observations are selected by timestamp, not array order. Switching
tabs changes feedback but not the global timestamp rows. A polite live region announces feedback changes,
not every clock tick; badge text accompanies its decorative dot so colour is not the only status cue.

A collapsed **Why did Finish not open?** section explains that the setting does not verify a connected page,
judging may still be running, reload is needed after updates (avoid reloading unsaved work), an activity must
be started with the side panel visible, and only a fresh Accepted opens Finish. Historical Accepted, Cancel,
and manual Save result requirements remain unchanged. The status never opens/saves a form itself. A Settings
button in the side panel opens the dashboard's existing Settings route. Dates refresh with the existing
side-panel clock and a 30-second display clock in Settings; there is no network polling.

**LeetCode submission streak.** Optional username (Settings, *LeetCode profile*; letters, digits, `_ - .`,
up to 40). The background worker POSTs the public GraphQL query `matchedUser(username).userCalendar` to
`https://leetcode.com/graphql` (credentials omitted, 10 s deadline, 256 KiB limit, one request, no retries;
429/401/403 pause all requests for 15 minutes, 5xx and network errors are reported once). The result is cached
in its own key (`leetcodeAssist.leetcodeProfile.v1`, with `fetchedAt`); refresh happens at most once an hour
automatically or with the *Refresh* button (at most once a minute). The Calendar page shows a *LeetCode streak*
card computed locally from `submissionCalendar` over **UTC days**: current streak (ending today, or yesterday
when today is still empty), longest streak in the returned data, active days this year, a 16-week heat grid,
a link to the profile, *Updated N min ago*, error states and a *Set your username in Settings* empty state.
Username and detection preference live in the key `leetcodeAssist.leetcodePrefs.v1`, not in `Settings`, so
the stored `AppState` format is unchanged; the JSON export only carries the username and the two detection switches in the
optional `leetcodeSettings` section (never events or the streak cache). *Reset all data* also clears the three LeetCode keys.

**Timer colours.** `TimerBadge` shows the elapsed time of an open activity against the estimated minutes
shown on the card (`timerTone` in `src/lib/timerTone.ts`): green under 75 % (*on pace*), amber from 75 % up to
the budget (*near limit*), red above it (*over budget*), neutral while paused. Colours meet 4.5:1 contrast in the
light and dark themes and every state also has an icon and text. For `new` activities two subtle cues show the
help ladder at 15 min (*consider a hint*) and 35 min (*read the solution, then re-code it*).

## 6b. Catalogs: Blind 75 and Premium problems

`CatalogId = 'neetcode150' | 'blind75'` (`src/core/catalog.ts`). The **Blind 75** list (`BLIND_75`,
`src/data/blind75.ts`) stores slugs only: the 75 problems flagged `blind75` in NeetCode's public problem
metadata (source URL and revision in the file header). It is NeetCode's version of the list (for example it has
*Combination Sum*, not *Combination Sum IV*, and no *Min Stack*), not Grind 75. Every Blind 75 problem is also
in the NeetCode 150, which supplies title, difficulty and category, so Blind 75 is a **subset**: counts are
never added (150 + 75), and both catalogs use the same stored state.

**Premium** problems (`PREMIUM_PROBLEMS`, `src/data/premium.ts`: six in the Blind 75 plus *Walls and Gates*)
stay in the catalogs and only get a *Premium* label. The planner never schedules them: the program queue,
benchmarks and bonus pool contain none (the Premium-only Easy *Meeting Rooms* is left out of the program).

The provenance is not live-verified by this extension (it ships a static copy); the completeness of the list
rests on that one source.

## 6c. Roadmap All and editorial enrichment

**All** renders the selected catalog's 150 or 75 problems in existing category/problem order, with all
category disclosures initially expanded. Categories can be collapsed without changing progress. Tree and
Grid keep their existing compact row behavior. Catalog changes reset tree selection and All's local
filters/disclosures. Leaving All also discards live filters; named **saved filters** (section 6d) are the only persisted filter state and
no adaptive expansion exists.

All's **Compact | Detailed** control persists `settings.roadmapDetail`; Detailed adds data-structure and
technique tags and qualified company badges. `settings.roadmapHideTechniques` removes those tags and
clears/disables both tag filters (including their option values). These settings are optional; missing values
mean Compact and hints visible. The storage version remains 1. Old schema-1 backups import unchanged;
this does not promise that old released clients can read a newly exported `roadmapView: 'all'` value.

Filters combine conjunctively: trimmed case-insensitive title substring, category, difficulty, derived learning
status, Free/Premium, program membership, technique, data structure and sourced company. Program includes
the fixed queue and benchmarks; Bonus is the existing pool; Outside excludes both groups. The company
filter offers every company that has evidence (currently eight, see below). **Clear filters** resets all local filters.
**Showing N of 150/75** is the match count; an empty intersection has an explicit empty state. Both catalog
counters, shared checkbox/status semantics and scheduling remain independent of these presentation filters.

Static registries cover all 150 with individually authored tags and 437 directional similar-question links
(1–3 per problem). Each link has a supported relation (`same-pattern`, `prerequisite`, `next-challenge`,
`useful-contrast`) and original rationale; these are editor-curated, **not official LeetCode similar questions**.
They expose target difficulty, user learning/check progress, and sheet/LeetCode links. Targets can be outside
Blind 75 but remain within the 150; following a link never schedules work. No mastery score or automatic
queue/budget/review changes are introduced. Runtime enrichment needs no network/API or new permission.

The shared **Explore metadata and similar questions (contains technique hints)** disclosure on the sheet and
side panel contains tags, company provenance and similar links. It starts closed for due/overdue/in-progress
reviews using the existing notes-lock rule, or with hide-hints enabled; the side panel always starts closed.
Slug/review-lock transitions reset disclosure state. Closed disclosures do not mount tags or recommendation
rationales; explicit expansion reveals them. Existing hints, notes, forms, timers, Accepted auto-Finish and
detection visibility are unchanged; browsing metadata is not recorded as an activity hint.

Company definitions cover Google, Amazon, Microsoft, Meta, Apple, Shopify, Stripe, Uber, Bloomberg,
Datadog, Snowflake and NVIDIA, but **definitions do not imply evidence**. Evidence is a static registry
(`src/data/companies.ts`) of **66 source-backed rows / 65 distinct company–problem pairs** from public candidate
self-reports (46 exact-topic mappings, 19 qualified related variants; the earlier Amazon LRU Cache variation is
retained as its own source). "Exact" means the narrative names or clearly describes the canonical topic, not that the
employer confirmed it; a variant is expressly not a verified canonical question. Distinct documented problems per
company: Amazon 14 (10 exact), Meta 9 (7), NVIDIA 9 (6; systems/firmware contexts), Apple 8 (7), Bloomberg 8 (6; one row, an LRU Cache design discussion with no coding reported, is evidence only and is excluded from mock interviews and the threshold, leaving 7),
Google 6 (1; variant-heavy), Microsoft 6 (5), Uber 5 (4); Shopify, Stripe, Datadog and Snowflake have none. Every other
pair is unknown/not documented, never “not asked”. Rows are typed with qualification, mapping confidence, source
title/URL, integration snapshot (2026-10-23, not a fresh verification), known publication date with its basis, partial
interview period and host caveats; unknown dates stay unknown. No frequency, probability or hiring claim is made, no
no remote logo is fetched (bundled marks for eleven companies (CC0 Simple Icons/gilbarbara, Amazon CC BY 4.0 credited in third-party.md), monogram for Bloomberg; marks remain owners' trademarks), and no report bodies, premium-derived datasets, solutions or
editorials are copied. Full provenance, rejected sources and limitations: [`roadmap-metadata.md`](roadmap-metadata.md).

## 6d. Presentation features: favorites, saved filters, heatmap, Markdown export

All are optional, presentation-only and independent of solved checks, progress, scheduling and the fixed program.

- **Favorites** (`favorites[slug]`): a star on every Roadmap row/layout and on the problem sheet, plus *Favorites only*
  in All. `false` is an explicit unstar retained so sync can propagate it.
- **Saved All filters** (`savedRoadmapFilters[uuid] = { name, filters }`, name 1–80 characters, duplicates allowed): save,
  apply, rename, delete. A preset applies to the **currently selected catalog**; unavailable category/tag/company
  values are cleared on apply, and while *Hide techniques* is on technique/structure constraints are neither applied
  nor saved. Switching catalogs still clears the live filters.
- **Activity heatmap**: Logs card, see section 6. **Notes export**: Settings → Your data → *Export all notes (.md)*
  with title, category, difficulty and all note fields (code fenced dynamically so backticks cannot close it); not offered
  when no notes exist.
- **Side-panel Focus mode**: section 6, surface 2.

## 6e. Optional practice (`#/practice`)

Voluntary and separate from the program and the older extra/bonus Activity flow. Full rules and exact field schemas:
[`optional-practice.md`](optional-practice.md).

- **Isolation (invariant):** simulations and drills never create or update Activities, scheduled reviews, problem status,
  solved checks, notes, budgets or timers, and never change program counts, pace, worked totals, logged minutes, heatmaps,
  calendar, reminders, streak or the weekly review (which does not show them even separately). Records appear only in
  Practice history and JSON backups; the one deliberate exception is the Logs **Pace by month** chart, which may overlay
  saved simulation durations as a separate, labelled series (never added to logged minutes or any total). There is no network/API dependency; Accepted detection does not finish or score a
  simulation.
- **Interview simulation:** global pool = worked problems (in-progress/done Activity, learned status or solved check) unless
  unworked problems are explicitly included with a warning; category/difficulty filters; 25/35/45-minute timestamp-derived
  countdown; eight-step checklist; self-rating (`solved|partial|not`) and a reflection of at most 1000 characters saved
  together as an immutable `SimulationRecord`. No tags, similar questions, notes, hints or per-problem company evidence
  are mounted during a session; expiry does not auto-save. Unfinished sessions live in React state only; the UI warns
  before leaving, and the navigation bar asks for confirmation before leaving with an active session.
- **Company interviews:** enabled only with ≥ **5 distinct documented slugs** (exact and qualified variants count, each
  slug once): Google, Amazon, Microsoft, Meta, Apple, Uber, Bloomberg, NVIDIA; the other four show *Not enough documented
  data*. Draws use documented slugs only (editorial sampling weight 3 for exact, 1 for variant-only; not a frequency),
  with no similar-pattern fallback. Setup discloses that reports are uncorroborated, may be mirrored, and may not
  generalize across roles.
- **Two-problem session:** two different problems from the same pool back to back, a per-problem timer with a visible
  45-minute reminder banner, an optional skippable 5-minute break, checklist and self-rating per problem, and a final
  summary saved as two linked simulation records (optional `sessionId`/`part`, merged by record ID).
- **Interview prep:** an optional `interviewPrep` value (company + date up to 365 days ahead) with a read-only summary:
  days left, the company's documented problems with your status, untouched/slowest/fragile ones and the reviews
  already scheduled before the date. It never schedules or changes anything; sync merges it as one whole value.
- **Pattern drills:** original prompt, correct pseudo-code outline, two plausible wrong outlines and explanations for all
  50 program problems (`src/data/drills.ts`); technique/structure questions use the normalized tag vocabularies and never
  offer a registered, curated also-valid, closely related or generic tag as a wrong answer (`src/data/drillAmbiguity.ts`);
  unworked problems get only generic tag-level feedback (no outline rationale); outline lengths are balanced. Worked-only
  by default; unworked technique/structure needs a warning toggle; outline questions always require prior work; *Hide
  techniques* disables drills until a local checkbox enables them. Sessions ask up to 5/10/20 unique slug/kind questions
  (shorter for small pools), freeze the first answer and save a `DrillSessionRecord` score.
- **Storage:** `simulations` and `drillSessions` are ID-keyed whole immutable records; saves append through the serialized
  store and reject an existing ID; no local edit/delete.

## 6f. Optional sync (`chrome.storage.sync`) and fixed extension ID

Details, quotas and honest limits: [`sync.md`](sync.md).

- **Fixed ID:** `wxt.config.ts` sets the manifest `key` to a public RSA-2048 SPKI key, giving every unpacked install the ID
  `ghpljfdplcicmcfoemfifmmibbdjcmja`. No private key is stored or committed. This changes the ID of installs made before
  it; the **one-time migration** is export JSON → update/build → remove the old unpacked extension → Load unpacked →
  import JSON (README → Install, CHANGELOG).
- **Requirements:** same Google account, Chrome sync enabled for extensions, same extension ID on every computer. Off by
  default; manual JSON export/import is unaffected.
- **Transport:** background-owned (Web Lock shared with store commands). The snapshot is gzip → base64 → 7000-character
  chunks `lca.sync.chunk.<generation>.<n>` plus manifest `lca.sync.manifest.v1` (generation, count, SHA-256, device, time).
  A writer stages a whole new generation, re-checks the manifest, switches it and then removes the old one; readers follow
  the manifest only and reject partial/corrupt/invalid data. Limits honoured: 102400 bytes total (old and new generation
  during a switch), 8192 per item, 512 items, ≤ 120 writes/minute and 1800/hour (debounce ≈ 20 s, uploads ≥ 30 s apart,
  1-minute poll alarm). Data that does not fit **pauses** sync with a message.
- **Merge:** deterministic three-way merge against the last synced snapshot (`src/core/syncMerge.ts`); records are
  activities (with correction audit) by id, notes by slug, `checked`/`problemStatus`/`favorites` by slug, saved filters,
  simulations and drill sessions by id, each `settings` field, and `queue` whole. One-side change wins; both sides
  different = **conflict** (local kept, other copy untouched, others keep merging). Rules: another device's running timer
  is deferred, a local running timer changed remotely is a conflict, untouched generated activities never conflict with
  worked ones, an untouched first-run device adopts the cloud copy whole, and invalid merged settings become conflicts.
- **UI:** Settings → Sync (enable, device name, status, usage, errors, *Sync now*, *Replace cloud copy*), a dashboard banner
  while conflicts/errors exist, a conflict list with plain-language versions and per-record/keep-all choices.
- **Backups:** last three pre-merge snapshots (≤ 4 MiB), local only, restorable with confirmation; a merge is not applied
  if its backup cannot be stored. Import is a local change set; reset clears only this device.
- **Local-only keys:** detection/LeetCode keys, sync config/status/base/conflicts/backups, device name. Notes and code
  snippets do go to Chrome sync when enabled.
- **Concurrent uploads:** a device stores its published generation and the pre-upload base (`lca.sync.own.v1`); a cloud copy
  that is neither that generation nor a descendant (manifest `lineage`) is merged against the pre-upload base, so an
  overwritten upload is merged, not deleted. *Replace cloud copy* is limited to an unreadable copy or quota pause, re-reads
  first and backs up a readable copy; failed uploads remove their staged chunks and each publish removes leaked chunks;
  JSON import saves a local backup first when sync is on. The JSON export does not contain detection/LeetCode/sync-config
  data, which must be re-set after the ID migration.
- **Limits:** last-writer-wins storage; real cross-device behaviour is untested by automation (mock quotas only).

## 7. Out of scope for v1

Automatically saving/completing an activity from a detected "Accepted" (detection opens a confirmation form, section 6a), accounts and servers of our own (optional Chrome-managed sync, section 6f, is the only cross-device path), copying NeetCode/LeetCode
explanations or solutions (only facts: title, difficulty, category, link).
