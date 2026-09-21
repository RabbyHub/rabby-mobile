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

load_env_var_from_candidate_files RABBY_MOBILE_CODE

if [ -z "$RABBY_MOBILE_CODE" ]; then
  echo "[RabbyMobileBuild] no RABBY_MOBILE_CODE set for $configuration_name, abort bundle"
  exit 1;
fi

localAppConfigPath="$project_dir/ios/RabbyMobile/AppConfig.${configuration_name}.local.xcconfig"

echo "[RabbyMobileBuild] process project_dir: $project_dir"

echo "[RabbyMobileBuild] write AppConfig override: $localAppConfigPath"
cat > "$localAppConfigPath" <<EOF
//
//  AppConfig.${configuration_name}.local.xcconfig
//  Generated locally by override-xcconfig-release.sh
//  Do not commit.
//

RABBY_MOBILE_CODE = ${RABBY_MOBILE_CODE}
EOF
