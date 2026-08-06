---
name: mobile-perf-hooks
description: When editing stores, hooks, lists, Home-path logic, or mounted-but-inactive Screens in `apps/mobile`, design APIs around minimal state, update locality, reusable derived data, and activity-aware subscriptions instead of exposing broad raw state to React consumers.
---

# Mobile Perf Hooks

When changes involve the areas below, design hooks, selectors, and store APIs with this guide in mind:

- `src/store/**`
- `src/hooks/**`
- `src/screens/Home/**`

The goal is not to make store state easier to grab. The goal is to keep
subscription boundaries small, place updates at the narrowest stable owner,
pause React publication when a mounted scene is inactive, and keep render
impact predictable.

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

### 4. Put Subscriptions At The Narrowest Stable Owner

Choose the subscriber from the update pattern rather than applying one
container-or-leaf rule everywhere.

- A scene container should subscribe once when several children consume the
  same derived summary and should update together.
- An independently changing row, card, badge, icon, or menu affordance should
  subscribe at that leaf when lifting its state would rerender an unrelated
  parent or list.
- Long lists should keep identity in the list and let rows resolve mutable
  data by stable ID where practical. Do not rebuild the full item payload just
  because one item changed.
- Do not make a parent subscribe to state used only by one child merely to
  avoid another Hook call.
- Do not let several siblings independently recompute the same expensive
  scene summary.

For shared summaries, prefer:

```tsx
const summary = useSceneSummary(scene);

return (
  <>
    <Header total={summary.total} />
    <Chart points={summary.points} />
  </>
);
```

Over letting each child subscribe and aggregate the same inputs independently.

For independent rows, prefer a stable ID plus a narrow row selector over
passing a large mutable object through the parent list.

### 5. Pause React Publication For Inactive Scenes

A React Navigation Screen can remain mounted after it loses focus. Store and
network updates behind it can still consume the JS thread and delay navigation
elsewhere.

- Use the established `ScreenStoreActivityProvider` or `StoreActivityProvider`
  boundary and `useActivityStore` for expensive Screen-owned subscriptions.
- Inactivity pauses Store notifications to React consumers; it must not stop
  source Store updates, required network convergence, persistence, or business
  side effects.
- On reactivation, consumers must catch up once from the latest source
  snapshot. Do not replay every intermediate hidden update.
- Do not substitute route freezing or unmounting when notification gating is
  sufficient; freezing and restoration have their own cost and semantics.
- Hooks used both inside and outside an activity boundary must preserve the
  established always-active fallback outside the boundary.
- Keep critical global state active when correctness depends on observing
  every transition rather than only the latest snapshot.

For Home, audit the overview and all asset tabs. Position cards, balances,
24-hour changes, badges, selectors, and hidden tab content can each retain a
broad subscription even after the main list is optimized.

### 6. Collapse Derived Computation Into One Pass

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

### 7. Clean Up Residual Wide Subscriptions During Migrations

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

### 8. Treat Account-Derived Work As Shared Work

- Account-related logic is not always the main bottleneck, but repeated account shaping is still repeated cost.
- Sorting, filtering, top-N selection, and display-address shaping should not be recomputed independently in many consumers.
- If multiple consumers depend on the same ordering or display set, compute it once at a higher layer and reuse it.

The question is not whether a hook is allowed. The question is whether the same work is being repeated across the page.

### 9. Design APIs To Prevent Misuse

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

## Recommended Decision Order

When adding a hook or changing store exposure, reason in this order:

1. What does the scene need to show?
2. Which values update together, and which update independently?
3. What is the minimum state required by each update owner?
4. Can shared derived state be produced once at scene level?
5. Should independent rows/cards subscribe narrowly by ID?
6. Can this Screen remain mounted while inactive, and should its React
   notifications pause?
7. Does this API encourage callers to grab a large object and split it
   themselves?

If the answer to step 7 is yes, redesign the API before accepting the pattern.

## Self-Review Checklist

Before merging changes in this area, check:

- Am I exposing large raw store state directly to hooks or components?
- Is this scene consuming only the state it actually needs?
- Is the same scene-level derived result being recomputed in several consumers?
- Can that derived result move into a scene selector or container?
- Is a parent subscribed only because one independent child needs the value?
- Should a long-list row resolve mutable data from a stable ID?
- Does a hidden-but-mounted Screen continue receiving Store notifications?
- Does reactivation catch up from the latest snapshot without losing final
  business state?
- Are there residual broad subscribers still sitting in the same path?
- Am I scanning the same inputs multiple times when one pass would do?
- Does the API limit misuse, or does it encourage misuse?

## Preference Order

Prefer this direction:

1. define scene needs and update locality first
2. pick minimal state at the selector layer
3. derive shared summaries once at scene level
4. let independent children subscribe narrowly by stable identity
5. pause React publication while an eligible mounted scene is inactive
6. catch up from the latest snapshot when it becomes active

Avoid this direction:

1. expose a large raw state object
2. let hooks or components pick from it locally
3. aggregate again in multiple consumers
4. try to recover later with memoization or extra component splitting

If a new requirement seems to need access to the whole store first, treat that as an API design smell before treating it as a valid default.
