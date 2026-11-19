import type { AppChainItem } from '@rabby-wallet/rabby-api/dist/types';

describe('store/appchain batch refresh', () => {
  const mockBatch = jest.fn();
  const mockSingle = jest.fn();
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
    mockBatch.mockReset();
    mockBatch.mockImplementation(async (addresses: string[]) =>
      addresses.map(id => ({ id, error_code: 0, apps: [app], error_apps: [] })),
    );
    mockIsExpired.mockReset();
    mockIsExpired.mockResolvedValue(true);
    mockQueryByOwner.mockResolvedValue([app]);
    mockPersist.mockResolvedValue(undefined);
    jest.doMock('@/core/request', () => ({
      openapi: { getAppChainListBatch: mockBatch, getAppChainList: mockSingle },
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

  it.each([10, 12])(
    'batches %i missing addresses with the API limit and keeps per-address persistence',
    async count => {
      const addresses = Array.from(
        { length: count },
        (_, i) => `0xaddr${i.toString().padStart(2, '0')}`,
      );
      await store
        .getState()
        .batchGetAppChains([...addresses, addresses[0].toUpperCase()]);

      expect(mockBatch.mock.calls.map(([ids]) => ids)).toEqual(
        count === 10
          ? [addresses]
          : [addresses.slice(0, 10), addresses.slice(10)],
      );
      expect(mockSingle).not.toHaveBeenCalled();
      expect(mockPersist).toHaveBeenCalledTimes(count);
      expect(Object.keys(store.getState().appChainMap)).toHaveLength(count);
      expect(
        Object.values(store.getState().isLoadingByAddress).every(
          value => !value,
        ),
      ).toBe(true);
    },
  );

  it('does not request or rewrite fresh caches', async () => {
    mockIsExpired.mockResolvedValue(false);
    await store.getState().batchGetAppChains(['0xA', '0xB']);
    expect(mockBatch).not.toHaveBeenCalled();
    expect(mockPersist).not.toHaveBeenCalled();
    expect(store.getState().appChainMap['0xa']).toEqual([
      { ...app, netWorth: 0 },
    ]);
  });

  it('bypasses fresh caches for forced refreshes', async () => {
    mockIsExpired.mockResolvedValue(false);
    await store.getState().batchGetAppChains(['0xA', '0xB'], true);
    expect(mockIsExpired).not.toHaveBeenCalled();
    expect(mockBatch).toHaveBeenCalledWith(['0xa', '0xb']);
    expect(mockPersist).toHaveBeenCalledTimes(2);
  });

  it('keeps fresh and failed addresses and accepts a successful empty list', async () => {
    const oldValue = [{ ...app, netWorth: 99 }];
    store.setState({ appChainMap: { '0xb': oldValue, '0xc': oldValue } });
    mockIsExpired.mockImplementation(
      async (address: string) => address !== '0xa',
    );
    mockBatch.mockResolvedValue([
      { id: '0xC', error_code: 0, apps: [], error_apps: [] },
      { id: '0xB', error_code: 1 },
    ]);
    await store.getState().batchGetAppChains(['0xA', '0xB', '0xC']);

    expect(mockBatch).toHaveBeenCalledWith(['0xb', '0xc']);
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

  it.each(['request failure', 'missing result'])(
    'preserves old data and clears loading on %s',
    async failure => {
      const oldValue = [{ ...app, netWorth: 99 }];
      store.setState({ appChainMap: { '0xa': oldValue } });
      if (failure === 'request failure') {
        mockBatch.mockRejectedValue(new Error('offline'));
      } else {
        mockBatch.mockResolvedValue([]);
      }
      await store.getState().batchGetAppChains(['0xA']);
      expect(store.getState().appChainMap['0xa']).toBe(oldValue);
      expect(store.getState().isLoadingByAddress['0xa']).toBe(false);
      expect(mockPersist).not.toHaveBeenCalled();
      expect(mockRemoteError).toHaveBeenCalledTimes(1);
    },
  );
});
