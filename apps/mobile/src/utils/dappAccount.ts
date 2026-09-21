import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import type { Account, KeyringAccountWithAlias } from '@/types/account';

type DappAccountInfo = {
  currentAccount?: {
    address: string;
    type?: string;
  } | null;
};

type RecentTransactionAccount = {
  address: string;
  createdAt: number;
  keyringType?: string;
};

export function resolveDappAccount({
  dappInfo,
  accounts,
  transactions,
  fallbackAccount,
}: {
  dappInfo?: DappAccountInfo;
  accounts: KeyringAccountWithAlias[];
  transactions: RecentTransactionAccount[];
  fallbackAccount?: Account | null;
}) {
  let res = accounts.find(
    acc =>
      dappInfo?.currentAccount &&
      isSameAddress(acc.address, dappInfo.currentAccount.address) &&
      acc.type === dappInfo.currentAccount.type,
  );

  if (!res) {
    const tx = [...transactions].sort((a, b) => b.createdAt - a.createdAt)[0];
    if (tx) {
      const txAccount = accounts.find(
        acc =>
          isSameAddress(acc.address, tx.address) &&
          (tx.keyringType ? acc.type === tx.keyringType : true),
      );
      if (txAccount) {
        res = txAccount;
      }
    }
  }

  return res || accounts[0] || fallbackAccount;
}
