type BatchRefreshTicket = {
  isForceRequested(): boolean;
  isFullSnapshotRequested(): boolean;
};

type InFlightBatchRefresh = {
  scopeKey: string;
  forceRequested: boolean;
  fullSnapshotRequested: boolean;
  promise: Promise<void>;
};

type BatchRefreshOptions = {
  allowProjectionOnly?: boolean;
};

const getScopeKey = (addresses: string[]) =>
  Array.from(new Set(addresses.map(address => address.toLowerCase())))
    .sort()
    .join('|');

/**
 * Shares one in-flight refresh for the same address set. A later manual
 * refresh can promote the running operation to require a remote refresh
 * without invalidating its usable cache result.
 */
export class AddressBatchRefreshCoordinator {
  private inFlight: InFlightBatchRefresh | null = null;

  run(
    addresses: string[],
    force: boolean,
    execute: (ticket: BatchRefreshTicket) => Promise<void>,
    options: BatchRefreshOptions = {},
  ): Promise<void> {
    const scopeKey = getScopeKey(addresses);
    const active = this.inFlight;

    if (active?.scopeKey === scopeKey) {
      if (force) {
        active.forceRequested = true;
      }
      if (!options.allowProjectionOnly) {
        active.fullSnapshotRequested = true;
      }
      return active.promise;
    }

    const flight = {
      scopeKey,
      forceRequested: force,
      fullSnapshotRequested: !options.allowProjectionOnly,
      promise: undefined as unknown as Promise<void>,
    };
    const ticket: BatchRefreshTicket = {
      isForceRequested: () => flight.forceRequested,
      isFullSnapshotRequested: () => flight.fullSnapshotRequested,
    };
    const promise = Promise.resolve().then(() => execute(ticket));
    flight.promise = promise;
    this.inFlight = flight;

    void promise.then(
      () => {
        if (this.inFlight === flight) {
          this.inFlight = null;
        }
      },
      () => {
        if (this.inFlight === flight) {
          this.inFlight = null;
        }
      },
    );

    return promise;
  }
}
