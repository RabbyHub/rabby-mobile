import { apiMnemonic } from '@/core/apis';
import {
  decryptFiles,
  detectCloudIsAvailable,
  getBackupsFromCloud,
  saveMnemonicToCloud,
} from '@/core/utils/cloudBackup';
import { useRequest } from 'ahooks';
import React from 'react';
import { View } from 'react-native';
import { BackupErrorScreen } from './BackupErrorScreen';
import { BackupNotAvailableScreen } from './BackupNotAvailableScreen';
import { BackupSuccessScreen } from './BackupSuccessScreen';
import { BackupUnlockScreen } from './BackupUnlockScreen';
import { BackupUploadScreen } from './BackupUploadScreen';

interface Props {
  onDone: (isNoMnemonic?: boolean) => void;
}

export const SeedPhraseBackupToCloud: React.FC<Props> = ({ onDone }) => {
  const { data: mnemonic } = useRequest(async () => {
    const res = await apiMnemonic.getPreMnemonics();
    return res as string;
  });
  const [step, setStep] = React.useState<
    | 'backup_unlock'
    | 'backup_uploading'
    | 'backup_success'
    | 'backup_error'
    | 'backup_not_available'
  >('backup_unlock');
  const [inputPassword, setInputPassword] = React.useState('');

  const handleUpload = React.useCallback(
    async password => {
      setInputPassword(password);

      if (!password) {
        setStep('backup_unlock');
        return;
      }

      if (!mnemonic) {
        console.log('no mnemonic');
        onDone(true);
        return;
      }

      setStep('backup_uploading');

      // upload seedPhrase to cloud
      try {
        const filename = await saveMnemonicToCloud({
          mnemonic,
          password,
        });
        // check if the mnemonic is uploaded successfully
        const files = await getBackupsFromCloud([filename]);
        await decryptFiles({ password, files });

        setStep('backup_success');
        await apiMnemonic.addMnemonicKeyringAndGotoSuccessScreen(mnemonic);
        onDone();
      } catch (e) {
        console.log('backup error', e);
        setStep('backup_error');
      }
    },
    [mnemonic, onDone],
  );

  React.useEffect(() => {
    detectCloudIsAvailable().then(isAvailable => {
      if (!isAvailable) {
        setStep('backup_not_available');
      }
    });
  }, []);

  return (
    <View>
      {step === 'backup_unlock' && (
        <BackupUnlockScreen onConfirm={handleUpload} />
      )}
      {step === 'backup_uploading' && <BackupUploadScreen />}
      {step === 'backup_success' && <BackupSuccessScreen />}
      {step === 'backup_error' && (
        <BackupErrorScreen onConfirm={() => handleUpload(inputPassword)} />
      )}
      {step === 'backup_not_available' && (
        <BackupNotAvailableScreen onConfirm={onDone} />
      )}
    </View>
  );
};
