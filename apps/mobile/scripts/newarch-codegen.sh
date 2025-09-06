#!/usr/bin/env bash

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $script_dir)

cd $project_dir/android && ./gradlew generateCodegenArtifactsFromSchema;

# node $project_dir/node_modules/react-native/scripts/generate-codegen-artifacts.js \
#     --path . \
#     --outputPath . \
#     --targetPlatform android

# node node_modules/react-native/scripts/generate-codegen-artifacts.js \
#     --path . \
#     --outputPath ios/ \
#     --targetPlatform ios
