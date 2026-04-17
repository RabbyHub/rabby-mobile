---
name: mobile-perf-startup-loadables
description: When editing startup path, AppNavigation, navigator loading, bundle splitting, or startup diagnostics in `apps/mobile`, keep the Unlock/GetStarted hot path small, use the generated loadables flow correctly, and avoid dev-time bundle churn that hides import-graph problems.
---

# Mobile Perf Startup Loadables

When changes involve the areas below, use this guide:

- `src/App.tsx`
- `src/AppNavigation.tsx`
- `src/setup-app-before-render*`
- `src/screens/Navigators/**`
- `src/perfs/**`
- `src/debug/startupProbe.ts`
- `babel.config.js`
- `scripts/generate-loadables-dev.cjs`

This playbook came from a real Android startup investigation. The main lesson was that startup latency was not explained by one hook or one balance fetch alone. The bigger factor was the amount of navigation tree and import graph work pulled into the app before Unlock or Get Started became usable.

## Core Findings

### 1. Startup Cost Often Comes From Tree Shape, Not One Slow Task

- If Unlock appears late, first suspect what is being imported, registered, or mounted before it.
- A large navigation tree can delay:
  - `APP_ROOT_LAYOUT`
  - Unlock render readiness
  - route registration
  - later screen availability after Unlock
- Device differences can be large. A change that looks fine on one Android device can still stall badly on another.

Do not assume "it is only a balance hook" or "it is only biometrics" before checking the startup path as a whole.

### 2. Use A Hot / Warm / Cold Loading Policy

Do not choose between "everything eager" and "everything lazy". Use explicit priority buckets instead.

- Hot path:
  - Unlock
  - Get Started
  - wallet import / setup entry screens
  - root navigation needed immediately after launch
- Warm path:
  - screens likely to be opened right after Unlock
  - navigators behind the most common home shortcuts
  - a very small set of post-Unlock preload targets
- Cold path:
  - deep detail screens
  - uncommon navigators
  - dev-only screens
  - global portals, popups, or modals that are not needed to make the first screen usable

If a component is not required to make the first meaningful screen usable, question why it is in the hot path.

### 3. Keep Global Mount Pressure Low

- Do not mount unrelated global modal, popup, or portal trees during startup just because they are globally reachable.
- Prefer collecting global app-navigation-only lazy entries in a dedicated module instead of importing them inline all over `AppNavigation.tsx`.
- If a feature can wait until after Unlock, it should not compete with Unlock render.

The first goal is not "the whole app is ready". The first goal is "the first required screen is usable".

## Dev vs Prod Policy

### 4. Treat `__DEV__` And Production Differently

For this codepath, development ergonomics and production startup optimization should not use the same loading behavior.

- In `__DEV__`:
  - prefer direct imports via generated `.dev.ts` loadable sidecars
  - avoid real bundle splitting churn for every route
  - keep cycle problems visible
  - avoid creating extra Metro requests that make local debugging slower or noisier
- In non-dev builds:
  - use `react-native-bundle-splitter` through the `.prod.ts` definitions
  - lazy-load warm and cold routes explicitly
  - preload only a small, justified set of follow-up targets

If a loading policy makes Metro thrash, causes OOMs, or hides cycles during development, it is not a good default for `__DEV__`.

### 5. Do Not Use Bundle Splitting To Hide A Bad Import Graph

Bundle splitting is useful after the import graph is sane. It is not a substitute for cleaning the graph.

- First remove cycles and bad high-level imports.
- Then split warm and cold routes.
- Then add targeted preload where it measurably helps.

If bundle splitting is fighting the graph instead of helping it, fix the graph first.

## Loadables Contract

### 6. `*.prod.ts` Is The Source Of Truth

Under `src/perfs/loadables/`:

- hand-edit `*.prod.ts`
- generated `*.dev.ts` mirrors use direct exports for development
- generated default `*.ts` files re-export the `.prod.ts` modules

Do not hand-edit generated files.

### 7. `registerAppScreen` Loaders Must Resolve To Default Exports

Use this shape:

```ts
export const SomeScreen = registerAppScreen<
  typeof import('@/screens/SomeScreen').SomeScreen
>({
  loader: () =>
    import('@/screens/SomeScreen').then(m => ({
      default: m.SomeScreen,
    })),
});
```

Rules:

