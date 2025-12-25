import { apiMnemonic } from '@/core/apis';
import { BackupData, decryptFiles } from '@/core/utils/cloudBackup';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { BackupErrorScreen } from '../SeedPhraseBackupToCloud/BackupErrorScreen2024';
import { BackupUnlockScreen } from '../SeedPhraseBackupToCloud/BackupUnlockScreen2024';
import { BackupRestoreScreen } from './BackupRestoreScreen2024';
import { useImportAddressProc } from '@/hooks/address/useNewUser';
import { RootNames } from '@/constant/layout';
import { preferenceService } from '@/core/services';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/services/type';
import { shouldRedirectToSetPasswordBefore2024 } from '@/hooks/useLock';

interface Props {
  onDone: (isNoMnemonic?: boolean) => void;
  shouldRedirect2SetPassword?: typeof shouldRedirectToSetPasswordBefore2024;
  files: BackupData[];
}

export const SeedPhraseRestoreFromCloud2024: React.FC<Props> = ({
  onDone,
  shouldRedirect2SetPassword,
  files,
}) => {
  const [step, setStep] = React.useState<
    'backup_unlock' | 'backup_downloading' | 'backup_error'
  >('backup_unlock');
  const [inputPassword, setInputPassword] = React.useState('');
  const [isPasswordError, setIsPasswordError] = React.useState(false);
  const { setConfirmCB } = useImportAddressProc();

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
        onDone();
        if (
          await shouldRedirect2SetPassword?.({
            backScreen: RootNames.ImportSuccess2024,
            isFirstImportPassword: true,
          })
        ) {
          preferenceService.setReportActionTs(
            REPORT_TIMEOUT_ACTION_KEY.IMPORT_SEED_PHRASE_RESTORE_CONFIRM,
          );
          setConfirmCB(() =>
            apiMnemonic.addMnemonicKeyringAndGotoSuccessScreen2024(arr),
          );
          return;
        }
        await apiMnemonic.addMnemonicKeyringAndGotoSuccessScreen2024(arr);
      } catch (e) {
        console.log('backup error', e);
        setStep('backup_error');
      }
    },
    [files, onDone, shouldRedirect2SetPassword, setConfirmCB],
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
