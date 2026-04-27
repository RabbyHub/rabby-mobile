import { contactService } from '@/core/services';
import { AccountInfoEntity } from '@/databases/entities/accountInfo';
import { batchBalanceWithLocalCache } from '@/databases/hooks/balance';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { useCreationWithDeepCompare } from '@/hooks/common/useMemozied';
import { useWhitelist } from '@/hooks/whitelist';
import { filterMyAccounts, findAccountByPriority } from '@/utils/account';
import { ellipsisAddress } from '@/utils/address';
import { getTokenSettings } from '@/utils/getTokenSettings';
import { sortWhitelistRecordsForSend } from '@/utils/whitelist';
import { addressUtils } from '@rabby-wallet/base-utils';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useCallback, useEffect, useState } from 'react';

const isSameAddress = addressUtils.isSameAddress;

export const useFindAddressByWhitelist = () => {
  const {
    whitelist,
    whitelistRecords,
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
    whitelistRecords,
    isAddrOnWhitelist,
    findAccount,
    findAccountWithoutBalance,
  };
};

export function useWhitelistVariedAccounts() {
  const { accounts, whitelist, whitelistRecords, findAccountWithoutBalance } =
    useFindAddressByWhitelist();
  const [resolvedAddedAtByAddress, setResolvedAddedAtByAddress] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    let isCurrent = true;

    const loadAddedAtByAddress = async () => {
      if (!whitelist.length) {
        setResolvedAddedAtByAddress({});
        return;
      }

      try {
        const nextResolvedAddedAtByAddress =
          await AccountInfoEntity.getCreatedAtByAddresses(whitelist);

        if (isCurrent) {
          setResolvedAddedAtByAddress(nextResolvedAddedAtByAddress);
        }
      } catch {
        if (isCurrent) {
          setResolvedAddedAtByAddress({});
        }
      }
    };

    loadAddedAtByAddress();

    return () => {
      isCurrent = false;
    };
  }, [whitelist]);

  const myAccounts = useCreationWithDeepCompare(() => {
    return filterMyAccounts(accounts);
  }, [accounts]);

  const accountsByAddress = useCreationWithDeepCompare(() => {
    return accounts.reduce<Record<string, KeyringAccountWithAlias[]>>(
      (result, account) => {
        const key = account.address.toLowerCase();
        if (!result[key]) {
          result[key] = [];
        }
        result[key].push(account);

        return result;
      },
      {},
    );
  }, [accounts]);

  const { list } = useCreationWithDeepCompare(() => {
    const ret = {
      list: [] as KeyringAccountWithAlias[],
    };

    ret.list = sortWhitelistRecordsForSend(
      whitelistRecords,
      resolvedAddedAtByAddress,
    ).map(record => {
      const address = record.address;
      const aliasName =
        contactService.getAliasByAddress(address)?.alias ||
        ellipsisAddress(address);
      const matchedAccounts = accountsByAddress[address.toLowerCase()] || [];

      if (matchedAccounts.length) {
        const preferredAccount = findAccountByPriority(matchedAccounts);

        return {
          ...preferredAccount,
          aliasName:
            aliasName ||
            preferredAccount.aliasName ||
            ellipsisAddress(preferredAccount.address),
          balance: preferredAccount.balance || 0,
        };
      }

      return {
        address,
        aliasName,
        balance: 0,
        type: KEYRING_CLASS.WATCH,
        brandName: KEYRING_CLASS.WATCH,
      };
    });

    return ret;
  }, [accountsByAddress, resolvedAddedAtByAddress, whitelistRecords]);

  return {
    list,
    whitelist,
    myAccounts,
    findAccountWithoutBalance,
  };
}
