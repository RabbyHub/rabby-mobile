# Mobile App Log Format

## Purpose

This document defines the on-device log archive format produced by the mobile app.
It is intended for downstream tooling that needs to parse Rabby mobile logs outside
the app itself, for example:

- VS Code extensions
- Desktop log viewers
- Automated support triage tools
- Internal debugging pipelines

The current line protocol version is `@rabby-log/v1`.

## Scope

This document covers:

- archive and file naming
- archive rotation and reuse rules
- per-line log record format
- JSON body schema
- masking behavior
- compatibility expectations for third-party parsers

It does not define:

- UI behavior in the app
- transport / upload APIs
- retention policy knobs beyond the current defaults

## Storage Layout

The app writes logs under an app-private writable root:

```text
<app-document-like-path>/applogs/
```

Each archive is a zip file:

```text
rabby-mobile-logs-YYYY-MM-DD_HH-mm-ss_SSS-NNN.zip
```

Examples:

```text
rabby-mobile-logs-2026-04-10_18-21-06_693-035.zip
rabby-mobile-logs-2026-04-10_18-24-19_104-036.zip
```

Inside each zip, logical log files are stored under a date folder:

```text
logs/YYYY-MM-DD/YYYY-MM-DD_HH-mm-ss_SSS-NNN.log
```

Example:

```text
logs/2026-04-10/2026-04-10_18-21-06_693-035.log
```

## Archive Reuse and Rotation

### Archive-level behavior

The logger prefers to keep writing into a single zip archive:

1. If the current process already has an active archive in memory, continue using it.
2. Otherwise, try to reuse the latest finalized zip archive under `applogs/`.
3. If no finalized zip archive exists, create a new one.

When reusing a finalized archive, the logger reconstructs a new `.zip.partial`
working file from the latest finalized `.zip`, appends new records, and replaces
the old finalized zip on the next finalize.

### Entry-level behavior

Within the selected zip archive, the logger prefers to continue writing into the
latest `.log` entry file.

Rules:

1. If the latest `.log` entry is smaller than the configured threshold, append to it.
2. If the latest `.log` entry would exceed the threshold after the next line, close it.
3. Create a new `.log` entry in the same zip archive.

Current default entry size threshold:

```text
1 MiB
```

### Finalization behavior

The current working archive is finalized when one of these happens:

- the app moves away from `active` app state
- file logging is turned off by policy
- the app explicitly triggers archive finalization from the debug page

### Retention behavior

Before opening a new logical `.log` entry, the logger checks total size of finalized
managed zip archives under `applogs/`.

Current default retention limit:

```text
500 MiB
```

If the total finalized archive size is at or above the limit, the oldest finalized
managed zip archives are deleted first.

Only managed archives matching the current archive prefix are considered.

## Line Protocol

Every log line is a single line of UTF-8 text with this shape:

```text
@rabby-log/v1 ts=<timestamp> lvl=<level> src=<source> method=<method> env=<env> sid=<session-id> seq=<sequence> fmt=json [platform=<platform>] <json-body>\n
```

Example:

```text
@rabby-log/v1 ts=2026-04-10T10:21:06.693Z lvl=warn src=console method=warn env=development sid=2026-04-10_18-20-41_102-abc123 seq=184 fmt=json platform=ios {"message":"[openapi] non-200 request detected","args":["[openapi] non-200 request detected",{"source":"openapi","request":{"method":"get","url":"https://api.example.com/foo"}}]}
```

### Parsing boundary

The header is space-delimited and the JSON body is always appended after a single
space. The version marker is always the first token.

Recommended parser behavior:

1. Check that the line starts with `@rabby-log/`.
2. Read the first token as the protocol version.
3. Parse subsequent `key=value` tokens until the first token that starts with `{`.
4. Treat the remaining substring from `{` to end-of-line as the JSON body.

Parsers should not assume a fixed token count. New header tokens may be added in the
future.

## Header Fields

Current v1 fields:

| Field | Required | Meaning |
| --- | --- | --- |
| `ts` | yes | ISO timestamp from `Date#toISOString()` |
| `lvl` | yes | log level |
| `src` | yes | log source, for example `console` or `logger` |
| `method` | yes | original logging method, for example `log`, `warn`, `error`, `timeEnd` |
| `env` | yes | runtime environment, currently `development`, `regression`, or `production` |
| `sid` | yes | session identifier for the current app runtime |
| `seq` | yes | monotonically increasing per-session sequence number |
| `fmt` | yes | body encoding format, currently always `json` |
| `platform` | no | platform token, currently `ios` or `android` when available |

### Header value normalization

Header values are normalized for safe token parsing:

- whitespace is replaced with `_`
- values are emitted as plain tokens

The JSON body retains the richer original structure.

## JSON Body Schema

The line body is always a JSON object in v1:

