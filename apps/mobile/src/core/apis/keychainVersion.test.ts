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
      'plain state',
      JSON.stringify({
        [VERSION_FIELD]: '9.0.0',
      }),
      '9.0.0',
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

  it('coerces the removed v8 selection to v9 and reads later changes', () => {
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

    expect(getCurrentKeychainVersion()).toBe('9.0.0');

    persistedValue = JSON.stringify({
      state: {
        [VERSION_FIELD]: '10.0.0',
      },
      version: 0,
    });

    expect(getCurrentKeychainVersion()).toBe('10.0.0');
  });
});

describe('core/apis/keychainVersionShared', () => {
  it.each([
    ['9', '9.0.0'],
    ['v9', '9.0.0'],
    ['9.0.0', '9.0.0'],
    ['10', '10.0.0'],
    ['V10', '10.0.0'],
    ['10.0.0', '10.0.0'],
  ] as const)('parses deeplink value %s', (value, expected) => {
    const { parseKeychainVersionDeepLinkValue } =
      require('./keychainVersionShared') as typeof import('./keychainVersionShared');

    expect(parseKeychainVersionDeepLinkValue(value)).toBe(expected);
  });

  it.each([null, '', '8', '8.2.0-fork', 'latest'])(
    'rejects unsupported deeplink value %#',
    value => {
      const { parseKeychainVersionDeepLinkValue } =
        require('./keychainVersionShared') as typeof import('./keychainVersionShared');

      expect(parseKeychainVersionDeepLinkValue(value)).toBeNull();
    },
  );
});
