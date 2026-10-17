# LeetCode Assist

A Chrome extension (Manifest V3) that runs a **30-day LeetCode bootcamp** on the
**NeetCode 150** roadmap. Open it and it tells you exactly what to do today: new problems,
spaced reviews and how long each should take. It reminds you with notifications, sits next to
LeetCode in a side panel, and tracks progress, timing and notes. Everything stays in your
browser (`chrome.storage.local`); there are no accounts and no servers.

See [docs/SPEC.md](docs/SPEC.md) for the full product and technical spec.

> Not affiliated with, endorsed by or sponsored by LeetCode or NeetCode. The extension bundles
> only facts about problems (title, difficulty, category, link) and never copies explanations
> or solutions.

## Screenshots

_Screenshots will be added here._

| Dashboard (Today) | Calendar | Roadmap | Side panel |
|---|---|---|---|
| _placeholder_ | _placeholder_ | _placeholder_ | _placeholder_ |

## The method

### Goal

Measured on **unseen** problems on day 30:

- **Easy:** solved alone in ≤ 20 min in at least 80 % of attempts.
- **Medium:** approach found in ≤ 15 min and accepted in ≤ 45 min in at least 60 % of attempts.

Three timed **benchmarks** (1 Easy + 1 Medium, unseen, 60 min budget) on days **1, 15 and 30**
measure progress. Benchmark problems are reserved and never appear in the learning queue.

### Daily budget

- Default target **150 min**, hard planning cap **180 min** (both configurable in Settings).
- **Consolidation days 7, 14, 21 and 28**: no new problems, target **90 min** (reviews, failed
  items and "blind" mixed practice).
- A normal day has **2 new problems**, plus a third when the next one is an Easy and the day stays within
  the cap + 30 min (soft overflow). Besides them (also on consolidation days and after day 30) **two
  optional bonus problems** are always on offer. They are outside the core plan time, pace, reminders and
  the toolbar badge, never become debt, and stay on offer even when the core plan already fills the cap:
  each card shows how much time it adds and warns when that passes your target or the cap.
