---
name: rabby-mobile-performance-review
description: Assess every Rabby Mobile change for runtime performance impact, with deeper review for startup, unlock/account state, Home, stores, hooks, navigation, lists, I/O, native boundaries, or background work. Use during pull-request review and before handing off performance-sensitive code.
---

# Rabby Mobile Performance Review

Consider performance for every change. The required first step is a reasoned
impact classification, not a benchmark for every diff and not a public comment
when no actionable issue exists.

## Review The Runtime Change

Inspect the diff, surrounding implementation, and affected call sites. Compare
before and after in these dimensions:

- **timing**: startup, first render, route entry, interaction, background, idle;
- **frequency**: once, per focus, per render, per row, per event, per response;
- **thread**: JS, UI, native worker, database, WebView, or network wait;
- **fan-out**: subscribers, rerenders, list items, layouts, bridge calls;
- **lifecycle**: visible, hidden-but-mounted, backgrounded, remounted, restored;
- **correctness**: loading, stale-cache, final convergence, cancellation, retry.

Do not assume that `async` work is off the JS thread, that memoization fixes a
broad subscription, that a hidden Screen is unmounted, or that fewer native
calls are cheaper when each call carries a larger payload.

## Performance Surfaces

Check whether the change introduces or makes newly reachable any of the
following:

- import-time work, IIFEs, constructors, hydration, or eager SDK setup;
- synchronous parsing, normalization, crypto, serialization, or list shaping;
- broad Store/Context subscriptions or unstable selector results;
- parent subscriptions for data consumed only by an independent child/row;
- hidden Screens that continue publishing React updates;
- repeated network requests, DB work, file I/O, or JS/native round trips;
- route-entry work that delays navigation or the first interactive shell;
- animation state on the JS thread, repeated layout, or unstable list keys;
- timers, listeners, polling, websockets, or tasks without cleanup/deduping.

## Mandatory Specialist Routing

Read the matching guide whenever a change reaches one of these surfaces:

| Surface | Required guide |
| --- | --- |
| Startup stages, lock/unlock, keyring readiness, visible/current account state, first route or first Home readiness | `skills/rabby-mobile-startup-governance/SKILL.md` |
| Home, stores, hooks, selectors, lists, render fan-out, or inactive Screen subscriptions | `apps/mobile/skills/perf-hooks.md` |
| SQLite writes, resource persistence, batching, reset, or clear cache | `skills/db-sync-write-scheduler/SKILL.md` |
| Deterministic lifecycle or performance evidence inside the real app | `skills/mobile-testable-component-boundaries/SKILL.md` |
| Import graph, barrels, service boundaries, or module reachability | `apps/mobile/skills/import-cycles.md` |

The trigger is semantic, not path-only. A shared account selector, service,
storage adapter, or package change still requires the specialist review when it
can affect startup or Home transitively.

## Evidence

Use the least expensive evidence that can answer the question:

1. Static call-site and subscription analysis.
2. Focused unit tests for selector identity, deduping, cancellation, or final
   convergence.
3. Dev-mode diagnostics for fast iteration.
4. A release-like Regression package on a real device for user-visible timing.
5. Hermes/native profiling when the responsible thread or work is uncertain.

Separate CPU/JS occupation, native blocking, render/layout work, and network
waiting. A shorter wall-clock duration alone does not prove lower JS-thread
pressure. Preserve the same device, data, route, and build mode when comparing
measurements, and remove a probe when its expected signal does not change.

## Review Output And Escalation

- Report only actionable regressions introduced or made newly reachable by the
  change. Do not publish a performance checklist or clean-pass comment.
- Explain the repeated work or critical-path expansion and the user-visible
  consequence; avoid speculative "might be slower" comments.
- For startup/unlock/account-state or Home performance changes, if code and
  available evidence cannot establish safety, request `richardo2016x` as a
  reviewer and leave one concise inline note mentioning `@richardo2016x` on the
  most relevant changed line.
- State the unresolved invariant or measurement needed in that note. Do not
  duplicate the escalation across files.
- Uncertainty alone is not `REQUEST_CHANGES`; use the severity rules in
  `skills/rabby-mobile-code-review/SKILL.md` unless a concrete blocking defect
  is established.
