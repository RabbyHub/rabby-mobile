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

  it('resolves the registered navigator before an explicit Perps push', async () => {
    const {
      PRELOAD_NAVIGATORS,
      prepareTransactionNavigatorForPerpsNavigation,
    } = require('./preloads');

    await prepareTransactionNavigatorForPerpsNavigation();

    expect(mockPreloadComponent).toHaveBeenCalledWith(
      PRELOAD_NAVIGATORS.StackTransaction,
    );
  });

  it('does not reload a navigator that bundle-splitter already cached', async () => {
    mockIsCached.mockReturnValue(true);
    const {
      prepareTransactionNavigatorForPerpsNavigation,
    } = require('./preloads');

    await prepareTransactionNavigatorForPerpsNavigation();

    expect(mockPreloadComponent).not.toHaveBeenCalled();
  });
});
