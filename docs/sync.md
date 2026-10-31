# Automatic sync (Chrome storage)

Optional, **off by default**. It copies your program data between your own computers through
`chrome.storage.sync`: the same Google account, Chrome sync turned on for extensions, and the extension
installed with the **same extension ID** on every computer (see "Fixed extension ID"). No LeetCode login,
LeetCode request, account, cookie or server of ours is involved; the data travels only through Chrome sync.
Manual JSON export/import is unaffected and always works.

Update every synced computer to 0.11.0 or newer for the **04:00 local training-day boundary**. Older builds
still use midnight and can assign different dates to overnight work. Existing dated logs are not migrated.
Actual save timestamps (`Activity.completedAtMs`) travel with each activity; older records may lack one.

## Fixed extension ID

`wxt.config.ts` pins the manifest `key` (public key only; RSA 2048, SPKI DER, base64). Unpacked extensions
otherwise get an ID derived from their folder path, which differs between Windows and Mac, and Chrome would
not treat them as the same extension. The resulting ID is:

```
ghpljfdplcicmcfoemfifmmibbdjcmja
```

No private key was kept or committed (unpacked installs do not need one; a Chrome Web Store upload would
use its own key). **One-time migration** for an existing install (its ID changes with the new key):

1. In the old version: **Settings → Your data → Export JSON**.
2. Update the code, `npm run build`, remove the old unpacked extension, **Load unpacked** the new
   `.output/chrome-mv3`. The ID is now the one above on every computer.
3. **Settings → Your data → Import JSON…** with that file. Then enable **Settings → Sync** on each computer.

The old extension's `chrome.storage.local` is not carried over automatically, so do not skip the export.
Data of the old ID stays on disk until that extension is removed.

The JSON export contains the program data (`AppState`) and, optionally, a top-level `leetcodeSettings` section with exactly
three LeetCode preferences: `username`, `detectionEnabled`, `showDetectionStatus`. Settings → Your data → Export JSON has
an *Include LeetCode settings* box (on by default). Importing restores the section only when the file has it and you tick
**Also restore LeetCode settings from this file**; files without the section (everything exported by 0.9.3 or earlier)
import exactly as before. The section is validated strictly (unknown fields, wrong types or an invalid username reject the
whole import before anything is changed). Submission events, the profile/streak cache, the sync config (enabled flag,
device name), sync backups and anything credential-like are **never** in the file. After the migration re-enable sync, and
for files without the section re-enable detection and your LeetCode preferences and re-enter the username by hand.

The section is not part of `AppState` (storage version stays 1): `validateState`/`deserializeState` ignore it, Chrome sync
never carries it and an import with sync on does not propagate it.

## Storage layout (`chrome.storage.sync`)

| Key | Content |
| --- | --- |
| `lca.sync.manifest.v1` | `{ version, generation, count, checksum (SHA-256), device, at, lineage }` (`lineage`: up to 8 earlier generations this snapshot was written on top of) |
| `lca.sync.chunk.<generation>.<n>` | slices of the snapshot: `JSON` → gzip (`CompressionStream`) → base64 |

- Chunks are 7000 characters, below the 8192-byte per-item limit including key and JSON quotes.
- A writer stages a complete new generation, re-checks that the manifest is still the one it merged against,
  switches the manifest in one write, then deletes every chunk outside the new generation (a fresh key list, so chunks
  leaked by failed or interrupted uploads are removed too; a failed upload removes its own staged chunks). A reader follows the manifest only, checks
  the chunk count, the SHA-256 and `validateState`, so it never assembles chunks of different generations.
  Incomplete, corrupted or invalid remote data is **ignored with an error status and never applied**.
  "Replace cloud copy with this device" in Settings is the explicit recovery. It is offered only when the cloud copy is
  unreadable (dedicated error) or sync is paused by the quota. It first re-reads the cloud copy and refuses if it is
  readable and the quota is not the problem; a readable copy is saved as a local backup before it is replaced, and the
  size check runs before anything is removed.
- Quotas honoured: `QUOTA_BYTES` 102400 (the check includes old and new generation during the switch),
  `QUOTA_BYTES_PER_ITEM` 8192, `MAX_ITEMS` 512. When the data would not fit, sync **pauses** with a clear message
  ("Sync now" retries); local data and export/import are untouched. Settings shows used/limit and warns above 80%.
- Write limits (120/min, 1800/hour): local changes are coalesced for ~20 s (Chrome clamps alarms to ≥ 30 s), and uploads
  are at least 30 s apart (≤ 120 uploads/hour, ~3 write operations each). The background worker owns every upload
  via durable `chrome.alarms` (a 1-minute poll while enabled) and wakes on `chrome.storage.onChanged` for the sync area.

## What syncs, and what stays local

Synced: the whole `AppState` (activities with their correction audit, notes, checked, problem status, favorites,
saved All filters, simulations including two-problem session records, drill results, interview prep, settings, queue).

