import 'reflect-metadata';
import { act, cleanupAsync, renderHook } from '@testing-library/react-native';
import type { Account } from '@/core/startupServices/preference';
import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import type { StorageAdapater } from '@rabby-wallet/persist-store';

jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));
jest.mock('@react-native-firebase/analytics', () => ({
  __esModule: true,
  default: () => ({
    logEvent: jest.fn(),
    setAnalyticsCollectionEnabled: jest.fn(),
  }),
}));
jest.mock('react-native-inappbrowser-reborn', () => ({ InAppBrowser: {} }));
jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({ current: null, isReady: () => false }),
  useIsFocused: () => true,
}));

jest.mock('@onekeyfe/hd-ble-sdk', () => ({}));
jest.mock('react-native-permissions', () => ({
  PERMISSIONS: { IOS: {}, ANDROID: {} },
  RESULTS: { GRANTED: 'granted' },
  checkMultiple: jest.fn(),
  requestMultiple: jest.fn(),
}));
jest.mock(
  '@safe-global/protocol-kit/dist/src/utils/eip-712',
  () => ({
    hashSafeMessage: () => {
      throw new Error('No signing in integration tests');
    },
  }),
  { virtual: true },
);

// Only the exchange/network transport is replaced. The API facade, Store,
// subscription/HTTP reconciliation and both Simple hooks all run unchanged.
jest.mock('@rabby-wallet/hyperliquid-sdk', () => {
  const actual = jest.requireActual('@rabby-wallet/hyperliquid-sdk');
  const subscribe = () => jest.fn(() => ({ unsubscribe: jest.fn() }));
  return {
    ...actual,
    HyperliquidSDK: class {
      info = {
        getFrontendOpenOrders: jest.fn(),
        getDelegatorSummary: jest.fn(async () => ({})),
      };
      exchange = { bindTpslByOrderId: jest.fn(), cancelOrder: jest.fn() };
      ws = {
        on: jest.fn(),
        disconnect: jest.fn(),
        subscribeToAllDexsAssetCtxs: subscribe(),
        subscribeToFastAssetCtxs: subscribe(),
        subscribeToAllDexsClearinghouseState: subscribe(),
        subscribeToSpotState: subscribe(),
        subscribeToOpenOrders: subscribe(),
        subscribeToUserFills: subscribe(),
        subscribeToUserNonFundingLedgerUpdates: subscribe(),
      };
    },
  };
});

let storeModule: typeof import('@/hooks/perps/usePerpsStore');
let usePerpsPosition: typeof import('./usePerpsPosition').usePerpsPosition;
let useSimplePositionTpSl: typeof import('./useSimplePositionTpSl').useSimplePositionTpSl;
type Sdk = ReturnType<typeof import('@/core/apis/perps').apisPerps.getPerpsSDK>;
let sdk: Sdk;
let originalState: ReturnType<typeof storeModule.perpsStore.getState>;
let unregisterService: (() => void) | undefined;
let nativeToastShow: jest.SpyInstance;