- The bonuses come from a separate **bonus pool** of 46 extra NeetCode 150 problems outside the
  50-problem program (Tries, Math & Geometry, 2-D DP, Bit Manipulation, Linked List, Sliding Window and the
  Mediums that did not fit the 30 days), in a fixed order with hints. The two offers are stored, so they
  survive reloads and days, and a started one keeps its timer. Finishing or skipping one refills the slot
  at once. A problem is only offered when its category is ready (something of it was already worked or is in
  today's plan, or all its prerequisite categories were introduced), so Graphs or DP stay locked until
  Backtracking is worked; the card explains when fewer than two can be offered. Finishing one starts the
  normal review cycle (day +1/3/7/21) and counts as worked in the roadmap, but it does **not** count toward
  your pace or the program counter, and it never uses up the program queue. Its four reviews are real core
  work, though: finishing many bonus problems fills later days' cap with reviews, which can leave less room
  for new program problems. A skipped bonus is dated to the day it was skipped.
- **Problems worked** (Today and Calendar): the number of distinct problems with at least one finished
  attempt, split into *Program x/50 · Benchmarks x/6 · Bonus x* (*Other* appears only when needed). Each
  problem counts once: reviews never add to it and a bonus never replaces a program problem. The program
  counter *x/50* is separate.
- New problems come from an ordered queue (50 problems in NeetCode roadmap order, **every free Easy
  problem**, no Hard), not
  from fixed dates, so a missed day never produces an impossible day. Reviews are never dropped:
  what does not fit under the cap is carried over to the next days.

### Review cycle

Every activity ends with an outcome: **solo**, **hint**, **solution** or **stuck**. Review dates
are counted from the day the `new` activity was actually completed.

| Type | When | What to do | Budget Easy / Medium / Hard (min) |
|---|---|---|---:|
| `new` | from the queue | Search, code, understand, write notes. Hint at 15–20 min without an approach; read the solution at 35–45 min, then re-code it from memory. | 25 / 40 / 50 |
| `recall` | done + 1 day | Without notes: state the approach, why it works, time and space complexity. | 5 / 8 / 10 |
| `rebuild` | done + 3 days | Rebuild the algorithm in pseudocode or code, check edge cases. | 10 / 15 / 18 |
| `resolve` | done + 7 days | Solve from a blank editor: no hints, no old solution. | 15 / 25 / 30 |
| `blind` | done + 21 days | Solve with the category hidden. Solved alone means **mastered**. | 15 / 20 / 25 |
| `retry` | the day after a failed review | Targeted redo. | 10 / 15 / 18 |
| `benchmark` | days 1, 15, 30 | Timed, unseen Easy + Medium. | 30 per problem (60) |

Budgets depend on the problem's difficulty. These are the defaults; you can change every cell in
**Settings → Time budgets** (whole minutes, 1–180, with a *Reset to defaults* button). The plan, the
calendar, the reminders and the cards all follow your values.

A failed `recall` or `rebuild` (solution/stuck) schedules a `retry` for the next day. A
`resolve` that is not solved alone puts the problem back to *consolidating* and schedules a new
rebuild and resolve. A `blind` solved alone makes the problem *mastered*. At most one review per
problem is planned on a day (the strongest wins). Reviews continue after day 30.

Notes are hidden while a review of the same problem is in progress or due; click **Reveal** if
you really need them.

### Moving, postponing and hints

- **Move…** (Today cards and the Calendar day detail) reschedules a planned review to a day from
  today up to 60 days ahead. Only the due date changes; the history stays.
- **Postpone** replaces *Skip* for new problems: the problem moves back in the queue behind the next
  two and comes back later. It is never removed from the program.
- **Hints**: every program, benchmark and bonus problem has three progressive hints (nudge, insight, sketch). Reveal them one
  at a time in the side panel or on the problem sheet; they are recorded on the attempt, shown in the
  attempt history, and pre-select **Hint** in the outcome form (you can still change it).

## Using it

- **Toolbar icon** opens (or focuses) the dashboard.
- **Dashboard** views: *Today* (plan, timers, outcome form, pace, streak, the problems-worked total and the
  two optional bonus offers), *Calendar* (a compact summary row with the overview (streak, *Plan done* days
  (80%+ of a day's plan finished), time logged, program progress, problems worked) next to the LeetCode
  streak card, then days 1–30 plus later review days with a minutes bar, a hover/focus popover per day with
  a *projected* plan for future days, `Move…`), *Roadmap* (a **NeetCode 150 | Blind 75** selector and a
  prerequisite **tree** or **grid**, with progress counters for both catalogs and checkboxes), *Problem sheet* (notes, hints, attempt history,
  next review), *Logs* (a filterable table of every completed or skipped activity with time against
  budget, a summary row and CSV export) and *Settings*.
- **Side panel**: one global panel per window that stays open across tabs. On a leetcode.com problem
  page it shows the problem (difficulty, category, program position), today's activity with its
  instruction and timer, hints, the outcome form, notes, attempt history and the next review date. On
  any other page it shows **Open a LeetCode problem** and today's checklist with an **Open** button per
  item. Open it from the dashboard's **Open side panel** button, by clicking a LeetCode link in the
  dashboard, or with the shortcut **Alt+Shift+L** (change it at `chrome://extensions/shortcuts`).
- **Notifications and badge**: a morning summary (for example
  `Today: 2 new, 2 recalls, 1 rebuild · ~2h20`) and an evening reminder if the daily target is
  not met, at the times set in Settings. The toolbar badge shows the activities left today.

## Install

You need npm and Node.js 22.22.2+ or 24.15+ (the version the dev dependency jsdom 30 requires for the test
suite). Checks and the build were run here on Node 24.19 only; older versions were not tried.

```bash
npm install
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `.output/chrome-mv3` folder.
4. Pin the extension and click its icon to start.

## Development

```bash
npm run dev        # WXT dev mode with hot reload (opens Chrome with the extension)
npm run build      # production build in .output/chrome-mv3
npm run zip        # store-ready zip
npm run icons      # regenerate public/icon/*.png (scripts/generate-icons.mjs)
npm run typecheck  # tsc --noEmit
```

Built with [WXT](https://wxt.dev), React and TypeScript (strict).

### Tests

```bash
npm test           # Vitest unit tests
```

The planner, review cycle, calendar and reminders are pure TypeScript without browser APIs and
are covered by unit tests; storage and the background worker are tested against an in-memory
`chrome.storage` and fake alarms; the views have server-render smoke tests plus a few jsdom tests
(`*.dom.test.tsx`, Testing Library) that click through Today, the Calendar summary and the Roadmap
catalog selector. jsdom has no layout engine, so these tests check structure and behaviour, not how the
page looks; a stylesheet test only guards the layout rules (see the CHANGELOG for how layout was checked).

### Layout

- `src/core/` – pure TypeScript (no browser APIs): types, dates, timer, review cycle, planner,
  projection, queue, calendar, roadmap tree layout, state, logs.
- `src/data/` – static NeetCode 150 list, roadmap categories, the 30-day program (queue,
  benchmarks), the bonus pool and the three-level hints.
- `src/lib/` – storage, commands and actions, reminders and background tasks, URL and side panel
  helpers.
- `src/components/` – shared React components.
- `src/dashboard/`, `src/sidepanel/` – the two UIs.
- `src/entrypoints/` – WXT entrypoints (dashboard, side panel, background worker).
- `scripts/` – icon generator.

## Catalogs and Blind 75

The Roadmap can be filtered by **NeetCode 150** or **Blind 75**. The Blind 75 is a subset: its 75 problems
are also among the 150, so switching only changes what the page shows. It adds nothing (not 150 + 75),
resets nothing and does not change your plan, and both catalogs share the same statuses and checkboxes.
Both counters are always shown, for example *NeetCode 150 12/150 · Blind 75 7/75*. The list is the
`blind75` flag of NeetCode's public problem metadata (source URL and revision in `src/data/blind75.ts`),
which is NeetCode's version of the list. Problems that need LeetCode Premium (6 in the Blind 75, 7 in the
NeetCode 150) are labelled **Premium** and are never scheduled; solving them needs a Premium account.
The choice is stored in the optional `settings.roadmapCatalog`.

## LeetCode features and privacy

- **Accepted detection (optional, on by default):** when you submit on leetcode.com the side panel can
  notice "Accepted" and offer to finish the matching activity. You always confirm the outcome. Turn it
  off or clear the detected events in **Settings → LeetCode detection**. The observer reads only the
  verdict, language, problem and time of your own submissions: never your code, cookies or headers.
- **LeetCode streak:** add your LeetCode username in **Settings** to see your submission streak and a
  compact 16-week heat grid (with Refresh, your username and the data age) next to the Calendar overview. It makes one anonymous request to leetcode.com per refresh
  (at most hourly) and only reads your public profile calendar.
- **Coloured timers:** green, amber ("near limit") and red ("over budget") against the budget on the
  card, plus help-ladder cues at 15 and 35 minutes on new problems.
- Both LeetCode features rely on endpoints that are not publicly documented. They are inferred and
  **not live-verified**; see [`docs/leetcode-api.md`](docs/leetcode-api.md). If nothing is detected,
  everything still works manually. No new permissions are used and the content scripts run on
  `https://leetcode.com/problems/*` only. *Reset all data* clears these keys.

## Your data and backups

All data lives in `chrome.storage.local` under one versioned key. **Settings → Your data**
exports a JSON backup, restores one (validated before anything is replaced) or resets
everything. Uninstalling the extension deletes the data, so export a backup first. If the stored
data ever fails validation, the dashboard shows an error screen and leaves it untouched until you
reset or import.

## Notifications on Windows

Chrome can only fire alarms and notifications while it is running. On Windows, open Chrome
**Settings → System** and turn on **Continue running background apps when Google Chrome is
closed**, otherwise closing the last window stops the reminders. Also check that Windows
notifications (and Focus assist / Do not disturb) allow Chrome to show them. A reminder that
fires late (for example after waking the computer) is only shown if it is still the same day.

## License

[MIT](LICENSE). LeetCode and NeetCode are trademarks of their respective owners.
