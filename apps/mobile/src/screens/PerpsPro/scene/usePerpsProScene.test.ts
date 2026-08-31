import type { MarketData } from '@/hooks/perps/usePerpsStore';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

const mockPrepareSources = jest.fn();
const mockPrefetchBaseline = jest.fn();
const mockReadAccountLeverage = jest.fn();
const mockReadBaseline = jest.fn();
const mockSetSessionMarket = jest.fn();
const mockCancelRealtimeIntent = jest.fn();
const mockPrewarmRealtimeIntent = jest.fn(() => mockCancelRealtimeIntent);
const mockPrewarmDisplaySnapshot = jest.fn(() => Promise.resolve(true));
const mockWaitDisplaySnapshot = jest.fn(() => Promise.resolve(true));
let mockSelectedTickOption: object | null = null;

const createMarketData = (name: string, maxLeverage: number): MarketData => ({
  dayBaseVlm: '100',
  dayNtlVlm: '100000',
  dexId: '',
  displayName: name,
  funding: '0',
  index: 0,
  logoUrl: '',
  markPx: '10',
  maxLeverage,
  maxUsdValueSize: '1000000',
  midPx: '10',
  minLeverage: 1,
  name,
  openInterest: '1',
  oraclePx: '10',
  premium: '0',
  prevDayPx: '9',
  pxDecimals: 2,
  quoteAsset: 'USDC',
  szDecimals: 2,
});

const btc = createMarketData('BTC', 40);
const sui = createMarketData('SUI', 10);
const eth = createMarketData('ETH', 25);
const mockPerpsState = {
  currentClearinghouseState: null,
  currentPerpsAccount: null as { address: string; type: string } | null,
  isUserDataReady: false,
  marketData: [btc, sui, eth],
  marketDataMap: { BTC: btc, ETH: eth, SUI: sui },
  marketDataStatus: 'ready' as const,
};

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useRoute: () => ({ params: undefined }),
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: unknown) => selector,
}));

jest.mock('@/hooks/perps/runtime/usePerpsRuntimeStatus', () => ({
  usePerpsRuntimeStatus: () => ({ status: 'ready' }),
}));

jest.mock('@/hooks/perps/usePerpsStore', () => {
  const store = (selector: (state: typeof mockPerpsState) => unknown) =>
    selector(mockPerpsState);
  store.getState = () => mockPerpsState;
  return {
    isPerpsUserAbstractionReadyForAccount: (state: typeof mockPerpsState) =>
      state.userAbstractionReady,
    perpsStore: store,
    usePerpsStore: () => ({ fetchMarketData: jest.fn() }),
  };
});

jest.mock('../session/perpsProMarketSession', () => ({
  getPerpsProMarketSession: () => ({ marketKey: 'hyperliquid::BTC' }),
  setPerpsProSessionMarket: (...args: unknown[]) =>
    mockSetSessionMarket(...args),
}));

jest.mock('./perpsProZeroAddressLeverageBaseline', () => ({
  prefetchPerpsProZeroAddressLeverageBaseline: (...args: unknown[]) =>
    mockPrefetchBaseline(...args),
  preparePerpsProLeverageSources: (...args: unknown[]) =>
    mockPrepareSources(...args),
  readPerpsProAccountLeverageConfiguration: (...args: unknown[]) =>
    mockReadAccountLeverage(...args),
  readPerpsProZeroAddressLeverageBaseline: (...args: unknown[]) =>
    mockReadBaseline(...args),
}));

jest.mock('./perpsProEntryIntent', () => ({
  prewarmPerpsProRealtimeDisplaySnapshot: (...args: unknown[]) =>
    mockPrewarmDisplaySnapshot(...args),
  prewarmPerpsProRealtimeIntent: (...args: unknown[]) =>
    mockPrewarmRealtimeIntent(...args),
  waitForPerpsProRealtimeDisplaySnapshot: (...args: unknown[]) =>
    mockWaitDisplaySnapshot(...args),
}));

jest.mock('./usePerpsBookPrecision', () => ({
  usePerpsBookPrecision: () => ({
    precision: mockSelectedTickOption ? { mantissa: null, nSigFigs: 5 } : null,
    selectTickOption: jest.fn(),
    selectedTickOption: mockSelectedTickOption,
  }),
}));

import { buildPerpsProMarket } from '../model/market';
import { usePerpsProScene } from './usePerpsProScene';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(next => {
    resolve = next;
  });
  return { promise, resolve };
};

