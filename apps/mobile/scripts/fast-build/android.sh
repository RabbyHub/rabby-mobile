#!/bin/bash

fscript_dir="$( cd "$( dirname "$0"  )" && pwd  )"
script_dir=$(dirname $fscript_dir)
project_dir=$(dirname $script_dir)

. $fscript_dir/_fns.sh --source-only
. $script_dir/build-cache/_fns.sh --source-only

work_dir=$script_dir/.fast-build-work

android_payload_inputs_ready() {
  [ -f "$project_dir/android/app/src/main/assets/threads/worker.thread.bundle" ] || return 1
  find "$project_dir/android/app/src/main/assets/custom" -type f -print -quit 2>/dev/null | grep -q .
}

prepare_android_payload_inputs() {
  if android_payload_inputs_ready; then
    echo "[prepare_android_payload_inputs] android payload inputs already available."
    return 0
  fi

  cd "$project_dir"

  if [ -z "$SKIP_YARN" ]; then
    echo "Installing dependencies..."
    yarn install --immutable
  else
    echo "Skipping yarn install as per SKIP_YARN flag."
  fi

  echo "Preparing Android payload inputs..."
  yarn check-nodeengines &&
    yarn ../mobile-local-pages make-theme &&
    yarn ../mobile-local-pages build --mode android &&
    yarn react-native-asset &&
    sh ./scripts/fns.sh reset_builtin_assets &&
    yarn buildworker:prod:android
}

build_official_android_payload() {
  prepare_android_payload_inputs || {
    echo "Failed to prepare Android payload inputs."
    exit 1
  }

  cd "$project_dir"
  export RABBY_MOBILE_BUILD_ENV="regression"
  export BUILD_TARGET_PLATFORM="android"
  export SENTRY_DISABLE_AUTO_UPLOAD="${SENTRY_DISABLE_AUTO_UPLOAD:-true}"

  if build_cache_enabled; then
    build_cache_restore_android_gradle_state
  fi

  echo "Building official Android payload from Gradle task..."
  ./android/gradlew createBundleRegressionJsAndAssets -p ./android \
    -Porg.gradle.configuration-cache=true \
    -Porg.gradle.caching=true \
    -Porg.gradle.parallel=true
  build_status=$?

  if [ $build_status -eq 0 ] && build_cache_enabled; then
    build_cache_save_android_gradle_state
  fi

  if [ $build_status -ne 0 ]; then
    echo "Failed to build Android payload via Gradle."
    exit 1
  fi

  if [ ! -f "$generated_bundle" ]; then
    echo "Expected generated bundle not found at $generated_bundle"
    exit 1
  fi
}

stage_fast_build_payload() {
  rm -rf "$payload_stage_dir"
  mkdir -p "$payload_stage_dir"

  case "$fast_build_scope" in
    bundle-only)
      mkdir -p "$payload_stage_dir/assets"
      cp "$generated_bundle" "$payload_stage_dir/assets/index.android.bundle"
      ;;
    assets-payload|full-payload)
      if [ ! -d "$merged_assets_dir" ]; then
        echo "Expected merged assets not found at $merged_assets_dir"
        exit 1
      fi

      mkdir -p "$payload_stage_dir/assets"
      cp -R "$merged_assets_dir"/. "$payload_stage_dir/assets"/

      if [ "$fast_build_scope" = "full-payload" ]; then
        if [ ! -d "$generated_res_dir" ]; then
          echo "Expected generated resources not found at $generated_res_dir"
          exit 1
        fi
        mkdir -p "$payload_stage_dir/res"
        cp -R "$generated_res_dir"/. "$payload_stage_dir/res"/
      fi
      ;;
  esac
}

write_template_apk_entries() {
  unzip -Z1 "$template_apk" >"$template_apk_entries_file"
}

delete_managed_asset_entries_from_apk() {
  write_template_apk_entries
  awk '
    /^assets\/index\.android\.bundle$/ ||
    /^assets\/fonts\// ||
    /^assets\/custom\// ||
    /^assets\/threads\//
  ' "$template_apk_entries_file" >"$managed_asset_entries_file"

  if [ -s "$managed_asset_entries_file" ]; then
    xargs zip -q -d "$repacked_apk" <"$managed_asset_entries_file"
  fi
}

