#!/bin/sh

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$script_dir
export android_export_dir="$project_dir/app/build/outputs/"

cd $project_dir

./gradlew clean -q

if [ ! -z $CI ];
  RM_BUILD_FLAGS="-q --refresh-dependencies"
else
  RM_BUILD_FLAGS=""
fi

if [[ "$1" == "buildAppStore" ]]; then
  echo "[android-build] build aab"
  # aab
  ./gradlew bundleRelease $RM_BUILD_FLAGS --parallel
  export android_export_target="$project_dir/app/build/outputs/bundle/release/app-release.aab"
elif [[ "$1" == "buildApk" ]]; then
  echo "[android-build] build apk"
  # apk
  ./gradlew assembleRelease $RM_BUILD_FLAGS --parallel
  export android_export_target="$project_dir/app/build/outputs/apk/release/app-release.apk"
fi

if [ -f "$android_export_target" ] ; then
    echo "\033[32;1mexport android success 🎉  🎉  🎉   \033[0m"
    open $(dirname $android_export_target)
else
    echo "\033[31;1mexport android failed 😢 😢 😢     \033[0m"
    exit 1
fi

echo "\033[36;1mAndroid build time: ${SECONDS}s \033[0m"
