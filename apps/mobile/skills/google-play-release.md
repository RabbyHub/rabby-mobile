---
name: mobile-google-play-release
description: When working in `apps/mobile` on Google Play internal-track uploads or Android store-release preflight checks, use `./scripts/google-play.sh upload-internal-track`, prefer `RABBY_MOBILE_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64` for credentials, and preserve the repo's default release name, release notes, and draft-upload behavior.
---

# Mobile Google Play Release

Use this note when working on any of these in `apps/mobile`:

- uploading an Android `.aab` to the Google Play internal track
- adjusting the public upload script under `scripts/google-play.sh`
- changing Google Play release name or release notes defaults
- touching Android appstore build preflight around Play `versionCode` checks

This skill documents the repo-safe, committed workflow only. Keep private inspection or reporting commands under `.codex/`.

## Default Upload Command

Run from `apps/mobile`:

```bash
./scripts/google-play.sh upload-internal-track \
  --bundle-path ./android/app/build/outputs/bundle/release/app-release.aab \
  --draft
```

Notes:

- `--bundle-path` is optional if you use the default release bundle path shown above.
- `--draft` uploads the bundle without serving it to internal testers.
- If you omit `--draft`, the command uses release status `completed`.

## Credentials

Prefer the environment variable already used by this repo:

```bash
RABBY_MOBILE_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64
```

For GitHub Actions, configure that secret on the workflow environment used by `android_release` and keep the public workflow centered on `UPLOAD_TO_GOOGLE_PLAY_INTERNAL=true` plus `./scripts/google-play.sh upload-internal-track --draft`.

The script also accepts one-off overrides such as:

- `--service-account-file`
- `--service-account-json`
- `--service-account-json-base64`
- `--google-application-credentials`

## Built-In Upload Behavior

The public upload flow is opinionated. Preserve these defaults unless there is a clear business reason to change them:

1. It targets the Google Play `internal` track.
2. It tries to read the `.aab` `versionCode` before upload.
3. It compares that `versionCode` with the highest version already visible on Play.
4. Before an appstore build, if Google Play credentials are available and the local Android `versionCode` is not higher, the repo now bumps the local Android build number with `yarn android:buildversion` until it is ahead.
5. If Google Play cannot be queried, the build skips the auto-bump step and continues.
6. Before uploading, it best-effort tries to delete existing draft releases on the internal track.
7. If draft cleanup fails, it warns and continues.
8. If upload fails because the `versionCode` has already been used, the public CI path can treat that as a handled result and notify Lark instead of crashing the whole release flow.
9. It prints step logs during edit creation, upload, track update, and commit.
10. In an interactive terminal, the upload step shows `curl` progress output.

## Default Release Name

If no explicit `--release-name` is provided, the script formats the release name as:

```plain
Rabby Wallet(<versionName>.<versionCode>)
```

Example:

```plain
Rabby Wallet(0.6.67.100205)
```

## Default Release Notes

If no explicit `--release-notes-file` is provided, the script resolves release notes in this order:

1. `src/changeLogs/<versionName>.android.md`
2. `src/changeLogs/<versionName>.md`

If neither file exists, it falls back to:

```plain
Features

- Fixed some bugs and optimized user experience
```

The final payload sent to Google Play is wrapped as:

```plain
<en-US>
...content...
</en-US>
```

Use `--release-notes-language <tag>` to change the language tag when needed.

## Examples

Draft upload with default naming and default changelog resolution:

```bash
./scripts/google-play.sh upload-internal-track --draft
```

Draft upload with an explicit bundle path:

```bash
./scripts/google-play.sh upload-internal-track \
  --bundle-path ./android/app/build/outputs/bundle/release/app-release.aab \
  --draft
```

Completed internal release with custom notes:

```bash
./scripts/google-play.sh upload-internal-track \
  --bundle-path ./android/app/build/outputs/bundle/release/app-release.aab \
  --release-status completed \
  --release-notes-file ./src/changeLogs/0.6.67.md
```

## Current References

- [`scripts/google-play.sh`](../scripts/google-play.sh)
- [`scripts/fns.sh`](../scripts/fns.sh)
- [`scripts/deploy-android.sh`](../scripts/deploy-android.sh)
- [`src/changeLogs/`](../src/changeLogs)
