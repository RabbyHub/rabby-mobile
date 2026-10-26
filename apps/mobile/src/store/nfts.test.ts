import type { DisplayNftItem } from '@/types/assets';

const mockGetSelectedBalanceAddressesSnapshot = jest.fn(() => [] as string[]);
const mockGetTop10MyAccounts = jest.fn();
const mockIsHomeAssetSelectionExperimentEnabled = jest.fn(() => false);

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));
jest.mock('@/databases/hooks/assets', () => ({
  syncNFTs: jest.fn(),
}));
jest.mock('@/databases/sync/assets', () => ({
  syncRemoteNFTs: jest.fn(),
}));
jest.mock('@/databases/entities/nftItem', () => ({
  NFTItemEntity: {
    batchMultiAddressNFTsByResourceIds: jest.fn(async () => []),
    batchMultAddressNFTs: jest.fn(async () => []),
  },
}));
jest.mock('@/store/balance', () => ({
  getSelectedBalanceAddressesSnapshot: (...args: unknown[]) =>
    mockGetSelectedBalanceAddressesSnapshot(...args),
}));
jest.mock('@/core/apis/account', () => ({
  getTop10MyAccounts: (...args: unknown[]) => mockGetTop10MyAccounts(...args),
}));
jest.mock('@/hooks/appSettings', () => ({
  isHomeAssetSelectionExperimentEnabled: (...args: unknown[]) =>
    mockIsHomeAssetSelectionExperimentEnabled(...args),
}));
jest.mock('@/core/utils/assetDataLoadDiagnostics', () => ({
  beginAssetDataLoadDiagnostic: jest.fn(() => ({
    fail: jest.fn(),
    finish: jest.fn(),
    mark: jest.fn(),
  })),
}));
jest.mock('./assetProjectionPersistence', () => ({
  isAssetProjectionPersistenceActive: jest.fn(() => false),
  restoreAssetProjection: jest.fn(async () => null),
  scheduleAssetProjectionPersistence: jest.fn(),
  subscribeAssetProjectionDatabaseCommits: jest.fn(),
}));

import { syncNFTs } from '@/databases/hooks/assets';
import { NFTItemEntity } from '@/databases/entities/nftItem';
import { syncRemoteNFTs } from '@/databases/sync/assets';
import nftListStore, {
  buildNftEntityId,
  nftCollectionResourceStore,
  nftEntityResourceStore,
  useNftListComputedStore,
} from './nfts';
import {
  restoreAssetProjection,
  scheduleAssetProjectionPersistence,
} from './assetProjectionPersistence';

const mockedSyncNFTs = jest.mocked(syncNFTs);
const mockedNftEntity = jest.mocked(NFTItemEntity);
const mockedSyncRemoteNFTs = jest.mocked(syncRemoteNFTs);
const mockedScheduleAssetProjectionPersistence = jest.mocked(
  scheduleAssetProjectionPersistence,
);
const mockedRestoreAssetProjection = jest.mocked(restoreAssetProjection);
const ADDRESS = '0xabc';
const cachedNft = {
  id: 'cached',
  inner_id: 'cached-inner',
  owner_addr: ADDRESS,
  chain: 'eth',
} as DisplayNftItem;

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(next => {
    resolve = next;
  });
  return { promise, resolve };
};

const waitFor = async (predicate: () => boolean) => {
  for (let index = 0; index < 20; index += 1) {
    if (predicate()) {
      return;
    }
    await Promise.resolve();
  }
  throw new Error('condition was not reached');
};

const clearResourceStore = (store: {
  getState: () => {
    valueMap: Record<string, unknown>;
    metaMap: Record<string, unknown>;
  };
  removeResource: (resourceKey: string) => boolean;
}) => {
  const state = store.getState();
  new Set([
    ...Object.keys(state.valueMap),
    ...Object.keys(state.metaMap),
  ]).forEach(resourceKey => store.removeResource(resourceKey));
};

