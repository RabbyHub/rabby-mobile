# Reproducible production builds

Build the **production-identity, unsigned** artifact once, hash it, and let a
second machine reproduce the same hash before anything gets signed.

```
apps/mobile/scripts/reproduce/build-android.sh [out-dir]   # unsigned AAB
apps/mobile/scripts/reproduce/build-ios.sh     [out-dir]   # unsigned .xcarchive
```

Each script writes into `out-dir` (default `apps/mobile/.reproduce/<platform>`):

| file                                                 | meaning                                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `app-release-unsigned.aab` / `RabbyMobile.xcarchive` | the artifact to cross-check and to sign                                    |
| `attest.json`                                        | hashes + toolchain fingerprint + the normalization steps that were applied |
| `report.md`                                          | the same, human readable                                                   |

## Rules

1. **Toolchain must match exactly** between builders (Xcode version+build, NDK,
   JDK, Gradle, Node, Ruby/CocoaPods, Android build-tools, macOS). Only the
   Xcode `.app` installation path may differ.
2. **Normalization is a last resort**, and every step that runs must be listed
   in `attest.json → normalization`. Two attestations with different lists are
   not comparable even if the hashes happen to match.
3. Compare `toolchain` (ignoring its `paths` block) and then the hashes.

## What is hashed

- Android: the unsigned **AAB** bytes (`artifact.sha256`) plus the JS bundle
  extracted from `base/assets/index.android.bundle` (`artifact.bundle.sha256`).
- iOS: the `.app` tree (`tree.tree_sha256`), currently over the raw bytes.

## Signing

The signing machine takes the artifact whose hash was reproduced by two
builders, re-runs the same normalization, verifies the hash, and only then
signs it. It never builds a production artifact itself.
