import { unionBy } from 'lodash';

import {
  filterOutTop10Accounts,
  filterOutTopAccounts,
} from '@/core/apis/account';
import { DEFAULT_HOME_ASSET_TOP_N } from '@/constant/homeAssetSelection';

type AddressAccount = {
  address: string;
  balance?: number;
};

export type HomeAccountSelection<T extends AddressAccount> = {
  selectedAccounts: T[];
  selectedAddresses: string[];
  selectedAddressRecords: Set<string>;
  restAccounts: T[];
};

export function pickHomeAccountSelectionFromSortedAccounts<
  T extends AddressAccount,
>(
  sortedAccounts: T[],
  options?: { topN?: number; uniqueAddresses?: boolean },
): HomeAccountSelection<T> {
  const topN = Math.max(
    1,
    Math.floor(options?.topN ?? DEFAULT_HOME_ASSET_TOP_N),
  );

  if (topN === DEFAULT_HOME_ASSET_TOP_N && !options?.uniqueAddresses) {
    const { top10Accounts, top10Addresses, top10Records, restAccounts } =
      filterOutTop10Accounts(sortedAccounts, {
        gatherSameAddress: false,
      });

    return {
      selectedAccounts: unionBy(top10Accounts, account =>
        account.address.toLowerCase(),
      ),
      selectedAddresses: top10Addresses.map(address => address.toLowerCase()),
      selectedAddressRecords: top10Records,
      restAccounts,
    };
  }

  const { topAccounts, topAddresses, topRecords, restAccounts } =
    filterOutTopAccounts(sortedAccounts, {
      topCount: topN,
      gatherSameAddress: true,
    });

  return {
    selectedAccounts: unionBy(topAccounts, account =>
      account.address.toLowerCase(),
    ),
    selectedAddresses: topAddresses.map(address => address.toLowerCase()),
    selectedAddressRecords: topRecords,
    restAccounts,
  };
}

export function pickHomeAccountSelectionFromAddresses<T extends AddressAccount>(
  sortedAccounts: T[],
  addresses: string[],
): HomeAccountSelection<T> {
  const accountByAddress = new Map<string, T>();
  sortedAccounts.forEach(account => {
    const address = account.address.toLowerCase();
    if (!accountByAddress.has(address)) {
      accountByAddress.set(address, account);
    }
  });

  const selectedAddressRecords = new Set<string>();
  const selectedAddresses: string[] = [];
  const selectedAccounts: T[] = [];
  addresses.forEach(address => {
    const normalizedAddress = address.toLowerCase();
    const account = accountByAddress.get(normalizedAddress);
    if (!account || selectedAddressRecords.has(normalizedAddress)) {
      return;
    }

    selectedAddressRecords.add(normalizedAddress);
    selectedAddresses.push(normalizedAddress);
    selectedAccounts.push(account);
  });

  return {
    selectedAccounts,
    selectedAddresses,
    selectedAddressRecords,
    restAccounts: sortedAccounts.filter(
      account => !selectedAddressRecords.has(account.address.toLowerCase()),
    ),
  };
}
