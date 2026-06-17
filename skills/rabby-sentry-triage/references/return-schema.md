# Subagent return schemas

All subagents in the `rabby-sentry-triage` skill return a **single JSON object on one line, with no surrounding prose**. The main agent extracts that line, parses it, and feeds the structured fields into the triage flow.

This file is the **source of truth** for the JSON shape. Subagents must `Read` this file before returning, and conform to the schema exactly — including field names, types, and required/optional status. The main agent parses as if the contract holds; if a subagent returns something that doesn't match, the main agent treats the result as `unsure`.

There are two return shapes today, one per subagent kind.

## 1. List-fetch subagent (step 2)

Fired once per triage run. Returns the unresolved backlog.

### Example

```json
{"total": 42, "issues": [{"shortId": "RABBY-MOBILE-1", "title": "TypeError: cannot read property 'x' of undefined", "level": "error", "status": "unresolved"}]}
```

### Schema

| Field | Type | Required | Notes |
|---|---|---|---|
| `total` | integer | yes | Length of `issues` after dedup by `shortId`. Not the Sentry `count` field. |
| `issues` | array | yes | One entry per unique issue. |
| `issues[].shortId` | string | yes | e.g. `RABBY-MOBILE-123`. Used by the main agent to dispatch per-issue subagents. |
| `issues[].title` | string | yes | Verbatim from Sentry. |
| `issues[].level` | string | yes | `error` / `warning` / `info` / `debug`. |
| `issues[].status` | string | yes | e.g. `unresolved`, `regressed`, `new`. |

## 2. Per-issue subagent (step 3)

Fired N times, once per issue returned in step 2. Returns the enriched issue + classification.

### Example

```json
{"shortId": "RABBY-MOBILE-1", "title": "TypeError: cannot read property 'x' of undefined", "firstSeen": "2026-05-01T12:34:56Z", "lastSeen": "2026-06-15T08:00:00Z", "count": "1234", "userCount": 56, "permalink": "https://rabby-wallet.sentry.io/issues/12345/", "bucket": "needs_attention", "reason": "firstSeen 4 days ago, top frame points into src/screens/Send.tsx:42", "top_frames": ["apps/mobile/src/screens/Send.tsx:42", "apps/mobile/src/hooks/useSend.ts:108"], "owner_area": "send flow"}
```

### Schema

| Field | Type | Required | Allowed values / notes |
|---|---|---|---|
| `shortId` | string | yes | e.g. `RABBY-MOBILE-123` |
| `title` | string | yes | Verbatim from Sentry. |
| `firstSeen` | string (ISO 8601) | yes | e.g. `2026-06-15T08:00:00Z`. |
| `lastSeen` | string (ISO 8601) | yes | Same format. |
| `count` | string (numeric) | yes | Total event count, returned by the CLI as a numeric string. Coerce client-side if a number is needed. |
| `userCount` | integer | yes | Distinct users affected. |
| `permalink` | string | yes | Full URL on `rabby-wallet.sentry.io`. |
| `bucket` | enum | yes | `needs_attention` / `noise` / `unsure`. |
| `reason` | string | yes | One sentence citing the deciding signal. Always present, even for `noise`. |
| `top_frames` | string[] | conditional | Required when `bucket === "needs_attention"`. 2–3 stack frames formatted as `path:line`. Omit (or return `[]`) for `noise` and `unsure`. |
| `owner_area` | string | conditional | Required when `bucket === "needs_attention"`. Short team/area name like `"send flow"`, `"hardware wallet"`, `"TypeORM migration"`. Omit, or return `""`, for `noise` and `unsure`. |

## Parsing contract for the main agent

1. Take the subagent's full text response.
2. Find the first line that starts with `{` and ends with `}`. If the subagent wrapped it in code fences or added prose, strip those first; do not require the subagent to be perfect.
3. Parse the line as JSON. If parsing fails, mark this issue `unsure` and surface in the report.
4. Validate required fields per the schema above. Any missing required field → `unsure`.
5. For `bucket === "unsure"`, the main agent should still surface the issue in the report under `## Skipped / kept` so the user can decide.
6. Aggregate by `bucket` into three lists: `needs_attention`, `noise`, `unsure`. These lists feed sections 4 (silence noise) and 5 (report).