assert_res_entries_patchable() {
  [ -d "$payload_stage_dir/res" ] || return 0

  write_template_apk_entries

  missing_res_entries_file="$work_dir/missing-res-entries.txt"
  : >"$missing_res_entries_file"

  (
    cd "$payload_stage_dir/res"
    find . -type f | sed 's#^\./##' | sort
  ) | while IFS= read -r relpath; do
    [ -z "$relpath" ] && continue
    apk_entry="res/$relpath"
    if ! grep -Fxq "$apk_entry" "$template_apk_entries_file"; then
      printf '%s\n' "$apk_entry" >>"$missing_res_entries_file"
    fi
  done

  if [ -s "$missing_res_entries_file" ]; then
    echo "[fast-build] The template APK is missing generated Android resource entries:"
    sed 's/^/  - /' "$missing_res_entries_file"
    echo "[fast-build] Refusing fast-build full-payload patch because resources.arsc would likely be stale."
    return 1
  fi
}

prepare() {
  if [ -z "$ANDROID_HOME" ] || [ ! -d "$ANDROID_HOME" ]; then
    echo "ANDROID_HOME is not set or does not point to a valid directory."
    exit 1
  fi

  if [ ! -z "$CI" ]; then
    export build_tool_ver="35.0.0"
  else
    export build_tool_ver=$(find_build_tools_version)
    if [ -z "$build_tool_ver" ]; then
      echo "No build-tools found in ANDROID_HOME."
      exit 1
    fi
  fi

  export apksigner_path=$ANDROID_HOME/build-tools/$build_tool_ver/apksigner
  export zipalign_path=$ANDROID_HOME/build-tools/$build_tool_ver/zipalign

  if [ ! -x "$apksigner_path" ]; then
    echo "apksigner not found in $apksigner_path."
    exit 1
  else
    echo "Using apksigner at $apksigner_path"
  fi

  if [ ! -x "$zipalign_path" ]; then
    echo "zipalign not found in $zipalign_path."
    exit 1
  else
    echo "Using zipalign at $zipalign_path"
  fi

  export temp_apk_dir=$work_dir/temp_apk;
  mkdir -p $work_dir;
  rm -rf $temp_apk_dir;
  rm -f $work_dir/app-*.apk;
  rm -f $work_dir/app-*.apk.idsig;

  export fast_build_scope=$(normalize_fast_build_scope)
  export js_bundle_dir="$work_dir/jsbundle";
  export js_bundle_relname="assets/index.android.bundle"
  export payload_stage_dir="$work_dir/payload"
  export template_apk_entries_file="$work_dir/template-apk-entries.txt"
  export managed_asset_entries_file="$work_dir/managed-asset-entries.txt"
  export generated_bundle="$project_dir/android/app/build/generated/assets/createBundleRegressionJsAndAssets/index.android.bundle"
  export generated_res_dir="$project_dir/android/app/build/generated/res/createBundleRegressionJsAndAssets"
  export merged_assets_dir="$project_dir/android/app/build/intermediates/assets/regression/mergeRegressionAssets"

  export reg_apk="$project_dir/android/app/build/outputs/apk/regression/app-regression.apk"
  export template_apk="$work_dir/template.apk"
  export template_hash_file="$work_dir/template.template-shell-hash"

  revision_hash=$(collect_android_native_entries)

  if [ -f "$template_apk" ]; then
    cached_template_hash=""
    if [ -f "$template_hash_file" ]; then
      cached_template_hash=$(tr -d '\r\n' <"$template_hash_file")
    fi

    if [ -z "$cached_template_hash" ] || [ "$cached_template_hash" != "$revision_hash" ]; then
      echo "[prepare] Local template APK is stale for current template shell hash, removing cached template."
      rm -f "$template_apk" "$template_hash_file"
    fi
  fi

  if [ ! -f "$template_apk" ]; then
    # allow failed
    download_template_apk_by_hash $revision_hash || {
      echo "Failed to download template APK"
    }

    if [ -f "$template_apk" ]; then
      printf '%s\n' "$revision_hash" >"$template_hash_file"
    fi
  fi

  if [ ! -f "$template_apk" ] && [ -f "$reg_apk" ]; then
    echo "[prepare] Template APK not found at $template_apk, would you like use regression APK at $reg_apk instead? (y/n)"
    read use_reg_apk
    if [ "$use_reg_apk" == "y" ]; then
      cp $reg_apk $template_apk
      printf '%s\n' "$revision_hash" >"$template_hash_file"
    fi
  fi

  export repacked_apk="$work_dir/app-packed.apk"
  export aligned_apk=${repacked_apk%.apk}-aligned.apk
  export output_apk="$work_dir/app-resigned.apk"

  if [ ! -z "$RABBY_MOBILE_ANDROID_KEY_STORE" ]; then
    export tmp_key_store_file="$work_dir/rabby-mobile.jks"
    echo "$RABBY_MOBILE_ANDROID_KEY_STORE" | base64 -d > $tmp_key_store_file
  else
    echo "RABBY_MOBILE_ANDROID_KEY_STORE is not set."
    exit 1
  fi
}

