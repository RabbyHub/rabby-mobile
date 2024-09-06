import { apiMnemonic } from '@/core/apis';
import { BackupData, decryptFiles } from '@/core/utils/cloudBackup';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { BackupErrorScreen } from '../SeedPhraseBackupToCloud/BackupErrorScreen';
import { BackupUnlockScreen } from '../SeedPhraseBackupToCloud/BackupUnlockScreen';
import { BackupRestoreScreen } from './BackupRestoreScreen';

interface Props {
  onDone: (isNoMnemonic?: boolean) => void;
  files: BackupData[];
}

export const SeedPhraseRestoreFromCloud: React.FC<Props> = ({
  onDone,
  files,
}) => {
  const [step, setStep] = React.useState<
    'backup_unlock' | 'backup_downloading' | 'backup_error'
  >('backup_unlock');
  const [inputPassword, setInputPassword] = React.useState('');
  const [isPasswordError, setIsPasswordError] = React.useState(false);

  const { t } = useTranslation();

  const handleRestore = React.useCallback(
    async password => {
      setInputPassword(password);

      if (!password) {
        setStep('backup_unlock');
        return;
      }

      try {
        const result = await decryptFiles({ password, files });
        const arr = result.map(r => r.mnemonic);

        if (arr.length === 0) {
          setIsPasswordError(true);
          return;
        }

        setStep('backup_downloading');
        await new Promise(resolve => setTimeout(resolve, 500));
        await apiMnemonic.addMnemonicKeyringAndGotoSuccessScreen(arr);
        onDone();
      } catch (e) {
        console.log('backup error', e);
        setStep('backup_error');
      }
    },
    [files, onDone],
  );

  return (
    <View>
      {step === 'backup_unlock' && (
        <BackupUnlockScreen
          onConfirm={handleRestore}
          description={t('page.newAddress.seedPhrase.backupRestoreUnlockDesc')}
          title={t('page.newAddress.seedPhrase.backupRestoreUnlockTitle')}
          onCancel={onDone}
          ignoreValidation
          isError={isPasswordError}
          onClearError={() => setIsPasswordError(false)}
        />
      )}
      {step === 'backup_downloading' && <BackupRestoreScreen />}
      {step === 'backup_error' && (
        <BackupErrorScreen onConfirm={() => handleRestore(inputPassword)} />
      )}
    </View>
  );
};
