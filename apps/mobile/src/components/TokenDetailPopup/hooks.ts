import { findChain } from '@/utils/chain';
import { useSheetModal } from '@/hooks/useSheetModal';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import React, { useCallback, useMemo } from 'react';
import { atom, useAtom } from 'jotai';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { Account } from '@/core/services/preference';

const popups = {
  generalTokenDetailPopup: {
    atom: atom(null as AbstractPortfolioToken | null),
    ref: React.createRef<BottomSheetModalMethods>(),
  },
  tokenDetailPopupUseAccount: {
    atom: atom(undefined as KeyringAccountWithAlias | undefined),
    ref: React.createRef<BottomSheetModalMethods>(),
  },
  tokenDetailPopupOnSendToken: {
    atom: atom(null as AbstractPortfolioToken | null),
    accountAtom: atom(null as Account | null | undefined),
    ref: React.createRef<BottomSheetModalMethods>(),
  },
};

export function useGeneralTokenDetailSheetModal() {
  const [focusingToken, onFocusToken] = useAtom(
    popups.generalTokenDetailPopup.atom,
  );
  const [tokenDetailAddress, setTokenDetailAddress] = useAtom(
    popups.tokenDetailPopupUseAccount.atom,
  );
  const { sheetModalRef, toggleShowSheetModal } = useSheetModal(
    popups.generalTokenDetailPopup.ref,
  );

  const openTokenDetailPopup = useCallback(
    (token: TokenItem | AbstractPortfolioToken) => {
      onFocusToken(ensureAbstractPortfolioToken(token));
      toggleShowSheetModal(true);
    },
    [onFocusToken, toggleShowSheetModal],
  );

  const cleanFocusingToken = useCallback(
    (options?: { noNeedCloseModal?: boolean }) => {
      if (!options?.noNeedCloseModal) toggleShowSheetModal(false);

      onFocusToken(null);
    },
    [onFocusToken, toggleShowSheetModal],
  );

  const isTestnetToken = useMemo(() => {
    if (!focusingToken) {
      return false;
    }
    return (
      findChain({
        serverId: focusingToken.chain,
      })?.isTestnet || false
    );
  }, [focusingToken]);

  return {
    focusingToken,
    sheetModalRef,
    openTokenDetailPopup,
    cleanFocusingToken,
    isTestnetToken,
    setTokenDetailAddress,
    tokenDetailAddress,
  };
}

export function useTokenDetailSheetModalOnApprovals() {
  const [focusingToken, onFocusToken] = useAtom(
    popups.tokenDetailPopupOnSendToken.atom,
  );
  const { sheetModalRef, toggleShowSheetModal } = useSheetModal(
    popups.tokenDetailPopupOnSendToken.ref,
  );

  const [selectedAccount, setSelectedAccount] = useAtom(
    popups.tokenDetailPopupOnSendToken.accountAtom,
  );

  const openTokenDetailPopup = useCallback(
    (token: TokenItem | AbstractPortfolioToken, account?: Account) => {
      setSelectedAccount(account);
      onFocusToken(ensureAbstractPortfolioToken(token));
      toggleShowSheetModal(true);
    },
    [onFocusToken, setSelectedAccount, toggleShowSheetModal],
  );

  const cleanFocusingToken = useCallback(() => {
    toggleShowSheetModal(false);
    onFocusToken(null);
  }, [onFocusToken, toggleShowSheetModal]);

  return {
    onFocusToken,
    focusingToken,
    sheetModalRef,
    openTokenDetailPopup,
    cleanFocusingToken,
    selectedAccount,
  };
}
