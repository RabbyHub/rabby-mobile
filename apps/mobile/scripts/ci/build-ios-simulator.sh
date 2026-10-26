#!/usr/bin/env bash

# Simulator-only Regression build. Never call the signed/export/upload lanes.
# The existing preparation helpers intentionally accept unset optional env vars.
set +u
set -eo pipefail

usage() {
  printf '%s\n' \
    'Usage: bash build-ios-simulator.sh --output-dir <new absolute directory> [--derived-data-root <absolute directory>]' \
    'Select Xcode with DEVELOPER_DIR. Outputs: RabbyMobile.app, RabbyMobile-simulator.zip, metadata.json, build.log.'
}

sim_output_dir=''
sim_derived_root=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    --output-dir|--derived-data-root)
      [ "$#" -ge 2 ] || { usage >&2; exit 2; }
      case "$1" in
        --output-dir) sim_output_dir="$2" ;;
        --derived-data-root) sim_derived_root="$2" ;;
      esac
      shift 2
      ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done

case "$sim_output_dir" in
  /*) ;;
  *) echo '[ios-simulator] --output-dir must be absolute' >&2; exit 2 ;;
esac
if [ -e "$sim_output_dir" ] || [ -L "$sim_output_dir" ]; then
  echo '[ios-simulator] output directory already exists; use a new run directory' >&2
  exit 2
fi
case "$sim_derived_root" in
  ''|/*) ;;
  *) echo '[ios-simulator] --derived-data-root must be absolute' >&2; exit 2 ;;
esac
if [ "$(uname -s)" != Darwin ] || [ "$(uname -m)" != arm64 ]; then
  echo '[ios-simulator] an Apple Silicon macOS build host is required' >&2
  exit 2
fi

script_dir="$(cd "$(dirname "$0")/.." && pwd -P)"
project_dir="$(cd "$script_dir/.." && pwd -P)"
sim_repo_root="$(cd "$project_dir/../.." && pwd -P)"
cd "$project_dir"

. "$script_dir/libs/node-runtime.sh"
ensure_mobile_node_runtime
. "$script_dir/fns.sh" --source-only
. "$script_dir/turbo-build/_fns.sh" --source-only

# These are mandatory, not overridable defaults. This lane has no signing or
# distribution side effects even on a machine used for release builds.
export REALLY_UPLOAD=false SKIP_NOTIFY_LARK=true SENTRY_DISABLE_AUTO_UPLOAD=true
export RABBY_MOBILE_LARK_DRIVE_UPLOAD=false RABBY_MOBILE_TURBO_REMOTE_SYNC=false
export RABBY_MOBILE_BUILD_ENV=regression APP_ENV=regression buildchannel=selfhost-reg
export CONFIGURATION=Regression
export BUILD_TARGET_PLATFORM=ios RCT_NO_LAUNCH_PACKAGER=1
export RABBY_MOBILE_TURBO_BUILD=true RABBY_MOBILE_TURBO_CACHE_MODE=local-first
export FORCE_BUNDLING=1
unset SKIP_BUNDLING DO_POD_INSTALL

sim_commit="$(git -C "$sim_repo_root" rev-parse HEAD)"
git -C "$sim_repo_root" diff --quiet HEAD -- || {
  echo '[ios-simulator] tracked source is dirty; build the intended committed source' >&2
  exit 2
}
sim_architecture="$(node "$script_dir/react-native-architecture.cjs")"
case "$sim_architecture" in
  new) export RCT_NEW_ARCH_ENABLED=1 ;;
  legacy) export RCT_NEW_ARCH_ENABLED=0 ;;
  *) echo '[ios-simulator] unknown React Native architecture' >&2; exit 2 ;;
esac

mkdir -p "$project_dir/.turbo-build"
sim_lock_dir="$project_dir/.turbo-build/ios-simulator-build.lock"
if ! mkdir "$sim_lock_dir"; then
  echo '[ios-simulator] another simulator build owns this checkout (or its lock needs inspection)' >&2
  exit 2
fi
trap 'rmdir "$sim_lock_dir"' EXIT
mkdir -p "$sim_output_dir"
sim_output_dir="$(cd "$sim_output_dir" && pwd -P)"
exec > >(tee "$sim_output_dir/build.log") 2>&1
sim_started_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "[ios-simulator] source=$sim_commit architecture=$sim_architecture"

turbo_prepare_js_dependencies
sim_assets_key="$(turbo_compute_ios_build_artifacts_key)"
if turbo_ios_build_artifacts_ready "$sim_assets_key"; then
  turbo_log 'ios build artifacts already up to date'
else
  ensure_inpage_bridge_assets
  yarn check-nodeengines
  yarn ../mobile-local-pages make-theme
  yarn ../mobile-local-pages build --mode ios
  # This lane must not rewrite Android's tracked asset-link manifest.
  yarn react-native-asset --ios-assets
  bash "$script_dir/fns.sh" reset_builtin_assets
  yarn buildworker:prod:ios
  # Intentionally no syncrnversion: validate the source version, never bump it.
  turbo_mark_ios_build_artifacts_ready "$sim_assets_key"
fi
bash "$project_dir/ios/patches/override-xcconfig-release.sh"
turbo_prepare_ruby_bundle
turbo_prepare_cocoapods

# Preserve ordinary 64-character variant directories, but namespace the hash
# by Simulator SDK/config/CPU/checkout so a device archive cannot reuse it.
sim_sdk_version="$(xcrun --sdk iphonesimulator --show-sdk-version)"
sim_sdk_build="$(xcrun --sdk iphonesimulator --show-sdk-build-version)"
sim_xcode_version="$(xcodebuild -version)"
sim_base_key="$(turbo_compute_ios_derived_data_key)"
sim_cache_key="$(printf '%s\n' "$sim_base_key" "$sim_repo_root" \
  'iphonesimulator/Regression/arm64' "$sim_sdk_version" "$sim_sdk_build" \
  | turbo_sha256 | awk '{print $1}')"
sim_derived_root="${sim_derived_root:-$RABBY_MOBILE_TURBO_LOCAL_CACHE_ROOT/ios-derived-data}"
sim_derived_data="$sim_derived_root/$sim_cache_key"
mkdir -p "$sim_derived_data"

xcodebuild build \
  -workspace "$project_dir/ios/RabbyMobile.xcworkspace" \
  -scheme RabbyMobileRegression -configuration Regression \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$sim_derived_data" \
  -parallelizeTargets -hideShellScriptEnvironment \
  ARCHS=arm64 'EXCLUDED_ARCHS[sdk=iphonesimulator*]=' \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY= PROVISIONING_PROFILE_SPECIFIER= \
  SENTRY_DISABLE_AUTO_UPLOAD=true FORCE_BUNDLING=1

# A failed xcodebuild exits above, before any previous DerivedData output can
# be exported. Preserve this successful build before later validation so a
# provenance failure still has an explicitly non-qualified diagnostic app.
sim_app="$sim_derived_data/Build/Products/Regression-iphonesimulator/RabbyMobile.app"
[ -d "$sim_app" ] && [ -s "$sim_app/main.jsbundle" ] || {
  echo '[ios-simulator] missing app or embedded JS bundle' >&2; exit 1;
}
sim_zip="$sim_output_dir/RabbyMobile-simulator.zip"
ditto "$sim_app" "$sim_output_dir/RabbyMobile.app"
sim_app="$sim_output_dir/RabbyMobile.app"
ditto -c -k --sequesterRsrc --keepParent "$sim_app" "$sim_zip"

# Structural validation always examines the preserved copy. An archive alone
# is not qualification evidence; consumers must require its matching receipt.
sim_executable="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$sim_app/Info.plist")"
case "$sim_executable" in
  ''|*/*|.|..) echo '[ios-simulator] invalid executable name' >&2; exit 1 ;;
