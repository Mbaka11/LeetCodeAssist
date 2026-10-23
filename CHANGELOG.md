# Changelog

All notable changes to LeetCode Assist. The stored data format (`version: 1`) is unchanged: all new
fields are optional, so data saved by earlier versions keeps working.

## 0.9.1

### Changed
- **Activity minutes** moved from Calendar to **Logs**, and its program-days and recent-12-weeks grids now sit side by side (wrapping only when narrow).
- Roadmap's third layout is labelled **List** instead of **All**, so it no longer reads as a third catalog next to NeetCode 150 / Blind 75 (stored value unchanged).
- The favorite star moved to the end of each row so problem titles line up.

### Added
- **Group by company** in List (optional `settings.roadmapGroup`, schema 1 unchanged): one group per company with documented evidence, undocumented problems last.
- Company logos (bundled Simple Icons CC0 paths for nine companies; monogram for Amazon, Microsoft and Bloomberg). No remote request; trademarks stay with their owners.

## 0.9.0

> ### ⚠️ One-time migration required: the extension ID changes
>
> This release pins a fixed extension ID, **`ghpljfdplcicmcfoemfifmmibbdjcmja`**, on every computer (the
> manifest now carries a public `key`). Chrome therefore treats the new build as a **different extension**
> from the one you have loaded, and its data does not move over by itself. Do this once on each computer
> that already has data, **in this order**:
>
> 1. In the **old** install open **Settings → Your data** and click **Export JSON** to save a backup file.
>    Keep the file; do not skip this step.
> 2. Update the code and run `npm run build`.
> 3. Open `chrome://extensions`, **Remove** the old unpacked LeetCode Assist, then click **Load unpacked**
>    and choose the new `.output/chrome-mv3` folder. Confirm the shown ID is
>    `ghpljfdplcicmcfoemfifmmibbdjcmja`.
> 4. In the new install open **Settings → Your data → Import JSON…** and choose the file from step 1.
> 5. Only if you want sync: do steps 1–4 on **every** computer that has data, then turn on
>    **Settings → Sync** on each. A computer with only first-run defaults adopts the cloud copy; computers
>    that both have data merge record by record and ask you to choose where the same record differs (for
>    example different start dates).
>
> **The JSON export contains only program data.** LeetCode detection settings and events, the LeetCode
> username/preferences and the sync settings (enabled flag, device name) are **not** in the file: after the
> migration re-enable detection and your LeetCode preferences, re-enter the username if you used it, and
> turn sync on again.
>
> A fresh install with no data needs no migration. Data stored under the old ID stays on disk until that
> extension is removed. No private key is stored or committed; only the public key is in the manifest.
> Storage `version: 1` is unchanged and older backups import as before.

### Added
- **Optional automatic sync** (Settings → Sync, **off by default**) between your own Windows and Mac
  Chrome through `chrome.storage.sync` (same Google account, Chrome sync on for extensions, same extension
  ID). The background worker owns uploads: the snapshot is gzip + base64, split into checksummed chunks
  published as a new generation, inside Chrome's 100 KiB total / 8 KiB per item / 512 item / write-rate
  quotas (changes batched about 20 s, uploads ≥ 30 s apart). Records merge three-way against the last synced
  copy: activities by id, notes and checks/statuses/favorites by problem, saved filters/simulations/drill
  results by id, each setting, and the queue. A record changed differently on both computers becomes a
  **conflict** you resolve per record (*Keep this device* / *Take other device*, or keep all from this
  device); everything else keeps merging. A running timer is never silently overwritten (another computer's
  running timer is applied only once it is paused or finished). A local backup (last three, ≤ 4 MiB) is saved
  before every merge or choice that changes data and can be restored under **Your data**. If the data does not
  fit, sync pauses with a message; manual export/import always works. Corrupt or partial cloud data is ignored,
  with an explicit **Replace cloud copy** recovery. Notes and code snippets are included in Chrome sync when
  enabled; detection, LeetCode profile/preferences, sync settings and backups stay local. Importing or
  restoring a backup propagates as a local change, and *Reset* clears only this computer. Real two-computer
  propagation could not be tested automatically (mocked quotas only). See `docs/sync.md`.
