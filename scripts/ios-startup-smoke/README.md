# iOS Simulator startup checks

This independent workflow runs on pushes to `publish/*` and by manual
`workflow_dispatch`. It does **not** run after Feature Test, change existing
packaging/upload jobs, or gate delivery of their IPA/APK artifacts. Its own
failure stays red. Do not make it a release-required check until runner
provisioning, native compilation and the complete matrix have been qualified.

## What is tested

One unsigned, arm64 **iOS Simulator** Regression app is built from the triggering
full commit. The same executable and embedded Hermes bundle are distributed
through a hash-verified archive to five test jobs. **Both app compilation and
validation default to `[self-hosted, macOS, ARM64, mobile-local, mobile-ios-simulator]`**.
The App compiler stays Xcode 27.1. Local iOS 16.4 builds and runs only its
XCTest harness with Xcode 26.3; local iOS 17+ uses Xcode 27.1 for the harness.
The local test jobs run serially. Manual
`execution_environment=hosted` explicitly selects this alternative matrix:

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

## Persistent runner preflight and explicit hosted alternative

The default `mobile-local` runner requires Node 22 through NVM,
Ruby 2.7.4@rabbymobile through RVM, Bundler 2.4.22, selected Xcode 27.1,
an additional installed Xcode 26.3 for the iOS 16 harness, and the exact available
runtimes 16.4, 17.5, **18.3.1**, 26.2, 27.0. App compilation additionally preflights the
SDK-matching 27.1 platform runtime. `toolchain.mjs` checks the selected Xcode and
exports `DEVELOPER_DIR` for child processes; it never calls `xcode-select -s`.
The app compiler defaults to 27.1. Selecting 26.3 **for App compilation**
requires choosing hosted too.

Xcode 27.1's precompiled XCTRunner/XCTest requires iOS 17 or newer, even when
the harness project's deployment target is lower. Therefore only the local
iOS 16.4 test shard explicitly requires Xcode 26.3. `toolchain.mjs --installed`
and `run.mjs plan` resolve the requested installed version under `/Applications`
and pin `DEVELOPER_DIR` for provisioning, harness compilation and test execution.
They never change global selection. Missing/unusable 26.3 fails explicitly;
there is no automatic install, fallback to 27.1, or skipped iOS 16 coverage.
The shared App remains the original Xcode 27.1 build; only its test driver changes.

Local iOS 18 uses the explicitly provisioned 18.3.1 representative; hosted keeps
18.5. The runtime download service did not offer 18.5/18.6 to this local
toolchain during preparation. This is a declared matrix choice, not a fallback
or skipped major. Summary validation requires the selected environment's exact
minor, and 18.3.1 success must not be reported as 18.5 validation.

Local CI does not install Xcode/runtimes, switch global toolchains, clean
global caches, or silently move a missing/offline runner job to hosted.
`provision.mjs --check-only` records the exact runtime inventory and fails on
missing/unavailable components. Provision the persistent machine separately;
an installed runtime is not proof that an actual boot or App launch will pass.
Local iOS 17/18/26 harnesses use 27.1, whereas their hosted counterparts use
26.3; results from one harness toolchain are not automatically evidence for the other.

The default checkout lives in `.ios-simulator-ci` with `clean: false` to avoid
erasing the runner's ordinary checkout or generated caches. Build-source guards
still reject tracked dirtiness and record mutations after compilation. Existing
TURBO variants remain under `~/Library/Caches/rabby-mobile/build-cache`, never
the runner's temporary evidence directory. NVM/RVM preflight uses installed
versions and fails rather than compiling or installing a new global toolchain.
An unrelated workflow that cleans the entire runner workspace can still remove
this nested checkout and its in-checkout outputs. This lane does not change
those workflows; the variant cache root outside that workspace remains intact.

When **hosted is explicitly selected**:

- The pinned hosted **image label** provides Xcode. `setup-xcode` explicitly
  selects the requested version and fails if the image no longer supplies it.
  It is a selector, **not an Xcode downloader**; we do not need Apple ID/2FA
  credentials to fetch an Xcode XIP in every job.
- `build_xcode=26.3` builds on `macos-26`; 27.1 builds on `xcode-27`. This hosted
  selection is explicit, not automatic failure recovery.
- Build steps install Node 22, Ruby 2.7.4 and Bundler 2.4.22; existing project helpers
  install locked JS/gem/Pod dependencies. No self-hosted RVM setup is assumed.
- The build job explicitly prepares its SDK's iOS platform components.
- Every hosted test job invokes `provision.mjs` with installation enabled. It reuses only the exact available
  runtime; otherwise it runs Apple's `xcodebuild -downloadPlatform iOS
