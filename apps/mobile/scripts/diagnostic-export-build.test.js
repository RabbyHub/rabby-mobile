const { createRequire } = require('module');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const { runInNewContext } = require('vm');
const configPath = resolve(__dirname, '../babel.config.js');

describe('diagnostic export build-time switch', () => {
  function configure({
    dev = false,
    channel = 'appstore',
    buildEnv = 'production',
    input,
  } = {}) {
    // Evaluate the real config without applying its own transform-define plugin
    // or allowing Jest's transformed environment to replace the matrix inputs.
    const context = {
      module: { exports: {} },
      require: createRequire(configPath),
      process: {
        env: {
          buildchannel: channel,
          RABBY_MOBILE_BUILD_ENV: buildEnv,
          RABBY_MOBILE_ENABLE_LOCAL_STORAGE_EXPORT: input,
        },
      },
    };
    runInNewContext(readFileSync(configPath, 'utf8'), context);
    let cacheKey;
    const config = context.module.exports({
      caller: callback => callback({ name: 'metro', dev }),
      cache: {
        using: callback => {
          cacheKey = callback();
        },
      },
    });
    const defines = config.plugins.find(
      plugin => Array.isArray(plugin) && plugin[0] === 'transform-define',
    )[1];
    return { defines, config, cacheKey };
  }

  it.each([
    [{ dev: true }, true],
    [{ channel: 'selfhost-reg' }, true],
    [{ buildEnv: 'regression' }, true],
    [{}, false],
    [{ channel: 'selfhost' }, false],
    [{ input: 'true' }, true],
    [{ dev: true, input: 'false' }, false],
    [{ channel: 'selfhost-reg', input: 'false' }, false],
  ])('resolves %j to export=%s', (options, expected) => {
    const { defines } = configure(options);
    expect(
      defines['process.env.RABBY_MOBILE_ENABLE_LOCAL_STORAGE_EXPORT'],
    ).toBe(String(expected));
    if (expected) {
      expect(defines['process.env.RABBY_MOBILE_STRIP_CONSOLE']).toBe('false');
    }
  });

  it('changes the Babel cache key and preserves console calls for production diagnostics', () => {
    const ordinary = configure({ input: 'false' });
    const diagnostic = configure({ input: 'true' });
    expect(ordinary.config.env.production.plugins).toContain(
      'transform-remove-console',
    );
    expect(diagnostic.config.env).toBeUndefined();
    expect(diagnostic.cacheKey).not.toBe(ordinary.cacheKey);
  });

  it('rejects malformed switches instead of enabling them implicitly', () => {
    expect(() => configure({ input: 'yes' })).toThrow('must be true or false');
  });
});

describe('diagnostic export Metro cache', () => {
  function metroCacheVersion(input) {
    const metroPath = resolve(__dirname, '../metro.config.js');
    const identity = config => config;
    // Keep all non-environment inputs fixed and avoid reading local .env files
    // or starting native bundling/serializer plugins in this config-unit test.
    const dependencies = new Map([
      ['crypto', require('crypto')],
      ['path', require('path')],
      ['fs', { readdirSync: () => [], existsSync: () => false }],
      [
        '@react-native/metro-config',
        {
          getDefaultConfig: () => ({
            cacheVersion: 'fixture',
            resolver: { assetExts: [], sourceExts: [] },
          }),
          mergeConfig: (defaults, config) => ({ ...defaults, ...config }),
        },
      ],
      ['@sentry/react-native/metro', { withSentryConfig: identity }],
      ['@rozenite/metro', { withRozenite: identity }],
      [
        'react-native-reanimated/metro-config',
        { wrapWithReanimatedMetroConfig: identity },
      ],
      ['warden.rn', { createWardenSerializer: () => () => {} }],
      [
        './scripts/i18n-live-preview/metro-serializer',
        { createI18nLivePreviewSerializer: () => () => {} },
      ],
      [
        './scripts/react-native-architecture.cjs',
        {
          resolveReactNativeArchitecture: () => 'legacy',
          isLegacyReactNativeArchitecture: () => true,
        },
      ],
      ['node-libs-react-native', {}],
    ]);
    const mockRequire = name => {
      if (!dependencies.has(name)) {
        throw new Error(`Unexpected Metro dependency: ${name}`);
      }
      return dependencies.get(name);
    };
    mockRequire.resolve = name => `/fixture/${name}`;
    const context = {
      __dirname: resolve(__dirname, '..'),
      module: { exports: {} },
      require: mockRequire,
      process: {
        env: {
          NODE_ENV: 'production',
          buildchannel: 'appstore',
          RABBY_MOBILE_BUILD_ENV: 'production',
          RABBY_MOBILE_ENABLE_LOCAL_STORAGE_EXPORT: input,
        },
      },
    };
    runInNewContext(readFileSync(metroPath, 'utf8'), context);
    return context.module.exports.cacheVersion;
  }

  it('isolates outer transform caches when production diagnostics are toggled', () => {
    const disabled = metroCacheVersion('false');
    const enabled = metroCacheVersion('true');
    expect(enabled).not.toBe(disabled);
    expect(metroCacheVersion('false')).toBe(disabled);
    expect(metroCacheVersion()).not.toBe(enabled);
  });
});
