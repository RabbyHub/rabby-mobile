import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

export const WaitingSignComponent = {
  [KEYRING_CLASS.WALLETCONNECT]: 'WatchAddressWaiting',
  [KEYRING_CLASS.MNEMONIC]: 'PrivatekeyWaiting',
  [KEYRING_CLASS.PRIVATE_KEY]: 'PrivatekeyWaiting',
};

export const WaitingSignMessageComponent = {
  [KEYRING_CLASS.WALLETCONNECT]: 'WatchAddressWaiting',
};
