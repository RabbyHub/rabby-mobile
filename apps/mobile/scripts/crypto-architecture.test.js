const path = require('path');
const { Buffer } = require('buffer');
const { spawnSync } = require('child_process');
const { resolveCryptoModule } = require('./crypto-architecture.cjs');

const projectRoot = path.resolve(__dirname, '..');

// These are Node configuration/dependency contracts, not native-device tests.
// Separate processes keep the actual Metro and CLI architecture caches isolated.
const runNode = (source, architecture = 'legacy') => {
  const enabled = architecture === 'new' ? '1' : '0';
  const result = spawnSync(process.execPath, ['-e', source], {
    cwd: projectRoot,
    env: {
      ...process.env,
      RCT_NEW_ARCH_ENABLED: enabled,
      ORG_GRADLE_PROJECT_newArchEnabled: enabled,
      WITH_ROZENITE: 'false',
      APP_ENV: 'production',
    },
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr || result.stdout);
  }
  const marker = 'CRYPTO_CONTRACT_RESULT=';
  const line = result.stdout
    .split('\n')
    .find(value => value.startsWith(marker));
  if (!line) {
    throw new Error(`Missing contract result: ${result.stdout}`);
  }
  return JSON.parse(line.slice(marker.length));
};

describe.each(['legacy', 'new'])('%s crypto architecture', architecture => {
  let snapshot;

  beforeAll(() => {
    snapshot = runNode(
      `
      (async () => {
        const metro = await require('./metro.config.js');
        const native = await require('@react-native-community/cli-config')
          .loadConfigAsync({ projectRoot: process.cwd() });
        const names = [
          'react-native-quick-crypto', 'react-native-quick-crypto-legacy',
          'react-native-quick-base64', 'react-native-quick-base64-legacy',
        ];
        const selected = {};
        for (const name of ['crypto', 'react-native-quick-crypto']) {
          selected[name] = metro.resolver.resolveRequest({}, name, 'ios');
        }
        if (process.env.RCT_NEW_ARCH_ENABLED === '0') {
          selected['react-native-quick-base64'] = metro.resolver.resolveRequest(
            {}, 'react-native-quick-base64', 'android',
          );
        }
        const dependencies = Object.fromEntries(names.map(name => [
          name, native.dependencies[name],
        ]));
        process.stdout.write('CRYPTO_CONTRACT_RESULT=' + JSON.stringify({
          selected, dependencies,
        }) + '\\n');
      })().catch(error => { console.error(error); process.exitCode = 1; });
      `,
      architecture,
    );
  }, 35000);

  it('uses the same installed QuickCrypto for Node crypto and direct imports', () => {
    const packageName =
      architecture === 'legacy'
        ? 'react-native-quick-crypto-legacy'
        : 'react-native-quick-crypto';
    const expected = require.resolve(`${packageName}/lib/module/index.js`);

    expect(snapshot.selected.crypto).toEqual({
      filePath: expected,
      type: 'sourceFile',
    });
    expect(snapshot.selected['react-native-quick-crypto']).toEqual(
      snapshot.selected.crypto,
    );
    expect(
      resolveCryptoModule('react-native-quick-crypto/lib/module/subtle.js', {
        architecture,
        projectRoot,
      }),
    ).toBe(require.resolve(`${packageName}/lib/module/subtle.js`));
  });

  it('autolinks only the native implementation matching the JS entry', () => {
    const enabledName =
      architecture === 'legacy'
        ? 'react-native-quick-crypto-legacy'
        : 'react-native-quick-crypto';
    const disabledName =
      architecture === 'legacy'
        ? 'react-native-quick-crypto'
        : 'react-native-quick-crypto-legacy';
    const enabled = snapshot.dependencies[enabledName];

    expect(snapshot.dependencies[disabledName].platforms).toEqual({
      android: null,
      ios: null,
    });
    expect(enabled.platforms.ios.podspecPath).toBe(
      path.join(
        enabled.root,
        architecture === 'legacy'
          ? 'react-native-quick-crypto.podspec'
          : 'QuickCrypto.podspec',
      ),
    );
    expect(enabled.platforms.android.sourceDir).toBe(
      path.join(enabled.root, 'android'),
    );
    expect(
      snapshot.selected.crypto.filePath.startsWith(`${enabled.root}/`),
    ).toBe(true);
  });

  it('keeps Base64 native registration consistent with the architecture', () => {
    const disabled = { android: null, ios: null };
    expect(
      snapshot.dependencies['react-native-quick-base64-legacy'].platforms,
    ).toEqual(disabled);

    if (architecture === 'legacy') {
      expect(
        snapshot.dependencies['react-native-quick-base64'].platforms,
      ).toEqual(disabled);
      const entry = resolveCryptoModule('react-native-quick-base64', {
        architecture,
        projectRoot,
      });
      expect(snapshot.selected['react-native-quick-base64']).toEqual({
        filePath: entry,
        type: 'sourceFile',
      });
      expect(
        entry.startsWith(
          `${snapshot.dependencies['react-native-quick-base64-legacy'].root}/`,
        ),
      ).toBe(true);
      expect(
        resolveCryptoModule('react-native-quick-base64/src/index.ts', {
          architecture,
          projectRoot,
        }),
      ).toBe(require.resolve('react-native-quick-base64-legacy/src/index.ts'));
    } else {
      const base64 = snapshot.dependencies['react-native-quick-base64'];
      expect(base64.platforms.ios.podspecPath).toBeTruthy();
      expect(base64.platforms.android.isPureCxxDependency).toBe(true);
      expect(
        resolveCryptoModule('react-native-quick-base64', {
          architecture,
          projectRoot,
        }),
      ).toBeUndefined();
    }
  });
});

