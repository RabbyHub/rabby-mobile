import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { apiMnemonic } from '@/core/apis';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const useEnterPassphraseModal = (type: 'address' | 'publickey') => {
  const { t } = useTranslation();

  const invoke = React.useCallback(
    async (value?: string) => {
      let passphrase: string | undefined = '';

      if (!value) {
        return '';
      }

      const needPassphrase =
        await apiMnemonic.getMnemonicKeyringIfNeedPassphrase(type, value);
      passphrase = await apiMnemonic.getMnemonicKeyringPassphrase(type, value);

      if (!needPassphrase || passphrase) {
        return passphrase;
      }

      // @ts-expect-error FIXME: fix this error type, maybe we should use `AuthenticationModal.show` instead
      await AuthenticationModal({
        confirmText: t('global.confirm'),
        cancelText: t('global.Cancel'),
        placeholder: t('page.manageAddress.enterThePassphrase'),
        title: t('page.manageAddress.enterPassphraseTitle'),
        async validationHandler(input) {
          passphrase = input;

          if (
            !(await apiMnemonic.checkPassphraseBelongToMnemonic(
              type,
              value,
              passphrase,
            ))
          ) {
            throw new Error(t('page.manageAddress.passphraseError'));
          }
          return;
        },
      });

      return passphrase;
    },
    [t, type],
  );

  return invoke;
};