Local only (never uploaded): detection settings and events, LeetCode profile/preference keys, the device-local appearance
preference (`leetcodeAssist.appearance.v1`: theme and text size, applied through `data-theme`/`data-text-size`; not in
`AppState`, not in the JSON export and kept by Reset all data), sync config, device name,
sync status, the merge base and the pre-merge backups. The optional setting `settings.eveningOnlyIfOpen` (evening
reminder only while today is not done; absent = on) is an ordinary settings field and merges per field like the others. Chrome may also sync the extension's storage to Google
servers, so notes and code snippets leave your computer: leave sync off if that is not acceptable.

## Merge rules (three-way, deterministic)

Each device remembers the last remote snapshot it merged or published (`lca.sync.base.v1`, local). Records:
each activity by id, note by slug, `checked` / `problemStatus` / `favorites` entry by slug, saved filter / simulation /
drill result by id, each settings field, and `queue` and `interviewPrep` each as one value.

| Local vs base | Remote vs base | Result |
| --- | --- | --- |
| changed | unchanged | keep local, publish |
| unchanged | changed | take remote |
| same change | same change | nothing |
| changed | changed differently | **conflict** (local kept until you choose; non-conflicting records still merge) |

Other rules:

- A deletion is a change (imports and restores can delete records); the three-way rule applies.
- **Running timers are never silently overwritten.** A timer running on the other device is not mirrored here until
  it is paused or finished there (it is "deferred", the other copy stays untouched in the cloud). If this device has
  a running timer and the other device changed that activity, you are asked. Choosing "other device" can replace the
  running timer. A timer started here and not yet uploaded never conflicts with its own old copy.
- Untouched generated activities (planned, no timer/result, id `type:slug:date`) never conflict with a worked version of
  the same activity, so two computers that open the same day do not need choices.
- First sync with no base: if this device has only first-run defaults, it adopts the cloud copy whole (after a backup);
  otherwise records merge normally and settings that differ (for example `startDate`) are conflicts.
- Settings are merged per field; if the merged combination is invalid (e.g. cap below target) those fields become conflicts.
- Simulations (including the two linked records of a two-problem session) and drill results are immutable records merged
  by id; the same id with different content is a conflict. They never feed program counts, program pace, worked totals or streak (the Logs pace chart only reads simulation durations
  for a separate, labelled overlay).
- The optional interview prep is one whole value: set, edited or cleared on one device it propagates; changed
  differently on both devices it is a conflict (the two versions are never mixed field by field).
- Conflict list (Settings → Sync and a dashboard banner) shows both versions (problem, type, status/outcome/date) with
  *Keep this device* / *Take other device* per record and *Keep all from this device*.
- Merge is a pure function of (base, local, remote, pending conflicts), tested for symmetry on non-conflicting changes.

## Backups, import, reset

- Before each merge or choice that changes this device, the previous state is saved locally: last 3, at most 4 MiB.
  Settings → Your data → *Local pre-merge backups* restores one (a local change; it propagates and keeps a backup of what
  it replaces). If a backup cannot be stored the merge is not applied.
- Import replaces local data and is treated as a local change set; with sync enabled the confirmation warns that it
  propagates (records missing in the file count as deletions; overlapping remote changes need choices).
- Reset clears only this device (and the sync base). The cloud copy is kept; after setup an untouched device adopts it
  again. Disable sync first for a truly empty start.

## Honest limits

- **Update every computer together.** A build older than 0.10 ignores the newer optional fields (interview prep, two-problem session records, the evening-reminder setting); if it republishes, those values can look cleared. Install the same version on both computers before relying on sync.

- Real cross-device Chrome sync cannot be verified by the automated tests; they use a mock `chrome.storage.sync` that
  enforces the documented byte/item/count/rate quotas. Chrome may delay propagation (seconds to minutes) or throttle sync.
- `chrome.storage.sync` is last-writer-wins, not transactional; the generation check narrows but cannot eliminate a race of
  two uploads in the same instant. Each device remembers the generation it published and the merge base from just
  before that upload. If the next cloud copy is neither that generation nor written on top of it (its `lineage`), another
  device overwrote the upload without seeing it, and the merge runs against the pre-upload base instead of the device's own
  upload. The marker survives the echo of the device's own upload (its own manifest change and poll alarm) and is only
  cleared once a different generation has been merged. Its changes are therefore merged and re-uploaded, not treated as deleted. Concurrent edits of the same record
  become ordinary conflicts, and a local backup is kept before any local change. A narrow remaining window: cleanup of
  leaked chunks could remove chunks another device is staging at that instant; that device's next read then reports an
  unreadable copy and its own data stays intact locally.
- JSON import with sync enabled first stores the current data as a local backup (stopped if it cannot be stored). When the
  stored data is itself invalid, no backup is possible and the import proceeds, because import is the recovery path.
- *Replace cloud copy* during a quota pause first merges a readable cloud copy into local data (keeping both as local
  backups), so changes another device uploaded during the pause are not dropped.
- Data too large for 100 KiB (compressed, with room for a second generation) cannot sync; use JSON.
- Extension IDs must match; a differently built or Web-Store copy has another ID and another sync area.