-buildVersion <version>`. Versions 26/27 request the arm64 variant. It then
  checks inventory again. Install failure or a still-missing runtime is an
  infrastructure failure, never an automatic skip or narrower matrix.
- Provisioning is non-interactive and bounded; it records host/Xcode versions,
  before/after inventories and download logs. It does not clean global caches
  or delete other runtimes.
- Runtime inventory calls in provisioning and preflight have a separate
  two-minute deadline: fresh hosted runners have exceeded 30 seconds in both
  stages. This does not increase App launch or XCTest execution deadlines;
  inventory timeouts still fail explicitly, without retries or skips.

Both modes use Xcode 26.3 as the test toolchain for iOS 16 even when the
**app** is compiled by 27.1; the hosted oldest-runtime job stays on `macos-26`.
Local preflight checks inventory using each shard's explicit toolchain. Neither mode rebuilds the app
with an older compiler just to make one test pass.

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
No Match, ASC, distribution signing, Sentry-upload or Lark write credentials
are needed by these jobs. Only the separate archive/source-transfer jobs invoke
AWS CLI, using the Simulator runner account's local `default` profile. Build and
startup steps do not perform S3 operations, but jobs under the same self-hosted
OS account are not a credential security boundary. The build inherits the source's React Native architecture, and does
not raise the deployment target, bump versions, export an IPA or publish.

Evidence uses a fresh `mktemp` directory per job/attempt. Local build and test
jobs in **both** workflows share `rabby-ios-simulator-mobile-local` concurrency
with `cancel-in-progress: false` and `queue: max`; this protects their shared
checkout, native build caches and Simulator access. Local matrix parallelism is
one. Hosted jobs keep separate VMs and can run concurrently. This group does
not govern unrelated workflows or manually launched processes on the host.
Test shards use `fail-fast: false`, so one failing OS does not cancel the
others. Publish pushes also queue per branch, independently of Feature
Test/release. An offline local runner queues/fails visibly; there is no hidden
hosted fallback.
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

## Independently test build, upload and startup

The jobs have three independent entry points:

| Entry                                          | Input                                 | Runner / work                                                                             |
| ---------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `ios_simulator_startup.yml`, `build_only=true` | Source ref and compiler               | Mac mini builds once and retains a GitHub artifact; no S3 upload or startup qualification |
| `ios_simulator_archive.yml`                    | Original build run ID and artifact ID | Mac mini uploads/verifies that exact existing archive; no app build or Simulator          |
| `ios_simulator_probe.yml`                      | Artifact IDs or exact S3 index key    | Probes the existing app; no Rabby Mobile rebuild                                          |

For the first integration, run build-only on `mobile-local`, note its artifact ID
and run ID, then manually run **iOS Simulator S3 Archive Probe** with those IDs.
Repeat just that upload workflow when diagnosing IAM, connectivity or archive
code. It always calls the same `archive.mjs upload` as automatic publication.
The receipt retains the **original** producer run/attempt, commit and artifact ID;
the archive path separately identifies the **uploader** run and its job timestamp.
A new upload job or re-run captures a new timestamp path without requiring another
native build. Repeated upload calls using the same captured job timestamp verify
and reuse identical objects; different bytes at that same key fail rather than
overwrite. Re-running a failed automatic archive job still retains the original
build attempt binding in its metadata.

Normal publish runs (`build_only=false`) make the archive job and startup matrix
eligible independently after building. Upload success is not a dependency of
startup validation or Feature Test's separate artifact delivery. Local jobs still
share the Mac mini's runner capacity and may queue behind one another. Upload
failures remain visible failures; they are not hidden with `continue-on-error`.

### Durable S3 archive

S3 reads/writes run on
`[self-hosted, macOS, ARM64, mobile-local, mobile-ios-simulator]`, using the
runner account's separately provisioned AWS CLI `default` profile. Workflows
do not provision or embed AWS keys, source interactive shell profiles, or fall
back to EC2 instance credentials. Hosted test jobs receive only the verified
artifact, not AWS credentials. The AWS runner's existing labels and unrelated
Feature Test/release runner selection are unchanged. TLS verification remains
enabled. No Match, deploy script, public ACL, public download URL, presigned URL,
Lark notification, version bump or CDN invalidation is involved.

The existing `RABBY_MOBILE_BUILD_BUCKET` secret selects the bucket. Immutable
objects live outside build-cache prefixes:

```text
_private/rabby-mobile/ios-simulator/<run>-<YYYYMMDDHHmmss>/
  RabbyMobile-simulator.zip
  metadata.json
  archive.json
