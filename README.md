# LeetCode Assist

A Chrome extension (Manifest V3) that runs a **30-day LeetCode bootcamp** on the
**NeetCode 150** roadmap. Open it and it tells you exactly what to do today: new problems,
spaced reviews and how long each should take. It reminds you with notifications, sits next to
LeetCode in a side panel, and tracks progress, timing and notes. Everything stays in your
browser (`chrome.storage.local`); there are no accounts and no servers of ours. Syncing between your own
computers through Chrome sync is optional and off by default.

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

### Optional interview simulations and pattern drills

**Practice** is separate from the program and its existing bonus/extra activities. Start a voluntary
25/35/45-minute mock interview from worked problems (or explicitly include unworked topics), filter by
category/difficulty, tick an interview checklist and save a self-rating/reflection. Tags and similar
questions are hidden during the mock. Company pools use documented public candidate self-reports,
including qualified variants (a source that reports no coding is never drawn), and need at least five distinct documented problems; Shopify, Stripe, Datadog and
Snowflake have none and stay disabled (coverage table under Catalogs). These are not frequency or
hiring predictions.

Pattern drills use original short prompts and pseudo-code outlines for all 50 program problems, with
immediate multiple-choice feedback and score history. Worked-only is the default; unworked
technique/structure questions require a warning toggle, and unworked pseudo-code is never included.
Hide techniques disables drills by default until explicitly enabled.

A **two-problem session** (Practice → Interview simulation) draws two different problems from the same pool
back to back. Each has its own timer with a visible 45-minute banner (no sound, nothing is ended for you),
an optional skippable 5-minute break sits between them (problem 2 never starts by itself), and the summary
saves both results as two linked records in one step. Saved history shows them as one session.

**Interview prep** (Practice → *Interview prep*) is an optional note of a company and an interview date up
to 365 days ahead. It shows days left, that company's documented problems with your status, the untouched,
slowest and fragile ones, and the reviews already scheduled before the date. It never schedules, moves or
adds anything.

The Logs page has a **Pace by month** chart: the median logged minutes per completion month and difficulty,
first attempts and reviews drawn separately, each point with its sample count (hollow when fewer than three),
no trend line, and an editorial 15/30/45-minute guideline line that is labelled as not being data. Saved
simulation durations can appear as a separate, labelled series; they are never added to logged time.

None of these features changes activities, reviews, problem status, counts, program pace, worked totals, streak
or weekly-review metrics. Completed results are kept only in Practice and JSON backups (the Logs pace chart
may overlay simulation durations as described above); unfinished sessions are local to the open view and are
lost on leaving. See [optional practice](docs/optional-practice.md) and
[company provenance](docs/roadmap-metadata.md).

### Repeated attempts without repeated cards

Today groups activities **by problem** within each section. A problem with just one activity keeps the
classic card, without a number or extra group heading. With several activities, one shared heading contains
numbered chronological rows such as **#1 Recall → #2 Re-solve → #3 Re-solve**, with each attempt's own outcome,
duration and hints. An active row keeps its own timer and Finish controls; grouping never combines records, changes
review scheduling or increases the distinct-problems-worked total. In Today, groups with unfinished work
appear first, finished groups follow, and relative order is retained inside each partition. Attempt rows
stay chronological. The LeetCode link stays at the top-right of classic and grouped cards.

The side panel uses the same layout and keeps **Start as extra practice** inside the problem group when
no attempt is open. Its general checklist summarizes repeats in one row (for example **Recall · Re-solve ×2**),
with one Open button. Bonus offers and carried-over work keep their separate sections, and Logs still has
one row per activity for detailed inspection or CSV export.

### Logging after midnight

In **Finish → Completed on**, choose **Today** (default) or **Yesterday**, then **Save result**.
Use Yesterday when the activity belongs to the previous evening's session: its time and completion go into
that day's app log/calendar, and its reviews are scheduled from that date. A new problem or benchmark logged
for yesterday therefore has its **D+1 recall due today**. The original activity is finished, not left as work
to redo today; bonus totals and program counts remain distinct.

The timer still uses real elapsed time. If you leave Finish open across midnight, its selected calendar date
stays fixed (the label becomes Yesterday); an older selection must be changed before saving. This does not
move the program's midnight boundary, edit an already-saved result, or change LeetCode's own submission streak.

### Correcting a saved result

