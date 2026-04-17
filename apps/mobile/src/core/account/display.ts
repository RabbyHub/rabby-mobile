import {
  DisplayKeyring,
  DisplayedKeyring,
  KeyringIntf,
} from '@rabby-wallet/keyring-utils';

import { getAccountBalanceValueMap } from '@/core/account/balanceSnapshot';
import {
  getContactService,
  getKeyringService,
} from '@/core/account/accountServices';

type IDisplayedAccount = Required<DisplayedKeyring['accounts'][number]>;

export type IDisplayedAccountWithBalance = IDisplayedAccount & {
  balance: number;
  byImport?: boolean;
  publicKey?: string;
  hdPathBasePublicKey?: string;
  hdPathType?: string;
};

function ensureDisplayKeyring(keyring: KeyringIntf | DisplayKeyring) {
  if (keyring instanceof DisplayKeyring) {
    return keyring;
  }

  return new DisplayKeyring(keyring);
}

async function getAllVisibleAccounts(): Promise<DisplayedKeyring[]> {
  const keyringService = await getKeyringService();
  const typedAccounts = await keyringService.getAllTypedVisibleAccounts();

  return typedAccounts.map(account => ({
    ...account,
    keyring: ensureDisplayKeyring(account.keyring),
  }));
}

export async function getAllAccountsToDisplay(): Promise<
  IDisplayedAccountWithBalance[]
> {
  const [contactService] = await Promise.all([getContactService()]);
  const [displayedKeyrings, allAliasNames] = await Promise.all([
    getAllVisibleAccounts(),
    contactService.getAliasByMap(),
  ]);

  const result = await Promise.all(
    displayedKeyrings
      .map(item => {
        return item.accounts.map(account => {
          return {
            ...account,
            address: account.address.toLowerCase(),
            type: item.type,
            byImport: item.byImport,
            aliasName:
              allAliasNames[account.address.toLowerCase()]?.alias || '',
            keyring: item.keyring,
            publicKey: item.publicKey,
          } as IDisplayedAccountWithBalance;
        });
      })
      .flat(1)
      .map(async item => {
        const balanceMap = getAccountBalanceValueMap();
        const cachedBalance = balanceMap[item.address.toLowerCase()];
        let accountInfo: {
          hdPathBasePublicKey?: string;
          hdPathType?: string;
        } = {};

        const [accountInfoResult] = await Promise.allSettled([
          (async () => {
            const keyringService = await getKeyringService();
            const keyring = await keyringService.getKeyringForAccount(
              item.address,
              item.type,
            );

            return keyring.getAccountInfo?.(item.address);
          })(),
        ]);

        if (accountInfoResult.status === 'fulfilled') {
          accountInfo = accountInfoResult.value || {};
        }

        return {
          ...item,
          balance: cachedBalance?.totalBalance || 0,
          hdPathBasePublicKey: accountInfo.hdPathBasePublicKey,
          hdPathType: accountInfo.hdPathType,
        };
      }),
  );

  return result;
}
