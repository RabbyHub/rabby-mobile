---
name: db-sync-write-scheduler
description: Use when changing Rabby Mobile database write paths, resource sync persistence, TypeORM/op-sqlite executeBatch/upsert code, app-data-source reset, clear-cache behavior, or Android performance work involving JS-to-native database writes.
---

# DB Sync Write Scheduler

Use this skill before editing code that writes app data into SQLite or changes how those writes are scheduled.

## Rule

Bulk, repeated, resource-refresh, or cache-sync database writes must be scheduled. Do not add direct `executeBatch`, TypeORM `upsert`/`save`, manager writes, or ad hoc transactions from UI, hook, store, service, startup, or unlock code when the work can contend with normal resource sync.

The JS-to-native database write path is performance-sensitive on Android. Even with `executeBatch`, SQL parameters cross from JS to native and can affect JS/JSI/native responsiveness. Treat these writes as work that needs backpressure, not as ordinary async calls.

## Expected Pattern

Use or extend the existing DB sync infrastructure:

- `apps/mobile/src/databases/sync/scheduler.ts`
- `apps/mobile/src/databases/sync/_task.ts`
- `apps/mobile/src/databases/sync/abort.ts`
- `apps/mobile/src/core/utils/startupDiagnostics.ts`

A scheduled write should define:

- `taskFor`: stable data family name
- owner/task key: stable enough for merge, replacement, and diagnostics
- priority: low/normal/high based on user-visible urgency
- abort handling: clear-cache and DB reconnect must stop queued and pending writes
- coalescing: repeated account/resource refreshes should merge before hitting DB
- diagnostics: row count, batch count, stage, method, batch duration, and errors

## executeBatch

When touching `executeBatch` or prepared-upsert paths:

- separate `params_build` timing from native `execute_batch` timing
- do not assume fewer JS calls means better interaction if one native call becomes too large
- tune batch size and priority using diagnostics from a release-like Android package
- avoid building SQL strings in hot loops
- prefer statement reuse and structured params over per-row SQL text

## Startup, Unlock, And Clear Cache

- Do not start non-essential DB writes before the first screen is responsive.
- During unlock-critical work, defer non-critical persistence when the UI can render from memory or stale cache first.
- Clear-cache and data-source reset flows must abort scheduler work and pending coalesced writes before dropping DB state.

## Validation

For meaningful DB write changes, run the normal mobile validation for the touched code and inspect scheduler diagnostics on Android when the path affects startup, unlock, Home, token, DeFi, NFT, or appchain data.
