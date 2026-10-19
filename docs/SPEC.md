# LeetCode Assist — Product & Technical Spec (v1, extension 0.6)

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
  approachMs?: number; totalMs?: number; outcome?: Outcome; completedAt?: string; createdAt: string;
  extra?: boolean;      // optional practice, never debt
  hintsUsed?: number;   // 1-3: hints revealed during the attempt (additive, absent = none)
  postponed?: boolean } // skipped `new` that was moved back in the queue
interface Note { slug: string; trigger: string /*"Click"*/; principle: string; pitfall: string;
  complexity: string; code?: string; updatedAt: string }
interface Settings { startDate: string; dailyTargetMin: number; dailyCapMin: number;
  morningNotify: string /*"08:30"*/; eveningNotify: string /*"20:00"*/; language: 'python';
  roadmapView?: 'tree'|'grid';    // absent = 'tree'
  roadmapCatalog?: 'neetcode150'|'blind75';  // absent = 'neetcode150'
  budgets?: BudgetOverrides }     // partial minutes per type and difficulty; absent = defaults
type BudgetOverrides = { [T in Exclude<ActivityType,'benchmark'>]?: Partial<Record<Difficulty, number>> }
interface AppState { version: 1; settings: Settings; activities: Activity[];
  notes: Record<string, Note>; problemStatus: Record<string, ProblemStatus>; checked: Record<string, boolean>;
  queue?: string[] }               // saved queue order after postponing; absent = PROGRAM_QUEUE
```

`hintsUsed`, `postponed`, `roadmapView`, `roadmapCatalog`, `budgets` and `queue` are optional and additive: data saved by 0.1 stays
valid, so `version` remains `1`.

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
     days.
   - **Roadmap**: a **NeetCode 150 | Blind 75** catalog selector (stored in `settings.roadmapCatalog`, default
     NeetCode 150) and a **Tree | Grid** toggle (`settings.roadmapView`, default Tree), independent of each other.
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
     are pure helpers in `src/core/logs.ts`.
   - **Problem sheet**: program position, notes (Trigger, Principle, Pitfall, Complexity, Python
     snippet), hints, attempt history (type, duration, approach time, hints used, outcome), next review.
     During review activities notes are **hidden until the user clicks "Reveal"**.
   - **Settings**: start date, daily target and cap, notification times, a compact **time budgets** table
     (rows = activity types, columns = Easy / Medium / Hard, *Reset to defaults*), export/import/reset.
2. **Side panel** (`chrome.sidePanel`): one **global** panel per window. The service worker calls
   `setOptions({ path, enabled: true })` once (no per-tab enabling), so the panel stays open while
   the user switches or opens tabs and follows the active tab's URL.
   - On a LeetCode problem page (`/problems/<slug>/`): title, difficulty, category, program position
     (*n*/*N* with *N* the queue length, or *Bonus problem*), status, next review, today's activity with its instruction, timer and outcome form, for either bonus offer too (or
     an offer to start extra practice; for a pool problem that is not on offer it says the practice is optional and outside the core plan time), **hints** (three progressive *Reveal hint 1/2/3* buttons),
     notes (hidden during reviews until *Reveal*) and the attempt history including hints used.
   - On any other page: an **Open a LeetCode problem** state with today's checklist (core items, the up-to-two
     optional bonus offers marked *Optional bonus*, carried-over reviews); each item has an
     **Open** button that navigates the active tab (when it is a LeetCode or empty tab) or opens a new
     tab.
   - Opening: the dashboard's *Open side panel* button, the shortcut **Alt+Shift+L**, and clicking a
     LeetCode problem link in the dashboard (which also calls `chrome.sidePanel.open({ windowId })`
     in the same click handler, best effort).
3. **Background service worker**: `chrome.alarms` for the morning summary notification
   ("Today: 2 new, 2 recalls, 1 rebuild · ~2h20") and the evening reminder if the day's
   target is not met; toolbar **badge** = remaining activities today; clicking a
   notification opens the dashboard.

Permissions: `storage`, `alarms`, `notifications`, `sidePanel`, `tabs`; host `https://leetcode.com/*`. The two content
scripts of the LeetCode features (section 6a) are declared for `https://leetcode.com/problems/*` only.

## 6a. LeetCode features: accepted detection, submission streak, timer colours

The API contract behind the first two is documented, with its confidence level, in `docs/leetcode-api.md`.

**Accepted detection (passive).** A content script in the page's own (MAIN) world on `leetcode.com/problems/*`
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
  *Finish this activity…* button. This advisory uses the latest Accepted since local midnight, not a persisted
  first-start timestamp (the activity schema is unchanged). A closed side panel cannot automatically open a
  form or stop a timer; reopening it after a verdict uses the manual button instead.
- Settings, *LeetCode detection*: on/off (default on; when off, events are dropped by the worker and none are
  stored), diagnostics (submissions seen, results seen, Accepted count, last `status_msg` values, last event
  time, no bodies), *Clear detected events* and a plain-language privacy note. With nothing detected, every
  activity is finished by hand exactly as before.

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
the stored `AppState` format and JSON export are unchanged. *Reset all data* also clears the three LeetCode keys.

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

## 7. Out of scope for v1

Automatically saving/completing an activity from a detected "Accepted" (detection opens a confirmation form, section 6a), accounts, sync, copying NeetCode/LeetCode
explanations or solutions (only facts: title, difficulty, category, link).
