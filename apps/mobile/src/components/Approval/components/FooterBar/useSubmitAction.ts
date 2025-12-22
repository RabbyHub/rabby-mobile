import {
  RcIconKeychainFaceIdCC,
  RcIconKeychainFingerprintCC,
  RcIconPasswordCC,
} from '@/assets/icons/lock';
import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { useAuthenticationModal } from '@/components/AuthenticationModal/hooks';
import { isNonPublicProductionEnv } from '@/constant';
import { apisLock } from '@/core/apis';
import { unlockTimeEvent, updateUnlockTime } from '@/core/apis/lock';
import { zCreate } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { useBiometrics } from '@/hooks/biometrics';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { usePasswordStatus } from '@/hooks/useLock';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const DEFAULT_VERIFY_INTERVAL = isNonPublicProductionEnv
  ? 1000 * 60 * 1 // 1 minute
  : 1000 * 60 * 10; // 10 minutes

const unlockTimeState = zCreate<number>(() => 0);
function setUnlockTime(valOrFunc: UpdaterOrPartials<number>) {
  unlockTimeState.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc);
    return newVal;
  });
}
runIIFEFunc(() => {
  unlockTimeEvent.addListener('updated', value => {
    unlockTimeState.setState(value);
  });
});

const RcIconFaceId = makeThemeIconFromCC(
  RcIconKeychainFaceIdCC,
  'neutral-body',
);
const RcIconFingerprint = makeThemeIconFromCC(
  RcIconKeychainFingerprintCC,
  'neutral-body',
);

const RcIconPassword = makeThemeIconFromCC(RcIconPasswordCC, 'neutral-body');

export const useSubmitAction = ({
  useLastUnlockedAuth = true,
}: {
  /**
   * @description whether to use last unlock time to skip verification
   * @default true
   */
  useLastUnlockedAuth?: boolean;
} = {}) => {
  const { t } = useTranslation();
  const { computed: bioComputed } = useBiometrics();
  const { isUseCustomPwd } = usePasswordStatus();

  const unlockTime = unlockTimeState();

  const isInAuthSession = Date.now() - unlockTime < DEFAULT_VERIFY_INTERVAL;
  const isLastUnlockTimeValid = !!useLastUnlockedAuth && isInAuthSession;

  const disabledVerify =
    isLastUnlockTimeValid ||
    (!isUseCustomPwd && !bioComputed.isBiometricsEnabled);

  const signComputed = useMemo(() => {
    return {
      needShowBioAuthIcon: bioComputed.isBiometricsEnabled,
      SubmitIcon: !bioComputed.isBiometricsEnabled
        ? !disabledVerify
          ? RcIconPassword
          : null
        : bioComputed.isFaceID
        ? RcIconFaceId
        : RcIconFingerprint,
    };
  }, [bioComputed.isBiometricsEnabled, bioComputed.isFaceID, disabledVerify]);

  React.useEffect(() => {
    setUnlockTime(apisLock.getUnlockTime());
  }, []);

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
