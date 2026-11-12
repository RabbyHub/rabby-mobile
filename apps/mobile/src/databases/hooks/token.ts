import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useCallback } from 'react';
import type { Account } from '@/types/account';
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
