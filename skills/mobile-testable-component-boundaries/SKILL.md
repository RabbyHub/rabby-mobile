---
name: mobile-testable-component-boundaries
description: Use when adding deterministic non-production testing, typed behavior injection, lifecycle observation, or future performance instrumentation to a Rabby Mobile Screen, reusable component, or local feature boundary while preserving production behavior and excluding test implementations from production builds.
---

# Mobile Testable Component Boundaries

Use this skill when a Screen or component needs to be exercised deterministically inside a real app lifecycle without relying only on coordinate taps. The current regression framework implements testability. Performance measurement may reuse the same boundaries later, but must be designed and validated as separate work.

## Goals

- Exercise real components, navigation, stores, services, and business functions.
- Add the smallest typed seam needed to provide test input or observe results.
- Keep normal regression-package behavior unchanged unless an explicit scenario is armed.
- Make production behavior equivalent to having no test feature.
- Prefer build-time exclusion over hoping Metro removes inactive runtime branches.

`Screen` is only one target kind. A target may also be a reusable component or a local feature region. Do not create a second test framework for non-Screen components.

## Required Gates

Test behavior may run only when all gates pass:

1. The build is non-production.
2. The persistent local opt-in switch is enabled.
3. A valid, explicit, unexpired command targets the scenario and target.
4. A one-shot action has not already been claimed for the current run.

If any gate fails, the component must preserve its ordinary render, handlers, state transitions, and service calls.

Never put real credentials in a deep link, event payload, log, screenshot name, or persisted scenario command. Use a known non-sensitive test fixture or credential profile.

## Choose The Narrowest Boundary

Use an HOC or boundary when readiness, test context, or lifecycle applies to the whole target. This is the default for Screens and reusable components.

Use a typed optional prop when a test must invoke an existing internal handler, fill a controlled field, or bypass manual input. The prop must disappear semantically when absent.

Use a context Hook when a deeply nested child needs scenario state and threading props would distort the production API. Do not make every child subscribe independently.

Use a coordinator or extracted business function when no React-local state is required. The normal UI and the scenario must call the same business implementation.

Do not:

- expose components or services through `globalThis`;
- monkey-patch business methods;
- duplicate a submit, unlock, import, or persistence algorithm in test code;
- scatter `__DEV__` checks through business components;
- automate an internal action with screen coordinates when a typed boundary can invoke it;
- use `any` for injected props or command parameters.

## Build-Time Isolation

Import test infrastructure through stable aliases only:

```ts
import {
  withRegressionScenario,
  useRegressionScenario,
} from '@/devtools/regressionScenarios/react';
```

Resolve those aliases to paired implementations at build time:

- `.nonprod.tsx`: subscriptions, HOC, Hook, coordinator, and event collection.
- `.prod.tsx`: identity HOC, frozen inactive Hook result, and `null` Host.

The selected implementation must be included in the Babel or Metro cache key. Common production code must never import a `.nonprod` module directly.

For heavy or sensitive instrumentation, use stronger graph exclusion:

- put the wrapper composition, injected-prop construction, fixtures, and test-only dependencies in a `.nonprod` module;
- make the paired `.prod` module export the original component directly;
- keep shared contracts type-only with `import type`.

This removes the non-production module from the production dependency graph. A runtime `if (__DEV__)` alone does not guarantee tree-shaking in Metro.

## Typed Component Pattern

Keep the injected contract local to the component that consumes it:

```ts
export type UnlockRegressionProps = {
  regressionScenario?: {
    runId: string;
    password: string;
    autoSubmit: boolean;
    claimAutoSubmit: () => boolean;
    report: RegressionReporter;
  };
};
```

Build the injection at the composition boundary:

```tsx
const RegressionUnlockScreen = withRegressionScenario(UnlockScreen, {
  screen: 'Unlock',
  injectProps: context => ({
    regressionScenario: {
      runId: context.runId,
      password: TEST_PASSWORD,
      autoSubmit: context.action === 'start',
      claimAutoSubmit: () => context.claimOnce('unlock:auto-submit'),
      report: context.report,
    },
  }),
});
```

Inside the target, guard the narrow effect and call the existing handler:

```ts
useEffect(() => {
  if (!regressionScenario?.autoSubmit) {
    return;
  }
  if (!regressionScenario.claimAutoSubmit()) {
    return;
  }
  submitExistingForm(regressionScenario.password);
}, [regressionScenario, submitExistingForm]);
```

The effect must be replay-safe across rerenders, focus changes, remounts, and app restarts. Prefer a run-scoped `claimOnce` guard over timing guesses.

If the HOC wraps a component that exposes a ref or required static fields, preserve them with `forwardRef` or the established static-hoisting pattern. Do not silently change the component's public API.

## Extending Beyond Screens

The current regression contracts identify Screens. Before instrumenting ordinary components, extend the shared contract to represent a generic target, for example:

```ts
type RegressionTarget =
  | { kind: 'screen'; id: RegressionScreenId }
  | { kind: 'component'; id: RegressionComponentId };
```

Keep navigation focus events Screen-specific. Generic targets may report mount, visible state when known, action start, and postcondition events. Do not pretend a component is a Screen merely to reuse an identifier.

## Preserve Business Semantics

Use `develop` as the reference for the component's intended behavior unless the task explicitly changes product semantics.

- Keep the original handler and its ordering.
- Extract a reusable business function only when both the normal Hook and the test coordinator need it.
- Do not turn a synchronous product decision into an unresolved asynchronous test boundary.
- Let eventual stores and services converge exactly as they do in normal use.
- Report an assertion only after the real postcondition is observable.

Current examples:

- `apps/mobile/src/devtools/regressionScenarios/react.nonprod.tsx`
- `apps/mobile/src/devtools/regressionScenarios/react.prod.tsx`
- `apps/mobile/src/AppNavigation.tsx`
- `apps/mobile/src/screens/Unlock/Unlock.tsx`
- `apps/mobile/src/screens/Navigators/AddressNavigator.tsx`
- `apps/mobile/src/screens/SyncExtension/SyncExtensionPasswordScreen.tsx`
- `apps/mobile/src/hooks/address/useSetupWallet.ts`

## Future Performance Measurement

Performance measurement may use the same target boundary to mark lifecycle and action phases, but must not perturb the measured path:

- record monotonic timestamps and small structured events in memory;
- avoid file I/O, synchronous serialization, toast rendering, screenshots, or network work on the hot path;
- flush only during idle time or an explicit export action;
- distinguish action execution from network wait, native wait, and render completion;
- keep production collection compiled out unless a separately reviewed product telemetry design requires it.

Do not claim performance instrumentation exists merely because the test boundary exists.

## Validation

For every new target:

1. Confirm the production alias resolves to the identity or direct-export implementation.
2. Confirm a non-production build with the persistent switch off behaves normally.
3. Confirm a missing, invalid, expired, or mismatched command behaves normally.
4. Confirm only the targeted component receives injected behavior.
5. Confirm remounting or refocusing does not replay one-shot actions.
6. Verify both locked and unlocked launch paths when the target depends on wallet state.
7. Run the repository type, lint, cycle, and relevant test checks.
8. Inspect logs and persisted commands for leaked credentials or excessive payloads.
