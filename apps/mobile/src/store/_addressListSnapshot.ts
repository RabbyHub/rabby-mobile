export type AddressListSnapshotMap<TItem> = Record<string, TItem[]>;

export const normalizeSnapshotAddresses = (addresses: string[]) =>
  Array.from(
    new Set(addresses.map(address => address.toLowerCase()).filter(Boolean)),
  );

export const completeAddressListSnapshots = <TItem>(
  addresses: string[],
  snapshots: Partial<AddressListSnapshotMap<TItem>>,
): AddressListSnapshotMap<TItem> =>
  Object.fromEntries(
    normalizeSnapshotAddresses(addresses).map(address => [
      address,
      snapshots[address] || [],
    ]),
  );

export const mergeAddressListSnapshots = <TItem>(
  previous: AddressListSnapshotMap<TItem>,
  addresses: string[],
  snapshots: Partial<AddressListSnapshotMap<TItem>>,
): AddressListSnapshotMap<TItem> => ({
  ...previous,
  ...completeAddressListSnapshots(addresses, snapshots),
});

type AddressListSnapshotHydratorOptions<TItem> = {
  load: (
    addresses: string[],
  ) => Promise<Partial<AddressListSnapshotMap<TItem>>>;
  apply: (
    snapshots: AddressListSnapshotMap<TItem>,
    addresses: string[],
  ) => void;
};

export const createAddressListSnapshotHydrator = <TItem>({
  load,
  apply,
}: AddressListSnapshotHydratorOptions<TItem>) => {
  const inFlightByAddress = new Map<string, Promise<void>>();
  const revisionByAddress = new Map<string, number>();

  const invalidate = (addresses: string[]) => {
    normalizeSnapshotAddresses(addresses).forEach(address => {
      revisionByAddress.set(address, (revisionByAddress.get(address) || 0) + 1);
    });
  };

  const hydrate = async (addresses: string[]) => {
    const normalizedAddresses = normalizeSnapshotAddresses(addresses);
    if (!normalizedAddresses.length) {
      return;
    }

    const requests: Promise<void>[] = [];
    const missingAddresses: string[] = [];

    normalizedAddresses.forEach(address => {
      const activeRequest = inFlightByAddress.get(address);
      if (activeRequest) {
        requests.push(activeRequest);
      } else {
        missingAddresses.push(address);
      }
    });

    if (missingAddresses.length) {
      const startedRevisions = new Map(
        missingAddresses.map(address => [
          address,
          revisionByAddress.get(address) || 0,
        ]),
      );
      const batchRequest = Promise.resolve()
        .then(() => load(missingAddresses))
        .then(snapshots => {
          const applicableAddresses = missingAddresses.filter(
            address =>
              (revisionByAddress.get(address) || 0) ===
              startedRevisions.get(address),
          );
          if (!applicableAddresses.length) {
            return;
          }

          apply(
            completeAddressListSnapshots(applicableAddresses, snapshots),
            applicableAddresses,
          );
        });

      missingAddresses.forEach(address => {
        let addressRequest: Promise<void>;
        addressRequest = batchRequest.finally(() => {
          if (inFlightByAddress.get(address) === addressRequest) {
            inFlightByAddress.delete(address);
          }
        });
        inFlightByAddress.set(address, addressRequest);
        requests.push(addressRequest);
      });
    }

    await Promise.all(Array.from(new Set(requests)));
  };

  const refresh = async (addresses: string[]) => {
    const normalizedAddresses = normalizeSnapshotAddresses(addresses);
    if (!normalizedAddresses.length) {
      return;
    }

    const activeAddresses = normalizedAddresses.filter(address =>
      inFlightByAddress.has(address),
    );
    invalidate(normalizedAddresses);
    await hydrate(normalizedAddresses);

    if (activeAddresses.length) {
      await hydrate(activeAddresses);
    }
  };

  return {
    hydrate,
    invalidate,
    refresh,
  };
};
