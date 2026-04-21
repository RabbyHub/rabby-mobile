#!/bin/sh

UNIX_TYPE=$(uname -s)
RABBY_HOST_OS=`uname`

case $RABBY_HOST_OS in
  MINGW*|CYGWIN*|MSYS_NT*)
    RABBY_HOST_OS="Windows"
    ;;
esac

case $OSTYPE in
  msys*|cygwin*)
    RABBY_HOST_OS="Windows"
    ;;
esac

prepare_env() {
  export script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
  export project_dir=$script_dir
}

resolve_mobile_project_dir() {
  if [ -n "$project_dir" ] && [ -d "$project_dir" ]; then
    printf '%s\n' "$project_dir"
    return 0
  fi

  if [ -n "$script_dir" ] && [ -d "$script_dir" ]; then
    dirname "$script_dir"
    return 0
  fi

  pwd
}

resolve_mobile_build_env() {
  case "${CONFIGURATION:-}" in
    Release)
      echo "production"
      return 0
      ;;
    Regression)
      echo "regression"
      return 0
      ;;
    Debug)
      echo "debug"
      return 0
      ;;
  esac

  case "${RABBY_MOBILE_BUILD_ENV:-}" in
    production|regression|debug)
      echo "$RABBY_MOBILE_BUILD_ENV"
      return 0
      ;;
  esac

  case "${buildchannel:-}" in
    appstore|selfhost)
      echo "production"
      return 0
      ;;
    selfhost-reg)
      echo "regression"
      return 0
      ;;
  esac

  return 1
}

list_candidate_env_files() {
  local current_project_dir
  current_project_dir=$(resolve_mobile_project_dir)
  local build_env
  build_env=$(resolve_mobile_build_env 2>/dev/null || true)

  case "$build_env" in
    production)
      printf '%s\n' \
        "$current_project_dir/.env.production" \
        "$current_project_dir/.env"
      ;;
    regression)
      printf '%s\n' \
        "$current_project_dir/.env.regression" \
        "$current_project_dir/.env.local" \
        "$current_project_dir/.env"
      ;;
    debug)
      printf '%s\n' \
        "$current_project_dir/.env.local" \
        "$current_project_dir/.env"
      ;;
    *)
      printf '%s\n' \
        "$current_project_dir/.env.local" \
        "$current_project_dir/.env"
      ;;
  esac
}

