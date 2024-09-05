import { apiMnemonic } from '@/core/apis';
import {
  BackupDataWithMnemonic,
  getBackupsFromCloud,
} from '@/core/utils/cloudBackup';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { BackupErrorScreen } from '../SeedPhraseBackupToCloud/BackupErrorScreen';
import { BackupUnlockScreen } from '../SeedPhraseBackupToCloud/BackupUnlockScreen';
import { BackupRestoreScreen } from './BackupRestoreScreen';

interface Props {
  onDone: (isNoMnemonic?: boolean) => void;
  filenames: string[];
}

export const SeedPhraseRestoreFromCloud: React.FC<Props> = ({
  onDone,
  filenames,
}) => {
  const [step, setStep] = React.useState<
    'backup_unlock' | 'backup_downloading' | 'backup_success' | 'backup_error'
  >('backup_unlock');
  const [inputPassword, setInputPassword] = React.useState('');

  const { t } = useTranslation();

  const handleRestore = React.useCallback(
    async password => {
      setInputPassword(password);

      if (!password) {
        setStep('backup_unlock');
        return;
      }

      setStep('backup_downloading');
      getBackupsFromCloud({ password, filenames })
        .then(result => {
          const arr = result.map(r => r.mnemonic);

          console.log('memnonics', arr);

          if (arr) {
            return apiMnemonic.addMnemonicKeyringAndGotoSuccessScreen(arr);
          }
        })
        .then(() => {
          onDone();
        })
        .catch(e => {
          console.log('backup error', e);
          setStep('backup_error');
        });
    },
    [filenames, onDone],
  );

  return (
    <View>
      {step === 'backup_unlock' && (
        <BackupUnlockScreen
          onConfirm={handleRestore}
          description={t('page.newAddress.seedPhrase.backupRestoreUnlockDesc')}
          title={t('page.newAddress.seedPhrase.backupRestoreUnlockTitle')}
          onCancel={onDone}
        />
      )}
      {step === 'backup_downloading' && <BackupRestoreScreen />}
      {/* {step === 'backup_success' && <BackupSuccessScreen />} */}
      {step === 'backup_error' && (
        <BackupErrorScreen onConfirm={() => handleRestore(inputPassword)} />
      )}
    </View>
  );
};
