import type {
  UserHistoricalOrders,
  WsFill,
} from '@rabby-wallet/hyperliquid-sdk';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

const mockFetchOrders = jest.fn();
const mockFetchLatestTrades = jest.fn();
const mockFetchTradesWindow = jest.fn();
const mockFetchTransactionsWindow = jest.fn();
const mockFetchFundingWindow = jest.fn();
const mockSubscribeOrders = jest.fn(() => jest.fn());
const mockSubscribeFunding = jest.fn(() => jest.fn());
const mockShowToast = jest.fn();
let mockHistoryListener: ((event: any) => void) | null = null;
let mockIsFocused = true;

const mockPerpsState = {
  currentPerpsAccount: {
    address: '0x1111111111111111111111111111111111111111',
    type: 'SimpleKeyring',
  },
  isInitialized: true,
  marketDataMap: {},
};

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockIsFocused,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/hooks/perps/showToast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

jest.mock('@/hooks/perps/history/perpsHistoryEvents', () => ({
  subscribePerpsProHistoryEvents: jest.fn((listener: (event: any) => void) => {
    mockHistoryListener = listener;
    return () => {
      if (mockHistoryListener === listener) {
        mockHistoryListener = null;
      }
    };
  }),
}));

jest.mock('@/hooks/perps/usePerpsStore', () => {
  const perpsStore = Object.assign(
    (selector: (state: typeof mockPerpsState) => unknown) =>
      selector(mockPerpsState),
    {
      getState: () => mockPerpsState,
    },
  );
  return {
    getPerpsAccountRuntimeContext: () => ({
      account: mockPerpsState.currentPerpsAccount,
      generation: 1,
      isInitialized: true,
    }),
    perpsStore,
  };
});

jest.mock('../repository/perpsProHistoryRepository', () => ({
  isPerpsProHistorySdkSupported: () => true,
  perpsProHistoryRepository: {
    fetchFundingWindow: (...args: unknown[]) => mockFetchFundingWindow(...args),
    fetchLatestTrades: (...args: unknown[]) => mockFetchLatestTrades(...args),
    fetchOrders: (...args: unknown[]) => mockFetchOrders(...args),
    fetchTradesWindow: (...args: unknown[]) => mockFetchTradesWindow(...args),
    fetchTransactionsWindow: (...args: unknown[]) =>
      mockFetchTransactionsWindow(...args),
    subscribeFunding: (...args: unknown[]) => mockSubscribeFunding(...args),
    subscribeOrders: (...args: unknown[]) => mockSubscribeOrders(...args),
  },
}));

import { usePerpsProHistoryController } from './usePerpsProHistoryController';

const makeOrder = (oid = 1, statusTimestamp = 100): UserHistoricalOrders => ({
  order: {
    children: [],
    cloid: null,
    coin: 'BTC',
    isPositionTpsl: false,
    isTrigger: false,
    limitPx: '50000',
    oid,
    orderType: 'Limit',
    origSz: '1',
    reduceOnly: false,
    side: 'B',
    sz: '0',
    tif: 'Gtc',
    timestamp: statusTimestamp - 10,
    triggerCondition: '',
    triggerPx: '0',
  },
  status: 'filled',
  statusTimestamp,
});

const makeFill = (overrides: Partial<WsFill> = {}): WsFill => ({
  closedPnl: '0',
  coin: 'BTC',
  crossed: true,
  dir: 'Open Long',
  fee: '0.1',
  hash: '0xfill',
  oid: 1,
  px: '50000',
  side: 'B',
  startPosition: '0',
  sz: '0.01',
  tid: 1,
  time: 100,
  ...overrides,
});

