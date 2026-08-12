import type { ComplexProtocol } from '@rabby-wallet/rabby-api/dist/types';
import type { IProtocolItem } from '@/types/assets';

jest.mock('@/databases/entities/portocolItem', () => ({
  ProtocolItemEntity: {
    batchQueryProtocols: jest.fn(async () => []),
    getDefaultProtocolsByAddresses: jest.fn(async () => ({})),
    isExpired: jest.fn(async () => true),
  },
}));
jest.mock('@/databases/entities/appchain', () => ({
  AppChainEntity: {
    queryByOwners: jest.fn(async () => ({})),
  },
}));
jest.mock('@/databases/hooks/assets', () => ({
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
  restoreAssetProjection: jest.fn(async () => null),
  scheduleAssetProjectionPersistence: jest.fn(),
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
import useProtocolListStore, {
  buildProtocolEntityId,
  protocolEntityResourceStore,
  useProtocolListComputedStore,
} from './protocols';

const ADDRESS = '0xAbCd';
const NORMALIZED_ADDRESS = ADDRESS.toLowerCase();

const mockedLoadProtocols = jest.mocked(loadProtocols);
const mockedLoadProtocolsForAddresses = jest.mocked(loadProtocolsForAddresses);
const mockedSyncRemoteProtocols = jest.mocked(syncRemoteProtocols);
const mockedSyncRemoteProtocolsForAddresses = jest.mocked(
  syncRemoteProtocolsForAddresses,
);
const mockedProtocolItemEntity = jest.mocked(ProtocolItemEntity);

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
    useProtocolListStore.setState({
      hasLoadedByAddress: {},
      isLoading: false,
      isLoadingByAddress: {},
      protocolMap: {},
    });
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
});
