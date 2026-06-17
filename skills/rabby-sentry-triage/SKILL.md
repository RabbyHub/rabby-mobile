---
name: rabby-sentry-triage
description: End-to-end Sentry backlog triage for Rabby Mobile. Detects the latest deployed release, fetches unresolved issues, separates regressions from noise, archives the noise, and updates client-side error filters in `sentry.ts`.
disable-model-invocation: true
---

# Rabby Sentry Triage

End-to-end Sentry backlog triage for `rabby-mobile`. The skill decides what is worth a human's time, archives the rest in Sentry, and teaches the local `beforeSend` filter to drop the same errors client-side so the org stops burning quota on them.

The Sentry project is `rabby-wallet/rabby-mobile` in the US region. The org slug is `rabby-wallet`. Authentication and org/project detection are handled by the `sentry` CLI itself — never pre-authenticate, never hardcode tokens.

## Execution model — subagents do the data work

This skill keeps Sentry data-fetching inside subagents wherever possible. The one exception is release discovery (step 1), which the main agent runs directly because every subsequent step needs the result. Two reasons for the subagent pattern:

1. **Context isolation.** Sentry JSON, stack traces, and per-issue metadata are large and noisy. Subagents consume them, summarize what matters, and return small structured facts. The main conversation stays clean for the triage decisions and the user-facing report.
2. **Parallelism.** Fetching per-issue details is one round trip per issue. Dispatching one subagent per issue in a single message makes that work concurrent — much faster on big backlogs.

Subagent type: **`general-purpose`**. It has the `Bash` tool the `sentry` CLI needs. Do NOT use `isolation: "worktree"` — these subagents only run read-only CLI commands and return a small summary. Never tell a subagent to archive, edit files, or take destructive actions.

The return contract lives in `skills/rabby-sentry-triage/references/return-schema.md`. Subagents must `Read` that file before returning. The main agent parses their output per the contract — see the "Parsing contract for the main agent" section at the bottom of that file.

The main agent's job is to:
- Discover the release version and its date via Sentry CLI (step 1).
- Dispatch the list-fetch subagent.
- Dispatch the per-issue subagents in parallel (all in one message).
- Parse each subagent's JSON return per `references/return-schema.md`. Missing-required-field or parse failures land in `unsure` and surface in the report.
- Aggregate the per-issue results by `bucket`.
- Show the user the proposed noise list, get a thumbs-up, then archive + edit `sentry.ts` in the main agent.

## 1. Discover the current release

Query Sentry for the latest deployed release — this is the version that matters for triage, since it reflects what is actually in production:

```bash
sentry release list rabby-wallet/rabby-mobile --json --limit 1 --sort date
```

Parse the first entry's `version` field and `dateCreated` (ISO 8601) from the JSON array. If the CLI fails (auth, network, empty project), fall back to `jq -r '.version' apps/mobile/package.json` and leave `$RELEASE_DATE` empty — the subagents will rely on the "7 days from today" rule only.

If the user names a specific release, use that instead (look it up with `sentry release list` and match by version string).

Store the resolved values:
- `$VERSION` — the release version string (e.g. `0.6.75`).
- `$RELEASE_DATE` — the ISO 8601 creation date of that release (e.g. `2026-06-15T10:00:00Z`). Used by per-issue subagents to judge whether an issue is new to this release.

Every subsequent step and subagent prompt references these values.

## 2. Fetch the unresolved backlog — one subagent

Dispatch **one** subagent to run the list query and return a compact summary. The main agent does NOT touch the `sentry` CLI for this step.

Subagent prompt template (substitute `<VERSION>` with the value from step 1):

