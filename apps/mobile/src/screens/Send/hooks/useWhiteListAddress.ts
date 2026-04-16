import { contactService } from '@/core/services';
import { batchBalanceWithLocalCache } from '@/databases/hooks/balance';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { useCreationWithDeepCompare } from '@/hooks/common/useMemozied';
import { useWhitelist } from '@/hooks/whitelist';
import { filterMyAccounts, findAccountByPriority } from '@/utils/account';
import { ellipsisAddress } from '@/utils/address';
import { getTokenSettings } from '@/utils/getTokenSettings';
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
        disableBalance?: boolean;
        /** @default true */
        useEllipsisAsFallback?: boolean;
      },
    ) => {
      const targetAccounts = accounts.filter(item =>
        isSameAddress(item.address, address),
      );
      const myAccountsInner = filterMyAccounts(accounts);

      const { brandName, disableBalance, useEllipsisAsFallback } = options;
      let balance = 0;
      if (!targetAccounts.length && !disableBalance) {
        const userTokenSettings = await getTokenSettings();
        const { total_usd_value } = await batchBalanceWithLocalCache({
          address: address,
          isCore: false,
          ...userTokenSettings,
        });
        balance = total_usd_value || 0;
      }
      const defaultAccount = {
        address,
        aliasName:
          contactService.getAliasByAddress(address, {
            keepEmptyIfNotFound: !useEllipsisAsFallback,
          })?.alias || (useEllipsisAsFallback ? ellipsisAddress(address) : ''),
        balance,
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
      let balance = 0;
      const defaultAccount: KeyringAccountWithAlias = {
        address,
        aliasName:
          contactService.getAliasByAddress(address, {
            keepEmptyIfNotFound: !useEllipsisAsFallback,
          })?.alias || (useEllipsisAsFallback ? ellipsisAddress(address) : ''),
        balance,
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

    const groupAccounts = groupBy(accounts, item => item.address.toLowerCase());
    const uniqueAccounts = Object.values(groupAccounts).map(item =>
      findAccountByPriority(item),
    );
    const importAddress: KeyringAccountWithAlias[] = uniqueAccounts
      .filter(acc => isAddrOnWhitelist(acc.address))
      .map(acc => ({
        address: acc.address,
        aliasName:
          contactService.getAliasByAddress(acc.address)?.alias ||
          acc.aliasName ||
          ellipsisAddress(acc.address),
        balance: acc.balance || 0,
        type: acc.brandName as KeyringTypeName,
        brandName: acc.brandName,
      }));
    const importPlainAddress = [
      ...new Set(importAddress.map(item => item.address)),
    ];
    const unimportAddress: KeyringAccountWithAlias[] = whitelist
      .filter(
        item => !importPlainAddress.some(plain => isSameAddress(plain, item)),
      )
      .map(address => ({
        address,
        aliasName:
          contactService.getAliasByAddress(address)?.alias ||
          ellipsisAddress(address),
        balance: 0,
        type: KEYRING_CLASS.WATCH,
        brandName: KEYRING_CLASS.WATCH,
      }));

    ret.list = [...unimportAddress, ...importAddress].sort(
      (a, b) => (b.balance || 0) - (a.balance || 0),
    );

    return ret;
  }, [accounts, whitelist]);

  return {
    list,
    whitelist,
    myAccounts,
    findAccountWithoutBalance,
  };
}
