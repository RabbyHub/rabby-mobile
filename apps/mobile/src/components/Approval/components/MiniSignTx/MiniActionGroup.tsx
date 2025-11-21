import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import React from 'react';
import { Props } from '../FooterBar/ActionsContainer';
import { MiniLedgerProcessActions } from './MiniLedgerProcessActions';
import { MiniOneKeyProcessActions } from './MiniOneKeyProcessActions';
import { MiniSubmitActions } from './MiniSubmitActions';

export const MiniActionGroup: React.FC<Props> = props => {
  const { account } = props;

  if (account.type === KEYRING_CLASS.WATCH) {
    return <MiniSubmitActions {...props} USE_LAST_UNLOCKED_AUTH={false} />;
  }

  if (account.type === KEYRING_CLASS.HARDWARE.LEDGER) {
    return <MiniLedgerProcessActions {...props} />;
  }

  // if (account.type === KEYRING_CLASS.HARDWARE.KEYSTONE) {
  //   return <KeystoneProcessActions {...props} USE_LAST_UNLOCKED_AUTH={false} />;
  // }

  if (account.type === KEYRING_CLASS.HARDWARE.ONEKEY) {
    return <MiniOneKeyProcessActions {...props} />;
  }

  if (account.type === KEYRING_CLASS.PRIVATE_KEY) {
    return <MiniSubmitActions {...props} USE_LAST_UNLOCKED_AUTH={false} />;
  }

  if (account.type === KEYRING_CLASS.MNEMONIC) {
    return <MiniSubmitActions {...props} USE_LAST_UNLOCKED_AUTH={false} />;
  }

  // not supported
  return null;

  // return <MiniProcessActions {...props} USE_LAST_UNLOCKED_AUTH={false} />;
};
