# Unsigned builds (regression / production)

One build per channel, always **unsigned** and always accompanied by an
attestation. Everything downstream consumes that artifact:

- a second machine rebuilds it and compares hashes (cross-check);
- the signer signs it (credentials come from the environment, as today);
- the publish step uploads its Sentry symbols before releasing.

```
yarn unsigned:android [production|regression|<out-dir>]
yarn unsigned:ios     [<out-dir>]
```

Output goes to `dist/unsigned/<channel>/` (ignored by git):

| file                                                 | meaning                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `app-release-unsigned.aab` / `RabbyMobile.xcarchive` | the artifact to compare and to sign                                      |
| `attest.json`                                        | hashes + toolchain fingerprint + determinism contract/normalization list |
| `report.md`                                          | the same, human readable                                                 |

## Determinism rules

1. **Toolchain must match** between builders: Xcode version+build, the NDK and
   build-tools versions the project pins, Node, Ruby/CocoaPods, Gradle wrapper.
   Install paths, host patch versions and the inventory of other installed SDK
   components do not affect the artifact (verified by an identical AAB).
2. **Canonical build environment**: ambient `RABBY_MOBILE_*` variables are
   dropped except the business inputs (`RABBY_MOBILE_CODE`, `_KR_PWD`,
   `_SAFE_API_KEY`, `_WALLETCONNECT_PROJECT_ID`, `_FE_SERVICE_URL`), and
   debug-only knobs are pinned to production-safe values.
3. **Normalization is a last resort**, and every applied step is listed in
   `attest.json → normalization`.

   Current steps:

   - `plist:semantic` — every `Info.plist` carries Xcode's `BuildMachineOSBuild`;
     the digest ignores that key.
   - `assets.car:semantic` — `actool` writes a wall-clock `Timestamp` and the
     host `DumpToolVersion`; the digest uses `assetutil --info` without them.
     The executable is hashed byte for byte like every other file. ld64's
     non-determinism (duplicate `_objc_msgSend` GOT slots and the order of the
     synthesised objc stubs) is removed **before** hashing by
     `scripts/unsigned/canonicalize-got.mjs`, which rewrites those references to
     one canonical slot and re-derives `LC_UUID`. Both slots bind the same symbol,
     so behaviour is unchanged; two independently linked binaries then agree
     byte for byte. Set `RABBY_MOBILE_IOS_CANONICALIZE_GOT=false` to skip it.

   Because the canonicaliser also rewrites the compiler's escaping-closure path
   lengths, the checkout path no longer shapes the artifact. `build_root` is
   therefore diagnostic only; `RABBY_MOBILE_IOS_BUILD_ROOT` accepts `self`
   (default: build in place), `tmp-channel` (`/tmp/rabby-mobile-ios-<channel>`)
   or an absolute path.

## Determinism measures in the build

- Metro module ids are stable hashes (not traversal-order integers);
- `BUILD_TIME` comes from the commit (`ZERO_AR_DATE`), not the clock;
- native code is compiled with `-ffile-prefix-map` (both `/tmp` and
  `/private/tmp` spellings) so `__FILE__`/debug records are path independent;
- `-Wl,--build-id=none` (lld otherwise hashes toolchain paths into the id);
- the RN Gradle plugin's generated `react_native_dev_server_ip` resource is
  rewritten to `127.0.0.1`;
- Sentry's collect-modules task is disabled (it writes `modules.json` into a
  source directory).

## Comparing two builders

```
node scripts/unsigned/compare.mjs a/attest.json b/attest.json
```

Exit code 0 only when the compared toolchain fields, the contract list and the
hashes agree; host-only differences are reported as notes.

## Publishing

- **Signing (Android)**: `bash scripts/unsigned/sign-android.sh <unsigned.aab>
--attest <attest.json> [--peer-attest <other.json>] [--out <signed.aab>]`.
  It re-hashes the artifact against the attestation, optionally runs the
  two-builder comparison, signs with `jarsigner` using the usual
  `RABBY_MOBILE_ANDROID_*` credentials and writes `<signed>.signed.json`
  binding the unsigned hash to the signed hash.
  Keystore resolution matches the Gradle release config and the fast-build
  rewrite: `RABBY_MOBILE_ANDROID_STORE_FILE` (path; a relative name is looked
  up in `android/app`, then the project root) is preferred, and the CI secret
  form `RABBY_MOBILE_ANDROID_KEY_STORE` (base64, decoded to a private temp
  file) is the fallback. Passwords and alias stay
  `RABBY_MOBILE_ANDROID_STORE_PASSWORD` / `_KEY_PASSWORD` / `_KEY_ALIAS`, and
  the store is opened with `keytool` before the artifact is touched.
- **Signing (iOS)**: reuse the existing export flow (`deploy-ios-adhoc.sh` /
  fastlane `appstore`) from the unsigned archive; credentials stay in the
  environment.
- **Sentry**: `node scripts/unsigned/upload-sentry.mjs --platform android
--bundle … --sourcemap … --release … --dist …` (or `--platform ios
--archive …`), using the same `SENTRY_AUTH_TOKEN` /
  `android/sentry.properties` as the old pipeline. The build itself never
  uploads, so the cross-machine check stays credential-free and the uploaded
  symbols belong to the exact bundle inside the signed artifact.
