import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useCallback, useMemo } from 'react';
import { Account } from '@/core/services/preference';
import {
  isSameAccount,
  useSwitchSceneCurrentAccount,
} from '@/hooks/accountsSwitcher';
import { type AccountSwitcherScene } from '@/hooks/sceneAccountInfoAtom';
import { useMyAccounts } from '@/hooks/account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { findAccountByPriority } from '@/utils/account';

export type TokenItemMaybeWithOwner = TokenItem & {
  owner_addr?: string;
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
  const { accounts } = useMyAccounts({ disableAutoFetch: true });

  const switchAccountOnSelectedToken = useCallback(
    (input: {
      token: TokenItemMaybeWithOwner;
      currentAccount: Account | null;
    }) => {
      const result = { accountSwitchTo: null as Account | null };
      const _accounts = accounts.filter(account =>
        isSameAddress(account?.address, input.token.owner_addr || ''),
      );
      const maybeOwnerAccount = findAccountByPriority(_accounts);
      if (
        maybeOwnerAccount &&
        !isSameAccount(maybeOwnerAccount, input.currentAccount)
      ) {
        switchSceneCurrentAccount(forScene, maybeOwnerAccount);

        result.accountSwitchTo = maybeOwnerAccount;
      }

      return result;
    },
    [accounts, forScene, switchSceneCurrentAccount],
  );

  return { switchAccountOnSelectedToken };
}