Open **Logs → Correct…** on a completed activity. Edit its date, logged minutes or outcome, choose
**Preview changes**, inspect the before/after values and affected reviews, then **Confirm correction**.
Nothing is written on preview or Cancel. A duration-only edit leaves review dates and learning status alone.
A date/outcome edit recalculates this problem's **unstarted scheduled reviews** from completed attempts;
manual review moves may change, and newly overdue reviews remain due. Old plans are kept as skipped records.

Other completed/started attempts and optional extra practice are protected. Dates cannot be in the future
or reorder this problem's completed attempts, and logged time cannot be less than its recorded approach time.
The preview is rejected if related data or the local date changes before confirmation. Previous values are
kept in the activity's optional correction audit, preserved in JSON backups. Export a backup before major
changes. The daily planner can rebalance later work under the same cap; the 50-problem queue is unchanged.

### Weekly learning review

**Weekly review** compares the latest **7 local days** with the preceding 7, with navigation to older windows.
It shows completed activities, distinct problems, first-recorded completions, time and per-category evidence:
unique problems with an independent scheduled review (**Solo, no recorded hints**) and help use (**Hint /
Solution outcome or recorded hints**, shown over rated attempts). Immediate extra repeats do not inflate the
independent-review count. Missing outcomes are not treated as independent successes.

**Still fragile** uses the latest rated scheduled review, or initial completion when no rated review exists.
Help-dependent or Stuck results remain flagged even after an immediate optional Solo repeat; absence from the
list is not proof of mastery. These are app-history observations, not an automatic evaluation or program
change. Small samples, difficulty differences and missing history limit comparisons.

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
  budget, a summary row, correction previews and CSV export), *Weekly review* (read-only learning evidence)
  and *Settings*.
- **Side panel**: one global panel per window that stays open across tabs. On a leetcode.com problem
  page it shows the problem (difficulty, category, program position), today's activity with its
  instruction and timer, hints, the outcome form, notes, attempt history and the next review date. On
  any other page it shows **Open a LeetCode problem** and today's checklist with an **Open** button per
  item. Open it from the dashboard's **Open side panel** button, by clicking a LeetCode link in the
  dashboard, or with the shortcut **Alt+Shift+L** (change it at `chrome://extensions/shortcuts`).
- **Notifications and badge**: a morning summary (for example
  `Today: 2 new, 2 recalls, 1 rebuild · ~2h20`) and an evening summary such as
  `Today: 3 done, 1 left, 95 min logged`, at the times set in Settings. By default the evening
  summary only appears while today's plan still has something left (Settings → *Only remind in the
  evening if today is not done*; turn it off to get the summary every evening that has planned
  activities). Nothing is sent before the program starts or for a day that already passed, and
  yesterday's notifications are cleared at midnight. The toolbar badge shows the activities left today.
- **Side-panel shortcuts** (they work while the panel has focus and you are not typing in a field; the
  browser shortcut Alt+Shift+L is unchanged): **Alt+T** start, pause or resume the selected activity's
  timer, **Alt+R** open Finish, **Alt+1…4** choose Solo / Hint / Solution / Stuck in Finish,
  **Alt+Enter** save a valid Finish form, **Alt+?** show or hide the *Shortcuts* list.
- **Appearance** (Settings → Appearance): theme (follow the system, dark or light) and text size
  (small, normal, large) for the dashboard and the side panel. It is stored on this device only, under its
  own key: not in the JSON export, not synced, not touched by Reset all data.

### Focus mode, favorites, saved filters, heatmap and notes export

- **Side panel → Focus mode** remembers your preference and shows only the current activity,
  its instructions, timer, hints and Finish form. The button keeps one label, **Focus mode**, and shows
  whether it is on. It hides metadata, notes and history; the detection panel is replaced by a one-line
  detection summary (it stays mounted, so nothing resets), and detection and Accepted auto-Finish still work.
  Toggling never resets the timer or edits in an open Finish form. With no current activity it
  explains that there is nothing to focus on and keeps the normal panel visible.
- **Favorites** are independent stars on every Roadmap problem row and the problem sheet.
  Roadmap **All → Favorites only** shows your shortlist; stars do not mark problems solved or
  affect progress, scheduling or program membership.
- **All → Saved filters** saves a named copy of the current filters; select one to apply, rename
  or delete it. Presets apply to the **current catalog**, not the catalog where they were saved.
  Switching catalogs still resets the live filters. Applying a preset clears unavailable filter options (including categories
  absent from the current catalog); hidden technique/data-structure filters are never applied.
