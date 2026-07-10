import { addressUtils } from '@rabby-wallet/base-utils';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import WatchKeyring from '@rabby-wallet/eth-keyring-watch';

import { isSameAccount } from '@/utils/isSameAccount';
import type { KeyringAccountWithAlias } from '@/types/account';
import {
  contactServiceApi,
  dappServiceApi,
  getFallbackAccountSnapshot,
  keyringServiceApi,
  perpsServiceApi,
  preferenceServiceApi,
  sessionServiceApi,
  whitelistServiceApi,
} from '@/core/serviceApi';
import { transactionHistoryServiceApi } from '@/core/serviceApi/transactionHistory';
import { getKeyring } from './keyring';
import { BroadcastEvent } from '@/constant/event';
import { removeTestnetAddressBalanceCache } from '@/utils/testnetAddressBalanceCache';
import {
  isSensitiveKeyringType,
  withWalletUnlockIf,
} from '@/utils/walletUnlockGuard';
import { disconnectWalletConnectSessionsForRemovedAccount } from '../walletconnect/accountRemoval';

export async function addWatchAddress(address: string) {
  const keyring = await getKeyring<WatchKeyring>(
    KEYRING_TYPE.WatchAddressKeyring,
  );

  keyring.setAccountToAdd(address);
  const result = await keyringServiceApi.addNewAccount(keyring);
  await preferenceServiceApi.initCurrentAccount();

  return result;
}

/**
 * @deprecated just for migration, use `addWatchAddress` instead
 */
export const addWatchAddressOnly = addWatchAddress;

export function getCurrentAccount() {
  return getFallbackAccountSnapshot();
}

async function resetCurrentAccount() {
  const [account] = await getAllAccounts();
  if (account) {
    await preferenceServiceApi.setCurrentAccount(account);
  } else {
    await preferenceServiceApi.setCurrentAccount(null);
  }
}

export const removeAddress = withWalletUnlockIf(
  account => isSensitiveKeyringType(account.type),
  async (account: KeyringAccountWithAlias) => {
    const isRemoveEmptyKeyring =
      account.type !== KEYRING_TYPE.WalletConnectKeyring;

    await keyringServiceApi.removeAccount(
      account.address,
      account.type,
      account.brandName,
      isRemoveEmptyKeyring,
    );
    await disconnectWalletConnectSessionsForRemovedAccount(account);

    const hasSameAddressLeft = await keyringServiceApi.hasAddress(
      account.address,
    );
    if (!hasSameAddressLeft) {
      removeTestnetAddressBalanceCache(account.address);
      await preferenceServiceApi.removeAddressAvatar(account.address);
      await contactServiceApi.removeAlias(account.address);
      await whitelistServiceApi.removeWhitelist(account.address);
      await transactionHistoryServiceApi.removeList(account.address);
      await perpsServiceApi.removeAgentWallet(account.address);
    }
    await preferenceServiceApi.removePinAddress(account);

    const currentAccount = getCurrentAccount();

    if (
      addressUtils.isSameAddress(
        currentAccount?.address || '',
        account?.address,
      ) &&
      currentAccount?.type === account.type &&
      currentAccount?.brandName === account.brandName
    ) {
      await resetCurrentAccount();
    }

    const newCurrentAccount = getCurrentAccount();
    const dapps = await dappServiceApi.getDapps();
    await Promise.all(
      Object.entries(dapps).map(async ([origin, dapp]) => {
        if (isSameAccount(account, dapp.currentAccount)) {
          await dappServiceApi.updateDapp({
            ...dapp,
            origin,
            currentAccount: newCurrentAccount,
          });
          if (dapp?.isConnected) {
            await sessionServiceApi.broadcastEvent(
              BroadcastEvent.accountsChanged,
              newCurrentAccount?.address
                ? [newCurrentAccount.address.toLowerCase()]
                : [],
              origin,
            );
          }
        }
      }),
    );
  },
);

export async function getAllAccounts() {
  return await keyringServiceApi.getAllVisibleAccountsArray();
}

export async function getAllMyAccount() {
  const accouts = await keyringServiceApi.getAllVisibleAccountsArray();
  return accouts.filter(item => {
    return (
      item.type !== KEYRING_TYPE.WatchAddressKeyring &&
      item.type !== KEYRING_TYPE.GnosisKeyring
    );
  });
}

export async function addWalletConnectAddress(addrses: string) {}

export async function getAddressesForReport(
  allAccounts?: KeyringAccountWithAlias[],
) {
  const myAccountList = allAccounts || (await getAllAccounts());
  const myCallableAddresses: string[] = [];
  const myUncallableAddresses: string[] = [];

  const {
    callables: myCallableAddressCount,
    uncallables: myUncallableAddressCount,
  } = myAccountList.reduce(
    (acc, item) => {
      if (
        item.type !== KEYRING_TYPE.WatchAddressKeyring &&
        item.type !== KEYRING_TYPE.GnosisKeyring
      ) {
        myCallableAddresses.push(item.address);
        acc.callables += 1;
      } else {
        myUncallableAddresses.push(item.address);
        acc.uncallables += 1;
      }
      return acc;
    },
    { callables: 0, uncallables: 0 },
  );

  return {
    myCallableAddresses,
    myUncallableAddresses,
    myCallableAddressCount,
    myUncallableAddressCount,
  };
}