esac
[ "$(xcrun lipo -archs "$sim_app/$sim_executable")" = arm64 ] || {
  echo '[ios-simulator] expected a pure arm64 executable' >&2; exit 1;
}
xcrun vtool -show-build "$sim_app/$sim_executable" > "$sim_output_dir/macho-build.txt"
grep -Eq 'platform[[:space:]]+IOSSIMULATOR' "$sim_output_dir/macho-build.txt" || {
  echo '[ios-simulator] executable was not built for iOS Simulator' >&2; exit 1;
}
SIM_BUILD_COMMIT="$sim_commit" SIM_BUILD_ARCHITECTURE="$sim_architecture" \
SIM_BUILD_STARTED_AT="$sim_started_at" SIM_BUILD_SDK="$sim_sdk_version" \
SIM_BUILD_SDK_BUILD="$sim_sdk_build" SIM_BUILD_XCODE="$sim_xcode_version" \
node - "$sim_app" "$sim_zip" "$sim_repo_root" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const [appPath, zipPath, repoRoot] = process.argv.slice(2);
const outputDir = path.dirname(zipPath);
const sourceCommit = process.env.SIM_BUILD_COMMIT;
const git = args => execFileSync('git', ['-C', repoRoot, ...args], {
  encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
});
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
// Compare with the original commit, not only the final HEAD: a commit made
// during the build must not erase the evidence of changed source. NUL fields
// preserve spaces/newlines in paths without ever emitting a raw source diff.
const changes = git(['diff', '--name-status', '-z', '--no-renames', sourceCommit, '--']).split('\0');
if (changes.pop() !== '' || changes.length % 2 !== 0) throw new Error('Invalid source change report');
const files = [];
for (let index = 0; index < changes.length; index += 2) {
  const status = changes[index];
  const file = changes[index + 1];
  const absolute = path.resolve(repoRoot, file);
  if (!/^[ACDMTUXB]$/.test(status) || !file || !absolute.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error('Invalid source change entry');
  }
  let type = 'missing';
  let sha256 = null;
  try {
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) {
      type = 'symlink';
      sha256 = digest(fs.readlinkSync(absolute));
    } else if (stat.isFile()) {
      type = 'file';
      sha256 = digest(fs.readFileSync(absolute));
    } else {
      type = 'directory';
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  files.push({ path: file, status, type, sha256 });
}
const headCommit = git(['rev-parse', 'HEAD']).trim();
const sourceProvenance = {
  status: files.length === 0 && headCommit === sourceCommit ? 'clean' : 'modified',
  headCommit,
  changedFiles: files.map(file => file.path),
};
fs.writeFileSync(path.join(outputDir, 'source-changes.json'), `${JSON.stringify({
  schemaVersion: 1, sourceCommit, ...sourceProvenance, files,
}, null, 2)}\n`, { flag: 'wx' });
const plist = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', path.join(appPath, 'Info.plist')], { encoding: 'utf8' }));
const pkg = JSON.parse(git(['show', `${sourceCommit}:apps/mobile/package.json`]));
if (plist.CFBundleShortVersionString !== pkg.version || !plist.CFBundleVersion) {
  throw new Error('Built app version does not match committed package metadata');
}
if (plist.DTPlatformName !== 'iphonesimulator') throw new Error('Expected Simulator plist platform');
const js = fs.readFileSync(path.join(appPath, 'main.jsbundle'));
// Hermes bytecode magic (little-endian). Metro JS alone is not this lane's contract.
if (js.subarray(0, 8).toString('hex') !== 'c61fbc03c103191f') {
  throw new Error('Embedded main.jsbundle is not Hermes bytecode');
}
const hash = file => digest(fs.readFileSync(file));
const metadata = {
  schemaVersion: 2,
  sourceCommit,
  sourceProvenance,
  producer: {
    repository: process.env.GITHUB_REPOSITORY || null,
    runId: process.env.GITHUB_RUN_ID || null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
  },
  configuration: 'Regression',
  platform: 'iphonesimulator',
  architectures: ['arm64'],
  reactNativeArchitecture: process.env.SIM_BUILD_ARCHITECTURE,
  appVersion: plist.CFBundleShortVersionString,
  buildVersion: plist.CFBundleVersion,
  bundleId: plist.CFBundleIdentifier,
  executable: plist.CFBundleExecutable,
  minimumOSVersion: plist.MinimumOSVersion,
  xcode: process.env.SIM_BUILD_XCODE,
  sdkVersion: process.env.SIM_BUILD_SDK,
  sdkBuildVersion: process.env.SIM_BUILD_SDK_BUILD,
  startedAt: process.env.SIM_BUILD_STARTED_AT,
  completedAt: new Date().toISOString(),
  archive: { file: path.basename(zipPath), sha256: hash(zipPath), bytes: fs.statSync(zipPath).size },
  executableSha256: hash(path.join(appPath, plist.CFBundleExecutable)),
  jsBundleSha256: hash(path.join(appPath, 'main.jsbundle')),
};
// A receipt proves artifact structure and records provenance; a modified
// receipt is retained for an explicit diagnostic probe, never normal coverage.
fs.writeFileSync(path.join(outputDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, { flag: 'wx' });
if (sourceProvenance.status !== 'clean') {
  console.error(headCommit !== sourceCommit
    ? '[ios-simulator] source commit changed during build; diagnostic archive retained, qualification failed'
    : '[ios-simulator] build changed tracked source; diagnostic archive retained, qualification failed');
  process.exitCode = 1;
}
NODE
echo "[ios-simulator] build and artifact verification succeeded: $sim_output_dir"
