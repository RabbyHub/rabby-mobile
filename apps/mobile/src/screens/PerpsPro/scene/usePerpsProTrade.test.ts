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
  },
  currentPerpsAccount: mockAccount,
  isUserDataReady: true,
  openOrders: [],
};
const mockGetSkipConfirmation = jest.fn(async () => true);
const mockSetSkipConfirmation = jest.fn(async () => undefined);
const mockEnsureApproval = jest.fn(async () => undefined);
const mockGetPerpsSdk = jest.fn();
const mockShowToast = jest.fn();
const mockExecuteAttached = jest.fn(async () => ({
  kind: 'fullAccepted' as const,
  reconciliationErrors: [],
  refreshErrors: [],
}));

jest.mock('@/core/apis/perps', () => ({
  apisPerps: { getPerpsSDK: mockGetPerpsSdk },
}));

jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {
    getSkipPerpsProTradeConfirmation: mockGetSkipConfirmation,
    setSkipPerpsProTradeConfirmation: mockSetSkipConfirmation,
  },
}));

jest.mock('@/hooks/perps/actions/actionError', () => ({
  isPerpsActionUserCancelled: () => false,
}));

jest.mock('@/hooks/perps/actions/perpsActionApproval', () => ({
  ensurePerpsActionApproval: mockEnsureApproval,
}));

jest.mock('@/hooks/perps/actions/updateLeverage', () => ({
  buildPerpsUpdateLeverageCommand: jest.fn(),
  executePerpsUpdateLeverage: jest.fn(),
}));

jest.mock('@/hooks/perps/showToast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
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
  calLiquidationPrice: () => 50,
  isPerpsMarketIsolatedOnly: ({ marginMode, onlyIsolated }: any) =>
    marginMode === 'noCross' ||
    marginMode === 'strictIsolated' ||
    (!marginMode && !!onlyIsolated),
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
    mockPerpsState.isUserDataReady = true;
  });

  it('keeps Limit prices empty until an explicit current-market selection', () => {
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
    act(() => hook.result.current.setOrderType('limit'));
    expect(hook.result.current.form.limitPrice).toBe('');

    act(() =>
      hook.result.current.selectManualLimitPrice('101.234', market.marketKey),
    );
    expect(hook.result.current.form.limitPrice).toBe('101.23');

    act(() => hook.result.current.patchForm({ bboEnabled: true }));
    act(() =>
      hook.result.current.selectManualLimitPrice('99', market.marketKey),
    );
    expect(hook.result.current.form.limitPrice).toBe('101.23');
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

  it('preserves a quote source through lossy base-unit round trips', () => {
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
    expect(hook.result.current.form.amount).toBe('3.17');

    act(() => hook.result.current.toggleAmountUnit());
    expect(hook.result.current.form.amountUnit).toBe('quote');
    expect(hook.result.current.form.amount).toBe('200');
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
      parent: { baseSize: '1', quoteAmount: '101', side: 'buy' },
      type: 'openOrderWithAttachedTpSl',
    });
    expect(mockGetSkipConfirmation).not.toHaveBeenCalled();

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
    expect(hook.result.current.tpSl.submitErrors).toEqual([
      { code: 'insufficientDepth' },
    ]);
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

  it('uses the zero-address baseline for a new position and keeps Max as fallback', () => {
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

    expect(baseline.result.current.leverage).toBe(7);
    expect(baseline.result.current.marginMode).toBe('cross');
    expect(fallback.result.current.leverage).toBe(20);
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

  it('shows live liquidation only for a valid non-reduce amount', () => {
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
    act(() => hook.result.current.setAmount('100'));
    expect(hook.result.current.getEstimatedLiquidationPrice('buy')).toBe(
      '50.00',
    );
    act(() => hook.result.current.setOrderType('conditional'));
    expect(hook.result.current.getEstimatedLiquidationPrice('buy')).toBe('--');
    act(() => hook.result.current.patchForm({ reduceOnly: true }));
    expect(hook.result.current.form.reduceOnly).toBe(false);
    expect(hook.result.current.getEstimatedLiquidationPrice('buy')).toBe('--');
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
