import React, { useCallback } from 'react';
import { atom, useAtomValue } from 'jotai';

import { useSheetModals } from '@/hooks/useSheetModal';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useWalletLockInfo } from './useManagePassword';
import { PasswordStatus } from '@/core/apis/lock';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import { StackActions } from '@react-navigation/native';
import { apisLock } from '@/core/apis';
import { toast } from '@/components/Toast';

const sheetModalRefAtom = atom({
  setupPasswordModalRef: React.createRef<BottomSheetModal>(),
  clearPasswordModalRef: React.createRef<BottomSheetModal>(),
});

export function useSheetModalsForManagingPassword() {
  const sheetModals = useAtomValue(sheetModalRefAtom);

  return useSheetModals(sheetModals);
}

export function useManagePasswordOnSettings() {
  const { toggleShowSheetModal } = useSheetModalsForManagingPassword();
  const navigation = useRabbyAppNavigation();

  const { lockInfo } = useWalletLockInfo();
  const openManagePasswordSheetModal = useCallback(() => {
    if (lockInfo.pwdStatus === PasswordStatus.Custom) {
      toggleShowSheetModal('clearPasswordModalRef', true);
    } else {
      // toggleShowSheetModal('setupPasswordModalRef', true);

      navigation.dispatch(
        StackActions.push(RootNames.StackSettings, {
          screen: RootNames.SetPassword,
          params: {
            source: 'settings',
          },
        }),
      );
    }
  }, [toggleShowSheetModal, navigation, lockInfo.pwdStatus]);

  const hasSetupCustomPassword = lockInfo.pwdStatus === PasswordStatus.Custom;

  const requestLockWallet = useCallback(async () => {
    if (!hasSetupCustomPassword) return;

    try {
      await apisLock.lockWallet();
      navigation.dispatch(StackActions.replace(RootNames.Unlock));
    } catch (error: any) {
      toast.show(error?.message || 'Lock Wallet failed');
    }
  }, [hasSetupCustomPassword, navigation]);

  return {
    hasSetupCustomPassword,
    requestLockWallet,
    openManagePasswordSheetModal,
  };
}
