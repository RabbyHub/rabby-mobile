#!/usr/bin/env bash

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $script_dir)

. $script_dir/fns.sh --source-only
. $script_dir/fast-build/_fns.sh --source-only
. $script_dir/libs/node-runtime.sh
. $script_dir/turbo-build/_fns.sh --source-only
. $script_dir/ci/ios-compilation-cache.sh

ensure_mobile_node_runtime

verify_ios_ipa_rabbit_code() {
  local ipa="$1"
  local expected="$2"
  local tmp_dir actual
  tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/rabby-ipa-check.XXXXXX") || return 1
  if ! unzip -q "$ipa" -d "$tmp_dir"; then
    rm -rf "$tmp_dir"
    return 1
  fi
  actual=$(/usr/libexec/PlistBuddy -c 'Print :rabbit_code' "$tmp_dir/Payload/RabbyMobile.app/Info.plist" 2>/dev/null || true)
  rm -rf "$tmp_dir"
  if [ "$actual" != "$expected" ]; then
    if [ -z "$actual" ]; then
      echo "[deploy-ios-adhoc] RABBY_MOBILE_CODE mismatch in IPA (value missing)" >&2
    else
      echo "[deploy-ios-adhoc] RABBY_MOBILE_CODE mismatch in IPA (length ${#actual} != expected ${#expected})" >&2
    fi
    return 1
  fi
  return 0
}

export buildchannel="selfhost-reg";
export BUILD_TARGET_PLATFORM="ios";
export RABBY_MOBILE_BUILD_ENV="regression";
if [ "$RABBY_MOBILE_IOS_BUILD_UNSIGNED" != "true" ]; then
  check_build_params;
  check_s3_params;
  checkout_s3_pub_deployment_params;
fi

# make plist file
cd $project_dir;
proj_version=$(node --eval="process.stdout.write(require('./package.json').version)");
app_display_name=$(node --eval="process.stdout.write(require('./app.json').displayName)");
cd $script_dir;

ouput_dir=$project_dir/ios/Package/adhoc
deployment_local_dir="$script_dir/deployments/ios-adhoc"

rm -rf $deployment_local_dir && mkdir -p $deployment_local_dir;

mkdir -p "$script_dir/deployments/tmp"

adhoc_settings_json="$script_dir/deployments/tmp/RabbyMobileAdHoc.settings.json"
xcodebuild -project $project_dir/ios/RabbyMobile.xcodeproj -target "RabbyMobile" -showBuildSettings -json > "$adhoc_settings_json"
plutil -convert xml1 - -o $script_dir/deployments/tmp/RabbyMobileAdHoc.plist < "$adhoc_settings_json"

ios_version_name=$(/usr/libexec/PlistBuddy -c "Print:CFBundleShortVersionString" $project_dir/ios/RabbyMobile/Info.plist)
ios_version_code=$(/usr/libexec/PlistBuddy -c "Print:0:buildSettings:CURRENT_PROJECT_VERSION" $script_dir/deployments/tmp/RabbyMobileAdHoc.plist)
cd $project_dir/ios;

unix_replace_variables $script_dir/tpl/ios/version.json $deployment_local_dir/version.json \
  --var-DOWNLOAD_URL=$cdn_deployment_urlbase/ios/ \
  --var-APP_VER_CODE=$ios_version_code \
  --var-APP_VER="$proj_version"

# ============ prepare changelogs :start ============== #
possible_changelogs=(
  "$project_dir/src/changeLogs/$proj_version.ios.md"
  "$project_dir/src/changeLogs/$proj_version.md"
)

for changelog in "${possible_changelogs[@]}"; do
  if [ -f $changelog ]; then
    echo "[deploy-ios-adhoc] found changelog: $changelog"
    cp $changelog $deployment_local_dir/$proj_version.md
    break
  fi
done
# ============ prepare changelogs :end ============== #