const preparedSources = (
  zeroAddressLeverageBaseline: {
    type: 'cross' | 'isolated';
    value: number;
  } | null,
  accountLeverageConfiguration: {
    type: 'cross' | 'isolated';
    value: number;
  } | null = null,
) => ({ accountLeverageConfiguration, zeroAddressLeverageBaseline });

describe('usePerpsProScene prepared market selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPerpsState.currentPerpsAccount = null;
    mockPerpsState.currentClearinghouseState = null;
    mockPerpsState.isUserDataReady = false;
    mockSelectedTickOption = null;
    mockReadAccountLeverage.mockReturnValue(null);
    mockReadBaseline.mockReturnValue(null);
    mockPrepareSources.mockResolvedValue(
      preparedSources({ type: 'cross', value: 20 }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses a prefetched initial baseline in the first visible market frame', () => {
    mockReadBaseline.mockReturnValue({ type: 'cross', value: 20 });
    const hook = renderHook(() => usePerpsProScene());

    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC');
    expect(hook.result.current.zeroAddressLeverageBaseline).toEqual({
      type: 'cross',
      value: 20,
    });
    expect(mockPrepareSources).not.toHaveBeenCalled();
  });

  it('uses a cached current-account configuration in the first visible frame', () => {
    mockPerpsState.currentPerpsAccount = {
      address: '0x341a1fBD51825E5a107DB54cCb3166DeBA145479',
      type: 'WatchAddressKeyring',
    };
    mockReadAccountLeverage.mockReturnValue({
      type: 'isolated',
      value: 4,
    });
    mockReadBaseline.mockReturnValue({ type: 'cross', value: 20 });

    const hook = renderHook(() => usePerpsProScene());

    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC');
    expect(hook.result.current.accountLeverageConfiguration).toEqual({
      type: 'isolated',
      value: 4,
    });
    expect(hook.result.current.zeroAddressLeverageBaseline).toEqual({
      type: 'cross',
      value: 20,
    });
    expect(mockPrepareSources).not.toHaveBeenCalled();
  });

  it('re-prepares the visible market when the account changes', async () => {
    const firstAccount = {
      address: '0x341a1fBD51825E5a107DB54cCb3166DeBA145479',
      type: 'WatchAddressKeyring',
    };
    const secondAccount = {
      address: '0x1111111111111111111111111111111111111111',
      type: 'WatchAddressKeyring',
    };
    mockPerpsState.currentPerpsAccount = firstAccount;
    mockReadAccountLeverage.mockReturnValue({
      type: 'isolated',
      value: 4,
    });
    mockReadBaseline.mockReturnValue({ type: 'cross', value: 20 });
    const hook = renderHook(() => usePerpsProScene());
    expect(hook.result.current.accountLeverageConfiguration?.value).toBe(4);

    const secondSources = deferred<ReturnType<typeof preparedSources>>();
    mockReadAccountLeverage.mockReturnValue(null);
    mockPrepareSources.mockReturnValueOnce(secondSources.promise);
    mockPerpsState.currentPerpsAccount = secondAccount;
    hook.rerender(undefined);

    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC');
    expect(hook.result.current.accountLeverageConfiguration).toBeNull();
    expect(hook.result.current.tradeConfigurationReady).toBe(false);
    await waitFor(() =>
      expect(mockPrepareSources).toHaveBeenCalledWith(
        'BTC',
        secondAccount.address,
      ),
    );

    act(() =>
      secondSources.resolve(
        preparedSources(
          { type: 'cross', value: 20 },
          { type: 'isolated', value: 7 },
        ),
      ),
    );
    await waitFor(() =>
      expect(hook.result.current.accountLeverageConfiguration?.value).toBe(7),
    );
    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC');
    expect(hook.result.current.tradeConfigurationReady).toBe(true);
  });

  it('exposes the initial market immediately but keeps trading disabled until its baseline resolves', async () => {
    const initial = deferred<ReturnType<typeof preparedSources>>();
    mockPrepareSources.mockReturnValueOnce(initial.promise);
    const hook = renderHook(() => usePerpsProScene());

    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC');
    expect(hook.result.current.isResolvingMarket).toBe(false);
    expect(hook.result.current.tradeConfigurationReady).toBe(false);

    act(() => initial.resolve(preparedSources({ type: 'cross', value: 20 })));
    await waitFor(() =>
      expect(hook.result.current.zeroAddressLeverageBaseline).toEqual({
        type: 'cross',
        value: 20,
      }),
    );
    expect(hook.result.current.tradeConfigurationReady).toBe(true);
  });

  it('keeps the old market visible and commits the new market with one baseline snapshot', async () => {
    const hook = renderHook(() => usePerpsProScene());
    await waitFor(() =>
      expect(hook.result.current.zeroAddressLeverageBaseline).toEqual({
        type: 'cross',
        value: 20,
      }),
    );

    const target = deferred<ReturnType<typeof preparedSources>>();
    mockPrepareSources.mockReturnValueOnce(target.promise);
    let selection!: Promise<boolean>;
    act(() => {
      selection = hook.result.current.selectMarket(buildPerpsProMarket(sui));
    });

    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC');
    expect(hook.result.current.zeroAddressLeverageBaseline).toEqual({
      type: 'cross',
      value: 20,
    });
    expect(mockPrewarmRealtimeIntent).toHaveBeenCalledWith(
      expect.objectContaining({ canonicalCoin: 'SUI' }),
    );
    expect(mockCancelRealtimeIntent).not.toHaveBeenCalled();

    await act(async () => {
      target.resolve(preparedSources({ type: 'cross', value: 10 }));
      expect(await selection).toBe(true);
    });
    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('SUI');
    expect(hook.result.current.zeroAddressLeverageBaseline).toEqual({
      type: 'cross',
      value: 10,
    });
    expect(mockCancelRealtimeIntent).not.toHaveBeenCalled();
  });

  it('adopts one row PressIn lease and waits only for the bounded display handoff', async () => {
    const hook = renderHook(() => usePerpsProScene());
    await waitFor(() =>
      expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC'),
    );
    const targetMarket = buildPerpsProMarket(sui);
    const displayReady = deferred<boolean>();
    mockWaitDisplaySnapshot.mockReturnValueOnce(displayReady.promise);

    act(() => hook.result.current.startMarketRealtimeIntent(targetMarket));
    expect(mockPrewarmRealtimeIntent).toHaveBeenCalledTimes(1);

    let selection!: Promise<boolean>;
    act(() => {
      selection = hook.result.current.selectMarket(targetMarket);
    });
    expect(mockPrewarmRealtimeIntent).toHaveBeenCalledTimes(1);
    expect(mockPrewarmDisplaySnapshot).toHaveBeenCalledWith(targetMarket);
    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC');

    await act(async () => {
      displayReady.resolve(true);
      await expect(selection).resolves.toBe(true);
    });
    expect(mockWaitDisplaySnapshot).toHaveBeenCalledWith(
      targetMarket,
      expect.any(Number),
    );
    const remainingBudget = mockWaitDisplaySnapshot.mock.calls[0]?.[1];
    expect(remainingBudget).toBeGreaterThanOrEqual(0);
    expect(remainingBudget).toBeLessThanOrEqual(250);
    expect(mockCancelRealtimeIntent).not.toHaveBeenCalled();
    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('SUI');
  });

  it('rejects a late selection when a newer market wins', async () => {
    const hook = renderHook(() => usePerpsProScene());
    await waitFor(() =>
      expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC'),
    );
    const first = deferred<ReturnType<typeof preparedSources>>();
    const second = deferred<ReturnType<typeof preparedSources>>();
    mockPrepareSources
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const firstSelection = hook.result.current.selectMarket(
      buildPerpsProMarket(sui),
    );
    const secondSelection = hook.result.current.selectMarket(
      buildPerpsProMarket(eth),
    );
    expect(mockCancelRealtimeIntent).toHaveBeenCalledTimes(1);
    await act(async () => {
      first.resolve(preparedSources({ type: 'cross', value: 10 }));
      await expect(firstSelection).resolves.toBe(false);
    });
    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC');

    await act(async () => {
      second.resolve(preparedSources({ type: 'isolated', value: 12 }));
      expect(await secondSelection).toBe(true);
    });
    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('ETH');
    expect(hook.result.current.zeroAddressLeverageBaseline).toEqual({
      type: 'isolated',
      value: 12,
    });

    const pending = deferred<ReturnType<typeof preparedSources>>();
    mockPrepareSources.mockReturnValueOnce(pending.promise);
    const pendingSelection = hook.result.current.selectMarket(
      buildPerpsProMarket(sui),
    );
    await expect(
      hook.result.current.selectMarket(buildPerpsProMarket(eth)),
    ).resolves.toBe(true);
    await act(async () => {
      pending.resolve(preparedSources({ type: 'cross', value: 10 }));
      await expect(pendingSelection).resolves.toBe(false);
    });
    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('ETH');
  });

  it('cancels a pending selector request without changing markets', async () => {
    const hook = renderHook(() => usePerpsProScene());
    await waitFor(() =>
      expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC'),
    );
    const target = deferred<ReturnType<typeof preparedSources>>();
    mockPrepareSources.mockReturnValueOnce(target.promise);
    const selection = hook.result.current.selectMarket(
      buildPerpsProMarket(sui),
    );

    act(() => hook.result.current.cancelPendingMarketSelection());
    expect(mockCancelRealtimeIntent).toHaveBeenCalledTimes(1);
    await act(async () => {
      target.resolve(preparedSources({ type: 'cross', value: 10 }));
      await expect(selection).resolves.toBe(false);
    });
    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC');
  });

  it('cancels realtime intent when market preparation rejects', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const hook = renderHook(() => usePerpsProScene());
    await waitFor(() =>
      expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC'),
    );
    mockPrepareSources.mockRejectedValueOnce(new Error('network failed'));

    await expect(
      hook.result.current.selectMarket(buildPerpsProMarket(sui)),
    ).resolves.toBe(false);

    expect(mockPrewarmRealtimeIntent).toHaveBeenCalledTimes(1);
    expect(mockCancelRealtimeIntent).toHaveBeenCalledTimes(1);
    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC');
  });

  it('continues the atomic market commit when speculative realtime prewarm throws', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockPrewarmRealtimeIntent.mockImplementationOnce(() => {
      throw new Error('subscription unavailable');
    });
    const hook = renderHook(() => usePerpsProScene());
    await waitFor(() =>
      expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC'),
    );

    await expect(
      hook.result.current.selectMarket(buildPerpsProMarket(sui)),
    ).resolves.toBe(true);

    expect(mockPrepareSources).toHaveBeenCalledWith('SUI', undefined);
    await waitFor(() =>
      expect(hook.result.current.currentMarket?.canonicalCoin).toBe('SUI'),
    );
  });

  it('freezes a committed fallback for the current market scope', async () => {
    const hook = renderHook(() => usePerpsProScene());
    await waitFor(() =>
      expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC'),
    );
    mockPrepareSources.mockResolvedValueOnce(preparedSources(null));

    await act(async () => {
      expect(
        await hook.result.current.selectMarket(buildPerpsProMarket(sui)),
      ).toBe(true);
    });
    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('SUI');
    expect(hook.result.current.zeroAddressLeverageBaseline).toBeNull();

    act(() => hook.result.current.prefetchMarket('SUI'));
    hook.rerender(undefined);
    expect(hook.result.current.zeroAddressLeverageBaseline).toBeNull();
  });

  it('forwards mounted-row prefetch without changing the selection', async () => {
    const hook = renderHook(() => usePerpsProScene());
    await waitFor(() =>
      expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC'),
    );
    act(() => hook.result.current.prefetchMarket('SUI'));
    expect(mockPrefetchBaseline).toHaveBeenCalledWith('SUI');
    expect(mockPrewarmRealtimeIntent).not.toHaveBeenCalled();
  });

  it('resolves card coin selection through the canonical atomic market path', async () => {
    const hook = renderHook(() => usePerpsProScene());
    await waitFor(() =>
      expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC'),
    );

    await act(async () => {
      await expect(hook.result.current.selectMarketByCoin('SUI')).resolves.toBe(
        true,
      );
    });
    expect(mockPrepareSources).toHaveBeenLastCalledWith('SUI', undefined);
    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('SUI');
    await expect(
      hook.result.current.selectMarketByCoin('UNKNOWN'),
    ).resolves.toBe(false);
  });

  it('keeps the logical order-book subscription across AppState background while pausing publication', async () => {
    let onAppStateChange: ((state: AppStateStatus) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, cb) => {
      if (event === 'change') {
        onAppStateChange = cb;
      }
      return { remove: jest.fn() } as never;
    });
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
    mockSelectedTickOption = {};
    mockReadBaseline.mockReturnValue({ type: 'cross', value: 20 });
    const hook = renderHook(() => usePerpsProScene());

    expect(hook.result.current.orderBookSubscriptionEnabled).toBe(true);
    expect(hook.result.current.realtimeEnabled).toBe(true);

    act(() => onAppStateChange?.('background'));
    expect(hook.result.current.orderBookSubscriptionEnabled).toBe(true);
    expect(hook.result.current.realtimeEnabled).toBe(false);

    act(() => onAppStateChange?.('active'));
    expect(hook.result.current.orderBookSubscriptionEnabled).toBe(true);
    expect(hook.result.current.realtimeEnabled).toBe(true);
  });
});
