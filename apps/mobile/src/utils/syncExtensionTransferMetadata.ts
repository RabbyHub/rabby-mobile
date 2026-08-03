import { isAddress } from 'web3-utils';

import {
  MAX_SYNC_METADATA_ADDRESS_LENGTH,
  MAX_SYNC_METADATA_ENTRIES,
  MAX_SYNC_METADATA_LABEL_LENGTH,
} from './syncExtensionTransfer';

type TransferredAccount = {
  address: string;
  brandName: string;
  type: string;
};

export function filterSyncExtensionTransferMetadata({
  transferredAccounts,
  whitelist,
  highligtedAddresses,
  alianNames,
}: {
  transferredAccounts: TransferredAccount[];
  whitelist: string[];
  highligtedAddresses: Array<{ address: string; brandName: string }>;
  alianNames: Array<{ address: string; name: string }>;
}) {
  if (
    whitelist.length > MAX_SYNC_METADATA_ENTRIES ||
    highligtedAddresses.length > MAX_SYNC_METADATA_ENTRIES ||
    alianNames.length > MAX_SYNC_METADATA_ENTRIES
  ) {
    throw new Error('Invalid wallet transfer metadata');
  }

  const transferredBrandsByAddress = new Map<string, Set<string>>();
  transferredAccounts.forEach(account => {
    if (!isAddress(account.address)) {
      return;
    }
    const addressKey = account.address.toLowerCase();
    const brands = transferredBrandsByAddress.get(addressKey) || new Set();
    brands.add(account.brandName);
    transferredBrandsByAddress.set(addressKey, brands);
  });

  const seenWhitelist = new Set<string>();
  const seenPinnedAddresses = new Set<string>();
  const seenAliases = new Set<string>();

  return {
    whitelist: whitelist.filter(address => {
      if (
        address.length > MAX_SYNC_METADATA_ADDRESS_LENGTH ||
        !isAddress(address)
      ) {
        return false;
      }
      const addressKey = address.toLowerCase();
      if (
        seenWhitelist.has(addressKey) ||
        !transferredBrandsByAddress.has(addressKey)
      ) {
        return false;
      }
      seenWhitelist.add(addressKey);
      return true;
    }),
    highligtedAddresses: highligtedAddresses.filter(item => {
      if (
        item.address.length > MAX_SYNC_METADATA_ADDRESS_LENGTH ||
        item.brandName.length > MAX_SYNC_METADATA_LABEL_LENGTH ||
        !isAddress(item.address)
      ) {
        return false;
      }
      const addressKey = item.address.toLowerCase();
      const pinnedKey = JSON.stringify([addressKey, item.brandName]);
      if (
        seenPinnedAddresses.has(pinnedKey) ||
        !transferredBrandsByAddress.get(addressKey)?.has(item.brandName)
      ) {
        return false;
      }
      seenPinnedAddresses.add(pinnedKey);
      return true;
    }),
    alianNames: alianNames.filter(item => {
      if (
        !item.name ||
        item.name.length > MAX_SYNC_METADATA_LABEL_LENGTH ||
        item.address.length > MAX_SYNC_METADATA_ADDRESS_LENGTH ||
        !isAddress(item.address)
      ) {
        return false;
      }
      const addressKey = item.address.toLowerCase();
      if (
        seenAliases.has(addressKey) ||
        !transferredBrandsByAddress.has(addressKey)
      ) {
        return false;
      }
      seenAliases.add(addressKey);
      return true;
    }),
  };
}
