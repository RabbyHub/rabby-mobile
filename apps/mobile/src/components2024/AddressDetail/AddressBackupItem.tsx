import React, { useCallback } from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { AuthenticationModal } from '@/components/AuthenticationModal/AuthenticationModal';
import { useTranslation } from 'react-i18next';
import { apiMnemonic, apiPrivateKey } from '@/core/apis';
import { useEnterPassphraseModal } from '@/hooks/useEnterPassphraseModal';
import { createGetStyles2024 } from '@/utils/styles';
import { Card } from '../Card';
import { Item } from './Item';

interface AddressInfoProps {
  account: KeyringAccountWithAlias;
  onCancel: () => void;
}

export const AddressBackupItem: React.FC<AddressInfoProps> = props => {
  const { account, onCancel } = props;
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const invokeEnterPassphrase = useEnterPassphraseModal('address');

  const handlePressBackupPrivateKey = useCallback(() => {
    let data = '';

    AuthenticationModal.show({
      confirmText: t('global.confirm'),
      cancelText: t('global.Cancel'),
      title: t('page.addressDetail.backup-private-key'),
      validationHandler: async (password: string) => {
        data = await apiPrivateKey.getPrivateKey(password, {
          address: account.address,
          type: account.type,
        });

        if (account.type === KEYRING_TYPE.HdKeyring) {
          await invokeEnterPassphrase(account.address);
        }
      },
      onFinished(ctx) {
        if (ctx.hasSetupCustomPassword && !data) {
          return;
        }
        onCancel();
        navigate(RootNames.StackAddress, {
          screen: RootNames.BackupPrivateKey,
          params: {
            data,
          },
        });
      },
    });
  }, [account.address, account.type, invokeEnterPassphrase, onCancel, t]);

  const handlePressBackupSeedPhrase = useCallback(() => {
    let data = '';

    AuthenticationModal.show({
      confirmText: t('global.confirm'),
      cancelText: t('global.Cancel'),
      title: t('page.addressDetail.backup-seed-phrase'),
      validationHandler: async (password: string) => {
        data = await apiMnemonic.getMnemonics(password, account.address);

        if (account.type === KEYRING_TYPE.HdKeyring) {
          await invokeEnterPassphrase(account.address);
        }
      },
      onFinished(ctx) {
        if (ctx.hasSetupCustomPassword && !data) {
          return;
        }
        onCancel();
        navigate(RootNames.StackAddress, {
          screen: RootNames.BackupMnemonic,
          params: {
            data,
          },
        });
      },
    });
  }, [account.address, account.type, invokeEnterPassphrase, onCancel, t]);

  if (
    account.type !== KEYRING_TYPE.HdKeyring &&
    account.type !== KEYRING_TYPE.SimpleKeyring
  ) {
    return null;
  }

  return (
    <Card style={styles.card}>
      {account.type === KEYRING_TYPE.HdKeyring && (
        <Item
          label={t('page.addressDetail.backup-seed-phrase')}
          showArrow
          onPress={handlePressBackupSeedPhrase}
        />
      )}

      {(account.type === KEYRING_TYPE.SimpleKeyring ||
        account.type === KEYRING_TYPE.HdKeyring) && (
        <Item
          label={t('page.addressDetail.backup-private-key')}
          showArrow
          onPress={handlePressBackupPrivateKey}
        />
      )}
    </Card>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    gap: 24,
    marginHorizontal: 16,
  },
}));
