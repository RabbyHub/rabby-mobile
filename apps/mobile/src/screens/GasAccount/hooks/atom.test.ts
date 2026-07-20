jest.mock('@/constant', () => ({ INTERNAL_REQUEST_SESSION: {} }));
jest.mock('@/core/apis/provider', () => ({ sendRequest: jest.fn() }));
jest.mock('@/core/request', () => ({
  openapi: { getGasAccountHistory: jest.fn() },
}));
jest.mock('@/core/services', () => ({
  gasAccountService: {
    getGasAccountData: () => ({}),
    getPendingHardwareAccount: () => undefined,
    getAccountsWithGasAccountBalance: () => [],
  },
  keyringService: { on: jest.fn() },
  perpsService: {},
}));
jest.mock('@/core/storage/mmkv', () => {
  const { create } = jest.requireActual('zustand');
  return {
    MMKVStorageStrategy: { compatJson: {} },
    zustandByMMKV: (_key: string, initialValue: unknown) =>
      create(() => initialValue),
  };
});
jest.mock('@/core/utils/reexports', () => ({
  zCreate: jest.requireActual('zustand').create,
}));
jest.mock('@/core/utils/store', () => ({
  makeAvoidParallelAsyncFunc: (fn: unknown) => fn,
  resolveValFromUpdater: (_previous: unknown, value: unknown) => ({
    newVal: value,
  }),
  runIIFEFunc: (fn: () => void) => fn(),
}));
jest.mock('@/utils/events', () => ({
  eventBus: { on: jest.fn(), emit: jest.fn() },
  EVENTS: {
    AUTO_LOGIN_GAS_ACCOUNT: 'auto-login',
    TX_COMPLETED: 'tx-completed',
  },
}));
jest.mock('@/utils/gasAccountStoreApiBridge', () => ({
  setGasAccountStoreApi: jest.fn(),
}));
jest.mock('@/utils/gasAccountAnalytics', () => ({
  handleGasAccountLoginSuccess: jest.fn(),
}));
jest.mock('@/utils/sendPersonalMessage', () => ({
  sendPersonalMessage: jest.fn(),
}));
jest.mock('@/utils/walletUnlock', () => ({
  ensureWalletUnlocked: jest.fn(),
  isWalletUnlockCancelled: jest.fn(),
}));
jest.mock('p-retry', () => jest.fn());

import { openapi } from '@/core/request';
import { gasAccountStore, storeApiGasAccount } from './atom';

const mockGetGasAccountHistory = jest.mocked(openapi.getGasAccountHistory);

const deferred = () => {
  let resolve!: (value: unknown) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<unknown>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

beforeEach(() => {
  mockGetGasAccountHistory.mockReset();
  gasAccountStore.setState(state => ({
    ...state,
    session: {
      sig: 'sig',
      accountId: '0xabc',
      status: 'logged_in',
    },
    history: {
      ...state.history,
      list: [{ id: 'cached' }] as never,
      totalCount: 2,
      status: 'ready',
    },
  }));
  storeApiGasAccount.setHistoryRefreshEnabled(true);
});

afterEach(() => {
  storeApiGasAccount.setHistoryRefreshEnabled(false);
});

it('ignores an in-flight pagination response after refresh starts', async () => {
  const pagination = deferred();
  const refresh = deferred();
  const refreshedItem = { id: 'refreshed' };

  mockGetGasAccountHistory
    .mockReturnValueOnce(pagination.promise)
    .mockReturnValueOnce(refresh.promise);

  const paginationRequest = storeApiGasAccount.loadMoreHistory();
  const refreshRequest = storeApiGasAccount.refreshHistory();

  refresh.resolve({
    history_list: [refreshedItem],
    recharge_list: [],
    withdraw_list: [],
    pagination: { total: 2 },
  });
  await refreshRequest;

  pagination.resolve({
    history_list: [{ id: 'stale-page' }],
    pagination: { total: 2 },
  });
  await paginationRequest;

  expect(gasAccountStore.getState().history.list).toEqual([refreshedItem]);
});

it('ignores an in-flight pagination error while refresh is pending', async () => {
  const pagination = deferred();
  const refresh = deferred();

  mockGetGasAccountHistory
    .mockReturnValueOnce(pagination.promise)
    .mockReturnValueOnce(refresh.promise);

  const paginationRequest = storeApiGasAccount.loadMoreHistory();
  const refreshRequest = storeApiGasAccount.refreshHistory();

  pagination.reject(new Error('stale pagination failure'));
  await paginationRequest;

  expect(gasAccountStore.getState().history).toMatchObject({
    list: [{ id: 'cached' }],
    status: 'refreshing',
    loadingMore: false,
  });

  refresh.resolve({
    history_list: [{ id: 'refreshed' }],
    recharge_list: [],
    withdraw_list: [],
    pagination: { total: 2 },
  });
  await refreshRequest;

  expect(gasAccountStore.getState().history.status).toBe('ready');
});
