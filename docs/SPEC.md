# LeetCode Assist — Product & Technical Spec (v1, extension 0.2)

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
- Normal day: 2 new problems; a 3rd is offered as **bonus** only if planned time stays ≤ cap.
  A bonus never becomes debt.

## 3. Activity types & review cycle

| Type | When | Instruction | Budget |
|---|---|---|---:|
| `new` | queue | Search, code, understand, write notes. Help ladder: hint at 15–20 min without an approach, read the solution at 35–45 min then **re-code it from memory**. | Easy 25 / Medium 40 |
| `recall` | done + 1 day | Without notes: state the approach, why it works, time/space complexity. | 5 |
| `rebuild` | done + 3 days | Rebuild the algorithm in pseudocode or code, check edge cases. | 10 |
| `resolve` | done + 7 days | Solve from a blank editor, no hints, no old solution. | 20 |
| `blind` | done + 21 days | Solve with the category hidden. Solved alone ⇒ **mastered**. | 15 |
| `retry` | next day after a failure | Targeted redo of a failed review. | 15 |
| `benchmark` | days 1, 15, 30 | Timed unseen Easy + Medium. | 60 |

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
  (today or later). Only the `dueDate` of the planned review changes; its type and the history stay.
  If the problem already has a planned review on that day the stronger one is kept and the weaker one
  is marked skipped (merge rule). Started or finished activities, benchmarks and optional practice
  cannot be moved.
- **Postpone a `new` problem** (replaces the destructive *Skip*): the activity is marked `skipped` with
  `postponed: true` (kept in history) and the problem moves back in the queue behind the **next two**
  unfinished problems (`AppState.queue` stores the new order). It is planned again later and never
  leaves the program. A plain skip (benchmarks, optional practice) still drops the item.
- Stopping a *started* review keeps the old behaviour: it is marked skipped and planned again tomorrow.

### Hints

Every program and benchmark problem has three progressive hints (`src/data/hints.ts`): **nudge**
(technique family), **insight** (key observation) and **sketch** (algorithm outline with complexity;
no code). Revealing hint *n* stores `hintsUsed = max(hintsUsed, n)` on the open activity. When the
outcome form opens for an activity with `hintsUsed > 0` it pre-selects **Hint** and explains why; the
user can still pick another outcome. Hints used are shown in the attempt history.

Problem status: `untouched` → `learning` (new done) → `consolidating` (a review failed) →
`reviewed` (resolve solo) → `mastered` (blind solo).

## 4. Queue-based planner (no fixed dates for new problems)

- New problems come from an **ordered queue** (~50 problems, NeetCode roadmap order,
  mostly Easy/Medium, ≤ 2 Hard near the end). Queue = `src/data/program.ts`.
- Planner for a day (pure function `planDay(state, date, settings)`):
  1. Overdue + due reviews, sorted by priority: `retry`, `recall`, `rebuild`, `resolve`, `blind`;
     overdue first. Reviews never get dropped; if they exceed the cap, the remainder is
     shown as "carried over" and spread forward (max cap per day).
  2. Benchmark if it's day 1/15/30.
  3. Fill remaining budget with the next queue items (2 normally, 0 on consolidation days,
     fewer if reviews fill the budget). Optional bonus 3rd.
  4. **Pace indicator**: `actualNewDone - expectedNewDone(dayIndex)` ("+2 ahead" / "−1 behind").
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
  roadmapView?: 'tree'|'grid' }   // absent = 'tree'
interface AppState { version: 1; settings: Settings; activities: Activity[];
  notes: Record<string, Note>; problemStatus: Record<string, ProblemStatus>; checked: Record<string, boolean>;
  queue?: string[] }               // saved queue order after postponing; absent = PROGRAM_QUEUE
```

`hintsUsed`, `postponed`, `roadmapView` and `queue` are optional and additive: data saved by 0.1 stays
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
   - **Calendar**: an overall progress header (program problems learned *x*/53 and days elapsed
     *d*/30), start date picker, days 1–30 (+ overflow), planned/done/carried counts and minutes per
     day with a small minutes bar per cell, streak (≥ 1 activity done and ≥ 30 min logged) separate
     from "daily goal met". **Hovering or focusing** a day opens a popover (not a `title`) listing its
     activities (type, problem, estimated minutes, total); Escape closes it. For **future** days the
     popover is a **projection** labelled *projected*: the pure planner is run day by day from today,
     assuming every planned activity is done solo on budget and nothing else changes
     (`projectDay` in `src/core/projection.ts`). The day detail has `Move…` for planned reviews and
     `Postpone` for today's new problems.
   - **Roadmap**: a **Tree | Grid** toggle (stored in `settings.roadmapView`, default Tree). *Tree*
     draws the NeetCode prerequisite graph left to right (one column per tier, SVG arrows, scrollable);
     each node shows worked/total, solo in review, consolidating and Easy/Medium/Hard counters, and
     selecting a node lists its problems below (checkbox, status pill, program/benchmark badges,
     LeetCode link). *Grid* is the earlier card layout: per category "worked / solo in review /
     consolidating", Easy/Medium/Hard counters (x/150), check boxes, program items badged.
   - **Problem sheet**: program position, notes (Trigger, Principle, Pitfall, Complexity, Python
     snippet), hints, attempt history (type, duration, approach time, hints used, outcome), next review.
     During review activities notes are **hidden until the user clicks "Reveal"**.
   - **Settings**: start date, budgets, notification times, export/import/reset.
2. **Side panel** (`chrome.sidePanel`): one **global** panel per window. The service worker calls
   `setOptions({ path, enabled: true })` once (no per-tab enabling), so the panel stays open while
   the user switches or opens tabs and follows the active tab's URL.
   - On a LeetCode problem page (`/problems/<slug>/`): title, difficulty, category, program position
     (*n*/53), status, next review, today's activity with its instruction, timer and outcome form (or
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

Permissions: `storage`, `alarms`, `notifications`, `sidePanel`, `tabs`; host `https://leetcode.com/*`.

## 7. Out of scope for v1

Auto-detecting "Accepted" on LeetCode, accounts, sync, copying NeetCode/LeetCode
explanations or solutions (only facts: title, difficulty, category, link).