build_adhoc() {
  export RABBY_MOBILE_BUILD_ENV="regression";
  cd $project_dir;
  sh ./ios/patches/override-xcconfig-release.sh;
  if [ -n "$RABBY_MOBILE_SIGN_ONLY_ARCHIVE" ]; then
    echo "[deploy-ios-adhoc] sign-only mode: exporting from $RABBY_MOBILE_SIGN_ONLY_ARCHIVE"
    export ios_archive_path="$RABBY_MOBILE_SIGN_ONLY_ARCHIVE"
    export RABBY_MOBILE_IOS_ARCHIVE_PATH="$RABBY_MOBILE_SIGN_ONLY_ARCHIVE"
    export RABBY_MOBILE_IOS_SKIP_BUILD_ARCHIVE=true
    export RABBY_MOBILE_SIGN_ONLY=true
    # Never re-upload an IPA left over from an earlier run.
    rm -f "$ouput_dir/RabbyMobile.ipa"
    prepare_ios_ruby_bundle || return $?
    export GYM_XCARGS="${GYM_XCARGS:+$GYM_XCARGS }$(rabby_ios_compilation_cache_xcargs)"
    turbo_bundle_exec exec fastlane ios adhoc
    return $?
  fi
  export ios_archive_path="$project_dir/ios/Package/adhoc/RabbyMobile.xcarchive"

  prepare_ios_build_artifacts;
  prepare_status=$?

  if [ $prepare_status -ne 0 ]; then
    return $prepare_status
  fi

  if ios_fast_build_enabled; then
    prepare_ios_ruby_bundle;
    ruby_status=$?

    if [ $ruby_status -ne 0 ]; then
      return $ruby_status
    fi

    echo "[deploy-ios-adhoc] trying iOS fast-build from template archive..."
    CI="$CI" SKIP_YARN=true sh $script_dir/fast-build/ios.sh export
    fast_build_status=$?

    if [ $fast_build_status -eq 0 ]; then
      echo "[deploy-ios-adhoc] iOS fast-build succeeded."
      return 0
    fi

    echo "[deploy-ios-adhoc] iOS fast-build failed with status $fast_build_status, will fall back to full archive build."
  fi

  prepare_ios_native_deps;
  deps_status=$?

  if [ $deps_status -ne 0 ]; then
    return $deps_status
  fi

  if turbo_build_enabled; then
    turbo_prepare_ios_derived_data || return $?
  fi

  if [ "$SENTRY_DISABLE_AUTO_UPLOAD" == "true" ]; then
    export GYM_XCARGS="${GYM_XCARGS:+$GYM_XCARGS }SENTRY_DISABLE_AUTO_UPLOAD=true"
  fi

  export GYM_XCARGS="${GYM_XCARGS:+$GYM_XCARGS }$(rabby_ios_compilation_cache_xcargs)"

  # Build the JS bundle concurrently with the archive's compile step, then let
  # the bundle phase copy it in instead of bundling again (RABBY_MOBILE_IOS_PREBUNDLE_JS).
  prebundle_pid=""
  if [ "${RABBY_MOBILE_IOS_PREBUNDLE_JS:-true}" = "true" ]; then
    prebundle_dir="$(mktemp -d "${TMPDIR:-/tmp}/rabby-ios-prebundle.XXXXXX")"
    export RABBY_MOBILE_PREBUILT_BUNDLE_DIR="$prebundle_dir"
    # The adhoc lane archives the Regression configuration, so collect that
    # configuration's build settings for the standalone bundle run.
    prebundle_settings_json="$script_dir/deployments/tmp/RabbyMobileRegression.settings.json"
    xcodebuild -project "$project_dir/ios/RabbyMobile.xcodeproj" -target RabbyMobile -configuration Regression -showBuildSettings -json > "$prebundle_settings_json"
    echo "[deploy-ios-adhoc] prebuilding the JS bundle in $prebundle_dir"
    (
      # The bundle phase expects a full Xcode build environment; replay the
      # settings collected from -showBuildSettings so it can run outside xcodebuild.
      python3 - "$prebundle_settings_json" "$prebundle_dir" "$project_dir/ios" > "$prebundle_dir/prebundle.log" 2>&1 <<'PREBUNDLE_PY'
import json, os, subprocess, sys

settings_path, out_dir, ios_dir = sys.argv[1], sys.argv[2], sys.argv[3]
data = json.load(open(settings_path))
entries = data if isinstance(data, list) else [data]
settings = {}
for entry in entries:
    settings.update(entry.get("buildSettings") or {})
env = dict(os.environ)
for key, value in settings.items():
    env[str(key)] = str(value)
env["RABBY_MOBILE_PREBUNDLE_OUT"] = out_dir
env.setdefault("PLATFORM_NAME", "iphoneos")
sys.exit(subprocess.call(["bash", "./patches/phase-bundle-rn.sh"], cwd=ios_dir, env=env))
PREBUNDLE_PY
    ) &
    prebundle_pid=$!
  fi

  turbo_bundle_exec exec fastlane ios adhoc;
  build_status=$?

  if [ -n "$prebundle_pid" ]; then
    wait "$prebundle_pid" || {
      echo "[deploy-ios-adhoc] prebuilt JS bundle failed; log follows:" >&2
      [ -f "$prebundle_dir/prebundle.log" ] && cat "$prebundle_dir/prebundle.log" >&2
      return 1
    }
  fi

  if [ $build_status -eq 0 ] && ios_fast_build_enabled && [ -d "$ios_archive_path" ]; then
    sh $script_dir/fast-build/ios.sh save-template "$ios_archive_path"
  fi

  return $build_status
}