> Run the Sentry CLI to list unresolved issues for the current release, then return a structured summary. Do NOT classify or recommend actions — fetch and dedupe only.
>
> The release version is `<VERSION>` (already resolved by the main agent — do not read it yourself).
>
> Steps:
> 1. Run:
>    ```bash
>    sentry issue list rabby-wallet/rabby-mobile \
>      --query "release:<VERSION> is:unresolved environment:\"ch:appstore|env:production\"" \
>      --sort freq \
>      --limit 50 \
>      --json --fields shortId,title,level,status
>    ```
>    The environment value `ch:appstore|env:production` is a single tag (production App Store builds) — the `ch:` and `env:` substrings are NOT separate filters. The value contains `:` and `|`, so it must be wrapped in double quotes inside the query. The outer query uses double quotes too, with the inner double quotes escaped as `\"...\"`; this keeps `$VERSION` shell-expanded. If the user asks for a different environment (e.g. dev, beta), replace the value in the query — keep the quoting.
> 2. If the user asked for "across every release" (not just the latest), drop the `release:` clause and raise the limit to 100.
> 3. The CLI wraps the array under `data`, not `issues`. Remap: `data → issues` and `total = data.length`. If `hasMore === true` in the CLI output, the result is truncated by the `--limit`; mention this in your reasoning so the main agent can warn the user, but do not add it to the schema output.
> 4. Dedupe `issues` by `shortId`.
> 5. `Read` `skills/rabby-sentry-triage/references/return-schema.md` and conform to the **List-fetch subagent** shape exactly — field names, types, required/optional status. The contract is the source of truth; do not invent your own fields.
> 6. Return a single JSON object on one line, with no surrounding prose, code fences, or commentary.

> `firstSeen`, `lastSeen`, `count`, and `userCount` are not returned by the list endpoint — they come per-issue in step 3.

## 3. Enrich and classify — N subagents in parallel

For each issue returned in step 2, dispatch **one subagent per issue**. Issue all the `Agent` calls in a **single message** so they run concurrently. This is the parallelism payoff — a 30-issue backlog fetches in roughly the time of one issue.

Subagent prompt template (one invocation per issue; substitute `<SHORT_ID>`, `<VERSION>`, and `<RELEASE_DATE>`):

> Fetch the full details of Sentry issue `<SHORT_ID>` in project `rabby-wallet/rabby-mobile`, then classify it.
>
> The current release version is `<VERSION>`, released on `<RELEASE_DATE>` (already resolved by the main agent — do not read them yourself). If `<RELEASE_DATE>` is empty, use "7 days from today" as the only freshness window.
>
> Steps:
> 1. Run the **unfiltered** view so you have both the schema fields and the topmost stack frame in one call:
>    ```bash
>    sentry issue view <SHORT_ID> --json
>    ```
>    The schema fields (`shortId`, `title`, `firstSeen`, `lastSeen`, `count`, `userCount`, `permalink`, `level`, `status`) live at the top level. Stack trace metadata is at `metadata.filename`, `metadata.function`, and `culprit`.
> 2. Classify into one of three buckets using the rules below.
> 3. `Read` `skills/rabby-sentry-triage/references/return-schema.md` and conform to the **Per-issue subagent** shape exactly — field names, types, required/conditional/optional status, allowed `bucket` values. The contract is the source of truth; do not invent your own fields. Note: `count` is returned as a numeric **string** (e.g. `"2223365"`) — keep it as a string in your return, do not coerce.
> 4. Return a single JSON object on one line, with no surrounding prose, code fences, or commentary. Keep `top_frames` to the 2–3 most informative frames when present.
>
> Classification rules:
> - **needs_attention** — any of:
>   - `firstSeen` within 7 days of today, OR within 7 days of `<RELEASE_DATE>` (the current release). These are the only things that can actually be caused by current code.
>   - Stack trace points into `apps/mobile/src/` and looks like a real bug (not vendor/network/abort). Use `metadata.filename` / `metadata.function` / `culprit` to determine the topmost frame.
> - **noise** — any of:
>   - **Stale**: `firstSeen` older than 6 months and the issue is still firing. The code has either shipped around it or it's an upstream/vendor failure.
>   - **Un-actionable**: generic network/timeout/clipboard/permission message, no useful trace, culprit is `native` code or a third-party module we do not own.
>   - **Not our code**: the entire stack trace lives in `node_modules` or a native module (e.g. `RNCClipboard`, `UIPasteboard`, `react-native-iap`).
>   - **User-cancelled intent**: `WalletUnlockCancelledError`, `Payment is Cancelled`, "user rejected" — normal flows, not real errors.
>   - **DOM/Event captured as exception**: the `_bubbles/_cancelable/_composed` shape; if still leaking, the matcher needs extending client-side, not here.
>   - **Duplicate noise already ignored client-side**: `apps/mobile/src/core/sentry.ts` already matches the message but the issue keeps growing because events pre-date the rule.
> - **unsure** — if you cannot decide, use `needs_attention`. False negatives are worse than false positives here.