read_env_var_from_file() {
  local env_file="$1"
  local env_key="$2"

  [ -f "$env_file" ] || return 1

  awk -v key="$env_key" '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    {
      line = $0
      sub(/\r$/, "", line)
      pos = index(line, "=")
      if (pos == 0) next

      current_key = substr(line, 1, pos - 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", current_key)
      if (current_key != key) next

      value = substr(line, pos + 1)
      sub(/[[:space:]]*#.*$/, "", value)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)

      first = substr(value, 1, 1)
      last = substr(value, length(value), 1)
      if ((first == "\"" && last == "\"") || (first == "'"'"'" && last == "'"'"'")) {
        value = substr(value, 2, length(value) - 2)
      }

      print value
      exit
    }
  ' "$env_file"
}

load_env_var_from_candidate_files() {
  local env_key="$1"
  local current_value
  eval "current_value=\${$env_key}"

  if [ -n "$current_value" ]; then
    return 0
  fi

  local env_file value
  while IFS= read -r env_file; do
    [ -f "$env_file" ] || continue
    value=$(read_env_var_from_file "$env_file" "$env_key")
    if [ -n "$value" ]; then
      export "$env_key=$value"
      echo "[RabbyMobileBuild] loaded $env_key from $env_file"
      return 0
    fi
  done <<EOF
$(list_candidate_env_files)
EOF

  return 1
}

check_build_params() {
  load_env_var_from_candidate_files RABBY_MOBILE_KR_PWD
  load_env_var_from_candidate_files RABBY_MOBILE_CODE

  if [ -z $RABBY_MOBILE_KR_PWD ]; then
    echo "RABBY_MOBILE_KR_PWD is not set"
    exit 1;
  fi

  if [ -z $RABBY_MOBILE_CODE ]; then
    echo "RABBY_MOBILE_CODE is not set"
    exit 1;
  fi
}

resolve_ios_info_plist_path() {
  local target_path="$1"

  if [ -z "$target_path" ]; then
    echo "Usage: sh ./scripts/fns.sh print_ios_rabbit_code <path-to-.xcarchive-or-.app>" >&2
    return 1
  fi

  if [ -d "$target_path" ] && [ "${target_path##*.}" = "app" ]; then
    local app_info_plist="$target_path/Info.plist"
    if [ -f "$app_info_plist" ]; then
      printf '%s\n' "$app_info_plist"
      return 0
    fi
  fi

  if [ -d "$target_path" ] && [ "${target_path##*.}" = "xcarchive" ]; then
    local archive_info_plist
    archive_info_plist=$(find "$target_path/Products/Applications" -maxdepth 2 -path '*.app/Info.plist' | head -n 1)
    if [ -n "$archive_info_plist" ] && [ -f "$archive_info_plist" ]; then
      printf '%s\n' "$archive_info_plist"
      return 0
    fi
  fi

  echo "Could not resolve Info.plist from: $target_path" >&2
  return 1
}

print_ios_rabbit_code() {
  local target_path="$1"
  local info_plist
  info_plist=$(resolve_ios_info_plist_path "$target_path") || return 1

  /usr/libexec/PlistBuddy -c 'Print :rabbit_code' "$info_plist"
}

check_s3_params() {
  if [ -z $RABBY_MOBILE_BUILD_BUCKET ]; then
    echo "RABBY_MOBILE_BUILD_BUCKET is not set"
    exit 1;
  fi
}

checkout_s3_pub_deployment_params() {
  if [ -z $BUILD_TARGET_PLATFORM ]; then
    export BUILD_TARGET_PLATFORM="android"
  fi
  if [ -z $buildchannel ]; then
    export buildchannel="selfhost-reg"
  fi
  case $buildchannel in
    "appstore"|"selfhost")
      S3_ANDROID_PUB_DEPLOYMENT=$RABBY_MOBILE_PROD_PUB_DEPLOYMENT
      export S3_ANDROID_BAK_DEPLOYMENT=$RABBY_MOBILE_PROD_BAK_DEPLOYMENT
      S3_IOS_PUB_DEPLOYMENT=$RABBY_MOBILE_PROD_PUB_DEPLOYMENT
      export S3_IOS_BAK_DEPLOYMENT=$RABBY_MOBILE_PROD_BAK_DEPLOYMENT
      ;;
    "selfhost-reg")
      S3_ANDROID_PUB_DEPLOYMENT=$RABBY_MOBILE_REG_PUB_DEPLOYMENT
      export S3_ANDROID_BAK_DEPLOYMENT=$RABBY_MOBILE_REG_BAK_DEPLOYMENT
      S3_IOS_PUB_DEPLOYMENT=$RABBY_MOBILE_PUB_DEPLOYMENT
      export S3_IOS_BAK_DEPLOYMENT=$RABBY_MOBILE_BAK_DEPLOYMENT
      ;;
    *)
      echo "Invalid buildchannel: $buildchannel"
      exit 1;
      ;;
  esac

  if [ $BUILD_TARGET_PLATFORM == 'ios' ]; then
    if [ -z $S3_IOS_PUB_DEPLOYMENT ]; then
      echo "[buildchannel:$buildchannel] S3_IOS_PUB_DEPLOYMENT is not set"
      exit 1;
    fi

    if [ -z $S3_IOS_BAK_DEPLOYMENT ]; then
      echo "[buildchannel:$buildchannel] S3_IOS_BAK_DEPLOYMENT is not set"
      exit 1;
    fi

    export s3_upload_prefix=$(echo "$S3_IOS_PUB_DEPLOYMENT" | sed "s#s3://${RABBY_MOBILE_BUILD_BUCKET}/##g" | cut -d'/' -f2-)
    # echo "[debug] s3_upload_prefix is $s3_upload_prefix"
    export cdn_deployment_urlbase="https://download.rabby.io/$s3_upload_prefix"
  elif [ $BUILD_TARGET_PLATFORM == 'android' ]; then
    export s3_upload_prefix=$(echo "$S3_ANDROID_PUB_DEPLOYMENT" | sed "s#s3://${RABBY_MOBILE_BUILD_BUCKET}/##g" | cut -d'/' -f2-)
    # echo "[debug] s3_upload_prefix is $s3_upload_prefix"
    export cdn_deployment_urlbase="https://download.rabby.io/$s3_upload_prefix"
  else
    echo "Invalid BUILD_TARGET_PLATFORM: $BUILD_TARGET_PLATFORM"
    exit 1;
  fi
}

