#!/usr/bin/env node
'use strict';

const { bundleCommand } = require('@react-native/community-cli-plugin');
const { loadConfigAsync } = require('@react-native-community/cli-config');

const platform = process.argv[2];

const bundleConfig = {
  android: {
    assetsDest: './android/app/src/main/res/',
    bundleOutput: './android/app/src/main/assets/threads/worker.thread.bundle',
  },
  ios: {
    assetsDest: './ios',
    bundleOutput: './assets/ios/threads/worker.thread.jsbundle',
  },
};

const selected = bundleConfig[platform];
if (!selected) {
  console.error('Usage: build-worker-prod.js <android|ios>');
  process.exit(1);
}

const maxWorkers = Number(process.env.RABBY_MOBILE_METRO_MAX_WORKERS || '');

async function main() {
  const config = await loadConfigAsync({ selectedPlatform: platform });
  await bundleCommand.func([], config, {
    assetsDest: selected.assetsDest,
    bundleOutput: selected.bundleOutput,
    dev: false,
    entryFile: 'worker-src/worker.thread.ts',
    maxWorkers:
      Number.isFinite(maxWorkers) && maxWorkers > 0 ? maxWorkers : undefined,
    platform,
    resolverOption: [],
    resetCache: false,
    sourcemapUseAbsolutePath: false,
  });
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
