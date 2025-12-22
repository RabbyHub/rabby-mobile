import { KeyringAccountWithAlias } from '@/hooks/account';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { useShallow } from 'zustand/react/shallow';
import { useCallback } from 'react';

export type AliasNameEditModalConfirmCallback = (aliasName: string) => void;

type AliasNameEditModalState = {
  visible: boolean;
  account: KeyringAccountWithAlias | undefined;
  accountIconUri: string;
};

const aliasNameEditModalStore = zCreate<AliasNameEditModalState>(() => ({
  visible: false,
  account: undefined,
  accountIconUri: '',
}));

let confirmCallBack: {
  value: AliasNameEditModalConfirmCallback | undefined;
} = {
  value: undefined,
};

function setAliasNameEditModalState(
  valOrFunc: UpdaterOrPartials<AliasNameEditModalState>,
) {
  aliasNameEditModalStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc);
    return { ...prev, ...newVal };
  });
}

function setVisible(valOrFunc: UpdaterOrPartials<boolean>) {
  aliasNameEditModalStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.visible, valOrFunc);
    return { ...prev, visible: newVal };
  });
}

function setAccount(
  valOrFunc: UpdaterOrPartials<KeyringAccountWithAlias | undefined>,
) {
  aliasNameEditModalStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.account, valOrFunc);
    return { ...prev, account: newVal };
  });
}

function setAccountIcon(valOrFunc: UpdaterOrPartials<string>) {
  aliasNameEditModalStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.accountIconUri, valOrFunc);
    return { ...prev, accountIconUri: newVal };
  });
}

export const useAliasNameEditModal = () => {
  const { visible, account, accountIconUri } = aliasNameEditModalStore(
    useShallow(s => s),
  );

  const show = useCallback(
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

  const hide = useCallback(() => {
    setVisible(false);
    setAccountIcon('');
    confirmCallBack.value = undefined;
  }, []);

  return { visible, account, accountIconUri, show, hide };
};

export { confirmCallBack };
