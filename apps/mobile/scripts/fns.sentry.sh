RM_OS_NAME=$(uname -s);

sentryfn_setup() {
  if [ -z $project_dir ]; then
    echo "project_dir is not set"
    exit 1
  fi

  if [[ "$RM_OS_NAME" = "Darwin" ]]; then
    export HERMES_OS_BIN="osx-bin"
    [ -z $BUILD_TARGET_PLATFORM ] && export BUILD_TARGET_PLATFORM="ios";
  elif [[ "$RM_OS_NAME" = "Linux" ]]; then
    export HERMES_OS_BIN="linux64-bin"
    [ -z $BUILD_TARGET_PLATFORM ] && export BUILD_TARGET_PLATFORM="android";
  else
    export HERMES_OS_BIN="win64-bin"
    [ -z $BUILD_TARGET_PLATFORM ] && export BUILD_TARGET_PLATFORM="android";
  fi

  if [[ "$BUILD_TARGET_PLATFORM" == "android" ]]; then
    export RMRN_BUNDLE_FILENAME="index.android.bundle"
  else
    export RMRN_BUNDLE_FILENAME="main.jsbundle"
  fi

  if [[ -f "$project_dir/node_modules/hermes-engine/${HERMES_OS_BIN}/hermesc" ]]; then
    # react-native v0.68 or lower
    export HERMES_BIN="$project_dir/node_modules/hermes-engine/${HERMES_OS_BIN}/hermesc"
  else
    # react-native v0.69 or higher (keep only this condition when version is reached)
    export HERMES_BIN="$project_dir/node_modules/react-native/sdks/hermesc/${HERMES_OS_BIN}/hermesc"
  fi

  # the default bundle output directory
  export RMRN_BUNDLE_DIR="$project_dir/$BUILD_TARGET_PLATFORM/app/build4sentry/generated"
  # You can change it by parameter of `react-native bundle --bundle-output`, but make sure it's parent directory exists
  export RMRN_JSBUNDLE_NAME="$RMRN_BUNDLE_DIR/assets/$RMRN_BUNDLE_FILENAME"
  export RMRN_OJSBUNDLE_NAME="$RMRN_BUNDLE_DIR/asset-pieces/$RMRN_BUNDLE_FILENAME"
  # export RMRN_JSBUNDLE_NAME=$RMRN_BUNDLE_FILENAME

  dirs=("$RMRN_JSBUNDLE_NAME" "$RMRN_OJSBUNDLE_NAME")
  for filename in "${dirs[@]}"; do
    dir=$(dirname $filename)
    rm -rf $dir;
    mkdir -p $dir;
  done

  # list ALL important variables
  echo "HERMES_OS_BIN: $HERMES_OS_BIN"
  echo "HERMES_BIN: $HERMES_BIN"
  echo "RMRN_BUNDLE_DIR: $RMRN_BUNDLE_DIR"
  echo "RMRN_JSBUNDLE_NAME: $RMRN_JSBUNDLE_NAME"
  echo ""
}

sentryfn_build_sourcemap() {
  echo "[fns_sentry] Building sourcemap..."

  mkdir -p $RMRN_BUNDLE_DIR;

  $project_dir/node_modules/.bin/react-native bundle \
    --platform $BUILD_TARGET_PLATFORM \
    --reset-cache \
    --dev false \
    --minify false \
    --entry-file index.js \
    --bundle-output ${RMRN_JSBUNDLE_NAME} \
    --assets-dest ${RMRN_BUNDLE_DIR}/res \
    --sourcemap-output ${RMRN_JSBUNDLE_NAME}.packager.map

  cp ${RMRN_JSBUNDLE_NAME} ${RMRN_OJSBUNDLE_NAME}
  cp ${RMRN_JSBUNDLE_NAME}.packager.map ${RMRN_OJSBUNDLE_NAME}.packager.map
}

sentryfn_build_hbc() {
  echo "[fns_sentry] Building Hermes Bytecode (HBC)..."

  "${HERMES_BIN}" \
    -O -emit-binary -output-source-map \
    -out="${RMRN_JSBUNDLE_NAME}.hbc" \
    "${RMRN_JSBUNDLE_NAME}"

  rm "${RMRN_JSBUNDLE_NAME}"
  mv "${RMRN_JSBUNDLE_NAME}.hbc" "${RMRN_JSBUNDLE_NAME}"
}

sentryfn_compose_sourcemap() {
  echo "[fns_sentry] composing sourcemap..."

  node $project_dir/node_modules/react-native/scripts/compose-source-maps.js \
    "${RMRN_JSBUNDLE_NAME}.packager.map" \
    "${RMRN_JSBUNDLE_NAME}.hbc.map" \
    -o "${RMRN_JSBUNDLE_NAME}.map"

  # node $project_dir/node_modules/@sentry/react-native/scripts/copy-debugid.js \
  #   ${RMRN_JSBUNDLE_NAME}.packager.map ${RMRN_JSBUNDLE_NAME}.map
  # rm -f ${RMRN_JSBUNDLE_NAME}.packager.map
}
