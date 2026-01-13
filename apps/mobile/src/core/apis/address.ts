import { addressUtils } from '@rabby-wallet/base-utils';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import WatchKeyring from '@rabby-wallet/eth-keyring-watch';

import { isSameAccount } from '@/hooks/accountsSwitcher';
import { KeyringAccountWithAlias } from '@/hooks/account';
import {
  contactService,
  dappService,
  keyringService,
  perpsService,
  preferenceService,
  sessionService,
  transactionHistoryService,
  whitelistService,
} from '../services';
import { getKeyring } from './keyring';
import { BroadcastEvent } from '@/constant/event';

export async function addWatchAddress(address: string) {
  const keyring = await getKeyring<WatchKeyring>(
    KEYRING_TYPE.WatchAddressKeyring,
  );

  keyring.setAccountToAdd(address);
  const result = await keyringService.addNewAccount(keyring);
  preferenceService.initCurrentAccount();

  return result;
}

/**
 * @deprecated just for migration, use `addWatchAddress` instead
 */
export const addWatchAddressOnly = addWatchAddress;

export function getCurrentAccount() {
  return preferenceService.getFallbackAccount();
}

async function resetCurrentAccount() {
  const [account] = await getAllAccounts();
  if (account) {
    preferenceService.setCurrentAccount(account);
  } else {
    preferenceService.setCurrentAccount(null);
  }
}

export async function removeAddress(account: KeyringAccountWithAlias) {
  const isRemoveEmptyKeyring =
    account.type !== KEYRING_TYPE.WalletConnectKeyring;

  await keyringService.removeAccount(
    account.address,
    account.type,
    account.brandName,
    isRemoveEmptyKeyring,
  );

  const hasSameAddressLeft = await keyringService.hasAddress(account.address);
  if (!hasSameAddressLeft) {
    preferenceService.removeAddressBalance(account.address);
    preferenceService.removeAddressAvatar(account.address);
    contactService.removeAlias(account.address);
    whitelistService.removeWhitelist(account.address);
    transactionHistoryService.removeList(account.address);
    perpsService.removeAgentWallet(account.address);
  }
  preferenceService.removePinAddress(account);

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
  Object.entries(dappService.getDapps()).forEach(([origin, dapp]) => {
    if (isSameAccount(account, dapp.currentAccount)) {
      dappService.updateDapp({
        ...dapp,
        currentAccount: newCurrentAccount,
      });
      if (dapp?.isConnected) {
        sessionService.broadcastEvent(
          BroadcastEvent.accountsChanged,
          newCurrentAccount?.address
            ? [newCurrentAccount.address.toLowerCase()]
            : [],
          origin,
        );
      }
    }
  });
}

export async function getAllAccounts() {
  return await keyringService.getAllVisibleAccountsArray();
}

export async function getAllMyAccount() {
  const accouts = await keyringService.getAllVisibleAccountsArray();
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
