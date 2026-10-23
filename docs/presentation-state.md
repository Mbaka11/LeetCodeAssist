# Presentation-only optional state (version 1)

These fields are absent from legacy backups and default to off/empty. They do not change
activities, program order, budgets, review rules, counts or progress. Import/export round-trips
them without changing `AppState.version`.

| Field | Type | Update / record-level merge unit |
| --- | --- | --- |
| `settings.sidePanelFocus?` | `boolean` | One settings property; absent is false. It records the requested preference even on a page with no current activity. |
| `favorites?` | `Record<string, boolean>` | One problem slug. Toggling changes only that slug; `true` is starred, `false` is an explicit unstar. Missing means unstarred. Never replace the whole record when merging an individual star. |
| `savedRoadmapFilters?` | `Record<string, SavedRoadmapFilter>` | One stable ID generated with `crypto.randomUUID()`. Saving creates one ID; renaming replaces only that entry's name and preserves its filters. Deleting removes only that ID. Different preset IDs are independent; merge an entry as a whole, not field-by-field. |

`SavedRoadmapFilter` is `{ name: string, filters: RoadmapFilters }`. Names are trimmed and must
contain 1–80 characters. Duplicate names are allowed; identity is the ID, not the name. Empty
records are valid and preserved. Saved-filter deletion removes the key; this local feature does
not introduce deletion timestamps/tombstones. A sync layer must preserve intentional deletions
using its own conflict/deletion protocol rather than blindly resurrecting absent entries.

All filter fields are required inside a saved preset:

- `search`, `category`, `technique`, `structure`, `company`: strings.
- `difficulty`: `'' | 'Easy' | 'Medium' | 'Hard'`.
- `status`: `'' | 'untouched' | 'learning' | 'consolidating' | 'reviewed' | 'mastered'`.
- `access`: `'' | 'free' | 'premium'`.
- `scope`: `'' | 'program' | 'bonus' | 'outside'`.
- `favoritesOnly`: boolean.

Empty strings mean no constraint. Metadata strings are deliberately not validated against the
current static catalog on import: a backup with a retired tag remains importable. On **Apply**,
unavailable category/technique/structure/company values are cleared. Presets do not store a
catalog: they apply to the current catalog, and normal catalog switching still resets the live
filters. When hide-techniques is on, technique and structure filters are cleared/ignored on
apply and omitted as constraints when saving. Preset names remain user-authored text; tag
labels are not exposed by the preset picker.

Focus uses the same selected-activity priority as hints and Accepted auto-Finish: running
in-progress, then paused in-progress, then planned, in existing plan order. Other attempt
components remain mounted but hidden, and focus does not replace the selected ActivityCard or
OutcomeForm. Detection status visibility is temporarily suppressed, not its persisted preference
or event subscription.

The heatmap and Markdown export add no stored fields. Heatmap ranges are the 30 program dates
and the last 84 local dates including today, separately labelled and intentionally overlapping.
It sums completed log minutes by completion date, including existing optional attempts, without
reading live timer time. Each cell has a date/minutes accessible label and the legend gives
absolute minute thresholds. Markdown export includes all stored notes; unknown legacy problem
slugs use their slug and unknown category/difficulty rather than being dropped. Code uses a
fence longer than any backtick run in the note.
