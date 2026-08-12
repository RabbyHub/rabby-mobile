import { LatestAddressRequest } from './latestAddressRequest';

describe('LatestAddressRequest', () => {
  it('tracks overlapping addresses independently', () => {
    const requests = new LatestAddressRequest();
    const first = requests.begin(['0xA', '0xB']);
    const second = requests.begin(['0xB', '0xC']);

    expect(requests.getCurrentAddresses(first)).toEqual(['0xa']);
    expect(requests.getCurrentAddresses(second)).toEqual(['0xb', '0xc']);
  });

  it('keeps independent request sources from cancelling each other', () => {
    const requests = new LatestAddressRequest();
    const full = requests.begin(['0xA'], 'full');
    const chain = requests.begin(['0xA'], 'chain:eth');

    expect(requests.isCurrent(full, '0xa')).toBe(true);
    expect(requests.isCurrent(chain, '0xA')).toBe(true);
  });

  it('normalizes and deduplicates addresses in one ticket', () => {
    const requests = new LatestAddressRequest();
    const ticket = requests.begin(['0xA', '0xa', '', '0xB']);

    expect(Array.from(ticket.revisionByAddress.keys())).toEqual(['0xa', '0xb']);
  });

  it('reserves call order without cancelling until remote work starts', () => {
    const requests = new LatestAddressRequest();
    const active = requests.begin(['0xA']);
    const cachedOnly = requests.reserve(['0xA']);

    expect(requests.isCurrent(active, '0xA')).toBe(true);
    expect(requests.isCurrent(cachedOnly, '0xA')).toBe(false);

    requests.activate(cachedOnly);
    expect(requests.isCurrent(active, '0xA')).toBe(false);
    expect(requests.isCurrent(cachedOnly, '0xA')).toBe(true);
  });

  it('does not activate an older reserved request over a newer request', () => {
    const requests = new LatestAddressRequest();
    const older = requests.reserve(['0xA']);
    const newer = requests.begin(['0xA']);

    expect(requests.activate(older)).toEqual([]);
    expect(requests.isCurrent(newer, '0xA')).toBe(true);
  });
});