const account = {
  address: '0x00000000000000000000000000000000000000ab',
  brandName: 'Rabby',
  type: KEYRING_CLASS.PRIVATE_KEY,
} as Account;
const accountB = {
  ...account,
  address: '0x00000000000000000000000000000000000000bc',
};
const order = (
  oid: number,
  side: 'tp' | 'sl' = 'tp',
  coin = 'BTC',
): OpenOrder => ({
  coin,
  oid,
  orderType: side === 'tp' ? 'Take Profit Market' : 'Stop Market',
  triggerPx: side === 'tp' ? '110' : '90',
  isTrigger: true,
  isPositionTpsl: true,
  reduceOnly: true,
  origSz: '0',
  sz: '0',
  limitPx: '100',
  side: 'A',
  tif: null,
  timestamp: oid,
  triggerCondition: '',
});
const response = (statuses: unknown[]) => ({
  status: 'ok',
  response: { type: 'order', data: { statuses } },
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
};
const read = () => storeModule.perpsStore.getState();
const write = (value: Parameters<typeof storeModule.perpsStore.setState>[0]) =>
  storeModule.perpsStore.setState(value);
const ordersHttp = () => jest.mocked(sdk.info.getFrontendOpenOrders);
const subscribe = () => {
  storeModule.subscribeToUserData(read().currentPerpsAccount!);
  return jest.mocked(sdk.ws.subscribeToOpenOrders).mock.calls.at(-1)![0];
};
const mount = () =>
  renderHook(
    ({ coin }: { coin: string }) => {
      const orders = storeModule.perpsStore(s => s.openOrders);
      // Position PnL ticks recreate the surrounding position without changing
      // confirmed orders; they must not erase a protection leg.
      storeModule.perpsStore(s => s.currentClearinghouseState);
      const actions = usePerpsPosition();
      return useSimplePositionTpSl({
        coin,
        orders: orders.filter(item => item.coin === coin),
        setOrder: actions.handleSetAutoClose,
        cancelOrder: actions.handleCancelOrder,
      });
    },
    { initialProps: { coin: 'BTC' } },
  );
const setParams = {
  coin: 'BTC',
  direction: 'Long' as const,
  tpTriggerPx: '',
  slTriggerPx: '90',
};

beforeAll(async () => {
  jest.useFakeTimers();
  storeModule = await import('@/hooks/perps/usePerpsStore');
  ({ usePerpsPosition } = await import('./usePerpsPosition'));
  ({ useSimplePositionTpSl } = await import('./useSimplePositionTpSl'));
  const { apisPerps } = await import('@/core/apis/perps');
  sdk = apisPerps.getPerpsSDK();
  originalState = read();
  nativeToastShow = jest.spyOn(
    require('react-native-root-toast').default,
    'show',
  );
  // The integration fixture registers a real service over an in-memory I/O adapter.
  // eslint-disable-next-line no-runtime-service-imports
  const { PerpsService } = await import('@/core/services/perpsService');
  // eslint-disable-next-line no-runtime-service-imports
  const { registerService } = await import('@/core/services/serviceRegistry');
  const storage = new Map<string, string>();
  const storageAdapter: StorageAdapater = {
    getItem: key => storage.get(String(key)) ?? null,
    setItem: (key, value) => {
      storage.set(String(key), value);
    },
    removeItem: key => {
      storage.delete(String(key));
    },
    clearAll: () => storage.clear(),
  };
  unregisterService = registerService(
    'perpsService',
    new PerpsService({
      storageAdapter,
      keyringCrypto: {
        isUnlocked: () => false,
        decryptWithPassword: async () => {
          throw new Error('No signing in order tests');
        },
        encryptWithPassword: async () => {
          throw new Error('No signing in order tests');
        },
      },
    }),
  );
});
beforeEach(() => {
  nativeToastShow.mockClear();
  write({ currentPerpsAccount: null });
  write({
    ...originalState,
    currentPerpsAccount: account,
    openOrders: [],
    isOpenOrdersReady: false,
    marketDataMap: {
      BTC: { dexId: '' },
      'xyz:ABC': { dexId: 'xyz' },
    } as typeof originalState.marketDataMap,
  });
  ordersHttp().mockReset().mockResolvedValue([]);
  jest
    .mocked(sdk.exchange!.bindTpslByOrderId)
    .mockReset()
    .mockResolvedValue(response([{ resting: { oid: 2 } }]) as never);
  jest
    .mocked(sdk.exchange!.cancelOrder)
    .mockReset()
    .mockResolvedValue(response(['success']) as never);
});
afterEach(async () => {
  await cleanupAsync();
  read().wsSubscriptions.forEach(unsubscribe => unsubscribe());
  write({ currentPerpsAccount: null });
  jest.clearAllTimers();
});
afterAll(() => {
  unregisterService?.();
  nativeToastShow?.mockRestore();
  if (originalState) write(originalState);
  jest.useRealTimers();
});

it('rejects HTTP started before a WS snapshot, preserves all dexes and accepts a real empty snapshot', async () => {
  const ws = subscribe();
  const old = deferred<OpenOrder[]>();
  ordersHttp().mockReturnValueOnce(old.promise);
  const refresh = storeModule.fetchPositionOpenOrdersHttp('');
  ws({
    user: account.address.toUpperCase(),
    orders: [order(1), order(2, 'sl', 'xyz:ABC')],
  });
  old.resolve([]);
  await refresh;
  expect(read().openOrders.map(item => item.oid)).toEqual([1, 2]);
  ordersHttp().mockResolvedValueOnce([]);
  await storeModule.fetchPositionOpenOrdersHttp('');
  expect(read().openOrders.map(item => item.oid)).toEqual([2]);
  ws({ user: account.address, orders: [] });
  expect(read().openOrders).toEqual([]);
  expect(read().isOpenOrdersReady).toBe(true);
});

it('keeps the newer same-dex HTTP result while multi-dex refresh preserves other buckets', async () => {
  const old = deferred<OpenOrder[]>();
  ordersHttp()
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce([order(2)])
    .mockResolvedValueOnce([order(3, 'sl', 'xyz:ABC')]);
  const first = storeModule.fetchPositionOpenOrdersHttp('');
  await storeModule.fetchPositionOpenOrdersHttpForDexes(['', 'xyz', 'xyz']);
  old.resolve([order(1)]);
  await first;
  expect(read().openOrders.map(item => item.oid)).toEqual([2, 3]);
  expect(ordersHttp()).toHaveBeenCalledTimes(3);
  expect(read().isOpenOrdersReady).toBe(false);
});

it.each(['account ABA', 'identity type', 'same-account reset'] as const)(
  'rejects old HTTP and WS across %s, and installs a valid replacement subscription',
  async kind => {
    const oldWs = subscribe();
    const old = deferred<OpenOrder[]>();
    ordersHttp().mockReturnValueOnce(old.promise);
    const refresh = storeModule.fetchPositionOpenOrdersHttp('');
    if (kind === 'same-account reset') {
      storeModule.switchPerpsAccountBeforeNavigate(account);
    } else {
      write({
        currentPerpsAccount:
          kind === 'identity type'
            ? { ...account, type: KEYRING_CLASS.MNEMONIC }
            : accountB,
      });
      write({ currentPerpsAccount: account });
    }
    const ws = subscribe();
    ws({ user: account.address, orders: [order(2)] });
    oldWs({ user: account.address, orders: [order(1)] });
    old.resolve([]);
    await refresh;
    expect(read().openOrders.map(item => item.oid)).toEqual([2]);
    expect(storeModule.subscribeToUserData(account)).toBe(false);
  },
);

it('keeps orders on transport failure and only marks initial readiness after a complete successful refresh', async () => {
  ordersHttp().mockResolvedValueOnce([order(1)]);
  await storeModule.fetchPositionOpenOrdersHttp('');
  expect(read().isOpenOrdersReady).toBe(false);
  ordersHttp().mockRejectedValueOnce(new Error('test offline'));
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await storeModule.fetchAllDexsPositionOpenOrdersHttp();
    expect(read().openOrders.map(item => item.oid)).toEqual([1]);
    expect(read().isOpenOrdersReady).toBe(false);
    await storeModule.fetchAllDexsPositionOpenOrdersHttp();
    expect(read().openOrders).toEqual([]);
    expect(read().isOpenOrdersReady).toBe(true);
  } finally {
    log.mockRestore();
  }
});

