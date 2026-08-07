# Rabby Mobile Test Classification

## Classification Rule

Classify a test by the highest boundary it proves, not by the tool it uses. RNTL can host either a component unit test or a JS integration test. A deep link can drive either a focused Hermes integration scenario or a complete E2E journey.

Choose the cheapest layer that still includes the dependency whose drift could cause the bug.

## Unit And Component Tests

Use unit/component tests for a pure function, reducer, selector, formatting rule, isolated Hook, or one component contract.

- Normal filename: `*.test.ts` or `*.test.tsx`.
- Internal collaborators may be mocked when their behavior is outside the test's claim.
- Inputs and expected outputs should be small and deterministic.
- Prefer direct state and rendered-output assertions over snapshots of large trees.

Example: verify a token-filter helper returns the expected IDs for pinned and hidden tokens.

These tests are fast and diagnostic, but they do not prove that internal modules still agree on contracts, Providers are ordered correctly, or singleton lifecycles converge.

## JS And RNTL Integration Tests

Use JS integration tests when a regression depends on cooperation among real internal modules but does not require a real native runtime.

- Filename: `*.integration.test.ts` or `*.integration.test.tsx` under `apps/mobile/src`.
- Runner: `apps/mobile/jest.integration.config.js`.
- Compose real Stores, Providers, Hooks, Service registries, coordinators, and React components.
- Run serially to protect process-wide registries and singleton state.
- Mock true boundaries only: HTTP transport, clocks, keychain, filesystem, device APIs, and navigation when navigation is not the subject.
- Use a string-literal module specifier for every boundary mock so CI can classify it statically.
- Do not mock `@/` modules, relative repository modules, or workspace packages.
- Do not use `jest.resetModules()` or `jest.isolateModules*()` to manufacture a second internal runtime.

Examples:

- A real Zustand Store publishes the latest state only after `ScreenStoreActivityProvider` receives focus again.
- A registered Service loader becomes synchronously available to a typed HOC only after readiness completes.
- A preference mutation flows through the real Store, persistence coordinator, and subscriber while only MMKV storage is replaced by a boundary fake.

When a test needs a boundary fake, keep it stateful enough to preserve the external contract. A mock that returns one hard-coded value cannot prove persistence, cancellation, or event ordering.

## Hermes Device Integration Tests

Use Hermes device integration when correctness depends on the actual JavaScript engine, native module, app lifecycle, navigation host, MMKV, SQLite, WebView bridge, Reanimated, or background/foreground behavior.

Use the repository's non-production scenario infrastructure and typed component actions. Read `skills/mobile-testable-component-boundaries/SKILL.md` before adding a new target.

- Gate behavior to non-production builds, persistent opt-in, and an explicit scenario command.
- Drive the same handler and state transition as a user action; do not directly assign the desired final state.
- Prefer typed actions and observable postconditions over screen coordinates.
- Keep secrets out of deep links, logs, recordings, and persisted commands.
- Record structured lifecycle and result events so CI or an Agent can distinguish JS work, native work, and network wait.

Example: import a test key, configure auto-lock, force-stop the app, wait for the real lifecycle transition, and verify the lock Screen and persisted preference through Hermes and native storage.

## End-To-End Tests

Use E2E for complete product journeys where navigation, package configuration, remote services, signing, and final user-visible outcomes all matter.

Examples:

- Upgrade from a released baseline package and verify existing wallets and preferences.
- Complete a small Polygon Send or Swap through confirmation and transaction status.
- Validate locked and unlocked startup paths in a signed regression package.

E2E should reuse deterministic scenario fixtures where possible, but it must not bypass the business decisions the user path is meant to prove.

## Mock Boundary Review

Before accepting a mock, ask:

1. Can this dependency change independently and break the behavior being claimed?
2. Is it repository-owned business code, state, or orchestration?
3. Would using the real implementation make the test nondeterministic or require a native runtime?

If the first two answers are yes, keep it real in a JS integration test. If the third answer is yes, move the case to Hermes device integration rather than constructing a deeper fake.

Allowed boundary mocks are not automatically harmless. Network fakes must preserve status, payload, cancellation, and ordering relevant to the scenario. Clock fakes must still exercise expiration and scheduling semantics. Storage fakes must preserve write/read/delete behavior if persistence is under test.

## CI Layers

The dedicated `Mobile Integration Tests` workflow runs on relevant changes to `develop` and pull requests targeting `develop`.

It performs:

1. immutable dependency installation;
2. an AST-based integration boundary check;
3. serial JS integration tests.

The workflow intentionally does not start an emulator. Device integration and E2E remain separate because they require signed artifacts, fixtures, devices, and richer evidence.

When a bug crosses a native boundary, add the deterministic JS integration coverage that is still meaningful, then link the required device scenario in the PR or handoff. Do not claim the JS test covers the native behavior.

## Examples By Risk

| Risk                                          | Minimum useful coverage   |
| --------------------------------------------- | ------------------------- |
| Formatting or pure filtering                  | Unit                      |
| Store selector plus Provider publication      | JS integration            |
| Service registration plus typed HOC readiness | JS integration            |
| MMKV durability across force-stop             | Hermes device integration |
| SQLite/native worker scheduling               | Hermes device integration |
| Full Send/Swap transaction                    | E2E                       |
| Released-package upgrade                      | E2E                       |
