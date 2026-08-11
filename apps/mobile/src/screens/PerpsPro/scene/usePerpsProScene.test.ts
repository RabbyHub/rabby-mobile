import type { MarketData } from '@/hooks/perps/usePerpsStore';
import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockPrepareBaseline = jest.fn();
const mockPrefetchBaseline = jest.fn();
const mockReadBaseline = jest.fn();
const mockSetSessionMarket = jest.fn();

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
  preparePerpsProZeroAddressLeverageBaseline: (...args: unknown[]) =>
    mockPrepareBaseline(...args),
  readPerpsProZeroAddressLeverageBaseline: (...args: unknown[]) =>
    mockReadBaseline(...args),
}));

jest.mock('./usePerpsBookPrecision', () => ({
  usePerpsBookPrecision: () => ({
    precision: null,
    selectTickOption: jest.fn(),
    selectedTickOption: null,
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

describe('usePerpsProScene prepared market selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadBaseline.mockReturnValue(null);
    mockPrepareBaseline.mockResolvedValue({ type: 'cross', value: 20 });
  });

  it('uses a prefetched initial baseline in the first visible market frame', () => {
    mockReadBaseline.mockReturnValue({ type: 'cross', value: 20 });
    const hook = renderHook(() => usePerpsProScene());

    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC');
    expect(hook.result.current.zeroAddressLeverageBaseline).toEqual({
      type: 'cross',
      value: 20,
    });
    expect(mockPrepareBaseline).not.toHaveBeenCalled();
  });

  it('does not expose the initial market before its baseline snapshot resolves', async () => {
    const initial = deferred<{ type: 'cross'; value: number } | null>();
    mockPrepareBaseline.mockReturnValueOnce(initial.promise);
    const hook = renderHook(() => usePerpsProScene());

    expect(hook.result.current.currentMarket).toBeNull();
    expect(hook.result.current.isResolvingMarket).toBe(true);

    act(() => initial.resolve({ type: 'cross', value: 20 }));
    await waitFor(() =>
      expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC'),
    );
    expect(hook.result.current.zeroAddressLeverageBaseline).toEqual({
      type: 'cross',
      value: 20,
    });
  });

  it('keeps the old market visible and commits the new market with one baseline snapshot', async () => {
    const hook = renderHook(() => usePerpsProScene());
    await waitFor(() =>
      expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC'),
    );

    const target = deferred<{ type: 'cross'; value: number } | null>();
    mockPrepareBaseline.mockReturnValueOnce(target.promise);
    let selection!: Promise<boolean>;
    act(() => {
      selection = hook.result.current.selectMarket(buildPerpsProMarket(sui));
    });

    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC');
    expect(hook.result.current.zeroAddressLeverageBaseline).toEqual({
      type: 'cross',
      value: 20,
    });

    await act(async () => {
      target.resolve({ type: 'cross', value: 10 });
      expect(await selection).toBe(true);
    });
    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('SUI');
    expect(hook.result.current.zeroAddressLeverageBaseline).toEqual({
      type: 'cross',
      value: 10,
    });
  });

  it('rejects a late selection when a newer market wins', async () => {
    const hook = renderHook(() => usePerpsProScene());
    await waitFor(() =>
      expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC'),
    );
    const first = deferred<{ type: 'cross'; value: number } | null>();
    const second = deferred<{ type: 'isolated'; value: number } | null>();
    mockPrepareBaseline
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const firstSelection = hook.result.current.selectMarket(
      buildPerpsProMarket(sui),
    );
    const secondSelection = hook.result.current.selectMarket(
      buildPerpsProMarket(eth),
    );
    await act(async () => {
      first.resolve({ type: 'cross', value: 10 });
      await expect(firstSelection).resolves.toBe(false);
    });
    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC');

    await act(async () => {
      second.resolve({ type: 'isolated', value: 12 });
      expect(await secondSelection).toBe(true);
    });
    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('ETH');
    expect(hook.result.current.zeroAddressLeverageBaseline).toEqual({
      type: 'isolated',
      value: 12,
    });

    const pending = deferred<{ type: 'cross'; value: number } | null>();
    mockPrepareBaseline.mockReturnValueOnce(pending.promise);
    const pendingSelection = hook.result.current.selectMarket(
      buildPerpsProMarket(sui),
    );
    await expect(
      hook.result.current.selectMarket(buildPerpsProMarket(eth)),
    ).resolves.toBe(true);
    await act(async () => {
      pending.resolve({ type: 'cross', value: 10 });
      await expect(pendingSelection).resolves.toBe(false);
    });
    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('ETH');
  });

  it('cancels a pending selector request without changing markets', async () => {
    const hook = renderHook(() => usePerpsProScene());
    await waitFor(() =>
      expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC'),
    );
    const target = deferred<{ type: 'cross'; value: number } | null>();
    mockPrepareBaseline.mockReturnValueOnce(target.promise);
    const selection = hook.result.current.selectMarket(
      buildPerpsProMarket(sui),
    );

    act(() => hook.result.current.cancelPendingMarketSelection());
    await act(async () => {
      target.resolve({ type: 'cross', value: 10 });
      await expect(selection).resolves.toBe(false);
    });
    expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC');
  });

  it('freezes a committed fallback for the current market scope', async () => {
    const hook = renderHook(() => usePerpsProScene());
    await waitFor(() =>
      expect(hook.result.current.currentMarket?.canonicalCoin).toBe('BTC'),
    );
    mockPrepareBaseline.mockResolvedValueOnce(null);

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
  });
});
