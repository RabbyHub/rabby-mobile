'use strict';

// Host build-script contracts: execute the real preparation script and
// architecture resolver against a disposable filesystem. Only the external
// Yarn process is replaced; these tests do not prove native codegen/compilation.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const sourceScript = path.join(__dirname, 'prepare-mobile-build.sh');
const sourceResolver = path.resolve(
  __dirname,
  '../react-native-architecture.cjs',
);
const packageRelativePath =
  'apps/mobile/node_modules/@react-native-google-signin/google-signin';
const requiredFiles = {
  legacy: [
    'android/src/oldArch/java/com.reactnativegooglesignin/NativeGoogleSigninSpec.java',
    'android/src/oldArch/java/com.reactnativegooglesignin/RNGoogleSigninButtonManagerDelegate.java',
    'android/src/oldArch/java/com.reactnativegooglesignin/RNGoogleSigninButtonManagerInterface.java',
    'android/src/oldArch/java/com.reactnativegooglesignin/RNGoogleSigninButtonManagerInterfaceCopy.java',
  ],
  new: [
    'android/src/newArch/java/com/reactnativegooglesignin/RNGoogleSigninButtonManagerDelegate.java',
    'android/src/newArch/java/com/reactnativegooglesignin/RNGoogleSigninButtonManagerInterface.java',
    'src/spec/NativeGoogleSignin.ts',
    'src/spec/SignInButtonNativeComponent.ts',
  ],
};
const allRequiredFiles = Object.values(requiredFiles).flat();
const stateRelativePath = '.yarn/install-state.gz';
const stalePackageMarker = 'android/build/stale-package-marker';
const protectedFiles = [
  'node_modules/unrelated-dependency/preserve.txt',
  '.yarn/cache/preserve.zip',
  'apps/mobile/android/.gradle/preserve.bin',
  'apps/mobile/android/app/build/preserve.bin',
  'apps/mobile/.turbo-build/preserve.bin',
];

const fakeYarn = `#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const root = process.env.TEST_REPO;
const packageDir = path.join(root, ${JSON.stringify(packageRelativePath)});
const stateFile = path.join(root, ${JSON.stringify(stateRelativePath)});
fs.appendFileSync(process.env.TEST_EVENTS, JSON.stringify({
  args,
  packageExists: fs.existsSync(packageDir),
  installStateExists: fs.existsSync(stateFile),
  packageMarkerExists: fs.existsSync(path.join(packageDir, ${JSON.stringify(
    stalePackageMarker,
  )})),
}) + '\\n');
if (args.length === 1 && args[0] === '--version') {
  console.log('4.12.0');
} else if (args.length === 2 && args[0] === 'install' && args[1] === '--immutable') {
  const status = Number(process.env.TEST_INSTALL_STATUS);
  if (status !== 0) process.exit(status);
  const omitted = JSON.parse(process.env.TEST_INSTALL_OMITTED);
  for (const relative of ${JSON.stringify(allRequiredFiles)}) {
    const filename = path.join(packageDir, relative);
    if (omitted.includes(relative)) continue;
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    if (!fs.existsSync(filename)) fs.writeFileSync(filename, 'rehydrated source\\n');
  }
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  if (!fs.existsSync(stateFile)) fs.writeFileSync(stateFile, 'new install state\\n');
} else if (args.length === 1 && args[0] === 'postinstall') {
  process.exit(0);
} else {
  console.error('Unexpected Yarn command in preparation fixture');
  process.exit(98);
}
`;

function write(root, relative, content) {
  const filename = path.join(root, relative);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, content);
  return filename;
}

function fixture(t, options = {}) {
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), 'rabby-mobile-prepare-contract-'),
  );
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, 'repository with spaces');
  const script = write(
    root,
    'apps/mobile/scripts/ci/prepare-mobile-build.sh',
    fs.readFileSync(sourceScript),
  );
  write(
    root,
    'apps/mobile/scripts/react-native-architecture.cjs',
    fs.readFileSync(sourceResolver),
  );

  const bin = path.join(temporary, 'bin');
  const yarn = write(bin, 'yarn', fakeYarn);
  fs.chmodSync(yarn, 0o755);
  const eventsFile = path.join(temporary, 'events.jsonl');
  const packageDir = path.join(root, packageRelativePath);
  if (options.installed !== false) {
    for (const relative of allRequiredFiles) {
      if (!(options.missing || []).includes(relative)) {
        write(packageDir, relative, 'original source\n');
      }
    }
    write(packageDir, stalePackageMarker, 'old package build\n');
    write(root, stateRelativePath, 'original install state\n');
  }
  for (const relative of protectedFiles) {
    write(root, relative, `preserve ${relative}\n`);
  }
  // This sibling must survive a targeted refresh when app node_modules exists.
  if (options.installed !== false) {
    write(
      root,
      'apps/mobile/node_modules/unrelated-dependency/preserve.txt',
      'keep\n',
    );
  }

  return {
    root,
    packageDir,
    script,
    eventsFile,
    env: {
      PATH: [bin, path.dirname(process.execPath), '/usr/bin', '/bin'].join(
        path.delimiter,
      ),
      NVM_DIR: path.join(temporary, 'no-nvm'),
      INPUT_NEW_VERSION_NAME: '',
      RABBY_MOBILE_RUN_POSTINSTALL: options.postinstall ? 'true' : 'false',
      RCT_NEW_ARCH_ENABLED: options.architecture === 'legacy' ? '0' : '1',
      TEST_REPO: root,
      TEST_EVENTS: eventsFile,
      TEST_INSTALL_STATUS: String(options.installStatus || 0),
      TEST_INSTALL_OMITTED: JSON.stringify(options.omittedAfterInstall || []),
    },
    installed: options.installed !== false,
  };
}

