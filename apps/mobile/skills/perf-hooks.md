---
name: mobile-perf-hooks
description: When editing store, hooks, or Home-path logic in `apps/mobile`, design APIs around scene-picked minimal state, reusable scene-level derived data, and controlled subscriptions instead of exposing large raw store state to React consumers.
---

# Mobile Perf Hooks

When changes involve the areas below, design hooks, selectors, and store APIs with this guide in mind:

- `src/store/**`
- `src/hooks/**`
- `src/screens/Home/**`

The goal is not to make store state easier to grab. The goal is to keep subscription boundaries small, derived data stable, and render impact predictable.

## Core Principle

Do not expose large raw store state directly to React hooks, contexts, or high-level components.

Instead, answer these questions first:

1. What does the scene actually need to render?
2. Can that state be picked at the store or selector layer first?
3. Can the derived result be computed once at scene level and reused?
4. Does this API encourage callers to grab a large object and split it locally?

If a design pushes callers toward taking a big chunk of raw state, then filtering, merging, and recomputing it inside components, the API direction is usually wrong.

## Rules

### 1. Start From Scene Needs, Not Store Shape

- Define what the page, module, or component actually needs first.
- Do not expose a large store slice just because the store already has it.
- A scene should consume only the state it truly needs, not the store's full internal shape.
- If a page only needs:
  - one balance summary
  - one loading summary
  - one 24h summary
    then expose those results instead of the entire backing state.

### 2. Expose Scene-Ready State, Not Raw Store State

- A store's internal structure should not automatically become the hook API.
- Hook APIs should prefer:
  - the smallest state the scene actually needs
  - already-derived values
  - stable, reusable consumption shapes
- Do not push components toward taking a large state object and then locally doing:
  - pick
  - merge
  - compute
  - filter
  - summarize

The more components do this work independently, the easier it is for duplicated computation and rerender fan-out to spread.

### 3. Compute Scene-Level Derived Data Once

- If multiple consumers need the same summary for the same input set, compute that summary once in a scene selector, store selector, or scene container.
- Do not let multiple consumers rebuild the same derived payload independently.
- A scene-level result should:
  - aggregate in one place
  - stay as stable as possible
  - be reused as widely as possible
  - be returned in a shape the next layer can consume directly

Prefer:

```ts
const summary = useSceneSummary(scene);
```

Over:

```ts
const partA = ...
const partB = ...
const partC = ...
const summary = computeSummary(partA, partB, partC);
```

If the second pattern shows up in several components, cost multiplies quickly.

### 4. Let Containers Subscribe; Let Children Render

- Scene or page containers should own the main subscriptions.
- Child components should usually receive:
  - primitive props
  - small stable view models
  - already-derived results
- Do not let sibling components reconnect to the same store inputs independently.
- If header, overview, chart, and summary all depend on the same scene data, lift the subscription and pass results down.

Prefer:

```tsx
const summary = useSceneSummary(scene);

return (
  <>
    <Header total={summary.total} />
    <Chart points={summary.points} />
  </>
);
```

Over letting each child subscribe and aggregate on its own.

### 5. Collapse Derived Computation Into One Pass

- When multiple flags, counters, and totals come from the same input list, derive them in one pass whenever practical.
- Avoid repeatedly scanning the same array in the same render path.
- Values that often belong in one pass include:
  - totals
  - `hasAny...`
  - `isAnyLoading`
  - `isAnyLoadingWithoutValue`
  - `isAnyFetchingRemote`
  - missing keys
  - loading keys

Prefer:

```ts
const derived = items.reduce(
  (acc, item) => {
    if (item.value) {
      acc.total += item.value;
      acc.hasAny = true;
    }
    if (item.loading) {
      acc.isAnyLoading = true;
      acc.loadingKeys.push(item.key);
    }
    return acc;
  },
  {
    total: 0,
    hasAny: false,
    isAnyLoading: false,
    loadingKeys: [] as string[],
  },
);
```

The exact syntax matters less than avoiding repeated work over the same inputs.

### 6. Clean Up Residual Wide Subscriptions During Migrations

