# Android native build profile (ABI + ccache)

Two knobs, both resolved at build time; neither changes what a store package
contains.

## ABI profile

`reactNativeArchitectures` decides which ABIs every module (the app and each RN
library) compiles with CMake. Building all four costs roughly 4x the native
work, so the **Regression / SignOnly lanes build `arm64-v8a` alone** — those
packages only ever run on arm64 test devices. Store/release lanes keep
`armeabi-v7a,arm64-v8a,x86,x86_64`.

Selection order (in `fastlane/Fastfile`):

1. `RABBY_MOBILE_ANDROID_ARCHITECTURES` (comma separated), else
2. the lane default: `arm64-v8a` for `assembleRegression`, all four otherwise.

Overriding from the command line still works and always wins:

```bash
./gradlew :app:assembleRegression -PreactNativeArchitectures=arm64-v8a
./gradlew :app:assembleRegression -PreactNativeArchitectures=armeabi-v7a,arm64-v8a
```

Measured effect on `:app:assembleRegression` (dry run, task count only):

| ABIs | `buildCMakeRelWithDebInfo` tasks |
| --- | --- |
| all four | 44 (11 targets x 4) |
| `arm64-v8a` | 11 (+3 from one module that hardcodes its own list) |

## ccache

`app/build.gradle` points CMake's compiler launchers at ccache **only when the
binary actually exists**:

- `-PrabbYAndroidCcache=auto` (default): use ccache when found, otherwise skip.
- `-PrabbYAndroidCcache=true`: require it — the build fails with a clear
  message if it is missing.
- `-PrabbYAndroidCcache=false`: never use it.

This matters because CMake aborts configuration when
`CMAKE_C_COMPILER_LAUNCHER` names a program that cannot be found
("that program was not found"), so an unconditional launcher would break every
machine without ccache. `CCACHE_PATH` overrides the lookup; otherwise `PATH`
and the Homebrew prefixes are searched.

Current scope: the app module's CMake targets (codegen C++ / `libappmodules.so`).
Third-party modules would need the same launcher injected per module.

ccache only pays off when the CMake build tree is gone but the cache is not
(fresh worktree, `gradlew clean`, branch switch); on ordinary incremental builds
AGP's own up-to-date checks already skip the compile.

## iOS ccache (same idea, different lane)

`RABBY_MOBILE_POD_USE_CACHE=true` makes the Podfile pass `:ccache_enabled` to
React Native, which points `CC`/`CXX` at RN's `ccache-clang*.sh` wrappers.

Two things had to be fixed for that to actually cache:

1. the wrappers `exec "$CCACHE_BINARY" clang`, and `CCACHE_BINARY` is only a
   build setting on the Pod targets, so `build-ios-simulator.sh` now exports it
   for the whole build (before that the wrapper silently ran plain clang: 2285
   compiles, 0 ccache calls);
2. `scripts/ci/ensure-ccache.sh` guarantees a ccache binary exists — local one
   when it is new enough, otherwise the pinned bundle from
   `s3://<bucket>/_private/toolchains/ccache/4.14.3/<platform>.tar.gz`
   (sha256 checked). Strict by default in CI, `RABBY_MOBILE_CCACHE_STRICT=false`
   to build without it.

Measured on simulator Regression builds, first run (cold) vs second run against
the same DerivedData root:

| machine | compile calls via ccache | 2nd-run hits | wall time |
| --- | --- | --- | --- |
| Mac Studio (local) | 2284 / 2285 | 252 / 504 (50%) | 5m35s -> 3m33s |
| Mac mini M4 (.60) | 2284 / 2285 | 252 / 2536 (10%) | 5mxx -> 3m24s |

Hits need a stable DerivedData path: forcing a new `--derived-data-root` per run
changes `-fdebug-prefix-map`/`-ivfsstatcache` arguments and misses everything,
even with a warm cache. The remaining misses on the second run come from targets
whose compile flags carry a per-session value; tightening that is follow-up
work, not a wiring problem.
