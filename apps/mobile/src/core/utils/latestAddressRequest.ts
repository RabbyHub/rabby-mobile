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

  reserve(addresses: string[], source = 'full'): LatestAddressRequestTicket {
    const revisionByAddress = new Map<string, number>();

    normalizeAddresses(addresses).forEach(address => {
      const revision = ++this.sequence;
      revisionByAddress.set(address, revision);
    });

    return { source, revisionByAddress };
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

  getCurrentAddresses(ticket: LatestAddressRequestTicket) {
    return Array.from(ticket.revisionByAddress.keys()).filter(address =>
      this.isCurrent(ticket, address),
    );
  }
}
