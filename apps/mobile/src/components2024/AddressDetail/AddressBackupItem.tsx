import React, { useCallback } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { KeyringAccountWithAlias, useBackupReminder } from '@/hooks/account';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { navigateDeprecated } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { useTranslation } from 'react-i18next';
import { apiPrivateKey } from '@/core/apis';
import { useEnterPassphraseModal } from '@/hooks/useEnterPassphraseModal';
import { createGetStyles2024 } from '@/utils/styles';
import { Card } from '../Card';
import { Item } from './Item';
import { AuthenticationModal2024 } from '@/components/AuthenticationModal/AuthenticationModal2024';
import { BackupBadge } from './BackupBadge';
import ArrowSVG from '@/assets2024/icons/common/arrow-right-cc.svg';
import { Text } from '@/components/Typography';

interface AddressInfoProps {
  account: KeyringAccountWithAlias;
  onCancel: () => void;
}

export const AddressBackupItem: React.FC<AddressInfoProps> = props => {
  const { account, onCancel } = props;
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const invokeEnterPassphrase = useEnterPassphraseModal('address');
  const needsBackupReminder = useBackupReminder(account);

  const handlePressBackupPrivateKey = useCallback(() => {
    let data = '';

    AuthenticationModal2024.show({
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
        navigateDeprecated(RootNames.StackAddress, {
          screen: RootNames.BackupPrivateKey,
          params: {
            data,
          },
        });
      },
    });
  }, [account.address, account.type, invokeEnterPassphrase, onCancel, t]);

  const handlePressBackupSeedPhrase = useCallback(() => {
    // Navigate to Backup screen directly
    // The Backup screen will handle authentication internally when user selects an option
    navigateDeprecated(RootNames.StackAddress, {
      screen: RootNames.Backup,
      params: {
        address: account.address,
        type: account.type,
        brandName: account.brandName,
      },
    });
  }, [account.address, account.type, account.brandName]);

  if (
    account.type !== KEYRING_TYPE.HdKeyring &&
    account.type !== KEYRING_TYPE.SimpleKeyring
  ) {
    return null;
  }

  return (
    <Card style={styles.card}>
      {account.type === KEYRING_TYPE.HdKeyring && (
        <TouchableOpacity
          style={styles.itemRow}
          onPress={handlePressBackupSeedPhrase}>
          <Text style={styles.labelText}>
            {t('page.addressDetail.backup-seed-phrase')}
          </Text>
          <View style={styles.valueView}>
            {needsBackupReminder && <BackupBadge />}
            <ArrowSVG
              color={colors2024['neutral-foot']}
              width={16}
              height={16}
            />
          </View>
        </TouchableOpacity>
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
    width: 'auto',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  labelText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    lineHeight: 20,
  },
  valueView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
}));
