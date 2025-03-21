import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { atom, useAtom } from 'jotai';
import { useCallback, useMemo } from 'react';
import * as Sentry from '@sentry/react-native';

import { tokenItem2AbstractTokenWithOwner } from '@/utils/token';
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
import { filterMyAccounts, isWatchOrSafeAccount } from '@/utils/account';
import { tagTokenItem } from '@/screens/Home/utils/token';
import groupBy from 'lodash/groupBy';

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

export function makeKeyForTokenItemMaybeWithOwner(
  token: TokenItemMaybeWithOwner,
  tokenKey?: string,
) {
  const ownerAccount = extractOwnerAccountFromTokenItem(token);
  const ownerKey = !ownerAccount
    ? ''
    : `${ownerAccount.type}-${ownerAccount.address}`;

  const token_key = [
    ownerKey,
    tokenKey || `${token.id}-${token.optimized_symbol}-${token.chain}`,
  ]
    .filter(Boolean)
    .join('-');

  return token_key;
}

type ExtractFromPromise<T> = T extends Promise<infer U> ? U : T;

const getInitData = () => ({
  accounts: [],
  addressIndexedTokens: {},
  userTokenSettings: {},
});
const allAccountsTokensMapAtom = atom<{
  accounts: Account[];
  addressIndexedTokens: { [addr: string]: TokenItemMaybeWithOwner[] };
  userTokenSettings: Partial<
    ExtractFromPromise<
      ReturnType<typeof preferenceService.getUserTokenSettings>
    >
  >;
}>(getInitData());
const isRequestingRef = { current: false };

async function fetchAccountsForTokens() {
  let nextAccounts: KeyringAccountWithAlias[] = [];
  try {
    nextAccounts = await keyringService
      .getAllVisibleAccountsArray()
      .then(filterMyAccounts);

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

export function useQueryLocalTokens(tokens: TokenItem[]) {
  const [accountTokenMap, setAccountTokenMap] = useAtom(
    allAccountsTokensMapAtom,
  );
  const fetchAllLocalTokens = useCallback(
    async (filters?: { keyword?: string; chain_server_id?: string }) => {
      if (isRequestingRef.current) {
        return;
      }
      const { keyword, chain_server_id } = filters || {};
      if (
        !accountTokenMap.accounts.length ||
        !Object.keys(accountTokenMap.userTokenSettings).length
      ) {
        const [allAccounts, tokenSettings] = await Promise.all([
          fetchAccountsForTokens().then(accounts =>
            accounts.filter(account => !isWatchOrSafeAccount(account)),
          ),
          preferenceService
            .getUserTokenSettings()
            .then(res => res || {})
            .catch(err => {
              console.error('fetchAllLocalTokens', err);
              return {};
            }),
        ]);
        setAccountTokenMap(prev => ({
          ...prev,
          accounts: allAccounts,
          userTokenSettings: tokenSettings,
        }));
      }

      let resTokens: TokenItem[] = [...tokens];
      if (keyword) {
        resTokens = resTokens.filter(item => {
          const allMatchKeyWords = [item.chain, item.id];
          const partMatchKeyWords = [
            item.name,
            item.symbol,
            item.optimized_symbol,
            item.display_symbol,
          ];
          const allMatch = allMatchKeyWords.some(
            i => i?.toLocaleLowerCase() === keyword.toLocaleLowerCase(),
          );
          const partMatch = partMatchKeyWords.some(i =>
            i?.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()),
          );
          return allMatch || partMatch;
        });
      }
      if (chain_server_id) {
        resTokens = resTokens.filter(token => token.chain === chain_server_id);
      }
      resTokens = resTokens.sort((a, b) => {
        const aUsdValue = a.usd_value || a.price * a.amount;
        const bUsdValue = b.usd_value || b.price * b.amount;

        return bUsdValue - aUsdValue;
      });
      if (!resTokens.length) {
        return;
      }
      const assestGroup = groupBy(resTokens, 'owner_addr');
      setAccountTokenMap(prev => {
        return {
          ...prev,
          addressIndexedTokens: assestGroup,
        };
      });
    },
    [
      accountTokenMap.accounts.length,
      accountTokenMap.userTokenSettings,
      setAccountTokenMap,
      tokens,
    ],
  );

  const sortedDisplayTokensWithOwner = useMemo(() => {
    const { accounts, addressIndexedTokens } = accountTokenMap;

    const tokenItems = accounts
      .reduce((pre, curr) => {
        const _tokens = addressIndexedTokens[curr.address] || [];

        pre = pre.concat(_tokens.map(x => ({ ...x, ownerAccount: curr })));
        return pre;
      }, [] as TokenItemMaybeWithOwner[])
      .sort((a, b) => {
        const aUsdValue = a.price * a.amount;
        const bUsdValue = b.price * b.amount;

        return bUsdValue - aUsdValue;
      });

    return tokenItems.map(token => {
      const data = tokenItem2AbstractTokenWithOwner(token, token.ownerAccount);
      return tagTokenItem(data, accountTokenMap.userTokenSettings);
    });
  }, [accountTokenMap]);

  return {
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
