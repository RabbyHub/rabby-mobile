import { ellipsisAddress } from '@/utils/address';
import { bindLedgerEvents } from '@/utils/ledger';
import { bindOneKeyEvents } from '@/utils/onekey';
import { bindWalletConnectEvents } from '@/utils/wc';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { KeyringServiceOptions } from '@rabby-wallet/service-keyring/src/keyringService';
import { getKeyringParams } from '../utils/getKeyringParams';

export const onSetAddressAlias: KeyringServiceOptions['onSetAddressAlias'] &
  object = async (keyring, account, contactService) => {
  console.log('exe 没有进来吗');
  const { address } = account;
  if (!contactService) {
    if (__DEV__) {
      console.warn('contactService is not provided, skip setting alias');
    }
    return;
  }
  const existAlias = contactService.getAliasByAddress(address);

  contactService.setAlias({
    address,
    alias: existAlias ? existAlias.alias : ellipsisAddress(address),
  });
};

export const onCreateKeyring: KeyringServiceOptions['onCreateKeyring'] &
  object = Keyring => {
  const keyring = new Keyring(getKeyringParams(Keyring.type as any));

  if (Keyring.type === KEYRING_CLASS.WALLETCONNECT) {
    bindWalletConnectEvents(keyring);
  }

  if (Keyring.type === KEYRING_CLASS.HARDWARE.LEDGER) {
    bindLedgerEvents(keyring);
  }

  if (Keyring.type === KEYRING_CLASS.HARDWARE.ONEKEY) {
    bindOneKeyEvents(keyring);
  }

  return keyring;
};
