export type LatestAddressRequestTicket = {
  source: string;
  revisionByAddress: ReadonlyMap<string, number>;
};

const normalizeAddresses = (addresses: string[]) =>
  Array.from(
    new Set(addresses.map(address => address.toLowerCase()).filter(Boolean)),
  );

export class LatestAddressRequest {
  private sequence = 0;

  private readonly revisionByKey = new Map<string, number>();

  private getKey(address: string, source: string) {
    return `${address.toLowerCase()}::${source}`;
  }

  issueRevision() {
    this.sequence += 1;
    return this.sequence;
  }

  reserveAtRevision(
    addresses: string[],
    revision: number,
    source = 'full',
  ): LatestAddressRequestTicket {
    const revisionByAddress = new Map<string, number>();

    normalizeAddresses(addresses).forEach(address => {
      revisionByAddress.set(address, revision);
    });

    return { source, revisionByAddress };
  }

  reserve(addresses: string[], source = 'full'): LatestAddressRequestTicket {
    return this.reserveAtRevision(addresses, this.issueRevision(), source);
  }

  activate(ticket: LatestAddressRequestTicket) {
    ticket.revisionByAddress.forEach((revision, address) => {
      const key = this.getKey(address, ticket.source);
      const activeRevision = this.revisionByKey.get(key) || 0;
      if (revision > activeRevision) {
        this.revisionByKey.set(key, revision);
      }
    });

    return this.getCurrentAddresses(ticket);
  }

  begin(addresses: string[], source = 'full'): LatestAddressRequestTicket {
    const ticket = this.reserve(addresses, source);
    this.activate(ticket);
    return ticket;
  }

  isCurrent(ticket: LatestAddressRequestTicket, address: string) {
    const normalizedAddress = address.toLowerCase();
    const revision = ticket.revisionByAddress.get(normalizedAddress);

    return (
      revision !== undefined &&
      this.revisionByKey.get(this.getKey(normalizedAddress, ticket.source)) ===
        revision
    );
  }

  isSuperseded(ticket: LatestAddressRequestTicket, address: string) {
    const normalizedAddress = address.toLowerCase();
    const revision = ticket.revisionByAddress.get(normalizedAddress);
    if (revision === undefined) {
      return true;
    }

    return (
      (this.revisionByKey.get(this.getKey(normalizedAddress, ticket.source)) ||
        0) > revision
    );
  }

  createCurrentGuard(
    ticket: LatestAddressRequestTicket,
    addresses: string[] = Array.from(ticket.revisionByAddress.keys()),
  ) {
    const revisions = normalizeAddresses(addresses).map(address => ({
      key: this.getKey(address, ticket.source),
      revision: ticket.revisionByAddress.get(address),
    }));

    return () =>
      revisions.every(
        ({ key, revision }) =>
          revision !== undefined && this.revisionByKey.get(key) === revision,
      );
  }

  getCurrentAddresses(ticket: LatestAddressRequestTicket) {
    return Array.from(ticket.revisionByAddress.keys()).filter(address =>
      this.isCurrent(ticket, address),
    );
  }
}
