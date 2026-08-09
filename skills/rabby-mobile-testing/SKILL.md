---
name: rabby-mobile-testing
description: Use when choosing, writing, reviewing, or reorganizing Rabby Mobile tests; deciding between unit, JS integration, Hermes device integration, and E2E coverage; defining mock boundaries; or adding test-related CI.
---

# Rabby Mobile Testing

Choose the narrowest test layer that can detect the intended regression without replacing the behavior under test with mocks. Read [references/test-classification.md](references/test-classification.md) before adding or reclassifying coverage.

## Evidence Priority

When two layers make claims about the same behavior, use this authority order:

1. a complete real-device App scenario;
2. a real Hermes runtime scenario;
3. a Node/JS integration test;
4. a unit or component test.

This is an evidence hierarchy, not a reason to run every change only at the
most expensive layer. Lower layers remain the fastest way to localize a fault
and protect a deterministic contract. However, a passing lower-layer test can
never overrule a failure above it. Treat that disagreement as a missing or
incorrect lower-layer assertion, preserve the higher-fidelity failure, and add
coverage at the narrowest layer that can reproduce it.

Classify by the boundary actually exercised. A typed scenario running in a
real App on a physical device may count as real-device evidence; invoking the
Hermes engine without the native lifecycle, storage, navigation host, and
visible product result counts only as Hermes evidence. Never describe a Node
bootstrap integration test as a verified App launch.

## Quick Decision

| Question                                                              | Test layer                |
| --------------------------------------------------------------------- | ------------------------- |
| Is one pure module or reducer enough?                                 | Unit                      |
| Must real internal Stores, Providers, Hooks, or Services cooperate?   | JS integration            |
| Must Hermes, MMKV, SQLite, a native bridge, or app lifecycle be real? | Hermes device integration |
| Must the complete user journey and package behavior be proven?        | E2E                       |

Do not promote a test merely because it renders React. A component test that mocks its internal Store and Service is still a unit/component test.

When reorganizing an existing mock-heavy suite, preserve focused diagnostic
unit tests and add integration contracts for the repository-owned cooperation
that those mocks replace. Follow the reclassification rules in
[references/test-classification.md](references/test-classification.md); mock
count alone is not a reason to delete a unit test.

## JS Integration Contract

- Name files `*.integration.test.ts` or `*.integration.test.tsx` under `apps/mobile/src`.
- Compose real repository Stores, Providers, Hooks, Services, registries, and coordinators.
- Mock only true process boundaries such as network, time, keychain, filesystem, device APIs, and navigation when navigation itself is not under test.
- Assert visible output, emitted events, persisted state, or public Store/Service results. Avoid assertions on private implementation calls.
- Clean up subscriptions and unregister shared Service loaders in `finally` or test cleanup.
- Keep the lane serial because the mobile app has process-wide registries and singleton state.

For TypeORM and repository contracts, prefer the repository's real Node
in-memory SQLite driver over mocking repositories or query results. Run the
real entity metadata, migrations, repositories, constraints, and transactions
against `:memory:`. This proves deterministic database semantics in CI, but it
does not prove the native SQLite bridge, file-backed durability, WAL behavior,
multi-connection ordering, force-stop behavior, or device performance.

For startup orchestration, do not mount the complete native `App` in Node just
to claim broad coverage. Use the real launch task definitions, startup
scheduler, phase registry, Home milestones, Service Registry, and Stores.
Replace only the explicit module-loading or process boundary with a typed,
deterministic catalog. Assert both the manual-unlock and valid-session paths,
and prove post-Home and on-demand work cannot run early.

When startup correctness depends on app state, run the production headless
bootstrap seam instead of recreating its decisions in a test-only Store. Use
the real app-lock Store, render gate, and Home milestones while substituting
only lock/keychain and security-chain I/O. The integration runner executes each
cold-start path in a separate Jest process so process-wide state cannot leak
between valid-session, manual-unlock, failure, and no-account scenarios. A
runtime account-add scenario should continue from the real no-account bootstrap
state and exercise the same production transition used by the account event.

Run:

```bash
yarn workspace rabby-mobile test:integration:boundaries
yarn workspace rabby-mobile test:integration
```

The boundary check rejects repository-internal Jest mocks and alternate module lifecycles such as `jest.resetModules()`.

## Device And E2E Coverage

When Node Jest cannot represent the risk, use the real non-production app boundary. Read [../mobile-testable-component-boundaries/SKILL.md](../mobile-testable-component-boundaries/SKILL.md) before adding typed actions, lifecycle observations, or deep-link orchestration.

For database changes, run the non-production native in-memory SQLite contract
on a physical device before claiming native compatibility. Then exercise the
affected file-backed business path when persistence, scheduling, or performance
is part of the change. A passing Node SQLite suite is supporting evidence only;
it never overrides a device failure.

Do not turn Hermes device integration into coordinate-heavy E2E when a typed action can invoke the same production handler. Keep full E2E for complete journeys, package upgrade behavior, signing, network integration, and cross-Screen outcomes.

## Handoff

- State which layer was added and why lower layers were insufficient.
- Report both integration commands and any device/E2E scenarios run.
- If a true native boundary remains mocked, name the residual risk explicitly.