- **Logs → Activity minutes** (moved out of Calendar to keep it compact) displays local completed-log minutes for program days 1–30
  and the recent 12 weeks side by side (they wrap only on narrow screens; overlapping dates intentionally appear in both ranges). This is separate
  from LeetCode's submission calendar. It includes existing optional attempts, ignores skipped
  estimates and live timers, and does not change the existing streak or plan-done rules.
- **Settings → Your data → Export all notes (.md)** downloads every saved note with its problem
  title, category, difficulty, trigger, principle, pitfall, complexity and code. No saved notes means
  no download is offered. Markdown is a personal reading export, not an import/backup format;
  keep using JSON backups to restore the application.

All of these are presentation-only features. State/backup version remains **1** and older backups
without their optional fields still import. See [presentation state](docs/presentation-state.md)
for the exact additive storage fields and record-level update semantics.

## Install

> **⚠️ Updating from 0.8.0 or earlier: one-time extension-ID migration.** The manifest now contains a fixed
> public `key`, so the extension has the **same ID on every computer: `ghpljfdplcicmcfoemfifmmibbdjcmja`**
> (required for sync). Because this changes the ID of an existing unpacked install, Chrome treats the new build
> as a different extension and its data does not move over by itself. On each computer that already has data:
>
> 1. In the **old** install: **Settings → Your data → Export JSON** and keep the file.
> 2. Update the code and run `npm run build`.
> 3. `chrome://extensions` → **Remove** the old LeetCode Assist → **Load unpacked** → choose the new
>    `.output/chrome-mv3` folder. Check that the shown ID is `ghpljfdplcicmcfoemfifmmibbdjcmja`.
> 4. In the new install: **Settings → Your data → Import JSON…** and choose the file from step 1.
> 5. For sync, repeat 1–4 on every computer that has data, then enable **Settings → Sync** on each.
>
> **The JSON export carries your program data and, optionally, three LeetCode preferences.** Settings → Your
> data → Export JSON has an *Include LeetCode settings* box (on by default) that adds your LeetCode username,
> *Detect accepted submissions* and *Show detection status* to the file. When you import such a file, tick
> **Also restore LeetCode settings from this file** to apply them (nothing is restored without the tick; older
> files without the section import exactly as before). Recorded submission events, the streak cache and the
> sync settings (enabled flag, device name) are **never** in the file: after the migration re-enable sync, and
> files exported by 0.9.3 or earlier have no LeetCode section, so turn detection and your preferences on again
> and re-enter the username by hand.
>
> A first install with no data needs none of this. No private key is stored or committed; only the public key is
> in the manifest. Details: [sync](docs/sync.md).

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
  projection, queue, calendar, roadmap tree layout, state, logs, optional practice (`practice.ts`),
  activity heatmap and notes Markdown export.
- `src/data/` – static NeetCode 150 list, roadmap categories, the 30-day program (queue,
  benchmarks), the bonus pool and the three-level hints.
- `src/lib/` – storage, commands and actions, reminders and background tasks, URL and side panel
  helpers, and the Chrome sync service (`sync*.ts`; the pure merge is `src/core/syncMerge.ts`).
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

### All layout and problem metadata

**Tree | Grid | List** selects the layout independently of the catalog (the stored value for List stays `all`). List expands every category in the
existing order; categories can be collapsed. **Compact | Detailed** controls row detail. All supports
conjunctive title, category, difficulty, learning-status, Free/Premium, program-membership, technique,
data-structure and company-evidence filters. Program membership includes benchmarks; Outside excludes
both the program/benchmarks and the bonus pool. **Showing N of 150/75** counts matches, not progress.
Live filters are temporary (named saved filters persist), reset on catalog/layout changes, and never change either catalog counter, shared
checks/statuses, scheduled work or the fixed 50-problem program. **Clear filters** restores the catalog.

Detailed rows add original editorial tags and qualified company evidence. **Hide techniques / solution
hints** removes tags and clears/disables their filters. The layout, row detail and hide-hints preference
are optional settings; storage remains version **1**, and older backups still import without these fields.
Problem sheets and the side panel share an **Explore metadata and similar questions** disclosure: technique
tags and similar-question rationales are not mounted while it is closed. It starts closed for due/in-progress
reviews, when hide-hints is enabled, and always in the side panel; expansion deliberately reveals hints.

All **150** problems have tags and **1–3 editor-curated similar links** (437 directed links total), with a
relation, original rationale, difficulty and your own progress. These are not official LeetCode recommendations;
they may lead outside Blind 75 but stay inside the 150 and never add scheduled practice. No solutions or
editorials are copied, and browsing this metadata requires no live LeetCode API.

