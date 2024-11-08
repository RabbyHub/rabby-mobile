import {
  decryptFiles,
  detectCloudIsAvailable,
  getBackupsFromCloud,
  saveMnemonicToCloud,
} from '@/core/utils/cloudBackup';
import React from 'react';
import { View } from 'react-native';
import { BackupUnlockScreen } from './BackupUnlockScreen';
import { toast } from '../Toast';
import { useTranslation } from 'react-i18next';
import { activeAndPersistAccountsByMnemonics } from '@/core/apis/mnemonic';
import { keyringService } from '@/core/services';
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { KEYRING_CLASS, KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

interface Props {
  onDone: (isNoMnemonic?: boolean) => void;
  paramState: {
    address: string;
    alias: string;
    seedPhrase: string;
    accountsToCreate: any;
  };
}

export const SeedPhraseBackupToCloud: React.FC<Props> = ({
  onDone,
  paramState,
}) => {
  const { seedPhrase, alias, address, accountsToCreate } = paramState;
  const { t } = useTranslation();
  const handleUpload = React.useCallback(
    async password => {
      if (!password) {
        toast.show('must have password');
        return;
      }

      try {
        const filename = await saveMnemonicToCloud({
          mnemonic: seedPhrase,
          password,
        });
        // check if the mnemonic is uploaded successfully
        const files = await getBackupsFromCloud([filename]);
        await decryptFiles({ password, files });
        toast.show('Backup Successful');
        onDone();
        const mnemonics = seedPhrase;
        const passphrase = '';
        await activeAndPersistAccountsByMnemonics(
          mnemonics,
          passphrase,
          accountsToCreate as any,
          false,
        );
        keyringService.removePreMnemonics();
        navigate(RootNames.StackAddress, {
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
        toast.show(t('page.newAddress.seedPhrase.backupFailedTitle'));
      }
    },
    [onDone, t, seedPhrase, address, alias, accountsToCreate],
  );

  React.useEffect(() => {
    detectCloudIsAvailable().then(isAvailable => {
      if (!isAvailable) {
        // setStep('backup_not_available');
        toast.show(
          t('page.newAddress.seedPhrase.backupErrorCloudNotAvailable'),
        );
        onDone();
      }
    });
  }, [onDone, t]);

  return (
    <View>
      <BackupUnlockScreen onConfirm={handleUpload} />
      {/* {step === 'backup_uploading' && <BackupUploadScreen />}
      {step === 'backup_success' && <BackupSuccessScreen />}
      {step === 'backup_error' && (
        <BackupErrorScreen onConfirm={() => handleUpload(inputPassword)} />
      )}
      {step === 'backup_not_available' && (
        <BackupNotAvailableScreen onConfirm={onDone} />
      )} */}
    </View>
  );
};
