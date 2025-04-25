import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useCallback, useMemo } from 'react';
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