Company evidence comes only from **public candidate self-reports** (66 source-backed rows / 65 distinct
company–problem pairs; 46 exact-topic mappings and 19 qualified related variants), never from official company
tags, premium data or frequency lists. "Exact" means the candidate's narrative names or clearly describes the
canonical topic; it does **not** mean the employer confirmed it, and many reports sit on mirror sites that may be
reworded. Unlisted pairs are **not documented**, not “never asked”. Coverage per company (distinct documented
problems; the Practice company-interview threshold is **five**, counting exact and variant mappings, each
problem once):

| Company | Distinct problems | Exact / variant-only | Company interview |
| --- | ---: | ---: | --- |
| Amazon | 14 | 10 / 4 | enabled |
| Meta | 9 | 7 / 2 | enabled |
| NVIDIA | 9 | 6 / 3 | enabled (mostly systems/firmware roles) |
| Apple | 8 | 7 / 1 | enabled |
| Bloomberg | 8 (7 coding) | 6 / 2 | enabled with 7 problems: the LRU Cache row is a design discussion with no coding reported, kept as evidence but not drawn |
| Google | 6 | 1 / 5 | enabled (variant-heavy) |
| Microsoft | 6 | 5 / 1 | enabled |
| Uber | 5 | 4 / 1 | enabled (exactly at the threshold) |
| Shopify, Stripe, Datadog, Snowflake | 0 | – | **Not enough documented data** |

Roadmap All lists every company that has evidence in its filter. In Detailed rows, expand **Source and
caveats** next to the company badge by keyboard, click or tap for the qualification, source link, known/unknown
dates and self-report caveats. The displayed research-integration snapshot (2026-10-23) is not a fresh source
check. Company badges show a brand mark for Google, Meta, Apple, Shopify, Stripe, Uber, Datadog, Snowflake and NVIDIA
(paths from Simple Icons, CC0; the marks stay trademarks of their owners and only identify the company, with no
endorsement implied) plus Microsoft (CC0) and Amazon (Font Awesome Free, CC BY 4.0; credit in `docs/third-party.md`). Bloomberg has no
redistributable open icon and keeps a neutral monogram. Logos are bundled, with no remote request. In List, **Group by category | company** groups by documented
company; a problem appears under every company with evidence and undocumented ones are listed last. The favorite
star sits at the end of each row so titles stay aligned. See [metadata provenance and coverage](docs/roadmap-metadata.md).

## LeetCode features and privacy

- **Accepted detection (optional, on by default):** start an activity and keep its side panel open while
  submitting on leetcode.com. A newly detected **Accepted** for that problem pauses the timer and opens
  **Finish**. You still confirm Solo / Hint / Solution / Stuck and the time with **Save result**; nothing is
  completed automatically. Old events loaded when reopening the panel only offer a manual Finish button,
  and **Cancel** does not reopen the form for the same event. Turn detection off or clear the events in
  **Settings → LeetCode detection**. Both legacy and `/v2/check/` result routes are supported. **Reload the
  LeetCode tab after updating the extension.** The observer keeps only whitelisted verdict metadata, never
  your code, cookies or headers.
- **Detection status (optional, hidden in the side panel by default):** enable **Settings → LeetCode
  detection → Show detection status in side panel** to show the indicator. Hiding it does **not** disable
  Accepted detection or automatic Finish opening; diagnostics remain available in Settings. The indicator shows
  **Detection on/off**, **Last Submit** and **Last Accepted**, with local timestamps and problem names.
  The last observations are global; feedback underneath is scoped to the currently open problem and
  distinguishes no events, a Submit without a later result, an unsuccessful result, and Accepted with no
  started activity. **Why did Finish not open?** explains update/reload and confirmation requirements.
  This is saved-event visibility, **not a live connection check**: on means the preference is enabled, and
  old Accepted events do not prove that the latest submission succeeded. No extra requests are made.
- **LeetCode streak:** add your LeetCode username in **Settings** to see your submission streak and a
  compact 16-week heat grid (with Refresh, your username and the data age) next to the Calendar overview. It makes one anonymous request to leetcode.com per refresh
  (at most hourly) and only reads your public profile calendar.
- **Coloured timers:** green, amber ("near limit") and red ("over budget") against the budget on the
  card, plus help-ladder cues at 15 and 35 minutes on new problems.
