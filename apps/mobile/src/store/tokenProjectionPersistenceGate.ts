type AddressPersistenceTicket = ReadonlyMap<string, number>;

type PendingProjection = {
  addresses: string[];
  persist: () => void;
};

const normalizeAddresses = (addresses: string[]) =>
  Array.from(new Set(addresses.map(address => address.toLowerCase())));

export class TokenProjectionPersistenceGate {
  private generation = 0;

  private readonly dirtyGenerationByAddress = new Map<string, number>();

  private readonly pendingProjectionByKey = new Map<
    string,
    PendingProjection
  >();

  markDirty(addresses: string[]): AddressPersistenceTicket {
    const generation = ++this.generation;
    const ticket = new Map<string, number>();

    normalizeAddresses(addresses).forEach(address => {
      this.dirtyGenerationByAddress.set(address, generation);
      ticket.set(address, generation);
    });

    return ticket;
  }

  schedule(key: string, addresses: string[], persist: () => void): boolean {
    const normalizedAddresses = normalizeAddresses(addresses);
    if (this.hasDirtyAddress(normalizedAddresses)) {
      this.pendingProjectionByKey.set(key, {
        addresses: normalizedAddresses,
        persist,
      });
      return false;
    }

    this.pendingProjectionByKey.delete(key);
    persist();
    return true;
  }

  settle(
    ticket: AddressPersistenceTicket | undefined,
    options: {
      addresses?: string[];
      success: boolean;
    },
  ) {
    if (!ticket || !options.success) {
      return;
    }

    const addresses = options.addresses
      ? new Set(normalizeAddresses(options.addresses))
      : null;
    ticket.forEach((generation, address) => {
      if (addresses && !addresses.has(address)) {
        return;
      }
      if (this.dirtyGenerationByAddress.get(address) === generation) {
        this.dirtyGenerationByAddress.delete(address);
      }
    });
    this.flushReadyProjections();
  }

  clear() {
    this.dirtyGenerationByAddress.clear();
    this.pendingProjectionByKey.clear();
  }

  private hasDirtyAddress(addresses: string[]) {
    return addresses.some(address =>
      this.dirtyGenerationByAddress.has(address),
    );
  }

  private flushReadyProjections() {
    Array.from(this.pendingProjectionByKey.entries()).forEach(
      ([key, pending]) => {
        if (this.hasDirtyAddress(pending.addresses)) {
          return;
        }

        this.pendingProjectionByKey.delete(key);
        pending.persist();
      },
    );
  }
}

export type { AddressPersistenceTicket };
