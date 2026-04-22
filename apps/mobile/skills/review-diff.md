---
name: mobile-review-diff
description: When reviewing your own `apps/mobile` changes, inspect the actual diff for semantic drift, widened subscriptions, fallback removal, and "unknown became 0" regressions. Use this before trusting refactors that mostly move store, hook, scene, or resource-flow code around.
---

# Mobile Review Diff

Use this when you need to review your own `apps/mobile` diff, especially after store, hook, scene, selector, or resource-flow refactors.

Lint, typecheck, and "it still renders" are not enough. This review is for business-semantic drift that compiles cleanly.

## Findings First

- Report findings before summaries.
- Prioritize:
  - business behavior changes
  - hidden source-of-truth swaps
  - widened subscription scope
  - silent fallback changes such as `undefined -> 0`

## What To Check

### 1. Address Set Provenance

- Confirm each scene-level collection still comes from the correct source.
- Common examples in this repo include:
  - `top10Addresses`
  - `displayAddresses`
  - `selectedAddresses`
  - filtered account lists
  - chain-specific or origin-specific subsets
- Do not accept a replacement just because both are "lists of things".
- If one source was swapped for another during debugging, treat that as suspicious until proven correct.

### 2. Unknown vs Zero

- Look for changes like:
  - `value ?? 0`
  - `value || 0`
  - `balance?.toFixed(...) || 0`
- Ask whether the old code distinguished:
  - no snapshot yet
  - loading
  - true zero
- In this app, collapsing `unknown` into `0` often causes:
  - fake `$0`
  - wrong sort order
  - wrong badges
  - wrong eligibility checks
  - incorrect scene summaries

### 3. Source Of Truth Drift

- Check whether a value used to come from:
  - a view model attached to list items
  - a scene summary store
  - a resource store
  - a cache-backed store
  - a derived hook
- Repo examples include:
  - account objects
  - balance store
  - appchain store
  - scene summary
- If the source changed, verify the semantic contract still matches.
- "More direct" is not automatically better if the old source intentionally carried fallback or preloaded values.

### 4. Widened React Dependencies

- Check for broad objects added to `useMemo` / `useCallback` / selectors:
  - maps
  - dictionaries
  - full store slices
  - whole account arrays when only one key is needed
- Prefer exact-key subscriptions and stable scene-derived inputs.
- Re-read `apps/mobile/skills/perf-hooks.md` if you see dictionary-like dependencies.

### 5. Snapshot Identity And Row Stability

- For list/resource refactors, verify unchanged items keep stable references.
- Updating one unit should not rebuild every row object.
- Watch for new code that recreates:
  - scene arrays
  - lookup maps fed into downstream memos
  - merged row view models for every render

### 6. Optimistic Mutations

- If UI was made "faster" with optimistic state, check whether it changed semantics:
  - rows disappearing before persistence succeeds
  - dependent data clearing before the owning entity actually commits
  - temporary states exposed outside the scene that needs them
- Prefer committing state at the business boundary that already defines success.

## Repo-Specific Smell Examples

These are examples, not the whole skill:

- `top10Addresses` replaced by `displayAddresses`
- balance snapshots treated as ready `0`
- refactors that move a value from item view model to store lookup and silently lose fallback behavior
- deleting a unit from dependent stores before the owning store has actually committed removal

## Useful Diff Patterns

- Start with targeted searches in the diff:
  - `displayAddresses`
  - `top10Addresses`
  - `selectedAddresses`
  - `resourceKey`
  - `flow`
  - `|| 0`
  - `?? 0`
  - `balance`
  - `evmBalance`
  - `totalBalance`
  - `useMemo(`
  - `useCallback(`
- Then open the surrounding files and compare the data source, not just the final UI text.

## Review Standard

Before calling the diff safe, confirm:

- the same business concept still comes from the same source
- loading and unknown states were not flattened into zero
- scene-specific collections still use the right provenance
- no broad subscription or dictionary dependency was introduced
- optimistic updates did not move persistence work back into the visible UI path

If any of those are unclear, treat it as a finding, not a note.
