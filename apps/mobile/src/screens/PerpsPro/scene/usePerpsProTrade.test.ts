import type { L2Book } from '@rabby-wallet/hyperliquid-sdk';
import { act, renderHook } from '@testing-library/react-native';

const mockAccount = {
  address: '0x0000000000000000000000000000000000000001',
  type: 'watch',
};
const mockPerpsState = {
  currentClearinghouseState: {
    assetPositions: [],
    crossMaintenanceMarginUsed: '0',
    crossMarginSummary: { accountValue: '1000' },
    perDexSummaries: {
      '': {
        crossAccountValue: '1000',
        crossMaintenanceMarginUsed: '0',
      },
    },
  },
  currentPerpsAccount: mockAccount,
  hasPermission: true,
  isUserDataReady: true,
  openOrders: [],
  spotState: {
    tokenToAvailableAfterMaintenance: null as [number, string][] | null,
  },
  userAbstraction: 'default',
  userAbstractionReady: true,
};
const mockGetSkipConfirmation = jest.fn(async () => false);
const mockSetSkipConfirmation = jest.fn(async () => undefined);
const mockEnsureApproval = jest.fn(async (_account?: unknown) => undefined);
const mockBuildUpdateLeverage = jest.fn((params: unknown) => params);
const mockExecuteUpdateLeverage = jest.fn(async (_command?: unknown) => ({
  kind: 'success' as const,
}));
const mockGetPerpsSdk = jest.fn();
const mockLimitOrderOpen = jest.fn(async () => ({
  response: { data: { statuses: [{ resting: { oid: 2 } }] } },
  status: 'ok',
}));
const mockShowToast = jest.fn();
const mockCalLiquidationPrice = jest.fn((..._args: unknown[]) => 50);
const mockExecuteAttached = jest.fn(async () => ({
  kind: 'fullAccepted' as const,
  reconciliationErrors: [],
  refreshErrors: [],
}));
type MockLatestTradeSnapshot = {
  error: Error | null;
  identity: string;
  receivedAt: number | null;
  revision: number;
  status: 'loading' | 'ready';
  trade: {
    coin: string;
    price: string;
    side: 'buy' | 'sell';
    size: string;
    tid: number;
    time: number;
  } | null;
};
const mockLatestTradeListeners = new Map<
  string,
  Set<(snapshot: MockLatestTradeSnapshot) => void>
>();
const mockSubscribeToPerpsLatestTrade = jest.fn(
  (coin: string, listener: (snapshot: MockLatestTradeSnapshot) => void) => {
    const listeners = mockLatestTradeListeners.get(coin) ?? new Set();
    listeners.add(listener);
    mockLatestTradeListeners.set(coin, listeners);
    listener({
      error: null,
      identity: coin,
      receivedAt: null,
      revision: 0,
      status: 'loading',
      trade: null,
    });
    return () => listeners.delete(listener);
  },
);
const emitLatestTrade = (coin: string, price: string, tid = 1) => {
  const snapshot: MockLatestTradeSnapshot = {
    error: null,
    identity: coin,
    receivedAt: tid,
    revision: tid,
    status: 'ready',
    trade: {
      coin,
      price,
      side: 'buy',
      size: '1',
      tid,
      time: tid,
    },
  };
  mockLatestTradeListeners.get(coin)?.forEach(listener => listener(snapshot));
};

jest.mock('@/core/apis/perps', () => ({
  apisPerps: { getPerpsSDK: (...args: unknown[]) => mockGetPerpsSdk(...args) },
}));

jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {
    getSkipPerpsProTradeConfirmation: (...args: unknown[]) =>
      mockGetSkipConfirmation(args[0]),
    setSkipPerpsProTradeConfirmation: (...args: unknown[]) =>
      mockSetSkipConfirmation(args[0], args[1]),
  },
}));

jest.mock('@/hooks/perps/actions/actionError', () => ({
  isPerpsActionUserCancelled: () => false,
}));

jest.mock('@/hooks/perps/actions/perpsActionApproval', () => ({
  ensurePerpsActionApproval: (...args: unknown[]) =>
    mockEnsureApproval(args[0]),
}));

jest.mock('@/hooks/perps/actions/updateLeverage', () => ({
  buildPerpsUpdateLeverageCommand: (...args: unknown[]) =>
    mockBuildUpdateLeverage(args[0]),
  executePerpsUpdateLeverage: (...args: unknown[]) =>
    mockExecuteUpdateLeverage(args[0]),
}));

