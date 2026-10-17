# Changelog

All notable changes to LeetCode Assist. The stored data format (`version: 1`) is unchanged: all new
fields are optional, so data saved by earlier versions keeps working.

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
