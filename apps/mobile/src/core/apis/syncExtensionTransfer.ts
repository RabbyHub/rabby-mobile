import { addressUtils } from '@rabby-wallet/base-utils';
import type { KeyringAccount } from '@rabby-wallet/keyring-utils';

import { getContactAliasMapSnapshot } from '@/core/serviceApi/contact';
import { keyringServiceApi } from '@/core/serviceApi/keyring';
import { getPinnedAddressSnapshot } from '@/core/serviceApi/preference';
import { whitelistServiceApi } from '@/core/serviceApi/whitelist';
import {
  SYNC_TRANSFER_FORMAT,
  SYNC_TRANSFER_VERSION,
} from '@/utils/syncExtensionTransfer';

const { isSameAddress } = addressUtils;

export type SyncTransferPayload = {
  format: typeof SYNC_TRANSFER_FORMAT;
  version: typeof SYNC_TRANSFER_VERSION;
  vault: Record<string, unknown>;
  whitelist: string[];
  highligtedAddresses: Array<{
    address: string;
    brandName: string;
  }>;
  alianNames: Array<{
    address: string;
    name: string;
  }>;
};

function containsAddress(addresses: string[], address: string) {
  return addresses.some(item => isSameAddress(item, address));
}

/**
 * Build the same transfer envelope as the Rabby extension. The historical
 * `highligtedAddresses` and `alianNames` spellings are part of the wire format.
 * Only `vault` is encrypted; the address metadata intentionally mirrors the
 * extension protocol and remains outside that encrypted object.
 */
export async function getSyncTransferDataString(
  selectedAccounts: KeyringAccount[],
) {
  const { vault, accounts } = await keyringServiceApi.getSyncVault(
    selectedAccounts,
  );
  const [whitelist, pinnedAddresses] = await Promise.all([
    whitelistServiceApi.getWhitelist(),
    Promise.resolve(getPinnedAddressSnapshot()),
  ]);
  const aliasMap = getContactAliasMapSnapshot();

  const payload: SyncTransferPayload = {
    format: SYNC_TRANSFER_FORMAT,
    version: SYNC_TRANSFER_VERSION,
    vault: JSON.parse(vault) as Record<string, unknown>,
    whitelist: whitelist.filter(address => containsAddress(accounts, address)),
    highligtedAddresses: pinnedAddresses.filter(item =>
      containsAddress(accounts, item.address),
    ),
    alianNames: Object.values(aliasMap)
      .filter(item => containsAddress(accounts, item.address))
      .map(item => ({
        address: item.address,
        name: item.alias,
      })),
  };

  return JSON.stringify(payload);
}
