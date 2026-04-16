import React from 'react';
import { SubmitActions } from './SubmitActions';
export type { Props } from './ActionsContainer';
import { Props } from './ActionsContainer';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { LedgerProcessActions } from './LedgerProcessActions';
import { KeystoneProcessActions } from './KeystoneProcessActions';
import { OneKeyProcessActions } from './OneKeyProcessActions';
import { ProcessActions } from './ProcessActions';
import { PrivateKeyActions } from './PrivateKeyActions';

export const ActionGroup: React.FC<Props> = props => {
  const { account } = props;

  if (account.type === KEYRING_CLASS.WATCH) {
    return <SubmitActions {...props} USE_LAST_UNLOCKED_AUTH />;
  }

  if (account.type === KEYRING_CLASS.HARDWARE.LEDGER) {
    return <LedgerProcessActions {...props} />;
  }

  if (account.type === KEYRING_CLASS.HARDWARE.KEYSTONE) {
    return <KeystoneProcessActions {...props} />;
  }

  if (account.type === KEYRING_CLASS.HARDWARE.ONEKEY) {
    return <OneKeyProcessActions {...props} />;
  }

  if (account.type === KEYRING_CLASS.PRIVATE_KEY) {
    return <PrivateKeyActions {...props} USE_LAST_UNLOCKED_AUTH />;
  }

  if (account.type === KEYRING_CLASS.MNEMONIC) {
    return <PrivateKeyActions {...props} USE_LAST_UNLOCKED_AUTH />;
  }

  return <ProcessActions {...props} />;
};
