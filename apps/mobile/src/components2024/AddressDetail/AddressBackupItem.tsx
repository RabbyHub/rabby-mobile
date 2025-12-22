import React, { useCallback } from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { navigateDeprecated } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { useTranslation } from 'react-i18next';
import { apiMnemonic, apiPrivateKey } from '@/core/apis';
import { useEnterPassphraseModal } from '@/hooks/useEnterPassphraseModal';
import { createGetStyles2024 } from '@/utils/styles';
import { Card } from '../Card';
import { Item } from './Item';
import { AuthenticationModal2024 } from '@/components/AuthenticationModal/AuthenticationModal2024';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '../GlobalBottomSheetModal';
import { MODAL_NAMES } from '../GlobalBottomSheetModal/types';

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
    let data = '';

    AuthenticationModal2024.show({
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
        // navigateDeprecated(RootNames.StackAddress, {
        //   screen: RootNames.BackupMnemonic,
        //   params: {
        //     data,
        //   },
        // });

        const id = createGlobalBottomSheetModal2024({
          name: MODAL_NAMES.SEED_PHRASE_MANUAL_BACKUP,
          bottomSheetModalProps: {
            enableContentPanningGesture: false,
            enablePanDownToClose: true,
          },
          preventScreenshotOnModalOpen: false,
          readMode: true,
          seedPhraseData: data,
          // screenshotReportFreeBeforeModalClose: true,
          // delaySetPassword: state?.delaySetPassword,
          onDone: () => {
            removeGlobalBottomSheetModal2024(id);
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
    width: 'auto',
  },
}));
