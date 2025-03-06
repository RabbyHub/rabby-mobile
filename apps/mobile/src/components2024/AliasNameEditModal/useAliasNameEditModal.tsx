import { KeyringAccountWithAlias } from '@/hooks/account';
import { atom, useAtom } from 'jotai';
import React from 'react';

export const visibleAtom = atom(false);
export const accountAtom = atom<KeyringAccountWithAlias | undefined>(undefined);
export const accountIconUriAtom = atom<string>('');

export const useAliasNameEditModal = () => {
  const [_, setVisible] = useAtom(visibleAtom);
  const [_1, setAccount] = useAtom(accountAtom);
  const [_2, setAccountIcon] = useAtom(accountIconUriAtom);

  const show = React.useCallback(
    (a: KeyringAccountWithAlias, uri?: string) => {
      setVisible(true);
      setAccount(a);
      setAccountIcon(uri || '');
    },
    [setAccount, setAccountIcon, setVisible],
  );

  const hide = React.useCallback(() => {
    setVisible(false);
    setAccountIcon('');
  }, [setAccountIcon, setVisible]);

  return { show, hide };
};
