#!/bin/sh

set -e

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $script_dir)

# https://docs.sentry.io/platforms/react-native/manual-setup/hermes/

os_name=$(uname -s)

if [[ "$os_name" = "Darwin" ]]; then
  HERMES_OS_BIN="osx-bin"
elif [[ "$os_name" = "Linux" ]]; then
  HERMES_OS_BIN="linux64-bin"
else
  HERMES_OS_BIN="win64-bin"
fi

if [[ -f "$project_dir/node_modules/react-native/sdks/hermesc/${HERMES_OS_BIN}/hermesc" ]]; then
  # react-native v0.69 or higher (keep only this condition when version is reached)
  HERMES_BIN="$project_dir/node_modules/react-native/sdks/hermesc/${HERMES_OS_BIN}/hermesc"
elif [[ -f "$project_dir/node_modules/hermes-engine/${HERMES_OS_BIN}/hermesc" ]]; then
  # react-native v0.68 (current)
  HERMES_BIN="$project_dir/node_modules/hermes-engine/${HERMES_OS_BIN}/hermesc"
else
  echo "Hermes compiler not found."
  exit 1;
fi

JSBUNDLE_NAME="../android/app/src/main/assets/index.android.bundle"

"${HERMES_BIN}" \
  -O \
  -emit-binary \
  -output-source-map \
  -out="${JSBUNDLE_NAME}.hbc" \
  "${JSBUNDLE_NAME}"

rm -f "${JSBUNDLE_NAME}"
mv "${JSBUNDLE_NAME}.hbc" "${JSBUNDLE_NAME}"

node ../node_modules/react-native/scripts/compose-source-maps.js \
  "${JSBUNDLE_NAME}.packager.map" \
  "${JSBUNDLE_NAME}.hbc.map" \
  -o "${JSBUNDLE_NAME}.map"
