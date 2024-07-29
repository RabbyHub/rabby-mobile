import { RcIconFingerprint } from '@/assets/icons/settings';
import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const useSubmitAction = () => {
  const { t } = useTranslation();

  const onPress = React.useCallback(
    (onFinished, onCancel) => {
      AuthenticationModal.show({
        title: t('page.signFooterBar.confirmWithPassword'),
        onFinished,
        onCancel,
      });
    },
    [t],
  );

  return {
    submitText: t('page.signFooterBar.confirm'),
    SubmitIcon: RcIconFingerprint,
    onPress,
  };
};
