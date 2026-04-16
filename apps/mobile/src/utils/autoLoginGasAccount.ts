import { openapi } from '@/core/request';
import { gasAccountService } from '@/core/services';
import {
  getAccountList,
  filterDirectlySignableAccounts,
  isHardwareAccount,
} from '@/core/apis/account';
import {
  setReLoginAfterInvalidSessionHandler,
  storeApiGasAccount,
} from '@/screens/GasAccount/hooks/atom';
import { Account } from '@/core/services/preference';
import { makeAvoidParallelAsyncFunc } from '@/core/utils/concurrency';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import type { KeyringAccount } from '@rabby-wallet/keyring-utils';
import type { KeyringEventAccount } from '@rabby-wallet/service-keyring';
import type { GasAccountBalanceAccount } from '@/screens/GasAccount/hooks/state';

let hasAttemptedAutoLogin = false;

export function resetAutoLoginFlag() {
  hasAttemptedAutoLogin = false;
}

function toGasAccountBalanceAccounts<T extends KeyringAccount>(
  accounts: T[],
): GasAccountBalanceAccount[] {
  return accounts.map(account => ({
    address: account.address,
    type: account.type,
    brandName: account.brandName,
  }));
}

const hasGasAccountBalance = (
  info:
    | Awaited<ReturnType<typeof openapi.getGasAccountInfoV2>>
    | null
    | undefined,
) => !!info?.account && Number(info.account.balance || 0) > 0;

async function findAccountsWithBalance<T extends KeyringAccount>(
  accounts: T[],
  options?: { stopOnFirst?: boolean },
): Promise<T[]> {
  if (!accounts.length) {
    return [];
  }

  if (options?.stopOnFirst) {
    for (const account of accounts) {
      const info = await openapi
        .getGasAccountInfoV2({ id: account.address })
        .catch(() => null);
      if (hasGasAccountBalance(info)) {
        return [account];
      }
    }
    return [];
  }

  const results = await Promise.all(
    accounts.map(account =>
      openapi.getGasAccountInfoV2({ id: account.address }).catch(() => null),
    ),
  );
  return accounts.filter((_, i) => hasGasAccountBalance(results[i]));
}

async function findFirstAccountWithBalance<T extends KeyringAccount>(
  accounts: T[],
): Promise<T | undefined> {
  const [first] = await findAccountsWithBalance(accounts, {
    stopOnFirst: true,
  });
  return first;
}

function mergeAccountsWithGasBalance(nextAccounts: GasAccountBalanceAccount[]) {
  if (!nextAccounts.length) {
    return;
  }

  const prevAccounts = gasAccountService.getAccountsWithGasAccountBalance();
  const merged = [...prevAccounts];

  nextAccounts.forEach(account => {
    const existed = merged.some(
      item =>
        isSameAddress(item.address, account.address) &&
        item.type === account.type,
    );
    if (!existed) {
      merged.push(account);
    }
  });

  storeApiGasAccount.setAccountsWithGasAccountBalance(merged);
}

async function loginAutoDetectedAccount(account?: KeyringAccount) {
  if (!account) {
    return false;
  }

  await storeApiGasAccount.loginGasAccount(account as Account);
  storeApiGasAccount.clearPendingHardwareAccount();
  return true;
}

function setPendingHardwareAccount(account?: KeyringAccount) {
  if (!account) {
    return;
  }

  storeApiGasAccount.setPendingHardwareAccount({
    address: account.address,
    type: account.type,
    brandName: account.brandName,
  });
}

function refreshAllAccountsWithBalanceInBackground(logContext: string) {
  refreshAccountsWithGasAccountBalance().catch(error => {
    console.error(
      `${logContext} refreshAccountsWithGasAccountBalance error`,
      error,
    );
  });
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
  if (hasAttemptedAutoLogin) {
    return;
  }

  const { sig } = storeApiGasAccount.getSession() || {};
  if (sig) {
    hasAttemptedAutoLogin = true;
    return;
  }

  hasAttemptedAutoLogin = true;

  try {
    const { sortedAccounts } = await getAccountList({ filter: 'onlyMine' });
    if (!sortedAccounts.length) {
      return;
    }

    const directlySignable = filterDirectlySignableAccounts(sortedAccounts);
    const hardware = sortedAccounts.filter(isHardwareAccount);

    const directAccount = await findFirstAccountWithBalance(directlySignable);
    if (await loginAutoDetectedAccount(directAccount)) {
      refreshAllAccountsWithBalanceInBackground('after auto login');
      return;
    }

    const hardwareAccount = await findFirstAccountWithBalance(hardware);
    setPendingHardwareAccount(hardwareAccount);
    refreshAllAccountsWithBalanceInBackground('after auto detect');
  } catch (error) {
    console.error('autoLoginGasAccountIfNeeded error', error);
  }
}

export const checkAddedAccountsGasAccountIfNeeded = makeAvoidParallelAsyncFunc(
  async (accounts: KeyringEventAccount[]) => {
    if (!accounts.length) {
      return;
    }

    const { sig } = storeApiGasAccount.getSession() || {};
    if (sig) {
      return;
    }

    const directlySignable = filterDirectlySignableAccounts(accounts);
    const hardware = accounts.filter(isHardwareAccount);

    const [directWithBalance, hwWithBalance] = await Promise.all([
      findAccountsWithBalance(directlySignable),
      findAccountsWithBalance(hardware),
    ]);

    mergeAccountsWithGasBalance(
      toGasAccountBalanceAccounts([...directWithBalance, ...hwWithBalance]),
    );

    if (await loginAutoDetectedAccount(directWithBalance[0])) {
      return;
    }

    setPendingHardwareAccount(hwWithBalance[0]);
  },
);

setReLoginAfterInvalidSessionHandler(async () => {
  resetAutoLoginFlag();
  await autoLoginGasAccountIfNeeded();
});
