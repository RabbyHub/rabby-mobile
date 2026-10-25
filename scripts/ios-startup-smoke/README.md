# iOS Simulator startup checks

This independent workflow runs on pushes to `publish/*` and by manual
`workflow_dispatch`. It does **not** run after Feature Test, change existing
packaging/upload jobs, or gate delivery of their IPA/APK artifacts. Its own
failed startup check remains red. Do not make it a release-required check
until the runner prerequisites and the complete matrix have been qualified.

## What is tested

One unsigned, arm64 **iOS Simulator** Regression app is built from the triggering
full commit. The same binary and embedded Hermes bundle are tested across the
declared iOS major versions **16, 17, 18, 26, 27**. Each major selects its newest
installed, available runtime, using its real identifier and supported iPhone
device types. This is representative major-version coverage, not every minor
release or every iPhone.

Each runtime gets a newly created simulator with no wallet or test bypass:

1. Install the simulator app.
2. Cold-launch through XCTest and wait for foreground.
3. Require the real welcome-screen action
   `e2e.onboarding.welcome.import-existing` to be visible, enabled and hittable.
4. Observe that UI and foreground state for ten seconds.
5. Repeat the cold start, retaining screenshots and XCTest results.

A successful install or launch PID is not a pass. Neither a skipped test nor an
empty XCTest run can pass. Missing runtimes/tooling fail preflight **before**
the expensive app build, without downloading runtimes or shrinking coverage.
An explicit manual subset is prominently reported as partial coverage.

This is packaged-app startup E2E on Simulator, not physical-device, signing,
existing-wallet, upgrade, Home-data, transaction or performance validation.

## Runner prerequisites and SDK selection

- A trusted self-hosted macOS **ARM64** runner labelled `mobile` (default) or
  `mobile-local`, with normal Rabby Node/Ruby/Bundler prerequisites.
- Xcode **26.3** for the default app build, matching the current release
  workflow. Manual `build_xcode=27.1` exercises the newer compiler/SDK.
- Xcode **26.3** to build/run the tiny UI harness for iOS16/17/18/26, and Xcode
  **27.1** for iOS27. Each toolchain gets its own runner/xctestrun.
- Available iOS runtimes in every required major. Provision them explicitly;
  this workflow does not install Xcode/runtime components or change the global
  `xcode-select` selection. Discovery alone does not establish compatibility:
  destination, boot and test-runner errors remain failures.
- Only existing regression build material
  `RABBY_MOBILE_CODE2`, `RABBY_MOBILE_KR_PWD` and `MOBILE_SAFE_API_KEY` is
  injected into the app-build step. No Match, ASC, distribution signing,
  Sentry-upload, AWS or Lark write credentials are requested.

The simulator build inherits the source branch's React Native architecture.
It does not force newArch, raise the deployment target, bump versions, export
an IPA, or upload to stores/CDN/Lark/Sentry. A device IPA, even pure arm64, is
not silently retagged or re-signed into a simulator artifact. The earlier
`IOS_STARTUP_PROBE_IPA_URL` secret is not consumed by this workflow.

## Isolation, outputs and failure handling

The checkout has a separate `ios-startup-source` path; app DerivedData uses a
simulator-specific cache fingerprint. Evidence directories include the run ID
and attempt. Runtimes run serially. The workflow queues (up to GitHub's
100-pending limit) instead of cancelling prior publish pushes. This concurrency
group does not stop or serialize unrelated release workflows: runner operators
must keep distinct runner work directories and avoid simultaneous global
toolchain/service changes.

Only exact simulator UUIDs created by this invocation are shut down/deleted;
existing developer simulators are not erased or stopped. The per-runtime
`owned-device.json` receipts remain for inspection after a host/runner crash.
Never run `simctl shutdown all`, delete unavailable runtimes or clean general
build caches as recovery.

GitHub artifacts (seven-day retention) contain:

- `RabbyMobile-simulator.zip`, preserving the app's executable permissions;
- build receipt: full source commit, version, RN architecture, SDK/Xcode,
  executable/JS/archive SHA-256;
- actual runtime versions/builds, device types and test Xcodes;
- per-runtime `.xcresult`, screenshot attachments, logs and summaries,
  including failures. The normal last-screen image can show SpringBoard after
  XCTest teardown; use the retained XCTest attachments for first-screen proof.

Upload uses `always()`; test/build failure is not hidden by
`continue-on-error`. No dependency is added to Feature Test/release jobs.

## Local checks without rebuilding the app

```bash
node --test scripts/ios-startup-smoke/run.test.mjs
node --test apps/mobile/scripts/ci/build-ios-simulator.test.cjs
node scripts/ios-startup-smoke/run.mjs plan \
  --output /absolute/new-plan-dir --majors 16,17 --build-xcode 26.3
```

The Node suites test orchestration/selection and mocked build-process contracts;
they do not establish native compilation success. For the actual standalone
XCTest commands, see [uitests/README.md](uitests/README.md).

The workflow must be present on the pushed publish branch to react to its
pushes. Existing publish branches do not automatically acquire it. The manual
workflow must first be registered from the default branch; merging this PR
does not retroactively test older pushes or trigger a store release.
