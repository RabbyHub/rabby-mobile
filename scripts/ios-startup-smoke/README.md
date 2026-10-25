# iOS Simulator startup checks

This independent workflow runs on pushes to `publish/*` and by manual
`workflow_dispatch`. It does **not** run after Feature Test, change existing
packaging/upload jobs, or gate delivery of their IPA/APK artifacts. Its own
failure stays red. Do not make it a release-required check until hosted
provisioning, native compilation and the complete matrix have been qualified.

## What is tested

One unsigned, arm64 **iOS Simulator** Regression app is built from the triggering
full commit. The same executable and embedded Hermes bundle are distributed
through a hash-verified archive to five independent GitHub-hosted jobs:

| iOS runtime | Hosted runner | UI-test Xcode |
| ----------- | ------------- | ------------- |
| 16.4        | macos-26      | 26.3          |
| 17.5        | macos-26      | 26.3          |
| 18.5        | macos-26      | 26.3          |
| 26.2        | macos-26      | 26.3          |
| 27.0        | xcode-27      | 27.1          |

These are fixed representative versions, not every minor or every iPhone.
Runtime identifiers/device types come from actual `simctl` inventory.
Each runtime gets a new simulator with no wallet or test bypass:

1. Install the shared simulator app.
2. Cold-launch through XCTest and wait for foreground.
3. Require the real welcome action
   `e2e.onboarding.welcome.import-existing` to be visible, enabled and hittable.
4. Observe that UI and foreground state for ten seconds.
5. Repeat the cold start, retaining screenshots and XCTest results.

A launch PID, skipped test or empty XCTest run cannot pass. Each shard verifies
the source commit and executable/JS hashes; the aggregate requires all requested
versions against the same build receipt. Missing evidence fails closed. Manual
subsets are labelled partial coverage, not a complete compatibility pass.
Rerunning failed jobs reuses the same run's build artifact; rebuilding replaces
that run's artifact. Aggregate success also requires successful build/test jobs,
so old retained evidence cannot mask a current job failure.

This is packaged-app startup E2E on Simulator, not physical-device, signing,
existing-wallet, upgrade, Home-data, transaction or performance validation.

## Environment preparation is part of CI

No `self-hosted`, `mobile` or `mobile-local` runner is used.

- The pinned hosted **image label** provides Xcode. `setup-xcode` explicitly
  selects the requested version and fails if the image no longer supplies it.
  It is a selector, **not an Xcode downloader**; we do not need Apple ID/2FA
  credentials to fetch an Xcode XIP in every job.
- The default app compiler is **26.3**, matching release. Manual
  `build_xcode=27.1` builds on `xcode-27` to exercise the newer SDK. The latter
  hosted label is currently a public preview.
- Build steps install Node22, Ruby2.7.4 and Bundler2.4.22; existing project helpers
  install locked JS/gem/Pod dependencies. No self-hosted RVM setup is assumed.
- The build job explicitly prepares its SDK's iOS platform components.
- Every test job invokes `provision.mjs`. It reuses only the exact available
  runtime; otherwise it runs Apple's `xcodebuild -downloadPlatform iOS
-buildVersion <version>`. Versions26/27 request the arm64 variant. It then
  checks inventory again. Install failure or a still-missing runtime is an
  infrastructure failure, never an automatic skip or narrower matrix.
- Provisioning is non-interactive and bounded; it records host/Xcode versions,
  before/after inventories and download logs. It does not clean global caches
  or delete other runtimes.

Xcode26.3 remains the test toolchain for iOS16 even when the **app** is compiled
by27.1. Apple's iOS16.4 catalog caps both host macOS and Xcode below27, so the
oldest-runtime job deliberately stays on `macos-26`. The app is not rebuilt
with an older compiler just to make that job pass.

Each hosted VM installs at most its own test runtime, rather than loading the
whole matrix onto one machine. Standard ARM64 hosted runners are substantially
smaller than the local build Mac; disk availability is logged before preparation.
No implicit fallback to a private runner or broad cache cleanup is performed.
First native CI qualification must establish actual capacity and elapsed time;
Node contract tests alone do not prove a native build or app launch.

Official references:
[hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners),
[macOS26 image](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-arm64-Readme.md),
[Xcode27 image](https://github.com/actions/runner-images/blob/main/images/macos/xcode-27-arm64-Readme.md),
[Apple download command](https://developer.apple.com/documentation/xcode-release-notes/xcode-16_1-release-notes),
[Apple runtime catalog](https://devimages-cdn.apple.com/downloads/xcode/simulators/index2.dvtdownloadableindex).

## Isolation, outputs and failure handling

Only the app-build step receives the existing regression build material
`RABBY_MOBILE_CODE2`, `RABBY_MOBILE_KR_PWD` and `MOBILE_SAFE_API_KEY`.
No Match, ASC, distribution signing, Sentry-upload, AWS or Lark write credentials
are needed. The build inherits the source's React Native architecture, and does
not raise the deployment target, bump versions, export an IPA or publish.

Each job uses its ephemeral VM and run-local temporary paths. Test shards use
`fail-fast: false`, so one failing OS does not cancel the others. The workflow
queues publish pushes per branch, independently of Feature Test/release.
Only UUIDs created by the test driver are shut down/deleted; no `shutdown all`
or deletion of pre-existing simulators/runtimes is used.

Seven-day GitHub artifacts preserve:

- `RabbyMobile-simulator.zip`, with executable permissions, and its build receipt:
  full commit, version, RN architecture, SDK/Xcode, executable/JS/archive hashes;
- platform/runtime provisioning logs and exact inventory;
- per-runtime `.xcresult`, screenshots, logs and summaries, including failures.

The last-screen image may show SpringBoard after XCTest teardown; use XCTest
attachments for first-screen proof. Evidence upload uses `always()`; no
`continue-on-error` hides failures. The earlier device-IPA probe secret is
unused; an arm64 device IPA is not retagged or re-signed into a simulator app.

## Local contract checks

```bash
node --test scripts/ios-startup-smoke/*.test.mjs \
  apps/mobile/scripts/ci/build-ios-simulator.test.cjs
node scripts/ios-startup-smoke/run.mjs plan \
  --output /absolute/new-plan-dir --majors 16,17 --build-xcode 26.3
```

These Node suites cover selection, installation process contracts, archive
transport and aggregation; native subprocesses are mocked where necessary.
They do not establish hosted native compilation or runtime boot success.
See [uitests/README.md](uitests/README.md) for real XCTest commands.

The workflow must exist on the pushed publish branch to react to its pushes.
Existing publish branches do not acquire it automatically. Manual dispatch
requires registration on the default branch first. The temporary exact feature
branch push trigger is only for qualification and must be removed before merge.