- **Practice** (dashboard → Practice), voluntary and separate from the program:
  - **Interview simulation**: 25/35/45-minute countdown, an eight-step checklist, self-rating and a short
    reflection saved to a history. Default pool is problems you have worked on (or explicitly include unworked
    ones, with a warning). Tags, similar questions, notes and hints are not shown during a session; Accepted
    detection does not finish or score a simulation. Unfinished sessions exist only while the page is open.
  - **Company interviews**: a company pool needs at least **five distinct documented problems** (exact topics
    and qualified variants both count; one problem from several sources counts once). Enabled from public
    candidate self-reports: **Amazon 14, Meta 9, NVIDIA 9, Apple 8, Bloomberg 7 (8 documented; its LRU Cache row reports a design discussion with no coding and is excluded), Google 6, Microsoft 6, Uber 5**.
    **Shopify, Stripe, Datadog and Snowflake have no qualifying reports and show “Not enough documented data”**
    (absence is not evidence that they never ask coding questions). Draws use documented problems only, with an
    editorial 3:1 weight for exact over variant-only topics; this is not interview frequency or a hiring
    prediction. History discloses each topic's source, qualification, known dates and caveats.
  - **Pattern drills**: original one-line prompts, pseudo-code outlines and explanations for all 50 program
    problems; multiple-choice technique, data-structure and outline questions with immediate feedback and a
    saved score history. Worked-only by default; unworked technique/structure questions need a warning toggle,
    pseudo-code questions never include unworked problems, and *Hide techniques* disables drills until you enable
    them locally.
  - Practice never creates scheduled work, reviews, status changes, program counts, pace, worked totals,
    logged-minutes totals, heatmaps or streak, and the weekly review does not show it. Results appear only in
    Practice and JSON backups. See `docs/optional-practice.md`.
- **Company evidence expanded** from one Amazon variation to **66 source-backed rows / 65 distinct
  company–problem pairs** across eight companies (46 exact-topic mappings, 19 qualified variants; the earlier
  Amazon LRU Cache variation is retained as a separate source). Roadmap → All offers all eight companies in the
  evidence filter and renders new source/date/caveat fields. Evidence is uncorroborated public candidate
  self-reports (many on mirror sites that may be reworded); it is not official company tags or frequency data.
  Per-company coverage, thresholds and limitations: `docs/roadmap-metadata.md`.
- **Side-panel Focus mode**: shows only the current activity, instructions, timer, hints and Finish form, with an
  *Focus mode* toggle (one stable label with a pressed state); the preference persists. The detection panel
  becomes a one-line summary. Timers and unsaved Finish edits survive toggling, and detection plus Accepted
  auto-Finish keep working.
- **Favorites**: independent stars on every Roadmap row and the problem sheet, and a *Favorites only* filter in All.
  They do not affect solved checks, progress or scheduling.
- **Saved All filters**: save, apply, rename and delete named filter sets; they apply to the current catalog.
- **Calendar → Activity minutes** heatmap: logged minutes per day for program days 1–30 and the last 12 weeks,
  from completed logs only; it does not change the streak or plan-done rules.
- **Settings → Your data → Export all notes (.md)**: a readable Markdown export of every saved note (JSON stays
  the restore format).

### Changed
- The manifest `key` fixes the extension ID (see the migration above). No new permissions (`storage` already
  covers `chrome.storage.sync`).
- Long labelled `<select>` options (saved filter names, company pools) now shrink instead of widening a narrow
  page or side panel.
- The Settings reset text explains that, with sync on, reset clears only this computer.

### Notes
- Storage `version: 1` is unchanged. New fields are optional: `settings.sidePanelFocus`, `favorites`,
  `savedRoadmapFilters`, `simulations`, `drillSessions`. Backups from earlier versions import unchanged.
- The fixed 50-problem program and order, budgets, review intervals and scheduling, timers, optional bonuses,
  Accepted auto-Finish, detection visibility, result corrections, the weekly review and Roadmap All behaviour
  are unchanged.
- Original content only: no copied editorials or solutions, no premium-derived company data, no live LeetCode
  API dependency, and no company logos (permissions were not established).
