import type { AppChainItem } from '@rabby-wallet/rabby-api/dist/types';

describe('store/appchain batch refresh', () => {
  const mockGetAppChainList = jest.fn();
  const mockIsExpired = jest.fn();
  const mockQueryByOwner = jest.fn();
  const mockPersist = jest.fn();
  const mockRemoteError = jest.fn();
  let store: typeof import('./appchain').useAppChainStore;
  const app: AppChainItem = {
    id: 'test-app',
    name: 'Test',
    site_url: '',
    logo_url: '',
    is_support_portfolio: true,
    is_visible: true,
    portfolio_item_list: [],
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockGetAppChainList.mockReset().mockResolvedValue({ apps: [app] });
    mockIsExpired.mockReset();
    mockIsExpired.mockResolvedValue(true);
    mockQueryByOwner.mockResolvedValue([app]);
    mockPersist.mockResolvedValue(undefined);
    jest.doMock('@/core/request', () => ({
      openapi: { getAppChainList: mockGetAppChainList },
    }));
    jest.doMock('@/core/utils/reexports', () => ({
      zCreate: require('zustand').create,
    }));
    jest.doMock('@/databases/entities/appchain', () => ({
      AppChainEntity: {
        isExpired: mockIsExpired,
        queryByOwner: mockQueryByOwner,
      },
    }));
    jest.doMock('@/databases/sync/_task', () => ({
      batchSaveWithPQueueAndTransaction: jest.fn(),
    }));
    jest.doMock('@/core/utils/startupDiagnostics', () => ({
      traceStartupDiagnostic: jest.fn(),
    }));
    jest.doMock('@/core/utils/homeStartupReady', () => ({
      runAfterHomePostStartupReady: jest.fn(),
    }));
    jest.doMock('@/databases/sync/abort', () => ({
      registerSyncAbortHandler: jest.fn(),
    }));
    jest.doMock('./appchainResource', () => ({
      appChainResourceStore: {
        markHydrateStartedFor: jest.fn(),
        markHydrateSkippedFor: jest.fn(),
        hydrate: jest.fn(),
        startRemoteFetchFor: jest.fn(),
        applyRemoteValueFor: jest.fn(),
        markRemoteErrorFor: mockRemoteError,
        persistInBackgroundFor: mockPersist,
      },
    }));
    store = require('./appchain').useAppChainStore;
  });

  it('requests and persists each distinct address separately', async () => {
    await store.getState().batchGetAppChains(['0xA', '0xB', '0xa']);

    expect(mockGetAppChainList.mock.calls).toEqual([['0xa'], ['0xb']]);
    expect(mockPersist).toHaveBeenCalledTimes(2);
    expect(Object.keys(store.getState().appChainMap)).toHaveLength(2);
    expect(store.getState().isLoadingByAddress).toEqual({
      '0xa': false,
      '0xb': false,
    });
  });

  it('does not request or rewrite fresh caches', async () => {
    mockIsExpired.mockResolvedValue(false);
    await store.getState().batchGetAppChains(['0xA', '0xB']);
    expect(mockGetAppChainList).not.toHaveBeenCalled();
    expect(mockPersist).not.toHaveBeenCalled();
    expect(store.getState().appChainMap['0xa']).toEqual([
      { ...app, netWorth: 0 },
    ]);
  });

  it('bypasses fresh caches for forced refreshes', async () => {
    mockIsExpired.mockResolvedValue(false);
    await store.getState().batchGetAppChains(['0xA', '0xB'], true);
    expect(mockIsExpired).not.toHaveBeenCalled();
    expect(mockGetAppChainList.mock.calls).toEqual([['0xa'], ['0xb']]);
    expect(mockPersist).toHaveBeenCalledTimes(2);
  });

  it('keeps fresh and failed addresses and accepts a successful empty list', async () => {
    const oldValue = [{ ...app, netWorth: 99 }];
    store.setState({ appChainMap: { '0xb': oldValue, '0xc': oldValue } });
    mockIsExpired.mockImplementation(
      async (address: string) => address !== '0xa',
    );
    mockGetAppChainList
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ apps: [] });
    await store.getState().batchGetAppChains(['0xA', '0xB', '0xC']);

    expect(mockGetAppChainList.mock.calls).toEqual([['0xb'], ['0xc']]);
    expect(store.getState().appChainMap['0xb']).toBe(oldValue);
    expect(store.getState().appChainMap['0xc']).toEqual([]);
    expect(mockPersist).toHaveBeenCalledTimes(1);
    expect(mockPersist).toHaveBeenCalledWith(
      '0xc',
      expect.any(Function),
      expect.any(Object),
    );
    expect(mockRemoteError).toHaveBeenCalledTimes(1);
    expect(store.getState().isLoadingByAddress).toEqual({
      '0xa': false,
      '0xb': false,
      '0xc': false,
    });
  });

  it('keeps stale data without writing when the request fails', async () => {
    const oldValue = [{ ...app, netWorth: 99 }];
    store.setState({ appChainMap: { '0xa': oldValue } });
    mockGetAppChainList.mockRejectedValue(new Error('offline'));
    await store.getState().batchGetAppChains(['0xA']);
    expect(store.getState().appChainMap['0xa']).toBe(oldValue);
    expect(store.getState().isLoadingByAddress['0xa']).toBe(false);
    expect(mockPersist).not.toHaveBeenCalled();
    expect(mockRemoteError).toHaveBeenCalledTimes(1);
  });
});
