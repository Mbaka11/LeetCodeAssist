# LeetCode Assist — Product & Technical Spec (v1)

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
  approachMs?: number; totalMs?: number; outcome?: Outcome; completedAt?: string; createdAt: string }
interface Note { slug: string; trigger: string /*"Click"*/; principle: string; pitfall: string;
  complexity: string; code?: string; updatedAt: string }
interface Settings { startDate: string; dailyTargetMin: number; dailyCapMin: number;
  morningNotify: string /*"08:30"*/; eveningNotify: string /*"20:00"*/; language: 'python' }
interface AppState { version: 1; settings: Settings; activities: Activity[];
  notes: Record<string, Note>; problemStatus: Record<string, ProblemStatus>; checked: Record<string, boolean> }
```

The timer is derived from timestamps (`accumulatedMs + (now - startedAt)`), never from tick counting.
Dates are local calendar dates (YYYY-MM-DD) computed in the user's timezone.

## 6. Extension surfaces

Built with **WXT + React + TypeScript**, storage in `chrome.storage.local` (single `AppState`
key, versioned), JSON export/import from Settings.

1. **Dashboard** (full tab, opened from the toolbar icon): views
   - **Today**: planned vs logged time, ordered activity list, "Start next activity",
     per-activity instruction, timer (start/pause/resume, "approach found" button),
     outcome form, pace indicator, streak.
   - **Calendar**: start date picker, days 1–30 (+ overflow), planned/done/carried counts
     and minutes per day, streak (≥ 1 activity done and ≥ 30 min logged) separate from
     "daily goal met".
   - **Roadmap**: NeetCode categories in roadmap order, per category
     "worked / solo in review / consolidating", Easy/Medium/Hard counters (x/150),
     check boxes, program items badged, link to LeetCode.
   - **Problem sheet**: notes (Trigger, Principle, Pitfall, Complexity, Python snippet),
     attempt history (type, duration, approach time, outcome), next review.
     During review activities notes are **hidden until the user clicks "Reveal"**.
   - **Settings**: start date, budgets, notification times, export/import/reset.
2. **Side panel** (`chrome.sidePanel`), enabled on `leetcode.com`: detects the slug from
   `/problems/<slug>/`, shows the matching activity of today (or offers to start one),
   timer, instruction, outcome form, notes (hidden during reviews).
3. **Background service worker**: `chrome.alarms` for the morning summary notification
   ("Today: 2 new, 2 recalls, 1 rebuild · ~2h20") and the evening reminder if the day's
   target is not met; toolbar **badge** = remaining activities today; clicking a
   notification opens the dashboard.

Permissions: `storage`, `alarms`, `notifications`, `sidePanel`, `tabs`; host `https://leetcode.com/*`.

## 7. Out of scope for v1

Auto-detecting "Accepted" on LeetCode, accounts, sync, copying NeetCode/LeetCode
explanations or solutions (only facts: title, difficulty, category, link).
