// Shell-contract tests only: native compilation, CocoaPods and Metro are mocked.
// Run with: node --test apps/mobile/scripts/ci/build-ios-simulator.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const script = path.join(__dirname, 'build-ios-simulator.sh');
const architectureScript = path.join(
  __dirname,
  '../react-native-architecture.cjs',
);

function fixture(t, overrides = {}) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'rabby-simulator-contract-'),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repo = path.join(root, 'repo');
  const mobile = path.join(repo, 'apps/mobile');
  const bin = path.join(root, 'bin');
  const output = path.join(root, 'output');
  const trace = path.join(root, 'trace');
  const write = (file, body, executable = false) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body, { mode: executable ? 0o755 : 0o644 });
  };
  write(
    path.join(mobile, 'scripts/ci/build-ios-simulator.sh'),
    fs.readFileSync(script),
  );
  write(
    path.join(mobile, 'scripts/react-native-architecture.cjs'),
    fs.readFileSync(architectureScript),
  );
  write(
    path.join(mobile, 'package.json'),
    JSON.stringify({ version: '0.6.94' }),
  );
  write(
    path.join(mobile, 'scripts/libs/node-runtime.sh'),
    'ensure_mobile_node_runtime() { :; }\n',
  );
  write(
    path.join(mobile, 'scripts/fns.sh'),
    `
ensure_inpage_bridge_assets() { echo inpage >> "$TEST_TRACE"; }
if [ "\${1:-}" = reset_builtin_assets ]; then echo assets >> "$TEST_TRACE"; fi
`,
  );
  write(
    path.join(mobile, 'scripts/turbo-build/_fns.sh'),
    `
turbo_prepare_js_dependencies() {
  echo js >> "$TEST_TRACE"
  export RABBY_MOBILE_TURBO_LOCAL_CACHE_ROOT="$TEST_CACHE"
}
turbo_compute_ios_build_artifacts_key() { echo assets-key; }
turbo_ios_build_artifacts_ready() { return 1; }
turbo_mark_ios_build_artifacts_ready() { echo mark-assets >> "$TEST_TRACE"; }
turbo_prepare_ruby_bundle() { echo ruby >> "$TEST_TRACE"; }
turbo_prepare_cocoapods() {
  echo "pods:$RCT_NEW_ARCH_ENABLED" >> "$TEST_TRACE"
  return "\${TEST_POD_STATUS:-0}"
}
turbo_compute_ios_derived_data_key() { echo device-base-key; }
turbo_sha256() { shasum -a 256; }
turbo_log() { echo "$*"; }
`,
  );
  write(
    path.join(mobile, 'ios/patches/override-xcconfig-release.sh'),
    'echo xcconfig >> "$TEST_TRACE"\n',
  );
  write(
    path.join(bin, 'uname'),
    '#!/bin/bash\ncase "$1" in -s) echo Darwin;; -m) echo arm64;; esac\n',
    true,
  );
  write(
    path.join(bin, 'yarn'),
    '#!/bin/bash\nprintf "yarn:%s\\n" "$*" >> "$TEST_TRACE"\n',
    true,
  );
  write(
    path.join(bin, 'xcrun'),
    `#!/bin/bash
case "$1" in
  --sdk) if [ "$3" = --show-sdk-version ]; then echo 27.1; else echo 24B1; fi ;;
  lipo) echo arm64 ;;
  vtool) echo "  platform \${TEST_MACHO_PLATFORM:-IOSSIMULATOR}" ;;
  *) exit 99 ;;
esac
`,
    true,
  );
  write(
    path.join(bin, 'xcodebuild'),
    `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
if (args[0] === '-version') { process.stdout.write('Xcode 27.1\\nBuild version 18B1\\n'); process.exit(0); }
fs.appendFileSync(process.env.TEST_TRACE, JSON.stringify({args, env: {
  REALLY_UPLOAD: process.env.REALLY_UPLOAD,
  SENTRY_DISABLE_AUTO_UPLOAD: process.env.SENTRY_DISABLE_AUTO_UPLOAD,
  RCT_NEW_ARCH_ENABLED: process.env.RCT_NEW_ARCH_ENABLED,
  SKIP_BUNDLING: process.env.SKIP_BUNDLING,
  APP_ENV: process.env.APP_ENV,
  DEVELOPER_DIR: process.env.DEVELOPER_DIR,
}}) + '\\n');
if (process.env.TEST_BUILD_STATUS) process.exit(Number(process.env.TEST_BUILD_STATUS));
const dd = args[args.indexOf('-derivedDataPath') + 1];
const app = path.join(dd, 'Build/Products/Regression-iphonesimulator/RabbyMobile.app');
fs.mkdirSync(app, {recursive:true});
fs.writeFileSync(path.join(app, 'RabbyMobile'), 'native-test-binary');
fs.writeFileSync(path.join(app, 'main.jsbundle'), process.env.TEST_PLAIN_JS ? Buffer.from('plain JS') : Buffer.from('c61fbc03c103191f0001', 'hex'));
fs.writeFileSync(path.join(app, 'Info.plist'), '<?xml version="1.0"?><plist version="1.0"><dict>' + Object.entries({CFBundleExecutable:'RabbyMobile', CFBundleIdentifier:'com.debank.rabby-mobile-regression', CFBundleVersion:'1', CFBundleShortVersionString:'0.6.94', DTPlatformName:'iphonesimulator', MinimumOSVersion:'15.1'}).map(([key,value]) => '<key>'+key+'</key><string>'+value+'</string>').join('') + '</dict></plist>');
`,
    true,
  );
  execFileSync('git', ['init', '-q', repo]);
  execFileSync('git', ['-C', repo, 'add', '.']);
  execFileSync('git', [
    '-C',
    repo,
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-qm',
    'fixture',
  ]);
  const env = {
    PATH: `${bin}:${path.dirname(
      process.execPath,
    )}:/usr/bin:/bin:/usr/sbin:/sbin`,
    HOME: os.homedir(),
    TEST_TRACE: trace,
    TEST_CACHE: path.join(root, 'cache'),
    DEVELOPER_DIR: execFileSync('xcode-select', ['-p'], {
      encoding: 'utf8',
    }).trim(),
    REALLY_UPLOAD: 'true',
    SENTRY_DISABLE_AUTO_UPLOAD: 'false',
    SKIP_BUNDLING: '1',
    ...overrides,
  };
  const run = () =>
    spawnSync(
      '/bin/bash',
      [
        '-u',
        path.join(mobile, 'scripts/ci/build-ios-simulator.sh'),
        '--output-dir',
        output,
      ],
      { env, encoding: 'utf8' },
    );
  return {
    root,
    repo,
    mobile,
    output,
    trace,
    run,
    developerDir: env.DEVELOPER_DIR,
  };
}

