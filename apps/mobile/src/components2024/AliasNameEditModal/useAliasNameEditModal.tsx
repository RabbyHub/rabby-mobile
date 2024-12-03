import { KeyringAccountWithAlias } from '@/hooks/account';
import { atom, useAtom } from 'jotai';
import React from 'react';

export const visibleAtom = atom(false);
export const accountAtom = atom<KeyringAccountWithAlias | undefined>(undefined);

export const useAliasNameEditModal = () => {
  const [_, setVisible] = useAtom(visibleAtom);
  const [_1, setAccount] = useAtom(accountAtom);

  const show = React.useCallback(
    (a: KeyringAccountWithAlias) => {
      setVisible(true);
      setAccount(a);
    },
    [setAccount, setVisible],
  );

  const hide = React.useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  return { show, hide };
};
