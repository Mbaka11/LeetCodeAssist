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
- A normal day has **2 new problems**; a 3rd is offered as an optional **bonus** only if the plan
  stays under the cap. A bonus never becomes debt.
- New problems come from an ordered queue (about 50 problems in NeetCode roadmap order), not
  from fixed dates, so a missed day never produces an impossible day. Reviews are never dropped:
  what does not fit under the cap is carried over to the next days.

### Review cycle

Every activity ends with an outcome: **solo**, **hint**, **solution** or **stuck**. Review dates
are counted from the day the `new` activity was actually completed.

| Type | When | What to do | Budget |
|---|---|---|---:|
| `new` | from the queue | Search, code, understand, write notes. Hint at 15–20 min without an approach; read the solution at 35–45 min, then re-code it from memory. | Easy 25 / Medium 40 min |
| `recall` | done + 1 day | Without notes: state the approach, why it works, time and space complexity. | 5 min |
| `rebuild` | done + 3 days | Rebuild the algorithm in pseudocode or code, check edge cases. | 10 min |
| `resolve` | done + 7 days | Solve from a blank editor: no hints, no old solution. | 20 min |
| `blind` | done + 21 days | Solve with the category hidden. Solved alone means **mastered**. | 15 min |
| `retry` | the day after a failed review | Targeted redo. | 15 min |
| `benchmark` | days 1, 15, 30 | Timed, unseen Easy + Medium. | 60 min |

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
- **Hints**: every program problem has three progressive hints (nudge, insight, sketch). Reveal them one
  at a time in the side panel or on the problem sheet; they are recorded on the attempt, shown in the
  attempt history, and pre-select **Hint** in the outcome form (you can still change it).

## Using it

- **Toolbar icon** opens (or focuses) the dashboard.
- **Dashboard** views: *Today* (plan, timers, outcome form, pace and streak), *Calendar* (program
  progress, streak, *Plan done* days (80%+ of a day's plan finished) and time logged, days 1–30 plus
  later review days with a minutes bar, a hover/focus popover per day with a
  *projected* plan for future days, `Move…`), *Roadmap* (the 150 problems as a prerequisite **tree** or
  a **grid**, with progress counters and checkboxes), *Problem sheet* (notes, hints, attempt history,
  next review) and *Settings*.
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

You need Node.js 20+ and npm.

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
`chrome.storage` and fake alarms; the views have server-render smoke tests.

### Layout

- `src/core/` – pure TypeScript (no browser APIs): types, dates, timer, review cycle, planner,
  projection, queue, calendar, roadmap tree layout, state.
- `src/data/` – static NeetCode 150 list, roadmap categories, the 30-day program (queue,
  benchmarks) and the three-level hints.
- `src/lib/` – storage, commands and actions, reminders and background tasks, URL and side panel
  helpers.
- `src/components/` – shared React components.
- `src/dashboard/`, `src/sidepanel/` – the two UIs.
- `src/entrypoints/` – WXT entrypoints (dashboard, side panel, background worker).
- `scripts/` – icon generator.

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
