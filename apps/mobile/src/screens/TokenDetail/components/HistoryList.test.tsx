import React from 'react';
import { act, render } from '@testing-library/react-native';
import { TokenDetailHistoryList } from './HistoryList';

const mockReadHistory = jest.fn();
const mockReadApiHistory = jest.fn();
const mockToastError = jest.fn();
let mockIsFocused = true;
let mockOnHistoryUpsert: (event: any) => void;
let mockListProps: any;

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {} }),
}));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockIsFocused,
}));
jest.mock('@/utils/styles', () => ({ createGetStyles2024: (fn: any) => fn }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/accountsSwitcher', () => ({
  useSceneAccountInfo: () => ({
    isSceneUsingAllAccounts: false,
    sceneCurrentAccountDepKey: 'account',
  }),
}));
jest.mock('@/screens/Transaction/components/utils', () => ({
  ensureHistoryListItemFromDb: (item: any) => ({ ...item, key: item.id }),
  fetchHistoryTokenItem: jest.fn(),
  getHistoryItemType: jest.fn(),
}));
jest.mock('@/screens/Transaction/components/HistoryGroupList', () => ({
  HistoryList: require('react').forwardRef((props: any, _ref: any) => {
    mockListProps = props;
    return null;
  }),
}));
jest.mock('@/core/serviceApi/transactionHistory', () => ({
  getTransactionHistorySucceedListSnapshot: () => [],
  getTransactionHistoryTransactions: async () => [],
  transactionHistoryServiceApi: {
    clearSuccessAndFailList: async () => undefined,
  },
}));
jest.mock('@/core/serviceApi/transactionHistoryHooks', () => ({
  useTransactionHistoryServiceReady: () => true,
  withTransactionHistoryService: (Component: any) => Component,
}));
jest.mock('@/core/request', () => ({
  openapi: {
    listTxHisotry: (...args: any[]) => mockReadApiHistory(...args),
  },
}));
jest.mock('@/components2024/Toast', () => ({
  toast: { error: (...args: any[]) => mockToastError(...args) },
}));
jest.mock('@/screens/Transaction/components/Empty', () => ({
  Empty: () => null,
}));
jest.mock('@rabby-wallet/keyring-utils/src/types', () => ({
  KEYRING_CLASS: { WATCH: 'Watch Address', GNOSIS: 'Gnosis' },
}));
jest.mock('@/databases/entities/historyItem', () => ({
  HistoryItemEntity: {
    getTokenHistoryItemSortedByTime: (...args: any[]) =>
      mockReadHistory(...args),
  },
}));
jest.mock('@/databases/sync/_event', () => ({
  useAppOrmSyncEvents: (options: any) => {
    mockOnHistoryUpsert = options.onRemoteDataUpserted;
  },
}));

