import {
  HARDWARE_KEYRING_TYPES,
  KEYRING_CLASS,
  WALLET_NAME,
} from '@rabby-wallet/keyring-utils';

jest.mock('@/assets/icons/address', () => ({
  PrivateKeySVG: 'PrivateKeySVG',
  SeedPhraseSVG: 'SeedPhraseSVG',
  RcIconWatchAddress: 'RcIconWatchAddress',
  PrivateKeySVGLight: 'PrivateKeySVGLight',
  SeedPhraseSVGLight: 'SeedPhraseSVGLight',
}));

import { getWalletIcon, WALLET_INFO } from './walletInfo';

describe('walletInfo legacy icon mapping', () => {
  it('keeps external wallet metadata for WalletConnect brands', () => {
    expect(WALLET_INFO[WALLET_NAME.MetaMask]).toMatchObject({
      brand: WALLET_NAME.MetaMask,
      deepLink: 'metamask:',
      androidPackageName: 'io.metamask',
    });
    expect(WALLET_INFO[WALLET_NAME.UnknownWallet]).toMatchObject({
      brand: WALLET_NAME.UnknownWallet,
      deepLink: '',
      androidPackageName: '',
    });
  });

  it('maps special account keyring classes before wallet brand fallback', () => {
    const watchIcon = getWalletIcon(KEYRING_CLASS.WATCH);
    const ledgerIcon = getWalletIcon(KEYRING_CLASS.HARDWARE.LEDGER);
    const safeIcon = getWalletIcon(KEYRING_CLASS.GNOSIS);
    const unknownIcon = getWalletIcon(undefined);

    expect(watchIcon).toBeDefined();
    expect(ledgerIcon).toBeDefined();
    expect(safeIcon).toBeDefined();
    expect(watchIcon).not.toBe(unknownIcon);
    expect(ledgerIcon).not.toBe(unknownIcon);
    expect(safeIcon).not.toBe(unknownIcon);
  });

  it('switches private key and mnemonic icons for light mode variants', () => {
    expect(getWalletIcon(KEYRING_CLASS.PRIVATE_KEY, true)).not.toBe(
      getWalletIcon(KEYRING_CLASS.PRIVATE_KEY, false),
    );
    expect(getWalletIcon(KEYRING_CLASS.MNEMONIC, true)).not.toBe(
      getWalletIcon(KEYRING_CLASS.MNEMONIC, false),
    );
  });

  it('maps Keystone brand aliases and known wallet names to their dedicated icons', () => {
    expect(
      getWalletIcon(HARDWARE_KEYRING_TYPES.Keystone.brandName),
    ).toBeDefined();
    expect(getWalletIcon(WALLET_NAME.MetaMask)).toBe(
      WALLET_INFO[WALLET_NAME.MetaMask].icon,
    );
    expect(getWalletIcon('missing-wallet-brand')).toBe(
      WALLET_INFO[WALLET_NAME.UnknownWallet].icon,
    );
  });
});
