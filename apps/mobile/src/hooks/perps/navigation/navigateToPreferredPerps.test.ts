import { RootNames } from '@/constant/layout';

jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {
    getPerpsViewModePreference: jest.fn(),
    setPerpsViewMode: jest.fn(),
  },
}));

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  switchPerpsAccountBeforeNavigate: jest.fn(),
}));

jest.mock('@/perfs/preloads', () => ({
  prepareTransactionNavigatorForPerpsNavigation: jest.fn(async () => undefined),
}));

import {
  runPerpsHomeNavigation,
  runPreferredPerpsNavigation,
} from './navigateToPreferredPerps';

const account = {
  address: '0x341a1fBD51825E5a107DB54cCb3166DeBA145479',
  type: 'WatchAddressKeyring',
};

const createHarness = (viewMode: 'simple' | 'pro' = 'pro') => {
  const push = jest.fn();
  const dependencies = {
    prepareNavigator: jest.fn(async () => undefined),
    prepareViewMode: jest.fn(async () => ({
      error: null,
      hasVisitedPro: viewMode === 'pro',
      hydrated: true,
      savingMode: null,
      viewMode,
    })),
    startHomeProIntent: jest.fn(),
    startProIntent: jest.fn(),
    switchAccount: jest.fn(),
  };
  return {
    dependencies,
    navigation: { push } as never,
    push,
  };
};

