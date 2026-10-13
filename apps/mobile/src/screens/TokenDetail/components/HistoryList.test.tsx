import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { KeyringAccountWithAlias } from '@/hooks/account';
import type { ITokenItem } from '@/store/tokens';
import { TokenDetailHistoryList } from './HistoryList';

// Component coverage: keep the real ahooks request/pagination lifecycle, but
// isolate DB rows, account selection and presentation outside this contract.
const mockGetTokenHistory = jest.fn();
const mockHistoryList = jest.fn();
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
    sceneCurrentAccountDepKey: 'unchanged-scene-account',
  }),
}));
jest.mock('@/databases/entities/historyItem', () => ({
  HistoryItemEntity: {
    getTokenHistoryItemSortedByTime: (...args: unknown[]) =>
      mockGetTokenHistory(...args),
  },
  toHistoryPageCursor: (row: { id: string; time_at: number }) => ({
    id: row.id,
    timeAt: row.time_at,
  }),
}));
jest.mock('@/screens/Transaction/components/utils', () => ({
  ensureHistoryListItemFromDb: (row: unknown) => row,
  fetchHistoryTokenItem: jest.fn(),
  getHistoryItemType: jest.fn(),
}));
jest.mock('@/core/serviceApi/transactionHistory', () => ({
  getTransactionHistorySucceedListSnapshot: () => [],
  getTransactionHistoryTransactions: jest.fn(async () => ({})),
  transactionHistoryServiceApi: {
    clearSuccessAndFailList: jest.fn(async () => undefined),
  },
}));
jest.mock('@/core/serviceApi/transactionHistoryHooks', () => ({
  useTransactionHistoryServiceReady: () => false,
  withTransactionHistoryService: (component: unknown) => component,
}));
jest.mock('@/core/request', () => ({ openapi: {} }));
jest.mock('@/components2024/Toast', () => ({
  toast: { error: jest.fn() },
}));
jest.mock('@/screens/Transaction/components/Empty', () => ({
  Empty: () => null,
}));
jest.mock('@/screens/Transaction/components/HistoryGroupList', () => ({
  HistoryList: (props: {
    list: { id: string }[];
    loadMore: () => void;
    onRefresh: () => void;
  }) => {
    mockHistoryList(props);
    const { View, Text, Pressable } = require('react-native');
    const ReactModule = require('react');
    return ReactModule.createElement(
      View,
      null,
      ...props.list.map(row =>
        ReactModule.createElement(Text, { key: row.id }, row.id),
      ),
      ReactModule.createElement(Pressable, {
        testID: 'load-more',
        onPress: props.loadMore,
      }),
      ReactModule.createElement(Pressable, {
        testID: 'refresh',
        onPress: props.onRefresh,
      }),
    );
  },
}));

type Row = { id: string; time_at: number; is_scam: boolean };
const rows = (prefix: string, count = 1): Row[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    time_at: 100 - i,
    is_scam: false,
  }));
const deferredRows = () => {
  let resolve!: (value: Row[]) => void;
  const promise = new Promise<Row[]>(nextResolve => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};
const account = {
  address: '0xa',
  type: 'Simple Key Pair',
} as KeyringAccountWithAlias;
const token = { id: 'token-a', chain: 'eth' } as ITokenItem;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockGetTokenHistory.mockReset();
});

afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

it('does not request another first page when the native list reaches its end during initial loading', async () => {
  const initial = deferredRows();
  mockGetTokenHistory.mockReturnValue(initial.promise);
  render(<TokenDetailHistoryList finalAccount={account} token={token} />);
  expect(mockGetTokenHistory).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByTestId('load-more'));
  expect(mockGetTokenHistory).toHaveBeenCalledTimes(1);
  await act(async () => initial.resolve(rows('initial')));
  expect(screen.getByText('initial-0')).toBeVisible();
});

it('starts a different token from its first page even when the previous token exhausted history', async () => {
  mockGetTokenHistory
    .mockResolvedValueOnce(rows('a'))
    .mockResolvedValueOnce(rows('b'));
  const view = render(
    <TokenDetailHistoryList finalAccount={account} token={token} />,
  );
  await act(async () => undefined);
  expect(screen.getByText('a-0')).toBeVisible();
  view.rerender(
    <TokenDetailHistoryList
      finalAccount={account}
      token={{ ...token, id: 'token-b' }}
    />,
  );
  await act(async () => undefined);
  expect(mockGetTokenHistory).toHaveBeenCalledTimes(2);
  expect(mockGetTokenHistory).toHaveBeenLastCalledWith(
    '0xa',
    null,
    'token-b',
    'eth',
    20,
  );
  expect(screen.queryByText('a-0')).toBeNull();
  expect(screen.getByText('b-0')).toBeVisible();
});

it('keeps a late previous-account result out of the current token history', async () => {
  const first = deferredRows();
  const second = deferredRows();
  mockGetTokenHistory
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const view = render(
    <TokenDetailHistoryList finalAccount={account} token={token} />,
  );
  view.rerender(
    <TokenDetailHistoryList
      finalAccount={{ ...account, address: '0xb' }}
      token={token}
    />,
  );
  expect(mockGetTokenHistory).toHaveBeenCalledTimes(2);
  await act(async () => second.resolve(rows('current')));
  expect(screen.getByText('current-0')).toBeVisible();
  await act(async () => first.resolve(rows('stale')));
  expect(screen.getByText('current-0')).toBeVisible();
  expect(screen.queryByText('stale-0')).toBeNull();
});

it('coalesces repeated end-reached callbacks before React publishes loadingMore', async () => {
  const nextPage = deferredRows();
  mockGetTokenHistory
    .mockResolvedValueOnce(rows('initial', 20))
    .mockReturnValue(nextPage.promise);
  render(<TokenDetailHistoryList finalAccount={account} token={token} />);
  await act(async () => undefined);
  const onEndReached = mockHistoryList.mock.calls.at(-1)![0].loadMore;
  act(() => {
    onEndReached();
    onEndReached();
  });
  expect(mockGetTokenHistory).toHaveBeenCalledTimes(2);
  await act(async () => nextPage.resolve(rows('next')));
  expect(screen.getByText('initial-0')).toBeVisible();
  expect(screen.getByText('next-0')).toBeVisible();
});

it('does not let a late load-more page replace a completed manual refresh', async () => {
  const olderPage = deferredRows();
  const refreshed = deferredRows();
  mockGetTokenHistory
    .mockResolvedValueOnce(rows('initial', 20))
    .mockReturnValueOnce(olderPage.promise)
    .mockReturnValueOnce(refreshed.promise);
  render(<TokenDetailHistoryList finalAccount={account} token={token} />);
  await act(async () => undefined);
  fireEvent.press(screen.getByTestId('load-more'));
  fireEvent.press(screen.getByTestId('refresh'));
  expect(mockGetTokenHistory).toHaveBeenCalledTimes(3);
  await act(async () => refreshed.resolve(rows('refreshed')));
  expect(screen.getByText('refreshed-0')).toBeVisible();
  await act(async () => olderPage.resolve(rows('stale-page')));
  expect(screen.getByText('refreshed-0')).toBeVisible();
  expect(screen.queryByText('stale-page-0')).toBeNull();
});