- Chrome sync is last-writer-wins and the generation check cannot fully exclude two uploads in the same instant.
  A device whose upload was overwritten unseen merges against its pre-upload base on its next pass, so its changes
  are kept (the overwriting device's changes are merged in too) and a local backup exists. Chrome may delay or throttle sync.
- *Replace cloud copy* is offered only for an unreadable cloud copy or a full quota and saves a readable copy as a
  local backup first; failed uploads clean up their staged chunks; JSON import saves a local backup first when sync is on.

## 0.8.0

### Added
- **Roadmap → All:** browse all 150 or 75 catalog problems in existing category order, with collapsible
  categories, Compact/Detailed rows and conjunctive local filters. Match counts are separate from catalog
  progress; catalog/layout changes discard filters. Tree/Grid and shared check/status semantics are retained.
- Original editorial data-structure/technique tags for all 150 and **437 curated similar-question links**
  (1–3 per problem), with relation, rationale, difficulty, progress and navigation. These are not official
  LeetCode recommendations and never schedule practice or expand the fixed 50-problem program.
- Shared sheet/side-panel metadata disclosure with source-qualified company evidence. Review and side-panel
  content starts collapsed; closed disclosures do not mount tags/rationales. Hide-hints removes Detailed
  row tags and clears/disables technique/data-structure filters.
- Optional schema-1 layout/detail/hide-hints preferences; existing backups remain importable.
- Detailed company badges include a keyboard/touch-accessible **Source and caveats** disclosure with the
  qualified association, attribution link, known/unknown dates and self-report limitations.

### Notes
- Company coverage is **one uncorroborated Amazon LRU Cache variation report**, not an exact canonical
  attribution; **zero verified exact canonical pairs**. Twelve text company definitions do not imply twelve
  evidence datasets. Only Amazon is filterable; other pairs remain not documented, not “never asked”.
  Source qualifications, unknown publication/interview year and integration-snapshot caveats are preserved.
- No real company logos: text-name fallback is used because logo asset permissions were not established.
  No new network dependency, copied solutions/editorials, permissions, schema migration or scheduling change.
  Program/order, budgets, reviews, progress, independent timers, bonuses, Accepted auto-Finish and detection
  visibility retain their existing behavior. See `docs/roadmap-metadata.md` for provenance and limitations.

## 0.7.0

### Added
- **Weekly review:** read-only rolling 7-day vs previous 7-day comparison, with older-window navigation.
  Shows distinct/first-worked problems, activity/time totals, category help use and independent scheduled
  review successes. Fragile problems cite the latest eligible evidence; immediate extra repeats do not
  inflate independent-review progress or erase a help-dependent scheduled review. No automatic plan changes.
- **Logs → Correct…:** edit a saved duration, completion date or outcome, preview before/after values and
  review changes, then explicitly confirm. Duration-only edits preserve the schedule. Date/outcome edits
  reconstruct unstarted scheduled reviews from completed evidence; manual moves may change, visibly in preview.
  Done/started attempts and optional practice are protected; retired plans remain as skipped records.
- Correction audits retain original values in JSON backups. Date bounds preserve completed-attempt order;
  stale previews are rejected if related data/settings or the local date change. Export a backup before
  major changes. Optional audit fields preserve the existing version-1 schema and old-data compatibility.

### Changed
- Today shows unfinished problem groups first and finished groups below, preserving order within each
  partition and chronological attempt rows. LeetCode links stay in a reserved top-right header area.
- **Show detection status in side panel** is an independent Settings option, **off by default**. Hiding it
  does not disable submission observation or automatic Accepted → Finish. Diagnostics stay in Settings.

### Notes
- Existing program order, 50 required problems, budgets and review rules remain unchanged. Only a confirmed
  correction can alter its problem's scheduled reviews/status; the weekly view never writes data.
- Native Chrome synthetic-layout checks covered classic/grouped card links, the weekly view and the correction
  dialog at desktop and 360px-constrained widths without horizontal page/dialog overflow. Functional tests
  use mocked storage; no real account, authenticated request or installed-extension session was accessed.

## 0.6.6

### Changed
- A problem with only one activity keeps the original unnumbered card, without the extra group heading or
  activity counter. The shared heading and #1/#2/#3 rows appear only when that problem has multiple activities.
- Switching between one and several attempts preserves an open Finish form, including its outcome, date and
  edited minutes. Compact side-panel problem links still open the dashboard. No activity data or rules change.

## 0.6.5

### Added
- **LeetCode detection status** above the side-panel content and in Settings: on/off, latest recorded Submit
  and Accepted with local timestamps, problem names and language when available. Existing saved events
  update the indicator without refreshing the extension page.
- Contextual feedback for the open problem: no events yet, Submit without a later result, unsuccessful
  verdict, or Accepted with no activity currently started. An older Accepted or another problem's result
  never masks the latest Submit's missing result. The global observations stay visible when switching tabs.
- **Why did Finish not open?** help explains reload/start/panel visibility, historical results, Cancel and
  manual Save result. A Settings shortcut opens the existing detection controls.

### Notes
- On means the detection setting is enabled, **not that the observer is connected**. This feature reads
  the existing capped event list only: no connection probe, extra request, heartbeat, new permission or
  storage migration. Turning detection off preserves old observations; Clear detected events clears them.
- Activity grouping, timers, Accepted-triggered Finish, saved history and review scheduling are unchanged.
  Regression tests cover watched storage updates, disabling/clearing, current-problem scope and Finish.

## 0.6.4

### Changed
- **One problem card, several attempts.** Today groups repeated activities by problem within each section:
  one heading, then compact chronological rows such as Recall → Re-solve → Re-solve. Each row keeps its
  own outcome, duration and hints, and an open attempt retains its timer, Finish and secondary actions.
- The side panel shares the same grouped layout, with the repeat-practice action inside the group instead
  of a separate card. Its general checklist summarizes repeated types (for example Re-solve ×2) with one
  Open button per problem. Extra attempts are explicitly labelled Extra practice.

### Notes
- Presentation only: all attempts and IDs remain independent in history/Logs/CSV. Activity counts, logged
  time, distinct-problem totals, review scheduling, program order and budgets are unchanged. Today still
  separates optional bonus offers and carried-over work. No storage migration or new permission is needed.
- Automated DOM tests cover repeated attempts, active timers, Finish dates and fresh Accepted/Cancel behavior.
  A synthetic Chrome rendering of the shared card was checked at 900px and 360px container widths without
  horizontal overflow; this is not a live installed-extension or LeetCode-account validation.

## 0.6.3

### Added
- **Finish → Completed on: Today / Yesterday.** Log a late-night activity for the previous day's session
  without moving the whole program back. The chosen local date drives the app log, calendar, streak and
  review schedule; the timer still uses real elapsed time. A D+1 review can consequently be due today.
  The choice is available in Today and the side panel, including the Accepted-opened Finish form.

### Fixed
- An open form keeps its selected calendar date across midnight. Dates older than yesterday or in the future
  are rejected at save time; errors keep the form and its values, and pending saves cannot be submitted twice.
- Backdated benchmarks no longer appear in their original day's checklist. A regenerated new-problem card
  logged for yesterday fulfills that day's unopened calendar slot instead of showing both done and missed.
  No history records are deleted or rewritten by that display reconciliation.

### Notes
- Only activities not yet completed can use this choice; already-saved results are not edited. The midnight
  boundary, 50-problem queue, time budgets and review intervals stay unchanged. No storage schema migration
  is needed. This does not change LeetCode's own submission dates or public streak.

## 0.6.2

### Fixed
- Accepted detection now recognizes LeetCode's `/submissions/detail/<id>/v2/check/` route as well as the
  legacy `/check/` route. The missing `/v2/` match explained submissions being recorded without any results.
  Both versions of a submission check share the same deduplication key; Run Code requests remain excluded.

### Changed
- A fresh **Accepted** received while the matching started activity is visible in the side panel now pauses
  its timer and opens **Finish** automatically. **Save result** still requires your confirmation; the
  extension never decides your outcome or completes an activity on its own. Hints still pre-select Hint.
- Historical events, switching/starting an activity and repeated storage updates do not auto-open a form.
  Cancel does not reopen the same event, and an already-open manual form keeps its selected outcome.
  Older results still offer the manual Finish button.
- Settings explains the submissions-without-results diagnostic and how to report a route without private data.

### Notes
- Reload the extension, then reload the LeetCode tab. Keep the side panel open and start the activity before
  submitting. No previously missed result is recovered automatically; finish it manually if needed.
- The v2 route and whitelisted fields were corroborated by a user's browser report. Fetch/XHR and the
  observer-to-storage-to-Finish flow are tested with synthetic fixtures; the repaired extension has not yet
  been verified end to end in a live LeetCode session. Permissions and saved-data schemas are unchanged.

## 0.6.1

### Fixed
- The Calendar overview and LeetCode streak cards now stretch to the same height when side by side.
  On narrow screens, stacked cards keep their natural heights; no fixed height or clipping is used.

## 0.6.0

### Added
- **Two renewable bonus suggestions.** Today (and the side panel checklist) now offers **two** optional bonus
  problems instead of one. They are stored, so they survive reloads and days, and a started one keeps its timer.
  Finishing or skipping one refills the slot at once, as often as you like. Bonus problems are clearly marked
  *optional*: not part of the core plan time, pace, reminders, the toolbar badge or the projections, and they
  never become debt. Each card says how much time starting it adds and warns explicitly when that would go past
  your daily target or the cap. They are shown even when the core plan already fills the cap.
- **Readiness rule for suggestions.** A bonus problem is only offered when its category is ready: a problem of
  that category was already worked or is in today's core plan, or every prerequisite category of the roadmap was
  introduced. Graphs or Dynamic Programming therefore stay locked until Backtracking is worked. When fewer than
  two can be offered, the card says why and which category to start next. A skipped problem moves behind the
  ones never skipped; it is postponed, not deleted.
- **Bigger bonus pool: 46 problems** (was 28), with 18 more Mediums (Arrays, Two Pointers, Sliding Window, Linked
  List, Bit Manipulation and more) and original three-level hints for each. The old 28 keep their relative
  order; the pool still has no Easy and one Hard.
- **Distinct problems worked.** A compact total on Today and on the Calendar overview: every problem with at
  least one finished attempt counts once, with the breakdown *Program x/50 · Benchmarks x/6 · Bonus x* (*Other*
  only when it is not zero). Reviews, blind and re-solve attempts and extra practice never add to it, and a bonus
  problem never replaces a program problem. It is derived from your history (no stored counter); the program
  counter *x/50* stays separate.
- **Blind 75 catalog in the Roadmap.** A *NeetCode 150 | Blind 75* selector, independent of *Tree | Grid* and
  stored as the optional `settings.roadmapCatalog`. Both counters (for example *NeetCode 150 12/150 · Blind 75
  7/75*) are always visible. Blind 75 is a subset of the NeetCode 150, so switching only filters the page: it
  never adds 150 + 75, resets anything or changes the plan, and both catalogs share the same statuses and
  checkboxes. The list is NeetCode's own Blind 75 flag (provenance in `src/data/blind75.ts`). Problems that need
  LeetCode Premium carry a **Premium** label and are never scheduled.

### Changed
- **Compact Calendar.** The overview and the LeetCode streak card now sit side by side in one summary row
  (from 1000 px wide, stacked below that) and the day grid follows directly, so the first row of days is visible
  in the tested 1366×768 and 1440×900 viewports (actual visibility depends on zoom and window size). The streak
  card is compact (Current / Longest / Active days, a 16-week heat
  grid, Refresh, username and *Updated* in one footer; UTC days, error and paused-refresh behaviour unchanged).
  Explanations and the start date editor moved behind *How these are counted* and *Change start date*. Today is
  the default day detail.
- The Calendar lists a finished bonus on the day it was completed with a *Bonus* badge; unopened offers never
  create missed-day debt. The day table scrolls inside its card and the top bar wraps on narrow screens, so the
  page no longer scrolls sideways.
- Stored data stays `version: 1`: `roadmapCatalog` is optional and older data is read as before. Existing
  one-per-day bonus records are read as offers and nothing is rewritten or deleted.
- The program is unchanged: the same 50 problems in the same order, the same benchmarks, budgets and review
  intervals.

### Fixed
- A bonus problem skipped on a later day is now dated to the day it was skipped (Calendar and Logs) instead of
  the day it was first offered. Retired older duplicates are re-dated the same way; nothing is deleted.
- The time-impact line of a bonus offer now also counts a bonus problem that is already running.
- The side panel now persists and replenishes offers even when Today is never opened. Pending offers keep
  their IDs across midnight and neither a reload nor another surface creates duplicates.

### Notes
- Layout was checked in a headless Chrome with mocked extension APIs, not in a live extension install. The
  extension was not run in Chrome with a real LeetCode session, and the LeetCode API behaviour stays
  **not live-verified**.
- Finished bonus problems add their own four reviews as core work, so many of them can crowd out new program
  problems on later days (no daily limit by design).
- Running the test suite needs Node 22.22.2+ or 24.15+ (jsdom 30); the README no longer says Node 20+.

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
