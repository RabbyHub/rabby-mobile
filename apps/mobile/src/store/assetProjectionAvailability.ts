import type { AssetReadModelEntry } from './assetReadModel';

export type AssetProjectionAvailability = 'unresolved' | 'restoring' | 'ready';

export type AssetProjectionViewState = 'loading' | 'data' | 'empty';

export type AssetProjectionPresentation = {
  viewState: AssetProjectionViewState;
  isRefreshing: boolean;
  isStale: boolean;
};

export type AssetSourceSnapshotReadiness = Record<string, true>;

const normalizeAddress = (address: string) => address.toLowerCase();

export const hasConfirmedAssetProjectionSources = (
  addresses: string[],
  readiness: AssetSourceSnapshotReadiness,
) =>
  addresses.length === 0 ||
  addresses.every(address => readiness[normalizeAddress(address)] === true);

export const markAssetSourceSnapshotsReady = (
  readiness: AssetSourceSnapshotReadiness,
  addresses: string[],
) => {
  let nextReadiness = readiness;

  new Set(addresses.map(normalizeAddress)).forEach(address => {
    if (nextReadiness[address]) {
      return;
    }
    if (nextReadiness === readiness) {
      nextReadiness = { ...readiness };
    }
    nextReadiness[address] = true;
  });

  return nextReadiness;
};

export const retainAssetSourceSnapshotReadiness = (
  readiness: AssetSourceSnapshotReadiness,
  addresses: string[],
) => {
  const retainedAddresses = new Set(addresses.map(normalizeAddress));
  const retainedEntries = Object.entries(readiness).filter(([address]) =>
    retainedAddresses.has(address),
  );

  return retainedEntries.length === Object.keys(readiness).length
    ? readiness
    : (Object.fromEntries(retainedEntries) as AssetSourceSnapshotReadiness);
};

export const getAssetSourceReadinessChangedAddresses = (
  previous: AssetSourceSnapshotReadiness,
  next: AssetSourceSnapshotReadiness,
) => {
  const addresses = new Set([...Object.keys(previous), ...Object.keys(next)]);
  return new Set(
    Array.from(addresses).filter(
      address => previous[address] !== next[address],
    ),
  );
};

export const resolveAssetProjectionAvailability = ({
  hasProjection,
  hasData,
  hasCompleteSource,
  isRestoring,
}: {
  hasProjection: boolean;
  hasData: boolean;
  hasCompleteSource: boolean;
  isRestoring?: boolean;
}): AssetProjectionAvailability => {
  if (!hasProjection) {
    return 'unresolved';
  }
  if (hasData || hasCompleteSource) {
    return 'ready';
  }

  return isRestoring ? 'restoring' : 'unresolved';
};

export const resolveAssetProjectionViewState = ({
  availability,
  hasData,
  hasSettledRequest = false,
}: {
  availability: AssetProjectionAvailability;
  hasData: boolean;
  hasSettledRequest?: boolean;
}): AssetProjectionViewState => {
  if (hasData) {
    return 'data';
  }

  return availability === 'ready' ||
    (availability === 'unresolved' && hasSettledRequest)
    ? 'empty'
    : 'loading';
};

export const resolveAssetProjectionPresentation = ({
  readModel,
  availability,
  hasData,
  hasSettledRequest = false,
}: {
  readModel?: AssetReadModelEntry;
  availability: AssetProjectionAvailability;
  hasData: boolean;
  hasSettledRequest?: boolean;
}): AssetProjectionPresentation => {
  const isRefreshing = readModel?.phase === 'refreshing';
  const isStale = readModel?.phase === 'stale';

  if (hasData) {
    return { viewState: 'data', isRefreshing, isStale };
  }

  if (readModel) {
    if (readModel.hasSnapshot && readModel.sourceComplete) {
      return { viewState: 'empty', isRefreshing, isStale };
    }

    if (readModel.phase === 'error') {
      return { viewState: 'empty', isRefreshing, isStale };
    }
  }

  return {
    viewState: resolveAssetProjectionViewState({
      availability,
      hasData,
      hasSettledRequest,
    }),
    isRefreshing,
    isStale,
  };
};
