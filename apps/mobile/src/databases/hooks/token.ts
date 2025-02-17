import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { atom, useAtom } from 'jotai';
import { useCallback, useMemo, useState } from 'react';
import { KEYRING_CLASS, KeyringAccount } from '@rabby-wallet/keyring-utils';
import * as Sentry from '@sentry/react-native';

import { TokenItemEntity } from '../entities/tokenitem';
import {
  DisplayedTokenWithOwner,
  tokenItem2AbstractTokenWithOwner,
} from '@/utils/token';
import { KeyringAccountWithAlias } from '@/hooks/account';
import {
  contactService,
  keyringService,
  preferenceService,
} from '@/core/services';
import { Account } from '@/core/services/preference';
import {
  AccountSwitcherScene,
  isSameAccount,
  useSwitchSceneCurrentAccount,
} from '@/hooks/accountsSwitcher';

export type TokenItemMaybeWithOwner = TokenItem & {
  // ownerAddress?: string;
  ownerAccount?: Account | null;
};

export function extractOwnerAccountFromTokenItem(
  token: TokenItem | TokenItemMaybeWithOwner,
) {
  if ('ownerAccount' in token) {
    return token.ownerAccount || null;
  }

  return null;
}

const getInitData = () => ({
  accounts: [],
  addressIndexedTokens: {},
  accountIndexedTokens: new Map(),
});
const allAccountsTokensMapAtom = atom<{
  accounts: Account[];
  addressIndexedTokens: { [addr: string]: TokenItemMaybeWithOwner[] };
  accountIndexedTokens: Map<Account, TokenItemMaybeWithOwner[]>;
}>(getInitData());
const isRequestingRef = { current: false };

async function fetchAccountsForTokens() {
  let nextAccounts: KeyringAccountWithAlias[] = [];
  try {
    nextAccounts = await keyringService
      .getAllVisibleAccountsArray()
      .then(accounts => {
        return accounts.filter(
          a =>
            a.type !== KEYRING_CLASS.WATCH && a.type !== KEYRING_CLASS.GNOSIS,
        );
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
    console.error(err);
    Sentry.captureException(err);
  } finally {
    return nextAccounts;
  }
}

export function useQueryLocalTokens() {
  const [accountTokenMap, setAccountTokenMap] = useAtom(
    allAccountsTokensMapAtom,
  );
  const [isRequesting, _setIsRequesting] = useState(false);

  const setIsRequesting = useCallback((value: boolean) => {
    isRequestingRef.current = value;
    _setIsRequesting(value);
  }, []);

  const fetchAllLocalTokens = useCallback(
    async (filters?: { keyword?: string; chain_server_id?: string }) => {
      if (isRequestingRef.current) return;
      setIsRequesting(true);

      const allAccounts = await fetchAccountsForTokens();

      const { keyword, chain_server_id } = filters || {};

      setAccountTokenMap(prev => ({ ...prev, accounts: allAccounts }));

      const addressSet = new Set(allAccounts.map(account => account.address));

      return Promise.all(
        [...addressSet].map(async address => {
          return TokenItemEntity.searchAllTokens({
            owner_addr: address,
            keyword,
            chain_server_id,
          }).then(tokens => {
            setAccountTokenMap(prev => {
              const nextAddressIndexedTokens = { ...prev.addressIndexedTokens };
              nextAddressIndexedTokens[address] = tokens;

              return {
                ...prev,
                addressIndexedTokens: nextAddressIndexedTokens,
              };
            });
          });
        }),
      )
        .catch(error => {
          console.error('[useQueryLocalTokens] error', error);
          if (__DEV__) setAccountTokenMap(getInitData());
        })
        .finally(() => {
          setIsRequesting(false);
        });
    },
    [setAccountTokenMap, setIsRequesting],
  );

  const {
    tokenItems: sortedTokensWithOwner,
    displayTokens: sortedDisplayTokensWithOwner,
  } = useMemo(() => {
    const { accounts, addressIndexedTokens } = accountTokenMap;

    const result = accounts.reduce(
      (accu, account) => {
        const tokens = addressIndexedTokens[account.address] || [];

        accu.tokenItems = accu.tokenItems.concat(
          tokens.map(x => ({ ...x, ownerAccount: account })),
        );
        // accu.displayTokens = accu.displayTokens.concat(
        //   tokens.map(token => tokenItem2AbstractTokenWithOwner(token, account)),
        // );
        return accu;
      },
      {
        tokenItems: [] as TokenItemMaybeWithOwner[],
        displayTokens: [] as DisplayedTokenWithOwner[],
      },
    );

    // sort all tokens by usd_value = item.price * item.amount descending, for same usd_value, sort by account order
    result.tokenItems.sort((a, b) => {
      const aUsdValue = a.price * a.amount;
      const bUsdValue = b.price * b.amount;

      return bUsdValue - aUsdValue;
    });

    result.displayTokens = result.tokenItems.map(token =>
      tokenItem2AbstractTokenWithOwner(token),
    );

    return result;
  }, [accountTokenMap]);

  return {
    isSearchingLocalTokens: isRequesting,
    // accountTokenMap,
    sortedTokensWithOwner,
    sortedDisplayTokensWithOwner,
    fetchAllLocalTokens,
  };
}

export function useSwitchSceneAccountOnSelectedTokenWithOwner(
  forScene: AccountSwitcherScene,
) {
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  const switchAccountOnSelectedToken = useCallback(
    (input: {
      token: TokenItemMaybeWithOwner;
      currentAccount: Account | null;
    }) => {
      const result = { accountSwitchTo: null as Account | null };
      const maybeOwnerAccount = extractOwnerAccountFromTokenItem(input.token);
      if (
        maybeOwnerAccount &&
        !isSameAccount(maybeOwnerAccount, input.currentAccount)
      ) {
        switchSceneCurrentAccount(forScene, maybeOwnerAccount);

        result.accountSwitchTo = maybeOwnerAccount;
      }

      return result;
    },
    [forScene, switchSceneCurrentAccount],
  );

  return { switchAccountOnSelectedToken };
}
