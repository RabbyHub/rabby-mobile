import {
  HARDWARE_KEYRING_TYPES,
  KEYRING_CLASS,
} from '@rabby-wallet/keyring-utils';

const mockAddAddressAvatar = jest.fn();
const mockGetAddressAvatar = jest.fn();
const mockBlockies = jest.fn();

jest.mock(
  'ethereum-blockies-base64',
  () =>
    (...args: unknown[]) =>
      mockBlockies(...args),
);

jest.mock('@/core/services', () => ({
  preferenceService: {
    addAddressAvatar: (...args: unknown[]) => mockAddAddressAvatar(...args),
    getAddressAvatar: (...args: unknown[]) => mockGetAddressAvatar(...args),
  },
}));

import {
  getWalletAvator2024,
  getWalletIcon2024,
  showSubWalletIcon,
} from './walletInfo2024';

describe('walletInfo2024', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns gnosis and watch avatars before looking at address-generated avatars', () => {
    expect(getWalletAvator2024(KEYRING_CLASS.GNOSIS, true)).toBeDefined();
    expect(getWalletAvator2024(KEYRING_CLASS.WATCH, false)).toBeDefined();
    expect(mockGetAddressAvatar).not.toHaveBeenCalled();
  });

  it('reuses cached address avatars when available', () => {
    mockGetAddressAvatar.mockReturnValue('cached-avatar');

    expect(
      getWalletAvator2024(
        undefined,
        false,
        '0x0000000000000000000000000000000000000001',
      ),
    ).toEqual({
      uri: 'cached-avatar',
    });

    expect(mockBlockies).not.toHaveBeenCalled();
  });

  it('generates and stores a blockies avatar when no cache exists', () => {
    mockGetAddressAvatar.mockReturnValue('');
    mockBlockies.mockReturnValue('generated-avatar');

    expect(
      getWalletAvator2024(
        undefined,
        true,
        '0x0000000000000000000000000000000000000002',
      ),
    ).toEqual({
      uri: 'generated-avatar',
    });
    expect(mockAddAddressAvatar).toHaveBeenCalledWith(
      '0x0000000000000000000000000000000000000002',
      'generated-avatar',
    );
  });

  it('maps known hardware brands to dedicated icons and falls back to watch icons', () => {
    const defaultIcon = getWalletIcon2024(undefined, false);
    const ledgerIcon = getWalletIcon2024(KEYRING_CLASS.HARDWARE.LEDGER, false);
    const keystoneIcon = getWalletIcon2024(
      HARDWARE_KEYRING_TYPES.Keystone.brandName,
      false,
    );

    expect(ledgerIcon).toBeDefined();
    expect(keystoneIcon).toBeDefined();
    expect(defaultIcon).toBeDefined();
    expect(ledgerIcon).not.toBe(defaultIcon);
    expect(keystoneIcon).not.toBe(defaultIcon);
  });

  it('marks hardware sub-wallet brands explicitly', () => {
    expect(showSubWalletIcon(KEYRING_CLASS.HARDWARE.ONEKEY)).toBe(true);
    expect(showSubWalletIcon(KEYRING_CLASS.GNOSIS)).toBe(false);
  });
});