unix_replace_variables() {
    local input_file="$1"
    local output_file="$2"
    shift 2

    if [ ! -f "$input_file" ]; then
        echo "Input $input_file doesn't exist"
        exit 1
    fi

    [ -f $output_file ] && rm "$output_file";
    cp "$input_file" "$output_file"

    while [[ "$#" -gt 0 ]]; do
        local kv="$1"
        # echo "[debug] kv is $kv"

        if [[ "$kv" == --var-* ]]; then
            local var_name=$(echo "$kv" | cut -d'=' -f1 | cut -c 7-)
            local var_value=$(echo "$kv" | cut -d'=' -f2)

            # echo "[debug] var_name is $var_name"
            # echo "[debug] var_value is $var_value"

            local escaped_value=$(printf '%s\n' "$var_value" | sed -e 's/[\/&]/\\&/g')

            if [ $UNIX_TYPE == Darwin ]; then
              # on macOS
              sed -i '' "s#{{ ${var_name} }}#$escaped_value#g" "$output_file"
              sed -i '' "s#{{ __${var_name}__ }}#$escaped_value#g" "$output_file"
            else
              # on Linux
              sed -i "s#{{ ${var_name} }}#$escaped_value#g" "$output_file"
              sed -i "s#{{ __${var_name}__ }}#$escaped_value#g" "$output_file"
            fi
            shift
        else
            echo "Invalid argument: $kv"
            exit 1
        fi
    done

    echo "Replace finished, result in $output_file"
}

