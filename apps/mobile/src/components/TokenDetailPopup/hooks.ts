import { findChain } from '@/utils/chain';
import { useSheetModal } from '@/hooks/useSheetModal';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import React, { useCallback, useMemo } from 'react';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { AbstractPortfolioToken } from '@/screens/Home/types';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { Account } from '@/core/services/preference';
import { zCreate } from '@/core/utils/reexports';
import { UpdaterOrPartials, resolveValFromUpdater } from '@/core/utils/store';

// Zustand stores for general token detail popup
const generalTokenDetailPopupStore = zCreate<{
  focusingToken: AbstractPortfolioToken | null;
}>(() => ({
  focusingToken: null,
}));

const tokenDetailPopupUseAccountStore = zCreate<{
  tokenDetailAddress: KeyringAccountWithAlias | undefined;
}>(() => ({
  tokenDetailAddress: undefined,
}));

const tokenDetailPopupOnSendTokenStore = zCreate<{
  focusingToken: AbstractPortfolioToken | null;
  selectedAccount: Account | null | undefined;
}>(() => ({
  focusingToken: null,
  selectedAccount: null,
}));

function setGeneralTokenDetailPopupFocusingToken(
  valOrFunc: UpdaterOrPartials<AbstractPortfolioToken | null>,
) {
  generalTokenDetailPopupStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.focusingToken, valOrFunc);
    return { ...prev, focusingToken: newVal };
  });
}

function setTokenDetailPopupUseAccountAddress(
  valOrFunc: UpdaterOrPartials<KeyringAccountWithAlias | undefined>,
) {
  tokenDetailPopupUseAccountStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(
      prev.tokenDetailAddress,
      valOrFunc,
    );
    return { ...prev, tokenDetailAddress: newVal };
  });
}

function setTokenDetailPopupOnSendTokenFocusingToken(
  valOrFunc: UpdaterOrPartials<AbstractPortfolioToken | null>,
) {
  tokenDetailPopupOnSendTokenStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.focusingToken, valOrFunc);
    return { ...prev, focusingToken: newVal };
  });
}

function setTokenDetailPopupOnSendTokenSelectedAccount(
  valOrFunc: UpdaterOrPartials<Account | null | undefined>,
) {
  tokenDetailPopupOnSendTokenStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.selectedAccount, valOrFunc);
    return { ...prev, selectedAccount: newVal };
  });
}

const popups = {
  generalTokenDetailPopup: {
    ref: React.createRef<BottomSheetModalMethods>(),
  },
  tokenDetailPopupUseAccount: {
    ref: React.createRef<BottomSheetModalMethods>(),
  },
  tokenDetailPopupOnSendToken: {
    ref: React.createRef<BottomSheetModalMethods>(),
  },
};

export function useGeneralTokenDetailSheetModal() {
  const { focusingToken } = generalTokenDetailPopupStore();
  const { tokenDetailAddress } = tokenDetailPopupUseAccountStore();
  const { sheetModalRef, toggleShowSheetModal } = useSheetModal(
    popups.generalTokenDetailPopup.ref,
  );

  const onFocusToken = useCallback((token: AbstractPortfolioToken | null) => {
    setGeneralTokenDetailPopupFocusingToken(token);
  }, []);

  const setTokenDetailAddress = useCallback(
    (address: KeyringAccountWithAlias | undefined) => {
      setTokenDetailPopupUseAccountAddress(address);
    },
    [],
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
  const { focusingToken, selectedAccount } = tokenDetailPopupOnSendTokenStore();
  const { sheetModalRef, toggleShowSheetModal } = useSheetModal(
    popups.tokenDetailPopupOnSendToken.ref,
  );

  const onFocusToken = useCallback((token: AbstractPortfolioToken | null) => {
    setTokenDetailPopupOnSendTokenFocusingToken(token);
  }, []);

  const setSelectedAccount = useCallback(
    (account: Account | null | undefined) => {
      setTokenDetailPopupOnSendTokenSelectedAccount(account);
    },
    [],
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