it('keeps real legacy Base64 encoding and decoding available without a native module', () => {
  const result = runNode(`
    const fs = require('fs');
    const vm = require('vm');
    const { createRequire } = require('module');
    const { transformSync } = require('@babel/core');
    const { resolveCryptoModule } = require('./scripts/crypto-architecture.cjs');
    const filename = resolveCryptoModule('react-native-quick-base64', {
      architecture: 'legacy', projectRoot: process.cwd(),
    });
    const compiled = transformSync(fs.readFileSync(filename, 'utf8'), {
      filename,
      configFile: false,
      babelrc: false,
      presets: [require.resolve('@react-native/babel-preset')],
    });
    const localRequire = createRequire(filename);
    const module = { exports: {} };
    vm.runInNewContext(compiled.code, {
      module,
      exports: module.exports,
      // Only the native boundary is replaced; the package and base64-js are real.
      require: name => name === 'react-native'
        ? { NativeModules: {} }
        : localRequire(name),
    }, { filename });
    const base64 = module.exports;
    const bytes = Uint8Array.from({ length: 256 }, (_, index) => index);
    const encoded = base64.fromByteArray(bytes);
    const subset = bytes.subarray(7, 19);
    const variants = ['', 'f', 'fo', 'foo', 'foobar'].map(value => ({
      value, encoded: base64.btoa(value), decoded: base64.atob(base64.btoa(value)),
    }));
    process.stdout.write('CRYPTO_CONTRACT_RESULT=' + JSON.stringify({
      encoded,
      decoded: Array.from(base64.toByteArray(encoded)),
      subset: base64.fromByteArray(subset),
      variants,
    }) + '\\n');
  `);

  const bytes = Buffer.from(Array.from({ length: 256 }, (_, index) => index));
  expect(result.encoded).toBe(bytes.toString('base64'));
  expect(result.decoded).toEqual(Array.from(bytes));
  expect(result.subset).toBe(bytes.subarray(7, 19).toString('base64'));
  for (const variant of result.variants) {
    expect(variant.encoded).toBe(Buffer.from(variant.value).toString('base64'));
    expect(variant.decoded).toBe(variant.value);
  }
});
