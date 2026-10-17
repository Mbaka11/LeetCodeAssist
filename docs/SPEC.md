# LeetCode Assist — Product & Technical Spec (v1, extension 0.5)

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
  `src/core/planner.ts`); reviews, the first two new problems and the bonus still respect the plain cap, so a
  day can reach at most cap + 30. An optional **bonus** is offered after them (also on consolidation days and
  after the queue is exhausted) only if planned time plus its estimate stays ≤ cap. A bonus never becomes debt.
- The bonus comes from the **bonus pool** (`BONUS_POOL`, `src/data/bonus.ts`): about 28 extra NeetCode 150
  problems that are not in the program queue or the benchmarks, ordered by roadmap category and
  difficulty, all Medium except one Hard (every free Easy problem is in the program). The Mediums that did not
  fit the queue come first in their category, so they are the first bonuses offered. It is the first pool problem that is not done, started or already
  planned today; a skipped one returns to the pool (it is not offered again the same day, first in line
  tomorrow). A completed bonus starts the normal review cycle (D+1/3/7/21) and counts as worked in the
  roadmap, but it **does not count toward pace** and not toward the *x*/*N* program counter (*N* = the queue length), and it never
  consumes the program queue.

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
     overflow, §2). A problem postponed today is not offered again today. Then the optional bonus from the
     bonus pool if it fits under the cap.
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
  budgets?: BudgetOverrides }     // partial minutes per type and difficulty; absent = defaults
type BudgetOverrides = { [T in Exclude<ActivityType,'benchmark'>]?: Partial<Record<Difficulty, number>> }
interface AppState { version: 1; settings: Settings; activities: Activity[];
  notes: Record<string, Note>; problemStatus: Record<string, ProblemStatus>; checked: Record<string, boolean>;
  queue?: string[] }               // saved queue order after postponing; absent = PROGRAM_QUEUE
```

`hintsUsed`, `postponed`, `roadmapView`, `budgets` and `queue` are optional and additive: data saved by 0.1 stays
valid, so `version` remains `1`.

The timer is derived from timestamps (`accumulatedMs + (now - startedAt)`), never from tick counting.
Dates are local calendar dates (YYYY-MM-DD) computed in the user's timezone.

## 6. Extension surfaces

Built with **WXT + React + TypeScript**, storage in `chrome.storage.local` (single `AppState`
key, versioned), JSON export/import from Settings.

1. **Dashboard** (full tab, opened from the toolbar icon): views
   - **Today**: planned vs logged time, ordered activity list, "Start next activity",
     per-activity instruction, timer (start/pause/resume, "approach found" button),
     outcome form, pace indicator, streak.
   - **Calendar**: an overall progress header (program problems learned *x*/*N* (*N* = queue length) and days elapsed
     *d*/30), start date picker, days 1–30 (+ overflow), planned/done/carried counts and minutes per
     day with a small minutes bar per cell, streak (≥ 1 activity done and ≥ 30 min logged) separate
     from **Plan done** (a past or current day whose *core* activities are ≥ 80% done: activities
     due that day that are not optional practice, the bonus or postponed; skipped ones count as not
     done; a day without core activities is neither done nor missed; the stats tile reads "*n* of *m*
     days" over the elapsed days that had core activities, and done days carry a *Plan done* badge),
     and a **Time logged** tile (total over the last 7 days, all-time total as hint). **Hovering or focusing** a day opens a popover (not a `title`) listing its
     activities (type, problem, estimated minutes, total); Escape closes it. For **future** days the
     popover is a **projection** labelled *projected*: the pure planner is run day by day from today,
     assuming every planned activity is done solo on budget and nothing else changes
     (`projectDay` in `src/core/projection.ts`). The day detail has `Move…` for planned reviews and
     `Postpone` for today's new problems.
   - **Roadmap**: a **Tree | Grid** toggle (stored in `settings.roadmapView`, default Tree). *Tree*
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
     (*n*/*N* with *N* the queue length, or *Bonus problem*), status, next review, today's activity with its instruction, timer and outcome form (or
     an offer to start extra practice), **hints** (three progressive *Reveal hint 1/2/3* buttons),
     notes (hidden during reviews until *Reveal*) and the attempt history including hints used.
   - On any other page: an **Open a LeetCode problem** state with today's checklist; each item has an
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
polling route (`/submissions/detail/<id>/check/`) it reads a bounded clone of the response and keeps only
`state`, `status_msg`, `lang` (and `status_runtime`/`status_memory` when present). It posts the event with
`window.postMessage` to an isolated content script, which validates origin and shape and relays it with
`chrome.runtime.sendMessage`; the background worker validates again, stamps its own receipt time and appends
it to a capped list (200 events, own storage key `leetcodeAssist.submissionEvents.v1`, written under a lock,
not part of `AppState`). Pure parsing and validation: `src/lib/leetcodeSubmissions.ts`.
- Side panel: when the current problem has an **in-progress** activity and an *Accepted* verdict was detected
  today, the card shows *Accepted at 23:14 (Python3) — finish this activity?* (the **latest** Accepted since local
  midnight) plus the number of failed verdicts since the previous Accepted. *Finish this activity…* opens the usual finish form with the logged time taken from the
  timer and **Solo** pre-selected only when `hintsUsed` is 0; the user always confirms. Nothing is ever
  completed automatically. A non-Python language adds a gentle note. (The activity model has no first-start
  timestamp, so "after the activity started" is approximated by "since local midnight today".)
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

## 7. Out of scope for v1

Automatically completing an activity from a detected "Accepted" (detection only offers a prompt, section 6a), accounts, sync, copying NeetCode/LeetCode
explanations or solutions (only facts: title, difficulty, category, link).