describe('preferred Perps external navigation', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('opens the exact Pro market with one root push and a non-blocking intent', async () => {
    const harness = createHarness('pro');

    await expect(
      runPreferredPerpsNavigation(
        {
          account,
          canonicalMarket: 'BTC',
          navigation: harness.navigation,
          simpleDetail: {
            fromSource: 'homePagePositionList',
            market: 'BTC',
            showOpenPosition: false,
          },
          source: 'test',
        },
        harness.dependencies,
      ),
    ).resolves.toBe('pro');

    expect(harness.dependencies.switchAccount).toHaveBeenCalledWith(account);
    expect(harness.dependencies.startProIntent).toHaveBeenCalledWith({
      accountAddress: account.address,
      market: 'BTC',
      marketCandidates: undefined,
    });
    expect(harness.push).toHaveBeenCalledTimes(1);
    expect(harness.push).toHaveBeenCalledWith(RootNames.StackTransaction, {
      screen: RootNames.Perps,
      params: {
        account,
        dappId: 'hyperliquid',
        market: 'BTC',
        marketCandidates: undefined,
      },
    });
  });

  it('preserves the Simple root-plus-detail back stack', async () => {
    const harness = createHarness('simple');
    const simpleDetail = {
      fromSource: 'homePagePositionList' as const,
      market: 'SOL',
      showOpenPosition: false,
    };

    await expect(
      runPreferredPerpsNavigation(
        {
          account,
          canonicalMarket: 'SOL',
          navigation: harness.navigation,
          simpleDetail,
          source: 'test',
        },
        harness.dependencies,
      ),
    ).resolves.toBe('simple');

    expect(harness.dependencies.startProIntent).not.toHaveBeenCalled();
    expect(harness.push.mock.calls).toEqual([
      [
        RootNames.StackTransaction,
        {
          screen: RootNames.Perps,
          params: { account, dappId: 'hyperliquid' },
        },
      ],
      [
        RootNames.StackTransaction,
        { screen: RootNames.PerpsMarketDetail, params: simpleDetail },
      ],
    ]);
  });

  it('passes normalized DeFi candidates to Pro without guessing a market', async () => {
    const harness = createHarness('pro');

    await runPreferredPerpsNavigation(
      {
        account,
        marketCandidates: [' AAPL ', 'Apple', 'AAPL'],
        navigation: harness.navigation,
        simpleDetail: { market: 'AAPL' },
        source: 'test',
      },
      harness.dependencies,
    );

    expect(harness.dependencies.startProIntent).toHaveBeenCalledWith({
      accountAddress: account.address,
      market: undefined,
      marketCandidates: ['AAPL', 'Apple'],
    });
    expect(harness.push).toHaveBeenCalledWith(RootNames.StackTransaction, {
      screen: RootNames.Perps,
      params: expect.objectContaining({
        market: undefined,
        marketCandidates: ['AAPL', 'Apple'],
      }),
    });
  });

  it('falls back to the existing Simple path when the preference read fails', async () => {
    const harness = createHarness('pro');
    harness.dependencies.prepareViewMode.mockRejectedValue(
      new Error('unavailable'),
    );

    await expect(
      runPreferredPerpsNavigation(
        {
          navigation: harness.navigation,
          simpleDetail: { market: 'ETH' },
          source: 'test',
        },
        harness.dependencies,
      ),
    ).resolves.toBe('simple');

    expect(harness.push).toHaveBeenCalledTimes(2);
    expect(harness.dependencies.startProIntent).not.toHaveBeenCalled();
  });

  it('keeps Pro navigation non-blocking when prewarm cannot start', async () => {
    const harness = createHarness('pro');
    harness.dependencies.startProIntent.mockImplementation(() => {
      throw new Error('prewarm unavailable');
    });

    await expect(
      runPreferredPerpsNavigation(
        {
          canonicalMarket: 'BTC',
          navigation: harness.navigation,
          source: 'test',
        },
        harness.dependencies,
      ),
    ).resolves.toBe('pro');

    expect(harness.push).toHaveBeenCalledTimes(1);
  });

  it('does not navigate after the requested account switch fails', async () => {
    const harness = createHarness('pro');
    harness.dependencies.switchAccount.mockImplementation(() => {
      throw new Error('switch unavailable');
    });

    await expect(
      runPreferredPerpsNavigation(
        {
          account,
          navigation: harness.navigation,
          source: 'test',
        },
        harness.dependencies,
      ),
    ).resolves.toBe(false);

    expect(harness.dependencies.prepareViewMode).not.toHaveBeenCalled();
    expect(harness.dependencies.prepareNavigator).not.toHaveBeenCalled();
    expect(harness.push).not.toHaveBeenCalled();
  });

  it('hydrates the shared mode before the Home root push and preserves Home params', async () => {
    const harness = createHarness('pro');

    await expect(
      runPerpsHomeNavigation(
        { navigation: harness.navigation, source: 'home-main' },
        harness.dependencies,
      ),
    ).resolves.toBe('pro');

    expect(harness.dependencies.prepareViewMode).toHaveBeenCalledTimes(1);
    expect(harness.dependencies.prepareNavigator).toHaveBeenCalledTimes(1);
    expect(harness.dependencies.startHomeProIntent).toHaveBeenCalledTimes(1);
    expect(harness.push).toHaveBeenCalledWith(RootNames.StackTransaction, {
      screen: RootNames.Perps,
      params: {},
    });
    expect(
      harness.dependencies.prepareViewMode.mock.invocationCallOrder[0],
    ).toBeLessThan(harness.push.mock.invocationCallOrder[0]);
    expect(
      harness.dependencies.prepareNavigator.mock.invocationCallOrder[0],
    ).toBeLessThan(harness.push.mock.invocationCallOrder[0]);
  });

  it('keeps Home visible until the lazy Transaction navigator is cached', async () => {
    const harness = createHarness('simple');
    let finishNavigator!: () => void;
    harness.dependencies.prepareNavigator.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          finishNavigator = resolve;
        }),
    );

    const navigation = runPerpsHomeNavigation(
      { navigation: harness.navigation, source: 'home-main' },
      harness.dependencies,
    );
    await Promise.resolve();

    expect(harness.dependencies.prepareViewMode).toHaveBeenCalledTimes(1);
    expect(harness.dependencies.prepareNavigator).toHaveBeenCalledTimes(1);
    expect(harness.push).not.toHaveBeenCalled();

    finishNavigator();
    await expect(navigation).resolves.toBe('simple');
    expect(harness.push).toHaveBeenCalledTimes(1);
  });

  it('logs navigator preparation failure before using the existing route fallback', async () => {
    const harness = createHarness('simple');
    const error = new Error('navigator unavailable');
    harness.dependencies.prepareNavigator.mockRejectedValue(error);

    await expect(
      runPerpsHomeNavigation(
        { navigation: harness.navigation, source: 'home-main' },
        harness.dependencies,
      ),
    ).resolves.toBe('simple');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[perpsNavigation] prepare navigator failed (home-main)',
      error,
    );
    expect(harness.push).toHaveBeenCalledTimes(1);
  });

  it('does not start the Pro Home intent for a saved Simple mode', async () => {
    const harness = createHarness('simple');

    await expect(
      runPerpsHomeNavigation(
        { navigation: harness.navigation, source: 'home-main' },
        harness.dependencies,
      ),
    ).resolves.toBe('simple');

    expect(harness.dependencies.startHomeProIntent).not.toHaveBeenCalled();
    expect(harness.push).toHaveBeenCalledTimes(1);
  });
});
