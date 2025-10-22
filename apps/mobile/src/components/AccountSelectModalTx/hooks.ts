import { devLog } from '@/utils/logger';
import React, { useMemo } from 'react';

function getNoop() {
  return () => {
    devLog('[debug] nothing to do, but this noop should not be called');
  };
}
export type SelectAccountSheetModalScreen =
  | 'default'
  | 'enter-addr'
  | 'add-new-whitelist-addr'
  | 'select-from-history'
  | 'view-sent-tx';
export type SelectAccountSheetModalValues = {
  modalScreen: SelectAccountSheetModalScreen;

  fnNavTo: (screen: SelectAccountSheetModalScreen) => void;
  cbOnScanStageChanged: (stage: 'start' | 'end') => void;

  computed: {
    canNavBack: boolean;
    needShowHistory: boolean;
  };
};
const AccountSelectModalContext =
  React.createContext<SelectAccountSheetModalValues>({
    modalScreen: 'default',

    computed: {
      canNavBack: false,
      needShowHistory: false,
    },
    fnNavTo: getNoop(),
    cbOnScanStageChanged: getNoop(),
  });

export const AccountSelectModalProvider = AccountSelectModalContext.Provider;

function useDevWarningMustBeInContext() {
  try {
    return React.useContext(AccountSelectModalContext);
  } catch (e) {
    const errMsg =
      '[AccountSelectModalTx] Warning: useDevWarningMustBeInContext must be used within AccountSelectModalProvider';
    if (__DEV__) {
      throw new Error(errMsg);
    }
  }
}

export function useAccountSelectModalInternal() {
  useDevWarningMustBeInContext();
  const values = React.useContext(AccountSelectModalContext);

  return {
    currentScreen: values.modalScreen,
    canNavBack: values.computed.canNavBack,
    needShowHistory: values.computed.needShowHistory,
    fnNavTo: values.fnNavTo,
    cbOnScanStageChanged: values.cbOnScanStageChanged,
  };
}
