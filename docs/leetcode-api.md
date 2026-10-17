# LeetCode endpoints used by LeetCode Assist (endpoint ledger)

LeetCode has **no documented public API** for any of this. The contracts below are **inferred from public
knowledge of how leetcode.com behaves, with low confidence, and have NOT been verified against live traffic**:
no traffic was captured when this was written, and nothing here claims live validation. Every parser fails
closed (anything unexpected is ignored), so a wrong guess costs a feature, never data or correctness: without
detection you finish activities by hand, without the profile call the streak card shows an error.

| | |
|---|---|
| Evidence | inferred from public knowledge; no capture, no official documentation |
| Confidence | low |
| Live-verified | no |
| Last reviewed | 0.5.0 development; re-check by the steps at the end |

## Boundaries (what this extension does and does not do)

- It *passively observes* the user's **own** submissions in the user's **own** browser, through the extension,
  and reads the **public** profile data of the username the user typed.
- It never reads, stores, exports or transmits cookies, tokens or any credential, nor request bodies (the code
  being submitted), nor response bodies beyond the whitelisted fields below.
- It never submits, replays, automates or retries a request on the user's behalf. The observer only watches
  requests the page itself makes; the profile client makes one fixed anonymous request (below).
- 401 / 403 / 429 stop everything for 15 minutes with a message; there is no retry loop. Responses are read with
  a size limit and a deadline; the destination is fixed to `https://leetcode.com/graphql`.
- Nothing collected leaves the browser.

## Ledger

### 1. Submit (observed, never sent by the extension)

| | |
|---|---|
| Method / route | `POST https://leetcode.com/problems/<slug>/submit/` (made by the page) |
| Used for | noting that the user submitted: problem slug (from the URL) and time |
| Whitelisted request data | the slug in the URL only. The request body (the code) is never touched |
| Response | not read |
| Authentication | the page's own browser session (cookies and a CSRF header). The extension neither sees nor handles it: the observer runs as a passive wrapper and never inspects headers or bodies |
| Evidence / confidence | inferred, low |

### 2. Submission result polling (observed, never sent by the extension)

| | |
|---|---|
| Method / route | `GET https://leetcode.com/submissions/detail/<id>/check/` (polled by the page) |
| Used for | the final verdict of a submission |
| Whitelisted response fields | `state` (`PENDING` / `STARTED` while running, `SUCCESS` when finished), `status_msg` (`Accepted`, `Wrong Answer`, `Time Limit Exceeded`, `Memory Limit Exceeded`, `Runtime Error`, `Compile Error`, ...), `lang` (`python3`, `cpp`, ...), `status_runtime` and `status_memory` when present. Everything else in the response (code output, expected output, error text) is ignored and dropped |
| Validation | each field is a short string of letters, digits and a few punctuation characters (`status_msg` <= 64, `lang` <= 32, `state` <= 24, metrics <= 32 chars); the response text is read through a clone, bounded to 256 KiB; pending states are not reported; the `<id>` is only used locally to report a finished check once |
| Authentication | the page's own session; not handled by the extension |
| Evidence / confidence | inferred, low. Notably unverified: the exact route, whether `status_msg` carries `Accepted` for a pass, the `lang` spelling, and whether the site also uses a different route (for example GraphQL `submissionDetails`) in newer UI versions |
| Failure mode | if the contract is wrong, no event is recorded and the diagnostics in Settings show "Submissions seen" without "Results seen" |

How it is observed: a content script in the page's MAIN world wraps `window.fetch` and
`XMLHttpRequest.prototype.open/send`. The wrappers call the original with the page's own arguments, return the
original result unchanged, and swallow their own errors. They only act when the URL matches the two routes above
on `leetcode.com`. Events travel `window.postMessage` (same origin) -> isolated content script (checks
`event.source`, `event.origin`, exact message shape) -> `chrome.runtime.sendMessage` -> background worker (checks
the sender is this extension on a `leetcode.com/problems/` page, validates again, drops events when detection is
off, stamps its own time, appends to a capped list of 200).

Known limits: the scripts are injected for `https://leetcode.com/problems/*` at document start, so a problem page
reached by in-page navigation from another LeetCode page may need one reload before it is observed. A script on the
page could post a fake window message; events are advisory (they only pre-fill a form the user confirms).

### 3. Public profile calendar (requested by the extension)

| | |
|---|---|
| Method / route | `POST https://leetcode.com/graphql` with `Content-Type: application/json` |
| Request body | `{"query": "query userCalendar($username: String!) { matchedUser(username: $username) { userCalendar { activeYears streak totalActiveDays submissionCalendar } } }", "variables": {"username": "<validated username>"}}` |
| Whitelisted response fields | `data.matchedUser.userCalendar.{activeYears, streak, totalActiveDays, submissionCalendar}`. `submissionCalendar` is a JSON **string** mapping the unix time (seconds) of the start of a UTC day to the number of submissions that day |
| Parsing | defensive: keys must be digits and are snapped to the UTC day, counts must be non-negative numbers, at most 800 days are kept; `matchedUser: null` means the user does not exist |
| Authentication | none. The request is anonymous: `credentials: 'omit'`, no cookie, no token, no CSRF header, `referrerPolicy: 'no-referrer'`, `redirect: 'error'`. The data is the public profile calendar |
| Limits | 10 s deadline, 256 KiB response limit, a single request per refresh; at most one automatic refresh per hour, the Refresh button at most once a minute; the result is cached with `fetchedAt` in its own storage key |
| Errors | 429 -> "asked to slow down" and a 15 min pause; 401 / 403 -> "access denied" and a 15 min pause; 5xx -> server problem; other status -> unexpected error; network failure, timeout, oversized body, non-JSON or unexpected shape each map to their own message; `matchedUser: null` -> "no public profile with that username". None of them is retried; after any failure the next automatic attempt is at least an hour later |
| Evidence / confidence | inferred, low. Notably unverified: that an anonymous request without the site's CSRF/Referer headers is accepted (the browser sends an `Origin` for the extension, and the endpoint may answer 403 or a challenge), the field names, and whether `userCalendar` without a `year` argument returns the current calendar year or a rolling year |
| Failure mode | an error is shown in the card, with the last good numbers when there are some |

The streak numbers are computed locally from `submissionCalendar` over **UTC days** (LeetCode's own calendar
unit): the current streak counts consecutive active days ending today, or yesterday when today has no submission
yet; the longest streak is the longest run in the returned data; the heat grid covers the last 16 weeks.
`streak` and `totalActiveDays` as reported by LeetCode are stored for reference but not displayed.

## Refreshing this document (verification steps)

Do this only in a browser profile you own, signed in as yourself, and only for your own submissions:

1. Open DevTools > Network on `leetcode.com/problems/two-sum/`, filter `submit` and `check`, and submit once.
   Note the **route templates** and the **field names** of the result. Do not copy cookies, tokens, request
   bodies or full responses anywhere (not into issues, chats or this repository).
2. Compare with the table in section 2. If the route or fields differ, change `classifyRequestUrl` and
   `parseCheckResponse` in `src/lib/leetcodeSubmissions.ts` and their synthetic fixtures in the test file.
3. For the profile call, open your public profile page and look for the `graphql` request that returns the
   calendar; compare the query shape with section 3 (`src/lib/leetcodeProfile.ts`, `PROFILE_QUERY`). Check what
   status an anonymous request gets by running the card once; a 403 means the endpoint needs more than this client
   sends, and the feature should stay disabled rather than add cookies or tokens.
4. Update the *Evidence*, *Confidence* and *Last reviewed* lines above only to what you actually observed.
