import { apiMnemonic } from '@/core/apis';
import { saveMnemonicToCloud } from '@/core/utils/cloudBackup';
import { useRequest } from 'ahooks';
import React from 'react';
import { View } from 'react-native';
import { BackupErrorScreen } from './BackupErrorScreen';
import { BackupSuccessScreen } from './BackupSuccessScreen';
import { BackupUnlockScreen } from './BackupUnlockScreen';
import { BackupUploadScreen } from './BackupUploadScreen';

export const SeedPhraseBackupToCloud = ({ onDone }) => {
  const { data: mnemonic } = useRequest(async () => {
    const res = await apiMnemonic.getPreMnemonics();
    return res as string;
  });
  const [step, setStep] = React.useState<
    'backup_unlock' | 'backup_running' | 'backup_success' | 'backup_error'
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
        // TODO: back to previous page
        console.log('no mnemonic');
        return;
      }

      setStep('backup_running');

      // upload seedPhrase to cloud
      saveMnemonicToCloud({
        mnemonic,
        password,
      })
        .then(() => {
          setStep('backup_success');
          setTimeout(() => {
            onDone?.();
          }, 500);
        })
        .catch(e => {
          // TODO: handle error
          console.log('backup error', e);
          setStep('backup_error');
        });
    },
    [mnemonic, onDone],
  );

  return (
    <View>
      {step === 'backup_unlock' && (
        <BackupUnlockScreen onConfirm={handleUpload} />
      )}
      {step === 'backup_running' && <BackupUploadScreen />}
      {step === 'backup_success' && <BackupSuccessScreen />}
      {step === 'backup_error' && (
        <BackupErrorScreen onConfirm={() => handleUpload(inputPassword)} />
      )}
    </View>
  );
};
