import {
  DisplayKeyring,
  DisplayedKeyring,
  KeyringAccount,
  KeyringIntf,
} from '@rabby-wallet/keyring-utils';
import { contactService, keyringService, preferenceService } from '../services';
import { IDisplayedAccountWithBalance } from '@/hooks/accountToDisplay';
import { TotalBalanceResponse } from '@rabby-wallet/rabby-api/dist/types';
import * as Sentry from '@sentry/react-native';

import { getAddressCacheBalance } from './balance';
import { requestKeyring } from './keyring';
import { isEqual } from 'lodash';

function ensureDisplayKeyring(keyring: KeyringIntf | DisplayKeyring) {
  if (keyring instanceof DisplayKeyring) {
    return keyring;
  }

  return new DisplayKeyring(keyring);
}

export async function hasVisibleAccounts() {
  const restAccountsCount = await keyringService.getCountOfAccountsInKeyring();
  return restAccountsCount > 0;
}

async function getAllVisibleAccounts(): Promise<DisplayedKeyring[]> {
  const typedAccounts = await keyringService.getAllTypedVisibleAccounts();

  return typedAccounts.map(account => ({
    ...account,
    keyring: ensureDisplayKeyring(account.keyring),
  }));
}

export async function getAllAccountsToDisplay() {
  const [displayedKeyrings, allAliasNames] = await Promise.all([
    getAllVisibleAccounts(),
    contactService.getAliasByMap(),
  ]);

  const result = await Promise.all<IDisplayedAccountWithBalance>(
    displayedKeyrings
      .map(item => {
        return item.accounts.map(account => {
          return {
            ...account,
            address: account.address.toLowerCase(),
            type: item.type,
            byImport: item.byImport,
            aliasName: allAliasNames[account?.address?.toLowerCase()]?.alias,
            keyring: item.keyring,
            publicKey: item?.publicKey,
          };
        });
      })
      .flat(1)
      .map(async item => {
        let balance: TotalBalanceResponse | null = null;

        let accountInfo = {} as {
          hdPathBasePublicKey?: string;
          hdPathType?: string;
        };

        await Promise.allSettled([
          getAddressCacheBalance(item?.address),
          requestKeyring(item.type, 'getAccountInfo', null, item.address),
        ]).then(([res1, res2]) => {
          if (res1.status === 'fulfilled') {
            balance = res1.value;
          }
          if (res2.status === 'fulfilled') {
            accountInfo = res2.value;
          }
        });

        if (!balance) {
          balance = {
            total_usd_value: 0,
            chain_list: [],
          };
        }
        return {
          ...item,
          balance: balance?.total_usd_value || 0,
          hdPathBasePublicKey: accountInfo?.hdPathBasePublicKey,
          hdPathType: accountInfo?.hdPathType,
        };
      }),
  );

  return result;
}

export type KeyringAccountWithAlias = KeyringAccount & {
  aliasName?: string;
  balance?: number;
  evmBalance?: number;
};

/**
 * @description if new fetched accounts are same from the existing ones, return the existing ones
 * to keep same ref to avoid later re-renders on React Hooks
 */
const existedAccountsRef = { current: [] as KeyringAccountWithAlias[] };
export async function fetchAllAccounts() {
  let nextAccounts: KeyringAccountWithAlias[] = [];
  try {
    nextAccounts = await keyringService
      .getAllVisibleAccountsArray()
      .then(list => {
        return list.map(account => {
          const balance = preferenceService.getAddressBalance(account.address);
          return {
            ...account,
            aliasName: '',
            evmBalance: balance?.evm_usd_value || 0,
            balance: balance?.total_usd_value || 0,
          };
        });
      });

    await Promise.allSettled(
      nextAccounts.map(async (account, idx) => {
        const aliasName = contactService.getAliasByAddress(account.address);
        nextAccounts[idx] = {
          ...account,
          aliasName: aliasName?.alias || '',
        };
      }),
    );
  } catch (err) {
    Sentry.captureException(err);
  } finally {
    if (!isEqual(existedAccountsRef.current, nextAccounts)) {
      existedAccountsRef.current = nextAccounts;
    }

    return existedAccountsRef.current;
  }
}
