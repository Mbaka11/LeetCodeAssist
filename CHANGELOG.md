# Changelog

All notable changes to LeetCode Assist. The stored data format (`version: 1`) is unchanged: all new
fields are optional, so data saved by earlier versions keeps working.

## 0.5.0

### Added
- **Accepted detection (passive):** a content script watches the submit and result responses LeetCode
  already makes in your own browser. When a problem you have in progress is Accepted, the side panel
  offers "Accepted at 23:14 (Python3) — finish this activity?" with the number of earlier failed
  attempts. It pre-fills the finish form (time from the timer, Solo only when no hint was used) and never
  completes anything for you. Only the verdict text, language, problem and time are kept (last 200
  events, on this device). Settings has a "LeetCode detection" card (switch, diagnostics, clear events,
  privacy note). The contract is inferred and not live-verified: see `docs/leetcode-api.md`.
- **LeetCode submission streak:** an optional LeetCode username (Settings) powers a card on the Calendar
  page: current and longest streak, active days this year and a 16-week heat grid, computed locally from
  your public submission calendar (UTC days). Anonymous request with timeout and size limit, no retries,
  at most hourly plus a Refresh button; a 429 or access-denied answer pauses it for 15 minutes.
- **Timer colours:** green under 75% of the budget, amber ("near limit") up to 100% and red
  ("over budget") beyond, neutral when paused, always with an icon and text. New problems also show
  help-ladder cues at 15 min (consider a hint) and 35 min (read the solution, then re-code it).

### Changed
- **Shorter default review budgets** (Easy / Medium / Hard, minutes): recall 5/8/10, rebuild 10/15/18,
  retry 10/15/18, resolve 15/25/30, blind 15/20/25; new problems stay 25/40/50. The 0.4.0 values made
  the plan impossible to finish. Settings overrides still apply.
- **Every free Easy problem is in the program**: 9 added (linked list cycle, diameter of binary tree,
  subtree of another tree, plus one, single number, number of 1 bits, counting bits, reverse bits,
  missing number); Meeting Rooms is Premium and left out. The queue is now **50 problems with no Hard**;
  both Hards were removed.
- Ten Mediums that no longer fit in 30 days moved to the front of their category in the bonus pool
  (generate parentheses, word search, clone graph, house robber II, longest palindromic substring,
  decode ways, word break, jump game II, gas station, insert interval). The pool has 28 problems.
- **Soft overflow:** a normal day adds a third new problem when the next one is Easy and the day stays
  within the cap + 30 min. All 50 problems are introduced by day 29 with reviews on time. A problem
  postponed or skipped today is not offered again the same day.
- Pace and every "x/N" counter use the real queue length instead of a fixed 53. Following a third-Easy
  day reads "+1 ahead" until day 30.

## 0.4.0

### Added
- **Logs page** (`#/logs`, nav entry *Logs*): a table of every completed or skipped activity, newest first,
  with date, program day, type, problem (linked to its sheet) and difficulty, category, logged time,
  approach time, budget, delta against the budget, outcome, hints used and status (done, skipped,
  postponed). Filter by type, difficulty, outcome, category, date range and title search. A summary row
  shows the count, total time, average time against budget and the solo rate for the filtered set, and
  *Export CSV* downloads the filtered rows.
- **Editable time budgets**: Settings has a compact table (activity type by Easy / Medium / Hard) with a
  *Reset to defaults* button. Overrides are stored as the optional `settings.budgets` (integers 1-180);
  saved data without it keeps working and uses the defaults.

### Changed
- **Review budgets depend on difficulty**. Defaults in minutes (Easy / Medium / Hard): recall 5 / 15 / 20,
  rebuild 10 / 20 / 25, retry 10 / 20 / 25, re-solve 15 / 30 / 40, blind 15 / 25 / 35, new 25 / 40 / 50
  (a Hard new problem is now 50 instead of 40). Benchmarks stay at 30 per problem. Longer reviews mean
  fuller days, so fewer carried-over reviews fit under the cap and the planner may offer the bonus less
  often. Every consumer (planner, projection, calendar, reminders, cards) uses one function, so overrides
  apply everywhere.