- Both LeetCode features rely on endpoints that are not publicly documented. The v2 result route and its
  whitelisted fields were corroborated by a user's browser report; the repaired extension is **not yet
  end-to-end live-verified**, and the profile endpoint remains inferred. See [`docs/leetcode-api.md`](docs/leetcode-api.md). If nothing is detected,
  everything still works manually. No new permissions are used and the content scripts run on
  `https://leetcode.com/*` (so navigating to a problem from the problem list is observed) and only report on problem pages. *Reset all data* clears these keys.

## Your data and backups

All data lives in `chrome.storage.local` under one versioned key. **Settings → Your data**
exports a JSON backup (optionally including the LeetCode username and detection preferences, never
submission events or the streak cache), restores one (validated before anything is replaced, and a
malformed LeetCode section refuses the whole file) or resets everything. The appearance setting
(theme, text size) is device-local and is neither exported nor reset. Uninstalling the extension deletes
the data, so export a backup first. If the stored
data ever fails validation, the dashboard shows an error screen and leaves it untouched until you
reset or import.

### Sync between computers (optional)

**Settings → Sync** is **off by default** and copies your data between your own Windows and Mac Chrome through
`chrome.storage.sync`. No LeetCode login, extra permission or server of ours is involved.

- **Requirements:** the same Google account on both computers, Chrome sync turned on for extensions, and the same
  extension ID on both (`ghpljfdplcicmcfoemfifmmibbdjcmja`; see the one-time migration under Install). A copy built
  or installed differently has another ID and another sync area.
- **Merging:** non-overlapping changes merge automatically, record by record (activities, notes, checks, statuses,
  favorites, saved filters, practice results including two-problem sessions, interview prep, each setting, the queue). If the same record was changed
  differently on both computers you get a **conflict** (banner and **Settings → Sync**): both versions are shown
  in plain language and you choose *Keep this device* or *Take other device* per record, or *Keep all from this
  device*. Until you choose, this computer keeps its version and everything else keeps merging.
- **Timers:** a timer running on another computer is never overwritten silently; it is applied here once it is
  paused or finished there, and a conflicting change to a running timer asks you first.
- **Backups:** before every merge or choice that changes this computer, a local backup is stored (last three, up to
  4 MiB, **Your data → Local pre-merge backups**, restore with confirmation). If a backup cannot be stored, the
  merge is not applied.
- **Limits:** Chrome allows 100 KiB per account, 8 KiB per item and a limited write rate. Data is compressed and
  split into checksummed chunks, changes are batched (about 20 s) and uploads are at least 30 s apart. If the data
  does not fit, sync **pauses** with a message and manual export/import keeps working; usage is shown in Settings
  with a warning above 80 %. Corrupt or partial cloud data is ignored, never applied. *Replace cloud copy with this
  device* is offered only when the cloud copy is unreadable or the quota is full, refuses while the copy is readable
  and quota is not the problem, and keeps a readable copy it replaces as a local backup first. Chunks left behind by
  failed uploads are removed after the next successful upload.
- **Privacy:** notes and code snippets are included in your Chrome sync data when enabled (leave it off if that is
  not acceptable). Detection settings and events, LeetCode preference/profile data, the appearance preference,
  the device name, sync settings and backups stay local.
- **Import and reset:** importing or restoring a backup while sync is on is a local change that propagates
  (records missing from the file count as deletions; the confirmation says so). Before an import with sync on, the
  current data is saved as a local backup (the import is stopped if that backup cannot be stored). *Reset all data* clears only
  this computer; the cloud copy is kept and an untouched computer adopts it again, so turn sync off first for a
  truly empty start.
- **Honest limits:** Chrome sync is last-writer-wins and may delay or throttle propagation; two uploads in the same
  instant cannot be fully excluded. A device whose upload was overwritten without being seen merges against the
  state from before its upload, so its changes are kept and re-uploaded (not deleted). Real two-computer behaviour
  could not be verified by the automated tests, which use mocked quotas. Details: [sync](docs/sync.md).

## Notifications on Windows

Chrome can only fire alarms and notifications while it is running. On Windows, open Chrome
**Settings → System** and turn on **Continue running background apps when Google Chrome is
closed**, otherwise closing the last window stops the reminders. Also check that Windows
notifications (and Focus assist / Do not disturb) allow Chrome to show them. A reminder that
fires late (for example after waking the computer) is only shown if it is still the same day.

## License

[MIT](LICENSE). LeetCode and NeetCode are trademarks of their respective owners.
