import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { KeyringAccountWithAlias } from '@/hooks/account';
import type { ITokenItem } from '@/store/tokens';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils/src/types';
import { toast } from '@/components2024/Toast';
import { TokenDetailHistoryList } from './HistoryList';

// Component coverage: keep the real ahooks request/pagination lifecycle, but
// isolate DB rows, account selection and presentation outside this contract.
const mockGetTokenHistory = jest.fn();
const mockListTxHistory = jest.fn();
const mockHistoryList = jest.fn();
let mockIsFocused = true;
let mockOnHistorySynced: (ctx: {
  owner_addr: string;
  success: boolean;
}) => void;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockIsFocused,
}));
jest.mock('@/databases/sync/_event', () => ({
  useAppOrmSyncEvents: (options: {
    onRemoteDataUpserted: typeof mockOnHistorySynced;
  }) => {
    mockOnHistorySynced = options.onRemoteDataUpserted;
  },
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
jest.mock('@/core/request', () => ({
  openapi: {
    listTxHistory: (...args: unknown[]) => mockListTxHistory(...args),
  },
}));
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
  let reject!: (error: Error) => void;
  const promise = new Promise<Row[]>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
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
  mockListTxHistory.mockReset();
  mockIsFocused = true;
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

it('retains loaded rows and the committed DB cursor when a refresh fails', async () => {
  mockGetTokenHistory
    .mockResolvedValueOnce(rows('initial', 20))
    .mockResolvedValueOnce(
      rows('older', 20).map(row => ({ ...row, time_at: row.time_at - 20 })),
    )
    .mockRejectedValueOnce(new Error('DB temporarily unavailable'))
    .mockResolvedValueOnce(rows('next'));
  render(<TokenDetailHistoryList finalAccount={account} token={token} />);
  await act(async () => undefined);
  fireEvent.press(screen.getByTestId('load-more'));
  await act(async () => undefined);
  fireEvent.press(screen.getByTestId('refresh'));
  await act(async () => undefined);
  expect(screen.getByText('initial-0')).toBeVisible();
  expect(screen.getByText('older-19')).toBeVisible();
  expect(mockHistoryList.mock.calls.at(-1)![0].refreshLoading).toBeFalsy();
  expect(toast.error).toHaveBeenCalledTimes(1);
  expect(mockGetTokenHistory).toHaveBeenLastCalledWith(
    '0xa',
    null,
    'token-a',
    'eth',
    40,
  );
  fireEvent.press(screen.getByTestId('load-more'));
  await act(async () => undefined);
  expect(mockGetTokenHistory).toHaveBeenLastCalledWith(
    '0xa',
    { id: 'older-19', timeAt: 61 },
    'token-a',
    'eth',
    20,
  );
  expect(screen.getByText('next-0')).toBeVisible();
});

it('retries a failed append from the same cursor without marking history exhausted', async () => {
  mockGetTokenHistory
    .mockResolvedValueOnce(rows('initial', 20))
    .mockRejectedValueOnce(new Error('DB temporarily unavailable'))
    .mockResolvedValueOnce(rows('next'));
  render(<TokenDetailHistoryList finalAccount={account} token={token} />);
  await act(async () => undefined);
  fireEvent.press(screen.getByTestId('load-more'));
  await act(async () => undefined);
  expect(screen.getByText('initial-19')).toBeVisible();
  expect(mockHistoryList.mock.calls.at(-1)![0].loadingMore).toBe(false);
  fireEvent.press(screen.getByTestId('load-more'));
  await act(async () => undefined);
  expect(mockGetTokenHistory).toHaveBeenCalledTimes(3);
  expect(mockGetTokenHistory.mock.calls[2]).toEqual(
    mockGetTokenHistory.mock.calls[1],
  );
  expect(screen.getByText('next-0')).toBeVisible();
});

it('accepts a successful empty refresh and permits a later refresh from the beginning', async () => {
  mockGetTokenHistory
    .mockResolvedValueOnce(rows('initial', 20))
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(rows('new'));
  render(<TokenDetailHistoryList finalAccount={account} token={token} />);
  await act(async () => undefined);
  fireEvent.press(screen.getByTestId('refresh'));
  await act(async () => undefined);
  expect(screen.queryByText('initial-0')).toBeNull();
  expect(toast.error).not.toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('refresh'));
  await act(async () => undefined);
  expect(mockGetTokenHistory).toHaveBeenLastCalledWith(
    '0xa',
    null,
    'token-a',
    'eth',
    20,
  );
  expect(screen.getByText('new-0')).toBeVisible();
});

it('retains API-backed history and its remote cursor after a failed refresh', async () => {
  const response = (prefix: string, count: number) => ({
    history_list: rows(prefix, count).map(row => ({
      ...row,
      chain: 'eth',
      sends: [],
      receives: [],
    })),
    project_dict: {},
    token_dict: {},
  });
  mockListTxHistory
    .mockResolvedValueOnce(response('remote', 20))
    .mockRejectedValueOnce(new Error('Network temporarily unavailable'))
    .mockResolvedValueOnce(response('next', 1));
  render(
    <TokenDetailHistoryList
      finalAccount={{ ...account, type: KEYRING_CLASS.WATCH }}
      token={token}
    />,
  );
  await act(async () => undefined);
  fireEvent.press(screen.getByTestId('refresh'));
  await act(async () => undefined);
  expect(screen.getByText('remote-19')).toBeVisible();
  fireEvent.press(screen.getByTestId('load-more'));
  await act(async () => undefined);
  expect(mockListTxHistory).toHaveBeenLastCalledWith({
    id: '0xa',
    start_time: 81,
    page_count: 20,
    chain_id: 'eth',
    token_id: 'token-a',
  });
  expect(screen.getByText('remote-0')).toBeVisible();
  expect(screen.getByText('next-0')).toBeVisible();
});

it.each([KEYRING_CLASS.WATCH, KEYRING_CLASS.GNOSIS])(
  'keeps remote reloads at one 20-row page and can append after loading two pages: %s',
  async type => {
    const response = (prefix: string, count: number, timeOffset = 0) => ({
      history_list: rows(prefix, count).map(row => ({
        ...row,
        time_at: row.time_at - timeOffset,
        chain: 'eth',
        sends: [],
        receives: [],
      })),
      project_dict: {},
      token_dict: {},
    });
    mockListTxHistory
      .mockResolvedValueOnce(response('remote', 20))
      .mockResolvedValueOnce(response('older', 20, 20))
      .mockResolvedValueOnce(response('refreshed', 20))
      .mockResolvedValueOnce(response('next', 1, 20));
    render(
      <TokenDetailHistoryList
        finalAccount={{ ...account, type }}
        token={token}
      />,
    );
    await act(async () => undefined);
    fireEvent.press(screen.getByTestId('load-more'));
    await act(async () => undefined);
    expect(screen.getByText('remote-0')).toBeVisible();
    expect(screen.getByText('older-19')).toBeVisible();

    fireEvent.press(screen.getByTestId('refresh'));
    await act(async () => undefined);
    expect(mockListTxHistory).toHaveBeenNthCalledWith(3, {
      id: '0xa',
      start_time: 0,
      page_count: 20,
      chain_id: 'eth',
      token_id: 'token-a',
    });
    expect(screen.getByText('refreshed-19')).toBeVisible();
    expect(screen.queryByText('older-19')).toBeNull();

    // A full remote page is not exhausted just because the old local window
    // contained 40 rows. Its cursor must still permit the next API request.
    fireEvent.press(screen.getByTestId('load-more'));
    await act(async () => undefined);
    expect(mockListTxHistory).toHaveBeenCalledTimes(4);
    expect(mockListTxHistory).toHaveBeenLastCalledWith({
      id: '0xa',
      start_time: 81,
      page_count: 20,
      chain_id: 'eth',
      token_id: 'token-a',
    });
    expect(screen.getByText('next-0')).toBeVisible();
    expect(mockGetTokenHistory).not.toHaveBeenCalled();
  },
);

it('does not show a stale request error after a newer refresh succeeds', async () => {
  const olderPage = deferredRows();
  mockGetTokenHistory
    .mockResolvedValueOnce(rows('initial', 20))
    .mockReturnValueOnce(olderPage.promise)
    .mockResolvedValueOnce(rows('refreshed'));
  render(<TokenDetailHistoryList finalAccount={account} token={token} />);
  await act(async () => undefined);
  fireEvent.press(screen.getByTestId('load-more'));
  fireEvent.press(screen.getByTestId('refresh'));
  await act(async () => undefined);
  await act(async () => olderPage.reject(new Error('Obsolete failure')));
  expect(screen.getByText('refreshed-0')).toBeVisible();
  expect(toast.error).not.toHaveBeenCalled();
});

it('can retry the first page after an initial request failure', async () => {
  mockGetTokenHistory
    .mockRejectedValueOnce(new Error('DB temporarily unavailable'))
    .mockResolvedValueOnce(rows('retried'));
  render(<TokenDetailHistoryList finalAccount={account} token={token} />);
  await act(async () => undefined);
  expect(mockHistoryList.mock.calls.at(-1)![0].refreshLoading).toBeFalsy();
  fireEvent.press(screen.getByTestId('refresh'));
  await act(async () => undefined);
  expect(mockGetTokenHistory.mock.calls[1]).toEqual(
    mockGetTokenHistory.mock.calls[0],
  );
  expect(screen.getByText('retried-0')).toBeVisible();
});

it.each(['succeeds', 'fails'] as const)(
  'keeps the committed window when a refresh fails and its superseded append %s',
  async appendOutcome => {
    const olderPage = deferredRows();
    mockGetTokenHistory
      .mockResolvedValueOnce(rows('initial', 20))
      .mockReturnValueOnce(olderPage.promise)
      .mockRejectedValueOnce(new Error('Current refresh failed'))
      .mockResolvedValueOnce(rows('next'));
    render(<TokenDetailHistoryList finalAccount={account} token={token} />);
    await act(async () => undefined);
    fireEvent.press(screen.getByTestId('load-more'));
    fireEvent.press(screen.getByTestId('refresh'));
    await act(async () => undefined);
    await act(async () => {
      if (appendOutcome === 'succeeds') {
        olderPage.resolve(rows('stale-page'));
      } else {
        olderPage.reject(new Error('Obsolete failure'));
      }
    });
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(screen.getByText('initial-19')).toBeVisible();
    expect(screen.queryByText('stale-page-0')).toBeNull();
    fireEvent.press(screen.getByTestId('load-more'));
    await act(async () => undefined);
    expect(mockGetTokenHistory.mock.calls[3]).toEqual(
      mockGetTokenHistory.mock.calls[1],
    );
    expect(screen.getByText('next-0')).toBeVisible();
  },
);

it('does not show an old account error in the newly selected account', async () => {
  const oldAccountPage = deferredRows();
  mockGetTokenHistory
    .mockReturnValueOnce(oldAccountPage.promise)
    .mockResolvedValueOnce(rows('current'));
  const view = render(
    <TokenDetailHistoryList finalAccount={account} token={token} />,
  );
  view.rerender(
    <TokenDetailHistoryList
      finalAccount={{ ...account, address: '0xb' }}
      token={token}
    />,
  );
  await act(async () => undefined);
  await act(async () =>
    oldAccountPage.reject(new Error('Old account failure')),
  );
  expect(screen.getByText('current-0')).toBeVisible();
  expect(toast.error).not.toHaveBeenCalled();
});

it('refreshes an initially empty token history after its account sync commits', async () => {
  mockGetTokenHistory
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(rows('synced'));
  render(<TokenDetailHistoryList finalAccount={account} token={token} />);
  await act(async () => undefined);
  expect(screen.queryByText('synced-0')).toBeNull();
  await act(async () =>
    mockOnHistorySynced({ owner_addr: '0xA', success: true }),
  );
  expect(screen.getByText('synced-0')).toBeVisible();
});

it('ignores failed syncs and syncs belonging to other accounts', async () => {
  mockGetTokenHistory.mockResolvedValue(rows('initial'));
  render(<TokenDetailHistoryList finalAccount={account} token={token} />);
  await act(async () => undefined);
  await act(async () => {
    mockOnHistorySynced({ owner_addr: '0xb', success: true });
    mockOnHistorySynced({ owner_addr: '0xa', success: false });
  });
  expect(mockGetTokenHistory).toHaveBeenCalledTimes(1);
});

it('catches up once on focus without revalidating inactive token history', async () => {
  mockGetTokenHistory
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(rows('resumed'));
  const view = render(
    <TokenDetailHistoryList finalAccount={account} token={token} />,
  );
  await act(async () => undefined);
  mockIsFocused = false;
  view.rerender(
    <TokenDetailHistoryList finalAccount={account} token={token} />,
  );
  await act(async () =>
    mockOnHistorySynced({ owner_addr: '0xa', success: true }),
  );
  expect(mockGetTokenHistory).toHaveBeenCalledTimes(1);
  mockIsFocused = true;
  view.rerender(
    <TokenDetailHistoryList finalAccount={account} token={token} />,
  );
  await act(async () => undefined);
  expect(mockGetTokenHistory).toHaveBeenCalledTimes(2);
  expect(screen.getByText('resumed-0')).toBeVisible();
});

it('preserves the loaded history window and keyset cursor during sync revalidation', async () => {
  const first = rows('initial', 20);
  const second = rows('next', 20).map(row => ({
    ...row,
    time_at: row.time_at - 20,
  }));
  mockGetTokenHistory
    .mockResolvedValueOnce(first)
    .mockResolvedValueOnce(second)
    .mockResolvedValueOnce([...first, ...second])
    .mockResolvedValueOnce(rows('last'));
  render(<TokenDetailHistoryList finalAccount={account} token={token} />);
  await act(async () => undefined);
  fireEvent.press(screen.getByTestId('load-more'));
  await act(async () => undefined);
  await act(async () =>
    mockOnHistorySynced({ owner_addr: '0xa', success: true }),
  );
  expect(mockGetTokenHistory).toHaveBeenNthCalledWith(
    3,
    '0xa',
    null,
    'token-a',
    'eth',
    40,
  );
  expect(screen.getByText('next-19')).toBeVisible();
  fireEvent.press(screen.getByTestId('load-more'));
  await act(async () => undefined);
  expect(mockGetTokenHistory).toHaveBeenLastCalledWith(
    '0xa',
    { id: 'next-19', timeAt: 61 },
    'token-a',
    'eth',
    20,
  );
});