test('accepts --help without touching a checkout or preparing dependencies', () => {
  const result = spawnSync('/bin/bash', [script, '--help'], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /--output-dir/);
});

// plutil, PlistBuddy and ditto are real native artifact utilities; these fixtures
// never compile or install an app and do not claim Simulator startup coverage.
const macTest = process.platform === 'darwin' ? test : test.skip;
macTest(
  'builds a distinct simulator variant, disables side effects and writes provenance last',
  t => {
    const f = fixture(t);
    const result = f.run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const trace = fs.readFileSync(f.trace, 'utf8');
    assert.match(trace, /js\ninpage\nyarn:check-nodeengines/);
    assert.match(trace, /pods:1/);
    assert.doesNotMatch(trace, /syncrnversion|fastlane|match|appstore/);
    const native = JSON.parse(trace.trim().split('\n').at(-1));
    assert(native.args.includes('generic/platform=iOS Simulator'));
    assert(native.args.includes('CODE_SIGNING_ALLOWED=NO'));
    assert(native.args.includes('EXCLUDED_ARCHS[sdk=iphonesimulator*]='));
    assert(native.args.includes('FORCE_BUNDLING=1'));
    assert.equal(native.env.REALLY_UPLOAD, 'false');
    assert.equal(native.env.SENTRY_DISABLE_AUTO_UPLOAD, 'true');
    assert.equal(native.env.SKIP_BUNDLING, undefined);
    assert.equal(native.env.APP_ENV, 'regression');
    assert.equal(native.env.DEVELOPER_DIR, f.developerDir);
    const metadata = JSON.parse(
      fs.readFileSync(path.join(f.output, 'metadata.json')),
    );
    assert.equal(metadata.reactNativeArchitecture, 'new');
    assert.equal(
      metadata.sourceCommit,
      execFileSync('git', ['-C', f.repo, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim(),
    );
    assert.match(metadata.archive.sha256, /^[a-f0-9]{64}$/);
    assert.equal(metadata.platform, 'iphonesimulator');
    assert.equal(metadata.appVersion, '0.6.94');
    assert.equal(metadata.buildVersion, '1');
    assert.equal(
      fs.existsSync(
        path.join(f.mobile, '.turbo-build/ios-simulator-build.lock'),
      ),
      false,
    );
    assert.notEqual(f.run().status, 0, 'never reuse an output directory');
  },
);

macTest('inherits legacy architecture without forcing newArch', t => {
  const f = fixture(t, { RCT_NEW_ARCH_ENABLED: '0' });
  const result = f.run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(fs.readFileSync(f.trace, 'utf8'), /pods:0/);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(f.output, 'metadata.json')))
      .reactNativeArchitecture,
    'legacy',
  );
});

for (const [name, env, status, message] of [
  ['Pod preparation failure', { TEST_POD_STATUS: '42' }, 42],
  ['native build failure', { TEST_BUILD_STATUS: '65' }, 65],
  [
    'device platform binary',
    { TEST_MACHO_PLATFORM: 'IOS' },
    1,
    /not built for iOS Simulator/,
  ],
  [
    'plain Metro JS instead of Hermes',
    { TEST_PLAIN_JS: '1' },
    1,
    /not Hermes bytecode/,
  ],
]) {
  macTest(`does not publish success metadata after ${name}`, t => {
    const f = fixture(t, env);
    const result = f.run();
    assert.equal(result.status, status, result.stdout + result.stderr);
    if (message) assert.match(result.stdout + result.stderr, message);
    assert.equal(fs.existsSync(path.join(f.output, 'metadata.json')), false);
    assert.equal(
      fs.existsSync(
        path.join(f.mobile, '.turbo-build/ios-simulator-build.lock'),
      ),
      false,
    );
  });
}

macTest('rejects dirty committed source before dependency preparation', t => {
  const f = fixture(t);
  fs.appendFileSync(path.join(f.mobile, 'package.json'), '\n');
  assert.notEqual(f.run().status, 0);
  assert.equal(fs.existsSync(f.trace), false);
});
