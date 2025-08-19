#!/bin/bash

fscript_dir="$( cd "$( dirname "$0"  )" && pwd  )"
script_dir=$(dirname $fscript_dir)
project_dir=$(dirname $script_dir)

. $fscript_dir/_fns.sh --source-only

work_dir=$script_dir/.fast-build-work

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

  export js_bundle_dir="$work_dir/jsbundle";
  export js_bundle_relname="assets/index.android.bundle"
  export res_dir="$js_bundle_dir/res"

  export reg_apk="$project_dir/android/app/build/outputs/apk/regression/app-regression.apk"
  export template_apk="$work_dir/template.apk"
  # rm -f $template_apk;

  if [ ! -f "$template_apk" ]; then
    revision_hash=$(collect_android_native_entries)
    # allow failed
    download_template_apk_by_hash $revision_hash || {
      echo "Failed to download template APK"
    }
  fi

  if [ ! -f "$template_apk" ] && [ -f "$reg_apk" ]; then
    echo "[prepare] Template APK not found at $template_apk, would you like use regression APK at $reg_apk instead? (y/n)"
    read use_reg_apk
    if [ "$use_reg_apk" == "y" ]; then
      cp $reg_apk $template_apk
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

build_js_bundle() {
  if [ ! -z $SKIP_BUNDLE_JS ] && [ -f "$js_bundle_dir/$js_bundle_relname" ]; then
    echo "Skipping JS bundle build as per SKIP_BUNDLE_JS flag."
    return
  fi

  cd $project_dir;
  if [ -z "$SKIP_YARN" ]; then
    echo "Installing dependencies..."
    yarn install --frozen-lockfile;
  else
    echo "Skipping yarn install as per SKIP_YARN flag."
  fi

  echo "Building JS bundle..."

  export RABBY_MOBILE_BUILD_ENV="regression";

  rm -rf $js_bundle_dir;

  $project_dir/node_modules/.bin/react-native bundle \
    --platform android \
    --reset-cache \
    --dev false \
    --entry-file index.js \
    --bundle-output $js_bundle_dir/$js_bundle_relname \
    --minify true
    # --assets-dest $res_dir \


  # local osType=$(uname -s)
  # if [ "$osType" == "Linux" ]; then
  #   local hermes_bin="$project_dir/node_modules/react-native/sdks/hermesc/linux-bin/hermes"
  # else
  #   local hermes_bin="$project_dir/node_modules/react-native/sdks/hermesc/osx-bin/hermes"
  # fi
  # "$hermes_bin" -emit-binary -out "$js_bundle_dir/$js_bundle_relname.hbc" "$js_bundle_dir/$js_bundle_relname"

  if [ $? -ne 0 ]; then
    echo "Failed to build JS bundle."
    exit 1
  fi
}

replace_js_bundle() {
  if [ ! -f "$template_apk" ]; then
    echo "[replace_js_bundle] Template APK not found at $template_apk"
    exit 1
  fi

  cd $work_dir

  echo "From $template_apk, replacing bundle in APK..."

  cp $template_apk $repacked_apk
  echo "Directly replace index.android.bundle in APK..."
  cd $js_bundle_dir;
  zip -r1X $repacked_apk $js_bundle_relname
  # zip -r0X $repacked_apk $js_bundle_relname $js_bundle_relname.hbc
  cd $work_dir;
  # echo "Directly replace res in APK..."
  # zip -r0k $repacked_apk $res_dir

  echo "Aligning APK..."
  $zipalign_path -v -p 4 $repacked_apk $aligned_apk
  cd $work_dir
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
fi

case "$command" in
  resign)
    prepare;
    if [ -z "$build_tool_ver" ]; then
      echo "No build-tools found in ANDROID_HOME."
      exit 1
    fi
    build_js_bundle;
    replace_js_bundle;
    resign_apk;
    verify_apk;
    ;;
  *)
    echo "Unknown command: $command"
    exit 1
    ;;
esac

