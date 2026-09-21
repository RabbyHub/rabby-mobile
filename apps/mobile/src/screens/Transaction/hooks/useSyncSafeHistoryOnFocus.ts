import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

import { syncSingleAddress } from '@/databases/hooks/history';
import type { Account } from '@/types/account';

type SafeHistorySyncOptions = {
  account?: Account | null;
  isInTokenDetail?: boolean;
  isSceneUsingAllAccounts: boolean;
  isTestnet?: boolean;
};

export function getSafeHistorySyncAddress({
  account,
  isInTokenDetail,
  isSceneUsingAllAccounts,
  isTestnet,
}: SafeHistorySyncOptions) {
  if (
    !account?.address ||
    account.type !== KEYRING_CLASS.GNOSIS ||
    isInTokenDetail ||
    isSceneUsingAllAccounts ||
    isTestnet
  ) {
    return undefined;
  }

  return account.address.toLowerCase();
}

export function useSyncSafeHistoryOnFocus(options: SafeHistorySyncOptions) {
  const safeAddress = getSafeHistorySyncAddress(options);

  useFocusEffect(
    useCallback(() => {
      if (!safeAddress) {
        return;
      }

      syncSingleAddress(safeAddress).catch(error => {
        console.error('[SafeHistory] sync on focus failed', error);
      });
    }, [safeAddress]),
  );

  return safeAddress;
}