prepare_ios_ruby_bundle() {
  turbo_prepare_ruby_bundle
}

prepare_ios_build_artifacts() {
  turbo_prepare_js_dependencies || return $?

  if turbo_build_enabled; then
    ios_build_artifacts_key=$(turbo_compute_ios_build_artifacts_key) || return $?
  fi

  if turbo_build_enabled && turbo_ios_build_artifacts_ready "$ios_build_artifacts_key"; then
    turbo_log "ios build artifacts already up to date"
    return 0
  fi

  ensure_inpage_bridge_assets || return $?

  yarn check-nodeengines &&
    yarn ../mobile-local-pages make-theme &&
    yarn ../mobile-local-pages build --mode ios &&
    yarn react-native-asset &&
    sh ./scripts/fns.sh reset_builtin_assets &&
    yarn buildworker:prod:ios &&
    yarn syncrnversion
  prepare_status=$?

  if [ $prepare_status -ne 0 ]; then
    return $prepare_status
  fi

  if turbo_build_enabled; then
    turbo_mark_ios_build_artifacts_ready "$ios_build_artifacts_key"
  fi
}

prepare_ios_native_deps() {
  prepare_ios_ruby_bundle || return $?

  turbo_prepare_cocoapods || return $?

  # React Native writes its codegen output into ios/build/generated/ios during
  # `pod install`. That directory is gitignored and turbo_prepare_cocoapods
  # returns early on a cache hit, so a fresh checkout (or one whose cached Pods
  # layer lost it) fails later with e.g.
  #   error: "RCTAppDependencyProvider.h" ... no such file or directory
  # Regenerate whenever the directory is missing or has no headers.
  local generated_ios_dir="$project_dir/ios/build/generated/ios"
  if [ ! -d "$generated_ios_dir" ] ||
    [ -z "$(find "$generated_ios_dir" -name '*.h' -maxdepth 3 2>/dev/null | head -1)" ]; then
    echo '[deploy-ios-adhoc] ios codegen output missing; re-running pod install' >&2
    # Bypass the Pods cache: dropping the architecture stamp is not enough,
    # because the restore path brings its own stamp back and reports a hit.
    turbo_reinstall_cocoapods || return $?
  fi
}

