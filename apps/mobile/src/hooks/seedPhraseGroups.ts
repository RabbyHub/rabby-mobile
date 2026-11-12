import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import type { DisplayedKeyring } from '@rabby-wallet/keyring-utils';
import type { IPinAddress, KeyringAccountWithAlias } from '@/types/account';
import { sortAccountsByBalance } from '@/utils/account';
import type { TypeKeyringGroup } from './useWalletTypeData';

type PublicHdKeyring = { publicKey: string; addresses: string[] };

// null means that the secret runtime has not published its keyring inventory.
// Keep only public membership, never the memStore or DisplayKeyring methods.
export function selectPublicHdKeyrings(snapshot?: {
  keyringRuntimeReady: boolean;
  keyrings: DisplayedKeyring[];
}): PublicHdKeyring[] | null {
  if (!snapshot?.keyringRuntimeReady) {
    return null;
  }

  return snapshot.keyrings
    .filter(item => item.type === KEYRING_TYPE.HdKeyring && item.publicKey)
    .map(item => ({
      publicKey: item.publicKey!,
      addresses: item.accounts.map(account => account.address.toLowerCase()),
    }));
}

export function buildSeedPhraseGroups(
  keyrings: PublicHdKeyring[] | null,
  accounts: KeyringAccountWithAlias[],
  pinnedAddresses: IPinAddress[],
  name: string,
): TypeKeyringGroup[] {
  const visibleHdAccounts = sortAccountsByBalance(
    accounts
      .filter(
        account => account.type === KEYRING_TYPE.HdKeyring && account.publicKey,
      )
      .map(account => ({
        ...account,
        address: account.address.toLowerCase(),
      })),
  );
  const remainingAccounts = [...visibleHdAccounts];
  const pinnedAccounts = pinnedAddresses.flatMap(pinned => {
    const index = remainingAccounts.findIndex(
      account =>
        account.address === pinned.address &&
        account.brandName === pinned.brandName,
    );
    return index < 0 ? [] : remainingAccounts.splice(index, 1);
  });
  const orderedAccounts = [
    ...sortAccountsByBalance(pinnedAccounts),
    ...remainingAccounts,
  ];
  const accountsByPublicKey = new Map<string, KeyringAccountWithAlias[]>();
  orderedAccounts.forEach(account => {
    const group = accountsByPublicKey.get(account.publicKey!) || [];
    group.push(account);
    accountsByPublicKey.set(account.publicKey!, group);
  });

  // A cold public-account snapshot can be ready before the secret runtime.
  // Use its public grouping without forcing keyring restoration. Only a real
  // runtime inventory can tell us about HD keyrings containing zero accounts.
  const inventory =
    keyrings ||
    Array.from(
      new Set(
        accounts
          .filter(
            account =>
              account.type === KEYRING_TYPE.HdKeyring && account.publicKey,
          )
          .map(account => account.publicKey!),
      ),
    ).map(publicKey => ({ publicKey, addresses: null }));

  return inventory
    .flatMap(keyring => {
      const members = keyring.addresses && new Set(keyring.addresses);
      const list = (accountsByPublicKey.get(keyring.publicKey) || [])
        .filter(
          account => !members || members.has(account.address.toLowerCase()),
        )
        .map(account => ({
          ...account,
          address: account.address.toLowerCase(),
          balance: account.balance || 0,
        }));
      if (!list.length && keyring.addresses?.length !== 0) {
        return [];
      }

      return [
        {
          name,
          type: KEYRING_TYPE.HdKeyring,
          brandName: list[0]?.brandName || KEYRING_TYPE.HdKeyring,
          publicKey: keyring.publicKey,
          hdPathBasePublicKey: list[0]?.hdPathBasePublicKey,
          hdPathType: list[0]?.hdPathType,
          // These selection-list consumers use public account fields only.
          list,
        } as TypeKeyringGroup,
      ];
    })
    .sort((a, b) => {
      const total = (group: TypeKeyringGroup) =>
        group.list.reduce((sum, account) => sum + (account.balance || 0), 0);
      return total(b) - total(a) || b.list.length - a.list.length;
    })
    .map((group, index) => ({ ...group, index }));
}