it('waits for confirmed orders after setting, deduplicates one leg and keeps both prices through PnL ticks', async () => {
  const ws = subscribe();
  ws({ user: account.address, orders: [order(1)] });
  const ui = mount();
  const accepted = deferred<ReturnType<typeof response>>();
  jest
    .mocked(sdk.exchange!.bindTpslByOrderId)
    .mockReturnValueOnce(accepted.promise as never);
  const snapshot = deferred<OpenOrder[]>();
  ordersHttp().mockReturnValueOnce(snapshot.promise);
  let set!: Promise<boolean>;
  act(() => {
    set = ui.result.current.handleSetAutoClose(setParams);
  });
  expect(ui.result.current).toMatchObject({
    tpPrice: '110',
    slPrice: undefined,
    slPending: true,
  });
  await act(async () => {
    expect(await ui.result.current.handleSetAutoClose(setParams)).toBe(false);
    accepted.resolve(response([{ resting: { oid: 2 } }]));
  });
  expect(ui.result.current.slPrice).toBeUndefined();
  await act(async () => {
    ws({ user: account.address, orders: [order(1), order(2, 'sl')] });
    // This stale read-back must not roll back the newer WS snapshot.
    snapshot.resolve([order(1)]);
    expect(await set).toBe(true);
  });
  act(() =>
    write({
      currentClearinghouseState: {
        ...read().currentClearinghouseState,
        assetPositions: [],
      } as never,
    }),
  );
  expect(ui.result.current).toMatchObject({
    tpPrice: '110',
    slPrice: '90',
    slPending: false,
  });
  expect(sdk.exchange!.bindTpslByOrderId).toHaveBeenCalledTimes(1);
});

it('keeps a cancelled leg visible until confirmation and never restores it on a PnL tick', async () => {
  const ws = subscribe();
  ws({ user: account.address, orders: [order(1), order(2, 'sl')] });
  const ui = mount();
  const accepted = deferred<ReturnType<typeof response>>();
  jest
    .mocked(sdk.exchange!.cancelOrder)
    .mockReturnValueOnce(accepted.promise as never);
  ordersHttp().mockResolvedValueOnce([order(2, 'sl')]);
  let cancel!: Promise<void>;
  act(() => {
    cancel = ui.result.current.handleCancelAutoClose('tp');
  });
  expect(ui.result.current).toMatchObject({
    tpPrice: '110',
    tpPending: true,
    slPrice: '90',
  });
  await act(async () => {
    accepted.resolve(response(['success']));
    await cancel;
  });
  act(() =>
    write({
      currentClearinghouseState: {
        ...read().currentClearinghouseState,
        assetPositions: [],
      } as never,
    }),
  );
  expect(ui.result.current).toMatchObject({
    tpPrice: undefined,
    slPrice: '90',
    tpPending: false,
  });
  expect(sdk.exchange!.cancelOrder).toHaveBeenCalledWith([
    { oid: 1, coin: 'BTC' },
  ]);
});

