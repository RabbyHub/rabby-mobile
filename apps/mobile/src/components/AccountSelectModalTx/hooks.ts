import React, { useEffect } from 'react';
import { isValidHexAddress, Hex } from '@metamask/utils';
import { useTranslation } from 'react-i18next';
import { useWhitelist } from '@/hooks/whitelist';
import { Alert } from 'react-native';
import { contactService } from '@/core/services';
import { devLog } from '@/utils/logger';
import { throttle } from 'lodash';
import type { HistoryLocalDetailParams } from '@/screens/TransactionRecord/components/TransactionItem2025';
import { atomByMMKV } from '@/core/storage/mmkv';
import { useAtom } from 'jotai';
import { Account } from '@/core/services/preference';
import EventEmitter from 'events';

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
  | 'view-sent-tx'
  | 'scan-qr-code';
export type SelectAccountSheetModalValues = {
  __isUnderContext__: boolean;
  modalScreen: SelectAccountSheetModalScreen;
  viewingHistoryTxData: HistoryLocalDetailParams | null;
  nextScanFor: null | 'enter-addr' | 'add-new-whitelist-addr';

  fnNavTo: (
    screen: SelectAccountSheetModalScreen,
    extra?: {
      inputValue?: string;
      nextScanFor?: 'enter-addr' | 'add-new-whitelist-addr';
      viewingHistoryTxData?: HistoryLocalDetailParams;
    },
  ) => void;
  fnCloseModal: () => void;
  /** @deprecated */
  cbOnScanStageChanged: (stage: 'start' | 'end') => void;
  cbOnSelectedAccount: (account: Account | null) => void;

  computed: {
    canNavBack: boolean;
    needShowHistory: boolean;
  };
};
const AccountSelectModalContext =
  React.createContext<SelectAccountSheetModalValues>({
    __isUnderContext__: false,
    modalScreen: 'default',
    viewingHistoryTxData: null,
    nextScanFor: null,

    fnNavTo: getNoop(),
    fnCloseModal: getNoop(),
    cbOnScanStageChanged: getNoop(),
    cbOnSelectedAccount: getNoop(),

    computed: {
      canNavBack: false,
      needShowHistory: false,
    },
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

export function useIsUnderAccountSelectModalContext() {
  try {
    return React.useContext(AccountSelectModalContext).__isUnderContext__;
  } catch (e) {
    return false;
  }
}

export function useAccountSelectModalCtx() {
  useDevWarningMustBeInContext();
  const values = React.useContext(AccountSelectModalContext);

  return {
    isUnderContext: values.__isUnderContext__,
    currentScreen: values.modalScreen,
    viewingHistoryTxData: values.viewingHistoryTxData,
    nextScanFor: values.nextScanFor,
    fnNavTo: values.fnNavTo,
    fnCloseModal: values.fnCloseModal,
    cbOnScanStageChanged: values.cbOnScanStageChanged,
    cbOnSelectedAccount: values.cbOnSelectedAccount,
    canNavBack: values.computed.canNavBack,
    needShowHistory: values.computed.needShowHistory,
  };
}

export const useAlertAddress = (address: string, onConfirm: () => void) => {
  const { t } = useTranslation();
  const { isAddrOnWhitelist } = useWhitelist({
    disableAutoFetch: false,
  });
  useEffect(() => {
    if (address && isValidHexAddress(address as Hex)) {
      if (isAddrOnWhitelist(address)) {
        const aliasName =
          contactService.getAliasByAddress(address)?.alias || '';
        Alert.alert(
          t('page.whitelist.alreadyInYour'),
          `${address}` + (aliasName ? ` (${aliasName})` : ''),
          [{ text: t('global.ok'), onPress: onConfirm }],
        );
      }
    }
  }, [address, isAddrOnWhitelist, onConfirm, t]);
};

const newlyAddedWhitelistAtom = atomByMMKV<
  Record<
    string,
    {
      addTime: number;
    }
  >
>('@newlyAddedWhitelist', {});

export function useRecordWhitelistAddTime() {
  const [newlyAddedWhitelist, setNewlyAddedWhitelist] = useAtom(
    newlyAddedWhitelistAtom,
  );

  const recordAddTime = React.useCallback(
    (address: string) => {
      setNewlyAddedWhitelist(prev => ({
        ...prev,
        [address]: { addTime: Date.now() },
      }));
    },
    [setNewlyAddedWhitelist],
  );

  return {
    recordAddTime,
    newlyAddedWhitelist,
  };
}

export function useSortWhitelistByAddTime<
  T extends string | { address: string },
>(whitelist: T[]) {
  const [newlyAddedWhitelist] = useAtom(newlyAddedWhitelistAtom);

  const sortedList = React.useMemo(() => {
    return [...whitelist].sort((a, b) => {
      const addrA = typeof a === 'string' ? a : a.address;
      const addrB = typeof b === 'string' ? b : b.address;

      const timeA = newlyAddedWhitelist[addrA]?.addTime || 0;
      const timeB = newlyAddedWhitelist[addrB]?.addTime || 0;

      if (timeA && timeB) {
        return timeB - timeA; // Both have addTime, sort by addTime descending
      } else if (timeA) {
        return -1; // Only A has addTime, A comes first
      } else if (timeB) {
        return 1; // Only B has addTime, B comes first
      } else {
        return 0; // Neither has addTime, maintain original order
      }
    });
  }, [newlyAddedWhitelist, whitelist]);

  return sortedList;
}

/** @deprecated */
export const modalScannerEvents = new EventEmitter();
export const enum ModalScannerEventType {
  scanned = 'scanned',
}

export function onModalScannerEvent(
  type: ModalScannerEventType,
  callback: (ctx: { data: string }) => void,
) {
  modalScannerEvents.addListener(type, callback);
  return () => {
    modalScannerEvents.removeListener(type, callback);
  };
}
