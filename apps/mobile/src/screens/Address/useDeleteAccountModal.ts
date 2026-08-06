import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { apisLock } from '@/core/apis';
import { keyringServiceApi } from '@/core/serviceApi/keyring';
import {
  storeApiAccounts,
  type KeyringAccountWithAlias,
} from '@/hooks/account';
import { useEnterPassphraseModal } from '@/hooks/useEnterPassphraseModal';
import { refreshHomeBalanceAfterAccountMutation } from '@/store/homeBalanceRefresh';
import { redirectToAddAddressEntry } from '@/utils/navigation';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useMemoizedFn } from 'ahooks';
import { useCallback } from 'react';
import { trigger } from 'react-native-haptic-feedback';
import { ensureWalletUnlockedForAction } from '@/utils/walletUnlock';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { refreshAppLockAccountFlags } from '@/hooks/useLock';
import i18n from '@/utils/i18n';

const getHdKeyringAccountCount = async (address: string) => {
  const keyrings = await keyringServiceApi.getAllTypedVisibleAccounts();
  const keyring = keyrings.find(
    item =>
      item.type === KEYRING_TYPE.HdKeyring &&
      item.accounts.some(account => isSameAddress(account.address, address)),
  );

  return keyring?.accounts.length || 1;
};

export const useDeleteAccountModal = () => {
  const invokeEnterPassphrase = useEnterPassphraseModal('address');

  const handleShouldGoStartPage = useMemoizedFn(async () => {
    const { accountState } = await refreshAppLockAccountFlags();
    if (accountState === 'empty') {
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
          ? await getHdKeyringAccountCount(account.address)
          : 1;
      const title =
        account.type === KEYRING_TYPE.SimpleKeyring
          ? i18n.t('page.manageAddress.delete-private-key-title')
          : account.type === KEYRING_TYPE.HdKeyring && count <= 1
          ? i18n.t('page.manageAddress.delete-seed-phrase-title')
          : i18n.t('page.manageAddress.delete-title');
      const needAuth =
        account.type === KEYRING_TYPE.SimpleKeyring ||
        (account.type === KEYRING_TYPE.HdKeyring && count <= 1);

      AuthenticationModal.show({
        confirmText: i18n.t('page.manageAddress.confirm'),
        cancelText: i18n.t('page.manageAddress.cancel'),
        title,
        description: needAuth
          ? i18n.t('page.addressDetail.delete-desc-needpassword')
          : i18n.t('page.addressDetail.delete-desc'),
        checklist: needAuth
          ? [
              i18n.t('page.manageAddress.delete-checklist-1'),
              i18n.t('page.manageAddress.delete-checklist-2'),
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
          if (
            account.type === KEYRING_TYPE.HdKeyring &&
            !needAuth &&
            !(await ensureWalletUnlockedForAction())
          ) {
            return;
          }
          await storeApiAccounts.removeAccount(account);
          void refreshHomeBalanceAfterAccountMutation().catch(error => {
            console.error(
              '[useDeleteAccountModal] failed to refresh Home balance after deleting account',
              error,
            );
          });
          await handleShouldGoStartPage();
          onFinished?.();
        },
        validationHandler: async (password: string) => {
          await apisLock.verifyPasswordOrUnlock(password);

          if (account.type === KEYRING_TYPE.HdKeyring) {
            await invokeEnterPassphrase(account.address);
          }
        },
      });
    },
    [handleShouldGoStartPage, invokeEnterPassphrase],
  );

  return handlePresentDeleteModalPress;
};
