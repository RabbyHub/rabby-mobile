# Rabby Mobile Test Classification

## Classification Rule

Classify a test by the highest boundary it proves, not by the tool it uses. RNTL can host either a component unit test or a JS integration test. A deep link can drive either a focused Hermes integration scenario or a complete E2E journey.

Choose the cheapest layer that still includes the dependency whose drift could cause the bug.

## Evidence Authority And Escalation

For the same product claim, evidence is authoritative in this order:

1. complete App behavior on a physical device;
2. real Hermes-engine behavior;
3. Node/JS integration behavior;
4. isolated unit/component behavior.

Use the lowest layer that can deterministically guard the intended contract,
but settle disagreements in favor of the higher-fidelity layer. If a real
device fails while Hermes or Node passes, the product remains failed and the
lower test has demonstrated a coverage gap. If Hermes fails while Node passes,
the Node result does not prove engine compatibility. Fix the implementation or
strengthen the lower test; never dismiss the higher-layer result as noise
without independent evidence.

Higher fidelity and faster diagnosis are different properties. Node tests are
often better at naming the exact broken contract, while real-device evidence is
the final authority on whether the App works. Record both when they disagree.

## Unit And Component Tests

Use unit/component tests for a pure function, reducer, selector, formatting rule, isolated Hook, or one component contract.

- Normal filename: `*.test.ts` or `*.test.tsx`.
- Internal collaborators may be mocked when their behavior is outside the test's claim.
- Inputs and expected outputs should be small and deterministic.
- Prefer direct state and rendered-output assertions over snapshots of large trees.

Example: verify a token-filter helper returns the expected IDs for pinned and hidden tokens.

These tests are fast and diagnostic, but they do not prove that internal modules still agree on contracts, Providers are ordered correctly, or singleton lifecycles converge.

### Reclassifying Mock-Heavy Tests

Do not mechanically replace a mock-heavy unit test with one broad integration
test. First separate its claims:

- Keep unit coverage for branch matrices, error mapping, pure transformation,
  and exact fan-out where the collaborators themselves are outside the claim.
- Add JS integration coverage when the claim depends on repository-owned
  Services, Stores, registries, persistence, subscriptions, or lifecycle
  ordering agreeing with each other.
- Prefer both layers when the unit test is the fastest fault locator but its
  mocks could hide contract drift. The integration test should assert public
  state, persisted output, or emitted behavior instead of repeating private
  call-count assertions.
- Move the claim to Hermes device integration when using the real dependency
  requires MMKV, SQLite, a native bridge, navigation host, or App lifecycle.
  Do not build a second internal runtime from mocks merely to keep the test in
  Node.

A high mock count is a review signal, not an automatic failure. The decisive
question is whether the test replaces the same internal collaboration it
claims to verify.

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
- Integration files may instantiate real Service implementations and registries;
  the production Service API boundary scan excludes only
  `*.integration.test.*`. The integration boundary checker independently
  rejects repository-module mocks in those files.

Examples:

- A real Zustand Store publishes the latest state only after `ScreenStoreActivityProvider` receives focus again.
- A registered Service loader becomes synchronously available to a typed HOC only after readiness completes.
- A preference mutation flows through the real Store, persistence coordinator, and subscriber while only MMKV storage is replaced by a boundary fake.
- The real launch task manifest advances through launch, either Home entry path,
  Home readiness, content readiness, and on-demand activation while typed
  module loaders replace native/process boundaries.
- The production headless app-state bootstrap waits for lock and security-chain
  I/O, mutates the real lock Store, and publishes the real render gate and Home
  entry milestone for valid-session, manual-unlock, no-account, and degraded
  cold starts. Runtime account addition uses the same production state
  transition as the account event.
- The real TypeORM entity metadata, migration sequence, repositories,
  constraints, and transactions run against Node's in-memory SQLite while only
  the native driver boundary is substituted.

An App-startup integration test in this lane is not a native App launch. It
must execute the production orchestration primitives and task metadata, but it
should not import the whole `App.tsx` tree when doing so would require replacing
most native modules. Keep the explicit `launchTaskLoaders` contract as the
boundary, use an isolated phase registry, and retain the real scheduler,
milestones, Service Registry, and Store publication. Native owner-module
behavior remains a Hermes device-integration responsibility.

Cold-start tests that touch process-wide Stores or milestones must not simulate
a new launch with `jest.resetModules()`. Declare deterministic scenarios in one
test module and let `apps/mobile/scripts/run-integration-tests.cjs` invoke each
scenario in a fresh Jest process by test-name filtering. Do not select the
scenario from a transformed source environment variable: Babel/Jest transform
caches can otherwise preserve the first scenario's value.

When a test needs a boundary fake, keep it stateful enough to preserve the external contract. A mock that returns one hard-coded value cannot prove persistence, cancellation, or event ordering.

### SQLite Boundary

Do not mock TypeORM repositories, migration results, or SQL rows when the claim
is about repository-owned database behavior. Use the Node in-memory SQLite
driver and the production DataSource lifecycle instead. This keeps CI fast and
deterministic while detecting entity metadata drift, migration failures,
constraint differences, transaction mistakes, and repository query changes.

Classify that result as JS integration evidence. Node's SQLite implementation
does not prove `@op-engineering/op-sqlite`, JSI/bridge behavior, a file-backed
database, WAL and checkpoint behavior, concurrent native connections,
force-stop durability, filesystem quirks, or device throughput. Run the
non-production native in-memory contract on a physical device for driver-level
compatibility, and run a real file-backed scenario whenever the product claim
includes persistence, scheduling, lifecycle, or performance.

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

The job is pinned to the trusted `mobile-local` macOS self-hosted runner. It
does not execute fork pull-request code on that machine. The persistent runner
workspace retains Yarn's download cache and the dedicated Jest transform
cache while cleaning other untracked files; `yarn install --immutable`
reconstructs and verifies dependency state against the current lockfile.

It performs:

1. immutable dependency installation;
2. an AST-based integration boundary check;
3. serial JS integration tests;
4. isolated app-state cold starts for valid-session, manual-unlock,
   no-account, auto-unlock failure, and security-chain failure, including the
   runtime account-add convergence path.

The workflow intentionally does not start an emulator. Device integration and E2E remain separate because they require signed artifacts, fixtures, devices, and richer evidence.

When a bug crosses a native boundary, add the deterministic JS integration coverage that is still meaningful, then link the required device scenario in the PR or handoff. Do not claim the JS test covers the native behavior.

## Examples By Risk

| Risk                                          | Minimum useful coverage          |
| --------------------------------------------- | -------------------------------- |
| Formatting or pure filtering                  | Unit                             |
| Store selector plus Provider publication      | JS integration                   |
| Service registration plus typed HOC readiness | JS integration                   |
| MMKV durability across force-stop             | Hermes device integration        |
| TypeORM entity/migration/repository semantics | JS integration + device contract |
| SQLite/native worker scheduling               | Hermes device integration        |
| Full Send/Swap transaction                    | E2E                              |
| Released-package upgrade                      | E2E                              |
