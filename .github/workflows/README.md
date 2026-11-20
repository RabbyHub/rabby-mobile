# Workflows in this repository

Packaging, signing and release automation moved to the private repository
[`RabbyHub/rabby-ci`](https://github.com/RabbyHub/rabby-ci). The build/sign
helper scripts still live here (`apps/mobile/scripts/**`, `scripts/**`), because
the rabby-ci workflows check this repository out and run them.

## Kept here

| Workflow | Why it stays public |
| --- | --- |
| `typecheck.yml` | Type check, Jest and import-cycle checks; no secrets, GitHub-hosted runners. |
| `label-external-contributor.yml` | Labels issues/PRs from outside contributors; no secrets. |
| `create_tmp_release_branch.yml` | Creates the weekly `tmp/YYYYMMDD` branch with the repo `GITHUB_TOKEN` only. |
| `mobile_integration_test.yml` | Still the PR/push integration suite; it needs the LAN Mac mini and is waiting for the public→private trigger bridge. |
| `ios_simulator_*.yml` | iOS simulator startup/probe/archive lanes; staged to move to rabby-ci next. |
| `sync_changelog.yml` | Runs after a release; moves together with the release lanes. |

## Moved to rabby-ci

| Removed workflow | Replacement |
| --- | --- |
| `feature_test.yml` | `rabby-mobile-feature-test.yml` (iOS on the AWS Mac, Android on the Linux builder) |
| `sign_only_package.yml` | `rabby-mobile-sign-only.yml` |
| `ios_release.yml` | `rabby-mobile-release-ios.yml` |
| `android_release.yml` | `rabby-mobile-release-android.yml` |
| `mobile_capability_probes.yml` | `rabby-mobile-capability-probes.yml` |
| `lark_notify_probe.yml` | `rabby-mobile-lark-probe.yml` |
| `xcode_toolchain_downloads.yml` | `xcode-toolchain-downloads.yml` |
| `hash_validate.yml` | `rabby-mobile-hash-validate.yml` |

The fe-opcode console (`移动端交付` pages) prepares the dispatch parameters and
the `gh workflow run` command for these workflows; GitHub cannot prefill
`workflow_dispatch` inputs from a URL.