## 0.3.0

### Added
- **Bonus pool**: the optional bonus is now taken from a separate pool of about 20 extra NeetCode 150
  problems outside the 53-problem program (Stack, Binary Search, Trees, Heap, Tries, Graphs, 2-D DP,
  Intervals, Math & Geometry, Bit Manipulation and more), with three-level hints. It is offered after the
  day's own problems when it fits under the cap, also on consolidation days and after day 30. A finished
  bonus starts the normal review cycle and counts as worked in the roadmap, but not toward pace or the
  program counter, and it no longer uses up the program queue. Bonus problems carry a **Bonus** badge
  (Today, side panel, Calendar, roadmap, problem sheet) and can be skipped, not postponed.

### Changed
- **Calendar**: the "Daily goal met" indicator is replaced by **Plan done**: a day counts when at least
  80% of its core activities (due that day, excluding optional practice, the bonus and postponed
  problems) are done. The tile reads "n of m days" over the elapsed days that had core activities, and
  done days show a *Plan done* badge. A new **Time logged** tile shows the last 7 days with the
  all-time total as hint. The streak rule is unchanged.

## 0.2.1

### Fixed
- **Pace** no longer shows "behind" the morning of a day: it compares with what earlier days required
  (behind), what today requires (on pace) and beyond that (ahead).
- **Skipping a new problem** (for example the optional bonus) no longer removes it from the program: it
  returns to the queue.
- **Roadmap** lists show a problem as checked (and locked) once it is worked in the plan, not only when
  ticked by hand.

### Changed
- **Benchmark problems enter the review cycle** (recall D+1, rebuild D+3, resolve D+7, blind D+21) and count
  as worked in the roadmap. Benchmarks already completed are backfilled from their completion date. They
  still do not count toward the new-problem pace.

## 0.2.0

### Added
- **Roadmap tree view**: a Tree | Grid toggle (remembered in settings). The tree draws the NeetCode
  prerequisite graph left to right with progress (worked / solo in review / consolidating) and
  Easy/Medium/Hard counters per node; selecting a node lists its problems below.
- **Calendar**: an overall progress header (program problems learned x/53, days elapsed x/30), a minutes
  bar in every day cell, and a keyboard-accessible popover on hover or focus that lists the day's
  activities with estimated minutes and a total. Future days show a **projected** plan computed with
  the planner, assuming each day's plan is done as scheduled.
- **Move…** for planned reviews (Today cards and Calendar day detail): pick a new date from today up to 60 days ahead;
  history is kept and the merge rule still applies.
- **Postpone** for new problems (replaces the destructive Skip): the problem moves back in the queue
  behind the next two and is never removed from the program.
- **Hints**: three progressive hints (nudge, insight, sketch) for the program and benchmark problems, in
  the side panel and on the problem sheet. Each reveal is stored on the activity (`hintsUsed`), shown in
  the attempt history, and pre-selects **Hint** in the outcome form (it can still be changed).
- **Side panel**: richer problem view (difficulty, category, program position, today's activity and
  instruction, timer, status, attempt history, notes, outcome form, next review) and an **Open a LeetCode
  problem** state with today's checklist and an Open button per item.

### Changed
- The side panel is now **global for the window** instead of enabled per tab: it stays open while you
  switch or open tabs. The keyboard shortcut opens it for the current window.
- Clicking a LeetCode problem link in the dashboard also opens the side panel (best effort).
- Skipping a started review now reads **Stop, redo tomorrow**; unstarted reviews use **Move…**.

## 0.1.0

- First release: 30-day program with queue-based planner, spaced reviews, timers, notes, roadmap grid,
  calendar, side panel, notifications and JSON backup.
