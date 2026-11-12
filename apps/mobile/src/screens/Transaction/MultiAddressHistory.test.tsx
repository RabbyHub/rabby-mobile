import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import HistoryScreen from './MultiAddressHistory';

// Component coverage: keep the real ahooks pagination and the screen's own
// paging cursors, but isolate the API, DB rows, account selection and
// presentation outside this contract.
const mockListTxHistory = jest.fn();
const mockGetHistoryItemsPaginated = jest.fn();
const mockHistoryList = jest.fn();
let mockAccount: { address: string; type: string };
let mockOnHistorySynced: (ctx: { taskFor: string }) => void;

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: {} }),
}));
jest.mock('@/databases/sync/_event', () => ({
  useAppOrmSyncEvents: (options: {
    onRemoteDataUpserted: typeof mockOnHistorySynced;
  }) => {
    mockOnHistorySynced = options.onRemoteDataUpserted;
  },
}));
jest.mock('@/constant/layout', () => ({
  makeTxPageBackgroundColors: () => '#fff',
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {} }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/accountsSwitcher', () => ({
  useSceneAccountInfo: () => ({
    isSceneUsingAllAccounts: false,
    finalSceneCurrentAccount: mockAccount,
    sceneCurrentAccountDepKey: 'unchanged-scene-account',
  }),
}));
jest.mock('@/utils/account', () => ({
  isSupportDBAccount: (account?: { type: string }) =>
    account?.type === 'Simple Key Pair',
}));
jest.mock('../Address/components/MultiAssets/hooks', () => ({
  useAccountInfo: () => ({ myTop10Addresses: [], list: [] }),
}));
jest.mock('@/databases/entities/historyItem', () => ({
  HistoryItemEntity: {
    getHistoryItemsPaginated: (...args: unknown[]) =>
      mockGetHistoryItemsPaginated(...args),
  },
}));
jest.mock('@/databases/hooks/history', () => ({
  syncSingleAddress: jest.fn(),
  syncTop10History: jest.fn(),
}));
jest.mock('@/hooks/historyTokenDict', () => ({
  useHistoryLoading: () => ({}),
}));
jest.mock('./components/utils', () => ({
  ensureHistoryListItemFromDb: (row: unknown) => row,
  fetchHistoryTokenItem: jest.fn(),
  getHistoryItemType: jest.fn(),
}));
jest.mock('@/core/request', () => ({
  openapi: {
    listTxHistory: (...args: unknown[]) => mockListTxHistory(...args),
  },
}));
jest.mock('@/core/serviceApi/transactionHistory', () => ({
  getTransactionHistoryListSnapshot: () => ({ pendings: [], completeds: [] }),
  getTransactionHistorySucceedListSnapshot: () => [],
  getTransactionHistoryTransactions: jest.fn(async () => ({})),
  transactionHistoryServiceApi: {
    clearSuccessAndFailList: jest.fn(async () => undefined),
    updateTx: jest.fn(async () => undefined),
  },
}));
jest.mock('@/core/serviceApi/transactionHistoryHooks', () => ({
  useTransactionHistoryServiceReady: () => false,
  withTransactionHistoryService: (component: unknown) => component,
}));
jest.mock('./hooks/useSyncSafeHistoryOnFocus', () => ({
  useSyncSafeHistoryOnFocus: () => undefined,
}));
jest.mock('@/utils/chain', () => ({
  findChain: jest.fn(),
  findChainByServerID: jest.fn(),
}));
jest.mock('@/utils/events', () => ({
  EVENTS: { RELOAD_TX: 'RELOAD_TX' },
  eventBus: { addListener: jest.fn(), removeListener: jest.fn() },
}));
jest.mock('@/components/AppStatusBar', () => ({
  useSafeSetNavigationOptions: () => ({ setNavigationOptions: jest.fn() }),
}));
jest.mock('@/components2024/Toast', () => ({
  toast: { error: jest.fn() },
}));
jest.mock('@/components2024/ScreenContainer/NormalScreenContainer', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components', () => ({ AssetAvatar: () => null }));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components/AccountSwitcher/Modal', () => ({
  AccountSwitcherModal: () => null,
}));
jest.mock('@/components/AccountSwitcher/OnScreenHeader', () => ({
  ScreenHeaderAccountSwitcher: () => null,
}));
jest.mock('@/components/TokenDetailPopup/BottomSheetModalTokenDetail', () => ({
  BottomSheetModalTokenDetail: () => null,
}));
jest.mock('@/components/TokenDetailPopup/hooks', () => ({
  useGeneralTokenDetailSheetModal: () => ({
    cleanFocusingToken: jest.fn(),
    setTokenDetailAddress: jest.fn(),
  }),
}));
jest.mock('./components/HistoryFilterMenu', () => ({
  HistoryFilterMenu: () => null,
}));
jest.mock('../TransactionRecord/components/TransactionAlert', () => ({
  TransactionAlert: () => null,
}));
jest.mock('./components/BridgeAwareHistoryList', () => ({
  BridgeAwareHistoryList: (props: { list: { id: string }[] }) => {
    mockHistoryList(props);
    return null;
  },
}));

const ADDRESS = '0xa';
const PAGE_SIZE = 20;
const apiPage = (prefix: string, firstTime: number) => ({
  project_dict: {},
  token_dict: {},
  history_list: Array.from({ length: PAGE_SIZE }, (_, i) => ({
    id: `${prefix}-${i}`,
    chain: 'eth',
    time_at: firstTime - i,
    receives: [],
    sends: [],
  })),
});
const dbPage = (prefix: string) => ({
  items: [
    {
      id: `${prefix}-0`,
      key: `${prefix}-0`,
      address: ADDRESS,
      owner_addr: ADDRESS,
      txHash: `${prefix}-0`,
    },
  ],
  hasMore: false,
});
const shownIds = () =>
  mockHistoryList.mock.calls
    .at(-1)![0]
    .list.map((row: { id: string }) => row.id);

beforeEach(() => {
  jest.clearAllMocks();
});

it('keeps an API-backed list on its first page when a history sync lands', async () => {
  mockAccount = { address: ADDRESS, type: 'Watch Address' };
  // the API pages by the time of the last row it returned
  mockListTxHistory.mockImplementation(
    async ({ start_time }: { start_time: number }) =>
      start_time ? apiPage('older', start_time - 1) : apiPage('newest', 100),
  );
  render(<HistoryScreen.ForSingleAddress />);
  await waitFor(() => expect(shownIds()[0]).toBe('newest-0'));

  act(() => mockOnHistorySynced({ taskFor: 'all-history' }));
  await act(async () => undefined);

  expect(shownIds()[0]).toBe('newest-0');
  // only ever asked for the first page
  expect(
    new Set(mockListTxHistory.mock.calls.map(([params]) => params.start_time)),
  ).toEqual(new Set([0]));
});

it('reloads a DB-backed list from its first page when a history sync lands', async () => {
  mockAccount = { address: ADDRESS, type: 'Simple Key Pair' };
  mockGetHistoryItemsPaginated
    .mockResolvedValueOnce(dbPage('initial'))
    .mockResolvedValue(dbPage('synced'));
  render(<HistoryScreen.ForSingleAddress />);
  await waitFor(() => expect(shownIds()).toEqual(['initial-0']));

  act(() => mockOnHistorySynced({ taskFor: 'all-history' }));

  await waitFor(() => expect(shownIds()).toEqual(['synced-0']));
  expect(mockGetHistoryItemsPaginated.mock.calls.at(-1)![1].cursor).toBeNull();
});
