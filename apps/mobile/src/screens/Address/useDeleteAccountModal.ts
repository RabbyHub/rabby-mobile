import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { apiMnemonic, apisLock } from '@/core/apis';
import { keyringService } from '@/core/services';
import { KeyringAccountWithAlias, useRemoveAccount } from '@/hooks/account';
import { useEnterPassphraseModal } from '@/hooks/useEnterPassphraseModal';
import { redirectToAddAddressEntry } from '@/utils/navigation';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useMemoizedFn } from 'ahooks';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { trigger } from 'react-native-haptic-feedback';

export const useDeleteAccountModal = () => {
  const { t } = useTranslation();
  const invokeEnterPassphrase = useEnterPassphraseModal('address');
  const removeAccount = useRemoveAccount();

  const handleShouldGoStartPage = useMemoizedFn(async () => {
    const hasAccountsInKeyring =
      (await keyringService.getCountOfAccountsInKeyring()) > 0;
    if (!hasAccountsInKeyring) {
      redirectToAddAddressEntry({
        action: 'resetTo',
      });
    }
  });

  const handlePresentDeleteModalPress = useCallback(
    async ({
      account,
      onFinished,
      autoConfirm = false,
    }: {
      account: KeyringAccountWithAlias;
      autoConfirm?: boolean;
      onFinished?: () => void;
    }) => {
      trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      const count =
        account.type === KEYRING_TYPE.HdKeyring
          ? (await apiMnemonic.getKeyringAccountsByAddress(account.address))
              .length
          : 1;
      const title =
        account.type === KEYRING_TYPE.SimpleKeyring
          ? 'Delete Wallet and Private Key'
          : account.type === KEYRING_TYPE.HdKeyring && count <= 1
          ? 'Delete Wallet and Seed Phrase'
          : 'Delete Wallet';
      const needAuth =
        account.type === KEYRING_TYPE.SimpleKeyring ||
        (account.type === KEYRING_TYPE.HdKeyring && count <= 1);

      AuthenticationModal.show({
        confirmText: t('page.manageAddress.confirm'),
        cancelText: t('page.manageAddress.cancel'),
        title,
        description: needAuth
          ? t('page.addressDetail.delete-desc-needpassword')
          : t('page.addressDetail.delete-desc'),
        checklist: needAuth
          ? [
              t('page.manageAddress.delete-checklist-1'),
              t('page.manageAddress.delete-checklist-2'),
            ]
          : undefined,
        ...(!needAuth
          ? { authType: ['none'] }
          : { authType: ['biometrics', 'password'] }),
        onFinished: async () => {
          trigger('impactLight', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
          await removeAccount(account);
          await handleShouldGoStartPage();
          onFinished?.();
        },
        validationHandler: async (password: string) => {
          await apisLock.throwErrorIfInvalidPwd(password);

          if (account.type === KEYRING_TYPE.HdKeyring) {
            await invokeEnterPassphrase(account.address);
          }
        },
      });
    },
    [invokeEnterPassphrase, removeAccount, t, handleShouldGoStartPage],
  );

  return handlePresentDeleteModalPress;
};