function run(f, environment = {}) {
  const result = spawnSync('/bin/bash', [f.script], {
    cwd: f.root,
    env: { ...f.env, ...environment },
    encoding: 'utf8',
    timeout: 15_000,
  });
  assert.ifError(result.error);
  const events = fs.existsSync(f.eventsFile)
    ? fs
        .readFileSync(f.eventsFile, 'utf8')
        .trimEnd()
        .split('\n')
        .map(JSON.parse)
    : [];
  for (const relative of protectedFiles) {
    assert.equal(
      fs.readFileSync(path.join(f.root, relative), 'utf8'),
      `preserve ${relative}\n`,
      `Unrelated cache/dependency was changed: ${relative}`,
    );
  }
  if (f.installed) {
    assert.equal(
      fs.readFileSync(
        path.join(
          f.root,
          'apps/mobile/node_modules/unrelated-dependency/preserve.txt',
        ),
        'utf8',
      ),
      'keep\n',
    );
  }
  return { ...result, events };
}

function installEvent(result) {
  assert.deepEqual(
    result.events.map(event => event.args),
    [['--version'], ['install', '--immutable']],
  );
  return result.events[1];
}

for (const [architecture, files] of Object.entries(requiredFiles)) {
  for (const missing of files) {
    test(`${architecture}: rehydrate only the package when ${missing} is missing`, t => {
      const f = fixture(t, { architecture, missing: [missing] });
      const result = run(f);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(installEvent(result), {
        args: ['install', '--immutable'],
        packageExists: false,
        installStateExists: false,
        packageMarkerExists: false,
      });
      for (const relative of files) {
        assert.equal(
          fs.readFileSync(path.join(f.packageDir, relative), 'utf8'),
          'rehydrated source\n',
        );
      }
      assert.equal(
        fs.existsSync(path.join(f.packageDir, stalePackageMarker)),
        false,
      );
    });
  }

  test(`${architecture}: complete package and install state are preserved`, t => {
    const f = fixture(t, { architecture });
    const result = run(f);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(installEvent(result), {
      args: ['install', '--immutable'],
      packageExists: true,
      installStateExists: true,
      packageMarkerExists: true,
    });
    for (const relative of files) {
      assert.equal(
        fs.readFileSync(path.join(f.packageDir, relative), 'utf8'),
        'original source\n',
      );
    }
    assert.equal(
      fs.readFileSync(path.join(f.root, stateRelativePath), 'utf8'),
      'original install state\n',
    );
  });

  test(`${architecture}: missing other-architecture sources do not invalidate a complete selected package`, t => {
    const other = architecture === 'legacy' ? 'new' : 'legacy';
    const f = fixture(t, { architecture, missing: requiredFiles[other] });
    const result = run(f);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(installEvent(result).packageMarkerExists, true);
    assert.equal(
      fs.readFileSync(path.join(f.root, stateRelativePath), 'utf8'),
      'original install state\n',
    );
  });

  test(`${architecture}: first installation works without app node_modules`, t => {
    const f = fixture(t, { architecture, installed: false });
    assert.equal(
      fs.existsSync(path.join(f.root, 'apps/mobile/node_modules')),
      false,
    );
    const result = run(f);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(installEvent(result).packageExists, false);
    for (const relative of files)
      assert.equal(fs.existsSync(path.join(f.packageDir, relative)), true);
  });

  test(`${architecture}: missing source after installation fails before postinstall`, t => {
    const missing = files[files.length - 1];
    const f = fixture(t, {
      architecture,
      missing: [missing],
      omittedAfterInstall: [missing],
      postinstall: true,
    });
    const result = run(f);
    assert.notEqual(result.status, 0);
    installEvent(result);
    assert.ok(result.stderr.includes(missing), result.stderr);
    assert.equal(fs.existsSync(path.join(f.packageDir, missing)), false);
  });

  test(`${architecture}: Yarn installation failure propagates without postinstall`, t => {
    const f = fixture(t, {
      architecture,
      missing: [files[0]],
      installStatus: 23,
      postinstall: true,
    });
    const result = run(f);
    assert.equal(result.status, 23, result.stderr);
    installEvent(result);
    assert.equal(fs.existsSync(f.packageDir), false);
  });
}

test('conflicting architecture inputs fail before deletion or installation', t => {
  const missing = requiredFiles.new[0];
  const f = fixture(t, { missing: [missing], postinstall: true });
  const result = run(f, { ORG_GRADLE_PROJECT_newArchEnabled: 'false' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /different architectures/);
  assert.deepEqual(
    result.events.map(event => event.args),
    [['--version']],
  );
  assert.equal(
    fs.existsSync(path.join(f.packageDir, stalePackageMarker)),
    true,
  );
  assert.equal(
    fs.readFileSync(path.join(f.root, stateRelativePath), 'utf8'),
    'original install state\n',
  );
  assert.equal(fs.existsSync(path.join(f.packageDir, missing)), false);
});
