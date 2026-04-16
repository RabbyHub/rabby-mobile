import { addressUtils } from '@rabby-wallet/base-utils';
import { KEYRING_CLASS, KeyringAccount } from '@rabby-wallet/keyring-utils';
import BigNumber from 'bignumber.js';

export type KeyringAccountWithAlias = KeyringAccount & {
  aliasName?: string;
  balance?: number;
  evmBalance?: number;
};

export type HighlightedAddress = {
  address: string;
  brandName?: string | null;
};

type SortableAccount = {
  address: string;
  balance?: number;
  type?: string;
  brandName?: string | null;
};

export const sortAccountsByBalance = <T extends SortableAccount>(
  accounts: T[],
) => {
  return [...accounts].sort((a, b) => {
    const balanceDiff = new BigNumber(b?.balance || 0)
      .minus(new BigNumber(a?.balance || 0))
      .toNumber();

    if (balanceDiff !== 0) {
      return balanceDiff;
    }

    const aAddress = a.address.toLowerCase();
    const bAddress = b.address.toLowerCase();
    if (aAddress !== bAddress) {
      return aAddress.localeCompare(bAddress);
    }

    const aType = typeof a.type === 'string' ? a.type : '';
    const bType = typeof b.type === 'string' ? b.type : '';
    if (aType !== bType) {
      return aType.localeCompare(bType);
    }

    const aBrandName = typeof a.brandName === 'string' ? a.brandName : '';
    const bBrandName = typeof b.brandName === 'string' ? b.brandName : '';

    return aBrandName.localeCompare(bBrandName);
  }) as T[];
};

export function isMyAccount<T extends { type?: string }>(account: T) {
  return (
    account.type !== KEYRING_CLASS.WATCH &&
    account.type !== KEYRING_CLASS.GNOSIS &&
    account.type !== KEYRING_CLASS.WALLETCONNECT
  );
}

export const filterMyAccounts = <T extends { type?: string }>(
  accounts: T[],
) => {
  return accounts.filter(isMyAccount);
};

export function isSameAccount<
  T extends { address: string; brandName?: string; type?: string },
  U extends
    | {
        address?: string | null;
        brandName?: string | null;
        type?: string | null;
      }
    | null
    | undefined,
>(account: T, other: U) {
  if (!other?.address) {
    return false;
  }

  return (
    other.address.toLowerCase() === account.address.toLowerCase() &&
    other.brandName === account.brandName &&
    other.type === account.type
  );
}

export function sortAccountList<
  T extends {
    address: string;
    brandName?: string | null;
    balance?: number;
  },
>(
  accounts: T[],
  {
    highlightedAddresses = [],
  }: {
    highlightedAddresses: HighlightedAddress[];
  },
) {
  const restAccounts = [...accounts];
  let highlightedAccounts: T[] = [];

  highlightedAddresses.forEach(highlighted => {
    const idx = restAccounts.findIndex(
      account =>
        addressUtils.isSameAddress(account.address, highlighted.address) &&
        account.brandName === highlighted.brandName,
    );
    if (idx > -1 && restAccounts[idx]) {
      highlightedAccounts.push(restAccounts[idx]);
      restAccounts.splice(idx, 1);
    }
  });
  highlightedAccounts = sortAccountsByBalance(highlightedAccounts);

  return [...highlightedAccounts, ...sortAccountsByBalance(restAccounts)];
}

export function filterOutTopAccounts<
  T extends { address: string; balance?: number },
>(sortedAccounts: T[], { topCount = 10, gatherSameAddress = false } = {}) {
  const ret = {
    topAddresses: [] as string[],
    topAccounts: [] as T[],
    restAccounts: [] as T[],
  };

  const topRecords = new Set<string>();
  if (gatherSameAddress) {
    for (const item of sortedAccounts) {
      const lowerAddress = item.address.toLowerCase();
      if (topRecords.size >= topCount) {
        break;
      }

      topRecords.add(lowerAddress);
    }

    sortedAccounts.forEach(account => {
      const lowerAddress = account.address.toLowerCase();
      if (topRecords.has(lowerAddress)) {
        ret.topAccounts.push(account);
      } else {
        ret.restAccounts.push(account);
      }
    });

    ret.topAddresses = Array.from(topRecords);
  } else {
    ret.topAccounts = sortedAccounts.slice(0, topCount);
    ret.restAccounts = sortedAccounts.slice(topCount);
    ret.topAccounts.forEach(account => {
      const lowerAddress = account.address.toLowerCase();
      if (!topRecords.has(lowerAddress)) {
        ret.topAddresses.push(lowerAddress);
      }
      topRecords.add(lowerAddress);
    });
  }

  return { ...ret, topRecords };
}