```

The durable locator is
`s3://<configured-bucket>/_private/rabby-mobile/ios-simulator/<run>-<YYYYMMDDHHmmss>/archive.json`.
Here `<run>` is the upload job's actual `GITHUB_RUN_ID`, not `SOURCE_RUN_ID`.
Both automatic and manual archive jobs capture UTC time once in their first
executable step, before checkout, into `ARCHIVE_JOB_STARTED_AT` using
`YYYYMMDDHHmmss` (year, month, day, hour, minute, second). The step explicitly
uses `github.workspace`, which exists before the nested checkout. This timestamp
is neither the original build time nor the workflow's queued/created time.
The archive source records `archiveRunId` and `archiveJobStartedAt` bound to this
key, while its original producer fields and the build receipt remain unchanged.
The probe input takes only the key after the bucket, not an HTTPS link. The
authenticated transfer job downloads the index and its referenced files to the
Simulator Mac and checks them before use; no anonymous download is required.

The ZIP and original receipt are verified before upload. The schema-2 index is
written last, after both payload objects are verified, and records exact keys,
hashes, sizes and producer identity. Its `git` section contains `repository`,
the full source `commit`, `refName`, and `commitUrl`. Automatic archives use the
build workflow's ref; manual uploads resolve the **original producer run's**
ref, never the uploader workflow's ref. `refName` is `null` if original ref
metadata is unavailable. A branch/tag can move: the recorded full commit SHA
and its commit link are authoritative, while the ref name is reference-only.
There is no `latest` alias, overwrite or automatic
deletion. A complete `modified` source-provenance archive is retained for
diagnosis without turning its original build green. Logs-only/incomplete build
artifacts fail validation and cannot become reusable S3 archives.

The first live transfer must verify read/write access to this **exact prefix**.
Existing release-path upload success does not prove that permission. Bucket
policy and lifecycle must also be checked separately: `_private` is a naming
convention, not proof of private access or indefinite retention. The workflow
does not alter IAM, bucket policies or lifecycle rules. The index key is a stable
locator, not a public download URL or an expiring presigned link. Hashes detect
corruption; provenance still relies on the trusted build and S3 write boundary.

### Probe a retained artifact without rebuilding Rabby Mobile

Manually run **iOS Simulator Artifact Probe** (`ios_simulator_probe.yml`) with:

- `source_type=artifact` (default);
- `source_run_id`: the completed **iOS Simulator Startup** producer run ID;
- `source_artifact_id`: its exact retained `ios-startup-app-...` artifact ID;
- `ios_majors`: the desired declared majors (default `16,17,18,26,27`).
- `execution_environment`: `mobile-local` (default) or explicit `hosted`.

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

### Probe S3 after the GitHub artifact expires

Select `source_type=s3` and pass the exact `s3_archive_key` ending in
`archive.json` from the archive job summary. Leave the GitHub source IDs empty.
A resolve job on the Simulator Mac fetches the index, receipt and ZIP, validates their keys,
producer and hashes, then relays those verified bytes through a new seven-day
GitHub artifact for this probe run. Both startup shards **and the summary** consume
that new transport artifact; they never request the expired/deleted original
artifact or require the old workflow run to remain available. Original producer
IDs remain in the source receipt and are not replaced by the relay's IDs.

Missing/corrupt S3 objects fail explicitly. There is no automatic artifact/S3
fallback, URL following, rebuild or qualification claim. The original workflow
conclusion is recorded as unknown when it cannot be established from the archive.

For a locally downloaded and verified artifact, the same split is available with
`run.mjs plan --probe --build-metadata <metadata.json>` followed by
`run.mjs test --probe --plan <plan.json> --app <RabbyMobile.app>
--metadata <metadata.json> --output <new-output-dir>`. Both invocations must
explicitly select probe mode. The plan binds the receipt's exact bytes, and test
rechecks the executable and JS hashes before launch.

As with the build workflow, GitHub manual dispatch requires this new workflow to
be registered on the default branch first. Adding it to an unmerged feature
branch alone is not proof that its dispatch endpoint is available.

The temporary feature-branch push trigger and fixed historical artifact IDs
have been removed. The probe is manual-only and always requires explicit IDs or an exact S3 index key;
pushing this feature branch will not build or probe anything. The startup
workflow still reacts to `publish/*` pushes.

## Local contract checks

```bash
node --test scripts/ios-startup-smoke/*.test.mjs \
  apps/mobile/scripts/ci/build-ios-simulator.test.cjs
node scripts/ios-startup-smoke/run.mjs plan \
  --output /absolute/new-plan-dir --majors 16,17 --build-xcode 27.1 \
  --execution-environment mobile-local
```

These Node suites cover selection, installation process contracts, archive
transport and aggregation; native subprocesses are mocked where necessary.
They do not establish native compilation or runtime boot success on either
runner environment.
See [uitests/README.md](uitests/README.md) for real XCTest commands.

The workflow must exist on the pushed publish branch to react to its pushes.
Existing publish branches do not acquire it automatically. Manual dispatch
requires registration on the default branch first. Removing the temporary push
entry does not register an unmerged workflow for manual dispatch.