jest.mock('@/hooks/perps/showToast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

jest.mock('@/hooks/perps/subscriptions/usePerpsLatestTrade', () => ({
  subscribeToPerpsLatestTrade: (
    coin: string,
    listener: (snapshot: MockLatestTradeSnapshot) => void,
  ) => mockSubscribeToPerpsLatestTrade(coin, listener),
}));

jest.mock('@/hooks/perps/usePerpsStore', () => {
  const store = (selector: (state: typeof mockPerpsState) => unknown) =>
    selector(mockPerpsState);
  store.getState = () => mockPerpsState;
  return {
    fetchClearinghouseStateHttp: jest.fn(),
    fetchPositionOpenOrdersHttp: jest.fn(),
    getDexByCoin: jest.fn(() => ''),
    getPerpsAccountRuntimeContext: () => ({
      account: mockAccount,
      generation: 1,
      isInitialized: true,
    }),
    isPerpsUserAbstractionReadyForAccount: (state: typeof mockPerpsState) =>
      state.userAbstractionReady,
    perpsStore: store,
  };
});

jest.mock('@/hooks/perps/runtime/perpsRuntimeState', () => ({
  getPerpsRuntimeIdentity: (account: typeof mockAccount) =>
    `${account.address.toLowerCase()}::${String(account.type)}`,
  getPerpsRuntimeSnapshot: () => ({
    branch: 'selfSign',
    error: null,
    generation: 1,
    identity: '0x0000000000000000000000000000000000000001::watch',
    origin: 'runtime',
    phase: null,
    status: 'ready',
  }),
}));

jest.mock('@/utils/perps', () => ({
  calLiquidationPrice: (...args: unknown[]) => mockCalLiquidationPrice(...args),
  normalizePerpsMarketMarginMode: (
    marginMode: unknown,
    onlyIsolated: boolean,
  ) => marginMode || (onlyIsolated ? 'noCross' : 'normal'),
}));

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('zustand/react/shallow', () => ({
  useShallow: (selector: unknown) => selector,
}));

jest.mock('./usePerpsProTradePreferences', () => ({
  usePerpsProTradePreferences: () => ({
    amountUnit: 'quote',
    hydrated: true,
    orderType: 'market',
    setAmountUnit: jest.fn(),
    setOrderType: jest.fn(),
  }),
}));

jest.mock('./usePerpsProAttachedTpSlExecution', () => ({
  usePerpsProAttachedTpSlExecution: () => ({
    execute: mockExecuteAttached,
    recoverJournal: jest.fn(),
  }),
}));

import type { PerpsProMarket } from '../model/market';
import { usePerpsProTrade } from './usePerpsProTrade';

const market = {
  canonicalCoin: 'BTC',
  displayBase: 'BTC',
  displayPair: 'BTCUSDC',
  fullName: 'Bitcoin',
  marketData: {
    dexId: '',
    markPx: '100',
    maxLeverage: 20,
    maxUsdValueSize: '100000',
    midPx: '100',
    onlyIsolated: false,
    pxDecimals: 2,
    szDecimals: 2,
  },
  marketKey: 'hyperliquid::BTC',
  quoteAsset: 'USDC',
} as PerpsProMarket;

const book: L2Book = {
  coin: 'BTC',
  levels: [[{ n: 1, px: '99', sz: '10' }], [{ n: 1, px: '101', sz: '10' }]],
  time: 123,
};

const activeAssetData = {
  availableToTrade: ['1000', '1000'],
  coin: 'BTC',
  leverage: { type: 'isolated', value: 10 },
  markPx: '100',
  maxTradeSzs: ['10', '10'],
  user: mockAccount.address,
};

describe('usePerpsProTrade attached TP/SL execution integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLatestTradeListeners.clear();
    mockGetSkipConfirmation.mockResolvedValue(false);
    mockPerpsState.currentClearinghouseState.assetPositions.length = 0;
    mockPerpsState.hasPermission = true;
    mockPerpsState.openOrders.length = 0;
    mockPerpsState.spotState.tokenToAvailableAfterMaintenance = null;
    mockPerpsState.userAbstraction = 'default';
    mockPerpsState.userAbstractionReady = true;
    mockGetPerpsSdk.mockReturnValue({
      exchange: {
        limitOrderOpen: mockLimitOrderOpen,
        marketOrderOpen: jest.fn(async () => ({
          response: { data: { statuses: [{ filled: { oid: 1 } }] } },
          status: 'ok',
        })),
      },
    });
    mockPerpsState.isUserDataReady = true;
  });

  it('fail-closes configuration changes and order review while the visible market is still preparing', async () => {
    const updateLeverageRequest = jest.fn(async () => true);
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: false,
        leveragePending: false,
        market,
        tradeConfigurationReady: false,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest,
      }),
    );

    await act(async () => {
      await hook.result.current.setMarginMode('cross');
    });
    expect(hook.result.current.marginMode).toBe('isolated');
    await act(async () => {
      await expect(hook.result.current.confirmLeverage(15)).resolves.toBe(
        false,
      );
      await hook.result.current.requestReview('buy');
    });
    expect(updateLeverageRequest).not.toHaveBeenCalled();
    expect(mockGetSkipConfirmation).not.toHaveBeenCalled();
    expect(hook.result.current.review).toBeNull();
  });

  it('applies Margin Mode on the server immediately and keeps failures unchanged', async () => {
    const updateLeverageRequest = jest
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest,
      }),
    );

    await act(async () => {
      expect(await hook.result.current.setMarginMode('cross')).toBe(true);
    });
    expect(updateLeverageRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: 'marginMode',
        coin: 'BTC',
        isCross: true,
        leverage: 10,
      }),
    );
    expect(hook.result.current.marginMode).toBe('cross');

    await act(async () => {
      expect(await hook.result.current.setMarginMode('isolated')).toBe(false);
    });
    expect(updateLeverageRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentIsCross: true, isCross: false }),
    );
    expect(hook.result.current.marginMode).toBe('cross');
  });

  it('uses the latest trade for a new Limit session and keeps manual price only within that session', () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    expect(hook.result.current.form.limitPrice).toBe('');
    expect(hook.result.current.form.conditionalLimitPrice).toBe('');
    act(() => emitLatestTrade('BTC', '100.129', 1));
    act(() => hook.result.current.setOrderType('limit'));
    expect(hook.result.current.form.limitPrice).toBe('100.12');

    act(() =>
      hook.result.current.selectOrderBookPrice('101.234', market.marketKey),
    );
    expect(hook.result.current.form.limitPrice).toBe('101.23');

    act(() => hook.result.current.enableBbo('cp1'));
    act(() => hook.result.current.selectOrderBookPrice('99', market.marketKey));
    expect(hook.result.current.form.limitPrice).toBe('101.23');

    act(() => emitLatestTrade('BTC', '102.349', 2));
    act(() => hook.result.current.disableBbo());
    expect(hook.result.current.form.limitPrice).toBe('101.23');

    act(() => hook.result.current.setOrderType('market'));
    act(() => emitLatestTrade('BTC', '103.459', 3));
    act(() => hook.result.current.setOrderType('limit'));
    expect(hook.result.current.form.limitPrice).toBe('103.45');
    expect(hook.result.current.form.bboEnabled).toBe(false);
  });

  it('fills only the Conditional Trigger Price after an explicit order-book selection', () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => emitLatestTrade('BTC', '100.129', 1));
    act(() => hook.result.current.setOrderType('conditional'));
    expect(hook.result.current.form.triggerPrice).toBe('');

    act(() => emitLatestTrade('BTC', '102.349', 2));
    expect(hook.result.current.form.triggerPrice).toBe('');

    act(() =>
      hook.result.current.selectOrderBookPrice('101.234', market.marketKey),
    );
    expect(hook.result.current.form.triggerPrice).toBe('101.23');
    expect(hook.result.current.form.conditionalLimitPrice).toBe('');
    expect(hook.result.current.priceFillFeedback).toEqual({
      field: 'triggerPrice',
      revision: 1,
    });

    act(() =>
      hook.result.current.selectOrderBookPrice('101.234', market.marketKey),
    );
    expect(hook.result.current.priceFillFeedback).toEqual({
      field: 'triggerPrice',
      revision: 2,
    });

    act(() =>
      hook.result.current.selectOrderBookPrice('99', 'hyperliquid::ETH'),
    );
    expect(hook.result.current.form.triggerPrice).toBe('101.23');

    act(() => hook.result.current.setOrderType('market'));
    act(() => hook.result.current.selectOrderBookPrice('99', market.marketKey));
    expect(hook.result.current.form.triggerPrice).toBe('');
  });

  it('uses the latest trade when BBO is disabled without a manual Limit price', () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => emitLatestTrade('BTC', '100.129', 1));
    act(() => hook.result.current.setOrderType('limit'));
    act(() => hook.result.current.enableBbo('q1'));
    act(() => emitLatestTrade('BTC', '102.349', 2));
    act(() => hook.result.current.disableBbo());

    expect(hook.result.current.form).toMatchObject({
      bboEnabled: false,
      bboStrategy: 'q1',
      limitPrice: '102.34',
    });
  });

  it('atomically replaces BBO with TP/SL and clears the selected level', () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => emitLatestTrade('BTC', '100.129', 1));
    act(() => hook.result.current.setOrderType('limit'));
    act(() => hook.result.current.setPrice('limitPrice', '88'));
    act(() => hook.result.current.enableBbo('q5'));
    act(() => emitLatestTrade('BTC', '102.349', 2));

    expect(hook.result.current.tpSl.compatibilityError).toBe('bboUnsupported');
    expect(hook.result.current.tpSl.disabled).toBe(false);
    act(() => hook.result.current.tpSl.setEnabled(true));

    expect(hook.result.current.form).toMatchObject({
      attachedTpSl: { enabled: true },
      bboEnabled: false,
      bboStrategy: null,
      limitPrice: '102.34',
    });

    act(() => hook.result.current.tpSl.setEnabled(false));
    act(() => hook.result.current.enableBbo('cp1'));
    act(() => hook.result.current.disableBbo());
    expect(hook.result.current.form.limitPrice).toBe('102.34');
  });

  it('fills the next latest trade once when TP/SL replaces BBO before a trade exists', () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setOrderType('limit'));
    act(() => hook.result.current.enableBbo('cp5'));
    act(() => hook.result.current.tpSl.setEnabled(true));
    expect(hook.result.current.form).toMatchObject({
      bboEnabled: false,
      bboStrategy: null,
      limitPrice: '',
    });

    act(() => emitLatestTrade('BTC', '103.459', 1));
    expect(hook.result.current.form.limitPrice).toBe('103.45');
    act(() => emitLatestTrade('BTC', '104.999', 2));
    expect(hook.result.current.form.limitPrice).toBe('103.45');
  });

  it('keeps quote Max available before manual Limit prices are entered', () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setOrderType('limit'));
    expect(hook.result.current.form.limitPrice).toBe('');
    expect(hook.result.current.getMaxDisplayAmount('buy')).toBe('1000.00');

    act(() => hook.result.current.patchForm({ limitPrice: '95' }));
    expect(hook.result.current.getMaxDisplayAmount('buy')).toBe('950.00');

    act(() => hook.result.current.setOrderType('conditional'));
    act(() => hook.result.current.setConditionalExecution('limit'));
    expect(hook.result.current.form.conditionalLimitPrice).toBe('');
    expect(hook.result.current.getMaxDisplayAmount('buy')).toBe('1000.00');

    act(() => hook.result.current.patchForm({ conditionalLimitPrice: '96' }));
    expect(hook.result.current.getMaxDisplayAmount('buy')).toBe('960.00');
  });

  it('shows a BBO level in review and resolves its numeric price at SDK submission', async () => {
    const hook = renderHook(
      ({ ask }: { ask: string }) =>
        usePerpsProTrade({
          activeAssetData,
          bboBook: {
            ...book,
            levels: [book.levels[0], [{ n: 1, px: ask, sz: '10' }]],
          },
          bboPrices: {
            asks1: ask,
            asks5: null,
            bids1: '99',
            bids5: null,
          },
          bboSessionKey: 'BTC:1',
          bboStatus: 'ready',
          executionActive: true,
          leveragePending: false,
          market,
          refreshActiveAssetData: jest.fn(async () => undefined),
          updateLeverageRequest: jest.fn(async () => true),
        }),
      { initialProps: { ask: '101' } },
    );

    act(() => hook.result.current.setOrderType('limit'));
    act(() => hook.result.current.enableBbo('cp1'));
    act(() => hook.result.current.setAmount('101'));
    await act(async () => hook.result.current.requestReview('buy'));

    expect(hook.result.current.review).toMatchObject({
      execution: { kind: 'bboLimit', strategy: 'cp1' },
    });
    hook.rerender({ ask: '102' });
    await act(async () => hook.result.current.confirmReview());

    expect(mockLimitOrderOpen).toHaveBeenCalledWith(
      expect.objectContaining({ limitPx: '102', tif: 'Gtc' }),
    );
  });

  it('keeps TIF visible state mutually exclusive with BBO', () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => emitLatestTrade('BTC', '100.129', 1));
    act(() => hook.result.current.setOrderType('limit'));
    act(() => hook.result.current.setPrice('limitPrice', '88'));
    act(() => hook.result.current.enableBbo('cp1'));
    expect(hook.result.current.form.bboEnabled).toBe(true);

    act(() => hook.result.current.setTif('Ioc'));
    expect(hook.result.current.form).toMatchObject({
      bboEnabled: false,
      limitPrice: '88',
      tif: 'Ioc',
    });

    act(() => hook.result.current.enableBbo('q1'));
    expect(hook.result.current.form.bboEnabled).toBe(false);

    act(() => hook.result.current.setTif('Gtc'));
    act(() => hook.result.current.enableBbo('q1'));
    expect(hook.result.current.form).toMatchObject({
      bboEnabled: true,
      bboStrategy: 'q1',
      tif: 'Gtc',
    });

    act(() => hook.result.current.setTif('Alo'));
    expect(hook.result.current.form).toMatchObject({
      bboEnabled: false,
      limitPrice: '88',
      tif: 'Alo',
    });
  });

  it('clears Conditional prices when order type or execution mode changes', () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setOrderType('conditional'));
    act(() => hook.result.current.setPrice('triggerPrice', '110'));
    act(() => hook.result.current.setConditionalExecution('limit'));
    act(() => hook.result.current.setPrice('conditionalLimitPrice', '111'));
    act(() => hook.result.current.setConditionalExecution('market'));
    expect(hook.result.current.form.triggerPrice).toBe('110');
    expect(hook.result.current.form.conditionalLimitPrice).toBe('');

    act(() => hook.result.current.setOrderType('market'));
    expect(hook.result.current.form.triggerPrice).toBe('');
    expect(hook.result.current.form.conditionalLimitPrice).toBe('');
  });

  it('falls back from missing mid to mark for quote Max display only', () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market: {
          ...market,
          marketData: { ...market.marketData, markPx: '95', midPx: '' },
        },
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setOrderType('limit'));
    expect(hook.result.current.getMaxDisplayAmount('buy')).toBe('950.00');
    expect(hook.result.current.form.limitPrice).toBe('');
  });

  it('clears Amount and Slider on every order type change', () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setPercentage(100));
    expect(hook.result.current.form.amount).toBe('100%');
    expect(hook.result.current.percentage).toBe(100);

    act(() => hook.result.current.setOrderType('limit'));
    expect(hook.result.current.form.amount).toBe('');
    expect(hook.result.current.percentage).toBe(0);

    act(() => hook.result.current.setAmount('25'));
    act(() => hook.result.current.patchForm({ bboEnabled: true }));
    expect(hook.result.current.tpSl.disabled).toBe(false);

    act(() => hook.result.current.setOrderType('market'));
    expect(hook.result.current.form.amount).toBe('');
    expect(hook.result.current.percentage).toBe(0);
    expect(hook.result.current.tpSl.disabled).toBe(false);

    act(() => hook.result.current.setOrderType('limit'));
    expect(hook.result.current.form.amount).toBe('');
    expect(hook.result.current.percentage).toBe(0);
    expect(hook.result.current.form.bboEnabled).toBe(false);
    expect(hook.result.current.tpSl.disabled).toBe(false);
  });

  it('toasts during manual input only after the amount exceeds both side maxima', () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData: {
          ...activeAssetData,
          maxTradeSzs: ['5', '10'],
        },
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setAmount('600'));
    expect(mockShowToast).not.toHaveBeenCalled();

    act(() => hook.result.current.setAmount('1000.01'));
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.trade.insufficientBalance',
      'error',
    );

    act(() => hook.result.current.setAmount('1000.02'));
    expect(mockShowToast).toHaveBeenCalledTimes(1);

    act(() => hook.result.current.setAmount('900'));
    act(() => hook.result.current.setAmount('1001'));
    expect(mockShowToast).toHaveBeenCalledTimes(2);
  });

  it('projects Slider button amounts per side and zeros the unavailable Reduce Only side', () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData: {
          ...activeAssetData,
          maxTradeSzs: ['8', '4'],
        },
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setPercentage(50));
    expect(hook.result.current.getSliderButtonDisplayAmount('buy')).toBe('400');
    expect(hook.result.current.getSliderButtonDisplayAmount('sell')).toBe(
      '200',
    );

    mockPerpsState.currentClearinghouseState.assetPositions.push({
      position: {
        coin: 'BTC',
        leverage: { type: 'isolated', value: 10 },
        szi: '1',
      },
    } as never);
    hook.rerender(undefined);
    act(() => hook.result.current.patchForm({ reduceOnly: true }));

    expect(hook.result.current.getSliderButtonDisplayAmount('buy')).toBe('0');
    expect(hook.result.current.getSliderButtonDisplayAmount('sell')).toBe('50');
  });

  it('shows the Reduce Only direction error before generic Amount or Max errors', async () => {
    mockPerpsState.currentClearinghouseState.assetPositions.push({
      position: {
        coin: 'BTC',
        leverage: { type: 'isolated', value: 10 },
        szi: '1',
      },
    } as never);
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.patchForm({ reduceOnly: true }));
    await act(async () => hook.result.current.requestReview('buy'));

    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.trade.reduceOnlyUnavailable',
      'error',
    );
    expect(mockGetSkipConfirmation).not.toHaveBeenCalled();
    expect(hook.result.current.review).toBeNull();
  });

  it('resets Reduce Only only after ready confirms no current position', () => {
    mockPerpsState.isUserDataReady = false;
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.patchForm({ reduceOnly: true }));
    expect(hook.result.current.form.reduceOnly).toBe(true);
    expect(hook.result.current.reduceOnlyAvailability.checkboxDisabled).toBe(
      true,
    );

    mockPerpsState.isUserDataReady = true;
    hook.rerender(undefined);
    expect(hook.result.current.form.reduceOnly).toBe(false);
  });

  it('clears a manual Amount on every unit switch', () => {
    const roundingMarket = {
      ...market,
      marketData: {
        ...market.marketData,
        markPx: '63',
        midPx: '63',
        szDecimals: 2,
      },
    };
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: {
          asks1: '64',
          asks5: null,
          bids1: '62',
          bids5: null,
        },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market: roundingMarket,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setAmount('200'));
    expect(hook.result.current.form.amount).toBe('200');

    act(() => hook.result.current.toggleAmountUnit());
    expect(hook.result.current.form.amountUnit).toBe('base');
    expect(hook.result.current.form.amount).toBe('');

    act(() => hook.result.current.setAmount('3.17'));
    act(() => hook.result.current.toggleAmountUnit());
    expect(hook.result.current.form.amountUnit).toBe('quote');
    expect(hook.result.current.form.amount).toBe('');
  });

  it('atomically clears Slider percentage and Amount when switching units', () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: {
          asks1: '101',
          asks5: null,
          bids1: '99',
          bids5: null,
        },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setPercentage(50));
    expect(hook.result.current.percentage).toBe(50);
    expect(hook.result.current.form.amount).toBe('50%');

    act(() => hook.result.current.toggleAmountUnit());
    expect(hook.result.current.form.amountUnit).toBe('base');
    expect(hook.result.current.percentage).toBe(0);
    expect(hook.result.current.form.amount).toBe('');
    expect(hook.result.current.resolvedAmount).toBeNull();
  });

  it('atomically exits Slider source when manual Amount entry begins', () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: {
          asks1: '101',
          asks5: null,
          bids1: '99',
          bids5: null,
        },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setPercentage(30));
    expect(hook.result.current.form.amount).toBe('30%');

    act(() => hook.result.current.beginAmountEntry());
    expect(hook.result.current.percentage).toBe(0);
    expect(hook.result.current.form.amount).toBe('');
    expect(hook.result.current.resolvedAmount).toBeNull();
    expect(hook.result.current.showAmountConversion).toBe(false);

    act(() => hook.result.current.setAmount('12'));
    act(() => hook.result.current.beginAmountEntry());
    expect(hook.result.current.form.amount).toBe('12');
  });

  it('freezes direction-specific L2 facts and delegates to the real execution boundary', async () => {
    const refreshActiveAssetData = jest.fn(async () => undefined);
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: {
          asks1: '101',
          asks5: null,
          bids1: '99',
          bids5: null,
        },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData,
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setAmount('101'));
    act(() => hook.result.current.tpSl.setRawMagnitude('tp', '110'));
    act(() => hook.result.current.tpSl.setRawMagnitude('sl', '90'));
    act(() => hook.result.current.tpSl.setEnabled(true));
    await act(async () => hook.result.current.requestReview('buy'));

    expect(mockShowToast).not.toHaveBeenCalled();
    expect(hook.result.current.review).toMatchObject({
      attached: {
        expectedEntryPrice: '101',
        normalizedBaseSize: '1',
        side: 'buy',
        sl: { triggerPrice: '90' },
        tp: { triggerPrice: '110' },
      },
      marketSnapshot: { bookTime: 123, sessionKey: 'BTC:1' },
      parent: {
        baseSize: '1',
        execution: {
          kind: 'market',
          slippageReferenceMidPrice: '100',
        },
        quoteAmount: '101',
        side: 'buy',
      },
      type: 'openOrderWithAttachedTpSl',
    });
    expect(mockGetSkipConfirmation).toHaveBeenCalledWith('market');

    await act(async () => hook.result.current.confirmReview());
    expect(hook.result.current.review).toBeNull();
    expect(mockExecuteAttached).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'openOrderWithAttachedTpSl' }),
      expect.any(Function),
    );
    expect(mockEnsureApproval).not.toHaveBeenCalled();
    expect(mockGetPerpsSdk).not.toHaveBeenCalled();
    expect(refreshActiveAssetData).not.toHaveBeenCalled();
    expect(mockSetSkipConfirmation).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.trade.attachedTpSlSubmitted',
      'success',
    );
    expect(hook.result.current.form.attachedTpSl).toEqual({
      enabled: false,
      sl: { mode: 'price', rawMagnitude: '' },
      tp: { mode: 'price', rawMagnitude: '' },
    });
  });

  it('blocks the right Trade Form with the shared region message', async () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: {
          asks1: '101',
          asks5: null,
          bids1: '99',
          bids5: null,
        },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );
    act(() => hook.result.current.setAmount('100'));
    mockPerpsState.hasPermission = false;

    await act(async () => hook.result.current.requestReview('buy'));

    expect(hook.result.current.review).toBeNull();
    expect(mockGetSkipConfirmation).not.toHaveBeenCalled();
    expect(mockEnsureApproval).not.toHaveBeenCalled();
    expect(mockGetPerpsSdk).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.regionNotSupport',
      'error',
    );
  });

  it('rechecks region permission when an existing review is confirmed', async () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: {
          asks1: '101',
          asks5: null,
          bids1: '99',
          bids5: null,
        },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );
    act(() => hook.result.current.setAmount('100'));
    await act(async () => hook.result.current.requestReview('buy'));
    expect(hook.result.current.review).not.toBeNull();
    mockPerpsState.hasPermission = false;

    await act(async () => hook.result.current.confirmReview());

    expect(hook.result.current.review).toBeNull();
    expect(mockEnsureApproval).not.toHaveBeenCalled();
    expect(mockGetPerpsSdk).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenLastCalledWith(
      'page.perps.regionNotSupport',
      'error',
    );
  });

  it('reports direction-specific TP validation through toast only', async () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setAmount('101'));
    act(() => hook.result.current.tpSl.setRawMagnitude('tp', '90'));
    act(() => hook.result.current.tpSl.setEnabled(true));
    await act(async () => hook.result.current.requestReview('buy'));

    expect(hook.result.current.tpSl).not.toHaveProperty('submitErrors');
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.trade.tpSlError.tpTriggerMoreThanOrderPrice',
      'error',
    );
  });

  it('allows a Long stop below estimated liquidation and keeps the estimate for review', async () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setAmount('101'));
    act(() => hook.result.current.tpSl.setRawMagnitude('sl', '40'));
    act(() => hook.result.current.tpSl.setEnabled(true));
    await act(async () => hook.result.current.requestReview('buy'));

    expect(hook.result.current.tpSl).not.toHaveProperty('submitErrors');
    expect(mockShowToast).not.toHaveBeenCalled();
    expect(hook.result.current.review).toMatchObject({
      attached: {
        liquidationPrice: '50.00',
        sl: { triggerPrice: '40' },
      },
      reviewFacts: { liquidationPrice: '50.00' },
      type: 'openOrderWithAttachedTpSl',
    });
  });

  it('submits attached TP/SL Limit directly when Limit confirmation is disabled', async () => {
    mockGetSkipConfirmation.mockResolvedValueOnce(true);
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setAmount('50'));
    act(() => hook.result.current.setOrderType('limit'));
    act(() => hook.result.current.setPrice('limitPrice', '100'));
    act(() => hook.result.current.setAmount('100'));
    act(() => hook.result.current.tpSl.setRawMagnitude('tp', '110'));
    act(() => hook.result.current.tpSl.setEnabled(true));
    await act(async () => hook.result.current.requestReview('buy'));

    expect(mockGetSkipConfirmation).toHaveBeenCalledWith('limit');
    expect(mockExecuteAttached).toHaveBeenCalledTimes(1);
    expect(hook.result.current.review).toBeNull();
    expect(mockSetSkipConfirmation).not.toHaveBeenCalled();
    act(() => hook.result.current.setOrderType('market'));
    expect(hook.result.current.form.amount).toBe('');
  });

  it('hides Slider conversion and resets Amount plus Slider on market change', () => {
    const hook = renderHook(
      ({ currentMarket }: { currentMarket: PerpsProMarket }) =>
        usePerpsProTrade({
          activeAssetData,
          bboBook: book,
          bboPrices: {
            asks1: '101',
            asks5: null,
            bids1: '99',
            bids5: null,
          },
          bboSessionKey: 'BTC:1',
          bboStatus: 'ready',
          executionActive: true,
          leveragePending: false,
          market: currentMarket,
          refreshActiveAssetData: jest.fn(async () => undefined),
          updateLeverageRequest: jest.fn(async () => true),
        }),
      { initialProps: { currentMarket: market } },
    );

    act(() => hook.result.current.setAmount('100'));
    expect(hook.result.current.showAmountConversion).toBe(true);
    act(() => hook.result.current.setOrderType('limit'));
    act(() => hook.result.current.setAmount('25'));
    act(() => hook.result.current.setOrderType('market'));
    expect(hook.result.current.form.amount).toBe('');
    act(() => hook.result.current.setPercentage(50));
    expect(hook.result.current.percentage).toBe(50);
    expect(hook.result.current.form.amount).toBe('50%');
    expect(hook.result.current.showAmountConversion).toBe(false);

    hook.rerender({
      currentMarket: {
        ...market,
        canonicalCoin: 'ETH',
        displayBase: 'ETH',
        displayPair: 'ETHUSDC',
        marketKey: 'hyperliquid::ETH',
      },
    });

    expect(hook.result.current.percentage).toBe(0);
    expect(hook.result.current.form.amount).toBe('');
    expect(hook.result.current.resolvedAmount).toBeNull();
    expect(hook.result.current.showAmountConversion).toBe(false);

    act(() => hook.result.current.setOrderType('limit'));
    expect(hook.result.current.form.amount).toBe('');
    expect(hook.result.current.percentage).toBe(0);
  });

  it('rejects a Conditional review when the latest Mid changes classification', async () => {
    const hook = renderHook(
      ({ currentMarket }: { currentMarket: PerpsProMarket }) =>
        usePerpsProTrade({
          activeAssetData,
          bboBook: book,
          bboPrices: {
            asks1: '101',
            asks5: null,
            bids1: '99',
            bids5: null,
          },
          bboSessionKey: 'BTC:1',
          bboStatus: 'ready',
          executionActive: true,
          leveragePending: false,
          market: currentMarket,
          refreshActiveAssetData: jest.fn(async () => undefined),
          updateLeverageRequest: jest.fn(async () => true),
        }),
      { initialProps: { currentMarket: market } },
    );

    act(() => hook.result.current.setOrderType('conditional'));
    act(() => hook.result.current.setAmount('100'));
    act(() => hook.result.current.setPrice('triggerPrice', '110'));
    await act(async () => hook.result.current.requestReview('buy'));
    expect(hook.result.current.review).toMatchObject({
      execution: { kind: 'conditionalMarket', tpsl: 'sl' },
    });

    hook.rerender({
      currentMarket: {
        ...market,
        marketData: { ...market.marketData, midPx: '120' },
      },
    });
    await act(async () => hook.result.current.confirmReview());

    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.trade.contextChanged',
      'error',
    );
    expect(mockGetPerpsSdk).not.toHaveBeenCalled();
    expect(hook.result.current.review).toBeNull();
  });

  it('does not use Mark Price as a Conditional classification fallback', async () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market: {
          ...market,
          marketData: { ...market.marketData, midPx: '' },
        },
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setOrderType('conditional'));
    act(() => hook.result.current.setAmount('100'));
    act(() => hook.result.current.setPrice('triggerPrice', '110'));
    await act(async () => hook.result.current.requestReview('buy'));

    expect(hook.result.current.review).toBeNull();
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.trade.contextChanged',
      'error',
    );
  });

  it('executes ordinary Review with its frozen margin mode and leverage', async () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setAmount('100'));
    await act(async () => hook.result.current.requestReview('buy'));
    expect(hook.result.current.review).toMatchObject({
      reviewFacts: {
        generatedAt: expect.any(Number),
        leverage: 10,
        marginMode: 'isolated',
        markPrice: '100',
        marketFillRiskEntryPrice: '101',
        midPrice: '100',
      },
    });
    await act(async () => {
      await hook.result.current.setMarginMode('cross');
    });
    await act(async () => hook.result.current.confirmReview());

    expect(mockBuildUpdateLeverage).not.toHaveBeenCalled();
  });

  it('invalidates a fallback Review when preflight recovers the user configuration', async () => {
    const refreshActiveAssetData = jest.fn(async () => ({
      ...activeAssetData,
      leverage: { type: 'isolated', value: 4 },
    }));
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData: {
          ...activeAssetData,
          leverage: undefined,
        } as never,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        zeroAddressLeverageBaseline: { type: 'cross', value: 7 },
        refreshActiveAssetData,
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setAmount('100'));
    await act(async () => hook.result.current.requestReview('buy'));
    expect(hook.result.current.review?.reviewFacts).toMatchObject({
      leverage: 7,
      marginMode: 'cross',
    });

    await act(async () => hook.result.current.confirmReview());

    expect(refreshActiveAssetData).toHaveBeenCalledTimes(1);
    expect(mockBuildUpdateLeverage).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.trade.contextChanged',
      'error',
    );
    expect(hook.result.current.review).toBeNull();
  });

  it('invalidates an old Review instead of overwriting a newer server configuration', async () => {
    const hook = renderHook(
      ({ data }: { data: typeof activeAssetData }) =>
        usePerpsProTrade({
          activeAssetData: data,
          bboBook: book,
          bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
          bboSessionKey: 'BTC:1',
          bboStatus: 'ready',
          executionActive: true,
          leveragePending: false,
          market,
          refreshActiveAssetData: jest.fn(async () => undefined),
          updateLeverageRequest: jest.fn(async () => true),
        }),
      { initialProps: { data: activeAssetData } },
    );

    act(() => hook.result.current.setAmount('100'));
    await act(async () => hook.result.current.requestReview('buy'));
    expect(hook.result.current.review?.reviewFacts.leverage).toBe(10);

    hook.rerender({
      data: {
        ...activeAssetData,
        leverage: { type: 'isolated' as const, value: 4 },
      },
    });
    await act(async () => hook.result.current.confirmReview());

    expect(mockBuildUpdateLeverage).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.trade.contextChanged',
      'error',
    );
    expect(hook.result.current.review).toBeNull();
  });

  it('uses directional full-L2 VWAP for ordinary Market risk and cost', () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setAmount('100'));
    expect(hook.result.current.getEstimatedLiquidationPrice('buy')).toBe(
      '50.00',
    );
    expect(mockCalLiquidationPrice).toHaveBeenLastCalledWith(
      101,
      10.1,
      'Long',
      1,
      101,
      20,
    );
    expect(hook.result.current.getCostDisplayAmount('buy')).toBe('10.10');

    expect(hook.result.current.getEstimatedLiquidationPrice('sell')).toBe(
      '50.00',
    );
    expect(mockCalLiquidationPrice).toHaveBeenLastCalledWith(
      99,
      9.9,
      'Short',
      1,
      99,
      20,
    );
    expect(hook.result.current.getCostDisplayAmount('sell')).toBe('9.90');
  });

  it('allows ordinary Market submission with Mid while L2 risk fails closed', async () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: null,
        bboPrices: { asks1: null, asks5: null, bids1: null, bids5: null },
        bboSessionKey: null,
        bboStatus: 'loading',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setAmount('100'));
    expect(hook.result.current.getEstimatedLiquidationPrice('buy')).toBe('--');
    expect(hook.result.current.getCostDisplayAmount('buy')).toBe('10.00');

    await act(async () => hook.result.current.requestReview('buy'));
    expect(hook.result.current.review).toMatchObject({
      baseSize: '1',
      execution: {
        kind: 'market',
        slippageReferenceMidPrice: '100',
      },
      quoteAmount: '100',
      reviewFacts: { marketFillRiskEntryPrice: null },
    });
    expect(hook.result.current.estimatedLiquidation).toBeNull();
  });

  it('fails an attached Market review when full L2 coverage is unavailable', async () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: {
          asks1: '101',
          asks5: null,
          bids1: '99',
          bids5: null,
        },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );
    act(() => hook.result.current.setAmount('2000'));
    act(() => hook.result.current.tpSl.setRawMagnitude('tp', '110'));
    act(() => hook.result.current.tpSl.setEnabled(true));
    await act(async () => hook.result.current.requestReview('buy'));

    expect(hook.result.current.review).toBeNull();
    expect(hook.result.current.tpSl).not.toHaveProperty('submitErrors');
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.trade.tpSlError.insufficientDepth',
      'error',
    );
    expect(mockEnsureApproval).not.toHaveBeenCalled();
  });

  it.each([
    ['childRejected', 'attachedTpSlChildRejected'],
    ['partialOutcome', 'attachedTpSlPartial'],
  ] as const)(
    'preserves the draft and reports %s without an overall success',
    async (kind, messageKey) => {
      mockExecuteAttached.mockResolvedValueOnce({
        kind,
        reconciliationErrors: [],
        refreshErrors: [],
      });
      const hook = renderHook(() =>
        usePerpsProTrade({
          activeAssetData,
          bboBook: book,
          bboPrices: {
            asks1: '101',
            asks5: null,
            bids1: '99',
            bids5: null,
          },
          bboSessionKey: 'BTC:1',
          bboStatus: 'ready',
          executionActive: true,
          leveragePending: false,
          market,
          refreshActiveAssetData: jest.fn(async () => undefined),
          updateLeverageRequest: jest.fn(async () => true),
        }),
      );
      act(() => hook.result.current.setAmount('101'));
      act(() => hook.result.current.tpSl.setRawMagnitude('tp', '110'));
      act(() => hook.result.current.tpSl.setEnabled(true));
      await act(async () => hook.result.current.requestReview('buy'));

      await act(async () => hook.result.current.confirmReview());

      expect(hook.result.current.review).toBeNull();
      expect(hook.result.current.form.attachedTpSl).toMatchObject({
        enabled: true,
        tp: { rawMagnitude: '110' },
      });
      expect(mockShowToast).toHaveBeenCalledWith(
        `page.perps.pro.trade.${messageKey}`,
        'error',
      );
      expect(mockShowToast).not.toHaveBeenCalledWith(
        'page.perps.pro.trade.attachedTpSlSubmitted',
        'success',
      );
    },
  );

  it('persists a Trade leverage confirmation immediately through the shared updater', async () => {
    const updateLeverageRequest = jest.fn(async () => true);
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: {
          asks1: '101',
          asks5: null,
          bids1: '99',
          bids5: null,
        },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest,
      }),
    );

    await act(async () => {
      expect(await hook.result.current.confirmLeverage(15)).toBe(true);
    });

    expect(updateLeverageRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        coin: 'BTC',
        currentLeverage: 10,
        isCross: false,
        leverage: 15,
        maxLeverage: 20,
      }),
    );
    expect(hook.result.current.leverage).toBe(15);
  });

  it('uses current-account Active Asset before zero-address and keeps Max as fallback', () => {
    const baseline = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        zeroAddressLeverageBaseline: { type: 'cross', value: 7 },
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );
    const fallback = renderHook(() =>
      usePerpsProTrade({
        activeAssetData: null,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    expect(baseline.result.current.leverage).toBe(10);
    expect(baseline.result.current.marginMode).toBe('isolated');
    expect(fallback.result.current.leverage).toBe(20);
  });

  it('never renders the prior market configuration under a new market scope', () => {
    const frames: Array<{
      coin: string | undefined;
      leverage: number;
      marginMode: 'cross' | 'isolated';
    }> = [];
    const suiMarket = {
      ...market,
      canonicalCoin: 'SUI',
      displayBase: 'SUI',
      displayPair: 'SUIUSDC',
      marketData: { ...market.marketData, maxLeverage: 10 },
      marketKey: 'hyperliquid::SUI',
    };
    const hook = renderHook(
      ({
        currentMarket,
        zeroAddressLeverageBaseline,
      }: {
        currentMarket: PerpsProMarket;
        zeroAddressLeverageBaseline: {
          type: 'cross' | 'isolated';
          value: number;
        };
      }) => {
        const controller = usePerpsProTrade({
          activeAssetData,
          bboBook: book,
          bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
          bboSessionKey: 'BTC:1',
          bboStatus: 'ready',
          executionActive: true,
          leveragePending: false,
          market: currentMarket,
          zeroAddressLeverageBaseline,
          refreshActiveAssetData: jest.fn(async () => undefined),
          updateLeverageRequest: jest.fn(async () => true),
        });
        frames.push({
          coin: controller.market?.canonicalCoin,
          leverage: controller.leverage,
          marginMode: controller.marginMode,
        });
        return controller;
      },
      {
        initialProps: {
          currentMarket: market,
          zeroAddressLeverageBaseline: {
            type: 'isolated' as const,
            value: 7,
          },
        },
      },
    );

    expect(hook.result.current.marginMode).toBe('isolated');
    hook.rerender({
      currentMarket: suiMarket,
      zeroAddressLeverageBaseline: { type: 'cross', value: 10 },
    });

    expect(frames.filter(frame => frame.coin === 'SUI')).toEqual(
      expect.arrayContaining([
        { coin: 'SUI', leverage: 10, marginMode: 'cross' },
      ]),
    );
    expect(
      frames.some(
        frame =>
          frame.coin === 'SUI' &&
          (frame.leverage !== 10 || frame.marginMode !== 'cross'),
      ),
    ).toBe(false);
  });

  it('returns to the current server configuration instead of a process-session copy', async () => {
    const suiMarket = {
      ...market,
      canonicalCoin: 'SUI',
      displayBase: 'SUI',
      displayPair: 'SUIUSDC',
      marketData: { ...market.marketData, maxLeverage: 10 },
      marketKey: 'hyperliquid::SUI',
    };
    const hook = renderHook(
      ({ currentMarket }: { currentMarket: PerpsProMarket }) =>
        usePerpsProTrade({
          activeAssetData,
          bboBook: book,
          bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
          bboSessionKey: 'BTC:1',
          bboStatus: 'ready',
          executionActive: true,
          leveragePending: false,
          market: currentMarket,
          zeroAddressLeverageBaseline: { type: 'isolated', value: 7 },
          refreshActiveAssetData: jest.fn(async () => undefined),
          updateLeverageRequest: jest.fn(async () => true),
        }),
      { initialProps: { currentMarket: market } },
    );

    await act(async () => {
      expect(await hook.result.current.confirmLeverage(15)).toBe(true);
    });
    expect(hook.result.current.leverage).toBe(15);

    hook.rerender({ currentMarket: suiMarket });
    expect(hook.result.current.leverage).toBe(7);

    hook.rerender({ currentMarket: market });
    expect(hook.result.current.leverage).toBe(10);
  });

  it('uses the existing position leverage before the zero-address baseline', () => {
    mockPerpsState.currentClearinghouseState.assetPositions.push({
      position: {
        coin: 'BTC',
        leverage: { type: 'isolated', value: 6 },
        szi: '1',
      },
    } as never);
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        zeroAddressLeverageBaseline: { type: 'cross', value: 7 },
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    expect(hook.result.current.leverage).toBe(6);
    expect(hook.result.current.marginMode).toBe('isolated');
    mockPerpsState.currentClearinghouseState.assetPositions.length = 0;
  });

  it('shows an isolated-only reason instead of the exposure toast', async () => {
    const isolatedOnlyMarket = {
      ...market,
      canonicalCoin: 'xyz:KIOXIA',
      marketData: {
        ...market.marketData,
        dexId: 'xyz',
        marginMode: 'noCross' as const,
        onlyIsolated: true,
      },
      marketKey: 'xyz::xyz:KIOXIA',
    };
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData: null,
        bboBook: null,
        bboPrices: { asks1: null, asks5: null, bids1: null, bids5: null },
        bboSessionKey: null,
        bboStatus: 'idle',
        executionActive: true,
        leveragePending: false,
        market: isolatedOnlyMarket,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    expect(hook.result.current.marginMode).toBe('isolated');
    await act(async () => {
      await hook.result.current.setMarginMode('cross');
    });
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.trade.onlyIsolatedMargin',
      'error',
    );
    expect(hook.result.current.marginMode).toBe('isolated');
  });

  it('keeps the position/open-order toast for an existing exposure', async () => {
    mockPerpsState.currentClearinghouseState.assetPositions.push({
      position: {
        coin: 'BTC',
        leverage: { type: 'cross', value: 10 },
        szi: '1',
      },
    } as never);
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    expect(hook.result.current.marginMode).toBe('cross');
    await act(async () => {
      await hook.result.current.setMarginMode('isolated');
    });
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.trade.marginModeUnavailable',
      'error',
    );
    expect(hook.result.current.marginMode).toBe('cross');
  });

  it('uses Unified available-after-maintenance for NVDA Cross risk', () => {
    mockPerpsState.userAbstraction = 'unifiedAccount';
    mockPerpsState.spotState.tokenToAvailableAfterMaintenance = [
      [0, '35.08059422'],
    ];
    const nvdaMarket = {
      ...market,
      canonicalCoin: 'xyz:NVDA',
      displayBase: 'NVDA',
      displayPair: 'NVDAUSDC',
      marketData: {
        ...market.marketData,
        dexId: 'xyz',
        markPx: '223.88',
        midPx: '223.88',
        szDecimals: 3,
      },
      marketKey: 'xyz::xyz:NVDA',
    };
    const nvdaBook = {
      ...book,
      coin: 'xyz:NVDA',
      levels: [
        [{ n: 1, px: '223.87', sz: '10' }],
        [{ n: 1, px: '223.89', sz: '10' }],
      ],
    } as L2Book;
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData: {
          ...activeAssetData,
          availableToTrade: ['34.211138', '34.211138'],
          coin: 'xyz:NVDA',
          leverage: { type: 'cross', value: 20 },
          markPx: '223.88',
          maxTradeSzs: ['3.056', '3.056'],
        },
        bboBook: nvdaBook,
        bboPrices: {
          asks1: '223.89',
          asks5: null,
          bids1: '223.87',
          bids5: null,
        },
        bboSessionKey: 'xyz:NVDA:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market: nvdaMarket,
        zeroAddressLeverageBaseline: { type: 'cross', value: 20 },
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setOrderType('conditional'));
    act(() => hook.result.current.setPercentage(37));
    expect(hook.result.current.getEstimatedLiquidationPrice('buy')).toBe(
      '50.00',
    );
    expect(mockCalLiquidationPrice).toHaveBeenLastCalledWith(
      223.88,
      35.08059422,
      'Long',
      1.13,
      252.9844,
      20,
    );
  });

  it('replaces current BTC-USDE maintenance in Unified Cross projections', () => {
    mockPerpsState.userAbstraction = 'unifiedAccount';
    mockPerpsState.spotState.tokenToAvailableAfterMaintenance = [
      [235, '82.79'],
    ];
    mockPerpsState.currentClearinghouseState.assetPositions.push({
      position: {
        coin: 'hyna:BTC',
        entryPx: '64169',
        leverage: { type: 'cross', value: 12 },
        marginUsed: '15.39',
        positionValue: '-184.59165',
        szi: '-0.00285',
      },
    } as never);
    const usdeMarket = {
      ...market,
      canonicalCoin: 'hyna:BTC',
      displayPair: 'BTCUSDE',
      marketData: {
        ...market.marketData,
        dexId: 'hyna',
        markPx: '64769',
        maxLeverage: 40,
        midPx: '64769',
        pxDecimals: 0,
        szDecimals: 5,
      },
      marketKey: 'hyna::hyna:BTC',
      quoteAsset: 'USDE',
    } as PerpsProMarket;
    const usdeBook = {
      coin: 'hyna:BTC',
      levels: [
        [{ n: 1, px: '64769', sz: '10' }],
        [{ n: 1, px: '64770', sz: '10' }],
      ],
      time: 123,
    } as L2Book;
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData: {
          ...activeAssetData,
          availableToTrade: ['1205.36', '836.17'],
          coin: 'hyna:BTC',
          leverage: { type: 'cross', value: 12 },
          markPx: '64769',
          maxTradeSzs: ['0.01861', '0.01291'],
        },
        bboBook: usdeBook,
        bboPrices: {
          asks1: '64770',
          asks5: null,
          bids1: '64769',
          bids5: null,
        },
        bboSessionKey: 'hyna:BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market: usdeMarket,
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    act(() => hook.result.current.setPercentage(43));
    expect(hook.result.current.getEstimatedLiquidationPrice('buy')).toBe('50');
    expect(mockCalLiquidationPrice).toHaveBeenLastCalledWith(
      64770,
      85.097395625,
      'Long',
      0.00515,
      333.5655,
      40,
    );

    expect(hook.result.current.getEstimatedLiquidationPrice('sell')).toBe('50');
    expect(mockCalLiquidationPrice).toHaveBeenLastCalledWith(
      64565.42857142857,
      85.097395625,
      'Short',
      0.0084,
      542.3496,
      40,
    );
  });

  it('uses live Mark for Conditional Market liquidation before Trigger Price input', () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        zeroAddressLeverageBaseline: { type: 'isolated', value: 10 },
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    expect(hook.result.current.getEstimatedLiquidationPrice('buy')).toBeNull();
    act(() => hook.result.current.setOrderType('conditional'));
    act(() => hook.result.current.setPercentage(50));
    expect(hook.result.current.form.triggerPrice).toBe('');
    expect(hook.result.current.form.amount).toBe('50%');
    expect(hook.result.current.getEstimatedLiquidationPrice('buy')).toBe(
      '50.00',
    );

    act(() => hook.result.current.setPrice('triggerPrice', '110'));
    expect(hook.result.current.getEstimatedLiquidationPrice('buy')).toBe(
      '50.00',
    );
  });

  it('does not carry an applied leverage override across accounts', async () => {
    const hook = renderHook(() =>
      usePerpsProTrade({
        activeAssetData,
        bboBook: book,
        bboPrices: { asks1: '101', asks5: null, bids1: '99', bids5: null },
        bboSessionKey: 'BTC:1',
        bboStatus: 'ready',
        executionActive: true,
        leveragePending: false,
        market,
        zeroAddressLeverageBaseline: { type: 'cross', value: 7 },
        refreshActiveAssetData: jest.fn(async () => undefined),
        updateLeverageRequest: jest.fn(async () => true),
      }),
    );

    await act(async () => {
      await hook.result.current.confirmLeverage(15);
    });
    expect(hook.result.current.leverage).toBe(15);

    mockPerpsState.currentPerpsAccount = {
      ...mockAccount,
      address: '0x0000000000000000000000000000000000000002',
    };
    hook.rerender(undefined);
    expect(hook.result.current.leverage).toBe(7);

    mockPerpsState.currentPerpsAccount = mockAccount;
  });
});