it('accepts Hyperliquid trigger acknowledgements and rejects unknown statuses', async () => {
  const ui = mount();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    for (const status of ['waitingForTrigger', 'waitingForFill']) {
      jest
        .mocked(sdk.exchange!.bindTpslByOrderId)
        .mockResolvedValueOnce(response([status]) as never);
      await act(async () =>
        expect(await ui.result.current.handleSetAutoClose(setParams)).toBe(
          true,
        ),
      );
    }
    for (const statuses of [['unexpected'], [{ resting: {} }], []]) {
      jest
        .mocked(sdk.exchange!.bindTpslByOrderId)
        .mockResolvedValueOnce(response(statuses) as never);
      await act(async () =>
        expect(await ui.result.current.handleSetAutoClose(setParams)).toBe(
          false,
        ),
      );
    }
    // Every answered request reads back confirmed orders, accepted or not.
    expect(ordersHttp()).toHaveBeenCalledTimes(5);
  } finally {
    log.mockRestore();
  }
});

it('reports rejected/missing SDK results as failure, retains existing tags and only reads back answered set requests', async () => {
  write({ openOrders: [order(1)] });
  ordersHttp().mockResolvedValue([order(1)]);
  const ui = mount();
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const exchange = sdk.exchange;
  try {
    jest
      .mocked(exchange!.bindTpslByOrderId)
      .mockResolvedValueOnce(response([{ error: 'rejected' }]) as never);
    await act(async () =>
      expect(await ui.result.current.handleSetAutoClose(setParams)).toBe(false),
    );
    jest
      .mocked(exchange!.cancelOrder)
      .mockResolvedValueOnce(response([{ error: 'rejected' }]) as never);
    await act(async () => ui.result.current.handleCancelAutoClose('tp'));
    sdk.exchange = undefined;
    await act(async () =>
      expect(await ui.result.current.handleSetAutoClose(setParams)).toBe(false),
    );
    expect(ui.result.current.tpPrice).toBe('110');
    // Only the answered-but-rejected set reads back; cancel and missing
    // exchange paths never refresh.
    expect(ordersHttp()).toHaveBeenCalledTimes(1);
  } finally {
    sdk.exchange = exchange;
    log.mockRestore();
  }
});

it('does not turn an accepted mutation into a failure or replay it when read-back fails; WS still converges', async () => {
  const ws = subscribe();
  const ui = mount();
  ordersHttp().mockRejectedValueOnce(new Error('test offline'));
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    await act(async () =>
      expect(await ui.result.current.handleSetAutoClose(setParams)).toBe(true),
    );
    expect(ui.result.current.slPrice).toBeUndefined();
    act(() => ws({ user: account.address, orders: [order(2, 'sl')] }));
    expect(ui.result.current.slPrice).toBe('90');
    expect(sdk.exchange!.bindTpslByOrderId).toHaveBeenCalledTimes(1);
  } finally {
    log.mockRestore();
  }
});

it.each(['coin ABA', 'account ABA', 'unmount'] as const)(
  'ignores asynchronous action completion after %s',
  async kind => {
    const ui = mount();
    const accepted = deferred<ReturnType<typeof response>>();
    jest
      .mocked(sdk.exchange!.bindTpslByOrderId)
      .mockReturnValueOnce(accepted.promise as never);
    let result!: Promise<boolean>;
    act(() => {
      result = ui.result.current.handleSetAutoClose(setParams);
    });
    if (kind === 'coin ABA') {
      ui.rerender({ coin: 'ETH' });
      ui.rerender({ coin: 'BTC' });
    } else if (kind === 'account ABA') {
      act(() => {
        write({ currentPerpsAccount: accountB });
        write({ currentPerpsAccount: account });
      });
    } else {
      ui.unmount();
    }
    await act(async () => {
      accepted.resolve(response([{ resting: { oid: 2 } }]));
      expect(await result).toBe(false);
    });
    expect(read().openOrders).toEqual([]);
    expect(nativeToastShow).not.toHaveBeenCalled();
    if (kind === 'account ABA') expect(ordersHttp()).not.toHaveBeenCalled();
  },
);
