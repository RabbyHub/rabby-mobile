import {
  RcIconKeychainFaceIdCC,
  RcIconKeychainFingerprintCC,
} from '@/assets/icons/lock';
import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { useAuthenticationModal } from '@/components/AuthenticationModal/hooks';
import { isSelfhostRegPkg } from '@/constant/env';
import { apisLock } from '@/core/apis';
import { unlockTimeEvent, updateUnlockTime } from '@/core/apis/lock';
import { useBiometrics } from '@/hooks/biometrics';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { usePasswordStatus } from '@/hooks/useLock';
import { atom, useAtom } from 'jotai';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const DEFAULT_VERIFY_INTERVAL = isSelfhostRegPkg
  ? 1000 * 60 * 1 // 1 minute
  : 1000 * 60 * 10; // 10 minutes

const unlockTimeAtom = atom(0);
unlockTimeAtom.onMount = setter => {
  unlockTimeEvent.addListener('updated', value => {
    setter(value);
  });
};

const RcIconFaceId = makeThemeIconFromCC(
  RcIconKeychainFaceIdCC,
  'neutral-body',
);
const RcIconFingerprint = makeThemeIconFromCC(
  RcIconKeychainFingerprintCC,
  'neutral-body',
);

export const useSubmitAction = () => {
  const { t } = useTranslation();
  const { computed: bioComputed } = useBiometrics();
  const { isUseCustomPwd } = usePasswordStatus();
  const signComputed = useMemo(() => {
    return {
      needShowBioAuthIcon: bioComputed.isBiometricsEnabled,
      SubmitIcon: !bioComputed.isBiometricsEnabled
        ? null
        : bioComputed.isFaceID
        ? RcIconFaceId
        : RcIconFingerprint,
    };
  }, [bioComputed]);

  const [unlockTime, setUnlockTime] = useAtom(unlockTimeAtom);

  React.useEffect(() => {
    setUnlockTime(apisLock.getUnlockTime());
  }, [setUnlockTime]);

  const isLastUnlockTimeValid =
    Date.now() - unlockTime < DEFAULT_VERIFY_INTERVAL;
  const disabledVerify =
    isLastUnlockTimeValid ||
    (!isUseCustomPwd && !bioComputed.isBiometricsEnabled);

  const {
    currentAuthType,
    handleAuthWithBiometrics,
    prepareBioAuth,
    updateAuthType,
  } = useAuthenticationModal({
    authTypes: ['biometrics', 'password'],
  });
  const onPress = React.useCallback(
    async (onFinished: () => void, onCancel: () => void) => {
      // avoid multiple click
      const handleFinished = () => {
        updateUnlockTime();
        onFinished();
      };

      // reset auth type to biometrics
      const handleCancel = () => {
        updateAuthType('biometrics');
        onCancel();
      };

      // avoid multiple click
      if (disabledVerify) {
        onFinished();
        return;
      }

      // use password to verify
      const handleAuthWithPassword = () => {
        AuthenticationModal.show({
          title: t('page.signFooterBar.confirmWithPassword'),
          onFinished: handleFinished,
          onCancel: handleCancel,
          authType: ['password'],
        });
      };
      if (currentAuthType === 'biometrics') {
        prepareBioAuth();
        return handleAuthWithBiometrics().then(result => {
          if (result.success) {
            return handleFinished();
          }
          handleAuthWithPassword();
        });
      }
      handleAuthWithPassword();
    },
    [
      disabledVerify,
      currentAuthType,
      updateAuthType,
      t,
      prepareBioAuth,
      handleAuthWithBiometrics,
    ],
  );

  return {
    submitText:
      disabledVerify || bioComputed.isBiometricsEnabled
        ? t('page.signFooterBar.confirm')
        : t('page.signFooterBar.confirmWithPassword'),
    SubmitIcon: !disabledVerify && signComputed.SubmitIcon,
    onPress,
  };
};