- loader should resolve to `{ default: Component }`
- do not rely on named-export extraction config in app code
- do not introduce app-level `namedExports` conventions
- keep the contract aligned with the default-export shape expected by the registration helper

This keeps the generated dev sidecars predictable and avoids subtle runtime mismatches.

### 8. Generated Files And Scripts

Key files:

- `src/perfs/loadables/*.prod.ts`
- `scripts/generate-loadables-dev.cjs`
- `scripts/loadables-aliases.generated.cjs`
- `babel.config.js`

Useful commands:

```bash
yarn workspace rabby-mobile loadables:generate
yarn workspace rabby-mobile loadables:generate:stage
yarn workspace rabby-mobile perf:babel-loadables
```

Notes:

- `loadables:generate` creates `.dev.ts`, default `.ts`, and the generated Babel alias map
- Babel reads the generated alias file instead of scanning the filesystem at runtime
- `perf:babel-loadables` exists to prove Babel really resolves loadable aliases to the dev or prod target

### 9. Generated Files Should Stay Out Of Auto-Fix Flows

- Generated loadable sidecars are intentionally excluded from app-level ESLint fix coverage.
- Hand-authored `*.prod.ts` files remain lintable.
- If commit hooks or formatter automation start rewriting generated files again, fix the ignore boundary instead of editing generated output by hand.

## Preload Rules

### 10. Preload Only After The First Required Screen Is Safe

Preload should start only after the startup-critical screen is already available.

Good triggers include:

- after Unlock mounts and stabilizes
- after the first safe post-Unlock frame
- after the app is clearly past first-screen render

Do not preload warm routes so early that they steal time from Unlock or Get Started.

### 11. Preload A Few High-Probability Targets, Not Everything

Good preload candidates are:

- the transaction flow behind Send / Swap / Bridge
- Settings if it is a frequent early tap
- other short, common follow-up routes with proven user value

Bad preload candidates are:

- large batches of unrelated screens
- dev-only navigators on normal startup
- whole trees that are unlikely to be touched in the current session

Preload should be justified by likely next action, not by convenience.

## Cycles And Import Hygiene

### 12. Keep The Entry Graph Cycle-Free

Cycles around startup code create the worst kind of bugs:

- timing-dependent initialization failures
- undefined service access
- hidden eager loads
- behavior that looks fine only when `inlineRequires` masks it

Use:

```bash
yarn workspace rabby-mobile lint:cycles
yarn workspace rabby-mobile perf:entry-tree
```

Current cycle tooling expectations:

- `apps/mobile/.madgerc` skips type-only imports
- cycle cleanup should prefer moving shared leaf logic down, not adding more top-level indirection

### 13. Prefer Deferred Readiness Over Dubious Sync Accessors

When a cycle appears because one module needs a service "right now", prefer:

- deferred initialization
- a `serviceReady` style promise
- moving shared pure logic into a lower-level leaf module

Avoid patterns that only work when startup order happens to be favorable.

Especially for startup code, "sync accessor but hope it is initialized" is usually a trap.

## Diagnostics

### 14. Keep Startup Instrumentation Filterable And Gated

Startup instrumentation is useful when it stays cheap and easy to filter.

- keep the `[startup-probe]` log prefix
- keep it gated to Android non-public production builds
- keep user-facing enablement behind app settings for the next launch
- prefer stage markers that answer:
  - did JS start
  - did root layout happen
  - did Unlock mount
  - did Unlock layout
  - did route change
  - did deferred work start too early

Probe logs are most useful when they explain which stage is late, not just that startup felt slow.

## Review Checklist

Before merging startup-path changes, check:

- Does this import or mount work belong in the hot path?
- Would removing this from startup make Unlock or Get Started appear sooner?
- Is this route hot, warm, or cold?
- Should this be eagerly imported, lazily loaded, or post-Unlock preloaded?
- Does the `__DEV__` behavior help debugging, or does it create Metro churn?
- Did I edit only `*.prod.ts`, not generated loadable files?
- Does the loader resolve to `{ default: Component }`?
- Did I re-run `loadables:generate` after touching loadable definitions?
- Did I check for entry cycles after changing startup imports?
- If I added logs, are they gated, prefixed, and actionable?

## Preference Order

Prefer this order:

1. make the startup import graph sane
2. keep Unlock / Get Started hot path minimal
3. split only warm and cold routes
4. add a very small amount of targeted preload
5. keep `__DEV__` optimized for clarity, not fake startup wins
