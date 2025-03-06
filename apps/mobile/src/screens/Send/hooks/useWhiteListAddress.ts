import { contactService } from '@/core/services';
import { batchBalanceWithLocalCache } from '@/databases/hooks/balance';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { useWhitelist } from '@/hooks/whitelist';
import { findAccountByPriority } from '@/screens/TransactionRecord/components/TransactionItem2025';
import { ellipsisAddress } from '@/utils/address';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { KeyringTypeName } from '@rabby-wallet/keyring-utils/src/types';
import { useEffect, useState } from 'react';

export const useWhiteListAddress = (disableFetchBalance?: boolean) => {
  const { whitelist } = useWhitelist({ disableAutoFetch: false });
  const { accounts } = useAccounts({ disableAutoFetch: true });
  const [list, setList] = useState<KeyringAccountWithAlias[]>([]);
  useEffect(() => {
    const importAddress: KeyringAccountWithAlias[] = accounts
      .filter(acc => whitelist.includes(acc.address))
      .map(acc => ({
        address: acc.address,
        aliasName: acc.aliasName || ellipsisAddress(acc.address),
        balance: acc.balance || 0,
        type: acc.brandName as KeyringTypeName,
        brandName: acc.brandName,
      }));
    const importAddressSet = new Set(importAddress.map(item => item.address));
    const unimportAddress: KeyringAccountWithAlias[] = whitelist
      .filter(item => !importAddressSet.has(item))
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
      Promise.allSettled(
        unimportAddress
          .filter(acc => !acc.balance)
          .map(async acc => {
            const { total_usd_value } = await batchBalanceWithLocalCache({
              address: acc.address,
              isCore: false,
              included_token_uuids: [],
              excluded_token_uuids: [],
              excluded_protocol_ids: [],
              excluded_chain_ids: [],
            });
            return { address: acc.address, balance: total_usd_value || 0 };
          }),
      ).then(result => {
        const successRes = result
          .filter(item => item.status === 'fulfilled')
          .reduce(
            (pre, curr) => (pre[curr.value.address] = curr.value.balance),
            {},
          );
        setList(pre =>
          pre.map(item => ({
            ...item,
            balance: successRes[item.address] || item.balance,
          })),
        );
      });
    }
  }, [accounts, disableFetchBalance, whitelist]);

  const findAccount = (address: string) => {
    const targetAccounts = accounts.filter(item =>
      isSameAddress(item.address, address),
    );
    return {
      inWhitelist: whitelist.some(item => isSameAddress(item, address)),
      account: targetAccounts.length
        ? findAccountByPriority(targetAccounts)
        : {
            address,
            aliasName:
              contactService.getAliasByAddress(address)?.alias ||
              ellipsisAddress(address),
            balance: 0,
            type: KEYRING_CLASS.WATCH,
            brandName: KEYRING_CLASS.WATCH,
          },
    };
  };
  return {
    list,
    findAccount,
  };
};