replace_js_bundle() {
  if [ ! -f "$template_apk" ]; then
    echo "[replace_js_bundle] Template APK not found at $template_apk"
    exit 1
  fi

  stage_fast_build_payload

  if [ "$fast_build_scope" = "full-payload" ]; then
    assert_res_entries_patchable || exit 1
  fi

  cd "$work_dir"

  echo "From $template_apk, replacing payload in APK with scope: $fast_build_scope"

  cp "$template_apk" "$repacked_apk"

  if [ "$fast_build_scope" = "bundle-only" ]; then
    echo "Replacing official Hermes bundle only..."
    (
      cd "$payload_stage_dir"
      zip -r1X "$repacked_apk" assets/index.android.bundle
    )
  else
    echo "Refreshing managed asset entries from official Gradle outputs..."
    delete_managed_asset_entries_from_apk
    (
      cd "$payload_stage_dir"
      zip -r1X "$repacked_apk" assets
    )

    if [ -d "$payload_stage_dir/res" ]; then
      echo "Refreshing patchable generated Android resources..."
      (
        cd "$payload_stage_dir"
        zip -r1X "$repacked_apk" res
      )
    fi
  fi

  echo "Aligning APK..."
  $zipalign_path -v -p 4 "$repacked_apk" "$aligned_apk"
  cd "$work_dir"
}

resign_apk() {
  if [ ! -f "$aligned_apk" ]; then
    echo "Output APK not found at $aligned_apk"
    exit 1
  fi

  echo "Signing APK..."
  $apksigner_path sign \
    --key-pass pass:$RABBY_MOBILE_ANDROID_KEY_PASSWORD \
    --ks-pass pass:$RABBY_MOBILE_ANDROID_STORE_PASSWORD \
    --ks-key-alias $RABBY_MOBILE_ANDROID_KEY_ALIAS \
    --ks $tmp_key_store_file \
    --v2-signing-enabled true \
    --v3-signing-enabled true \
    --v4-signing-enabled true \
    --out $output_apk \
    $aligned_apk

  # rm -f $tmp_key_store_file
  rm -f $work_dir/*.apk.idsig

  if [ $? -ne 0 ]; then
    echo "Failed to sign APK."
    exit 1
  fi
}

verify_apk() {
  if [ ! -f "$output_apk" ]; then
    echo "Output APK not found at $output_apk"
    exit 1
  fi

  echo "Verifying APK..."
  $apksigner_path verify --verbose $output_apk
  if [ $? -ne 0 ]; then
    echo "APK verification failed."
    exit 1
  fi

  rm -f $aligned_apk $repacked_apk

  echo ""
  echo "APK signed successfully. Output APK: $output_apk"
  echo "You can now install the APK using adb: \`adb install -r $output_apk\`"
}

command="$1";
if [ -z "$command" ]; then
  echo "Usage: $0 <command>"
  echo "Commands:"
  echo "  resign - Resign the APK"
  echo "Samples:"
  echo "  $0 resign"
  echo ""
  echo "Optional envs:"
  echo "  RABBY_MOBILE_FAST_BUILD_SCOPE=bundle-only|assets-payload|full-payload"
fi

case "$command" in
  resign)
    prepare;
    if [ -z "$build_tool_ver" ]; then
      echo "No build-tools found in ANDROID_HOME."
      exit 1
    fi
    build_official_android_payload;
    replace_js_bundle;
    resign_apk;
    verify_apk;
    ;;
  *)
    echo "Unknown command: $command"
    exit 1
    ;;
esac
