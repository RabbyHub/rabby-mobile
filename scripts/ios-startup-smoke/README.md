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
Rerunning failed test jobs reuses the same run's build artifact. Each build
attempt publishes a separate immutable artifact, named
`ios-startup-app-<source commit>-<run attempt>`; it does not overwrite an earlier
attempt. Test jobs select the build output's artifact ID, never a latest-name
match. Aggregate success also requires successful build/test jobs,
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
- Runtime inventory calls in provisioning and preflight have a separate
  two-minute deadline: fresh hosted runners have exceeded 30 seconds in both
  stages. This does not increase App launch or XCTest execution deadlines;
  inventory timeouts still fail explicitly, without retries or skips.

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

The shared app artifact is retained for **30 days** and includes:

- `RabbyMobile-simulator.zip`, with executable permissions, and its build receipt:
  full commit, producer run/attempt, version, RN architecture, SDK/Xcode,
  executable/JS/archive hashes and source provenance;
- build logs and `source-changes.json` when tracked sources changed. This report
  contains paths, change types and content hashes, never raw source diffs.

Separate seven-day evidence artifacts preserve:

- platform/runtime provisioning logs and exact inventory;
- per-runtime `.xcresult`, screenshots, logs and summaries, including failures.

After native compilation succeeds, the app is archived **before** post-build
validation. A later source-provenance failure therefore retains the app plus a
schema-2 receipt marked `modified`, but keeps the build failed. Such an app can
only be used by the explicit diagnostic probe, not normal qualification.
Structural validation failure retains available evidence but does not produce
a usable receipt. Native build failure never exports a stale DerivedData app.

The last-screen image may show SpringBoard after XCTest teardown; use XCTest
attachments for first-screen proof. Evidence upload uses `always()`; no
`continue-on-error` hides failures. The earlier device-IPA probe secret is
unused; an arm64 device IPA is not retagged or re-signed into a simulator app.

## Probe a retained artifact without rebuilding Rabby Mobile

Manually run **iOS Simulator Artifact Probe** (`ios_simulator_probe.yml`) with:

- `source_run_id`: the completed **iOS Simulator Startup** producer run ID;
- `source_artifact_id`: its exact retained `ios-startup-app-...` artifact ID;
- `ios_majors`: the desired declared majors (default `16,17,18,26,27`).

The probe downloads that same-repository artifact with read-only Actions access,
checks the run, commit, producer attempt and archive hashes, and installs the
same app on the requested runtimes. It does **not** install Rabby Mobile's
JS/Pod dependencies or compile the app. Runtime provisioning and compilation of
the small XCTest harness are still needed on fresh hosted VMs.

Select a workflow ref containing the desired **test harness**. Its commit is
recorded separately from the artifact's **app source** commit, allowing fixes to
the detector to be tried against the original app. All probe results are labelled
diagnostic-only (`qualificationPassed: false`), including clean-source artifacts;
they do not qualify the current checkout or turn an earlier failed build green.
Normal publish builds retain strict same-commit, clean-source qualification.

Missing, expired, foreign or old-schema artifacts fail explicitly: there is no
fallback to a newer app or an automatic expensive rebuild. A source run that
failed after archiving can be probed if it has a structurally valid schema-2
receipt. Logs-only artifacts cannot be used. In particular, run `40194208595`
predates early capture and contains no app; it needs one new build to seed a
reusable artifact.

For a locally downloaded and verified artifact, the same split is available with
`run.mjs plan --probe --build-metadata <metadata.json>` followed by
`run.mjs test --probe --plan <plan.json> --app <RabbyMobile.app>
--metadata <metadata.json> --output <new-output-dir>`. Both invocations must
explicitly select probe mode. The plan binds the receipt's exact bytes, and test
rechecks the executable and JS hashes before launch.

As with the build workflow, GitHub manual dispatch requires this new workflow to
be registered on the default branch first. Adding it to an unmerged feature
branch alone is not proof that its dispatch endpoint is available.

For pre-merge CI verification, a temporary exact push trigger on
`feat/ios-simulator-startup-ci` invokes only the probe, using producer run
`40200867375` and artifact `12603038211`. The app-build workflow no longer runs
on that feature branch. Push-mode inputs are fixed explicitly; manual dispatch
still requires its supplied IDs. Remove the temporary probe push trigger and
fixed input selectors before merging; publish builds remain unchanged.

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
branch push trigger in the probe is only for qualification and must be removed
before merge.
