import React from 'react';
import { SubmitActions } from './SubmitActions';
export type { Props } from './ActionsContainer';
import { Props } from './ActionsContainer';
import { WalletConnectProcessActions } from './WalletConnectProcessActions';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

export const ActionGroup: React.FC<Props> = props => {
  const { account } = props;

  if (account.type === KEYRING_CLASS.WATCH) {
    return <SubmitActions {...props} />;
  }
  if (account.type === KEYRING_CLASS.WALLETCONNECT) {
    return <WalletConnectProcessActions {...props} />;
  }

  // return <ProcessActions {...props} />;
  return null;
};
