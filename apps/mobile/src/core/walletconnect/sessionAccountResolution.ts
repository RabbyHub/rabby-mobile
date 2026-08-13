import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import type { SessionTypes } from '@walletconnect/types';

import { getAllAccountsToDisplay } from '@/core/apis/account';
import {
  getWalletConnectAccountForTopic,
  isSameWalletConnectAccount,
} from './accountPersistence';
import { addWalletConnectLog } from './debugLog';
import { getWalletConnectApprovedAddresses } from './sessions';

export async function resolveWalletConnectAccount(
  session: SessionTypes.Struct,
) {
  const approvedAddress = getWalletConnectApprovedAddresses(session)[0];
  const approvedAccount = getWalletConnectAccountForTopic(session.topic);
  if (!approvedAddress && !approvedAccount) {
    return null;
  }

  try {
    const accounts = await getAllAccountsToDisplay();
    if (approvedAccount) {
      return (
        accounts.find(account =>
          isSameWalletConnectAccount(account, approvedAccount),
        ) || null
      );
    }

    return approvedAddress
      ? accounts.find(account =>
          isSameAddress(account.address, approvedAddress),
        ) || null
      : null;
  } catch (error) {
    addWalletConnectLog(
      'sessions',
      'failed to resolve approved Rabby account',
      error,
      'warn',
    );
    return null;
  }
}
