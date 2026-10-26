import {
  normalizePinnedAddresses,
  updatePinnedAddressList,
} from './pinnedAddresses';

const first = {
  brandName: 'Rabby',
  address: '0x0000000000000000000000000000000000000001',
};

describe('pinnedAddresses', () => {
  it('deduplicates the same brand and address without changing order', () => {
    const second = {
      brandName: 'Rabby',
      address: '0x0000000000000000000000000000000000000002',
    };

    expect(
      normalizePinnedAddresses([
        first,
        second,
        { ...first, address: `0x${first.address.slice(2).toUpperCase()}` },
      ]),
    ).toEqual([first, second]);
  });

  it('keeps the same address pinned under different brands', () => {
    const otherBrand = { ...first, brandName: 'MetaMask' };

    expect(normalizePinnedAddresses([first, otherBrand])).toEqual([
      first,
      otherBrand,
    ]);
  });

  it('does not duplicate an explicitly pinned address', () => {
    expect(
      updatePinnedAddressList([first, first], {
        ...first,
        nextPinned: true,
      }),
    ).toEqual({
      nextPinned: true,
      nextAddresses: [first],
    });
  });

  it('removes all persisted duplicates when unpinning', () => {
    expect(
      updatePinnedAddressList([first, first], {
        ...first,
        nextPinned: false,
      }),
    ).toEqual({
      nextPinned: false,
      nextAddresses: [],
    });
  });
});
