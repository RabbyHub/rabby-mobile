#!/bin/sh

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$script_dir
export_path="$project_dir/app/build/outputs/apk/release"

cd $project_dir

./gradlew clean -q

# apk
./gradlew assembleRelease -q --refresh-dependencies

# aar
if [[ "$1" == "bundleRelease" ]]; then
    ./gradlew bundleRelease
fi

if [ -f "$export_path/app-release.apk" ] ; then
    echo "\033[32;1mexport android success 🎉  🎉  🎉   \033[0m"
    open $export_path
else
    echo "\033[31;1mexport android failed 😢 😢 😢     \033[0m"
    exit 1
fi

echo "\033[36;1mAndroid build time: ${SECONDS}s \033[0m"