The main agent's job in step 3 is purely to:
- Issue the N parallel `Agent` calls in one message.
- Wait for completion notifications.
- Aggregate the per-issue JSONs by `bucket` into the lists that feed the report.

## 4. Silence the noise

This step runs in the **main agent**, never in subagents. Subagents are read-only with respect to Sentry and the codebase.

Two things must happen, in this order:

### a. Archive in Sentry

The `sentry issue archive` command takes an issue ID and an optional `--until` condition. It does **not** prompt for confirmation, so the only safety is at the skill level: never run this in bulk without explicit user approval.

For every noise issue, the default is to archive forever (no `--until`):

```bash
sentry issue archive RABBY-MOBILE-XXX
```

Run them in a single batch with `xargs` or a small loop, but **only after** presenting the list to the user and getting a thumbs-up. The skill must never silently archive dozens of issues.

If the user prefers safer archiving, the CLI supports `--until auto` (smart spike detection — unarchives when Sentry sees a frequency spike, recommended by Sentry for most cases). Mention this option to the user when they review the list; do not default to it.

### b. Teach `beforeSend` to drop them

Update `apps/mobile/src/core/sentry.ts`. The file already has three structures:

- `SENTRY_IGNORED_ERROR_MESSAGES` — array of literal substrings (lowercase compare).
- `SENTRY_IGNORED_ERROR_PATTERNS` — array of regex patterns.
- `SENTRY_IGNORED_ERROR_KEY_SETS` — array of key-set tuples matched across all event fragments.

Pick the right slot for each new entry:

| Situation | Use |
|---|---|
| Message is a fixed string we control (e.g. `"WalletUnlockCancelledError"`) | `SENTRY_IGNORED_ERROR_MESSAGES` |
| Message varies in a predictable shape (e.g. all `"Error: device is inactive ..."` variants) | `SENTRY_IGNORED_ERROR_PATTERNS` |
| Captured "exception" is really a plain object with a fixed set of keys (e.g. DOM events) | `SENTRY_IGNORED_ERROR_KEY_SETS` |

Add the entry, keep entries alphabetized within the array (the existing file is roughly so), and never delete an existing entry unless the user asks.

Before editing, read the file. After editing, run the typecheck:

```bash
yarn workspace rabby-mobile typecheck
```

Do not commit unless the user asks — silencing noise is a one-line config change, but the Sentry archive is a non-reversible bulk action that the user should review first.

## 5. Report

Format the report exactly like this so the user can scan it in 10 seconds:

```
# Sentry Triage — rabby-mobile <version>

## Needs attention (<count>)
- **RABBY-MOBILE-XXX** — <one-line description>
  - Stack: <file>:<line> → <file>:<line>
  - Why: <one sentence root cause hypothesis>
  - Owner: <team/area>

## Silenced (<count>)
- **RABBY-MOBILE-YYY** — <reason for silencing>
  - Rule added: `SENTRY_IGNORED_ERROR_MESSAGES` / `SENTRY_IGNORED_ERROR_PATTERNS`
  - Archived in Sentry: yes

## Skipped / kept
- <anything the user should still look at manually>
```

Always include the Sentry permalink for each "needs attention" issue so the user can deep-dive in the UI.

## Rules

- **Subagents fetch and classify only.** They never archive, never edit `sentry.ts`, never commit. All destructive actions live in the main agent, gated on explicit user approval.
- **Never archive or edit `sentry.ts` without showing the user the list first.** The skill produces the list, the user approves, then the skill executes the bulk action.
- **Never run a destructive command in one shot.** Always list affected issues with their short IDs and reasons before any `sentry issue archive` or before editing `sentry.ts`.
- **Dispatch all per-issue subagents in one message.** Sequential subagent calls defeat the parallelism the skill is designed for.
- **Prefer a single regex over many literal entries.** If five archived issues all match the same shape, write one pattern that covers all five.
- **Re-run the query after silencing.** The number of "needs attention" should drop; if it does not, the ignore rule is wrong and needs to be revised.
- **Keep the skill idempotent.** Running it twice on the same data should not produce a different result unless the underlying Sentry state changed.
