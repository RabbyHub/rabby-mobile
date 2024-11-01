import { apiMnemonic } from '@/core/apis';
import {
  decryptFiles,
  detectCloudIsAvailable,
  getBackupsFromCloud,
  saveMnemonicToCloud,
} from '@/core/utils/cloudBackup';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { BackupUnlockScreen } from './BackupUnlockScreen';
import { toast, toastWithIcon } from '../Toast';
import { useTranslation } from 'react-i18next';

interface Props {
  onDone: (isNoMnemonic?: boolean) => void;
  paramState: {
    address: string;
    alias: string;
    seedPhrase: string;
  };
}

export const SeedPhraseBackupToCloud: React.FC<Props> = ({
  onDone,
  paramState,
}) => {
  const { seedPhrase } = paramState;
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
        await apiMnemonic.addMnemonicKeyringAndGotoSuccessScreen(seedPhrase);
        onDone();
      } catch (e) {
        console.log('backup error', e);
        toast.show(t('page.newAddress.seedPhrase.backupFailedTitle'));
      }
    },
    [onDone, t, seedPhrase],
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
