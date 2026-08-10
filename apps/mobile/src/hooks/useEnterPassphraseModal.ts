import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import * as apiMnemonic from '@/core/apis/mnemonic';
import i18n from '@/utils/i18n';
import React from 'react';

export const useEnterPassphraseModal = (type: 'address' | 'publickey') => {
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
        confirmText: i18n.t('global.confirm'),
        cancelText: i18n.t('global.Cancel'),
        placeholder: i18n.t('page.manageAddress.enterThePassphrase'),
        title: i18n.t('page.manageAddress.enterPassphraseTitle'),
        async validationHandler(input) {
          passphrase = input;

          if (
            !(await apiMnemonic.checkPassphraseBelongToMnemonic(
              type,
              value,
              passphrase,
            ))
          ) {
            throw new Error(i18n.t('page.manageAddress.passphraseError'));
          }
          return;
        },
      });

      return passphrase;
    },
    [type],
  );

  return invoke;
};
