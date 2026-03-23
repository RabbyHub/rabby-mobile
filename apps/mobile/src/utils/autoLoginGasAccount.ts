import { openapi } from '@/core/request';
import { gasAccountService } from '@/core/services';
import {
  getAccountList,
  filterDirectlySignableAccounts,
  isHardwareAccount,
  KeyringAccountWithAlias,
} from '@/core/apis/account';
import { storeApiGasAccount } from '@/screens/GasAccount/hooks/atom';
import { Account } from '@/core/services/preference';
import { makeAvoidParallelAsyncFunc } from '@/core/utils/concurrency';

let hasAttemptedAutoLogin = false;

export function resetAutoLoginFlag() {
  hasAttemptedAutoLogin = false;
}

type GasAccountBalanceAccount = {
  address: string;
  type: string;
  brandName: string;
};

function toGasAccountBalanceAccounts<T extends KeyringAccountWithAlias>(
  accounts: T[],
): GasAccountBalanceAccount[] {
  return accounts.map(account => ({
    address: account.address,
    type: account.type,
    brandName: account.brandName,
  }));
}

async function findAccountsWithBalance<T extends KeyringAccountWithAlias>(
  accounts: T[],
) {
  if (!accounts.length) return [] as T[];

  const results = await Promise.all(
    accounts.map(account =>
      openapi.getGasAccountInfoV2({ id: account.address }).catch(() => null),
    ),
  );

  const matched: T[] = [];
  for (let i = 0; i < results.length; i++) {
    const info = results[i];
    const account = accounts[i];
    if (account && info?.account && Number(info.account.balance || 0) > 0) {
      matched.push(account);
    }
  }
  return matched;
}

export const refreshAccountsWithGasAccountBalance = makeAvoidParallelAsyncFunc(
  async () => {
    try {
      const { sortedAccounts } = await getAccountList({ filter: 'onlyMine' });
      if (!sortedAccounts.length) {
        storeApiGasAccount.setAccountsWithGasAccountBalance([]);
        return [];
      }

      const allWithBalance = await findAccountsWithBalance(sortedAccounts);
      const mapped = toGasAccountBalanceAccounts(allWithBalance);
      storeApiGasAccount.setAccountsWithGasAccountBalance(mapped);
      return mapped;
    } catch (error) {
      console.error('refreshAccountsWithGasAccountBalance error', error);
      return gasAccountService.getAccountsWithGasAccountBalance();
    }
  },
);

export async function autoLoginGasAccountIfNeeded() {
  if (hasAttemptedAutoLogin) return;

  const { sig } = storeApiGasAccount.getSigState() || {};
  if (sig) {
    hasAttemptedAutoLogin = true;
    return;
  }

  hasAttemptedAutoLogin = true;

  try {
    const { sortedAccounts } = await getAccountList({ filter: 'onlyMine' });
    if (!sortedAccounts.length) return;

    const directlySignable = filterDirectlySignableAccounts(sortedAccounts);
    const hardware = sortedAccounts.filter(isHardwareAccount);

    // Check directly signable accounts first
    const directWithBalance = await findAccountsWithBalance(directlySignable);
    const hwWithBalance = await findAccountsWithBalance(hardware);

    // Record all accounts with balance
    const allWithBalance = toGasAccountBalanceAccounts([
      ...directWithBalance,
      ...hwWithBalance,
    ]);
    storeApiGasAccount.setAccountsWithGasAccountBalance(allWithBalance);

    if (directWithBalance.length > 0) {
      // Auto-login with the first directly signable account
      await storeApiGasAccount.loginGasAccount(directWithBalance[0] as Account);
      gasAccountService.clearPendingHardwareAccount();
      return;
    }

    if (hwWithBalance[0]) {
      // Don't auto-login hardware wallets, just mark
      gasAccountService.setPendingHardwareAccount({
        address: hwWithBalance[0].address,
        type: hwWithBalance[0].type,
        brandName: hwWithBalance[0].brandName,
      });
    }
  } catch (error) {
    console.error('autoLoginGasAccountIfNeeded error', error);
  }
}
