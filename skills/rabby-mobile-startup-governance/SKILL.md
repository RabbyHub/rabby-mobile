---
name: rabby-mobile-startup-governance
description: Review or change Rabby Mobile startup stages, module loading, lock/unlock routing, keyring runtime readiness, visible/current account state, first-Home readiness, service/store hydration, or startup-sensitive work without regressing correctness or JS-thread responsiveness.
---

# Rabby Mobile Startup Governance

Treat startup as a governed pipeline rather than an incidental result of
imports. Loading a module early can be acceptable; starting expensive work or
changing lock/account state implicitly during module evaluation is not.

## Protected Startup Invariants

Changes must preserve all of these invariants:

- The initial route is stable and correct for Get Started, locked, and already
  unlocked states.
- Stored-keyring existence, visible-account existence, unlocked state, unlock
  session validity, and keyring runtime readiness remain distinct facts.
- A loaded or registered keyring service is not treated as runtime-ready until
  required keyrings and accounts have been restored.
- The minimal current/selected account context needed by the first visible
  Screen is available without a later default or persisted value overwriting a
  newer route/user choice.
- Locked and already-unlocked launch paths converge to the same correct runtime
  state even though their timing and visible Screens differ.
- Delayed work may change timing, but it must not leave feature services,
  account state, or persisted state permanently incomplete.

## Classify Work Before Moving It

Classify every affected task:

- `module-load`: declarations and registration only; no heavy side effects;
- `startup-critical`: required for safe routing or first-Screen correctness;
- `home-critical`: smallest state needed by the visible Home surface;
- `post-startup`: useful after Home is interactive but not a gate;
- `on-demand`: owned by a feature entry or explicit user action.

Remote refreshes, DB persistence for a future launch, history synchronization,
feature SDK construction, secondary Home-tab hydration, analytics, and most
websocket subscriptions are not startup-critical without a demonstrated
product invariant.

## Registration, Hydration, And Readiness

- Keep top-level imports side-effect-light. Do not hide network, DB, file,
  subscription, timer, SDK, or heavy synchronous work in an import or
  constructor.
- Register launch work centrally through `apps/mobile/src/startup/` and use
  `STARTUP_TASKS` plus `runStartupTask`; do not add feature-local timers or
  untracked startup IIFEs.
- Keep entry files as phase/orchestration surfaces. Business owners export
  idempotent starters; importing an owner must not start the work.
- Treat service `registered`, `loaded`, `runtimeReady`, and data `converged` as
  different states. Use the typed `core/serviceApi` boundary and request the
  readiness actually required by the caller.
- Preserve formerly synchronous business semantics explicitly. A Promise must
  not become a Boolean, map key, request field, or unobserved side effect.
- Deduplicate concurrent first demand, and ensure failures can retry rather
  than leaving a permanently pending readiness Promise.
- Prefer memory-first resource flow. UI state may update before a scheduled DB
  write that exists mainly for the next launch.

Relevant implementation boundaries include:

- `apps/mobile/src/startup/launchPlan.ts`
- `apps/mobile/src/startup/launchTasks.ts`
- `apps/mobile/src/startup/phaseRegistry.ts`
- `apps/mobile/src/startup/startupTaskModules.ts`
- `apps/mobile/src/core/utils/startupTaskManifest.ts`
- `apps/mobile/src/core/utils/startupScheduler.ts`
- `apps/mobile/src/core/serviceApi/`
- `apps/mobile/src/core/apis/lock.ts`
- `apps/mobile/src/store/account.ts`

## Review Procedure

1. Trace the changed state from persisted/native source through route decision,
   service readiness, Store publication, and first consumer.
2. Inspect both direct imports and transitive module reachability. Moving a call
   while retaining an eager side-effect import is not a startup optimization.
3. Identify the synchronous JS prefix of every async function and any native or
   storage call it waits on.
4. Verify that delayed hydration cannot overwrite newer account, route, chain,
   or user-selected state.
5. Confirm first demand works without visiting another Screen that happens to
   initialize the dependency.
6. Confirm cancellation, failure, retry, and repeated demand reach a final
   correct state.

## Required Validation

Run the static startup check for startup-sensitive edits:

```bash
node apps/mobile/scripts/check-startup-governance.cjs
```

Also run focused tests and the normal type/cycle checks. For behavior changes,
validate at least:

- a locked launch through successful unlock and Home entry;
- an already-unlocked launch directly to Home;
- cold or missing local cache and warm persisted state;
- a non-default account and more than one account type when relevant;
- direct first entry into a feature that consumes a deferred dependency;
- final state after delayed initialization and after one retry.

Use `skills/mobile-testable-component-boundaries/SKILL.md` for deterministic
non-production scenarios. Use a release-like Android package and Hermes/native
profiling when the change affects the startup critical path or the responsible
thread cannot be established from diagnostics.

If correctness or performance remains uncertain for startup, unlock, keyring,
or account-state behavior, follow the escalation rule in
`skills/rabby-mobile-performance-review/SKILL.md` and request
`@richardo2016x` review.
