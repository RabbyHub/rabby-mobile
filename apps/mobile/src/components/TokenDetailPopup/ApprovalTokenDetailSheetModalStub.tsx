import { useSheetModal, useSheetModals } from '@/hooks/useSheetModal';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import React, { useCallback } from 'react';
import { BottomSheetModalTokenDetail } from './BottomSheetModalTokenDetail';
import { atom, useAtom } from 'jotai';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';

const popups = {
  generalTokenDetailPopup: {
    atom: atom(null as AbstractPortfolioToken | null),
    ref: React.createRef<BottomSheetModalMethods>(),
  },
  tokenDetailPopupOnSendToken: {
    atom: atom(null as AbstractPortfolioToken | null),
    ref: React.createRef<BottomSheetModalMethods>(),
  },
};

export function useGeneralTokenDetailSheetModal() {
  const [focusingToken, onFocusToken] = useAtom(
    popups.generalTokenDetailPopup.atom,
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

  return {
    focusingToken,
    sheetModalRef,
    openTokenDetailPopup,
    cleanFocusingToken,
  };
}

export function useTokenDetailSheetModalOnApprovals() {
  const [focusingToken, onFocusToken] = useAtom(
    popups.tokenDetailPopupOnSendToken.atom,
  );
  const { sheetModalRef, toggleShowSheetModal } = useSheetModal(
    popups.tokenDetailPopupOnSendToken.ref,
  );

  const openTokenDetailPopup = useCallback(
    (token: TokenItem | AbstractPortfolioToken) => {
      onFocusToken(ensureAbstractPortfolioToken(token));
      toggleShowSheetModal(true);
    },
    [onFocusToken, toggleShowSheetModal],
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
  };
}

export default function ApprovalTokenDetailSheetModalStub() {
  const { focusingToken, onFocusToken, sheetModalRef, cleanFocusingToken } =
    useTokenDetailSheetModalOnApprovals();

  return (
    <>
      <BottomSheetModalTokenDetail
        canClickToken={false}
        hideOperationButtons
        ref={sheetModalRef}
        token={focusingToken}
        onDismiss={() => {
          onFocusToken(null);
        }}
      />
    </>
  );
}
