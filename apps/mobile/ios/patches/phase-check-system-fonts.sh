#!/bin/bash
set -e

# Run after all resource-copy and Metro phases, before Xcode signs the app.
# Resolve Node exactly as the React Native Xcode phases do.
: "${SRCROOT:?Xcode SRCROOT is required}"
: "${TARGET_BUILD_DIR:?Xcode TARGET_BUILD_DIR is required}"
: "${WRAPPER_NAME:?Xcode WRAPPER_NAME is required}"
export REACT_NATIVE_PATH="${REACT_NATIVE_PATH:-$SRCROOT/../../../node_modules/react-native}"
export PODS_ROOT="${PODS_ROOT:-$SRCROOT/Pods}"
. "$REACT_NATIVE_PATH/scripts/xcode/with-environment.sh" ""
if [ -z "${NODE_BINARY:-}" ] || [ ! -x "$NODE_BINARY" ]; then
  echo "error: iOS font audit requires an executable NODE_BINARY in .xcode.env.local" >&2
  exit 1
fi

exec "$NODE_BINARY" "$SRCROOT/../scripts/check-ios-system-fonts.cjs" \
  "$TARGET_BUILD_DIR/$WRAPPER_NAME"
