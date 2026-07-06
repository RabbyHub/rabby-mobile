---
name: mobile-db-sync-writes
description: When editing Rabby Mobile SQLite persistence, resource cache sync, TypeORM/op-sqlite executeBatch/upsert code, app-data-source reset, or clear-cache behavior, route bulk writes through the DB sync scheduler with coalescing, abort, and diagnostics.
---

# Mobile DB Sync Writes

Use this guide for any `apps/mobile` change that writes app data into SQLite or changes scheduling around those writes.

## Core Rule

Bulk, repeated, resource-refresh, or cache-sync writes must go through the DB sync scheduler. Do not add direct `executeBatch`, TypeORM `save`/`upsert`, manager writes, or custom transactions in UI, hook, store, service, startup, or unlock paths when that write can contend with resource sync.

Small one-off local mutations can be direct only when they are not repeated, not bulk, not on startup/unlock/Home refresh paths, and not part of resource cache synchronization.

## Why

`executeBatch` is native-backed, but it is still a JS-to-native write boundary. SQL parameters and large data payloads crossing this boundary can occupy JS/JSI/native execution time and cause Android responsiveness problems. Database persistence should be treated as scheduled work with backpressure.

## Required Shape For Repeated Writes

A repeated or bulk write path should provide:

- a stable `taskFor` data family
- a stable owner/task key for merge, replacement, and diagnostics
- scheduler priority based on user-visible urgency
- coalescing before DB write when several refreshes target the same family
- abort support for clear-cache, DB reconnect, stale refresh, and owner replacement
- diagnostics for row count, batch count, method, stage, batch duration, and errors

Prefer extending:

- `src/databases/sync/scheduler.ts`
- `src/databases/sync/_task.ts`
- `src/databases/sync/abort.ts`
- `src/core/utils/startupDiagnostics.ts`

## executeBatch Guidance

When changing prepared-upsert or `executeBatch` code:

- measure `params_build` separately from `execute_batch`
- avoid per-row SQL string construction in hot paths
- reuse statements and pass structured params where possible
- keep batch size large enough to avoid excessive round trips, but small enough that one call does not monopolize interaction time
- validate with release-like Android diagnostics when the path affects user-visible flows

## Startup, Unlock, And Reset

- Do not run non-essential persistence before the first screen is responsive.
- During unlock-critical work, defer non-critical persistence if the scene can render from memory or stale cache first.
- Clear-cache and app-data-source reset must abort scheduler work and pending coalesced writes before dropping DB state.

## Review Checklist

Before handoff:

- Does the write go through scheduler infrastructure when it can be repeated or bulk?
- Can repeated refreshes merge or replace instead of queueing duplicate DB work?
- Can clear-cache and DB reconnect abort queued, active, and pending coalesced work?
- Are row count, batch count, stage, method, duration, and errors observable?
- Was Android behavior checked when this touches startup, unlock, Home, token, DeFi, NFT, or appchain data?
