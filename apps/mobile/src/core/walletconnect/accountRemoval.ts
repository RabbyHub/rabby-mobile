import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { getSdkError } from '@walletconnect/utils';
import type { SessionTypes } from '@walletconnect/types';

import { clearWalletConnectAutoDisconnectTopic } from './autoDisconnect';
import {
  forgetWalletConnectAccountForTopic,
  getWalletConnectAccountForTopic,
  isSameWalletConnectAccount,
  type WalletConnectAccountIdentity,
} from './accountSelection';
import { getWalletConnectClient } from './client';
import { addWalletConnectLog } from './debugLog';
import {
  getWalletConnectApprovedAddresses,
  syncWalletConnectSessionsFromClient,
} from './sessions';

function isSessionApprovedForRemovedAccount(
  session: SessionTypes.Struct,
  account: WalletConnectAccountIdentity,
) {
  const approvedAccount = getWalletConnectAccountForTopic(session.topic);
  if (approvedAccount) {
    return isSameWalletConnectAccount(account, approvedAccount);
  }

  return getWalletConnectApprovedAddresses(session).some(address =>
    isSameAddress(address, account.address),
  );
}

export async function disconnectWalletConnectSessionsForRemovedAccount(
  account: WalletConnectAccountIdentity,
) {
  const walletKit = getWalletConnectClient();
  if (!walletKit) {
    return 0;
  }

  let sessions: SessionTypes.Struct[];
  try {
    sessions = Object.values(walletKit.getActiveSessions()).filter(session =>
      isSessionApprovedForRemovedAccount(session, account),
    );
  } catch (error: unknown) {
    addWalletConnectLog(
      'sessions',
      'failed to inspect sessions after account removal',
      {
        address: account.address,
        type: account.type,
        brandName: account.brandName,
        error,
      },
      'warn',
    );
    return 0;
  }

  let disconnectedCount = 0;
  for (const session of sessions) {
    clearWalletConnectAutoDisconnectTopic(session.topic);

    try {
      await walletKit.disconnectSession({
        topic: session.topic,
        reason: getSdkError('USER_DISCONNECTED'),
      });
      disconnectedCount += 1;
      forgetWalletConnectAccountForTopic(session.topic);
      addWalletConnectLog(
        'sessions',
        'session disconnected after account removal',
        {
          topic: session.topic,
          address: account.address,
          type: account.type,
          brandName: account.brandName,
        },
      );
    } catch (error: unknown) {
      addWalletConnectLog(
        'sessions',
        'failed to disconnect session after account removal',
        {
          topic: session.topic,
          address: account.address,
          type: account.type,
          brandName: account.brandName,
          error,
        },
        'warn',
      );
    }
  }

  if (disconnectedCount > 0) {
    try {
      syncWalletConnectSessionsFromClient(walletKit);
    } catch (error: unknown) {
      addWalletConnectLog(
        'sessions',
        'failed to sync sessions after account removal',
        {
          address: account.address,
          type: account.type,
          brandName: account.brandName,
          error,
        },
        'warn',
      );
    }
  }

  return disconnectedCount;
}
