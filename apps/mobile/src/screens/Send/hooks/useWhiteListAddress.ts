import { contactService } from '@/core/services';
import { batchBalanceWithLocalCache } from '@/databases/hooks/balance';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { useWhitelist } from '@/hooks/whitelist';
import { filterMyAccounts, findAccountByPriority } from '@/utils/account';
import { ellipsisAddress } from '@/utils/address';
import { getTokenSettings } from '@/utils/getTokenSettings';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { KeyringTypeName } from '@rabby-wallet/keyring-utils/src/types';
import { groupBy } from 'lodash';
import { useCallback, useLayoutEffect, useState } from 'react';

export const useWhiteListAddress = (disableFetchBalance?: boolean) => {
  const { whitelist, isAddrOnWhitelist } = useWhitelist({
    disableAutoFetch: false,
  });
  const { accounts } = useAccounts({ disableAutoFetch: true });
  const [list, setList] = useState<KeyringAccountWithAlias[]>([]);
  useLayoutEffect(() => {
    (async () => {
      const groupAccounts = groupBy(accounts, item =>
        item.address.toLowerCase(),
      );
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
      setList(
        [...unimportAddress, ...importAddress].sort(
          (a, b) => (b.balance || 0) - (a.balance || 0),
        ),
      );
      if (!disableFetchBalance) {
        const userTokenSettings = await getTokenSettings();
        Promise.allSettled(
          unimportAddress
            .filter(acc => !acc.balance)
            .map(async acc => {
              const { total_usd_value } = await batchBalanceWithLocalCache({
                address: acc.address,
                isCore: false,
                ...userTokenSettings,
              });
              return { address: acc.address, balance: total_usd_value || 0 };
            }),
        ).then(result => {
          const successRes = result
            .filter(item => item.status === 'fulfilled')
            .reduce((pre, curr) => {
              pre[curr.value.address] = curr.value.balance;
              return pre;
            }, {});
          setList(pre =>
            pre.map(item => ({
              ...item,
              balance: successRes[item.address] || item.balance,
            })),
          );
        });
      }
    })();
  }, [accounts, disableFetchBalance, isAddrOnWhitelist, whitelist]);

  const findAccount = useCallback(
    async (address: string, brandName?: string, disableBalance?: boolean) => {
      const targetAccounts = accounts.filter(item =>
        isSameAddress(item.address, address),
      );
      const myAccounts = filterMyAccounts(accounts);
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
          contactService.getAliasByAddress(address)?.alias ||
          ellipsisAddress(address),
        balance,
        type: KEYRING_CLASS.WATCH,
        brandName: KEYRING_CLASS.WATCH,
      };
      return {
        inWhitelist: whitelist.some(item => isSameAddress(item, address)),
        isMyImported: myAccounts.some(item =>
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
    (address: string, brandName?: string) => {
      const targetAccounts = accounts.filter(item =>
        isSameAddress(item.address, address),
      );
      const myAccounts = filterMyAccounts(accounts);
      let balance = 0;
      const defaultAccount = {
        address,
        aliasName:
          contactService.getAliasByAddress(address)?.alias ||
          ellipsisAddress(address),
        balance,
        type: KEYRING_CLASS.WATCH,
        brandName: KEYRING_CLASS.WATCH,
      };
      return {
        inWhitelist: whitelist.some(item => isSameAddress(item, address)),
        isMyImported: myAccounts.some(item =>
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
    list,
    findAccount,
    findAccountWithoutBalance,
  };
};