- A slow scene is rarely caused by only one main hook.
- Small widgets and side helpers can still keep update fan-out alive if they hold overly broad state.
- When refactoring a scene, audit nearby consumers such as:
  - headers
  - list rows
  - chart wrappers
  - summary widgets
  - pinned sections
  - loading or refresh helpers
  - lightweight notification components

Do not optimize the main path while leaving broad side consumers untouched.

### 7. Treat Account-Derived Work As Shared Work

- Account-related logic is not always the main bottleneck, but repeated account shaping is still repeated cost.
- Sorting, filtering, top-N selection, and display-address shaping should not be recomputed independently in many consumers.
- If multiple consumers depend on the same ordering or display set, compute it once at a higher layer and reuse it.

The question is not whether a hook is allowed. The question is whether the same work is being repeated across the page.

### 8. Design APIs To Prevent Misuse

- Do not hand large raw state objects to callers in the name of flexibility.
- If an API encourages this pattern:
  - take a large object
  - pick locally
  - aggregate locally
  - repeat in several consumers
    then the API is not safe enough for this codepath.
- Prefer a few narrow, explicit selectors over one heavy "grab everything" entry point.

Good APIs naturally steer callers toward:

- smaller subscription scope
- more stable derived results
- less repeated computation
- less repeated rendering

### 9. Do Not Depend On Wide Dictionaries In Memoized React Code

- Do not put broad dictionary-like objects into `useMemo` or `useCallback` dependency arrays when the scene only needs a few keys.
- Common red flags include:
  - `valueMap`
  - `metaMap`
  - `byAddress`
  - `byChain`
  - `pinAddressesDict`
  - any freshly-built `Record<string, ...>` lookup object
- A wide dictionary dependency usually means:
  - one entry changes
  - the whole dictionary gets a new identity
  - every downstream memo recomputes
  - render fan-out spreads far beyond the changed unit
- Prefer this direction instead:
  - subscribe to the exact key first
  - derive a small primitive dependency first
  - pass the finalized small result down
- If you need a lookup map for one render path, build it in that same render path and consume it immediately. Do not build a broad dictionary, then feed that dictionary into more memoized hooks downstream.

### 10. Preserve Per-Item References Across Snapshot Updates

- For list-like resource families, do not rebuild every item object when only one item changed.
- If one account is added, removed, or updated:
  - unchanged accounts should keep the same object reference whenever practical
  - unchanged rows should not rerender just because the parent snapshot refreshed
- Resource/store migrations should preserve stable references for unchanged units before relying on `useMemo` to recover performance.

## Recommended Decision Order

When adding a hook or changing store exposure, reason in this order:

1. What does the scene need to show?
2. What is the minimum state required for that scene?
3. Can that state be picked at the selector layer first?
4. Can the derived result be produced once at scene level?
5. Can children consume the result without touching raw store state?
6. Does this API encourage callers to grab a large object and split it themselves?

If the answer to step 6 is yes, redesign the API before accepting the pattern.

## Self-Review Checklist

Before merging changes in this area, check:

- Am I exposing large raw store state directly to hooks or components?
- Is this scene consuming only the state it actually needs?
- Is the same scene-level derived result being recomputed in several consumers?
- Can that derived result move into a scene selector or container?
- Do child components actually need to subscribe to store state directly?
- Are there residual broad subscribers still sitting in the same path?
- Am I scanning the same inputs multiple times when one pass would do?
- Am I using a wide dictionary or lookup object as a memo dependency?
- Am I rebuilding unchanged item objects during snapshot refresh?
- Does the API limit misuse, or does it encourage misuse?

## Preference Order

Prefer this direction:

1. define scene needs first
2. pick minimal state at the selector layer
3. derive once at scene level
4. subscribe once at the container layer
5. let children consume finalized results

Avoid this direction:

1. expose a large raw state object
2. let hooks or components pick from it locally
3. aggregate again in multiple consumers
4. try to recover later with memoization or extra component splitting

If a new requirement seems to need access to the whole store first, treat that as an API design smell before treating it as a valid default.
