import { apiMnemonic } from '@/core/apis';
import { useRequest } from 'ahooks';
import React from 'react';
import { View } from 'react-native';
import { BackupErrorScreen } from './BackupErrorScreen';
import { BackupSuccessScreen } from './BackupSuccessScreen';
import { BackupUnlockScreen } from './BackupUnlockScreen';
import { BackupUploadScreen } from './BackupUploadScreen';

export const SeedPhraseBackupToCloud = () => {
  const { data: seedPhrase } = useRequest(async () => {
    const res = await apiMnemonic.getPreMnemonics();
    return res as string;
  });
  const [step, setStep] = React.useState<
    'backup_unlock' | 'backup_running' | 'backup_success' | 'backup_error'
  >('backup_unlock');

  const handleBackupUnlock = React.useCallback(() => {
    setStep('backup_running');
  }, []);

  return (
    <View>
      {step === 'backup_unlock' && (
        <BackupUnlockScreen onConfirm={handleBackupUnlock} />
      )}
      {step === 'backup_running' && <BackupUploadScreen />}
      {step === 'backup_success' && <BackupSuccessScreen />}
      {step === 'backup_error' && <BackupErrorScreen />}
    </View>
  );
};
