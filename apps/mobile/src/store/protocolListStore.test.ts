import type { ComplexProtocol } from '@rabby-wallet/rabby-api/dist/types';
import type { IProtocolItem } from '@/types/assets';

jest.mock('@/databases/entities/portocolItem', () => ({
  ProtocolItemEntity: {
    batchMultiAddressProtocolsByResourceIds: jest.fn(async () => []),
    batchQueryProtocols: jest.fn(async () => []),
    getDefaultProtocolsByAddresses: jest.fn(async () => ({})),
    isExpired: jest.fn(async () => true),
  },
}));
jest.mock('@/databases/entities/appchain', () => ({
  AppChainEntity: {
    queryByProtocolResourceIds: jest.fn(async () => ({})),
    queryByOwners: jest.fn(async () => ({})),
  },
}));
jest.mock('@/databases/protocolAssetProjection', () => ({
  compileProtocolAssetSqlProjection: jest.fn(),
}));
jest.mock('@/databases/hooks/assets', () => ({
  loadAppChainComplexProtocols: jest.fn(async () => ({
    protocols: [],
    errorAppIds: [],
  })),
  loadProtocols: jest.fn(),
  loadProtocolsForAddresses: jest.fn(),
  syncSpecificProtocol: jest.fn(),
}));
jest.mock('@/databases/sync/assets', () => ({
  syncRemoteProtocols: jest.fn(),
  syncRemoteProtocolsForAddresses: jest.fn(),
}));
jest.mock('@/utils/appchain', () => ({
  formatAppChain: jest.fn(value => value),
  isAppChain: jest.fn((chain: string) => chain.startsWith('RABBY_APP_CHAIN_')),
}));
jest.mock('@/utils/lendingUserStatus', () => ({
  reportLendingUserStatusOnce: jest.fn(),
}));
jest.mock('@/utils/protocol', () => ({
  complexProtocol2ProtocolItem: jest.fn((value, address) => ({
    ...value,
    owner_addr: address.toLowerCase(),
  })),
}));
jest.mock('@/core/utils/startupPerfMarks', () => ({
  markStartupPerf: jest.fn(),
}));
jest.mock('@/store/balance', () => ({
  getSelectedBalanceAddressesSnapshot: jest.fn(() => []),
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
jest.mock('./protocolSyncExecutor', () => ({
  getProtocolSyncMode: jest.fn(() => 'js'),
  executeProtocolSync: jest.fn(async ({ executeJs }) => ({
    mode: 'js',
    value: await executeJs(),
  })),
}));
jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

import {
  loadProtocols,
  loadProtocolsForAddresses,
} from '@/databases/hooks/assets';
import {
  syncRemoteProtocols,
  syncRemoteProtocolsForAddresses,
} from '@/databases/sync/assets';
import { ProtocolItemEntity } from '@/databases/entities/portocolItem';
import { AppChainEntity } from '@/databases/entities/appchain';
import { compileProtocolAssetSqlProjection } from '@/databases/protocolAssetProjection';
import useProtocolListStore, {
  buildProtocolEntityId,
  protocolEntityResourceStore,
  useProtocolListComputedStore,
} from './protocols';
import {
  restoreAssetProjection,
  scheduleAssetProjectionPersistence,
} from './assetProjectionPersistence';
import { dispatchNativeAssetSyncCompletion } from './nativeAssetSyncReceipt';

const ADDRESS = '0xAbCd';
const NORMALIZED_ADDRESS = ADDRESS.toLowerCase();

const mockedLoadProtocols = jest.mocked(loadProtocols);
const mockedLoadProtocolsForAddresses = jest.mocked(loadProtocolsForAddresses);
const mockedSyncRemoteProtocols = jest.mocked(syncRemoteProtocols);
const mockedSyncRemoteProtocolsForAddresses = jest.mocked(
  syncRemoteProtocolsForAddresses,
);
const mockedProtocolItemEntity = jest.mocked(ProtocolItemEntity);
const mockedScheduleAssetProjectionPersistence = jest.mocked(
  scheduleAssetProjectionPersistence,
);
const mockedRestoreAssetProjection = jest.mocked(restoreAssetProjection);
const mockedAppChainEntity = jest.mocked(AppChainEntity);
const mockedCompileProtocolAssetSqlProjection = jest.mocked(
  compileProtocolAssetSqlProjection,
);

const createProtocol = (id: string, netWorth: number): IProtocolItem =>
  ({
    _portfolios: [],
    chain: 'eth',
    id,
    name: id,
    netWorth,
    owner_addr: NORMALIZED_ADDRESS,
  } as IProtocolItem);

const createRemoteProtocol = (id: string): ComplexProtocol =>
  ({
    chain: 'eth',
    id,
    name: id,
    portfolio_item_list: [],
  } as ComplexProtocol);

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
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

describe('protocol list request freshness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProtocolListComputedStore.setState({
      multiProtocolsIndexCache: {},
      singleProtocolsIndexCache: {},
      multiProtocolsAvailabilityByKey: {},
      singleProtocolsAvailabilityByKey: {},
    });
    useProtocolListStore.setState({
      hasLoadedByAddress: {},
      isLoading: false,
      isLoadingByAddress: {},
      protocolMap: {},
      sourceSnapshotReadyByAddress: {},
    });
  });

  it('restores a persisted projection through exact protocol resources only', async () => {
    const restored = createProtocol('restored-projection', 20);
    const protocolId = buildProtocolEntityId(restored);
    mockedRestoreAssetProjection.mockResolvedValueOnce({
      rows: [{ type: 'protocol', id: protocolId }],
      groups: [],
      metadata: {
        defaultVisibleProtocolCount: 1,
        foldedProtocolUsdValue: '',
      },
    } as never);
    mockedProtocolItemEntity.batchMultiAddressProtocolsByResourceIds.mockResolvedValueOnce(
      [restored] as never,
    );

    const key = useProtocolListComputedStore
      .getState()
      .registerSingleProtocols(ADDRESS);

    await waitFor(
      () =>
        mockedProtocolItemEntity.batchMultiAddressProtocolsByResourceIds.mock
          .calls.length > 0,
    );
    await waitFor(
      () =>
        useProtocolListComputedStore.getState().singleProtocolsIndexCache[key]
          ?.protocolIds.length === 1,
    );

    expect(
      mockedProtocolItemEntity.batchMultiAddressProtocolsByResourceIds,
    ).toHaveBeenCalledWith([protocolId]);
    expect(
      mockedProtocolItemEntity.getDefaultProtocolsByAddresses,
    ).not.toHaveBeenCalled();
    expect(
      mockedAppChainEntity.queryByProtocolResourceIds,
    ).toHaveBeenCalledWith([protocolId]);
  });

  it('does not let a late multi-address response overwrite a newer single-address response', async () => {
    const cached = createProtocol('cached', 1);
    const stale = createProtocol('stale', 2);
    const latest = createProtocol('latest', 3);
    const staleRemote = createRemoteProtocol('stale');
    const latestRemote = createRemoteProtocol('latest');
    useProtocolListStore.setState({
      protocolMap: { [NORMALIZED_ADDRESS]: [cached] },
    });
    const pendingStale = deferred<{
      protocolMap: Record<string, IProtocolItem[]>;
      remoteProtocolMap: Record<string, ComplexProtocol[]>;
    }>();
    mockedLoadProtocolsForAddresses.mockReturnValueOnce(pendingStale.promise);
    mockedLoadProtocols.mockResolvedValueOnce({
      address: NORMALIZED_ADDRESS,
      protocols: [latest],
      remoteProtocols: [latestRemote],
    });

    const staleRequest = useProtocolListStore
      .getState()
      .batchGetProtocols([ADDRESS], true);
    await waitFor(() => mockedLoadProtocolsForAddresses.mock.calls.length > 0);
    await useProtocolListStore.getState().getProtocols(ADDRESS, true);
    pendingStale.resolve({
      protocolMap: { [NORMALIZED_ADDRESS]: [stale] },
      remoteProtocolMap: { [NORMALIZED_ADDRESS]: [staleRemote] },
    });
    await staleRequest;

    expect(
      useProtocolListStore.getState().protocolMap[NORMALIZED_ADDRESS],
    ).toEqual([latest]);
    expect(mockedSyncRemoteProtocols).toHaveBeenCalledWith(NORMALIZED_ADDRESS, [
      latestRemote,
    ]);
    expect(mockedSyncRemoteProtocolsForAddresses).not.toHaveBeenCalled();
  });

  it('shares an in-flight multi-address refresh with a later manual force refresh', async () => {
    const pendingRemote = deferred<{
      protocolMap: Record<string, IProtocolItem[]>;
      remoteProtocolMap: Record<string, ComplexProtocol[]>;
    }>();
    mockedLoadProtocolsForAddresses.mockReturnValueOnce(pendingRemote.promise);

    const initialRequest = useProtocolListStore
      .getState()
      .batchGetProtocols([ADDRESS], false);
    await waitFor(
      () => mockedLoadProtocolsForAddresses.mock.calls.length === 1,
    );

    const manualRefresh = useProtocolListStore
      .getState()
      .batchGetProtocols([ADDRESS], true);

    expect(mockedLoadProtocolsForAddresses).toHaveBeenCalledTimes(1);
    pendingRemote.resolve({
      protocolMap: { [NORMALIZED_ADDRESS]: [createProtocol('fresh', 1)] },
      remoteProtocolMap: {
        [NORMALIZED_ADDRESS]: [createRemoteProtocol('fresh')],
      },
    });
    await Promise.all([initialRequest, manualRefresh]);

    expect(mockedLoadProtocolsForAddresses).toHaveBeenCalledTimes(1);
  });

  it('does not cancel active remote work when a newer call only uses fresh memory', async () => {
    const cached = createProtocol('cached', 1);
    const refreshed = createProtocol('refreshed', 2);
    const refreshedRemote = createRemoteProtocol('refreshed');
    useProtocolListStore.setState({
      protocolMap: { [NORMALIZED_ADDRESS]: [cached] },
    });
    mockedProtocolItemEntity.isExpired.mockResolvedValueOnce(false);
    const pendingRefresh = deferred<{
      address: string;
      protocols: IProtocolItem[];
      remoteProtocols: ComplexProtocol[];
    }>();
    mockedLoadProtocols.mockReturnValueOnce(pendingRefresh.promise);

    const remoteRefresh = useProtocolListStore
      .getState()
      .getProtocols(ADDRESS, true);
    await waitFor(() => mockedLoadProtocols.mock.calls.length > 0);
    await useProtocolListStore.getState().getProtocols(ADDRESS, false);
    pendingRefresh.resolve({
      address: NORMALIZED_ADDRESS,
      protocols: [refreshed],
      remoteProtocols: [refreshedRemote],
    });
    await remoteRefresh;

    expect(
      useProtocolListStore.getState().protocolMap[NORMALIZED_ADDRESS],
    ).toEqual([refreshed]);
  });

  it('does not let an older local hydration overwrite a remote refresh', async () => {
    const stale = createProtocol('stale', 1);
    const refreshed = createProtocol('refreshed', 2);
    const refreshedRemote = createRemoteProtocol('refreshed');
    mockedProtocolItemEntity.isExpired.mockResolvedValueOnce(false);
    const pendingHydration = deferred<Record<string, IProtocolItem[]>>();
    mockedProtocolItemEntity.getDefaultProtocolsByAddresses.mockReturnValueOnce(
      pendingHydration.promise as never,
    );
    mockedLoadProtocols.mockResolvedValueOnce({
      address: NORMALIZED_ADDRESS,
      protocols: [refreshed],
      remoteProtocols: [refreshedRemote],
    });

    const hydration = useProtocolListStore
      .getState()
      .getProtocols(ADDRESS, false);
    await waitFor(
      () =>
        mockedProtocolItemEntity.getDefaultProtocolsByAddresses.mock.calls
          .length > 0,
    );
    await useProtocolListStore.getState().getProtocols(ADDRESS, true);
    pendingHydration.resolve({ [NORMALIZED_ADDRESS]: [stale] });
    await hydration;

    expect(
      useProtocolListStore.getState().protocolMap[NORMALIZED_ADDRESS],
    ).toEqual([refreshed]);
  });

  it('retains a usable snapshot when the current remote request fails', async () => {
    const cached = createProtocol('cached', 1);
    useProtocolListStore.setState({
      protocolMap: { [NORMALIZED_ADDRESS]: [cached] },
    });
    mockedLoadProtocols.mockRejectedValueOnce(new Error('network failed'));

    await expect(
      useProtocolListStore.getState().getProtocols(ADDRESS, true),
    ).rejects.toThrow('network failed');

    expect(
      useProtocolListStore.getState().protocolMap[NORMALIZED_ADDRESS],
    ).toEqual([cached]);
    expect(mockedSyncRemoteProtocols).not.toHaveBeenCalled();
  });

  it('publishes and persists a successful empty remote snapshot', async () => {
    const cached = createProtocol('cached', 1);
    useProtocolListStore.setState({
      protocolMap: { [NORMALIZED_ADDRESS]: [cached] },
    });
    mockedLoadProtocols.mockResolvedValueOnce({
      address: NORMALIZED_ADDRESS,
      protocols: [],
      remoteProtocols: [],
    });

    await useProtocolListStore.getState().getProtocols(ADDRESS, true);

    expect(
      useProtocolListStore.getState().protocolMap[NORMALIZED_ADDRESS],
    ).toEqual([]);
    expect(mockedSyncRemoteProtocols).toHaveBeenCalledWith(
      NORMALIZED_ADDRESS,
      [],
    );
  });

  it('shares protocol entities while keeping scene projections independent', () => {
    const secondAddress = '0xDef0';
    const normalizedSecondAddress = secondAddress.toLowerCase();
    const first = createProtocol('aave', 20);
    const second = {
      ...createProtocol('curve', 30),
      owner_addr: normalizedSecondAddress,
    };
    useProtocolListStore.setState({
      protocolMap: {
        [NORMALIZED_ADDRESS]: [first],
        [normalizedSecondAddress]: [second],
      },
    });

    const singleKey = useProtocolListComputedStore
      .getState()
      .registerSingleProtocols(ADDRESS);
    const multiKey = useProtocolListComputedStore
      .getState()
      .registerMultiProtocols([ADDRESS, secondAddress]);
    const firstId = buildProtocolEntityId(first);
    const secondId = buildProtocolEntityId(second);

    expect(
      useProtocolListComputedStore.getState().singleProtocolsIndexCache[
        singleKey
      ]?.protocolIds,
    ).toEqual([firstId]);
    expect(
      useProtocolListComputedStore.getState().multiProtocolsIndexCache[multiKey]
        ?.protocolIds,
    ).toEqual([secondId, firstId]);

    const updatedFirst = { ...first, netWorth: 40 };
    useProtocolListStore.setState({
      protocolMap: {
        [NORMALIZED_ADDRESS]: [updatedFirst],
        [normalizedSecondAddress]: [second],
      },
    });

    const computed = useProtocolListComputedStore.getState();
    expect(computed.singleProtocolsIndexCache[singleKey]?.protocolIds).toEqual([
      firstId,
    ]);
    expect(computed.multiProtocolsIndexCache[multiKey]?.protocolIds).toEqual([
      firstId,
      secondId,
    ]);
    expect(protocolEntityResourceStore.getValue(firstId)?.netWorth).toBe(40);
    expect(computed.singleProtocolsIndexCache[singleKey]?.protocolIds[0]).toBe(
      computed.multiProtocolsIndexCache[multiKey]?.protocolIds[0],
    );
  });

  it('marks an explicit empty protocol snapshot as a ready projection', () => {
    useProtocolListStore.setState({
      protocolMap: { [NORMALIZED_ADDRESS]: [] },
      sourceSnapshotReadyByAddress: {},
    });

    const key = useProtocolListComputedStore
      .getState()
      .registerMultiProtocols([ADDRESS]);

    expect(
      useProtocolListComputedStore.getState().multiProtocolsIndexCache[key]
        ?.protocolIds,
    ).toEqual([]);
    expect(
      useProtocolListComputedStore.getState().multiProtocolsAvailabilityByKey[
        key
      ],
    ).toBe('unresolved');
    expect(mockedScheduleAssetProjectionPersistence).not.toHaveBeenCalled();

    useProtocolListStore.setState({
      sourceSnapshotReadyByAddress: { [NORMALIZED_ADDRESS]: true },
    });

    expect(
      useProtocolListComputedStore.getState().multiProtocolsAvailabilityByKey[
        key
      ],
    ).toBe('ready');
    expect(mockedScheduleAssetProjectionPersistence).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeKey: key,
        rows: [],
        scene: 'multi-address',
      }),
    );
  });

  it('resolves a native completion only after the committed SQL projection is published', async () => {
    jest.useFakeTimers();
    try {
      const committed = createProtocol('native-committed', 42);
      const protocolId = buildProtocolEntityId(committed);
      mockedProtocolItemEntity.getDefaultProtocolsByAddresses.mockResolvedValueOnce(
        { [NORMALIZED_ADDRESS]: [committed] } as never,
      );
      mockedAppChainEntity.queryByOwners.mockResolvedValueOnce({});
      mockedCompileProtocolAssetSqlProjection.mockResolvedValue({
        ruleVersion: 1,
        scene: 'single-address',
        protocolIds: [protocolId],
        defaultVisibleProtocolCount: 1,
        foldedProtocolUsdValue: '',
      });

      const key = useProtocolListComputedStore
        .getState()
        .registerSingleProtocols(ADDRESS);
      const completion = dispatchNativeAssetSyncCompletion({
        schemaVersion: 1,
        requestId: 'protocol-native-publish-1',
        kind: 'protocol',
        success: true,
        address: ADDRESS,
        generation: 1,
        committedAt: 100,
        replacementScope: 'address',
        chainIds: [],
        committedRowCount: 1,
        stage: 'persistence',
        error: '',
      });

      await Promise.resolve();
      jest.advanceTimersByTime(20);
      await completion;

      expect(
        useProtocolListStore.getState().protocolMap[NORMALIZED_ADDRESS],
      ).toEqual([committed]);
      expect(protocolEntityResourceStore.getValue(protocolId)).toEqual(
        committed,
      );
      expect(
        useProtocolListComputedStore.getState().singleProtocolsIndexCache[key],
      ).toEqual({
        protocolIds: [protocolId],
        defaultVisibleProtocolCount: 1,
        foldedProtocolUsdValue: '',
      });
      expect(mockedCompileProtocolAssetSqlProjection).toHaveBeenCalledWith({
        addresses: [NORMALIZED_ADDRESS],
        chainServerId: undefined,
        scene: 'single-address',
      });
    } finally {
      jest.useRealTimers();
    }
  });
});