```json
{
  "message": "inline human-readable message",
  "args": ["serialized", "arguments"],
  "meta": {
    "optional": "serialized metadata"
  }
}
```

### Body fields

| Field | Required | Meaning |
| --- | --- | --- |
| `message` | yes | truncated human-readable inline message derived from `args` |
| `args` | yes | serialized original log arguments |
| `meta` | no | serialized metadata added by the logger implementation |

## Serializable Value Rules

`args` and `meta` are serialized into JSON-compatible values.

Supported output types:

- `null`
- `boolean`
- `number`
- `string`
- arrays of serializable values
- plain JSON objects whose values are serializable values

### Special conversions

| Input value | Serialized output |
| --- | --- |
| `undefined` | `"[undefined]"` |
| `NaN` | `"[NaN]"` |
| `Infinity`, `-Infinity` | string form, for example `"Infinity"` |
| `bigint` | string with `n` suffix, for example `"123n"` |
| `symbol` | string form from `Symbol#toString()` |
| function | `"[Function <name>]"` |
| `Date` | ISO string |
| `Error` | object with `$type`, `message`, optional `stack`, optional serialized custom fields |
| typed arrays | string like `"[Uint8Array(32)]"` |
| `ArrayBuffer` | string like `"[ArrayBuffer(32)]"` |
| circular reference | `"[Circular]"` |
| deep array/object beyond max depth | compact placeholder string |
| non-plain object | object containing `$type` plus enumerable serialized fields |

### Depth rules

Current serialization depth cap for ordinary values is 6 levels.

Parsers should treat placeholder strings such as these as terminal values:

- `"[Circular]"`
- `"[Array(12)]"`
- `"[Object]"`
- `"[Uint8Array(32)]"`

Exact placeholder wording is part of current behavior but should not be treated as
stable schema for business logic.

## Masking

Sensitive values may be intentionally masked before serialization by wrapping them
through `logger.mask(...)`.

Masked output is intentionally lossy.

Examples of possible masked output:

- `"***"`
- `"*********"`
- `"***[ArrayBuffer]"`
- object fields whose nested leaf values are replaced with `*`

Tooling must not attempt to recover masked values.

## Sources and Methods

Common `src` values:

- `console`
- `logger`

Common `method` values:

- `log`
- `info`
- `warn`
- `error`
- `debug`
- `trace`
- `time`
- `timeLog`
- `timeEnd`
- `assert`

Additional record-specific metadata may appear in the JSON body `meta` field. For
example:

- stack traces for `trace`
- timer labels and durations
- OpenAPI request / response snapshots for instrumented failures

## Session Identifier

`sid` identifies one app runtime session.

Current format:

```text
YYYY-MM-DD_HH-mm-ss_SSS-<random-base36-suffix>
```

Example:

```text
2026-04-10_18-20-41_102-k3v9qd
```

Parsers should treat `sid` as an opaque identifier.

## Ordering Guarantees

Within a single session:

- `seq` is strictly increasing
- records are written in enqueue order

For cross-session analysis:

- use `ts` first
- use `sid` + `seq` for stable ordering inside the same session

## Forward Compatibility

Downstream parsers should follow these rules:

1. Gate behavior by version marker, for example `@rabby-log/v1`.
2. Ignore unknown header tokens.
3. Ignore unknown JSON fields.
4. Do not require a fixed header field order beyond the version token being first.
5. Do not assume only one `.log` file exists inside a zip.
6. Do not assume only one zip exists in `applogs/`.

If a future version is introduced, it should use a new marker, for example:

```text
@rabby-log/v2
```

Version-specific parsers can then branch cleanly.

## Recommended Parser Output Model

External tools should normalize each line into a structure close to:

```json
{
  "version": "v1",
  "header": {
    "ts": "2026-04-10T10:21:06.693Z",
    "lvl": "warn",
    "src": "console",
    "method": "warn",
    "env": "development",
    "sid": "2026-04-10_18-20-41_102-k3v9qd",
    "seq": 184,
    "fmt": "json",
    "platform": "ios"
  },
  "body": {
    "message": "...",
    "args": [],
    "meta": {}
  },
  "rawLine": "@rabby-log/v1 ..."
}
```

## Current Limitations

- Unfinalized `.zip.partial` files are implementation details and should not be
  treated as stable inputs for external tools.
- Time range shown in the in-app archive picker currently uses file
  create/update timestamps rather than log-content-derived start/end timestamps.
- Finalized zip reuse is an implementation detail; tools should rely on file and
  line formats, not on exact archive lifecycle behavior.

## Source of Truth

The implementation source of truth currently lives in:

- `apps/mobile/src/utils/logging/format.ts`
- `apps/mobile/src/utils/logging/rollingZipWriter.ts`
- `apps/mobile/src/utils/logging/core.ts`

If implementation and this document diverge, update both together in the same change.