reset_builtin_assets() {
  local script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
  local project_dir=$(dirname $script_dir)

  # local targets=(
  #   # $project_dir/android/app/src/main/assets/fonts
  #   $project_dir/ios/RabbyMobile/Resources/
  # )
  # for target in "${targets[@]}"
  # do
  #   echo "cleanup and copy fonts to $target..."
  #   rm -rf $target && mkdir -p $target;
  #   cp $project_dir/assets/fonts/* $target
  # done

  # iOS
  local ios_target=$project_dir/ios/RabbyMobile/Resources/
  echo "cleanup and copy fonts to $ios_target..."
  rm -rf $ios_target && mkdir -p $ios_target;
  cp $project_dir/assets/fonts/* $ios_target

  # Android
  mkdir -p $project_dir/android/app/src/main/assets/fonts && \
    rm -rf $project_dir/android/app/src/main/assets/fonts/*.ttf;

  local android_assets_target=$project_dir/android/app/src/main/assets
  # local android_font_target=$project_dir/android/app/src/main/res/font
  echo "cleanup and copy fonts to $android_assets_target/fonts..."
  cp $project_dir/assets/fonts/* $project_dir/android/app/src/main/assets/fonts/
  echo "cleanup and copy custom js to $android_assets_target/custom..."

  # remove after migrate to built-in pages :start
  mkdir -p $project_dir/android/app/src/main/assets/custom/;
  cp $project_dir/assets/custom/*.js $project_dir/android/app/src/main/assets/custom/
  # remove after migrate to built-in pages :end

  mkdir -p $project_dir/android/app/src/main/assets/custom/builtin-pages;
  rm -rf $project_dir/android/app/src/main/assets/custom/builtin-pages/*;
  if [ -d $project_dir/assets/android/builtin-pages/ ]; then
    cp -r $project_dir/assets/android/builtin-pages/* $project_dir/android/app/src/main/assets/custom/builtin-pages/
  else
    echo "haven't build $project_dir/assets/android/builtin-pages/, skipped copy";
  fi

  # rm -f $android_assets_target/sf_pro_all.ttf && cp $project_dir/assets/fonts/* $ios_target
}

build_worker_if_not_exist() {
  local script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
  local project_dir=$(dirname $script_dir)

  # ./assets/ios/threads/worker.thread.jsbundle
  local ios_target=$project_dir/assets/ios/threads/worker.thread.jsbundle
  if [ ! -f $ios_target ]; then
    echo "[build_worker_if_not_exist] $ios_target not exist, building..."
    yarn buildworker:prod:ios
  else
    echo "[build_worker_if_not_exist] $ios_target exist, skipped."
  fi

  # ./android/app/src/main/assets/threads/worker.thread.bundle
  local android_target=$project_dir/android/app/src/main/assets/threads/worker.thread.bundle
  if [ ! -f $android_target ]; then
    echo "[build_worker_if_not_exist] $android_target not exist, building..."
    yarn buildworker:prod:android
  else
    echo "[build_worker_if_not_exist] $android_target exist, skipped."
  fi
}

print_cmd_upload_changelog() {
  proj_version=$(node --eval="process.stdout.write(require('./package.json').version)");
  if [ -z $upload_ver ]; then
    upload_ver=$proj_version
  fi
  echo "[print_cmd_upload_changelog] try to find markdown changelog for version $upload_ver"
  echo ""

  # android
  if [ -f src/changeLogs/$upload_ver.android.md ]; then
    echo "aws s3 cp src/changeLogs/$upload_ver.android.md s3://\$RABBY_MOBILE_BUILD_BUCKET/rabby/downloads/wallet-mobile/android/$upload_ver.md --acl authenticated-read --content-type text/plain"
  elif [ -f src/changeLogs/$upload_ver.md ]; then
    echo "aws s3 cp src/changeLogs/$upload_ver.md s3://\$RABBY_MOBILE_BUILD_BUCKET/rabby/downloads/wallet-mobile/android/$upload_ver.md --acl authenticated-read --content-type text/plain"
  else
    echo "No change log file found for android version $upload_ver"
  fi

  #ios
  if [ -f src/changeLogs/$upload_ver.ios.md ]; then
    echo "aws s3 cp src/changeLogs/$upload_ver.ios.md s3://\$RABBY_MOBILE_BUILD_BUCKET/rabby/downloads/wallet-mobile/ios/$upload_ver.md --acl authenticated-read --content-type text/plain"
  elif [ -f src/changeLogs/$upload_ver.md ]; then
    echo "aws s3 cp src/changeLogs/$upload_ver.md s3://\$RABBY_MOBILE_BUILD_BUCKET/rabby/downloads/wallet-mobile/ios/$upload_ver.md --acl authenticated-read --content-type text/plain"
  else
    echo "No change log file found for ios version $upload_ver"
  fi

  echo ""
  echo "Now you can upload the markdown files to S3"
}

run_upload_changelog() {
  proj_version=$(node --eval="process.stdout.write(require('./package.json').version)");
  if [ -z $upload_ver ]; then
    upload_ver=$proj_version
  fi
  echo "[run_upload_changelog] try to find markdown changelog for version $upload_ver"
  echo ""

  # android
  if [ -f src/changeLogs/$upload_ver.android.md ]; then
    aws s3 cp src/changeLogs/$upload_ver.android.md s3://$RABBY_MOBILE_BUILD_BUCKET/rabby/downloads/wallet-mobile/android/$upload_ver.md --acl authenticated-read --content-type text/plain
  elif [ -f src/changeLogs/$upload_ver.md ]; then
    aws s3 cp src/changeLogs/$upload_ver.md s3://$RABBY_MOBILE_BUILD_BUCKET/rabby/downloads/wallet-mobile/android/$upload_ver.md --acl authenticated-read --content-type text/plain
  else
    echo "No change log file found for android version $upload_ver"
  fi

  #ios
  if [ -f src/changeLogs/$upload_ver.ios.md ]; then
    aws s3 cp src/changeLogs/$upload_ver.ios.md s3://$RABBY_MOBILE_BUILD_BUCKET/rabby/downloads/wallet-mobile/ios/$upload_ver.md --acl authenticated-read --content-type text/plain
  elif [ -f src/changeLogs/$upload_ver.md ]; then
    aws s3 cp src/changeLogs/$upload_ver.md s3://$RABBY_MOBILE_BUILD_BUCKET/rabby/downloads/wallet-mobile/ios/$upload_ver.md --acl authenticated-read --content-type text/plain
  else
    echo "No change log file found for ios version $upload_ver"
  fi

  echo ""
  echo "Now you can upload the markdown files to S3"
}

update_webview_assets() {
  if [ -z $project_dir ]; then
    local script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
    project_dir=$(dirname $script_dir)
  fi
  curl -fSL https://unpkg.com/vconsole@3.15.1/dist/vconsole.min.js -o $project_dir/assets/custom/vconsole.min.js
  # curl -fSL https://cdn.jsdelivr.net/npm/bignumber.js@9.3.1/bignumber.min.js -o $project_dir/assets/custom/bignumber.js@9.3.1-bignumber.min.js
  # curl -fSL https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js -o $project_dir/assets/custom/lightweight-charts.standalone.production.js
}


func_to_exec=$1

if [ ! -z $func_to_exec ]; then
  case $func_to_exec in
    "--source-only")
      # do nothing
      ;;
    "reset_builtin_assets")
      reset_builtin_assets
      ;;
    "build_worker_if_not_exist")
      build_worker_if_not_exist
      ;;
    "build_worker")
      yarn buildworker:prod:ios
      yarn buildworker:prod:android
      ;;
    "run_upload_changelog")
      run_upload_changelog
      ;;
    "print_cmd_upload_changelog")
      print_cmd_upload_changelog
      ;;
    "update_webview_assets")
      update_webview_assets
      ;;
    "print_ios_rabbit_code")
      shift
      print_ios_rabbit_code "$1"
      ;;
    *)
      echo "Invalid function to execute: $func_to_exec"
      exit 1;
      ;;
  esac
fi
