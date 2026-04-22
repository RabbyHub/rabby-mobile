import { contactService } from '@/core/services';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { useCreationWithDeepCompare } from '@/hooks/common/useMemozied';
import { useWhitelist } from '@/hooks/whitelist';
import addressBalanceStore from '@/store/balance';
import { filterMyAccounts, findAccountByPriority } from '@/utils/account';
import { ellipsisAddress } from '@/utils/address';
import { addressUtils } from '@rabby-wallet/base-utils';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { KeyringTypeName } from '@rabby-wallet/keyring-utils/src/types';
import { groupBy } from 'lodash';
import { useCallback, useLayoutEffect, useState } from 'react';

const isSameAddress = addressUtils.isSameAddress;

export const useFindAddressByWhitelist = () => {
  const {
    whitelist,
    enable: enabled,
    isAddrOnWhitelist,
  } = useWhitelist({
    disableAutoFetch: false,
  });
  const { accounts } = useAccounts({ disableAutoFetch: true });

  const findAccount = useCallback(
    async (
      address: string,
      options: {
        brandName?: string;
        /** @default true */
        useEllipsisAsFallback?: boolean;
      },
    ) => {
      const targetAccounts = accounts.filter(item =>
        isSameAddress(item.address, address),
      );
      const myAccountsInner = filterMyAccounts(accounts);

      const { brandName, useEllipsisAsFallback } = options;
      const defaultAccount = {
        address,
        aliasName:
          contactService.getAliasByAddress(address, {
            keepEmptyIfNotFound: !useEllipsisAsFallback,
          })?.alias || (useEllipsisAsFallback ? ellipsisAddress(address) : ''),
        type: KEYRING_CLASS.WATCH,
        brandName: KEYRING_CLASS.WATCH,
      };
      return {
        inWhitelist: whitelist.some(item => isSameAddress(item, address)),
        isMyImported: myAccountsInner.some(item =>
          isSameAddress(item.address, address),
        ),
        account: targetAccounts.length
          ? brandName
            ? targetAccounts.find(i => i.brandName === brandName) ||
              defaultAccount
            : findAccountByPriority(targetAccounts)
          : defaultAccount,
      };
    },
    [accounts, whitelist],
  );
  const findAccountWithoutBalance = useCallback(
    (
      address: string,
      options?: {
        brandName?: string;
        /** @default true */
        useEllipsisAsFallback?: boolean;
      },
    ) => {
      const { brandName, useEllipsisAsFallback = true } = options || {};
      const targetAccounts = accounts.filter(item =>
        isSameAddress(item.address, address),
      );
      const myAccountsInner = filterMyAccounts(accounts);
      const defaultAccount: KeyringAccountWithAlias = {
        address,
        aliasName:
          contactService.getAliasByAddress(address, {
            keepEmptyIfNotFound: !useEllipsisAsFallback,
          })?.alias || (useEllipsisAsFallback ? ellipsisAddress(address) : ''),
        type: KEYRING_CLASS.WATCH,
        brandName: KEYRING_CLASS.WATCH,
      };
      return {
        inWhitelist: whitelist.some(item => isSameAddress(item, address)),
        isMyImported: myAccountsInner.some(item =>
          isSameAddress(item.address, address),
        ),
        isImported: accounts.some(item => isSameAddress(item.address, address)),
        account: targetAccounts.length
          ? brandName
            ? targetAccounts.find(i => i.brandName === brandName) ||
              defaultAccount
            : findAccountByPriority(targetAccounts)
          : defaultAccount,
      };
    },
    [accounts, whitelist],
  );

  return {
    accounts,
    enabled,
    whitelist,
    isAddrOnWhitelist,
    findAccount,
    findAccountWithoutBalance,
  };
};

export function useWhitelistVariedAccounts() {
  const { accounts, whitelist, isAddrOnWhitelist, findAccountWithoutBalance } =
    useFindAddressByWhitelist();

  const myAccounts = useCreationWithDeepCompare(() => {
    return filterMyAccounts(accounts);
  }, [accounts]);

  const { list } = useCreationWithDeepCompare(() => {
    const ret = {
      list: [] as KeyringAccountWithAlias[],
    };
    type WhiteListSortableAccount = {
      account: KeyringAccountWithAlias;
      sortBalance: number;
    };

    const groupAccounts = groupBy(accounts, item => item.address.toLowerCase());
    const uniqueAccounts = Object.values(groupAccounts).map(item =>
      findAccountByPriority(item),
    );
    const importAddress: WhiteListSortableAccount[] = uniqueAccounts
      .filter(acc => isAddrOnWhitelist(acc.address))
      .map(acc => ({
        account: {
          address: acc.address,
          aliasName:
            contactService.getAliasByAddress(acc.address)?.alias ||
            acc.aliasName ||
            ellipsisAddress(acc.address),
          type: acc.brandName as KeyringTypeName,
          brandName: acc.brandName,
        },
        sortBalance:
          addressBalanceStore.getAddressValue(acc.address)?.totalBalance || 0,
      }));
    const importPlainAddress = [
      ...new Set(importAddress.map(item => item.account.address)),
    ];
    const unimportAddress: WhiteListSortableAccount[] = whitelist
      .filter(
        item => !importPlainAddress.some(plain => isSameAddress(plain, item)),
      )
      .map(address => ({
        account: {
          address,
          aliasName:
            contactService.getAliasByAddress(address)?.alias ||
            ellipsisAddress(address),
          type: KEYRING_CLASS.WATCH,
          brandName: KEYRING_CLASS.WATCH,
        },
        sortBalance: 0,
      }));

    ret.list = [...unimportAddress, ...importAddress]
      .sort((a, b) => b.sortBalance - a.sortBalance)
      .map(item => item.account);

    return ret;
  }, [accounts, whitelist]);

  return {
    list,
    whitelist,
    myAccounts,
    findAccountWithoutBalance,
  };
}