# Sign-only local build: reuse the feature-test artifact preparation, then
# archive without signing so the cloud machine can sign it.
if [ "$RABBY_MOBILE_IOS_BUILD_UNSIGNED" == "true" ]; then
  unsigned_channel="${RABBY_MOBILE_IOS_UNSIGNED_CHANNEL:-regression}"
  if [ "$unsigned_channel" == "production" ]; then
    unsigned_scheme="RabbyMobile"
    unsigned_configuration="Release"
    echo "[deploy-ios-adhoc] reproducible build: producing an unsigned production archive"
    export RABBY_MOBILE_BUILD_ENV="production"
    # Phase-bundle only defaults the channel to appstore when it is empty, and
    # this script exports selfhost-reg at the top: pin the production channel.
    export buildchannel="appstore"
  else
    unsigned_scheme="RabbyMobileRegression"
    unsigned_configuration="Regression"
    echo "[deploy-ios-adhoc] sign-only build: producing an unsigned archive"
    export RABBY_MOBILE_SIGN_ONLY=true
    export RABBY_MOBILE_BUILD_ENV="regression"
  fi
  cd "$project_dir"
  # Same canonical environment as the Android unsigned build: ambient
  # RABBY_MOBILE_* variables and cache lanes must not shape a shipped artifact.
  . "$project_dir/scripts/unsigned/canonical-env.sh"
  unsigned_apply_canonical_env
  # Re-assert the channel knobs dropped by the canonicalisation above.
  if [ "$unsigned_channel" == "production" ]; then
    export RABBY_MOBILE_BUILD_ENV="production"
    export buildchannel="appstore"
  else
    export RABBY_MOBILE_SIGN_ONLY=true
    export RABBY_MOBILE_BUILD_ENV="regression"
    export buildchannel="selfhost-reg"
  fi
  export SENTRY_DISABLE_AUTO_UPLOAD="${SENTRY_DISABLE_AUTO_UPLOAD:-true}"
  export ZERO_AR_DATE="${ZERO_AR_DATE:-$(git -C "$project_dir" show -s --format=%cI HEAD)}"
  # Swift embeds #file/#filePath literals that no driver flag remaps, so every
  # builder of a channel must use the same absolute checkout path. The root is
  # derived from the channel and is an intermediate value: it is not read from
  # the environment, and the CI job checks the repository out there.
  # `self` (the default) builds in place; `tmp-channel` uses the fixed
  # per-channel directory. Any other value must be an absolute path.
  build_root_spec="${RABBY_MOBILE_IOS_BUILD_ROOT:-self}"
  case "$build_root_spec" in
    self)
      ios_build_root="$(cd "$project_dir/../.." && pwd -P)"
      ios_build_root_source="self"
      ;;
    tmp-channel)
      ios_build_root="/tmp/rabby-mobile-ios-${unsigned_channel}"
      ios_build_root_source="tmp-channel"
      ;;
    /*)
      ios_build_root="$build_root_spec"
      ios_build_root_source="explicit"
      ;;
    *)
      echo "[deploy-ios-adhoc] RABBY_MOBILE_IOS_BUILD_ROOT must be 'self', 'tmp-channel' or an absolute path (got: $build_root_spec)" >&2
      exit 2
      ;;
  esac
  export RABBY_MOBILE_IOS_BUILD_ROOT="$ios_build_root"
  export RABBY_MOBILE_IOS_BUILD_ROOT_SOURCE="$ios_build_root_source"
  current_root="$(cd "$project_dir/../.." && pwd)"
  # Xcode hands /private/... paths to the compiler as /...; the canonicaliser
  # subtracts this prefix length from the escaping-closure immediates. It must
  # match the checkout the compiler actually saw.
  canonical_root="${current_root#/private/}"
  export RABBY_MOBILE_IOS_CANONICAL_ROOT_LEN="${#canonical_root}"
  if [ "$ios_build_root_source" != "self" ] && [ "$current_root" != "$ios_build_root" ]; then
    echo "[deploy-ios-adhoc] WARNING: checkout is at $current_root but the $unsigned_channel build root is $ios_build_root." >&2
    echo "[deploy-ios-adhoc]          the canonicaliser will subtract that prefix length from its records." >&2
  fi
  # The RNFS pod compiles a Rust crate (rabby-safe-svg) inside the archive, and
  # rustc embeds the toolchain and cargo-registry paths in the static library.
  # Pin the compiler the CI workflows use and remap those prefixes so two
  # builders produce the same bytes.
  export RUSTUP_TOOLCHAIN="${RABBY_MOBILE_RUST_TOOLCHAIN:-1.95.0}"
  rabby_rustup_home="${RUSTUP_HOME:-$HOME/.rustup}"
  rabby_cargo_home="${CARGO_HOME:-$HOME/.cargo}"
  rabby_rustflags="${RUSTFLAGS:-}"
  rabby_rustflags="$rabby_rustflags --remap-path-prefix=${rabby_rustup_home}/toolchains=/rust-toolchain"
  for registry_src in "$rabby_cargo_home"/registry/src/*; do
    [ -d "$registry_src" ] || continue
    rabby_rustflags="$rabby_rustflags --remap-path-prefix=${registry_src}=/cargo/registry/src/registry"
  done
  rabby_rustflags="$rabby_rustflags --remap-path-prefix=${project_dir}/../..=/rabby"
  export RUSTFLAGS="$rabby_rustflags"
  prepare_ios_build_artifacts || exit $?
  prepare_ios_native_deps || exit $?
  # Swift embeds #file literals; switch the affected pod sources to #fileID so
  # the artifact no longer depends on the checkout path at all.
  bash "$project_dir/scripts/unsigned/patch-swift-file-literals.sh" || exit $?
  sh ./ios/patches/override-xcconfig-release.sh
  unsigned_archive="${RABBY_MOBILE_IOS_UNSIGNED_ARCHIVE:-$project_dir/.sign-only/RabbyMobile.xcarchive}"
  rm -rf "$unsigned_archive" "${unsigned_archive}.zip"
  # `[Hermes] Replace Hermes for the right configuration` skips when this marker
  # matches the current configuration, which leaves the Debug hermes framework
  # inside a Release/Regression archive. That app crashes at JS init
  # (EXC_BAD_ACCESS in Hermes on launch). Drop the marker so the phase runs and
  # installs the Release hermes.
  find "$project_dir/ios/Pods" -maxdepth 1 -name ".last_build_configuration" -delete 2>/dev/null
  xcodebuild \
    -workspace "$project_dir/ios/RabbyMobile.xcworkspace" \
    -scheme "$unsigned_scheme" \
    -configuration "$unsigned_configuration" \
    -destination 'generic/platform=iOS' \
    -archivePath "$unsigned_archive" \
    -derivedDataPath "${RABBY_MOBILE_IOS_DERIVED_DATA:-/tmp/rabby-dd}" \
    CODE_SIGNING_ALLOWED=NO \
    CODE_SIGN_IDENTITY="" \
    CODE_SIGNING_REQUIRED=NO \
    SENTRY_DISABLE_AUTO_UPLOAD=true \
    $(rabby_ios_compilation_cache_xcargs) \
    archive || exit $?
  # An unsigned archive carries no entitlements, so the later gym export
  # re-signs the app with the bare minimum (application-identifier/team-id) and
  # features that need entitlements crash at launch. Ad-hoc sign the archive
  # app with the Release entitlements so the export keeps them.
  unsigned_app="$unsigned_archive/Products/Applications/RabbyMobile.app"
  unsigned_entitlements="$project_dir/ios/RabbyMobile/RabbyMobileRelease.entitlements"
  # ld64 assigns the duplicated _objc_msgSend GOT slots and orders the
  # synthesised objc stubs non-deterministically. Rewrite those references to
  # one canonical slot (and re-derive LC_UUID) so two builders produce the same
  # bytes; both slots bind the same symbol, so behaviour is unchanged.
  if [ -d "$unsigned_app" ] && [ "${RABBY_MOBILE_IOS_CANONICALIZE_GOT:-true}" != "false" ]; then
    unsigned_executable="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$unsigned_app/Info.plist" 2>/dev/null || echo RabbyMobile)"
    echo "[deploy-ios-adhoc] canonicalising GOT/stub references in $unsigned_executable"
    node "$project_dir/scripts/unsigned/canonicalize-got.mjs" \
      "$unsigned_app/$unsigned_executable" --root "$current_root" || exit $?
  fi
  # A production archive must stay byte-identical to what the hash covers, so it
  # is never ad-hoc signed here; the signing machine signs the verified bytes.
  if [ "$unsigned_channel" != "production" ] && [ -d "$unsigned_app" ] && [ -f "$unsigned_entitlements" ]; then
    echo "[deploy-ios-adhoc] ad-hoc signing the unsigned archive with entitlements"
    codesign --force --sign - --timestamp=none --entitlements "$unsigned_entitlements" "$unsigned_app" || exit $?
  fi
  (cd "$(dirname "$unsigned_archive")" && ditto -c -k --sequesterRsrc --keepParent "$(basename "$unsigned_archive")" "${unsigned_archive}.zip")
  unsigned_rabbit_code=$(print_ios_rabbit_code "$unsigned_archive" 2>/dev/null || true)
  if [ "$unsigned_rabbit_code" != "$RABBY_MOBILE_CODE" ]; then
    if [ -z "$unsigned_rabbit_code" ]; then
      echo "[deploy-ios-adhoc] RABBY_MOBILE_CODE mismatch in unsigned archive (value missing)" >&2
    else
      echo "[deploy-ios-adhoc] RABBY_MOBILE_CODE mismatch in unsigned archive (length ${#unsigned_rabbit_code} != expected ${#RABBY_MOBILE_CODE})" >&2
    fi
    exit 1
  fi
  echo "[deploy-ios-adhoc] unsigned iOS archive: ${unsigned_archive}.zip"
  shasum -a 256 "${unsigned_archive}.zip"
  exit 0
fi

[ "$GHA_MOCK_BUILD_FAILED" == "true" ] && SKIP_BUILD=true

if [[ -n "$RABBY_MOBILE_SIGN_ONLY_ARCHIVE" || -z $SKIP_BUILD || ! -f $ouput_dir/RabbyMobile.ipa ]]; then
  echo "[deploy-ios-adhoc] start build..."
  build_adhoc || exit $?
  echo "[deploy-ios-adhoc] finish build."
fi

if [[ ! -f $ouput_dir/RabbyMobile.ipa || "$GHA_MOCK_BUILD_FAILED" == "true" ]]; then
  echo "[deploy-ios-adhoc] ⚠️ build failed! No $ouput_dir/RabbyMobile.ipa found";
  node $script_dir/notify-lark.js "FAILED" ios
  exit 1;
fi

if [ -n "${RABBY_MOBILE_CODE:-}" ]; then
  verify_ios_ipa_rabbit_code "$ouput_dir/RabbyMobile.ipa" "$RABBY_MOBILE_CODE" || exit 1
fi

file_date=$(date -r $ouput_dir/RabbyMobile.ipa '+%Y%m%d_%H%M%S')
version_bundle_name="${ios_version_name}.${ios_version_code}-$file_date"
deployment_s3_dir=$S3_IOS_PUB_DEPLOYMENT/ios-$version_bundle_name
deployment_cdn_baseurl=$cdn_deployment_urlbase/ios-$version_bundle_name
manifest_plist_url="itms-services://?action=download-manifest&url=$deployment_cdn_baseurl/manifest.plist"

cp $ouput_dir/RabbyMobile.ipa $deployment_local_dir/rabbymobile.ipa
cp $ouput_dir/manifest.plist $deployment_local_dir/manifest.plist

/usr/libexec/PlistBuddy -c "Set:items:0:metadata:title Reg Rabby Wallet" $deployment_local_dir/manifest.plist
/usr/libexec/PlistBuddy -c "Set:items:0:metadata:bundle-identifier com.debank.rabby-mobile-regression" $deployment_local_dir/manifest.plist
/usr/libexec/PlistBuddy -c "Set:items:0:assets:0:url $deployment_cdn_baseurl/rabbymobile.ipa" $deployment_local_dir/manifest.plist # appURL
/usr/libexec/PlistBuddy -c "Set:items:0:assets:1:url $deployment_cdn_baseurl/icon_57x57@57w.png" $deployment_local_dir/manifest.plist # displayImageURL
/usr/libexec/PlistBuddy -c "Set:items:0:assets:2:url $deployment_cdn_baseurl/icon_512x512@512w.png" $deployment_local_dir/manifest.plist # fullSizeImageURL

echo "[deploy-ios-adhoc] will upload to $deployment_s3_dir"
echo "[deploy-ios-adhoc] will be served at $deployment_cdn_baseurl"

echo ""

if [ "$REALLY_UPLOAD" == "true" ]; then
  [ "$DISABLE_AWS_CLI_HTTPS_VALIDATION" == "true" ] && NO_VERIFY_SSL_FLAG="--no-verify-ssl"
  echo "[deploy-ios-adhoc] start sync to $deployment_s3_dir..."
  aws s3 sync $NO_VERIFY_SSL_FLAG $deployment_local_dir $deployment_s3_dir/ --exclude '*' --include "*.ipa" --acl public-read --content-type application/octet-stream --exact-timestamps || exit 1
  aws s3 sync $NO_VERIFY_SSL_FLAG $deployment_local_dir $deployment_s3_dir/ --exclude '*' --include "*.plist" --acl public-read --content-type application/x-plist --exact-timestamps || exit 1
  aws s3 sync $NO_VERIFY_SSL_FLAG $deployment_local_dir $deployment_s3_dir/ --exclude '*' --include "*.png" --acl public-read --content-type image/png --exact-timestamps || exit 1
  aws s3 sync $NO_VERIFY_SSL_FLAG $deployment_local_dir $deployment_s3_dir/ --exclude '*' --include "*.json" --acl public-read --content-type application/json --exact-timestamps || exit 1
  aws s3 sync $NO_VERIFY_SSL_FLAG $deployment_local_dir $deployment_s3_dir/ --exclude '*' --include "*.md" --acl public-read --content-type text/plain --exact-timestamps || exit 1

  # Sign-only runs report the published URL back through this file so the
  # workflow can write result.json for the fe-opcode record.
  if [ -n "${RABBY_MOBILE_SIGN_ONLY_RESULT_FILE:-}" ]; then
    printf '%s\n' "$deployment_cdn_baseurl/rabbymobile.ipa" > "$RABBY_MOBILE_SIGN_ONLY_RESULT_FILE"
  fi

  lark_drive_url=""
  if [ "$RABBY_MOBILE_LARK_DRIVE_UPLOAD" = "true" ] && [ "$SKIP_NOTIFY_LARK" != "true" ]; then
    echo "[deploy-ios-adhoc] upload IPA to Lark Drive..."
    if ! lark_drive_url=$(node "$script_dir/ci/upload-package-to-lark-drive.js" "$deployment_local_dir/rabbymobile.ipa" "${version_bundle_name}.ipa"); then
      echo "[deploy-ios-adhoc] ⚠️ Lark Drive upload failed; keeping AWS notification only."
      [ "$RABBY_MOBILE_LARK_DRIVE_UPLOAD_REQUIRED" = "true" ] && exit 1
    fi
  fi

  if [ "$SKIP_NOTIFY_LARK" != "true" ]; then
    RABBY_MOBILE_LARK_DRIVE_URL="$lark_drive_url" node $script_dir/notify-lark.js "$manifest_plist_url" ios "$(ios_fast_build_enabled_value)"
  else
    echo "[deploy-ios-adhoc] SKIP_NOTIFY_LARK=true, skip Lark notification."
  fi
fi

[ -z $RABBY_MOBILE_CDN_FRONTEND_ID ] && RABBY_MOBILE_CDN_FRONTEND_ID="<DIST_ID>"

if [ -z $CI ]; then
  echo "[deploy-ios-adhoc] force fresh CDN:"
  echo "[deploy-ios-adhoc] \`aws cloudfront create-invalidation --distribution-id $RABBY_MOBILE_CDN_FRONTEND_ID --paths '/$s3_upload_prefix/ios/*'\`"
  echo ""
fi

echo "[deploy-ios-adhoc] finish sync."