const account = { address: '0xabc', type: 'HD Key Tree', brandName: '' };
const token = { id: 'token-a', chain: 'eth' };
const row = (id: string, time_at = 100) => ({ id, time_at, is_scam: false });
const props = { finalAccount: account, token } as any;
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('TokenDetailHistoryList resource flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsFocused = true;
    mockReadHistory.mockResolvedValue([]);
    mockReadApiHistory.mockResolvedValue({
      history_list: [],
      project_dict: {},
      token_dict: {},
    });
  });

  it('keeps existing rows when a same-token refresh is temporarily empty', async () => {
    mockReadHistory.mockResolvedValueOnce([row('existing')]);
    render(<TokenDetailHistoryList {...props} />);
    await flush();
    expect(mockListProps.list.map((item: any) => item.id)).toEqual([
      'existing',
    ]);

    await act(async () => mockListProps.onRefresh());
    await flush();

    expect(mockListProps.list.map((item: any) => item.id)).toEqual([
      'existing',
    ]);
    expect(mockListProps.refreshLoading).toBeFalsy();
  });

  it('starts a fresh request when the token changes without changing account', async () => {
    mockReadHistory
      .mockResolvedValueOnce([row('token-a-history')])
      .mockResolvedValueOnce([row('token-b-history')]);
    const view = render(<TokenDetailHistoryList {...props} />);
    await flush();
    view.rerender(
      <TokenDetailHistoryList
        {...props}
        token={{ ...token, id: 'token-b' } as any}
      />,
    );
    await flush();

    expect(mockReadHistory).toHaveBeenLastCalledWith(
      '0xabc',
      0,
      'token-b',
      'eth',
      20,
    );
    expect(mockListProps.list.map((item: any) => item.id)).toEqual([
      'token-b-history',
    ]);
  });

  it('discards a response from a previous account, even if it finishes last', async () => {
    const oldRequest = deferred<any[]>();
    mockReadHistory
      .mockReturnValueOnce(oldRequest.promise)
      .mockResolvedValueOnce([row('new-account')]);
    const view = render(<TokenDetailHistoryList {...props} />);
    await flush();
    view.rerender(
      <TokenDetailHistoryList
        {...props}
        finalAccount={{ ...account, address: '0xdef' } as any}
      />,
    );
    await flush();
    await act(async () => oldRequest.resolve([row('old-account')]));
    expect(mockListProps.list.map((item: any) => item.id)).toEqual([
      'new-account',
    ]);
    expect(mockListProps.list[0].account.address).toBe('0xdef');
  });

  it('does not show a failure toast for a previous token request', async () => {
    const oldRequest = deferred<any[]>();
    mockReadHistory
      .mockReturnValueOnce(oldRequest.promise)
      .mockResolvedValueOnce([row('new-token')]);
    const view = render(<TokenDetailHistoryList {...props} />);
    await flush();
    view.rerender(
      <TokenDetailHistoryList
        {...props}
        token={{ ...token, id: 'token-b' } as any}
      />,
    );
    await flush();
    await act(async () => oldRequest.reject(new Error('old request failed')));
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockListProps.list.map((item: any) => item.id)).toEqual([
      'new-token',
    ]);
  });

  it('isolates a DB request when the same address switches to the API source', async () => {
    const oldRequest = deferred<any[]>();
    mockReadHistory.mockReturnValueOnce(oldRequest.promise);
    mockReadApiHistory.mockResolvedValueOnce({
      history_list: [
        { id: 'api-row', chain: 'eth', time_at: 10, receives: [], sends: [] },
      ],
      project_dict: {},
      token_dict: {},
    });
    const view = render(<TokenDetailHistoryList {...props} />);
    await flush();
    view.rerender(
      <TokenDetailHistoryList
        {...props}
        finalAccount={{ ...account, type: 'Watch Address' } as any}
      />,
    );
    await flush();
    await act(async () => oldRequest.resolve([row('stale-db-row')]));
    expect(mockListProps.list.map((item: any) => item.id)).toEqual(['api-row']);
    expect(mockReadApiHistory).toHaveBeenCalledTimes(1);
  });

  it('keeps the newest result when two refreshes resolve out of order', async () => {
    const earlier = deferred<any[]>();
    mockReadHistory
      .mockResolvedValueOnce([row('initial')])
      .mockReturnValueOnce(earlier.promise)
      .mockResolvedValueOnce([row('latest')]);
    render(<TokenDetailHistoryList {...props} />);
    await flush();
    act(() => mockListProps.onRefresh());
    await act(async () => mockListProps.onRefresh());
    await flush();
    await act(async () => earlier.resolve([row('earlier')]));
    expect(mockListProps.list.map((item: any) => item.id)).toEqual(['latest']);
  });

  it('preserves pagination eligibility and cursor after an empty refresh', async () => {
    mockReadHistory
      .mockResolvedValueOnce(
        Array.from({ length: 20 }, (_, index) =>
          row(`row-${index}`, 100 - index),
        ),
      )
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([row('older', 50)]);
    render(<TokenDetailHistoryList {...props} />);
    await flush();
    await act(async () => mockListProps.onRefresh());
    await flush();
    await act(async () => mockListProps.loadMore());
    await flush();
    expect(mockReadHistory).toHaveBeenLastCalledWith(
      '0xabc',
      81,
      'token-a',
      'eth',
      20,
    );
    expect(mockListProps.list).toHaveLength(21);
  });

  it('honors disableHistoryRequest and requests again when enabled', async () => {
    const view = render(
      <TokenDetailHistoryList {...props} disableHistoryRequest />,
    );
    await flush();
    await act(async () => mockListProps.onRefresh());
    expect(mockReadHistory).not.toHaveBeenCalled();
    mockReadHistory.mockResolvedValueOnce([row('enabled')]);
    view.rerender(
      <TokenDetailHistoryList {...props} disableHistoryRequest={false} />,
    );
    await flush();
    expect(mockListProps.list.map((item: any) => item.id)).toEqual(['enabled']);
  });

  it('keeps rows and the retry cursor after a page fails', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) =>
      row(`row-${index}`, 100 - index),
    );
    mockReadHistory
      .mockResolvedValueOnce(firstPage)
      .mockRejectedValueOnce(new Error('page failed'))
      .mockResolvedValueOnce([row('older', 50)]);
    render(<TokenDetailHistoryList {...props} />);
    await flush();
    await act(async () => mockListProps.loadMore());
    await flush();
    expect(mockListProps.list).toHaveLength(20);
    expect(mockListProps.loadingMore).toBe(false);
    expect(mockToastError).toHaveBeenCalledTimes(1);
    await act(async () => mockListProps.loadMore());
    await flush();
    expect(mockReadHistory.mock.calls.slice(1).map(call => call[1])).toEqual([
      81, 81,
    ]);
    expect(mockListProps.list).toHaveLength(21);
  });

  it('deduplicates an overlapping page and stops when the cursor cannot advance', async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) =>
      row(`row-${index}`, 100 - index),
    );
    mockReadHistory.mockResolvedValue(firstPage);
    render(<TokenDetailHistoryList {...props} />);
    await flush();
    await act(async () => {
      mockListProps.loadMore();
      mockListProps.loadMore();
    });
    await flush();
    expect(mockListProps.list).toHaveLength(20);
    expect(mockReadHistory).toHaveBeenCalledTimes(2);
    await act(async () => mockListProps.loadMore());
    expect(mockReadHistory).toHaveBeenCalledTimes(2);
  });

  it('lets refresh supersede an in-flight next page', async () => {
    const pendingPage = deferred<any[]>();
    mockReadHistory
      .mockResolvedValueOnce(
        Array.from({ length: 20 }, (_, index) =>
          row(`row-${index}`, 100 - index),
        ),
      )
      .mockReturnValueOnce(pendingPage.promise)
      .mockResolvedValueOnce([row('fresh', 200)]);
    render(<TokenDetailHistoryList {...props} />);
    await flush();
    act(() => mockListProps.loadMore());
    await act(async () => mockListProps.onRefresh());
    await flush();
    await act(async () => pendingPage.resolve([row('stale-page', 50)]));
    expect(mockListProps.list.map((item: any) => item.id)).toEqual(['fresh']);
    expect(mockListProps.loadingMore).toBe(false);
  });

  it('reloads only after a successful DB update for this account', async () => {
    mockReadHistory
      .mockResolvedValueOnce([row('existing')])
      .mockResolvedValueOnce([row('updated')]);
    render(<TokenDetailHistoryList {...props} />);
    await flush();
    act(() => {
      mockOnHistoryUpsert({ success: true, owner_addr: '0xdef' });
      mockOnHistoryUpsert({ success: false, owner_addr: '0xabc' });
    });
    expect(mockReadHistory).toHaveBeenCalledTimes(1);
    await act(async () =>
      mockOnHistoryUpsert({ success: true, owner_addr: '0xABC' }),
    );
    await flush();
    expect(mockListProps.list.map((item: any) => item.id)).toEqual(['updated']);
  });

  it('revalidates the loaded window on DB upsert without collapsing to one page', async () => {
    const rows = Array.from({ length: 40 }, (_, index) =>
      row(`row-${index}`, 100 - index),
    );
    mockReadHistory
      .mockResolvedValueOnce(rows.slice(0, 20))
      .mockResolvedValueOnce(rows.slice(20))
      .mockResolvedValueOnce(rows);
    render(<TokenDetailHistoryList {...props} />);
    await flush();
    await act(async () => mockListProps.loadMore());
    await flush();
    expect(mockListProps.list).toHaveLength(40);
    await act(async () =>
      mockOnHistoryUpsert({ success: true, owner_addr: account.address }),
    );
    await flush();
    expect(mockReadHistory).toHaveBeenLastCalledWith(
      '0xabc',
      0,
      'token-a',
      'eth',
      40,
    );
    expect(mockListProps.list).toHaveLength(40);
  });

  it('does not reread DB for hidden screens and catches up when focused again', async () => {
    jest.useFakeTimers();
    try {
      mockReadHistory.mockResolvedValue([row('existing')]);
      const view = render(<TokenDetailHistoryList {...props} />);
      await flush();
      // First event runs immediately; second has a trailing debounce pending.
      await act(async () => {
        mockOnHistoryUpsert({ success: true, owner_addr: account.address });
        mockOnHistoryUpsert({ success: true, owner_addr: account.address });
      });
      expect(mockReadHistory).toHaveBeenCalledTimes(2);
      mockIsFocused = false;
      view.rerender(<TokenDetailHistoryList {...props} />);
      await act(async () => {
        mockOnHistoryUpsert({ success: true, owner_addr: account.address });
        jest.advanceTimersByTime(2000);
      });
      expect(mockReadHistory).toHaveBeenCalledTimes(2);
      mockIsFocused = true;
      view.rerender(<TokenDetailHistoryList {...props} />);
      await flush();
      expect(mockReadHistory).toHaveBeenCalledTimes(3);
    } finally {
      jest.useRealTimers();
    }
  });
});
