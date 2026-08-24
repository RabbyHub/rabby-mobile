type TokenSnapshotMap = Readonly<
  Record<string, readonly unknown[] | undefined>
>;

const hasSnapshot = (snapshots: TokenSnapshotMap, address: string) =>
  Object.prototype.hasOwnProperty.call(snapshots, address);

export function selectTokenCacheRequestAddresses(
  addresses: readonly string[],
  snapshots: TokenSnapshotMap,
  confirmedLocalAddresses: ReadonlySet<string>,
) {
  return addresses.filter(address => {
    if (confirmedLocalAddresses.has(address)) {
      return false;
    }

    return !hasSnapshot(snapshots, address) || !snapshots[address]?.length;
  });
}

export function selectTokenCacheApplicableAddresses(
  addresses: readonly string[],
  snapshots: TokenSnapshotMap,
  cacheSnapshots: TokenSnapshotMap,
  cacheSucceededAddresses: ReadonlySet<string>,
  confirmedLocalAddresses: ReadonlySet<string>,
) {
  return addresses.filter(address => {
    if (
      !cacheSucceededAddresses.has(address) ||
      confirmedLocalAddresses.has(address)
    ) {
      return false;
    }

    if (!hasSnapshot(snapshots, address)) {
      return true;
    }

    return (
      !snapshots[address]?.length && Boolean(cacheSnapshots[address]?.length)
    );
  });
}
