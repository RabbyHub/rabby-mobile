type KeychainVersionModule = typeof import('./keychainVersion');

const VERSION_FIELD = 'debugCurrentKeychainVersion20260602';

function loadKeychainVersion(options: {
  isNonPublicProductionEnv: boolean;
  getString: jest.Mock<string | undefined, [string]>;
}) {
  jest.resetModules();
  jest.doMock('@/constant', () => ({
    isNonPublicProductionEnv: options.isNonPublicProductionEnv,
  }));
  jest.doMock('@/core/storage/mmkvInstances', () => ({
    appMMKV: {
      getString: options.getString,
    },
  }));

  let keychainVersion: KeychainVersionModule | null = null;
  jest.isolateModules(() => {
    keychainVersion = require('./keychainVersion') as KeychainVersionModule;
  });

  return keychainVersion as unknown as KeychainVersionModule;
}

describe('core/apis/keychainVersion', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('uses the production default without reading MMKV', () => {
    const getString = jest.fn<string | undefined, [string]>();
    const { getCurrentKeychainVersion } = loadKeychainVersion({
      isNonPublicProductionEnv: false,
      getString,
    });

    expect(getCurrentKeychainVersion()).toBe('9.0.0');
    expect(getString).not.toHaveBeenCalled();
  });

  it.each([
    [
      'current Zustand state',
      JSON.stringify({
        state: {
          [VERSION_FIELD]: '10.0.0',
        },
        version: 0,
      }),
      '10.0.0',
    ],
    [
      'legacy plain state',
      JSON.stringify({
        [VERSION_FIELD]: '8.2.0-fork',
      }),
      '8.2.0-fork',
    ],
    [
      'duplicated JSON encoding',
      JSON.stringify(
        JSON.stringify({
          state: {
            [VERSION_FIELD]: '10.0.0',
          },
          version: 0,
        }),
      ),
      '10.0.0',
    ],
  ] as const)('reads %s', (_label, persistedValue, expectedVersion) => {
    const getString = jest.fn(() => persistedValue);
    const { getCurrentKeychainVersion } = loadKeychainVersion({
      isNonPublicProductionEnv: true,
      getString,
    });

    expect(getCurrentKeychainVersion()).toBe(expectedVersion);
    expect(getString).toHaveBeenCalledWith('@ExperimentalSettings');
  });

  it.each([
    undefined,
    'not-json',
    JSON.stringify({
      state: {
        [VERSION_FIELD]: 'unsupported',
      },
      version: 0,
    }),
  ])('falls back for invalid persisted data %#', persistedValue => {
    const getString = jest.fn(() => persistedValue);
    const { getCurrentKeychainVersion } = loadKeychainVersion({
      isNonPublicProductionEnv: true,
      getString,
    });

    expect(getCurrentKeychainVersion()).toBe('9.0.0');
  });

  it('reads the latest persisted version on every call', () => {
    let persistedValue = JSON.stringify({
      state: {
        [VERSION_FIELD]: '8.2.0-fork',
      },
      version: 0,
    });
    const getString = jest.fn(() => persistedValue);
    const { getCurrentKeychainVersion } = loadKeychainVersion({
      isNonPublicProductionEnv: true,
      getString,
    });

    expect(getCurrentKeychainVersion()).toBe('8.2.0-fork');

    persistedValue = JSON.stringify({
      state: {
        [VERSION_FIELD]: '10.0.0',
      },
      version: 0,
    });

    expect(getCurrentKeychainVersion()).toBe('10.0.0');
  });
});
