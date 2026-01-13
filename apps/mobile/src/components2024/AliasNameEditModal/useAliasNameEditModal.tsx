import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { atom, useAtom } from 'jotai';
import React from 'react';
import { useShallow } from 'zustand/react/shallow';

export type AliasNameEditModalConfirmCallback = (aliasName: string) => void;

type AliasEditModalState = {
  visible: boolean;
  account: KeyringAccountWithAlias | undefined;
  accountIconUri: string;
};
const aliasEditModalStore = zCreate<AliasEditModalState>(() => ({
  visible: false,
  account: undefined,
  accountIconUri: '',
}));

function setVisible(
  valOrFunc: UpdaterOrPartials<AliasEditModalState['visible']>,
) {
  aliasEditModalStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.visible, valOrFunc, {
      strict: false,
    });

    return { ...prev, visible: newVal };
  });
}
function setAccount(
  valOrFunc: UpdaterOrPartials<AliasEditModalState['account']>,
) {
  aliasEditModalStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.account, valOrFunc, {
      strict: false,
    });

    return { ...prev, account: newVal };
  });
}
function setAccountIcon(
  valOrFunc: UpdaterOrPartials<AliasEditModalState['accountIconUri']>,
) {
  aliasEditModalStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.accountIconUri, valOrFunc, {
      strict: false,
    });

    return { ...prev, accountIconUri: newVal };
  });
}

export function useAliasNameEditModalState() {
  const { visible, account, accountIconUri } = aliasEditModalStore(
    useShallow(s => s),
  );

  return {
    visible,
    account,
    accountIconUri,
    setVisible,
  };
}

export let confirmCallBack: {
  value: AliasNameEditModalConfirmCallback | undefined;
} = {
  value: undefined,
};

export const useAliasNameEditModal = () => {
  const show = React.useCallback(
    (
      a: KeyringAccountWithAlias,
      uri?: string,
      cb?: AliasNameEditModalConfirmCallback,
    ) => {
      setVisible(true);
      setAccount(a);
      setAccountIcon(uri || '');
      confirmCallBack.value = cb;
    },
    [],
  );

  const hide = React.useCallback(() => {
    setVisible(false);
    setAccountIcon('');
    confirmCallBack.value = undefined;
  }, []);

  return { show, hide };
};
