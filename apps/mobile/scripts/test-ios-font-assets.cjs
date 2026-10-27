const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

// Run with `node --test scripts/test-ios-font-assets.cjs` from apps/mobile.
// Configuration unit tests plus isolated asset-linker/shell integration tests.
// These protect packaging boundaries, not UIKit or WebView glyph rendering.
const mobileRoot = path.resolve(__dirname, '..');
const config = require('../react-native.config.js');
const fontNames = ['Regular', 'Medium', 'Bold', 'Heavy'].map(
  weight => `SF-Pro-Rounded-${weight}.otf`,
);
const read = relative =>
  fs.readFileSync(path.join(mobileRoot, relative), 'utf8');

function createFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rabby-ios-font-assets-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeFixture(root, relative, contents) {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, contents);
}

function assertNoAppleFontReferences(contents) {
  for (const name of fontNames) {
    assert.ok(!contents.includes(name), `must not reference ${name}`);
  }
}

test('links Apple font assets only on Android, keeping shared custom assets', () => {
  const iosAssets = [...config.assets, ...config.iosAssets];
  const androidAssets = [...config.assets, ...config.androidAssets];
  const fontsRoot = path.join(mobileRoot, 'assets/fonts');
  const includesFonts = asset => {
    const assetPath = path.resolve(mobileRoot, asset);
    return (
      assetPath === fontsRoot || fontsRoot.startsWith(`${assetPath}${path.sep}`)
    );
  };
  assert.ok(!iosAssets.some(includesFonts));
  assert.ok(androidAssets.some(includesFonts));
  assert.ok(iosAssets.includes('./assets/custom'));
  assert.ok(androidAssets.includes('./assets/custom'));
  for (const name of fontNames) {
    assert.ok(fs.statSync(path.join(fontsRoot, name)).isFile());
  }
});

test('does not register or package Apple fonts through tracked iOS metadata', () => {
  for (const file of [
    'ios/RabbyMobile/Info.plist',
    'ios/RabbyMobile.xcodeproj/project.pbxproj',
    'ios/link-assets-manifest.json',
  ]) {
    assertNoAppleFontReferences(read(file));
  }
  const manifest = JSON.parse(read('ios/link-assets-manifest.json'));
  assert.ok(
    manifest.data.every(asset => !asset.path.startsWith('assets/fonts/')),
  );
});

test('runs the bundle audit after Metro and both resource-copy phases', () => {
  const pbxproj = read('ios/RabbyMobile.xcodeproj/project.pbxproj');
  const target = pbxproj.match(
    /[A-F0-9]{24} \/\* RabbyMobile \*\/ = \{\s*isa = PBXNativeTarget;[\s\S]*?buildPhases = \(([\s\S]*?)\);/,
  );
  assert.ok(target, 'RabbyMobile application target must exist');
  const phases = [...target[1].matchAll(/([A-F0-9]{24}) \/\* (.*?) \*\//g)];
  const auditIndex = phases.findIndex(
    phase => phase[2] === 'Check bundled system fonts',
  );
  assert.ok(auditIndex >= 0);
  for (const producer of [
    'Resources',
    'Bundle React Native code and images',
    '[CP] Copy Pods Resources',
    '[CP] Embed Pods Frameworks',
  ]) {
    const index = phases.findIndex(phase => phase[2] === producer);
    assert.ok(
      index >= 0 && index < auditIndex,
      `${producer} must precede audit`,
    );
  }
  const auditId = phases[auditIndex][1];
  const audit = pbxproj.match(
    new RegExp(
      `${auditId} /\\* Check bundled system fonts \\*/ = \\{([\\s\\S]*?)\\n\\t\\t\\};`,
    ),
  );
  assert.ok(audit);
  assert.match(audit[1], /alwaysOutOfDate = 1;/);
  assert.match(audit[1], /phase-check-system-fonts\.sh/);
  assert.match(audit[1], /runOnlyForDeploymentPostprocessing = 0;/);
});

test('reset_builtin_assets removes only the four legacy iOS copies', t => {
  const root = createFixture(t);
  const resources = 'ios/RabbyMobile/Resources';
  for (const name of fontNames) {
    writeFixture(root, `assets/fonts/${name}`, `Android fixture ${name}`);
    writeFixture(root, `${resources}/${name}`, 'legacy iOS copy');
  }
  const retained = [
    'custom.ttf',
    'SF-Pro-Rounded-Regular.otf.backup',
    'nested/keep.txt',
  ];
  for (const name of retained) {
    writeFixture(root, `${resources}/${name}`, `keep ${name}`);
  }
  writeFixture(root, 'assets/custom/fixture.js', '/* fixture */');
  fs.mkdirSync(path.join(root, 'scripts'));
  const shellFunction = read('scripts/fns.sh').match(
    /^reset_builtin_assets\(\) \{[\s\S]*?^\}/m,
  )?.[0];
  assert.ok(shellFunction);
  execFileSync('/bin/bash', ['-c', `${shellFunction}\nreset_builtin_assets`], {
    cwd: root,
    env: { ...process.env, RABBY_FNS_SCRIPT_DIR: path.join(root, 'scripts') },
    timeout: 10000,
    stdio: 'pipe',
  });
  for (const name of fontNames) {
    assert.ok(!fs.existsSync(path.join(root, resources, name)));
    assert.equal(
      fs.readFileSync(
        path.join(root, 'android/app/src/main/assets/fonts', name),
        'utf8',
      ),
      `Android fixture ${name}`,
    );
  }
  for (const name of retained) {
    assert.equal(
      fs.readFileSync(path.join(root, resources, name), 'utf8'),
      `keep ${name}`,
    );
  }
});

test('the real asset linker does not reintroduce iOS fonts on repeated runs', t => {
  const cli = require.resolve('react-native-asset/lib/cli.js', {
    paths: [mobileRoot],
  });
  const root = createFixture(t);
  for (const file of [
    'react-native.config.js',
    'scripts/react-native-architecture.cjs',
    'scripts/crypto-architecture.cjs',
    'ios/RabbyMobile.xcodeproj/project.pbxproj',
    'ios/RabbyMobile/Info.plist',
    'ios/link-assets-manifest.json',
  ]) {
    writeFixture(root, file, fs.readFileSync(path.join(mobileRoot, file)));
  }
  for (const directory of ['assets/custom', 'assets/fonts']) {
    fs.cpSync(path.join(mobileRoot, directory), path.join(root, directory), {
      recursive: true,
    });
  }
  fs.mkdirSync(path.join(root, 'android'));
  for (let iteration = 0; iteration < 2; iteration += 1) {
    execFileSync(process.execPath, [cli, '--path', root], {
      cwd: root,
      timeout: 30000,
      stdio: 'pipe',
    });
    for (const file of [
      'ios/RabbyMobile.xcodeproj/project.pbxproj',
      'ios/RabbyMobile/Info.plist',
      'ios/link-assets-manifest.json',
    ]) {
      assertNoAppleFontReferences(
        fs.readFileSync(path.join(root, file), 'utf8'),
      );
    }
    const iosManifest = JSON.parse(
      fs.readFileSync(path.join(root, 'ios/link-assets-manifest.json'), 'utf8'),
    );
    assert.ok(
      iosManifest.data.every(asset => !asset.path.startsWith('assets/fonts/')),
    );
    for (const name of fontNames) {
      assert.deepEqual(
        fs.readFileSync(
          path.join(root, 'android/app/src/main/assets/fonts', name),
        ),
        fs.readFileSync(path.join(mobileRoot, 'assets/fonts', name)),
      );
    }
  }
});