describe('usePerpsProHistoryController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHistoryListener = null;
    mockIsFocused = true;
    mockPerpsState.currentPerpsAccount = {
      address: '0x1111111111111111111111111111111111111111',
      type: 'SimpleKeyring',
    };
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({
      remove: jest.fn(),
    } as ReturnType<typeof AppState.addEventListener>);
    mockFetchOrders.mockResolvedValue([]);
    mockFetchLatestTrades.mockResolvedValue([]);
    mockFetchTransactionsWindow.mockReset();
    mockFetchFundingWindow.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads Orders by default and distinguishes a successful empty result', async () => {
    const hook = renderHook(() => usePerpsProHistoryController());
    await waitFor(() => expect(mockFetchOrders).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(hook.result.current.tabState.status).toBe('empty'),
    );
    expect(hook.result.current.activeTab).toBe('orders');
    expect(hook.result.current.tabState.hasEarlier).toBe(false);
  });

  it('drops a late Orders response after switching to Trade', async () => {
    let resolveOrders: (orders: UserHistoricalOrders[]) => void = () =>
      undefined;
    mockFetchOrders.mockReturnValueOnce(
      new Promise<UserHistoricalOrders[]>(resolve => {
        resolveOrders = resolve;
      }),
    );
    const hook = renderHook(() => usePerpsProHistoryController());
    await waitFor(() => expect(mockFetchOrders).toHaveBeenCalledTimes(1));

    act(() => hook.result.current.setActiveTab('trade'));
    await waitFor(() =>
      expect(hook.result.current.state.trade.status).toBe('empty'),
    );
    await act(async () => resolveOrders([makeOrder()]));

    expect(hook.result.current.state.orders).toMatchObject({
      rows: [],
      status: 'idle',
    });
    expect(hook.result.current.activeTab).toBe('trade');
  });

  it('merges global fill events without replacing the HTTP baseline', async () => {
    mockFetchLatestTrades.mockResolvedValueOnce([makeFill({ time: 100 })]);
    const hook = renderHook(() => usePerpsProHistoryController('trade'));
    await waitFor(() =>
      expect(hook.result.current.tabState.status).toBe('ready'),
    );
    expect(mockHistoryListener).not.toBeNull();

    act(() => {
      mockHistoryListener?.({
        accountAddress: mockPerpsState.currentPerpsAccount.address,
        isSnapshot: true,
        items: [makeFill({ tid: 2, time: 200 })],
        kind: 'fills',
      });
    });

    expect(hook.result.current.tabState.rows.map(row => row.time)).toEqual([
      200, 100,
    ]);
  });

  it('reconciles a cached tab after leaving and returning to it', async () => {
    mockFetchLatestTrades
      .mockResolvedValueOnce([makeFill({ time: 100 })])
      .mockResolvedValueOnce([makeFill({ tid: 2, time: 200 })]);
    const hook = renderHook(() => usePerpsProHistoryController('trade'));
    await waitFor(() =>
      expect(hook.result.current.tabState.status).toBe('ready'),
    );

    act(() => hook.result.current.setActiveTab('orders'));
    await waitFor(() =>
      expect(hook.result.current.state.orders.status).toBe('empty'),
    );
    act(() => hook.result.current.setActiveTab('trade'));

    await waitFor(() => expect(mockFetchLatestTrades).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(hook.result.current.tabState.rows.map(row => row.time)).toEqual([
        200, 100,
      ]),
    );
  });

  it('clears the previous account and starts a baseline for the new account', async () => {
    mockFetchOrders
      .mockResolvedValueOnce([makeOrder(1, 100)])
      .mockResolvedValueOnce([makeOrder(2, 200)]);
    const hook = renderHook(() => usePerpsProHistoryController());
    await waitFor(() =>
      expect(hook.result.current.tabState.rows[0]).toMatchObject({ oid: 1 }),
    );

    mockPerpsState.currentPerpsAccount = {
      address: '0x2222222222222222222222222222222222222222',
      type: 'SimpleKeyring',
    };
    hook.rerender({});

    await waitFor(() => expect(mockFetchOrders).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(hook.result.current.tabState.rows).toEqual([
        expect.objectContaining({ oid: 2 }),
      ]),
    );
  });

  it('revalidates the active tab after route focus returns', async () => {
    mockFetchLatestTrades
      .mockResolvedValueOnce([makeFill({ time: 100 })])
      .mockResolvedValueOnce([makeFill({ tid: 2, time: 200 })]);
    const hook = renderHook(() => usePerpsProHistoryController('trade'));
    await waitFor(() =>
      expect(hook.result.current.tabState.status).toBe('ready'),
    );

    mockIsFocused = false;
    hook.rerender({});
    await waitFor(() => expect(mockHistoryListener).toBeNull());
    mockIsFocused = true;
    hook.rerender({});

    await waitFor(() => expect(mockFetchLatestTrades).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(hook.result.current.tabState.rows.map(row => row.time)).toEqual([
        200, 100,
      ]),
    );
  });

  it('does not issue duplicate requests for a repeated refresh gesture', async () => {
    let resolveRefresh: (fills: WsFill[]) => void = () => undefined;
    mockFetchLatestTrades
      .mockResolvedValueOnce([makeFill({ time: 100 })])
      .mockReturnValueOnce(
        new Promise<WsFill[]>(resolve => {
          resolveRefresh = resolve;
        }),
      );
    const hook = renderHook(() => usePerpsProHistoryController('trade'));
    await waitFor(() =>
      expect(hook.result.current.tabState.status).toBe('ready'),
    );

    let firstRefresh: Promise<void> = Promise.resolve();
    let secondRefresh: Promise<void> = Promise.resolve();
    act(() => {
      firstRefresh = hook.result.current.refresh();
      secondRefresh = hook.result.current.refresh();
    });

    expect(mockFetchLatestTrades).toHaveBeenCalledTimes(2);
    await act(async () => {
      resolveRefresh([makeFill({ tid: 2, time: 200 })]);
      await Promise.all([firstRefresh, secondRefresh]);
    });
    expect(mockFetchLatestTrades).toHaveBeenCalledTimes(2);
  });

  it('keeps existing rows and shows the approved Toast on refresh failure', async () => {
    mockFetchLatestTrades
      .mockResolvedValueOnce([makeFill({ time: 100 })])
      .mockRejectedValueOnce(new Error('offline'));
    const hook = renderHook(() => usePerpsProHistoryController('trade'));
    await waitFor(() =>
      expect(hook.result.current.tabState.status).toBe('ready'),
    );

    await act(async () => hook.result.current.refresh());

    expect(hook.result.current.tabState.rows).toHaveLength(1);
    expect(hook.result.current.tabState.refreshing).toBe(false);
    expect(mockShowToast).toHaveBeenCalledWith(
      'page.perps.pro.history.refreshFailed',
      'error',
    );
  });

  it('advances an explicit Transaction window and stops on an empty window', async () => {
    const now = 6_000_000_000;
    const firstWindow = { endTime: now, startTime: now - 1000 };
    const earlierWindow = {
      endTime: firstWindow.startTime,
      startTime: now - 2000,
    };
    jest.spyOn(Date, 'now').mockReturnValue(now);
    mockFetchTransactionsWindow
      .mockResolvedValueOnce({
        completed: true,
        diagnostics: {
          excludedByReason: {
            ambiguousDirection: 0,
            excludedType: 0,
            invalidAmount: 0,
            spotOnly: 0,
          },
          visible: 1,
        },
        items: [
          {
            delta: { type: 'deposit', usdc: '1' },
            hash: '0xdeposit',
            time: now - 1,
          },
        ],
        requests: 1,
        stalled: false,
        truncated: false,
        window: firstWindow,
      })
      .mockResolvedValueOnce({
        completed: true,
        diagnostics: {
          excludedByReason: {
            ambiguousDirection: 0,
            excludedType: 0,
            invalidAmount: 0,
            spotOnly: 0,
          },
          visible: 0,
        },
        items: [],
        requests: 1,
        stalled: false,
        truncated: false,
        window: earlierWindow,
      });
    const hook = renderHook(() => usePerpsProHistoryController('transaction'));
    await waitFor(() =>
      expect(hook.result.current.tabState.hasEarlier).toBe(true),
    );

    await act(async () => hook.result.current.loadEarlier());

    expect(hook.result.current.tabState).toMatchObject({
      coveredWindow: {
        endTime: firstWindow.endTime,
        startTime: earlierWindow.startTime,
      },
      hasEarlier: false,
      rows: [expect.objectContaining({ kind: 'transaction' })],
    });
  });
});
