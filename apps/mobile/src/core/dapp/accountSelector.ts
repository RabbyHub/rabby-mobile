import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { sortBy } from 'lodash';

import type { KeyringAccountWithAlias } from '@/core/account/utils';
import type { DappInfo } from '@/core/services/dappService';

type RecentDappTransaction = {
  createdAt: number;
  address: string;
  keyringType?: string | null;
};

export function selectDappAccount({
  dappInfo,
  accounts,
  recentTransactions = [],
  fallbackAccount,
}: {
  dappInfo?: Pick<DappInfo, 'currentAccount'>;
  accounts: KeyringAccountWithAlias[];
  recentTransactions?: RecentDappTransaction[];
  fallbackAccount?: KeyringAccountWithAlias | null;
}) {
  let matchedAccount = accounts.find(
    acc =>
      dappInfo?.currentAccount &&
      isSameAddress(acc.address, dappInfo.currentAccount.address) &&
      acc.type === dappInfo.currentAccount.type,
  );

  if (!matchedAccount) {
    const latestTx = sortBy(recentTransactions, item => -item.createdAt)[0];

    if (latestTx) {
      matchedAccount = accounts.find(
        acc =>
          isSameAddress(acc.address, latestTx.address) &&
          (latestTx.keyringType ? acc.type === latestTx.keyringType : true),
      );
    }
  }

  return matchedAccount || accounts[0] || fallbackAccount || null;
}
