'use strict';

// Host shell contracts with the real RN asset writer; no Xcode or device run.
// Run with: node --test apps/mobile/scripts/ios-prebundle-assets.test.cjs
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const mobile = path.resolve(__dirname, '..');
const phase = path.join(mobile, 'ios/patches/phase-bundle-rn.sh');
const { default: saveAssets } = require(path.join(
  mobile,
  'node_modules/@react-native/community-cli-plugin/dist/commands/bundle/saveAssets.js',
));
const assetDirectory = 'assets/src/assets/icons/ios_ic_rabby_icons';
const assetName = 'ic_rabby_menu_favorite';
const assetSource = path.join(
  mobile,
  'src/assets/icons/ios_ic_rabby_icons',
  `${assetName}.png`,
);

function fixture(t) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'rabby-prebundle-assets-'),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'mobile');
  const prebundle = path.join(root, 'prebundle');
  const build = path.join(root, 'build');
  const app = path.join(build, 'RabbyMobile.app');
  const phasePath = path.join(project, 'ios/patches/phase-bundle-rn.sh');
  const write = (file, contents) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  };

  write(phasePath, fs.readFileSync(phase));
  // Environment/bootstrap setup is outside the asset-copy contract.
  write(
    path.join(project, 'scripts/fns.sh'),
    'load_env_var_from_candidate_files() { :; }\nvalidate_rabbit_code() { return 0; }\n',
  );
  write(
    path.join(project, 'scripts/resolve-build-info.js'),
    'process.stdout.write("{}\\n");\n',
  );
  write(path.join(project, '.env.regression'), 'RABBY_MOBILE_KR_PWD=fixture\n');
  write(path.join(prebundle, 'main.jsbundle'), 'fixture JS bundle\n');
  write(path.join(prebundle, '.status'), '0');
  write(path.join(prebundle, '.done'), '');
  write(path.join(app, 'native-resource.txt'), 'keep native resources\n');

  return {
    app,
    prebundle,
    write,
    run() {
      const result = spawnSync('/bin/bash', [phasePath], {
        cwd: path.join(project, 'ios'),
        env: {
          PATH: process.env.PATH,
          CONFIGURATION: 'Regression',
          APP_ENV: 'regression',
          RABBY_MOBILE_BUILD_ENV: 'regression',
          RABBY_MOBILE_CODE: 'fixture-code',
          RABBY_MOBILE_KR_PWD: 'fixture',
          TARGET_BUILD_DIR: build,
          CONFIGURATION_BUILD_DIR: build,
          UNLOCALIZED_RESOURCES_FOLDER_PATH: 'RabbyMobile.app',
          REACT_NATIVE_PATH: path.join(project, 'node_modules/react-native'),
          RABBY_MOBILE_METRO_CACHE_DIR: path.join(root, 'metro-cache'),
          RABBY_MOBILE_PREBUILT_BUNDLE_DIR: prebundle,
        },
        encoding: 'utf8',
        timeout: 10_000,
      });
      assert.ifError(result.error);
      return result;
    },
  };
}

async function writeMenuAsset(destination) {
  await saveAssets(
    [
      {
        name: assetName,
        type: 'png',
        files: [assetSource],
        scales: [1],
        httpServerLocation: `/${assetDirectory}`,
      },
    ],
    'ios',
    destination,
  );
}

test('prebuilt assets keep the same app-relative paths as a normal RN bundle', async t => {
  const f = fixture(t);
  await writeMenuAsset(f.prebundle);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    fs.readFileSync(path.join(f.app, 'main.jsbundle'), 'utf8'),
    'fixture JS bundle\n',
  );
  assert.deepEqual(
    fs.readFileSync(path.join(f.app, assetDirectory, `${assetName}.png`)),
    fs.readFileSync(assetSource),
  );
  assert.equal(fs.existsSync(path.join(f.app, 'src/assets')), false);
  assert.equal(
    fs.readFileSync(path.join(f.app, 'native-resource.txt'), 'utf8'),
    'keep native resources\n',
  );
});

test('an asset-copy failure fails the build instead of reporting success', async t => {
  const f = fixture(t);
  await writeMenuAsset(f.prebundle);
  f.write(path.join(f.app, 'assets'), 'blocks the required asset directory');
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout.includes('used the prebuilt JS bundle'), false);
});
