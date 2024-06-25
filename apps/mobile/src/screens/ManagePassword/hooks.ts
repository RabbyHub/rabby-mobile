import React, { useCallback } from 'react';
import { atom, useAtomValue } from 'jotai';

import { useSheetModals } from '@/hooks/useSheetModal';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useWalletPasswordInfo } from './useManagePassword';
import { PasswordStatus } from '@/core/apis/lock';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import { StackActions } from '@react-navigation/native';
import { apisLock } from '@/core/apis';
import { toast } from '@/components/Toast';
import { useBiometrics } from '@/hooks/biometrics';
import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { strings } from '@/utils/i18n';

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

  const { hasSetupCustomPassword, lockInfo } = useWalletPasswordInfo();
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

export function useBiometricsOnSettings() {
  const { biometrics, requestToggleBiometricsEnabled } = useBiometrics();

  const navigation = useRabbyAppNavigation();
  const redirectToEnableBiometricsAuthentication = useCallback(() => {
    if (!biometrics.authEnabled) {
      navigation.push(RootNames.StackSettings, {
        screen: RootNames.SetBiometricsAuthentication,
        params: {},
      });
    } else {
      // TODO: validate biometrics and cancel biometrics
    }
  }, [biometrics.authEnabled, navigation]);

  return {
    authEnabled: biometrics.authEnabled,
    requestToggleBiometricsEnabled,
    redirectToEnableBiometricsAuthentication,
  };
}