describe('NFT list refresh semantics', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    mockedSyncNFTs.mockReset();
    mockedNftEntity.batchMultiAddressNFTsByResourceIds.mockReset();
    mockedNftEntity.batchMultiAddressNFTsByResourceIds.mockResolvedValue([]);
    mockedNftEntity.batchMultAddressNFTs.mockReset();
    mockedNftEntity.batchMultAddressNFTs.mockResolvedValue([]);
    mockedSyncRemoteNFTs.mockReset();
    mockedSyncRemoteNFTs.mockResolvedValue(undefined);
    mockedScheduleAssetProjectionPersistence.mockClear();
    mockGetSelectedBalanceAddressesSnapshot.mockReset();
    mockGetSelectedBalanceAddressesSnapshot.mockReturnValue([]);
    mockGetTop10MyAccounts.mockReset();
    mockGetTop10MyAccounts.mockResolvedValue({
      top10Addresses: [],
    });
    mockIsHomeAssetSelectionExperimentEnabled.mockReset();
    mockIsHomeAssetSelectionExperimentEnabled.mockReturnValue(false);
    clearResourceStore(nftEntityResourceStore);
    clearResourceStore(nftCollectionResourceStore);
    useNftListComputedStore.setState({
      multiNftsIndexCache: {},
      singleNftsIndexCache: {},
      multiNftsAvailabilityByKey: {},
      singleNftsAvailabilityByKey: {},
    });
    nftListStore.setState({
      nftsMap: { [ADDRESS]: [cachedNft] },
      sourceSnapshotReadyByAddress: { [ADDRESS]: true },
      isLoading: false,
      isFirstFetch: false,
      shortCache: false,
      singleLoadStatusByAddress: {},
    });
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('restores a persisted projection through exact NFT resources only', async () => {
    const restored = {
      ...cachedNft,
      collection: {},
      collection_id: 'collection-restored',
      id: 'restored',
      inner_id: 'restored-inner',
    } as DisplayNftItem;
    const nftId = buildNftEntityId(restored);
    mockedRestoreAssetProjection.mockResolvedValueOnce({
      rows: [{ type: 'nft', id: nftId }],
      groups: [],
      metadata: { defaultVisibleRowCount: 1 },
    } as never);
    mockedNftEntity.batchMultiAddressNFTsByResourceIds.mockResolvedValueOnce([
      restored,
    ] as never);
    nftListStore.setState({
      nftsMap: {},
      sourceSnapshotReadyByAddress: {},
    });

    const key = useNftListComputedStore.getState().registerSingleNfts(ADDRESS);

    await waitFor(
      () =>
        mockedNftEntity.batchMultiAddressNFTsByResourceIds.mock.calls.length >
        0,
    );
    await waitFor(
      () =>
        useNftListComputedStore.getState().singleNftsIndexCache[key]?.rows
          .length === 1,
    );

    expect(
      mockedNftEntity.batchMultiAddressNFTsByResourceIds,
    ).toHaveBeenCalledWith([nftId]);
    expect(mockedNftEntity.batchMultAddressNFTs).not.toHaveBeenCalled();
  });

  it('clears stale NFTs after a successful empty snapshot', async () => {
    mockedSyncNFTs.mockImplementation(
      async (_address, _force, _only, options) => {
        options?.beforeRemote?.();
        return { status: 'snapshot', nfts: [], remoteNfts: [] };
      },
    );

    await nftListStore.getState().getNFTList(ADDRESS, true);

    expect(nftListStore.getState().nftsMap[ADDRESS]).toEqual([]);
    expect(mockedSyncRemoteNFTs).toHaveBeenCalledWith(ADDRESS, []);
  });

  it('retains usable NFTs when the source reports no update', async () => {
    mockedSyncNFTs.mockResolvedValue({ status: 'unchanged' });

    await nftListStore.getState().getNFTList(ADDRESS, false);

    expect(nftListStore.getState().nftsMap[ADDRESS]).toEqual([cachedNft]);
  });

  it('retains usable NFTs when refresh fails', async () => {
    mockedSyncNFTs.mockRejectedValue(new Error('network failed'));

    await nftListStore.getState().getNFTList(ADDRESS, true);

    expect(nftListStore.getState().nftsMap[ADDRESS]).toEqual([cachedNft]);
    expect(consoleError).toHaveBeenCalledWith(
      'ServiceErrorType.NFT',
      expect.any(Error),
    );
  });

  it('does not let an older remote result overwrite or persist after a newer request', async () => {
    const older = createDeferred<{
      status: 'snapshot';
      nfts: DisplayNftItem[];
      remoteNfts: DisplayNftItem[];
    }>();
    const newer = createDeferred<{
      status: 'snapshot';
      nfts: DisplayNftItem[];
      remoteNfts: DisplayNftItem[];
    }>();
    const olderNft = { ...cachedNft, id: 'older' };
    const newerNft = { ...cachedNft, id: 'newer' };
    mockedSyncNFTs
      .mockImplementationOnce(async (_address, _force, _only, options) => {
        expect(options?.beforeRemote?.()).toBe(true);
        return older.promise;
      })
      .mockImplementationOnce(async (_address, _force, _only, options) => {
        expect(options?.beforeRemote?.()).toBe(true);
        return newer.promise;
      });

    const olderRequest = nftListStore
      .getState()
      .getNFTListWithCache(ADDRESS, false, false, { skipCache: true });
    const newerRequest = nftListStore
      .getState()
      .getNFTListWithCache(ADDRESS, true, false, { skipCache: true });

    newer.resolve({
      status: 'snapshot',
      nfts: [newerNft],
      remoteNfts: [newerNft],
    });
    await newerRequest;
    expect(nftListStore.getState().singleLoadStatusByAddress[ADDRESS]).toBe(
      'ready',
    );
    older.resolve({
      status: 'snapshot',
      nfts: [olderNft],
      remoteNfts: [olderNft],
    });
    await olderRequest;

    expect(nftListStore.getState().nftsMap[ADDRESS]).toEqual([newerNft]);
    expect(mockedSyncRemoteNFTs).toHaveBeenCalledTimes(1);
    expect(mockedSyncRemoteNFTs).toHaveBeenCalledWith(ADDRESS, [newerNft]);
  });

  it('does not let a late SQLite snapshot overwrite a remote snapshot', async () => {
    const cache = createDeferred<DisplayNftItem[]>();
    const remoteNft = { ...cachedNft, id: 'remote' };
    mockedNftEntity.batchMultAddressNFTs.mockReturnValue(
      cache.promise as never,
    );
    mockedSyncNFTs.mockImplementation(
      async (_address, _force, _only, options) => {
        expect(options?.beforeRemote?.()).toBe(true);
        return {
          status: 'snapshot',
          nfts: [remoteNft],
          remoteNfts: [remoteNft],
        };
      },
    );

    const cacheRequest = nftListStore.getState().hydrateSingleNftCache(ADDRESS);
    await nftListStore
      .getState()
      .getNFTListWithCache(ADDRESS, true, false, { skipCache: true });
    cache.resolve([{ ...cachedNft, id: 'late-cache' }]);
    await cacheRequest;

    expect(nftListStore.getState().nftsMap[ADDRESS]).toEqual([remoteNft]);
  });

  it('does not let an older multi-address result overwrite a newer single-address result', async () => {
    const older = createDeferred<{
      status: 'snapshot';
      nfts: DisplayNftItem[];
      remoteNfts: DisplayNftItem[];
    }>();
    const newer = createDeferred<{
      status: 'snapshot';
      nfts: DisplayNftItem[];
      remoteNfts: DisplayNftItem[];
    }>();
    const olderNft = { ...cachedNft, id: 'older-multi' };
    const newerNft = { ...cachedNft, id: 'newer-single' };
    mockedSyncNFTs
      .mockImplementationOnce(async (_address, _force, _only, options) => {
        expect(options?.beforeRemote?.()).toBe(true);
        return older.promise;
      })
      .mockImplementationOnce(async (_address, _force, _only, options) => {
        expect(options?.beforeRemote?.()).toBe(true);
        return newer.promise;
      });

    const olderRequest = nftListStore
      .getState()
      .batchGetNFTList(true, { realTimeAddresses: [ADDRESS] });
    await waitFor(() => mockedSyncNFTs.mock.calls.length === 1);
    const newerRequest = nftListStore
      .getState()
      .getNFTListWithCache(ADDRESS, true, false, { skipCache: true });
    await waitFor(() => mockedSyncNFTs.mock.calls.length === 2);

    newer.resolve({
      status: 'snapshot',
      nfts: [newerNft],
      remoteNfts: [newerNft],
    });
    await newerRequest;
    expect(nftListStore.getState().singleLoadStatusByAddress[ADDRESS]).toBe(
      'ready',
    );
    older.resolve({
      status: 'snapshot',
      nfts: [olderNft],
      remoteNfts: [olderNft],
    });
    await olderRequest;

    expect(nftListStore.getState().nftsMap[ADDRESS]).toEqual([newerNft]);
    expect(mockedSyncRemoteNFTs).toHaveBeenCalledTimes(1);
    expect(mockedSyncRemoteNFTs).toHaveBeenCalledWith(ADDRESS, [newerNft]);
  });

  it('uses the active balance selection for multi-address refreshes', async () => {
    const selectedAddresses = ['0xselected-a', '0xselected-b'];
    mockGetSelectedBalanceAddressesSnapshot.mockReturnValue(selectedAddresses);
    mockedSyncNFTs.mockResolvedValue({
      status: 'snapshot',
      nfts: [],
      remoteNfts: [],
    });

    await nftListStore.getState().batchGetNFTList(true);

    expect(mockedSyncNFTs).toHaveBeenCalledTimes(selectedAddresses.length);
    expect(mockedSyncNFTs.mock.calls.map(([address]) => address)).toEqual(
      selectedAddresses,
    );
  });

  it('retains the legacy Top-10 fallback until normal selection resolves', async () => {
    mockGetTop10MyAccounts.mockResolvedValue({
      top10Addresses: ['0xlegacy'],
    });
    mockedSyncNFTs.mockResolvedValue({
      status: 'snapshot',
      nfts: [],
      remoteNfts: [],
    });

    await nftListStore.getState().batchGetNFTList(true);

    expect(mockGetTop10MyAccounts).toHaveBeenCalledTimes(1);
    expect(mockedSyncNFTs.mock.calls[0]?.[0]).toBe('0xlegacy');
  });

  it('does not fall back to Top-10 while an experimental selection is unresolved', async () => {
    mockIsHomeAssetSelectionExperimentEnabled.mockReturnValue(true);

    await nftListStore.getState().batchGetNFTList(true);

    expect(mockGetTop10MyAccounts).not.toHaveBeenCalled();
    expect(mockedSyncNFTs).not.toHaveBeenCalled();
  });

  it('uses the active balance selection for short cache hydration', async () => {
    const selectedAddresses = ['0xselected-a', '0xselected-b'];
    mockGetSelectedBalanceAddressesSnapshot.mockReturnValue(selectedAddresses);
    nftListStore.setState({
      nftsMap: {},
      shortCache: false,
    });

    await nftListStore.getState().getCacheTop10NFTs({ maxNFTLength: 5 });
    await new Promise(resolve => setTimeout(resolve, 0));
    await waitFor(
      () => mockedNftEntity.batchMultAddressNFTs.mock.calls.length === 1,
    );

    expect(mockedNftEntity.batchMultAddressNFTs).toHaveBeenCalledWith(
      selectedAddresses,
      undefined,
      5,
    );
  });

  it('contains a rejected background persistence task', async () => {
    const remoteNft = { ...cachedNft, id: 'remote' };
    const persistenceError = new Error('database unavailable');
    mockedSyncNFTs.mockImplementation(
      async (_address, _force, _only, options) => {
        options?.beforeRemote?.();
        return {
          status: 'snapshot',
          nfts: [remoteNft],
          remoteNfts: [remoteNft],
        };
      },
    );
    mockedSyncRemoteNFTs.mockRejectedValueOnce(persistenceError);

    await nftListStore.getState().getNFTList(ADDRESS, true);
    await Promise.resolve();

    expect(nftListStore.getState().nftsMap[ADDRESS]).toEqual([remoteNft]);
    expect(consoleError).toHaveBeenCalledWith(
      '[nft] background persistence failed',
      persistenceError,
    );
  });

  it('does not let a late bounded cache query overwrite a runtime update', async () => {
    const cache = createDeferred<DisplayNftItem[]>();
    const runtimeNft = { ...cachedNft, id: 'runtime' };
    mockedNftEntity.batchMultAddressNFTs.mockReturnValue(
      cache.promise as never,
    );

    const cacheRequest = nftListStore
      .getState()
      .batchLoadCacheNFT([ADDRESS], { maxLength: 5 });
    await waitFor(
      () => mockedNftEntity.batchMultAddressNFTs.mock.calls.length === 1,
    );
    nftListStore.getState().updateNFTListByAddress(ADDRESS, [runtimeNft]);
    cache.resolve([{ ...cachedNft, id: 'late-bounded-cache' }]);
    await cacheRequest;

    expect(nftListStore.getState().nftsMap[ADDRESS]).toEqual([runtimeNft]);
  });

  it('shares NFT entities while keeping single and multi projections independent', () => {
    const secondAddress = '0xdef';
    const first = { ...cachedNft, id: 'first', name: 'first' };
    const second = {
      ...cachedNft,
      id: 'second',
      inner_id: 'second-inner',
      owner_addr: secondAddress,
      name: 'second',
    };
    nftListStore.setState({
      nftsMap: {
        [ADDRESS]: [first],
        [secondAddress]: [second],
      },
    });

    const singleKey = useNftListComputedStore
      .getState()
      .registerSingleNfts(ADDRESS);
    const multiKey = useNftListComputedStore
      .getState()
      .registerMultiNfts([ADDRESS, secondAddress]);
    const firstId = buildNftEntityId(first);
    const secondId = buildNftEntityId(second);
    const before = useNftListComputedStore.getState();
    const singleResult = before.singleNftsIndexCache[singleKey];
    const multiResult = before.multiNftsIndexCache[multiKey];

    expect(singleResult?.rows).toEqual([{ type: 'nft', nftId: firstId }]);
    expect(multiResult?.rows).toEqual([
      { type: 'nft', nftId: firstId },
      { type: 'nft', nftId: secondId },
    ]);
    expect(before.singleNftsAvailabilityByKey[singleKey]).toBe('ready');
    expect(before.multiNftsAvailabilityByKey[multiKey]).toBe('ready');

    nftListStore
      .getState()
      .updateNFTListByAddress(ADDRESS, [{ ...first, name: 'updated-first' }]);

    const after = useNftListComputedStore.getState();
    expect(after.singleNftsIndexCache[singleKey]).toBe(singleResult);
    expect(after.multiNftsIndexCache[multiKey]).toBe(multiResult);
    expect(nftEntityResourceStore.getValue(firstId)?.name).toBe(
      'updated-first',
    );
    expect(
      after.singleNftsIndexCache[singleKey]?.rows[0]?.type === 'nft'
        ? after.singleNftsIndexCache[singleKey]?.rows[0].nftId
        : undefined,
    ).toBe(
      after.multiNftsIndexCache[multiKey]?.rows[0]?.type === 'nft'
        ? after.multiNftsIndexCache[multiKey]?.rows[0].nftId
        : undefined,
    );
  });

  it('marks an explicit empty NFT snapshot as a ready projection', () => {
    nftListStore.setState({
      nftsMap: { [ADDRESS]: [] },
      sourceSnapshotReadyByAddress: {},
    });
    mockedScheduleAssetProjectionPersistence.mockClear();

    const key = useNftListComputedStore.getState().registerMultiNfts([ADDRESS]);

    expect(
      useNftListComputedStore.getState().multiNftsIndexCache[key]?.rows,
    ).toEqual([]);
    expect(
      useNftListComputedStore.getState().multiNftsAvailabilityByKey[key],
    ).toBe('unresolved');
    expect(mockedScheduleAssetProjectionPersistence).not.toHaveBeenCalled();

    nftListStore.setState({
      sourceSnapshotReadyByAddress: { [ADDRESS]: true },
    });

    expect(
      useNftListComputedStore.getState().multiNftsAvailabilityByKey[key],
    ).toBe('ready');
    expect(mockedScheduleAssetProjectionPersistence).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeKey: key,
        rows: [],
        scene: 'multi-address',
      }),
    );
  });
});
