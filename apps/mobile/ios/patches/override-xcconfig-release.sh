#!/bin/sh

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $(dirname $script_dir))

. "$project_dir/scripts/fns.sh" --source-only

resolve_build_configuration() {
  case "${CONFIGURATION:-}" in
    Release)
      echo "Release"
      return 0
      ;;
    Regression)
      echo "Regression"
      return 0
      ;;
  esac

  case "${RABBY_MOBILE_BUILD_ENV:-}" in
    production)
      echo "Release"
      return 0
      ;;
    regression)
      echo "Regression"
      return 0
      ;;
  esac

  return 1
}

configuration_name=$(resolve_build_configuration)

if [ -z "$configuration_name" ]; then
  echo "[RabbyMobileBuild] skip AppConfig override for CONFIGURATION=${CONFIGURATION:-unset} RABBY_MOBILE_BUILD_ENV=${RABBY_MOBILE_BUILD_ENV:-unset}"
  exit 0
fi

load_env_var_from_candidate_files RABBY_MOBILE_CODE || true

if ! validate_rabbit_code; then
  echo "[RabbyMobileBuild] abort $configuration_name bundle: invalid RABBY_MOBILE_CODE"
  exit 1;
fi

localAppConfigPath="$project_dir/ios/RabbyMobile/AppConfig.${configuration_name}.local.xcconfig"

echo "[RabbyMobileBuild] process project_dir: $project_dir"

echo "[RabbyMobileBuild] write AppConfig override: $localAppConfigPath"
repo_root=$(cd "$project_dir/../.." && pwd)
repo_root_alias=$(printf '%s' "$repo_root" | sed -E 's#^/private/tmp#/tmp#')
repo_map_flags="-ffile-prefix-map=${repo_root}=/rabby"
repo_swift_flags="-Xcc \"-ffile-prefix-map=${repo_root}=/rabby\" -file-prefix-map ${repo_root}=/rabby -debug-prefix-map ${repo_root}=/rabby"
if [ "$repo_root_alias" != "$repo_root" ]; then
  repo_map_flags="$repo_map_flags -ffile-prefix-map=${repo_root_alias}=/rabby"
  repo_swift_flags="$repo_swift_flags -Xcc \"-ffile-prefix-map=${repo_root_alias}=/rabby\" -file-prefix-map ${repo_root_alias}=/rabby -debug-prefix-map ${repo_root_alias}=/rabby"
fi
cat > "$localAppConfigPath" <<EOF
//
//  AppConfig.${configuration_name}.local.xcconfig
//  Generated locally by override-xcconfig-release.sh
//  Do not commit.
//

RABBY_MOBILE_CODE = ${RABBY_MOBILE_CODE}

// Reproducible builds: the checkout path must not leak into the app binary.
// ObjC selector stubs are ordered by the linker in a way that varies between
// links; plain objc_msgSend calls keep the output stable.
OTHER_CFLAGS = \$(inherited) ${repo_map_flags} -fno-objc-msgsend-selector-stubs
OTHER_CPLUSPLUSFLAGS = \$(inherited) ${repo_map_flags} -fno-objc-msgsend-selector-stubs
OTHER_SWIFT_FLAGS = \$(inherited) ${repo_swift_flags}
EOF
