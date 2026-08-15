const mockIsCached = jest.fn();
const mockPreloadComponent = jest.fn();

jest.mock('@/constant', () => ({
  isNonPublicProductionEnv: false,
}));

jest.mock('@/constant/layout', () => ({
  RootNames: new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  ),
}));

jest.mock('react-native-bundle-splitter', () => ({
  isCached: (...args: unknown[]) => mockIsCached(...args),
  preload: () => ({
    component: (...args: unknown[]) => mockPreloadComponent(...args),
  }),
}));

jest.mock('@/perfs/loadables/singleAddressScreens', () => ({}));

describe('preloads', () => {
  const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    mockIsCached.mockReturnValue(false);
  });

  afterAll(() => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  it('shares one bundle preload while the same component is in flight', async () => {
    let resolvePreload: (() => void) | undefined;
    mockPreloadComponent.mockReturnValue(
      new Promise<void>(resolve => {
        resolvePreload = resolve;
      }),
    );
    const { preloadTransactionHotNavigator } = require('./preloads');

    const first = preloadTransactionHotNavigator();
    const second = preloadTransactionHotNavigator();

    expect(mockPreloadComponent).toHaveBeenCalledTimes(1);
    resolvePreload?.();
    await Promise.all([first, second]);
  });

  it('allows retry after a preload failure', async () => {
    mockPreloadComponent
      .mockRejectedValueOnce(new Error('preload failed'))
      .mockResolvedValueOnce(undefined);
    const { preloadTransactionHotNavigator } = require('./preloads');

    await expect(preloadTransactionHotNavigator()).rejects.toThrow(
      'preload failed',
    );
    await expect(preloadTransactionHotNavigator()).resolves.toBeUndefined();

    expect(mockPreloadComponent).toHaveBeenCalledTimes(2);
  });

  it('loads the lazy settings navigator before its registered settings screen', async () => {
    mockPreloadComponent.mockResolvedValue(undefined);
    const { preloadSettingsScreen } = require('./preloads');

    await preloadSettingsScreen();

    expect(mockPreloadComponent.mock.calls).toEqual([
      ['StackSettings'],
      ['SettingsScreen'],
    ]);
  });

  it('initializes the single-address screen registration before preloading it', async () => {
    mockPreloadComponent.mockResolvedValue(undefined);
    const { preloadSingleAddressNavigator } = require('./preloads');

    await preloadSingleAddressNavigator();

    expect(mockPreloadComponent.mock.calls).toEqual([
      ['SingleAddressHomeScreen'],
    ]);
  });
});
