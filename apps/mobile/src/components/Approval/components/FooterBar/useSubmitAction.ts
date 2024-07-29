import {
  RcIconKeychainFaceIdCC,
  RcIconKeychainFingerprintCC,
} from '@/assets/icons/lock';
import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { apisLock } from '@/core/apis';
import { useBiometricsComputed } from '@/hooks/biometrics';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

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

  const bioCompuated = useBiometricsComputed();

  const signComputed = useMemo(() => {
    return {
      needShowBioAuthIcon: bioCompuated.isBiometricsEnabled,
      SubmitIcon: !bioCompuated.isBiometricsEnabled
        ? null
        : bioCompuated.isFaceID
        ? RcIconFaceId
        : RcIconFingerprint,
    };
  }, [bioCompuated]);

  const onPress = React.useCallback(
    (onFinished: () => void, onCancel: () => void) => {
      AuthenticationModal.show({
        title: t('page.signFooterBar.confirmWithPassword'),
        onFinished,
        // onCancel,
      });
    },
    [t],
  );

  return {
    submitText: t('page.signFooterBar.confirm'),
    needShowBioAuthIcon: signComputed.needShowBioAuthIcon,
    SubmitIcon: signComputed.SubmitIcon,
    onPress,
  };
};
