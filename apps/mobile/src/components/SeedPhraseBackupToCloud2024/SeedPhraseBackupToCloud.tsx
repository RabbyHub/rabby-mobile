import {
  decryptFiles,
  detectCloudIsAvailable,
  getBackupsFromCloud,
  saveMnemonicToCloud,
} from '@/core/utils/cloudBackup';
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { BackupUnlockScreen } from './BackupUnlockScreen';
import { toast } from '@/components2024/Toast';
import { useTranslation } from 'react-i18next';
import { addKeyringAndactiveAndPersistAccounts } from '@/core/apis/mnemonic';
import { keyringService } from '@/core/services';
import { replaceToFirst } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useCreateAddressProc } from '@/hooks/address/useNewUser';
interface Props {
  onDone: () => void;
  delaySetPassword?: boolean;
}

export const SeedPhraseBackupToCloud: React.FC<Props> = ({
  onDone, // close modal
  delaySetPassword,
}) => {
  const { seedPharseData, addressList, confirmPassword } =
    useCreateAddressProc();

  const {
    seedPhrase,
    alias,
    address,
    accountsToCreate = [],
  } = useMemo(() => {
    return {
      seedPhrase: seedPharseData,
      alias: addressList?.[0].aliasName || '',
      address: addressList?.[0].address || '',
      accountsToCreate: addressList || [],
    };
  }, [seedPharseData, addressList]);
  const { t } = useTranslation();
  const handleUpload = React.useCallback(
    async password => {
      if (!password) {
        toast.show('must have password');
        return;
      }

      try {
        if (delaySetPassword) {
          const res = await confirmPassword();
          if (!res) {
            return; // error set password
          }
        }

        const filename = await saveMnemonicToCloud({
          mnemonic: seedPhrase,
          password,
        });
        // check if the mnemonic is uploaded successfully
        const files = await getBackupsFromCloud([filename]);
        await decryptFiles({ password, files });
        toast.success('Backup Successful');

        onDone();
        const mnemonics = seedPhrase;
        const passphrase = '';
        await addKeyringAndactiveAndPersistAccounts(
          mnemonics,
          passphrase,
          accountsToCreate,
          true,
        );
        keyringService.removePreMnemonics();
        replaceToFirst(RootNames.StackAddress, {
          screen: RootNames.ImportSuccess2024,
          params: {
            type: KEYRING_TYPE.HdKeyring,
            brandName: KEYRING_CLASS.MNEMONIC,
            isFirstImport: true,
            isFirstCreate: true,
            address: [address],
            mnemonics,
            passphrase,
            isExistedKR: false,
            alias,
          },
        });
      } catch (e) {
        console.log('backup error', e);
        toast.error(t('page.newAddress.seedPhrase.backupFailedTitle'));
      }
    },
    [
      onDone,
      t,
      seedPhrase,
      address,
      alias,
      accountsToCreate,
      confirmPassword,
      delaySetPassword,
    ],
  );

  React.useEffect(() => {
    detectCloudIsAvailable().then(isAvailable => {
      if (!isAvailable) {
        // setStep('backup_not_available');
        toast.error(
          t('page.newAddress.seedPhrase.backupErrorCloudNotAvailable'),
        );
        onDone();
      }
    });
  }, [onDone, t]);

  return (
    <View>
      <BackupUnlockScreen onConfirm={handleUpload} />
    </View>
  );
};
