import React from 'react';
import { InteractionManager } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type {
  AddrDescResponse,
  ProjectItem,
} from '@rabby-wallet/rabby-api/dist/types';

import { useContactAccounts } from '@/hooks/contact';
import type { Account } from '@/core/startupServices/preference';
import { useCexSupportList } from '@/hooks/useCexSupportList';
import { makeAccountObject } from '@/utils/account';
import { useFindAddressByWhitelist } from './useWhiteListAddress';
import { useRecentSendToHistoryFor } from './useRecentSend';

type FindAccountWithoutBalance = ReturnType<
  typeof useFindAddressByWhitelist
>['findAccountWithoutBalance'];

export type SendRecipientDerivedState = {
  whitelistEnabled: boolean;
  toAccount: ReturnType<FindAccountWithoutBalance>['account'] | null;
  toAddressIsCex: boolean;
  toAddressInContactBook: boolean;
  toAddressPositiveTips: {
    hasPositiveTips: boolean;
    inWhitelist: boolean;
    isRecentlySend: boolean;
    isMyImported?: boolean;
  };
  toAddrCex: ProjectItem | null | undefined;
};

type UseSendRecipientStateOptions = {
  currentAccount: Account | null;
  toAddress: string;
  toAddressBrandName?: string;
  toAddrDesc: AddrDescResponse['desc'] | null;
};

export function useSendRecipientState({
  currentAccount,
  toAddress,
  toAddressBrandName,
  toAddrDesc,
}: UseSendRecipientStateOptions) {
  const isFocused = useIsFocused();
  const { fetchContactAccounts, isAddrOnContactBook } = useContactAccounts();

  React.useEffect(() => {
    if (!isFocused) {
      return;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      fetchContactAccounts();
    });
    return () => {
      task.cancel();
    };
  }, [fetchContactAccounts, isFocused]);

  const { list: cexList } = useCexSupportList();
  const {
    whitelist,
    enabled: whitelistEnabled,
    findAccountWithoutBalance,
  } = useFindAddressByWhitelist({ disableAutoFetch: true });
  const { isRecentlySent, reFetch } = useRecentSendToHistoryFor(
    toAddress,
    currentAccount?.address,
  );

  const foundToAccountInfo = React.useMemo(
    () =>
      findAccountWithoutBalance(toAddress, {
        brandName: toAddressBrandName,
      }),
    [findAccountWithoutBalance, toAddress, toAddressBrandName],
  );
  const toAccount = React.useMemo(
    () =>
      foundToAccountInfo?.account ||
      makeAccountObject({
        address: toAddress,
        brandName: toAddressBrandName,
      }),
    [foundToAccountInfo?.account, toAddress, toAddressBrandName],
  );
  const whitelistAddresses = React.useMemo(
    () => new Set(whitelist.map(address => address.toLowerCase())),
    [whitelist],
  );
  const cexById = React.useMemo(
    () => new Map(cexList.map(item => [item.id, item])),
    [cexList],
  );

  const state = React.useMemo<SendRecipientDerivedState>(() => {
    const toAddressInWhitelist = whitelistAddresses.has(
      toAddress.toLowerCase(),
    );
    const isMyImported = foundToAccountInfo?.isMyImported;
    return {
      whitelistEnabled,
      toAccount,
      toAddressIsCex: !!toAddrDesc?.cex?.id && !!toAddrDesc?.cex?.is_deposit,
      toAddressInContactBook: isAddrOnContactBook(toAddress),
      toAddressPositiveTips: {
        hasPositiveTips:
          isRecentlySent || toAddressInWhitelist || !!isMyImported,
        inWhitelist: toAddressInWhitelist,
        isRecentlySend: isRecentlySent,
        isMyImported,
      },
      toAddrCex: cexById.get(toAddrDesc?.cex?.id || ''),
    };
  }, [
    cexById,
    foundToAccountInfo?.isMyImported,
    isAddrOnContactBook,
    isRecentlySent,
    toAccount,
    toAddrDesc,
    toAddress,
    whitelistAddresses,
    whitelistEnabled,
  ]);

  return {
    fetchContactAccounts,
    reFetch,
    state,
  };
}
